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

-- Rollback-only SQL unit sessions, never a hosted-provider claim.
update auth.users set email_confirmed_at=statement_timestamp() where id in('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444');
insert into auth.sessions(id,user_id,created_at,updated_at) select id,id,statement_timestamp(),statement_timestamp() from auth.users where email like '%@example.test' on conflict(id) do nothing;
create function pg_temp.actor(p_actor uuid)returns void language plpgsql security definer set search_path='' as $$begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_actor,'role','authenticated','email',(select email from auth.users where id=p_actor))::text,true);
end;$$;
create temporary table receipts(label text primary key,id uuid,version bigint,event_ids uuid[]);
grant all on receipts to authenticated;
-- Two genuine independent past executions, with their canonical snapshots.
insert into app.shifts(id,tenant_id,type_version_id,committee_id,category_id,title,starts_at,ends_at,credit_minutes,cancellation_minutes,state,published_at) values
 ('e7200000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Eerste batchuitvoering','2026-09-14 10:00+02','2026-09-14 12:00+02',120,2880,'published',statement_timestamp()),
 ('e7200000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','Tweede batchuitvoering','2026-09-15 10:00+02','2026-09-15 12:00+02',120,2880,'published',statement_timestamp());
insert into app.shift_positions(id,tenant_id,shift_id,ordinal,starts_at,ends_at)select ('e7210000-0000-4000-8000-'||right(id::text,12))::uuid,tenant_id,id,1,starts_at,ends_at from app.shifts where id in('e7200000-0000-4000-8000-000000000001','e7200000-0000-4000-8000-000000000002');
insert into app.bookings(id,tenant_id,position_id,executor_person_id,obligation_id,starts_at_snapshot,ends_at_snapshot,credit_minutes_snapshot,cancellation_deadline_snapshot,task_version_snapshot,state,booked_by_auth_user_id,idempotency_key)select ('e7300000-0000-4000-8000-'||right(s.id::text,12))::uuid,s.tenant_id,p.id,'a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001',s.starts_at,s.ends_at,120,s.starts_at-interval '2 days',s.type_version_id,'booked','11111111-1111-4111-8111-111111111111',('e7310000-0000-4000-8000-'||right(s.id::text,12))::uuid from app.shifts s join app.shift_positions p on p.tenant_id=s.tenant_id and p.shift_id=s.id where s.id in('e7200000-0000-4000-8000-000000000001','e7200000-0000-4000-8000-000000000002');
-- Independent private inbox rows for the two parents.
insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)values('e7700000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned_fixture','e7700000-0000-4000-8000-000000000001',1,'pwa.news','{}');
insert into app.pwa_notifications(id,tenant_id,recipient_person_id,event_id,title,body,source_path)values
 ('e7800000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000001','e7700000-0000-4000-8000-000000000001','Alleen A','Eigen bericht A','/app/notifications'),
 ('e7800000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a1000000-0000-4000-8000-000000000002','e7700000-0000-4000-8000-000000000001','Alleen B','Eigen bericht B','/app/notifications');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dismiss_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"topic_id":"pwa.profile","topic_version":1}','e7900000-0000-4000-8000-000000000001')$$,'A dismisses own versioned topic');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dismiss_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"topic_id":"pwa.profile","topic_version":1}','e7900000-0000-4000-8000-000000000002')$$,'fresh acknowledgement of unchanged seen topic is a valid command');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dismiss_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"topic_id":"pwa.profile","topic_version":1}','e7900000-0000-4000-8000-000000000003')$$,'B independently dismisses the same versioned topic');
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
insert into receipts select 'reset-A',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000004');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'help_seen'),0,'A reads its own explanations as reset');
reset role;
select is((select count(*)::integer from app.pwa_help_preferences where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and person_id='a1000000-0000-4000-8000-000000000002'),1,'A reset does not delete B preference despite household progress sharing');
set local role authenticated;
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
insert into receipts select 'reset-B',resource_id,version,event_ids from api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000005');
select is(jsonb_array_length(api.pwa_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->'help_seen'),0,'B can reset after A in the same tenant');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000006')$$,'another explicit own reset succeeds even with no seen rows');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000005')$$,'same reset key replays the original receipt');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','a1000000-0000-4000-8000-000000000001',0,'{}','e7900000-0000-4000-8000-000000000007')$$,'22023','INVALID_COMMAND','caller cannot address another person preference resource');
select throws_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','reset_help','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"person_id":"a1000000-0000-4000-8000-000000000001"}','e7900000-0000-4000-8000-000000000008')$$,'22023','INVALID_FIELD','delegated person payload cannot reset someone else preferences');
select throws_ok($$select api.pwa_command('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','reset_help','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0,'{}','e7900000-0000-4000-8000-000000000009')$$,'42501','FORBIDDEN','own-account acknowledgement still reauthorizes tenant');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mark_all_inbox_read','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000010')$$,'B marks its actual own inbox read');
reset role;
select ok((select read_at is not null from app.pwa_notifications where id='e7800000-0000-4000-8000-000000000002'),'B own inbox row is marked');
select ok((select read_at is null from app.pwa_notifications where id='e7800000-0000-4000-8000-000000000001'),'B bulk inbox mutation leaves A row unread');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mark_all_inbox_read','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000011')$$,'A bulk read succeeds after B in the same tenant');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','mark_all_inbox_read','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{}','e7900000-0000-4000-8000-000000000012')$$,'another explicit empty bulk read succeeds');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','revoke_push_subscription','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"endpoint":"https://fcm.googleapis.com/nonexistent-a"}','e7900000-0000-4000-8000-000000000013')$$,'revoking already absent own device remains a valid acknowledgement');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','revoke_push_subscription','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"endpoint":"https://fcm.googleapis.com/nonexistent-a"}','e7900000-0000-4000-8000-000000000014')$$,'fresh-key repeated missing-device revoke also succeeds');
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm_attendance_batch','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"entries":[{"booking_id":"e7300000-0000-4000-8000-000000000001","expected_version":1,"result":"partial","awarded_minutes":75,"reason":"Werkelijk 75 minuten uitgevoerd"}]}','e7900000-0000-4000-8000-000000000015')$$,'first actual attendance batch confirms partial performed minutes');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm_attendance_batch','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"entries":[{"booking_id":"e7300000-0000-4000-8000-000000000002","expected_version":1,"result":"no_show","awarded_minutes":0,"reason":"","no_show_ack":true}]}','e7900000-0000-4000-8000-000000000016')$$,'second independent attendance batch confirms actual no-show without shared-tenant event conflict');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirm_attendance_batch','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,'{"entries":[{"booking_id":"e7300000-0000-4000-8000-000000000002","expected_version":1,"result":"no_show","awarded_minutes":0,"reason":"","no_show_ack":true}]}','e7900000-0000-4000-8000-000000000016')$$,'same batch key replays without another confirmation or award');
reset role;
select is((select sum(minutes_delta) from app.hour_ledger_entries where booking_id in('e7300000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000002')),75::bigint,'independent batches preserve exact performed ledger minutes');
select is((select count(*)::integer from app.attendance_decisions where booking_id in('e7300000-0000-4000-8000-000000000001','e7300000-0000-4000-8000-000000000002')),2,'two original confirmations remain exactly once after batch replay');
select is((select count(*)::integer from app.domain_events where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and event_type='pwa.reset_help'),3,'fresh resets create their own immutable events; same-key replay adds none');
select is((select count(*)::integer from app.audit_events where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and action='pwa.reset_help'),3,'each actual reset keeps its own actor audit exactly once');
select ok((select event_ids from receipts where label='reset-A')<>(select event_ids from receipts where label='reset-B'),'different parents receive distinct completed-command event identities');
select is((select count(*)::integer from app.domain_events where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and event_type='pwa.reset_help' and aggregate_type='pwa_command' and aggregate_id=id),3,'repeatable events identify their actual completed command');
select is((select count(*)::integer from app.domain_events where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and event_type='pwa.confirm_attendance_batch'),2,'independent attendance batches append separate command events');
-- Actual independent batches for one unchanged team version.
insert into app.teams(id,tenant_id,name)values('e7400000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Tweede verdeelbatch');
insert into app.team_person_memberships(tenant_id,team_id,person_id,membership_kind)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7400000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','player');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,team_id,granted_by_auth_user_id)select tenant_id,'33333333-3333-4333-8333-333333333333',id,'team','e7400000-0000-4000-8000-000000000001','33333333-3333-4333-8333-333333333333' from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and role_key='team_parent';
insert into app.pwa_clusters(id,tenant_id,season_id,team_id,title,mode,self_until,assign_until)values('e7450000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a5000000-0000-4000-8000-000000000001','e7400000-0000-4000-8000-000000000001','Werkelijke batchplaatsen','assign',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day');
insert into app.pwa_allocations(id,tenant_id,cluster_id,position_id)values
 ('e7460000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7450000-0000-4000-8000-000000000001','aa210000-0000-4000-8000-000000000002'),
 ('e7460000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7450000-0000-4000-8000-000000000001','aa210000-0000-4000-8000-000000000004');
insert into app.intake_answers_versions(tenant_id,profile_id,revision,answers,authored_by_auth_user_id)select tenant_id,id,2,'{"reserve_willing":true}'::jsonb,'22222222-2222-4222-8222-222222222222' from app.intake_profiles where id='a4000000-0000-4000-8000-000000000002';
update app.intake_profiles set current_revision=2,version=version+1 where id='a4000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.actor('33333333-3333-4333-8333-333333333333');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','e7400000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"e7460000-0000-4000-8000-000000000001","expected_version":1,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','e7900000-0000-4000-8000-000000000017')$$,'first distribution updates the actual selected allocation');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','apply_distribution','e7400000-0000-4000-8000-000000000001',1,'{"assignments":[{"allocation_id":"e7460000-0000-4000-8000-000000000002","expected_version":1,"member_person_id":"a1000000-0000-4000-8000-000000000001"}]}','e7900000-0000-4000-8000-000000000018')$$,'second different distribution succeeds for unchanged team metadata');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','request_reserve','e7460000-0000-4000-8000-000000000002',2,'{"person_ids":["a1000000-0000-4000-8000-000000000002"]}','e7900000-0000-4000-8000-000000000019')$$,'actual eligible opted-in reserve receives its request');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','request_reserve','e7460000-0000-4000-8000-000000000002',2,'{"person_ids":["a1000000-0000-4000-8000-000000000002"]}','e7900000-0000-4000-8000-000000000020')$$,'another explicit reserve request has a separate command identity');
reset role;
select is((select version from app.teams where id='e7400000-0000-4000-8000-000000000001'),1::bigint,'no fake team version is introduced to avoid a command event conflict');
select is((select count(*)::integer from app.pwa_allocations where cluster_id='e7450000-0000-4000-8000-000000000001' and version=2 and state='assigned'),2,'both independent allocation versions are actual assignment changes');
select is((select count(*)::integer from app.pwa_reserve_requests where allocation_id='e7460000-0000-4000-8000-000000000002'),1,'repeat acknowledgement does not duplicate the durable reserve recipient');
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_profile','a3000000-0000-4000-8000-000000000001',1,'{}','e7900000-0000-4000-8000-000000000021')$$,'existing own intake initialization acknowledges the actual profile');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','start_profile','a3000000-0000-4000-8000-000000000001',1,'{}','e7900000-0000-4000-8000-000000000022')$$,'fresh-key own intake initialization is also safe');
reset role;
select is((select current_revision from app.intake_profiles where id='a4000000-0000-4000-8000-000000000001'),1,'repeated initialization preserves existing private answers');
-- Two real exact policy acceptances sharing the PWA tenant resource.
insert into app.policy_documents(id,tenant_id,document_key,title,current_revision)values('e7500000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owned-repeat-policy','Exacte beleidsproef',1);
insert into app.policy_versions(id,tenant_id,document_id,revision,exact_body,body_hash,state,approved_by_auth_user_id,approved_at,published_at,created_by_auth_user_id)values('e7510000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7500000-0000-4000-8000-000000000001',1,'Exacte lokale beleidstekst',extensions.digest('Exacte lokale beleidstekst','sha256'),'published','33333333-3333-4333-8333-333333333333',statement_timestamp(),statement_timestamp(),'33333333-3333-4333-8333-333333333333');
insert into app.policy_audiences(id,tenant_id,policy_version_id,audience_key,criteria_snapshot,approved_by_auth_user_id)values('e7520000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7510000-0000-4000-8000-000000000001','owned','{}','33333333-3333-4333-8333-333333333333');
insert into app.policy_assignments(id,tenant_id,policy_version_id,audience_id,member_person_id,state,opened_at)values
 ('e7530000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7510000-0000-4000-8000-000000000001','e7520000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','opened',statement_timestamp()),
 ('e7530000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','e7510000-0000-4000-8000-000000000001','e7520000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','opened',statement_timestamp());
set local role authenticated;
select pg_temp.actor('11111111-1111-4111-8111-111111111111');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000001"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}','e7900000-0000-4000-8000-000000000023')$$,'A accepts its exact actual policy assignment');
select pg_temp.actor('22222222-2222-4222-8222-222222222222');
select lives_ok($$select api.pwa_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accept_policy','e7510000-0000-4000-8000-000000000001',1,'{"assignment_ids":["e7530000-0000-4000-8000-000000000002"],"expected_versions":[1],"capacity":"self","explicit_confirmation":true}','e7900000-0000-4000-8000-000000000024')$$,'B independent acceptance succeeds after A tenant acknowledgement');
reset role;
select is((select count(*)::integer from app.policy_acceptances where policy_version_id='e7510000-0000-4000-8000-000000000001'),2,'both exact policy acceptance records survive independently');

select * from finish();
rollback;
