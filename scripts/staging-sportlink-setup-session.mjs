// Private source-bound pipe owner. No arbitrary SQL, tenant, user or grant input.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validatedConnectionEnvironment} from './staging-session-bridge.mjs';
import {validatedStagingContext} from './staging-session-probe.mjs';
import {buildStagingSportlinkSetup} from './staging-sportlink-setup-sql.mjs';

const CHILD=fileURLToPath(new URL('./staging_sportlink_setup_session.py',import.meta.url));
export const SPORTLINK_SETUP_CHILD_SHA256='18b4ff9a3c5fee9f357042546ed3476bc5b98ab620c8d45fc9a985e48494f32d';
const hash=value=>createHash('sha256').update(value).digest('hex');
const need=(v,code)=>{if(!v)throw Object.assign(Error(code),{code});};
export class SportlinkSetupSession{
 #child;#pending;#sequence=1;#buffer='';#decoder=new TextDecoder('utf8',{fatal:true});#bytes=0;#exited=false;#failed=false;#closed;#recipient;
 constructor(child,recipient){
  this.#child=child;this.#recipient=recipient;
  this.#closed=new Promise(resolve=>child.once('close',()=>{this.#exited=true;this.#reject();resolve();}));
  child.on('error',()=>this.#abort());
  for(const stream of [child.stdin,child.stdout,child.stderr])stream.on('error',()=>this.#abort());
  child.stderr.on('data',()=>this.#abort());
  child.stdout.on('data',chunk=>{
   this.#bytes+=chunk.length;if(this.#bytes>16384)return this.#abort();
   try{this.#buffer+=this.#decoder.decode(chunk,{stream:true});}catch{return this.#abort();}
   const end=this.#buffer.indexOf('\n');if(end<0)return;
   const raw=this.#buffer.slice(0,end);this.#buffer=this.#buffer.slice(end+1);
   if(!this.#pending||this.#buffer!=='')return this.#abort();
   let value;try{value=JSON.parse(raw);}catch{return this.#abort();}
   const wanted=value?.ok===true?'id,ok,value':'code,id,ok,sqlstate';
   if(value?.id!==this.#pending.id||typeof value.ok!=='boolean'||Object.keys(value).sort().join(',')!==wanted
    ||(!value.ok&&(!/^[A-Z][A-Z0-9_]{1,79}$/.test(value.code??'')||(value.sqlstate!==null&&!/^[0-9A-Z]{5}$/.test(value.sqlstate??'')))))return this.#abort();
   const pending=this.#pending;clearTimeout(pending.timer);this.#pending=undefined;this.#bytes=0;
   if(value.ok)pending.resolve(value.value);else{pending.reject(Object.assign(Error('STAGING_SPORTLINK_SETUP_DATABASE_REFUSED'),{code:'STAGING_SPORTLINK_SETUP_DATABASE_REFUSED'}));this.#abort();}
  });
 }
 #reject(){if(this.#pending){clearTimeout(this.#pending.timer);this.#pending.reject(Object.assign(Error('STAGING_SPORTLINK_SETUP_PIPE_REFUSED'),{code:'STAGING_SPORTLINK_SETUP_PIPE_REFUSED'}));this.#pending=undefined;}}
 #abort(){this.#failed=true;this.#reject();if(!this.#exited)try{this.#child.kill('SIGKILL');}catch{}}
 async #request(operation,argument=null){
  need(!this.#pending&&!this.#failed&&!this.#exited,'STAGING_SPORTLINK_SETUP_PHASE_REFUSED');
  const id=this.#sequence++,raw=JSON.stringify({id,operation,argument})+'\n';need(Buffer.byteLength(raw)<=16384,'STAGING_SPORTLINK_SETUP_INPUT_BOUND');
  return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>this.#abort(),35000);this.#pending={id,timer,resolve,reject};
   try{this.#child.stdin.write(raw,error=>{if(error)this.#abort();});}catch{this.#abort();}
  });
 }
 static async connect(environment){
  const fixed=validatedStagingContext(environment),run=environment.GITHUB_RUN_ID,actor=environment.GITHUB_ACTOR,recipient=environment.STAGING_TEST_RECIPIENT;
  need(fixed.STAGING_SUPABASE_PROJECT_REF==='fbozlbgmktkgcdfqdaaz'&&fixed.SUPABASE_URL==='https://fbozlbgmktkgcdfqdaaz.supabase.co','STAGING_SPORTLINK_SETUP_PROJECT_REFUSED');
  buildStagingSportlinkSetup({recipient,sourceSha:fixed.RELEASE_SHA,workflowRunId:run,actor,expectedVersion:0});
  const [bytes,info,validated]=await Promise.all([readFile(CHILD),lstat(CHILD),validatedConnectionEnvironment(environment)]);
  need(info.isFile()&&!info.isSymbolicLink()&&bytes.length<100000&&hash(bytes)===SPORTLINK_SETUP_CHILD_SHA256,'STAGING_SPORTLINK_SETUP_SOURCE_CHANGED');
  const workflow=Object.fromEntries(['GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA'].map(k=>[k,fixed[k]]));
  const child=spawn('/usr/bin/python3',['-B',CHILD],{env:{...validated.env,...workflow,APP_ENV:'staging',
   GITHUB_RUN_ID:run,GITHUB_ACTOR:actor,SPORTLINK_SETUP_NODE_EXECUTABLE:process.execPath},stdio:['pipe','pipe','pipe']});
  const owner=new SportlinkSetupSession(child,recipient);
  try{
   const transport=await owner.#request('connect');
   need(transport?.scope==='HOSTED_VERIFY_FULL'&&transport.postgres_version===170011&&transport.client_tls===true
    &&['TLSv1.2','TLSv1.3'].includes(transport.client_tls_protocol),'STAGING_SPORTLINK_SETUP_TLS_UNPROVED');
   need(hash(await readFile(CHILD))===SPORTLINK_SETUP_CHILD_SHA256,'STAGING_SPORTLINK_SETUP_SOURCE_CHANGED');
   const preflight=await owner.#request('preflight',owner.#recipient);
   need(preflight?.schema_target_verified===true&&preflight.migration_count===36&&Object.keys(preflight).length===2,'STAGING_SPORTLINK_SETUP_SCHEMA_UNPROVED');
   return owner;
  }catch(error){await owner.close();throw error;}
 }
 async provision(){return await this.#request('provision');}
 async verifySession(authUserId,sessionId){return await this.#request('verify_session',{auth_user_id:authUserId,session_id:sessionId});}
 async readback(){return await this.#request('readback');}
 async close(){
  if(this.#exited)return;
  let deadline;
  try{
   if(!this.#failed&&!this.#pending)try{await this.#request('close');}catch{}
   this.#child.stdin.end();await Promise.race([this.#closed,new Promise((_,reject)=>{deadline=setTimeout(()=>{this.#child.kill('SIGKILL');reject(Error('STAGING_SPORTLINK_SETUP_CLOSE_UNPROVED'));},5000);})]);
   need(this.#exited,'STAGING_SPORTLINK_SETUP_CLOSE_UNPROVED');
  }finally{clearTimeout(deadline);this.#recipient=undefined;}
 }
}
Object.freeze(SportlinkSetupSession.prototype);
