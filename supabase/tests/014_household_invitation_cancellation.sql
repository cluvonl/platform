begin;
create extension if not exists pgtap;
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


update auth.users set email_confirmed_at=statement_timestamp() where email like '%@example.test';
insert into auth.users(id,email,email_confirmed_at) values
 ('55555555-5555-4555-8555-555555555555','cancel-recipient@example.test',statement_timestamp()),
 ('66666666-6666-4666-8666-666666666666','accepted-recipient@example.test',statement_timestamp());
create temporary table cancel_fixture(case_key text primary key,email text,token text,id uuid);
insert into cancel_fixture(case_key,email,token) values
 ('sent','cancel-recipient@example.test',gen_random_uuid()::text||gen_random_uuid()::text),
 ('accepted','accepted-recipient@example.test',gen_random_uuid()::text||gen_random_uuid()::text),
 ('failed','cancel-failed@example.test',gen_random_uuid()::text||gen_random_uuid()::text),
 ('pending','cancel-pending@example.test',gen_random_uuid()::text||gen_random_uuid()::text),
 ('expired','cancel-expired@example.test',gen_random_uuid()::text||gen_random_uuid()::text);
grant select,update on cancel_fixture to authenticated;
create function pg_temp.actor(p_uid text,p_email text) returns void language plpgsql security invoker as $f$
begin perform set_config('request.jwt.claim.sub',p_uid,true);perform set_config('request.jwt.claim.email',p_email,true);end;$f$;
create function pg_temp.new_invite(p_case text,p_version bigint) returns uuid language sql security invoker as $f$
 select resource_id from api.create_household_invitation_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001',
 'Extra',p_case,(select email from cancel_fixture where case_key=p_case),
 encode(extensions.digest(convert_to((select token from cancel_fixture where case_key=p_case),'UTF8'),'sha256'),'hex'),true,false,p_version,gen_random_uuid());$f$;
create function pg_temp.cancel_invite(p_case text,p_version bigint,p_key uuid) returns bigint language sql security invoker as $f$
 select version from api.cancel_household_invitation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from cancel_fixture where case_key=p_case),p_version,p_key);$f$;
create function pg_temp.dossier() returns jsonb language sql security invoker as $f$
 select api.get_household_dossier_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001');$f$;
