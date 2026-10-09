begin;
create extension if not exists pgtap with schema extensions;
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

-- Actual private worker guard in an owned database named postgres. No provider
-- requests are made: the known 429, acceptance and unknown receipts are SQL fixtures.
set local cluvo.delivery_scope='staging';
set local cluvo.delivery_project='fbozlbgmktkgcdfqdaaz';
set local cluvo.delivery_source='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
set local cluvo.delivery_run='109';
set local cluvo.delivery_actor='owned-digest-day-proof';
update auth.users set email_confirmed_at=statement_timestamp();
-- The current club date deliberately differs from UTC; historical digest
-- timezone remains UTC to prove it cannot authorize dispatch today.
update app.tenants set timezone=case when extract(hour from clock_timestamp() at time zone 'UTC')<12 then 'Etc/GMT+12' else 'Pacific/Kiritimati' end where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
create temporary table digest_fixture(label text primary key,id uuid,local_date date);
insert into digest_fixture values
 ('queued','f8100000-0000-4000-8000-000000000001',(clock_timestamp() at time zone (select timezone from app.tenants where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))::date-1),
 ('failed','f8100000-0000-4000-8000-000000000002',(clock_timestamp() at time zone (select timezone from app.tenants where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))::date-2),
 ('current','f8100000-0000-4000-8000-000000000003',(clock_timestamp() at time zone (select timezone from app.tenants where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))::date),
 ('unknown','f8100000-0000-4000-8000-000000000004',(clock_timestamp() at time zone (select timezone from app.tenants where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))::date-3);
insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type) values
 ('f8200000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shift','aa200000-0000-4000-8000-000000000003',1,'task.published');
-- Use the actual canonical category seeded at tenant creation.
insert into app.notification_intents(id,tenant_id,domain_event_id,recipient_person_id,category_id,channels,dedupe_key,safe_title,safe_body,source_path,status) values
 ('f8400000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f8200000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',(select id from app.notification_categories where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and category_key='task.offer'),array['inbox'],'owned-digest-day-proof','Owned offer','Synthetic available shift','/app/tasks','queued');
insert into app.task_offer_candidates(id,tenant_id,intent_id,recipient_person_id,shift_id,publication_event_id,usable_until) values
 ('f8500000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f8400000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','aa200000-0000-4000-8000-000000000003','f8200000-0000-4000-8000-000000000001','2027-02-01 12:00:00+01');
insert into app.daily_task_digests(id,tenant_id,recipient_person_id,local_date,timezone,status) select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001',local_date,'UTC','queued' from digest_fixture;
insert into app.daily_digest_items(tenant_id,digest_id,task_offer_candidate_id) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,'f8500000-0000-4000-8000-000000000001' from digest_fixture;
insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type) select id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','daily_digest',id,1,'pwa.news' from digest_fixture;
-- Using the real source/outbox insertion path preserves fixed channel consent
-- and recipient/event ownership rather than manufacturing a worker payload.
do $$declare r record;begin for r in select * from digest_fixture loop
 perform internal.pwa_automation_notification('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001',r.id,'news','Owned digest','Synthetic available tasks','/app/tasks','email','daily_digest',r.id,1,null,null,r.local_date);
