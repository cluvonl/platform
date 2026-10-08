// Private catalog/data collector bound to the fixed staging session before beginCapture. No connection/process/file write on import.
import {createHash} from 'node:crypto';
import {CATALOG_QUERIES,FROZEN_DRIVER_SHA256} from './staging-capture-catalog.mjs';
import * as plan from './staging-capture-queries.mjs';
import {CATALOG_SQL as DATASET_CATALOG_SQL,DATASETS,inventoryPlan,inventoryReport} from './staging-data-inventory.mjs';
import {PROVEN_DEFAULTS,PROVEN_IMAGE} from './pinned-restore-extension-defaults.mjs';
import {CAPABILITY_COUNTERS,CAPABILITY_FLAGS,CAPABILITY_SOURCE_SHA256,INVENTORY_SOURCE_SHA256} from './staging-capture-capability-contract.mjs';
import {IMMUTABLE16} from './staging-migration-files.mjs';
import {verifyCanonicalHelperSources,verifyImmutable16} from './staging-capture-source.mjs';
import {sourceBindingSnapshot,syntheticBinding,sourceBindingHash} from './staging-capture-binding.mjs';
export class CollectorError extends Error{constructor(code){super(code);this.code=code;}}
const requireValue=(value,code)=>{if(!value)throw new CollectorError(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hash=value=>sha(Buffer.from(JSON.stringify(value)));
const isHash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const identifier=value=>{requireValue(typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=63&&!/[\0\x00-\x1f\x7f]/.test(value),'CAPTURE_IDENTIFIER_UNKNOWN');return '"'+value.replaceAll('"','""')+'"';};
const table=(schema,name)=>identifier(schema)+'.'+identifier(name);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
function exact(value,keys,code){requireValue(record(value),code);const descriptors=Object.getOwnPropertyDescriptors(value);requireValue(Reflect.ownKeys(descriptors).length===keys.length&&keys.every(k=>Object.hasOwn(descriptors,k)&&Object.hasOwn(descriptors[k],'value')),code);return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));}
function frozen(value){if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;}
function sourceFiles(value){
 requireValue(Array.isArray(value)&&value.length===16,'IMMUTABLE16_SOURCE_REQUIRED');
 let previous='';return frozen(value.map((row,i)=>{const r=exact(row,['file','sha256'],'IMMUTABLE16_SOURCE_UNKNOWN');const match=typeof r.file==='string'&&r.file.match(/^([0-9]{14})_([a-z0-9_]+)\.sql$/);requireValue(match&&match[1]>previous&&isHash(r.sha256)&&r.file===IMMUTABLE16[i].file&&r.sha256===IMMUTABLE16[i].sha256,'IMMUTABLE16_SOURCE_UNKNOWN');previous=match[1];return{file:r.file,sha256:r.sha256,version:match[1],name:match[2]};}));
}
function snapshot(value){
 const r=exact(value,['backend_pid','backend_start','database','primary','exported_snapshot','visibility_snapshot'],'CAPTURE_SNAPSHOT_UNKNOWN');
 requireValue(Number.isSafeInteger(r.backend_pid)&&r.backend_pid>0&&typeof r.backend_start==='string'&&r.backend_start.length<=128&&Number.isFinite(Date.parse(r.backend_start))&&r.database==='postgres'&&r.primary===true&&typeof r.exported_snapshot==='string'&&/^[0-9A-F]+-[0-9A-F]+-[0-9]+$/.test(r.exported_snapshot)&&typeof r.visibility_snapshot==='string'&&/^[0-9]+:[0-9]+:[0-9,]*$/.test(r.visibility_snapshot)&&r.visibility_snapshot.length<=1000000,'CAPTURE_SNAPSHOT_UNKNOWN');return frozen(r);
}
function freshSnapshot(value,original){
 const r=exact(value,['backend_pid','backend_start','database','primary','visibility_snapshot','phase'],'FRESH_CONTEXT_UNKNOWN');
 requireValue(r.backend_pid===original.backend_pid&&r.backend_start===original.backend_start
  &&r.database==='postgres'&&r.primary===true&&r.phase==='fresh_read'
  &&typeof r.visibility_snapshot==='string'&&/^[0-9]+:[0-9]+:[0-9,]*$/.test(r.visibility_snapshot)
  &&r.visibility_snapshot.length<=1000000,'FRESH_BACKEND_OR_CONTEXT_CHANGED');return frozen(r);
}
export function snapshotBoundQuery(sql,id){
 requireValue(typeof sql==='string'&&/^[a-z0-9_.-]{1,100}$/.test(id),'CAPTURE_QUERY_UNKNOWN');
 return `SELECT jsonb_build_object('backend_pid',pg_backend_pid(),'backend_start',(SELECT backend_start::text FROM pg_stat_activity WHERE pid=pg_backend_pid()),'visibility_snapshot',pg_current_snapshot()::text,'database',current_database(),'primary',NOT pg_is_in_recovery(),'read_only',current_setting('transaction_read_only')='on','isolation',current_setting('transaction_isolation'),'payload',q.payload) FROM (${sql.replace(/;\s*$/,'')}) q(payload) /* cluvo_capture_id:${id} */`;
}
function payload(results,context){
 requireValue(Array.isArray(results)&&results.length===1,'CAPTURE_RESULT_SHAPE_UNKNOWN');
 const result=exact(results[0],['command','rows'],'CAPTURE_RESULT_SHAPE_UNKNOWN');
 requireValue(result.command==='SELECT 1'&&Array.isArray(result.rows)&&result.rows.length===1&&Array.isArray(result.rows[0])&&result.rows[0].length===1&&typeof result.rows[0][0]==='string'&&Buffer.byteLength(result.rows[0][0])<=8_000_000,'CAPTURE_RESULT_SHAPE_UNKNOWN');
 let raw;try{raw=JSON.parse(result.rows[0][0]);}catch{throw new CollectorError('CAPTURE_JSON_UNKNOWN');}
 const r=exact(raw,['backend_pid','backend_start','visibility_snapshot','database','primary','read_only','isolation','payload'],'CAPTURE_QUERY_BINDING_UNKNOWN');
 requireValue(r.backend_pid===context.backend_pid&&r.backend_start===context.backend_start&&r.visibility_snapshot===context.visibility_snapshot&&r.database==='postgres'&&r.primary===true&&r.read_only===true&&r.isolation==='repeatable read','CAPTURE_QUERY_SNAPSHOT_CHANGED');return r.payload;
}
function records(value,code){requireValue(Array.isArray(value)&&value.length<=1000000&&value.every(record),code);return value;}
function lock(value,context){const r=exact(value,['backend_pid','backend_start','exclusive_lock','read_only','isolation','visibility_snapshot'],'CAPTURE_LOCK_UNKNOWN');requireValue(r.backend_pid===context.backend_pid&&r.backend_start===context.backend_start&&r.visibility_snapshot===context.visibility_snapshot&&r.exclusive_lock===true&&r.read_only===true&&r.isolation==='repeatable read','CAPTURE_LOCK_OR_SNAPSHOT_LOST');}
function configSafety(value){
 const keys=['secret_named_settings','unknown_named_settings','subscriptions','foreign_servers','foreign_user_mappings','custom_tablespaces'];
 const r=exact(value,keys,'CAPTURE_CONFIG_SAFETY_UNKNOWN');requireValue(keys.every(k=>count(r[k])),'CAPTURE_CONFIG_SAFETY_UNKNOWN');
 for(const [key,code]of [['secret_named_settings','CAPTURE_SECRET_CONFIGURATION_PRESENT'],['unknown_named_settings','CAPTURE_UNKNOWN_CONFIGURATION_PRESENT'],['subscriptions','CAPTURE_SUBSCRIPTIONS_NONPORTABLE'],['foreign_servers','CAPTURE_FOREIGN_SERVER_NONPORTABLE'],['foreign_user_mappings','CAPTURE_FOREIGN_USER_MAPPING_NONPORTABLE'],['custom_tablespaces','CAPTURE_TABLESPACE_NONPORTABLE']])requireValue(r[key]===0,code);return r;
}
function capabilities(value){
 value=exact(value,['server_version',...CAPABILITY_COUNTERS,...CAPABILITY_FLAGS,'private_extension_relations','private_extension_versions'],'CAPTURE_CAPABILITY_PROFILE_UNKNOWN');
 requireValue(CAPABILITY_COUNTERS.every(k=>count(value[k]))&&CAPABILITY_FLAGS.every(k=>typeof value[k]==='boolean'),'CAPTURE_CAPABILITY_PROFILE_UNKNOWN');
 requireValue(record(value)&&value.server_version===170011&&value.primary===true&&value.readonly===true&&value.repeatable_read===true&&value.current_role_postgres===true,'CAPTURE_CAPABILITY_PROFILE_UNKNOWN');
 requireValue(typeof value.role_superuser==='boolean'&&typeof value.role_bypassrls==='boolean','CAPTURE_CAPABILITY_PROFILE_UNKNOWN');
 for(const [key,code]of [['table_select_denied','CAPTURE_DATA_SELECT_DENIED'],['schema_usage_denied','CAPTURE_SCHEMA_USAGE_DENIED'],['table_rls_filtered','CAPTURE_DATA_RLS_FILTERED'],['sequence_select_denied','CAPTURE_SEQUENCE_SELECT_DENIED'],['large_object_acl_denied','CAPTURE_LARGEOBJECT_SELECT_DENIED'],['foreign_tables','CAPTURE_FOREIGN_DATA_NONPORTABLE'],['custom_tablespaces','CAPTURE_TABLESPACE_NONPORTABLE'],['filtered_extension_config_relations','CAPTURE_EXTENSION_CONFIG_FILTER_NONPORTABLE']])requireValue(count(value[key])&&value[key]===0,code);
 for(const key of ['private_role_settings_catalog_readable','membership_catalog_readable','parameter_acl_catalog_readable','security_label_catalog_readable'])requireValue(value[key]===true,'CAPTURE_PRIVATE_CATALOG_UNREADABLE');
 requireValue(Array.isArray(value.private_extension_versions)&&count(value.installed_extensions)&&value.private_extension_versions.length===value.installed_extensions,'CAPTURE_EXTENSION_PROFILE_UNKNOWN');
 const seen=new Set();for(const v of value.private_extension_versions){const r=exact(v,['name','version'],'CAPTURE_EXTENSION_PROFILE_UNKNOWN');requireValue(typeof r.name==='string'&&typeof r.version==='string'&&!seen.has(r.name),'CAPTURE_EXTENSION_PROFILE_UNKNOWN');seen.add(r.name);requireValue(PROVEN_DEFAULTS[r.name]===r.version,'CAPTURE_EXTENSION_PACKAGE_UNPROVED');}
 requireValue(Array.isArray(value.private_extension_relations)&&count(value.unregistered_extension_relations)&&value.private_extension_relations.length===value.unregistered_extension_relations,'CAPTURE_EXTENSION_DATA_UNKNOWN');return value;
}
function historyProof(value,files,layout){
 const rows=records(value,'CAPTURE_HISTORY_UNKNOWN');requireValue(rows.length<=files.length,'CAPTURE_HISTORY_NOT_IMMUTABLE_PREFIX');const gaps=[];
 for(let i=0;i<rows.length;i++){
  const r=exact(rows[i],['version','name','statement_count','single_statement_sha256','row_sha256'],'CAPTURE_HISTORY_UNKNOWN');const f=files[i];
  requireValue(r.version===f.version&&r.name===f.name&&isHash(r.row_sha256)&&(r.statement_count===null||count(r.statement_count))&&(r.single_statement_sha256===null||isHash(r.single_statement_sha256)),'CAPTURE_HISTORY_NOT_IMMUTABLE_PREFIX');
  if(r.statement_count!==1||r.single_statement_sha256!==f.sha256)gaps.push({version:f.version,file:f.file,code:'APPLIED_SOURCE_BYTES_PROVENANCE_MISSING'});
 }
 if(rows.length===0)requireValue(layout.schemas.length===0&&layout.app_objects===0,'CAPTURE_STAGE0_HAS_APPLICATION_STATE');
 else requireValue(layout.schemas.length===3&&['app','api','internal'].every(s=>layout.schemas.includes(s)),'CAPTURE_APPLIED_PREFIX_SCHEMA_UNKNOWN');
 return{stage:rows.length===0?'stage0':'immutable_prefix',applied_prefix:rows.length,ordered_private_history:rows,ordered_private_history_sha256:hash(rows),applied_source_files:files.slice(0,rows.length),original_source_bytes_proven:rows.length===0||gaps.length===0,provenance_gaps:gaps};
}
function layout(value){const r=exact(value,['schemas','app_objects','history_present'],'CAPTURE_LAYOUT_UNKNOWN');requireValue(Array.isArray(r.schemas)&&new Set(r.schemas).size===r.schemas.length&&r.schemas.every(s=>['app','api','internal'].includes(s))&&count(r.app_objects)&&typeof r.history_present==='boolean','CAPTURE_LAYOUT_UNKNOWN');return r;}
function dataRelations(value){
 const rows=records(value,'CAPTURE_DATA_RELATIONS_UNKNOWN'),seen=new Set();
 return rows.map(row=>{const r=exact(row,['schema','name','kind','persistence','schema_readable','readable','full_visibility'],'CAPTURE_DATA_RELATIONS_UNKNOWN');table(r.schema,r.name);const id=JSON.stringify([r.schema,r.name]);requireValue(!seen.has(id)&&['r','m'].includes(r.kind)&&['p','u'].includes(r.persistence),'CAPTURE_DATA_RELATIONS_UNKNOWN');seen.add(id);requireValue(r.schema_readable===true&&r.readable===true&&r.full_visibility===true,'CAPTURE_DATA_READ_SCOPE_UNKNOWN');return r;}).sort((a,b)=>a.schema.localeCompare(b.schema)||a.name.localeCompare(b.name));
}
function dataSql(r){return `SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM ${r.kind==='r'?'ONLY ':''}${table(r.schema,r.name)} t`;}
const LO_SQL=plan.aggregate(`SELECT oid,pg_get_userbyid(lomowner) owner,(SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(g.grantor),CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,g.privilege_type,g.is_grantable) ORDER BY pg_get_userbyid(g.grantor),g.grantee,g.privilege_type,g.is_grantable),'[]'::jsonb) FROM aclexplode(coalesce(lomacl,acldefault('L',lomowner))) g) acl,octet_length(lo_get(oid)) bytes,encode(sha256(lo_get(oid)),'hex') sha256 FROM pg_largeobject_metadata`);