select ok(not has_function_privilege('anon','api.cancel_household_invitation(uuid,uuid,bigint,uuid)','EXECUTE'),'anonymous cancellation denied');
select ok(not has_function_privilege('service_role','api.cancel_household_invitation(uuid,uuid,bigint,uuid)','EXECUTE'),'service role cannot cancel as a member');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111','ouder-a@example.test');
update cancel_fixture set id=pg_temp.new_invite('sent',1) where case_key='sent';
update cancel_fixture set id=pg_temp.new_invite('accepted',2) where case_key='accepted';
update cancel_fixture set id=pg_temp.new_invite('failed',3) where case_key='failed';
update cancel_fixture set id=pg_temp.new_invite('pending',4) where case_key='pending';
update cancel_fixture set id=pg_temp.new_invite('expired',5) where case_key='expired';
select * from api.mark_household_invitation_delivery_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from cancel_fixture where case_key='sent'),1,true,gen_random_uuid());
select * from api.mark_household_invitation_delivery_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from cancel_fixture where case_key='accepted'),1,true,gen_random_uuid());
select * from api.mark_household_invitation_delivery_v2('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from cancel_fixture where case_key='failed'),1,false,gen_random_uuid());
select pg_temp.actor('66666666-6666-4666-8666-666666666666','accepted-recipient@example.test');
select * from api.accept_household_invitation_v2((select token from cancel_fixture where case_key='accepted'),2,gen_random_uuid());
reset role;
update app.household_invitations set created_at=statement_timestamp()-interval '2 hours', expires_at=statement_timestamp()-interval '1 second' where id=(select id from cancel_fixture where case_key='expired');
update app.household_access_grants set can_invite_executor=true where auth_user_id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
select pg_temp.actor('22222222-2222-4222-8222-222222222222','ouder-b@example.test');
select throws_ok($$select pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','other contact with invite right cannot cancel another private invitation');
select is(jsonb_array_length(pg_temp.dossier()->'invitations'),0,'other parent does not see private invitation controls');
select pg_temp.actor('44444444-4444-4444-8444-444444444444','tenant-b@example.test');
select throws_ok($$select pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','foreign tenant cancellation denied');
select throws_ok($$select pg_temp.dossier()$$,'42501','FORBIDDEN','foreign dossier v2 remains denied');
select pg_temp.actor('33333333-3333-4333-8333-333333333333','coordinator@example.test');
select throws_ok($$select pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','committee scope is not a dossier invitation mandate');
select pg_temp.actor('55555555-5555-4555-8555-555555555555','cancel-recipient@example.test');
select isnt(api.household_invitation_context((select token from cancel_fixture where case_key='sent')),null::jsonb,'correct recipient has consent before cancellation');
reset role;
update auth.users set email_confirmed_at=null where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111','ouder-a@example.test');
select throws_ok($$select pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','unconfirmed current Auth identity cannot cancel');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'invitations') as i where (i->>'can_cancel')::boolean),'unconfirmed identity has no cancellation control');
reset role;
update auth.users set email_confirmed_at=statement_timestamp() where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'invitations') as i where i->>'delivery_status'='accepted' and (i->>'can_cancel')::boolean),'accepted invitation has no cancel control');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'invitations') as i where i->>'delivery_status'='sent' and (i->>'can_cancel')::boolean and (i->>'version')::bigint=2),'current authorized invitation exposes only versioned control');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'invitations') as i where (i->>'expired')::boolean),'expiry is server derived');
select throws_ok($$select pg_temp.cancel_invite('sent',null,'ae110000-0000-4000-8000-000000000001')$$,'22023','INVALID_INVITATION','expected invitation version required');
select throws_ok($$select pg_temp.cancel_invite('sent',2,null)$$,'22023','INVALID_INVITATION','idempotency key required');
select throws_ok($$select pg_temp.cancel_invite('sent',1,'ae110000-0000-4000-8000-000000000001')$$,'40001','STALE_VERSION','stale delivery version cannot cancel');
select is(pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001'),3::bigint,'cancellation advances invitation version');
select is(pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001'),3::bigint,'lost-response exact cancellation replay returns original version');
select throws_ok($$select pg_temp.cancel_invite('sent',3,'ae110000-0000-4000-8000-000000000001')$$,'22000','IDEMPOTENCY_CONFLICT','changed cancellation payload with same key denied');
select is(pg_temp.cancel_invite('sent',3,'ae110000-0000-4000-8000-000000000002'),3::bigint,'new current-version no-op does not create a second transition');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'invitations') as i where i->>'delivery_status'='cancelled' and (i->>'can_cancel')::boolean),'cancelled invitation has no new cancel control');
select ok(exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'history') as h where h->>'action'='household.invitation_cancelled' and (h->>'actor_is_self')::boolean),'minimal own cancellation history visible');
select pg_temp.actor('55555555-5555-4555-8555-555555555555','cancel-recipient@example.test');
select is(api.household_invitation_context((select token from cancel_fixture where case_key='sent')),null::jsonb,'revoked personal link has no consent context');
select throws_ok($$select * from api.accept_household_invitation_v2((select token from cancel_fixture where case_key='sent'),3,gen_random_uuid())$$,'42501','INVALID_INVITATION','current-version acceptance cannot consume a cancelled invitation');
select throws_ok($$select * from api.accept_household_invitation((select token from cancel_fixture where case_key='sent'))$$,'42501','permission denied for function accept_household_invitation','retired legacy endpoint rejects even a known cancelled token');
reset role;
select is((select count(*) from app.household_access_grants where auth_user_id='55555555-5555-4555-8555-555555555555'),0::bigint,'cancelled recipient gained no dossier grant');
select is((select count(*) from app.account_person_links where auth_user_id='55555555-5555-4555-8555-555555555555'),0::bigint,'cancelled recipient gained no person link');
select is((select version from app.households where id='a3000000-0000-4000-8000-000000000001'),8::bigint,'one cancellation increments dossier once after five creations and one acceptance');
select is((select count(*) from app.audit_events where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and action='household.invitation_cancelled'),1::bigint,'one cancellation audit after replay and no-op');
select ok(exists(select 1 from app.audit_events where action='household.invitation_cancelled' and actor_auth_user_id='11111111-1111-4111-8111-111111111111' and scope_kind='household' and scope_id='a3000000-0000-4000-8000-000000000001' and idempotency_key='ae110000-0000-4000-8000-000000000001' and payload_minimal->>'expected_version'='2' and payload_minimal->>'version'='3'),'cancel audit records actor scope expected/new version and command key');
select is((select count(*) from app.domain_events where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and event_type='household.invitation_cancelled'),1::bigint,'one append-only cancellation event');
select is((select count(*) from app.idempotency_records where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and operation='cancel_household_invitation' and status='completed'),2::bigint,'original and current no-op commands are completed without failed leftovers');
update app.household_access_grants set can_invite_executor=false where auth_user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111','ouder-a@example.test');
select throws_ok($$select pg_temp.cancel_invite('sent',2,'ae110000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','revoked invite right blocks even exact replay');
select pg_temp.actor('22222222-2222-4222-8222-222222222222','ouder-b@example.test');
select ok(not exists(select 1 from jsonb_array_elements(pg_temp.dossier()->'history') as h where h->>'action'='household.invitation_cancelled'),'other parent does not receive private cancellation history');
reset role;
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,household_id,granted_by_auth_user_id)
 values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 (select id from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='volunteer_committee'),
 'household','a3000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333');
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333','coordinator@example.test');
select throws_ok($$select pg_temp.cancel_invite('accepted',2,gen_random_uuid())$$,'40001','STALE_VERSION','acceptance winner makes old cancel version stale');
select throws_ok($$select pg_temp.cancel_invite('accepted',3,gen_random_uuid())$$,'22023','INVITATION_ALREADY_ACCEPTED','accepted access requires separate grant management');
select is(pg_temp.cancel_invite('failed',2,gen_random_uuid()),3::bigint,'scoped authorized committee cancels failed delivery');
select is(pg_temp.cancel_invite('pending',1,gen_random_uuid()),2::bigint,'pending invitation can be cancelled');
select is(pg_temp.cancel_invite('expired',1,gen_random_uuid()),2::bigint,'expired invitation can be closed with history');
select ok(pg_temp.dossier()::text !~ 'cancel-recipient@|accepted-recipient@|token_hash|email_hash|payload_minimal|auth_user_id','dossier controls and history omit contacts token hashes audit payload and actor IDs');
reset role;
select is((select count(*) from app.obligations where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),1::bigint,'cancellation never changes canonical obligation count');
select is((select sum(minutes_delta) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),60::bigint,'confirmed ledger history unchanged');
select is((select count(*) from app.household_invitations where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),5::bigint,'invitation rows are retained for history');
select is((select count(*) from app.household_access_grants where auth_user_id='66666666-6666-4666-8666-666666666666' and revoked_at is null),1::bigint,'accepted recipient rights remain active');
select * from finish();
rollback;
