// Pure additive source/history envelope. No credentials, connection or side effects.
import {createHash} from 'node:crypto';
import {IMMUTABLE16} from './staging-migration-files.mjs';
import {PWA_ADDITIONS} from './staging-pwa-upgrade-files.mjs';
import {createInitialMigrationManifest,validateInitialHistory,initialMigrationBody,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';

export const UPGRADE_FILES=Object.freeze([...IMMUTABLE16,...PWA_ADDITIONS]);
export class UpgradeMigrationError extends Error {constructor(code){super(code);this.code=code;}}
const need=(value,code)=>{if(!value)throw new UpgradeMigrationError(code);};
const digest=value=>createHash('sha256').update(value).digest('hex');
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const sha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const hash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const run=value=>typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value);
const actor=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(value);
const key=(runId,version)=>`cluvo-staging-pwa-upgrade:${runId}:${version}`;
const record=(value,fields,code)=>{
 try{
  need(value!==null&&typeof value==='object'&&!Array.isArray(value),code);
  const descriptors=Object.getOwnPropertyDescriptors(value),result={};
  for(const field of fields){need(descriptors[field]&&Object.hasOwn(descriptors[field],'value'),code);result[field]=descriptors[field].value;}
  return result;
 }catch(error){if(error instanceof UpgradeMigrationError)throw error;throw new UpgradeMigrationError(code);}
};
const element=(value,index,code)=>{
 try{const descriptor=Object.getOwnPropertyDescriptor(value,String(index));need(descriptor&&Object.hasOwn(descriptor,'value'),code);return descriptor.value;}
 catch(error){if(error instanceof UpgradeMigrationError)throw error;throw new UpgradeMigrationError(code);}
};
const first16=(array,code)=>Array.from({length:16},(_,index)=>element(array,index,code));

// Approved from the completed hosted31 safe aggregate. Earlier receipts are
// immutable: only this complete, byte-identical predecessor can accompany36.
export const APPROVED_PWA_PREDECESSOR31=Object.freeze({
 appliedPrefix:31,
 manifestSha256:'4d00699a669e26e0e030523c56c87a231177c5887470d6fe2903ead7164b7e4d',
 sourceSha:'8762f2284eb980cdbe0d5478a533a6f893b5d409',
 workflowRunId:'37888304288',
 backupArtifactId:'11597955308',
 backupArtifactSha256:'013e009fcfbe1a86403bcb8dfbf58fa3ed5ec36416190edc0444112e1d3a0d6b',
});
function predecessor31(manifestHash){
 if(UPGRADE_FILES.length!==36||manifestHash===APPROVED_PWA_PREDECESSOR31.manifestSha256)return null;
 need(digest(JSON.stringify(UPGRADE_FILES.slice(0,31)))===APPROVED_PWA_PREDECESSOR31.manifestSha256,'PWA_UPGRADE_PREDECESSOR_BYTES_CHANGED');
 return APPROVED_PWA_PREDECESSOR31;
}
// The completed hosted35 run appended exactly four receipts to approved31.
// A fresh or partial historical35 cohort is not this approved predecessor.
export const APPROVED_PWA_PREDECESSOR35=Object.freeze({
 appliedPrefix:35,
 manifestSha256:'b39a9bb9d167e02e5723f0efe68bacc3df1bfeb08a03551c8efe8dcd70171466',
 sourceSha:'9ae1d3b0cefb0fb6f19c586b6dcfd611131366ef',
 workflowRunId:'37926728047',
 backupArtifactId:'11614747678',
 backupArtifactSha256:'1b0f925b0238fa66a9c6247b56b30a9fc31ff2108f21edc14da41130aa471198',
});
function predecessor35(manifestHash){
 if(UPGRADE_FILES.length!==36||manifestHash===APPROVED_PWA_PREDECESSOR35.manifestSha256)return null;
 need(digest(JSON.stringify(UPGRADE_FILES.slice(0,35)))===APPROVED_PWA_PREDECESSOR35.manifestSha256,'PWA_UPGRADE_PREDECESSOR_BYTES_CHANGED');
 return APPROVED_PWA_PREDECESSOR35;
}
function predecessorReceipt(receipt,approved){
 return approved!==null&&receipt.manifest_sha256===approved.manifestSha256
  &&receipt.source_sha===approved.sourceSha&&receipt.workflow_run_id===approved.workflowRunId
  &&receipt.backup_artifact_id===approved.backupArtifactId&&receipt.backup_artifact_sha256===approved.backupArtifactSha256;
}

