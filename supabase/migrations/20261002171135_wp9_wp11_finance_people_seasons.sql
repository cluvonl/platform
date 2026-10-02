-- Cluvo WP9-WP11: controlled financial assessment and volunteer fund,
-- volunteer development/appreciation, and immutable season close/rollover.
--
-- This is an expand-only migration. Amounts are integer eurocents, effort is
-- integer minutes, and every tenant relationship uses a compound tenant key.

insert into app.permissions (permission_key, description) values
  ('finance.assessment.prepare', 'Prepare an evidence-backed shortage or buyout assessment'),
  ('finance.assessment.approve', 'Approve an assessment on behalf of the volunteer committee'),
  ('finance.assessment.finalize', 'Create the approved invoice or controlled export basis'),
  ('finance.assessment.view', 'Read finalized financial calculation and processing data'),
  ('finance.fund.manage', 'Post approved volunteer-fund receipts, reservations and expenses'),
  ('development.manage', 'Manage training, qualifications and volunteer development'),
  ('vacancy.manage', 'Manage structural volunteer vacancies and appointment cases'),
  ('workload.manage', 'Manage volunteer workload preferences and follow-up signals'),
  ('appreciation.manage', 'Manage deduplicated appreciation occasions and actions'),
  ('report.season.view', 'Read tenant-level season and distinct-household reports'),
  ('season.close', 'Close a season after all blocking work is resolved'),
  ('season.rollover', 'Create an idempotent next-season rollover')
on conflict (permission_key) do nothing;

-- WP9: supply evidence, one financial route and immutable calculation history.
create table app.supply_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  obligation_id uuid not null,
  season_id uuid not null,
  period_start date not null,
  period_end date not null,
  required_minutes integer not null check (required_minutes >= 0),
  suitable_capacity_minutes integer not null check (suitable_capacity_minutes >= 0),
  alternatives jsonb not null default '[]'::jsonb
    check (jsonb_typeof(alternatives) = 'array'),
  outcome text not null check (outcome in ('sufficient', 'insufficient', 'needs_review')),
  evidence_hash bytea not null,
  assessed_by_auth_user_id uuid not null,
  assessed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, id, obligation_id, season_id),
  foreign key (tenant_id, obligation_id, season_id)
    references app.obligations(tenant_id, id, season_id) on delete restrict,
  foreign key (assessed_by_auth_user_id) references auth.users(id) on delete restrict,
  check (period_end >= period_start)
);

create table app.financial_assessments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  obligation_id uuid not null,
  season_id uuid not null,
  route text not null check (route in ('shortage', 'buyout')),
  state text not null default 'draft'
    check (state in ('draft', 'committee_approved', 'finalized', 'reassessment_required', 'superseded', 'void')),
  current_revision integer not null default 1 check (current_revision > 0),
  exception_decision_id uuid,
  supply_assessment_id uuid,
  created_by_auth_user_id uuid not null,
  approved_by_auth_user_id uuid,
  approved_at timestamptz,
  finalized_by_auth_user_id uuid,
  finalized_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, id, obligation_id, season_id),
  foreign key (tenant_id, obligation_id, season_id)
    references app.obligations(tenant_id, id, season_id) on delete restrict,
  foreign key (tenant_id, exception_decision_id)
    references app.exception_decisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, supply_assessment_id, obligation_id, season_id)
    references app.supply_assessments(tenant_id, id, obligation_id, season_id) on delete restrict,
  check (
    (route = 'shortage' and exception_decision_id is null)
    or (route = 'buyout' and exception_decision_id is not null and supply_assessment_id is not null)
  ),
  check ((approved_at is null) = (approved_by_auth_user_id is null)),
  check ((finalized_at is null) = (finalized_by_auth_user_id is null)),
  check (state not in ('committee_approved', 'finalized', 'reassessment_required') or approved_at is not null),
  check (state <> 'finalized' or finalized_at is not null)
);

-- Prevent both an active buyout and an active shortage claim, including races.
create unique index financial_assessments_one_active_route_uq
  on app.financial_assessments (tenant_id, obligation_id, season_id)
  where state in ('draft', 'committee_approved', 'finalized', 'reassessment_required');

create table app.assessment_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assessment_id uuid not null,
  obligation_id uuid not null,
  season_id uuid not null,
  revision integer not null check (revision > 0),
  route text not null check (route in ('shortage', 'buyout')),
  effective_target_minutes integer not null check (effective_target_minutes >= 0),
  confirmed_minutes integer not null check (confirmed_minutes >= 0),
  missing_minutes integer not null check (missing_minutes >= 0),
  rate_numerator_cents integer not null default 15000 check (rate_numerator_cents >= 0),
  rate_denominator_minutes integer not null default 720 check (rate_denominator_minutes > 0),
  proposed_cents integer not null check (proposed_cents >= 0),
  ledger_revision bigint not null check (ledger_revision >= 0),
  decision_set_hash bytea not null,
  blockers jsonb not null default '[]'::jsonb check (jsonb_typeof(blockers) = 'array'),
  supersedes_revision_id uuid,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, assessment_id, revision),
  unique (tenant_id, id, assessment_id),
  foreign key (tenant_id, assessment_id, obligation_id, season_id)
    references app.financial_assessments(tenant_id, id, obligation_id, season_id) on delete restrict,
  foreign key (tenant_id, supersedes_revision_id)
    references app.assessment_revisions(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (route = 'shortage'
      and missing_minutes = greatest(0, effective_target_minutes - confirmed_minutes)
      and proposed_cents = round(
        missing_minutes::numeric * rate_numerator_cents::numeric
        / rate_denominator_minutes::numeric
      )::integer)
    or (route = 'buyout'
      and missing_minutes = 0
      and proposed_cents = rate_numerator_cents)
  ),
  check ((revision = 1) = (supersedes_revision_id is null))
);

create table app.financial_objections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assessment_id uuid not null,
  obligation_id uuid not null,
  season_id uuid not null,
  opened_by_auth_user_id uuid not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  state text not null default 'open' check (state in ('open', 'in_review', 'resolved', 'rejected')),
  resolved_by_auth_user_id uuid,
  resolution text,
  created_at timestamptz not null default statement_timestamp(),
  resolved_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, assessment_id, obligation_id, season_id)
    references app.financial_assessments(tenant_id, id, obligation_id, season_id) on delete restrict,
  foreign key (opened_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (resolved_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (state in ('open', 'in_review') and resolved_at is null and resolved_by_auth_user_id is null and resolution is null)
    or (state in ('resolved', 'rejected') and resolved_at is not null
      and resolved_by_auth_user_id is not null and nullif(btrim(resolution), '') is not null)
  )
);

create unique index financial_objections_one_open_actor_uq
  on app.financial_objections (tenant_id, assessment_id, opened_by_auth_user_id)
  where state in ('open', 'in_review');

create table app.financial_processing_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assessment_id uuid not null,
  assessment_revision_id uuid not null,
  obligation_id uuid not null,
  season_id uuid not null,
  processing_kind text not null check (processing_kind in ('invoice', 'controlled_export')),
  amount_cents integer not null check (amount_cents >= 0),
  state text not null default 'created'
    check (state in ('created', 'issued', 'paid', 'credited', 'void')),
  external_reference text,
  processed_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, assessment_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, assessment_id, obligation_id, season_id)
    references app.financial_assessments(tenant_id, id, obligation_id, season_id) on delete restrict,
  foreign key (tenant_id, assessment_revision_id, assessment_id)
    references app.assessment_revisions(tenant_id, id, assessment_id) on delete restrict,
  foreign key (processed_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  processing_record_id uuid not null,
  event_kind text not null check (event_kind in ('paid', 'refund', 'reversal', 'failed')),
  amount_cents integer not null check (amount_cents >= 0),
  provider_event_id text,
  occurred_at timestamptz not null,
  recorded_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, provider_event_id),
  foreign key (tenant_id, processing_record_id)
    references app.financial_processing_records(tenant_id, id) on delete restrict,
  foreign key (recorded_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.financial_corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assessment_id uuid not null,
  source_revision_id uuid not null,
  correction_kind text not null check (correction_kind in ('credit', 'debit', 'reassessment')),
  amount_delta_cents integer not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  actor_auth_user_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, assessment_id) references app.financial_assessments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, source_revision_id, assessment_id)
    references app.assessment_revisions(tenant_id, id, assessment_id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (correction_kind = 'credit' and amount_delta_cents < 0)
    or (correction_kind = 'debit' and amount_delta_cents > 0)
    or correction_kind = 'reassessment'
  )
);

create table app.volunteer_fund_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  entry_kind text not null
    check (entry_kind in ('receipt', 'reserve', 'release', 'spend_reserved', 'spend_direct', 'correction')),
  available_cents_delta integer not null,
  reserved_cents_delta integer not null,
  spent_cents_delta integer not null,
  reservation_key uuid,
  processing_record_id uuid,
  reverses_entry_id uuid,
  purpose text not null check (nullif(btrim(purpose), '') is not null),
  owner_person_id uuid,
  actor_auth_user_id uuid not null,
  approved_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, reverses_entry_id),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  foreign key (tenant_id, owner_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, processing_record_id)
    references app.financial_processing_records(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reverses_entry_id)
    references app.volunteer_fund_entries(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (entry_kind = 'receipt' and available_cents_delta > 0 and reserved_cents_delta = 0
      and spent_cents_delta = 0 and reservation_key is null and reverses_entry_id is null)
    or (entry_kind = 'reserve' and available_cents_delta < 0
      and reserved_cents_delta = -available_cents_delta and spent_cents_delta = 0
      and reservation_key is not null and reverses_entry_id is null)
    or (entry_kind = 'release' and available_cents_delta > 0
      and reserved_cents_delta = -available_cents_delta and spent_cents_delta = 0
      and reservation_key is not null and reverses_entry_id is null)
    or (entry_kind = 'spend_reserved' and available_cents_delta = 0
      and reserved_cents_delta < 0 and spent_cents_delta = -reserved_cents_delta
      and reservation_key is not null and reverses_entry_id is null)
    or (entry_kind = 'spend_direct' and available_cents_delta < 0
      and reserved_cents_delta = 0 and spent_cents_delta = -available_cents_delta
      and reservation_key is null and reverses_entry_id is null)
    or (entry_kind = 'correction' and reverses_entry_id is not null)
  )
);

create index volunteer_fund_entries_reservation_idx
  on app.volunteer_fund_entries (tenant_id, reservation_key, created_at)
  where reservation_key is not null;

-- WP10: development records, vacancies without implicit rights, workload and
-- appreciation. Existing qualification and volunteer-role tables remain the
-- authority; these tables add workflow/history instead of duplicating them.
alter table app.person_qualifications
  add constraint person_qualifications_tenant_id_person_uq
  unique (tenant_id, id, person_id);

create table app.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  title text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, title),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.course_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  course_id uuid not null,
  qualification_type_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  qualification_valid_until timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  state text not null default 'scheduled' check (state in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, course_id) references app.courses(tenant_id, id) on delete restrict,
  foreign key (tenant_id, qualification_type_id)
    references app.qualification_types(tenant_id, id) on delete restrict,
  check (ends_at > starts_at),
  check (qualification_valid_until is null or qualification_valid_until > ends_at)
);

create table app.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  session_id uuid not null,
  person_id uuid not null,
  state text not null default 'enrolled'
    check (state in ('enrolled', 'attended', 'completed', 'failed', 'cancelled')),
  result_note text,
  qualification_id uuid,
  enrolled_by_auth_user_id uuid not null,
  completed_by_auth_user_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, session_id, person_id),
  foreign key (tenant_id, session_id) references app.course_sessions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, qualification_id, person_id)
    references app.person_qualifications(tenant_id, id, person_id) on delete restrict,
  foreign key (enrolled_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (completed_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((state = 'completed') = (completed_by_auth_user_id is not null and qualification_id is not null))
);

create table app.qualification_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  qualification_id uuid not null,
  person_id uuid not null,
  event_kind text not null check (event_kind in ('verified', 'expired', 'revoked', 'renewed')),
  effective_at timestamptz not null,
  reason text,
  actor_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, qualification_id, person_id)
    references app.person_qualifications(tenant_id, id, person_id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict
);

