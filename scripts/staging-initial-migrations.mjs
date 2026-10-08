import {createHash} from 'node:crypto';
import {IMMUTABLE16} from './staging-migration-files.mjs';

// Pure source/history/SQL components. This module owns no connection and does
// not attest TLS, snapshot freshness, restore, execution or authorization.
export const INITIAL_MIGRATION_POLICY=Object.freeze({
  projectRef:'fbozlbgmktkgcdfqdaaz', environment:'staging', database:'postgres',
  lockNamespace:1129076054, productionEnabled:false, v1Ready:false,
});
export const INITIAL_MIGRATION_LOCK_OBJECT=createHash('sha256').update(INITIAL_MIGRATION_POLICY.projectRef).digest().readInt32BE(0);
export class InitialMigrationError extends Error {
  constructor(code){super(code);this.code=code;}
}
const fail=(code)=>{throw new InitialMigrationError(code);};
const need=(condition,code)=>{if(!condition)fail(code);};
export const initialMigrationErrorCode=error=>error instanceof InitialMigrationError?error.code:'INITIAL_MIGRATION_UNAVAILABLE';
const digest=value=>createHash('sha256').update(value).digest('hex');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const validSha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
const validRun=value=>typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value);
const validActor=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(value);
const idempotencyKey=(run,version)=>`cluvo-staging-initial16:${run}:${version}`;
const record=(value,fields,code)=>{
  try{
    need(value!==null&&typeof value==='object'&&!Array.isArray(value),code);
    const descriptors=Object.getOwnPropertyDescriptors(value),result={};
    for(const field of fields){need(descriptors[field]&&Object.hasOwn(descriptors[field],'value'),code);result[field]=descriptors[field].value;}
    return result;
  }catch(error){if(error instanceof InitialMigrationError)throw error;fail(code);}
};
const arrayElement=(value,index,code)=>{
  try{const descriptor=Object.getOwnPropertyDescriptor(value,String(index));need(descriptor&&Object.hasOwn(descriptor,'value'),code);return descriptor.value;}
  catch(error){if(error instanceof InitialMigrationError)throw error;fail(code);}
};

// Lexical scanner reused from the reviewed prototype draft. It only strips
// one outer transaction envelope. Strings, dollar bodies and nested comments
// are opaque; SQL-standard BEGIN ATOMIC bodies retain their own END.
export function initialSQLStatements(sql){
  need(typeof sql==='string'&&Buffer.byteLength(sql)<=1_000_000,'INITIAL_SQL_INVALID');
  const result=[];let start=0,index=0,words=[],atomic=[];
  const push=end=>{if(words.length)result.push({start,end,words});start=end;words=[];};
  while(index<sql.length){
    if(/\s/.test(sql[index])){index++;continue;}
    if(sql.startsWith('--',index)){index=sql.indexOf('\n',index+2);if(index<0)index=sql.length;continue;}
    if(sql.startsWith('/*',index)){
      let depth=1;index+=2;
      while(index<sql.length&&depth){if(sql.startsWith('/*',index)){depth++;index+=2;}else if(sql.startsWith('*/',index)){depth--;index+=2;}else index++;}
      need(depth===0,'INITIAL_SQL_UNTERMINATED');continue;
    }
    const tag=sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
    if(tag){const end=sql.indexOf(tag,index+tag.length);need(end>=0,'INITIAL_SQL_UNTERMINATED');if(!atomic.length)words.push('<body>');index=end+tag.length;continue;}
    if(sql[index]==="'"||sql[index]==='"'){
      const quote=sql[index++],escape=quote==="'"&&index>=2&&/[eE]/.test(sql[index-2])&&(index<3||!/[A-Za-z0-9_]/.test(sql[index-3]));let closed=false;
      while(index<sql.length){if(escape&&sql[index]==='\\'){index+=2;continue;}if(sql[index]===quote){if(sql[index+1]===quote){index+=2;continue;}index++;closed=true;break;}index++;}
      need(closed,'INITIAL_SQL_UNTERMINATED');if(!atomic.length)words.push('<quoted>');continue;
    }
    need(sql[index]!=='\\','INITIAL_PSQL_META_UNSUPPORTED');
    if(sql[index]===';'){index++;if(!atomic.length)push(index);continue;}
    const word=sql.slice(index).match(/^[A-Za-z_][A-Za-z0-9_$]*/)?.[0];
    if(word){
      const upper=word.toUpperCase();index+=word.length;
      if(atomic.length){
        if(upper==='CASE')atomic.push('CASE');
        else if(upper==='BEGIN')fail('INITIAL_ATOMIC_BODY_UNSUPPORTED');
        else if(upper==='END'){atomic.pop();if(!atomic.length)words.push('<atomic-body>');}
      }else{
        const declaration=words[0]==='CREATE'&&(words[1]==='FUNCTION'||(words[1]==='OR'&&words[2]==='REPLACE'&&words[3]==='FUNCTION'));
        if(upper==='ATOMIC'&&words.at(-1)==='BEGIN'&&declaration)atomic.push('ATOMIC');
        words.push(upper);
      }
    }else index++;
  }
  need(atomic.length===0,'INITIAL_SQL_UNTERMINATED');
  need(words.length===0,'INITIAL_SQL_TERMINATOR_REQUIRED');
  return result;
}

