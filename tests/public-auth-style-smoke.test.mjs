import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {publicAuthStyleSmoke,publicAuthCssRules,PUBLIC_AUTH_ROUTES,selectWp0Runtime} from '../scripts/public-auth-style-smoke.mjs';

const origin='http://127.0.0.1:3210',asset='/_next/static/css/fixture.css';
const rules='body{margin:0;background:var(--background);font-family:Inter,Arial,sans-serif}.auth-screen{min-height:100vh;display:grid;background:#f5f6f7}.auth-card{background:#fff;border-radius:18px;padding:38px}.auth-primary{background:#f45f49;color:#fff;border-radius:10px;padding:14px 18px}';
const html=`<!doctype html><html><head><link rel="stylesheet" href="${asset}"></head><body><main class="auth-screen"><div class="auth-card page-enter"><h1>Cluvo</h1><button class="auth-primary" type="submit">Inloggen</button></div></main></body></html>`;
function fixture({body=html,css=rules,cssStatus=200,cssType='text/css; charset=utf-8',htmlStatus=200}={}){
 const calls=[];return {calls,fetcher:async(url,options)=>{calls.push({url,options});return new URL(url).pathname===asset
  ?new Response(css,{status:cssStatus,headers:{'content-type':cssType}})
  :new Response(body,{status:htmlStatus,headers:{'content-type':'text/html; charset=utf-8'}});}};
}

test('all three credentialless SSR routes require linked body and auth styles and reuse only their verified CSS',async()=>{
 assert.deepEqual([...PUBLIC_AUTH_ROUTES],['/login','/app/login','/app/auth/verify']);
 const f=fixture(),report=await publicAuthStyleSmoke(origin,{fetcher:f.fetcher});assert.equal(report.passed,true);
 assert.deepEqual(report.routes.map(row=>row.path),[...PUBLIC_AUTH_ROUTES]);assert.equal(report.routes.every(row=>row.passed&&row.auth_shell&&row.primary_control),true);
 assert.equal(report.stylesheets.length,1);assert.equal(report.stylesheets[0].bytes,Buffer.byteLength(rules));
 assert.match(report.stylesheets[0].sha256,/^[0-9a-f]{64}$/);assert.equal(report.routes.every(row=>Object.values(row.style_rules).every(Boolean)),true);
 assert.equal(f.calls.length,4);
 for(const {url,options}of f.calls){assert.equal(new URL(url).origin,origin);assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'manual');assert.deepEqual(Object.keys(options.headers),['Accept','Connection']);assert.equal(Object.hasOwn(options,'body'),false);}
 assert.equal(report.provider_requests_performed,false);assert.equal(report.authenticated,false);assert.equal(report.private_values_exported,false);
});

test('missing CSS, missing SSR shell or primary button, and CSS without the global declarations fail every affected route',async()=>{
 for(const [change,code]of [[{body:html.replace(/<link[^>]+>/,'')},'PUBLIC_AUTH_LINKED_CSS_MISSING'],
  [{body:html.replace('class="auth-screen"','class="other"')},'PUBLIC_AUTH_HTML_SHELL_MISSING'],
  [{body:html.replace('class="auth-card page-enter"','class="other"')},'PUBLIC_AUTH_HTML_SHELL_MISSING'],
  [{body:html.replace('class="auth-primary"','class="other"')},'PUBLIC_AUTH_HTML_SHELL_MISSING'],
  [{css:'.cluvo-pwa-install{display:grid}'},'PUBLIC_AUTH_STYLE_RULES_MISSING'],
  [{css:rules.replace('font-family:Inter','font-family:Times')},'PUBLIC_AUTH_STYLE_RULES_MISSING'],
  [{css:rules.replace('.auth-card{','.auth-card h1{')},'PUBLIC_AUTH_STYLE_RULES_MISSING']]){
  const f=fixture(change),report=await publicAuthStyleSmoke(origin,{fetcher:f.fetcher});assert.equal(report.passed,false);
  assert.equal(report.routes.length,3);assert.equal(report.routes.every(row=>row.error===code),true);
 }
 assert.deepEqual(publicAuthCssRules('/* '+rules+' */'),{body:false,auth_screen:false,auth_card:false,auth_primary:false});
});

