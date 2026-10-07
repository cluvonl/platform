import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const MODULE=new URL('../../scripts/backup-artifact.mjs',import.meta.url).href;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const execute=promisify(execFile);
const fixed=error=>typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'NON_FIXED_ERROR';
const worker=process.argv[2];
async function fixture(adapter){
 const base=await fsp.mkdtemp('/tmp/cluvo-artifact-v2-probe-');await fsp.chmod(base,0o700);
 const paths=Object.fromEntries(['capture','artifact','restore'].map(name=>[name,join(base,name)]));
 for(const path of Object.values(paths))await fsp.mkdir(path,{mode:0o700});
 const files={'database.dump':Buffer.from('synthetic-database-only'),'globals.sql':Buffer.from('-- synthetic-globals-only\n'),'manifest.private.json':Buffer.from('{"fixture":"synthetic-only"}')};
 for(const [name,bytes]of Object.entries(files))await fsp.writeFile(join(paths.capture,name),bytes,{mode:0o600});
 const bundle=adapter.packFiles(files),key=randomBytes(32);
 const bindings={schema_version:1,environment:'staging',project_ref:'fbozlbgmktkgcdfqdaaz',source_sha:'1'.repeat(40),migration_manifest_sha256:'2'.repeat(64),snapshot_manifest_sha256:sha(files['manifest.private.json']),content_sha256:sha(bundle)};
 return{base,paths,files,bundle,key,bindings};
}
if(worker==='fifo'){
 const adapter=await import(MODULE),p=await fixture(adapter);
 try{
  await fsp.unlink(join(p.paths.capture,'database.dump'));
  await execute('/usr/bin/mkfifo',['-m','600',join(p.paths.capture,'database.dump')]);
  process.stdout.write(JSON.stringify({phase:'FIFO_READY',synthetic:true,scratchDirectory:p.base})+'\n');
  const before=performance.now();let code;
  try{await adapter.encryptCaptureFiles(p.paths.capture,p.paths.artifact,p.key,p.bindings);code='UNEXPECTED_SUCCESS';}catch(error){code=fixed(error);}
  process.stdout.write(JSON.stringify({phase:'FIFO_RESULT',code,rejectionUnder1500ms:performance.now()-before<1500,artifactDirectories:(await fsp.readdir(p.paths.artifact)).length})+'\n');
 }finally{p.key.fill(0);p.bundle.fill(0);await fsp.rm(p.base,{recursive:true,force:true});}
}else if(worker==='input-close'){
 const originalOpen=fsp.open;let active=false,readBuffer;const retained=[];
 fsp.open=async(...args)=>{
  const handle=await originalOpen(...args);
  if(!active||!String(args[0]).endsWith('/database.dump')||(args[1]&fs.constants.O_WRONLY))return handle;
  retained.push(handle);
  return new Proxy(handle,{get(target,key){
   if(key==='read')return async(...values)=>{readBuffer=values[0];return target.read(...values);};
   if(key==='close')return async()=>{throw new Error('SYNTHETIC_INPUT_CLOSE_FAILURE');};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
 };syncBuiltinESMExports();const adapter=await import(MODULE),p=await fixture(adapter);let code;
 try{
  active=true;try{await adapter.encryptCaptureFiles(p.paths.capture,p.paths.artifact,p.key,p.bindings);code='UNEXPECTED_SUCCESS';}catch(error){code=fixed(error);}active=false;
  process.stdout.write(JSON.stringify({phase:'INPUT_CLOSE_RESULT',code,privateReadBufferZeroed:Buffer.isBuffer(readBuffer)&&readBuffer.every(value=>value===0),artifactDirectories:(await fsp.readdir(p.paths.artifact)).length,synthetic:true})+'\n');
 }finally{active=false;fsp.open=originalOpen;syncBuiltinESMExports();for(const handle of retained)await handle.close().catch(()=>{});p.key.fill(0);p.bundle.fill(0);await fsp.rm(p.base,{recursive:true,force:true});}
}else if(worker?.startsWith('fault-')){
 const originals={open:fsp.open,unlink:fsp.unlink,rmdir:fsp.rmdir};let active=false,restoreParent,targetPath;const retained=[];
 const second=worker==='fault-close-second',closeFault=worker==='fault-close'||second,unlinkFault=worker==='fault-unlink',directoryFault=worker==='fault-rmdir';
 const targetName=second?'globals.sql':'database.dump';
 fsp.open=async(...args)=>{
  const handle=await originals.open(...args);
  if(!active||!String(args[0]).endsWith('/'+targetName)||!(args[1]&fs.constants.O_WRONLY))return handle;
  targetPath=String(args[0]);retained.push(handle);
  return new Proxy(handle,{get(target,key){
   if(key==='writeFile')return async(bytes)=>{await target.writeFile(bytes);throw new Error('SYNTHETIC_WRITE_FAILURE');};
   if(key==='close'&&closeFault)return async()=>{throw new Error('SYNTHETIC_CLOSE_FAILURE');};
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
 };
 fsp.unlink=async(path,...rest)=>{if(active&&unlinkFault&&path===targetPath){const error=new Error('SYNTHETIC_UNLINK_FAILURE');error.code='EACCES';throw error;}return originals.unlink(path,...rest);};
 fsp.rmdir=async(path,...rest)=>{if(active&&directoryFault&&String(path).startsWith(restoreParent+'/')){const error=new Error('SYNTHETIC_RMDIR_FAILURE');error.code='EACCES';throw error;}return originals.rmdir(path,...rest);};
 syncBuiltinESMExports();const adapter=await import(MODULE),p=await fixture(adapter);let code;
 try{
  const artifact=await adapter.encryptCaptureFiles(p.paths.capture,p.paths.artifact,p.key,p.bindings);restoreParent=p.paths.restore;active=true;
  try{await adapter.decryptRestoreFiles(artifact.directory,p.paths.restore,p.key,p.bindings);code='UNEXPECTED_SUCCESS';}catch(error){code=fixed(error);}
  active=false;let filesRemaining=0,nonPrivateFile=false;
  const children=await fsp.readdir(p.paths.restore);
  for(const child of children)for(const name of await fsp.readdir(join(p.paths.restore,child))){filesRemaining++;const st=await fsp.stat(join(p.paths.restore,child,name));nonPrivateFile||=(st.mode&0o777)!==0o600;}
  process.stdout.write(JSON.stringify({phase:'FAULT_RESULT',code,restoreDirectoriesRemaining:children.length,filesRemaining,nonPrivateFile,synthetic:true})+'\n');
 }finally{
  active=false;Object.assign(fsp,originals);syncBuiltinESMExports();
  for(const handle of retained)await handle.close().catch(()=>{});
  p.key.fill(0);p.bundle.fill(0);await fsp.rm(p.base,{recursive:true,force:true});
 }
}else{
 const results=[];
 async function runWorker(name,timeoutMs=1500){
  return await new Promise((resolve,reject)=>{
   const child=spawn(process.execPath,[new URL(import.meta.url).pathname,name],{stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin'}});
   let output='',timedOut=false,ready=false,timer;
   child.stdout.on('data',chunk=>{output+=chunk.toString();if(name==='fifo'&&!ready&&output.includes('FIFO_READY')){ready=true;timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},timeoutMs);}});
   child.stderr.on('data',()=>{});
   if(name!=='fifo')timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},10000);
   const startup=setTimeout(()=>{if(!ready&&name==='fifo'){timedOut=true;child.kill('SIGKILL');}},10000);
   child.on('error',reject);
   child.on('close',(exitCode,signal)=>{clearTimeout(timer);clearTimeout(startup);resolve({exitCode,signal,timedOut,events:output.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))});});
  });
 }
 const fifo=await runWorker('fifo');
 for(const event of fifo.events)if(event.phase==='FIFO_READY'&&typeof event.scratchDirectory==='string'&&event.scratchDirectory.startsWith('/tmp/cluvo-artifact-v2-probe-'))await fsp.rm(event.scratchDirectory,{recursive:true,force:true});
 assert.equal(fifo.exitCode,0);assert.equal(fifo.timedOut,false);
 const rejected=fifo.events.find(event=>event.phase==='FIFO_RESULT');assert.equal(rejected?.code,'PRIVATE_FILE_INVALID');assert.equal(rejected.rejectionUnder1500ms,true);assert.equal(rejected.artifactDirectories,0);
 results.push({id:'FIFO_REJECTED_WITHOUT_BLOCKING',pass:true,code:rejected.code,under1500ms:true,filesCreated:0});
 const inputClose=await runWorker('input-close');assert.equal(inputClose.exitCode,0);assert.equal(inputClose.timedOut,false);
 const inputResult=inputClose.events.find(event=>event.phase==='INPUT_CLOSE_RESULT');assert.equal(inputResult?.code,'BACKUP_ARTIFACT_UNAVAILABLE');assert.equal(inputResult.privateReadBufferZeroed,true);assert.equal(inputResult.artifactDirectories,0);
 results.push({id:'INPUT_CLOSE_FAILURE_REJECTS_AND_ZEROES_PRIVATE_BUFFER',pass:true,...inputResult,realHandlesClosedAfterObservation:true});
 for(const mode of ['fault-close','fault-close-second','fault-write','fault-unlink','fault-rmdir']){
  const probe=await runWorker(mode);assert.equal(probe.exitCode,0);assert.equal(probe.timedOut,false);
  const event=probe.events.find(event=>event.phase==='FAULT_RESULT');assert.ok(event);assert.equal(event.nonPrivateFile,false);
  assert.equal(event.code,mode==='fault-write'?'BACKUP_ARTIFACT_UNAVAILABLE':'BACKUP_ARTIFACT_CLEANUP_FAILED');
  assert.equal(event.filesRemaining,mode==='fault-unlink'?1:0);
  assert.equal(event.restoreDirectoriesRemaining,mode==='fault-unlink'||mode==='fault-rmdir'?1:0);
  results.push({id:mode.toUpperCase().replaceAll('-','_'),pass:true,...event,probeOwnedResidualsRemoved:true,realHandlesClosedAfterObservation:true});
 }
 const adapter=await import(MODULE),p=await fixture(adapter);
 try{
  const keyCopy=Buffer.from(p.key),expected={...p.bindings};
  const pending=adapter.encryptCaptureFiles(p.paths.capture,p.paths.artifact,p.key,p.bindings);p.key.fill(0);p.bindings.source_sha='9'.repeat(40);
  const artifact=await pending;
  const restorePending=adapter.decryptRestoreFiles(artifact.directory,p.paths.restore,keyCopy,expected);keyCopy.fill(0);expected.source_sha='8'.repeat(40);
  const restored=await restorePending;
  for(const [name,bytes]of Object.entries(p.files))assert.deepEqual(await fsp.readFile(join(restored.directory,name)),bytes);
  assert.equal((await fsp.stat(artifact.directory)).mode&0o777,0o700);assert.equal((await fsp.stat(restored.directory)).mode&0o777,0o700);
  for(const name of adapter.FILES){const st=await fsp.stat(join(restored.directory,name));assert.equal(st.mode&0o777,0o600);assert.equal(st.nlink,1);}
  results.push({id:'PRE_AWAIT_KEY_AND_BINDINGS_SNAPSHOT_AND_PRIVATE_ROUNDTRIP',pass:true,files:3});
 }finally{p.key.fill(0);p.bundle.fill(0);await fsp.rm(p.base,{recursive:true,force:true});}
 const source=await fsp.readFile(new URL('../../scripts/backup-artifact.mjs',import.meta.url));
 const report={scope:'SYNTHETIC_FILESYSTEM_ONLY',source_sha256:sha(source),executed_probes:results.length,actual_passed_probes:results.length,results,database_calls:0,docker_calls:0,remote_calls:0,canonical_writes:0,existing_backup_reads:0,synthetic_worker_key_material_printed:false};
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
