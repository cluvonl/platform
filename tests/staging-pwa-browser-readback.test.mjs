import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {adminRouteReadback,assertPrivateBrowserBody,BROWSER_SCREENS,browserFailureDiagnostic,browserProcessEnvironment,browserReadbackContext,
 browserRejectedContext,browserRouteReadback,stagingBrowserReadback} from '../scripts/staging-pwa-browser-readback.mjs';

const sha='a'.repeat(40);
const base={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',
 GITHUB_SHA:sha,RELEASE_SHA:sha,GITHUB_RUN_ID:'424242',GITHUB_ACTOR:'cluvo-test',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',
 SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',MIGRATION_DATABASE_URL:'private-fixture-not-connected'};

test('browser readback refuses wrong staging identity before provider, database or browser access',async()=>{
 for(const change of [{APP_ENV:'production'},{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/main'},
  {GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'b'.repeat(40)},{GITHUB_RUN_ID:'0'},{STAGING_SUPABASE_PROJECT_REF:'another'},
  {SUPABASE_URL:'https://another.supabase.co'},{GITHUB_ACTOR:'bad\nactor'}]){
  assert.throws(()=>browserReadbackContext({...base,...change}),/STAGING_BROWSER_CONTEXT_REQUIRED/);
  const report=await stagingBrowserReadback({...base,...change});
  assert.equal(report.passed,false);assert.equal(report.app_fixture_mutations_performed,false);assert.equal(report.returned_session_closed,false);
  assert.equal(report.production_enabled,false);assert.equal(report.private_values_exported,false);assert.equal(report.physical_device_verified,false);
  assert.equal(JSON.stringify(report).includes(base.MIGRATION_DATABASE_URL),false);
  assert.equal(Object.hasOwn(report,'provider'),false);assert.equal(Object.hasOwn(report,'browser'),false);
  assert.deepEqual(report.failure,{phase:'context',screen:null,operation:'validate',error_class:'BrowserQaError'});
 }
 assert.deepEqual(browserReadbackContext(base),{source_sha:sha,workflow_run_id:'424242'});
});

test('failure diagnostics allow only fixed stages, screen names, error classes and HTTP status numbers',()=>{
 const sensitive='synthetic-private-value';
 for(const error of [Object.assign(new Error(sensitive),{name:sensitive,stack:sensitive,code:sensitive}),
  {name:sensitive,message:sensitive,stack:sensitive,code:sensitive},new TypeError(sensitive),new SyntaxError(sensitive),new RangeError(sensitive)]){
  const diagnostic=browserFailureDiagnostic(error,{phase:'positive_routes',screen:'agenda',operation:'navigation',
   response_status:200,path:sensitive,selector:sensitive});
  assert.deepEqual(Object.keys(diagnostic),['phase','screen','operation','error_class','response_status']);
  assert.equal(diagnostic.phase,'positive_routes');assert.equal(diagnostic.screen,'agenda');assert.equal(diagnostic.operation,'navigation');
  assert.equal(diagnostic.response_status,200);assert.equal(JSON.stringify(diagnostic).includes(sensitive),false);
  assert.ok(['Error','UnknownError','TypeError','SyntaxError','RangeError'].includes(diagnostic.error_class));
  assert.equal(Object.isFrozen(diagnostic),true);
 }
 assert.deepEqual(browserFailureDiagnostic({name:'TimeoutError',message:sensitive},{phase:sensitive,screen:sensitive,
  operation:sensitive,response_status:NaN}),{phase:'unknown',screen:null,operation:'unknown',error_class:'TimeoutError'});
 const withGetter={};Object.defineProperty(withGetter,'name',{get(){throw Error(sensitive);}});
 assert.equal(browserFailureDiagnostic(withGetter,{}).error_class,'UnknownError');
});

// The fixed separate browser toolchain is optional for routine unit runs. In a
// proof run, every request is intercepted locally, with no provider or DB use.
const browserToolchain=process.env.PWA_BROWSER_TEST_MODULE;
async function fixtureBrowser(run){
 assert.ok(isAbsolute(browserToolchain??'')&&browserToolchain.endsWith('/node_modules/playwright/index.mjs'));
 const metadata=JSON.parse(await readFile(join(dirname(browserToolchain),'package.json'),'utf8'));
 assert.equal(metadata.name,'playwright');assert.equal(metadata.version,'1.63.0');
 const {chromium}=await import(pathToFileURL(browserToolchain).href);
 const browser=await chromium.launch({headless:true,env:browserProcessEnvironment(process.env)});
 try{await run(browser);}finally{await browser.close();}
}
const origin='https://staging.cluvo.nl',path='/app/c/local-synthetic-fixture/agenda';
const shell=`<main><h1>Gezinsagenda</h1></main><nav aria-label="Hoofdnavigatie">${['home','tasks','agenda','teams','more']
 .map(screen=>`<a href="${screen}"${screen==='agenda'?' aria-current="page"':''}>${screen}</a>`).join('')}</nav>`;
const documentHtml=(content,script='')=>`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${content}${script}</body></html>`;
const browserOptions={skip:!browserToolchain,timeout:60000};

test('actual Chromium checks the administrative title alongside embedded native headings and retains every gate',browserOptions,async()=>{
 await fixtureBrowser(async browser=>{
  const adminPath='/c/local-synthetic-fixture/beheer/committees';
  const adminShell='<div class="cluvo-admin"><div class="page-title"><h1 style="font-family:Inter,sans-serif">Commissies</h1></div><div class="admin-native"><h1>Commissiewerkruimte</h1></div></div>';
  for(const item of [
   {body:adminShell,pass:true},
   {body:adminShell+'<input value="foreign-private-canary">',code:'STAGING_BROWSER_PRIVATE_DATA_LEAK',operation:'ssr_privacy'},
   {body:adminShell,cache:'public, max-age=60',code:'STAGING_ADMIN_BROWSER_PRIVATE_CACHE_FAILED',operation:'private_cache'},
   {body:adminShell+'<div style="width:900px">Overflow fixture</div>',code:'STAGING_ADMIN_BROWSER_OVERFLOW',operation:'overflow'},
   {body:adminShell.replace('Inter,sans-serif','serif'),code:'STAGING_ADMIN_BROWSER_STYLE_FAILED',operation:'overflow'},
   {body:'<div class="cluvo-admin"><div class="admin-native"><h1>Commissiewerkruimte</h1></div></div>',timeout:true,operation:'app_shell'},
  ]){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   try{
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin
     ?route.fulfill({status:200,headers:{'cache-control':item.cache??'private, no-store'},contentType:'text/html',body:documentHtml(item.body)})
     :route.abort());
    const page=await context.newPage();let position={phase:'admin_routes'};
    const result=await adminRouteReadback(page,adminPath,['foreign-private-canary'],value=>{position={phase:'admin_routes',...value};})
     .then(value=>value,error=>error);
    if(item.pass){
     assert.deepEqual(result,{section:'committees',status:200,native_authorized:true,private_cache:true,overflow:false});
     assert.equal(await page.locator('.cluvo-admin h1').count(),2);
    }else{
     if(item.timeout)assert.equal(result.name,'TimeoutError');else assert.equal(result.code,item.code);
     assert.equal(position.operation,item.operation);
     assert.equal(JSON.stringify(browserFailureDiagnostic(result,position)).includes('foreign-private-canary'),false);
    }
   }finally{await context.close();}
  }
 });
});

test('actual Chromium reads a delayed shell while an unrelated request keeps networkidle unavailable',browserOptions,async()=>{
 await fixtureBrowser(async browser=>{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  let release,markStarted;const started=new Promise(resolve=>{markStarted=resolve;});
  const pending=new Promise(resolve=>{release=resolve;});
  try{
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/background'){markStarted();await pending;return route.fulfill({status:204,body:''});}
    return route.fulfill({status:200,headers:{'cache-control':'private, no-store'},contentType:'text/html',
     body:documentHtml('<div id="fixture"></div>',`<script>fetch('/background');setTimeout(()=>document.getElementById('fixture').innerHTML=${JSON.stringify(shell)},80);</script>`)});
   });
   const page=await context.newPage();let position={phase:'positive_routes'};
   const result=await browserRouteReadback(page,path,['foreign-private-canary'],value=>{position={phase:'positive_routes',...value};});
   await started;
   assert.deepEqual(result,{screen:'agenda',status:200,native_authorized:true,private_cache:true,privacy_denials:true,overflow:false});
   assert.equal(position.operation,'overflow');
   const timeout=await page.waitForLoadState('networkidle',{timeout:750}).then(()=>null,error=>error);
   assert.equal(timeout?.name,'TimeoutError');
   const diagnostic=browserFailureDiagnostic(timeout,{phase:'positive_routes',screen:'agenda',operation:'navigation'});
   assert.deepEqual(diagnostic,{phase:'positive_routes',screen:'agenda',operation:'navigation',error_class:'TimeoutError'});
   assert.equal(Object.hasOwn(diagnostic,'message'),false);
  }finally{release();await context.close();}
 });
});

