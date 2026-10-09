#!/usr/bin/env python3
"""Fixed private QA owner. Provider Auth mutations occur only through its API."""
import ctypes as C
import time
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

import staging_backup_session as bounded
from staging_backup_session import Failure, require, MAX_INPUT, MAX_RESULT, TX_IDLE, TX_VALID, Session


ROOT = Path(__file__).resolve().parent
PROJECT = 'fbozlbgmktkgcdfqdaaz'
LOCK = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
# Completed source bytes are pinned before this owner is promoted.
PINS = {'staging_backup_session.py': 'e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1', 'staging-initial-migrations.mjs': '7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004', 'staging-migration-files.mjs': '83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd', 'staging-pwa-upgrade-migrations.mjs': 'aff29cc7982832bb11f34f3294651889eb2d57cde1a664c1164a8cb2233ec2ea', 'staging-pwa-upgrade-files.mjs': '1f576a995c730de250eb05856cc529b08d19dd18b8dcef60cbc42e4be96e1136', 'staging-pwa-native-qa-fixture.mjs': 'd947850f46e6ab0b79e19af9d84a4bda9785a001b0ad98283997c6940f17d0c2', 'staging-pwa-native-qa-booking.mjs': 'dceee6137debb1015b982e5a2877da9f6e368a810a0ad6ac467ace28d70e85dc', 'staging-pwa-native-qa-automation.mjs': 'b99f275ccb86c8b16e7ef558891cb738718488792dd8d210414260925b26afb4', 'staging-pwa-native-qa-sql.mjs': '016f74100a15cd8f6a20dfd1cd0e4b44b1cf7aaa3484e2fd9f7239267e8d5a30'}


def verify_sources():
    require(len(PINS) == 9, 'STAGING_NATIVE_QA_SOURCE_UNPINNED')
    for name, expected in PINS.items():
        path = ROOT / name
        require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 100000
                and hashlib.sha256(path.read_bytes()).hexdigest() == expected,
                'STAGING_NATIVE_QA_SOURCE_CHANGED')


def trusted_context(environment):
    require(environment.get('APP_ENV') == 'staging' and environment.get('GITHUB_REPOSITORY') == 'cluvonl/platform'
            and environment.get('GITHUB_REF') == 'refs/heads/staging'
            and environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
            and environment.get('GITHUB_SHA') == environment.get('RELEASE_SHA')
            and re.fullmatch(r'[0-9a-f]{40}', environment.get('RELEASE_SHA', ''))
            and re.fullmatch(r'[1-9][0-9]{0,19}', environment.get('GITHUB_RUN_ID', ''))
            and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}', environment.get('GITHUB_ACTOR', '')),
            'STAGING_NATIVE_QA_WORKFLOW_CONTEXT_REQUIRED')


