// The hosted owner executes only this closed rollback recipe. No global queue,
// scheduler/claim, provider transport, schema change or existing tenant write.
import {createHash} from 'node:crypto';
import {buildStagingNativeQaFixture,nativeQaFixtureIds,nativeQaOwnedScopeGuardSql} from './staging-pwa-native-qa-fixture.mjs';

export function nativeQaAutomationIds(run){
  nativeQaFixtureIds(run);
  return Object.freeze(Object.fromEntries(['connection','occurrence1','occurrence2','occurrence3','occurrence4','shift','position','event','target','worker'].map(label=>{
    const bytes=createHash('sha256').update('cluvo-pwa-native-qa-automation-v1:'+run+':'+label).digest().subarray(0,16);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=bytes.toString('hex');return[label,[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')];
  })));
}
export function buildStagingNativeQaAutomation(input){
  const fixture=buildStagingNativeQaFixture(input),run=fixture.parameters[2],f=nativeQaFixtureIds(run),a=nativeQaAutomationIds(run);
  const occurrences=[a.occurrence1,a.occurrence2,a.occurrence3,a.occurrence4].map(id=>`'${id}'`).join(',');
  const mutationSql=`DO $cluvo_automation_proof$
DECLARE ctx jsonb:=current_setting('cluvo.native_qa_context')::jsonb;r jsonb;target_version bigint;outbox uuid;v_match_id uuid;before_success timestamptz;occ uuid;ordinal integer:=0;BEGIN
 PERFORM set_config('cluvo.delivery_scope','staging',true);PERFORM set_config('cluvo.delivery_project','fbozlbgmktkgcdfqdaaz',true);
 PERFORM set_config('cluvo.delivery_source',ctx->>'source_sha',true);PERFORM set_config('cluvo.delivery_run',ctx->>'workflow_run_id',true);PERFORM set_config('cluvo.delivery_actor',ctx->>'actor',true);
 PERFORM internal.pwa_automation_guard();
 IF EXISTS(SELECT 1 FROM app.integration_connections WHERE id='${a.connection}')OR EXISTS(SELECT 1 FROM app.shifts WHERE id='${a.shift}')OR EXISTS(SELECT 1 FROM app.pwa_delivery_targets WHERE id='${a.target}')
 OR EXISTS(SELECT 1 FROM app.scheduled_occurrences WHERE id IN(${occurrences}))THEN RAISE EXCEPTION 'STAGING_QA_AUTOMATION_IDS_NOT_EMPTY';END IF;
 -- A new public place inherits the already audited QA type/committee only.
 INSERT INTO app.shifts(id,tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at)
 SELECT '${a.shift}',tenant_id,type_version_id,committee_id,category_id,'Cluvo QA automation',starts_at+interval '6 hours',ends_at+interval '6 hours',credit_minutes,cancellation_minutes,'published',statement_timestamp()FROM app.shifts WHERE tenant_id='${f.tenantA}'AND id='${f.shiftRace}';
 INSERT INTO app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at,state)SELECT '${a.position}',tenant_id,id,1,starts_at,ends_at,'open'FROM app.shifts WHERE tenant_id='${f.tenantA}'AND id='${a.shift}';
 IF NOT internal.pwa_offer_usable('${f.tenantA}','${f.personA}','${a.shift}')THEN RAISE EXCEPTION 'STAGING_QA_AUTOMATION_MATCHING_POSITIVE_FAILED';END IF;
 INSERT INTO app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)VALUES('${a.event}','${f.tenantA}','shift','${a.shift}',1,'task.published','{"synthetic":true}'::jsonb);
 UPDATE app.pwa_preferences SET email=true,push=false,news=true WHERE tenant_id='${f.tenantA}'AND person_id='${f.personA}';
 IF internal.pwa_automation_notification('${f.tenantA}','${f.personA}','${a.event}','news','Cluvo QA aanbod','Synthetische testmelding.','/app/tasks','email','task_offer','${a.shift}',1)<>1 THEN RAISE EXCEPTION 'STAGING_QA_AUTOMATION_SOURCE_NOT_CREATED';END IF;
 SELECT o.id INTO STRICT outbox FROM app.pwa_delivery_outbox o JOIN app.pwa_notifications n ON n.tenant_id=o.tenant_id AND n.id=o.notification_id WHERE o.tenant_id='${f.tenantA}'AND o.recipient_person_id='${f.personA}'AND n.event_id='${a.event}'AND o.channel='email';
 -- A private fixture lease avoids the global claim function entirely. This
 -- proves the production revalidator; actual global worker claims are separate.
 INSERT INTO app.pwa_delivery_targets(id,tenant_id,outbox_id,target_key,state,lease_owner,lease_until,attempts,version)VALUES('${a.target}','${f.tenantA}',outbox,'email','leased','${a.worker}',statement_timestamp()+interval '3 minutes',1,2)RETURNING version INTO target_version;
 r:=internal.pwa_revalidate_delivery('${a.target}','${a.worker}',target_version);
 IF r->>'eligible'<>'true'OR r->>'source_kind'<>'task_offer'THEN RAISE EXCEPTION 'STAGING_QA_REVALIDATE_POSITIVE_FAILED';END IF;
 BEGIN PERFORM internal.pwa_revalidate_delivery('${a.target}','${a.connection}',target_version);RAISE EXCEPTION 'STAGING_QA_WRONG_LEASE_OWNER_ALLOWED';EXCEPTION WHEN SQLSTATE '40001'THEN NULL;END;
 UPDATE app.pwa_preferences SET news=false WHERE tenant_id='${f.tenantA}'AND person_id='${f.personA}';
 IF internal.pwa_revalidate_delivery('${a.target}','${a.worker}',target_version)->>'eligible'<>'false'THEN RAISE EXCEPTION 'STAGING_QA_REVOKED_PREFERENCE_SENT';END IF;
 UPDATE app.pwa_preferences SET news=true WHERE tenant_id='${f.tenantA}'AND person_id='${f.personA}';
 UPDATE app.shifts SET state='cancelled',version=version+1 WHERE tenant_id='${f.tenantA}'AND id='${a.shift}';
 IF internal.pwa_revalidate_delivery('${a.target}','${a.worker}',target_version)->>'eligible'<>'false'THEN RAISE EXCEPTION 'STAGING_QA_STALE_SOURCE_SENT';END IF;
 -- The exact synthetic connection is isolated to this run's QA team.
 INSERT INTO app.integration_connections(id,tenant_id,provider,connection_key,status,capabilities)VALUES('${a.connection}','${f.tenantA}','cluvo_fixture','cluvo-pwa-match-fixture-v1','active',jsonb_build_object('source','cluvo-pwa-match-fixture-v1','synthetic',true,'fixture_revision',1,'complete',true,'team_id','${f.teamA}'));
 FOREACH occ IN ARRAY ARRAY[${occurrences}]::uuid[]LOOP
  ordinal:=ordinal+1;
  INSERT INTO app.scheduled_occurrences(id,tenant_id,job_kind,local_date,slot_key,requested_local_time,effective_local_time,timezone,scheduled_at,dst_resolution)VALUES(occ,'${f.tenantA}','match_sync_fixture:${a.connection}',current_date-ordinal,'qa:'||ordinal,time '06:00',time '06:00','Europe/Amsterdam',(current_date-ordinal+time '06:00')AT TIME ZONE 'Europe/Amsterdam','exact');
  IF ordinal=3 THEN UPDATE app.integration_connections SET capabilities=jsonb_set(capabilities,'{fixture_revision}','2'::jsonb)WHERE tenant_id='${f.tenantA}'AND id='${a.connection}';END IF;
  IF ordinal=4 THEN SELECT last_success_at INTO before_success FROM app.integration_connections WHERE tenant_id='${f.tenantA}'AND id='${a.connection}';UPDATE app.integration_connections SET capabilities=jsonb_set(capabilities,'{complete}','false'::jsonb)WHERE tenant_id='${f.tenantA}'AND id='${a.connection}';END IF;
  r:=internal.pwa_import_match_fixture('${a.connection}',occ);
  SELECT id INTO STRICT v_match_id FROM app.matches WHERE tenant_id='${f.tenantA}'AND connection_id='${a.connection}';
  IF ordinal=1 THEN INSERT INTO app.match_shift_links(tenant_id,match_id,shift_id,link_kind)VALUES('${f.tenantA}',v_match_id,'${f.shiftRace}','active');END IF;
  IF ordinal=2 AND r->>'changed'<>'false'THEN RAISE EXCEPTION 'STAGING_QA_IMPORT_REPLAY_DUPLICATED';END IF;
  IF ordinal=4 AND((SELECT last_success_at FROM app.integration_connections WHERE id='${a.connection}')IS DISTINCT FROM before_success OR r->>'complete'<>'false')THEN RAISE EXCEPTION 'STAGING_QA_INCOMPLETE_IMPORT_ADVANCED';END IF;
 END LOOP;
 IF (SELECT count(*)FROM app.match_revisions WHERE tenant_id='${f.tenantA}'AND match_id=v_match_id)<>2 OR(SELECT count(*)FROM app.match_change_impacts WHERE tenant_id='${f.tenantA}'AND shift_id='${f.shiftRace}')<>1 OR(SELECT version FROM app.shifts WHERE tenant_id='${f.tenantA}'AND id='${f.shiftRace}')<>1 THEN RAISE EXCEPTION 'STAGING_QA_IMPORT_HISTORY_OR_SHIFT_WRONG';END IF;
 IF (SELECT count(*)FROM app.pwa_fixture_run_sources WHERE tenant_id='${f.tenantA}'AND source_sha=ctx->>'source_sha'AND workflow_run_id=ctx->>'workflow_run_id'AND actor=ctx->>'actor')<>4 THEN RAISE EXCEPTION 'STAGING_QA_IMPORT_SOURCE_AUDIT_WRONG';END IF;
 PERFORM set_config('cluvo.native_qa_automation_result',jsonb_build_object('scope','STAGING_PWA_SCOPED_AUTOMATION_QA_V1','matching_positive',true,'source_and_preference_revalidated',true,'wrong_lease_owner_refused',true,'actual_synthetic_imports',4,'unchanged_import_deduplicated',true,'source_change_preserves_booked_shift',true,'incomplete_import_preserves_success',true,'source_run_actor_bound',true,'provider_called',false,'global_scheduler_called',false)::text,true);
END $cluvo_automation_proof$;`;
  return Object.freeze({contextSql:fixture.contextSql,parameters:fixture.parameters,guardSql:nativeQaOwnedScopeGuardSql(input),mutationSql,
    readbackSql:"SELECT current_setting('cluvo.native_qa_automation_result')::jsonb;",
    rollbackReadbackSql:`SELECT jsonb_build_object('rollback_verified',NOT EXISTS(SELECT 1 FROM app.integration_connections WHERE id='${a.connection}')AND NOT EXISTS(SELECT 1 FROM app.shifts WHERE id='${a.shift}')AND NOT EXISTS(SELECT 1 FROM app.pwa_delivery_targets WHERE id='${a.target}')AND NOT EXISTS(SELECT 1 FROM app.scheduled_occurrences WHERE id IN(${occurrences}))AND NOT EXISTS(SELECT 1 FROM app.pwa_delivery_outbox WHERE tenant_id='${f.tenantA}'));`});
}