test('actual Chromium preserves route, SSR/DOM privacy, shell, cache and overflow failures',browserOptions,async()=>{
 await fixtureBrowser(async browser=>{
  const cases=[
   {status:403,body:shell,code:'STAGING_BROWSER_ROUTE_FAILED',operation:'route_status'},
   {body:shell+'<input value="foreign-private-canary">',code:'STAGING_BROWSER_PRIVATE_DATA_LEAK',operation:'ssr_privacy'},
   {body:shell.replace('aria-current="page"',''),code:'STAGING_BROWSER_ACTIVE_NAV_FAILED',operation:'active_navigation'},
   {body:shell.replace('<a href="more">more</a>',''),code:'STAGING_BROWSER_APP_SHELL_FAILED',operation:'app_shell'},
   {body:shell,script:'<script>document.body.append("foreign-private-"+"canary");</script>',code:'STAGING_BROWSER_PRIVATE_DATA_LEAK',operation:'dom_privacy'},
   {body:shell,cache:'public, max-age=60',code:'STAGING_BROWSER_PRIVATE_CACHE_FAILED',operation:'private_cache'},
   {body:shell+'<div style="width:900px">Overflow fixture</div>',code:'STAGING_BROWSER_OVERFLOW',operation:'overflow'},
   {redirect:true,body:shell,code:'STAGING_BROWSER_ROUTE_FAILED',operation:'route_status'},
  ];
  for(const item of cases){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   try{
    await context.route('**/*',route=>{
     if(new URL(route.request().url()).origin!==origin)return route.abort();
     if(item.redirect&&route.request().url()===origin+path)return route.fulfill({status:302,headers:{location:'/app/login'},body:''});
     return route.fulfill({status:item.status??200,headers:{'cache-control':item.cache??'private, no-store'},
      contentType:'text/html',body:documentHtml(item.body,item.script)});
    });
    const page=await context.newPage();let position={phase:'positive_routes'};
    const error=await browserRouteReadback(page,path,['foreign-private-canary'],value=>{position={phase:'positive_routes',...value};})
     .then(()=>null,error=>error);
    assert.equal(error?.code,item.code);const diagnostic=browserFailureDiagnostic(error,position);
    assert.equal(diagnostic.phase,'positive_routes');assert.equal(diagnostic.screen,'agenda');
    assert.equal(diagnostic.operation,item.operation);assert.equal(diagnostic.error_class,'BrowserQaError');
    assert.equal(diagnostic.response_status,item.status??200);
    assert.equal(JSON.stringify(diagnostic).includes('foreign-private-canary'),false);
    assert.equal(JSON.stringify(diagnostic).includes('local-synthetic-fixture'),false);
   }finally{await context.close();}
  }
 });
});

