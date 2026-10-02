begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'member@example.test', '{}', '{}', now(), now()),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'committee-a@example.test', '{}', '{}', now(), now()),
  ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'committee-b@example.test', '{}', '{}', now(), now()),
  ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'finance@example.test', '{}', '{}', now(), now()),
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'board@example.test', '{}', '{}', now(), now()),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'other-club@example.test', '{}', '{}', now(), now()),
  ('77777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'progress-only@example.test', '{}', '{}', now(), now());

insert into app.tenants (id, slug, name, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'club-a-wp11', 'Club A WP11', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'club-b-wp11', 'Club B WP11', 'active');

insert into app.persons (
  id, tenant_id, given_name, family_name, birth_date, birth_date_precision,
  membership_started_on, status
) values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mila', 'Lid', '1980-04-03', 'day', '2010-07-01', 'active'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Vera', 'Commissie', '1975-01-01', 'day', '2005-07-01', 'active'),
  ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ravi', 'Reviewer', '1976-01-01', 'day', '2006-07-01', 'active'),
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fien', 'Finance', '1977-01-01', 'day', '2007-07-01', 'active'),
  ('a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Bo', 'Board', '1978-01-01', 'day', '2008-07-01', 'active'),
  ('a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Onbekend', 'Datum', null, 'unknown', null, 'active'),
  ('a1000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Pia', 'Voortgang', '1982-01-01', 'day', '2012-07-01', 'active'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Andere', 'Club', '1985-01-01', 'day', '2015-07-01', 'active');

insert into app.account_person_links (tenant_id, auth_user_id, person_id, verified_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000002', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'a1000000-0000-4000-8000-000000000003', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'a1000000-0000-4000-8000-000000000004', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'a1000000-0000-4000-8000-000000000005', now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', 'a1000000-0000-4000-8000-000000000007', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666', 'b1000000-0000-4000-8000-000000000001', now());

insert into app.tenant_memberships (tenant_id, auth_user_id, status, starts_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'active', now() - interval '1 day'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'active', now() - interval '1 day'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'active', now() - interval '1 day'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'active', now() - interval '1 day'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', 'active', now() - interval '1 day'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', 'active', now() - interval '1 day'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '66666666-6666-4666-8666-666666666666', 'active', now() - interval '1 day');

insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, starts_at, granted_by_auth_user_id
)
select grant_data.tenant_id, grant_data.auth_user_id, role_row.id, 'tenant',
  now() - interval '1 day', grant_data.auth_user_id
from (values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'member'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'volunteer_committee'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '33333333-3333-4333-8333-333333333333'::uuid, 'volunteer_committee'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '44444444-4444-4444-8444-444444444444'::uuid, 'finance'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '55555555-5555-4555-8555-555555555555'::uuid, 'board'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '77777777-7777-4777-8777-777777777777'::uuid, 'member'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '66666666-6666-4666-8666-666666666666'::uuid, 'member')
) as grant_data(tenant_id, auth_user_id, role_key)
join app.permission_roles as role_row
  on role_row.tenant_id = grant_data.tenant_id and role_row.role_key = grant_data.role_key;