create table app.qualification_booking_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  qualification_id uuid not null,
  booking_id uuid not null,
  detected_at timestamptz not null default statement_timestamp(),
  state text not null default 'open' check (state in ('open', 'resolved', 'accepted_risk')),
  resolution text,
  resolved_by_auth_user_id uuid,
  resolved_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, qualification_id, booking_id),
  foreign key (tenant_id, qualification_id)
    references app.person_qualifications(tenant_id, id) on delete restrict,
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (resolved_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((state = 'open') = (resolved_at is null and resolved_by_auth_user_id is null))
);

create table app.vacancies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role_version_id uuid not null,
  committee_id uuid,
  team_id uuid,
  title text not null,
  description text not null,
  expected_minutes integer not null check (expected_minutes >= 0),
  guidance text,
  contact_person_id uuid not null,
  state text not null default 'draft' check (state in ('draft', 'published', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, role_version_id)
    references app.volunteer_role_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  foreign key (tenant_id, contact_person_id) references app.persons(tenant_id, id) on delete restrict,
  check (num_nonnulls(committee_id, team_id) <= 1),
  check (closes_at is null or opens_at is not null and closes_at > opens_at)
);

create table app.vacancy_interests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  vacancy_id uuid not null,
  person_id uuid not null,
  state text not null default 'interested'
    check (state in ('interested', 'contacted', 'meeting', 'withdrawn', 'rejected', 'appointed')),
  motivation text,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, vacancy_id, person_id),
  foreign key (tenant_id, vacancy_id) references app.vacancies(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.appointment_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  vacancy_interest_id uuid not null,
  person_id uuid not null,
  state text not null default 'open' check (state in ('open', 'approved', 'rejected', 'withdrawn')),
  appointment_id uuid,
  opened_by_auth_user_id uuid not null,
  decided_by_auth_user_id uuid,
  decision_reason text,
  created_at timestamptz not null default statement_timestamp(),
  decided_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, vacancy_interest_id),
  foreign key (tenant_id, vacancy_interest_id)
    references app.vacancy_interests(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, appointment_id)
    references app.volunteer_appointments(tenant_id, id) on delete restrict,
  foreign key (opened_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (decided_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (state = 'open' and appointment_id is null and decided_at is null and decided_by_auth_user_id is null)
    or (state = 'approved' and appointment_id is not null and decided_at is not null
      and decided_by_auth_user_id is not null and nullif(btrim(decision_reason), '') is not null)
    or (state in ('rejected', 'withdrawn') and appointment_id is null and decided_at is not null
      and decided_by_auth_user_id is not null and nullif(btrim(decision_reason), '') is not null)
  )
);

create table app.appointment_annual_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  appointment_id uuid not null,
  season_id uuid not null,
  confirmed_by_auth_user_id uuid not null,
  confirmed_at timestamptz not null default statement_timestamp(),
  note text,
  unique (tenant_id, id),
  unique (tenant_id, appointment_id, season_id),
  foreign key (tenant_id, appointment_id)
    references app.volunteer_appointments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, season_id) references app.seasons(tenant_id, id) on delete restrict,
  foreign key (confirmed_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.workload_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  season_id uuid not null,
  period_start date not null,
  period_end date not null,
  desired_minutes integer not null check (desired_minutes >= 0),
  maximum_minutes integer check (maximum_minutes is null or maximum_minutes >= desired_minutes),
  reserve_available boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, person_id, season_id, period_start, period_end),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, season_id) references app.seasons(tenant_id, id) on delete restrict,
  check (period_end >= period_start)
);

create table app.workload_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  season_id uuid not null,
  period_start date not null,
  period_end date not null,
  alert_kind text not null check (alert_kind in ('repeated_cover', 'over_preference', 'over_maximum')),
  observed_minutes integer not null check (observed_minutes >= 0),
  preferred_minutes integer not null check (preferred_minutes >= 0),
  dedupe_key text not null,
  state text not null default 'open' check (state in ('open', 'acknowledged', 'resolved')),
  owner_person_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, dedupe_key),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, owner_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, season_id) references app.seasons(tenant_id, id) on delete restrict,
  check (period_end >= period_start)
);

create table app.appreciation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  source_kind text not null
    check (source_kind in ('birthday', 'membership_anniversary', 'volunteer_anniversary', 'training', 'farewell', 'custom')),
  action_kind text not null check (action_kind in ('message', 'action_card')),
  milestone_years integer check (milestone_years is null or milestone_years > 0),
  default_budget_cents integer not null default 0 check (default_budget_cents >= 0),
  public_congratulation boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, name),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.appreciation_occasions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  rule_id uuid not null,
  person_id uuid not null,
  source_date date not null,
  period_key text not null,
  milestone_value integer,
  source_verified boolean not null,
  visibility text not null default 'internal' check (visibility in ('private', 'internal', 'public')),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, rule_id, person_id, period_key),
  foreign key (tenant_id, rule_id) references app.appreciation_rules(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  check (source_verified)
);

create table app.appreciation_private_details (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  occasion_id uuid not null,
  detail text not null check (nullif(btrim(detail), '') is not null),
  recorded_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, occasion_id),
  foreign key (tenant_id, occasion_id)
    references app.appreciation_occasions(tenant_id, id) on delete restrict,
  foreign key (recorded_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.appreciation_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  occasion_id uuid not null,
  action_kind text not null check (action_kind in ('message', 'action_card')),
  owner_person_id uuid not null,
  due_at timestamptz,
  budget_cents integer not null default 0 check (budget_cents >= 0),
  state text not null default 'open' check (state in ('open', 'in_progress', 'completed', 'cancelled')),
  handled_at timestamptz,
  created_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, occasion_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, occasion_id)
    references app.appreciation_occasions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, owner_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((state = 'completed') = (handled_at is not null))
);

create table app.appreciation_action_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  action_id uuid not null,
  person_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, action_id, person_id),
  foreign key (tenant_id, action_id) references app.appreciation_actions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict
);

-- WP11: closed-season evidence is immutable. Rollover creates new obligations
-- and explicit reconfirmation work; it never carries confirmed/extra minutes.
create table app.season_close_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  season_id uuid not null,
  state text not null default 'closed' check (state in ('closed', 'superseded')),
  check_result jsonb not null check (jsonb_typeof(check_result) = 'object'),
  check_hash bytea not null,
  closed_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  closed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, id, season_id),
  unique (tenant_id, season_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, season_id) references app.seasons(tenant_id, id) on delete restrict,
  foreign key (closed_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.season_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  close_run_id uuid not null,
  season_id uuid not null,
  obligation_id uuid not null,
  household_id uuid not null,
  base_target_minutes integer not null check (base_target_minutes >= 0),
  effective_target_minutes integer not null check (effective_target_minutes >= 0),
  effective_winter_minutes integer not null check (effective_winter_minutes >= 0),
  confirmed_minutes integer not null check (confirmed_minutes >= 0),
  extra_minutes integer not null check (extra_minutes >= 0),
  obligation_status text not null,
  coverage_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(coverage_manifest) = 'array'),
  decision_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(decision_manifest) = 'array'),
  financial_manifest jsonb not null default '[]'::jsonb check (jsonb_typeof(financial_manifest) = 'array'),
  ledger_hash bytea not null,
  snapshot_version integer not null default 1 check (snapshot_version = 1),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, close_run_id, obligation_id),
  unique (tenant_id, season_id, obligation_id),
  foreign key (tenant_id, close_run_id, season_id)
    references app.season_close_runs(tenant_id, id, season_id) on delete restrict,
  foreign key (tenant_id, obligation_id, season_id)
    references app.obligations(tenant_id, id, season_id) on delete restrict,
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  check (effective_winter_minutes <= effective_target_minutes),
  check (extra_minutes = greatest(0, confirmed_minutes - effective_target_minutes))
);

create table app.rollover_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  source_season_id uuid not null,
  target_season_id uuid not null,
  selected_template_keys text[] not null default '{}'::text[],
  state text not null default 'completed' check (state in ('completed', 'superseded')),
  created_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  completed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, id, target_season_id),
  unique (tenant_id, source_season_id, target_season_id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, source_season_id) references app.seasons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, target_season_id) references app.seasons(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check (source_season_id <> target_season_id)
);

create table app.rollover_template_selections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  rollover_run_id uuid not null,
  template_key text not null check (nullif(btrim(template_key), '') is not null),
  copied boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, rollover_run_id, template_key),
  foreign key (tenant_id, rollover_run_id) references app.rollover_runs(tenant_id, id) on delete restrict
);

create table app.season_reconfirmation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  rollover_run_id uuid not null,
  target_season_id uuid not null,
  subject_kind text not null check (subject_kind in ('intake', 'volunteer_appointment', 'policy')),
  person_id uuid not null,
  source_resource_id uuid not null,
  state text not null default 'open' check (state in ('open', 'confirmed', 'not_applicable')),
  confirmed_by_auth_user_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, rollover_run_id, subject_kind, source_resource_id),
  foreign key (tenant_id, rollover_run_id, target_season_id)
    references app.rollover_runs(tenant_id, id, target_season_id) on delete restrict,
  foreign key (tenant_id, target_season_id) references app.seasons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (confirmed_by_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (state = 'open' and confirmed_by_auth_user_id is null and confirmed_at is null)
    or (state in ('confirmed', 'not_applicable')
      and confirmed_by_auth_user_id is not null and confirmed_at is not null)
  )
);

-- Command-owner capabilities are explicit. Browser roles only receive SELECT;
-- all writes below are routed through guarded commands or trusted jobs.
grant select on
  app.supply_assessments,
  app.financial_assessments,
  app.assessment_revisions,
  app.financial_objections,
  app.financial_processing_records,
  app.payment_events,
  app.financial_corrections,
  app.volunteer_fund_entries,
  app.courses,
  app.course_sessions,
  app.course_enrollments,
  app.qualification_events,
  app.qualification_booking_impacts,
  app.vacancies,
  app.vacancy_interests,
  app.appointment_cases,
  app.appointment_annual_confirmations,
  app.workload_preferences,
  app.workload_alerts,
  app.appreciation_rules,
  app.appreciation_occasions,
  app.appreciation_private_details,
  app.appreciation_actions,
  app.appreciation_action_assignees,
  app.season_close_runs,
  app.season_snapshots,
  app.rollover_runs,
  app.rollover_template_selections,
  app.season_reconfirmation_items
to cluvo_command_owner;

grant insert, update on
  app.financial_assessments,
  app.financial_objections,
  app.financial_processing_records,
  app.course_enrollments,
  app.qualification_booking_impacts,
  app.vacancy_interests,
  app.appointment_cases,
  app.workload_preferences,
  app.workload_alerts,
  app.appreciation_rules,
  app.appreciation_actions,
  app.season_reconfirmation_items
to cluvo_command_owner;

grant insert on
  app.supply_assessments,
  app.assessment_revisions,
  app.payment_events,
  app.financial_corrections,
  app.volunteer_fund_entries,
  app.courses,
  app.course_sessions,
  app.qualification_events,
  app.vacancies,
  app.appointment_annual_confirmations,
  app.appreciation_occasions,
  app.appreciation_private_details,
  app.appreciation_action_assignees,
  app.season_close_runs,
  app.season_snapshots,
  app.rollover_runs,
  app.rollover_template_selections
to cluvo_command_owner;

grant update on app.seasons to cluvo_command_owner;
grant insert on app.household_obligation_links, app.person_qualifications to cluvo_command_owner;

do $wp9_wp11_rls$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'supply_assessments', 'financial_assessments', 'assessment_revisions',
    'financial_objections', 'financial_processing_records', 'payment_events',
    'financial_corrections', 'volunteer_fund_entries', 'courses',
    'course_sessions', 'course_enrollments', 'qualification_events',
    'qualification_booking_impacts', 'vacancies', 'vacancy_interests',
    'appointment_cases', 'appointment_annual_confirmations',
    'workload_preferences', 'workload_alerts', 'appreciation_rules',
    'appreciation_occasions', 'appreciation_private_details',
    'appreciation_actions', 'appreciation_action_assignees',
    'season_close_runs', 'season_snapshots', 'rollover_runs',
    'rollover_template_selections', 'season_reconfirmation_items'
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
$wp9_wp11_rls$;

create policy wp11_command_owner_update_seasons on app.seasons
  for update to cluvo_command_owner using (true) with check (true);
create policy wp11_command_owner_insert_obligation_links on app.household_obligation_links
  for insert to cluvo_command_owner with check (true);
create policy wp10_command_owner_insert_qualifications on app.person_qualifications
  for insert to cluvo_command_owner with check (true);

