begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Supabase test runner mounts test files, not the separate fixture directory.
-- Inline synthetic core-v1 fixture, SHA256 ffc09f1d4f81455d61bb2c43ed2f118ccdf4480a8bfb935da6ec33eda7ec2650
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

update auth.users set email_confirmed_at=statement_timestamp() where email like '%@example.test';

insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,status) values
 ('ad160000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Previous synthetic season','2025-07-01','2026-06-30','2025-12-15','closed'),
 ('ad160000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Next synthetic season','2027-07-01','2028-06-30','2027-12-15','preparing');
-- Downstream fixture represents the existing controlled-rollover item contract.
-- Full rollover itself is separately exercised in 007_wp9_wp11.
insert into app.rollover_runs(id,tenant_id,source_season_id,target_season_id,created_by_auth_user_id,idempotency_key) values
 ('ad161000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad160000-0000-4000-8000-000000000001','ad160000-0000-4000-8000-000000000002','33333333-3333-4333-8333-333333333333','ad169000-0000-4000-8000-000000000001');
insert into app.season_reconfirmation_items(id,tenant_id,rollover_run_id,target_season_id,subject_kind,person_id,source_resource_id) values
 ('ad162000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad161000-0000-4000-8000-000000000001','ad160000-0000-4000-8000-000000000002','intake','a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001'),
 ('ad162000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad161000-0000-4000-8000-000000000001','ad160000-0000-4000-8000-000000000002','intake','a1000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002'),
 ('ad162000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad161000-0000-4000-8000-000000000001','ad160000-0000-4000-8000-000000000002','policy','a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001');
create function pg_temp.actor(p_uid text,p_email text) returns void language plpgsql as $fn$
begin
 perform set_config('request.jwt.claim.sub',p_uid,true);
 perform set_config('request.jwt.claim.email',p_email,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_uid,'session_id',p_uid,'email',p_email,'role','authenticated')::text,true);
end;
$fn$;
create function pg_temp.confirm_a(p_item_version bigint,p_profile_version bigint,p_key uuid)
returns table (ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb)
language sql security invoker as $fn$
 select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000001',p_item_version,p_profile_version,null,null,p_key);
$fn$;

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid='app.intake_reconfirmation_receipts'::regclass),'receipts force RLS');
select ok(not (select prosecdef from pg_proc where oid='api.confirm_intake_reconfirmation(uuid,uuid,bigint,bigint,uuid,text,uuid)'::regprocedure),'public command is invoker');
select ok(not rolsuper and not rolbypassrls,'command owner remains limited') from pg_roles where rolname='cluvo_command_owner';
select ok(not has_table_privilege(role_name,'app.intake_reconfirmation_receipts','INSERT,UPDATE,DELETE'),'no direct receipt mutation: '||role_name)
 from (values('anon'),('authenticated'),('service_role')) as roles(role_name);
select ok(not has_table_privilege('cluvo_command_owner','app.intake_reconfirmation_receipts','UPDATE,DELETE'),'command owner cannot rewrite receipts');
select ok(not has_function_privilege('anon','api.confirm_intake_reconfirmation(uuid,uuid,bigint,bigint,uuid,text,uuid)','EXECUTE'),'anon cannot confirm');

-- SQL unit contexts use explicit disposable native session rows. Browser
-- integration separately obtains real OTP-issued sessions; this is no provider proof.
update auth.users set email_confirmed_at=statement_timestamp() where email_confirmed_at is null;
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,statement_timestamp(),statement_timestamp() from auth.users
on conflict(id) do nothing;
create function pg_temp.cluvo_test_claims(p_actor uuid) returns text
language sql security definer set search_path='' as $claims$
select jsonb_build_object('sub',p_actor,'role','authenticated','session_id',p_actor,
 'email',(select email from auth.users where id=p_actor))::text;
$claims$;

