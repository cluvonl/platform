import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {restoreInitialBackup,INITIAL_RESTORE_STARTUP} from '../scripts/staging-initial-restore.mjs';
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
 catalog.roles=[{name:bootstrapRole,superuser:true},{name:'postgres',superuser:false}];
 catalog.database=[{owner:'postgres',connection_limit:-1,allow_connections:true,is_template:false,locale_provider:'i',locale:'en-US',encoding:'UTF8',acl:[]}];
 catalog.relations=[{schema:'auth',name:'users',kind:'r'}];
 if(prefix)catalog.relations.push({schema:'app',name:'fixture',kind:'r'});
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
 const observed={calls:[],upgrades:[],removed:false,replays:[],networkArgs:null};let name,started=false,prefix=original.source_history.applied_prefix;
 const catalogSql=new Map(Object.entries(CATALOG_QUERIES).map(([family,query])=>[aggregate(query),family]));
 const inspect=()=>({id:cid,name:'/'+name,image:imageId,config_image:IMAGE,user:'postgres',label:options.badOwner?'third-party':name,
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
  if(args.includes('pg_restore')){assert.ok(args.includes('--single-transaction'));assert.ok(args.includes('--exit-on-error'));assert.equal(input.subarray(0,5).toString(),'PGDMP');if(options.restoreFailure)return failure();return ok('');}
  assert.ok(args.includes('psql'));const role=args[args.indexOf('-U')+1],text=input.toString();
  if(text.includes('CREATE ROLE')){observed.replays.push(text);assert.equal(text.includes('CREATE ROLE "'+bootstrapRole+'";'),false);assert.ok(text.includes('ALTER ROLE "'+bootstrapRole+'"'));return ok('');}
  const query=text.replace(/^SET client_min_messages=warning;\nSET search_path TO '';\n/,'').replace(/;\s*$/,'');
  if(catalogSql.has(query)){
   const family=catalogSql.get(query),value=structuredClone(original.catalog[family]);
   if(options.catalogMismatch&&family==='roles')value.push({name:'unexpected_fixture_role'});
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
test('restored history and source audit must prove the exact prefix before any suffix runs',async()=>{
 for(const option of ['historyMismatch','auditMismatch'])await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_INITIAL_HISTORY_UNPROVED'));assert.equal(observed.upgrades.length,0);assert.equal(observed.removed,true);},3,{[option]:true});
});
test('migration failure cleans the clone and cleanup failure can never return a passing report',async()=>{
 await fixture(async(input,{run,observed})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('RESTORE_PROCESS_FAILED'));assert.equal(observed.removed,true);},0,{upgradeFailure:true});
 await fixture(async(input,{run})=>{await assert.rejects(restoreInitialBackup(input,{run}),code('INITIAL_RESTORE_CLEANUP_UNPROVED'));},0,{cleanupFailure:true});
});