// The caller owns endCapture/close and dump/drift work. This returns PRIVATE
// in-memory metadata; it neither writes files nor logs private metadata/errors.
async function collectBoundSnapshot(bridge,options,binding,bindingReader,original=null,transition=null){
 const opt=exact(options,['source_sha','migration_files'],'CAPTURE_TRUSTED_SOURCE_REQUIRED');requireValue(typeof opt.source_sha==='string'&&/^[0-9a-f]{40}$/.test(opt.source_sha),'CAPTURE_TRUSTED_SOURCE_REQUIRED');
 const files=sourceFiles(opt.migration_files),sourceSha=opt.source_sha;
 const beginName=original?'beginFreshRead':'beginCapture',queryName=original?'freshReadQuery':'captureQuery';
 requireValue(bridge&&[beginName,queryName,'checkLock'].every(k=>typeof bridge[k]==='function'),'CAPTURE_BRIDGE_REQUIRED');
 const begin=bridge[beginName].bind(bridge),query=bridge[queryName].bind(bridge),check=bridge.checkLock.bind(bridge),journal=[];
 let context;
 const read=async(sql,id)=>{const text=snapshotBoundQuery(sql,id);let result;try{result=await query(text);}catch{throw new CollectorError('CAPTURE_QUERY_UNAVAILABLE');}const value=payload(result,context);journal.push({id,sql_sha256:sha(Buffer.from(text))});return value;};
 const checkContext=async()=>{let result;try{result=await check();}catch{throw new CollectorError('CAPTURE_LOCK_UNAVAILABLE');}lock(result,context);};
 try{
  try{await verifyCanonicalHelperSources();}catch(error){throw new CollectorError(error?.message==='CAPTURE_CANONICAL_HELPER_SOURCE_CHANGED'?'CAPTURE_CANONICAL_HELPER_SOURCE_CHANGED':'CAPTURE_CANONICAL_HELPER_SOURCE_UNAVAILABLE');}
  try{await verifyImmutable16();}catch(error){throw new CollectorError(error?.message==='IMMUTABLE16_SOURCE_BYTES_CHANGED'?'IMMUTABLE16_SOURCE_BYTES_CHANGED':'IMMUTABLE16_SOURCE_UNAVAILABLE');}
  try{if(transition)transition.fresh_attempted=true;const value=await begin();context=original?freshSnapshot(value,original.snapshot):snapshot(value);}catch(error){throw error instanceof CollectorError?error:new CollectorError('CAPTURE_SNAPSHOT_UNAVAILABLE');}await checkContext();
  const configuration_safety=configSafety(await read(plan.CONFIG_SAFETY_SQL,'configuration_safety'));
  const capability=capabilities(await read(plan.CAPTURE_CAPABILITY_SQL,'capabilities'));
  const sourceLayout=layout(await read(plan.SOURCE_LAYOUT_SQL,'source_layout'));
  const sourceHistory=historyProof(sourceLayout.history_present?await read(plan.HISTORY_SQL,'source_history'):[],files,sourceLayout);
  const datasetCatalog=await read(DATASET_CATALOG_SQL,'dataset_catalog');let plans,inventory;
  requireValue(datasetCatalog?.role_security?.superuser===capability.role_superuser&&datasetCatalog?.role_security?.bypass_rls===capability.role_bypassrls,'CAPTURE_DATASET_ROLE_PROFILE_CHANGED');
  try{plans=inventoryPlan(datasetCatalog);const counts=[];for(const p of plans.filter(p=>p.sql))counts.push(await read(p.sql,'dataset.'+p.id));inventory=inventoryReport(plans,counts);}catch(e){if(e instanceof CollectorError)throw e;const codes=new Set(['DATASET_CATALOG_UNKNOWN','AUTH_SCHEMA_UNKNOWN','REQUIRED_DATASET_TABLE_MISSING','DATASET_RELATION_KIND_UNKNOWN','DATASET_COUNT_PERMISSION_UNKNOWN','DATASET_COUNT_SCOPE_UNKNOWN','DATASET_COLUMN_MISSING','DATASET_COLUMN_TYPE_UNKNOWN','UNCLASSIFIED_CRYPTOGRAPHIC_COLUMN','UNCLASSIFIED_TCE_CONTRACT','UNCLASSIFIED_TCE_COLUMN','TCE_COUNT_PERMISSION_UNKNOWN','AUTH_ENVELOPE_FORMAT_UNKNOWN','AUTH_LEGACY_FORMAT_UNKNOWN','DATASET_COUNT_UNKNOWN','DATASET_COUNT_COVERAGE_UNKNOWN']);throw new CollectorError(codes.has(e?.code)?e.code:'CAPTURE_DATASET_UNKNOWN');}
  requireValue(inventory.key_dependent_data==='proven_empty'&&inventory.datasets.every(d=>d.id!=='pgsodium_keys'||!d.key_definition_count),'CAPTURE_PROVIDER_CRYPTOGRAPHIC_DATA_NONPORTABLE');
  requireValue(inventory.storage_objects===0,'CAPTURE_STORAGE_BINARIES_REQUIRED');
  inventory={...inventory,count_snapshot_consistent:true,key_family_count:2};await checkContext();
  const classes=records(await read(plan.EXTENSION_OBJECT_CLASSES_SQL,'extension_object_classes'),'CAPTURE_OBJECT_CLASS_UNKNOWN');
  for(const row of classes){const r=exact(row,['class','extension','objects'],'CAPTURE_OBJECT_CLASS_UNKNOWN');requireValue(typeof r.extension==='string'&&Object.hasOwn(PROVEN_DEFAULTS,r.extension)&&count(r.objects)&&typeof r.class==='string'&&plan.SUPPORTED_EXTENSION_CLASSES.includes(r.class),'CAPTURE_OBJECT_CLASS_UNREPRESENTED');}
  const object_classes=records(await read(plan.OBJECT_CLASS_INVENTORY_SQL,'object_classes'),'CAPTURE_OBJECT_CLASS_UNKNOWN');
  for(const row of object_classes){const r=exact(row,['class','objects'],'CAPTURE_OBJECT_CLASS_UNKNOWN');requireValue(count(r.objects)&&typeof r.class==='string'&&plan.KNOWN_OBJECT_CLASSES.includes(r.class),'CAPTURE_OBJECT_CLASS_UNREPRESENTED');}
  const catalog={};for(const [family,sql]of Object.entries(CATALOG_QUERIES))catalog[family]=records(await read(plan.aggregate(sql),'catalog.'+family),'CAPTURE_CATALOG_'+family.toUpperCase()+'_UNKNOWN');
  requireValue(Object.keys(catalog).length===28,'CAPTURE_CATALOG_COVERAGE_UNKNOWN');
  const catalogueRelationNames=new Set();for(const r of catalog.relations){table(r.schema,r.name);const id=JSON.stringify([r.schema,r.name]);requireValue(!catalogueRelationNames.has(id)&&['r','p','v','m','S','f'].includes(r.kind),'CAPTURE_RELATION_DEFINITION_UNKNOWN');catalogueRelationNames.add(id);}
  requireValue(catalog.relations.filter(r=>['r','p','m'].includes(r.kind)).length===capability.user_data_relations,'CAPTURE_CATALOG_DATA_COVERAGE_UNKNOWN');
  const supplemental={};for(const [family,sql]of Object.entries(plan.SUPPLEMENTAL_QUERIES))supplemental[family]=records(await read(plan.aggregate(sql),'supplemental.'+family),'CAPTURE_SUPPLEMENTAL_'+family.toUpperCase()+'_UNKNOWN');
  const relations=dataRelations(await read(plan.DATA_RELATIONS_SQL,'data_relations')),data=[];
  for(const r of relations)requireValue(catalogueRelationNames.has(JSON.stringify([r.schema,r.name])),'CAPTURE_EXTENSION_RELATION_DEFINITION_UNPROVED');
  for(const r of catalog.relations.filter(r=>['r','m'].includes(r.kind)))requireValue(relations.some(v=>v.schema===r.schema&&v.name===r.name&&v.kind===r.kind),'CAPTURE_DATA_RELATION_COVERAGE_UNKNOWN');
  for(let i=0;i<relations.length;i++){const r=relations[i],v=exact(await read(dataSql(r),'data.'+i),['rows','sha256'],'CAPTURE_DATA_HASH_UNKNOWN');requireValue(count(v.rows)&&isHash(v.sha256),'CAPTURE_DATA_HASH_UNKNOWN');data.push({schema:r.schema,relation:r.name,kind:r.kind,...v});}
  for(let i=0;i<capability.private_extension_relations.length;i++){const r=capability.private_extension_relations[i];table(r.schema,r.name);requireValue(r.readable===true&&r.rls_visible===true,'CAPTURE_UNREGISTERED_EXTENSION_DATA_UNREADABLE');const d=data.find(d=>d.schema===r.schema&&d.relation===r.name);requireValue(d&&d.rows===0,'CAPTURE_UNREGISTERED_EXTENSION_DATA_NONPORTABLE');}
  const sequences=[];for(let i=0;i<catalog.sequences.length;i++){const r=catalog.sequences[i];const v=exact(await read(`SELECT jsonb_build_object('last_value',last_value::text,'is_called',is_called) FROM ${table(r.schema,r.name)}`,'sequence.'+i),['last_value','is_called'],'CAPTURE_SEQUENCE_VALUE_UNKNOWN');requireValue(typeof v.last_value==='string'&&/^-?[0-9]{1,19}$/.test(v.last_value)&&typeof v.is_called==='boolean','CAPTURE_SEQUENCE_VALUE_UNKNOWN');sequences.push({...r,...v});}
  requireValue(count(capability.sequences)&&sequences.length===capability.sequences,'CAPTURE_SEQUENCE_COVERAGE_UNKNOWN');
  const large_objects=records(await read(LO_SQL,'large_objects'),'CAPTURE_LARGEOBJECT_UNKNOWN');for(const r of large_objects)requireValue(Number.isSafeInteger(r.oid)&&r.oid>0&&count(r.bytes)&&isHash(r.sha256)&&typeof r.owner==='string'&&Array.isArray(r.acl),'CAPTURE_LARGEOBJECT_UNKNOWN');requireValue(count(capability.large_objects)&&large_objects.length===capability.large_objects,'CAPTURE_LARGEOBJECT_COVERAGE_UNKNOWN');
  const native_guard=exact(await read(plan.NATIVE_GUARD_SQL,'native_guard'),['owner_present','owner_restricted','guard_present','current_actor_present','users_policy','sessions_policy'],'CAPTURE_NATIVE_GUARD_UNKNOWN');requireValue(Object.values(native_guard).every(v=>typeof v==='boolean'),'CAPTURE_NATIVE_GUARD_UNKNOWN');
  if(sourceHistory.applied_prefix>=15)requireValue(Object.values(native_guard).every(v=>v===true),'CAPTURE_NATIVE_GUARD_BASELINE_MISSING');
  await checkContext();
  let finalBinding;try{finalBinding=sourceBindingSnapshot(bindingReader());}catch{throw new CollectorError('CAPTURE_SOURCE_BINDING_UNAVAILABLE');}
  requireValue(sourceBindingHash(finalBinding)===sourceBindingHash(binding),'CAPTURE_SOURCE_BINDING_CHANGED');
  return frozen({format:'cluvo-staging-private-snapshot',schema_version:2,environment:binding.environment,project_ref:binding.actual_project_ref,source_scope:binding.source_scope,actual_source_project_ref:binding.actual_project_ref,intended_staging_project_ref:binding.intended_staging_project_ref,source_binding:binding,source_binding_sha256:sourceBindingHash(binding),source_sha:sourceSha,source_files:files,migration_manifest_sha256:hash(files.map(({file,sha256})=>({file,sha256}))),snapshot:context,configuration_safety,capability,source_history:sourceHistory,catalog,supplemental_catalog:supplemental,extension_object_classes:classes,object_classes,data,sequences,large_objects,native_guard,dataset_inventory:inventory,query_journal:journal,
   logical_capture_metadata_complete:true,migration_source_provenance:{status:sourceHistory.original_source_bytes_proven?'PROVEN':'GAP',gaps:sourceHistory.provenance_gaps},migration_ready:false,hosted_source_verified:binding.source_scope==='HOSTED_VERIFY_FULL',
   source_profile:{frozen_driver_sha256:FROZEN_DRIVER_SHA256,capability_source_sha256:CAPABILITY_SOURCE_SHA256,inventory_source_sha256:INVENTORY_SOURCE_SHA256,pinned_restore_image:PROVEN_IMAGE,catalog_families:28,supplemental_families:Object.keys(supplemental).length,dataset_count:DATASETS.length,key_dependent_dataset_count:7,key_family_count:2},
   proof_limits:{database_dump_captured:false,globals_dump_captured:false,restore_executed:false,migration_authorized:false,local_owned_clone_inspection_by_collector:false,database_mutations:false,role_passwords_collected:false,provider_root_keys_collected:false,storage_bytes_collected:false,provider_services_verified:false,all_database_object_classes_claim:false,authenticated_native_readback_verified:false,sequence_mvcc_snapshot:false,global_catalog_mvcc_snapshot:false,full_provider_restore_claim:false,v1_accepted:false,production_enabled:false}});
 }catch(error){throw error instanceof CollectorError?error:new CollectorError('CAPTURE_COLLECTOR_UNAVAILABLE');}
}

