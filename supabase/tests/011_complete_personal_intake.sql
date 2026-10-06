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


select ok(not has_function_privilege('anon','api.list_intake_contexts(uuid)','EXECUTE'),'anonymous subjects cannot be searched');
select ok(not has_function_privilege('service_role','api.list_intake_contexts(uuid)','EXECUTE'),'service key cannot enumerate subjects');
select ok(not has_function_privilege('authenticated', 'internal.sync_intake_unavailability(uuid,uuid)', 'EXECUTE'), 'source synchronization is not an arbitrary user endpoint');
select ok(not has_function_privilege('anon', 'api.save_intake_revision(uuid,uuid,bigint,integer,jsonb,uuid,text,uuid)', 'EXECUTE'), 'anonymous intake mutation is denied');
select ok(not has_function_privilege('service_role', 'api.save_intake_revision(uuid,uuid,bigint,integer,jsonb,uuid,text,uuid)', 'EXECUTE'), 'service key cannot replace the actor');
select ok(not has_table_privilege('authenticated','app.unavailability_periods','DELETE'), 'no direct availability deletion');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid='api.intake_task_categories'::regclass), 'categories use invoker and tenant RLS');

set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from api.intake_task_categories),1,'own category catalog only');
select is((select count(*)::integer from api.my_intake),1,'other parent and tenant profiles remain hidden');
select is((select count(*)::integer from api.list_intake_contexts('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),1,'only own intake subject is listed');
select is((select display_name from api.list_intake_contexts('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),'Ouder A','minimal own subject label');
select throws_ok($$select * from api.list_intake_contexts('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501','FORBIDDEN','context search rejects another tenant');
select lives_ok($$select * from api.save_intake_revision(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',1,240,
 '{"schema_version":2,"experience":"horeca","preferences":["Bar"],"skills":["EHBO","Gastvrijheid"],"availability":["Zaterdag ochtend"],"unavailability":["2026-03-29","2026-10-25","2027-02-01"],"training_needs":["IVA"],"fixed_role_interest":["Commissie"],"practical_limitations":"praktische grens","buddy_requested":true,"reserve_willing":true,"desired_monthly_minutes":90}',null,null,'ac020000-0000-4000-8000-000000000001')$$,'complete typed intake is saved by its own actor');
select lives_ok($$select * from api.save_intake_revision(
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',1,240,
 '{"schema_version":2,"experience":"horeca","preferences":["Bar"],"skills":["EHBO","Gastvrijheid"],"availability":["Zaterdag ochtend"],"unavailability":["2026-03-29","2026-10-25","2027-02-01"],"training_needs":["IVA"],"fixed_role_interest":["Commissie"],"practical_limitations":"praktische grens","buddy_requested":true,"reserve_willing":true,"desired_monthly_minutes":90}',null,null,'ac020000-0000-4000-8000-000000000001')$$,'identical retry returns the persisted result');

select is((select version from api.my_intake),2::bigint,'one revision advances version');
select is((select desired_minutes from api.my_intake),240,'seasonal wish stays separate');
select is((select answers->'desired_monthly_minutes' from api.my_intake),'90'::jsonb,'monthly minutes stored as integer');
select is((select answers->'buddy_requested' from api.my_intake),'true'::jsonb,'buddy preference stored');
select is((select count(*)::integer from app.unavailability_periods),3,'three own date projections');
select is((select extract(epoch from ends_at-starts_at)::integer from app.unavailability_periods where source_unavailable_on='2026-03-29'),23*3600,'spring day has 23 local hours');
select is((select extract(epoch from ends_at-starts_at)::integer from app.unavailability_periods where source_unavailable_on='2026-10-25'),25*3600,'fall day has 25 local hours');
select is((select count(*)::integer from api.my_intake where person_id='a1000000-0000-4000-8000-000000000002'),0,'separated parent intake cannot leak');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002',1,180,'{"schema_version":2,"experience":"steal"}',null,null,'ac020000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','other parent mutation denied');
select throws_ok($$select * from api.save_intake_revision('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b4000000-0000-4000-8000-000000000001',1,120,'{"schema_version":2,"experience":"steal"}',null,null,'ac020000-0000-4000-8000-000000000003')$$,'42501','FORBIDDEN','cross tenant mutation denied');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',1,240,'{"schema_version":2,"experience":"stale"}',null,null,'ac020000-0000-4000-8000-000000000004')$$,'40001','STALE_VERSION','stale browser cannot overwrite');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"experience":"changed"}',null,null,'ac020000-0000-4000-8000-000000000001')$$,'22000','IDEMPOTENCY_CONFLICT','ambiguous retry with different answers is rejected');
reset role;
select is((select count(*)::integer from app.intake_answers_versions where profile_id='a4000000-0000-4000-8000-000000000001'),2,'old and new immutable answers both retained');
select is((select answers->>'skills' from app.intake_answers_versions where profile_id='a4000000-0000-4000-8000-000000000001' and revision=1),'EHBO','old personal text is unchanged');
select is((select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001'),720,'intake does not change target');
select is((select sum(minutes_delta)::integer from app.hour_ledger_entries),60,'intake grants no confirmed hours');
select is((select count(*)::integer from app.bookings where id='aa300000-0000-4000-8000-000000000001' and state='booked'),1,'earlier booking remains despite new unavailable day');
select is((select payload_minimal from app.audit_events where action='intake.revision_saved' order by occurred_at desc limit 1),'{"revision":2}'::jsonb,'audit contains no private answers');
select is((select actor_auth_user_id from app.audit_events where action='intake.revision_saved' limit 1),'11111111-1111-4111-8111-111111111111'::uuid,'audit uses verified actor');

-- Invalid direct RPC payloads bypass the web form but must still fail.
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"buddy_requested":"true"}',null,null,'ac020000-0000-4000-8000-000000000010')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 10 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"reserve_willing":null}',null,null,'ac020000-0000-4000-8000-000000000011')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 11 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"desired_monthly_minutes":1.5}',null,null,'ac020000-0000-4000-8000-000000000012')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 12 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"desired_monthly_minutes":-1}',null,null,'ac020000-0000-4000-8000-000000000013')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 13 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"desired_monthly_minutes":100001}',null,null,'ac020000-0000-4000-8000-000000000014')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 14 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"unavailability":["2026-02-30"]}',null,null,'ac020000-0000-4000-8000-000000000015')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 15 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"unavailability":["2026-10-25","2026-10-25"]}',null,null,'ac020000-0000-4000-8000-000000000016')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 16 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"availability":[{}]}',null,null,'ac020000-0000-4000-8000-000000000017')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 17 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"skills":{}}',null,null,'ac020000-0000-4000-8000-000000000018')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 18 is rejected');
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"diagnosis":"not an intake field"}',null,null,'ac020000-0000-4000-8000-000000000019')$$,'22023','INVALID_INTAKE_ANSWERS','invalid direct payload 19 is rejected');

