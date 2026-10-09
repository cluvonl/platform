// Browser proof of the active staging image. Synthetic provider sessions stay
// in memory; the same Supabase SSR codec writes their actual session cookies.
import {createServerClient} from '@supabase/ssr';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {NativeQaSession} from './staging-pwa-native-qa-session.mjs';
import {createStagingNativeQaProvider,retryStagingNativeQaProviderCleanup} from './staging-pwa-native-qa-provider.mjs';
import {nativeQaFixtureIds} from './staging-pwa-native-qa-fixture.mjs';
import {activeStagingRelease} from './staging-pwa-release-health.mjs';

const ORIGIN='https://staging.cluvo.nl',PROJECT='fbozlbgmktkgcdfqdaaz';
export const BROWSER_SCREENS=Object.freeze(['home','tasks','agenda','teams','more','actions','notifications','manage','profile','household','policies','courses','opportunities','messages','settings','help','install','reports','finance','committees']);
export const ADMIN_BROWSER_SECTIONS=Object.freeze(['cockpit','organization','people','access','committees','teams','planning',
 'execution','requests','policies','courses','communication','reports','seasons','support']);
const LIMITS={otp_flow_verified:false,coordinator_positive_flows_verified:false,physical_device_verified:false,
 email_sent:false,personal_account_changed:false,private_values_exported:false,v1_ready:false,production_enabled:false};
const PHASES=new Set(['context','active_release_before','toolchain','native_connection','provider','fixture','fixture_privacy',
 'browser_launch','actor_a_session','positive_routes','own_profile','positive_page_errors','foreign_club','foreign_household',
 'foreign_season','actor_b_session','minor_team','admin_fixture','admin_routes','admin_save','admin_second_device','admin_denials',
 'session_revocation','revoked_session','other_session','active_release_after','cleanup']);
const OPERATIONS=new Set(['validate','connect','setup','readback','launch','session','navigation','route_status','ssr_privacy',
 'app_shell','active_navigation','font_readiness','dom_privacy','private_cache','overflow','profile_control','page_errors',
 'positive_content','form_ready','save','revoke','claim_expiry','context_close','browser_close','fixture_teardown','provider_cleanup','connection_close']);
