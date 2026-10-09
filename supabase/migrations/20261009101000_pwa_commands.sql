-- Fixed PWA commands. Actor identity and authority never come from payloads.
begin;
grant create on schema api to cluvo_command_owner;
-- Only the restricted command owner may write these existing relations.
do $policies$ declare n text;begin
 foreach n in array array['course_enrollments','event_attendees','kanban_cards','card_checklist_items','access_grants','team_person_memberships','team_tasks','team_task_market_requests','kanban_card_assignees','personal_action_items'] loop
  execute format('create policy pwa_command_write on app.%I for all to cluvo_command_owner using(true) with check(true)',n);
 end loop;
end;$policies$;
grant update on app.personal_action_items to cluvo_command_owner;
grant insert,update on app.kanban_card_assignees to cluvo_command_owner;
grant insert on app.shift_requirements to cluvo_command_owner;
create policy pwa_command_requirements on app.shift_requirements for insert to cluvo_command_owner with check(true);
grant update on app.course_sessions,app.event_occurrences,app.kanban_boards,app.teams to cluvo_command_owner;
create policy pwa_command_lock on app.course_sessions for update to cluvo_command_owner using(true) with check(true);
create policy pwa_command_lock on app.event_occurrences for update to cluvo_command_owner using(true) with check(true);
create policy pwa_command_lock on app.kanban_boards for update to cluvo_command_owner using(true) with check(true);
create policy pwa_command_lock on app.teams for update to cluvo_command_owner using(true) with check(true);

create function internal.pwa_notify(p_tenant_id uuid,p_person_id uuid,p_event_id uuid,p_title text,p_body text,p_path text)
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_p app.pwa_preferences%rowtype;v_kind text;v_enabled boolean;
begin
 select * into v_p from app.pwa_preferences where tenant_id=p_tenant_id and person_id=p_person_id;
 select case when event_type=any(array['pwa.set_team_goal','pwa.reserve_cluster','pwa.assign_member','pwa.apply_distribution','pwa.set_followup','pwa.request_reserve','pwa.prepare_handover','pwa.accept_handover','pwa.revoke_handover','pwa.create_team_task','pwa.review_team_credit','pwa.publish_team_credit']) then 'team' when event_type='pwa.reminder' then 'reminder' when event_type='pwa.news' then 'news' else 'general' end into v_kind from app.domain_events where tenant_id=p_tenant_id and id=p_event_id;
 v_enabled:=case v_kind when 'team' then coalesce(v_p.team,true) when 'reminder' then coalesce(v_p.reminders,true) when 'news' then coalesce(v_p.news,true) else true end;
 insert into app.pwa_notifications(tenant_id,recipient_person_id,event_id,notification_kind,deliver_inbox,title,body,source_path)
 values(p_tenant_id,p_person_id,p_event_id,coalesce(v_kind,'general'),coalesce(v_p.inbox,true) and v_enabled,p_title,p_body,p_path) on conflict do nothing returning id into v_id;
 if v_id is null then return;end if;
 select * into v_p from app.pwa_preferences where tenant_id=p_tenant_id and person_id=p_person_id;
 if coalesce(v_p.email,true) and v_enabled then insert into app.pwa_delivery_outbox(tenant_id,recipient_person_id,notification_id,channel) values(p_tenant_id,p_person_id,v_id,'email') on conflict do nothing;end if;
 if coalesce(v_p.push,false) and v_enabled then insert into app.pwa_delivery_outbox(tenant_id,recipient_person_id,notification_id,channel) values(p_tenant_id,p_person_id,v_id,'push') on conflict do nothing;end if;
end;$$;

