-- Administrative projections and commands reuse the canonical V1 sources.
begin;
grant create on schema internal,api to cluvo_command_owner;
insert into app.permissions(permission_key,description) values
 ('organization.access.manage','Benoemde scoped toegang beheren; geen impliciet bestuursrecht'),
 ('hour_dispute.review','Uurgeschillen beoordelen; uitvoeringscorrecties behouden hun eigen commissieautorisatie')on conflict do nothing;
insert into app.role_permissions(tenant_id,role_id,permission_key)
 select tenant_id,id,'hour_dispute.review'from app.permission_roles where role_key in('volunteer_coordinator','volunteer_committee')on conflict do nothing;
create function internal.admin_seed_review_permission()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.role_key in('volunteer_coordinator','volunteer_committee')then insert into app.role_permissions(tenant_id,role_id,permission_key)values(new.tenant_id,new.id,'hour_dispute.review')on conflict do nothing;end if;return new;end;$$;
alter function internal.admin_seed_review_permission()owner to cluvo_command_owner;
revoke all on function internal.admin_seed_review_permission()from public,anon,authenticated,service_role;
create trigger admin_seed_review_permission after insert on app.permission_roles for each row execute function internal.admin_seed_review_permission();
alter table app.hour_disputes add column reviewer_auth_user_id uuid references auth.users(id),
 add column reviewed_attendance_decision_id uuid,
 add column resolution_decision_id uuid,
 add column resolved_by_auth_user_id uuid references auth.users(id),add column resolved_at timestamptz,
 add column resolution_reason text,add column resolution_outcome text check(resolution_outcome in('unchanged','corrected','rejected')),
 add foreign key(tenant_id,reviewed_attendance_decision_id)references app.attendance_decisions(tenant_id,id),
 add foreign key(tenant_id,resolution_decision_id)references app.attendance_decisions(tenant_id,id);
alter table app.platform_support_requests add column support_membership_id uuid,
 add foreign key(tenant_id,support_membership_id) references app.tenant_memberships(tenant_id,id) on delete restrict;

-- Committee service membership is distinct from account authorization.
alter table app.committees add column contact_name text not null default '' check(length(contact_name)<=150),
 add column contact_email text not null default '' check(contact_email=''or contact_email~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 add column contact_phone text not null default '' check(length(contact_phone)<=40);
create table app.committee_person_memberships(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id),committee_id uuid not null,person_id uuid not null,
 duty text not null check(length(btrim(duty))between 1 and 150),starts_at timestamptz not null default statement_timestamp(),ends_at timestamptz,
 version bigint not null default 1 check(version>0),created_at timestamptz not null default statement_timestamp(),updated_at timestamptz not null default statement_timestamp(),
 foreign key(tenant_id,committee_id)references app.committees(tenant_id,id),foreign key(tenant_id,person_id)references app.persons(tenant_id,id),
 unique(tenant_id,id),check(ends_at is null or ends_at>starts_at));
create unique index committee_person_memberships_current on app.committee_person_memberships(tenant_id,committee_id,person_id)where ends_at is null;
alter table app.committee_person_memberships enable row level security;
alter table app.committee_person_memberships force row level security;
revoke all on app.committee_person_memberships from public,anon,authenticated,service_role;
create policy native_session_required on app.committee_person_memberships as restrictive for all to authenticated using((select internal.actor_has_active_session()))with check((select internal.actor_has_active_session()));

-- Retain replaced team agreements without introducing another goal ledger.
alter table app.pwa_team_goals add column agreement_history jsonb not null default '[]'check(jsonb_typeof(agreement_history)='array');
create function internal.admin_preserve_team_goal_agreement()returns trigger language plpgsql security invoker set search_path=''as $$begin
 if new.agreement_history is distinct from old.agreement_history then raise exception using errcode='42501',message='IMMUTABLE_AGREEMENT_HISTORY';end if;
 if new.goal is distinct from old.goal or new.reason is distinct from old.reason or new.version<>old.version then
  new.agreement_history:=old.agreement_history||jsonb_build_array(jsonb_build_object('version',old.version,'goal',old.goal,'reason',old.reason,'replaced_at',statement_timestamp(),'recorded_by_auth_user_id',internal.current_actor_uid()));end if;return new;end;$$;
alter function internal.admin_preserve_team_goal_agreement()owner to cluvo_command_owner;
revoke all on function internal.admin_preserve_team_goal_agreement()from public,anon,authenticated,service_role;
create trigger admin_preserve_team_goal_agreement before update on app.pwa_team_goals for each row execute function internal.admin_preserve_team_goal_agreement();
alter table app.season_close_runs add column team_summary_snapshot jsonb check(team_summary_snapshot is null or jsonb_typeof(team_summary_snapshot)='array');

alter table app.person_qualifications add column version bigint not null default 1 check(version>0);

insert into app.help_topics(topic_id) select 'admin.club.'||id||'.v1' from unnest(array['cockpit','organization','people','access','committees','teams','planning','execution','requests','policies','courses','communication','reports','finance','seasons','support'])id on conflict do nothing;
insert into app.help_topics(topic_id) select 'admin.platform.'||id||'.v1' from unnest(array['overview','tenants','staff','defaults','integrations','support','audit'])id on conflict do nothing;

create view internal.canonical_obligation_status
with (security_invoker = true)
as
with ledger as (
  select
    entry.tenant_id,
    entry.obligation_id,
    coalesce(sum(entry.minutes_delta), 0)::bigint as confirmed_minutes,
    coalesce(sum(entry.minutes_delta) filter (
      where entry.performed_at < season.winter_cutoff_at
    ), 0)::bigint as confirmed_before_winter
  from app.hour_ledger_entries as entry
  join app.obligations as obligation
    on obligation.tenant_id = entry.tenant_id and obligation.id = entry.obligation_id
  join app.seasons as season
    on season.tenant_id = obligation.tenant_id and season.id = obligation.season_id
  group by entry.tenant_id, entry.obligation_id
), booking_rollup as (
  select
    booking.tenant_id,
    booking.obligation_id,
    coalesce(sum(booking.credit_minutes_snapshot) filter (
      where booking.state in ('booked', 'reconfirmation_required', 'transfer_pending')
    ), 0)::bigint as planned_minutes,
    coalesce(sum(booking.credit_minutes_snapshot) filter (
      where booking.state = 'performed_pending'
    ), 0)::bigint as pending_minutes,
    count(*) filter (
      where booking.state = 'performed_pending'
        and booking.starts_at_snapshot < season.winter_cutoff_at
    )::integer as pending_before_winter_count
  from app.bookings as booking
  join app.obligations as obligation
    on obligation.tenant_id = booking.tenant_id and obligation.id = booking.obligation_id
  join app.seasons as season
    on season.tenant_id = obligation.tenant_id and season.id = obligation.season_id
  group by booking.tenant_id, booking.obligation_id
), latest_appointment_coverage as (
  select distinct on (decision.tenant_id, decision.obligation_id, decision.appointment_id)
    decision.tenant_id,
    decision.obligation_id,
    decision.appointment_id,
    decision.effect,
    decision.starts_on,
    decision.ends_on
  from app.obligation_coverage_decisions as decision
  where decision.source_kind = 'volunteer_appointment'
  order by
    decision.tenant_id,
    decision.obligation_id,
    decision.appointment_id,
    decision.decision_revision desc
), coverage as (
  select
    latest.tenant_id,
    latest.obligation_id,
    bool_or(
      latest.effect = 'household_exempt'
      and latest.starts_on <= (statement_timestamp() at time zone tenant.timezone)::date
      and (latest.ends_on is null
        or latest.ends_on >= (statement_timestamp() at time zone tenant.timezone)::date)
    ) as structurally_covered
  from latest_appointment_coverage as latest
  join app.tenants as tenant on tenant.id = latest.tenant_id
  group by latest.tenant_id, latest.obligation_id
)
select
  obligation.tenant_id,
  obligation.id as obligation_id,
  obligation.season_id,
  obligation.assessed_household_id as household_id,
  obligation.base_target_minutes,
  obligation.effective_target_minutes,
  obligation.effective_winter_minutes,
  obligation.ledger_revision,
  coalesce(ledger.confirmed_minutes, 0) as confirmed_minutes,
  coalesce(ledger.confirmed_before_winter, 0) as confirmed_before_winter_minutes,
  coalesce(booking_rollup.planned_minutes, 0) as planned_minutes,
  coalesce(booking_rollup.pending_minutes, 0) as pending_minutes,
  coalesce(booking_rollup.pending_before_winter_count, 0) as pending_before_winter_count,
  coalesce(
    internal.open_obligation_blocker_count(obligation.tenant_id, obligation.id),
    0
  ) as open_dispute_count,
  coalesce(coverage.structurally_covered, false) as structurally_covered,
  case
    when coalesce(coverage.structurally_covered, false) then 0
    else greatest(0, obligation.effective_target_minutes - coalesce(ledger.confirmed_minutes, 0))
  end as remaining_minutes,
  case
    when coalesce(coverage.structurally_covered, false) then 0
    else greatest(0, obligation.effective_winter_minutes - coalesce(ledger.confirmed_before_winter, 0))
  end as winter_deficit_minutes,
  case
    when coalesce(coverage.structurally_covered, false) then 'fulfilled_structural'
    when coalesce(ledger.confirmed_minutes, 0) >= obligation.effective_target_minutes then 'fulfilled_minutes'
    when obligation.status = 'review_hold' then 'review_hold'
    else 'active'
  end as annual_state,
  case
    when coalesce(coverage.structurally_covered, false) then 'not_required'
    when coalesce(booking_rollup.pending_before_winter_count, 0) > 0
      or coalesce(
        internal.open_obligation_blocker_count(obligation.tenant_id, obligation.id),
        0
      ) > 0 then 'needs_review'
    when coalesce(ledger.confirmed_before_winter, 0) >= obligation.effective_winter_minutes
      then 'reached'
    else 'deficit'
  end as winter_state
from app.obligations as obligation
left join ledger
  on ledger.tenant_id = obligation.tenant_id and ledger.obligation_id = obligation.id
left join booking_rollup
  on booking_rollup.tenant_id = obligation.tenant_id
 and booking_rollup.obligation_id = obligation.id
left join coverage
  on coverage.tenant_id = obligation.tenant_id and coverage.obligation_id = obligation.id;
-- One calculation feeds the personal view and the authorized administration.
-- Invoker execution retains each caller's existing underlying RLS policies.
revoke all on internal.canonical_obligation_status from public,anon,authenticated,service_role;
grant select on internal.canonical_obligation_status to authenticated,cluvo_command_owner;
create or replace view api.my_obligation_status with(security_invoker=true) as
 select * from internal.canonical_obligation_status status
 where internal.can_access_obligation_progress(status.tenant_id,status.obligation_id);

-- Team goals and counted executions use one projection for the app and reports.
create view internal.canonical_team_member_status with(security_invoker=true)as
 select m.tenant_id,m.team_id,m.person_id member_person_id,se.id season_id,
 coalesce((select g.goal from app.pwa_team_goals g where g.tenant_id=m.tenant_id and g.team_id=m.team_id and g.season_id=se.id and(g.member_person_id=m.person_id or g.member_person_id is null)order by g.member_person_id nulls last limit 1),0)goal,
 coalesce((select sum(e.count_delta)from app.pwa_team_execution_entries e where e.tenant_id=m.tenant_id and e.team_id=m.team_id and e.member_person_id=m.person_id and e.season_id=se.id),0)confirmed,
 (select count(*)from app.pwa_booking_details d join app.bookings b on b.tenant_id=d.tenant_id and b.id=d.booking_id join app.pwa_allocations a on a.tenant_id=d.tenant_id and a.id=d.allocation_id join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where d.tenant_id=m.tenant_id and d.member_person_id=m.person_id and cl.team_id=m.team_id and cl.season_id=se.id and a.counts_for_team and b.state in('booked','transfer_pending','reconfirmation_required','performed_pending'))planned,
 (select count(*)from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where a.tenant_id=m.tenant_id and a.member_person_id=m.person_id and cl.team_id=m.team_id and cl.season_id=se.id and a.counts_for_team and a.state='assigned')assigned
 from app.team_person_memberships m join app.seasons se on se.tenant_id=m.tenant_id
 where m.membership_kind='player'and m.starts_at<=statement_timestamp()and(m.ends_at is null or m.ends_at>statement_timestamp());
revoke all on internal.canonical_team_member_status from public,anon,authenticated,service_role;
grant select on internal.canonical_team_member_status to cluvo_command_owner;
do $team_projection$declare definition text;prior text:=$old_team$ v_data:=v_data||jsonb_build_object('team_progress',coalesce((select jsonb_agg(q.row) from (select jsonb_build_object('team_id',m.team_id,'member_person_id',m.person_id,'goal',coalesce((select g.goal from app.pwa_team_goals g where g.tenant_id=p_tenant_id and g.team_id=m.team_id and g.season_id=v_season and (g.member_person_id=m.person_id or g.member_person_id is null) order by g.member_person_id nulls last limit 1),0),'confirmed',coalesce((select sum(e.count_delta) from app.pwa_team_execution_entries e where e.tenant_id=p_tenant_id and e.team_id=m.team_id and e.member_person_id=m.person_id and e.season_id=v_season),0),'planned',(select count(*) from app.pwa_booking_details d join app.bookings b on b.tenant_id=d.tenant_id and b.id=d.booking_id join app.pwa_allocations a on a.tenant_id=d.tenant_id and a.id=d.allocation_id join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where d.tenant_id=p_tenant_id and d.member_person_id=m.person_id and cl.team_id=m.team_id and cl.season_id=v_season and a.counts_for_team and b.state in ('booked','transfer_pending','reconfirmation_required','performed_pending')),'assigned',(select count(*) from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where a.tenant_id=p_tenant_id and a.member_person_id=m.person_id and cl.team_id=m.team_id and cl.season_id=v_season and a.counts_for_team and a.state='assigned')) row from app.team_person_memberships m where m.tenant_id=p_tenant_id and m.membership_kind='player' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()) and internal.pwa_can_team(p_tenant_id,m.team_id) and (internal.has_permission(p_tenant_id,'team_task.manage','team',m.team_id) or internal.is_self_person(p_tenant_id,m.person_id) or exists(select 1 from app.household_person_links h where h.tenant_id=p_tenant_id and h.person_id=m.person_id and h.starts_at<=statement_timestamp() and (h.ends_at is null or h.ends_at>statement_timestamp()) and internal.can_access_household(p_tenant_id,h.household_id,'view_progress'))))q),'[]'));
$old_team$;replacement text:=$new_team$ v_data:=v_data||jsonb_build_object('team_progress',coalesce((select jsonb_agg(jsonb_build_object('team_id',m.team_id,'member_person_id',m.member_person_id,'goal',m.goal,'confirmed',m.confirmed,'planned',m.planned,'assigned',m.assigned)order by m.team_id,m.member_person_id)from internal.canonical_team_member_status m where m.tenant_id=p_tenant_id and m.season_id=v_season and internal.pwa_can_team(p_tenant_id,m.team_id)and(internal.has_permission(p_tenant_id,'team_task.manage','team',m.team_id)or internal.is_self_person(p_tenant_id,m.member_person_id)or exists(select 1 from app.household_person_links h where h.tenant_id=p_tenant_id and h.person_id=m.member_person_id and h.starts_at<=statement_timestamp()and(h.ends_at is null or h.ends_at>statement_timestamp())and internal.can_access_household(p_tenant_id,h.household_id,'view_progress')))),'[]'));
$new_team$;begin
 definition:=pg_get_functiondef('internal.pwa_snapshot(uuid,uuid,uuid)'::regprocedure);
 if position(prior in definition)=0 or(length(definition)-length(replace(definition,prior,'')))/length(prior)<>1 then raise exception 'ADMIN_TEAM_PROJECTION_COHORT_MISMATCH';end if;
 definition:=replace(definition,prior,replacement);
 prior:='v_data:=jsonb_build_object(''context'',v_context);';
 replacement:='v_context:=v_context||jsonb_build_object(''modules'',coalesce((select jsonb_object_agg(m.module_key,m.enabled)from app.platform_module_settings m where m.tenant_id=p_tenant_id),''{}''::jsonb));v_context:=jsonb_set(v_context,''{capabilities,reports}'',to_jsonb(coalesce((v_context#>>''{capabilities,reports}'')::boolean,false)and coalesce((v_context#>>''{modules,reporting}'')::boolean,true)));v_data:=jsonb_build_object(''context'',v_context);';
 if length(definition)-length(replace(definition,prior,''))<>length(prior)then raise exception'ADMIN_MODULE_PROJECTION_COHORT_MISMATCH';end if;
 execute replace(definition,prior,replacement);
end;$team_projection$;

create function internal.admin_capture_team_season_summary()returns trigger language plpgsql security definer set search_path=''as $$begin
 new.team_summary_snapshot:=coalesce((select jsonb_agg(to_jsonb(r)order by r.name,r.id)from(select t.id,t.name,
  (select count(*)from internal.canonical_team_member_status st where st.tenant_id=t.tenant_id and st.team_id=t.id and st.season_id=new.season_id)member_count,
  coalesce((select sum(st.goal)from internal.canonical_team_member_status st where st.tenant_id=t.tenant_id and st.team_id=t.id and st.season_id=new.season_id),0)goal_total,
  coalesce((select sum(st.confirmed)from internal.canonical_team_member_status st where st.tenant_id=t.tenant_id and st.team_id=t.id and st.season_id=new.season_id),0)confirmed_count,
  coalesce((select sum(st.planned)from internal.canonical_team_member_status st where st.tenant_id=t.tenant_id and st.team_id=t.id and st.season_id=new.season_id),0)planned_count,
  coalesce((select sum(st.assigned)from internal.canonical_team_member_status st where st.tenant_id=t.tenant_id and st.team_id=t.id and st.season_id=new.season_id),0)assigned_count
  from app.teams t where t.tenant_id=new.tenant_id)r),'[]');return new;end;$$;
