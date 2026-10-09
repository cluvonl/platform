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

-- Exact policy identities are synthetic and remain in this rollback-only DB.
insert into app.persons(id,tenant_id,given_name,family_name,birth_date,birth_date_precision)values('f1440000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Ander','Kind','2012-03-01','day');
insert into app.households(id,tenant_id,label,intake_code_hash)values('f1440000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Afzonderlijk synthetisch huishouden',extensions.digest('owned-foreign-hh','sha256'));
insert into app.household_person_links(tenant_id,household_id,person_id,kind,verified_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1440000-0000-4000-8000-000000000002','f1440000-0000-4000-8000-000000000001','member','33333333-3333-4333-8333-333333333333');
insert into app.policy_documents(id,tenant_id,document_key,title,current_revision,status)values
 ('f1400000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned-club-policy','Vastgestelde clubafspraken',4,'active'),
 ('f1400000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned-conduct-policy','Gedragsregels voor leden',7,'active'),
 ('f1400000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned-retired-policy','Historische afspraken',2,'archived'),
 ('f1400000-0000-4000-8000-000000000004','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owned-private-foreign-policy','Andere club privébeleid',1,'active');
insert into app.policy_versions(id,tenant_id,document_id,revision,exact_body,body_hash,state,approved_by_auth_user_id,approved_at,published_at,created_by_auth_user_id)values
 ('f1410000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1400000-0000-4000-8000-000000000001',3,'Exact toegewezen clubtekst revisie drie',extensions.digest('Exact toegewezen clubtekst revisie drie','sha256'),'published','33333333-3333-4333-8333-333333333333',statement_timestamp(),statement_timestamp(),'33333333-3333-4333-8333-333333333333'),
 ('f1410000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1400000-0000-4000-8000-000000000001',4,'UNASSIGNED_DRAFT_CANARY',extensions.digest('UNASSIGNED_DRAFT_CANARY','sha256'),'draft',null,null,null,'33333333-3333-4333-8333-333333333333'),
 ('f1410000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1400000-0000-4000-8000-000000000002',7,'Exact toegewezen gedragstekst revisie zeven',extensions.digest('Exact toegewezen gedragstekst revisie zeven','sha256'),'published','33333333-3333-4333-8333-333333333333',statement_timestamp(),statement_timestamp(),'33333333-3333-4333-8333-333333333333'),
 ('f1410000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1400000-0000-4000-8000-000000000003',2,'Exact historische tekst blijft leesbaar',extensions.digest('Exact historische tekst blijft leesbaar','sha256'),'retired','33333333-3333-4333-8333-333333333333',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333'),
 ('f1410000-0000-4000-8000-000000000005','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f1400000-0000-4000-8000-000000000004',1,'FOREIGN_TENANT_CANARY',extensions.digest('FOREIGN_TENANT_CANARY','sha256'),'published','44444444-4444-4444-8444-444444444444',statement_timestamp(),statement_timestamp(),'44444444-4444-4444-8444-444444444444');
insert into app.policy_audiences(id,tenant_id,policy_version_id,audience_key,criteria_snapshot,approved_by_auth_user_id)select ('f1420000-0000-4000-8000-'||right(id::text,12))::uuid,tenant_id,id,'owned','{}',created_by_auth_user_id from app.policy_versions where id::text like 'f141%' and state<>'draft';
insert into app.policy_assignments(id,tenant_id,policy_version_id,audience_id,member_person_id,state,opened_at,version)values
 ('f1430000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000001','f1420000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','offered',null,5),
 ('f1430000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000001','f1420000-0000-4000-8000-000000000001','ca020000-0000-4000-8000-000000000001','offered',null,1),
 ('f1430000-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000001','f1420000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','offered',null,1),
 ('f1430000-0000-4000-8000-000000000004','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000003','f1420000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','offered',null,2),
 ('f1430000-0000-4000-8000-000000000005','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000004','f1420000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','opened',statement_timestamp()-interval '1 day',3),
 ('f1430000-0000-4000-8000-000000000006','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000001','f1420000-0000-4000-8000-000000000001','f1440000-0000-4000-8000-000000000001','offered',null,1),
 ('f1430000-0000-4000-8000-000000000007','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','f1410000-0000-4000-8000-000000000005','f1420000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000001','offered',null,1),
 ('f1430000-0000-4000-8000-000000000008','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1410000-0000-4000-8000-000000000003','f1420000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000002','offered',null,4);
insert into app.guardian_authorizations(id,tenant_id,guardian_person_id,represented_member_id,scope,valid_from,verified_by_auth_user_id)values('f1450000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','ca020000-0000-4000-8000-000000000001','policy_acceptance',statement_timestamp()-interval '1 day','33333333-3333-4333-8333-333333333333');
create temporary table captured(label text primary key,fingerprint text);
create temporary table results(label text primary key,receipt jsonb);
grant all on captured,results to authenticated;
create function pg_temp.key(n integer)returns uuid language sql immutable as $$select('f1490000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;$$;
create function pg_temp.policy_payload(ids uuid[],versions bigint[],capacity text default null)returns jsonb language sql immutable as $$select jsonb_build_object('assignment_ids',ids,'expected_versions',versions)||case when capacity is null then '{}'::jsonb else jsonb_build_object('capacity',capacity,'explicit_confirmation',true)end;$$;
create function pg_temp.command(n integer,action text,payload jsonb,resource uuid default 'f1410000-0000-4000-8000-000000000001',revision bigint default 3)returns jsonb language sql as $$select to_jsonb(c)from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',action,resource,revision,payload,pg_temp.key(n))c;$$;
create function pg_temp.fingerprint()returns text language sql security definer set search_path='' as $$select encode(extensions.digest(convert_to(jsonb_build_object(
 'documents',(select jsonb_agg(to_jsonb(x)order by id)from app.policy_documents x),
 'versions',(select jsonb_agg(to_jsonb(x)order by id)from app.policy_versions x),
 'assignments',(select jsonb_agg(to_jsonb(x)order by id)from app.policy_assignments x),
 'acceptances',(select jsonb_agg(to_jsonb(x)order by id)from app.policy_acceptances x),
 'policy_events',(select jsonb_agg(to_jsonb(x)order by id)from app.policy_assignment_events x),
 'domain',(select jsonb_agg(to_jsonb(x)order by id)from app.domain_events x),
 'audit',(select jsonb_agg(to_jsonb(x)order by id)from app.audit_events x),
 'keys',(select jsonb_agg(to_jsonb(x)order by id)from app.idempotency_records x),
 'ledger',(select jsonb_agg(to_jsonb(x)order by id)from app.hour_ledger_entries x),
 'notifications',(select jsonb_agg(to_jsonb(x)order by id)from app.pwa_notifications x)
 )::text,'UTF8'),'sha256'),'hex');$$;
-- PWA_POLICY_IDENTITY_FIXTURE_READY
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from api.pwa_policy_assignments),4,'own actor sees own three exact documents plus the explicitly authorized child assignment');
select is((select policy_document_title from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),'Vastgestelde clubafspraken','assigned club document title is canonical');
select is((select policy_document_id::text from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000004'),'f1400000-0000-4000-8000-000000000002','second document retains a distinct exact identity');
select is((select policy_document_title from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000004'),'Gedragsregels voor leden','multiple document titles are distinct rather than a generic policy label');
select is((select policy_revision from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),3,'assigned policy revision is not latest document revision four');
select is((select version from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),5::bigint,'assignment expected version remains distinct from document revision');
select is((select exact_body from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),'Exact toegewezen clubtekst revisie drie','body follows assigned historical version rather than unassigned draft');
select ok(not exists(select 1 from api.pwa_policy_assignments where exact_body like '%CANARY%'),'unassigned draft and foreign club canaries are absent');
select ok((select published_at is not null and can_accept from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),'published own offered assignment exposes actual native acceptance capability');
select ok((select can_accept from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),'explicit verified guardian has actual child acceptance capability');
select is((select exact_body from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000005'),'Exact historische tekst blijft leesbaar','retired assigned exact body remains readable');
select ok(not(select can_accept from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000005'),'retired historical assignment remains read only');
select is((select count(*)::integer from api.pwa_policy_assignments where id in('f1430000-0000-4000-8000-000000000003','f1430000-0000-4000-8000-000000000006','f1430000-0000-4000-8000-000000000007')),0,'same household other adult and foreign household or tenant assignments remain private');
insert into captured values('negative-start',pg_temp.fingerprint());
select throws_ok($$select api.record_policy_open('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1430000-0000-4000-8000-000000000001',null,pg_temp.key(800))$$,'22023','EXPECTED_VERSION_REQUIRED','direct canonical read registration rejects missing expected version');
select throws_ok($$select api.record_policy_open('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1430000-0000-4000-8000-000000000001',0,pg_temp.key(800))$$,'22023','EXPECTED_VERSION_REQUIRED','direct canonical read registration rejects zero expected version');
select throws_ok($$select api.record_policy_open('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1430000-0000-4000-8000-000000000001',-1,pg_temp.key(800))$$,'22023','EXPECTED_VERSION_REQUIRED','direct canonical read registration rejects negative expected version');
select throws_ok($$select pg_temp.command(1,'open_policy','{}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects missing vectors in the native API');
select throws_ok($$select pg_temp.command(2,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":null}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects null vector in the native API');
select throws_ok($$select pg_temp.command(3,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[]}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects empty vector in the native API');
select throws_ok($$select pg_temp.command(4,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5,5]}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects wrong length vector in the native API');
select throws_ok($$select pg_temp.command(5,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[null]}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','open_policy rejects null element in the native API');
select throws_ok($$select pg_temp.command(6,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[0]}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','open_policy rejects zero element in the native API');
select throws_ok($$select pg_temp.command(7,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[-1]}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','open_policy rejects negative element in the native API');
select throws_ok($$select pg_temp.command(8,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":["5"]}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','open_policy rejects string element in the native API');
select throws_ok($$select pg_temp.command(9,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[true]}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','open_policy rejects boolean element in the native API');
select throws_ok($$select pg_temp.command(10,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5.5]}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','open_policy rejects fractional element in the native API');
select throws_ok($$select pg_temp.command(11,'open_policy','{"assignment_ids":[null],"expected_versions":[5]}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects null assignment in the native API');
select throws_ok($$select pg_temp.command(12,'open_policy','{"assignment_ids":[true],"expected_versions":[5]}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects boolean assignment in the native API');
select throws_ok($$select pg_temp.command(13,'open_policy','{"assignment_ids":["wrong"],"expected_versions":[5]}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects malformed assignment in the native API');
select throws_ok($$select pg_temp.command(14,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000001"],"expected_versions":[5,5]}'::jsonb)$$,'22023','INVALID_COMMAND','open_policy rejects duplicate assignments in the native API');
select throws_ok($$select pg_temp.command(15,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb,'f1400000-0000-4000-8000-000000000001'::uuid,3)$$,'40001','POLICY_VERSION_CHANGED','open_policy rejects document ID instead of assigned text version');
select throws_ok($$select pg_temp.command(16,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb,'f1410000-0000-4000-8000-000000000002'::uuid,4)$$,'40001','POLICY_VERSION_CHANGED','open_policy rejects latest unassigned draft');
select throws_ok($$select pg_temp.command(17,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb,'f1410000-0000-4000-8000-000000000001'::uuid,5)$$,'40001','POLICY_VERSION_CHANGED','open_policy rejects assignment version instead of policy revision');
select throws_ok($$select pg_temp.command(18,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb,'f1410000-0000-4000-8000-000000000001'::uuid,0)$$,'40001','POLICY_VERSION_CHANGED','open_policy rejects zero document revision');
select throws_ok($$select pg_temp.command(19,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000004"],"expected_versions":[5,2]}'::jsonb)$$,'40001','POLICY_VERSION_CHANGED','open_policy cannot bind two distinct text versions to one body identity');
select throws_ok($$select pg_temp.command(20,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000003"],"expected_versions":[1]}'::jsonb)$$,'42501','FORBIDDEN','open_policy cannot act for the other adult despite shared household access');
select throws_ok($$select pg_temp.command(21,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000006"],"expected_versions":[1]}'::jsonb)$$,'42501','FORBIDDEN','open_policy cannot act for another household child');
select throws_ok($$select pg_temp.command(22,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000007"],"expected_versions":[1]}'::jsonb)$$,'42501','FORBIDDEN','open_policy cannot bind an assignment from another tenant');
select throws_ok($$select pg_temp.command(23,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[4]}'::jsonb)$$,'40001','STALE_VERSION','open_policy checks captured assignment version independently of body revision');
select throws_ok($$select pg_temp.command(24,'accept_policy','{"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects missing vectors in the native API');
select throws_ok($$select pg_temp.command(25,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":null,"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects null vector in the native API');
select throws_ok($$select pg_temp.command(26,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects empty vector in the native API');
select throws_ok($$select pg_temp.command(27,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5,5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects wrong length vector in the native API');
select throws_ok($$select pg_temp.command(28,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[null],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','accept_policy rejects null element in the native API');
select throws_ok($$select pg_temp.command(29,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[0],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','accept_policy rejects zero element in the native API');
select throws_ok($$select pg_temp.command(30,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[-1],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','accept_policy rejects negative element in the native API');
select throws_ok($$select pg_temp.command(31,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":["5"],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','accept_policy rejects string element in the native API');
select throws_ok($$select pg_temp.command(32,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[true],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','accept_policy rejects boolean element in the native API');
select throws_ok($$select pg_temp.command(33,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5.5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','EXPECTED_VERSION_REQUIRED','accept_policy rejects fractional element in the native API');
select throws_ok($$select pg_temp.command(34,'accept_policy','{"assignment_ids":[null],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects null assignment in the native API');
select throws_ok($$select pg_temp.command(35,'accept_policy','{"assignment_ids":[true],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects boolean assignment in the native API');
select throws_ok($$select pg_temp.command(36,'accept_policy','{"assignment_ids":["wrong"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects malformed assignment in the native API');
select throws_ok($$select pg_temp.command(37,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000001"],"expected_versions":[5,5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'22023','INVALID_COMMAND','accept_policy rejects duplicate assignments in the native API');
select throws_ok($$select pg_temp.command(38,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb,'f1400000-0000-4000-8000-000000000001'::uuid,3)$$,'40001','POLICY_VERSION_CHANGED','accept_policy rejects document ID instead of assigned text version');
select throws_ok($$select pg_temp.command(39,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb,'f1410000-0000-4000-8000-000000000002'::uuid,4)$$,'40001','POLICY_VERSION_CHANGED','accept_policy rejects latest unassigned draft');
select throws_ok($$select pg_temp.command(40,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb,'f1410000-0000-4000-8000-000000000001'::uuid,5)$$,'40001','POLICY_VERSION_CHANGED','accept_policy rejects assignment version instead of policy revision');
select throws_ok($$select pg_temp.command(41,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb,'f1410000-0000-4000-8000-000000000001'::uuid,0)$$,'40001','POLICY_VERSION_CHANGED','accept_policy rejects zero document revision');
select throws_ok($$select pg_temp.command(42,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000004"],"expected_versions":[5,2],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'40001','POLICY_VERSION_CHANGED','accept_policy cannot bind two distinct text versions to one body identity');
select throws_ok($$select pg_temp.command(43,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000003"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'42501','FORBIDDEN','accept_policy cannot act for the other adult despite shared household access');
select throws_ok($$select pg_temp.command(44,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000006"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'42501','FORBIDDEN','accept_policy cannot act for another household child');
select throws_ok($$select pg_temp.command(45,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000007"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'42501','FORBIDDEN','accept_policy cannot bind an assignment from another tenant');
select throws_ok($$select pg_temp.command(46,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[4],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'40001','STALE_VERSION','accept_policy checks captured assignment version independently of body revision');
select throws_ok($$select pg_temp.command(47,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'55000','POLICY_MUST_BE_OPENED','acceptance cannot automatically mark a merely offered document as opened');
select throws_ok($$select pg_temp.command(48,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000002"],"expected_versions":[5,99]}'::jsonb)$$,'40001','STALE_VERSION','one stale selected child rolls back an earlier valid first read atomically');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='negative-start'),'all invalid identity and typed version attempts preserve data history receipts audit notifications and ledger');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is((select count(*)::integer from api.pwa_policy_assignments),7,'follow up actor reads only the seven authorized tenant assignments');
select ok(not exists(select 1 from api.pwa_policy_assignments where can_accept or is_actor_subject),'oversight read authority grants neither a represented subject nor acceptance capability for other members');
select throws_ok($$select pg_temp.command(49,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb)$$,'42501','FORBIDDEN','follow up cannot open another adult text without a native mandate');
select throws_ok($$select pg_temp.command(50,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'42501','FORBIDDEN','follow up cannot accept another adult text without a native mandate');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from api.pwa_policy_assignments),2,'second parent reads only its own two documents');
select throws_ok($$select pg_temp.command(51,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000002"],"expected_versions":[1]}'::jsonb)$$,'42501','FORBIDDEN','household parent access alone cannot open the child policy');
select pg_temp.actor('44444444-4444-4444-8444-444444444444');
select is((select count(*)::integer from api.pwa_policy_assignments),1,'other club actor reads only its own policy identity');
select is((select count(*)::integer from api.pwa_policy_assignments where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'native foreign club actor sees zero assignments for tenant A');
select throws_ok($$select pg_temp.command(52,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb)$$,'42501','FORBIDDEN','other tenant native session cannot open this club document');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='negative-start'),'oversight household and tenant authorization failures leave immutable history intact');
reset role;update app.guardian_authorizations set revoked_at=statement_timestamp()where id='f1450000-0000-4000-8000-000000000001';set local role authenticated;
select is((select count(*)::integer from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),0,'revoked guardian mandate hides the child assignment');
select throws_ok($$select pg_temp.command(53,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000002"],"expected_versions":[1]}'::jsonb)$$,'42501','FORBIDDEN','revoked guardian cannot open the child document');
reset role;update app.guardian_authorizations set revoked_at=null,valid_until=statement_timestamp()-interval '1 hour'where id='f1450000-0000-4000-8000-000000000001';set local role authenticated;
select is((select count(*)::integer from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),0,'expired guardian mandate hides the child assignment');
reset role;insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)select 'f1460000-0000-4000-8000-000000000001',tenant_id,'11111111-1111-4111-8111-111111111111',id,'tenant','33333333-3333-4333-8333-333333333333'from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and role_key='volunteer_committee';set local role authenticated;
select ok(not(select can_accept from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),'oversight may read an expired guardian assignment but cannot act');
select throws_ok($$select pg_temp.command(54,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000002"],"expected_versions":[1]}'::jsonb)$$,'42501','FORBIDDEN','separate follow up authority cannot replace expired guardian authority');
reset role;update app.guardian_authorizations set revoked_at=statement_timestamp(),valid_until=null where id='f1450000-0000-4000-8000-000000000001';set local role authenticated;
select ok(not(select can_accept from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),'oversight plus revoked guardian remains read only');
reset role;delete from app.access_grants where id='f1460000-0000-4000-8000-000000000001';update app.guardian_authorizations set revoked_at=null,valid_until=null where id='f1450000-0000-4000-8000-000000000001';update auth.users set email_confirmed_at=null where id='11111111-1111-4111-8111-111111111111';set local role authenticated;
select is((select count(*)::integer from api.pwa_policy_assignments),0,'unconfirmed native account cannot read policy data');
select throws_ok($$select pg_temp.command(55,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb)$$,'42501','FORBIDDEN','unconfirmed native account cannot open a document');
reset role;update auth.users set email_confirmed_at=statement_timestamp()where id='11111111-1111-4111-8111-111111111111';update auth.sessions set not_after=statement_timestamp()-interval '1 second'where id='11111111-1111-4111-8111-111111111111';set local role authenticated;
select is((select count(*)::integer from api.pwa_policy_assignments),0,'expired native session cannot read policy identity');
select throws_ok($$select pg_temp.command(56,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[5]}'::jsonb)$$,'42501','FORBIDDEN','expired native session cannot mark reading');
reset role;update auth.sessions set not_after=null where id='11111111-1111-4111-8111-111111111111';set local role authenticated;
reset role;update app.policy_assignments set state='expired',opened_at=statement_timestamp()where id='f1430000-0000-4000-8000-000000000004';set local role authenticated;insert into captured values('expired-before',pg_temp.fingerprint());
select ok((select is_actor_subject and not can_accept and exact_body='Exact toegewezen gedragstekst revisie zeven'from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000004'),'expired own exact text remains readable with actual subject identity');
select throws_ok($$select pg_temp.command(190,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000004"],"expected_versions":[2]}'::jsonb,'f1410000-0000-4000-8000-000000000003'::uuid,7)$$,'55000','POLICY_NOT_OPENABLE','expired exact text cannot produce a new PWA read acknowledgement');
select throws_ok($$select pg_temp.command(191,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000005"],"expected_versions":[3]}'::jsonb,'f1410000-0000-4000-8000-000000000004'::uuid,2)$$,'55000','POLICY_NOT_PUBLISHED','retired historical text cannot produce a new PWA read acknowledgement');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='expired-before'),'expired and retired read-status failures preserve history receipts audit and notifications');
reset role;update app.policy_assignments set state='offered',opened_at=null where id='f1430000-0000-4000-8000-000000000004';set local role authenticated;
select lives_ok($$select api.record_policy_open('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1430000-0000-4000-8000-000000000004',2,pg_temp.key(192))$$,'direct canonical API retains actual correctly versioned reading without acceptance');
select lives_ok($$select api.record_policy_open('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','f1430000-0000-4000-8000-000000000004',2,pg_temp.key(192))$$,'direct canonical reading replays its actual original captured version');
select is((select version from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000004'),3::bigint,'direct canonical read increments the actual assignment once');
select lives_ok($$select api.pwa_prepare_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.key(200),'open_policy','f1410000-0000-4000-8000-000000000001',3,repeat('a',64))$$,'durable native intent accepts the explicit open action without storing policy payload');
insert into results select 'own-open',pg_temp.command(200,'open_policy',pg_temp.policy_payload(array['f1430000-0000-4000-8000-000000000001'::uuid],array[5]::bigint[]));
select is((select state from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),'opened','actual document click opens the own offered assignment');
select is((select version from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),6::bigint,'opening increments actual assignment version once while body revision remains three');
reset role;
select is((select count(*)::integer from app.policy_acceptances),0,'opening alone creates no acceptance');
select is((select count(*)::integer from app.policy_assignment_events where assignment_id='f1430000-0000-4000-8000-000000000001'and event_type='opened'),1,'native opening appends one actual assignment history event');
select is((select count(*)::integer from app.pwa_notifications),0,'policy read acknowledgement creates no own inbox or provider notification');
set local role authenticated;insert into results select 'own-open-replay',pg_temp.command(200,'open_policy',pg_temp.policy_payload(array['f1430000-0000-4000-8000-000000000001'::uuid],array[5]::bigint[]));
select is((select receipt from results where label='own-open'),(select receipt from results where label='own-open-replay'),'identical open key replays the original assignment receipt after its version changed');
select is((api.pwa_command_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pg_temp.key(200))->>'status'),'confirmed','native receipt resolves the actual opening command as confirmed');
select lives_ok($$select pg_temp.command(201,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000002"],"expected_versions":[6,1]}'::jsonb)$$,'opening a mixed already read and new guardian vector records only actual new reads');
select is((select version from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),6::bigint,'reopening does not invent an assignment version increment');
select is((select state from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),'opened','explicit verified guardian actually opens the selected child text');
select is((select version from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000002'),2::bigint,'new child read obtains its actual next assignment version');
reset role;
select is((select count(*)::integer from app.policy_acceptances),0,'overlapping read vector still creates no adult or child acceptance');
select is((select count(*)::integer from app.policy_assignment_events where event_type='opened'),3,'three actual first reads have three canonical immutable history events');
set local role authenticated;insert into captured values('opened-before-negatives',pg_temp.fingerprint());
select throws_ok($$select pg_temp.command(202,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000002"],"expected_versions":[6,1]}'::jsonb)$$,'40001','STALE_VERSION','another key cannot silently upgrade the old child assignment version');
select throws_ok($$select pg_temp.command(203,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001","f1430000-0000-4000-8000-000000000002"],"expected_versions":[6,2],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'42501','FORBIDDEN','self capacity cannot silently accept a child alongside an adult');
select throws_ok($$select pg_temp.command(204,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[6],"capacity":"self","explicit_confirmation":true}'::jsonb,'f1410000-0000-4000-8000-000000000003'::uuid,7)$$,'40001','POLICY_VERSION_CHANGED','wrong visible document identity cannot accept a correctly versioned opened assignment');
select is(pg_temp.fingerprint(),(select fingerprint from captured where label='opened-before-negatives'),'stale read mixed capacity and wrong body failures preserve opened history atomically');
select lives_ok($$select pg_temp.command(205,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[6],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'explicit own acceptance binds body revision three and assignment version six');
select lives_ok($$select pg_temp.command(205,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[6],"capacity":"self","explicit_confirmation":true}'::jsonb)$$,'same exact acceptance key replays without duplicate history');
select lives_ok($$select pg_temp.command(206,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000002"],"expected_versions":[2],"capacity":"guardian","explicit_confirmation":true}'::jsonb)$$,'verified guardian separately accepts the already opened child exact body');
reset role;
select is((select count(*)::integer from app.policy_acceptances),2,'own and verified child acceptance produce exactly two records');
select ok((select bool_and(policy_version_id='f1410000-0000-4000-8000-000000000001'::uuid and version_hash=extensions.digest('Exact toegewezen clubtekst revisie drie','sha256'))from app.policy_acceptances),'accepted immutable hashes refer to the exact assigned body');
select is((select sum(minutes_delta)::integer from app.hour_ledger_entries),60,'opening and acceptance never fabricate hour credits');
set local role authenticated;
select ok((select is_actor_subject and not can_accept from api.pwa_policy_assignments where id='f1430000-0000-4000-8000-000000000001'),'accepted own assignment retains actual subject identity and is exposed read only');
select throws_ok($$select pg_temp.command(207,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000001"],"expected_versions":[7]}'::jsonb)$$,'55000','ALREADY_ACCEPTED','accepted exact body cannot be rewritten as a new read acknowledgement');
select throws_ok($$select pg_temp.command(208,'accept_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000005"],"expected_versions":[3],"capacity":"self","explicit_confirmation":true}'::jsonb,'f1410000-0000-4000-8000-000000000004'::uuid,2)$$,'55000','POLICY_NOT_PUBLISHED','retired assigned exact text remains readable but cannot be newly accepted');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select lives_ok($$select pg_temp.command(209,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000003"],"expected_versions":[1]}'::jsonb)$$,'second parent explicitly opens its own club policy');
select lives_ok($$select pg_temp.command(210,'open_policy','{"assignment_ids":["f1430000-0000-4000-8000-000000000008"],"expected_versions":[4]}'::jsonb,'f1410000-0000-4000-8000-000000000003'::uuid,7)$$,'second parent separately opens its own other exact document');
select lives_ok($$select api.accept_policy_assignments('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',array['f1430000-0000-4000-8000-000000000003'::uuid,'f1430000-0000-4000-8000-000000000008'::uuid],array[2,5]::bigint[],'self',true,pg_temp.key(211))$$,'unchanged canonical batch intentionally accepts multiple exact document versions');
reset role;
select is((select count(*)::integer from app.policy_acceptances),4,'native batch retains two-document behavior without changing PWA exact body guard');
select is((select count(*)::integer from app.domain_events where event_type='pwa.open_policy'and aggregate_type='pwa_command'and aggregate_id=id),4,'different readers and overlapping opens have distinct actual command event identities');
select is((select count(*)::integer from app.pwa_notifications),2,'only two PWA acceptances notify while all four PWA read acknowledgements remain silent');
select ok((select reloptions@>array['security_invoker=true']from pg_class where oid='api.pwa_policy_assignments'::regclass),'policy identity projection uses native invoker RLS');
select is((select count(*)::integer from information_schema.columns where table_schema='api'and table_name='pwa_policy_assignments'),19,'projection appends five identity and capability columns to the fourteen existing fields');
select ok(not exists(select 1 from information_schema.columns where table_schema='api'and table_name='pwa_policy_assignments'and column_name ~'(auth_user_id|actor_person_id|created_by|approved_by)'),'projection exposes no Auth or reviewer identifiers');
select ok(not has_function_privilege('authenticated','internal.can_person_act_on_policy_assignment(uuid,uuid,uuid)','EXECUTE'),'private arbitrary-person action helper remains unavailable to JWT roles');
select ok(has_function_privilege('authenticated','internal.pwa_can_accept_policy(uuid,uuid)','EXECUTE')and not has_function_privilege('anon','internal.pwa_can_accept_policy(uuid,uuid)','EXECUTE')and not has_function_privilege('service_role','internal.pwa_can_accept_policy(uuid,uuid)','EXECUTE'),'minimal current actor capability wrapper is available only to authenticated');
select ok((select proowner='cluvo_command_owner'::regrole and prosecdef and proconfig=array['search_path=""']from pg_proc where oid='internal.pwa_can_accept_policy(uuid,uuid)'::regprocedure),'current actor helper preserves native command owner and empty search path');
select ok(not has_table_privilege('authenticated','api.pwa_policy_assignments','INSERT,UPDATE,DELETE')and not has_table_privilege('anon','api.pwa_policy_assignments','SELECT')and not has_table_privilege('service_role','api.pwa_policy_assignments','SELECT'),'new policy view grants no writes or anonymous service read shortcut');
select ok((select bool_and(relrowsecurity and relforcerowsecurity)from pg_class where oid in('app.policy_assignments'::regclass,'app.policy_versions'::regclass,'app.policy_documents'::regclass)),'all underlying policy tables retain forced RLS');
set local role authenticated;
select throws_ok($$update app.policy_assignments set state='opened',opened_at=statement_timestamp()where id='f1430000-0000-4000-8000-000000000004'$$,'42501','permission denied for table policy_assignments','JWT actor cannot write policy read status directly');
reset role;select * from finish();rollback;