test('404 CSS, redirects, non-CSS content and missing HTML status fail without exporting response bytes or errors',async()=>{
 const sensitive='synthetic-private-value';
 for(const [change,code]of [[{cssStatus:404,css:sensitive},'PUBLIC_AUTH_CSS_HTTP_FAILED'],
  [{cssStatus:302,css:sensitive},'PUBLIC_AUTH_CSS_HTTP_FAILED'],[{cssType:'text/html',css:sensitive},'PUBLIC_AUTH_CSS_TYPE_FAILED'],
  [{htmlStatus:500,body:sensitive},'PUBLIC_AUTH_HTML_HTTP_FAILED']]){
  const f=fixture(change),report=await publicAuthStyleSmoke(origin,{fetcher:f.fetcher});assert.equal(report.passed,false);
  assert.equal(report.routes[0].error,code);assert.equal(JSON.stringify(report).includes(sensitive),false);
 }
 const report=await publicAuthStyleSmoke(origin,{fetcher:async()=>{throw new Error(sensitive);}});
 assert.equal(report.routes.every(row=>row.error==='PUBLIC_AUTH_READ_UNAVAILABLE'),true);assert.equal(JSON.stringify(report).includes(sensitive),false);
});

test('foreign, credentialed, query-bearing and production targets never receive a request',async()=>{
 for(const target of ['https://cluvo.nl','https://other.example','http://user:secret@127.0.0.1:3210',origin+'/path',origin+'?private=value']){
  let calls=0;const report=await publicAuthStyleSmoke(target,{fetcher:async()=>{calls++;throw Error('must not fetch');}});
  assert.equal(report.passed,false);assert.equal(report.error,'PUBLIC_AUTH_CONTEXT_REFUSED');assert.equal(calls,0);
 }
 for(const href of ['https://private.example/auth.css','/_next/static/css/fixture.css?private=value']){
  const f=fixture({body:html.replace(asset,href)}),report=await publicAuthStyleSmoke(origin,{fetcher:f.fetcher});
  assert.equal(report.routes.every(row=>row.error==='PUBLIC_AUTH_CSS_TARGET_REFUSED'),true);assert.equal(f.calls.length,3);
  assert.equal(JSON.stringify(report).includes('private.example'),false);assert.equal(JSON.stringify(report).includes('private=value'),false);
 }
});

test('WP0 selects the complete project production runtime before an uncopied nested standalone and the shipped server in an image',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cluvo-wp0-runtime-'));
 const file=async path=>{await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),'fixture');};
 try{
  await assert.rejects(selectWp0Runtime(root),/WP0_COMPLETE_BUILD_REQUIRED/);
  for(const path of ['.next/BUILD_ID','node_modules/next/dist/bin/next','.next/standalone/server.js','.next/standalone/.next/BUILD_ID'])await file(path);
  await assert.rejects(selectWp0Runtime(root),/WP0_COMPLETE_BUILD_REQUIRED/);
  await mkdir(join(root,'.next/static'),{recursive:true});const project=await selectWp0Runtime(root);
  assert.equal(project.nextStart,true);assert.equal(project.server,join(root,'node_modules/next/dist/bin/next'));
  await file('server.js');const shipped=await selectWp0Runtime(root);assert.equal(shipped.server,join(root,'server.js'));assert.equal(shipped.nextStart,undefined);
  await rm(join(root,'server.js'));await rm(join(root,'node_modules'),{recursive:true});await mkdir(join(root,'.next/standalone/.next/static'),{recursive:true});
  assert.equal((await selectWp0Runtime(root)).server,join(root,'.next/standalone/server.js'));
 }finally{await rm(root,{recursive:true,force:true});}
 const wp0=await readFile(new URL('../scripts/wp0-smoke.mjs',import.meta.url),'utf8');
 assert.match(wp0,/publicAuthStyleSmoke\(baseUrl/);assert.match(wp0,/SUPABASE_PUBLISHABLE_KEY: ''/);assert.match(wp0,/SUPABASE_SECRET_KEY: ''/);
 assert.match(wp0,/await expectJson\('\/api\/runtime-config', 503/);
});
