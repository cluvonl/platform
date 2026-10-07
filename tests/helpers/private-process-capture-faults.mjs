import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const MODULE=new URL('../../scripts/private-process-capture.mjs',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const ENV={PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'};
const results=[];
const adapter=await import(MODULE.href);
async function fixture(){const path=await fsp.mkdtemp('/tmp/cluvo-process-probe-');await fsp.chmod(path,0o700);return path;}
const missing=async path=>{try{await fsp.lstat(path);return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}};
function pidAbsent(pid){try{process.kill(pid,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}}
const failure=async promise=>{try{await promise;throw new Error('UNEXPECTED_SUCCESS');}catch(error){assert.ok(error instanceof adapter.CaptureError);assert.equal(error.message,error.code);assert.match(error.code,/^[A-Z0-9_]+$/);return error.code;}};
async function failureCase(id,code,program,{maximumBytes=8192,timeoutMs=1000,pid=false,command=process.execPath}={}){
 const path=await fixture(),marker=join(path,'own-child.pid');let childPid;
 try{
  const source=pid?`require('node:fs').writeFileSync(process.argv[1],String(process.pid),{mode:0o600});${program}`:program;
  const actual=await failure(adapter.capturePrivateOutput(command,['-e',source,marker],ENV,path,'database.dump',{maximumBytes,timeoutMs}));
  assert.equal(actual,code);assert.equal(await missing(join(path,'database.dump')),true);
  if(pid){childPid=Number(await fsp.readFile(marker,'utf8'));assert.ok(Number.isSafeInteger(childPid)&&childPid>0);assert.equal(pidAbsent(childPid),true);}
  results.push({id,pass:true,code:actual,outputPathRemoved:true,...(pid?{ownDirectChildReaped:true}:{})});
 }finally{if(childPid&&!pidAbsent(childPid))process.kill(childPid,'SIGKILL');await fsp.rm(path,{recursive:true,force:true});}
}
{
 const path=await fixture();try{
  const program=`let i=0;function next(){if(i===64)return;const bytes=Buffer.alloc(32768,i++);if(process.stdout.write(bytes))setImmediate(next);else process.stdout.once('drain',next);}next();`;
  const r=await adapter.capturePrivateOutput(process.execPath,['-e',program],ENV,path,'database.dump',{maximumBytes:3*1024*1024,timeoutMs:5000});
  const bytes=await fsp.readFile(join(path,'database.dump')),expected=Buffer.concat(Array.from({length:64},(_,i)=>Buffer.alloc(32768,i)));
  assert.equal(r.bytes,2097152);assert.equal(sha(bytes),sha(expected));const st=await fsp.stat(join(path,'database.dump'));assert.equal(st.mode&0o777,0o600);assert.equal(st.nlink,1);
  results.push({id:'REAL_MULTICHUNK_2MIB_PRIVATE_OUTPUT',pass:true,bytes:r.bytes,byteHashEqual:true,mode600:true,nlink1:true});
 }finally{await fsp.rm(path,{recursive:true,force:true});}
}
await failureCase('STDERR_REJECTED_AND_REAPED','CAPTURE_UNEXPECTED_STDERR',`process.stdout.write('synthetic');process.stderr.write('synthetic diagnostic');setInterval(()=>{},1000);`,{pid:true});
await failureCase('NONZERO_REJECTED','CAPTURE_PROCESS_FAILED',`process.stdout.write('synthetic');process.exitCode=7;`);
await failureCase('EMPTY_REJECTED','CAPTURE_EMPTY_OR_OVERSIZED',`process.exitCode=0;`);
await failureCase('SIZE_LIMIT_REJECTED_AND_REAPED','CAPTURE_SIZE_LIMIT',`setInterval(()=>process.stdout.write(Buffer.alloc(1024)),2);`,{pid:true});
await failureCase('TIMEOUT_TERM_IGNORED_KILL_AND_REAP','CAPTURE_PROCESS_TIMEOUT',`process.on('SIGTERM',()=>{});process.stdout.write('synthetic');setInterval(()=>{},1000);`,{pid:true,timeoutMs:200});
await failureCase('SPAWN_FAILURE_REMOVES_CREATED_PATH','CAPTURE_PROCESS_UNAVAILABLE',``,{command:'/tmp/cluvo-synthetic-command-does-not-exist'});
async function injectedCase(mode){
 const path=await fixture(),target=join(path,'globals.sql');const real={open:fsp.open,unlink:fsp.unlink};let active=false;const handles=[];let unlinkCalls=0;
 try{
  fsp.open=async(...args)=>{
   const handle=await real.open(...args);if(!active||args[0]!==target)return handle;handles.push(handle);
   return new Proxy(handle,{get(object,key){
    if(key==='writeFile'&&mode==='write-close')return async(bytes)=>{await object.writeFile(bytes);throw new Error('SYNTHETIC_WRITE_ERROR');};
    if(key==='close'&&(mode==='write-close'||mode==='close'))return async()=>{throw new Error('SYNTHETIC_CLOSE_ERROR');};
    if(key==='sync'&&mode==='sync')return async()=>{throw new Error('SYNTHETIC_SYNC_ERROR');};
    const value=Reflect.get(object,key,object);return typeof value==='function'?value.bind(object):value;
   }});
  };
  fsp.unlink=async(...args)=>{if(active&&args[0]===target){unlinkCalls++;if(mode==='unlink'){const error=new Error('SYNTHETIC_UNLINK_ERROR');error.code='EACCES';throw error;}}return real.unlink(...args);};syncBuiltinESMExports();active=true;
  const program=mode==='unlink'?`process.stdout.write('synthetic');process.exitCode=7;`:`process.stdout.write('synthetic');`;
  const code=await failure(adapter.capturePrivateOutput(process.execPath,['-e',program],ENV,path,'globals.sql',{maximumBytes:8192,timeoutMs:2000}));active=false;
  assert.equal(code,mode==='sync'?'PRIVATE_CAPTURE_FAILED':'PRIVATE_CAPTURE_CLEANUP_FAILED');assert.ok(unlinkCalls>0);
  const removed=await missing(target);assert.equal(removed,mode!=='unlink');
  results.push({id:mode.toUpperCase().replaceAll('-','_')+'_FAULT',pass:true,code,unlinkAttempted:true,outputPathRemoved:removed,residualReportedByCleanupFailure:mode==='unlink',probeOwnHandlesClosedAfterObservation:true,probeOwnResidualRemovedAfterObservation:true});
 }finally{active=false;fsp.open=real.open;fsp.unlink=real.unlink;syncBuiltinESMExports();for(const handle of handles)await handle.close().catch(()=>{});await fsp.rm(path,{recursive:true,force:true});}
}
for(const mode of ['write-close','close','sync','unlink'])await injectedCase(mode);
{
 const path=await fixture();try{
  const args=['-e',`process.stdout.write('initial:'+process.env.SYNTHETIC_CONTEXT);`],environment={...ENV,SYNTHETIC_CONTEXT:'initial'};
  const pending=adapter.capturePrivateOutput(process.execPath,args,environment,path,'database.dump',{maximumBytes:8192,timeoutMs:2000});
  args[1]=`process.stdout.write('changed:'+process.env.SYNTHETIC_CONTEXT);`;environment.SYNTHETIC_CONTEXT='changed';
  await pending;const changed=(await fsp.readFile(join(path,'database.dump'),'utf8'))==='initial:initial';assert.equal(changed,true);
  results.push({id:'ARGS_AND_ENV_SNAPSHOTS_BEFORE_AWAIT',pass:true,preservedOriginalCommandArguments:true,preservedOriginalEnvironment:true});
 }finally{await fsp.rm(path,{recursive:true,force:true});}
}
async function deniedInputs(id,args,environment,code,getterCalls){
 const path=await fixture();try{
  const actual=await failure(adapter.capturePrivateOutput(process.execPath,args,environment,path,'database.dump',{maximumBytes:8192,timeoutMs:1000}));assert.equal(actual,code);assert.equal(await missing(join(path,'database.dump')),true);
  if(getterCalls)assert.equal(getterCalls(),0);
  results.push({id,pass:true,code:actual,noFileCreated:true,...(getterCalls?{getterNotInvoked:true}:{})});
 }finally{await fsp.rm(path,{recursive:true,force:true});}
}
{
 let calls=0;const args=['-e',''];Object.defineProperty(args,'1',{get(){calls++;throw new Error('SYNTHETIC_GETTER_SHOULD_NOT_RUN');},enumerable:true});
 await deniedInputs('ARGS_GETTER_DENIED',args,ENV,'CAPTURE_COMMAND_REQUIRED',()=>calls);
}
{
 let calls=0;const environment={...ENV};Object.defineProperty(environment,'SYNTHETIC',{get(){calls++;throw new Error('SYNTHETIC_GETTER_SHOULD_NOT_RUN');},enumerable:true});
 await deniedInputs('ENV_GETTER_DENIED',['-e',''],environment,'CAPTURE_ENVIRONMENT_REQUIRED',()=>calls);
}
{const args=['-e',''];args[Symbol('synthetic')]='';await deniedInputs('ARGS_SYMBOL_DENIED',args,ENV,'CAPTURE_COMMAND_REQUIRED');}
{const environment={...ENV};environment[Symbol('synthetic')]='';await deniedInputs('ENV_SYMBOL_DENIED',['-e',''],environment,'CAPTURE_ENVIRONMENT_REQUIRED');}
{const args=['-e'];args.length=2;await deniedInputs('SPARSE_ARGS_DENIED',args,ENV,'CAPTURE_COMMAND_REQUIRED');}
{const environment=Object.create({SYNTHETIC:'inherited'});environment.PATH=ENV.PATH;await deniedInputs('UNKNOWN_ENV_PROTOTYPE_DENIED',['-e',''],environment,'CAPTURE_ENVIRONMENT_REQUIRED');}
await deniedInputs('NUL_ENV_VALUE_DENIED',['-e',''],{...ENV,SYNTHETIC:'x\0y'},'CAPTURE_ENVIRONMENT_REQUIRED');
await deniedInputs('OVER128K_ARGUMENTS_DENIED',['-e','x'.repeat(128001)],ENV,'CAPTURE_COMMAND_REQUIRED');
{
 const path=await fixture();try{
  const environment=new Proxy({...ENV},{ownKeys(){throw new Error('SYNTHETIC_PROXY_PRIVATE_ERROR');}});let raw=false;
  try{await adapter.capturePrivateOutput(process.execPath,['-e',''],environment,path,'database.dump',{maximumBytes:8192,timeoutMs:1000});throw new Error('UNEXPECTED_SUCCESS');}catch(error){raw=error instanceof adapter.CaptureError&&error.message==='PRIVATE_CAPTURE_FAILED'&&error.code==='PRIVATE_CAPTURE_FAILED';}
  assert.equal(raw,true);assert.equal(await missing(join(path,'database.dump')),true);
  results.push({id:'PROXY_REFLECTION_ERROR_FIXED',pass:true,code:'PRIVATE_CAPTURE_FAILED',rawValidationErrorReturned:false,noFileCreated:true});
 }finally{await fsp.rm(path,{recursive:true,force:true});}
}
const report={scope:'SYNTHETIC_FILESYSTEM_AND_OWN_CHILDREN_ONLY',source_sha256:sha(await fsp.readFile(MODULE)),executed_probes:results.length,actual_expected_controls_passed:results.filter(r=>r.pass).length,actual_confirmed_defects:results.filter(r=>r.confirmedDefect).length,results,database_calls:0,docker_calls:0,remote_calls:0,canonical_writes:0,existing_private_backup_reads:0,credential_values_used_or_printed:false};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
