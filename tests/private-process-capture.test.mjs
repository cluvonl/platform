import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm,readdir,readFile,lstat,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {capturePrivateOutput,CaptureError} from '../scripts/private-process-capture.mjs';
const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8'};
const code=c=>e=>e instanceof CaptureError&&e.code===c;
async function fixture(t){const dir=await mkdtemp('/tmp/cluvo-private-process-test-');await chmod(dir,0o700);t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
const run=(directory,source,options={},environment=env)=>capturePrivateOutput(process.execPath,['-e',source],environment,directory,'database.dump',{maximumBytes:4*1024*1024,timeoutMs:5000,...options});

test('real subprocess bytes go only to private600 file',async t=>{
 const d=await fixture(t),r=await run(d,"process.stdout.write(Buffer.alloc(3*1024*1024,0x5a))");
 assert.equal(r.bytes,3*1024*1024);assert.equal(r.stderr_empty,true);assert.equal(r.process_exit_code,0);
 assert.deepEqual(await readFile(join(d,r.file)),Buffer.alloc(3*1024*1024,0x5a));assert.equal((await lstat(join(d,r.file))).mode&0o777,0o600);
});
test('environment is explicit and unrelated caller values are not inherited',async t=>{
 const d=await fixture(t);process.env.CLUVO_TEST_ONLY_PARENT_MARKER='parent';t.after(()=>{delete process.env.CLUVO_TEST_ONLY_PARENT_MARKER;});
 await run(d,"process.stdout.write(process.env.CLUVO_TEST_ONLY_PARENT_MARKER===undefined?'isolated':'bad')");assert.equal(await readFile(join(d,'database.dump'),'utf8'),'isolated');
});
test('nonzero exit removes actual partial output',async t=>{
 const d=await fixture(t);await assert.rejects(run(d,"process.stdout.write('synthetic partial');process.exitCode=1"),code('CAPTURE_PROCESS_FAILED'));assert.deepEqual(await readdir(d),[]);
});
test('unexpected stderr fails even with otherwise successful program',async t=>{
 const d=await fixture(t);await assert.rejects(run(d,"process.stdout.write('synthetic partial');process.stderr.write('synthetic warning')"),code('CAPTURE_UNEXPECTED_STDERR'));assert.deepEqual(await readdir(d),[]);
});
test('actual output-size limit removes partial file',async t=>{
 const d=await fixture(t);await assert.rejects(run(d,'process.stdout.write(Buffer.alloc(128*1024,0x5a))',{maximumBytes:32*1024}),code('CAPTURE_SIZE_LIMIT'));assert.deepEqual(await readdir(d),[]);
});
test('empty output is rejected and cleaned',async t=>{
 const d=await fixture(t);await assert.rejects(run(d,'process.exitCode=0'),code('CAPTURE_EMPTY_OR_OVERSIZED'));assert.deepEqual(await readdir(d),[]);
});
test('hung owned process is terminated and reaped within bound',async t=>{
 const d=await fixture(t),start=Date.now();await assert.rejects(run(d,"process.on('SIGTERM',()=>{});process.stdout.write('synthetic partial');setInterval(()=>{},100)",{timeoutMs:50}),code('CAPTURE_PROCESS_TIMEOUT'));assert.ok(Date.now()-start<5000);assert.deepEqual(await readdir(d),[]);
});
test('missing command fails with fixed code and cleans created file',async t=>{
 const d=await fixture(t);await assert.rejects(capturePrivateOutput('/tmp/cluvo-no-such-public-program',[],env,d,'database.dump',{maximumBytes:128,timeoutMs:1000}),code('CAPTURE_PROCESS_UNAVAILABLE'));assert.deepEqual(await readdir(d),[]);
});
test('existing file survives exclusive-open failure',async t=>{
 const d=await fixture(t),path=join(d,'database.dump');await writeFile(path,'existing synthetic data',{mode:0o600});await assert.rejects(run(d,"process.stdout.write('replacement')"),code('PRIVATE_CAPTURE_FAILED'));assert.equal(await readFile(path,'utf8'),'existing synthetic data');
});
test('directory symlink, insecure directory and traversal name are rejected',async t=>{
 const d=await fixture(t),alias=d+'-alias';await symlink(d,alias);t.after(()=>rm(alias));await assert.rejects(run(alias,"process.stdout.write('data')"),code('PRIVATE_DIRECTORY_REQUIRED'));
 await chmod(d,0o755);await assert.rejects(run(d,"process.stdout.write('data')"),code('PRIVATE_DIRECTORY_REQUIRED'));await chmod(d,0o700);
 await assert.rejects(capturePrivateOutput(process.execPath,['-e',"process.stdout.write('data')"],env,d,'../outside',{maximumBytes:128}),code('CAPTURE_BOUNDS_REQUIRED'));assert.deepEqual(await readdir(d),[]);
});
test('caller argument and environment mutation cannot change a pending invocation',async t=>{
 const d=await fixture(t),args=['-e',"process.stdout.write(process.env.CLUVO_SYNTHETIC_MARKER)"],environment={PATH:'/usr/bin:/bin',CLUVO_SYNTHETIC_MARKER:'original'};
 const pending=capturePrivateOutput(process.execPath,args,environment,d,'database.dump',{maximumBytes:1024,timeoutMs:1000});
 args[1]="process.stdout.write('changed-command')";environment.CLUVO_SYNTHETIC_MARKER='changed-env';
 await pending;assert.equal(await readFile(join(d,'database.dump'),'utf8'),'original');
});
test('invocation accessors are rejected without executing getters or creating files',async t=>{
 const d=await fixture(t);let calls=0;
 const args=['-e',"process.stdout.write('data')"];
 Object.defineProperty(args,1,{get(){calls++;return "process.stdout.write('bad')";}});
 await assert.rejects(capturePrivateOutput(process.execPath,args,env,d,'database.dump',{maximumBytes:1024}),code('CAPTURE_COMMAND_REQUIRED'));
 const environment={PATH:'/usr/bin:/bin'};Object.defineProperty(environment,'MARKER',{get(){calls++;return 'bad';},enumerable:true});
 await assert.rejects(run(d,"process.stdout.write('data')",{},environment),code('CAPTURE_ENVIRONMENT_REQUIRED'));
 assert.equal(calls,0);assert.deepEqual(await readdir(d),[]);
});
test('sparse or symbolic arguments and invalid private environments are denied',async t=>{
 const d=await fixture(t),sparse=new Array(2),symbol=['-e',"process.stdout.write('data')"];symbol[Symbol('extra')]='bad';
 for(const args of [sparse,symbol])await assert.rejects(capturePrivateOutput(process.execPath,args,env,d,'database.dump',{maximumBytes:1024}),code('CAPTURE_COMMAND_REQUIRED'));
 for(const environment of [{PATH:'/usr/bin:/bin',[Symbol('extra')]:'bad'},{PATH:'/usr/bin:/bin',BAD:3},{PATH:'/usr/bin:/bin',BAD:'value\0suffix'},new Date()])
  await assert.rejects(run(d,"process.stdout.write('data')",{},environment),code('CAPTURE_ENVIRONMENT_REQUIRED'));
 assert.deepEqual(await readdir(d),[]);
});
test('hostile descriptor traps and bound getters return fixed errors without effects',async t=>{
 const d=await fixture(t),proxy=new Proxy({PATH:'/usr/bin:/bin'},{ownKeys(){throw Error('synthetic private message');}});
 await assert.rejects(run(d,"process.stdout.write('data')",{},proxy),code('PRIVATE_CAPTURE_FAILED'));
 let calls=0;const options={};Object.defineProperty(options,'maximumBytes',{get(){calls++;throw Error('synthetic private message');},enumerable:true});
 await assert.rejects(capturePrivateOutput(process.execPath,['-e',"process.stdout.write('data')"],env,d,'database.dump',options),code('CAPTURE_BOUNDS_REQUIRED'));
 const proxyBounds=new Proxy({maximumBytes:1024},{getPrototypeOf(){throw Error('synthetic private message');}});
 await assert.rejects(capturePrivateOutput(process.execPath,['-e',"process.stdout.write('data')"],env,d,'database.dump',proxyBounds),code('PRIVATE_CAPTURE_FAILED'));
 assert.equal(calls,0);assert.deepEqual(await readdir(d),[]);
});
