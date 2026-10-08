import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {buildStagingCoreBootstrap,STAGING_CORE_FIXTURE as f} from '../scripts/staging-core-bootstrap.mjs';

const context={recipient:'bootstrap@cluvo.example',sourceSha:'a'.repeat(40),workflowRunId:'20',actor:'contract-test',expectedVersion:0};
const fail=value=>assert.throws(()=>buildStagingCoreBootstrap(value),error=>{
  assert.equal(error.code,'STAGING_CORE_INPUT_INVALID');
  assert.equal(error.message,'STAGING_CORE_INPUT_INVALID');
  return true;
});

test('private recipient stays bound; immutable fixed SQL is shared independently of caller metadata',()=>{
  const first=buildStagingCoreBootstrap(context);
  const other=buildStagingCoreBootstrap({...context,recipient:'other@cluvo.example',sourceSha:'b'.repeat(40),workflowRunId:'21'});
  assert.deepEqual(first.parameters,[context.recipient,context.sourceSha,context.workflowRunId,context.actor]);
  assert.equal(first.contextSql,other.contextSql);
  assert.equal(first.mutationSql,other.mutationSql);
  assert.equal(first.readbackSql,other.readbackSql);
  for(const sql of [first.contextSql,first.mutationSql,first.readbackSql]) assert.ok(!sql.includes(context.recipient));
  assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.parameters));
  assert.throws(()=>{first.parameters[0]='changed';},TypeError);
});

test('unknown fields, malformed metadata, nonzero versions and secret-bearing exceptions are refused',()=>{
  for(const changed of [{recipient:'injected\n@cluvo.example'},{recipient:'*@cluvo.example'},
    {recipient:'bootstrap@cluvo.example\0'},{recipient:'x'.repeat(255)+'@cluvo.example'},
    {sourceSha:'not-sha'},{workflowRunId:'0'},{workflowRunId:'20;sql'},
    {actor:'actor\nprivate'},{expectedVersion:1},{expectedVersion:false},
    {expectedVersion:undefined},{projectRef:'foreign'},{role:'board'},{sql:'arbitrary'}]) fail({...context,...changed});
  for(const value of [null,undefined,[],{},'private']) fail(value);
});

test('accessors and hostile proxy failures never read or expose private values',()=>{
  let reads=0;
  const input={...context};
  Object.defineProperty(input,'recipient',{get(){reads++;throw Error('SYNTHETIC_PRIVATE');},enumerable:true});
  fail(input);assert.equal(reads,0);
  fail(new Proxy(context,{ownKeys(){throw Error('SYNTHETIC_PRIVATE');}}));
  fail({...context,[Symbol('alternate')]:true});
});

const local=process.env.CLUVO_BOOTSTRAP_SQL_TESTS==='local-fixture';
const container='supabase_db_cluvo-local';
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const bind=value=>"'"+String(value).replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
const lock=`SELECT pg_advisory_lock(${f.lockNamespace},${f.lockObject});`;
const unlock=`SELECT pg_advisory_unlock(${f.lockNamespace},${f.lockObject});`;
const execute=sql=>spawnSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres',
  '--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:15_000});
function fixture({confirmed=false,banned=false,deleted=false,missing=false,duplicate=false}={}){
  const identity=randomUUID(),recipient=`bootstrap-${randomUUID()}@example.test`;
  const built=buildStagingCoreBootstrap({...context,recipient});
  let setup=missing?'':`INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,banned_until,deleted_at)
    VALUES(${quote(identity)},'authenticated','authenticated',${quote(recipient)},'{}','{}',
      ${confirmed?'statement_timestamp()':'NULL'},${banned?"statement_timestamp()+interval '1 day'":'NULL'},${deleted?'statement_timestamp()':'NULL'});`;
  if(duplicate) setup+=`INSERT INTO auth.users(id,aud,role,email,is_sso_user) VALUES(${quote(randomUUID())},'authenticated','authenticated',${quote(recipient)},true);`;
  const bound=()=>built.contextSql.replace(/;\s*$/,'')+'\n\\bind '+built.parameters.map(bind).join(' ')+'\n\\g\n';
  return{identity,recipient,built,setup,bound};
}
function success(result){
  assert.equal(result.status,0,'actual local SQL failed; private diagnostics withheld');
  return result.stdout.trim().split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
}
function refusal(result){
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/STAGING_CORE_BOOTSTRAP_REFUSED/);
  assert.doesNotMatch(result.stderr,/@example\.test|bootstrap-[0-9a-f-]+/);
}

