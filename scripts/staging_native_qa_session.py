#!/usr/bin/env python3
"""Fixed private QA owner. Provider Auth mutations occur only through its API."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

import staging_backup_session as bounded
from staging_backup_session import Failure, require, MAX_INPUT, MAX_RESULT, TX_IDLE, TX_VALID
from staging_initial_session import InitialSession, trusted_context, duplicate_free

ROOT = Path(__file__).resolve().parent
PROJECT = 'fbozlbgmktkgcdfqdaaz'
LOCK = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
# Completed source bytes are pinned before this owner is promoted.
PINS = {
    'staging_backup_session.py': 'e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1',
    'staging_initial_session.py': '9d28ad55bdd22dc6f81a7e00a3324a31a3e1842d50c778b8f5daa916614d52d9',
    'staging-initial-migrations.mjs': '7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004',
    'staging-migration-files.mjs': '83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd',
    'staging-native-qa-fixture.mjs': '30c6982d2f37a7a34fd1126df7f3ae6c376732c59f0138caa072c8c3100b9c26',
    'staging-native-qa-booking.mjs': '12e27d2d78b9d089bc804ed3b8f92a9eb65b27fadf282bbc76b589f83a588a0b',
    'staging-native-qa-sql.mjs': '2cf073b1e7493850143eba496845a8e8484fcd4e50b7fa3da41dbda6687aacac',
}


def verify_sources():
    require(len(PINS) == 7, 'STAGING_NATIVE_QA_SOURCE_UNPINNED')
    for name, expected in PINS.items():
        path = ROOT / name
        require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 100000
                and hashlib.sha256(path.read_bytes()).hexdigest() == expected,
                'STAGING_NATIVE_QA_SOURCE_CHANGED')


def recipe(operation, providers, environment):
    verify_sources()
    node = environment.get('INITIAL_NODE_EXECUTABLE', '')
    require(os.path.isabs(node) and Path(node).name == 'node' and len(node) <= 4096,
            'STAGING_NATIVE_QA_GENERATOR_UNAVAILABLE')
    info = os.lstat(node)
    require(stat.S_ISREG(info.st_mode) and os.access(node, os.X_OK),
            'STAGING_NATIVE_QA_GENERATOR_UNAVAILABLE')
    request = {'operation': operation, 'providers': providers,
               'sourceSha': environment['RELEASE_SHA'], 'workflowRunId': environment['GITHUB_RUN_ID'],
               'actor': environment['GITHUB_ACTOR']}
    result = subprocess.run([node, str(ROOT / 'staging-native-qa-sql.mjs'), '--private-fixed-native-qa-sql'],
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


class NativeSession(InitialSession):
    def __init__(self, environment):
        self.qa_environment = dict(environment)
        self.providers, self.fixture, self.booking = None, None, None
        self.phase = 'connected'
        super().__init__(environment, LOCK)

    def idle(self):
        require(self.connection is not None and self.pq.PQtransactionStatus(self.connection) == TX_IDLE,
                'STAGING_NATIVE_QA_PHASE_INVALID')
        return self.check_lock()

    def preflight(self):
        before = self.idle()
        require(self.phase in ('connected', 'ready'), 'STAGING_NATIVE_QA_PHASE_INVALID')
        value = recipe('preflight', None, self.qa_environment)
        require(set(value) == {'preflightSql'} and type(value['preflightSql']) is str,
                'STAGING_NATIVE_QA_RECIPE_INVALID')
        results = self.run(value['preflightSql'])
        self.committed(results, before)
        readback = scalar_json(results)
        require(readback == {'scope': 'STAGING_NATIVE_QA_PREFLIGHT_V1', 'migration_count': 16,
                            'native_guarded_tables': 144, 'api_only': True, 'command_owner_restricted': True,
                            'auth_mutations': False, 'v1_ready': False, 'production_enabled': False},
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
                             'release_holder', 'booking_readback'), 'STAGING_NATIVE_QA_OPERATION_INVALID')
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
