import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {restoreInitialBackup,INITIAL_RESTORE_STARTUP,INITIAL_RESTORE_PHASES,INITIAL_RESTORE_TOC_TYPES,InitialRestoreError} from '../scripts/staging-initial-restore.mjs';
import {CATALOG_QUERIES} from '../scripts/staging-capture-catalog.mjs';
import {aggregate} from '../scripts/staging-capture-queries.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
import {IMAGE} from '../scripts/pg17-capture-worker.mjs';
import {createInitialMigrationManifest,INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL} from '../scripts/staging-initial-migrations.mjs';

const sourceSha='a'.repeat(40),bootstrapRole='fixture_bootstrap',cid='b'.repeat(64),imageId='sha256:'+'c'.repeat(64);
const sources=await Promise.all(IMMUTABLE16.map(async file=>({file:file.file,bytes:await readFile(new URL('../supabase/migrations/'+file.file,import.meta.url))})));
const manifest=createInitialMigrationManifest(sourceSha,sources);
const code=expected=>error=>error?.code===expected;
const ok=stdout=>({status:0,stdout:typeof stdout==='string'?stdout:JSON.stringify(stdout),stderr:''});
const failure=()=>({status:1,stdout:'',stderr:'private fixture diagnostics'});
const missing=reference=>({status:1,stdout:'',stderr:'Error: No such object: '+reference+'\n'});
function fixtureReceipt(prefix=0){
 const catalog=Object.fromEntries(Object.keys(CATALOG_QUERIES).map(key=>[key,[]]));
 catalog.roles=[{name:bootstrapRole,superuser:true,login:true},{name:'postgres',superuser:false,login:true}];
 catalog.database=[{owner:'postgres',connection_limit:-1,allow_connections:true,is_template:false,locale_provider:'i',locale:'en-US',encoding:'UTF8',acl:[]}];
 catalog.relations=[{schema:'auth',name:'users',kind:'r',owner:'postgres'}];
 if(prefix)catalog.relations.push({schema:'app',name:'fixture',kind:'r',owner:'postgres'});
 return {format:'cluvo-staging-private-snapshot',schema_version:2,environment:'staging',project_ref:'fbozlbgmktkgcdfqdaaz',
  source_sha:sourceSha,source_files:IMMUTABLE16.map(file=>({...file})),source_scope:'HOSTED_VERIFY_FULL',hosted_source_verified:true,
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
 sourceRows:manifest.migrations.slice(0,prefix).map((m,index)=>({version:m.version,file:m.file,sha256:m.sha256,source_sha:sourceSha,
  actor:'fixture-source',scope:'staging',expected_version:index,idempotency_key:'cluvo-staging-initial16:2:'+m.version,workflow_run_id:'2'}))};}
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
  if(query.includes('$cluvo_initial_session$')){
   assert.equal(role,'postgres');assert.ok(query.startsWith('SELECT pg_advisory_lock('));
   assert.equal(query.includes('OR pg_backend_pid()<>1\n'),false);assert.equal(query.includes("'2000-01-01T00:00:00Z'::timestamptz"),false);
   observed.upgrades.push(query);if(options.upgradeFailure)return failure();prefix=16;return ok('');
  }
  if(query.includes("'native_policies'"))return ok({native_policies:144,forced_rls:144,app_tables:144,history:16});
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
async function fixture(fn,prefix=0,options={}){
 const directory=await mkdtemp(join(tmpdir(),'cluvo-initial-restore-test-'));await chmod(directory,0o700);
 const original=fixtureReceipt(prefix),model=runner(original,options);
 try{
  await writeFile(join(directory,'database.dump'),Buffer.from('PGDMPsynthetic private fixture'),{mode:0o600});
  await writeFile(join(directory,'globals.sql'),'CREATE ROLE "'+bootstrapRole+'";\nALTER ROLE "'+bootstrapRole+'" WITH SUPERUSER;\nCREATE ROLE "postgres";\n',{mode:0o600});
  await fn({directory,original,bootstrapRole,executionScope:options.hosted?'HOSTED':'LOCAL'},model);
 }finally{await rm(directory,{recursive:true,force:true});}
}

