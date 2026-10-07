import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {hostedBackupCapabilities,stagingBackupCapabilities,runStagingBackupCapabilitiesCli,CAPABILITY_SQL} from '../scripts/staging-backup-capabilities.mjs';
import {PROVEN_DEFAULTS} from '../scripts/pinned-restore-extension-defaults.mjs';
import {projectTarget,databaseTarget,databaseEnvironment} from '../scripts/staging-preflight.mjs';

const REF='fbozlbgmktkgcdfqdaaz';
const environment=()=>({APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:REF,SUPABASE_URL:`https://${REF}.supabase.co`,
 MIGRATION_DATABASE_URL:`postgresql://postgres:test-only-not-a-credential@db.${REF}.supabase.co:5432/postgres`,MIGRATION_SSL_ROOT_CERT_PATH:'/test-only/official-ca.crt',PATH:'/usr/bin'});
const packageName=Object.keys(PROVEN_DEFAULTS)[0];
const profile=()=>({server_version:170011,primary:true,readonly:true,repeatable_read:true,ssl_in_use:true,current_role_postgres:true,
 role_superuser:false,role_bypassrls:true,role_createrole:true,role_createdb:true,bootstrap_anchor_is_current_role:true,bootstrap_anchor_superuser:false,
 private_role_settings_catalog_readable:true,membership_catalog_readable:true,parameter_acl_catalog_readable:true,security_label_catalog_readable:true,
 user_data_relations:10,table_select_denied:0,schema_usage_denied:0,table_rls_filtered:0,unlogged_relations:0,sequences:1,sequence_select_denied:0,
 subscriptions:0,foreign_tables:0,large_objects:0,large_object_acl_denied:0,roles:20,role_memberships:5,parameter_acls:3,custom_tablespaces:0,
 installed_extensions:1,unregistered_extension_relations:0,filtered_extension_config_relations:0,application_tables:0,
 native_identity_column_contract:true,native_session_column_contract:true,native_identity_select_grantable:true,native_session_select_grantable:true,
 supautils_loaded:true,native_identity_policy_owner_available:false,native_session_policy_owner_available:false,
 storage_objects_policy_owner_available:true,native_identity_policy_provider_granted:true,
 native_session_policy_provider_granted:true,storage_objects_policy_provider_granted:false,
 storage_objects_relation_present:true,storage_bucket_relation_present:true,storage_bucket_schema_usage:true,
 storage_bucket_insert_privileged:true,storage_bucket_upsert_update_privileged:true,
 storage_bucket_upsert_select_privileged:true,storage_bucket_rls_filtered:false,local_icu_profile_matches:true,
 private_extension_relations:[],private_extension_versions:[{name:packageName,version:PROVEN_DEFAULTS[packageName]}]});
function harness(value=profile(),counts=[]){
 const calls=[];const execute=async(command,args,options)=>{
  calls.push({command,args,options});
  const stdout=options.input==='\\conninfo\n'?'SSL connection (protocol: TLSv1.3, cipher: test_cipher, compression: off)':JSON.stringify(calls.length===2?value:counts.shift());
  return {status:0,stderr:'',stdout};
 };
 return {calls,execute,run:(env=environment(),extra={})=>hostedBackupCapabilities(env,{execute,projectTarget,databaseTarget,databaseEnvironment,...extra})};
}