end loop;end;$$;
-- DISPATCH_FIXTURE_READY: the concurrent owned harness commits only this
-- synthetic setup, then uses two separate real PostgreSQL worker transactions.
create temporary table claims(value jsonb);
insert into claims values(internal.pwa_claim_deliveries('f8600000-0000-4000-8000-000000000001',100));
create temporary view fixture_targets as select d.label,t.id,t.version,t.state,t.lease_owner from digest_fixture d join app.pwa_automation_sources s on s.source_id=d.id join app.pwa_delivery_targets t on t.outbox_id=s.outbox_id;
select is(jsonb_array_length((select value from claims)),4,'four real email targets leased without external requests');
select ok(internal.pwa_offer_usable('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','aa200000-0000-4000-8000-000000000003'),'real source is still an eligible future free shift');
select ok((select local_date from digest_fixture where label='current')<>(clock_timestamp() at time zone 'UTC')::date,'actual current tenant calendar day differs from UTC');
select ok((select bool_and(timezone='UTC') from app.daily_task_digests where id in(select id from digest_fixture)),'historical digest timezone snapshot remains unchanged');
select ok(not (internal.pwa_revalidate_delivery((select id from fixture_targets where label='queued'),'f8600000-0000-4000-8000-000000000001',(select version from fixture_targets where label='queued'))->>'eligible')::boolean,'previous-day queued digest cannot dispatch today');
select ok((internal.pwa_revalidate_delivery((select id from fixture_targets where label='current'),'f8600000-0000-4000-8000-000000000001',(select version from fixture_targets where label='current'))->>'eligible')::boolean,'today digest dispatches using current club timezone rather than UTC or snapshot');
select lives_ok($$select internal.pwa_finish_delivery((select id from fixture_targets where label='failed'),'f8600000-0000-4000-8000-000000000001',(select version from fixture_targets where label='failed'),'failed',429)$$,'known previous-day 429 is recorded through native receipt path');
select lives_ok($$select internal.pwa_finish_delivery((select id from fixture_targets where label='unknown'),'f8600000-0000-4000-8000-000000000001',(select version from fixture_targets where label='unknown'),'unknown',null)$$,'unknown previous-day outcome is retained through native receipt path');
select is((select status from app.daily_task_digests where id=(select id from digest_fixture where label='failed')),'failed','known 429 keeps historical digest failed');
select is((select status from app.daily_task_digests where id=(select id from digest_fixture where label='unknown')),'unknown','unknown keeps historical digest unknown');
update app.pwa_delivery_targets set next_attempt_at=statement_timestamp()-interval '1 second' where id=(select id from fixture_targets where label='failed');
truncate claims;
insert into claims values(internal.pwa_claim_deliveries('f8600000-0000-4000-8000-000000000002',100));
select is(jsonb_array_length((select value from claims)),1,'second worker can lease only due known-failed target, never in-flight or unknown');
select ok(not (internal.pwa_revalidate_delivery((select id from fixture_targets where label='failed'),'f8600000-0000-4000-8000-000000000002',(select version from fixture_targets where label='failed'))->>'eligible')::boolean,'known 429 retry from an old day is denied immediately before provider');
select is((select state from fixture_targets where label='unknown'),'unknown','unknown target is never automatically replayed');
select throws_ok($$select internal.pwa_revalidate_delivery((select id from fixture_targets where label='current'),'f8600000-0000-4000-8000-000000000002',(select version from fixture_targets where label='current'))$$,'40001','STALE_DELIVERY_LEASE','other worker cannot revalidate today target leased to first worker');
select lives_ok($$select internal.pwa_finish_delivery((select id from fixture_targets where label='queued'),'f8600000-0000-4000-8000-000000000001',(select version from fixture_targets where label='queued'),'cancelled',null)$$,'old queued digest is cancelled with durable acknowledgement');
select lives_ok($$select internal.pwa_finish_delivery((select id from fixture_targets where label='failed'),'f8600000-0000-4000-8000-000000000002',(select version from fixture_targets where label='failed'),'cancelled',null)$$,'old known failure is cancelled after revalidation rejects it');
select lives_ok($$select internal.pwa_finish_delivery((select id from fixture_targets where label='current'),'f8600000-0000-4000-8000-000000000001',(select version from fixture_targets where label='current'),'sent',202)$$,'synthetic current-day provider acceptance records one native receipt');
select is((select status from app.daily_task_digests where id=(select id from digest_fixture where label='current')),'provider_accepted','current digest now has real receipt state without actual provider claim');
select is((select count(*) from app.daily_task_digests where id in(select id from digest_fixture)),4::bigint,'all historical calendar slots remain reserved');
select throws_ok($$insert into app.daily_task_digests(tenant_id,recipient_person_id,local_date,timezone)select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001',local_date,'UTC' from digest_fixture where label='current'$$,'23505',null,'same-day second digest cannot reserve another slot after acceptance');
select throws_ok($$insert into app.daily_task_digests(tenant_id,recipient_person_id,local_date,timezone)select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001',local_date,'UTC' from digest_fixture where label='unknown'$$,'23505',null,'unknown outcome never releases its historical daily slot');
select is(jsonb_array_length(internal.pwa_claim_deliveries('f8600000-0000-4000-8000-000000000002',100)),0,'second worker cannot replay accepted, cancelled or unknown targets');
select is((select count(*) from app.pwa_delivery_attempt_log l join fixture_targets t on t.id=l.target_id where t.label='current' and l.state='sent'),1::bigint,'current slot has exactly one accepted attempt');
select throws_ok($$delete from app.pwa_delivery_attempt_log where target_id=(select id from fixture_targets where label='current')$$,'55000','pwa_delivery_attempt_log is append-only','dispatch day correction cannot erase receipt history');
select is((select count(*) from app.pwa_delivery_attempt_log l join fixture_targets t on t.id=l.target_id),10::bigint,'all initial leases, known failure, retry lease, unknown and terminal receipts are append-only');
select ok(not has_function_privilege('authenticated','internal.pwa_revalidate_delivery(uuid,uuid,bigint)','EXECUTE'),'authenticated cannot invoke private dispatch revalidation');
select ok(not has_function_privilege('service_role','internal.pwa_revalidate_delivery(uuid,uuid,bigint)','EXECUTE'),'service role cannot bypass native automation gate');
select ok(not has_function_privilege('cluvo_command_owner','internal.pwa_revalidate_delivery(uuid,uuid,bigint)','EXECUTE'),'command owner cannot invoke private worker gate');
select * from finish();
rollback;
