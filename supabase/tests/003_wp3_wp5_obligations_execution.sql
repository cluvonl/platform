begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Synthetic accounts only; every identity is isolated to this rolled-back test.
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('31000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lid-a@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('31000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'lid-b@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('31000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'reviewer-a@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('31000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'reviewer-b@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, timezone, status) values (
  '32000000-0000-4000-8000-000000000001',
  'wp3-wp5-club', 'WP3-WP5 Club', 'Europe/Amsterdam', 'active'
);

insert into app.account_profiles (auth_user_id, display_name) values
  ('31000000-0000-4000-8000-000000000001', 'Lid A'),
  ('31000000-0000-4000-8000-000000000002', 'Lid B'),
  ('31000000-0000-4000-8000-000000000003', 'Reviewer A'),
  ('31000000-0000-4000-8000-000000000004', 'Reviewer B');

insert into app.persons (
  id, tenant_id, given_name, family_name, birth_date, birth_date_precision, status
) values
  ('33000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'Lid', 'A', '1980-01-01', 'day', 'active'),
  ('33000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', 'Lid', 'B', '1982-01-01', 'day', 'active'),
  ('33000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', 'Reviewer', 'A', '1975-01-01', 'day', 'active'),
  ('33000000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000001', 'Reviewer', 'B', '1976-01-01', 'day', 'active');

insert into app.account_person_links (
  tenant_id, auth_user_id, person_id, verified_at
) values
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', statement_timestamp()),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000002', statement_timestamp()),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000003', statement_timestamp()),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000004', '33000000-0000-4000-8000-000000000004', statement_timestamp());

insert into app.tenant_memberships (tenant_id, auth_user_id, status, starts_at) values
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'active', statement_timestamp() - interval '1 day'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', 'active', statement_timestamp() - interval '1 day'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', 'active', statement_timestamp() - interval '1 day'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000004', 'active', statement_timestamp() - interval '1 day');

insert into app.committees (id, tenant_id, slug, name) values (
  '35000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001', 'kantine', 'Kantine'
);

insert into app.households (id, tenant_id, label, intake_code_hash, status) values (
  '34000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'Testhuishouden', extensions.digest('wp3-wp5-code', 'sha256'), 'active'
);

