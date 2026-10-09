import assert from 'node:assert/strict';
import test from 'node:test';
import {NativeQaFixtureError,buildStagingNativeQaFixture,nativeQaFixtureIds,
  nativeQaProviderEmail,nativeQaProviderMetadata,nativeQaPreflightSql,nativeQaSchemaGuardSql} from '../scripts/staging-pwa-native-qa-fixture.mjs';
import {initialSQLStatements} from '../scripts/staging-initial-migrations.mjs';

const meta={sourceSha:'a'.repeat(40),workflowRunId:'424242',actor:'qa-fixture-test'};
const provider=(slot,id,context=meta)=>({id,email:nativeQaProviderEmail(context.workflowRunId,slot),
  appMetadata:{...nativeQaProviderMetadata({...context,slot}),provider:'email',providers:['email']}});
const input={...meta,expectedVersion:0,providers:[
  provider('a','a1000000-0000-4000-8000-000000000001'),provider('b','a1000000-0000-4000-8000-000000000002'),
]};
const failure=fn=>assert.throws(fn,error=>error instanceof NativeQaFixtureError
  &&error.code==='STAGING_NATIVE_QA_INPUT_INVALID'&&error.message===error.code);

test('run-derived public UUIDs are deterministic, distinct and separated from provider identities',()=>{
  const first=nativeQaFixtureIds(meta.workflowRunId),next=nativeQaFixtureIds('424243');
  assert.ok(Object.isFrozen(first));assert.equal(Object.values(first).length,new Set(Object.values(first)).size);
  assert.deepEqual(first,nativeQaFixtureIds(meta.workflowRunId));
  assert.ok(Object.values(first).every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.ok(Object.keys(first).every(label=>first[label]!==next[label]));
  assert.notEqual(first.householdA,first.householdRaceB);assert.notEqual(first.obligationA,first.obligationB);
  assert.notEqual(first.tenantA,first.tenantB);assert.notEqual(first.qaFixtureAudit,first.qaTeardownAudit);
  for(const run of ['0','01','1;SELECT',42,'1'.repeat(21)])failure(()=>nativeQaFixtureIds(run));
});

test('private Auth response fields stay in four bound parameters and never alter fixed SQL',()=>{
  const first=buildStagingNativeQaFixture(input),second=buildStagingNativeQaFixture({...input,providers:[
    provider('a','a2000000-0000-4000-8000-000000000001'),provider('b','a2000000-0000-4000-8000-000000000002'),
  ]});
  assert.equal(first.parameters.length,4);assert.equal(first.parameters[1],meta.sourceSha);
  assert.equal(first.parameters[2],meta.workflowRunId);assert.equal(first.parameters[3],meta.actor);
  assert.deepEqual(JSON.parse(first.parameters[0]),input.providers.map((p,index)=>({slot:index===0?'a':'b',id:p.id,email:p.email})));
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.parameters));
  for(const key of ['contextSql','mutationSql','readbackSql','teardownSql','teardownReadbackSql']){
    assert.equal(first[key],second[key]);
    for(const p of input.providers)assert.ok(!first[key].includes(p.id)&&!first[key].includes(p.email));
    assert.doesNotMatch(first[key],/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+auth\.(?:users|sessions|identities)\b/i);
  }
  assert.equal(initialSQLStatements(first.mutationSql).length,1);
  assert.equal(initialSQLStatements(first.teardownSql).length,1);
  assert.match(first.contextSql,/\$1::jsonb/);assert.match(first.contextSql,/\$4::text/);
  assert.equal(initialSQLStatements(nativeQaSchemaGuardSql()).length,1);
  assert.equal(initialSQLStatements(nativeQaPreflightSql()).length,4);
  assert.ok(nativeQaPreflightSql().includes(nativeQaSchemaGuardSql()));
  assert.doesNotMatch(nativeQaSchemaGuardSql(),/auth\.(?:users|sessions|identities)/);
});

test('wrong source, actor, scope/version, provider ownership or metadata refuses without accepting arbitrary SQL',()=>{
  for(const change of [{sourceSha:'b'.repeat(40)},{workflowRunId:'424243'},{actor:'other-actor'},
    {expectedVersion:1},{expectedVersion:false},{projectRef:'other'},{scope:'production'},
    {sql:'arbitrary'},{sourceSha:'BAD'},{actor:'bad actor'}])failure(()=>buildStagingNativeQaFixture({...input,...change}));
  for(const change of [{email:'another@example.test'},{id:input.providers[1].id},
    {id:nativeQaFixtureIds(meta.workflowRunId).personA},{id:'not-a-uuid'},
    {appMetadata:{...input.providers[0].appMetadata,cluvo_qa_slot:'b'}},
    {appMetadata:{...input.providers[0].appMetadata,cluvo_qa_run_id:'424243'}},
    {appMetadata:{...input.providers[0].appMetadata,providers:['email','oauth']}},
    {appMetadata:{...input.providers[0].appMetadata,extra:'unreviewed'}},
    {password:'never-accepted-here'}])failure(()=>buildStagingNativeQaFixture({...input,providers:[{...input.providers[0],...change},input.providers[1]]}));
  failure(()=>buildStagingNativeQaFixture({...input,providers:[input.providers[1],input.providers[0]]}));
  failure(()=>nativeQaProviderEmail(meta.workflowRunId,'other'));
});

test('getters, inherited keys, custom arrays and proxy diagnostics cannot cross the private input boundary',()=>{
  let reads=0;const getter={...input};Object.defineProperty(getter,'providers',{get(){reads++;throw Error('SYNTHETIC_PRIVATE');}});
  failure(()=>buildStagingNativeQaFixture(getter));assert.equal(reads,0);
  failure(()=>buildStagingNativeQaFixture(new Proxy(input,{ownKeys(){throw Error('SYNTHETIC_PRIVATE');}})));
  failure(()=>buildStagingNativeQaFixture({...input,[Symbol('unknown')]:true}));
  failure(()=>buildStagingNativeQaFixture(Object.create(input)));
  const custom=[...input.providers];custom.map=()=>input.providers;failure(()=>buildStagingNativeQaFixture({...input,providers:custom}));
  const nested={...input.providers[0].appMetadata};Object.defineProperty(nested,'cluvo_qa_actor',{get(){reads++;return meta.actor;}});
  failure(()=>buildStagingNativeQaFixture({...input,providers:[{...input.providers[0],appMetadata:nested},input.providers[1]]}));
  const aliases=['email'];aliases.extra=true;
  failure(()=>buildStagingNativeQaFixture({...input,providers:[{...input.providers[0],appMetadata:{...input.providers[0].appMetadata,providers:aliases}},input.providers[1]]}));
  assert.equal(reads,0);
});

