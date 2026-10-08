import assert from 'node:assert/strict';
import test from 'node:test';
import {safeCaptureSummary,stagingCaptureCheck} from '../scripts/staging-capture-check.mjs';

function fixture(){
 const original={source_scope:'HOSTED_VERIFY_FULL',project_ref:'fbozlbgmktkgcdfqdaaz',
  logical_capture_metadata_complete:true,hosted_source_verified:true,
  source_profile:{catalog_families:28,supplemental_families:19},
  catalog:Object.fromEntries(Array.from({length:28},(_,i)=>['synthetic_catalog_'+i,[]])),
  supplemental_catalog:Object.fromEntries(Array.from({length:19},(_,i)=>['synthetic_supplement_'+i,[]])),
  data:[{schema:'SYNTHETIC_PRIVATE_SCHEMA',rows:3,sha256:'SYNTHETIC_PRIVATE_DIGEST'}],sequences:[],large_objects:[],
  source_history:{applied_prefix:0},dataset_inventory:{key_dependent_data:'proven_empty',count_snapshot_consistent:true,storage_objects:0},
  migration_source_provenance:{status:'PROVEN'},
  source_binding:{transport:{client_tls:true,client_certificate_verified:true,ssl_mode:'verify-full',client_tls_protocol:'TLSv1.3',postgres_version:170011,libpq_version:160015}},
  snapshot:{backend_pid:123,exported_snapshot:'SYNTHETIC_PRIVATE_SNAPSHOT'},private:'SYNTHETIC_PRIVATE_EMAIL',
 };
 const fresh={same_bridge_instance:true,source_scope:'HOSTED_VERIFY_FULL',fresh_transaction_ended:true,
  exclusive_session_lock_retained:true,status:'SOURCE_UNCHANGED',fresh_metadata:original};return{original,fresh};
}

test('public projection retains scoped counts without exporting private catalog, digest, email or session fields',()=>{
 const {original,fresh}=fixture(),result=safeCaptureSummary(original,fresh);
 assert.equal(result.physical_rows,3);assert.equal(result.pending_migrations,16);
 assert.equal(result.migration_ready,false);assert.equal(result.backup_created,false);assert.equal(result.restore_executed,false);
 assert.equal(result.sequence_mvcc_snapshot,false);assert.equal(result.global_catalog_mvcc_snapshot,false);
 assert.equal(JSON.stringify(result).includes('SYNTHETIC_PRIVATE'),false);assert.equal(Object.hasOwn(result,'snapshot'),false);
});

test('unknown, filtered, mismatched source or unclosed transaction measurements cannot produce public success counts',()=>{
 const changes=[({original})=>original.source_scope='SYNTHETIC_TEST_ONLY',
  ({original})=>original.dataset_inventory.count_snapshot_consistent=false,
  ({original})=>original.dataset_inventory.key_dependent_data='unknown',
  ({original})=>original.data[0].rows=null,({original})=>original.data[0].rows=-1,
  ({original})=>original.migration_source_provenance.status='SYNTHETIC_PRIVATE',
  ({original})=>original.source_binding.transport.ssl_mode='require',
  ({fresh})=>fresh.exclusive_session_lock_retained=false,({fresh})=>fresh.fresh_transaction_ended=false];
 for(const change of changes){const value=fixture();change(value);assert.throws(()=>safeCaptureSummary(value.original,value.fresh),/CAPTURE_REPORT_INVALID/);}
});

test('fresh source drift remains visible and never grants apply or restore authority',()=>{
 const {original,fresh}=fixture();fresh.status='DRIFT_DETECTED';
 const result=safeCaptureSummary(original,fresh);assert.equal(result.fresh_source_status,'DRIFT_DETECTED');
 assert.equal(result.remote_ddl_ready,false);assert.equal(result.full_provider_restore_verified,false);
});

test('foreign workflow contexts and environment getters fail without connecting or exposing supplied credentials',async()=>{
 let reads=0;const value={APP_ENV:'staging'};Object.defineProperty(value,'MIGRATION_DATABASE_URL',{get(){reads++;throw Error('SYNTHETIC_PRIVATE');}});
 for(const environment of [{},value,{APP_ENV:'production'},process.env]){
  const report=await stagingCaptureCheck(environment);
  assert.equal(report.passed,false);assert.equal(report.error,'FIXED_STAGING_RELEASE_REQUIRED');
  assert.equal(report.returned_session_closed,false);assert.equal(report.database_mutations,false);
  assert.equal(JSON.stringify(report).includes('SYNTHETIC_PRIVATE'),false);
 }
 assert.equal(reads,0);
});
