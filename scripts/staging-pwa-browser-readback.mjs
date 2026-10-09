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
const LIMITS={otp_flow_verified:false,coordinator_positive_flows_verified:false,physical_device_verified:false,
 email_sent:false,personal_account_changed:false,private_values_exported:false,v1_ready:false,production_enabled:false};
class BrowserQaError extends Error{constructor(code){super(code);this.code=code;}}
const need=(condition,code)=>{if(!condition)throw new BrowserQaError(code);};
const successful=response=>{need(response?.error===null,'STAGING_BROWSER_NATIVE_API_FAILED');return response.data;};
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
async function routeReadback(page,path,forbidden){
 const response=await page.goto(ORIGIN+path,{waitUntil:'networkidle',timeout:45000});
 need(response&&response.status()===200&&page.url()===ORIGIN+path,'STAGING_BROWSER_ROUTE_FAILED');
 assertPrivateBrowserBody(await response.text(),forbidden);
 assertPrivateBrowserBody(await page.locator('body').innerText(),forbidden);
 need((await page.locator('h1').count())===1&&(await page.getByRole('navigation',{name:'Hoofdnavigatie',exact:true}).getByRole('link').count())===5,'STAGING_BROWSER_APP_SHELL_FAILED');
 need(await page.getByRole('navigation',{name:'Hoofdnavigatie',exact:true}).locator('[aria-current="page"]').count()===1,'STAGING_BROWSER_ACTIVE_NAV_FAILED');
 need(/private/.test(response.headers()['cache-control']??'')&&/no-store/.test(response.headers()['cache-control']??''),'STAGING_BROWSER_PRIVATE_CACHE_FAILED');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
 need(!overflow,'STAGING_BROWSER_OVERFLOW');
 return {screen:path.split('/').at(-1),status:200,native_authorized:true,private_cache:true,privacy_denials:true,overflow:false};
}
async function rejectedContext(page,path,forbidden){
 const response=await page.goto(ORIGIN+path,{waitUntil:'networkidle',timeout:45000});
 need(response,'STAGING_BROWSER_DENIAL_FAILED');
 assertPrivateBrowserBody(await response.text(),forbidden);
 const text=await page.locator('body').innerText();assertPrivateBrowserBody(text,forbidden);
 need(page.url().startsWith(ORIGIN+'/app/login')||response.status()===404||text.includes('Je werkruimte kon niet worden geladen'),
  'STAGING_BROWSER_DENIAL_FAILED');
 return {denied:true,private_data_hidden:true};
}
export async function stagingBrowserReadback(environment){
 const report={scope:'STAGING_PWA_ACTIVE_IMAGE_BROWSER_READBACK_V1',observed_at:new Date().toISOString(),passed:false,
  app_fixture_mutations_performed:false,...LIMITS};
 let owner,provider,records,browser,fixtureAttempted=false,primary,closed=false;
 const contexts=[];
 try{
  const context=browserReadbackContext(environment);Object.assign(report,context);
  need(await activeStagingRelease(context.source_sha),'STAGING_BROWSER_ACTIVE_RELEASE_REQUIRED');
  const {chromium}=await browserModule(environment);
  owner=await NativeQaSession.connect(environment);
  provider=await createStagingNativeQaProvider(owner,environment);records=provider.privateProviderRecords();
  fixtureAttempted=true;report.app_fixture_mutations_performed=true;report.fixture=await owner.setupFixture(records);
  const fixture=nativeQaFixtureIds(context.workflow_run_id),canaries=await privateFixtureReadback(provider,fixture);
  browser=await chromium.launch({headless:true,env:browserProcessEnvironment(environment)});report.browser={engine:'Chromium',version:browser.version(),physical:false,viewport:{width:390,height:844}};
  const a=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(a);
  await sessionCookies(provider,'a',environment,a);const page=await a.newPage();
  const errors=[];page.on('pageerror',()=>errors.push(true));
  const slugA='cluvo-pwa-qa-'+context.workflow_run_id+'-a',slugB='cluvo-pwa-qa-'+context.workflow_run_id+'-b';
  const privateCredentials=['SUPABASE_SECRET_KEY','MIGRATION_DATABASE_URL'].map(key=>environment[key]).filter(value=>typeof value==='string'&&value.length>8);
  const forbidden=[canaries[1],canaries[2],fixture.intakeB,fixture.intakeBForeign,fixture.tenantB,fixture.teamB,'pwa-minor-contact-canary@example.test',...privateCredentials];
  report.routes=[];
  for(const screen of BROWSER_SCREENS)report.routes.push(await routeReadback(page,'/app/c/'+slugA+'/'+screen,forbidden));
  await routeReadback(page,'/app/c/'+slugA+'/profile',forbidden);
  await page.locator('.wizard-progress').getByRole('button',{name:'Beschikbaar',exact:true}).click();
  need(await page.getByLabel('Praktische grenzen (optioneel)').inputValue()===canaries[0],'STAGING_BROWSER_OWN_PROFILE_POSITIVE_FAILED');
  report.own_profile_positive=true;
  report.positive_matrix_page_errors=errors.length;
  need(errors.length===0,'STAGING_BROWSER_POSITIVE_PAGE_ERROR');
  report.foreign_club=await rejectedContext(page,'/app/c/'+slugB+'/home',[...forbidden,canaries[0]]);
  report.foreign_household=await rejectedContext(page,'/app/c/'+slugA+'/home?household='+fixture.householdB,[canaries[1],canaries[2],...privateCredentials]);
  report.foreign_season=await rejectedContext(page,'/app/c/'+slugA+'/home?season='+fixture.seasonB,[canaries[1],canaries[2],...privateCredentials]);
  const b=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});contexts.push(b);
  await sessionCookies(provider,'b',environment,b);const minor=await b.newPage();
  await routeReadback(minor,'/app/c/'+slugB+'/teams',[canaries[0],canaries[1],fixture.tenantA,fixture.teamA,'pwa-minor-contact-canary@example.test',...privateCredentials]);
  need((await minor.locator('body').innerText()).includes('QA minor team B'),'STAGING_BROWSER_MINOR_TEAM_POSITIVE_FAILED');
  report.minor_team_positive_private_contacts_hidden=true;
  const oldCookies=await a.cookies();await provider.revokeSession('a');await a.clearCookies();await a.addCookies(oldCookies);
  await provider.withActor('a',async({accessToken})=>{
   const claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8'));
   need(Number.isSafeInteger(claims.exp)&&claims.exp>Math.floor(Date.now()/1000),'STAGING_BROWSER_REVOCATION_EXPIRY_UNPROVED');
  });
  report.revoked_old_session=await rejectedContext(page,'/app/c/'+slugA+'/profile',[...canaries,...privateCredentials]);
  await routeReadback(minor,'/app/c/'+slugB+'/teams',[canaries[0],canaries[1],fixture.tenantA,fixture.teamA,'pwa-minor-contact-canary@example.test',...privateCredentials]);
  need((await minor.locator('body').innerText()).includes('QA minor team B'),'STAGING_BROWSER_OTHER_SESSION_POSITIVE_FAILED');
  report.other_native_session_still_active=true;
  need(await activeStagingRelease(context.source_sha),'STAGING_BROWSER_ACTIVE_RELEASE_CHANGED');
  report.active_source_before_and_after=true;report.native_provider_sessions=true;
  report.passed=true;
 }catch(error){
  primary=/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'STAGING_BROWSER_READBACK_UNAVAILABLE';
  if(error?.code==='STAGING_NATIVE_QA_PROVIDER_CLEANUP_REQUIRED')try{report.provider=await retryStagingNativeQaProviderCleanup(error);}
  catch{primary='STAGING_BROWSER_PROVIDER_CLEANUP_UNPROVED';}
 }finally{
  for(const context of contexts)try{await context.clearCookies();await context.close();}catch{primary='STAGING_BROWSER_CONTEXT_CLEANUP_UNPROVED';}
  if(browser)try{await browser.close();}catch{primary='STAGING_BROWSER_CONTEXT_CLEANUP_UNPROVED';}
  if(fixtureAttempted&&records)try{report.teardown=await owner.teardown();}
  catch{
   try{await owner?.close();owner=await NativeQaSession.connect(environment);report.teardown=await owner.teardown(records);}
   catch{primary='STAGING_BROWSER_SCOPE_CLEANUP_UNPROVED';}
  }
  if(provider)try{
   report.provider=await provider.cleanup();
   need(report.provider.cleanup_complete===true&&report.provider.created_users===2&&report.provider.soft_deleted_users===2
    &&report.provider.globally_revoked_sessions===2,'STAGING_BROWSER_PROVIDER_CLEANUP_UNPROVED');
  }catch{primary='STAGING_BROWSER_PROVIDER_CLEANUP_UNPROVED';}
  if(owner)try{await owner.close();closed=true;}catch{primary='STAGING_BROWSER_CONNECTION_CLOSE_UNPROVED';}
  if(report.passed)try{
   const t=report.teardown;
   need(t?.scope==='STAGING_NATIVE_QA_TEARDOWN_V1'&&['archived','already_archived'].includes(t.status)&&t.qa_scopes_archived===2
    &&t.active_qa_memberships===0&&t.active_qa_grants===0&&t.retained_answer_revisions===3&&t.retained_bookings===0
    &&t.retained_ledger_entries===0&&t.teardown_audits===1&&t.histories_preserved===true,'STAGING_BROWSER_SCOPE_CLEANUP_UNPROVED');
  }catch{primary='STAGING_BROWSER_SCOPE_CLEANUP_UNPROVED';}
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
