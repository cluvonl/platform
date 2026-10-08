import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PrivateBridge,BridgeError,sourceBindingForCollector,validatedConnectionEnvironment} from '../scripts/staging-session-bridge.mjs';
const pin='165057532a551de35f947d131b284b6116e2a9192ff47bf8d01c5a900977def2';
const ca=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const bridge=fileURLToPath(new URL('../scripts/staging_session_bridge.py',import.meta.url));
const environment=()=>({APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-test-only@db.fbozlbgmktkgcdfqdaaz.supabase.co:5432/postgres?sslmode=verify-full',MIGRATION_SSL_ROOT_CERT_PATH:ca});
const transport=()=>({client_tls:true,client_tls_protocol:'TLSv1.3',libpq_version:160015,postgres_version:170011,scope:'HOSTED_VERIFY_FULL'});
const code=expected=>e=>e instanceof BridgeError&&e.code===expected;
function syntheticProcess(measurement=transport(),hooks={}){
 const child=new EventEmitter(),requests=[];child.stdout=new PassThrough();child.stderr=new PassThrough();let closed=false;
 const close=()=>{if(!closed){closed=true;queueMicrotask(()=>child.emit('close',0,null));}};
 child.kill=()=>{close();return true;};
 child.stdin=new Writable({write(chunk,_encoding,done){
  const request=JSON.parse(chunk);requests.push(request.operation);hooks.onRequest?.(request,child);
  const value=request.operation==='connect'?measurement:request.operation==='close'?{closed:true}:request.operation==='capture_query'||request.operation==='fresh_read_query'?[{command:'SELECT 1',rows:[['synthetic-only']]}]:{synthetic:true};
  queueMicrotask(()=>{child.stdout.write(JSON.stringify({id:request.id,ok:true,value})+'\n');hooks.afterResponse?.(request,child);});done();
 }});
 child.stdin.on('finish',close);return{child,requests,isClosed:()=>closed};
}
test('module/source pins and import do not invoke default spawn',async()=>{
 const source=await readFile(bridge);assert.equal(createHash('sha256').update(source).digest('hex'),pin);
 assert.equal(Object.isFrozen(PrivateBridge.prototype),true);
});
test('ordinary duck/prototype/serialized properties cannot register source authority',()=>{
 for(const value of [{targetBinding:{projectRef:'fbozlbgmktkgcdfqdaaz'},transport:transport()},Object.create(PrivateBridge.prototype),null,{}])assert.throws(()=>sourceBindingForCollector(value),code('BRIDGE_SOURCE_REGISTRATION_REQUIRED'));
});
test('public constructor and public target fields do not register a connection',async()=>{
 const p=syntheticProcess(),s=new PrivateBridge(p.child,{projectRef:'fbozlbgmktkgcdfqdaaz'});
 assert.throws(()=>sourceBindingForCollector(s),code('BRIDGE_SOURCE_REGISTRATION_REQUIRED'));await s.close();assert.equal(p.isClosed(),true);
});
test('injected successful synthetic TLS response is never hosted source authority',async()=>{
 const p=syntheticProcess();let spawns=0;
 const s=await PrivateBridge.connect(environment(),pin,{spawnProcess:(program,args,options)=>{spawns++;assert.equal(program,'/usr/bin/python3');assert.deepEqual(args,['-B',bridge]);assert.equal(options.env.PGPASSWORD,'synthetic-test-only');assert.equal(options.env.PGSSLMODE,'verify-full');assert.equal(options.env.HOME,undefined);assert.equal(options.env.PGSERVICE,undefined);return p.child;}});
 assert.equal(spawns,1);assert.equal(Object.isExtensible(s),false);assert.throws(()=>sourceBindingForCollector(s),code('BRIDGE_SOURCE_REGISTRATION_REQUIRED'));
 assert.equal(Reflect.defineProperty(s,'captureQuery',{value:async()=>[]}),false);assert.equal(Reflect.defineProperty(PrivateBridge.prototype,'captureQuery',{value:async()=>[]}),false);
 await s.close();assert.throws(()=>sourceBindingForCollector(s),code('BRIDGE_SOURCE_REGISTRATION_REQUIRED'));assert.equal(p.isClosed(),true);
});
test('caller target/CA changes during filesystem await do not change derived process target',async()=>{
 const e=environment(),p=syntheticProcess();let observed;
 const promise=PrivateBridge.connect(e,pin,{spawnProcess:(_program,_args,options)=>{observed=options.env;return p.child;}});
 e.APP_ENV='production';e.MIGRATION_DATABASE_URL='invalid-private-test-only';e.MIGRATION_SSL_ROOT_CERT_PATH='/missing-synthetic-ca-only';
 const s=await promise;assert.equal(observed.PGHOST,'db.fbozlbgmktkgcdfqdaaz.supabase.co');assert.equal(observed.PGSSLROOTCERT,ca);await s.close();
});
test('environment getters and unreviewed bridge bytes are rejected before any spawn',async()=>{
 let calls=0;const spawnProcess=()=>{calls++;throw Error('not reached');};
 const e=environment();Object.defineProperty(e,'MIGRATION_DATABASE_URL',{get(){throw Error('private getter must not run');}});
 await assert.rejects(PrivateBridge.connect(e,pin,{spawnProcess}),code('BRIDGE_ENVIRONMENT_REQUIRED'));
 await assert.rejects(PrivateBridge.connect(environment(),'0'.repeat(64),{spawnProcess}),code('BRIDGE_SOURCE_HASH_REQUIRED'));assert.equal(calls,0);
});
test('transaction pooler and wrong project fail before process spawn',async()=>{
 let calls=0;const spawnProcess=()=>{calls++;throw Error('not reached');};
 for(const e of [{...environment(),MIGRATION_DATABASE_URL:environment().MIGRATION_DATABASE_URL.replace(':5432',':6543')},{...environment(),STAGING_SUPABASE_PROJECT_REF:'a'.repeat(20),SUPABASE_URL:'https://'+'a'.repeat(20)+'.supabase.co'}])await assert.rejects(PrivateBridge.connect(e,pin,{spawnProcess}),e=>e instanceof BridgeError);
 assert.equal(calls,0);
});
for(const [name,fields]of [['no TLS',{client_tls:false}],['wrong server',{postgres_version:170010}],['wrong scope',{scope:'LOCAL_ONLY'}],['wrong protocol',{client_tls_protocol:'TLSv1.1'}]])test('unverified '+name+' transport closes and cannot register',async()=>{
 const p=syntheticProcess({...transport(),...fields});await assert.rejects(PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child}),code('BRIDGE_TRANSPORT_UNVERIFIED'));assert.equal(p.isClosed(),true);
});
test('fresh-read phases are distinct and once-only on private IPC state',async()=>{
 const p=syntheticProcess(),s=await PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child});
 await assert.rejects(s.beginFreshRead(),code('FRESH_READ_PHASE_INVALID'));
 await s.beginCapture();await assert.rejects(s.freshReadQuery('select 1'),code('FRESH_READ_PHASE_INVALID'));
 await s.endCapture();await s.beginFreshRead();await s.freshReadQuery('select 1');await assert.rejects(s.captureQuery('select 1'),code('CAPTURE_PHASE_INVALID'));
 await s.endFreshRead();await assert.rejects(s.beginFreshRead(),code('FRESH_READ_PHASE_INVALID'));await assert.rejects(s.beginCapture(),code('CAPTURE_PHASE_INVALID'));
 await s.close();assert.deepEqual(p.requests,['connect','begin_capture','end_capture','begin_fresh_read','fresh_read_query','end_fresh_read','close']);
});
test('unsafe factory option getters and extra knobs fail without process',async()=>{
 let calls=0;const options={};Object.defineProperty(options,'spawnProcess',{get(){calls++;throw Error('not reached');}});
 await assert.rejects(PrivateBridge.connect(environment(),pin,options),code('BRIDGE_FACTORY_OPTIONS_INVALID'));
 await assert.rejects(PrivateBridge.connect(environment(),pin,{unapproved:true}),code('BRIDGE_FACTORY_OPTIONS_INVALID'));assert.equal(calls,0);
});
test('unreadable CA errors have fixed code and no private path/message',async()=>{
 await assert.rejects(validatedConnectionEnvironment({...environment(),MIGRATION_SSL_ROOT_CERT_PATH:'/missing-private-synthetic-fixture'}),e=>e instanceof BridgeError&&e.code==='BRIDGE_CA_INPUT_UNAVAILABLE'&&!e.message.includes('missing-private'));
});