export function initialMigrationBody(sql){
  let statements=initialSQLStatements(sql);need(statements.length>0,'INITIAL_SQL_EMPTY');
  const first=statements[0],last=statements.at(-1);
  const begin=['BEGIN','START TRANSACTION'].includes(first.words.join(' '));
  const commit=['COMMIT','END'].includes(last.words.join(' '));
  need(begin===commit,'INITIAL_TRANSACTION_UNSUPPORTED');
  const body=begin?sql.slice(first.end,last.start):sql;
  statements=initialSQLStatements(body);need(statements.length>0,'INITIAL_SQL_EMPTY');
  for(const {words} of statements){
    need(!['BEGIN','START','COMMIT','END','ROLLBACK','SAVEPOINT','RELEASE','VACUUM'].includes(words[0]),'INITIAL_TRANSACTION_UNSUPPORTED');
    need(!(words[0]==='PREPARE'&&words[1]==='TRANSACTION'),'INITIAL_TRANSACTION_UNSUPPORTED');
    need(!((words[0]==='CREATE'&&['DATABASE','TABLESPACE'].includes(words[1]))||(words[0]==='ALTER'&&words[1]==='SYSTEM')||
      words.includes('CONCURRENTLY')||(words[0]==='COPY'&&(words.includes('STDIN')||words.includes('PROGRAM')))), 'INITIAL_NONATOMIC_SQL');
  }
  return body;
}

export function createInitialMigrationManifest(sourceSha,sources){
  need(validSha(sourceSha),'INITIAL_SOURCE_SHA_INVALID');
  need(Array.isArray(sources)&&sources.length===16,'INITIAL_SOURCE_FILES_INVALID');
  const migrations=Array.from({length:16},(unused,index)=>{
    const source=arrayElement(sources,index,'INITIAL_SOURCE_FILES_INVALID');
    const value=record(source,['file','bytes'],'INITIAL_SOURCE_FILES_INVALID'),expected=IMMUTABLE16[index];
    need(value.file===expected.file&&Buffer.isBuffer(value.bytes)&&digest(value.bytes)===expected.sha256,'INITIAL_SOURCE_BYTES_CHANGED');
    const sql=value.bytes.toString('utf8');need(Buffer.from(sql).equals(value.bytes),'INITIAL_SOURCE_ENCODING_INVALID');
    return Object.freeze({file:value.file,version:value.file.slice(0,14),name:value.file.slice(15,-4),sha256:expected.sha256,
      sql,body:initialMigrationBody(sql)});
  });
  return Object.freeze({format:'cluvo-initial16-v1',sourceSha,sha256:digest(JSON.stringify(IMMUTABLE16)),migrations:Object.freeze(migrations)});
}

function canonicalManifest(input){
  const value=record(input,['format','sourceSha','sha256','migrations'],'INITIAL_MANIFEST_INVALID');
  need(value.format==='cluvo-initial16-v1'&&validSha(value.sourceSha)&&value.sha256===digest(JSON.stringify(IMMUTABLE16))&&
    Array.isArray(value.migrations)&&value.migrations.length===16,'INITIAL_MANIFEST_INVALID');
  const migrations=Array.from({length:16},(unused,index)=>{
    const input=arrayElement(value.migrations,index,'INITIAL_MANIFEST_INVALID');
    const migration=record(input,['file','version','name','sha256','sql','body'],'INITIAL_MANIFEST_INVALID'),expected=IMMUTABLE16[index];
    need(migration.file===expected.file&&migration.version===expected.file.slice(0,14)&&migration.name===expected.file.slice(15,-4)&&
      migration.sha256===expected.sha256&&typeof migration.sql==='string'&&digest(migration.sql)===expected.sha256&&
      migration.body===initialMigrationBody(migration.sql),'INITIAL_SOURCE_BYTES_CHANGED');
    return Object.freeze(migration);
  });
  return Object.freeze({...value,migrations:Object.freeze(migrations)});
}