insert into app.households (id, tenant_id, label, intake_code_hash) values
  ('a2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'H1', extensions.digest('h1','sha256')),
  ('a2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'H2', extensions.digest('h2','sha256')),
  ('a2000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'H3', extensions.digest('h3','sha256')),
  ('a2000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'H4', extensions.digest('h4','sha256')),
  ('a2000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'H5', extensions.digest('h5','sha256')),
  ('a2000000-0000-4000-8000-000000000006', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'H6 voortgang', extensions.digest('h6','sha256')),
  ('b2000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'HB', extensions.digest('hb','sha256'));

insert into app.household_person_links (
  tenant_id, household_id, person_id, kind, starts_at, verified_by_auth_user_id
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'member', '2020-01-01', '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'executor', '2020-01-01', '22222222-2222-4222-8222-222222222222'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000007', 'member', '2020-01-01', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'member', '2020-01-01', '66666666-6666-4666-8666-666666666666');

insert into app.household_access_grants (
  tenant_id, household_id, auth_user_id, can_view_progress, starts_at, granted_by_auth_user_id
) values
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111', true, now() - interval '1 day',
  '22222222-2222-4222-8222-222222222222'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000006',
  '77777777-7777-4777-8777-777777777777', true, now() - interval '1 day',
  '22222222-2222-4222-8222-222222222222'
);

insert into app.seasons (
  id, tenant_id, name, starts_on, ends_on, winter_cutoff_at,
  target_minutes, winter_target_minutes, status
) values
  ('a3000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026/2027', '2026-07-01', '2027-06-30', '2026-12-21 00:00+01', 720, 360, 'active'),
  ('a3000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2027/2028', '2027-07-01', '2028-06-30', '2027-12-21 00:00+01', 720, 360, 'preparing'),
  ('b3000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026/2027', '2026-07-01', '2027-06-30', '2026-12-21 00:00+01', 720, 360, 'active');

insert into app.obligations (
  id, tenant_id, season_id, assessed_household_id, base_target_minutes,
  effective_target_minutes, effective_winter_minutes, status, ledger_revision
) values
  ('a4000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 1),
  ('a4000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 720, 480, 240, 'active', 1),
  ('a4000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000003', 720, 720, 360, 'active', 1),
  ('a4000000-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 720, 720, 360, 'fulfilled', 1),
  ('a4000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000005', 720, 720, 360, 'active', 0),
  ('b4000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 720, 720, 360, 'active', 0);

insert into app.household_obligation_links (tenant_id, household_id, obligation_id, link_kind, starts_at)
select tenant_id, assessed_household_id, id, 'liable', '2026-07-01'
from app.obligations;

insert into app.household_obligation_links (
  tenant_id, household_id, obligation_id, link_kind, starts_at
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a2000000-0000-4000-8000-000000000006',
  'a4000000-0000-4000-8000-000000000001', 'progress_only', '2026-07-01'
);

insert into app.hour_ledger_entries (
  tenant_id, obligation_id, season_id, entry_kind, minutes_delta,
  performed_at, actor_auth_user_id, idempotency_key
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'award', 540, '2027-05-01', '22222222-2222-4222-8222-222222222222', 'a5000000-0000-4000-8000-000000000001'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', 'award', 360, '2027-05-01', '22222222-2222-4222-8222-222222222222', 'a5000000-0000-4000-8000-000000000002'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000001', 'award', 700, '2027-05-01', '22222222-2222-4222-8222-222222222222', 'a5000000-0000-4000-8000-000000000003'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000001', 'award', 780, '2027-05-01', '22222222-2222-4222-8222-222222222222', 'a5000000-0000-4000-8000-000000000004');

-- A05/A06: a recognised exempting role covers the household without minutes
-- or access rights, and ending it creates a review rather than a bill.
insert into app.volunteer_role_catalog (id, tenant_id, name) values
  ('a6000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Trainer');
insert into app.volunteer_role_versions (
  id, tenant_id, role_id, revision, household_exempt, effective_from,
  approved_by_auth_user_id
) values (
  'a6100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a6000000-0000-4000-8000-000000000001', 1, true, '2026-07-01',
  '22222222-2222-4222-8222-222222222222'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$
  select * from api.recognize_volunteer_appointment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a6100000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000005',
    'a4000000-0000-4000-8000-000000000005', '2026-07-01', null, null, null,
    1, 'Erkende trainer', 'a6200000-0000-4000-8000-000000000001'
  )
$$, 'A05 recognised role command succeeds');
reset role;
select ok(exists (
  select 1 from app.obligation_coverage_decisions
  where obligation_id = 'a4000000-0000-4000-8000-000000000005'
    and effect = 'household_exempt'
), 'A05 whole household has structural coverage');
select is((select coalesce(sum(minutes_delta), 0)::integer from app.hour_ledger_entries
  where obligation_id = 'a4000000-0000-4000-8000-000000000005'), 0,
  'A05 structural coverage creates no fictitious minutes');
select is((select count(*)::integer from app.access_grants
  where auth_user_id = '11111111-1111-4111-8111-111111111111'), 1,
  'A05 structural role creates no new system permission');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$
  select * from api.prepare_financial_assessment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000005',
    'shortage', null, null, 2, 'a6300000-0000-4000-8000-000000000001'
  )
$$, 'full household coverage prepares a zero shortage proposal');
reset role;
select is((select proposed_cents from app.assessment_revisions
  where assessment_id = (select id from app.financial_assessments
    where obligation_id = 'a4000000-0000-4000-8000-000000000005')), 0,
  'full exemption yields zero cents');
update app.financial_assessments set state = 'void', version = version + 1,
  updated_at = statement_timestamp()
where obligation_id = 'a4000000-0000-4000-8000-000000000005';

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$
  select * from api.end_volunteer_appointment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.volunteer_appointments where obligation_id = 'a4000000-0000-4000-8000-000000000005'),
    1, '2027-01-15', 'Rol eindigt tussentijds', 'a6200000-0000-4000-8000-000000000002'
  )
$$, 'A06 ending an appointment succeeds');
reset role;
select ok(exists (select 1 from app.appointment_review_cases
  where obligation_id = 'a4000000-0000-4000-8000-000000000005' and state = 'open'),
  'A06 ending creates an obligation review');
select is((select count(*)::integer from app.financial_processing_records
  where obligation_id = 'a4000000-0000-4000-8000-000000000005'), 0,
  'A06 ending creates no automatic invoice/export');

-- A26 reviewer distinctness is enforced by both auth identity and person.
insert into app.exception_cases (
  id, tenant_id, obligation_id, case_type, requested_by_auth_user_id, state
) values (
  'a7000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a4000000-0000-4000-8000-000000000002', 'reduction',
  '11111111-1111-4111-8111-111111111111', 'in_review'
);
insert into app.exception_case_revisions (
  id, tenant_id, case_id, revision, proposal_hash, practical_reason,
  proposed_target_minutes, proposed_winter_minutes, valid_from, created_by_auth_user_id
) values (
  'a7100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a7000000-0000-4000-8000-000000000001', 1, extensions.digest('proposal','sha256'),
  'Praktisch verminderd', 480, 240, '2026-07-01', '11111111-1111-4111-8111-111111111111'
);
insert into app.exception_reviews (
  tenant_id, case_revision_id, reviewer_auth_user_id, reviewer_person_id, outcome, reason
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7100000-0000-4000-8000-000000000001',
  '22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000002',
  'approve', 'Passend binnen beleid'
);
select throws_ok($$
  insert into app.exception_decisions (
    tenant_id, case_revision_id, obligation_id, outcome,
    effective_target_minutes, effective_winter_minutes, valid_from,
    finalized_by_auth_user_id, reason
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7100000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000002', 'approved', 480, 240, '2026-07-01',
    '22222222-2222-4222-8222-222222222222', 'Te vroeg'
  )
$$, 'P0001', 'SECOND_REVIEW_REQUIRED', 'A26 one reviewer cannot finalize');
insert into app.exception_reviews (
  tenant_id, case_revision_id, reviewer_auth_user_id, reviewer_person_id, outcome, reason
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7100000-0000-4000-8000-000000000001',
  '33333333-3333-4333-8333-333333333333', 'a1000000-0000-4000-8000-000000000003',
  'approve', 'Tweede onafhankelijke beoordeling'
);
insert into app.exception_decisions (
  tenant_id, case_revision_id, obligation_id, outcome,
  effective_target_minutes, effective_winter_minutes, valid_from,
  finalized_by_auth_user_id, reason
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7100000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000002', 'approved', 480, 240, '2026-07-01',
  '33333333-3333-4333-8333-333333333333', 'Twee beoordelingen compleet'
);
update app.exception_cases set state = 'approved', version = version + 1
where id = 'a7000000-0000-4000-8000-000000000001';

-- Exact cent/minute examples: 180=>3750, 120=>2500, 20=>417, extra=>0.
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$
  select * from api.prepare_financial_assessment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a4000000-0000-4000-8000-000000000001', 'shortage', null, null, 1,
    'a8000000-0000-4000-8000-000000000001')
$$, 'A26 9-hour assessment is prepared');
select lives_ok($$
  select * from api.prepare_financial_assessment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a4000000-0000-4000-8000-000000000002', 'shortage', null, null, 1,
    'a8000000-0000-4000-8000-000000000002')
$$, 'reduced-target assessment is prepared');
select lives_ok($$
  select * from api.prepare_financial_assessment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a4000000-0000-4000-8000-000000000003', 'shortage', null, null, 1,
    'a8000000-0000-4000-8000-000000000003')
$$, '20-minute assessment is prepared');
select lives_ok($$
  select * from api.prepare_financial_assessment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'a4000000-0000-4000-8000-000000000004', 'shortage', null, null, 1,
    'a8000000-0000-4000-8000-000000000004')