test('import/collector performs only explicit readonly counts, with fixed target and CA',async()=>{
 const h=harness(),r=await h.run();assert.equal(r.passed,true);assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].options.input,'\\conninfo\n');
 const c=h.calls[1];assert.equal(c.command,'psql');assert.equal(c.options.env.PGSSLMODE,'verify-full');assert.equal(c.options.env.PGPORT,'5432');
 assert.ok(c.options.env.PGOPTIONS.includes('default_transaction_read_only=on'));assert.ok(c.options.input.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'));
 assert.equal(c.options.input,CAPABILITY_SQL);assert.ok(c.options.input.endsWith('ROLLBACK;\n'));assert.equal(r.remote_ddl_ready,false);assert.equal(r.backup_created,false);
 assert.equal(r.temporary_clone_replay_role_needed,true);assert.equal(r.pinned_extension_profile.matched,1);
 assert.equal(r.proof_limits.native_policy_ddl_verified,false);assert.equal(r.proof_limits.pg_dump_executed,false);
 assert.equal(r.transport.client_tls_protocol,'TLSv1.3');assert.equal(r.transport.client_certificate_verified,true);
 assert.equal(c.args.some(a=>a.includes('test-only-not-a-credential')),false);assert.equal(JSON.stringify(r).includes('test-only-not-a-credential'),false);
});
test('production fails before any query',async()=>{const h=harness(),r=await h.run({...environment(),APP_ENV:'production'});assert.equal(r.passed,false);assert.equal(h.calls.length,0);});
test('different project fails before any query',async()=>{const h=harness(),r=await h.run({...environment(),STAGING_SUPABASE_PROJECT_REF:'a'.repeat(20)});assert.equal(r.passed,false);assert.equal(h.calls.length,0);});
test('missing official CA fails before any query',async()=>{const h=harness(),env=environment();delete env.MIGRATION_SSL_ROOT_CERT_PATH;const r=await h.run(env);assert.equal(r.error,'READ_ONLY_VERIFY_FULL_REQUIRED');assert.equal(h.calls.length,0);});
test('transaction pool port is refused before query',async()=>{const h=harness(),env=environment();env.MIGRATION_DATABASE_URL=env.MIGRATION_DATABASE_URL.replace(':5432',':6543');assert.equal((await h.run(env)).passed,false);assert.equal(h.calls.length,0);});
test('query failure/redaction includes no diagnostic/body',async()=>{const h=harness();const r=await h.run(environment(),{execute:async()=>({status:1,stderr:'private_diagnostic_value_do_not_emit',stdout:'private_body_do_not_emit'})});assert.equal(r.error,'CAPABILITY_QUERY_UNAVAILABLE');assert.equal(JSON.stringify(r).includes('private_'),false);});
test('unexpected warning is failure even when provider process exits zero',async()=>{const h=harness(),r=await h.run(environment(),{execute:async()=>({status:0,stderr:'WARNING: private_diagnostic_value_do_not_emit',stdout:JSON.stringify(profile())})});assert.equal(r.error,'CAPABILITY_QUERY_UNAVAILABLE');});
test('alternative executor cannot pass oversized trimmed output',async()=>{
 const h=harness();let calls=0;
 const r=await h.run(environment(),{execute:async()=>({status:0,stderr:'',stdout:++calls===1?'SSL connection (protocol: TLSv1.3, cipher: test_cipher)':JSON.stringify(profile())+' '.repeat(2_000_001)})});
 assert.equal(r.passed,false);assert.equal(r.error,'CAPABILITY_QUERY_UNAVAILABLE');assert.equal(r.metadata_known,false);
});
test('incomplete profile is unknown, never empty',async()=>{const p=profile();delete p.large_objects;const r=await harness(p).run();assert.equal(r.error,'CAPABILITY_RESPONSE_UNKNOWN');assert.equal(r.metadata_known,false);});
test('unknown fields are rejected and never exported',async()=>{const p=profile();p.private_payload='private_value_do_not_emit';const r=await harness(p).run();assert.equal(r.passed,false);assert.equal(JSON.stringify(r).includes('private_value'),false);});
test('impossible negative/coverage counters are refused',async()=>{for(const patch of [{roles:-1},{table_select_denied:11},{large_object_acl_denied:1}]){const r=await harness({...profile(),...patch}).run();assert.equal(r.error,'CAPABILITY_RESPONSE_UNKNOWN');}});
test('RLS filtering is a measured full-data visibility gap, no SELECT privilege shortcut',async()=>{const r=await harness({...profile(),table_rls_filtered:1}).run();assert.equal(r.passed,true);assert.ok(r.concrete_capture_blockers.includes('DATA_RLS_VISIBILITY_INCOMPLETE'));assert.equal(r.remote_ddl_ready,false);});
test('non-superuser subscriptions are explicitly outside raw dump coverage',async()=>{const r=await harness({...profile(),subscriptions:1}).run();assert.ok(r.concrete_capture_blockers.includes('NONSUPERUSER_SUBSCRIPTIONS_SKIPPED'));});
test('ACL-unreadable largeobjects remain concrete unknown coverage',async()=>{const r=await harness({...profile(),large_objects:1,large_object_acl_denied:1}).run();assert.ok(r.concrete_capture_blockers.includes('LARGEOBJECT_ACL_DENIED'));assert.equal(r.proof_limits.largeobject_bytes_read,false);});
test('known empty extension table is counted with safely quoted names but names never leave report',async()=>{
 const p=profile();p.unregistered_extension_relations=1;p.private_extension_relations=[{schema:'private_schema_label',name:'private_table"label',kind:'r',readable:true,rls_visible:true}];
 const h=harness(p,[{rows:0}]),r=await h.run();assert.equal(h.calls.length,3);assert.ok(h.calls[2].options.input.includes('ONLY "private_schema_label"."private_table""label"'));
 assert.equal(r.unregistered_extension_data.proven_empty,1);assert.equal(JSON.stringify(r).includes('private_schema_label'),false);assert.equal(JSON.stringify(r).includes('private_table'),false);
});
test('RLS-filtered/unreadable extension counts are unknown rather than fabricated zero',async()=>{
 for(const patch of [{readable:false},{rls_visible:false}]){const p=profile();p.unregistered_extension_relations=1;p.private_extension_relations=[{schema:'private_schema_label',name:'private_table_label',kind:'r',readable:true,rls_visible:true,...patch}];const h=harness(p),r=await h.run();assert.equal(h.calls.length,2);assert.equal(r.unregistered_extension_data.unknown,1);assert.ok(r.concrete_capture_blockers.includes('UNREGISTERED_EXTENSION_DATA_COUNT_UNKNOWN'));}
});
test('nonempty extension data omitted by ordinary dump is an actual dataset gap',async()=>{const p=profile();p.unregistered_extension_relations=1;p.private_extension_relations=[{schema:'private_schema_label',name:'private_table_label',kind:'r',readable:true,rls_visible:true}];const r=await harness(p,[{rows:2}]).run();assert.equal(r.unregistered_extension_data.present,1);assert.ok(r.concrete_capture_blockers.includes('UNREGISTERED_EXTENSION_DATA_NOT_DUMPED'));});
test('invalid count/ref duplicates never become empty evidence',async()=>{
 const ref={schema:'private_schema_label',name:'private_table_label',kind:'r',readable:true,rls_visible:true};const p=profile();p.unregistered_extension_relations=1;p.private_extension_relations=[ref];assert.equal((await harness(p,[{rows:-1}]).run()).error,'CAPABILITY_COUNT_UNKNOWN');p.unregistered_extension_relations=2;p.private_extension_relations=[ref,ref];assert.equal((await harness(p).run()).error,'CAPABILITY_RESPONSE_UNKNOWN');
});
test('extension version mismatch is based on proven pinned package subset, names not exported',async()=>{const p=profile();p.private_extension_versions[0].version='999.0';const r=await harness(p).run();assert.equal(r.pinned_extension_profile.mismatched,1);assert.ok(r.concrete_capture_blockers.includes('PINNED_IMAGE_EXTENSION_DEFAULT_MISMATCH'));assert.equal(JSON.stringify(r).includes(packageName),false);});
test('new extension name remains unknown even without a concrete capture blocker',async()=>{const p=profile();p.private_extension_versions[0]={name:'private_unknown_extension_label',version:'1.0'};const r=await harness(p).run();assert.equal(r.passed,true);assert.equal(r.concrete_capture_blockers.length,0);assert.equal(r.pinned_extension_profile.unknown,1);assert.equal(r.pinned_extension_profile.matched,0);assert.equal(r.pinned_extension_profile.known_subset_complete,false);assert.equal(r.pinned_extension_profile.compatibility_status,'unknown_package');assert.equal(r.pinned_extension_profile.full_restore_compatibility_proved,false);assert.equal(JSON.stringify(r).includes('private_unknown'),false);});
test('session-pooler backend may be plaintext while client TLS and verify-full remain proved',async()=>{const h=harness({...profile(),ssl_in_use:false}),env=environment();env.MIGRATION_DATABASE_URL=`postgresql://postgres.${REF}:test-only-not-a-credential@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;const r=await h.run(env);assert.equal(r.passed,true);assert.equal(r.metadata.ssl_in_use,false);assert.equal(r.transport.database_backend_tls,false);assert.equal(r.transport.client_tls_protocol,'TLSv1.3');assert.equal(r.transport.mode,'session_pooler');});
test('backend SSL cannot substitute for missing client TLS evidence',async()=>{const h=harness();const r=await h.run(environment(),{execute:async()=>({status:0,stderr:'',stdout:'You are connected over a private_socket_label'})});assert.equal(r.passed,false);assert.equal(r.error,'DATABASE_CLIENT_TLS_UNVERIFIED');assert.equal(JSON.stringify(r).includes('private_socket_label'),false);});
test('different PostgreSQL engine is measured as a concrete pinned-image mismatch',async()=>{const r=await harness({...profile(),server_version:170010}).run();assert.equal(r.passed,true);assert.ok(r.concrete_capture_blockers.includes('PINNED_IMAGE_POSTGRES_VERSION_MISMATCH'));assert.equal(r.remote_ddl_ready,false);});
test('full16 policy prerequisites measure each Auth and Storage authority separately',async()=>{
 for(const [patch,code] of [
  [{native_identity_policy_provider_granted:false},'NATIVE_IDENTITY_POLICY_CAPABILITY_UNPROVED'],
  [{native_session_policy_provider_granted:false},'NATIVE_SESSION_POLICY_CAPABILITY_UNPROVED'],
  [{storage_objects_policy_owner_available:false},'STORAGE_OBJECTS_POLICY_CAPABILITY_UNPROVED'],
 ]){const r=await harness({...profile(),...patch}).run();assert.equal(r.passed,true);assert.ok(r.native_migration_prerequisite_gaps.includes(code));assert.equal(r.remote_ddl_ready,false);}
});
test('relation ownership and explicit provider policy grant are independent allowed authority routes',async()=>{
 const ownerProfile={...profile(),native_identity_policy_owner_available:true,native_session_policy_owner_available:true,native_identity_policy_provider_granted:false,native_session_policy_provider_granted:false};
 assert.equal((await harness(ownerProfile).run()).native_migration_prerequisite_gaps.length,0);
 const providerProfile={...profile(),storage_objects_policy_owner_available:false,storage_objects_policy_provider_granted:true};
 assert.equal((await harness(providerProfile).run()).native_migration_prerequisite_gaps.length,0);
});
test('missing Storage is an explicit incomplete full16 prerequisite even for a superuser',async()=>{
 const r=await harness({...profile(),role_superuser:true,storage_objects_relation_present:false,storage_bucket_relation_present:false}).run();
 assert.ok(r.native_migration_prerequisite_gaps.includes('STORAGE_OBJECTS_RELATION_MISSING'));assert.ok(r.native_migration_prerequisite_gaps.includes('STORAGE_BUCKET_RELATION_MISSING'));
 assert.equal(r.remote_ddl_ready,false);assert.equal(r.proof_limits.full16_migration_execution_verified,false);
});
test('actual bucket-upsert column rights and unproved RLS route remain distinct metadata gaps',async()=>{
 for(const [patch,code] of [
  [{storage_bucket_insert_privileged:false},'STORAGE_BUCKET_INSERT_PRIVILEGE_MISSING'],
  [{storage_bucket_upsert_update_privileged:false},'STORAGE_BUCKET_UPSERT_UPDATE_PRIVILEGE_MISSING'],
  [{storage_bucket_upsert_select_privileged:false},'STORAGE_BUCKET_UPSERT_SELECT_PRIVILEGE_MISSING'],
  [{storage_bucket_rls_filtered:true},'STORAGE_BUCKET_RLS_WRITE_ROUTE_UNPROVED'],
 ]){const r=await harness({...profile(),...patch}).run();assert.equal(r.passed,true);assert.ok(r.native_migration_prerequisite_gaps.includes(code));assert.equal(r.proof_limits.storage_bucket_upsert_executed,false);}
});

const rootCa=await readFile(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const releaseEnvironment=()=>({...environment(),GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',
 GITHUB_EVENT_NAME:'workflow_dispatch',RELEASE_SHA:'a'.repeat(40)});
const observed=new Date('2026-10-07T09:30:00.000Z');
const readCa=async()=>rootCa;

test('release wrapper binds safe artifact metadata while gaps remain measurement-only',async()=>{
 const h=harness({...profile(),ssl_in_use:false,table_rls_filtered:1});
 const r=await stagingBackupCapabilities(releaseEnvironment(),{execute:h.execute,read:readCa,now:observed});
 assert.equal(r.passed,true);assert.equal(r.environment,'staging');assert.equal(r.project_ref,REF);
 assert.equal(r.source_sha,'a'.repeat(40));assert.equal(r.observed_at,observed.toISOString());
 assert.ok(r.concrete_capture_blockers.includes('DATA_RLS_VISIBILITY_INCOMPLETE'));
 for(const key of ['backup_ready','migration_ready','remote_ddl_ready','full_provider_restore_claim','v1_ready','production_enabled'])assert.equal(r[key],false);
 assert.equal(r.measurement_only,true);assert.equal(h.calls.length,2);
});

test('repository, event, ref and exact SHA gates precede CA reads and database execution',async()=>{
 for(const patch of [{APP_ENV:'production'},{GITHUB_REPOSITORY:'foreign/private-label'},{GITHUB_REF:'refs/heads/main'},
  {GITHUB_EVENT_NAME:'push'},{RELEASE_SHA:'private_invalid_sha_value'},{RELEASE_SHA:'b'.repeat(39)},{RELEASE_SHA:'B'.repeat(40)}]){
  let reads=0,calls=0;
  const r=await stagingBackupCapabilities({...releaseEnvironment(),...patch},{now:observed,
   read:async()=>{reads++;return rootCa;},execute:async()=>{calls++;throw new Error('private_diagnostic');}});
  assert.equal(r.passed,false);assert.equal(r.error,'FIXED_STAGING_RELEASE_REQUIRED');assert.equal(reads,0);assert.equal(calls,0);
  assert.equal('source_sha' in r,false);assert.equal(JSON.stringify(r).includes('private_'),false);
 }
});

test('pinned official CA and its inclusion in the actual bundle are independently required',async()=>{
 for(const kind of ['wrong_official','missing_anchor','unreadable']){
  let calls=0,reads=0;
  const r=await stagingBackupCapabilities(releaseEnvironment(),{now:observed,execute:async()=>{calls++;},read:async()=>{
   reads++;if(kind==='unreadable')throw new Error('private_file_diagnostic');
   return kind==='wrong_official'||kind==='missing_anchor'&&reads===2?Buffer.from('private_certificate_value'):rootCa;
  }});
  assert.equal(r.passed,false);assert.equal(calls,0);
  assert.equal(r.error,kind==='unreadable'?'PINNED_DATABASE_CA_UNAVAILABLE':'PINNED_DATABASE_CA_MISMATCH');
  assert.equal(JSON.stringify(r).includes('private_'),false);
 }
});

test('CLI records only the fixed exclusive0600 artifact and safe measurement summary',async()=>{
 const h=harness(),writes=[],logs=[];
 const r=await runStagingBackupCapabilitiesCli(releaseEnvironment(),{execute:h.execute,read:readCa,now:observed,
  write:async(...args)=>writes.push(args),log:value=>logs.push(value)});
 assert.equal(r.exitCode,0);assert.equal(writes.length,1);assert.equal(logs.length,1);
 assert.equal(writes[0][0],'staging-backup-capabilities.json');assert.deepEqual(writes[0][2],{mode:0o600,flag:'wx'});
 const artifact=JSON.parse(writes[0][1]);assert.equal(artifact.source_sha,'a'.repeat(40));assert.equal(artifact.secret_values_exported,false);
 const summary=JSON.parse(logs[0]);assert.equal(summary.result,'MEASUREMENT_PASS');assert.equal(summary.migration_ready,false);
 for(const value of ['test-only-not-a-credential',packageName,'MIGRATION_DATABASE_URL'])assert.equal(writes[0][1].includes(value)||logs[0].includes(value),false);
});

test('CLI rejects every argument without a CA read or database query',async()=>{
 for(const argv of [['--apply'],['--backup'],['--output=private_output_name']]){
  let reads=0,calls=0;const writes=[],logs=[];
  const r=await runStagingBackupCapabilitiesCli(releaseEnvironment(),{argv,now:observed,read:async()=>{reads++;},
   execute:async()=>{calls++;},write:async(...args)=>writes.push(args),log:value=>logs.push(value)});
  assert.equal(r.exitCode,1);assert.equal(r.report.error,'UNEXPECTED_ARGUMENTS');assert.equal(reads,0);assert.equal(calls,0);
  assert.equal(writes.length,1);assert.equal(JSON.stringify(writes).includes('private_output_name'),false);
  assert.equal(JSON.parse(logs[0]).database_mutations,false);
 }
});

test('CLI suppresses file errors instead of printing paths or diagnostics',async()=>{
 const logs=[];const r=await runStagingBackupCapabilitiesCli(releaseEnvironment(),{argv:['--apply'],now:observed,
  write:async()=>{throw new Error('private_path_and_diagnostic');},log:value=>logs.push(value)});
 assert.equal(r.exitCode,1);assert.deepEqual(logs,['STAGING_BACKUP_CAPABILITIES_REPORT_UNAVAILABLE']);
});

test('actual CLI rejects apply and writes a0600 safe JSON with exit1 in a disposable directory',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'cluvo-capability-cli-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const executable=fileURLToPath(new URL('../scripts/staging-backup-capabilities.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[executable,'--apply'],{cwd:directory,
  env:{PATH:process.env.PATH,LANG:'C.UTF-8',...releaseEnvironment()},encoding:'utf8',timeout:10_000,maxBuffer:65_536});
 assert.equal(result.status,1);assert.equal(result.stderr,'');assert.equal(result.error,undefined);
 const path=join(directory,'staging-backup-capabilities.json'),artifact=JSON.parse(await readFile(path,'utf8'));
 assert.equal((await stat(path)).mode&0o777,0o600);assert.equal(artifact.error,'UNEXPECTED_ARGUMENTS');assert.equal(artifact.database_mutations,false);
 assert.equal(result.stdout.includes('test-only-not-a-credential'),false);
});

test('aggregate measurement deadline and monotonic clock fail closed with bounded child timeouts',async()=>{
 const h=harness();let reads=0;
 const r=await h.run(environment(),{clock:()=>++reads===3?120_001:0});
 assert.equal(r.error,'CAPABILITY_MEASUREMENT_TIMEOUT');assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.timeout,30_000);
 const back=harness();let clockReads=0;const backwards=await back.run(environment(),{clock:()=>clockReads++?-1:0});
 assert.equal(backwards.error,'CAPABILITY_CLOCK_UNAVAILABLE');assert.equal(back.calls.length,0);
});

test('workflow has only manual fixed staging measurement, one database secret and pinned actions',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/staging-backup-capabilities.yml',import.meta.url),'utf8');
 assert.match(workflow,/on:\s*\n\s+workflow_dispatch:\s*\n/);assert.match(workflow,/github.repository == 'cluvonl\/platform' && github.ref == 'refs\/heads\/staging'/);
 assert.match(workflow,/environment: staging/);assert.match(workflow,/timeout-minutes: 5/);assert.match(workflow,/persist-credentials: false/);
 assert.deepEqual([...workflow.matchAll(/\$\{\{ secrets\.([A-Z_]+) \}\}/g)].map(m=>m[1]),['MIGRATION_DATABASE_URL']);
 assert.match(workflow,/sha256sum --check ops\/tls\/supabase-platform-root-ca\.sha256/);
 assert.match(workflow,/node scripts\/staging-backup-capabilities\.mjs/);assert.doesNotMatch(workflow,/\b(push|pull_request|schedule):/);
 assert.match(workflow,/name: cluvo-staging-backup-capabilities-\$\{\{ github.sha \}\}-\$\{\{ github.run_id \}\}/);
 assert.match(workflow,/path: staging-backup-capabilities\.json/);assert.doesNotMatch(workflow,/--apply|SENDGRID|SUPABASE_SECRET_KEY|SUPABASE_PUBLISHABLE_KEY/);
 for(const action of workflow.matchAll(/uses: ([^\s]+)/g))assert.match(action[1],/@[0-9a-f]{40}$/);
});
