// Separate PWA owner; original native QA remains unchanged.
// Pure fixed staging QA components. Real Auth users and sessions are created
// only by the provider Admin/password API owner, never by these SQL components.
import {createHash} from 'node:crypto';
import {UPGRADE_FILES,upgradeReceiptLineageSQL} from './staging-pwa-upgrade-migrations.mjs';
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';

export const NATIVE_QA_FORMAT='cluvo-pwa-native-qa-fixture-v1';
export class NativeQaFixtureError extends Error {
  constructor(){super('STAGING_NATIVE_QA_INPUT_INVALID');this.code='STAGING_NATIVE_QA_INPUT_INVALID';}
}
const need=value=>{if(!value)throw new NativeQaFixtureError();};
const validRun=value=>typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value);
const validUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const fields=(value,names)=>{
  try{
    need(value&&typeof value==='object'&&!Array.isArray(value));
    const descriptors=Object.getOwnPropertyDescriptors(value);
    need(Reflect.ownKeys(descriptors).length===names.length&&names.every(name=>
      descriptors[name]&&Object.hasOwn(descriptors[name],'value')));
    return Object.fromEntries(names.map(name=>[name,descriptors[name].value]));
  }catch{throw new NativeQaFixtureError();}
};
const LABELS=Object.freeze([
  'tenantA','tenantB','personA','personB','personBForeign','householdA','householdB',
  'accountLinkA','accountLinkB','accountLinkBForeign','membershipA','membershipB','membershipBForeign',
  'memberGrantA','memberGrantB','memberGrantBForeign','householdPersonA','householdPersonB','householdPersonBForeign',
  'householdGrantA','householdGrantB','householdGrantBForeign','intakeA','intakeB','intakeBForeign',
  'seasonB','obligationForeign','householdObligationForeign','qaFixtureAudit','qaFixtureCommand','idempotencyQaFixture',
  'qaTeardownAudit','qaTeardownCommand','idempotencyQaTeardown',
  'householdRaceB','householdGrantRaceB','seasonA','obligationA','obligationB','committeeRace','categoryRace',
  'taskTypeRace','taskVersionRace','shiftRace','positionRace','idempotencyRaceA','idempotencyRaceB',
  'executorGrantRaceA','executorGrantRaceB','householdPersonRaceB','householdObligationRaceA',
  'householdObligationRaceB','qaBookingAudit','instructionRace',
  'teamA','teamB','teamMembershipA','teamMembershipB','teamMembershipBForeign','minorContact',
]);
export function nativeQaFixtureIds(workflowRunId){
  need(validRun(workflowRunId));
  const result=Object.fromEntries(LABELS.map(label=>{
    const bytes=createHash('sha256').update(NATIVE_QA_FORMAT+':'+workflowRunId+':'+label).digest().subarray(0,16);
    bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=bytes.toString('hex');
    return[label,[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-')];
  }));
  return Object.freeze(result);
}
export function nativeQaProviderEmail(workflowRunId,slot){
  need(validRun(workflowRunId)&&['a','b'].includes(slot));
  return 'cluvo-pwa-qa-'+workflowRunId+'-'+slot+'@example.test';
}
export function nativeQaProviderMetadata(value){
  const {sourceSha,workflowRunId,actor,slot}=fields(value,['sourceSha','workflowRunId','actor','slot']);
  need(typeof sourceSha==='string'&&/^[0-9a-f]{40}$/.test(sourceSha)&&validRun(workflowRunId)
    &&typeof actor==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(actor)&&['a','b'].includes(slot));
  return Object.freeze({cluvo_qa_fixture:NATIVE_QA_FORMAT,cluvo_qa_run_id:workflowRunId,
    cluvo_qa_source_sha:sourceSha,cluvo_qa_actor:actor,cluvo_qa_slot:slot});
}

const literal=value=>"'"+value.replaceAll("'","''")+"'";
const ids=(fixture,names)=>'ARRAY['+names.map(name=>literal(fixture[name])).join(',')+']::uuid[]';
const PROJECT=INITIAL_MIGRATION_POLICY.projectRef;
const CONTEXT_SQL=`SELECT set_config('cluvo.native_qa_context',jsonb_build_object(
  'format','${NATIVE_QA_FORMAT}','scope','staging','project_ref','${PROJECT}',
  'providers',$1::jsonb,'source_sha',$2::text,'workflow_run_id',$3::text,'actor',$4::text,
  'expected_version',0,'qa_fixture_version',1)::text,true) IS NOT NULL AS configured;`;

function contextGuard(run){return `
  v_ctx:=nullif(current_setting('cluvo.native_qa_context',true),'')::jsonb;
  IF jsonb_typeof(v_ctx) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v_ctx))<>9
    OR v_ctx->>'format' IS DISTINCT FROM '${NATIVE_QA_FORMAT}' OR v_ctx->>'scope' IS DISTINCT FROM 'staging'
    OR v_ctx->>'project_ref' IS DISTINCT FROM '${PROJECT}' OR v_ctx->'expected_version' IS DISTINCT FROM '0'::jsonb
    OR v_ctx->'qa_fixture_version' IS DISTINCT FROM '1'::jsonb
    OR coalesce(v_ctx->>'source_sha','')!~'^[0-9a-f]{40}$'
    OR coalesce(v_ctx->>'workflow_run_id','')!~'^[1-9][0-9]{0,19}$'
    OR v_ctx->>'workflow_run_id' IS DISTINCT FROM '${run}'
    OR coalesce(v_ctx->>'actor','')!~'^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
    OR jsonb_typeof(v_ctx->'providers') IS DISTINCT FROM 'array' OR jsonb_array_length(v_ctx->'providers')<>2
    OR v_ctx->'providers'->0->>'slot' IS DISTINCT FROM 'a' OR v_ctx->'providers'->1->>'slot' IS DISTINCT FROM 'b'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_ctx->'providers') p WHERE jsonb_typeof(p)<>'object'
      OR (SELECT count(*) FROM jsonb_object_keys(p))<>3
      OR coalesce(p->>'id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR p->>'email' IS DISTINCT FROM 'cluvo-pwa-qa-'||(v_ctx->>'workflow_run_id')||'-'||(p->>'slot')||'@example.test')
    OR v_ctx->'providers'->0->>'id'=v_ctx->'providers'->1->>'id'
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
  v_a:=(v_ctx->'providers'->0->>'id')::uuid;v_b:=(v_ctx->'providers'->1->>'id')::uuid;`;
}

// Also recheck the fixed byte history in SQL. The parent separately binds this
// transaction to its verified TLS connection, physical backend and live lock.
function schemaGuard(){
  const expected=UPGRADE_FILES.map((entry,index)=>'('+[
    entry.file.slice(0,14),entry.file.slice(15,-4),entry.file,entry.sha256,
  ].map(literal).join(',')+','+index+')').join(',');
  const manifestHash=createHash('sha256').update(JSON.stringify(UPGRADE_FILES)).digest('hex');
  const lineage=upgradeReceiptLineageSQL(manifestHash,UPGRADE_FILES.length,'e.position');
  return `
  IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
    OR current_setting('transaction_read_only')<>'off'
    OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted
      AND mode='ExclusiveLock' AND classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid
      AND objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid AND objsubid=2)
    OR (SELECT count(*) FROM supabase_migrations.schema_migrations)<>${UPGRADE_FILES.length}
    OR (SELECT count(*) FROM supabase_migrations.cluvo_migration_source)<>16
    OR (SELECT count(*) FROM supabase_migrations.cluvo_pwa_upgrade_source)<>${UPGRADE_FILES.length-16}
    OR ${lineage.aggregateInvalidSql}
    OR EXISTS(SELECT 1 FROM (VALUES ${expected}) e(version,name,file,sha256,position)
      LEFT JOIN supabase_migrations.schema_migrations h USING(version)
      LEFT JOIN supabase_migrations.cluvo_migration_source initial USING(version)
      LEFT JOIN supabase_migrations.cluvo_pwa_upgrade_source suffix USING(version)
      WHERE h.name IS DISTINCT FROM e.name OR cardinality(h.statements) IS DISTINCT FROM 1
      OR encode(sha256(convert_to(h.statements[1],'UTF8')),'hex') IS DISTINCT FROM e.sha256
      OR CASE WHEN e.position<16 THEN initial.file ELSE suffix.file END IS DISTINCT FROM e.file
      OR CASE WHEN e.position<16 THEN initial.sha256 ELSE suffix.sha256 END IS DISTINCT FROM e.sha256
      OR CASE WHEN e.position<16 THEN initial.scope ELSE suffix.scope END IS DISTINCT FROM 'staging'
      OR CASE WHEN e.position<16 THEN initial.expected_version ELSE suffix.expected_version END IS DISTINCT FROM e.position
      OR coalesce(initial.source_sha,suffix.source_sha,'')!~'^[0-9a-f]{40}$'
      OR coalesce(initial.actor,suffix.actor,'')!~'^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
      OR coalesce(initial.workflow_run_id,suffix.workflow_run_id,'')!~'^[1-9][0-9]{0,19}$'
      OR CASE WHEN e.position<16 THEN initial.idempotency_key ELSE suffix.idempotency_key END IS DISTINCT FROM
        (CASE WHEN e.position<16 THEN 'cluvo-staging-initial16:' ELSE 'cluvo-staging-pwa-upgrade:' END||coalesce(initial.workflow_run_id,suffix.workflow_run_id)||':'||e.version)
      OR (e.position>=16 AND (${lineage.rowInvalidSql}
        OR coalesce(suffix.backup_artifact_id,'')!~'^[1-9][0-9]{0,19}$' OR coalesce(suffix.backup_artifact_sha256,'')!~'^[0-9a-f]{64}$')))
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r')<144
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS(SELECT 1 FROM pg_policy p
        WHERE p.polrelid=c.oid AND p.polname='native_session_required' AND NOT p.polpermissive AND p.polcmd='*'
        AND 'authenticated'::regrole::oid=ANY(p.polroles)
        AND pg_get_expr(p.polqual,p.polrelid)='( SELECT internal.actor_has_active_session() AS actor_has_active_session)'
        AND pg_get_expr(p.polwithcheck,p.polrelid)='( SELECT internal.actor_has_active_session() AS actor_has_active_session)')))
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cluvo_command_owner' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin)
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('internal.actor_has_active_session()')
      AND prosecdef AND proowner='cluvo_command_owner'::regrole::oid)
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='api' AND c.relkind='v')<>21
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='api' AND c.relkind='v'
        AND NOT('security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[]))))
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api')<>89
    OR EXISTS(SELECT 1 FROM (VALUES ('api.pwa_personal_action_context(uuid,uuid,bigint)'),
      ('api.pwa_committee_planning(uuid,uuid)')) required(signature)
      LEFT JOIN pg_proc p ON p.oid=to_regprocedure(required.signature)
      WHERE p.oid IS NULL OR p.prosecdef OR p.provolatile<>'s'
        OR p.proowner IS DISTINCT FROM 'postgres'::regrole::oid
        OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_language WHERE lanname='sql')
        OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
        OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('service_role',p.oid,'EXECUTE'))
    OR EXISTS(SELECT 1 FROM (VALUES
      ('api.sportlink_connection_state(uuid)','s'),
      ('api.configure_sportlink_connection(uuid,uuid,bigint,jsonb,text,uuid)','v'),
      ('api.sportlink_connection_credential(uuid,uuid,bigint)','s'),
      ('api.record_sportlink_connection_test(uuid,uuid,bigint,jsonb,uuid)','v')) required(signature,volatility)
      LEFT JOIN pg_proc p ON p.oid=to_regprocedure(required.signature)
      WHERE p.oid IS NULL OR p.prosecdef OR p.provolatile::text<>required.volatility
        OR p.proowner IS DISTINCT FROM 'cluvo_command_owner'::regrole::oid
        OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_language WHERE lanname='sql')
        OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
        OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
        OR has_function_privilege('anon',p.oid,'EXECUTE')
        OR has_function_privilege('service_role',p.oid,'EXECUTE'))
    OR to_regclass('app.sportlink_connection_credentials') IS NULL
    OR has_table_privilege('authenticated',to_regclass('app.sportlink_connection_credentials'),'SELECT')
    OR has_table_privilege('anon',to_regclass('app.sportlink_connection_credentials'),'SELECT')
    OR has_table_privilege('service_role',to_regclass('app.sportlink_connection_credentials'),'SELECT')
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api' AND p.prosecdef)
    OR NOT EXISTS(SELECT 1 FROM pg_db_role_setting s WHERE s.setrole='authenticator'::regrole::oid
      AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres')
      AND 'pgrst.db_schemas=api'=ANY(s.setconfig))
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;`;
}

// Run before creating any provider identity. The session owner retains the
// same exclusive project lock across this transaction and the later recipes.
export function nativeQaSchemaGuardSql(){return `DO $cluvo_native_qa_schema_guard$ BEGIN ${schemaGuard()}
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STAGING_NATIVE_QA_REFUSED';
END $cluvo_native_qa_schema_guard$;`;}
export function nativeQaPreflightSql(){return `BEGIN READ WRITE;
${nativeQaSchemaGuardSql()}
SELECT jsonb_build_object('scope','STAGING_PWA_NATIVE_QA_PREFLIGHT_V1','migration_count',${UPGRADE_FILES.length},
  'native_guarded_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'),'api_only',true,'command_owner_restricted',true,
  'auth_mutations',false,'v1_ready',false,'production_enabled',false);
COMMIT;`;}

function providerGuard(){return `
  -- Eligible provider-created identities must match every QA ownership marker.
  -- No identity creation, confirmation, password or session write occurs here.
  PERFORM 1 FROM auth.users WHERE id IN(v_a,v_b) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM auth.users u JOIN jsonb_array_elements(v_ctx->'providers') p ON u.id=(p->>'id')::uuid
    WHERE lower(u.email)=p->>'email' AND u.role='authenticated' AND u.email_confirmed_at IS NOT NULL
      AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
      AND u.raw_app_meta_data->>'provider'='email' AND u.raw_app_meta_data->'providers'='["email"]'::jsonb
      AND u.raw_app_meta_data->>'cluvo_qa_fixture'='${NATIVE_QA_FORMAT}'
      AND u.raw_app_meta_data->>'cluvo_qa_run_id'=v_ctx->>'workflow_run_id'
      AND u.raw_app_meta_data->>'cluvo_qa_source_sha'=v_ctx->>'source_sha'
      AND u.raw_app_meta_data->>'cluvo_qa_actor'=v_ctx->>'actor'
      AND u.raw_app_meta_data->>'cluvo_qa_slot'=p->>'slot')<>2
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;`;
}

function scopeGuard(f,run){return `
  IF (SELECT count(*) FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])})
      AND status='active' AND version=1 AND timezone='Europe/Amsterdam' AND locale='nl-NL'
      AND branding_json=jsonb_build_object('fixture','${NATIVE_QA_FORMAT}','synthetic',true,'run_id','${run}'))<>2
    OR NOT EXISTS(SELECT 1 FROM app.tenants WHERE id='${f.tenantA}' AND slug='cluvo-pwa-qa-${run}-a' AND name='Cluvo QA A')
    OR NOT EXISTS(SELECT 1 FROM app.tenants WHERE id='${f.tenantB}' AND slug='cluvo-pwa-qa-${run}-b' AND name='Cluvo QA B')
    OR (SELECT count(*) FROM app.persons WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>3
    OR (SELECT count(*) FROM app.persons WHERE id=ANY(${ids(f,['personA','personB','personBForeign'])})
      AND birth_date='1990-01-01' AND birth_date_precision='day' AND membership_started_on IS NULL AND status='active' AND version=1)<>2
    OR NOT EXISTS(SELECT 1 FROM app.persons WHERE id='${f.personA}' AND tenant_id='${f.tenantA}' AND given_name='QA' AND family_name='A')
    OR NOT EXISTS(SELECT 1 FROM app.persons WHERE id='${f.personB}' AND tenant_id='${f.tenantA}' AND given_name='QA' AND family_name='B')
    OR NOT EXISTS(SELECT 1 FROM app.persons WHERE id='${f.personBForeign}' AND tenant_id='${f.tenantB}' AND given_name='QA' AND family_name='B foreign' AND birth_date='2013-01-01' AND birth_date_precision='day' AND status='active' AND version=1)
    OR (SELECT count(*) FROM app.teams WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>2
    OR NOT EXISTS(SELECT 1 FROM app.teams WHERE id='${f.teamA}' AND tenant_id='${f.tenantA}' AND name='QA team A' AND active AND version=1)
    OR NOT EXISTS(SELECT 1 FROM app.teams WHERE id='${f.teamB}' AND tenant_id='${f.tenantB}' AND name='QA minor team B' AND active AND version=1)
    OR (SELECT count(*) FROM app.team_person_memberships WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>3
    OR (SELECT count(*) FROM app.team_person_memberships WHERE membership_kind='player' AND starts_at<=statement_timestamp() AND ends_at IS NULL AND version=1 AND
      ((id='${f.teamMembershipA}' AND tenant_id='${f.tenantA}' AND team_id='${f.teamA}' AND person_id='${f.personA}')
       OR(id='${f.teamMembershipB}' AND tenant_id='${f.tenantA}' AND team_id='${f.teamA}' AND person_id='${f.personB}')
       OR(id='${f.teamMembershipBForeign}' AND tenant_id='${f.tenantB}' AND team_id='${f.teamB}' AND person_id='${f.personBForeign}')))<>3
    OR (SELECT count(*) FROM app.person_contacts WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>1
    OR NOT EXISTS(SELECT 1 FROM app.person_contacts WHERE id='${f.minorContact}' AND tenant_id='${f.tenantB}' AND person_id='${f.personBForeign}' AND kind='email' AND value='pwa-minor-contact-canary@example.test' AND visibility_scope='self' AND version=1)
    OR NOT EXISTS(SELECT 1 FROM app.account_profiles WHERE auth_user_id=v_a AND display_name='QA actor A' AND locale='nl-NL' AND version=1)
    OR NOT EXISTS(SELECT 1 FROM app.account_profiles WHERE auth_user_id=v_b AND display_name='QA actor B' AND locale='nl-NL' AND version=1)
    OR (SELECT count(*) FROM app.account_person_links WHERE auth_user_id IN(v_a,v_b))<>3
    OR (SELECT count(*) FROM app.tenant_memberships WHERE auth_user_id IN(v_a,v_b))<>3
    OR (SELECT count(*) FROM app.access_grants WHERE auth_user_id IN(v_a,v_b))<>3
    OR (SELECT count(*) FROM app.account_person_links WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>3
    OR (SELECT count(*) FROM app.tenant_memberships WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>3
    OR (SELECT count(*) FROM app.access_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>3
    OR EXISTS(SELECT 1 FROM app.account_person_links l WHERE l.auth_user_id IN(v_a,v_b)
      AND (l.id<>ALL(${ids(f,['accountLinkA','accountLinkB','accountLinkBForeign'])}) OR l.relationship<>'self'
        OR l.verified_at IS NULL OR l.revoked_at IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM app.account_person_links WHERE id='${f.accountLinkA}' AND tenant_id='${f.tenantA}' AND auth_user_id=v_a AND person_id='${f.personA}')
    OR NOT EXISTS(SELECT 1 FROM app.account_person_links WHERE id='${f.accountLinkB}' AND tenant_id='${f.tenantA}' AND auth_user_id=v_b AND person_id='${f.personB}')
    OR NOT EXISTS(SELECT 1 FROM app.account_person_links WHERE id='${f.accountLinkBForeign}' AND tenant_id='${f.tenantB}' AND auth_user_id=v_b AND person_id='${f.personBForeign}')
    OR EXISTS(SELECT 1 FROM app.tenant_memberships m WHERE m.auth_user_id IN(v_a,v_b)
      AND (m.id<>ALL(${ids(f,['membershipA','membershipB','membershipBForeign'])}) OR m.status<>'active'
        OR m.starts_at>statement_timestamp() OR m.ends_at IS NOT NULL OR m.version<>1))
    OR EXISTS(SELECT 1 FROM app.access_grants g JOIN app.permission_roles r ON r.id=g.role_id AND r.tenant_id=g.tenant_id
      WHERE g.auth_user_id IN(v_a,v_b) AND (g.id<>ALL(${ids(f,['memberGrantA','memberGrantB','memberGrantBForeign'])})
        OR r.role_key<>'member' OR g.scope_kind<>'tenant' OR num_nonnulls(g.committee_id,g.team_id,g.household_id)<>0
        OR g.starts_at>statement_timestamp() OR g.ends_at IS NOT NULL OR g.revoked_at IS NOT NULL OR g.version<>1))
    OR EXISTS(SELECT 1 FROM app.role_permissions p JOIN app.permission_roles r ON r.id=p.role_id AND r.tenant_id=p.tenant_id
      WHERE p.tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND r.role_key='member'
      AND p.permission_key NOT IN('agenda.view','match.view','shift.book','shift.view'))
    OR (SELECT count(*) FROM app.role_permissions p JOIN app.permission_roles r ON r.id=p.role_id AND r.tenant_id=p.tenant_id
      WHERE p.tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND r.role_key='member'
      AND p.permission_key IN('agenda.view','match.view','shift.book','shift.view'))<>8
    OR (SELECT count(*) FROM app.households WHERE id=ANY(${ids(f,['householdA','householdB'])}) AND version=1
      AND status='active' AND intake_code_hint IS NULL AND octet_length(intake_code_hash)=32)<>2
    OR NOT EXISTS(SELECT 1 FROM app.households WHERE id='${f.householdA}' AND tenant_id='${f.tenantA}' AND label='QA shared household' AND separated_parents)
    OR NOT EXISTS(SELECT 1 FROM app.households WHERE id='${f.householdB}' AND tenant_id='${f.tenantB}' AND label='QA foreign household' AND NOT separated_parents)
    OR EXISTS(SELECT 1 FROM app.households WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])})
      AND id<>ALL(${ids(f,['householdA','householdB','householdRaceB'])}))
    OR EXISTS(SELECT 1 FROM app.household_access_grants g WHERE g.auth_user_id IN(v_a,v_b)
      AND (g.id<>ALL(${ids(f,['householdGrantA','householdGrantB','householdGrantBForeign','householdGrantRaceB'])})
        OR NOT g.can_view_progress OR g.can_manage_contacts OR g.can_invite_executor OR g.can_book_for
        OR g.starts_at>statement_timestamp() OR g.ends_at IS NOT NULL OR g.revoked_at IS NOT NULL OR g.version<>1))
    OR (SELECT count(*) FROM app.household_access_grants WHERE id=ANY(${ids(f,['householdGrantA','householdGrantB','householdGrantBForeign'])}))<>3
    OR (SELECT count(*) FROM app.household_person_links WHERE id=ANY(${ids(f,['householdPersonA','householdPersonB','householdPersonBForeign'])})
      AND kind='member' AND starts_at<=statement_timestamp() AND ends_at IS NULL)<>3
    OR EXISTS(SELECT 1 FROM app.household_person_links WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])})
      AND id<>ALL(${ids(f,['householdPersonA','householdPersonB','householdPersonBForeign','householdPersonRaceB'])}))
    OR EXISTS(SELECT 1 FROM app.household_access_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])})
      AND id<>ALL(${ids(f,['householdGrantA','householdGrantB','householdGrantBForeign','householdGrantRaceB'])}))
    OR EXISTS(SELECT 1 FROM app.seasons WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND id<>ALL(${ids(f,['seasonA','seasonB'])}))
    OR EXISTS(SELECT 1 FROM app.obligations WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND id<>ALL(${ids(f,['obligationA','obligationB','obligationForeign'])}))
    OR EXISTS(SELECT 1 FROM app.executor_obligation_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND id<>ALL(${ids(f,['executorGrantRaceA','executorGrantRaceB'])}))
    OR (SELECT count(*) FROM app.intake_profiles WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}))<>3
    OR (SELECT count(*) FROM app.intake_profiles WHERE id=ANY(${ids(f,['intakeA','intakeB','intakeBForeign'])})
      AND status IN('draft','submitted','confirmed') AND version>=1 AND current_revision>=0)<>3
    OR NOT EXISTS(SELECT 1 FROM app.intake_profiles WHERE id='${f.intakeA}' AND tenant_id='${f.tenantA}' AND person_id='${f.personA}' AND household_context_id='${f.householdA}')
    OR NOT EXISTS(SELECT 1 FROM app.intake_profiles WHERE id='${f.intakeB}' AND tenant_id='${f.tenantA}' AND person_id='${f.personB}' AND household_context_id='${f.householdA}')
    OR NOT EXISTS(SELECT 1 FROM app.intake_profiles WHERE id='${f.intakeBForeign}' AND tenant_id='${f.tenantB}' AND person_id='${f.personBForeign}' AND household_context_id='${f.householdB}')
    OR NOT EXISTS(SELECT 1 FROM app.seasons WHERE id='${f.seasonB}' AND tenant_id='${f.tenantB}' AND name='QA foreign season'
      AND target_minutes=720 AND winter_target_minutes=360 AND status='active' AND version=1)
    OR NOT EXISTS(SELECT 1 FROM app.obligations WHERE id='${f.obligationForeign}' AND tenant_id='${f.tenantB}'
      AND season_id='${f.seasonB}' AND assessed_household_id='${f.householdB}' AND base_target_minutes=720
      AND effective_target_minutes=720 AND effective_winter_minutes=360 AND version>=1 AND ledger_revision>=0)
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;`;
}

function raceScopeGuard(f){return `
  -- The booking recipe is additive. Never adopt or archive a colliding ID
  -- without its complete tenant/person/provider binding and owned setup audit.
  IF EXISTS(SELECT 1 FROM app.households WHERE id='${f.householdRaceB}')
    OR EXISTS(SELECT 1 FROM app.household_person_links WHERE id='${f.householdPersonRaceB}')
    OR EXISTS(SELECT 1 FROM app.household_access_grants WHERE id='${f.householdGrantRaceB}')
    OR EXISTS(SELECT 1 FROM app.executor_obligation_grants WHERE id=ANY(${ids(f,['executorGrantRaceA','executorGrantRaceB'])}))
    OR EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaBookingAudit}')
  THEN
    IF NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaBookingAudit}' AND tenant_id='${f.tenantA}'
        AND actor_auth_user_id=v_a AND action='qa.booking_fixture_created' AND resource_type='qa_shift'
        AND resource_id='${f.shiftRace}' AND scope_kind='tenant' AND scope_id='${f.tenantA}'
        AND idempotency_key='${f.qaBookingAudit}' AND payload_minimal->>'scope'='staging'
        AND payload_minimal->>'source_sha'=v_ctx->>'source_sha'
        AND payload_minimal->>'workflow_run_id'=v_ctx->>'workflow_run_id'
        AND payload_minimal->>'actor'=v_ctx->>'actor' AND payload_minimal->'expected_version'='0'::jsonb
        AND payload_minimal->'qa_fixture_version'='1'::jsonb)
      OR NOT EXISTS(SELECT 1 FROM app.households WHERE id='${f.householdRaceB}' AND tenant_id='${f.tenantA}'
        AND label='Cluvo QA race B' AND status='active' AND version=1 AND NOT separated_parents
        AND intake_code_hint IS NULL AND octet_length(intake_code_hash)=32)
      OR NOT EXISTS(SELECT 1 FROM app.household_person_links WHERE id='${f.householdPersonRaceB}' AND tenant_id='${f.tenantA}'
        AND household_id='${f.householdRaceB}' AND person_id='${f.personB}' AND kind='executor'
        AND verified_by_auth_user_id=v_b AND starts_at<=statement_timestamp() AND ends_at IS NULL)
      OR NOT EXISTS(SELECT 1 FROM app.household_access_grants WHERE id='${f.householdGrantRaceB}' AND tenant_id='${f.tenantA}'
        AND household_id='${f.householdRaceB}' AND auth_user_id=v_b AND granted_by_auth_user_id=v_b
        AND can_view_progress AND NOT can_manage_contacts AND NOT can_invite_executor AND NOT can_book_for
        AND starts_at<=statement_timestamp() AND ends_at IS NULL AND revoked_at IS NULL AND version=1)
      OR (SELECT count(*) FROM app.executor_obligation_grants WHERE tenant_id='${f.tenantA}' AND revoked_at IS NULL
        AND ((id='${f.executorGrantRaceA}' AND person_id='${f.personA}' AND obligation_id='${f.obligationA}' AND approved_by_auth_user_id=v_a)
          OR (id='${f.executorGrantRaceB}' AND person_id='${f.personB}' AND obligation_id='${f.obligationB}' AND approved_by_auth_user_id=v_b)))<>2
    THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
  END IF;`;
}

function scopeSignature(f){return `
  SELECT extensions.digest(convert_to(jsonb_build_object('format','${NATIVE_QA_FORMAT}','actor_a',v_a,'actor_b',v_b,
    'tenants',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.tenants t WHERE id=ANY(${ids(f,['tenantA','tenantB'])})),
    'persons',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.persons t WHERE id=ANY(${ids(f,['personA','personB','personBForeign'])})),
    'profiles',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY auth_user_id) FROM app.account_profiles t WHERE auth_user_id IN(v_a,v_b)),
    'links',(SELECT jsonb_agg(to_jsonb(t)-'created_at' ORDER BY id) FROM app.account_person_links t WHERE id=ANY(${ids(f,['accountLinkA','accountLinkB','accountLinkBForeign'])})),
    'memberships',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.tenant_memberships t WHERE id=ANY(${ids(f,['membershipA','membershipB','membershipBForeign'])})),
    'grants',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.access_grants t WHERE id=ANY(${ids(f,['memberGrantA','memberGrantB','memberGrantBForeign'])})),
    'households',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.households t WHERE id=ANY(${ids(f,['householdA','householdB'])})),
    'household_links',(SELECT jsonb_agg(to_jsonb(t)-'created_at' ORDER BY id) FROM app.household_person_links t WHERE id=ANY(${ids(f,['householdPersonA','householdPersonB','householdPersonBForeign'])})),
    'household_grants',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.household_access_grants t WHERE id=ANY(${ids(f,['householdGrantA','householdGrantB','householdGrantBForeign'])})),
    'teams',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.teams t WHERE id=ANY(${ids(f,['teamA','teamB'])})),
    'team_memberships',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.team_person_memberships t WHERE id=ANY(${ids(f,['teamMembershipA','teamMembershipB','teamMembershipBForeign'])})),
    'minor_contact',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.person_contacts t WHERE id='${f.minorContact}'),
    'foreign_season',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.seasons t WHERE id='${f.seasonB}'),
    'foreign_obligation',(SELECT to_jsonb(t)-'created_at'-'updated_at'-'version'-'ledger_revision'-'status' FROM app.obligations t WHERE id='${f.obligationForeign}'),
    'foreign_obligation_link',(SELECT to_jsonb(t)-'created_at' FROM app.household_obligation_links t WHERE id='${f.householdObligationForeign}'))::text,'UTF8'),'sha256') INTO v_signature;`;
}

function setupSql(f,run){return `DO $cluvo_native_qa_setup$
DECLARE v_ctx jsonb;v_a uuid;v_b uuid;v_created boolean:=false;v_count integer;v_signature bytea;
  v_prior app.idempotency_records%rowtype;v_audit app.audit_events%rowtype;
  v_result jsonb:='{"scope":"STAGING_NATIVE_QA_FIXTURE_V1","qa_fixture_version":1,"auth_mutations":false,"native_session_claimed":false,"v1_ready":false,"production_enabled":false}'::jsonb;
BEGIN
${contextGuard(run)}${schemaGuard()}${providerGuard()}
  SELECT count(*) INTO v_count FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])}) OR slug IN('cluvo-pwa-qa-${run}-a','cluvo-pwa-qa-${run}-b');
  IF v_count=0 THEN
    IF EXISTS(SELECT 1 FROM app.account_profiles WHERE auth_user_id IN(v_a,v_b))
      OR EXISTS(SELECT 1 FROM app.account_person_links WHERE auth_user_id IN(v_a,v_b))
      OR EXISTS(SELECT 1 FROM app.tenant_memberships WHERE auth_user_id IN(v_a,v_b))
      OR EXISTS(SELECT 1 FROM app.access_grants WHERE auth_user_id IN(v_a,v_b))
      OR EXISTS(SELECT 1 FROM app.household_access_grants WHERE auth_user_id IN(v_a,v_b))
    THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    INSERT INTO app.tenants(id,slug,name,status,branding_json) VALUES
      ('${f.tenantA}','cluvo-pwa-qa-${run}-a','Cluvo QA A','active',jsonb_build_object('fixture','${NATIVE_QA_FORMAT}','synthetic',true,'run_id','${run}')),
      ('${f.tenantB}','cluvo-pwa-qa-${run}-b','Cluvo QA B','active',jsonb_build_object('fixture','${NATIVE_QA_FORMAT}','synthetic',true,'run_id','${run}'));
    INSERT INTO app.account_profiles(auth_user_id,display_name) VALUES(v_a,'QA actor A'),(v_b,'QA actor B');
    INSERT INTO app.persons(id,tenant_id,given_name,family_name) VALUES
      ('${f.personA}','${f.tenantA}','QA','A'),('${f.personB}','${f.tenantA}','QA','B'),
      ('${f.personBForeign}','${f.tenantB}','QA','B foreign');
    UPDATE app.persons SET birth_date='1990-01-01',birth_date_precision='day' WHERE id IN('${f.personA}','${f.personB}');
    UPDATE app.persons SET birth_date='2013-01-01',birth_date_precision='day' WHERE id='${f.personBForeign}';
    INSERT INTO app.teams(id,tenant_id,name) VALUES('${f.teamA}','${f.tenantA}','QA team A'),('${f.teamB}','${f.tenantB}','QA minor team B');
    INSERT INTO app.team_person_memberships(id,tenant_id,team_id,person_id,membership_kind) VALUES
      ('${f.teamMembershipA}','${f.tenantA}','${f.teamA}','${f.personA}','player'),
      ('${f.teamMembershipB}','${f.tenantA}','${f.teamA}','${f.personB}','player'),
      ('${f.teamMembershipBForeign}','${f.tenantB}','${f.teamB}','${f.personBForeign}','player');
    INSERT INTO app.person_contacts(id,tenant_id,person_id,kind,value,visibility_scope) VALUES
      ('${f.minorContact}','${f.tenantB}','${f.personBForeign}','email','pwa-minor-contact-canary@example.test','self');
    INSERT INTO app.account_person_links(id,tenant_id,auth_user_id,person_id,verified_at) VALUES
      ('${f.accountLinkA}','${f.tenantA}',v_a,'${f.personA}',statement_timestamp()),
      ('${f.accountLinkB}','${f.tenantA}',v_b,'${f.personB}',statement_timestamp()),
      ('${f.accountLinkBForeign}','${f.tenantB}',v_b,'${f.personBForeign}',statement_timestamp());
    INSERT INTO app.tenant_memberships(id,tenant_id,auth_user_id,status) VALUES
      ('${f.membershipA}','${f.tenantA}',v_a,'active'),('${f.membershipB}','${f.tenantA}',v_b,'active'),
      ('${f.membershipBForeign}','${f.tenantB}',v_b,'active');
    INSERT INTO app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)
      SELECT data.id,data.tenant_id,data.actor,r.id,'tenant',v_a FROM (VALUES
        ('${f.memberGrantA}'::uuid,'${f.tenantA}'::uuid,v_a),('${f.memberGrantB}'::uuid,'${f.tenantA}'::uuid,v_b),
        ('${f.memberGrantBForeign}'::uuid,'${f.tenantB}'::uuid,v_b)) data(id,tenant_id,actor)
        JOIN app.permission_roles r ON r.tenant_id=data.tenant_id AND r.role_key='member';
    INSERT INTO app.households(id,tenant_id,label,intake_code_hash,separated_parents) VALUES
      ('${f.householdA}','${f.tenantA}','QA shared household',extensions.digest(gen_random_uuid()::text,'sha256'),true),
      ('${f.householdB}','${f.tenantB}','QA foreign household',extensions.digest(gen_random_uuid()::text,'sha256'),false);
    INSERT INTO app.household_person_links(id,tenant_id,household_id,person_id,kind,verified_by_auth_user_id) VALUES
      ('${f.householdPersonA}','${f.tenantA}','${f.householdA}','${f.personA}','member',v_a),
      ('${f.householdPersonB}','${f.tenantA}','${f.householdA}','${f.personB}','member',v_a),
      ('${f.householdPersonBForeign}','${f.tenantB}','${f.householdB}','${f.personBForeign}','member',v_a);
    INSERT INTO app.household_access_grants(id,tenant_id,household_id,auth_user_id,can_view_progress,can_manage_contacts,can_invite_executor,can_book_for,granted_by_auth_user_id) VALUES
      ('${f.householdGrantA}','${f.tenantA}','${f.householdA}',v_a,true,false,false,false,v_a),
      ('${f.householdGrantB}','${f.tenantA}','${f.householdA}',v_b,true,false,false,false,v_a),
      ('${f.householdGrantBForeign}','${f.tenantB}','${f.householdB}',v_b,true,false,false,false,v_a);
    INSERT INTO app.intake_profiles(id,tenant_id,person_id,household_context_id) VALUES
      ('${f.intakeA}','${f.tenantA}','${f.personA}','${f.householdA}'),
      ('${f.intakeB}','${f.tenantA}','${f.personB}','${f.householdA}'),
      ('${f.intakeBForeign}','${f.tenantB}','${f.personBForeign}','${f.householdB}');
    INSERT INTO app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,target_minutes,winter_target_minutes,status)
      VALUES('${f.seasonB}','${f.tenantB}','QA foreign season',current_date-30,current_date+335,
        statement_timestamp()+interval '90 days',720,360,'active');
    INSERT INTO app.obligations(id,tenant_id,season_id,assessed_household_id,base_target_minutes,effective_target_minutes,effective_winter_minutes,status)
      VALUES('${f.obligationForeign}','${f.tenantB}','${f.seasonB}','${f.householdB}',720,720,360,'active');
    INSERT INTO app.household_obligation_links(id,tenant_id,household_id,obligation_id,link_kind)
      VALUES('${f.householdObligationForeign}','${f.tenantB}','${f.householdB}','${f.obligationForeign}','liable');
    v_created:=true;
  ELSIF v_count<>2 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
${scopeGuard(f,run)}${raceScopeGuard(f)}${scopeSignature(f)}
  IF v_created THEN
    INSERT INTO app.idempotency_records(id,tenant_id,actor_auth_user_id,operation,idempotency_key,request_hash,status,result_jsonb,completed_at)
      VALUES('${f.qaFixtureCommand}','${f.tenantA}',v_a,'staging_native_qa_fixture','${f.idempotencyQaFixture}',v_signature,'completed',v_result,statement_timestamp());
    INSERT INTO app.audit_events(id,tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
      VALUES('${f.qaFixtureAudit}','${f.tenantA}',v_a,'staging.native_qa_fixture_created','tenant','${f.tenantA}','tenant','${f.tenantA}',
        'SYNTHETIC_STAGING_QA','${f.idempotencyQaFixture}',jsonb_build_object('source_sha',v_ctx->>'source_sha',
          'workflow_run_id',v_ctx->>'workflow_run_id','actor',v_ctx->>'actor','expected_version',0,'qa_fixture_version',1,
          'scope','staging','provisioning_actor_type','github_workflow','beneficiary_auth_user_used_as_fk',true,'native_session_claimed',false));
  ELSE
    SELECT * INTO STRICT v_prior FROM app.idempotency_records WHERE id='${f.qaFixtureCommand}' FOR UPDATE;
    SELECT * INTO STRICT v_audit FROM app.audit_events WHERE id='${f.qaFixtureAudit}';
    IF v_prior.tenant_id IS DISTINCT FROM '${f.tenantA}'::uuid OR v_prior.actor_auth_user_id IS DISTINCT FROM v_a
      OR v_prior.operation<>'staging_native_qa_fixture' OR v_prior.idempotency_key<>'${f.idempotencyQaFixture}'::uuid
      OR v_prior.request_hash IS DISTINCT FROM v_signature OR v_prior.status<>'completed' OR v_prior.completed_at IS NULL
      OR v_prior.result_jsonb IS DISTINCT FROM v_result OR v_audit.tenant_id IS DISTINCT FROM '${f.tenantA}'::uuid
      OR v_audit.actor_auth_user_id IS DISTINCT FROM v_a OR v_audit.action<>'staging.native_qa_fixture_created'
      OR v_audit.resource_type<>'tenant' OR v_audit.resource_id<>'${f.tenantA}'::uuid
      OR v_audit.scope_kind IS DISTINCT FROM 'tenant' OR v_audit.scope_id IS DISTINCT FROM '${f.tenantA}'::uuid
      OR v_audit.represented_person_id IS NOT NULL OR v_audit.reason_code IS DISTINCT FROM 'SYNTHETIC_STAGING_QA'
      OR v_audit.idempotency_key IS DISTINCT FROM '${f.idempotencyQaFixture}'::uuid
      OR v_audit.payload_minimal IS DISTINCT FROM jsonb_build_object('source_sha',v_ctx->>'source_sha',
        'workflow_run_id',v_ctx->>'workflow_run_id','actor',v_ctx->>'actor','expected_version',0,'qa_fixture_version',1,
        'scope','staging','provisioning_actor_type','github_workflow','beneficiary_auth_user_used_as_fk',true,'native_session_claimed',false)
    THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
  END IF;
  PERFORM set_config('cluvo.native_qa_outcome',CASE WHEN v_created THEN 'created' ELSE 'already_configured' END,true);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STAGING_NATIVE_QA_REFUSED';
END $cluvo_native_qa_setup$;`;
}

function setupReadback(f){return `SELECT jsonb_build_object('scope','STAGING_NATIVE_QA_FIXTURE_V1',
  'status',current_setting('cluvo.native_qa_outcome'),'qa_fixture_version',1,
  'tenants',(SELECT count(*) FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])})),
  'persons',(SELECT count(*) FROM app.persons WHERE id=ANY(${ids(f,['personA','personB','personBForeign'])})),
  'member_grants',(SELECT count(*) FROM app.access_grants WHERE id=ANY(${ids(f,['memberGrantA','memberGrantB','memberGrantBForeign'])})),
  'base_households',(SELECT count(*) FROM app.households WHERE id=ANY(${ids(f,['householdA','householdB'])})),
  'intake_profiles',(SELECT count(*) FROM app.intake_profiles WHERE id=ANY(${ids(f,['intakeA','intakeB','intakeBForeign'])})),
  'foreign_obligations',(SELECT count(*) FROM app.obligations WHERE id='${f.obligationForeign}'),
  'setup_audits',(SELECT count(*) FROM app.audit_events WHERE id='${f.qaFixtureAudit}'),
  'setup_commands',(SELECT count(*) FROM app.idempotency_records WHERE id='${f.qaFixtureCommand}'),
  'initial_answers_created',0,'auth_mutations',false,'mail_sent',false,'native_session_proven',false,
  'v1_ready',false,'production_enabled',false);`;
}

function teardownSql(f,run){return `DO $cluvo_native_qa_teardown$
DECLARE v_ctx jsonb;v_a uuid;v_b uuid;v_signature bytea;v_cleanup_hash bytea;v_prior app.idempotency_records%rowtype;
  v_audit app.audit_events%rowtype;v_count integer;v_column record;v_scope_ids uuid[];v_present boolean;
  v_result jsonb:='{"scope":"STAGING_NATIVE_QA_TEARDOWN_V1","qa_scopes_archived":2,"auth_mutations":false,"histories_preserved":true,"v1_ready":false,"production_enabled":false}'::jsonb;
BEGIN
${contextGuard(run)}${schemaGuard()}
  IF NOT EXISTS(SELECT 1 FROM app.idempotency_records WHERE id='${f.qaFixtureCommand}')
    AND NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaFixtureAudit}')
  THEN
    IF EXISTS(SELECT 1 FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])})
      OR slug IN('cluvo-pwa-qa-${run}-a','cluvo-pwa-qa-${run}-b'))
    THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    -- Unknown or partly-created scopes never become an absence receipt. Scan
    -- every application UUID reference, including history, private Auth links,
    -- race IDs, ledger/answer rows and arrays. This branch performs no writes.
    v_scope_ids:=${ids(f,LABELS)}||ARRAY[v_a,v_b];
    FOR v_column IN SELECT n.nspname,c.relname,a.attname,a.atttypid
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      WHERE n.nspname='app' AND c.relkind='r' AND a.atttypid IN('uuid'::regtype,'uuid[]'::regtype)
      ORDER BY c.relname,a.attnum
    LOOP
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I '||
        CASE WHEN v_column.atttypid='uuid'::regtype THEN '=ANY($1)' ELSE '&& $1' END||')',
        v_column.nspname,v_column.relname,v_column.attname) INTO v_present USING v_scope_ids;
      IF v_present THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    END LOOP;
    PERFORM set_config('cluvo.native_qa_cleanup_outcome','absent',true);RETURN;
  END IF;
  SELECT * INTO STRICT v_prior FROM app.idempotency_records WHERE id='${f.qaFixtureCommand}' FOR UPDATE;
  SELECT * INTO STRICT v_audit FROM app.audit_events WHERE id='${f.qaFixtureAudit}';
  IF v_prior.tenant_id IS DISTINCT FROM '${f.tenantA}'::uuid OR v_prior.actor_auth_user_id IS DISTINCT FROM v_a
    OR v_prior.operation<>'staging_native_qa_fixture' OR v_prior.idempotency_key<>'${f.idempotencyQaFixture}'::uuid
    OR v_prior.status<>'completed' OR v_prior.completed_at IS NULL OR octet_length(v_prior.request_hash)<>32
    OR v_audit.tenant_id IS DISTINCT FROM '${f.tenantA}'::uuid OR v_audit.actor_auth_user_id IS DISTINCT FROM v_a
    OR v_audit.action<>'staging.native_qa_fixture_created'
    OR v_audit.payload_minimal->>'source_sha' IS DISTINCT FROM v_ctx->>'source_sha'
    OR v_audit.payload_minimal->>'workflow_run_id' IS DISTINCT FROM v_ctx->>'workflow_run_id'
    OR v_audit.payload_minimal->>'actor' IS DISTINCT FROM v_ctx->>'actor'
    OR v_audit.payload_minimal->'expected_version' IS DISTINCT FROM '0'::jsonb
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
  v_cleanup_hash:=extensions.digest(v_prior.request_hash||convert_to('staging-native-qa-teardown-v1','UTF8'),'sha256');
  PERFORM 1 FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])}) ORDER BY id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM app.idempotency_records WHERE id='${f.qaTeardownCommand}') THEN
${scopeGuard(f,run)}${raceScopeGuard(f)}${scopeSignature(f)}
    IF v_prior.request_hash IS DISTINCT FROM v_signature THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    -- Only the fixed owned rows are revoked/archived. Answers, decisions,
    -- booking claims/events, audits and confirmed ledgers remain historical.
    UPDATE app.account_person_links SET revoked_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['accountLinkA','accountLinkB','accountLinkBForeign'])}) AND revoked_at IS NULL;
    GET DIAGNOSTICS v_count=ROW_COUNT;IF v_count<>3 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    UPDATE app.tenant_memberships SET status='ended',ends_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['membershipA','membershipB','membershipBForeign'])}) AND status='active' AND version=1;
    GET DIAGNOSTICS v_count=ROW_COUNT;IF v_count<>3 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    UPDATE app.access_grants SET revoked_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['memberGrantA','memberGrantB','memberGrantBForeign'])}) AND revoked_at IS NULL AND version=1;
    GET DIAGNOSTICS v_count=ROW_COUNT;IF v_count<>3 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    UPDATE app.household_access_grants SET revoked_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['householdGrantA','householdGrantB','householdGrantBForeign','householdGrantRaceB'])})
      AND tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND revoked_at IS NULL AND version=1;
    UPDATE app.executor_obligation_grants SET revoked_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['executorGrantRaceA','executorGrantRaceB'])}) AND tenant_id='${f.tenantA}' AND revoked_at IS NULL;
    UPDATE app.households SET status='archived',version=version+1,updated_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['householdA','householdB','householdRaceB'])})
      AND tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND status='active' AND version=1;
    UPDATE app.team_person_memberships SET ends_at=clock_timestamp(),version=version+1 WHERE id=ANY(${ids(f,['teamMembershipA','teamMembershipB','teamMembershipBForeign'])}) AND ends_at IS NULL AND version=1;
    GET DIAGNOSTICS v_count=ROW_COUNT;IF v_count<>3 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    UPDATE app.teams SET active=false,version=version+1 WHERE id=ANY(${ids(f,['teamA','teamB'])}) AND active AND version=1;
    GET DIAGNOSTICS v_count=ROW_COUNT;IF v_count<>2 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    UPDATE app.tenants SET status='archived',version=version+1,updated_at=clock_timestamp()
      WHERE id=ANY(${ids(f,['tenantA','tenantB'])}) AND status='active' AND version=1;
    GET DIAGNOSTICS v_count=ROW_COUNT;IF v_count<>2 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    INSERT INTO app.idempotency_records(id,tenant_id,actor_auth_user_id,operation,idempotency_key,request_hash,status,result_jsonb,completed_at)
      VALUES('${f.qaTeardownCommand}','${f.tenantA}',v_a,'staging_native_qa_teardown','${f.idempotencyQaTeardown}',v_cleanup_hash,'completed',v_result,statement_timestamp());
    INSERT INTO app.audit_events(id,tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
      VALUES('${f.qaTeardownAudit}','${f.tenantA}',v_a,'staging.native_qa_scopes_archived','tenant','${f.tenantA}','tenant','${f.tenantA}',
        'SYNTHETIC_STAGING_QA','${f.idempotencyQaTeardown}',jsonb_build_object('source_sha',v_ctx->>'source_sha',
          'workflow_run_id',v_ctx->>'workflow_run_id','actor',v_ctx->>'actor','expected_version',0,'qa_fixture_version',1,
          'tenant_versions_before',1,'tenant_versions_after',2,'provisioning_actor_type','github_workflow','histories_preserved',true));
    PERFORM set_config('cluvo.native_qa_cleanup_outcome','archived',true);
  ELSE
    IF NOT EXISTS(SELECT 1 FROM app.idempotency_records WHERE id='${f.qaTeardownCommand}' AND tenant_id='${f.tenantA}'
      AND actor_auth_user_id=v_a AND operation='staging_native_qa_teardown' AND idempotency_key='${f.idempotencyQaTeardown}'
      AND request_hash=v_cleanup_hash AND status='completed' AND completed_at IS NOT NULL AND result_jsonb=v_result)
      OR NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaTeardownAudit}' AND tenant_id='${f.tenantA}'
        AND actor_auth_user_id=v_a AND action='staging.native_qa_scopes_archived' AND idempotency_key='${f.idempotencyQaTeardown}'
        AND payload_minimal->>'source_sha'=v_ctx->>'source_sha' AND payload_minimal->>'workflow_run_id'=v_ctx->>'workflow_run_id'
        AND payload_minimal->>'actor'=v_ctx->>'actor' AND payload_minimal->'expected_version'='0'::jsonb)
    THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
    PERFORM set_config('cluvo.native_qa_cleanup_outcome','already_archived',true);
  END IF;
  IF (SELECT count(*) FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])}) AND status='archived' AND version=2
    AND branding_json=jsonb_build_object('fixture','${NATIVE_QA_FORMAT}','synthetic',true,'run_id','${run}'))<>2
    OR EXISTS(SELECT 1 FROM app.teams WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND active)
    OR EXISTS(SELECT 1 FROM app.team_person_memberships WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND ends_at IS NULL)
    OR EXISTS(SELECT 1 FROM app.tenant_memberships WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND status='active')
    OR EXISTS(SELECT 1 FROM app.access_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND revoked_at IS NULL)
    OR EXISTS(SELECT 1 FROM app.household_access_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND revoked_at IS NULL)
    OR EXISTS(SELECT 1 FROM app.households WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND status<>'archived')
    OR EXISTS(SELECT 1 FROM app.account_person_links WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND revoked_at IS NULL)
    OR EXISTS(SELECT 1 FROM app.executor_obligation_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND revoked_at IS NULL)
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STAGING_NATIVE_QA_REFUSED';
END $cluvo_native_qa_teardown$;`;
}

function teardownReadback(f){return `SELECT jsonb_build_object('scope','STAGING_NATIVE_QA_TEARDOWN_V1',
  'status',current_setting('cluvo.native_qa_cleanup_outcome'),
  'qa_scopes_archived',(SELECT count(*) FROM app.tenants WHERE id=ANY(${ids(f,['tenantA','tenantB'])}) AND status='archived'),
  'active_qa_memberships',(SELECT count(*) FROM app.tenant_memberships WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND status='active'),
  'active_qa_grants',(SELECT count(*) FROM app.access_grants WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])}) AND revoked_at IS NULL),
  'retained_answer_revisions',(SELECT count(*) FROM app.intake_answers_versions WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])})),
  'retained_bookings',(SELECT count(*) FROM app.bookings WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])})),
  'retained_ledger_entries',(SELECT count(*) FROM app.hour_ledger_entries WHERE tenant_id=ANY(${ids(f,['tenantA','tenantB'])})),
  'teardown_audits',(SELECT count(*) FROM app.audit_events WHERE id='${f.qaTeardownAudit}'),
  'auth_mutations',false,'mail_sent',false,'histories_preserved',true,'native_session_proven',false,
  'v1_ready',false,'production_enabled',false);`;
}

export function buildStagingNativeQaFixture(value){
  const v=fields(value,['providers','sourceSha','workflowRunId','actor','expectedVersion']);
  need(typeof v.sourceSha==='string'&&/^[0-9a-f]{40}$/.test(v.sourceSha)&&validRun(v.workflowRunId)
    &&typeof v.actor==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(v.actor)&&v.expectedVersion===0);
  const f=nativeQaFixtureIds(v.workflowRunId),providers=[];
  try{
    const a=Object.getOwnPropertyDescriptors(v.providers);
    need(Array.isArray(v.providers)&&Reflect.ownKeys(a).length===3&&a.length.value===2
      &&[0,1].every(index=>a[index]&&Object.hasOwn(a[index],'value')));
    for(const [index,slot]of ['a','b'].entries()){
      const p=fields(a[index].value,['id','email','appMetadata']);
      need(validUuid(p.id)&&!Object.values(f).includes(p.id)&&p.email===nativeQaProviderEmail(v.workflowRunId,slot));
      const expected=nativeQaProviderMetadata({sourceSha:v.sourceSha,workflowRunId:v.workflowRunId,actor:v.actor,slot});
      const metadata=fields(p.appMetadata,[...Object.keys(expected),'provider','providers']);
      need(Object.keys(expected).every(key=>metadata[key]===expected[key])&&metadata.provider==='email');
      const providerNames=Object.getOwnPropertyDescriptors(metadata.providers);
      need(Array.isArray(metadata.providers)&&Reflect.ownKeys(providerNames).length===2&&providerNames.length.value===1
        &&Object.hasOwn(providerNames[0],'value')&&providerNames[0].value==='email');
      providers.push({slot,id:p.id,email:p.email});
    }
  }catch{throw new NativeQaFixtureError();}
  need(providers[0].id!==providers[1].id);
  return Object.freeze({contextSql:CONTEXT_SQL,parameters:Object.freeze([JSON.stringify(providers),v.sourceSha,v.workflowRunId,v.actor]),
    mutationSql:setupSql(f,v.workflowRunId),readbackSql:setupReadback(f),
    teardownSql:teardownSql(f,v.workflowRunId),teardownReadbackSql:teardownReadback(f)});
}

// Used only before a rollback-only automation proof. The same closed native
// scope/provider/source checks protect its fixed synthetic tenant and rows.
export function nativeQaOwnedScopeGuardSql(value){
  const fixture=buildStagingNativeQaFixture(value),run=fixture.parameters[2];
  const f=nativeQaFixtureIds(run);
  return `DO $cluvo_owned_automation_scope$ DECLARE v_ctx jsonb;v_a uuid;v_b uuid;BEGIN
${contextGuard(run)}${schemaGuard()}${providerGuard()}${scopeGuard(f,run)}${raceScopeGuard(f)}
 IF NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaFixtureAudit}'AND tenant_id='${f.tenantA}'AND actor_auth_user_id=v_a
 AND payload_minimal->>'source_sha'=v_ctx->>'source_sha'AND payload_minimal->>'workflow_run_id'=v_ctx->>'workflow_run_id'
 AND payload_minimal->>'actor'=v_ctx->>'actor'AND payload_minimal->'expected_version'='0'::jsonb)
 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_REFUSED';END IF;
END $cluvo_owned_automation_scope$;`;
}
