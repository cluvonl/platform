-- Cluvo WP3-WP5 domain layer.
--
-- This migration deliberately keeps recognised volunteer appointments separate
-- from permission roles/access grants.  It also keeps confirmed minutes in the
-- append-only hour ledger: structural coverage and winter allocations never
-- manufacture ledger entries.

insert into app.permissions (permission_key, description) values
  ('volunteer_role.manage', 'Recognise and end structural volunteer appointments'),
  ('obligation.review', 'Review obligations and create winter work lists'),
  ('exception.review', 'Review a versioned obligation exception proposal'),
  ('exception.finalize', 'Finalize a fully reviewed obligation exception'),
  ('waitlist.manage', 'Offer a released position to the next waitlist candidate')
on conflict (permission_key) do nothing;

-- Planning capacity is category policy, not a UI convention.  The plan-board
-- command below enforces this value for every input route (form and drag).
alter table app.task_categories
  add column minimum_positions integer not null default 1
  check (minimum_positions between 1 and 100);

create table app.volunteer_role_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, name),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.volunteer_role_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role_id uuid not null,
  revision integer not null check (revision > 0),
  household_exempt boolean not null default false,
  recognition_rules jsonb not null default '{}'::jsonb
    check (jsonb_typeof(recognition_rules) = 'object'),
  effective_from date not null,
  effective_until date,
  approved_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, role_id, revision),
  foreign key (tenant_id, role_id)
    references app.volunteer_role_catalog(tenant_id, id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict,
  check (effective_until is null or effective_until >= effective_from)
);

alter table app.obligations
  add constraint obligations_tenant_id_assessed_household_uq
  unique (tenant_id, id, assessed_household_id);

create table app.volunteer_appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  household_id uuid not null,
  obligation_id uuid not null,
  role_version_id uuid not null,
  committee_id uuid,
  team_id uuid,
  starts_on date not null,
  ends_on date,
  status text not null default 'recognized'
    check (status in ('recognized', 'ended', 'revoked')),
  recognized_by_auth_user_id uuid not null,
  annual_confirmed_at timestamptz,
  ended_by_auth_user_id uuid,
  end_reason text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id, household_id)
    references app.obligations(tenant_id, id, assessed_household_id) on delete restrict,
  foreign key (tenant_id, role_version_id)
    references app.volunteer_role_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  foreign key (recognized_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (ended_by_auth_user_id) references auth.users(id) on delete restrict,
  check (num_nonnulls(committee_id, team_id) <= 1),
  check (ends_on is null or ends_on >= starts_on),
  check (
    (status = 'recognized' and ended_by_auth_user_id is null and end_reason is null)
    or (status in ('ended', 'revoked') and ends_on is not null
        and ended_by_auth_user_id is not null and nullif(btrim(end_reason), '') is not null)
  )
);

create index volunteer_appointments_household_period_idx
  on app.volunteer_appointments (tenant_id, household_id, starts_on, ends_on)
  where status = 'recognized';

create table app.exception_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  obligation_id uuid not null,
  case_type text not null
    check (case_type in (
      'adjusted_effort', 'deferral', 'reduction', 'temporary_exemption',
      'full_exemption', 'buyout', 'appointment_change', 'household_change'
    )),
  requested_by_auth_user_id uuid not null,
  requested_for_person_id uuid,
  state text not null default 'submitted'
    check (state in ('submitted', 'in_review', 'escalated', 'approved', 'rejected', 'withdrawn')),
  current_revision integer not null default 1 check (current_revision > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, requested_for_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (requested_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.exception_case_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_id uuid not null,
  revision integer not null check (revision > 0),
  proposal_hash bytea not null,
  practical_reason text not null check (nullif(btrim(practical_reason), '') is not null),
  proposed_target_minutes integer not null check (proposed_target_minutes >= 0),
  proposed_winter_minutes integer not null check (proposed_winter_minutes >= 0),
  valid_from date not null,
  valid_until date,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, case_id, revision),
  foreign key (tenant_id, case_id) references app.exception_cases(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check (proposed_winter_minutes <= proposed_target_minutes),
  check (valid_until is null or valid_until >= valid_from)
);

create table app.exception_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_revision_id uuid not null,
  reviewer_auth_user_id uuid not null,
  reviewer_person_id uuid not null,
  outcome text not null check (outcome in ('approve', 'reject', 'escalate')),
  has_conflict boolean not null default false,
  reason text not null check (nullif(btrim(reason), '') is not null),
  reviewed_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, case_revision_id, reviewer_auth_user_id),
  unique (tenant_id, case_revision_id, reviewer_person_id),
  foreign key (tenant_id, case_revision_id)
    references app.exception_case_revisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reviewer_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (reviewer_auth_user_id) references auth.users(id) on delete restrict
);

create table app.exception_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  case_revision_id uuid not null,
  obligation_id uuid not null,
  outcome text not null check (outcome in ('approved', 'rejected', 'escalated')),
  effective_target_minutes integer,
  effective_winter_minutes integer,
  valid_from date,
  valid_until date,
  financial_route text not null default 'none'
    check (financial_route in ('none', 'buyout', 'shortage')),
  finalized_by_auth_user_id uuid not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  decided_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, case_revision_id),
  foreign key (tenant_id, case_revision_id)
    references app.exception_case_revisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (finalized_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (outcome = 'approved'
      and effective_target_minutes is not null
      and effective_winter_minutes is not null
      and effective_target_minutes >= 0
      and effective_winter_minutes between 0 and effective_target_minutes
      and valid_from is not null)
    or (outcome <> 'approved'
      and effective_target_minutes is null
      and effective_winter_minutes is null
      and valid_from is null
      and valid_until is null
      and financial_route = 'none')
  ),
  check (valid_until is null or valid_until >= valid_from)
);

create table app.obligation_coverage_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  obligation_id uuid not null,
  household_id uuid not null,
  source_kind text not null check (source_kind in ('volunteer_appointment', 'exception')),
  appointment_id uuid,
  exception_decision_id uuid,
  decision_revision integer not null check (decision_revision > 0),
  effect text not null
    check (effect in ('household_exempt', 'coverage_ended', 'target_adjustment')),
  effective_target_minutes integer,
  effective_winter_minutes integer,
  starts_on date not null,
  ends_on date,
  decided_by_auth_user_id uuid not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  supersedes_decision_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, obligation_id, household_id)
    references app.obligations(tenant_id, id, assessed_household_id) on delete restrict,
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, appointment_id)
    references app.volunteer_appointments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, exception_decision_id)
    references app.exception_decisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, supersedes_decision_id)
    references app.obligation_coverage_decisions(tenant_id, id) on delete restrict,
  foreign key (decided_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (source_kind = 'volunteer_appointment' and appointment_id is not null and exception_decision_id is null)
    or (source_kind = 'exception' and appointment_id is null and exception_decision_id is not null)
  ),
  check (
    (effect = 'target_adjustment'
      and effective_target_minutes is not null
      and effective_winter_minutes is not null
      and effective_winter_minutes between 0 and effective_target_minutes)
    or (effect <> 'target_adjustment'
      and effective_target_minutes is null and effective_winter_minutes is null)
  ),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index obligation_coverage_appointment_revision_uq
  on app.obligation_coverage_decisions (tenant_id, appointment_id, decision_revision)
  where appointment_id is not null;
create unique index obligation_coverage_exception_revision_uq
  on app.obligation_coverage_decisions (tenant_id, exception_decision_id, decision_revision)
  where exception_decision_id is not null;

create table app.appointment_review_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_id uuid not null,
  obligation_id uuid not null,
  reason_kind text not null check (reason_kind in ('ended', 'start_changed', 'insufficient_activity')),
  reason text not null check (nullif(btrim(reason), '') is not null),
  state text not null default 'open' check (state in ('open', 'resolved', 'escalated')),
  opened_by_auth_user_id uuid not null,
  resolved_by_auth_user_id uuid,
  opened_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, appointment_id)
    references app.volunteer_appointments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (opened_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (resolved_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((state = 'open') = (resolved_at is null and resolved_by_auth_user_id is null))
);

create unique index appointment_review_cases_one_open_uq
  on app.appointment_review_cases (tenant_id, appointment_id, obligation_id)
  where state = 'open';

create table app.winter_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  obligation_id uuid not null,
  cutoff_at timestamptz not null,
  ledger_revision bigint not null check (ledger_revision >= 0),
  confirmed_minutes_before integer not null check (confirmed_minutes_before >= 0),
  pending_count integer not null check (pending_count >= 0),
  disputed_count integer not null check (disputed_count >= 0),
  annual_remaining_minutes integer not null check (annual_remaining_minutes >= 0),
  winter_deficit_minutes integer not null check (winter_deficit_minutes >= 0),
  allocatable_minutes integer not null check (allocatable_minutes >= 0),
  state text not null
    check (state in ('needs_review', 'open', 'allocated', 'closed', 'superseded')),
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, id, obligation_id),
  unique (tenant_id, obligation_id, cutoff_at, ledger_revision),
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check (allocatable_minutes <= winter_deficit_minutes),
  check (allocatable_minutes <= annual_remaining_minutes),
  check ((state = 'needs_review') = (pending_count > 0 or disputed_count > 0))
);

create table app.winter_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  review_id uuid not null,
  obligation_id uuid not null,
  booking_id uuid not null,
  allocated_minutes integer not null check (allocated_minutes > 0),
  state text not null default 'active'
    check (state in ('active', 'reopened', 'completed', 'cancelled')),
  allocated_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, review_id, obligation_id)
    references app.winter_reviews(tenant_id, id, obligation_id) on delete restrict,
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (allocated_by_auth_user_id) references auth.users(id) on delete restrict
);

create unique index winter_allocations_active_booking_uq
  on app.winter_allocations (tenant_id, review_id, booking_id)
  where state in ('active', 'completed');

create table app.booking_cancellations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  booking_id uuid not null,
  reason_kind text not null check (reason_kind in ('regular', 'sickness', 'emergency')),
  outcome text not null
    check (outcome in ('timely_cancelled', 'late_cancelled', 'sickness_reported', 'emergency_reported')),
  requested_at timestamptz not null default statement_timestamp(),
  cancellation_deadline_snapshot timestamptz not null,
  was_late boolean not null,
  actor_auth_user_id uuid not null,
  represented_person_id uuid,
  description text,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, booking_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, represented_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (reason_kind = 'regular' and outcome in ('timely_cancelled', 'late_cancelled'))
    or (reason_kind = 'sickness' and outcome = 'sickness_reported')
    or (reason_kind = 'emergency' and outcome = 'emergency_reported')
  ),
  check (was_late = (requested_at >= cancellation_deadline_snapshot))
);

create table app.transfer_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  origin_booking_id uuid not null,
  replacement_person_id uuid,
  replacement_obligation_id uuid,
  mode text not null default 'takeover' check (mode in ('takeover', 'mutual_swap')),
  counterpart_booking_id uuid,
  origin_version_snapshot bigint not null check (origin_version_snapshot > 0),
  state text not null default 'open'
    check (state in ('open', 'accepted', 'withdrawn', 'expired', 'rejected')),
  expires_at timestamptz not null,
  requested_by_auth_user_id uuid not null,
  accepted_by_auth_user_id uuid,
  accepted_booking_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, origin_booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, replacement_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, replacement_obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, counterpart_booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, accepted_booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (requested_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (accepted_by_auth_user_id) references auth.users(id) on delete restrict,
  check (expires_at > created_at),
  check (
    (mode = 'takeover' and counterpart_booking_id is null)
    or (mode = 'mutual_swap' and counterpart_booking_id is not null)
  ),
  check (
    (state = 'accepted' and accepted_by_auth_user_id is not null and accepted_booking_id is not null)
    or (state <> 'accepted' and accepted_by_auth_user_id is null and accepted_booking_id is null)
  )
);

create unique index transfer_requests_one_active_origin_uq
  on app.transfer_requests (tenant_id, origin_booking_id)
  where state = 'open';

create table app.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  shift_id uuid not null,
  person_id uuid not null,
  obligation_id uuid not null,
  state text not null default 'waiting'
    check (state in ('waiting', 'offered', 'booked', 'withdrawn', 'skipped')),
  joined_at timestamptz not null default statement_timestamp(),
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict
);

create unique index waitlist_entries_active_person_shift_uq
  on app.waitlist_entries (tenant_id, shift_id, person_id)
  where state in ('waiting', 'offered');
create index waitlist_entries_fifo_idx
  on app.waitlist_entries (tenant_id, shift_id, joined_at, id)
  where state = 'waiting';

create table app.waitlist_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entry_id uuid not null,
  position_id uuid not null,
  state text not null default 'active'
    check (state in ('active', 'accepted', 'declined', 'expired', 'cancelled')),
  offered_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_booking_id uuid,
  accepted_idempotency_key uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, entry_id) references app.waitlist_entries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, position_id) references app.shift_positions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, consumed_booking_id) references app.bookings(tenant_id, id) on delete restrict,
  check (expires_at > offered_at),
  check (
    (state = 'accepted' and consumed_booking_id is not null and accepted_idempotency_key is not null)
    or (state <> 'accepted' and consumed_booking_id is null and accepted_idempotency_key is null)
  )
);

create unique index waitlist_offers_active_position_uq
  on app.waitlist_offers (tenant_id, position_id)
  where state = 'active';
create unique index waitlist_offers_active_entry_uq
  on app.waitlist_offers (tenant_id, entry_id)
  where state = 'active';

-- The command owner is deliberately narrow and still subject to FORCE RLS.
grant select on
  app.volunteer_role_catalog,
  app.volunteer_role_versions,
  app.volunteer_appointments,
  app.exception_cases,
  app.exception_case_revisions,
  app.exception_reviews,
  app.exception_decisions,
  app.obligation_coverage_decisions,
  app.appointment_review_cases,
  app.winter_reviews,
  app.winter_allocations,
  app.booking_cancellations,
  app.transfer_requests,
  app.waitlist_entries,
  app.waitlist_offers
to cluvo_command_owner;

grant insert, update on
  app.volunteer_role_catalog,
  app.volunteer_appointments,
  app.exception_cases,
  app.appointment_review_cases,
  app.winter_reviews,
  app.winter_allocations,
  app.transfer_requests,
  app.waitlist_entries,
  app.waitlist_offers
to cluvo_command_owner;

grant insert on
  app.volunteer_role_versions,
  app.exception_case_revisions,
  app.exception_reviews,
  app.exception_decisions,
  app.obligation_coverage_decisions,
  app.booking_cancellations
to cluvo_command_owner;

grant select, insert, update on app.shifts to cluvo_command_owner;
grant select, insert, update on app.shift_positions to cluvo_command_owner;

