import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget,databaseTarget,databaseEnvironment} from './staging-preflight.mjs';
import {executeDatabaseProcess} from './staging-database-process.mjs';
import {UPGRADE_FILES,createUpgradeMigrationManifest} from './staging-pwa-upgrade-migrations.mjs';
import {deliverTarget} from './pwa-delivery-provider.mjs';
import {activeStagingRelease} from './staging-pwa-release-health.mjs';

const PROJECT='fbozlbgmktkgcdfqdaaz';
const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const CA_HASH='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fail=code=>{throw Error(code);};
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function deliveryContext(environment) {
  const project=projectTarget(environment),release=environment.RELEASE_SHA;
  if(project.ref!==PROJECT||environment.GITHUB_REPOSITORY!=='cluvonl/platform'||!/^[0-9a-f]{40}$/.test(release??'')
    ||!(/^[0-9a-f]{40}$/.test(environment.GITHUB_SHA??''))||(environment.GITHUB_EVENT_NAME==='workflow_dispatch'&&environment.GITHUB_SHA!==release)||!/^[1-9][0-9]{0,19}$/.test(environment.GITHUB_RUN_ID??'')
    ||!/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(environment.GITHUB_ACTOR??'')
    ||!((environment.GITHUB_EVENT_NAME==='schedule'&&environment.GITHUB_REF==='refs/heads/main')
      ||(environment.GITHUB_EVENT_NAME==='workflow_dispatch'&&environment.GITHUB_REF==='refs/heads/staging'))) fail('FIXED_STAGING_DELIVERY_CONTEXT_REQUIRED');
  if(environment.SENDGRID_FROM_EMAIL!=='info@cluvo.nl'||!environment.SENDGRID_API_KEY||!environment.MAIL_ALLOWLIST
    ||!/^[A-Za-z0-9_-]{87}$/.test(environment.VAPID_PUBLIC_KEY??'')||!/^[A-Za-z0-9_-]{43}$/.test(environment.VAPID_PRIVATE_KEY??'')) fail('STAGING_DELIVERY_CONFIGURATION_REQUIRED');
  return {project,release,target:databaseTarget(environment.MIGRATION_DATABASE_URL,project.ref)};
}
export async function testedDeliveryRelease(environment,fetcher=fetch) {
  const request=async path=>{
    const response=await fetcher('https://api.github.com/repos/cluvonl/platform/'+path,{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+environment.GITHUB_TOKEN},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(response.status!==200)fail('STAGING_RELEASE_CHECK_FAILED');return response.json();
  };
  const [main,staging,runs]=await Promise.all([request('git/ref/heads/main'),request('git/ref/heads/staging'),request('actions/workflows/ci.yml/runs?branch=main&head_sha='+environment.RELEASE_SHA+'&per_page=10')]);
  const tested=main.object?.sha===environment.RELEASE_SHA&&staging.object?.sha===environment.RELEASE_SHA
    &&runs.workflow_runs?.some(run=>run.head_sha===environment.RELEASE_SHA&&run.head_branch==='main'&&run.status==='completed'&&run.conclusion==='success')===true;
  return tested&&await activeStagingRelease(environment.RELEASE_SHA,fetcher);
}
export function deliveryTransaction(environment,manifest,body) {
  // This owner only renders a finite claim/finish recipe. The manifest is
  // loaded from checked bytes, never supplied by a provider or an HTTP client.
  const lock=createHash('sha256').update(PROJECT).digest().readInt32BE(0);
  const expected=manifest.migrations.map((item,index)=>`(${literal(item.version)},${literal(item.file)},${literal(item.sha256)},${index})`).join(',');
  return `BEGIN READ WRITE;
SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s'; SET LOCAL search_path=pg_catalog;
SET LOCAL cluvo.delivery_source=${literal(environment.RELEASE_SHA)};
SET LOCAL cluvo.delivery_run=${literal(environment.GITHUB_RUN_ID)};
SET LOCAL cluvo.delivery_actor=${literal(environment.GITHUB_ACTOR)};
SET LOCAL cluvo.delivery_scope='staging';
SET LOCAL cluvo.delivery_project='fbozlbgmktkgcdfqdaaz';
DO $delivery_guard$ BEGIN
IF current_user<>'postgres' OR current_database()<>'postgres' OR pg_is_in_recovery()
OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
OR NOT pg_try_advisory_xact_lock(1129076054,${lock}) THEN RAISE EXCEPTION 'STAGING_DELIVERY_OWNER_UNAVAILABLE'; END IF;
IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>${manifest.migrations.length}
OR (SELECT count(*) FROM supabase_migrations.cluvo_migration_source)<>16
OR (SELECT count(*) FROM supabase_migrations.cluvo_pwa_upgrade_source)<>${manifest.migrations.length-16}
OR EXISTS(SELECT 1 FROM (VALUES ${expected}) e(version,file,sha256,position)
LEFT JOIN supabase_migrations.schema_migrations h USING(version)
LEFT JOIN supabase_migrations.cluvo_migration_source original USING(version)
LEFT JOIN supabase_migrations.cluvo_pwa_upgrade_source suffix USING(version)
WHERE cardinality(h.statements) IS DISTINCT FROM 1 OR encode(sha256(convert_to(h.statements[1],'UTF8')),'hex') IS DISTINCT FROM e.sha256
OR CASE WHEN e.position<16 THEN original.sha256 ELSE suffix.sha256 END IS DISTINCT FROM e.sha256
OR CASE WHEN e.position<16 THEN original.file ELSE suffix.file END IS DISTINCT FROM e.file)
OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'
AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='native_session_required' AND NOT p.polpermissive)))
OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api' AND p.prosecdef)
OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cluvo_command_owner' AND (rolsuper OR rolbypassrls))
OR has_function_privilege('authenticated','internal.pwa_claim_deliveries(uuid,integer)','EXECUTE')
OR has_function_privilege('service_role','internal.pwa_claim_deliveries(uuid,integer)','EXECUTE')
OR has_function_privilege('anon','internal.pwa_claim_deliveries(uuid,integer)','EXECUTE')
THEN RAISE EXCEPTION 'STAGING_DELIVERY_SCHEMA_UNVERIFIED'; END IF;
END $delivery_guard$;
${body}
COMMIT;`;
}
export function finishDeliverySQL(target,worker,result) {
  if(!UUID.test(target.id??'')||!UUID.test(worker)||!Number.isSafeInteger(target.version)||target.version<1
    ||!['sent','failed','unknown','cancelled'].includes(result.state)||result.providerStatus!==null&&(!Number.isInteger(result.providerStatus)||result.providerStatus<100||result.providerStatus>599)) fail('DELIVERY_RECEIPT_INVALID');
  const hash=result.bodyHash??null,revision=result.templateRevision??null,messageKey=result.providerMessageKey??null;
  if((hash===null)!==(revision===null)||hash!==null&&!/^[0-9a-f]{64}$/.test(hash)||revision!==null&&(!Number.isSafeInteger(revision)||revision<1)
    ||messageKey!==null&&(hash===null||!/^[A-Za-z0-9_.-]{1,200}$/.test(messageKey)))fail('DELIVERY_RECEIPT_INVALID');
  return `SELECT internal.pwa_finish_delivery_receipted(${literal(target.id)}::uuid,${literal(worker)}::uuid,${target.version},${literal(result.state)},${result.providerStatus===null?'NULL':result.providerStatus},${hash===null?'NULL':literal(hash)},${revision===null?'NULL':revision},${messageKey===null?'NULL':literal(messageKey)});`;
}
export async function stagingPwaDelivery(environment,{execute=executeDatabaseProcess,fetcher=fetch,deliver=deliverTarget}={}) {
  const report={scope:'STAGING_PWA_DELIVERY',source_sha:environment.RELEASE_SHA,observed_at:new Date().toISOString(),passed:false,claimed:0,provider_accepted:0,retryable:0,unknown:0,cancelled:0,private_values_exported:false,physical_delivery_verified:false,production_enabled:false};
  try {
    const context=deliveryContext(environment);
    if(!await testedDeliveryRelease(environment,fetcher)) {
      if(environment.GITHUB_EVENT_NAME==='schedule')return {...report,passed:true,skipped:'STAGING_PROMOTION_PENDING'};
      fail('STAGING_TESTED_RELEASE_REQUIRED');
    }
    if(createHash('sha256').update(await readFile(CA)).digest('hex')!==CA_HASH)fail('STAGING_TLS_CA_CHANGED');
    const sources=await Promise.all(UPGRADE_FILES.map(async item=>({file:item.file,bytes:await readFile(new URL('../supabase/migrations/'+item.file,import.meta.url))})));
    const manifest=createUpgradeMigrationManifest(context.release,sources);
    const published=JSON.parse(await readFile(new URL('../public/app/push-config.json',import.meta.url)));
    if(published.publicKey!==environment.VAPID_PUBLIC_KEY)fail('STAGING_PUSH_PUBLIC_KEY_CHANGED');
    const worker=randomUUID(),dbEnvironment=databaseEnvironment(context.target,{...environment,MIGRATION_SSL_ROOT_CERT_PATH:CA});
    const query=async body=>{
      const result=await execute('psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{env:dbEnvironment,input:deliveryTransaction(environment,manifest,body),timeout:30000,maxBuffer:250000});
      if(result.status!==0||result.error)fail('STAGING_DELIVERY_DATABASE_UNAVAILABLE');
      try {return JSON.parse(result.stdout.trim());} catch {fail('STAGING_DELIVERY_RECEIPT_UNAVAILABLE');}
    };
    const automation=await query(`SELECT internal.pwa_enqueue_automation(${literal(worker)}::uuid,100);`);
    if(!automation||Object.entries(automation).some(([key,value])=>!['offers','push','digests','reminders','deadlines','matchslots'].includes(key)||!Number.isSafeInteger(value)||value<0))fail('STAGING_AUTOMATION_RECEIPT_INVALID');
    report.automation=automation;
    // Claim one target immediately before its send. A delayed batch never
    // retains an earlier authorization decision for its later recipients.
    for(let index=0;index<20;index++) {
      const targets=await query(`SELECT internal.pwa_claim_deliveries(${literal(worker)}::uuid,1);`);
      if(!Array.isArray(targets)||targets.length>1)fail('STAGING_DELIVERY_TARGET_INVALID');
      if(!targets.length)break;
      const lease=targets[0];
      if(!UUID.test(lease?.id??'')||!Number.isSafeInteger(lease.version)||lease.version<1)fail('STAGING_DELIVERY_TARGET_INVALID');
      const target=await query(`SELECT internal.pwa_revalidate_delivery(${literal(lease.id)}::uuid,${literal(worker)}::uuid,${lease.version});`);
      if(target?.id!==lease.id||target.version!==lease.version)fail('STAGING_DELIVERY_TARGET_CHANGED');
      report.claimed++;
      const result=await deliver(target,{sendgridKey:environment.SENDGRID_API_KEY,from:environment.SENDGRID_FROM_EMAIL,allowlist:environment.MAIL_ALLOWLIST,publicKey:environment.VAPID_PUBLIC_KEY,privateKey:environment.VAPID_PRIVATE_KEY});
      const receipt=await query(finishDeliverySQL(target,worker,result));
      if(receipt?.ok!==true||receipt.state!==result.state)fail('STAGING_DELIVERY_RECEIPT_UNAVAILABLE');
      report[result.state==='sent'?'provider_accepted':result.state==='failed'?'retryable':result.state]++;
    }
    report.passed=true;
  } catch(error) {report.error=/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.message??'')?error.message:'STAGING_DELIVERY_UNAVAILABLE';}
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const report=await stagingPwaDelivery(process.env);
  await writeFile('staging-pwa-delivery.json',JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify(report)+'\n');if(!report.passed)process.exitCode=1;
}
