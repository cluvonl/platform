#!/usr/bin/env python3
"""Fixed staging provisioning/readback owner; no caller SQL or Auth writes."""
import ctypes as C
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
import staging_backup_session as bounded
from staging_backup_session import Session, Failure, require, TX_IDLE, TX_VALID

ROOT = Path(__file__).resolve().parent
PROJECT = 'fbozlbgmktkgcdfqdaaz'
LOCK = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
PINS = {'staging_backup_session.py': 'e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1', 'staging-sportlink-setup-sql.mjs': 'ab1803c1b9180e2c52b5afbedd0e5157d4165c17ac666a881eb8d9aac18ab960', 'staging-pwa-native-qa-fixture.mjs': '759bbef39a8894fac984ae2b9308721a16c4ee746608bd8d7a727091e1274bdd', 'staging-pwa-upgrade-files.mjs': 'a41f1da30fe1c1a0296aa5f1dfe229f177a208950a681bd06be53c2da90b61f5', 'staging-pwa-upgrade-migrations.mjs': '289792c7990eb3657c1cd59db8bd9acd1f89e190fca70ef30c9f13770f2ab8e7', 'staging-initial-migrations.mjs': '7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004', 'staging-migration-files.mjs': '83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd'}


def verify_sources():
    require(len(PINS) == 7, 'STAGING_SPORTLINK_SETUP_SOURCE_UNPINNED')
    for name, expected in PINS.items():
        path = ROOT / name
        require(path.is_file() and not path.is_symlink() and 0 < path.stat().st_size < 100000
                and hashlib.sha256(path.read_bytes()).hexdigest() == expected,
                'STAGING_SPORTLINK_SETUP_SOURCE_CHANGED')


def trusted_context(environment):
    require(environment.get('APP_ENV') == 'staging' and environment.get('GITHUB_REPOSITORY') == 'cluvonl/platform'
            and environment.get('GITHUB_REF') == 'refs/heads/staging'
            and environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
            and environment.get('GITHUB_SHA') == environment.get('RELEASE_SHA')
            and re.fullmatch(r'[0-9a-f]{40}', environment.get('RELEASE_SHA', ''))
            and re.fullmatch(r'[1-9][0-9]{0,19}', environment.get('GITHUB_RUN_ID', ''))
            and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}', environment.get('GITHUB_ACTOR', '')),
            'STAGING_SPORTLINK_SETUP_CONTEXT_REFUSED')