export function validateInitialHistory(input,state){
  const manifest=canonicalManifest(input),value=record(state,['historyRows','sourceRows','layout'],'INITIAL_HISTORY_INVALID');
  need(Array.isArray(value.historyRows)&&Array.isArray(value.sourceRows)&&value.historyRows.length<=16&&
    value.sourceRows.length===value.historyRows.length,'INITIAL_HISTORY_INVALID');
  const layout=record(value.layout,['schemas','app_objects'],'INITIAL_LAYOUT_INVALID');
  need(Array.isArray(layout.schemas)&&new Set(layout.schemas).size===layout.schemas.length&&
    layout.schemas.every(schema=>['app','api','internal'].includes(schema))&&Number.isSafeInteger(layout.app_objects)&&layout.app_objects>=0,'INITIAL_LAYOUT_INVALID');
  const prefix=value.historyRows.length;
  need(prefix>0?(layout.schemas.length===3&&layout.app_objects>0):(layout.schemas.length===0&&layout.app_objects===0),'INITIAL_UNTRACKED_APPLICATION_STATE');
  for(let index=0;index<prefix;index++){
    const migration=manifest.migrations[index];
    const history=record(value.historyRows[index],['version','name','statement_count','single_statement_sha256'],'INITIAL_HISTORY_INVALID');
    need(history.version===migration.version&&history.name===migration.name&&history.statement_count===1&&history.single_statement_sha256===migration.sha256,
      'INITIAL_HISTORY_NOT_IMMUTABLE_PREFIX');
    const source=record(value.sourceRows[index],['version','file','sha256','source_sha','actor','scope','expected_version','idempotency_key','workflow_run_id'],'INITIAL_SOURCE_HISTORY_INVALID');
    need(source.version===migration.version&&source.file===migration.file&&source.sha256===migration.sha256&&validSha(source.source_sha)&&
      validActor(source.actor)&&source.scope==='staging'&&source.expected_version===index&&validRun(source.workflow_run_id)&&
      source.idempotency_key===idempotencyKey(source.workflow_run_id,migration.version),'INITIAL_SOURCE_HISTORY_INVALID');
  }
  return Object.freeze({appliedPrefix:prefix,pending:Object.freeze(manifest.migrations.slice(prefix)),
    complete:prefix===16,productionEnabled:false,v1Ready:false,executionProved:false});
}

export const INITIAL_LAYOUT_SQL="SELECT jsonb_build_object('schemas',(SELECT coalesce(jsonb_agg(nspname ORDER BY nspname),'[]'::jsonb) FROM pg_namespace WHERE nspname IN ('app','api','internal')),'app_objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','api','internal')),'history_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,'source_history_present',to_regclass('supabase_migrations.cluvo_migration_source') IS NOT NULL)";
export const INITIAL_HISTORY_SQL="SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statement_count',cardinality(statements),'single_statement_sha256',CASE WHEN cardinality(statements)=1 THEN encode(sha256(convert_to(statements[1],'UTF8')),'hex') ELSE NULL END) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.schema_migrations";
export const INITIAL_SOURCE_HISTORY_SQL="SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'file',file,'sha256',sha256,'source_sha',source_sha,'actor',actor,'scope',scope,'expected_version',expected_version,'idempotency_key',idempotency_key,'workflow_run_id',workflow_run_id) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.cluvo_migration_source";