alter function internal.admin_capture_team_season_summary()owner to cluvo_command_owner;
revoke all on function internal.admin_capture_team_season_summary()from public,anon,authenticated,service_role;
create trigger admin_capture_team_season_summary before insert on app.season_close_runs for each row execute function internal.admin_capture_team_season_summary();

-- Module availability gates new work. Existing bookings, cancellations,
-- execution, acceptance and historical reads retain their canonical routes.
create function internal.admin_assert_module(p_tenant uuid,p_operation text)returns void
language plpgsql stable security definer set search_path=''as $$
declare module text;begin
 if not internal.actor_has_active_session()or not internal.is_active_member(p_tenant)then raise exception using errcode='42501',message='FORBIDDEN';end if;
 module:=case when p_operation in('create_club_task','publish_task_batch','save_category','save_task_type','revise_task_type','publish_shift')then 'planning'
 when p_operation in('create_team_task','reserve_cluster','save_team')then 'teams'
 when p_operation in('save_course','save_course_session','enroll_course')then 'courses'
 when p_operation in('save_policy_draft','publish_policy')then 'policies'
 when p_operation in('save_template_draft','preview_template','queue_template_test','approve_template','publish_template','create_channel','send_message')then 'communication'
 when p_operation in('start_match_import','sportlink_save_connection')then 'sportlink'end;
 if module is not null and exists(select 1 from app.platform_module_settings m where m.tenant_id=p_tenant and m.module_key=module and not m.enabled)
 or p_operation='reserve_cluster'and exists(select 1 from app.platform_module_settings m where m.tenant_id=p_tenant and m.module_key='planning'and not m.enabled)then raise exception using errcode='55000',message='MODULE_UNAVAILABLE';end if;
end;$$;
alter function internal.admin_assert_module(uuid,text)owner to cluvo_command_owner;
revoke all on function internal.admin_assert_module(uuid,text)from public,anon,authenticated,service_role;
grant execute on function internal.admin_assert_module(uuid,text)to authenticated;

create function internal.club_admin_logo_valid(p_logo text)returns boolean language plpgsql immutable security invoker set search_path=''as $$
declare bytes bytea;begin
 if p_logo~'^/brand/[a-zA-Z0-9/_-]+[.](png|svg|webp)$'then return length(p_logo)<=200;end if;
 if p_logo is null or length(p_logo)>33000 or p_logo!~'^data:image/webp;base64,[A-Za-z0-9+/]+={0,2}$'then return false;end if;
 bytes:=decode(substr(p_logo,length('data:image/webp;base64,')+1),'base64');
 return octet_length(bytes)between 20 and 24576 and substring(bytes from 1 for 4)=decode('52494646','hex')and substring(bytes from 9 for 4)=decode('57454250','hex');
 exception when others then return false;end;$$;

create function internal.club_admin_can(p_tenant uuid,p_permission text,p_kind text default 'tenant',p_scope uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
 select internal.actor_has_active_session() and internal.has_permission(p_tenant,p_permission,p_kind,coalesce(p_scope,p_tenant));
$$;
create function internal.club_admin_access(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t app.tenants%rowtype;g jsonb;s jsonb;begin
 select * into t from app.tenants where slug=p_slug;
 if t.id is null or not internal.actor_has_active_session() then return jsonb_build_object('authorized',false);end if;
 select coalesce(jsonb_agg(distinct jsonb_build_object('key',rp.permission_key,'kind',a.scope_kind,'scope_id',coalesce(a.committee_id,a.team_id,a.household_id))), '[]') into g
 from app.access_grants a join app.role_permissions rp on rp.tenant_id=a.tenant_id and rp.role_id=a.role_id
 where a.tenant_id=t.id and a.auth_user_id=internal.current_actor_uid() and a.revoked_at is null and a.starts_at<=statement_timestamp() and (a.ends_at is null or a.ends_at>statement_timestamp())
 and rp.permission_key=any(array['organization.manage','organization.access.manage','shift.manage','attendance.confirm','committee.workspace.manage','team_task.manage','household.review','exception.review','exception.finalize','policy.manage','development.manage','communication.manage','finance.assessment.view','finance.assessment.prepare','finance.assessment.approve','finance.assessment.finalize','finance.fund.manage','report.season.view','match.import','season.close','season.rollover','vacancy.manage','volunteer_role.manage','hour_dispute.review','team_task.market.approve','team_task.market.publish','match.review','club_cluster.manage']);
 if jsonb_array_length(g)=0 or not internal.is_active_member(t.id) then return jsonb_build_object('authorized',false);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'purpose',x.purpose,'scope_kind',x.scope_kind,'scope_id',x.scope_id,'ends_at',x.ends_at,'consented_at',x.consented_at)),'[]') into s
 from app.platform_support_requests x where x.tenant_id=t.id and x.employee_auth_user_id=internal.current_actor_uid() and x.state='approved' and x.ends_at>statement_timestamp()
 and exists(select 1 from app.access_grants a where a.tenant_id=t.id and a.id=x.access_grant_id and a.revoked_at is null and a.ends_at>statement_timestamp());
 return jsonb_build_object('authorized',true,'tenant_id',t.id,'slug',t.slug,'name',t.name,'timezone',t.timezone,'status',t.status,'version',t.version,'permissions',g,'support',s,'branding',t.branding_json,'modules',coalesce((select jsonb_object_agg(module_key,enabled)from app.platform_module_settings where tenant_id=t.id),'{}'),
 'seasons',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status,'starts_on',starts_on,'ends_on',ends_on,'version',version) order by starts_on desc) from app.seasons where tenant_id=t.id),'[]'));
end;$$;

