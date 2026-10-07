import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,createHash,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {LIMITS,EnvelopeError,encryptBundle,decryptBundle,decodeEnvironmentKey,runtimeCapabilities} from '../scripts/backup-envelope.mjs';

// Synthetic opaque bytes and random ephemeral keys only. No real backup, key,
// environment, Native identity, provider, DB, file export or network is read.
const content=Buffer.from('LOCAL synthetic fixed-file bundle\nmanifest.json\ndatabase.dump\nglobals.sql\n','utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const binding={schema_version:1,environment:'staging',project_ref:'abcdefghijklmnopqrst',source_sha:'a'.repeat(40),
 migration_manifest_sha256:'b'.repeat(64),snapshot_manifest_sha256:'c'.repeat(64),content_sha256:sha(content)};
const fixture=()=>{const key=randomBytes(32);return {key,envelope:encryptBundle(content,key,binding)};};
const mutate=(raw,change)=>{const value=JSON.parse(raw);change(value);return Buffer.from(JSON.stringify(value));};
const flip=value=>{const bytes=Buffer.from(value,'base64');bytes[0]^=1;return bytes.toString('base64');};
function denied(call,code){let returned=false;assert.throws(()=>{call();returned=true;},e=>e instanceof EnvelopeError&&e.code===code);assert.equal(returned,false);}

