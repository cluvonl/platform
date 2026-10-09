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


-- The canonical tenant trigger seeds task.offer before any publication.
-- Every identity/resource here is a LOCAL, rollback-only example.test fixture.
insert into app.qualification_types(id,tenant_id,name) values('dd000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Bevoegde begeleider');
insert into app.person_qualifications(tenant_id,person_id,qualification_type_id,achieved_at,expires_at,verified_by_auth_user_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000002','dd000000-0000-4000-8000-000000000001','2026-01-01','2027-06-30','33333333-3333-4333-8333-333333333333'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000003','dd000000-0000-4000-8000-000000000001','2026-01-01','2027-06-30','33333333-3333-4333-8333-333333333333');
insert into app.executor_obligation_grants(tenant_id,person_id,obligation_id,valid_from,approved_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000003','a6000000-0000-4000-8000-000000000001','2026-01-01','33333333-3333-4333-8333-333333333333');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',id,'tenant','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='member';
insert into app.shifts(id,tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at) values
 ('dd100000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Begeleide toekomstige dienst','2027-03-05 10:00+01','2027-03-05 12:00+01',120,2880,'published',statement_timestamp()),
 ('dd100000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Andere begeleide dienst','2027-03-06 10:00+01','2027-03-06 12:00+01',120,2880,'published',statement_timestamp()),
 ('dd100000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Zestienplus uitvoering','2027-03-07 10:00+01','2027-03-07 12:00+01',120,2880,'published',statement_timestamp());
insert into app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at) select ('dd200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,s.tenant_id,s.id,n,s.starts_at,s.ends_at from app.shifts s cross join generate_series(1,4)n where s.id='dd100000-0000-4000-8000-000000000001';
insert into app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at) select ('dd210000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,s.tenant_id,s.id,n,s.starts_at,s.ends_at from app.shifts s cross join generate_series(1,3)n where s.id='dd100000-0000-4000-8000-000000000002';
insert into app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at) select 'dd220000-0000-4000-8000-000000000001',tenant_id,id,1,starts_at,ends_at from app.shifts where id='dd100000-0000-4000-8000-000000000003';
insert into app.shift_requirements(tenant_id,shift_id,qualification_type_id,min_qualified_count,buddy_allowed) select tenant_id,id,'dd000000-0000-4000-8000-000000000001',1,true from app.shifts where id in('dd100000-0000-4000-8000-000000000001','dd100000-0000-4000-8000-000000000002');
insert into app.pwa_instruction_versions(id,tenant_id,shift_id,revision,body,author_auth_user_id) select ('dd300000-0000-4000-8000-'||right(id::text,12))::uuid,tenant_id,id,1,'Lees de lokale uitvoering met een bevoegde begeleider.','33333333-3333-4333-8333-333333333333' from app.shifts where id in('dd100000-0000-4000-8000-000000000001','dd100000-0000-4000-8000-000000000002','dd100000-0000-4000-8000-000000000003');
insert into app.teams(id,tenant_id,name) values('dd400000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Ontvangend team zonder teamoudermachtiging');
insert into app.households(id,tenant_id,label,intake_code_hash) values('dd500000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Eigen extra uitnodigingsdossier',extensions.digest('local-only-code','sha256'));
insert into app.household_person_links(tenant_id,household_id,person_id,kind,verified_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd500000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','executor','33333333-3333-4333-8333-333333333333');
insert into app.household_access_grants(tenant_id,household_id,auth_user_id,can_view_progress,granted_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd500000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',true,'33333333-3333-4333-8333-333333333333');
create function pg_temp.payload(p_shift uuid,p_buddy uuid default null,p_version bigint default null,p_person uuid default 'a1000000-0000-4000-8000-000000000001') returns jsonb language sql security definer set search_path='' as $$select jsonb_build_object('shift_id',p_shift,'executor_person_id',p_person,'obligation_id','a6000000-0000-4000-8000-000000000001','instruction_version_id',(select id from app.pwa_instruction_versions where shift_id=p_shift order by revision desc limit 1),'instructions_ack',true,'cancellation_ack',true)||case when p_buddy is not null then jsonb_build_object('buddy_booking_id',p_buddy,'buddy_expected_version',p_version) else '{}'::jsonb end;$$;
create table pg_temp.receipts(label text primary key,id uuid,version bigint,result jsonb);
grant all on pg_temp.receipts to authenticated;
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select throws_ok($$select api.book_shift('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd100000-0000-4000-8000-000000000001','dd200000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001',1,'dd900000-0000-4000-8000-000000000001')$$,'42501','QUALIFICATION_EXPIRED','unqualified native booking cannot forge a mentor waiver');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd200000-0000-4000-8000-000000000002',1,pg_temp.payload('dd100000-0000-4000-8000-000000000001'),'dd900000-0000-4000-8000-000000000002')$$,'42501','QUALIFICATION_EXPIRED','unqualified PWA booking needs an explicit booked qualified mentor');
select throws_ok($$select * from app.pwa_buddy_authorizations$$,'42501',null,'a human cannot read private transactional mentor proofs');
select throws_ok($$select internal.pwa_authorize_buddy('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd100000-0000-4000-8000-000000000001','dd200000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001',null,null,gen_random_uuid())$$,'42501',null,'private proof issuance cannot be invoked by the browser');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
insert into pg_temp.receipts select 'mentor',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd200000-0000-4000-8000-000000000001',1,pg_temp.payload('dd100000-0000-4000-8000-000000000001',null,null,'a1000000-0000-4000-8000-000000000002'),'dd900000-0000-4000-8000-000000000003');
insert into pg_temp.receipts select 'other-mentor',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd210000-0000-4000-8000-000000000001',1,pg_temp.payload('dd100000-0000-4000-8000-000000000002',null,null,'a1000000-0000-4000-8000-000000000002'),'dd900000-0000-4000-8000-000000000004');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'buddies') b where b->>'booking_id'=(select id::text from pg_temp.receipts where label='mentor') and b->>'version'='1'),'readmodel offers only a real qualified versioned booked mentor');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd200000-0000-4000-8000-000000000002',1,pg_temp.payload('dd100000-0000-4000-8000-000000000001',(select id from pg_temp.receipts where label='mentor'),99),'dd900000-0000-4000-8000-000000000005')$$,'42501','INVALID_BUDDY','stale mentor version is rejected');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd200000-0000-4000-8000-000000000002',1,pg_temp.payload('dd100000-0000-4000-8000-000000000001',(select id from pg_temp.receipts where label='other-mentor'),1),'dd900000-0000-4000-8000-000000000006')$$,'42501','INVALID_BUDDY','mentor from another shift is rejected');
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'suitability') x where x->>'position_id'='dd200000-0000-4000-8000-000000000002' and (x->>'eligible_with_buddy')::boolean),'all remaining hard eligibility conditions permit explicit mentor choice');
reset role;
insert into app.unavailability_periods(tenant_id,person_id,starts_at,ends_at,private_note) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','2027-03-05 09:00+01','2027-03-05 13:00+01','Lokale verhindering');
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'suitability') x where x->>'position_id'='dd200000-0000-4000-8000-000000000002' and x->>'reason'='EXECUTOR_UNAVAILABLE' and not(x->>'eligible_with_buddy')::boolean),'mentor availability never masks an unavailable executor');
reset role;
delete from app.unavailability_periods where person_id='a1000000-0000-4000-8000-000000000001' and starts_at='2027-03-05 09:00+01';
update app.person_qualifications set revoked_at=statement_timestamp() where person_id='a1000000-0000-4000-8000-000000000002' and qualification_type_id='dd000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd200000-0000-4000-8000-000000000002',1,pg_temp.payload('dd100000-0000-4000-8000-000000000001',(select id from pg_temp.receipts where label='mentor'),1),'dd900000-0000-4000-8000-000000000007')$$,'42501','INVALID_BUDDY','revoked mentor qualification cannot authorize a novice');
reset role;
update app.person_qualifications set revoked_at=null where person_id='a1000000-0000-4000-8000-000000000002' and qualification_type_id='dd000000-0000-4000-8000-000000000001';
set local role authenticated;

