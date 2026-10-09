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

-- Synthetic native SQL sessions; all changes, including legacy-row simulation,
-- roll back. Browser/provider verification is a separate proof.
update auth.users set email_confirmed_at=statement_timestamp();
insert into auth.sessions(id,user_id,created_at,updated_at)select id,id,statement_timestamp(),statement_timestamp()from auth.users;
create function pg_temp.actor(p_actor uuid)returns void language plpgsql security definer set search_path=''as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor))::text,true);end;$$;
insert into app.teams(id,tenant_id,name) values
 ('fa100000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owned handover team'),
 ('fa100000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Owned legacy handover team');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,team_id,starts_at,granted_by_auth_user_id)
 select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',r.id,'team',t.id,statement_timestamp()-interval'1 day','33333333-3333-4333-8333-333333333333'
 from app.permission_roles r cross join app.teams t where r.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and r.role_key='team_parent'and t.id in('fa100000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000002');
create function pg_temp.payload(p_checks jsonb,p_omit boolean default false)returns jsonb language sql set search_path=''as $$
select jsonb_build_object('season_id','a5000000-0000-4000-8000-000000000001','successor_person_id','a1000000-0000-4000-8000-000000000001','note','Owned checklist proof')||case when p_omit then '{}'::jsonb else jsonb_build_object('checks',p_checks)end;$$;
create temporary table receipts(label text primary key,id uuid,version bigint);grant all on receipts to authenticated;
set local role authenticated;select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select throws_ok(format('select * from api.pwa_command(%L,%L,%L,0,%L::jsonb,%L)',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','prepare_handover','fa100000-0000-4000-8000-000000000001',pg_temp.payload(v.checks,v.omit),md5('owned-invalid-handover:'||v.label)::uuid),
 '22023','CHECKLIST_INCOMPLETE','direct native preparation rejects '||v.label)
from(values
 ('empty','[]'::jsonb,false),('missing',null::jsonb,true),('null','null'::jsonb,false),('scalar string','"true"'::jsonb,false),('scalar boolean','true'::jsonb,false),('object','{}'::jsonb,false),
 ('four choices','[true,true,true,true]'::jsonb,false),('six choices','[true,true,true,true,true,true]'::jsonb,false),('null choice','[true,true,null,true,true]'::jsonb,false),
 ('string choice','[true,true,"true",true,true]'::jsonb,false),('number choice','[true,true,1,true,true]'::jsonb,false),('object choice','[true,true,{},true,true]'::jsonb,false),('nested choice','[true,true,[true],true,true]'::jsonb,false),('unchecked ready choice','[true,true,false,true,true]'::jsonb,false))v(label,checks,omit);
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_handover_draft','fa100000-0000-4000-8000-000000000001',0,pg_temp.payload('[]'),'fa900000-0000-4000-8000-000000000001')$$,'22023','CHECKLIST_INCOMPLETE','draft also requires exactly five typed choices');
reset role;select is((select count(*)from app.pwa_handovers),0::bigint,'invalid preparations leave no handover rows');
select is((select count(*)from app.audit_events where action in('pwa.prepare_handover','pwa.save_handover_draft')),0::bigint,'rejected preparations create no successful mutation audit');
set local role authenticated;select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','prepare_handover','fa100000-0000-4000-8000-000000000001',0,pg_temp.payload('[true,true,true,true,true]'),'fa900000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','five choices never supply missing team authority');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into receipts select 'draft',resource_id,version from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','save_handover_draft','fa100000-0000-4000-8000-000000000001',0,pg_temp.payload('[false,false,false,false,false]'),'fa900000-0000-4000-8000-000000000003');
reset role;select is((select state from app.pwa_handovers where id=(select id from receipts where label='draft')),'draft','five unchecked choices remain a valid draft');
select is((select cardinality(checks)from app.pwa_handovers where id=(select id from receipts where label='draft')),5,'draft persists all five boolean positions');
set local role authenticated;select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover',(select id from receipts where label='draft'),1,'{}','fa900000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','named successor cannot accept a draft');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into receipts select 'ready',resource_id,version from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','prepare_handover','fa100000-0000-4000-8000-000000000001',1,pg_temp.payload('[true,true,true,true,true]'),'fa900000-0000-4000-8000-000000000005');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover',(select id from receipts where label='ready'),2,'{}','fa900000-0000-4000-8000-000000000006')$$,'42501','FORBIDDEN','another parent cannot take the named successor authority');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover',(select id from receipts where label='ready'),2,'{}','fa900000-0000-4000-8000-000000000007')$$,'42501','FORBIDDEN','another tenant cannot accept a known handover id');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover',(select id from receipts where label='ready'),1,'{}','fa900000-0000-4000-8000-000000000008')$$,'40001','STALE_VERSION','valid choices do not loosen expected version');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover',(select id from receipts where label='ready'),2,'{}','fa900000-0000-4000-8000-000000000009')$$,'named successor accepts exact ready five-check version');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover',(select id from receipts where label='ready'),2,'{}','fa900000-0000-4000-8000-000000000009')$$,'same key replays confirmed authority transfer without duplicating grants');
select ok(internal.has_permission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','team_task.manage','team','fa100000-0000-4000-8000-000000000001'),'five-check acceptance supplies actual team-parent authority');
reset role;select is((select state from app.pwa_handovers where id=(select id from receipts where label='ready')),'accepted','accepted history preserves the ready record');
select is((select count(*)from app.access_grants g join app.permission_roles r on r.id=g.role_id where g.auth_user_id='11111111-1111-4111-8111-111111111111'and g.team_id='fa100000-0000-4000-8000-000000000001'and r.role_key='team_parent'),1::bigint,'exact replay grants the new role once');
select throws_ok($$insert into app.pwa_handovers(tenant_id,season_id,team_id,predecessor_person_id,successor_person_id,note,checks,state)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','Invalid table fixture',array[]::boolean[],'ready')$$,'23514',null,'table independently rejects empty array under SQL NULL semantics');
select throws_ok($$insert into app.pwa_handovers(tenant_id,season_id,team_id,predecessor_person_id,successor_person_id,note,checks,state)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','Invalid table fixture',array[true,true,null,true,true]::boolean[],'draft')$$,'23514',null,'table rejects null choices in draft too');
select ok(not has_table_privilege('authenticated','app.pwa_handovers','INSERT'),'native actor has no direct handover INSERT bypass');
-- Simulate a genuine pre111 malformed row without changing any shared source:
-- dropping only the new constraint in this owned rollback transaction verifies
-- the independent acceptance guard even if old invalid data is imported.
alter table app.pwa_handovers drop constraint pwa_handover_five_boolean_checks;
insert into app.pwa_handovers(id,tenant_id,season_id,team_id,predecessor_person_id,successor_person_id,note,checks,state)values('fa100000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','Pre111 malformed owned fixture',array[]::boolean[],'ready');
set local role authenticated;select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_handover','fa100000-0000-4000-8000-000000000003',1,'{}','fa900000-0000-4000-8000-00000000000a')$$,'22023','CHECKLIST_INCOMPLETE','acceptance guard separately rejects legacy empty ready checklist');
select ok(not internal.has_permission('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','team_task.manage','team','fa100000-0000-4000-8000-000000000002'),'legacy malformed acceptance grants no authority');
reset role;select is((select state from app.pwa_handovers where id='fa100000-0000-4000-8000-000000000003'),'ready','legacy failure does not overwrite malformed historical record');
select is((select count(*)from app.audit_events where idempotency_key='fa900000-0000-4000-8000-00000000000a'),0::bigint,'legacy failed acceptance creates no successful transfer audit');
select *from finish();rollback;
