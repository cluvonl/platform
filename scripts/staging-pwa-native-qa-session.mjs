// Separate PWA owner; original native QA remains unchanged.
// Concrete private Native QA session. No arbitrary caller SQL or write recipe.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validatedConnectionEnvironment} from './staging-initial-session.mjs';
import {validatedStagingContext} from './staging-session-probe.mjs';
import {buildStagingNativeQaFixture} from './staging-pwa-native-qa-fixture.mjs';

const PROJECT='fbozlbgmktkgcdfqdaaz';
const CHILD=fileURLToPath(new URL('./staging_pwa_native_qa_session.py',import.meta.url));
export const NATIVE_QA_SESSION_CHILD_SHA256='e7ade85e6f36deab51c5fdc18789d8e37dbb636da9f8ba8cbcfeb12e8a66d40c';
const registrations=new WeakMap();
const hash=value=>createHash('sha256').update(value).digest('hex');
const lock=createHash('sha256').update(PROJECT).digest().readInt32BE(0);
export class NativeQaSessionError extends Error{constructor(code,sqlstate=null){super(code);this.code=code;this.sqlstate=sqlstate;}}
const need=(condition,code='STAGING_NATIVE_QA_SESSION_UNVERIFIED')=>{if(!condition)throw new NativeQaSessionError(code);};

function contextFromEnvironment(environment){
 const fixed=validatedStagingContext(environment);
 need(fixed.STAGING_SUPABASE_PROJECT_REF===PROJECT&&fixed.SUPABASE_URL==='https://'+PROJECT+'.supabase.co','STAGING_NATIVE_QA_PROJECT_REQUIRED');
 const descriptors=Object.getOwnPropertyDescriptors(environment);
 for(const key of ['GITHUB_RUN_ID','GITHUB_ACTOR'])need(descriptors[key]&&Object.hasOwn(descriptors[key],'value')&&typeof descriptors[key].value==='string','STAGING_NATIVE_QA_WORKFLOW_REQUIRED');
 const run=descriptors.GITHUB_RUN_ID.value,actor=descriptors.GITHUB_ACTOR.value;
 need(/^[1-9][0-9]{0,19}$/.test(run)&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(actor),'STAGING_NATIVE_QA_WORKFLOW_REQUIRED');
 return {fixed,context:Object.freeze({sourceSha:fixed.RELEASE_SHA,workflowRunId:run,actor,projectRef:PROJECT,environment:'staging'})};
}