test('actual local SQL creates a minimal scope for an unconfirmed identity without confirming or creating sessions', {skip:!local},()=>{
  const v=fixture();
  const results=success(execute(`BEGIN;${lock}${v.setup}${v.bound()}${v.built.mutationSql}${v.built.readbackSql}
    SELECT jsonb_build_object('confirmed',(SELECT email_confirmed_at IS NOT NULL FROM auth.users WHERE id=${quote(v.identity)}),
      'sessions',(SELECT count(*) FROM auth.sessions WHERE user_id=${quote(v.identity)}),
      'answers',(SELECT count(*) FROM app.intake_answers_versions WHERE tenant_id='${f.tenant}'),
      'bookings',(SELECT count(*) FROM app.bookings WHERE tenant_id='${f.tenant}'),
      'executor_grants',(SELECT count(*) FROM app.executor_obligation_grants WHERE tenant_id='${f.tenant}'),
      'minutes',(SELECT effective_target_minutes FROM app.obligations WHERE id='${f.obligation}'),
      'winter_minutes',(SELECT effective_winter_minutes FROM app.obligations WHERE id='${f.obligation}'),
      'intake_revision',(SELECT current_revision FROM app.intake_profiles WHERE id='${f.intake}'));
    ROLLBACK;${unlock}`));
  assert.equal(results[0].status,'created');
  for(const name of ['tenants','member_grants','households','intake_profiles','seasons','obligations','bootstrap_audits','bootstrap_commands']) assert.equal(results[0][name],1);
  assert.equal(results[0].current_ledger_entries,0);
  assert.equal(results[0].auth_mutations,false);assert.equal(results[0].native_session_proven,false);
  assert.deepEqual(results[1],{confirmed:false,sessions:0,answers:0,bookings:0,executor_grants:0,minutes:720,winter_minutes:360,intake_revision:0});
});

test('actual local SQL replay creates no grants/audits and preserves later personal answers and versions', {skip:!local},()=>{
  const v=fixture();
  const results=success(execute(`BEGIN;${lock}${v.setup}${v.bound()}${v.built.mutationSql}
    INSERT INTO app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)
      VALUES('${f.tenant}','${f.intake}',1,'{"experience":"Synthetic subsequent personal answer"}',${quote(v.identity)});
    UPDATE app.intake_profiles SET current_revision=1,status='submitted',desired_minutes=180,version=2 WHERE id='${f.intake}';
    ${v.bound()}${v.built.mutationSql}${v.built.readbackSql}
    SELECT jsonb_build_object('version',(SELECT version FROM app.intake_profiles WHERE id='${f.intake}'),
      'desired_minutes',(SELECT desired_minutes FROM app.intake_profiles WHERE id='${f.intake}'),
      'answers',(SELECT count(*) FROM app.intake_answers_versions WHERE profile_id='${f.intake}'));
    ROLLBACK;${unlock}`));
  assert.equal(results[0].status,'already_configured');assert.equal(results[0].bootstrap_audits,1);assert.equal(results[0].bootstrap_commands,1);
  assert.deepEqual(results[1],{version:2,desired_minutes:180,answers:1});
});

test('actual local SQL refuses missing, duplicate, deleted and actively banned designated identities', {skip:!local},()=>{
  for(const options of [{missing:true},{duplicate:true},{deleted:true},{banned:true}]){
    const v=fixture(options);
    refusal(execute(`BEGIN;${lock}${v.setup}${v.bound()}${v.built.mutationSql}ROLLBACK;${unlock}`));
  }
});

test('actual local SQL refuses missing lock, changed history, missing/bypassed Native policy and an API definer', {skip:!local},()=>{
  for(const attack of ['lock','history','native','bypassed-native','definer']){
    const v=fixture();
    const change={lock:'',history:"DELETE FROM supabase_migrations.schema_migrations WHERE version='20261007013000';",
      native:'DROP POLICY native_session_required ON app.persons;',
      'bypassed-native':'ALTER POLICY native_session_required ON app.persons USING (true) WITH CHECK (true);',
      definer:'CREATE FUNCTION api.synthetic_bootstrap_attack() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$SELECT true$$;'}[attack];
    refusal(execute(`BEGIN;${attack==='lock'?'':lock}${v.setup}${change}${v.bound()}${v.built.mutationSql}ROLLBACK;${unlock}`));
  }
});

