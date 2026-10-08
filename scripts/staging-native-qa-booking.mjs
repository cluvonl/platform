// Fixed additive staging QA fixtures and private native RPC/readback components.
// This pure module owns no Auth factory, token, connection, execution or cleanup.
import {nativeQaFixtureIds} from './staging-native-qa-fixture.mjs';
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from './staging-initial-migrations.mjs';

export class NativeQaBookingError extends Error {constructor(code){super(code);this.code=code;}}
const need=(value,code='STAGING_NATIVE_QA_BOOKING_INPUT_INVALID')=>{if(!value)throw new NativeQaBookingError(code);};
const literal=value=>"'"+value.replaceAll("'","''")+"'";
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
function array(input,length,code){
 try{
  need(Array.isArray(input)&&input.length===length,code);
  return Array.from({length},(_,index)=>{const field=Object.getOwnPropertyDescriptor(input,String(index));need(field&&Object.hasOwn(field,'value'),code);return field.value;});
 }catch(error){if(error instanceof NativeQaBookingError)throw error;throw new NativeQaBookingError(code);}
}
function record(input,keys){
 try{
  need(input&&typeof input==='object'&&!Array.isArray(input));
  const descriptors=Object.getOwnPropertyDescriptors(input),names=Reflect.ownKeys(descriptors);
  need(names.length===keys.length&&keys.every(key=>descriptors[key]&&Object.hasOwn(descriptors[key],'value')));
  return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
 }catch(error){if(error instanceof NativeQaBookingError)throw error;throw new NativeQaBookingError('STAGING_NATIVE_QA_BOOKING_INPUT_INVALID');}
}
const readyGuard=`IF current_database()<>'postgres' OR current_user<>'postgres' OR pg_is_in_recovery()
OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND mode='ExclusiveLock' AND granted
 AND classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid AND objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid AND objsubid=2)
THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;`;

export function nativeQaBookingRpc(workflowRunId,contender){
 need(contender==='A'||contender==='B');const f=nativeQaFixtureIds(workflowRunId);
 return Object.freeze({p_tenant_id:f.tenantA,p_shift_id:f.shiftRace,p_position_id:f.positionRace,
  p_executor_person_id:contender==='A'?f.personA:f.personB,p_obligation_id:contender==='A'?f.obligationA:f.obligationB,
  p_expected_shift_version:1,p_idempotency_key:contender==='A'?f.idempotencyRaceA:f.idempotencyRaceB});
}

