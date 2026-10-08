// Pure fixed SQL components. The write owner owns TLS/project verification,
// immutable migration provenance, the session lock and BEGIN/COMMIT/ROLLBACK.
// Parameters contain private data and must never become logs or artifacts.
import {createHash} from 'node:crypto';
import {IMMUTABLE16} from './staging-migration-files.mjs';

export class StagingCoreBootstrapError extends Error {
  constructor(){super('STAGING_CORE_INPUT_INVALID');this.code='STAGING_CORE_INPUT_INVALID';}
}
const need=condition=>{if(!condition)throw new StagingCoreBootstrapError();};
const PROJECT='fbozlbgmktkgcdfqdaaz';
const FORMAT='cluvo-staging-core-bootstrap-v1';
const NAMESPACE=1129076054;
const LOCK_OBJECT=createHash('sha256').update(PROJECT).digest().readInt32BE(0);
const literal=value=>"'"+value.replaceAll("'","''")+"'";
export const STAGING_CORE_FIXTURE=Object.freeze({
  tenant:'c1000000-0000-4000-8000-000000000001',
  person:'c1000000-0000-4000-8000-000000000002',
  accountLink:'c1000000-0000-4000-8000-000000000003',
  membership:'c1000000-0000-4000-8000-000000000004',
  memberGrant:'c1000000-0000-4000-8000-000000000005',
  household:'c1000000-0000-4000-8000-000000000006',
  personLink:'c1000000-0000-4000-8000-000000000007',
  householdGrant:'c1000000-0000-4000-8000-000000000008',
  intake:'c1000000-0000-4000-8000-000000000009',
  season:'c1000000-0000-4000-8000-00000000000a',
  obligation:'c1000000-0000-4000-8000-00000000000b',
  obligationLink:'c1000000-0000-4000-8000-00000000000c',
  audit:'c1000000-0000-4000-8000-00000000000d',
  idempotencyKey:'c1000000-0000-4000-8000-00000000000e',
  idempotencyRecord:'c1000000-0000-4000-8000-00000000000f',
  slug:'cluvo-staging',lockNamespace:NAMESPACE,lockObject:LOCK_OBJECT,
});
const f=STAGING_CORE_FIXTURE;
const versions='ARRAY['+IMMUTABLE16.map(({file})=>literal(file.slice(0,14))).join(',')+']::text[]';

const CONTEXT_SQL=`SELECT pg_catalog.set_config('cluvo.core_bootstrap_context',
  pg_catalog.jsonb_build_object('format','${FORMAT}','scope','staging','project_ref','${PROJECT}',
    'recipient',lower($1::text),'source_sha',$2::text,'workflow_run_id',$3::text,
    'actor',$4::text,'expected_version',0,'fixture_version',1)::text,true) IS NOT NULL AS configured;`;