for(const [label,after]of [['exit',child=>child.kill()],['stderr',child=>child.stderr.write('synthetic-only unexpected diagnostic')]])test('factory cannot resurrect after '+label+' during verified-input await',async()=>{
 const p=syntheticProcess(transport(),{afterResponse(request,child){if(request.operation==='connect')after(child);}});
 await assert.rejects(PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child}),e=>e instanceof BridgeError&&['BRIDGE_CONNECTION_CLOSED_DURING_VALIDATION','BRIDGE_CONNECTION_FAILED'].includes(e.code));
 assert.equal(p.isClosed(),true);
});
test('closing during an outstanding phase cannot enable a later query',async()=>{
 const p=syntheticProcess(),s=await PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child});
 const pending=s.beginCapture(),closing=s.close();
 await assert.rejects(pending,e=>e instanceof BridgeError&&['BRIDGE_PHASE_CLOSED','BRIDGE_CLOSED'].includes(e.code));await closing;
 await assert.rejects(s.captureQuery('select 1'),e=>e instanceof BridgeError);
 assert.equal(p.requests.includes('capture_query'),false);assert.throws(()=>sourceBindingForCollector(s),code('BRIDGE_SOURCE_REGISTRATION_REQUIRED'));
});
test('write-after-end stream errors are handled with fixed failure and owned close',async()=>{
 const p=syntheticProcess(),s=await PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child});await s.beginCapture();
 p.child.stdin.end();await assert.rejects(s.captureQuery('select 1'),e=>e instanceof BridgeError&&['BRIDGE_INPUT_FAILED','BRIDGE_CLOSED','BRIDGE_PHASE_CLOSED'].includes(e.code));
 await s.close();assert.equal(p.isClosed(),true);assert.throws(()=>sourceBindingForCollector(s),code('BRIDGE_SOURCE_REGISTRATION_REQUIRED'));
});

