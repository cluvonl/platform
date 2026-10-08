import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {InitialSession,INITIAL_SESSION_CHILD_SHA256,sourceBindingForInitialCollector} from '../scripts/staging-initial-session.mjs';
import {sourceBindingForCollector} from '../scripts/staging-session-bridge.mjs';
const sourceSha='a'.repeat(40);
const environment={APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',
  SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',
  MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-only@db.fbozlbgmktkgcdfqdaaz.supabase.co:5432/postgres?sslmode=verify-full',
  MIGRATION_SSL_ROOT_CERT_PATH:fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url)),
  GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_SHA:sourceSha,RELEASE_SHA:sourceSha,GITHUB_RUN_ID:'123',GITHUB_ACTOR:'contract-test'};
const context={actor:'contract-test',sourceSha,workflowRunId:'123'};
const bootstrapReadback={scope:'STAGING_SYNTHETIC_CORE_V1',status:'created',fixture_version:1,
  ...Object.fromEntries(['tenants','member_grants','households','intake_profiles','seasons','obligations','bootstrap_audits','bootstrap_commands'].map(key=>[key,1])),
  current_ledger_entries:0,auth_mutations:false,mail_sent:false,native_session_proven:false,v1_ready:false,production_enabled:false,
  atomic_transaction_committed:true,exclusive_session_lock_retained:true};
function processFixture(options={}){
  const child=new EventEmitter(),requests=[];child.stdout=new PassThrough();child.stderr=new PassThrough();let closed=false;
  const stop=()=>{if(!closed){closed=true;queueMicrotask(()=>child.emit('close',0,null));}};
  child.kill=()=>{stop();return true;};
  child.stdin=new Writable({write(raw,_encoding,done){
    const request=JSON.parse(raw);requests.push(request);
    const value=request.operation==='connect'?{scope:'HOSTED_VERIFY_FULL',client_tls:true,client_tls_protocol:'TLSv1.3',libpq_version:180006,postgres_version:170011}:
      request.operation==='apply_initial'?{applied_prefix:request.argument.index+1,atomic_transaction_committed:true,exclusive_session_lock_retained:true}:
      request.operation==='read_initial_state'?{layout:{schemas:[],app_objects:0},historyRows:Array(options.initialPrefix??0).fill({}),sourceRows:Array(options.initialPrefix??0).fill({})}:
      request.operation==='configure_api'?{scope:'STAGING_API_EXPOSURE',api_schema_exposed:true,atomic_transaction_committed:true,exclusive_session_lock_retained:true,production_enabled:false,v1_ready:false}:
      request.operation==='bootstrap_core'?{...bootstrapReadback,...options.bootstrapReadback}:{synthetic:true};
    queueMicrotask(()=>child.stdout.write(JSON.stringify({id:request.id,ok:true,value})+'\n'));done();
  }});
  child.stdin.on('finish',stop);
  return{child,requests,closed:()=>closed};
}
async function synthetic(options={}){const fixture=processFixture(options);const session=await InitialSession.connect({...environment,...options.environment},INITIAL_SESSION_CHILD_SHA256,{spawnProcess:()=>fixture.child});return{session,fixture};}
async function fresh(session){await session.beginCapture();await session.endCapture();await session.beginFreshRead();await session.endFreshRead();}

test('fixed writer child hash matches actual source and injected transports never receive source authority',async()=>{
  assert.equal(createHash('sha256').update(await readFile(new URL('../scripts/staging_initial_session.py',import.meta.url))).digest('hex'),INITIAL_SESSION_CHILD_SHA256);
  const {session,fixture}=await synthetic();
  assert.throws(()=>sourceBindingForInitialCollector(session));
  assert.throws(()=>sourceBindingForCollector(session));
  assert.ok(Object.isFrozen(InitialSession.prototype)&&!Object.isExtensible(session));
  await session.close();assert.equal(fixture.closed(),true);
});

test('public construction, duck objects and prototype objects cannot register a writer source',async()=>{
  for(const value of [{},Object.create(InitialSession.prototype),{transport:{scope:'HOSTED_VERIFY_FULL'}}])assert.throws(()=>sourceBindingForInitialCollector(value));
  const fixture=processFixture(),session=new InitialSession(fixture.child,{});
  assert.throws(()=>sourceBindingForInitialCollector(session));await session.close();
});

test('apply and fixed readback require completed fresh transaction; wire writes contain finite metadata only',async()=>{
  const {session,fixture}=await synthetic();
  await assert.rejects(session.applyInitial(0,context));await assert.rejects(session.readInitialState());
  await fresh(session);
  assert.deepEqual(await session.readInitialState(),{layout:{schemas:[],app_objects:0},historyRows:[],sourceRows:[]});
  assert.equal((await session.applyInitial(0,context)).applied_prefix,1);
  await session.readInitialState();await session.applyInitial(1,context);
  const writes=fixture.requests.filter(request=>request.operation==='apply_initial');
  assert.deepEqual(writes.map(request=>request.argument.index),[0,1]);
  assert.deepEqual(Object.keys(writes[0].argument).sort(),['actor','index','source_sha','workflow_run_id']);
  assert.ok(!JSON.stringify(writes).includes('BEGIN'));
  await session.close();
});

