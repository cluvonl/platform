begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('d1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'member@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('d1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'functionary@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('d1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'other@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('d1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'unmandated-functionary@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, timezone, status) values (
  'd0000000-0000-4000-8000-000000000001',
  'a29-club', 'A29 Club', 'Europe/Amsterdam', 'active'
);

insert into app.account_profiles (auth_user_id, display_name) values
  ('d1000000-0000-4000-8000-000000000001', 'Member'),
  ('d1000000-0000-4000-8000-000000000002', 'Functionary'),
  ('d1000000-0000-4000-8000-000000000003', 'Other member'),
  ('d1000000-0000-4000-8000-000000000004', 'Functionary without mandate');

insert into app.persons (
  id, tenant_id, given_name, family_name, birth_date,
  birth_date_precision, status
) values
  ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'Target', 'Member', '1980-01-01', 'day', 'active'),
  ('d2000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'Club', 'Functionary', '1970-01-01', 'day', 'active'),
  ('d2000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001', 'Other', 'Member', '1985-01-01', 'day', 'active'),
  ('d2000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 'Unmandated', 'Functionary', '1975-01-01', 'day', 'active');

insert into app.account_person_links (
  tenant_id, auth_user_id, person_id, verified_at
) values
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', statement_timestamp()),
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', statement_timestamp()),
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000003', statement_timestamp()),
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000004', statement_timestamp());

insert into app.tenant_memberships (
  tenant_id, auth_user_id, status, starts_at
) values
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'active', statement_timestamp() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'active', statement_timestamp() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'active', statement_timestamp() - interval '1 day'),
  ('d0000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000004', 'active', statement_timestamp() - interval '1 day');

insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind,
  starts_at, granted_by_auth_user_id
) values
  (
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    (select id from app.permission_roles
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and role_key = 'member'),
    'tenant', statement_timestamp() - interval '1 day',
    'd1000000-0000-4000-8000-000000000002'
  ),
  (
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002',
    (select id from app.permission_roles
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and role_key = 'volunteer_coordinator'),
    'tenant', statement_timestamp() - interval '1 day',
    'd1000000-0000-4000-8000-000000000002'
  ),
  (
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000003',
    (select id from app.permission_roles
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and role_key = 'member'),
    'tenant', statement_timestamp() - interval '1 day',
    'd1000000-0000-4000-8000-000000000002'
  ),
  (
    'd0000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000004',
    (select id from app.permission_roles
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and role_key = 'volunteer_coordinator'),
    'tenant', statement_timestamp() - interval '1 day',
    'd1000000-0000-4000-8000-000000000002'
  );

insert into app.households (
  id, tenant_id, label, intake_code_hash, status
) values (
  'd3000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'Target household', extensions.digest('a29-code', 'sha256'), 'active'
);

insert into app.household_person_links (
  tenant_id, household_id, person_id, kind, starts_at,
  verified_by_auth_user_id
) values
(
  'd0000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001', 'member',
  statement_timestamp() - interval '1 day',
  'd1000000-0000-4000-8000-000000000002'
),
(
  'd0000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000003', 'member',
  statement_timestamp() - interval '1 day',
  'd1000000-0000-4000-8000-000000000002'
);

insert into app.seasons (
  id, tenant_id, name, starts_on, ends_on, winter_cutoff_at,
  target_minutes, winter_target_minutes, status
) values (
  'd4000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001', '2026/2027',
  '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01',
  720, 360, 'active'
);

insert into app.obligations (
  id, tenant_id, season_id, assessed_household_id,
  base_target_minutes, effective_target_minutes, effective_winter_minutes,
  status
) values
(
  'd5000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  720, 720, 360, 'active'
),
(
  'd5000000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  720, 720, 360, 'closed'
);

insert into app.household_obligation_links (
  tenant_id, household_id, obligation_id, link_kind, starts_at
) values (
  'd0000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000001', 'liable',
  statement_timestamp() - interval '1 day'
);

insert into app.household_access_grants (
  tenant_id, household_id, auth_user_id, can_view_progress, can_book_for,
  starts_at, granted_by_auth_user_id
) values (
  'd0000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002', true, true,
  statement_timestamp() - interval '1 day',
  'd1000000-0000-4000-8000-000000000002'
);
insert into app.acting_delegations (
  tenant_id, actor_auth_user_id, represented_person_id, household_id,
  scope, starts_at, evidence_ref, granted_by_auth_user_id
) values (
  'd0000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001', 'book_shift',
  statement_timestamp() - interval '1 day', 'telephone-service mandate',
  'd1000000-0000-4000-8000-000000000002'
);
insert into app.executor_obligation_grants (
  tenant_id, person_id, obligation_id, valid_from,
  approved_by_auth_user_id
) values (
  'd0000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000001', '2026-01-01',
  'd1000000-0000-4000-8000-000000000002'
);

insert into app.committees (id, tenant_id, slug, name) values (
  'd6000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001', 'bar', 'Bar'
);
insert into app.task_categories (id, tenant_id, committee_id, name) values (
  'd6100000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001', 'Bar'
);
insert into app.task_types (id, tenant_id, category_id, name) values (
  'd6200000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd6100000-0000-4000-8000-000000000001', 'Bar shift'
);
insert into app.task_type_versions (
  id, tenant_id, task_type_id, revision, credit_minutes,
  approved_by_auth_user_id
) values (
  'd6300000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd6200000-0000-4000-8000-000000000001', 1, 120,
  'd1000000-0000-4000-8000-000000000002'
);
insert into app.shifts (
  id, tenant_id, type_version_id, committee_id, category_id, title,
  starts_at, ends_at, credit_minutes, cancellation_minutes,
  state, published_at
) values
(
  'd6400000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd6300000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001',
  'd6100000-0000-4000-8000-000000000001', 'Telephone booking',
  '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01',
  120, 2880, 'published', statement_timestamp()
),
(
  'd6400000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000001',
  'd6300000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001',
  'd6100000-0000-4000-8000-000000000001', 'Atomic telephone booking',
  '2027-02-02 10:00:00+01', '2027-02-02 12:00:00+01',
  120, 2880, 'published', statement_timestamp()
),
(
  'd6400000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000001',
  'd6300000-0000-4000-8000-000000000001',
  'd6000000-0000-4000-8000-000000000001',
  'd6100000-0000-4000-8000-000000000001', 'Online booking provenance guard',
  '2027-02-03 10:00:00+01', '2027-02-03 12:00:00+01',
  120, 2880, 'published', statement_timestamp()
);
insert into app.shift_positions (
  id, tenant_id, shift_id, ordinal, starts_at, ends_at, state
) values
(
  'd6500000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd6400000-0000-4000-8000-000000000001', 1,
  '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01', 'open'
),
(
  'd6500000-0000-4000-8000-000000000002',
  'd0000000-0000-4000-8000-000000000001',
  'd6400000-0000-4000-8000-000000000002', 1,
  '2027-02-02 10:00:00+01', '2027-02-02 12:00:00+01', 'open'
),
(
  'd6500000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-000000000001',
  'd6400000-0000-4000-8000-000000000003', 1,
  '2027-02-03 10:00:00+01', '2027-02-03 12:00:00+01', 'open'
);
insert into app.bookings (
  id, tenant_id, position_id, executor_person_id, obligation_id, state,
  booked_by_auth_user_id, starts_at_snapshot, ends_at_snapshot,
  credit_minutes_snapshot, cancellation_deadline_snapshot,
  task_version_snapshot, idempotency_key
) values (
  'd6600000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd6500000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000001', 'booked',
  'd1000000-0000-4000-8000-000000000002',
  '2027-02-01 10:00:00+01', '2027-02-01 12:00:00+01',
  120, '2027-01-30 10:00:00+01',
  'd6300000-0000-4000-8000-000000000001',
  'd6610000-0000-4000-8000-000000000001'
);

insert into app.hour_ledger_entries (
  id, tenant_id, obligation_id, season_id, entry_kind, minutes_delta,
  performed_at, actor_auth_user_id, correction_reason, idempotency_key
) values (
  'd6800000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  'd5000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'replacement', 0, '2027-02-01 12:00:00+01',
  'd1000000-0000-4000-8000-000000000002',
  'Ledger-only fixture for binding validation',
  'd6810000-0000-4000-8000-000000000001'
);

insert into app.hour_disputes (
  id, tenant_id, booking_id, ledger_entry_id, obligation_id, opened_by_auth_user_id,
  description, state
) values
  (
    'd7000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000001',
    'd6600000-0000-4000-8000-000000000001',
    null,
    'd5000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Reported minutes are incorrect', 'open'
  ),
  (
    'd7000000-0000-4000-8000-000000000002',
    'd0000000-0000-4000-8000-000000000001',
    'd6600000-0000-4000-8000-000000000001',
    null,
    'd5000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Separate unresolved question', 'open'
  ),
  (
    'd7000000-0000-4000-8000-000000000003',
    'd0000000-0000-4000-8000-000000000001',
    'd6600000-0000-4000-8000-000000000001',
    null,
    'd5000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000001',
    'Inconsistent booking and obligation fixture', 'open'
  ),
  (
    'd7000000-0000-4000-8000-000000000004',
    'd0000000-0000-4000-8000-000000000001',
    'd6600000-0000-4000-8000-000000000001',
    'd6800000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Inconsistent booking and ledger fixture', 'open'
  );

select ok(
  exists (
    select 1
    from app.role_permissions as role_permission
    join app.permission_roles as role_row
      on role_row.tenant_id = role_permission.tenant_id
     and role_row.id = role_permission.role_id
    where role_row.tenant_id = 'd0000000-0000-4000-8000-000000000001'
      and role_row.role_key = 'volunteer_coordinator'
      and role_permission.permission_key = 'member.assist_by_phone'
  ),
  'future tenant roles receive the telephone-assistance permission'
);
select ok(
  not exists (
    select 1
    from app.role_permissions as role_permission
    join app.permission_roles as role_row
      on role_row.tenant_id = role_permission.tenant_id
     and role_row.id = role_permission.role_id
    where role_row.tenant_id = 'd0000000-0000-4000-8000-000000000001'
      and role_row.role_key = 'volunteer_coordinator'
      and role_permission.permission_key = 'hour_dispute.resolve_by_phone'
  ),
  'telephone assistance alone does not grant hour-dispute adjudication'
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

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000003', true
);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('d1000000-0000-4000-8000-000000000003','')::uuid),true);
select throws_ok($$
  select * from api.assisted_book_shift_by_phone(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000002',
    'd6500000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'Member phoned to book this shift',
    'd8000000-0000-4000-8000-000000000001'
  )
$$, '42501', 'FORBIDDEN',
  'an ordinary member cannot create a telephone booking for somebody else');

