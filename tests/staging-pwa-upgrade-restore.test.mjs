// Synthetic Docker process fixture verifies the real additive restore orchestrator.
// Hosted proof still requires its actual owned PG17 archive restore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {restoreInitialBackup,INITIAL_RESTORE_STARTUP,PWA_RESTORE_SUFFIX_LAYOUT_SQL} from '../scripts/staging-pwa-upgrade-restore.mjs';
import {CATALOG_QUERIES} from '../scripts/staging-capture-catalog.mjs';
import {aggregate} from '../scripts/staging-capture-queries.mjs';
import {UPGRADE_FILES,createUpgradeMigrationManifest,UPGRADE_SOURCE_HISTORY_SQL} from '../scripts/staging-pwa-upgrade-migrations.mjs';
import {IMAGE} from '../scripts/pg17-capture-worker.mjs';
import {INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL} from '../scripts/staging-initial-migrations.mjs';

const sourceSha='a'.repeat(40),bootstrapRole='fixture_bootstrap',cid='b'.repeat(64),imageId='sha256:'+'c'.repeat(64);
const sources=await Promise.all(UPGRADE_FILES.map(async file=>({file:file.file,bytes:await readFile(new URL('../supabase/migrations/'+file.file,import.meta.url))})));
const manifest=createUpgradeMigrationManifest(sourceSha,sources);
const code=expected=>error=>error?.code===expected;
const ok=stdout=>({status:0,stdout:typeof stdout==='string'?stdout:JSON.stringify(stdout),stderr:''});
const failure=()=>({status:1,stdout:'',stderr:'private fixture diagnostics'});
const missing=reference=>({status:1,stdout:'',stderr:'Error: No such object: '+reference+'\n'});
function fixtureReceipt(prefix=16){
 const catalog=Object.fromEntries(Object.keys(CATALOG_QUERIES).map(key=>[key,[]]));
 catalog.roles=[{name:bootstrapRole,superuser:true,login:true},{name:'postgres',superuser:false,login:true}];
 catalog.database=[{owner:'postgres',connection_limit:-1,allow_connections:true,is_template:false,locale_provider:'i',locale:'en-US',encoding:'UTF8',acl:[]}];
 catalog.relations=[{schema:'auth',name:'users',kind:'r',owner:'postgres'}];
 if(prefix)catalog.relations.push({schema:'app',name:'fixture',kind:'r',owner:'postgres'});
 return {format:'cluvo-staging-private-snapshot',schema_version:2,environment:'staging',project_ref:'fbozlbgmktkgcdfqdaaz',
  source_sha:sourceSha,source_files:UPGRADE_FILES.map(file=>({...file})),source_scope:'HOSTED_VERIFY_FULL',hosted_source_verified:true,
  logical_capture_metadata_complete:true,source_history:{applied_prefix:prefix,original_source_bytes_proven:true},
  dataset_inventory:{key_dependent_data:'proven_empty',count_snapshot_consistent:true,storage_objects:0},large_objects:[],
  capability:{server_version:170011,bootstrap_anchor_superuser:true,role_superuser:false,role_bypassrls:true},
  configuration_safety:{secret_named_settings:0,unknown_named_settings:0,subscriptions:0,foreign_servers:0,foreign_user_mappings:0,custom_tablespaces:0},
  catalog,data:[{schema:'auth',relation:'users',kind:'r',rows:1,sha256:'d'.repeat(64)}],
  sequences:[{schema:'auth',name:'fixture_seq',last_value:'7',is_called:true}]};
}
function state(prefix){return {
 layout:{schemas:prefix?['api','app','internal']:[],app_objects:prefix?144:0,history_present:prefix>0,source_history_present:prefix>0},
 historyRows:manifest.migrations.slice(0,prefix).map(m=>({version:m.version,name:m.name,statement_count:1,single_statement_sha256:m.sha256})),
 sourceRows:manifest.migrations.slice(0,16).map((m,index)=>({version:m.version,file:m.file,sha256:m.sha256,source_sha:sourceSha,
  actor:'fixture-source',scope:'staging',expected_version:index,idempotency_key:'cluvo-staging-initial16:2:'+m.version,workflow_run_id:'2'})),upgradeRows:manifest.migrations.slice(16,prefix).map((m,index)=>({version:m.version,file:m.file,sha256:m.sha256,source_sha:sourceSha,actor:'fixture-upgrade',scope:'staging',expected_version:index+16,idempotency_key:'cluvo-staging-pwa-upgrade:2:'+m.version,workflow_run_id:'2',manifest_sha256:manifest.sha256,backup_artifact_id:'3',backup_artifact_sha256:'e'.repeat(64)}))};}