create or replace function internal.is_financially_liable_party(
  p_tenant_id uuid,
  p_obligation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.is_active_member(p_tenant_id)
    and exists (
      select 1
      from app.household_obligation_links as obligation_link
      join app.household_person_links as household_person
        on household_person.tenant_id = obligation_link.tenant_id
       and household_person.household_id = obligation_link.household_id
       and household_person.kind in ('member', 'parent', 'guardian')
       and household_person.starts_at <= statement_timestamp()
       and (household_person.ends_at is null or household_person.ends_at > statement_timestamp())
      join app.account_person_links as account_person
        on account_person.tenant_id = household_person.tenant_id
       and account_person.person_id = household_person.person_id
       and account_person.auth_user_id = (select internal.current_actor_uid())
       and account_person.revoked_at is null
      where obligation_link.tenant_id = p_tenant_id
        and obligation_link.obligation_id = p_obligation_id
        and obligation_link.link_kind = 'liable'
        and obligation_link.starts_at <= statement_timestamp()
        and (obligation_link.ends_at is null or obligation_link.ends_at > statement_timestamp())
    );
$function$;

alter function internal.is_financially_liable_party(uuid, uuid) owner to cluvo_command_owner;
revoke execute on function internal.is_financially_liable_party(uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.is_financially_liable_party(uuid, uuid)
  to authenticated, cluvo_command_owner;

create or replace function internal.can_view_financial_obligation(
  p_tenant_id uuid,
  p_obligation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.is_active_member(p_tenant_id)
    and (
      internal.is_financially_liable_party(p_tenant_id, p_obligation_id)
      or internal.has_permission(p_tenant_id, 'finance.assessment.prepare', 'tenant', p_tenant_id)
      or internal.has_permission(p_tenant_id, 'finance.assessment.approve', 'tenant', p_tenant_id)
      or internal.has_permission(p_tenant_id, 'finance.assessment.finalize', 'tenant', p_tenant_id)
      or internal.has_permission(p_tenant_id, 'finance.assessment.view', 'tenant', p_tenant_id)
    );
$function$;

alter function internal.can_view_financial_obligation(uuid, uuid) owner to cluvo_command_owner;
revoke execute on function internal.can_view_financial_obligation(uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.can_view_financial_obligation(uuid, uuid)
  to authenticated, cluvo_command_owner;

create policy visible_supply_assessments on app.supply_assessments
  for select to authenticated using (
    (select internal.can_view_financial_obligation(tenant_id, obligation_id))
  );
create policy visible_financial_assessments on app.financial_assessments
  for select to authenticated using (
    (select internal.can_view_financial_obligation(tenant_id, obligation_id))
  );
create policy visible_assessment_revisions on app.assessment_revisions
  for select to authenticated using (
    (select internal.can_view_financial_obligation(tenant_id, obligation_id))
  );
create policy visible_financial_objections on app.financial_objections
  for select to authenticated using (
    opened_by_auth_user_id = (select auth.uid())
    or (select internal.can_view_financial_obligation(tenant_id, obligation_id))
  );
create policy visible_financial_processing on app.financial_processing_records
  for select to authenticated using (
    (select internal.can_view_financial_obligation(tenant_id, obligation_id))
  );
create policy visible_payment_events on app.payment_events
  for select to authenticated using (
    exists (
      select 1
      from app.financial_processing_records as processing
      where processing.tenant_id = payment_events.tenant_id
        and processing.id = payment_events.processing_record_id
        and (select internal.can_view_financial_obligation(
          processing.tenant_id,
          processing.obligation_id
        ))
    )
  );
create policy visible_financial_corrections on app.financial_corrections
  for select to authenticated using (
    exists (
      select 1
      from app.financial_assessments as assessment
      where assessment.tenant_id = financial_corrections.tenant_id
        and assessment.id = financial_corrections.assessment_id
        and (select internal.can_view_financial_obligation(
          assessment.tenant_id,
          assessment.obligation_id
        ))
    )
  );
create policy managed_volunteer_fund on app.volunteer_fund_entries
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'finance.fund.manage', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );

create policy member_courses on app.courses
  for select to authenticated using ((select internal.is_active_member(tenant_id)));
create policy member_course_sessions on app.course_sessions
  for select to authenticated using ((select internal.is_active_member(tenant_id)));
create policy visible_course_enrollments on app.course_enrollments
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'development.manage', 'tenant', tenant_id))
  );
create policy visible_qualification_events on app.qualification_events
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'development.manage', 'tenant', tenant_id))
  );
create policy visible_qualification_impacts on app.qualification_booking_impacts
  for select to authenticated using (
    exists (
      select 1
      from app.person_qualifications as qualification
      where qualification.tenant_id = qualification_booking_impacts.tenant_id
        and qualification.id = qualification_booking_impacts.qualification_id
        and (
          (select internal.is_self_person(qualification.tenant_id, qualification.person_id))
          or (select internal.has_permission(qualification.tenant_id, 'development.manage', 'tenant', qualification.tenant_id))
        )
    )
  );
create policy member_vacancies on app.vacancies
  for select to authenticated using (
    (select internal.is_active_member(tenant_id))
    and (state = 'published' or (select internal.has_permission(tenant_id, 'vacancy.manage', 'tenant', tenant_id)))
  );
create policy visible_vacancy_interests on app.vacancy_interests
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'vacancy.manage', 'tenant', tenant_id))
  );
create policy visible_appointment_cases on app.appointment_cases
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'vacancy.manage', 'tenant', tenant_id))
  );
create policy visible_appointment_confirmations on app.appointment_annual_confirmations
  for select to authenticated using (
    exists (
      select 1 from app.volunteer_appointments as appointment
      where appointment.tenant_id = appointment_annual_confirmations.tenant_id
        and appointment.id = appointment_annual_confirmations.appointment_id
        and (
          (select internal.is_self_person(appointment.tenant_id, appointment.person_id))
          or (select internal.has_permission(appointment.tenant_id, 'volunteer_role.manage', 'tenant', appointment.tenant_id))
        )
    )
  );
create policy visible_workload_preferences on app.workload_preferences
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'workload.manage', 'tenant', tenant_id))
  );
create policy visible_workload_alerts on app.workload_alerts
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'workload.manage', 'tenant', tenant_id))
  );
create policy member_appreciation_rules on app.appreciation_rules
  for select to authenticated using ((select internal.is_active_member(tenant_id)));
create policy visible_appreciation_occasions on app.appreciation_occasions
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'appreciation.manage', 'tenant', tenant_id))
  );
create policy managed_appreciation_private_details on app.appreciation_private_details
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'appreciation.manage', 'tenant', tenant_id))
  );
create policy visible_appreciation_actions on app.appreciation_actions
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, owner_person_id))
    or (select internal.has_permission(tenant_id, 'appreciation.manage', 'tenant', tenant_id))
    or exists (
      select 1 from app.appreciation_action_assignees as assignee
      where assignee.tenant_id = appreciation_actions.tenant_id
        and assignee.action_id = appreciation_actions.id
        and (select internal.is_self_person(assignee.tenant_id, assignee.person_id))
    )
  );
create policy visible_appreciation_assignees on app.appreciation_action_assignees
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'appreciation.manage', 'tenant', tenant_id))
  );

create policy visible_season_close_runs on app.season_close_runs
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
    or exists (
      select 1 from app.obligations as obligation
      where obligation.tenant_id = season_close_runs.tenant_id
        and obligation.season_id = season_close_runs.season_id
        and (select internal.can_access_obligation_progress(obligation.tenant_id, obligation.id))
    )
  );
create policy visible_season_snapshots on app.season_snapshots
  for select to authenticated using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy managed_rollover_runs on app.rollover_runs
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'season.rollover', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy managed_rollover_templates on app.rollover_template_selections
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'season.rollover', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy visible_reconfirmation_items on app.season_reconfirmation_items
  for select to authenticated using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'season.rollover', 'tenant', tenant_id))
  );

grant select on
  app.supply_assessments,
  app.financial_assessments,
  app.assessment_revisions,
  app.financial_objections,
  app.financial_processing_records,
  app.payment_events,
  app.financial_corrections,
  app.volunteer_fund_entries,
  app.courses,
  app.course_sessions,
  app.course_enrollments,
  app.qualification_events,
  app.qualification_booking_impacts,
  app.vacancies,
  app.vacancy_interests,
  app.appointment_cases,
  app.appointment_annual_confirmations,
  app.workload_preferences,
  app.workload_alerts,
  app.appreciation_rules,
  app.appreciation_occasions,
  app.appreciation_private_details,
  app.appreciation_actions,
  app.appreciation_action_assignees,
  app.season_close_runs,
  app.season_snapshots,
  app.rollover_runs,
  app.rollover_template_selections,
  app.season_reconfirmation_items
to authenticated;

-- Tenant report readers still pass RLS on every underlying relation used by
-- the security-invoker reporting views.
create policy wp11_report_obligations on app.obligations
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy wp11_report_households on app.households
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy wp11_report_household_person_links on app.household_person_links
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy wp11_report_team_person_memberships on app.team_person_memberships
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );
create policy wp11_report_hour_ledger_entries on app.hour_ledger_entries
  for select to authenticated using (
    (select internal.has_permission(tenant_id, 'report.season.view', 'tenant', tenant_id))
  );

-- Seed capabilities for existing and future canonical permission-role rows.
create or replace function internal.seed_wp9_wp11_role_permissions()
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
      ('volunteer_committee', 'finance.assessment.prepare'),
      ('volunteer_committee', 'finance.assessment.approve'),
      ('volunteer_committee', 'finance.assessment.view'),
      ('volunteer_committee', 'development.manage'),
      ('volunteer_committee', 'vacancy.manage'),
      ('volunteer_committee', 'workload.manage'),
      ('volunteer_committee', 'appreciation.manage'),
      ('volunteer_coordinator', 'development.manage'),
      ('volunteer_coordinator', 'vacancy.manage'),
      ('volunteer_coordinator', 'workload.manage'),
      ('volunteer_coordinator', 'appreciation.manage'),
      ('board', 'finance.assessment.view'),
      ('board', 'finance.fund.manage'),
      ('board', 'report.season.view'),
      ('board', 'season.close'),
      ('board', 'season.rollover'),
      ('finance', 'finance.assessment.view'),
      ('finance', 'finance.assessment.finalize'),
      ('finance', 'finance.fund.manage')
  ) as mapping(role_key, permission_key)
  where mapping.role_key = new.role_key
  on conflict (tenant_id, role_id, permission_key) do nothing;
  return new;
end;
$function$;

alter function internal.seed_wp9_wp11_role_permissions() owner to cluvo_command_owner;
revoke execute on function internal.seed_wp9_wp11_role_permissions()
  from public, anon, authenticated, service_role;

create trigger permission_roles_seed_wp9_wp11
after insert on app.permission_roles
for each row execute function internal.seed_wp9_wp11_role_permissions();

insert into app.role_permissions (tenant_id, role_id, permission_key)
select role_row.tenant_id, role_row.id, mapping.permission_key
from app.permission_roles as role_row
join (
  values
    ('volunteer_committee', 'finance.assessment.prepare'),
    ('volunteer_committee', 'finance.assessment.approve'),
    ('volunteer_committee', 'finance.assessment.view'),
    ('volunteer_committee', 'development.manage'),
    ('volunteer_committee', 'vacancy.manage'),
    ('volunteer_committee', 'workload.manage'),
    ('volunteer_committee', 'appreciation.manage'),
    ('volunteer_coordinator', 'development.manage'),
    ('volunteer_coordinator', 'vacancy.manage'),
    ('volunteer_coordinator', 'workload.manage'),
    ('volunteer_coordinator', 'appreciation.manage'),
    ('board', 'finance.assessment.view'),
    ('board', 'finance.fund.manage'),
    ('board', 'report.season.view'),
    ('board', 'season.close'),
    ('board', 'season.rollover'),
    ('finance', 'finance.assessment.view'),
    ('finance', 'finance.assessment.finalize'),
    ('finance', 'finance.fund.manage')
) as mapping(role_key, permission_key)
  on mapping.role_key = role_row.role_key
on conflict (tenant_id, role_id, permission_key) do nothing;

-- Cross-record invariants that a foreign key or CHECK cannot express.
create or replace function internal.validate_financial_assessment_route()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_decision app.exception_decisions%rowtype;
  v_supply app.supply_assessments%rowtype;