select set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000004', true
);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('d1000000-0000-4000-8000-000000000004','')::uuid),true);
select throws_ok($$
  select * from api.assisted_book_shift_by_phone(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000002',
    'd6500000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'Telephone authority without a subject mandate is insufficient',
    'd8000000-0000-4000-8000-000000000011'
  )
$$, '42501', 'FORBIDDEN',
  'telephone authority cannot bypass subject-specific booking authority');

select set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000002', true
);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('d1000000-0000-4000-8000-000000000002','')::uuid),true);
select lives_ok($$
  select * from api.assisted_book_shift_by_phone(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000002',
    'd6500000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'Member phoned to book this shift',
    'd8000000-0000-4000-8000-000000000002'
  )
$$, 'an authorized functionary atomically books and records the telephone request');
select lives_ok($$
  select * from api.assisted_book_shift_by_phone(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000002',
    'd6500000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'Member phoned to book this shift',
    'd8000000-0000-4000-8000-000000000002'
  )
$$, 'retrying the same telephone booking is idempotent');
select throws_ok($$
  select * from api.assisted_book_shift_by_phone(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000002',
    'd6500000-0000-4000-8000-000000000002',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'A different reason must not reuse the completed command',
    'd8000000-0000-4000-8000-000000000002'
  )
$$, '22000', 'IDEMPOTENCY_CONFLICT',
  'reusing the telephone-booking key with a different payload is rejected');

