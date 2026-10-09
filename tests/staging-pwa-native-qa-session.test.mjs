import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {spawnSync} from 'node:child_process';
import {NativeQaSession,authorizeNativeQaProvider} from '../scripts/staging-pwa-native-qa-session.mjs';

const context=Object.freeze({sourceSha:'a'.repeat(40),workflowRunId:'12345',actor:'cluvo-test',projectRef:'fbozlbgmktkgcdfqdaaz',environment:'staging'});

test('actual private Python QA owner checks source pins, parameter isolation, dynamic guards, commits and finite protocol',()=>{
 const result=spawnSync('/usr/bin/python3',['-B',new URL('./helpers/staging-pwa-native-qa-session-tests.py',import.meta.url).pathname],{
  env:{PATH:'/usr/bin:/bin',PWA_NATIVE_QA_TEST_NODE:process.execPath},encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,'PRIVATE_PYTHON_QA_OWNER_TEST_FAILED');
});
function fixture(){
 const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
 const requests=[];let pending='';child.stdin.on('data',bytes=>{pending+=bytes;const end=pending.indexOf('\n');if(end>=0){requests.push(JSON.parse(pending.slice(0,end)));pending=pending.slice(end+1);}});
 child.kill=()=>{queueMicrotask(()=>child.emit('close',1));};
 const owner=new NativeQaSession(child,context);
 const respond=value=>{const request=requests.at(-1);child.stdout.write(JSON.stringify({id:request.id,ok:true,value})+'\n');};
 return {owner,child,requests,respond};
}

test('caller-created instances and JSON authority fail before provider work or database requests',async()=>{
 const {owner,child,requests}=fixture();
 await assert.rejects(authorizeNativeQaProvider(owner,context),{code:'STAGING_NATIVE_QA_OWNER_REQUIRED'});
 await assert.rejects(authorizeNativeQaProvider({...context,authorized:true},context),{code:'STAGING_NATIVE_QA_OWNER_REQUIRED'});
 assert.equal(requests.length,0);child.emit('close',0);await owner.close();
});

test('production, main, another project and missing workflow context fail before child spawn',async()=>{
 const env={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_SHA:context.sourceSha,RELEASE_SHA:context.sourceSha,STAGING_SUPABASE_PROJECT_REF:context.projectRef,
  SUPABASE_URL:'https://'+context.projectRef+'.supabase.co',MIGRATION_DATABASE_URL:'private-placeholder',GITHUB_RUN_ID:'12345',GITHUB_ACTOR:'cluvo-test'};
 for(const change of [{APP_ENV:'production'},{GITHUB_REF:'refs/heads/main'},{STAGING_SUPABASE_PROJECT_REF:'anotherproject'},{GITHUB_ACTOR:''}])
  await assert.rejects(NativeQaSession.connect({...env,...change}));
});

test('the barrier protocol sends only finite operations and never accepts caller SQL',async()=>{
 const {owner,child,requests,respond}=fixture();
 for(const [name,operation,value]of [['holdLastPosition','hold_last_position',{holder_ready:true}],['countBlocked','count_blocked',{blocked_contenders:2}],['releaseHolder','release_holder',{holder_released:true}],['scopedAutomationProof','scoped_automation_proof',{rollback_verified:true}]]){
  const promise=owner[name]();assert.deepEqual(requests.at(-1),{id:requests.length,operation,argument:null});respond(value);assert.deepEqual(await promise,value);
 }
 assert.equal('run' in owner,false);assert.equal('query' in owner,false);assert.equal('execute' in owner,false);
 child.emit('close',0);await owner.close();
});

test('unexpected stderr and malformed or unsolicited replies close the private process without exporting their text',async()=>{
 for(const kind of ['stderr','malformed','wrong_id','unsolicited']){
  const {owner,child}=fixture();let pending;
  if(kind!=='unsolicited')pending=owner.preflight();
  if(kind==='stderr')child.stderr.write('private_provider_identity@example.test');
  if(kind==='malformed')child.stdout.write('private_provider_identity\n');
  if(kind==='wrong_id')child.stdout.write(JSON.stringify({id:999,ok:true,value:'private_provider_identity'})+'\n');
  if(kind==='unsolicited')child.stdout.write(JSON.stringify({id:1,ok:true,value:'private_provider_identity'})+'\n');
  if(pending)await assert.rejects(pending,error=>{assert.match(error.code,/^STAGING_NATIVE_QA_/);assert.equal(JSON.stringify(error).includes('private_provider_identity'),false);return true;});
  await owner.close();
 }
});
