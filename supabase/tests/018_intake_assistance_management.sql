begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
-- Inline unchanged core-v1 fixture SHA256 ffc09f1d4f81455d61bb2c43ed2f118ccdf4480a8bfb935da6ec33eda7ec2650
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

update auth.users set email_confirmed_at=statement_timestamp();
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,statement_timestamp(),statement_timestamp() from auth.users;
create function pg_temp.cluvo_test_claims(p_actor uuid) returns text language sql security definer set search_path='' as $claims$
select jsonb_build_object('sub',p_actor,'role','authenticated','session_id',p_actor,'email',(select email from auth.users where id=p_actor))::text;
$claims$;

-- Review authority belongs only to the explicitly scoped volunteer committee.
insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,household_id,starts_at,granted_by_auth_user_id)
values('a3300000-0000-4000-8000-000000000018','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 (select id from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='volunteer_committee'),
 'household','a3000000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333');
select set_config('cluvo.test.assistance.ends_at',(statement_timestamp()+interval '30 days')::text,true);
create function pg_temp.actor(p_actor uuid) returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform set_config('request.jwt.claims',pg_temp.cluvo_test_claims(p_actor),true);
end;$$;
select ok(not has_function_privilege('authenticated','internal.intake_assistance_helpers(uuid,uuid)','EXECUTE'),'helper Auth IDs stay private');
select ok(not has_function_privilege('anon','api.grant_intake_assistance(uuid,uuid,uuid,uuid,bigint,timestamptz,text,uuid)','EXECUTE'),'anonymous cannot grant assistance');
select ok(not has_function_privilege('service_role','api.revoke_intake_assistance(uuid,uuid,bigint,bigint,text,uuid)','EXECUTE'),'service credentials have no human revoke command');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(api.get_intake_assistance_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001'),null::jsonb,'parent cannot browse committee assistance management');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Parent self escalation','aa180000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','parent cannot self-grant access to other parent');
select is((select count(*) from api.my_intake where profile_id='a4000000-0000-4000-8000-000000000002'),0::bigint,'other parent answers stay hidden before explicit grant');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(jsonb_array_length(api.get_intake_assistance_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001')->'subjects'),2,'scoped committee gets two linked personal subjects');
select is(jsonb_array_length(api.get_intake_assistance_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001')->'helpers'),3,'helpers are linked parents or scoped intake staff');
select ok(api.get_intake_assistance_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001')::text !~ 'auth_user_id|answers|reason|email','minimal context has no Auth IDs, answers, reasons or email');
select is(api.get_intake_assistance_context('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b3000000-0000-4000-8000-000000000001'),null::jsonb,'reviewer cannot cross tenants');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,' ','aa180000-0000-4000-8000-000000000002')$$,'22023','INVALID_COMMAND','grant needs a recorded reason');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Foreign helper','aa180000-0000-4000-8000-000000000003')$$,'42501','INVALID_ASSISTANT','helper person cannot belong to other tenant');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Foreign intake','aa180000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','subject profile stays in the reviewed household and tenant');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Same person','aa180000-0000-4000-8000-000000000005')$$,'42501','INVALID_ASSISTANT','a personal self profile needs no assistance grant');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',1,statement_timestamp()-interval '1 day','Expired period','aa180000-0000-4000-8000-000000000006')$$,'23514','ASSISTANCE_NOT_AVAILABLE','grant must have a future expiry');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',1,'infinity'::timestamptz,'Infinite period','aa180000-0000-4000-8000-000000000014')$$,'22023','INVALID_COMMAND','the database requires a finite portable expiry');
create temporary table assistance_result as select * from api.grant_intake_assistance(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002',
 'a1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Explicit practical intake support','aa180000-0000-4000-8000-000000000007');
