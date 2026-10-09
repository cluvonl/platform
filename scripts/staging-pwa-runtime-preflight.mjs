// Read-only management gate for the closed PWA schema. This sends no email,
// creates no identity, changes no database row and imports no runtime secret.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {UPGRADE_FILES,createUpgradeMigrationManifest} from './staging-pwa-upgrade-migrations.mjs';
import {nativeQaSchemaGuardSql} from './staging-pwa-native-qa-fixture.mjs';
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';
import {projectTarget,databaseTarget,databaseEnvironment} from './staging-preflight.mjs';
import {executeDatabaseProcess} from './staging-database-process.mjs';

const PROJECT='fbozlbgmktkgcdfqdaaz',ORIGIN='https://staging.cluvo.nl';
const BASELINE='b9a6ed995058e623d7887fb4a56630251ff4ffb4';
const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const CA_SHA='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
const need=(value,code)=>{if(!value)throw Error(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fields=(value,keys)=>{
 const all=Object.getOwnPropertyDescriptors(value),result={};
 for(const key of keys){const field=all[key];need(field&&Object.hasOwn(field,'value')&&typeof field.value==='string'&&field.value.length>0&&field.value.length<=8192&&!/[\r\n\0]/.test(field.value),'PWA_RUNTIME_INPUT_INVALID');result[key]=field.value;}
 return result;
};
export function runtimeConfigurationInputs(environment){
 const value=fields(environment,['APP_ENV','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA','EXPECTED_ACTIVE_SOURCE_SHA','EXPECTED_CONFIG_VERSION','COMPATIBLE_ROLLBACK_SHAS']);
 need(value.APP_ENV==='staging'&&value.GITHUB_REPOSITORY==='cluvonl/platform'&&value.GITHUB_REF==='refs/heads/staging'&&value.GITHUB_EVENT_NAME==='workflow_dispatch'
  &&/^[0-9a-f]{40}$/.test(value.RELEASE_SHA)&&value.RELEASE_SHA===value.GITHUB_SHA&&/^[0-9a-f]{40}$/.test(value.EXPECTED_ACTIVE_SOURCE_SHA)
  &&/^[1-9][0-9]{0,5}$/.test(value.EXPECTED_CONFIG_VERSION)&&Number(value.EXPECTED_CONFIG_VERSION)>=2,'PWA_RUNTIME_INPUT_INVALID');
 let rollback;try{rollback=JSON.parse(value.COMPATIBLE_ROLLBACK_SHAS);}catch{throw Error('PWA_RUNTIME_INPUT_INVALID');}
 need(Array.isArray(rollback)&&rollback.length>=1&&rollback.length<=16&&new Set(rollback).size===rollback.length
  &&rollback.every(sha=>typeof sha==='string'&&/^[0-9a-f]{40}$/.test(sha)&&[BASELINE,value.RELEASE_SHA,value.EXPECTED_ACTIVE_SOURCE_SHA].includes(sha))
  &&rollback.includes(value.EXPECTED_ACTIVE_SOURCE_SHA)&&rollback.includes(value.RELEASE_SHA),'PWA_RUNTIME_INPUT_INVALID');
 return Object.freeze({...value,rollback:Object.freeze(rollback)});
}
export async function verifyRuntimePromotion(environment,fetcher=fetch){
 const input=runtimeConfigurationInputs(environment),token=fields(environment,['GH_TOKEN']).GH_TOKEN;
 const request=async path=>{
  const response=await fetcher('https://api.github.com/repos/cluvonl/platform/'+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(15000)});
  need(response.status===200,'PWA_RUNTIME_RELEASE_UNAVAILABLE');return response.json();
 };
 const [main,staging,runs]=await Promise.all([request('git/ref/heads/main'),request('git/ref/heads/staging'),request('actions/workflows/ci.yml/runs?branch=main&head_sha='+input.RELEASE_SHA+'&per_page=10')]);
 need(main.object?.sha===input.RELEASE_SHA&&staging.object?.sha===input.RELEASE_SHA&&runs.workflow_runs?.some(run=>run.head_sha===input.RELEASE_SHA&&run.head_branch==='main'&&run.status==='completed'&&run.conclusion==='success')===true,'PWA_RUNTIME_TESTED_RELEASE_REQUIRED');
 return input;
}
export function runtimeReadOnlyGuardSQL(){
 need(UPGRADE_FILES.length===34,'PWA_RUNTIME_CLOSED34_REQUIRED');
 const guard=nativeQaSchemaGuardSql(),needle="current_setting('transaction_read_only')<>'off'";
 need(guard.split(needle).length===2,'PWA_RUNTIME_GUARD_SHAPE_CHANGED');
 return guard.replace(needle,"current_setting('transaction_read_only')<>'on'")+`
DO $readonly_runtime_role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper AND rolbypassrls AND rolcanlogin)
 THEN RAISE EXCEPTION 'PWA_RUNTIME_DATABASE_ROLE_UNVERIFIED';END IF;
END $readonly_runtime_role$;`;
}
export function runtimeReadOnlyPreflightSQL(){return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';SET LOCAL lock_timeout='5s';SET LOCAL search_path=pg_catalog;
DO $readonly_runtime_lock$ BEGIN
 IF NOT pg_try_advisory_xact_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT})
 THEN RAISE EXCEPTION 'PWA_RUNTIME_SCHEMA_LOCK_BUSY';END IF;
