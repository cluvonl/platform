import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogMismatchDiagnostic,publicCatalogDiagnostics} from '../scripts/staging-catalog-diagnostic.mjs';

test('catalog differences expose fixed fields and counts without identities or values',()=>{
 const source=[{schema:'private_schema',name:'private_table',owner:'private_owner',acl:[['secret_grantor','private_role','SELECT',false]],options:['private_option']},{schema:'private_schema',name:'missing'}];
 const restored=[{schema:'private_schema',name:'private_table',owner:'another_private_owner',acl:[],options:['other_private_option']},{schema:'private_schema',name:'extra'}];
 assert.deepEqual(catalogMismatchDiagnostic('relations',source,restored),{family:'relations',source_rows:2,restored_rows:2,missing_rows:1,extra_rows:1,changed_rows:1,changed_fields:['owner','options','acl'],acl_missing_entries:1,acl_extra_entries:0});
 assert.equal(JSON.stringify(catalogMismatchDiagnostic('relations',source,restored)).includes('private'),false);
});
test('function identity includes overload and kind, while all changed values remain private',()=>{
 const source=[{schema:'private',name:'fn',arguments:'integer',kind:'f',definition:'private_source',acl:[]}];
 const restored=[{...source[0],definition:'private_other_source'}];
 assert.deepEqual(catalogMismatchDiagnostic('functions',source,restored).changed_fields,['definition']);
 assert.equal(catalogMismatchDiagnostic('functions',source,[{...restored[0],arguments:'text'}]).missing_rows,1);
});
test('public projection strips unknown fields, duplicate families, identifiers and unbounded counts',()=>{
 const valid={family:'relations',source_rows:1,restored_rows:1,missing_rows:0,extra_rows:0,changed_rows:1,changed_fields:['acl','secret@example.test'],object:'private',acl_missing_entries:1,acl_extra_entries:0};
 const output=publicCatalogDiagnostics([valid,valid,{...valid,family:'private_family'},{...valid,family:'schemas',source_rows:Infinity}]);
 assert.equal(output.length,1);assert.deepEqual(output[0].changed_fields,['acl']);assert.equal(JSON.stringify(output).includes('private'),false);assert.equal(JSON.stringify(output).includes('@'),false);
});
test('equal rows and ordering expose no false changed fields; duplicate identities stay bounded',()=>{
 const source=[{name:'one',owner:'private'},{name:'two',owner:'other'}];
 const result=catalogMismatchDiagnostic('schemas',source,source.toReversed());
 assert.equal(result.changed_rows,0);assert.deepEqual(result.changed_fields,[]);
 assert.equal(catalogMismatchDiagnostic('schemas',[...source,source[0]],source).missing_rows,1);
});
