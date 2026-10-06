-- Account preferences are global, intentionally independent of tenant, person,
-- role and season. A dismissal is monotonic; concurrent topics cannot overwrite
-- one another. No existing migration or booking/ledger contract is changed.
begin;

create table app.help_topics (
  topic_id text primary key check (topic_id ~ '^[a-z][a-z0-9_.-]{1,178}$')
);

insert into app.help_topics (topic_id) values
  ('dialog.appointment'),
  ('dialog.appreciation'),
  ('dialog.assign'),
  ('dialog.budget'),
  ('dialog.calendar-item'),
  ('dialog.calendar-new'),
  ('dialog.cancel'),
  ('dialog.card'),
  ('dialog.card-new'),
  ('dialog.cluster'),
  ('dialog.column'),
  ('dialog.committee-member'),
  ('dialog.confirm'),
  ('dialog.discover'),
  ('dialog.family-detail'),
  ('dialog.feedback'),
  ('dialog.finance-correction'),
  ('dialog.follow-up'),
  ('dialog.help-request'),
  ('dialog.hours-approval'),
  ('dialog.hours-check'),
  ('dialog.household-change'),
  ('dialog.household-new'),
  ('dialog.household-person'),
  ('dialog.household-request'),
  ('dialog.instructions'),
  ('dialog.issue'),
  ('dialog.knowledge-new'),
  ('dialog.knowledge-read'),
  ('dialog.match-change'),
  ('dialog.member-goal'),
  ('dialog.no-show'),
  ('dialog.phone'),
  ('dialog.planning-change'),
  ('dialog.policy-new'),
  ('dialog.policy-question'),
  ('dialog.qualification'),
  ('dialog.reset'),
  ('dialog.role-new'),
  ('dialog.roster-template'),
  ('dialog.search'),
  ('dialog.season'),
  ('dialog.sick'),
  ('dialog.swap'),
  ('dialog.swap-confirm'),
  ('dialog.task-book'),
  ('dialog.task-edit'),
  ('dialog.team-book'),
  ('dialog.team-goal'),
  ('dialog.team-task'),
  ('dialog.template-new'),
  ('dialog.vacancy'),
  ('dialog.winter-plan'),
  ('family.member-goals'),
  ('family.timeline'),
  ('finance.agreements'),
  ('finance.settlement'),
  ('household.agreements'),
  ('household.history'),
  ('household.overview'),
  ('household.people'),
  ('households.exemptions'),
  ('households.requests'),
  ('households.winter'),
  ('messages.conversations'),
  ('messages.notifications'),
  ('page.acties'),
  ('page.agenda'),
  ('page.beleid'),
  ('page.berichten'),
  ('page.commissies'),
  ('page.diensten'),
  ('page.financien'),
  ('page.gezin'),
  ('page.huishoudens'),
  ('page.instellingen'),
  ('page.intake'),
  ('page.kanban'),
  ('page.opleidingen'),
  ('page.overzicht'),
  ('page.planbord'),
  ('page.rapportages'),
  ('page.ruilmarkt'),
  ('page.taken'),
  ('page.teams'),
  ('page.templates'),
  ('page.vacatures'),
  ('page.waardering'),
  ('page.wedstrijden'),
  ('panel.appointments'),
  ('panel.association-tasks'),
  ('panel.audit'),
  ('panel.budget'),
  ('panel.choose-executor'),
  ('panel.club-settings'),
  ('panel.clusters'),
  ('panel.committee-capacity'),
  ('panel.committee-members'),
  ('panel.committee-work'),
  ('panel.dashboard-advice'),
  ('panel.demo-reset'),
  ('panel.distribution-settings'),
  ('panel.documents'),
  ('panel.family-hours'),
  ('panel.feedback-inbox'),
  ('panel.follow-up'),
  ('panel.handover'),
  ('panel.hours-settings'),
  ('panel.household'),
  ('panel.import'),
  ('panel.install'),
  ('panel.instructions'),
  ('panel.match-sync'),
  ('panel.matches'),
  ('panel.my-interest'),
  ('panel.my-team-tasks'),
  ('panel.my-teams'),
  ('panel.new-season'),
  ('panel.next-actions'),
  ('panel.notification-preferences'),
  ('panel.personal-feedback'),
  ('panel.policy-confirmations'),
  ('panel.qualifications'),
  ('panel.reserve'),
  ('panel.roster'),
  ('panel.saved-segments'),
  ('panel.season-history'),
  ('panel.segments'),
  ('panel.send-log'),
  ('panel.send-rules'),
  ('panel.sign-in'),
  ('panel.smart-distribution'),
  ('panel.supply'),
  ('panel.team-actions'),
  ('panel.team-households'),
  ('panel.team-planning'),
  ('panel.team-progress'),
  ('panel.template'),
  ('panel.training-buddy'),
  ('panel.upcoming'),
  ('panel.volunteer-care'),
  ('panel.volunteer-roles'),
  ('panel.winter-target'),
  ('panel.work-together'),
  ('policy.acceptance'),
  ('policy.history'),
  ('policy.read'),
  ('team.advisor'),
  ('team.market');

