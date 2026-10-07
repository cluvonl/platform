import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,readdir,lstat,chmod,symlink,link,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {FILES,ArtifactError,packFiles,unpackFiles,encryptCaptureFiles,decryptRestoreFiles} from '../scripts/backup-artifact.mjs';
import {LIMITS,encryptBundle} from '../scripts/backup-envelope.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fixture=()=>Object.fromEntries(FILES.map((name,i)=>[name,Buffer.from(['PGDMP synthetic bytes only','-- synthetic globals, no secrets','{"synthetic":true,"snapshot_scope":"test"}'][i])]));
const bindings=files=>({schema_version:1,environment:'staging',project_ref:'abcdefghijklmnopqrst',source_sha:'a'.repeat(40),migration_manifest_sha256:'b'.repeat(64),snapshot_manifest_sha256:sha(files['manifest.private.json']),content_sha256:sha(packFiles(files))});
const code=wanted=>e=>e instanceof ArtifactError&&e.code===wanted;
async function workspace(t){const parent=await mkdtemp('/tmp/cluvo-artifact-test-');await chmod(parent,0o700);t.after(()=>rm(parent,{recursive:true,force:true}));return parent;}
async function capture(parent,files){const dir=await mkdtemp(join(parent,'capture-'));await chmod(dir,0o700);for(const name of FILES)await writeFile(join(dir,name),files[name],{mode:0o600,flag:'wx'});return dir;}
function rewriteHeader(bundle,change){const magic=Buffer.from('CLUVO-STAGING-BUNDLE-1\n');const length=bundle.readUInt32BE(magic.length);const start=magic.length+4;const h=JSON.parse(bundle.subarray(start,start+length));change(h);const header=Buffer.from(JSON.stringify(h));const size=Buffer.alloc(4);size.writeUInt32BE(header.length);return Buffer.concat([magic,size,header,bundle.subarray(start+length)]);}

test('fixed files preserve exact bytes and caller inputs',()=>{
 const files=fixture(),snapshots=Object.fromEntries(FILES.map(n=>[n,Buffer.from(files[n])])),bundle=packFiles(files);
 const restored=unpackFiles(bundle,sha(files['manifest.private.json']));
 for(const name of FILES){assert.deepEqual(restored[name],snapshots[name]);assert.deepEqual(files[name],snapshots[name]);}
 bundle.fill(0);for(const n of FILES){assert.deepEqual(restored[n],snapshots[n]);restored[n].fill(0);}
});

test('file inputs reject extra names, accessors, symbols, empties and oversized aggregate',()=>{
 const files=fixture();assert.throws(()=>packFiles({...files,'../outside':Buffer.from('x')}),code('BUNDLE_FILES_INVALID'));
 const accessor={...files};Object.defineProperty(accessor,FILES[0],{get(){throw Error('PRIVATE');},enumerable:true});assert.throws(()=>packFiles(accessor),code('BUNDLE_FILES_INVALID'));
 const symbol={...files,[Symbol('private')]:1};assert.throws(()=>packFiles(symbol),code('BUNDLE_FILES_INVALID'));
 assert.throws(()=>packFiles({...files,[FILES[0]]:Buffer.alloc(0)}),code('BUNDLE_FILES_INVALID'));
 const large=Buffer.alloc(LIMITS.plaintext_bytes);try{assert.throws(()=>packFiles({...files,[FILES[0]]:large}),code('BUNDLE_SIZE_INVALID'));}finally{large.fill(0);}
});

test('bundle rejects traversal, duplicate names, reordering and unknown fields',()=>{
 const files=fixture(),b=packFiles(files),h=sha(files['manifest.private.json']);
 for(const change of [x=>{x.files[0].name='../outside';},x=>{x.files[1].name=x.files[0].name;},x=>{x.files.reverse();},x=>{x.extra=true;},x=>{x.files[0].extra=true;}])assert.throws(()=>unpackFiles(rewriteHeader(b,change),h),e=>e instanceof ArtifactError);
});