select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','join_waitlist','dd100000-0000-4000-8000-000000000001',1,jsonb_build_object('executor_person_id','a1000000-0000-4000-8000-000000000001','obligation_id','a6000000-0000-4000-8000-000000000001','buddy_booking_id',(select id from pg_temp.receipts where label='mentor'),'buddy_expected_version',1),'dd900000-0000-4000-8000-000000000018')$$,'explicit live mentor permits only a waitlist interest for an otherwise suitable beginner');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'suitability') x where x->>'position_id'='dd200000-0000-4000-8000-000000000001' and x->>'person_id'='a1000000-0000-4000-8000-000000000003' and (x->>'executor_eligible')::boolean and (x->>'capacity_full')::boolean),'occupied capacity does not mask an otherwise suitable qualified transfer executor');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
insert into pg_temp.receipts select 'novice',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd200000-0000-4000-8000-000000000002',1,pg_temp.payload('dd100000-0000-4000-8000-000000000001',(select id from pg_temp.receipts where label='mentor'),1),'dd900000-0000-4000-8000-000000000008');
select lives_ok($$set constraints app.pwa_buddy_coverage immediate$$,'the real novice booking satisfies durable mentor coverage at transaction end');
set constraints app.pwa_buddy_coverage deferred;
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select throws_ok($$select api.cancel_booking('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from pg_temp.receipts where label='mentor'),1,'regular',null,'dd900000-0000-4000-8000-000000000009')$$,'42501','BUDDY_REPLACEMENT_REQUIRED','the named mentor cannot cancel and leave an active novice unsupported');
insert into pg_temp.receipts select 'offer',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','open_transfer',(select id from pg_temp.receipts where label='mentor'),1,jsonb_build_object('reason','Lokale vervanging'),'dd900000-0000-4000-8000-000000000010');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into pg_temp.receipts select 'replacement',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_transfer',(select id from pg_temp.receipts where label='offer'),1,pg_temp.payload('dd100000-0000-4000-8000-000000000001',null,null,'a1000000-0000-4000-8000-000000000003')-'shift_id','dd900000-0000-4000-8000-000000000011');
reset role;
select is((select count(*)::integer from app.pwa_buddy_links where booking_id=(select id from pg_temp.receipts where label='novice')),2,'qualified takeover appends a current mentor link and preserves the original choice');
select is((select buddy_booking_id from app.pwa_buddy_links where booking_id=(select id from pg_temp.receipts where label='novice') order by revision desc limit 1),(select id from pg_temp.receipts where label='replacement'),'replacement is a genuinely qualified booking of the same physical place');
select is((select count(*)::integer from app.pwa_buddy_authorizations),0,'session and transaction bound proofs are consumed before commit');
select is((select count(*)::integer from app.hour_ledger_entries where booking_id in(select id from pg_temp.receipts)),0,'booking, mentor choice and takeover create no fictitious execution credit');
select throws_ok($$update app.pwa_buddy_links set reason='chosen' where revision=2$$,'55000',null,'mentor substitution history is immutable');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
insert into pg_temp.receipts select 'profile',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_profile','dd500000-0000-4000-8000-000000000001',1,'{}','dd900000-0000-4000-8000-000000000012');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_profile','dd500000-0000-4000-8000-000000000001',1,'{}','dd900000-0000-4000-8000-000000000012')$$,'own intake start replays the same acknowledged command');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_profile','dd500000-0000-4000-8000-000000000001',0,'{}','dd900000-0000-4000-8000-000000000013')$$,'40001','STALE_VERSION','intake start checks the selected household version');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_profile','dd500000-0000-4000-8000-000000000001',1,'{}','dd900000-0000-4000-8000-000000000014')$$,'42501','FORBIDDEN','another parent cannot initialize the private new household intake');
reset role;
select is((select person_id from app.intake_profiles where id=(select id from pg_temp.receipts where label='profile')),'a1000000-0000-4000-8000-000000000001'::uuid,'initialized profile belongs only to the verified current person');
select is((select current_revision from app.intake_profiles where id=(select id from pg_temp.receipts where label='profile')),0,'draft initialization invents no personal answers');
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'market') x where x->>'shift_id'='dd100000-0000-4000-8000-000000000003' and (x->>'can_manage')::boolean),'future planning uses actual shift.manage action authority');
insert into pg_temp.receipts select 'reserved-create',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,jsonb_build_object('season_id','a5000000-0000-4000-8000-000000000001','title','Atomair ontvangen clubtaak','starts_at','2027-04-05 10:00+02','ends_at','2027-04-05 12:00+02','task_type_version_id','a9000000-0000-4000-8000-000000000001','capacity',3,'repeat_count',1,'instructions','Werkelijke clubtaak voor het ontvangende team','distribution_mode','self','receiving_team_id','dd400000-0000-4000-8000-000000000001','receiving_team_expected_version',1,'self_until','2027-03-01 10:00+01','assign_until','2027-03-15 10:00+01','counts_for_team',true),'dd900000-0000-4000-8000-000000000015');
reset role;
select is((select count(*)::integer from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id where p.shift_id=(select id from pg_temp.receipts where label='reserved-create')),3,'all newly published positions are reserved in the same atomic club command');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select ok(not exists(select 1 from api.list_shift_market('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') m where m.shift_id=(select id from pg_temp.receipts where label='reserved-create')),'reserved creation creates no public booking window');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_club_contact','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,jsonb_build_object('name','Beheer','email','contact@example.test','phone',null),'dd900000-0000-4000-8000-000000000016')$$,'42501','FORBIDDEN','ordinary member cannot configure a published club contact');
reset role;
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',id,'tenant','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='board';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_club_contact','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,jsonb_build_object('name','Werkelijk ingestelde clubcontactpersoon','email','contact@example.test','phone',null),'dd900000-0000-4000-8000-000000000017')$$,'organization.manage can configure the actual club contact');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'club_contact'->>'email','contact@example.test','authorized mobile contact readback shows the actual versioned configured address');
reset role;
select ok(exists(select 1 from app.pwa_notifications n join app.domain_events e on e.tenant_id=n.tenant_id and e.id=n.event_id where n.recipient_person_id='a1000000-0000-4000-8000-000000000001' and e.event_type='pwa.buddy_replaced' and n.essential and n.deliver_inbox),'mentor substitution is important durable information for the actual novice');