begin
  if new.route = 'buyout' then
    select * into v_decision
    from app.exception_decisions
    where tenant_id = new.tenant_id and id = new.exception_decision_id;
    if not found
      or v_decision.obligation_id <> new.obligation_id
      or v_decision.outcome <> 'approved'
      or v_decision.financial_route <> 'buyout' then
      raise exception using errcode = '23514', message = 'BUYOUT_DECISION_REQUIRED';
    end if;

    select * into v_supply
    from app.supply_assessments
    where tenant_id = new.tenant_id and id = new.supply_assessment_id;
    if not found
      or v_supply.obligation_id <> new.obligation_id
      or v_supply.season_id <> new.season_id
      or v_supply.outcome <> 'insufficient' then
      raise exception using errcode = '23514', message = 'INSUFFICIENT_SUPPLY_REVIEW_REQUIRED';
    end if;
  elsif exists (
    select 1
    from app.exception_decisions as decision
    where decision.tenant_id = new.tenant_id
      and decision.obligation_id = new.obligation_id
      and decision.outcome = 'approved'
      and decision.financial_route = 'buyout'
  ) then
    raise exception using errcode = '23514', message = 'BUYOUT_PRECLUDES_SHORTAGE';
  end if;
  return new;
end;
$function$;

alter function internal.validate_financial_assessment_route() owner to cluvo_command_owner;
revoke execute on function internal.validate_financial_assessment_route()
  from public, anon, authenticated, service_role;

create trigger financial_assessments_validate_route
before insert or update of route, obligation_id, season_id, exception_decision_id, supply_assessment_id
on app.financial_assessments
for each row execute function internal.validate_financial_assessment_route();

create or replace function internal.validate_financial_assessment_transition()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.tenant_id <> old.tenant_id
    or new.obligation_id <> old.obligation_id
    or new.season_id <> old.season_id
    or new.route <> old.route
    or new.exception_decision_id is distinct from old.exception_decision_id
    or new.supply_assessment_id is distinct from old.supply_assessment_id
    or new.created_by_auth_user_id <> old.created_by_auth_user_id
    or new.created_at <> old.created_at then
    raise exception using errcode = '55000', message = 'ASSESSMENT_BASIS_IMMUTABLE';
  end if;
  if new.current_revision < old.current_revision
    or new.version <> old.version + 1 then
    raise exception using errcode = '40001', message = 'ASSESSMENT_VERSION_INVALID';
  end if;
  if not (
    (old.state = 'draft' and new.state in ('draft', 'committee_approved', 'void'))
    or (old.state = 'committee_approved' and new.state in ('committee_approved', 'finalized', 'reassessment_required', 'void'))
    or (old.state = 'finalized' and new.state in ('finalized', 'reassessment_required'))
    or (old.state = 'reassessment_required' and new.state in ('reassessment_required', 'superseded', 'void'))
    or (old.state in ('superseded', 'void') and new.state = old.state)
  ) then
    raise exception using errcode = '23514', message = 'ASSESSMENT_STATE_TRANSITION_INVALID';
  end if;
  return new;
end;
$function$;

alter function internal.validate_financial_assessment_transition() owner to cluvo_command_owner;
revoke execute on function internal.validate_financial_assessment_transition()
  from public, anon, authenticated, service_role;

create trigger financial_assessments_validate_transition
before update on app.financial_assessments
for each row execute function internal.validate_financial_assessment_transition();

create or replace function internal.validate_processing_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assessment app.financial_assessments%rowtype;
  v_revision app.assessment_revisions%rowtype;
begin
  select * into v_assessment
  from app.financial_assessments
  where tenant_id = new.tenant_id and id = new.assessment_id;
  select * into v_revision
  from app.assessment_revisions
  where tenant_id = new.tenant_id and id = new.assessment_revision_id;
  if not found
    or v_assessment.state <> 'committee_approved'
    or v_revision.assessment_id <> v_assessment.id
    or v_revision.revision <> v_assessment.current_revision
    or v_revision.proposed_cents <> new.amount_cents
    or jsonb_array_length(v_revision.blockers) <> 0 then
    raise exception using errcode = '23514', message = 'PROCESSING_BASIS_INVALID';
  end if;
  return new;
end;
$function$;

alter function internal.validate_processing_record() owner to cluvo_command_owner;
revoke execute on function internal.validate_processing_record()
  from public, anon, authenticated, service_role;

create trigger financial_processing_validate_basis
before insert on app.financial_processing_records
for each row execute function internal.validate_processing_record();

create or replace function internal.validate_volunteer_fund_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_available bigint;
  v_reserved bigint;
  v_reservation_balance bigint;
  v_reversed app.volunteer_fund_entries%rowtype;
begin
  -- Serialize balance checks per tenant without granting UPDATE on tenants.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.tenant_id::text, 0));

  if new.entry_kind = 'correction' then
    select * into v_reversed
    from app.volunteer_fund_entries
    where tenant_id = new.tenant_id and id = new.reverses_entry_id;
    if not found or v_reversed.entry_kind = 'correction'
      or new.available_cents_delta <> -v_reversed.available_cents_delta
      or new.reserved_cents_delta <> -v_reversed.reserved_cents_delta
      or new.spent_cents_delta <> -v_reversed.spent_cents_delta
      or new.reservation_key is distinct from v_reversed.reservation_key then
      raise exception using errcode = '23514', message = 'FUND_CORRECTION_MUST_REVERSE_ENTRY';
    end if;
  end if;

  select
    coalesce(sum(available_cents_delta), 0),
    coalesce(sum(reserved_cents_delta), 0)
  into v_available, v_reserved
  from app.volunteer_fund_entries
  where tenant_id = new.tenant_id;

  if v_available + new.available_cents_delta < 0
    or v_reserved + new.reserved_cents_delta < 0 then
    raise exception using errcode = '23514', message = 'FUND_BALANCE_INSUFFICIENT';
  end if;
  if new.reservation_key is not null and new.reserved_cents_delta < 0 then
    select coalesce(sum(reserved_cents_delta), 0)
    into v_reservation_balance
    from app.volunteer_fund_entries
    where tenant_id = new.tenant_id and reservation_key = new.reservation_key;
    if v_reservation_balance + new.reserved_cents_delta < 0 then
      raise exception using errcode = '23514', message = 'FUND_RESERVATION_INSUFFICIENT';
    end if;
  end if;
  return new;
end;
$function$;

alter function internal.validate_volunteer_fund_entry() owner to cluvo_command_owner;
revoke execute on function internal.validate_volunteer_fund_entry()
  from public, anon, authenticated, service_role;

create trigger volunteer_fund_entries_validate_balance
before insert on app.volunteer_fund_entries
for each row execute function internal.validate_volunteer_fund_entry();

create or replace function internal.validate_course_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_session app.course_sessions%rowtype;
  v_qualification app.person_qualifications%rowtype;
begin
  if new.state = 'completed' then
    select * into v_session
    from app.course_sessions
    where tenant_id = new.tenant_id and id = new.session_id;
    select * into v_qualification
    from app.person_qualifications
    where tenant_id = new.tenant_id and id = new.qualification_id;
    if not found
      or v_session.state <> 'completed'
      or v_session.qualification_type_id is null
      or v_qualification.qualification_type_id <> v_session.qualification_type_id
      or v_qualification.person_id <> new.person_id
      or v_qualification.achieved_at < v_session.ends_at then
      raise exception using errcode = '23514', message = 'COURSE_QUALIFICATION_INVALID';
    end if;
  end if;
  return new;
end;
$function$;

alter function internal.validate_course_completion() owner to cluvo_command_owner;
revoke execute on function internal.validate_course_completion()
  from public, anon, authenticated, service_role;

create trigger course_enrollments_validate_completion
before insert or update of state, qualification_id on app.course_enrollments
for each row execute function internal.validate_course_completion();

create or replace function internal.validate_appreciation_occasion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rule app.appreciation_rules%rowtype;
  v_person app.persons%rowtype;
begin
  select * into v_rule from app.appreciation_rules
  where tenant_id = new.tenant_id and id = new.rule_id;
  select * into v_person from app.persons
  where tenant_id = new.tenant_id and id = new.person_id;
  if not new.source_verified then
    raise exception using errcode = '23514', message = 'APPRECIATION_SOURCE_NOT_VERIFIED';
  end if;
  if v_rule.source_kind = 'birthday'
    and (v_person.birth_date is null or v_person.birth_date_precision <> 'day'
      or new.source_date <> v_person.birth_date) then
    raise exception using errcode = '23514', message = 'BIRTH_DATE_INCOMPLETE';
  end if;
  if v_rule.source_kind = 'membership_anniversary'
    and (v_person.membership_started_on is null
      or new.source_date <> v_person.membership_started_on) then
    raise exception using errcode = '23514', message = 'MEMBERSHIP_DATE_UNKNOWN';
  end if;
  if new.visibility = 'public' and not v_rule.public_congratulation then
    raise exception using errcode = '23514', message = 'PUBLIC_APPRECIATION_NOT_ALLOWED';
  end if;
  return new;
end;
$function$;

alter function internal.validate_appreciation_occasion() owner to cluvo_command_owner;
revoke execute on function internal.validate_appreciation_occasion()
  from public, anon, authenticated, service_role;

create trigger appreciation_occasions_validate_source
before insert on app.appreciation_occasions
for each row execute function internal.validate_appreciation_occasion();

create or replace function internal.validate_season_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from app.obligations as obligation
    where obligation.tenant_id = new.tenant_id
      and obligation.id = new.obligation_id
      and obligation.season_id = new.season_id
      and obligation.assessed_household_id = new.household_id
  ) then
    raise exception using errcode = '23514', message = 'SNAPSHOT_HOUSEHOLD_MISMATCH';
  end if;
  return new;
end;
$function$;

alter function internal.validate_season_snapshot() owner to cluvo_command_owner;
revoke execute on function internal.validate_season_snapshot()
  from public, anon, authenticated, service_role;

create trigger season_snapshots_validate_household
before insert on app.season_snapshots
for each row execute function internal.validate_season_snapshot();

-- Published calculations, money events and close evidence never change in
-- place. Revisions/corrections create a new row instead.
create trigger supply_assessments_immutable
before update or delete on app.supply_assessments
for each row execute function internal.reject_immutable_change();
create trigger assessment_revisions_immutable
before update or delete on app.assessment_revisions
for each row execute function internal.reject_immutable_change();
create trigger payment_events_immutable
before update or delete on app.payment_events
for each row execute function internal.reject_immutable_change();
create trigger financial_corrections_immutable
before update or delete on app.financial_corrections
for each row execute function internal.reject_immutable_change();
create trigger volunteer_fund_entries_immutable
before update or delete on app.volunteer_fund_entries
for each row execute function internal.reject_immutable_change();
create trigger qualification_events_immutable
before update or delete on app.qualification_events
for each row execute function internal.reject_immutable_change();
create trigger appointment_confirmations_immutable
before update or delete on app.appointment_annual_confirmations
for each row execute function internal.reject_immutable_change();
create trigger appreciation_occasions_immutable
before update or delete on app.appreciation_occasions
for each row execute function internal.reject_immutable_change();
create trigger season_close_runs_immutable
before update or delete on app.season_close_runs
for each row execute function internal.reject_immutable_change();
create trigger season_snapshots_immutable
before update or delete on app.season_snapshots
for each row execute function internal.reject_immutable_change();
create trigger rollover_runs_immutable
before update or delete on app.rollover_runs
for each row execute function internal.reject_immutable_change();
create trigger rollover_template_selections_immutable
before update or delete on app.rollover_template_selections
for each row execute function internal.reject_immutable_change();

-- Narrow, security-invoker projections for browser and reporting routes.
create view api.my_financial_assessments
with (security_invoker = true)
as
select
  assessment.tenant_id,
  assessment.id as assessment_id,
  assessment.obligation_id,
  assessment.season_id,
  assessment.route,
  assessment.state,
  revision.revision,
  revision.effective_target_minutes,
  revision.confirmed_minutes,
  revision.missing_minutes,
  revision.proposed_cents,
  jsonb_array_length(revision.blockers) as blocker_count,
  assessment.updated_at
from app.financial_assessments as assessment
join app.assessment_revisions as revision
  on revision.tenant_id = assessment.tenant_id
 and revision.assessment_id = assessment.id
 and revision.revision = assessment.current_revision;

create view api.volunteer_fund_balance
with (security_invoker = true)
as
select
  entry.tenant_id,
  coalesce(sum(entry.available_cents_delta), 0)::bigint as available_cents,
  coalesce(sum(entry.reserved_cents_delta), 0)::bigint as reserved_cents,
  coalesce(sum(entry.spent_cents_delta), 0)::bigint as spent_cents,
  max(entry.created_at) as last_entry_at
