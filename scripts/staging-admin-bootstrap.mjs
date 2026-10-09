// One-time, explicitly approved control-plane provisioning of a verified
// existing account. This is not a browser RPC or a recurring privilege grant.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget,databaseTarget,databaseEnvironment} from './staging-preflight.mjs';
import {executeDatabaseProcess} from './staging-database-process.mjs';
import {nativeQaSchemaGuardSql} from './staging-pwa-native-qa-fixture.mjs';
import {UPGRADE_FILES,createUpgradeMigrationManifest} from './staging-pwa-upgrade-migrations.mjs';
import {activeStagingRelease} from './staging-pwa-release-health.mjs';

const PROJECT='fbozlbgmktkgcdfqdaaz';
const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const CA_HASH='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
export const FIRST_PLATFORM_PERMISSIONS=Object.freeze(['platform.overview','platform.tenant.read','platform.tenant.manage','platform.access.manage','platform.config.manage','platform.integration.manage','platform.support','platform.audit.read']);
const KEY='ad000000-0000-4000-8000-000000000001';
const need=(value,code)=>{if(!value)throw Error(code);};
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
const digest=value=>createHash('sha256').update(value).digest('hex');
export function adminBootstrapInputs(environment){
 const keys=['APP_ENV','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA','GITHUB_RUN_ID','GITHUB_ACTOR','BOOTSTRAP_ACCOUNT_EMAIL','CONFIRM_PLATFORM_MANDATE'];
 const fields=Object.getOwnPropertyDescriptors(environment),value={};
 for(const key of keys){need(fields[key]&&Object.hasOwn(fields[key],'value')&&typeof fields[key].value==='string'&&!/[\r\n\0]/.test(fields[key].value)&&fields[key].value.length<=254,'ADMIN_BOOTSTRAP_INPUT_INVALID');value[key]=fields[key].value;}
 need(value.APP_ENV==='staging'&&value.GITHUB_REPOSITORY==='cluvonl/platform'&&value.GITHUB_REF==='refs/heads/staging'&&value.GITHUB_EVENT_NAME==='workflow_dispatch'
  &&/^[0-9a-f]{40}$/.test(value.RELEASE_SHA)&&value.GITHUB_SHA===value.RELEASE_SHA&&/^[1-9][0-9]{0,19}$/.test(value.GITHUB_RUN_ID)
  &&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(value.GITHUB_ACTOR)&&value.CONFIRM_PLATFORM_MANDATE==='true'
  &&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.BOOTSTRAP_ACCOUNT_EMAIL),'ADMIN_BOOTSTRAP_INPUT_INVALID');
 return Object.freeze({...value,BOOTSTRAP_ACCOUNT_EMAIL:value.BOOTSTRAP_ACCOUNT_EMAIL.toLowerCase()});
}
export async function verifyAdminBootstrapRelease(environment,fetcher=fetch){
 const value=adminBootstrapInputs(environment);
 need(typeof environment.GH_TOKEN==='string'&&environment.GH_TOKEN.length>0,'ADMIN_BOOTSTRAP_RELEASE_UNAVAILABLE');
 const get=async path=>{const result=await fetcher('https://api.github.com/repos/cluvonl/platform/'+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+environment.GH_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});need(result.status===200,'ADMIN_BOOTSTRAP_RELEASE_UNAVAILABLE');return result.json();};
 const [main,staging,runs]=await Promise.all([get('git/ref/heads/main'),get('git/ref/heads/staging'),get('actions/workflows/ci.yml/runs?branch=main&head_sha='+value.RELEASE_SHA+'&per_page=10')]);
 need(main.object?.sha===value.RELEASE_SHA&&staging.object?.sha===value.RELEASE_SHA&&runs.workflow_runs?.some(run=>run.head_sha===value.RELEASE_SHA&&run.head_branch==='main'&&run.status==='completed'&&run.conclusion==='success')
  &&await activeStagingRelease(value.RELEASE_SHA,fetcher),'ADMIN_BOOTSTRAP_ACTIVE_TESTED_RELEASE_REQUIRED');
 return value;
}
export function adminBootstrapBody(environment){
 const value=adminBootstrapInputs(environment);
 const requestHash=digest(JSON.stringify({format:'cluvo-first-platform-mandate-v1',email:value.BOOTSTRAP_ACCOUNT_EMAIL,permissions:FIRST_PLATFORM_PERMISSIONS,expiry_days:90}));
 return `CREATE TEMP TABLE cluvo_admin_bootstrap_result(value jsonb) ON COMMIT DROP;
DO $first_platform_mandate$
DECLARE target uuid;account_count integer;grant_id uuid;permission text;prior app.platform_command_receipts%rowtype;expires timestamptz:=statement_timestamp()+interval '90 days';
BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' OR pg_is_in_recovery()
 THEN RAISE EXCEPTION 'ADMIN_BOOTSTRAP_FIXED_DATABASE_REQUIRED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cluvo-platform-authority',0));
 SELECT count(*),min(u.id::text)::uuid INTO account_count,target FROM auth.users u
 WHERE lower(u.email)=${literal(value.BOOTSTRAP_ACCOUNT_EMAIL)} AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND(u.banned_until IS NULL OR u.banned_until<=statement_timestamp());
 IF account_count<>1 THEN RAISE EXCEPTION 'ADMIN_BOOTSTRAP_VERIFIED_EXISTING_ACCOUNT_REQUIRED';END IF;
 SELECT * INTO prior FROM app.platform_command_receipts WHERE idempotency_key=${literal(KEY)}::uuid;
 IF FOUND THEN
  IF prior.actor_auth_user_id<>target OR prior.action<>'bootstrap_platform_mandate' OR prior.request_hash<>decode(${literal(requestHash)},'hex')
  OR (SELECT count(*)FROM app.platform_access_grants g JOIN app.platform_audit_events a ON a.resource_id=g.id AND a.action='bootstrap_platform_mandate' AND a.idempotency_key=${literal(KEY)}::uuid
   WHERE g.auth_user_id=target AND g.tenant_scope_id IS NULL AND g.version=1 AND g.revoked_at IS NULL AND g.starts_at<=statement_timestamp()AND g.ends_at>statement_timestamp())<>8
  THEN RAISE EXCEPTION 'ADMIN_BOOTSTRAP_RECEIPT_CHANGED';END IF;
  INSERT INTO cluvo_admin_bootstrap_result VALUES(jsonb_build_object('passed',true,'scope','FIRST_EXPLICIT_PLATFORM_MANDATE','grants',8,'deduplicated',true,'club_grants_added',0,'auth_accounts_created',0,'production_enabled',false));
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM app.platform_access_grants)OR EXISTS(SELECT 1 FROM app.platform_command_receipts WHERE action='bootstrap_platform_mandate')
 THEN RAISE EXCEPTION 'ADMIN_BOOTSTRAP_INITIAL_ONLY';END IF;
 FOREACH permission IN ARRAY ARRAY[${FIRST_PLATFORM_PERMISSIONS.map(literal).join(',')}]LOOP
  grant_id:=gen_random_uuid();
  INSERT INTO app.platform_access_grants(id,auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)
  VALUES(grant_id,target,'Eerste expliciet benoemde platformbeheerder',permission,expires,target);
  INSERT INTO app.platform_audit_events(actor_auth_user_id,action,resource_id,expected_version,resulting_version,idempotency_key,reason)
  VALUES(target,'bootstrap_platform_mandate',grant_id,0,1,${literal(KEY)}::uuid,${literal('Expliciet eerste platformmandaat via bestaande stagingbeheerroute; GitHub actor '+value.GITHUB_ACTOR+'; run '+value.GITHUB_RUN_ID+'; source '+value.RELEASE_SHA)});
 END LOOP;
 INSERT INTO app.platform_command_receipts(actor_auth_user_id,idempotency_key,action,request_hash,resource_id,result)
 VALUES(target,${literal(KEY)}::uuid,'bootstrap_platform_mandate',decode(${literal(requestHash)},'hex'),target,jsonb_build_object('grants',8,'expires_at',expires,'version',1));
 INSERT INTO cluvo_admin_bootstrap_result VALUES(jsonb_build_object('passed',true,'scope','FIRST_EXPLICIT_PLATFORM_MANDATE','grants',8,'deduplicated',false,'club_grants_added',0,'auth_accounts_created',0,'production_enabled',false));
END;$first_platform_mandate$;
SELECT value FROM cluvo_admin_bootstrap_result;`;
}
export async function stagingAdminBootstrap(environment,{execute=executeDatabaseProcess,fetcher=fetch,read=readFile}={}){
 const report={scope:'STAGING_FIRST_PLATFORM_MANDATE',passed:false,private_identifiers_exported:false,email_sent:false,production_enabled:false};
 try{
  const value=await verifyAdminBootstrapRelease(environment,fetcher);
  need(projectTarget(environment).ref===PROJECT,'ADMIN_BOOTSTRAP_FIXED_PROJECT_REQUIRED');
  const target=databaseTarget(environment.MIGRATION_DATABASE_URL,PROJECT);
  need(digest(await read(CA))===CA_HASH,'ADMIN_BOOTSTRAP_CA_CHANGED');
  const sources=await Promise.all(UPGRADE_FILES.map(async file=>({file:file.file,bytes:await read(new URL('../supabase/migrations/'+file.file,import.meta.url))})));
  const manifest=createUpgradeMigrationManifest(value.RELEASE_SHA,sources);
  const result=await execute('psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{
   env:{...databaseEnvironment(target,{PATH:'/usr/bin:/bin',MIGRATION_SSL_ROOT_CERT_PATH:CA}),PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=30000'},
   input:'\\conninfo\nBEGIN READ WRITE;\nSET LOCAL lock_timeout=\'10s\';SET LOCAL search_path=pg_catalog;\n'+nativeQaSchemaGuardSql()+'\n'+adminBootstrapBody(value)+'\nCOMMIT;',timeout:45000,maxBuffer:100000});
  need(result.status===0&&!result.error&&/SSL connection \(protocol:\s*TLSv1\.[23][,)]/i.test(result.stdout),'ADMIN_BOOTSTRAP_TRANSACTION_REFUSED');
  const rows=result.stdout.split('\n').filter(line=>line.startsWith('{'));need(rows.length===1,'ADMIN_BOOTSTRAP_READBACK_INVALID');
  const receipt=JSON.parse(rows[0]);
  need(Object.keys(receipt).length===7&&receipt.passed===true&&receipt.scope==='FIRST_EXPLICIT_PLATFORM_MANDATE'&&receipt.grants===8&&typeof receipt.deduplicated==='boolean'
   &&receipt.club_grants_added===0&&receipt.auth_accounts_created===0&&receipt.production_enabled===false,'ADMIN_BOOTSTRAP_READBACK_INVALID');
  report.passed=true;report.source_sha=value.RELEASE_SHA;report.workflow_run_id=value.GITHUB_RUN_ID;report.migration_manifest_sha256=manifest.sha256;report.receipt=receipt;
 }catch(error){report.error=/^ADMIN_BOOTSTRAP_[A-Z_]+$/.test(error?.message??'')?error.message:'ADMIN_BOOTSTRAP_UNAVAILABLE';}
 return report;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv[2]==='--verify-release'){try{await verifyAdminBootstrapRelease(process.env);console.log('ADMIN_BOOTSTRAP_ACTIVE_TESTED_RELEASE_PASS');}catch{console.log('ADMIN_BOOTSTRAP_RELEASE_REFUSED');process.exitCode=1;}}
 else if(process.argv.length===2){const report=await stagingAdminBootstrap(process.env);await writeFile('staging-admin-bootstrap.json',JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report));process.exitCode=report.passed?0:1;}
 else{console.log('ADMIN_BOOTSTRAP_ARGUMENTS_INVALID');process.exitCode=1;}
}
