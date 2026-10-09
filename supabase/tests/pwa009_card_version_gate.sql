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

-- Native unit sessions remain in this rollback-only synthetic fixture.
update auth.users set email_confirmed_at=statement_timestamp();
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,statement_timestamp(),statement_timestamp() from auth.users;
create function pg_temp.actor(p_actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor))::text,true);
end;$$;

-- A narrow reader role permits assignment but grants no workspace management.
insert into app.permission_roles(id,tenant_id,role_key,name,system_role) values
 ('e9120000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','card_viewer_fixture','Card viewer fixture',false);
insert into app.role_permissions(tenant_id,role_id,permission_key) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9120000-0000-4000-8000-000000000001','committee.workspace.view');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,committee_id,starts_at,granted_by_auth_user_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','e9120000-0000-4000-8000-000000000001','committee','a2000000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333');

insert into app.committees(id,tenant_id,slug,name) values
 ('e9100000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other-committee','Other committee');
insert into app.kanban_boards(id,tenant_id,committee_id,name) values
 ('e9100000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','Owned board'),
 ('e9100000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9100000-0000-4000-8000-000000000001','Other committee board'),
 ('e9100000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b2000000-0000-4000-8000-000000000001','Other club board');
insert into app.kanban_columns(id,tenant_id,board_id,title,position,terminal) values
 ('e9100000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9100000-0000-4000-8000-000000000002','Todo',0,false),
 ('e9100000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9100000-0000-4000-8000-000000000002','Doing',1,false),
 ('e9100000-0000-4000-8000-000000000007','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9100000-0000-4000-8000-000000000002','Done',2,true),
 ('e9100000-0000-4000-8000-000000000008','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9100000-0000-4000-8000-000000000003','Todo',0,false),
 ('e9100000-0000-4000-8000-000000000009','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','e9100000-0000-4000-8000-000000000004','Todo',0,false);
insert into app.kanban_cards(id,tenant_id,board_id,column_id,title,created_by_auth_user_id) values
 ('e9100000-0000-4000-8000-00000000000a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e9100000-0000-4000-8000-000000000003','e9100000-0000-4000-8000-000000000008','Other committee private','33333333-3333-4333-8333-333333333333'),
 ('e9100000-0000-4000-8000-00000000000b','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','e9100000-0000-4000-8000-000000000004','e9100000-0000-4000-8000-000000000009','Other club private','44444444-4444-4444-8444-444444444444');
create temporary table receipts(label text primary key,id uuid,version bigint,event_ids uuid[]);
grant all on receipts to authenticated;
create temporary table original_ledger as select count(*) total from app.hour_ledger_entries;

set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into receipts select 'card',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_card','e9100000-0000-4000-8000-000000000002',1,
 '{"title":"Prepared commission card","description":"Private scoped card","column_id":"e9100000-0000-4000-8000-000000000005","due_at":"2027-03-22T10:00:00+01:00","assignee_person_ids":["a1000000-0000-4000-8000-000000000001"]}','e9110000-0000-4000-8000-000000000001');
reset role;
insert into app.card_checklist_items(id,tenant_id,card_id,label,position) values('e9100000-0000-4000-8000-00000000000c','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from receipts where label='card'),'Prepare supplies',0);

-- PWA_110_ASSERTIONS: the exact same fixture reproduces the old failure before upgrade.
select ok((select prosecdef and proowner='cluvo_command_owner'::regrole and provolatile='v' and proconfig @> array['search_path=""'] from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure),'dispatcher retains definer owner, volatility and empty path');
select ok(not exists(select 1 from pg_proc where oid='api.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure and prosecdef),'public dispatcher remains security invoker');
select ok(not has_function_privilege('anon','internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)','EXECUTE'),'anonymous role has no internal command authority');
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into receipts select 'manager_reply',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),1,'{"body":"Manager private reply"}','e9110000-0000-4000-8000-000000000002');
select ok((select id is not null from receipts where label='manager_reply'),'manager reply reaches actual dispatcher without unassigned record error');
insert into receipts select 'update',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update_card',(select id from receipts where label='card'),1,
 '{"column_id":"e9100000-0000-4000-8000-000000000006","status":"open","due_at":"2027-03-23T10:00:00+01:00"}','e9110000-0000-4000-8000-000000000003');