// Shared by the fixed writer and native/read-only schema gates. Position is a
// closed generator expression, never caller SQL. Historical cohorts must be
// complete; the exact hosted35 cohort also requires the complete approved31.
export function upgradeReceiptLineageSQL(manifestHash,appliedPrefix,position='expected.position'){
 need(hash(manifestHash)&&Number.isSafeInteger(appliedPrefix)&&appliedPrefix>=16&&appliedPrefix<=UPGRADE_FILES.length
  &&['expected.position','e.position'].includes(position),'PWA_UPGRADE_LINEAGE_INPUT_INVALID');
 const approved=predecessor31(manifestHash),approved35=predecessor35(manifestHash);
 const current=`suffix.manifest_sha256 IS NOT DISTINCT FROM ${literal(manifestHash)}`;
 if(!approved)return Object.freeze({rowInvalidSql:`NOT(${current})`,aggregateInvalidSql:'false'});
 const count=`(SELECT count(*) FROM supabase_migrations.cluvo_pwa_upgrade_source WHERE manifest_sha256=${literal(approved.manifestSha256)})`;
 const previous=`(${position} BETWEEN 16 AND 30 AND suffix.manifest_sha256 IS NOT DISTINCT FROM ${literal(approved.manifestSha256)}
 AND suffix.source_sha IS NOT DISTINCT FROM ${literal(approved.sourceSha)}
 AND suffix.workflow_run_id IS NOT DISTINCT FROM ${literal(approved.workflowRunId)}
 AND suffix.backup_artifact_id IS NOT DISTINCT FROM ${literal(approved.backupArtifactId)}
 AND suffix.backup_artifact_sha256 IS NOT DISTINCT FROM ${literal(approved.backupArtifactSha256)})`;
 if(!approved35)return Object.freeze({rowInvalidSql:`NOT(${current} OR ${previous})`,
  aggregateInvalidSql:`(${count}>0 AND (${appliedPrefix}<31 OR ${count}<>15))`});
 const count35=`(SELECT count(*) FROM supabase_migrations.cluvo_pwa_upgrade_source WHERE manifest_sha256=${literal(approved35.manifestSha256)})`;
 const previous35=`(${position} BETWEEN 31 AND 34 AND suffix.manifest_sha256 IS NOT DISTINCT FROM ${literal(approved35.manifestSha256)}
 AND suffix.source_sha IS NOT DISTINCT FROM ${literal(approved35.sourceSha)}
 AND suffix.workflow_run_id IS NOT DISTINCT FROM ${literal(approved35.workflowRunId)}
 AND suffix.backup_artifact_id IS NOT DISTINCT FROM ${literal(approved35.backupArtifactId)}
 AND suffix.backup_artifact_sha256 IS NOT DISTINCT FROM ${literal(approved35.backupArtifactSha256)})`;
 return Object.freeze({rowInvalidSql:`NOT(${current} OR ${previous} OR ${previous35})`,
  aggregateInvalidSql:`((${count}>0 AND (${appliedPrefix}<31 OR ${count}<>15)) OR (${count35}>0 AND (${appliedPrefix}<35 OR ${count35}<>4 OR ${count}<>15)))`});
}

export function createUpgradeMigrationManifest(sourceSha,sources){
 need(sha(sourceSha)&&Array.isArray(sources)&&sources.length===UPGRADE_FILES.length,'PWA_UPGRADE_SOURCE_REQUIRED');
 const initial=createInitialMigrationManifest(sourceSha,first16(sources,'PWA_UPGRADE_SOURCE_REQUIRED'));
 const additions=PWA_ADDITIONS.map((entry,index)=>{
  const input=record(element(sources,index+16,'PWA_UPGRADE_SOURCE_REQUIRED'),['file','bytes'],'PWA_UPGRADE_SOURCE_REQUIRED');
  need(input?.file===entry.file&&Buffer.isBuffer(input.bytes)&&input.bytes.length>0&&input.bytes.length<=1_000_000&&digest(input.bytes)===entry.sha256,'PWA_UPGRADE_SOURCE_BYTES_CHANGED');
  const match=entry.file.match(/^([0-9]{14})_([a-z0-9_]+)\.sql$/);
  need(match&&match[1]>'20261007013000'&&(index===0||entry.file>PWA_ADDITIONS[index-1].file),'PWA_UPGRADE_SOURCE_ORDER_INVALID');
  const sql=input.bytes.toString('utf8');
  need(Buffer.from(sql).equals(input.bytes),'PWA_UPGRADE_SOURCE_ENCODING_INVALID');
  return Object.freeze({version:match[1],name:match[2],file:entry.file,sha256:entry.sha256,sql,body:initialMigrationBody(sql)});
 });
 const migrations=Object.freeze([...initial.migrations,...additions]);
 return Object.freeze({sourceSha,migrations,sha256:digest(JSON.stringify(migrations.map(({file,sha256})=>({file,sha256}))))});
}

