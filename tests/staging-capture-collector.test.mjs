import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectSyntheticSnapshot as collectSnapshot,recheckSyntheticFreshSnapshot,recheckFreshSnapshot,CollectorError,snapshotBoundQuery} from '../scripts/staging-capture-collector.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
import {verifyImmutable16} from '../scripts/staging-capture-source.mjs';
import {syntheticBinding,IMAGE,SOCKET,PROJECT} from '../scripts/staging-capture-binding.mjs';
import {CAPABILITY_COUNTERS,CAPABILITY_FLAGS} from '../scripts/staging-capture-capability-contract.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const context={backend_pid:101,backend_start:'2026-10-07T10:00:00+00:00',database:'postgres',primary:true,exported_snapshot:'00000001-00000002-1',visibility_snapshot:'100:101:'};
const capability={...Object.fromEntries(CAPABILITY_COUNTERS.map(k=>[k,0])),...Object.fromEntries(CAPABILITY_FLAGS.map(k=>[k,true])),server_version:170011,primary:true,readonly:true,repeatable_read:true,current_role_postgres:true,role_superuser:false,role_bypassrls:false,user_data_relations:1,table_select_denied:0,schema_usage_denied:0,table_rls_filtered:0,sequence_select_denied:0,large_object_acl_denied:0,foreign_tables:0,custom_tablespaces:0,filtered_extension_config_relations:0,private_role_settings_catalog_readable:true,membership_catalog_readable:true,parameter_acl_catalog_readable:true,security_label_catalog_readable:true,private_extension_versions:[{name:'plpgsql',version:'1.0'}],installed_extensions:1,unregistered_extension_relations:0,private_extension_relations:[],sequences:1,large_objects:0};
const datasets={namespaces:['auth'],role_security:{superuser:false,bypass_rls:false},relations:[{schema_name:'auth',table_name:'users',kind:'r',count_readable:true,rls_enabled:false,force_rls:false,owner_matches_current:false,row_security_active:false,columns:[{name:'encrypted_password',type:'text'}]}],tce_labels:[]};
const options=()=>({source_sha:'1'.repeat(40),migration_files:clone(IMMUTABLE16)});
function fake(overrides={}){
 const calls=[],seenSql=[];let lockCalls=0,current={...context};
 const response=id=>{
  if(id==='configuration_safety')return{secret_named_settings:0,unknown_named_settings:0,subscriptions:0,foreign_servers:0,foreign_user_mappings:0,custom_tablespaces:0};
  if(id==='capabilities')return clone(capability);
  if(id==='source_layout')return{schemas:[],app_objects:0,history_present:true};
  if(id==='source_history')return[];
  if(id==='dataset_catalog')return clone(datasets);
  if(id==='dataset.auth_password_envelopes')return{id:'auth_password_envelopes',count:0,valid_envelope_count:0,legacy_count:0,nonempty_count:0,row_count:0};
  if(id.startsWith('dataset.'))return{id:id.slice(8),count:0,valid_envelope_count:0,legacy_count:0,nonempty_count:0,row_count:0};
  if(id==='extension_object_classes')return[{class:'pg_language',extension:'plpgsql',objects:1}];
  if(id==='object_classes')return[{class:'pg_class',objects:1}];
  if(id==='catalog.sequences')return[{schema:'public',name:'synthetic_seq',type:'bigint',start:1,increment:1,max:'9223372036854775807',min:1,cache:1,cycle:false}];
  if(id==='catalog.relations')return[{schema:'public',name:'synthetic_rows',kind:'r'}];
  if(id.startsWith('catalog.')||id.startsWith('supplemental.'))return[];
  if(id==='data_relations')return[{schema:'public',name:'synthetic_rows',kind:'r',persistence:'p',schema_readable:true,readable:true,full_visibility:true}];
  if(id==='data.0')return{rows:3,sha256:'5'.repeat(64)};
  if(id==='data.1')return{rows:0,sha256:'6'.repeat(64)};
  if(id==='sequence.0')return{last_value:'9223372036854775807',is_called:true};
  if(id==='large_objects')return[];
  if(id==='native_guard')return{owner_present:false,owner_restricted:false,guard_present:false,current_actor_present:false,users_policy:false,sessions_policy:false};
  throw new Error('UNEXPECTED_FAKE_QUERY');
 };
 return{calls,seenSql,get lockCalls(){return lockCalls;},
  async beginCapture(){return clone(current);},
  async checkLock(){lockCalls++;return{backend_pid:current.backend_pid,backend_start:current.backend_start,exclusive_lock:true,read_only:true,isolation:'repeatable read',visibility_snapshot:current.visibility_snapshot,...overrides.lock};},
  async endCapture(){return{snapshot_transaction_ended:true,exclusive_session_lock_retained:true};},
  async beginFreshRead(){current={backend_pid:context.backend_pid,backend_start:context.backend_start,database:'postgres',primary:true,visibility_snapshot:'200:201:',phase:'fresh_read',...overrides.fresh};return clone(current);},
  async freshReadQuery(sql){return await this.captureQuery(sql);},
  async endFreshRead(){return{fresh_read_transaction_ended:true,exclusive_session_lock_retained:true};},
  async captureQuery(sql){const id=sql.match(/cluvo_capture_id:([a-z0-9_.-]+)/)?.[1];assert.ok(id);calls.push(id);seenSql.push(sql);let data=response(id);if(overrides.payload)data=overrides.payload(id,data);const body={backend_pid:current.backend_pid,backend_start:current.backend_start,visibility_snapshot:current.visibility_snapshot,database:'postgres',primary:true,read_only:true,isolation:'repeatable read',payload:data,...overrides.binding};let result=[{command:'SELECT 1',rows:[[JSON.stringify(body)]]}];if(overrides.result)result=overrides.result(id,result);return result;}
 };
}
const fails=async(bridge,code)=>{await assert.rejects(collectSnapshot(bridge,options()),error=>error instanceof CollectorError&&error.message===code&&error.code===code);};
test('real immutable16 public source byte hashes remain exact',async()=>{assert.equal((await verifyImmutable16()).length,16);});
test('verifier component detects real-byte mutation using an injected reader without canonical writes',async()=>{let reads=0;await assert.rejects(verifyImmutable16({read:async path=>{reads++;assert.ok(path.pathname.endsWith(IMMUTABLE16[0].file));return Buffer.from('synthetic altered public SQL bytes');}}),error=>error.message==='IMMUTABLE16_SOURCE_BYTES_CHANGED');assert.equal(reads,1);});
test('private stage0 synthetic collector traverses28families+19supplements and11datasets without fake acceptance',async()=>{const b=fake(),r=await collectSnapshot(b,options());assert.equal(r.source_profile.catalog_families,28);assert.equal(r.source_profile.supplemental_families,19);assert.equal(r.dataset_inventory.datasets.length,11);assert.equal(r.source_profile.key_dependent_dataset_count,7);assert.equal(r.dataset_inventory.key_family_count,2);assert.equal(r.dataset_inventory.count_snapshot_consistent,true);assert.equal(r.source_history.stage,'stage0');assert.equal(r.migration_source_provenance.status,'PROVEN');assert.equal(r.migration_ready,false);assert.equal(r.hosted_source_verified,false);assert.equal(r.proof_limits.restore_executed,false);assert.equal(r.proof_limits.all_database_object_classes_claim,false);assert.equal(r.sequences[0].last_value,'9223372036854775807');assert.equal(b.lockCalls,3);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.catalog));assert.ok(!JSON.stringify(r.data).includes('synthetic-database-only'));assert.equal(b.calls.filter(id=>id.startsWith('catalog.')).length,28);});
test('each query is own backend/visibility/readOnly-bound, not merely initial check',async()=>{const b=fake({binding:{backend_pid:102}});await fails(b,'CAPTURE_QUERY_SNAPSHOT_CHANGED');assert.deepEqual(b.calls,['configuration_safety']);});
test('visibility drift rejects before catalog/dump values',async()=>{await fails(fake({binding:{visibility_snapshot:'102:103:'}}),'CAPTURE_QUERY_SNAPSHOT_CHANGED');});
test('backend_start drift rejects PID reuse',async()=>{await fails(fake({binding:{backend_start:'2026-10-07T11:00:00+00:00'}}),'CAPTURE_QUERY_SNAPSHOT_CHANGED');});
test('lock loss stays concrete',async()=>{const b=fake({lock:{exclusive_lock:false}});await fails(b,'CAPTURE_LOCK_OR_SNAPSHOT_LOST');assert.equal(b.calls.length,0);});
test('UTF8JSON null, multicolumn, multiresult and wrong command are rejected',async()=>{for(const result of [[{command:'SELECT 1',rows:[[null]]}],[{command:'SELECT 1',rows:[['{}','{}']]}],[{command:'SELECT 1',rows:[['{}']]},{command:'SELECT 1',rows:[['{}']]}],[{command:'UPDATE 1',rows:[['{}']]}]])await fails(fake({result:()=>result}),'CAPTURE_RESULT_SHAPE_UNKNOWN');});
test('secret setting names stop before role catalog or arbitrary values',async()=>{const b=fake({payload:(id,r)=>id==='configuration_safety'?{...r,secret_named_settings:1}:r});await fails(b,'CAPTURE_SECRET_CONFIGURATION_PRESENT');assert.deepEqual(b.calls,['configuration_safety']);});
test('unknown custom settings cannot be guessed nonsecret',async()=>{await fails(fake({payload:(id,r)=>id==='configuration_safety'?{...r,unknown_named_settings:1}:r}),'CAPTURE_UNKNOWN_CONFIGURATION_PRESENT');});
test('subscriptions/foreign mappings/tablespaces stop before catalog',async()=>{for(const [field,code]of [['subscriptions','CAPTURE_SUBSCRIPTIONS_NONPORTABLE'],['foreign_servers','CAPTURE_FOREIGN_SERVER_NONPORTABLE'],['foreign_user_mappings','CAPTURE_FOREIGN_USER_MAPPING_NONPORTABLE'],['custom_tablespaces','CAPTURE_TABLESPACE_NONPORTABLE']]){const b=fake({payload:(id,r)=>id==='configuration_safety'?{...r,[field]:1}:r});await fails(b,code);assert.deepEqual(b.calls,['configuration_safety']);}});
test('RLS-filtered logical data is never accepted as complete',async()=>{await fails(fake({payload:(id,r)=>id==='capabilities'?{...r,table_rls_filtered:1}:r}),'CAPTURE_DATA_RLS_FILTERED');});
test('unknown extension package is not a pinned compatibility assertion',async()=>{await fails(fake({payload:(id,r)=>id==='capabilities'?{...r,private_extension_versions:[{name:'unknown_extension',version:'1.0'}]}:r}),'CAPTURE_EXTENSION_PACKAGE_UNPROVED');});
test('snapshot-bound Auth unknown format stays UNKNOWN',async()=>{await fails(fake({payload:(id,r)=>id==='dataset.auth_password_envelopes'?{...r,count:1,valid_envelope_count:0,nonempty_count:1,row_count:1}:r}),'AUTH_ENVELOPE_FORMAT_UNKNOWN');});
test('present provider crypto blocks without requesting its key or values',async()=>{const b=fake({payload:(id,r)=>id==='dataset.auth_password_envelopes'?{...r,count:1,valid_envelope_count:1,nonempty_count:1,row_count:1}:r});await fails(b,'CAPTURE_PROVIDER_CRYPTOGRAPHIC_DATA_NONPORTABLE');assert.equal(b.calls.some(id=>id.startsWith('catalog.')),false);});
test('dataset role profile disagreement is not snapshot-consistency proof',async()=>{await fails(fake({payload:(id,r)=>id==='dataset_catalog'?{...r,role_security:{superuser:true,bypass_rls:false}}:r}),'CAPTURE_DATASET_ROLE_PROFILE_CHANGED');});
test('stage0 with app/API/internal schema is rejected',async()=>{await fails(fake({payload:(id,r)=>id==='source_layout'?{...r,schemas:['internal']}:r}),'CAPTURE_STAGE0_HAS_APPLICATION_STATE');});
test('foreign/non-prefix migration history cannot be labelled stage0',async()=>{const row={version:'20200101000000',name:'foreign',statement_count:1,single_statement_sha256:'6'.repeat(64),row_sha256:'7'.repeat(64)};await fails(fake({payload:(id,r)=>id==='source_history'?[row]:r}),'CAPTURE_HISTORY_NOT_IMMUTABLE_PREFIX');});
test('split archived SQL emits concrete original-byte provenance gap, no release authority',async()=>{const f=IMMUTABLE16[0],name=f.file.slice(15,-4),row={version:f.file.slice(0,14),name,statement_count:2,single_statement_sha256:null,row_sha256:'7'.repeat(64)};const r=await collectSnapshot(fake({payload:(id,r)=>id==='source_layout'?{...r,schemas:['api','app','internal'],app_objects:1}:id==='source_history'?[row]:r}),options());assert.equal(r.migration_source_provenance.status,'GAP');assert.equal(r.migration_ready,false);assert.equal(r.hosted_source_verified,false);assert.equal(r.source_history.original_source_bytes_proven,false);assert.equal(r.migration_source_provenance.gaps[0].code,'APPLIED_SOURCE_BYTES_PROVENANCE_MISSING');assert.equal(Object.hasOwn(r.source_history.ordered_private_history[0],'statements'),false);});
test('archived whole SQL hash matches exact source file, a provenance fact only',async()=>{const f=IMMUTABLE16[0],row={version:f.file.slice(0,14),name:f.file.slice(15,-4),statement_count:1,single_statement_sha256:f.sha256,row_sha256:'7'.repeat(64)};const r=await collectSnapshot(fake({payload:(id,r)=>id==='source_layout'?{...r,schemas:['api','app','internal'],app_objects:1}:id==='source_history'?[row]:r}),options());assert.equal(r.migration_source_provenance.status,'PROVEN');assert.equal(r.migration_ready,false);assert.equal(r.hosted_source_verified,false);assert.equal(r.source_history.original_source_bytes_proven,true);});
test('unknown extension object class is not silently filtered',async()=>{await fails(fake({payload:(id,r)=>id==='extension_object_classes'?[{class:'pg_future_class',extension:'plpgsql',objects:1}]:r}),'CAPTURE_OBJECT_CLASS_UNREPRESENTED');});
test('unknown non-extension object class is not silently filtered',async()=>{await fails(fake({payload:(id,r)=>id==='object_classes'?[{class:'pg_future_class',objects:1}]:r}),'CAPTURE_OBJECT_CLASS_UNREPRESENTED');});
test('data physical table projection checks visibility and reports only count/hash',async()=>{await fails(fake({payload:(id,r)=>id==='data_relations'?r.map(x=>({...x,full_visibility:false})):r}),'CAPTURE_DATA_READ_SCOPE_UNKNOWN');const b=fake();await collectSnapshot(b,options());const sql=b.seenSql[b.calls.indexOf('data.0')];assert.ok(sql.includes('FROM ONLY "public"."synthetic_rows" t'));assert.ok(sql.includes("'rows',count(*)"));assert.ok(!sql.includes('jsonb_agg(to_jsonb(t))'));});
test('zero-memory-source mutation after await does not rewrite trusted16/sourceSHA',async()=>{const o=options(),b=fake(),pending=collectSnapshot(b,o);o.source_sha='9'.repeat(40);o.migration_files[0].sha256='8'.repeat(64);const r=await pending;assert.equal(r.source_sha,'1'.repeat(40));assert.equal(r.source_files[0].sha256,IMMUTABLE16[0].sha256);});
test('server SQL errors stay fixed and no raw provider error is forwarded',async()=>{const b=fake();b.captureQuery=async()=>{throw new Error('RAW_PRIVATE_PROVIDER_ERROR');};await fails(b,'CAPTURE_QUERY_UNAVAILABLE');});
test('source SQL wrapper is single JSON statement and never starts a new snapshot',()=>{const sql=snapshotBoundQuery('SELECT jsonb_build_object(\'rows\',count(*)) FROM "public"."x";','data.0');assert.ok(sql.startsWith('SELECT jsonb_build_object'));assert.ok(!/\b(BEGIN|COMMIT|ROLLBACK|pg_export_snapshot)\b/.test(sql));assert.equal(hash(Buffer.from(sql)).length,64);});
test('backend_start binding uses the same SQL text representation as the libpq bridge',()=>{const sql=snapshotBoundQuery('SELECT 1','source_layout');assert.ok(sql.includes('SELECT backend_start::text FROM pg_stat_activity'));assert.ok(Number.isFinite(Date.parse('2026-10-07 10:00:00.123+00')));});
test('Storage metadata presence requires bytes backup instead of a false logical-only success',async()=>{await fails(fake({payload:(id,r)=>id==='dataset_catalog'?{...r,namespaces:[...r.namespaces,'storage'],relations:[...r.relations,{...r.relations[0],schema_name:'storage',table_name:'objects',columns:[]}]}:id==='dataset.storage_objects'?{...r,count:1,nonempty_count:1,row_count:1}:r}),'CAPTURE_STORAGE_BINARIES_REQUIRED');});
test('pgsodium key-definition rows with NULL raw_key are still nonportable',async()=>{await fails(fake({payload:(id,r)=>id==='dataset_catalog'?{...r,namespaces:[...r.namespaces,'pgsodium'],relations:[...r.relations,{...r.relations[0],schema_name:'pgsodium',table_name:'key',columns:[{name:'raw_key',type:'bytea'}]}]}:id==='dataset.pgsodium_keys'?{...r,row_count:1}:r}),'CAPTURE_PROVIDER_CRYPTOGRAPHIC_DATA_NONPORTABLE');});
test('nonempty unregistered extension table is concrete dump coverage blocker',async()=>{await fails(fake({payload:(id,r)=>id==='capabilities'?{...r,unregistered_extension_relations:1,private_extension_relations:[{schema:'public',name:'synthetic_rows',kind:'r',readable:true,rls_visible:true}]}:r}),'CAPTURE_UNREGISTERED_EXTENSION_DATA_NONPORTABLE');});
test('materialized view bytes are hashed without ONLY and without exporting raw rows',async()=>{const r={schema:'public',name:'synthetic_mv',kind:'m'};const b=fake({payload:(id,v)=>id==='capabilities'?{...v,user_data_relations:2}:id==='catalog.relations'?[...v,r]:id==='data_relations'?[...v,{...r,persistence:'p',schema_readable:true,readable:true,full_visibility:true}]:v});const result=await collectSnapshot(b,options());assert.equal(result.data.length,2);const sql=b.seenSql.find(v=>v.includes('FROM "public"."synthetic_mv" t'));assert.ok(sql&&!sql.includes('FROM ONLY'));assert.ok(result.data.every(row=>Object.keys(row).sort().join(',')==='kind,relation,rows,schema,sha256'));});
test('private role grantor/options/defaultACL metadata is retained exactly',async()=>{const membership={role:'synthetic_parent',member:'synthetic_role',grantor:'synthetic_grantor',admin:true,inherit:false,can_set:true},acl={owner:'synthetic_owner',schema:'public',kind:'r',acl:[['synthetic_grantor','synthetic_role','SELECT',true]]};const result=await collectSnapshot(fake({payload:(id,r)=>id==='catalog.role_memberships'?[membership]:id==='catalog.default_acls'?[acl]:r}),options());assert.deepEqual(result.catalog.role_memberships[0],membership);assert.deepEqual(result.catalog.default_acls[0],acl);});
test('catalogue table absent from hashed data is never silently omitted',async()=>{await fails(fake({payload:(id,r)=>id==='data_relations'?[]:r}),'CAPTURE_DATA_RELATION_COVERAGE_UNKNOWN');});
test('nonregular source16 hash forgery stops before beginCapture',async()=>{let begun=0;const b=fake(),o=options();b.beginCapture=async()=>{begun++;return clone(context);};o.migration_files[0].sha256='9'.repeat(64);await assert.rejects(collectSnapshot(b,o),e=>e.code==='IMMUTABLE16_SOURCE_UNKNOWN');assert.equal(begun,0);});

