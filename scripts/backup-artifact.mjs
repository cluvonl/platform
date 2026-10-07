// Fixed-file operational artifact adapter. No database, environment, CLI or logs.
import {constants} from 'node:fs';
import {open,lstat,mkdtemp,chmod,unlink,rmdir} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {createHash} from 'node:crypto';
import {LIMITS,encryptBundle,decryptBundle,validateBindings,EnvelopeError} from './backup-envelope.mjs';

export const FILES=Object.freeze(['database.dump','globals.sql','manifest.private.json']);
const MAGIC=Buffer.from('CLUVO-STAGING-BUNDLE-1\n');
const FORMAT='cluvo-staging-backup-bundle';
const HEADER_LIMIT=4096;
const ARTIFACT='backup.encrypted.json';
export class ArtifactError extends Error{constructor(code){super(code);this.code=code;}}
const requireValue=(value,code)=>{if(!value)throw new ArtifactError(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const envelopeCode=error=>error instanceof EnvelopeError?new ArtifactError(error.code):error instanceof ArtifactError?error:new ArtifactError('BACKUP_ARTIFACT_UNAVAILABLE');

function shape(value,keys){
 requireValue(value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype,'BUNDLE_FILES_INVALID');
 const descriptors=Object.getOwnPropertyDescriptors(value);
 requireValue(Reflect.ownKeys(descriptors).length===keys.length&&keys.every(k=>Object.hasOwn(descriptors,k)&&Object.hasOwn(descriptors[k],'value')),'BUNDLE_FILES_INVALID');
 return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}

export function packFiles(value){
 const copies=[];
 try{
  const files=shape(value,FILES);let bytes=0;
  for(const name of FILES){
   requireValue(Buffer.isBuffer(files[name])&&files[name].length>0,'BUNDLE_FILES_INVALID');
   bytes+=files[name].length;
   requireValue(Number.isSafeInteger(bytes)&&bytes<=LIMITS.plaintext_bytes,'BUNDLE_SIZE_INVALID');
   copies.push(Buffer.from(files[name]));
  }
  const entries=FILES.map((name,i)=>({name,bytes:copies[i].length,sha256:sha(copies[i])}));
  const header=Buffer.from(JSON.stringify({format:FORMAT,schema_version:1,files:entries}));
  requireValue(header.length<=HEADER_LIMIT&&MAGIC.length+4+header.length+bytes<=LIMITS.plaintext_bytes,'BUNDLE_SIZE_INVALID');
  const size=Buffer.alloc(4);size.writeUInt32BE(header.length);
  return Buffer.concat([MAGIC,size,header,...copies]);
 }catch(error){throw envelopeCode(error);}finally{for(const bytes of copies)bytes.fill(0);}
}

export function unpackFiles(bundle,expectedManifestHash){
 const files={};
 try{
  requireValue(typeof expectedManifestHash==='string'&&/^[a-f0-9]{64}$/.test(expectedManifestHash),'SNAPSHOT_BINDING_INVALID');
  requireValue(Buffer.isBuffer(bundle)&&bundle.length>MAGIC.length+4&&bundle.length<=LIMITS.plaintext_bytes,'BUNDLE_SIZE_INVALID');
  requireValue(bundle.subarray(0,MAGIC.length).equals(MAGIC),'BUNDLE_FORMAT_INVALID');
  const length=bundle.readUInt32BE(MAGIC.length),start=MAGIC.length+4;
  requireValue(length>0&&length<=HEADER_LIMIT&&start+length<bundle.length,'BUNDLE_FORMAT_INVALID');
  const headerBytes=bundle.subarray(start,start+length);let raw;
  try{raw=JSON.parse(headerBytes.toString('utf8'));}catch{throw new ArtifactError('BUNDLE_FORMAT_INVALID');}
  const header=shape(raw,['format','schema_version','files']);
  requireValue(header.format===FORMAT&&header.schema_version===1&&Array.isArray(header.files)&&header.files.length===FILES.length,'BUNDLE_FORMAT_INVALID');
  const entries=header.files.map((row,i)=>{
   const entry=shape(row,['name','bytes','sha256']);
   requireValue(entry.name===FILES[i]&&Number.isSafeInteger(entry.bytes)&&entry.bytes>0&&entry.bytes<=LIMITS.plaintext_bytes&&typeof entry.sha256==='string'&&/^[a-f0-9]{64}$/.test(entry.sha256),'BUNDLE_FORMAT_INVALID');
   return entry;
  });
  const canonical=Buffer.from(JSON.stringify({format:FORMAT,schema_version:1,files:entries}));
  requireValue(canonical.equals(headerBytes),'BUNDLE_NONCANONICAL');
  let cursor=start+length;
  // Verify every length/hash and the independently supplied snapshot-manifest
  // binding before exposing any file bytes or allowing filesystem mutation.
  for(const entry of entries){
   requireValue(cursor+entry.bytes<=bundle.length,'BUNDLE_FORMAT_INVALID');
   const bytes=bundle.subarray(cursor,cursor+entry.bytes);
   requireValue(sha(bytes)===entry.sha256,'BUNDLE_CONTENT_MISMATCH');cursor+=entry.bytes;
  }
  requireValue(cursor===bundle.length,'BUNDLE_FORMAT_INVALID');
  requireValue(entries[2].sha256===expectedManifestHash,'SNAPSHOT_BINDING_MISMATCH');
  cursor=start+length;
  for(const entry of entries){files[entry.name]=Buffer.from(bundle.subarray(cursor,cursor+entry.bytes));cursor+=entry.bytes;}
  return files;
 }catch(error){for(const bytes of Object.values(files))bytes.fill(0);throw envelopeCode(error);}
}

async function privateDirectory(path){
 requireValue(typeof path==='string'&&isAbsolute(path),'PRIVATE_DIRECTORY_INVALID');
 const st=await lstat(path);
 requireValue(st.isDirectory()&&!st.isSymbolicLink()&&(st.mode&0o777)===0o700&&st.uid===process.getuid(),'PRIVATE_DIRECTORY_INVALID');
}

async function readPrivateFile(directory,name,maximum){
 let handle,bytes;
 try{
  // A FIFO must not block before fstat can reject its non-regular type.
  handle=await open(join(directory,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const before=await handle.stat();
  requireValue(before.isFile()&&before.nlink===1&&(before.mode&0o777)===0o600&&before.uid===process.getuid()&&before.size>0&&before.size<=maximum,'PRIVATE_FILE_INVALID');
  bytes=Buffer.alloc(before.size);let offset=0;
  while(offset<bytes.length){const result=await handle.read(bytes,offset,bytes.length-offset,offset);requireValue(result.bytesRead>0,'PRIVATE_FILE_CHANGED');offset+=result.bytesRead;}
  const after=await handle.stat();
  requireValue(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs&&after.nlink===1&&(after.mode&0o777)===0o600,'PRIVATE_FILE_CHANGED');
  await handle.close();handle=null;return bytes;
 }catch(error){bytes?.fill(0);throw envelopeCode(error);}finally{await handle?.close().catch(()=>{});}
}

async function writeExclusive(path,bytes){
 let handle,created=false;
 try{
  handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);created=true;
  await handle.chmod(0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
 }catch(error){
  // Close failure cannot skip unlink. Every cleanup action is independent;
  // failure stays visible through a fixed code instead of a success claim.
  let cleanupFailed=false;
  try{await handle?.close();}catch{cleanupFailed=true;}finally{handle=null;}
  if(created){try{await unlink(path);}catch(e){if(e?.code!=='ENOENT')cleanupFailed=true;}}
  if(cleanupFailed)throw new ArtifactError('BACKUP_ARTIFACT_CLEANUP_FAILED');
  throw envelopeCode(error);
 }
}

async function freshDirectory(parent){
 requireValue(typeof parent==='string'&&isAbsolute(parent),'PRIVATE_DIRECTORY_INVALID');
 let path;
 try{path=await mkdtemp(join(parent,'cluvo-backup-'));await chmod(path,0o700);await privateDirectory(path);return path;}
 catch(error){if(path){try{await rmdir(path);}catch(e){if(e?.code!=='ENOENT')throw new ArtifactError('BACKUP_ARTIFACT_CLEANUP_FAILED');}}throw envelopeCode(error);}
}

export async function encryptCaptureFiles(captureDirectory,artifactParent,key,bindings){
 const files={};let bundle,encrypted,secret;
 try{
  const expected=validateBindings(bindings);
  requireValue(Buffer.isBuffer(key)&&key.length===LIMITS.key_bytes,'KEY_INVALID');secret=Buffer.from(key);
  await privateDirectory(captureDirectory);
  let remaining=LIMITS.plaintext_bytes;
  for(const name of FILES){files[name]=await readPrivateFile(captureDirectory,name,remaining);remaining-=files[name].length;}
  requireValue(sha(files['manifest.private.json'])===expected.snapshot_manifest_sha256,'SNAPSHOT_BINDING_MISMATCH');
  bundle=packFiles(files);
  requireValue(sha(bundle)===expected.content_sha256,'CONTENT_BINDING_MISMATCH');
  encrypted=encryptBundle(bundle,secret,expected);
  const directory=await freshDirectory(artifactParent);
  try{await writeExclusive(join(directory,ARTIFACT),encrypted);return {directory,file:ARTIFACT};}
  catch(error){try{await rmdir(directory);}catch(e){if(e?.code!=='ENOENT')throw new ArtifactError('BACKUP_ARTIFACT_CLEANUP_FAILED');}throw error;}
 }catch(error){throw envelopeCode(error);}
 finally{secret?.fill(0);bundle?.fill(0);encrypted?.fill(0);for(const bytes of Object.values(files))bytes.fill(0);}
}

export async function decryptRestoreFiles(artifactDirectory,restoreParent,key,trustedBindings){
 let encrypted,bundle,files,directory,secret;const created=[];
 try{
  const expected=validateBindings(trustedBindings);
  requireValue(Buffer.isBuffer(key)&&key.length===LIMITS.key_bytes,'KEY_INVALID');secret=Buffer.from(key);
  await privateDirectory(artifactDirectory);
  encrypted=await readPrivateFile(artifactDirectory,ARTIFACT,LIMITS.envelope_bytes);
  bundle=decryptBundle(encrypted,secret,expected);
  files=unpackFiles(bundle,expected.snapshot_manifest_sha256);
  // Nothing below runs until the entire envelope and all fixed files passed.
  directory=await freshDirectory(restoreParent);
  for(const name of FILES){const path=join(directory,name);await writeExclusive(path,files[name]);created.push(path);}
  return {directory,files:FILES};
 }catch(error){
  let cleanupFailed=false;
  for(const path of created){try{await unlink(path);}catch(e){if(e?.code!=='ENOENT')cleanupFailed=true;}}
  if(directory){try{await rmdir(directory);}catch(e){if(e?.code!=='ENOENT')cleanupFailed=true;}}
  if(cleanupFailed)throw new ArtifactError('BACKUP_ARTIFACT_CLEANUP_FAILED');throw envelopeCode(error);
 }
 finally{secret?.fill(0);encrypted?.fill(0);bundle?.fill(0);for(const bytes of Object.values(files??{}))bytes.fill(0);}
}