export function buildStagingNativeQaBooking(input){
 const value=record(input,['actorA','actorB','sourceSha','workflowRunId','actor','expectedVersion']);
 need(uuid(value.actorA)&&uuid(value.actorB)&&value.actorA!==value.actorB&&typeof value.sourceSha==='string'&&/^[0-9a-f]{40}$/.test(value.sourceSha)&&
  typeof value.workflowRunId==='string'&&/^[1-9][0-9]{0,19}$/.test(value.workflowRunId)&&
  typeof value.actor==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(value.actor)&&value.expectedVersion===0);
 const f=nativeQaFixtureIds(value.workflowRunId),run=literal(value.workflowRunId),source=literal(value.sourceSha),actor=literal(value.actor);
 const signatureSql=`SELECT extensions.digest(convert_to(jsonb_build_object('context',v_context,
 'household',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.households t WHERE id='${f.householdRaceB}'),
 'household_person',(SELECT to_jsonb(t)-'created_at' FROM app.household_person_links t WHERE id='${f.householdPersonRaceB}'),
 'household_grant',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.household_access_grants t WHERE id='${f.householdGrantRaceB}'),
 'season',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.seasons t WHERE id='${f.seasonA}'),
 'obligations',(SELECT jsonb_agg(to_jsonb(t)-'created_at'-'updated_at' ORDER BY id) FROM app.obligations t WHERE id IN('${f.obligationA}','${f.obligationB}')),
 'obligation_links',(SELECT jsonb_agg(to_jsonb(t)-'created_at' ORDER BY id) FROM app.household_obligation_links t WHERE id IN('${f.householdObligationRaceA}','${f.householdObligationRaceB}')),
 'executor_grants',(SELECT jsonb_agg(to_jsonb(t)-'created_at' ORDER BY id) FROM app.executor_obligation_grants t WHERE id IN('${f.executorGrantRaceA}','${f.executorGrantRaceB}')),
 'committee',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.committees t WHERE id='${f.committeeRace}'),
 'category',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.task_categories t WHERE id='${f.categoryRace}'),
 'type',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.task_types t WHERE id='${f.taskTypeRace}'),
 'type_version',(SELECT to_jsonb(t)-'created_at' FROM app.task_type_versions t WHERE id='${f.taskVersionRace}'),
 'shift',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.shifts t WHERE id='${f.shiftRace}'),
 'position',(SELECT to_jsonb(t)-'created_at'-'updated_at' FROM app.shift_positions t WHERE id='${f.positionRace}'))::text,'UTF8'),'sha256') INTO v_signature;`;
 const contextSql=`SELECT pg_catalog.set_config('cluvo.native_qa_booking_context',
 pg_catalog.jsonb_build_object('format','cluvo-native-qa-booking-v1','scope','staging','project_ref','fbozlbgmktkgcdfqdaaz',
 'actors',$1::jsonb,'source_sha',$2::text,'workflow_run_id',$3::text,'actor',$4::text,'expected_version',0)::text,true) IS NOT NULL AS configured;`;
 const mutationSql=`DO $cluvo_native_qa_booking$
DECLARE v_context jsonb; v_a uuid; v_b uuid; v_signature bytea; v_start timestamptz; v_end timestamptz;
BEGIN
 ${readyGuard}
 v_context:=nullif(current_setting('cluvo.native_qa_booking_context',true),'')::jsonb;
 IF jsonb_typeof(v_context) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v_context))<>8
 OR v_context->>'format' IS DISTINCT FROM 'cluvo-native-qa-booking-v1' OR v_context->>'scope' IS DISTINCT FROM 'staging'
 OR v_context->>'project_ref' IS DISTINCT FROM 'fbozlbgmktkgcdfqdaaz' OR v_context->>'source_sha' IS DISTINCT FROM ${source}
 OR v_context->>'workflow_run_id' IS DISTINCT FROM ${run} OR v_context->>'actor' IS DISTINCT FROM ${actor}
 OR v_context->>'expected_version' IS DISTINCT FROM '0' OR jsonb_typeof(v_context->'actors') IS DISTINCT FROM 'object'
 OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v_context->'actors') key) IS DISTINCT FROM ARRAY['actorA','actorB']::text[]
 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;
 v_a:=(v_context->'actors'->>'actorA')::uuid; v_b:=(v_context->'actors'->>'actorB')::uuid;
 IF v_a IS NULL OR v_b IS NULL OR v_a=v_b THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaFixtureAudit}' AND tenant_id='${f.tenantA}' AND actor_auth_user_id=v_a
 AND payload_minimal->>'source_sha'=${source} AND payload_minimal->>'workflow_run_id'=${run}
 AND payload_minimal->>'actor'=${actor} AND payload_minimal->>'expected_version'='0' AND payload_minimal->>'qa_fixture_version'='1')
 OR (SELECT count(*) FROM auth.users u WHERE u.id IN(v_a,v_b) AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp()) AND u.raw_app_meta_data->>'cluvo_qa_fixture'='cluvo-native-qa-fixture-v1'
 AND u.raw_app_meta_data->>'cluvo_qa_run_id'=${run} AND u.raw_app_meta_data->>'cluvo_qa_source_sha'=${source}
 AND EXISTS(SELECT 1 FROM auth.sessions s WHERE s.user_id=u.id AND (s.not_after IS NULL OR s.not_after>statement_timestamp())))<>2
 OR (SELECT count(*) FROM app.persons p JOIN app.account_person_links l ON l.tenant_id=p.tenant_id AND l.person_id=p.id AND l.revoked_at IS NULL
 JOIN app.tenant_memberships m ON m.tenant_id=p.tenant_id AND m.auth_user_id=l.auth_user_id AND m.status='active' AND m.starts_at<=statement_timestamp()
 AND (m.ends_at IS NULL OR m.ends_at>statement_timestamp()) WHERE p.tenant_id='${f.tenantA}' AND p.status='active'
 AND ((p.id='${f.personA}' AND l.auth_user_id=v_a) OR (p.id='${f.personB}' AND l.auth_user_id=v_b)))<>2
 OR (SELECT count(*) FROM app.access_grants g JOIN app.permission_roles r ON r.tenant_id=g.tenant_id AND r.id=g.role_id
 WHERE g.tenant_id='${f.tenantA}' AND g.auth_user_id IN(v_a,v_b) AND r.role_key='member' AND g.scope_kind='tenant'
 AND g.revoked_at IS NULL AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR g.ends_at>statement_timestamp())
 AND EXISTS(SELECT 1 FROM app.role_permissions p WHERE p.tenant_id=r.tenant_id AND p.role_id=r.id AND p.permission_key='shift.book'))<>2
 OR NOT EXISTS(SELECT 1 FROM app.tenants WHERE id='${f.tenantA}' AND status='active')
 OR NOT EXISTS(SELECT 1 FROM app.households WHERE tenant_id='${f.tenantA}' AND id='${f.householdA}' AND status='active')
 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;
 IF EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaBookingAudit}') THEN
  ${signatureSql}
  IF NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaBookingAudit}' AND tenant_id='${f.tenantA}' AND actor_auth_user_id=v_a
  AND action='qa.booking_fixture_created' AND resource_id='${f.shiftRace}' AND payload_minimal->>'signature'=encode(v_signature,'hex'))
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM app.households WHERE id='${f.householdRaceB}') OR EXISTS(SELECT 1 FROM app.seasons WHERE id='${f.seasonA}')
  OR EXISTS(SELECT 1 FROM app.obligations WHERE id IN('${f.obligationA}','${f.obligationB}'))
  OR EXISTS(SELECT 1 FROM app.shifts WHERE id='${f.shiftRace}') OR EXISTS(SELECT 1 FROM app.shift_positions WHERE id='${f.positionRace}')
  THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;
  v_start:=date_trunc('minute',statement_timestamp())+interval '7 days'; v_end:=v_start+interval '120 minutes';
  INSERT INTO app.households(id,tenant_id,label,intake_code_hash,status)
   VALUES('${f.householdRaceB}','${f.tenantA}','Cluvo QA race B',extensions.gen_random_bytes(32),'active');
  INSERT INTO app.household_person_links(id,tenant_id,household_id,person_id,kind,verified_by_auth_user_id)
   VALUES('${f.householdPersonRaceB}','${f.tenantA}','${f.householdRaceB}','${f.personB}','executor',v_b);
  INSERT INTO app.household_access_grants(id,tenant_id,household_id,auth_user_id,can_view_progress,granted_by_auth_user_id)
   VALUES('${f.householdGrantRaceB}','${f.tenantA}','${f.householdRaceB}',v_b,true,v_b);
  INSERT INTO app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,target_minutes,winter_target_minutes,status)
   VALUES('${f.seasonA}','${f.tenantA}','Cluvo QA race',current_date-1,current_date+60,statement_timestamp()+interval '30 days',720,360,'active');
  INSERT INTO app.obligations(id,tenant_id,season_id,assessed_household_id,base_target_minutes,effective_target_minutes,effective_winter_minutes,status)
   VALUES('${f.obligationA}','${f.tenantA}','${f.seasonA}','${f.householdA}',720,720,360,'active'),
   ('${f.obligationB}','${f.tenantA}','${f.seasonA}','${f.householdRaceB}',720,720,360,'active');
  INSERT INTO app.household_obligation_links(id,tenant_id,household_id,obligation_id,link_kind)
   VALUES('${f.householdObligationRaceA}','${f.tenantA}','${f.householdA}','${f.obligationA}','liable'),
   ('${f.householdObligationRaceB}','${f.tenantA}','${f.householdRaceB}','${f.obligationB}','liable');
  INSERT INTO app.executor_obligation_grants(id,tenant_id,person_id,obligation_id,valid_from,valid_until,approved_by_auth_user_id)
   VALUES('${f.executorGrantRaceA}','${f.tenantA}','${f.personA}','${f.obligationA}',statement_timestamp()-interval '1 day',v_end+interval '1 day',v_a),
   ('${f.executorGrantRaceB}','${f.tenantA}','${f.personB}','${f.obligationB}',statement_timestamp()-interval '1 day',v_end+interval '1 day',v_b);
  INSERT INTO app.committees(id,tenant_id,slug,name) VALUES('${f.committeeRace}','${f.tenantA}','qa-race','Cluvo QA race');
  INSERT INTO app.task_categories(id,tenant_id,committee_id,name) VALUES('${f.categoryRace}','${f.tenantA}','${f.committeeRace}','Cluvo QA race');
  INSERT INTO app.task_types(id,tenant_id,category_id,name) VALUES('${f.taskTypeRace}','${f.tenantA}','${f.categoryRace}','Cluvo QA race');
  INSERT INTO app.task_type_versions(id,tenant_id,task_type_id,revision,credit_minutes,requirements_json,approved_by_auth_user_id)
   VALUES('${f.taskVersionRace}','${f.tenantA}','${f.taskTypeRace}',1,120,'{}',v_a);
  INSERT INTO app.shifts(id,tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at)
   VALUES('${f.shiftRace}','${f.tenantA}','${f.taskVersionRace}','${f.committeeRace}','${f.categoryRace}','Cluvo QA last position',v_start,v_end,120,1440,'published',statement_timestamp());
  INSERT INTO app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at,state)
   VALUES('${f.positionRace}','${f.tenantA}','${f.shiftRace}',1,v_start,v_end,'open');
  ${signatureSql}
  INSERT INTO app.audit_events(id,tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,idempotency_key,payload_minimal)
   VALUES('${f.qaBookingAudit}','${f.tenantA}',v_a,'qa.booking_fixture_created','qa_shift','${f.shiftRace}','tenant','${f.tenantA}','${f.qaBookingAudit}',
   jsonb_build_object('scope','staging','source_sha',${source},'workflow_run_id',${run},'actor',${actor},'expected_version',0,'qa_fixture_version',1,'signature',encode(v_signature,'hex')));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM app.shifts s JOIN app.shift_positions p ON p.tenant_id=s.tenant_id AND p.shift_id=s.id
 WHERE s.tenant_id='${f.tenantA}' AND s.id='${f.shiftRace}' AND p.id='${f.positionRace}' AND p.ordinal=1 AND p.state='open'
 AND s.state='published' AND s.version=1 AND s.type_version_id='${f.taskVersionRace}' AND s.credit_minutes=120
 AND p.starts_at=s.starts_at AND p.ends_at=s.ends_at AND s.ends_at=s.starts_at+interval '120 minutes'
 AND s.starts_at>statement_timestamp() AND (SELECT count(*) FROM app.shift_positions WHERE tenant_id=s.tenant_id AND shift_id=s.id)=1)
 OR (SELECT count(*) FROM app.obligations o JOIN app.seasons s ON s.tenant_id=o.tenant_id AND s.id=o.season_id
 WHERE o.tenant_id='${f.tenantA}' AND o.season_id='${f.seasonA}' AND s.status='active' AND o.status='active'
 AND o.base_target_minutes=720 AND o.effective_target_minutes=720 AND o.effective_winter_minutes=360
 AND ((o.id='${f.obligationA}' AND o.assessed_household_id='${f.householdA}') OR
 (o.id='${f.obligationB}' AND o.assessed_household_id='${f.householdRaceB}')))<>2
 OR (SELECT count(*) FROM app.executor_obligation_grants g JOIN app.shifts s ON s.tenant_id=g.tenant_id AND s.id='${f.shiftRace}'
 WHERE g.tenant_id='${f.tenantA}' AND g.revoked_at IS NULL AND g.valid_from<=s.starts_at AND g.valid_until>=s.ends_at
 AND ((g.id='${f.executorGrantRaceA}' AND g.person_id='${f.personA}' AND g.obligation_id='${f.obligationA}' AND g.approved_by_auth_user_id=v_a) OR
 (g.id='${f.executorGrantRaceB}' AND g.person_id='${f.personB}' AND g.obligation_id='${f.obligationB}' AND g.approved_by_auth_user_id=v_b)))<>2
 THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='STAGING_NATIVE_QA_BOOKING_REFUSED';
END $cluvo_native_qa_booking$;`;
 const holderSql=`BEGIN READ WRITE; SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='10s';
DO $cluvo_qa_holder$ BEGIN ${readyGuard}
IF NOT EXISTS(SELECT 1 FROM app.audit_events WHERE id='${f.qaBookingAudit}' AND tenant_id='${f.tenantA}' AND action='qa.booking_fixture_created')
THEN RAISE EXCEPTION 'STAGING_NATIVE_QA_BOOKING_REFUSED'; END IF; END $cluvo_qa_holder$;
SELECT true AS holder_ready FROM app.shifts WHERE tenant_id='${f.tenantA}' AND id='${f.shiftRace}' AND state='published' AND version=1 FOR UPDATE;`;
 // Provider roles can hide another backend's query/state. Lock waiters and
 // chains reaching this session's own shift lock remain directly observable.
 const blockingSql=`WITH RECURSIVE chain(origin,pid,trail) AS (
 SELECT DISTINCT waiters.pid,waiters.pid,ARRAY[waiters.pid] FROM pg_locks waiters
 JOIN pg_stat_activity activity ON activity.pid=waiters.pid
 WHERE activity.datname=current_database() AND activity.usename='authenticator'
 AND NOT waiters.granted AND waiters.pid<>pg_backend_pid()
 UNION ALL SELECT chain.origin,blocking.pid,chain.trail||blocking.pid FROM chain
 CROSS JOIN LATERAL unnest(pg_blocking_pids(chain.pid)) blocking(pid) WHERE NOT blocking.pid=ANY(chain.trail)
) SELECT jsonb_build_object('blocked_contenders',count(DISTINCT origin)) FROM chain WHERE pid=pg_backend_pid();`;
 const readbackSql=`WITH booked AS (SELECT * FROM app.bookings WHERE tenant_id='${f.tenantA}' AND position_id='${f.positionRace}')
SELECT jsonb_build_object('scope','STAGING_NATIVE_QA_LAST_POSITION',
 'bookings',(SELECT count(*) FROM booked),'active_bookings',(SELECT count(*) FROM booked WHERE state IN('booked','reconfirmation_required','transfer_pending','performed_pending')),
 'valid_winner_rows',(SELECT count(*) FROM booked b JOIN app.account_person_links l ON l.tenant_id=b.tenant_id AND l.person_id=b.executor_person_id AND l.auth_user_id=b.booked_by_auth_user_id AND l.revoked_at IS NULL
 WHERE b.state='booked' AND b.version=1 AND b.credit_minutes_snapshot=120 AND b.task_version_snapshot='${f.taskVersionRace}' AND b.ends_at_snapshot=b.starts_at_snapshot+interval '120 minutes'
 AND ((b.executor_person_id='${f.personA}' AND b.obligation_id='${f.obligationA}' AND b.idempotency_key='${f.idempotencyRaceA}') OR
 (b.executor_person_id='${f.personB}' AND b.obligation_id='${f.obligationB}' AND b.idempotency_key='${f.idempotencyRaceB}'))),
 'booking_events',(SELECT count(*) FROM app.booking_events e JOIN booked b ON b.id=e.booking_id AND b.tenant_id=e.tenant_id WHERE e.event_type='booking.created' AND e.actor_auth_user_id=b.booked_by_auth_user_id),
 'booking_audits',(SELECT count(*) FROM app.audit_events e JOIN booked b ON b.id=e.resource_id AND b.tenant_id=e.tenant_id WHERE e.action='booking.created' AND e.actor_auth_user_id=b.booked_by_auth_user_id),
 'booking_domain_events',(SELECT count(*) FROM app.domain_events e JOIN booked b ON b.id=e.aggregate_id AND b.tenant_id=e.tenant_id WHERE e.event_type='booking.created' AND e.aggregate_version=1),
 'completed_commands',(SELECT count(*) FROM app.idempotency_records WHERE tenant_id='${f.tenantA}' AND operation='book_shift' AND idempotency_key IN('${f.idempotencyRaceA}','${f.idempotencyRaceB}') AND status='completed'),
 'processing_commands',(SELECT count(*) FROM app.idempotency_records WHERE tenant_id='${f.tenantA}' AND operation='book_shift' AND idempotency_key IN('${f.idempotencyRaceA}','${f.idempotencyRaceB}') AND status='processing'),
 'ledger_entries',(SELECT count(*) FROM app.hour_ledger_entries WHERE tenant_id='${f.tenantA}'),
 'confirmed_minutes',(SELECT coalesce(sum(minutes_delta),0) FROM app.hour_ledger_entries WHERE tenant_id='${f.tenantA}'),
 'attendance_decisions',(SELECT count(*) FROM app.attendance_decisions WHERE tenant_id='${f.tenantA}'),
 'positions',(SELECT count(*) FROM app.shift_positions WHERE tenant_id='${f.tenantA}' AND shift_id='${f.shiftRace}'),
 'shift_version',(SELECT version FROM app.shifts WHERE tenant_id='${f.tenantA}' AND id='${f.shiftRace}'));`;
 return Object.freeze({fixture:f,contextSql,parameters:Object.freeze([JSON.stringify({actorA:value.actorA,actorB:value.actorB}),value.sourceSha,value.workflowRunId,value.actor]),
  mutationSql,holderSql,blockingSql,readbackSql,releaseHolderSql:'COMMIT;',cancelHolderSql:'ROLLBACK;'});
}

