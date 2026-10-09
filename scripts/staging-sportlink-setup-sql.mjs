// Fixed operational staging scope. Imports are pure: no connection, Auth call,
// credential input or general tenant/permission administration route.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {nativeQaSchemaGuardSql} from './staging-pwa-native-qa-fixture.mjs';
import {UPGRADE_FILES} from './staging-pwa-upgrade-migrations.mjs';

export const SPORTLINK_SETUP_FORMAT='cluvo-staging-sportlink-setup-v1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const identity=label=>{
 const bytes=createHash('sha256').update(SPORTLINK_SETUP_FORMAT+':'+label).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.toString('hex');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
};
export const SPORTLINK_SETUP_SCOPE=Object.freeze({
 ...Object.fromEntries(['tenant','person','accountLink','membership','role','permission','grant','audit','event','idempotencyRecord','idempotencyKey','connection','configureKey'].map(k=>[k,identity(k)])),
 slug:'duindorp-sv-staging',roleKey:'sportlink_staging_operator',name:'Duindorp SV',
});
const f=SPORTLINK_SETUP_SCOPE;
const need=(value,code='STAGING_SPORTLINK_SETUP_INPUT_INVALID')=>{if(!value)throw Object.assign(Error(code),{code});};
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
function fields(value,names){
 try{
  need(value&&[Object.prototype,null].includes(Object.getPrototypeOf(value)));
  const descriptors=Object.getOwnPropertyDescriptors(value);
  need(Reflect.ownKeys(descriptors).length===names.length&&names.every(k=>descriptors[k]&&Object.hasOwn(descriptors[k],'value')));
  return Object.fromEntries(names.map(k=>[k,descriptors[k].value]));
 }catch{throw Object.assign(Error('STAGING_SPORTLINK_SETUP_INPUT_INVALID'),{code:'STAGING_SPORTLINK_SETUP_INPUT_INVALID'});}
}
export function sportlinkSetupSchemaGuardSql(){
 need(UPGRADE_FILES.length===35&&UPGRADE_FILES.at(-1).file==='20261009118000_pwa_sportlink_connection.sql','STAGING_SPORTLINK_SETUP_SCHEMA_REQUIRED');
 // Reuse only the frozen pure byte-history/native-RLS guard. No QA identity,
 // fixture, provider factory, password, session or cleanup route is used.
 return nativeQaSchemaGuardSql().replaceAll('STAGING_NATIVE_QA_REFUSED','STAGING_SPORTLINK_SETUP_SCHEMA_REFUSED')+`
DO $sportlink_setup_inventory$ BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r')<>181
 THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_SCHEMA_REFUSED';END IF;
END $sportlink_setup_inventory$;`;
}
const CONTEXT_SQL=`SELECT set_config('cluvo.sportlink_setup_context',jsonb_build_object(
 'format','${SPORTLINK_SETUP_FORMAT}','scope','staging','project_ref','fbozlbgmktkgcdfqdaaz',
 'recipient',lower($1::text),'source_sha',$2::text,'workflow_run_id',$3::text,'actor',$4::text,
 'expected_version',0,'setup_version',1)::text,true) IS NOT NULL;`;
