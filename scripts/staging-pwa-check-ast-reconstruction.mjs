// One known PostgreSQL17 dump/reparse AST difference, confined to the inspected
// owned restore clone. Comparisons and captured source bytes remain exact.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {CATALOG_QUERIES} from './staging-capture-catalog.mjs';

export const PWA_CHECK_AST_SOURCE_FILE='20261009100000_pwa_domain.sql';
export const PWA_CHECK_AST_SOURCE_FILE_SHA256='18cc63b457fddea3f003bceb4d31f310291692e70485e6aa013e4091a8d47d41';
export const PWA_CHECK_AST_SOURCE_DEFINITION_SHA256='7c0d72ecafb4ead98076419e9b1b47bbc06885137f3388b76409f0f3a156d72b';
export const PWA_CHECK_AST_RESTORED_DEFINITION_SHA256='48ba42e6e666c6b5035a70176d12d0163a6a51ac1e2d080f1fb56c51f69ffc12';
const hash=value=>createHash('sha256').update(value).digest('hex');
const known=row=>row?.schema==='app'&&row.relation==='pwa_push_subscriptions'&&row.name==='pwa_push_subscriptions_endpoint_check';
const expression="length(endpoint) between 8 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'";
const expectedFields=['schema','relation','name','kind','deferrable','deferred','validated','definition'];
const familyNames=Object.keys(CATALOG_QUERIES).sort();
function catalog(value){
 return value&&[Object.prototype,null].includes(Object.getPrototypeOf(value))
  &&isDeepStrictEqual(Object.keys(value).sort(),familyNames)&&familyNames.every(key=>Array.isArray(value[key]));
}

export function knownPwaCheckAstReconstruction(source,restored,migrationBytes){
 // Any other catalog difference refuses the repair. The caller subsequently
 // performs its original full28 catalog/data/sequence/history/actor gate.
 if(!catalog(source)||!catalog(restored)||!Buffer.isBuffer(migrationBytes)
  ||hash(migrationBytes)!==PWA_CHECK_AST_SOURCE_FILE_SHA256
  ||!migrationBytes.toString('utf8').includes('endpoint text not null check('+expression+')'))return null;
 for(const family of familyNames)if(family!=='constraints'&&!isDeepStrictEqual(source[family],restored[family]))return null;
 const expected=source.constraints.filter(known),actual=restored.constraints.filter(known);
 if(expected.length!==1||actual.length!==1)return null;
 const a=expected[0],b=actual[0];
 if(!isDeepStrictEqual(Object.keys(a).sort(),expectedFields.toSorted())
  ||!isDeepStrictEqual(Object.keys(b).sort(),expectedFields.toSorted())
  ||a.kind!=='c'||a.deferrable!==false||a.deferred!==false||a.validated!==true
  ||typeof a.definition!=='string'||typeof b.definition!=='string'
  ||hash(a.definition)!==PWA_CHECK_AST_SOURCE_DEFINITION_SHA256
  ||hash(b.definition)!==PWA_CHECK_AST_RESTORED_DEFINITION_SHA256)return null;
 const {definition:sourceDefinition,...sourceFields}=a,{definition:restoredDefinition,...restoredFields}=b;
 if(sourceDefinition===restoredDefinition||!isDeepStrictEqual(sourceFields,restoredFields)
  ||!isDeepStrictEqual(source.constraints.filter(row=>!known(row)),restored.constraints.filter(row=>!known(row))))return null;
 return Object.freeze({
  // Native DDL derives a new expression tree from the immutable BETWEEN form.
  // No captured SQL, identifier, owner, expression or setting is interpolated.
  sql:`BEGIN;SET LOCAL lock_timeout='15s';SET LOCAL statement_timeout='30s';
DO $cluvo_known_check_ast$ DECLARE old_comment text;constraint_oid oid; BEGIN
SELECT oid INTO STRICT constraint_oid FROM pg_catalog.pg_constraint WHERE conrelid='"app"."pwa_push_subscriptions"'::regclass
 AND conname='pwa_push_subscriptions_endpoint_check' AND contype='c' AND NOT condeferrable AND NOT condeferred AND convalidated;
IF pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(constraint_oid,false),'UTF8')),'hex')
 IS DISTINCT FROM '${PWA_CHECK_AST_RESTORED_DEFINITION_SHA256}' THEN RAISE EXCEPTION 'PWA_CLONE_CHECK_AST_REFUSED';END IF;
old_comment:=pg_catalog.obj_description(constraint_oid,'pg_constraint');
ALTER TABLE ONLY "app"."pwa_push_subscriptions" DROP CONSTRAINT "pwa_push_subscriptions_endpoint_check";
ALTER TABLE ONLY "app"."pwa_push_subscriptions" ADD CONSTRAINT "pwa_push_subscriptions_endpoint_check" CHECK(${expression});
EXECUTE pg_catalog.format('COMMENT ON CONSTRAINT "pwa_push_subscriptions_endpoint_check" ON "app"."pwa_push_subscriptions" IS %L',old_comment);
SELECT oid INTO STRICT constraint_oid FROM pg_catalog.pg_constraint WHERE conrelid='"app"."pwa_push_subscriptions"'::regclass
 AND conname='pwa_push_subscriptions_endpoint_check';
IF pg_catalog.obj_description(constraint_oid,'pg_constraint') IS DISTINCT FROM old_comment
 OR pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.pg_get_constraintdef(constraint_oid,false),'UTF8')),'hex')
 IS DISTINCT FROM '${PWA_CHECK_AST_SOURCE_DEFINITION_SHA256}' THEN RAISE EXCEPTION 'PWA_CLONE_CHECK_AST_REFUSED';END IF;
END $cluvo_known_check_ast$;
COMMIT;`,
  proof:Object.freeze({format:'PWA_OWNED_CLONE_CHECK_AST_RECONSTRUCTION_V1',used:true,
   scope:'OWNED_CLONE_ONLY',known_check_count:1,original_migration_sha256:PWA_CHECK_AST_SOURCE_FILE_SHA256,
   source_definition_sha256:PWA_CHECK_AST_SOURCE_DEFINITION_SHA256,restored_definition_sha256:PWA_CHECK_AST_RESTORED_DEFINITION_SHA256,
   other27_catalog_families_equal_before_repair:true,other_constraint_rows_and_fields_equal_before_repair:true,
   captured_source_sql_executed:false,system_catalog_update_performed:false,source_database_mutated:false,
   known_check_comment_preserved_and_rechecked:true,drop_cascade_used:false,
   exact_catalog_comparison_unchanged:true,semantic_differences_ignored:false}),
 });
}
