// Private fixed initial16 staging owner. Writes accept only index and finite release context.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget,databaseTarget,databaseEnvironment} from './staging-preflight.mjs';

const BRIDGE=fileURLToPath(new URL('./staging_initial_session.py',import.meta.url));
const SESSION=fileURLToPath(new URL('./staging_backup_session.py',import.meta.url));
const SESSION_PIN='e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1';
export const INITIAL_SESSION_CHILD_SHA256='46845c81b7f2f7bb428a232fd90d9dd2034ff545dba5815a4ece4042c5a11e45';
const BRIDGE_PIN=INITIAL_SESSION_CHILD_SHA256;
const sourceBindings=new WeakMap();
const PROJECT='fbozlbgmktkgcdfqdaaz';
const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const CA_HASH='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
const LIMIT=8_000_000,INPUT=2_000_000;
const objectKey=createHash('sha256').update(PROJECT).digest().readInt32BE(0);
const hash=value=>createHash('sha256').update(value).digest('hex');
export class BridgeError extends Error {constructor(code,sqlstate=null){super(code);this.code=code;this.sqlstate=sqlstate;}}
const requireTrue=(value,code)=>{if(!value)throw new BridgeError(code);};

function validatedWorkflow(environment){
 const descriptors=Object.getOwnPropertyDescriptors(environment),result={};
 for(const name of ['GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA','GITHUB_RUN_ID','GITHUB_ACTOR']){
  const field=descriptors[name];requireTrue(field&&Object.hasOwn(field,'value')&&typeof field.value==='string','INITIAL_WORKFLOW_CONTEXT_REQUIRED');result[name]=field.value;
 }
 requireTrue(result.GITHUB_REPOSITORY==='cluvonl/platform'&&result.GITHUB_REF==='refs/heads/staging'&&
  result.GITHUB_EVENT_NAME==='workflow_dispatch'&&result.GITHUB_SHA===result.RELEASE_SHA&&/^[0-9a-f]{40}$/.test(result.RELEASE_SHA)&&
  /^[1-9][0-9]{0,19}$/.test(result.GITHUB_RUN_ID)&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(result.GITHUB_ACTOR),'INITIAL_WORKFLOW_CONTEXT_REQUIRED');
 return Object.freeze(result);
}

function privateRecipient(environment){
 const descriptor=Object.getOwnPropertyDescriptor(environment,'STAGING_TEST_RECIPIENT');
 if(!descriptor)return Object.freeze({});
 requireTrue(Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'&&descriptor.value.length<=254&&
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(descriptor.value),'STAGING_BOOTSTRAP_RECIPIENT_REQUIRED');
 return Object.freeze({STAGING_TEST_RECIPIENT:descriptor.value});
}

// Environment is derived from the canonical target validators. Host options,
// service/.pgpass/GSS/LD_PRELOAD/DOCKER_* and shell expansion are not inherited.
function immutableEnvironment(environment){
 requireTrue(environment&&typeof environment==='object'&&!Array.isArray(environment)
  &&(environment===process.env||[Object.prototype,null].includes(Object.getPrototypeOf(environment))),'BRIDGE_ENVIRONMENT_REQUIRED');
 const descriptors=Object.getOwnPropertyDescriptors(environment),copy={};
 for(const key of ['APP_ENV','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL','MIGRATION_DATABASE_URL','MIGRATION_SSL_ROOT_CERT_PATH']){
  const field=descriptors[key];requireTrue(field&&Object.hasOwn(field,'value')&&typeof field.value==='string'
   &&field.value.length>0&&field.value.length<=8192&&!/[\r\n\0]/.test(field.value),'BRIDGE_ENVIRONMENT_REQUIRED');copy[key]=field.value;
 }
 return Object.freeze(copy);
}
export async function validatedConnectionEnvironment(environment){
 const fixed=immutableEnvironment(environment),project=projectTarget(fixed);
 requireTrue(project.ref===PROJECT,'PROJECT_PIN_MISMATCH');
 const target=databaseTarget(fixed.MIGRATION_DATABASE_URL,project.ref),caPath=fixed.MIGRATION_SSL_ROOT_CERT_PATH;
 let official,provided,metadata;
 try{[official,provided,metadata]=await Promise.all([readFile(CA),readFile(caPath),lstat(caPath)]);}
 catch{throw new BridgeError('BRIDGE_CA_INPUT_UNAVAILABLE');}
 requireTrue(metadata.isFile()&&!metadata.isSymbolicLink()&&official.length<=65_536&&provided.length<=65_536
  &&hash(official)===CA_HASH&&hash(provided)===CA_HASH,'PINNED_DATABASE_CA_MISMATCH');
 const env=databaseEnvironment(target,{PATH:'/usr/bin:/bin',MIGRATION_SSL_ROOT_CERT_PATH:caPath});
 requireTrue(env.PGSSLMODE==='verify-full'&&env.PGPORT==='5432','VERIFY_FULL_REQUIRED');
 return {env,caPath,target:Object.freeze({projectRef:project.ref,database:'postgres',host:target.host,port:target.port,
  username:target.username,mode:target.mode,sslMode:'verify-full'})};
}