const MUTATION_SQL=`DO $sportlink_setup$
DECLARE v_ctx jsonb;v_uid uuid;v_created boolean:=false;v_hash bytea;v_prior app.idempotency_records%rowtype;v_audit app.audit_events%rowtype;
 v_result jsonb:='{"scope":"STAGING_SPORTLINK_OPERATOR_SCOPE_V1","setup_version":1,"expected_version":0,"version":1,"permission_count":1,"native_session_claimed":false,"production_enabled":false}'::jsonb;
BEGIN
 v_ctx:=nullif(current_setting('cluvo.sportlink_setup_context',true),'')::jsonb;
 IF jsonb_typeof(v_ctx) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v_ctx))<>9
 OR v_ctx->>'format' IS DISTINCT FROM '${SPORTLINK_SETUP_FORMAT}' OR v_ctx->>'scope' IS DISTINCT FROM 'staging'
 OR v_ctx->>'project_ref' IS DISTINCT FROM 'fbozlbgmktkgcdfqdaaz' OR v_ctx->'expected_version' IS DISTINCT FROM '0'::jsonb
 OR v_ctx->'setup_version' IS DISTINCT FROM '1'::jsonb OR length(v_ctx->>'recipient')>254
 OR coalesce(v_ctx->>'recipient','')!~'^[A-Za-z0-9.!#$%&+/?^_{|}~-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,63}$'
 OR coalesce(v_ctx->>'source_sha','')!~'^[0-9a-f]{40}$' OR coalesce(v_ctx->>'workflow_run_id','')!~'^[1-9][0-9]{0,19}$'
 OR coalesce(v_ctx->>'actor','')!~'^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
 THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_REFUSED';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('${SPORTLINK_SETUP_FORMAT}',0));
 IF (SELECT count(*) FROM auth.users WHERE lower(email)=v_ctx->>'recipient' AND email_confirmed_at IS NOT NULL
  AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=statement_timestamp()))<>1
 THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_REFUSED';END IF;
 SELECT id INTO STRICT v_uid FROM auth.users WHERE lower(email)=v_ctx->>'recipient' AND email_confirmed_at IS NOT NULL
  AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=statement_timestamp()) FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM app.permissions WHERE permission_key='match.import')
 THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_REFUSED';END IF;
 PERFORM 1 FROM app.tenants WHERE id='${f.tenant}' OR slug='${f.slug}' ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM app.tenants WHERE id='${f.tenant}' OR slug='${f.slug}') THEN
  IF EXISTS(SELECT 1 FROM app.persons WHERE id='${f.person}') OR EXISTS(SELECT 1 FROM app.account_person_links WHERE id='${f.accountLink}')
  OR EXISTS(SELECT 1 FROM app.tenant_memberships WHERE id='${f.membership}') OR EXISTS(SELECT 1 FROM app.permission_roles WHERE id='${f.role}')
  OR EXISTS(SELECT 1 FROM app.role_permissions WHERE id='${f.permission}') OR EXISTS(SELECT 1 FROM app.access_grants WHERE id='${f.grant}')
  OR EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.audit}') OR EXISTS(SELECT 1 FROM app.domain_events WHERE id='${f.event}')
  OR EXISTS(SELECT 1 FROM app.idempotency_records WHERE id='${f.idempotencyRecord}')
  THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_REFUSED';END IF;
  INSERT INTO app.tenants(id,slug,name,status,branding_json) VALUES('${f.tenant}','${f.slug}','${f.name}','active',
   '{"synthetic":true,"provisioning":"${SPORTLINK_SETUP_FORMAT}","version":1}'::jsonb);
  INSERT INTO app.persons(id,tenant_id,given_name,family_name,status) VALUES('${f.person}','${f.tenant}','Staging','Sportlink beheer','active');
  INSERT INTO app.account_person_links(id,tenant_id,auth_user_id,person_id,verified_at)
   VALUES('${f.accountLink}','${f.tenant}',v_uid,'${f.person}',statement_timestamp());
  INSERT INTO app.tenant_memberships(id,tenant_id,auth_user_id,status) VALUES('${f.membership}','${f.tenant}',v_uid,'active');
  INSERT INTO app.permission_roles(id,tenant_id,role_key,name,description,system_role)
   VALUES('${f.role}','${f.tenant}','${f.roleKey}','Sportlink beheer','Expliciete stagingbevoegdheid voor de Sportlink-koppeling van deze vereniging',false);
  INSERT INTO app.role_permissions(id,tenant_id,role_id,permission_key) VALUES('${f.permission}','${f.tenant}','${f.role}','match.import');
  INSERT INTO app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,starts_at,ends_at,granted_by_auth_user_id)
   VALUES('${f.grant}','${f.tenant}',v_uid,'${f.role}','tenant',statement_timestamp(),statement_timestamp()+interval '1 year',v_uid);
  v_created:=true;
 END IF;
 PERFORM 1 FROM app.persons WHERE tenant_id='${f.tenant}' ORDER BY id FOR UPDATE;
 PERFORM 1 FROM app.account_person_links WHERE tenant_id='${f.tenant}' ORDER BY id FOR UPDATE;
 PERFORM 1 FROM app.tenant_memberships WHERE tenant_id='${f.tenant}' ORDER BY id FOR UPDATE;
 PERFORM 1 FROM app.permission_roles WHERE id='${f.role}' FOR UPDATE;
 PERFORM 1 FROM app.role_permissions WHERE role_id='${f.role}' ORDER BY id FOR UPDATE;
 PERFORM 1 FROM app.access_grants WHERE tenant_id='${f.tenant}' ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM app.tenants WHERE id='${f.tenant}' OR slug='${f.slug}')<>1
 OR NOT EXISTS(SELECT 1 FROM app.tenants WHERE id='${f.tenant}' AND slug='${f.slug}' AND name='${f.name}' AND status='active' AND version=1
  AND timezone='Europe/Amsterdam' AND locale='nl-NL' AND branding_json='{"synthetic":true,"provisioning":"${SPORTLINK_SETUP_FORMAT}","version":1}'::jsonb)
 OR (SELECT count(*) FROM app.persons WHERE tenant_id='${f.tenant}')<>1
 OR NOT EXISTS(SELECT 1 FROM app.persons WHERE id='${f.person}' AND tenant_id='${f.tenant}' AND given_name='Staging' AND family_name='Sportlink beheer'
  AND status='active' AND version=1 AND birth_date IS NULL AND birth_date_precision='unknown' AND membership_started_on IS NULL)
 OR (SELECT count(*) FROM app.account_person_links WHERE tenant_id='${f.tenant}')<>1
 OR NOT EXISTS(SELECT 1 FROM app.account_person_links WHERE id='${f.accountLink}' AND tenant_id='${f.tenant}' AND auth_user_id=v_uid
  AND person_id='${f.person}' AND relationship='self' AND verified_at IS NOT NULL AND revoked_at IS NULL)
 OR (SELECT count(*) FROM app.tenant_memberships WHERE tenant_id='${f.tenant}')<>1
 OR NOT EXISTS(SELECT 1 FROM app.tenant_memberships WHERE id='${f.membership}' AND tenant_id='${f.tenant}' AND auth_user_id=v_uid
  AND status='active' AND starts_at<=statement_timestamp() AND ends_at IS NULL AND version=1)
 OR NOT EXISTS(SELECT 1 FROM app.permission_roles WHERE id='${f.role}' AND tenant_id='${f.tenant}' AND role_key='${f.roleKey}'
  AND name='Sportlink beheer' AND description='Expliciete stagingbevoegdheid voor de Sportlink-koppeling van deze vereniging' AND NOT system_role AND version=1)
 OR (SELECT array_agg(permission_key ORDER BY permission_key) FROM app.role_permissions WHERE role_id='${f.role}' AND tenant_id='${f.tenant}')
  IS DISTINCT FROM ARRAY['match.import']::text[]
 OR NOT EXISTS(SELECT 1 FROM app.role_permissions WHERE id='${f.permission}' AND tenant_id='${f.tenant}' AND role_id='${f.role}' AND permission_key='match.import')
 OR (SELECT count(*) FROM app.access_grants WHERE tenant_id='${f.tenant}')<>1
 OR NOT EXISTS(SELECT 1 FROM app.access_grants WHERE id='${f.grant}' AND tenant_id='${f.tenant}' AND auth_user_id=v_uid AND role_id='${f.role}'
  AND scope_kind='tenant' AND num_nonnulls(committee_id,team_id,household_id)=0 AND starts_at<=statement_timestamp()
  AND ends_at=starts_at+interval '1 year' AND ends_at>statement_timestamp() AND revoked_at IS NULL AND renewed_at IS NULL
  AND granted_by_auth_user_id=v_uid AND version=1)
 THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_REFUSED';END IF;
 SELECT sha256(convert_to(jsonb_build_object('format','${SPORTLINK_SETUP_FORMAT}','beneficiary',v_uid,
  'tenant',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.tenants t WHERE id='${f.tenant}'),
  'person',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.persons t WHERE id='${f.person}'),
  'account_link',(SELECT to_jsonb(t)-'created_at' FROM app.account_person_links t WHERE id='${f.accountLink}'),
  'membership',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.tenant_memberships t WHERE id='${f.membership}'),
  'role',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.permission_roles t WHERE id='${f.role}'),
  'permission',(SELECT to_jsonb(t)-'created_at' FROM app.role_permissions t WHERE id='${f.permission}'),
  'grant',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.access_grants t WHERE id='${f.grant}')
 )::text,'UTF8')) INTO v_hash;
 IF v_created THEN
  INSERT INTO app.idempotency_records(id,tenant_id,actor_auth_user_id,operation,idempotency_key,request_hash,status,result_jsonb,completed_at)
   VALUES('${f.idempotencyRecord}','${f.tenant}',v_uid,'staging_sportlink_operator_setup_v1','${f.idempotencyKey}',v_hash,'completed',v_result,statement_timestamp());
  INSERT INTO app.audit_events(id,tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
   VALUES('${f.audit}','${f.tenant}',v_uid,'staging.sportlink_operator_scope_created','tenant','${f.tenant}','tenant','${f.tenant}',
    'AUTHORIZED_STAGING_SETUP','${f.idempotencyKey}',jsonb_build_object('setup_version',1,'expected_version',0,'version',1,'authorization','USER_REQUEST',
    'provisioning_actor_type','github_workflow','provisioning_actor',v_ctx->>'actor','source_sha',v_ctx->>'source_sha','workflow_run_id',v_ctx->>'workflow_run_id',
    'beneficiary_auth_user_used_as_fk',true,'native_session_claimed',false));
  INSERT INTO app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)
   VALUES('${f.event}','${f.tenant}','tenant','${f.tenant}',1,'staging.sportlink_operator_scope_created',
    '{"setup_version":1,"expected_version":0,"permission_count":1,"synthetic_person":true}'::jsonb);
 ELSE
  SELECT * INTO STRICT v_prior FROM app.idempotency_records WHERE id='${f.idempotencyRecord}' FOR UPDATE;
  SELECT * INTO STRICT v_audit FROM app.audit_events WHERE id='${f.audit}';
  IF v_prior.tenant_id IS DISTINCT FROM '${f.tenant}'::uuid OR v_prior.actor_auth_user_id IS DISTINCT FROM v_uid
  OR v_prior.operation<>'staging_sportlink_operator_setup_v1' OR v_prior.idempotency_key IS DISTINCT FROM '${f.idempotencyKey}'::uuid
  OR v_prior.request_hash IS DISTINCT FROM v_hash OR v_prior.status<>'completed' OR v_prior.completed_at IS NULL OR v_prior.result_jsonb IS DISTINCT FROM v_result
  OR v_audit.tenant_id IS DISTINCT FROM '${f.tenant}'::uuid OR v_audit.actor_auth_user_id IS DISTINCT FROM v_uid
  OR v_audit.action<>'staging.sportlink_operator_scope_created' OR v_audit.resource_type<>'tenant' OR v_audit.resource_id IS DISTINCT FROM '${f.tenant}'::uuid
  OR v_audit.scope_kind IS DISTINCT FROM 'tenant' OR v_audit.scope_id IS DISTINCT FROM '${f.tenant}'::uuid OR v_audit.reason_code<>'AUTHORIZED_STAGING_SETUP'
  OR v_audit.idempotency_key IS DISTINCT FROM '${f.idempotencyKey}'::uuid OR v_audit.represented_person_id IS NOT NULL
  OR (SELECT count(*) FROM jsonb_object_keys(v_audit.payload_minimal))<>10
  OR v_audit.payload_minimal->'setup_version' IS DISTINCT FROM '1'::jsonb OR v_audit.payload_minimal->'expected_version' IS DISTINCT FROM '0'::jsonb
  OR v_audit.payload_minimal->'version' IS DISTINCT FROM '1'::jsonb OR v_audit.payload_minimal->>'authorization' IS DISTINCT FROM 'USER_REQUEST'
  OR v_audit.payload_minimal->>'provisioning_actor_type' IS DISTINCT FROM 'github_workflow'
  OR v_audit.payload_minimal->'beneficiary_auth_user_used_as_fk' IS DISTINCT FROM 'true'::jsonb OR v_audit.payload_minimal->'native_session_claimed' IS DISTINCT FROM 'false'::jsonb
  OR coalesce(v_audit.payload_minimal->>'source_sha','')!~'^[0-9a-f]{40}$' OR coalesce(v_audit.payload_minimal->>'workflow_run_id','')!~'^[1-9][0-9]{0,19}$'
  OR coalesce(v_audit.payload_minimal->>'provisioning_actor','')!~'^[A-Za-z0-9][A-Za-z0-9_.\\[\\]-]{0,63}$'
  OR NOT EXISTS(SELECT 1 FROM app.domain_events WHERE id='${f.event}' AND tenant_id='${f.tenant}' AND aggregate_type='tenant'
   AND aggregate_id='${f.tenant}' AND aggregate_version=1 AND event_type='staging.sportlink_operator_scope_created'
   AND payload_minimal='{"setup_version":1,"expected_version":0,"permission_count":1,"synthetic_person":true}'::jsonb)
  THEN RAISE EXCEPTION 'STAGING_SPORTLINK_SETUP_REFUSED';END IF;
 END IF;
 PERFORM set_config('cluvo.sportlink_setup_outcome',CASE WHEN v_created THEN 'created' ELSE 'already_configured' END,true);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STAGING_SPORTLINK_SETUP_REFUSED';
END $sportlink_setup$;`;
const READBACK_SQL=`SELECT jsonb_build_object('scope','STAGING_SPORTLINK_OPERATOR_SCOPE_V1','outcome',current_setting('cluvo.sportlink_setup_outcome'),
 'tenant_id','${f.tenant}','tenant_slug','${f.slug}','person_id','${f.person}',
 'auth_user_id',(SELECT auth_user_id FROM app.tenant_memberships WHERE id='${f.membership}'),
 'permission_count',(SELECT count(*) FROM app.role_permissions WHERE role_id='${f.role}'),
 'provisioning_audits',(SELECT count(*) FROM app.audit_events WHERE id='${f.audit}'),
 'provisioning_events',(SELECT count(*) FROM app.domain_events WHERE id='${f.event}'),
 'provisioning_commands',(SELECT count(*) FROM app.idempotency_records WHERE id='${f.idempotencyRecord}'));`;
