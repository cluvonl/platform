// Private fixed generator used only by the pinned initial-migration child.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {IMMUTABLE16} from './staging-migration-files.mjs';
import {createInitialMigrationManifest,initialMigrationSQL,validateInitialHistory,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';
import {stagingApiExposureSQL} from './staging-api-exposure.mjs';
import {buildStagingCoreBootstrap} from './staging-core-bootstrap.mjs';

const literal=value=>"'"+value.replaceAll("'","''")+"'";
const fields=(input,names)=>{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INITIAL_GENERATOR_INPUT_INVALID');
  const descriptors=Object.getOwnPropertyDescriptors(input);
  if(Reflect.ownKeys(descriptors).sort().join(',')!==names.sort().join(',')||names.some(name=>!Object.hasOwn(descriptors[name],'value')))throw Error('INITIAL_GENERATOR_INPUT_INVALID');
};
async function fixedManifest(sourceSha){
  const sources=await Promise.all(IMMUTABLE16.map(async entry=>({file:entry.file,
    bytes:await readFile(new URL('../supabase/migrations/'+entry.file,import.meta.url))})));
  return createInitialMigrationManifest(sourceSha,sources);
}

export async function fixedInitialSQL(input){
  fields(input,['actor','expectedBackendPid','expectedBackendStart','index','sourceSha','workflowRunId']);
  const manifest=await fixedManifest(input.sourceSha);
  return initialMigrationSQL(manifest,input.index,{actor:input.actor,workflowRunId:input.workflowRunId,
    expectedBackendPid:input.expectedBackendPid,expectedBackendStart:input.expectedBackendStart});
}

// This guard is generated only from the pinned originals and physical session
// identity. Fixed post-migration writes recheck immutable history inside their
// own transaction, before configuration or fixture mutations.
function fixedWriteGuard(manifest,input){
  const pid=input.expectedBackendPid,start=input.expectedBackendStart;
  if(!Number.isSafeInteger(pid)||pid<=0||pid>2147483647||typeof start!=='string'||
    !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(start))throw Error('INITIAL_GENERATOR_INPUT_INVALID');
  const values=manifest.migrations.map((entry,index)=>`(${literal(entry.version)},${literal(entry.name)},${literal(entry.file)},${literal(entry.sha256)},${index})`).join(',');
  return `DO $cluvo_fixed_writer$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
OR pg_backend_pid()<>${pid}
OR (SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid()) IS DISTINCT FROM ${literal(start)}::timestamptz
OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND mode='ExclusiveLock' AND granted
AND classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid AND objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid AND objsubid=2)
THEN RAISE EXCEPTION 'INITIAL_SESSION_OR_LOCK_CHANGED'; END IF;
IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>16 OR (SELECT count(*) FROM supabase_migrations.cluvo_migration_source)<>16
OR EXISTS(SELECT 1 FROM (VALUES ${values}) expected(version,name,file,sha256,position)
LEFT JOIN supabase_migrations.schema_migrations history USING(version)
LEFT JOIN supabase_migrations.cluvo_migration_source source USING(version)
WHERE history.name IS DISTINCT FROM expected.name OR cardinality(history.statements) IS DISTINCT FROM 1
OR encode(sha256(convert_to(history.statements[1],'UTF8')),'hex') IS DISTINCT FROM expected.sha256
OR source.file IS DISTINCT FROM expected.file OR source.sha256 IS DISTINCT FROM expected.sha256
OR source.scope IS DISTINCT FROM 'staging' OR source.expected_version IS DISTINCT FROM expected.position
OR source.source_sha !~ '^[0-9a-f]{40}$' OR source.actor !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
OR source.workflow_run_id !~ '^[1-9][0-9]{0,19}$'
OR source.idempotency_key IS DISTINCT FROM ('cluvo-staging-initial16:'||source.workflow_run_id||':'||expected.version))
THEN RAISE EXCEPTION 'INITIAL_HISTORY_CHANGED'; END IF;
END $cluvo_fixed_writer$;`;
}

export async function fixedOperation(input){
  const operation=input?.operation;
  if(operation==='apply_initial'){
    fields(input,['operation','actor','expectedBackendPid','expectedBackendStart','index','sourceSha','workflowRunId']);
    const {operation:unused,...value}=input;void unused;
    return await fixedInitialSQL(value);
  }
  if(!['configure_api','bootstrap_core'].includes(operation))throw Error('INITIAL_GENERATOR_OPERATION_INVALID');
  fields(input,['operation','actor','expectedBackendPid','expectedBackendStart','sourceSha','workflowRunId','state',...(operation==='bootstrap_core'?['recipient']:[])]);
  const manifest=await fixedManifest(input.sourceSha);
  if(!validateInitialHistory(manifest,input.state).complete)throw Error('INITIAL_HISTORY_INCOMPLETE');
  const guardSql=fixedWriteGuard(manifest,input),context={sourceSha:input.sourceSha,workflowRunId:input.workflowRunId,actor:input.actor,expectedVersion:0};
  if(operation==='configure_api'){
    const sql=stagingApiExposureSQL(context);
    if(!sql.startsWith('BEGIN READ WRITE;\n'))throw Error('INITIAL_GENERATOR_SOURCE_CHANGED');
    return sql.replace('BEGIN READ WRITE;\n',`BEGIN READ WRITE;\nSET LOCAL standard_conforming_strings=on; SET LOCAL search_path=pg_catalog;\n${guardSql}\n`);
  }
  const recipe=buildStagingCoreBootstrap({...context,recipient:input.recipient});
  return JSON.stringify({...recipe,guardSql});
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==3||process.argv[2]!=='--private-fixed-initial-sql'||!/^v24\.\d+\.\d+$/.test(process.version))throw Error('INITIAL_GENERATOR_CONTEXT_INVALID');
    const chunks=[];let size=0;
    for await(const chunk of process.stdin){size+=chunk.length;if(size>131072)throw Error('INITIAL_GENERATOR_INPUT_INVALID');chunks.push(chunk);}
    const raw=Buffer.concat(chunks),decoded=new TextDecoder('utf-8',{fatal:true}).decode(raw);
    process.stdout.write(await fixedOperation(JSON.parse(decoded)));
  }catch{process.exitCode=1;}
}
