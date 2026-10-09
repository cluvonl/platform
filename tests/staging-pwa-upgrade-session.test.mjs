import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PwaUpgradeSession,PWA_UPGRADE_SESSION_CHILD_SHA256,sourceBindingForUpgradeCollector} from '../scripts/staging-pwa-upgrade-session.mjs';
import {sourceBindingForInitialCollector} from '../scripts/staging-initial-session.mjs';
import {sourceBindingForCollector} from '../scripts/staging-session-bridge.mjs';

const sourceSha='a'.repeat(40);
const environment={APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',
 MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-only@db.fbozlbgmktkgcdfqdaaz.supabase.co:5432/postgres?sslmode=verify-full',
 MIGRATION_SSL_ROOT_CERT_PATH:fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url)),
 GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:sourceSha,RELEASE_SHA:sourceSha,GITHUB_RUN_ID:'123',GITHUB_ACTOR:'upgrade-test'};
const context={actor:'upgrade-test',sourceSha,workflowRunId:'123',manifestSha256:'b'.repeat(64),backupArtifactId:'456',backupArtifactSha256:'c'.repeat(64)};
function processFixture(options={}){
 const child=new EventEmitter(),requests=[];child.stdout=new PassThrough();child.stderr=new PassThrough();let closed=false;
 const stop=()=>{if(!closed){closed=true;queueMicrotask(()=>child.emit('close',0,null));}};
 child.kill=()=>{stop();return true;};
 child.stdin=new Writable({write(raw,_encoding,done){
  const request=JSON.parse(raw);requests.push(request);
  const value=request.operation==='connect'?{scope:'HOSTED_VERIFY_FULL',client_tls:true,client_tls_protocol:'TLSv1.3',libpq_version:180006,postgres_version:170011}:
   request.operation==='read_upgrade_state'?{layout:{schemas:['api','app','internal'],app_objects:500},historyRows:Array(16).fill({}),sourceRows:Array(16).fill({}),upgradeRows:[]}:
   request.operation==='apply_upgrade'?{applied_prefix:request.argument.index+1,atomic_transaction_committed:!options.unconfirmed,exclusive_session_lock_retained:true}:{synthetic:true};
  queueMicrotask(()=>child.stdout.write(JSON.stringify({id:request.id,ok:true,value})+'\n'));done();
 }});
 child.stdin.on('finish',stop);
 return{child,requests,closed:()=>closed};
}
async function synthetic(options={}){
 const fixture=processFixture(options);let childEnvironment;
 const session=await PwaUpgradeSession.connect({...environment,...options.environment},PWA_UPGRADE_SESSION_CHILD_SHA256,{spawnProcess:(_command,_args,configuration)=>{childEnvironment=configuration.env;return fixture.child;}});
 return {session,fixture,childEnvironment};
}
async function fresh(session){await session.beginCapture();await session.endCapture();await session.beginFreshRead();await session.endFreshRead();}

test('actual child source pin matches; synthetic transports cannot register any source authority',async()=>{
 assert.equal(createHash('sha256').update(await readFile(new URL('../scripts/staging_pwa_upgrade_session.py',import.meta.url))).digest('hex'),PWA_UPGRADE_SESSION_CHILD_SHA256);
 const {session,fixture}=await synthetic();
 for(const reader of [sourceBindingForUpgradeCollector,sourceBindingForInitialCollector,sourceBindingForCollector])assert.throws(()=>reader(session));
 assert.ok(Object.isFrozen(PwaUpgradeSession.prototype)&&!Object.isExtensible(session));
 for(const forged of [{},Object.create(PwaUpgradeSession.prototype)])assert.throws(()=>sourceBindingForUpgradeCollector(forged));
 await session.close();assert.equal(fixture.closed(),true);
});