test('provider-owner namespace access is temporary, limited to USAGE/REFERENCES and removed before attestation',async()=>{
 await fixture(async(context,{run,observed})=>{
  const catalog=context.original.catalog;
  catalog.roles.push({name:'fixture_auth_owner',superuser:false,login:false});
  catalog.relations[0].owner='fixture_auth_owner';
  catalog.schemas=[{name:'auth',owner:'postgres',acl:[['postgres','postgres','CREATE',false],['postgres','postgres','USAGE',false]]}];
  const report=await restoreInitialBackup(context,{run});
  assert.equal(report.temporary_schema_usage_grants,1);
  assert.equal(report.temporary_reference_grants,1);
  assert.equal(report.temporary_restore_privileges_removed,true);
  assert.equal(observed.schemaUsage.length,1);assert.equal(observed.schemaResets.length,1);
  assert.ok(observed.schemaUsage[0].includes('GRANT USAGE ON SCHEMA "auth" TO "fixture_auth_owner";'));
  assert.ok(observed.schemaUsage[0].includes('GRANT REFERENCES ON TABLE "auth"."users" TO "fixture_auth_owner"'));
  assert.ok(!observed.schemaUsage[0].includes('GRANT CREATE'));
  assert.ok(observed.schemaResets[0].includes('REVOKE ALL ON SCHEMA "auth" FROM "fixture_auth_owner";'));
 });
 for(const options of [{schemaResetFailure:true},{schemaResetDrift:true}])await fixture(async(context,{run,observed})=>{
  context.original.catalog.schemas=[{name:'auth',owner:'postgres',acl:[]}];
  await assert.rejects(restoreInitialBackup(context,{run}),code(options.schemaResetFailure?'RESTORE_PROCESS_FAILED':'RESTORE_CATALOG_MISMATCH'));
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,options);
});

test('fixed endpoint, full restore, physical verification and atomic original16 nonSU upgrade',async()=>{
 await fixture(async(input,{run,observed})=>{
  const result=await restoreInitialBackup(input,{run});assert.equal(result.passed,true);assert.equal(result.source_migration_prefix,0);
  assert.equal(result.non_superuser_upgrade_migrations,16);assert.equal(result.physical_rows_verified,1);assert.equal(result.owned_clone_removed,true);
  assert.equal(observed.upgrades.length,1);assert.equal((observed.upgrades[0].match(/INSERT INTO supabase_migrations.schema_migrations/g)||[]).length,16);
  assert.equal(observed.replays.length,1);assert.equal(observed.removed,true);
  assert.ok(observed.networkArgs.includes('--network=none'));assert.equal(observed.networkArgs.includes('-v'),false);
  for(const limit of ['role_passwords_restored','provider_root_keys_restored','provider_services_verified','full_provider_restore_verified','all_object_families_verified','live_migration_authorized','v1_ready','production_enabled'])assert.equal(result[limit],false);
  assert.equal(JSON.stringify(result).includes(bootstrapRole),false);assert.equal(JSON.stringify(result).includes('d'.repeat(64)),false);
 });
});
test('HOSTED selection uses the fixed system Docker endpoint without broadening proof scope',async()=>{
 await fixture(async(input,{run})=>{assert.equal((await restoreInitialBackup(input,{run})).passed,true);},0,{hosted:true});
});
test('partial source prefix preserves existing history and applies only the remaining suffix',async()=>{
 await fixture(async(input,{run,observed})=>{const report=await restoreInitialBackup(input,{run});assert.equal(report.source_migration_prefix,7);assert.equal(report.non_superuser_upgrade_migrations,9);
  assert.equal((observed.upgrades[0].match(/INSERT INTO supabase_migrations.schema_migrations/g)||[]).length,9);assert.equal(observed.upgrades[0].includes('DROP DATABASE'),false);},7);
});
test('complete source prefix is still verified and performs no migration body',async()=>{
 await fixture(async(input,{run,observed})=>{const report=await restoreInitialBackup(input,{run});assert.equal(report.non_superuser_upgrade_migrations,0);assert.equal(report.final_migration_prefix,16);assert.equal(observed.upgrades.length,0);},16);
});
test('key-dependent, storage, large-object, unproved source bytes and invalid prefix refuse before Docker',async()=>{
 for(const mutate of [r=>r.dataset_inventory.key_dependent_data='unknown',r=>r.dataset_inventory.storage_objects=1,r=>r.large_objects.push({}),r=>r.source_history.original_source_bytes_proven=false,r=>r.source_history.applied_prefix=17]){
  await fixture(async(input,{run,observed})=>{mutate(input.original);await assert.rejects(restoreInitialBackup(input,{run}),code('INITIAL_RESTORE_SCOPE_UNSUPPORTED'));assert.equal(observed.calls.length,0);});
 }
});
test('unsafe backup leaves are refused before Docker and symlinks are not followed',async()=>{
 for(const mutate of [async dir=>chmod(join(dir,'database.dump'),0o644),async dir=>{await rm(join(dir,'database.dump'));await symlink(join(dir,'globals.sql'),join(dir,'database.dump'));}]){
  await fixture(async(input,{run,observed})=>{await mutate(input.directory);await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_INPUT_UNAVAILABLE'));assert.equal(observed.calls.length,0);});
 }
});
test('an unexpected image is rejected without creating a clone',async()=>{
 await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_IMAGE_PIN_UNPROVED'));assert.equal(observed.calls.some(args=>args[2]==='create'),false);},0,{badImage:true});
});
test('ownership mismatch never removes an unproved container',async()=>{
 await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('INITIAL_RESTORE_CLEANUP_UNPROVED'));assert.equal(observed.removed,false);assert.equal(observed.calls.some(args=>args[2]==='rm'),false);},0,{badOwner:true});
});
test('isolation, restore, catalog/data/sequence, actor and job failures remove only the owned clone',async()=>{
 for(const [option,expected]of [['badNetwork','RESTORE_CLONE_ISOLATION_UNKNOWN'],['restoreFailure','RESTORE_PROCESS_FAILED'],['catalogMismatch','RESTORE_CATALOG_MISMATCH'],['dataMismatch','RESTORE_PHYSICAL_DATA_MISMATCH'],['sequenceMismatch','RESTORE_SEQUENCE_VALUES_MISMATCH'],['superuser','RESTORE_UPGRADE_ACTOR_UNPROVED'],['worker','RESTORE_CLONE_JOB_SUPPRESSION_UNPROVED']]){
  await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code(expected));assert.equal(observed.removed,true);assert.equal(observed.upgrades.length,0);},0,{[option]:true});
 }
});
test('catalog mismatch diagnostics retain all strict checks and prevent any upgrade',async()=>{
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.code,'RESTORE_CATALOG_MISMATCH');assert.equal(error.phase,'catalog.roles');
   assert.deepEqual(error.catalogMismatches,[{family:'roles',source_rows:2,restored_rows:3,missing_rows:0,extra_rows:1,changed_rows:0,changed_fields:[],acl_missing_entries:0,acl_extra_entries:0}]);
   assert.equal(JSON.stringify(error).includes('fixture'),false);return true;
  });assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{catalogMismatch:true});
});
test('restored history and source audit must prove the exact prefix before any suffix runs',async()=>{
 for(const option of ['historyMismatch','auditMismatch'])await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_INITIAL_HISTORY_UNPROVED'));assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);},3,{[option]:true});
});
test('migration failure cleans the clone and cleanup failure can never return a passing report',async()=>{
 await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_PROCESS_FAILED'));assert.equal(observed.removed,true);},0,{upgradeFailure:true});
 await fixture(async(input,{run})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('INITIAL_RESTORE_CLEANUP_UNPROVED'));},0,{cleanupFailure:true});
});
test('failed globals and catalog commands expose only fixed phase and whitelisted SQLSTATE metadata',async()=>{
 for(const [options,phase,sqlstate,errorKind]of [[{globalsFailure:true},'globals','42501','PERMISSION'],
  [{catalogFailure:'roles'},'catalog.roles','42P01','MISSING'],
  [{globalsFailure:true,diagnostic:'ERROR:  private_fixture_identity missing@example.test\n'},'globals',null,'PROCESS_FAILURE'],
  [{globalsFailure:true,diagnostic:'ERROR: permission denied for private_fixture_identity\nCommand was: private_fixture_sql\n'},'globals',null,'PERMISSION']]){
  await fixture(async(input,{run,observed})=>{
   await assert.rejects(restoreInitialBackup(input,{run}),error=>{
    assert.equal(error.code,'RESTORE_PROCESS_FAILED');assert.equal(error.phase,phase);assert.equal(error.sqlstate,sqlstate);assert.equal(error.errorKind,errorKind);
    assert.equal(JSON.stringify(error).includes('private_fixture'),false);assert.equal(JSON.stringify(error).includes('@'),false);assert.ok(INITIAL_RESTORE_PHASES.includes(error.phase));return true;
   });assert.equal(observed.removed,true);assert.equal(observed.upgrades.length,0);
  },0,options);
 }
});
test('verification phases survive cleanup and unknown caller metadata cannot become public error fields',async()=>{
 for(const [options,phase]of [[{dataMismatch:true},'data'],[{sequenceMismatch:true},'sequence'],[{superuser:true},'actor'],[{worker:true},'jobs'],[{auditMismatch:true},'history'],[{upgradeFailure:true},'upgrade'],[{cleanupFailure:true},'cleanup']]){
  await fixture(async(input,{run})=>{await assert.rejects(restoreInitialBackup(input,{run}),error=>{assert.equal(error.phase,phase);return true;});},options.auditMismatch?3:0,options);
 }
 const error=new InitialRestoreError('RESTORE_PROCESS_FAILED',{phase:'private_fixture',sqlstate:'SECRT',errorKind:'private_fixture'});
 assert.equal(error.phase,'input');assert.equal(error.sqlstate,null);assert.equal(error.errorKind,null);
 assert.equal(JSON.stringify(error).includes('private_fixture'),false);assert.equal(JSON.stringify(error).includes('SECRT'),false);
});
test('private provider restore failures expose finite reasons and bounded process status only',async()=>{
 for(const [diagnostic,reason,kind]of [
  ['ERROR: extension "private_fixture" has no installation script nor update path for version "private_version"','EXTENSION_VERSION_UNAVAILABLE','UNSUPPORTED'],
  ['ERROR: could not open extension control file "/private_fixture.control": No such file','EXTENSION_NOT_AVAILABLE','MISSING'],
  ['ERROR: no schema has been selected to create in','SCHEMA_REQUIRED','MISSING'],
  ['ERROR: unrecognized configuration parameter "private_fixture"','GLOBAL_SETTING_UNSUPPORTED','UNSUPPORTED'],
  ['ERROR: cannot execute private_fixture in a read-only transaction','READ_ONLY_TRANSACTION','PERMISSION'],
  ['pg_restore: error: could not read from input file: end of file','ARCHIVE_TRUNCATED','PROCESS_FAILURE'],
  ['private_fixture_unknown_error','UNKNOWN_PROCESS_FAILURE','PROCESS_FAILURE'],
 ])await fixture(async(input,{run,observed})=>{
   await assert.rejects(restoreInitialBackup(input,{run}),error=>{
    assert.equal(error.errorReason,reason);assert.equal(error.errorKind,kind);assert.equal(error.exitStatus,3);assert.equal(error.processFailed,false);
    assert.equal(JSON.stringify(error).includes('private_fixture'),false);return true;
   });assert.equal(observed.removed,true);
  },0,{globalsFailure:true,diagnostic});
 const unsafe=new InitialRestoreError('RESTORE_PROCESS_FAILED',{errorReason:'private_fixture',exitStatus:999,processFailed:'private_fixture'});
 assert.equal(unsafe.errorReason,null);assert.equal(unsafe.exitStatus,null);assert.equal(unsafe.processFailed,null);
});