test('actual local SQL rejects unknown existing slug and preexisting account scope without adopting it', {skip:!local},()=>{
  for(const attack of ['slug','profile','foreign-link']){
    const v=fixture();
    const change={slug:`INSERT INTO app.tenants(slug,name) VALUES('${f.slug}','Unknown existing club');`,
      profile:`INSERT INTO app.account_profiles(auth_user_id,display_name) VALUES(${quote(v.identity)},'Existing profile');`,
      'foreign-link':`INSERT INTO app.tenants(id,slug,name) VALUES('c2000000-0000-4000-8000-000000000001','bootstrap-foreign','Other fixture');
        INSERT INTO app.persons(id,tenant_id,given_name,family_name) VALUES('c2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000001','Other','Person');
        INSERT INTO app.account_person_links(tenant_id,person_id,auth_user_id,verified_at) VALUES('c2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000002',${quote(v.identity)},statement_timestamp());`}[attack];
    refusal(execute(`BEGIN;${lock}${v.setup}${change}${v.bound()}${v.built.mutationSql}ROLLBACK;${unlock}`));
  }
});

test('actual local SQL cannot turn revoked/expanded grants or changed immutable fixture data into a replay', {skip:!local},()=>{
  for(const attack of ['revoked','expanded','extra-role','role-permission','unknown-person','hash','season','audit']){
    const v=fixture();
    const change={revoked:`UPDATE app.access_grants SET revoked_at=statement_timestamp() WHERE id='${f.memberGrant}';`,
      expanded:`UPDATE app.household_access_grants SET can_invite_executor=true WHERE id='${f.householdGrant}';`,
      'extra-role':`INSERT INTO app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)
        SELECT '${f.tenant}',${quote(v.identity)},id,'tenant',${quote(v.identity)} FROM app.permission_roles WHERE tenant_id='${f.tenant}' AND role_key='board';`,
      'role-permission':`INSERT INTO app.role_permissions(tenant_id,role_id,permission_key)
        SELECT '${f.tenant}',id,'shift.manage' FROM app.permission_roles WHERE tenant_id='${f.tenant}' AND role_key='member';`,
      'unknown-person':`INSERT INTO app.persons(tenant_id,given_name,family_name) VALUES('${f.tenant}','Unknown','Person');`,
      hash:`UPDATE app.households SET intake_code_hash=extensions.digest('different','sha256') WHERE id='${f.household}';`,
      season:`UPDATE app.seasons SET winter_cutoff_at=winter_cutoff_at+interval '1 day' WHERE id='${f.season}';`,
      audit:`DELETE FROM app.audit_events WHERE id='${f.audit}';`}[attack];
    // Audit history is immutable: its DELETE must itself fail before replay.
    const result=execute(`BEGIN;${lock}${v.setup}${v.bound()}${v.built.mutationSql}${change}${v.bound()}${v.built.mutationSql}ROLLBACK;${unlock}`);
    if(attack==='audit'){assert.notEqual(result.status,0);assert.match(result.stderr,/audit_events is append-only/);}
    else refusal(result);
  }
});

test('actual local SQL permits safe repeat on a later release while preserving original provisioning provenance', {skip:!local},()=>{
  const v=fixture();
  const later=buildStagingCoreBootstrap({...context,recipient:v.recipient,sourceSha:'b'.repeat(40),workflowRunId:'21',actor:'later-operator'});
  const bound=later.contextSql.replace(/;\s*$/,'')+'\n\\bind '+later.parameters.map(bind).join(' ')+'\n\\g\n';
  const results=success(execute(`BEGIN;${lock}${v.setup}${v.bound()}${v.built.mutationSql}${bound}${later.mutationSql}${later.readbackSql}
    SELECT jsonb_build_object('original_source_preserved',(SELECT payload_minimal->>'source_sha'=${quote(context.sourceSha)} FROM app.audit_events WHERE id='${f.audit}'),
      'original_actor_preserved',(SELECT payload_minimal->>'provisioning_actor'=${quote(context.actor)} FROM app.audit_events WHERE id='${f.audit}'));
    ROLLBACK;${unlock}`));
  assert.equal(results[0].status,'already_configured');
  assert.deepEqual(results[1],{original_source_preserved:true,original_actor_preserved:true});
});
