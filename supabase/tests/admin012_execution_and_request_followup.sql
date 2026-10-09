begin;
set local search_path=public,extensions;
select no_plan();
-- Reuse the existing synthetic core fixture; no live account data enters this test.
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
insert into auth.sessions(id,user_id)select id,id from auth.users;
insert into app.permission_roles(id,tenant_id,role_key,name,system_role)values('ae000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','native_followup','Explicit review and vacancy authority',false);
insert into app.role_permissions(tenant_id,role_id,permission_key)select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ae000000-0000-4000-8000-000000000001',k from unnest(array['hour_dispute.review','vacancy.manage','volunteer_role.manage','report.season.view'])k;
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','ae000000-0000-4000-8000-000000000001','tenant','33333333-3333-4333-8333-333333333333');
insert into app.hour_disputes(id,tenant_id,booking_id,obligation_id,opened_by_auth_user_id,description)values('ae000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa300000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Reviewed execution was longer than the initial partial award');
insert into app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at)values('ae000000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa200000-0000-4000-8000-000000000002',2,'2026-09-01 10:00:00+02','2026-09-01 12:00:00+02');
insert into app.bookings(id,tenant_id,position_id,executor_person_id,obligation_id,state,booked_by_auth_user_id,starts_at_snapshot,ends_at_snapshot,credit_minutes_snapshot,cancellation_deadline_snapshot,task_version_snapshot,idempotency_key)values('ae000000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ae000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','performed_pending','11111111-1111-4111-8111-111111111111','2026-09-01 10:00:00+02','2026-09-01 12:00:00+02',120,'2026-08-30 10:00:00+02','a9000000-0000-4000-8000-000000000001','ae600000-0000-4000-8000-000000000004');
insert into app.volunteer_role_catalog(id,tenant_id,name)values('ae000000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic vacancy role');
insert into app.volunteer_role_versions(id,tenant_id,role_id,revision,household_exempt,effective_from,approved_by_auth_user_id)values('ae000000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ae000000-0000-4000-8000-000000000005',1,true,'2026-07-01','33333333-3333-4333-8333-333333333333');
insert into app.vacancies(id,tenant_id,role_version_id,title,description,expected_minutes,guidance,contact_person_id,state)values('ae000000-0000-4000-8000-000000000007','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ae000000-0000-4000-8000-000000000006','Synthetic volunteer vacancy','Reviewed role and separate appointment',120,'Guidance is discussed during the meeting','a1000000-0000-4000-8000-000000000003','published');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","session_id":"11111111-1111-4111-8111-111111111111"}',true);
select set_config('cluvo.admin.interest',(select resource_id::text from api.express_vacancy_interest('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ae000000-0000-4000-8000-000000000007','I would like to discuss this role','ae600000-0000-4000-8000-000000000001')),true);
select throws_ok($$select api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','take_hour_dispute','ae000000-0000-4000-8000-000000000002',1,'{"reason":"Forged review authority"}','ae600000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','member cannot claim another administrative hour review');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","session_id":"33333333-3333-4333-8333-333333333333"}',true);
select is(jsonb_array_length(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','requests',null,null,'','',100,0,'{"queue":"disputes"}')->'rows'),1,'hour queue has the real open dispute');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','take_hour_dispute','ae000000-0000-4000-8000-000000000002',1,'{"reason":"Review the original execution and ledger"}','ae600000-0000-4000-8000-000000000003')->>'version','2','taking a dispute stores named reviewer and current source');
select throws_ok($$select api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','resolve_hour_dispute','ae000000-0000-4000-8000-000000000002',2,'{"outcome":"corrected","decision_id":"aa400000-0000-4000-8000-000000000001","explicit_confirmation":true,"reason":"Negative invented correction"}','ae600000-0000-4000-8000-000000000005')$$,'55000','CANONICAL_CORRECTION_REQUIRED','resolved corrected cannot invent a ledger correction');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','correct_attendance_award','aa300000-0000-4000-8000-000000000002',1,'{"result":"partial","awarded_minutes":90,"explicit_confirmation":true,"reason":"Verified ninety minutes after review"}','ae600000-0000-4000-8000-000000000006')->>'version','2','admin correction reuses the canonical append-only execution command');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','correct_attendance_award','aa300000-0000-4000-8000-000000000002',1,'{"result":"partial","awarded_minutes":90,"explicit_confirmation":true,"reason":"Verified ninety minutes after review"}','ae600000-0000-4000-8000-000000000006')->>'version','2','retry reuses the same canonical correction receipt');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','resolve_hour_dispute','ae000000-0000-4000-8000-000000000002',2,jsonb_build_object('outcome','corrected','decision_id',api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','requests',null,'ae000000-0000-4000-8000-000000000002')->'extras'->'dispute'->>'decision_id','explicit_confirmation',true,'reason','Reviewed canonical correction and member response'),'ae600000-0000-4000-8000-000000000007')->>'version','3','corrected dispute closes only against the actual newer decision');
select is(jsonb_array_length(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','requests',null,null,'','',100,0,'{"queue":"disputes"}')->'rows'),0,'resolved dispute leaves the open queue');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm_attendance','ae000000-0000-4000-8000-000000000004',1,'{"result":"present","awarded_minutes":120,"explicit_confirmation":true,"reason":"Actual completed second position"}','ae600000-0000-4000-8000-000000000008')->>'version','2','admin confirmation writes canonical attendance and ledger');
select throws_ok($$select api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','correct_attendance_award','ae000000-0000-4000-8000-000000000004',1,'{"result":"partial","awarded_minutes":30,"explicit_confirmation":true,"reason":"Stale execution input"}','ae600000-0000-4000-8000-000000000009')$$,'40001','STALE_VERSION','stale admin correction cannot overwrite execution history');
select is(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reports')->'rows'->0->>'confirmed_minutes','210','admin report reflects ninety corrected and one hundred twenty confirmed minutes');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','follow_vacancy_interest',current_setting('cluvo.admin.interest')::uuid,1,'{"state":"contacted","reason":"Discussed role and guidance"}','ae600000-0000-4000-8000-000000000010')->>'version','2','vacancy contact is a saved step');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','follow_vacancy_interest',current_setting('cluvo.admin.interest')::uuid,2,'{"state":"meeting","reason":"Planned the separate introduction"}','ae600000-0000-4000-8000-000000000011')->>'version','3','meeting is separate from appointment');
select throws_ok($$select api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','follow_vacancy_interest',current_setting('cluvo.admin.interest')::uuid,3,'{"state":"appointed","reason":"Negative fake appointment"}','ae600000-0000-4000-8000-000000000012')$$,'22023','INVALID_INTEREST_TRANSITION','interest followup cannot directly award structural exemption');
select is(jsonb_array_length(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','requests',null,current_setting('cluvo.admin.interest')::uuid)->'extras'->'request_history'),3,'interest and both followup steps remain in native history');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","session_id":"11111111-1111-4111-8111-111111111111"}',true);
select is((select confirmed_minutes::integer from api.my_obligation_status where obligation_id='a6000000-0000-4000-8000-000000000001'),210,'personal app uses the same canonical corrected ledger sum');
reset role;
select is((select count(*)::integer from app.hour_ledger_entries where booking_id='aa300000-0000-4000-8000-000000000002'),3,'initial award, reversal and replacement are preserved exactly once');
select is((select minutes_delta from app.hour_ledger_entries where id='aa500000-0000-4000-8000-000000000001'),60,'original partial award is never overwritten');
select is((select count(*)::integer from app.volunteer_appointments),0,'vacancy contact and meeting create no appointment');
select is((select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001'),720,'interested vacancy exemption is not applied before recognition');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","session_id":"33333333-3333-4333-8333-333333333333"}',true);
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','recognize_vacancy_appointment',current_setting('cluvo.admin.interest')::uuid,3,jsonb_build_object('obligation_id','a6000000-0000-4000-8000-000000000001','expected_obligation_version',3,'starts_on',current_date,'ends_on',null,'explicit_confirmation',true,'reason','Actual separately reviewed structural appointment'),'ae600000-0000-4000-8000-000000000013')->>'version','4','separate authorized recognition uses the canonical appointment and obligation version');
select is(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','requests',null,current_setting('cluvo.admin.interest')::uuid)->'rows'->0->>'state','appointed','appointment is reflected in the original interest');
reset role;
select is((select count(*)::integer from app.appointment_cases where vacancy_interest_id=current_setting('cluvo.admin.interest')::uuid and state='approved'),1,'one actual appointment case links interest and native recognition');
select is((select sum(minutes_delta)::integer from app.hour_ledger_entries where obligation_id='a6000000-0000-4000-8000-000000000001'),210,'structural recognition does not invent worked minutes');
select *from finish();rollback;