test('Python dispatch and bounds execute against the real protocol source without credentials or a database', async () => {
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync('/usr/bin/python3',['-B','tests/helpers/staging-session-bridge-tests.py'],{
  env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},encoding:'utf8',timeout:10_000,maxBuffer:64_000,
 });
 assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 12 tests/);assert.match(result.stderr,/\bOK\b/);
});

test('private provider errors retain only a fixed code and SQLSTATE and close the owned process',async()=>{
 const p=syntheticProcess(transport(),{onRequest(request,child){if(request.operation==='capture_query'){
  child.stdout.write(JSON.stringify({id:request.id,ok:false,code:'DATABASE_QUERY_FAILED',sqlstate:'25006'})+'\n');
 }}});
 const s=await PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child});await s.beginCapture();
 await assert.rejects(s.captureQuery('SELECT synthetic'),e=>e instanceof BridgeError&&e.code==='DATABASE_QUERY_FAILED'&&e.sqlstate==='25006');
 await s.close();assert.equal(p.isClosed(),true);
});

test('malformed UTF8, extra private fields and unsolicited partial frames cannot pass transport validation',async()=>{
 for(const raw of [Buffer.from([0xff,0x0a]),
  Buffer.from(JSON.stringify({id:1,ok:true,value:transport(),private:'synthetic-only'})+'\n'),
  Buffer.from(JSON.stringify({id:1,ok:true,value:transport()})+'\nextra')]){
  const p=syntheticProcess(transport(),{onRequest(request,child){if(request.operation==='connect')child.stdout.write(raw);}});
  await assert.rejects(PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child}),e=>e instanceof BridgeError);
  assert.equal(p.isClosed(),true);
 }
});

test('split UTF8 is decoded without changing a private result',async()=>{
 const p=syntheticProcess(),s=await PrivateBridge.connect(environment(),pin,{spawnProcess:()=>p.child});await s.beginCapture();
 // Use the actual parser with a caller-created process: never hosted authority.
 const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();
 c.kill=()=>{queueMicrotask(()=>c.emit('close',0,null));return true;};
 c.stdin=new Writable({write(chunk,_encoding,done){const r=JSON.parse(chunk);const raw=Buffer.from(JSON.stringify({id:r.id,ok:true,value:'€'})+'\n');
  const start=raw.indexOf(Buffer.from('€'));queueMicrotask(()=>{c.stdout.write(raw.subarray(0,start+1));c.stdout.write(raw.subarray(start+1));});done();}});
 c.stdin.on('finish',()=>c.kill());
 const parser=new PrivateBridge(c,{});assert.equal(await parser.checkLock(),'€');await parser.close();await s.close();
});

test('close starts its termination deadline before waiting for an unresponsive child reply',async()=>{
 const {spawn}=await import('node:child_process');
 const child=spawn(process.execPath,['-e',"process.stdin.resume();setInterval(()=>{},1000)"],{env:{},stdio:['pipe','pipe','pipe']});
 const s=new PrivateBridge(child,{}),started=Date.now();await s.close();
 assert.ok(Date.now()-started<5_000);assert.equal(child.signalCode,'SIGKILL');
});
