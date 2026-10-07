// Exact 64MiB synthetic boundary, no actual backup/ENV/DB/network/key export.
import {randomBytes,createHash} from 'node:crypto';
import {LIMITS,encryptBundle,decryptBundle} from '../../scripts/backup-envelope.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let key,plaintext,decrypted;
try{
 plaintext=Buffer.alloc(LIMITS.plaintext_bytes,0x5a);key=randomBytes(32);
 const binding={schema_version:1,environment:'staging',project_ref:'abcdefghijklmnopqrst',source_sha:'a'.repeat(40),
  migration_manifest_sha256:'b'.repeat(64),snapshot_manifest_sha256:'c'.repeat(64),content_sha256:sha(plaintext)};
 const envelope=encryptBundle(plaintext,key,binding);decrypted=decryptBundle(envelope,key,binding);
 if(!decrypted.equals(plaintext)||envelope.length>LIMITS.envelope_bytes)throw new Error('BOUNDARY_ROUNDTRIP_FAILED');
 console.log(JSON.stringify({scope:'LOCAL_CRYPTO_ONLY',status:'passed',plaintext_bytes:LIMITS.plaintext_bytes,
  envelope_within_existing_cap:true,exact_bytes_preserved:true}));
}catch{
 console.log(JSON.stringify({scope:'LOCAL_CRYPTO_ONLY',status:'failed',code:'BOUNDARY_ROUNDTRIP_FAILED'}));process.exitCode=1;
}finally{key?.fill(0);plaintext?.fill(0);decrypted?.fill(0);}