test('bundle rejects tampered bytes, truncation, trailing bytes and independent manifest mismatch',()=>{
 const files=fixture(),b=packFiles(files),h=sha(files['manifest.private.json']);
 const changed=Buffer.from(b);changed[changed.length-1]^=1;assert.throws(()=>unpackFiles(changed,h),code('BUNDLE_CONTENT_MISMATCH'));
 assert.throws(()=>unpackFiles(b.subarray(0,b.length-1),h),code('BUNDLE_FORMAT_INVALID'));
 assert.throws(()=>unpackFiles(Buffer.concat([b,Buffer.from('x')]),h),code('BUNDLE_FORMAT_INVALID'));
 assert.throws(()=>unpackFiles(b,'c'.repeat(64)),code('SNAPSHOT_BINDING_MISMATCH'));
 for(const value of [-1,0,1.1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>unpackFiles(rewriteHeader(b,x=>{x.files[0].bytes=value;}),h),code('BUNDLE_FORMAT_INVALID'));
});

test('bundle rejects alternate JSON representation before file release',()=>{
 const files=fixture(),b=packFiles(files),magic=Buffer.from('CLUVO-STAGING-BUNDLE-1\n'),start=magic.length+4,len=b.readUInt32BE(magic.length);
 const raw=JSON.parse(b.subarray(start,start+len));const header=Buffer.from(JSON.stringify({...raw,files:raw.files.map(({name,bytes,sha256})=>({bytes,name,sha256}))}));const length=Buffer.alloc(4);length.writeUInt32BE(header.length);
 assert.throws(()=>unpackFiles(Buffer.concat([magic,length,header,b.subarray(start+len)]),sha(files['manifest.private.json'])),code('BUNDLE_NONCANONICAL'));
});

test('actual encrypted filesystem roundtrip has private permissions and no raw artifact file',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const binding=bindings(files),src=await capture(parent,files);
 const artifact=await encryptCaptureFiles(src,parent,key,binding);
 assert.deepEqual(await readdir(artifact.directory),['backup.encrypted.json']);assert.equal((await lstat(artifact.directory)).mode&0o777,0o700);assert.equal((await lstat(join(artifact.directory,artifact.file))).mode&0o777,0o600);
 const restored=await decryptRestoreFiles(artifact.directory,parent,key,binding);
 assert.deepEqual((await readdir(restored.directory)).sort(),[...FILES].sort());assert.equal((await lstat(restored.directory)).mode&0o777,0o700);
 for(const name of FILES){assert.deepEqual(await readFile(join(restored.directory,name)),files[name]);assert.equal((await lstat(join(restored.directory,name))).mode&0o777,0o600);assert.equal((await lstat(join(restored.directory,name))).nlink,1);}
});

test('8 MiB synthetic filesystem capture returns exact restored bytes',async t=>{
 const parent=await workspace(t),files=fixture();files[FILES[0]]=Buffer.alloc(8*1024*1024,0x5a);t.after(()=>files[FILES[0]].fill(0));const key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),src=await capture(parent,files);
 const artifact=await encryptCaptureFiles(src,parent,key,b),restored=await decryptRestoreFiles(artifact.directory,parent,key,b);
 assert.deepEqual(await readFile(join(restored.directory,FILES[0])),files[FILES[0]]);
});

test('wrong key and envelope tampering create no restore directory or plaintext file',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32),wrong=randomBytes(32);t.after(()=>{key.fill(0);wrong.fill(0);});const b=bindings(files),src=await capture(parent,files),a=await encryptCaptureFiles(src,parent,key,b),baseline=(await readdir(parent)).sort();
 await assert.rejects(decryptRestoreFiles(a.directory,parent,wrong,b),code('ENVELOPE_AUTHENTICATION_FAILED'));assert.deepEqual((await readdir(parent)).sort(),baseline);
 const path=join(a.directory,a.file),raw=JSON.parse(await readFile(path,'utf8')),cipher=Buffer.from(raw.ciphertext_b64,'base64');cipher[0]^=1;raw.ciphertext_b64=cipher.toString('base64');await writeFile(path,JSON.stringify(raw));
 await assert.rejects(decryptRestoreFiles(a.directory,parent,key,b),code('ENVELOPE_AUTHENTICATION_FAILED'));assert.deepEqual((await readdir(parent)).sort(),baseline);
});

