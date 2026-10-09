// Additive PWA owner fork; original initial16 implementation remains unchanged.
// Limited logical restore/initial16 upgrade. No process, ENV or connection on import.
// Parent owns the actual source receipt, authenticated backup bytes and live lock.
import {randomBytes,createHash} from 'node:crypto';
import {readFile,lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {executeDatabaseProcess} from './staging-database-process.mjs';
import {CATALOG_QUERIES} from './staging-capture-catalog.mjs';
import {catalogMismatchDiagnostic,publicCatalogDiagnostics} from './staging-catalog-diagnostic.mjs';
import {PWA_DEPARSE_CONTEXT_SQL,publicDeparseContext,cloneDeparseSettingsSQL,publicConstraintDefinitionDiagnostics,publicRestoreDefinitionDiagnostics,publicDeparseAlignment} from './staging-pwa-restore-diagnostic.mjs';
import {schemaFirstRestoreLists} from './staging-restore-toc.mjs';
import {aggregate} from './staging-capture-queries.mjs';
import {IMMUTABLE16} from './staging-migration-files.mjs';
import {IMAGE} from './pg17-capture-worker.mjs';
import {PG17_PUBLIC_CORE_SOURCE_FILES} from './pg17-public-source-files.mjs';
import {INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';
import {PWA_ADDITIONS} from './staging-pwa-upgrade-files.mjs';
import {createUpgradeMigrationManifest,upgradeMigrationSQL,validateUpgradeHistory,UPGRADE_SOURCE_HISTORY_SQL} from './staging-pwa-upgrade-migrations.mjs';
const UPGRADE_FILES=Object.freeze([...IMMUTABLE16,...PWA_ADDITIONS]);
// psql's unaligned boolean wire value is t/f. This consumer parses JSON, so
// the fixed existence query must return a typed JSON boolean instead.
export const PWA_RESTORE_SUFFIX_LAYOUT_SQL="SELECT to_jsonb(to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NOT NULL);";

export const INITIAL_RESTORE_PHASES=Object.freeze(['input','image','create','start','ready','globals','restore','restore_toc','extension_owners','database','role_settings','database_acl','schema_acl',...Object.keys(CATALOG_QUERIES).map(family=>'catalog.'+family),'data','sequence','actor','history','upgrade','jobs','cleanup']);
export const INITIAL_RESTORE_REASONS=Object.freeze(['EXTENSION_VERSION_UNAVAILABLE','EXTENSION_NOT_AVAILABLE','EXTENSION_LIBRARY_MISSING','EXTENSION_MUST_BE_PRELOADED','BACKGROUND_WORKER_REGISTRATION_FAILED','SERVER_KEY_UNAVAILABLE','CATALOG_LOOKUP_FAILED','EVENT_TRIGGER_OWNER_MISMATCH','READ_ONLY_TRANSACTION','ARCHIVE_TRUNCATED','ARCHIVE_VERSION_UNSUPPORTED','ARCHIVE_COMPRESSION_UNSUPPORTED','SERVER_DISCONNECTED','OUT_OF_MEMORY','DISK_FULL','GLOBAL_SETTING_UNSUPPORTED','STATEMENT_TIMEOUT','ROW_CONSTRAINT_VIOLATION','SCHEMA_REQUIRED','SERVER_SQLSTATE_REPORTED','UNKNOWN_PROCESS_FAILURE']);
export const INITIAL_RESTORE_SECTIONS=Object.freeze(['pre-data','data','post-data']);
export const INITIAL_RESTORE_ERROR_ORIGINS=Object.freeze(['POSTGRES_CORE','PLPGSQL','PG_NET','PGSODIUM','SUPABASE_VAULT','SUPAUTILS','PG_CRON','PG_TLE','PG_STAT_STATEMENTS','PGAUDIT','PLPGSQL_CHECK','PGRX']);
export const INITIAL_RESTORE_ERROR_TOPICS=Object.freeze(['EXTENSION','LIBRARY','FUNCTION','SCHEMA','TABLE','COLUMN','TYPE','ROLE','DATABASE','PARAMETER','WORKER','KEY','CACHE','TUPLE','NODE','PERMISSION','MEMORY','SNAPSHOT','QUERY','COMMAND','FILE','SOCKET','ENCODING','CONFIGURATION','CONTEXT','INDEX','ARCHIVE','DEPENDENCY','OBJECT','LOCK','OWNER','VERSION','TRANSACTION','PUBLICATION','AUTHORIZATION','ENCRYPTION','COLLATION','RESOURCE','PORTAL','JSON','PARSE','SPI','SESSION','POLICY','EVENT','INVALID','MISSING','UNEXPECTED','UNSUPPORTED','CHECK','NUMERIC','INITIALIZATION','HASH','EXPRESSION','CREATE','LOAD','LOOKUP','OPEN','READ','WRITE','EXECUTE','REGISTER','START','RESTART','DROP','ALTER','CONNECT','FIND','MAP','DECODE','RETURN','ALLOCATE','UNRECOGNIZED','RESTRICTED','RESERVED','FAIL','CALL','PROCESS','BUILD','INSERT','DELETE','UPDATE','RESTORE','DEFINE','GENERATE','ASSIGN']);
export const INITIAL_RESTORE_ERROR_SOURCE_FILES=Object.freeze([...PG17_PUBLIC_CORE_SOURCE_FILES,'pl_exec.c','pl_comp.c','pl_handler.c','pg_net.c','pgsodium.c','vault.c','supautils.c','pg_cron.c','job_metadata.c','pg_tle.c','pg_stat_statements.c','pgaudit.c','plpgsql_check.c','elog.rs','ffi.rs','panic.rs']);
export const INITIAL_RESTORE_TOC_TYPES=Object.freeze(['ACL','AGGREGATE','BLOB','BLOB COMMENTS','BLOBS','CAST','CHECK CONSTRAINT','COLLATION','COMMENT','CONSTRAINT','DATABASE','DATABASE PROPERTIES','DEFAULT','DEFAULT ACL','DOMAIN','DOMAIN CONSTRAINT','ENCODING','EVENT TRIGGER','EXTENSION','FK CONSTRAINT','FOREIGN DATA WRAPPER','FOREIGN SERVER','FOREIGN TABLE','FUNCTION','INDEX','INDEX ATTACH','MATERIALIZED VIEW','MATERIALIZED VIEW DATA','OPERATOR','OPERATOR CLASS','OPERATOR FAMILY','POLICY','PROCEDURE','PUBLICATION','PUBLICATION TABLE','PUBLICATION TABLES IN SCHEMA','ROW SECURITY','RULE','SCHEMA','SEARCHPATH','SEQUENCE','SEQUENCE OWNED BY','SEQUENCE SET','SHELL TYPE','STATISTICS','STDSTRINGS','SUBSCRIPTION','TABLE','TABLE ATTACH','TABLE DATA','TABLESPACE','TEXT SEARCH CONFIGURATION','TEXT SEARCH DICTIONARY','TEXT SEARCH PARSER','TEXT SEARCH TEMPLATE','TRANSFORM','TRIGGER','TYPE','USER MAPPING','VIEW']);
export class InitialRestoreError extends Error {
 constructor(code,{phase='input',sqlstate=null,errorKind=null,errorReason=null,exitStatus=null,processFailed=null,tocType=null,errorOrigin=null,errorSourceFile=null,errorTopics=[],restoreSection=null,catalogMismatches=[],definitionDiagnostics=null,deparseAlignment=null}={}){
  super(code);this.code=code;this.phase=INITIAL_RESTORE_PHASES.includes(phase)?phase:'input';
  this.sqlstate=Object.hasOwn(SQLSTATE_KINDS,sqlstate)?sqlstate:null;
  this.errorKind=ERROR_KINDS.includes(errorKind)?errorKind:null;
  this.errorReason=INITIAL_RESTORE_REASONS.includes(errorReason)?errorReason:null;
  this.exitStatus=Number.isInteger(exitStatus)&&exitStatus>=0&&exitStatus<=255?exitStatus:null;
  this.processFailed=typeof processFailed==='boolean'?processFailed:null;
  this.tocType=INITIAL_RESTORE_TOC_TYPES.includes(tocType)?tocType:null;
  this.errorOrigin=INITIAL_RESTORE_ERROR_ORIGINS.includes(errorOrigin)?errorOrigin:null;
  this.errorSourceFile=INITIAL_RESTORE_ERROR_SOURCE_FILES.includes(errorSourceFile)?errorSourceFile:null;
  this.errorTopics=Object.freeze(INITIAL_RESTORE_ERROR_TOPICS.filter(topic=>Array.isArray(errorTopics)&&errorTopics.includes(topic)).slice(0,16));
  this.restoreSection=INITIAL_RESTORE_SECTIONS.includes(restoreSection)?restoreSection:null;
  this.catalogMismatches=publicCatalogDiagnostics(catalogMismatches);
  this.definitionDiagnostics=publicRestoreDefinitionDiagnostics(definitionDiagnostics);
  this.deparseAlignment=publicDeparseAlignment(deparseAlignment);
 }
}
const SQLSTATE_KINDS=Object.freeze({'01000':'WARNING','01006':'WARNING','01007':'WARNING','42501':'PERMISSION','42P01':'MISSING','3F000':'MISSING','42704':'MISSING','42883':'MISSING','3D000':'MISSING','42601':'SYNTAX','42P17':'SYNTAX','42710':'ALREADY_EXISTS','42P06':'ALREADY_EXISTS','42P07':'ALREADY_EXISTS','23505':'CONFLICT','23502':'CONFLICT','23503':'CONFLICT','23514':'CONFLICT','55006':'CONFLICT','57014':'TIMEOUT','55P03':'TIMEOUT','0A000':'UNSUPPORTED','55000':'UNSUPPORTED','22023':'UNSUPPORTED','XX000':'PROCESS_FAILURE','53100':'PROCESS_FAILURE','53200':'PROCESS_FAILURE','53300':'PROCESS_FAILURE','57P01':'PROCESS_FAILURE','08006':'PROCESS_FAILURE'});
const ERROR_KINDS=Object.freeze([...new Set(Object.values(SQLSTATE_KINDS)),'WARNING','PROCESS_FAILURE']);
// Only finite classifications leave this module. Raw process text, source SQL,
// provider identifiers and data remain private even on failure.
function processDiagnostic(result,privateServerLog=''){
 const diagnostic=typeof result?.stderr==='string'?result.stderr:'';
 // The last server error is parsed in private memory; never project the line,
 // location, statement, detail, context, role, PID or object identifiers.
 const serverError=[...privateServerLog.matchAll(/^(?:[^\n]*?\s)?(?:ERROR|FATAL|WARNING):\s+([0-9A-Z]{5}):[^\n]*$/gm)].at(-1);
 // Fixed upstream source-file names identify only a software component. No
 // arbitrary routine, source path or database object is exported.
 const location=serverError?privateServerLog.slice(serverError.index+serverError[0].length,serverError.index+serverError[0].length+16384)
  .match(/^.*LOCATION:\s+[^,\n]+,\s+(?:[^\s,\n]*\/)?([A-Za-z0-9_]+\.(?:c|rs)):[0-9]+\s*$/m)?.[1]:null;
 const originFiles={POSTGRES_CORE:['aclchk.c','objectaddress.c','tablecmds.c','extension.c','namespace.c','guc.c','guc_funcs.c','miscinit.c','postinit.c','postgres.c','postmaster.c','shmem.c','dsm.c','fd.c','syslogger.c','catcache.c','syscache.c','lsyscache.c','copyfrom.c','copyto.c','pg_shdepend.c','pg_depend.c','utility.c','funcapi.c','fmgr.c','dfmgr.c'],
  PLPGSQL:['pl_exec.c','pl_comp.c','pl_handler.c'],PG_NET:['pg_net.c'],PGSODIUM:['pgsodium.c'],SUPABASE_VAULT:['vault.c'],SUPAUTILS:['supautils.c'],PG_CRON:['pg_cron.c','job_metadata.c'],PG_TLE:['pg_tle.c'],PG_STAT_STATEMENTS:['pg_stat_statements.c'],PGAUDIT:['pgaudit.c'],PLPGSQL_CHECK:['plpgsql_check.c'],PGRX:['elog.rs','ffi.rs','panic.rs']};
 const errorOrigin=Object.entries(originFiles).find(([,files])=>files.includes(location))?.[0]
  ??(PG17_PUBLIC_CORE_SOURCE_FILES.includes(location)&&!['worker.c','core.c','utils.c'].includes(location)?'POSTGRES_CORE':null);
 const errorSourceFile=INITIAL_RESTORE_ERROR_SOURCE_FILES.includes(location)?location:null;
 const errorTopics=INITIAL_RESTORE_ERROR_TOPICS.filter(topic=>new RegExp('\\b'+topic+'(?:s|ed|ing)?\\b','i').test(serverError?.[0]??'')).slice(0,16);
 const classified=diagnostic+'\n'+(serverError?.[0]??'');
 const known=[
  ['EXTENSION_VERSION_UNAVAILABLE','UNSUPPORTED',/has no installation script nor update path for version|extension .* version .* (?:not installed|not available)/i],
  ['EXTENSION_NOT_AVAILABLE','MISSING',/extension .* is not available|could not open extension control file/i],
  ['EXTENSION_LIBRARY_MISSING','MISSING',/could not (?:access|load|open) (?:file|library) ["'][^"'\n]*(?:\$libdir|\.so)|could not find function .* in file/i],
  ['EXTENSION_MUST_BE_PRELOADED','UNSUPPORTED',/must be (?:loaded|preloaded).*(?:shared_preload_libraries|server start)/i],
  ['BACKGROUND_WORKER_REGISTRATION_FAILED','UNSUPPORTED',/could not register.*background worker|could not restart.*(?:pg_net|background worker)|failed to restart pg_net worker/i],
  ['SERVER_KEY_UNAVAILABLE','UNSUPPORTED',/invalid secret key|(?:getkey|key acquisition).*(?:failed|not found|does not exist)|could not read.*(?:secret|root) key/i],
  ['CATALOG_LOOKUP_FAILED','PROCESS_FAILURE',/cache lookup failed|could not find tuple/i],
  ['EVENT_TRIGGER_OWNER_MISMATCH','PERMISSION',/(?:non-superuser|superuser) owned event trigger must execute a (?:non-superuser|superuser) owned function/i],
  ['READ_ONLY_TRANSACTION','PERMISSION',/cannot execute .* in a read-only transaction/i],
  ['ARCHIVE_TRUNCATED','PROCESS_FAILURE',/could not read from input file.*end of file|unexpected end of file|input file is too short|did not find magic string/i],
  ['ARCHIVE_VERSION_UNSUPPORTED','UNSUPPORTED',/unsupported version .* in file header/i],
  ['ARCHIVE_COMPRESSION_UNSUPPORTED','UNSUPPORTED',/unsupported compression|compression method .* not supported/i],
  ['SERVER_DISCONNECTED','PROCESS_FAILURE',/server closed the connection|connection to server .* failed|could not receive data from server/i],
  ['OUT_OF_MEMORY','PROCESS_FAILURE',/out of memory|cannot allocate memory/i],
  ['DISK_FULL','PROCESS_FAILURE',/no space left on device|disk full/i],
  ['GLOBAL_SETTING_UNSUPPORTED','UNSUPPORTED',/unrecognized configuration parameter|invalid value for parameter/i],
  ['STATEMENT_TIMEOUT','TIMEOUT',/statement timeout|lock timeout|timed out/i],
  ['ROW_CONSTRAINT_VIOLATION','CONFLICT',/violates .* constraint|duplicate key value/i],
  ['SCHEMA_REQUIRED','MISSING',/no schema has been selected to create in/i],
 ].find(([, ,pattern])=>pattern.test(classified));
 const tocHeader=[...diagnostic.matchAll(/from TOC entry [0-9]+; [0-9]+ [0-9]+ ([^\n]*)/g)].at(-1)?.[1];
 const tocType=[...INITIAL_RESTORE_TOC_TYPES].sort((a,b)=>b.length-a.length).find(type=>tocHeader===type||tocHeader?.startsWith(type+' '))??null;
 const candidate=serverError?.[1]??diagnostic.match(/(?:ERROR|FATAL|PANIC|WARNING):\s+([0-9A-Z]{5})(?:\s|:|$)/)?.[1];
 const details={tocType,errorOrigin,errorSourceFile,errorTopics,errorReason:known?.[0]??(serverError&&Object.hasOwn(SQLSTATE_KINDS,candidate)?'SERVER_SQLSTATE_REPORTED':'UNKNOWN_PROCESS_FAILURE'),exitStatus:result?.status,processFailed:Boolean(result?.error)};
 if(Object.hasOwn(SQLSTATE_KINDS,candidate))return {...details,sqlstate:candidate,errorKind:SQLSTATE_KINDS[candidate]};
 const errorKind=[['PERMISSION',/permission denied|must be owner|must be superuser|only superusers/i],
  ['MISSING',/does not exist|could not find|no such file/i],['SYNTAX',/syntax error/i],
  ['ALREADY_EXISTS',/already exists/i],['TIMEOUT',/statement timeout|lock timeout|timed out/i],
  ['WARNING',/(?:WARNING|NOTICE):/]].find(([,pattern])=>pattern.test(classified))?.[0]??'PROCESS_FAILURE';
 return {...details,sqlstate:null,errorKind:known?.[1]??errorKind};
}
const need=(condition,code)=>{if(!condition)throw new InitialRestoreError(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const ident=value=>{need(typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=63&&!value.includes('\0'),'RESTORE_IDENTIFIER_UNKNOWN');return '"'+value.replaceAll('"','""')+'"';};
const literal=value=>{need(typeof value==='string'&&!value.includes('\0'),'RESTORE_VALUE_UNKNOWN');return "'"+value.replaceAll("'","''")+"'";};
const table=(schema,name)=>ident(schema)+'.'+ident(name);
const equal=isDeepStrictEqual;
const ENV={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'};
const SOCKETS={LOCAL:'unix:///run/user/1001/docker.sock',HOSTED:'unix:///var/run/docker.sock'};
const absent=(result,reference)=>result?.status===1&&result.stdout?.trim()===''
 &&new RegExp('^(?:Error:|Error response from daemon:) No such (?:object|container): '+reference+'$','i').test(result.stderr?.trim()??'');
const INSPECT='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"config_image":{{json .Config.Image}},"user":{{json .Config.User}},"label":{{json (index .Config.Labels "cluvo.staging.initial-restore")}},"network":{{json .HostConfig.NetworkMode}},"ports":{{json .HostConfig.PortBindings}},"binds":{{json .HostConfig.Binds}},"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}},"volumes_from":{{json .HostConfig.VolumesFrom}},"privileged":{{json .HostConfig.Privileged}},"log":{{json .HostConfig.LogConfig.Type}},"restart":{{json .HostConfig.RestartPolicy.Name}},"entrypoint":{{json .Config.Entrypoint}},"arguments":{{json .Config.Cmd}},"state":{{json .State.Status}}}';
// Adapted from the frozen, executed local restore experiment. Bypass the image's
// Supabase bootstrap; no network, schedulers or provider services are started.
export const INITIAL_RESTORE_STARTUP=String.raw`set -eu
umask 077
initdb -D /restore/pgdata -U "$1" --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=en_US.UTF-8 --locale-provider=icu --icu-locale=en-US >/restore/initdb.private.log 2>&1
printf "include = '/etc/postgresql-custom/supautils.conf'\n" >>/restore/pgdata/postgresql.conf
exec postgres -D /restore/pgdata -c listen_addresses='' -c unix_socket_directories=/restore -c unix_socket_permissions=0700 -c port=5432 -c max_worker_processes=0 -c max_parallel_workers=0 -c max_parallel_workers_per_gather=0 -c max_logical_replication_workers=0 -c autovacuum=off -c cron.launch_active_jobs=off -c shared_preload_libraries='pg_stat_statements,pgaudit,plpgsql,plpgsql_check,pg_cron,pg_net,pgsodium,auto_explain,pg_tle,plan_filter,supabase_vault' -c session_preload_libraries=supautils -c pgsodium.getkey_script=/usr/lib/postgresql/bin/pgsodium_getkey.sh -c vault.getkey_script=/usr/lib/postgresql/bin/pgsodium_getkey.sh -c logging_collector=off -c log_error_verbosity=verbose -c log_statement=none -c log_min_duration_statement=-1 -c log_min_error_statement=panic -c log_connections=off -c log_disconnections=off -c pgaudit.log=none -c auto_explain.log_min_duration=-1 -c log_parameter_max_length=0 -c log_parameter_max_length_on_error=0 -c archive_mode=off -c ssl=off >/restore/postgres.private.log 2>&1`;

async function privateFile(directory,name,maximum){
 const metadata=await lstat(join(directory,name));
 need(metadata.isFile()&&!metadata.isSymbolicLink()&&metadata.nlink===1&&metadata.uid===process.getuid()
  &&(metadata.mode&0o777)===0o600&&metadata.size>0&&metadata.size<=maximum,'RESTORE_PRIVATE_FILE_REQUIRED');
 const descriptor=await open(join(directory,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const before=await descriptor.stat();need(before.isFile()&&before.nlink===1&&before.ino===metadata.ino&&before.dev===metadata.dev,'RESTORE_PRIVATE_FILE_CHANGED');
  const bytes=await descriptor.readFile();const after=await descriptor.stat(),pathAfter=await lstat(join(directory,name));
  need(bytes.length===metadata.size&&metadata.ino===after.ino&&metadata.dev===after.dev
   &&metadata.mtimeMs===after.mtimeMs&&metadata.ctimeMs===after.ctimeMs
   &&pathAfter.ino===after.ino&&pathAfter.dev===after.dev,'RESTORE_PRIVATE_FILE_CHANGED');return bytes;
 }finally{await descriptor.close();}
}

function initialReceipt(original,bootstrapRole,scope){
 need(original&&original.format==='cluvo-staging-private-snapshot'&&original.schema_version===2
  &&original.environment==='staging'&&original.project_ref==='fbozlbgmktkgcdfqdaaz'
  &&original.logical_capture_metadata_complete===true
  &&Number.isSafeInteger(original.source_history?.applied_prefix)
  &&original.source_history.applied_prefix>=0&&original.source_history.applied_prefix<=UPGRADE_FILES.length
  &&original.source_history.original_source_bytes_proven===true
  &&original.dataset_inventory?.key_dependent_data==='proven_empty'
  &&original.dataset_inventory?.count_snapshot_consistent===true&&original.dataset_inventory?.storage_objects===0
  &&Array.isArray(original.large_objects)&&original.large_objects.length===0
  &&Object.keys(original.catalog??{}).length===28&&Array.isArray(original.data)&&Array.isArray(original.sequences)
  &&original.capability?.server_version===170011&&original.capability.bootstrap_anchor_superuser===true
  &&original.capability.role_superuser===false&&original.capability.role_bypassrls===true
  &&Object.values(original.configuration_safety??{}).length===6
  &&Object.values(original.configuration_safety).every(value=>value===0),'INITIAL_RESTORE_SCOPE_UNSUPPORTED');
 need(SOCKETS[scope]&&/^[a-z_][a-z0-9_]{0,62}$/.test(bootstrapRole??'')&&bootstrapRole!=='postgres'
  &&original.catalog.roles.some(role=>role.name===bootstrapRole&&role.superuser===true)
  &&original.catalog.roles.some(role=>role.name==='postgres'&&role.superuser===false)
  &&(original.source_history.applied_prefix>0||original.catalog.relations.every(relation=>relation.schema!=='app')), 'INITIAL_RESTORE_ROLE_PROFILE_UNSUPPORTED');
 if(scope==='HOSTED')need(original.source_scope==='HOSTED_VERIFY_FULL'&&original.hosted_source_verified===true,'INITIAL_RESTORE_SOURCE_UNPROVED');
 for(const row of original.data)need(['r','m'].includes(row.kind)&&Number.isSafeInteger(row.rows)&&row.rows>=0
  &&/^[0-9a-f]{64}$/.test(row.sha256),'INITIAL_RESTORE_DATA_UNKNOWN');
 for(const file of UPGRADE_FILES)need(original.source_files?.some(value=>value.file===file.file&&value.sha256===file.sha256),'INITIAL_RESTORE_SOURCE_FILES_CHANGED');
}

async function defaultRun(args,input,maximum=8_000_000,timeout=30_000){
 return await executeDatabaseProcess('/usr/bin/docker',args,{env:ENV,input,timeout,maxBuffer:maximum});
}

export async function restoreInitialBackup({directory,original,bootstrapRole,executionScope='LOCAL',sourceDeparseContext=null},{run=defaultRun}={}){
 // This component never converts supplied JSON booleans into hosted authority.
 // The release orchestrator must retain the concrete collector/bridge receipt.
 try{original=structuredClone(original);}catch{throw new InitialRestoreError('INITIAL_RESTORE_SCOPE_UNSUPPORTED');}
 initialReceipt(original,bootstrapRole,executionScope);
 let deparseSQL='';
 if(sourceDeparseContext!==null){
  try{deparseSQL=cloneDeparseSettingsSQL(sourceDeparseContext);}
  catch{throw new InitialRestoreError('RESTORE_DEPARSE_PROFILE_UNSUPPORTED');}
 }
 need(typeof directory==='string'&&isAbsolute(directory),'RESTORE_PRIVATE_DIRECTORY_REQUIRED');
 const metadata=await lstat(directory);
 need(metadata.isDirectory()&&!metadata.isSymbolicLink()&&metadata.uid===process.getuid()
  &&(metadata.mode&0o777)===0o700,'RESTORE_PRIVATE_DIRECTORY_REQUIRED');
 let dump,globals;const files=[];
 try{
  const inputs=await Promise.allSettled([privateFile(directory,'database.dump',64*1024*1024),privateFile(directory,'globals.sql',8*1024*1024)]);
  if(inputs[0].status==='fulfilled')dump=inputs[0].value;if(inputs[1].status==='fulfilled')globals=inputs[1].value;
  need(dump&&globals,'RESTORE_INPUT_UNAVAILABLE');
  need(dump.subarray(0,5).toString('ascii')==='PGDMP','RESTORE_ARCHIVE_REQUIRED');
  for(const file of UPGRADE_FILES){const bytes=await readFile(new URL('../supabase/migrations/'+file.file,import.meta.url));need(hash(bytes)===file.sha256,'IMMUTABLE16_SOURCE_BYTES_CHANGED');files.push({file,bytes});}
 }catch(error){dump?.fill(0);globals?.fill(0);throw error instanceof InitialRestoreError?error:new InitialRestoreError('RESTORE_INPUT_UNAVAILABLE');}
 let phase='input',restoreSection=null,extensionPrivilegeWarnings=0,deparseAlignment=null;
 const name='cluvo-pwa-upgrade-restore-'+randomBytes(16).toString('hex'),socket=SOCKETS[executionScope];
 const command=async(args,input,maximum,timeout)=>{
  let result;try{result=await run(['--host',socket,...args],input,maximum,timeout);}catch{throw new InitialRestoreError('RESTORE_PROCESS_UNAVAILABLE',{phase,errorKind:'PROCESS_FAILURE'});}
  // PostgreSQL's finite privilege warnings can accompany successful extension
  // creation. Retain their count; they never waive the subsequent exact owner,
  // ACL and complete catalog comparison. All other stderr still refuses.
  if(phase==='extension_owners'&&args.includes('psql')&&result?.status===0&&!result.error
   &&typeof result.stderr==='string'&&Buffer.byteLength(result.stderr)<=4096&&result.stderr.trim()){
   const warnings=result.stderr.trim().split('\n');
   if(warnings.length<=32&&warnings.every(line=>/^WARNING:\s+(?:01006|01007)\s*$/.test(line))){extensionPrivilegeWarnings+=warnings.length;return result.stdout;}
  }
  if(!(result&&result.status===0&&result.stderr===''&&!result.error)){
   let privateServerLog='';
   if(((phase==='restore'&&args.includes('pg_restore'))||(phase==='extension_owners'&&args.includes('psql')))&&id){
    // Inspect the complete fixed ownership/isolation contract before any
    // follow-up exec. Diagnostic failure never replaces the original error.
    try{
     const current=await inspect(id);ownership(current);isolated(current);need(current.state==='running','RESTORE_CLONE_NOT_RUNNING');
     const log=await run(['--host',socket,'exec',id,'tail','-c','524288','/restore/postgres.private.log'],undefined,600000,5000);
     if(log?.status===0&&!log.error&&log.stderr===''&&typeof log.stdout==='string'&&Buffer.byteLength(log.stdout)<=524288)privateServerLog=log.stdout;
    }catch{ /* Only the already-proven clone may provide private diagnostics. */ }
   }
   throw new InitialRestoreError('RESTORE_PROCESS_FAILED',{phase,restoreSection,...processDiagnostic(result,privateServerLog)});
  }
  return result.stdout;
 };
 const jsonCommand=async args=>{try{return JSON.parse(await command(args,undefined,200000,20000));}catch(error){throw error instanceof InitialRestoreError?error:new InitialRestoreError('RESTORE_CONTROL_RESPONSE_UNKNOWN');}};
 let id,imageId,created=false,cleanupFailed=false,cleanupDiagnostic={},primary=null,report;
 const arguments_=['-c',INITIAL_RESTORE_STARTUP,'cluvo-initial-restore',bootstrapRole];
 const ownership=value=>{
  need(value&&/^[0-9a-f]{64}$/.test(value.id??'')&&value.name==='/'+name&&value.image===imageId
   &&value.config_image===IMAGE&&value.label===name&&value.user==='postgres'&&(!id||value.id===id),'RESTORE_CLONE_OWNERSHIP_UNKNOWN');return value.id;
 };
 const isolated=value=>need(value.network==='none'&&(!value.ports||Object.keys(value.ports).length===0)
  &&!value.binds&&!value.volumes_from&&!value.privileged&&value.log==='none'&&value.restart==='no'
  &&equal(value.entrypoint,['/bin/sh'])&&equal(value.arguments,arguments_)
  &&equal(value.tmpfs,{'/restore':'rw,size=512m,mode=1777'})
  &&Array.isArray(value.mounts)&&value.mounts.every(mount=>mount.Type==='tmpfs'&&mount.Destination==='/restore'), 'RESTORE_CLONE_ISOLATION_UNKNOWN');
 const inspect=reference=>jsonCommand(['inspect',reference,'--format',INSPECT]);
 const sqlArgs=(role,extensionInstaller=false)=>['exec',...(extensionInstaller?['--env','PGOPTIONS=-c session_preload_libraries=']:[]),'-i',id,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U',role,'-d','postgres'];
 const sql=async(query,role=bootstrapRole,extensionInstaller=false,unaligned=false)=>await command(sqlArgs(role,extensionInstaller),Buffer.from("SET client_min_messages=warning;\nSET search_path TO '';\n"+(unaligned?'':deparseSQL)+query.replace(/;?\s*$/,';\n')),8_000_000,120000);
 const jsonSql=async(query,role=bootstrapRole)=>{try{return JSON.parse((await sql(query,role)).trim());}catch(error){throw error instanceof InitialRestoreError?error:new InitialRestoreError('RESTORE_SQL_RESPONSE_UNKNOWN');}};
 const checkJobs=async()=>{
  phase='jobs';
  const state=await jsonSql("SELECT jsonb_build_object('version',current_setting('server_version_num')::int,'workers',current_setting('max_worker_processes')::int,'cron_disabled',current_setting('cron.launch_active_jobs')='off','listen_disabled',current_setting('listen_addresses')='','unexpected_workers',(SELECT count(*) FROM pg_stat_activity WHERE backend_type NOT IN ('client backend','checkpointer','background writer','walwriter')));");
  need(equal(state,{version:170011,workers:0,cron_disabled:true,listen_disabled:true,unexpected_workers:0}),'RESTORE_CLONE_JOB_SUPPRESSION_UNPROVED');
 };
 try{
  phase='image';
  const image=await jsonCommand(['image','inspect',IMAGE,'--format','{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']);
  need(/^sha256:[0-9a-f]{64}$/.test(image.id??'')&&image.digests?.includes(IMAGE),'RESTORE_IMAGE_PIN_UNPROVED');imageId=image.id;
  phase='create';const unused=await run(['--host',socket,'inspect',name,'--format','{{.Id}}'],undefined,200000,20000);
  need(absent(unused,name),'RESTORE_CLONE_NAME_NOT_PROVEN_UNUSED');
  created=true;
  id=(await command(['create','--pull=never','--name',name,'--label','cluvo.staging.initial-restore='+name,
   '--network=none','--restart=no','--log-driver=none','--no-healthcheck','--user=postgres',
   '--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=1g','--memory-swap=1g',
   '--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint=/bin/sh',IMAGE,...arguments_],undefined,200000,20000)).trim();
  need(/^[0-9a-f]{64}$/.test(id),'RESTORE_CREATE_FAILED');
  const before=await inspect(id);ownership(before);isolated(before);need(before.state==='created','RESTORE_CLONE_STARTED_EARLY');
  phase='start';await command(['start',id],undefined,200000,20000);
  phase='ready';
  let ready=false;const readinessDeadline=Date.now()+50000;
  while(Date.now()<readinessDeadline){
   const probe=await run(['--host',socket,'exec',id,'pg_isready','-h','/restore','-U',bootstrapRole,'-d','postgres'],undefined,200000,5000);
   if(probe.status===0&&probe.stderr===''){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  need(ready,'RESTORE_CLONE_NOT_READY');const running=await inspect(id);ownership(running);isolated(running);need(running.state==='running','RESTORE_CLONE_NOT_RUNNING');
  await checkJobs();
  // initdb already creates precisely the source OID10 bootstrap role. Keep the
  // authenticated original globals unchanged; remove only that one CREATE in
  // the ephemeral replay stream, retaining ALTERs, memberships and grantors.
  phase='globals';
  const declaration='CREATE ROLE '+ident(bootstrapRole)+';';
  const lines=globals.toString('utf8').split(/(?<=\n)/);
  need(lines.filter(line=>line.trim()===declaration).length===1,'RESTORE_BOOTSTRAP_CREATE_NOT_UNIQUE');
  await command(sqlArgs(bootstrapRole),Buffer.from('SET client_min_messages=warning;\n'+lines.filter(line=>line.trim()!==declaration).join('')),8_000_000,120000);
  const restore=async(section,list)=>{
   phase='restore';restoreSection=section;
   await command(['exec','-i',id,'pg_restore','--exit-on-error','--single-transaction','--section='+section,
    ...(list?['--use-list=/restore/'+list+'.toc']:[]),...(section==='post-data'?['--use-set-session-authorization']:[]),'--no-password','-h','/restore','-U',bootstrapRole,'-d','postgres'],dump,8_000_000,180000);
   restoreSection=null;
  };
  phase='restore_toc';
  let lists;try{lists=schemaFirstRestoreLists(await command(['exec','-i',id,'pg_restore','--list'],dump,8_000_000,30000));}catch(error){throw error instanceof InitialRestoreError?error:new InitialRestoreError('RESTORE_TOC_UNKNOWN');}
  for(const key of ['schemas','remaining'])await command(['exec','-i',id,'/bin/sh','-c','umask 077; cat > /restore/'+key+'.toc'],Buffer.from(lists[key]),200000,10000);
  await restore('pre-data','schemas');
  phase='database';
  const database=original.catalog.database[0];
  need(database?.allow_connections===true&&database.is_template===false&&database.locale_provider==='i'
   &&database.locale==='en-US'&&database.encoding==='UTF8'
   &&Number.isInteger(database.connection_limit)&&database.connection_limit>=-1,'RESTORE_DATABASE_PROFILE_UNSUPPORTED');
  await sql('ALTER DATABASE postgres OWNER TO '+ident(database.owner)+'; ALTER DATABASE postgres CONNECTION LIMIT '+Number(database.connection_limit)+';');
  phase='role_settings';let replay='';
  for(const setting of original.catalog.role_database_settings){if(setting.database!=='postgres')continue;
   for(const configuration of setting.config??[]){const separator=configuration.indexOf('='),key=configuration.slice(0,separator),value=configuration.slice(separator+1);need(separator>0&&/^[a-z_][a-z0-9_.]*$/.test(key),'RESTORE_DATABASE_SETTING_UNKNOWN');replay+=(setting.role==='*'?'ALTER DATABASE postgres':'ALTER ROLE '+ident(setting.role)+' IN DATABASE postgres')+' SET '+key+' TO '+literal(value)+';';}}
  if(replay)await sql(replay);
  phase='database_acl';const currentDatabase=(await jsonSql(aggregate(CATALOG_QUERIES.database)))[0];
  if(!equal(currentDatabase.acl,database.acl)){
   replay='';for(const role of new Set([...currentDatabase.acl,...database.acl].map(grant=>grant[1])))replay+='REVOKE ALL ON DATABASE postgres FROM '+(role==='PUBLIC'?'PUBLIC':ident(role))+';';
   for(const [grantor,grantee,privilege,grantable]of database.acl){need(['CREATE','CONNECT','TEMPORARY'].includes(privilege),'RESTORE_DATABASE_GRANT_UNKNOWN');replay+='SET SESSION AUTHORIZATION '+ident(grantor)+';GRANT '+privilege+' ON DATABASE postgres TO '+(grantee==='PUBLIC'?'PUBLIC':ident(grantee))+(grantable?' WITH GRANT OPTION':'')+';RESET SESSION AUTHORIZATION;';}await sql(replay);
  }
  // Native dumps intentionally use CREATE EXTENSION IF NOT EXISTS and do not
  // retain extension owners or versions. Preinstall under the captured owner
  // and exact version, then replay every original archive entry unchanged.
  phase='schema_acl';const earlySchemas=await jsonSql(aggregate(CATALOG_QUERIES.schemas));replay='';
  for(const actual of earlySchemas){const expected=original.catalog.schemas.find(schema=>schema.name===actual.name);
   need(expected&&actual.owner===expected.owner,'RESTORE_SCHEMA_PRIVILEGES_CHANGED');
   if(equal(actual.acl,expected.acl))continue;
   for(const role of new Set([...actual.acl,...expected.acl].map(grant=>grant[1])))replay+='REVOKE ALL ON SCHEMA '+ident(expected.name)+' FROM '+(role==='PUBLIC'?'PUBLIC':ident(role))+';';
   for(const [grantor,grantee,privilege,grantable]of expected.acl){need(['USAGE','CREATE'].includes(privilege),'RESTORE_SCHEMA_GRANT_UNKNOWN');replay+='SET SESSION AUTHORIZATION '+ident(grantor)+';GRANT '+privilege+' ON SCHEMA '+ident(expected.name)+' TO '+(grantee==='PUBLIC'?'PUBLIC':ident(grantee))+(grantable?' WITH GRANT OPTION':'')+';RESET SESSION AUTHORIZATION;';}
  }
  if(replay)await sql(replay);
  phase='extension_owners';const installed=await jsonSql(aggregate(CATALOG_QUERIES.extensions));let extensionsPrecreated=0,extensionOwnerReassignments=0;
  need(installed.every(extension=>original.catalog.extensions.some(expected=>equal(extension,expected))),'RESTORE_EXISTING_EXTENSION_CHANGED');
  for(const extension of original.catalog.extensions){if(installed.some(actual=>actual.name===extension.name))continue;
   const owner=original.catalog.roles.find(role=>role.name===extension.owner);
   need(owner&&typeof extension.version==='string','RESTORE_EXTENSION_OWNER_UNKNOWN');
   const available=await jsonSql("SELECT jsonb_build_object('available',EXISTS(SELECT 1 FROM pg_available_extension_versions WHERE name="+literal(extension.name)+" AND version="+literal(extension.version)+"));");
   need(available.available===true,'RESTORE_EXTENSION_VERSION_UNAVAILABLE');
   // Only this new isolated extension-install session omits Supautils. A
   // private temporary superuser owns precisely this extension's new objects;
   // standard REASSIGN OWNED preserves dependencies and ACL owner identities.
   // Source roles, all native archive SQL and normal clone sessions retain
   // their original privileges and Supautils event-trigger enforcement.
   const installer='cluvo_restore_ext_'+randomBytes(12).toString('hex');
   need(!original.catalog.roles.some(role=>role.name===installer),'RESTORE_INSTALLER_ROLE_COLLISION');
   await sql('CREATE ROLE '+ident(installer)+' WITH LOGIN SUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;');
   let installerState;try{installerState=JSON.parse((await sql("SELECT jsonb_build_object('superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'self',current_user="+literal(installer)+",'supautils_omitted',current_setting('session_preload_libraries')='');",installer,true)).trim());}catch(error){throw error instanceof InitialRestoreError?error:new InitialRestoreError('RESTORE_INSTALLER_SESSION_UNPROVED');}
   need(equal(installerState,{superuser:true,self:true,supautils_omitted:true}),'RESTORE_INSTALLER_SESSION_UNPROVED');
   await sql('CREATE EXTENSION '+ident(extension.name)+' WITH SCHEMA '+ident(extension.schema)+' VERSION '+literal(extension.version)+';',installer,true);extensionsPrecreated++;
   await sql('REASSIGN OWNED BY '+ident(installer)+' TO '+ident(extension.owner)+';DROP ROLE '+ident(installer)+';');extensionOwnerReassignments++;
   const removed=await jsonSql("SELECT jsonb_build_object('absent',NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname="+literal(installer)+"));");
   need(removed.absent===true,'RESTORE_INSTALLER_REMOVAL_UNPROVED');
   const observed=await jsonSql(aggregate(CATALOG_QUERIES.extensions));
   if(!observed.some(actual=>equal(actual,extension)))throw new InitialRestoreError('RESTORE_EXTENSION_METADATA_UNPROVED',{phase,catalogMismatches:[catalogMismatchDiagnostic('extensions',[extension],observed.filter(actual=>actual.name===extension.name))]});
  }
  await restore('pre-data','remaining');await restore('data');
  const restoreSchemaPrivileges=async()=>{
   phase='schema_acl';const schemas=await jsonSql(aggregate(CATALOG_QUERIES.schemas));
   need(schemas.length===original.catalog.schemas.length,'RESTORE_SCHEMA_SET_CHANGED');let replay='';
   for(const expected of original.catalog.schemas){const actual=schemas.find(schema=>schema.name===expected.name);need(actual,'RESTORE_SCHEMA_SET_CHANGED');
    if(actual.owner===expected.owner&&equal(actual.acl,expected.acl))continue;
    if(actual.owner!==expected.owner)replay+='ALTER SCHEMA '+ident(expected.name)+' OWNER TO '+ident(expected.owner)+';';
    for(const role of new Set([...actual.acl,...expected.acl].map(grant=>grant[1])))replay+='REVOKE ALL ON SCHEMA '+ident(expected.name)+' FROM '+(role==='PUBLIC'?'PUBLIC':ident(role))+';';
    for(const [grantor,grantee,privilege,grantable]of expected.acl){need(['USAGE','CREATE'].includes(privilege),'RESTORE_SCHEMA_GRANT_UNKNOWN');replay+='SET SESSION AUTHORIZATION '+ident(grantor)+';GRANT '+privilege+' ON SCHEMA '+ident(expected.name)+' TO '+(grantee==='PUBLIC'?'PUBLIC':ident(grantee))+(grantable?' WITH GRANT OPTION':'')+';RESET SESSION AUTHORIZATION;';}
   }
   if(replay)await sql(replay);
  };
  await restoreSchemaPrivileges();
  // Restoring bound policies/foreign keys as their original owner reparses
  // cross-schema references. Provider owners may lack current namespace USAGE
  // even though the source's already-bound objects remain valid. Give only
  // source object owners temporary USAGE in this isolated clone, then restore
  // every captured schema owner/ACL before any catalog or data attestation.
  const objectOwners=new Set(['relations','functions','types'].flatMap(family=>original.catalog[family].map(object=>object.owner)));
  let temporarySchemaUsageGrants=0,temporaryReferenceGrants=0;replay='';
  for(const owner of objectOwners){
   const role=original.catalog.roles.find(role=>role.name===owner);
   need(role,'RESTORE_OBJECT_OWNER_UNKNOWN');if(role.superuser)continue;
   for(const schema of original.catalog.schemas){
    replay+='GRANT USAGE ON SCHEMA '+ident(schema.name)+' TO '+ident(owner)+';';temporarySchemaUsageGrants++;
   }
   // Existing foreign keys remain bound after a provider changes table ACLs.
   // Recreating them additionally requires REFERENCES on the target tables.
   for(const relation of original.catalog.relations.filter(relation=>['r','p'].includes(relation.kind))){
    replay+='GRANT REFERENCES ON TABLE '+table(relation.schema,relation.name)+' TO '+ident(owner)+';';temporaryReferenceGrants++;
   }
  }
  if(replay)await sql(replay);
  await restore('post-data');
  await restoreSchemaPrivileges();
  // Native extension ACL deltas are based on installation privileges. After
  // ownership reassignment, replay the captured effective ACLs exactly; never
  // waive the complete catalog comparison that follows.
  let aclObjectsReplayed=0;
  // A table-level REVOKE also clears column grants. Replay columns after the
  // table ACLs, retaining every captured column grantor and grant option.
  for(const family of ['relations','functions','types','columns']){
   phase='catalog.'+family;const actualRows=await jsonSql(aggregate(CATALOG_QUERIES[family]));replay='';
   for(const expected of original.catalog[family]){
    const actual=actualRows.find(row=>row.schema===expected.schema&&row.name===expected.name
     &&(family!=='functions'||(row.arguments===expected.arguments&&row.kind===expected.kind))
     &&(family!=='columns'||row.relation===expected.relation));
    if(!actual||equal(actual.acl,expected.acl))continue;
    const {acl:expectedAcl,...expectedDefinition}=expected,{acl:actualAcl,...actualDefinition}=actual;
    if(!equal(expectedDefinition,actualDefinition))continue;
    const object=family==='relations'?(expected.kind==='S'?'SEQUENCE ':'TABLE ')+table(expected.schema,expected.name)
     :family==='functions'?'ROUTINE '+table(expected.schema,expected.name)+'('+expected.arguments+')'
     :family==='columns'?'TABLE '+table(expected.schema,expected.relation)
     :'TYPE '+table(expected.schema,expected.name);
    const allowed=family==='relations'?(expected.kind==='S'?['USAGE','SELECT','UPDATE']:['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
     :family==='functions'?['EXECUTE']:family==='columns'?['SELECT','INSERT','UPDATE','REFERENCES']:['USAGE'];
    const column=family==='columns'?' ('+ident(expected.name)+')':'';
    for(const role of new Set([...actualAcl,...expectedAcl].map(grant=>grant[1])))replay+='REVOKE ALL'+column+' ON '+object+' FROM '+(role==='PUBLIC'?'PUBLIC':ident(role))+';';
    for(const [grantor,grantee,privilege,grantable]of expectedAcl){need(allowed.includes(privilege),'RESTORE_OBJECT_GRANT_UNKNOWN');replay+='SET SESSION AUTHORIZATION '+ident(grantor)+';GRANT '+privilege+column+' ON '+object+' TO '+(grantee==='PUBLIC'?'PUBLIC':ident(grantee))+(grantable?' WITH GRANT OPTION':'')+';RESET SESSION AUTHORIZATION;';}
    aclObjectsReplayed++;
   }
   if(replay)await sql(replay);
  }
  // Temporal/float deparsing and JSON row serialization depend on native GUCs.
  // Match only the proven fixed source profile in this owned clone's transient
  // control sessions. Source, archive processes and captured role settings
  // remain unchanged. No DDL is normalized or excluded from the exact gate.
  let restoredDeparseContext=null;
  if(sourceDeparseContext!==null){
   phase='catalog.constraints';
   const beforeContext=publicDeparseContext(JSON.parse((await sql(PWA_DEPARSE_CONTEXT_SQL,bootstrapRole,false,true)).trim()));
   const beforeConstraints=JSON.parse((await sql(aggregate(CATALOG_QUERIES.constraints),bootstrapRole,false,true)).trim());
   restoredDeparseContext=publicDeparseContext(await jsonSql(PWA_DEPARSE_CONTEXT_SQL));
   need(equal(sourceDeparseContext,restoredDeparseContext),'RESTORE_DEPARSE_ALIGNMENT_UNPROVED');
   deparseAlignment=publicDeparseAlignment({format:'PWA_RESTORE_DEPARSE_ALIGNMENT_V2',used:true,scope:'OWNED_CLONE_CONTROL_SESSIONS_ONLY',
    source_context:sourceDeparseContext,before_context:beforeContext,aligned_context:restoredDeparseContext,
    before_constraint_diagnostics:publicConstraintDefinitionDiagnostics(original.catalog.constraints,beforeConstraints,{sourceContext:sourceDeparseContext,restoredContext:beforeContext}),
    exact_catalog_comparison_unchanged:true,source_global_or_database_settings_changed:false,provider_archive_process_settings_changed:false,source_database_mutated:false,semantic_differences_ignored:false});
   need(deparseAlignment!==null,'RESTORE_DEPARSE_ALIGNMENT_UNPROVED');
  }
  const catalogMismatches=[];let definitionDiagnostics=null;
  for(const [family,query]of Object.entries(CATALOG_QUERIES)){
   phase='catalog.'+family;const actual=await jsonSql(aggregate(query));
   if(!equal(actual,original.catalog[family]))catalogMismatches.push(catalogMismatchDiagnostic(family,original.catalog[family],actual));
   if(family==='constraints'&&!equal(actual,original.catalog[family]))definitionDiagnostics=publicConstraintDefinitionDiagnostics(original.catalog[family],actual,{sourceContext:sourceDeparseContext,restoredContext:restoredDeparseContext});
  }
  if(catalogMismatches.length){phase='catalog.'+catalogMismatches[0].family;throw new InitialRestoreError('RESTORE_CATALOG_MISMATCH',{phase,catalogMismatches,definitionDiagnostics,deparseAlignment});}
  phase='data';for(const row of original.data){const result=await jsonSql("SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM "+(row.kind==='r'?'ONLY ':'')+table(row.schema,row.relation)+' t;');need(result.rows===row.rows&&result.sha256===row.sha256,'RESTORE_PHYSICAL_DATA_MISMATCH');}
  phase='sequence';for(const row of original.sequences){const result=await jsonSql("SELECT jsonb_build_object('last_value',last_value::text,'is_called',is_called) FROM "+table(row.schema,row.name));need(result.last_value===row.last_value&&result.is_called===row.is_called,'RESTORE_SEQUENCE_VALUES_MISMATCH');}
  await checkJobs();
  phase='actor';
  const actor=JSON.parse((await sql("SELECT jsonb_build_object('role',current_user,'session_role',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'bypass_rls',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user));",'postgres')).trim());
  need(equal(actor,{role:'postgres',session_role:'postgres',superuser:false,bypass_rls:true}),'RESTORE_UPGRADE_ACTOR_UNPROVED');
  const manifest=createUpgradeMigrationManifest(original.source_sha,files.map(({file,bytes})=>({file:file.file,bytes})));
  const historyState=async()=>{
   phase='history';
   const layout=await jsonSql(INITIAL_LAYOUT_SQL,'postgres');
   need(typeof layout.history_present==='boolean'&&typeof layout.source_history_present==='boolean','RESTORE_HISTORY_LAYOUT_UNKNOWN');
   const historyRows=layout.history_present?await jsonSql(INITIAL_HISTORY_SQL,'postgres'):[];
   const sourceRows=layout.source_history_present?await jsonSql(INITIAL_SOURCE_HISTORY_SQL,'postgres'):[];
   const suffixPresent=await jsonSql(PWA_RESTORE_SUFFIX_LAYOUT_SQL,'postgres');
   need(typeof suffixPresent==='boolean','RESTORE_SUFFIX_HISTORY_LAYOUT_UNKNOWN');
   const upgradeRows=suffixPresent?await jsonSql(UPGRADE_SOURCE_HISTORY_SQL,'postgres'):[];
   try{return validateUpgradeHistory(manifest,{historyRows,sourceRows,upgradeRows,layout:{schemas:layout.schemas,app_objects:layout.app_objects}});}
   catch{throw new InitialRestoreError('RESTORE_INITIAL_HISTORY_UNPROVED');}
  };
  const baseline=await historyState();
  need(baseline.appliedPrefix===original.source_history.applied_prefix,'RESTORE_INITIAL_PREFIX_CHANGED');
  phase='upgrade';let upgrade='SELECT pg_advisory_lock('+INITIAL_MIGRATION_POLICY.lockNamespace+','+INITIAL_MIGRATION_LOCK_OBJECT+');\n';
  for(let index=baseline.appliedPrefix;index<UPGRADE_FILES.length;index++){
   let rendered=upgradeMigrationSQL(manifest,index,{actor:'cluvo-restore-proof',workflowRunId:'1',expectedBackendPid:1,expectedBackendStart:'2000-01-01T00:00:00Z',backupArtifactId:'1',backupArtifactSha256:'0'.repeat(64)});
   const pid='OR pg_backend_pid()<>1',start="'2000-01-01T00:00:00Z'::timestamptz";
   need(rendered.includes(pid)&&rendered.includes(start),'RESTORE_RENDERER_SESSION_SHAPE_CHANGED');
   // The clone input uses one psql backend. Preserve the same renderer/body,
   // lock checks and atomic history; only its live-source PID/start pin becomes
   // that actual single clone session, never a hosted authorization receipt.
   rendered=rendered.replace(pid,'OR pg_backend_pid()<>pg_backend_pid()')
    .replace(start,'(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid())');
   upgrade+=rendered+'\n';
  }
  if(!baseline.complete)await sql(upgrade,'postgres');
  need((await historyState()).complete,'RESTORE_INITIAL_HISTORY_UNPROVED');
  phase='upgrade';
  const upgraded=await jsonSql("SELECT jsonb_build_object('history',(SELECT count(*) FROM supabase_migrations.schema_migrations),'app_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'),'forced_rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity),'native_policies',(SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND p.polname='native_session_required'));");
  need(upgraded.history===UPGRADE_FILES.length&&upgraded.app_tables>=144&&upgraded.forced_rls===upgraded.app_tables&&upgraded.native_policies===upgraded.app_tables,'RESTORE_INITIAL_UPGRADE_INCOMPLETE');
  await checkJobs();report={passed:true,scope:'PWA_STAGING_LOGICAL_RESTORE_AND_UPGRADE',logical_database_restored:true,
   physical_relations_verified:original.data.length,physical_rows_verified:original.data.reduce((sum,row)=>sum+row.rows,0),sequences_verified:original.sequences.length,
   baseline_catalog_families_verified:28,native_archive_sections_restored:3,native_restore_passes:4,native_toc_entries_preserved:lists.entries,extensions_precreated_with_source_owner:extensionsPrecreated,extension_owner_reassignments:extensionOwnerReassignments,extension_installers_removed:true,effective_acl_objects_replayed:aclObjectsReplayed,temporary_schema_usage_grants:temporarySchemaUsageGrants,temporary_reference_grants:temporaryReferenceGrants,temporary_restore_privileges_removed:true,extension_privilege_warnings:extensionPrivilegeWarnings,post_data_owner_mode:'session_authorization',bootstrap_create_exceptions:1,source_migration_prefix:baseline.appliedPrefix,
   final_migration_prefix:UPGRADE_FILES.length,non_superuser_upgrade_migrations:UPGRADE_FILES.length-baseline.appliedPrefix,app_tables:upgraded.app_tables,native_policies:upgraded.native_policies,
   network_isolated:true,background_jobs_disabled:true,source_database_mutated:false,
   ...(deparseAlignment?{deparse_alignment:deparseAlignment}:{}),role_passwords_restored:false,provider_root_keys_restored:false,provider_services_verified:false,
   full_provider_restore_verified:false,all_object_families_verified:false,live_migration_authorized:false,v1_ready:false,production_enabled:false};
 }catch(error){primary=error instanceof InitialRestoreError?error:new InitialRestoreError('INITIAL_RESTORE_UNAVAILABLE');primary.phase=phase;if(deparseAlignment)primary.deparseAlignment=deparseAlignment;}
 finally{
  dump.fill(0);globals.fill(0);
  phase='cleanup';
  if(created){try{
    const present=await inspect(id??name);id=ownership(present);
    await command(['rm','--force','--volumes',id],undefined,200000,20000);
    const absence=await run(['--host',socket,'inspect',id,'--format','{{.Id}}'],undefined,200000,20000);
    need(absent(absence,id),'RESTORE_CLONE_REMOVAL_UNPROVED');
   }catch(error){cleanupFailed=true;if(error instanceof InitialRestoreError)cleanupDiagnostic={sqlstate:error.sqlstate,errorKind:error.errorKind,errorReason:error.errorReason,exitStatus:error.exitStatus,processFailed:error.processFailed,tocType:error.tocType,errorOrigin:error.errorOrigin,errorSourceFile:error.errorSourceFile,errorTopics:error.errorTopics};}}
 }
 if(cleanupFailed)throw new InitialRestoreError('INITIAL_RESTORE_CLEANUP_UNPROVED',{phase:'cleanup',...cleanupDiagnostic});if(primary)throw primary;
 return Object.freeze({...report,owned_clone_removed:true});
}
