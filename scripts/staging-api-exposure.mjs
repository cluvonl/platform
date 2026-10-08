// Fixed staging Data API configuration, separate from immutable domain migrations.
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';
import {IMMUTABLE16} from './staging-migration-files.mjs';
const literal=value=>"'"+value.replaceAll("'","''")+"'";
export class ApiExposureError extends Error{constructor(code){super(code);this.code=code;}}
const need=(value,code)=>{if(!value)throw new ApiExposureError(code);};

export function stagingApiExposureSQL({sourceSha,workflowRunId,actor,expectedVersion}){
 need(/^[0-9a-f]{40}$/.test(sourceSha??'')&&/^[1-9][0-9]{0,19}$/.test(workflowRunId??'')
  &&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(actor??'')&&expectedVersion===0,'STAGING_API_CONTEXT_INVALID');
 const versions=IMMUTABLE16.map(file=>literal(file.file.slice(0,14))).join(',');
 const sources=IMMUTABLE16.map((file,index)=>`(${literal(file.file.slice(0,14))},${literal(file.file)},${literal(file.sha256)},${literal(file.file.slice(15,-4))},${index})`).join(',');
 return `BEGIN READ WRITE;
SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s';
SET LOCAL standard_conforming_strings=on; SET LOCAL search_path=pg_catalog; SET LOCAL row_security=off;
DO $cluvo_api_guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
 OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted AND mode='ExclusiveLock'
 AND classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid AND objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid AND objsubid=2)
 THEN RAISE EXCEPTION 'STAGING_API_SESSION_INVALID'; END IF;
 IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY[${versions}]::text[]
 OR (SELECT count(*) FROM supabase_migrations.cluvo_migration_source)<>16
 OR EXISTS(SELECT 1 FROM (VALUES ${sources}) expected(version,file,sha256,name,position)
 LEFT JOIN supabase_migrations.schema_migrations h USING(version)
 LEFT JOIN supabase_migrations.cluvo_migration_source s USING(version)
 WHERE h.name IS DISTINCT FROM expected.name OR cardinality(h.statements) IS DISTINCT FROM 1
 OR encode(sha256(convert_to(h.statements[1],'UTF8')),'hex') IS DISTINCT FROM expected.sha256
 OR s.file IS DISTINCT FROM expected.file OR s.sha256 IS DISTINCT FROM expected.sha256
 OR s.scope IS DISTINCT FROM 'staging' OR s.expected_version IS DISTINCT FROM expected.position
 OR s.source_sha !~ '^[0-9a-f]{40}$' OR s.actor !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
 OR s.workflow_run_id !~ '^[1-9][0-9]{0,19}$'
 OR s.idempotency_key IS DISTINCT FROM ('cluvo-staging-initial16:'||s.workflow_run_id||':'||expected.version))
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r')<>144
 OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>144
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='app' AND c.relkind='r' AND NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
 AND p.polname='native_session_required' AND NOT p.polpermissive AND p.polcmd='*'
 AND 'authenticated'::regrole::oid=ANY(p.polroles)
 AND pg_get_expr(p.polqual,p.polrelid)='( SELECT internal.actor_has_active_session() AS actor_has_active_session)'
 AND pg_get_expr(p.polwithcheck,p.polrelid)='( SELECT internal.actor_has_active_session() AS actor_has_active_session)'))
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cluvo_command_owner' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
 OR NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('internal.actor_has_active_session()')
 AND p.prosecdef AND p.proowner='cluvo_command_owner'::regrole::oid)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api' AND p.prosecdef)
 THEN RAISE EXCEPTION 'STAGING_API_DATABASE_NOT_READY'; END IF;
END $cluvo_api_guard$;
CREATE TABLE IF NOT EXISTS supabase_migrations.cluvo_staging_operation(
 operation text PRIMARY KEY,scope text NOT NULL CHECK(scope='staging'),expected_version integer NOT NULL,
 version integer NOT NULL,source_sha text NOT NULL,workflow_run_id text NOT NULL,actor text NOT NULL,
 idempotency_key text NOT NULL UNIQUE,applied_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON supabase_migrations.cluvo_staging_operation FROM PUBLIC,anon,authenticated,service_role;
DO $cluvo_api_version$ BEGIN
 IF EXISTS(SELECT 1 FROM supabase_migrations.cluvo_staging_operation WHERE operation='expose_api'
 AND (scope<>'staging' OR expected_version<>0 OR version<>1 OR source_sha!~'^[0-9a-f]{40}$'
 OR workflow_run_id!~'^[1-9][0-9]{0,19}$' OR actor!~'^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
 OR idempotency_key<>'cluvo-staging-api:'||workflow_run_id)) THEN RAISE EXCEPTION 'STAGING_API_OPERATION_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.cluvo_staging_operation WHERE operation='expose_api')
 AND NOT EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole
 WHERE r.rolname='authenticator' AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres')
 AND 'pgrst.db_schemas=api'=ANY(s.setconfig)) THEN RAISE EXCEPTION 'STAGING_API_CONFIG_DRIFT'; END IF;
END $cluvo_api_version$;
ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas='api';
INSERT INTO supabase_migrations.cluvo_staging_operation(operation,scope,expected_version,version,source_sha,workflow_run_id,actor,idempotency_key)
VALUES('expose_api','staging',0,1,${literal(sourceSha)},${literal(workflowRunId)},${literal(actor)},${literal('cluvo-staging-api:'+workflowRunId)})
ON CONFLICT(operation) DO NOTHING;
NOTIFY pgrst,'reload config';
NOTIFY pgrst,'reload schema';
COMMIT;`;
}