test('writer child environment excludes sender, provider, artifact and ambient process secrets',async()=>{
 const {session,childEnvironment}=await synthetic({environment:{STAGING_TEST_RECIPIENT:'synthetic@example.test',INVITATION_TOKEN_SECRET:'synthetic-root',GITHUB_TOKEN:'synthetic-token',LD_PRELOAD:'/synthetic',PGSERVICEFILE:'/synthetic',SUPABASE_SECRET_KEY:'synthetic-key'}});
 for(const key of ['STAGING_TEST_RECIPIENT','INVITATION_TOKEN_SECRET','GITHUB_TOKEN','LD_PRELOAD','PGSERVICEFILE','SUPABASE_SECRET_KEY'])assert.equal(Object.hasOwn(childEnvironment,key),false);
 assert.equal(childEnvironment.PGSSLMODE,'verify-full');assert.equal(childEnvironment.PWA_UPGRADE_NODE_EXECUTABLE,process.execPath);
 await session.close();
});

test('apply requires ended fresh read and fixed readback; wire writes contain only bounded receipt metadata',async()=>{
 const {session,fixture}=await synthetic();
 await assert.rejects(session.applyUpgrade(16,context));await assert.rejects(session.readUpgradeState());
 await fresh(session);await assert.rejects(session.applyUpgrade(16,context));
 await session.readUpgradeState();assert.equal((await session.applyUpgrade(16,context)).applied_prefix,17);
 const writes=fixture.requests.filter(r=>r.operation==='apply_upgrade');
 assert.equal(writes.length,1);assert.deepEqual(Object.keys(writes[0].argument).sort(),['actor','backup_artifact_id','backup_artifact_sha256','index','manifest_sha256','source_sha','workflow_run_id']);
 assert.equal(JSON.stringify(writes).includes('BEGIN'),false);
 assert.equal(typeof session.applyInitial,'undefined');assert.equal(typeof session.configureApi,'undefined');assert.equal(typeof session.bootstrapCore,'undefined');
 await session.close();
});

test('foreign release context, injected SQL, accessor and original16 index never dispatch an upgrade',async()=>{
 const {session,fixture}=await synthetic();await fresh(session);await session.readUpgradeState();
 for(const change of [{actor:'other'},{sourceSha:'b'.repeat(40)},{workflowRunId:'124'},{manifestSha256:'invalid'},
  {backupArtifactId:'0'},{backupArtifactSha256:'invalid'},{sql:'DELETE FROM auth.users'}])await assert.rejects(session.applyUpgrade(16,{...context,...change}));
 let accessed=false;const getter={...context};Object.defineProperty(getter,'actor',{get(){accessed=true;throw Error('private');}});
 await assert.rejects(session.applyUpgrade(16,getter));assert.equal(accessed,false);
 for(const index of [-1,0,15,64,16.5,'16'])await assert.rejects(session.applyUpgrade(index,context));
 assert.equal(fixture.requests.some(r=>r.operation==='apply_upgrade'),false);await session.close();
});

test('uncertain commit revokes the owner and cannot be retried on the same session',async()=>{
 const {session,fixture}=await synthetic({unconfirmed:true});await fresh(session);await session.readUpgradeState();
 await assert.rejects(session.applyUpgrade(16,context),{code:'PWA_UPGRADE_COMMIT_UNPROVED'});
 await assert.rejects(session.readUpgradeState());await assert.rejects(session.applyUpgrade(16,context));
 assert.equal(fixture.requests.filter(r=>r.operation==='apply_upgrade').length,1);await session.close();
});

test('nonstaging or untrusted workflow context is refused before process creation',async()=>{
 let calls=0;
 for(const change of [{APP_ENV:'production'},{GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'b'.repeat(40)},{GITHUB_ACTOR:'unsafe actor'}])
  await assert.rejects(PwaUpgradeSession.connect({...environment,...change},PWA_UPGRADE_SESSION_CHILD_SHA256,{spawnProcess:()=>{calls++;throw Error('unreachable');}}));
 assert.equal(calls,0);
});

test('actual Python additive owner enforces generator isolation, phase, transaction and closed protocol',()=>{
 const result=spawnSync('/usr/bin/python3',['-B','tests/helpers/staging-pwa-upgrade-session-tests.py'],{env:{PATH:'/usr/bin:/bin',PWA_UPGRADE_TEST_NODE:process.execPath},encoding:'utf8',timeout:20000,maxBuffer:128000});
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 6 tests/);assert.match(result.stderr,/\bOK\b/);
});
