// Separate PWA owner; original native QA remains unchanged.
// Two synthetic staging identities, held only in this process. Provider Auth
// owns all user/session writes; app fixtures never manufacture Auth rows.
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {nativeQaProviderEmail,nativeQaProviderMetadata} from './staging-pwa-native-qa-fixture.mjs';

const PROJECT='fbozlbgmktkgcdfqdaaz';
const ORIGIN='https://'+PROJECT+'.supabase.co';
const CONTEXT_KEYS=['sourceSha','workflowRunId','actor','projectRef','environment'];
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const AUTH_OPTIONS=Object.freeze({persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
const refreshDigest=value=>createHash('sha256').update(value).digest('hex');
const cleanupRecoveries=new WeakMap();
export class NativeQaProviderError extends Error{
 constructor(code='STAGING_NATIVE_QA_PROVIDER_REFUSED'){super(code);this.code=code;}
}
const need=(condition,code)=>{if(!condition)throw new NativeQaProviderError(code);};
function fields(value,keys){
 try{
  need(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
  const descriptors=Object.getOwnPropertyDescriptors(value);
  need(Reflect.ownKeys(descriptors).length===keys.length&&keys.every(key=>descriptors[key]&&Object.hasOwn(descriptors[key],'value')));
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
 }catch{throw new NativeQaProviderError('STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID');}
}
function context(value){
 const result=fields(value,CONTEXT_KEYS);
 need(Object.isFrozen(value)&&result.environment==='staging'&&result.projectRef===PROJECT
  &&typeof result.sourceSha==='string'&&/^[0-9a-f]{40}$/.test(result.sourceSha)
  &&typeof result.workflowRunId==='string'&&/^[1-9][0-9]{0,19}$/.test(result.workflowRunId)
  &&typeof result.actor==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(result.actor),'STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID');
 return Object.freeze(result);
}
function environmentInput(environment){
 need(environment&&typeof environment==='object'&&!Array.isArray(environment)
  &&(environment===process.env||[Object.prototype,null].includes(Object.getPrototypeOf(environment))),'STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID');
 const descriptors=Object.getOwnPropertyDescriptors(environment),copy={};
 for(const key of ['APP_ENV','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY',
  'GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA','GITHUB_RUN_ID','GITHUB_ACTOR']){
  const field=descriptors[key];
  need(field&&Object.hasOwn(field,'value')&&typeof field.value==='string'&&field.value.length>0&&field.value.length<=8192
   &&!/[\r\n\0]/.test(field.value),'STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID');copy[key]=field.value;
 }
 need(copy.APP_ENV==='staging'&&copy.STAGING_SUPABASE_PROJECT_REF===PROJECT&&copy.SUPABASE_URL===ORIGIN
  &&/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(copy.SUPABASE_PUBLISHABLE_KEY)
  &&/^sb_secret_[A-Za-z0-9_-]{16,512}$/.test(copy.SUPABASE_SECRET_KEY)
  &&copy.GITHUB_REPOSITORY==='cluvonl/platform'&&copy.GITHUB_REF==='refs/heads/staging'
  &&copy.GITHUB_EVENT_NAME==='workflow_dispatch'&&copy.GITHUB_SHA===copy.RELEASE_SHA,'STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID');
 return {privateEnvironment:Object.freeze(copy),publicContext:context(Object.freeze({sourceSha:copy.RELEASE_SHA,
  workflowRunId:copy.GITHUB_RUN_ID,actor:copy.GITHUB_ACTOR,projectRef:PROJECT,environment:'staging'}))};
}
async function authorized(owner,publicContext){
 try{
  // This concrete owner maintains an unexported WeakMap populated only by its
  // default pinned child. Caller JSON, constructors and duck types cannot grant.
  const {authorizeNativeQaProvider}=await import('./staging-pwa-native-qa-session.mjs');
  need(typeof authorizeNativeQaProvider==='function');
  const result=await authorizeNativeQaProvider(owner,publicContext);
  const approved=fields(result,['authorized',...CONTEXT_KEYS]);
  need(Object.isFrozen(result)&&approved.authorized===true&&CONTEXT_KEYS.every(key=>approved[key]===publicContext[key]));
 }catch{throw new NativeQaProviderError('STAGING_NATIVE_QA_PROVIDER_AUTHORIZATION_REQUIRED');}
}
function providerFetch(input,init={}){
 let target;
 try{target=new URL(input instanceof Request?input.url:String(input));}catch{throw new NativeQaProviderError();}
 need(target.origin===ORIGIN&&!target.username&&!target.password
  &&(target.pathname.startsWith('/auth/v1/')||target.pathname.startsWith('/rest/v1/')),'STAGING_NATIVE_QA_PROVIDER_TARGET_REFUSED');
 const signal=init.signal?AbortSignal.any([init.signal,AbortSignal.timeout(20_000)]):AbortSignal.timeout(20_000);
 return fetch(input,{...init,signal,redirect:'error'});
}
function responseUser(response,code){
 need(response&&response.error===null&&response.data&&response.data.user&&typeof response.data.user==='object',code);
 return response.data.user;
}
function ownedUser(user,record,publicContext){
 const expected=nativeQaProviderMetadata({...publicContextSubset(publicContext),slot:record.slot});
 const meta=user?.app_metadata;
 return user?.id===record.id&&user.email===record.email&&user.role==='authenticated'&&user.aud==='authenticated'
  &&meta&&Object.entries(expected).every(([key,value])=>meta[key]===value)
  &&meta.provider==='email'&&Array.isArray(meta.providers)&&meta.providers.length===1&&meta.providers[0]==='email';
}
function publicContextSubset(value){return {sourceSha:value.sourceSha,workflowRunId:value.workflowRunId,actor:value.actor};}
function activeOwnedUser(user,record,publicContext){
 need(ownedUser(user,record,publicContext)&&typeof user.email_confirmed_at==='string'
  &&Number.isFinite(Date.parse(user.email_confirmed_at))&&!user.deleted_at
  &&(!user.banned_until||Date.parse(user.banned_until)<=Date.now()),'STAGING_NATIVE_QA_PROVIDER_USER_UNVERIFIED');
}
function providerMetadata(user,publicContext,slot){
 const names=[...Object.keys(nativeQaProviderMetadata({...publicContextSubset(publicContext),slot})),'provider'];
 return Object.freeze({...Object.fromEntries(names.map(name=>[name,user.app_metadata[name]])),
  providers:Object.freeze([...user.app_metadata.providers])});
}
const softDeletedUser=(user,id)=>user?.id===id&&typeof user.deleted_at==='string'&&Number.isFinite(Date.parse(user.deleted_at));
function verifySession(session,record){
 need(session&&typeof session.access_token==='string'&&session.access_token.length<=8192
  &&typeof session.refresh_token==='string'&&session.refresh_token.length>=1&&session.refresh_token.length<=4096
  &&session.token_type==='bearer'&&!/[\s\0]/.test(session.access_token+session.refresh_token),'STAGING_NATIVE_QA_PROVIDER_SESSION_UNVERIFIED');
 const parts=session.access_token.split('.');
 need(parts.length===3&&parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)),'STAGING_NATIVE_QA_PROVIDER_SESSION_UNVERIFIED');
 let claims;
 try{claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{throw new NativeQaProviderError('STAGING_NATIVE_QA_PROVIDER_SESSION_UNVERIFIED');}
 need(claims&&claims.sub===record.id&&claims.role==='authenticated'&&uuid(claims.session_id)
  &&Number.isSafeInteger(claims.exp)&&claims.exp>Math.floor(Date.now()/1000),'STAGING_NATIVE_QA_PROVIDER_SESSION_UNVERIFIED');
 // Decoding is correlation only. getUser verifies the JWT at the provider;
 // native SQL/RPC subsequently proves the live auth.sessions row.
}

class PrivateNativeQaProvider{
 #context;#dependencies;#records=[];#phase='creating';#inflight=0;#busy=false;#scope;#counts;
 constructor(publicContext,dependencies,scope){
  this.#context=publicContext;this.#dependencies=dependencies;this.#scope=scope;
  this.#counts={created_users:0,password_sign_ins:0,provider_verified_users:0,globally_revoked_sessions:0,soft_deleted_users:0};
  Object.freeze(this);
 }
 async initialize(){
  try{
   for(const slot of ['a','b']){
    await this.#dependencies.authorize();
    const id=this.#dependencies.entropy.uuid();let password=this.#dependencies.entropy.password();
    need(uuid(id)&&!this.#records.some(record=>record.id===id)&&typeof password==='string'&&password.length>=40
     &&password.length<=256&&!/[\s\0]/.test(password),'STAGING_NATIVE_QA_PROVIDER_ENTROPY_INVALID');
    const record={slot,id,email:nativeQaProviderEmail(this.#context.workflowRunId,slot),created:false,appMetadata:null,
     loginClient:null,client:null,accessToken:null,refreshTokenDigest:null,globalRevoked:false,revoked:false,deleteAttempted:false,deleted:false};
    this.#records.push(record); // Track even a request with an uncertain response.
    try{
     const attributes={id,email:record.email,password,email_confirm:true,
      app_metadata:nativeQaProviderMetadata({...publicContextSubset(this.#context),slot})};
     const user=responseUser(await this.#dependencies.admin.createUser(attributes),'STAGING_NATIVE_QA_PROVIDER_CREATE_FAILED');
     activeOwnedUser(user,record,this.#context);record.created=true;this.#counts.created_users++;
     record.loginClient=this.#dependencies.createPasswordClient();
     const login=await record.loginClient.auth.signInWithPassword({email:record.email,password});
     const loggedUser=responseUser(login,'STAGING_NATIVE_QA_PROVIDER_SIGN_IN_FAILED');
     activeOwnedUser(loggedUser,record,this.#context);verifySession(login.data.session,record);
     record.accessToken=login.data.session.access_token;record.refreshTokenDigest=refreshDigest(login.data.session.refresh_token);this.#counts.password_sign_ins++;
     const verified=responseUser(await record.loginClient.auth.getUser(record.accessToken),'STAGING_NATIVE_QA_PROVIDER_USER_UNVERIFIED');
     activeOwnedUser(verified,record,this.#context);this.#counts.provider_verified_users++;
     record.appMetadata=providerMetadata(verified,this.#context,slot);
     record.client=this.#dependencies.createAuthenticatedClient(record.accessToken);
    }finally{password=undefined;}
   }
   this.#phase='active';return this;
  }catch{
   this.#phase='failed';
   try{await this.cleanup();}catch{
    const failure=new NativeQaProviderError('STAGING_NATIVE_QA_PROVIDER_CLEANUP_REQUIRED');
    cleanupRecoveries.set(failure,{provider:this,pending:false});throw failure;
   }
   throw new NativeQaProviderError('STAGING_NATIVE_QA_PROVIDER_SETUP_FAILED');
  }
 }
 publicSummary(){return Object.freeze({scope:this.#scope,...this.#counts,mail_sent:0,native_session_proven:false,
  cleanup_complete:this.#phase==='closed',v1_ready:false,production_enabled:false});}
 privateActors(){
  need(['active','revoked'].includes(this.#phase),'STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');
  // Private bound SQL input. Never write this array to stdout/artifacts.
  return Object.freeze(this.#records.map(record=>Object.freeze({slot:record.slot,id:record.id,email:record.email})));
 }
 privateProviderRecords(){
  need(['active','revoked'].includes(this.#phase),'STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');
  // Actual verified provider metadata, projected to the fixed fixture fields.
  return Object.freeze(this.#records.map(record=>Object.freeze({id:record.id,email:record.email,appMetadata:record.appMetadata})));
 }
 async withActor(slot,callback){
  need(['active','revoked'].includes(this.#phase)&&!this.#busy&&['a','b'].includes(slot)&&typeof callback==='function','STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');
  const record=this.#records.find(item=>item.slot===slot);this.#inflight++;
  try{return await callback(Object.freeze({client:record.client,authUserId:record.id,accessToken:record.accessToken}));}
  finally{this.#inflight--;}
 }
 async withBrowserSession(slot,callback){
  need(this.#phase==='active'&&!this.#busy&&['a','b'].includes(slot)&&typeof callback==='function','STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');
  const record=this.#records.find(item=>item.slot===slot);
  need(record?.created&&!record.deleted&&!record.revoked&&!record.globalRevoked,'STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');
  this.#inflight++;let session,held;
  try{
   try{
    const response=await record.loginClient.auth.getSession();
    need(response&&response.error===null,'STAGING_NATIVE_QA_BROWSER_SESSION_UNVERIFIED');
    session=response.data?.session;verifySession(session,record);
    need(session.access_token===record.accessToken&&refreshDigest(session.refresh_token)===record.refreshTokenDigest,
     'STAGING_NATIVE_QA_BROWSER_SESSION_UNVERIFIED');
    const user=responseUser(await record.loginClient.auth.getUser(session.access_token),'STAGING_NATIVE_QA_BROWSER_SESSION_UNVERIFIED');
    activeOwnedUser(user,record,this.#context);
    held=Object.freeze({authUserId:record.id,accessToken:session.access_token,refreshToken:session.refresh_token});
   }catch{throw new NativeQaProviderError('STAGING_NATIVE_QA_BROWSER_SESSION_UNVERIFIED');}
   // Only this private callback receives the verified session. Its result is
   // deliberately discarded; no token/session/user object joins public output.
   try{await callback(held);}catch{throw new NativeQaProviderError('STAGING_NATIVE_QA_BROWSER_CALLBACK_FAILED');}
  }finally{held=undefined;session=undefined;this.#inflight--;}
 }
 async #revoke(slot=null){
  let refused=false;
  for(const record of this.#records){
   if((slot!==null&&record.slot!==slot)||!record.accessToken||record.revoked)continue;
   try{
    if(!record.globalRevoked){
     const global=await this.#dependencies.admin.signOut(record.accessToken,'global');
     need(global&&global.error===null,'STAGING_NATIVE_QA_PROVIDER_REVOCATION_FAILED');record.globalRevoked=true;
    }
    // Clear SDK memory separately; the private RPC client deliberately retains
    // the old JWT so the owner can test native rejection before discarding it.
    const local=await record.loginClient.auth.signOut({scope:'local'});
    need(local&&local.error===null,'STAGING_NATIVE_QA_PROVIDER_REVOCATION_FAILED');
    record.revoked=true;this.#counts.globally_revoked_sessions++;
   }catch{refused=true;}
  }
  need(!refused,'STAGING_NATIVE_QA_PROVIDER_REVOCATION_FAILED');
 }
 async revokeSessions(){
  need(['active','revoked'].includes(this.#phase)&&!this.#busy&&this.#inflight===0,'STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');
  this.#busy=true;
  try{await this.#revoke();this.#phase='revoked';return this.publicSummary();}
  finally{this.#busy=false;}
 }
 async revokeSession(slot){
  need(['a','b'].includes(slot)&&['active','revoked'].includes(this.#phase)&&!this.#busy&&this.#inflight===0,
   'STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');this.#busy=true;
  try{
   await this.#revoke(slot);this.#phase=this.#records.every(record=>record.revoked)?'revoked':'active';
   return this.publicSummary();
  }finally{this.#busy=false;}
 }
 async cleanup(){
  if(this.#phase==='closed')return this.publicSummary();
  need(!this.#busy&&this.#inflight===0,'STAGING_NATIVE_QA_PROVIDER_PHASE_INVALID');this.#busy=true;this.#phase='cleanup_pending';
  let refused=false;
  try{
   try{await this.#revoke();}catch{refused=true;}
   for(const record of this.#records){
    if(record.deleted)continue;
    try{
     const lookup=await this.#dependencies.admin.getUserById(record.id);
     if(lookup?.error?.status===404&&!record.created){record.deleted=true;continue;}
     const user=responseUser(lookup,'STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');
     // A successful soft-delete erases email/metadata. Only an earlier own
     // ownership readback plus our attempted soft-delete permits this recovery.
     if(record.deleteAttempted&&record.created&&softDeletedUser(user,record.id)){
      this.#finishDeletion(record);continue;
     }
     need(ownedUser(user,record,this.#context),'STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');
     if(!record.created){record.created=true;this.#counts.created_users++;}
     record.deleteAttempted=true;
     // GoTrue's successful DELETE returns an empty object. Prove the result
     // through a separate Admin read of the earlier verified private ID.
     const removed=await this.#dependencies.admin.deleteUser(record.id,true);
     need(removed&&removed.error===null,'STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');
     const deleted=responseUser(await this.#dependencies.admin.getUserById(record.id),'STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');
     need(softDeletedUser(deleted,record.id),'STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');this.#finishDeletion(record);
    }catch{refused=true;}
   }
   need(!refused&&this.#records.every(record=>record.deleted),'STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');
   this.#phase='closed';this.#dependencies=null;this.#records=[];return this.publicSummary();
  }finally{this.#busy=false;}
 }
 #finishDeletion(record){
  record.deleted=true;record.client=null;record.loginClient=null;record.accessToken=null;record.refreshTokenDigest=null;record.appMetadata=null;
  this.#counts.soft_deleted_users++;
 }
}

// No injectable production SDK, owner-reader, entropy or authorization route.
export async function createStagingNativeQaProvider(owner,environment){
 const {privateEnvironment:fixed,publicContext}=environmentInput(environment);
 await authorized(owner,publicContext);
 const settings={auth:AUTH_OPTIONS,global:{fetch:providerFetch}};
 const admin=createClient(ORIGIN,fixed.SUPABASE_SECRET_KEY,settings).auth.admin;
 return await new PrivateNativeQaProvider(publicContext,{admin,
  authorize:()=>authorized(owner,publicContext),entropy:{uuid:randomUUID,password:()=>randomBytes(48).toString('base64url')},
  createPasswordClient:()=>createClient(ORIGIN,fixed.SUPABASE_PUBLISHABLE_KEY,settings),
  createAuthenticatedClient:accessToken=>createClient(ORIGIN,fixed.SUPABASE_PUBLISHABLE_KEY,
   {...settings,accessToken:async()=>accessToken}),
 },'STAGING_NATIVE_QA_PROVIDER_V1').initialize();
}

// Only the exact error raised after a failed factory-owned cleanup can retry
// that cleanup. No identity/credentials/context input and no actor access or
// account creation route are exposed through this recovery capability.
export async function retryStagingNativeQaProviderCleanup(error){
 const recovery=cleanupRecoveries.get(error);
 need(recovery&&!recovery.pending,'STAGING_NATIVE_QA_PROVIDER_RECOVERY_REFUSED');recovery.pending=true;
 try{
  const result=await recovery.provider.cleanup();cleanupRecoveries.delete(error);return result;
 }catch{throw new NativeQaProviderError('STAGING_NATIVE_QA_PROVIDER_CLEANUP_FAILED');}
 finally{recovery.pending=false;}
}

// Pure lifecycle tests use only supplied synthetic transports. This factory
// has no credentials/default SDK/owner registration/hosted authorization.
export async function createLocalSyntheticNativeQaProvider(input){
 const supplied=fields(input,['context','admin','createPasswordClient','createAuthenticatedClient','entropy']);
 const publicContext=context(supplied.context),entropy=fields(supplied.entropy,['uuid','password']);
 need(supplied.admin&&['createUser','getUserById','deleteUser','signOut'].every(key=>typeof supplied.admin[key]==='function')
  &&typeof supplied.createPasswordClient==='function'&&typeof supplied.createAuthenticatedClient==='function'
  &&typeof entropy.uuid==='function'&&typeof entropy.password==='function','STAGING_NATIVE_QA_PROVIDER_INPUT_INVALID');
 return await new PrivateNativeQaProvider(publicContext,{...supplied,entropy,authorize:async()=>{}},'LOCAL_SYNTHETIC_ONLY').initialize();
}
