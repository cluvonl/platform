-- Voluntary reserve help is a committee action after the assignment deadline.
-- Keep team membership/progress visibility and every existing permission grant.
begin;
do $reserve_committee_scope$
declare d text;a text;r text;target regprocedure;
 owner_before oid;acl_before aclitem[];config_before text[];
 definer_before boolean;volatility_before "char";
begin
 target:='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure;
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid=target;
 d:=pg_get_functiondef(target);
 a:=$source$ v_old:=internal.claim_idempotency(p_tenant_id,'pwa',p_idempotency_key,$source$;
 r:=$replacement$ if p_action='request_reserve' then
  -- Match booking's shift mutex and shift-before-allocation lock order. No
  -- deadline/scope edit can race the concrete action check or recipient fit.
  perform internal.pwa_shift_mutex(p_tenant_id,(select pos.shift_id from app.pwa_allocations al join app.shift_positions pos on pos.tenant_id=al.tenant_id and pos.id=al.position_id where al.tenant_id=p_tenant_id and al.id=p_resource_id));
  select s.* into strict v_s from app.pwa_allocations al join app.shift_positions pos on pos.tenant_id=al.tenant_id and pos.id=al.position_id join app.shifts s on s.tenant_id=pos.tenant_id and s.id=pos.shift_id where al.tenant_id=p_tenant_id and al.id=p_resource_id for share of s;
  select * into strict v_allocation from app.pwa_allocations where tenant_id=p_tenant_id and id=p_resource_id for update;
  select * into strict v_cluster from app.pwa_clusters where tenant_id=p_tenant_id and id=v_allocation.cluster_id for share;
  -- Reauthorize after all waits, including before returning an old receipt.
  if not internal.has_permission(p_tenant_id,'shift.manage','committee',v_s.committee_id) or v_allocation.state='released' then raise exception using errcode='42501',message='FORBIDDEN';end if;
 end if;
$replacement$||a;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_119_RESERVE_REPLAY_SOURCE_MISMATCH';end if;
 d:=replace(d,a,r);
 a:=$source$ when 'request_reserve' then
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
$source$;
 r:=$replacement$ when 'request_reserve' then
  if v_allocation.version is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_allocation.state<>'assigned' or v_cluster.state<>'active' or statement_timestamp()<v_cluster.assign_until or v_s.state<>'published' or v_s.starts_at<=statement_timestamp()
   or exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.position_id=v_allocation.position_id and b.state not in('cancelled','transferred'))
  then raise exception using errcode='55000',message='RESERVE_PHASE_NOT_STARTED';end if;
  if v_allocation.member_person_id is null then raise exception using errcode='22023',message='ASSIGN_MEMBER_FIRST';end if;
  if jsonb_typeof(p_payload->'person_ids') is distinct from 'array' then raise exception using errcode='22023',message='INVALID_RECIPIENTS';end if;
  if jsonb_array_length(p_payload->'person_ids') not between 1 and 20 then raise exception using errcode='22023',message='INVALID_RECIPIENTS';end if;
  for v_target_person in select distinct value::uuid from jsonb_array_elements_text(p_payload->'person_ids') loop
   -- A reserve may be an adult from a team player's household; the adult
   -- need not be a player. Current household links and player membership bind
   -- this pool to the exact receiving team, without exposing either relation.
   if not exists(select 1 from app.household_person_links reserve_link
    join app.household_person_links player_link on player_link.tenant_id=reserve_link.tenant_id and player_link.household_id=reserve_link.household_id
    join app.team_person_memberships player on player.tenant_id=player_link.tenant_id and player.person_id=player_link.person_id
    where reserve_link.tenant_id=p_tenant_id and reserve_link.person_id=v_target_person
     and reserve_link.starts_at<=statement_timestamp() and(reserve_link.ends_at is null or reserve_link.ends_at>statement_timestamp())
     and player_link.starts_at<=statement_timestamp() and(player_link.ends_at is null or player_link.ends_at>statement_timestamp())
     and player.team_id=v_cluster.team_id and player.membership_kind='player'
     and player.starts_at<=statement_timestamp() and(player.ends_at is null or player.ends_at>statement_timestamp()))
   then raise exception using errcode='42501',message='RESERVE_TEAM_HOUSEHOLD_REQUIRED';end if;
   if not internal.pwa_executor_fits(p_tenant_id,v_target_person,v_s.id) then raise exception using errcode='42501',message='NOT_ELIGIBLE';end if;
   if not exists(select 1 from app.intake_profiles p join app.intake_answers_versions a on a.tenant_id=p.tenant_id and a.profile_id=p.id and a.revision=p.current_revision where p.tenant_id=p_tenant_id and p.person_id=v_target_person and a.answers->'reserve_willing'='true'::jsonb) then raise exception using errcode='42501',message='RESERVE_OPT_IN_REQUIRED';end if;
   insert into app.pwa_reserve_requests(tenant_id,allocation_id,recipient_person_id) values(p_tenant_id,p_resource_id,v_target_person) on conflict do nothing;
  end loop;
  v_version:=v_allocation.version;
