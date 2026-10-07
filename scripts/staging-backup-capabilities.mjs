// Read-only staging measurement. Importing performs no work; no apply route.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {projectTarget as validateProjectTarget, databaseTarget as validateDatabaseTarget, databaseEnvironment as validatedDatabaseEnvironment} from './staging-preflight.mjs';
import {executeDatabaseProcess} from './staging-database-process.mjs';
import {PROVEN_DEFAULTS,PROVEN_IMAGE,PROOF_DRIVER_SHA256,PROOF_CATALOG_SHA256} from './pinned-restore-extension-defaults.mjs';
const PROJECT_REF='fbozlbgmktkgcdfqdaaz';
export const RESTORE_IMAGE='public.ecr.aws/supabase/postgres@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53';
class CapabilityError extends Error {constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new CapabilityError(code);};
const fixedError=e=>e instanceof CapabilityError?e.code:'CAPABILITY_CHECK_UNAVAILABLE';
const identifier=value=>'"'+value.replaceAll('"','""')+'"';
const sqlBody=query=>`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL row_security=off;\nSET LOCAL statement_timeout='15s';\n${query}\nROLLBACK;\n`;
const COUNTERS=Object.freeze([
 'user_data_relations','table_select_denied','schema_usage_denied','table_rls_filtered',
 'unlogged_relations','sequences','sequence_select_denied','subscriptions','foreign_tables',
 'large_objects','large_object_acl_denied','roles','role_memberships','parameter_acls',
 'custom_tablespaces','installed_extensions','unregistered_extension_relations',
 'filtered_extension_config_relations','application_tables',
]);
const FLAGS=Object.freeze([
 'primary','readonly','repeatable_read','ssl_in_use','current_role_postgres',
 'role_superuser','role_bypassrls','role_createrole','role_createdb',
 'bootstrap_anchor_is_current_role','bootstrap_anchor_superuser',
 'private_role_settings_catalog_readable','membership_catalog_readable',
 'parameter_acl_catalog_readable','security_label_catalog_readable',
 'native_identity_column_contract','native_session_column_contract',
 'native_identity_select_grantable','native_session_select_grantable',
 'supautils_loaded','native_identity_policy_owner_available','native_session_policy_owner_available',
 'storage_objects_policy_owner_available','native_identity_policy_provider_granted',
 'native_session_policy_provider_granted','storage_objects_policy_provider_granted',
 'storage_objects_relation_present','storage_bucket_relation_present','storage_bucket_schema_usage',
 'storage_bucket_insert_privileged','storage_bucket_upsert_update_privileged',
 'storage_bucket_upsert_select_privileged','storage_bucket_rls_filtered','local_icu_profile_matches',
]);
export const CAPABILITY_SQL=sqlBody(`WITH actor AS (
 SELECT oid,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user
), relations AS (
 SELECT c.oid,c.relkind,c.relpersistence,c.relowner,c.relrowsecurity,c.relforcerowsecurity,n.oid namespace_oid
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','m')
), extra_extension_data AS (
 SELECT c.oid,c.relkind,n.nspname schema,c.relname name,
  (has_table_privilege(current_user,c.oid,'SELECT') OR (EXISTS (
   SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AND NOT EXISTS (
   SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    AND NOT has_column_privilege(current_user,c.oid,a.attnum,'SELECT')))) readable,
  NOT row_security_active(c.oid) rls_visible
 FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
 JOIN pg_class c ON c.oid=d.objid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE d.classid='pg_class'::regclass AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
  AND c.relkind IN ('r','m') AND NOT c.oid=ANY(coalesce(e.extconfig,'{}'::oid[]))
), provider_policy AS (
 SELECT EXISTS (SELECT 1 FROM regexp_split_to_table(current_setting('shared_preload_libraries')||','||current_setting('session_preload_libraries')||','||current_setting('local_preload_libraries'),',') library WHERE btrim(library)='supautils') loaded,
 coalesce(nullif(current_setting('supautils.policy_grants',true),''),'{}')::jsonb -> current_user grants
), identity_columns(name,type) AS (
 VALUES ('id','uuid'),('email','character varying'),('email_confirmed_at','timestamp with time zone'),
 ('deleted_at','timestamp with time zone'),('banned_until','timestamp with time zone')
), session_columns(name,type) AS (
 VALUES ('id','uuid'),('user_id','uuid'),('not_after','timestamp with time zone')
), bucket_columns(name,insert_required,update_required,select_required) AS (
 VALUES ('id',true,false,true),('name',true,false,false),('public',true,true,false),
 ('file_size_limit',true,true,true),('allowed_mime_types',true,true,true)
), bucket_column_access AS (
 SELECT expected.*,a.attnum,
 has_column_privilege(current_user,a.attrelid,a.attnum,'INSERT') can_insert,
 has_column_privilege(current_user,a.attrelid,a.attnum,'UPDATE') can_update,
 has_column_privilege(current_user,a.attrelid,a.attnum,'SELECT') can_select
 FROM bucket_columns expected LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('storage.buckets')
  AND a.attname=expected.name AND a.attnum>0 AND NOT a.attisdropped
)
SELECT jsonb_build_object(
 'server_version',current_setting('server_version_num')::integer,
 'primary',NOT pg_is_in_recovery(),
 'readonly',current_setting('transaction_read_only')='on',
 'repeatable_read',current_setting('transaction_isolation')='repeatable read',
 'ssl_in_use',coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),false),
 'current_role_postgres',current_user='postgres',
 'role_superuser',(SELECT rolsuper FROM actor),'role_bypassrls',(SELECT rolbypassrls FROM actor),
 'role_createrole',(SELECT rolcreaterole FROM actor),'role_createdb',(SELECT rolcreatedb FROM actor),
 'bootstrap_anchor_is_current_role',(SELECT oid=10 FROM actor),
 'bootstrap_anchor_superuser',coalesce((SELECT rolsuper FROM pg_roles WHERE oid=10),false),
 'private_role_settings_catalog_readable',has_column_privilege(current_user,'pg_roles','rolconfig','SELECT'),
 'membership_catalog_readable',has_table_privilege(current_user,'pg_auth_members','SELECT'),
 'parameter_acl_catalog_readable',has_table_privilege(current_user,'pg_parameter_acl','SELECT'),
 'security_label_catalog_readable',has_table_privilege(current_user,'pg_seclabel','SELECT') AND has_table_privilege(current_user,'pg_shseclabel','SELECT'),
 'user_data_relations',(SELECT count(*) FROM relations),
 'table_select_denied',(SELECT count(*) FROM relations r WHERE NOT (has_table_privilege(current_user,r.oid,'SELECT') OR (EXISTS (
  SELECT 1 FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped) AND NOT EXISTS (
  SELECT 1 FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped AND NOT has_column_privilege(current_user,r.oid,a.attnum,'SELECT'))))),
 'schema_usage_denied',(SELECT count(*) FROM relations r WHERE NOT has_schema_privilege(current_user,r.namespace_oid,'USAGE')),
 'table_rls_filtered',(SELECT count(*) FROM relations WHERE row_security_active(oid)),
 'unlogged_relations',(SELECT count(*) FROM relations WHERE relpersistence='u'),
 'sequences',(SELECT count(*) FROM pg_sequence),
 'sequence_select_denied',(SELECT count(*) FROM pg_sequence WHERE NOT has_sequence_privilege(current_user,seqrelid,'SELECT')),
 'subscriptions',(SELECT count(*) FROM pg_subscription WHERE subdbid=(SELECT oid FROM pg_database WHERE datname=current_database())),
 'foreign_tables',(SELECT count(*) FROM pg_foreign_table),
 'large_objects',(SELECT count(*) FROM pg_largeobject_metadata),
 'large_object_acl_denied',(SELECT count(*) FROM pg_largeobject_metadata m WHERE NOT (SELECT rolsuper FROM actor)
  AND NOT pg_has_role(current_user,m.lomowner,'USAGE') AND NOT EXISTS (
   SELECT 1 FROM aclexplode(coalesce(m.lomacl,acldefault('L',m.lomowner))) g
   WHERE g.privilege_type='SELECT' AND CASE WHEN g.grantee=0 THEN true ELSE pg_has_role(current_user,g.grantee,'USAGE') END)),
 'roles',(SELECT count(*) FROM pg_roles),'role_memberships',(SELECT count(*) FROM pg_auth_members),
 'parameter_acls',(SELECT count(*) FROM pg_parameter_acl),
 'custom_tablespaces',(SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global')),
 'installed_extensions',(SELECT count(*) FROM pg_extension),
 'unregistered_extension_relations',(SELECT count(*) FROM extra_extension_data),
 'filtered_extension_config_relations',(SELECT count(*) FROM pg_extension e CROSS JOIN LATERAL unnest(e.extcondition) condition WHERE nullif(btrim(condition),'') IS NOT NULL)
) || jsonb_build_object(
 'application_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'),
 'native_identity_column_contract',NOT EXISTS (SELECT 1 FROM identity_columns expected WHERE NOT EXISTS (
  SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('auth.users') AND a.attname=expected.name
   AND a.attnum>0 AND NOT a.attisdropped AND format_type(a.atttypid,NULL)=expected.type)),
 'native_session_column_contract',NOT EXISTS (SELECT 1 FROM session_columns expected WHERE NOT EXISTS (
  SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('auth.sessions') AND a.attname=expected.name
   AND a.attnum>0 AND NOT a.attisdropped AND format_type(a.atttypid,NULL)=expected.type)),
 'native_identity_select_grantable',to_regclass('auth.users') IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM identity_columns c WHERE NOT has_column_privilege(current_user,to_regclass('auth.users'),c.name,'SELECT WITH GRANT OPTION')),
 'native_session_select_grantable',to_regclass('auth.sessions') IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM session_columns c WHERE NOT has_column_privilege(current_user,to_regclass('auth.sessions'),c.name,'SELECT WITH GRANT OPTION')),
 'supautils_loaded',(SELECT loaded FROM provider_policy),
 'native_identity_policy_owner_available',to_regclass('auth.users') IS NOT NULL AND ((SELECT rolsuper FROM actor) OR coalesce((SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_class c WHERE c.oid=to_regclass('auth.users')),false)),
 'native_session_policy_owner_available',to_regclass('auth.sessions') IS NOT NULL AND ((SELECT rolsuper FROM actor) OR coalesce((SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_class c WHERE c.oid=to_regclass('auth.sessions')),false)),
 'storage_objects_policy_owner_available',to_regclass('storage.objects') IS NOT NULL AND ((SELECT rolsuper FROM actor) OR coalesce((SELECT pg_has_role(current_user,c.relowner,'USAGE') FROM pg_class c WHERE c.oid=to_regclass('storage.objects')),false)),
 'native_identity_policy_provider_granted',to_regclass('auth.users') IS NOT NULL AND coalesce((SELECT loaded AND grants ? 'auth.users' FROM provider_policy),false),
 'native_session_policy_provider_granted',to_regclass('auth.sessions') IS NOT NULL AND coalesce((SELECT loaded AND grants ? 'auth.sessions' FROM provider_policy),false),
 'storage_objects_policy_provider_granted',to_regclass('storage.objects') IS NOT NULL AND coalesce((SELECT loaded AND grants ? 'storage.objects' FROM provider_policy),false),
 'storage_objects_relation_present',to_regclass('storage.objects') IS NOT NULL,
 'storage_bucket_relation_present',to_regclass('storage.buckets') IS NOT NULL,
 'storage_bucket_schema_usage',coalesce(has_schema_privilege(current_user,to_regnamespace('storage'),'USAGE'),false),
 'storage_bucket_insert_privileged',NOT EXISTS (SELECT 1 FROM bucket_column_access WHERE insert_required AND (attnum IS NULL OR NOT can_insert)),
 'storage_bucket_upsert_update_privileged',NOT EXISTS (SELECT 1 FROM bucket_column_access WHERE update_required AND (attnum IS NULL OR NOT can_update)),
 'storage_bucket_upsert_select_privileged',NOT EXISTS (SELECT 1 FROM bucket_column_access WHERE select_required AND (attnum IS NULL OR NOT can_select)),
 'storage_bucket_rls_filtered',coalesce((SELECT row_security_active(c.oid) FROM pg_class c WHERE c.oid=to_regclass('storage.buckets')),false),
 'local_icu_profile_matches',(SELECT encoding=pg_char_to_encoding('UTF8') AND datlocprovider='i' AND datcollate='en_US.UTF-8'
  AND datctype='en_US.UTF-8' AND datlocale='en-US' AND daticurules IS NULL FROM pg_database WHERE datname=current_database()),
 'private_extension_relations',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',schema,'name',name,'kind',relkind,'readable',readable,'rls_visible',rls_visible) ORDER BY schema,name) FROM extra_extension_data),'[]'::jsonb),
 'private_extension_versions',coalesce((SELECT jsonb_agg(jsonb_build_object('name',extname,'version',extversion) ORDER BY extname) FROM pg_extension),'[]'::jsonb)
);`);

