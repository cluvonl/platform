import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
const target = databaseUrl ? new URL(databaseUrl) : null;
if (!target || !['postgres:', 'postgresql:'].includes(target.protocol)
  || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55322' || target.pathname !== '/postgres') {
  throw new Error('Intake reconfirmation concurrency requires the disposable local database on port 55322.');
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function psql(sql, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--dbname', databaseUrl], {stdio:['pipe','pipe','pipe']});
    let stdout = '', stderr = '';
    child.stdout.on('data',(chunk)=>{stdout+=chunk;if(ready && stdout.includes('RECONFIRMATION_LOCK_HELD')){ready();ready=null;}});
    child.stderr.on('data',(chunk)=>{stderr+=chunk;});
    child.on('error',reject);child.on('exit',(code)=>resolve({code,stdout,stderr}));child.stdin.end(sql);
  });
}
function requireSuccess(result) {
  if(result.code!==0)throw new Error('Intake reconfirmation query failed; private SQL diagnostics withheld.');
  return result.stdout.trim();
}
const scenarios=[];
for(const winner of ['exact_confirmation','answer_revision','assistance_revocation','native_session_revocation','season_close']) {
  const ids=Object.fromEntries(['tenant','household','owner','helper','person','profile','previous','season','rollover','item','delegation','command'].map((name)=>[name,randomUUID()]));
  const suffix=ids.tenant.slice(0,8),ownerEmail=`reconfirm-owner-${suffix}@example.test`,helperEmail=`reconfirm-helper-${suffix}@example.test`;
  requireSuccess(await psql(`begin;
    insert into auth.users(id,aud,role,email,email_confirmed_at) values
      (${literal(ids.owner)},'authenticated','authenticated',${literal(ownerEmail)},statement_timestamp()),
      (${literal(ids.helper)},'authenticated','authenticated',${literal(helperEmail)},statement_timestamp());
    insert into auth.sessions(id,user_id,created_at,updated_at) values (${literal(ids.owner)},${literal(ids.owner)},statement_timestamp(),statement_timestamp()),(${literal(ids.helper)},${literal(ids.helper)},statement_timestamp(),statement_timestamp());
    insert into app.tenants(id,slug,name,status) values(${literal(ids.tenant)},${literal('reconfirm-'+suffix)},'Local reconfirmation race','active');
    insert into app.tenant_memberships(tenant_id,auth_user_id,status) values(${literal(ids.tenant)},${literal(ids.owner)},'active'),(${literal(ids.tenant)},${literal(ids.helper)},'active');
    insert into app.persons(id,tenant_id,given_name,family_name) values(${literal(ids.person)},${literal(ids.tenant)},'Personal','Reconfirmation fixture');
    insert into app.account_person_links(tenant_id,auth_user_id,person_id,verified_at) values(${literal(ids.tenant)},${literal(ids.owner)},${literal(ids.person)},statement_timestamp());
    insert into app.households(id,tenant_id,label,intake_code_hash) values(${literal(ids.household)},${literal(ids.tenant)},'Reconfirmation fixture',extensions.digest(${literal(randomUUID())},'sha256'));
    insert into app.intake_profiles(id,tenant_id,person_id,household_context_id,status,current_revision) values(${literal(ids.profile)},${literal(ids.tenant)},${literal(ids.person)},${literal(ids.household)},'submitted',1);
    insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id) values(${literal(ids.tenant)},${literal(ids.profile)},1,'{"experience":"Before"}',${literal(ids.owner)});
    insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,status) values
      (${literal(ids.previous)},${literal(ids.tenant)},'Previous','2025-07-01','2026-06-30','2025-12-15','closed'),
      (${literal(ids.season)},${literal(ids.tenant)},'Next','2027-07-01','2028-06-30','2027-12-15','preparing');
    insert into app.rollover_runs(id,tenant_id,source_season_id,target_season_id,created_by_auth_user_id,idempotency_key) values(${literal(ids.rollover)},${literal(ids.tenant)},${literal(ids.previous)},${literal(ids.season)},${literal(ids.owner)},${literal(randomUUID())});
    insert into app.season_reconfirmation_items(id,tenant_id,rollover_run_id,target_season_id,subject_kind,person_id,source_resource_id) values(${literal(ids.item)},${literal(ids.tenant)},${literal(ids.rollover)},${literal(ids.season)},'intake',${literal(ids.person)},${literal(ids.profile)});
    insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,granted_by_auth_user_id) values(${literal(ids.delegation)},${literal(ids.tenant)},${literal(ids.helper)},${literal(ids.person)},${literal(ids.household)},'intake_assistance',statement_timestamp()-interval '1 day',${literal(ids.owner)});
    commit;`));
  const actor=(id,email)=>`set local role authenticated;select set_config('request.jwt.claim.sub',${literal(id)},true);select set_config('request.jwt.claim.email',${literal(email)},true);select set_config('request.jwt.claims',${literal(JSON.stringify({sub:id,session_id:id,email,role:'authenticated'}))},true);`;
  const confirmation=(assisted=false)=>`${actor(assisted?ids.helper:ids.owner,assisted?helperEmail:ownerEmail)}
    select * from api.confirm_intake_reconfirmation(${literal(ids.tenant)},${literal(ids.item)},1,1,${assisted?literal(ids.person):'null'},${assisted?literal('Synthetic concurrent assistance'):'null'},${literal(ids.command)});`;
  const firstCommand=winner==='exact_confirmation'?confirmation():winner==='answer_revision'
    ?`${actor(ids.owner,ownerEmail)}select * from api.save_intake_revision(${literal(ids.tenant)},${literal(ids.profile)},1,null,'{"experience":"After"}',null,null,${literal(randomUUID())});`
    :winner==='assistance_revocation'
      ?`select 1 from app.intake_profiles where id=${literal(ids.profile)} for update;update app.acting_delegations set revoked_at=statement_timestamp() where id=${literal(ids.delegation)};`
      :winner==='native_session_revocation'
        ?`select 1 from app.intake_profiles where id=${literal(ids.profile)} for update;delete from auth.sessions where id=${literal(ids.owner)};`
        :`update app.seasons set status='closed',version=version+1 where id=${literal(ids.season)};`;
  let markReady;const ready=new Promise((resolve)=>{markReady=resolve;});
  const first=psql(`begin;${firstCommand}select 'RECONFIRMATION_LOCK_HELD';select pg_sleep(3);commit;`,markReady);
  await Promise.race([ready,first.then((result)=>{requireSuccess(result);throw new Error('Reconfirmation race missed its lock barrier.');})]);
  const started=Date.now(),second=await psql(`begin;${confirmation(winner==='assistance_revocation')}commit;`),waited=Date.now()-started;
  requireSuccess(await first);assert.ok(waited>=2500,'second session must actually wait on the winning transaction');
  const conflict=winner==='exact_confirmation'?null:winner==='answer_revision'?'STALE_VERSION':['assistance_revocation','native_session_revocation'].includes(winner)?'FORBIDDEN':'SEASON_NOT_OPEN';
  if(conflict){assert.notEqual(second.code,0);assert.ok(second.stderr.includes(conflict),'expected serialized conflict');}
  else requireSuccess(second);
  const readback=JSON.parse(requireSuccess(await psql(`select json_build_object(
    'receipts',(select count(*) from app.intake_reconfirmation_receipts where tenant_id=${literal(ids.tenant)}),
    'profile_version',(select version from app.intake_profiles where id=${literal(ids.profile)}),
    'answer_revision',(select current_revision from app.intake_profiles where id=${literal(ids.profile)}),
    'answer_versions',(select count(*) from app.intake_answers_versions where profile_id=${literal(ids.profile)}),
    'annually_confirmed',(select annual_confirmed_at is not null from app.intake_profiles where id=${literal(ids.profile)}),
    'item_state',(select state from app.season_reconfirmation_items where id=${literal(ids.item)}),
    'item_version',(select version from app.season_reconfirmation_items where id=${literal(ids.item)}),
    'annual_audits',(select count(*) from app.audit_events where tenant_id=${literal(ids.tenant)} and action='intake.annually_reconfirmed'),
    'annual_commands',(select count(*) from app.idempotency_records where tenant_id=${literal(ids.tenant)} and operation='confirm_intake_reconfirmation' and status='completed'),
    'processing_commands',(select count(*) from app.idempotency_records where tenant_id=${literal(ids.tenant)} and status='processing'),
    'obligations',(select count(*) from app.obligations where tenant_id=${literal(ids.tenant)}),
    'ledger_rows',(select count(*) from app.hour_ledger_entries where tenant_id=${literal(ids.tenant)}));`)));
  const confirmed=winner==='exact_confirmation',revised=winner==='answer_revision';
  assert.deepEqual(readback,{receipts:confirmed?1:0,profile_version:confirmed||revised?2:1,answer_revision:revised?2:1,answer_versions:revised?2:1,
    annually_confirmed:confirmed,item_state:confirmed?'confirmed':'open',item_version:confirmed?2:1,annual_audits:confirmed?1:0,
    annual_commands:confirmed?1:0,processing_commands:0,obligations:0,ledger_rows:0});
  scenarios.push({winner,contenders:2,waited_milliseconds:waited,conflict,readback,result:'PASS'});
}
console.log(JSON.stringify({scenario:'INTAKE_RECONFIRMATION_SERIALIZATION',scenarios,result:'PASS'}));