insert into app.household_person_links (
  tenant_id, household_id, person_id, kind, starts_at, verified_by_auth_user_id
) values
  ('32000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', 'parent', statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003'),
  ('32000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000002', 'executor', statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003');

insert into app.household_access_grants (
  tenant_id, household_id, auth_user_id, can_view_progress, can_book_for,
  starts_at, granted_by_auth_user_id
) values
  ('32000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', true, false, statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003'),
  ('32000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', true, false, statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003');

insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, starts_at, granted_by_auth_user_id
) values
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', (select id from app.permission_roles where tenant_id = '32000000-0000-4000-8000-000000000001' and role_key = 'member'), 'tenant', statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', (select id from app.permission_roles where tenant_id = '32000000-0000-4000-8000-000000000001' and role_key = 'member'), 'tenant', statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000003', (select id from app.permission_roles where tenant_id = '32000000-0000-4000-8000-000000000001' and role_key = 'volunteer_committee'), 'tenant', statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003'),
  ('32000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000004', (select id from app.permission_roles where tenant_id = '32000000-0000-4000-8000-000000000001' and role_key = 'volunteer_committee'), 'tenant', statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003');

insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, committee_id,
  starts_at, granted_by_auth_user_id
) values (
  '32000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000003',
  (select id from app.permission_roles where tenant_id = '32000000-0000-4000-8000-000000000001' and role_key = 'committee_coordinator'),
  'committee', '35000000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '1 day', '31000000-0000-4000-8000-000000000003'
);

-- Independent seasons let one synthetic household exercise each formula without
-- violating the one-active-obligation-per-household/season invariant.
insert into app.seasons (
  id, tenant_id, name, starts_on, ends_on, winter_cutoff_at,
  target_minutes, winter_target_minutes, status
) values
  ('36000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'A01', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', 'A02', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', 'A03', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000001', 'A04', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000001', 'A05-A06', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000006', '32000000-0000-4000-8000-000000000001', 'Attendance', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000007', '32000000-0000-4000-8000-000000000001', 'Booking', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active'),
  ('36000000-0000-4000-8000-000000000008', '32000000-0000-4000-8000-000000000001', 'Exception', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01', 720, 360, 'active');

insert into app.obligations (
  id, tenant_id, season_id, assessed_household_id,
  base_target_minutes, effective_target_minutes, effective_winter_minutes,
  status, ledger_revision
) values
  ('36100000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 2),
  ('36100000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000002', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 1),
  ('36100000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000003', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 1),
  ('36100000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000004', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 1),
  ('36100000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000005', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 0),
  ('36100000-0000-4000-8000-000000000006', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000006', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 0),
  ('36100000-0000-4000-8000-000000000007', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000007', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 0),
  ('36100000-0000-4000-8000-000000000008', '32000000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000008', '34000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 0);

insert into app.household_obligation_links (
  tenant_id, household_id, obligation_id, link_kind, starts_at
)
select
  '32000000-0000-4000-8000-000000000001'::uuid,
  '34000000-0000-4000-8000-000000000001'::uuid,
  obligation.id,
  'liable',
  statement_timestamp() - interval '1 day'
from app.obligations as obligation
where obligation.tenant_id = '32000000-0000-4000-8000-000000000001';

insert into app.executor_obligation_grants (
  tenant_id, person_id, obligation_id, valid_from, approved_by_auth_user_id
)
select
  '32000000-0000-4000-8000-000000000001'::uuid,
  person_id,
  obligation_id,
  '2026-01-01'::timestamptz,
  '31000000-0000-4000-8000-000000000003'::uuid
from (
  values
    ('33000000-0000-4000-8000-000000000001'::uuid, '36100000-0000-4000-8000-000000000003'::uuid),
    ('33000000-0000-4000-8000-000000000001'::uuid, '36100000-0000-4000-8000-000000000004'::uuid),
    ('33000000-0000-4000-8000-000000000001'::uuid, '36100000-0000-4000-8000-000000000006'::uuid),
    ('33000000-0000-4000-8000-000000000001'::uuid, '36100000-0000-4000-8000-000000000007'::uuid),
    ('33000000-0000-4000-8000-000000000002'::uuid, '36100000-0000-4000-8000-000000000007'::uuid)
) as grants(person_id, obligation_id);

-- A01-A04 ledger fixtures.  Manual source rows are acceptable here because the
-- tested subject is the canonical projection; command-to-ledger is tested below.
insert into app.hour_ledger_entries (
  id, tenant_id, obligation_id, season_id, entry_kind, minutes_delta,
  performed_at, actor_auth_user_id, idempotency_key
) values
  ('36200000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', 'award', 480, '2026-10-01 10:00:00+02', '31000000-0000-4000-8000-000000000003', '36300000-0000-4000-8000-000000000001'),
  ('36200000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000001', '36000000-0000-4000-8000-000000000001', 'award', 240, '2027-02-01 10:00:00+01', '31000000-0000-4000-8000-000000000003', '36300000-0000-4000-8000-000000000002'),
  ('36200000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000002', '36000000-0000-4000-8000-000000000002', 'award', 720, '2026-10-01 10:00:00+02', '31000000-0000-4000-8000-000000000003', '36300000-0000-4000-8000-000000000003'),
  ('36200000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000003', '36000000-0000-4000-8000-000000000003', 'award', 240, '2026-10-01 10:00:00+02', '31000000-0000-4000-8000-000000000003', '36300000-0000-4000-8000-000000000004'),
  ('36200000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000004', '36000000-0000-4000-8000-000000000004', 'award', 240, '2026-10-01 10:00:00+02', '31000000-0000-4000-8000-000000000003', '36300000-0000-4000-8000-000000000005');

insert into app.task_categories (
  id, tenant_id, committee_id, name, minimum_positions
) values
  (
    '37000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001', 'Bar', 3
  ),
  (
    '37000000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001', 'Keuken', 2
  );
insert into app.task_types (id, tenant_id, category_id, name) values
  (
    '37100000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001', 'Bardienst'
  ),
  (
    '37100000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000002', 'Keukendienst'
  );
insert into app.task_type_versions (
  id, tenant_id, task_type_id, revision, credit_minutes, approved_by_auth_user_id
) values
  (
    '37200000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    '37100000-0000-4000-8000-000000000001', 1, 120,
    '31000000-0000-4000-8000-000000000003'
  ),
  (
    '37200000-0000-4000-8000-000000000002',
    '32000000-0000-4000-8000-000000000001',
    '37100000-0000-4000-8000-000000000002', 1, 180,
    '31000000-0000-4000-8000-000000000003'
  );

insert into app.shifts (
  id, tenant_id, type_version_id, committee_id, category_id, title,
  starts_at, ends_at, credit_minutes, cancellation_minutes, state, published_at
) values
  ('37300000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '37200000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-000000000001', 'A03 winterboeking', '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01', 120, 2880, 'published', statement_timestamp()),
  ('37300000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '37200000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-000000000001', 'A04 pending', '2026-10-02 10:00:00+02', '2026-10-02 12:00:00+02', 120, 2880, 'published', statement_timestamp()),
  ('37300000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', '37200000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-000000000001', 'Aanwezigheid', '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02', 120, 2880, 'published', statement_timestamp()),
  ('37300000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000001', '37200000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-000000000001', 'Laatste plaats', '2027-03-01 10:00:00+01', '2027-03-01 12:00:00+01', 120, 2880, 'published', statement_timestamp()),
  ('37300000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000001', '37200000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-000000000001', 'Overname', '2027-03-02 10:00:00+01', '2027-03-02 12:00:00+01', 120, 2880, 'published', statement_timestamp()),
  ('37300000-0000-4000-8000-000000000006', '32000000-0000-4000-8000-000000000001', '37200000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', '37000000-0000-4000-8000-000000000001', 'Afmelden', transaction_timestamp() + interval '30 minutes', transaction_timestamp() + interval '150 minutes', 120, 2880, 'published', statement_timestamp());

insert into app.shift_positions (
  id, tenant_id, shift_id, ordinal, starts_at, ends_at
) values
  ('37400000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000001', 1, '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01'),
  ('37400000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000002', 1, '2026-10-02 10:00:00+02', '2026-10-02 12:00:00+02'),
  ('37400000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000003', 1, '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02'),
  ('37400000-0000-4000-8000-000000000004', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000004', 1, '2027-03-01 10:00:00+01', '2027-03-01 12:00:00+01'),
  ('37400000-0000-4000-8000-000000000005', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000005', 1, '2027-03-02 10:00:00+01', '2027-03-02 12:00:00+01'),
  ('37400000-0000-4000-8000-000000000006', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000006', 1, transaction_timestamp() + interval '30 minutes', transaction_timestamp() + interval '150 minutes'),
  ('37400000-0000-4000-8000-000000000007', '32000000-0000-4000-8000-000000000001', '37300000-0000-4000-8000-000000000006', 2, transaction_timestamp() + interval '30 minutes', transaction_timestamp() + interval '150 minutes');

insert into app.bookings (
  id, tenant_id, position_id, executor_person_id, obligation_id, state,
  booked_by_auth_user_id, starts_at_snapshot, ends_at_snapshot,
  credit_minutes_snapshot, cancellation_deadline_snapshot,
  task_version_snapshot, idempotency_key
) values
  ('37500000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '37400000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000003', 'booked', '31000000-0000-4000-8000-000000000001', '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01', 120, '2027-01-30 10:00:00+01', '37200000-0000-4000-8000-000000000001', '37600000-0000-4000-8000-000000000001'),
  ('37500000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '37400000-0000-4000-8000-000000000002', '33000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000004', 'performed_pending', '31000000-0000-4000-8000-000000000001', '2026-10-02 10:00:00+02', '2026-10-02 12:00:00+02', 120, '2026-09-30 10:00:00+02', '37200000-0000-4000-8000-000000000001', '37600000-0000-4000-8000-000000000002'),
  ('37500000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000001', '37400000-0000-4000-8000-000000000003', '33000000-0000-4000-8000-000000000001', '36100000-0000-4000-8000-000000000006', 'booked', '31000000-0000-4000-8000-000000000001', '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02', 120, '2026-08-30 10:00:00+02', '37200000-0000-4000-8000-000000000001', '37600000-0000-4000-8000-000000000003');

insert into app.qualification_types (id, tenant_id, name) values (
  '37700000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001', 'BHV'
);
insert into app.shift_requirements (
  tenant_id, shift_id, qualification_type_id
) values (
  '32000000-0000-4000-8000-000000000001',
  '37300000-0000-4000-8000-000000000005',
  '37700000-0000-4000-8000-000000000001'
);
insert into app.person_qualifications (
  id, tenant_id, person_id, qualification_type_id,
  achieved_at, expires_at, verified_by_auth_user_id
) values
  ('37800000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000001', '37700000-0000-4000-8000-000000000001', '2026-01-01', '2028-01-01', '31000000-0000-4000-8000-000000000003'),
  ('37800000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000002', '37700000-0000-4000-8000-000000000001', '2026-01-01', '2028-01-01', '31000000-0000-4000-8000-000000000003');

insert into app.volunteer_role_catalog (id, tenant_id, name) values (
  '37900000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001', 'Trainer'
);
insert into app.volunteer_role_versions (
  id, tenant_id, role_id, revision, household_exempt,
  effective_from, approved_by_auth_user_id
) values (
  '37910000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '37900000-0000-4000-8000-000000000001', 1, true,
  '2026-07-01', '31000000-0000-4000-8000-000000000003'
);

select ok(
  coalesce((
    select reloptions @> array['security_invoker=true']
    from pg_catalog.pg_class where oid = 'api.my_obligation_status'::regclass
  ), false),
  'obligation status is a security-invoker view'
);
select ok(
  not has_table_privilege('authenticated', 'app.hour_ledger_entries', 'UPDATE'),
  'authenticated cannot rewrite the confirmed-minutes ledger'
);
select ok(
  not has_table_privilege('authenticated', 'app.volunteer_appointments', 'INSERT'),
  'recognized appointments can only be created by guarded commands'
);
select ok(
  not has_function_privilege(
    'anon',
    'api.recognize_volunteer_appointment(uuid,uuid,uuid,uuid,uuid,date,date,uuid,uuid,bigint,text,uuid)',
    'EXECUTE'
  ),
  'anon cannot recognize a structural volunteer appointment'
);
select ok(
  not has_function_privilege(
    'anon',
    'api.manage_planboard_shift(uuid,uuid,text,text,bigint,uuid,uuid,uuid,text,timestamptz,timestamptz,integer,uuid)',
    'EXECUTE'
  ),
  'A16: anon cannot execute the plan-board command'
);
select ok(
  not has_table_privilege('authenticated', 'app.shifts', 'INSERT')
  and not has_table_privilege('authenticated', 'app.shift_positions', 'UPDATE'),
  'A16: authenticated clients cannot bypass the guarded planning command'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select confirmed_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000001'),
  720,
  'A01: 480 minutes before plus 240 after winter totals 720'
);
select is(
  (select remaining_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000001'),
  0,
  'A01: fulfilled annual target has no invented second-half deficit'
);
select is(
  (select winter_deficit_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000001'),
  0,
  'A01: eight hours before winter already exceed the single winter threshold'
);
select is(
  (select remaining_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000002'),
  0,
  'A02: twelve hours before winter leave no required annual minutes'
);
select is(
  (select annual_state from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000002'),
  'fulfilled_minutes',
  'A02: full early performance is fulfilled by real minutes'
);
select is(
  (select remaining_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000003'),
  480,
  'A03: four confirmed hours leave eight annual hours'
);
select is(
  (select winter_deficit_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000003'),
  120,
  'A03: four confirmed hours create a two-hour winter deficit'
);
select is(
  (select winter_state from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000004'),
  'needs_review',
  'A04: pending pre-winter attendance blocks a definitive deficit'
);

-- Winter review and allocations are committee commands, not ledger writes.
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select set_config(
  'cluvo.test.review_a03',
  (select resource_id::text from api.create_winter_review(
    '32000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000003',
    1,
    '38000000-0000-4000-8000-000000000001'
  )),
  true
);
select is(
  (select allocatable_minutes from app.winter_reviews
   where id = current_setting('cluvo.test.review_a03')::uuid),
  120,
  'A03: winter review allocates at most the two-hour threshold deficit'
);
select lives_ok(
  format(
    'select * from api.allocate_winter_booking(%L,%L,%L,120,1,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.review_a03'),
    '37500000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002'
  ),
  'A03: an existing suitable post-winter booking receives the allocation'
);
select lives_ok(
  format(
    'select * from api.allocate_winter_booking(%L,%L,%L,120,1,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.review_a03'),
    '37500000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000002'
  ),
  'A03: retrying the same allocation command returns its stored result'
);
select is(
  (select count(*)::integer from app.winter_allocations
   where review_id = current_setting('cluvo.test.review_a03')::uuid),
  1,
  'A03: allocation retry does not double-plan the same deficit'
);
select is(
  (select count(*)::integer from app.hour_ledger_entries
   where obligation_id = '36100000-0000-4000-8000-000000000003'),
  1,
  'A03: a winter allocation never creates confirmed minutes'
);

select set_config(
  'cluvo.test.review_a04',
  (select resource_id::text from api.create_winter_review(
    '32000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000004',
    1,
    '38000000-0000-4000-8000-000000000003'
  )),
  true
);
select is(
  (select state from app.winter_reviews
   where id = current_setting('cluvo.test.review_a04')::uuid),
  'needs_review',
  'A04: the persisted winter work item remains needs-review while attendance is pending'
);
select is(
  (select count(*)::integer from app.winter_allocations
   where review_id = current_setting('cluvo.test.review_a04')::uuid),
  0,
  'A04: no definitive allocation is created before pending attendance is decided'
);

-- A05: recognition covers the household but never grants system rights or hours.
select set_config(
  'cluvo.test.access_grants_before_role',
  (select count(*)::text from app.access_grants
   where tenant_id = '32000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'cluvo.test.appointment_id',
  (select resource_id::text from api.recognize_volunteer_appointment(
    '32000000-0000-4000-8000-000000000001',
    '37910000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000005',
    '2026-07-01', null, null, null, 1,
    'Erkende trainer voor dit huishouden',
    '38000000-0000-4000-8000-000000000004'
  )),
  true
);
select is(
  (select annual_state from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000005'),
  'fulfilled_structural',
  'A05: a recognized exempting role covers the whole linked household'
);
select is(
  (select confirmed_minutes::integer from api.my_obligation_status
   where obligation_id = '36100000-0000-4000-8000-000000000005'),
  0,
  'A05: structural coverage does not invent worked minutes'
);
select is(
  (select count(*)::text from app.access_grants
   where tenant_id = '32000000-0000-4000-8000-000000000001'),
  current_setting('cluvo.test.access_grants_before_role'),
  'A05: a volunteer appointment does not create a system access grant'
);

select lives_ok(
  format(
    'select * from api.end_volunteer_appointment(%L,%L,1,%L,%L,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.appointment_id'),
    '2026-10-02',
    'Rol is tussentijds beëindigd; resterende verplichting moet worden beoordeeld',
    '38000000-0000-4000-8000-000000000005'
  ),
  'A06: ending a recognized role opens the controlled review route'
);
select is(
  (select status from app.obligations
   where id = '36100000-0000-4000-8000-000000000005'),
  'review_hold',
  'A06: role end holds the obligation for review instead of rewriting its target'
);
select is(
  (select count(*)::integer from app.appointment_review_cases
   where appointment_id = current_setting('cluvo.test.appointment_id')::uuid and state = 'open'),
  1,
  'A06: exactly one explicit appointment review case is opened'
);
select is(
  (select count(*)::integer from app.hour_ledger_entries
   where obligation_id = '36100000-0000-4000-8000-000000000005'),
  0,
  'A06: role end creates neither retroactive hours nor a financial post'
);

-- Attendance is the sole normal route from performed work to the ledger.
select lives_ok(
  $$select * from api.confirm_attendance(
    '32000000-0000-4000-8000-000000000001',
    '37500000-0000-4000-8000-000000000003',
    1, 'present', null, null,
    '38100000-0000-4000-8000-000000000001'
  )$$,
  'confirmed attendance atomically creates its ledger award'
);
select lives_ok(
  $$select * from api.confirm_attendance(
    '32000000-0000-4000-8000-000000000001',
    '37500000-0000-4000-8000-000000000003',
    1, 'present', null, null,
    '38100000-0000-4000-8000-000000000001'
  )$$,
  'attendance retry is idempotent'
);
select is(
  (select count(*)::integer from app.hour_ledger_entries
   where booking_id = '37500000-0000-4000-8000-000000000003'),
  1,
  'attendance retry creates exactly one initial award'
);
select is(
  (select sum(minutes_delta)::integer from app.hour_ledger_entries
   where booking_id = '37500000-0000-4000-8000-000000000003'),
  120,
  'full confirmed attendance awards the snapshotted 120 minutes'
);
select lives_ok(
  $$select * from api.correct_attendance_award(
    '32000000-0000-4000-8000-000000000001',
    '37500000-0000-4000-8000-000000000003',
    2, 'partial', 60, 'Administratieve correctie na controle',
    '38100000-0000-4000-8000-000000000002'
  )$$,
  'a correction appends a decision, reversal and replacement'
);
select is(
  (select count(*)::integer from app.attendance_decisions
   where booking_id = '37500000-0000-4000-8000-000000000003'),
  2,
  'attendance decision history remains append-only'
);
select is(
  (select count(*)::integer from app.hour_ledger_entries
   where booking_id = '37500000-0000-4000-8000-000000000003'),
  3,
  'correction preserves award, reversal and replacement rows'
);
select is(
  (select sum(minutes_delta)::integer from app.hour_ledger_entries
   where booking_id = '37500000-0000-4000-8000-000000000003'),
  60,
  'ledger sum reflects the corrected award without overwriting history'
);

reset role;
select throws_ok(
  $$update app.hour_ledger_entries
    set minutes_delta = 999
    where id = (
      select id from app.hour_ledger_entries
      where booking_id = '37500000-0000-4000-8000-000000000003'
      order by posted_at limit 1
    )$$,
  '55000',
  'hour_ledger_entries is append-only',
  'even a privileged session cannot rewrite ledger history'
);

-- A13: the command plus unique active-position index serializes the last place.
set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select ok(
  internal.can_book_executor(
    '32000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000007'
  )
  and internal.has_permission(
    '32000000-0000-4000-8000-000000000001',
    'shift.book',
    'household',
    '34000000-0000-4000-8000-000000000001'
  ),
  'A13: the first claimant fixture is authorized before the atomic command'
);
select lives_ok(
  $$select * from api.book_shift(
    '32000000-0000-4000-8000-000000000001',
    '37300000-0000-4000-8000-000000000004',
    '37400000-0000-4000-8000-000000000004',
    '33000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000007',
    1,
    '38200000-0000-4000-8000-000000000001'
  )$$,
  'A13: the first claimant atomically books the final position'
);
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$select * from api.book_shift(
    '32000000-0000-4000-8000-000000000001',
    '37300000-0000-4000-8000-000000000004',
    '37400000-0000-4000-8000-000000000004',
    '33000000-0000-4000-8000-000000000002',
    '36100000-0000-4000-8000-000000000007',
    1,
    '38200000-0000-4000-8000-000000000002'
  )$$,
  'P0001', 'CAPACITY_FULL',
  'A13: the second claimant receives capacity-full for the last place'
);
select is(
  (select count(*)::integer from app.bookings
   where position_id = '37400000-0000-4000-8000-000000000004'
     and state in ('booked', 'reconfirmation_required', 'transfer_pending', 'performed_pending')),
  1,
  'A13: exactly one active booking owns the last position'
);

-- A14: takeover rechecks qualification at the atomic commit point.
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'cluvo.test.transfer_origin',
  (select resource_id::text from api.book_shift(
    '32000000-0000-4000-8000-000000000001',
    '37300000-0000-4000-8000-000000000005',
    '37400000-0000-4000-8000-000000000005',
    '33000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000007',
    1,
    '38200000-0000-4000-8000-000000000003'
  )),
  true
);
select set_config(
  'cluvo.test.transfer_request',
  (select resource_id::text from api.request_booking_transfer(
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.transfer_origin')::uuid,
    1,
    '33000000-0000-4000-8000-000000000002',
    '36100000-0000-4000-8000-000000000007',
    statement_timestamp() + interval '2 days',
    '38200000-0000-4000-8000-000000000004'
  )),
  true
);
select throws_ok(
  format(
    'select * from api.accept_booking_transfer(%L,%L,1,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.transfer_request'),
    '38200000-0000-4000-8000-000000000009'
  ),
  '42501', 'FORBIDDEN',
  'A14: the origin actor cannot accept a takeover for the replacement person'
);

reset role;
update app.person_qualifications
set revoked_at = statement_timestamp()
where id = '37800000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  format(
    'select * from api.accept_booking_transfer(%L,%L,1,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.transfer_request'),
    '38200000-0000-4000-8000-000000000005'
  ),
  '42501', 'QUALIFICATION_EXPIRED',
  'A14: changed qualification is rechecked at transfer acceptance'
);
select is(
  (select state from app.bookings
   where id = current_setting('cluvo.test.transfer_origin')::uuid),
  'transfer_pending',
  'A14: failed transfer leaves the original booking active'
);

reset role;
update app.person_qualifications
set revoked_at = null
where id = '37800000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  format(
    'select * from api.accept_booking_transfer(%L,%L,1,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.transfer_request'),
    '38200000-0000-4000-8000-000000000005'
  ),
  'A14: qualified replacement atomically accepts the takeover'
);
select is(
  (select state from app.bookings
   where id = current_setting('cluvo.test.transfer_origin')::uuid),
  'transferred',
  'A14: original booking ends only after successful replacement commit'
);
select is(
  (select count(*)::integer from app.bookings
   where position_id = '37400000-0000-4000-8000-000000000005' and state = 'booked'),
  1,
  'A14: exactly one replacement booking is active after takeover'
);

-- A15: each booking keeps its own cancellation snapshot; sickness bypasses the
-- ordinary deadline without erasing the late indicator.
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'cluvo.test.old_deadline_booking',
  (select resource_id::text from api.book_shift(
    '32000000-0000-4000-8000-000000000001',
    '37300000-0000-4000-8000-000000000006',
    '37400000-0000-4000-8000-000000000006',
    '33000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000007',
    1,
    '38200000-0000-4000-8000-000000000006'
  )),
  true
);

reset role;
update app.shifts
set cancellation_minutes = 0, version = 2, updated_at = statement_timestamp()
where id = '37300000-0000-4000-8000-000000000006';

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select set_config(
  'cluvo.test.new_deadline_booking',
  (select resource_id::text from api.book_shift(
    '32000000-0000-4000-8000-000000000001',
    '37300000-0000-4000-8000-000000000006',
    '37400000-0000-4000-8000-000000000007',
    '33000000-0000-4000-8000-000000000002',
    '36100000-0000-4000-8000-000000000007',
    2,
    '38200000-0000-4000-8000-000000000007'
  )),
  true
);
select ok(
  (select cancellation_deadline_snapshot from app.bookings
   where id = current_setting('cluvo.test.old_deadline_booking')::uuid)
  <
  (select cancellation_deadline_snapshot from app.bookings
   where id = current_setting('cluvo.test.new_deadline_booking')::uuid),
  'A15: a later policy change affects only the new booking snapshot'
);

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  format(
    'select * from api.cancel_booking(%L,%L,1,%L,%L,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.old_deadline_booking'),
    'sickness', 'Praktisch verhinderd',
    '38200000-0000-4000-8000-000000000008'
  ),
  'A15: sickness remains reportable after the ordinary cancellation deadline'
);
select is(
  (select outcome from app.booking_cancellations
   where booking_id = current_setting('cluvo.test.old_deadline_booking')::uuid),
  'sickness_reported',
  'A15: sickness uses its explicit non-regular outcome'
);
select ok(
  (select was_late from app.booking_cancellations
   where booking_id = current_setting('cluvo.test.old_deadline_booking')::uuid),
  'A15: the historical deadline comparison remains auditable'
);

reset role;

-- A16 D-evidence: form and drag use one guarded command and therefore produce
-- the same canonical shift/position model. Bar and kitchen minima are policy.
set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select set_config(
  'cluvo.test.a16_bar_shift',
  (select resource_id::text from api.manage_planboard_shift(
    '32000000-0000-4000-8000-000000000001', null,
    'create', 'form', 0,
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-01 10:00:00+02', '2027-05-01 12:00:00+02', 3,
    '38400000-0000-4000-8000-000000000001'
  )),
  true
);
select is(
  (select count(*)::integer from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid
     and state = 'open'),
  3,
  'A16: form creation persists the configured bar minimum of three positions'
);
select ok(
  (select bool_and(
     starts_at = '2027-05-01 10:00:00+02'::timestamptz
     and ends_at = '2027-05-01 12:00:00+02'::timestamptz
   ) from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid),
  'A16: every created position has exactly the canonical shift interval'
);
select set_config(
  'cluvo.test.a16_bar_positions',
  (select jsonb_agg(id order by ordinal)::text
   from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid),
  true
);
select is(
  (select resource_id from api.manage_planboard_shift(
    '32000000-0000-4000-8000-000000000001', null,
    'create', 'form', 0,
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-01 10:00:00+02', '2027-05-01 12:00:00+02', 3,
    '38400000-0000-4000-8000-000000000001'
  )),
  current_setting('cluvo.test.a16_bar_shift')::uuid,
  'A16: an exact command retry returns the same canonical shift'
);
select is(
  (select count(*)::integer from app.shifts where title = 'A16 bardienst'),
  1,
  'A16: idempotent create never duplicates the planned shift'
);
select throws_ok(
  $$select * from api.manage_planboard_shift(
    '32000000-0000-4000-8000-000000000001', null,
    'create', 'form', 0,
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'Te kleine bardienst',
    '2027-05-01 14:00:00+02', '2027-05-01 16:00:00+02', 2,
    '38400000-0000-4000-8000-000000000002'
  )$$,
  '23514', 'MINIMUM_STAFFING',
  'A16: a bar shift below three positions is rejected server-side'
);
select set_config(
  'cluvo.test.a16_kitchen_shift',
  (select resource_id::text from api.manage_planboard_shift(
    '32000000-0000-4000-8000-000000000001', null,
    'create', 'form', 0,
    '37200000-0000-4000-8000-000000000002',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000002',
    'A16 keukendienst',
    '2027-05-01 10:00:00+02', '2027-05-01 13:00:00+02', 2,
    '38400000-0000-4000-8000-000000000003'
  )),
  true
);
select is(
  (select count(*)::integer from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_kitchen_shift')::uuid
     and state = 'open'),
  2,
  'A16: kitchen planning persists its configured minimum of two positions'
);

select lives_ok(
  format(
    'select * from api.manage_planboard_shift(%L,%L,%L,%L,1,%L,%L,%L,%L,%L,%L,3,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift'),
    'move', 'drag',
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-02 10:00:00+02', '2027-05-02 12:00:00+02',
    '38400000-0000-4000-8000-000000000004'
  ),
  'A16: drag move uses the same guarded command as the form route'
);
select is(
  (select version from app.shifts
   where id = current_setting('cluvo.test.a16_bar_shift')::uuid),
  2::bigint,
  'A16: drag move advances the optimistic shift version'
);
select is(
  (select jsonb_agg(id order by ordinal)::text
   from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid),
  current_setting('cluvo.test.a16_bar_positions'),
  'A16: moving preserves all canonical position identities'
);
select lives_ok(
  format(
    'select * from api.manage_planboard_shift(%L,%L,%L,%L,2,%L,%L,%L,%L,%L,%L,3,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift'),
    'resize', 'form',
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-02 10:00:00+02', '2027-05-02 13:00:00+02',
    '38400000-0000-4000-8000-000000000005'
  ),
  'A16: form resize changes the canonical interval through the same command'
);
select ok(
  (select bool_and(
     starts_at = '2027-05-02 10:00:00+02'::timestamptz
     and ends_at = '2027-05-02 13:00:00+02'::timestamptz
   ) from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid
     and state <> 'cancelled'),
  'A16: resize keeps shift and all active position intervals consistent'
);
select is(
  (select jsonb_agg(id order by ordinal)::text
   from app.shift_positions
   where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid),
  current_setting('cluvo.test.a16_bar_positions'),
  'A16: time resize also preserves position identities'
);
select throws_ok(
  format(
    'select * from api.manage_planboard_shift(%L,%L,%L,%L,2,%L,%L,%L,%L,%L,%L,3,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift'),
    'move', 'drag',
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-03 10:00:00+02', '2027-05-03 13:00:00+02',
    '38400000-0000-4000-8000-000000000006'
  ),
  '40001', 'STALE_VERSION',
  'A16: a stale drag payload cannot overwrite the resized shift'
);
select throws_ok(
  format(
    'select * from api.manage_planboard_shift(%L,%L,%L,%L,3,%L,%L,%L,%L,%L,%L,2,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift'),
    'resize', 'form',
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-02 10:00:00+02', '2027-05-02 13:00:00+02',
    '38400000-0000-4000-8000-000000000007'
  ),
  '23514', 'MINIMUM_STAFFING',
  'A16: resize cannot reduce bar capacity below the policy minimum'
);

-- Once published, the draft plan-board command must defer every material
-- mutation to A17's preview/hash/apply path, including an occupied shift.
reset role;
update app.shifts
set state = 'published', published_at = statement_timestamp(),
    updated_at = statement_timestamp(), version = version + 1
where id = current_setting('cluvo.test.a16_bar_shift')::uuid;

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select set_config(
  'cluvo.test.a16_booking',
  (select resource_id::text from api.book_shift(
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift')::uuid,
    (select id from app.shift_positions
     where shift_id = current_setting('cluvo.test.a16_bar_shift')::uuid
     order by ordinal limit 1),
    '33000000-0000-4000-8000-000000000001',
    '36100000-0000-4000-8000-000000000007', 4,
    '38400000-0000-4000-8000-000000000008'
  )),
  true
);

select set_config('request.jwt.claim.sub', '31000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
select throws_ok(
  format(
    'select * from api.manage_planboard_shift(%L,%L,%L,%L,4,%L,%L,%L,%L,%L,%L,3,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift'),
    'move', 'drag',
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-03-01 09:30:00+01', '2027-03-01 12:30:00+01',
    '38400000-0000-4000-8000-000000000009'
  ),
  'P0001', 'PUBLISHED_SHIFT_REQUIRES_CHANGE_PROPOSAL',
  'A16/A17: a published drag move must use the change-proposal path'
);
select throws_ok(
  format(
    'select * from api.manage_planboard_shift(%L,%L,%L,%L,4,%L,%L,%L,%L,%L,%L,3,%L)',
    '32000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.a16_bar_shift'),
    'resize', 'form',
    '37200000-0000-4000-8000-000000000001',
    '35000000-0000-4000-8000-000000000001',
    '37000000-0000-4000-8000-000000000001',
    'A16 bardienst',
    '2027-05-02 10:00:00+02', '2027-05-02 14:00:00+02',
    '38400000-0000-4000-8000-00000000000a'
  ),
  'P0001', 'PUBLISHED_SHIFT_REQUIRES_CHANGE_PROPOSAL',
  'A16/A17: a published form resize must use the change-proposal path'
);
select ok(
  (select starts_at = '2027-05-02 10:00:00+02'::timestamptz
          and ends_at = '2027-05-02 13:00:00+02'::timestamptz
          and version = 4
   from app.shifts
   where id = current_setting('cluvo.test.a16_bar_shift')::uuid),
  'A16/A17: rejected published mutations leave the shift unchanged'
);
select is(
  (select state from app.bookings
   where id = current_setting('cluvo.test.a16_booking')::uuid),
  'booked',
  'A16/A17: the draft command cannot create booking impact on a published shift'
);
select ok(
  (select starts_at_snapshot = '2027-05-02 10:00:00+02'::timestamptz
          and ends_at_snapshot = '2027-05-02 13:00:00+02'::timestamptz
   from app.bookings
   where id = current_setting('cluvo.test.a16_booking')::uuid),
  'A16/A17: rejected direct planning never overwrites booking snapshots'
);
select is(
  (select count(*)::integer from app.booking_events
   where booking_id = current_setting('cluvo.test.a16_booking')::uuid
     and event_type = 'booking.reconfirmation_required'),
  0,
  'A16/A17: only the confirmed change-proposal path may emit impact events'
);

reset role;

-- Two-review database backstop: one actor cannot finalize by clicking twice or
-- switching UI role. Reviews are unique by both auth identity and natural person.
insert into app.exception_cases (
  id, tenant_id, obligation_id, case_type, requested_by_auth_user_id, state
) values (
  '38300000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '36100000-0000-4000-8000-000000000008',
  'reduction', '31000000-0000-4000-8000-000000000001', 'in_review'
);
insert into app.exception_case_revisions (
  id, tenant_id, case_id, revision, proposal_hash, practical_reason,
  proposed_target_minutes, proposed_winter_minutes,
  valid_from, created_by_auth_user_id
) values (
  '38310000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  '38300000-0000-4000-8000-000000000001', 1,
  extensions.digest('exception-proposal', 'sha256'),
  'Aangepaste praktische inzet', 480, 240, '2026-07-01',
  '31000000-0000-4000-8000-000000000001'
);
insert into app.exception_reviews (
  tenant_id, case_revision_id, reviewer_auth_user_id,
  reviewer_person_id, outcome, reason
) values (
  '32000000-0000-4000-8000-000000000001',
  '38310000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000003',
  '33000000-0000-4000-8000-000000000003',
  'approve', 'Eerste onafhankelijke beoordeling'
);
select throws_ok(
  $$insert into app.exception_decisions (
      tenant_id, case_revision_id, obligation_id, outcome,
      effective_target_minutes, effective_winter_minutes,
      valid_from, financial_route, finalized_by_auth_user_id, reason
    ) values (
      '32000000-0000-4000-8000-000000000001',
      '38310000-0000-4000-8000-000000000001',
      '36100000-0000-4000-8000-000000000008', 'approved',
      480, 240, '2026-07-01', 'none',
      '31000000-0000-4000-8000-000000000003', 'Te vroeg besluit'
    )$$,
  'P0001', 'SECOND_REVIEW_REQUIRED',
  'one reviewer can never finalize an exception'
);
insert into app.exception_reviews (
  tenant_id, case_revision_id, reviewer_auth_user_id,
  reviewer_person_id, outcome, reason
) values (
  '32000000-0000-4000-8000-000000000001',
  '38310000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000004',
  '33000000-0000-4000-8000-000000000004',
  'approve', 'Tweede onafhankelijke beoordeling'
);
select lives_ok(
  $$insert into app.exception_decisions (
      tenant_id, case_revision_id, obligation_id, outcome,
      effective_target_minutes, effective_winter_minutes,
      valid_from, financial_route, finalized_by_auth_user_id, reason
    ) values (
      '32000000-0000-4000-8000-000000000001',
      '38310000-0000-4000-8000-000000000001',
      '36100000-0000-4000-8000-000000000008', 'approved',
      480, 240, '2026-07-01', 'none',
      '31000000-0000-4000-8000-000000000004', 'Twee beoordelingen compleet'
    )$$,
  'two distinct authorized people satisfy the database review invariant'
);
select throws_ok(
  $$update app.exception_decisions
    set reason = 'achteraf gewijzigd'
    where case_revision_id = '38310000-0000-4000-8000-000000000001'$$,
  '55000', 'exception_decisions is append-only',
  'final decisions cannot be overwritten after creation'
);

select * from finish();
rollback;
