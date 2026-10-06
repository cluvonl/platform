import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const databaseUrl = process.env.DATABASE_URL;
const target = new URL(databaseUrl ?? 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55322' || target.pathname !== '/postgres') throw new Error('Disposable cluvo-local DATABASE_URL required.');
const ids = new Map();
const replaceId = (oldId) => {if (!ids.has(oldId)) ids.set(oldId,randomUUID()); return ids.get(oldId);};
const fixture = readFileSync('supabase/fixtures/core-v1.sql','utf8').replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g,replaceId)
  .replace(/([a-z-]+)@example\.test/g,(_,local)=>`${local}-${randomUUID()}@example.test`)
  .replace(/'club-([ab])'/g,(_,suffix)=>`'race-${randomUUID()}-${suffix}'`);
const id = (oldId) => {assert.ok(ids.has(oldId)); return `'${ids.get(oldId)}'`;};
function psql(sql, name) {
  return new Promise((resolve,reject)=>{
    const child=spawn('psql',['--no-psqlrc','--set','ON_ERROR_STOP=1','--tuples-only','--no-align','--dbname',databaseUrl],{env:{...process.env,PGAPPNAME:name},stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',(chunk)=>{stdout+=chunk;});child.stderr.on('data',(chunk)=>{stderr+=chunk;});child.on('error',reject);child.on('exit',(code)=>resolve({code,stdout,stderr}));child.stdin.end(sql);
  });
}
function success(result,label) {assert.equal(result.code,0,`${label}: ${result.stderr}`);return result.stdout.trim();}
const tenant=id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),profile=id('a4000000-0000-4000-8000-000000000002'),actor=id('22222222-2222-4222-8222-222222222222'),executor=id('a1000000-0000-4000-8000-000000000002'),obligation=id('a6000000-0000-4000-8000-000000000001'),shift=id('aa200000-0000-4000-8000-000000000001'),position=id('aa210000-0000-4000-8000-000000000002');
success(await psql(`begin; ${fixture}
update auth.users set email_confirmed_at=statement_timestamp() where id in (select auth_user_id from app.tenant_memberships where tenant_id=${tenant});
insert into auth.sessions(id,user_id,created_at,updated_at) select auth_user_id,auth_user_id,statement_timestamp(),statement_timestamp() from app.tenant_memberships where tenant_id=${tenant};
commit;`,'cluvo-intake-race-fixture'),'fixture');
const holderName=`cluvo-intake-holder-${randomUUID().slice(0,8)}`;
const auth=`set local role authenticated; set local request.jwt.claim.sub=${actor}; select set_config('request.jwt.claims',jsonb_build_object('sub',${actor}::uuid,'session_id',${actor}::uuid,'role','authenticated')::text,true);`;
const holder=psql(`begin; ${auth} select * from api.save_intake_revision(${tenant},${profile},1,180,'{"schema_version":2,"unavailability":["2027-02-01"]}',null,null,'${randomUUID()}'); select pg_sleep(3); commit;`,holderName);
let ready=false;
for(let attempt=0;attempt<50;attempt++) {
  const result=success(await psql(`select count(*) from pg_stat_activity where application_name='${holderName}' and wait_event='PgSleep';`,'cluvo-intake-race-probe'),'holder probe');
  if(result==='1'){ready=true;break;}
  await new Promise((resolve)=>setTimeout(resolve,50));
}
assert.ok(ready,'holder saved dates and retains the executor lock');
const started=performance.now();
const waiter=await psql(`begin; ${auth} select * from api.book_shift(${tenant},${shift},${position},${executor},${obligation},1,'${randomUUID()}'); commit;`,'cluvo-intake-booking-waiter');
const waited=Math.round(performance.now()-started);
success(await holder,'holder');assert.notEqual(waiter.code,0);assert.match(waiter.stderr,/NOT_ELIGIBLE/);assert.ok(waited>=1500 && waited<8000);
assert.equal(success(await psql(`select count(*) from app.bookings where tenant_id=${tenant} and position_id=${position};`,'cluvo-intake-race-readback'),'booking readback'),'0');
assert.equal(success(await psql(`select count(*) from app.unavailability_periods where tenant_id=${tenant} and source_intake_profile_id=${profile};`,'cluvo-intake-race-readback'),'availability readback'),'1');
console.log(JSON.stringify({scenario:'INTAKE_UNAVAILABILITY_BOOKING_SERIALIZATION',contenders:2,waited_milliseconds:waited,conflict:'NOT_ELIGIBLE',persisted_bookings:0,result:'PASS'}));