create function internal.club_admin_read(p_tenant uuid,p_section text,p_season uuid default null,p_resource uuid default null,p_query text default '',p_status text default '',p_limit integer default 100,p_offset integer default 0,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb:='[]'::jsonb;extras jsonb:='{}'::jsonb;t app.tenants%rowtype;ctx jsonb;org boolean;begin
 select * into t from app.tenants where id=p_tenant;
 ctx:=internal.club_admin_access(t.slug);
 if not coalesce((ctx->>'authorized')::boolean,false) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_section<>all(array['cockpit','organization','locations','people','households','access','committees','teams','catalogue','planning','execution','requests','policies','courses','communication','templates','reports','finance','fund','qualifications','vacancies','volunteer_roles','report_teams','report_occupancy','seasons','support','audit']) or p_section is null
 or p_limit not between 1 and 200 or p_offset not between 0 and 100000 or length(coalesce(p_query,''))>200 then raise exception using errcode='22023',message='INVALID_READ';end if;
 if p_season is not null and not exists(select 1 from app.seasons where tenant_id=p_tenant and id=p_season) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if jsonb_typeof(p_filters)is distinct from 'object'or exists(select 1 from jsonb_object_keys(p_filters)k where k<>all(array['committee_id','team_id','category_id','queue','starts_on','ends_on']))or exists(select 1 from jsonb_each_text(p_filters)f where f.key not in('queue','starts_on','ends_on')and f.value!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')then raise exception using errcode='22023',message='INVALID_FILTER';end if;
 if exists(select 1 from jsonb_each_text(p_filters)f where f.key in('starts_on','ends_on')and f.value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$')or(p_filters?'starts_on'and p_filters?'ends_on'and(p_filters->>'starts_on')::date>(p_filters->>'ends_on')::date)then raise exception using errcode='22023',message='INVALID_FILTER';end if;
 if p_filters?'queue'and coalesce(p_filters->>'queue','')<>all(array['','free','reserved','no_executor','review','deadlines','open','questions','exceptions','policy','transfers','disputes','vacancies','team_credit'])then raise exception using errcode='22023',message='INVALID_FILTER';end if;
 org:=internal.club_admin_can(p_tenant,'organization.manage');
 case p_section
 when 'organization' then
  if not org then raise exception using errcode='42501',message='FORBIDDEN';end if;
  rows:=jsonb_build_array(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'version',t.version,'branding',t.branding_json,'timezone',t.timezone,'locale',t.locale));
  extras:=jsonb_build_object('contact',(select jsonb_build_object('name',c.name,'email',c.email,'phone',c.phone,'version',c.version) from app.pwa_club_contacts c where tenant_id=p_tenant),'settings',(select jsonb_build_object('revision',revision,'cancellation_minutes',cancellation_minutes,'confirmation_days',confirmation_days,'dispute_days',dispute_days,'effective_from',effective_from) from app.tenant_settings_versions where tenant_id=p_tenant order by revision desc limit 1));
 when 'locations' then
  if not org and not exists(select 1 from jsonb_array_elements(ctx->'permissions')x where x->>'key'='shift.manage') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (select id,name,active,version from app.locations where tenant_id=p_tenant and (p_resource is null or id=p_resource) and (p_query='' or name ilike '%'||p_query||'%') order by name limit p_limit offset p_offset)r;
 when 'people' then
  if not org then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select p.id,p.given_name,p.family_name,p.given_name||' '||p.family_name name,p.status,p.version,p.membership_started_on,
   (select jsonb_agg(jsonb_build_object('auth_user_id',a.auth_user_id,'verified_at',a.verified_at)) from app.account_person_links a where a.tenant_id=p_tenant and a.person_id=p.id and a.revoked_at is null) accounts,
   (select jsonb_agg(jsonb_build_object('household_id',h.id,'label',h.label,'link_kind',l.kind)) from app.household_person_links l join app.households h on h.tenant_id=l.tenant_id and h.id=l.household_id where l.tenant_id=p_tenant and l.person_id=p.id and (l.ends_at is null or l.ends_at>statement_timestamp())) households
   from app.persons p where p.tenant_id=p_tenant and (p_resource is null or p.id=p_resource) and (p_status='' or p.status=p_status) and (p_query='' or p.given_name||' '||p.family_name ilike '%'||p_query||'%') order by p.family_name,p.given_name,p.id limit p_limit offset p_offset)r;
 when 'households' then
  if not org and not exists(select 1 from jsonb_array_elements(ctx->'permissions')x where x->>'key'='household.review') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select h.id,h.label name,h.status,h.version,(internal.can_access_household(p_tenant,h.id,'base')or internal.has_permission(p_tenant,'household.review','household',h.id))can_open_dossier,
   (select jsonb_agg(jsonb_build_object('id',i.id,'person_id',i.invited_person_id,'delivery_status',i.delivery_status,'accepted_at',i.accepted_at,'cancelled_at',i.cancelled_at,'expires_at',i.expires_at,'version',i.version)) from app.household_invitations i where i.tenant_id=p_tenant and i.household_id=h.id) invitations
   from app.households h where h.tenant_id=p_tenant and (org or internal.club_admin_can(p_tenant,'household.review','household',h.id)) and (p_resource is null or h.id=p_resource) and (p_query='' or h.label ilike '%'||p_query||'%') order by h.label,h.id limit p_limit offset p_offset)r;
 when 'access' then
  if not exists(select 1 from jsonb_array_elements(ctx->'permissions')x where x->>'key'='organization.access.manage') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select g.id,g.auth_user_id,g.role_id,pr.name role_name,g.scope_kind,coalesce(g.committee_id,g.team_id,g.household_id) scope_id,g.starts_at,g.ends_at,g.revoked_at,g.version,
    coalesce((select p.given_name||' '||p.family_name from app.account_person_links a join app.persons p on p.tenant_id=a.tenant_id and p.id=a.person_id where a.tenant_id=p_tenant and a.auth_user_id=g.auth_user_id and a.revoked_at is null limit 1),'Benoemd supportaccount') name
   from app.access_grants g join app.permission_roles pr on pr.tenant_id=g.tenant_id and pr.id=g.role_id where g.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'organization.access.manage',g.scope_kind,coalesce(g.committee_id,g.team_id,g.household_id,p_tenant)) and (p_resource is null or g.id=p_resource) order by g.created_at desc limit p_limit offset p_offset)r;
  extras:=jsonb_build_object('roles',coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name,'role_key',pr.role_key,'version',pr.version,'permissions',coalesce((select jsonb_agg(permission_key) from app.role_permissions rp where rp.tenant_id=p_tenant and rp.role_id=pr.id),'[]'))) from app.permission_roles pr where pr.tenant_id=p_tenant),'[]'));
  extras:=extras||jsonb_build_object('invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'auth_user_id',i.invited_auth_user_id,'name',coalesce((select p.given_name||' '||p.family_name from app.account_person_links a join app.persons p on p.tenant_id=a.tenant_id and p.id=a.person_id where a.tenant_id=p_tenant and a.auth_user_id=i.invited_auth_user_id and a.revoked_at is null limit 1),'Benoemd persoonlijk account'),
   'scope_kind',i.scope_kind,'permission_keys',i.permission_keys,'ends_at',i.ends_at,'expires_at',i.expires_at,'version',i.version,'invitation_status',case when i.state='pending'and i.expires_at<=statement_timestamp()then 'expired'else i.state end))
   from app.admin_access_invitations i where i.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'organization.access.manage',i.scope_kind,coalesce(i.scope_id,p_tenant))),'[]'::jsonb));
 when 'committees' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select c.id,c.name,c.slug,c.active,c.version,c.contact_name,c.contact_email,c.contact_phone,org can_edit,internal.club_admin_can(p_tenant,'committee.workspace.manage','committee',c.id)can_manage_members,
   coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'person_id',p.id,'name',p.given_name||' '||p.family_name,'duty',m.duty,'starts_at',m.starts_at,'ends_at',m.ends_at,'version',m.version)order by m.starts_at,m.id)from app.committee_person_memberships m join app.persons p on p.tenant_id=m.tenant_id and p.id=m.person_id where m.tenant_id=c.tenant_id and m.committee_id=c.id),'[]')members,
   coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'auth_user_id',g.auth_user_id,'role',r.name,'ends_at',g.ends_at)) from app.access_grants g join app.permission_roles r on r.tenant_id=g.tenant_id and r.id=g.role_id where g.tenant_id=p_tenant and g.committee_id=c.id and g.revoked_at is null and (g.ends_at is null or g.ends_at>statement_timestamp())),'[]') responsibilities
   from app.committees c where c.tenant_id=p_tenant and (org or internal.club_admin_can(p_tenant,'committee.workspace.manage','committee',c.id) or internal.club_admin_can(p_tenant,'shift.manage','committee',c.id)) and (p_resource is null or c.id=p_resource) and (p_query='' or c.name ilike '%'||p_query||'%') order by c.name limit p_limit offset p_offset)r;
 when 'volunteer_roles'then
  if not internal.club_admin_can(p_tenant,'volunteer_role.manage')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]')into rows from(select c.id,c.name,c.active,c.version,
   coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'household_exempt',v.household_exempt,'effective_from',v.effective_from,'effective_until',v.effective_until,'conditions',v.recognition_rules->>'conditions')order by v.revision desc)from app.volunteer_role_versions v where v.tenant_id=c.tenant_id and v.role_id=c.id),'[]')revisions
   from app.volunteer_role_catalog c where c.tenant_id=p_tenant and(p_resource is null or c.id=p_resource)and(p_query=''or c.name ilike '%'||p_query||'%')order by c.name,c.id limit p_limit offset p_offset)r;
 when 'vacancies'then
  if not internal.club_admin_can(p_tenant,'vacancy.manage')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]')into rows from(select v.id,v.title name,v.title,v.description,v.expected_minutes,v.guidance,v.contact_person_id,v.role_version_id,v.committee_id,v.team_id,v.opens_at,v.closes_at,v.state,v.version,
   (select count(*)from app.vacancy_interests i where i.tenant_id=v.tenant_id and i.vacancy_id=v.id)interested_count,
   (select p.given_name||' '||p.family_name from app.persons p where p.tenant_id=v.tenant_id and p.id=v.contact_person_id)contact_name,
   exists(select 1 from app.volunteer_role_versions rv where rv.tenant_id=v.tenant_id and rv.id=v.role_version_id and rv.household_exempt)exemption_possible
   from app.vacancies v where v.tenant_id=p_tenant and(p_resource is null or v.id=p_resource)and(p_query=''or v.title ilike '%'||p_query||'%')and(p_status=''or v.state=p_status)order by v.created_at desc,v.id limit p_limit offset p_offset)r;
  extras:=jsonb_build_object('role_versions',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',r.name||' · versie '||v.revision))from app.volunteer_role_versions v join app.volunteer_role_catalog r on r.tenant_id=v.tenant_id and r.id=v.role_id where v.tenant_id=p_tenant and r.active),'[]'));
 when 'teams' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select x.id,x.name,x.active,x.version,org can_edit,
   coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'person_id',p.id,'name',p.given_name||' '||p.family_name,'membership_kind',m.membership_kind,'starts_at',m.starts_at,'ends_at',m.ends_at,'version',m.version)) from app.team_person_memberships m join app.persons p on p.tenant_id=m.tenant_id and p.id=m.person_id where m.tenant_id=p_tenant and m.team_id=x.id),'[]') members,
   coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'member_person_id',g.member_person_id,'goal',g.goal,'version',g.version,'reason',g.reason,'agreement_history',g.agreement_history)) from app.pwa_team_goals g where g.tenant_id=p_tenant and g.team_id=x.id and g.season_id=p_season),'[]') goals,
   coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'predecessor_person_id',h.predecessor_person_id,'successor_person_id',h.successor_person_id,'state',h.state,'version',h.version,'accepted_at',h.accepted_at)) from app.pwa_handovers h where h.tenant_id=p_tenant and h.team_id=x.id and h.season_id=p_season),'[]') handovers
   from app.teams x where x.tenant_id=p_tenant and (org or internal.club_admin_can(p_tenant,'team_task.manage','team',x.id)) and (p_resource is null or x.id=p_resource) and (p_query='' or x.name ilike '%'||p_query||'%') and(coalesce(p_filters->>'queue','')<>'deadlines'or exists(select 1 from app.pwa_clusters cl where cl.tenant_id=p_tenant and cl.team_id=x.id and cl.state='active'and cl.assign_until<statement_timestamp()+interval '7 days'and(p_season is null or cl.season_id=p_season)and exists(select 1 from app.pwa_allocations a where a.tenant_id=cl.tenant_id and a.cluster_id=cl.id and a.state='reserved')))order by x.name limit p_limit offset p_offset)r;
 when 'catalogue' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select v.id,v.name,v.category_id,c.name category_name,c.committee_id,co.name committee_name,v.active,v.version,
   coalesce((select jsonb_agg(jsonb_build_object('id',tv.id,'revision',tv.revision,'credit_minutes',tv.credit_minutes,'cancellation_minutes_override',tv.cancellation_minutes_override,'requirements',tv.requirements_json,'published_at',tv.published_at) order by tv.revision desc) from app.task_type_versions tv where tv.tenant_id=p_tenant and tv.task_type_id=v.id),'[]') revisions
   from app.task_types v join app.task_categories c on c.tenant_id=v.tenant_id and c.id=v.category_id join app.committees co on co.tenant_id=c.tenant_id and co.id=c.committee_id
   where v.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'shift.manage','committee',c.committee_id) and (p_resource is null or v.id=p_resource) and (p_query='' or v.name ilike '%'||p_query||'%') order by v.name limit p_limit offset p_offset)r;
  extras:=jsonb_build_object('categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'committee_id',c.committee_id,'minimum_positions',c.minimum_positions,'version',c.version)) from app.task_categories c where c.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'shift.manage','committee',c.committee_id)),'[]'));
 when 'planning','execution' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select s.id,s.title name,s.starts_at,s.ends_at,s.state,s.version,s.committee_id,s.category_id,s.type_version_id,s.credit_minutes,c.name committee_name,loc.name location,
   coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'ordinal',p.ordinal,'state',p.state,'version',p.version,'cluster_id',a.cluster_id,'team_id',cl.team_id,'member_person_id',a.member_person_id,'allocation_state',a.state,'allocation_version',a.version)) from app.shift_positions p left join app.pwa_allocations a on a.tenant_id=p.tenant_id and a.position_id=p.id and a.state in('reserved','assigned','booked') left join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where p.tenant_id=p_tenant and p.shift_id=s.id and(internal.club_admin_can(p_tenant,'shift.manage','committee',s.committee_id)or internal.club_admin_can(p_tenant,'attendance.confirm','committee',s.committee_id)or internal.club_admin_can(p_tenant,'team_task.manage','team',cl.team_id))),'[]') positions,
   coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'version',b.version,'state',b.state,'executor_person_id',b.executor_person_id,'executor_name',p.given_name||' '||p.family_name,'credit_minutes',b.credit_minutes_snapshot,'can_confirm',internal.club_admin_can(p_tenant,'attendance.confirm','committee',s.committee_id))) from app.bookings b join app.persons p on p.tenant_id=b.tenant_id and p.id=b.executor_person_id where b.tenant_id=p_tenant and exists(select 1 from app.shift_positions bp where bp.tenant_id=b.tenant_id and bp.id=b.position_id and bp.shift_id=s.id)and(internal.club_admin_can(p_tenant,'shift.manage','committee',s.committee_id)or internal.club_admin_can(p_tenant,'attendance.confirm','committee',s.committee_id)or exists(select 1 from app.pwa_booking_details bd join app.pwa_allocations ba on ba.tenant_id=bd.tenant_id and ba.id=bd.allocation_id join app.pwa_clusters bc on bc.tenant_id=ba.tenant_id and bc.id=ba.cluster_id where bd.tenant_id=b.tenant_id and bd.booking_id=b.id and internal.club_admin_can(p_tenant,'team_task.manage','team',bc.team_id)))),'[]') bookings
   from app.shifts s join app.committees c on c.tenant_id=s.tenant_id and c.id=s.committee_id left join app.locations loc on loc.tenant_id=s.tenant_id and loc.id=s.location_id
   where s.tenant_id=p_tenant and(internal.club_admin_can(p_tenant,case when p_section='execution'then 'attendance.confirm'else 'shift.manage'end,'committee',s.committee_id)
    or p_section='planning'and exists(select 1 from app.pwa_allocations visible_allocation join app.pwa_clusters visible_cluster on visible_cluster.tenant_id=visible_allocation.tenant_id and visible_cluster.id=visible_allocation.cluster_id join app.shift_positions visible_position on visible_position.tenant_id=visible_allocation.tenant_id and visible_position.id=visible_allocation.position_id where visible_allocation.tenant_id=s.tenant_id and visible_position.shift_id=s.id and internal.club_admin_can(p_tenant,'team_task.manage','team',visible_cluster.team_id)))
   and (p_resource is null or s.id=p_resource) and (p_status='' or s.state=p_status) and (p_query='' or s.title ilike '%'||p_query||'%')
   and (p_season is null or s.starts_at>=(select starts_on::timestamptz from app.seasons where tenant_id=p_tenant and id=p_season) and s.starts_at<(select (ends_on+1)::timestamptz from app.seasons where tenant_id=p_tenant and id=p_season))
   and(not(p_filters?'starts_on')or s.starts_at>=((p_filters->>'starts_on')::date::timestamp at time zone t.timezone))and(not(p_filters?'ends_on')or s.starts_at<(((p_filters->>'ends_on')::date+1)::timestamp at time zone t.timezone))
   and(not(p_filters?'committee_id')or s.committee_id=(p_filters->>'committee_id')::uuid)and(not(p_filters?'category_id')or s.category_id=(p_filters->>'category_id')::uuid)
   and(not(p_filters?'team_id')or exists(select 1 from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id where a.tenant_id=s.tenant_id and cl.team_id=(p_filters->>'team_id')::uuid and(internal.club_admin_can(p_tenant,'shift.manage','committee',s.committee_id)or internal.club_admin_can(p_tenant,'attendance.confirm','committee',s.committee_id)or internal.club_admin_can(p_tenant,'team_task.manage','team',cl.team_id))and a.state in('reserved','assigned','booked')and exists(select 1 from app.shift_positions sp where sp.tenant_id=s.tenant_id and sp.id=a.position_id and sp.shift_id=s.id)))
   and(case coalesce(p_filters->>'queue','')
    when 'free'then internal.club_admin_can(p_tenant,'shift.manage','committee',s.committee_id)and exists(select 1 from app.shift_positions sp where sp.tenant_id=s.tenant_id and sp.shift_id=s.id and sp.state='open'and s.state='published'and s.ends_at>statement_timestamp()and not exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state not in('cancelled','transferred'))and not exists(select 1 from app.pwa_allocations a where a.tenant_id=sp.tenant_id and a.position_id=sp.id and a.state<>'released'))
    when 'reserved'then exists(select 1 from app.shift_positions sp join app.pwa_allocations a on a.tenant_id=sp.tenant_id and a.position_id=sp.id and a.state in('reserved','assigned')where sp.tenant_id=s.tenant_id and sp.shift_id=s.id and(internal.club_admin_can(p_tenant,'shift.manage','committee',s.committee_id)or exists(select 1 from app.pwa_clusters qc where qc.tenant_id=a.tenant_id and qc.id=a.cluster_id and internal.club_admin_can(p_tenant,'team_task.manage','team',qc.team_id))))
    when 'no_executor'then exists(select 1 from app.shift_positions sp join app.pwa_allocations a on a.tenant_id=sp.tenant_id and a.position_id=sp.id and a.state='assigned'where sp.tenant_id=s.tenant_id and sp.shift_id=s.id and(internal.club_admin_can(p_tenant,'shift.manage','committee',s.committee_id)or exists(select 1 from app.pwa_clusters qc where qc.tenant_id=a.tenant_id and qc.id=a.cluster_id and internal.club_admin_can(p_tenant,'team_task.manage','team',qc.team_id)))and not exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state not in('cancelled','transferred')))
    when 'review'then internal.club_admin_can(p_tenant,'attendance.confirm','committee',s.committee_id)and exists(select 1 from app.shift_positions sp join app.bookings b on b.tenant_id=sp.tenant_id and b.position_id=sp.id where sp.tenant_id=s.tenant_id and sp.shift_id=s.id and b.ends_at_snapshot<=statement_timestamp()and b.state in('booked','performed_pending'))
    else true end)
   and (p_section<>'execution' or s.ends_at<=statement_timestamp()) order by s.starts_at desc,s.id limit p_limit offset p_offset)r;
 when 'policies' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select d.id,d.title name,d.document_key,d.owner_committee_id,d.current_revision,d.status,d.version,
   coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'exact_body',v.exact_body,'state',v.state,'effective_at',v.effective_at,'response_due_at',v.response_due_at,'published_at',v.published_at,'reacceptance_required',v.reacceptance_required)) from app.policy_versions v where v.tenant_id=p_tenant and v.document_id=d.id),'[]') revisions,
   (select count(*) from app.policy_assignments a join app.policy_versions v on v.tenant_id=a.tenant_id and v.id=a.policy_version_id where a.tenant_id=p_tenant and v.document_id=d.id and v.revision=d.current_revision) offered,
   (select count(*) from app.policy_assignments a join app.policy_versions v on v.tenant_id=a.tenant_id and v.id=a.policy_version_id where a.tenant_id=p_tenant and v.document_id=d.id and v.revision=d.current_revision and a.state='accepted') accepted
   from app.policy_documents d where d.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'policy.manage',case when d.owner_committee_id is null then 'tenant' else 'committee' end,coalesce(d.owner_committee_id,p_tenant)) and (p_resource is null or d.id=p_resource) and (p_query='' or d.title ilike '%'||p_query||'%') and(coalesce(p_filters->>'queue','')<>'policy'or exists(select 1 from app.policy_assignments pa join app.policy_versions pv on pv.tenant_id=pa.tenant_id and pv.id=pa.policy_version_id where pa.tenant_id=d.tenant_id and pv.document_id=d.id and pa.state='offered'))order by d.title limit p_limit offset p_offset)r;
 when 'courses' then
  if not internal.club_admin_can(p_tenant,'development.manage') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select c.id,c.title name,c.description,c.active,c.version,
   coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'capacity',s.capacity,'state',s.state,'version',s.version,'qualification_type_id',s.qualification_type_id,'qualification_valid_until',s.qualification_valid_until,'enrollments',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'person_id',e.person_id,'name',(select p.given_name||' '||p.family_name from app.persons p where p.tenant_id=e.tenant_id and p.id=e.person_id),'qualification_name',(select qt.name from app.person_qualifications pq join app.qualification_types qt on qt.tenant_id=pq.tenant_id and qt.id=pq.qualification_type_id where pq.tenant_id=e.tenant_id and pq.id=e.qualification_id),'state',e.state,'version',e.version,'qualification_id',e.qualification_id)) from app.course_enrollments e where e.tenant_id=p_tenant and e.session_id=s.id),'[]'))) from app.course_sessions s where s.tenant_id=p_tenant and s.course_id=c.id),'[]') sessions
   from app.courses c where c.tenant_id=p_tenant and (p_resource is null or c.id=p_resource) and (p_query='' or c.title ilike '%'||p_query||'%') order by c.title limit p_limit offset p_offset)r;
  extras:=jsonb_build_object('qualification_types',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active,'version',version)) from app.qualification_types where tenant_id=p_tenant),'[]'));
 when 'templates' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select mt.id,mt.name,mt.template_key,mt.owner_scope,mt.committee_id,mt.version,mt.current_revision,mt.status,
   coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'revision',v.revision,'subject',v.subject,'preheader',v.preheader,'sender_name',v.sender_name,'reply_to',v.reply_to,'text_body',v.text_body,'state',v.state,'published_at',v.published_at,'button_label',v.button_json->0->>'label','image_path',v.variable_schema->>'image_path')) from app.message_template_versions v where v.tenant_id=p_tenant and v.template_id=mt.id),'[]') revisions
   from app.message_templates mt where mt.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'communication.manage',case when mt.committee_id is null then 'tenant' else 'committee' end,coalesce(mt.committee_id,p_tenant)) and (p_resource is null or mt.id=p_resource) and (p_query='' or mt.name ilike '%'||p_query||'%') order by mt.name limit p_limit offset p_offset)r;
  if p_resource is not null then extras:=jsonb_build_object('tests',coalesce((select jsonb_agg(jsonb_build_object('id',tr.id,'revision',v.revision,'status',tr.status,'last_delivery_state',tr.last_delivery_state,'error_code',tr.error_code,'created_at',tr.created_at,'rendered_subject',tr.rendered_subject,'rendered_text',tr.rendered_text,'version',tr.version)) from app.template_test_runs tr join app.message_template_versions v on v.tenant_id=tr.tenant_id and v.id=tr.template_version_id where tr.tenant_id=p_tenant and v.template_id=p_resource),'[]'));end if;
 when 'communication' then
  if not internal.club_admin_can(p_tenant,'communication.manage') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select channel,state,count(*) total,max(created_at) latest_at from app.pwa_delivery_outbox where tenant_id=p_tenant group by channel,state)r;
 when 'requests' then
  select coalesce(jsonb_agg(to_jsonb(result)),'[]') into rows from(select * from(select q.id,q.subject name,q.state,q.version,q.created_at,'household_question' kind,q.household_id,null::uuid current_revision_id
   from app.pwa_questions q where q.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'household.review','household',q.household_id)
   union all select e.id,e.case_type,e.state,e.version,e.created_at,'exception',o.assessed_household_id,(select er.id from app.exception_case_revisions er where er.tenant_id=e.tenant_id and er.case_id=e.id and er.revision=e.current_revision)
   from app.exception_cases e join app.obligations o on o.tenant_id=e.tenant_id and o.id=e.obligation_id where e.tenant_id=p_tenant and (p_season is null or o.season_id=p_season) and (internal.club_admin_can(p_tenant,'exception.review','household',o.assessed_household_id) or internal.club_admin_can(p_tenant,'exception.finalize'))
   union all select d.id,'Uurvraag: '||h.label,d.state,d.version,d.created_at,'hour_dispute',o.assessed_household_id,null::uuid
    from app.hour_disputes d join app.obligations o on o.tenant_id=d.tenant_id and o.id=d.obligation_id join app.households h on h.tenant_id=o.tenant_id and h.id=o.assessed_household_id
    where d.tenant_id=p_tenant and(p_season is null or o.season_id=p_season)and internal.club_admin_can(p_tenant,'hour_dispute.review')
   union all select i.id,v.title||' · '||p.given_name||' '||p.family_name,i.state,i.version,i.created_at,'vacancy_interest',null::uuid,null::uuid
    from app.vacancy_interests i join app.vacancies v on v.tenant_id=i.tenant_id and v.id=i.vacancy_id join app.persons p on p.tenant_id=i.tenant_id and p.id=i.person_id
    where i.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'vacancy.manage')
   union all select r.id,r.title,r.state,r.version,r.created_at,'team_credit',null::uuid,null::uuid
    from app.team_task_market_requests r join app.team_tasks tt on tt.tenant_id=r.tenant_id and tt.id=r.team_task_id left join app.pwa_team_task_sources src on src.tenant_id=r.tenant_id and src.request_id=r.id
    where r.tenant_id=p_tenant and(p_season is null or src.season_id=p_season)and(internal.club_admin_can(p_tenant,'team_task.manage','team',tt.team_id)or internal.club_admin_can(p_tenant,'team_task.market.approve')or internal.club_admin_can(p_tenant,'team_task.market.publish')or internal.club_admin_can(p_tenant,'match.review','team',tt.team_id))
   union all select offer.id,'Overname: '||sh.title,offer.state,offer.version,offer.created_at,'transfer',null::uuid,null::uuid
    from app.pwa_transfer_offers offer join app.bookings b on b.tenant_id=offer.tenant_id and b.id=offer.booking_id join app.obligations o on o.tenant_id=b.tenant_id and o.id=b.obligation_id join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id
    where offer.tenant_id=p_tenant and(p_season is null or o.season_id=p_season)and internal.club_admin_can(p_tenant,'shift.manage','committee',sh.committee_id))r where (p_resource is null or r.id=p_resource) and (p_status='' or r.state=p_status) and (p_query='' or r.name ilike '%'||p_query||'%')and(case coalesce(p_filters->>'queue','')when 'questions'then r.kind='household_question'and r.state in('open','in_progress')when 'exceptions'then r.kind='exception'and r.state in('submitted','in_review','escalated')when 'disputes'then r.kind='hour_dispute'and r.state in('open','in_review')when 'vacancies'then r.kind='vacancy_interest'and r.state in('interested','contacted','meeting')when 'team_credit'then r.kind='team_credit'and r.state in('requested','reviewing','approved')when 'transfers'then r.kind='transfer'and r.state='open'when 'open'then r.state in('open','in_progress','submitted','in_review','escalated','interested','contacted','meeting','requested','reviewing')else true end)order by r.created_at desc,r.id limit p_limit offset p_offset)result;
  if p_resource is not null and exists(select 1 from jsonb_array_elements(rows)x where x->>'kind'='exception') then
   extras:=jsonb_build_object('proposal',(select jsonb_build_object('practical_reason',er.practical_reason,'proposed_target_minutes',er.proposed_target_minutes,'proposed_winter_minutes',er.proposed_winter_minutes,'valid_from',er.valid_from,'valid_until',er.valid_until) from app.exception_case_revisions er join app.exception_cases ec on ec.tenant_id=er.tenant_id and ec.id=er.case_id where er.tenant_id=p_tenant and ec.id=p_resource and er.revision=ec.current_revision),
    'reviews',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'outcome',r.outcome,'has_conflict',r.has_conflict,'reviewed_at',r.reviewed_at,'reason',r.reason,'reviewer_person_id',r.reviewer_person_id)) from app.exception_reviews r join app.exception_case_revisions er on er.tenant_id=r.tenant_id and er.id=r.case_revision_id join app.exception_cases ec on ec.tenant_id=er.tenant_id and ec.id=er.case_id where r.tenant_id=p_tenant and ec.id=p_resource and er.revision=ec.current_revision),'[]'));
  end if;
  if p_resource is not null and exists(select 1 from jsonb_array_elements(rows)x where x->>'kind'='hour_dispute')then
   extras:=extras||jsonb_build_object('dispute',(select jsonb_build_object('description',d.description,'reviewer_auth_user_id',d.reviewer_auth_user_id,'outcome',d.resolution_outcome,'resolution_reason',d.resolution_reason,'resolved_at',d.resolved_at,'booking_id',b.id,'booking_version',b.version,'decision_id',b.current_attendance_decision_id,'shift_id',sp.shift_id,'credit_minutes',b.credit_minutes_snapshot)from app.hour_disputes d left join app.hour_ledger_entries le on le.tenant_id=d.tenant_id and le.id=d.ledger_entry_id left join app.bookings b on b.tenant_id=d.tenant_id and b.id=coalesce(d.booking_id,le.booking_id)left join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id where d.tenant_id=p_tenant and d.id=p_resource));
  end if;
  if p_resource is not null and exists(select 1 from jsonb_array_elements(rows)x where x->>'kind'='vacancy_interest')then
   extras:=extras||jsonb_build_object('interest',(select jsonb_build_object('motivation',i.motivation,'guidance',v.guidance,'expected_minutes',v.expected_minutes,'obligations',case when internal.club_admin_can(p_tenant,'volunteer_role.manage')then coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',h.label||' · '||se.name,'version',o.version))from app.obligations o join app.households h on h.tenant_id=o.tenant_id and h.id=o.assessed_household_id join app.seasons se on se.tenant_id=o.tenant_id and se.id=o.season_id where o.tenant_id=p_tenant and o.status in('active','fulfilled','review_hold')and se.status='active'and exists(select 1 from app.household_person_links hp where hp.tenant_id=o.tenant_id and hp.household_id=o.assessed_household_id and hp.person_id=i.person_id and hp.kind in('member','parent','guardian')and hp.starts_at<=statement_timestamp()and(hp.ends_at is null or hp.ends_at>statement_timestamp()))),'[]')else '[]'::jsonb end,'next_step',case i.state when 'interested'then 'Leg contact en bespreek de werkzaamheden'when 'contacted'then 'Plan de kennismaking'when 'meeting'then 'Beoordeel afzonderlijk de aanstelling en eventuele huishoudvrijstelling'else 'Afgerond; eerdere stappen blijven bewaard'end)from app.vacancy_interests i join app.vacancies v on v.tenant_id=i.tenant_id and v.id=i.vacancy_id where i.tenant_id=p_tenant and i.id=p_resource));
  end if;
  if p_resource is not null and exists(select 1 from jsonb_array_elements(rows)x where x->>'kind'='transfer')then
   extras:=extras||jsonb_build_object('transfer',(select jsonb_build_object('shift_id',sp.shift_id,'expires_at',f.expires_at,'replacement_booking_id',f.replacement_booking_id,'reason',f.reason,'origin_state',b.state)from app.pwa_transfer_offers f join app.bookings b on b.tenant_id=f.tenant_id and b.id=f.booking_id join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id where f.tenant_id=p_tenant and f.id=p_resource));
  end if;
  if p_resource is not null and jsonb_array_length(rows)>0 then extras:=extras||jsonb_build_object('request_history',coalesce((select jsonb_agg(jsonb_build_object('action',a.action,'actor_auth_user_id',a.actor_auth_user_id,'occurred_at',a.occurred_at,'reason',a.payload_minimal->>'reason','resulting_version',a.payload_minimal->'resulting_version'))from app.audit_events a where a.tenant_id=p_tenant and a.resource_id=p_resource),'[]'));end if;
 when 'reports','finance' then
  if p_section='reports'and exists(select 1 from app.platform_module_settings m where m.tenant_id=p_tenant and m.module_key='reporting'and not m.enabled)then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if not (case when p_section='finance' then internal.club_admin_can(p_tenant,'finance.assessment.view') or internal.club_admin_can(p_tenant,'finance.assessment.prepare') or internal.club_admin_can(p_tenant,'finance.assessment.approve') or internal.club_admin_can(p_tenant,'finance.assessment.finalize') else internal.club_admin_can(p_tenant,'report.season.view') end) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select o.id,o.assessed_household_id,h.label name,o.season_id,o.status,o.version,
   status.effective_target_minutes,status.effective_winter_minutes,status.ledger_revision,status.confirmed_minutes,status.confirmed_before_winter_minutes,
   status.planned_minutes,status.pending_minutes as review_minutes,status.remaining_minutes,status.winter_deficit_minutes,status.annual_state,status.winter_state,status.structurally_covered,status.open_dispute_count,
   coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'state',f.state,'version',f.version,'route',f.route,'current_revision',f.current_revision,'approved_at',f.approved_at,'finalized_at',f.finalized_at,'calculation',(select jsonb_build_object('proposed_cents',ar.proposed_cents,'missing_minutes',ar.missing_minutes,'confirmed_minutes',ar.confirmed_minutes,'ledger_revision',ar.ledger_revision,'blockers',ar.blockers) from app.assessment_revisions ar where ar.tenant_id=f.tenant_id and ar.assessment_id=f.id and ar.revision=f.current_revision))) from app.financial_assessments f where f.tenant_id=p_tenant and f.obligation_id=o.id),'[]') assessments
   from app.obligations o join app.households h on h.tenant_id=o.tenant_id and h.id=o.assessed_household_id
   join internal.canonical_obligation_status status on status.tenant_id=o.tenant_id and status.obligation_id=o.id
   where o.tenant_id=p_tenant and (p_season is null or o.season_id=p_season) and (p_resource is null or o.id=p_resource) and (p_query='' or h.label ilike '%'||p_query||'%') order by h.label,o.id limit p_limit offset p_offset)r;
  select jsonb_build_object('total_rows',count(*),'report_totals',jsonb_build_object('confirmed_minutes',coalesce(sum(c.confirmed_minutes),0),'planned_minutes',coalesce(sum(c.planned_minutes),0),'review_minutes',coalesce(sum(c.pending_minutes),0)),
   'report_revision',encode(extensions.digest(convert_to(coalesce(string_agg(jsonb_build_object('status',to_jsonb(c),'household_label',h.label)::text,',' order by c.obligation_id),''),'UTF8'),'sha256'),'hex')) into extras
   from internal.canonical_obligation_status c join app.households h on h.tenant_id=c.tenant_id and h.id=c.household_id
   where c.tenant_id=p_tenant and (p_season is null or c.season_id=p_season) and (p_resource is null or c.obligation_id=p_resource) and (p_query='' or h.label ilike '%'||p_query||'%');
  if p_section='finance' then
   extras:=extras||jsonb_build_object('fund_balance',(select to_jsonb(b) from api.volunteer_fund_balance b where b.tenant_id=p_tenant),
    'fund_entries',case when internal.club_admin_can(p_tenant,'finance.fund.manage') then coalesce((select jsonb_agg(to_jsonb(e)) from (select id,entry_kind,purpose,available_cents_delta,reserved_cents_delta,spent_cents_delta,reservation_key,processing_record_id,owner_person_id,created_at from app.volunteer_fund_entries where tenant_id=p_tenant order by created_at desc limit 200)e),'[]') else '[]'::jsonb end,
    'decisions',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',h.label||' · '||d.outcome,'obligation_id',d.obligation_id)) from app.exception_decisions d join app.obligations o on o.tenant_id=d.tenant_id and o.id=d.obligation_id join app.households h on h.tenant_id=o.tenant_id and h.id=o.assessed_household_id where d.tenant_id=p_tenant and (p_season is null or o.season_id=p_season) and (p_resource is null or o.id=p_resource) and d.outcome='approved'),'[]'),
    'supply_assessments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',h.label||' · '||a.outcome,'obligation_id',a.obligation_id)) from app.supply_assessments a join app.obligations o on o.tenant_id=a.tenant_id and o.id=a.obligation_id join app.households h on h.tenant_id=o.tenant_id and h.id=o.assessed_household_id where a.tenant_id=p_tenant and (p_season is null or o.season_id=p_season) and (p_resource is null or o.id=p_resource)),'[]'));
  end if;
 when 'report_teams','report_occupancy'then
  if exists(select 1 from app.platform_module_settings m where m.tenant_id=p_tenant and m.module_key='reporting'and not m.enabled)then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if not internal.club_admin_can(p_tenant,'report.season.view')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if p_season is null then raise exception using errcode='22023',message='SEASON_REQUIRED';end if;
  if p_section='report_teams'and exists(select 1 from app.seasons where tenant_id=p_tenant and id=p_season and status='closed')then
   select team_summary_snapshot into rows from app.season_close_runs where tenant_id=p_tenant and season_id=p_season;
   if rows is null then extras:=jsonb_build_object('historical_measurement_available',false);rows:='[]';else select coalesce(jsonb_agg(value order by value->>'name',value->>'id'),'[]')into rows from jsonb_array_elements(rows)where(p_resource is null or value->>'id'=p_resource::text)and(p_query=''or value->>'name'ilike '%'||p_query||'%');end if;
  elsif p_section='report_teams'then
   select coalesce(jsonb_agg(to_jsonb(r)order by r.name,r.id),'[]')into rows from(select team_row.id,team_row.name,
    (select count(*)from internal.canonical_team_member_status st where st.tenant_id=team_row.tenant_id and st.team_id=team_row.id and st.season_id=p_season)member_count,
    coalesce((select sum(st.goal)from internal.canonical_team_member_status st where st.tenant_id=team_row.tenant_id and st.team_id=team_row.id and st.season_id=p_season),0)goal_total,
    coalesce((select sum(st.confirmed)from internal.canonical_team_member_status st where st.tenant_id=team_row.tenant_id and st.team_id=team_row.id and st.season_id=p_season),0)confirmed_count,
    coalesce((select sum(st.planned)from internal.canonical_team_member_status st where st.tenant_id=team_row.tenant_id and st.team_id=team_row.id and st.season_id=p_season),0)planned_count,
    coalesce((select sum(st.assigned)from internal.canonical_team_member_status st where st.tenant_id=team_row.tenant_id and st.team_id=team_row.id and st.season_id=p_season),0)assigned_count
    from app.teams team_row where team_row.tenant_id=p_tenant and(p_resource is null or team_row.id=p_resource)and(p_query=''or team_row.name ilike '%'||p_query||'%'))r;
  else
   select coalesce(jsonb_agg(to_jsonb(r)order by r.starts_at,r.id),'[]')into rows from(select sh.id,sh.title name,sh.starts_at,sh.ends_at,sh.state,
    count(sp.id)total_places,count(sp.id)filter(where sp.state='open'and sh.state='published'and sh.ends_at>statement_timestamp()and not exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state not in('cancelled','transferred'))and not exists(select 1 from app.pwa_allocations a where a.tenant_id=sp.tenant_id and a.position_id=sp.id and a.state<>'released'))free_places,
    count(sp.id)filter(where exists(select 1 from app.pwa_allocations a where a.tenant_id=sp.tenant_id and a.position_id=sp.id and a.state in('reserved','assigned')))reserved_places,
    count(sp.id)filter(where exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state in('booked','transfer_pending','reconfirmation_required')))booked_places,
    count(sp.id)filter(where exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state in('booked','performed_pending')and b.ends_at_snapshot<=statement_timestamp()))review_places,
    count(sp.id)filter(where exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state='confirmed'))confirmed_places,
    count(sp.id)filter(where exists(select 1 from app.bookings b join app.attendance_decisions d on d.tenant_id=b.tenant_id and d.id=b.current_attendance_decision_id where b.tenant_id=sp.tenant_id and b.position_id=sp.id and d.result='no_show'))no_show_places
    from app.shifts sh join app.seasons se on se.tenant_id=sh.tenant_id and se.id=p_season left join app.shift_positions sp on sp.tenant_id=sh.tenant_id and sp.shift_id=sh.id
    where sh.tenant_id=p_tenant and(not(p_filters?'starts_on')or(sh.starts_at at time zone t.timezone)::date>=(p_filters->>'starts_on')::date)and(not(p_filters?'ends_on')or(sh.starts_at at time zone t.timezone)::date<=(p_filters->>'ends_on')::date)and(not(p_filters?'committee_id')or sh.committee_id=(p_filters->>'committee_id')::uuid)and(not(p_filters?'category_id')or sh.category_id=(p_filters->>'category_id')::uuid)and(not(p_filters?'team_id')or exists(select 1 from app.shift_positions pos join app.pwa_allocations allocation on allocation.tenant_id=pos.tenant_id and allocation.position_id=pos.id join app.pwa_clusters cluster on cluster.tenant_id=allocation.tenant_id and cluster.id=allocation.cluster_id where pos.tenant_id=sh.tenant_id and pos.shift_id=sh.id and cluster.team_id=(p_filters->>'team_id')::uuid))and(sh.starts_at at time zone t.timezone)::date>=se.starts_on and(sh.starts_at at time zone t.timezone)::date<=se.ends_on and(p_resource is null or sh.id=p_resource)and(p_query=''or sh.title ilike '%'||p_query||'%')and(p_status=''or sh.state=p_status)group by sh.id)r;
  end if;
  extras:=extras||jsonb_build_object('total_rows',jsonb_array_length(rows),'report_revision',encode(extensions.digest(convert_to(rows::text,'UTF8'),'sha256'),'hex'));
  select coalesce(jsonb_agg(value order by ordinal),'[]')into rows from jsonb_array_elements(rows)with ordinality x(value,ordinal)where ordinal>p_offset and ordinal<=p_offset+p_limit;
 when 'fund' then
  if not internal.club_admin_can(p_tenant,'finance.fund.manage')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]')into rows from(select id,entry_kind,purpose,available_cents_delta,reserved_cents_delta,spent_cents_delta,reservation_key,processing_record_id,owner_person_id,created_at from app.volunteer_fund_entries where tenant_id=p_tenant order by created_at desc,id limit p_limit offset p_offset)r;
  extras:=jsonb_build_object('fund_balance',(select to_jsonb(b)from api.volunteer_fund_balance b where b.tenant_id=p_tenant),'fund_entries',rows,
   'processing_records',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name','Grondslag '||r.created_at::date||' · '||r.amount_cents||' eurocent','amount_cents',r.amount_cents))from app.financial_processing_records r where r.tenant_id=p_tenant and r.state='prepared'),'[]'));
 when 'qualifications' then
  if not internal.club_admin_can(p_tenant,'development.manage')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]')into rows from(select q.id,q.person_id,p.given_name||' '||p.family_name name,qt.name qualification_name,q.achieved_at,q.expires_at,q.revoked_at,
   q.version
   from app.person_qualifications q join app.persons p on p.tenant_id=q.tenant_id and p.id=q.person_id join app.qualification_types qt on qt.tenant_id=q.tenant_id and qt.id=q.qualification_type_id
   where q.tenant_id=p_tenant and(p_resource is null or q.id=p_resource)and(p_query=''or p.given_name||' '||p.family_name ilike '%'||p_query||'%')order by p.family_name,q.id limit p_limit offset p_offset)r;
 when 'seasons' then
  if not org and not internal.club_admin_can(p_tenant,'season.close') and not internal.club_admin_can(p_tenant,'season.rollover') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select id,name,starts_on,ends_on,winter_cutoff_at,target_minutes,winter_target_minutes,status,version from app.seasons where tenant_id=p_tenant and (p_resource is null or id=p_resource) order by starts_on desc limit p_limit offset p_offset)r;
 when 'support' then
  if not internal.club_admin_can(p_tenant,'organization.access.manage') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select id,employee_auth_user_id,purpose name,permission_keys,scope_kind,scope_id,ends_at,state,version,consented_at,created_at from app.platform_support_requests where tenant_id=p_tenant and (p_resource is null or id=p_resource) order by created_at desc limit p_limit offset p_offset)r;
 when 'audit' then
  if not internal.club_admin_can(p_tenant,'organization.access.manage') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,occurred_at from app.audit_events where tenant_id=p_tenant and (p_resource is null or resource_id=p_resource) and (p_query='' or action ilike '%'||p_query||'%') order by occurred_at desc limit p_limit offset p_offset)r;
 when 'cockpit' then
  rows:=jsonb_strip_nulls(jsonb_build_object(
   'free_positions',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='shift.manage')then(select count(*)from app.shift_positions sp join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id where sp.tenant_id=p_tenant and sh.state='published'and sh.ends_at>statement_timestamp()and sp.state='open'and internal.club_admin_can(p_tenant,'shift.manage','committee',sh.committee_id)and(p_season is null or sh.starts_at>=(select starts_on::timestamptz from app.seasons where tenant_id=p_tenant and id=p_season)and sh.starts_at<(select(ends_on+1)::timestamptz from app.seasons where tenant_id=p_tenant and id=p_season))and not exists(select 1 from app.bookings b where b.tenant_id=sp.tenant_id and b.position_id=sp.id and b.state not in('cancelled','transferred'))and not exists(select 1 from app.pwa_allocations a where a.tenant_id=sp.tenant_id and a.position_id=sp.id and a.state<>'released'))end,
   'reserved_positions',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'in('shift.manage','team_task.manage'))then(select count(*)from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id join app.shift_positions sp on sp.tenant_id=a.tenant_id and sp.id=a.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id where a.tenant_id=p_tenant and a.state in('reserved','assigned')and cl.state='active'and(p_season is null or cl.season_id=p_season)and(internal.club_admin_can(p_tenant,'team_task.manage','team',cl.team_id)or internal.club_admin_can(p_tenant,'shift.manage','committee',sh.committee_id)))end,
   'no_executor',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'in('shift.manage','team_task.manage'))then(select count(*)from app.pwa_allocations a join app.pwa_clusters cl on cl.tenant_id=a.tenant_id and cl.id=a.cluster_id join app.shift_positions sp on sp.tenant_id=a.tenant_id and sp.id=a.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id where a.tenant_id=p_tenant and a.state='assigned'and cl.state='active'and(p_season is null or cl.season_id=p_season)and(internal.club_admin_can(p_tenant,'team_task.manage','team',cl.team_id)or internal.club_admin_can(p_tenant,'shift.manage','committee',sh.committee_id))and not exists(select 1 from app.bookings b where b.tenant_id=a.tenant_id and b.position_id=a.position_id and b.state not in('cancelled','transferred')))end,
   'execution',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='attendance.confirm')then(select count(*)from app.bookings b join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id join app.obligations o on o.tenant_id=b.tenant_id and o.id=b.obligation_id where b.tenant_id=p_tenant and b.ends_at_snapshot<=statement_timestamp()and b.state in('booked','performed_pending')and(p_season is null or o.season_id=p_season)and internal.club_admin_can(p_tenant,'attendance.confirm','committee',sh.committee_id))end,
   'team_deadlines',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='team_task.manage')then(select count(*)from app.pwa_clusters cl where cl.tenant_id=p_tenant and cl.state='active'and cl.assign_until<statement_timestamp()+interval '7 days'and(p_season is null or cl.season_id=p_season)and internal.club_admin_can(p_tenant,'team_task.manage','team',cl.team_id)and exists(select 1 from app.pwa_allocations a where a.tenant_id=cl.tenant_id and a.cluster_id=cl.id and a.state='reserved'))end,
   'questions',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='household.review')then(select count(*)from app.pwa_questions q where q.tenant_id=p_tenant and q.state in('open','in_progress')and internal.club_admin_can(p_tenant,'household.review','household',q.household_id))end,
   'exception_requests',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'in('exception.review','exception.finalize'))then(select count(*)from app.exception_cases ec join app.obligations o on o.tenant_id=ec.tenant_id and o.id=ec.obligation_id where ec.tenant_id=p_tenant and ec.state in('submitted','in_review','escalated')and(p_season is null or o.season_id=p_season)and(internal.club_admin_can(p_tenant,'exception.review','household',o.assessed_household_id)or internal.club_admin_can(p_tenant,'exception.finalize')))end,
   'hour_disputes',case when internal.club_admin_can(p_tenant,'hour_dispute.review')then(select count(*)from app.hour_disputes d join app.obligations o on o.tenant_id=d.tenant_id and o.id=d.obligation_id where d.tenant_id=p_tenant and d.state in('open','in_review')and(p_season is null or o.season_id=p_season))end,
   'vacancy_interests',case when internal.club_admin_can(p_tenant,'vacancy.manage')then(select count(*)from app.vacancy_interests where tenant_id=p_tenant and state in('interested','contacted','meeting'))end,
   'team_credit_requests',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'in('team_task.manage','team_task.market.approve','team_task.market.publish','match.review'))then(select count(*)from app.team_task_market_requests r join app.team_tasks tt on tt.tenant_id=r.tenant_id and tt.id=r.team_task_id left join app.pwa_team_task_sources src on src.tenant_id=r.tenant_id and src.request_id=r.id where r.tenant_id=p_tenant and r.state in('requested','reviewing','approved')and(p_season is null or src.season_id=p_season)and(internal.club_admin_can(p_tenant,'team_task.manage','team',tt.team_id)or internal.club_admin_can(p_tenant,'team_task.market.approve')or internal.club_admin_can(p_tenant,'team_task.market.publish')or internal.club_admin_can(p_tenant,'match.review','team',tt.team_id)))end,
   'transfers',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='shift.manage')then(select count(*)from app.pwa_transfer_offers offer join app.bookings b on b.tenant_id=offer.tenant_id and b.id=offer.booking_id join app.obligations o on o.tenant_id=b.tenant_id and o.id=b.obligation_id join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id where offer.tenant_id=p_tenant and offer.state='open'and(p_season is null or o.season_id=p_season)and internal.club_admin_can(p_tenant,'shift.manage','committee',sh.committee_id))end,
   'policy_actions',case when exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='policy.manage')then(select count(*)from app.policy_assignments pa join app.policy_versions pv on pv.tenant_id=pa.tenant_id and pv.id=pa.policy_version_id join app.policy_documents pd on pd.tenant_id=pv.tenant_id and pd.id=pv.document_id where pa.tenant_id=p_tenant and pa.state='offered'and internal.club_admin_can(p_tenant,'policy.manage',case when pd.owner_committee_id is null then 'tenant'else 'committee'end,coalesce(pd.owner_committee_id,p_tenant)))end));
  if internal.club_admin_can(p_tenant,'report.season.view')then select jsonb_build_object('report_totals',jsonb_build_object('confirmed_minutes',coalesce(sum(c.confirmed_minutes),0),'planned_minutes',coalesce(sum(c.planned_minutes),0),'review_minutes',coalesce(sum(c.pending_minutes),0)))into extras from internal.canonical_obligation_status c where c.tenant_id=p_tenant and(p_season is null or c.season_id=p_season);end if;

 end case;
 -- Purpose-limited choices; account IDs are verified links within this
 -- association, never an Auth directory or intake/financial person dump.
 if p_section in('access','policies','courses','qualifications','fund','committees','vacancies')and(
  p_section='access'and exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='organization.access.manage')or
  p_section='policies'and exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='policy.manage')or
  p_section in('courses','qualifications')and internal.club_admin_can(p_tenant,'development.manage')or
  p_section='vacancies'and internal.club_admin_can(p_tenant,'vacancy.manage')or p_section='fund'and internal.club_admin_can(p_tenant,'finance.fund.manage')or p_section='committees'and exists(select 1 from jsonb_array_elements(ctx->'permissions')p where p->>'key'='committee.workspace.manage'))then
  extras:=extras||jsonb_build_object('people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.given_name||' '||p.family_name,
   'accounts',case when p_section='access'then coalesce((select jsonb_agg(jsonb_build_object('auth_user_id',a.auth_user_id))from app.account_person_links a where a.tenant_id=p.tenant_id and a.person_id=p.id and a.revoked_at is null and a.verified_at is not null),'[]')else '[]'::jsonb end))from app.persons p where p.tenant_id=p_tenant and p.status='active'),'[]'));
 end if;
 extras:=extras||jsonb_build_object('committees',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name))from app.committees c where c.tenant_id=p_tenant and(org or internal.club_admin_can(p_tenant,'organization.access.manage','committee',c.id)or internal.club_admin_can(p_tenant,'communication.manage','committee',c.id)or internal.club_admin_can(p_tenant,'policy.manage','committee',c.id)or internal.club_admin_can(p_tenant,'shift.manage','committee',c.id))),'[]'),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',choice_team.id,'name',choice_team.name))from app.teams choice_team where choice_team.tenant_id=p_tenant and(org or internal.club_admin_can(p_tenant,'organization.access.manage','team',choice_team.id)or internal.club_admin_can(p_tenant,'team_task.manage','team',choice_team.id))),'[]'),
 'households',case when p_section='access'then coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'name',h.label))from app.households h where h.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'organization.access.manage','household',h.id)),'[]')else '[]'::jsonb end);
 if p_section in('planning','execution')then extras:=extras||jsonb_build_object('categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name))from app.task_categories c where c.tenant_id=p_tenant and internal.club_admin_can(p_tenant,'shift.manage','committee',c.committee_id)),'[]'));end if;
 if p_section in('organization','templates')then extras:=extras||jsonb_build_object('adopted_defaults',coalesce((select p.adopted_defaults from app.platform_tenant_profiles p where p.tenant_id=p_tenant),'{}'));end if;
 if p_section='qualifications'then extras:=extras||jsonb_build_object('qualification_types',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name))from app.qualification_types where tenant_id=p_tenant and active),'[]'));end if;
 if p_resource is not null and jsonb_typeof(rows)='array' and jsonb_array_length(rows)=0 then raise exception using errcode='42501',message='FORBIDDEN';end if;
 return jsonb_build_object('section',p_section,'tenant_id',p_tenant,'season_id',p_season,'source','native_canonical_database','observed_at',statement_timestamp(),'rows',rows,'extras',extras,'access',ctx);