test('all native archive sections precede readback and only post-data uses actual owners',async()=>{
 await fixture(async(input,{run,observed})=>{
  const result=await restoreInitialBackup(input,{run});
  assert.deepEqual(observed.restoreSections,['pre-data','pre-data','data','post-data']);assert.equal(result.native_archive_sections_restored,3);assert.equal(result.native_restore_passes,4);assert.equal(result.native_toc_entries_preserved,2);
  assert.equal(result.post_data_owner_mode,'session_authorization');assert.equal(result.non_superuser_upgrade_migrations,16);
  const post=observed.calls.findIndex(args=>args.includes('--section=post-data'));
  const schemaRead=observed.calls.findIndex(args=>args.includes('psql')&&observed.calls.indexOf(args)>observed.calls.findIndex(call=>call.includes('--section=data')));
  assert.ok(schemaRead>0&&schemaRead<post);assert.equal(observed.removed,true);
 });
 for(const section of ['pre-data','data','post-data'])await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{assert.equal(error.phase,'restore');assert.equal(error.restoreSection,section);return true;});
  assert.deepEqual(observed.restoreSections,['pre-data','pre-data','data','post-data'].slice(0,['pre-data','pre-data','data','post-data'].indexOf(section)+1));
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{restoreFailureSection:section});
});

