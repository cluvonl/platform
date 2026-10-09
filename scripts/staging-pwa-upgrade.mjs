// Additive staging PWA owner; no source changes to initial16 owner.
// All private buffers and provider catalogs stay
// in this process or authenticated encrypted custody; public JSON is projected.
import {createHash,randomBytes} from 'node:crypto';
import {readFile,writeFile,mkdtemp,chmod,rm,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {validatedStagingContext} from './staging-session-probe.mjs';
import {collectSnapshot,recheckFreshSnapshot,snapshotBoundQuery} from './staging-pwa-upgrade-collector.mjs';
import {UPGRADE_FILES} from './staging-pwa-upgrade-migrations.mjs';
import {createUpgradeMigrationManifest,validateUpgradeHistory} from './staging-pwa-upgrade-migrations.mjs';
import {capturePlan,captureWithOwnedWorker,probeOwnedPg17Toolchain} from './pg17-capture-worker.mjs';
import {packFiles,encryptCaptureFiles,decryptRestoreFiles} from './backup-artifact.mjs';
import {deriveInitialBackupKey,uploadEncryptedInitialBackup,INITIAL_BACKUP_KEY_PROFILE,BackupCustodyError} from './staging-pwa-upgrade-backup-custody.mjs';
import {restoreInitialBackup,InitialRestoreError,INITIAL_RESTORE_PHASES,INITIAL_RESTORE_REASONS,INITIAL_RESTORE_TOC_TYPES,INITIAL_RESTORE_ERROR_ORIGINS,INITIAL_RESTORE_ERROR_SOURCE_FILES,INITIAL_RESTORE_ERROR_TOPICS,INITIAL_RESTORE_SECTIONS} from './staging-pwa-upgrade-restore.mjs';
// Concrete write owner is separate from the existing read-only bridge.
import {PwaUpgradeSession,PWA_UPGRADE_SESSION_CHILD_SHA256} from './staging-pwa-upgrade-session.mjs';
import {publicCatalogDiagnostics} from './staging-catalog-diagnostic.mjs';
import {publicRestoreDefinitionDiagnostics,publicDeparseAlignment} from './staging-pwa-restore-diagnostic.mjs';

const PROJECT='fbozlbgmktkgcdfqdaaz';
const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const BUNDLE=fileURLToPath(new URL('../.cluvo-upload-artifact/dist/upload/index.js',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
class DriverError extends Error{constructor(code){super(code);this.code=code;}}
const need=(value,code)=>{if(!value)throw new DriverError(code);};
const SAFE_ERROR=/^[A-Z][A-Z0-9_]{1,79}$/;
const LIMITS={app_activation_performed:false,email_sent:false,authenticated_native_login_verified:false,
 provider_services_verified:false,full_provider_restore_verified:false,o08_restore_accepted:false,
 v1_ready:false,production_enabled:false};

async function privateDirectory(parent){
 const path=await mkdtemp(join(parent,'cluvo-pwa-upgrade-'));await chmod(path,0o700);return path;
}
async function bootstrapRoleFromSnapshot(bridge,original){
 const result=await bridge.captureQuery(snapshotBoundQuery("SELECT jsonb_build_object('name',rolname) FROM pg_roles WHERE oid=10",'initial.bootstrap_role'));
 need(Array.isArray(result)&&result.length===1&&result[0].command==='SELECT 1'&&result[0].rows?.length===1
  &&result[0].rows[0].length===1,'INITIAL_BOOTSTRAP_ROLE_UNAVAILABLE');
 const row=JSON.parse(result[0].rows[0][0]),snapshot=original.snapshot;
 need(row.backend_pid===snapshot.backend_pid&&row.backend_start===snapshot.backend_start
  &&row.visibility_snapshot===snapshot.visibility_snapshot&&row.database==='postgres'&&row.primary===true
  &&row.read_only===true&&row.isolation==='repeatable read'&&/^[a-z_][a-z0-9_]{0,62}$/.test(row.payload?.name??''),'INITIAL_BOOTSTRAP_ROLE_UNAVAILABLE');
 return row.payload.name;
}
async function privateCaptureFiles(directory){
 const files={};let maximum=64*1024*1024;
 for(const name of ['database.dump','globals.sql','manifest.private.json']){
  const info=await lstat(join(directory,name));need(info.isFile()&&!info.isSymbolicLink()&&info.uid===process.getuid()
   &&info.nlink===1&&(info.mode&0o777)===0o600&&info.size>0&&info.size<=maximum,'INITIAL_CAPTURE_FILE_INVALID');
  files[name]=await readFile(join(directory,name));maximum-=files[name].length;
 }
 return files;
}

export async function stagingPwaUpgrade(environment){
 const report={environment:'staging',project_ref:PROJECT,observed_at:new Date().toISOString(),
  passed:false,database_mutations_performed:false,applied_migrations:0,private_values_exported:false,...LIMITS};
 let bridge,key,privateRoot,encryptedRoot,primary,timer,closed=false;
 const interrupted=()=>{primary??='INITIAL_MIGRATION_INTERRUPTED';void bridge?.close().catch(()=>{});};
 try{
  const fixed=validatedStagingContext(environment);
  need(['true','false'].includes(environment.PWA_UPGRADE_APPLY_MIGRATIONS),'INITIAL_EXECUTION_MODE_REQUIRED');
  const apply=environment.PWA_UPGRADE_APPLY_MIGRATIONS==='true';report.execution_mode=apply?'APPLY':'RESTORE_ONLY';
  need(/^[1-9][0-9]{0,19}$/.test(environment.GITHUB_RUN_ID??'')&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(environment.GITHUB_ACTOR??''),'INITIAL_WORKFLOW_ACTOR_REQUIRED');
  report.source_sha=fixed.RELEASE_SHA;report.workflow_run_id=environment.GITHUB_RUN_ID;
  const sources=await Promise.all(UPGRADE_FILES.map(async item=>({file:item.file,bytes:await readFile(new URL('../supabase/migrations/'+item.file,import.meta.url))})));
  const manifest=createUpgradeMigrationManifest(fixed.RELEASE_SHA,sources);report.migration_manifest_sha256=manifest.sha256;
  key=deriveInitialBackupKey(environment.INVITATION_TOKEN_SECRET);
  privateRoot=await privateDirectory(tmpdir());encryptedRoot=await privateDirectory(tmpdir());
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,interrupted);
  timer=setTimeout(()=>{primary??='INITIAL_MIGRATION_DEADLINE_EXCEEDED';void bridge?.close().catch(()=>{});},25*60*1000);
  report.pg17_toolchain=await probeOwnedPg17Toolchain({executionScope:'HOSTED'});
  bridge=await PwaUpgradeSession.connect({...fixed,MIGRATION_SSL_ROOT_CERT_PATH:CA,
   GITHUB_RUN_ID:environment.GITHUB_RUN_ID,GITHUB_ACTOR:environment.GITHUB_ACTOR},PWA_UPGRADE_SESSION_CHILD_SHA256);
  const original=await collectSnapshot(bridge,{source_sha:fixed.RELEASE_SHA,migration_files:UPGRADE_FILES});
  const sourceDeparseContext=await bridge.readDeparseContext();
  report.source_deparse_context=sourceDeparseContext;
  const bootstrapRole=await bootstrapRoleFromSnapshot(bridge,original);
  report.initial_applied_prefix=original.source_history.applied_prefix;
  need(report.initial_applied_prefix>=16,'PWA_UPGRADE_ORIGINAL16_REQUIRED');
  need(original.migration_source_provenance.status==='PROVEN','INITIAL_SOURCE_PROVENANCE_REQUIRED');
  const context=original.snapshot,workerId=randomBytes(16).toString('hex');
  const workerEnvironment=Object.fromEntries(['APP_ENV','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL','MIGRATION_DATABASE_URL'].map(name=>[name,fixed[name]]));
  const capture=await privateDirectory(privateRoot);
  // Sequential native workers share the live export; globals are separately
  // fenced by the full same-backend fresh metadata comparison before writes.
  for(const kind of ['database','globals']){
   const plan=await capturePlan(workerEnvironment,context,original.configuration_safety,workerId,kind,'HOSTED');
   await captureWithOwnedWorker(plan,capture,32*1024*1024);
   await bridge.checkLock();need(!primary,'INITIAL_MIGRATION_INTERRUPTED');
  }
  const privateManifest={format:'cluvo-staging-pwa-upgrade-private-backup-v1',schema_version:1,
   key_profile:INITIAL_BACKUP_KEY_PROFILE,bootstrap_role:bootstrapRole,source:original,
   limits:{provider_keys_included:false,role_passwords_included:false,storage_binary_bytes_included:false,
    provider_services_verified:false,full_provider_restore_verified:false,v1_ready:false,production_enabled:false}};
  await writeFile(join(capture,'manifest.private.json'),JSON.stringify(privateManifest),{flag:'wx',mode:0o600});
  const files=await privateCaptureFiles(capture);let bundle;
  const bindings={schema_version:1,environment:'staging',project_ref:PROJECT,source_sha:fixed.RELEASE_SHA,
   migration_manifest_sha256:manifest.sha256,snapshot_manifest_sha256:hash(files['manifest.private.json'])};
  try{bundle=packFiles(files);bindings.content_sha256=hash(bundle);}
  finally{bundle?.fill(0);for(const bytes of Object.values(files))bytes.fill(0);}
  const artifact=await encryptCaptureFiles(capture,encryptedRoot,key,bindings);
  report.backup_custody=await uploadEncryptedInitialBackup({directory:artifact.directory,actionBundle:BUNDLE,environment});
  need(report.backup_custody.uploaded&&report.backup_custody.remote_readback,'INITIAL_DURABLE_BACKUP_REQUIRED');
  const restoredFiles=await decryptRestoreFiles(artifact.directory,privateRoot,key,bindings);
  report.restore=await restoreInitialBackup({directory:restoredFiles.directory,original,bootstrapRole,executionScope:'HOSTED',sourceDeparseContext});
  need(report.restore.passed===true,'INITIAL_RESTORE_PROOF_REQUIRED');
  await bridge.checkLock();need(!primary,'INITIAL_MIGRATION_INTERRUPTED');
  const fresh=await recheckFreshSnapshot(bridge,original);
  need(fresh.status==='SOURCE_UNCHANGED'&&fresh.same_bridge_instance===true&&fresh.fresh_transaction_ended===true
   &&fresh.exclusive_session_lock_retained===true,'INITIAL_SOURCE_DRIFT_DETECTED');
  report.source_freshness={same_backend:true,full_metadata_unchanged:true,exclusive_lock_retained:true};
  let state=await bridge.readUpgradeState(),history=validateUpgradeHistory(manifest,state);
  need(history.appliedPrefix===original.source_history.applied_prefix,'INITIAL_HISTORY_DRIFT_DETECTED');
  const guard=value=>need(value?.api_only_exposed===true&&value.command_owner_restricted===true&&Number.isSafeInteger(value.app_tables)&&value.app_tables>=144&&value.forced_rls===value.app_tables&&value.native_policies===value.app_tables,'PWA_UPGRADE_NATIVE_GUARDS_REQUIRED');
  guard(state.guards);
  for(let index=history.appliedPrefix;apply&&index<manifest.migrations.length;index++){
   need(!primary,'INITIAL_MIGRATION_INTERRUPTED');
   // Mark attempt before submission: a connection-loss outcome may have committed.
   report.database_mutations_performed=true;
   await bridge.applyUpgrade(index,{actor:environment.GITHUB_ACTOR,workflowRunId:environment.GITHUB_RUN_ID,sourceSha:fixed.RELEASE_SHA,
    manifestSha256:manifest.sha256,backupArtifactId:report.backup_custody.artifact_id,backupArtifactSha256:report.backup_custody.archive_sha256});
   state=await bridge.readUpgradeState();history=validateUpgradeHistory(manifest,state);guard(state.guards);
   need(history.appliedPrefix===index+1,'INITIAL_MIGRATION_READBACK_FAILED');report.applied_migrations++;
  }
  report.final_applied_prefix=history.appliedPrefix;
  need(!apply||history.complete===true,'INITIAL_MIGRATION_SUFFIX_INCOMPLETE');
  report.native_guards=Object.fromEntries(['app_tables','forced_rls','native_policies','api_only_exposed','command_owner_restricted'].map(field=>[field,state.guards[field]]));
  report.migration_manifest=manifest.migrations.map(({version,file,sha256})=>({version,file,sha256}));
  report.passed=true;
 }catch(error){
  primary??=typeof error?.code==='string'&&SAFE_ERROR.test(error.code)?error.code:'INITIAL_MIGRATION_UNAVAILABLE';
  if(/^[0-9A-Z]{5}$/.test(error?.sqlstate??''))report.sqlstate=error.sqlstate;
  if(error instanceof BackupCustodyError&&[200,301,302,303,307,308,400,401,403,404,408,410,422,429,500,502,503,504].includes(error.httpStatus))report.backup_readback_http_status=error.httpStatus;
  if(error instanceof InitialRestoreError&&INITIAL_RESTORE_PHASES.includes(error.phase)){
   report.restore_failure_phase=error.phase;
   if(['PERMISSION','MISSING','SYNTAX','ALREADY_EXISTS','CONFLICT','TIMEOUT','UNSUPPORTED','WARNING','PROCESS_FAILURE'].includes(error.errorKind))report.restore_error_kind=error.errorKind;
   if(INITIAL_RESTORE_REASONS.includes(error.errorReason))report.restore_error_reason=error.errorReason;
   if(Number.isInteger(error.exitStatus)&&error.exitStatus>=0&&error.exitStatus<=255)report.restore_process_exit_status=error.exitStatus;
   if(typeof error.processFailed==='boolean')report.restore_process_failed=error.processFailed;
   if(INITIAL_RESTORE_TOC_TYPES.includes(error.tocType))report.restore_toc_type=error.tocType;
   if(INITIAL_RESTORE_ERROR_ORIGINS.includes(error.errorOrigin))report.restore_error_origin=error.errorOrigin;
   if(INITIAL_RESTORE_ERROR_SOURCE_FILES.includes(error.errorSourceFile))report.restore_error_source_file=error.errorSourceFile;
   if(Array.isArray(error.errorTopics))report.restore_error_topics=INITIAL_RESTORE_ERROR_TOPICS.filter(topic=>error.errorTopics.includes(topic)).slice(0,16);
   if(INITIAL_RESTORE_SECTIONS.includes(error.restoreSection))report.restore_failure_section=error.restoreSection;
   if(error.catalogMismatches.length)report.restore_catalog_mismatches=publicCatalogDiagnostics(error.catalogMismatches);
   const definitions=publicRestoreDefinitionDiagnostics(error.definitionDiagnostics);
   if(definitions)report.restore_constraint_definition_diagnostics=definitions;
   const alignment=publicDeparseAlignment(error.deparseAlignment);
   if(alignment)report.restore_deparse_alignment=alignment;
  }
 }finally{
  clearTimeout(timer);for(const signal of ['SIGINT','SIGTERM'])process.removeListener(signal,interrupted);
  if(bridge){try{await bridge.close();closed=true;}catch{primary='INITIAL_CONNECTION_CLOSE_UNPROVED';}}
  key?.fill(0);
  for(const path of [privateRoot,encryptedRoot])if(path){try{await rm(path,{recursive:true,force:true});}catch{primary='INITIAL_PRIVATE_CLEANUP_UNPROVED';}}
 }
 return {...report,passed:report.passed&&primary===undefined,returned_session_closed:closed,
  ...(primary?{error:primary}:{}),...LIMITS};
}

export async function runStagingPwaUpgradeCLI(){
 try{
  need(process.argv.length===2,'INITIAL_ARGUMENTS_UNEXPECTED');
  const report=await stagingPwaUpgrade(process.env);
  await writeFile('staging-pwa-upgrade.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({result:report.passed?(report.execution_mode==='APPLY'?'STAGING_PWA_UPGRADE_APPLIED':'STAGING_PWA_UPGRADE_RESTORE_VERIFIED'):'FAIL',applied_migrations:report.applied_migrations,
   ...(report.error?{error:report.error}:{}),...LIMITS}));process.exitCode=report.passed?0:1;
 }catch{console.log('STAGING_PWA_UPGRADE_REPORT_UNAVAILABLE');process.exitCode=1;}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await runStagingPwaUpgradeCLI();
