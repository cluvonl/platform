-- Cluvo WP6-WP8: committee collaboration, team-task approval, provider
-- matches and agenda, reliable notifications/templates, and exact policy
-- acceptance evidence. This is an expand-only migration.

insert into app.permissions (permission_key, description) values
  ('committee.workspace.view', 'Read a committee workspace and its collaboration sources'),
  ('committee.workspace.manage', 'Manage collaboration sources in a scoped committee'),
  ('team_task.view', 'Read team tasks in a scoped team'),
  ('team_task.manage', 'Manage zero-credit team tasks in a scoped team'),
  ('team_task.market.approve', 'Approve a team task credit value for market publication'),
  ('team_task.market.publish', 'Publish an approved team task to the task market'),
  ('match.view', 'Read matches for an authorized team or tenant scope'),
  ('match.import', 'Run a controlled provider match import'),
  ('match.review', 'Review match-related referee requests and shift impacts'),
  ('agenda.view', 'Read agenda sources within an authorized scope'),
  ('agenda.manage', 'Manage agenda sources within an authorized scope'),
  ('communication.manage', 'Manage templates and notification rules within a granted scope'),
  ('policy.manage', 'Publish and offer exact policy versions'),
  ('policy.follow_up', 'Handle policy questions within a granted scope')
on conflict (permission_key) do nothing;

create table app.team_person_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  team_id uuid not null,
  person_id uuid not null,
  membership_kind text not null
    check (membership_kind in ('player', 'coach', 'team_parent', 'staff')),
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);

create unique index team_person_memberships_current_uq
  on app.team_person_memberships (tenant_id, team_id, person_id, membership_kind)
  where ends_at is null;
create index team_person_memberships_person_idx
  on app.team_person_memberships (tenant_id, person_id, team_id, starts_at, ends_at);

create table app.committee_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  title text not null,
  owner_person_id uuid not null,
  visibility text not null check (visibility in ('tenant', 'committee', 'team', 'private')),
  committee_id uuid,
  team_id uuid,
  status text not null default 'active' check (status in ('active', 'archived')),
  current_revision integer not null default 0 check (current_revision >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, owner_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  check (
    (visibility = 'tenant' and num_nonnulls(committee_id, team_id) = 0)
    or (visibility = 'committee' and committee_id is not null and team_id is null)
    or (visibility = 'team' and team_id is not null and committee_id is null)
    or (visibility = 'private' and num_nonnulls(committee_id, team_id) <= 1)
  )
);

create table app.committee_document_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_id uuid not null,
  revision integer not null check (revision > 0),
  storage_object_path text not null,
  content_hash bytea not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  authored_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, document_id, revision),
  foreign key (tenant_id, document_id) references app.committee_documents(tenant_id, id) on delete restrict,
  foreign key (authored_by_auth_user_id) references auth.users(id) on delete restrict,
  check (storage_object_path !~ '(^|/)[.][.]($|/)')
);

create table app.committee_document_acl (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_id uuid not null,
  person_id uuid not null,
  can_read boolean not null default true,
  can_manage boolean not null default false,
  granted_by_auth_user_id uuid not null,
  starts_at timestamptz not null default statement_timestamp(),
  ends_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, document_id) references app.committee_documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (granted_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);

create unique index committee_document_acl_current_uq
  on app.committee_document_acl (tenant_id, document_id, person_id)
  where ends_at is null;

create table app.integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  connection_key text not null,
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  credential_reference text,
  status text not null default 'preparing'
    check (status in ('preparing', 'active', 'error', 'disabled')),
  last_success_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, provider, connection_key),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  check (provider ~ '^[a-z][a-z0-9_-]*$')
);

create table app.integration_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  trigger_kind text not null check (trigger_kind in ('scheduled', 'manual', 'retry')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'incomplete')),
  cursor_before text,
  cursor_after text,
  source_complete boolean not null default false,
  seen_count integer not null default 0 check (seen_count >= 0),
  changed_count integer not null default 0 check (changed_count >= 0),
  error_code text,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  requested_by_auth_user_id uuid,
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, connection_id, idempotency_key),
  foreign key (tenant_id, connection_id) references app.integration_connections(tenant_id, id) on delete restrict,
  foreign key (requested_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((status = 'running') = (completed_at is null)),
  check ((status in ('failed', 'incomplete')) or error_code is null)
);

create table app.matches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  connection_id uuid not null,
  source_id text not null,
  team_id uuid not null,
  opponent text not null,
  starts_at timestamptz not null,
  is_home boolean not null,
  location_text text,
  field_name text,
  locker_room_text text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'postponed', 'cancelled', 'completed')),
  source_hash bytea not null,
  last_seen_run_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, connection_id, source_id),
  foreign key (tenant_id, connection_id) references app.integration_connections(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  foreign key (tenant_id, last_seen_run_id) references app.integration_runs(tenant_id, id) on delete restrict
);

create index matches_team_starts_idx on app.matches (tenant_id, team_id, starts_at);

create table app.match_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  match_id uuid not null,
  revision bigint not null check (revision > 0),
  integration_run_id uuid not null,
  opponent text not null,
  starts_at timestamptz not null,
  is_home boolean not null,
  location_text text,
  field_name text,
  locker_room_text text,
  status text not null check (status in ('scheduled', 'postponed', 'cancelled', 'completed')),
  source_hash bytea not null,
  changed_fields text[] not null default '{}'::text[],
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, match_id, revision),
  foreign key (tenant_id, match_id) references app.matches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, integration_run_id) references app.integration_runs(tenant_id, id) on delete restrict
);

create table app.match_shift_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  match_id uuid not null,
  shift_id uuid not null,
  link_kind text not null check (link_kind in ('proposal', 'active')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, match_id, shift_id),
  foreign key (tenant_id, match_id) references app.matches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict
);

create table app.match_change_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  match_revision_id uuid not null,
  shift_id uuid not null,
  impact_kind text not null check (impact_kind in ('time', 'location', 'status', 'multiple')),
  state text not null default 'pending' check (state in ('pending', 'acknowledged', 'resolved')),
  handled_by_auth_user_id uuid,
  handled_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, match_revision_id, shift_id),
  foreign key (tenant_id, match_revision_id) references app.match_revisions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict,
  foreign key (handled_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((state = 'resolved') = (handled_by_auth_user_id is not null and handled_at is not null))
);

create table app.scheduled_occurrences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  job_kind text not null,
  local_date date not null,
  slot_key text not null,
  requested_local_time time not null,
  effective_local_time time not null,
  timezone text not null,
  scheduled_at timestamptz not null,
  dst_resolution text not null check (dst_resolution in ('exact', 'gap_shift_forward', 'fold_first')),
  state text not null default 'scheduled'
    check (state in ('scheduled', 'claimed', 'succeeded', 'failed')),
  lease_until timestamptz,
  claimed_by text,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, job_kind, local_date, slot_key),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  check ((scheduled_at at time zone timezone)::date = local_date),
  check ((scheduled_at at time zone timezone)::time = effective_local_time),
  check ((state = 'claimed') = (lease_until is not null and claimed_by is not null))
);

create index scheduled_occurrences_due_idx
  on app.scheduled_occurrences (state, scheduled_at)
  where state in ('scheduled', 'failed');

create table app.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  title text not null,
  description text,
  organizer_person_id uuid not null,
  visibility text not null check (visibility in ('tenant', 'committee', 'team', 'private')),
  committee_id uuid,
  team_id uuid,
  timezone text not null,
  recurrence_rule text,
  status text not null default 'active' check (status in ('draft', 'active', 'cancelled', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, organizer_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  check (
    (visibility = 'tenant' and num_nonnulls(committee_id, team_id) = 0)
    or (visibility = 'committee' and committee_id is not null and team_id is null)
    or (visibility = 'team' and team_id is not null and committee_id is null)
    or (visibility = 'private' and num_nonnulls(committee_id, team_id) <= 1)
  )
);

create table app.event_occurrences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  event_id uuid not null,
  recurrence_key text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id uuid,
  local_date date not null,
  state text not null default 'scheduled' check (state in ('scheduled', 'moved', 'cancelled')),
  is_exception boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, event_id, recurrence_key),
  foreign key (tenant_id, event_id) references app.events(tenant_id, id) on delete restrict,
  foreign key (tenant_id, location_id) references app.locations(tenant_id, id) on delete restrict,
  check (ends_at > starts_at)
);

create index event_occurrences_starts_idx on app.event_occurrences (tenant_id, starts_at);

create table app.event_attendees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  occurrence_id uuid not null,
  person_id uuid not null,
  rsvp text not null default 'invited'
    check (rsvp in ('invited', 'accepted', 'declined', 'tentative')),
  responded_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, occurrence_id, person_id),
  foreign key (tenant_id, occurrence_id) references app.event_occurrences(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  check ((rsvp = 'invited') = (responded_at is null))
);

create table app.kanban_boards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  committee_id uuid not null,
  name text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, committee_id, name),
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict
);

create table app.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  board_id uuid not null,
  title text not null,
  position integer not null check (position >= 0),
  terminal boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, board_id, position),
  foreign key (tenant_id, board_id) references app.kanban_boards(tenant_id, id) on delete restrict
);

create table app.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  board_id uuid not null,
  column_id uuid not null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  labels text[] not null default '{}'::text[],
  starts_on date,
  due_at timestamptz,
  accountable_person_id uuid,
  status text not null default 'open' check (status in ('open', 'completed', 'archived')),
  completed_at timestamptz,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, id, board_id),
  foreign key (tenant_id, board_id) references app.kanban_boards(tenant_id, id) on delete restrict,
  foreign key (tenant_id, column_id) references app.kanban_columns(tenant_id, id) on delete restrict,
  foreign key (tenant_id, accountable_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null)),
  check (starts_on is null or due_at is null or due_at::date >= starts_on)
);

create table app.kanban_card_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  card_id uuid not null,
  person_id uuid not null,
  assigned_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, card_id, person_id),
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (assigned_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.kanban_card_subtasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  card_id uuid not null,
  title text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null))
);

create table app.kanban_subtask_assignees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  subtask_id uuid not null,
  person_id uuid not null,
  assigned_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, subtask_id, person_id),
  foreign key (tenant_id, subtask_id) references app.kanban_card_subtasks(tenant_id, id) on delete restrict,
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (assigned_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.kanban_card_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  card_id uuid not null,
  card_version bigint not null check (card_version > 0),
  event_type text not null,
  actor_auth_user_id uuid not null,
  change_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(change_summary) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, card_id, card_version, event_type),
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict
);

create table app.team_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  team_id uuid not null,
  title text not null,
  description text,
  due_at timestamptz,
  assigned_person_id uuid,
  credit_minutes integer not null default 0 check (credit_minutes = 0),
  state text not null default 'open' check (state in ('open', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, team_id) references app.teams(tenant_id, id) on delete restrict,
  foreign key (tenant_id, assigned_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((state = 'completed') = (completed_at is not null))
);

create table app.team_task_market_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  team_task_id uuid not null,
  match_id uuid,
  referee_needed boolean not null default false,
  committee_id uuid not null,
  category_id uuid not null,
  task_type_version_id uuid not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id uuid,
  requested_minutes integer not null check (requested_minutes > 0),
  state text not null default 'requested'
    check (state in ('requested', 'reviewing', 'approved', 'published', 'rejected')),
  market_shift_id uuid,
  requested_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, team_task_id),
  unique (tenant_id, market_shift_id),
  foreign key (tenant_id, team_task_id) references app.team_tasks(tenant_id, id) on delete restrict,
  foreign key (tenant_id, match_id) references app.matches(tenant_id, id) on delete restrict,
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  foreign key (tenant_id, category_id) references app.task_categories(tenant_id, id) on delete restrict,
  foreign key (tenant_id, task_type_version_id) references app.task_type_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, location_id) references app.locations(tenant_id, id) on delete restrict,
  foreign key (tenant_id, market_shift_id) references app.shifts(tenant_id, id) on delete restrict,
  foreign key (requested_by_auth_user_id) references auth.users(id) on delete restrict,
  check (ends_at > starts_at),
  check (not referee_needed or match_id is not null),
  check ((state = 'published') = (market_shift_id is not null))
);

create table app.team_task_market_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  request_id uuid not null,
  request_version bigint not null check (request_version > 0),
  review_kind text not null check (review_kind in ('match', 'volunteer')),
  outcome text not null check (outcome in ('approved', 'rejected')),
  reviewer_auth_user_id uuid not null,
  reviewer_person_id uuid not null,
  approved_minutes integer,
  reason text not null,
  reviewed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, request_id, request_version, review_kind),
  foreign key (tenant_id, request_id) references app.team_task_market_requests(tenant_id, id) on delete restrict,
  foreign key (tenant_id, reviewer_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (reviewer_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (review_kind = 'match' and approved_minutes is null)
    or (review_kind = 'volunteer' and (
      (outcome = 'approved' and approved_minutes > 0)
      or (outcome = 'rejected' and approved_minutes is null)
    ))
  )
);

create table app.event_resource_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  occurrence_id uuid not null,
  card_id uuid,
  shift_id uuid,
  document_id uuid,
  match_id uuid,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, occurrence_id) references app.event_occurrences(tenant_id, id) on delete restrict,
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, document_id) references app.committee_documents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, match_id) references app.matches(tenant_id, id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check (num_nonnulls(card_id, shift_id, document_id, match_id) = 1)
);

create unique index event_resource_links_card_uq
  on app.event_resource_links (tenant_id, occurrence_id, card_id) where card_id is not null;
create unique index event_resource_links_shift_uq
  on app.event_resource_links (tenant_id, occurrence_id, shift_id) where shift_id is not null;
create unique index event_resource_links_document_uq
  on app.event_resource_links (tenant_id, occurrence_id, document_id) where document_id is not null;
create unique index event_resource_links_match_uq
  on app.event_resource_links (tenant_id, occurrence_id, match_id) where match_id is not null;

create table app.mentions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recipient_person_id uuid not null,
  author_person_id uuid not null,
  card_id uuid,
  occurrence_id uuid,
  source_event_id uuid not null,
  excerpt text not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, source_event_id, recipient_person_id),
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, author_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  foreign key (tenant_id, occurrence_id) references app.event_occurrences(tenant_id, id) on delete restrict,
  foreign key (tenant_id, source_event_id) references app.domain_events(tenant_id, id) on delete restrict,
  check (num_nonnulls(card_id, occurrence_id) = 1),
  check (char_length(excerpt) between 1 and 500)
);

create table app.card_checklist_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  card_id uuid not null,
  label text not null,
  position integer not null check (position >= 0),
  completed_at timestamptz,
  completed_by_auth_user_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, card_id, position),
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  foreign key (completed_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((completed_at is null) = (completed_by_auth_user_id is null))
);

