#!/usr/bin/env python3
"""Persistent libpq session library for the fixed Cluvo staging database.

Import has no process, environment or connection side effects. Results, backend
identities and snapshot IDs are private and must remain inside the operational
caller. The library has no CLI, reconnect or migration/apply operation.
"""
from datetime import datetime
import ctypes as C
import ctypes.util
import json
import os
import stat
import re
import select
import time

MAX_INPUT = 2_000_000
MAX_RESULT = 8_000_000
MAX_ROWS = 100_000
MAX_COLUMNS = 256
MAX_CELLS = 500_000
MAX_COMMANDS = 128
TIMEOUT = 30.0
NAMESPACE = 1129076054
PROJECT = 'fbozlbgmktkgcdfqdaaz'
TX_IDLE, TX_ACTIVE, TX_VALID, TX_FAILED, TX_UNKNOWN = range(5)

class Failure(Exception):
    def __init__(self, code, sqlstate=None):
        self.code = code
        self.sqlstate = sqlstate if re.fullmatch(r'[0-9A-Z]{5}', sqlstate or '') else None

def require(value, code):
    if not value:
        raise Failure(code)

def bytes_value(value):
    return value.decode('utf-8', 'strict') if value is not None else None

def verified_backend_identity(initial, wire_pid, *, session_pooler=False):
    # Only the already validated fixed5432 session route can differ from the
    # protocol cancellation PID. Direct/local identity equality remains strict.
    require(type(initial) is dict and set(initial)=={'backend_pid','backend_start','database','primary'},
            'BACKEND_IDENTITY_UNVERIFIED')
    pid,start=initial['backend_pid'],initial['backend_start']
    require(type(session_pooler) is bool, 'BACKEND_IDENTITY_UNVERIFIED')
    require(type(pid) is int and 0<pid<2**31, 'BACKEND_SQL_PID_UNVERIFIED')
    # Supavisor emits its own 32-bit cancellation identifier. libpq exposes
    # that bit pattern as a signed C int; it is not an OS PID on this route.
    # SQL identity and the physical-backend lock remain mandatory.
    require(type(wire_pid) is int and -(2**31)<=wire_pid<2**31 and wire_pid!=0
            and (session_pooler or wire_pid>0), 'BACKEND_PROTOCOL_PID_UNVERIFIED')
    require(initial['database']=='postgres', 'BACKEND_DATABASE_UNVERIFIED')
    require(initial['primary'] is True, 'BACKEND_PRIMARY_UNVERIFIED')
    require(type(start) is str and 1<=len(start)<=128, 'BACKEND_START_UNVERIFIED')
    try:
        parsed=datetime.fromisoformat(start)
    except (ValueError,TypeError):
        raise Failure('BACKEND_START_UNVERIFIED') from None
    require(parsed.tzinfo is not None, 'BACKEND_START_UNVERIFIED')
    require(session_pooler or pid==wire_pid, 'BACKEND_PID_MISMATCH')
    return dict(initial)

def verified_new_session_lock(value):
    # Advisory locks are reentrant. A provider may reuse a physical backend;
    # successful pg_try_advisory_lock alone cannot prove prior lock release.
    require(type(value) is dict and set(value) == {'already_held'}
            and value['already_held'] is False, 'SESSION_LOCK_ALREADY_HELD')

