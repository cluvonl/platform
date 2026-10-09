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
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
create temporary table instructions as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Bevroren instructie voor uitvoering"}','ca090000-0000-4000-8000-000000000001');
create temporary table cluster as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reserve_cluster','ca010000-0000-4000-8000-000000000001',1,'{"season_id":"a5000000-0000-4000-8000-000000000001","title":"Historische teaminzet","mode":"assign","position_ids":["aa210000-0000-4000-8000-000000000004"],"self_until":"2027-01-15T12:00:00+01:00","assign_until":"2027-01-20T12:00:00+01:00","counts_for_team":true}','ca090000-0000-4000-8000-000000000002');
reset role;
create temporary table allocation as select id from app.pwa_allocations where cluster_id=(select resource_id from cluster);
grant select on allocation to authenticated;
set local role authenticated;
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','assign_member',(select id from allocation),1,'{"member_person_id":"ca020000-0000-4000-8000-000000000001"}','ca090000-0000-4000-8000-000000000003')$$,'concrete member assignment');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
create temporary table booking as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','aa210000-0000-4000-8000-000000000004',2,jsonb_build_object('shift_id','aa200000-0000-4000-8000-000000000003','executor_person_id','a1000000-0000-4000-8000-000000000001','obligation_id','a6000000-0000-4000-8000-000000000001','instruction_version_id',(select resource_id from instructions),'instructions_ack',true,'cancellation_ack',true),'ca090000-0000-4000-8000-000000000004');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cancel_booking',(select resource_id from booking),1,'{"reason_kind":"regular","description":"Plaats gewoon verwijderen"}','ca090000-0000-4000-8000-000000000005')$$,'55000','TEAM_REPLACEMENT_REQUIRED','regular cancellation cannot silently remove team occupancy');
reset role;
-- Move only this disposable test fixture into the past. No runtime command
-- is permitted to rewrite the historical booking times this way.
update app.bookings set starts_at_snapshot=statement_timestamp()-interval '2 hours',ends_at_snapshot=statement_timestamp()-interval '1 hour' where id=(select resource_id from booking);
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm_attendance',(select resource_id from booking),1,'{"result":"present","awarded_minutes":120,"reason":""}','ca090000-0000-4000-8000-000000000006')$$,'actual canonical confirmation succeeds');
reset role;
select is((select sum(count_delta) from app.pwa_team_execution_entries),1::bigint,'exactly one confirmed team execution');
select is((select sum(minutes_delta) from app.hour_ledger_entries where obligation_id='a6000000-0000-4000-8000-000000000001'),180::bigint,'team count and household minute ledger remain independent');
set local role authenticated;
select lives_ok($$select * from api.correct_attendance_award('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from booking),2,'no_show',0,'Administratieve correctie','ca090000-0000-4000-8000-000000000007')$$,'native correction appends decisions and ledger correction');
reset role;
select is((select sum(count_delta) from app.pwa_team_execution_entries),0::bigint,'corrected no-show removes count through causal negative entry');
select is((select count(*) from app.pwa_team_execution_entries),2::bigint,'original team tally retained');
select is((select sum(minutes_delta) from app.hour_ledger_entries where obligation_id='a6000000-0000-4000-8000-000000000001'),60::bigint,'ledger reversal leaves original unrelated confirmed minutes');
select throws_ok($$update app.pwa_team_execution_entries set count_delta=0$$,'55000',null,'team tally cannot be overwritten');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((api.pwa_ledger_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa500000-0000-4000-8000-000000000001')->>'minutes_delta')::integer,60,'authorized canonical evidence contains actual posted record');
select throws_ok($$select api.pwa_ledger_entry('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aa500000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','cross-tenant ledger evidence refused');
select ok(not api.pwa_ledger_entry('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aa500000-0000-4000-8000-000000000001') ? 'actor_auth_user_id','evidence omits Auth identities');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
create temporary table channel as select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_channel','a2000000-0000-4000-8000-000000000001',1,'{"scope":"committee","title":"Cursorproef"}','ca090000-0000-4000-8000-000000000008');
reset role;
insert into app.pwa_messages(tenant_id,channel_id,person_id,body,created_at) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from channel),'a1000000-0000-4000-8000-000000000003','Synthetisch cursorbericht '||n,statement_timestamp()-make_interval(secs=>n) from generate_series(1,55)n;
set local role authenticated;
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'messages'),50,'snapshot bounds each authorized conversation');
create temporary table first_page as select api.pwa_message_page('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from channel)) value;
select is(jsonb_array_length((select value->'items' from first_page)),50,'native cursor page has fixed maximum');
select is(jsonb_array_length(api.pwa_message_page('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from channel),(select (value->'cursor'->>'at')::timestamptz from first_page),(select (value->'cursor'->>'id')::uuid from first_page))->'items'),5,'keyset continuation has remaining distinct rows');
select throws_ok($$select api.pwa_message_page('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from channel),null,null,null)$$,'22023','INVALID_CURSOR','null limit cannot unbound cursor');
select throws_ok($$select api.pwa_message_page('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from channel),null,null,51)$$,'22023','INVALID_CURSOR','oversized cursor limit refused');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select throws_ok($$select api.pwa_message_page('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select resource_id from channel))$$,'42501','FORBIDDEN','different parent cannot use authorized cursor identity');
reset role;
-- Trusted worker proof uses only synthetic notification/email records.
set local cluvo.delivery_source='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
set local cluvo.delivery_run='1';
set local cluvo.delivery_actor='local-fixture';
create temporary table claimed as select internal.pwa_claim_deliveries('ca090000-0000-4000-8000-000000000010',100) value;
select ok(jsonb_array_length((select value from claimed))>0,'private worker leases concrete delivery targets');
create temporary table target as select (item->>'id')::uuid id,(item->>'version')::bigint version from claimed cross join jsonb_array_elements(claimed.value) item limit 1;
select lives_ok($$select internal.pwa_finish_delivery((select id from target),'ca090000-0000-4000-8000-000000000010',(select version from target),'sent',202)$$,'provider acceptance is recorded against exact worker lease');
select throws_ok($$select internal.pwa_finish_delivery((select id from target),'ca090000-0000-4000-8000-000000000010',(select version from target),'sent',202)$$,'40001','STALE_DELIVERY_LEASE','completed delivery cannot double-record same lease');
update app.pwa_delivery_targets set lease_until=statement_timestamp()-interval '1 minute' where state='leased';
create temporary table expired_claim as select internal.pwa_claim_deliveries('ca090000-0000-4000-8000-000000000011',100) value;
select is(jsonb_array_length((select value from expired_claim)),0,'expired external-send lease is never automatically replayed');
select ok(exists(select 1 from app.pwa_delivery_targets where state='unknown'),'expired outcome stays explicitly unknown');
select throws_ok($$update app.pwa_delivery_attempt_log set state='sent'$$,'55000',null,'provider attempt history is append-only');
select ok(not has_function_privilege('authenticated','internal.pwa_claim_deliveries(uuid,integer)','EXECUTE'),'human JWT cannot impersonate provider worker');
select * from finish();
rollback;