-- Own provider binding status contains only a boolean; device secrets remain private.
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(api.pwa_push_binding_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','https://fcm.googleapis.com/local-buddy-device'),'{"registered":false}'::jsonb,'OS permission alone does not establish a server push binding');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_push_subscription','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,jsonb_build_object('endpoint','https://fcm.googleapis.com/local-buddy-device','p256dh',repeat('a',87),'auth_secret',repeat('b',22)),'dd900000-0000-4000-8000-000000000019')$$,'synthetic device binds via the actual own command');
select is(api.pwa_push_binding_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','https://fcm.googleapis.com/local-buddy-device'),'{"registered":true}'::jsonb,'own existing subscription has a database-confirmed binding');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select is(api.pwa_push_binding_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','https://fcm.googleapis.com/local-buddy-device'),'{"registered":false}'::jsonb,'another account cannot inherit an existing device binding');
select throws_ok($$select api.pwa_push_binding_status('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','https://fcm.googleapis.com/local-buddy-device')$$,'42501','FORBIDDEN','binding status reauthorizes the actual tenant');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select throws_ok($$select api.pwa_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','book_shift','dd200000-0000-4000-8000-000000000003',1,jsonb_build_object('shift_id','dd100000-0000-4000-8000-000000000001','executor_person_id','b1000000-0000-4000-8000-000000000001','obligation_id','b6000000-0000-4000-8000-000000000001','instruction_version_id','dd300000-0000-4000-8000-000000000001','instructions_ack',true,'cancellation_ack',true,'buddy_booking_id',(select id from pg_temp.receipts where label='replacement'),'buddy_expected_version',1),'dd900000-0000-4000-8000-000000000020')$$,'P0002',null,'cross-club mentor or physical-place identifiers never authorize a booking');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_profile',(select id from pg_temp.receipts where label='profile'),1,'{"experience":"Eigen nieuwe intake","preferences":[],"talents":[],"availability":[],"monthly_minutes":60,"boundaries":"","reserve":false,"buddy":true}','dd900000-0000-4000-8000-000000000021')$$,'initialized own profile can append a real private intake revision');
reset role;
insert into app.persons(id,tenant_id,given_name,family_name,birth_date,birth_date_precision) values('dd600000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Lokaal','Onder zestien','2013-01-01','day');
insert into app.household_person_links(tenant_id,household_id,person_id,kind,verified_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a3000000-0000-4000-8000-000000000001','dd600000-0000-4000-8000-000000000001','member','33333333-3333-4333-8333-333333333333');
update app.household_access_grants set can_book_for=true where auth_user_id='11111111-1111-4111-8111-111111111111';
insert into app.executor_obligation_grants(tenant_id,person_id,obligation_id,valid_from,approved_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd600000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','2026-01-01','33333333-3333-4333-8333-333333333333');
insert into app.acting_delegations(tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,evidence_ref,starts_at,granted_by_auth_user_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','dd600000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','book_shift','Lokale leeftijdsnegatiefproef','2026-01-01','33333333-3333-4333-8333-333333333333'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','book_shift','Lokale geautoriseerde representatie','2026-01-01','33333333-3333-4333-8333-333333333333');
set local role authenticated;
select throws_ok($$select api.book_shift('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd100000-0000-4000-8000-000000000003','dd220000-0000-4000-8000-000000000001','dd600000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001',1,'dd900000-0000-4000-8000-000000000022')$$,'42501','MINIMUM_EXECUTION_AGE','even an explicit household mandate cannot bypass the canonical sixteen-plus execution floor');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_preferences','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"email":false,"push":false,"inbox":false,"reminders":false,"team":false,"news":false}','dd900000-0000-4000-8000-000000000023')$$,'optional channel/category preferences can be disabled by their actual owner');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
insert into pg_temp.receipts select 'delegated',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','book_shift','dd220000-0000-4000-8000-000000000001',1,pg_temp.payload('dd100000-0000-4000-8000-000000000003',null,null,'a1000000-0000-4000-8000-000000000002'),'dd900000-0000-4000-8000-000000000024');
reset role;
select ok(exists(select 1 from app.pwa_notifications n join app.domain_events e on e.tenant_id=n.tenant_id and e.id=n.event_id where n.recipient_person_id='a1000000-0000-4000-8000-000000000002' and e.aggregate_id=(select id from pg_temp.receipts where label='delegated') and e.event_type='pwa.book_shift' and n.essential and n.deliver_inbox),'book-for informs the actual executor through a durable essential inbox despite optional preferences');
select is((select count(*)::integer from app.pwa_delivery_outbox o join app.pwa_notifications n on n.tenant_id=o.tenant_id and n.id=o.notification_id join app.domain_events e on e.tenant_id=n.tenant_id and e.id=n.event_id where o.recipient_person_id='a1000000-0000-4000-8000-000000000002' and e.aggregate_id=(select id from pg_temp.receipts where label='delegated')),0,'essential inbox does not override disabled email or push consent');
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into pg_temp.receipts select 'illness',resource_id,version,result from api.cancel_booking('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from pg_temp.receipts where label='replacement'),1,'sickness','Lokale ziekmeldproef','dd900000-0000-4000-8000-000000000025');
select is((select result->>'state' from pg_temp.receipts where label='illness'),'transfer_pending','illness remains reportable while an actual qualified replacement is required');
reset role;
select is((select state from app.bookings where id=(select id from pg_temp.receipts where label='replacement')),'transfer_pending','reported mentor obstruction does not silently free the physical place');
select is((select count(*)::integer from app.hour_ledger_entries where booking_id=(select id from pg_temp.receipts where label='replacement')),0,'a sickness report creates no execution credit');
select lives_ok($$set constraints all immediate$$,'all mentor and qualification constraints hold for the final actual transaction state');

set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"season_id":"a5000000-0000-4000-8000-000000000001","title":"Expliciet gekozen herfsttijd","starts_at":"2026-10-25T02:30:00+02:00","ends_at":"2026-10-25T03:30:00+01:00","task_type_version_id":"a9000000-0000-4000-8000-000000000001","capacity":1,"repeat_count":1,"instructions":"Expliciet gekozen startmoment"}','dd900000-0000-4000-8000-000000000026')$$,'an explicit offset-selected base instant remains valid during the autumn fold');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"season_id":"a5000000-0000-4000-8000-000000000001","title":"Ambigue latere herhaling","starts_at":"2026-10-18T02:30:00+02:00","ends_at":"2026-10-18T03:30:00+02:00","task_type_version_id":"a9000000-0000-4000-8000-000000000001","capacity":1,"repeat_count":4,"instructions":"Alle weken moeten exact zijn"}','dd900000-0000-4000-8000-000000000027')$$,'22023','DST_AMBIGUOUS_OR_MISSING_TIME','an inferred later fold rejects the complete series without guessing an offset');
reset role;
select is((select count(*)::integer from app.shifts where title='Ambigue latere herhaling'),0,'ambiguous recurrence rolls back every preceding creation in its transaction');