def duplicate_free(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate')
        result[key] = value
    return result


def recipe(operation, providers, environment):
    verify_sources()
    node = environment.get('PWA_NATIVE_QA_NODE_EXECUTABLE', '')
    require(os.path.isabs(node) and Path(node).name == 'node' and len(node) <= 4096,
            'STAGING_NATIVE_QA_GENERATOR_UNAVAILABLE')
    info = os.lstat(node)
    require(stat.S_ISREG(info.st_mode) and os.access(node, os.X_OK),
            'STAGING_NATIVE_QA_GENERATOR_UNAVAILABLE')
    request = {'operation': operation, 'providers': providers,
               'sourceSha': environment['RELEASE_SHA'], 'workflowRunId': environment['GITHUB_RUN_ID'],
               'actor': environment['GITHUB_ACTOR']}
    result = subprocess.run([node, str(ROOT / 'staging-pwa-native-qa-sql.mjs'), '--private-fixed-native-qa-sql'],
                            input=json.dumps(request).encode(), stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env={'PATH': '/usr/bin:/bin'}, timeout=15, check=False)
    require(result.returncode == 0 and not result.stderr and 0 < len(result.stdout) < 1000000,
            'STAGING_NATIVE_QA_GENERATOR_FAILED')
    try:
        value = json.loads(result.stdout.decode('utf-8', 'strict'), object_pairs_hook=duplicate_free)
    except (UnicodeError, ValueError):
        raise Failure('STAGING_NATIVE_QA_RECIPE_INVALID') from None
    require(type(value) is dict, 'STAGING_NATIVE_QA_RECIPE_INVALID')
    return value


def scalar_json(results):
    rows = [item['rows'] for item in results if item['command'].startswith('SELECT')]
    require(len(rows) == 1 and len(rows[0]) == 1 and len(rows[0][0]) == 1,
            'STAGING_NATIVE_QA_READBACK_UNVERIFIED')
    try:
        value = json.loads(rows[0][0][0], object_pairs_hook=duplicate_free)
    except (ValueError, TypeError):
        raise Failure('STAGING_NATIVE_QA_READBACK_UNVERIFIED') from None
    require(type(value) is dict, 'STAGING_NATIVE_QA_READBACK_UNVERIFIED')
    return value


class NativeSession(Session):
    def __init__(self, environment):
        self.qa_environment = dict(environment)
        self.providers, self.fixture, self.booking = None, None, None
        self.phase = 'connected'
        super().__init__(environment, LOCK)

    def run_params(self, sql, parameters):
        require(self.connection is not None and self.pq.PQstatus(self.connection) == 0, 'DATABASE_DISCONNECTED')
        require(isinstance(sql, str) and '\0' not in sql and len(sql.encode()) <= bounded.MAX_INPUT, 'DATABASE_QUERY_INVALID')
        # Used solely by the fixed source-bound PWA QA context statement; values remain
        # alive through draining every result, and are never interpolated SQL.
        require(type(parameters) is list and len(parameters) == 4 and
                all(type(value) is str and '\0' not in value and
                    len(value.encode('utf-8')) <= 1024 for value in parameters),
                'STAGING_PWA_NATIVE_QA_PARAMETERS_INVALID')
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

    def committed(self, results, before):
        require(results and results[-1]['command'] == 'COMMIT' and
                self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'STAGING_PWA_NATIVE_QA_COMMIT_UNPROVED')
        after = self.check_lock()
        require(before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start'],
                'STAGING_PWA_NATIVE_QA_SESSION_CHANGED')

    def idle(self):
        require(self.connection is not None and self.pq.PQtransactionStatus(self.connection) == TX_IDLE,
                'STAGING_NATIVE_QA_PHASE_INVALID')
        return self.check_lock()

    def preflight(self):
        before = self.idle()
        require(self.phase in ('connected', 'ready'), 'STAGING_NATIVE_QA_PHASE_INVALID')
        value = recipe('preflight', None, self.qa_environment)
        require(set(value) == {'preflightSql', 'migrationCount'} and type(value['preflightSql']) is str
                and type(value['migrationCount']) is int and 17 <= value['migrationCount'] <= 64,
                'STAGING_NATIVE_QA_RECIPE_INVALID')
        results = self.run(value['preflightSql'])
        self.committed(results, before)
        readback = scalar_json(results)
        expected = {'scope': 'STAGING_PWA_NATIVE_QA_PREFLIGHT_V1', 'migration_count': value['migrationCount'],
                    'api_only': True, 'command_owner_restricted': True,
                    'auth_mutations': False, 'v1_ready': False, 'production_enabled': False}
        require(type(readback) is dict and set(readback) == set(expected) | {'native_guarded_tables'}
                and all(readback[key] == value for key, value in expected.items())
                and type(readback['native_guarded_tables']) is int and 144 <= readback['native_guarded_tables'] <= 10000,
                'STAGING_NATIVE_QA_PREFLIGHT_UNVERIFIED')
        self.phase = 'ready'
        return readback

    def transaction(self, value, mutation, readback):
        before = self.idle()
        require(all(type(value[key]) is str and 0 < len(value[key]) < 100000 and '\0' not in value[key]
                    for key in ('contextSql', mutation, readback)), 'STAGING_NATIVE_QA_RECIPE_INVALID')
        self.run("BEGIN READ WRITE; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s'; "
                 "SET LOCAL standard_conforming_strings=on; SET LOCAL search_path=pg_catalog; SET LOCAL row_security=on;")
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID, 'STAGING_NATIVE_QA_PHASE_INVALID')
        if 'guardSql' in value:
            require(type(value['guardSql']) is str and 0 < len(value['guardSql']) < 100000,
                    'STAGING_NATIVE_QA_RECIPE_INVALID')
            self.run(value['guardSql'])
        configured = self.run_params(value['contextSql'], value['parameters'])
        require(len(configured) == 1 and configured[0]['rows'] == [['t']], 'STAGING_NATIVE_QA_CONTEXT_UNVERIFIED')
        self.run(value[mutation])
        result = self.one_json(value[readback])
        self.committed(self.run('COMMIT;'), before)
        return result

    def setup_fixture(self, argument):
        require(self.phase == 'ready' and type(argument) is list and len(argument) == 2,
                'STAGING_NATIVE_QA_PHASE_INVALID')
        value = recipe('fixture', argument, self.qa_environment)
        result = self.transaction(value, 'mutationSql', 'readbackSql')
        self.providers, self.fixture, self.phase = argument, value, 'fixture'
        return result

    def setup_booking(self):
        require(self.phase == 'fixture', 'STAGING_NATIVE_QA_PHASE_INVALID')
        value = recipe('booking', self.providers, self.qa_environment)
        result = self.transaction(value, 'mutationSql', 'readbackSql')
        self.booking, self.phase = value, 'booking'
        return result

    def hold_last_position(self):
        require(self.phase == 'booking', 'STAGING_NATIVE_QA_PHASE_INVALID')
        self.idle()
        results = self.run(self.booking['holderSql'])
        require(results and results[0]['command'] == 'BEGIN' and results[-1]['rows'] == [['t']]
                and self.pq.PQtransactionStatus(self.connection) == TX_VALID,
                'STAGING_NATIVE_QA_HOLDER_UNVERIFIED')
        self.check_lock()
        self.phase = 'holding'
        return {'holder_ready': True}

    def count_blocked(self):
        require(self.phase == 'holding' and self.pq.PQtransactionStatus(self.connection) == TX_VALID,
                'STAGING_NATIVE_QA_PHASE_INVALID')
        self.check_lock()
        # check_lock reads pg_stat_activity inside the open holder transaction.
        # Its cached backend list can predate newly opened PostgREST connections.
        # Refresh only monitoring state; preserve the transaction and holder lock.
        self.run('SELECT pg_catalog.pg_stat_clear_snapshot();')
        self.check_lock()
        result = self.one_json(self.booking['blockingSql'])
        require(set(result) == {'blocked_contenders'} and type(result['blocked_contenders']) is int
                and 0 <= result['blocked_contenders'] <= 2, 'STAGING_NATIVE_QA_OVERLAP_UNVERIFIED')
        return result

    def release_holder(self):
        require(self.phase == 'holding', 'STAGING_NATIVE_QA_PHASE_INVALID')
        before = self.check_lock()
        self.committed(self.run('COMMIT;'), before)
        self.phase = 'booked'
        return {'holder_released': True}

    def booking_readback(self):
        require(self.phase in ('booking', 'booked'), 'STAGING_NATIVE_QA_PHASE_INVALID')
        self.idle()
        result = self.one_json(self.booking['readbackSql'])
        self.check_lock()
        return result

    def scoped_automation_proof(self):
        require(self.phase == 'booked' and self.providers is not None,
                'STAGING_NATIVE_QA_PHASE_INVALID')
        before = self.idle()
        value = recipe('automation', self.providers, self.qa_environment)
        require(set(value) == {'contextSql', 'parameters', 'guardSql', 'mutationSql',
                               'readbackSql', 'rollbackReadbackSql'}
                and all(type(value[key]) is str and 0 < len(value[key]) < 100000 and '\0' not in value[key]
                        for key in ('contextSql', 'guardSql', 'mutationSql', 'readbackSql', 'rollbackReadbackSql')),
                'STAGING_NATIVE_QA_RECIPE_INVALID')
        self.run("BEGIN READ WRITE; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s'; "
                 "SET LOCAL standard_conforming_strings=on; SET LOCAL search_path=pg_catalog; SET LOCAL row_security=on;")
        require(self.pq.PQtransactionStatus(self.connection) == TX_VALID,
                'STAGING_NATIVE_QA_PHASE_INVALID')
        configured = self.run_params(value['contextSql'], value['parameters'])
        require(len(configured) == 1 and configured[0]['rows'] == [['t']],
                'STAGING_NATIVE_QA_CONTEXT_UNVERIFIED')
        self.run(value['guardSql'])
        self.run(value['mutationSql'])
        result = self.one_json(value['readbackSql'])
        expected = {'scope': 'STAGING_PWA_SCOPED_AUTOMATION_QA_V1', 'matching_positive': True,
                    'source_and_preference_revalidated': True, 'wrong_lease_owner_refused': True,
                    'actual_synthetic_imports': 4, 'unchanged_import_deduplicated': True,
                    'source_change_preserves_booked_shift': True, 'incomplete_import_preserves_success': True,
                    'source_run_actor_bound': True, 'provider_called': False, 'global_scheduler_called': False}
        require(type(result) is dict and set(result) == set(expected)
                and all(type(result[key]) is type(item) and result[key] == item for key, item in expected.items()),
                'STAGING_NATIVE_QA_AUTOMATION_UNPROVED')
        ended = self.run('ROLLBACK;')
        require(ended and ended[-1]['command'] == 'ROLLBACK'
                and self.pq.PQtransactionStatus(self.connection) == TX_IDLE,
                'STAGING_NATIVE_QA_AUTOMATION_ROLLBACK_UNPROVED')
        after = self.check_lock()
        require(before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start'],
                'STAGING_PWA_NATIVE_QA_SESSION_CHANGED')
        require(self.one_json(value['rollbackReadbackSql']) == {'rollback_verified': True},
                'STAGING_NATIVE_QA_AUTOMATION_ROLLBACK_UNPROVED')
        return {**result, 'rollback_verified': True}

    def teardown(self, argument):
        require(self.phase in ('ready', 'fixture', 'booking', 'booked', 'torn_down'),
                'STAGING_NATIVE_QA_PHASE_INVALID')
        # A fresh cleanup session can retire only this run's source-bound QA
        # identities and audited scopes after its own full schema preflight.
        providers = self.providers if argument is None else argument
        require(providers is not None and (self.providers is None or providers == self.providers),
                'STAGING_NATIVE_QA_CLEANUP_SCOPE_INVALID')
        value = recipe('fixture', providers, self.qa_environment)
        result = self.transaction(value, 'teardownSql', 'teardownReadbackSql')
        self.phase = 'torn_down'
        return result