test('authenticated malformed bundle still creates no restore files',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),bad=rewriteHeader(packFiles(files),x=>{x.files[0].name='../escape';}),binding={...b,content_sha256:sha(bad)},a=await mkdtemp(join(parent,'artifact-'));await chmod(a,0o700);await writeFile(join(a,'backup.encrypted.json'),encryptBundle(bad,key,binding),{mode:0o600});const before=(await readdir(parent)).sort();
 await assert.rejects(decryptRestoreFiles(a,parent,key,binding),code('BUNDLE_FORMAT_INVALID'));assert.deepEqual((await readdir(parent)).sort(),before);
});

test('snapshot and content bindings fail before artifact-directory creation',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),src=await capture(parent,files),before=(await readdir(parent)).sort();
 await assert.rejects(encryptCaptureFiles(src,parent,key,{...b,snapshot_manifest_sha256:'f'.repeat(64)}),code('SNAPSHOT_BINDING_MISMATCH'));
 await assert.rejects(encryptCaptureFiles(src,parent,key,{...b,content_sha256:'f'.repeat(64)}),code('CONTENT_BINDING_MISMATCH'));assert.deepEqual((await readdir(parent)).sort(),before);
});

test('symlink capture directory and symlink file are rejected without reading a target',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),src=await capture(parent,files),alias=join(parent,'alias');await symlink(src,alias);
 await assert.rejects(encryptCaptureFiles(alias,parent,key,b),code('PRIVATE_DIRECTORY_INVALID'));
 await rm(join(src,FILES[0]));const target=join(parent,'target');await writeFile(target,files[FILES[0]],{mode:0o600});await symlink(target,join(src,FILES[0]));await assert.rejects(encryptCaptureFiles(src,parent,key,b),e=>e instanceof ArtifactError);assert.deepEqual(await readFile(target),files[FILES[0]]);
});

test('hardlinked or publicly readable capture files are rejected',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),src=await capture(parent,files);await link(join(src,FILES[0]),join(parent,'second-link'));
 await assert.rejects(encryptCaptureFiles(src,parent,key,b),code('PRIVATE_FILE_INVALID'));await rm(join(parent,'second-link'));await chmod(join(src,FILES[0]),0o644);
 await assert.rejects(encryptCaptureFiles(src,parent,key,b),code('PRIVATE_FILE_INVALID'));
});

test('symlink and insecure artifact input fail before restore-file creation',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),src=await capture(parent,files),a=await encryptCaptureFiles(src,parent,key,b),path=join(a.directory,a.file),bytes=await readFile(path),outside=join(parent,'external-artifact');await writeFile(outside,bytes,{mode:0o600});await rm(path);await symlink(outside,path);const before=(await readdir(parent)).sort();
 await assert.rejects(decryptRestoreFiles(a.directory,parent,key,b),e=>e instanceof ArtifactError);assert.deepEqual((await readdir(parent)).sort(),before);
 await rm(path);await writeFile(path,bytes,{mode:0o644});await assert.rejects(decryptRestoreFiles(a.directory,parent,key,b),code('PRIVATE_FILE_INVALID'));assert.deepEqual((await readdir(parent)).sort(),before);
});

test('bindings accessors cannot run across filesystem awaits',async t=>{
 const parent=await workspace(t),files=fixture(),key=randomBytes(32);t.after(()=>key.fill(0));const b=bindings(files),src=await capture(parent,files);let calls=0;
 Object.defineProperty(b,'snapshot_manifest_sha256',{get(){calls++;throw Error('PRIVATE');},enumerable:true});await assert.rejects(encryptCaptureFiles(src,parent,key,b),code('BINDINGS_INVALID'));assert.equal(calls,0);
});