create function internal.pwa_set_card_assignees(p_tenant_id uuid,p_card_id uuid,p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare v_committee uuid;p uuid;begin
 select b.committee_id into strict v_committee from app.kanban_cards c join app.kanban_boards b on b.tenant_id=c.tenant_id and b.id=c.board_id where c.tenant_id=p_tenant_id and c.id=p_card_id;
 if not internal.is_active_member(p_tenant_id) or not internal.has_permission(p_tenant_id,'committee.workspace.manage','committee',v_committee) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if cardinality(p_ids)>30 or (select count(distinct x) from unnest(p_ids)x)<>cardinality(p_ids) then raise exception using errcode='22023',message='INVALID_ASSIGNEES';end if;
 foreach p in array p_ids loop
  if not exists(select 1 from app.persons person where person.tenant_id=p_tenant_id and person.id=p and person.status='active' and internal.person_has_permission(p_tenant_id,p,'committee.workspace.view','committee',v_committee)) then raise exception using errcode='42501',message='INVALID_ASSIGNEE';end if;
 end loop;
 update app.kanban_card_assignees set revoked_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant_id and card_id=p_card_id and revoked_at is null and not(person_id=any(p_ids));
 update app.personal_action_items set state='dismissed',completed_at=null,version=version+1 where tenant_id=p_tenant_id and card_id=p_card_id and action_kind='card_assignment' and not(recipient_person_id=any(p_ids)) and state='open';
 foreach p in array p_ids loop
  insert into app.kanban_card_assignees(tenant_id,card_id,person_id,assigned_by_auth_user_id) values(p_tenant_id,p_card_id,p,internal.current_actor_uid()) on conflict(tenant_id,card_id,person_id) do update set revoked_at=null,version=app.kanban_card_assignees.version+1;
  update app.personal_action_items set state='open',completed_at=null,due_at=(select c.due_at from app.kanban_cards c where c.tenant_id=p_tenant_id and c.id=p_card_id),version=version+1 where tenant_id=p_tenant_id and card_id=p_card_id and action_kind='card_assignment' and recipient_person_id=p;
 end loop;
end;$$;

create function internal.pwa_command(p_tenant_id uuid,p_action text,p_resource_id uuid,p_expected_version bigint,p_payload jsonb,p_idempotency_key uuid)
returns table(ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb)
language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=internal.current_actor_uid();v_person uuid;v_old jsonb;v_receipt jsonb;v_result jsonb:='{}';
 v_id uuid:=p_resource_id;v_version bigint:=1;v_event uuid:=gen_random_uuid();v_inner_key uuid;
 v_team uuid;v_season uuid;v_member uuid;v_household uuid;v_position uuid;v_booking uuid;v_scope uuid;
 v_row record;v_other record;v_count integer;v_text text;v_checks boolean[];v_allowed text[];v_key text;v_path text;
 v_cluster app.pwa_clusters%rowtype;v_allocation app.pwa_allocations%rowtype;v_instruction app.pwa_instruction_versions%rowtype;
 v_b app.bookings%rowtype;v_s app.shifts%rowtype;v_offer app.pwa_transfer_offers%rowtype;v_h app.pwa_handovers%rowtype;
 v_target_person uuid;v_target_obligation uuid;v_transfer uuid;v_capacity integer;v_repeat integer;v_index integer;v_ordinal integer;v_start timestamptz;v_end timestamptz;v_timezone text;v_targets uuid[];v_created jsonb:='[]';v_profile app.intake_profiles%rowtype;v_answers jsonb;
begin
 -- NATIVE_SESSION_COMMAND_GUARD
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 v_person:=internal.current_person_id(p_tenant_id);
 if v_person is null or p_resource_id is null or p_expected_version is null or p_expected_version<0 or p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>32768 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 v_allowed:=case p_action
 when 'cancel_booking' then array['reason_kind','description']
 when 'confirm_attendance' then array['result','awarded_minutes','reason','no_show_ack']
 when 'confirm_attendance_batch' then array['entries']
 when 'join_waitlist' then array['executor_person_id','obligation_id']
 when 'express_interest' then array['motivation']
 when 'accept_policy' then array['assignment_ids','expected_versions','capacity','explicit_confirmation']
 when 'save_profile' then array['experience','preferences','talents','availability','monthly_minutes','boundaries','reserve','buddy']
 when 'apply_distribution' then array['assignments']
 when 'book_shift' then array['shift_id','executor_person_id','obligation_id','instruction_version_id','instructions_ack','cancellation_ack','member_person_id','buddy_booking_id','extra_voluntary_ack']
 when 'set_team_goal' then array['season_id','member_person_id','goal','reason']
 when 'reserve_cluster' then array['season_id','title','mode','position_ids','self_until','assign_until','counts_for_team']
 when 'assign_member' then array['member_person_id']
 when 'set_followup' then array['self_until','assign_until']
 when 'request_reserve' then array['person_ids']
 when 'save_handover_draft' then array['season_id','successor_person_id','note','checks']
 when 'prepare_handover' then array['season_id','successor_person_id','note','checks']
 when 'accept_handover' then array[]::text[] when 'revoke_handover' then array[]::text[]
 when 'save_feedback' then array['repeat','instruction_clarity','tip'] when 'prepare_booking' then array['prepared']
 when 'ask_question' then array['subject','body','booking_id'] when 'answer_question' then array['answer'] when 'take_question' then array[]::text[]
 when 'create_channel' then array['scope','title'] when 'send_message' then array['body']
 when 'mark_inbox_read' then array[]::text[] when 'mark_all_inbox_read' then array[]::text[]
 when 'save_preferences' then array['email','push','inbox','reminders','team','news']
 when 'dismiss_help' then array['topic_id','topic_version'] when 'reset_help' then array[]::text[]
 when 'enroll_course' then array[]::text[] when 'withdraw_course' then array[]::text[]
 when 'rsvp_event' then array['rsvp']
 when 'create_card' then array['title','description','column_id','due_at','assignee_person_ids'] when 'update_card' then array['column_id','status','due_at','assignee_person_ids']
 when 'check_card_item' then array['completed'] when 'reply_card' then array['body']
 when 'publish_instructions' then array['body','propagate_to']
 when 'open_transfer' then array['expires_at','reason']
 when 'accept_transfer' then array['executor_person_id','obligation_id','member_person_id','instruction_version_id','instructions_ack','cancellation_ack','extra_voluntary_ack']
 when 'report_obstruction' then array['reason']
 when 'create_team_task' then array['season_id','title','starts_at','ends_at','task_type_version_id','counts_for_team','capacity','repeat_count','instructions','requested_minutes','match_id','referee_needed']
 when 'create_club_task' then array['season_id','title','starts_at','ends_at','task_type_version_id','capacity','repeat_count','instructions','minimum_age','qualification_type_id','min_qualified_count','buddy_allowed']
 when 'review_team_credit' then array['review_kind','outcome','approved_minutes','reason']
 when 'publish_team_credit' then array[]::text[]
 when 'save_push_subscription' then array['endpoint','p256dh','auth_secret']
 when 'revoke_push_subscription' then array['endpoint']
 else null end;
 if v_allowed is null then raise exception using errcode='22023',message='UNKNOWN_ACTION';end if;
 for v_key in select jsonb_object_keys(p_payload) loop if not(v_key=any(v_allowed)) then raise exception using errcode='22023',message='INVALID_FIELD';end if;end loop;
 perform pg_advisory_xact_lock(hashtextextended('pwa:'||p_tenant_id::text||':'||v_actor::text||':'||p_idempotency_key::text,0));
 v_old:=internal.claim_idempotency(p_tenant_id,'pwa',p_idempotency_key,extensions.digest(convert_to(jsonb_build_object('action',p_action,'resource_id',p_resource_id,'expected_version',p_expected_version,'payload',p_payload)::text,'UTF8'),'sha256'));
 if v_old is not null then return query select true,(v_old->>'resource_id')::uuid,(v_old->>'version')::bigint,array(select value::uuid from jsonb_array_elements_text(v_old->'event_ids')),v_old->'result';return;end if;
 -- Nested canonical commands get a distinct deterministic key; one outer status key.
 v_inner_key:=md5('pwa:'||p_idempotency_key::text||':'||p_action)::uuid;
 case p_action
 when 'cancel_booking' then
  if p_payload->>'reason_kind'='regular' and exists(select 1 from app.pwa_booking_details d where d.tenant_id=p_tenant_id and d.booking_id=p_resource_id and d.allocation_id is not null) then raise exception using errcode='55000',message='TEAM_REPLACEMENT_REQUIRED';end if;
  select * into strict v_row from internal.cancel_booking(p_tenant_id,p_resource_id,p_expected_version,p_payload->>'reason_kind',p_payload->>'description',v_inner_key);v_id:=v_row.resource_id;v_version:=v_row.version;v_result:=v_row.result;
 when 'confirm_attendance_batch' then
  if p_resource_id<>p_tenant_id or p_expected_version<>0 or jsonb_typeof(p_payload->'entries')<>'array' or jsonb_array_length(p_payload->'entries') not between 1 and 50 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  if (select count(distinct value->>'booking_id') from jsonb_array_elements(p_payload->'entries'))<>jsonb_array_length(p_payload->'entries') then raise exception using errcode='22023',message='DUPLICATE_BOOKING';end if;
  for v_other in select value item from jsonb_array_elements(p_payload->'entries') order by value->>'booking_id' loop
   if not(v_other.item ?& array['booking_id','expected_version','result','awarded_minutes','reason']) or exists(select 1 from jsonb_object_keys(v_other.item) k where k<>all(array['booking_id','expected_version','result','awarded_minutes','reason','no_show_ack'])) then raise exception using errcode='22023',message='INVALID_FIELD';end if;
   if v_other.item->>'result'='no_show' and v_other.item->'no_show_ack' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='NO_SHOW_ACK_REQUIRED';end if;
   select * into strict v_row from internal.confirm_attendance(p_tenant_id,(v_other.item->>'booking_id')::uuid,(v_other.item->>'expected_version')::bigint,v_other.item->>'result',(v_other.item->>'awarded_minutes')::integer,v_other.item->>'reason',md5(v_inner_key::text||':'||(v_other.item->>'booking_id'))::uuid);
   v_created:=v_created||jsonb_build_array(jsonb_build_object('booking_id',v_row.resource_id,'version',v_row.version));
  end loop;
  v_version:=1;v_result:=jsonb_build_object('confirmed',v_created);
 when 'confirm_attendance' then
  if p_payload->>'result'='no_show' and p_payload->'no_show_ack' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='NO_SHOW_ACK_REQUIRED';end if;
  select * into strict v_row from internal.confirm_attendance(p_tenant_id,p_resource_id,p_expected_version,p_payload->>'result',(p_payload->>'awarded_minutes')::integer,p_payload->>'reason',v_inner_key);v_id:=v_row.resource_id;v_version:=v_row.version;v_result:=v_row.result;
 when 'join_waitlist' then
  select app.shifts.version into v_version from app.shifts where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_version is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select * into strict v_row from internal.join_shift_waitlist(p_tenant_id,p_resource_id,(p_payload->>'executor_person_id')::uuid,(p_payload->>'obligation_id')::uuid,v_inner_key);v_id:=v_row.resource_id;v_version:=v_row.version;v_result:=v_row.result;
 when 'express_interest' then
  select app.vacancies.version into v_version from app.vacancies where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_version is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select * into strict v_row from internal.express_vacancy_interest(p_tenant_id,p_resource_id,p_payload->>'motivation',v_inner_key);v_id:=v_row.resource_id;v_version:=v_row.version;v_result:=v_row.result;
 when 'accept_policy' then
  if jsonb_typeof(p_payload->'assignment_ids')<>'array' or jsonb_typeof(p_payload->'expected_versions')<>'array' or jsonb_array_length(p_payload->'assignment_ids') not between 1 and 50 or jsonb_array_length(p_payload->'expected_versions')<>jsonb_array_length(p_payload->'assignment_ids') then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  v_result:=internal.accept_policy_assignments(p_tenant_id,array(select value::uuid from jsonb_array_elements_text(p_payload->'assignment_ids')),array(select value::bigint from jsonb_array_elements_text(p_payload->'expected_versions')),p_payload->>'capacity',(p_payload->>'explicit_confirmation')::boolean,v_inner_key);
  v_id:=p_resource_id;v_version:=greatest(p_expected_version,1);
 when 'save_profile' then
  select * into strict v_profile from app.intake_profiles where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_profile.person_id<>v_person then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(a.answers,'{}'::jsonb) into v_answers from app.intake_answers_versions a where a.tenant_id=p_tenant_id and a.profile_id=p_resource_id and a.revision=v_profile.current_revision;
  v_answers:=coalesce(v_answers,'{}'::jsonb)||jsonb_build_object('schema_version',2,'experience',p_payload->'experience','preferences',p_payload->'preferences','skills',p_payload->'talents','availability',p_payload->'availability','desired_monthly_minutes',p_payload->'monthly_minutes','practical_limitations',p_payload->'boundaries','reserve_willing',p_payload->'reserve','buddy_requested',p_payload->'buddy');
  select * into strict v_row from internal.save_intake_revision(p_tenant_id,p_resource_id,p_expected_version,v_profile.desired_minutes,v_answers,null,null,v_inner_key);v_id:=v_row.resource_id;v_version:=v_row.version;v_result:=v_row.result;
 when 'apply_distribution' then
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select app.teams.version into v_version from app.teams where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_version is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if jsonb_typeof(p_payload->'assignments')<>'array' or jsonb_array_length(p_payload->'assignments') not between 1 and 100 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  for v_other in select value item from jsonb_array_elements(p_payload->'assignments') order by value->>'allocation_id' loop
   if not(v_other.item ?& array['allocation_id','expected_version','member_person_id']) or (select count(*) from jsonb_object_keys(v_other.item))<>3 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
   select * into strict v_allocation from app.pwa_allocations where tenant_id=p_tenant_id and id=(v_other.item->>'allocation_id')::uuid for update;
   select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=v_allocation.cluster_id;
   if v_cluster.team_id<>p_resource_id or v_allocation.state not in ('reserved','assigned') then raise exception using errcode='42501',message='FORBIDDEN';end if;
   if v_allocation.version<>(v_other.item->>'expected_version')::bigint then raise exception using errcode='40001',message='STALE_VERSION';end if;
   v_member:=(v_other.item->>'member_person_id')::uuid;
   if not exists(select 1 from app.team_person_memberships m where m.tenant_id=p_tenant_id and m.team_id=p_resource_id and m.person_id=v_member and m.membership_kind='player' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())) then raise exception using errcode='42501',message='INVALID_MEMBER';end if;
   update app.pwa_allocations set member_person_id=v_member,state='assigned',version=app.pwa_allocations.version+1 where id=v_allocation.id;
  end loop;
  v_result:=jsonb_build_object('assigned',jsonb_array_length(p_payload->'assignments'));
 when 'publish_instructions' then
  select * into strict v_s from app.shifts where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.has_permission(p_tenant_id,'shift.manage','committee',v_s.committee_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_s.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select coalesce(max(revision),0)+1 into v_count from app.pwa_instruction_versions where tenant_id=p_tenant_id and shift_id=p_resource_id;
  insert into app.pwa_instruction_versions(tenant_id,shift_id,revision,body,author_auth_user_id) values(p_tenant_id,p_resource_id,v_count,p_payload->>'body',v_actor) returning id into v_id;
  update app.shifts set version=app.shifts.version+1 where tenant_id=p_tenant_id and id=p_resource_id;
  v_version:=v_count;v_result:=jsonb_build_object('shift_id',p_resource_id,'instruction_version_id',v_id);
  if p_payload ? 'propagate_to' then
   if jsonb_typeof(p_payload->'propagate_to')<>'array' or jsonb_array_length(p_payload->'propagate_to')>50 or (select count(distinct value->>'shift_id') from jsonb_array_elements(p_payload->'propagate_to'))<>jsonb_array_length(p_payload->'propagate_to') then raise exception using errcode='22023',message='INVALID_PROPAGATION';end if;
   for v_other in select value item from jsonb_array_elements(p_payload->'propagate_to') order by value->>'shift_id' loop
    if (select count(*) from jsonb_object_keys(v_other.item))<>2 or not(v_other.item ?& array['shift_id','expected_version']) then raise exception using errcode='22023',message='INVALID_FIELD';end if;
    select * into strict v_row from app.shifts where tenant_id=p_tenant_id and id=(v_other.item->>'shift_id')::uuid for update;
    if v_row.id=v_s.id or v_row.committee_id<>v_s.committee_id or v_row.category_id<>v_s.category_id or v_row.state<>'published' or v_row.starts_at<=statement_timestamp() or not internal.has_permission(p_tenant_id,'shift.manage','committee',v_row.committee_id) then raise exception using errcode='42501',message='PROPAGATION_SCOPE_MISMATCH';end if;
    if v_row.version<>(v_other.item->>'expected_version')::bigint then raise exception using errcode='40001',message='STALE_VERSION';end if;
    if (select array_agg(distinct cl.team_id order by cl.team_id) from app.pwa_allocations al join app.pwa_clusters cl on cl.tenant_id=al.tenant_id and cl.id=al.cluster_id join app.shift_positions pos on pos.tenant_id=al.tenant_id and pos.id=al.position_id where al.tenant_id=p_tenant_id and pos.shift_id=v_row.id and al.state<>'released') is distinct from (select array_agg(distinct cl.team_id order by cl.team_id) from app.pwa_allocations al join app.pwa_clusters cl on cl.tenant_id=al.tenant_id and cl.id=al.cluster_id join app.shift_positions pos on pos.tenant_id=al.tenant_id and pos.id=al.position_id where al.tenant_id=p_tenant_id and pos.shift_id=v_s.id and al.state<>'released') then raise exception using errcode='42501',message='PROPAGATION_SCOPE_MISMATCH';end if;
    select coalesce(max(revision),0)+1 into v_ordinal from app.pwa_instruction_versions where tenant_id=p_tenant_id and shift_id=v_row.id;
    insert into app.pwa_instruction_versions(tenant_id,shift_id,revision,body,author_auth_user_id) values(p_tenant_id,v_row.id,v_ordinal,p_payload->>'body',v_actor);
    update app.shifts set version=app.shifts.version+1 where tenant_id=p_tenant_id and id=v_row.id;
   end loop;
  end if;

 when 'book_shift' then
  v_target_person:=(p_payload->>'executor_person_id')::uuid;v_target_obligation:=(p_payload->>'obligation_id')::uuid;
  if p_payload->'instructions_ack' is distinct from 'true'::jsonb or p_payload->'cancellation_ack' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='ACK_REQUIRED';end if;
  perform 1 from app.persons where tenant_id=p_tenant_id and id=v_target_person for update;
  perform 1 from app.obligations where tenant_id=p_tenant_id and id=v_target_obligation for update;
  select * into strict v_s from app.shifts where tenant_id=p_tenant_id and id=(p_payload->>'shift_id')::uuid for update;
  if v_s.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select * into strict v_instruction from app.pwa_instruction_versions where tenant_id=p_tenant_id and shift_id=v_s.id order by revision desc limit 1;
  if v_instruction.id is distinct from (p_payload->>'instruction_version_id')::uuid then raise exception using errcode='40001',message='INSTRUCTIONS_CHANGED';end if;
  if not internal.can_book_executor(p_tenant_id,v_target_person,v_target_obligation) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select * into v_allocation from app.pwa_allocations where tenant_id=p_tenant_id and position_id=p_resource_id and state<>'released' for update;
  if v_allocation.id is not null then
   select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=v_allocation.cluster_id;
   v_member:=coalesce(v_allocation.member_person_id,(p_payload->>'member_person_id')::uuid);
   if not (internal.pwa_can_team(p_tenant_id,v_cluster.team_id) or (v_target_person=v_person and exists(select 1 from app.pwa_reserve_requests rr where rr.tenant_id=p_tenant_id and rr.allocation_id=v_allocation.id and rr.recipient_person_id=v_person and rr.state='requested'))) or v_member is null or not exists(select 1 from app.team_person_memberships m where m.tenant_id=p_tenant_id and m.team_id=v_cluster.team_id and m.person_id=v_member and m.membership_kind='player' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())) then raise exception using errcode='42501',message='INVALID_MEMBER';end if;
   -- An assigned child's explicitly authorized household chooses the executor.
   if not (v_target_person=v_person and exists(select 1 from app.pwa_reserve_requests rr where rr.tenant_id=p_tenant_id and rr.allocation_id=v_allocation.id and rr.recipient_person_id=v_person and rr.state='requested')) and not exists(select 1 from app.household_person_links l join app.household_obligation_links o on o.tenant_id=l.tenant_id and o.household_id=l.household_id and o.obligation_id=v_target_obligation and o.starts_at<=statement_timestamp() and (o.ends_at is null or o.ends_at>statement_timestamp()) where l.tenant_id=p_tenant_id and l.person_id=v_member and l.starts_at<=statement_timestamp() and (l.ends_at is null or l.ends_at>statement_timestamp()) and internal.can_access_household(p_tenant_id,l.household_id,'book_for')) then raise exception using errcode='42501',message='FORBIDDEN';end if;
   if v_allocation.member_person_id is null and (v_cluster.mode<>'self' or statement_timestamp()>=v_cluster.self_until) then raise exception using errcode='P0001',message='DEADLINE_PASSED';end if;
   if exists(select 1 from app.pwa_team_goals g where g.tenant_id=p_tenant_id and g.team_id=v_cluster.team_id and g.season_id=v_cluster.season_id and (g.member_person_id=v_member or g.member_person_id is null) and g.goal<=coalesce((select sum(e.count_delta) from app.pwa_team_execution_entries e where e.tenant_id=p_tenant_id and e.team_id=v_cluster.team_id and e.season_id=v_cluster.season_id and e.member_person_id=v_member),0)) and p_payload->'extra_voluntary_ack' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='VOLUNTARY_ACK_REQUIRED';end if;
   insert into app.pwa_booking_authorizations(tenant_id,transaction_id,position_id,actor_auth_user_id) values(p_tenant_id,txid_current(),p_resource_id,v_actor);
  end if;
  if p_payload->>'buddy_booking_id' is not null then
   if not exists(select 1 from app.shift_requirements r where r.tenant_id=p_tenant_id and r.shift_id=v_s.id and r.buddy_allowed) then raise exception using errcode='42501',message='BUDDY_NOT_ALLOWED';end if;
   if not exists(select 1 from app.bookings b join app.shift_positions p on p.tenant_id=b.tenant_id and p.id=b.position_id where b.tenant_id=p_tenant_id and b.id=(p_payload->>'buddy_booking_id')::uuid and p.shift_id=v_s.id and b.executor_person_id<>v_target_person and b.state in ('booked','reconfirmation_required') and exists(select 1 from app.person_qualifications q where q.tenant_id=b.tenant_id and q.person_id=b.executor_person_id and q.qualification_type_id=(select r.qualification_type_id from app.shift_requirements r where r.tenant_id=p_tenant_id and r.shift_id=v_s.id) and q.revoked_at is null and q.achieved_at<=v_s.starts_at and (q.expires_at is null or q.expires_at>=v_s.ends_at))) then raise exception using errcode='42501',message='INVALID_BUDDY';end if;
  end if;
  select * into strict v_row from internal.book_shift(p_tenant_id,v_s.id,p_resource_id,v_target_person,v_target_obligation,p_expected_version,v_inner_key);
  v_id:=v_row.resource_id;v_booking:=v_id;
  insert into app.pwa_booking_details(tenant_id,booking_id,instruction_version_id,instruction_body_snapshot,title_snapshot,location_snapshot,actor_auth_user_id,allocation_id,member_person_id,buddy_booking_id)
  values(p_tenant_id,v_id,v_instruction.id,v_instruction.body,v_s.title,(select l.name from app.locations l where l.tenant_id=p_tenant_id and l.id=v_s.location_id),v_actor,v_allocation.id,v_member,(p_payload->>'buddy_booking_id')::uuid);
  if v_allocation.id is not null then update app.pwa_reserve_requests set state=case when recipient_person_id=v_person then 'accepted' else 'expired' end,version=app.pwa_reserve_requests.version+1 where tenant_id=p_tenant_id and allocation_id=v_allocation.id and state='requested';
   update app.pwa_allocations set state='booked',member_person_id=v_member,version=app.pwa_allocations.version+1 where id=v_allocation.id;end if;
  delete from app.pwa_booking_authorizations where transaction_id=txid_current() and tenant_id=p_tenant_id and actor_auth_user_id=v_actor;
  v_result:=jsonb_build_object('booking_id',v_id,'state','booked');
 when 'set_team_goal' then
  v_team:=p_resource_id;v_season:=(p_payload->>'season_id')::uuid;v_member:=(p_payload->>'member_person_id')::uuid;
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',v_team) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  perform 1 from app.teams where tenant_id=p_tenant_id and id=v_team and active for update;if not found then raise exception using errcode='P0002',message='NOT_FOUND';end if;
  if not exists(select 1 from app.seasons s where s.tenant_id=p_tenant_id and s.id=v_season and s.status in ('preparing','active')) then raise exception using errcode='22023',message='INVALID_SEASON';end if;
  if v_member is not null and not exists(select 1 from app.team_person_memberships m where m.tenant_id=p_tenant_id and m.team_id=v_team and m.person_id=v_member and m.membership_kind='player' and (m.ends_at is null or m.ends_at>statement_timestamp())) then raise exception using errcode='42501',message='INVALID_MEMBER';end if;
  select id,app.pwa_team_goals.version into v_id,v_version from app.pwa_team_goals where tenant_id=p_tenant_id and team_id=v_team and season_id=v_season and member_person_id is not distinct from v_member for update;
  if coalesce(v_version,0)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_id is null then insert into app.pwa_team_goals(tenant_id,team_id,season_id,member_person_id,goal,reason) values(p_tenant_id,v_team,v_season,v_member,(p_payload->>'goal')::integer,p_payload->>'reason') returning id,app.pwa_team_goals.version into v_id,v_version;
  else update app.pwa_team_goals set goal=(p_payload->>'goal')::integer,reason=p_payload->>'reason',version=app.pwa_team_goals.version+1 where id=v_id returning app.pwa_team_goals.version into v_version;end if;
 when 'reserve_cluster' then
  v_team:=p_resource_id;v_season:=(p_payload->>'season_id')::uuid;
  if not internal.pwa_can_team(p_tenant_id,v_team) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select * into strict v_row from app.teams where tenant_id=p_tenant_id and id=v_team for update;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if jsonb_typeof(p_payload->'position_ids')<>'array' or jsonb_array_length(p_payload->'position_ids') not between 1 and 100 then raise exception using errcode='22023',message='INVALID_POSITIONS';end if;
  insert into app.pwa_clusters(tenant_id,season_id,team_id,title,mode,self_until,assign_until) values(p_tenant_id,v_season,v_team,p_payload->>'title',p_payload->>'mode',(p_payload->>'self_until')::timestamptz,(p_payload->>'assign_until')::timestamptz) returning id into v_id;
  for v_position in select distinct value::uuid from jsonb_array_elements_text(p_payload->'position_ids') order by 1 loop
   select s.* into strict v_s from app.shift_positions p join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where p.tenant_id=p_tenant_id and p.id=v_position for update of s;
   perform 1 from app.shift_positions p where p.tenant_id=p_tenant_id and p.id=v_position and p.state='open' for update;if not found then raise exception using errcode='P0001',message='CAPACITY_FULL';end if;
   if not internal.has_permission(p_tenant_id,'shift.manage','committee',v_s.committee_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
   if v_s.state<>'published' or v_s.starts_at<=statement_timestamp() or (p_payload->>'assign_until')::timestamptz>=v_s.starts_at or not exists(select 1 from app.seasons z where z.tenant_id=p_tenant_id and z.id=v_season and z.status='active' and (v_s.starts_at at time zone 'Europe/Amsterdam')::date between z.starts_on and z.ends_on) or exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.position_id=v_position and b.state not in ('cancelled','transferred')) then raise exception using errcode='P0001',message='CAPACITY_FULL';end if;
   insert into app.pwa_allocations(tenant_id,cluster_id,position_id,counts_for_team) values(p_tenant_id,v_id,v_position,coalesce((p_payload->>'counts_for_team')::boolean,true));
  end loop;
 when 'assign_member' then
  select * into strict v_allocation from app.pwa_allocations where tenant_id=p_tenant_id and id=p_resource_id for update;
  select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=v_allocation.cluster_id;
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',v_cluster.team_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_allocation.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_allocation.state not in ('reserved','assigned') then raise exception using errcode='P0001',message='ALREADY_BOOKED';end if;
  v_member:=(p_payload->>'member_person_id')::uuid;
  if not exists(select 1 from app.team_person_memberships m where m.tenant_id=p_tenant_id and m.team_id=v_cluster.team_id and m.person_id=v_member and m.membership_kind='player' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())) then raise exception using errcode='42501',message='INVALID_MEMBER';end if;
  update app.pwa_allocations set member_person_id=v_member,state='assigned',version=app.pwa_allocations.version+1 where id=p_resource_id returning app.pwa_allocations.version into v_version;
 when 'set_followup' then
  select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',v_cluster.team_id) and exists(select 1 from app.pwa_allocations al join app.shift_positions pos on pos.tenant_id=al.tenant_id and pos.id=al.position_id join app.shifts sh on sh.tenant_id=pos.tenant_id and sh.id=pos.shift_id where al.tenant_id=p_tenant_id and al.cluster_id=v_cluster.id and not internal.has_permission(p_tenant_id,'shift.manage','committee',sh.committee_id)) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_cluster.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if (p_payload->>'self_until')::timestamptz<statement_timestamp() or exists(select 1 from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id where a.tenant_id=p_tenant_id and a.cluster_id=p_resource_id and (p_payload->>'assign_until')::timestamptz>=p.starts_at) then raise exception using errcode='22023',message='INVALID_DEADLINE';end if;
  update app.pwa_clusters set self_until=(p_payload->>'self_until')::timestamptz,assign_until=(p_payload->>'assign_until')::timestamptz,version=app.pwa_clusters.version+1 where id=p_resource_id returning app.pwa_clusters.version into v_version;
 when 'request_reserve' then
  select * into strict v_allocation from app.pwa_allocations where tenant_id=p_tenant_id and id=p_resource_id for update;
  select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=v_allocation.cluster_id;
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',v_cluster.team_id) or v_allocation.state='released' then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_allocation.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_allocation.state<>'assigned' or statement_timestamp()<v_cluster.assign_until then raise exception using errcode='55000',message='RESERVE_PHASE_NOT_STARTED';end if;
  if jsonb_typeof(p_payload->'person_ids')<>'array' or jsonb_array_length(p_payload->'person_ids') not between 1 and 20 then raise exception using errcode='22023',message='INVALID_RECIPIENTS';end if;
  for v_target_person in select distinct value::uuid from jsonb_array_elements_text(p_payload->'person_ids') loop
   if v_allocation.member_person_id is null then raise exception using errcode='22023',message='ASSIGN_MEMBER_FIRST';end if;
   if not internal.pwa_executor_fits(p_tenant_id,v_target_person,(select pos.shift_id from app.shift_positions pos where pos.tenant_id=p_tenant_id and pos.id=v_allocation.position_id)) then raise exception using errcode='42501',message='NOT_ELIGIBLE';end if;
   if not exists(select 1 from app.intake_profiles p join app.intake_answers_versions a on a.tenant_id=p.tenant_id and a.profile_id=p.id and a.revision=p.current_revision where p.tenant_id=p_tenant_id and p.person_id=v_target_person and a.answers->'reserve_willing'='true'::jsonb) then raise exception using errcode='42501',message='RESERVE_OPT_IN_REQUIRED';end if;
   insert into app.pwa_reserve_requests(tenant_id,allocation_id,recipient_person_id) values(p_tenant_id,p_resource_id,v_target_person) on conflict do nothing;
  end loop;
  v_version:=v_allocation.version;
 when 'prepare_handover','save_handover_draft' then
  v_team:=p_resource_id;v_target_person:=(p_payload->>'successor_person_id')::uuid;v_season:=(p_payload->>'season_id')::uuid;
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',v_team) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  perform 1 from app.teams where tenant_id=p_tenant_id and id=v_team for update;
  if not exists(select 1 from app.persons p join app.account_person_links l on l.tenant_id=p.tenant_id and l.person_id=p.id and l.revoked_at is null join app.tenant_memberships m on m.tenant_id=l.tenant_id and m.auth_user_id=l.auth_user_id and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()) where p.tenant_id=p_tenant_id and p.id=v_target_person and p.status='active' and p.birth_date_precision='day' and p.birth_date+interval '18 years'<=(statement_timestamp() at time zone (select timezone from app.tenants where id=p_tenant_id))::date) then raise exception using errcode='42501',message='INVALID_SUCCESSOR';end if;
  select * into v_h from app.pwa_handovers where tenant_id=p_tenant_id and team_id=v_team and state in ('draft','ready') order by created_at desc limit 1 for update;
  if coalesce(v_h.version,0)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  v_checks:=array(select value::boolean from jsonb_array_elements_text(p_payload->'checks'));
  if array_length(v_checks,1)<>5 or array_position(v_checks,null) is not null or (p_action='prepare_handover' and array_position(v_checks,false) is not null) then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;
  if v_h.id is not null then update app.pwa_handovers set state='revoked',version=app.pwa_handovers.version+1 where id=v_h.id;end if;
  insert into app.pwa_handovers(tenant_id,season_id,team_id,predecessor_person_id,successor_person_id,note,checks,state,version) values(p_tenant_id,v_season,v_team,v_person,v_target_person,p_payload->>'note',v_checks,case when p_action='prepare_handover' then 'ready' else 'draft' end,p_expected_version+1) returning id,app.pwa_handovers.version into v_id,v_version;
 when 'accept_handover' then
  select * into strict v_h from app.pwa_handovers where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_h.successor_person_id<>v_person or v_h.state<>'ready' then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_h.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  -- Successor is authorized by the named version, without a prior team-parent role.
  if not exists(select 1 from app.account_person_links l join app.access_grants g on g.tenant_id=l.tenant_id and g.auth_user_id=l.auth_user_id join app.permission_roles r on r.tenant_id=g.tenant_id and r.id=g.role_id where l.tenant_id=p_tenant_id and l.person_id=v_h.predecessor_person_id and l.revoked_at is null and g.scope_kind='team' and g.team_id=v_h.team_id and r.role_key='team_parent' and g.revoked_at is null and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())) then raise exception using errcode='42501',message='PREDECESSOR_RIGHT_ENDED';end if;
  update app.access_grants g set ends_at=statement_timestamp(),version=g.version+1 from app.account_person_links l,app.permission_roles r where l.tenant_id=p_tenant_id and l.person_id=v_h.predecessor_person_id and l.revoked_at is null and g.tenant_id=l.tenant_id and g.auth_user_id=l.auth_user_id and g.team_id=v_h.team_id and g.scope_kind='team' and r.tenant_id=g.tenant_id and r.id=g.role_id and r.role_key='team_parent' and g.starts_at<statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,team_id,granted_by_auth_user_id) select p_tenant_id,v_actor,r.id,'team',v_h.team_id,v_actor from app.permission_roles r where r.tenant_id=p_tenant_id and r.role_key='team_parent';
  update app.team_person_memberships set ends_at=statement_timestamp(),version=app.team_person_memberships.version+1 where tenant_id=p_tenant_id and team_id=v_h.team_id and person_id=v_h.predecessor_person_id and membership_kind='team_parent' and starts_at<statement_timestamp() and (ends_at is null or ends_at>statement_timestamp());
  insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind) values(p_tenant_id,v_h.team_id,v_person,'team_parent');
  update app.pwa_handovers set state='accepted',accepted_at=statement_timestamp(),version=app.pwa_handovers.version+1 where id=p_resource_id returning app.pwa_handovers.version into v_version;
 when 'revoke_handover' then
  select * into strict v_h from app.pwa_handovers where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_h.predecessor_person_id<>v_person or not internal.has_permission(p_tenant_id,'team_task.manage','team',v_h.team_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_h.version<>p_expected_version or v_h.state not in ('draft','ready') then raise exception using errcode='40001',message='STALE_VERSION';end if;
  update app.pwa_handovers set state='revoked',version=app.pwa_handovers.version+1 where id=p_resource_id returning app.pwa_handovers.version into v_version;
 when 'prepare_booking' then
  select * into strict v_b from app.bookings where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.pwa_owns_booking(p_tenant_id,p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_b.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_payload->'prepared' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  update app.pwa_booking_details set prepared_at=statement_timestamp(),version=app.pwa_booking_details.version+1 where tenant_id=p_tenant_id and booking_id=p_resource_id;
  if not found then raise exception using errcode='P0002',message='ACKNOWLEDGEMENT_REQUIRED';end if;
  update app.bookings set version=app.bookings.version+1 where tenant_id=p_tenant_id and id=p_resource_id returning app.bookings.version into v_version;
 when 'save_feedback' then
  select * into strict v_b from app.bookings where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.is_self_person(p_tenant_id,v_b.executor_person_id) or v_b.state<>'confirmed' then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_b.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  insert into app.pwa_feedback(tenant_id,booking_id,person_id,repeat,instruction_clarity,tip) values(p_tenant_id,p_resource_id,v_person,(p_payload->>'repeat')::boolean,(p_payload->>'instruction_clarity')::boolean,coalesce(p_payload->>'tip','')) on conflict(tenant_id,booking_id,person_id) do update set repeat=excluded.repeat,instruction_clarity=excluded.instruction_clarity,tip=excluded.tip,version=app.pwa_feedback.version+1 returning id,app.pwa_feedback.version into v_id,v_version;
  insert into app.pwa_feedback_revisions(tenant_id,feedback_id,revision,repeat,instruction_clarity,tip,actor_auth_user_id) values(p_tenant_id,v_id,v_version,(p_payload->>'repeat')::boolean,(p_payload->>'instruction_clarity')::boolean,coalesce(p_payload->>'tip',''),v_actor);
  update app.bookings set version=app.bookings.version+1 where tenant_id=p_tenant_id and id=p_resource_id;
 when 'ask_question' then
  select id,app.households.version into v_household,v_version from app.households where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_household is null or not internal.can_access_household(p_tenant_id,v_household,'view_progress') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  v_booking:=(p_payload->>'booking_id')::uuid;if v_booking is not null and not internal.pwa_owns_booking(p_tenant_id,v_booking) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  insert into app.pwa_questions(tenant_id,household_id,person_id,booking_id,subject,body) values(p_tenant_id,v_household,v_person,v_booking,p_payload->>'subject',p_payload->>'body') returning id,app.pwa_questions.version into v_id,v_version;
  insert into app.pwa_question_history(tenant_id,question_id,question_version,state,actor_auth_user_id) values(p_tenant_id,v_id,1,'open',v_actor);
 when 'take_question' then
  select * into strict v_row from app.pwa_questions where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.has_permission(p_tenant_id,'household.review','household',v_row.household_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_row.state<>'open' then raise exception using errcode='55000',message='QUESTION_ALREADY_TAKEN';end if;
  update app.pwa_questions set state='in_progress',version=app.pwa_questions.version+1 where id=p_resource_id returning app.pwa_questions.version into v_version;
  insert into app.pwa_question_history(tenant_id,question_id,question_version,state,actor_auth_user_id) values(p_tenant_id,p_resource_id,v_version,'in_progress',v_actor);
 when 'answer_question' then
  select * into strict v_row from app.pwa_questions where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.has_permission(p_tenant_id,'household.review','household',v_row.household_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if length(btrim(p_payload->>'answer')) not between 1 and 4000 then raise exception using errcode='22023',message='INVALID_ANSWER';end if;
  update app.pwa_questions set answer=p_payload->>'answer',state='answered',version=app.pwa_questions.version+1 where id=p_resource_id returning app.pwa_questions.version into v_version;
  insert into app.pwa_question_history(tenant_id,question_id,question_version,state,actor_auth_user_id,answer) values(p_tenant_id,p_resource_id,v_version,'answered',v_actor,p_payload->>'answer');
 when 'create_channel' then
  if p_payload->>'scope'='team' then
   if not internal.has_permission(p_tenant_id,'team_task.manage','team',p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
   select app.teams.version into v_version from app.teams where tenant_id=p_tenant_id and id=p_resource_id;
  elsif p_payload->>'scope'='committee' then
   if not internal.has_permission(p_tenant_id,'committee.workspace.view','committee',p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
   select app.committees.version into v_version from app.committees where tenant_id=p_tenant_id and id=p_resource_id;
  else raise exception using errcode='22023',message='INVALID_SCOPE';end if;
  if v_version is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  insert into app.pwa_channels(tenant_id,scope_kind,scope_id,title) values(p_tenant_id,p_payload->>'scope',p_resource_id,p_payload->>'title') returning id,app.pwa_channels.version into v_id,v_version;
 when 'send_message' then
  if not internal.pwa_can_channel(p_tenant_id,p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select app.pwa_channels.version into v_version from app.pwa_channels where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  insert into app.pwa_messages(tenant_id,channel_id,person_id,body) values(p_tenant_id,p_resource_id,v_person,p_payload->>'body') returning id,app.pwa_messages.version into v_id,v_version;
 when 'mark_inbox_read' then
  select * into v_row from app.pwa_notifications where tenant_id=p_tenant_id and id=p_resource_id and recipient_person_id=v_person for update;
  if found then if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;update app.pwa_notifications set read_at=coalesce(read_at,statement_timestamp()),version=app.pwa_notifications.version+1 where id=p_resource_id returning app.pwa_notifications.version into v_version;
  else select * into strict v_row from app.inbox_items where tenant_id=p_tenant_id and id=p_resource_id and recipient_person_id=v_person for update;
   if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;update app.inbox_items set read_at=coalesce(read_at,statement_timestamp()),version=app.inbox_items.version+1 where id=p_resource_id returning app.inbox_items.version into v_version;end if;
 when 'mark_all_inbox_read' then
  if p_resource_id<>p_tenant_id or p_expected_version<>0 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  update app.pwa_notifications set read_at=statement_timestamp(),version=app.pwa_notifications.version+1 where tenant_id=p_tenant_id and recipient_person_id=v_person and read_at is null;
  update app.inbox_items set read_at=statement_timestamp(),version=app.inbox_items.version+1 where tenant_id=p_tenant_id and recipient_person_id=v_person and read_at is null;
 when 'save_preferences' then
  if p_resource_id<>p_tenant_id or jsonb_typeof(p_payload->'email')<>'boolean' or jsonb_typeof(p_payload->'push')<>'boolean' or jsonb_typeof(p_payload->'inbox')<>'boolean' then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  perform 1 from app.persons where tenant_id=p_tenant_id and id=v_person for update;
  select id,app.pwa_preferences.version into v_id,v_version from app.pwa_preferences where tenant_id=p_tenant_id and person_id=v_person for update;
  if coalesce(v_version,0)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_id is null then insert into app.pwa_preferences(tenant_id,person_id,email,push,inbox) values(p_tenant_id,v_person,(p_payload->>'email')::boolean,(p_payload->>'push')::boolean,(p_payload->>'inbox')::boolean) returning id,app.pwa_preferences.version into v_id,v_version;
  else update app.pwa_preferences set email=(p_payload->>'email')::boolean,push=(p_payload->>'push')::boolean,inbox=(p_payload->>'inbox')::boolean,version=app.pwa_preferences.version+1 where id=v_id returning app.pwa_preferences.version into v_version;end if;
  update app.pwa_preferences set reminders=coalesce((p_payload->>'reminders')::boolean,reminders),team=coalesce((p_payload->>'team')::boolean,team),news=coalesce((p_payload->>'news')::boolean,news) where id=v_id;
 when 'dismiss_help' then
  if p_resource_id<>p_tenant_id or p_expected_version<>0 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  if (p_payload->>'topic_version')::integer<>1 or not exists(select 1 from app.help_topics h where h.topic_id=p_payload->>'topic_id' and h.topic_id like 'pwa.%') then raise exception using errcode='22023',message='UNKNOWN_HELP_TOPIC';end if;
  insert into app.pwa_help_preferences(tenant_id,person_id,topic,explanation_version) values(p_tenant_id,v_person,p_payload->>'topic_id',(p_payload->>'topic_version')::integer) on conflict(tenant_id,person_id,topic,explanation_version) do update set seen_at=app.pwa_help_preferences.seen_at returning id,app.pwa_help_preferences.version into v_id,v_version;
 when 'reset_help' then
  if p_resource_id<>p_tenant_id or p_expected_version<>0 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  delete from app.pwa_help_preferences where tenant_id=p_tenant_id and person_id=v_person;
 when 'enroll_course','withdraw_course' then
  select * into strict v_row from app.course_sessions where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_row.state<>'scheduled' or v_row.starts_at<=statement_timestamp() then raise exception using errcode='22023',message='COURSE_CLOSED';end if;
  if p_action='enroll_course' then
   select count(*) into v_count from app.course_enrollments where tenant_id=p_tenant_id and session_id=p_resource_id and state<>'cancelled';
   if v_row.capacity is not null and v_count>=v_row.capacity and not exists(select 1 from app.course_enrollments where tenant_id=p_tenant_id and session_id=p_resource_id and person_id=v_person and state='enrolled') then raise exception using errcode='P0001',message='CAPACITY_FULL';end if;
   insert into app.course_enrollments(tenant_id,session_id,person_id,enrolled_by_auth_user_id) values(p_tenant_id,p_resource_id,v_person,v_actor) on conflict(tenant_id,session_id,person_id) do update set state='enrolled',version=app.course_enrollments.version+1 where app.course_enrollments.state in ('cancelled','enrolled') returning id,app.course_enrollments.version into v_id,v_version;
  else update app.course_enrollments set state='cancelled',version=app.course_enrollments.version+1 where tenant_id=p_tenant_id and session_id=p_resource_id and person_id=v_person and state='enrolled' returning id,app.course_enrollments.version into v_id,v_version;end if;
  if v_id is null then raise exception using errcode='P0002',message='NOT_FOUND';end if;
 when 'rsvp_event' then
  select * into strict v_row from app.event_occurrences where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.can_person_view_event(p_tenant_id,v_person,v_row.event_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_payload->>'rsvp' not in ('accepted','declined','tentative') then raise exception using errcode='22023',message='INVALID_RSVP';end if;
  insert into app.event_attendees(tenant_id,occurrence_id,person_id,rsvp,responded_at) values(p_tenant_id,p_resource_id,v_person,p_payload->>'rsvp',statement_timestamp()) on conflict(tenant_id,occurrence_id,person_id) do update set rsvp=excluded.rsvp,responded_at=excluded.responded_at,version=app.event_attendees.version+1 returning id,app.event_attendees.version into v_id,v_version;
 when 'create_card' then
  select * into strict v_row from app.kanban_boards where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.has_permission(p_tenant_id,'committee.workspace.manage','committee',v_row.committee_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if not exists(select 1 from app.kanban_columns c where c.tenant_id=p_tenant_id and c.board_id=p_resource_id and c.id=(p_payload->>'column_id')::uuid and not c.terminal) then raise exception using errcode='22023',message='INVALID_COLUMN';end if;
  if length(btrim(p_payload->>'title')) not between 1 and 200 or length(coalesce(p_payload->>'description',''))>4000 then raise exception using errcode='22023',message='INVALID_CARD';end if;
  insert into app.kanban_cards(tenant_id,board_id,column_id,title,description,created_by_auth_user_id,due_at) values(p_tenant_id,p_resource_id,(p_payload->>'column_id')::uuid,p_payload->>'title',p_payload->>'description',v_actor,(p_payload->>'due_at')::timestamptz) returning id,app.kanban_cards.version into v_id,v_version;
  if p_payload ? 'assignee_person_ids' then perform internal.pwa_set_card_assignees(p_tenant_id,v_id,array(select value::uuid from jsonb_array_elements_text(p_payload->'assignee_person_ids')));end if;
 when 'update_card','reply_card','check_card_item' then
  if p_action='check_card_item' then select * into strict v_other from app.card_checklist_items where tenant_id=p_tenant_id and id=p_resource_id for update;v_scope:=v_other.card_id;else v_scope:=p_resource_id;end if;
  select * into strict v_row from app.kanban_cards where tenant_id=p_tenant_id and id=v_scope for update;
  if not internal.can_person_view_card(p_tenant_id,v_person,v_scope) or (p_action<>'reply_card' and not internal.pwa_can_edit_card(p_tenant_id,v_scope)) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if (case when p_action='check_card_item' then v_other.version else v_row.version end)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_action='reply_card' then insert into app.pwa_card_replies(tenant_id,card_id,person_id,body) values(p_tenant_id,v_scope,v_person,p_payload->>'body') returning id,app.pwa_card_replies.version into v_id,v_version;
  elsif p_action='check_card_item' then
   if jsonb_typeof(p_payload->'completed')<>'boolean' then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
   update app.card_checklist_items set completed_at=case when (p_payload->>'completed')::boolean then statement_timestamp() end,completed_by_auth_user_id=case when (p_payload->>'completed')::boolean then v_actor end,version=app.card_checklist_items.version+1 where id=p_resource_id returning app.card_checklist_items.version into v_version;
  else
   if not exists(select 1 from app.kanban_columns c where c.tenant_id=p_tenant_id and c.id=(p_payload->>'column_id')::uuid and c.board_id=v_row.board_id) then raise exception using errcode='22023',message='INVALID_COLUMN';end if;
   if p_payload->>'status'='completed' then v_result:=internal.complete_kanban_card(p_tenant_id,p_resource_id,p_expected_version,v_inner_key);v_version:=(v_result->>'version')::bigint;
   elsif p_payload->>'status' in ('open','archived') then update app.kanban_cards set column_id=(p_payload->>'column_id')::uuid,status=p_payload->>'status',completed_at=null,version=app.kanban_cards.version+1 where id=p_resource_id returning app.kanban_cards.version into v_version;
   else raise exception using errcode='22023',message='INVALID_STATUS';end if;
   if p_payload ? 'due_at' then
    if not internal.has_permission(p_tenant_id,'committee.workspace.manage','committee',(select b.committee_id from app.kanban_boards b where b.tenant_id=p_tenant_id and b.id=v_row.board_id)) then raise exception using errcode='42501',message='FORBIDDEN';end if;
    update app.kanban_cards set due_at=(p_payload->>'due_at')::timestamptz where tenant_id=p_tenant_id and id=p_resource_id;
   end if;
   if p_payload ? 'assignee_person_ids' then perform internal.pwa_set_card_assignees(p_tenant_id,p_resource_id,array(select value::uuid from jsonb_array_elements_text(p_payload->'assignee_person_ids')));end if;
   insert into app.kanban_card_history(tenant_id,card_id,card_version,event_type,actor_auth_user_id,change_summary) values(p_tenant_id,p_resource_id,v_version,'pwa.card.changed',v_actor,jsonb_build_object('column_id',p_payload->>'column_id','status',p_payload->>'status'));
  end if;
 when 'open_transfer','report_obstruction' then
  select * into strict v_b from app.bookings where tenant_id=p_tenant_id and id=p_resource_id for update;
  if not internal.pwa_owns_booking(p_tenant_id,p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_b.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_b.state not in ('booked','transfer_pending','reconfirmation_required') then raise exception using errcode='22023',message='BOOKING_CLOSED';end if;
  insert into app.pwa_transfer_offers(tenant_id,booking_id,expires_at,reason) values(p_tenant_id,p_resource_id,coalesce((p_payload->>'expires_at')::timestamptz,greatest(statement_timestamp()+interval '1 day',v_b.starts_at_snapshot)),p_payload->>'reason') returning id into v_id;
  if (select expires_at from app.pwa_transfer_offers where id=v_id)<=statement_timestamp() then raise exception using errcode='22023',message='INVALID_DEADLINE';end if;
  -- Original remains accountable and occupied until final acceptance.
  v_result:=jsonb_build_object('offer_id',v_id,'origin_booking_id',p_resource_id);
 when 'accept_transfer' then
  select * into strict v_offer from app.pwa_transfer_offers where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_offer.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_offer.state<>'open' or v_offer.expires_at<=statement_timestamp() then raise exception using errcode='22023',message='OFFER_EXPIRED';end if;
  select * into strict v_b from app.bookings where tenant_id=p_tenant_id and id=v_offer.booking_id for update;
  select s.* into strict v_s from app.shift_positions p join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where p.tenant_id=p_tenant_id and p.id=v_b.position_id for update of s;
  v_target_person:=(p_payload->>'executor_person_id')::uuid;v_target_obligation:=(p_payload->>'obligation_id')::uuid;
  if not internal.can_book_executor(p_tenant_id,v_target_person,v_target_obligation) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if p_payload->'instructions_ack' is distinct from 'true'::jsonb or p_payload->'cancellation_ack' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='ACK_REQUIRED';end if;
  select * into strict v_instruction from app.pwa_instruction_versions where tenant_id=p_tenant_id and shift_id=v_s.id order by revision desc limit 1;
  if v_instruction.id is distinct from (p_payload->>'instruction_version_id')::uuid then raise exception using errcode='40001',message='INSTRUCTIONS_CHANGED';end if;
  select * into v_allocation from app.pwa_allocations where tenant_id=p_tenant_id and position_id=v_b.position_id and state<>'released' for update;
  if v_allocation.id is not null then
   select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=v_allocation.cluster_id;
   if not internal.pwa_can_team(p_tenant_id,v_cluster.team_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
   v_member:=(p_payload->>'member_person_id')::uuid;
   if not exists(select 1 from app.household_person_links l join app.household_obligation_links o on o.tenant_id=l.tenant_id and o.household_id=l.household_id and o.obligation_id=v_target_obligation and o.starts_at<=statement_timestamp() and (o.ends_at is null or o.ends_at>statement_timestamp()) join app.team_person_memberships m on m.tenant_id=l.tenant_id and m.person_id=l.person_id and m.team_id=v_cluster.team_id and m.membership_kind='player' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()) where l.tenant_id=p_tenant_id and l.person_id=v_member and l.starts_at<=statement_timestamp() and (l.ends_at is null or l.ends_at>statement_timestamp()) and internal.can_access_household(p_tenant_id,l.household_id,'book_for')) then raise exception using errcode='42501',message='INVALID_MEMBER';end if;
   insert into app.pwa_booking_authorizations(tenant_id,transaction_id,position_id,actor_auth_user_id) values(p_tenant_id,txid_current(),v_b.position_id,v_actor);
  end if;
  -- Canonical atomic transfer keeps its eligibility/overlap/obligation checks.
  -- Create the target-bound request under the verified old actor only internally:
  -- current actor cannot impersonate the old owner, so a direct PWA transfer uses
  -- the same slot/domain history transition with fresh executor validation.
  if v_b.state not in ('booked','transfer_pending') then raise exception using errcode='22023',message='BOOKING_CLOSED';end if;
  update app.bookings set state='transferred',version=app.bookings.version+1 where id=v_b.id;
  select * into strict v_row from internal.book_shift(p_tenant_id,v_s.id,v_b.position_id,v_target_person,v_target_obligation,v_s.version,v_inner_key);
  v_id:=v_row.resource_id;
  insert into app.pwa_booking_details(tenant_id,booking_id,instruction_version_id,instruction_body_snapshot,title_snapshot,location_snapshot,actor_auth_user_id,allocation_id,member_person_id) values(p_tenant_id,v_id,v_instruction.id,v_instruction.body,v_s.title,(select l.name from app.locations l where l.tenant_id=p_tenant_id and l.id=v_s.location_id),v_actor,v_allocation.id,v_member);
  insert into app.booking_events(tenant_id,booking_id,event_type,actor_auth_user_id,payload) values(p_tenant_id,v_b.id,'booking.transferred',v_actor,jsonb_build_object('replacement_booking_id',v_id));
  if v_allocation.id is not null then update app.pwa_allocations set state='booked',member_person_id=v_member,version=app.pwa_allocations.version+1 where id=v_allocation.id;end if;
  update app.pwa_transfer_offers set state='accepted',replacement_booking_id=v_id,version=app.pwa_transfer_offers.version+1 where id=p_resource_id;
  delete from app.pwa_booking_authorizations where transaction_id=txid_current() and tenant_id=p_tenant_id and actor_auth_user_id=v_actor;
  v_result:=jsonb_build_object('booking_id',v_id,'origin_booking_id',v_b.id);
 when 'create_club_task' then
  if p_resource_id<>p_tenant_id or p_expected_version<>0 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  select t.*,c.committee_id,x.category_id into strict v_row from app.task_type_versions t join app.task_types x on x.tenant_id=t.tenant_id and x.id=t.task_type_id join app.task_categories c on c.tenant_id=x.tenant_id and c.id=x.category_id where t.tenant_id=p_tenant_id and t.id=(p_payload->>'task_type_version_id')::uuid and x.active;
  if not internal.has_permission(p_tenant_id,'shift.manage','committee',v_row.committee_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  v_capacity:=coalesce((p_payload->>'capacity')::integer,1);v_repeat:=coalesce((p_payload->>'repeat_count')::integer,1);
  if v_capacity not between 1 and 30 or v_repeat not in(1,4,8) or length(btrim(coalesce(p_payload->>'instructions',''))) not between 1 and 4000 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  select timezone into v_timezone from app.tenants where id=p_tenant_id;
  for v_index in 0..v_repeat-1 loop
   v_start:=internal.pwa_repeat_time((p_payload->>'starts_at')::timestamptz,v_index,v_timezone);
   v_end:=internal.pwa_repeat_time((p_payload->>'ends_at')::timestamptz,v_index,v_timezone);
   if v_start<=statement_timestamp() or v_end<=v_start or not exists(select 1 from app.seasons z where z.tenant_id=p_tenant_id and z.id=(p_payload->>'season_id')::uuid and z.status='active' and (v_start at time zone v_timezone)::date>=z.starts_on and (v_end at time zone v_timezone)::date<=z.ends_on) then raise exception using errcode='22023',message='INVALID_INTERVAL';end if;
   select * into strict v_other from internal.manage_planboard_shift(p_tenant_id,null,'create','form',0,v_row.id,v_row.committee_id,v_row.category_id,p_payload->>'title',v_start,v_end,v_capacity,md5(v_inner_key::text||':draft:'||v_index)::uuid);
   v_id:=v_other.resource_id;v_version:=v_other.version;
   if coalesce((p_payload->>'min_qualified_count')::integer,0) not between 0 and v_capacity or ((p_payload->>'min_qualified_count')::integer>0 and (p_payload->>'qualification_type_id') is null) then raise exception using errcode='22023',message='INVALID_REQUIREMENTS';end if;
   insert into app.shift_requirements(tenant_id,shift_id,minimum_age,qualification_type_id,min_qualified_count,buddy_allowed) values(p_tenant_id,v_id,(p_payload->>'minimum_age')::integer,(p_payload->>'qualification_type_id')::uuid,coalesce((p_payload->>'min_qualified_count')::integer,0),coalesce((p_payload->>'buddy_allowed')::boolean,false));
   insert into app.pwa_instruction_versions(tenant_id,shift_id,revision,body,author_auth_user_id) values(p_tenant_id,v_id,1,p_payload->>'instructions',v_actor);
   perform internal.publish_shift_batch(p_tenant_id,array[v_id],array[v_version],statement_timestamp(),md5(v_inner_key::text||':publish:'||v_index)::uuid);
   select app.shifts.version into v_version from app.shifts where tenant_id=p_tenant_id and id=v_id;
   v_created:=v_created||jsonb_build_array(jsonb_build_object('shift_id',v_id,'capacity',v_capacity));
  end loop;
  v_result:=jsonb_build_object('series',v_created);
 when 'review_team_credit' then
  if p_payload->>'review_kind'='volunteer' and exists(select 1 from app.team_task_market_requests r where r.tenant_id=p_tenant_id and r.id=p_resource_id and r.referee_needed and not exists(select 1 from app.team_task_market_reviews mr where mr.tenant_id=r.tenant_id and mr.request_id=r.id and mr.request_version=r.version and mr.review_kind='match' and mr.outcome='approved')) then raise exception using errcode='55000',message='MATCH_REVIEW_REQUIRED';end if;
  v_result:=internal.review_team_task_market_request(p_tenant_id,p_resource_id,p_expected_version,p_payload->>'review_kind',p_payload->>'outcome',(p_payload->>'approved_minutes')::integer,p_payload->>'reason',v_inner_key);
  v_id:=(v_result->>'resource_id')::uuid;v_version:=(v_result->>'version')::bigint;
 when 'publish_team_credit' then
  v_result:=internal.publish_team_task_market_request(p_tenant_id,p_resource_id,p_expected_version,v_inner_key);
  v_id:=p_resource_id;v_version:=(v_result->>'version')::bigint;v_scope:=(v_result->>'shift_id')::uuid;
  select x.*,t.team_id,r.starts_at,r.ends_at,r.title into strict v_row from app.pwa_team_task_sources x join app.team_tasks t on t.tenant_id=x.tenant_id and t.id=x.team_task_id join app.team_task_market_requests r on r.tenant_id=x.tenant_id and r.id=x.request_id where x.tenant_id=p_tenant_id and x.request_id=p_resource_id for update of x;
  if v_row.starts_at<=statement_timestamp() then raise exception using errcode='22023',message='INVALID_INTERVAL';end if;
  update app.pwa_team_task_sources set shift_id=v_scope,version=app.pwa_team_task_sources.version+1 where id=v_row.id;
  insert into app.pwa_instruction_versions(tenant_id,shift_id,revision,body,author_auth_user_id) values(p_tenant_id,v_scope,1,v_row.instructions,v_actor);
  insert into app.pwa_clusters(tenant_id,season_id,team_id,title,mode,self_until,assign_until) values(p_tenant_id,v_row.season_id,v_row.team_id,v_row.title,'self',v_row.starts_at-interval '1 minute',v_row.starts_at-interval '1 minute') returning id into v_team;
  for v_ordinal in 1..v_row.capacity loop
   if v_ordinal=1 then select id into v_position from app.shift_positions where tenant_id=p_tenant_id and shift_id=v_scope and ordinal=1;
   else insert into app.shift_positions(tenant_id,shift_id,ordinal,starts_at,ends_at) values(p_tenant_id,v_scope,v_ordinal,v_row.starts_at,v_row.ends_at) returning id into v_position;end if;
   insert into app.pwa_allocations(tenant_id,cluster_id,position_id,counts_for_team) values(p_tenant_id,v_team,v_position,v_row.counts_for_team);
  end loop;
 when 'create_team_task' then
  if not internal.has_permission(p_tenant_id,'team_task.manage','team',p_resource_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select app.teams.version into v_version from app.teams where tenant_id=p_tenant_id and id=p_resource_id for update;
  if v_version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select t.*,c.committee_id,x.category_id into strict v_row from app.task_type_versions t join app.task_types x on x.tenant_id=t.tenant_id and x.id=t.task_type_id join app.task_categories c on c.tenant_id=x.tenant_id and c.id=x.category_id where t.tenant_id=p_tenant_id and t.id=(p_payload->>'task_type_version_id')::uuid and x.active;
  v_count:=coalesce((p_payload->>'requested_minutes')::integer,0);
  if v_count not between 0 and 1440 then raise exception using errcode='22023',message='INVALID_CREDIT';end if;
  if coalesce((p_payload->>'referee_needed')::boolean,false) and not exists(select 1 from app.matches m where m.tenant_id=p_tenant_id and m.id=(p_payload->>'match_id')::uuid and m.team_id=p_resource_id) then raise exception using errcode='22023',message='MATCH_REQUIRED';end if;
  v_capacity:=coalesce((p_payload->>'capacity')::integer,1);v_repeat:=coalesce((p_payload->>'repeat_count')::integer,1);
  if v_capacity not between 1 and 30 or v_repeat not in (1,4,8) or length(btrim(coalesce(p_payload->>'instructions',''))) not between 1 and 4000 then raise exception using errcode='22023',message='INVALID_TEAM_TASK';end if;
  select timezone into v_timezone from app.tenants where id=p_tenant_id;
  for v_index in 0..v_repeat-1 loop
   v_start:=internal.pwa_repeat_time((p_payload->>'starts_at')::timestamptz,v_index,v_timezone);
   v_end:=internal.pwa_repeat_time((p_payload->>'ends_at')::timestamptz,v_index,v_timezone);
   if v_start<=statement_timestamp() or v_end<=v_start or not exists(select 1 from app.seasons z where z.tenant_id=p_tenant_id and z.id=(p_payload->>'season_id')::uuid and z.status='active' and (v_start at time zone v_timezone)::date>=z.starts_on and (v_end at time zone v_timezone)::date<=z.ends_on) then raise exception using errcode='22023',message='INVALID_INTERVAL';end if;
   insert into app.team_tasks(tenant_id,team_id,title,due_at,created_by_auth_user_id) values(p_tenant_id,p_resource_id,p_payload->>'title',v_start,v_actor) returning id into v_id;
   if v_count>0 then
    insert into app.team_task_market_requests(tenant_id,team_task_id,match_id,referee_needed,committee_id,category_id,task_type_version_id,title,starts_at,ends_at,requested_minutes,requested_by_auth_user_id) values(p_tenant_id,v_id,(p_payload->>'match_id')::uuid,coalesce((p_payload->>'referee_needed')::boolean,false),v_row.committee_id,v_row.category_id,v_row.id,p_payload->>'title',v_start,v_end,v_count,v_actor) returning id into v_scope;
    insert into app.pwa_team_task_sources(tenant_id,team_task_id,season_id,request_id,capacity,instructions,counts_for_team) values(p_tenant_id,v_id,(p_payload->>'season_id')::uuid,v_scope,v_capacity,p_payload->>'instructions',coalesce((p_payload->>'counts_for_team')::boolean,true));
    v_created:=v_created||jsonb_build_array(jsonb_build_object('team_task_id',v_id,'request_id',v_scope,'capacity',v_capacity,'state','requested'));
   else
    insert into app.shifts(tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at) values(p_tenant_id,v_row.id,v_row.committee_id,v_row.category_id,p_payload->>'title',v_start,v_end,0,coalesce(v_row.cancellation_minutes_override,0),'published',statement_timestamp()) returning id into v_scope;
    insert into app.pwa_team_task_sources(tenant_id,team_task_id,season_id,shift_id,capacity,instructions,counts_for_team) values(p_tenant_id,v_id,(p_payload->>'season_id')::uuid,v_scope,v_capacity,p_payload->>'instructions',coalesce((p_payload->>'counts_for_team')::boolean,true));
    insert into app.pwa_instruction_versions(tenant_id,shift_id,revision,body,author_auth_user_id) values(p_tenant_id,v_scope,1,p_payload->>'instructions',v_actor);
    insert into app.pwa_clusters(tenant_id,season_id,team_id,title,mode,self_until,assign_until) values(p_tenant_id,(p_payload->>'season_id')::uuid,p_resource_id,p_payload->>'title','self',v_start-interval '1 minute',v_start-interval '1 minute') returning id into v_team;
    for v_ordinal in 1..v_capacity loop
     insert into app.shift_positions(tenant_id,shift_id,ordinal,starts_at,ends_at) values(p_tenant_id,v_scope,v_ordinal,v_start,v_end) returning id into v_position;
     insert into app.pwa_allocations(tenant_id,cluster_id,position_id,counts_for_team) values(p_tenant_id,v_team,v_position,coalesce((p_payload->>'counts_for_team')::boolean,true));
    end loop;
    v_created:=v_created||jsonb_build_array(jsonb_build_object('team_task_id',v_id,'shift_id',v_scope,'cluster_id',v_team,'capacity',v_capacity));
   end if;
  end loop;
  v_result:=jsonb_build_object('series',v_created);v_version:=1;
 when 'save_push_subscription' then
  if p_resource_id<>p_tenant_id then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  insert into app.pwa_push_subscriptions(tenant_id,person_id,endpoint,p256dh,auth_secret) values(p_tenant_id,v_person,p_payload->>'endpoint',p_payload->>'p256dh',p_payload->>'auth_secret') on conflict(tenant_id,person_id,endpoint) do update set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,revoked_at=null,version=app.pwa_push_subscriptions.version+1 returning id,app.pwa_push_subscriptions.version into v_id,v_version;
  insert into app.pwa_preferences(tenant_id,person_id,push) values(p_tenant_id,v_person,true) on conflict(tenant_id,person_id) do update set push=true,version=app.pwa_preferences.version+1;
  v_result:=jsonb_build_object('push',true,'preference_version',(select p.version from app.pwa_preferences p where p.tenant_id=p_tenant_id and p.person_id=v_person));
 when 'revoke_push_subscription' then
  if p_resource_id<>p_tenant_id then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  update app.pwa_push_subscriptions set revoked_at=statement_timestamp(),version=app.pwa_push_subscriptions.version+1 where tenant_id=p_tenant_id and person_id=v_person and endpoint=p_payload->>'endpoint' returning id,app.pwa_push_subscriptions.version into v_id,v_version;
  if v_id is null then v_id:=p_resource_id;v_version:=1;end if;
  if not exists(select 1 from app.pwa_push_subscriptions sub where sub.tenant_id=p_tenant_id and sub.person_id=v_person and sub.revoked_at is null) then update app.pwa_preferences set push=false,version=app.pwa_preferences.version+1 where tenant_id=p_tenant_id and person_id=v_person and push;end if;
 else raise exception using errcode='22023',message='UNKNOWN_ACTION';
 end case;
 if v_id is null or v_version is null then raise exception using errcode='P0002',message='NOT_FOUND';end if;
 insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,idempotency_key,payload_minimal)
 values(p_tenant_id,v_actor,'pwa.'||p_action,'pwa_resource',v_id,'tenant',p_tenant_id,p_idempotency_key,jsonb_build_object('resource_id',p_resource_id,'expected_version',p_expected_version));
 insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)
 values(v_event,p_tenant_id,'pwa_resource',v_id,v_version,'pwa.'||p_action,jsonb_build_object('resource_id',v_id));
 v_path:=case when p_action in ('book_shift','cancel_booking','confirm_attendance','prepare_booking','open_transfer','report_obstruction','accept_transfer') then (select '/app/tasks?task='||pos.shift_id::text||'&booking='||b.id::text from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where b.tenant_id=p_tenant_id and b.id=case when p_action in ('book_shift','accept_transfer') then v_id else p_resource_id end)
 when p_action in ('create_card','update_card','reply_card','check_card_item') then '/app/committees?card='||coalesce(v_scope,case when p_action='create_card' then v_id else p_resource_id end)::text
 when p_action in ('set_team_goal','apply_distribution','create_team_task') then '/app/teams?team='||p_resource_id::text
 when p_action in ('prepare_handover','save_handover_draft','accept_handover','revoke_handover') then (select '/app/teams?team='||h.team_id::text||'&handover='||h.id::text from app.pwa_handovers h where h.tenant_id=p_tenant_id and h.id=v_id)
 when p_action in ('reserve_cluster','set_followup') then (select '/app/teams?team='||cl.team_id::text from app.pwa_clusters cl where cl.tenant_id=p_tenant_id and cl.id=v_id)
 when p_action in ('assign_member','request_reserve') then (select '/app/teams?team='||cl.team_id::text||'&allocation='||a.id::text from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where a.tenant_id=p_tenant_id and a.id=p_resource_id)
 when p_action in ('ask_question','take_question','answer_question') then '/app/actions?question='||v_id::text
 when p_action='send_message' then '/app/messages?channel='||p_resource_id::text
 else '/app/actions' end;
 -- Secrets and message/question contents are never placed in domain/audit data.
 if p_action not in ('dismiss_help','reset_help','mark_inbox_read','mark_all_inbox_read','save_preferences','save_push_subscription','revoke_push_subscription') then perform internal.pwa_notify(p_tenant_id,v_person,v_event,'Cluvo bijgewerkt','Je wijziging is door de vereniging opgeslagen.',coalesce(v_path,'/app/actions'));end if;
 if p_action='answer_question' then perform internal.pwa_notify(p_tenant_id,v_row.person_id,v_event,'Antwoord op je vraag','Je vraag heeft een antwoord gekregen.',coalesce(v_path,'/app/actions'));end if;
 if p_action='prepare_handover' then perform internal.pwa_notify(p_tenant_id,v_target_person,v_event,'Teamoverdracht klaar','Je kunt de klaargezette versie lezen en accepteren.',coalesce(v_path,'/app/teams'));end if;
 if p_action='request_reserve' then for v_target_person in select recipient_person_id from app.pwa_reserve_requests where tenant_id=p_tenant_id and allocation_id=p_resource_id loop perform internal.pwa_notify(p_tenant_id,v_target_person,v_event,'Vrijwillige reservehulp gevraagd','Er is gevraagd of je op een concrete plek wilt helpen.','/app/tasks?allocation='||p_resource_id::text);end loop;end if;
 v_receipt:=jsonb_build_object('resource_id',v_id,'version',v_version,'event_ids',jsonb_build_array(v_event),'result',v_result);
 perform internal.finish_idempotency(p_tenant_id,'pwa',p_idempotency_key,v_receipt);
 return query select true,v_id,v_version,array[v_event],v_result;
end;$$;

create function api.pwa_command(p_tenant_id uuid,p_action text,p_resource_id uuid,p_expected_version bigint,p_payload jsonb,p_idempotency_key uuid)
returns table(ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb) language sql security invoker set search_path='' as $$select * from internal.pwa_command(p_tenant_id,p_action,p_resource_id,p_expected_version,p_payload,p_idempotency_key);$$;
create function internal.pwa_command_status(p_tenant_id uuid,p_idempotency_key uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r app.idempotency_records%rowtype;begin
 if not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('pwa:'||p_tenant_id::text||':'||internal.current_actor_uid()::text||':'||p_idempotency_key::text,0));
 select * into r from app.idempotency_records where tenant_id=p_tenant_id and actor_auth_user_id=internal.current_actor_uid() and operation=any(array['pwa','save_intake_revision','cancel_booking','confirm_attendance','join_shift_waitlist','express_vacancy_interest','accept_policy_assignments','create_household_invitation_v2']) and idempotency_key=p_idempotency_key order by completed_at desc nulls last limit 1;
 return case when r.id is null then jsonb_build_object('status','rejected') when r.status='completed' then jsonb_build_object('status','confirmed','receipt',case when r.operation='pwa' then r.result_jsonb else jsonb_build_object('ok',true,'resource_id',r.result_jsonb->'resource_id','version',r.result_jsonb->'version') end) else jsonb_build_object('status','pending') end;
end;$$;
create function api.pwa_command_status(p_tenant_id uuid,p_idempotency_key uuid) returns jsonb language sql volatile security invoker set search_path='' as $$select internal.pwa_command_status(p_tenant_id,p_idempotency_key);$$;

do $owners$ declare r record;begin
 for r in select p.oid::regprocedure sig,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','internal') and p.proname like 'pwa_%' loop
  execute format('alter function %s owner to cluvo_command_owner',r.sig);execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);
  if r.proname in ('pwa_command','pwa_command_status') then execute format('grant execute on function %s to authenticated',r.sig);end if;
 end loop;
end;$owners$;
revoke create on schema api from cluvo_command_owner;
commit;