test('actual Chromium accepts only explicit denied contexts and keeps foreign query identifiers out of diagnostics',browserOptions,async()=>{
 await fixtureBrowser(async browser=>{
  for(const item of [{status:200,body:'Je werkruimte kon niet worden geladen',denied:true},
   {status:404,body:'Pagina niet gevonden',denied:true},{status:200,body:'Een geldige app',denied:false},
   {status:404,body:'foreign-private-canary',privacyLeak:true}]){
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
   try{
    await context.route('**/*',route=>new URL(route.request().url()).origin===origin
     ?route.fulfill({status:item.status,contentType:'text/html',body:documentHtml(item.body)}):route.abort());
    const page=await context.newPage();let position={phase:'foreign_household'};
    const result=await browserRejectedContext(page,'/app/c/local-synthetic-fixture/home?household=private-household-marker',
     ['foreign-private-canary'],value=>{position={phase:'foreign_household',...value};}).then(value=>value,error=>error);
    if(item.denied)assert.deepEqual(result,{denied:true,private_data_hidden:true});
    else{
     assert.equal(result.code,item.privacyLeak?'STAGING_BROWSER_PRIVATE_DATA_LEAK':'STAGING_BROWSER_DENIAL_FAILED');
     const diagnostic=browserFailureDiagnostic(result,position);
     assert.equal(diagnostic.phase,'foreign_household');assert.equal(diagnostic.screen,'home');
     assert.equal(diagnostic.operation,item.privacyLeak?'ssr_privacy':'route_status');
     assert.equal(JSON.stringify(diagnostic).includes('private-household-marker'),false);
    }
   }finally{await context.close();}
  }
 });
});

