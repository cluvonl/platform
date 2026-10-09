import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingNativeQa} from '../scripts/staging-pwa-native-qa.mjs';

test('wrong environment or workflow returns a private-safe failure before Auth or fixture mutation',async()=>{
 const sha='a'.repeat(40),base={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_SHA:sha,RELEASE_SHA:sha,GITHUB_RUN_ID:'424242',GITHUB_ACTOR:'cluvo-test',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',
  SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',MIGRATION_DATABASE_URL:'private-fixture-never-connected'};
 for(const change of [{APP_ENV:'production'},{GITHUB_REF:'refs/heads/main'},{GITHUB_REPOSITORY:'foreign/repository'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'b'.repeat(40)},{STAGING_SUPABASE_PROJECT_REF:'anotherproject'}]){
  const report=await stagingNativeQa({...base,...change});
  assert.equal(report.passed,false);assert.equal(report.app_fixture_mutations_performed,false);assert.equal(report.private_values_exported,false);
  assert.equal(report.email_sent,false);assert.equal(report.personal_account_changed,false);assert.equal(report.v1_ready,false);assert.equal(report.production_enabled,false);
  assert.equal(report.returned_session_closed,false);assert.equal(Object.hasOwn(report,'provider'),false);assert.equal(Object.hasOwn(report,'fixture'),false);
  assert.match(report.error,/^[A-Z][A-Z0-9_]+$/);assert.equal(JSON.stringify(report).includes('private-fixture'),false);
 }
});
