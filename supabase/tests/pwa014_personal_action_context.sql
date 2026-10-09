begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

-- LOCAL ONLY synthetic canonical core; every suite rolls back.
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
create function pg_temp.actor(p_actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor))::text,true);
end;$$;
create function pg_temp.id(n integer)returns uuid language sql immutable as $$select ('f1500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into app.permission_roles(id,tenant_id,role_key,name,system_role) values(pg_temp.id(1),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','action_reader_fixture','Action reader fixture',false);
insert into app.role_permissions(tenant_id,role_id,permission_key) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(1),'committee.workspace.view'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(1),'policy.follow_up');
insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,starts_at,granted_by_auth_user_id) values
 (pg_temp.id(2),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',pg_temp.id(1),'tenant',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333');
insert into app.kanban_boards(id,tenant_id,committee_id,name) values
 (pg_temp.id(3),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','Action test board');
insert into app.kanban_columns(id,tenant_id,board_id,title,position) values
 (pg_temp.id(4),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(3),'Open',0);
insert into app.kanban_cards(id,tenant_id,board_id,column_id,title,description,created_by_auth_user_id) values
 (pg_temp.id(5),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(3),pg_temp.id(4),'Exact parent work card','Authorized work card instructions','33333333-3333-4333-8333-333333333333');
insert into app.kanban_card_subtasks(id,tenant_id,card_id,title,due_at) values
 (pg_temp.id(6),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(5),'Exact subtask',statement_timestamp()+interval '2 days');
insert into app.kanban_subtask_assignees(id,tenant_id,subtask_id,person_id,assigned_by_auth_user_id) values
 (pg_temp.id(7),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(6),'a1000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333');
insert into app.events(id,tenant_id,title,organizer_person_id,visibility,timezone,status) values
 (pg_temp.id(8),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Exact private activity','a1000000-0000-4000-8000-000000000003','private','Europe/Amsterdam','active');
insert into app.event_occurrences(id,tenant_id,event_id,recurrence_key,starts_at,ends_at,local_date) values
 (pg_temp.id(9),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(8),'action-occurrence',statement_timestamp()+interval '2 days',statement_timestamp()+interval '2 days 1 hour',(statement_timestamp()+interval '2 days')::date);
insert into app.event_attendees(tenant_id,occurrence_id,person_id,rsvp) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(9),'a1000000-0000-4000-8000-000000000001','invited');
insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type) values
 (pg_temp.id(10),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','kanban_card',pg_temp.id(5),1,'kanban.mentioned'),
 (pg_temp.id(11),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','event',pg_temp.id(8),1,'event.mentioned');
insert into app.mentions(id,tenant_id,recipient_person_id,author_person_id,card_id,source_event_id,excerpt) values
 (pg_temp.id(12),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',pg_temp.id(5),pg_temp.id(10),'Exact work card mention');
insert into app.mentions(id,tenant_id,recipient_person_id,author_person_id,occurrence_id,source_event_id,excerpt) values
 (pg_temp.id(13),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',pg_temp.id(9),pg_temp.id(11),'Exact activity mention');
insert into app.teams(id,tenant_id,name) values(pg_temp.id(14),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Own action team');
insert into app.team_person_memberships(id,tenant_id,team_id,person_id,membership_kind) values
 (pg_temp.id(15),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(14),'a1000000-0000-4000-8000-000000000001','player');
insert into app.team_tasks(id,tenant_id,team_id,title,description,assigned_person_id,created_by_auth_user_id) values
 (pg_temp.id(16),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(14),'Exact zero-minute team task','Actual team task instructions','a1000000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333');
insert into app.policy_documents(id,tenant_id,document_key,title,current_revision) values
 (pg_temp.id(17),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','action.policy','Exact assigned policy',1);
insert into app.policy_versions(id,tenant_id,document_id,revision,exact_body,state,approved_by_auth_user_id,approved_at,published_at,created_by_auth_user_id) values
 (pg_temp.id(18),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(17),1,'Exact body of historical policy version','published','33333333-3333-4333-8333-333333333333',statement_timestamp(),statement_timestamp(),'33333333-3333-4333-8333-333333333333');
insert into app.policy_audiences(id,tenant_id,policy_version_id,audience_key,criteria_snapshot,approved_by_auth_user_id) values
 (pg_temp.id(19),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(18),'action-read','{}','33333333-3333-4333-8333-333333333333');
insert into app.policy_assignments(id,tenant_id,policy_version_id,audience_id,member_person_id) values
 (pg_temp.id(20),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(18),pg_temp.id(19),'a1000000-0000-4000-8000-000000000002');
insert into app.policy_questions(id,tenant_id,assignment_id,author_auth_user_id,author_person_id,question_text,handler_person_id) values
 (pg_temp.id(21),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(20),'22222222-2222-4222-8222-222222222222','a1000000-0000-4000-8000-000000000002','Actual policy question for authorized follow-up','a1000000-0000-4000-8000-000000000001');
create temporary table action_receipts as
 select a.id,a.version,a.action_kind,coalesce(a.subtask_id,a.mention_id,a.team_task_id,a.policy_question_id) source_id
 from app.personal_action_items a where a.recipient_person_id='a1000000-0000-4000-8000-000000000001' and a.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
grant select on action_receipts to authenticated;
create function pg_temp.context(n integer,expected bigint default 1)returns jsonb language plpgsql stable security invoker as $$
 begin return api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from action_receipts where source_id=pg_temp.id(n)),expected); end;
$$;
create function pg_temp.fingerprint() returns text language plpgsql security definer set search_path='' as $$
declare r record; result jsonb='{}'; data jsonb;
begin
 for r in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind in('r','p') order by c.relname loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from app.%I t',r.relname) into data;
  result=result||jsonb_build_object(r.relname,data);
 end loop;
 return encode(sha256(convert_to(result::text,'UTF8')),'hex');
end;$$;
create temporary table before_reads as select pg_temp.fingerprint() fingerprint;
grant select on before_reads to authenticated;

-- PWA_115_ASSERTIONS: setup is also the populated31 upgrade fixture.
select ok((select not prosecdef and provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='api.pwa_personal_action_context(uuid,uuid,bigint)'::regprocedure),'new personal action RPC stays stable security invoker with an empty search path');
select ok(has_function_privilege('authenticated','api.pwa_personal_action_context(uuid,uuid,bigint)','EXECUTE'),'authenticated may execute the narrow read contract');
select ok(not has_function_privilege('anon','api.pwa_personal_action_context(uuid,uuid,bigint)','EXECUTE'),'anonymous role has no action read authority');
select ok(not has_function_privilege('service_role','api.pwa_personal_action_context(uuid,uuid,bigint)','EXECUTE'),'server key has no action read authority');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from api.my_actions),5,'native view exposes the five actual owned legacy actions');
select is(pg_temp.context(6)->>'kind','subtask','native subtask action resolves its actual child kind');
select is(pg_temp.context(6)->>'resource_id',pg_temp.id(6)::text,'native subtask action resolves its exact child ID');
select is(pg_temp.context(6)->>'card_id',pg_temp.id(5)::text,'native subtask action resolves the actual authorized parent card');
select is(pg_temp.context(6)->>'title','Exact subtask','subtask content comes from the real source');
select is(pg_temp.context(12)->>'kind','card_mention','native card mention is distinct from an activity mention');
select is(pg_temp.context(12)->>'text','Exact work card mention','card mention reads its actual authorized excerpt');
select is(pg_temp.context(12)->>'card_id',pg_temp.id(5)::text,'card mention resolves its exact parent card');
select ok(not(pg_temp.context(12)?'resource_version'),'unversioned mention source does not invent a version');
select is(pg_temp.context(12)->>'parent_version','1','card mention reads its actual parent version');
select is(pg_temp.context(13)->>'kind','event_mention','native activity mention resolves its actual child kind');
select is(pg_temp.context(13)->>'occurrence_id',pg_temp.id(9)::text,'activity mention resolves the exact occurrence rather than another event');
select is(pg_temp.context(13)->>'text','Exact activity mention','activity mention reads its actual authorized excerpt');
select is(pg_temp.context(16)->>'team_id',pg_temp.id(14)::text,'team task resolves the actual authorized team');
select is(pg_temp.context(16)->>'text','Actual team task instructions','team task reads actual native instructions');
select is(pg_temp.context(16)->>'credit_minutes','0','team task read cannot invent attendance or hour credit');
select is(pg_temp.context(21)->>'assignment_id',pg_temp.id(20)::text,'policy follow-up reads the exact authorized assignment');
select is(pg_temp.context(21)->>'policy_version_id',pg_temp.id(18)::text,'policy follow-up resolves its historical policy version');
select is(pg_temp.context(21)->>'text','Actual policy question for authorized follow-up','policy question content is the actual authorized body');
select is(pg_temp.context(6,0),null::jsonb,'zero expected version does not resolve an action');
select is(pg_temp.context(6,-1),null::jsonb,'negative expected version does not resolve an action');
select is(pg_temp.context(6,2),null::jsonb,'stale expected version does not resolve an action');
select is(pg_temp.context(6,null),null::jsonb,'missing expected version does not resolve an action');
select is(api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(999),1),null::jsonb,'unknown exact action never selects another source');
select is(api.pwa_personal_action_context('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',(select id from action_receipts where source_id=pg_temp.id(6)),1),null::jsonb,'foreign tenant selector does not resolve an owned action');
select is(pg_temp.fingerprint(),(select fingerprint from before_reads),'all app rows, ledger, policy opening/history and audit remain byte-equivalent after positive and negative GET reads');
select ok(not(pg_temp.context(21)::text ~ 'auth_user|email|refresh_token|private_key|endpoint'),'returned body excludes identity, contact, session and push secrets');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select ok(not exists(select 1 from action_receipts where api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,version) is not null),'same-household other parent inherits none of the five assigned action contexts');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select ok(not exists(select 1 from action_receipts where api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,version) is not null),'coordinator source access alone does not grant another actor assigned actions');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select ok(not exists(select 1 from action_receipts where api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,version) is not null),'foreign native actor receives no body for the five known action IDs');
reset role;
update app.personal_action_items set state='dismissed' where id=(select id from action_receipts where source_id=pg_temp.id(6));
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from app.kanban_card_subtasks where id=pg_temp.id(6)),1,'actual subtask source rights remain available for the inactive action test');
select is(api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',(select id from action_receipts where source_id=pg_temp.id(6)),(select version from api.my_actions where subtask_id=pg_temp.id(6))),null::jsonb,'dismissed exact action is denied even with a current version and live source access');
reset role;
update app.personal_action_items set state='open' where id=(select id from action_receipts where source_id=pg_temp.id(6));
update action_receipts r set version=a.version from app.personal_action_items a where a.id=r.id;
update app.access_grants set revoked_at=statement_timestamp() where id=pg_temp.id(2);
-- The canonical member role also grants match.view at tenant scope. Revoke
-- that actual read grant as well; ending a team link alone is not revocation.
update app.access_grants set revoked_at=statement_timestamp() where id='a3300000-0000-4000-8000-000000000001';
update app.team_person_memberships set ends_at=statement_timestamp() where id=pg_temp.id(15);
delete from app.kanban_subtask_assignees where id=pg_temp.id(7);
delete from app.event_attendees where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and occurrence_id=pg_temp.id(9);
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from api.my_actions),5,'revoked source access preserves the owned action history');
select ok(not exists(select 1 from action_receipts where api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,version) is not null),'all five source forms stop returning content after their actual source rights are revoked');
reset role;
delete from auth.sessions where user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
select is((select count(*)::integer from api.my_actions),0,'old unexpired claims lose native action visibility after session revocation');
select ok(not exists(select 1 from action_receipts where api.pwa_personal_action_context('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id,version) is not null),'old native claims cannot restore any context after actual session revocation');
reset role;
select is((select sum(minutes_delta)::integer from app.hour_ledger_entries),60,'action context reads and scope revocation do not write attendance credit');
select * from finish();
rollback;
