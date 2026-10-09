import importlib.util
import io
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'scripts/staging_pwa_upgrade_session.py'
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('pwa_upgrade_protocol', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
environment = {'APP_ENV': 'staging', 'GITHUB_REPOSITORY': 'cluvonl/platform', 'GITHUB_REF': 'refs/heads/staging',
               'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_SHA': 'a'*40, 'RELEASE_SHA': 'a'*40,
               'GITHUB_RUN_ID': '123', 'GITHUB_ACTOR': 'upgrade-test',
               'PWA_UPGRADE_NODE_EXECUTABLE': os.environ['PWA_UPGRADE_TEST_NODE']}
identity = {'backend_pid': 321, 'backend_start': '2026-10-09 12:30:01.123456+00'}
argument = {'index': 16, 'actor': 'upgrade-test', 'workflow_run_id': '123', 'source_sha': 'a'*40,
            'manifest_sha256': 'b'*64, 'backup_artifact_id': '456', 'backup_artifact_sha256': 'c'*64}


class UpgradeOperations(unittest.TestCase):
    def fake(self, phase='initial_ready'):
        session = module.PwaUpgradeSession.__new__(module.PwaUpgradeSession)
        session.state, session.identity = phase, dict(identity)
        session.upgrade_environment, session.connection = dict(environment), object()
        session.pq = SimpleNamespace(PQtransactionStatus=lambda unused: module.TX_IDLE)
        session.check_lock = lambda: {**identity, 'exclusive_lock': True}
        return session

    def test_deparse_read_is_fixed_snapshot_only_and_does_not_mutate(self):
        for phase in ('locked', 'captured', 'fresh_read', 'fresh_read_complete', 'initial_ready', 'closed'):
            with self.assertRaises(module.Failure):
                self.fake(phase).read_deparse_context()
        session, queries = self.fake('capture'), []
        session.pq = SimpleNamespace(PQtransactionStatus=lambda unused: module.bounded.TX_VALID)
        session.check_lock = lambda: {**identity, 'exclusive_lock': True, 'read_only': True, 'isolation': 'repeatable read'}
        value = {'server_version_num': 170011, 'time_zone': 'UTC', 'date_style': 'ISO, MDY',
                 'interval_style': 'postgres', 'search_path': 'pg_catalog', 'extra_float_digits': 1,
                 'standard_conforming_strings': True, 'quote_all_identifiers': False,
                 'bytea_output': 'hex', 'client_encoding': 'UTF8'}
        session.one_json = lambda query: queries.append(query) or dict(value)
        self.assertEqual(session.read_deparse_context(), value)
        self.assertEqual(queries, [module.DEPARSE_CONTEXT_SQL])
        self.assertEqual(session.state, 'capture')
        self.assertNotIn('SET ', queries[0])
        self.assertNotIn('SHOW ', queries[0])
        session.one_json = lambda unused: {**value, 'private_setting': 'synthetic-secret'}
        with self.assertRaises(module.Failure):
            session.read_deparse_context()
        session.one_json = lambda unused: {**value, 'search_path': 'invalid\nprivate'}
        with self.assertRaises(module.Failure):
            session.read_deparse_context()

    def test_deparse_read_refuses_lost_snapshot_or_changed_backend(self):
        session = self.fake('capture')
        session.pq = SimpleNamespace(PQtransactionStatus=lambda unused: module.bounded.TX_VALID)
        session.check_lock = lambda: {**identity, 'read_only': False, 'isolation': 'repeatable read'}
        session.one_json = lambda unused: self.fail('read must not start outside read-only snapshot')
        with self.assertRaises(module.Failure):
            session.read_deparse_context()
        checks = iter([{**identity, 'read_only': True, 'isolation': 'repeatable read'},
                       {**identity, 'backend_pid': 322, 'read_only': True, 'isolation': 'repeatable read'}])
        session.check_lock = lambda: next(checks)
        session.one_json = lambda unused: {}
        with self.assertRaises(module.Failure) as failure:
            session.read_deparse_context()
        self.assertEqual(failure.exception.code, 'PWA_DEPARSE_CONTEXT_SESSION_CHANGED')

    def test_source_pins_and_generator_environment_are_closed(self):
        module.verify_sources()
        def invoke(command, **options):
            self.assertEqual(options['env'], {'PATH': '/usr/bin:/bin'})
            self.assertEqual(command[-1], '--private-fixed-pwa-upgrade-sql')
            request = json.loads(options['input'])
            self.assertNotIn('sql', request)
            self.assertEqual(request['expectedBackendPid'], identity['backend_pid'])
            return SimpleNamespace(returncode=0, stderr=b'', stdout=b'fixed-synthetic-result')
        with patch.object(module.subprocess, 'run', invoke):
            self.assertEqual(module.fixed_sql(argument, identity, {**environment, 'PGPASSWORD': 'synthetic-private'}), 'fixed-synthetic-result')
        for changed in ({**argument, 'sql': 'DELETE FROM auth.users'}, {**argument, 'index': True},
                        {**argument, 'index': 0}, {**argument, 'actor': 'other'}, {**argument, 'source_sha': 'd'*40}):
            with self.assertRaises(module.Failure):
                module.fixed_sql(changed, identity, environment)

    def test_apply_requires_completed_read_and_confirmed_commit_and_restores_budgets(self):
        previous = module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT
        for phase in ('locked', 'capture', 'captured', 'fresh_read', 'fresh_read_complete', 'closed'):
            with self.assertRaises(module.Failure):
                self.fake(phase).apply_upgrade(argument)
        session, observed = self.fake(), []
        def run(sql):
            observed.append((module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT, sql))
            return [{'command': 'BEGIN'}, {'command': 'COMMIT'}]
        session.run = run
        with patch.object(module, 'fixed_sql', lambda *unused: 'fixed-synthetic-sql'):
            receipt = session.apply_upgrade(argument)
        self.assertEqual(observed, [(1024, 240.0, 'fixed-synthetic-sql')])
        self.assertEqual(receipt['applied_prefix'], 17)
        self.assertEqual((module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT), previous)
        session.run = lambda unused: [{'command': 'BEGIN'}, {'command': 'ROLLBACK'}]
        with patch.object(module, 'fixed_sql', lambda *unused: 'fixed-synthetic-sql'), self.assertRaises(module.Failure):
            session.apply_upgrade(argument)

    def test_database_failure_restores_budgets_and_does_not_claim_commit(self):
        session, previous = self.fake(), (module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT)
        def failure(unused):
            raise module.Failure('DATABASE_QUERY_FAILED', '42501')
        session.run = failure
        with patch.object(module, 'fixed_sql', lambda *unused: 'fixed-synthetic-sql'), self.assertRaises(module.Failure):
            session.apply_upgrade(argument)
        self.assertEqual((module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT), previous)

    def test_readback_parses_actual_list_results_and_refuses_wrong_shape(self):
        session = self.fake('fresh_read_complete')
        def one(sql):
            return {'schemas': ['api', 'app', 'internal'], 'app_objects': 500, 'history_present': True,
                    'source_history_present': True, 'upgrade_history_present': False} if "'history_present'" in sql else {'app_tables': 144}
        session.one_json = one
        session.run = lambda sql, **unused: [{'command': 'SELECT 1', 'rows': [[json.dumps([{'synthetic': True}])]]}]
        result = session.read_upgrade_state()
        self.assertEqual(result['historyRows'], [{'synthetic': True}])
        self.assertEqual(result['upgradeRows'], [])
        self.assertEqual(session.state, 'initial_ready')
        session.run = lambda sql, **unused: [{'command': 'SELECT 1', 'rows': [['{}']]}]
        with self.assertRaises(module.Failure):
            session.read_upgrade_state()

    def test_backend_change_after_commit_cannot_claim_lock_retention(self):
        session = self.fake()
        checks = iter([{**identity, 'exclusive_lock': True}, {**identity, 'exclusive_lock': True},
                       {**identity, 'backend_pid': 322, 'exclusive_lock': True}])
        session.check_lock = lambda: next(checks)
        session.run = lambda unused: [{'command': 'BEGIN'}, {'command': 'COMMIT'}]
        with patch.object(module, 'fixed_sql', lambda *unused: 'fixed-synthetic-sql'), self.assertRaises(module.Failure):
            session.apply_upgrade(argument)

    def test_protocol_denies_original16_writer_and_arbitrary_write_operations(self):
        class Fake:
            def __init__(self, *unused):
                self.transport = {'synthetic': True}
            def close(self):
                pass
        for operation in ('apply_initial', 'configure_api', 'bootstrap_core', 'execute_sql', 'read_deparse_context'):
            request = {'id': 1, 'operation': 'connect', 'argument': {'lock_object': module.LOCK_OBJECT}}
            unsafe = {'id': 2, 'operation': operation, 'argument': {'sql': 'DELETE FROM auth.users'}}
            stdin, stdout = io.BytesIO((json.dumps(request)+'\n'+json.dumps(unsafe)+'\n').encode()), io.BytesIO()
            with patch.dict(os.environ, environment, clear=True), patch.object(module, 'PwaUpgradeSession', Fake), \
                 patch.object(sys, 'stdin', SimpleNamespace(buffer=stdin)), patch.object(sys, 'stdout', SimpleNamespace(buffer=stdout)):
                self.assertEqual(module.main(), 0)
            response = json.loads(stdout.getvalue().decode().splitlines()[1])
            self.assertEqual(response['ok'], False)
            self.assertEqual(response['code'], 'PWA_UPGRADE_OPERATION_INVALID')
            self.assertNotIn('DELETE', stdout.getvalue().decode())


if __name__ == '__main__':
    unittest.main()
