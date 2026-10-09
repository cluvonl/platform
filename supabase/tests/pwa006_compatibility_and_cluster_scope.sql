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

-- SQL unit authority fixtures only: no provider calls, no shared data, rollback.
update auth.users set email_confirmed_at=statement_timestamp() where id in('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,statement_timestamp(),statement_timestamp() from auth.users where email like '%@example.test' on conflict(id) do nothing;
create function pg_temp.actor(p_actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor))::text,true);
end;$$;
create function pg_temp.club_payload(mode text)returns jsonb language sql set search_path='' as $$select jsonb_build_object('season_id','a5000000-0000-4000-8000-000000000001','title','Centrale scopeproef '||mode,'starts_at','2027-04-09 10:00+02','ends_at','2027-04-09 12:00+02','task_type_version_id','a9000000-0000-4000-8000-000000000001','capacity',2,'repeat_count',1,'instructions','Werkelijke clubtaak met expliciete centrale rechten','distribution_mode',mode)||case when mode='public' then '{}'::jsonb else jsonb_build_object('receiving_team_id','ef400000-0000-4000-8000-000000000002','receiving_team_expected_version',1,'self_until','2027-03-01 10:00+01','assign_until','2027-03-15 10:00+01','counts_for_team',true)end;$$;
create function pg_temp.reserve_payload()returns jsonb language sql set search_path='' as $$select '{"season_id":"a5000000-0000-4000-8000-000000000001","title":"Centrale reservering","mode":"assign","position_ids":["aa210000-0000-4000-8000-000000000004"],"self_until":"2027-01-15 12:00+01","assign_until":"2027-01-20 12:00+01","counts_for_team":true}'::jsonb;$$;
-- The canonical tenant trigger seeds task.offer before any publication.
create temporary table receipts(label text primary key,id uuid,version bigint,result jsonb);
grant all on receipts to authenticated;
insert into app.teams(id,tenant_id,name) values
 ('ef400000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Eigen team'),
 ('ef400000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Ontvangend ander team');
select is((select count(*)::integer from app.role_permissions rp join app.permission_roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id where r.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and r.role_key in('board','volunteer_committee') and rp.permission_key='club_cluster.manage'),2,'new tenants seed central club authority for board and volunteers');
select is((select count(*)::integer from app.role_permissions rp join app.permission_roles r on r.tenant_id=rp.tenant_id and r.id=rp.role_id where r.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and r.role_key in('board','volunteer_committee') and rp.permission_key='team_task.manage'),0,'central distribution does not broaden team-task management');
select ok(not has_function_privilege('authenticated','internal.pwa_automation_guard()','EXECUTE'),'volatile automation guard remains private');
select ok(not has_function_privilege('service_role','internal.pwa_automation_guard()','EXECUTE'),'service key cannot call the worker guard');
select is((select provolatile::text from pg_proc where oid='internal.pwa_automation_guard()'::regprocedure),'v','worker guard correctly describes its volatile recovery check');

set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'context'->>'can_manage_club_clusters','false','plain committee coordinator has no central distribution');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'receiving_teams'),0,'plain coordinator receives no receiving-team profile/count scope');
select ok(not exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'reserve_preview')x where (x->>'can_reserve')::boolean),'plain coordinator cannot reserve club positions in readmodel');
insert into receipts select 'public',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('public'),'ef900000-0000-4000-8000-000000000001');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('self'),'ef900000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','plain coordinator cannot atomically create a self-distributed club task');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('assign'),'ef900000-0000-4000-8000-000000000003')$$,'42501','FORBIDDEN','plain coordinator cannot atomically create an assigned club task');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reserve_cluster','ef400000-0000-4000-8000-000000000002',1,pg_temp.reserve_payload(),'ef900000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','plain coordinator cannot reserve an existing club place');
select throws_ok($$select api.pwa_receiving_team_proposals('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001',array['aa210000-0000-4000-8000-000000000004'::uuid])$$,'42501','FORBIDDEN','plain coordinator cannot inspect central household-fit aggregates');
reset role;
select is((select count(*)::integer from app.shifts where title like 'Centrale scopeproef%'),1,'only the authorized public task was persisted');
select is((select count(*)::integer from app.pwa_clusters),0,'denied commands create no cluster');
select is((select count(*)::integer from app.pwa_allocations),0,'denied commands reserve no position');

insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,team_id,granted_by_auth_user_id) select 'ef330000-0000-4000-8000-000000000001',tenant_id,'33333333-3333-4333-8333-333333333333',id,'team','ef400000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='team_parent';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'context'->>'can_manage_club_clusters','false','coordinator plus own-team parent remains noncentral');
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'teams')x where x->>'id'='ef400000-0000-4000-8000-000000000001' and (x->>'can_manage')::boolean),'own-team management remains independently authorized');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','set_team_goal','ef400000-0000-4000-8000-000000000001',0,'{"season_id":"a5000000-0000-4000-8000-000000000001","member_person_id":null,"goal":2,"reason":"Werkelijke teamdoelproef"}','ef900000-0000-4000-8000-000000000005')$$,'own-team parent can still set its real team goal');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('assign'),'ef900000-0000-4000-8000-000000000006')$$,'42501','FORBIDDEN','hybrid coordinator/team parent cannot distribute club tasks');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reserve_cluster','ef400000-0000-4000-8000-000000000001',1,pg_temp.reserve_payload(),'ef900000-0000-4000-8000-000000000007')$$,'42501','FORBIDDEN','hybrid coordinator/team parent cannot reserve club places even for its own team');
reset role;
select is((select count(*)::integer from app.pwa_clusters),0,'hybrid denials create zero clusters');
select is((select count(*)::integer from app.pwa_allocations),0,'hybrid denials reserve zero positions');
update app.access_grants set revoked_at=statement_timestamp() where id='ef330000-0000-4000-8000-000000000001';
insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) select 'ef330000-0000-4000-8000-000000000002',tenant_id,'33333333-3333-4333-8333-333333333333',id,'tenant','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='board';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'context'->>'can_manage_club_clusters','true','actual board tenant grant enables central distribution');
select ok(not exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'receiving_teams')x where (x->>'can_manage')::boolean),'central receiving capability does not imply managing another team');
select is(jsonb_array_length(api.pwa_receiving_team_proposals('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001',array['aa210000-0000-4000-8000-000000000004'::uuid])->'teams'),2,'central native grant can preview real receiving teams');
insert into receipts select 'board-reserved',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('assign'),'ef900000-0000-4000-8000-000000000008');
insert into receipts select 'board-cluster',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reserve_cluster','ef400000-0000-4000-8000-000000000002',1,pg_temp.reserve_payload(),'ef900000-0000-4000-8000-000000000009');
reset role;
select is((select count(*)::integer from app.pwa_clusters),2,'central board commands persist both concrete clusters');
select is((select count(*)::integer from app.pwa_allocations),3,'central creation and existing reservation atomically reserve three actual positions');
select is((select count(*)::integer from app.pwa_clusters where team_id='ef400000-0000-4000-8000-000000000002'),2,'central authority can receive club work without a team-parent grant');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select ok(not exists(select 1 from api.list_shift_market('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')m where m.shift_id=(select id from receipts where label='board-reserved')),'central reserved creation never exposes a public booking window');
select throws_ok($$select api.pwa_snapshot('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501','FORBIDDEN','central catalogue adds no cross-tenant actor access');
insert into receipts select 'question',resource_id,version,result from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ask_question','a3000000-0000-4000-8000-000000000001',1,'{"subject":"Eigen praktische vraag","body":"Mijn eigen vraag krijgt een werkelijk antwoord","booking_id":null}','ef900000-0000-4000-8000-000000000010');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','answer_question',(select id from receipts where label='question'),1,'{"answer":"Niet bevoegd"}','ef900000-0000-4000-8000-000000000011')$$,'42501','FORBIDDEN','central club authority alone cannot answer a private household question');
reset role;
update app.access_grants set revoked_at=statement_timestamp() where id='ef330000-0000-4000-8000-000000000002';
insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) select 'ef330000-0000-4000-8000-000000000003',tenant_id,'33333333-3333-4333-8333-333333333333',id,'tenant','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='volunteer_committee';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'context'->>'can_manage_club_clusters','true','actual volunteer committee tenant grant also enables central distribution');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('self'),'ef900000-0000-4000-8000-000000000012')$$,'central volunteers can create real self-distributed club work');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','answer_question',(select id from receipts where label='question'),0,'{"answer":"Een werkelijk antwoord"}','ef900000-0000-4000-8000-000000000013')$$,'40001','STALE_VERSION','answer checks the exact private question version');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','answer_question',(select id from receipts where label='question'),1,'{"answer":"Een werkelijk antwoord"}','ef900000-0000-4000-8000-000000000014')$$,'native reviewer answers using the typed question-recipient query');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','answer_question',(select id from receipts where label='question'),1,'{"answer":"Een werkelijk antwoord"}','ef900000-0000-4000-8000-000000000014')$$,'same answer key replays its acknowledged result');
reset role;
select is((select count(*)::integer from app.pwa_notifications n join app.domain_events e on e.tenant_id=n.tenant_id and e.id=n.event_id where e.event_type='pwa.answer_question' and n.recipient_person_id='a1000000-0000-4000-8000-000000000001'),1,'one durable answer notification is addressed to the actual question owner');
select is((select count(*)::integer from app.pwa_question_history where question_id=(select id from receipts where label='question')),2,'question open and answered states append once despite replay');
select ok(not exists(select 1 from app.pwa_notifications n join app.domain_events e on e.tenant_id=n.tenant_id and e.id=n.event_id where e.event_type='pwa.answer_question' and n.recipient_person_id='a1000000-0000-4000-8000-000000000002'),'another parent receives no private answer notification');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select ok(exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'questions')q where q->>'id'=(select id::text from receipts where label='question') and q->>'answer'='Een werkelijk antwoord' and jsonb_array_length(q->'history')=2),'owner reads exact answer and append-only question history');
select is((select count(*)::integer from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'inbox')i where i->>'title'='Antwoord op je vraag' and i->>'source_path'='/app/actions?question='||(select id::text from receipts where label='question')),1,'owner native inbox reads exactly one actual question deep link');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select ok(not exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'questions')q where q->>'id'=(select id::text from receipts where label='question')),'shared household progress grant does not reveal another person private question');
select ok(not exists(select 1 from jsonb_array_elements(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'inbox')i where i->>'title'='Antwoord op je vraag'),'another native account inbox excludes the private answer');
reset role;
update app.access_grants set revoked_at=statement_timestamp() where id='a3300000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'receiving_teams'),0,'central authority still requires an actual source-committee manage grant');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','create_club_task','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,pg_temp.club_payload('self'),'ef900000-0000-4000-8000-000000000015')$$,'42501','FORBIDDEN','central distribution cannot replace revoked source-committee planning authority');
reset role;
select * from finish();
rollback;
