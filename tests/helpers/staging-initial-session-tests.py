import importlib.util
import io
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'scripts/staging_initial_session.py'
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('initial_protocol', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
environment = {'APP_ENV':'staging','GITHUB_REPOSITORY':'cluvonl/platform','GITHUB_REF':'refs/heads/staging',
               'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_SHA':'a'*40,'RELEASE_SHA':'a'*40,
               'GITHUB_RUN_ID':'123','GITHUB_ACTOR':'contract-test',
               'INITIAL_NODE_EXECUTABLE':os.environ['INITIAL_TEST_NODE']}
recipient = 'bootstrap-contract@example.test'
identity = {'backend_pid':321,'backend_start':'2026-10-08 12:30:01.123456+00'}
argument = {'index':0,'actor':'contract-test','workflow_run_id':'123','source_sha':'a'*40}
fixed_argument = {key:value for key,value in argument.items() if key != 'index'}
entries = json.JSONDecoder().raw_decode((source.parent/'staging-migration-files.mjs').read_text().split('Object.freeze(',1)[1])[0]
complete_state = {'layout':{'schemas':['api','app','internal'],'app_objects':500,'history_present':True,'source_history_present':True},
  'historyRows':[{'version':entry['file'][:14],'name':entry['file'][15:-4],'statement_count':1,'single_statement_sha256':entry['sha256']} for entry in entries],
  'sourceRows':[{'version':entry['file'][:14],'file':entry['file'],'sha256':entry['sha256'],'source_sha':'a'*40,
    'actor':'contract-test','scope':'staging','expected_version':index,'workflow_run_id':'123',
    'idempotency_key':'cluvo-staging-initial16:123:'+entry['file'][:14]} for index,entry in enumerate(entries)]}
bootstrap_readback = {'scope':'STAGING_SYNTHETIC_CORE_V1','status':'created','fixture_version':1,
  **{key:1 for key in ('tenants','member_grants','households','intake_profiles','seasons','obligations','bootstrap_audits','bootstrap_commands')},
  'current_ledger_entries':0,**{key:False for key in ('auth_mutations','mail_sent','native_session_proven','v1_ready','production_enabled')}}


class InitialOperations(unittest.TestCase):
    def fake(self):
        session = module.InitialSession.__new__(module.InitialSession)
        session.state, session.initial_next = 'fresh_read_complete', None
        session.identity, session.initial_environment = dict(identity), dict(environment)
        session.connection = object()
        session.pq = SimpleNamespace(PQtransactionStatus=lambda unused: module.TX_IDLE)
        session.check_lock = lambda: {**identity,'exclusive_lock':True}
        return session

    def test_sources_and_real_fixed_generator_have_no_caller_sql_route(self):
        module.verify_sources()
        sql = module.fixed_sql(argument,identity,environment)
        self.assertTrue(sql.startswith('BEGIN READ WRITE;'))
        self.assertTrue(sql.endswith('COMMIT;\n'))
        self.assertIn('pg_backend_pid()<>321',sql)
        self.assertIn('20261002163042_cluvo_wp1_wp2_core.sql',sql)
        for changed in ({**argument,'sql':'DELETE FROM auth.users'}, {**argument,'index':True},
                        {**argument,'index':16},{**argument,'actor':'other'},
                        {**argument,'source_sha':'b'*40},{**argument,'workflow_run_id':'124'}):
            with self.assertRaises(module.Failure): module.fixed_sql(changed,identity,environment)

    def test_generator_receives_no_database_password_or_extra_environment(self):
        def invoke(command,**options):
            self.assertEqual(options['env'],{'PATH':'/usr/bin:/bin'})
            self.assertEqual(command[-1],'--private-fixed-initial-sql')
            self.assertNotIn('PGPASSWORD',options['env'])
            self.assertNotIn('sql',json.loads(options['input']))
            return SimpleNamespace(returncode=0,stderr=b'',stdout=b'fixed-synthetic-result')
        with patch.object(module.subprocess,'run',invoke):
            self.assertEqual(module.fixed_sql(argument,identity,{**environment,'PGPASSWORD':'synthetic-private'}),'fixed-synthetic-result')

    def test_apply_only_after_fresh_read_retains_backend_and_restores_read_budgets(self):
        session=self.fake()
        calls=[]
        def run(sql):
            calls.append((module.bounded.MAX_COMMANDS,module.bounded.TIMEOUT,sql))
            return [{'command':'BEGIN'},{'command':'COMMIT'}]
        session.run=run
        old=(module.bounded.MAX_COMMANDS,module.bounded.TIMEOUT)
        result=session.apply_initial(argument)
        self.assertEqual(result['applied_prefix'],1)
        self.assertEqual(calls[0][:2],(400,240.0))
        self.assertEqual((module.bounded.MAX_COMMANDS,module.bounded.TIMEOUT),old)
        self.assertEqual(session.state,'initial_ready')
        with self.assertRaises(module.Failure):session.apply_initial({**argument,'index':2})
        self.assertEqual(len(calls),1)

    def test_read_phase_and_unconfirmed_commit_cannot_advance_state(self):
        for phase in ('locked','capture','captured','fresh_read','closed'):
            session=self.fake();session.state=phase
            with self.assertRaises(module.Failure):session.apply_initial(argument)
        session=self.fake();session.run=lambda sql:[{'command':'BEGIN'},{'command':'ROLLBACK'}]
        with self.assertRaises(module.Failure):session.apply_initial(argument)
        self.assertIsNone(session.initial_next)

    def test_failed_execution_restores_budgets_and_does_not_run_another_migration(self):
        session=self.fake()
        old=(module.bounded.MAX_COMMANDS,module.bounded.TIMEOUT)
        def run(sql):raise module.Failure('DATABASE_QUERY_FAILED','42501')
        session.run=run
        with self.assertRaises(module.Failure):session.apply_initial(argument)
        self.assertEqual((module.bounded.MAX_COMMANDS,module.bounded.TIMEOUT),old)
        self.assertIsNone(session.initial_next)

    def test_fixed_readback_handles_absent_tables_without_caller_queries(self):
        session=self.fake()
        session.one_json=lambda sql:{'schemas':[],'app_objects':0,'history_present':False,'source_history_present':False}
        session.run=lambda *unused,**kwargs:self.fail('absent history tables must not be queried')
        result=session.read_initial_state()
        self.assertEqual(result['historyRows'],[])
        self.assertEqual(result['sourceRows'],[])

    def test_fixed_post_migration_generator_requires_original16_and_keeps_recipient_in_parameters(self):
        bootstrap=json.loads(module.fixed_output('bootstrap_core',fixed_argument,identity,
                            {**environment,'STAGING_TEST_RECIPIENT':recipient},complete_state))
        self.assertEqual(bootstrap['parameters'],[recipient,'a'*40,'123','contract-test'])
        self.assertIn('$1::text',bootstrap['contextSql'])
        self.assertNotIn(recipient,bootstrap['contextSql']+bootstrap['mutationSql']+bootstrap['readbackSql']+bootstrap['guardSql'])
        self.assertIn('pg_backend_pid()<>321',bootstrap['guardSql'])
        for entry in entries:self.assertIn(entry['sha256'],bootstrap['guardSql'])
        sql=module.fixed_output('configure_api',fixed_argument,identity,environment,complete_state)
        self.assertLess(sql.index('INITIAL_SESSION_OR_LOCK_CHANGED'),sql.index('ALTER ROLE authenticator'))
        changed={**complete_state,'historyRows':[{**complete_state['historyRows'][0],'single_statement_sha256':'b'*64},*complete_state['historyRows'][1:]]}
        for operation in ('configure_api','bootstrap_core'):
            with self.assertRaises(module.Failure):module.fixed_output(operation,fixed_argument,identity,
                    {**environment,'STAGING_TEST_RECIPIENT':recipient},changed)
        with self.assertRaises(module.Failure):module.fixed_output('bootstrap_core',fixed_argument,identity,environment,complete_state)

    def test_libpq_bootstrap_binding_uses_four_text_parameters_and_drains_results(self):
        session=self.fake();sent=[];cleared=[]
        buffer=module.C.create_string_buffer(b't')
        result_ids=iter((1,2,None))
        def send(connection,sql,count,types,values,lengths,formats,result_format):
            sent.append((sql,count,types,[values[index] for index in range(count)],
                         [lengths[index] for index in range(count)],[formats[index] for index in range(count)],result_format))
            return 1
        session.pq=SimpleNamespace(PQstatus=lambda connection:0,PQsendQueryParams=send,
          PQsendQuery=lambda *unused:self.fail('parameter context must use the extended protocol'),
          PQsetSingleRowMode=lambda connection:1,PQflush=lambda connection:0,PQisBusy=lambda connection:0,
          PQgetResult=lambda connection:next(result_ids),PQresultStatus=lambda result:9 if result==1 else 2,
          PQnfields=lambda result:1,PQntuples=lambda result:1 if result==1 else 0,
          PQgetisnull=lambda *unused:0,PQgetlength=lambda *unused:1,
          PQgetvalue=lambda *unused:module.C.addressof(buffer),PQcmdStatus=lambda result:b'SELECT 1',
          PQclear=lambda result:cleared.append(result),PQfinish=lambda connection:None)
        result=session.run_params('SELECT $1::text IS NOT NULL;', [recipient,'a'*40,'123','contract-test'])
        self.assertEqual(result,[{'command':'SELECT 1','rows':[['t']]}])
        self.assertEqual(cleared,[1,2])
        self.assertEqual(sent[0][1:],(4,None,[recipient.encode(),b'a'*40,b'123',b'contract-test'],
            [len(recipient),40,3,13],[0,0,0,0],0))
        self.assertNotIn(recipient.encode(),sent[0][0])
        with self.assertRaises(module.Failure):session.run_params('SELECT $1', [recipient])

    def test_bound_context_failure_closes_connection_without_private_error(self):
        session=self.fake();closed=[]
        session.pq=SimpleNamespace(PQstatus=lambda connection:0,PQsendQueryParams=lambda *unused:0)
        session.close=lambda:closed.append(True)
        with self.assertRaises(module.Failure) as failure:
            session.run_params('SELECT $1::text', [recipient,'a'*40,'123','contract-test'])
        self.assertEqual(failure.exception.code,'DATABASE_SEND_FAILED')
        self.assertEqual(closed,[True])

    def bootstrap_fake(self):
        session=self.fake();session.state='initial_ready'
        session.initial_environment['STAGING_TEST_RECIPIENT']=recipient
        session.read_initial_state=lambda:complete_state
        phase={'value':module.TX_IDLE};calls=[]
        session.pq=SimpleNamespace(PQtransactionStatus=lambda unused:phase['value'])
        def run(sql):
            if sql.startswith('BEGIN'):phase['value']=module.bounded.TX_VALID;calls.append('begin');return [{'command':'BEGIN'}]
            if sql=='COMMIT;':phase['value']=module.TX_IDLE;calls.append('commit');return [{'command':'COMMIT'}]
            calls.append('guard' if 'cluvo_fixed_writer' in sql else 'mutation');return [{'command':'DO'}]
        session.run=run
        def params(sql,values):
            self.assertEqual(values,[recipient,'a'*40,'123','contract-test'])
            calls.append('bound_context');return [{'command':'SELECT 1','rows':[['t']]}]
        session.run_params=params
        def readback(sql):calls.append('readback');return dict(bootstrap_readback)
        session.one_json=readback
        return session,calls

    def test_core_readback_stays_private_until_commit_and_same_backend_lock(self):
        session,calls=self.bootstrap_fake()
        result=session.bootstrap_core(fixed_argument)
        self.assertEqual(calls,['begin','guard','bound_context','mutation','readback','commit'])
        self.assertTrue(result['atomic_transaction_committed'])
        self.assertFalse(result['auth_mutations'])
        self.assertNotIn(recipient,json.dumps(result))

    def test_bad_core_readback_never_commits_and_failed_commit_never_returns_success(self):
        session,calls=self.bootstrap_fake()
        session.one_json=lambda sql:{**bootstrap_readback,'member_grants':2}
        with self.assertRaises(module.Failure):session.bootstrap_core(fixed_argument)
        self.assertNotIn('commit',calls)
        session,calls=self.bootstrap_fake();old_run=session.run
        def wrong_commit(sql):return [{'command':'ROLLBACK'}] if sql=='COMMIT;' else old_run(sql)
        session.run=wrong_commit
        with self.assertRaises(module.Failure):session.bootstrap_core(fixed_argument)

    def test_api_configuration_requires_all_original_migrations_and_actual_readback(self):
        session=self.fake();session.state='initial_ready';session.read_initial_state=lambda:complete_state
        session.run=lambda sql:[{'command':'BEGIN'},{'command':'COMMIT'}]
        session.one_json=lambda sql:{'api_schema_exposed':True}
        result=session.configure_api(fixed_argument)
        self.assertTrue(result['api_schema_exposed'])
        session.one_json=lambda sql:{'api_schema_exposed':False}
        with self.assertRaises(module.Failure):session.configure_api(fixed_argument)
        session.read_initial_state=lambda:{**complete_state,'historyRows':complete_state['historyRows'][:-1]}
        with self.assertRaises(module.Failure):session.configure_api(fixed_argument)

    def test_context_and_protocol_are_strict_and_close_on_unknown_write_requests(self):
        for field in ('GITHUB_REF','GITHUB_REPOSITORY','GITHUB_EVENT_NAME','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_ACTOR'):
            with self.assertRaises(module.Failure):module.trusted_context({**environment,field:'unsafe actor' if field=='GITHUB_ACTOR' else 'wrong'})
        instances=[]
        class Fake:
            def __init__(self,*unused):self.transport={'scope':'SYNTHETIC'};self.closed=0;instances.append(self)
            def close(self):self.closed+=1
        for operation in ('run','apply','execute'):
            raw=''.join(json.dumps({'id':index,'operation':name,'argument':value})+'\n'
                        for index,(name,value) in enumerate([('connect',{'lock_object':module.LOCK_OBJECT}),(operation,'arbitrary')],1)).encode()
            output=io.BytesIO()
            with patch.object(module,'InitialSession',Fake),patch.dict(os.environ,environment,clear=True), \
                 patch.object(module.sys,'argv',[str(source)]), \
                 patch.object(module.sys,'stdin',SimpleNamespace(buffer=io.BytesIO(raw))), \
                 patch.object(module.sys,'stdout',SimpleNamespace(buffer=output)):
                self.assertEqual(module.main(),0)
            response=json.loads(output.getvalue().splitlines()[-1])
            self.assertFalse(response['ok'])
            self.assertEqual(response['code'],'INITIAL_OPERATION_INVALID')
            self.assertEqual(instances[-1].closed,1)


if __name__=='__main__':unittest.main()