insert into app.volunteer_role_catalog(id,tenant_id,name) values('dd800000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Lokale vacatureproefrol');
insert into app.volunteer_role_versions(id,tenant_id,role_id,revision,effective_from,approved_by_auth_user_id) values('dd810000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd800000-0000-4000-8000-000000000001',1,'2026-07-01','33333333-3333-4333-8333-333333333333');
insert into app.vacancies(id,tenant_id,role_version_id,committee_id,title,description,expected_minutes,contact_person_id,state) values
 ('dd820000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd810000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Werkelijke gepubliceerde vacature','Interesse verandert geen aanstelling',120,'a1000000-0000-4000-8000-000000000003','published'),
 ('dd820000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dd810000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','Besloten conceptvacature','Alleen beheer ziet dit concept',120,'a1000000-0000-4000-8000-000000000003','draft');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','express_interest','dd820000-0000-4000-8000-000000000001',1,'{"motivation":"Eigen lokale interesse"}','dd900000-0000-4000-8000-000000000028')$$,'the actual PWA interest wrapper locks and writes a published vacancy with correct private role privileges');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','express_interest','dd820000-0000-4000-8000-000000000002',1,'{"motivation":"Geen private concepttoegang"}','dd900000-0000-4000-8000-000000000029')$$,'42501','VACANCY_NOT_AVAILABLE','unpublished vacancy denies interest before disclosing its private version');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','express_interest','dd820000-0000-4000-8000-000000000001',99,'{"motivation":"Versiecontrole"}','dd900000-0000-4000-8000-000000000030')$$,'40001','STALE_VERSION','published interest checks the expected vacancy version');
select throws_ok($$update app.vacancies set version=99 where id='dd820000-0000-4000-8000-000000000001'$$,'42501',null,'the browser receives no direct vacancy-write grant');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select throws_ok($$select api.pwa_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','express_interest','dd820000-0000-4000-8000-000000000001',1,'{"motivation":"Geen ander clubrecord"}','dd900000-0000-4000-8000-000000000031')$$,'42501','VACANCY_NOT_AVAILABLE','a foreign-club resource identifier does not authorize an interest or private version read');
reset role;
select is((select count(*)::integer from app.vacancy_interests where vacancy_id='dd820000-0000-4000-8000-000000000001'),1,'exactly one actual interest record is committed inside the test transaction');
select is((select count(*)::integer from app.volunteer_appointments where person_id='a1000000-0000-4000-8000-000000000001'),0,'interest alone grants no appointment, role or household exemption');
select * from finish();
rollback;
