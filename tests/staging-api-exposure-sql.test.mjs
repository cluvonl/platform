import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {stagingApiExposureSQL} from '../scripts/staging-api-exposure.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from '../scripts/staging-initial-migrations.mjs';

// Explicit local gate, fixed known container, and one outer ROLLBACK per
// process. No hosted URLs, Auth identities, credentials or persistent DDL.
const local=process.env.CLUVO_API_SQL_TESTS==='local-fixture';
const context={sourceSha:'a'.repeat(40),workflowRunId:'42',actor:'api-sql-test',expectedVersion:0};
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const lock=`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});`;
const unlock=`SELECT pg_advisory_unlock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});`;
function body(value=context){
  const rendered=stagingApiExposureSQL(value);
  assert.ok(rendered.startsWith('BEGIN READ WRITE;\n')&&rendered.endsWith('\nCOMMIT;'));
  // Strip exactly the fixed operational envelope to exercise all real SQL in
  // this test's existing transaction. NOTIFY remains undelivered on ROLLBACK.
  return rendered.slice('BEGIN READ WRITE;\n'.length,-'\nCOMMIT;'.length);
}
const sourceRows=IMMUTABLE16.map((entry,index)=>'('+[
  entry.file.slice(0,14),entry.file,entry.sha256,context.sourceSha,context.actor,'staging',
].map(quote).join(',')+','+index+','+quote('cluvo-staging-initial16:42:'+entry.file.slice(0,14))+',\'42\')').join(',');
const clonedHistory=IMMUTABLE16.map(entry=>`UPDATE supabase_migrations.schema_migrations
  SET name=${quote(entry.file.slice(15,-4))},statements=ARRAY[${quote(readFileSync(new URL('../supabase/migrations/'+entry.file,import.meta.url),'utf8'))}]::text[]
  WHERE version=${quote(entry.file.slice(0,14))};`).join('\n');
const setup=`DO $local_test_target$ BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR current_setting('server_version_num')<>'170011'
    OR (SELECT count(*) FROM supabase_migrations.schema_migrations)<>16
    OR to_regclass('supabase_migrations.cluvo_migration_source') IS NOT NULL
    OR to_regclass('supabase_migrations.cluvo_staging_operation') IS NOT NULL
  THEN RAISE EXCEPTION 'LOCAL_API_SQL_TARGET_UNEXPECTED'; END IF;
END $local_test_target$;
CREATE TABLE supabase_migrations.cluvo_migration_source(
  version text PRIMARY KEY,file text NOT NULL,sha256 text NOT NULL,source_sha text NOT NULL,
  actor text NOT NULL,scope text NOT NULL,expected_version integer NOT NULL,
  idempotency_key text NOT NULL,workflow_run_id text NOT NULL);
INSERT INTO supabase_migrations.cluvo_migration_source VALUES ${sourceRows};`;
function execute(sql){
  assert.ok(sql.startsWith('BEGIN;')&&sql.includes('ROLLBACK;'));
  const transaction='BEGIN;SET LOCAL ROLE postgres;SET LOCAL standard_conforming_strings=on;'+sql.slice('BEGIN;'.length).replace(setup,()=>setup+clonedHistory);
  return spawnSync('docker',['exec','-i','supabase_db_cluvo-local','psql','-U','supabase_admin','-d','postgres',
    '--no-psqlrc','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1'],{
    input:transaction,encoding:'utf8',timeout:15000});
}
function success(result){
  assert.equal(result.status,0,'actual local API SQL failed; provider diagnostics withheld');
  return result.stdout.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
}
function refusal(result,code){
  assert.notEqual(result.status,0);
  assert.match(result.stderr,new RegExp(code));
}

test('actual local API SQL exposes only api in the postgres-specific override and audits expected version zero', {skip:!local},()=>{
  const result=success(execute(`BEGIN;${lock}${setup}
    ALTER ROLE authenticator SET pgrst.db_schemas='public';
    ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_max_rows='900';
    ${body()}
    SELECT jsonb_build_object(
      'database_override_api_only',EXISTS(SELECT 1 FROM pg_db_role_setting s WHERE s.setrole='authenticator'::regrole AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres') AND 'pgrst.db_schemas=api'=ANY(s.setconfig)),
      'global_setting_preserved',EXISTS(SELECT 1 FROM pg_db_role_setting s WHERE s.setrole='authenticator'::regrole AND s.setdatabase=0 AND 'pgrst.db_schemas=public'=ANY(s.setconfig)),
      'unrelated_setting_preserved',EXISTS(SELECT 1 FROM pg_db_role_setting s WHERE s.setrole='authenticator'::regrole AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres') AND 'pgrst.db_max_rows=900'=ANY(s.setconfig)),
      'operations',(SELECT count(*) FROM supabase_migrations.cluvo_staging_operation),
      'audit_valid',(SELECT scope='staging' AND expected_version=0 AND version=1 AND source_sha=${quote(context.sourceSha)} AND actor=${quote(context.actor)} AND workflow_run_id='42' AND idempotency_key='cluvo-staging-api:42' FROM supabase_migrations.cluvo_staging_operation WHERE operation='expose_api'),
      'api_roles_cannot_read_audit',NOT has_table_privilege('anon','supabase_migrations.cluvo_staging_operation','SELECT') AND NOT has_table_privilege('authenticated','supabase_migrations.cluvo_staging_operation','SELECT') AND NOT has_table_privilege('service_role','supabase_migrations.cluvo_staging_operation','SELECT'));
    ROLLBACK;${unlock}`));
  assert.deepEqual(result,[{database_override_api_only:true,global_setting_preserved:true,unrelated_setting_preserved:true,operations:1,audit_valid:true,api_roles_cannot_read_audit:true}]);
});

