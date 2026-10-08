import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingInitialMigration} from '../scripts/staging-initial-migrate.mjs';

const context={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',
 GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:'a'.repeat(40),RELEASE_SHA:'a'.repeat(40),
 STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',
 MIGRATION_DATABASE_URL:'synthetic-private-fixture-never-connected',GITHUB_RUN_ID:'42',GITHUB_ACTOR:'cluvo-test',INITIAL_APPLY_MIGRATIONS:'false'};

test('production/main/foreign repository and nonexplicit execution fail before any source connection',async()=>{
 for(const patch of [{APP_ENV:'production'},{GITHUB_REF:'refs/heads/main'},{GITHUB_REPOSITORY:'foreign/platform'},
  {GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'b'.repeat(40)},{INITIAL_APPLY_MIGRATIONS:'yes'},{GITHUB_RUN_ID:'0'}]){
  const result=await stagingInitialMigration({...context,...patch});
  assert.equal(result.passed,false);assert.equal(result.database_mutations_performed,false);assert.equal(result.returned_session_closed,false);
  assert.equal(result.applied_migrations,0);assert.equal(result.app_activation_performed,false);assert.equal(result.production_enabled,false);
  assert.equal(Object.hasOwn(result,'backup_custody'),false);assert.equal(Object.hasOwn(result,'restore'),false);
  assert.ok(!JSON.stringify(result).includes(context.MIGRATION_DATABASE_URL));
 }
});
test('root-key absence refuses before Docker/connection and reports no preservation or restore claim',async()=>{
 const result=await stagingInitialMigration(context);
 assert.equal(result.error,'INITIAL_BACKUP_ROOT_REQUIRED');assert.equal(result.database_mutations_performed,false);
 assert.equal(result.authenticated_native_login_verified,false);assert.equal(result.full_provider_restore_verified,false);
 assert.equal(result.o08_restore_accepted,false);assert.equal(result.v1_ready,false);
});
