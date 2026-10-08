import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLocalSyntheticNativeQaProvider,createStagingNativeQaProvider,retryStagingNativeQaProviderCleanup} from '../scripts/staging-native-qa-provider.mjs';
import {buildStagingNativeQaFixture} from '../scripts/staging-native-qa-fixture.mjs';

const SOURCE='1'.repeat(40);
const CONTEXT=Object.freeze({sourceSha:SOURCE,workflowRunId:'876543210',actor:'synthetic-qa',
 projectRef:'fbozlbgmktkgcdfqdaaz',environment:'staging'});
const IDS=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function fixture(options={}){
 const users=new Map(),calls=[],signIns=[],clients=[];let next=0;
 const response=user=>({data:{user:structuredClone(user)},error:null});
 const failure={data:{user:null},error:{status:404,message:'synthetic not found'}};
 const token=id=>['synthetic',Buffer.from(JSON.stringify({sub:id,role:'authenticated',
  session_id:'33333333-3333-4333-8333-333333333333',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
 const admin={
  async createUser(attributes){
   calls.push(['create',structuredClone(attributes)]);
   const user={id:attributes.id,email:attributes.email,role:'authenticated',aud:'authenticated',
    email_confirmed_at:'2026-10-01T00:00:00.000Z',app_metadata:{provider:'email',providers:['email'],...attributes.app_metadata}};
   users.set(user.id,user);
   if(options.createError)throw new Error('PRIVATE_PROVIDER_RESPONSE_MUST_NOT_ESCAPE');
   if(options.driftUser)user.app_metadata.cluvo_qa_slot='foreign';
   return response(user);
  },
  async getUserById(id){calls.push(['get',id]);return users.has(id)?response(users.get(id)):failure;},
  async signOut(accessToken,scope){calls.push(['global',accessToken,scope]);
   return {data:null,error:options.revokeError?{message:'PRIVATE_REVOCATION_ERROR'}:null};},
  async deleteUser(id,soft){
   calls.push(['delete',id,soft]);
   if(options.deleteError)throw new Error('PRIVATE_CLEANUP_ERROR');
   if(options.deleteNoEffect)return {data:{user:{}},error:null};
   const user=users.get(id);user.deleted_at='2026-10-08T12:00:00.000Z';user.email='soft-deleted';user.app_metadata={};
   if(options.ambiguousDelete)throw new Error('PRIVATE_LOST_DELETE_RESPONSE');
   return {data:{user:{}},error:null}; // Actual GoTrue DELETE response shape.
  },
 };
 const createPasswordClient=()=>{
  const loginClient={auth:{
   async signInWithPassword(credentials){
    calls.push(['login',credentials.email]);signIns.push(credentials);
    if(options.loginError)throw new Error('PRIVATE_SIGN_IN_ERROR');
    const user=[...users.values()].find(item=>item.email===credentials.email);
    const value=response(user);value.data.session={access_token:token(user.id),refresh_token:'synthetic123',token_type:'bearer'};
    if(options.emptyRefresh)value.data.session.refresh_token='';
    if(options.badSession)value.data.session.access_token='invalid';
    return value;
   },
   async getUser(accessToken){
    calls.push(['verify',accessToken]);
    const id=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString()).sub;
    const value=response(users.get(id));if(options.verifyDrift)value.data.user.id=IDS[1];return value;
   },
   async signOut(value){calls.push(['local',value.scope]);return {error:options.localError?{message:'PRIVATE_LOCAL_ERROR'}:null};},
  }};clients.push(loginClient);return loginClient;
 };
 const createAuthenticatedClient=accessToken=>Object.freeze({heldSyntheticToken:accessToken,
  async rpc(){return {data:[{synthetic:true}],error:null};}});
 return {users,calls,signIns,clients,input:{context:CONTEXT,admin,createPasswordClient,createAuthenticatedClient,
  entropy:{uuid:()=>IDS[next++],password:()=>('SYNTHETIC_COMPONENT_PASSWORD_ONLY_').repeat(2)}}};
}
const safeFailure=code=>error=>error.message===code&&error.code===code&&!error.stack.includes('PRIVATE_');

test('synthetic lifecycle creates exactly two confirmed identities and verifies password JWTs at provider',async()=>{
 const f=fixture(),provider=await createLocalSyntheticNativeQaProvider(f.input);
 assert.deepEqual(provider.publicSummary(),{scope:'LOCAL_SYNTHETIC_ONLY',created_users:2,password_sign_ins:2,
  provider_verified_users:2,globally_revoked_sessions:0,soft_deleted_users:0,mail_sent:0,native_session_proven:false,
  cleanup_complete:false,v1_ready:false,production_enabled:false});
 const created=f.calls.filter(call=>call[0]==='create');assert.equal(created.length,2);
 for(const [index,call] of created.entries()){
  assert.deepEqual(Object.keys(call[1]).sort(),['app_metadata','email','email_confirm','id','password']);
  assert.equal(call[1].id,IDS[index]);assert.equal(call[1].email_confirm,true);
  assert.match(call[1].email,/^cluvo-qa-876543210-[ab]@example\.test$/);
  assert.equal(call[1].app_metadata.cluvo_qa_source_sha,SOURCE);
  assert.equal(call[1].password,f.signIns[index].password);
 }
 assert.equal(f.calls.filter(call=>call[0]==='verify').length,2);
 assert.equal(JSON.stringify(provider),'{}');assert.deepEqual(Object.keys(provider),[]);assert.ok(Object.isFrozen(provider));
 assert.equal(JSON.stringify(provider.publicSummary()).includes(IDS[0]),false);
 const actors=provider.privateActors();assert.ok(Object.isFrozen(actors));assert.ok(Object.isFrozen(actors[0]));
 assert.deepEqual(actors.map(actor=>actor.slot),['a','b']);
 assert.deepEqual(Object.keys(actors[0]).sort(),['email','id','slot']);
 const providers=provider.privateProviderRecords();
 assert.deepEqual(Object.keys(providers[0]).sort(),['appMetadata','email','id']);
 assert.deepEqual(providers[0].appMetadata,f.users.get(IDS[0]).app_metadata);
 assert.ok(Object.isFrozen(providers[0].appMetadata.providers));
 assert.doesNotThrow(()=>buildStagingNativeQaFixture({providers,sourceSha:CONTEXT.sourceSha,
  workflowRunId:CONTEXT.workflowRunId,actor:CONTEXT.actor,expectedVersion:0}));
 await provider.cleanup();
});

test('real logout precedes soft deletion, retains old private JWT for native rejection, and cleanup is idempotent',async()=>{
 const f=fixture(),provider=await createLocalSyntheticNativeQaProvider(f.input);
 const before=await provider.withActor('a',held=>held.accessToken);
 const revoked=await provider.revokeSessions();assert.equal(revoked.globally_revoked_sessions,2);
 const after=await provider.withActor('a',held=>held.accessToken);assert.equal(after,before);
 assert.deepEqual(f.calls.filter(call=>call[0]==='global').map(call=>call[2]),['global','global']);
 assert.deepEqual(f.calls.filter(call=>call[0]==='local').map(call=>call[1]),['local','local']);
 const cleaned=await provider.cleanup();assert.equal(cleaned.soft_deleted_users,2);assert.equal(cleaned.cleanup_complete,true);
 assert.ok(f.calls.findIndex(call=>call[0]==='delete')>f.calls.map(call=>call[0]).lastIndexOf('local'));
 assert.deepEqual(f.calls.filter(call=>call[0]==='delete').map(call=>call[2]),[true,true]);
 const callCount=f.calls.length;assert.deepEqual(await provider.cleanup(),cleaned);assert.equal(f.calls.length,callCount);
 assert.throws(()=>provider.privateActors(),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 await assert.rejects(provider.withActor('a',()=>{}),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
});

test('actual provider 12-character opaque refresh format is accepted while empty refresh is refused',async()=>{
 const f=fixture(),provider=await createLocalSyntheticNativeQaProvider(f.input);
 const login=await f.clients[0].auth.signInWithPassword(f.signIns[0]);
 assert.equal(login.data.session.refresh_token.length,12);assert.equal(provider.publicSummary().password_sign_ins,2);
 await provider.cleanup();
 const empty=fixture({emptyRefresh:true});
 await assert.rejects(createLocalSyntheticNativeQaProvider(empty.input),safeFailure('STAGING_NATIVE_QA_PROVIDER_SETUP_FAILED'));
 assert.equal(empty.calls.filter(call=>call[0]==='delete').length,1);
});

test('two held actor operations can race while logout/cleanup are refused until completion',async()=>{
 const f=fixture(),provider=await createLocalSyntheticNativeQaProvider(f.input);let release;
 const held=new Promise(resolve=>{release=resolve;});
 const a=provider.withActor('a',async privateActor=>{await held;return privateActor.client.rpc();});
 const b=provider.withActor('b',async privateActor=>{await held;return privateActor.client.rpc();});
 await assert.rejects(provider.cleanup(),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 await assert.rejects(provider.revokeSessions(),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 await assert.rejects(provider.revokeSession('a'),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 release();assert.equal((await Promise.all([a,b])).length,2);await provider.cleanup();
});

test('fixed-slot revocation keeps the other actor as a positive control and old private JWT is retained',async()=>{
 const f=fixture(),provider=await createLocalSyntheticNativeQaProvider(f.input);
 const oldA=await provider.withActor('a',held=>held.accessToken);
 const liveB=await provider.withActor('b',held=>held.accessToken);
 const summary=await provider.revokeSession('a');assert.equal(summary.globally_revoked_sessions,1);
 assert.equal(f.calls.filter(call=>call[0]==='global').length,1);
 assert.equal(f.calls.find(call=>call[0]==='global')[1],oldA);
 assert.equal(await provider.withActor('a',held=>held.accessToken),oldA);
 assert.equal(await provider.withActor('b',held=>held.accessToken),liveB);
 assert.equal((await provider.revokeSession('a')).globally_revoked_sessions,1);
 await assert.rejects(provider.revokeSession(IDS[1]),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 await assert.rejects(provider.revokeSession('c'),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 const done=await provider.cleanup();assert.equal(done.globally_revoked_sessions,2);
 assert.equal(f.calls.filter(call=>call[0]==='global')[1][1],liveB);
});

test('local logout retry preserves earlier successful global revocation without repeating it',async()=>{
 const options={localError:true},f=fixture(options),provider=await createLocalSyntheticNativeQaProvider(f.input);
 await assert.rejects(provider.revokeSession('a'),safeFailure('STAGING_NATIVE_QA_PROVIDER_REVOCATION_FAILED'));
 assert.equal(provider.publicSummary().globally_revoked_sessions,0);
 options.localError=false;
 assert.equal((await provider.revokeSession('a')).globally_revoked_sessions,1);
 assert.equal(f.calls.filter(call=>call[0]==='global').length,1);
 await provider.cleanup();
});

test('uncertain create response is cleaned only after private ownership readback',async()=>{
 const f=fixture({createError:true});
 await assert.rejects(createLocalSyntheticNativeQaProvider(f.input),safeFailure('STAGING_NATIVE_QA_PROVIDER_SETUP_FAILED'));
 assert.equal(f.calls.filter(call=>call[0]==='create').length,1);
 assert.equal(f.calls.filter(call=>call[0]==='get').length,2);
 assert.equal(f.calls.filter(call=>call[0]==='delete').length,1);
 assert.equal(f.calls.find(call=>call[0]==='delete')[2],true);
});

test('foreign ownership response is refused and never deleted',async()=>{
 const f=fixture({driftUser:true});
 await assert.rejects(createLocalSyntheticNativeQaProvider(f.input),safeFailure('STAGING_NATIVE_QA_PROVIDER_CLEANUP_REQUIRED'));
 assert.equal(f.calls.filter(call=>call[0]==='delete').length,0);
});

test('exact failed-factory error can retry only its privately retained owned cleanup',async()=>{
 const options={createError:true,deleteError:true},f=fixture(options);let failure;
 try{await createLocalSyntheticNativeQaProvider(f.input);assert.fail('setup must fail');}
 catch(error){failure=error;assert.equal(error.code,'STAGING_NATIVE_QA_PROVIDER_CLEANUP_REQUIRED');}
 assert.equal(JSON.stringify(failure).includes(IDS[0]),false);
 assert.equal(f.calls.filter(call=>call[0]==='create').length,1);
 // A failed retry preserves the original exact capability for another retry.
 await assert.rejects(retryStagingNativeQaProviderCleanup(failure),safeFailure('STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED'));
 options.deleteError=false;
 const result=await retryStagingNativeQaProviderCleanup(failure);
 assert.equal(result.scope,'LOCAL_SYNTHETIC_ONLY');assert.equal(result.cleanup_complete,true);
 assert.equal(result.created_users,1);assert.equal(result.soft_deleted_users,1);assert.equal(result.password_sign_ins,0);
 assert.equal(f.calls.filter(call=>call[0]==='create').length,1);
 assert.deepEqual(Object.keys(result).sort(),Object.keys({scope:0,created_users:0,password_sign_ins:0,provider_verified_users:0,
  globally_revoked_sessions:0,soft_deleted_users:0,mail_sent:0,native_session_proven:0,cleanup_complete:0,v1_ready:0,production_enabled:0}).sort());
 const calls=f.calls.length;
 await assert.rejects(retryStagingNativeQaProviderCleanup(failure),safeFailure('STAGING_NATIVE_QA_PROVIDER_RECOVERY_REFUSED'));
 assert.equal(f.calls.length,calls);
});

test('copied or foreign errors never authorize cleanup recovery before provider action',async()=>{
 const options={createError:true,deleteError:true},f=fixture(options);let failure;
 try{await createLocalSyntheticNativeQaProvider(f.input);}catch(error){failure=error;}
 const before=f.calls.length;
 for(const unknown of [undefined,null,{},new Error('synthetic'),{...failure},Object.create(failure)]){
  await assert.rejects(retryStagingNativeQaProviderCleanup(unknown),safeFailure('STAGING_NATIVE_QA_PROVIDER_RECOVERY_REFUSED'));
 }
 assert.equal(f.calls.length,before);options.deleteError=false;await retryStagingNativeQaProviderCleanup(failure);
});

for(const option of ['loginError','badSession','verifyDrift']){
 test('provider '+option+' is redacted and cleans its owned account',async()=>{
  const f=fixture({[option]:true});
  await assert.rejects(createLocalSyntheticNativeQaProvider(f.input),safeFailure('STAGING_NATIVE_QA_PROVIDER_SETUP_FAILED'));
  assert.equal(f.calls.filter(call=>call[0]==='delete').length,1);
 });
}

test('cleanup reports refusal without provider messages and can retry a pending own soft delete',async()=>{
 const options={deleteError:true},f=fixture(options),provider=await createLocalSyntheticNativeQaProvider(f.input);
 await assert.rejects(provider.cleanup(),safeFailure('STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED'));
 assert.equal(provider.publicSummary().cleanup_complete,false);
 options.deleteError=false;assert.equal((await provider.cleanup()).soft_deleted_users,2);
});

test('ambiguous successful soft-delete recovers only its earlier verified private own identities',async()=>{
 const options={ambiguousDelete:true},f=fixture(options),provider=await createLocalSyntheticNativeQaProvider(f.input);
 await assert.rejects(provider.cleanup(),safeFailure('STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED'));
 assert.equal(provider.publicSummary().soft_deleted_users,0);
 assert.throws(()=>provider.privateProviderRecords(),safeFailure('STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID'));
 options.ambiguousDelete=false;
 const result=await provider.cleanup();assert.equal(result.soft_deleted_users,2);assert.equal(result.cleanup_complete,true);
 assert.equal(f.calls.filter(call=>call[0]==='delete').length,2);
});

test('empty successful DELETE needs a separate soft-deleted identity readback before cleanup passes',async()=>{
 const options={deleteNoEffect:true},f=fixture(options),provider=await createLocalSyntheticNativeQaProvider(f.input);
 await assert.rejects(provider.cleanup(),safeFailure('STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED'));
 assert.equal(provider.publicSummary().soft_deleted_users,0);
 options.deleteNoEffect=false;
 assert.equal((await provider.cleanup()).soft_deleted_users,2);
 assert.equal(f.calls.filter(call=>call[0]==='get').length,8);
});

test('failed global logout cannot be counted as native logout proof even after soft deletion',async()=>{
 const f=fixture({revokeError:true}),provider=await createLocalSyntheticNativeQaProvider(f.input);
 await assert.rejects(provider.revokeSessions(),safeFailure('STAGING_NATIVE_QA_PROVIDER_REVOCATION_FAILED'));
 assert.equal(provider.publicSummary().globally_revoked_sessions,0);
 await assert.rejects(provider.cleanup(),safeFailure('STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED'));
 assert.equal(provider.publicSummary().cleanup_complete,false);
 assert.equal(provider.publicSummary().soft_deleted_users,2);
});

test('strict frozen context rejects production, extras, inherited data, and getters before fake provider action',async()=>{
 const contexts=[{...CONTEXT},Object.freeze({...CONTEXT,environment:'production'}),Object.freeze({...CONTEXT,extra:true}),
  Object.freeze(Object.create(CONTEXT)),Object.freeze(Object.defineProperty({...CONTEXT},'sourceSha',{get(){throw new Error('PRIVATE_GETTER');}}))];
 for(const value of contexts){const f=fixture();f.input.context=value;
  await assert.rejects(createLocalSyntheticNativeQaProvider(f.input),safeFailure('STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID'));
  assert.equal(f.calls.length,0);
 }
});

// These strings identify fake inputs. They are not credentials and are never
// used in an HTTP request: the authentic owner gate rejects first.
const fakeEnvironment=()=>({APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:CONTEXT.projectRef,
 SUPABASE_URL:'https://'+CONTEXT.projectRef+'.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_NOT_A_REAL_KEY',
 SUPABASE_SECRET_KEY:'sb_secret_SYNTHETIC_NOT_A_REAL_KEY',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',
 GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:SOURCE,RELEASE_SHA:SOURCE,GITHUB_RUN_ID:CONTEXT.workflowRunId,GITHUB_ACTOR:CONTEXT.actor});
test('default factory denies duck-typed owner and caller JSON authority before any network',async()=>{
 const original=globalThis.fetch;let requests=0;
 globalThis.fetch=async()=>{requests++;throw new Error('NETWORK_MUST_NOT_BE_USED');};
 try{
  for(const owner of [{},{authorizeNativeQaProvider:async()=>({authorized:true,...CONTEXT})},Object.freeze({...CONTEXT,authorized:true})]){
   await assert.rejects(createStagingNativeQaProvider(owner,fakeEnvironment()),safeFailure('STAGING_NATIVE_QA_PROVIDER_AUTHORIZATION_REQUIRED'));
  }
  assert.equal(requests,0);
 }finally{globalThis.fetch=original;}
});

test('default factory refuses wrong target/workflow/secret scheme before owner or HTTP action',async()=>{
 for(const change of [{APP_ENV:'production'},{SUPABASE_URL:'https://example.test'},
  {GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'push'},{RELEASE_SHA:'2'.repeat(40)},
  {SUPABASE_SECRET_KEY:'legacy-role-key'},{GITHUB_ACTOR:'bad actor'}]){
  await assert.rejects(createStagingNativeQaProvider({}, {...fakeEnvironment(),...change}),safeFailure('STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID'));
 }
});

test('production source uses memory-only pinned SDK settings and only a fixed concrete authority module',async()=>{
 const source=await readFile(new URL('../scripts/staging-native-qa-provider.mjs',import.meta.url),'utf8');
 assert.match(source,/persistSession:false,autoRefreshToken:false,detectSessionInUrl:false/);
 assert.match(source,/randomBytes\(48\)\.toString\('base64url'\)/);
 assert.match(source,/await import\('\.\/staging-native-qa-session\.mjs'\)/);
 assert.match(source,/redirect:'error'/);
 assert.match(source,/deleteUser\(record\.id,true\)/);
 assert.doesNotMatch(source,/console\.|writeFile|localStorage|inviteUserByEmail|signUp\(|createUser\(.*service_role/);
});