set local role authenticated;
select pg_temp.actor('22222222-2222-4222-8222-222222222222','ouder-b@example.test');
select throws_ok($$select * from pg_temp.confirm_a(1,1,gen_random_uuid())$$,'42501','FORBIDDEN','other parent cannot confirm known item');
select is((select count(*) from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001')),0::bigint,'other parent cannot read the personal seasonal request');
select pg_temp.actor('11111111-1111-4111-8111-111111111111','ouder-a@example.test');
select is((select count(*) from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001')),1::bigint,'only the own intake item is returned, excluding policy items');
select is((select count(*) from api.get_intake_reconfirmations('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b4000000-0000-4000-8000-000000000001')),0::bigint,'foreign tenant request remains private');
select throws_ok($$select * from api.confirm_intake_reconfirmation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ad162000-0000-4000-8000-000000000001',1,1,null,null,gen_random_uuid())$$,'42501','FORBIDDEN','foreign tenant command refused');
select throws_ok($$select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000003',1,1,null,null,gen_random_uuid())$$,'42501','FORBIDDEN','policy item cannot be consumed through intake command');
select throws_ok($$select * from pg_temp.confirm_a(null,1,gen_random_uuid())$$,'22023','INVALID_COMMAND','item version required');
select throws_ok($$select * from pg_temp.confirm_a(1,null,gen_random_uuid())$$,'22023','INVALID_COMMAND','profile version required');
select throws_ok($$select * from pg_temp.confirm_a(1,1,null)$$,'22023','INVALID_COMMAND','command key required');
select throws_ok($$select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000001',1,1,'a1000000-0000-4000-8000-000000000001','self',gen_random_uuid())$$,'22023','INVALID_REPRESENTATION','own confirmation cannot forge assisted attribution');
select lives_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',1,240,'{"experience":"PERSONAL_A_RECONFIRMATION"}',null,null,'ad169000-0000-4000-8000-000000000002')$$,'existing versioned answer writer remains compatible');
select throws_ok($$select * from pg_temp.confirm_a(1,1,gen_random_uuid())$$,'40001','STALE_VERSION','earlier reviewed answers cannot be confirmed after a revision');
reset role;
update auth.users set email_confirmed_at=null where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select throws_ok($$select * from pg_temp.confirm_a(1,2,gen_random_uuid())$$,'42501','FORBIDDEN','unconfirmed native identity refused despite asserted email');
select is((select count(*) from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001')),0::bigint,'unconfirmed identity gets no request projection');
reset role;
update auth.users set email_confirmed_at=statement_timestamp(),banned_until=statement_timestamp()+interval '1 day' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select throws_ok($$select * from pg_temp.confirm_a(1,2,gen_random_uuid())$$,'42501','FORBIDDEN','native banned identity refused');
reset role;
update auth.users set banned_until=null where id='11111111-1111-4111-8111-111111111111';
update app.seasons set status='closed' where id='ad160000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select * from pg_temp.confirm_a(1,2,gen_random_uuid())$$,'23514','SEASON_NOT_OPEN','closed target season cannot be confirmed');
reset role;
update app.seasons set status='preparing' where id='ad160000-0000-4000-8000-000000000002';
insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,status) values
 ('ad160000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Obsolete synthetic source','2024-07-01','2025-06-30','2024-12-15','closed');
insert into app.rollover_runs(id,tenant_id,source_season_id,target_season_id,state,created_by_auth_user_id,idempotency_key) values
 ('ad161000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad160000-0000-4000-8000-000000000003','ad160000-0000-4000-8000-000000000002','superseded','33333333-3333-4333-8333-333333333333','ad169000-0000-4000-8000-000000000005');
insert into app.season_reconfirmation_items(id,tenant_id,rollover_run_id,target_season_id,subject_kind,person_id,source_resource_id) values
 ('ad162000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad161000-0000-4000-8000-000000000002','ad160000-0000-4000-8000-000000000002','intake','a1000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000004',1,2,null,null,gen_random_uuid())$$,'23514','ROLLOVER_SUPERSEDED','superseded rollover cannot consume a pending request');
select ok(not (select can_confirm from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001') where item_id='ad162000-0000-4000-8000-000000000004'),'obsolete request has no confirmation control');
reset role;
update app.intake_profiles set status='draft' where id='a4000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select * from pg_temp.confirm_a(1,2,gen_random_uuid())$$,'23514','INTAKE_NOT_SUBMITTED','draft intake cannot be annual confirmation');
reset role;
update app.intake_profiles set status='submitted' where id='a4000000-0000-4000-8000-000000000001';
set local role authenticated;
create temp table first_confirmation as select * from pg_temp.confirm_a(1,2,'ad169000-0000-4000-8000-000000000003');
select ok((select ok and version=2 and (result->>'profile_version')::bigint=3 from first_confirmation),'own confirmation advances only item and profile metadata versions');
select is((select to_jsonb(r)::text from pg_temp.confirm_a(1,2,'ad169000-0000-4000-8000-000000000003') r),(select to_jsonb(r)::text from first_confirmation r),'exact retry returns the canonical receipt result');
select throws_ok($$select * from pg_temp.confirm_a(1,3,'ad169000-0000-4000-8000-000000000003')$$,'22000','IDEMPOTENCY_CONFLICT','same key with different version refused');
select throws_ok($$select * from pg_temp.confirm_a(1,2,gen_random_uuid())$$,'40001','STALE_VERSION','new command with old versions refused');
select throws_ok($$select * from pg_temp.confirm_a(2,3,gen_random_uuid())$$,'23514','RECONFIRMATION_ALREADY_RESOLVED','fresh command cannot overwrite confirmed item');
select is((select state from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001') where item_id='ad162000-0000-4000-8000-000000000001'),'confirmed','current request readback confirms resolution');
select is((select confirmed_answer_revision from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001') where item_id='ad162000-0000-4000-8000-000000000001'),2,'receipt points at the exact reviewed answers');
select is((select count(*) from app.intake_reconfirmation_receipts),1::bigint,'own receipt is visible under RLS');
reset role;
update auth.users set banned_until=statement_timestamp()+interval '1 day' where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select is((select count(*) from app.intake_reconfirmation_receipts),0::bigint,'native banned identity cannot read a prior receipt through RLS');
reset role;
update auth.users set banned_until=null where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select throws_ok($$update app.intake_reconfirmation_receipts set answer_revision=1$$,'42501',null,'authenticated cannot rewrite receipt');
reset role;
select is((select count(*) from app.intake_reconfirmation_receipts),1::bigint,'only one receipt persisted');
select throws_ok($$update app.intake_reconfirmation_receipts set answer_revision=1$$,'55000','intake_reconfirmation_receipts is append-only','native operator cannot rewrite historical receipt');
select is((select count(*) from app.audit_events where action='intake.annually_reconfirmed'),1::bigint,'only one annual audit persisted');
select is((select count(*) from app.domain_events where event_type='intake.annually_reconfirmed'),1::bigint,'only one annual event persisted');
select is((select current_revision from app.intake_profiles where id='a4000000-0000-4000-8000-000000000001'),2,'confirmation creates no extra answer revision');
select is((select answers->>'experience' from app.intake_answers_versions where profile_id='a4000000-0000-4000-8000-000000000001' and revision=2),'PERSONAL_A_RECONFIRMATION','reviewed personal answers stay unchanged');
select ok((select annual_confirmed_at is not null from app.intake_profiles where id='a4000000-0000-4000-8000-000000000001'),'annual metadata is recorded');
select ok((select payload_minimal ? 'expected_profile_version' and payload_minimal ? 'expected_item_version' and payload_minimal::text !~ 'PERSONAL_A_RECONFIRMATION|assistance_reason' from app.audit_events where action='intake.annually_reconfirmed'),'audit has expected versions without private answers or reason');
select is((select sum(minutes_delta) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),60::bigint,'confirmed minutes unchanged');
select is((select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001'),720,'annual target unchanged');
select is((select count(*) from app.obligations where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'confirmation creates no new obligation');
insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,granted_by_auth_user_id) values
 ('ad163000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','intake_assistance',statement_timestamp()-interval '1 day','22222222-2222-4222-8222-222222222222');
set local role authenticated;
select throws_ok($$select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000002',1,1,null,null,gen_random_uuid())$$,'42501','INVALID_REPRESENTATION','assisted confirmation needs explicit subject and context');
select lives_ok($$select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000002',1,1,'a1000000-0000-4000-8000-000000000002','PRIVATE_ASSISTANCE_CONTEXT','ad169000-0000-4000-8000-000000000004')$$,'active explicit intake delegation can confirm with recorded actor and subject');
reset role;
select ok((select actor_auth_user_id='11111111-1111-4111-8111-111111111111' and represented_person_id='a1000000-0000-4000-8000-000000000002' and assistance_reason='PRIVATE_ASSISTANCE_CONTEXT' from app.intake_reconfirmation_receipts where profile_id='a4000000-0000-4000-8000-000000000002'),'assisted attribution is preserved privately');
update app.acting_delegations set revoked_at=statement_timestamp() where id='ad163000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select * from api.confirm_intake_reconfirmation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad162000-0000-4000-8000-000000000002',1,1,'a1000000-0000-4000-8000-000000000002','PRIVATE_ASSISTANCE_CONTEXT','ad169000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','revoked assistance cannot replay a prior success');
select is((select count(*) from app.intake_reconfirmation_receipts),1::bigint,'revoked helper sees only own receipt');
select pg_temp.actor('22222222-2222-4222-8222-222222222222','ouder-b@example.test');
select is((select count(*) from app.intake_reconfirmation_receipts),1::bigint,'parent B cannot read parent A receipt');
select ok(not exists(select 1 from api.get_intake_reconfirmations('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002') r where to_jsonb(r)::text ~ 'PRIVATE_ASSISTANCE_CONTEXT|actor_auth_user_id|assistance_reason'),'minimal request projection never includes private attribution');
reset role;
select * from finish();
rollback;
