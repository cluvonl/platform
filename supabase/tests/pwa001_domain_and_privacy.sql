begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

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

-- Explicit isolated central capability for these existing domain fixtures;
-- ordinary coordinator/hybrid denial is covered separately in pwa006.
insert into app.permission_roles(tenant_id,role_key,name,system_role) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','pwa_central_distribution_fixture','Local scoped cluster fixture',false);
insert into app.role_permissions(tenant_id,role_id,permission_key) select tenant_id,id,'club_cluster.manage' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='pwa_central_distribution_fixture';
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) select tenant_id,'33333333-3333-4333-8333-333333333333',id,'tenant','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='pwa_central_distribution_fixture';

-- Native sessions are explicit LOCAL SQL fixtures, not real provider evidence.
update auth.users set email_confirmed_at=statement_timestamp() where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,statement_timestamp(),statement_timestamp() from auth.users where email like '%@example.test' on conflict(id) do nothing;
create function pg_temp.actor(p_actor uuid) returns void language plpgsql security definer set search_path='' as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor))::text,true);
end;$$;
insert into app.teams(id,tenant_id,name) values('ca010000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Eigen team'),('ca010000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Besloten ander team');
insert into app.persons(id,tenant_id,given_name,family_name,birth_date,birth_date_precision) values('ca020000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Kind','A','2013-01-01','day');
insert into app.household_person_links(tenant_id,household_id,person_id,kind,verified_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','ca020000-0000-4000-8000-000000000001','member','33333333-3333-4333-8333-333333333333');
update app.household_access_grants set can_book_for=true where auth_user_id='11111111-1111-4111-8111-111111111111';
insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca010000-0000-4000-8000-000000000001','ca020000-0000-4000-8000-000000000001','player');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,team_id,starts_at,granted_by_auth_user_id) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',r.id,'team','ca010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333' from app.permission_roles r where r.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and r.role_key='team_parent';
insert into app.courses(id,tenant_id,title) values('ca030000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Lokale cursus');
insert into app.course_sessions(id,tenant_id,course_id,starts_at,ends_at,capacity) values('ca030000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca030000-0000-4000-8000-000000000001','2027-03-01 10:00+01','2027-03-01 12:00+01',1);
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'authorized complete mobile snapshot executes');
select is((api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'context'->>'person_id'),'a1000000-0000-4000-8000-000000000001','identity comes only from verified actor');
select throws_ok($$select api.pwa_snapshot('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501','FORBIDDEN','foreign tenant snapshot denied');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'finance'),0,'member cannot read financial transactions');
select ok(not api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text like '%email_confirmed_at%','snapshot excludes Auth source data');
select ok(not has_table_privilege('authenticated','app.pwa_push_subscriptions','SELECT'),'push endpoints and secrets not directly readable');
select ok(not has_function_privilege('service_role','api.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)','EXECUTE'),'server key has no human PWA command authority');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_preferences','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"email":true,"push":false,"inbox":true,"actor":"fake"}','ca040000-0000-4000-8000-000000000001')$$,'22023','INVALID_FIELD','actor override and unknown payload fields refused');
create temporary table preference_receipt as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_preferences','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"email":true,"push":false,"inbox":true}','ca040000-0000-4000-8000-000000000002');
select is((select version from preference_receipt),1::bigint,'preferences commit durable version');
select is((select resource_id from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_preferences','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"email":true,"push":false,"inbox":true}','ca040000-0000-4000-8000-000000000002')),(select resource_id from preference_receipt),'unknown response retry returns same receipt');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_preferences','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"email":false,"push":false,"inbox":true}','ca040000-0000-4000-8000-000000000002')$$,'22000','IDEMPOTENCY_CONFLICT','changed payload cannot reuse command key');
select is(api.pwa_command_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca040000-0000-4000-8000-000000000002')->>'status','confirmed','own command status readback confirms commit');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dismiss_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"topic_id":"pwa.home","topic_version":1}','ca040000-0000-4000-8000-000000000003')$$,'versioned explanation persists');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dismiss_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"topic_id":"pwa.random","topic_version":1}','ca040000-0000-4000-8000-000000000004')$$,'22023','UNKNOWN_HELP_TOPIC','unknown help topic rejected');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enroll_course','ca030000-0000-4000-8000-000000000002',1,'{}','ca040000-0000-4000-8000-000000000005')$$,'own course enrollment commits');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select is(api.pwa_command_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca040000-0000-4000-8000-000000000002')->>'status','rejected','other actor cannot see command receipt');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'help_seen'),0,'help preferences separated between parents');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','enroll_course','ca030000-0000-4000-8000-000000000002',1,'{}','ca040000-0000-4000-8000-000000000006')$$,'P0001','CAPACITY_FULL','last occupied course place rejects other account');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
create temporary table instruction_receipt as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Lees deze instructie voor je dienst."}','ca040000-0000-4000-8000-000000000007');
create temporary table cluster_receipt as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reserve_cluster','ca010000-0000-4000-8000-000000000001',1,'{"season_id":"a5000000-0000-4000-8000-000000000001","title":"Teamplaats","mode":"assign","position_ids":["aa210000-0000-4000-8000-000000000004"],"self_until":"2027-01-15 12:00+01","assign_until":"2027-01-20 12:00+01","counts_for_team":true}','ca040000-0000-4000-8000-000000000008');
reset role;
create temporary table allocation as select id from app.pwa_allocations where cluster_id=(select resource_id from cluster_receipt);
grant select on allocation,instruction_receipt,cluster_receipt to authenticated;
set local role authenticated;
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','assign_member',(select id from allocation),1,'{"member_person_id":"ca020000-0000-4000-8000-000000000001"}','ca040000-0000-4000-8000-000000000009')$$,'team parent assigns actual child without booking executor');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','set_team_goal','ca010000-0000-4000-8000-000000000001',0,'{"season_id":"a5000000-0000-4000-8000-000000000001","goal":0}','ca040000-0000-4000-8000-00000000000a')$$,'team goal zero is valid and durable');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from api.list_shift_market('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where position_id='aa210000-0000-4000-8000-000000000004'),0,'reserved concrete place disappears from public market');
select throws_ok($$select * from api.book_shift('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa200000-0000-4000-8000-000000000003','aa210000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001',2,'ca040000-0000-4000-8000-00000000000b')$$,'42501','TEAM_POSITION_RESERVED','legacy public booking cannot bypass reservation');
create temporary table team_booking as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','aa210000-0000-4000-8000-000000000004',2,jsonb_build_object('shift_id','aa200000-0000-4000-8000-000000000003','executor_person_id','a1000000-0000-4000-8000-000000000001','obligation_id','a6000000-0000-4000-8000-000000000001','instruction_version_id',(select resource_id from instruction_receipt),'instructions_ack',true,'cancellation_ack',true,'extra_voluntary_ack',true),'ca040000-0000-4000-8000-00000000000c');
select is((select result->>'state' from team_booking),'booked','authorized household chooses executor and books reserved place');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','prepare_booking',(select resource_id from team_booking),1,'{"prepared":true}','ca040000-0000-4000-8000-00000000000d')$$,'preparation is durable and does not confirm execution');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ask_question','a3000000-0000-4000-8000-000000000001',1,'{"subject":"Praktische vraag","body":"Hoe bereid ik deze taak voor?"}','ca040000-0000-4000-8000-00000000000e')$$,'practical household question is separate from formal exception');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'questions'),0,'other parent cannot read private practical question');
reset role;
select is((select count(*) from app.pwa_team_execution_entries),0::bigint,'planning/preparation creates no team execution credit');
select is((select count(*) from app.hour_ledger_entries),1::bigint,'planning/preparation creates no confirmed household minutes');
select is((select count(*) from app.pwa_booking_authorizations),0::bigint,'transaction reservation authorization never persists');
select throws_ok($$insert into app.bookings(tenant_id,position_id,executor_person_id,obligation_id,state,booked_by_auth_user_id,starts_at_snapshot,ends_at_snapshot,credit_minutes_snapshot,cancellation_deadline_snapshot,task_version_snapshot,idempotency_key) select tenant_id,position_id,'a1000000-0000-4000-8000-000000000001',obligation_id,'booked',booked_by_auth_user_id,starts_at_snapshot,ends_at_snapshot,credit_minutes_snapshot,cancellation_deadline_snapshot,task_version_snapshot,'ca040000-0000-4000-8000-00000000000f' from app.bookings where id='aa300000-0000-4000-8000-000000000002'$$,'P0001','CAPACITY_FULL','terminal confirmed place cannot be rebooked');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind='r' and c.relname like 'pwa_%' and not(c.relrowsecurity and c.relforcerowsecurity)),0::bigint,'all new PWA relations force RLS');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
delete from auth.sessions where id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select throws_ok($$select api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501','FORBIDDEN','revoked native session cannot read PWA snapshot');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','ca040000-0000-4000-8000-000000000010')$$,'42501','FORBIDDEN','revoked native session cannot mutate PWA');
select * from finish();
rollback;
