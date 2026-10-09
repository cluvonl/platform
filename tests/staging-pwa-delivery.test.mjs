import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliveryContext,deliveryTransaction,finishDeliverySQL,testedDeliveryRelease} from '../scripts/staging-pwa-delivery.mjs';

const environment={APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:'a'.repeat(40),RELEASE_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_ACTOR:'cluvo-ci',SENDGRID_FROM_EMAIL:'info@cluvo.nl',SENDGRID_API_KEY:'synthetic-test-key',MAIL_ALLOWLIST:'synthetic@example.test',VAPID_PUBLIC_KEY:'a'.repeat(87),VAPID_PRIVATE_KEY:'b'.repeat(43),MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-test-password@db.fbozlbgmktkgcdfqdaaz.supabase.co:5432/postgres'};
test('delivery refuses other projects, production, push events and an unbound source',()=>{
  assert.equal(deliveryContext(environment).project.ref,'fbozlbgmktkgcdfqdaaz');
  for(const changed of [{APP_ENV:'production'},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'b'.repeat(40)},{GITHUB_ACTOR:"';SELECT 1;--"},{MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-test-password@example.test/postgres'}])assert.throws(()=>deliveryContext({...environment,...changed}));
});
test('a provider receipt cannot inject SQL or claim an arbitrary state',()=>{
  const target={id:'10000000-0000-4000-8000-000000000001',version:2},worker='20000000-0000-4000-8000-000000000002';
  assert.match(finishDeliverySQL(target,worker,{state:'unknown',providerStatus:null}),/pwa_finish_delivery/);
  assert.throws(()=>finishDeliverySQL({...target,id:"';DELETE"},worker,{state:'sent',providerStatus:202}));
  assert.throws(()=>finishDeliverySQL(target,worker,{state:'completed',providerStatus:202}));
  assert.throws(()=>finishDeliverySQL(target,worker,{state:'sent',providerStatus:999}));
  assert.throws(()=>finishDeliverySQL(target,worker,{state:'sent',providerStatus:202,bodyHash:'a'.repeat(64),templateRevision:1,providerMessageKey:"';DELETE"}));
  assert.throws(()=>finishDeliverySQL(target,worker,{state:'sent',providerStatus:202,bodyHash:'a'.repeat(64)}));
  assert.match(finishDeliverySQL(target,worker,{state:'sent',providerStatus:202,bodyHash:'a'.repeat(64),templateRevision:1,providerMessageKey:'provider-test-id'}),/pwa_finish_delivery_receipted/);
});
test('delivery writer holds the migration lock and checks actual history and all native guards',()=>{
  const sql=deliveryTransaction(environment,{migrations:[{version:'20261009103000',file:'pwa.sql',sha256:'c'.repeat(64)}]},'SELECT 1;');
  assert.match(sql,/BEGIN READ WRITE/);assert.match(sql,/pg_try_advisory_xact_lock\(1129076054,/);
  assert.match(sql,/cluvo_pwa_upgrade_source/);assert.match(sql,/native_session_required/);
  assert.match(sql,/cluvo.delivery_source/);assert.doesNotMatch(sql,/synthetic-test-password|synthetic-test-key/);
});
test('delivery requires the current exact green main and staging source',async()=>{
  const fetcher=async url=>({status:200,json:async()=>url.endsWith('/api/health/live')?{status:'ok',service:'cluvo',mode:'app',environment:'staging',release:environment.RELEASE_SHA}:url.endsWith('/api/health/ready')?{ready:true,scope:'authenticated_core',checks:{database:'reachable',authorization:'rls_api'}}:url.includes('/runs?')?{workflow_runs:[{head_sha:environment.RELEASE_SHA,head_branch:'main',status:'completed',conclusion:'success'}]}:{object:{sha:environment.RELEASE_SHA}}});
  assert.equal(await testedDeliveryRelease(environment,fetcher),true);
  assert.equal(await testedDeliveryRelease(environment,async url=>url.endsWith('/staging')?{status:200,json:async()=>({object:{sha:'b'.repeat(40)}})}:fetcher(url)),false);
  assert.equal(await testedDeliveryRelease(environment,async url=>url.endsWith('/api/health/live')?{status:200,json:async()=>({status:'ok',service:'cluvo',mode:'app',environment:'staging',release:'b'.repeat(40)})}:fetcher(url)),false);
});