const MUTATION_SQL=`DO $cluvo_core_bootstrap$
DECLARE
  v_context jsonb;
  v_uid uuid;
  v_role uuid;
  v_count integer;
  v_created boolean := false;
  v_signature bytea;
  v_prior app.idempotency_records%rowtype;
  v_audit app.audit_events%rowtype;
  v_result jsonb := '{"scope":"STAGING_SYNTHETIC_CORE_V1","fixture_version":1,"initial_ledger_entries":0,"auth_mutations":false,"native_session_claimed":false,"v1_ready":false,"production_enabled":false}'::jsonb;
BEGIN
  v_context := nullif(current_setting('cluvo.core_bootstrap_context',true),'')::jsonb;
  IF jsonb_typeof(v_context) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(v_context)) <> 9
    OR v_context->>'format' IS DISTINCT FROM '${FORMAT}'
    OR v_context->>'scope' IS DISTINCT FROM 'staging'
    OR v_context->>'project_ref' IS DISTINCT FROM '${PROJECT}'
    OR v_context->'expected_version' IS DISTINCT FROM '0'::jsonb
    OR v_context->'fixture_version' IS DISTINCT FROM '1'::jsonb
    OR coalesce(v_context->>'recipient','') !~ '^[A-Za-z0-9.!#$%&+/?^_{|}~-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,63}$'
    OR length(v_context->>'recipient') > 254
    OR coalesce(v_context->>'source_sha','') !~ '^[0-9a-f]{40}$'
    OR coalesce(v_context->>'workflow_run_id','') !~ '^[1-9][0-9]{0,19}$'
    OR coalesce(v_context->>'actor','') !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
  THEN RAISE EXCEPTION 'STAGING_CORE_BOOTSTRAP_REFUSED'; END IF;
  IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
    OR current_setting('transaction_read_only')<>'off'
    OR NOT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND mode='ExclusiveLock'
      AND pid=pg_backend_pid() AND granted AND classid=${NAMESPACE}::oid
      AND objid=${LOCK_OBJECT>>>0}::oid AND objsubid=2)
    OR (SELECT coalesce(array_agg(version ORDER BY version),'{}'::text[])
      FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ${versions}
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='app' AND c.relkind='r')<>144
    OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='app' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity
        OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
          AND p.polname='native_session_required' AND NOT p.polpermissive AND p.polcmd='*'
          AND 'authenticated'::regrole::oid=ANY(p.polroles)
          AND pg_get_expr(p.polqual,p.polrelid)='( SELECT internal.actor_has_active_session() AS actor_has_active_session)'
          AND pg_get_expr(p.polwithcheck,p.polrelid)='( SELECT internal.actor_has_active_session() AS actor_has_active_session)')))
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='cluvo_command_owner'
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='api' AND p.prosecdef)
    OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('internal.actor_has_active_session()')
      AND p.prosecdef AND p.proowner='cluvo_command_owner'::regrole::oid)
  THEN RAISE EXCEPTION 'STAGING_CORE_SCHEMA_OR_LOCK_REFUSED'; END IF;

  -- Lock exactly the existing designated identity. Email confirmation belongs
  -- to the provider OTP; this command never edits native identity/session data.
  SELECT count(*) INTO v_count FROM auth.users
    WHERE lower(email)=v_context->>'recipient' AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<=statement_timestamp());
  IF v_count<>1 THEN RAISE EXCEPTION 'STAGING_CORE_ACCOUNT_REFUSED'; END IF;
  SELECT id INTO STRICT v_uid FROM auth.users
    WHERE lower(email)=v_context->>'recipient' AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<=statement_timestamp()) FOR UPDATE;

  SELECT count(*) INTO v_count FROM app.tenants
    WHERE id='${f.tenant}' OR slug='${f.slug}';
  IF v_count=0 THEN
    IF EXISTS (SELECT 1 FROM app.account_profiles WHERE auth_user_id=v_uid)
      OR EXISTS (SELECT 1 FROM app.account_person_links WHERE auth_user_id=v_uid)
      OR EXISTS (SELECT 1 FROM app.tenant_memberships WHERE auth_user_id=v_uid)
      OR EXISTS (SELECT 1 FROM app.access_grants WHERE auth_user_id=v_uid)
      OR EXISTS (SELECT 1 FROM app.household_access_grants WHERE auth_user_id=v_uid)
    THEN RAISE EXCEPTION 'STAGING_CORE_EXISTING_SCOPE_REFUSED'; END IF;
    INSERT INTO app.tenants(id,slug,name,timezone,locale,status,branding_json)
      VALUES('${f.tenant}','${f.slug}','Cluvo staging','Europe/Amsterdam','nl-NL','active',
        '{"fixture":"cluvo-staging-core-v1","synthetic":true,"version":1}'::jsonb);
    SELECT id INTO STRICT v_role FROM app.permission_roles
      WHERE tenant_id='${f.tenant}' AND role_key='member';
    INSERT INTO app.account_profiles(auth_user_id,display_name,locale)
      VALUES(v_uid,'Staging tester','nl-NL');
    INSERT INTO app.persons(id,tenant_id,given_name,family_name,status)
      VALUES('${f.person}','${f.tenant}','Staging','Tester','active');
    INSERT INTO app.account_person_links(id,tenant_id,auth_user_id,person_id,verified_at)
      VALUES('${f.accountLink}','${f.tenant}',v_uid,'${f.person}',statement_timestamp());
    INSERT INTO app.tenant_memberships(id,tenant_id,auth_user_id,status)
      VALUES('${f.membership}','${f.tenant}',v_uid,'active');
    INSERT INTO app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)
      VALUES('${f.memberGrant}','${f.tenant}',v_uid,v_role,'tenant',v_uid);
    INSERT INTO app.households(id,tenant_id,label,intake_code_hash,status)
      VALUES('${f.household}','${f.tenant}','Staging testhuishouden',
        extensions.digest(gen_random_uuid()::text,'sha256'),'active');
    INSERT INTO app.household_person_links(id,tenant_id,household_id,person_id,kind,verified_by_auth_user_id)
      VALUES('${f.personLink}','${f.tenant}','${f.household}','${f.person}','member',v_uid);
    INSERT INTO app.household_access_grants(id,tenant_id,household_id,auth_user_id,
      can_view_progress,can_manage_contacts,can_invite_executor,can_book_for,granted_by_auth_user_id)
      VALUES('${f.householdGrant}','${f.tenant}','${f.household}',v_uid,true,false,false,false,v_uid);
    INSERT INTO app.intake_profiles(id,tenant_id,person_id,household_context_id)
      VALUES('${f.intake}','${f.tenant}','${f.person}','${f.household}');
    INSERT INTO app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,
      target_minutes,winter_target_minutes,status)
      VALUES('${f.season}','${f.tenant}','Staging testseizoen',current_date-30,current_date+335,
        statement_timestamp()+interval '90 days',720,360,'active');
    INSERT INTO app.obligations(id,tenant_id,season_id,assessed_household_id,
      base_target_minutes,effective_target_minutes,effective_winter_minutes,status)
      VALUES('${f.obligation}','${f.tenant}','${f.season}','${f.household}',720,720,360,'active');
    INSERT INTO app.household_obligation_links(id,tenant_id,household_id,obligation_id,link_kind)
      VALUES('${f.obligationLink}','${f.tenant}','${f.household}','${f.obligation}','liable');
    v_created := true;
  ELSIF v_count<>1 THEN
    RAISE EXCEPTION 'STAGING_CORE_EXISTING_SCOPE_REFUSED';
  END IF;

  -- Validate the complete fixed scope on both first creation and replay. A
  -- marker/slug alone is never authority to adopt existing profiles or grants.
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id='${f.tenant}' AND slug='${f.slug}'
      AND name='Cluvo staging' AND timezone='Europe/Amsterdam' AND locale='nl-NL' AND status='active' AND version=1
      AND branding_json='{"fixture":"cluvo-staging-core-v1","synthetic":true,"version":1}'::jsonb)
    OR NOT EXISTS (SELECT 1 FROM app.persons WHERE id='${f.person}' AND tenant_id='${f.tenant}'
      AND given_name='Staging' AND family_name='Tester' AND birth_date IS NULL AND birth_date_precision='unknown'
      AND membership_started_on IS NULL AND status='active' AND version=1)
    OR NOT EXISTS (SELECT 1 FROM app.account_profiles WHERE auth_user_id=v_uid
      AND display_name='Staging tester' AND locale='nl-NL' AND version=1)
    OR NOT EXISTS (SELECT 1 FROM app.account_person_links WHERE id='${f.accountLink}' AND tenant_id='${f.tenant}'
      AND auth_user_id=v_uid AND person_id='${f.person}' AND relationship='self' AND verified_at IS NOT NULL AND revoked_at IS NULL)
    OR NOT EXISTS (SELECT 1 FROM app.tenant_memberships WHERE id='${f.membership}' AND tenant_id='${f.tenant}'
      AND auth_user_id=v_uid AND status='active' AND starts_at<=statement_timestamp() AND ends_at IS NULL AND version=1)
    OR NOT EXISTS (SELECT 1 FROM app.access_grants g JOIN app.permission_roles r ON r.id=g.role_id AND r.tenant_id=g.tenant_id
      WHERE g.id='${f.memberGrant}' AND g.tenant_id='${f.tenant}' AND g.auth_user_id=v_uid AND r.role_key='member'
      AND g.scope_kind='tenant' AND num_nonnulls(g.committee_id,g.team_id,g.household_id)=0
      AND g.starts_at<=statement_timestamp() AND g.ends_at IS NULL AND g.revoked_at IS NULL
      AND g.granted_by_auth_user_id=v_uid AND g.renewed_at IS NULL AND g.version=1)
    OR (SELECT count(*) FROM app.access_grants WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.account_person_links WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.tenant_memberships WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.access_grants WHERE auth_user_id=v_uid)<>1
    OR (SELECT count(*) FROM app.account_person_links WHERE auth_user_id=v_uid)<>1
    OR (SELECT count(*) FROM app.tenant_memberships WHERE auth_user_id=v_uid)<>1
    OR (SELECT count(*) FROM app.persons WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT array_agg(p.permission_key ORDER BY p.permission_key) FROM app.role_permissions p
      JOIN app.permission_roles r ON r.id=p.role_id AND r.tenant_id=p.tenant_id
      WHERE p.tenant_id='${f.tenant}' AND r.role_key='member')
      IS DISTINCT FROM ARRAY['agenda.view','match.view','shift.book','shift.view']::text[]
    OR NOT EXISTS (SELECT 1 FROM app.households WHERE id='${f.household}' AND tenant_id='${f.tenant}'
      AND label='Staging testhuishouden' AND octet_length(intake_code_hash)=32 AND intake_code_hint IS NULL
      AND NOT separated_parents AND status='active' AND version=1)
    OR NOT EXISTS (SELECT 1 FROM app.household_person_links WHERE id='${f.personLink}' AND tenant_id='${f.tenant}'
      AND household_id='${f.household}' AND person_id='${f.person}' AND kind='member'
      AND starts_at<=statement_timestamp() AND ends_at IS NULL AND verified_by_auth_user_id=v_uid)
    OR NOT EXISTS (SELECT 1 FROM app.household_access_grants WHERE id='${f.householdGrant}' AND tenant_id='${f.tenant}'
      AND household_id='${f.household}' AND auth_user_id=v_uid AND can_view_progress
      AND NOT can_manage_contacts AND NOT can_invite_executor AND NOT can_book_for
      AND starts_at<=statement_timestamp() AND ends_at IS NULL AND revoked_at IS NULL
      AND granted_by_auth_user_id=v_uid AND version=1)
    OR (SELECT count(*) FROM app.household_access_grants WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.household_access_grants WHERE auth_user_id=v_uid)<>1
    OR (SELECT count(*) FROM app.households WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.household_person_links WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.intake_profiles WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.seasons WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.obligations WHERE tenant_id='${f.tenant}')<>1
    OR (SELECT count(*) FROM app.household_obligation_links WHERE tenant_id='${f.tenant}')<>1
    OR NOT EXISTS (SELECT 1 FROM app.intake_profiles WHERE id='${f.intake}' AND tenant_id='${f.tenant}'
      AND person_id='${f.person}' AND household_context_id='${f.household}'
      AND status IN ('draft','submitted','confirmed') AND version>=1 AND current_revision>=0)
    OR NOT EXISTS (SELECT 1 FROM app.seasons WHERE id='${f.season}' AND tenant_id='${f.tenant}'
      AND name='Staging testseizoen' AND starts_on<=current_date AND ends_on>current_date
      AND target_minutes=720 AND winter_target_minutes=360 AND status='active' AND version=1)
    OR NOT EXISTS (SELECT 1 FROM app.obligations WHERE id='${f.obligation}' AND tenant_id='${f.tenant}'
      AND season_id='${f.season}' AND assessed_household_id='${f.household}' AND base_target_minutes=720
      AND effective_target_minutes=720 AND effective_winter_minutes=360
      AND status IN ('active','review_hold','fulfilled') AND version>=1 AND ledger_revision>=0)
    OR NOT EXISTS (SELECT 1 FROM app.household_obligation_links WHERE id='${f.obligationLink}' AND tenant_id='${f.tenant}'
      AND household_id='${f.household}' AND obligation_id='${f.obligation}' AND link_kind='liable'
      AND starts_at<=statement_timestamp() AND ends_at IS NULL)
  THEN RAISE EXCEPTION 'STAGING_CORE_EXISTING_SCOPE_REFUSED'; END IF;

  -- Private immutable scope signature includes original relationship times,
  -- grant rights, random intake hash and season dates. Mutable personal intake
  -- answers and subsequent append-only events/ledger are deliberately retained.
  SELECT extensions.digest(convert_to(jsonb_build_object('format','${FORMAT}',
    'auth_user_id',v_uid,
    'tenant',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.tenants t WHERE id='${f.tenant}'),
    'person',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.persons t WHERE id='${f.person}'),
    'profile',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.account_profiles t WHERE auth_user_id=v_uid),
    'account_link',(SELECT to_jsonb(t)-'created_at' FROM app.account_person_links t WHERE id='${f.accountLink}'),
    'membership',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.tenant_memberships t WHERE id='${f.membership}'),
    'member_grant',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.access_grants t WHERE id='${f.memberGrant}'),
    'member_permissions',(SELECT jsonb_agg(p.permission_key ORDER BY p.permission_key) FROM app.role_permissions p
      JOIN app.permission_roles r ON r.id=p.role_id AND r.tenant_id=p.tenant_id
      WHERE p.tenant_id='${f.tenant}' AND r.role_key='member'),
    'household',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.households t WHERE id='${f.household}'),
    'person_link',(SELECT to_jsonb(t)-'created_at' FROM app.household_person_links t WHERE id='${f.personLink}'),
    'household_grant',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.household_access_grants t WHERE id='${f.householdGrant}'),
    'season',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.seasons t WHERE id='${f.season}'),
    'obligation',(SELECT to_jsonb(t)-'created_at'-'updated_at'-'version'-'ledger_revision'-'status'
      FROM app.obligations t WHERE id='${f.obligation}'),
    'obligation_link',(SELECT to_jsonb(t)-'created_at' FROM app.household_obligation_links t WHERE id='${f.obligationLink}'),
    'intake',jsonb_build_object('id','${f.intake}','tenant_id','${f.tenant}','person_id','${f.person}','household_id','${f.household}')
    )::text,'UTF8'),'sha256') INTO v_signature;
  IF v_created THEN
    INSERT INTO app.idempotency_records(id,tenant_id,actor_auth_user_id,operation,idempotency_key,
      request_hash,status,result_jsonb,completed_at)
      VALUES('${f.idempotencyRecord}','${f.tenant}',v_uid,'staging_core_bootstrap_v1','${f.idempotencyKey}',
        v_signature,'completed',v_result,statement_timestamp());
    INSERT INTO app.audit_events(id,tenant_id,actor_auth_user_id,action,resource_type,resource_id,
      scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
      VALUES('${f.audit}','${f.tenant}',v_uid,'staging.core_bootstrap_created','tenant','${f.tenant}',
        'tenant','${f.tenant}','SYNTHETIC_STAGING_FIXTURE','${f.idempotencyKey}',
        jsonb_build_object('fixture_version',1,'expected_version',0,'version',1,'authorization','USER_REQUEST',
          'provisioning_actor_type','github_workflow','provisioning_actor',v_context->>'actor',
          'source_sha',v_context->>'source_sha','workflow_run_id',v_context->>'workflow_run_id',
          'beneficiary_auth_user_used_as_fk',true,'native_session_claimed',false));
  ELSE
    SELECT * INTO STRICT v_prior FROM app.idempotency_records WHERE id='${f.idempotencyRecord}' FOR UPDATE;
    SELECT * INTO STRICT v_audit FROM app.audit_events WHERE id='${f.audit}';
    IF v_prior.tenant_id IS DISTINCT FROM '${f.tenant}'::uuid OR v_prior.actor_auth_user_id IS DISTINCT FROM v_uid
      OR v_prior.operation<>'staging_core_bootstrap_v1' OR v_prior.idempotency_key<>'${f.idempotencyKey}'::uuid
      OR v_prior.request_hash IS DISTINCT FROM v_signature OR v_prior.status<>'completed'
      OR v_prior.completed_at IS NULL OR v_prior.result_jsonb IS DISTINCT FROM v_result
      OR v_audit.tenant_id IS DISTINCT FROM '${f.tenant}'::uuid OR v_audit.actor_auth_user_id IS DISTINCT FROM v_uid
      OR v_audit.action<>'staging.core_bootstrap_created' OR v_audit.resource_type<>'tenant'
      OR v_audit.resource_id<>'${f.tenant}'::uuid OR v_audit.scope_kind IS DISTINCT FROM 'tenant'
      OR v_audit.scope_id IS DISTINCT FROM '${f.tenant}'::uuid
      OR v_audit.reason_code IS DISTINCT FROM 'SYNTHETIC_STAGING_FIXTURE'
      OR v_audit.idempotency_key IS DISTINCT FROM '${f.idempotencyKey}'::uuid
      OR v_audit.represented_person_id IS NOT NULL
      OR jsonb_typeof(v_audit.payload_minimal) IS DISTINCT FROM 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(v_audit.payload_minimal))<>10
      OR v_audit.payload_minimal->'fixture_version' IS DISTINCT FROM '1'::jsonb
      OR v_audit.payload_minimal->'expected_version' IS DISTINCT FROM '0'::jsonb
      OR v_audit.payload_minimal->'version' IS DISTINCT FROM '1'::jsonb
      OR v_audit.payload_minimal->>'authorization' IS DISTINCT FROM 'USER_REQUEST'
      OR v_audit.payload_minimal->>'provisioning_actor_type' IS DISTINCT FROM 'github_workflow'
      OR v_audit.payload_minimal->'beneficiary_auth_user_used_as_fk' IS DISTINCT FROM 'true'::jsonb
      OR v_audit.payload_minimal->'native_session_claimed' IS DISTINCT FROM 'false'::jsonb
      OR coalesce(v_audit.payload_minimal->>'source_sha','') !~ '^[0-9a-f]{40}$'
      OR coalesce(v_audit.payload_minimal->>'workflow_run_id','') !~ '^[1-9][0-9]{0,19}$'
      OR coalesce(v_audit.payload_minimal->>'provisioning_actor','') !~ '^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
    THEN RAISE EXCEPTION 'STAGING_CORE_REPLAY_REFUSED'; END IF;
  END IF;
  PERFORM set_config('cluvo.core_bootstrap_outcome',CASE WHEN v_created THEN 'created' ELSE 'already_configured' END,true);
EXCEPTION WHEN OTHERS THEN
  -- No recipient, SQL diagnostic, identity or private scope value in errors.
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STAGING_CORE_BOOTSTRAP_REFUSED';
END
$cluvo_core_bootstrap$;`;