select is(
  (select count(*)::integer from app.bookings
   where tenant_id = 'd0000000-0000-4000-8000-000000000001'
     and position_id = 'd6500000-0000-4000-8000-000000000002'
     and booked_by_auth_user_id = 'd1000000-0000-4000-8000-000000000002'),
  1,
  'the atomic command creates exactly one real booking by the factual operator'
);

select lives_ok($$
  select * from api.book_shift(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000003',
    'd6500000-0000-4000-8000-000000000003',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'd8000000-0000-4000-8000-000000000010'
  )
$$, 'the provenance fixture first creates an ordinary online booking');
select throws_ok($$
  select * from api.assisted_book_shift_by_phone(
    'd0000000-0000-4000-8000-000000000001',
    'd6400000-0000-4000-8000-000000000003',
    'd6500000-0000-4000-8000-000000000003',
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001', 1,
    'An online booking cannot later be relabelled as a telephone booking',
    'd8000000-0000-4000-8000-000000000010'
  )
$$, 'P0001', 'CAPACITY_FULL',
  'cross-command key reuse cannot replay and relabel an online booking');
select is(
  (select count(*)::integer
   from app.assisted_member_actions
   where tenant_id = 'd0000000-0000-4000-8000-000000000001'
     and idempotency_key = 'd8000000-0000-4000-8000-000000000010'),
  0,
  'the rejected relabelling attempt leaves no telephone history'
);

