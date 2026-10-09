import assert from 'node:assert/strict';
import test from 'node:test';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,chmodSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildStagingNativeQaBooking} from '../scripts/staging-pwa-native-qa-booking.mjs';
import {INITIAL_RESTORE_STARTUP} from '../scripts/staging-pwa-upgrade-restore.mjs';
import {NATIVE_QA_SESSION_CHILD_SHA256} from '../scripts/staging-pwa-native-qa-session.mjs';

const selected=process.env.CLUVO_PWA_ACTIVITY_CACHE_TESTS==='owned-pg17';
const root=fileURLToPath(new URL('../',import.meta.url));
const image='public.ecr.aws/supabase/postgres@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('actual PG17 private Python owner refreshes activity for new authenticator backends while preserving the holder',
 {skip:!selected,timeout:60000},async()=>{
 const name='cluvo-pwa-activity-cache-'+randomBytes(12).toString('hex');
 const directory=mkdtempSync(join(tmpdir(),'cluvo-pwa-activity-cache-'));
 const source='8762f2284eb980cdbe0d5478a533a6f893b5d409';
 const recipe=buildStagingNativeQaBooking({actorA:'a1000000-0000-4000-8000-000000000001',
  actorB:'a1000000-0000-4000-8000-000000000002',sourceSha:source,workflowRunId:'37888304288',actor:'owned-cache-proof',expectedVersion:0});
 const f=recipe.fixture;
 const run=(args,input)=>spawnSync('docker',args,{input,encoding:'utf8',timeout:20000,maxBuffer:1_000_000});
 const checked=(args,input)=>{const result=run(args,input);assert.equal(result.status,0,'OWNED_ACTIVITY_PROCESS_FAILED');return result.stdout.trim();};
 const sqlArgs=role=>['exec','-i',name,'psql','-X','-qAt','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/owned-socket','-U',role,'-d','postgres'];
 function transport(args,{sql=false,program='docker'}={}){
  const child=spawn(program,args,{env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});let buffer='',pending=null,failed=false;
  const closed=new Promise(resolve=>child.once('close',code=>{pending?.reject(Error('OWNED_ACTIVITY_SESSION_CLOSED'));resolve(code);}));
  child.stderr.on('data',()=>{failed=true;});
  child.stdout.on('data',bytes=>{buffer+=bytes;if(!pending)return;
   const separator=sql?pending.marker+'\n':'\n',index=buffer.indexOf(separator);if(index<0)return;
   const request=pending;pending=null;const result=buffer.slice(0,index).trim();buffer=buffer.slice(index+separator.length);clearTimeout(request.timer);
   if(failed)request.reject(Error('OWNED_ACTIVITY_RESPONSE_FAILED'));else try{request.resolve(sql?result:JSON.parse(result));}catch{request.reject(Error('OWNED_ACTIVITY_RESPONSE_INVALID'));}
  });
  const request=text=>new Promise((resolve,reject)=>{assert.equal(pending,null);const marker='owned_'+randomBytes(8).toString('hex');
   pending={resolve,reject,marker,timer:setTimeout(()=>{child.kill('SIGKILL');reject(Error('OWNED_ACTIVITY_TIMEOUT'));},10000)};
   if(text!==null)child.stdin.write(text+(sql?'\n\\echo '+marker:'')+'\n');
  });
  return {request,close:async()=>{child.stdin.end(sql?'\\q\n':'close\n');assert.equal(await closed,0,'OWNED_ACTIVITY_CLEANUP_FAILED');}};
 }
 let created=false,owner=null,a=null,b=null,waiting=null,held=false;
 const proof={scope:'LOCAL_OWNED_PG17_ACTUAL_PRIVATE_PYTHON_ACTIVITY_CACHE_REGRESSION',observed_at:new Date().toISOString(),
  baseline_source_sha:source,image,network:'none',actual_postgrest_http_used:false,synthetic_minimal_lock_fixture:true,
  native_python_owner_sha256:NATIVE_QA_SESSION_CHILD_SHA256,booking_recipe_sha256:hash(readFileSync(join(root,'scripts/staging-pwa-native-qa-booking.mjs'))),
  shared_database_touched:false,hosted_database_touched:false,providers_called:false,credentials_read:false,cases:[]};
 try{
  assert.equal(hash(readFileSync(join(root,'scripts/staging_pwa_native_qa_session.py'))),NATIVE_QA_SESSION_CHILD_SHA256);
  const socket=join(directory,'socket');mkdirSync(socket);chmodSync(socket,0o1777);writeFileSync(join(directory,'empty-passfile'),'',{mode:0o600});
  const startup=INITIAL_RESTORE_STARTUP.replace('-c unix_socket_directories=/restore -c unix_socket_permissions=0700','-c unix_socket_directories=/owned-socket -c unix_socket_permissions=0777');
  checked(['create','--name',name,'--label','cluvo.pwa.activity-cache-proof='+name,'--network=none','--user=postgres','--log-driver=none',
   '--tmpfs','/restore:rw,size=512m,mode=1777','--mount','type=bind,src='+socket+',dst=/owned-socket','--entrypoint=/bin/sh',image,'-c',startup,'cluvo-owned-cache-proof','supabase_admin']);created=true;checked(['start',name]);
  let ready=false;for(let i=0;i<60;i++){if(run(['exec',name,'pg_isready','-h','/owned-socket','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready);
  const shape=JSON.parse(checked(['inspect','--format','{"network":{{json .HostConfig.NetworkMode}},"ports":{{json .HostConfig.PortBindings}},"binds":{{json .HostConfig.Binds}}}',name]));
  assert.equal(shape.network,'none');assert.ok(shape.ports===null||Object.keys(shape.ports).length===0);assert.equal(shape.binds,null);
  checked(sqlArgs('supabase_admin'),`CREATE ROLE postgres LOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE authenticator LOGIN NOSUPERUSER NOBYPASSRLS;
   CREATE SCHEMA app AUTHORIZATION postgres;SET ROLE postgres;CREATE TABLE app.shifts(tenant_id uuid,id uuid PRIMARY KEY,state text,version bigint,attempts int DEFAULT 0);
   CREATE TABLE app.audit_events(id uuid,tenant_id uuid,action text);INSERT INTO app.shifts VALUES('${f.tenantA}','${f.shiftRace}','published',1,0);
   INSERT INTO app.audit_events VALUES('${f.qaBookingAudit}','${f.tenantA}','qa.booking_fixture_created');GRANT USAGE ON SCHEMA app TO authenticator;GRANT SELECT,UPDATE ON app.shifts TO authenticator;`);
  const profile=JSON.parse(checked(sqlArgs('postgres'),"SELECT jsonb_build_object('version',current_setting('server_version_num')::int,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'read_all_stats',pg_has_role(current_user,'pg_read_all_stats','USAGE'));"));
  assert.deepEqual(profile,{version:170011,superuser:false,read_all_stats:false});proof.observer=profile;
  for(const mode of ['default_cache','stats_fetch_consistency_none']){
   writeFileSync(join(directory,'recipe.json'),JSON.stringify({holderSql:mode==='default_cache'?recipe.holderSql:recipe.holderSql.replace('BEGIN READ WRITE;','BEGIN READ WRITE; SET LOCAL stats_fetch_consistency=none;'),blockingSql:recipe.blockingSql}));
   owner=transport(['-B',join(root,'tests/helpers/pwa-activity-cache-owner.py'),join(directory,'recipe.json'),socket],{program:'/usr/bin/python3'});
   assert.deepEqual(await owner.request(null),{holder_ready:true});held=true;
   assert.equal((await owner.request('cached_probe')).blocked_contenders,0);
   a=transport(sqlArgs('authenticator'),{sql:true});b=transport(sqlArgs('authenticator'),{sql:true});
   assert.notEqual(await a.request('SELECT pg_backend_pid();'),await b.request('SELECT pg_backend_pid();'));
   const waiter=`BEGIN;SELECT pg_advisory_xact_lock(94141414);UPDATE app.shifts SET attempts=attempts+1 WHERE id='${f.shiftRace}' RETURNING true;COMMIT;`;
   waiting=Promise.allSettled([a.request(waiter),b.request(waiter)]);await new Promise(resolve=>setTimeout(resolve,250));
   const cached=[];for(let i=0;i<3;i++)cached.push((await owner.request('cached_probe')).blocked_contenders);assert.deepEqual(cached,[0,0,0]);
   const fresh=[];for(let i=0;i<3;i++)fresh.push((await owner.request('fresh_probe')).blocked_contenders);assert.deepEqual(fresh,[2,2,2]);
   const status=await owner.request('status');assert.deepEqual(status,{same_backend:true,exclusive_lock_retained:true,holder_transaction_alive:true});
   proof.cases.push({mode,old_cached_probe_counts:cached,actual_fixed_python_probe_counts:fresh,...status,two_distinct_authenticator_backends:true,actual_row_and_advisory_blocking_chain:true});
   await owner.request('release');held=false;assert.ok((await waiting).every(result=>result.status==='fulfilled'));waiting=null;
   await owner.close();owner=null;await a.close();a=null;await b.close();b=null;
  }
  assert.equal(checked(sqlArgs('postgres'),`SELECT attempts FROM app.shifts WHERE id='${f.shiftRace}';`),'4');proof.released_contenders_completed=4;proof.passed=true;
 }finally{
  if(owner&&held)try{await owner.request('release');held=false;}catch{}
  if(waiting)await waiting;
  const closed=await Promise.allSettled([owner,a,b].filter(Boolean).map(value=>value.close()));proof.sessions_closed=closed.every(result=>result.status==='fulfilled');
  if(created){checked(['rm','-f',name]);proof.owned_container_removed=true;}rmSync(directory,{recursive:true,force:true});
  proof.completed_at=new Date().toISOString();
  if(process.env.CLUVO_PWA_ACTIVITY_CACHE_PROOF_PATH)writeFileSync(process.env.CLUVO_PWA_ACTIVITY_CACHE_PROOF_PATH,JSON.stringify(proof,null,2)+'\n');
 }
 assert.equal(proof.sessions_closed,true);assert.equal(proof.owned_container_removed,true);
});
