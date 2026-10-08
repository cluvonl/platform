import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveInitialBackupKey,encryptedArtifactName,BackupCustodyError,INITIAL_BACKUP_KEY_PROFILE,readbackInitialArtifact} from '../scripts/staging-initial-backup-custody.mjs';

test('backup key is reproducible, domain separated and independently owned',()=>{
 const secret='synthetic-existing-invitation-root-only'.repeat(2);
 const a=deriveInitialBackupKey(secret),b=deriveInitialBackupKey(secret);
 assert.equal(a.length,32);assert.deepEqual(a,b);assert.notEqual(a.toString('hex'),Buffer.from(secret).subarray(0,32).toString('hex'));
 a.fill(0);assert.ok(b.some(byte=>byte!==0));assert.notDeepEqual(b,deriveInitialBackupKey(secret+'changed'));
 assert.equal(INITIAL_BACKUP_KEY_PROFILE,'cluvo-staging-initial16-backup-hkdf-sha256-v1');b.fill(0);
});
test('missing, short or multiline root is refused without disclosing value',()=>{
 for(const secret of [undefined,'short-private-fixture','x'.repeat(32)+'\n']){
  assert.throws(()=>deriveInitialBackupKey(secret),error=>error instanceof BackupCustodyError&&error.code==='INITIAL_BACKUP_ROOT_REQUIRED'&&!error.message.includes('private-fixture'));
 }
});
test('backup custody uses source/run/attempt and refuses names with a path',()=>{
 assert.equal(encryptedArtifactName('a'.repeat(40),'42','1'),'cluvo-staging-initial16-encrypted-'+'a'.repeat(40)+'-42-1');
 for(const args of [['../private','42','1'],['a'.repeat(40),'42','../1'],['a'.repeat(40),'0','1']]){
  assert.throws(()=>encryptedArtifactName(...args),/INITIAL_BACKUP_RUN_REQUIRED/);
 }
});

test('official multiline file-command output is parsed and bound to this workflow',async()=>{
 const {parseInitialArtifactOutput}=await import('../scripts/staging-initial-backup-custody.mjs');
 const delimiter='ghadelimiter_12345678-1234-1234-1234-123456789012';
 const entries={'artifact-id':'55','artifact-url':'https://github.com/cluvonl/platform/actions/runs/42/artifacts/55','artifact-digest':'a'.repeat(64)};
 const output=Buffer.from(Object.entries(entries).map(([key,value])=>`${key}<<${delimiter}\n${value}\n${delimiter}\n`).join(''));
 assert.deepEqual(parseInitialArtifactOutput(output,'42'),entries);
 assert.throws(()=>parseInitialArtifactOutput(output,'43'),/INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID/);
 for(const bad of [Buffer.concat([output,Buffer.from('artifact-id=55\n')]),Buffer.from(output.toString().replace('artifacts/55','artifacts/66')),Buffer.from(output.toString().replace(delimiter+'\nartifact-url','bad-delimiter\nartifact-url'))]){
  assert.throws(()=>parseInitialArtifactOutput(bad,'42'),/INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID/);
 }
});

function fixture(){
 const environment={GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'42',GITHUB_RUN_ATTEMPT:'2',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SERVER_URL:'https://github.com',GITHUB_TOKEN:'synthetic-private-readback-token'};
 const output=Buffer.from('artifact-id=55\nartifact-url=https://github.com/cluvonl/platform/actions/runs/42/artifacts/55\nartifact-digest='+'b'.repeat(64)+'\n');
 const remote={id:55,name:encryptedArtifactName(environment.GITHUB_SHA,'42','2'),expired:false,size_in_bytes:100,digest:'sha256:'+'b'.repeat(64),workflow_run:{id:42,head_sha:environment.GITHUB_SHA}};
 return {environment,output,remote};
}
const response=remote=>({status:200,json:async()=>remote});
function http(status){return {status,body:{cancel:async()=>{}},json:async()=>{throw new Error('error bodies must remain unread');}};}
const failed=(code,status=null)=>error=>error instanceof BackupCustodyError&&error.code===code&&error.httpStatus===status
 &&!error.message.includes('synthetic-private')&&!error.message.includes('github.com')&&!Object.hasOwn(error,'cause');