test('extensions are precreated with captured owners and versions; existing mismatches refuse',async()=>{
 const extension={name:'fixture_extension',schema:'auth',owner:'postgres',version:'1.2.3',relocatable:true,config:[]};
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push(extension);
  const report=await restoreInitialBackup(input,{run});assert.equal(report.extensions_precreated_with_source_owner,1);
  assert.equal(observed.extensionCreates.length,1);
  assert.equal(observed.extensionCreates[0],'CREATE EXTENSION "fixture_extension" WITH SCHEMA "auth" VERSION \'1.2.3\'');assert.match(observed.extensionRoles[0],/^cluvo_restore_ext_[0-9a-f]{24}$/);
  assert.equal(report.extension_owner_reassignments,1);assert.equal(report.extension_installers_removed,true);
  assert.equal(report.non_superuser_upgrade_migrations,16);assert.equal(observed.removed,true);
 },0,{extensionAbsent:true});
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push(extension);
  await assert.rejects(restoreInitialBackup(input,{run}),error=>error.code==='RESTORE_EXISTING_EXTENSION_CHANGED'&&error.phase==='extension_owners');
  assert.equal(observed.extensionCreates.length,0);assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{existingExtensionMismatch:true});
});
test('successful extension privilege warnings are counted and still require exact final catalogs',async()=>{
 const extension={name:'fixture_extension',schema:'auth',owner:'postgres',version:'1.2.3',relocatable:true,config:[]};
 for(const warning of ['WARNING:  01006\n','WARNING:  01007\n'])await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push(extension);const result=await restoreInitialBackup(input,{run});
  assert.equal(result.extension_privilege_warnings,1);assert.equal(result.baseline_catalog_families_verified,28);assert.equal(observed.removed,true);
 },0,{extensionAbsent:true,extensionWarning:warning});
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push(extension);
  await assert.rejects(restoreInitialBackup(input,{run}),error=>error.code==='RESTORE_EXTENSION_METADATA_UNPROVED');
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{extensionAbsent:true,extensionWarning:'WARNING: 01007\n',lateExtensionMismatch:true});
});
test('the exact source version must be available before any installer or extension creation',async()=>{
 const extension={name:'fixture_extension',schema:'auth',owner:'postgres',version:'1.2.3',relocatable:true,config:[]};
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push(extension);
  await assert.rejects(restoreInitialBackup(input,{run}),error=>error.code==='RESTORE_EXTENSION_VERSION_UNAVAILABLE'&&error.phase==='extension_owners');
  assert.equal(observed.extensionCreates.length,0);assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{extensionAbsent:true,versionUnavailable:true});
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push({...extension,owner:bootstrapRole});
  const result=await restoreInitialBackup(input,{run});assert.equal(result.passed,true);
  assert.ok(observed.extensionCreates[0].includes(' VERSION \'1.2.3\''));assert.equal(observed.removed,true);
 },0,{extensionAbsent:true});
});
test('extension installers must prove their isolated session and be removed before verification',async()=>{
 for(const [option,code]of [['installerSessionMismatch','RESTORE_INSTALLER_SESSION_UNPROVED'],['installerDropFailure','RESTORE_PROCESS_FAILED'],['installerStillPresent','RESTORE_INSTALLER_REMOVAL_UNPROVED']])await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push({name:'fixture_extension',schema:'auth',owner:'postgres',version:'1.2.3',config:[]});
  await assert.rejects(restoreInitialBackup(input,{run}),error=>error.code===code&&error.phase==='extension_owners');
  assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{extensionAbsent:true,[option]:true});
});
test('effective ACL replay restores captured grantors and cannot hide a definition difference',async()=>{
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.relations[0].acl=[['postgres','postgres','SELECT',false]];
  const result=await restoreInitialBackup(input,{run});assert.equal(result.effective_acl_objects_replayed,1);
  assert.equal(observed.aclReplays.length,1);assert.ok(observed.aclReplays[0].includes('SET SESSION AUTHORIZATION "postgres";GRANT SELECT ON TABLE "auth"."users" TO "postgres"'));
  assert.equal(result.baseline_catalog_families_verified,28);assert.equal(observed.removed,true);
 },0,{aclMismatch:true});
 await fixture(async(input,{run,observed})=>{
  input.original.catalog.relations[0].acl=[['postgres','postgres','SELECT',false]];
  await assert.rejects(restoreInitialBackup(input,{run}),error=>error.code==='RESTORE_CATALOG_MISMATCH'&&error.phase==='catalog.relations');
  assert.equal(observed.aclReplays.length,0);assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{aclMismatch:true,aclDefinitionMismatch:true});
});
test('column ACLs cleared by a table revoke are restored with their original grantors/options; changed definitions still fail',async()=>{
 for(const changed of [false,true])await fixture(async(input,{run,observed})=>{
  input.original.catalog.columns=[{schema:'auth',relation:'users',name:'id',not_null:false,acl:[['postgres','anon','SELECT',true]]}];
  if(changed){
   await assert.rejects(restoreInitialBackup(input,{run}),error=>error.code==='RESTORE_CATALOG_MISMATCH'&&error.phase==='catalog.columns');
   assert.equal(observed.columnAclReplays.length,0);
  }else{
   const report=await restoreInitialBackup(input,{run});assert.equal(report.effective_acl_objects_replayed,1);
   assert.equal(observed.columnAclReplays.length,1);
   assert.ok(observed.columnAclReplays[0].includes('REVOKE ALL ("id") ON TABLE "auth"."users" FROM "anon";'));
   assert.ok(observed.columnAclReplays[0].includes('SET SESSION AUTHORIZATION "postgres";GRANT SELECT ("id") ON TABLE "auth"."users" TO "anon" WITH GRANT OPTION;'));
  }
  assert.equal(observed.removed,true);
 },0,{columnAclMismatch:true,columnDefinitionMismatch:changed});
});
test('unknown, mixed or failing extension warnings refuse and expose only finite diagnostics',async()=>{
 for(const warning of ['WARNING:  01000\n','WARNING:  01007\nERROR:  42501\n','WARNING: private@example.test\n'])await fixture(async(input,{run,observed})=>{
  input.original.catalog.extensions.push({name:'fixture_extension',schema:'auth',owner:'postgres',version:'1.0',config:[]});
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.code,'RESTORE_PROCESS_FAILED');assert.equal(error.phase,'extension_owners');
   assert.equal(JSON.stringify(error).includes('@'),false);assert.equal(JSON.stringify(error).includes('private'),false);return true;
  });assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);
 },0,{extensionAbsent:true,extensionWarning:warning});
});
test('event trigger owner conflicts have a finite reason without changing source owners',async()=>{
 await fixture(async(input,{run})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.sqlstate,'XX000');assert.equal(error.errorReason,'EVENT_TRIGGER_OWNER_MISMATCH');assert.equal(error.restoreSection,'post-data');
   assert.equal(JSON.stringify(error).includes('private_fixture'),false);return true;
  });
 },0,{restoreFailureSection:'post-data',serverLog:'2026-10-08 [12345] ERROR:  XX000: Superuser owned event trigger must execute a superuser owned function\n2026-10-08 [12345] DETAIL: private_fixture private@example.test\n'});
});