const localShapeOnly=()=>({schema_version:1,source_scope:'LOCAL_OWNED_CLONE',actual_project_ref:null,intended_staging_project_ref:PROJECT,environment:'local',owned_clone:{container_id:'3'.repeat(64),image_digest:IMAGE,daemon_socket:SOCKET,proof_binding_sha256:'4'.repeat(64)},transport:{client_tls:false,postgres_version:170011,libpq_version:170011}});
test('synthetic source endpoint never emits a hosted project or migration authorization',async()=>{const r=await collectSnapshot(fake(),options());assert.equal(r.source_scope,'SYNTHETIC_TEST_ONLY');assert.equal(r.project_ref,null);assert.equal(r.actual_source_project_ref,null);assert.equal(r.environment,'synthetic');assert.equal(r.intended_staging_project_ref,PROJECT);assert.equal(r.hosted_source_verified,false);assert.equal(r.migration_ready,false);assert.equal(r.proof_limits.migration_authorized,false);assert.equal(r.source_binding_sha256,hash(Buffer.from(JSON.stringify(r.source_binding))));});
test('actual collector lifecycle rejects a valid-shaped source binding changed during query awaits',async()=>{let changed=false;const b=fake({payload:(id,r)=>{if(id==='native_guard')changed=true;return r;}});await assert.rejects(collectSnapshot(b,options(),{sourceBindingReader:()=>changed?localShapeOnly():syntheticBinding()}),e=>e.code==='CAPTURE_SOURCE_BINDING_CHANGED');assert.ok(b.calls.includes('native_guard'));});
test('a reader failing after initial binding never yields successful metadata',async()=>{let reads=0;await assert.rejects(collectSnapshot(fake(),options(),{sourceBindingReader:()=>{if(reads++>0)throw Error('RAW_SYNTHETIC_READER_FAILURE');return syntheticBinding();}}),e=>e.code==='CAPTURE_SOURCE_BINDING_UNAVAILABLE'&&!e.message.includes('RAW'));assert.equal(reads,2);});
test('synthetic reader injection cannot start a locally labelled operational capture',async()=>{const b=fake();let begun=0;b.beginCapture=async()=>{begun++;return clone(context);};await assert.rejects(collectSnapshot(b,options(),{sourceBindingReader:localShapeOnly}),e=>e.code==='CAPTURE_SYNTHETIC_SOURCE_REQUIRED');assert.equal(begun,0);assert.equal(b.calls.length,0);});