select is((select version from receipts where label='update'),2::bigint,'card update returns actual new version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update_card',(select id from receipts where label='card'),1,'{"column_id":"e9100000-0000-4000-8000-000000000005","status":"open"}','e9110000-0000-4000-8000-000000000004')$$,'40001','STALE_VERSION','stale card version is rejected');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),1,'{"body":"Stale private reply"}','e9110000-0000-4000-8000-000000000005')$$,'40001','STALE_VERSION','reply version uses actual card version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','check_card_item','e9100000-0000-4000-8000-00000000000c',2,'{"completed":true}','e9110000-0000-4000-8000-000000000006')$$,'40001','STALE_VERSION','checklist requires item version even when supplied version matches card');
insert into receipts select 'check',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','check_card_item','e9100000-0000-4000-8000-00000000000c',1,'{"completed":true}','e9110000-0000-4000-8000-000000000007');
select is((select version from receipts where label='check'),2::bigint,'checklist completion increments item version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','check_card_item','e9100000-0000-4000-8000-00000000000c',1,'{"completed":false}','e9110000-0000-4000-8000-000000000008')$$,'40001','STALE_VERSION','stale checklist item cannot be cleared');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','check_card_item','e9100000-0000-4000-8000-00000000000c',2,'{"completed":false}','e9110000-0000-4000-8000-000000000009')$$,'current checklist version may clear completion');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
insert into receipts select 'assigned_reply',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),2,'{"body":"Assigned private reply"}','e9110000-0000-4000-8000-00000000000a');
select ok((select id is not null from receipts where label='assigned_reply'),'assigned viewer can reply through native own-person scope');
select is((select resource_id from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),2,'{"body":"Assigned private reply"}','e9110000-0000-4000-8000-00000000000a')),(select id from receipts where label='assigned_reply'),'exact reply replay returns original receipt');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),2,'{"body":"Changed replay"}','e9110000-0000-4000-8000-00000000000a')$$,'22000','IDEMPOTENCY_CONFLICT','same reply key cannot change content');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'cards'),1,'assigned actor reads only the explicitly assigned card');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update_card',(select id from receipts where label='card'),2,'{"column_id":"e9100000-0000-4000-8000-000000000006","status":"open","due_at":"2027-03-24T10:00:00+01:00"}','e9110000-0000-4000-8000-00000000000b')$$,'42501','FORBIDDEN','assignment does not authorize manager-only deadline change');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'cards'),0,'other parent cannot read the private commission card');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),2,'{"body":"Unauthorized parent"}','e9110000-0000-4000-8000-00000000000c')$$,'42501','FORBIDDEN','other parent cannot reply');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','update_card',(select id from receipts where label='card'),2,'{"column_id":"e9100000-0000-4000-8000-000000000005","status":"open"}','e9110000-0000-4000-8000-00000000000d')$$,'42501','FORBIDDEN','other parent cannot update');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','check_card_item','e9100000-0000-4000-8000-00000000000c',3,'{"completed":true}','e9110000-0000-4000-8000-00000000000e')$$,'42501','FORBIDDEN','other parent cannot change checklist');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card','e9100000-0000-4000-8000-00000000000a',1,'{"body":"Other committee"}','e9110000-0000-4000-8000-00000000000f')$$,'42501','FORBIDDEN','coordinator role does not cross committee');
select throws_ok($$select * from api.pwa_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','reply_card','e9100000-0000-4000-8000-00000000000b',1,'{"body":"Other club"}','e9110000-0000-4000-8000-000000000010')$$,'42501','FORBIDDEN','coordinator role does not cross club');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","session_id":"99999999-9999-4999-8999-999999999999","role":"authenticated"}',true);
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reply_card',(select id from receipts where label='card'),2,'{"body":"No native session"}','e9110000-0000-4000-8000-000000000011')$$,'42501','FORBIDDEN','spoofed session cannot use the repaired path');
reset role;
select is((select count(*) from app.pwa_card_replies where card_id=(select id from receipts where label='card')),2::bigint,'replay and negative writes create no extra reply');
select ok((select person_id='a1000000-0000-4000-8000-000000000001' from app.pwa_card_replies where id=(select id from receipts where label='assigned_reply')),'reply author is the native actor person');
select is((select column_id from app.kanban_cards where id=(select id from receipts where label='card')),'e9100000-0000-4000-8000-000000000006'::uuid,'actual card column reads back after update');
select is((select due_at from app.kanban_cards where id=(select id from receipts where label='card')),'2027-03-23T10:00:00+01:00'::timestamptz,'denied deadline mutation rolls back preceding card update');
select is((select version from app.kanban_cards where id=(select id from receipts where label='card')),2::bigint,'failed mutations do not increment card version');
select is((select count(*) from app.kanban_card_history where card_id=(select id from receipts where label='card') and event_type='pwa.card.changed'),1::bigint,'successful update appends exactly one history row');
select ok((select actor_auth_user_id='33333333-3333-4333-8333-333333333333' and card_version=2 from app.kanban_card_history where card_id=(select id from receipts where label='card') and event_type='pwa.card.changed'),'history binds actual manager and card version');
select ok((select version=3 and completed_at is null and completed_by_auth_user_id is null from app.card_checklist_items where id='e9100000-0000-4000-8000-00000000000c'),'checklist readback preserves explicit cleared state');
select is((select count(*) from app.domain_events where id=any((select event_ids from receipts where label='assigned_reply')::uuid[])),1::bigint,'replayed reply retains one actual event');
select ok(not exists(select 1 from app.audit_events where payload_minimal::text like '%private reply%'),'reply contents stay outside audit payload');
select is((select count(*) from app.hour_ledger_entries),(select total from original_ledger),'card mutations create no confirmed hour credit');
select * from finish();
rollback;