def duplicate_free(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate')
        result[key] = value
    return result


def recipe(operation, recipient, auth_user_id, session_id, environment):
    verify_sources()
    node = environment.get('SPORTLINK_SETUP_NODE_EXECUTABLE', '')
    require(os.path.isabs(node) and Path(node).name == 'node' and len(node) <= 4096,
            'STAGING_SPORTLINK_SETUP_GENERATOR_REFUSED')
    info = os.lstat(node)
    require(stat.S_ISREG(info.st_mode) and os.access(node, os.X_OK),
            'STAGING_SPORTLINK_SETUP_GENERATOR_REFUSED')
    request = {'operation': operation, 'recipient': recipient, 'authUserId': auth_user_id, 'sessionId': session_id,
               'sourceSha': environment['RELEASE_SHA'], 'workflowRunId': environment['GITHUB_RUN_ID'],
               'actor': environment['GITHUB_ACTOR']}
    result = subprocess.run([node, str(ROOT / 'staging-sportlink-setup-sql.mjs'), '--private-fixed-sportlink-setup-sql'],
                            input=json.dumps(request).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env={'PATH': '/usr/bin:/bin'}, timeout=15, check=False)
    require(result.returncode == 0 and not result.stderr and 0 < len(result.stdout) < 200000,
            'STAGING_SPORTLINK_SETUP_GENERATOR_REFUSED')
    try:
        value = json.loads(result.stdout.decode('utf-8', 'strict'), object_pairs_hook=duplicate_free)
    except (UnicodeError, ValueError):
        raise Failure('STAGING_SPORTLINK_SETUP_RECIPE_REFUSED') from None
    require(type(value) is dict, 'STAGING_SPORTLINK_SETUP_RECIPE_REFUSED')
    return value


class SportlinkSetupSession(Session):
    def __init__(self, environment):
        self.setup_environment = dict(environment)
        self.recipient, self.beneficiary_id, self.operator_session = None, None, None
        self.original_sessions, self.original_account = None, None
        self.phase = 'connected'
        super().__init__(environment, LOCK)

    def run_params(self, sql, parameters):
        require(self.connection is not None and self.pq.PQstatus(self.connection) == 0, 'DATABASE_DISCONNECTED')
        require(isinstance(sql, str) and '\0' not in sql and len(sql.encode()) <= bounded.MAX_INPUT, 'DATABASE_QUERY_INVALID')
        # Used solely by the fixed source-bound Sportlink setup context statement; values remain
        # alive through draining every result, and are never interpolated SQL.
        require(type(parameters) is list and len(parameters) == 4 and
                all(type(value) is str and '\0' not in value and
                    len(value.encode('utf-8')) <= 1024 for value in parameters),
                'STAGING_SPORTLINK_SETUP_PARAMETERS_REFUSED')
        encoded = [value.encode('utf-8') for value in parameters]
        values = (C.c_char_p * 4)(*encoded)
        lengths = (C.c_int * 4)(*[len(value) for value in encoded])
        formats = (C.c_int * 4)(0, 0, 0, 0)
        self.warning = False
        deadline = time.monotonic() + bounded.TIMEOUT
        results, total, row_count, cell_count = [], 2, 0, 0
        pending_rows, pending_columns = [], None
        try:
            sent = self.pq.PQsendQueryParams(self.connection, sql.encode(), 4, None, values, lengths, formats, 0)
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
                        sqlstate = bounded.bytes_value(self.pq.PQresultErrorField(result, ord('C')))
                        raise Failure('DATABASE_QUERY_FAILED', sqlstate)
                    columns, tuples = self.pq.PQnfields(result), self.pq.PQntuples(result)
                    require(0 <= columns <= bounded.MAX_COLUMNS, 'DATABASE_COLUMN_BOUND_EXCEEDED')
                    require((status == 9 and tuples == 1 and columns > 0)
                            or (status in (1, 2) and tuples == 0), 'DATABASE_ROW_MODE_INVALID')
                    if status == 9:
                        require(pending_columns is None or pending_columns == columns,
                                'DATABASE_RESULT_SHAPE_CHANGED')
                        pending_columns = columns
                        row_count += 1
                        cell_count += columns
                        require(row_count <= bounded.MAX_ROWS, 'DATABASE_ROW_BOUND_EXCEEDED')
                        require(cell_count <= bounded.MAX_CELLS, 'DATABASE_CELL_BOUND_EXCEEDED')
                        values = []
                        # Count JSON delimiters, NULLs and escaped strings too.
                        total += 2 + int(bool(pending_rows)) + max(0, columns - 1)
                        for column in range(columns):
                            require(time.monotonic() < deadline, 'DATABASE_TIMEOUT')
                            if self.pq.PQgetisnull(result, 0, column):
                                value, encoded_size = None, 4
                            else:
                                size = self.pq.PQgetlength(result, 0, column)
                                require(0 <= size <= bounded.MAX_RESULT - total, 'DATABASE_RESULT_BOUND_EXCEEDED')
                                try:
                                    value = C.string_at(self.pq.PQgetvalue(result, 0, column), size).decode('utf-8', 'strict')
                                except UnicodeDecodeError:
                                    raise Failure('DATABASE_RESULT_ENCODING_INVALID') from None
                                encoded_size = len(json.dumps(value, ensure_ascii=False).encode('utf-8'))
                            total += encoded_size
                            require(total <= bounded.MAX_RESULT, 'DATABASE_RESULT_BOUND_EXCEEDED')
                            values.append(value)
                        pending_rows.append(values)
                    else:
                        require((status == 2 and (pending_columns is None or pending_columns == columns))
                                or (status == 1 and pending_columns is None and columns == 0),
                                'DATABASE_RESULT_SHAPE_CHANGED')
                        require(len(results) < bounded.MAX_COMMANDS, 'DATABASE_COMMAND_BOUND_EXCEEDED')
                        command = bounded.bytes_value(self.pq.PQcmdStatus(result))
                        require(isinstance(command, str) and len(command) <= 128, 'DATABASE_COMMAND_INVALID')
                        total += len(json.dumps({'command':command, 'rows':[]},
                                               ensure_ascii=False, separators=(',', ':')).encode('utf-8'))
                        total += int(bool(results))
                        require(total <= bounded.MAX_RESULT, 'DATABASE_RESULT_BOUND_EXCEEDED')
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

    def idle(self):
        require(self.connection is not None and self.pq.PQtransactionStatus(self.connection) == TX_IDLE,
                'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
        return self.check_lock()

    def committed(self, results, before):
        require(results and results[-1]['command'] == 'COMMIT' and self.pq.PQtransactionStatus(self.connection) == TX_IDLE,
                'STAGING_SPORTLINK_SETUP_COMMIT_UNPROVED')
        after = self.check_lock()
        require(before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start'],
                'STAGING_SPORTLINK_SETUP_BACKEND_CHANGED')

    def preflight(self, recipient):
        require(self.phase == 'connected' and type(recipient) is str, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
        before = self.idle()
        value = recipe('preflight', recipient, None, None, self.setup_environment)
        require(set(value) == {'sql'}, 'STAGING_SPORTLINK_SETUP_RECIPE_REFUSED')
        results = self.run(value['sql'])
        self.committed(results, before)
        rows = [r['rows'] for r in results if r['command'].startswith('SELECT')]
        require(len(rows) == 1 and len(rows[0]) == 1 and len(rows[0][0]) == 1
                and json.loads(rows[0][0][0], object_pairs_hook=duplicate_free) == {'schema_target_verified': True, 'migration_count': 36},
                'STAGING_SPORTLINK_SETUP_PREFLIGHT_UNPROVED')
        self.recipient, self.phase = recipient, 'ready'
        return {'schema_target_verified': True, 'migration_count': 36}

    def provision(self):
        require(self.phase == 'ready', 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
        before = self.idle()
        value = recipe('provision', self.recipient, None, None, self.setup_environment)
        require(set(value) == {'guardSql', 'contextSql', 'parameters', 'mutationSql', 'readbackSql'},
                'STAGING_SPORTLINK_SETUP_RECIPE_REFUSED')
        self.run("BEGIN READ WRITE;SET LOCAL lock_timeout='15s';SET LOCAL statement_timeout='30s';"
                 "SET LOCAL standard_conforming_strings=on;SET LOCAL search_path=pg_catalog;SET LOCAL row_security=on;")
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
        self.run(value['guardSql'])
        configured = self.run_params(value['contextSql'], value['parameters'])
        require(len(configured) == 1 and configured[0]['rows'] == [['t']], 'STAGING_SPORTLINK_SETUP_CONTEXT_UNPROVED')
        self.run(value['mutationSql'])
        result = self.one_json(value['readbackSql'])
        require(type(result) is dict and set(result) == {'scope', 'outcome', 'tenant_id', 'tenant_slug', 'person_id',
                'auth_user_id', 'permission_count', 'provisioning_audits', 'provisioning_events', 'provisioning_commands'}
                and result['scope'] == 'STAGING_SPORTLINK_OPERATOR_SCOPE_V1' and result['outcome'] in ('created', 'already_configured')
                and all(result[k] == 1 for k in ('permission_count', 'provisioning_audits', 'provisioning_events', 'provisioning_commands')),
                'STAGING_SPORTLINK_SETUP_READBACK_UNPROVED')
        self.committed(self.run('COMMIT;'), before)
        self.beneficiary_id, self.phase = result['auth_user_id'], 'provisioned'
        stable = self.stable_account()
        self.original_sessions, self.original_account = stable['sessions'], stable['account']
        return result

    def stable_account(self):
        require(self.beneficiary_id is not None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
        # Every value remains in this private owner. Recovery/last-signin tokens
        # are legitimately changed by Auth; stable fields and old sessions are
        # independently preserved. No hash or identity reaches public evidence.
        request = recipe('stable', self.recipient, self.beneficiary_id, None, self.setup_environment)
        result = self.one_json(request['sql'])
        require(type(result) is dict and set(result) == {'account', 'sessions'} and
                type(result['account']) is str and re.fullmatch(r'[0-9a-f]{64}', result['account']) and
                type(result['sessions']) is list and len(result['sessions']) <= 10000 and
                all(type(v) is list and len(v) == 2 and type(v[0]) is str for v in result['sessions']),
                'STAGING_SPORTLINK_SETUP_STABLE_ACCOUNT_UNPROVED')
        return result

    def verify_session(self, value):
        require(self.phase == 'provisioned' and type(value) is dict and set(value) == {'auth_user_id', 'session_id'}
                and value['auth_user_id'] == self.beneficiary_id, 'STAGING_SPORTLINK_SETUP_SESSION_REFUSED')
        self.idle()
        request = recipe('session', self.recipient, value['auth_user_id'], value['session_id'], self.setup_environment)
        result = self.one_json(request['sql'])
        require(result == {'identity_confirmed': True, 'new_session_active': True, 'exact_scope': True},
                'STAGING_SPORTLINK_SETUP_SESSION_UNPROVED')
        self.check_lock()
        require(all(item[0] != value['session_id'] for item in self.original_sessions),
                'STAGING_SPORTLINK_SETUP_EXISTING_SESSION_REFUSED')
        self.operator_session, self.phase = value['session_id'], 'session'
        return {'native_session_verified': True}

    def readback(self):
        require(self.phase == 'session' and self.operator_session is not None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
        self.idle()
        request = recipe('readback', self.recipient, self.beneficiary_id, self.operator_session, self.setup_environment)
        result = self.one_json(request['sql'])
        self.check_lock()
        require(type(result) is dict and set(result) == {'connection_count', 'configured', 'test_code', 'native_audit_actor',
                'native_save_audits', 'native_test_audits', 'new_session_absent'}, 'STAGING_SPORTLINK_SETUP_READBACK_UNPROVED')
        stable = self.stable_account()
        result['account_fields_preserved'] = stable['account'] == self.original_account
        result['old_sessions_preserved'] = all(item in stable['sessions'] for item in self.original_sessions)
        return result


def main():
    session, sequence = None, 1
    try:
        require(len(sys.argv) == 1, 'STAGING_SPORTLINK_SETUP_CONTEXT_REFUSED')
        trusted_context(os.environ)
        verify_sources()
        while True:
            raw = sys.stdin.buffer.readline(16385)
            require(raw and len(raw) <= 16384 and raw.endswith(b'\n'), 'STAGING_SPORTLINK_SETUP_INPUT_BOUND')
            request = json.loads(raw.decode('utf8', 'strict'), object_pairs_hook=duplicate_free)
            require(type(request) is dict and set(request) == {'id', 'operation', 'argument'} and type(request['id']) is int
                    and request['id'] == sequence, 'STAGING_SPORTLINK_SETUP_REQUEST_REFUSED')
            sequence += 1
            op, arg = request['operation'], request['argument']
            try:
                if op == 'connect':
                    require(session is None and sequence == 2 and arg is None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
                    session = SportlinkSetupSession(dict(os.environ))
                    value = session.transport
                elif op == 'preflight':
                    require(session is not None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
                    value = session.preflight(arg)
                elif op == 'provision':
                    require(session is not None and arg is None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
                    value = session.provision()
                elif op == 'verify_session':
                    require(session is not None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
                    value = session.verify_session(arg)
                elif op == 'readback':
                    require(session is not None and arg is None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
                    value = session.readback()
                elif op == 'close':
                    require(session is not None and arg is None, 'STAGING_SPORTLINK_SETUP_PHASE_REFUSED')
                    session.close()
                    value = {'closed': True}
                else:
                    raise Failure('STAGING_SPORTLINK_SETUP_OPERATION_REFUSED')
                response = {'id': request['id'], 'ok': True, 'value': value}
            except Failure as error:
                response = {'id': request['id'], 'ok': False, 'code': error.code, 'sqlstate': error.sqlstate}
            encoded = (json.dumps(response, separators=(',', ':')) + '\n').encode()
            require(len(encoded) <= 16384, 'STAGING_SPORTLINK_SETUP_OUTPUT_BOUND')
            sys.stdout.buffer.write(encoded)
            sys.stdout.buffer.flush()
            if op == 'close' or not response['ok']:
                break
        return 0
    except BaseException:
        return 1
    finally:
        if session is not None:
            session.close()


if __name__ == '__main__':
    sys.exit(main())