END $readonly_runtime_lock$;
${runtimeReadOnlyGuardSQL()}
SELECT jsonb_build_object('scope','STAGING_PWA_RUNTIME_READONLY34','migration_count',34,
 'app_tables',(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app'AND c.relkind='r'),
 'forced_rls_tables',(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app'AND c.relkind='r'AND c.relrowsecurity AND c.relforcerowsecurity),
 'native_guarded_tables',(SELECT count(*)FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app'AND c.relkind='r'AND EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='native_session_required'AND NOT p.polpermissive)),
 'api_only',true,'command_owner_restricted',true,'database_role_superuser',false,'transaction_read_only',current_setting('transaction_read_only')='on',
 'database_mutations',false,'email_sent',false,'production_enabled',false);
COMMIT;`;}
function verifiedReadback(value){
 const expected={scope:'STAGING_PWA_RUNTIME_READONLY34',migration_count:34,api_only:true,command_owner_restricted:true,database_role_superuser:false,transaction_read_only:true,database_mutations:false,email_sent:false,production_enabled:false};
 need(value&&Object.keys(value).length===Object.keys(expected).length+3&&Object.entries(expected).every(([key,field])=>Object.hasOwn(value,key)&&value[key]===field),'PWA_RUNTIME_SCHEMA_UNVERIFIED');
 need(['app_tables','forced_rls_tables','native_guarded_tables'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=144&&value[key]<=10000)
  &&value.app_tables===value.forced_rls_tables&&value.app_tables===value.native_guarded_tables,'PWA_RUNTIME_SCHEMA_UNVERIFIED');return value;
}
export async function stagingPwaRuntimePreflight(environment,{execute=executeDatabaseProcess,fetcher=fetch,readSource=readFile}={}){
 const report={scope:'STAGING_PWA_RUNTIME_MANAGEMENT_PREFLIGHT',passed:false,database_mutations:false,email_sent:false,private_values_exported:false,production_enabled:false};
 try{
  const input=await verifyRuntimePromotion(environment,fetcher),fixed=fields(environment,['APP_URL','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','MIGRATION_DATABASE_URL']);
  need(fixed.APP_URL===ORIGIN&&fixed.STAGING_SUPABASE_PROJECT_REF===PROJECT&&fixed.SUPABASE_URL==='https://'+PROJECT+'.supabase.co'
   &&fixed.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')&&!/[\s\0]/.test(fixed.SUPABASE_PUBLISHABLE_KEY),'PWA_RUNTIME_FIXED_TARGET_REQUIRED');
  const project=projectTarget({...fixed,APP_ENV:'staging'}),target=databaseTarget(fixed.MIGRATION_DATABASE_URL,PROJECT);
  need(hash(await readSource(CA))===CA_SHA,'PWA_RUNTIME_TLS_CA_CHANGED');
  const sources=await Promise.all(UPGRADE_FILES.map(async item=>({file:item.file,bytes:await readSource(new URL('../supabase/migrations/'+item.file,import.meta.url))})));
  const manifest=createUpgradeMigrationManifest(input.RELEASE_SHA,sources);need(manifest.migrations.length===34,'PWA_RUNTIME_CLOSED34_REQUIRED');
  const result=await execute('psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{
   env:databaseEnvironment(target,{PATH:'/usr/bin:/bin',MIGRATION_SSL_ROOT_CERT_PATH:CA}),input:'\\conninfo\n'+runtimeReadOnlyPreflightSQL(),timeout:30000,maxBuffer:250000});
  need(result.status===0&&!result.error,'PWA_RUNTIME_SCHEMA_UNVERIFIED');
  const protocol=result.stdout.match(/SSL connection \(protocol:\s*(TLSv1\.[23])[,)]/i)?.[1];need(protocol,'PWA_RUNTIME_CLIENT_TLS_UNVERIFIED');
  const rows=result.stdout.split('\n').filter(line=>line.startsWith('{'));need(rows.length===1,'PWA_RUNTIME_SCHEMA_UNVERIFIED');
  report.database=verifiedReadback(JSON.parse(rows[0]));report.client_tls_protocol=protocol;report.server_certificate_verified=true;report.migration_manifest_sha256=manifest.sha256;
  const headers={apikey:fixed.SUPABASE_PUBLISHABLE_KEY};
  const request=async(path,profile)=>await fetcher(project.origin+path,{headers:{...headers,...(profile?{'Accept-Profile':profile}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});
  const auth=await request('/auth/v1/settings');need(auth.status===200,'PWA_RUNTIME_AUTH_UNVERIFIED');
  const settings=await auth.json();need(settings.external?.email===true&&(settings.mailer_autoconfirm??settings.autoconfirm)===false,'PWA_RUNTIME_AUTH_UNVERIFIED');
  const exposed=await request('/rest/v1/public_tenants?select=tenant_id&limit=0','api');need(exposed.status===200,'PWA_RUNTIME_API_UNVERIFIED');
  for(const schema of ['app','internal']){const denied=await request('/rest/v1/public_tenants?select=tenant_id&limit=0',schema);need(denied.status===406&&(await denied.json()).code==='PGRST106','PWA_RUNTIME_PRIVATE_SCHEMA_EXPOSED');}
  report.auth={publishable_key_accepted:true,email_provider_enabled:true,email_confirmation_required:true,api_only_accessible:true};
  report.source_sha=input.RELEASE_SHA;report.passed=true;
 }catch(error){report.error=/^PWA_RUNTIME_[A-Z_]+$/.test(error?.message??'')?error.message:'PWA_RUNTIME_PREFLIGHT_UNAVAILABLE';}
 return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  if(process.argv.length!==3||!['--verify-release','--readonly-preflight'].includes(process.argv[2]))throw Error('PWA_RUNTIME_ARGUMENTS_INVALID');
  if(process.argv[2]==='--verify-release'){await verifyRuntimePromotion(process.env);console.log('PWA_RUNTIME_TESTED_RELEASE_PASS');}
  else{const report=await stagingPwaRuntimePreflight(process.env);console.log(JSON.stringify(report));process.exitCode=report.passed?0:1;}
 }catch{console.log('PWA_RUNTIME_MANAGEMENT_GATE_FAILED');process.exitCode=1;}
}