test('foreign release context, unknown knobs, accessors and invalid indices never dispatch writes',async()=>{
  const {session,fixture}=await synthetic();await fresh(session);
  for(const changed of [{...context,actor:'other'},{...context,sourceSha:'b'.repeat(40)},
    {...context,workflowRunId:'124'},{...context,sql:'DELETE FROM auth.users'}])await assert.rejects(session.applyInitial(0,changed));
  let evaluated=false;const getter={...context};Object.defineProperty(getter,'actor',{get(){evaluated=true;throw Error('synthetic-only');}});
  await assert.rejects(session.applyInitial(0,getter));assert.equal(evaluated,false);
  for(const index of [-1,16,0.5,'0'])await assert.rejects(session.applyInitial(index,context));
  assert.equal(fixture.requests.some(request=>request.operation==='apply_initial'),false);await session.close();
});

test('invalid staging workflow context refuses construction before spawning',async()=>{
  let calls=0;
  for(const changed of [{GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'push'},
    {GITHUB_SHA:'b'.repeat(40)},{GITHUB_ACTOR:'unsafe actor'}]){
    await assert.rejects(InitialSession.connect({...environment,...changed},INITIAL_SESSION_CHILD_SHA256,{spawnProcess:()=>{calls++;throw Error('not reached');}}));
  }
  assert.equal(calls,0);
});

test('fixed API and core operations require initial16 and wire only trusted public context',async()=>{
  const {session,fixture}=await synthetic({initialPrefix:16,environment:{STAGING_TEST_RECIPIENT:'bootstrap-contract@example.test'}});
  await assert.rejects(session.configureApi(context));await assert.rejects(session.bootstrapCore(context));
  await fresh(session);await session.readInitialState();
  await assert.rejects(session.configureApi({...context,sql:'arbitrary'}));
  await assert.rejects(session.bootstrapCore({...context,recipient:'other@example.test'}));
  assert.equal((await session.configureApi(context)).api_schema_exposed,true);
  assert.equal((await session.bootstrapCore(context)).status,'created');
  const writes=fixture.requests.filter(({operation})=>['configure_api','bootstrap_core'].includes(operation));
  assert.deepEqual(writes.map(({operation})=>operation),['configure_api','bootstrap_core']);
  for(const {argument} of writes)assert.deepEqual(argument,{actor:'contract-test',source_sha:sourceSha,workflow_run_id:'123'});
  assert.ok(!JSON.stringify(fixture.requests).includes('bootstrap-contract@example.test'));
  await session.close();
});

test('private recipient is explicitly whitelisted into the child and excluded from public instance metadata',async()=>{
  const fixture=processFixture();let received;
  const session=await InitialSession.connect({...environment,STAGING_TEST_RECIPIENT:'bootstrap-contract@example.test',
    GITHUB_TOKEN:'synthetic-token',SENDGRID_API_KEY:'synthetic-key',LD_PRELOAD:'synthetic'},INITIAL_SESSION_CHILD_SHA256,{
      spawnProcess:(_command,_arguments,options)=>{received=options.env;return fixture.child;}});
  assert.equal(received.STAGING_TEST_RECIPIENT,'bootstrap-contract@example.test');
  for(const key of ['GITHUB_TOKEN','SENDGRID_API_KEY','LD_PRELOAD'])assert.equal(Object.hasOwn(received,key),false);
  assert.ok(!JSON.stringify(session).includes('bootstrap-contract@example.test'));
  await session.close();
  let evaluated=false;const changed={...environment};Object.defineProperty(changed,'STAGING_TEST_RECIPIENT',{get(){evaluated=true;return 'hidden@example.test';}});
  await assert.rejects(InitialSession.connect(changed,INITIAL_SESSION_CHILD_SHA256,{spawnProcess:()=>{throw Error('not reached');}}));
  assert.equal(evaluated,false);
});

test('core recipient is required and unrecognized readback values revoke uncertain owner',async()=>{
  const missing=await synthetic({initialPrefix:16});await fresh(missing.session);await missing.session.readInitialState();
  await assert.rejects(missing.session.bootstrapCore(context));
  assert.equal(missing.fixture.requests.some(({operation})=>operation==='bootstrap_core'),false);await missing.session.close();
  const bad=await synthetic({initialPrefix:16,environment:{STAGING_TEST_RECIPIENT:'bootstrap-contract@example.test'},
    bootstrapReadback:{private_identity:'synthetic-sensitive'}});
  await fresh(bad.session);await bad.session.readInitialState();
  await assert.rejects(bad.session.bootstrapCore(context),{code:'STAGING_BOOTSTRAP_READBACK_UNVERIFIED'});
  await assert.rejects(bad.session.readInitialState());await bad.session.close();
});

test('child session method/protocol tests use real fixed generator and synthetic libpq execution',()=>{
  const result=spawnSync('/usr/bin/python3',['-B','tests/helpers/staging-initial-session-tests.py'],{
    input:'',env:{PATH:'/usr/bin:/bin',INITIAL_TEST_NODE:process.execPath},encoding:'utf8',timeout:20_000,maxBuffer:128_000});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stderr,/Ran 13 tests/);assert.match(result.stderr,/\bOK\b/);
});

test('optional actual libpq local fixture: same backend capture/fresh, 334 results and param4',
  {skip:process.env.CLUVO_INITIAL_SESSION_NATIVE_TESTS!=='local-fixture'},()=>{
    const result=spawnSync('/usr/bin/python3',['-B','tests/helpers/staging-initial-session-native.py'],{
      input:'',env:{PATH:'/usr/bin:/bin'},encoding:'utf8',timeout:20_000,maxBuffer:128_000});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/LOCAL_ONLY_NATIVE_TRANSPORT_PASS/);
    assert.equal(result.stderr,'');
  });
