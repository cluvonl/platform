// Bounded private subprocess output capture. Caller owns command authorization.
// No environment read, shell, database action, logs, or CLI on import.
import {spawn} from 'node:child_process';
import {constants} from 'node:fs';
import {open,lstat,unlink} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {Transform,Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export class CaptureError extends Error{constructor(code){super(code);this.code=code;}}
const requireValue=(v,code)=>{if(!v)throw new CaptureError(code);};
const PRIVATE_FILES=new Set(['database.dump','globals.sql']);
const fixed=error=>error instanceof CaptureError?error:new CaptureError('PRIVATE_CAPTURE_FAILED');

function invocation(args,environment){
 requireValue(Array.isArray(args)&&args.length<=2000,'CAPTURE_COMMAND_REQUIRED');
 const ad=Object.getOwnPropertyDescriptors(args),values=[];
 requireValue(Reflect.ownKeys(ad).length===args.length+1,'CAPTURE_COMMAND_REQUIRED');
 let argumentBytes=0;
 for(let i=0;i<args.length;i++){
  const d=ad[i];requireValue(d&&Object.hasOwn(d,'value')&&typeof d.value==='string'&&!d.value.includes('\0'),'CAPTURE_COMMAND_REQUIRED');
  argumentBytes+=Buffer.byteLength(d.value);requireValue(argumentBytes<=128000,'CAPTURE_COMMAND_REQUIRED');values.push(d.value);
 }
 requireValue(environment&&typeof environment==='object'&&!Array.isArray(environment)
  &&[Object.prototype,null].includes(Object.getPrototypeOf(environment)),'CAPTURE_ENVIRONMENT_REQUIRED');
 const ed=Object.getOwnPropertyDescriptors(environment),copy=Object.create(null);let environmentBytes=0;
 requireValue(Reflect.ownKeys(ed).length<=2000,'CAPTURE_ENVIRONMENT_REQUIRED');
 for(const key of Reflect.ownKeys(ed)){
  const d=ed[key];requireValue(typeof key==='string'&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
   &&Object.hasOwn(d,'value')&&typeof d.value==='string'&&!d.value.includes('\0'),'CAPTURE_ENVIRONMENT_REQUIRED');
  environmentBytes+=Buffer.byteLength(key)+Buffer.byteLength(d.value);requireValue(environmentBytes<=128000,'CAPTURE_ENVIRONMENT_REQUIRED');copy[key]=d.value;
 }
 return{args:Object.freeze(values),environment:Object.freeze(copy)};
}

async function directory(path){
 requireValue(typeof path==='string'&&isAbsolute(path),'PRIVATE_DIRECTORY_REQUIRED');
 const s=await lstat(path);
 requireValue(s.isDirectory()&&!s.isSymbolicLink()&&(s.mode&0o777)===0o700&&s.uid===process.getuid(),'PRIVATE_DIRECTORY_REQUIRED');
}

async function removeCreated(path){
 try{await unlink(path);}catch(e){if(e?.code!=='ENOENT')throw new CaptureError('PRIVATE_CAPTURE_CLEANUP_FAILED');}
}

export async function capturePrivateOutput(command,args,environment,privateDirectory,name,options={}){
 let immutable,maximumBytes,timeoutMs;
 try{
  requireValue(typeof command==='string'&&isAbsolute(command)&&!command.includes('\0'),'CAPTURE_COMMAND_REQUIRED');
  // Capture validated data descriptors before the first filesystem await. Caller
  // mutation/getters cannot change the process command or private environment.
  immutable=invocation(args,environment);
  requireValue(options&&typeof options==='object'&&Object.getPrototypeOf(options)===Object.prototype,'CAPTURE_BOUNDS_REQUIRED');
  const ds=Object.getOwnPropertyDescriptors(options),keys=Reflect.ownKeys(ds);
  requireValue(keys.length>=1&&keys.length<=2&&keys.every(k=>['maximumBytes','timeoutMs'].includes(k)&&Object.hasOwn(ds[k],'value'))&&Object.hasOwn(ds,'maximumBytes'),'CAPTURE_BOUNDS_REQUIRED');
  maximumBytes=ds.maximumBytes.value;timeoutMs=Object.hasOwn(ds,'timeoutMs')?ds.timeoutMs.value:600000;
  requireValue(PRIVATE_FILES.has(name)&&Number.isSafeInteger(maximumBytes)&&maximumBytes>0&&maximumBytes<=64*1024*1024&&Number.isSafeInteger(timeoutMs)&&timeoutMs>=1&&timeoutMs<=600000,'CAPTURE_BOUNDS_REQUIRED');
  await directory(privateDirectory);
 }catch(error){throw fixed(error);}
 const path=join(privateDirectory,name);let handle,created=false,child,closed,deadline,killer,failure,stderr=false,spawnError=false,bytes=0;
 try{
  handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);created=true;await handle.chmod(0o600);
  // Environment is explicit. Secrets may travel through private process ENV,
  // never shell/argv/output. No caller process environment is inherited.
  child=spawn(command,immutable.args,{env:immutable.environment,stdio:['ignore','pipe','pipe']});
  closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
  const stop=code=>{
   failure??=new CaptureError(code);
   child.kill('SIGTERM');
   killer??=setTimeout(()=>{child.kill('SIGKILL');child.stdout.destroy();child.stderr.destroy();},2000);
  };
  child.once('error',()=>{spawnError=true;stop('CAPTURE_PROCESS_UNAVAILABLE');});
  child.stderr.on('data',()=>{stderr=true;stop('CAPTURE_UNEXPECTED_STDERR');});
  deadline=setTimeout(()=>stop('CAPTURE_PROCESS_TIMEOUT'),timeoutMs);
  const bounded=new Transform({transform(chunk,encoding,done){
   bytes+=chunk.length;
   if(bytes>maximumBytes){stop('CAPTURE_SIZE_LIMIT');done(new CaptureError('CAPTURE_SIZE_LIMIT'));return;}
   done(null,chunk);
  }});
  // FileHandle's stream owns no close: explicit fsync/close follows process
  // success. A private output byte never goes to stdout or a tool log.
  const output=new Writable({write(chunk,encoding,done){
   handle.writeFile(chunk).then(()=>done(),()=>done(new CaptureError('CAPTURE_FILE_WRITE_FAILED')));
  }});
  try{await pipeline(child.stdout,bounded,output);}catch(error){failure??=fixed(error);stop(failure.code);}
  const exit=await closed;
  requireValue(!failure&&!spawnError&&!stderr&&exit.code===0&&exit.signal===null,'CAPTURE_PROCESS_FAILED');
  requireValue(bytes>0&&bytes<=maximumBytes,'CAPTURE_EMPTY_OR_OVERSIZED');
  await handle.sync();const stat=await handle.stat();
  requireValue(stat.isFile()&&stat.nlink===1&&(stat.mode&0o777)===0o600&&stat.size===bytes,'CAPTURE_FILE_INVALID');
  await handle.close();handle=null;
  return Object.freeze({file:name,bytes,private_mode:0o600,process_exit_code:0,stderr_empty:true});
 }catch(error){
  failure??=fixed(error);
  if(child&&closed){child.kill('SIGTERM');killer??=setTimeout(()=>{child.kill('SIGKILL');child.stdout.destroy();child.stderr.destroy();},2000);await closed;}
  let cleanupFailed=false;
  try{await handle?.close();}catch{cleanupFailed=true;}finally{handle=null;}
  if(created){try{await removeCreated(path);}catch{cleanupFailed=true;}}
  if(cleanupFailed)throw new CaptureError('PRIVATE_CAPTURE_CLEANUP_FAILED');
  throw failure;
 }finally{clearTimeout(deadline);clearTimeout(killer);}
}