// Operational entry: target/transport authority is read ONLY from the concrete
// bridge owner's private registry. Caller fields/options never supply binding.
const BRIDGE_OWNER_MODULE=new URL('./staging-session-bridge.mjs',import.meta.url).href;
const collectedReceipts=new WeakMap();
function remember(metadata,bridge,options,binding,reader,kind){
 collectedReceipts.set(metadata,{bridge,options,binding,reader,kind,used:false});return metadata;
}
function optionsSnapshot(options){
 const opt=exact(options,['source_sha','migration_files'],'CAPTURE_TRUSTED_SOURCE_REQUIRED');
 requireValue(typeof opt.source_sha==='string'&&/^[0-9a-f]{40}$/.test(opt.source_sha),'CAPTURE_TRUSTED_SOURCE_REQUIRED');
 const files=sourceFiles(opt.migration_files);
 return frozen({source_sha:opt.source_sha,migration_files:files.map(({file,sha256})=>({file,sha256}))});
}
export async function collectSnapshot(bridge,options){
 try{
  const opt=optionsSnapshot(options);
  let reader;try{const owner=await import(BRIDGE_OWNER_MODULE);requireValue(typeof owner.sourceBindingForCollector==='function','CAPTURE_SOURCE_OWNER_UNAVAILABLE');reader=owner.sourceBindingForCollector;}catch{throw new CollectorError('CAPTURE_SOURCE_OWNER_UNAVAILABLE');}
  let binding;try{binding=sourceBindingSnapshot(reader(bridge));}catch{throw new CollectorError('CAPTURE_SOURCE_BINDING_UNAVAILABLE');}
  requireValue(['HOSTED_VERIFY_FULL','LOCAL_OWNED_CLONE'].includes(binding.source_scope),'CAPTURE_OPERATIONAL_SOURCE_REQUIRED');
  const boundReader=()=>reader(bridge);
  return remember(await collectBoundSnapshot(bridge,opt,binding,boundReader),bridge,opt,binding,boundReader,'operational');
 }catch(error){throw error instanceof CollectorError?error:new CollectorError('CAPTURE_COLLECTOR_UNAVAILABLE');}
}
// Explicitly synthetic front door: useful for core/parser/fault tests, never
// labelled as a project connection or an actual owned-clone observation.
export async function collectSyntheticSnapshot(bridge,options,syntheticSource={}){
 try{
  const opt=optionsSnapshot(options);
  // A reader injection is allowed ONLY on this explicitly synthetic endpoint.
  // It can exercise lifecycle changes, never confer hosted/local authority.
  const configured=exact(syntheticSource,Reflect.ownKeys(syntheticSource).length===0?[]:['sourceBindingReader'],'CAPTURE_SYNTHETIC_SOURCE_REQUIRED');
  const reader=configured.sourceBindingReader??syntheticBinding;
  requireValue(typeof reader==='function','CAPTURE_SYNTHETIC_SOURCE_REQUIRED');
  const binding=sourceBindingSnapshot(reader());
  requireValue(binding.source_scope==='SYNTHETIC_TEST_ONLY','CAPTURE_SYNTHETIC_SOURCE_REQUIRED');
  return remember(await collectBoundSnapshot(bridge,opt,binding,reader),bridge,opt,binding,reader,'synthetic');
 }catch(error){throw error instanceof CollectorError?error:new CollectorError('CAPTURE_COLLECTOR_UNAVAILABLE');}
}