test('eventual visibility retries only fixed artifact GETs and returns a strict projection',async()=>{
 for(const status of [404,429,500,502,503,504]){
  const {environment,output,remote}=fixture(),calls=[],sleeps=[];
  remote.uploaded=true;remote.ddl_authorized=true;
  const receipt=await readbackInitialArtifact(output,environment,{fetcher:async(url,options)=>{
   calls.push({url,options});return calls.length===1?http(status):response(remote);
  },sleep:async delay=>{sleeps.push(delay);}});
  assert.equal(calls.length,2);assert.deepEqual(sleeps,[250]);
  assert.deepEqual(receipt,{remote_readback:true,artifact_id:'55',archive_sha256:'b'.repeat(64)});assert.ok(Object.isFrozen(receipt));
  assert.equal(Object.hasOwn(receipt,'uploaded'),false);assert.equal(Object.hasOwn(receipt,'ddl_authorized'),false);
  for(const {url,options} of calls){
   assert.equal(url,'https://api.github.com/repos/cluvonl/platform/actions/artifacts/55');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
   assert.equal(options.headers.Authorization,'Bearer '+environment.GITHUB_TOKEN);assert.ok(options.signal instanceof AbortSignal);
  }
 }
});

test('authorization and other permanent HTTP failures do not retry or disclose bodies',async()=>{
 for(const status of [400,401,403,408,410,422,301,302,307]){
  const {environment,output}=fixture();let calls=0,sleeps=0;
  await assert.rejects(readbackInitialArtifact(output,environment,{fetcher:async()=>{calls++;return http(status);},sleep:async()=>{sleeps++;}}),failed('INITIAL_BACKUP_REMOTE_READBACK_FAILED',status));
  assert.equal(calls,1);assert.equal(sleeps,0);
 }
});

test('invalid successful receipts block immediately after a transient response',async()=>{
 const changes=[{id:56},{name:'wrong-source-run-attempt'},{expired:true},{size_in_bytes:0},{digest:'sha256:'+'c'.repeat(64)},
  {workflow_run:{id:43,head_sha:'a'.repeat(40)}},{workflow_run:{id:42,head_sha:'c'.repeat(40)}}];
 for(const change of changes){
  const {environment,output,remote}=fixture();let calls=0,sleeps=0;
  await assert.rejects(readbackInitialArtifact(output,environment,{fetcher:async()=>{calls++;return calls===1?http(404):response({...remote,...change});},sleep:async()=>{sleeps++;}}),failed('INITIAL_BACKUP_REMOTE_RECEIPT_INVALID'));
  assert.equal(calls,2);assert.equal(sleeps,1);
 }
 const {environment,output}=fixture();let calls=0;
 await assert.rejects(readbackInitialArtifact(output,environment,{fetcher:async()=>{calls++;return {status:200,json:async()=>{throw new SyntaxError('private response');}};},sleep:async()=>assert.fail('invalid JSON cannot retry')}),failed('INITIAL_BACKUP_REMOTE_RECEIPT_INVALID',200));
 assert.equal(calls,1);
});

test('only native transient network causes retry; TLS and unknown errors fail closed',async()=>{
 for(const code of ['EAI_AGAIN','ECONNRESET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_BODY_TIMEOUT']){
  const {environment,output,remote}=fixture();let calls=0;
  const receipt=await readbackInitialArtifact(output,environment,{fetcher:async()=>{if(++calls===1)throw new TypeError('private fetch failure',{cause:{code}});return response(remote);},sleep:async()=>{}});
  assert.equal(calls,2);assert.equal(receipt.remote_readback,true);
 }
 for(const error of [new TypeError('private certificate',{cause:{code:'CERT_HAS_EXPIRED'}}),new TypeError('private fetch failure'),new Error('synthetic-private token in error')]){
  const {environment,output}=fixture();let calls=0;
  await assert.rejects(readbackInitialArtifact(output,environment,{fetcher:async()=>{calls++;throw error;},sleep:async()=>assert.fail('permanent network error cannot retry')}),failed('INITIAL_BACKUP_REMOTE_READBACK_FAILED'));
  assert.equal(calls,1);
 }
});

