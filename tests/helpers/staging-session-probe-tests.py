import importlib.util
from pathlib import Path
import unittest
import sys
from unittest.mock import patch

source=Path(__file__).resolve().parents[2]/'scripts/staging_backup_session.py'
spec=importlib.util.spec_from_file_location('identity_v5',source)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sys.path.insert(0,str(source.parent))
import staging_session_probe as probe


class FakePQ:
    def PQbackendPID(self, _):
        return 456


class FakeSession:
    instances = []
    events = []
    held = False
    failure = None

    def __init__(self, environment, lock_object):
        self.connection = None
        self.state = 'new'
        self.pq = FakePQ()
        self.transport = {'scope':'HOSTED_VERIFY_FULL','client_tls':True,
                          'client_tls_protocol':'TLSv1.3','postgres_version':170011,
                          'libpq_version':160015,'backend_identity_mode':'session_sql_backend_and_lock'}
        self.identity = {'backend_pid':123,'backend_start':'2026-10-07 10:00:00.123456+00',
                         'database':'postgres','primary':True}
        FakeSession.events.append(('connect',lock_object))
        if FakeSession.held:
            raise probe.Failure('EXCLUSIVE_SESSION_LOCK_BUSY')
        FakeSession.held = True
        self.connection = object()
        self.state = 'locked'
        FakeSession.instances.append(self)

    def check_lock(self):
        FakeSession.events.append(('lock',self.state))
        if FakeSession.failure == 'lock':
            raise probe.Failure('SESSION_OR_EXCLUSIVE_LOCK_CHANGED')
        return {'exclusive_lock':True}

    def begin_capture(self):
        self.state = 'capture'
        FakeSession.events.append(('capture',self.state))
        return {**self.identity,'exported_snapshot':'00000001-00000002-1',
                'visibility_snapshot':'1:2:'}

    def begin_fresh_read(self):
        self.state = 'fresh_read'
        value = {**self.identity,'visibility_snapshot':'2:3:'}
        if FakeSession.failure == 'fresh_identity':
            value['backend_pid'] = 999
        return value

    def capture_query(self, sql):
        FakeSession.events.append(('query',sql))
        if sql == probe.READ:
            if FakeSession.failure == 'read':
                return [{'command':'SELECT 1','rows':[['f']]}]
            if FakeSession.failure == 'private_exception':
                raise RuntimeError('synthetic-sensitive-provider-body')
            return [{'command':'SELECT 1','rows':[['t']]}]
        if FakeSession.failure == 'negative_accepted':
            return [{'command':'SELECT 1','rows':[['0']]}]
        self.close()
        sqlstate = '42601' if sql == probe.NEGATIVE_QUERIES[0][0] else '25006'
        if FakeSession.failure == 'negative_wrong_sqlstate':
            sqlstate = '42501'
        raise probe.Failure('DATABASE_QUERY_FAILED',sqlstate)

    def fresh_read_query(self, sql):
        return self.capture_query(sql)

    def end_capture(self):
        self.state = 'captured'
        return {'snapshot_transaction_ended':True,'exclusive_session_lock_retained':True}

    def end_fresh_read(self):
        self.state = 'fresh_read_complete'
        return {'fresh_read_transaction_ended':True,'exclusive_session_lock_retained':True}

    def close(self):
        FakeSession.events.append(('close',self.state))
        if FakeSession.failure == 'close':
            raise OSError('synthetic-sensitive-close-failure')
        self.connection = None
        self.state = 'closed'
        FakeSession.held = False