async function recheckFresh(bridge,original,kind){
 const receipt=original&&typeof original==='object'?collectedReceipts.get(original):null;
 requireValue(receipt&&receipt.bridge===bridge&&receipt.kind===kind,'ORIGINAL_COLLECTED_RECEIPT_REQUIRED');
 requireValue(receipt.used===false,'ORIGINAL_COLLECTED_RECEIPT_CONSUMED');receipt.used=true;
 let primary=null,result;const transition={fresh_attempted:false};
 try{
  requireValue(sourceBindingHash(sourceBindingSnapshot(receipt.reader()))===sourceBindingHash(receipt.binding),'FRESH_SOURCE_BINDING_CHANGED');
  requireValue(['endCapture','endFreshRead'].every(name=>typeof bridge[name]==='function'),'FRESH_BRIDGE_OPERATIONS_REQUIRED');
  const ended=exact(await bridge.endCapture(),['snapshot_transaction_ended','exclusive_session_lock_retained'],'ORIGINAL_SNAPSHOT_END_UNVERIFIED');
  requireValue(Object.values(ended).every(v=>v===true),'ORIGINAL_SNAPSHOT_END_UNVERIFIED');
  const fresh=await collectBoundSnapshot(bridge,receipt.options,receipt.binding,receipt.reader,original,transition);
  const families=Object.keys(original).filter(name=>name!=='snapshot');
  requireValue(JSON.stringify(Object.keys(original).sort())===JSON.stringify(Object.keys(fresh).sort()),'FRESH_COMPARISON_COVERAGE_UNKNOWN');
  const comparison=families.map(family=>({family,equal:hash(original[family])===hash(fresh[family])}));
  result={format:'cluvo-private-fresh-recheck',status:comparison.every(row=>row.equal)?'SOURCE_UNCHANGED':'DRIFT_DETECTED',
   same_bridge_instance:true,source_scope:receipt.binding.source_scope,comparison,fresh_metadata:fresh,
   migration_ready:false,apply_authorized:false};
 }catch(error){primary=error instanceof CollectorError?error:new CollectorError('FRESH_RECHECK_UNAVAILABLE');}
 // endFreshRead itself proves phase, idle transaction state and retained lock.
 // Failure to enter/finish fresh read also fails closed; no apply operation exists.
 if(transition.fresh_attempted)try{
  const ended=exact(await bridge.endFreshRead(),['fresh_read_transaction_ended','exclusive_session_lock_retained'],'FRESH_TRANSACTION_END_UNVERIFIED');
  requireValue(Object.values(ended).every(v=>v===true),'FRESH_TRANSACTION_END_UNVERIFIED');
 }catch{throw new CollectorError('FRESH_TRANSACTION_END_UNPROVED');}
 if(primary)throw primary;
 try{requireValue(sourceBindingHash(sourceBindingSnapshot(receipt.reader()))===sourceBindingHash(receipt.binding),'FRESH_SOURCE_BINDING_CHANGED');}
 catch(error){throw error instanceof CollectorError?error:new CollectorError('FRESH_SOURCE_BINDING_UNAVAILABLE');}
 return frozen({...result,fresh_transaction_ended:true,exclusive_session_lock_retained:true});
}
export async function recheckFreshSnapshot(bridge,original){return await recheckFresh(bridge,original,'operational');}
export async function recheckSyntheticFreshSnapshot(bridge,original){return await recheckFresh(bridge,original,'synthetic');}
