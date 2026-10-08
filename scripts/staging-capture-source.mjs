import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {IMMUTABLE16} from './staging-migration-files.mjs';
import {CAPABILITY_SOURCE_SHA256,INVENTORY_SOURCE_SHA256} from './staging-capture-capability-contract.mjs';
const ROOT=new URL('../supabase/migrations/',import.meta.url);
// Only fixed known public source files are read. No directory/file target input,
// environment, subprocess, Git write, database or credential access is used.
export async function verifyImmutable16({read=readFile}={}){
 for(const file of IMMUTABLE16){const bytes=await read(new URL(file.file,ROOT));if(!Buffer.isBuffer(bytes)||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('IMMUTABLE16_SOURCE_BYTES_CHANGED');}
 return IMMUTABLE16;
}
export async function verifyCanonicalHelperSources(){
 for(const [file,expected]of [['staging-backup-capabilities.mjs',CAPABILITY_SOURCE_SHA256],['staging-data-inventory.mjs',INVENTORY_SOURCE_SHA256]]){
  const bytes=await readFile(new URL(file,import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('CAPTURE_CANONICAL_HELPER_SOURCE_CHANGED');
 }
}
