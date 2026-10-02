-- Cluvo WP1/WP2/core vertical slice.
-- Canon basis: tenant isolation, explicit dossier rights, immutable intake
-- revisions, atomic bookings, attendance decisions, and append-only minutes.

create schema if not exists app;
create schema if not exists api;
create schema if not exists internal;

comment on schema app is 'Unexposed Cluvo domain relations. RLS remains enabled as defence in depth.';
comment on schema api is 'Only schema exposed through the Supabase Data API.';
comment on schema internal is 'Unexposed authorization helpers and atomic domain commands.';

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'cluvo_command_owner') then
    create role cluvo_command_owner
      nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
  end if;
end
$roles$;

-- Supabase migrations run as the non-superuser `postgres` role. PostgreSQL
-- requires explicit role membership before that role can transfer ownership.
grant cluvo_command_owner to postgres;

revoke all on schema app, api, internal from public, anon, authenticated;
grant usage on schema app, api, internal to cluvo_command_owner;
grant create on schema internal to cluvo_command_owner;
grant usage on schema extensions to cluvo_command_owner;
grant execute on function extensions.digest(bytea, text) to cluvo_command_owner;
grant usage on schema api to anon, authenticated;
grant usage on schema app, internal to authenticated;

alter default privileges for role postgres in schema app
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema app
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema api
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema internal
  revoke execute on functions from public, anon, authenticated, service_role;

create table app.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  timezone text not null default 'Europe/Amsterdam',
  locale text not null default 'nl-NL',
  status text not null default 'active'
    check (status in ('preparing', 'active', 'suspended', 'archived')),
  branding_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(branding_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table app.tenant_settings_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  revision integer not null check (revision > 0),
  effective_from timestamptz not null,
  cancellation_minutes integer not null default 2880 check (cancellation_minutes >= 0),
  confirmation_days integer not null default 7 check (confirmation_days between 1 and 365),
  dispute_days integer not null default 14 check (dispute_days between 1 and 365),
  approved_by_auth_user_id uuid not null,
  published_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, revision),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.account_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  locale text not null default 'nl-NL',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0)
);

create table app.persons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  given_name text not null,
  family_name text not null,
  birth_date date,
  birth_date_precision text not null default 'unknown'
    check (birth_date_precision in ('day', 'month', 'year', 'unknown')),
  membership_started_on date,
  status text not null default 'active'
    check (status in ('invited', 'active', 'inactive', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  check ((birth_date is null) = (birth_date_precision = 'unknown'))
);

create table app.person_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  kind text not null check (kind in ('email', 'phone')),
  value text not null,
  verified_at timestamptz,
  visibility_scope text not null default 'self'
    check (visibility_scope in ('self', 'household_contacts', 'case_workers')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict
);

create table app.account_person_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  auth_user_id uuid not null,
  person_id uuid not null,
  relationship text not null default 'self' check (relationship = 'self'),
  verified_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (auth_user_id) references auth.users(id) on delete restrict,
  check (revoked_at is null or revoked_at >= verified_at)
);

create unique index account_person_links_active_account_uq
  on app.account_person_links (tenant_id, auth_user_id)
  where revoked_at is null;
create unique index account_person_links_active_person_uq
  on app.account_person_links (tenant_id, person_id)
  where revoked_at is null;

create table app.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  auth_user_id uuid not null,
  status text not null default 'active'
    check (status in ('invited', 'active', 'blocked', 'ended')),
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  foreign key (auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);

create unique index tenant_memberships_one_active_uq
  on app.tenant_memberships (tenant_id, auth_user_id)
  where status = 'active';
create index tenant_memberships_actor_idx
  on app.tenant_memberships (auth_user_id, tenant_id)
  where status = 'active';

create table app.permissions (
  permission_key text primary key,
  description text not null,
  created_at timestamptz not null default statement_timestamp(),
  check (permission_key ~ '^[a-z][a-z0-9_.]*$')
);

create table app.permission_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role_key text not null,
  name text not null,
  description text,
  system_role boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, role_key),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  check (role_key ~ '^[a-z][a-z0-9_]*$')
);

create table app.role_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  role_id uuid not null,
  permission_key text not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, role_id, permission_key),
  foreign key (tenant_id, role_id) references app.permission_roles(tenant_id, id) on delete restrict,
  foreign key (permission_key) references app.permissions(permission_key) on delete restrict
);

create table app.committees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  slug text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, slug),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.households (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  label text not null,
  intake_code_hash bytea not null,
  intake_code_hint text,
  separated_parents boolean not null default false,
  status text not null default 'active'
    check (status in ('preparing', 'active', 'review_hold', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, intake_code_hash),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.household_person_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  household_id uuid not null,
  person_id uuid not null,
  kind text not null check (kind in ('member', 'parent', 'guardian', 'executor')),
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  verified_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (verified_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);

create unique index household_person_links_current_uq
  on app.household_person_links (tenant_id, household_id, person_id, kind)
  where ends_at is null;

create table app.household_access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  household_id uuid not null,
  auth_user_id uuid not null,
  can_view_progress boolean not null default false,
  can_manage_contacts boolean not null default false,
  can_invite_executor boolean not null default false,
  can_book_for boolean not null default false,
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  revoked_at timestamptz,
  granted_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (auth_user_id) references auth.users(id) on delete restrict,
  foreign key (granted_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at is null or ends_at > starts_at),
  check (revoked_at is null or revoked_at >= starts_at)
);

create unique index household_access_grants_current_uq
  on app.household_access_grants (tenant_id, household_id, auth_user_id)
  where revoked_at is null and ends_at is null;
create index household_access_grants_actor_idx
  on app.household_access_grants (auth_user_id, tenant_id, household_id)
  where revoked_at is null;

create table app.access_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  auth_user_id uuid not null,
  role_id uuid not null,
  scope_kind text not null check (scope_kind in ('tenant', 'committee', 'team', 'household')),
  committee_id uuid,
  team_id uuid,
  household_id uuid,
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  revoked_at timestamptz,
  granted_by_auth_user_id uuid not null,
  renewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, role_id) references app.permission_roles(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (auth_user_id) references auth.users(id) on delete restrict,
  foreign key (granted_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at is null or ends_at > starts_at),
  check (revoked_at is null or revoked_at >= starts_at),
  check (
    (scope_kind = 'tenant' and num_nonnulls(committee_id, team_id, household_id) = 0)
    or (scope_kind = 'committee' and committee_id is not null and num_nonnulls(team_id, household_id) = 0)
    or (scope_kind = 'team' and team_id is not null and num_nonnulls(committee_id, household_id) = 0)
    or (scope_kind = 'household' and household_id is not null and num_nonnulls(committee_id, team_id) = 0)
  )
);

create index access_grants_actor_idx
  on app.access_grants (auth_user_id, tenant_id, role_id)
  where revoked_at is null;

create table app.acting_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_auth_user_id uuid not null,
  represented_person_id uuid not null,
  household_id uuid,
  scope text not null check (scope in ('intake_assistance', 'book_shift')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  evidence_ref text,
  granted_by_auth_user_id uuid not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, represented_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (granted_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at is null or ends_at > starts_at),
  check (revoked_at is null or revoked_at >= starts_at)
);

create index acting_delegations_actor_idx
  on app.acting_delegations (actor_auth_user_id, tenant_id, represented_person_id, scope)
  where revoked_at is null;

create table app.guardian_authorizations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  guardian_person_id uuid not null,
  represented_member_id uuid not null,
  scope text not null check (scope in ('policy_acceptance', 'intake_assistance')),
  valid_from timestamptz not null,
  valid_until timestamptz,
  verified_by_auth_user_id uuid not null,
  evidence_ref text,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, guardian_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, represented_member_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (verified_by_auth_user_id) references auth.users(id) on delete restrict,
  check (guardian_person_id <> represented_member_id),
  check (valid_until is null or valid_until > valid_from)
);

create table app.household_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  household_id uuid not null,
  invited_email_hash bytea not null,
  invited_person_id uuid,
  token_hash bytea not null unique,
  can_view_progress boolean not null default false,
  can_manage_contacts boolean not null default false,
  can_invite_executor boolean not null default false,
  can_book_for boolean not null default false,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_auth_user_id uuid,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, invited_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (accepted_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((accepted_at is null) = (accepted_by_auth_user_id is null)),
  check (expires_at > created_at)
);

create table app.intake_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  household_context_id uuid not null,
  annual_confirmed_at timestamptz,
  desired_minutes integer check (desired_minutes is null or desired_minutes >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'confirmed', 'archived')),
  current_revision integer not null default 0 check (current_revision >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, person_id, household_context_id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, household_context_id) references app.households(tenant_id, id) on delete restrict
);