test('actual AES256GCM round-trip preserves exact opaque bytes and caller buffers',()=>{
 const {key,envelope}=fixture();const saved=Buffer.from(key),original=Buffer.from(content);
 const plaintext=decryptBundle(envelope,key,binding);assert(plaintext.equals(content));assert(key.equals(saved));assert(content.equals(original));
 assert.equal(runtimeCapabilities().scope,'LOCAL_CRYPTO_ONLY');assert.equal(runtimeCapabilities().aes_256_gcm_available,true);
 key.fill(0);saved.fill(0);plaintext.fill(0);
});
test('fresh random 12-byte nonces produce distinct ciphertexts for identical bundle/key',()=>{
 const key=randomBytes(32),nonces=new Set(),ciphertexts=new Set();
 for(let i=0;i<64;i++){const value=JSON.parse(encryptBundle(content,key,binding));assert.equal(Buffer.from(value.nonce_b64,'base64').length,12);assert.equal(Buffer.from(value.tag_b64,'base64').length,16);nonces.add(value.nonce_b64);ciphertexts.add(value.ciphertext_b64);}
 assert.equal(nonces.size,64);assert.equal(ciphertexts.size,64);key.fill(0);
});
test('wrong 32-byte key fails tag authentication and returns no plaintext',()=>{
 const {key,envelope}=fixture(),wrong=randomBytes(32);denied(()=>decryptBundle(envelope,wrong,binding),'ENVELOPE_AUTHENTICATION_FAILED');key.fill(0);wrong.fill(0);
});
test('ciphertext, nonce and tag bit changes fail actual GCM authentication',()=>{
 const {key,envelope}=fixture();for(const name of ['ciphertext_b64','nonce_b64','tag_b64'])
  denied(()=>decryptBundle(mutate(envelope,v=>v[name]=flip(v[name])),key,binding),'ENVELOPE_AUTHENTICATION_FAILED');key.fill(0);
});
test('trusted runtime project/source/manifest/snapshot/content bindings cannot be taken from artifact',()=>{
 const {key,envelope}=fixture();
 for(const [name,value]of [['project_ref','tsrqponmlkjihgfedcba'],['source_sha','d'.repeat(40)],
  ['migration_manifest_sha256','d'.repeat(64)],['snapshot_manifest_sha256','d'.repeat(64)],['content_sha256','d'.repeat(64)]])
  denied(()=>decryptBundle(envelope,key,{...binding,[name]:value}),'TRUSTED_BINDING_MISMATCH');key.fill(0);
});
test('changed allowed metadata still fails authenticated AAD even if caller expects the changed metadata',()=>{
 const {key,envelope}=fixture();
 for(const [name,value]of [['project_ref','tsrqponmlkjihgfedcba'],['source_sha','d'.repeat(40)],
  ['migration_manifest_sha256','d'.repeat(64)],['snapshot_manifest_sha256','d'.repeat(64)],['content_sha256','d'.repeat(64)]]){
  const changed=mutate(envelope,v=>v[name]=value);denied(()=>decryptBundle(changed,key,{...binding,[name]:value}),'ENVELOPE_AUTHENTICATION_FAILED');
 }key.fill(0);
});
test('unsupported schema/environment/algorithm and extra authority fields fail closed',()=>{
 const {key,envelope}=fixture();
 for(const extra of [{schema_version:2},{environment:'production'},{project_ref:'not-a-project-ref'},
  {source_sha:'UPPERCASE'},{actor_id:'UNTRUSTED'},{encryption_key:'UNTRUSTED'}])
  denied(()=>decryptBundle(envelope,key,{...binding,...extra}),'BINDINGS_INVALID');
 for(const change of [v=>v.algorithm='AES-256-CBC',v=>v.format='other',v=>v.key='UNTRUSTED',v=>delete v.tag_b64])
  denied(()=>decryptBundle(mutate(envelope,change),key,binding),'ENVELOPE_INVALID');key.fill(0);
});
test('ambiguous JSON, duplicated keys, invalid UTF8 and alternate Base64 are rejected',()=>{
 const {key,envelope}=fixture();
 denied(()=>decryptBundle(Buffer.concat([envelope,Buffer.from('\n')]),key,binding),'ENVELOPE_NONCANONICAL');
 const duplicate=Buffer.from(envelope.toString().replace('{','{"format":"cluvo-backup-envelope",'));
 denied(()=>decryptBundle(duplicate,key,binding),'ENVELOPE_NONCANONICAL');
 denied(()=>decryptBundle(mutate(envelope,v=>v.nonce_b64+=' '),key,binding),'ENVELOPE_INVALID');
 denied(()=>decryptBundle(mutate(envelope,v=>v.tag_b64=v.tag_b64.replaceAll('=','')),key,binding),'ENVELOPE_INVALID');
 denied(()=>decryptBundle(Buffer.from([0xff]),key,binding),'ENVELOPE_INVALID');key.fill(0);
});
test('truncation and inconsistent declared ciphertext size cannot reach restore output',()=>{
 const {key,envelope}=fixture();denied(()=>decryptBundle(envelope.subarray(0,-1),key,binding),'ENVELOPE_INVALID');
 denied(()=>decryptBundle(mutate(envelope,v=>v.content_bytes++),key,binding),'ENVELOPE_INVALID');key.fill(0);
});
test('actual oversized and empty input buffers fail bounded size checks before cryptography',()=>{
 const key=randomBytes(32);denied(()=>encryptBundle(Buffer.alloc(0),key,binding),'BUNDLE_SIZE_INVALID');
 denied(()=>encryptBundle(Buffer.alloc(LIMITS.plaintext_bytes+1),key,binding),'BUNDLE_SIZE_INVALID');
 denied(()=>decryptBundle(Buffer.alloc(LIMITS.envelope_bytes+1),key,binding),'ENVELOPE_SIZE_INVALID');
 const {envelope}=fixture();denied(()=>decryptBundle(mutate(envelope,v=>v.content_bytes=LIMITS.plaintext_bytes+1),key,binding),'ENVELOPE_SIZE_INVALID');key.fill(0);
});
test('key input and ENV value codec never accept bad size, padding, unknown strings or normalization',()=>{
 const {key,envelope}=fixture();for(const invalid of [null,'opaque',Buffer.alloc(31),Buffer.alloc(33)])
  denied(()=>decryptBundle(envelope,invalid,binding),'KEY_INVALID');
 const encoded=key.toString('base64'),decoded=decodeEnvironmentKey(encoded);assert(decoded.equals(key));decoded.fill(0);
 for(const invalid of [undefined,'',encoded+'\n',encoded.replaceAll('=',''),Buffer.alloc(31).toString('base64'),'not-base64'])
  denied(()=>decodeEnvironmentKey(invalid),'KEY_INVALID');key.fill(0);
});
test('content SHA binding is checked before encryption and after authenticated decryption',()=>{
 const key=randomBytes(32);denied(()=>encryptBundle(content,key,{...binding,content_sha256:'d'.repeat(64)}),'CONTENT_BINDING_MISMATCH');
 // A real authenticated envelope intentionally created with a dishonest content
 // binding proves post-auth content verification independently of tag failure.
 const falseBinding={...binding,content_sha256:'d'.repeat(64)},nonce=randomBytes(12);
 const header={format:'cluvo-backup-envelope',algorithm:'AES-256-GCM',...falseBinding,content_bytes:content.length,nonce_b64:nonce.toString('base64')};
 const cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});cipher.setAAD(Buffer.from(JSON.stringify(header)),{plaintextLength:content.length});
 const encrypted=Buffer.concat([cipher.update(content),cipher.final()]);
 const envelope=Buffer.from(JSON.stringify({...header,tag_b64:cipher.getAuthTag().toString('base64'),ciphertext_b64:encrypted.toString('base64')}));
 denied(()=>decryptBundle(envelope,key,falseBinding),'CONTENT_BINDING_MISMATCH');key.fill(0);
});
test('binding getters/symbols/unknown fields are rejected before any value is invoked',()=>{
 const {key,envelope}=fixture();let accessed=false;const getter={...binding};Object.defineProperty(getter,'source_sha',{get(){accessed=true;throw new Error('NEVER_EXPORT');},enumerable:true});
 denied(()=>decryptBundle(envelope,key,getter),'BINDINGS_INVALID');assert.equal(accessed,false);
 const symbol={...binding,[Symbol('hidden')]:true};denied(()=>decryptBundle(envelope,key,symbol),'BINDINGS_INVALID');key.fill(0);
});
test('plain-data Proxy cannot substitute unchecked values after descriptor validation',()=>{
 const {key}=fixture();let propertyGets=0;
 const proxy=new Proxy({...binding},{get(target,name){propertyGets++;if(name==='project_ref')return 'UNCHECKED_LATE_VALUE';return Reflect.get(target,name);}});
 const envelope=encryptBundle(content,key,proxy),plaintext=decryptBundle(envelope,key,binding);
 assert.equal(propertyGets,0);assert(plaintext.equals(content));key.fill(0);plaintext.fill(0);
});
test('actual 8MiB round-trip works within unchanged 64MiB cap without regexp stack failure',()=>{
 const plaintext=Buffer.alloc(8*1024*1024,0x4b),key=randomBytes(32),b={...binding,content_sha256:sha(plaintext)};
 const envelope=encryptBundle(plaintext,key,b);const restored=decryptBundle(envelope,key,b);
 assert(restored.equals(plaintext));assert(envelope.length<=LIMITS.envelope_bytes);key.fill(0);plaintext.fill(0);restored.fill(0);
});
test('actual exact upper 64MiB boundary round-trip passes in isolated Node process',()=>{
 const result=spawnSync(process.execPath,[new URL('./helpers/backup-envelope-upper-boundary.mjs',import.meta.url).pathname],
  {encoding:'utf8',env:{PATH:'',LANG:'C.UTF-8'},timeout:120000,maxBuffer:20000});
 assert.equal(result.status,0,'UPPER_BOUNDARY_SUBPROCESS_FAILED');assert.equal(result.stderr,'');
 const safe=JSON.parse(result.stdout);assert.equal(safe.status,'passed');assert.equal(safe.plaintext_bytes,LIMITS.plaintext_bytes);
 assert.equal(safe.envelope_within_existing_cap,true);assert.equal(safe.exact_bytes_preserved,true);
});
