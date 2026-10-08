import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveInitialBackupKey,encryptedArtifactName,BackupCustodyError,INITIAL_BACKUP_KEY_PROFILE} from '../scripts/staging-initial-backup-custody.mjs';

test('backup key is reproducible, domain separated and independently owned',()=>{
 const secret='synthetic-existing-invitation-root-only'.repeat(2);
 const a=deriveInitialBackupKey(secret),b=deriveInitialBackupKey(secret);
 assert.equal(a.length,32);assert.deepEqual(a,b);assert.notEqual(a.toString('hex'),Buffer.from(secret).subarray(0,32).toString('hex'));
 a.fill(0);assert.ok(b.some(byte=>byte!==0));assert.notDeepEqual(b,deriveInitialBackupKey(secret+'changed'));
 assert.equal(INITIAL_BACKUP_KEY_PROFILE,'cluvo-staging-initial16-backup-hkdf-sha256-v1');b.fill(0);
});
test('missing, short or multiline root is refused without disclosing value',()=>{
 for(const secret of [undefined,'short-private-fixture','x'.repeat(32)+'\n']){
  assert.throws(()=>deriveInitialBackupKey(secret),error=>error instanceof BackupCustodyError&&error.code==='INITIAL_BACKUP_ROOT_REQUIRED'&&!error.message.includes('private-fixture'));
 }
});
test('backup custody uses source/run/attempt and refuses names with a path',()=>{
 assert.equal(encryptedArtifactName('a'.repeat(40),'42','1'),'cluvo-staging-initial16-encrypted-'+'a'.repeat(40)+'-42-1');
 for(const args of [['../private','42','1'],['a'.repeat(40),'42','../1'],['a'.repeat(40),'0','1']]){
  assert.throws(()=>encryptedArtifactName(...args),/INITIAL_BACKUP_RUN_REQUIRED/);
 }
});

test('official multiline file-command output is parsed and bound to this workflow',async()=>{
 const {parseInitialArtifactOutput}=await import('../scripts/staging-initial-backup-custody.mjs');
 const delimiter='ghadelimiter_12345678-1234-1234-1234-123456789012';
 const entries={'artifact-id':'55','artifact-url':'https://github.com/cluvonl/platform/actions/runs/42/artifacts/55','artifact-digest':'a'.repeat(64)};
 const output=Buffer.from(Object.entries(entries).map(([key,value])=>`${key}<<${delimiter}\n${value}\n${delimiter}\n`).join(''));
 assert.deepEqual(parseInitialArtifactOutput(output,'42'),entries);
 assert.throws(()=>parseInitialArtifactOutput(output,'43'),/INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID/);
 for(const bad of [Buffer.concat([output,Buffer.from('artifact-id=55\n')]),Buffer.from(output.toString().replace('artifacts/55','artifacts/66')),Buffer.from(output.toString().replace(delimiter+'\nartifact-url','bad-delimiter\nartifact-url'))]){
  assert.throws(()=>parseInitialArtifactOutput(bad,'42'),/INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID/);
 }
});