select lives_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',2,240,'{"schema_version":2,"experience":"legacy retry","desired_monthly_minutes":0}',null,null,'ac020000-0000-4000-8000-000000000030')$$,'old string payload still works with explicit monthly zero');
select is((select answers->'desired_monthly_minutes' from api.my_intake),'0'::jsonb,'zero is explicit, not missing');
select is((select count(*)::integer from app.unavailability_periods),3,'partial legacy edit preserves date projection');
select lives_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000001',3,240,'{"schema_version":2,"unavailability":[],"desired_monthly_minutes":null}',null,null,'ac020000-0000-4000-8000-000000000031')$$,'owner can clear own date projection without deleting history');
select is((select count(*)::integer from app.unavailability_periods),0,'cleared dates are no longer a block');
select is((select answers->'desired_monthly_minutes' from api.my_intake),'null'::jsonb,'missing monthly wish stays null');

reset role;
insert into app.unavailability_periods(tenant_id,person_id,starts_at,ends_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','2027-03-03 00:00:00+01','2027-03-04 00:00:00+01');
set local role authenticated;
set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select lives_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002',1,180,'{"schema_version":2,"unavailability":["2027-02-01"]}',null,null,'ac020000-0000-4000-8000-000000000032')$$,'other parent controls only their own availability');
select throws_ok($$select * from api.book_shift('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa200000-0000-4000-8000-000000000001','aa210000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000001',1,'ac020000-0000-4000-8000-000000000033')$$,'42501','NOT_ELIGIBLE','new booking is blocked by persisted intake day');
select lives_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002',2,180,'{"schema_version":2,"unavailability":[]}',null,null,'ac020000-0000-4000-8000-000000000034')$$,'owner can remove own block');
select lives_ok($$select * from api.book_shift('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa200000-0000-4000-8000-000000000001','aa210000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000001',1,'ac020000-0000-4000-8000-000000000035')$$,'same free place can be booked once block is removed');
reset role;
select is((select count(*)::integer from app.bookings where position_id='aa210000-0000-4000-8000-000000000002'),1,'eligibility change does not duplicate booking');

select is((select count(*)::integer from app.unavailability_periods where source_intake_profile_id is null),1,'independent availability survives source edits');
select is((select count(*)::integer from app.unavailability_periods where source_intake_profile_id is not null),0,'only cleared source projections are removed');
select throws_ok($$insert into app.unavailability_periods(tenant_id,person_id,starts_at,ends_at,source_intake_profile_id,source_unavailable_on) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000002','2027-03-03','2027-03-04','a4000000-0000-4000-8000-000000000001','2027-03-03')$$,'23503',null,'source FK cannot project another executor');
insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,granted_by_auth_user_id)
values('ac020000-0000-4000-8000-000000000040','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','intake_assistance',statement_timestamp()-interval '1 day','22222222-2222-4222-8222-222222222222');
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select is((select count(*)::integer from api.list_intake_contexts('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),2,'explicit delegation permits a second context');
select is((select display_name from api.list_intake_contexts('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where not is_self),'Ouder B','delegation returns subject label without person registry access');
select is((select count(*)::integer from app.persons where id='a1000000-0000-4000-8000-000000000002'),0,'delegation does not expose raw person or birthdate');
select lives_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002',3,180,'{"experience":"hulp op verzoek"}','a1000000-0000-4000-8000-000000000002','persoonlijk toestemming gegeven','ac020000-0000-4000-8000-000000000041')$$,'explicit assistance retains actor and represented person');
reset role;
select is((select represented_person_id from app.intake_answers_versions where profile_id='a4000000-0000-4000-8000-000000000002' and revision=4),'a1000000-0000-4000-8000-000000000002'::uuid,'assisted revision names the subject');
update app.acting_delegations set revoked_at=statement_timestamp() where id='ac020000-0000-4000-8000-000000000040';
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select throws_ok($$select * from api.save_intake_revision('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a4000000-0000-4000-8000-000000000002',3,180,'{"experience":"hulp op verzoek"}','a1000000-0000-4000-8000-000000000002','persoonlijk toestemming gegeven','ac020000-0000-4000-8000-000000000041')$$,'42501','FORBIDDEN','revoked mandate also rejects an identical replay');
select is((select count(*)::integer from api.my_intake),1,'revoked subject is absent from read/search/export projection');
select is((select count(*)::integer from api.list_intake_contexts('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),1,'revoked subject label is also removed');
reset role;

select * from finish();
rollback;