create table app.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  template_key text not null,
  name text not null,
  owner_scope text not null check (owner_scope in ('tenant', 'committee')),
  committee_id uuid,
  current_revision integer not null default 0 check (current_revision >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, template_key),
  foreign key (tenant_id, committee_id) references app.committees(tenant_id, id) on delete restrict,
  check ((owner_scope = 'committee') = (committee_id is not null)),
  check (template_key ~ '^[a-z][a-z0-9_.-]*$')
);

create table app.message_template_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  template_id uuid not null,
  revision integer not null check (revision > 0),
  subject text not null,
  preheader text,
  sender_name text not null,
  reply_to text,
  html_body text not null,
  text_body text not null,
  button_json jsonb not null default '[]'::jsonb check (jsonb_typeof(button_json) = 'array'),
  variable_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(variable_schema) = 'object'),
  fallback_values jsonb not null default '{}'::jsonb check (jsonb_typeof(fallback_values) = 'object'),
  state text not null default 'draft'
    check (state in ('draft', 'previewed', 'test_sent', 'approved', 'published', 'retired')),
  approved_by_auth_user_id uuid,
  approved_at timestamptz,
  published_at timestamptz,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, template_id, revision),
  foreign key (tenant_id, template_id) references app.message_templates(tenant_id, id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((approved_by_auth_user_id is null) = (approved_at is null)),
  check (state not in ('approved', 'published', 'retired') or approved_at is not null),
  check ((state in ('published', 'retired')) = (published_at is not null))
);

create table app.template_test_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  template_version_id uuid not null,
  requested_by_auth_user_id uuid not null,
  recipient_reference_hash bytea not null,
  variable_snapshot jsonb not null check (jsonb_typeof(variable_snapshot) = 'object'),
  status text not null default 'planned' check (status in ('planned', 'rendered', 'accepted', 'failed')),
  error_code text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, template_version_id) references app.message_template_versions(tenant_id, id) on delete restrict,
  foreign key (requested_by_auth_user_id) references auth.users(id) on delete restrict,
  check ((status = 'failed') or error_code is null)
);

create table app.notification_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  category_key text not null,
  name text not null,
  essential boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, category_key),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  check (category_key ~ '^[a-z][a-z0-9_.-]*$')
);

create table app.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  person_id uuid not null,
  category_id uuid not null,
  channel text not null check (channel in ('email', 'push', 'inbox')),
  enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, person_id, category_id, channel),
  foreign key (tenant_id, person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, category_id) references app.notification_categories(tenant_id, id) on delete restrict
);

create table app.notification_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  domain_event_id uuid not null,
  recipient_person_id uuid not null,
  category_id uuid not null,
  channels text[] not null,
  dedupe_key text not null,
  safe_title text not null,
  safe_body text not null,
  source_path text,
  status text not null default 'planned' check (status in ('planned', 'queued', 'completed', 'suppressed')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, dedupe_key),
  unique (tenant_id, domain_event_id, recipient_person_id, category_id),
  foreign key (tenant_id, domain_event_id) references app.domain_events(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, category_id) references app.notification_categories(tenant_id, id) on delete restrict,
  check (cardinality(channels) > 0),
  check (channels <@ array['email', 'push', 'inbox']::text[]),
  check (char_length(safe_title) between 1 and 200),
  check (char_length(safe_body) between 1 and 1000)
);

create table app.task_offer_candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  intent_id uuid not null,
  recipient_person_id uuid not null,
  shift_id uuid not null,
  publication_event_id uuid not null,
  usable_until timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, recipient_person_id, shift_id),
  foreign key (tenant_id, intent_id) references app.notification_intents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, shift_id) references app.shifts(tenant_id, id) on delete restrict,
  foreign key (tenant_id, publication_event_id) references app.domain_events(tenant_id, id) on delete restrict
);

create table app.daily_task_digests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recipient_person_id uuid not null,
  local_date date not null,
  timezone text not null,
  status text not null default 'building'
    check (status in ('building', 'queued', 'provider_accepted', 'delivered', 'failed', 'unknown')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, recipient_person_id, local_date),
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict
);

create table app.daily_digest_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  digest_id uuid not null,
  task_offer_candidate_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, digest_id, task_offer_candidate_id),
  foreign key (tenant_id, digest_id) references app.daily_task_digests(tenant_id, id) on delete restrict,
  foreign key (tenant_id, task_offer_candidate_id) references app.task_offer_candidates(tenant_id, id) on delete restrict
);

create table app.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  intent_id uuid not null,
  recipient_person_id uuid not null,
  channel text not null check (channel in ('email', 'push', 'inbox')),
  template_version_id uuid,
  dedupe_key text not null,
  body_hash bytea not null,
  due_at timestamptz not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'provider_accepted', 'delivered', 'failed', 'unknown', 'suppressed')),
  lease_until timestamptz,
  provider_message_key text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, channel, dedupe_key),
  foreign key (tenant_id, intent_id) references app.notification_intents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, template_version_id) references app.message_template_versions(tenant_id, id) on delete restrict,
  check ((status = 'processing') = (lease_until is not null)),
  check (status not in ('provider_accepted', 'delivered', 'unknown') or provider_message_key is not null)
);

create index notification_outbox_due_idx
  on app.notification_outbox (status, due_at)
  where status in ('queued', 'failed');

create table app.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  outbox_id uuid not null,
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('processing', 'provider_accepted', 'failed', 'unknown')),
  provider_message_key text,
  error_code text,
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, outbox_id, attempt_number),
  foreign key (tenant_id, outbox_id) references app.notification_outbox(tenant_id, id) on delete restrict,
  check ((status = 'processing') = (completed_at is null)),
  check (status not in ('provider_accepted', 'unknown') or provider_message_key is not null),
  check ((status = 'failed') or error_code is null)
);

create table app.provider_delivery_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  outbox_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null check (event_type in ('accepted', 'delivered', 'bounced', 'failed')),
  occurred_at timestamptz not null,
  signature_verified boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, provider, provider_event_id),
  foreign key (tenant_id, outbox_id) references app.notification_outbox(tenant_id, id) on delete restrict,
  check (signature_verified)
);

create table app.inbox_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  intent_id uuid not null,
  recipient_person_id uuid not null,
  title text not null,
  body text not null,
  source_path text,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, intent_id),
  foreign key (tenant_id, intent_id) references app.notification_intents(tenant_id, id) on delete restrict,
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict
);

create table app.policy_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_key text not null,
  title text not null,
  owner_committee_id uuid,
  current_revision integer not null default 0 check (current_revision >= 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, document_key),
  foreign key (tenant_id, owner_committee_id) references app.committees(tenant_id, id) on delete restrict,
  check (document_key ~ '^[a-z][a-z0-9_.-]*$')
);

create table app.policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_id uuid not null,
  revision integer not null check (revision > 0),
  exact_body text not null,
  body_hash bytea not null,
  file_object_path text,
  state text not null default 'draft' check (state in ('draft', 'approved', 'published', 'retired')),
  effective_at timestamptz,
  response_due_at timestamptz,
  reacceptance_required boolean not null default true,
  approved_by_auth_user_id uuid,
  approved_at timestamptz,
  published_at timestamptz,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, document_id, revision),
  foreign key (tenant_id, document_id) references app.policy_documents(tenant_id, id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (created_by_auth_user_id) references auth.users(id) on delete restrict,
  check (char_length(exact_body) > 0),
  check ((approved_by_auth_user_id is null) = (approved_at is null)),
  check (state not in ('approved', 'published', 'retired') or approved_at is not null),
  check ((state in ('published', 'retired')) = (published_at is not null)),
  check (response_due_at is null or effective_at is null or response_due_at >= effective_at)
);

create table app.policy_audiences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  audience_key text not null,
  criteria_snapshot jsonb not null check (jsonb_typeof(criteria_snapshot) = 'object'),
  approved_by_auth_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, policy_version_id, audience_key),
  foreign key (tenant_id, policy_version_id) references app.policy_versions(tenant_id, id) on delete restrict,
  foreign key (approved_by_auth_user_id) references auth.users(id) on delete restrict
);

create table app.policy_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  audience_id uuid not null,
  member_person_id uuid not null,
  offered_at timestamptz not null default statement_timestamp(),
  due_at timestamptz,
  opened_at timestamptz,
  state text not null default 'offered'
    check (state in ('offered', 'opened', 'question_pending', 'accepted', 'expired')),
  reminder_paused boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, member_person_id, policy_version_id),
  foreign key (tenant_id, policy_version_id) references app.policy_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, audience_id) references app.policy_audiences(tenant_id, id) on delete restrict,
  foreign key (tenant_id, member_person_id) references app.persons(tenant_id, id) on delete restrict,
  check ((state = 'offered') = (opened_at is null)),
  check (state <> 'question_pending' or reminder_paused),
  check (due_at is null or due_at >= offered_at)
);

create table app.policy_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assignment_id uuid not null,
  author_auth_user_id uuid not null,
  author_person_id uuid not null,
  question_text text not null,
  state text not null default 'open' check (state in ('open', 'in_review', 'answered', 'closed')),
  handler_person_id uuid,
  resolution_text text,
  resolved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  foreign key (tenant_id, assignment_id) references app.policy_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, author_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, handler_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (author_auth_user_id) references auth.users(id) on delete restrict,
  check (char_length(question_text) between 1 and 5000),
  check ((state in ('answered', 'closed')) = (resolved_at is not null and resolution_text is not null))
);

create table app.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assignment_id uuid not null,
  member_person_id uuid not null,
  policy_version_id uuid not null,
  version_hash bytea not null,
  actor_auth_user_id uuid not null,
  actor_person_id uuid not null,
  capacity text not null check (capacity in ('self', 'guardian')),
  guardian_authorization_id uuid,
  explicit_confirmation boolean not null check (explicit_confirmation),
  accepted_at timestamptz not null default statement_timestamp(),
  idempotency_key uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, member_person_id, policy_version_id),
  unique (tenant_id, actor_auth_user_id, idempotency_key, assignment_id),
  foreign key (tenant_id, assignment_id) references app.policy_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, member_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, policy_version_id) references app.policy_versions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, guardian_authorization_id) references app.guardian_authorizations(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check (
    (capacity = 'self' and guardian_authorization_id is null and actor_person_id = member_person_id)
    or (capacity = 'guardian' and guardian_authorization_id is not null and actor_person_id <> member_person_id)
  )
);

create table app.policy_assignment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  assignment_id uuid not null,
  event_type text not null check (event_type in ('offered', 'opened', 'question_asked', 'accepted', 'expired')),
  actor_auth_user_id uuid,
  actor_person_id uuid,
  assignment_version bigint not null check (assignment_version > 0),
  occurred_at timestamptz not null default statement_timestamp(),
  payload_minimal jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_minimal) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  foreign key (tenant_id, assignment_id) references app.policy_assignments(tenant_id, id) on delete restrict,
  foreign key (tenant_id, actor_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check ((actor_auth_user_id is null) = (actor_person_id is null))
);

create table app.personal_action_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  recipient_person_id uuid not null,
  action_key text not null,
  action_kind text not null
    check (action_kind in ('card_assignment', 'subtask_assignment', 'mention', 'team_task', 'policy_follow_up')),
  card_id uuid,
  subtask_id uuid,
  mention_id uuid,
  team_task_id uuid,
  policy_question_id uuid,
  due_at timestamptz,
  state text not null default 'open' check (state in ('open', 'completed', 'dismissed')),
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, recipient_person_id, action_key),
  foreign key (tenant_id, recipient_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, card_id) references app.kanban_cards(tenant_id, id) on delete restrict,
  foreign key (tenant_id, subtask_id) references app.kanban_card_subtasks(tenant_id, id) on delete restrict,
  foreign key (tenant_id, mention_id) references app.mentions(tenant_id, id) on delete restrict,
  foreign key (tenant_id, team_task_id) references app.team_tasks(tenant_id, id) on delete restrict,
  foreign key (tenant_id, policy_question_id) references app.policy_questions(tenant_id, id) on delete restrict,
  check (num_nonnulls(card_id, subtask_id, mention_id, team_task_id, policy_question_id) = 1),
  check ((state = 'completed') = (completed_at is not null))
);

-- Keep parent/child tenant relationships compound, including the parent
-- context where a child key alone would otherwise be structurally valid.
alter table app.task_categories
  add constraint task_categories_tenant_id_committee_id_uq
  unique (tenant_id, id, committee_id);

alter table app.kanban_columns
  add constraint kanban_columns_tenant_id_board_id_uq
  unique (tenant_id, id, board_id);

alter table app.kanban_cards
  drop constraint kanban_cards_tenant_id_column_id_fkey,
  add constraint kanban_cards_tenant_column_board_fk
    foreign key (tenant_id, column_id, board_id)
    references app.kanban_columns(tenant_id, id, board_id)
    on delete restrict;

alter table app.team_task_market_requests
  drop constraint team_task_market_requests_tenant_id_category_id_fkey,
  add constraint team_task_market_requests_tenant_category_committee_fk
    foreign key (tenant_id, category_id, committee_id)
    references app.task_categories(tenant_id, id, committee_id)
    on delete restrict;

alter table app.policy_audiences
  add constraint policy_audiences_tenant_id_version_id_uq
  unique (tenant_id, id, policy_version_id);

alter table app.policy_assignments
  drop constraint policy_assignments_tenant_id_audience_id_fkey,
  add constraint policy_assignments_tenant_audience_version_fk
    foreign key (tenant_id, audience_id, policy_version_id)
    references app.policy_audiences(tenant_id, id, policy_version_id)
    on delete restrict;