function canonical(input){
 const value=record(input,['sourceSha','sha256','migrations'],'PWA_UPGRADE_MANIFEST_INVALID');
 need(sha(value.sourceSha)&&Array.isArray(value.migrations)&&value.migrations.length===UPGRADE_FILES.length,'PWA_UPGRADE_MANIFEST_INVALID');
 const sources=Array.from({length:UPGRADE_FILES.length},(_,index)=>{
  const migration=record(element(value.migrations,index,'PWA_UPGRADE_MANIFEST_INVALID'),['file','version','name','sha256','sql','body'],'PWA_UPGRADE_MANIFEST_INVALID');
  const expected=UPGRADE_FILES[index];
  need(migration.file===expected.file&&migration.version===expected.file.slice(0,14)&&migration.name===expected.file.slice(15,-4)&&migration.sha256===expected.sha256&&typeof migration.sql==='string'&&digest(migration.sql)===expected.sha256&&migration.body===initialMigrationBody(migration.sql),'PWA_UPGRADE_SOURCE_BYTES_CHANGED');
  return {file:migration.file,bytes:Buffer.from(migration.sql)};
 });
 const result=createUpgradeMigrationManifest(value.sourceSha,sources);
 need(value.sha256===result.sha256,'PWA_UPGRADE_MANIFEST_CHANGED');
 return result;
}

export function validateUpgradeHistory(input,state){
 const manifest=canonical(input);
 state=record(state,['historyRows','sourceRows','upgradeRows','layout'],'PWA_UPGRADE_HISTORY_INVALID');
 need(Array.isArray(state.historyRows)&&Array.isArray(state.sourceRows)&&Array.isArray(state.upgradeRows)&&state.historyRows.length>=16&&state.historyRows.length<=manifest.migrations.length,'PWA_UPGRADE_HISTORY_INVALID');
 const initial=createInitialMigrationManifest(manifest.sourceSha,manifest.migrations.slice(0,16).map(item=>({file:item.file,bytes:Buffer.from(item.sql)})));
 validateInitialHistory(initial,{historyRows:first16(state.historyRows,'PWA_UPGRADE_HISTORY_INVALID'),sourceRows:state.sourceRows,layout:state.layout});
 const appliedPrefix=state.historyRows.length;
 need(state.sourceRows.length===16&&state.upgradeRows.length===appliedPrefix-16,'PWA_UPGRADE_RECEIPT_INCOMPLETE');
 const approved=predecessor31(manifest.sha256),approved35=predecessor35(manifest.sha256);
 const historical=Array.from({length:state.upgradeRows.length},(_,index)=>record(element(state.upgradeRows,index,'PWA_UPGRADE_RECEIPT_CHANGED'),['manifest_sha256'],'PWA_UPGRADE_RECEIPT_CHANGED'))
  .filter(receipt=>receipt.manifest_sha256!==manifest.sha256);
 if(historical.length){
  const count31=historical.filter(receipt=>receipt.manifest_sha256===approved?.manifestSha256).length;
  const count35=historical.filter(receipt=>receipt.manifest_sha256===approved35?.manifestSha256).length;
  need(approved!==null&&historical.length===count31+count35&&appliedPrefix>=31&&count31===15
   &&(count35===0||(approved35!==null&&appliedPrefix>=35&&count35===4)),'PWA_UPGRADE_RECEIPT_CHANGED');
 }
 for(let index=16;index<appliedPrefix;index++){
  const expected=manifest.migrations[index],history=record(element(state.historyRows,index,'PWA_UPGRADE_HISTORY_INVALID'),['version','name','statement_count','single_statement_sha256'],'PWA_UPGRADE_HISTORY_INVALID');
  const receipt=record(element(state.upgradeRows,index-16,'PWA_UPGRADE_RECEIPT_CHANGED'),['version','file','sha256','source_sha','actor','scope','expected_version','workflow_run_id','idempotency_key','manifest_sha256','backup_artifact_id','backup_artifact_sha256'],'PWA_UPGRADE_RECEIPT_CHANGED');
  need(history?.version===expected.version&&history.name===expected.name&&history.statement_count===1&&history.single_statement_sha256===expected.sha256,'PWA_UPGRADE_HISTORY_CHANGED');
  need(receipt?.version===expected.version&&receipt.file===expected.file&&receipt.sha256===expected.sha256&&sha(receipt.source_sha)&&actor(receipt.actor)&&receipt.scope==='staging'&&receipt.expected_version===index&&run(receipt.workflow_run_id)&&receipt.idempotency_key===key(receipt.workflow_run_id,expected.version)
   &&(receipt.manifest_sha256===manifest.sha256||(index<31&&predecessorReceipt(receipt,approved))||(index>=31&&index<35&&predecessorReceipt(receipt,approved35)))&&run(receipt.backup_artifact_id)&&hash(receipt.backup_artifact_sha256),'PWA_UPGRADE_RECEIPT_CHANGED');
 }
 return Object.freeze({appliedPrefix,pending:Object.freeze(manifest.migrations.slice(appliedPrefix)),complete:appliedPrefix===manifest.migrations.length,productionEnabled:false});
}

