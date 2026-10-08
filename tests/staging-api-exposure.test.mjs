import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingApiExposureSQL} from '../scripts/staging-api-exposure.mjs';
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