end;$$;


create function internal.club_admin_command(p_tenant uuid,p_action text,p_resource uuid,p_expected_version bigint,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=internal.current_actor_uid();v_permission text;v_kind text:='tenant';v_scope uuid:=p_tenant;v_fields text[];v_table text;
 v_dispute app.hour_disputes%rowtype;v_interest app.vacancy_interests%rowtype;v_booking_id uuid;v_decision uuid;v_before bigint;v_native jsonb;v_result jsonb;v_prior jsonb;v_grant app.access_grants%rowtype;v_support app.platform_support_requests%rowtype;
 v_role uuid;v_person uuid;v_uid uuid;v_membership uuid;v_revision integer;v_document uuid;v_keys text[];v_id uuid;v_ends timestamptz;begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_resource is null or p_expected_version is null or p_expected_version<0 or p_idempotency_key is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>65536
 or length(coalesce(btrim(p_payload->>'reason'),'')) not between 3 and 1000 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 case p_action
 when 'save_template_draft','preview_template','queue_template_test','approve_template','publish_template' then
  v_permission:='communication.manage';v_table:='message_templates';
  if p_action='save_template_draft' then v_fields:=array['template_key','name','committee_id','subject','preheader','sender_name','reply_to','text_body','button_label','image_path','reason'];
  elsif p_action='preview_template' then v_fields:=array['revision_id','scenario','reason'];
  elsif p_action='queue_template_test' then v_fields:=array['revision_id','scenario','explicit_confirmation','reason'];
  else v_fields:=array['revision_id','explicit_confirmation','reason'];end if;
  select committee_id into v_scope from app.message_templates where tenant_id=p_tenant and id=p_resource;
  if p_expected_version=0 then v_scope:=(p_payload->>'committee_id')::uuid;end if;
  if v_scope is not null then v_kind:='committee';else v_scope:=p_tenant;end if;
 when 'confirm_attendance','correct_attendance_award'then v_permission:='attendance.confirm';v_table:='bookings';v_fields:=array['result','awarded_minutes','explicit_confirmation','reason'];v_kind:='committee';
  select sh.committee_id into v_scope from app.bookings b join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id where b.tenant_id=p_tenant and b.id=p_resource;
 when 'prepare_assessment'  then v_permission:='finance.assessment.prepare';v_table:='financial_assessments';v_fields:=array['route','exception_decision_id','supply_assessment_id','reason'];
 when 'approve_assessment' then v_permission:='finance.assessment.approve';v_table:='financial_assessments';v_fields:=array['reason'];
 when 'finalize_assessment' then v_permission:='finance.assessment.finalize';v_table:='financial_processing_records';v_fields:=array['processing_kind','reason'];
 when 'review_exception' then v_permission:='exception.review';v_table:='exception_cases';v_fields:=array['outcome','has_conflict','reason'];
 when 'finalize_exception' then v_permission:='exception.finalize';v_table:='exception_cases';v_fields:=array['outcome','financial_route','reason'];
 when 'close_season' then v_permission:='season.close';v_table:='seasons';v_fields:=array['explicit_confirmation','reason'];
 when 'rollover_season' then v_permission:='season.rollover';v_table:='seasons';v_fields:=array['source_season_id','selected_template_keys','explicit_confirmation','reason'];
 when 'post_fund_entry' then v_permission:='finance.fund.manage';v_table:='volunteer_fund_entries';v_fields:=array['entry_kind','amount_cents','reservation_key','processing_record_id','reverses_entry_id','purpose','owner_person_id','reason'];
 when 'save_organization' then v_permission:='organization.manage';v_table:='tenants';v_fields:=array['name','contact_name','contact_email','contact_phone','logo_path','primary_color','reason'];
 when 'save_location' then
  v_permission:='organization.manage';v_table:='locations';v_fields:=array['name','active','reason'];
  if p_payload->>'name' is null or length(btrim(p_payload->>'name')) not between 1 and 150 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 when 'save_committee' then
  v_permission:='organization.manage';v_table:='committees';v_fields:=array['name','slug','active','reason'];
  if p_payload->>'name' is null or length(btrim(p_payload->>'name')) not between 1 and 150 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' or coalesce(p_payload->>'slug','')!~'^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 when 'save_committee_contact'then v_permission:='committee.workspace.manage';v_table:='committees';v_kind:='committee';v_scope:=p_resource;v_fields:=array['contact_name','contact_email','contact_phone','reason'];
 when 'add_committee_member','end_committee_member'then v_permission:='committee.workspace.manage';v_table:='committee_person_memberships';v_kind:='committee';
  if p_action='add_committee_member'then v_scope:=(p_payload->>'committee_id')::uuid;v_fields:=array['committee_id','person_id','duty','reason'];else select committee_id into v_scope from app.committee_person_memberships where tenant_id=p_tenant and id=p_resource;v_fields:=array['reason'];end if;
 when 'save_team' then
  v_permission:='organization.manage';v_table:='teams';v_fields:=array['name','active','reason'];
  if p_payload->>'name' is null or length(btrim(p_payload->>'name')) not between 1 and 150 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 when 'save_person' then
  v_permission:='organization.manage';v_table:='persons';v_fields:=array['given_name','family_name','status','membership_started_on','reason'];
  if p_payload->>'given_name' is null or length(btrim(p_payload->>'given_name')) not between 1 and 150 or coalesce(p_payload->>'status','')<>all(array['active','inactive','archived']) or length(coalesce(p_payload->>'family_name','')) not between 1 and 150 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 when 'save_course' then
  v_permission:='development.manage';v_table:='courses';v_fields:=array['title','description','active','reason'];
  if p_payload->>'title' is null or length(btrim(p_payload->>'title')) not between 1 and 150 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 when 'save_qualification_type' then
  v_permission:='development.manage';v_table:='qualification_types';v_fields:=array['name','active','reason'];
  if p_payload->>'name' is null or length(btrim(p_payload->>'name')) not between 1 and 150 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 when 'save_household' then v_permission:='organization.manage';v_table:='households';v_fields:=array['label','separated_parents','reason'];
 when 'save_season' then v_permission:='organization.manage';v_table:='seasons';v_fields:=array['name','starts_on','ends_on','winter_cutoff_at','target_minutes','winter_target_minutes','status','reason'];
 when 'link_household_person' then v_permission:='organization.manage';v_table:='household_person_links';v_fields:=array['household_id','person_id','kind','reason'];
 when 'add_team_member','end_team_member' then v_permission:='organization.manage';v_table:='team_person_memberships';v_fields:=case when p_action='add_team_member' then array['team_id','person_id','membership_kind','reason'] else array['reason'] end;
 when 'take_hour_dispute','resolve_hour_dispute'then v_permission:='hour_dispute.review';v_table:='hour_disputes';v_fields:=case when p_action='take_hour_dispute'then array['reason']else array['outcome','decision_id','explicit_confirmation','reason']end;
 when 'save_volunteer_role','revise_volunteer_role'then v_permission:='volunteer_role.manage';v_table:='volunteer_role_catalog';v_fields:=case when p_action='save_volunteer_role'then array['name','active','reason']else array['household_exempt','effective_from','effective_until','conditions','explicit_confirmation','reason']end;
 when 'save_vacancy','set_vacancy_state'then v_permission:='vacancy.manage';v_table:='vacancies';v_fields:=case when p_action='save_vacancy'then array['title','description','role_version_id','committee_id','team_id','expected_minutes','guidance','contact_person_id','opens_at','closes_at','reason']else array['state','explicit_confirmation','reason']end;
 when 'follow_vacancy_interest'then v_permission:='vacancy.manage';v_table:='vacancy_interests';v_fields:=array['state','reason'];
 when 'recognize_vacancy_appointment'then v_permission:='vacancy.manage';v_table:='vacancy_interests';v_fields:=array['obligation_id','expected_obligation_version','starts_on','ends_on','explicit_confirmation','reason'];
 when 'invite_access','cancel_access_invitation'then
  v_permission:='organization.access.manage';v_table:='admin_access_invitations';
  if p_action='invite_access'then v_fields:=array['auth_user_id','role_id','scope_kind','scope_id','ends_at','expires_at','reason'];v_kind:=p_payload->>'scope_kind';v_scope:=coalesce((p_payload->>'scope_id')::uuid,p_tenant);
  else v_fields:=array['reason'];select scope_kind,coalesce(scope_id,p_tenant)into v_kind,v_scope from app.admin_access_invitations where tenant_id=p_tenant and id=p_resource;end if;
 when 'grant_access','revoke_access' then v_permission:='organization.access.manage';v_table:='access_grants';v_fields:=case when p_action='grant_access' then array['auth_user_id','role_id','scope_kind','scope_id','ends_at','reason'] else array['reason'] end;
  if p_action='grant_access' then v_kind:=p_payload->>'scope_kind';v_scope:=coalesce((p_payload->>'scope_id')::uuid,p_tenant);else select scope_kind,coalesce(committee_id,team_id,household_id,p_tenant) into v_kind,v_scope from app.access_grants where tenant_id=p_tenant and id=p_resource;end if;
 when 'consent_support','end_support' then v_permission:='organization.access.manage';v_table:='platform_support_requests';v_fields:=case when p_action='consent_support' then array['approved','reason'] else array['reason'] end;
 when 'save_category' then v_permission:='shift.manage';v_table:='task_categories';v_fields:=array['committee_id','name','minimum_positions','reason'];v_kind:='committee';v_scope:=(p_payload->>'committee_id')::uuid;
 when 'save_task_type' then v_permission:='shift.manage';v_table:='task_types';v_fields:=array['category_id','name','active','reason'];v_kind:='committee';select committee_id into v_scope from app.task_categories where tenant_id=p_tenant and id=(p_payload->>'category_id')::uuid;
 when 'revise_task_type' then v_permission:='shift.manage';v_table:='task_types';v_fields:=array['credit_minutes','cancellation_minutes_override','reason'];v_kind:='committee';select c.committee_id into v_scope from app.task_types t join app.task_categories c on c.tenant_id=t.tenant_id and c.id=t.category_id where t.tenant_id=p_tenant and t.id=p_resource;
 when 'save_course_session' then v_permission:='development.manage';v_table:='course_sessions';v_fields:=array['course_id','starts_at','ends_at','capacity','qualification_type_id','qualification_valid_until','reason'];
 when 'register_qualification','revoke_qualification' then v_permission:='development.manage';v_table:='person_qualifications';v_fields:=case when p_action='register_qualification'then array['person_id','qualification_type_id','achieved_at','expires_at','explicit_confirmation','reason']else array['explicit_confirmation','reason']end;
 when 'certify_enrollment' then v_permission:='development.manage';v_table:='course_enrollments';v_fields:=array['achieved_at','expires_at','reason'];
 when 'save_policy_draft','publish_policy' then v_permission:='policy.manage';v_table:='policy_documents';v_fields:=case when p_action='save_policy_draft' then array['document_key','title','owner_committee_id','exact_body','effective_at','response_due_at','reacceptance_required','reason'] else array['revision_id','person_ids','explicit_confirmation','reason'] end;
  if p_expected_version=0 then v_scope:=(p_payload->>'owner_committee_id')::uuid;else select owner_committee_id into v_scope from app.policy_documents where tenant_id=p_tenant and id=p_resource;end if;
  v_kind:=case when v_scope is null then 'tenant' else 'committee' end;v_scope:=coalesce(v_scope,p_tenant);
 when 'save_settings' then v_permission:='organization.manage';v_table:='tenant_settings_versions';v_fields:=array['effective_from','cancellation_minutes','confirmation_days','dispute_days','reason'];
 else raise exception using errcode='22023',message='UNKNOWN_COMMAND';
 end case;
 if exists(select 1 from jsonb_object_keys(p_payload)k where not(k=any(v_fields))) then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 if not internal.club_admin_can(p_tenant,v_permission,v_kind,v_scope) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_action in('consent_support','end_support','revoke_access')then perform pg_advisory_xact_lock(hashtextextended('cluvo-platform-authority',0));end if;
 perform pg_advisory_xact_lock(hashtextextended('cluvo-admin-tenant:'||p_tenant::text,0));
 if not internal.club_admin_can(p_tenant,v_permission,v_kind,v_scope) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform internal.admin_assert_module(p_tenant,p_action);
 perform internal.admin_intent_guard('club',p_tenant,p_action,p_resource,p_expected_version,p_payload,p_idempotency_key);
 v_prior:=internal.claim_idempotency(p_tenant,'club_admin:'||p_action,p_idempotency_key,extensions.digest(convert_to(jsonb_build_object('action',p_action,'resource',p_resource,'version',p_expected_version,'payload',p_payload)::text,'UTF8'),'sha256'));
 if v_prior is not null then return v_prior;end if;
 case p_action
 when 'save_template_draft','preview_template','queue_template_test','approve_template','publish_template' then
  v_native:=internal.admin_template_command(p_tenant,p_action,p_resource,p_expected_version,p_payload,p_idempotency_key);
 when 'confirm_attendance','correct_attendance_award'then
  if p_payload->'explicit_confirmation'is distinct from 'true'::jsonb or p_payload->>'result'<>all(array['present','partial','no_show','club_cancelled'])or p_payload->>'result'is null or(p_payload->>'awarded_minutes')::integer is null or(p_payload->>'awarded_minutes')::integer not between 0 and 1440 then raise exception using errcode='22023',message='INVALID_ATTENDANCE';end if;
  if p_action='confirm_attendance'then select to_jsonb(x)into v_native from internal.confirm_attendance(p_tenant,p_resource,p_expected_version,p_payload->>'result',(p_payload->>'awarded_minutes')::integer,case when p_payload->>'result'in('partial','club_cancelled')then p_payload->>'reason'end,p_idempotency_key)x;
  else select to_jsonb(x)into v_native from internal.correct_attendance_award(p_tenant,p_resource,p_expected_version,p_payload->>'result',(p_payload->>'awarded_minutes')::integer,p_payload->>'reason',p_idempotency_key)x;end if;
 when 'prepare_assessment'  then
  select to_jsonb(x) into v_native from internal.prepare_financial_assessment(p_tenant,p_resource,p_payload->>'route',(p_payload->>'exception_decision_id')::uuid,(p_payload->>'supply_assessment_id')::uuid,p_expected_version,p_idempotency_key)x;
 when 'approve_assessment' then
  select to_jsonb(x) into v_native from internal.approve_financial_assessment(p_tenant,p_resource,p_expected_version,p_idempotency_key)x;
 when 'finalize_assessment' then
  select to_jsonb(x) into v_native from internal.finalize_financial_assessment(p_tenant,p_resource,p_expected_version,p_payload->>'processing_kind',p_idempotency_key)x;
 when 'review_exception' then
  if jsonb_typeof(p_payload->'has_conflict') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  select to_jsonb(x) into v_native from internal.review_exception_case(p_tenant,p_resource,p_expected_version,p_payload->>'outcome',p_payload->>'reason',(p_payload->>'has_conflict')::boolean,p_idempotency_key)x;
 when 'finalize_exception' then
  select to_jsonb(x) into v_native from internal.finalize_exception_case(p_tenant,p_resource,p_expected_version,p_payload->>'outcome',p_payload->>'financial_route',p_payload->>'reason',p_idempotency_key)x;
 when 'close_season','rollover_season' then
  if p_payload->'explicit_confirmation' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='EXPLICIT_CONFIRMATION_REQUIRED';end if;
  if p_action='close_season' then select to_jsonb(x) into v_native from internal.close_season(p_tenant,p_resource,p_expected_version,p_idempotency_key)x;
  else
   if jsonb_typeof(p_payload->'selected_template_keys') is distinct from 'array' or jsonb_array_length(p_payload->'selected_template_keys')>50 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
   select to_jsonb(x) into v_native from internal.rollover_season(p_tenant,(p_payload->>'source_season_id')::uuid,p_resource,array(select jsonb_array_elements_text(p_payload->'selected_template_keys')),p_expected_version,p_idempotency_key)x;
  end if;
 when 'post_fund_entry' then
  if p_expected_version<>0 or (p_payload->>'amount_cents')::integer is null or (p_payload->>'amount_cents')::integer not between 1 and 100000000 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  select to_jsonb(x) into v_native from internal.post_volunteer_fund_entry(p_tenant,p_payload->>'entry_kind',(p_payload->>'amount_cents')::integer,(p_payload->>'reservation_key')::uuid,(p_payload->>'processing_record_id')::uuid,(p_payload->>'reverses_entry_id')::uuid,p_payload->>'purpose',(p_payload->>'owner_person_id')::uuid,p_idempotency_key)x;
 when 'save_organization' then
  select version into v_before from app.tenants where id=p_tenant and id=p_resource for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if length(coalesce(btrim(p_payload->>'name'),'')) not between 1 and 150 or length(coalesce(btrim(p_payload->>'contact_name'),'')) not between 1 and 150 or coalesce(p_payload->>'contact_email','')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   or not internal.club_admin_logo_valid(p_payload->>'logo_path') or coalesce(p_payload->>'primary_color','')!~'^#[0-9a-fA-F]{6}$' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  update app.tenants set name=p_payload->>'name',branding_json=branding_json||jsonb_build_object('logo_path',p_payload->>'logo_path','primary_color',p_payload->>'primary_color'),version=version+1,updated_at=statement_timestamp() where id=p_tenant;
  insert into app.pwa_club_contacts(tenant_id,name,email,phone,changed_by_auth_user_id) values(p_tenant,p_payload->>'contact_name',p_payload->>'contact_email',p_payload->>'contact_phone',v_actor)
   on conflict(tenant_id)do update set name=excluded.name,email=excluded.email,phone=excluded.phone,version=app.pwa_club_contacts.version+1,changed_by_auth_user_id=v_actor,updated_at=statement_timestamp();
 when 'save_location' then
  if p_expected_version=0 then
   insert into app.locations(id,tenant_id,name,active) values(p_resource,p_tenant,(p_payload->>'name'),(p_payload->>'active')::boolean);
  else
   select version into v_before from app.locations where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.locations set name=(p_payload->>'name'),active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;

 when 'save_committee' then
  if p_expected_version=0 then
   insert into app.committees(id,tenant_id,name,slug,active) values(p_resource,p_tenant,(p_payload->>'name'),(p_payload->>'slug'),(p_payload->>'active')::boolean);
  else
   select version into v_before from app.committees where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.committees set name=(p_payload->>'name'),slug=(p_payload->>'slug'),active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;

 when 'save_committee_contact'then
  select version into v_before from app.committees where tenant_id=p_tenant and id=p_resource for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if length(coalesce(p_payload->>'contact_name',''))>150 or length(coalesce(p_payload->>'contact_phone',''))>40 or coalesce(p_payload->>'contact_email','')<>''and(p_payload->>'contact_email')!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'then raise exception using errcode='22023',message='INVALID_CONTACT';end if;
  update app.committees set contact_name=coalesce(p_payload->>'contact_name',''),contact_email=coalesce(p_payload->>'contact_email',''),contact_phone=coalesce(p_payload->>'contact_phone',''),version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
 when 'add_committee_member'then
  if p_expected_version<>0 or length(coalesce(btrim(p_payload->>'duty'),''))not between 1 and 150 then raise exception using errcode='22023',message='INVALID_MEMBERSHIP';end if;
  if not exists(select 1 from app.persons where tenant_id=p_tenant and id=(p_payload->>'person_id')::uuid and status='active')or not exists(select 1 from app.committees where tenant_id=p_tenant and id=v_scope and active)then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if exists(select 1 from app.committee_person_memberships where tenant_id=p_tenant and committee_id=v_scope and person_id=(p_payload->>'person_id')::uuid and ends_at is null)then raise exception using errcode='55000',message='MEMBERSHIP_EXISTS';end if;
  insert into app.committee_person_memberships(id,tenant_id,committee_id,person_id,duty)values(p_resource,p_tenant,v_scope,(p_payload->>'person_id')::uuid,btrim(p_payload->>'duty'));
 when 'end_committee_member'then
  select version into v_before from app.committee_person_memberships where tenant_id=p_tenant and id=p_resource and ends_at is null for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  update app.committee_person_memberships set ends_at=greatest(statement_timestamp(),starts_at+interval '1 microsecond'),version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
 when 'save_team' then
  if p_expected_version=0 then
   insert into app.teams(id,tenant_id,name,active) values(p_resource,p_tenant,(p_payload->>'name'),(p_payload->>'active')::boolean);
  else
   select version into v_before from app.teams where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.teams set name=(p_payload->>'name'),active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;

 when 'save_person' then
  if p_expected_version=0 then
   insert into app.persons(id,tenant_id,given_name,family_name,status,membership_started_on) values(p_resource,p_tenant,(p_payload->>'given_name'),(p_payload->>'family_name'),(p_payload->>'status'),(p_payload->>'membership_started_on')::date);
  else
   select version into v_before from app.persons where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.persons set given_name=(p_payload->>'given_name'),family_name=(p_payload->>'family_name'),status=(p_payload->>'status'),membership_started_on=(p_payload->>'membership_started_on')::date,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;

 when 'save_course' then
  if p_expected_version=0 then
   insert into app.courses(id,tenant_id,title,description,active) values(p_resource,p_tenant,(p_payload->>'title'),(p_payload->>'description'),(p_payload->>'active')::boolean);
  else
   select version into v_before from app.courses where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.courses set title=(p_payload->>'title'),description=(p_payload->>'description'),active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;

 when 'save_qualification_type' then
  if p_expected_version=0 then
   insert into app.qualification_types(id,tenant_id,name,active) values(p_resource,p_tenant,(p_payload->>'name'),(p_payload->>'active')::boolean);
  else
   select version into v_before from app.qualification_types where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.qualification_types set name=(p_payload->>'name'),active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;

 when 'save_household' then
  if length(coalesce(btrim(p_payload->>'label'),'')) not between 1 and 150 or jsonb_typeof(p_payload->'separated_parents') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  if p_expected_version=0 then insert into app.households(id,tenant_id,label,intake_code_hash,separated_parents) values(p_resource,p_tenant,p_payload->>'label',extensions.digest(extensions.gen_random_bytes(32),'sha256'),(p_payload->>'separated_parents')::boolean);
  else select version into v_before from app.households where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.households set label=p_payload->>'label',separated_parents=(p_payload->>'separated_parents')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;
 when 'save_season' then
  if length(coalesce(p_payload->>'name','')) not between 1 and 150 or coalesce(p_payload->>'status','')<>all(array['preparing','active'])
  or (p_payload->>'target_minutes')::integer is null or (p_payload->>'winter_target_minutes')::integer is null or (p_payload->>'starts_on')::date is null or (p_payload->>'ends_on')::date is null
  or (p_payload->>'winter_cutoff_at')::timestamptz not between (p_payload->>'starts_on')::timestamptz and ((p_payload->>'ends_on')::date+1)::timestamptz then raise exception using errcode='22023',message='INVALID_SEASON';end if;
  if p_expected_version=0 then insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,target_minutes,winter_target_minutes,status) values(p_resource,p_tenant,p_payload->>'name',(p_payload->>'starts_on')::date,(p_payload->>'ends_on')::date,(p_payload->>'winter_cutoff_at')::timestamptz,(p_payload->>'target_minutes')::integer,(p_payload->>'winter_target_minutes')::integer,p_payload->>'status');
  else select version into v_before from app.seasons where tenant_id=p_tenant and id=p_resource and status='preparing' for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='SEASON_AGREEMENTS_FROZEN';end if;
   if exists(select 1 from app.obligations where tenant_id=p_tenant and season_id=p_resource) then raise exception using errcode='55000',message='SEASON_AGREEMENTS_FROZEN';end if;
   update app.seasons set name=p_payload->>'name',starts_on=(p_payload->>'starts_on')::date,ends_on=(p_payload->>'ends_on')::date,winter_cutoff_at=(p_payload->>'winter_cutoff_at')::timestamptz,target_minutes=(p_payload->>'target_minutes')::integer,winter_target_minutes=(p_payload->>'winter_target_minutes')::integer,status=p_payload->>'status',version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;
 when 'link_household_person' then
  if p_expected_version<>0 or not exists(select 1 from app.persons where tenant_id=p_tenant and id=(p_payload->>'person_id')::uuid) or not exists(select 1 from app.households where tenant_id=p_tenant and id=(p_payload->>'household_id')::uuid) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  insert into app.household_person_links(id,tenant_id,household_id,person_id,kind,verified_by_auth_user_id) values(p_resource,p_tenant,(p_payload->>'household_id')::uuid,(p_payload->>'person_id')::uuid,p_payload->>'kind',v_actor);
 when 'add_team_member' then
  if p_expected_version<>0 or p_payload->>'membership_kind'='team_parent' or not exists(select 1 from app.persons where tenant_id=p_tenant and id=(p_payload->>'person_id')::uuid) or not exists(select 1 from app.teams where tenant_id=p_tenant and id=(p_payload->>'team_id')::uuid) then raise exception using errcode='42501',message='TEAM_PARENT_REQUIRES_HANDOVER';end if;
  insert into app.team_person_memberships(id,tenant_id,team_id,person_id,membership_kind) values(p_resource,p_tenant,(p_payload->>'team_id')::uuid,(p_payload->>'person_id')::uuid,p_payload->>'membership_kind');
 when 'end_team_member' then
  select version into v_before from app.team_person_memberships where tenant_id=p_tenant and id=p_resource and membership_kind<>'team_parent' for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  update app.team_person_memberships set ends_at=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
 when 'take_hour_dispute','resolve_hour_dispute'then
  select *into v_dispute from app.hour_disputes where tenant_id=p_tenant and id=p_resource for update;
  if v_dispute.id is null or v_dispute.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_dispute.state not in('open','in_review')then raise exception using errcode='55000',message='DISPUTE_NOT_OPEN';end if;
  v_booking_id:=coalesce(v_dispute.booking_id,(select booking_id from app.hour_ledger_entries where tenant_id=p_tenant and id=v_dispute.ledger_entry_id));
  select current_attendance_decision_id into v_decision from app.bookings where tenant_id=p_tenant and id=v_booking_id;
  if p_action='take_hour_dispute'then
   update app.hour_disputes set state='in_review',reviewer_auth_user_id=v_actor,reviewed_attendance_decision_id=v_decision,version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
  else
   if v_dispute.state<>'in_review'or v_dispute.reviewer_auth_user_id is distinct from v_actor or p_payload->'explicit_confirmation'is distinct from 'true'::jsonb or p_payload->>'outcome'is null or p_payload->>'outcome'<>all(array['unchanged','corrected','rejected'])then raise exception using errcode='22023',message='DISPUTE_REVIEW_REQUIRED';end if;
   if(p_payload->>'decision_id')::uuid is distinct from v_decision then raise exception using errcode='40001',message='DISPUTE_SOURCE_CHANGED';end if;
   if p_payload->>'outcome'='corrected'and(v_decision is null or not exists(select 1 from app.attendance_decisions current_decision join app.attendance_decisions reviewed_decision on reviewed_decision.tenant_id=current_decision.tenant_id and reviewed_decision.booking_id=current_decision.booking_id where current_decision.tenant_id=p_tenant and current_decision.id=v_decision and reviewed_decision.id=v_dispute.reviewed_attendance_decision_id and current_decision.decision_revision>reviewed_decision.decision_revision))then raise exception using errcode='55000',message='CANONICAL_CORRECTION_REQUIRED';end if;
   if p_payload->>'outcome'<>'corrected'and v_dispute.reviewed_attendance_decision_id is distinct from v_decision then raise exception using errcode='40001',message='DISPUTE_SOURCE_CHANGED';end if;
   update app.hour_disputes set state=case when p_payload->>'outcome'='rejected'then 'rejected'else 'resolved'end,resolution_outcome=p_payload->>'outcome',resolution_decision_id=v_decision,resolved_by_auth_user_id=v_actor,resolved_at=statement_timestamp(),resolution_reason=p_payload->>'reason',version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
  end if;
 when 'recognize_vacancy_appointment'then
  if not internal.club_admin_can(p_tenant,'volunteer_role.manage')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select *into v_interest from app.vacancy_interests where tenant_id=p_tenant and id=p_resource for update;
  if v_interest.id is null or v_interest.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_interest.state<>'meeting'or p_payload->'explicit_confirmation'is distinct from 'true'::jsonb then raise exception using errcode='55000',message='APPOINTMENT_REVIEW_REQUIRED';end if;
  select o.id,o.assessed_household_id into v_id,v_uid from app.obligations o where o.tenant_id=p_tenant and o.id=(p_payload->>'obligation_id')::uuid;
  if v_id is null then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select to_jsonb(x)into v_native from app.vacancies vacancy cross join lateral internal.recognize_volunteer_appointment(p_tenant,vacancy.role_version_id,v_interest.person_id,v_uid,v_id,(p_payload->>'starts_on')::date,(p_payload->>'ends_on')::date,vacancy.committee_id,vacancy.team_id,(p_payload->>'expected_obligation_version')::bigint,p_payload->>'reason',p_idempotency_key)x where vacancy.tenant_id=p_tenant and vacancy.id=v_interest.vacancy_id;
  if coalesce((v_native->>'ok')::boolean,false)is not true then raise exception using errcode='55000',message='CANONICAL_COMMAND_REJECTED';end if;
  insert into app.appointment_cases(tenant_id,vacancy_interest_id,person_id,state,appointment_id,opened_by_auth_user_id,decided_by_auth_user_id,decision_reason,decided_at)values(p_tenant,p_resource,v_interest.person_id,'approved',(v_native->>'resource_id')::uuid,v_actor,v_actor,p_payload->>'reason',statement_timestamp());
  update app.vacancy_interests set state='appointed',version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
  v_native:=null;
 when 'save_volunteer_role'then
  if length(coalesce(btrim(p_payload->>'name'),''))not between 1 and 150 or jsonb_typeof(p_payload->'active')is distinct from 'boolean'then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  if p_expected_version=0 then insert into app.volunteer_role_catalog(id,tenant_id,name,active)values(p_resource,p_tenant,btrim(p_payload->>'name'),(p_payload->>'active')::boolean);
  else select version into v_before from app.volunteer_role_catalog where tenant_id=p_tenant and id=p_resource for update;if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.volunteer_role_catalog set name=btrim(p_payload->>'name'),active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;end if;
 when 'revise_volunteer_role'then
  select version into v_before from app.volunteer_role_catalog where tenant_id=p_tenant and id=p_resource and active for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_payload->'explicit_confirmation'is distinct from 'true'::jsonb or jsonb_typeof(p_payload->'household_exempt')is distinct from 'boolean'or(p_payload->>'effective_from')::date is null or length(coalesce(btrim(p_payload->>'conditions'),''))not between 3 and 4000 or(p_payload->>'effective_until')::date<(p_payload->>'effective_from')::date then raise exception using errcode='22023',message='INVALID_ROLE_VERSION';end if;
  select coalesce(max(revision),0)+1 into v_revision from app.volunteer_role_versions where tenant_id=p_tenant and role_id=p_resource;
  insert into app.volunteer_role_versions(tenant_id,role_id,revision,household_exempt,recognition_rules,effective_from,effective_until,approved_by_auth_user_id)values(p_tenant,p_resource,v_revision,(p_payload->>'household_exempt')::boolean,jsonb_build_object('conditions',p_payload->>'conditions'),(p_payload->>'effective_from')::date,(p_payload->>'effective_until')::date,v_actor);
  update app.volunteer_role_catalog set version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
 when 'save_vacancy'then
  if length(coalesce(btrim(p_payload->>'title'),''))not between 1 and 150 or length(coalesce(btrim(p_payload->>'description'),''))not between 3 and 4000 or length(coalesce(p_payload->>'guidance',''))>4000 or(p_payload->>'expected_minutes')::integer is null or(p_payload->>'expected_minutes')::integer not between 0 and 100000 or num_nonnulls(p_payload->>'committee_id',p_payload->>'team_id')>1 or(p_payload->>'closes_at')is not null and((p_payload->>'opens_at')is null or(p_payload->>'closes_at')::timestamptz<=(p_payload->>'opens_at')::timestamptz)then raise exception using errcode='22023',message='INVALID_VACANCY';end if;
  if not exists(select 1 from app.volunteer_role_versions rv join app.volunteer_role_catalog rc on rc.tenant_id=rv.tenant_id and rc.id=rv.role_id where rv.tenant_id=p_tenant and rv.id=(p_payload->>'role_version_id')::uuid and rc.active)
   or not exists(select 1 from app.persons where tenant_id=p_tenant and id=(p_payload->>'contact_person_id')::uuid and status='active')then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if p_expected_version=0 then insert into app.vacancies(id,tenant_id,role_version_id,committee_id,team_id,title,description,expected_minutes,guidance,contact_person_id,opens_at,closes_at)values(p_resource,p_tenant,(p_payload->>'role_version_id')::uuid,(p_payload->>'committee_id')::uuid,(p_payload->>'team_id')::uuid,p_payload->>'title',p_payload->>'description',(p_payload->>'expected_minutes')::integer,p_payload->>'guidance',(p_payload->>'contact_person_id')::uuid,(p_payload->>'opens_at')::timestamptz,(p_payload->>'closes_at')::timestamptz);
  else select version into v_before from app.vacancies where tenant_id=p_tenant and id=p_resource for update;if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   if exists(select 1 from app.vacancies where tenant_id=p_tenant and id=p_resource and state<>'draft')or exists(select 1 from app.vacancy_interests where tenant_id=p_tenant and vacancy_id=p_resource)then raise exception using errcode='55000',message='VACANCY_AGREEMENTS_FROZEN';end if;
   update app.vacancies set role_version_id=(p_payload->>'role_version_id')::uuid,committee_id=(p_payload->>'committee_id')::uuid,team_id=(p_payload->>'team_id')::uuid,title=p_payload->>'title',description=p_payload->>'description',expected_minutes=(p_payload->>'expected_minutes')::integer,guidance=p_payload->>'guidance',contact_person_id=(p_payload->>'contact_person_id')::uuid,opens_at=(p_payload->>'opens_at')::timestamptz,closes_at=(p_payload->>'closes_at')::timestamptz,version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;end if;
 when 'set_vacancy_state'then
  select version into v_before from app.vacancies where tenant_id=p_tenant and id=p_resource for update;if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_payload->'explicit_confirmation'is distinct from 'true'::jsonb or not exists(select 1 from app.vacancies where tenant_id=p_tenant and id=p_resource and(state='draft'and p_payload->>'state'='published'or state='published'and p_payload->>'state'='closed'))then raise exception using errcode='22023',message='INVALID_VACANCY_TRANSITION';end if;
  update app.vacancies set state=p_payload->>'state',version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
 when 'follow_vacancy_interest'then
  select *into v_interest from app.vacancy_interests where tenant_id=p_tenant and id=p_resource for update;
  if v_interest.id is null or v_interest.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if v_interest.state in('withdrawn','rejected','appointed')or p_payload->>'state'is null or not(case v_interest.state when 'interested'then p_payload->>'state'=any(array['contacted','rejected'])when 'contacted'then p_payload->>'state'=any(array['meeting','rejected'])when 'meeting'then p_payload->>'state'='rejected'else false end)then raise exception using errcode='22023',message='INVALID_INTEREST_TRANSITION';end if;
  update app.vacancy_interests set state=p_payload->>'state',version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource;
 when 'invite_access'then
  v_native:=internal.admin_invitation_offer(p_tenant,p_resource,p_expected_version,p_payload,false);
 when 'cancel_access_invitation'then
  v_native:=internal.admin_invitation_cancel(p_tenant,p_resource,p_expected_version,false);
 when 'grant_access' then
  v_uid:=(p_payload->>'auth_user_id')::uuid;v_role:=(p_payload->>'role_id')::uuid;v_ends:=(p_payload->>'ends_at')::timestamptz;
  if p_expected_version<>0 or v_uid=v_actor then raise exception using errcode='42501',message='SELF_GRANT_REFUSED';end if;
  if not exists(select 1 from app.account_person_links where tenant_id=p_tenant and auth_user_id=v_uid and revoked_at is null and verified_at is not null) then raise exception using errcode='42501',message='ACCOUNT_NOT_LINKED';end if;
  if not exists(select 1 from app.permission_roles where tenant_id=p_tenant and id=v_role and role_key<>'team_parent') then raise exception using errcode='42501',message='TEAM_PARENT_REQUIRES_HANDOVER';end if;
  v_kind:=p_payload->>'scope_kind';v_scope:=(p_payload->>'scope_id')::uuid;
  if v_kind<>all(array['tenant','committee','team','household']) or v_kind is null or (v_kind='tenant' and v_scope is not null) or (v_kind<>'tenant' and v_scope is null) or v_ends is null or v_ends<=statement_timestamp() or v_ends>statement_timestamp()+interval '1 year' then raise exception using errcode='22023',message='INVALID_SCOPE';end if;
  if v_kind='committee' and not exists(select 1 from app.committees where tenant_id=p_tenant and id=v_scope) or v_kind='team' and not exists(select 1 from app.teams where tenant_id=p_tenant and id=v_scope) or v_kind='household' and not exists(select 1 from app.households where tenant_id=p_tenant and id=v_scope) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if exists(select 1 from app.role_permissions rp where rp.tenant_id=p_tenant and rp.role_id=v_role and (not internal.club_admin_can(p_tenant,rp.permission_key,v_kind,coalesce(v_scope,p_tenant)) or not exists(select 1 from app.access_grants a join app.role_permissions ar on ar.tenant_id=a.tenant_id and ar.role_id=a.role_id where a.tenant_id=p_tenant and a.auth_user_id=v_actor and a.revoked_at is null and a.starts_at<=statement_timestamp() and (a.ends_at is null or a.ends_at>=v_ends) and ar.permission_key=rp.permission_key and (a.scope_kind='tenant' or a.scope_kind=v_kind and coalesce(a.committee_id,a.team_id,a.household_id)=v_scope)))) then raise exception using errcode='42501',message='CANNOT_DELEGATE_PERMISSION';end if;
  insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,committee_id,team_id,household_id,ends_at,granted_by_auth_user_id) values(p_resource,p_tenant,v_uid,v_role,v_kind,case when v_kind='committee' then v_scope end,case when v_kind='team' then v_scope end,case when v_kind='household' then v_scope end,v_ends,v_actor);
 when 'revoke_access' then
  select * into v_grant from app.access_grants where tenant_id=p_tenant and id=p_resource for update;
  if v_grant.id is null or v_grant.version<>p_expected_version or v_grant.revoked_at is not null then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if not internal.club_admin_can(p_tenant,'organization.access.manage',v_grant.scope_kind,coalesce(v_grant.committee_id,v_grant.team_id,v_grant.household_id,p_tenant)) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if v_grant.scope_kind='tenant'and exists(select 1 from app.role_permissions rp where rp.tenant_id=p_tenant and rp.role_id=v_grant.role_id and rp.permission_key='organization.access.manage')and not exists(select 1 from app.access_grants other_grant join app.role_permissions rp on rp.tenant_id=other_grant.tenant_id and rp.role_id=other_grant.role_id join app.tenant_memberships tm on tm.tenant_id=other_grant.tenant_id and tm.auth_user_id=other_grant.auth_user_id where other_grant.tenant_id=p_tenant and other_grant.id<>p_resource and other_grant.scope_kind='tenant'and other_grant.revoked_at is null and other_grant.starts_at<=statement_timestamp()and(other_grant.ends_at is null or other_grant.ends_at>statement_timestamp())and rp.permission_key='organization.access.manage'and tm.status='active'and tm.starts_at<=statement_timestamp()and(tm.ends_at is null or tm.ends_at>statement_timestamp()))then raise exception using errcode='55000',message='LAST_ACCESS_MANAGER';end if;
  update app.access_grants set revoked_at=statement_timestamp(),version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  -- The ordinary grant revocation route also closes its linked named support
  -- request and only the temporary membership created for that request.
  for v_support in select *from app.platform_support_requests where tenant_id=p_tenant and access_grant_id=p_resource and state='approved'for update loop
   update app.platform_support_requests set state='revoked',version=version+1 where tenant_id=p_tenant and id=v_support.id;
   update app.tenant_memberships set ends_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant and id=v_support.support_membership_id;
   insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)values(p_tenant,v_actor,'admin.support_ended_with_grant','platform_support_requests',v_support.id,v_support.scope_kind,coalesce(v_support.scope_id,p_tenant),'EXPLICIT_ACCESS_REVOCATION',p_idempotency_key,jsonb_build_object('expected_version',v_support.version,'resulting_version',v_support.version+1,'access_grant_id',p_resource));
   insert into app.domain_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)values(p_tenant,'platform_support_requests',v_support.id,v_support.version+1,'admin.support_ended_with_grant',jsonb_build_object('actor',v_actor,'access_grant_id',p_resource));
  end loop;
 when 'consent_support','end_support' then
  select * into v_support from app.platform_support_requests where tenant_id=p_tenant and id=p_resource for update;
  if v_support.id is null or v_support.version<>p_expected_version or v_support.ends_at<=statement_timestamp() or v_support.employee_auth_user_id=v_actor then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if p_action='consent_support' then
   if not exists(select 1 from app.platform_access_grants employee where employee.auth_user_id=v_support.employee_auth_user_id and employee.permission_key='platform.support'and employee.revoked_at is null and employee.starts_at<=statement_timestamp()and employee.ends_at>=v_support.ends_at and(employee.tenant_scope_id is null or employee.tenant_scope_id=p_tenant))then raise exception using errcode='42501',message='SUPPORT_EMPLOYEE_ACCESS_ENDED';end if;
   if v_support.state<>'requested' or jsonb_typeof(p_payload->'approved') is distinct from 'boolean' then raise exception using errcode='40001',message='STALE_VERSION';end if;
   if (p_payload->>'approved')::boolean then
    if exists(select 1 from unnest(v_support.permission_keys)k where not internal.club_admin_can(p_tenant,k,v_support.scope_kind,coalesce(v_support.scope_id,p_tenant))) then raise exception using errcode='42501',message='CANNOT_DELEGATE_PERMISSION';end if;
    if exists(select 1 from unnest(v_support.permission_keys)k where not exists(select 1 from app.access_grants a join app.role_permissions rp on rp.tenant_id=a.tenant_id and rp.role_id=a.role_id
     where a.tenant_id=p_tenant and a.auth_user_id=v_actor and a.revoked_at is null and a.starts_at<=statement_timestamp() and (a.ends_at is null or a.ends_at>=v_support.ends_at)
     and rp.permission_key=k and (a.scope_kind='tenant' or a.scope_kind=v_support.scope_kind and coalesce(a.committee_id,a.team_id)=v_support.scope_id))) then raise exception using errcode='42501',message='CANNOT_EXTEND_DELEGATION';end if;
    insert into app.permission_roles(tenant_id,role_key,name,system_role) values(p_tenant,'support_'||replace(p_resource::text,'-',''),'Tijdelijke benoemde ondersteuning',false) returning id into v_role;
    insert into app.role_permissions(tenant_id,role_id,permission_key) select p_tenant,v_role,k from unnest(v_support.permission_keys)k;
    insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,committee_id,team_id,ends_at,granted_by_auth_user_id) values(p_tenant,v_support.employee_auth_user_id,v_role,v_support.scope_kind,case when v_support.scope_kind='committee' then v_support.scope_id end,case when v_support.scope_kind='team' then v_support.scope_id end,v_support.ends_at,v_actor) returning id into v_id;
    if not exists(select 1 from app.tenant_memberships where tenant_id=p_tenant and auth_user_id=v_support.employee_auth_user_id and status='active' and (ends_at is null or ends_at>statement_timestamp())) then
     insert into app.tenant_memberships(tenant_id,auth_user_id,ends_at) values(p_tenant,v_support.employee_auth_user_id,v_support.ends_at) returning id into v_membership;
    end if;
    update app.platform_support_requests set state='approved',access_grant_id=v_id,support_membership_id=v_membership,consented_by_auth_user_id=v_actor,consented_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant and id=p_resource;
   else update app.platform_support_requests set state='rejected',consented_by_auth_user_id=v_actor,consented_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant and id=p_resource;end if;
  else
   if v_support.state<>all(array['requested','approved']) then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.platform_support_requests set state='revoked',version=version+1 where tenant_id=p_tenant and id=p_resource;
   update app.access_grants set revoked_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant and id=v_support.access_grant_id and revoked_at is null;
   update app.tenant_memberships set ends_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant and id=v_support.support_membership_id;
  end if;
 when 'save_category' then
  if length(coalesce(p_payload->>'name','')) not between 1 and 150 or (p_payload->>'minimum_positions')::integer is null then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  if p_expected_version=0 then insert into app.task_categories(id,tenant_id,committee_id,name,minimum_positions) values(p_resource,p_tenant,v_scope,p_payload->>'name',(p_payload->>'minimum_positions')::integer);
  else select version into v_before from app.task_categories where tenant_id=p_tenant and id=p_resource and committee_id=v_scope for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.task_categories set name=p_payload->>'name',minimum_positions=(p_payload->>'minimum_positions')::integer,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;
 when 'save_task_type' then
  if length(coalesce(p_payload->>'name','')) not between 1 and 150 or jsonb_typeof(p_payload->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  if p_expected_version=0 then insert into app.task_types(id,tenant_id,category_id,name,active)values(p_resource,p_tenant,(p_payload->>'category_id')::uuid,p_payload->>'name',(p_payload->>'active')::boolean);
  else select version into v_before from app.task_types where tenant_id=p_tenant and id=p_resource and category_id=(p_payload->>'category_id')::uuid for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.task_types set name=p_payload->>'name',active=(p_payload->>'active')::boolean,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;
 when 'revise_task_type' then
  select version into v_before from app.task_types where tenant_id=p_tenant and id=p_resource for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if (p_payload->>'credit_minutes')::integer is null or (p_payload->>'credit_minutes')::integer not between 0 and 1440 or (p_payload->>'cancellation_minutes_override')::integer not between 0 and 44640 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  select coalesce(max(revision),0)+1 into v_revision from app.task_type_versions where tenant_id=p_tenant and task_type_id=p_resource;
  insert into app.task_type_versions(tenant_id,task_type_id,revision,credit_minutes,cancellation_minutes_override,approved_by_auth_user_id) values(p_tenant,p_resource,v_revision,(p_payload->>'credit_minutes')::integer,(p_payload->>'cancellation_minutes_override')::integer,v_actor);
  update app.task_types set version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
 when 'save_course_session' then
  if (p_payload->>'capacity')::integer is null or (p_payload->>'capacity')::integer not between 1 and 1000 or not exists(select 1 from app.courses where tenant_id=p_tenant and id=(p_payload->>'course_id')::uuid) then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  if p_expected_version=0 then insert into app.course_sessions(id,tenant_id,course_id,starts_at,ends_at,capacity,qualification_type_id,qualification_valid_until)values(p_resource,p_tenant,(p_payload->>'course_id')::uuid,(p_payload->>'starts_at')::timestamptz,(p_payload->>'ends_at')::timestamptz,(p_payload->>'capacity')::integer,(p_payload->>'qualification_type_id')::uuid,(p_payload->>'qualification_valid_until')::timestamptz);
  else select version into v_before from app.course_sessions where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   if exists(select 1 from app.course_enrollments where tenant_id=p_tenant and session_id=p_resource and state<>'withdrawn') then raise exception using errcode='55000',message='COURSE_AGREEMENTS_FROZEN';end if;
   update app.course_sessions set starts_at=(p_payload->>'starts_at')::timestamptz,ends_at=(p_payload->>'ends_at')::timestamptz,capacity=(p_payload->>'capacity')::integer,qualification_type_id=(p_payload->>'qualification_type_id')::uuid,qualification_valid_until=(p_payload->>'qualification_valid_until')::timestamptz,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;
 when 'register_qualification' then
  if p_expected_version<>0 or p_payload->'explicit_confirmation'is distinct from 'true'::jsonb or not exists(select 1 from app.persons where tenant_id=p_tenant and id=(p_payload->>'person_id')::uuid and status='active')or not exists(select 1 from app.qualification_types where tenant_id=p_tenant and id=(p_payload->>'qualification_type_id')::uuid and active)or(p_payload->>'achieved_at')::timestamptz is null or(p_payload->>'achieved_at')::timestamptz>statement_timestamp()or(p_payload->>'expires_at')::timestamptz<=(p_payload->>'achieved_at')::timestamptz then raise exception using errcode='22023',message='QUALIFICATION_REVIEW_REQUIRED';end if;
  insert into app.person_qualifications(id,tenant_id,person_id,qualification_type_id,achieved_at,expires_at,verified_by_auth_user_id)values(p_resource,p_tenant,(p_payload->>'person_id')::uuid,(p_payload->>'qualification_type_id')::uuid,(p_payload->>'achieved_at')::timestamptz,(p_payload->>'expires_at')::timestamptz,v_actor);
  insert into app.qualification_events(tenant_id,qualification_id,person_id,event_kind,effective_at,reason,actor_auth_user_id)values(p_tenant,p_resource,(p_payload->>'person_id')::uuid,'verified',(p_payload->>'achieved_at')::timestamptz,p_payload->>'reason',v_actor);
 when 'revoke_qualification' then
  select version,person_id into v_before,v_person from app.person_qualifications where tenant_id=p_tenant and id=p_resource and revoked_at is null for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_payload->'explicit_confirmation'is distinct from 'true'::jsonb then raise exception using errcode='22023',message='EXPLICIT_CONFIRMATION_REQUIRED';end if;
  update app.person_qualifications set revoked_at=statement_timestamp(),version=version+1 where tenant_id=p_tenant and id=p_resource;
  insert into app.qualification_events(tenant_id,qualification_id,person_id,event_kind,effective_at,reason,actor_auth_user_id)values(p_tenant,p_resource,v_person,'revoked',statement_timestamp(),p_payload->>'reason',v_actor);
 when 'certify_enrollment' then
  select version,person_id,session_id into v_before,v_person,v_id from app.course_enrollments where tenant_id=p_tenant and id=p_resource and state='enrolled' for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select qualification_type_id into v_document from app.course_sessions where tenant_id=p_tenant and id=v_id and ends_at<=statement_timestamp();
  if v_document is null or (p_payload->>'achieved_at')::timestamptz is null or (p_payload->>'achieved_at')::timestamptz>statement_timestamp() then raise exception using errcode='55000',message='QUALIFICATION_REVIEW_REQUIRED';end if;
  insert into app.person_qualifications(tenant_id,person_id,qualification_type_id,achieved_at,expires_at,verified_by_auth_user_id)values(p_tenant,v_person,v_document,(p_payload->>'achieved_at')::timestamptz,(p_payload->>'expires_at')::timestamptz,v_actor)returning id into v_id;
  update app.course_enrollments set state='completed',qualification_id=v_id,completed_by_auth_user_id=v_actor,result_note=p_payload->>'reason',version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
 when 'save_policy_draft' then
  if length(coalesce(p_payload->>'title','')) not between 1 and 200 or length(coalesce(p_payload->>'exact_body','')) not between 1 and 32000 or jsonb_typeof(p_payload->'reacceptance_required') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  if p_expected_version=0 then insert into app.policy_documents(id,tenant_id,document_key,title,owner_committee_id)values(p_resource,p_tenant,p_payload->>'document_key',p_payload->>'title',(p_payload->>'owner_committee_id')::uuid);
  else select version into v_before from app.policy_documents where tenant_id=p_tenant and id=p_resource for update;
   if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
   update app.policy_documents set title=p_payload->>'title',version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
  end if;
  select coalesce(max(revision),0)+1 into v_revision from app.policy_versions where tenant_id=p_tenant and document_id=p_resource;
  insert into app.policy_versions(tenant_id,document_id,revision,exact_body,body_hash,effective_at,response_due_at,reacceptance_required,created_by_auth_user_id)values(p_tenant,p_resource,v_revision,p_payload->>'exact_body',extensions.digest(convert_to(p_payload->>'exact_body','UTF8'),'sha256'),(p_payload->>'effective_at')::timestamptz,(p_payload->>'response_due_at')::timestamptz,(p_payload->>'reacceptance_required')::boolean,v_actor);
 when 'publish_policy' then
  if not coalesce((p_payload->>'explicit_confirmation')::boolean,false) then raise exception using errcode='22023',message='EXPLICIT_CONFIRMATION_REQUIRED';end if;
  select version into v_before from app.policy_documents where tenant_id=p_tenant and id=p_resource for update;
  if v_before is distinct from p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  select revision into v_revision from app.policy_versions where tenant_id=p_tenant and document_id=p_resource and id=(p_payload->>'revision_id')::uuid and state='draft' for update;
  if v_revision is null then raise exception using errcode='40001',message='POLICY_VERSION_CHANGED';end if;
  v_keys:=array(select jsonb_array_elements_text(p_payload->'person_ids'));
  if cardinality(v_keys) not between 1 and 200 or cardinality(v_keys)<>(select count(distinct k)from unnest(v_keys)k) or exists(select 1 from unnest(v_keys)k where not exists(select 1 from app.persons where tenant_id=p_tenant and id=k::uuid and status='active')) then raise exception using errcode='42501',message='INVALID_AUDIENCE';end if;
  update app.policy_versions set state='published',approved_by_auth_user_id=v_actor,approved_at=statement_timestamp(),published_at=statement_timestamp() where tenant_id=p_tenant and id=(p_payload->>'revision_id')::uuid;
  insert into app.policy_audiences(tenant_id,policy_version_id,audience_key,criteria_snapshot,approved_by_auth_user_id)values(p_tenant,(p_payload->>'revision_id')::uuid,'explicit_members',jsonb_build_object('person_ids',p_payload->'person_ids'),v_actor)returning id into v_id;
  insert into app.policy_assignments(tenant_id,policy_version_id,audience_id,member_person_id,due_at) select p_tenant,(p_payload->>'revision_id')::uuid,v_id,k::uuid,(select response_due_at from app.policy_versions where tenant_id=p_tenant and id=(p_payload->>'revision_id')::uuid)from unnest(v_keys)k;
  update app.policy_documents set current_revision=v_revision,version=version+1,updated_at=statement_timestamp() where tenant_id=p_tenant and id=p_resource;
 when 'save_settings' then
  select coalesce(max(revision),0) into v_before from app.tenant_settings_versions where tenant_id=p_tenant;
  if v_before<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if (p_payload->>'cancellation_minutes')::integer is null or (p_payload->>'cancellation_minutes')::integer not between 0 and 44640 or (p_payload->>'confirmation_days')::integer is null or (p_payload->>'confirmation_days')::integer not between 1 and 365 or (p_payload->>'dispute_days')::integer is null or (p_payload->>'dispute_days')::integer not between 1 and 365 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
  insert into app.tenant_settings_versions(id,tenant_id,revision,effective_from,cancellation_minutes,confirmation_days,dispute_days,approved_by_auth_user_id)values(p_resource,p_tenant,v_before+1,(p_payload->>'effective_from')::timestamptz,(p_payload->>'cancellation_minutes')::integer,(p_payload->>'confirmation_days')::integer,(p_payload->>'dispute_days')::integer,v_actor);
 end case;
 if v_native is not null then
  if coalesce((v_native->>'ok')::boolean,false) is not true then raise exception using errcode='23514',message='CANONICAL_COMMAND_REJECTED';end if;
  v_result:=v_native||jsonb_build_object('action',p_action,'tenant_id',p_tenant);
  insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
   values(p_tenant,v_actor,'admin.'||p_action,v_table,(v_native->>'resource_id')::uuid,v_kind,coalesce(v_scope,p_tenant),'CANONICAL_ADMIN_DECISION',p_idempotency_key,jsonb_build_object('expected_version',p_expected_version,'resulting_version',v_native->'version','reason',p_payload->>'reason'));
  perform internal.finish_idempotency(p_tenant,'club_admin:'||p_action,p_idempotency_key,v_result);perform internal.admin_intent_finish(p_idempotency_key);return v_result;
 end if;
 v_result:=jsonb_build_object('ok',true,'action',p_action,'resource_id',p_resource,'version',p_expected_version+1,'tenant_id',p_tenant);
 insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)values(p_tenant,v_actor,'admin.'||p_action,v_table,p_resource,v_kind,coalesce(v_scope,p_tenant),'EXPLICIT_ADMIN_DECISION',p_idempotency_key,jsonb_build_object('expected_version',p_expected_version,'resulting_version',p_expected_version+1,'reason',left(p_payload->>'reason',1000)));
 insert into app.domain_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)values(p_tenant,v_table,p_resource,p_expected_version+1,'admin.'||p_action,jsonb_build_object('actor',v_actor,'scope_kind',v_kind,'scope_id',coalesce(v_scope,p_tenant)));
 perform internal.finish_idempotency(p_tenant,'club_admin:'||p_action,p_idempotency_key,v_result);perform internal.admin_intent_finish(p_idempotency_key);return v_result;