import {SUPPLEMENTAL_QUERIES as fixed} from '../scripts/staging-capture-queries.mjs';
test('dictionary metadata uses distinct dictionary and dependency aliases',()=>{
 assert.equal(Object.keys(fixed).length,19);assert.match(fixed.text_search_dictionaries,/FROM pg_ts_dict dictionary /);
 assert.match(fixed.text_search_dictionaries,/FROM pg_depend d WHERE d.classid='pg_ts_dict'::regclass AND d.objid=dictionary.oid/);
 assert.doesNotMatch(fixed.text_search_dictionaries,/d.objid=d.oid/);assert.match(fixed.text_search_dictionaries,/dictionary.dictinitoption options/);
});

test('fresh read compares all registered metadata families on the same synthetic bridge and retains scoped limits',async()=>{
 const b=fake(),original=await collectSnapshot(b,options()),r=await recheckSyntheticFreshSnapshot(b,original);
 assert.equal(r.status,'SOURCE_UNCHANGED');assert.equal(r.fresh_transaction_ended,true);assert.equal(r.exclusive_session_lock_retained,true);
 assert.equal(r.apply_authorized,false);assert.equal(r.migration_ready,false);assert.equal(r.source_scope,'SYNTHETIC_TEST_ONLY');
 assert.equal(r.fresh_metadata.snapshot.backend_pid,original.snapshot.backend_pid);
 assert.notEqual(r.fresh_metadata.snapshot.visibility_snapshot,original.snapshot.visibility_snapshot);
 assert.ok(r.comparison.some(row=>row.family==='catalog')&&r.comparison.some(row=>row.family==='supplemental_catalog'));
});