function runner(original,options={}){
 const observed={calls:[],upgrades:[],removed:false,replays:[],networkArgs:null,logReads:0,restoreSections:[],extensionCreates:[],extensionRoles:[],aclReplays:[],columnAclReplays:[],schemaUsage:[],schemaResets:[]};let name,started=false,restoreFailed=false,extensionReads=0,schemaUsageActive=false,prefix=original.source_history.applied_prefix;
 const catalogSql=new Map(Object.entries(CATALOG_QUERIES).map(([family,query])=>[aggregate(query),family]));
 const inspect=()=>({id:cid,name:'/'+name,image:imageId,config_image:IMAGE,user:'postgres',label:options.badOwner||(restoreFailed&&options.badDiagnosticOwner)?'third-party':name,
  network:options.badNetwork?'bridge':'none',ports:null,binds:null,mounts:[],tmpfs:{'/restore':'rw,size=512m,mode=1777'},volumes_from:null,
  privileged:false,log:'none',restart:'no',entrypoint:['/bin/sh'],arguments:['-c',INITIAL_RESTORE_STARTUP,'cluvo-initial-restore',bootstrapRole],state:started?'running':'created'});
 const run=async(args,input)=>{
  observed.calls.push(args);assert.equal(args[0],'--host');assert.equal(args[1],options.hosted?'unix:///var/run/docker.sock':'unix:///run/user/1001/docker.sock');
  const command=args[2];
  if(command==='image')return ok({id:imageId,digests:options.badImage?[]:[IMAGE]});
  if(command==='inspect'){
   if(!name||observed.removed)return missing(args[3]);
   return ok(inspect());
  }
  if(command==='create'){name=args[args.indexOf('--name')+1];observed.networkArgs=args;return ok(cid+'\n');}
  if(command==='start'){started=true;return ok(cid+'\n');}
  if(command==='rm'){assert.equal(args.at(-1),cid);if(options.cleanupFailure)return failure();observed.removed=true;return ok(cid+'\n');}
  assert.equal(command,'exec');
  if(args.includes('pg_isready'))return ok('');
  if(args.includes('/bin/sh')&&args.at(-1)?.startsWith('umask 077; cat > /restore/'))return ok('');
  if(args.includes('pg_restore')){
   if(args.includes('--list'))return ok('; Synthetic native TOC\n1; 2615 100 SCHEMA - auth postgres\n2; 1259 101 TABLE auth users postgres\n');
   assert.ok(args.includes('--single-transaction'));assert.ok(args.includes('--exit-on-error'));assert.equal(input.subarray(0,5).toString(),'PGDMP');
   const section=args.find(value=>value.startsWith('--section='))?.slice('--section='.length);observed.restoreSections.push(section);
   assert.ok(['pre-data','data','post-data'].includes(section));assert.equal(args.includes('--use-set-session-authorization'),section==='post-data');
   if(options.restoreFailure||options.restoreFailureSection===section){restoreFailed=true;return {...failure(),stderr:options.diagnostic??'private fixture diagnostics'};}return ok('');
  }
  if(args.includes('tail')){
   assert.deepEqual(args.slice(2),['exec',cid,'tail','-c','524288','/restore/postgres.private.log']);observed.logReads++;
   assert.ok(observed.calls.at(-2).includes('inspect'));
   if(options.logFailure)return failure();return ok(options.serverLog??'');
  }
  assert.ok(args.includes('psql'));assert.ok(args.includes('--set=VERBOSITY=sqlstate'));const role=args[args.indexOf('-U')+1],text=input.toString();
  if(text.includes('CREATE ROLE "cluvo_restore_ext_'))return ok('');
  if(text.includes('CREATE ROLE')){observed.replays.push(text);assert.equal(text.includes('CREATE ROLE "'+bootstrapRole+'";'),false);assert.ok(text.includes('ALTER ROLE "'+bootstrapRole+'"'));if(options.globalsFailure)return {status:3,stdout:'',stderr:options.diagnostic??'ERROR:  42501\n'};return ok('');}
  const query=text.replace(/^SET client_min_messages=warning;\nSET search_path TO '';\n/,'').replace(/;\s*$/,'');
  if(catalogSql.has(query)){
   const family=catalogSql.get(query),value=structuredClone(original.catalog[family]);
   if(family==='schemas'&&schemaUsageActive)for(const schema of value)schema.acl.push(['postgres','fixture_auth_owner','USAGE',false]);
   if(family==='extensions'){if(extensionReads++===0){if(options.extensionAbsent)return ok([]);if(options.existingExtensionMismatch&&value.length)value[0].owner='unexpected_private_owner';}else if(options.lateExtensionMismatch&&value.length)value[0].owner='unexpected_private_owner';}
   if(options.catalogFailure===family)return {status:3,stdout:'',stderr:'ERROR:  42P01\n'};
   if(options.catalogMismatch&&family==='roles')value.push({name:'unexpected_fixture_role'});
   if(options.aclMismatch&&family==='relations'&&!observed.aclReplays.length){value[0].acl.push([bootstrapRole,'anon','SELECT',false]);if(options.aclDefinitionMismatch)value[0].rls=true;}
   if(options.columnAclMismatch&&family==='columns'&&!observed.columnAclReplays.length){value[0].acl=[];if(options.columnDefinitionMismatch)value[0].not_null=true;}
   return ok(value);
  }
  if(query.includes("'unexpected_workers'"))return ok({listen_disabled:true,unexpected_workers:options.worker?1:0,cron_disabled:true,workers:0,version:170011});
  if(query.includes("'rows',count(*)"))return ok({rows:1,sha256:options.dataMismatch?'e'.repeat(64):'d'.repeat(64)});
  if(query.includes("'last_value'"))return ok({last_value:options.sequenceMismatch?'8':'7',is_called:true});
  if(query.includes("'session_role'")){assert.equal(role,'postgres');return ok({superuser:!!options.superuser,session_role:'postgres',role:'postgres',bypass_rls:true});}
  if(query===INITIAL_LAYOUT_SQL){assert.equal(role,'postgres');return ok(state(options.prefixMismatch?prefix+1:prefix).layout);}
  if(query===INITIAL_HISTORY_SQL){assert.equal(role,'postgres');const value=state(prefix).historyRows;if(options.historyMismatch&&value.length)value[0].single_statement_sha256='f'.repeat(64);return ok(value);}
  if(query===INITIAL_SOURCE_HISTORY_SQL){assert.equal(role,'postgres');const value=state(prefix).sourceRows;if(options.auditMismatch&&value.length)value[0].expected_version=1;return ok(value);}
  // Preserve actual psql transport shape: plain SQL booleans are t/f, whereas
  // a JSON boolean expression serializes false/true before the JSON parser.
  if(query==="SELECT to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NOT NULL")return ok(prefix>16?'t\n':'f\n');
  if(query===PWA_RESTORE_SUFFIX_LAYOUT_SQL.replace(/;$/,''))return ok(options.suffixLayoutResponse??(prefix>16?'true\n':'false\n'));
  if(query===UPGRADE_SOURCE_HISTORY_SQL){const value=state(prefix).upgradeRows;if(options.upgradeReceiptMismatch&&value.length)value[0].manifest_sha256='f'.repeat(64);return ok(value);}
  if(query.includes('$cluvo_pwa_owner$')){
   assert.equal(role,'postgres');assert.ok(query.startsWith('SELECT pg_advisory_lock('));
   assert.equal(query.includes('OR pg_backend_pid()<>1\n'),false);assert.equal(query.includes("'2000-01-01T00:00:00Z'::timestamptz"),false);
   observed.upgrades.push(query);if(options.upgradeFailure)return failure();prefix=UPGRADE_FILES.length;return ok('');
  }
  if(query.includes("'native_policies'"))return ok({native_policies:options.missingNativePolicy?199:200,forced_rls:200,app_tables:200,history:UPGRADE_FILES.length});
  if(query.startsWith('ALTER DATABASE postgres OWNER'))return ok('');
  if(query.startsWith("SELECT jsonb_build_object('available',"))return ok({available:options.versionUnavailable?false:true});
  if(query.startsWith("SELECT jsonb_build_object('superuser',"))return ok({superuser:true,self:true,supautils_omitted:!options.installerSessionMismatch});
  if(query.startsWith('REASSIGN OWNED BY "cluvo_restore_ext_'))return options.installerDropFailure?failure():ok('');
  if(query.startsWith('REVOKE ALL ON TABLE ')){observed.aclReplays.push(query);return ok('');}
  if(query.startsWith('REVOKE ALL (')){observed.columnAclReplays.push(query);return ok('');}
  if(query.startsWith('GRANT USAGE ON SCHEMA ')){observed.schemaUsage.push(query);schemaUsageActive=true;return ok('');}
  if(query.startsWith('GRANT REFERENCES ON TABLE '))return ok('');
  if(query.startsWith('REVOKE ALL ON SCHEMA ')){observed.schemaResets.push(query);if(options.schemaResetFailure)return failure();if(!options.schemaResetDrift)schemaUsageActive=false;return ok('');}
  if(query.startsWith("SELECT jsonb_build_object('absent',"))return ok({absent:!options.installerStillPresent});
  if(query.startsWith('CREATE EXTENSION ')){observed.extensionCreates.push(query);observed.extensionRoles.push(role);return {...ok(''),stderr:options.extensionWarning??''};}
  assert.fail('unrecognized fixed protocol query');
 };
 return {run,observed};
}
async function fixture(fn,prefix=16,options={}){
 const directory=await mkdtemp(join(tmpdir(),'cluvo-initial-restore-test-'));await chmod(directory,0o700);
 const original=fixtureReceipt(prefix),model=runner(original,options);
 try{
  await writeFile(join(directory,'database.dump'),Buffer.from('PGDMPsynthetic private fixture'),{mode:0o600});
  await writeFile(join(directory,'globals.sql'),'CREATE ROLE "'+bootstrapRole+'";\nALTER ROLE "'+bootstrapRole+'" WITH SUPERUSER;\nCREATE ROLE "postgres";\n',{mode:0o600});
  await fn({directory,original,bootstrapRole,executionScope:options.hosted?'HOSTED':'LOCAL'},model);
 }finally{await rm(directory,{recursive:true,force:true});}
}