test('privacy assertions fail on foreign canaries anywhere in SSR or DOM without exporting the body',()=>{
 assert.doesNotThrow(()=>assertPrivateBrowserBody('own profile text',['foreign-private-answer','minor-private-contact']));
 for(const body of ['<input value="foreign-private-answer">','<script>minor-private-contact</script>']){
  try{assertPrivateBrowserBody(body,['foreign-private-answer','minor-private-contact']);assert.fail('Leak accepted');}
  catch(error){assert.equal(error.code,'STAGING_BROWSER_PRIVATE_DATA_LEAK');assert.equal(error.message.includes(body),false);}
 }
 assert.throws(()=>assertPrivateBrowserBody('x'.repeat(4_000_001),[]),/STAGING_BROWSER_BODY_INVALID/);
});

test('the actual browser process environment omits inherited administrator, provider and database credentials',async()=>{
 const environment={PATH:'/usr/bin:/bin',HOME:'/synthetic-home',LANG:'C.UTF-8',TMPDIR:'/synthetic-temp',
  SUPABASE_SECRET_KEY:'synthetic-admin',MIGRATION_DATABASE_URL:'synthetic-database',GITHUB_TOKEN:'synthetic-gh',SENDGRID_API_KEY:'synthetic-provider'};
 const browserEnvironment=browserProcessEnvironment(environment);
 assert.deepEqual(browserEnvironment,{PATH:'/usr/bin:/bin',HOME:'/synthetic-home',LANG:'C.UTF-8',TMPDIR:'/synthetic-temp'});
 for(const value of ['synthetic-admin','synthetic-database','synthetic-gh','synthetic-provider'])assert.equal(JSON.stringify(browserEnvironment).includes(value),false);
 const source=await readFile(new URL('../scripts/staging-pwa-browser-readback.mjs',import.meta.url),'utf8');
 assert.match(source,/chromium\.launch\(\{headless:true,env:browserProcessEnvironment\(environment\)\}\)/);
});

test('active-image browser routes cover every actual mobile route and keep credentials after the public gate',async()=>{
 const source=await readFile(new URL('../components/mobile/types.ts',import.meta.url),'utf8');
 const routes=[...source.match(/MOBILE_SCREENS = \[([^\]]+)\]/)[1].matchAll(/'([a-z]+)'/g)].map(match=>match[1]);
 assert.deepEqual([...BROWSER_SCREENS],routes);assert.equal(routes.length,20);
 const workflow=await readFile(new URL('../.github/workflows/staging-pwa-browser-readback.yml',import.meta.url),'utf8');
 assert.ok(workflow.indexOf('activeStagingRelease(sha)')<workflow.indexOf('SUPABASE_SECRET_KEY:'));
 assert.match(workflow,/playwright@1\.63\.0/);assert.doesNotMatch(workflow,/self-hosted|storageState|trace\.zip|HAR/);
});
