import {executeDatabaseProcess} from './staging-database-process.mjs';

// Read-only inventory reuses the preflight target and libpq environment guards.
// The caller supplies the same pinned project/session5432 connection path.
// This module does not read keys, generate secrets, write files or mutate DBs.
const PROJECT_REF='fbozlbgmktkgcdfqdaaz';
class InventoryError extends Error {constructor(code){super(code);this.code=code;}}
const fail=(code)=>{throw new InventoryError(code);};
const ident=(value)=>'"'+String(value).replaceAll('"','""')+'"';
const string=(value)=>"'"+String(value).replaceAll("'","''")+"'";
const textType=(value)=>value==='text'||/^character varying(?:\(\d+\))?$/.test(value);

export const DATASETS=Object.freeze([
 {id:'vault',schema:'vault',table:'secrets',column:'secret',type:'text',kind:'vault',key_family:'managed_vault_pgsodium',optional:true,source:'https://supabase.com/docs/guides/database/vault'},
 {id:'pgsodium_keys',schema:'pgsodium',table:'key',column:'raw_key',type:'bytea',kind:'key_definitions',key_family:'managed_vault_pgsodium',optional:true,source:'https://supabase.com/docs/guides/database/extensions/pgsodium'},
 {id:'auth_password_envelopes',schema:'auth',table:'users',column:'encrypted_password',type:'text',kind:'auth_envelope',key_family:'auth_db_encryption',optional:false,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/user.go#L409'},
 {id:'auth_mfa_factor_envelopes',schema:'auth',table:'mfa_factors',column:'secret',type:'text',kind:'auth_envelope',key_family:'auth_db_encryption',optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/factor.go#L289'},
 {id:'auth_mfa_challenge_envelopes',schema:'auth',table:'mfa_challenges',column:'otp_code',type:'text',kind:'auth_envelope',key_family:'auth_db_encryption',optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/challenge.go#L99'},
 {id:'auth_session_hmac_envelopes',schema:'auth',table:'sessions',column:'refresh_token_hmac_key',type:'text',kind:'auth_envelope',key_family:'auth_db_encryption',optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/sessions.go#L123'},
 {id:'auth_oauth_provider_envelopes',schema:'auth',table:'custom_oauth_providers',column:'client_secret',type:'text',kind:'auth_envelope',key_family:'auth_db_encryption',optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/custom_oauth_provider.go#L69'},
 {id:'oauth_client_hashes',schema:'auth',table:'oauth_clients',column:'client_secret_hash',type:'text',kind:'hashed',key_family:null,optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/api/oauthserver/service.go#L233'},
 {id:'oauth_flow_access_tokens',schema:'auth',table:'flow_state',column:'provider_access_token',type:'text',kind:'private_plaintext',key_family:null,optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/migrations/20230322519590_add_flow_state_table.up.sql'},
 {id:'oauth_flow_refresh_tokens',schema:'auth',table:'flow_state',column:'provider_refresh_token',type:'text',kind:'private_plaintext',key_family:null,optional:true,source:'https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/migrations/20230322519590_add_flow_state_table.up.sql'},
 {id:'storage_objects',schema:'storage',table:'objects',kind:'storage_metadata',key_family:null,optional:true,source:'https://supabase.com/docs/guides/platform/backups'},
]);

export const CATALOG_SQL=`SELECT json_build_object(
 'namespaces',(SELECT coalesce(json_agg(nspname ORDER BY nspname),'[]'::json) FROM pg_namespace WHERE nspname IN ('auth','vault','pgsodium','storage')),
 'role_security',(SELECT json_build_object('superuser',rolsuper,'bypass_rls',rolbypassrls) FROM pg_roles WHERE rolname=current_user),
 'relations',(SELECT coalesce(json_agg(row_to_json(t) ORDER BY schema_name,table_name),'[]'::json) FROM (
   SELECT n.nspname schema_name,c.relname table_name,c.relkind kind,
     has_table_privilege(current_user,c.oid,'SELECT') count_readable,
     c.relrowsecurity rls_enabled,c.relforcerowsecurity force_rls,
     c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) owner_matches_current,
     row_security_active(c.oid) row_security_active,
     (SELECT coalesce(json_agg(json_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod)) ORDER BY a.attnum),'[]'::json)
       FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) columns
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('auth','vault','pgsodium','storage') AND c.relkind IN ('r','p','v','m','f')
 )t),
 'tce_labels',(SELECT coalesce(json_agg(row_to_json(t) ORDER BY schema_name,table_name,column_name),'[]'::json) FROM (
   SELECT n.nspname schema_name,c.relname table_name,a.attname column_name,
     CASE WHEN a.attnum IS NULL THEN NULL ELSE format_type(a.atttypid,a.atttypmod) END data_type,
     has_table_privilege(current_user,c.oid,'SELECT') count_readable,
     s.objsubid=0 table_label
   FROM pg_seclabel s JOIN pg_class c ON c.oid=s.objoid JOIN pg_namespace n ON n.oid=c.relnamespace
   LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=s.objsubid AND NOT a.attisdropped
   WHERE s.classoid='pg_class'::regclass AND s.provider='pgsodium'
 )t)
);`;

function validateCatalog(catalog){
 if(!catalog||!Array.isArray(catalog.namespaces)||!Array.isArray(catalog.relations)||!Array.isArray(catalog.tce_labels)||typeof catalog.role_security?.superuser!=='boolean'||typeof catalog.role_security?.bypass_rls!=='boolean')fail('DATASET_CATALOG_UNKNOWN');
 if(!catalog.namespaces.includes('auth'))fail('AUTH_SCHEMA_UNKNOWN');
 const seen=new Set();for(const r of catalog.relations){
  const key=r.schema_name+'.'+r.table_name;
  if(typeof r.schema_name!=='string'||typeof r.table_name!=='string'||!['auth','vault','pgsodium','storage'].includes(r.schema_name)||!Array.isArray(r.columns)||['count_readable','rls_enabled','force_rls','owner_matches_current','row_security_active'].some(k=>typeof r[k]!=='boolean')||seen.has(key))fail('DATASET_CATALOG_UNKNOWN');seen.add(key);
  for(const c of r.columns)if(typeof c.name!=='string'||typeof c.type!=='string')fail('DATASET_CATALOG_UNKNOWN');
 }
 for(const l of catalog.tce_labels)if(typeof l.schema_name!=='string'||typeof l.table_name!=='string'||typeof l.table_label!=='boolean'||typeof l.count_readable!=='boolean')fail('TCE_CATALOG_UNKNOWN');
}
export function inventoryPlan(catalog){
 validateCatalog(catalog);const plans=[];const known=new Set(DATASETS.filter(d=>d.column).map(d=>d.schema+'.'+d.table+'.'+d.column));
 for(const dataset of DATASETS){
  const relation=catalog.relations.find(r=>r.schema_name===dataset.schema&&r.table_name===dataset.table);
  if(!relation){if(!dataset.optional)fail('REQUIRED_DATASET_TABLE_MISSING');plans.push({...dataset,state:'empty',absence_proven:true,relation_present:false,count:0,sql:null});continue;}
  if(!['r','p'].includes(relation.kind))fail('DATASET_RELATION_KIND_UNKNOWN');
  if(!relation.count_readable)fail('DATASET_COUNT_PERMISSION_UNKNOWN');
  const noFilter=catalog.role_security.superuser||catalog.role_security.bypass_rls||!relation.rls_enabled||(relation.owner_matches_current&&!relation.force_rls);
  if(relation.row_security_active||!noFilter)fail('DATASET_COUNT_SCOPE_UNKNOWN');
  const column=dataset.column&&relation.columns.find(c=>c.name===dataset.column);
  if(dataset.column&&!column)fail('DATASET_COLUMN_MISSING');
  if(column&&!(dataset.type==='text'?textType(column.type):column.type===dataset.type))fail('DATASET_COLUMN_TYPE_UNKNOWN');
  const name=ident(dataset.schema)+'.'+ident(dataset.table),col=column&&ident(column.name);
  let count='count(*)',nonempty=col?`count(*) FILTER (WHERE ${col} IS NOT NULL${textType(column?.type)?` AND ${col} <> ''`:''})`:'count(*)',validEnvelope='0',legacy='0';
  if(dataset.kind==='auth_envelope'){
   const candidate=`${col} IS NOT NULL AND left(ltrim(${col}),1)='{'`;
   count=`count(*) FILTER (WHERE ${candidate})`;
   // CASE prevents malformed JSON from being cast; only final counts leave DB.
   // Unknown/invalid envelope formats stay UNKNOWN, never empty or plaintext.
   // Auth serializes []byte through Go encoding/json: standard base64, with
   // optional data padding; its twelve-byte GCM nonce has sixteen characters.
   validEnvelope=`count(*) FILTER (WHERE CASE WHEN ${candidate} AND left(${col},1)='{' AND pg_input_is_valid(${col},'jsonb') THEN (${col}::jsonb ->> 'alg')='aes-gcm-hkdf' AND jsonb_typeof(${col}::jsonb -> 'key_id')='string' AND nullif(${col}::jsonb ->> 'key_id','') IS NOT NULL AND jsonb_typeof(${col}::jsonb -> 'data')='string' AND (${col}::jsonb ->> 'data') ~ '^[A-Za-z0-9+/]+={0,2}$' AND length(${col}::jsonb ->> 'data')%4=0 AND jsonb_typeof(${col}::jsonb -> 'nonce')='string' AND (${col}::jsonb ->> 'nonce') ~ '^[A-Za-z0-9+/]{16}$' ELSE false END)`;
   const legacyPattern=dataset.id==='auth_password_envelopes'?'^\\$(2[aby]\\$|argon2(id|i|d)\\$)':dataset.id==='auth_mfa_factor_envelopes'?'^[A-Z2-7]{16,128}$':dataset.id==='auth_mfa_challenge_envelopes'?'^[0-9]{6,10}$':dataset.id==='auth_session_hmac_envelopes'?'^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$':null;
   // OAuth secrets are provider-specific opaque strings. A non-envelope value
   // is counted but remains UNKNOWN until its exact provider format is reviewed.
   if(legacyPattern)legacy=`count(*) FILTER (WHERE ${col} IS NOT NULL AND ${col} ~ ${string(legacyPattern)})`;
  }
  else if(dataset.kind==='key_definitions')count=`count(*) FILTER (WHERE ${col} IS NOT NULL)`;
  else if(['hashed','private_plaintext'].includes(dataset.kind))count=nonempty;
  plans.push({...dataset,state:'not_measured',absence_proven:false,relation_present:true,column_type:column?.type??null,count_readable:true,known:true,sql:`SELECT json_build_object('id',${string(dataset.id)},'count',${count},'valid_envelope_count',${validEnvelope},'legacy_count',${legacy},'nonempty_count',${nonempty},'row_count',count(*)) FROM ${name};`});
 }
 // A discovered, unclassified cryptographic column is UNKNOWN even when an
 // attempted count might be zero. No fallback guesses a changed schema empty.
 for(const relation of catalog.relations){
  if(!['auth','vault','pgsodium'].includes(relation.schema_name)||!['r','p','m'].includes(relation.kind))continue;
  for(const column of relation.columns){
   const key=relation.schema_name+'.'+relation.table_name+'.'+column.name;
   if(/encrypted|secret|hmac_key|otp_code|raw_key/i.test(column.name)&&!known.has(key))fail('UNCLASSIFIED_CRYPTOGRAPHIC_COLUMN');
  }
 }
 for(const label of catalog.tce_labels){
  const canonicalKey=label.schema_name==='pgsodium'&&label.table_name==='key';
  if(canonicalKey&&(label.table_label||label.column_name==='raw_key'))continue;
  if(label.table_label||typeof label.column_name!=='string')fail('UNCLASSIFIED_TCE_CONTRACT');
  if(!label.count_readable)fail('TCE_COUNT_PERMISSION_UNKNOWN');
  // Known field names (including hashed/plaintext OAuth fields) do not approve
  // a new pgsodium encryption contract. Only canonical raw_key is classified.
  fail('UNCLASSIFIED_TCE_COLUMN');
 }
 return plans;
}
export function inventoryReport(plans,counts){
 const datasets=plans.map(plan=>{
  if(plan.absence_proven)return {id:plan.id,state:'empty',absence_proven:true,known:true,count_readable:null,column_type:null,count:0,key_family:plan.key_family,source:plan.source};
  const result=counts.find(r=>r.id===plan.id);if(!result||['count','nonempty_count','row_count'].some(k=>!Number.isSafeInteger(result[k])||result[k]<0)||result.count>result.nonempty_count||result.count>result.row_count||result.nonempty_count>result.row_count)fail('DATASET_COUNT_UNKNOWN');
  if(plan.kind==='auth_envelope'&&(!Number.isSafeInteger(result.valid_envelope_count)||result.valid_envelope_count<0||result.valid_envelope_count!==result.count))fail('AUTH_ENVELOPE_FORMAT_UNKNOWN');
  if(plan.kind==='auth_envelope'&&(!Number.isSafeInteger(result.legacy_count)||result.legacy_count<0||result.count+result.legacy_count!==result.nonempty_count))fail('AUTH_LEGACY_FORMAT_UNKNOWN');
  return {id:plan.id,state:result.count===0?'empty':'present',known:true,count_readable:true,column_type:plan.column_type,count:result.count,nonempty_count:result.nonempty_count,row_count:result.row_count,legacy_count:plan.kind==='auth_envelope'?result.legacy_count:null,key_definition_count:plan.kind==='key_definitions'?result.row_count:null,absence_proven:false,key_family:plan.key_family,source:plan.source};
 });
 if(counts.length!==plans.filter(p=>p.sql).length||new Set(counts.map(c=>c.id)).size!==counts.length)fail('DATASET_COUNT_COVERAGE_UNKNOWN');
 const keyDependent=datasets.filter(d=>d.key_family!==null),storage=datasets.find(d=>d.id==='storage_objects');
 return {metadata_complete:true,key_dependent_data:keyDependent.some(d=>d.state==='present')?'present':'proven_empty',key_dependent_scope:'known_vault_pgsodium_and_five_auth_db_encryption_fields',full_schema_decryptability_verified:false,count_snapshot_consistent:false,key_dependent_dataset_count:keyDependent.length,storage_objects:storage.count,storage_binary_backup_required:storage.count>0,datasets,crypto_contract_source_commit:'ce9a8eee0cc042be8c7a42981a7ddae631e41d91',hosted_auth_binary_version_verified:false,
  full_database_restore_verified:false,provider_services_verified:false,provider_encryption_key_exported:false,secret_values_exported:false,database_mutations:false};
}

export function parseAuthProviderVersion(body){
 // The official /auth/v1/health endpoint returns only this allowlisted field.
 // Release semver is accepted; commit hashes, dev/prerelease strings, oversized
 // values and all other health fields are discarded rather than exported.
 const value=body?.version;
 return typeof value==='string'&&/^v2\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(value)
   ? {provider_version:value,provider_version_available:true}
   : {provider_version:null,provider_version_available:false};
}
export async function hostedDatasetInventory(environment,project,{execute=executeDatabaseProcess,databaseTarget,databaseEnvironment}={}){
 if(environment.APP_ENV!=='staging'||project?.ref!==PROJECT_REF||environment.STAGING_SUPABASE_PROJECT_REF!==PROJECT_REF)fail('FIXED_STAGING_PROJECT_REQUIRED');
 if(typeof databaseTarget!=='function'||typeof databaseEnvironment!=='function')fail('VALIDATED_DATABASE_HELPERS_REQUIRED');
 const target=databaseTarget(environment.MIGRATION_DATABASE_URL,project.ref),dbEnv=databaseEnvironment(target,environment);
 if(dbEnv.PGSSLMODE!=='verify-full'||!dbEnv.PGSSLROOTCERT||!dbEnv.PGOPTIONS?.includes('default_transaction_read_only=on'))fail('READ_ONLY_VERIFY_FULL_REQUIRED');
 const query=async(sql)=>{
  const result=await execute('psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{env:dbEnv,input:sql,encoding:'utf8',timeout:30_000,maxBuffer:4_000_000});
  if(result.error||result.status!==0)fail('DATASET_QUERY_UNAVAILABLE');
  let data;try{data=JSON.parse(result.stdout.trim());}catch{fail('DATASET_RESPONSE_UNKNOWN');}return data;
 };
 try{
  const catalog=await query(CATALOG_SQL),plans=inventoryPlan(catalog),counts=[];
  for(const plan of plans.filter(p=>p.sql))counts.push(await query(plan.sql));
  return {passed:true,...inventoryReport(plans,counts)};
 }catch(error){return {passed:false,error:error instanceof InventoryError?error.code:'DATASET_INVENTORY_UNAVAILABLE',key_dependent_data:'unknown',metadata_complete:false,secret_values_exported:false,database_mutations:false};}
}