$$, 'over-delivery assessment is prepared');
reset role;
select results_eq(
  $$select obligation_id, missing_minutes, proposed_cents from app.assessment_revisions
    where obligation_id in (
      'a4000000-0000-4000-8000-000000000001',
      'a4000000-0000-4000-8000-000000000002',
      'a4000000-0000-4000-8000-000000000003',
      'a4000000-0000-4000-8000-000000000004'
    ) order by obligation_id$$,
  $$values
    ('a4000000-0000-4000-8000-000000000001'::uuid, 180, 3750),
    ('a4000000-0000-4000-8000-000000000002'::uuid, 120, 2500),
    ('a4000000-0000-4000-8000-000000000003'::uuid, 20, 417),
    ('a4000000-0000-4000-8000-000000000004'::uuid, 0, 0)$$,
  'finance uses minutes and rounds the total exactly once'
);

-- Approved buyout is a distinct 15,000-cent route and cannot coexist with a
-- shortage assessment for the same obligation/season.
update app.financial_assessments as assessment
set state = 'void', version = assessment.version + 1, updated_at = now()
where obligation_id = 'a4000000-0000-4000-8000-000000000004';
insert into app.exception_cases (
  id, tenant_id, obligation_id, case_type, requested_by_auth_user_id, state
) values (
  'a7010000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a4000000-0000-4000-8000-000000000004', 'buyout',
  '11111111-1111-4111-8111-111111111111', 'in_review'
);
insert into app.exception_case_revisions (
  id, tenant_id, case_id, revision, proposal_hash, practical_reason,
  proposed_target_minutes, proposed_winter_minutes, valid_from, created_by_auth_user_id
) values (
  'a7110000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a7010000-0000-4000-8000-000000000001', 1, extensions.digest('buyout','sha256'),
  'Geen passende taak beschikbaar', 720, 360, '2026-07-01',
  '11111111-1111-4111-8111-111111111111'
);
insert into app.exception_reviews (
  tenant_id, case_revision_id, reviewer_auth_user_id, reviewer_person_id, outcome, reason
) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7110000-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'a1000000-0000-4000-8000-000000000002',
   'approve', 'Aanbod gecontroleerd'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a7110000-0000-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333', 'a1000000-0000-4000-8000-000000000003',
   'approve', 'Onafhankelijk bevestigd');
