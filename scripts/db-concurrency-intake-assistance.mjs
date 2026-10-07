import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';

const databaseUrl=process.env.DATABASE_URL;
const target=new URL(databaseUrl ?? 'http://invalid');
if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55322'||target.pathname!=='/postgres') throw new Error('Disposable cluvo-local DATABASE_URL required.');
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
function psql(query,ready) {
  return new Promise((resolve,reject)=>{
    const child=spawn('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--dbname',databaseUrl],{stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.includes('ASSISTANCE_LOCK_HELD'))ready?.();});
    child.stderr.on('data',chunk=>{stderr+=chunk;});child.on('error',reject);
    child.on('exit',code=>resolve({code,stdout,stderr}));child.stdin.end(query);
  });
}
function success(result){assert.equal(result.code,0,'Local assistance race SQL must succeed; private input withheld.');return result.stdout.trim();}
const scenarios=[];
for(const winner of ['exact_grant','competing_grants','reviewer_revocation','native_revocation','revoke_vs_save']) {
  const ids=new Map(),emails=new Map();
  const fixture=readFileSync('supabase/fixtures/core-v1.sql','utf8')
    .replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g,old=>{if(!ids.has(old))ids.set(old,randomUUID());return ids.get(old);})
    .replace(/([a-z-]+)@example\.test/g,(_,local)=>{const email=`${local}-${randomUUID()}@example.test`;emails.set(local,email);return email;})
    .replace(/'club-([ab])'/g,(_,suffix)=>`'assistance-${randomUUID()}-${suffix}'`);
  const id=old=>{assert.ok(ids.has(old));return ids.get(old);},q=old=>literal(id(old));
  const tenant=q('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),household=q('a3000000-0000-4000-8000-000000000001');
  const profile=q('a4000000-0000-4000-8000-000000000002'),person=q('a1000000-0000-4000-8000-000000000002');
  const helper=q('a1000000-0000-4000-8000-000000000001'),reviewerPerson=q('a1000000-0000-4000-8000-000000000003');
  const reviewer=id('33333333-3333-4333-8333-333333333333'),scope=literal(randomUUID()),key=literal(randomUUID());
  const until=literal(new Date(Date.now()+30*86_400_000).toISOString());
  const actor=(uid,email)=>`set local role authenticated;select set_config('request.jwt.claim.sub',${literal(uid)},true);select set_config('request.jwt.claims',${literal(JSON.stringify({sub:uid,email,role:'authenticated',session_id:uid}))},true);`;
  const review=actor(reviewer,emails.get('coordinator'));
  success(await psql(`begin;${fixture}
    update auth.users set email_confirmed_at=statement_timestamp() where id in (${[...['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'].map(q)].join(',')});
    insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,statement_timestamp(),statement_timestamp() from auth.users where id in (${[...['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'].map(q)].join(',')});
    insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,household_id,starts_at,granted_by_auth_user_id)
      values(${scope},${tenant},${literal(reviewer)},(select id from app.permission_roles where tenant_id=${tenant} and role_key='volunteer_committee'),'household',${household},statement_timestamp()-interval '1 day',${literal(reviewer)});
    commit;`));
  const grant=(selected=helper,requestKey=key)=>`${review}select * from api.grant_intake_assistance(${tenant},${household},${profile},${selected},1,${until},'Synthetic explicit support',${requestKey});`;
  let firstCommand,secondCommand,conflict;
  if(winner==='revoke_vs_save') {
    success(await psql(`begin;${grant()}commit;`));
    const delegation=success(await psql(`select id from app.acting_delegations where tenant_id=${tenant};`));assert.match(delegation,/^[a-f0-9-]{36}$/);
    firstCommand=`${review}select * from api.revoke_intake_assistance(${tenant},${literal(delegation)},2,1,'Synthetic support ended',${literal(randomUUID())});`;
    secondCommand=`${actor(id('11111111-1111-4111-8111-111111111111'),emails.get('ouder-a'))}select * from api.save_intake_revision(${tenant},${profile},1,180,'{"experience":"Queued assistance"}',${person},'Synthetic concurrent support',${literal(randomUUID())});`;
    conflict='FORBIDDEN';
  } else {
    firstCommand=winner==='exact_grant'||winner==='competing_grants'?grant():`select 1 from app.intake_profiles where tenant_id=${tenant} and id=${profile} for update;${winner==='reviewer_revocation'?`update app.access_grants set revoked_at=statement_timestamp() where id=${scope};`:`delete from auth.sessions where id=${literal(reviewer)};`}`;
    secondCommand=winner==='competing_grants'?grant(reviewerPerson,literal(randomUUID())):grant();
    conflict=winner==='exact_grant'?null:winner==='competing_grants'?'STALE_VERSION':'FORBIDDEN';
  }
  let markReady;const ready=new Promise(resolve=>{markReady=resolve;});
  const first=psql(`begin;${firstCommand}select 'ASSISTANCE_LOCK_HELD';select pg_sleep(3);commit;`,markReady);
  await Promise.race([ready,first.then(result=>{success(result);throw new Error('Assistance race missed its lock barrier.');})]);
  const started=Date.now(),second=await psql(`begin;${secondCommand}commit;`),waited=Date.now()-started;
  success(await first);assert.ok(waited>=2500,'second transaction really waits for the profile lock');
  if(conflict){assert.notEqual(second.code,0);assert.ok(second.stderr.includes(conflict),'expected serialized denial');}else success(second);
  const readback=JSON.parse(success(await psql(`select json_build_object(
    'delegations',(select count(*) from app.acting_delegations where tenant_id=${tenant}),
    'decisions',(select count(*) from app.intake_assistance_decisions where tenant_id=${tenant}),
    'household_version',(select version from app.households where id=${household}),
    'profile_version',(select version from app.intake_profiles where id=${profile}),
    'answer_revision',(select current_revision from app.intake_profiles where id=${profile}),
    'assistance_audits',(select count(*) from app.audit_events where tenant_id=${tenant} and action in ('intake.assistance_granted','intake.assistance_revoked')),
    'processing_commands',(select count(*) from app.idempotency_records where tenant_id=${tenant} and status='processing'),
    'confirmed_minutes',(select sum(minutes_delta) from app.hour_ledger_entries where tenant_id=${tenant}));`)));
  const grants=['exact_grant','competing_grants','revoke_vs_save'].includes(winner)?1:0,decisions=winner==='revoke_vs_save'?2:grants;
  assert.deepEqual(readback,{delegations:grants,decisions,household_version:1+decisions,profile_version:1,answer_revision:1,assistance_audits:decisions,processing_commands:0,confirmed_minutes:60});
  scenarios.push({winner,contenders:2,waited_milliseconds:waited,conflict,readback,result:'PASS'});
}
console.log(JSON.stringify({scenario:'INTAKE_ASSISTANCE_SERIALIZATION',fixture:'disposable SQL native-session contexts; no provider login claimed',scenarios,result:'PASS'}));