test('a restore failure reads only the owned private log and projects the last known server SQLSTATE',async()=>{
 for(const [state,kind]of [['XX000','PROCESS_FAILURE'],['42P17','SYNTAX'],['55006','CONFLICT'],['22023','UNSUPPORTED'],['42P01','MISSING']]){
  await fixture(async(input,{run,observed})=>{
   await assert.rejects(restoreInitialBackup(input,{run}),error=>{
    assert.equal(error.phase,'restore');assert.equal(error.sqlstate,state);assert.equal(error.errorKind,kind);assert.equal(error.errorReason,'SERVER_SQLSTATE_REPORTED');
    assert.equal(error.tocType,'TABLE DATA');assert.equal(error.exitStatus,1);assert.equal(error.processFailed,false);
    const publicError=JSON.stringify(error);for(const text of ['private_fixture','private@example.test','8675309','12345','LOCATION','Command was'])assert.equal(publicError.includes(text),false);return true;
   });assert.equal(observed.logReads,1);assert.equal(observed.removed,true);assert.equal(observed.upgrades.length,0);
  },0,{restoreFailure:true,diagnostic:'pg_restore: from TOC entry 8675309; 12345 67890 TABLE DATA private_fixture private@example.test\npg_restore: error: unmatched private process text\n',
   serverLog:'2026-10-08 [12345] ERROR:  42501: private earlier failure\n2026-10-08 [12345] ERROR:  '+state+': private_fixture private@example.test\n2026-10-08 [12345] LOCATION: private_location\n'});
 }
 assert.ok(INITIAL_RESTORE_STARTUP.includes('-c log_error_verbosity=verbose'));assert.ok(INITIAL_RESTORE_STARTUP.includes('-c log_min_error_statement=panic'));
 assert.ok(INITIAL_RESTORE_STARTUP.includes('-c log_parameter_max_length_on_error=0'));
});