create table app.intake_answers_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  profile_id uuid not null,
  revision integer not null check (revision > 0),
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  authored_by_auth_user_id uuid not null,
  represented_person_id uuid,
  assistance_reason text,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, profile_id, revision),
  foreign key (tenant_id, profile_id) references app.intake_profiles(tenant_id, id) on delete restrict,
  foreign key (tenant_id, represented_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (authored_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((represented_person_id is null) = (assistance_reason is null))
);

create table app.seasons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  winter_cutoff_at timestamptz not null,
  target_minutes integer not null default 720 check (target_minutes >= 0),
  winter_target_minutes integer not null default 360 check (winter_target_minutes >= 0),
  status text not null default 'preparing'
    check (status in ('preparing', 'active', 'closing', 'closed')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, name),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  check (ends_on > starts_on),
  check (winter_target_minutes <= target_minutes)
);

create table app.obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  season_id uuid not null,
  assessed_household_id uuid not null,
  base_target_minutes integer not null check (base_target_minutes >= 0),
  effective_target_minutes integer not null check (effective_target_minutes >= 0),
  effective_winter_minutes integer not null check (effective_winter_minutes >= 0),
  status text not null default 'active'
    check (status in ('preparing', 'active', 'review_hold', 'fulfilled', 'closed')),
  ledger_revision bigint not null default 0 check (ledger_revision >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, id, season_id),
  foreign key (tenant_id, season_id) references app.seasons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, assessed_household_id) references app.households(tenant_id, id) on delete restrict,
  check (effective_winter_minutes <= effective_target_minutes)
);

create unique index obligations_active_household_season_uq
  on app.obligations (tenant_id, season_id, assessed_household_id)
  where status in ('preparing', 'active', 'review_hold', 'fulfilled');

create table app.household_obligation_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  household_id uuid not null,
  obligation_id uuid not null,
  link_kind text not null check (link_kind in ('liable', 'contributor', 'progress_only')),
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  decision_ref uuid,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, household_id) references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);

create unique index household_obligation_one_current_liable_uq
  on app.household_obligation_links (tenant_id, obligation_id)
  where link_kind = 'liable' and ends_at is null;
create unique index household_obligation_current_link_uq
  on app.household_obligation_links (tenant_id, household_id, obligation_id, link_kind)
  where ends_at is null;

create table app.executor_obligation_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  obligation_id uuid not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  approved_by_auth_user_id uuid not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict,
  check (valid_until is null or valid_until > valid_from),
  check (revoked_at is null or revoked_at >= valid_from)
);

create unique index executor_obligation_grants_current_uq
  on app.executor_obligation_grants (tenant_id, person_id, obligation_id)
  where revoked_at is null and valid_until is null;
create index executor_obligation_grants_lookup_idx
  on app.executor_obligation_grants (tenant_id, person_id, obligation_id, valid_from, valid_until)
  where revoked_at is null;

create table app.task_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  committee_id uuid not null,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, committee_id, name),
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict
);

create table app.task_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  category_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, category_id, name),
  foreign key (tenant_id, category_id) references app.task_categories(tenant_id, id) on delete restrict
);

create table app.task_type_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  task_type_id uuid not null,
  revision integer not null check (revision > 0),
  credit_minutes integer not null check (credit_minutes >= 0),
  cancellation_minutes_override integer check (cancellation_minutes_override is null or cancellation_minutes_override >= 0),
  requirements_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(requirements_json) = 'object'),
  approved_by_auth_user_id uuid not null,
  published_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, task_type_id, revision),
  foreign key (tenant_id, task_type_id) references app.task_types(tenant_id, id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

create table app.qualification_types (
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

create table app.person_qualifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  qualification_type_id uuid not null,
  achieved_at timestamptz not null,
  expires_at timestamptz,
  verified_by_auth_user_id uuid not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, qualification_type_id) references app.qualification_types(tenant_id, id) on delete restrict,
  foreign key (verified_by_auth_user_id) references auth.users(id) on delete restrict,
  check (expires_at is null or expires_at > achieved_at)
);

create index person_qualifications_validity_idx
  on app.person_qualifications (tenant_id, person_id, qualification_type_id, achieved_at, expires_at)
  where revoked_at is null;

create table app.unavailability_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  private_note text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  check (ends_at > starts_at)
);

create index unavailability_periods_person_time_idx
  on app.unavailability_periods (tenant_id, person_id, starts_at, ends_at);

create table app.shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  type_version_id uuid not null,
  committee_id uuid not null,
  category_id uuid not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id uuid,
  credit_minutes integer not null check (credit_minutes >= 0),
  cancellation_minutes integer not null check (cancellation_minutes >= 0),
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  state text not null default 'draft'
    check (state in ('draft', 'published', 'cancelled', 'completed')),
  published_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, type_version_id) references app.task_type_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, category_id) references app.task_categories(tenant_id, id) on delete restrict,
  foreign key (tenant_id, location_id) references app.locations(tenant_id, id) on delete restrict,
  check (ends_at > starts_at),
  check (booking_closes_at is null or booking_opens_at is null or booking_closes_at > booking_opens_at),
  check ((state <> 'published') or published_at is not null)
);

create index shifts_committee_starts_idx
  on app.shifts (tenant_id, committee_id, starts_at);

create table app.shift_positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  shift_id uuid not null,
  ordinal integer not null check (ordinal > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state text not null default 'open' check (state in ('open', 'held', 'closed', 'cancelled')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, shift_id, ordinal),
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict,
  check (ends_at > starts_at)
);

create table app.shift_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  shift_id uuid not null,
  minimum_age integer check (minimum_age between 0 and 120),
  qualification_type_id uuid,
  min_qualified_count integer not null default 0 check (min_qualified_count >= 0),
  buddy_allowed boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, shift_id),
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, qualification_type_id) references app.qualification_types(tenant_id, id) on delete restrict
);

create table app.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  position_id uuid not null,
  executor_person_id uuid not null,
  obligation_id uuid not null,
  state text not null default 'booked'
    check (state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending', 'confirmed', 'cancelled', 'transferred', 'no_show')),
  booked_by_auth_user_id uuid not null,
  starts_at_snapshot timestamptz not null,
  ends_at_snapshot timestamptz not null,
  pending_starts_at timestamptz,
  pending_ends_at timestamptz,
  credit_minutes_snapshot integer not null check (credit_minutes_snapshot >= 0),
  cancellation_deadline_snapshot timestamptz not null,
  task_version_snapshot uuid not null,
  current_attendance_decision_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  foreign key (tenant_id, position_id) references app.shift_positions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, executor_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, task_version_snapshot) references app.task_type_versions(tenant_id, id) on delete restrict,
  foreign key (booked_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at_snapshot > starts_at_snapshot),
  check ((pending_starts_at is null) = (pending_ends_at is null)),
  check (pending_ends_at is null or pending_ends_at > pending_starts_at)
);

create unique index bookings_active_position_uq
  on app.bookings (tenant_id, position_id)
  where state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending');

alter table app.bookings
  add constraint bookings_executor_no_overlap_excl
  exclude using gist (
    tenant_id with =,
    executor_person_id with =,
    tstzrange(
      coalesce(pending_starts_at, starts_at_snapshot),
      coalesce(pending_ends_at, ends_at_snapshot),
      '[)'
    ) with &&
  ) where (state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending'));

create index bookings_obligation_state_idx
  on app.bookings (tenant_id, obligation_id, state, starts_at_snapshot);

create table app.booking_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  booking_id uuid not null,
  event_type text not null,
  actor_auth_user_id uuid not null,
  represented_person_id uuid,
  reason_code text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, represented_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict
);

create table app.attendance_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  booking_id uuid not null,
  decision_revision integer not null check (decision_revision > 0),
  result text not null check (result in ('present', 'partial', 'no_show', 'club_cancelled')),
  awarded_minutes integer not null check (awarded_minutes >= 0),
  confirmed_by_auth_user_id uuid not null,
  reason text,
  previous_decision_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, id, booking_id),
  unique (tenant_id, booking_id, decision_revision),
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, previous_decision_id) references app.attendance_decisions(tenant_id, id) on delete restrict,
  foreign key (confirmed_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((decision_revision = 1) = (previous_decision_id is null)),
  check ((result in ('partial', 'club_cancelled')) = (reason is not null))
);

alter table app.bookings
  add constraint bookings_current_attendance_decision_fk
  foreign key (tenant_id, current_attendance_decision_id, id)
  references app.attendance_decisions(tenant_id, id, booking_id)
  on delete restrict;

