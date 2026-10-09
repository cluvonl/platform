import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertPrivateBrowserBody,BROWSER_SCREENS,browserProcessEnvironment,browserReadbackContext,stagingBrowserReadback} from '../scripts/staging-pwa-browser-readback.mjs';

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
 }
 assert.deepEqual(browserReadbackContext(base),{source_sha:sha,workflow_run_id:'424242'});
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
