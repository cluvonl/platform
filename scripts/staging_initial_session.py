#!/usr/bin/env python3
"""Private fixed initial16 owner. No caller SQL is accepted for writes."""
import hashlib
import ctypes as C
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time

import staging_backup_session as bounded
from staging_backup_session import Failure, Session, require, MAX_INPUT, MAX_RESULT, TX_IDLE

ROOT = Path(__file__).resolve().parent
PROJECT = 'fbozlbgmktkgcdfqdaaz'
LOCK_OBJECT = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
PINS = {
    'staging_backup_session.py': 'e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1',
    'staging-initial-sql.mjs': 'c53174892aae16ba576b2ee23584b1438bd2e08a4a5db171c61346e08e88a021',
    'staging-initial-migrations.mjs': '7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004',
    'staging-migration-files.mjs': '83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd',
    'staging-api-exposure.mjs': '6555461d29e17a7aa16de6a07df76788b2d39159e4bcd922790693731f821863',
    'staging-core-bootstrap.mjs': '0592aa928efd1252a813e3091b44e11e6330c8304cc5a1f8918d1b96b2169458',
}
# Read operations retain the existing 128-command/30-second limits. Only fixed
# initial migration execution temporarily uses its measured 334-command bound.
INITIAL_COMMANDS = 400
INITIAL_TIMEOUT = 240.0
OPERATIONS = {'begin_capture', 'capture_query', 'check_lock', 'end_capture',
              'begin_fresh_read', 'fresh_read_query', 'end_fresh_read'}


def verify_sources():
    for name, expected in PINS.items():
        path = ROOT / name
        require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 100000,
                'INITIAL_SOURCE_CHANGED')
        require(hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'INITIAL_SOURCE_CHANGED')


def trusted_context(environment):
    require(environment.get('APP_ENV') == 'staging' and
            environment.get('GITHUB_REPOSITORY') == 'cluvonl/platform' and
            environment.get('GITHUB_REF') == 'refs/heads/staging' and
            environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch' and
            environment.get('GITHUB_SHA') == environment.get('RELEASE_SHA') and
            re.fullmatch(r'[0-9a-f]{40}', environment.get('RELEASE_SHA', '')) and
            re.fullmatch(r'[1-9][0-9]{0,19}', environment.get('GITHUB_RUN_ID', '')) and
            re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}', environment.get('GITHUB_ACTOR', '')),
            'INITIAL_WORKFLOW_CONTEXT_REQUIRED')


def fixed_context(argument, environment, index=False):
    fields = {'actor', 'workflow_run_id', 'source_sha'} | ({'index'} if index else set())
    require(type(argument) is dict and set(argument) == fields,
            'INITIAL_ARGUMENT_INVALID')
    require((not index or (type(argument['index']) is int and 0 <= argument['index'] < 16)) and
            argument['actor'] == environment.get('GITHUB_ACTOR') and
            argument['workflow_run_id'] == environment.get('GITHUB_RUN_ID') and
            argument['source_sha'] == environment.get('RELEASE_SHA'), 'INITIAL_ARGUMENT_INVALID')


def fixed_output(operation, argument, identity, environment, state=None):
    require(operation in ('apply_initial', 'configure_api', 'bootstrap_core'), 'INITIAL_OPERATION_INVALID')
    fixed_context(argument, environment, index=operation == 'apply_initial')
    verify_sources()
    node = environment.get('INITIAL_NODE_EXECUTABLE', '')
    require(os.path.isabs(node) and Path(node).name == 'node' and len(node) <= 4096,
            'INITIAL_GENERATOR_UNAVAILABLE')
    info = os.lstat(node)
    require(stat.S_ISREG(info.st_mode) and os.access(node, os.X_OK), 'INITIAL_GENERATOR_UNAVAILABLE')
    request = {'operation': operation, 'actor': argument['actor'], 'workflowRunId': argument['workflow_run_id'],
               'sourceSha': argument['source_sha'], 'expectedBackendPid': identity['backend_pid'],
               'expectedBackendStart': identity['backend_start']}
    if operation == 'apply_initial':
        request['index'] = argument['index']
    else:
        require(type(state) is dict, 'INITIAL_HISTORY_INCOMPLETE')
        request['state'] = state
    if operation == 'bootstrap_core':
        recipient = environment.get('STAGING_TEST_RECIPIENT', '')
        require(type(recipient) is str and len(recipient) <= 254 and
                re.fullmatch(r'[A-Za-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+', recipient),
                'STAGING_BOOTSTRAP_RECIPIENT_REQUIRED')
        request['recipient'] = recipient
    # The nested generator receives no PG environment/password or other key.
    result = subprocess.run([node, str(ROOT / 'staging-initial-sql.mjs'), '--private-fixed-initial-sql'],
                            input=json.dumps(request).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env={'PATH': '/usr/bin:/bin'}, timeout=15, check=False)
    require(result.returncode == 0 and not result.stderr and 0 < len(result.stdout) < 1000000,
            'INITIAL_GENERATOR_FAILED')
    try:
        return result.stdout.decode('utf-8', 'strict')
    except UnicodeError:
        raise Failure('INITIAL_GENERATOR_FAILED') from None