test('private server reasons supplement unmatched stderr without publishing identifiers',async()=>{
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.sqlstate,'22023');assert.equal(error.errorReason,'EXTENSION_VERSION_UNAVAILABLE');assert.equal(error.tocType,'EXTENSION');
   assert.equal(JSON.stringify(error).includes('private_fixture'),false);return true;
  });assert.equal(observed.logReads,1);assert.equal(observed.removed,true);
 },0,{restoreFailure:true,diagnostic:'pg_restore: from TOC entry 9; 3079 88 EXTENSION private_fixture private_owner\nunmatched private error',
  serverLog:'2026-10-08 [87654] ERROR:  22023: extension "private_fixture" has no installation script nor update path for version "private_version"\n'});
});

test('upstream error locations and extension failures become finite component labels only',async()=>{
 for(const [message,file,origin,reason]of [
  ['could not register a background worker private_fixture','pg_net.c','PG_NET','BACKGROUND_WORKER_REGISTRATION_FAILED'],
  ['invalid secret key private_fixture','pgsodium.c','PGSODIUM','SERVER_KEY_UNAVAILABLE'],
  ['private_fixture must be loaded via shared_preload_libraries','extension.c','POSTGRES_CORE','EXTENSION_MUST_BE_PRELOADED'],
  ['cache lookup failed for private_fixture','lsyscache.c','POSTGRES_CORE','CATALOG_LOOKUP_FAILED'],
  ['private_fixture unknown provider message','private_fixture.c',null,'SERVER_SQLSTATE_REPORTED'],
  ['private_fixture unknown provider message','worker.c',null,'SERVER_SQLSTATE_REPORTED'],
 ])await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.sqlstate,'XX000');assert.equal(error.errorOrigin,origin);assert.equal(error.errorReason,reason);
   const output=JSON.stringify(error);for(const privateValue of ['private_fixture','private@example.test','12345','LOCATION'])assert.equal(output.includes(privateValue),false);
   if(file==='private_fixture.c')assert.equal(error.errorSourceFile,null);return true;
  });assert.equal(observed.logReads,1);assert.equal(observed.removed,true);
 },0,{restoreFailure:true,diagnostic:'unmatched private client diagnostic',serverLog:'2026-10-08 [12345] ERROR:  XX000: '+message+'\n2026-10-08 [12345] DETAIL: private@example.test\n2026-10-08 [12345] LOCATION: private_fixture_routine, /private_fixture/path/'+file+':12345\n'});
 const error=new InitialRestoreError('RESTORE_PROCESS_FAILED',{errorOrigin:'private_fixture'});assert.equal(error.errorOrigin,null);
 assert.equal(JSON.stringify(error).includes('private_fixture'),false);
});