do $rls$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'volunteer_role_catalog', 'volunteer_role_versions', 'volunteer_appointments',
    'exception_cases', 'exception_case_revisions', 'exception_reviews',
    'exception_decisions', 'obligation_coverage_decisions',
    'appointment_review_cases', 'winter_reviews', 'winter_allocations',
    'booking_cancellations', 'transfer_requests', 'waitlist_entries', 'waitlist_offers'
  ]
  loop
    execute format('alter table app.%I enable row level security', relation_name);
    execute format('alter table app.%I force row level security', relation_name);
    execute format(
      'create policy command_owner_select on app.%I for select to cluvo_command_owner using (true)',
      relation_name
    );
    execute format(
      'create policy command_owner_insert on app.%I for insert to cluvo_command_owner with check (true)',
      relation_name
    );
    execute format(
      'create policy command_owner_update on app.%I for update to cluvo_command_owner using (true) with check (true)',
      relation_name
    );
  end loop;
end
$rls$;

create policy wp3_command_owner_update on app.shift_positions
  for update to cluvo_command_owner using (true) with check (true);
create policy wp3_command_owner_insert on app.shift_positions
  for insert to cluvo_command_owner with check (true);
create policy wp3_command_owner_insert on app.shifts
  for insert to cluvo_command_owner with check (true);
create policy wp3_command_owner_update on app.shifts
  for update to cluvo_command_owner using (true) with check (true);

-- Published role definitions are visible to active members.  Appointment and
-- obligation records remain limited to the person's dossier/progress scope.
create policy member_volunteer_role_catalog on app.volunteer_role_catalog
  for select to authenticated using ((select internal.is_active_member(tenant_id)));
create policy member_volunteer_role_versions on app.volunteer_role_versions
  for select to authenticated using ((select internal.is_active_member(tenant_id)));
create policy visible_volunteer_appointments on app.volunteer_appointments
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.can_access_household(tenant_id, household_id, 'view_progress'))
    or (select internal.has_permission(tenant_id, 'volunteer_role.manage', 'tenant', tenant_id))
  );
create policy visible_exception_cases on app.exception_cases
  for select to authenticated using (
    requested_by_auth_user_id = (select auth.uid())
    or (select internal.has_permission(tenant_id, 'exception.review', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'exception.finalize', 'tenant', tenant_id))
  );
create policy visible_exception_revisions on app.exception_case_revisions
  for select to authenticated using (
    exists (
      select 1 from app.exception_cases as case_row
      where case_row.tenant_id = exception_case_revisions.tenant_id
        and case_row.id = exception_case_revisions.case_id
        and (
          case_row.requested_by_auth_user_id = (select auth.uid())
          or (select internal.has_permission(case_row.tenant_id, 'exception.review', 'tenant', case_row.tenant_id))
          or (select internal.has_permission(case_row.tenant_id, 'exception.finalize', 'tenant', case_row.tenant_id))
        )
    )
  );
create policy visible_exception_reviews on app.exception_reviews
  for select to authenticated using (
    reviewer_auth_user_id = (select auth.uid())
    or (select internal.has_permission(tenant_id, 'exception.review', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'exception.finalize', 'tenant', tenant_id))
  );
create policy visible_exception_decisions on app.exception_decisions
  for select to authenticated using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or (select internal.has_permission(tenant_id, 'exception.review', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'exception.finalize', 'tenant', tenant_id))
  );
create policy visible_coverage_decisions on app.obligation_coverage_decisions
  for select to authenticated using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or (select internal.has_permission(tenant_id, 'obligation.review', 'tenant', tenant_id))
  );
create policy visible_appointment_reviews on app.appointment_review_cases
  for select to authenticated using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or (select internal.has_permission(tenant_id, 'obligation.review', 'tenant', tenant_id))
  );
create policy visible_winter_reviews on app.winter_reviews
  for select to authenticated using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or (select internal.has_permission(tenant_id, 'obligation.review', 'tenant', tenant_id))
  );
create policy visible_winter_allocations on app.winter_allocations
  for select to authenticated using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or (select internal.has_permission(tenant_id, 'obligation.review', 'tenant', tenant_id))
  );
create policy visible_booking_cancellations on app.booking_cancellations
  for select to authenticated using (
    actor_auth_user_id = (select auth.uid())
    or exists (
      select 1 from app.bookings as booking
      where booking.tenant_id = booking_cancellations.tenant_id
        and booking.id = booking_cancellations.booking_id
        and (select internal.is_self_person(booking.tenant_id, booking.executor_person_id))
    )
  );
create policy visible_transfer_requests on app.transfer_requests
  for select to authenticated using (
    requested_by_auth_user_id = (select auth.uid())
    or (replacement_person_id is not null
      and (select internal.is_self_person(tenant_id, replacement_person_id)))
  );
create policy visible_waitlist_entries on app.waitlist_entries
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'waitlist.manage', 'tenant', tenant_id))
  );
create policy visible_waitlist_offers on app.waitlist_offers
  for select to authenticated using (
    exists (
      select 1 from app.waitlist_entries as entry
      where entry.tenant_id = waitlist_offers.tenant_id
        and entry.id = waitlist_offers.entry_id
        and (
          (select internal.is_self_person(entry.tenant_id, entry.person_id))
          or (select internal.has_permission(entry.tenant_id, 'waitlist.manage', 'tenant', entry.tenant_id))
        )
    )
  );

grant select on
  app.volunteer_role_catalog,
  app.volunteer_role_versions,
  app.volunteer_appointments,
  app.exception_cases,
  app.exception_case_revisions,
  app.exception_reviews,
  app.exception_decisions,
  app.obligation_coverage_decisions,
  app.appointment_review_cases,
  app.winter_reviews,
  app.winter_allocations,
  app.booking_cancellations,
  app.transfer_requests,
  app.waitlist_entries,
  app.waitlist_offers
to authenticated;

create trigger volunteer_role_versions_immutable
before update or delete on app.volunteer_role_versions
for each row execute function internal.reject_immutable_change();
create trigger exception_case_revisions_immutable
before update or delete on app.exception_case_revisions
for each row execute function internal.reject_immutable_change();
create trigger exception_reviews_immutable
before update or delete on app.exception_reviews
for each row execute function internal.reject_immutable_change();
create trigger exception_decisions_immutable
before update or delete on app.exception_decisions
for each row execute function internal.reject_immutable_change();
create trigger obligation_coverage_decisions_immutable
before update or delete on app.obligation_coverage_decisions
for each row execute function internal.reject_immutable_change();
create trigger booking_cancellations_immutable
before update or delete on app.booking_cancellations
for each row execute function internal.reject_immutable_change();

-- Keep new permission mappings correct for existing tenants and for role rows
-- created by the foundation tenant trigger in the future.
create or replace function internal.seed_wp3_wp5_role_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into app.role_permissions (tenant_id, role_id, permission_key)
  select new.tenant_id, new.id, mapping.permission_key
  from (
    values
      ('volunteer_committee', 'volunteer_role.manage'),
      ('volunteer_committee', 'obligation.review'),
      ('volunteer_committee', 'exception.review'),
      ('volunteer_committee', 'exception.finalize'),
      ('volunteer_committee', 'waitlist.manage'),
      ('committee_coordinator', 'waitlist.manage'),
      ('board', 'exception.review'),
      ('board', 'exception.finalize')
  ) as mapping(role_key, permission_key)
  where mapping.role_key = new.role_key
  on conflict (tenant_id, role_id, permission_key) do nothing;
  return new;
end;
$function$;

alter function internal.seed_wp3_wp5_role_permissions() owner to cluvo_command_owner;
revoke execute on function internal.seed_wp3_wp5_role_permissions()
  from public, anon, authenticated, service_role;

create trigger permission_roles_seed_wp3_wp5
after insert on app.permission_roles
for each row execute function internal.seed_wp3_wp5_role_permissions();

insert into app.role_permissions (tenant_id, role_id, permission_key)
select role_row.tenant_id, role_row.id, mapping.permission_key
from app.permission_roles as role_row
join (
  values
    ('volunteer_committee', 'volunteer_role.manage'),
    ('volunteer_committee', 'obligation.review'),
    ('volunteer_committee', 'exception.review'),
    ('volunteer_committee', 'exception.finalize'),
    ('volunteer_committee', 'waitlist.manage'),
    ('committee_coordinator', 'waitlist.manage'),
    ('board', 'exception.review'),
    ('board', 'exception.finalize')
) as mapping(role_key, permission_key)
  on mapping.role_key = role_row.role_key
on conflict (tenant_id, role_id, permission_key) do nothing;

create or replace function internal.validate_exception_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_revision app.exception_case_revisions%rowtype;
  v_case app.exception_cases%rowtype;
  v_matching_auth integer;
  v_matching_person integer;
  v_review_count integer;
  v_has_conflict boolean;
  v_distinct_outcomes integer;
begin
  select * into v_revision
  from app.exception_case_revisions
  where tenant_id = new.tenant_id and id = new.case_revision_id;
  if not found then
    raise exception using errcode = '23503', message = 'CASE_REVISION_NOT_FOUND';
  end if;

  select * into v_case
  from app.exception_cases
  where tenant_id = new.tenant_id and id = v_revision.case_id;

  if new.obligation_id <> v_case.obligation_id then
    raise exception using errcode = '23514', message = 'DECISION_OBLIGATION_MISMATCH';
  end if;

  select
    count(distinct reviewer_auth_user_id),
    count(distinct reviewer_person_id),
    count(*),
    coalesce(bool_or(has_conflict), false),
    count(distinct outcome)
  into v_matching_auth, v_matching_person, v_review_count, v_has_conflict, v_distinct_outcomes
  from app.exception_reviews
  where tenant_id = new.tenant_id
    and case_revision_id = new.case_revision_id
    and (
      (new.outcome = 'approved' and outcome = 'approve' and not has_conflict)
      or (new.outcome = 'rejected' and outcome = 'reject' and not has_conflict)
      or new.outcome = 'escalated'
    );

  if new.outcome in ('approved', 'rejected')
    and (v_matching_auth < 2 or v_matching_person < 2) then
    raise exception using errcode = 'P0001', message = 'SECOND_REVIEW_REQUIRED';
  end if;

  if new.outcome = 'escalated'
    and (v_review_count < 2 or not (v_has_conflict or v_distinct_outcomes > 1)) then
    raise exception using errcode = 'P0001', message = 'ESCALATION_REVIEW_REQUIRED';
  end if;

  if new.outcome = 'approved' and (
    new.effective_target_minutes <> v_revision.proposed_target_minutes
    or new.effective_winter_minutes <> v_revision.proposed_winter_minutes
    or new.valid_from <> v_revision.valid_from
    or new.valid_until is distinct from v_revision.valid_until
  ) then
    raise exception using errcode = '23514', message = 'DECISION_PROPOSAL_MISMATCH';
  end if;

  return new;
end;
$function$;

alter function internal.validate_exception_decision() owner to cluvo_command_owner;
revoke execute on function internal.validate_exception_decision()
  from public, anon, authenticated, service_role;

create trigger exception_decisions_require_two_reviews
before insert on app.exception_decisions
for each row execute function internal.validate_exception_decision();