class BrowserQaError extends Error{constructor(code){super(code);this.code=code;}}
const need=(condition,code)=>{if(!condition)throw new BrowserQaError(code);};
const successful=response=>{need(response?.error===null,'STAGING_BROWSER_NATIVE_API_FAILED');return response.data;};
export function browserFailureDiagnostic(error,position){
 // Never include exception messages/stacks, URLs, query strings, selectors,
 // provider identities or any fields supplied by the private error object.
 const name=Object.getOwnPropertyDescriptor(error??{},'name')?.value;
 const errorClass=error instanceof BrowserQaError?'BrowserQaError':error instanceof TypeError?'TypeError'
  :error instanceof SyntaxError?'SyntaxError':error instanceof RangeError?'RangeError'
  :['TimeoutError','AbortError','Error'].includes(name)?name:error instanceof Error?'Error':'UnknownError';
 return Object.freeze({phase:PHASES.has(position?.phase)?position.phase:'unknown',
  screen:BROWSER_SCREENS.includes(position?.screen)?position.screen:null,
  operation:OPERATIONS.has(position?.operation)?position.operation:'unknown',error_class:errorClass,
  ...(Number.isSafeInteger(position?.response_status)&&position.response_status>=100&&position.response_status<=599
   ?{response_status:position.response_status}:{})});
}
export function browserReadbackContext(environment){
 const keys=['APP_ENV','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SHA','RELEASE_SHA','GITHUB_RUN_ID','GITHUB_ACTOR','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL'];
 need(environment&&typeof environment==='object','STAGING_BROWSER_CONTEXT_REQUIRED');
 const values=Object.fromEntries(keys.map(key=>{
  const value=Object.getOwnPropertyDescriptor(environment,key)?.value;
  need(typeof value==='string'&&value.length>0&&value.length<=2048&&!/[\r\n\0]/.test(value),'STAGING_BROWSER_CONTEXT_REQUIRED');
  return[key,value];
 }));
 need(values.APP_ENV==='staging'&&values.GITHUB_REPOSITORY==='cluvonl/platform'&&values.GITHUB_REF==='refs/heads/staging'
  &&values.GITHUB_EVENT_NAME==='workflow_dispatch'&&/^[0-9a-f]{40}$/.test(values.RELEASE_SHA)&&values.GITHUB_SHA===values.RELEASE_SHA
  &&/^[1-9][0-9]{0,19}$/.test(values.GITHUB_RUN_ID)&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(values.GITHUB_ACTOR)
  &&values.STAGING_SUPABASE_PROJECT_REF===PROJECT&&values.SUPABASE_URL==='https://'+PROJECT+'.supabase.co','STAGING_BROWSER_CONTEXT_REQUIRED');
 return Object.freeze({source_sha:values.RELEASE_SHA,workflow_run_id:values.GITHUB_RUN_ID});
}
export function assertPrivateBrowserBody(body,forbidden){
 need(typeof body==='string'&&body.length<=4_000_000&&Array.isArray(forbidden)&&forbidden.every(value=>typeof value==='string'&&value.length>0),'STAGING_BROWSER_BODY_INVALID');
 need(!forbidden.some(value=>body.includes(value)),'STAGING_BROWSER_PRIVATE_DATA_LEAK');
}
export function browserProcessEnvironment(environment){
 // The browser receives user session cookies, never database/provider/admin
 // credentials inherited from the trusted parent workflow step.
 const result={PATH:'/usr/bin:/bin',LANG:'C.UTF-8'};
 for(const key of ['PATH','HOME','LANG','LC_ALL','TMPDIR']){
  const value=Object.getOwnPropertyDescriptor(environment,key)?.value;
  if(typeof value==='string'&&value.length>0&&value.length<=8192&&!/[\r\n\0]/.test(value))result[key]=value;
 }
 return Object.freeze(result);
}
async function browserModule(environment){
 const path=environment.PWA_PLAYWRIGHT_MODULE;
 need(isAbsolute(path??'')&&path.endsWith('/node_modules/playwright/index.mjs'),'STAGING_BROWSER_TOOLCHAIN_REQUIRED');
 const metadata=JSON.parse(await readFile(join(dirname(path),'package.json'),'utf8'));
 need(metadata.name==='playwright'&&metadata.version==='1.63.0','STAGING_BROWSER_TOOLCHAIN_REQUIRED');
 return await import(pathToFileURL(path).href);
}
async function sessionCookies(provider,slot,environment,browserContext){
 await provider.withBrowserSession(slot,async({accessToken,refreshToken,authUserId})=>{
  const jar=new Map();
  const client=createServerClient(environment.SUPABASE_URL,environment.SUPABASE_PUBLISHABLE_KEY,{
   auth:{autoRefreshToken:false,detectSessionInUrl:false},
   global:{fetch:(input,init={})=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    need(url.origin==='https://'+PROJECT+'.supabase.co'&&url.pathname.startsWith('/auth/v1/'),'STAGING_BROWSER_AUTH_TARGET_REFUSED');
    return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});
   }},
   cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>{
    for(const item of values)jar.set(item.name,item.value);
   }},
  });
  const response=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
  need(response.error===null&&response.data.user?.id===authUserId&&response.data.session?.access_token===accessToken,
   'STAGING_BROWSER_NATIVE_SESSION_UNVERIFIED');
  need(jar.size>0&&jar.size<=8&&[...jar].every(([name,value])=>name.startsWith('sb-'+PROJECT+'-auth-token')&&value.length<=4096),'STAGING_BROWSER_SESSION_COOKIE_INVALID');
  await browserContext.addCookies([...jar].map(([name,value])=>({name,value,url:ORIGIN+'/',secure:true,sameSite:'Lax'})));
  jar.clear();
 });
}
async function privateFixtureReadback(provider,fixture){
 const canaries=[0,1,2].map(()=>randomBytes(18).toString('hex'));
 for(const [slot,tenant,profile,index]of [['a',fixture.tenantA,fixture.intakeA,0],['b',fixture.tenantA,fixture.intakeB,1],['b',fixture.tenantB,fixture.intakeBForeign,2]]){
  await provider.withActor(slot,async({client})=>{
   for(const [action,resource,expectedVersion,payload]of [
    ['save_preferences',tenant,0,{email:false,push:false,inbox:true,reminders:false,team:false,news:false}],
    ['save_profile',profile,1,{experience:canaries[index],preferences:[],talents:[],availability:[],monthly_minutes:120,boundaries:canaries[index],reserve:false,buddy:false}],
   ]){
    const rows=successful(await client.schema('api').rpc('pwa_command',{p_tenant_id:tenant,p_action:action,p_resource_id:resource,
     p_expected_version:expectedVersion,p_payload:payload,p_idempotency_key:randomUUID()}));
    need(Array.isArray(rows)&&rows.length===1&&rows[0].ok===true,'STAGING_BROWSER_FIXTURE_READBACK_FAILED');
   }
   const snapshot=successful(await client.schema('api').rpc('pwa_snapshot',{p_tenant_id:tenant,p_season_id:null,p_household_id:null}));
   need(snapshot?.context?.person_id===fixture[index===0?'personA':index===1?'personB':'personBForeign'],'STAGING_BROWSER_NATIVE_IDENTITY_UNPROVED');
   assertPrivateBrowserBody(JSON.stringify(snapshot),canaries.filter((_,other)=>other!==index));
  });
 }
 return canaries;
}
export async function browserRouteReadback(page,path,forbidden,onStage=()=>{}){
 const candidate=path.split('?')[0].split('/').at(-1),screen=BROWSER_SCREENS.includes(candidate)?candidate:null;
 let status;
 const stage=operation=>onStage({screen,operation,...(status?{response_status:status}:{})});
 stage('navigation');
 const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:45000});
 status=response?.status();stage('route_status');
 need(response&&response.status()===200&&page.url()===ORIGIN+path,'STAGING_BROWSER_ROUTE_FAILED');
 stage('ssr_privacy');
 assertPrivateBrowserBody(await response.text(),forbidden);
 // Read the actual SSR shell. Background requests/prefetches are not a page
 // readiness signal. These waits stay bounded even when the shell is absent.
 stage('app_shell');
 await page.locator('h1').waitFor({state:'visible',timeout:15000});
 const navigation=page.getByRole('navigation',{name:'Hoofdnavigatie',exact:true});
 await navigation.waitFor({state:'visible',timeout:15000});
 need((await page.locator('h1').count())===1&&(await navigation.getByRole('link').count())===5,'STAGING_BROWSER_APP_SHELL_FAILED');
 stage('active_navigation');
 need(await navigation.locator('[aria-current="page"]').count()===1,'STAGING_BROWSER_ACTIVE_NAV_FAILED');
 stage('font_readiness');
 await page.waitForFunction(()=>document.fonts.status==='loaded',null,{timeout:15000});
 stage('dom_privacy');
 assertPrivateBrowserBody(await page.locator('body').innerText({timeout:15000}),forbidden);
 stage('private_cache');
 need(/private/.test(response.headers()['cache-control']??'')&&/no-store/.test(response.headers()['cache-control']??''),'STAGING_BROWSER_PRIVATE_CACHE_FAILED');
 stage('overflow');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 need(!overflow,'STAGING_BROWSER_OVERFLOW');
 return {screen,status:200,native_authorized:true,private_cache:true,privacy_denials:true,overflow:false};
}
export async function browserRejectedContext(page,path,forbidden,onStage=()=>{}){
 const candidate=path.split('?')[0].split('/').at(-1),screen=BROWSER_SCREENS.includes(candidate)?candidate:null;
 let status;
 const stage=operation=>onStage({screen,operation,...(status?{response_status:status}:{})});
 stage('navigation');
 const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:45000});
 status=response?.status();stage('route_status');
 need(response,'STAGING_BROWSER_DENIAL_FAILED');
 stage('ssr_privacy');
 assertPrivateBrowserBody(await response.text(),forbidden);
 stage('dom_privacy');
 const text=await page.locator('body').innerText({timeout:15000});assertPrivateBrowserBody(text,forbidden);
 stage('route_status');
 need(page.url().startsWith(ORIGIN+'/app/login')||response.status()===404||text.includes('Je werkruimte kon niet worden geladen'),
  'STAGING_BROWSER_DENIAL_FAILED');
 return {denied:true,private_data_hidden:true};
}
async function adminRouteReadback(page,path,forbidden,onStage){
 onStage({operation:'navigation'});
 const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:45000});
 onStage({operation:'route_status',response_status:response?.status()});
 need(response?.status()===200&&page.url()===ORIGIN+path,'STAGING_ADMIN_BROWSER_ROUTE_FAILED');
 assertPrivateBrowserBody(await response.text(),forbidden);
 await page.locator('.cluvo-admin h1').waitFor({state:'visible',timeout:15000});
 await page.waitForFunction(()=>document.fonts.status==='loaded',null,{timeout:15000});
 assertPrivateBrowserBody(await page.locator('body').innerText(),forbidden);
 need(/private/.test(response.headers()['cache-control']??'')&&/no-store/.test(response.headers()['cache-control']??''),'STAGING_ADMIN_BROWSER_PRIVATE_CACHE_FAILED');
 need(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'STAGING_ADMIN_BROWSER_OVERFLOW');
 need(await page.locator('.cluvo-admin h1').evaluate(el=>getComputedStyle(el).fontFamily.toLowerCase().includes('inter')),'STAGING_ADMIN_BROWSER_STYLE_FAILED');
 return {section:path.split('?')[0].split('/').at(-1),status:200,native_authorized:true,private_cache:true,overflow:false};
}
async function adminDeniedReadback(page,path,forbidden,onStage){
 onStage({operation:'navigation'});
 const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:45000});
 onStage({operation:'route_status',response_status:response?.status()});
 need(response,'STAGING_ADMIN_BROWSER_DENIAL_FAILED');
 assertPrivateBrowserBody(await response.text(),forbidden);
 const body=await page.locator('body').innerText();assertPrivateBrowserBody(body,forbidden);
 need((response.status()===404||body.includes('404')||page.url().startsWith(ORIGIN+'/login'))
   &&await page.locator('.cluvo-admin').count()===0,'STAGING_ADMIN_BROWSER_DENIAL_FAILED');
 return {denied:true,private_data_hidden:true};
}
export async function stagingBrowserReadback(environment){
 const report={scope:'STAGING_PWA_ACTIVE_IMAGE_BROWSER_READBACK_V1',observed_at:new Date().toISOString(),passed:false,
  app_fixture_mutations_performed:false,...LIMITS};
 let owner,provider,records,browser,fixtureAttempted=false,primary,closed=false;
 const contexts=[];
 let position={phase:'context',operation:'validate'};
 const phase=(value,operation='validate',screen=null)=>{position={phase:value,operation,screen};};
 const routeStage=value=>{position={phase:position.phase,...value};};
 const cleanupFailure=(error,operation)=>{
  (report.cleanup_failures??=[]).push(browserFailureDiagnostic(error,{phase:'cleanup',operation}));
 };
 try{
  const context=browserReadbackContext(environment);Object.assign(report,context);
  phase('active_release_before');
  need(await activeStagingRelease(context.source_sha),'STAGING_BROWSER_ACTIVE_RELEASE_REQUIRED');
  phase('toolchain');
  const {chromium}=await browserModule(environment);
  phase('native_connection','connect');
  owner=await NativeQaSession.connect(environment);
  phase('provider','setup');
  provider=await createStagingNativeQaProvider(owner,environment);records=provider.privateProviderRecords();
  phase('fixture','setup');
  fixtureAttempted=true;report.app_fixture_mutations_performed=true;report.fixture=await owner.setupFixture(records);
  phase('fixture_privacy','readback');
  const fixture=nativeQaFixtureIds(context.workflow_run_id),canaries=await privateFixtureReadback(provider,fixture);
  phase('browser_launch','launch');
  browser=await chromium.launch({headless:true,env:browserProcessEnvironment(environment)});report.browser={engine:'Chromium',version:browser.version(),physical:false,viewport:{width:390,height:844}};
  phase('actor_a_session','session');
  const a=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(a);
  await sessionCookies(provider,'a',environment,a);const page=await a.newPage();
  const errors=[];page.on('pageerror',()=>errors.push(true));
  const slugA='cluvo-pwa-qa-'+context.workflow_run_id+'-a',slugB='cluvo-pwa-qa-'+context.workflow_run_id+'-b';
  const privateCredentials=['SUPABASE_SECRET_KEY','MIGRATION_DATABASE_URL'].map(key=>environment[key]).filter(value=>typeof value==='string'&&value.length>8);
  const forbidden=[canaries[1],canaries[2],fixture.intakeB,fixture.intakeBForeign,fixture.tenantB,fixture.teamB,'pwa-minor-contact-canary@example.test',...privateCredentials];
  report.routes=[];
  phase('positive_routes','navigation');
  for(const screen of BROWSER_SCREENS)report.routes.push(await browserRouteReadback(page,'/app/c/'+slugA+'/'+screen,forbidden,routeStage));
  phase('own_profile','navigation','profile');
  await browserRouteReadback(page,'/app/c/'+slugA+'/profile',forbidden,routeStage);
  phase('own_profile','profile_control','profile');
  await page.locator('.wizard-progress').getByRole('button',{name:'Beschikbaar',exact:true}).click({timeout:15000});
  need(await page.getByLabel('Praktische grenzen (optioneel)').inputValue({timeout:15000})===canaries[0],'STAGING_BROWSER_OWN_PROFILE_POSITIVE_FAILED');
  report.own_profile_positive=true;
  phase('positive_page_errors','page_errors');
  report.positive_matrix_page_errors=errors.length;
  need(errors.length===0,'STAGING_BROWSER_POSITIVE_PAGE_ERROR');
  phase('foreign_club','navigation');
  report.foreign_club=await browserRejectedContext(page,'/app/c/'+slugB+'/home',[...forbidden,canaries[0]],routeStage);
  phase('foreign_household','navigation');
  report.foreign_household=await browserRejectedContext(page,'/app/c/'+slugA+'/home?household='+fixture.householdB,[canaries[1],canaries[2],...privateCredentials],routeStage);
  phase('foreign_season','navigation');
  report.foreign_season=await browserRejectedContext(page,'/app/c/'+slugA+'/home?season='+fixture.seasonB,[canaries[1],canaries[2],...privateCredentials],routeStage);
  phase('actor_b_session','session');
  const b=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(b);
  await sessionCookies(provider,'b',environment,b);const minor=await b.newPage();
  phase('minor_team','navigation','teams');
  await browserRouteReadback(minor,'/app/c/'+slugB+'/teams',[canaries[0],canaries[1],fixture.tenantA,fixture.teamA,'pwa-minor-contact-canary@example.test',...privateCredentials],routeStage);
  phase('minor_team','positive_content','teams');
  need((await minor.locator('body').innerText({timeout:15000})).includes('QA minor team B'),'STAGING_BROWSER_MINOR_TEAM_POSITIVE_FAILED');
  report.minor_team_positive_private_contacts_hidden=true;
  phase('admin_fixture','setup');
  report.administration_fixture=await owner.setupAdminAccess();
  need(report.administration_fixture?.scope==='STAGING_ADMIN_QA_ACCESS_V1'
    &&report.administration_fixture.platform_grants_created===0,'STAGING_ADMIN_BROWSER_FIXTURE_FAILED');
  phase('admin_routes','navigation');report.administration_routes=[];
  for(const section of ADMIN_BROWSER_SECTIONS)
   report.administration_routes.push(await adminRouteReadback(page,'/c/'+slugA+'/beheer/'+section,forbidden,routeStage));
  phase('admin_save','navigation');
  await adminRouteReadback(page,'/c/'+slugA+'/beheer/organization?part=locations',forbidden,routeStage);
  const panel=page.locator('.admin-form-panel').filter({has:page.getByRole('heading',{name:'Locatie',exact:true})});
  phase('admin_save','form_ready');
  await panel.and(page.locator('[data-ready="true"]')).waitFor({timeout:15000});
  const location='QA opgeslagen locatie '+context.workflow_run_id;
  await panel.getByLabel('Naam',{exact:true}).fill(location);
  await panel.getByLabel('Reden en vervolgstap',{exact:true}).fill('Synthetische stagingcontrole op opslag en tweede apparaat');
  phase('admin_save','save');await panel.getByRole('button',{name:'Locatie opslaan',exact:true}).click();
  await panel.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor({timeout:30000});
  await provider.withActor('a',async({client})=>{
   const saved=successful(await client.schema('api').rpc('club_admin_read',
    {p_tenant:fixture.tenantA,p_season:null,p_section:'locations',p_filters:{}}));
   need(saved?.rows?.filter(row=>row.name===location).length===1,'STAGING_ADMIN_BROWSER_SAVE_READBACK_FAILED');
  });
  phase('admin_second_device','session');
  const second=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});contexts.push(second);
  await sessionCookies(provider,'a',environment,second);const desktop=await second.newPage();
  phase('admin_second_device','navigation');
  await adminRouteReadback(desktop,'/c/'+slugA+'/beheer/organization?part=locations',forbidden,routeStage);
  need(await desktop.getByText(location,{exact:true}).count()>0,'STAGING_ADMIN_BROWSER_SECOND_DEVICE_FAILED');
  report.administration_saved_action={native_readback:true,second_browser_context:true,same_provider_session:true,second_independent_otp_session:false};
  phase('admin_denials','navigation');
  report.administration_denials=[];
  for(const path of ['/c/'+slugA+'/beheer/organization','/c/'+slugA+'/beheer/finance','/platform/overview'])
   report.administration_denials.push(await adminDeniedReadback(minor,path,[...canaries,...privateCredentials],routeStage));
  need(errors.length===0,'STAGING_ADMIN_BROWSER_PAGE_ERROR');
  report.administration_positive_flows_verified=true;
  phase('session_revocation','revoke');
  const oldCookies=await a.cookies();await provider.revokeSession('a');await a.clearCookies();await a.addCookies(oldCookies);
  phase('session_revocation','claim_expiry');
  await provider.withActor('a',async({accessToken})=>{
   const claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8'));
   need(Number.isSafeInteger(claims.exp)&&claims.exp>Math.floor(Date.now()/1000),'STAGING_BROWSER_REVOCATION_EXPIRY_UNPROVED');
  });
  phase('revoked_session','navigation','profile');
  report.revoked_old_session=await browserRejectedContext(page,'/app/c/'+slugA+'/profile',[...canaries,...privateCredentials],routeStage);
  phase('other_session','navigation','teams');
  await browserRouteReadback(minor,'/app/c/'+slugB+'/teams',[canaries[0],canaries[1],fixture.tenantA,fixture.teamA,'pwa-minor-contact-canary@example.test',...privateCredentials],routeStage);
  phase('other_session','positive_content','teams');
  need((await minor.locator('body').innerText({timeout:15000})).includes('QA minor team B'),'STAGING_BROWSER_OTHER_SESSION_POSITIVE_FAILED');
  report.other_native_session_still_active=true;
  phase('active_release_after');
  need(await activeStagingRelease(context.source_sha),'STAGING_BROWSER_ACTIVE_RELEASE_CHANGED');
  report.active_source_before_and_after=true;report.native_provider_sessions=true;
  report.passed=true;
 }catch(error){
  report.failure=browserFailureDiagnostic(error,position);
  primary=/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'STAGING_BROWSER_READBACK_UNAVAILABLE';
  if(error?.code==='STAGING_NATIVE_QA_PROVIDER_CLEANUP_REQUIRED')try{report.provider=await retryStagingNativeQaProviderCleanup(error);}
  catch(cleanupError){cleanupFailure(cleanupError,'provider_cleanup');primary='STAGING_BROWSER_PROVIDER_CLEANUP_UNPROVED';}
 }finally{
  for(const context of contexts)try{await context.clearCookies();await context.close();}catch(error){cleanupFailure(error,'context_close');primary='STAGING_BROWSER_CONTEXT_CLEANUP_UNPROVED';}
  if(browser)try{await browser.close();}catch(error){cleanupFailure(error,'browser_close');primary='STAGING_BROWSER_CONTEXT_CLEANUP_UNPROVED';}
  if(fixtureAttempted&&records)try{report.teardown=await owner.teardown();}
  catch{
   try{await owner?.close();owner=await NativeQaSession.connect(environment);report.teardown=await owner.teardown(records);}
   catch(error){cleanupFailure(error,'fixture_teardown');primary='STAGING_BROWSER_SCOPE_CLEANUP_UNPROVED';}
  }
  if(provider)try{
   report.provider=await provider.cleanup();
   need(report.provider.cleanup_complete===true&&report.provider.created_users===2&&report.provider.soft_deleted_users===2
    &&report.provider.globally_revoked_sessions===2,'STAGING_BROWSER_PROVIDER_CLEANUP_UNPROVED');
  }catch(error){cleanupFailure(error,'provider_cleanup');primary='STAGING_BROWSER_PROVIDER_CLEANUP_UNPROVED';}
  if(owner)try{await owner.close();closed=true;}catch(error){cleanupFailure(error,'connection_close');primary='STAGING_BROWSER_CONNECTION_CLOSE_UNPROVED';}
  if(report.passed)try{
   const t=report.teardown;
   need(t?.scope==='STAGING_NATIVE_QA_TEARDOWN_V1'&&['archived','already_archived'].includes(t.status)&&t.qa_scopes_archived===2
    &&t.active_qa_memberships===0&&t.active_qa_grants===0&&t.retained_answer_revisions===3&&t.retained_bookings===0
    &&t.retained_ledger_entries===0&&t.teardown_audits===1&&t.histories_preserved===true,'STAGING_BROWSER_SCOPE_CLEANUP_UNPROVED');
  }catch(error){cleanupFailure(error,'fixture_teardown');primary='STAGING_BROWSER_SCOPE_CLEANUP_UNPROVED';}
 }
 return {...report,passed:report.passed&&!primary,returned_session_closed:closed,...(primary?{error:primary}:{}),...LIMITS};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  need(process.argv.length===2,'STAGING_BROWSER_ARGUMENTS_UNEXPECTED');
  const report=await stagingBrowserReadback(process.env);
  await writeFile('staging-pwa-browser-readback.json',JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({scope:report.scope,passed:report.passed,...(report.error?{error:report.error}:{}),...LIMITS}));
  process.exitCode=report.passed?0:1;
 }catch{console.log('STAGING_BROWSER_REPORT_UNAVAILABLE');process.exitCode=1;}
}