create table app.hour_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  obligation_id uuid not null,
  season_id uuid not null,
  booking_id uuid,
  attendance_decision_id uuid,
  entry_kind text not null check (entry_kind in ('award', 'reversal', 'replacement')),
  minutes_delta integer not null,
  performed_at timestamptz not null,
  posted_at timestamptz not null default statement_timestamp(),
  actor_auth_user_id uuid not null,
  reverses_entry_id uuid,
  correction_reason text,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, reverses_entry_id),
  foreign key (tenant_id, obligation_id, season_id) references app.obligations(tenant_id, id, season_id) on delete restrict,
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, attendance_decision_id, booking_id)
    references app.attendance_decisions(tenant_id, id, booking_id) on delete restrict,
  foreign key (tenant_id, reverses_entry_id) references app.hour_ledger_entries(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check (num_nonnulls(booking_id, attendance_decision_id) in (0, 2)),
  check (
    (entry_kind = 'award' and minutes_delta >= 0 and reverses_entry_id is null and correction_reason is null)
    or (entry_kind = 'reversal' and minutes_delta <= 0 and reverses_entry_id is not null and correction_reason is not null)
    or (entry_kind = 'replacement' and minutes_delta >= 0 and reverses_entry_id is null and correction_reason is not null)
  )
);

create index hour_ledger_entries_obligation_performed_idx
  on app.hour_ledger_entries (tenant_id, obligation_id, performed_at);

create table app.hour_disputes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  booking_id uuid,
  ledger_entry_id uuid,
  obligation_id uuid not null,
  opened_by_auth_user_id uuid not null,
  description text not null,
  state text not null default 'open' check (state in ('open', 'in_review', 'resolved', 'rejected')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, booking_id) references app.bookings(tenant_id, id) on delete restrict,
  foreign key (tenant_id, ledger_entry_id) references app.hour_ledger_entries(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id) references app.obligations(tenant_id, id) on delete restrict,
  foreign key (opened_by_auth_user_id) references auth.users(id) on delete restrict,
  check (num_nonnulls(booking_id, ledger_entry_id) >= 1)
);

create table app.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_auth_user_id uuid not null,
  operation text not null,
  idempotency_key uuid not null,
  request_hash bytea not null,
  status text not null check (status in ('processing', 'completed')),
  result_jsonb jsonb,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, actor_auth_user_id, operation, idempotency_key),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null and result_jsonb is not null))
);

create table app.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_auth_user_id uuid not null,
  represented_person_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  scope_kind text,
  scope_id uuid,
  reason_code text,
  idempotency_key uuid,
  payload_minimal jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_minimal) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  foreign key (tenant_id, represented_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check ((scope_kind is null) = (scope_id is null))
);

create index audit_events_resource_idx
  on app.audit_events (tenant_id, resource_type, resource_id, occurred_at);

create table app.domain_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  aggregate_version bigint not null check (aggregate_version > 0),
  event_type text not null,
  payload_minimal jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_minimal) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type),
  foreign key (tenant_id) references app.tenants(id) on delete restrict
);

insert into app.permissions (permission_key, description) values
  ('organization.manage', 'Manage tenant organization configuration'),
  ('household.view', 'Read an explicitly scoped household dossier'),
  ('household.progress.view', 'Read reduced household progress'),
  ('household.invite_executor', 'Invite an executor into an explicitly scoped household'),
  ('household.review', 'Review household and obligation cases'),
  ('intake.assist', 'Author an intake revision under an explicit delegation'),
  ('shift.view', 'Read shifts in the granted scope'),
  ('shift.manage', 'Create and manage shifts in the granted scope'),
  ('shift.book', 'Book an authorized executor'),
  ('attendance.confirm', 'Confirm attendance in the granted committee scope'),
  ('finance.process', 'Process an already approved financial assessment')
on conflict (permission_key) do nothing;

grant select on all tables in schema app to cluvo_command_owner;
grant insert, update on
  app.permission_roles,
  app.role_permissions,
  app.intake_profiles,
  app.bookings,
  app.obligations,
  app.idempotency_records
to cluvo_command_owner;
-- PostgreSQL requires an UPDATE privilege for SELECT ... FOR UPDATE even when
-- the command only locks these validation rows. Limit that capability to the
-- ubiquitous timestamp column; no command receives a broad direct write grant.
grant update (updated_at) on app.persons to cluvo_command_owner;
grant update (updated_at) on app.shifts to cluvo_command_owner;
grant update (updated_at) on app.shift_positions to cluvo_command_owner;
grant insert on
  app.intake_answers_versions,
  app.booking_events,
  app.attendance_decisions,
  app.hour_ledger_entries,
  app.audit_events,
  app.domain_events
to cluvo_command_owner;

do $rls$
declare
  relation_name text;
begin
  for relation_name in
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'app'
    order by tablename
  loop
    execute format('alter table app.%I enable row level security', relation_name);
    execute format('alter table app.%I force row level security', relation_name);
    execute format(
      'create policy command_owner_select on app.%I for select to cluvo_command_owner using (true)',
      relation_name
    );
  end loop;
end
$rls$;

do $command_policies$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'permission_roles', 'role_permissions', 'intake_profiles',
    'intake_answers_versions', 'bookings', 'booking_events',
    'attendance_decisions', 'hour_ledger_entries', 'obligations',
    'idempotency_records', 'audit_events', 'domain_events'
  ]
  loop
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
$command_policies$;

-- Row locks used by booking and attendance also pass through FORCE RLS. These
-- policies pair with the column-limited UPDATE grants above; they make rows
-- lockable without giving the owner an unrestricted table mutation grant.
create policy command_owner_lock_update on app.persons
  for update to cluvo_command_owner using (true) with check (true);
create policy command_owner_lock_update on app.shifts
  for update to cluvo_command_owner using (true) with check (true);
create policy command_owner_lock_update on app.shift_positions
  for update to cluvo_command_owner using (true) with check (true);

create or replace function internal.current_actor_uid()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
      ''
    )
  )::uuid;
$function$;

revoke execute on function internal.current_actor_uid()
  from public, anon, authenticated, service_role;
grant execute on function internal.current_actor_uid()
  to cluvo_command_owner;

-- Ledger writers and season close take the same transaction-scoped advisory
-- lock before locking mutable rows.  This closes the race where season close
-- could snapshot an obligation while a late attendance decision was waiting
-- to append minutes in another transaction.
create or replace function internal.lock_season_ledger(
  p_tenant_id uuid,
  p_season_id uuid
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $function$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::text || ':' || p_season_id::text,
      0
    )
  );
$function$;

alter function internal.lock_season_ledger(uuid, uuid) owner to cluvo_command_owner;
revoke execute on function internal.lock_season_ledger(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function internal.lock_season_ledger(uuid, uuid)
  to cluvo_command_owner;

create or replace function internal.is_active_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select internal.current_actor_uid()) is not null
    and exists (
      select 1
      from app.tenant_memberships as membership
      join app.tenants as tenant
        on tenant.id = membership.tenant_id
       and tenant.status = 'active'
      where membership.tenant_id = p_tenant_id
        and membership.auth_user_id = (select internal.current_actor_uid())
        and membership.status = 'active'
        and membership.starts_at <= statement_timestamp()
        and (membership.ends_at is null or membership.ends_at > statement_timestamp())
    );
$function$;

