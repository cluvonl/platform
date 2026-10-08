import test from 'node:test';
import assert from 'node:assert/strict';
import {schemaFirstRestoreLists} from '../scripts/staging-restore-toc.mjs';
test('schema-first lists preserve every native entry exactly once and in relative order',()=>{
 const toc='; Native TOC\n1; 2615 100 SCHEMA - private_schema private_owner\n2; 3079 101 EXTENSION - private_extension\n3; 1259 102 TABLE private_schema private_table private_owner\n4; 0 0 ACL - SCHEMA private_schema private_owner\n';
 const lists=schemaFirstRestoreLists(toc);
 assert.equal(lists.entries,4);assert.equal(lists.schemaEntries,1);
 const entries=value=>value.split('\n').filter(line=>/^[0-9]+;/.test(line));
 assert.deepEqual(entries(lists.schemas),entries(toc).slice(0,1));assert.deepEqual(entries(lists.remaining),entries(toc).slice(1));
});
test('ambiguous, duplicate, empty or unknown TOCs fail before restoration',()=>{
 for(const toc of ['',null,'unknown','1; 0 0 SCHEMA - one\n1; 0 0 SCHEMA - two','0; 0 0 SCHEMA - one'])assert.throws(()=>schemaFirstRestoreLists(toc),/RESTORE_TOC_UNKNOWN/);
});