test('public source filenames and semantic topics remain bounded enums rather than private text',async()=>{
 await fixture(async(input,{run})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.errorSourceFile,'schemacmds.c');assert.equal(error.errorOrigin,'POSTGRES_CORE');
   assert.deepEqual(error.errorTopics,['SCHEMA','CREATE']);
   const output=JSON.stringify(error);for(const value of ['private_fixture','private@example.test','87654','CreateSchemaCommand','/private_fixture'])assert.equal(output.includes(value),false);return true;
  });
 },0,{restoreFailure:true,serverLog:'2026-10-08 [87654] ERROR:  XX000: cannot create schema private_fixture private@example.test\n2026-10-08 [87654] LOCATION: CreateSchemaCommand, /private_fixture/schemacmds.c:87654\n'});
 const unsafe=new InitialRestoreError('RESTORE_PROCESS_FAILED',{errorSourceFile:'private_fixture.c',errorTopics:['private_fixture','SCHEMA','private@example.test']});
 assert.equal(unsafe.errorSourceFile,null);assert.deepEqual(unsafe.errorTopics,['SCHEMA']);assert.equal(JSON.stringify(unsafe).includes('private_fixture'),false);
});

test('an unknown SQLSTATE or TOC type is never copied from a private log',async()=>{
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{
   assert.equal(error.sqlstate,null);assert.equal(error.tocType,null);assert.equal(error.errorReason,'UNKNOWN_PROCESS_FAILURE');
   for(const value of ['SECRT','PRIVATE_TYPE','private_fixture','999999'])assert.equal(JSON.stringify(error).includes(value),false);return true;
  });assert.equal(observed.logReads,1);assert.equal(observed.removed,true);
 },0,{restoreFailure:true,diagnostic:'pg_restore: from TOC entry 999999; 5 6 PRIVATE_TYPE private_fixture\nprivate_fixture',serverLog:'2026-10-08 [999999] FATAL:  SECRT: private_fixture\n'});
 const unsafe=new InitialRestoreError('RESTORE_PROCESS_FAILED',{tocType:'private_fixture'});assert.equal(unsafe.tocType,null);
 assert.ok(INITIAL_RESTORE_TOC_TYPES.includes('TABLE DATA'));
});

test('failed or unowned log read cannot replace the original error or bypass cleanup',async()=>{
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),error=>{assert.equal(error.phase,'restore');assert.equal(error.sqlstate,null);assert.equal(error.exitStatus,1);return true;});
  assert.equal(observed.logReads,1);assert.equal(observed.removed,true);
 },0,{restoreFailure:true,logFailure:true});
 await fixture(async(input,{run,observed})=>{
  await assert.rejects(restoreInitialBackup(input,{run}),code('INITIAL_RESTORE_CLEANUP_UNPROVED'));
  assert.equal(observed.logReads,0);assert.equal(observed.removed,false);assert.equal(observed.calls.some(args=>args[2]==='rm'),false);
 },0,{restoreFailure:true,badDiagnosticOwner:true});
});