create or replace function internal.is_self_person(p_tenant_id uuid, p_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.is_active_member(p_tenant_id)
    and exists (
      select 1
      from app.account_person_links as link
      where link.tenant_id = p_tenant_id
        and link.person_id = p_person_id
        and link.auth_user_id = (select internal.current_actor_uid())
        and link.revoked_at is null
    );
$function$;

create or replace function internal.can_access_household(
  p_tenant_id uuid,
  p_household_id uuid,
  p_capability text default 'base'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.is_active_member(p_tenant_id)
    and p_capability in ('base', 'view_progress', 'manage_contacts', 'invite_executor', 'book_for')
    and exists (
      select 1
      from app.household_access_grants as grant_row
      where grant_row.tenant_id = p_tenant_id
        and grant_row.household_id = p_household_id
        and grant_row.auth_user_id = (select internal.current_actor_uid())
        and grant_row.starts_at <= statement_timestamp()
        and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
        and grant_row.revoked_at is null
        and case p_capability
          when 'base' then true
          when 'view_progress' then grant_row.can_view_progress
          when 'manage_contacts' then grant_row.can_manage_contacts
          when 'invite_executor' then grant_row.can_invite_executor
          when 'book_for' then grant_row.can_book_for
          else false
        end
    );
$function$;

create or replace function internal.has_permission(
  p_tenant_id uuid,
  p_permission_key text,
  p_scope_kind text,
  p_scope_id uuid
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
      from app.access_grants as grant_row
      join app.role_permissions as role_permission
        on role_permission.tenant_id = grant_row.tenant_id
       and role_permission.role_id = grant_row.role_id
      where grant_row.tenant_id = p_tenant_id
        and grant_row.auth_user_id = (select internal.current_actor_uid())
        and grant_row.starts_at <= statement_timestamp()
        and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
        and grant_row.revoked_at is null
        and role_permission.permission_key = p_permission_key
        and (
          grant_row.scope_kind = 'tenant'
          or (p_scope_kind = 'committee' and grant_row.scope_kind = 'committee' and grant_row.committee_id = p_scope_id)
          or (p_scope_kind = 'team' and grant_row.scope_kind = 'team' and grant_row.team_id = p_scope_id)
          or (p_scope_kind = 'household' and grant_row.scope_kind = 'household' and grant_row.household_id = p_scope_id)
        )
    );
$function$;

create or replace function internal.can_edit_intake(p_tenant_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.is_active_member(p_tenant_id)
    and exists (
      select 1
      from app.intake_profiles as profile
      where profile.tenant_id = p_tenant_id
        and profile.id = p_profile_id
        and (
          internal.is_self_person(p_tenant_id, profile.person_id)
          or exists (
            select 1
            from app.acting_delegations as delegation
            where delegation.tenant_id = p_tenant_id
              and delegation.actor_auth_user_id = (select internal.current_actor_uid())
              and delegation.represented_person_id = profile.person_id
              and delegation.household_id = profile.household_context_id
              and delegation.scope = 'intake_assistance'
              and delegation.starts_at <= statement_timestamp()
              and (delegation.ends_at is null or delegation.ends_at > statement_timestamp())
              and delegation.revoked_at is null
          )
        )
    );
$function$;

create or replace function internal.can_access_obligation_progress(
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
      where obligation_link.tenant_id = p_tenant_id
        and obligation_link.obligation_id = p_obligation_id
        and obligation_link.starts_at <= statement_timestamp()
        and (obligation_link.ends_at is null or obligation_link.ends_at > statement_timestamp())
        and (
          internal.can_access_household(p_tenant_id, obligation_link.household_id, 'view_progress')
          or internal.has_permission(
            p_tenant_id,
            'household.progress.view',
            'household',
            obligation_link.household_id
          )
        )
    );
$function$;

create or replace function internal.can_book_executor(
  p_tenant_id uuid,
  p_executor_person_id uuid,
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
      internal.is_self_person(p_tenant_id, p_executor_person_id)
      or exists (
        select 1
        from app.acting_delegations as delegation
        join app.household_person_links as person_link
          on person_link.tenant_id = delegation.tenant_id
         and person_link.household_id = delegation.household_id
         and person_link.person_id = delegation.represented_person_id
         and person_link.starts_at <= statement_timestamp()
         and (person_link.ends_at is null or person_link.ends_at > statement_timestamp())
        join app.household_obligation_links as obligation_link
          on obligation_link.tenant_id = delegation.tenant_id
         and obligation_link.household_id = delegation.household_id
         and obligation_link.obligation_id = p_obligation_id
         and obligation_link.starts_at <= statement_timestamp()
         and (obligation_link.ends_at is null or obligation_link.ends_at > statement_timestamp())
        where delegation.tenant_id = p_tenant_id
          and delegation.actor_auth_user_id = (select internal.current_actor_uid())
          and delegation.represented_person_id = p_executor_person_id
          and delegation.scope = 'book_shift'
          and delegation.starts_at <= statement_timestamp()
          and (delegation.ends_at is null or delegation.ends_at > statement_timestamp())
          and delegation.revoked_at is null
          and internal.can_access_household(p_tenant_id, delegation.household_id, 'book_for')
      )
    );
$function$;

alter function internal.is_active_member(uuid) owner to cluvo_command_owner;
alter function internal.is_self_person(uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_access_household(uuid, uuid, text) owner to cluvo_command_owner;
alter function internal.has_permission(uuid, text, text, uuid) owner to cluvo_command_owner;
alter function internal.can_edit_intake(uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_access_obligation_progress(uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_book_executor(uuid, uuid, uuid) owner to cluvo_command_owner;

revoke execute on function internal.is_active_member(uuid) from public, anon;
revoke execute on function internal.is_self_person(uuid, uuid) from public, anon;
revoke execute on function internal.can_access_household(uuid, uuid, text) from public, anon;
revoke execute on function internal.has_permission(uuid, text, text, uuid) from public, anon;
revoke execute on function internal.can_edit_intake(uuid, uuid) from public, anon;
revoke execute on function internal.can_access_obligation_progress(uuid, uuid) from public, anon;
revoke execute on function internal.can_book_executor(uuid, uuid, uuid) from public, anon;
grant execute on function internal.is_active_member(uuid) to authenticated;
grant execute on function internal.is_self_person(uuid, uuid) to authenticated;
grant execute on function internal.can_access_household(uuid, uuid, text) to authenticated;
grant execute on function internal.has_permission(uuid, text, text, uuid) to authenticated;
grant execute on function internal.can_edit_intake(uuid, uuid) to authenticated;
grant execute on function internal.can_access_obligation_progress(uuid, uuid) to authenticated;
grant execute on function internal.can_book_executor(uuid, uuid, uuid) to authenticated;

create policy anon_active_tenants on app.tenants
  for select to anon
  using (status = 'active');
create policy authenticated_member_tenants on app.tenants
  for select to authenticated
  using ((select internal.is_active_member(id)));

create policy own_account_profile on app.account_profiles
  for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy own_person on app.persons
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, id)));
create policy own_person_contacts on app.person_contacts
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, person_id)));
create policy own_account_person_links on app.account_person_links
  for select to authenticated
  using (auth_user_id = (select auth.uid()) and (select internal.is_active_member(tenant_id)));
create policy own_tenant_memberships on app.tenant_memberships
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy authenticated_permissions on app.permissions
  for select to authenticated
  using (true);
create policy own_permission_roles on app.permission_roles
  for select to authenticated
  using (
    (select internal.is_active_member(tenant_id))
    and exists (
      select 1
      from app.access_grants as grant_row
      where grant_row.tenant_id = permission_roles.tenant_id
        and grant_row.role_id = permission_roles.id
        and grant_row.auth_user_id = (select auth.uid())
        and grant_row.starts_at <= statement_timestamp()
        and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
        and grant_row.revoked_at is null
    )
  );
create policy own_access_grants on app.access_grants
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    and (select internal.is_active_member(tenant_id))
  );

create policy member_committees on app.committees
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy member_teams on app.teams
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));

create policy explicit_household_access on app.households
  for select to authenticated
  using ((select internal.can_access_household(tenant_id, id, 'base')));
create policy explicit_household_person_links on app.household_person_links
  for select to authenticated
  using ((select internal.can_access_household(tenant_id, household_id, 'base')));
create policy own_household_access_grants on app.household_access_grants
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    and (select internal.is_active_member(tenant_id))
  );
create policy own_acting_delegations on app.acting_delegations
  for select to authenticated
  using (
    actor_auth_user_id = (select auth.uid())
    and (select internal.is_active_member(tenant_id))
  );
create policy own_guardian_authorizations on app.guardian_authorizations
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, guardian_person_id)));

create policy editable_intake_profiles on app.intake_profiles
  for select to authenticated
  using ((select internal.can_edit_intake(tenant_id, id)));
create policy editable_intake_answers on app.intake_answers_versions
  for select to authenticated
  using ((select internal.can_edit_intake(tenant_id, profile_id)));

create policy member_seasons on app.seasons
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy visible_obligations on app.obligations
  for select to authenticated
  using (
    (select internal.can_access_obligation_progress(tenant_id, id))
    or exists (
      select 1
      from app.executor_obligation_grants as executor_grant
      join app.account_person_links as self_link
        on self_link.tenant_id = executor_grant.tenant_id
       and self_link.person_id = executor_grant.person_id
       and self_link.auth_user_id = (select auth.uid())
       and self_link.revoked_at is null
      where executor_grant.tenant_id = obligations.tenant_id
        and executor_grant.obligation_id = obligations.id
        and executor_grant.revoked_at is null
        and executor_grant.valid_from <= statement_timestamp()
        and (executor_grant.valid_until is null or executor_grant.valid_until > statement_timestamp())
    )
  );
create policy visible_household_obligation_links on app.household_obligation_links
  for select to authenticated
  using (
    (select internal.can_access_household(tenant_id, household_id, 'view_progress'))
    or (select internal.has_permission(tenant_id, 'household.progress.view', 'household', household_id))
  );
create policy visible_executor_obligation_grants on app.executor_obligation_grants
  for select to authenticated
  using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.can_access_obligation_progress(tenant_id, obligation_id))
  );

