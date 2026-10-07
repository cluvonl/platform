// LOCAL_CRYPTO_ONLY: no filesystem, DB, subprocess, network or secret provisioning.
import {createCipheriv,createDecipheriv,createHash,getCiphers,getHashes,randomBytes,timingSafeEqual} from 'node:crypto';

export const LIMITS=Object.freeze({plaintext_bytes:64*1024*1024,envelope_bytes:90*1024*1024,
  key_bytes:32,nonce_bytes:12,tag_bytes:16});
const FORMAT='cluvo-backup-envelope';
const ALGORITHM='AES-256-GCM';
const BINDING_KEYS=['schema_version','environment','project_ref','source_sha',
  'migration_manifest_sha256','snapshot_manifest_sha256','content_sha256'];
const ENVELOPE_KEYS=['format','algorithm',...BINDING_KEYS,'content_bytes','nonce_b64','tag_b64','ciphertext_b64'];
export class EnvelopeError extends Error {constructor(code){super(code);this.code=code;}}
const demand=(value,code)=>{if(!value)throw new EnvelopeError(code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
function shape(value,keys,code){
 demand(value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype,code);
 const descriptions=Object.getOwnPropertyDescriptors(value);
 demand(Reflect.ownKeys(descriptions).length===keys.length&&keys.every(k=>Object.hasOwn(descriptions,k)
  &&Object.hasOwn(descriptions[k],'value')),code);
 return descriptions;
}
export function validateBindings(value){
 const descriptors=shape(value,BINDING_KEYS,'BINDINGS_INVALID');
 const snapshot=Object.fromEntries(BINDING_KEYS.map(k=>[k,descriptors[k].value]));
 demand(snapshot.schema_version===1&&snapshot.environment==='staging','BINDINGS_INVALID');
 demand(typeof snapshot.project_ref==='string'&&/^[a-z0-9]{20}$/.test(snapshot.project_ref),'BINDINGS_INVALID');
 demand(typeof snapshot.source_sha==='string'&&/^[0-9a-f]{40}$/.test(snapshot.source_sha),'BINDINGS_INVALID');
 for(const k of ['migration_manifest_sha256','snapshot_manifest_sha256','content_sha256'])
  demand(typeof snapshot[k]==='string'&&/^[0-9a-f]{64}$/.test(snapshot[k]),'BINDINGS_INVALID');
 // Copy only known scalar data; never serialize key material or private manifests.
 return Object.freeze(snapshot);
}
export function runtimeCapabilities(){
 let aes=false,sha256=false;
 try{aes=getCiphers().includes('aes-256-gcm');sha256=getHashes().includes('sha256');}catch{}
 return {scope:'LOCAL_CRYPTO_ONLY',aes_256_gcm_available:aes,sha256_available:sha256,
  random_nonce_bytes:12,authentication_tag_bytes:16,limits:LIMITS,
  database_or_restore_proved:false,provider_key_or_extension_decryptability_proved:false};
}
function runtime(){const c=runtimeCapabilities();demand(c.aes_256_gcm_available&&c.sha256_available,'CRYPTO_RUNTIME_UNAVAILABLE');}
function keyCopy(key){demand(Buffer.isBuffer(key)&&key.length===32,'KEY_INVALID');return Buffer.from(key);}
function strictBase64(value,expectedBytes,maximumBytes,code){
 demand(typeof value==='string'&&value.length>0&&value.length<=4*Math.ceil(maximumBytes/3)
  &&value.length%4===0,code);
 // Iterative ASCII scan avoids V8 RegExp stack overflow on multi-MiB valid
 // ciphertext. Padding is accepted only at the final one/two positions.
 let end=value.length;
 if(value.charCodeAt(end-1)===61){end--;if(value.charCodeAt(end-1)===61)end--;}
 demand(end>0,code);
 for(let i=0;i<end;i++){
  const c=value.charCodeAt(i);
  demand((c>=65&&c<=90)||(c>=97&&c<=122)||(c>=48&&c<=57)||c===43||c===47,code);
 }
 const bytes=Buffer.from(value,'base64');
 demand(bytes.length<=maximumBytes&&(expectedBytes===null||bytes.length===expectedBytes)&&bytes.toString('base64')===value,code);
 return bytes;
}
// The caller supplies the staging ENV value in memory. Import does not read ENV.
export function decodeEnvironmentKey(value){
 try{return strictBase64(value,32,32,'KEY_INVALID');}catch{throw new EnvelopeError('KEY_INVALID');}
}
function authenticatedHeader(bindings,contentBytes,nonceB64){
 return {format:FORMAT,algorithm:ALGORITHM,...bindings,content_bytes:contentBytes,nonce_b64:nonceB64};
}
function headerBytes(header){return Buffer.from(JSON.stringify(header),'utf8');}
function sameBindings(a,b){return BINDING_KEYS.every(k=>a[k]===b[k]);}

function encryptVerified(plaintext,key,bindings){
 runtime();const b=validateBindings(bindings);
 demand(Buffer.isBuffer(plaintext)&&plaintext.length>0&&plaintext.length<=LIMITS.plaintext_bytes,'BUNDLE_SIZE_INVALID');
 demand(digest(plaintext)===b.content_sha256,'CONTENT_BINDING_MISMATCH');
 const secret=keyCopy(key);
 try{
  const nonce=randomBytes(12);
  const header=authenticatedHeader(b,plaintext.length,nonce.toString('base64'));
  const cipher=createCipheriv('aes-256-gcm',secret,nonce,{authTagLength:16});
  cipher.setAAD(headerBytes(header),{plaintextLength:plaintext.length});
  const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const envelope=Buffer.from(JSON.stringify({...header,tag_b64:cipher.getAuthTag().toString('base64'),
   ciphertext_b64:ciphertext.toString('base64')}),'utf8');
  demand(envelope.length<=LIMITS.envelope_bytes,'ENVELOPE_SIZE_INVALID');
  return envelope;
 }catch(error){if(error instanceof EnvelopeError)throw error;throw new EnvelopeError('ENCRYPTION_FAILED');}
 finally{secret.fill(0);}
}
export function encryptBundle(plaintext,key,bindings){
 try{return encryptVerified(plaintext,key,bindings);}
 catch(error){if(error instanceof EnvelopeError)throw error;throw new EnvelopeError('ENCRYPTION_FAILED');}
}

function parseEnvelope(serialized){
 demand(Buffer.isBuffer(serialized)&&serialized.length>0&&serialized.length<=LIMITS.envelope_bytes,'ENVELOPE_SIZE_INVALID');
 let parsed;try{parsed=JSON.parse(serialized.toString('utf8'));}catch{throw new EnvelopeError('ENVELOPE_INVALID');}
 shape(parsed,ENVELOPE_KEYS,'ENVELOPE_INVALID');
 demand(parsed.format===FORMAT&&parsed.algorithm===ALGORITHM,'ENVELOPE_INVALID');
 const b=validateBindings(Object.fromEntries(BINDING_KEYS.map(k=>[k,parsed[k]])));
 demand(Number.isSafeInteger(parsed.content_bytes)&&parsed.content_bytes>0&&parsed.content_bytes<=LIMITS.plaintext_bytes,'ENVELOPE_SIZE_INVALID');
 const nonce=strictBase64(parsed.nonce_b64,12,12,'ENVELOPE_INVALID');
 const tag=strictBase64(parsed.tag_b64,16,16,'ENVELOPE_INVALID');
 const ciphertext=strictBase64(parsed.ciphertext_b64,parsed.content_bytes,LIMITS.plaintext_bytes,'ENVELOPE_INVALID');
 const header=authenticatedHeader(b,parsed.content_bytes,parsed.nonce_b64);
 const canonical=Buffer.from(JSON.stringify({...header,tag_b64:parsed.tag_b64,ciphertext_b64:parsed.ciphertext_b64}),'utf8');
 // Reject duplicate keys, invalid UTF-8, padding/whitespace and alternate JSON
 // representations instead of silently accepting ambiguous artifact bytes.
 demand(canonical.equals(serialized),'ENVELOPE_NONCANONICAL');
 return {b,header,nonce,tag,ciphertext};
}
function decryptVerified(serialized,key,trustedBindings){
 runtime();const expected=validateBindings(trustedBindings);
 const parsed=parseEnvelope(serialized);
 demand(sameBindings(parsed.b,expected),'TRUSTED_BINDING_MISMATCH');
 const secret=keyCopy(key);const staged=[];let plaintext;
 try{
  const decipher=createDecipheriv('aes-256-gcm',secret,parsed.nonce,{authTagLength:16});
  decipher.setAAD(headerBytes(parsed.header),{plaintextLength:parsed.header.content_bytes});decipher.setAuthTag(parsed.tag);
  // update() output stays private. No callback/stream/output or restore API
  // can observe it until final() authenticates the entire artifact.
  staged.push(decipher.update(parsed.ciphertext));staged.push(decipher.final());
  plaintext=Buffer.concat(staged);
  demand(plaintext.length===parsed.header.content_bytes,'CONTENT_BINDING_MISMATCH');
  const actual=Buffer.from(digest(plaintext),'hex');const wanted=Buffer.from(expected.content_sha256,'hex');
  demand(timingSafeEqual(actual,wanted),'CONTENT_BINDING_MISMATCH');
  return plaintext;
 }catch(error){
  plaintext?.fill(0);
  if(error instanceof EnvelopeError)throw error;
  throw new EnvelopeError('ENVELOPE_AUTHENTICATION_FAILED');
 }finally{for(const chunk of staged)chunk.fill(0);secret.fill(0);}
}
export function decryptBundle(serialized,key,trustedBindings){
 try{return decryptVerified(serialized,key,trustedBindings);}
 catch(error){if(error instanceof EnvelopeError)throw error;throw new EnvelopeError('ENVELOPE_PROCESSING_FAILED');}
}