$replacement$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_119_COMMAND_SOURCE_MISMATCH';end if;
 d:=replace(d,a,r);
 a:=$source$ if p_action='request_reserve' then for v_target_person in select recipient_person_id from app.pwa_reserve_requests where tenant_id=p_tenant_id and allocation_id=p_resource_id loop perform internal.pwa_notify(p_tenant_id,v_target_person,v_event,'Vrijwillige reservehulp gevraagd','Er is gevraagd of je op een concrete plek wilt helpen.','/app/tasks?allocation='||p_resource_id::text);end loop;end if;$source$;
 r:=$replacement$ if p_action='request_reserve' then
  -- Fan out only this command's fully validated choice. Historical recipients
  -- may have opted out or left the team and must never receive a new request.
  for v_target_person in select distinct value::uuid from jsonb_array_elements_text(p_payload->'person_ids') loop
   -- The shift mutex serializes requests across actors. Retain each command's
   -- receipt/audit while notifying this person at most once per place/local day.
   if not exists(select 1 from app.pwa_notifications n join app.domain_events e on e.tenant_id=n.tenant_id and e.id=n.event_id
    where n.tenant_id=p_tenant_id and n.recipient_person_id=v_target_person
     and e.event_type='pwa.request_reserve' and e.payload_minimal->>'resource_id'=p_resource_id::text
     and n.source_path='/app/tasks?allocation='||p_resource_id::text
     and(n.created_at at time zone(select timezone from app.tenants where id=p_tenant_id))::date
      =(statement_timestamp()at time zone(select timezone from app.tenants where id=p_tenant_id))::date)
   then perform internal.pwa_notify(p_tenant_id,v_target_person,v_event,'Vrijwillige reservehulp gevraagd','Er is gevraagd of je op een concrete plek wilt helpen.','/app/tasks?allocation='||p_resource_id::text);end if;
  end loop;
 end if;$replacement$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_119_RESERVE_FANOUT_SOURCE_MISMATCH';end if;
 d:=replace(d,a,r);
 a:=$source$if p_action not in ('dismiss_help','reset_help','mark_inbox_read','mark_all_inbox_read','save_preferences','save_push_subscription','revoke_push_subscription','open_policy') then perform internal.pwa_notify$source$;
 r:=$replacement$if p_action not in ('dismiss_help','reset_help','mark_inbox_read','mark_all_inbox_read','save_preferences','save_push_subscription','revoke_push_subscription','open_policy') and not(p_action='request_reserve' and exists(select 1 from jsonb_array_elements_text(p_payload->'person_ids') chosen(id) where chosen.id::uuid=v_person)) then perform internal.pwa_notify$replacement$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_119_RESERVE_SELF_NOTIFICATION_SOURCE_MISMATCH';end if;
 d:=replace(d,a,r);
 execute d;
 if exists(select 1 from pg_proc where oid=target
  and(proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))
 then raise exception 'PWA_119_COMMAND_AUTHORITY_METADATA_CHANGED';end if;
 target:='internal.pwa_snapshot(uuid,uuid,uuid)'::regprocedure;
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid=target;
 d:=pg_get_functiondef(target);
 a:=$source$a.state='assigned' and cl.assign_until<=statement_timestamp() and s.starts_at>statement_timestamp() and internal.has_permission(p_tenant_id,'team_task.manage','team',cl.team_id)$source$;
 r:=$replacement$a.state='assigned' and a.member_person_id is not null and cl.state='active' and cl.assign_until<=statement_timestamp() and s.state='published' and s.starts_at>statement_timestamp() and not exists(select 1 from app.bookings rb where rb.tenant_id=a.tenant_id and rb.position_id=a.position_id and rb.state not in('cancelled','transferred')) and internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id)$replacement$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_119_TEAM_ALLOCATION_CAPABILITY_SOURCE_MISMATCH';end if;
 d:=replace(d,a,r);
 a:=$source$ v_data:=v_data||jsonb_build_object('reserve_candidates',coalesce((select jsonb_agg(jsonb_build_object('allocation_id',a.id,'person_id',p.id,'name',concat_ws(' ',p.given_name,p.family_name),'suitable',true)) from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id join app.shift_positions pos on pos.tenant_id=a.tenant_id and pos.id=a.position_id join app.persons p on p.tenant_id=a.tenant_id join app.intake_profiles ip on ip.tenant_id=p.tenant_id and ip.person_id=p.id join app.intake_answers_versions iv on iv.tenant_id=ip.tenant_id and iv.profile_id=ip.id and iv.revision=ip.current_revision where a.tenant_id=p_tenant_id and a.state='assigned' and cl.assign_until<=statement_timestamp() and internal.has_permission(p_tenant_id,'team_task.manage','team',cl.team_id) and iv.answers->'reserve_willing'='true'::jsonb and internal.pwa_executor_fits(p_tenant_id,p.id,pos.shift_id)),'[]'));$source$;
 r:=$replacement$ v_data:=v_data||jsonb_build_object('reserve_candidates',coalesce((
  select jsonb_agg(jsonb_build_object('allocation_id',a.id,'person_id',p.id,'name',concat_ws(' ',p.given_name,p.family_name),'suitable',true) order by a.id,p.id)
  from app.pwa_allocations a
  join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id
  join app.shift_positions pos on pos.tenant_id=a.tenant_id and pos.id=a.position_id
  join app.shifts s on s.tenant_id=pos.tenant_id and s.id=pos.shift_id
  join app.persons p on p.tenant_id=a.tenant_id
  join app.intake_profiles ip on ip.tenant_id=p.tenant_id and ip.person_id=p.id
  join app.intake_answers_versions iv on iv.tenant_id=ip.tenant_id and iv.profile_id=ip.id and iv.revision=ip.current_revision
  where a.tenant_id=p_tenant_id and a.state='assigned' and a.member_person_id is not null and cl.state='active'
   and (v_season is null or cl.season_id=v_season) and cl.assign_until<=statement_timestamp()
   and s.state='published' and s.starts_at>statement_timestamp()
   and not exists(select 1 from app.bookings b where b.tenant_id=a.tenant_id and b.position_id=a.position_id and b.state not in('cancelled','transferred'))
   and internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id)
   and exists(select 1 from app.household_person_links reserve_link
    join app.household_person_links player_link on player_link.tenant_id=reserve_link.tenant_id and player_link.household_id=reserve_link.household_id
    join app.team_person_memberships player on player.tenant_id=player_link.tenant_id and player.person_id=player_link.person_id
    where reserve_link.tenant_id=p_tenant_id and reserve_link.person_id=p.id
     and reserve_link.starts_at<=statement_timestamp() and(reserve_link.ends_at is null or reserve_link.ends_at>statement_timestamp())
     and player_link.starts_at<=statement_timestamp() and(player_link.ends_at is null or player_link.ends_at>statement_timestamp())
     and player.team_id=cl.team_id and player.membership_kind='player'
     and player.starts_at<=statement_timestamp() and(player.ends_at is null or player.ends_at>statement_timestamp()))
   and iv.answers->'reserve_willing'='true'::jsonb and internal.pwa_executor_fits(p_tenant_id,p.id,s.id)
 ),'[]'));
 -- Committee follow-up needs concrete places, never the team's household
 -- progress, intake answers, member identities or delegated booking authority.
 v_data:=v_data||jsonb_build_object('committee_allocations',coalesce((
  select jsonb_agg(jsonb_build_object('id',a.id,'version',a.version,'state',a.state,
   'cluster_id',cl.id,'cluster_version',cl.version,'committee_id',s.committee_id,'team_id',cl.team_id,
   'shift_id',s.id,'position_id',pos.id,'ordinal',pos.ordinal,'title',s.title,'starts_at',s.starts_at,'ends_at',s.ends_at,
   'self_until',cl.self_until,'assign_until',cl.assign_until,
   'can_request_reserve',a.state='assigned' and a.member_person_id is not null and cl.assign_until<=statement_timestamp()
    and not exists(select 1 from app.bookings b where b.tenant_id=a.tenant_id and b.position_id=a.position_id and b.state not in('cancelled','transferred'))) order by s.starts_at,pos.ordinal,a.id)
  from app.pwa_allocations a
  join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id
  join app.shift_positions pos on pos.tenant_id=a.tenant_id and pos.id=a.position_id
  join app.shifts s on s.tenant_id=pos.tenant_id and s.id=pos.shift_id
  where a.tenant_id=p_tenant_id and cl.state='active' and a.state in('reserved','assigned')
   and (v_season is null or cl.season_id=v_season) and s.state='published' and s.starts_at>statement_timestamp()
   and internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id)
 ),'[]'));$replacement$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_119_RESERVE_PROJECTIONS_SOURCE_MISMATCH';end if;
 d:=replace(d,a,r);
 execute d;
 if exists(select 1 from pg_proc where oid=target
  and(proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))
 then raise exception 'PWA_119_SNAPSHOT_AUTHORITY_METADATA_CHANGED';end if;
end;$reserve_committee_scope$;
commit;