create policy member_task_categories on app.task_categories
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy member_task_types on app.task_types
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy member_task_type_versions on app.task_type_versions
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy member_locations on app.locations
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy member_qualification_types on app.qualification_types
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy own_person_qualifications on app.person_qualifications
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, person_id)));
create policy own_unavailability_periods on app.unavailability_periods
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, person_id)));
create policy published_shifts on app.shifts
  for select to authenticated
  using (
    (select internal.is_active_member(tenant_id))
    and (
      state = 'published'
      or (select internal.has_permission(tenant_id, 'shift.manage', 'committee', committee_id))
    )
  );
create policy visible_shift_positions on app.shift_positions
  for select to authenticated
  using (
    exists (
      select 1
      from app.shifts as shift_row
      where shift_row.tenant_id = shift_positions.tenant_id
        and shift_row.id = shift_positions.shift_id
    )
  );
create policy visible_shift_requirements on app.shift_requirements
  for select to authenticated
  using (
    exists (
      select 1
      from app.shifts as shift_row
      where shift_row.tenant_id = shift_requirements.tenant_id
        and shift_row.id = shift_requirements.shift_id
    )
  );

create policy visible_bookings on app.bookings
  for select to authenticated
  using (
    booked_by_auth_user_id = (select auth.uid())
    or (select internal.is_self_person(tenant_id, executor_person_id))
    or (select internal.can_access_obligation_progress(tenant_id, obligation_id))
  );
create policy visible_booking_events on app.booking_events
  for select to authenticated
  using (
    exists (
      select 1
      from app.bookings as booking
      where booking.tenant_id = booking_events.tenant_id
        and booking.id = booking_events.booking_id
    )
  );
create policy visible_attendance_decisions on app.attendance_decisions
  for select to authenticated
  using (
    exists (
      select 1
      from app.bookings as booking
      where booking.tenant_id = attendance_decisions.tenant_id
        and booking.id = attendance_decisions.booking_id
    )
  );
create policy visible_hour_ledger_entries on app.hour_ledger_entries
  for select to authenticated
  using (
    (select internal.can_access_obligation_progress(tenant_id, obligation_id))
    or exists (
      select 1
      from app.bookings as booking
      where booking.tenant_id = hour_ledger_entries.tenant_id
        and booking.id = hour_ledger_entries.booking_id
        and (
          booking.booked_by_auth_user_id = (select auth.uid())
          or (select internal.is_self_person(booking.tenant_id, booking.executor_person_id))
        )
    )
  );
create policy visible_hour_disputes on app.hour_disputes
  for select to authenticated
  using (
    opened_by_auth_user_id = (select auth.uid())
    or (select internal.can_access_obligation_progress(tenant_id, obligation_id))
  );

grant select on app.tenants to anon;
grant select on
  app.tenants,
  app.account_profiles,
  app.persons,
  app.person_contacts,
  app.account_person_links,
  app.tenant_memberships,
  app.permissions,
  app.permission_roles,
  app.access_grants,
  app.committees,
  app.teams,
  app.households,
  app.household_person_links,
  app.household_access_grants,
  app.acting_delegations,
  app.guardian_authorizations,
  app.intake_profiles,
  app.intake_answers_versions,
  app.seasons,
  app.obligations,
  app.household_obligation_links,
  app.executor_obligation_grants,
  app.task_categories,
  app.task_types,
  app.task_type_versions,
  app.locations,
  app.qualification_types,
  app.person_qualifications,
  app.unavailability_periods,
  app.shifts,
  app.shift_positions,
  app.shift_requirements,
  app.bookings,
  app.booking_events,
  app.attendance_decisions,
  app.hour_ledger_entries,
  app.hour_disputes
to authenticated;

create or replace function internal.seed_tenant_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into app.permission_roles (tenant_id, role_key, name, description) values
    (new.id, 'member', 'Lid / ouder / uitvoerder', 'Persoonlijke en expliciet gedeelde werkruimte'),
    (new.id, 'fixed_volunteer', 'Vaste vrijwilliger', 'Eigen erkende functie; geen impliciete systeemrechten'),
    (new.id, 'committee_coordinator', 'Commissiecoördinator', 'Planning en uitvoering binnen de eigen commissie'),
    (new.id, 'volunteer_coordinator', 'Vrijwilligerscoördinator', 'Begeleiding binnen expliciet toegewezen portefeuille'),
    (new.id, 'volunteer_committee', 'Vrijwilligerscommissie', 'Centrale dossier-, uren- en besluitroute'),
    (new.id, 'team_parent', 'Teamouder', 'Eigen team en gereduceerde voortgangsprojectie'),
    (new.id, 'board', 'Bestuur', 'Organisatie en afzonderlijk bevoegde besluiten'),
    (new.id, 'finance', 'Financieel beheer', 'Alleen goedgekeurde financiële verwerking')
  on conflict (tenant_id, role_key) do nothing;

  insert into app.role_permissions (tenant_id, role_id, permission_key)
  select new.id, role_row.id, mapping.permission_key
  from app.permission_roles as role_row
  join (
    values
      ('member', 'shift.view'),
      ('member', 'shift.book'),
      ('fixed_volunteer', 'shift.view'),
      ('fixed_volunteer', 'shift.book'),
      ('committee_coordinator', 'shift.view'),
      ('committee_coordinator', 'shift.manage'),
      ('committee_coordinator', 'attendance.confirm'),
      ('volunteer_coordinator', 'household.view'),
      ('volunteer_coordinator', 'household.progress.view'),
      ('volunteer_coordinator', 'household.invite_executor'),
      ('volunteer_coordinator', 'intake.assist'),
      ('volunteer_coordinator', 'shift.view'),
      ('volunteer_coordinator', 'shift.book'),
      ('volunteer_committee', 'household.view'),
      ('volunteer_committee', 'household.progress.view'),
      ('volunteer_committee', 'household.invite_executor'),
      ('volunteer_committee', 'household.review'),
      ('volunteer_committee', 'intake.assist'),
      ('volunteer_committee', 'shift.view'),
      ('volunteer_committee', 'attendance.confirm'),
      ('team_parent', 'shift.view'),
      ('board', 'organization.manage'),
      ('finance', 'finance.process')
  ) as mapping(role_key, permission_key)
    on mapping.role_key = role_row.role_key
  where role_row.tenant_id = new.id
  on conflict (tenant_id, role_id, permission_key) do nothing;

  return new;
end;
$function$;

alter function internal.seed_tenant_roles() owner to cluvo_command_owner;
revoke execute on function internal.seed_tenant_roles() from public, anon, authenticated, service_role;

create trigger tenants_seed_canonical_roles
after insert on app.tenants
for each row execute function internal.seed_tenant_roles();

create or replace function internal.reject_immutable_change()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception using
    errcode = '55000',
    message = format('%s is append-only', tg_table_name);
end;
$function$;

revoke execute on function internal.reject_immutable_change() from public, anon, authenticated, service_role;

create trigger tenant_settings_versions_immutable
before update or delete on app.tenant_settings_versions
for each row execute function internal.reject_immutable_change();
create trigger intake_answers_versions_immutable
before update or delete on app.intake_answers_versions
for each row execute function internal.reject_immutable_change();
create trigger booking_events_immutable
before update or delete on app.booking_events
for each row execute function internal.reject_immutable_change();
create trigger attendance_decisions_immutable
before update or delete on app.attendance_decisions
for each row execute function internal.reject_immutable_change();
create trigger hour_ledger_entries_immutable
before update or delete on app.hour_ledger_entries
for each row execute function internal.reject_immutable_change();
create trigger audit_events_immutable
before update or delete on app.audit_events
for each row execute function internal.reject_immutable_change();
create trigger domain_events_immutable
before update or delete on app.domain_events
for each row execute function internal.reject_immutable_change();

create view api.public_tenants
with (security_invoker = true)
as
select
  tenant.id as tenant_id,
  tenant.slug as tenant_slug,
  tenant.name as tenant_name,
  tenant.timezone,
  tenant.locale,
  tenant.branding_json
from app.tenants as tenant
where tenant.status = 'active';

create view api.my_workspaces
with (security_invoker = true)
as
select
  tenant.id as tenant_id,
  tenant.slug as tenant_slug,
  tenant.name as tenant_name,
  person.id as person_id,
  coalesce(nullif(profile.display_name, ''), concat_ws(' ', person.given_name, person.family_name)) as display_name,
  role_row.role_key,
  grant_row.scope_kind,
  coalesce(grant_row.committee_id, grant_row.team_id, grant_row.household_id) as scope_id
from app.tenant_memberships as membership
join app.tenants as tenant
  on tenant.id = membership.tenant_id
join app.account_person_links as account_link
  on account_link.tenant_id = membership.tenant_id
 and account_link.auth_user_id = membership.auth_user_id
 and account_link.revoked_at is null
join app.persons as person
  on person.tenant_id = account_link.tenant_id
 and person.id = account_link.person_id