def main():
    session, sequence = None, 1
    try:
        require(len(sys.argv) == 1, 'STAGING_NATIVE_QA_CONTEXT_REQUIRED')
        trusted_context(os.environ)
        verify_sources()
        while True:
            raw = sys.stdin.buffer.readline(MAX_INPUT + 1)
            if not raw:
                break
            require(len(raw) <= MAX_INPUT and raw.endswith(b'\n'), 'STAGING_NATIVE_QA_REQUEST_BOUND_EXCEEDED')
            request = json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=duplicate_free)
            require(type(request) is dict and set(request) == {'id', 'operation', 'argument'}
                    and type(request['id']) is int and request['id'] == sequence,
                    'STAGING_NATIVE_QA_REQUEST_INVALID')
            sequence += 1
            operation, argument = request['operation'], request['argument']
            try:
                if operation == 'connect':
                    require(session is None and sequence == 2 and argument == {'lock_object': LOCK},
                            'STAGING_NATIVE_QA_CONNECT_INVALID')
                    session = NativeSession(dict(os.environ))
                    value = session.transport
                elif operation == 'close':
                    require(session is not None and argument is None, 'STAGING_NATIVE_QA_OPERATION_INVALID')
                    session.close()
                    value = {'closed': True}
                elif operation in ('setup_fixture', 'teardown'):
                    require(session is not None, 'STAGING_NATIVE_QA_OPERATION_INVALID')
                    value = getattr(session, operation)(argument)
                else:
                    require(session is not None and argument is None and operation in
                            ('preflight', 'setup_booking', 'hold_last_position', 'count_blocked',
                             'release_holder', 'booking_readback', 'scoped_automation_proof'), 'STAGING_NATIVE_QA_OPERATION_INVALID')
                    value = getattr(session, operation)()
                response = {'id': request['id'], 'ok': True, 'value': value}
            except Failure as error:
                response = {'id': request['id'], 'ok': False, 'code': error.code, 'sqlstate': error.sqlstate}
            encoded = (json.dumps(response, ensure_ascii=False, separators=(',', ':'))+'\n').encode()
            require(len(encoded) <= MAX_RESULT, 'STAGING_NATIVE_QA_RESPONSE_BOUND_EXCEEDED')
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