test('copied JSON, other bridge and cross-scope receipts cannot trigger a fresh query',async()=>{
 const b=fake(),original=await collectSnapshot(b,options());
 for(const [selected,receipt]of [[b,clone(original)],[fake(),original],[b,{}]]){
  await assert.rejects(recheckSyntheticFreshSnapshot(selected,receipt),e=>e.code==='ORIGINAL_COLLECTED_RECEIPT_REQUIRED');
 }
 await assert.rejects(recheckFreshSnapshot(b,original),e=>e.code==='ORIGINAL_COLLECTED_RECEIPT_REQUIRED');
 assert.equal(b.calls.filter(id=>id==='configuration_safety').length,1);
});

test('fresh receipt is consumed exactly once even if source drift is found',async()=>{
 let changed=false;const b=fake({payload:(id,value)=>changed&&id==='sequence.0'?{...value,last_value:'2'}:value});
 const original=await collectSnapshot(b,options());changed=true;
 const r=await recheckSyntheticFreshSnapshot(b,original);assert.equal(r.status,'DRIFT_DETECTED');
 assert.equal(r.comparison.find(row=>row.family==='sequences').equal,false);assert.equal(r.apply_authorized,false);
 await assert.rejects(recheckSyntheticFreshSnapshot(b,original),e=>e.code==='ORIGINAL_COLLECTED_RECEIPT_CONSUMED');
});