export function validateNativeQaBookingReadback(input,phase='booked'){
 need(phase==='empty'||phase==='booked');
 const fields=['scope','bookings','active_bookings','valid_winner_rows','booking_events','booking_audits','booking_domain_events','completed_commands','processing_commands','ledger_entries','confirmed_minutes','attendance_decisions','positions','shift_version'];
 const value=record(input,fields),wanted=phase==='booked'?1:0;
 need(value.scope==='STAGING_NATIVE_QA_LAST_POSITION'&&fields.filter(key=>key!=='scope').every(key=>Number.isSafeInteger(value[key]))&&
  ['bookings','active_bookings','valid_winner_rows','booking_events','booking_audits','booking_domain_events','completed_commands'].every(key=>value[key]===wanted)&&
  ['processing_commands','ledger_entries','confirmed_minutes','attendance_decisions'].every(key=>value[key]===0)&&value.positions===1&&value.shift_version===1,
  'STAGING_NATIVE_QA_BOOKING_READBACK_UNVERIFIED');
 return Object.freeze({...value});
}

export function validateNativeQaBookingRace(outcomes){
 const values=array(outcomes,2,'STAGING_NATIVE_QA_BOOKING_RACE_UNPROVED').map(value=>record(value,['ok','code','sqlstate']));
 need(values.filter(value=>value.ok===true&&value.code===null&&value.sqlstate===null).length===1&&
  values.filter(value=>value.ok===false&&value.code==='CAPACITY_FULL'&&value.sqlstate==='P0001').length===1,'STAGING_NATIVE_QA_BOOKING_RACE_UNPROVED');
 return Object.freeze({contenders:2,successes:1,capacity_conflicts:1});
}

