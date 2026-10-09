import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStagingNativeQaAutomation,nativeQaAutomationIds} from '../scripts/staging-pwa-native-qa-automation.mjs';
import {nativeQaFixtureIds,nativeQaProviderMetadata,nativeQaProviderEmail} from '../scripts/staging-pwa-native-qa-fixture.mjs';
const context={sourceSha:'a'.repeat(40),workflowRunId:'12345',actor:'qa-test'};
const providers=['a','b'].map((slot,index)=>({id:`a1000000-0000-4000-8000-00000000000${index+1}`,email:nativeQaProviderEmail(context.workflowRunId,slot),appMetadata:{provider:'email',providers:['email'],...nativeQaProviderMetadata({...context,slot})}}));
const input={...context,expectedVersion:0,providers};
test('scoped recipe keeps provider identities bound and isolates every extra fixture from the canonical QA ids',()=>{
 const result=buildStagingNativeQaAutomation(input),f=nativeQaFixtureIds(context.workflowRunId),a=nativeQaAutomationIds(context.workflowRunId);
 assert.ok(Object.values(a).every(id=>!Object.values(f).includes(id)));assert.equal(new Set(Object.values(a)).size,Object.values(a).length);
 assert.deepEqual(a,nativeQaAutomationIds(context.workflowRunId));assert.notEqual(a.shift,nativeQaAutomationIds('12346').shift);
 assert.equal(result.parameters.length,4);
 for(const key of ['contextSql','guardSql','mutationSql','readbackSql','rollbackReadbackSql']){
  for(const provider of providers){assert.equal(result[key].includes(provider.id),false);assert.equal(result[key].includes(provider.email),false);}
  assert.doesNotMatch(result[key],/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+auth\./i);
 }
 assert.doesNotMatch(result.mutationSql,/pwa_enqueue_automation|pwa_claim_deliveries|pwa_sync_match_fixtures|ALTER TABLE|\bCOMMIT\b|fetch|sendgrid/i);
 assert.match(result.mutationSql,/internal\.pwa_import_match_fixture/);assert.match(result.mutationSql,/internal\.pwa_revalidate_delivery/);
 assert.match(result.guardSql,/source_sha.*v_ctx/s);assert.match(result.rollbackReadbackSql,/rollback_verified/);
});
test('unreviewed scopes, getters, SQL and provider metadata cannot select a different automation recipe',()=>{
 for(const change of [{expectedVersion:1},{scope:'production'},{sql:'SELECT private'}, {workflowRunId:'1;SELECT'}, {providers:[{...providers[0],email:'foreign@example.test'},providers[1]]}])assert.throws(()=>buildStagingNativeQaAutomation({...input,...change}));
 let reads=0;const value={...input};Object.defineProperty(value,'providers',{get(){reads++;throw Error('PRIVATE');}});assert.throws(()=>buildStagingNativeQaAutomation(value));assert.equal(reads,0);
});