def fixed_sql(argument, identity, environment):
    return fixed_output('apply_initial', argument, identity, environment)


class InitialSession(Session):
    def __init__(self, environment, lock):
        self.initial_environment = dict(environment)
        self.initial_next = None
        super().__init__(environment, lock)

    def run_params(self, sql, parameters):
        require(self.connection is not None and self.pq.PQstatus(self.connection) == 0, 'DATABASE_DISCONNECTED')
        require(isinstance(sql, str) and '\0' not in sql and len(sql.encode()) <= bounded.MAX_INPUT, 'DATABASE_QUERY_INVALID')
        # Used solely by the fixed bootstrap context statement; values remain
        # alive through draining every result, and are never interpolated SQL.
        require(type(parameters) is list and len(parameters) == 4 and
                all(type(value) is str and '\0' not in value and
                    len(value.encode('utf-8')) <= 1024 for value in parameters),
                'STAGING_BOOTSTRAP_PARAMETERS_INVALID')
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

    def read_initial_state(self):
        require(self.state in ('fresh_read_complete', 'initial_ready') and
                self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'INITIAL_PHASE_INVALID')
        self.check_lock()
        layout = self.one_json("SELECT jsonb_build_object('schemas',(SELECT coalesce(jsonb_agg(nspname ORDER BY nspname),'[]'::jsonb) FROM pg_namespace WHERE nspname IN ('app','api','internal')),'app_objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','api','internal')),'history_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,'source_history_present',to_regclass('supabase_migrations.cluvo_migration_source') IS NOT NULL)")
        def rows(sql):
            result = self.run(sql, single=True)
            require(len(result) == 1 and len(result[0]['rows']) == 1 and len(result[0]['rows'][0]) == 1,
                    'INITIAL_READBACK_UNVERIFIED')
            try:
                value = json.loads(result[0]['rows'][0][0])
            except (ValueError, TypeError):
                raise Failure('INITIAL_READBACK_UNVERIFIED') from None
            require(type(value) is list and len(value) <= 16, 'INITIAL_READBACK_UNVERIFIED')
            return value
        history = rows("SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statement_count',cardinality(statements),'single_statement_sha256',CASE WHEN cardinality(statements)=1 THEN encode(sha256(convert_to(statements[1],'UTF8')),'hex') ELSE NULL END) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.schema_migrations") if layout['history_present'] else []
        source = rows("SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'file',file,'sha256',sha256,'source_sha',source_sha,'actor',actor,'scope',scope,'expected_version',expected_version,'idempotency_key',idempotency_key,'workflow_run_id',workflow_run_id) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.cluvo_migration_source") if layout['source_history_present'] else []
        self.check_lock()
        if len(history) == 16 and len(source) == 16:
            self.state = 'initial_ready'
        return {'layout': layout, 'historyRows': history, 'sourceRows': source}

    def apply_initial(self, argument):
        require(self.state in ('fresh_read_complete', 'initial_ready') and
                self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'INITIAL_PHASE_INVALID')
        before = self.check_lock()
        sql = fixed_sql(argument, self.identity, self.initial_environment)
        require(self.initial_next is None or argument['index'] == self.initial_next, 'INITIAL_ORDER_INVALID')
        self.check_lock()
        previous_commands, previous_timeout = bounded.MAX_COMMANDS, bounded.TIMEOUT
        try:
            bounded.MAX_COMMANDS, bounded.TIMEOUT = INITIAL_COMMANDS, INITIAL_TIMEOUT
            results = self.run(sql)
        finally:
            bounded.MAX_COMMANDS, bounded.TIMEOUT = previous_commands, previous_timeout
        require(results and results[0]['command'] == 'BEGIN' and results[-1]['command'] == 'COMMIT' and
                self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'INITIAL_COMMIT_UNPROVED')
        self.state = 'initial_ready'
        after = self.check_lock()
        require(before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start'],
                'INITIAL_SESSION_CHANGED')
        self.initial_next = argument['index'] + 1
        return {'applied_prefix': self.initial_next, 'atomic_transaction_committed': True,
                'exclusive_session_lock_retained': True}

    def fixed_ready(self, argument):
        require(self.state == 'initial_ready' and
                self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'INITIAL_PHASE_INVALID')
        fixed_context(argument, self.initial_environment)
        state = self.read_initial_state()
        require(len(state['historyRows']) == 16 and len(state['sourceRows']) == 16,
                'INITIAL_HISTORY_INCOMPLETE')
        return state

    def committed(self, results, before):
        require(results and results[-1]['command'] == 'COMMIT' and
                self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'INITIAL_COMMIT_UNPROVED')
        after = self.check_lock()
        require(before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start'],
                'INITIAL_SESSION_CHANGED')

    def configure_api(self, argument):
        state = self.fixed_ready(argument)
        before = self.check_lock()
        sql = fixed_output('configure_api', argument, self.identity, self.initial_environment, state)
        self.check_lock()
        results = self.run(sql)
        require(results and results[0]['command'] == 'BEGIN', 'INITIAL_COMMIT_UNPROVED')
        self.committed(results, before)
        verified = self.one_json("SELECT jsonb_build_object('api_schema_exposed',EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole WHERE r.rolname='authenticator' AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres') AND 'pgrst.db_schemas=api'=ANY(s.setconfig)))")
        require(verified == {'api_schema_exposed': True}, 'STAGING_API_READBACK_UNVERIFIED')
        self.check_lock()
        return {'scope': 'STAGING_API_EXPOSURE', 'api_schema_exposed': True,
                'atomic_transaction_committed': True, 'exclusive_session_lock_retained': True,
                'production_enabled': False, 'v1_ready': False}

    def bootstrap_core(self, argument):
        state = self.fixed_ready(argument)
        before = self.check_lock()
        raw = fixed_output('bootstrap_core', argument, self.identity, self.initial_environment, state)
        try:
            recipe = json.loads(raw, object_pairs_hook=duplicate_free)
        except ValueError:
            raise Failure('STAGING_BOOTSTRAP_RECIPE_INVALID') from None
        require(type(recipe) is dict and set(recipe) == {'guardSql', 'contextSql', 'parameters', 'mutationSql', 'readbackSql'}
                and all(type(recipe[key]) is str and 0 < len(recipe[key]) <= 100000 and '\0' not in recipe[key]
                        for key in ('guardSql', 'contextSql', 'mutationSql', 'readbackSql')),
                'STAGING_BOOTSTRAP_RECIPE_INVALID')
        require(recipe['parameters'] == [self.initial_environment['STAGING_TEST_RECIPIENT'],
                                        argument['source_sha'], argument['workflow_run_id'], argument['actor']],
                'STAGING_BOOTSTRAP_RECIPE_INVALID')
        self.check_lock()
        # Canonical tenant triggers execute as the restricted command owner.
        # row_security=off rejects even policy-authorized work by that role.
        begun = self.run("BEGIN READ WRITE; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s'; SET LOCAL standard_conforming_strings=on; SET LOCAL search_path=pg_catalog; SET LOCAL row_security=on;")
        require(begun and begun[0]['command'] == 'BEGIN' and
                self.pq.PQtransactionStatus(self.connection) == bounded.TX_VALID, 'INITIAL_PHASE_INVALID')
        self.run(recipe['guardSql'])
        configured = self.run_params(recipe['contextSql'], recipe['parameters'])
        require(len(configured) == 1 and configured[0]['rows'] == [['t']], 'STAGING_BOOTSTRAP_CONTEXT_UNVERIFIED')
        self.run(recipe['mutationSql'])
        # Transaction-local outcome must be read before COMMIT, held privately
        # until COMMIT and the physical-backend lock have both been verified.
        value = self.one_json(recipe['readbackSql'])
        counts = ('tenants', 'member_grants', 'households', 'intake_profiles', 'seasons', 'obligations',
                  'bootstrap_audits', 'bootstrap_commands')
        false_fields = ('auth_mutations', 'mail_sent', 'native_session_proven', 'v1_ready', 'production_enabled')
        expected = {'scope', 'status', 'fixture_version', 'current_ledger_entries', *counts, *false_fields}
        require(set(value) == expected and value['scope'] == 'STAGING_SYNTHETIC_CORE_V1' and
                value['status'] in ('created', 'already_configured') and type(value['fixture_version']) is int and
                value['fixture_version'] == 1 and all(type(value[key]) is int and value[key] == 1 for key in counts) and
                type(value['current_ledger_entries']) is int and value['current_ledger_entries'] >= 0 and
                all(value[key] is False for key in false_fields), 'STAGING_BOOTSTRAP_READBACK_UNVERIFIED')
        self.committed(self.run('COMMIT;'), before)
        return {**value, 'atomic_transaction_committed': True, 'exclusive_session_lock_retained': True}