-- Shared idempotency primitive.  Request JSON is jsonb, so its textual form is
-- canonical for equivalent object key ordering.
create or replace function internal.claim_idempotency(
  p_tenant_id uuid,
  p_operation text,
  p_idempotency_key uuid,
  p_request jsonb
)
returns table (record_id uuid, replay_result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_hash bytea;
  v_row app.idempotency_records%rowtype;
begin
  if v_actor is null or p_idempotency_key is null
    or nullif(btrim(p_operation), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  v_hash := extensions.digest(convert_to(p_request::text, 'UTF8'), 'sha256');

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, p_operation, p_idempotency_key, v_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into record_id;

  if record_id is not null then
    replay_result := null;
    return next;
    return;
  end if;

  select * into v_row
  from app.idempotency_records
  where tenant_id = p_tenant_id
    and actor_auth_user_id = v_actor
    and operation = p_operation
    and idempotency_key = p_idempotency_key
  for update;

  if v_row.request_hash <> v_hash then
    raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_row.status <> 'completed' then
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  record_id := v_row.id;
  replay_result := v_row.result_jsonb;
  return next;
end;
$function$;

create or replace function internal.complete_idempotency(
  p_record_id uuid,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update app.idempotency_records
  set status = 'completed', result_jsonb = p_result, completed_at = statement_timestamp()
  where id = p_record_id and status = 'processing';
  if not found then
    raise exception using errcode = '55000', message = 'IDEMPOTENCY_RECORD_NOT_PROCESSING';
  end if;
end;
$function$;

alter function internal.claim_idempotency(uuid, text, uuid, jsonb) owner to cluvo_command_owner;
alter function internal.complete_idempotency(uuid, jsonb) owner to cluvo_command_owner;
revoke execute on function internal.claim_idempotency(uuid, text, uuid, jsonb)
  from public, anon, service_role;
revoke execute on function internal.complete_idempotency(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function internal.claim_idempotency(uuid, text, uuid, jsonb)
  to authenticated, cluvo_command_owner;
grant execute on function internal.complete_idempotency(uuid, jsonb)
  to cluvo_command_owner;

create or replace function internal.current_person_id(p_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select link.person_id
  from app.account_person_links as link
  where link.tenant_id = p_tenant_id
    and link.auth_user_id = (select internal.current_actor_uid())
    and link.revoked_at is null
  limit 1;
$function$;

alter function internal.current_person_id(uuid) owner to cluvo_command_owner;
revoke execute on function internal.current_person_id(uuid) from public, anon, service_role;
grant execute on function internal.current_person_id(uuid) to authenticated, cluvo_command_owner;

create or replace function internal.assert_booking_eligibility(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_executor_person_id uuid,
  p_obligation_id uuid,
  p_excluding_booking_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_person app.persons%rowtype;
  v_obligation app.obligations%rowtype;
  v_shift app.shifts%rowtype;
  v_requirement app.shift_requirements%rowtype;
  v_timezone text;
begin
  select * into v_person
  from app.persons
  where tenant_id = p_tenant_id and id = p_executor_person_id;
  if not found or v_person.status <> 'active' then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = p_obligation_id;
  if not found or v_obligation.status not in ('active', 'review_hold', 'fulfilled') then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  select * into v_shift
  from app.shifts
  where tenant_id = p_tenant_id and id = p_shift_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_shift.state <> 'published'
    or (v_shift.booking_opens_at is not null and statement_timestamp() < v_shift.booking_opens_at)
    or (v_shift.booking_closes_at is not null and statement_timestamp() >= v_shift.booking_closes_at) then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  if not internal.can_book_executor(p_tenant_id, p_executor_person_id, p_obligation_id)
    or not internal.has_permission(
      p_tenant_id, 'shift.book', 'household', v_obligation.assessed_household_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from app.executor_obligation_grants as executor_grant
    where executor_grant.tenant_id = p_tenant_id
      and executor_grant.person_id = p_executor_person_id
      and executor_grant.obligation_id = p_obligation_id
      and executor_grant.valid_from <= v_shift.starts_at
      and (executor_grant.valid_until is null or executor_grant.valid_until >= v_shift.ends_at)
      and executor_grant.revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  select * into v_requirement
  from app.shift_requirements
  where tenant_id = p_tenant_id and shift_id = p_shift_id;
  select timezone into v_timezone from app.tenants where id = p_tenant_id;

  if v_requirement.id is not null and v_requirement.minimum_age is not null
    and (
      v_person.birth_date is null
      or v_person.birth_date_precision <> 'day'
      or v_person.birth_date + make_interval(years => v_requirement.minimum_age)
        > (v_shift.starts_at at time zone v_timezone)::date
    ) then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  if v_requirement.id is not null and v_requirement.qualification_type_id is not null
    and not exists (
      select 1
      from app.person_qualifications as qualification
      where qualification.tenant_id = p_tenant_id
        and qualification.person_id = p_executor_person_id
        and qualification.qualification_type_id = v_requirement.qualification_type_id
        and qualification.achieved_at <= v_shift.starts_at
        and (qualification.expires_at is null or qualification.expires_at >= v_shift.ends_at)
        and qualification.revoked_at is null
    ) then
    raise exception using errcode = '42501', message = 'QUALIFICATION_EXPIRED';
  end if;

  if exists (
    select 1
    from app.unavailability_periods as unavailable
    where unavailable.tenant_id = p_tenant_id
      and unavailable.person_id = p_executor_person_id
      and tstzrange(unavailable.starts_at, unavailable.ends_at, '[)')
        && tstzrange(v_shift.starts_at, v_shift.ends_at, '[)')
  ) then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  if exists (
    select 1
    from app.bookings as existing_booking
    where existing_booking.tenant_id = p_tenant_id
      and existing_booking.executor_person_id = p_executor_person_id
      and existing_booking.id is distinct from p_excluding_booking_id
      and existing_booking.state in (
        'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
      )
      and tstzrange(existing_booking.starts_at_snapshot, existing_booking.ends_at_snapshot, '[)')
        && tstzrange(v_shift.starts_at, v_shift.ends_at, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'PERSON_OVERLAP';
  end if;
end;
$function$;

alter function internal.assert_booking_eligibility(uuid, uuid, uuid, uuid, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.assert_booking_eligibility(uuid, uuid, uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.assert_booking_eligibility(uuid, uuid, uuid, uuid, uuid)
  to authenticated, cluvo_command_owner;

create or replace function internal.recognize_volunteer_appointment(
  p_tenant_id uuid,
  p_role_version_id uuid,
  p_person_id uuid,
  p_household_id uuid,
  p_obligation_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_committee_id uuid,
  p_team_id uuid,
  p_expected_obligation_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_obligation app.obligations%rowtype;
  v_role_version app.volunteer_role_versions%rowtype;
  v_role_active boolean;
  v_appointment_id uuid := gen_random_uuid();
  v_coverage_id uuid;
  v_event_id uuid := gen_random_uuid();
  v_obligation_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'volunteer_role.manage', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_obligation_version is null
    or p_starts_on is null
    or nullif(btrim(p_reason), '') is null
    or p_starts_on > coalesce(p_ends_on, p_starts_on) then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'recognize_volunteer_appointment',
    p_idempotency_key,
    jsonb_build_object(
      'role_version_id', p_role_version_id,
      'person_id', p_person_id,
      'household_id', p_household_id,
      'obligation_id', p_obligation_id,
      'starts_on', p_starts_on,
      'ends_on', p_ends_on,
      'committee_id', p_committee_id,
      'team_id', p_team_id,
      'expected_obligation_version', p_expected_obligation_version,
      'reason', btrim(p_reason)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = p_obligation_id
  for update;
  if not found or v_obligation.assessed_household_id <> p_household_id then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_obligation.version <> p_expected_obligation_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;

  select version_row.* into v_role_version
  from app.volunteer_role_versions as version_row
  where version_row.tenant_id = p_tenant_id
    and version_row.id = p_role_version_id;
  if not found then
    raise exception using errcode = '42501', message = 'ROLE_VERSION_NOT_ACTIVE';
  end if;
  select catalog.active into v_role_active
  from app.volunteer_role_catalog as catalog
  where catalog.tenant_id = p_tenant_id and catalog.id = v_role_version.role_id;
  if not coalesce(v_role_active, false)
    or p_starts_on < v_role_version.effective_from
    or (v_role_version.effective_until is not null
      and (p_ends_on is null or p_ends_on > v_role_version.effective_until)) then
    raise exception using errcode = '42501', message = 'ROLE_VERSION_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
    from app.household_person_links as person_link
    where person_link.tenant_id = p_tenant_id
      and person_link.household_id = p_household_id
      and person_link.person_id = p_person_id
      and person_link.starts_at <= statement_timestamp()
      and (person_link.ends_at is null or person_link.ends_at > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'PERSON_NOT_IN_HOUSEHOLD';
  end if;

  insert into app.volunteer_appointments (
    id, tenant_id, person_id, household_id, obligation_id, role_version_id,
    committee_id, team_id, starts_on, ends_on, recognized_by_auth_user_id
  ) values (
    v_appointment_id, p_tenant_id, p_person_id, p_household_id, p_obligation_id, p_role_version_id,
    p_committee_id, p_team_id, p_starts_on, p_ends_on, v_actor
  );

  if v_role_version.household_exempt then
    v_coverage_id := gen_random_uuid();
    insert into app.obligation_coverage_decisions (
      id, tenant_id, obligation_id, household_id, source_kind, appointment_id,
      decision_revision, effect, starts_on, ends_on,
      decided_by_auth_user_id, reason
    ) values (
      v_coverage_id, p_tenant_id, p_obligation_id, p_household_id,
      'volunteer_appointment', v_appointment_id,
      1, 'household_exempt', p_starts_on, p_ends_on,
      v_actor, btrim(p_reason)
    );
  end if;

  update app.obligations as obligation
  set updated_at = statement_timestamp(), version = obligation.version + 1
  where obligation.tenant_id = p_tenant_id and obligation.id = p_obligation_id
  returning obligation.version into v_obligation_version;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'volunteer_appointment.recognized',
    'volunteer_appointment', v_appointment_id,
    'household', p_household_id, 'recognized_structural_role', p_idempotency_key,
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'household_exempt', v_role_version.household_exempt,
      'coverage_decision_id', v_coverage_id
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'volunteer_appointment', v_appointment_id, 1,
    'volunteer_appointment.recognized',
    jsonb_build_object('obligation_id', p_obligation_id, 'coverage_decision_id', v_coverage_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_appointment_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'coverage_decision_id', v_coverage_id,
      'household_exempt', v_role_version.household_exempt,
      'obligation_version', v_obligation_version
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);

  return query select true, v_appointment_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.recognize_volunteer_appointment(
  uuid, uuid, uuid, uuid, uuid, date, date, uuid, uuid, bigint, text, uuid
) owner to cluvo_command_owner;
revoke execute on function internal.recognize_volunteer_appointment(
  uuid, uuid, uuid, uuid, uuid, date, date, uuid, uuid, bigint, text, uuid
) from public, anon, service_role;
grant execute on function internal.recognize_volunteer_appointment(
  uuid, uuid, uuid, uuid, uuid, date, date, uuid, uuid, bigint, text, uuid
) to authenticated;

create or replace function api.recognize_volunteer_appointment(
  p_tenant_id uuid,
  p_role_version_id uuid,
  p_person_id uuid,
  p_household_id uuid,
  p_obligation_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_committee_id uuid,
  p_team_id uuid,
  p_expected_obligation_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.recognize_volunteer_appointment(
    p_tenant_id, p_role_version_id, p_person_id, p_household_id, p_obligation_id,
    p_starts_on, p_ends_on, p_committee_id, p_team_id,
    p_expected_obligation_version, p_reason, p_idempotency_key
  );
$function$;

revoke execute on function api.recognize_volunteer_appointment(
  uuid, uuid, uuid, uuid, uuid, date, date, uuid, uuid, bigint, text, uuid
) from public, anon, service_role;
grant execute on function api.recognize_volunteer_appointment(
  uuid, uuid, uuid, uuid, uuid, date, date, uuid, uuid, bigint, text, uuid
) to authenticated;

create or replace function internal.end_volunteer_appointment(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_expected_appointment_version bigint,
  p_ends_on date,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_appointment app.volunteer_appointments%rowtype;
  v_coverage app.obligation_coverage_decisions%rowtype;
  v_obligation app.obligations%rowtype;
  v_review_id uuid := gen_random_uuid();
  v_ending_decision_id uuid;
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_obligation_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'volunteer_role.manage', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_appointment_version is null or p_ends_on is null
    or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'end_volunteer_appointment',
    p_idempotency_key,
    jsonb_build_object(
      'appointment_id', p_appointment_id,
      'expected_appointment_version', p_expected_appointment_version,
      'ends_on', p_ends_on,
      'reason', btrim(p_reason)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_appointment
  from app.volunteer_appointments
  where tenant_id = p_tenant_id and id = p_appointment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_appointment.version <> p_expected_appointment_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_appointment.status <> 'recognized' or p_ends_on < v_appointment.starts_on then
    raise exception using errcode = '22023', message = 'APPOINTMENT_NOT_ACTIVE';
  end if;

  select coverage.* into v_coverage
  from app.obligation_coverage_decisions as coverage
  where coverage.tenant_id = p_tenant_id
    and coverage.appointment_id = p_appointment_id
  order by coverage.decision_revision desc
  limit 1;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = v_appointment.obligation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPOINTMENT_OBLIGATION_NOT_FOUND';
  end if;

  update app.volunteer_appointments as appointment
  set status = 'ended', ends_on = p_ends_on, ended_by_auth_user_id = v_actor,
      end_reason = btrim(p_reason), updated_at = statement_timestamp(),
      version = appointment.version + 1
  where appointment.tenant_id = p_tenant_id and appointment.id = p_appointment_id
  returning appointment.version into v_new_version;

  if v_coverage.effect = 'household_exempt' then
    v_ending_decision_id := gen_random_uuid();
    insert into app.obligation_coverage_decisions (
      id, tenant_id, obligation_id, household_id, source_kind, appointment_id,
      decision_revision, effect, starts_on, ends_on,
      decided_by_auth_user_id, reason, supersedes_decision_id
    ) values (
      v_ending_decision_id, p_tenant_id, v_coverage.obligation_id, v_coverage.household_id,
      'volunteer_appointment', p_appointment_id,
      v_coverage.decision_revision + 1, 'coverage_ended', p_ends_on, p_ends_on,
      v_actor, btrim(p_reason), v_coverage.id
    );
  end if;

  insert into app.appointment_review_cases (
    id, tenant_id, appointment_id, obligation_id, reason_kind, reason,
    opened_by_auth_user_id
  ) values (
    v_review_id, p_tenant_id, p_appointment_id, v_obligation.id,
    'ended', btrim(p_reason), v_actor
  );

  update app.obligations as obligation
  set status = 'review_hold', updated_at = statement_timestamp(),
      version = obligation.version + 1
  where obligation.tenant_id = p_tenant_id and obligation.id = v_obligation.id
  returning obligation.version into v_obligation_version;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'volunteer_appointment.ended',
    'volunteer_appointment', p_appointment_id,
    'household', v_appointment.household_id, 'appointment_ended', p_idempotency_key,
    jsonb_build_object(
      'review_case_id', v_review_id,
      'coverage_decision_id', v_ending_decision_id,
      'obligation_id', v_obligation.id
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'volunteer_appointment', p_appointment_id, v_new_version,
    'volunteer_appointment.ended',
    jsonb_build_object('review_case_id', v_review_id, 'obligation_id', v_obligation.id)
  );

  v_result := jsonb_build_object(
    'resource_id', p_appointment_id,
    'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'review_case_id', v_review_id,
      'coverage_decision_id', v_ending_decision_id,
      'obligation_version', v_obligation_version,
      'obligation_state', 'review_hold'
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, p_appointment_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.end_volunteer_appointment(uuid, uuid, bigint, date, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.end_volunteer_appointment(uuid, uuid, bigint, date, text, uuid)
  from public, anon, service_role;
grant execute on function internal.end_volunteer_appointment(uuid, uuid, bigint, date, text, uuid)
  to authenticated;

create or replace function api.end_volunteer_appointment(
  p_tenant_id uuid,
  p_appointment_id uuid,
  p_expected_appointment_version bigint,
  p_ends_on date,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.end_volunteer_appointment(
    p_tenant_id, p_appointment_id, p_expected_appointment_version,
    p_ends_on, p_reason, p_idempotency_key
  );
$function$;

revoke execute on function api.end_volunteer_appointment(uuid, uuid, bigint, date, text, uuid)
  from public, anon, service_role;
grant execute on function api.end_volunteer_appointment(uuid, uuid, bigint, date, text, uuid)
  to authenticated;

create or replace function internal.correct_attendance_award(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_expected_booking_version bigint,
  p_result text,
  p_awarded_minutes integer,
  p_correction_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_booking app.bookings%rowtype;
  v_position app.shift_positions%rowtype;
  v_shift app.shifts%rowtype;
  v_obligation app.obligations%rowtype;
  v_previous_decision app.attendance_decisions%rowtype;
  v_previous_ledger app.hour_ledger_entries%rowtype;
  v_decision_id uuid := gen_random_uuid();
  v_reversal_id uuid := gen_random_uuid();
  v_replacement_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_awarded integer;
  v_new_booking_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_booking_version is null
    or nullif(btrim(p_correction_reason), '') is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'correct_attendance_award',
    p_idempotency_key,
    jsonb_build_object(
      'booking_id', p_booking_id,
      'expected_booking_version', p_expected_booking_version,
      'result', p_result,
      'awarded_minutes', p_awarded_minutes,
      'correction_reason', btrim(p_correction_reason)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select booking.* into v_booking
  from app.bookings as booking
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = v_booking.obligation_id
  for update;
  select position.* into v_position
  from app.shift_positions as position
  where position.tenant_id = p_tenant_id and position.id = v_booking.position_id
  for update;
  select shift_row.* into v_shift
  from app.shifts as shift_row
  where shift_row.tenant_id = p_tenant_id and shift_row.id = v_position.shift_id
  for update;
  select booking.* into v_booking
  from app.bookings as booking
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id
  for update;

  if not internal.has_permission(
    p_tenant_id, 'attendance.confirm', 'committee', v_shift.committee_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_booking.version <> p_expected_booking_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_booking.current_attendance_decision_id is null
    or v_booking.state not in ('confirmed', 'no_show') then
    raise exception using errcode = 'P0001', message = 'NO_CONFIRMED_ATTENDANCE';
  end if;

  select * into v_previous_decision
  from app.attendance_decisions
  where tenant_id = p_tenant_id and id = v_booking.current_attendance_decision_id;
  select * into v_previous_ledger
  from app.hour_ledger_entries
  where tenant_id = p_tenant_id
    and booking_id = p_booking_id
    and attendance_decision_id = v_previous_decision.id
    and entry_kind in ('award', 'replacement')
  order by posted_at desc, id desc
  limit 1;
  if not found then
    raise exception using errcode = '55000', message = 'LEDGER_SOURCE_NOT_FOUND';
  end if;

  case p_result
    when 'present' then
      if p_awarded_minutes is not null
        and p_awarded_minutes <> v_booking.credit_minutes_snapshot then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      v_awarded := v_booking.credit_minutes_snapshot;
    when 'partial', 'club_cancelled' then
      if p_awarded_minutes is null or p_awarded_minutes < 0
        or p_awarded_minutes > v_booking.credit_minutes_snapshot then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      v_awarded := p_awarded_minutes;
    when 'no_show' then
      if coalesce(p_awarded_minutes, 0) <> 0 then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      v_awarded := 0;
    else
      raise exception using errcode = '22023', message = 'INVALID_ATTENDANCE_RESULT';
  end case;

  insert into app.attendance_decisions (
    id, tenant_id, booking_id, decision_revision, result, awarded_minutes,
    confirmed_by_auth_user_id, reason, previous_decision_id
  ) values (
    v_decision_id, p_tenant_id, p_booking_id,
    v_previous_decision.decision_revision + 1, p_result, v_awarded, v_actor,
    case when p_result in ('partial', 'club_cancelled')
      then btrim(p_correction_reason) else null end,
    v_previous_decision.id
  );

  insert into app.hour_ledger_entries (
    id, tenant_id, obligation_id, season_id, booking_id, attendance_decision_id,
    entry_kind, minutes_delta, performed_at, actor_auth_user_id,
    reverses_entry_id, correction_reason, idempotency_key
  ) values (
    v_reversal_id, p_tenant_id, v_obligation.id, v_obligation.season_id,
    p_booking_id, v_decision_id, 'reversal', -v_previous_ledger.minutes_delta,
    v_previous_ledger.performed_at, v_actor, v_previous_ledger.id,
    btrim(p_correction_reason), gen_random_uuid()
  );

  insert into app.hour_ledger_entries (
    id, tenant_id, obligation_id, season_id, booking_id, attendance_decision_id,
    entry_kind, minutes_delta, performed_at, actor_auth_user_id,
    correction_reason, idempotency_key
  ) values (
    v_replacement_id, p_tenant_id, v_obligation.id, v_obligation.season_id,
    p_booking_id, v_decision_id, 'replacement', v_awarded,
    v_previous_ledger.performed_at, v_actor,
    btrim(p_correction_reason), gen_random_uuid()
  );

  update app.bookings as booking
  set current_attendance_decision_id = v_decision_id,
      state = case when p_result = 'no_show' then 'no_show' else 'confirmed' end,
      updated_at = statement_timestamp(), version = booking.version + 1
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id
  returning booking.version into v_new_booking_version;

  update app.obligations as obligation
  set ledger_revision = obligation.ledger_revision + 1,
      updated_at = statement_timestamp(), version = obligation.version + 1
  where obligation.tenant_id = p_tenant_id and obligation.id = v_obligation.id;

  insert into app.booking_events (
    tenant_id, booking_id, event_type, actor_auth_user_id, reason_code, payload
  ) values (
    p_tenant_id, p_booking_id, 'attendance.corrected', v_actor,
    'administrative_correction',
    jsonb_build_object(
      'previous_decision_id', v_previous_decision.id,
      'decision_id', v_decision_id,
      'awarded_minutes', v_awarded
    )
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'attendance.corrected', 'booking', p_booking_id,
    'committee', v_shift.committee_id, 'administrative_correction', p_idempotency_key,
    jsonb_build_object(
      'decision_id', v_decision_id,
      'reversal_entry_id', v_reversal_id,
      'replacement_entry_id', v_replacement_id
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'booking', p_booking_id, v_new_booking_version,
    'attendance.corrected', jsonb_build_object('awarded_minutes', v_awarded)
  );

  v_result := jsonb_build_object(
    'resource_id', p_booking_id,
    'version', v_new_booking_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'attendance_decision_id', v_decision_id,
      'reversal_entry_id', v_reversal_id,
      'replacement_entry_id', v_replacement_id,
      'awarded_minutes', v_awarded
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, p_booking_id, v_new_booking_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.correct_attendance_award(uuid, uuid, bigint, text, integer, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.correct_attendance_award(uuid, uuid, bigint, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function internal.correct_attendance_award(uuid, uuid, bigint, text, integer, text, uuid)
  to authenticated;

create or replace function api.correct_attendance_award(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_expected_booking_version bigint,
  p_result text,
  p_awarded_minutes integer,
  p_correction_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.correct_attendance_award(
    p_tenant_id, p_booking_id, p_expected_booking_version,
    p_result, p_awarded_minutes, p_correction_reason, p_idempotency_key
  );
$function$;

revoke execute on function api.correct_attendance_award(uuid, uuid, bigint, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function api.correct_attendance_award(uuid, uuid, bigint, text, integer, text, uuid)
  to authenticated;

-- Exception details stay dossier-restricted, while this reduced aggregate lets
-- every authorized progress reader see that a definitive winter calculation is
-- blocked.  The function repeats its own authorization check because the
-- internal schema is callable by authenticated sessions, although not exposed
-- through the Data API.
create or replace function internal.open_obligation_blocker_count(
  p_tenant_id uuid,
  p_obligation_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when internal.can_access_obligation_progress(p_tenant_id, p_obligation_id)
      or internal.has_permission(
        p_tenant_id, 'obligation.review', 'tenant', p_tenant_id
      )
      or internal.has_permission(
        p_tenant_id, 'exception.review', 'tenant', p_tenant_id
      )
      or internal.has_permission(
        p_tenant_id, 'exception.finalize', 'tenant', p_tenant_id
      )
    then
      (
        select count(*)::integer
        from app.hour_disputes as dispute
        where dispute.tenant_id = p_tenant_id
          and dispute.obligation_id = p_obligation_id
          and dispute.state in ('open', 'in_review')
      )
      +
      (
        select count(*)::integer
        from app.exception_cases as exception_case
        where exception_case.tenant_id = p_tenant_id
          and exception_case.obligation_id = p_obligation_id
          and exception_case.state in ('submitted', 'in_review', 'escalated')
      )
    else null
  end;
$function$;

alter function internal.open_obligation_blocker_count(uuid, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.open_obligation_blocker_count(uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.open_obligation_blocker_count(uuid, uuid)
  to authenticated, cluvo_command_owner;

create view api.my_obligation_status
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
  on coverage.tenant_id = obligation.tenant_id and coverage.obligation_id = obligation.id
where (select internal.can_access_obligation_progress(obligation.tenant_id, obligation.id));

comment on view api.my_obligation_status is
  'Canonical minute projection: structural coverage is separate from the append-only confirmed ledger.';
revoke all on api.my_obligation_status from public, anon, authenticated, service_role;
grant select on api.my_obligation_status to authenticated;

create or replace function internal.create_winter_review(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_expected_obligation_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_obligation app.obligations%rowtype;
  v_season app.seasons%rowtype;
  v_review_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_confirmed bigint;
  v_before bigint;
  v_pending integer;
  v_disputed integer;
  v_covered boolean;
  v_remaining integer;
  v_deficit integer;
  v_allocatable integer;
  v_state text;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'obligation.review', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_obligation_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'create_winter_review',
    p_idempotency_key,
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'expected_obligation_version', p_expected_obligation_version
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = p_obligation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_obligation.version <> p_expected_obligation_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  select * into v_season
  from app.seasons
  where tenant_id = p_tenant_id and id = v_obligation.season_id;

  select
    coalesce(sum(minutes_delta), 0),
    coalesce(sum(minutes_delta) filter (where performed_at < v_season.winter_cutoff_at), 0)
  into v_confirmed, v_before
  from app.hour_ledger_entries
  where tenant_id = p_tenant_id and obligation_id = p_obligation_id;

  select count(*)::integer into v_pending
  from app.bookings
  where tenant_id = p_tenant_id
    and obligation_id = p_obligation_id
    and state = 'performed_pending'
    and starts_at_snapshot < v_season.winter_cutoff_at;

  select (
    (select count(*)::integer
     from app.hour_disputes
     where tenant_id = p_tenant_id
       and obligation_id = p_obligation_id
       and state in ('open', 'in_review'))
    +
    (select count(*)::integer
     from app.exception_cases
     where tenant_id = p_tenant_id
       and obligation_id = p_obligation_id
       and state in ('submitted', 'in_review', 'escalated'))
  ) into v_disputed;

  select coalesce(bool_or(
    latest.effect = 'household_exempt'
    and latest.starts_on <= (statement_timestamp() at time zone tenant.timezone)::date
    and (latest.ends_on is null
      or latest.ends_on >= (statement_timestamp() at time zone tenant.timezone)::date)
  ), false)
  into v_covered
  from (
    select distinct on (decision.appointment_id)
      decision.appointment_id, decision.effect, decision.starts_on, decision.ends_on
    from app.obligation_coverage_decisions as decision
    where decision.tenant_id = p_tenant_id
      and decision.obligation_id = p_obligation_id
      and decision.source_kind = 'volunteer_appointment'
    order by decision.appointment_id, decision.decision_revision desc
  ) as latest
  cross join app.tenants as tenant
  where tenant.id = p_tenant_id;

  v_remaining := case when v_covered then 0
    else greatest(0, v_obligation.effective_target_minutes - v_confirmed)::integer end;
  v_deficit := case when v_covered then 0
    else greatest(0, v_obligation.effective_winter_minutes - v_before)::integer end;
  v_allocatable := least(v_remaining, v_deficit);
  v_state := case
    when v_pending > 0 or v_disputed > 0 then 'needs_review'
    when v_allocatable = 0 then 'closed'
    else 'open'
  end;

  insert into app.winter_reviews (
    id, tenant_id, obligation_id, cutoff_at, ledger_revision,
    confirmed_minutes_before, pending_count, disputed_count,
    annual_remaining_minutes, winter_deficit_minutes, allocatable_minutes,
    state, created_by_auth_user_id
  ) values (
    v_review_id, p_tenant_id, p_obligation_id, v_season.winter_cutoff_at,
    v_obligation.ledger_revision, greatest(0, v_before)::integer,
    v_pending, v_disputed, v_remaining, v_deficit, v_allocatable,
    v_state, v_actor
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'winter_review.created', 'winter_review', v_review_id,
    'household', v_obligation.assessed_household_id,
    case when v_state = 'needs_review' then 'pending_work_first' else 'winter_check' end,
    p_idempotency_key,
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'ledger_revision', v_obligation.ledger_revision,
      'allocatable_minutes', v_allocatable
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'winter_review', v_review_id, 1,
    'winter_review.created',
    jsonb_build_object('obligation_id', p_obligation_id, 'state', v_state)
  );

  v_result := jsonb_build_object(
    'resource_id', v_review_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'state', v_state,
      'confirmed_before_winter_minutes', greatest(0, v_before),
      'pending_count', v_pending,
      'disputed_count', v_disputed,
      'annual_remaining_minutes', v_remaining,
      'winter_deficit_minutes', v_deficit,
      'allocatable_minutes', v_allocatable
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_review_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.create_winter_review(uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.create_winter_review(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.create_winter_review(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function api.create_winter_review(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_expected_obligation_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.create_winter_review(
    p_tenant_id, p_obligation_id, p_expected_obligation_version, p_idempotency_key
  );
$function$;

revoke execute on function api.create_winter_review(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.create_winter_review(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.allocate_winter_booking(
  p_tenant_id uuid,
  p_review_id uuid,
  p_booking_id uuid,
  p_allocated_minutes integer,
  p_expected_review_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_review app.winter_reviews%rowtype;
  v_booking app.bookings%rowtype;
  v_allocation_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_already integer;
  v_total integer;
  v_new_review_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'obligation.review', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_allocated_minutes is null or p_allocated_minutes <= 0
    or p_expected_review_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'allocate_winter_booking',
    p_idempotency_key,
    jsonb_build_object(
      'review_id', p_review_id,
      'booking_id', p_booking_id,
      'allocated_minutes', p_allocated_minutes,
      'expected_review_version', p_expected_review_version
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_review
  from app.winter_reviews
  where tenant_id = p_tenant_id and id = p_review_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_review.version <> p_expected_review_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_review.state <> 'open' or v_review.pending_count > 0 or v_review.disputed_count > 0 then
    raise exception using errcode = 'P0001', message = 'REVIEW_REQUIRED';
  end if;

  select * into v_booking
  from app.bookings
  where tenant_id = p_tenant_id and id = p_booking_id
  for update;
  if not found
    or v_booking.obligation_id <> v_review.obligation_id
    or v_booking.starts_at_snapshot < v_review.cutoff_at
    or v_booking.state not in (
      'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
    )
    or p_allocated_minutes > v_booking.credit_minutes_snapshot then
    raise exception using errcode = '42501', message = 'BOOKING_NOT_ALLOCATABLE';
  end if;

  select coalesce(sum(allocated_minutes), 0)::integer into v_already
  from app.winter_allocations
  where tenant_id = p_tenant_id and review_id = p_review_id
    and state in ('active', 'completed');
  v_total := v_already + p_allocated_minutes;
  if v_total > v_review.allocatable_minutes then
    raise exception using errcode = '23514', message = 'WINTER_ALLOCATION_EXCEEDS_DEFICIT';
  end if;

  insert into app.winter_allocations (
    id, tenant_id, review_id, obligation_id, booking_id,
    allocated_minutes, allocated_by_auth_user_id, idempotency_key
  ) values (
    v_allocation_id, p_tenant_id, p_review_id, v_review.obligation_id,
    p_booking_id, p_allocated_minutes, v_actor, p_idempotency_key
  );

  update app.winter_reviews as review
  set state = case when v_total = review.allocatable_minutes then 'allocated' else 'open' end,
      updated_at = statement_timestamp(), version = review.version + 1
  where review.tenant_id = p_tenant_id and review.id = p_review_id
  returning review.version into v_new_review_version;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'winter_allocation.created',
    'winter_allocation', v_allocation_id,
    'household', (
      select assessed_household_id from app.obligations
      where tenant_id = p_tenant_id and id = v_review.obligation_id
    ),
    'winter_deficit', p_idempotency_key,
    jsonb_build_object('booking_id', p_booking_id, 'allocated_minutes', p_allocated_minutes)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'winter_review', p_review_id, v_new_review_version,
    'winter_allocation.created',
    jsonb_build_object('allocation_id', v_allocation_id, 'booking_id', p_booking_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_allocation_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'review_id', p_review_id,
      'review_version', v_new_review_version,
      'allocated_minutes', p_allocated_minutes,
      'total_allocated_minutes', v_total
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_allocation_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.allocate_winter_booking(uuid, uuid, uuid, integer, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.allocate_winter_booking(uuid, uuid, uuid, integer, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.allocate_winter_booking(uuid, uuid, uuid, integer, bigint, uuid)
  to authenticated;

create or replace function api.allocate_winter_booking(
  p_tenant_id uuid,
  p_review_id uuid,
  p_booking_id uuid,
  p_allocated_minutes integer,
  p_expected_review_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.allocate_winter_booking(
    p_tenant_id, p_review_id, p_booking_id, p_allocated_minutes,
    p_expected_review_version, p_idempotency_key
  );
$function$;

revoke execute on function api.allocate_winter_booking(uuid, uuid, uuid, integer, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.allocate_winter_booking(uuid, uuid, uuid, integer, bigint, uuid)
  to authenticated;

create or replace function internal.cancel_booking(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_expected_booking_version bigint,
  p_reason_kind text,
  p_description text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_booking app.bookings%rowtype;
  v_now timestamptz := statement_timestamp();
  v_late boolean;
  v_outcome text;
  v_cancellation_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_booking_version is null
    or p_reason_kind not in ('regular', 'sickness', 'emergency') then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'cancel_booking',
    p_idempotency_key,
    jsonb_build_object(
      'booking_id', p_booking_id,
      'expected_booking_version', p_expected_booking_version,
      'reason_kind', p_reason_kind,
      'description', nullif(btrim(p_description), '')
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select booking.* into v_booking
  from app.bookings as booking
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  perform 1
  from app.shift_positions as position
  where position.tenant_id = p_tenant_id and position.id = v_booking.position_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  select booking.* into v_booking
  from app.bookings as booking
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id
  for update;

  if v_booking.version <> p_expected_booking_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_booking.state not in (
    'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
  ) then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_CANCELLABLE';
  end if;
  if not internal.is_self_person(p_tenant_id, v_booking.executor_person_id)
    and not (
      internal.can_book_executor(
        p_tenant_id, v_booking.executor_person_id, v_booking.obligation_id
      )
      and internal.has_permission(
        p_tenant_id,
        'shift.book',
        'household',
        (
          select obligation.assessed_household_id
          from app.obligations as obligation
          where obligation.tenant_id = p_tenant_id
            and obligation.id = v_booking.obligation_id
        )
      )
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_late := v_now >= v_booking.cancellation_deadline_snapshot;
  v_outcome := case p_reason_kind
    when 'sickness' then 'sickness_reported'
    when 'emergency' then 'emergency_reported'
    when 'regular' then case when v_late then 'late_cancelled' else 'timely_cancelled' end
  end;

  insert into app.booking_cancellations (
    id, tenant_id, booking_id, reason_kind, outcome, requested_at,
    cancellation_deadline_snapshot, was_late, actor_auth_user_id,
    represented_person_id, description, idempotency_key
  ) values (
    v_cancellation_id, p_tenant_id, p_booking_id, p_reason_kind, v_outcome, v_now,
    v_booking.cancellation_deadline_snapshot, v_late, v_actor,
    case when internal.is_self_person(p_tenant_id, v_booking.executor_person_id)
      then null else v_booking.executor_person_id end,
    nullif(btrim(p_description), ''), p_idempotency_key
  );

  update app.bookings as booking
  set state = 'cancelled', updated_at = v_now, version = booking.version + 1
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id
  returning booking.version into v_new_version;

  update app.transfer_requests as transfer_request
  set state = 'withdrawn', updated_at = v_now,
      version = transfer_request.version + 1
  where transfer_request.tenant_id = p_tenant_id
    and transfer_request.origin_booking_id = p_booking_id
    and transfer_request.state = 'open';

  with reopened as (
    update app.winter_allocations as allocation
    set state = 'reopened', updated_at = v_now,
        version = allocation.version + 1
    where allocation.tenant_id = p_tenant_id
      and allocation.booking_id = p_booking_id
      and allocation.state = 'active'
    returning allocation.review_id
  )
  update app.winter_reviews as review
  set state = 'open', updated_at = v_now, version = review.version + 1
  where review.tenant_id = p_tenant_id
    and review.id in (select reopened.review_id from reopened)
    and review.state = 'allocated';

  insert into app.booking_events (
    tenant_id, booking_id, event_type, actor_auth_user_id,
    represented_person_id, reason_code, payload
  ) values (
    p_tenant_id, p_booking_id, 'booking.cancelled', v_actor,
    case when internal.is_self_person(p_tenant_id, v_booking.executor_person_id)
      then null else v_booking.executor_person_id end,
    p_reason_kind,
    jsonb_build_object(
      'outcome', v_outcome,
      'was_late', v_late,
      'cancellation_deadline_snapshot', v_booking.cancellation_deadline_snapshot
    )
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, reason_code,
    idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor,
    case when internal.is_self_person(p_tenant_id, v_booking.executor_person_id)
      then null else v_booking.executor_person_id end,
    'booking.cancelled', 'booking', p_booking_id,
    'household', (
      select assessed_household_id from app.obligations
      where tenant_id = p_tenant_id and id = v_booking.obligation_id
    ),
    p_reason_kind, p_idempotency_key,
    jsonb_build_object('outcome', v_outcome, 'was_late', v_late)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'booking', p_booking_id, v_new_version,
    'booking.cancelled', jsonb_build_object('outcome', v_outcome)
  );

  v_result := jsonb_build_object(
    'resource_id', p_booking_id,
    'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'cancellation_id', v_cancellation_id,
      'state', 'cancelled',
      'outcome', v_outcome,
      'was_late', v_late,
      'deadline_snapshot', v_booking.cancellation_deadline_snapshot
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, p_booking_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.cancel_booking(uuid, uuid, bigint, text, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.cancel_booking(uuid, uuid, bigint, text, text, uuid)
  from public, anon, service_role;
grant execute on function internal.cancel_booking(uuid, uuid, bigint, text, text, uuid)
  to authenticated;

create or replace function api.cancel_booking(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_expected_booking_version bigint,
  p_reason_kind text,
  p_description text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.cancel_booking(
    p_tenant_id, p_booking_id, p_expected_booking_version,
    p_reason_kind, p_description, p_idempotency_key
  );
$function$;

revoke execute on function api.cancel_booking(uuid, uuid, bigint, text, text, uuid)
  from public, anon, service_role;
grant execute on function api.cancel_booking(uuid, uuid, bigint, text, text, uuid)
  to authenticated;

create or replace function internal.request_booking_transfer(
  p_tenant_id uuid,
  p_origin_booking_id uuid,
  p_expected_booking_version bigint,
  p_replacement_person_id uuid,
  p_replacement_obligation_id uuid,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_booking app.bookings%rowtype;
  v_request_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_booking_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_booking_version is null
    or p_expires_at is null or p_expires_at <= statement_timestamp()
    or p_replacement_person_id is null or p_replacement_obligation_id is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'request_booking_transfer',
    p_idempotency_key,
    jsonb_build_object(
      'origin_booking_id', p_origin_booking_id,
      'expected_booking_version', p_expected_booking_version,
      'replacement_person_id', p_replacement_person_id,
      'replacement_obligation_id', p_replacement_obligation_id,
      'expires_at', p_expires_at
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_booking
  from app.bookings
  where tenant_id = p_tenant_id and id = p_origin_booking_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_booking.version <> p_expected_booking_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_booking.state not in ('booked', 'reconfirmation_required') then
    raise exception using errcode = 'P0001', message = 'BOOKING_NOT_TRANSFERABLE';
  end if;
  if v_booking.executor_person_id = p_replacement_person_id then
    raise exception using errcode = '22023', message = 'REPLACEMENT_MUST_DIFFER';
  end if;
  if not internal.is_self_person(p_tenant_id, v_booking.executor_person_id)
    and not (
      internal.can_book_executor(
        p_tenant_id, v_booking.executor_person_id, v_booking.obligation_id
      )
      and internal.has_permission(
        p_tenant_id,
        'shift.book',
        'household',
        (
          select obligation.assessed_household_id
          from app.obligations as obligation
          where obligation.tenant_id = p_tenant_id
            and obligation.id = v_booking.obligation_id
        )
      )
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update app.bookings as booking
  set state = 'transfer_pending', updated_at = statement_timestamp(),
      version = booking.version + 1
  where booking.tenant_id = p_tenant_id and booking.id = p_origin_booking_id
  returning booking.version into v_booking_version;

  insert into app.transfer_requests (
    id, tenant_id, origin_booking_id, replacement_person_id,
    replacement_obligation_id, mode, origin_version_snapshot,
    expires_at, requested_by_auth_user_id, idempotency_key
  ) values (
    v_request_id, p_tenant_id, p_origin_booking_id, p_replacement_person_id,
    p_replacement_obligation_id, 'takeover', v_booking_version,
    p_expires_at, v_actor, p_idempotency_key
  );

  insert into app.booking_events (
    tenant_id, booking_id, event_type, actor_auth_user_id, reason_code, payload
  ) values (
    p_tenant_id, p_origin_booking_id, 'booking.transfer_requested', v_actor,
    'takeover', jsonb_build_object('transfer_request_id', v_request_id)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'booking', p_origin_booking_id, v_booking_version,
    'booking.transfer_requested', jsonb_build_object('transfer_request_id', v_request_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_request_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'origin_booking_id', p_origin_booking_id,
      'origin_booking_version', v_booking_version,
      'state', 'open'
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_request_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.request_booking_transfer(uuid, uuid, bigint, uuid, uuid, timestamptz, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.request_booking_transfer(uuid, uuid, bigint, uuid, uuid, timestamptz, uuid)
  from public, anon, service_role;
grant execute on function internal.request_booking_transfer(uuid, uuid, bigint, uuid, uuid, timestamptz, uuid)
  to authenticated;

create or replace function api.request_booking_transfer(
  p_tenant_id uuid,
  p_origin_booking_id uuid,
  p_expected_booking_version bigint,
  p_replacement_person_id uuid,
  p_replacement_obligation_id uuid,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.request_booking_transfer(
    p_tenant_id, p_origin_booking_id, p_expected_booking_version,
    p_replacement_person_id, p_replacement_obligation_id,
    p_expires_at, p_idempotency_key
  );
$function$;

revoke execute on function api.request_booking_transfer(uuid, uuid, bigint, uuid, uuid, timestamptz, uuid)
  from public, anon, service_role;
grant execute on function api.request_booking_transfer(uuid, uuid, bigint, uuid, uuid, timestamptz, uuid)
  to authenticated;

create or replace function internal.accept_booking_transfer(
  p_tenant_id uuid,
  p_transfer_request_id uuid,
  p_expected_request_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_request app.transfer_requests%rowtype;
  v_origin app.bookings%rowtype;
  v_position app.shift_positions%rowtype;
  v_shift app.shifts%rowtype;
  v_new_booking_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_new_request_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_request_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'accept_booking_transfer',
    p_idempotency_key,
    jsonb_build_object(
      'transfer_request_id', p_transfer_request_id,
      'expected_request_version', p_expected_request_version
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_request
  from app.transfer_requests
  where tenant_id = p_tenant_id and id = p_transfer_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  perform 1 from app.persons
  where tenant_id = p_tenant_id and id = v_request.replacement_person_id
  for update;
  perform 1 from app.obligations
  where tenant_id = p_tenant_id and id = v_request.replacement_obligation_id
  for update;

  select * into v_request
  from app.transfer_requests
  where tenant_id = p_tenant_id and id = p_transfer_request_id
  for update;
  select * into v_origin
  from app.bookings
  where tenant_id = p_tenant_id and id = v_request.origin_booking_id
  for update;
  select * into v_position
  from app.shift_positions
  where tenant_id = p_tenant_id and id = v_origin.position_id
  for update;
  select shift_row.* into v_shift
  from app.shifts as shift_row
  where shift_row.tenant_id = p_tenant_id and shift_row.id = v_position.shift_id
  for update;

  if v_request.version <> p_expected_request_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_request.state <> 'open' or v_request.mode <> 'takeover'
    or v_request.expires_at <= statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'TRANSFER_NOT_OPEN';
  end if;
  if v_origin.state <> 'transfer_pending'
    or v_origin.version <> v_request.origin_version_snapshot then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if not internal.can_book_executor(
    p_tenant_id,
    v_request.replacement_person_id,
    v_request.replacement_obligation_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  perform internal.assert_booking_eligibility(
    p_tenant_id, v_shift.id, v_request.replacement_person_id,
    v_request.replacement_obligation_id, null
  );

  update app.bookings as booking
  set state = 'transferred', updated_at = statement_timestamp(),
      version = booking.version + 1
  where booking.tenant_id = p_tenant_id and booking.id = v_origin.id;

  insert into app.bookings (
    id, tenant_id, position_id, executor_person_id, obligation_id, state,
    booked_by_auth_user_id, starts_at_snapshot, ends_at_snapshot,
    credit_minutes_snapshot, cancellation_deadline_snapshot,
    task_version_snapshot, idempotency_key
  ) values (
    v_new_booking_id, p_tenant_id, v_origin.position_id,
    v_request.replacement_person_id, v_request.replacement_obligation_id, 'booked',
    v_actor, v_shift.starts_at, v_shift.ends_at, v_shift.credit_minutes,
    v_shift.starts_at - make_interval(mins => v_shift.cancellation_minutes),
    v_shift.type_version_id, p_idempotency_key
  );

  update app.transfer_requests as transfer_request
  set state = 'accepted', accepted_by_auth_user_id = v_actor,
      accepted_booking_id = v_new_booking_id,
      updated_at = statement_timestamp(), version = transfer_request.version + 1
  where transfer_request.tenant_id = p_tenant_id
    and transfer_request.id = p_transfer_request_id
  returning transfer_request.version into v_new_request_version;

  update app.winter_allocations as allocation
  set booking_id = v_new_booking_id, updated_at = statement_timestamp(),
      version = allocation.version + 1
  where allocation.tenant_id = p_tenant_id
    and allocation.booking_id = v_origin.id
    and allocation.obligation_id = v_request.replacement_obligation_id
    and allocation.state = 'active';

  with reopened as (
    update app.winter_allocations as allocation
    set state = 'reopened', updated_at = statement_timestamp(),
        version = allocation.version + 1
    where allocation.tenant_id = p_tenant_id
      and allocation.booking_id = v_origin.id
      and allocation.obligation_id <> v_request.replacement_obligation_id
      and allocation.state = 'active'
    returning allocation.review_id
  )
  update app.winter_reviews as review
  set state = 'open', updated_at = statement_timestamp(), version = review.version + 1
  where review.tenant_id = p_tenant_id
    and review.id in (select reopened.review_id from reopened)
    and review.state = 'allocated';

  insert into app.booking_events (
    tenant_id, booking_id, event_type, actor_auth_user_id, reason_code, payload
  ) values
    (
      p_tenant_id, v_origin.id, 'booking.transferred', v_actor, 'takeover',
      jsonb_build_object('replacement_booking_id', v_new_booking_id)
    ),
    (
      p_tenant_id, v_new_booking_id, 'booking.created_by_transfer', v_actor, 'takeover',
      jsonb_build_object('origin_booking_id', v_origin.id)
    );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'booking.transfer_accepted',
    'transfer_request', p_transfer_request_id,
    'committee', v_shift.committee_id, 'takeover', p_idempotency_key,
    jsonb_build_object(
      'origin_booking_id', v_origin.id,
      'replacement_booking_id', v_new_booking_id
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'transfer_request', p_transfer_request_id,
    v_new_request_version, 'booking.transfer_accepted',
    jsonb_build_object(
      'origin_booking_id', v_origin.id,
      'replacement_booking_id', v_new_booking_id
    )
  );

  v_result := jsonb_build_object(
    'resource_id', v_new_booking_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'transfer_request_id', p_transfer_request_id,
      'transfer_request_version', v_new_request_version,
      'origin_booking_id', v_origin.id,
      'state', 'booked'
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_new_booking_id, 1::bigint, array[v_event_id], v_result -> 'result';
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'CAPACITY_FULL';
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'PERSON_OVERLAP';
end;
$function$;

alter function internal.accept_booking_transfer(uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.accept_booking_transfer(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.accept_booking_transfer(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function api.accept_booking_transfer(
  p_tenant_id uuid,
  p_transfer_request_id uuid,
  p_expected_request_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.accept_booking_transfer(
    p_tenant_id, p_transfer_request_id, p_expected_request_version, p_idempotency_key
  );
$function$;

revoke execute on function api.accept_booking_transfer(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.accept_booking_transfer(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.join_shift_waitlist(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_person_id uuid,
  p_obligation_id uuid,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_entry_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'join_shift_waitlist',
    p_idempotency_key,
    jsonb_build_object(
      'shift_id', p_shift_id,
      'person_id', p_person_id,
      'obligation_id', p_obligation_id
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  perform internal.assert_booking_eligibility(
    p_tenant_id, p_shift_id, p_person_id, p_obligation_id, null
  );
  if exists (
    select 1
    from app.bookings as booking
    join app.shift_positions as position
      on position.tenant_id = booking.tenant_id and position.id = booking.position_id
    where booking.tenant_id = p_tenant_id
      and position.shift_id = p_shift_id
      and booking.executor_person_id = p_person_id
      and booking.state in (
        'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
      )
  ) then
    raise exception using errcode = '23505', message = 'ALREADY_BOOKED';
  end if;

  insert into app.waitlist_entries (
    id, tenant_id, shift_id, person_id, obligation_id, idempotency_key
  ) values (
    v_entry_id, p_tenant_id, p_shift_id, p_person_id, p_obligation_id, p_idempotency_key
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'waitlist_entry', v_entry_id, 1,
    'waitlist.joined', jsonb_build_object('shift_id', p_shift_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_entry_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('state', 'waiting', 'shift_id', p_shift_id)
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_entry_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.join_shift_waitlist(uuid, uuid, uuid, uuid, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.join_shift_waitlist(uuid, uuid, uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.join_shift_waitlist(uuid, uuid, uuid, uuid, uuid)
  to authenticated;

create or replace function api.join_shift_waitlist(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_person_id uuid,
  p_obligation_id uuid,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.join_shift_waitlist(
    p_tenant_id, p_shift_id, p_person_id, p_obligation_id, p_idempotency_key
  );
$function$;

revoke execute on function api.join_shift_waitlist(uuid, uuid, uuid, uuid, uuid)
  from public, anon, service_role;
grant execute on function api.join_shift_waitlist(uuid, uuid, uuid, uuid, uuid)
  to authenticated;

create or replace function internal.offer_next_waitlist_candidate(
  p_tenant_id uuid,
  p_position_id uuid,
  p_expected_position_version bigint,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_position app.shift_positions%rowtype;
  v_shift app.shifts%rowtype;
  v_entry app.waitlist_entries%rowtype;
  v_expired_entry_id uuid;
  v_offer_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_position_version bigint;
  v_entry_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_position_version is null
    or p_expires_at is null or p_expires_at <= statement_timestamp() then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'offer_next_waitlist_candidate',
    p_idempotency_key,
    jsonb_build_object(
      'position_id', p_position_id,
      'expected_position_version', p_expected_position_version,
      'expires_at', p_expires_at
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_position
  from app.shift_positions
  where tenant_id = p_tenant_id and id = p_position_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  select * into v_shift
  from app.shifts
  where tenant_id = p_tenant_id and id = v_position.shift_id;

  if not internal.has_permission(
    p_tenant_id, 'waitlist.manage', 'committee', v_shift.committee_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_position.version <> p_expected_position_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;

  select offer.entry_id into v_expired_entry_id
  from app.waitlist_offers as offer
  where offer.tenant_id = p_tenant_id
    and offer.position_id = p_position_id
    and offer.state = 'active'
    and offer.expires_at <= statement_timestamp()
  for update;
  if v_expired_entry_id is not null then
    update app.waitlist_offers as offer
    set state = 'expired', updated_at = statement_timestamp(),
        version = offer.version + 1
    where offer.tenant_id = p_tenant_id
      and offer.position_id = p_position_id
      and offer.state = 'active';
    update app.waitlist_entries as entry
    set state = 'skipped', updated_at = statement_timestamp(),
        version = entry.version + 1
    where entry.tenant_id = p_tenant_id
      and entry.id = v_expired_entry_id
      and entry.state = 'offered';
    update app.shift_positions as position
    set state = 'open', updated_at = statement_timestamp(),
        version = position.version + 1
    where position.tenant_id = p_tenant_id and position.id = p_position_id;
    select * into v_position
    from app.shift_positions
    where tenant_id = p_tenant_id and id = p_position_id;
  end if;

  if v_position.state <> 'open'
    or exists (
      select 1 from app.bookings
      where tenant_id = p_tenant_id and position_id = p_position_id
        and state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending')
    )
    or exists (
      select 1 from app.waitlist_offers
      where tenant_id = p_tenant_id and position_id = p_position_id and state = 'active'
    ) then
    raise exception using errcode = 'P0001', message = 'POSITION_NOT_AVAILABLE';
  end if;

  select entry.* into v_entry
  from app.waitlist_entries as entry
  where entry.tenant_id = p_tenant_id
    and entry.shift_id = v_shift.id
    and entry.state = 'waiting'
  order by entry.joined_at, entry.id
  for update skip locked
  limit 1;
  if not found then
    raise exception using errcode = 'P0002', message = 'WAITLIST_EMPTY';
  end if;

  update app.waitlist_entries as entry
  set state = 'offered', updated_at = statement_timestamp(),
      version = entry.version + 1
  where entry.tenant_id = p_tenant_id and entry.id = v_entry.id
  returning entry.version into v_entry_version;
  update app.shift_positions as position
  set state = 'held', updated_at = statement_timestamp(),
      version = position.version + 1
  where position.tenant_id = p_tenant_id and position.id = p_position_id
  returning position.version into v_position_version;

  insert into app.waitlist_offers (
    id, tenant_id, entry_id, position_id, expires_at
  ) values (
    v_offer_id, p_tenant_id, v_entry.id, p_position_id, p_expires_at
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'waitlist_entry', v_entry.id, v_entry_version,
    'waitlist.offer_created',
    jsonb_build_object('offer_id', v_offer_id, 'position_id', p_position_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_offer_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'entry_id', v_entry.id,
      'position_id', p_position_id,
      'position_version', v_position_version,
      'expires_at', p_expires_at,
      'state', 'active'
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_offer_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.offer_next_waitlist_candidate(uuid, uuid, bigint, timestamptz, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.offer_next_waitlist_candidate(uuid, uuid, bigint, timestamptz, uuid)
  from public, anon, service_role;
grant execute on function internal.offer_next_waitlist_candidate(uuid, uuid, bigint, timestamptz, uuid)
  to authenticated;

create or replace function api.offer_next_waitlist_candidate(
  p_tenant_id uuid,
  p_position_id uuid,
  p_expected_position_version bigint,
  p_expires_at timestamptz,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.offer_next_waitlist_candidate(
    p_tenant_id, p_position_id, p_expected_position_version,
    p_expires_at, p_idempotency_key
  );
$function$;

revoke execute on function api.offer_next_waitlist_candidate(uuid, uuid, bigint, timestamptz, uuid)
  from public, anon, service_role;
grant execute on function api.offer_next_waitlist_candidate(uuid, uuid, bigint, timestamptz, uuid)
  to authenticated;

create or replace function internal.accept_waitlist_offer(
  p_tenant_id uuid,
  p_offer_id uuid,
  p_expected_offer_version bigint,
  p_expected_shift_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_offer app.waitlist_offers%rowtype;
  v_entry app.waitlist_entries%rowtype;
  v_position app.shift_positions%rowtype;
  v_shift app.shifts%rowtype;
  v_booking_result record;
  v_event_id uuid := gen_random_uuid();
  v_offer_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_offer_version is null or p_expected_shift_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'accept_waitlist_offer',
    p_idempotency_key,
    jsonb_build_object(
      'offer_id', p_offer_id,
      'expected_offer_version', p_expected_offer_version,
      'expected_shift_version', p_expected_shift_version
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_offer
  from app.waitlist_offers
  where tenant_id = p_tenant_id and id = p_offer_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  select * into v_entry
  from app.waitlist_entries
  where tenant_id = p_tenant_id and id = v_offer.entry_id
  for update;
  select * into v_position
  from app.shift_positions
  where tenant_id = p_tenant_id and id = v_offer.position_id
  for update;
  select * into v_shift
  from app.shifts
  where tenant_id = p_tenant_id and id = v_position.shift_id
  for update;

  if v_offer.version <> p_expected_offer_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_offer.state <> 'active' or v_entry.state <> 'offered'
    or v_offer.expires_at <= statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'OFFER_EXPIRED';
  end if;
  if v_position.state <> 'held' or v_entry.shift_id <> v_shift.id then
    raise exception using errcode = '55000', message = 'WAITLIST_HOLD_MISMATCH';
  end if;
  if not internal.is_self_person(p_tenant_id, v_entry.person_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  perform internal.assert_booking_eligibility(
    p_tenant_id, v_shift.id, v_entry.person_id, v_entry.obligation_id, null
  );

  -- Keep the row lock while temporarily exposing the position to the existing
  -- atomic booking command. Competing bookers can proceed only after commit,
  -- when the unique active-position index already sees the new booking.
  update app.shift_positions as position
  set state = 'open', updated_at = statement_timestamp(),
      version = position.version + 1
  where position.tenant_id = p_tenant_id and position.id = v_position.id;

  select * into v_booking_result
  from internal.book_shift(
    p_tenant_id, v_shift.id, v_position.id, v_entry.person_id,
    v_entry.obligation_id, p_expected_shift_version, p_idempotency_key
  );

  update app.waitlist_entries as entry
  set state = 'booked', updated_at = statement_timestamp(),
      version = entry.version + 1
  where entry.tenant_id = p_tenant_id and entry.id = v_entry.id;
  update app.waitlist_offers as offer
  set state = 'accepted', consumed_booking_id = v_booking_result.resource_id,
      accepted_idempotency_key = p_idempotency_key,
      updated_at = statement_timestamp(), version = offer.version + 1
  where offer.tenant_id = p_tenant_id and offer.id = p_offer_id
  returning offer.version into v_offer_version;

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'waitlist_offer', p_offer_id, v_offer_version,
    'waitlist.offer_accepted',
    jsonb_build_object('booking_id', v_booking_result.resource_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_booking_result.resource_id,
    'version', v_booking_result.version,
    'event_ids', to_jsonb(v_booking_result.event_ids) || jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'offer_id', p_offer_id,
      'offer_version', v_offer_version,
      'state', 'booked'
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select
    true,
    v_booking_result.resource_id,
    v_booking_result.version,
    v_booking_result.event_ids || array[v_event_id],
    v_result -> 'result';
end;
$function$;

alter function internal.accept_waitlist_offer(uuid, uuid, bigint, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.accept_waitlist_offer(uuid, uuid, bigint, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.accept_waitlist_offer(uuid, uuid, bigint, bigint, uuid)
  to authenticated;

create or replace function api.accept_waitlist_offer(
  p_tenant_id uuid,
  p_offer_id uuid,
  p_expected_offer_version bigint,
  p_expected_shift_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.accept_waitlist_offer(
    p_tenant_id, p_offer_id, p_expected_offer_version,
    p_expected_shift_version, p_idempotency_key
  );
$function$;

revoke execute on function api.accept_waitlist_offer(uuid, uuid, bigint, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.accept_waitlist_offer(uuid, uuid, bigint, bigint, uuid)
  to authenticated;

create or replace function internal.open_exception_case(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_case_type text,
  p_requested_for_person_id uuid,
  p_proposed_target_minutes integer,
  p_proposed_winter_minutes integer,
  p_valid_from date,
  p_valid_until date,
  p_practical_reason text,
  p_expected_obligation_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_obligation app.obligations%rowtype;
  v_case_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_proposal_hash bytea;
  v_obligation_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_expected_obligation_version is null
    or p_proposed_target_minutes is null or p_proposed_target_minutes < 0
    or p_proposed_winter_minutes is null or p_proposed_winter_minutes < 0
    or p_proposed_winter_minutes > p_proposed_target_minutes
    or p_valid_from is null
    or (p_valid_until is not null and p_valid_until < p_valid_from)
    or nullif(btrim(p_practical_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'open_exception_case',
    p_idempotency_key,
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'case_type', p_case_type,
      'requested_for_person_id', p_requested_for_person_id,
      'proposed_target_minutes', p_proposed_target_minutes,
      'proposed_winter_minutes', p_proposed_winter_minutes,
      'valid_from', p_valid_from,
      'valid_until', p_valid_until,
      'practical_reason', btrim(p_practical_reason),
      'expected_obligation_version', p_expected_obligation_version
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = p_obligation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_obligation.version <> p_expected_obligation_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if not internal.can_access_obligation_progress(p_tenant_id, p_obligation_id)
    and not internal.has_permission(
      p_tenant_id, 'exception.review', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_requested_for_person_id is not null
    and not internal.is_self_person(p_tenant_id, p_requested_for_person_id)
    and not internal.has_permission(
      p_tenant_id, 'exception.review', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_proposal_hash := extensions.digest(
    convert_to(jsonb_build_object(
      'case_type', p_case_type,
      'proposed_target_minutes', p_proposed_target_minutes,
      'proposed_winter_minutes', p_proposed_winter_minutes,
      'valid_from', p_valid_from,
      'valid_until', p_valid_until,
      'practical_reason', btrim(p_practical_reason)
    )::text, 'UTF8'),
    'sha256'
  );

  insert into app.exception_cases (
    id, tenant_id, obligation_id, case_type,
    requested_by_auth_user_id, requested_for_person_id
  ) values (
    v_case_id, p_tenant_id, p_obligation_id, p_case_type,
    v_actor, p_requested_for_person_id
  );
  insert into app.exception_case_revisions (
    id, tenant_id, case_id, revision, proposal_hash, practical_reason,
    proposed_target_minutes, proposed_winter_minutes,
    valid_from, valid_until, created_by_auth_user_id
  ) values (
    v_revision_id, p_tenant_id, v_case_id, 1, v_proposal_hash,
    btrim(p_practical_reason), p_proposed_target_minutes,
    p_proposed_winter_minutes, p_valid_from, p_valid_until, v_actor
  );

  update app.obligations as obligation
  set status = 'review_hold', updated_at = statement_timestamp(),
      version = obligation.version + 1
  where obligation.tenant_id = p_tenant_id and obligation.id = p_obligation_id
  returning obligation.version into v_obligation_version;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, reason_code,
    idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor,
    case when p_requested_for_person_id is not null
      and not internal.is_self_person(p_tenant_id, p_requested_for_person_id)
      then p_requested_for_person_id else null end,
    'exception_case.opened', 'exception_case', v_case_id,
    'household', v_obligation.assessed_household_id, p_case_type,
    p_idempotency_key,
    jsonb_build_object('revision_id', v_revision_id, 'obligation_id', p_obligation_id)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'exception_case', v_case_id, 1,
    'exception_case.opened', jsonb_build_object('revision_id', v_revision_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_case_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'case_revision_id', v_revision_id,
      'obligation_version', v_obligation_version,
      'state', 'submitted'
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_case_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.open_exception_case(
  uuid, uuid, text, uuid, integer, integer, date, date, text, bigint, uuid
) owner to cluvo_command_owner;
revoke execute on function internal.open_exception_case(
  uuid, uuid, text, uuid, integer, integer, date, date, text, bigint, uuid
) from public, anon, service_role;
grant execute on function internal.open_exception_case(
  uuid, uuid, text, uuid, integer, integer, date, date, text, bigint, uuid
) to authenticated;

create or replace function api.open_exception_case(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_case_type text,
  p_requested_for_person_id uuid,
  p_proposed_target_minutes integer,
  p_proposed_winter_minutes integer,
  p_valid_from date,
  p_valid_until date,
  p_practical_reason text,
  p_expected_obligation_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.open_exception_case(
    p_tenant_id, p_obligation_id, p_case_type, p_requested_for_person_id,
    p_proposed_target_minutes, p_proposed_winter_minutes,
    p_valid_from, p_valid_until, p_practical_reason,
    p_expected_obligation_version, p_idempotency_key
  );
$function$;

revoke execute on function api.open_exception_case(
  uuid, uuid, text, uuid, integer, integer, date, date, text, bigint, uuid
) from public, anon, service_role;
grant execute on function api.open_exception_case(
  uuid, uuid, text, uuid, integer, integer, date, date, text, bigint, uuid
) to authenticated;

create or replace function internal.review_exception_case(
  p_tenant_id uuid,
  p_case_revision_id uuid,
  p_expected_case_version bigint,
  p_outcome text,
  p_reason text,
  p_has_conflict boolean,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_reviewer_person uuid;
  v_claim record;
  v_revision app.exception_case_revisions%rowtype;
  v_case app.exception_cases%rowtype;
  v_review_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_case_version bigint;
  v_state text;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'exception.review', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_case_version is null
    or p_outcome not in ('approve', 'reject', 'escalate')
    or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  v_reviewer_person := internal.current_person_id(p_tenant_id);
  if v_reviewer_person is null then
    raise exception using errcode = '42501', message = 'REVIEWER_PERSON_REQUIRED';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'review_exception_case',
    p_idempotency_key,
    jsonb_build_object(
      'case_revision_id', p_case_revision_id,
      'expected_case_version', p_expected_case_version,
      'outcome', p_outcome,
      'reason', btrim(p_reason),
      'has_conflict', coalesce(p_has_conflict, false)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_revision
  from app.exception_case_revisions
  where tenant_id = p_tenant_id and id = p_case_revision_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  select * into v_case
  from app.exception_cases
  where tenant_id = p_tenant_id and id = v_revision.case_id
  for update;
  if v_case.version <> p_expected_case_version
    or v_case.current_revision <> v_revision.revision then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_case.state not in ('submitted', 'in_review', 'escalated') then
    raise exception using errcode = 'P0001', message = 'CASE_NOT_REVIEWABLE';
  end if;

  insert into app.exception_reviews (
    id, tenant_id, case_revision_id, reviewer_auth_user_id,
    reviewer_person_id, outcome, has_conflict, reason
  ) values (
    v_review_id, p_tenant_id, p_case_revision_id, v_actor,
    v_reviewer_person, p_outcome, coalesce(p_has_conflict, false), btrim(p_reason)
  );

  v_state := case
    when coalesce(p_has_conflict, false) or p_outcome = 'escalate' then 'escalated'
    else 'in_review'
  end;
  update app.exception_cases as exception_case
  set state = v_state, updated_at = statement_timestamp(),
      version = exception_case.version + 1
  where exception_case.tenant_id = p_tenant_id and exception_case.id = v_case.id
  returning exception_case.version into v_case_version;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'exception_case.reviewed', 'exception_case', v_case.id,
    'household', (
      select assessed_household_id from app.obligations
      where tenant_id = p_tenant_id and id = v_case.obligation_id
    ),
    p_outcome, p_idempotency_key,
    jsonb_build_object('review_id', v_review_id, 'case_revision_id', p_case_revision_id)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'exception_case', v_case.id, v_case_version,
    'exception_case.reviewed',
    jsonb_build_object('review_id', v_review_id, 'outcome', p_outcome)
  );

  v_result := jsonb_build_object(
    'resource_id', v_review_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'case_id', v_case.id,
      'case_version', v_case_version,
      'case_state', v_state,
      'reviewer_person_id', v_reviewer_person
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_review_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.review_exception_case(uuid, uuid, bigint, text, text, boolean, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.review_exception_case(uuid, uuid, bigint, text, text, boolean, uuid)
  from public, anon, service_role;
grant execute on function internal.review_exception_case(uuid, uuid, bigint, text, text, boolean, uuid)
  to authenticated;

create or replace function api.review_exception_case(
  p_tenant_id uuid,
  p_case_revision_id uuid,
  p_expected_case_version bigint,
  p_outcome text,
  p_reason text,
  p_has_conflict boolean,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.review_exception_case(
    p_tenant_id, p_case_revision_id, p_expected_case_version,
    p_outcome, p_reason, p_has_conflict, p_idempotency_key
  );
$function$;

revoke execute on function api.review_exception_case(uuid, uuid, bigint, text, text, boolean, uuid)
  from public, anon, service_role;
grant execute on function api.review_exception_case(uuid, uuid, bigint, text, text, boolean, uuid)
  to authenticated;

create or replace function internal.finalize_exception_case(
  p_tenant_id uuid,
  p_case_revision_id uuid,
  p_expected_case_version bigint,
  p_outcome text,
  p_financial_route text,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_revision app.exception_case_revisions%rowtype;
  v_case app.exception_cases%rowtype;
  v_obligation app.obligations%rowtype;
  v_decision_id uuid := gen_random_uuid();
  v_coverage_id uuid;
  v_event_id uuid := gen_random_uuid();
  v_case_version bigint;
  v_obligation_version bigint;
  v_obligation_status text;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'exception.finalize', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_case_version is null
    or p_outcome not in ('approved', 'rejected', 'escalated')
    or p_financial_route not in ('none', 'buyout', 'shortage')
    or (p_outcome <> 'approved' and p_financial_route <> 'none')
    or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'finalize_exception_case',
    p_idempotency_key,
    jsonb_build_object(
      'case_revision_id', p_case_revision_id,
      'expected_case_version', p_expected_case_version,
      'outcome', p_outcome,
      'financial_route', p_financial_route,
      'reason', btrim(p_reason)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_revision
  from app.exception_case_revisions
  where tenant_id = p_tenant_id and id = p_case_revision_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  select * into v_case
  from app.exception_cases
  where tenant_id = p_tenant_id and id = v_revision.case_id
  for update;
  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = v_case.obligation_id
  for update;

  if v_case.version <> p_expected_case_version
    or v_case.current_revision <> v_revision.revision then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_case.state not in ('in_review', 'escalated') then
    raise exception using errcode = 'P0001', message = 'CASE_NOT_FINALIZABLE';
  end if;
  if p_financial_route = 'buyout' and v_case.case_type <> 'buyout' then
    raise exception using errcode = '23514', message = 'BUYOUT_CASE_REQUIRED';
  end if;

  insert into app.exception_decisions (
    id, tenant_id, case_revision_id, obligation_id, outcome,
    effective_target_minutes, effective_winter_minutes,
    valid_from, valid_until, financial_route,
    finalized_by_auth_user_id, reason
  ) values (
    v_decision_id, p_tenant_id, p_case_revision_id, v_case.obligation_id, p_outcome,
    case when p_outcome = 'approved' then v_revision.proposed_target_minutes else null end,
    case when p_outcome = 'approved' then v_revision.proposed_winter_minutes else null end,
    case when p_outcome = 'approved' then v_revision.valid_from else null end,
    case when p_outcome = 'approved' then v_revision.valid_until else null end,
    p_financial_route, v_actor, btrim(p_reason)
  );

  update app.exception_cases as exception_case
  set state = case p_outcome
      when 'approved' then 'approved'
      when 'rejected' then 'rejected'
      else 'escalated'
    end,
    updated_at = statement_timestamp(), version = exception_case.version + 1
  where exception_case.tenant_id = p_tenant_id and exception_case.id = v_case.id
  returning exception_case.version into v_case_version;

  select case
    when exists (
      select 1
      from app.appointment_review_cases as appointment_review
      where appointment_review.tenant_id = p_tenant_id
        and appointment_review.obligation_id = v_obligation.id
        and appointment_review.state in ('open', 'escalated')
    ) or exists (
      select 1
      from app.exception_cases as open_case
      where open_case.tenant_id = p_tenant_id
        and open_case.obligation_id = v_obligation.id
        and open_case.state in ('submitted', 'in_review', 'escalated')
    ) then 'review_hold'
    else 'active'
  end
  into v_obligation_status;

  if p_outcome = 'approved' then
    update app.obligations as obligation
    set effective_target_minutes = v_revision.proposed_target_minutes,
        effective_winter_minutes = v_revision.proposed_winter_minutes,
        status = v_obligation_status,
        updated_at = statement_timestamp(), version = obligation.version + 1
    where obligation.tenant_id = p_tenant_id and obligation.id = v_obligation.id
    returning obligation.version into v_obligation_version;

    v_coverage_id := gen_random_uuid();
    insert into app.obligation_coverage_decisions (
      id, tenant_id, obligation_id, household_id, source_kind,
      exception_decision_id, decision_revision, effect,
      effective_target_minutes, effective_winter_minutes,
      starts_on, ends_on, decided_by_auth_user_id, reason
    ) values (
      v_coverage_id, p_tenant_id, v_obligation.id,
      v_obligation.assessed_household_id, 'exception', v_decision_id,
      1, 'target_adjustment', v_revision.proposed_target_minutes,
      v_revision.proposed_winter_minutes, v_revision.valid_from,
      v_revision.valid_until, v_actor, btrim(p_reason)
    );
  else
    update app.obligations as obligation
    set status = v_obligation_status,
        updated_at = statement_timestamp(), version = obligation.version + 1
    where obligation.tenant_id = p_tenant_id and obligation.id = v_obligation.id
    returning obligation.version into v_obligation_version;
  end if;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'exception_case.finalized',
    'exception_decision', v_decision_id,
    'household', v_obligation.assessed_household_id,
    p_outcome, p_idempotency_key,
    jsonb_build_object(
      'case_id', v_case.id,
      'case_revision_id', p_case_revision_id,
      'coverage_decision_id', v_coverage_id,
      'obligation_version', v_obligation_version
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'exception_case', v_case.id, v_case_version,
    'exception_case.finalized',
    jsonb_build_object('decision_id', v_decision_id, 'outcome', p_outcome)
  );

  v_result := jsonb_build_object(
    'resource_id', v_decision_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'case_id', v_case.id,
      'case_version', v_case_version,
      'outcome', p_outcome,
      'obligation_version', v_obligation_version,
      'coverage_decision_id', v_coverage_id
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_decision_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.finalize_exception_case(uuid, uuid, bigint, text, text, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.finalize_exception_case(uuid, uuid, bigint, text, text, text, uuid)
  from public, anon, service_role;
grant execute on function internal.finalize_exception_case(uuid, uuid, bigint, text, text, text, uuid)
  to authenticated;

create or replace function api.finalize_exception_case(
  p_tenant_id uuid,
  p_case_revision_id uuid,
  p_expected_case_version bigint,
  p_outcome text,
  p_financial_route text,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.finalize_exception_case(
    p_tenant_id, p_case_revision_id, p_expected_case_version,
    p_outcome, p_financial_route, p_reason, p_idempotency_key
  );
$function$;

revoke execute on function api.finalize_exception_case(uuid, uuid, bigint, text, text, text, uuid)
  from public, anon, service_role;
grant execute on function api.finalize_exception_case(uuid, uuid, bigint, text, text, text, uuid)
  to authenticated;

-- A16 uses one canonical command for draft form submissions and drag
-- operations. Published shifts must use the A17 preview/hash/apply path so its
-- booking impact and notification outbox cannot be bypassed. A draft move
-- preserves duration and capacity; a draft resize may alter either.
create or replace function internal.manage_planboard_shift(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_action text,
  p_input_mode text,
  p_expected_shift_version bigint,
  p_type_version_id uuid,
  p_committee_id uuid,
  p_category_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_position_count integer,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_shift app.shifts%rowtype;
  v_target_shift_id uuid := coalesce(p_shift_id, gen_random_uuid());
  v_event_id uuid := gen_random_uuid();
  v_event_type text;
  v_credit_minutes integer;
  v_cancellation_minutes integer;
  v_type_category_id uuid;
  v_category_committee_id uuid;
  v_minimum_positions integer;
  v_task_active boolean;
  v_existing_position_count integer := 0;
  v_active_booking_count integer := 0;
  v_reconfirmation_count integer := 0;
  v_overlap_count integer := 0;
  v_schedule_changed boolean := false;
  v_new_version bigint;
  v_position_ids jsonb;
  v_result jsonb;
begin
  if v_actor is null
    or not internal.is_active_member(p_tenant_id)
    or p_action not in ('create', 'move', 'resize')
    or p_input_mode not in ('form', 'drag')
    or p_expected_shift_version is null
    or p_type_version_id is null
    or p_committee_id is null
    or p_category_id is null
    or nullif(btrim(p_title), '') is null
    or p_starts_at is null
    or p_ends_at is null
    or p_ends_at <= p_starts_at
    or p_position_count is null
    or p_position_count < 1
    or p_position_count > 100
    or p_idempotency_key is null
    or (p_action = 'create' and (p_shift_id is not null or p_expected_shift_version <> 0))
    or (p_action <> 'create' and (p_shift_id is null or p_expected_shift_version < 1)) then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  if not internal.has_permission(
    p_tenant_id, 'shift.manage', 'committee', p_committee_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select
    type_version.credit_minutes,
    coalesce(
      type_version.cancellation_minutes_override,
      (
        select settings.cancellation_minutes
        from app.tenant_settings_versions as settings
        where settings.tenant_id = p_tenant_id
          and settings.effective_from <= statement_timestamp()
        order by settings.effective_from desc, settings.revision desc
        limit 1
      ),
      2880
    ),
    task_type.category_id,
    category.committee_id,
    category.minimum_positions,
    task_type.active
  into
    v_credit_minutes,
    v_cancellation_minutes,
    v_type_category_id,
    v_category_committee_id,
    v_minimum_positions,
    v_task_active
  from app.task_type_versions as type_version
  join app.task_types as task_type
    on task_type.tenant_id = type_version.tenant_id
   and task_type.id = type_version.task_type_id
  join app.task_categories as category
    on category.tenant_id = task_type.tenant_id
   and category.id = task_type.category_id
  where type_version.tenant_id = p_tenant_id
    and type_version.id = p_type_version_id;

  if not found
    or not coalesce(v_task_active, false)
    or v_type_category_id <> p_category_id
    or v_category_committee_id <> p_committee_id then
    raise exception using errcode = '22023', message = 'TASK_CONFIGURATION_MISMATCH';
  end if;
  if p_position_count < v_minimum_positions then
    raise exception using errcode = '23514', message = 'MINIMUM_STAFFING';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'manage_planboard_shift',
    p_idempotency_key,
    jsonb_build_object(
      'shift_id', p_shift_id,
      'action', p_action,
      'input_mode', p_input_mode,
      'expected_shift_version', p_expected_shift_version,
      'type_version_id', p_type_version_id,
      'committee_id', p_committee_id,
      'category_id', p_category_id,
      'title', btrim(p_title),
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'position_count', p_position_count
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(
        select value::uuid
        from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')
      ),
      v_claim.replay_result -> 'result';
    return;
  end if;

  if p_action = 'create' then
    insert into app.shifts (
      id, tenant_id, type_version_id, committee_id, category_id, title,
      starts_at, ends_at, credit_minutes, cancellation_minutes, state
    ) values (
      v_target_shift_id, p_tenant_id, p_type_version_id, p_committee_id,
      p_category_id, btrim(p_title), p_starts_at, p_ends_at,
      v_credit_minutes, v_cancellation_minutes, 'draft'
    );

    insert into app.shift_positions (
      tenant_id, shift_id, ordinal, starts_at, ends_at, state
    )
    select
      p_tenant_id, v_target_shift_id, ordinal,
      p_starts_at, p_ends_at, 'open'
    from generate_series(1, p_position_count) as series(ordinal);

    v_new_version := 1;
    v_event_type := 'shift.plan_created';
  else
    select shift_row.* into v_shift
    from app.shifts as shift_row
    where shift_row.tenant_id = p_tenant_id
      and shift_row.id = p_shift_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'NOT_FOUND';
    end if;
    if not internal.has_permission(
      p_tenant_id, 'shift.manage', 'committee', v_shift.committee_id
    ) then
      raise exception using errcode = '42501', message = 'FORBIDDEN';
    end if;
    if v_shift.state = 'published' then
      raise exception using
        errcode = 'P0001',
        message = 'PUBLISHED_SHIFT_REQUIRES_CHANGE_PROPOSAL';
    end if;
    if v_shift.state <> 'draft' then
      raise exception using errcode = 'P0001', message = 'SHIFT_NOT_PLANNABLE';
    end if;
    if v_shift.version <> p_expected_shift_version then
      raise exception using errcode = '40001', message = 'STALE_VERSION';
    end if;
    if v_shift.type_version_id <> p_type_version_id
      or v_shift.committee_id <> p_committee_id
      or v_shift.category_id <> p_category_id
      or v_shift.title <> btrim(p_title) then
      raise exception using errcode = '22023', message = 'SHIFT_IDENTITY_MISMATCH';
    end if;

    perform 1
    from app.shift_positions as position
    where position.tenant_id = p_tenant_id
      and position.shift_id = p_shift_id
    order by position.id
    for update;

    perform 1
    from app.bookings as booking
    join app.shift_positions as position
      on position.tenant_id = booking.tenant_id
     and position.id = booking.position_id
    where booking.tenant_id = p_tenant_id
      and position.shift_id = p_shift_id
    order by booking.id
    for update of booking;

    select count(*)::integer into v_existing_position_count
    from app.shift_positions as position
    where position.tenant_id = p_tenant_id
      and position.shift_id = p_shift_id
      and position.state <> 'cancelled';

    if p_action = 'move' and (
      p_position_count <> v_existing_position_count
      or p_ends_at - p_starts_at <> v_shift.ends_at - v_shift.starts_at
    ) then
      raise exception using errcode = '22023', message = 'MOVE_SHAPE_MISMATCH';
    end if;

    v_schedule_changed := p_starts_at <> v_shift.starts_at
      or p_ends_at <> v_shift.ends_at;

    if v_schedule_changed and v_shift.starts_at <= statement_timestamp() then
      raise exception using errcode = 'P0001', message = 'SHIFT_ALREADY_STARTED';
    end if;
    if v_schedule_changed and exists (
      select 1
      from app.bookings as booking
      join app.shift_positions as position
        on position.tenant_id = booking.tenant_id
       and position.id = booking.position_id
      where booking.tenant_id = p_tenant_id
        and position.shift_id = p_shift_id
        and booking.state in ('transfer_pending', 'performed_pending', 'confirmed', 'no_show')
    ) then
      raise exception using errcode = 'P0001', message = 'BOOKING_STATE_BLOCKS_PLAN_CHANGE';
    end if;

    if p_position_count < v_existing_position_count and exists (
      select 1
      from app.bookings as booking
      join app.shift_positions as position
        on position.tenant_id = booking.tenant_id
       and position.id = booking.position_id
      where booking.tenant_id = p_tenant_id
        and position.shift_id = p_shift_id
        and position.ordinal > p_position_count
        and booking.state in (
          'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
        )
    ) then
      raise exception using errcode = 'P0001', message = 'POSITION_OCCUPIED';
    end if;

    select count(*)::integer into v_active_booking_count
    from app.bookings as booking
    join app.shift_positions as position
      on position.tenant_id = booking.tenant_id
     and position.id = booking.position_id
    where booking.tenant_id = p_tenant_id
      and position.shift_id = p_shift_id
      and booking.state in (
        'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
      );

    if v_schedule_changed then
      select count(*)::integer into v_overlap_count
      from app.bookings as affected_booking
      join app.shift_positions as affected_position
        on affected_position.tenant_id = affected_booking.tenant_id
       and affected_position.id = affected_booking.position_id
      where affected_booking.tenant_id = p_tenant_id
        and affected_position.shift_id = p_shift_id
        and affected_booking.state in ('booked', 'reconfirmation_required')
        and exists (
          select 1
          from app.bookings as other_booking
          join app.shift_positions as other_position
            on other_position.tenant_id = other_booking.tenant_id
           and other_position.id = other_booking.position_id
          where other_booking.tenant_id = affected_booking.tenant_id
            and other_booking.executor_person_id = affected_booking.executor_person_id
            and other_position.shift_id <> p_shift_id
            and other_booking.state in (
              'booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'
            )
            and tstzrange(
              other_booking.starts_at_snapshot,
              other_booking.ends_at_snapshot,
              '[)'
            ) && tstzrange(p_starts_at, p_ends_at, '[)')
        );
      if v_overlap_count > 0 then
        raise exception using errcode = '23P01', message = 'PERSON_OVERLAP_IMPACT';
      end if;
    end if;

    update app.shift_positions as position
    set starts_at = p_starts_at,
        ends_at = p_ends_at,
        state = case
          when position.ordinal > p_position_count then 'cancelled'
          when position.state = 'cancelled' then 'open'
          else position.state
        end,
        updated_at = statement_timestamp(),
        version = position.version + 1
    where position.tenant_id = p_tenant_id
      and position.shift_id = p_shift_id
      and (
        position.starts_at <> p_starts_at
        or position.ends_at <> p_ends_at
        or (position.ordinal > p_position_count and position.state <> 'cancelled')
        or (position.ordinal <= p_position_count and position.state = 'cancelled')
      );

    insert into app.shift_positions (
      tenant_id, shift_id, ordinal, starts_at, ends_at, state
    )
    select
      p_tenant_id, p_shift_id, ordinal,
      p_starts_at, p_ends_at, 'open'
    from generate_series(1, p_position_count) as series(ordinal)
    where not exists (
      select 1
      from app.shift_positions as existing_position
      where existing_position.tenant_id = p_tenant_id
        and existing_position.shift_id = p_shift_id
        and existing_position.ordinal = ordinal
    );

    if v_schedule_changed then
      with affected_bookings as (
        update app.bookings as booking
        set state = 'reconfirmation_required',
            updated_at = statement_timestamp(),
            version = booking.version + 1
        from app.shift_positions as position
        where position.tenant_id = booking.tenant_id
          and position.id = booking.position_id
          and booking.tenant_id = p_tenant_id
          and position.shift_id = p_shift_id
          and booking.state in ('booked', 'reconfirmation_required')
        returning booking.tenant_id, booking.id
      ), inserted_events as (
        insert into app.booking_events (
          tenant_id, booking_id, event_type, actor_auth_user_id, reason_code, payload
        )
        select
          affected.tenant_id, affected.id, 'booking.reconfirmation_required',
          v_actor, 'shift_schedule_changed',
          jsonb_build_object(
            'shift_id', p_shift_id,
            'starts_at', p_starts_at,
            'ends_at', p_ends_at,
            'input_mode', p_input_mode
          )
        from affected_bookings as affected
        returning booking_id
      )
      select count(*)::integer into v_reconfirmation_count
      from inserted_events;
    end if;

    update app.shifts as shift_row
    set starts_at = p_starts_at,
        ends_at = p_ends_at,
        updated_at = statement_timestamp(),
        version = shift_row.version + 1
    where shift_row.tenant_id = p_tenant_id
      and shift_row.id = p_shift_id
    returning shift_row.version into v_new_version;

    v_target_shift_id := p_shift_id;
    v_event_type := case p_action
      when 'move' then 'shift.plan_moved'
      else 'shift.plan_resized'
    end;
  end if;

  select coalesce(jsonb_agg(position.id order by position.ordinal), '[]'::jsonb)
  into v_position_ids
  from app.shift_positions as position
  where position.tenant_id = p_tenant_id
    and position.shift_id = v_target_shift_id
    and position.ordinal <= p_position_count
    and position.state <> 'cancelled';

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, v_event_type, 'shift', v_target_shift_id,
    'committee', p_committee_id, p_input_mode, p_idempotency_key,
    jsonb_build_object(
      'action', p_action,
      'position_count', p_position_count,
      'active_booking_count', v_active_booking_count,
      'reconfirmation_count', v_reconfirmation_count,
      'overlap_count', v_overlap_count
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'shift', v_target_shift_id, v_new_version,
    v_event_type,
    jsonb_build_object(
      'input_mode', p_input_mode,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at,
      'position_count', p_position_count,
      'reconfirmation_count', v_reconfirmation_count
    )
  );

  v_result := jsonb_build_object(
    'resource_id', v_target_shift_id,
    'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'action', p_action,
      'input_mode', p_input_mode,
      'position_ids', v_position_ids,
      'position_count', p_position_count,
      'minimum_positions', v_minimum_positions,
      'active_booking_count', v_active_booking_count,
      'reconfirmation_count', v_reconfirmation_count,
      'overlap_count', v_overlap_count
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);

  return query select
    true, v_target_shift_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.manage_planboard_shift(
  uuid, uuid, text, text, bigint, uuid, uuid, uuid, text,
  timestamptz, timestamptz, integer, uuid
) owner to cluvo_command_owner;
revoke execute on function internal.manage_planboard_shift(
  uuid, uuid, text, text, bigint, uuid, uuid, uuid, text,
  timestamptz, timestamptz, integer, uuid
) from public, anon, service_role;
grant execute on function internal.manage_planboard_shift(
  uuid, uuid, text, text, bigint, uuid, uuid, uuid, text,
  timestamptz, timestamptz, integer, uuid
) to authenticated;

create or replace function api.manage_planboard_shift(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_action text,
  p_input_mode text,
  p_expected_shift_version bigint,
  p_type_version_id uuid,
  p_committee_id uuid,
  p_category_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_position_count integer,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.manage_planboard_shift(
    p_tenant_id, p_shift_id, p_action, p_input_mode,
    p_expected_shift_version, p_type_version_id, p_committee_id,
    p_category_id, p_title, p_starts_at, p_ends_at,
    p_position_count, p_idempotency_key
  );
$function$;

revoke execute on function api.manage_planboard_shift(
  uuid, uuid, text, text, bigint, uuid, uuid, uuid, text,
  timestamptz, timestamptz, integer, uuid
) from public, anon, service_role;
grant execute on function api.manage_planboard_shift(
  uuid, uuid, text, text, bigint, uuid, uuid, uuid, text,
  timestamptz, timestamptz, integer, uuid
) to authenticated;

-- Direct client mutations remain forbidden.  API functions are the only write
-- surface and derive actors from the JWT-backed internal.current_actor_uid().
revoke insert, update, delete, truncate, references, trigger
  on
    app.volunteer_role_catalog,
    app.volunteer_role_versions,
    app.volunteer_appointments,
    app.exception_cases,
    app.exception_case_revisions,
    app.exception_reviews,
    app.exception_decisions,
    app.obligation_coverage_decisions,
    app.appointment_review_cases,
    app.winter_reviews,
    app.winter_allocations,
    app.booking_cancellations,
    app.transfer_requests,
    app.waitlist_entries,
    app.waitlist_offers
  from public, anon, authenticated;

revoke execute on all functions in schema api from public, anon, service_role;
revoke execute on all functions in schema internal from public, anon, service_role;