const READBACK_SQL=`SELECT jsonb_build_object('scope','STAGING_SYNTHETIC_CORE_V1',
  'status',current_setting('cluvo.core_bootstrap_outcome'),
  'fixture_version',1,
  'tenants',(SELECT count(*) FROM app.tenants WHERE id='${f.tenant}'),
  'member_grants',(SELECT count(*) FROM app.access_grants g JOIN app.permission_roles r ON r.id=g.role_id AND r.tenant_id=g.tenant_id
    WHERE g.tenant_id='${f.tenant}' AND r.role_key='member'),
  'households',(SELECT count(*) FROM app.households WHERE id='${f.household}'),
  'intake_profiles',(SELECT count(*) FROM app.intake_profiles WHERE id='${f.intake}'),
  'seasons',(SELECT count(*) FROM app.seasons WHERE id='${f.season}'),
  'obligations',(SELECT count(*) FROM app.obligations WHERE id='${f.obligation}'),
  'bootstrap_audits',(SELECT count(*) FROM app.audit_events WHERE id='${f.audit}'),
  'bootstrap_commands',(SELECT count(*) FROM app.idempotency_records WHERE id='${f.idempotencyRecord}'),
  'current_ledger_entries',(SELECT count(*) FROM app.hour_ledger_entries WHERE tenant_id='${f.tenant}'),
  'auth_mutations',false,'mail_sent',false,'native_session_proven',false,'v1_ready',false,'production_enabled',false);`;