create or replace function internal.seed_wp6_wp8_permissions(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = ''
as $function$
  insert into app.role_permissions (tenant_id, role_id, permission_key)
  select p_tenant_id, role_row.id, mapping.permission_key
  from app.permission_roles as role_row
  join (
    values
      ('member', 'match.view'),
      ('member', 'agenda.view'),
      ('fixed_volunteer', 'match.view'),
      ('fixed_volunteer', 'agenda.view'),
      ('committee_coordinator', 'committee.workspace.view'),
      ('committee_coordinator', 'committee.workspace.manage'),
      ('committee_coordinator', 'match.view'),
      ('committee_coordinator', 'agenda.view'),
      ('committee_coordinator', 'agenda.manage'),
      ('committee_coordinator', 'communication.manage'),
      ('volunteer_coordinator', 'committee.workspace.view'),
      ('volunteer_coordinator', 'team_task.view'),
      ('volunteer_coordinator', 'match.view'),
      ('volunteer_coordinator', 'agenda.view'),
      ('volunteer_coordinator', 'communication.manage'),
      ('volunteer_committee', 'committee.workspace.view'),
      ('volunteer_committee', 'team_task.view'),
      ('volunteer_committee', 'team_task.market.approve'),
      ('volunteer_committee', 'team_task.market.publish'),
      ('volunteer_committee', 'match.view'),
      ('volunteer_committee', 'agenda.view'),
      ('volunteer_committee', 'communication.manage'),
      ('volunteer_committee', 'policy.follow_up'),
      ('team_parent', 'team_task.view'),
      ('team_parent', 'team_task.manage'),
      ('team_parent', 'match.view'),
      ('team_parent', 'agenda.view'),
      ('team_parent', 'agenda.manage'),
      ('board', 'match.view'),
      ('board', 'match.import'),
      ('board', 'match.review'),
      ('board', 'agenda.view'),
      ('board', 'agenda.manage'),
      ('board', 'communication.manage'),
      ('board', 'policy.manage'),
      ('board', 'policy.follow_up')
  ) as mapping(role_key, permission_key)
    on mapping.role_key = role_row.role_key
  where role_row.tenant_id = p_tenant_id
  on conflict (tenant_id, role_id, permission_key) do nothing;
$function$;

alter function internal.seed_wp6_wp8_permissions(uuid) owner to cluvo_command_owner;
revoke execute on function internal.seed_wp6_wp8_permissions(uuid)
  from public, anon, authenticated, service_role;

select internal.seed_wp6_wp8_permissions(tenant.id)
from app.tenants as tenant;

create or replace function internal.seed_wp6_wp8_permissions_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform internal.seed_wp6_wp8_permissions(new.id);
  return new;
end;
$function$;

alter function internal.seed_wp6_wp8_permissions_trigger() owner to cluvo_command_owner;
revoke execute on function internal.seed_wp6_wp8_permissions_trigger()
  from public, anon, authenticated, service_role;

create trigger zz_tenants_seed_wp6_wp8_permissions
after insert on app.tenants
for each row execute function internal.seed_wp6_wp8_permissions_trigger();

create or replace function internal.current_person_id(p_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select link.person_id
  from app.account_person_links as link
  join app.tenant_memberships as membership
    on membership.tenant_id = link.tenant_id
   and membership.auth_user_id = link.auth_user_id
   and membership.status = 'active'
   and membership.starts_at <= statement_timestamp()
   and (membership.ends_at is null or membership.ends_at > statement_timestamp())
  join app.tenants as tenant
    on tenant.id = membership.tenant_id
   and tenant.status = 'active'
  where link.tenant_id = p_tenant_id
    and link.auth_user_id = (select internal.current_actor_uid())
    and link.revoked_at is null
  limit 1;
$function$;

create or replace function internal.person_is_active_member(
  p_tenant_id uuid,
  p_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app.account_person_links as link
    join app.tenant_memberships as membership
      on membership.tenant_id = link.tenant_id
     and membership.auth_user_id = link.auth_user_id
     and membership.status = 'active'
     and membership.starts_at <= statement_timestamp()
     and (membership.ends_at is null or membership.ends_at > statement_timestamp())
    join app.tenants as tenant
      on tenant.id = membership.tenant_id
     and tenant.status = 'active'
    where link.tenant_id = p_tenant_id
      and link.person_id = p_person_id
      and link.revoked_at is null
  );
$function$;

create or replace function internal.person_has_permission(
  p_tenant_id uuid,
  p_person_id uuid,
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
  select exists (
    select 1
    from app.account_person_links as link
    join app.tenant_memberships as membership
      on membership.tenant_id = link.tenant_id
     and membership.auth_user_id = link.auth_user_id
     and membership.status = 'active'
     and membership.starts_at <= statement_timestamp()
     and (membership.ends_at is null or membership.ends_at > statement_timestamp())
    join app.tenants as tenant
      on tenant.id = membership.tenant_id
     and tenant.status = 'active'
    join app.access_grants as grant_row
      on grant_row.tenant_id = link.tenant_id
     and grant_row.auth_user_id = link.auth_user_id
     and grant_row.starts_at <= statement_timestamp()
     and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
     and grant_row.revoked_at is null
    join app.role_permissions as role_permission
      on role_permission.tenant_id = grant_row.tenant_id
     and role_permission.role_id = grant_row.role_id
     and role_permission.permission_key = p_permission_key
    where link.tenant_id = p_tenant_id
      and link.person_id = p_person_id
      and link.revoked_at is null
      and (
        grant_row.scope_kind = 'tenant'
        or (p_scope_kind = 'committee' and grant_row.scope_kind = 'committee' and grant_row.committee_id = p_scope_id)
        or (p_scope_kind = 'team' and grant_row.scope_kind = 'team' and grant_row.team_id = p_scope_id)
        or (p_scope_kind = 'household' and grant_row.scope_kind = 'household' and grant_row.household_id = p_scope_id)
      )
  );
$function$;

create or replace function internal.can_person_view_team(
  p_tenant_id uuid,
  p_person_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.person_is_active_member(p_tenant_id, p_person_id)
    and (
      internal.person_has_permission(p_tenant_id, p_person_id, 'match.view', 'team', p_team_id)
      or internal.person_has_permission(p_tenant_id, p_person_id, 'team_task.view', 'team', p_team_id)
      or exists (
        select 1
        from app.team_person_memberships as team_membership
        where team_membership.tenant_id = p_tenant_id
          and team_membership.team_id = p_team_id
          and team_membership.person_id = p_person_id
          and team_membership.starts_at <= statement_timestamp()
          and (team_membership.ends_at is null or team_membership.ends_at > statement_timestamp())
      )
      or exists (
        select 1
        from app.household_person_links as actor_household
        join app.household_access_grants as household_grant
          on household_grant.tenant_id = actor_household.tenant_id
         and household_grant.household_id = actor_household.household_id
         and household_grant.can_view_progress
         and household_grant.starts_at <= statement_timestamp()
         and (household_grant.ends_at is null or household_grant.ends_at > statement_timestamp())
         and household_grant.revoked_at is null
        join app.account_person_links as actor_link
          on actor_link.tenant_id = household_grant.tenant_id
         and actor_link.auth_user_id = household_grant.auth_user_id
         and actor_link.person_id = p_person_id
         and actor_link.revoked_at is null
        join app.household_person_links as child_link
          on child_link.tenant_id = actor_household.tenant_id
         and child_link.household_id = actor_household.household_id
         and child_link.kind = 'member'
         and child_link.starts_at <= statement_timestamp()
         and (child_link.ends_at is null or child_link.ends_at > statement_timestamp())
        join app.team_person_memberships as child_team
          on child_team.tenant_id = child_link.tenant_id
         and child_team.person_id = child_link.person_id
         and child_team.team_id = p_team_id
         and child_team.membership_kind = 'player'
         and child_team.starts_at <= statement_timestamp()
         and (child_team.ends_at is null or child_team.ends_at > statement_timestamp())
        where actor_household.tenant_id = p_tenant_id
          and actor_household.person_id = p_person_id
          and actor_household.starts_at <= statement_timestamp()
          and (actor_household.ends_at is null or actor_household.ends_at > statement_timestamp())
      )
    );
$function$;

create or replace function internal.can_person_view_card(
  p_tenant_id uuid,
  p_person_id uuid,
  p_card_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app.kanban_cards as card
    join app.kanban_boards as board
      on board.tenant_id = card.tenant_id and board.id = card.board_id
    where card.tenant_id = p_tenant_id
      and card.id = p_card_id
      and (
        card.accountable_person_id = p_person_id
        or internal.person_has_permission(
          p_tenant_id, p_person_id, 'committee.workspace.view', 'committee', board.committee_id
        )
        or exists (
          select 1 from app.kanban_card_assignees as assignee
          where assignee.tenant_id = card.tenant_id
            and assignee.card_id = card.id
            and assignee.person_id = p_person_id
        )
        or exists (
          select 1
          from app.kanban_card_subtasks as subtask
          join app.kanban_subtask_assignees as subtask_assignee
            on subtask_assignee.tenant_id = subtask.tenant_id
           and subtask_assignee.subtask_id = subtask.id
          where subtask.tenant_id = card.tenant_id
            and subtask.card_id = card.id
            and subtask_assignee.person_id = p_person_id
        )
      )
  );
$function$;

create or replace function internal.can_person_view_event(
  p_tenant_id uuid,
  p_person_id uuid,
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app.events as event_row
    where event_row.tenant_id = p_tenant_id
      and event_row.id = p_event_id
      and internal.person_is_active_member(p_tenant_id, p_person_id)
      and (
        event_row.organizer_person_id = p_person_id
        or event_row.visibility = 'tenant'
        or (
          event_row.visibility = 'committee'
          and internal.person_has_permission(
            p_tenant_id, p_person_id, 'committee.workspace.view', 'committee', event_row.committee_id
          )
        )
        or (
          event_row.visibility = 'team'
          and internal.can_person_view_team(p_tenant_id, p_person_id, event_row.team_id)
        )
        or exists (
          select 1
          from app.event_occurrences as occurrence
          join app.event_attendees as attendee
            on attendee.tenant_id = occurrence.tenant_id
           and attendee.occurrence_id = occurrence.id
          where occurrence.tenant_id = event_row.tenant_id
            and occurrence.event_id = event_row.id
            and attendee.person_id = p_person_id
        )
      )
  );
$function$;

create or replace function internal.can_person_view_document(
  p_tenant_id uuid,
  p_person_id uuid,
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app.committee_documents as document
    where document.tenant_id = p_tenant_id
      and document.id = p_document_id
      and internal.person_is_active_member(p_tenant_id, p_person_id)
      and (
        document.owner_person_id = p_person_id
        or document.visibility = 'tenant'
        or (
          document.visibility = 'committee'
          and internal.person_has_permission(
            p_tenant_id, p_person_id, 'committee.workspace.view', 'committee', document.committee_id
          )
        )
        or (
          document.visibility = 'team'
          and internal.can_person_view_team(p_tenant_id, p_person_id, document.team_id)
        )
        or exists (
          select 1
          from app.committee_document_acl as acl
          where acl.tenant_id = document.tenant_id
            and acl.document_id = document.id
            and acl.person_id = p_person_id
            and acl.can_read
            and acl.starts_at <= statement_timestamp()
            and (acl.ends_at is null or acl.ends_at > statement_timestamp())
        )
      )
  );
$function$;

create or replace function internal.can_person_view_policy_assignment(
  p_tenant_id uuid,
  p_person_id uuid,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app.policy_assignments as assignment
    where assignment.tenant_id = p_tenant_id
      and assignment.id = p_assignment_id
      and (
        assignment.member_person_id = p_person_id
        or exists (
          select 1
          from app.guardian_authorizations as guardian_authorization
          where guardian_authorization.tenant_id = assignment.tenant_id
            and guardian_authorization.guardian_person_id = p_person_id
            and guardian_authorization.represented_member_id = assignment.member_person_id
            and guardian_authorization.scope = 'policy_acceptance'
            and guardian_authorization.valid_from <= statement_timestamp()
            and (
              guardian_authorization.valid_until is null
              or guardian_authorization.valid_until > statement_timestamp()
            )
            and guardian_authorization.revoked_at is null
        )
        or internal.person_has_permission(
          p_tenant_id, p_person_id, 'policy.follow_up', 'tenant', p_tenant_id
        )
        or internal.person_has_permission(
          p_tenant_id, p_person_id, 'policy.manage', 'tenant', p_tenant_id
        )
      )
  );
$function$;

create or replace function internal.can_person_act_on_policy_assignment(
  p_tenant_id uuid,
  p_person_id uuid,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.person_is_active_member(p_tenant_id, p_person_id)
    and exists (
      select 1
      from app.policy_assignments as assignment
      where assignment.tenant_id = p_tenant_id
        and assignment.id = p_assignment_id
        and (
          assignment.member_person_id = p_person_id
          or exists (
            select 1
            from app.guardian_authorizations as guardian_authorization
            where guardian_authorization.tenant_id = assignment.tenant_id
              and guardian_authorization.guardian_person_id = p_person_id
              and guardian_authorization.represented_member_id = assignment.member_person_id
              and guardian_authorization.scope = 'policy_acceptance'
              and guardian_authorization.valid_from <= statement_timestamp()
              and (
                guardian_authorization.valid_until is null
                or guardian_authorization.valid_until > statement_timestamp()
              )
              and guardian_authorization.revoked_at is null
          )
        )
    );
$function$;

create or replace function internal.resolve_local_slot(
  p_local_date date,
  p_local_time time,
  p_timezone text
)
returns table (
  scheduled_at timestamptz,
  effective_local_time time,
  dst_resolution text
)
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_requested timestamp := p_local_date + p_local_time;
  v_default timestamptz;
  v_first_utc timestamptz;
  v_match_count integer;
  v_effective_local timestamp;
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;

  v_default := v_requested at time zone p_timezone;

  select min(candidate), count(*)::integer
  into v_first_utc, v_match_count
  from pg_catalog.generate_series(
    v_default - interval '3 hours',
    v_default + interval '3 hours',
    interval '1 minute'
  ) as candidate
  where candidate at time zone p_timezone = v_requested;

  if v_match_count > 0 then
    return query select
      v_first_utc,
      p_local_time,
      case when v_match_count > 1 then 'fold_first' else 'exact' end;
    return;
  end if;

  select local_candidate
  into v_effective_local
  from pg_catalog.generate_series(
    v_requested,
    v_requested + interval '3 hours',
    interval '1 minute'
  ) as local_candidate
  where (local_candidate at time zone p_timezone) at time zone p_timezone = local_candidate
  order by local_candidate
  limit 1;

  if v_effective_local is null then
    raise exception using errcode = '22023', message = 'UNRESOLVABLE_LOCAL_TIME';
  end if;

  return query select
    v_effective_local at time zone p_timezone,
    v_effective_local::time,
    'gap_shift_forward'::text;
end;
$function$;

alter function internal.current_person_id(uuid) owner to cluvo_command_owner;
alter function internal.person_is_active_member(uuid, uuid) owner to cluvo_command_owner;
alter function internal.person_has_permission(uuid, uuid, text, text, uuid) owner to cluvo_command_owner;
alter function internal.can_person_view_team(uuid, uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_person_view_card(uuid, uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_person_view_event(uuid, uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_person_view_document(uuid, uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_person_view_policy_assignment(uuid, uuid, uuid) owner to cluvo_command_owner;
alter function internal.can_person_act_on_policy_assignment(uuid, uuid, uuid) owner to cluvo_command_owner;
alter function internal.resolve_local_slot(date, time, text) owner to cluvo_command_owner;

revoke execute on function internal.current_person_id(uuid) from public, anon, service_role;
revoke execute on function internal.person_is_active_member(uuid, uuid) from public, anon, service_role;
revoke execute on function internal.person_has_permission(uuid, uuid, text, text, uuid) from public, anon, service_role;
revoke execute on function internal.can_person_view_team(uuid, uuid, uuid) from public, anon, service_role;
revoke execute on function internal.can_person_view_card(uuid, uuid, uuid) from public, anon, service_role;
revoke execute on function internal.can_person_view_event(uuid, uuid, uuid) from public, anon, service_role;
revoke execute on function internal.can_person_view_document(uuid, uuid, uuid) from public, anon, service_role;
revoke execute on function internal.can_person_view_policy_assignment(uuid, uuid, uuid) from public, anon, service_role;
revoke execute on function internal.can_person_act_on_policy_assignment(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke execute on function internal.resolve_local_slot(date, time, text) from public, anon, service_role;

grant execute on function internal.current_person_id(uuid) to authenticated;
grant execute on function internal.person_is_active_member(uuid, uuid) to authenticated;
grant execute on function internal.person_has_permission(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function internal.can_person_view_team(uuid, uuid, uuid) to authenticated;
grant execute on function internal.can_person_view_card(uuid, uuid, uuid) to authenticated;
grant execute on function internal.can_person_view_event(uuid, uuid, uuid) to authenticated;
grant execute on function internal.can_person_view_document(uuid, uuid, uuid) to authenticated;
grant execute on function internal.can_person_view_policy_assignment(uuid, uuid, uuid) to authenticated;
grant execute on function internal.can_person_act_on_policy_assignment(uuid, uuid, uuid)
  to cluvo_command_owner;

create or replace function internal.guard_published_template_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' or old.state in ('published', 'retired') then
    raise exception using errcode = '55000', message = 'published template version is immutable';
  end if;
  return new;
end;
$function$;

create or replace function internal.guard_published_policy_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' or old.state in ('published', 'retired') then
    raise exception using errcode = '55000', message = 'published policy version is immutable';
  end if;
  return new;
end;
$function$;

create or replace function internal.set_policy_version_body_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Store the digest alongside the exact bytes that were shown. PostgreSQL's
  -- convert_to is stable (not immutable), so this cannot be a generated column.
  new.body_hash := extensions.digest(convert_to(new.exact_body, 'UTF8'), 'sha256');
  return new;
end;
$function$;

create or replace function internal.validate_policy_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assignment app.policy_assignments%rowtype;
  v_policy_version app.policy_versions%rowtype;
begin
  select * into strict v_assignment
  from app.policy_assignments
  where tenant_id = new.tenant_id and id = new.assignment_id;

  select * into strict v_policy_version
  from app.policy_versions
  where tenant_id = new.tenant_id and id = new.policy_version_id;

  if v_assignment.member_person_id <> new.member_person_id
    or v_assignment.policy_version_id <> new.policy_version_id
    or v_policy_version.state <> 'published'
    or v_policy_version.body_hash <> new.version_hash then
    raise exception using errcode = '23514', message = 'POLICY_ACCEPTANCE_VERSION_MISMATCH';
  end if;

  if not exists (
    select 1
    from app.account_person_links as link
    where link.tenant_id = new.tenant_id
      and link.auth_user_id = new.actor_auth_user_id
      and link.person_id = new.actor_person_id
      and link.revoked_at is null
  ) then
    raise exception using errcode = '23514', message = 'POLICY_ACCEPTANCE_ACTOR_MISMATCH';
  end if;

  if new.capacity = 'guardian' and not exists (
    select 1
    from app.guardian_authorizations as guardian_authorization
    where guardian_authorization.tenant_id = new.tenant_id
      and guardian_authorization.id = new.guardian_authorization_id
      and guardian_authorization.guardian_person_id = new.actor_person_id
      and guardian_authorization.represented_member_id = new.member_person_id
      and guardian_authorization.scope = 'policy_acceptance'
      and guardian_authorization.valid_from <= new.accepted_at
      and (
        guardian_authorization.valid_until is null
        or guardian_authorization.valid_until > new.accepted_at
      )
      and guardian_authorization.revoked_at is null
  ) then
    raise exception using errcode = '23514', message = 'GUARDIAN_AUTHORIZATION_REQUIRED';
  end if;

  return new;
end;
$function$;

create or replace function internal.validate_mention_recipient_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
begin
  if new.card_id is not null then
    if not internal.can_person_view_card(new.tenant_id, new.recipient_person_id, new.card_id) then
      raise exception using errcode = '42501', message = 'MENTION_RECIPIENT_CANNOT_ACCESS_SOURCE';
    end if;
  else
    select occurrence.event_id into strict v_event_id
    from app.event_occurrences as occurrence
    where occurrence.tenant_id = new.tenant_id and occurrence.id = new.occurrence_id;

    if not internal.can_person_view_event(new.tenant_id, new.recipient_person_id, v_event_id) then
      raise exception using errcode = '42501', message = 'MENTION_RECIPIENT_CANNOT_ACCESS_SOURCE';
    end if;
  end if;
  return new;
end;
$function$;

alter function internal.guard_published_template_version() owner to cluvo_command_owner;
alter function internal.guard_published_policy_version() owner to cluvo_command_owner;
alter function internal.set_policy_version_body_hash() owner to cluvo_command_owner;
alter function internal.validate_policy_acceptance() owner to cluvo_command_owner;
alter function internal.validate_mention_recipient_access() owner to cluvo_command_owner;
revoke execute on function internal.guard_published_template_version() from public, anon, authenticated, service_role;
revoke execute on function internal.guard_published_policy_version() from public, anon, authenticated, service_role;
revoke execute on function internal.set_policy_version_body_hash() from public, anon, authenticated, service_role;
revoke execute on function internal.validate_policy_acceptance() from public, anon, authenticated, service_role;
revoke execute on function internal.validate_mention_recipient_access() from public, anon, authenticated, service_role;

create trigger message_template_versions_guard_published
before update or delete on app.message_template_versions
for each row execute function internal.guard_published_template_version();
create trigger policy_versions_guard_published
before update or delete on app.policy_versions
for each row execute function internal.guard_published_policy_version();
create trigger policy_versions_set_body_hash
before insert or update of exact_body on app.policy_versions
for each row execute function internal.set_policy_version_body_hash();
create trigger policy_acceptances_validate
before insert on app.policy_acceptances
for each row execute function internal.validate_policy_acceptance();
create trigger mentions_validate_recipient_access
before insert on app.mentions
for each row execute function internal.validate_mention_recipient_access();

create trigger committee_document_versions_immutable
before update or delete on app.committee_document_versions
for each row execute function internal.reject_immutable_change();
create trigger match_revisions_immutable
before update or delete on app.match_revisions
for each row execute function internal.reject_immutable_change();
create trigger kanban_card_history_immutable
before update or delete on app.kanban_card_history
for each row execute function internal.reject_immutable_change();
create trigger team_task_market_reviews_immutable
before update or delete on app.team_task_market_reviews
for each row execute function internal.reject_immutable_change();
create trigger provider_delivery_events_immutable
before update or delete on app.provider_delivery_events
for each row execute function internal.reject_immutable_change();
create trigger policy_acceptances_immutable
before update or delete on app.policy_acceptances
for each row execute function internal.reject_immutable_change();
create trigger policy_assignment_events_immutable
before update or delete on app.policy_assignment_events
for each row execute function internal.reject_immutable_change();

do $secure_new_tables$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'team_person_memberships',
    'committee_documents', 'committee_document_versions', 'committee_document_acl',
    'integration_connections', 'integration_runs', 'matches', 'match_revisions',
    'match_shift_links', 'match_change_impacts', 'scheduled_occurrences',
    'events', 'event_occurrences', 'event_attendees',
    'kanban_boards', 'kanban_columns', 'kanban_cards', 'kanban_card_assignees',
    'kanban_card_subtasks', 'kanban_subtask_assignees', 'kanban_card_history',
    'team_tasks', 'team_task_market_requests', 'team_task_market_reviews',
    'event_resource_links', 'mentions', 'card_checklist_items',
    'message_templates', 'message_template_versions', 'template_test_runs',
    'notification_categories', 'notification_preferences', 'notification_intents',
    'task_offer_candidates', 'daily_task_digests', 'daily_digest_items',
    'notification_outbox', 'delivery_attempts', 'provider_delivery_events', 'inbox_items',
    'policy_documents', 'policy_versions', 'policy_audiences', 'policy_assignments',
    'policy_questions', 'policy_acceptances', 'policy_assignment_events',
    'personal_action_items'
  ]
  loop
    execute format('alter table app.%I enable row level security', relation_name);
    execute format('alter table app.%I force row level security', relation_name);
    execute format('revoke all on table app.%I from public, anon, authenticated, service_role', relation_name);
    execute format('grant select, insert, update on table app.%I to cluvo_command_owner', relation_name);
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
end;
$secure_new_tables$;

-- The market-publication command creates a real shift while all ordinary
-- authenticated users retain read-only access to domain relations.
grant select, insert, update on app.shifts to cluvo_command_owner;
create policy command_owner_insert on app.shifts
  for insert to cluvo_command_owner with check (true);
create policy command_owner_update on app.shifts
  for update to cluvo_command_owner using (true) with check (true);

create policy own_team_memberships on app.team_person_memberships
  for select to authenticated
  using (
    (select internal.is_self_person(tenant_id, person_id))
    or (select internal.has_permission(tenant_id, 'team_task.view', 'team', team_id))
    or (select internal.has_permission(tenant_id, 'match.view', 'team', team_id))
  );

create policy visible_committee_documents on app.committee_documents
  for select to authenticated
  using (
    (select internal.can_person_view_document(
      tenant_id, internal.current_person_id(tenant_id), id
    ))
  );
create policy visible_committee_document_versions on app.committee_document_versions
  for select to authenticated
  using (
    (select internal.can_person_view_document(
      tenant_id, internal.current_person_id(tenant_id), document_id
    ))
  );
create policy visible_committee_document_acl on app.committee_document_acl
  for select to authenticated
  using (
    person_id = (select internal.current_person_id(tenant_id))
    or (select internal.can_person_view_document(
      tenant_id, internal.current_person_id(tenant_id), document_id
    ))
  );

create policy import_managers_connections on app.integration_connections
  for select to authenticated
  using ((select internal.has_permission(tenant_id, 'match.import', 'tenant', tenant_id)));
create policy import_managers_runs on app.integration_runs
  for select to authenticated
  using ((select internal.has_permission(tenant_id, 'match.import', 'tenant', tenant_id)));

create policy visible_matches on app.matches
  for select to authenticated
  using (
    (select internal.can_person_view_team(
      tenant_id, internal.current_person_id(tenant_id), team_id
    ))
  );
create policy visible_match_revisions on app.match_revisions
  for select to authenticated
  using (
    exists (
      select 1 from app.matches as match_row
      where match_row.tenant_id = match_revisions.tenant_id
        and match_row.id = match_revisions.match_id
        and internal.can_person_view_team(
          match_row.tenant_id,
          internal.current_person_id(match_row.tenant_id),
          match_row.team_id
        )
    )
  );
create policy visible_match_shift_links on app.match_shift_links
  for select to authenticated
  using (
    exists (
      select 1
      from app.matches as match_row
      join app.shifts as shift_row
        on shift_row.tenant_id = match_shift_links.tenant_id
       and shift_row.id = match_shift_links.shift_id
      where match_row.tenant_id = match_shift_links.tenant_id
        and match_row.id = match_shift_links.match_id
        and internal.can_person_view_team(
          match_row.tenant_id,
          internal.current_person_id(match_row.tenant_id),
          match_row.team_id
        )
        and (
          shift_row.state = 'published'
          or internal.has_permission(
            shift_row.tenant_id, 'shift.manage', 'committee', shift_row.committee_id
          )
        )
    )
  );
create policy visible_match_change_impacts on app.match_change_impacts
  for select to authenticated
  using (
    exists (
      select 1
      from app.match_revisions as revision
      join app.matches as match_row
        on match_row.tenant_id = revision.tenant_id and match_row.id = revision.match_id
      where revision.tenant_id = match_change_impacts.tenant_id
        and revision.id = match_change_impacts.match_revision_id
        and internal.can_person_view_team(
          match_row.tenant_id,
          internal.current_person_id(match_row.tenant_id),
          match_row.team_id
        )
    )
  );
create policy import_managers_scheduled_occurrences on app.scheduled_occurrences
  for select to authenticated
  using ((select internal.has_permission(tenant_id, 'match.import', 'tenant', tenant_id)));

create policy visible_events on app.events
  for select to authenticated
  using (
    (select internal.can_person_view_event(
      tenant_id, internal.current_person_id(tenant_id), id
    ))
  );
create policy visible_event_occurrences on app.event_occurrences
  for select to authenticated
  using (
    (select internal.can_person_view_event(
      tenant_id, internal.current_person_id(tenant_id), event_id
    ))
  );
create policy visible_event_attendees on app.event_attendees
  for select to authenticated
  using (
    person_id = (select internal.current_person_id(tenant_id))
    or exists (
      select 1
      from app.event_occurrences as occurrence
      where occurrence.tenant_id = event_attendees.tenant_id
        and occurrence.id = event_attendees.occurrence_id
        and internal.can_person_view_event(
          occurrence.tenant_id,
          internal.current_person_id(occurrence.tenant_id),
          occurrence.event_id
        )
    )
  );

create policy visible_kanban_boards on app.kanban_boards
  for select to authenticated
  using (
    (select internal.has_permission(
      tenant_id, 'committee.workspace.view', 'committee', committee_id
    ))
    or exists (
      select 1
      from app.kanban_cards as card
      where card.tenant_id = kanban_boards.tenant_id
        and card.board_id = kanban_boards.id
        and internal.can_person_view_card(
          card.tenant_id, internal.current_person_id(card.tenant_id), card.id
        )
    )
  );
create policy visible_kanban_columns on app.kanban_columns
  for select to authenticated
  using (
    exists (
      select 1 from app.kanban_boards as board
      where board.tenant_id = kanban_columns.tenant_id
        and board.id = kanban_columns.board_id
    )
  );
create policy visible_kanban_cards on app.kanban_cards
  for select to authenticated
  using (
    (select internal.can_person_view_card(
      tenant_id, internal.current_person_id(tenant_id), id
    ))
  );
create policy visible_kanban_card_assignees on app.kanban_card_assignees
  for select to authenticated
  using (
    (select internal.can_person_view_card(
      tenant_id, internal.current_person_id(tenant_id), card_id
    ))
  );
create policy visible_kanban_card_subtasks on app.kanban_card_subtasks
  for select to authenticated
  using (
    (select internal.can_person_view_card(
      tenant_id, internal.current_person_id(tenant_id), card_id
    ))
  );
create policy visible_kanban_subtask_assignees on app.kanban_subtask_assignees
  for select to authenticated
  using (
    exists (
      select 1 from app.kanban_card_subtasks as subtask
      where subtask.tenant_id = kanban_subtask_assignees.tenant_id
        and subtask.id = kanban_subtask_assignees.subtask_id
        and internal.can_person_view_card(
          subtask.tenant_id, internal.current_person_id(subtask.tenant_id), subtask.card_id
        )
    )
  );
create policy visible_kanban_card_history on app.kanban_card_history
  for select to authenticated
  using (
    (select internal.can_person_view_card(
      tenant_id, internal.current_person_id(tenant_id), card_id
    ))
  );
create policy visible_card_checklist_items on app.card_checklist_items
  for select to authenticated
  using (
    (select internal.can_person_view_card(
      tenant_id, internal.current_person_id(tenant_id), card_id
    ))
  );

create policy visible_team_tasks on app.team_tasks
  for select to authenticated
  using (
    (select internal.can_person_view_team(
      tenant_id, internal.current_person_id(tenant_id), team_id
    ))
  );
create policy visible_team_task_market_requests on app.team_task_market_requests
  for select to authenticated
  using (
    exists (
      select 1 from app.team_tasks as task
      where task.tenant_id = team_task_market_requests.tenant_id
        and task.id = team_task_market_requests.team_task_id
        and (
          internal.can_person_view_team(
            task.tenant_id, internal.current_person_id(task.tenant_id), task.team_id
          )
          or internal.has_permission(
            task.tenant_id, 'team_task.market.approve', 'tenant', task.tenant_id
          )
        )
    )
  );
create policy visible_team_task_market_reviews on app.team_task_market_reviews
  for select to authenticated
  using (
    exists (
      select 1
      from app.team_task_market_requests as request
      join app.team_tasks as task
        on task.tenant_id = request.tenant_id and task.id = request.team_task_id
      where request.tenant_id = team_task_market_reviews.tenant_id
        and request.id = team_task_market_reviews.request_id
        and (
          internal.can_person_view_team(
            task.tenant_id, internal.current_person_id(task.tenant_id), task.team_id
          )
          or internal.has_permission(
            task.tenant_id, 'team_task.market.approve', 'tenant', task.tenant_id
          )
        )
    )
  );

create policy visible_event_resource_links on app.event_resource_links
  for select to authenticated
  using (
    exists (
      select 1
      from app.event_occurrences as occurrence
      where occurrence.tenant_id = event_resource_links.tenant_id
        and occurrence.id = event_resource_links.occurrence_id
        and internal.can_person_view_event(
          occurrence.tenant_id,
          internal.current_person_id(occurrence.tenant_id),
          occurrence.event_id
        )
    )
    and (
      card_id is null or internal.can_person_view_card(
        tenant_id, internal.current_person_id(tenant_id), card_id
      )
    )
    and (
      document_id is null or internal.can_person_view_document(
        tenant_id, internal.current_person_id(tenant_id), document_id
      )
    )
    and (
      match_id is null or exists (
        select 1 from app.matches as match_row
        where match_row.tenant_id = event_resource_links.tenant_id
          and match_row.id = event_resource_links.match_id
          and internal.can_person_view_team(
            match_row.tenant_id,
            internal.current_person_id(match_row.tenant_id),
            match_row.team_id
          )
      )
    )
    and (
      shift_id is null or exists (
        select 1 from app.shifts as shift_row
        where shift_row.tenant_id = event_resource_links.tenant_id
          and shift_row.id = event_resource_links.shift_id
          and (
            shift_row.state = 'published'
            or internal.has_permission(
              shift_row.tenant_id, 'shift.manage', 'committee', shift_row.committee_id
            )
          )
      )
    )
  );
create policy visible_mentions on app.mentions
  for select to authenticated
  using (
    recipient_person_id = (select internal.current_person_id(tenant_id))
    and (
      card_id is null or internal.can_person_view_card(
        tenant_id, recipient_person_id, card_id
      )
    )
    and (
      occurrence_id is null or exists (
        select 1 from app.event_occurrences as occurrence
        where occurrence.tenant_id = mentions.tenant_id
          and occurrence.id = mentions.occurrence_id
          and internal.can_person_view_event(
            occurrence.tenant_id, recipient_person_id, occurrence.event_id
          )
      )
    )
  );

create policy managed_message_templates on app.message_templates
  for select to authenticated
  using (
    (owner_scope = 'tenant' and (select internal.has_permission(
      tenant_id, 'communication.manage', 'tenant', tenant_id
    )))
    or (owner_scope = 'committee' and (select internal.has_permission(
      tenant_id, 'communication.manage', 'committee', committee_id
    )))
  );
create policy managed_message_template_versions on app.message_template_versions
  for select to authenticated
  using (
    exists (
      select 1 from app.message_templates as template
      where template.tenant_id = message_template_versions.tenant_id
        and template.id = message_template_versions.template_id
    )
  );
create policy managed_template_test_runs on app.template_test_runs
  for select to authenticated
  using (
    requested_by_auth_user_id = (select auth.uid())
    and (select internal.is_active_member(tenant_id))
  );

create policy member_notification_categories on app.notification_categories
  for select to authenticated
  using ((select internal.is_active_member(tenant_id)));
create policy own_notification_preferences on app.notification_preferences
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, person_id)));
create policy own_notification_intents on app.notification_intents
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, recipient_person_id)));
create policy own_task_offer_candidates on app.task_offer_candidates
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, recipient_person_id)));
create policy own_daily_task_digests on app.daily_task_digests
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, recipient_person_id)));
create policy own_daily_digest_items on app.daily_digest_items
  for select to authenticated
  using (
    exists (
      select 1 from app.daily_task_digests as digest
      where digest.tenant_id = daily_digest_items.tenant_id
        and digest.id = daily_digest_items.digest_id
        and internal.is_self_person(digest.tenant_id, digest.recipient_person_id)
    )
  );
