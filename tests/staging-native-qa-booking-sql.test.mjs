import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {buildStagingNativeQaBooking} from '../scripts/staging-native-qa-booking.mjs';

const local=process.env.CLUVO_QA_BARRIER_SQL_TESTS==='local-fixture';
const target='supabase_db_cluvo-local';
const recipe=buildStagingNativeQaBooking({actorA:'a1000000-0000-4000-8000-000000000001',
 actorB:'a1000000-0000-4000-8000-000000000002',sourceSha:'a'.repeat(40),workflowRunId:'42',actor:'barrier-test',expectedVersion:0});
// The authenticator uses the public disposable CLI database default over TCP.
// No hosted DSN, application credential or generated password is accepted.
const command=role=>['exec','-i',...(role==='authenticator'?['--env','PGPASSWORD=postgres']:[]),target,
 'psql','-X','-qAt',...(role==='authenticator'?['-h','127.0.0.1']:[]),'-U',role,'-d','postgres','--set=ON_ERROR_STOP=1'];
function root(sql){
 const result=spawnSync('docker',command('supabase_admin'),{input:'SET client_min_messages=warning;'+sql,encoding:'utf8',timeout:10000});
 assert.equal(result.status,0,'local barrier setup/cleanup failed; diagnostics withheld');
 return result.stdout.trim();
}
function session(role){
 const child=spawn('docker',command(role));let buffer='',pending,failed=false;
 const exited=new Promise(resolve=>child.once('close',status=>{failed=!!status;pending?.reject(Error('LOCAL_BARRIER_SESSION_CLOSED'));resolve(status);}));
 child.stderr.on('data',()=>{failed=true;});
 child.stdout.on('data',chunk=>{
  buffer+=chunk;
  if(!pending)return;
  const end=buffer.indexOf(pending.marker+'\n');if(end<0)return;
  const value=buffer.slice(0,end);buffer=buffer.slice(end+pending.marker.length+1);
  const request=pending;pending=undefined;clearTimeout(request.timer);
  if(failed)request.reject(Error('LOCAL_BARRIER_SQL_FAILED'));else request.resolve(value.trim());
 });
 const query=sql=>new Promise((resolve,reject)=>{
  assert.equal(pending,undefined);
  const marker='cluvo_barrier_'+randomBytes(8).toString('hex');
  pending={marker,resolve,reject,timer:setTimeout(()=>{pending=undefined;child.kill('SIGKILL');reject(Error('LOCAL_BARRIER_TIMEOUT'));},10000)};
  child.stdin.write(sql+'\n\\echo '+marker+'\n');
 });
 return {query,close:async()=>{child.stdin.end('\\q\n');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);
  try{assert.equal(await exited,0,'local barrier session cleanup failed');}finally{clearTimeout(timer);}}};
}

test('actual overlap is visible without pg_read_all_stats or another role’s query/state fields', {skip:!local},async()=>{
 const suffix=randomBytes(12).toString('hex'),schema='cluvo_qa_barrier_'+suffix,observer='cluvo_qa_observer_'+suffix;
 const table='"'+schema+'".capacity';let owner,a,b,setup=false,waiting,held=false;
 try{
  const profile=JSON.parse(root("SELECT json_build_object('version',current_setting('server_version_num')::int,'fixture_history',(SELECT count(*) FROM supabase_migrations.schema_migrations));"));
  assert.deepEqual(profile,{version:170011,fixture_history:16});
  root('BEGIN;CREATE ROLE "'+observer+'" NOLOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS;CREATE SCHEMA "'+schema+'";'+
   'CREATE TABLE '+table+'(id integer PRIMARY KEY,attempts integer NOT NULL);INSERT INTO '+table+' VALUES(1,0);'+
   'GRANT USAGE ON SCHEMA "'+schema+'" TO "'+observer+'",authenticator;GRANT SELECT,UPDATE ON TABLE '+table+' TO "'+observer+'",authenticator;COMMIT;');setup=true;
  owner=session('supabase_admin');await owner.query('SET SESSION AUTHORIZATION "'+observer+'";');
  a=session('authenticator');b=session('authenticator');
  const visibility=JSON.parse(await owner.query("SELECT json_build_object('superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'read_all_stats',pg_has_role(current_user,'pg_read_all_stats','USAGE'));"));
  assert.deepEqual(visibility,{superuser:false,read_all_stats:false});
  await owner.query('BEGIN;SELECT true FROM '+table+' WHERE id=1 FOR UPDATE;');held=true;
  const requests=[a,b].map(client=>client.query('BEGIN;UPDATE '+table+' SET attempts=attempts+1 WHERE id=1 RETURNING true;COMMIT;'));
  waiting=Promise.allSettled(requests);
  let observed=0;const deadline=Date.now()+4000;
  while(Date.now()<deadline){
   observed=JSON.parse(await owner.query(recipe.blockingSql)).blocked_contenders;
   if(observed===2)break;await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(observed,2);
  const masked=JSON.parse(await owner.query("SELECT json_build_object('private_queries_hidden',bool_and(query IS NULL OR query='<insufficient privilege>'),'private_states_hidden',bool_and(state IS NULL)) FROM pg_stat_activity WHERE usename='authenticator' AND pid IN(SELECT pid FROM pg_locks WHERE NOT granted);"));
  assert.deepEqual(masked,{private_queries_hidden:true,private_states_hidden:true});
  await owner.query('COMMIT;');held=false;
  assert.ok((await waiting).every(result=>result.status==='fulfilled'&&result.value==='t'));
 }finally{
  if(owner&&held)try{await owner.query('ROLLBACK;');}catch{}
  if(waiting)await waiting;
  const shutdown=await Promise.allSettled([owner,a,b].filter(Boolean).map(client=>client.close()));
  if(setup){
   const owned=JSON.parse(root("SELECT json_build_object('schema_owned',EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='"+schema+"' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='"+schema+"'));"));
   assert.deepEqual(owned,{schema_owned:true,tables:1});
   root('DROP SCHEMA "'+schema+'" CASCADE;DROP ROLE "'+observer+'";');
   const absent=JSON.parse(root("SELECT json_build_object('schema_absent',NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='"+schema+"'),'observer_absent',NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='"+observer+"'));"));
   assert.deepEqual(absent,{schema_absent:true,observer_absent:true});
  }
  assert.ok(shutdown.every(result=>result.status==='fulfilled'),'local barrier session cleanup failed');
 }
});