insert into app.exception_decisions (
  id, tenant_id, case_revision_id, obligation_id, outcome,
  effective_target_minutes, effective_winter_minutes, valid_from, financial_route,
  finalized_by_auth_user_id, reason
) values (
  'a7120000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a7110000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000004',
  'approved', 720, 360, '2026-07-01', 'buyout',
  '33333333-3333-4333-8333-333333333333', 'Volledige afkoop na aanbodcontrole'
);
update app.exception_cases set state = 'approved', version = version + 1
where id = 'a7010000-0000-4000-8000-000000000001';
insert into app.supply_assessments (
  id, tenant_id, obligation_id, season_id, period_start, period_end,
  required_minutes, suitable_capacity_minutes, alternatives, outcome,
  evidence_hash, assessed_by_auth_user_id
) values (
  'a7130000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a4000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000001',
  '2026-07-01', '2027-06-30', 720, 0, '[]', 'insufficient',
  extensions.digest('geen-passend-aanbod','sha256'), '22222222-2222-4222-8222-222222222222'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$select * from api.prepare_financial_assessment(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000004',
  'buyout', 'a7120000-0000-4000-8000-000000000001',
  'a7130000-0000-4000-8000-000000000001', 1,
  'a8140000-0000-4000-8000-000000000001')$$,
  'A26 approved insufficient-supply decision creates buyout route');
select throws_ok($$select * from api.prepare_financial_assessment(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a4000000-0000-4000-8000-000000000004',
  'shortage', null, null, 1, 'a8140000-0000-4000-8000-000000000002')$$,
  '23505', 'FINANCIAL_ROUTE_EXISTS',
  'A26 buyout cannot receive a second shortage route');
reset role;
select is((select proposed_cents from app.assessment_revisions
  where assessment_id = (select id from app.financial_assessments
    where obligation_id = 'a4000000-0000-4000-8000-000000000004' and state = 'draft')),
  15000, 'A26 buyout is exactly 150 euro');

-- An objection blocks approval until resolved; financial processing is a
-- separate actor/step and is unique.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$
  select * from api.open_financial_objection(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.financial_assessments where obligation_id = 'a4000000-0000-4000-8000-000000000001'),
    1, 'Een uur ontbreekt', 'a8100000-0000-4000-8000-000000000001')
$$, 'member can open a scoped financial objection');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select throws_ok($$
  select * from api.approve_financial_assessment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.financial_assessments where obligation_id = 'a4000000-0000-4000-8000-000000000001'),
    2, 'a8200000-0000-4000-8000-000000000001')
$$, 'P0001', 'FINANCIAL_BLOCKED', 'A26 open objection blocks committee approval');
select lives_ok($$
  select * from api.resolve_financial_objection(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.financial_objections where assessment_id =
      (select id from app.financial_assessments where obligation_id = 'a4000000-0000-4000-8000-000000000001')),
    1, 'resolved', 'Ledger gecontroleerd', 'a8200000-0000-4000-8000-000000000002')
$$, 'committee resolves the objection');
select lives_ok($$
  select * from api.approve_financial_assessment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.financial_assessments where obligation_id = 'a4000000-0000-4000-8000-000000000001'),
    2, 'a8200000-0000-4000-8000-000000000003')
$$, 'committee approval succeeds after resolution');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select lives_ok($$
  select * from api.finalize_financial_assessment(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.financial_assessments where obligation_id = 'a4000000-0000-4000-8000-000000000001'),
    3, 'controlled_export', 'a8300000-0000-4000-8000-000000000001')
$$, 'finance separately finalizes exactly one processing basis');
select lives_ok($$
  select * from api.record_financial_correction(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select id from app.financial_assessments where obligation_id = 'a4000000-0000-4000-8000-000000000001'),
    4, 'credit', -500, 'Herziening na betaling', 'a8300000-0000-4000-8000-000000000002')
$$, 'post-close correction is append-only and requests reassessment');
reset role;
select is((select count(*)::integer from app.financial_processing_records
  where obligation_id = 'a4000000-0000-4000-8000-000000000001'), 1,
  'A26 exactly one financial processing basis exists');
select throws_ok($$update app.financial_corrections set amount_delta_cents = -1$$,
  '55000', 'financial_corrections is append-only', 'financial corrections are immutable');