test('additive restore preserves full catalogs/data and original16 while applying only the known suffix transactions',async()=>{
 await fixture(async(input,{run,observed})=>{
  const report=await restoreInitialBackup(input,{run});
  assert.equal(report.passed,true);assert.equal(report.source_migration_prefix,16);
  assert.equal(report.non_superuser_upgrade_migrations,UPGRADE_FILES.length-16);
  assert.equal(report.final_migration_prefix,UPGRADE_FILES.length);assert.equal(report.app_tables,200);
  assert.equal(report.baseline_catalog_families_verified,28);assert.equal(report.physical_rows_verified,1);
  assert.equal(report.owned_clone_removed,true);assert.equal(observed.removed,true);
  assert.deepEqual(observed.restoreSections,['pre-data','pre-data','data','post-data']);
  assert.equal(observed.upgrades.length,1);
  assert.equal((observed.upgrades[0].match(/INSERT INTO supabase_migrations.schema_migrations/g)||[]).length,UPGRADE_FILES.length-16);
  assert.equal(observed.upgrades[0].includes('INSERT INTO supabase_migrations.cluvo_migration_source('),false);
  assert.equal(report.live_migration_authorized,false);assert.equal(report.production_enabled,false);
 });
});

test('partially applied suffix validates its actual receipt and applies only missing migrations',async()=>{
 await fixture(async(input,{run,observed})=>{
  const report=await restoreInitialBackup(input,{run});
  assert.equal(report.non_superuser_upgrade_migrations,UPGRADE_FILES.length-17);
  assert.equal((observed.upgrades[0].match(/INSERT INTO supabase_migrations.schema_migrations/g)||[]).length,UPGRADE_FILES.length-17);
 },17);
 await fixture(async(input,{run,observed})=>{
  const report=await restoreInitialBackup(input,{run});assert.equal(report.non_superuser_upgrade_migrations,0);
  assert.equal(observed.upgrades.length,0);assert.equal(report.final_migration_prefix,UPGRADE_FILES.length);
 },UPGRADE_FILES.length);
});