end;$$;
create function internal.club_admin_command_status(p_tenant uuid,p_idempotency_key uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r app.idempotency_records%rowtype;begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 select * into r from app.idempotency_records where tenant_id=p_tenant and actor_auth_user_id=internal.current_actor_uid() and idempotency_key=p_idempotency_key and operation like 'club_admin:%';
 if not found or r.status<>'completed' then return jsonb_build_object('state','unknown');end if;
 return jsonb_build_object('state','confirmed','result',jsonb_build_object('action',r.result_jsonb->'action','resource_id',r.result_jsonb->'resource_id','version',r.result_jsonb->'version'));
end;$$;
create function api.club_admin_command(p_tenant uuid,p_action text,p_resource uuid,p_expected_version bigint,p_payload jsonb,p_idempotency_key uuid)returns jsonb language sql volatile security invoker set search_path='' as $$select internal.club_admin_command(p_tenant,p_action,p_resource,p_expected_version,p_payload,p_idempotency_key);$$;
create function api.club_admin_command_status(p_tenant uuid,p_idempotency_key uuid)returns jsonb language sql stable security invoker set search_path='' as $$select internal.club_admin_command_status(p_tenant,p_idempotency_key);$$;
-- Restricted command ownership; authenticated keeps read/RPC-only access.
do $writers$ declare n text;begin
 foreach n in array array['locations','committees','committee_person_memberships','teams','team_person_memberships','households','household_person_links','courses','course_sessions','qualification_types','person_qualifications','course_enrollments','hour_disputes','vacancy_interests','vacancies','volunteer_role_catalog','volunteer_role_versions','appointment_cases','seasons','task_categories','task_types','task_type_versions','policy_documents','policy_versions','policy_audiences','policy_assignments','tenant_settings_versions'] loop
 execute format('grant select,insert,update on app.%I to cluvo_command_owner',n);
 execute format('create policy club_admin_writer on app.%I for all to cluvo_command_owner using(true) with check(true)',n);
 end loop;
end;$writers$;

create function api.club_admin_access(p_slug text)returns jsonb language sql stable security invoker set search_path='' as $$select internal.club_admin_access(p_slug);$$;
create function api.club_admin_read(p_tenant uuid,p_section text,p_season uuid default null,p_resource uuid default null,p_query text default '',p_status text default '',p_limit integer default 100,p_offset integer default 0,p_filters jsonb default '{}'::jsonb)returns jsonb language sql stable security invoker set search_path='' as $$select internal.club_admin_read(p_tenant,p_section,p_season,p_resource,p_query,p_status,p_limit,p_offset,p_filters);$$;
do $security$ declare r record;begin
 for r in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('api','internal') and p.proname like 'club_admin_%' loop
 execute format('alter function %s owner to cluvo_command_owner',r.signature);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
 if r.proname<>'club_admin_can' then execute format('grant execute on function %s to authenticated',r.signature);end if;
 end loop;
end;$security$;
grant select on api.volunteer_fund_balance to cluvo_command_owner;
revoke create on schema internal,api from cluvo_command_owner;
notify pgrst,'reload schema';
commit;
