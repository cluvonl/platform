import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {capturePlan,captureWithOwnedWorker,IMAGE,WorkerError} from '../scripts/pg17-capture-worker.mjs';
import {capturePrivateOutput} from '../scripts/private-process-capture.mjs';
const ca=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const env=()=>({APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-fixture-only@db.fbozlbgmktkgcdfqdaaz.supabase.co:5432/postgres?sslmode=verify-full'});
const snapshot=()=>({backend_pid:42,backend_start:'2026-10-07 00:00:00+00',database:'postgres',primary:true,exported_snapshot:'00000003-00000001-1',visibility_snapshot:'1:2:'});
const safety=()=>({secret_named_settings:0,unknown_named_settings:0,subscriptions:0,foreign_servers:0,foreign_user_mappings:0,custom_tablespaces:0});
const code=expected=>e=>e instanceof WorkerError&&e.code===expected;
const makePlan=(kind='database',environment=env(),context=snapshot(),gate=safety())=>capturePlan(environment,context,gate,randomBytes(16).toString('hex'),kind);
async function scratch(t){const dir=await mkdtemp('/tmp/cluvo-pg17-worker-test-');await chmod(dir,0o700);t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
function fakeDocker(plan,{mode='success'}={}){
 const id='a'.repeat(64),imageId='sha256:'+'b'.repeat(64),calls=[];let exists=false,state='created';
 const missing=ref=>({status:1,stdout:'',stderr:'error: no such object: '+ref+'\n'});
 const object=()=>({id,name:'/'+plan.name,image:imageId,config_image:IMAGE,user:'postgres',label:plan.name,network:'bridge',ports:mode==='empty-port-map'?{}:mode==='published-port'?{'5432/tcp':[{HostPort:'5432'}]}:null,binds:null,
  mounts:[{Type:'bind',Source:ca,Destination:'/cluvo-ca.pem',RW:false}],configured_mounts:[{Type:'bind',Source:ca,Target:'/cluvo-ca.pem',ReadOnly:true}],
  volumes_from:null,privileged:false,readonly:true,log:'none',restart:'no',entrypoint:[plan.program],arguments:plan.arguments,state,exit:0});
 const control=async(args,environment)=>{
  calls.push(args.slice());
  if(args[0]==='image')return{status:0,stderr:'',stdout:JSON.stringify({id:imageId,digests:mode==='image-mismatch'?[]:[IMAGE]})};
  if(args[0]==='create'){
   assert.deepEqual(args,plan.create);assert.equal(environment.PGPASSWORD,'synthetic-fixture-only');assert.ok(!args.join(' ').includes(environment.PGPASSWORD));exists=true;
   return mode==='create-disconnected'?{status:1,stdout:'',stderr:'private simulated create interruption'}:{status:0,stdout:id+'\n',stderr:''};
  }
  if(args[0]==='rm'){
   assert.deepEqual(args,['rm','--force','--volumes',id]);
   if(mode==='remove-fail')return{status:1,stdout:'',stderr:'private simulated removal failure'};
   exists=false;return{status:0,stdout:id+'\n',stderr:''};
  }
  if(args[0]==='inspect'){
   const ref=args[1];if(!exists)return mode==='absence-unknown'?{status:1,stdout:'',stderr:'private daemon failure'}:missing(ref);
   if(args[3]==='{{.Id}}')return{status:0,stdout:id+'\n',stderr:''};
   const value=object();
   if(mode==='wrong-owner')value.label='unrelated-owner';
   if(mode==='writable-ca')value.mounts[0].RW=true;
   if(mode==='wrong-command')value.arguments=['--schema=app'];
   if(mode==='exit-not-proved'&&state==='exited')value.exit=1;
   return{status:0,stdout:JSON.stringify(value),stderr:''};
  }
  throw Error('Unexpected fake Docker operation');
 };
 const capture=async(command,args,environment,dir,name,bounds)=>{
  assert.equal(command,'/usr/bin/docker');assert.deepEqual(args,['--host','unix:///run/user/1001/docker.sock','start','--attach',id]);
  assert.equal(environment.PGPASSWORD,undefined);
  // Real bounded file/process capture, with synthetic stdout and no Docker call.
  const script=mode==='process-fail'?"process.stdout.write('partial');process.exitCode=1":"process.stdout.write('synthetic-complete-output')";
  const result=await capturePrivateOutput(process.execPath,['-e',script],{PATH:'/usr/bin:/bin'},dir,name,bounds);state='exited';return result;
 };
 return{control,capture,calls,exists:()=>exists};
}
test('private plan pins project, full PG17 dump, snapshot and CA without credential argv',async()=>{
 const p=await makePlan();assert.equal(p.program,'pg_dump');assert.ok(p.create.includes(IMAGE));assert.ok(p.arguments.includes('--snapshot=00000003-00000001-1'));
 assert.ok(p.arguments.includes('--large-objects'));assert.ok(!p.arguments.some(x=>/--(?:schema|table|no-owner|no-acl|exclude)/.test(x)));
 assert.equal(p.environment.PGSSLMODE,'verify-full');assert.equal(p.environment.PGPORT,'5432');assert.equal(p.environment.PGSSLROOTCERT,'/cluvo-ca.pem');
 assert.ok(p.environment.PGOPTIONS.includes('default_transaction_read_only=on'));assert.ok(!p.create.join(' ').includes(p.environment.PGPASSWORD));assert.ok(Object.isFrozen(p));
 const g=await makePlan('globals');assert.equal(g.program,'pg_dumpall');assert.deepEqual(g.arguments,['--globals-only','--no-role-passwords','--quote-all-identifiers','--no-password']);
});
test('target, transaction-pooler, snapshot and names-first config denials occur before worker action',async()=>{
 await assert.rejects(makePlan('database',{...env(),APP_ENV:'production'}),code('PG17_TARGET_REQUIRED'));
 await assert.rejects(makePlan('database',{...env(),MIGRATION_DATABASE_URL:env().MIGRATION_DATABASE_URL.replace('5432','6543')}),code('PG17_TARGET_REQUIRED'));
 await assert.rejects(makePlan('database',env(),{...snapshot(),exported_snapshot:'1;DROP DATABASE postgres'}),code('PG17_SNAPSHOT_REQUIRED'));
 await assert.rejects(makePlan('database',env(),snapshot(),{...safety(),secret_named_settings:1}),code('PG17_CONFIG_GATE_BLOCKED'));
 await assert.rejects(makePlan('database',env(),snapshot(),{...safety(),unknown_named_settings:1}),code('PG17_CONFIG_GATE_BLOCKED'));
});
test('unexpected input reflection errors are fixed without caller diagnostic text',async()=>{
 const hostile=new Proxy({}, {getPrototypeOf(){throw Error('private synthetic diagnostic');}});
 await assert.rejects(makePlan('database',hostile),error=>error instanceof WorkerError&&error.code==='PG17_CAPTURE_UNAVAILABLE'&&!error.message.includes('private'));
});
test('caller objects are captured before await and invented plan objects cannot authorize execution',async()=>{
 const e=env(),s=snapshot(),g=safety(),promise=makePlan('database',e,s,g);e.APP_ENV='production';s.exported_snapshot='bad';g.secret_named_settings=1;
 const p=await promise;assert.equal(p.arguments.at(-1),'--snapshot=00000003-00000001-1');
 let calls=0;await assert.rejects(captureWithOwnedWorker({...p},'/tmp',100,{control:async()=>{calls++;}}),code('PG17_PLAN_REQUIRED'));assert.equal(calls,0);
});
test('actual synthetic output is returned only after exact owned worker removal',async t=>{
 const dir=await scratch(t),p=await makePlan(),d=fakeDocker(p);
 const result=await captureWithOwnedWorker(p,dir,1024,d);assert.equal(result.worker_removed,true);assert.equal(d.exists(),false);assert.equal(result.unfiltered_database_dump_requested,true);
 assert.equal(await readFile(join(dir,p.file),'utf8'),'synthetic-complete-output');assert.equal(d.calls.filter(x=>x[0]==='rm').length,1);
});
test('Docker empty port map is accepted only as no published ports',async t=>{
 const dir=await scratch(t),p=await makePlan(),d=fakeDocker(p,{mode:'empty-port-map'});
 const result=await captureWithOwnedWorker(p,dir,1024,d);assert.equal(result.worker_removed,true);assert.equal(d.exists(),false);
});
for(const [mode,expected]of [['image-mismatch','PG17_IMAGE_PIN_UNPROVED'],['absence-unknown','PG17_NAME_NOT_PROVEN_UNUSED'],['published-port','PG17_WORKER_ISOLATION_UNKNOWN'],['create-disconnected','PG17_CREATE_FAILED'],['writable-ca','PG17_WORKER_ISOLATION_UNKNOWN'],['wrong-command','PG17_WORKER_ISOLATION_UNKNOWN'],['process-fail','CAPTURE_PROCESS_FAILED'],['exit-not-proved','PG17_WORKER_EXIT_UNPROVED'],['remove-fail','PG17_CAPTURE_CLEANUP_FAILED'],['wrong-owner','PG17_CAPTURE_CLEANUP_FAILED']]){
 test('worker failure '+mode+' never leaves successful output',async t=>{
  const dir=await scratch(t),p=await makePlan(),d=fakeDocker(p,{mode});await assert.rejects(captureWithOwnedWorker(p,dir,1024,d),code(expected));
  assert.deepEqual(await readdir(dir),[]);
  if(mode==='wrong-owner')assert.equal(d.calls.filter(x=>x[0]==='rm').length,0);
  if(!['remove-fail','wrong-owner'].includes(mode))assert.equal(d.exists(),false);
 });
}
