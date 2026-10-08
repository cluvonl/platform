// Read-only hosted observation. No backup, restore, DDL, mail or action on import.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PrivateBridge,BridgeError} from './staging-session-bridge.mjs';
import {collectSnapshot,recheckFreshSnapshot,CollectorError} from './staging-capture-collector.mjs';
import {IMMUTABLE16} from './staging-migration-files.mjs';
import {validatedStagingContext} from './staging-session-probe.mjs';

const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const PROJECT='fbozlbgmktkgcdfqdaaz';
const LIMITS=Object.freeze({backup_created:false,restore_executed:false,snapshot_import_verified:false,
 migration_ready:false,remote_ddl_ready:false,database_mutations:false,email_sent:false,
 provider_services_verified:false,full_provider_restore_verified:false,sequence_mvcc_snapshot:false,
 global_catalog_mvcc_snapshot:false,v1_ready:false,production_enabled:false});
class CheckError extends Error{constructor(code){super(code);this.code=code;}}
const need=(value,code)=>{if(!value)throw new CheckError(code);};
const count=value=>Number.isSafeInteger(value)&&value>=0;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

// A public projection only. Private catalog names, definitions, role settings,
// per-table digests, backend IDs, snapshots, emails and identities stay private.
// This function cannot register a source or authorize a migration.
export function safeCaptureSummary(original,fresh){
 need(original?.source_scope==='HOSTED_VERIFY_FULL'&&original.project_ref===PROJECT
  &&original.logical_capture_metadata_complete===true&&original.hosted_source_verified===true
  &&fresh?.same_bridge_instance===true&&fresh.source_scope==='HOSTED_VERIFY_FULL'
  &&fresh.fresh_transaction_ended===true&&fresh.exclusive_session_lock_retained===true
  &&['SOURCE_UNCHANGED','DRIFT_DETECTED'].includes(fresh.status),'CAPTURE_REPORT_INVALID');
 need(original.source_profile?.catalog_families===28&&original.source_profile.supplemental_families===19
  &&Object.keys(original.catalog).length===28&&Object.keys(original.supplemental_catalog).length===19
  &&Array.isArray(original.data)&&original.data.every(row=>count(row.rows))
  &&Array.isArray(original.sequences)&&Array.isArray(original.large_objects)
  &&count(original.source_history?.applied_prefix)&&original.source_history.applied_prefix<=16
  &&original.dataset_inventory?.key_dependent_data==='proven_empty'
  &&original.dataset_inventory.count_snapshot_consistent===true
  &&original.dataset_inventory.storage_objects===0
  &&['PROVEN','GAP'].includes(original.migration_source_provenance?.status),'CAPTURE_REPORT_INVALID');
 const total=original.data.reduce((sum,row)=>sum+row.rows,0);need(count(total),'CAPTURE_REPORT_INVALID');
 const transport=original.source_binding?.transport;
 need(transport?.client_tls===true&&transport.client_certificate_verified===true
  &&transport.ssl_mode==='verify-full'&&['TLSv1.2','TLSv1.3'].includes(transport.client_tls_protocol)
  &&transport.postgres_version===170011&&count(transport.libpq_version)&&transport.libpq_version>0,'CAPTURE_REPORT_INVALID');
 return {source_scope:'HOSTED_VERIFY_FULL',catalog_families:28,supplemental_families:19,
  physical_data_relations:original.data.length,physical_rows:total,sequences:original.sequences.length,
  large_objects:original.large_objects.length,applied_prefix:original.source_history.applied_prefix,
  pending_migrations:16-original.source_history.applied_prefix,
  immutable_source_provenance:original.migration_source_provenance.status,
  known_key_dependencies:original.dataset_inventory.key_dependent_data,storage_objects:0,
  counts_in_exported_snapshot:true,fresh_source_status:fresh.status,same_session_fresh_read:true,
  exclusive_lock_retained_through_fresh_read:true,
  transport:{client_tls:true,client_tls_protocol:transport.client_tls_protocol,
   certificate_and_hostname_verified:true,postgres_version:170011,libpq_version:transport.libpq_version},
  ...LIMITS};
}

export async function stagingCaptureCheck(environment){
 const base={environment:'staging',project_ref:PROJECT,observed_at:new Date().toISOString(),
  measurement_only:true,private_values_exported:false,...LIMITS};
 let bridge=null,closed=false,primary=null,result=null,timer;
 const onSignal=()=>{primary='CAPTURE_INTERRUPTED';void bridge?.close().catch(()=>{});};
 try{
  let fixed;try{fixed=validatedStagingContext(environment);}catch{throw new CheckError('FIXED_STAGING_RELEASE_REQUIRED');}
  base.source_sha=fixed.RELEASE_SHA;
  base.migration_manifest_sha256=hash(JSON.stringify(IMMUTABLE16));
  const source=await readFile(new URL('./staging_session_bridge.py',import.meta.url));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,onSignal);
  bridge=await PrivateBridge.connect({...fixed,MIGRATION_SSL_ROOT_CERT_PATH:CA},hash(source));
  need(primary===null,'CAPTURE_INTERRUPTED');
  timer=setTimeout(()=>{primary='CAPTURE_DEADLINE_EXCEEDED';void bridge.close().catch(()=>{});},180_000);
  const original=await collectSnapshot(bridge,{source_sha:fixed.RELEASE_SHA,migration_files:IMMUTABLE16});
  const fresh=await recheckFreshSnapshot(bridge,original);
  await bridge.checkLock();result=safeCaptureSummary(original,fresh);
  if(fresh.status!=='SOURCE_UNCHANGED')primary='CAPTURE_SOURCE_DRIFT_DETECTED';
 }catch(error){
  primary??=error instanceof CheckError||error instanceof CollectorError||error instanceof BridgeError
   ?error.code:'CAPTURE_CHECK_UNAVAILABLE';
 }finally{
  clearTimeout(timer);for(const signal of ['SIGINT','SIGTERM'])process.removeListener(signal,onSignal);
  if(bridge){try{await bridge.close();closed=true;}catch{primary='CAPTURE_CONNECTION_CLOSE_UNPROVED';}}
 }
 return {...base,...(result??{}),passed:primary===null,returned_session_closed:closed,
  ...(primary?{error:primary}:{}),...LIMITS};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  const report=process.argv.length===2?await stagingCaptureCheck(process.env):{passed:false,error:'UNEXPECTED_ARGUMENTS',...LIMITS};
  await writeFile('staging-capture-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({result:report.passed?'SNAPSHOT_MEASUREMENT_PASS':'FAIL',
   ...(report.error?{error:report.error}:{}),...LIMITS}));process.exitCode=report.passed?0:1;
 }catch{console.log('STAGING_CAPTURE_CHECK_REPORT_UNAVAILABLE');process.exitCode=1;}
}