def duplicate_free(pairs):
    result = {}
    for name, value in pairs:
        require(name not in result, 'INITIAL_REQUEST_INVALID')
        result[name] = value
    return result


def main():
    session, sequence = None, 1
    try:
        require(len(sys.argv) == 1, 'INITIAL_CONTEXT_REQUIRED')
        trusted_context(os.environ)
        verify_sources()
        while True:
            raw = sys.stdin.buffer.readline(MAX_INPUT + 1)
            if not raw:
                break
            require(len(raw) <= MAX_INPUT and raw.endswith(b'\n'), 'INITIAL_REQUEST_BOUND_EXCEEDED')
            try:
                request = json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=duplicate_free)
            except (UnicodeError, ValueError):
                raise Failure('INITIAL_REQUEST_INVALID') from None
            require(type(request) is dict and set(request) == {'id', 'operation', 'argument'} and
                    type(request['id']) is int and request['id'] == sequence, 'INITIAL_REQUEST_INVALID')
            sequence += 1
            operation, argument = request['operation'], request['argument']
            require(type(operation) is str, 'INITIAL_OPERATION_INVALID')
            try:
                if operation == 'connect':
                    require(session is None and sequence == 2 and argument == {'lock_object': LOCK_OBJECT},
                            'INITIAL_CONNECT_INVALID')
                    session = InitialSession(dict(os.environ), LOCK_OBJECT)
                    value = session.transport
                elif operation == 'close':
                    require(argument is None and session is not None, 'INITIAL_OPERATION_INVALID')
                    session.close()
                    value = {'closed': True}
                elif operation == 'apply_initial':
                    require(session is not None, 'INITIAL_OPERATION_INVALID')
                    value = session.apply_initial(argument)
                elif operation == 'read_initial_state':
                    require(argument is None and session is not None, 'INITIAL_OPERATION_INVALID')
                    value = session.read_initial_state()
                elif operation in ('configure_api', 'bootstrap_core'):
                    require(session is not None, 'INITIAL_OPERATION_INVALID')
                    value = getattr(session, operation)(argument)
                else:
                    require(operation in OPERATIONS and session is not None, 'INITIAL_OPERATION_INVALID')
                    if operation in ('capture_query', 'fresh_read_query'):
                        require(type(argument) is str, 'INITIAL_QUERY_INVALID')
                        value = getattr(session, operation)(argument)
                    else:
                        require(argument is None, 'INITIAL_OPERATION_INVALID')
                        value = getattr(session, operation)()
                response = {'id': request['id'], 'ok': True, 'value': value}
            except Failure as error:
                response = {'id': request['id'], 'ok': False, 'code': error.code, 'sqlstate': error.sqlstate}
            encoded = (json.dumps(response, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
            require(len(encoded) <= MAX_RESULT, 'INITIAL_RESPONSE_BOUND_EXCEEDED')
            sys.stdout.buffer.write(encoded)
            sys.stdout.buffer.flush()
            if operation == 'close' or not response['ok']:
                break
        return 0
    except BaseException:
        return 1
    finally:
        if session is not None:
            session.close()


if __name__ == '__main__':
    sys.exit(main())