export function initialMigrationSQL(input,index,inputContext){
  const manifest=canonicalManifest(input);
  need(Number.isSafeInteger(index)&&index>=0&&index<16,'INITIAL_MIGRATION_INDEX_INVALID');
  const context=record(inputContext,['actor','workflowRunId','expectedBackendPid','expectedBackendStart'],'INITIAL_CONTEXT_INVALID');
  need(validActor(context.actor)&&validRun(context.workflowRunId)&&Number.isSafeInteger(context.expectedBackendPid)&&context.expectedBackendPid>0&&
    context.expectedBackendPid<=2147483647&&typeof context.expectedBackendStart==='string'&&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(context.expectedBackendStart),'INITIAL_CONTEXT_INVALID');
  const migration=manifest.migrations[index],prefix=manifest.migrations.slice(0,index);
  const versions=`ARRAY[${prefix.map(item=>literal(item.version)).join(',')}]::text[]`;
  const rows=prefix.map((item,position)=>`(${literal(item.version)},${literal(item.file)},${literal(item.sha256)},${literal(item.name)},${position})`).join(',');
  const historyGuard=prefix.length?`IF EXISTS (SELECT 1 FROM (VALUES ${rows}) expected(version,file,sha256,name,position)
LEFT JOIN supabase_migrations.schema_migrations history USING(version)
LEFT JOIN supabase_migrations.cluvo_migration_source source USING(version)
WHERE history.name IS DISTINCT FROM expected.name OR cardinality(history.statements) IS DISTINCT FROM 1
OR encode(sha256(convert_to(history.statements[1],'UTF8')),'hex') IS DISTINCT FROM expected.sha256
OR source.file IS DISTINCT FROM expected.file OR source.sha256 IS DISTINCT FROM expected.sha256
OR source.scope IS DISTINCT FROM 'staging' OR source.expected_version IS DISTINCT FROM expected.position
OR source.source_sha !~ '^[0-9a-f]{40}$' OR source.actor !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
OR source.workflow_run_id !~ '^[1-9][0-9]{0,19}$'
OR source.idempotency_key IS DISTINCT FROM ('cluvo-staging-initial16:'||source.workflow_run_id||':'||expected.version))
THEN RAISE EXCEPTION 'INITIAL_HISTORY_CHANGED'; END IF;`:
    "IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('app','api','internal')) THEN RAISE EXCEPTION 'INITIAL_UNTRACKED_APPLICATION_STATE'; END IF;";
  // Every byte supplied to this SQL comes from the fixed immutable16 manifest
  // or validated finite context. There is no caller-provided SQL/body route.
  return `BEGIN READ WRITE;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='180s';
SET LOCAL standard_conforming_strings=on;
SET LOCAL search_path=pg_catalog;
SET LOCAL row_security=off;
DO $cluvo_initial_session$ BEGIN
IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
OR pg_backend_pid()<>${context.expectedBackendPid}
OR (SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid()) IS DISTINCT FROM ${literal(context.expectedBackendStart)}::timestamptz
OR NOT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND mode='ExclusiveLock' AND pid=pg_backend_pid() AND granted
AND classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid AND objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid AND objsubid=2)
THEN RAISE EXCEPTION 'INITIAL_SESSION_OR_LOCK_CHANGED'; END IF;
END $cluvo_initial_session$;
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,statements text[],name text);
CREATE TABLE IF NOT EXISTS supabase_migrations.cluvo_migration_source(
version text PRIMARY KEY REFERENCES supabase_migrations.schema_migrations(version),
file text NOT NULL,sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
source_sha text NOT NULL CHECK(source_sha ~ '^[0-9a-f]{40}$'),actor text NOT NULL,
scope text NOT NULL CHECK(scope='staging'),expected_version integer NOT NULL CHECK(expected_version BETWEEN 0 AND 15),
idempotency_key text NOT NULL UNIQUE,workflow_run_id text NOT NULL CHECK(workflow_run_id ~ '^[1-9][0-9]{0,19}$'),
applied_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON supabase_migrations.cluvo_migration_source FROM PUBLIC,anon,authenticated,service_role;
DO $cluvo_initial_prefix$ BEGIN
IF (SELECT coalesce(array_agg(version ORDER BY version),'{}'::text[]) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ${versions}
OR (SELECT coalesce(array_agg(version ORDER BY version),'{}'::text[]) FROM supabase_migrations.cluvo_migration_source) IS DISTINCT FROM ${versions}
THEN RAISE EXCEPTION 'INITIAL_HISTORY_CHANGED'; END IF;
${historyGuard}
END $cluvo_initial_prefix$;
${migration.body}
INSERT INTO supabase_migrations.schema_migrations(version,statements,name)
VALUES(${literal(migration.version)},ARRAY[${literal(migration.sql)}]::text[],${literal(migration.name)});
INSERT INTO supabase_migrations.cluvo_migration_source(version,file,sha256,source_sha,actor,scope,expected_version,idempotency_key,workflow_run_id)
VALUES(${literal(migration.version)},${literal(migration.file)},${literal(migration.sha256)},${literal(manifest.sourceSha)},${literal(context.actor)},'staging',${index},${literal(idempotencyKey(context.workflowRunId,migration.version))},${literal(context.workflowRunId)});
COMMIT;
`;
}
