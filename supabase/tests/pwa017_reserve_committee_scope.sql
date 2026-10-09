begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

-- Synthetic fixture extracted unchanged from 001_wp1_wp2_core.sql.
-- Test/local environments only; no real members or credentials.
insert into auth.users (
  id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'ouder-a@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'ouder-b@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'coordinator@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'tenant-b@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, timezone, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'club-a', 'Club A', 'Europe/Amsterdam', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'club-b', 'Club B', 'Europe/Amsterdam', 'active');

insert into app.account_profiles (auth_user_id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Ouder A'),
  ('22222222-2222-4222-8222-222222222222', 'Ouder B'),
  ('33333333-3333-4333-8333-333333333333', 'Coordinator'),
  ('44444444-4444-4444-8444-444444444444', 'Tenant B');

insert into app.persons (
  id, tenant_id, given_name, family_name, birth_date, birth_date_precision, status
) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ouder', 'A', '1980-01-01', 'day', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ouder', 'B', '1982-01-01', 'day', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Co', 'Ordinator', '1975-01-01', 'day', 'active'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tenant', 'B', '1985-01-01', 'day', 'active');

insert into app.account_person_links (
  id, tenant_id, auth_user_id, person_id, verified_at
) values
  ('a1100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', statement_timestamp()),
  ('a1100000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000002', statement_timestamp()),
  ('a1100000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'a1000000-0000-4000-8000-000000000003', statement_timestamp()),
  ('b1100000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'b1000000-0000-4000-8000-000000000001', statement_timestamp());

insert into app.tenant_memberships (id, tenant_id, auth_user_id, status, starts_at) values
  ('a1200000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'active', statement_timestamp() - interval '1 day'),
  ('a1200000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'active', statement_timestamp() - interval '1 day'),
  ('a1200000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'active', statement_timestamp() - interval '1 day'),
  ('b1200000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'active', statement_timestamp() - interval '1 day');

insert into app.committees (id, tenant_id, slug, name) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'kantine', 'Kantine'),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'kantine', 'Kantine B');

insert into app.households (
  id, tenant_id, label, intake_code_hash, separated_parents
) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Huishouden A', extensions.digest('code-a', 'sha256'), true),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Huishouden B', extensions.digest('code-b', 'sha256'), false);

insert into app.household_person_links (
  id, tenant_id, household_id, person_id, kind, starts_at, verified_by_auth_user_id
) values
  ('a3100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'parent', statement_timestamp() - interval '1 day', '33333333-3333-4333-8333-333333333333'),
  ('a3100000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'parent', statement_timestamp() - interval '1 day', '33333333-3333-4333-8333-333333333333'),
  ('b3100000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'parent', statement_timestamp() - interval '1 day', '44444444-4444-4444-8444-444444444444');

insert into app.household_access_grants (
  id, tenant_id, household_id, auth_user_id, can_view_progress,
  can_manage_contacts, can_invite_executor, can_book_for,
  starts_at, granted_by_auth_user_id
) values
  ('a3200000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', true, false, true, false, statement_timestamp() - interval '1 day', '33333333-3333-4333-8333-333333333333'),
  ('a3200000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', true, false, false, false, statement_timestamp() - interval '1 day', '33333333-3333-4333-8333-333333333333'),
  ('b3200000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b3000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', true, false, false, false, statement_timestamp() - interval '1 day', '44444444-4444-4444-8444-444444444444');

insert into app.access_grants (
  id, tenant_id, auth_user_id, role_id, scope_kind,
  starts_at, granted_by_auth_user_id
) values
  ('a3300000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', (select id from app.permission_roles where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key = 'member'), 'tenant', statement_timestamp() - interval '1 day', '33333333-3333-4333-8333-333333333333'),
  ('a3300000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', (select id from app.permission_roles where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key = 'member'), 'tenant', statement_timestamp() - interval '1 day', '33333333-3333-4333-8333-333333333333'),
  ('b3300000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', (select id from app.permission_roles where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and role_key = 'member'), 'tenant', statement_timestamp() - interval '1 day', '44444444-4444-4444-8444-444444444444');

insert into app.access_grants (
  id, tenant_id, auth_user_id, role_id, scope_kind, committee_id,
  starts_at, granted_by_auth_user_id
) values (
  'a3300000-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333333',
  (select id from app.permission_roles where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key = 'committee_coordinator'),
  'committee',
  'a2000000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '1 day',
  '33333333-3333-4333-8333-333333333333'
);

insert into app.intake_profiles (
  id, tenant_id, person_id, household_context_id, desired_minutes,
  status, current_revision, version
) values
  ('a4000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 240, 'submitted', 1, 1),
  ('a4000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 180, 'submitted', 1, 1),
  ('b4000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 120, 'submitted', 1, 1);

insert into app.intake_answers_versions (
  id, tenant_id, profile_id, revision, answers, authored_by_auth_user_id
) values
  ('a4100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000001', 1, '{"skills":"EHBO","preferences":"bar"}'::jsonb, '11111111-1111-4111-8111-111111111111'),
  ('a4100000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000002', 1, '{"practical_limitations":"alleen overdag"}'::jsonb, '22222222-2222-4222-8222-222222222222'),
  ('b4100000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b4000000-0000-4000-8000-000000000001', 1, '{"preferences":"onderhoud"}'::jsonb, '44444444-4444-4444-8444-444444444444');

insert into app.seasons (
  id, tenant_id, name, starts_on, ends_on, winter_cutoff_at,
  target_minutes, winter_target_minutes, status
) values
  ('a5000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026/2027', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('b5000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026/2027', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active');

insert into app.obligations (
  id, tenant_id, season_id, assessed_household_id,
  base_target_minutes, effective_target_minutes, effective_winter_minutes, status
) values
  ('a6000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a5000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 720, 720, 360, 'active'),
  ('b6000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b5000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 720, 720, 360, 'active');

insert into app.household_obligation_links (
  id, tenant_id, household_id, obligation_id, link_kind, starts_at
) values
  ('a6100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'liable', statement_timestamp() - interval '1 day'),
  ('b6100000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b3000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'liable', statement_timestamp() - interval '1 day');

insert into app.executor_obligation_grants (
  id, tenant_id, person_id, obligation_id, valid_from, approved_by_auth_user_id
) values
  ('a6200000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', '2026-01-01', '33333333-3333-4333-8333-333333333333'),
  ('a6200000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000001', '2026-01-01', '33333333-3333-4333-8333-333333333333'),
  ('b6200000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b1000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', '2026-01-01', '44444444-4444-4444-8444-444444444444');

insert into app.task_categories (id, tenant_id, committee_id, name) values
  ('a7000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000001', 'Bar');
insert into app.task_types (id, tenant_id, category_id, name) values
  ('a8000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7000000-0000-4000-8000-000000000001', 'Bardienst');
insert into app.task_type_versions (
  id, tenant_id, task_type_id, revision, credit_minutes, approved_by_auth_user_id
) values
  ('a9000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a8000000-0000-4000-8000-000000000001', 1, 120, '33333333-3333-4333-8333-333333333333');

insert into app.shifts (
  id, tenant_id, type_version_id, committee_id, category_id, title,
  starts_at, ends_at, credit_minutes, cancellation_minutes,
  state, published_at
) values
  ('aa200000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a9000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'Bardienst toekomst', '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01', 120, 2880, 'published', statement_timestamp()),
  ('aa200000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a9000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'Bardienst verleden', '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02', 120, 2880, 'published', statement_timestamp()),
  ('aa200000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a9000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a7000000-0000-4000-8000-000000000001', 'Aansluitende dienst', '2027-02-01 12:00:00+01', '2027-02-01 14:00:00+01', 120, 2880, 'published', statement_timestamp());

insert into app.shift_positions (id, tenant_id, shift_id, ordinal, starts_at, ends_at) values
  ('aa210000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa200000-0000-4000-8000-000000000001', 1, '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01'),
  ('aa210000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa200000-0000-4000-8000-000000000001', 2, '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01'),
  ('aa210000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa200000-0000-4000-8000-000000000002', 1, '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02'),
  ('aa210000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa200000-0000-4000-8000-000000000003', 1, '2027-02-01 12:00:00+01', '2027-02-01 14:00:00+01');

-- A confirmed past booking contributes 60 minutes; future booking contributes planned minutes.
insert into app.bookings (
  id, tenant_id, position_id, executor_person_id, obligation_id, state,
  booked_by_auth_user_id, starts_at_snapshot, ends_at_snapshot,
  credit_minutes_snapshot, cancellation_deadline_snapshot,
  task_version_snapshot, idempotency_key
) values
  ('aa300000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa210000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'booked', '11111111-1111-4111-8111-111111111111', '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01', 120, '2027-01-30 10:00:00+01', 'a9000000-0000-4000-8000-000000000001', 'aa310000-0000-4000-8000-000000000001'),
  ('aa300000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa210000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000001', 'confirmed', '22222222-2222-4222-8222-222222222222', '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02', 120, '2026-08-30 10:00:00+02', 'a9000000-0000-4000-8000-000000000001', 'aa310000-0000-4000-8000-000000000002');

insert into app.attendance_decisions (
  id, tenant_id, booking_id, decision_revision, result,
  awarded_minutes, confirmed_by_auth_user_id, reason
) values (
  'aa400000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aa300000-0000-4000-8000-000000000002', 1, 'partial', 60,
  '33333333-3333-4333-8333-333333333333', 'Halve dienst volgens afspraak'
);

update app.bookings
set current_attendance_decision_id = 'aa400000-0000-4000-8000-000000000001'
where id = 'aa300000-0000-4000-8000-000000000002';

insert into app.hour_ledger_entries (
  id, tenant_id, obligation_id, season_id, booking_id,
  attendance_decision_id, entry_kind, minutes_delta, performed_at,
  actor_auth_user_id, idempotency_key
) values (
  'aa500000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a6000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001',
  'aa300000-0000-4000-8000-000000000002', 'aa400000-0000-4000-8000-000000000001',
  'award', 60, '2026-09-01 10:00:00+02',
  '33333333-3333-4333-8333-333333333333', 'aa510000-0000-4000-8000-000000000001'
);

-- All authority fixtures are local/rollback-only. No provider JWT is claimed.
update auth.users set email_confirmed_at=statement_timestamp();
insert into auth.sessions(id,user_id,created_at,updated_at)select id,id,statement_timestamp(),statement_timestamp()from auth.users;
insert into app.teams(id,tenant_id,name)values('f3540000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owned reserve team');
-- Positive reserve parent is not a player: an actual linked child is.
insert into app.persons(id,tenant_id,given_name,family_name,birth_date,birth_date_precision,status)values('f3540000-0000-4000-8000-000000000008','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic','Team child','2015-01-01','day','active');
insert into app.household_person_links(tenant_id,household_id,person_id,kind,starts_at,verified_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','f3540000-0000-4000-8000-000000000008','member',statement_timestamp()-interval'1 day','33333333-3333-4333-8333-333333333333');
insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind,starts_at)values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000001','f3540000-0000-4000-8000-000000000008','player',statement_timestamp()-interval'1 day'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','team_parent',statement_timestamp()-interval'1 day');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,team_id,granted_by_auth_user_id)
 select tenant_id,'11111111-1111-4111-8111-111111111111',id,'team','f3540000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333'
 from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and role_key='team_parent';
insert into app.pwa_clusters(id,tenant_id,season_id,team_id,title,mode,self_until,assign_until)values
 ('f3540000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001','f3540000-0000-4000-8000-000000000001','Concrete reserve cluster','assign',statement_timestamp()-interval'2 days',statement_timestamp()+interval'1 day');
insert into app.pwa_allocations(id,tenant_id,cluster_id,position_id,member_person_id,state)values
 ('f3540000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000002','aa210000-0000-4000-8000-000000000004','f3540000-0000-4000-8000-000000000008','assigned');
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002',2,'{"reserve_willing":true,"practical_limitations":"Private answer never projected"}','22222222-2222-4222-8222-222222222222');
update app.intake_profiles set current_revision=2,version=version+1 where id='a4000000-0000-4000-8000-000000000002';
-- A coordinator recognized for a different committee receives no reserve scope.
insert into app.committees(id,tenant_id,slug,name)values('f3540000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other-reserve-committee','Other owned committee');
insert into auth.users(id,email,email_confirmed_at)values('f3540000-0000-4000-8000-000000000004','other-coordinator@example.test',statement_timestamp());
insert into auth.sessions(id,user_id,created_at,updated_at)values('f3540000-0000-4000-8000-000000000004','f3540000-0000-4000-8000-000000000004',statement_timestamp(),statement_timestamp());
insert into app.persons(id,tenant_id,given_name,family_name,birth_date,birth_date_precision,status)values('f3540000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Other','Coordinator','1980-01-01','day','active');
insert into app.account_person_links(tenant_id,auth_user_id,person_id,verified_at)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000004','f3540000-0000-4000-8000-000000000004',statement_timestamp());
insert into app.tenant_memberships(tenant_id,auth_user_id,status)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000004','active');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,committee_id,granted_by_auth_user_id)
 select tenant_id,'f3540000-0000-4000-8000-000000000004',id,'committee','f3540000-0000-4000-8000-000000000005','33333333-3333-4333-8333-333333333333'
 from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and role_key='committee_coordinator';
-- Fully suitable and opted-in same-tenant adult, but its household only has
-- a player in another team. No grant or product authority is inferred here.
insert into app.households(id,tenant_id,label,intake_code_hash)values('f3540000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Other team household',extensions.digest('owned-fixture-only-not-a-login-code','sha256'));
insert into app.household_person_links(tenant_id,household_id,person_id,kind,starts_at,verified_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000006','f3540000-0000-4000-8000-000000000004','parent',statement_timestamp()-interval'1 day','33333333-3333-4333-8333-333333333333');
insert into app.teams(id,tenant_id,name)values('f3540000-0000-4000-8000-000000000007','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Other owned team');
insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000007','f3540000-0000-4000-8000-000000000004','player');
insert into app.executor_obligation_grants(tenant_id,person_id,obligation_id,valid_from,approved_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000004','a6000000-0000-4000-8000-000000000001','2026-01-01','33333333-3333-4333-8333-333333333333');
insert into app.intake_profiles(id,tenant_id,person_id,household_context_id,desired_minutes,status,current_revision)values('f3540000-0000-4000-8000-000000000009','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000004','f3540000-0000-4000-8000-000000000006',120,'submitted',1);
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000009',1,'{"reserve_willing":true}','f3540000-0000-4000-8000-000000000004');
-- Self-selection fixture is still only synthetic construction, not a new
-- approval route: the existing committee actor is a qualified adult team HH
-- executor with reserve opt-in initially false.
insert into app.household_person_links(tenant_id,household_id,person_id,kind,starts_at,verified_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003','parent',statement_timestamp()-interval'1 day','33333333-3333-4333-8333-333333333333');
insert into app.executor_obligation_grants(tenant_id,person_id,obligation_id,valid_from,approved_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000003','a6000000-0000-4000-8000-000000000001','2026-01-01','33333333-3333-4333-8333-333333333333');
insert into app.intake_profiles(id,tenant_id,person_id,household_context_id,desired_minutes,status,current_revision)values('f3540000-0000-4000-8000-000000000010','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000001',120,'submitted',1);
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000010',1,'{"reserve_willing":false}','33333333-3333-4333-8333-333333333333');
create function pg_temp.actor(p_actor uuid)returns void language plpgsql security definer set search_path=''as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor),'exp',extract(epoch from clock_timestamp())::bigint+3600)::text,true);
end;$$;
create function pg_temp.snap()returns jsonb language sql security invoker as $$select api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001',null);$$;
create function pg_temp.request(p_key integer,p_version bigint default 1,p_payload jsonb default '{"person_ids":["a1000000-0000-4000-8000-000000000002"]}'::jsonb)returns jsonb language sql security invoker as $$
 select to_jsonb(t)from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','request_reserve','f3540000-0000-4000-8000-000000000003',p_version,p_payload,('f3590000-0000-4000-8000-'||lpad(p_key::text,12,'0'))::uuid)t;
$$;
-- Privileged fingerprint is test construction only, never a product API.
create function pg_temp.footprint()returns text language plpgsql security definer set search_path=''as $$declare r record;d text;parts text[]:='{}';begin
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relkind='r'order by c.relname loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),''[]''::jsonb)::text from only app.%I t',r.relname)into d;
  parts:=array_append(parts,r.relname||':'||md5(d));
 end loop;return md5(array_to_string(parts,'|'));end;$$;
create function pg_temp.rejects_unchanged(p_query text,p_state text)returns boolean language plpgsql security invoker as $$declare before_hash text;actual_state text;begin
 before_hash:=pg_temp.footprint();
 begin execute p_query;exception when others then actual_state:=sqlstate;end;
 return actual_state is not distinct from p_state and pg_temp.footprint()=before_hash;
end;$$;
create temporary table receipts(label text primary key,value jsonb);
grant all on receipts to authenticated;
create temporary table invariant_baseline as select 'bookings'kind,md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)hash from app.bookings t
 union all select 'grants',md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.access_grants t
 union all select 'obligations',md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.obligations t
 union all select 'ledger',md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.hour_ledger_entries t;
select ok(not exists(select 1 from app.team_person_memberships where person_id='a1000000-0000-4000-8000-000000000002'),'positive adult reserve parent is not itself a team player');
select ok(internal.pwa_executor_fits('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000004','aa200000-0000-4000-8000-000000000003'),'negative other-team-only household reserve is otherwise genuinely eligible for this shift');
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select ok(internal.actor_has_active_session()and internal.has_permission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shift.manage','committee','a2000000-0000-4000-8000-000000000001')and not internal.has_permission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','team_task.manage','team','f3540000-0000-4000-8000-000000000001'),'pure committee coordinator uses actual native session and only committee mandate');
select is(jsonb_array_length(pg_temp.snap()->'allocations'),0,'committee scope does not grant team allocation/progress visibility');
select is(jsonb_array_length(pg_temp.snap()->'committee_allocations'),1,'own concrete committee place is available independently of team membership');
select ok(not(pg_temp.snap()->'committee_allocations'->0->>'can_request_reserve')::boolean,'reserve request disabled before assignment deadline');
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),0,'private reserve pool absent before committee phase');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(1)','55000'),'pre-deadline request rejected with every app row unchanged');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','set_followup','f3540000-0000-4000-8000-000000000002',1,jsonb_build_object('self_until',statement_timestamp()+interval'1 day','assign_until',statement_timestamp()+interval'2 days'),'f3590000-0000-4000-8000-000000000002')$$,'same pure coordinator updates concrete cluster deadlines');
select is((pg_temp.snap()->'committee_clusters'->0->>'version')::bigint,2::bigint,'F074 deadline update reads back actual cluster version');
reset role;
-- Fixture clock transition only; no production backdating command is implied.
update app.pwa_clusters set self_until=statement_timestamp()-interval'2 days',assign_until=statement_timestamp()-interval'1 day'where id='f3540000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select ok(internal.has_permission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','team_task.manage','team','f3540000-0000-4000-8000-000000000001')and not internal.has_permission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shift.manage','committee','a2000000-0000-4000-8000-000000000001'),'pure team parent has team authority but no committee authority');
select is(jsonb_array_length(pg_temp.snap()->'committee_allocations'),0,'team-parent membership grants no committee read projection');
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),0,'team parent cannot inspect the opt-in reserve pool');
select ok(not(pg_temp.snap()->'allocations'->0->>'can_request_reserve')::boolean,'own team allocation does not imply reserve action capability');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(3)','42501'),'pure team-parent reserve request denied without any app write');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(4)','42501'),'ordinary opted-in recipient cannot issue committee requests');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(5)','42501'),'foreign tenant actor cannot act on club A allocation');
select ok(not(api.pwa_snapshot('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b5000000-0000-4000-8000-000000000001',null)->'committee_allocations'@> '[{"id":"f3540000-0000-4000-8000-000000000003"}]'),'foreign tenant read contains no club A allocation');
select pg_temp.actor('f3540000-0000-4000-8000-000000000004');
select is(jsonb_array_length(pg_temp.snap()->'committee_allocations'),0,'different committee mandate grants no concrete allocation scope');
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),0,'different committee mandate grants no private reserve candidates');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(16)','42501'),'same-tenant coordinator for a different committee cannot request reserve help');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select ok((pg_temp.snap()->'committee_allocations'->0->>'can_request_reserve')::boolean,'post-deadline pure coordinator gets actual reserve capability');
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),1,'only eligible opted-in executor is projected');
select is(pg_temp.snap()->'reserve_candidates'->0->>'person_id','a1000000-0000-4000-8000-000000000002','candidate identity matches native eligible voluntary person');
select ok(not exists(select 1 from jsonb_object_keys(pg_temp.snap()->'committee_allocations'->0)k where k not in('id','version','state','cluster_id','cluster_version','committee_id','team_id','shift_id','position_id','ordinal','title','starts_at','ends_at','self_until','assign_until','can_request_reserve')),'committee place projection has no member, household, profile, progress or Auth fields');
select ok(not exists(select 1 from jsonb_object_keys(pg_temp.snap()->'reserve_candidates'->0)k where k not in('allocation_id','person_id','name','suitable')),'candidate projection contains no private answers or contact fields');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(6,2)','40001'),'stale allocation version rejected without writes');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(7,null)','22023'),'null expected version rejected before resource mutation');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(8,1,''{}'')','22023'),'missing recipient array cannot create a vacuous request event');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(9,1,''{"person_ids":null}'')','22023'),'null recipient list rejected without writes');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(10,1,''{"person_ids":[]}'' )','22023'),'empty recipient list rejected without writes');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(11,1,''{"person_ids":["a1000000-0000-4000-8000-000000000001"]}'' )','42501'),'suitable but non-opted-in executor cannot be invited from reserve pool');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(12,1,''{"person_ids":["b1000000-0000-4000-8000-000000000001"]}'' )','42501'),'cross-tenant person cannot be invited');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(17,1,''{"person_ids":["f3540000-0000-4000-8000-000000000004"]}'' )','42501'),'same-tenant suitable opted-in other-team-only household cannot be invited');
reset role;
update app.household_person_links set ends_at=statement_timestamp()-interval'1 hour'where id='a3100000-0000-4000-8000-000000000002';
set local role authenticated;
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),0,'ended reserve-parent household link removes candidate');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(18)','42501'),'ended reserve-parent household link cannot authorize invitation');
reset role;
update app.household_person_links set ends_at=null where id='a3100000-0000-4000-8000-000000000002';
update app.team_person_memberships set ends_at=statement_timestamp()-interval'1 hour'where team_id='f3540000-0000-4000-8000-000000000001'and person_id='f3540000-0000-4000-8000-000000000008';
set local role authenticated;
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),0,'ended team-child membership removes household reserve candidate');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(19)','42501'),'ended team-child membership cannot authorize invitation');
reset role;
update app.team_person_memberships set ends_at=null where team_id='f3540000-0000-4000-8000-000000000001'and person_id='f3540000-0000-4000-8000-000000000008';
-- Actual historical recipient A opted in, was invited, then opted out. A new
-- choice of B must not fan out to A's still-existing historical request row.
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,'{"reserve_willing":true}','11111111-1111-4111-8111-111111111111');
update app.intake_profiles set current_revision=2,version=version+1 where id='a4000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select pg_temp.request(100,1,'{"person_ids":["a1000000-0000-4000-8000-000000000001"]}')$$,'first eligible opted-in team household A receives actual native request');
reset role;
-- Owned rollback fixture places A's actual notification on the previous
-- local day. This makes the fanout assertion independent of today's daycap:
-- an accidental all-historic-recipient loop would notify opted-out A again.
update app.pwa_notifications set created_at=statement_timestamp()-interval'1 day'
 where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and recipient_person_id='a1000000-0000-4000-8000-000000000001'
 and source_path='/app/tasks?allocation=f3540000-0000-4000-8000-000000000003';
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',3,'{"reserve_willing":false}','11111111-1111-4111-8111-111111111111');
update app.intake_profiles set current_revision=3,version=version+1 where id='a4000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),1,'opted-out historical recipient A is absent from current eligible pool');