left join app.account_profiles as profile
  on profile.auth_user_id = membership.auth_user_id
join app.access_grants as grant_row
  on grant_row.tenant_id = membership.tenant_id
 and grant_row.auth_user_id = membership.auth_user_id
 and grant_row.starts_at <= statement_timestamp()
 and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
 and grant_row.revoked_at is null
join app.permission_roles as role_row
  on role_row.tenant_id = grant_row.tenant_id
 and role_row.id = grant_row.role_id
where membership.auth_user_id = (select auth.uid())
  and membership.status = 'active'
  and membership.starts_at <= statement_timestamp()
  and (membership.ends_at is null or membership.ends_at > statement_timestamp())
  and tenant.status = 'active';

create view api.my_households
with (security_invoker = true)
as
select
  household.tenant_id,
  household.id as household_id,
  household.label,
  grant_row.can_view_progress,
  grant_row.can_invite_executor
from app.household_access_grants as grant_row
join app.households as household
  on household.tenant_id = grant_row.tenant_id
 and household.id = grant_row.household_id
where grant_row.auth_user_id = (select auth.uid())
  and grant_row.starts_at <= statement_timestamp()
  and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
  and grant_row.revoked_at is null
  and household.status <> 'archived';

create view api.my_intake
with (security_invoker = true)
as
select
  profile.tenant_id,
  profile.id as profile_id,
  profile.person_id,
  profile.household_context_id,
  profile.version,
  profile.status,
  profile.desired_minutes,
  profile.annual_confirmed_at,
  coalesce(answer_version.answers, '{}'::jsonb) as answers
from app.intake_profiles as profile
left join app.intake_answers_versions as answer_version
  on answer_version.tenant_id = profile.tenant_id
 and answer_version.profile_id = profile.id
 and answer_version.revision = profile.current_revision;

create view api.household_progress
with (security_invoker = true)
as
with ledger_totals as (
  select
    ledger.tenant_id,
    ledger.obligation_id,
    coalesce(sum(ledger.minutes_delta), 0)::bigint as confirmed_minutes
  from app.hour_ledger_entries as ledger
  group by ledger.tenant_id, ledger.obligation_id
), booking_totals as (
  select
    booking.tenant_id,
    booking.obligation_id,
    coalesce(sum(booking.credit_minutes_snapshot) filter (
      where booking.state in ('booked', 'reconfirmation_required', 'transfer_pending')
    ), 0)::bigint as planned_minutes,
    coalesce(sum(booking.credit_minutes_snapshot) filter (
      where booking.state = 'performed_pending'
    ), 0)::bigint as pending_minutes
  from app.bookings as booking
  group by booking.tenant_id, booking.obligation_id
), dispute_totals as (
  select
    dispute.tenant_id,
    dispute.obligation_id,
    coalesce(sum(abs(ledger.minutes_delta)), 0)::bigint as disputed_minutes
  from app.hour_disputes as dispute
  left join app.hour_ledger_entries as ledger
    on ledger.tenant_id = dispute.tenant_id
   and ledger.id = dispute.ledger_entry_id
  where dispute.state in ('open', 'in_review')
  group by dispute.tenant_id, dispute.obligation_id
)
select
  obligation_link.tenant_id,
  obligation_link.household_id,
  obligation.id as obligation_id,
  obligation.effective_target_minutes::bigint as effective_target_minutes,
  coalesce(ledger_totals.confirmed_minutes, 0) as confirmed_minutes,
  coalesce(booking_totals.pending_minutes, 0) as pending_minutes,
  coalesce(booking_totals.planned_minutes, 0) as planned_minutes,
  coalesce(dispute_totals.disputed_minutes, 0) as disputed_minutes,
  greatest(
    obligation.effective_target_minutes::bigint - coalesce(ledger_totals.confirmed_minutes, 0),
    0
  ) as remaining_minutes
from app.household_obligation_links as obligation_link
join app.obligations as obligation
  on obligation.tenant_id = obligation_link.tenant_id
 and obligation.id = obligation_link.obligation_id
left join ledger_totals
  on ledger_totals.tenant_id = obligation.tenant_id
 and ledger_totals.obligation_id = obligation.id
left join booking_totals
  on booking_totals.tenant_id = obligation.tenant_id
 and booking_totals.obligation_id = obligation.id
left join dispute_totals
  on dispute_totals.tenant_id = obligation.tenant_id
 and dispute_totals.obligation_id = obligation.id
where obligation_link.starts_at <= statement_timestamp()
  and (obligation_link.ends_at is null or obligation_link.ends_at > statement_timestamp());

comment on view api.my_workspaces is 'Current actor workspaces from active membership and scoped role grants; UI role selection cannot create rights.';
comment on view api.my_households is 'Explicit dossier grants only; no intake answers or contact details.';
comment on view api.my_intake is 'Current intake revision for the actor or an explicit active intake-assistance delegation.';
comment on view api.household_progress is 'Reduced progress projection. Remaining means target minus confirmed ledger minutes; planned and pending remain separate.';

revoke all on api.public_tenants, api.my_workspaces, api.my_households, api.my_intake, api.household_progress
  from public, anon, authenticated, service_role;
grant select on api.public_tenants to anon, authenticated;
grant select on api.my_workspaces, api.my_households, api.my_intake, api.household_progress
  to authenticated;

