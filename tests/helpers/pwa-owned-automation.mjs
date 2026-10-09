// Executed SQL against the test-owned PostgreSQL17 database only. All extra
// fixtures and provider receipts roll back before the fixed QA teardown.
import assert from 'node:assert/strict';
export async function runOwnedPwaAutomation({ownerSql,f,claims,json,runWorker}) {
 const worker='a3000000-0000-4000-8000-000000000001';
 const context=`SET LOCAL cluvo.delivery_scope='staging';SET LOCAL cluvo.delivery_project='fbozlbgmktkgcdfqdaaz';SET LOCAL cluvo.delivery_source='${'a'.repeat(40)}';SET LOCAL cluvo.delivery_run='987654321';SET LOCAL cluvo.delivery_actor='local-owned-pwa-automation';`;
 await ownerSql.query(`BEGIN;
 SET LOCAL cluvo.delivery_scope='staging';SET LOCAL cluvo.delivery_project='fbozlbgmktkgcdfqdaaz';
 SET LOCAL cluvo.delivery_source='${'a'.repeat(40)}';SET LOCAL cluvo.delivery_run='987654321';SET LOCAL cluvo.delivery_actor='local-owned-pwa-automation';
 CREATE TEMP TABLE pwa_automation_fixture(n integer primary key,shift_id uuid not null,position_id uuid not null);
 INSERT INTO pwa_automation_fixture SELECT x,gen_random_uuid(),gen_random_uuid()FROM generate_series(1,6)x;
 INSERT INTO app.shifts(id,tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at)
 SELECT x.shift_id,s.tenant_id,s.type_version_id,s.committee_id,s.category_id,'Cluvo QA aanbod '||x.n,statement_timestamp()+make_interval(days=>x.n,hours=>3),statement_timestamp()+make_interval(days=>x.n,hours=>5),120,1440,'published',statement_timestamp()FROM pwa_automation_fixture x CROSS JOIN app.shifts s WHERE s.id='${f.shiftRace}';
 INSERT INTO app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at,state)SELECT x.position_id,s.tenant_id,s.id,1,s.starts_at,s.ends_at,'open'FROM pwa_automation_fixture x JOIN app.shifts s ON s.id=x.shift_id;
 INSERT INTO app.domain_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)SELECT '${f.tenantA}','shift',shift_id,1,'task.published','{}'FROM pwa_automation_fixture WHERE n<=5;
 UPDATE app.pwa_preferences SET email=true,push=true,news=true,reminders=false,team=false,inbox=false WHERE tenant_id='${f.tenantA}'AND person_id='${f.personA}';
 COMMIT;`);
 // The tenant row barrier forces two independent PostgreSQL workers to reach
 // the same actual processing/digest transaction before either can commit.
 await ownerSql.query(`BEGIN;SELECT id FROM app.tenants WHERE id='${f.tenantA}'FOR UPDATE;`);
 const calls=['a3000000-0000-4000-8000-000000000011','a3000000-0000-4000-8000-000000000012'].map(id=>runWorker(`BEGIN;${context}SELECT internal.pwa_enqueue_automation('${id}',100);COMMIT;`));
 const finished=Promise.allSettled(calls);let blocked=0;
 try{
  const deadline=Date.now()+5000;while(Date.now()<deadline){blocked=json(`SELECT count(*)FROM pg_locks WHERE NOT granted AND pid<>pg_backend_pid();`);if(blocked>=2)break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(blocked>=2,'OWNED_AUTOMATION_ACTUAL_OVERLAP_UNPROVED');
 }finally{await ownerSql.query('COMMIT;');}
 const outcomes=await finished;assert.ok(outcomes.every(item=>item.status==='fulfilled'));
 const batches=outcomes.map(item=>item.value);assert.equal(batches.reduce((sum,item)=>sum+item.digests,0),1);assert.equal(batches.reduce((sum,item)=>sum+item.push,0),5);
 const result=await ownerSql.query(`BEGIN;${context}
 DO $proof$ DECLARE r jsonb;t record;rebuilt jsonb;v_digest_id uuid;before_success timestamptz;conn uuid:=gen_random_uuid();occ uuid;v_match_id uuid;booking_id uuid;rule_key uuid:=gen_random_uuid();rule_result jsonb;field_rule uuid;cluster uuid:=gen_random_uuid();v_verified_at timestamptz;operational_event uuid:=gen_random_uuid();dispatch_cluster uuid:=gen_random_uuid();dispatch_checks integer:=0;x integer;BEGIN
  IF internal.pwa_offer_usable('${f.tenantA}','${f.personA}','${f.shiftRace}')THEN RAISE EXCEPTION 'FULL_SHIFT_USABLE';END IF;
  r:=internal.pwa_enqueue_automation('${worker}',100);
  IF r->>'digests'<>'0' OR r->>'push'<>'0' THEN RAISE EXCEPTION 'FIRST_TASK_BATCH_DUPLICATED %',r;END IF;
  r:=internal.pwa_enqueue_automation('${worker}',100);
  IF r->>'digests'<>'0'OR r->>'push'<>'0'OR r->>'offers'<>'0' THEN RAISE EXCEPTION 'PUBLICATION_REPLAY_DUPLICATED %',r;END IF;
  SELECT id INTO STRICT v_digest_id FROM app.daily_task_digests WHERE tenant_id='${f.tenantA}'AND recipient_person_id='${f.personA}';
  IF (SELECT count(*)FROM app.daily_digest_items WHERE digest_id=v_digest_id)<>5 THEN RAISE EXCEPTION 'DIGEST_CONTENT_WRONG';END IF;
  INSERT INTO app.domain_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)SELECT '${f.tenantA}','shift',shift_id,1,'task.published','{}'FROM pwa_automation_fixture WHERE n=6;
  r:=internal.pwa_enqueue_automation('${worker}',100);
  IF r->>'digests'<>'0'OR r->>'push'<>'1'THEN RAISE EXCEPTION 'LATER_PUBLICATION_DAILY_CAP_WRONG %',r;END IF;
  IF EXISTS(SELECT 1 FROM app.daily_digest_items i JOIN app.task_offer_candidates c ON c.id=i.task_offer_candidate_id JOIN pwa_automation_fixture x ON x.shift_id=c.shift_id WHERE x.n=6)THEN RAISE EXCEPTION 'QUEUED_DIGEST_MUTATED';END IF;
  PERFORM internal.pwa_claim_deliveries('${worker}',100);
  SELECT target.id,target.version INTO STRICT t FROM app.pwa_delivery_targets target JOIN app.pwa_automation_sources src ON src.outbox_id=target.outbox_id WHERE src.source_kind='daily_digest'AND src.source_id=v_digest_id;
  rebuilt:=internal.pwa_revalidate_delivery(t.id,'${worker}',t.version);
  IF rebuilt->>'eligible'<>'true'OR jsonb_array_length(rebuilt->'digest_items')<>5 OR rebuilt->'digest_items'->0->>'path'NOT LIKE '%?task=%'THEN RAISE EXCEPTION 'DIGEST_REBUILD_POSITIVE_CONTROL_FAILED';END IF;
  -- Current availability, scope and hard matching must all survive until send.
  INSERT INTO app.pwa_clusters(id,tenant_id,season_id,team_id,title,mode,self_until,assign_until,created_at)VALUES(cluster,'${f.tenantA}','${f.seasonA}','${f.teamA}','Cluvo QA deadlines','self',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 day');
  INSERT INTO app.pwa_allocations(tenant_id,cluster_id,position_id)SELECT '${f.tenantA}',cluster,position_id FROM pwa_automation_fixture WHERE n=1;
  UPDATE app.shifts SET state='cancelled',version=version+1 WHERE id=(SELECT shift_id FROM pwa_automation_fixture WHERE n=2);
  UPDATE app.shifts SET booking_closes_at=statement_timestamp()-interval '1 second'WHERE id=(SELECT shift_id FROM pwa_automation_fixture WHERE n=3);
  INSERT INTO app.unavailability_periods(tenant_id,person_id,starts_at,ends_at)SELECT '${f.tenantA}','${f.personA}',starts_at,ends_at FROM app.shifts WHERE id=(SELECT shift_id FROM pwa_automation_fixture WHERE n=4);
  UPDATE app.shifts SET starts_at=statement_timestamp()-interval '3 hours',ends_at=statement_timestamp()-interval '1 hour'WHERE id=(SELECT shift_id FROM pwa_automation_fixture WHERE n=5);
  rebuilt:=internal.pwa_revalidate_delivery(t.id,'${worker}',t.version);
  IF rebuilt->>'eligible'<>'false'OR rebuilt->'digest_items'<>'[]'::jsonb THEN RAISE EXCEPTION 'STALE_DIGEST_SENT';END IF;
  BEGIN PERFORM internal.pwa_finish_delivery_receipted(t.id,'${worker}',t.version,'unknown',null,'bad',1,null);RAISE EXCEPTION 'BAD_HASH_ALLOWED';EXCEPTION WHEN SQLSTATE '22023'THEN NULL;END;
  PERFORM internal.pwa_finish_delivery_receipted(t.id,'${worker}',t.version,'unknown',null,repeat('a',64),1,null);
  IF (SELECT status FROM app.daily_task_digests WHERE id=v_digest_id)<>'unknown'THEN RAISE EXCEPTION 'UNKNOWN_DAILY_SLOT_RELEASED';END IF;
  IF (SELECT count(*)FROM app.pwa_provider_receipts WHERE target_id=t.id AND octet_length(body_sha256)=32 AND template_revision=1 AND provider_message_key IS NULL)<>1 THEN RAISE EXCEPTION 'PRIVATE_RECEIPT_MISSING';END IF;
  BEGIN PERFORM internal.pwa_finish_delivery_receipted(t.id,'${worker}',t.version,'sent',202,repeat('a',64),1,'qa-provider-id');RAISE EXCEPTION 'STALE_LEASE_ALLOWED';EXCEPTION WHEN SQLSTATE '40001'THEN NULL;END;
  BEGIN UPDATE app.pwa_provider_receipts SET provider_message_key='changed'WHERE target_id=t.id;RAISE EXCEPTION 'RECEIPT_MUTABLE';EXCEPTION WHEN SQLSTATE '55000'THEN NULL;END;
  r:=internal.pwa_enqueue_automation('${worker}',100);
  IF (SELECT count(*)FROM app.daily_task_digests WHERE tenant_id='${f.tenantA}'AND recipient_person_id='${f.personA}')<>1 THEN RAISE EXCEPTION 'UNKNOWN_RETRIED_DIGEST';END IF;
  IF (SELECT count(*)FROM app.pwa_notifications n JOIN app.domain_events e ON e.id=n.event_id WHERE e.payload_minimal->>'source_id'=cluster::text AND n.recipient_person_id='${f.personA}'AND n.essential AND n.deliver_inbox)<>2 THEN RAISE EXCEPTION 'DEADLINE_ESSENTIAL_INBOX_MISSING';END IF;
  IF EXISTS(SELECT 1 FROM app.pwa_delivery_outbox o JOIN app.pwa_notifications n ON n.id=o.notification_id JOIN app.domain_events e ON e.id=n.event_id WHERE e.payload_minimal->>'source_id'=cluster::text AND o.recipient_person_id='${f.personA}')THEN RAISE EXCEPTION 'OPTIONAL_TEAM_SEND_IGNORED_CONSENT';END IF;
  -- The same verified account-person binding is required for a normal
  -- operational message and both actual team-deadline dispatches. A confirmed
  -- Auth email and active membership alone must never authorize delivery.
  UPDATE app.pwa_preferences SET email=true,push=false,team=true WHERE tenant_id='${f.tenantA}'AND person_id='${f.personA}';
  INSERT INTO app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)VALUES(operational_event,'${f.tenantA}','person','${f.personA}',1,'pwa.fixture_operational','{}');
  PERFORM internal.pwa_notify('${f.tenantA}','${f.personA}',operational_event,'Cluvo QA operationeel','Synthetische testmelding.','/app/actions');
  INSERT INTO app.pwa_clusters(id,tenant_id,season_id,team_id,title,mode,self_until,assign_until,created_at)VALUES(dispatch_cluster,'${f.tenantA}','${f.seasonA}','${f.teamA}','Cluvo QA geverifieerde deadlines','self',statement_timestamp()-interval '5 minutes',statement_timestamp()-interval '1 minute',statement_timestamp()-interval '1 day');
  PERFORM internal.pwa_enqueue_automation('${worker}',100);
  PERFORM internal.pwa_claim_deliveries('${worker}',100);
  SELECT l.verified_at INTO STRICT v_verified_at FROM app.account_person_links l WHERE l.id='${f.accountLinkA}';
  BEGIN UPDATE app.account_person_links SET verified_at=null WHERE id='${f.accountLinkA}';RAISE EXCEPTION 'NATIVE_UNVERIFIED_LINK_STORABLE';EXCEPTION WHEN SQLSTATE '23502'THEN NULL;END;
  -- Fault injection exists solely inside this owned disposable rollback
  -- transaction. The canonical NOT NULL constraint remains intact in source;
  -- temporarily bypassing it proves the independent dispatch check executes.
  ALTER TABLE app.account_person_links ALTER COLUMN verified_at DROP NOT NULL;
  FOR t IN SELECT target.id,target.version FROM app.pwa_delivery_targets target JOIN app.pwa_delivery_outbox o ON o.tenant_id=target.tenant_id AND o.id=target.outbox_id JOIN app.pwa_notifications n ON n.tenant_id=o.tenant_id AND n.id=o.notification_id LEFT JOIN app.pwa_automation_sources src ON src.tenant_id=o.tenant_id AND src.outbox_id=o.id WHERE o.tenant_id='${f.tenantA}'AND o.recipient_person_id='${f.personA}'AND o.channel='email'AND target.state='leased'AND(n.event_id=operational_event OR(src.source_id=dispatch_cluster AND src.source_kind IN('team_self','team_assign')))LOOP
   IF internal.pwa_revalidate_delivery(t.id,'${worker}',t.version)->>'eligible'<>'true'THEN RAISE EXCEPTION 'VERIFIED_OPERATIONAL_DISPATCH_POSITIVE_CONTROL_FAILED';END IF;
   UPDATE app.account_person_links SET verified_at=null WHERE id='${f.accountLinkA}';
   rebuilt:=internal.pwa_revalidate_delivery(t.id,'${worker}',t.version);
   IF rebuilt->>'eligible'<>'false'OR rebuilt->'email'<>'null'::jsonb THEN RAISE EXCEPTION 'UNVERIFIED_OPERATIONAL_ACCOUNT_DISPATCH_ALLOWED';END IF;
   UPDATE app.account_person_links l SET verified_at=v_verified_at WHERE l.id='${f.accountLinkA}';
   IF internal.pwa_revalidate_delivery(t.id,'${worker}',t.version)->>'eligible'<>'true'THEN RAISE EXCEPTION 'RESTORED_VERIFIED_ACCOUNT_NOT_USABLE';END IF;
   dispatch_checks:=dispatch_checks+1;
  END LOOP;
  IF dispatch_checks<>3 THEN RAISE EXCEPTION 'OPERATIONAL_AND_TWO_DEADLINE_NEGATIVES_UNPROVED %',dispatch_checks;END IF;
  ALTER TABLE app.account_person_links ALTER COLUMN verified_at SET NOT NULL;
  UPDATE app.pwa_preferences SET team=false WHERE tenant_id='${f.tenantA}'AND person_id='${f.personA}';
  -- Source-versioned booking jobs and approved rules leave historical rows.
  SELECT id INTO STRICT booking_id FROM app.bookings WHERE tenant_id='${f.tenantA}'AND position_id='${f.positionRace}';
  UPDATE app.pwa_preferences SET email=true,push=false,news=false,reminders=true WHERE tenant_id='${f.tenantA}'AND person_id=(SELECT executor_person_id FROM app.bookings WHERE id=booking_id);
  UPDATE app.bookings SET pending_starts_at=statement_timestamp()+interval '7 days'-interval '1 second',pending_ends_at=statement_timestamp()+interval '7 days 2 hours'-interval '1 second',created_at=statement_timestamp()-interval '1 day',version=version+1 WHERE id=booking_id;
  PERFORM internal.pwa_enqueue_automation('${worker}',100);
  IF NOT EXISTS(SELECT 1 FROM app.pwa_reminder_jobs WHERE source_id=booking_id AND offset_minutes=10080 AND state='enqueued')THEN RAISE EXCEPTION '7D_REMINDER_NOT_EXECUTED';END IF;
  PERFORM internal.pwa_claim_deliveries('${worker}',100);
  SELECT target.id,target.version INTO STRICT t FROM app.pwa_delivery_targets target JOIN app.pwa_automation_sources src ON src.outbox_id=target.outbox_id WHERE src.source_kind='booking'AND src.source_id=booking_id AND target.state='leased';
  IF internal.pwa_revalidate_delivery(t.id,'${worker}',t.version)->>'eligible'<>'true'THEN RAISE EXCEPTION 'BOOKING_SOURCE_POSITIVE_CONTROL_FAILED';END IF;
  UPDATE app.bookings SET pending_starts_at=statement_timestamp()+interval '24 hours'-interval '1 second',pending_ends_at=statement_timestamp()+interval '26 hours'-interval '1 second',version=version+1 WHERE id=booking_id;
  IF internal.pwa_revalidate_delivery(t.id,'${worker}',t.version)->>'eligible'<>'false'THEN RAISE EXCEPTION 'BOOKING_VERSION_DRIFT_SENT';END IF;
  PERFORM internal.pwa_finish_delivery_receipted(t.id,'${worker}',t.version,'cancelled',null,null,null,null);
  PERFORM internal.pwa_enqueue_automation('${worker}',100);
  IF NOT EXISTS(SELECT 1 FROM app.pwa_reminder_jobs WHERE source_id=booking_id AND offset_minutes=1440 AND state='enqueued')OR NOT EXISTS(SELECT 1 FROM app.pwa_reminder_jobs WHERE source_id=booking_id AND state='superseded')THEN RAISE EXCEPTION '24H_REMINDER_OR_VERSION_EXPIRY_MISSING';END IF;
  IF NOT EXISTS(SELECT 1 FROM app.pwa_notifications n JOIN app.domain_events e ON e.id=n.event_id WHERE e.payload_minimal->>'source_id'=booking_id::text AND n.essential AND n.deliver_inbox)THEN RAISE EXCEPTION 'REMINDER_ESSENTIAL_INBOX_MISSING';END IF;
  PERFORM internal.pwa_claim_deliveries('${worker}',100);
  SELECT target.id,target.version INTO STRICT t FROM app.pwa_delivery_targets target JOIN app.pwa_automation_sources src ON src.outbox_id=target.outbox_id WHERE src.source_kind='booking'AND src.source_id=booking_id AND target.state='leased';
  BEGIN PERFORM internal.pwa_finish_delivery_receipted(t.id,'${worker}',t.version,'sent',202,repeat('a',64),1,'bad provider address@example.test');RAISE EXCEPTION 'PRIVATE_PROVIDER_KEY_ALLOWED';EXCEPTION WHEN SQLSTATE '22023'THEN NULL;END;
  PERFORM internal.pwa_finish_delivery_receipted(t.id,'${worker}',t.version,'sent',202,repeat('a',64),1,'qa_provider_accepted_1');
  IF (SELECT count(*)FROM app.pwa_provider_receipts receipt JOIN app.pwa_delivery_attempt_log log ON log.id=receipt.attempt_log_id WHERE receipt.target_id=t.id AND receipt.provider_message_key='qa_provider_accepted_1'AND log.state='sent'AND log.provider_status=202)<>1 THEN RAISE EXCEPTION 'ACCEPTED_RECEIPT_ACTUAL_ATTEMPT_NOT_BOUND';END IF;
  PERFORM set_config('request.jwt.claims','${JSON.stringify(claims(1)).replaceAll("'","''")}',true);
  BEGIN PERFORM api.pwa_set_reminder_rule('${f.tenantA}',1,array[60],'QA unauthorized',rule_key);RAISE EXCEPTION 'MEMBER_RULE_APPROVAL_ALLOWED';EXCEPTION WHEN SQLSTATE '42501'THEN NULL;END;
  INSERT INTO app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)SELECT '${f.tenantA}','${claims(1).sub}',id,'tenant','${claims(1).sub}'FROM app.permission_roles WHERE tenant_id='${f.tenantA}'AND role_key='board';
  rule_result:=api.pwa_set_reminder_rule('${f.tenantA}',1,array[60,30],'Cluvo QA expliciet goedgekeurde regel',rule_key);
  IF rule_result->>'version'<>'2'OR api.pwa_set_reminder_rule('${f.tenantA}',1,array[60,30],'Cluvo QA expliciet goedgekeurde regel',rule_key)<>rule_result THEN RAISE EXCEPTION 'RULE_APPROVAL_IDEMPOTENCY_FAILED';END IF;
  BEGIN PERFORM api.pwa_set_reminder_rule('${f.tenantA}',1,array[60],'QA stale',gen_random_uuid());RAISE EXCEPTION 'STALE_RULE_ALLOWED';EXCEPTION WHEN SQLSTATE '40001'THEN NULL;END;
  BEGIN PERFORM api.pwa_set_reminder_rule('${f.tenantB}',1,array[60],'QA foreign',gen_random_uuid());RAISE EXCEPTION 'FOREIGN_RULE_ALLOWED';EXCEPTION WHEN SQLSTATE '42501'THEN NULL;END;
  BEGIN UPDATE app.pwa_reminder_rules SET reason='changed'WHERE tenant_id='${f.tenantA}';RAISE EXCEPTION 'APPROVED_RULE_MUTABLE';EXCEPTION WHEN SQLSTATE '55000'THEN NULL;END;
  PERFORM internal.pwa_enqueue_automation('${worker}',100);
  IF NOT EXISTS(SELECT 1 FROM app.pwa_reminder_jobs WHERE source_id=booking_id AND offset_minutes=1440 AND state='enqueued')THEN RAISE EXCEPTION 'SENT_HISTORY_REMOVED';END IF;
  -- Actual configured synthetic match source. Identical imports keep one
  -- revision; a source change records an impact without moving a linked shift.
  INSERT INTO app.integration_connections(id,tenant_id,provider,connection_key,status,capabilities)VALUES(conn,'${f.tenantA}','cluvo_fixture','cluvo-pwa-match-fixture-v1','active',jsonb_build_object('source','cluvo-pwa-match-fixture-v1','synthetic',true,'fixture_revision',1,'complete',true,'team_id','${f.teamA}'));
  FOR x IN 1..4 LOOP
   occ:=gen_random_uuid();INSERT INTO app.scheduled_occurrences(id,tenant_id,job_kind,local_date,slot_key,requested_local_time,effective_local_time,timezone,scheduled_at,dst_resolution)SELECT occ,'${f.tenantA}','match_sync_fixture:'||conn::text,current_date-x,'qa:'||x,time '06:00',time '06:00','Europe/Amsterdam',(current_date-x+time '06:00')AT TIME ZONE 'Europe/Amsterdam','exact';
   IF x=3 THEN UPDATE app.integration_connections SET capabilities=jsonb_set(capabilities,'{fixture_revision}','2')WHERE id=conn;END IF;
   IF x=4 THEN SELECT last_success_at INTO before_success FROM app.integration_connections WHERE id=conn;UPDATE app.integration_connections SET capabilities=jsonb_set(capabilities,'{complete}','false')WHERE id=conn;END IF;
   r:=internal.pwa_import_match_fixture(conn,occ);
   SELECT id INTO STRICT v_match_id FROM app.matches WHERE connection_id=conn;
   IF x=1 THEN INSERT INTO app.match_shift_links(tenant_id,match_id,shift_id,link_kind)VALUES('${f.tenantA}',v_match_id,'${f.shiftRace}','active');END IF;
   IF x=2 AND r->>'changed'<>'false'THEN RAISE EXCEPTION 'UNCHANGED_IMPORT_DUPLICATED';END IF;
   IF x=4 AND((SELECT last_success_at FROM app.integration_connections WHERE id=conn)IS DISTINCT FROM before_success OR r->>'complete'<>'false')THEN RAISE EXCEPTION 'INCOMPLETE_IMPORT_ADVANCED_SUCCESS';END IF;
  END LOOP;
  IF (SELECT count(*)FROM app.match_revisions WHERE match_id=v_match_id)<>2 OR (SELECT count(*)FROM app.match_change_impacts WHERE shift_id='${f.shiftRace}')<>1 THEN RAISE EXCEPTION 'MATCH_REVISIONS_IMPACTS_WRONG';END IF;
  IF (SELECT version FROM app.shifts WHERE id='${f.shiftRace}')<>1 THEN RAISE EXCEPTION 'MATCH_IMPORT_MOVED_SHIFT';END IF;
  IF (SELECT status FROM app.matches WHERE id=v_match_id)<>'scheduled'THEN RAISE EXCEPTION 'INCOMPLETE_CANCELLED_UNSEEN';END IF;
  PERFORM internal.pwa_sync_match_fixtures('${worker}',100);
  IF (SELECT count(*)FROM app.scheduled_occurrences WHERE job_kind='match_sync_fixture:'||conn::text AND local_date=(statement_timestamp()AT TIME ZONE 'Europe/Amsterdam')::date)<>2 THEN RAISE EXCEPTION 'LOCAL_06_18_SLOTS_MISSING';END IF;
  BEGIN PERFORM set_config('cluvo.delivery_scope','production',true);PERFORM internal.pwa_enqueue_automation('${worker}',100);RAISE EXCEPTION 'PRODUCTION_AUTOMATION_ALLOWED';EXCEPTION WHEN SQLSTATE 'P0001'THEN IF SQLERRM<>'STAGING_AUTOMATION_CONTEXT_REQUIRED'THEN RAISE;END IF;END;
 END;$proof$;
 SET LOCAL ROLE authenticated;
 DO $native_private$BEGIN
  BEGIN PERFORM internal.pwa_enqueue_automation('${worker}',100);RAISE EXCEPTION 'BROWSER_AUTOMATION_ALLOWED';EXCEPTION WHEN SQLSTATE '42501'THEN NULL;END;
  BEGIN PERFORM internal.pwa_finish_delivery_receipted(gen_random_uuid(),'${worker}',1,'sent',202,repeat('a',64),1,'qa');RAISE EXCEPTION 'BROWSER_RECEIPT_ALLOWED';EXCEPTION WHEN SQLSTATE '42501'THEN NULL;END;
 END;$native_private$;SET LOCAL ROLE postgres;
 SELECT jsonb_build_object('daily_cap_actual_concurrency',true,'daily_cap_and_late_candidates',true,'dispatch_rebuild_current_matching',true,'verified_operational_and_team_binding',true,'unknown_slot_retained',true,'essential_operational_inbox',true,'native_approved_versioned_rules',true,'seven_day_and_24hour_source_reminders',true,'browser_private_worker_refused',true,'actual_fixture_match_import_and_local_slots',true,'immutable_provider_receipt',true);
 ROLLBACK;`);
 const record=JSON.parse(result.split('\n').filter(line=>line.startsWith('{')).at(-1));
 assert.ok(Object.values(record).every(value=>value===true));return record;
}