function metadataProfile(value){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('CAPABILITY_RESPONSE_UNKNOWN');
 const keys=new Set(['server_version',...COUNTERS,...FLAGS,'private_extension_relations','private_extension_versions']);
 if(Object.keys(value).some(k=>!keys.has(k))||Object.keys(value).length!==keys.size)fail('CAPABILITY_RESPONSE_UNKNOWN');
 if(!Number.isSafeInteger(value.server_version)||value.server_version<100000)fail('CAPABILITY_RESPONSE_UNKNOWN');
 if(COUNTERS.some(k=>!Number.isSafeInteger(value[k])||value[k]<0)||FLAGS.some(k=>typeof value[k]!=='boolean'))fail('CAPABILITY_RESPONSE_UNKNOWN');
 for(const [denied,total] of [['table_select_denied','user_data_relations'],['schema_usage_denied','user_data_relations'],['table_rls_filtered','user_data_relations'],['sequence_select_denied','sequences'],['large_object_acl_denied','large_objects']])if(value[denied]>value[total])fail('CAPABILITY_RESPONSE_UNKNOWN');
 const refs=value.private_extension_relations,versions=value.private_extension_versions;
 if(!Array.isArray(refs)||refs.length!==value.unregistered_extension_relations||!Array.isArray(versions)||versions.length!==value.installed_extensions)fail('CAPABILITY_RESPONSE_UNKNOWN');
 const seen=new Set();
 for(const r of refs){
  if(!r||Object.keys(r).sort().join(',')!=='kind,name,readable,rls_visible,schema'||typeof r.readable!=='boolean'||typeof r.rls_visible!=='boolean'||!['r','m'].includes(r.kind))fail('CAPABILITY_RESPONSE_UNKNOWN');
  for(const key of ['schema','name'])if(typeof r[key]!=='string'||!r[key]||Buffer.byteLength(r[key])>63||/[\x00-\x1f\x7f]/.test(r[key]))fail('CAPABILITY_RESPONSE_UNKNOWN');
  const key=JSON.stringify([r.schema,r.name]);if(seen.has(key))fail('CAPABILITY_RESPONSE_UNKNOWN');seen.add(key);
 }
 const names=new Set();
 for(const v of versions){if(!v||Object.keys(v).sort().join(',')!=='name,version'||typeof v.name!=='string'||!/^[a-zA-Z0-9_.-]{1,63}$/.test(v.name)||typeof v.version!=='string'||!/^[a-zA-Z0-9_.+-]{1,63}$/.test(v.version)||names.has(v.name))fail('CAPABILITY_RESPONSE_UNKNOWN');names.add(v.name);}
 return value;
}

