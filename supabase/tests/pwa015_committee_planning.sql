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

create function pg_temp.id(n integer)returns uuid language sql immutable as $$select ('f1600000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
insert into app.locations(id,tenant_id,name)values(pg_temp.id(400),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Exact draft location');
insert into app.committees(id,tenant_id,slug,name)values(pg_temp.id(200),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other-planning','Other private committee');
insert into app.task_categories(id,tenant_id,committee_id,name)values(pg_temp.id(201),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(200),'Other planning category');
insert into app.task_types(id,tenant_id,category_id,name)values(pg_temp.id(202),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(201),'Other planning type');
insert into app.task_type_versions(id,tenant_id,task_type_id,revision,credit_minutes,approved_by_auth_user_id)values(pg_temp.id(203),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(202),1,120,'33333333-3333-4333-8333-333333333333');
insert into app.task_categories(id,tenant_id,committee_id,name)values('b7000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b2000000-0000-4000-8000-000000000001','Other tenant category');
insert into app.task_types(id,tenant_id,category_id,name)values('b8000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b7000000-0000-4000-8000-000000000001','Other tenant type');
insert into app.task_type_versions(id,tenant_id,task_type_id,revision,credit_minutes,approved_by_auth_user_id)values('b9000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b8000000-0000-4000-8000-000000000001',1,120,'44444444-4444-4444-8444-444444444444');
insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,status)values(pg_temp.id(300),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Planning next season','2027-07-01','2028-06-30','2027-12-21 00:00:00+01','preparing');
insert into app.shifts(id,tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at,location_id)values
 (pg_temp.id(100),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Exact internal draft','2027-02-02 10:00:00+01','2027-02-02 12:00:00+01',120,2880,'draft',null,pg_temp.id(400)),
 (pg_temp.id(101),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Cancelled planning','2027-02-03 10:00:00+01','2027-02-03 12:00:00+01',120,2880,'cancelled',null,null),
 (pg_temp.id(102),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Completed planning','2027-02-04 10:00:00+01','2027-02-04 12:00:00+01',120,2880,'completed',null,null),
 (pg_temp.id(103),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Past draft','2026-09-01 10:00:00+02','2026-09-01 12:00:00+02',120,2880,'draft',null,null),
 (pg_temp.id(104),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Next season draft','2027-07-02 10:00:00+02','2027-07-02 12:00:00+02',120,2880,'draft',null,null),
 (pg_temp.id(105),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(203),pg_temp.id(200),pg_temp.id(201),'Another committee private draft','2027-02-05 10:00:00+01','2027-02-05 12:00:00+01',120,2880,'draft',null,null),
 (pg_temp.id(106),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(203),pg_temp.id(200),pg_temp.id(201),'Another committee published task','2027-02-06 10:00:00+01','2027-02-06 12:00:00+01',120,2880,'published',statement_timestamp(),null),
 (pg_temp.id(107),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b9000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000001','Another tenant draft','2027-02-02 10:00:00+01','2027-02-02 12:00:00+01',120,2880,'draft',null,null);
insert into app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at)select pg_temp.id(500+n),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',s.id,n,s.starts_at,s.ends_at from app.shifts s cross join generate_series(1,2)n where s.id=pg_temp.id(100);
insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,committee_id,starts_at,granted_by_auth_user_id)select pg_temp.id(600),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444',r.id,'committee','b2000000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day','44444444-4444-4444-8444-444444444444'from app.permission_roles r where r.tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'and r.role_key='committee_coordinator';
create function pg_temp.planning(tenant uuid default 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',season uuid default 'a5000000-0000-4000-8000-000000000001')returns jsonb language plpgsql stable security invoker as $$begin return(select coalesce(jsonb_agg(to_jsonb(p)order by starts_at,id),'[]'::jsonb)from api.pwa_committee_planning(tenant,season)p);end;$$;
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

-- PWA_116_ASSERTIONS: setup is also the committed populated32 upgrade fixture.
select ok((select not prosecdef and provolatile='s' and proconfig @> array['search_path=""'] from pg_proc where oid='api.pwa_committee_planning(uuid,uuid)'::regprocedure),'planning RPC stays stable invoker with an empty search path');
select ok(has_function_privilege('authenticated','api.pwa_committee_planning(uuid,uuid)','EXECUTE'),'authenticated may execute the scoped planning read');
select ok(not has_function_privilege('anon','api.pwa_committee_planning(uuid,uuid)','EXECUTE'),'anonymous role has no planning read authority');
select ok(not has_function_privilege('service_role','api.pwa_committee_planning(uuid,uuid)','EXECUTE'),'server key has no planning read authority');
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(jsonb_array_length(pg_temp.planning()),3,'native coordinator reads only two own published tasks and the own future draft');
select is((select p.title from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id=pg_temp.id(100)),'Exact internal draft','draft title is its exact native source');
select is((select p.state from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id=pg_temp.id(100)),'draft','reading does not publish a draft');
select is((select p.position_count from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id=pg_temp.id(100)),2,'draft exposes its two actual physical places');
select is((select p.location_name from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id=pg_temp.id(100)),'Exact draft location','draft location is its exact native source');
select is((select p.credit_minutes from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id=pg_temp.id(100)),120,'read exposes the canonical planning value without awarding it');
select ok(not exists(select 1 from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id in(pg_temp.id(101),pg_temp.id(102),pg_temp.id(103))),'cancelled completed and past drafts are absent from upcoming planning');
select ok(not exists(select 1 from api.pwa_committee_planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001')p where p.id in(pg_temp.id(105),pg_temp.id(106))),'another committee is denied for both draft and published planning');
select is(jsonb_array_length(pg_temp.planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(300))),1,'explicit next preparing season reads only its real future draft');
select is(pg_temp.planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(300))->0->>'id',pg_temp.id(104)::text,'the next season never falls back to the current season');
select is(pg_temp.planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','b5000000-0000-4000-8000-000000000001'),'[]'::jsonb,'foreign-tenant season does not widen planning');
select is(pg_temp.planning('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b5000000-0000-4000-8000-000000000001'),'[]'::jsonb,'coordinator cannot select another tenant');
select is(pg_temp.planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.id(999)),'[]'::jsonb,'unknown season yields no arbitrary context');
select is(pg_temp.planning('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null),'[]'::jsonb,'missing selected season yields no planning');
select is(pg_temp.planning(null,'a5000000-0000-4000-8000-000000000001'),'[]'::jsonb,'missing tenant yields no planning');
select ok(not exists(select 1 from api.list_shift_market('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')p where p.shift_id=pg_temp.id(100)),'internal draft remains absent from the existing public market');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(pg_temp.planning(),'[]'::jsonb,'ordinary household member cannot read committee draft or planner metadata');
select is((select count(*)::integer from app.shifts where id=pg_temp.id(100)),0,'native RLS independently denies the same draft parent to the member');
select ok(exists(select 1 from api.list_shift_market('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')p where p.shift_id='aa200000-0000-4000-8000-000000000001'),'member public market remains available');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select is(pg_temp.planning('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b5000000-0000-4000-8000-000000000001')->0->>'id',pg_temp.id(107)::text,'other tenant coordinator reads only its own native draft');
select is(pg_temp.planning(),'[]'::jsonb,'other tenant coordinator cannot read the first tenant');
reset role;
select is(pg_temp.fingerprint(),(select fingerprint from before_reads),'positive and negative GETs preserve every app row audit event history and ledger');
select is((select coalesce(sum(minutes_delta),0)::integer from app.hour_ledger_entries),60,'planning reads do not award or correct confirmed minutes');
update app.access_grants set revoked_at=statement_timestamp()where id='a3300000-0000-4000-8000-000000000003';
create temporary table before_denied_reads as select pg_temp.fingerprint()fingerprint;
grant select on before_denied_reads to authenticated;
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(pg_temp.planning(),'[]'::jsonb,'revoked actual committee grant immediately denies both draft and published planning');
reset role;
select is(pg_temp.fingerprint(),(select fingerprint from before_denied_reads),'denied revoked-grant GET leaves all app rows unchanged');
update app.access_grants set revoked_at=null where id='a3300000-0000-4000-8000-000000000003';
update auth.sessions set not_after=statement_timestamp()-interval '1 second'where user_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(pg_temp.planning(),'[]'::jsonb,'expired actual native session cannot read still-authorized planning');
reset role;
update auth.sessions set not_after=null where user_id='33333333-3333-4333-8333-333333333333';
update app.tenant_memberships set status='blocked'where auth_user_id='33333333-3333-4333-8333-333333333333';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(pg_temp.planning(),'[]'::jsonb,'blocked native tenant membership cannot read current committee planning');
reset role;
select * from finish();
rollback;
