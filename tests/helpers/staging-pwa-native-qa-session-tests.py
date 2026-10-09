import importlib.util
import io
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'scripts/staging_pwa_native_qa_session.py'
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('pwa_native_owner', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
environment = {'APP_ENV': 'staging', 'GITHUB_REPOSITORY': 'cluvonl/platform', 'GITHUB_REF': 'refs/heads/staging',
               'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_SHA': 'a'*40, 'RELEASE_SHA': 'a'*40,
               'GITHUB_RUN_ID': '123', 'GITHUB_ACTOR': 'pwa-qa-test',
               'PWA_NATIVE_QA_NODE_EXECUTABLE': os.environ['PWA_NATIVE_QA_TEST_NODE']}
identity = {'backend_pid': 321, 'backend_start': '2026-10-09 12:30:01.123456+00'}


class NativeOwnerOperations(unittest.TestCase):
    def fake(self, phase='connected'):
        owner = module.NativeSession.__new__(module.NativeSession)
        owner.qa_environment, owner.connection = dict(environment), object()
        owner.phase, owner.providers, owner.fixture, owner.booking = phase, None, None, None
        owner.pq = SimpleNamespace(PQtransactionStatus=lambda unused: module.TX_IDLE)
        owner.check_lock = lambda: {**identity, 'exclusive_lock': True}
        return owner

    def test_source_pin_closes_all_recipes_and_generator_receives_no_credentials(self):
        module.verify_sources()
        def invoke(command, **options):
            self.assertEqual(options['env'], {'PATH': '/usr/bin:/bin'})
            self.assertEqual(command[-1], '--private-fixed-native-qa-sql')
            request = json.loads(options['input'])
            self.assertEqual(set(request), {'operation', 'providers', 'sourceSha', 'workflowRunId', 'actor'})
            self.assertNotIn('PGPASSWORD', options['env'])
            return SimpleNamespace(returncode=0, stderr=b'', stdout=b'{"preflightSql":"fixed","migrationCount":21}')
        with patch.object(module.subprocess, 'run', invoke):
            self.assertEqual(module.recipe('preflight', None, {**environment, 'PGPASSWORD': 'synthetic-private'}), {'preflightSql': 'fixed','migrationCount':21})

    def test_preflight_requires_closed_full_history_dynamic_native_table_count_and_commit(self):
        valid = {'scope': 'STAGING_PWA_NATIVE_QA_PREFLIGHT_V1', 'migration_count': 21, 'native_guarded_tables': 170,
                 'api_only': True, 'command_owner_restricted': True, 'auth_mutations': False,
                 'v1_ready': False, 'production_enabled': False}
        for change in ({}, {'migration_count': 16}, {'native_guarded_tables': 143}, {'native_guarded_tables': True},
                       {'api_only': False}, {'extra': 'private'}):
            owner = self.fake()
            owner.run = lambda unused: [{'command': 'BEGIN'}, {'command': 'SELECT 1', 'rows': [[json.dumps({**valid, **change})]]}, {'command': 'COMMIT'}]
            with patch.object(module, 'recipe', lambda *unused: {'preflightSql': 'fixed','migrationCount':21}):
                if change:
                    with self.assertRaises(module.Failure):
                        owner.preflight()
                else:
                    self.assertEqual(owner.preflight(), valid)
                    self.assertEqual(owner.phase, 'ready')
        owner = self.fake()
        owner.run = lambda unused: [{'command': 'ROLLBACK'}]
        with patch.object(module, 'recipe', lambda *unused: {'preflightSql': 'fixed','migrationCount':21}), self.assertRaises(module.Failure):
            owner.preflight()

    def test_committed_write_requires_same_backend_and_idle_transaction(self):
        owner = self.fake()
        owner.committed([{'command': 'COMMIT'}], identity)
        for results in ([], [{'command': 'ROLLBACK'}]):
            with self.assertRaises(module.Failure):
                owner.committed(results, identity)
        owner.check_lock = lambda: {**identity, 'backend_pid': 322}
        with self.assertRaises(module.Failure):
            owner.committed([{'command': 'COMMIT'}], identity)

    def test_scoped_automation_requires_ended_rollback_same_backend_and_absence_readback(self):
        expected = {'scope': 'STAGING_PWA_SCOPED_AUTOMATION_QA_V1', 'matching_positive': True,
                    'source_and_preference_revalidated': True, 'wrong_lease_owner_refused': True,
                    'actual_synthetic_imports': 4, 'unchanged_import_deduplicated': True,
                    'source_change_preserves_booked_shift': True, 'incomplete_import_preserves_success': True,
                    'source_run_actor_bound': True, 'provider_called': False, 'global_scheduler_called': False}
        value = {'contextSql': 'context', 'parameters': ['bound']*4, 'guardSql': 'guard',
                 'mutationSql': 'mutation', 'readbackSql': 'proof', 'rollbackReadbackSql': 'absence'}
        for change in ({}, {'provider_called': True}, {'actual_synthetic_imports': True},
                       {'rollback_verified': False}, {'end': 'COMMIT'}, {'backend_pid': 322}):
            owner = self.fake('booked')
            owner.providers = []
            state = [module.TX_IDLE]
            owner.pq.PQtransactionStatus = lambda unused: state[0]
            calls = []
            def run(sql):
                calls.append(sql)
                if sql.startswith('BEGIN'):
                    state[0] = module.TX_VALID
                if sql == 'ROLLBACK;':
                    state[0] = module.TX_IDLE
                    return [{'command': change.get('end', 'ROLLBACK')}]
                return []
            owner.run = run
            owner.run_params = lambda sql, parameters: [{'rows': [['t']]}]
            owner.one_json = lambda sql: ({'rollback_verified': change.get('rollback_verified', True)}
                                         if sql == 'absence' else {**expected, **{k: v for k, v in change.items() if k in expected}})
            before = owner.check_lock
            owner.check_lock = lambda: {**before(), **({'backend_pid': 322} if 'backend_pid' in change and 'ROLLBACK;' in calls else {})}
            with patch.object(module, 'recipe', lambda *unused: value):
                if change:
                    with self.assertRaises(module.Failure):
                        owner.scoped_automation_proof()
                else:
                    self.assertEqual(owner.scoped_automation_proof(), {**expected, 'rollback_verified': True})
                    self.assertEqual(calls[-1], 'ROLLBACK;')
                    self.assertFalse(any(sql == 'COMMIT;' for sql in calls))
                    self.assertEqual(owner.phase, 'booked')
        for phase in ('ready', 'fixture', 'booking', 'holding', 'torn_down'):
            with self.assertRaises(module.Failure):
                self.fake(phase).scoped_automation_proof()

    def test_closed_protocol_never_accepts_sql_or_original_writer_operations(self):
        class Fake:
            def __init__(self, *unused):
                self.transport = {'synthetic': True}
            def close(self):
                pass
        for operation in ('apply_initial', 'apply_upgrade', 'configure_api', 'execute_sql'):
            connect = {'id': 1, 'operation': 'connect', 'argument': {'lock_object': module.LOCK}}
            unsafe = {'id': 2, 'operation': operation, 'argument': {'sql': 'DELETE FROM auth.users'}}
            stdin, stdout = io.BytesIO((json.dumps(connect)+'\n'+json.dumps(unsafe)+'\n').encode()), io.BytesIO()
            with patch.dict(os.environ, environment, clear=True), patch.object(module, 'NativeSession', Fake), \
                 patch.object(sys, 'stdin', SimpleNamespace(buffer=stdin)), patch.object(sys, 'stdout', SimpleNamespace(buffer=stdout)), \
                 patch.object(sys, 'argv', [str(source)]):
                self.assertEqual(module.main(), 0)
            value = json.loads(stdout.getvalue().decode().splitlines()[1])
            self.assertEqual(value['ok'], False)
            self.assertEqual(value['code'], 'STAGING_NATIVE_QA_OPERATION_INVALID')
            self.assertNotIn('DELETE', stdout.getvalue().decode())


if __name__ == '__main__':
    unittest.main()