export function validateNativeQaBookingReplay(original,retry){
 const fields=['ok','resource_id','version','event_ids','result'];
 const [left,right]=[original,retry].map(input=>{
  const value=record(input,fields),[event]=array(value.event_ids,1,'STAGING_NATIVE_QA_BOOKING_REPLAY_UNPROVED');
  need(value.ok===true&&uuid(value.resource_id)&&value.version===1&&uuid(event),'STAGING_NATIVE_QA_BOOKING_REPLAY_UNPROVED');
  const result=record(value.result,['position_id','state']);need(uuid(result.position_id)&&result.state==='booked','STAGING_NATIVE_QA_BOOKING_REPLAY_UNPROVED');
  return {resource_id:value.resource_id,event,position_id:result.position_id};
 });
 need(left.resource_id===right.resource_id&&left.event===right.event&&left.position_id===right.position_id,
  'STAGING_NATIVE_QA_BOOKING_REPLAY_UNPROVED');
 return Object.freeze({same_result:true});
}

export function validateNativeQaBookingConflict(input){
 const value=record(input,['code','sqlstate']);
 need(value.code==='IDEMPOTENCY_CONFLICT'&&value.sqlstate==='22000','STAGING_NATIVE_QA_BOOKING_IDEMPOTENCY_UNPROVED');
 return Object.freeze({altered_payload_conflict:'IDEMPOTENCY_CONFLICT'});
}
