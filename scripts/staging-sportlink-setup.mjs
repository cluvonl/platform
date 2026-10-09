// One fixed staging setup, with the active Next.js server owning encryption and
// native per-action authorization. No credential is passed to an argv or file.
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {SPORTLINK_SETUP_SCOPE,buildStagingSportlinkSetup} from './staging-sportlink-setup-sql.mjs';
import {SportlinkSetupSession} from './staging-sportlink-setup-session.mjs';
import {createExistingSportlinkOperatorSession,closeSportlinkOperatorSession} from './staging-sportlink-setup-auth.mjs';
import {activeStagingRelease} from './staging-pwa-release-health.mjs';
import {browserProcessEnvironment} from './staging-pwa-browser-readback.mjs';
import {validSportlinkClientId} from '../lib/sportlink/credentials.mjs';

const ORIGIN='https://staging.cluvo.nl',PROJECT='fbozlbgmktkgcdfqdaaz',f=SPORTLINK_SETUP_SCOPE;
const URL_BASE='https://'+PROJECT+'.supabase.co',PATH='/c/'+f.slug+'/beheer/sportlink';
const need=(value,code)=>{if(!value)throw Object.assign(Error(code),{code});};
const CODES=['VERIFIED_READ_ACCESS','PROVIDER_DENIED','PROVIDER_UNAVAILABLE','INVALID_SOURCE_RESPONSE','CONTRACT_UNAVAILABLE'];
const LABELS={VERIFIED_READ_ACCESS:'Leesaanvraag bevestigd',PROVIDER_DENIED:'Toegang geweigerd',PROVIDER_UNAVAILABLE:'Sportlink niet bereikbaar',INVALID_SOURCE_RESPONSE:'Antwoord vraagt controle',CONTRACT_UNAVAILABLE:'Wedstrijdprogramma ontbreekt'};
export function sportlinkSetupContext(environment){
 const keys=['APP_ENV','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA','GITHUB_RUN_ID','GITHUB_ACTOR','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL','STAGING_TEST_RECIPIENT'];
 need(environment&&(environment===process.env||[Object.prototype,null].includes(Object.getPrototypeOf(environment))),'STAGING_SPORTLINK_SETUP_CONTEXT_REFUSED');
 const d=Object.getOwnPropertyDescriptors(environment),v={};
 for(const k of keys){need(d[k]&&Object.hasOwn(d[k],'value')&&typeof d[k].value==='string'&&d[k].value.length>0&&d[k].value.length<8192&&!/[\r\n\0]/.test(d[k].value),'STAGING_SPORTLINK_SETUP_CONTEXT_REFUSED');v[k]=d[k].value;}
 need(v.APP_ENV==='staging'&&v.GITHUB_REPOSITORY==='cluvonl/platform'&&v.GITHUB_REF==='refs/heads/staging'
  &&v.GITHUB_EVENT_NAME==='workflow_dispatch'&&v.GITHUB_SHA===v.RELEASE_SHA&&v.STAGING_SUPABASE_PROJECT_REF===PROJECT&&v.SUPABASE_URL===URL_BASE,'STAGING_SPORTLINK_SETUP_CONTEXT_REFUSED');
 buildStagingSportlinkSetup({recipient:v.STAGING_TEST_RECIPIENT,sourceSha:v.RELEASE_SHA,workflowRunId:v.GITHUB_RUN_ID,actor:v.GITHUB_ACTOR,expectedVersion:0});
 return Object.freeze({sourceSha:v.RELEASE_SHA,runId:v.GITHUB_RUN_ID,actor:v.GITHUB_ACTOR,recipient:v.STAGING_TEST_RECIPIENT.toLowerCase()});
}
export function sportlinkSetupFetch(input,init={}){
 const url=new URL(input instanceof Request?input.url:String(input));
 need(url.origin===URL_BASE&&!url.username&&!url.password&&!url.hash&&/^\/(auth|rest)\/v1\//.test(url.pathname),'STAGING_SPORTLINK_SETUP_PROVIDER_TARGET_REFUSED');
 return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});
}
export async function sportlinkSetupSessionCookies(session,environment,context){
 const jar=new Map();
 const client=createServerClient(URL_BASE,environment.SUPABASE_PUBLISHABLE_KEY,{auth:{autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:sportlinkSetupFetch},
  cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>{for(const item of values)jar.set(item.name,item.value);}}});
 const result=await client.auth.setSession({access_token:session.accessToken,refresh_token:session.refreshToken});
 need(result.error===null&&result.data.user?.id===session.authUserId&&result.data.session?.access_token===session.accessToken,'STAGING_SPORTLINK_SETUP_COOKIE_REFUSED');
 need(jar.size>0&&jar.size<=8&&[...jar].every(([name,value])=>name.startsWith('sb-'+PROJECT+'-auth-token')&&value.length<=4096),'STAGING_SPORTLINK_SETUP_COOKIE_REFUSED');
 await context.addCookies([...jar].map(([name,value])=>({name,value,url:ORIGIN+'/',secure:true,sameSite:'Lax'})));jar.clear();
}
export function assertSportlinkSetupPublicBody(body,forbidden){
 need(typeof body==='string'&&body.length<=4000000&&Array.isArray(forbidden)&&forbidden.every(v=>typeof v==='string'&&v.length>0),'STAGING_SPORTLINK_SETUP_BODY_REFUSED');
 need(!forbidden.some(v=>body.includes(v)),'STAGING_SPORTLINK_SETUP_PRIVATE_DATA_LEAK');
}
async function browserToolchain(environment){
 const path=environment.PWA_PLAYWRIGHT_MODULE;
 need(isAbsolute(path??'')&&path.endsWith('/node_modules/playwright/index.mjs'),'STAGING_SPORTLINK_SETUP_BROWSER_REFUSED');
 const pkg=JSON.parse(await readFile(join(dirname(path),'package.json'),'utf8'));need(pkg.name==='playwright'&&pkg.version==='1.63.0','STAGING_SPORTLINK_SETUP_BROWSER_REFUSED');
 return import(pathToFileURL(path).href);
}
async function ownRoute(page,forbidden){
 const response=await page.goto(ORIGIN+PATH,{waitUntil:'networkidle',timeout:45000});
 need(response?.status()===200&&page.url()===ORIGIN+PATH,'STAGING_SPORTLINK_SETUP_SSR_REFUSED');
 need(/private/.test(response.headers()['cache-control']??'')&&/no-store/.test(response.headers()['cache-control']??''),'STAGING_SPORTLINK_SETUP_CACHE_REFUSED');
 assertSportlinkSetupPublicBody(await response.text(),forbidden);assertSportlinkSetupPublicBody(await page.locator('body').innerText(),forbidden);
 need(await page.getByRole('heading',{name:'Sportlink & wedstrijden',exact:true}).count()===1&&await page.locator('#sportlink-client-id').count()===1,'STAGING_SPORTLINK_SETUP_UI_REFUSED');
 need(await page.locator('#sportlink-client-id').inputValue()==='','STAGING_SPORTLINK_SETUP_PRIVATE_DATA_LEAK');
}
export async function runStagingSportlinkSetup(environment){
 const report={scope:'STAGING_SPORTLINK_OPERATOR_SETUP_V1',observed_at:new Date().toISOString(),passed:false,
  production_enabled:false,email_sent:false,signup_performed:false,password_changed:false,real_members_imported:false,
  match_import_performed:false,provider_import_activated:false,normal_user_otp_verified:false,physical_device_verified:false,
  private_values_exported:false,created_session_closed:false,old_sessions_preserved:false};
 let owner,browser,context,admin,session,clientId,primary;
 try{
  const scope=sportlinkSetupContext(environment);Object.assign(report,{source_sha:scope.sourceSha,workflow_run_id:scope.runId});
  clientId=environment.STAGING_SPORTLINK_SETUP_CLIENT_ID;
  need(validSportlinkClientId(clientId),'STAGING_SPORTLINK_SETUP_CLIENT_ID_REQUIRED');
  // The temporary input never reaches a child environment or runtime config.
  delete environment.STAGING_SPORTLINK_SETUP_CLIENT_ID;
  need(environment.SUPABASE_SECRET_KEY?.startsWith('sb_secret_')&&environment.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_'),'STAGING_SPORTLINK_SETUP_KEYS_REFUSED');
  need(await activeStagingRelease(scope.sourceSha),'STAGING_SPORTLINK_SETUP_ACTIVE_RELEASE_REQUIRED');
  const {chromium}=await browserToolchain(environment);
  owner=await SportlinkSetupSession.connect(environment);report.schema_target_verified=true;report.migration_count=36;
  const provisioned=await owner.provision();
  need(provisioned.tenant_id===f.tenant&&provisioned.tenant_slug===f.slug&&provisioned.person_id===f.person
   &&['created','already_configured'].includes(provisioned.outcome)&&provisioned.permission_count===1,'STAGING_SPORTLINK_SETUP_SCOPE_UNPROVED');
  report.operator_scope=provisioned.outcome;report.permission_keys=['match.import'];report.annual_grant=true;
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:sportlinkSetupFetch}};
  admin=createClient(URL_BASE,environment.SUPABASE_SECRET_KEY,options);
  const actor=createClient(URL_BASE,environment.SUPABASE_PUBLISHABLE_KEY,options);
  session=await createExistingSportlinkOperatorSession({admin,client:actor,recipient:scope.recipient,authUserId:provisioned.auth_user_id,projectUrl:URL_BASE,
   verifyNativeSession:async(uid,sid)=>{const v=await owner.verifySession(uid,sid);need(v?.native_session_verified===true,'STAGING_SPORTLINK_SETUP_SESSION_UNPROVED');}});
  report.provider_native_session='admin_issued_recovery';
  const workspaces=await actor.schema('api').from('my_workspaces').select('tenant_id,tenant_slug,person_id,role_key,scope_kind,scope_id').eq('tenant_id',f.tenant);
  need(workspaces.error===null&&workspaces.data?.length===1&&workspaces.data[0].tenant_slug===f.slug&&workspaces.data[0].person_id===f.person
   &&workspaces.data[0].role_key===f.roleKey&&workspaces.data[0].scope_kind==='tenant','STAGING_SPORTLINK_SETUP_NATIVE_WORKSPACE_REFUSED');
  const initial=await actor.schema('api').rpc('sportlink_connection_state',{p_tenant_id:f.tenant});need(initial.error===null&&initial.data?.authorized===true,'STAGING_SPORTLINK_SETUP_NATIVE_AUTHORITY_REFUSED');
  const forbidden=[clientId,session.accessToken,session.refreshToken,environment.SUPABASE_SECRET_KEY,environment.MIGRATION_DATABASE_URL].filter(v=>typeof v==='string'&&v.length>0);
  browser=await chromium.launch({headless:true,env:browserProcessEnvironment(environment)});context=await browser.newContext({viewport:{width:1280,height:960},serviceWorkers:'block'});
  // No traces, screenshots, HAR, console/request handlers or persistent profile.
  await context.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===ORIGIN?route.continue():route.abort();});
  await sportlinkSetupSessionCookies(session,environment,context);
  const page=await context.newPage(),pageErrors=[];page.on('pageerror',()=>pageErrors.push(true));await ownRoute(page,forbidden);
  need(!initial.data.connection||initial.data.connection.id===f.connection,'STAGING_SPORTLINK_SETUP_EXISTING_CONNECTION_REFUSED');
  await page.locator('#sportlink-client-id').fill(clientId);
  // A fixed semantic command also verifies a lost-response retry against the
  // supplied ClientID. The native RPC checks its fingerprint, version and key;
  // a different existing credential is refused rather than adopted/replaced.
  await page.locator('form').filter({has:page.locator('#sportlink-client-id')}).evaluate((form,value)=>{
   for(const [key,input] of Object.entries(value)){
    const field=form.querySelector('input[name="'+key+'"]');if(!field)throw Error('SETUP_SCOPE_MISSING');field.value=String(input);
   }
  },{club:f.slug,connectionId:f.connection,expectedVersion:0,idempotencyKey:f.configureKey});
  await page.getByRole('button',{name:'Koppeling opslaan',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#sportlink-client-id')?.value==='',undefined,{timeout:45000});
  await page.getByText('Een ClientID is opgeslagen voor deze vereniging.',{exact:true}).waitFor({timeout:45000});
  need(await page.locator('#sportlink-client-id').inputValue()==='','STAGING_SPORTLINK_SETUP_INPUT_NOT_CLEARED');report.saved_via_native_server_action=true;
  await ownRoute(page,forbidden);
  const durable=await actor.schema('api').rpc('sportlink_connection_state',{p_tenant_id:f.tenant});
  need(durable.error===null&&durable.data?.connection?.configured===true&&durable.data.connection.status==='preparing','STAGING_SPORTLINK_SETUP_SAVE_READBACK_REFUSED');
  if(durable.data.connection.last_test?.receipt?.code!=='VERIFIED_READ_ACCESS'){
   const testKey=await page.locator('form').filter({has:page.getByRole('button',{name:'Verbinding controleren',exact:true})}).locator('input[name="idempotencyKey"]').inputValue();
   await page.getByRole('button',{name:'Verbinding controleren',exact:true}).click();
   let ownTestConfirmed=false;
   for(let attempt=0;attempt<45;attempt++){
    const current=await actor.schema('api').rpc('sportlink_connection_state',{p_tenant_id:f.tenant});
    need(current.error===null,'STAGING_SPORTLINK_SETUP_NATIVE_READBACK_REFUSED');
    if(current.data?.connection?.last_test?.receipt?.idempotency_key===testKey){ownTestConfirmed=true;break;}
    await new Promise(resolve=>setTimeout(resolve,1000));
   }
   need(ownTestConfirmed,'STAGING_SPORTLINK_SETUP_OWN_TEST_RECEIPT_UNPROVED');
   await page.getByRole('status').filter({hasText:new RegExp(Object.values(LABELS).join('|'))}).waitFor({timeout:45000});
   report.read_test_via_native_server_action=true;
  }else report.read_test_via_native_server_action=false;
  await ownRoute(page,forbidden);
  const final=await actor.schema('api').rpc('sportlink_connection_state',{p_tenant_id:f.tenant});
  need(final.error===null&&final.data?.connection?.configured===true&&final.data.connection.status==='preparing'&&final.data.connection.last_success_at===null,
   'STAGING_SPORTLINK_SETUP_FINAL_STATE_REFUSED');
  const code=final.data.connection.last_test?.receipt?.code;need(CODES.includes(code),'STAGING_SPORTLINK_SETUP_TEST_RECEIPT_REFUSED');
  need((await page.locator('body').innerText()).includes(LABELS[code]),'STAGING_SPORTLINK_SETUP_SERVER_ATTESTATION_UNPROVED');
  assertSportlinkSetupPublicBody(await page.content(),forbidden);need(pageErrors.length===0,'STAGING_SPORTLINK_SETUP_BROWSER_ERROR');
  const native=await owner.readback();
  need(native.connection_count===1&&native.configured===true&&native.test_code===code&&native.native_audit_actor===true
   &&native.native_save_audits===1&&native.native_test_audits>=1,'STAGING_SPORTLINK_SETUP_AUDIT_READBACK_REFUSED');
  report.test_code=code;report.active_image_ssr_verified=true;report.server_attestation_verified=true;report.native_audit_verified=true;
  need(code==='VERIFIED_READ_ACCESS','STAGING_SPORTLINK_SETUP_PROVIDER_READ_NOT_CONFIRMED');
 }catch(error){primary=typeof error?.code==='string'&&/^STAGING_SPORTLINK_SETUP_[A-Z0-9_]{1,80}$/.test(error.code)?error.code:'STAGING_SPORTLINK_SETUP_UNAVAILABLE';}
 finally{
  clientId=undefined;
  if(context)try{await context.clearCookies();await context.close();}catch{primary='STAGING_SPORTLINK_SETUP_BROWSER_CLOSE_UNPROVED';}
  if(browser)try{await browser.close();}catch{primary='STAGING_SPORTLINK_SETUP_BROWSER_CLOSE_UNPROVED';}
  if(session&&admin){
   try{
    await closeSportlinkOperatorSession(admin,session);const after=await owner.readback();
    need(after.new_session_absent===true&&after.old_sessions_preserved===true&&after.account_fields_preserved===true,'STAGING_SPORTLINK_SETUP_SESSION_CLOSE_UNPROVED');
    report.created_session_closed=true;report.old_sessions_preserved=true;report.account_fields_preserved=true;
   }catch{primary='STAGING_SPORTLINK_SETUP_SESSION_CLOSE_UNPROVED';}
  }
  session=undefined;if(owner)try{await owner.close();}catch{primary='STAGING_SPORTLINK_SETUP_DATABASE_CLOSE_UNPROVED';}
 }
 report.passed=!primary;if(primary)report.error=primary;return report;
}
export async function runSportlinkSetupCli(environment,argv=[]){
 let report;
 try{report=argv.length?{scope:'STAGING_SPORTLINK_OPERATOR_SETUP_V1',passed:false,error:'STAGING_SPORTLINK_SETUP_ARGUMENTS_REFUSED'}:await runStagingSportlinkSetup(environment);
  await writeFile('staging-sportlink-setup.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({scope:report.scope,passed:report.passed,test_code:report.test_code??null,error:report.error??null,private_values_exported:false}));
  return report.passed?0:1;
 }catch{console.log('STAGING_SPORTLINK_SETUP_REPORT_UNAVAILABLE');return 1;}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])process.exitCode=await runSportlinkSetupCli(process.env,process.argv.slice(2));