from app.volunteer_fund_entries as entry
group by entry.tenant_id;

create view api.season_household_report
with (security_invoker = true)
as
with ledger as (
  select
    entry.tenant_id,
    entry.obligation_id,
    coalesce(sum(entry.minutes_delta), 0)::integer as confirmed_minutes
  from app.hour_ledger_entries as entry
  group by entry.tenant_id, entry.obligation_id
), team_counts as (
  select
    obligation.tenant_id,
    obligation.id as obligation_id,
    count(distinct team_membership.team_id)::integer as team_count
  from app.obligations as obligation
  join app.seasons as season
    on season.tenant_id = obligation.tenant_id and season.id = obligation.season_id
  left join app.household_person_links as household_person
    on household_person.tenant_id = obligation.tenant_id
   and household_person.household_id = obligation.assessed_household_id
   and household_person.starts_at < (season.ends_on + 1)::timestamptz
   and (household_person.ends_at is null or household_person.ends_at >= season.starts_on::timestamptz)
  left join app.team_person_memberships as team_membership
    on team_membership.tenant_id = household_person.tenant_id
   and team_membership.person_id = household_person.person_id
   and team_membership.starts_at < (season.ends_on + 1)::timestamptz
   and (team_membership.ends_at is null or team_membership.ends_at >= season.starts_on::timestamptz)
  group by obligation.tenant_id, obligation.id
)
select
  obligation.tenant_id,
  obligation.season_id,
  obligation.id as obligation_id,
  obligation.assessed_household_id as household_id,
  obligation.effective_target_minutes,
  coalesce(ledger.confirmed_minutes, 0) as confirmed_minutes,
  greatest(0, obligation.effective_target_minutes - coalesce(ledger.confirmed_minutes, 0)) as remaining_minutes,
  greatest(0, coalesce(ledger.confirmed_minutes, 0) - obligation.effective_target_minutes) as extra_minutes,
  coalesce(team_counts.team_count, 0) as team_count,
  obligation.status
from app.obligations as obligation
left join ledger
  on ledger.tenant_id = obligation.tenant_id and ledger.obligation_id = obligation.id
left join team_counts
  on team_counts.tenant_id = obligation.tenant_id and team_counts.obligation_id = obligation.id;

create view api.season_summary
with (security_invoker = true)
as
select
  report.tenant_id,
  report.season_id,
  count(distinct report.household_id)::integer as distinct_households,
  coalesce(sum(report.effective_target_minutes), 0)::bigint as target_minutes,
  coalesce(sum(report.confirmed_minutes), 0)::bigint as confirmed_minutes,
  coalesce(sum(report.remaining_minutes), 0)::bigint as remaining_minutes
from api.season_household_report as report
group by report.tenant_id, report.season_id;

grant select on
  api.my_financial_assessments,
  api.volunteer_fund_balance,
  api.season_household_report,
  api.season_summary
to authenticated;