test('retry exhaustion has five requests and a bounded backoff without accepting JSON',async()=>{
 const {environment,output}=fixture();let calls=0;const sleeps=[];
 await assert.rejects(readbackInitialArtifact(output,environment,{fetcher:async()=>{calls++;return http(503);},sleep:async delay=>{sleeps.push(delay);}}),failed('INITIAL_BACKUP_REMOTE_READBACK_FAILED',503));
 assert.equal(calls,5);assert.deepEqual(sleeps,[250,500,1000,2000]);
 let elapsed=0,budgetCalls=0;
 await assert.rejects(readbackInitialArtifact(output,environment,{now:()=>elapsed,fetcher:async()=>{budgetCalls++;elapsed+=3000;return http(404);},sleep:async delay=>{elapsed+=delay;}}),failed('INITIAL_BACKUP_REMOTE_READBACK_FAILED',404));
 assert.equal(budgetCalls,4);assert.equal(elapsed,13750);assert.ok(elapsed<=15000);
 const {remote}=fixture();elapsed=0;
 await assert.rejects(readbackInitialArtifact(output,environment,{now:()=>elapsed,fetcher:async()=>{elapsed=15000;return response(remote);}}),failed('INITIAL_BACKUP_REMOTE_READBACK_FAILED',200));
});

test('the request timeout aborts and permits a bounded fresh request',async()=>{
 const {environment,output,remote}=fixture();let calls=0;const sleeps=[];
 const receipt=await readbackInitialArtifact(output,environment,{fetcher:async(url,{signal})=>{
  if(++calls!==1)return response(remote);
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('request timeout did not abort')),3500);
   signal.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});
  });
 },sleep:async delay=>{sleeps.push(delay);}});
 assert.equal(calls,2);assert.deepEqual(sleeps,[250]);assert.equal(receipt.remote_readback,true);
});

test('workflow, source, token and upload receipt are validated before any readback I/O',async()=>{
 const cases=[{GITHUB_SHA:'invalid'},{GITHUB_RUN_ID:'0'},{GITHUB_RUN_ATTEMPT:'0'},{GITHUB_REPOSITORY:'other/repo'},
  {GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SERVER_URL:'https://other.invalid'},{GITHUB_TOKEN:'private\nvalue'}];
 for(const change of cases){
  const {environment,output}=fixture();let calls=0;
  await assert.rejects(readbackInitialArtifact(output,{...environment,...change},{fetcher:async()=>{calls++;assert.fail('invalid context cannot fetch');}}),BackupCustodyError);
  assert.equal(calls,0);
 }
 const {environment,output}=fixture();let accesses=0;
 Object.defineProperty(environment,'GITHUB_TOKEN',{get(){accesses++;return 'private';}});
 await assert.rejects(readbackInitialArtifact(output,environment,{fetcher:async()=>assert.fail('accessor context cannot fetch')}),failed('INITIAL_BACKUP_READBACK_TOKEN_REQUIRED'));
 assert.equal(accesses,0);
 const valid=fixture();
 await assert.rejects(readbackInitialArtifact(Buffer.from('artifact-id=55\n'),valid.environment,{fetcher:async()=>assert.fail('invalid receipt cannot fetch')}),failed('INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID'));
});

test('receipt identity and authorization token remain pinned across asynchronous retries',async()=>{
 const {environment,output,remote}=fixture();let calls=0;
 await readbackInitialArtifact(output,environment,{fetcher:async(url,options)=>{
  assert.equal(url,'https://api.github.com/repos/cluvonl/platform/actions/artifacts/55');
  assert.equal(options.headers.Authorization,'Bearer synthetic-private-readback-token');
  if(++calls===1){environment.GITHUB_SHA='c'.repeat(40);environment.GITHUB_TOKEN='changed';return http(404);}return response(remote);
 },sleep:async()=>{}});
 assert.equal(calls,2);
});