export const UPGRADE_SOURCE_HISTORY_SQL="SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'file',file,'sha256',sha256,'source_sha',source_sha,'actor',actor,'scope',scope,'expected_version',expected_version,'idempotency_key',idempotency_key,'workflow_run_id',workflow_run_id,'manifest_sha256',manifest_sha256,'backup_artifact_id',backup_artifact_id,'backup_artifact_sha256',backup_artifact_sha256) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.cluvo_pwa_upgrade_source";

export function upgradeMigrationSQL(input,index,context){
 const manifest=canonical(input);
 need(Number.isSafeInteger(index)&&index>=16&&index<manifest.migrations.length,'PWA_UPGRADE_INDEX_INVALID');
 context=record(context,['actor','workflowRunId','backupArtifactId','backupArtifactSha256','expectedBackendPid','expectedBackendStart'],'PWA_UPGRADE_CONTEXT_INVALID');
 need(context&&actor(context.actor)&&run(context.workflowRunId)&&run(context.backupArtifactId)&&hash(context.backupArtifactSha256)&&Number.isSafeInteger(context.expectedBackendPid)&&context.expectedBackendPid>0&&context.expectedBackendPid<=2147483647&&typeof context.expectedBackendStart==='string'&&/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(context.expectedBackendStart),'PWA_UPGRADE_CONTEXT_INVALID');
 const migration=manifest.migrations[index],prefix=manifest.migrations.slice(0,index);
 const lineage=upgradeReceiptLineageSQL(manifest.sha256,index);
 const rows=prefix.map((item,position)=>`(${literal(item.version)},${literal(item.file)},${literal(item.sha256)},${literal(item.name)},${position})`).join(',');
 const versions=`ARRAY[${prefix.map(item=>literal(item.version)).join(',')}]::text[]`;
 return `BEGIN READ WRITE;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
SET LOCAL standard_conforming_strings=on;
SET LOCAL search_path=pg_catalog;
SET LOCAL row_security=on;
DO $cluvo_pwa_owner$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
OR pg_backend_pid()<>${context.expectedBackendPid}
OR (SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid()) IS DISTINCT FROM ${literal(context.expectedBackendStart)}::timestamptz
OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND mode='ExclusiveLock' AND pid=pg_backend_pid() AND granted AND classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid AND objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid AND objsubid=2)
THEN RAISE EXCEPTION 'PWA_UPGRADE_SESSION_OR_LOCK_CHANGED';END IF;
END $cluvo_pwa_owner$;
CREATE TABLE IF NOT EXISTS supabase_migrations.cluvo_pwa_upgrade_source(
 version text PRIMARY KEY REFERENCES supabase_migrations.schema_migrations(version),file text NOT NULL,
 sha256 text NOT NULL CHECK(sha256~'^[0-9a-f]{64}$'),source_sha text NOT NULL CHECK(source_sha~'^[0-9a-f]{40}$'),
 actor text NOT NULL,scope text NOT NULL CHECK(scope='staging'),expected_version integer NOT NULL CHECK(expected_version BETWEEN 16 AND 63),
 idempotency_key text NOT NULL UNIQUE,workflow_run_id text NOT NULL CHECK(workflow_run_id~'^[1-9][0-9]{0,19}$'),
 manifest_sha256 text NOT NULL CHECK(manifest_sha256~'^[0-9a-f]{64}$'),backup_artifact_id text NOT NULL CHECK(backup_artifact_id~'^[1-9][0-9]{0,19}$'),
 backup_artifact_sha256 text NOT NULL CHECK(backup_artifact_sha256~'^[0-9a-f]{64}$'),applied_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON supabase_migrations.cluvo_pwa_upgrade_source FROM PUBLIC,anon,authenticated,service_role;
DO $cluvo_pwa_prefix$ BEGIN
IF (SELECT coalesce(array_agg(version ORDER BY version),'{}'::text[]) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ${versions}
OR (SELECT count(*) FROM supabase_migrations.cluvo_migration_source)<>16
OR (SELECT count(*) FROM supabase_migrations.cluvo_pwa_upgrade_source)<>${index-16}
OR ${lineage.aggregateInvalidSql}
THEN RAISE EXCEPTION 'PWA_UPGRADE_HISTORY_CHANGED';END IF;
IF EXISTS(SELECT 1 FROM (VALUES ${rows}) expected(version,file,sha256,name,position)
LEFT JOIN supabase_migrations.schema_migrations h USING(version)
LEFT JOIN supabase_migrations.cluvo_migration_source initial USING(version)
LEFT JOIN supabase_migrations.cluvo_pwa_upgrade_source suffix USING(version)
WHERE h.name IS DISTINCT FROM expected.name OR cardinality(h.statements) IS DISTINCT FROM 1
OR encode(sha256(convert_to(h.statements[1],'UTF8')),'hex') IS DISTINCT FROM expected.sha256
OR CASE WHEN expected.position<16 THEN initial.file ELSE suffix.file END IS DISTINCT FROM expected.file
OR CASE WHEN expected.position<16 THEN initial.sha256 ELSE suffix.sha256 END IS DISTINCT FROM expected.sha256
OR CASE WHEN expected.position<16 THEN initial.expected_version ELSE suffix.expected_version END IS DISTINCT FROM expected.position
OR CASE WHEN expected.position<16 THEN initial.scope ELSE suffix.scope END IS DISTINCT FROM 'staging'
OR coalesce(initial.source_sha,suffix.source_sha,'') !~ '^[0-9a-f]{40}$'
OR coalesce(initial.actor,suffix.actor,'') !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
OR coalesce(initial.workflow_run_id,suffix.workflow_run_id,'') !~ '^[1-9][0-9]{0,19}$'
OR CASE WHEN expected.position<16 THEN initial.idempotency_key ELSE suffix.idempotency_key END IS DISTINCT FROM
(CASE WHEN expected.position<16 THEN 'cluvo-staging-initial16:' ELSE 'cluvo-staging-pwa-upgrade:' END||coalesce(initial.workflow_run_id,suffix.workflow_run_id)||':'||expected.version)
OR (expected.position>=16 AND (${lineage.rowInvalidSql} OR coalesce(suffix.backup_artifact_id,'') !~ '^[1-9][0-9]{0,19}$' OR coalesce(suffix.backup_artifact_sha256,'') !~ '^[0-9a-f]{64}$')))
THEN RAISE EXCEPTION 'PWA_UPGRADE_HISTORY_CHANGED';END IF;
END $cluvo_pwa_prefix$;
${migration.body}
INSERT INTO supabase_migrations.schema_migrations(version,statements,name) VALUES(${literal(migration.version)},ARRAY[${literal(migration.sql)}]::text[],${literal(migration.name)});
INSERT INTO supabase_migrations.cluvo_pwa_upgrade_source(version,file,sha256,source_sha,actor,scope,expected_version,idempotency_key,workflow_run_id,manifest_sha256,backup_artifact_id,backup_artifact_sha256)
VALUES(${literal(migration.version)},${literal(migration.file)},${literal(migration.sha256)},${literal(manifest.sourceSha)},${literal(context.actor)},'staging',${index},${literal(key(context.workflowRunId,migration.version))},${literal(context.workflowRunId)},${literal(manifest.sha256)},${literal(context.backupArtifactId)},${literal(context.backupArtifactSha256)});
COMMIT;
`;
}