export function buildStagingSportlinkSetup(value){
 const v=fields(value,['recipient','sourceSha','workflowRunId','actor','expectedVersion']);
 need(typeof v.recipient==='string'&&v.recipient.length<=254&&/^[A-Za-z0-9.!#$%&+/?^_{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(v.recipient));
 need(typeof v.sourceSha==='string'&&typeof v.workflowRunId==='string'&&typeof v.actor==='string'
  &&/^[0-9a-f]{40}$/.test(v.sourceSha)&&/^[1-9][0-9]{0,19}$/.test(v.workflowRunId)
  &&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(v.actor)&&v.expectedVersion===0);
 return Object.freeze({guardSql:sportlinkSetupSchemaGuardSql(),contextSql:CONTEXT_SQL,
  parameters:Object.freeze([v.recipient.toLowerCase(),v.sourceSha,v.workflowRunId,v.actor]),mutationSql:MUTATION_SQL,readbackSql:READBACK_SQL});
}
export function sportlinkSetupSessionSql(authUserId,sessionId){
 need(UUID.test(authUserId??'')&&UUID.test(sessionId??''));
 return `SELECT jsonb_build_object('identity_confirmed',EXISTS(SELECT 1 FROM auth.users WHERE id=${literal(authUserId)} AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=statement_timestamp())),
 'new_session_active',EXISTS(SELECT 1 FROM auth.sessions WHERE id=${literal(sessionId)} AND user_id=${literal(authUserId)} AND (not_after IS NULL OR not_after>statement_timestamp())),
 'exact_scope',EXISTS(SELECT 1 FROM app.tenant_memberships WHERE id='${f.membership}' AND tenant_id='${f.tenant}' AND auth_user_id=${literal(authUserId)} AND status='active')));`;
}
export function sportlinkSetupReadbackSql(authUserId,sessionId){
 need(UUID.test(authUserId??'')&&UUID.test(sessionId??''));
 return `SELECT jsonb_build_object('connection_count',(SELECT count(*) FROM app.integration_connections WHERE tenant_id='${f.tenant}'),
 'configured',EXISTS(SELECT 1 FROM app.integration_connections c JOIN app.sportlink_connection_credentials s ON s.tenant_id=c.tenant_id AND s.connection_id=c.id
 WHERE c.tenant_id='${f.tenant}' AND c.provider='sportlink' AND c.connection_key='cluvo-sportlink-dataservice-v1' AND c.status='preparing'
 AND c.credential_reference='server-envelope:v1' AND c.last_success_at IS NULL AND c.version>=1 AND jsonb_typeof(s.credential_envelope)='object'),
 'test_code',(SELECT s.last_test->'receipt'->>'code' FROM app.sportlink_connection_credentials s JOIN app.integration_connections c ON c.tenant_id=s.tenant_id AND c.id=s.connection_id WHERE c.tenant_id='${f.tenant}' AND c.connection_key='cluvo-sportlink-dataservice-v1'),
 'native_audit_actor',NOT EXISTS(SELECT 1 FROM app.audit_events WHERE tenant_id='${f.tenant}' AND action IN('integration.sportlink_configured','integration.sportlink_read_test_recorded') AND actor_auth_user_id<>${literal(authUserId)}),
 'native_save_audits',(SELECT count(*) FROM app.audit_events WHERE tenant_id='${f.tenant}' AND action='integration.sportlink_configured'),
 'native_test_audits',(SELECT count(*) FROM app.audit_events WHERE tenant_id='${f.tenant}' AND action='integration.sportlink_read_test_recorded'),
 'new_session_absent',NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=${literal(sessionId)} AND user_id=${literal(authUserId)} AND (not_after IS NULL OR not_after>statement_timestamp())));`;
}
export function sportlinkSetupStableAccountSql(authUserId){
 need(typeof authUserId==='string'&&UUID.test(authUserId));
 return `SELECT jsonb_build_object('account',encode(sha256(convert_to((SELECT jsonb_build_object(
 'id',u.id,'email',u.email,'password',u.encrypted_password,'confirmed',u.email_confirmed_at,'deleted',u.deleted_at,'banned',u.banned_until,
 'app_metadata',u.raw_app_meta_data,'user_metadata',u.raw_user_meta_data,
 'profile',(SELECT to_jsonb(p) FROM app.account_profiles p WHERE p.auth_user_id=u.id),
 'other_grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.id) FROM app.access_grants g WHERE g.auth_user_id=u.id AND g.tenant_id<>'${f.tenant}'))
 FROM auth.users u WHERE u.id=${literal(authUserId)})::text,'UTF8')),'hex'),
 'sessions',coalesce((SELECT jsonb_agg(jsonb_build_array(s.id::text,s.not_after::text) ORDER BY s.id) FROM auth.sessions s WHERE s.user_id=${literal(authUserId)}),'[]'::jsonb));`;
}
export function sportlinkSetupPrivateRecipe(value){
 const v=fields(value,['operation','recipient','sourceSha','workflowRunId','actor','authUserId','sessionId']);
 need(['preflight','provision','session','readback','stable'].includes(v.operation));
 const setup=buildStagingSportlinkSetup({recipient:v.recipient,sourceSha:v.sourceSha,workflowRunId:v.workflowRunId,actor:v.actor,expectedVersion:0});
 if(['preflight','provision'].includes(v.operation)){
  need(v.authUserId===null&&v.sessionId===null);
  return v.operation==='provision'?setup:{sql:`BEGIN READ WRITE;${setup.guardSql}SELECT jsonb_build_object('schema35',true);COMMIT;`};
 }
 if(v.operation==='stable'){need(v.sessionId===null);return {sql:sportlinkSetupStableAccountSql(v.authUserId)};}
 return {sql:v.operation==='session'?sportlinkSetupSessionSql(v.authUserId,v.sessionId):sportlinkSetupReadbackSql(v.authUserId,v.sessionId)};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  need(process.argv.length===3&&process.argv[2]==='--private-fixed-sportlink-setup-sql');
  const raw=await readFile('/dev/stdin');need(raw.length>0&&raw.length<=16384);
  const value=sportlinkSetupPrivateRecipe(JSON.parse(raw.toString('utf8')));raw.fill(0);process.stdout.write(JSON.stringify(value));
 }catch{process.exitCode=1;}
}