class ProbeContract(unittest.TestCase):
    def setUp(self):
        FakeSession.instances=[]
        FakeSession.events=[]
        FakeSession.held=False
        FakeSession.failure=None

    def run_probe(self):
        return probe.measure({},FakeSession)

    def test_all_fixed_checks_and_scoped_limits(self):
        report=self.run_probe()
        self.assertTrue(report['passed'])
        self.assertEqual(report['checks'],list(probe.CHECKS))
        self.assertTrue(report['returned_sessions_closed'])
        self.assertFalse(report['transport']['protocol_pid_matches_sql_backend'])
        for field in ('backup_created','restore_executed','snapshot_import_verified',
                      'catalog_data_compared','migration_ready','remote_ddl_ready','v1_ready','production_enabled'):
            self.assertIs(report[field],False)

    def test_private_identifiers_and_raw_messages_never_enter_report(self):
        import json
        report=self.run_probe()
        encoded=json.dumps(report)
        for text in ('123','456','2026-10-07','00000001-00000002-1','1:2:','synthetic-sensitive'):
            self.assertNotIn(text,encoded)

    def test_only_constant_key_and_fixed_queries_are_requested(self):
        self.run_probe()
        self.assertEqual({value for op,value in FakeSession.events if op=='connect'},{probe.LOCK_OBJECT})
        self.assertEqual([value for op,value in FakeSession.events if op=='query'],
                         [probe.READ,probe.READ,*[q for q,_,_ in probe.NEGATIVE_QUERIES]])
        self.assertIn('WHERE false',probe.NEGATIVE_QUERIES[1][0])

    def test_lock_change_fails_and_closes_every_returned_session(self):
        FakeSession.failure='lock'
        report=self.run_probe()
        self.assertFalse(report['passed'])
        self.assertEqual(report['error'],'SESSION_OR_EXCLUSIVE_LOCK_CHANGED')
        self.assertTrue(report['returned_sessions_closed'])
        self.assertFalse(FakeSession.held)

    def test_false_read_only_result_is_denied(self):
        FakeSession.failure='read'
        report=self.run_probe()
        self.assertFalse(report['passed'])
        self.assertEqual(report['error'],'PROBE_READ_UNVERIFIED')
        self.assertTrue(report['returned_sessions_closed'])

    def test_fresh_backend_change_is_denied(self):
        FakeSession.failure='fresh_identity'
        report=self.run_probe()
        self.assertFalse(report['passed'])
        self.assertEqual(report['error'],'PROBE_BACKEND_CHANGED')
        self.assertTrue(report['returned_sessions_closed'])

    def test_unexpected_provider_exception_is_sanitized(self):
        FakeSession.failure='private_exception'
        report=self.run_probe()
        self.assertEqual(report['error'],'TRANSPORT_PROBE_FAILED')
        self.assertNotIn('synthetic-sensitive',str(report))

    def test_successful_negative_query_never_passes(self):
        FakeSession.failure='negative_accepted'
        report=self.run_probe()
        self.assertFalse(report['passed'])
        self.assertEqual(report['error'],'PROBE_NEGATIVE_FAILURE_UNKNOWN')
        self.assertTrue(report['returned_sessions_closed'])

    def test_unexpected_sqlstate_never_counts_as_read_only_proof(self):
        FakeSession.failure='negative_wrong_sqlstate'
        report=self.run_probe()
        self.assertFalse(report['passed'])
        self.assertEqual(report['error'],'PROBE_NEGATIVE_FAILURE_UNKNOWN')
        self.assertNotIn(probe.CHECKS[11],report['checks'])

    def test_close_failure_is_visible_and_overrides_success(self):
        FakeSession.failure='close'
        report=self.run_probe()
        self.assertFalse(report['passed'])
        self.assertFalse(report['returned_sessions_closed'])
        self.assertEqual(report['error'],'PROBE_CONNECTION_CLOSE_UNPROVED')
        self.assertNotIn('synthetic-sensitive',str(report))

    def test_constructor_failure_does_not_invent_completed_checks(self):
        def unavailable(*_):
            raise probe.Failure('DATABASE_CONNECT_FAILED')
        report=probe.measure({},unavailable)
        self.assertFalse(report['passed'])
        self.assertEqual(report['checks'],[])
        self.assertEqual(report['error'],'DATABASE_CONNECT_FAILED')

    def test_python_entry_denies_wrong_context_or_arguments_without_connecting(self):
        with patch.dict(probe.os.environ,{},clear=True),patch.object(probe.sys,'argv',['probe.py']):
            self.assertEqual(probe.main(),1)
        with patch.dict(probe.os.environ,{'APP_ENV':'production'},clear=True),patch.object(probe.sys,'argv',['probe.py']):
            self.assertEqual(probe.main(),1)
        with patch.object(probe.sys,'argv',['probe.py','unexpected']):
            self.assertEqual(probe.main(),1)