create table app.user_help_seen (
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  topic_id text not null references app.help_topics(topic_id) on delete restrict,
  seen_at timestamptz not null default statement_timestamp(),
  primary key (auth_user_id, topic_id)
);

alter table app.help_topics enable row level security;
alter table app.help_topics force row level security;
alter table app.user_help_seen enable row level security;
alter table app.user_help_seen force row level security;

revoke all on app.help_topics, app.user_help_seen from public, anon, authenticated, service_role;
grant select on app.help_topics, app.user_help_seen to authenticated, cluvo_command_owner;
grant insert on app.user_help_seen to cluvo_command_owner;

create policy authenticated_help_catalog on app.help_topics
  for select to authenticated using (true);
create policy command_help_catalog on app.help_topics
  for select to cluvo_command_owner using (true);
create policy own_help_seen on app.user_help_seen
  for select to authenticated using (auth_user_id = (select auth.uid()));
create policy command_help_seen_select on app.user_help_seen
  for select to cluvo_command_owner using (true);
create policy command_help_seen_insert on app.user_help_seen
  for insert to cluvo_command_owner with check (auth_user_id = internal.current_actor_uid());

create view api.my_help_seen with (security_invoker = true) as
  select topic_id, seen_at from app.user_help_seen
  where auth_user_id = (select auth.uid());
revoke all on api.my_help_seen from public, anon, authenticated, service_role;
grant select on api.my_help_seen to authenticated;

create function internal.mark_help_seen(p_topic_id text)
returns table (topic_id text, seen_at timestamptz)
language plpgsql security definer set search_path = '' as $function$
declare
  v_actor uuid := internal.current_actor_uid();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_topic_id is null or not exists (
    select 1 from app.help_topics as topic where topic.topic_id = p_topic_id
  ) then
    raise exception using errcode = '22023', message = 'UNKNOWN_HELP_TOPIC';
  end if;

  -- The actor/topic primary key is the idempotency key. There is no mutable
  -- preference document or version to race against, and no client actor input.
  insert into app.user_help_seen (auth_user_id, topic_id)
    values (v_actor, p_topic_id) on conflict on constraint user_help_seen_pkey do nothing;
  return query select preference.topic_id, preference.seen_at
    from app.user_help_seen as preference
    where preference.auth_user_id = v_actor and preference.topic_id = p_topic_id;
end;
$function$;
alter function internal.mark_help_seen(text) owner to cluvo_command_owner;
revoke all on function internal.mark_help_seen(text) from public, anon, authenticated, service_role;
grant execute on function internal.mark_help_seen(text) to authenticated;

create function api.mark_help_seen(p_topic_id text)
returns table (topic_id text, seen_at timestamptz)
language sql security invoker set search_path = '' as $function$
  select * from internal.mark_help_seen(p_topic_id);
$function$;
revoke all on function api.mark_help_seen(text) from public, anon, authenticated, service_role;
grant execute on function api.mark_help_seen(text) to authenticated;

create view api.my_active_seasons with (security_invoker = true) as
  select tenant_id, id as season_id, name from app.seasons where status = 'active';
revoke all on api.my_active_seasons from public, anon, authenticated, service_role;
grant select on api.my_active_seasons to authenticated;

-- Reuse the canonical obligation status (including structural coverage) while
-- retaining the explicit household link. Never select an arbitrary historical
-- obligation for a dashboard and never infer links from an account or child.
create view api.my_household_season_progress with (security_invoker = true) as
  select distinct status.tenant_id, household.household_id, status.obligation_id,
    status.season_id, status.effective_target_minutes,
    status.effective_winter_minutes, status.confirmed_minutes,
    status.planned_minutes, status.pending_minutes, status.remaining_minutes,
    status.winter_deficit_minutes, status.structurally_covered,
    status.annual_state, status.open_dispute_count
  from api.my_households as household
  join app.household_obligation_links as link
    on link.tenant_id = household.tenant_id
    and link.household_id = household.household_id
    and link.starts_at <= statement_timestamp()
    and (link.ends_at is null or link.ends_at > statement_timestamp())
  join api.my_obligation_status as status
    on status.tenant_id = link.tenant_id and status.obligation_id = link.obligation_id
  where household.can_view_progress;
revoke all on api.my_household_season_progress from public, anon, authenticated, service_role;
grant select on api.my_household_season_progress to authenticated;

comment on table app.user_help_seen is
  'First account/topic dismissal, recorded with verified actor and server time; append-only. No private dossier or tenant state.';

commit;