export class InitialSession {
 #child;#workflow=null;#recipientPresent=false;#waiting=null;#next=1;#state='new';#decoder=new TextDecoder('utf-8',{fatal:true});#buffer='';#bytes=0;#closed;#exited=false;#closing=false;
 constructor(child,target){
  this.#child=child;Object.defineProperty(this,'targetBinding',{value:target,enumerable:true});
  this.#closed=new Promise(resolve=>child.once('close',()=>{sourceBindings.delete(this);this.#reject('BRIDGE_CLOSED');this.#state='closed';this.#exited=true;resolve();}));
  child.on('error',()=>this.#abort('BRIDGE_PROCESS_FAILED'));
  child.stdin.on('error',()=>this.#abort('BRIDGE_INPUT_FAILED'));
  child.stdout.on('error',()=>this.#abort('BRIDGE_OUTPUT_FAILED'));
  child.stderr.on('error',()=>this.#abort('BRIDGE_OUTPUT_FAILED'));
  child.stdout.on('data',chunk=>{
   this.#bytes+=chunk.length;
   if(this.#bytes>LIMIT)return this.#abort('BRIDGE_RESPONSE_BOUND_EXCEEDED');
   try{this.#buffer+=this.#decoder.decode(chunk,{stream:true});}catch{return this.#abort('BRIDGE_RESPONSE_INVALID');}
   let end;
   while((end=this.#buffer.indexOf('\n'))>=0){
    const line=this.#buffer.slice(0,end);this.#buffer=this.#buffer.slice(end+1);
    if(!this.#waiting)return this.#abort('BRIDGE_UNEXPECTED_RESPONSE');
    let response;try{response=JSON.parse(line);}catch{return this.#abort('BRIDGE_RESPONSE_INVALID');}
    const pending=this.#waiting;
    const keys=response&&typeof response==='object'&&!Array.isArray(response)?Object.keys(response).sort():[];
    const wanted=response?.ok===true?['id','ok','value']:['code','id','ok','sqlstate'];
    if(response?.id!==pending.id||typeof response.ok!=='boolean'||JSON.stringify(keys)!==JSON.stringify(wanted))return this.#abort('BRIDGE_RESPONSE_INVALID');
    if(!response.ok&&(!/^[A-Z][A-Z0-9_]{1,79}$/.test(response.code??'')
      ||(response.sqlstate!==null&&(typeof response.sqlstate!=='string'||!/^[0-9A-Z]{5}$/.test(response.sqlstate)))))return this.#abort('BRIDGE_RESPONSE_INVALID');
    clearTimeout(pending.timer);this.#waiting=null;this.#bytes=0;
    if(!response.ok){
     pending.reject(new BridgeError(response.code,response.sqlstate));this.#abort('BRIDGE_QUERY_UNAVAILABLE');
    }else pending.resolve(response.value);
    if(this.#buffer.length>0)return this.#abort('BRIDGE_UNEXPECTED_RESPONSE');
   }
  });
  // libpq notices/errors/tracebacks must never enter logs or artifacts. Any
  // unexpected child stderr is failure, irrespective of its private content.
  child.stderr.on('data',()=>this.#abort('BRIDGE_UNEXPECTED_STDERR'));
 }
 #reject(code){if(this.#waiting){clearTimeout(this.#waiting.timer);this.#waiting.reject(new BridgeError(code));this.#waiting=null;}}
 #abort(code){sourceBindings.delete(this);const alreadyStopped=['failed','closed'].includes(this.#state);this.#state='failed';this.#reject(code);if(!alreadyStopped&&!this.#exited){try{this.#child.kill('SIGKILL');}catch{}}}
 async #request(operation,argument=null){
  requireTrue(this.#waiting===null&&!this.#exited&&!['failed','closed'].includes(this.#state)
   &&(!this.#closing||operation==='close'),'BRIDGE_OPERATION_INVALID');
  const id=this.#next++,raw=JSON.stringify({id,operation,argument})+'\n';
  requireTrue(Buffer.byteLength(raw)<=INPUT,'BRIDGE_REQUEST_BOUND_EXCEEDED');
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.#abort('BRIDGE_TIMEOUT'),['apply_initial','configure_api','bootstrap_core'].includes(operation)?250_000:35_000);
   this.#waiting={id,resolve,reject,timer};
   try{this.#child.stdin.write(raw,error=>{if(error)this.#abort('BRIDGE_INPUT_FAILED');});}
   catch{this.#abort('BRIDGE_INPUT_FAILED');}
  });
 }
 static async connect(environment,expectedBridgeSha,options={}){
  requireTrue(options&&typeof options==='object'&&Object.getPrototypeOf(options)===Object.prototype,'BRIDGE_FACTORY_OPTIONS_INVALID');
  const descriptors=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(descriptors);
  requireTrue(keys.length<=1&&keys.every(k=>k==='spawnProcess'&&Object.hasOwn(descriptors[k],'value')
   &&typeof descriptors[k].value==='function'),'BRIDGE_FACTORY_OPTIONS_INVALID');
  const workflow=validatedWorkflow(environment);
  const recipient=privateRecipient(environment);
  const defaultFactory=keys.length===0,spawnProcess=defaultFactory?spawn:descriptors.spawnProcess.value;
  requireTrue(expectedBridgeSha===BRIDGE_PIN,'BRIDGE_SOURCE_HASH_REQUIRED');
  let source,metadata,validated;
  try{[source,metadata,validated]=await Promise.all([readFile(BRIDGE),lstat(BRIDGE),validatedConnectionEnvironment(environment)]);}
  catch(error){throw error instanceof BridgeError?error:new BridgeError('BRIDGE_CONNECTION_INPUT_UNAVAILABLE');}
  const sessionMetadata=await lstat(SESSION);
  requireTrue(metadata.isFile()&&!metadata.isSymbolicLink()&&source.length<=65536&&hash(source)===expectedBridgeSha
   &&sessionMetadata.isFile()&&!sessionMetadata.isSymbolicLink()&&hash(await readFile(SESSION))===SESSION_PIN,'BRIDGE_SOURCE_CHANGED');
  const child=spawnProcess('/usr/bin/python3',['-B',BRIDGE],{env:{...validated.env,...workflow,...recipient,APP_ENV:'staging',INITIAL_NODE_EXECUTABLE:process.execPath},stdio:['pipe','pipe','pipe']});
  const session=new InitialSession(child,validated.target);
  try{
   const transport=await session.#request('connect',{lock_object:objectKey});
   requireTrue(transport?.client_tls===true&&['TLSv1.2','TLSv1.3'].includes(transport.client_tls_protocol)
    &&transport.postgres_version===170011&&transport.scope==='HOSTED_VERIFY_FULL'&&Number.isSafeInteger(transport.libpq_version),'BRIDGE_TRANSPORT_UNVERIFIED');
   const [sourceAfter,caAfter,sessionAfter]=await Promise.all([readFile(BRIDGE),readFile(validated.caPath),readFile(SESSION)]);
   requireTrue(hash(sourceAfter)===BRIDGE_PIN&&hash(caAfter)===CA_HASH&&hash(sessionAfter)===SESSION_PIN,'BRIDGE_VERIFIED_INPUT_CHANGED');
   requireTrue(session.#state==='new'&&!session.#exited&&session.#child.killed!==true,'BRIDGE_CONNECTION_CLOSED_DURING_VALIDATION');
   Object.defineProperty(session,'transport',{value:Object.freeze({...transport}),enumerable:true});session.#workflow=workflow;session.#recipientPresent=Object.hasOwn(recipient,'STAGING_TEST_RECIPIENT');session.#state='locked';
   if(defaultFactory){
    const binding=Object.freeze({schema_version:1,source_scope:'HOSTED_VERIFY_FULL',actual_project_ref:PROJECT,
     intended_staging_project_ref:PROJECT,environment:'staging',
     target:Object.freeze({database:'postgres',host:validated.target.host,port:validated.target.port,
      username:validated.target.username,mode:validated.target.mode}),
     transport:Object.freeze({client_tls:true,client_tls_protocol:transport.client_tls_protocol,client_certificate_verified:true,
      ssl_mode:'verify-full',postgres_version:transport.postgres_version,libpq_version:transport.libpq_version,
      official_ca_sha256:CA_HASH,bridge_source_sha256:BRIDGE_PIN})});
    sourceBindings.set(session,Object.freeze({binding,active:()=>['locked','capture','captured','fresh_read','fresh_read_complete','initial_ready'].includes(session.#state)}));
   }
   Object.preventExtensions(session);return session;
  }catch(error){await session.close();throw error instanceof BridgeError?error:new BridgeError('BRIDGE_CONNECTION_FAILED');}
 }
 #phase(expected){requireTrue(!this.#closing&&!this.#exited&&this.#child.killed!==true&&this.#state===expected,'BRIDGE_PHASE_CLOSED');}
 async beginCapture(){requireTrue(this.#state==='locked','CAPTURE_PHASE_INVALID');this.#phase('locked');const value=await this.#request('begin_capture');this.#phase('locked');this.#state='capture';return value;}
 async captureQuery(sql){requireTrue(this.#state==='capture','CAPTURE_PHASE_INVALID');requireTrue(typeof sql==='string','BRIDGE_QUERY_INVALID');this.#phase('capture');const value=await this.#request('capture_query',sql);this.#phase('capture');return value;}
 async checkLock(){const value=await this.#request('check_lock');requireTrue(!this.#closing&&!this.#exited&&!['failed','closed'].includes(this.#state),'BRIDGE_PHASE_CLOSED');return value;}
 async endCapture(){requireTrue(this.#state==='capture','CAPTURE_PHASE_INVALID');this.#phase('capture');const value=await this.#request('end_capture');this.#phase('capture');this.#state='captured';return value;}
 async beginFreshRead(){requireTrue(this.#state==='captured','FRESH_READ_PHASE_INVALID');this.#phase('captured');const value=await this.#request('begin_fresh_read');this.#phase('captured');this.#state='fresh_read';return value;}
 async freshReadQuery(sql){requireTrue(this.#state==='fresh_read','FRESH_READ_PHASE_INVALID');requireTrue(typeof sql==='string','BRIDGE_QUERY_INVALID');this.#phase('fresh_read');const value=await this.#request('fresh_read_query',sql);this.#phase('fresh_read');return value;}
 async endFreshRead(){requireTrue(this.#state==='fresh_read','FRESH_READ_PHASE_INVALID');this.#phase('fresh_read');const value=await this.#request('end_fresh_read');this.#phase('fresh_read');this.#state='fresh_read_complete';return value;}
 async readInitialState(){requireTrue(['fresh_read_complete','initial_ready'].includes(this.#state),'INITIAL_PHASE_INVALID');const expected=this.#state;this.#phase(expected);const value=await this.#request('read_initial_state');this.#phase(expected);if(value?.historyRows?.length===16&&value?.sourceRows?.length===16)this.#state='initial_ready';return value;}
 #context(context){
  const descriptors=context&&typeof context==='object'?Object.getOwnPropertyDescriptors(context):{},names=Reflect.ownKeys(descriptors);
  requireTrue(names.length===3&&names.every(name=>typeof name==='string')&&names.sort().join(',')==='actor,sourceSha,workflowRunId'&&names.every(name=>Object.hasOwn(descriptors[name],'value'))&&this.#workflow&&
   descriptors.actor.value===this.#workflow.GITHUB_ACTOR&&descriptors.sourceSha.value===this.#workflow.RELEASE_SHA&&
   descriptors.workflowRunId.value===this.#workflow.GITHUB_RUN_ID,'INITIAL_ARGUMENT_INVALID');
  return {actor:descriptors.actor.value,source_sha:descriptors.sourceSha.value,workflow_run_id:descriptors.workflowRunId.value};
 }
 async applyInitial(index,context){
  requireTrue(['fresh_read_complete','initial_ready'].includes(this.#state)&&Number.isSafeInteger(index)&&index>=0&&index<16,'INITIAL_PHASE_INVALID');
  const argument={index,...this.#context(context)},expected=this.#state;
  this.#phase(expected);
  try{
   const value=await this.#request('apply_initial',argument);this.#phase(expected);
   requireTrue(value?.applied_prefix===index+1&&value.atomic_transaction_committed===true&&value.exclusive_session_lock_retained===true,'INITIAL_COMMIT_UNPROVED');
   this.#state='initial_ready';return value;
  }catch(error){this.#abort('INITIAL_OPERATION_UNPROVED');throw error;}
 }
 async #fixedWrite(operation,context){
  requireTrue(this.#state==='initial_ready','INITIAL_PHASE_INVALID');
  const argument=this.#context(context);this.#phase('initial_ready');
  try{
   const value=await this.#request(operation,argument);this.#phase('initial_ready');
   requireTrue(value?.atomic_transaction_committed===true&&value.exclusive_session_lock_retained===true&&
    value.production_enabled===false&&value.v1_ready===false,'INITIAL_COMMIT_UNPROVED');
   if(operation==='configure_api')requireTrue(Object.keys(value).sort().join(',')===
    ['scope','api_schema_exposed','atomic_transaction_committed','exclusive_session_lock_retained','production_enabled','v1_ready'].sort().join(',')&&
    value.scope==='STAGING_API_EXPOSURE'&&value.api_schema_exposed===true,'STAGING_API_READBACK_UNVERIFIED');
   else{
    const counts=['tenants','member_grants','households','intake_profiles','seasons','obligations','bootstrap_audits','bootstrap_commands'];
    requireTrue(Object.keys(value).sort().join(',')===['scope','status','fixture_version','current_ledger_entries','auth_mutations','mail_sent','native_session_proven',
     'v1_ready','production_enabled','atomic_transaction_committed','exclusive_session_lock_retained',...counts].sort().join(',')&&
     value.scope==='STAGING_SYNTHETIC_CORE_V1'&&['created','already_configured'].includes(value.status)&&value.fixture_version===1&&
     counts.every(key=>value[key]===1)&&Number.isSafeInteger(value.current_ledger_entries)&&value.current_ledger_entries>=0&&
     ['auth_mutations','mail_sent','native_session_proven'].every(key=>value[key]===false),'STAGING_BOOTSTRAP_READBACK_UNVERIFIED');
   }
   return value;
  }catch(error){this.#abort('INITIAL_OPERATION_UNPROVED');throw error;}
 }
 async configureApi(context){return await this.#fixedWrite('configure_api',context);}
 async bootstrapCore(context){requireTrue(this.#recipientPresent,'STAGING_BOOTSTRAP_RECIPIENT_REQUIRED');return await this.#fixedWrite('bootstrap_core',context);}
 async close(){
  sourceBindings.delete(this);this.#closing=true;
  if(this.#state==='closed')return;
  const canClose=this.#waiting===null&&this.#state!=='failed';this.#state='closing';
  const killTimer=setTimeout(()=>this.#child.kill('SIGKILL'),2_000);
  let boundTimer;
  try{
   const shutdown=async()=>{
    try{if(canClose)await this.#request('close');}catch{}
    this.#child.stdin.end();await this.#closed;
   };
   await Promise.race([shutdown(),new Promise((_,reject)=>{boundTimer=setTimeout(()=>{
    this.#abort('BRIDGE_CLOSE_UNPROVED');this.#child.stdout.destroy();this.#child.stderr.destroy();
    reject(new BridgeError('BRIDGE_CLOSE_UNPROVED'));
   },5_000);})]);
   requireTrue(this.#exited,'BRIDGE_CLOSE_UNPROVED');
  }finally{clearTimeout(killTimer);clearTimeout(boundTimer);}
 }
}

// Reader is imported directly by the operational collector. There is no caller
// binding-reader option or public property which can register source authority.
const trustedMethods=Object.freeze(Object.fromEntries(['beginCapture','captureQuery','checkLock','endCapture','beginFreshRead','freshReadQuery','endFreshRead','readInitialState','applyInitial','configureApi','bootstrapCore','close']
 .map(name=>[name,InitialSession.prototype[name]])));
Object.freeze(InitialSession.prototype);
export function sourceBindingForInitialCollector(instance){
 const record=sourceBindings.get(instance);
 requireTrue(record&&record.active()&&Object.getPrototypeOf(instance)===InitialSession.prototype,'BRIDGE_SOURCE_REGISTRATION_REQUIRED');
 for(const [name,value]of Object.entries(trustedMethods)){
  const descriptor=Object.getOwnPropertyDescriptor(InitialSession.prototype,name);
  requireTrue(!Object.hasOwn(instance,name)&&descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.value===value,
   'BRIDGE_SOURCE_OPERATIONS_CHANGED');
 }
 const binding=record.binding;
 return Object.freeze({...binding,target:Object.freeze({...binding.target}),transport:Object.freeze({...binding.transport})});
}