export async function hostedBackupCapabilities(environment,{
 execute=executeDatabaseProcess,projectTarget=validateProjectTarget,databaseTarget=validateDatabaseTarget,databaseEnvironment=validatedDatabaseEnvironment,
 clock=()=>performance.now(),
}={}){
 const base={database_mutations:false,secret_values_exported:false,raw_catalog_exported:false,
  backup_created:false,restore_executed:false,remote_ddl_ready:false,full_provider_restore_claim:false,
  basis:'read_only_metadata_and_counts',restore_image:RESTORE_IMAGE};
 try{
  if(environment.APP_ENV!=='staging'||environment.STAGING_SUPABASE_PROJECT_REF!==PROJECT_REF)fail('FIXED_STAGING_PROJECT_REQUIRED');
  if(typeof execute!=='function'||typeof projectTarget!=='function'||typeof databaseTarget!=='function'||typeof databaseEnvironment!=='function')fail('VALIDATED_DATABASE_HELPERS_REQUIRED');
  if(projectTarget(environment).ref!==PROJECT_REF)fail('FIXED_STAGING_PROJECT_REQUIRED');
  const target=databaseTarget(environment.MIGRATION_DATABASE_URL,PROJECT_REF),env=databaseEnvironment(target,environment);
  if(PROVEN_IMAGE!==RESTORE_IMAGE)fail('RESTORE_EXTENSION_PROFILE_IMAGE_MISMATCH');
  if(env.PGSSLMODE!=='verify-full'||!env.PGSSLROOTCERT||env.PGPORT!=='5432'||!env.PGOPTIONS?.includes('default_transaction_read_only=on'))fail('READ_ONLY_VERIFY_FULL_REQUIRED');
  const started=clock();let lastClock=started;
  if(!Number.isFinite(started))fail('CAPABILITY_CLOCK_UNAVAILABLE');
  const queryText=async input=>{
   const current=clock();
   if(!Number.isFinite(current)||current<lastClock)fail('CAPABILITY_CLOCK_UNAVAILABLE');
   lastClock=current;const remaining=Math.ceil(120_000-(current-started));
   if(remaining<=0)fail('CAPABILITY_MEASUREMENT_TIMEOUT');
   const result=await execute('psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{env,input,encoding:'utf8',timeout:Math.min(30_000,remaining),maxBuffer:2_000_000});
   const completed=clock();
   if(!Number.isFinite(completed)||completed<lastClock)fail('CAPABILITY_CLOCK_UNAVAILABLE');
   lastClock=completed;if(completed-started>=120_000)fail('CAPABILITY_MEASUREMENT_TIMEOUT');
   if(result?.error||result?.status!==0||typeof result?.stderr!=='string'||typeof result?.stdout!=='string')fail('CAPABILITY_QUERY_UNAVAILABLE');
   if(Buffer.byteLength(result.stdout)+Buffer.byteLength(result.stderr)>2_000_000||result.stderr.trim())fail('CAPABILITY_QUERY_UNAVAILABLE');
   return result.stdout.trim();
  };
  // pg_stat_ssl describes the server backend behind the session pooler.
  // The libpq client is measured independently, with no raw conninfo export.
  const connection=await queryText('\\conninfo\n');
  const clientTlsProtocol=connection.match(/SSL connection \(protocol:\s*(TLSv1\.[23])[,)]/i)?.[1];
  if(!clientTlsProtocol)fail('DATABASE_CLIENT_TLS_UNVERIFIED');
  const query=async input=>{const result=await queryText(input);try{return JSON.parse(result);}catch{fail('CAPABILITY_RESPONSE_UNKNOWN');}};
  const profile=metadataProfile(await query(CAPABILITY_SQL));
  if(!profile.readonly||!profile.repeatable_read||!profile.primary||!profile.current_role_postgres)fail('CAPABILITY_SESSION_PROFILE_MISMATCH');
  let extensionEmpty=0,extensionNonempty=0,extensionUnknown=0;
  for(const ref of profile.private_extension_relations){
   if(!ref.readable||!ref.rls_visible){extensionUnknown++;continue;}
   const value=await query(sqlBody(`SELECT jsonb_build_object('rows',count(*)) FROM ${ref.kind==='r'?'ONLY ':''}${identifier(ref.schema)}.${identifier(ref.name)};`));
   if(!value||Object.keys(value).join(',')!=='rows'||!Number.isSafeInteger(value.rows)||value.rows<0)fail('CAPABILITY_COUNT_UNKNOWN');
   if(value.rows===0)extensionEmpty++;else extensionNonempty++;
  }
  let extensionMatched=0,extensionMismatch=0,extensionCompatibilityUnknown=0;
  for(const version of profile.private_extension_versions){
   const supported=PROVEN_DEFAULTS[version.name];
   if(typeof supported!=='string')extensionCompatibilityUnknown++;
   else if(supported===version.version)extensionMatched++;
   else extensionMismatch++;
  }
  const measured=Object.fromEntries(['server_version',...COUNTERS,...FLAGS].map(k=>[k,profile[k]]));
  const blockers=[];
  if(profile.server_version!==170011)blockers.push('PINNED_IMAGE_POSTGRES_VERSION_MISMATCH');
  for(const [field,code] of [['table_select_denied','DATA_SELECT_DENIED'],['schema_usage_denied','DATA_SCHEMA_USAGE_DENIED'],['table_rls_filtered','DATA_RLS_VISIBILITY_INCOMPLETE'],['sequence_select_denied','SEQUENCE_SELECT_DENIED'],['large_object_acl_denied','LARGEOBJECT_ACL_DENIED'],['foreign_tables','FOREIGN_DATA_NOT_IN_LOGICAL_DUMP'],['custom_tablespaces','CUSTOM_TABLESPACE_PATH_UNPROVED']])if(profile[field]>0)blockers.push(code);
  if(profile.subscriptions>0&&!profile.role_superuser)blockers.push('NONSUPERUSER_SUBSCRIPTIONS_SKIPPED');
  if(extensionNonempty>0)blockers.push('UNREGISTERED_EXTENSION_DATA_NOT_DUMPED');
  if(extensionUnknown>0)blockers.push('UNREGISTERED_EXTENSION_DATA_COUNT_UNKNOWN');
  if(extensionMismatch>0)blockers.push('PINNED_IMAGE_EXTENSION_DEFAULT_MISMATCH');
  for(const [flag,code] of [['private_role_settings_catalog_readable','PRIVATE_ROLE_SETTINGS_UNREADABLE'],['membership_catalog_readable','MEMBERSHIP_CATALOG_UNREADABLE'],['parameter_acl_catalog_readable','PARAMETER_ACL_CATALOG_UNREADABLE'],['security_label_catalog_readable','SECURITY_LABEL_CATALOG_UNREADABLE']])if(!profile[flag])blockers.push(code);
  const nativeGaps=[];
  for(const [flag,code] of [['role_createrole','NATIVE_OWNER_ROLE_CREATION_UNPROVED'],['native_identity_column_contract','NATIVE_IDENTITY_COLUMN_CONTRACT_DIFFERENT'],['native_session_column_contract','NATIVE_SESSION_COLUMN_CONTRACT_DIFFERENT'],['native_identity_select_grantable','NATIVE_IDENTITY_GRANT_OPTION_MISSING'],['native_session_select_grantable','NATIVE_SESSION_GRANT_OPTION_MISSING']])if(!profile[flag])nativeGaps.push(code);
  for(const [owner,provider,code] of [
   ['native_identity_policy_owner_available','native_identity_policy_provider_granted','NATIVE_IDENTITY_POLICY_CAPABILITY_UNPROVED'],
   ['native_session_policy_owner_available','native_session_policy_provider_granted','NATIVE_SESSION_POLICY_CAPABILITY_UNPROVED'],
   ['storage_objects_policy_owner_available','storage_objects_policy_provider_granted','STORAGE_OBJECTS_POLICY_CAPABILITY_UNPROVED'],
  ])if(!profile[owner]&&!profile[provider])nativeGaps.push(code);
  for(const [flag,code] of [['storage_objects_relation_present','STORAGE_OBJECTS_RELATION_MISSING'],['storage_bucket_relation_present','STORAGE_BUCKET_RELATION_MISSING'],['storage_bucket_schema_usage','STORAGE_BUCKET_SCHEMA_USAGE_DENIED'],['storage_bucket_insert_privileged','STORAGE_BUCKET_INSERT_PRIVILEGE_MISSING'],['storage_bucket_upsert_update_privileged','STORAGE_BUCKET_UPSERT_UPDATE_PRIVILEGE_MISSING'],['storage_bucket_upsert_select_privileged','STORAGE_BUCKET_UPSERT_SELECT_PRIVILEGE_MISSING']])if(!profile[flag])nativeGaps.push(code);
  if(profile.storage_bucket_rls_filtered)nativeGaps.push('STORAGE_BUCKET_RLS_WRITE_ROUTE_UNPROVED');
  return {...base,passed:true,metadata:measured,concrete_capture_blockers:blockers,
   transport:{mode:target.mode,client_tls_protocol:clientTlsProtocol,client_certificate_verified:true,database_backend_tls:profile.ssl_in_use},
   native_migration_prerequisite_gaps:nativeGaps,
   unregistered_extension_data:{proven_empty:extensionEmpty,present:extensionNonempty,unknown:extensionUnknown},
   pinned_extension_profile:{matched:extensionMatched,mismatched:extensionMismatch,unknown:extensionCompatibilityUnknown,
    known_subset_complete:extensionCompatibilityUnknown===0&&extensionMismatch===0,
    compatibility_status:extensionMismatch>0?'known_version_mismatch':extensionCompatibilityUnknown>0?'unknown_package':'known_subset_matches',
    full_restore_compatibility_proved:false,
    basis:'completed_local_restore_six_extension_subset',proof_driver_sha256:PROOF_DRIVER_SHA256,proof_catalog_sha256:PROOF_CATALOG_SHA256},
   temporary_clone_replay_role_needed:!profile.bootstrap_anchor_superuser,
   proof_limits:{count_connections_share_backup_snapshot:false,role_passwords_collected:false,
    root_keys_collected:false,largeobject_bytes_read:false,pg_dump_executed:false,
    native_policy_ddl_verified:false,auth_health_version_is_binary_attestation:false,
    storage_bucket_upsert_executed:false,full16_migration_execution_verified:false,
    extension_member_definitions_compared:false,full_private_catalog_captured:false}};
 }catch(error){return {...base,passed:false,error:fixedError(error),metadata_known:false};}
}

const CA_SHA256='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
const REPORT_NAME='staging-backup-capabilities.json';

function releaseReport(environment,now){
 const report={environment:'staging',project_ref:PROJECT_REF,observed_at:now.toISOString(),
  measurement_only:true,read_only:true,database_mutations:false,provider_mutations:false,
  email_sent:false,secret_values_exported:false,raw_catalog_exported:false,
  backup_created:false,restore_executed:false,backup_ready:false,migration_ready:false,
  remote_ddl_ready:false,full_provider_restore_claim:false,v1_ready:false,production_enabled:false};
 if(environment.APP_ENV==='staging'&&environment.GITHUB_REPOSITORY==='cluvonl/platform'
  &&environment.GITHUB_REF==='refs/heads/staging'&&environment.GITHUB_EVENT_NAME==='workflow_dispatch'
  &&/^[0-9a-f]{40}$/.test(environment.RELEASE_SHA??''))report.source_sha=environment.RELEASE_SHA;
 return report;
}

async function verifyPinnedCa(environment,read){
 const path=environment.MIGRATION_SSL_ROOT_CERT_PATH;
 if(typeof path!=='string'||!path||path.length>4096||/[\r\n\0]/.test(path))fail('READ_ONLY_VERIFY_FULL_REQUIRED');
 try{
  const official=await read(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
  const bundle=await read(path);
  if(!Buffer.isBuffer(official)||!Buffer.isBuffer(bundle)||official.length>65_536||bundle.length>5_000_000
   ||createHash('sha256').update(official).digest('hex')!==CA_SHA256||!bundle.includes(official))fail('PINNED_DATABASE_CA_MISMATCH');
 }catch(error){if(error instanceof CapabilityError)throw error;fail('PINNED_DATABASE_CA_UNAVAILABLE');}
}

// passed means metadata/counts were measured. Gaps never confer migration authority.
export async function stagingBackupCapabilities(environment,{now=new Date(),read=readFile,...options}={}){
 const report=releaseReport(environment,now);
 try{
  if(!report.source_sha)fail('FIXED_STAGING_RELEASE_REQUIRED');
  if(validateProjectTarget(environment).ref!==PROJECT_REF)fail('FIXED_STAGING_PROJECT_REQUIRED');
  await verifyPinnedCa(environment,read);
  return {...report,...await hostedBackupCapabilities(environment,options)};
 }catch(error){return {...report,passed:false,error:fixedError(error),metadata_known:false};}
}

export async function runStagingBackupCapabilitiesCli(environment,{
 argv=[],write=writeFile,log=value=>console.log(value),now=new Date(),...options
}={}){
 let report;
 try{
  report=argv.length?{...releaseReport(environment,now),passed:false,error:'UNEXPECTED_ARGUMENTS',metadata_known:false}
   :await stagingBackupCapabilities(environment,{now,...options});
  await write(REPORT_NAME,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  log(JSON.stringify({result:report.passed?'MEASUREMENT_PASS':'FAIL',measurement_only:true,
   concrete_capture_blocker_count:report.concrete_capture_blockers?.length??0,
   migration_prerequisite_gap_count:report.native_migration_prerequisite_gaps?.length??0,
   ...(report.error?{error:report.error}:{}),backup_created:false,restore_executed:false,
   migration_ready:false,database_mutations:false,remote_ddl_ready:false}));
  return {exitCode:report.passed?0:1,report};
 }catch{
  log('STAGING_BACKUP_CAPABILITIES_REPORT_UNAVAILABLE');
  return {exitCode:1};
 }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const result=await runStagingBackupCapabilitiesCli(process.env,{argv:process.argv.slice(2)});
 process.exitCode=result.exitCode;
}