def bindings_library(name=None):
    library = C.CDLL(name or ctypes.util.find_library('pq'))
    pointer, integer, chars = C.c_void_p, C.c_int, C.c_char_p
    definitions = {
        'PQlibVersion': (integer, []),
        'PQconnectStartParams': (pointer, [C.POINTER(chars), C.POINTER(chars), integer]),
        'PQconnectPoll': (integer, [pointer]), 'PQfinish': (None, [pointer]),
        'PQstatus': (integer, [pointer]), 'PQtransactionStatus': (integer, [pointer]),
        'PQsocket': (integer, [pointer]), 'PQbackendPID': (integer, [pointer]),
        'PQsetnonblocking': (integer, [pointer, integer]),
        'PQsendQuery': (integer, [pointer, chars]), 'PQflush': (integer, [pointer]),
        'PQsetSingleRowMode': (integer, [pointer]),
        'PQsendQueryParams': (integer, [pointer, chars, integer, pointer, pointer, pointer, pointer, integer]),
        'PQconsumeInput': (integer, [pointer]), 'PQisBusy': (integer, [pointer]),
        'PQgetResult': (pointer, [pointer]), 'PQresultStatus': (integer, [pointer]),
        'PQresultErrorField': (chars, [pointer, integer]), 'PQclear': (None, [pointer]),
        'PQntuples': (integer, [pointer]), 'PQnfields': (integer, [pointer]),
        'PQgetisnull': (integer, [pointer, integer, integer]),
        'PQgetlength': (integer, [pointer, integer, integer]),
        'PQgetvalue': (pointer, [pointer, integer, integer]),
        'PQcmdStatus': (chars, [pointer]),
        'PQsslInUse': (integer, [pointer]), 'PQsslAttribute': (chars, [pointer, chars]),
        'PQserverVersion': (integer, [pointer]),
    }
    for name, (restype, argtypes) in definitions.items():
        function = getattr(library, name)
        function.restype, function.argtypes = restype, argtypes
    # A callback prevents libpq's default notice processor printing private
    # provider messages. Only severity is read; warning/error marks failure.
    notice_type = C.CFUNCTYPE(None, pointer, pointer)
    library.PQsetNoticeReceiver.restype = pointer
    library.PQsetNoticeReceiver.argtypes = [pointer, notice_type, pointer]
    return library, notice_type