insert into app.payment_events (
  tenant_id, processing_record_id, event_kind, amount_cents,
  provider_event_id, occurred_at, recorded_by_auth_user_id
)
select
  processing.tenant_id, processing.id, 'paid', processing.amount_cents,
  'progress-only-negative-evidence', statement_timestamp(),
  '44444444-4444-4444-8444-444444444444'
from app.financial_processing_records as processing
where processing.obligation_id = 'a4000000-0000-4000-8000-000000000001';

select set_config(
  'test.progress_only_assessment_id',
  (select id::text from app.financial_assessments
   where obligation_id = 'a4000000-0000-4000-8000-000000000001'),
  true
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-4777-8777-777777777777', true);
select is((select count(*)::integer from api.household_progress
  where obligation_id = 'a4000000-0000-4000-8000-000000000001'), 1,
  'same-tenant progress-only actor can read the reduced household progress');
select is((select count(*)::integer from app.financial_assessments), 0,
  'same-tenant progress-only actor cannot read financial assessments');
select is((select count(*)::integer from app.assessment_revisions), 0,
  'same-tenant progress-only actor cannot read assessment revisions');
select is((select count(*)::integer from app.financial_processing_records), 0,
  'same-tenant progress-only actor cannot read financial processing records');
select is((select count(*)::integer from app.payment_events), 0,
  'same-tenant progress-only actor cannot read payment events');
select is((select count(*)::integer from app.financial_corrections), 0,
  'same-tenant progress-only actor cannot read financial corrections');
select is((select count(*)::integer from app.financial_objections), 0,
  'same-tenant progress-only actor cannot read financial objections');
select throws_ok($$
  select * from api.open_financial_objection(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    current_setting('test.progress_only_assessment_id')::uuid,
    5, 'Geen aansprakelijke partij', 'a8310000-0000-4000-8000-000000000001'
  )
$$, '42501', 'FORBIDDEN',
  'same-tenant progress-only actor cannot open a financial objection');
reset role;

-- Volunteer fund: receipt -> reservation -> expense consumes the reservation
-- once and does not leave a second reservation burden.
set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select lives_ok($$select * from api.post_volunteer_fund_entry(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'receipt', 10000, null, null, null,
  'Ontvangen bijdrage', null, 'a8400000-0000-4000-8000-000000000001')$$,
  'fund receipt posts');
select lives_ok($$select * from api.post_volunteer_fund_entry(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'reserve', 10000,
  'a8500000-0000-4000-8000-000000000001', null, null,
  'Opleidingsbudget', null, 'a8400000-0000-4000-8000-000000000002')$$,
  'fund reservation posts');
select lives_ok($$select * from api.post_volunteer_fund_entry(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'spend_reserved', 10000,
  'a8500000-0000-4000-8000-000000000001', null, null,
  'Opleiding betaald', null, 'a8400000-0000-4000-8000-000000000003')$$,
  'reserved expense posts');
select throws_ok($$select * from api.post_volunteer_fund_entry(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'spend_reserved', 10000,
  'a8500000-0000-4000-8000-000000000001', null, null,
  'Dubbele uitgave', null, 'a8400000-0000-4000-8000-000000000004')$$,
  '23514', 'FUND_BALANCE_INSUFFICIENT',
  'the same reserved budget cannot be spent twice');
reset role;
select results_eq(
  $$select available_cents, reserved_cents, spent_cents from api.volunteer_fund_balance$$,
  $$values (0::bigint, 0::bigint, 10000::bigint)$$,
  'fund reservation is consumed once'
);

-- A27: expired qualification remains visible; vacancy interest creates no
-- appointment/right; workload alert is deduplicated.
insert into app.qualification_types (id, tenant_id, name) values
  ('a9000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'EHBO');
insert into app.person_qualifications (
  id, tenant_id, person_id, qualification_type_id, achieved_at, expires_at, verified_by_auth_user_id
) values (
  'a9100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a1000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001',
  '2025-01-01', '2026-01-01', '22222222-2222-4222-8222-222222222222'
);
insert into app.qualification_events (
  tenant_id, qualification_id, person_id, event_kind, effective_at, reason, actor_auth_user_id
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a9100000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001', 'expired', '2026-01-01',
  'Geldigheid verstreken', '22222222-2222-4222-8222-222222222222'
);
insert into app.vacancies (
  id, tenant_id, role_version_id, title, description, expected_minutes,
  contact_person_id, state, opens_at
) values (
  'a9200000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a6100000-0000-4000-8000-000000000001', 'Trainer gezocht', 'Kennismaking eerst', 240,
  'a1000000-0000-4000-8000-000000000002', 'published', now() - interval '1 day'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok($$select * from api.express_vacancy_interest(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a9200000-0000-4000-8000-000000000001',
  'Graag kennismaken', 'a9300000-0000-4000-8000-000000000001')$$,
  'A27 member expresses vacancy interest');
reset role;
select is((select count(*)::integer from app.appointment_cases), 0,
  'A27 interest alone does not create an appointment case');
select is((select count(*)::integer from app.access_grants
  where auth_user_id = '11111111-1111-4111-8111-111111111111'), 1,
  'A27 interest grants no system role');
insert into app.workload_alerts (
  tenant_id, person_id, season_id, period_start, period_end,
  alert_kind, observed_minutes, preferred_minutes, dedupe_key
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-31',
  'over_preference', 600, 240, 'person-1:2026-07:over'
);
select throws_ok($$insert into app.workload_alerts (
  tenant_id, person_id, season_id, period_start, period_end,
  alert_kind, observed_minutes, preferred_minutes, dedupe_key
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-31',
  'over_preference', 600, 240, 'person-1:2026-07:over')$$,
  '23505', null, 'A27 workload signal is deduplicated');

-- A28: reliable date only, one occasion/action, private welfare detail hidden.
insert into app.appreciation_rules (
  id, tenant_id, name, source_kind, action_kind, default_budget_cents
) values (
  'aa000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Verjaardag', 'birthday', 'action_card', 2500
);
insert into app.appreciation_occasions (
  id, tenant_id, rule_id, person_id, source_date, period_key, source_verified
) values (
  'aa100000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aa000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  '1980-04-03', '2027', true
);
select throws_ok($$insert into app.appreciation_occasions (
  tenant_id, rule_id, person_id, source_date, period_key, source_verified
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001', '1980-04-03', '2027', true)$$,
  '23505', null, 'A28 same occasion is deduplicated across committees');
select throws_ok($$insert into app.appreciation_occasions (
  tenant_id, rule_id, person_id, source_date, period_key, source_verified
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000006', '2000-01-01', '2027', true)$$,
  '23514', 'BIRTH_DATE_INCOMPLETE', 'A28 incomplete birth date creates no invented occasion');
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok($$select * from api.create_appreciation_action(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa100000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002', '2027-04-01', 2500,
  'aa200000-0000-4000-8000-000000000001')$$,
  'A28 creates one traceable appreciation action');
reset role;
insert into app.appreciation_private_details (
  tenant_id, occasion_id, detail, recorded_by_auth_user_id
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa100000-0000-4000-8000-000000000001',
  'Besloten lief-en-leednotitie', '22222222-2222-4222-8222-222222222222'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*)::integer from app.appreciation_private_details), 0,
  'A28 subject without management right cannot read private welfare detail');
reset role;

-- A30: report counts a household once across teams, close snapshot is
-- immutable, and retrying rollover creates neither obligations nor minutes.
insert into app.teams (id, tenant_id, name) values
  ('aa300000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Team 1'),
  ('aa300000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Team 2');
insert into app.team_person_memberships (tenant_id, team_id, person_id, membership_kind, starts_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa300000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'player', '2026-07-01'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aa300000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'player', '2026-07-01');
insert into app.intake_profiles (
  id, tenant_id, person_id, household_context_id, status
) values (
  'aa400000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'submitted'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select is((select team_count from api.season_household_report
  where obligation_id = 'a4000000-0000-4000-8000-000000000001'), 2,
  'A30 one household can be linked to two teams');
select is((select distinct_households from api.season_summary
  where season_id = 'a3000000-0000-4000-8000-000000000001'), 5,
  'A30 club aggregate counts five households, not team memberships');
reset role;

update app.appointment_review_cases
set state = 'resolved', resolved_by_auth_user_id = '22222222-2222-4222-8222-222222222222',
  resolved_at = now(), updated_at = now(), version = version + 1
where obligation_id = 'a4000000-0000-4000-8000-000000000005';
update app.financial_assessments
set state = case when state = 'reassessment_required' then 'superseded' else 'void' end,
  updated_at = now(), version = version + 1
where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and state in ('draft', 'reassessment_required');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select lives_ok($$select * from api.close_season(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001',
  1, 'aa500000-0000-4000-8000-000000000001')$$,
  'A30 controlled season close creates snapshots');
reset role;
select is((select count(*)::integer from app.season_snapshots
  where season_id = 'a3000000-0000-4000-8000-000000000001'), 5,
  'A30 one immutable snapshot exists per obligation');
select throws_ok($$update app.season_snapshots set confirmed_minutes = 0$$,
  '55000', 'season_snapshots is append-only', 'A30 closed snapshot cannot be overwritten');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select lives_ok($$select * from api.rollover_season(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002', array['normal-saturday'], 1,
  'aa600000-0000-4000-8000-000000000001')$$,
  'A30 rollover succeeds');
select lives_ok($$select * from api.rollover_season(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002', array['normal-saturday'], 1,
  'aa600000-0000-4000-8000-000000000001')$$,
  'A30 same rollover key is an idempotent replay');
reset role;
select is((select count(*)::integer from app.rollover_runs), 1,
  'A30 one rollover run exists');
select is((select count(*)::integer from app.obligations
  where season_id = 'a3000000-0000-4000-8000-000000000002'), 5,
  'A30 rollover creates one new obligation per old household');
select is((select count(*)::integer from app.hour_ledger_entries
  where season_id = 'a3000000-0000-4000-8000-000000000002'), 0,
  'A30 old minutes and overage are not carried into the new season');
select ok(exists (select 1 from app.season_reconfirmation_items
  where subject_kind = 'intake' and state = 'open'),
  'A30 rollover requests intake reconfirmation');

-- Security regression: an ended booking without an attendance decision blocks
-- both financial approval and season close.  Once finance is finalized, a
-- ledger correction must first create an explicit reassessment record; after
-- season close even that route may not rewrite the captured minutes.
insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, starts_at, granted_by_auth_user_id
)
select
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '66666666-6666-4666-8666-666666666666',
  role_row.id,
  'tenant',
  statement_timestamp() - interval '1 day',
  '66666666-6666-4666-8666-666666666666'
from app.permission_roles as role_row
where role_row.tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  and role_row.role_key in ('volunteer_committee', 'finance', 'board');

insert into app.committees (id, tenant_id, slug, name) values (
  'bb000000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'security-regression',
  'Security regression'
);
insert into app.task_categories (id, tenant_id, committee_id, name) values (
  'bb100000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bb000000-0000-4000-8000-000000000001',
  'Security category'
);
insert into app.task_types (id, tenant_id, category_id, name) values (
  'bb200000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bb100000-0000-4000-8000-000000000001',
  'Security task'
);
insert into app.task_type_versions (
  id, tenant_id, task_type_id, revision, credit_minutes, approved_by_auth_user_id
) values (
  'bb300000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bb200000-0000-4000-8000-000000000001',
  1, 120, '66666666-6666-4666-8666-666666666666'
);
insert into app.shifts (
  id, tenant_id, type_version_id, committee_id, category_id, title,
  starts_at, ends_at, credit_minutes, cancellation_minutes, state, published_at
) values (
  'bb400000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bb300000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'bb100000-0000-4000-8000-000000000001',
  'Ended booking without decision',
  '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02',
  120, 2880, 'published', '2026-08-01 10:00:00+02'
);
insert into app.shift_positions (
  id, tenant_id, shift_id, ordinal, starts_at, ends_at
) values (
  'bb500000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bb400000-0000-4000-8000-000000000001',
  1, '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02'
);
insert into app.bookings (
  id, tenant_id, position_id, executor_person_id, obligation_id, state,
  booked_by_auth_user_id, starts_at_snapshot, ends_at_snapshot,
  credit_minutes_snapshot, cancellation_deadline_snapshot,
  task_version_snapshot, idempotency_key
) values (
  'bb600000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bb500000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  'booked', '66666666-6666-4666-8666-666666666666',
  '2026-09-01 10:00:00+02', '2026-09-01 12:00:00+02',
  120, '2026-08-30 10:00:00+02',
  'bb300000-0000-4000-8000-000000000001',
  'bb610000-0000-4000-8000-000000000001'
);

select has_trigger(
  'app', 'hour_ledger_entries', 'hour_ledger_entries_financial_season_guard',
  'all ledger appends use the financial and season guard'
);
select ok(
  not has_function_privilege(
    'authenticated', 'internal.lock_season_ledger(uuid,uuid)', 'EXECUTE'
  ),
  'clients cannot acquire or manipulate the internal season ledger lock'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select lives_ok($$
  select * from api.prepare_financial_assessment(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b4000000-0000-4000-8000-000000000001',
    'shortage', null, null, 1,
    'bb700000-0000-4000-8000-000000000001'
  )
$$, 'ended undecided booking may be inspected in a draft assessment');
reset role;

select ok(
  (
    select blockers ? 'PENDING_ATTENDANCE'
    from app.assessment_revisions
    where assessment_id = (
      select id from app.financial_assessments
      where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        and obligation_id = 'b4000000-0000-4000-8000-000000000001'
        and state = 'draft'
    )
  ),
  'ended booking without a decision is captured as a financial blocker'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select throws_ok($$
  select * from api.approve_financial_assessment(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (select id from app.financial_assessments
      where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        and obligation_id = 'b4000000-0000-4000-8000-000000000001'
        and state = 'draft'),
    1, 'bb710000-0000-4000-8000-000000000001'
  )
$$, 'P0001', 'FINANCIAL_BLOCKED',
  'ended booking without a decision blocks financial approval');
reset role;

update app.financial_assessments
set state = 'void', version = version + 1, updated_at = statement_timestamp()
where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  and obligation_id = 'b4000000-0000-4000-8000-000000000001'
  and state = 'draft';

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select throws_ok($$
  select * from api.close_season(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b3000000-0000-4000-8000-000000000001',
    1, 'bb720000-0000-4000-8000-000000000001'
  )
$$, 'P0001', 'SEASON_CLOSE_BLOCKED',
  'ended booking without a decision blocks season close');

select lives_ok($$
  select * from api.confirm_attendance(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bb600000-0000-4000-8000-000000000001',
    1, 'present', null, null,
    'bb730000-0000-4000-8000-000000000001'
  )
$$, 'attendance decision resolves the ended-booking blocker');

select lives_ok($$
  select * from api.prepare_financial_assessment(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b4000000-0000-4000-8000-000000000001',
    'shortage', null, null, 2,
    'bb700000-0000-4000-8000-000000000002'
  )
$$, 'fresh assessment uses the decided ledger revision');
select lives_ok($$
  select * from api.approve_financial_assessment(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (select id from app.financial_assessments
      where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        and obligation_id = 'b4000000-0000-4000-8000-000000000001'
        and state = 'draft'),
    1, 'bb710000-0000-4000-8000-000000000002'
  )
$$, 'fresh financial assessment is approved');
select lives_ok($$
  select * from api.finalize_financial_assessment(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (select id from app.financial_assessments
      where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        and obligation_id = 'b4000000-0000-4000-8000-000000000001'
        and state = 'committee_approved'),
    2, 'controlled_export', 'bb740000-0000-4000-8000-000000000001'
  )
$$, 'fresh assessment is finalized on its exact ledger basis');

select throws_ok($$
  select * from api.correct_attendance_award(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bb600000-0000-4000-8000-000000000001',
    2, 'partial', 60, 'Late administrative finding',
    'bb750000-0000-4000-8000-000000000001'
  )
$$, 'P0001', 'FINANCIAL_REASSESSMENT_REQUIRED',
  'finalized financial basis rejects a silent late ledger rewrite');

select lives_ok($$
  select * from api.record_financial_correction(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    (select id from app.financial_assessments
      where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        and obligation_id = 'b4000000-0000-4000-8000-000000000001'
        and state = 'finalized'),
    3, 'reassessment', 0, 'Ledger must be reassessed before correction',
    'bb760000-0000-4000-8000-000000000001'
  )
$$, 'explicit financial correction opens reassessment');

select lives_ok($$
  select * from api.correct_attendance_award(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bb600000-0000-4000-8000-000000000001',
    2, 'partial', 60, 'Late administrative finding',
    'bb750000-0000-4000-8000-000000000002'
  )
$$, 'ledger correction proceeds only after explicit reassessment');
reset role;

select is(
  (select count(*)::integer from app.financial_corrections
    where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'reassessment route leaves one immutable financial correction record'
);
select is(
  (select count(*)::integer from app.hour_ledger_entries
    where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and obligation_id = 'b4000000-0000-4000-8000-000000000001'),
  3,
  'allowed correction preserves award, reversal and replacement rows'
);

update app.financial_assessments
set state = 'void', version = version + 1, updated_at = statement_timestamp()
where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  and obligation_id = 'b4000000-0000-4000-8000-000000000001'
  and state = 'reassessment_required';

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select lives_ok($$
  select * from api.close_season(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'b3000000-0000-4000-8000-000000000001',
    1, 'bb720000-0000-4000-8000-000000000002'
  )
$$, 'season closes only after attendance and finance blockers are resolved');

select throws_ok($$
  select * from api.correct_attendance_award(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bb600000-0000-4000-8000-000000000001',
    3, 'present', null, 'Attempt after immutable season close',
    'bb750000-0000-4000-8000-000000000003'
  )
$$, '55000', 'SEASON_LEDGER_CLOSED',
  'closed season rejects any later ledger mutation');
reset role;

select is(
  (select count(*)::integer from app.hour_ledger_entries
    where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and obligation_id = 'b4000000-0000-4000-8000-000000000001'),
  3,
  'failed post-close correction leaves the captured ledger unchanged'
);
select is(
  (select count(*)::integer from app.attendance_decisions
    where tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and booking_id = 'bb600000-0000-4000-8000-000000000001'),
  2,
  'failed post-close command rolls back its provisional attendance decision'
);

-- Tenant compound FK and RLS denial are explicit negative evidence.
select throws_ok($$insert into app.supply_assessments (
  tenant_id, obligation_id, season_id, period_start, period_end,
  required_minutes, suitable_capacity_minutes, outcome, evidence_hash,
  assessed_by_auth_user_id
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'b4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001', '2026-07-01', '2027-06-30',
  720, 0, 'insufficient', extensions.digest('cross-tenant','sha256'),
  '22222222-2222-4222-8222-222222222222')$$,
  '23503', null, 'compound FK rejects a cross-tenant financial source');
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select is((select count(*)::integer from app.financial_assessments
  where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0,
  'tenant B cannot read tenant A financial assessments');
select ok(not has_table_privilege('authenticated', 'app.financial_assessments', 'INSERT'),
  'authenticated cannot bypass financial commands with direct INSERT');
select ok(not has_table_privilege('authenticated', 'app.volunteer_fund_entries', 'UPDATE'),
  'authenticated cannot rewrite volunteer fund history');
reset role;

select * from finish();
rollback;
