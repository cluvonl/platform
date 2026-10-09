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
-- Synthetic fixture: this entire suite rolls back, including Auth sessions.
-- The canonical tenant trigger seeds task.offer before any publication.
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,starts_at,granted_by_auth_user_id) select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',r.id,'tenant',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333' from app.permission_roles r where r.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and r.role_key='volunteer_committee';
insert into app.kanban_boards(id,tenant_id,committee_id,name) values('ca070000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001','Werkbord');
insert into app.kanban_columns(id,tenant_id,board_id,title,position,terminal) values('ca070000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca070000-0000-4000-8000-000000000001','Te doen',0,false),('ca070000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca070000-0000-4000-8000-000000000001','Klaar',1,true);
-- Owned Native SQL fixtures; every Auth row and mutation rolls back.
insert into app.pwa_clusters(id,tenant_id,season_id,team_id,title,mode,self_until,assign_until)values('ff450000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001','ca010000-0000-4000-8000-000000000001','Captured allocation versions','assign',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day');
insert into app.pwa_allocations(id,tenant_id,cluster_id,position_id)values
 ('ff460000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ff450000-0000-4000-8000-000000000001','aa210000-0000-4000-8000-000000000002'),
 ('ff460000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ff450000-0000-4000-8000-000000000001','aa210000-0000-4000-8000-000000000004');
insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ca010000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','player');
insert into app.policy_documents(id,tenant_id,document_key,title,current_revision)values('e7500000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned-repeat-policy','Exacte beleidsproef',1);
insert into app.policy_versions(id,tenant_id,document_id,revision,exact_body,body_hash,state,approved_by_auth_user_id,approved_at,published_at,created_by_auth_user_id)values('e7510000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7500000-0000-4000-8000-000000000001',1,'Exacte lokale beleidstekst',extensions.digest('Exacte lokale beleidstekst','sha256'),'published','33333333-3333-4333-8333-333333333333',statement_timestamp(),statement_timestamp(),'33333333-3333-4333-8333-333333333333');
insert into app.policy_audiences(id,tenant_id,policy_version_id,audience_key,criteria_snapshot,approved_by_auth_user_id)values('e7520000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7510000-0000-4000-8000-000000000001','owned','{}','33333333-3333-4333-8333-333333333333');
insert into app.policy_assignments(id,tenant_id,policy_version_id,audience_id,member_person_id,state,opened_at)values
 ('e7530000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7510000-0000-4000-8000-000000000001','e7520000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','opened',statement_timestamp()),
 ('e7530000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7510000-0000-4000-8000-000000000001','e7520000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','opened',statement_timestamp());
create function pg_temp.fingerprint()returns bytea language sql security definer set search_path='' as $$select extensions.digest(convert_to(jsonb_build_object(
 'shifts',(select jsonb_agg(to_jsonb(t)order by id)from app.shifts t),
 'instructions',(select jsonb_agg(to_jsonb(t)order by id)from app.pwa_instruction_versions t),
 'allocations',(select jsonb_agg(to_jsonb(t)order by id)from app.pwa_allocations t),
 'assignments',(select jsonb_agg(to_jsonb(t)order by id)from app.policy_assignments t),
 'acceptances',(select jsonb_agg(to_jsonb(t)order by id)from app.policy_acceptances t),
 'attendance',(select jsonb_agg(to_jsonb(t)order by id)from app.attendance_decisions t),
 'ledger',(select jsonb_agg(to_jsonb(t)order by id)from app.hour_ledger_entries t),
 'grants',(select jsonb_agg(to_jsonb(t)order by id)from app.access_grants t),
 'audit',(select jsonb_agg(to_jsonb(t)order by id)from app.audit_events t),
 'events',(select jsonb_agg(to_jsonb(t)order by id)from app.domain_events t),
 'commands',(select jsonb_agg(to_jsonb(t)order by id)from app.idempotency_records t)
 )::text,'UTF8'),'sha256');$$;
create temporary table captured(label text primary key,fingerprint bytea);
create temporary table receipts(label text primary key,id uuid,version bigint,event_ids uuid[]);
grant select,insert on captured,receipts to authenticated;
set local role authenticated;select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000001',1,'{"body":"Actual immutable target revision before the bulk operation"}','ff910000-0000-4000-8000-000000000001')$$,'native coordinator publishes the actual target version before propagation');
insert into captured values('propagation',pg_temp.fingerprint());
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist rejected propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":null}]}','ff900000-0000-4000-8000-000000000002')$$,'22023','EXPECTED_VERSION_REQUIRED','propagation rejects null nested version at the native API');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist rejected propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":0}]}','ff900000-0000-4000-8000-000000000003')$$,'22023','EXPECTED_VERSION_REQUIRED','propagation rejects zero nested version at the native API');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist rejected propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":-1}]}','ff900000-0000-4000-8000-000000000004')$$,'22023','EXPECTED_VERSION_REQUIRED','propagation rejects negative nested version at the native API');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist rejected propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":"2"}]}','ff900000-0000-4000-8000-000000000005')$$,'22023','EXPECTED_VERSION_REQUIRED','propagation rejects string nested version at the native API');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist rejected propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":true}]}','ff900000-0000-4000-8000-000000000006')$$,'22023','EXPECTED_VERSION_REQUIRED','propagation rejects boolean nested version at the native API');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist rejected propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":2.5}]}','ff900000-0000-4000-8000-000000000007')$$,'22023','EXPECTED_VERSION_REQUIRED','propagation rejects fractional nested version at the native API');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist missing propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000008')$$,'22023','INVALID_FIELD','propagation rejects an omitted captured target version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Must not persist stale propagation","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":1}]}','ff900000-0000-4000-8000-000000000009')$$,'40001','STALE_VERSION','propagation rejects the actual prior target version');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='propagation'),'rejected propagation preserves every immutable instruction version scope audit receipt and ledger');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Unauthorized body","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":2}]}','ff900000-0000-4000-8000-000000000010')$$,'42501','FORBIDDEN','correct nested versions do not grant an ordinary member instruction authority');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select throws_ok($$select * from api.pwa_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Wrong club","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":2}]}','ff900000-0000-4000-8000-000000000011')$$,'42501','FORBIDDEN','correct nested versions do not cross the native tenant boundary');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='propagation'),'unauthorized propagation also leaves all durable state unchanged');
insert into receipts select 'propagation',resource_id,version,event_ids from(select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Actual captured source and target version publication","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":2}]}','ff910000-0000-4000-8000-000000000002'))r;
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish_instructions','aa200000-0000-4000-8000-000000000003',1,'{"body":"Actual captured source and target version publication","propagate_to":[{"shift_id":"aa200000-0000-4000-8000-000000000001","expected_version":2}]}','ff910000-0000-4000-8000-000000000002')$$,'correctly captured propagation replays the same completed command');
reset role;select is((select version from app.shifts where id='aa200000-0000-4000-8000-000000000001'),3::bigint,'target version reflects exactly its two actual instruction publications');
select is((select version from app.shifts where id='aa200000-0000-4000-8000-000000000003'),2::bigint,'source version changes once for the actual bulk publication');
select is((select count(*)::integer from app.pwa_instruction_versions where body='Actual captured source and target version publication'),2,'correct propagation and replay retain exactly two immutable instruction records');
set local role authenticated;select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":1,"member_person_id":"ca020000-0000-4000-8000-000000000001"}]}','ff920000-0000-4000-8000-000000000001')$$,'real team parent first assigns the actual reserved member position');
insert into captured values('distribution',pg_temp.fingerprint());
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":null,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000014')$$,'22023','EXPECTED_VERSION_REQUIRED','distribution rejects null captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":0,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000015')$$,'22023','EXPECTED_VERSION_REQUIRED','distribution rejects zero captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":-1,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000016')$$,'22023','EXPECTED_VERSION_REQUIRED','distribution rejects negative captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":"2","member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000017')$$,'22023','EXPECTED_VERSION_REQUIRED','distribution rejects string captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":true,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000018')$$,'22023','EXPECTED_VERSION_REQUIRED','distribution rejects boolean captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":2.5,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000019')$$,'22023','EXPECTED_VERSION_REQUIRED','distribution rejects fractional captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000020')$$,'22023','INVALID_FIELD','distribution rejects an omitted captured allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":1,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000021')$$,'40001','STALE_VERSION','distribution rejects the actual previous allocation version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":2,"member_person_id":"a1000000-0000-4000-8000-000000000001"},{"allocation_id":"ff460000-0000-4000-8000-000000000002","expected_version":null,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000022')$$,'22023','EXPECTED_VERSION_REQUIRED','one missing nested version rolls back the whole distribution including an earlier valid item');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='distribution'),'failed bulk distribution preserves assignment versions members immutable audit command receipts and hours');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":2,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff900000-0000-4000-8000-000000000023')$$,'42501','FORBIDDEN','correct allocation version does not grant a player team parent authority');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='distribution'),'unauthorized allocation changes leave the same full historical fingerprint');
insert into receipts select 'distribution',resource_id,version,event_ids from(select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":2,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff920000-0000-4000-8000-000000000002'))r;
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','ca010000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"ff460000-0000-4000-8000-000000000001","expected_version":2,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','ff920000-0000-4000-8000-000000000002')$$,'correct captured reallocation replays without another assignment');
reset role;select is((select version from app.pwa_allocations where id='ff460000-0000-4000-8000-000000000001'),3::bigint,'real reallocation increments only the chosen position once');
select is((select member_person_id from app.pwa_allocations where id='ff460000-0000-4000-8000-000000000001'),'a1000000-0000-4000-8000-000000000001'::uuid,'readback contains the actual chosen member');
select is((select version from app.teams where id='ca010000-0000-4000-8000-000000000001'),1::bigint,'no team metadata version is forged by the bulk command');
select is((select version from app.pwa_allocations where id='ff460000-0000-4000-8000-000000000002'),1::bigint,'the failed mixed batch leaves its second allocation reserved at version one');
set local role authenticated;select pg_temp.actor('11111111-1111-4111-8111-111111111111');
insert into captured values('policy',pg_temp.fingerprint());
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[null],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000025')$$,'22023','EXPECTED_VERSION_REQUIRED','PWA acceptance rejects a null element in the expected version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[0],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000026')$$,'22023','EXPECTED_VERSION_REQUIRED','PWA acceptance rejects a zero element in the expected version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[-1],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000027')$$,'22023','EXPECTED_VERSION_REQUIRED','PWA acceptance rejects a negative element in the expected version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":["1"],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000028')$$,'22023','EXPECTED_VERSION_REQUIRED','PWA acceptance rejects a string element in the expected version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[true],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000029')$$,'22023','EXPECTED_VERSION_REQUIRED','PWA acceptance rejects a boolean element in the expected version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1.5],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000030')$$,'22023','EXPECTED_VERSION_REQUIRED','PWA acceptance rejects a fractional element in the expected version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000031')$$,'22023','INVALID_COMMAND','PWA acceptance rejects a missing version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":null,"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000032')$$,'22023','INVALID_COMMAND','PWA acceptance rejects a null version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000033')$$,'22023','INVALID_COMMAND','PWA acceptance rejects a empty version vector');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1,1],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000034')$$,'22023','INVALID_COMMAND','PWA acceptance rejects a wrong length version vector');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],null::bigint[],'self',true,'ff930000-0000-4000-8000-000000000001')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects missing canonical vector without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[null::bigint],'self',true,'ff930000-0000-4000-8000-000000000002')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects null canonical element without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000003')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects empty canonical vector without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[1,1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000004')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects wrong canonical length without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[0]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000005')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects zero canonical version without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[-1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000006')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects negative canonical version without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array_fill(1::bigint,array[1],array[0]),'self',true,'ff930000-0000-4000-8000-000000000007')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects canonical lower bound zero without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[[1]]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000008')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects multidimensional canonical vector without a web form');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array_fill('e7530000-0000-4000-8000-000000000001'::uuid,array[1],array[0]),array[1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000009')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects assignment lower bound zero');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array[['e7530000-0000-4000-8000-000000000001'::uuid]],array[1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000010')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects multidimensional assignment IDs');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array[null::uuid],array[1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000011')$$,'22023','EXPLICIT_ACCEPTANCE_REQUIRED','canonical API rejects null assignment ID');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[2],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000035')$$,'40001','STALE_VERSION','PWA policy acceptance still rejects a nonnull stale version');
select throws_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000001'::uuid],array[2]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000012')$$,'40001','STALE_VERSION','canonical policy comparison still rejects an incorrect captured assignment version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001","e7530000-0000-4000-8000-000000000002"],"expected_versions":[1,null],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000036')$$,'22023','EXPECTED_VERSION_REQUIRED','one null version denies an entire multi-person policy vector before any acceptance');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='policy'),'invalid policy vectors preserve exact opened assignments acceptance history rights audits and receipts');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000037')$$,'42501','FORBIDDEN','another parent cannot accept the other adult exact policy despite a correct vector');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}','ff900000-0000-4000-8000-000000000038')$$,'42501','FORBIDDEN','another club native session cannot accept this tenant policy');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='policy'),'cross adult and cross club policy attempts retain the same whole durable history');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}','ff930000-0000-4000-8000-000000000021')$$,'valid PWA vector binds exact document revision independently of assignment version');
select lives_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}','ff930000-0000-4000-8000-000000000021')$$,'same policy command key replays its actual confirmed acceptance');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select lives_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000002'::uuid],array[1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000022')$$,'valid direct canonical API vector confirms only the other parent own exact policy');
select lives_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['e7530000-0000-4000-8000-000000000002'::uuid],array[1]::bigint[],'self',true,'ff930000-0000-4000-8000-000000000022')$$,'direct canonical policy replay does not append another acceptance');
reset role;select is((select count(*)::integer from app.policy_acceptances where policy_version_id='e7510000-0000-4000-8000-000000000001'),2,'both parents own acceptance proofs remain exactly once');
select is((select count(*)::integer from app.policy_assignments where id in('e7530000-0000-4000-8000-000000000001','e7530000-0000-4000-8000-000000000002')and state='accepted'and version=2),2,'only actual valid acceptance increments each assignment version');
select is((select sum(minutes_delta)from app.hour_ledger_entries),60::bigint,'instruction assignment and policy corrections never invent performed ledger credit');
set local role authenticated;select pg_temp.actor('33333333-3333-4333-8333-333333333333');
insert into captured values('global-version-guards',pg_temp.fingerprint());
reset role;
create function pg_temp.every_top_level_version_guard()returns boolean language plpgsql as $$declare a text;begin
 foreach a in array array['cancel_booking','confirm_attendance','confirm_attendance_batch','join_waitlist','express_interest','accept_policy','start_profile','save_club_contact','save_profile','apply_distribution','book_shift','set_team_goal','reserve_cluster','assign_member','set_followup','request_reserve','save_handover_draft','prepare_handover','accept_handover','revoke_handover','save_feedback','prepare_booking','ask_question','answer_question','take_question','create_channel','send_message','mark_inbox_read','mark_all_inbox_read','save_preferences','dismiss_help','reset_help','enroll_course','withdraw_course','rsvp_event','create_card','update_card','check_card_item','reply_card','publish_instructions','open_transfer','accept_transfer','report_obstruction','create_team_task','create_club_task','review_team_credit','publish_team_credit','save_push_subscription','revoke_push_subscription','open_policy']loop
  begin
   perform api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',a,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'{}',gen_random_uuid());
   return false;
  exception when sqlstate '22023' then if sqlerrm<>'INVALID_COMMAND'then return false;end if;end;
 end loop;return true;end;$$;
set local role authenticated;select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select ok(pg_temp.every_top_level_version_guard(),'all 50 public PWA action branches independently reject a null top level version');
select throws_ok($$select * from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm_attendance_batch','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"entries":[{"booking_id":"aa300000-0000-4000-8000-000000000002","expected_version":null,"result":"partial","awarded_minutes":45,"reason":"Do not replace history"}]}','ff900000-0000-4000-8000-000000000040')$$,'22023','INVALID_COMMAND','canonical attendance retains its existing independent null version rejection');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='global-version-guards'),'all null top level guards and the canonical attendance guard preserve ledger audit scope and receipt history');
reset role;
select ok((select bool_and(proowner='cluvo_command_owner'::regrole and prosecdef and provolatile='v'and proconfig=array['search_path=""'])from pg_proc where oid in('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure,'internal.accept_policy_assignments(uuid,uuid[],bigint[],text,boolean,uuid)'::regprocedure)),'both narrowed native functions retain canonical owner definer volatility and empty search path');
select * from finish();
rollback;