export function buildStagingCoreBootstrap(value){
  let fields;
  try{
    need(value!==null&&typeof value==='object'&&!Array.isArray(value));
    const descriptors=Object.getOwnPropertyDescriptors(value);
    const names=['recipient','sourceSha','workflowRunId','actor','expectedVersion'];
    need(Object.getOwnPropertySymbols(value).length===0&&Object.keys(descriptors).length===names.length);
    fields=Object.fromEntries(names.map(name=>{
      need(descriptors[name]&&Object.hasOwn(descriptors[name],'value'));
      return[name,descriptors[name].value];
    }));
  }catch{throw new StagingCoreBootstrapError();}
  need(typeof fields.recipient==='string'&&fields.recipient.length<=254
    &&/^[A-Za-z0-9.!#$%&+/?^_{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(fields.recipient));
  need(typeof fields.sourceSha==='string'&&/^[0-9a-f]{40}$/.test(fields.sourceSha));
  need(typeof fields.workflowRunId==='string'&&/^[1-9][0-9]{0,19}$/.test(fields.workflowRunId));
  need(typeof fields.actor==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(fields.actor));
  need(fields.expectedVersion===0);
  return Object.freeze({contextSql:CONTEXT_SQL,
    parameters:Object.freeze([fields.recipient,fields.sourceSha,fields.workflowRunId,fields.actor]),
    mutationSql:MUTATION_SQL,readbackSql:READBACK_SQL});
}
