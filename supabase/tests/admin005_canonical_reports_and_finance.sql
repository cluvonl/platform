begin;
set local search_path=public,extensions;

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

-- SQL unit contexts use explicit disposable native session rows. Browser
-- integration separately obtains real OTP-issued sessions; this is no provider proof.
update auth.users set email_confirmed_at=statement_timestamp() where email_confirmed_at is null;
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,statement_timestamp(),statement_timestamp() from auth.users
on conflict(id) do nothing;
create function pg_temp.cluvo_test_claims(p_actor uuid) returns text
language sql security definer set search_path='' as $claims$
select jsonb_build_object('sub',p_actor,'role','authenticated','session_id',p_actor,
 'email',(select email from auth.users where id=p_actor))::text;
$claims$;


insert into app.household_access_grants(tenant_id,household_id,auth_user_id,can_view_progress,granted_by_auth_user_id)values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111',true,'22222222-2222-4222-8222-222222222222');

-- Separate real native actors and canonical financial procedures, not mocks.
set local role authenticated;
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims('22222222-2222-4222-8222-222222222222'),true);
select lives_ok($$select api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance','a3000000-0000-4000-8000-000000000001')$$,'committee can read its native financial work queue');
select is((api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,'a4000000-0000-4000-8000-000000000001')->'rows'->0->>'confirmed_minutes')::integer,540,'administration uses the exact canonical confirmed balance');
select is((api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,'a4000000-0000-4000-8000-000000000001')->'rows'->0->>'winter_deficit_minutes')::integer,360,'winter balance follows the canonical performed date');
select is((api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance')->'extras'->>'total_rows')::integer,5,'report count covers all authorized obligations without double household bookkeeping');
select is(jsonb_array_length(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,null,'','',2,2)->'rows'),2,'bounded report pagination is native');
select is(api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,null,'','',2,0)->'extras'->>'report_revision',api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,null,'','',2,2)->'extras'->>'report_revision','all report pages share a complete canonical revision fingerprint');
select lives_ok($$select * from api.recognize_volunteer_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a6100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000005','2026-07-01',null,null,null,1,'Bevoegd erkende trainer','ad500000-0000-4000-8000-000000000001')$$,'canonical structural recognition is separate from ledger minutes');
select is((api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,'a4000000-0000-4000-8000-000000000005')->'rows'->0->>'structurally_covered')::boolean,true,'admin report preserves structural coverage');
select is((api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance',null,'a4000000-0000-4000-8000-000000000005')->'rows'->0->>'remaining_minutes')::integer,0,'structurally covered household has no invented shortage');
select set_config('cluvo.admin.proposal',api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','prepare_assessment','a4000000-0000-4000-8000-000000000001',1,'{"route":"shortage","exception_decision_id":null,"supply_assessment_id":null,"reason":"Bevoegd onderbouwd financieel voorstel"}','ad600000-0000-4000-8000-000000000001')::text,true);
select is(current_setting('cluvo.admin.proposal')::jsonb->>'ok','true','admin form invokes the canonical financial preparation');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','prepare_assessment','a4000000-0000-4000-8000-000000000001',1,'{"route":"shortage","exception_decision_id":null,"supply_assessment_id":null,"reason":"Bevoegd onderbouwd financieel voorstel"}','ad600000-0000-4000-8000-000000000001')->>'resource_id',current_setting('cluvo.admin.proposal')::jsonb->>'resource_id','same command ID returns the same actual assessment');
select is(api.club_admin_command_status('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad600000-0000-4000-8000-000000000001')->>'state','confirmed','lost-response reconciliation uses the persisted admin command');
select throws_ok($$select api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finalize_assessment',(current_setting('cluvo.admin.proposal')::jsonb->>'resource_id')::uuid,1,'{"processing_kind":"controlled_export","reason":"Afgewezen onbevoegde verwerking"}','ad600000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','committee cannot bypass the distinct financial authority');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','approve_assessment',(current_setting('cluvo.admin.proposal')::jsonb->>'resource_id')::uuid,1,'{"reason":"Commissie controleert de actuele grondslag"}','ad600000-0000-4000-8000-000000000003')->>'ok','true','existing financial approval remains a separate persisted command');
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims('44444444-4444-4444-8444-444444444444'),true);
select throws_ok($$select api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finalize_assessment',(current_setting('cluvo.admin.proposal')::jsonb->>'resource_id')::uuid,1,'{"processing_kind":"controlled_export","reason":"Afgewezen verouderde grondslag"}','ad600000-0000-4000-8000-000000000004')$$,'40001','STALE_VERSION','stale approval version cannot be processed');
select is(api.club_admin_command('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finalize_assessment',(current_setting('cluvo.admin.proposal')::jsonb->>'resource_id')::uuid,2,'{"processing_kind":"controlled_export","reason":"Financiele rol verwerkt goedgekeurde grondslag"}','ad600000-0000-4000-8000-000000000005')->>'ok','true','authorized finance role processes the actual approved assessment');
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims('11111111-1111-4111-8111-111111111111'),true);
select is((select confirmed_minutes::integer from api.my_obligation_status where obligation_id='a4000000-0000-4000-8000-000000000001'),540,'member app shows the identical confirmed minutes after financial processing');
select is((select remaining_minutes::integer from api.my_obligation_status where obligation_id='a4000000-0000-4000-8000-000000000005'),0,'member app and administration share structural coverage calculation');
select is((select count(*)::integer from internal.canonical_obligation_status where household_id='a2000000-0000-4000-8000-000000000002'),0,'shared canonical view retains underlying cross-household RLS');
select throws_ok($$select api.club_admin_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','finance')$$,'42501','FORBIDDEN','ordinary member cannot enter financial administration');
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims('66666666-6666-4666-8666-666666666666'),true);
select is((select count(*)::integer from internal.canonical_obligation_status where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0,'shared calculation grants no cross-tenant raw projection');
reset role;
select is((select count(*)::integer from app.financial_assessments where obligation_id='a4000000-0000-4000-8000-000000000001'),1,'retries create exactly one canonical assessment');
select is((select count(*)::integer from app.financial_processing_records where obligation_id='a4000000-0000-4000-8000-000000000001'),1,'approved decision has exactly one processing record');
select is((select amount_cents from app.financial_processing_records where obligation_id='a4000000-0000-4000-8000-000000000001'),3750,'canonical shortage calculation retains exact eurocent rounding');
select is((select count(*)::integer from app.hour_ledger_entries where obligation_id='a4000000-0000-4000-8000-000000000005'),0,'structural coverage does not mint hours');
select is((select count(*)::integer from app.audit_events where action='admin.prepare_assessment'),1,'one administrative audit accompanies the canonical financial decision');
select * from finish();
rollback;