create or replace function internal.save_intake_revision(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_expected_version bigint,
  p_desired_minutes integer,
  p_answers jsonb,
  p_represented_person_id uuid,
  p_assistance_reason text,
  p_idempotency_key uuid
)
returns table (
  ok boolean,
  resource_id uuid,
  version bigint,
  event_ids uuid[],
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_profile app.intake_profiles%rowtype;
  v_idempotency app.idempotency_records%rowtype;
  v_request_hash bytea;
  v_revision integer;
  v_event_id uuid := gen_random_uuid();
  v_inserted_id uuid;
  v_merged_answers jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_idempotency_key is null or p_expected_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  v_request_hash := extensions.digest(
    convert_to(jsonb_build_object(
      'profile_id', p_profile_id,
      'expected_version', p_expected_version,
      'desired_minutes', p_desired_minutes,
      'answers', p_answers,
      'represented_person_id', p_represented_person_id,
      'assistance_reason', p_assistance_reason
    )::text, 'UTF8'),
    'sha256'
  );

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, 'save_intake_revision', p_idempotency_key, v_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_idempotency
    from app.idempotency_records
    where tenant_id = p_tenant_id
      and actor_auth_user_id = v_actor
      and operation = 'save_intake_revision'
      and idempotency_key = p_idempotency_key
    for update;

    if v_idempotency.request_hash <> v_request_hash then
      raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_idempotency.status = 'completed' then
      return query select
        true,
        (v_idempotency.result_jsonb ->> 'resource_id')::uuid,
        (v_idempotency.result_jsonb ->> 'version')::bigint,
        array(
          select value::uuid
          from jsonb_array_elements_text(v_idempotency.result_jsonb -> 'event_ids')
        ),
        v_idempotency.result_jsonb -> 'result';
      return;
    end if;
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  select * into v_profile
  from app.intake_profiles
  where tenant_id = p_tenant_id and id = p_profile_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if not internal.can_edit_intake(p_tenant_id, p_profile_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_profile.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_INTAKE_ANSWERS';
  end if;
  if octet_length(p_answers::text) > 20000
    or exists (
      select 1
      from jsonb_each(p_answers) as answer_field(answer_key, answer_value)
      where jsonb_typeof(answer_value) <> 'string'
        or char_length(answer_value #>> '{}') > 2000
    ) then
    raise exception using errcode = '22023', message = 'INVALID_INTAKE_ANSWERS';
  end if;
  if p_desired_minutes is not null and p_desired_minutes not between 0 and 100000 then
    raise exception using errcode = '22023', message = 'INVALID_DESIRED_MINUTES';
  end if;
  if p_assistance_reason is not null and char_length(p_assistance_reason) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_REPRESENTATION';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_answers) as answer_key
    where answer_key not in (
      'preferences', 'experience', 'skills', 'availability', 'unavailability',
      'training_needs', 'fixed_role_interest', 'practical_limitations'
    )
  ) then
    raise exception using errcode = '22023', message = 'INVALID_INTAKE_ANSWERS';
  end if;

  select coalesce(answer_version.answers, '{}'::jsonb) || p_answers
  into v_merged_answers
  from (select 1) as singleton
  left join app.intake_answers_versions as answer_version
    on answer_version.tenant_id = p_tenant_id
   and answer_version.profile_id = p_profile_id
   and answer_version.revision = v_profile.current_revision;

  if internal.is_self_person(p_tenant_id, v_profile.person_id) then
    if p_represented_person_id is not null or p_assistance_reason is not null then
      raise exception using errcode = '22023', message = 'INVALID_REPRESENTATION';
    end if;
  elsif p_represented_person_id is distinct from v_profile.person_id
    or nullif(btrim(p_assistance_reason), '') is null then
    raise exception using errcode = '42501', message = 'INVALID_REPRESENTATION';
  end if;

  v_revision := v_profile.current_revision + 1;

  insert into app.intake_answers_versions (
    tenant_id,
    profile_id,
    revision,
    answers,
    authored_by_auth_user_id,
    represented_person_id,
    assistance_reason
  ) values (
    p_tenant_id,
    p_profile_id,
    v_revision,
    v_merged_answers,
    v_actor,
    p_represented_person_id,
    p_assistance_reason
  );

  update app.intake_profiles as profile_row
  set current_revision = v_revision,
      desired_minutes = p_desired_minutes,
      status = case when profile_row.status = 'draft' then 'submitted' else profile_row.status end,
      updated_at = statement_timestamp(),
      version = profile_row.version + 1
  where profile_row.tenant_id = p_tenant_id and profile_row.id = p_profile_id
  returning profile_row.* into v_profile;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, reason_code,
    idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, p_represented_person_id, 'intake.revision_saved',
    'intake_profile', p_profile_id, 'household', v_profile.household_context_id,
    case when p_represented_person_id is null then null else 'assisted' end,
    p_idempotency_key, jsonb_build_object('revision', v_revision)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'intake_profile', p_profile_id, v_profile.version,
    'intake.revision_saved', jsonb_build_object('revision', v_revision)
  );

  v_result := jsonb_build_object(
    'resource_id', p_profile_id,
    'version', v_profile.version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('revision', v_revision)
  );

  update app.idempotency_records
  set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp()
  where id = v_inserted_id;

  return query select
    true,
    p_profile_id,
    v_profile.version,
    array[v_event_id],
    v_result -> 'result';
end;
$function$;

alter function internal.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  from public, anon, service_role;
grant execute on function internal.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  to authenticated;

create or replace function api.save_intake_revision(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_expected_version bigint,
  p_desired_minutes integer,
  p_answers jsonb,
  p_represented_person_id uuid,
  p_assistance_reason text,
  p_idempotency_key uuid
)
returns table (
  ok boolean,
  resource_id uuid,
  version bigint,
  event_ids uuid[],
  result jsonb
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from internal.save_intake_revision(
    p_tenant_id,
    p_profile_id,
    p_expected_version,
    p_desired_minutes,
    p_answers,
    p_represented_person_id,
    p_assistance_reason,
    p_idempotency_key
  );
$function$;

revoke execute on function api.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  from public, anon, service_role;
grant execute on function api.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  to authenticated;

create or replace function internal.book_shift(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_position_id uuid,
  p_executor_person_id uuid,
  p_obligation_id uuid,
  p_expected_shift_version bigint,
  p_idempotency_key uuid
)
returns table (
  ok boolean,
  resource_id uuid,
  version bigint,
  event_ids uuid[],
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_obligation app.obligations%rowtype;
  v_shift app.shifts%rowtype;
  v_position app.shift_positions%rowtype;
  v_person app.persons%rowtype;
  v_requirement app.shift_requirements%rowtype;
  v_idempotency app.idempotency_records%rowtype;
  v_request_hash bytea;
  v_inserted_id uuid;
  v_booking_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
  v_tenant_timezone text;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_idempotency_key is null or p_expected_shift_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  v_request_hash := extensions.digest(
    convert_to(jsonb_build_object(
      'shift_id', p_shift_id,
      'position_id', p_position_id,
      'executor_person_id', p_executor_person_id,
      'obligation_id', p_obligation_id,
      'expected_shift_version', p_expected_shift_version
    )::text, 'UTF8'),
    'sha256'
  );

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, 'book_shift', p_idempotency_key, v_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_idempotency
    from app.idempotency_records
    where tenant_id = p_tenant_id
      and actor_auth_user_id = v_actor
      and operation = 'book_shift'
      and idempotency_key = p_idempotency_key
    for update;
    if v_idempotency.request_hash <> v_request_hash then
      raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_idempotency.status = 'completed' then
      return query select
        true,
        (v_idempotency.result_jsonb ->> 'resource_id')::uuid,
        (v_idempotency.result_jsonb ->> 'version')::bigint,
        array(select value::uuid from jsonb_array_elements_text(v_idempotency.result_jsonb -> 'event_ids')),
        v_idempotency.result_jsonb -> 'result';
      return;
    end if;
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  select * into v_person
  from app.persons
  where tenant_id = p_tenant_id and id = p_executor_person_id
  for update;
  if not found or v_person.status <> 'active' then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  select * into v_obligation
  from app.obligations
  where tenant_id = p_tenant_id and id = p_obligation_id
  for update;
  if not found or v_obligation.status not in ('active', 'review_hold', 'fulfilled') then
    raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
  end if;

  select * into v_shift
  from app.shifts
  where tenant_id = p_tenant_id and id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into v_position
  from app.shift_positions
  where tenant_id = p_tenant_id and id = p_position_id and shift_id = p_shift_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if v_shift.version <> p_expected_shift_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_shift.state <> 'published' or v_position.state <> 'open' then
    raise exception using errcode = 'P0001', message = 'CAPACITY_FULL';
  end if;
  if statement_timestamp() >= v_shift.starts_at then
    raise exception using errcode = 'P0001', message = 'NOT_ELIGIBLE';
  end if;
  if v_shift.booking_opens_at is not null and statement_timestamp() < v_shift.booking_opens_at then
    raise exception using errcode = 'P0001', message = 'NOT_ELIGIBLE';
  end if;
  if v_shift.booking_closes_at is not null and statement_timestamp() >= v_shift.booking_closes_at then
    raise exception using errcode = 'P0001', message = 'NOT_ELIGIBLE';
  end if;
  if v_position.starts_at <> v_shift.starts_at or v_position.ends_at <> v_shift.ends_at then
    raise exception using errcode = '55000', message = 'POSITION_SHIFT_MISMATCH';
  end if;
  if not internal.can_book_executor(p_tenant_id, p_executor_person_id, p_obligation_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not internal.has_permission(
    p_tenant_id,
    'shift.book',
    'household',
    v_obligation.assessed_household_id
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

  select timezone into v_tenant_timezone from app.tenants where id = p_tenant_id;

  if v_requirement.id is not null and v_requirement.minimum_age is not null then
    if v_person.birth_date is null
      or v_person.birth_date_precision <> 'day'
      or v_person.birth_date + make_interval(years => v_requirement.minimum_age)
        > (v_shift.starts_at at time zone v_tenant_timezone)::date then
      raise exception using errcode = '42501', message = 'NOT_ELIGIBLE';
    end if;
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
      and existing_booking.position_id = p_position_id
      and existing_booking.state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending')
  ) then
    raise exception using errcode = 'P0001', message = 'CAPACITY_FULL';
  end if;

  if exists (
    select 1
    from app.bookings as existing_booking
    where existing_booking.tenant_id = p_tenant_id
      and existing_booking.executor_person_id = p_executor_person_id
      and existing_booking.state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending')
      and tstzrange(
        coalesce(existing_booking.pending_starts_at, existing_booking.starts_at_snapshot),
        coalesce(existing_booking.pending_ends_at, existing_booking.ends_at_snapshot),
        '[)'
      )
        && tstzrange(v_shift.starts_at, v_shift.ends_at, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'PERSON_OVERLAP';
  end if;

  insert into app.bookings (
    id, tenant_id, position_id, executor_person_id, obligation_id, state,
    booked_by_auth_user_id, starts_at_snapshot, ends_at_snapshot,
    credit_minutes_snapshot, cancellation_deadline_snapshot,
    task_version_snapshot, idempotency_key
  ) values (
    v_booking_id, p_tenant_id, p_position_id, p_executor_person_id, p_obligation_id, 'booked',
    v_actor, v_shift.starts_at, v_shift.ends_at, v_shift.credit_minutes,
    v_shift.starts_at - make_interval(mins => v_shift.cancellation_minutes),
    v_shift.type_version_id, p_idempotency_key
  );

  insert into app.booking_events (
    tenant_id, booking_id, event_type, actor_auth_user_id, represented_person_id, payload
  ) values (
    p_tenant_id, v_booking_id, 'booking.created', v_actor,
    case when internal.is_self_person(p_tenant_id, p_executor_person_id) then null else p_executor_person_id end,
    jsonb_build_object('position_id', p_position_id, 'obligation_id', p_obligation_id)
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor,
    case when internal.is_self_person(p_tenant_id, p_executor_person_id) then null else p_executor_person_id end,
    'booking.created', 'booking', v_booking_id, 'committee', v_shift.committee_id,
    p_idempotency_key, jsonb_build_object('position_id', p_position_id)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'booking', v_booking_id, 1,
    'booking.created', jsonb_build_object('shift_id', p_shift_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_booking_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('position_id', p_position_id, 'state', 'booked')
  );
  update app.idempotency_records
  set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp()
  where id = v_inserted_id;

  return query select true, v_booking_id, 1::bigint, array[v_event_id], v_result -> 'result';
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'CAPACITY_FULL';
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'PERSON_OVERLAP';
end;
$function$;

alter function internal.book_shift(uuid, uuid, uuid, uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.book_shift(uuid, uuid, uuid, uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.book_shift(uuid, uuid, uuid, uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function api.book_shift(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_position_id uuid,
  p_executor_person_id uuid,
  p_obligation_id uuid,
  p_expected_shift_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.book_shift(
    p_tenant_id, p_shift_id, p_position_id, p_executor_person_id,
    p_obligation_id, p_expected_shift_version, p_idempotency_key
  );
$function$;

revoke execute on function api.book_shift(uuid, uuid, uuid, uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.book_shift(uuid, uuid, uuid, uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.confirm_attendance(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_expected_booking_version bigint,
  p_result text,
  p_awarded_minutes integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (
  ok boolean,
  resource_id uuid,
  version bigint,
  event_ids uuid[],
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_booking app.bookings%rowtype;
  v_obligation app.obligations%rowtype;
  v_shift app.shifts%rowtype;
  v_position app.shift_positions%rowtype;
  v_idempotency app.idempotency_records%rowtype;
  v_request_hash bytea;
  v_inserted_id uuid;
  v_decision_id uuid := gen_random_uuid();
  v_ledger_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_awarded integer;
  v_new_booking_version bigint;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_idempotency_key is null or p_expected_booking_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  v_request_hash := extensions.digest(
    convert_to(jsonb_build_object(
      'booking_id', p_booking_id,
      'expected_booking_version', p_expected_booking_version,
      'result', p_result,
      'awarded_minutes', p_awarded_minutes,
      'reason', nullif(btrim(p_reason), '')
    )::text, 'UTF8'),
    'sha256'
  );

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, 'confirm_attendance', p_idempotency_key, v_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_idempotency
    from app.idempotency_records
    where tenant_id = p_tenant_id
      and actor_auth_user_id = v_actor
      and operation = 'confirm_attendance'
      and idempotency_key = p_idempotency_key
    for update;
    if v_idempotency.request_hash <> v_request_hash then
      raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_idempotency.status = 'completed' then
      return query select
        true,
        (v_idempotency.result_jsonb ->> 'resource_id')::uuid,
        (v_idempotency.result_jsonb ->> 'version')::bigint,
        array(select value::uuid from jsonb_array_elements_text(v_idempotency.result_jsonb -> 'event_ids')),
        v_idempotency.result_jsonb -> 'result';
      return;
    end if;
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  select booking.* into v_booking
  from app.bookings as booking
  where booking.tenant_id = p_tenant_id and booking.id = p_booking_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  perform 1
  from app.persons
  where tenant_id = p_tenant_id and id = v_booking.executor_person_id
  for update;

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

  if v_booking.version <> p_expected_booking_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_booking.current_attendance_decision_id is not null
    or v_booking.state not in ('booked', 'performed_pending') then
    raise exception using errcode = 'P0001', message = 'ALREADY_CONFIRMED';
  end if;
  if not internal.has_permission(
    p_tenant_id,
    'attendance.confirm',
    'committee',
    v_shift.committee_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_result not in ('present', 'partial', 'no_show', 'club_cancelled') then
    raise exception using errcode = '22023', message = 'INVALID_ATTENDANCE_RESULT';
  end if;
  if p_result <> 'club_cancelled' and statement_timestamp() < v_booking.ends_at_snapshot then
    raise exception using errcode = '22023', message = 'ATTENDANCE_TOO_EARLY';
  end if;

  case p_result
    when 'present' then
      if p_awarded_minutes is not null
        and p_awarded_minutes <> v_booking.credit_minutes_snapshot then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      if nullif(btrim(p_reason), '') is not null then
        raise exception using errcode = '22023', message = 'INVALID_ATTENDANCE_REASON';
      end if;
      v_awarded := v_booking.credit_minutes_snapshot;
    when 'partial' then
      if p_awarded_minutes is null
        or p_awarded_minutes < 0
        or p_awarded_minutes > v_booking.credit_minutes_snapshot
        or nullif(btrim(p_reason), '') is null then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      v_awarded := p_awarded_minutes;
    when 'no_show' then
      if coalesce(p_awarded_minutes, 0) <> 0 or nullif(btrim(p_reason), '') is not null then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      v_awarded := 0;
    when 'club_cancelled' then
      if p_awarded_minutes is null
        or p_awarded_minutes < 0
        or p_awarded_minutes > v_booking.credit_minutes_snapshot
        or nullif(btrim(p_reason), '') is null then
        raise exception using errcode = '22023', message = 'INVALID_AWARDED_MINUTES';
      end if;
      v_awarded := p_awarded_minutes;
  end case;

  insert into app.attendance_decisions (
    id, tenant_id, booking_id, decision_revision, result,
    awarded_minutes, confirmed_by_auth_user_id, reason
  ) values (
    v_decision_id, p_tenant_id, p_booking_id, 1, p_result,
    v_awarded, v_actor, nullif(btrim(p_reason), '')
  );

  insert into app.hour_ledger_entries (
    id, tenant_id, obligation_id, season_id, booking_id,
    attendance_decision_id, entry_kind, minutes_delta, performed_at,
    actor_auth_user_id, idempotency_key
  ) values (
    v_ledger_id, p_tenant_id, v_obligation.id, v_obligation.season_id, p_booking_id,
    v_decision_id, 'award', v_awarded, v_booking.starts_at_snapshot,
    v_actor, p_idempotency_key
  );

  update app.bookings as booking_row
  set current_attendance_decision_id = v_decision_id,
      state = case when p_result = 'no_show' then 'no_show' else 'confirmed' end,
      updated_at = statement_timestamp(),
      version = booking_row.version + 1
  where booking_row.tenant_id = p_tenant_id and booking_row.id = p_booking_id
  returning booking_row.version into v_new_booking_version;

  update app.obligations as obligation_row
  set ledger_revision = obligation_row.ledger_revision + 1,
      updated_at = statement_timestamp(),
      version = obligation_row.version + 1
  where obligation_row.tenant_id = p_tenant_id and obligation_row.id = v_obligation.id;

  insert into app.booking_events (
    tenant_id, booking_id, event_type, actor_auth_user_id, reason_code, payload
  ) values (
    p_tenant_id, p_booking_id, 'attendance.confirmed', v_actor,
    case when p_result in ('partial', 'club_cancelled') then p_result else null end,
    jsonb_build_object('result', p_result, 'awarded_minutes', v_awarded)
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'attendance.confirmed', 'booking', p_booking_id,
    'committee', v_shift.committee_id,
    case when p_result in ('partial', 'club_cancelled') then p_result else null end,
    p_idempotency_key,
    jsonb_build_object('decision_id', v_decision_id, 'ledger_entry_id', v_ledger_id)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'booking', p_booking_id, v_new_booking_version,
    'attendance.confirmed', jsonb_build_object('result', p_result)
  );

  v_result := jsonb_build_object(
    'resource_id', p_booking_id,
    'version', v_new_booking_version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'attendance_decision_id', v_decision_id,
      'ledger_entry_id', v_ledger_id,
      'awarded_minutes', v_awarded
    )
  );
  update app.idempotency_records
  set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp()
  where id = v_inserted_id;

  return query select
    true, p_booking_id, v_new_booking_version, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.confirm_attendance(uuid, uuid, bigint, text, integer, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.confirm_attendance(uuid, uuid, bigint, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function internal.confirm_attendance(uuid, uuid, bigint, text, integer, text, uuid)
  to authenticated;

create or replace function api.confirm_attendance(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_expected_booking_version bigint,
  p_result text,
  p_awarded_minutes integer,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.confirm_attendance(
    p_tenant_id, p_booking_id, p_expected_booking_version, p_result,
    p_awarded_minutes, p_reason, p_idempotency_key
  );
$function$;

revoke execute on function api.confirm_attendance(uuid, uuid, bigint, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function api.confirm_attendance(uuid, uuid, bigint, text, integer, text, uuid)
  to authenticated;

-- Public roles never receive direct mutation privileges on domain tables.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema app
  from public, anon, authenticated;

-- Reassert function defaults after all functions in this migration exist.
revoke execute on all functions in schema api from public, anon, service_role;
revoke execute on all functions in schema internal from public, anon, service_role;