create policy own_inbox_items on app.inbox_items
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, recipient_person_id)));

create policy visible_policy_documents on app.policy_documents
  for select to authenticated
  using (
    (select internal.has_permission(tenant_id, 'policy.manage', 'tenant', tenant_id))
    or exists (
      select 1
      from app.policy_versions as version_row
      join app.policy_assignments as assignment
        on assignment.tenant_id = version_row.tenant_id
       and assignment.policy_version_id = version_row.id
      where version_row.tenant_id = policy_documents.tenant_id
        and version_row.document_id = policy_documents.id
        and internal.can_person_view_policy_assignment(
          assignment.tenant_id,
          internal.current_person_id(assignment.tenant_id),
          assignment.id
        )
    )
  );
create policy visible_policy_versions on app.policy_versions
  for select to authenticated
  using (
    (select internal.has_permission(tenant_id, 'policy.manage', 'tenant', tenant_id))
    or exists (
      select 1 from app.policy_assignments as assignment
      where assignment.tenant_id = policy_versions.tenant_id
        and assignment.policy_version_id = policy_versions.id
        and internal.can_person_view_policy_assignment(
          assignment.tenant_id,
          internal.current_person_id(assignment.tenant_id),
          assignment.id
        )
    )
  );
create policy managed_policy_audiences on app.policy_audiences
  for select to authenticated
  using (
    (select internal.has_permission(tenant_id, 'policy.manage', 'tenant', tenant_id))
    or (select internal.has_permission(tenant_id, 'policy.follow_up', 'tenant', tenant_id))
  );