class Session:
    def __init__(self, environment, lock_object, local=False, library=None):
        self.pq, notice_type = bindings_library(library)
        self.connection = None
        self.state = 'new'
        self.warning = False
        self.notice_count = 0
        self.snapshot = None
        self.fresh_snapshot = None
        self.fresh_used = False
        self.identity = None
        self.lock_object = lock_object
        self.local = local
        require(type(lock_object) is int and -(2**31) <= lock_object < 2**31, 'LOCK_OBJECT_INVALID')
        def notice(_, result):
            self.notice_count += 1
            severity = self.pq.PQresultErrorField(result, ord('V'))
            if severity not in (b'DEBUG', b'LOG', b'INFO', b'NOTICE'):
                self.warning = True
        self.notice_receiver = notice_type(notice)
        try:
            settings = self.connection_settings(environment, local)
            keys = (C.c_char_p * (len(settings) + 1))(*[k.encode() for k in settings], None)
            values = (C.c_char_p * (len(settings) + 1))(*[v.encode() for v in settings.values()], None)
            self.connection = self.pq.PQconnectStartParams(keys, values, 0)
            require(bool(self.connection), 'DATABASE_CONNECT_FAILED')
            self.pq.PQsetNoticeReceiver(self.connection, self.notice_receiver, None)
            deadline = time.monotonic() + 12
            while True:
                result = self.pq.PQconnectPoll(self.connection)
                if result == 3:
                    break
                require(result in (1, 2), 'DATABASE_CONNECT_FAILED')
                self.wait(deadline, read=result == 1, write=result == 2)
            require(self.pq.PQstatus(self.connection) == 0, 'DATABASE_CONNECT_FAILED')
            require(not self.warning, 'DATABASE_UNEXPECTED_WARNING')
            require(self.pq.PQsetnonblocking(self.connection, 1) == 0, 'DATABASE_NONBLOCKING_FAILED')
            require(self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'DATABASE_NOT_IDLE')
            require(self.pq.PQserverVersion(self.connection) == 170011, 'DATABASE_VERSION_MISMATCH')
            protocol = bytes_value(self.pq.PQsslAttribute(self.connection, b'protocol'))
            tls = bool(self.pq.PQsslInUse(self.connection))
            require(local or (tls and protocol in ('TLSv1.2', 'TLSv1.3')), 'DATABASE_CLIENT_TLS_UNVERIFIED')
            self.transport = {'client_tls': tls, 'client_tls_protocol': protocol,
                              'libpq_version': self.pq.PQlibVersion(), 'postgres_version': 170011,
                              'scope': 'LOCAL_ONLY' if local else 'HOSTED_VERIFY_FULL'}
            self.state = 'connected'
            initial = self.one_json("select json_build_object('backend_pid',pg_backend_pid(),'backend_start',(select backend_start::text from pg_stat_activity where pid=pg_backend_pid()),'database',current_database(),'primary',not pg_is_in_recovery());")
            session_pooler=not local and settings['host'].endswith('.pooler.supabase.com')
            self.identity=verified_backend_identity(initial,self.pq.PQbackendPID(self.connection),
                                                    session_pooler=session_pooler)
            self.transport['backend_identity_mode']='session_sql_backend_and_lock' if session_pooler else 'direct_wire_sql_equal'
            existing = self.one_json(f"select json_build_object('already_held',exists(select 1 from pg_locks where pid=pg_backend_pid() and locktype='advisory' and granted and classid={NAMESPACE}::oid and objid={lock_object & 0xffffffff}::oid and objsubid=2));")
            verified_new_session_lock(existing)
            # Non-blocking acquisition; no indefinite/adaptive retry.
            lock = self.one_json(f"select json_build_object('acquired',pg_try_advisory_lock({NAMESPACE},{lock_object}));")
            require(lock.get('acquired') is True, 'EXCLUSIVE_SESSION_LOCK_BUSY')
            self.state = 'locked'
            self.check_lock()
        except BaseException:
            self.close()
            raise

    @staticmethod
    def connection_settings(environment, local):
        expected = ('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE', 'PGSSLROOTCERT')
        require(all(isinstance(environment.get(k), str) and '\0' not in environment[k]
                    for k in expected if k in environment), 'DATABASE_ENVIRONMENT_INVALID')
        require(environment.get('PGDATABASE') == 'postgres' and environment.get('PGPORT') == '5432', 'DATABASE_TARGET_INVALID')
        host, user = environment.get('PGHOST', ''), environment.get('PGUSER', '')
        if local:
            # Local harness has a distinct mode, never represented as hosted TLS.
            require(host == '/restore' and user == 'postgres' and environment.get('PGSSLMODE') == 'disable', 'LOCAL_SOCKET_REQUIRED')
        else:
            direct = host == f'db.{PROJECT}.supabase.co' and user == 'postgres'
            pooled = bool(re.fullmatch(r'[a-z0-9-]+\.pooler\.supabase\.com', host)) and user == f'postgres.{PROJECT}'
            require(direct or pooled, 'DATABASE_PROJECT_MISMATCH')
            require(environment.get('PGSSLMODE') == 'verify-full' and environment.get('PGSSLROOTCERT')
                    and environment.get('PGPASSWORD'), 'DATABASE_VERIFY_FULL_REQUIRED')
        # All inherited PG*, service/.pgpass/hostaddr settings are excluded.
        settings = {'host':host, 'port':'5432', 'user':user, 'dbname':'postgres',
                    'password':environment.get('PGPASSWORD', ''), 'sslmode':environment['PGSSLMODE'],
                    'connect_timeout':'12', 'application_name':'cluvo-staging-capture-private',
                    'options':'-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=15000 -c row_security=off -c client_encoding=UTF8 -c search_path=pg_catalog',
                    'passfile':'/dev/null', 'target_session_attrs':'any'}
        if local:
            # The owned runtime supplies an empty regular0600 file. /dev/null
            # is a character device and libpq warns before trust authentication.
            empty_passfile = '/restore/runtime/empty-passfile'
            metadata = os.lstat(empty_passfile)
            require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid == os.getuid()
                    and stat.S_IMODE(metadata.st_mode) == 0o600 and metadata.st_size == 0,
                    'LOCAL_EMPTY_PASSFILE_REQUIRED')
            settings['passfile'] = empty_passfile
        if not local:
            settings['sslrootcert'] = environment['PGSSLROOTCERT']
            settings['ssl_min_protocol_version'] = 'TLSv1.2'
        return settings

    def close(self):
        if self.connection:
            self.pq.PQfinish(self.connection)
            self.connection = None
        self.state = 'closed'

    def wait(self, deadline, read=True, write=False):
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'DATABASE_TIMEOUT')
        descriptor = self.pq.PQsocket(self.connection)
        require(descriptor >= 0, 'DATABASE_DISCONNECTED')
        ready = select.select([descriptor] if read else [], [descriptor] if write else [], [], remaining)
        require(bool(ready[0] or ready[1]), 'DATABASE_TIMEOUT')

    def run(self, sql, single=False):
        require(self.connection is not None and self.pq.PQstatus(self.connection) == 0, 'DATABASE_DISCONNECTED')
        require(isinstance(sql, str) and '\0' not in sql and len(sql.encode()) <= MAX_INPUT, 'DATABASE_QUERY_INVALID')
        self.warning = False
        deadline = time.monotonic() + TIMEOUT
        results, total, row_count, cell_count = [], 2, 0, 0
        pending_rows, pending_columns = [], None
        try:
            sent = self.pq.PQsendQueryParams(self.connection, sql.encode(), 0, None, None, None, None, 0) if single else self.pq.PQsendQuery(self.connection, sql.encode())
            require(sent == 1, 'DATABASE_SEND_FAILED')
            # Set this before flush/consume/getResult. libpq otherwise buffers
            # every row before any application-side budget can be checked.
            require(self.pq.PQsetSingleRowMode(self.connection) == 1, 'DATABASE_ROW_MODE_FAILED')
            while True:
                require(time.monotonic() < deadline, 'DATABASE_TIMEOUT')
                flushed = self.pq.PQflush(self.connection)
                require(flushed >= 0, 'DATABASE_DISCONNECTED')
                if flushed == 0:
                    break
                self.wait(deadline, read=True, write=True)
                require(self.pq.PQconsumeInput(self.connection) == 1, 'DATABASE_DISCONNECTED')
            while True:
                require(time.monotonic() < deadline, 'DATABASE_TIMEOUT')
                while self.pq.PQisBusy(self.connection):
                    self.wait(deadline)
                    require(self.pq.PQconsumeInput(self.connection) == 1, 'DATABASE_DISCONNECTED')
                result = self.pq.PQgetResult(self.connection)
                if not result:
                    require(pending_columns is None, 'DATABASE_RESULT_INCOMPLETE')
                    break
                try:
                    status = self.pq.PQresultStatus(result)
                    if status not in (1, 2, 9):
                        sqlstate = bytes_value(self.pq.PQresultErrorField(result, ord('C')))
                        raise Failure('DATABASE_QUERY_FAILED', sqlstate)
                    columns, tuples = self.pq.PQnfields(result), self.pq.PQntuples(result)
                    require(0 <= columns <= MAX_COLUMNS, 'DATABASE_COLUMN_BOUND_EXCEEDED')
                    require((status == 9 and tuples == 1 and columns > 0)
                            or (status in (1, 2) and tuples == 0), 'DATABASE_ROW_MODE_INVALID')
                    if status == 9:
                        require(pending_columns is None or pending_columns == columns,
                                'DATABASE_RESULT_SHAPE_CHANGED')
                        pending_columns = columns
                        row_count += 1
                        cell_count += columns
                        require(row_count <= MAX_ROWS, 'DATABASE_ROW_BOUND_EXCEEDED')
                        require(cell_count <= MAX_CELLS, 'DATABASE_CELL_BOUND_EXCEEDED')
                        values = []
                        # Count JSON delimiters, NULLs and escaped strings too.
                        total += 2 + int(bool(pending_rows)) + max(0, columns - 1)
                        for column in range(columns):
                            require(time.monotonic() < deadline, 'DATABASE_TIMEOUT')
                            if self.pq.PQgetisnull(result, 0, column):
                                value, encoded_size = None, 4
                            else:
                                size = self.pq.PQgetlength(result, 0, column)
                                require(0 <= size <= MAX_RESULT - total, 'DATABASE_RESULT_BOUND_EXCEEDED')
                                try:
                                    value = C.string_at(self.pq.PQgetvalue(result, 0, column), size).decode('utf-8', 'strict')
                                except UnicodeDecodeError:
                                    raise Failure('DATABASE_RESULT_ENCODING_INVALID') from None
                                encoded_size = len(json.dumps(value, ensure_ascii=False).encode('utf-8'))
                            total += encoded_size
                            require(total <= MAX_RESULT, 'DATABASE_RESULT_BOUND_EXCEEDED')
                            values.append(value)
                        pending_rows.append(values)
                    else:
                        require((status == 2 and (pending_columns is None or pending_columns == columns))
                                or (status == 1 and pending_columns is None and columns == 0),
                                'DATABASE_RESULT_SHAPE_CHANGED')
                        require(len(results) < MAX_COMMANDS, 'DATABASE_COMMAND_BOUND_EXCEEDED')
                        command = bytes_value(self.pq.PQcmdStatus(result))
                        require(isinstance(command, str) and len(command) <= 128, 'DATABASE_COMMAND_INVALID')
                        total += len(json.dumps({'command':command, 'rows':[]},
                                               ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
                        total += int(bool(results))
                        require(total <= MAX_RESULT, 'DATABASE_RESULT_BOUND_EXCEEDED')
                        results.append({'command':command, 'rows':pending_rows})
                        pending_rows, pending_columns = [], None
                finally:
                    self.pq.PQclear(result)
            require(not self.warning, 'DATABASE_UNEXPECTED_WARNING')
            require(self.pq.PQstatus(self.connection) == 0, 'DATABASE_DISCONNECTED')
            return results
        except BaseException:
            # No surviving results/pending operation/reconnect after uncertainty.
            self.close()
            raise

    def one_json(self, sql):
        results = self.run(sql)
        require(len(results) == 1 and len(results[0]['rows']) == 1 and len(results[0]['rows'][0]) == 1, 'DATABASE_METADATA_SHAPE_INVALID')
        try:
            value = json.loads(results[0]['rows'][0][0])
        except (TypeError, ValueError):
            raise Failure('DATABASE_METADATA_SHAPE_INVALID') from None
        require(isinstance(value, dict), 'DATABASE_METADATA_SHAPE_INVALID')
        return value

    def lock_sql(self):
        return f"select json_build_object('backend_pid',pg_backend_pid(),'backend_start',(select backend_start::text from pg_stat_activity where pid=pg_backend_pid()),'exclusive_lock',exists(select 1 from pg_locks where pid=pg_backend_pid() and locktype='advisory' and mode='ExclusiveLock' and granted and classid={NAMESPACE}::oid and objid={self.lock_object & 0xffffffff}::oid and objsubid=2),'read_only',current_setting('transaction_read_only')='on','isolation',current_setting('transaction_isolation'),'visibility_snapshot',pg_current_snapshot()::text);"

    def check_lock(self):
        value = self.one_json(self.lock_sql())
        require(self.identity is not None and value.get('backend_pid') == self.identity['backend_pid']
                and value.get('backend_start') == self.identity['backend_start']
                and value.get('exclusive_lock') is True, 'SESSION_OR_EXCLUSIVE_LOCK_CHANGED')
        if self.state in ('capture', 'fresh_read'):
            context = self.snapshot if self.state == 'capture' else self.fresh_snapshot
            require(context is not None and value.get('visibility_snapshot') == context['visibility_snapshot'],
                    'SNAPSHOT_VISIBILITY_CHANGED')
        return value

    def begin_capture(self):
        require(self.state == 'locked' and self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'CAPTURE_PHASE_INVALID')
        self.check_lock()
        self.run('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;')
        value = self.one_json("select json_build_object('exported_snapshot',pg_export_snapshot(),'visibility_snapshot',pg_current_snapshot()::text);")
        require(re.fullmatch(r'[0-9A-F]{8}-[0-9A-F]{8}-[1-9][0-9]*', value.get('exported_snapshot', ''), re.I)
                and re.fullmatch(r'\d+:\d+:[\d,]*', value.get('visibility_snapshot', '')), 'SNAPSHOT_INVALID')
        guard = self.check_lock()
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID and guard['read_only'] is True
                and guard['isolation'] == 'repeatable read', 'SNAPSHOT_TRANSACTION_INVALID')
        self.snapshot = {**self.identity, **value}
        self.state = 'capture'
        return dict(self.snapshot)

    def capture_query(self, sql):
        require(self.state == 'capture' and self.pq.PQtransactionStatus(self.connection) == TX_VALID, 'CAPTURE_PHASE_INVALID')
        # Extended-query protocol admits exactly one statement. PostgreSQL's
        # real READ ONLY transaction rejects writes; a SQL prefix alone does
        # not constitute the read-only guarantee.
        require(isinstance(sql, str) and re.match(r'^\s*(SELECT|WITH)\b', sql, re.I), 'CAPTURE_QUERY_REQUIRED')
        before = self.check_lock()
        require(before['read_only'] is True and before['isolation'] == 'repeatable read', 'SNAPSHOT_TRANSACTION_INVALID')
        values = self.run(sql, single=True)
        after = self.check_lock()
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID and after['read_only'] is True
                and after['isolation'] == 'repeatable read', 'SNAPSHOT_TRANSACTION_CHANGED')
        return values

    def end_capture(self):
        require(self.state == 'capture' and self.pq.PQtransactionStatus(self.connection) == TX_VALID, 'CAPTURE_PHASE_INVALID')
        self.check_lock()
        self.run('ROLLBACK;')
        require(self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'SNAPSHOT_END_UNVERIFIED')
        # The exported MVCC snapshot legitimately ends here. Keep the session
        # identity/lock guard, but do not compare an idle transaction's fresh
        # visibility snapshot with the now-ended RR snapshot.
        self.state = 'captured'
        self.check_lock()
        return {'snapshot_transaction_ended':True, 'exclusive_session_lock_retained':True}

    def begin_fresh_read(self):
        require(self.state == 'captured' and not self.fresh_used
                and self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'FRESH_READ_PHASE_INVALID')
        self.check_lock()
        self.fresh_used = True
        self.run('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;')
        value = self.one_json("select json_build_object('visibility_snapshot',pg_current_snapshot()::text);")
        require(re.fullmatch(r'\d+:\d+:[\d,]*', value.get('visibility_snapshot', '')), 'FRESH_SNAPSHOT_INVALID')
        guard = self.check_lock()
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID and guard['read_only'] is True
                and guard['isolation'] == 'repeatable read', 'FRESH_SNAPSHOT_TRANSACTION_INVALID')
        self.fresh_snapshot = {**self.identity, **value, 'phase':'fresh_read'}
        self.state = 'fresh_read'
        self.check_lock()
        return dict(self.fresh_snapshot)

    def fresh_read_query(self, sql):
        require(self.state == 'fresh_read' and self.pq.PQtransactionStatus(self.connection) == TX_VALID,
                'FRESH_READ_PHASE_INVALID')
        require(isinstance(sql, str) and re.match(r'^\s*(SELECT|WITH)\b', sql, re.I), 'FRESH_READ_QUERY_REQUIRED')
        before = self.check_lock()
        require(before['read_only'] is True and before['isolation'] == 'repeatable read', 'FRESH_SNAPSHOT_TRANSACTION_INVALID')
        values = self.run(sql, single=True)
        after = self.check_lock()
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID and after['read_only'] is True
                and after['isolation'] == 'repeatable read', 'FRESH_SNAPSHOT_TRANSACTION_CHANGED')
        return values

    def end_fresh_read(self):
        require(self.state == 'fresh_read' and self.pq.PQtransactionStatus(self.connection) == TX_VALID,
                'FRESH_READ_PHASE_INVALID')
        self.check_lock()
        self.run('ROLLBACK;')
        require(self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'FRESH_READ_END_UNVERIFIED')
        self.state = 'fresh_read_complete'
        self.check_lock()
        return {'fresh_read_transaction_ended':True, 'exclusive_session_lock_retained':True}

    # Deliberately no migration/apply operation in this first transport draft.
    # The live execution owner must bind actual restore/capture/source proof,
    # recheck fresh source drift and inject immutable per-file atomic execution.