insert into receipts select 'request',pg_temp.request(13);
select is((select value->>'resource_id'from receipts where label='request'),'f3540000-0000-4000-8000-000000000003','confirmed receipt binds exact allocation resource');
select is((select(value->>'version')::bigint from receipts where label='request'),1::bigint,'invitation preserves actual allocation version');
select is(pg_temp.request(13),(select value from receipts where label='request'),'same key replays exact confirmed receipt');
select lives_ok($$select pg_temp.request(14)$$,'fresh explicit repeat request retains one durable reserve recipient');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select is(jsonb_array_length(pg_temp.snap()->'reserve_requests'),1,'named recipient sees exact own voluntary reserve request');
select is(pg_temp.snap()->'reserve_requests'->0->>'allocation_id','f3540000-0000-4000-8000-000000000003','recipient readback binds actual allocation');
reset role;
insert into receipts select 'B-reserve-row',jsonb_build_object('id',id)from app.pwa_reserve_requests where recipient_person_id='a1000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(pg_temp.snap()->'reserve_requests'),1,'parent A retains only its own historical request after opting out');
select ok(not(pg_temp.snap()->'reserve_requests'@>jsonb_build_array(jsonb_build_object('id',(select value->>'id'from receipts where label='B-reserve-row')))),'parent A cannot inspect the actual confirmed recipient B reserve row');
reset role;
select is((select count(*)::integer from app.pwa_reserve_requests where allocation_id='f3540000-0000-4000-8000-000000000003'and recipient_person_id='a1000000-0000-4000-8000-000000000002'),1,'durable request deduplicates allocation and recipient');
select is((select count(*)::integer from app.pwa_notifications where recipient_person_id='a1000000-0000-4000-8000-000000000002'),1,'fresh command and same-key retries notify B at most once for this allocation and local day');
select is((select count(*)::integer from app.pwa_notifications where recipient_person_id='a1000000-0000-4000-8000-000000000001'),1,'fresh B selection does not re-notify opted-out historical recipient A');
select is((select count(*)::integer from app.pwa_reserve_requests where recipient_person_id='a1000000-0000-4000-8000-000000000001'),1,'historical A reserve request remains intact without new rights');
select is((select count(*)::integer from app.bookings where position_id='aa210000-0000-4000-8000-000000000004'),0,'reserve invitation creates no booking');
select is((select md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.bookings t),(select hash from invariant_baseline where kind='bookings'),'all original booking history preserved');
select is((select md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.access_grants t),(select hash from invariant_baseline where kind='grants'),'invitation creates no additional authority');
select is((select md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.obligations t),(select hash from invariant_baseline where kind='obligations'),'invitation does not increase obligations');
select is((select md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)::text)from app.hour_ledger_entries t),(select hash from invariant_baseline where kind='ledger'),'reserve and deadline actions fabricate no confirmed minutes');
-- Own-team-HH actor explicitly opts in, then selects itself. Generic actor
-- acknowledgement must not displace the real reserve notification/path.
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f3540000-0000-4000-8000-000000000010',2,'{"reserve_willing":true}','33333333-3333-4333-8333-333333333333');
update app.intake_profiles set current_revision=2,version=version+1 where id='f3540000-0000-4000-8000-000000000010';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select pg_temp.request(101,1,'{"person_ids":["A1000000-0000-4000-8000-000000000003"]}')$$,'eligible opted-in team-HH committee actor may choose itself voluntarily');
select lives_ok($$select pg_temp.request(102,1,'{"person_ids":["a1000000-0000-4000-8000-000000000003"]}')$$,'fresh repeated self-request keeps stable local-day cap');
reset role;
select is((select count(*)::integer from app.pwa_notifications where recipient_person_id='a1000000-0000-4000-8000-000000000003'and source_path='/app/tasks?allocation=f3540000-0000-4000-8000-000000000003'),1,'self-selection produces one actual reserve notification instead of a generic actor update');
select is((select title from app.pwa_notifications where recipient_person_id='a1000000-0000-4000-8000-000000000003'and source_path='/app/tasks?allocation=f3540000-0000-4000-8000-000000000003'),'Vrijwillige reservehulp gevraagd','self notification carries the actual reserve request label');
update app.access_grants set revoked_at=statement_timestamp(),version=version+1 where id='a3300000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(jsonb_array_length(pg_temp.snap()->'committee_allocations'),0,'revoked coordinator loses concrete committee projection');
select is(jsonb_array_length(pg_temp.snap()->'reserve_candidates'),0,'revoked coordinator loses private candidate projection');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(15)','42501'),'revoked coordinator cannot issue new reserve request');
select ok(pg_temp.rejects_unchanged('select pg_temp.request(13)','42501'),'revoked coordinator cannot retrieve old successful command as authorization');
reset role;
select ok((select bool_and(relrowsecurity and relforcerowsecurity)from pg_class where relnamespace='app'::regnamespace and relkind='r'),'all app tables retain forced RLS');
select ok((select proowner='cluvo_command_owner'::regrole and prosecdef and proconfig=array['search_path=""']from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure),'command retains native restricted owner and empty search path');
select * from finish();rollback;