create policy visible_policy_assignments on app.policy_assignments
  for select to authenticated
  using (
    (select internal.can_person_view_policy_assignment(
      tenant_id, internal.current_person_id(tenant_id), id
    ))
  );
create policy visible_policy_questions on app.policy_questions
  for select to authenticated
  using (
    (select internal.can_person_view_policy_assignment(
      tenant_id, internal.current_person_id(tenant_id), assignment_id
    ))
  );
create policy visible_policy_acceptances on app.policy_acceptances
  for select to authenticated
  using (
    (select internal.can_person_view_policy_assignment(
      tenant_id, internal.current_person_id(tenant_id), assignment_id
    ))
  );
create policy visible_policy_assignment_events on app.policy_assignment_events
  for select to authenticated
  using (
    (select internal.can_person_view_policy_assignment(
      tenant_id, internal.current_person_id(tenant_id), assignment_id
    ))
  );
create policy own_personal_action_items on app.personal_action_items
  for select to authenticated
  using ((select internal.is_self_person(tenant_id, recipient_person_id)));

grant select on
  app.team_person_memberships,
  app.committee_documents, app.committee_document_versions, app.committee_document_acl,
  app.integration_connections, app.integration_runs, app.matches, app.match_revisions,
  app.match_shift_links, app.match_change_impacts, app.scheduled_occurrences,
  app.events, app.event_occurrences, app.event_attendees,
  app.kanban_boards, app.kanban_columns, app.kanban_cards, app.kanban_card_assignees,
  app.kanban_card_subtasks, app.kanban_subtask_assignees, app.kanban_card_history,
  app.team_tasks, app.team_task_market_requests, app.team_task_market_reviews,
  app.event_resource_links, app.mentions, app.card_checklist_items,
  app.message_templates, app.message_template_versions, app.template_test_runs,
  app.notification_categories, app.notification_preferences, app.notification_intents,
  app.task_offer_candidates, app.daily_task_digests, app.daily_digest_items, app.inbox_items,
  app.policy_documents, app.policy_versions, app.policy_audiences, app.policy_assignments,
  app.policy_questions, app.policy_acceptances, app.policy_assignment_events,
  app.personal_action_items
to authenticated;

grant select, insert on app.shift_positions to cluvo_command_owner;
create policy command_owner_insert on app.shift_positions
  for insert to cluvo_command_owner with check (true);

create or replace function internal.create_personal_action_from_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_recipient uuid;
  v_action_key text;
  v_action_kind text;
  v_card_id uuid;
  v_subtask_id uuid;
  v_mention_id uuid;
  v_team_task_id uuid;
  v_policy_question_id uuid;
  v_due_at timestamptz;
begin
  case tg_table_name
    when 'kanban_card_assignees' then
      v_recipient := new.person_id;
      v_action_key := 'card:' || new.card_id::text;
      v_action_kind := 'card_assignment';
      v_card_id := new.card_id;
      select card.due_at into v_due_at
      from app.kanban_cards as card
      where card.tenant_id = new.tenant_id and card.id = new.card_id;
    when 'kanban_subtask_assignees' then
      v_recipient := new.person_id;
      v_action_key := 'subtask:' || new.subtask_id::text;
      v_action_kind := 'subtask_assignment';
      v_subtask_id := new.subtask_id;
      select subtask.due_at into v_due_at
      from app.kanban_card_subtasks as subtask
      where subtask.tenant_id = new.tenant_id and subtask.id = new.subtask_id;
    when 'mentions' then
      v_recipient := new.recipient_person_id;
      v_action_key := 'mention:' || new.id::text;
      v_action_kind := 'mention';
      v_mention_id := new.id;
    when 'team_tasks' then
      if new.assigned_person_id is null then
        return new;
      end if;
      v_recipient := new.assigned_person_id;
      v_action_key := 'team-task:' || new.id::text;
      v_action_kind := 'team_task';
      v_team_task_id := new.id;
      v_due_at := new.due_at;
    when 'policy_questions' then
      if new.handler_person_id is null then
        return new;
      end if;
      v_recipient := new.handler_person_id;
      v_action_key := 'policy-question:' || new.id::text;
      v_action_kind := 'policy_follow_up';
      v_policy_question_id := new.id;
    else
      raise exception using errcode = '0A000', message = 'UNSUPPORTED_ACTION_SOURCE';
  end case;

  insert into app.personal_action_items (
    tenant_id, recipient_person_id, action_key, action_kind,
    card_id, subtask_id, mention_id, team_task_id, policy_question_id, due_at
  ) values (
    new.tenant_id, v_recipient, v_action_key, v_action_kind,
    v_card_id, v_subtask_id, v_mention_id, v_team_task_id, v_policy_question_id, v_due_at
  )
  on conflict (tenant_id, recipient_person_id, action_key) do update
    set due_at = excluded.due_at,
        state = 'open',
        completed_at = null,
        updated_at = statement_timestamp(),
        version = app.personal_action_items.version + 1;

  return new;
end;
$function$;

alter function internal.create_personal_action_from_source() owner to cluvo_command_owner;
revoke execute on function internal.create_personal_action_from_source()
  from public, anon, authenticated, service_role;

create trigger card_assignees_create_action
after insert on app.kanban_card_assignees
for each row execute function internal.create_personal_action_from_source();
create trigger subtask_assignees_create_action
after insert on app.kanban_subtask_assignees
for each row execute function internal.create_personal_action_from_source();
create trigger mentions_create_action
after insert on app.mentions
for each row execute function internal.create_personal_action_from_source();
create trigger team_tasks_create_action
after insert on app.team_tasks
for each row execute function internal.create_personal_action_from_source();
create trigger policy_questions_create_action
after insert or update of handler_person_id on app.policy_questions
for each row
when (new.handler_person_id is not null)
execute function internal.create_personal_action_from_source();