-- Every ledger append is serialized with season close, including privileged
-- maintenance inserts that do not use an API command.  A finalized assessment
-- is an immutable financial basis: callers must first use the explicit
-- correction/reassessment route.  A closed season keeps its captured ledger
-- immutable; post-close money corrections remain possible without rewriting
-- the old minutes or season snapshot.
create or replace function internal.guard_hour_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_season_status text;
begin
  perform internal.lock_season_ledger(new.tenant_id, new.season_id);

  select season.status into v_season_status
  from app.seasons as season
  where season.tenant_id = new.tenant_id
    and season.id = new.season_id;
  if not found then
    raise exception using errcode = '23503', message = 'SEASON_NOT_FOUND';
  end if;
  if v_season_status = 'closed' then
    raise exception using errcode = '55000', message = 'SEASON_LEDGER_CLOSED';
  end if;

  if exists (
    select 1
    from app.financial_assessments as assessment
    where assessment.tenant_id = new.tenant_id
      and assessment.obligation_id = new.obligation_id
      and assessment.season_id = new.season_id
      and assessment.state = 'finalized'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'FINANCIAL_REASSESSMENT_REQUIRED';
  end if;

  return new;
end;
$function$;

alter function internal.guard_hour_ledger_insert() owner to cluvo_command_owner;
revoke execute on function internal.guard_hour_ledger_insert()
  from public, anon, authenticated, service_role;

create trigger hour_ledger_entries_financial_season_guard
before insert on app.hour_ledger_entries
for each row execute function internal.guard_hour_ledger_insert();

create or replace function internal.financial_blockers(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_assessment_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_blockers jsonb := '[]'::jsonb;
begin
  if exists (
    select 1 from app.hour_disputes
    where tenant_id = p_tenant_id and obligation_id = p_obligation_id
      and state in ('open', 'in_review')
  ) then
    v_blockers := v_blockers || jsonb_build_array('OPEN_HOUR_DISPUTE');
  end if;
  if exists (
    select 1 from app.bookings
    where tenant_id = p_tenant_id and obligation_id = p_obligation_id
      and current_attendance_decision_id is null
      and state not in ('cancelled', 'transferred')
      and (
        state = 'performed_pending'
        or ends_at_snapshot <= statement_timestamp()
      )
  ) then
    v_blockers := v_blockers || jsonb_build_array('PENDING_ATTENDANCE');
  end if;
  if exists (
    select 1 from app.exception_cases
    where tenant_id = p_tenant_id and obligation_id = p_obligation_id
      and state in ('submitted', 'in_review', 'escalated')
  ) then
    v_blockers := v_blockers || jsonb_build_array('OPEN_EXCEPTION');
  end if;
  if exists (
    select 1 from app.appointment_review_cases
    where tenant_id = p_tenant_id and obligation_id = p_obligation_id
      and state = 'open'
  ) then
    v_blockers := v_blockers || jsonb_build_array('OPEN_APPOINTMENT_REVIEW');
  end if;
  if p_assessment_id is not null and exists (
    select 1 from app.financial_objections
    where tenant_id = p_tenant_id and assessment_id = p_assessment_id
      and state in ('open', 'in_review')
  ) then
    v_blockers := v_blockers || jsonb_build_array('OPEN_FINANCIAL_OBJECTION');
  end if;
  return v_blockers;
end;
$function$;

alter function internal.financial_blockers(uuid, uuid, uuid) owner to cluvo_command_owner;
revoke execute on function internal.financial_blockers(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function internal.financial_blockers(uuid, uuid, uuid)
  to cluvo_command_owner;

create or replace function internal.prepare_financial_assessment(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_route text,
  p_exception_decision_id uuid,
  p_supply_assessment_id uuid,
  p_expected_obligation_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_obligation app.obligations%rowtype;
  v_assessment_id uuid := gen_random_uuid();
  v_revision_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_confirmed integer;
  v_effective_target integer;
  v_missing integer;
  v_amount integer;
  v_blockers jsonb;
  v_decision_hash bytea;
  v_exempt boolean;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(p_tenant_id, 'finance.assessment.prepare', 'tenant', p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_route not in ('shortage', 'buyout') or p_expected_obligation_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'prepare_financial_assessment',
    p_idempotency_key,
    jsonb_build_object(
      'obligation_id', p_obligation_id,
      'route', p_route,
      'exception_decision_id', p_exception_decision_id,
      'supply_assessment_id', p_supply_assessment_id,
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
  if v_obligation.status not in ('active', 'fulfilled', 'review_hold') then
    raise exception using errcode = '23514', message = 'OBLIGATION_NOT_ASSESSABLE';
  end if;
  if exists (
    select 1 from app.financial_assessments
    where tenant_id = p_tenant_id
      and obligation_id = p_obligation_id
      and season_id = v_obligation.season_id
      and state in ('draft', 'committee_approved', 'finalized', 'reassessment_required')
  ) then
    raise exception using errcode = '23505', message = 'FINANCIAL_ROUTE_EXISTS';
  end if;

  select coalesce(sum(minutes_delta), 0)::integer into v_confirmed
  from app.hour_ledger_entries
  where tenant_id = p_tenant_id and obligation_id = p_obligation_id;
  v_confirmed := greatest(0, v_confirmed);

  select exists (
    select 1
    from app.obligation_coverage_decisions as coverage
    where coverage.tenant_id = p_tenant_id
      and coverage.obligation_id = p_obligation_id
      and coverage.effect = 'household_exempt'
      and coverage.starts_on <= (select ends_on from app.seasons where tenant_id = p_tenant_id and id = v_obligation.season_id)
      and (coverage.ends_on is null or coverage.ends_on >= (select starts_on from app.seasons where tenant_id = p_tenant_id and id = v_obligation.season_id))
      and not exists (
        select 1 from app.obligation_coverage_decisions as later
        where later.tenant_id = coverage.tenant_id
          and later.source_kind = coverage.source_kind
          and later.appointment_id is not distinct from coverage.appointment_id
          and later.exception_decision_id is not distinct from coverage.exception_decision_id
          and later.decision_revision > coverage.decision_revision
      )
  ) into v_exempt;

  v_effective_target := case when v_exempt then 0 else v_obligation.effective_target_minutes end;
  if p_route = 'shortage' then
    v_missing := greatest(0, v_effective_target - v_confirmed);
    v_amount := round(v_missing::numeric * 15000::numeric / 720::numeric)::integer;
  else
    v_missing := 0;
    v_amount := 15000;
  end if;
  v_blockers := internal.financial_blockers(p_tenant_id, p_obligation_id, null);

  select extensions.digest(
    convert_to(
      coalesce(string_agg(source_key, ',' order by source_key), ''),
      'UTF8'
    ),
    'sha256'
  ) into v_decision_hash
  from (
    select 'exception:' || decision.id::text as source_key
    from app.exception_decisions as decision
    where decision.tenant_id = p_tenant_id and decision.obligation_id = p_obligation_id
    union all
    select 'coverage:' || coverage.id::text
    from app.obligation_coverage_decisions as coverage
    where coverage.tenant_id = p_tenant_id and coverage.obligation_id = p_obligation_id
  ) as sources;

  insert into app.financial_assessments (
    id, tenant_id, obligation_id, season_id, route, exception_decision_id,
    supply_assessment_id, created_by_auth_user_id
  ) values (
    v_assessment_id, p_tenant_id, p_obligation_id, v_obligation.season_id,
    p_route, p_exception_decision_id, p_supply_assessment_id, v_actor
  );

  insert into app.assessment_revisions (
    id, tenant_id, assessment_id, obligation_id, season_id, revision, route,
    effective_target_minutes, confirmed_minutes, missing_minutes,
    rate_numerator_cents, rate_denominator_minutes, proposed_cents,
    ledger_revision, decision_set_hash, blockers, created_by_auth_user_id
  ) values (
    v_revision_id, p_tenant_id, v_assessment_id, p_obligation_id, v_obligation.season_id,
    1, p_route, v_effective_target, v_confirmed, v_missing,
    15000, 720, v_amount, v_obligation.ledger_revision,
    v_decision_hash, v_blockers, v_actor
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'financial_assessment.prepared', 'financial_assessment',
    v_assessment_id, 'household', v_obligation.assessed_household_id,
    p_route, p_idempotency_key,
    jsonb_build_object('obligation_id', p_obligation_id, 'revision_id', v_revision_id,
      'missing_minutes', v_missing, 'proposed_cents', v_amount,
      'blocker_count', jsonb_array_length(v_blockers))
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'financial_assessment', v_assessment_id, 1,
    'financial_assessment.prepared',
    jsonb_build_object('obligation_id', p_obligation_id, 'route', p_route)
  );

  v_result := jsonb_build_object(
    'resource_id', v_assessment_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'revision_id', v_revision_id,
      'missing_minutes', v_missing,
      'proposed_cents', v_amount,
      'blockers', v_blockers
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_assessment_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.prepare_financial_assessment(uuid, uuid, text, uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.prepare_financial_assessment(uuid, uuid, text, uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.prepare_financial_assessment(uuid, uuid, text, uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function api.prepare_financial_assessment(
  p_tenant_id uuid,
  p_obligation_id uuid,
  p_route text,
  p_exception_decision_id uuid,
  p_supply_assessment_id uuid,
  p_expected_obligation_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.prepare_financial_assessment(
    p_tenant_id, p_obligation_id, p_route, p_exception_decision_id,
    p_supply_assessment_id, p_expected_obligation_version, p_idempotency_key
  );
$function$;

revoke execute on function api.prepare_financial_assessment(uuid, uuid, text, uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.prepare_financial_assessment(uuid, uuid, text, uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.approve_financial_assessment(
  p_tenant_id uuid,
  p_assessment_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_assessment app.financial_assessments%rowtype;
  v_revision app.assessment_revisions%rowtype;
  v_obligation app.obligations%rowtype;
  v_blockers jsonb;
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(p_tenant_id, 'finance.assessment.approve', 'tenant', p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'approve_financial_assessment', p_idempotency_key,
    jsonb_build_object('assessment_id', p_assessment_id, 'expected_version', p_expected_version)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_assessment from app.financial_assessments
  where tenant_id = p_tenant_id and id = p_assessment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if v_assessment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_assessment.state <> 'draft' then
    raise exception using errcode = '23514', message = 'ASSESSMENT_NOT_DRAFT';
  end if;
  select * into v_revision from app.assessment_revisions
  where tenant_id = p_tenant_id and assessment_id = p_assessment_id
    and revision = v_assessment.current_revision;
  select * into v_obligation from app.obligations
  where tenant_id = p_tenant_id and id = v_assessment.obligation_id for update;
  v_blockers := internal.financial_blockers(p_tenant_id, v_assessment.obligation_id, p_assessment_id);
  if v_revision.ledger_revision <> v_obligation.ledger_revision
    or jsonb_array_length(v_blockers) > 0
    or jsonb_array_length(v_revision.blockers) > 0 then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_BLOCKED';
  end if;

  update app.financial_assessments as assessment
  set state = 'committee_approved', approved_by_auth_user_id = v_actor,
      approved_at = statement_timestamp(), updated_at = statement_timestamp(),
      version = assessment.version + 1
  where assessment.tenant_id = p_tenant_id and assessment.id = p_assessment_id
  returning assessment.version into v_new_version;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'financial_assessment.approved', 'financial_assessment',
    p_assessment_id, 'household', v_obligation.assessed_household_id,
    'committee_approved', p_idempotency_key,
    jsonb_build_object('revision', v_assessment.current_revision)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'financial_assessment', p_assessment_id, v_new_version,
    'financial_assessment.approved', jsonb_build_object('revision', v_assessment.current_revision)
  );
  v_result := jsonb_build_object('resource_id', p_assessment_id, 'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id), 'result', jsonb_build_object('state', 'committee_approved'));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, p_assessment_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.approve_financial_assessment(uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.approve_financial_assessment(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.approve_financial_assessment(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function api.approve_financial_assessment(
  p_tenant_id uuid, p_assessment_id uuid, p_expected_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.approve_financial_assessment(
    p_tenant_id, p_assessment_id, p_expected_version, p_idempotency_key
  );
$function$;
revoke execute on function api.approve_financial_assessment(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.approve_financial_assessment(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.finalize_financial_assessment(
  p_tenant_id uuid,
  p_assessment_id uuid,
  p_expected_version bigint,
  p_processing_kind text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_assessment app.financial_assessments%rowtype;
  v_revision app.assessment_revisions%rowtype;
  v_obligation app.obligations%rowtype;
  v_processing_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_blockers jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(p_tenant_id, 'finance.assessment.finalize', 'tenant', p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_processing_kind not in ('invoice', 'controlled_export') then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'finalize_financial_assessment', p_idempotency_key,
    jsonb_build_object('assessment_id', p_assessment_id, 'expected_version', p_expected_version,
      'processing_kind', p_processing_kind)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  select * into v_assessment from app.financial_assessments
  where tenant_id = p_tenant_id and id = p_assessment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if v_assessment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_assessment.state <> 'committee_approved' then
    raise exception using errcode = '23514', message = 'ASSESSMENT_NOT_APPROVED';
  end if;
  select * into v_revision from app.assessment_revisions
  where tenant_id = p_tenant_id and assessment_id = p_assessment_id
    and revision = v_assessment.current_revision;
  select * into v_obligation from app.obligations
  where tenant_id = p_tenant_id and id = v_assessment.obligation_id for update;
  v_blockers := internal.financial_blockers(p_tenant_id, v_assessment.obligation_id, p_assessment_id);
  if v_revision.ledger_revision <> v_obligation.ledger_revision
    or jsonb_array_length(v_blockers) > 0 then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_BLOCKED';
  end if;

  insert into app.financial_processing_records (
    id, tenant_id, assessment_id, assessment_revision_id, obligation_id, season_id,
    processing_kind, amount_cents, processed_by_auth_user_id, idempotency_key
  ) values (
    v_processing_id, p_tenant_id, p_assessment_id, v_revision.id,
    v_assessment.obligation_id, v_assessment.season_id, p_processing_kind,
    v_revision.proposed_cents, v_actor, p_idempotency_key
  );
  update app.financial_assessments as assessment
  set state = 'finalized', finalized_by_auth_user_id = v_actor,
      finalized_at = statement_timestamp(), updated_at = statement_timestamp(),
      version = assessment.version + 1
  where assessment.tenant_id = p_tenant_id and assessment.id = p_assessment_id
  returning assessment.version into v_new_version;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'financial_assessment.finalized', 'financial_assessment',
    p_assessment_id, 'household', v_obligation.assessed_household_id,
    p_processing_kind, p_idempotency_key,
    jsonb_build_object('processing_record_id', v_processing_id, 'amount_cents', v_revision.proposed_cents)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'financial_assessment', p_assessment_id, v_new_version,
    'financial_assessment.finalized', jsonb_build_object('processing_record_id', v_processing_id)
  );
  v_result := jsonb_build_object('resource_id', p_assessment_id, 'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('processing_record_id', v_processing_id,
      'amount_cents', v_revision.proposed_cents, 'state', 'finalized'));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, p_assessment_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.finalize_financial_assessment(uuid, uuid, bigint, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.finalize_financial_assessment(uuid, uuid, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function internal.finalize_financial_assessment(uuid, uuid, bigint, text, uuid)
  to authenticated;

create or replace function api.finalize_financial_assessment(
  p_tenant_id uuid, p_assessment_id uuid, p_expected_version bigint,
  p_processing_kind text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.finalize_financial_assessment(
    p_tenant_id, p_assessment_id, p_expected_version, p_processing_kind, p_idempotency_key
  );
$function$;
revoke execute on function api.finalize_financial_assessment(uuid, uuid, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function api.finalize_financial_assessment(uuid, uuid, bigint, text, uuid)
  to authenticated;

create or replace function internal.open_financial_objection(
  p_tenant_id uuid,
  p_assessment_id uuid,
  p_expected_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_assessment app.financial_assessments%rowtype;
  v_objection_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_new_state text;
  v_result jsonb;
begin
  if v_actor is null or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'open_financial_objection', p_idempotency_key,
    jsonb_build_object('assessment_id', p_assessment_id, 'expected_version', p_expected_version,
      'reason', btrim(p_reason))
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  select * into v_assessment from app.financial_assessments
  where tenant_id = p_tenant_id and id = p_assessment_id for update;
  if not found or not internal.is_financially_liable_party(p_tenant_id, v_assessment.obligation_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_assessment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_assessment.state in ('superseded', 'void') then
    raise exception using errcode = '23514', message = 'ASSESSMENT_NOT_ACTIVE';
  end if;
  insert into app.financial_objections (
    id, tenant_id, assessment_id, obligation_id, season_id,
    opened_by_auth_user_id, reason
  ) values (
    v_objection_id, p_tenant_id, p_assessment_id, v_assessment.obligation_id,
    v_assessment.season_id, v_actor, btrim(p_reason)
  );
  v_new_state := case when v_assessment.state = 'finalized'
    then 'reassessment_required' else v_assessment.state end;
  update app.financial_assessments as assessment
  set state = v_new_state, updated_at = statement_timestamp(),
      version = assessment.version + 1
  where assessment.tenant_id = p_tenant_id and assessment.id = p_assessment_id
  returning assessment.version into v_new_version;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'financial_objection.opened', 'financial_objection',
    v_objection_id, 'household',
    (select assessed_household_id from app.obligations
      where tenant_id = p_tenant_id and id = v_assessment.obligation_id),
    'member_objection', p_idempotency_key,
    jsonb_build_object('assessment_id', p_assessment_id)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'financial_assessment', p_assessment_id, v_new_version,
    'financial_objection.opened', jsonb_build_object('objection_id', v_objection_id)
  );
  v_result := jsonb_build_object('resource_id', v_objection_id, 'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('assessment_id', p_assessment_id, 'assessment_state', v_new_state));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_objection_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.open_financial_objection(uuid, uuid, bigint, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.open_financial_objection(uuid, uuid, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function internal.open_financial_objection(uuid, uuid, bigint, text, uuid)
  to authenticated;

create or replace function api.open_financial_objection(
  p_tenant_id uuid, p_assessment_id uuid, p_expected_version bigint,
  p_reason text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.open_financial_objection(
    p_tenant_id, p_assessment_id, p_expected_version, p_reason, p_idempotency_key
  );
$function$;
revoke execute on function api.open_financial_objection(uuid, uuid, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function api.open_financial_objection(uuid, uuid, bigint, text, uuid)
  to authenticated;

create or replace function internal.resolve_financial_objection(
  p_tenant_id uuid,
  p_objection_id uuid,
  p_expected_version bigint,
  p_outcome text,
  p_resolution text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_objection app.financial_objections%rowtype;
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
      p_tenant_id, 'finance.assessment.approve', 'tenant', p_tenant_id)
    or p_outcome not in ('resolved', 'rejected')
    or nullif(btrim(p_resolution), '') is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'resolve_financial_objection', p_idempotency_key,
    jsonb_build_object('objection_id', p_objection_id, 'expected_version', p_expected_version,
      'outcome', p_outcome, 'resolution', btrim(p_resolution))
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  select * into v_objection from app.financial_objections
  where tenant_id = p_tenant_id and id = p_objection_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if v_objection.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_objection.state not in ('open', 'in_review') then
    raise exception using errcode = '23514', message = 'OBJECTION_ALREADY_CLOSED';
  end if;
  update app.financial_objections as objection
  set state = p_outcome, resolved_by_auth_user_id = v_actor,
      resolution = btrim(p_resolution), resolved_at = statement_timestamp(),
      updated_at = statement_timestamp(), version = objection.version + 1
  where objection.tenant_id = p_tenant_id and objection.id = p_objection_id
  returning objection.version into v_new_version;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'financial_objection.resolved', 'financial_objection',
    p_objection_id, p_outcome, p_idempotency_key,
    jsonb_build_object('assessment_id', v_objection.assessment_id)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'financial_objection', p_objection_id, v_new_version,
    'financial_objection.resolved', jsonb_build_object('outcome', p_outcome)
  );
  v_result := jsonb_build_object('resource_id', p_objection_id, 'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id), 'result', jsonb_build_object('state', p_outcome));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, p_objection_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.resolve_financial_objection(uuid, uuid, bigint, text, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.resolve_financial_objection(uuid, uuid, bigint, text, text, uuid)
  from public, anon, service_role;
grant execute on function internal.resolve_financial_objection(uuid, uuid, bigint, text, text, uuid)
  to authenticated;

create or replace function api.resolve_financial_objection(
  p_tenant_id uuid, p_objection_id uuid, p_expected_version bigint,
  p_outcome text, p_resolution text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.resolve_financial_objection(
    p_tenant_id, p_objection_id, p_expected_version,
    p_outcome, p_resolution, p_idempotency_key
  );
$function$;
revoke execute on function api.resolve_financial_objection(uuid, uuid, bigint, text, text, uuid)
  from public, anon, service_role;
grant execute on function api.resolve_financial_objection(uuid, uuid, bigint, text, text, uuid)
  to authenticated;

create or replace function internal.record_financial_correction(
  p_tenant_id uuid,
  p_assessment_id uuid,
  p_expected_version bigint,
  p_correction_kind text,
  p_amount_delta_cents integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_assessment app.financial_assessments%rowtype;
  v_revision_id uuid;
  v_correction_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_new_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
      p_tenant_id, 'finance.assessment.finalize', 'tenant', p_tenant_id)
    or p_correction_kind not in ('credit', 'debit', 'reassessment')
    or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'record_financial_correction', p_idempotency_key,
    jsonb_build_object('assessment_id', p_assessment_id, 'expected_version', p_expected_version,
      'correction_kind', p_correction_kind, 'amount_delta_cents', p_amount_delta_cents,
      'reason', btrim(p_reason))
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  select * into v_assessment from app.financial_assessments
  where tenant_id = p_tenant_id and id = p_assessment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if v_assessment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_assessment.state not in ('finalized', 'reassessment_required') then
    raise exception using errcode = '23514', message = 'CORRECTION_REQUIRES_FINAL_ASSESSMENT';
  end if;
  select id into v_revision_id from app.assessment_revisions
  where tenant_id = p_tenant_id and assessment_id = p_assessment_id
    and revision = v_assessment.current_revision;
  insert into app.financial_corrections (
    id, tenant_id, assessment_id, source_revision_id, correction_kind,
    amount_delta_cents, reason, actor_auth_user_id, idempotency_key
  ) values (
    v_correction_id, p_tenant_id, p_assessment_id, v_revision_id,
    p_correction_kind, p_amount_delta_cents, btrim(p_reason), v_actor, p_idempotency_key
  );
  update app.financial_assessments as assessment
  set state = 'reassessment_required', updated_at = statement_timestamp(),
      version = assessment.version + 1
  where assessment.tenant_id = p_tenant_id and assessment.id = p_assessment_id
  returning assessment.version into v_new_version;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'financial_correction.recorded', 'financial_correction',
    v_correction_id, p_correction_kind, p_idempotency_key,
    jsonb_build_object('assessment_id', p_assessment_id, 'amount_delta_cents', p_amount_delta_cents)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'financial_assessment', p_assessment_id, v_new_version,
    'financial_assessment.reassessment_required', jsonb_build_object('correction_id', v_correction_id)
  );
  v_result := jsonb_build_object('resource_id', v_correction_id, 'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('assessment_state', 'reassessment_required'));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_correction_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.record_financial_correction(uuid, uuid, bigint, text, integer, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.record_financial_correction(uuid, uuid, bigint, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function internal.record_financial_correction(uuid, uuid, bigint, text, integer, text, uuid)
  to authenticated;

create or replace function api.record_financial_correction(
  p_tenant_id uuid, p_assessment_id uuid, p_expected_version bigint,
  p_correction_kind text, p_amount_delta_cents integer, p_reason text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.record_financial_correction(
    p_tenant_id, p_assessment_id, p_expected_version, p_correction_kind,
    p_amount_delta_cents, p_reason, p_idempotency_key
  );
$function$;
revoke execute on function api.record_financial_correction(uuid, uuid, bigint, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function api.record_financial_correction(uuid, uuid, bigint, text, integer, text, uuid)
  to authenticated;

create or replace function internal.post_volunteer_fund_entry(
  p_tenant_id uuid,
  p_entry_kind text,
  p_amount_cents integer,
  p_reservation_key uuid,
  p_processing_record_id uuid,
  p_reverses_entry_id uuid,
  p_purpose text,
  p_owner_person_id uuid,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_entry_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_available integer := 0;
  v_reserved integer := 0;
  v_spent integer := 0;
  v_reversed app.volunteer_fund_entries%rowtype;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
      p_tenant_id, 'finance.fund.manage', 'tenant', p_tenant_id)
    or p_amount_cents <= 0 or nullif(btrim(p_purpose), '') is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'post_volunteer_fund_entry', p_idempotency_key,
    jsonb_build_object('entry_kind', p_entry_kind, 'amount_cents', p_amount_cents,
      'reservation_key', p_reservation_key, 'processing_record_id', p_processing_record_id,
      'reverses_entry_id', p_reverses_entry_id, 'purpose', btrim(p_purpose),
      'owner_person_id', p_owner_person_id)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  case p_entry_kind
    when 'receipt' then v_available := p_amount_cents;
    when 'reserve' then v_available := -p_amount_cents; v_reserved := p_amount_cents;
    when 'release' then v_available := p_amount_cents; v_reserved := -p_amount_cents;
    when 'spend_reserved' then v_reserved := -p_amount_cents; v_spent := p_amount_cents;
    when 'spend_direct' then v_available := -p_amount_cents; v_spent := p_amount_cents;
    when 'correction' then
      select * into v_reversed from app.volunteer_fund_entries
      where tenant_id = p_tenant_id and id = p_reverses_entry_id;
      if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
      v_available := -v_reversed.available_cents_delta;
      v_reserved := -v_reversed.reserved_cents_delta;
      v_spent := -v_reversed.spent_cents_delta;
    else raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end case;

  insert into app.volunteer_fund_entries (
    id, tenant_id, entry_kind, available_cents_delta, reserved_cents_delta,
    spent_cents_delta, reservation_key, processing_record_id, reverses_entry_id,
    purpose, owner_person_id, actor_auth_user_id, approved_by_auth_user_id, idempotency_key
  ) values (
    v_entry_id, p_tenant_id, p_entry_kind, v_available, v_reserved, v_spent,
    case when p_entry_kind = 'correction' then v_reversed.reservation_key else p_reservation_key end,
    p_processing_record_id, p_reverses_entry_id, btrim(p_purpose), p_owner_person_id,
    v_actor, v_actor, p_idempotency_key
  );
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'volunteer_fund.posted', 'volunteer_fund_entry',
    v_entry_id, p_entry_kind, p_idempotency_key,
    jsonb_build_object('available_cents_delta', v_available,
      'reserved_cents_delta', v_reserved, 'spent_cents_delta', v_spent)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'volunteer_fund_entry', v_entry_id, 1,
    'volunteer_fund.posted', jsonb_build_object('entry_kind', p_entry_kind)
  );
  v_result := jsonb_build_object('resource_id', v_entry_id, 'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('available_cents_delta', v_available,
      'reserved_cents_delta', v_reserved, 'spent_cents_delta', v_spent));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_entry_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.post_volunteer_fund_entry(uuid, text, integer, uuid, uuid, uuid, text, uuid, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.post_volunteer_fund_entry(uuid, text, integer, uuid, uuid, uuid, text, uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.post_volunteer_fund_entry(uuid, text, integer, uuid, uuid, uuid, text, uuid, uuid)
  to authenticated;

create or replace function api.post_volunteer_fund_entry(
  p_tenant_id uuid, p_entry_kind text, p_amount_cents integer,
  p_reservation_key uuid, p_processing_record_id uuid, p_reverses_entry_id uuid,
  p_purpose text, p_owner_person_id uuid, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.post_volunteer_fund_entry(
    p_tenant_id, p_entry_kind, p_amount_cents, p_reservation_key,
    p_processing_record_id, p_reverses_entry_id, p_purpose,
    p_owner_person_id, p_idempotency_key
  );
$function$;
revoke execute on function api.post_volunteer_fund_entry(uuid, text, integer, uuid, uuid, uuid, text, uuid, uuid)
  from public, anon, service_role;
grant execute on function api.post_volunteer_fund_entry(uuid, text, integer, uuid, uuid, uuid, text, uuid, uuid)
  to authenticated;

create or replace function internal.express_vacancy_interest(
  p_tenant_id uuid,
  p_vacancy_id uuid,
  p_motivation text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_person uuid;
  v_claim record;
  v_interest_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_person := internal.current_person_id(p_tenant_id);
  if v_person is null or not exists (
    select 1 from app.vacancies
    where tenant_id = p_tenant_id and id = p_vacancy_id and state = 'published'
      and (opens_at is null or opens_at <= statement_timestamp())
      and (closes_at is null or closes_at > statement_timestamp())
  ) then
    raise exception using errcode = '42501', message = 'VACANCY_NOT_AVAILABLE';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'express_vacancy_interest', p_idempotency_key,
    jsonb_build_object('vacancy_id', p_vacancy_id, 'motivation', p_motivation)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  insert into app.vacancy_interests (
    id, tenant_id, vacancy_id, person_id, motivation, created_by_auth_user_id
  ) values (v_interest_id, p_tenant_id, p_vacancy_id, v_person, p_motivation, v_actor);
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'vacancy.interest_expressed', 'vacancy_interest',
    v_interest_id, 'interest_only', p_idempotency_key,
    jsonb_build_object('vacancy_id', p_vacancy_id, 'person_id', v_person)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'vacancy_interest', v_interest_id, 1,
    'vacancy.interest_expressed', jsonb_build_object('vacancy_id', p_vacancy_id)
  );
  v_result := jsonb_build_object('resource_id', v_interest_id, 'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('state', 'interested', 'appointment_created', false));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_interest_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.express_vacancy_interest(uuid, uuid, text, uuid) owner to cluvo_command_owner;
revoke execute on function internal.express_vacancy_interest(uuid, uuid, text, uuid)
  from public, anon, service_role;
grant execute on function internal.express_vacancy_interest(uuid, uuid, text, uuid) to authenticated;

create or replace function api.express_vacancy_interest(
  p_tenant_id uuid, p_vacancy_id uuid, p_motivation text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.express_vacancy_interest(
    p_tenant_id, p_vacancy_id, p_motivation, p_idempotency_key
  );
$function$;
revoke execute on function api.express_vacancy_interest(uuid, uuid, text, uuid)
  from public, anon, service_role;
grant execute on function api.express_vacancy_interest(uuid, uuid, text, uuid) to authenticated;

create or replace function internal.create_appreciation_action(
  p_tenant_id uuid,
  p_occasion_id uuid,
  p_owner_person_id uuid,
  p_due_at timestamptz,
  p_budget_cents integer,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_occasion app.appreciation_occasions%rowtype;
  v_action_kind text;
  v_action_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
      p_tenant_id, 'appreciation.manage', 'tenant', p_tenant_id)
    or p_budget_cents < 0 then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'create_appreciation_action', p_idempotency_key,
    jsonb_build_object('occasion_id', p_occasion_id, 'owner_person_id', p_owner_person_id,
      'due_at', p_due_at, 'budget_cents', p_budget_cents)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  select * into v_occasion from app.appreciation_occasions
  where tenant_id = p_tenant_id and id = p_occasion_id;
  select rule.action_kind into v_action_kind from app.appreciation_rules as rule
  where rule.tenant_id = p_tenant_id and rule.id = v_occasion.rule_id;
  if v_occasion.id is null or not exists (
    select 1 from app.persons where tenant_id = p_tenant_id and id = p_owner_person_id
  ) then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  insert into app.appreciation_actions (
    id, tenant_id, occasion_id, action_kind, owner_person_id,
    due_at, budget_cents, created_by_auth_user_id, idempotency_key
  ) values (
    v_action_id, p_tenant_id, p_occasion_id, v_action_kind, p_owner_person_id,
    p_due_at, p_budget_cents, v_actor, p_idempotency_key
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'appreciation_action', v_action_id, 1,
    'appreciation.action_created', jsonb_build_object('occasion_id', p_occasion_id)
  );
  v_result := jsonb_build_object('resource_id', v_action_id, 'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('occasion_id', p_occasion_id, 'action_kind', v_action_kind));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_action_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.create_appreciation_action(uuid, uuid, uuid, timestamptz, integer, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.create_appreciation_action(uuid, uuid, uuid, timestamptz, integer, uuid)
  from public, anon, service_role;
grant execute on function internal.create_appreciation_action(uuid, uuid, uuid, timestamptz, integer, uuid)
  to authenticated;

create or replace function api.create_appreciation_action(
  p_tenant_id uuid, p_occasion_id uuid, p_owner_person_id uuid,
  p_due_at timestamptz, p_budget_cents integer, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.create_appreciation_action(
    p_tenant_id, p_occasion_id, p_owner_person_id,
    p_due_at, p_budget_cents, p_idempotency_key
  );
$function$;
revoke execute on function api.create_appreciation_action(uuid, uuid, uuid, timestamptz, integer, uuid)
  from public, anon, service_role;
grant execute on function api.create_appreciation_action(uuid, uuid, uuid, timestamptz, integer, uuid)
  to authenticated;

create or replace function internal.close_season(
  p_tenant_id uuid,
  p_season_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_season app.seasons%rowtype;
  v_close_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_blockers jsonb := '[]'::jsonb;
  v_check jsonb;
  v_snapshot_count integer;
  v_new_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
      p_tenant_id, 'season.close', 'tenant', p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'close_season', p_idempotency_key,
    jsonb_build_object('season_id', p_season_id, 'expected_version', p_expected_version)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  -- Lock every obligation in a deterministic order before the shared season
  -- ledger lock.  Attendance/correction commands already lock their single
  -- obligation before their ledger insert, so this ordering avoids a cycle
  -- while making the snapshot and the ledger append mutually exclusive.
  perform 1
  from app.obligations as obligation
  where obligation.tenant_id = p_tenant_id
    and obligation.season_id = p_season_id
  order by obligation.id
  for update;
  perform internal.lock_season_ledger(p_tenant_id, p_season_id);

  select * into v_season from app.seasons
  where tenant_id = p_tenant_id and id = p_season_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if v_season.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_season.status not in ('active', 'closing') then
    raise exception using errcode = '23514', message = 'SEASON_NOT_CLOSABLE';
  end if;
  if exists (
    select 1 from app.hour_disputes as dispute
    join app.obligations as obligation
      on obligation.tenant_id = dispute.tenant_id and obligation.id = dispute.obligation_id
    where obligation.tenant_id = p_tenant_id and obligation.season_id = p_season_id
      and dispute.state in ('open', 'in_review')
  ) then v_blockers := v_blockers || jsonb_build_array('OPEN_HOUR_DISPUTE'); end if;
  if exists (
    select 1 from app.exception_cases as exception_case
    join app.obligations as obligation
      on obligation.tenant_id = exception_case.tenant_id and obligation.id = exception_case.obligation_id
    where obligation.tenant_id = p_tenant_id and obligation.season_id = p_season_id
      and exception_case.state in ('submitted', 'in_review', 'escalated')
  ) then v_blockers := v_blockers || jsonb_build_array('OPEN_EXCEPTION'); end if;
  if exists (
    select 1 from app.appointment_review_cases as review_case
    join app.obligations as obligation
      on obligation.tenant_id = review_case.tenant_id and obligation.id = review_case.obligation_id
    where obligation.tenant_id = p_tenant_id and obligation.season_id = p_season_id
      and review_case.state = 'open'
  ) then v_blockers := v_blockers || jsonb_build_array('OPEN_APPOINTMENT_REVIEW'); end if;
  if exists (
    select 1
    from app.bookings as booking
    join app.obligations as obligation
      on obligation.tenant_id = booking.tenant_id
     and obligation.id = booking.obligation_id
    where obligation.tenant_id = p_tenant_id
      and obligation.season_id = p_season_id
      and booking.current_attendance_decision_id is null
      and booking.state not in ('cancelled', 'transferred')
      and (
        booking.state = 'performed_pending'
        or booking.ends_at_snapshot <= statement_timestamp()
      )
  ) then v_blockers := v_blockers || jsonb_build_array('PENDING_ATTENDANCE'); end if;
  if exists (
    select 1 from app.financial_assessments
    where tenant_id = p_tenant_id and season_id = p_season_id
      and state in ('draft', 'committee_approved', 'reassessment_required')
  ) then v_blockers := v_blockers || jsonb_build_array('OPEN_FINANCIAL_PROCESSING'); end if;
  if jsonb_array_length(v_blockers) > 0 then
    raise exception using errcode = 'P0001', message = 'SEASON_CLOSE_BLOCKED';
  end if;

  v_check := jsonb_build_object('blockers', v_blockers, 'checked_at', statement_timestamp());
  insert into app.season_close_runs (
    id, tenant_id, season_id, check_result, check_hash,
    closed_by_auth_user_id, idempotency_key
  ) values (
    v_close_id, p_tenant_id, p_season_id, v_check,
    extensions.digest(convert_to(v_check::text, 'UTF8'), 'sha256'),
    v_actor, p_idempotency_key
  );

  insert into app.season_snapshots (
    tenant_id, close_run_id, season_id, obligation_id, household_id,
    base_target_minutes, effective_target_minutes, effective_winter_minutes,
    confirmed_minutes, extra_minutes, obligation_status,
    coverage_manifest, decision_manifest, financial_manifest, ledger_hash
  )
  select
    obligation.tenant_id, v_close_id, obligation.season_id, obligation.id,
    obligation.assessed_household_id, obligation.base_target_minutes,
    obligation.effective_target_minutes, obligation.effective_winter_minutes,
    greatest(0, coalesce(ledger.confirmed_minutes, 0)),
    greatest(0, greatest(0, coalesce(ledger.confirmed_minutes, 0)) - obligation.effective_target_minutes),
    obligation.status,
    coalesce((select jsonb_agg(jsonb_build_object('id', coverage.id, 'effect', coverage.effect,
      'revision', coverage.decision_revision) order by coverage.created_at)
      from app.obligation_coverage_decisions as coverage
      where coverage.tenant_id = obligation.tenant_id and coverage.obligation_id = obligation.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', decision.id, 'outcome', decision.outcome,
      'route', decision.financial_route) order by decision.decided_at)
      from app.exception_decisions as decision
      where decision.tenant_id = obligation.tenant_id and decision.obligation_id = obligation.id), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', assessment.id, 'route', assessment.route,
      'state', assessment.state, 'revision', assessment.current_revision) order by assessment.created_at)
      from app.financial_assessments as assessment
      where assessment.tenant_id = obligation.tenant_id and assessment.obligation_id = obligation.id), '[]'::jsonb),
    extensions.digest(convert_to(coalesce(ledger.ledger_basis, ''), 'UTF8'), 'sha256')
  from app.obligations as obligation
  left join lateral (
    select sum(entry.minutes_delta)::integer as confirmed_minutes,
      string_agg(entry.id::text || ':' || entry.minutes_delta::text, ',' order by entry.id) as ledger_basis
    from app.hour_ledger_entries as entry
    where entry.tenant_id = obligation.tenant_id and entry.obligation_id = obligation.id
  ) as ledger on true
  where obligation.tenant_id = p_tenant_id and obligation.season_id = p_season_id;
  get diagnostics v_snapshot_count = row_count;

  update app.obligations as obligation
  set status = 'closed', updated_at = statement_timestamp(), version = obligation.version + 1
  where obligation.tenant_id = p_tenant_id and obligation.season_id = p_season_id;
  update app.seasons as season
  set status = 'closed', updated_at = statement_timestamp(), version = season.version + 1
  where season.tenant_id = p_tenant_id and season.id = p_season_id
  returning season.version into v_new_version;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'season.closed', 'season', p_season_id,
    'controlled_close', p_idempotency_key,
    jsonb_build_object('close_run_id', v_close_id, 'snapshot_count', v_snapshot_count)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'season', p_season_id, v_new_version,
    'season.closed', jsonb_build_object('close_run_id', v_close_id)
  );
  v_result := jsonb_build_object('resource_id', v_close_id, 'version', v_new_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('snapshot_count', v_snapshot_count, 'state', 'closed'));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_close_id, v_new_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.close_season(uuid, uuid, bigint, uuid) owner to cluvo_command_owner;
revoke execute on function internal.close_season(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.close_season(uuid, uuid, bigint, uuid) to authenticated;

create or replace function api.close_season(
  p_tenant_id uuid, p_season_id uuid, p_expected_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.close_season(p_tenant_id, p_season_id, p_expected_version, p_idempotency_key);
$function$;
revoke execute on function api.close_season(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.close_season(uuid, uuid, bigint, uuid) to authenticated;

create or replace function internal.rollover_season(
  p_tenant_id uuid,
  p_source_season_id uuid,
  p_target_season_id uuid,
  p_selected_template_keys text[],
  p_expected_target_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_claim record;
  v_source app.seasons%rowtype;
  v_target app.seasons%rowtype;
  v_rollover_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_obligation_count integer;
  v_reconfirmation_count integer;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
      p_tenant_id, 'season.rollover', 'tenant', p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_claim from internal.claim_idempotency(
    p_tenant_id, 'rollover_season', p_idempotency_key,
    jsonb_build_object('source_season_id', p_source_season_id,
      'target_season_id', p_target_season_id,
      'selected_template_keys', coalesce(to_jsonb(p_selected_template_keys), '[]'::jsonb),
      'expected_target_version', p_expected_target_version)
  );
  if v_claim.replay_result is not null then
    return query select true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  select * into v_source from app.seasons
  where tenant_id = p_tenant_id and id = p_source_season_id for update;
  select * into v_target from app.seasons
  where tenant_id = p_tenant_id and id = p_target_season_id for update;
  if v_source.id is null or v_target.id is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_source.status <> 'closed' or v_target.status <> 'preparing'
    or v_target.version <> p_expected_target_version
    or v_target.starts_on <= v_source.ends_on
    or not exists (
      select 1 from app.season_close_runs
      where tenant_id = p_tenant_id and season_id = p_source_season_id
    ) then
    raise exception using errcode = '23514', message = 'ROLLOVER_PRECONDITION_FAILED';
  end if;

  insert into app.rollover_runs (
    id, tenant_id, source_season_id, target_season_id,
    selected_template_keys, created_by_auth_user_id, idempotency_key
  ) values (
    v_rollover_id, p_tenant_id, p_source_season_id, p_target_season_id,
    coalesce(p_selected_template_keys, '{}'::text[]), v_actor, p_idempotency_key
  );
  insert into app.rollover_template_selections (tenant_id, rollover_run_id, template_key)
  select p_tenant_id, v_rollover_id, key
  from (select distinct unnest(coalesce(p_selected_template_keys, '{}'::text[])) as key) as keys
  where nullif(btrim(key), '') is not null;

  insert into app.obligations (
    tenant_id, season_id, assessed_household_id, base_target_minutes,
    effective_target_minutes, effective_winter_minutes, status
  )
  select p_tenant_id, p_target_season_id, snapshot.household_id,
    v_target.target_minutes, v_target.target_minutes, v_target.winter_target_minutes, 'preparing'
  from app.season_snapshots as snapshot
  where snapshot.tenant_id = p_tenant_id and snapshot.season_id = p_source_season_id
  on conflict do nothing;
  get diagnostics v_obligation_count = row_count;

  insert into app.household_obligation_links (
    tenant_id, household_id, obligation_id, link_kind, starts_at
  )
  select obligation.tenant_id, obligation.assessed_household_id, obligation.id,
    'liable', v_target.starts_on::timestamptz
  from app.obligations as obligation
  where obligation.tenant_id = p_tenant_id and obligation.season_id = p_target_season_id
  on conflict do nothing;

  insert into app.season_reconfirmation_items (
    tenant_id, rollover_run_id, target_season_id, subject_kind, person_id, source_resource_id
  )
  select distinct p_tenant_id, v_rollover_id, p_target_season_id,
    'intake', profile.person_id, profile.id
  from app.intake_profiles as profile
  join app.season_snapshots as snapshot
    on snapshot.tenant_id = profile.tenant_id and snapshot.household_id = profile.household_context_id
  where profile.tenant_id = p_tenant_id and snapshot.season_id = p_source_season_id
  on conflict do nothing;

  insert into app.season_reconfirmation_items (
    tenant_id, rollover_run_id, target_season_id, subject_kind, person_id, source_resource_id
  )
  select p_tenant_id, v_rollover_id, p_target_season_id,
    'volunteer_appointment', appointment.person_id, appointment.id
  from app.volunteer_appointments as appointment
  join app.obligations as obligation
    on obligation.tenant_id = appointment.tenant_id and obligation.id = appointment.obligation_id
  where appointment.tenant_id = p_tenant_id
    and obligation.season_id = p_source_season_id
    and appointment.status = 'recognized'
  on conflict do nothing;

  select count(*)::integer into v_reconfirmation_count
  from app.season_reconfirmation_items
  where tenant_id = p_tenant_id and rollover_run_id = v_rollover_id;
  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'season.rolled_over', 'rollover_run', v_rollover_id,
    'controlled_rollover', p_idempotency_key,
    jsonb_build_object('source_season_id', p_source_season_id,
      'target_season_id', p_target_season_id, 'obligation_count', v_obligation_count,
      'reconfirmation_count', v_reconfirmation_count)
  );
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'rollover_run', v_rollover_id, 1,
    'season.rolled_over', jsonb_build_object('target_season_id', p_target_season_id)
  );
  v_result := jsonb_build_object('resource_id', v_rollover_id, 'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('obligation_count', v_obligation_count,
      'reconfirmation_count', v_reconfirmation_count));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_rollover_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.rollover_season(uuid, uuid, uuid, text[], bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.rollover_season(uuid, uuid, uuid, text[], bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.rollover_season(uuid, uuid, uuid, text[], bigint, uuid)
  to authenticated;

create or replace function api.rollover_season(
  p_tenant_id uuid, p_source_season_id uuid, p_target_season_id uuid,
  p_selected_template_keys text[], p_expected_target_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.rollover_season(
    p_tenant_id, p_source_season_id, p_target_season_id,
    p_selected_template_keys, p_expected_target_version, p_idempotency_key
  );
$function$;
revoke execute on function api.rollover_season(uuid, uuid, uuid, text[], bigint, uuid)
  from public, anon, service_role;
grant execute on function api.rollover_season(uuid, uuid, uuid, text[], bigint, uuid)
  to authenticated;






