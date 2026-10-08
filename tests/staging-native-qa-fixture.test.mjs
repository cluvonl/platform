import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {randomUUID,randomBytes,randomInt} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {NativeQaFixtureError,buildStagingNativeQaFixture,nativeQaFixtureIds,
  nativeQaProviderEmail,nativeQaProviderMetadata,nativeQaPreflightSql,nativeQaSchemaGuardSql} from '../scripts/staging-native-qa-fixture.mjs';
import {buildStagingNativeQaBooking} from '../scripts/staging-native-qa-booking.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT,initialSQLStatements} from '../scripts/staging-initial-migrations.mjs';

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

// Actual tests opt into the existing fixed local Supabase instance. Only real
// provider APIs create users/sessions. Every app and metadata transaction rolls
// back; provider cleanup runs even after a failed assertion. Nothing is logged
// from provider responses, credentials, private SQL or stderr.
const local=process.env.CLUVO_NATIVE_QA_SQL_TESTS==='local-fixture';
const transactionLiteral=readFileSync(new URL('../scripts/staging_native_qa_session.py',import.meta.url),'utf8')
  .match(/self\.run\(("BEGIN READ WRITE;[^\n]+"\s+"[^\n]+")\)/)[1];
const nativeFixtureTransactionSql=[...transactionLiteral.matchAll(/"[^"\n]*"/g)].map(match=>JSON.parse(match[0])).join('');
assert.ok(nativeFixtureTransactionSql.includes('SET LOCAL row_security=on;'));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const lock=`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});`;
const unlock=`SELECT pg_advisory_unlock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});`;
const localMeta={sourceSha:'a'.repeat(40),workflowRunId:'890'+Date.now()+randomInt(10,99),actor:'qa-local-fixture-test'};
let admin,localInput,recipe,booking;
const created=[];
const nativeSessions=[];
const privateJson=value=>{try{return JSON.parse(value);}catch{throw Error('LOCAL_PRIVATE_PROVIDER_RESPONSE_INVALID');}};
const setup=`DO $local_native_qa_target$ BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170011'
    OR (SELECT count(*) FROM supabase_migrations.schema_migrations)<>16
    OR to_regclass('supabase_migrations.cluvo_migration_source') IS NOT NULL
  THEN RAISE EXCEPTION 'LOCAL_NATIVE_QA_TARGET_UNEXPECTED'; END IF;
END $local_native_qa_target$;
CREATE TABLE supabase_migrations.cluvo_migration_source(
  version text PRIMARY KEY,file text NOT NULL,sha256 text NOT NULL,source_sha text NOT NULL,
  actor text NOT NULL,scope text NOT NULL,expected_version integer NOT NULL,idempotency_key text NOT NULL,workflow_run_id text NOT NULL);
INSERT INTO supabase_migrations.cluvo_migration_source VALUES ${IMMUTABLE16.map((entry,index)=>'('+[
  entry.file.slice(0,14),entry.file,entry.sha256,localMeta.sourceSha,localMeta.actor,'staging',
].map(quote).join(',')+','+index+','+quote('cluvo-staging-initial16:'+localMeta.workflowRunId+':'+entry.file.slice(0,14))+','+quote(localMeta.workflowRunId)+')').join(',')};
${IMMUTABLE16.map(entry=>`UPDATE supabase_migrations.schema_migrations SET name=${quote(entry.file.slice(15,-4))},
  statements=ARRAY[${quote(readFileSync(new URL('../supabase/migrations/'+entry.file,import.meta.url),'utf8'))}]::text[] WHERE version=${quote(entry.file.slice(0,14))};`).join('\n')}
ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas='api';`;
const preflightBody=()=>nativeQaPreflightSql().slice('BEGIN READ WRITE;\n'.length,-'\nCOMMIT;'.length);
function boundContext(value){return value.contextSql.replace(/\$([1-4])/g,(_,index)=>quote(value.parameters[Number(index)-1]));}
function execute(sql){return spawnSync('docker',['exec','-i','supabase_db_cluvo-local','psql','-U','supabase_admin','-d','postgres',
  '--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{
  input:nativeFixtureTransactionSql+'SET LOCAL ROLE postgres;'+lock+setup+sql+'ROLLBACK;'+unlock,
  encoding:'utf8',timeout:20000});}
function success(result){
  assert.equal(result.status,0,'actual local QA SQL failed; private diagnostics withheld');
  return result.stdout.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
}
function refuse(result){assert.notEqual(result.status,0);assert.ok(result.stderr.includes('STAGING_NATIVE_QA_REFUSED'),'fixed refusal required; private diagnostics withheld');}

before(async()=>{
  if(!local)return;
  success(execute(preflightBody()));
  const status=spawnSync('node_modules/.bin/supabase',['status','--output','json'],{encoding:'utf8',timeout:15000});
  assert.equal(status.status,0,'fixed local provider unavailable');
  const config=privateJson(status.stdout);
  assert.equal(config.API_URL,'http://127.0.0.1:55321','unexpected local provider target');
  admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const providers=[];
  for(const slot of ['a','b']){
    const id=randomUUID(),password=randomBytes(32).toString('base64url');
    const email=nativeQaProviderEmail(localMeta.workflowRunId,slot);
    const response=await admin.auth.admin.createUser({id,email,password,email_confirm:true,
      app_metadata:nativeQaProviderMetadata({...localMeta,slot})});
    assert.ok(!response.error&&response.data?.user?.id===id,'local provider creation failed; private diagnostics withheld');
    created.push(id);
    const native=createClient(config.API_URL,config.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const session=await native.auth.signInWithPassword({email,password});
    assert.ok(!session.error&&session.data?.user?.id===id&&session.data?.session?.access_token,'local Native sign-in failed; private diagnostics withheld');
    const verified=await native.auth.getUser(session.data.session.access_token);
    assert.ok(!verified.error&&verified.data?.user?.id===id,'local provider verification failed; private diagnostics withheld');
    const claims=privateJson(Buffer.from(session.data.session.access_token.split('.')[1],'base64url').toString('utf8'));
    assert.ok(claims.sub===id&&claims.role==='authenticated'&&typeof claims.session_id==='string'
      &&claims.exp>Math.floor(Date.now()/1000),'local session correlation failed; private diagnostics withheld');
    nativeSessions.push({client:native,claims});
    providers.push({id:response.data.user.id,email:response.data.user.email,appMetadata:response.data.user.app_metadata});
  }
  localInput={...localMeta,expectedVersion:0,providers};recipe=buildStagingNativeQaFixture(localInput);
  booking=buildStagingNativeQaBooking({...localMeta,expectedVersion:0,actorA:providers[0].id,actorB:providers[1].id});
});
after(async()=>{
  if(!local)return;
  for(const id of created){const response=await admin.auth.admin.deleteUser(id,true);assert.ok(!response.error,'local provider cleanup failed; private diagnostics withheld');}
});

test('actual local preflight requires original 16 byte hashes, forced Native RLS, restricted owner and api-only override',{skip:!local},()=>{
  assert.deepEqual(success(execute(preflightBody())),[{scope:'STAGING_NATIVE_QA_PREFLIGHT_V1',migration_count:16,native_guarded_tables:144,
    api_only:true,command_owner_restricted:true,auth_mutations:false,v1_ready:false,production_enabled:false}]);
  for(const attack of ["ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas='api,app';",
    "UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['SELECT 1;'] WHERE version='20261007013000';",
    'ALTER TABLE app.persons NO FORCE ROW LEVEL SECURITY;',
    'ALTER POLICY native_session_required ON app.persons USING(true) WITH CHECK(true);'])refuse(execute(attack+preflightBody()));
});

test('actual local fixture uses confirmed provider identities, creates least-privilege scopes and replays without duplicates',{skip:!local},()=>{
  const f=nativeQaFixtureIds(localMeta.workflowRunId);
  const result=success(execute(boundContext(recipe)+recipe.mutationSql+recipe.readbackSql+recipe.mutationSql+recipe.readbackSql+
    `SELECT jsonb_build_object('self_links',(SELECT count(*) FROM app.account_person_links WHERE tenant_id IN('${f.tenantA}','${f.tenantB}') AND relationship='self' AND revoked_at IS NULL),
      'member_only',(SELECT bool_and(r.role_key='member' AND g.scope_kind='tenant') FROM app.access_grants g JOIN app.permission_roles r ON r.id=g.role_id AND r.tenant_id=g.tenant_id WHERE g.tenant_id IN('${f.tenantA}','${f.tenantB}')),
      'no_contact_authority',(SELECT bool_and(can_view_progress AND NOT can_manage_contacts AND NOT can_invite_executor AND NOT can_book_for) FROM app.household_access_grants WHERE tenant_id IN('${f.tenantA}','${f.tenantB}')),
      'answers',(SELECT count(*) FROM app.intake_answers_versions WHERE tenant_id IN('${f.tenantA}','${f.tenantB}')));`));
  const base={scope:'STAGING_NATIVE_QA_FIXTURE_V1',qa_fixture_version:1,tenants:2,persons:3,member_grants:3,base_households:2,intake_profiles:3,
    foreign_obligations:1,setup_audits:1,setup_commands:1,initial_answers_created:0,auth_mutations:false,mail_sent:false,native_session_proven:false,v1_ready:false,production_enabled:false};
  assert.deepEqual(result,[{...base,status:'created'},{...base,status:'already_configured'},{self_links:3,member_only:true,no_contact_authority:true,answers:0}]);
});

test('actual local fixture rejects wrong provider context, extra authority, unknown slug and immutable scope drift',{skip:!local},()=>{
  const f=nativeQaFixtureIds(localMeta.workflowRunId);
  const changed={...localInput,sourceSha:'b'.repeat(40),providers:localInput.providers.map((p,index)=>({...p,
    appMetadata:{...p.appMetadata,...nativeQaProviderMetadata({...localMeta,sourceSha:'b'.repeat(40),slot:index===0?'a':'b'})}}))};
  refuse(execute(boundContext(buildStagingNativeQaFixture(changed))+recipe.mutationSql));
  refuse(execute(`INSERT INTO app.tenants(slug,name) VALUES('cluvo-qa-${localMeta.workflowRunId}-a','Unknown preexisting');`+boundContext(recipe)+recipe.mutationSql));
  for(const attack of [`UPDATE app.household_access_grants SET can_manage_contacts=true WHERE id='${f.householdGrantA}';`,
    `UPDATE app.persons SET family_name='Changed' WHERE id='${f.personA}';`,
    `DELETE FROM app.role_permissions WHERE tenant_id='${f.tenantA}' AND permission_key='shift.book';`,
    `UPDATE app.idempotency_records SET request_hash=extensions.digest('drift','sha256') WHERE id='${f.qaFixtureCommand}';`,
    `INSERT INTO app.households(id,tenant_id,label,intake_code_hash) VALUES('${f.householdRaceB}','${f.tenantB}','Unknown collision',extensions.digest(gen_random_uuid()::text,'sha256'));`])
    refuse(execute(boundContext(recipe)+recipe.mutationSql+attack+recipe.mutationSql));
});

test('actual local booking addition is compatible; teardown archives only own scopes and repeats without deleting history',{skip:!local},()=>{
  const result=success(execute(boundContext(recipe)+recipe.mutationSql+boundContext(booking)+booking.mutationSql+
    boundContext(recipe)+recipe.mutationSql+recipe.teardownSql+recipe.teardownReadbackSql+recipe.teardownSql+recipe.teardownReadbackSql));
  const base={scope:'STAGING_NATIVE_QA_TEARDOWN_V1',qa_scopes_archived:2,active_qa_memberships:0,active_qa_grants:0,
    retained_answer_revisions:0,retained_bookings:0,retained_ledger_entries:0,teardown_audits:1,
    auth_mutations:false,mail_sent:false,histories_preserved:true,native_session_proven:false,v1_ready:false,production_enabled:false};
  assert.deepEqual(result,[{...base,status:'archived'},{...base,status:'already_archived'}]);
});

test('actual local cleanup proves absence with zero writes and refuses mixed setup, unknown slugs and foreign fixture-ID collisions',{skip:!local},()=>{
  const f=nativeQaFixtureIds(localMeta.workflowRunId);
  const result=success(execute(boundContext(recipe)+recipe.teardownSql+recipe.teardownReadbackSql+
    `SELECT jsonb_build_object('qa_audits',(SELECT count(*) FROM app.audit_events WHERE id IN('${f.qaFixtureAudit}','${f.qaTeardownAudit}')),
      'qa_commands',(SELECT count(*) FROM app.idempotency_records WHERE id IN('${f.qaFixtureCommand}','${f.qaTeardownCommand}')));`));
  assert.deepEqual(result,[{scope:'STAGING_NATIVE_QA_TEARDOWN_V1',status:'absent',qa_scopes_archived:0,active_qa_memberships:0,active_qa_grants:0,
    retained_answer_revisions:0,retained_bookings:0,retained_ledger_entries:0,teardown_audits:0,
    auth_mutations:false,mail_sent:false,histories_preserved:true,native_session_proven:false,v1_ready:false,production_enabled:false},
    {qa_audits:0,qa_commands:0}]);
  refuse(execute(boundContext(recipe)+`INSERT INTO app.tenants(slug,name) VALUES('cluvo-qa-${localMeta.workflowRunId}-a','Unknown scope');`+recipe.teardownSql));
  refuse(execute(boundContext(recipe)+`INSERT INTO app.tenants(id,slug,name) VALUES('${f.householdRaceB}','unknown-${localMeta.workflowRunId}','Foreign ID collision');`+recipe.teardownSql));
  refuse(execute(boundContext(recipe)+`INSERT INTO app.account_profiles(auth_user_id,display_name) VALUES('${localInput.providers[0].id}','Unknown app identity');`+recipe.teardownSql));
  refuse(execute(boundContext(recipe)+recipe.mutationSql+`DELETE FROM app.idempotency_records WHERE id='${f.qaFixtureCommand}';`+recipe.teardownSql));
});

test('actual local Native session claims enforce same-household and foreign-tenant privacy and retain answer history on teardown',{skip:!local},()=>{
  const f=nativeQaFixtureIds(localMeta.workflowRunId),canaries=[0,1,2].map(()=>randomBytes(18).toString('hex'));
  // These are decoded claims from actual provider-issued, getUser-verified
  // sessions. No fake identity or session row is inserted by SQL.
  const native=index=>`SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote(JSON.stringify(nativeSessions[index].claims))},true) IS NOT NULL AS configured;`;
  const save=(tenant,profile,canary)=>`SELECT count(*) FROM api.save_intake_revision('${tenant}','${profile}',1,120,
    ${quote(JSON.stringify({schema_version:2,experience:canary,practical_limitations:canary}))}::jsonb,null,null,'${randomUUID()}');`;
  const denied=sql=>`DO $native_privacy_denied$ BEGIN ${sql}
    RAISE EXCEPTION 'LOCAL_NATIVE_PRIVACY_ALLOWED';EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END $native_privacy_denied$;`;
  const result=success(execute(boundContext(recipe)+recipe.mutationSql+
    native(0)+save(f.tenantA,f.intakeA,canaries[0])+native(1)+save(f.tenantA,f.intakeB,canaries[1])+save(f.tenantB,f.intakeBForeign,canaries[2])+
    native(0)+`SELECT jsonb_build_object('own_intakes',(SELECT count(*) FROM api.my_intake),
      'other_parent_intakes',(SELECT count(*) FROM api.my_intake WHERE profile_id='${f.intakeB}'),
      'foreign_intakes',(SELECT count(*) FROM api.my_intake WHERE tenant_id='${f.tenantB}'),
      'own_canary',(SELECT answers->>'experience'=${quote(canaries[0])} FROM api.my_intake WHERE profile_id='${f.intakeA}'),
      'other_canaries_absent',(SELECT position(${quote(canaries[1])} IN coalesce(jsonb_agg(to_jsonb(t))::text,''))=0
        AND position(${quote(canaries[2])} IN coalesce(jsonb_agg(to_jsonb(t))::text,''))=0 FROM api.my_intake t),
      'own_contexts',(SELECT count(*) FROM api.list_intake_contexts('${f.tenantA}')),
      'own_workspaces',(SELECT count(*) FROM api.my_workspaces));`+
    `WITH d AS (SELECT api.get_household_dossier('${f.tenantA}','${f.householdA}') value)
      SELECT jsonb_build_object('people',jsonb_array_length(value->'people'),
        'person_is_self',(value->'people'->0->>'person_id')='${f.personA}' AND (value->'people'->0->>'is_self')='true',
        'other_person_absent',position('${f.personB}' IN value::text)=0 AND position('${f.intakeB}' IN value::text)=0,
        'private_answers_absent',position(${quote(canaries[0])} IN value::text)=0 AND position(${quote(canaries[1])} IN value::text)=0
          AND position('intake_code_hash' IN value::text)=0 AND position('auth_user_id' IN value::text)=0) FROM d;`+
    denied(`PERFORM * FROM api.list_intake_contexts('${f.tenantB}');`)+
    denied(`PERFORM api.get_household_dossier('${f.tenantB}','${f.householdB}');`)+
    denied(`PERFORM * FROM api.save_intake_revision('${f.tenantA}','${f.intakeB}',2,120,'{}',null,null,'${randomUUID()}');`)+
    denied(`PERFORM * FROM api.save_intake_revision('${f.tenantB}','${f.intakeBForeign}',2,120,'{}',null,null,'${randomUUID()}');`)+
    native(1)+`SELECT jsonb_build_object('own_intakes',(SELECT count(*) FROM api.my_intake),
      'first_parent_absent',(SELECT count(*) FROM api.my_intake WHERE profile_id='${f.intakeA}')=0,
      'own_workspaces',(SELECT count(*) FROM api.my_workspaces),
      'foreign_tenant_own_contexts',(SELECT count(*) FROM api.list_intake_contexts('${f.tenantB}')));`+
    `SET LOCAL ROLE postgres;`+boundContext(recipe)+recipe.mutationSql+recipe.teardownSql+recipe.teardownReadbackSql));
  assert.deepEqual(result.slice(0,3),[
    {own_intakes:1,other_parent_intakes:0,foreign_intakes:0,own_canary:true,other_canaries_absent:true,own_contexts:1,own_workspaces:1},
    {people:1,person_is_self:true,other_person_absent:true,private_answers_absent:true},
    {own_intakes:2,first_parent_absent:true,own_workspaces:2,foreign_tenant_own_contexts:1},
  ]);
  assert.equal(result.length,4);assert.equal(result[3].retained_answer_revisions,3);
  assert.equal(result[3].histories_preserved,true);assert.equal(result[3].qa_scopes_archived,2);
});

test('actual local provider logout makes the original unexpired Native session lose reads and commands while the other actor keeps access',{skip:!local},async()=>{
  const response=await nativeSessions[0].client.auth.signOut({scope:'global'});
  assert.ok(!response.error,'local provider revocation failed; private diagnostics withheld');
  assert.ok(nativeSessions[0].claims.exp>Math.floor(Date.now()/1000),'revocation proof requires an unexpired original token');
  const f=nativeQaFixtureIds(localMeta.workflowRunId);
  const native=index=>`SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote(JSON.stringify(nativeSessions[index].claims))},true) IS NOT NULL AS configured;`;
  const result=success(execute(boundContext(recipe)+recipe.mutationSql+native(0)+
    `SELECT jsonb_build_object('intakes',(SELECT count(*) FROM api.my_intake),'workspaces',(SELECT count(*) FROM api.my_workspaces));
    DO $revoked_command$ BEGIN
      PERFORM * FROM api.save_intake_revision('${f.tenantA}','${f.intakeA}',1,120,'{}',null,null,'${randomUUID()}');
      RAISE EXCEPTION 'LOCAL_REVOKED_COMMAND_ALLOWED';EXCEPTION WHEN SQLSTATE '42501' THEN NULL;END $revoked_command$;`+
    native(1)+`SELECT jsonb_build_object('control_intakes',(SELECT count(*) FROM api.my_intake),'control_workspaces',(SELECT count(*) FROM api.my_workspaces));
    SET LOCAL ROLE postgres;
    SELECT jsonb_build_object('answer_revisions',(SELECT count(*) FROM app.intake_answers_versions WHERE tenant_id IN('${f.tenantA}','${f.tenantB}')),
      'intake_commands',(SELECT count(*) FROM app.idempotency_records WHERE tenant_id IN('${f.tenantA}','${f.tenantB}') AND operation='save_intake_revision'));`));
  assert.deepEqual(result,[{intakes:0,workspaces:0},{control_intakes:2,control_workspaces:2},{answer_revisions:0,intake_commands:0}]);
});

test('actual local readback confirms QA app fixtures and temporary migration metadata were rolled back',{skip:!local},()=>{
  const f=nativeQaFixtureIds(localMeta.workflowRunId);
  const result=spawnSync('docker',['exec','-i','supabase_db_cluvo-local','psql','-U','supabase_admin','-d','postgres',
    '--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{
    input:`BEGIN;SET LOCAL ROLE postgres;
    SELECT jsonb_build_object('qa_tenants',(SELECT count(*) FROM app.tenants WHERE id IN('${f.tenantA}','${f.tenantB}')),
      'source_audit_absent',to_regclass('supabase_migrations.cluvo_migration_source') IS NULL,
      'native_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relforcerowsecurity));
    ROLLBACK;`,encoding:'utf8',timeout:15000});
  assert.deepEqual(success(result),[{qa_tenants:0,source_audit_absent:true,native_tables:144}]);
});