create or replace function internal.claim_idempotency(
  p_tenant_id uuid,
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_inserted_id uuid;
  v_record app.idempotency_records%rowtype;
begin
  if v_actor is null or p_idempotency_key is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, p_operation, p_idempotency_key, p_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is not null then
    return null;
  end if;

  select * into strict v_record
  from app.idempotency_records
  where tenant_id = p_tenant_id
    and actor_auth_user_id = v_actor
    and operation = p_operation
    and idempotency_key = p_idempotency_key
  for update;

  if v_record.request_hash <> p_request_hash then
    raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_record.status = 'completed' then
    return v_record.result_jsonb;
  end if;
  raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
end;
$function$;

create or replace function internal.finish_idempotency(
  p_tenant_id uuid,
  p_operation text,
  p_idempotency_key uuid,
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
  where tenant_id = p_tenant_id
    and actor_auth_user_id = (select internal.current_actor_uid())
    and operation = p_operation
    and idempotency_key = p_idempotency_key
    and status = 'processing';

  if not found then
    raise exception using errcode = 'P0002', message = 'IDEMPOTENCY_RECORD_NOT_FOUND';
  end if;
end;
$function$;

alter function internal.claim_idempotency(uuid, text, uuid, bytea) owner to cluvo_command_owner;
alter function internal.finish_idempotency(uuid, text, uuid, jsonb) owner to cluvo_command_owner;
revoke execute on function internal.claim_idempotency(uuid, text, uuid, bytea)
  from public, anon, authenticated, service_role;
revoke execute on function internal.finish_idempotency(uuid, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function internal.complete_kanban_card(
  p_tenant_id uuid,
  p_card_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_actor_person uuid;
  v_card app.kanban_cards%rowtype;
  v_board app.kanban_boards%rowtype;
  v_terminal_column_id uuid;
  v_request_hash bytea;
  v_previous jsonb;
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_actor_person := internal.current_person_id(p_tenant_id);
  v_request_hash := extensions.digest(
    convert_to(jsonb_build_object(
      'card_id', p_card_id,
      'expected_version', p_expected_version
    )::text, 'UTF8'), 'sha256'
  );
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'complete_kanban_card', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_card
  from app.kanban_cards
  where tenant_id = p_tenant_id and id = p_card_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_card.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;

  select * into strict v_board
  from app.kanban_boards
  where tenant_id = p_tenant_id and id = v_card.board_id;

  if not (
    internal.has_permission(
      p_tenant_id, 'committee.workspace.manage', 'committee', v_board.committee_id
    )
    or v_card.accountable_person_id = v_actor_person
    or exists (
      select 1 from app.kanban_card_assignees as assignee
      where assignee.tenant_id = p_tenant_id
        and assignee.card_id = p_card_id
        and assignee.person_id = v_actor_person
    )
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select column_row.id into v_terminal_column_id
  from app.kanban_columns as column_row
  where column_row.tenant_id = p_tenant_id
    and column_row.board_id = v_card.board_id
    and column_row.terminal
  order by column_row.position
  limit 1;
  if v_terminal_column_id is null then
    raise exception using errcode = '23514', message = 'TERMINAL_COLUMN_REQUIRED';
  end if;

  update app.kanban_cards as card_row
  set column_id = v_terminal_column_id,
      status = 'completed',
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp(),
      version = card_row.version + 1
  where card_row.tenant_id = p_tenant_id and card_row.id = p_card_id
  returning card_row.* into v_card;

  insert into app.kanban_card_history (
    tenant_id, card_id, card_version, event_type, actor_auth_user_id, change_summary
  ) values (
    p_tenant_id, p_card_id, v_card.version, 'completed', v_actor,
    jsonb_build_object('column_id', v_terminal_column_id)
  );

  update app.personal_action_items as action_row
  set state = 'completed', completed_at = statement_timestamp(),
      updated_at = statement_timestamp(), version = action_row.version + 1
  where action_row.tenant_id = p_tenant_id
    and action_row.card_id = p_card_id
    and action_row.state = 'open';

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'kanban_card', p_card_id, v_card.version,
    'kanban.card.completed', '{}'::jsonb
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'kanban.card.completed', 'kanban_card', p_card_id,
    'committee', v_board.committee_id, p_idempotency_key,
    jsonb_build_object('version', v_card.version)
  );

  -- Deliberately no hour_ledger_entries write: collaboration completion is
  -- evidence of committee work, never attendance credit.
  v_result := jsonb_build_object(
    'ok', true, 'resource_id', p_card_id, 'version', v_card.version,
    'event_ids', jsonb_build_array(v_event_id)
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'complete_kanban_card', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.complete_kanban_card(
  p_tenant_id uuid,
  p_card_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.complete_kanban_card(
    p_tenant_id, p_card_id, p_expected_version, p_idempotency_key
  );
$function$;

alter function internal.complete_kanban_card(uuid, uuid, bigint, uuid) owner to cluvo_command_owner;
revoke execute on function internal.complete_kanban_card(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.complete_kanban_card(uuid, uuid, bigint, uuid)
  to authenticated;
revoke execute on function api.complete_kanban_card(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.complete_kanban_card(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.review_team_task_market_request(
  p_tenant_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_review_kind text,
  p_outcome text,
  p_approved_minutes integer,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_actor_person uuid;
  v_request app.team_task_market_requests%rowtype;
  v_task app.team_tasks%rowtype;
  v_request_hash bytea;
  v_previous jsonb;
  v_event_id uuid := gen_random_uuid();
  v_approved boolean;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_review_kind not in ('match', 'volunteer')
    or p_outcome not in ('approved', 'rejected')
    or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_REVIEW';
  end if;
  v_actor_person := internal.current_person_id(p_tenant_id);
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'request_id', p_request_id, 'expected_version', p_expected_version,
    'review_kind', p_review_kind, 'outcome', p_outcome,
    'approved_minutes', p_approved_minutes, 'reason', p_reason
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'review_team_task_market_request', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_request
  from app.team_task_market_requests
  where tenant_id = p_tenant_id and id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_request.state in ('published', 'rejected') then
    raise exception using errcode = '55000', message = 'REVIEW_CLOSED';
  end if;

  select * into strict v_task
  from app.team_tasks
  where tenant_id = p_tenant_id and id = v_request.team_task_id;

  if p_review_kind = 'match' then
    if not v_request.referee_needed then
      raise exception using errcode = '22023', message = 'MATCH_REVIEW_NOT_REQUIRED';
    end if;
    if p_approved_minutes is not null or not internal.has_permission(
      p_tenant_id, 'match.review', 'team', v_task.team_id
    ) then
      raise exception using errcode = '42501', message = 'FORBIDDEN';
    end if;
  elsif not internal.has_permission(
    p_tenant_id, 'team_task.market.approve', 'tenant', p_tenant_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  elsif (p_outcome = 'approved' and coalesce(p_approved_minutes, 0) <= 0)
    or (p_outcome = 'rejected' and p_approved_minutes is not null) then
    raise exception using errcode = '22023', message = 'INVALID_APPROVED_MINUTES';
  end if;

  insert into app.team_task_market_reviews (
    tenant_id, request_id, request_version, review_kind, outcome,
    reviewer_auth_user_id, reviewer_person_id, approved_minutes, reason
  ) values (
    p_tenant_id, p_request_id, v_request.version, p_review_kind, p_outcome,
    v_actor, v_actor_person, p_approved_minutes, p_reason
  );

  if p_outcome = 'rejected' then
    update app.team_task_market_requests
    set state = 'rejected', updated_at = statement_timestamp()
    where tenant_id = p_tenant_id and id = p_request_id;
    v_approved := false;
  else
    select exists (
      select 1
      from app.team_task_market_reviews as volunteer_review
      where volunteer_review.tenant_id = p_tenant_id
        and volunteer_review.request_id = p_request_id
        and volunteer_review.request_version = v_request.version
        and volunteer_review.review_kind = 'volunteer'
        and volunteer_review.outcome = 'approved'
    ) and (
      not v_request.referee_needed
      or exists (
        select 1
        from app.team_task_market_reviews as match_review
        where match_review.tenant_id = p_tenant_id
          and match_review.request_id = p_request_id
          and match_review.request_version = v_request.version
          and match_review.review_kind = 'match'
          and match_review.outcome = 'approved'
      )
    ) into v_approved;

    update app.team_task_market_requests
    set state = case when v_approved then 'approved' else 'reviewing' end,
        updated_at = statement_timestamp()
    where tenant_id = p_tenant_id and id = p_request_id;
  end if;

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'team_task_market_request', p_request_id,
    v_request.version,
    'team_task.market.' || p_review_kind || '_reviewed',
    jsonb_build_object('outcome', p_outcome)
  );

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', p_request_id, 'version', v_request.version,
    'approved', v_approved, 'event_ids', jsonb_build_array(v_event_id)
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'review_team_task_market_request', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.review_team_task_market_request(
  p_tenant_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_review_kind text,
  p_outcome text,
  p_approved_minutes integer,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.review_team_task_market_request(
    p_tenant_id, p_request_id, p_expected_version, p_review_kind,
    p_outcome, p_approved_minutes, p_reason, p_idempotency_key
  );
$function$;

alter function internal.review_team_task_market_request(uuid, uuid, bigint, text, text, integer, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.review_team_task_market_request(uuid, uuid, bigint, text, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function internal.review_team_task_market_request(uuid, uuid, bigint, text, text, integer, text, uuid)
  to authenticated;
revoke execute on function api.review_team_task_market_request(uuid, uuid, bigint, text, text, integer, text, uuid)
  from public, anon, service_role;
grant execute on function api.review_team_task_market_request(uuid, uuid, bigint, text, text, integer, text, uuid)
  to authenticated;

create or replace function internal.publish_team_task_market_request(
  p_tenant_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_request app.team_task_market_requests%rowtype;
  v_task app.team_tasks%rowtype;
  v_approved_minutes integer;
  v_shift_id uuid := gen_random_uuid();
  v_position_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_request_hash bytea;
  v_previous jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
    p_tenant_id, 'team_task.market.publish', 'tenant', p_tenant_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'request_id', p_request_id, 'expected_version', p_expected_version
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'publish_team_task_market_request', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_request
  from app.team_task_market_requests
  where tenant_id = p_tenant_id and id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_request.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_request.state <> 'approved' then
    raise exception using errcode = '55000', message = 'REVIEW_REQUIRED';
  end if;

  select * into strict v_task
  from app.team_tasks
  where tenant_id = p_tenant_id and id = v_request.team_task_id
  for update;
  if v_task.credit_minutes <> 0 then
    raise exception using errcode = '23514', message = 'TEAM_TASK_MUST_REMAIN_ZERO_CREDIT';
  end if;

  select review.approved_minutes into v_approved_minutes
  from app.team_task_market_reviews as review
  where review.tenant_id = p_tenant_id
    and review.request_id = p_request_id
    and review.request_version = v_request.version
    and review.review_kind = 'volunteer'
    and review.outcome = 'approved';
  if coalesce(v_approved_minutes, 0) <= 0 then
    raise exception using errcode = '55000', message = 'VOLUNTEER_REVIEW_REQUIRED';
  end if;
  if v_request.referee_needed and not exists (
    select 1 from app.team_task_market_reviews as review
    where review.tenant_id = p_tenant_id
      and review.request_id = p_request_id
      and review.request_version = v_request.version
      and review.review_kind = 'match'
      and review.outcome = 'approved'
  ) then
    raise exception using errcode = '55000', message = 'MATCH_REVIEW_REQUIRED';
  end if;

  insert into app.shifts (
    id, tenant_id, type_version_id, committee_id, category_id, title,
    starts_at, ends_at, location_id, credit_minutes, cancellation_minutes,
    state, published_at
  ) values (
    v_shift_id, p_tenant_id, v_request.task_type_version_id,
    v_request.committee_id, v_request.category_id, v_request.title,
    v_request.starts_at, v_request.ends_at, v_request.location_id,
    v_approved_minutes, 2880, 'published', statement_timestamp()
  );

  insert into app.shift_positions (
    id, tenant_id, shift_id, ordinal, starts_at, ends_at, state
  ) values (
    v_position_id, p_tenant_id, v_shift_id, 1,
    v_request.starts_at, v_request.ends_at, 'open'
  );

  update app.team_task_market_requests as request_row
  set state = 'published', market_shift_id = v_shift_id,
      updated_at = statement_timestamp(), version = request_row.version + 1
  where request_row.tenant_id = p_tenant_id and request_row.id = p_request_id
  returning request_row.* into v_request;

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'shift', v_shift_id, 1,
    'task.published',
    jsonb_build_object('source_team_task_id', v_task.id, 'market_request_id', p_request_id)
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'team_task.market_published',
    'team_task_market_request', p_request_id, 'team', v_task.team_id,
    p_idempotency_key,
    jsonb_build_object('shift_id', v_shift_id, 'approved_minutes', v_approved_minutes)
  );

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', p_request_id, 'version', v_request.version,
    'shift_id', v_shift_id, 'approved_minutes', v_approved_minutes,
    'event_ids', jsonb_build_array(v_event_id)
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'publish_team_task_market_request', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.publish_team_task_market_request(
  p_tenant_id uuid,
  p_request_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.publish_team_task_market_request(
    p_tenant_id, p_request_id, p_expected_version, p_idempotency_key
  );
$function$;

alter function internal.publish_team_task_market_request(uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.publish_team_task_market_request(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.publish_team_task_market_request(uuid, uuid, bigint, uuid)
  to authenticated;
revoke execute on function api.publish_team_task_market_request(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.publish_team_task_market_request(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.start_match_import(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_trigger_kind text,
  p_cursor_before text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_connection app.integration_connections%rowtype;
  v_run_id uuid := gen_random_uuid();
  v_request_hash bytea;
  v_previous jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
    p_tenant_id, 'match.import', 'tenant', p_tenant_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_trigger_kind not in ('scheduled', 'manual', 'retry') then
    raise exception using errcode = '22023', message = 'INVALID_TRIGGER_KIND';
  end if;
  select * into v_connection
  from app.integration_connections
  where tenant_id = p_tenant_id and id = p_connection_id
  for update;
  if not found
    or (
      v_connection.status <> 'active'
      and not (v_connection.status = 'error' and p_trigger_kind = 'retry')
    ) then
    raise exception using errcode = '55000', message = 'INTEGRATION_UNAVAILABLE';
  end if;

  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'connection_id', p_connection_id,
    'trigger_kind', p_trigger_kind,
    'cursor_before', p_cursor_before
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'start_match_import', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  insert into app.integration_runs (
    id, tenant_id, connection_id, trigger_kind, cursor_before,
    requested_by_auth_user_id, idempotency_key
  ) values (
    v_run_id, p_tenant_id, p_connection_id, p_trigger_kind, p_cursor_before,
    v_actor, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', v_run_id, 'version', 1, 'event_ids', '[]'::jsonb
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'start_match_import', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.start_match_import(
  p_tenant_id uuid,
  p_connection_id uuid,
  p_trigger_kind text,
  p_cursor_before text,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.start_match_import(
    p_tenant_id, p_connection_id, p_trigger_kind, p_cursor_before, p_idempotency_key
  );
$function$;

alter function internal.start_match_import(uuid, uuid, text, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.start_match_import(uuid, uuid, text, text, uuid)
  from public, anon, service_role;
grant execute on function internal.start_match_import(uuid, uuid, text, text, uuid)
  to authenticated;
revoke execute on function api.start_match_import(uuid, uuid, text, text, uuid)
  from public, anon, service_role;
grant execute on function api.start_match_import(uuid, uuid, text, text, uuid)
  to authenticated;

create or replace function internal.upsert_provider_match(
  p_tenant_id uuid,
  p_run_id uuid,
  p_source_id text,
  p_team_id uuid,
  p_opponent text,
  p_starts_at timestamptz,
  p_is_home boolean,
  p_location_text text,
  p_field_name text,
  p_locker_room_text text,
  p_status text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_run app.integration_runs%rowtype;
  v_match app.matches%rowtype;
  v_match_id uuid;
  v_revision_id uuid;
  v_source_hash bytea;
  v_request_hash bytea;
  v_previous jsonb;
  v_changed_fields text[] := '{}'::text[];
  v_is_new boolean := false;
  v_is_changed boolean := false;
  v_event_id uuid;
  v_impact_kind text;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
    p_tenant_id, 'match.import', 'tenant', p_tenant_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if nullif(btrim(p_source_id), '') is null
    or nullif(btrim(p_opponent), '') is null
    or p_status not in ('scheduled', 'postponed', 'cancelled', 'completed') then
    raise exception using errcode = '22023', message = 'INVALID_MATCH';
  end if;

  select * into v_run
  from app.integration_runs
  where tenant_id = p_tenant_id and id = p_run_id
  for update;
  if not found or v_run.status <> 'running' then
    raise exception using errcode = '55000', message = 'IMPORT_RUN_NOT_RUNNING';
  end if;
  if v_run.requested_by_auth_user_id is distinct from v_actor then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from app.teams as team
    where team.tenant_id = p_tenant_id and team.id = p_team_id
  ) then
    raise exception using errcode = '23503', message = 'TEAM_NOT_FOUND';
  end if;

  v_source_hash := extensions.digest(convert_to(jsonb_build_object(
    'source_id', p_source_id, 'team_id', p_team_id, 'opponent', p_opponent,
    'starts_at', p_starts_at, 'is_home', p_is_home,
    'location_text', p_location_text, 'field_name', p_field_name,
    'locker_room_text', p_locker_room_text, 'status', p_status
  )::text, 'UTF8'), 'sha256');
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'run_id', p_run_id, 'source_hash', encode(v_source_hash, 'hex')
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'upsert_provider_match', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_match
  from app.matches
  where tenant_id = p_tenant_id
    and connection_id = v_run.connection_id
    and source_id = p_source_id
  for update;

  if not found then
    v_is_new := true;
    v_is_changed := true;
    v_match_id := gen_random_uuid();
    v_changed_fields := array['created'];
    insert into app.matches (
      id, tenant_id, connection_id, source_id, team_id, opponent,
      starts_at, is_home, location_text, field_name, locker_room_text,
      status, source_hash, last_seen_run_id
    ) values (
      v_match_id, p_tenant_id, v_run.connection_id, p_source_id, p_team_id, p_opponent,
      p_starts_at, p_is_home, p_location_text, p_field_name, p_locker_room_text,
      p_status, v_source_hash, p_run_id
    ) returning * into v_match;
  elsif v_match.source_hash = v_source_hash then
    update app.matches as match_row
    set last_seen_run_id = p_run_id, updated_at = statement_timestamp()
    where match_row.tenant_id = p_tenant_id and match_row.id = v_match.id
    returning match_row.* into v_match;
    v_match_id := v_match.id;
  else
    v_is_changed := true;
    v_match_id := v_match.id;
    v_changed_fields := array_remove(array[
      case when v_match.team_id is distinct from p_team_id then 'team_id' end,
      case when v_match.opponent is distinct from p_opponent then 'opponent' end,
      case when v_match.starts_at is distinct from p_starts_at then 'starts_at' end,
      case when v_match.is_home is distinct from p_is_home then 'is_home' end,
      case when v_match.location_text is distinct from p_location_text then 'location_text' end,
      case when v_match.field_name is distinct from p_field_name then 'field_name' end,
      case when v_match.locker_room_text is distinct from p_locker_room_text then 'locker_room_text' end,
      case when v_match.status is distinct from p_status then 'status' end
    ], null);

    update app.matches as match_row
    set team_id = p_team_id,
        opponent = p_opponent,
        starts_at = p_starts_at,
        is_home = p_is_home,
        location_text = p_location_text,
        field_name = p_field_name,
        locker_room_text = p_locker_room_text,
        status = p_status,
        source_hash = v_source_hash,
        last_seen_run_id = p_run_id,
        updated_at = statement_timestamp(),
        version = match_row.version + 1
    where match_row.tenant_id = p_tenant_id and match_row.id = v_match_id
    returning match_row.* into v_match;
  end if;

  if v_is_changed then
    v_revision_id := gen_random_uuid();
    insert into app.match_revisions (
      id, tenant_id, match_id, revision, integration_run_id,
      opponent, starts_at, is_home, location_text, field_name,
      locker_room_text, status, source_hash, changed_fields
    ) values (
      v_revision_id, p_tenant_id, v_match.id, v_match.version, p_run_id,
      v_match.opponent, v_match.starts_at, v_match.is_home, v_match.location_text,
      v_match.field_name, v_match.locker_room_text, v_match.status,
      v_match.source_hash, v_changed_fields
    );

    if not v_is_new then
      v_impact_kind := case
        when cardinality(v_changed_fields) > 1 then 'multiple'
        when 'starts_at' = any(v_changed_fields) then 'time'
        when 'location_text' = any(v_changed_fields) then 'location'
        when 'status' = any(v_changed_fields) then 'status'
        else 'multiple'
      end;

      insert into app.match_change_impacts (
        tenant_id, match_revision_id, shift_id, impact_kind
      )
      select p_tenant_id, v_revision_id, link.shift_id, v_impact_kind
      from app.match_shift_links as link
      where link.tenant_id = p_tenant_id and link.match_id = v_match.id
      on conflict (tenant_id, match_revision_id, shift_id) do nothing;
    end if;

    v_event_id := gen_random_uuid();
    insert into app.domain_events (
      id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
      event_type, payload_minimal
    ) values (
      v_event_id, p_tenant_id, 'match', v_match.id, v_match.version,
      case when v_is_new then 'match.imported'
           when p_status = 'cancelled' then 'match.cancelled'
           else 'match.changed' end,
      jsonb_build_object('changed_fields', v_changed_fields)
    );
  end if;

  update app.integration_runs as run_row
  set seen_count = run_row.seen_count + 1,
      changed_count = run_row.changed_count + case when v_is_changed then 1 else 0 end,
      updated_at = statement_timestamp(),
      version = run_row.version + 1
  where run_row.tenant_id = p_tenant_id and run_row.id = p_run_id;

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', v_match.id, 'version', v_match.version,
    'changed', v_is_changed,
    'event_ids', case when v_event_id is null then '[]'::jsonb else jsonb_build_array(v_event_id) end
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'upsert_provider_match', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.upsert_provider_match(
  p_tenant_id uuid,
  p_run_id uuid,
  p_source_id text,
  p_team_id uuid,
  p_opponent text,
  p_starts_at timestamptz,
  p_is_home boolean,
  p_location_text text,
  p_field_name text,
  p_locker_room_text text,
  p_status text,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.upsert_provider_match(
    p_tenant_id, p_run_id, p_source_id, p_team_id, p_opponent,
    p_starts_at, p_is_home, p_location_text, p_field_name,
    p_locker_room_text, p_status, p_idempotency_key
  );
$function$;

alter function internal.upsert_provider_match(uuid, uuid, text, uuid, text, timestamptz, boolean, text, text, text, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.upsert_provider_match(uuid, uuid, text, uuid, text, timestamptz, boolean, text, text, text, text, uuid)
  from public, anon, service_role;
grant execute on function internal.upsert_provider_match(uuid, uuid, text, uuid, text, timestamptz, boolean, text, text, text, text, uuid)
  to authenticated;
revoke execute on function api.upsert_provider_match(uuid, uuid, text, uuid, text, timestamptz, boolean, text, text, text, text, uuid)
  from public, anon, service_role;
grant execute on function api.upsert_provider_match(uuid, uuid, text, uuid, text, timestamptz, boolean, text, text, text, text, uuid)
  to authenticated;

create or replace function internal.finish_match_import(
  p_tenant_id uuid,
  p_run_id uuid,
  p_expected_version bigint,
  p_status text,
  p_source_complete boolean,
  p_cursor_after text,
  p_error_code text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_run app.integration_runs%rowtype;
  v_request_hash bytea;
  v_previous jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
    p_tenant_id, 'match.import', 'tenant', p_tenant_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_status not in ('succeeded', 'failed', 'incomplete')
    or (p_status = 'succeeded' and not p_source_complete)
    or (p_status in ('failed', 'incomplete') and nullif(btrim(p_error_code), '') is null) then
    raise exception using errcode = '22023', message = 'INVALID_IMPORT_RESULT';
  end if;
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'run_id', p_run_id, 'expected_version', p_expected_version,
    'status', p_status, 'source_complete', p_source_complete,
    'cursor_after', p_cursor_after, 'error_code', p_error_code
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'finish_match_import', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_run
  from app.integration_runs
  where tenant_id = p_tenant_id and id = p_run_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_run.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_run.status <> 'running' or v_run.requested_by_auth_user_id is distinct from v_actor then
    raise exception using errcode = '55000', message = 'IMPORT_RUN_NOT_RUNNING';
  end if;

  update app.integration_runs as run_row
  set status = p_status,
      source_complete = p_source_complete,
      cursor_after = p_cursor_after,
      error_code = p_error_code,
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp(),
      version = run_row.version + 1
  where run_row.tenant_id = p_tenant_id and run_row.id = p_run_id
  returning run_row.* into v_run;

  if p_status = 'succeeded' then
    update app.integration_connections as connection_row
    set last_success_at = v_run.completed_at,
        status = 'active',
        updated_at = statement_timestamp(),
        version = connection_row.version + 1
    where connection_row.tenant_id = p_tenant_id and connection_row.id = v_run.connection_id;
  else
    update app.integration_connections as connection_row
    set status = 'error', updated_at = statement_timestamp(), version = connection_row.version + 1
    where connection_row.tenant_id = p_tenant_id and connection_row.id = v_run.connection_id;
  end if;

  -- There is intentionally no "missing row means cancelled" statement here.
  -- Failed and incomplete runs leave the last known match statuses untouched.
  v_result := jsonb_build_object(
    'ok', true, 'resource_id', p_run_id, 'version', v_run.version,
    'status', v_run.status, 'event_ids', '[]'::jsonb
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'finish_match_import', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.finish_match_import(
  p_tenant_id uuid,
  p_run_id uuid,
  p_expected_version bigint,
  p_status text,
  p_source_complete boolean,
  p_cursor_after text,
  p_error_code text,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.finish_match_import(
    p_tenant_id, p_run_id, p_expected_version, p_status, p_source_complete,
    p_cursor_after, p_error_code, p_idempotency_key
  );
$function$;

alter function internal.finish_match_import(uuid, uuid, bigint, text, boolean, text, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.finish_match_import(uuid, uuid, bigint, text, boolean, text, text, uuid)
  from public, anon, service_role;
grant execute on function internal.finish_match_import(uuid, uuid, bigint, text, boolean, text, text, uuid)
  to authenticated;
revoke execute on function api.finish_match_import(uuid, uuid, bigint, text, boolean, text, text, uuid)
  from public, anon, service_role;
grant execute on function api.finish_match_import(uuid, uuid, bigint, text, boolean, text, text, uuid)
  to authenticated;

create or replace function internal.schedule_local_occurrence(
  p_tenant_id uuid,
  p_job_kind text,
  p_local_date date,
  p_slot_key text,
  p_requested_local_time time,
  p_timezone text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_resolved record;
  v_occurrence app.scheduled_occurrences%rowtype;
  v_request_hash bytea;
  v_previous jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.has_permission(
    p_tenant_id, 'match.import', 'tenant', p_tenant_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if nullif(btrim(p_job_kind), '') is null or nullif(btrim(p_slot_key), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_SCHEDULE_SLOT';
  end if;

  select * into strict v_resolved
  from internal.resolve_local_slot(p_local_date, p_requested_local_time, p_timezone);
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'job_kind', p_job_kind, 'local_date', p_local_date, 'slot_key', p_slot_key,
    'requested_local_time', p_requested_local_time, 'timezone', p_timezone
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'schedule_local_occurrence', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  insert into app.scheduled_occurrences (
    tenant_id, job_kind, local_date, slot_key, requested_local_time,
    effective_local_time, timezone, scheduled_at, dst_resolution
  ) values (
    p_tenant_id, p_job_kind, p_local_date, p_slot_key, p_requested_local_time,
    v_resolved.effective_local_time, p_timezone,
    v_resolved.scheduled_at, v_resolved.dst_resolution
  )
  on conflict (tenant_id, job_kind, local_date, slot_key) do nothing
  returning * into v_occurrence;

  if v_occurrence.id is null then
    select * into strict v_occurrence
    from app.scheduled_occurrences
    where tenant_id = p_tenant_id
      and job_kind = p_job_kind
      and local_date = p_local_date
      and slot_key = p_slot_key
    for update;
    if v_occurrence.requested_local_time <> p_requested_local_time
      or v_occurrence.timezone <> p_timezone then
      raise exception using errcode = '22000', message = 'SCHEDULE_SLOT_CONFLICT';
    end if;
  end if;

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', v_occurrence.id, 'version', v_occurrence.version,
    'scheduled_at', v_occurrence.scheduled_at,
    'effective_local_time', v_occurrence.effective_local_time,
    'dst_resolution', v_occurrence.dst_resolution,
    'event_ids', '[]'::jsonb
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'schedule_local_occurrence', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.schedule_local_occurrence(
  p_tenant_id uuid,
  p_job_kind text,
  p_local_date date,
  p_slot_key text,
  p_requested_local_time time,
  p_timezone text,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.schedule_local_occurrence(
    p_tenant_id, p_job_kind, p_local_date, p_slot_key,
    p_requested_local_time, p_timezone, p_idempotency_key
  );
$function$;

alter function internal.schedule_local_occurrence(uuid, text, date, text, time, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.schedule_local_occurrence(uuid, text, date, text, time, text, uuid)
  from public, anon, service_role;
grant execute on function internal.schedule_local_occurrence(uuid, text, date, text, time, text, uuid)
  to authenticated;
revoke execute on function api.schedule_local_occurrence(uuid, text, date, text, time, text, uuid)
  from public, anon, service_role;
grant execute on function api.schedule_local_occurrence(uuid, text, date, text, time, text, uuid)
  to authenticated;

create or replace function internal.record_policy_open(
  p_tenant_id uuid,
  p_assignment_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_actor_person uuid;
  v_assignment app.policy_assignments%rowtype;
  v_request_hash bytea;
  v_previous jsonb;
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_actor_person := internal.current_person_id(p_tenant_id);
  if not internal.can_person_act_on_policy_assignment(
    p_tenant_id, v_actor_person, p_assignment_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'assignment_id', p_assignment_id, 'expected_version', p_expected_version
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'record_policy_open', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_assignment
  from app.policy_assignments
  where tenant_id = p_tenant_id and id = p_assignment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_assignment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_assignment.state = 'accepted' then
    raise exception using errcode = '55000', message = 'ALREADY_ACCEPTED';
  end if;

  if v_assignment.opened_at is null then
    update app.policy_assignments as assignment_row
    set opened_at = statement_timestamp(),
        state = case when assignment_row.state = 'offered' then 'opened' else assignment_row.state end,
        updated_at = statement_timestamp(),
        version = assignment_row.version + 1
    where assignment_row.tenant_id = p_tenant_id and assignment_row.id = p_assignment_id
    returning assignment_row.* into v_assignment;

    insert into app.policy_assignment_events (
      tenant_id, assignment_id, event_type, actor_auth_user_id,
      actor_person_id, assignment_version
    ) values (
      p_tenant_id, p_assignment_id, 'opened', v_actor,
      v_actor_person, v_assignment.version
    );
  end if;

  -- Opening records access to the exact text; it never creates acceptance.
  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'policy_assignment', p_assignment_id,
    v_assignment.version, 'policy.opened', '{}'::jsonb
  ) on conflict (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type)
    do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event_row.id into strict v_event_id
    from app.domain_events as event_row
    where event_row.tenant_id = p_tenant_id
      and event_row.aggregate_type = 'policy_assignment'
      and event_row.aggregate_id = p_assignment_id
      and event_row.aggregate_version = v_assignment.version
      and event_row.event_type = 'policy.opened';
  end if;

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', p_assignment_id, 'version', v_assignment.version,
    'state', v_assignment.state, 'event_ids', jsonb_build_array(v_event_id)
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'record_policy_open', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.record_policy_open(
  p_tenant_id uuid,
  p_assignment_id uuid,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.record_policy_open(
    p_tenant_id, p_assignment_id, p_expected_version, p_idempotency_key
  );
$function$;

alter function internal.record_policy_open(uuid, uuid, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.record_policy_open(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.record_policy_open(uuid, uuid, bigint, uuid)
  to authenticated;
revoke execute on function api.record_policy_open(uuid, uuid, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.record_policy_open(uuid, uuid, bigint, uuid)
  to authenticated;

create or replace function internal.ask_policy_question(
  p_tenant_id uuid,
  p_assignment_id uuid,
  p_expected_version bigint,
  p_question_text text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_actor_person uuid;
  v_assignment app.policy_assignments%rowtype;
  v_question_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_request_hash bytea;
  v_previous jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or nullif(btrim(p_question_text), '') is null
    or char_length(p_question_text) > 5000 then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_actor_person := internal.current_person_id(p_tenant_id);
  if not internal.can_person_act_on_policy_assignment(
    p_tenant_id, v_actor_person, p_assignment_id
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'assignment_id', p_assignment_id, 'expected_version', p_expected_version,
    'question_text', p_question_text
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'ask_policy_question', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  select * into v_assignment
  from app.policy_assignments
  where tenant_id = p_tenant_id and id = p_assignment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_assignment.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_assignment.state in ('accepted', 'expired') then
    raise exception using errcode = '55000', message = 'QUESTION_NOT_ALLOWED';
  end if;

  insert into app.policy_questions (
    id, tenant_id, assignment_id, author_auth_user_id,
    author_person_id, question_text
  ) values (
    v_question_id, p_tenant_id, p_assignment_id, v_actor,
    v_actor_person, p_question_text
  );

  update app.policy_assignments as assignment_row
  set opened_at = coalesce(assignment_row.opened_at, statement_timestamp()),
      state = 'question_pending',
      reminder_paused = true,
      updated_at = statement_timestamp(),
      version = assignment_row.version + 1
  where assignment_row.tenant_id = p_tenant_id and assignment_row.id = p_assignment_id
  returning assignment_row.* into v_assignment;

  insert into app.policy_assignment_events (
    tenant_id, assignment_id, event_type, actor_auth_user_id,
    actor_person_id, assignment_version,
    payload_minimal
  ) values (
    p_tenant_id, p_assignment_id, 'question_asked', v_actor,
    v_actor_person, v_assignment.version,
    jsonb_build_object('question_id', v_question_id)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'policy_assignment', p_assignment_id,
    v_assignment.version, 'policy.question_asked',
    jsonb_build_object('question_id', v_question_id)
  );

  v_result := jsonb_build_object(
    'ok', true, 'resource_id', v_question_id,
    'assignment_id', p_assignment_id, 'version', v_assignment.version,
    'event_ids', jsonb_build_array(v_event_id)
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'ask_policy_question', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.ask_policy_question(
  p_tenant_id uuid,
  p_assignment_id uuid,
  p_expected_version bigint,
  p_question_text text,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.ask_policy_question(
    p_tenant_id, p_assignment_id, p_expected_version,
    p_question_text, p_idempotency_key
  );
$function$;

alter function internal.ask_policy_question(uuid, uuid, bigint, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.ask_policy_question(uuid, uuid, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function internal.ask_policy_question(uuid, uuid, bigint, text, uuid)
  to authenticated;
revoke execute on function api.ask_policy_question(uuid, uuid, bigint, text, uuid)
  from public, anon, service_role;
grant execute on function api.ask_policy_question(uuid, uuid, bigint, text, uuid)
  to authenticated;

create or replace function internal.accept_policy_assignments(
  p_tenant_id uuid,
  p_assignment_ids uuid[],
  p_expected_versions bigint[],
  p_capacity text,
  p_explicit_confirmation boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_actor_person uuid;
  v_assignment app.policy_assignments%rowtype;
  v_policy_version app.policy_versions%rowtype;
  v_authorization_id uuid;
  v_acceptance_id uuid;
  v_event_id uuid;
  v_request_hash bytea;
  v_previous jsonb;
  v_results jsonb := '[]'::jsonb;
  v_event_ids jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id)
    or p_capacity not in ('self', 'guardian')
    or p_explicit_confirmation is distinct from true
    or cardinality(p_assignment_ids) is null
    or cardinality(p_assignment_ids) = 0
    or cardinality(p_assignment_ids) <> cardinality(p_expected_versions)
    or cardinality(p_assignment_ids) > 50 then
    raise exception using errcode = '22023', message = 'EXPLICIT_ACCEPTANCE_REQUIRED';
  end if;
  if cardinality(array(
    select distinct assignment_id
    from unnest(p_assignment_ids) as assignment_id
  ))
    <> cardinality(p_assignment_ids) then
    raise exception using errcode = '22023', message = 'DUPLICATE_ASSIGNMENT';
  end if;
  v_actor_person := internal.current_person_id(p_tenant_id);
  if v_actor_person is null then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'assignment_ids', p_assignment_ids,
    'expected_versions', p_expected_versions,
    'capacity', p_capacity,
    'explicit_confirmation', p_explicit_confirmation
  )::text, 'UTF8'), 'sha256');
  v_previous := internal.claim_idempotency(
    p_tenant_id, 'accept_policy_assignments', p_idempotency_key, v_request_hash
  );
  if v_previous is not null then
    return v_previous;
  end if;

  -- Stable lock order makes a multi-child acceptance all-or-nothing without
  -- deadlocking an overlapping administrative operation.
  perform 1
  from app.policy_assignments
  where tenant_id = p_tenant_id and id = any(p_assignment_ids)
  order by id
  for update;

  for v_index in 1..cardinality(p_assignment_ids) loop
    select * into v_assignment
    from app.policy_assignments
    where tenant_id = p_tenant_id and id = p_assignment_ids[v_index];
    if not found then
      raise exception using errcode = 'P0002', message = 'NOT_FOUND';
    end if;
    if v_assignment.version <> p_expected_versions[v_index] then
      raise exception using errcode = '40001', message = 'STALE_VERSION';
    end if;
    if v_assignment.state not in ('opened', 'question_pending') then
      raise exception using errcode = '55000', message = 'POLICY_MUST_BE_OPENED';
    end if;

    select * into strict v_policy_version
    from app.policy_versions
    where tenant_id = p_tenant_id and id = v_assignment.policy_version_id;
    if v_policy_version.state <> 'published' then
      raise exception using errcode = '55000', message = 'POLICY_NOT_PUBLISHED';
    end if;

    v_authorization_id := null;
    if p_capacity = 'self' then
      if v_assignment.member_person_id <> v_actor_person then
        raise exception using errcode = '42501', message = 'FORBIDDEN';
      end if;
    else
      select guardian_authorization.id into v_authorization_id
      from app.guardian_authorizations as guardian_authorization
      where guardian_authorization.tenant_id = p_tenant_id
        and guardian_authorization.guardian_person_id = v_actor_person
        and guardian_authorization.represented_member_id = v_assignment.member_person_id
        and guardian_authorization.scope = 'policy_acceptance'
        and guardian_authorization.valid_from <= statement_timestamp()
        and (
          guardian_authorization.valid_until is null
          or guardian_authorization.valid_until > statement_timestamp()
        )
        and guardian_authorization.revoked_at is null
      order by guardian_authorization.valid_from desc
      limit 1;
      if v_authorization_id is null then
        raise exception using errcode = '42501', message = 'GUARDIAN_AUTHORIZATION_REQUIRED';
      end if;
    end if;

    v_acceptance_id := gen_random_uuid();
    insert into app.policy_acceptances (
      id, tenant_id, assignment_id, member_person_id, policy_version_id,
      version_hash, actor_auth_user_id, actor_person_id, capacity,
      guardian_authorization_id, explicit_confirmation, idempotency_key
    ) values (
      v_acceptance_id, p_tenant_id, v_assignment.id,
      v_assignment.member_person_id, v_assignment.policy_version_id,
      v_policy_version.body_hash, v_actor, v_actor_person, p_capacity,
      v_authorization_id, true, p_idempotency_key
    );

    update app.policy_assignments as assignment_row
    set state = 'accepted', reminder_paused = false,
        updated_at = statement_timestamp(), version = assignment_row.version + 1
    where assignment_row.tenant_id = p_tenant_id and assignment_row.id = v_assignment.id
    returning assignment_row.* into v_assignment;

    insert into app.policy_assignment_events (
      tenant_id, assignment_id, event_type, actor_auth_user_id,
      actor_person_id, assignment_version, payload_minimal
    ) values (
      p_tenant_id, v_assignment.id, 'accepted', v_actor,
      v_actor_person, v_assignment.version,
      jsonb_build_object('acceptance_id', v_acceptance_id)
    );

    v_event_id := gen_random_uuid();
    insert into app.domain_events (
      id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
      event_type, payload_minimal
    ) values (
      v_event_id, p_tenant_id, 'policy_assignment', v_assignment.id,
      v_assignment.version, 'policy.accepted',
      jsonb_build_object('acceptance_id', v_acceptance_id)
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'assignment_id', v_assignment.id,
      'member_person_id', v_assignment.member_person_id,
      'acceptance_id', v_acceptance_id,
      'version', v_assignment.version
    ));
    v_event_ids := v_event_ids || jsonb_build_array(v_event_id);
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'resource_ids', v_results,
    'event_ids', v_event_ids,
    'actor_person_id', v_actor_person,
    'capacity', p_capacity
  );
  perform internal.finish_idempotency(
    p_tenant_id, 'accept_policy_assignments', p_idempotency_key, v_result
  );
  return v_result;
end;
$function$;

create or replace function api.accept_policy_assignments(
  p_tenant_id uuid,
  p_assignment_ids uuid[],
  p_expected_versions bigint[],
  p_capacity text,
  p_explicit_confirmation boolean,
  p_idempotency_key uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select internal.accept_policy_assignments(
    p_tenant_id, p_assignment_ids, p_expected_versions,
    p_capacity, p_explicit_confirmation, p_idempotency_key
  );
$function$;

alter function internal.accept_policy_assignments(uuid, uuid[], bigint[], text, boolean, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.accept_policy_assignments(uuid, uuid[], bigint[], text, boolean, uuid)
  from public, anon, service_role;
grant execute on function internal.accept_policy_assignments(uuid, uuid[], bigint[], text, boolean, uuid)
  to authenticated;
revoke execute on function api.accept_policy_assignments(uuid, uuid[], bigint[], text, boolean, uuid)
  from public, anon, service_role;
grant execute on function api.accept_policy_assignments(uuid, uuid[], bigint[], text, boolean, uuid)
  to authenticated;

create view api.my_actions
with (security_invoker = true)
as
select
  action.id,
  action.tenant_id,
  action.action_kind,
  action.card_id,
  action.subtask_id,
  action.mention_id,
  action.team_task_id,
  action.policy_question_id,
  action.due_at,
  action.state,
  action.version
from app.personal_action_items as action
where action.recipient_person_id = internal.current_person_id(action.tenant_id);

create view api.my_matches
with (security_invoker = true)
as
select
  match_row.id,
  match_row.tenant_id,
  match_row.team_id,
  match_row.opponent,
  match_row.starts_at,
  match_row.is_home,
  match_row.location_text,
  match_row.field_name,
  match_row.locker_room_text,
  match_row.status,
  match_row.version
from app.matches as match_row;

create view api.my_agenda
with (security_invoker = true)
as
select
  occurrence.id,
  occurrence.tenant_id,
  occurrence.event_id,
  event_row.title,
  event_row.visibility,
  occurrence.starts_at,
  occurrence.ends_at,
  occurrence.location_id,
  occurrence.state,
  occurrence.version
from app.event_occurrences as occurrence
join app.events as event_row
  on event_row.tenant_id = occurrence.tenant_id and event_row.id = occurrence.event_id;

create view api.my_inbox
with (security_invoker = true)
as
select
  inbox.id,
  inbox.tenant_id,
  inbox.title,
  inbox.body,
  inbox.source_path,
  inbox.read_at,
  inbox.created_at,
  inbox.version
from app.inbox_items as inbox;

create view api.my_policy_assignments
with (security_invoker = true)
as
select
  assignment.id,
  assignment.tenant_id,
  assignment.member_person_id,
  assignment.state,
  assignment.offered_at,
  assignment.opened_at,
  assignment.due_at,
  assignment.reminder_paused,
  assignment.version,
  policy_version.id as policy_version_id,
  policy_version.revision as policy_revision,
  policy_version.exact_body,
  encode(policy_version.body_hash, 'hex') as version_hash,
  policy_version.effective_at
from app.policy_assignments as assignment
join app.policy_versions as policy_version
  on policy_version.tenant_id = assignment.tenant_id
 and policy_version.id = assignment.policy_version_id;

revoke all on
  api.my_actions, api.my_matches, api.my_agenda, api.my_inbox,
  api.my_policy_assignments
from public, anon, authenticated, service_role;
grant select on
  api.my_actions, api.my_matches, api.my_agenda, api.my_inbox,
  api.my_policy_assignments
to authenticated;

-- Keep exposed RPCs deliberate even on projects with legacy default grants.
revoke execute on all functions in schema api from public, anon, service_role;