test('fresh database rows, role membership, supplemental definitions and history drift all refuse equality',async()=>{
 for(const [id,next]of [['data.0',{rows:4,sha256:'a'.repeat(64)}],
  ['catalog.role_memberships',[{role:'synthetic_changed'}]],['supplemental.languages',[{name:'synthetic_changed'}]],
  ['source_history',[{version:IMMUTABLE16[0].file.slice(0,14),name:IMMUTABLE16[0].file.slice(15,-4),statement_count:1,single_statement_sha256:IMMUTABLE16[0].sha256,row_sha256:'a'.repeat(64)}]]]){
  let changed=false;const b=fake({payload:(query,value)=>changed&&query===id?next:value});const original=await collectSnapshot(b,options());changed=true;
  if(id==='source_history')await assert.rejects(recheckSyntheticFreshSnapshot(b,original),e=>e.code==='CAPTURE_APPLIED_PREFIX_SCHEMA_UNKNOWN');
  else assert.equal((await recheckSyntheticFreshSnapshot(b,original)).status,'DRIFT_DETECTED');
 }
});

test('fresh backend identity mismatch fails and closes its attempted fresh transaction',async()=>{
 const b=fake({fresh:{backend_pid:102}});let ended=0;b.endFreshRead=async()=>{ended++;return{fresh_read_transaction_ended:true,exclusive_session_lock_retained:true};};
 const original=await collectSnapshot(b,options());await assert.rejects(recheckSyntheticFreshSnapshot(b,original),e=>e.code==='FRESH_BACKEND_OR_CONTEXT_CHANGED');assert.equal(ended,1);
});

test('failure to end either transaction never yields a successful fresh result',async()=>{
 for(const phase of ['endCapture','endFreshRead']){
  const b=fake(),original=await collectSnapshot(b,options());b[phase]=async()=>{throw Error('SYNTHETIC_PRIVATE_CLOSE_BODY');};
  await assert.rejects(recheckSyntheticFreshSnapshot(b,original),e=>e instanceof CollectorError&&!e.message.includes('PRIVATE'));
  await assert.rejects(recheckSyntheticFreshSnapshot(b,original),e=>e.code==='ORIGINAL_COLLECTED_RECEIPT_CONSUMED');
 }
});