select lives_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'notification', 'person',
    'd2000000-0000-4000-8000-000000000001',
    'Member reported a new telephone number; operator selected the wrong outcome',
    '{"status":"incorrectly_recorded"}'::jsonb,
    null, false, null,
    'd8000000-0000-4000-8000-000000000003'
  )
$$, 'a telephone notification can be recorded with its effect');
select throws_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'record_correction', 'booking',
    'd6600000-0000-4000-8000-000000000001',
    'A correction cannot silently switch to another resource',
    '{"status":"restored"}'::jsonb,
    (select id from app.assisted_member_actions
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and idempotency_key = 'd8000000-0000-4000-8000-000000000003'),
    false, null,
    'd8000000-0000-4000-8000-000000000007'
  )
$$, '42501', 'CORRECTION_RESOURCE_MISMATCH',
  'a correction must retain the original resource tuple');
select lives_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'record_correction', 'person',
    'd2000000-0000-4000-8000-000000000001',
    'Operator restored the erroneously recorded outcome after callback',
    '{"status":"restored","previous_effect_retained":true}'::jsonb,
    (select id from app.assisted_member_actions
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and idempotency_key = 'd8000000-0000-4000-8000-000000000003'),
    false, null,
    'd8000000-0000-4000-8000-000000000004'
  )
$$, 'a mistaken service record is restored by an appended correction');

select throws_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000003',
    'correction_request', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000001',
    'A sibling cannot become the subject of a booking-backed dispute',
    '{"requested_minutes":120}'::jsonb,
    null, false, null,
    'd8000000-0000-4000-8000-000000000008'
  )
$$, '42501', 'RESOURCE_SUBJECT_MISMATCH',
  'a booking-backed dispute is bound to its exact executor, not a sibling');

select throws_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'correction_request', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000003',
    'A dispute cannot combine a booking with another obligation',
    '{"requested_minutes":120}'::jsonb,
    null, false, null,
    'd8000000-0000-4000-8000-000000000012'
  )
$$, '55000', 'DISPUTE_RESOURCE_MISMATCH',
  'a booking-backed dispute must retain the booking obligation');
select throws_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'correction_request', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000004',
    'A dispute cannot combine a booking with an unrelated ledger entry',
    '{"requested_minutes":120}'::jsonb,
    null, false, null,
    'd8000000-0000-4000-8000-000000000013'
  )
$$, '55000', 'DISPUTE_RESOURCE_MISMATCH',
  'a dispute ledger entry must belong to the same booking chain');

select lives_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'correction_request', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000001',
    'Member disputes the minutes by telephone',
    '{"requested_minutes":120}'::jsonb,
    null, false, null,
    'd8000000-0000-4000-8000-000000000005'
  )
$$, 'the functionary can record a correction request for one dispute');
select throws_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'record_correction', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000001',
    'Committee verified and corrected this specific report',
    '{"verified_minutes":120}'::jsonb,
    (select id from app.assisted_member_actions
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and idempotency_key = 'd8000000-0000-4000-8000-000000000005'),
    true, 1,
    'd8000000-0000-4000-8000-000000000006'
  )
$$, '42501', 'DISPUTE_RESOLUTION_FORBIDDEN',
  'a telephone-assistance role cannot resolve the financial blocker');
reset role;
select is(
  (select state from app.hour_disputes
   where id = 'd7000000-0000-4000-8000-000000000001'),
  'open',
  'the denied adjudication leaves the dispute open'
);
insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind,
  starts_at, granted_by_auth_user_id
) values (
  'd0000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000002',
  (select id from app.permission_roles
    where tenant_id = 'd0000000-0000-4000-8000-000000000001'
      and role_key = 'volunteer_committee'),
  'tenant', statement_timestamp() - interval '1 day',
  'd1000000-0000-4000-8000-000000000002'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000002', true
);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('d1000000-0000-4000-8000-000000000002','')::uuid),true);
select lives_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'record_correction', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000001',
    'Committee verified and corrected this specific report',
    '{"verified_minutes":120}'::jsonb,
    (select id from app.assisted_member_actions
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and idempotency_key = 'd8000000-0000-4000-8000-000000000005'),
    true, 1,
    'd8000000-0000-4000-8000-000000000006'
  )