export class NativeQaSession{
 #child;#waiting=null;#sequence=1;#buffer='';#bytes=0;#decoder=new TextDecoder('utf8',{fatal:true});#exited=false;#closed;#failed=false;#closing=false;#context;
 constructor(child,context){
  this.#child=child;this.#context=context;
  this.#closed=new Promise(resolve=>child.once('close',()=>{registrations.delete(this);this.#exited=true;this.#reject('STAGING_NATIVE_QA_SESSION_CLOSED');resolve();}));
  child.on('error',()=>this.#abort('STAGING_NATIVE_QA_PROCESS_FAILED'));
  for(const stream of [child.stdin,child.stdout,child.stderr])stream.on('error',()=>this.#abort('STAGING_NATIVE_QA_PIPE_FAILED'));
  child.stderr.on('data',()=>this.#abort('STAGING_NATIVE_QA_UNEXPECTED_STDERR'));
  child.stdout.on('data',chunk=>{
   this.#bytes+=chunk.length;if(this.#bytes>8_000_000)return this.#abort('STAGING_NATIVE_QA_RESPONSE_BOUND_EXCEEDED');
   try{this.#buffer+=this.#decoder.decode(chunk,{stream:true});}catch{return this.#abort('STAGING_NATIVE_QA_RESPONSE_INVALID');}
   const end=this.#buffer.indexOf('\n');if(end<0)return;
   const line=this.#buffer.slice(0,end);this.#buffer=this.#buffer.slice(end+1);
   if(!this.#waiting||this.#buffer!=='')return this.#abort('STAGING_NATIVE_QA_RESPONSE_INVALID');
   let value;try{value=JSON.parse(line);}catch{return this.#abort('STAGING_NATIVE_QA_RESPONSE_INVALID');}
   const pending=this.#waiting,keys=value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).sort().join(','):'';
   if(value?.id!==pending.id||typeof value.ok!=='boolean'||keys!==(value.ok?'id,ok,value':'code,id,ok,sqlstate')
    ||(!value.ok&&(!/^[A-Z][A-Z0-9_]{1,79}$/.test(value.code??'')||(value.sqlstate!==null&&!/^[0-9A-Z]{5}$/.test(value.sqlstate??'')))))return this.#abort('STAGING_NATIVE_QA_RESPONSE_INVALID');
   clearTimeout(pending.timer);this.#waiting=null;this.#bytes=0;
   if(value.ok)pending.resolve(value.value);
   else{pending.reject(new NativeQaSessionError(value.code,value.sqlstate));this.#abort('STAGING_NATIVE_QA_OPERATION_FAILED');}
  });
 }
 #reject(code){if(this.#waiting){clearTimeout(this.#waiting.timer);this.#waiting.reject(new NativeQaSessionError(code));this.#waiting=null;}}
 #abort(code){registrations.delete(this);this.#failed=true;this.#reject(code);if(!this.#exited)try{this.#child.kill('SIGKILL');}catch{}}
 async #request(operation,argument=null){
  need(!this.#waiting&&!this.#exited&&!this.#failed&&(!this.#closing||operation==='close'),'STAGING_NATIVE_QA_PHASE_INVALID');
  const id=this.#sequence++,raw=JSON.stringify({id,operation,argument})+'\n';need(Buffer.byteLength(raw)<=32_768,'STAGING_NATIVE_QA_INPUT_BOUND_EXCEEDED');
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.#abort('STAGING_NATIVE_QA_SESSION_TIMEOUT'),35_000);
   this.#waiting={id,resolve,reject,timer};
   try{this.#child.stdin.write(raw,error=>{if(error)this.#abort('STAGING_NATIVE_QA_PIPE_FAILED');});}catch{this.#abort('STAGING_NATIVE_QA_PIPE_FAILED');}
  });
 }
 static async connect(environment){
  const {fixed,context}=contextFromEnvironment(environment);
  need(/^[0-9a-f]{64}$/.test(NATIVE_QA_SESSION_CHILD_SHA256),'STAGING_NATIVE_QA_SOURCE_UNPINNED');
  const [bytes,info,validated]=await Promise.all([readFile(CHILD),lstat(CHILD),validatedConnectionEnvironment(environment)]);
  need(info.isFile()&&!info.isSymbolicLink()&&bytes.length<100_000&&hash(bytes)===NATIVE_QA_SESSION_CHILD_SHA256,'STAGING_NATIVE_QA_SOURCE_CHANGED');
  const workflow=Object.fromEntries(['GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA'].map(key=>[key,fixed[key]]));
  const child=spawn('/usr/bin/python3',['-B',CHILD],{env:{...validated.env,...workflow,APP_ENV:'staging',
   GITHUB_RUN_ID:context.workflowRunId,GITHUB_ACTOR:context.actor,PWA_NATIVE_QA_NODE_EXECUTABLE:process.execPath},stdio:['pipe','pipe','pipe']});
  const session=new NativeQaSession(child,context);
  try{
   const transport=await session.#request('connect',{lock_object:lock});
   need(transport?.client_tls===true&&['TLSv1.2','TLSv1.3'].includes(transport.client_tls_protocol)&&transport.postgres_version===170011&&transport.scope==='HOSTED_VERIFY_FULL','STAGING_NATIVE_QA_TRANSPORT_UNVERIFIED');
   need(hash(await readFile(CHILD))===NATIVE_QA_SESSION_CHILD_SHA256,'STAGING_NATIVE_QA_SOURCE_CHANGED');
   registrations.set(session,{context,active:()=>!session.#exited&&!session.#failed&&!session.#closing});
   await session.preflight();return session;
  }catch(error){await session.close();throw error;}
 }
 async preflight(){return await this.#request('preflight');}
 async setupFixture(providers){
  buildStagingNativeQaFixture({providers,sourceSha:this.#context.sourceSha,workflowRunId:this.#context.workflowRunId,actor:this.#context.actor,expectedVersion:0});
  return await this.#request('setup_fixture',providers);
 }
 async setupBooking(){return await this.#request('setup_booking');}
 async holdLastPosition(){return await this.#request('hold_last_position');}
 async countBlocked(){return await this.#request('count_blocked');}
 async releaseHolder(){return await this.#request('release_holder');}
 async bookingReadback(){return await this.#request('booking_readback');}
 async scopedAutomationProof(){return await this.#request('scoped_automation_proof');}
 async teardown(providers=null){return await this.#request('teardown',providers);}
 async close(){
  registrations.delete(this);this.#closing=true;if(this.#exited)return;
  const kill=setTimeout(()=>{if(!this.#exited)this.#child.kill('SIGKILL');},2000);let deadline;
  try{
   if(!this.#failed&&!this.#waiting)try{await this.#request('close');}catch{}
   this.#child.stdin.end();await Promise.race([this.#closed,new Promise((_,reject)=>{deadline=setTimeout(()=>{this.#child.kill('SIGKILL');reject(new NativeQaSessionError('STAGING_NATIVE_QA_CLOSE_UNPROVED'));},5000);})]);
   need(this.#exited,'STAGING_NATIVE_QA_CLOSE_UNPROVED');
  }finally{clearTimeout(kill);clearTimeout(deadline);}
 }
}

const trusted=Object.freeze(Object.fromEntries(['preflight','setupFixture','setupBooking','holdLastPosition','countBlocked','releaseHolder','bookingReadback','scopedAutomationProof','teardown','close'].map(name=>[name,NativeQaSession.prototype[name]])));
Object.freeze(NativeQaSession.prototype);
export async function authorizeNativeQaProvider(owner,context){
 const registration=registrations.get(owner);
 need(registration&&registration.active()&&Object.getPrototypeOf(owner)===NativeQaSession.prototype,'STAGING_NATIVE_QA_OWNER_REQUIRED');
 for(const [name,method]of Object.entries(trusted))need(!Object.hasOwn(owner,name)&&NativeQaSession.prototype[name]===method,'STAGING_NATIVE_QA_OWNER_CHANGED');
 need(context&&Object.isFrozen(context)&&Object.keys(context).sort().join(',')==='actor,environment,projectRef,sourceSha,workflowRunId'
  &&Object.entries(registration.context).every(([key,value])=>Object.getOwnPropertyDescriptor(context,key)?.value===value),'STAGING_NATIVE_QA_CONTEXT_MISMATCH');
 await owner.preflight();need(registration.active(),'STAGING_NATIVE_QA_OWNER_CLOSED');
 return Object.freeze({authorized:true,...registration.context});
}