test('suffix layout accepts only a typed JSON boolean and refuses raw psql or other JSON values before any upgrade',async()=>{
 for(const wire of ['t\n','f\n','null','0','[]','{}','"false"','{"present":false}'])await fixture(async(input,{run,observed})=>{
  const expected=['t\n','f\n'].includes(wire)?'RESTORE_SQL_RESPONSE_UNKNOWN':'RESTORE_SUFFIX_HISTORY_LAYOUT_UNKNOWN';
  await assert.rejects(restoreInitialBackup(input,{run}),error=>error?.code===expected&&error.phase==='history');
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },16,{suffixLayoutResponse:wire});
});

test('history, original receipt and suffix receipt drift refuse clone upgrade and remove the owned clone',async()=>{
 for(const option of ['historyMismatch','auditMismatch','upgradeReceiptMismatch'])await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_INITIAL_HISTORY_UNPROVED'));
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },17,{[option]:true});
});

test('catalog, physical data, sequence and actor failures still refuse any suffix body',async()=>{
 for(const [option,expected]of [['catalogMismatch','RESTORE_CATALOG_MISMATCH'],['dataMismatch','RESTORE_PHYSICAL_DATA_MISMATCH'],
  ['sequenceMismatch','RESTORE_SEQUENCE_VALUES_MISMATCH'],['superuser','RESTORE_UPGRADE_ACTOR_UNPROVED'],['worker','RESTORE_CLONE_JOB_SUPPRESSION_UNPROVED']])await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),code(expected));
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },16,{[option]:true});
});

test('guard proof covers every newly added app table rather than the original fixed144',async()=>{
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_INITIAL_UPGRADE_INCOMPLETE'));
  assert.equal(observed.removed,true);
 },16,{missingNativePolicy:true});
});

test('incorrect clone ownership never authorizes deleting a foreign container',async()=>{
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),code('INITIAL_RESTORE_CLEANUP_UNPROVED'));
  assert.equal(observed.removed,false);assert.equal(observed.upgrades.length,0);
 },16,{badOwner:true});
});

