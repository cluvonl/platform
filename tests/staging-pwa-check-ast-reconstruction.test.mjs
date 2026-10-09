import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CATALOG_QUERIES} from '../scripts/staging-capture-catalog.mjs';
import {knownPwaCheckAstReconstruction,PWA_CHECK_AST_SOURCE_FILE} from '../scripts/staging-pwa-check-ast-reconstruction.mjs';

const bytes=await readFile(new URL('../supabase/migrations/'+PWA_CHECK_AST_SOURCE_FILE,import.meta.url));
const a="CHECK ((((length(endpoint) >= 8) AND (length(endpoint) <= 2048)) AND (endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'::text)))";
const b="CHECK (((length(endpoint) >= 8) AND (length(endpoint) <= 2048) AND (endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'::text)))";
const row=definition=>({schema:'app',relation:'pwa_push_subscriptions',name:'pwa_push_subscriptions_endpoint_check',kind:'c',deferrable:false,deferred:false,validated:true,definition});
const catalog=definition=>({...Object.fromEntries(Object.keys(CATALOG_QUERIES).map(k=>[k,[]])),constraints:[row(definition)]});

test('known one-check difference authorizes only fixed clone BETWEEN DDL; every other family is exact',()=>{
 const plan=knownPwaCheckAstReconstruction(catalog(a),catalog(b),bytes);
 assert.ok(plan);assert.equal(plan.proof.known_check_count,1);
 assert.equal(plan.proof.other27_catalog_families_equal_before_repair,true);
 assert.equal(plan.proof.semantic_differences_ignored,false);
 assert.match(plan.sql,/length\(endpoint\) between 8 and 2048/);
 assert.equal(/UPDATE\s+(?:pg_catalog\.)?pg_constraint/i.test(plan.sql),false);
 assert.equal(knownPwaCheckAstReconstruction(catalog(a),catalog(a),bytes),null);
});
test('numeric, regex, identity, validated or any other constraint field never authorize a reconstruction',()=>{
 for(const definition of [a.replace('2048','2049'),a.replace('8)','9)'),a.replace('googleapis','evil'),b])
  assert.equal(knownPwaCheckAstReconstruction(catalog(definition),catalog(b),bytes),null);
 for(const definition of [b.replace('2048','2049'),b.replace('googleapis','evil'),a])
  assert.equal(knownPwaCheckAstReconstruction(catalog(a),catalog(definition),bytes),null);
 for(const [key,value]of [['schema','public'],['relation','other'],['name','other'],['kind','f'],['deferrable',true],['deferred',true],['validated',false]]){
  const source=catalog(a),restored=catalog(b);restored.constraints[0][key]=value;
  assert.equal(knownPwaCheckAstReconstruction(source,restored,bytes),null,key);
 }
});
test('missing/extra/duplicate constraints or catalogs and another family including ACLs deny repair',()=>{
 for(const side of ['source','restored'])for(const mutate of [
  value=>{value.constraints=[];},value=>{value.constraints.push(row(side==='source'?a:b));},
  value=>{value.constraints.push({...row(a),name:'other_constraint'});},
  value=>{delete value.relations;},value=>{value.untrusted=[];},value=>{value.constraints[0].untrusted=true;},
 ]){
  const source=catalog(a),restored=catalog(b);mutate(side==='source'?source:restored);
  assert.equal(knownPwaCheckAstReconstruction(source,restored,bytes),null);
 }
 for(const family of Object.keys(CATALOG_QUERIES).filter(k=>k!=='constraints')){
  const source=catalog(a),restored=catalog(b);restored[family].push({changed:true});
  assert.equal(knownPwaCheckAstReconstruction(source,restored,bytes),null,family);
 }
});
test('immutable original SQL body hash is required, never caller source SQL or a generic expression rewrite',()=>{
 assert.equal(knownPwaCheckAstReconstruction(catalog(a),catalog(b),Buffer.from(bytes.toString().replace('between 8 and 2048','between 8 and 2049'))),null);
 assert.equal(knownPwaCheckAstReconstruction(catalog(a),catalog(b),Buffer.from('arbitrary SQL')),null);
 assert.equal(knownPwaCheckAstReconstruction(catalog(a),catalog(b),null),null);
});