test('actual local API SQL repeat preserves original actor/run/source without duplicate operations', {skip:!local},()=>{
  const later={...context,sourceSha:'b'.repeat(40),workflowRunId:'43',actor:'later-api-test'};
  const result=success(execute(`BEGIN;${lock}${setup}${body()}${body(later)}
    SELECT jsonb_build_object('operations',(SELECT count(*) FROM supabase_migrations.cluvo_staging_operation),
      'original_provenance_preserved',(SELECT source_sha=${quote(context.sourceSha)} AND workflow_run_id='42' AND actor=${quote(context.actor)} AND idempotency_key='cluvo-staging-api:42' FROM supabase_migrations.cluvo_staging_operation WHERE operation='expose_api'));
    ROLLBACK;${unlock}`));
  assert.deepEqual(result,[{operations:1,original_provenance_preserved:true}]);
});

test('actual local API SQL refuses missing lock and an authenticated role as provisioning actor', {skip:!local},()=>{
  refusal(execute(`BEGIN;${setup}${body()}ROLLBACK;`),'STAGING_API_SESSION_INVALID');
  refusal(execute(`BEGIN;${lock}${setup}SET LOCAL ROLE authenticated;${body()}ROLLBACK;${unlock}`),'STAGING_API_SESSION_INVALID');
});

test('actual local API SQL refuses incomplete migration audit, history and unguarded native schema drift', {skip:!local},()=>{
  const attacks={
    history:"DELETE FROM supabase_migrations.schema_migrations WHERE version='20261007013000';",
    source:"DELETE FROM supabase_migrations.cluvo_migration_source WHERE version='20261007013000';",
    'original-bytes':"UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['SELECT 1;'] WHERE version='20261007013000';",
    'source-hash':"UPDATE supabase_migrations.cluvo_migration_source SET sha256=repeat('0',64) WHERE version='20261007013000';",
    'source-scope':"UPDATE supabase_migrations.cluvo_migration_source SET scope='production' WHERE version='20261007013000';",
    'source-version':"UPDATE supabase_migrations.cluvo_migration_source SET expected_version=99 WHERE version='20261007013000';",
    force:'ALTER TABLE app.persons NO FORCE ROW LEVEL SECURITY;',
    'extra-table':'CREATE TABLE app.synthetic_api_guard_attack(id integer);',
    'missing-native':'DROP POLICY native_session_required ON app.persons;',
    'bypassed-native':'ALTER POLICY native_session_required ON app.persons USING (true) WITH CHECK (true);',
    'api-definer':'CREATE FUNCTION api.synthetic_api_guard_attack() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;',
    'owner-superuser':'RESET ROLE;ALTER ROLE cluvo_command_owner SUPERUSER;SET LOCAL ROLE postgres;',
    'owner-bypass':'RESET ROLE;ALTER ROLE cluvo_command_owner BYPASSRLS;SET LOCAL ROLE postgres;',
    'owner-login':'RESET ROLE;ALTER ROLE cluvo_command_owner LOGIN;SET LOCAL ROLE postgres;',
    'native-function-owner':'RESET ROLE;ALTER FUNCTION internal.actor_has_active_session() OWNER TO postgres;SET LOCAL ROLE postgres;',
    'native-function-invoker':'ALTER FUNCTION internal.actor_has_active_session() SECURITY INVOKER;',
  };
  for(const change of Object.values(attacks)) refusal(execute(`BEGIN;${lock}${setup}${change}${body()}ROLLBACK;${unlock}`),'STAGING_API_DATABASE_NOT_READY');
});

test('actual local API SQL readback confirms every temporary audit/schema/owner mutation was rolled back', {skip:!local},()=>{
  const result=success(execute(`BEGIN;
    SELECT jsonb_build_object('source_audit_absent',to_regclass('supabase_migrations.cluvo_migration_source') IS NULL,
      'operation_audit_absent',to_regclass('supabase_migrations.cluvo_staging_operation') IS NULL,
      'app_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'),
      'command_owner_restricted',(SELECT NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin FROM pg_roles WHERE rolname='cluvo_command_owner'),
      'native_function_owner_preserved',(SELECT prosecdef AND proowner='cluvo_command_owner'::regrole::oid FROM pg_proc WHERE oid=to_regprocedure('internal.actor_has_active_session()')));
    ROLLBACK;`));
  assert.deepEqual(result,[{source_audit_absent:true,operation_audit_absent:true,app_tables:144,command_owner_restricted:true,native_function_owner_preserved:true}]);
});

test('actual local API SQL refuses configuration drift instead of repairing or legitimizing expanded schemas on repeat', {skip:!local},()=>{
  for(const change of [
    "ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas='api,app,internal';",
    'ALTER ROLE authenticator IN DATABASE postgres RESET pgrst.db_schemas;',
  ]) refusal(execute(`BEGIN;${lock}${setup}${body()}${change}${body()}ROLLBACK;${unlock}`),'STAGING_API_CONFIG_DRIFT');
});

test('actual local API SQL refuses unknown version, actor, source and idempotency provenance on repeat', {skip:!local},()=>{
  for(const change of ["version=2","expected_version=1","actor='unknown/actor'","source_sha='unknown'","idempotency_key='unknown'"]){
    refusal(execute(`BEGIN;${lock}${setup}${body()}UPDATE supabase_migrations.cluvo_staging_operation SET ${change} WHERE operation='expose_api';${body()}ROLLBACK;${unlock}`),'STAGING_API_OPERATION_CONFLICT');
  }
});