$$, 'the separately authorized committee resolves only the linked dispute');
select throws_ok($$
  select * from api.record_assisted_member_action(
    'd0000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000001',
    'record_correction', 'hour_dispute',
    'd7000000-0000-4000-8000-000000000001',
    'A second correction cannot replace the immutable first correction',
    '{"verified_minutes":90}'::jsonb,
    (select id from app.assisted_member_actions
      where tenant_id = 'd0000000-0000-4000-8000-000000000001'
        and idempotency_key = 'd8000000-0000-4000-8000-000000000005'),
    false, null,
    'd8000000-0000-4000-8000-000000000009'
  )
$$, 'P0001', 'ALREADY_CORRECTED',
  'one original telephone action accepts at most one appended correction');

select is(
  (select count(*)::integer from api.assisted_member_action_history),
  5,
  'idempotent retry produced one row and all original/correction rows remain'
);
select is(
  (select state from app.hour_disputes
    where id = 'd7000000-0000-4000-8000-000000000001'),
  'resolved',
  'the selected dispute is resolved'
);
select is(
  (select state from app.hour_disputes
    where id = 'd7000000-0000-4000-8000-000000000002'),
  'open',
  'the unrelated dispute remains open'
);
select is(
  (select effect ->> 'dispute_previous_state'
   from app.assisted_member_actions
   where idempotency_key = 'd8000000-0000-4000-8000-000000000006'),
  'open',
  'the correction permanently records the prior dispute state'
);
select is(
  (select actor_auth_user_id
   from app.assisted_member_actions
   where idempotency_key = 'd8000000-0000-4000-8000-000000000006'),
  'd1000000-0000-4000-8000-000000000002'::uuid,
  'the factual functionary remains visible as actor'
);
select is(
  (select subject_person_id
   from app.assisted_member_actions
   where idempotency_key = 'd8000000-0000-4000-8000-000000000006'),
  'd2000000-0000-4000-8000-000000000001'::uuid,
  'the represented member remains visible as subject'
);
select is(
  (select reason
   from app.assisted_member_actions
   where idempotency_key = 'd8000000-0000-4000-8000-000000000006'),
  'Committee verified and corrected this specific report',
  'the assistance reason remains visible'
);
select ok(
  (select corrects_action_id is not null
   from app.assisted_member_actions
   where idempotency_key = 'd8000000-0000-4000-8000-000000000004'),
  'the restoration points to the immutable erroneous record'
);
reset role;
select throws_ok($$
  update app.assisted_member_actions
  set reason = 'silently rewritten'
  where idempotency_key = 'd8000000-0000-4000-8000-000000000003'
$$, '55000', 'assisted_member_actions is append-only',
  'even a privileged database path cannot rewrite service history');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000001', true
);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('d1000000-0000-4000-8000-000000000001','')::uuid),true);
select is(
  (select count(*)::integer from api.assisted_member_action_history),
  5,
  'the represented member can inspect their full telephone history'
);
select set_config(
  'request.jwt.claim.sub',
  'd1000000-0000-4000-8000-000000000003', true
);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('d1000000-0000-4000-8000-000000000003','')::uuid),true);
select is(
  (select count(*)::integer from api.assisted_member_action_history),
  0,
  'another member cannot inspect the represented member history'
);
select ok(
  not has_table_privilege(
    'authenticated', 'app.assisted_member_actions', 'INSERT'
  ),
  'authenticated callers cannot bypass the command with direct INSERT'
);
reset role;

select is(
  (select count(*)::integer
   from app.audit_events
   where tenant_id = 'd0000000-0000-4000-8000-000000000001'
     and action like 'member.assisted_by_phone.%'),
  5,
  'every persisted telephone action has a matching immutable audit event'
);
select is(
  (select count(*)::integer
   from app.domain_events
   where tenant_id = 'd0000000-0000-4000-8000-000000000001'
     and aggregate_type = 'assisted_member_action'),
  5,
  'every persisted telephone action emits one domain event'
);
select ok(
  not has_function_privilege(
    'anon',
    'api.record_assisted_member_action(uuid,uuid,text,text,uuid,text,jsonb,uuid,boolean,bigint,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the assistance command'
);
select ok(
  not has_function_privilege(
    'anon',
    'api.assisted_book_shift_by_phone(uuid,uuid,uuid,uuid,uuid,bigint,text,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the atomic telephone-booking command'
);

select * from finish();
rollback;