select is((select version from assistance_result),1::bigint,'new delegation starts at version one');
select is((select (result->>'household_version')::int from assistance_result),2,'grant increments the checked household version');
select is((select resource_id from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Explicit practical intake support','aa180000-0000-4000-8000-000000000007')),(select resource_id from assistance_result),'exact lost-response retry keeps the original delegation');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',1,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Changed reason','aa180000-0000-4000-8000-000000000007')$$,'22000','IDEMPOTENCY_CONFLICT','changed grant payload cannot reuse a committed key');
select throws_ok($$select * from api.grant_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001',2,current_setting('cluvo.test.assistance.ends_at')::timestamptz,'Duplicate permission','aa180000-0000-4000-8000-000000000008')$$,'23514','ASSISTANCE_ALREADY_GRANTED','another key cannot create overlapping duplicate assistance');
select is((select count(*) from app.intake_assistance_decisions),1::bigint,'one immutable grant decision after retries');
select ok((select actor_auth_user_id='33333333-3333-4333-8333-333333333333' and represented_person_id='a1000000-0000-4000-8000-000000000002' and helper_person_id='a1000000-0000-4000-8000-000000000001' from app.intake_assistance_decisions),'reviewer, helper and represented person remain separate');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*) from api.my_intake where profile_id='a4000000-0000-4000-8000-000000000002'),1::bigint,'explicit assistance opens only the represented intake');
select is((select count(*) from app.intake_assistance_decisions),0::bigint,'helper cannot read committee decision reasons');
select ok(not internal.can_book_executor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000001'),'intake assistance never grants booking authority');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select throws_ok($$select * from api.revoke_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from assistance_result),1,1,'Stale dossier','aa180000-0000-4000-8000-000000000009')$$,'40001','STALE_VERSION','revoke checks household version');
select throws_ok($$select * from api.revoke_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from assistance_result),2,2,'Stale grant','aa180000-0000-4000-8000-000000000010')$$,'40001','STALE_VERSION','revoke checks the exact delegation version');
create temporary table assistance_revoked as select * from api.revoke_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from assistance_result),2,1,'Support ended','aa180000-0000-4000-8000-000000000011');
select is((select version from assistance_revoked),2::bigint,'revocation increments delegation version');
select is((select (result->>'household_version')::int from assistance_revoked),3,'revocation increments dossier version');
select is((select resource_id from api.revoke_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from assistance_result),2,1,'Support ended','aa180000-0000-4000-8000-000000000011')),(select resource_id from assistance_result),'exact revoke retry returns the same canonical receipt');
select is((select count(*) from app.intake_assistance_decisions),2::bigint,'revocation preserves the original grant decision');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*) from api.my_intake where profile_id='a4000000-0000-4000-8000-000000000002'),0::bigint,'revoked helper immediately loses other parent intake');
select is((select count(*) from api.my_intake where profile_id='a4000000-0000-4000-8000-000000000001'),1::bigint,'revoking assistance preserves own intake');
reset role;
select is((select count(*) from app.acting_delegations),1::bigint,'historical delegation is retained');
select is((select count(*) from app.audit_events where action in ('intake.assistance_granted','intake.assistance_revoked')),2::bigint,'one audit for each successful permission change');
select is((select count(*) from app.domain_events where event_type in ('intake.assistance_granted','intake.assistance_revoked')),2::bigint,'permission changes each have one event');
select is((select count(*) from app.intake_answers_versions),3::bigint,'management creates no intake answers');
select is((select sum(minutes_delta) from app.hour_ledger_entries),60::bigint,'permission changes leave confirmed minutes unchanged');
select is((select count(*) from app.obligations),2::bigint,'permission changes create no obligation');
select is((select count(*) from app.bookings),2::bigint,'permission changes create no booking');
select throws_ok($$update app.intake_assistance_decisions set reason=reason$$,'55000','intake_assistance_decisions is append-only','decision history cannot be rewritten');
-- Legacy future grants and revoked helper identities must remain cancellable.
insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,ends_at,granted_by_auth_user_id)
values('aa180000-0000-4000-8000-000000000012','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','intake_assistance',statement_timestamp()+interval '1 day',statement_timestamp()+interval '2 days','33333333-3333-4333-8333-333333333333');
update app.account_person_links set revoked_at=statement_timestamp() where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and auth_user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select * from api.revoke_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa180000-0000-4000-8000-000000000012',3,1,'Cancelled before start','aa180000-0000-4000-8000-000000000013')$$,'a future grant can be ended after the helper identity link is revoked');
reset role;
select ok((select revoked_at<starts_at and version=2 from app.acting_delegations where id='aa180000-0000-4000-8000-000000000012'),'future cancellation records the actual current time');
update app.access_grants set revoked_at=statement_timestamp() where id='a3300000-0000-4000-8000-000000000018';
set local role authenticated;
select is(api.get_intake_assistance_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001'),null::jsonb,'ended reviewer scope closes the management projection');
select throws_ok($$select * from api.revoke_intake_assistance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from assistance_result),2,1,'Support ended','aa180000-0000-4000-8000-000000000011')$$,'42501','FORBIDDEN','lost reviewer authority blocks even an old successful receipt');
select * from finish();
rollback;