class BackendIdentity(unittest.TestCase):
    def value(self):
        return {'backend_pid':123,'backend_start':'2026-10-07 10:00:00.123456+00',
                'database':'postgres','primary':True}

    def deny(self,value,wire,expected='BACKEND_IDENTITY_UNVERIFIED',**options):
        with self.assertRaises(module.Failure) as caught:
            module.verified_backend_identity(value,wire,**options)
        self.assertEqual(caught.exception.code,expected)

    def test_direct_same_pid(self):
        source=self.value()
        result=module.verified_backend_identity(source,123)
        self.assertEqual(result,source)
        self.assertIsNot(result,source)

    def test_direct_mismatch_is_still_denied(self):
        self.deny(self.value(),456,expected='BACKEND_PID_MISMATCH')

    def test_session_preserves_sql_backend_instead_of_proxy_cancel_pid(self):
        result=module.verified_backend_identity(self.value(),456,session_pooler=True)
        self.assertEqual(result['backend_pid'],123)
        self.assertEqual(result['backend_start'],self.value()['backend_start'])

    def test_session_equal_pid_is_valid_without_a_difference_requirement(self):
        self.assertEqual(module.verified_backend_identity(self.value(),123,session_pooler=True),self.value())

    def test_invalid_sql_pids(self):
        for pid in [None,False,True,0,-1,1.5,'123',2**31]:
            self.deny({**self.value(),'backend_pid':pid},456,
                      expected='BACKEND_SQL_PID_UNVERIFIED',session_pooler=True)

    def test_invalid_wire_pids(self):
        for pid in [None,False,True,0,1.5,'123',2**31,-(2**31)-1]:
            self.deny(self.value(),pid,expected='BACKEND_PROTOCOL_PID_UNVERIFIED',session_pooler=True)

    def test_session_signed_protocol_identifier_keeps_positive_sql_identity(self):
        for wire in [-1,-(2**31),2**31-1]:
            result=module.verified_backend_identity(self.value(),wire,session_pooler=True)
            self.assertEqual(result,self.value())
            self.deny(self.value(),wire,expected='BACKEND_PROTOCOL_PID_UNVERIFIED'
                      if wire<0 else 'BACKEND_PID_MISMATCH')

    def test_primary_and_database_never_become_optional(self):
        for change in [{'database':'other'},{'primary':False},{'primary':1}]:
            self.deny({**self.value(),**change},456,expected='BACKEND_DATABASE_UNVERIFIED'
                      if 'database' in change else 'BACKEND_PRIMARY_UNVERIFIED',session_pooler=True)

    def test_backend_start_must_be_valid_and_aware(self):
        for start in ['',None,'not-a-date','2026-10-07 10:00:00','2026-02-30 10:00:00+00','x'*129]:
            self.deny({**self.value(),'backend_start':start},456,
                      expected='BACKEND_START_UNVERIFIED',session_pooler=True)

    def test_foreign_fields_or_missing_identity_are_denied(self):
        self.deny({**self.value(),'actor':'synthetic'},456,session_pooler=True)
        self.deny({k:v for k,v in self.value().items() if k!='backend_start'},456,session_pooler=True)
        self.deny(None,456,session_pooler=True)

    def test_route_flag_is_not_coerced(self):
        for value in [None,1,'true']:
            self.deny(self.value(),456,session_pooler=value)

    def test_only_fixed_project_session_5432_route_is_eligible(self):
        project=module.PROJECT
        env={'PGHOST':'aws-0-eu-central-1.pooler.supabase.com','PGPORT':'5432',
             'PGUSER':'postgres.'+project,'PGPASSWORD':'synthetic-test-only',
             'PGDATABASE':'postgres','PGSSLMODE':'verify-full','PGSSLROOTCERT':'synthetic-ca'}
        settings=module.Session.connection_settings(env,False)
        self.assertEqual(settings['host'],env['PGHOST'])
        for change in [{'PGPORT':'6543'},{'PGUSER':'postgres.otherproject'},
                       {'PGSSLMODE':'disable'},{'PGHOST':'foreign.example.com'}]:
            with self.assertRaises(module.Failure):
                module.Session.connection_settings({**env,**change},False)

    def test_direct_target_remains_separate(self):
        env={'PGHOST':'db.'+module.PROJECT+'.supabase.co','PGPORT':'5432','PGUSER':'postgres',
             'PGPASSWORD':'synthetic-test-only','PGDATABASE':'postgres','PGSSLMODE':'verify-full',
             'PGSSLROOTCERT':'synthetic-ca'}
        settings=module.Session.connection_settings(env,False)
        self.assertFalse(settings['host'].endswith('.pooler.supabase.com'))

    def test_new_session_lock_accepts_only_absence(self):
        self.assertIsNone(module.verified_new_session_lock({'already_held':False}))

    def test_reentrant_existing_lock_is_denied(self):
        with self.assertRaises(module.Failure) as caught:
            module.verified_new_session_lock({'already_held':True})
        self.assertEqual(caught.exception.code,'SESSION_LOCK_ALREADY_HELD')

    def test_unknown_or_coerced_existing_lock_evidence_is_denied(self):
        for value in [None,{},[],{'already_held':0},{'already_held':None},
                      {'already_held':'false'},{'already_held':False,'backend_pid':123}]:
            with self.assertRaises(module.Failure):
                module.verified_new_session_lock(value)

    def constructor_lock_fixture(self, existing):
        from types import SimpleNamespace
        queries=[]
        finishes=[]
        pq=SimpleNamespace(PQconnectStartParams=lambda *_:1,PQsetNoticeReceiver=lambda *_:None,
            PQconnectPoll=lambda *_:3,PQstatus=lambda *_:0,PQsetnonblocking=lambda *_:0,
            PQtransactionStatus=lambda *_:module.TX_IDLE,PQserverVersion=lambda *_:170011,
            PQsslAttribute=lambda *_:b'TLSv1.3',PQsslInUse=lambda *_:1,PQlibVersion=lambda:160015,
            PQbackendPID=lambda *_:456,PQfinish=lambda *_:finishes.append(True))
        env={'PGHOST':'aws-0-eu-central-1.pooler.supabase.com','PGPORT':'5432',
             'PGUSER':'postgres.'+module.PROJECT,'PGPASSWORD':'synthetic-only',
             'PGDATABASE':'postgres','PGSSLMODE':'verify-full','PGSSLROOTCERT':'synthetic-ca'}
        def one_json(_session,sql):
            queries.append(sql)
            if 'already_held' in sql:
                self.assertIn('pid=pg_backend_pid()',sql)
                self.assertIn('objsubid=2',sql)
                self.assertNotIn('mode=',sql)
                return {'already_held':existing}
            if 'pg_try_advisory_lock' in sql:
                return {'acquired':True}
            return self.value()
        return pq,env,queries,finishes,one_json

    def test_constructor_denies_reentrant_lock_before_acquisition_and_finishes(self):
        pq,env,queries,finishes,query=self.constructor_lock_fixture(True)
        with patch.object(module,'bindings_library',return_value=(pq,lambda f:f)),\
             patch.object(module.Session,'one_json',query),\
             patch.object(module.Session,'check_lock',side_effect=AssertionError('must not reach guard')):
            with self.assertRaises(module.Failure) as caught:
                module.Session(env,123)
        self.assertEqual(caught.exception.code,'SESSION_LOCK_ALREADY_HELD')
        self.assertFalse(any('pg_try_advisory_lock' in sql for sql in queries))
        self.assertEqual(finishes,[True])

    def test_constructor_checks_absence_before_actual_acquisition_request(self):
        pq,env,queries,finishes,query=self.constructor_lock_fixture(False)
        with patch.object(module,'bindings_library',return_value=(pq,lambda f:f)),\
             patch.object(module.Session,'one_json',query),\
             patch.object(module.Session,'check_lock',return_value={'exclusive_lock':True}):
            session=module.Session(env,123)
            self.assertEqual(session.state,'locked')
            session.close()
        self.assertEqual(len(queries),3)
        self.assertIn('already_held',queries[1])
        self.assertIn('pg_try_advisory_lock',queries[2])
        self.assertEqual(finishes,[True])

    def test_constructor_with_signed_protocol_identifier_still_requires_backend_lock(self):
        pq,env,queries,finishes,query=self.constructor_lock_fixture(False)
        pq.PQbackendPID=lambda *_:-(2**31)
        with patch.object(module,'bindings_library',return_value=(pq,lambda f:f)),\
             patch.object(module.Session,'one_json',query),\
             patch.object(module.Session,'check_lock',side_effect=module.Failure('SESSION_OR_EXCLUSIVE_LOCK_CHANGED')):
            with self.assertRaises(module.Failure) as caught:
                module.Session(env,123)
        self.assertEqual(caught.exception.code,'SESSION_OR_EXCLUSIVE_LOCK_CHANGED')
        self.assertEqual(len(queries),3)
        self.assertEqual(finishes,[True])


if __name__=='__main__':
    unittest.main()
