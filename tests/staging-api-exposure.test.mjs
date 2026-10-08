import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingApiExposureSQL} from '../scripts/staging-api-exposure.mjs';
import {fixedOperation} from '../scripts/staging-initial-sql.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
test('configuration refuses invalid release identity/version before producing a statement',()=>{
 const context={sourceSha:'a'.repeat(40),workflowRunId:'42',actor:'cluvo-test',expectedVersion:0};
 for(const patch of [{expectedVersion:1},{actor:"x';DROP ROLE postgres;--"},{sourceSha:'production'},{workflowRunId:'0'}]){
  assert.throws(()=>stagingApiExposureSQL({...context,...patch}),/STAGING_API_CONTEXT_INVALID/);
 }
 const sql=stagingApiExposureSQL(context);
 assert.ok(sql.indexOf('STAGING_API_DATABASE_NOT_READY')<sql.indexOf('ALTER ROLE authenticator'));
 assert.ok(sql.includes("IN DATABASE postgres SET pgrst.db_schemas='api'"));
 assert.ok(sql.includes('STAGING_API_CONFIG_DRIFT'));assert.ok(sql.endsWith('COMMIT;'));
});

test('fixed API generator preserves SQL regex dollar literals and the exact exposure transaction',async()=>{
 const sourceSha='a'.repeat(40),workflowRunId='42',actor='cluvo-test';
 const state={layout:{schemas:['api','app','internal'],app_objects:500,history_present:true,source_history_present:true},
  historyRows:IMMUTABLE16.map(e=>({version:e.file.slice(0,14),name:e.file.slice(15,-4),statement_count:1,single_statement_sha256:e.sha256})),
  sourceRows:IMMUTABLE16.map((e,i)=>({version:e.file.slice(0,14),file:e.file,sha256:e.sha256,source_sha:sourceSha,
   actor,scope:'staging',expected_version:i,workflow_run_id:workflowRunId,idempotency_key:'cluvo-staging-initial16:42:'+e.file.slice(0,14)}))};
 const sql=await fixedOperation({operation:'configure_api',sourceSha,workflowRunId,actor,state,
  expectedBackendPid:321,expectedBackendStart:'2026-10-08 12:30:01.123456+00'});
 for(const regex of ["source.source_sha !~ '^[0-9a-f]{40}$'","source.workflow_run_id !~ '^[1-9][0-9]{0,19}$'",
  "source.actor !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'"])assert.ok(sql.includes(regex));
 assert.equal((sql.match(/COMMIT;/g)??[]).length,1);
 assert.ok(sql.endsWith(stagingApiExposureSQL({sourceSha,workflowRunId,actor,expectedVersion:0}).slice('BEGIN READ WRITE;\n'.length)));
});
