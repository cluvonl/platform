begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'uitnodiger@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('51000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'uitvoerder@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('51000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'aanvaller@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('51000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'commissie@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('51000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'tweede-ouder@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, status) values
  ('52000000-0000-4000-8000-000000000001', 'invite-club', 'Invite Club', 'active'),
  ('52000000-0000-4000-8000-000000000002', 'andere-club', 'Andere Club', 'active');

insert into app.account_profiles (auth_user_id, display_name) values
  ('51000000-0000-4000-8000-000000000001', 'Uitnodiger'),
  ('51000000-0000-4000-8000-000000000004', 'Commissie'),
  ('51000000-0000-4000-8000-000000000005', 'Tweede ouder');

insert into app.persons (id, tenant_id, given_name, family_name, status) values
  ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'Uit', 'Nodiger', 'active'),
  ('53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', 'Vrijwilligers', 'Commissie', 'active'),
  ('53000000-0000-4000-8000-000000000003', '52000000-0000-4000-8000-000000000001', 'Gedeeld', 'Kind', 'active'),
  ('53000000-0000-4000-8000-000000000004', '52000000-0000-4000-8000-000000000001', 'Tweede', 'Ouder', 'active');

insert into app.account_person_links (
  tenant_id, auth_user_id, person_id, verified_at
) values
  (
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',
    statement_timestamp()
  ),
  (
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000004',
    '53000000-0000-4000-8000-000000000002',
    statement_timestamp()
  ),
  (
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000005',
    '53000000-0000-4000-8000-000000000004',
    statement_timestamp()
  );

insert into app.tenant_memberships (tenant_id, auth_user_id, status) values
  (
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    'active'
  ),
  (
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000004',
    'active'
  ),
  (
    '52000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000005',
    'active'
  );

insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, granted_by_auth_user_id
)
select
  '52000000-0000-4000-8000-000000000001', actor.auth_user_id,
  role_row.id, 'tenant', '51000000-0000-4000-8000-000000000004'
from (values
  ('51000000-0000-4000-8000-000000000004'::uuid, 'volunteer_committee'::text),
  ('51000000-0000-4000-8000-000000000005'::uuid, 'member'::text)
) as actor(auth_user_id, role_key)
join app.permission_roles as role_row
  on role_row.tenant_id = '52000000-0000-4000-8000-000000000001'
 and role_row.role_key = actor.role_key;

insert into app.households (
  id, tenant_id, label, intake_code_hash, status
) values (
  '54000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  'Huishouden Invite', extensions.digest('invite-code', 'sha256'), 'active'
);

insert into app.seasons (
  id, tenant_id, name, starts_on, ends_on, winter_cutoff_at,
  target_minutes, winter_target_minutes, status
) values (
  '54100000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '2026/2027', '2026-07-01', '2027-06-30', '2026-12-21 00:00:00+01',
  720, 360, 'active'
);

insert into app.obligations (
  id, tenant_id, season_id, assessed_household_id,
  base_target_minutes, effective_target_minutes, effective_winter_minutes, status
) values (
  '54200000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '54100000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  720, 720, 360, 'active'
);

insert into app.household_obligation_links (
  tenant_id, household_id, obligation_id, link_kind, starts_at
) values (
  '52000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  '54200000-0000-4000-8000-000000000001',
  'liable', statement_timestamp() - interval '1 day'
);

insert into app.household_person_links (
  tenant_id, household_id, person_id, kind, verified_by_auth_user_id
) values
  (
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',
    'parent', '51000000-0000-4000-8000-000000000001'
  ),
  (
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000004',
    'parent', '51000000-0000-4000-8000-000000000004'
  ),
  (
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000003',
    'member', '51000000-0000-4000-8000-000000000004'
  );

insert into app.intake_profiles (
  tenant_id, person_id, household_context_id, status
) values (
  '52000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000004',
  '54000000-0000-4000-8000-000000000001',
  'confirmed'
);

insert into app.household_access_grants (
  tenant_id, household_id, auth_user_id, can_view_progress,
  can_manage_contacts, can_invite_executor, can_book_for,
  granted_by_auth_user_id
) values (
  '52000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  true, true, true, true,
  '51000000-0000-4000-8000-000000000001'
);

insert into app.volunteer_role_catalog (id, tenant_id, name) values (
  '56000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  'Erkende trainer A10'
);
insert into app.volunteer_role_versions (
  id, tenant_id, role_id, revision, household_exempt, effective_from,
  approved_by_auth_user_id
) values (
  '56100000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '56000000-0000-4000-8000-000000000001',
  1, true, '2026-07-01', '51000000-0000-4000-8000-000000000004'
);
insert into app.volunteer_appointments (
  id, tenant_id, person_id, household_id, obligation_id, role_version_id,
  starts_on, recognized_by_auth_user_id
) values (
  '56200000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  '54200000-0000-4000-8000-000000000001',
  '56100000-0000-4000-8000-000000000001',
  '2026-07-01', '51000000-0000-4000-8000-000000000004'
);
insert into app.obligation_coverage_decisions (
  id, tenant_id, obligation_id, household_id, source_kind, appointment_id,
  decision_revision, effect, starts_on, decided_by_auth_user_id, reason
) values (
  '56300000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '54200000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  'volunteer_appointment', '56200000-0000-4000-8000-000000000001',
  1, 'household_exempt', '2026-07-01',
  '51000000-0000-4000-8000-000000000004', 'Bestaande vrijstelling bronhuishouden'
);
insert into app.hour_ledger_entries (
  id, tenant_id, obligation_id, season_id, entry_kind, minutes_delta,
  performed_at, actor_auth_user_id, idempotency_key
) values (
  '56400000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  '54200000-0000-4000-8000-000000000001',
  '54100000-0000-4000-8000-000000000001',
  'award', 120, '2026-10-01 10:00:00+02',
  '51000000-0000-4000-8000-000000000004',
  '56500000-0000-4000-8000-000000000001'
);

-- Current confirmed synthetic identities; invitation material is generated only at runtime.
update auth.users set email_confirmed_at=statement_timestamp() where id::text like '51000000-%';
create temporary table onboarding_invitation_input(token text not null);
insert into onboarding_invitation_input values(gen_random_uuid()::text||gen_random_uuid()::text);
grant select on onboarding_invitation_input to authenticated;

select ok(
  not has_function_privilege(
    'anon',
    'api.create_household_invitation(uuid,uuid,text,text,text,text,boolean,boolean,uuid)',
    'EXECUTE'
  ),
  'anon cannot create a household invitation'
);
select ok(
  not has_function_privilege('anon', 'api.accept_household_invitation(text)', 'EXECUTE'),
  'anon cannot accept a household invitation'
);
select ok(
  not has_function_privilege(
    'anon',
    'api.apply_household_split(uuid,uuid,bigint,uuid,uuid,text,text,uuid,text,text,uuid)',
    'EXECUTE'
  ),
  'anon cannot apply a reviewed household split'
);
select ok(
  not has_function_privilege(
    'anon',
    'api.read_household_split_decisions(uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot read reviewed household split decisions'
);
select ok(
  not has_table_privilege(
    'authenticated',
    'app.household_change_cases',
    'SELECT'
  ),
  'authenticated users cannot bypass the scoped split-decision readback'
);
select is(
  (select count(*)::integer
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'api' and procedure.prosecdef),
  0,
  'onboarding keeps SECURITY DEFINER functions out of the exposed api schema'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'uitnodiger@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000001","email":"uitnodiger@example.test","role":"authenticated"}',
  true
);

select lives_ok(
  format(
    'select * from api.create_household_invitation_v2(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    'Extra', 'Uitvoerder', 'uitvoerder@example.test',
    encode(extensions.digest(convert_to((select token from onboarding_invitation_input), 'UTF8'), 'sha256'), 'hex'),
    true, true, 1,
    '55000000-0000-4000-8000-000000000001'
  ),
  'authorized household parent creates a hashed invitation'
);

reset role;
select is(
  (select count(*)::integer from app.persons
   where tenant_id = '52000000-0000-4000-8000-000000000001' and status = 'invited'),
  1,
  'creating an invitation creates exactly one explicit invited person'
);
select is(
  (select delivery_status from app.household_invitations
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  'pending',
  'invitation remains pending until the Auth delivery call succeeds'
);
select is(
  (select count(*)::integer from app.household_invitations
   where invited_email_hash = extensions.digest(convert_to('uitvoerder@example.test', 'UTF8'), 'sha256')),
  1,
  'only the normalized email hash is used for invitation matching'
);
select ok(
  (select expires_at > statement_timestamp() + interval '59 minutes'
      and expires_at <= statement_timestamp() + interval '1 hour 1 minute'
   from app.household_invitations
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  'dossier invitation expiry matches the configured one-hour Auth-link lifetime'
);
select set_config(
  'cluvo.test.invitation_id',
  (select id::text from app.household_invitations
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  true
);
select set_config(
  'cluvo.test.invited_person_id',
  (select invited_person_id::text from app.household_invitations
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.email', 'uitnodiger@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000001","email":"uitnodiger@example.test","role":"authenticated"}',
  true
);
select lives_ok(
  format(
    'select * from api.mark_household_invitation_delivery_v2(%L,%L,1,true,%L)',
    '52000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.invitation_id'),
    '55000000-0000-4000-8000-000000000003'
  ),
  'the creating actor marks successful Auth delivery'
);
select lives_ok(
  format(
    'select * from api.mark_household_invitation_delivery_v2(%L,%L,1,true,%L)',
    '52000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.invitation_id'),
    '55000000-0000-4000-8000-000000000003'
  ),
  'a successful delivery callback can be retried idempotently'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', 'uitvoerder@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000002","email":"uitvoerder@example.test","role":"authenticated"}',
  true
);

select lives_ok(
  $$select * from api.accept_household_invitation_v2((select token from onboarding_invitation_input),2,'55000000-0000-4000-8000-000000000004')$$,
  'matching verified Auth identity accepts the one-time invitation'
);
reset role;
select is(
  (select delivery_status from app.household_invitations
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  'accepted',
  'accepted invitation has an explicit terminal state'
);
select is(
  (select count(*)::integer from app.tenant_memberships
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and auth_user_id = '51000000-0000-4000-8000-000000000002'
     and status = 'active'),
  1,
  'acceptance creates one active tenant membership'
);
select is(
  (select count(*)::integer from app.household_access_grants
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and auth_user_id = '51000000-0000-4000-8000-000000000002'
     and can_view_progress and can_book_for and not can_invite_executor),
  1,
  'acceptance copies only the invitation capability snapshot'
);
select is(
  (select count(*)::integer
   from app.executor_obligation_grants
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = current_setting('cluvo.test.invited_person_id')::uuid
     and obligation_id = '54200000-0000-4000-8000-000000000001'
     and revoked_at is null),
  1,
  'booking capability creates one explicit executor-to-obligation grant'
);
select is(
  (select count(*)::integer from app.intake_profiles
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = (
       select invited_person_id from app.household_invitations
       where tenant_id = '52000000-0000-4000-8000-000000000001'
     )),
  1,
  'accepted executor receives one personal draft intake'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', 'uitvoerder@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000002","email":"uitvoerder@example.test","role":"authenticated"}',
  true
);
select lives_ok(
  $$select * from api.accept_household_invitation_v2((select token from onboarding_invitation_input),2,'55000000-0000-4000-8000-000000000004')$$,
  'same accepted actor may safely repeat the accept command'
);
reset role;
select is(
  (select count(*)::integer from app.account_person_links
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and auth_user_id = '51000000-0000-4000-8000-000000000002'
     and revoked_at is null),
  1,
  'acceptance retry does not duplicate identity links'
);
select is(
  (select count(*)::integer from app.executor_obligation_grants
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = current_setting('cluvo.test.invited_person_id')::uuid
     and obligation_id = '54200000-0000-4000-8000-000000000001'
     and revoked_at is null),
  1,
  'acceptance retry does not duplicate the executor obligation grant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.email', 'uitvoerder@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000002","email":"uitvoerder@example.test","role":"authenticated"}',
  true
);
select ok(
  internal.can_access_private_object(
    '52000000-0000-4000-8000-000000000001/personal/' ||
    current_setting('cluvo.test.invited_person_id') ||
    '/bewijs.pdf',
    false
  ),
  'accepted actor can read their private personal path'
);
select ok(
  internal.can_access_private_object(
    '52000000-0000-4000-8000-000000000001/household/54000000-0000-4000-8000-000000000001/overzicht.pdf',
    false
  ),
  'explicit household grant permits the reduced private household path'
);
select ok(
  not internal.can_access_private_object(
    '52000000-0000-4000-8000-000000000001/household/54000000-0000-4000-8000-000000000001/wijzig.pdf',
    true
  ),
  'read-only executor cannot write household documents'
);
select ok(
  not internal.can_access_private_object(
    '52000000-0000-4000-8000-000000000002/household/54000000-0000-4000-8000-000000000001/lek.pdf',
    false
  ),
  'private path helper rejects a different tenant'
);

select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.email', 'aanvaller@example.test', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000003","email":"aanvaller@example.test","role":"authenticated"}',
  true
);
select throws_ok(
  $$select * from api.accept_household_invitation_v2((select token from onboarding_invitation_input),2,'55000000-0000-4000-8000-000000000004')$$,
  '42501', 'INVALID_INVITATION',
  'a different verified email cannot reuse the accepted token'
);
select throws_ok(
  $$select * from api.create_household_invitation_v2(
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    'Niet', 'Bevoegd', 'niemand@example.test',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    false, false, 3, '55000000-0000-4000-8000-000000000002'
  )$$,
  '42501', 'FORBIDDEN',
  'verified outsider cannot invite into a known household'
);

reset role;

-- A10: an additional verified parent account and personal intake exist before
-- the reviewed split, without creating a second seasonal obligation.
select is(
  (select count(*)::integer
   from app.account_person_links
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and auth_user_id = '51000000-0000-4000-8000-000000000005'
     and person_id = '53000000-0000-4000-8000-000000000004'
     and revoked_at is null),
  1,
  'A10 second parent has an independent verified account before the split'
);
select is(
  (select count(*)::integer
   from app.intake_profiles
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = '53000000-0000-4000-8000-000000000004'),
  1,
  'A10 second parent has a personal intake before the split'
);
select is(
  (select count(*)::integer
   from app.obligations
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and season_id = '54100000-0000-4000-8000-000000000001'),
  1,
  'A10 an extra account and intake do not create a second obligation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000005","email":"tweede-ouder@example.test","role":"authenticated"}',
  true
);
select throws_ok($$
  select * from api.apply_household_split(
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    3,
    '53000000-0000-4000-8000-000000000003',
    '53000000-0000-4000-8000-000000000004',
    'Tweede huishouden',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '54200000-0000-4000-8000-000000000001',
    'contributor',
    'Gedeeld kind; bestaande seizoensverplichting blijft leidend',
    '56600000-0000-4000-8000-000000000001'
  )
$$, '42501', 'FORBIDDEN',
  'A10 a parent without household-review authority cannot apply the split');
select throws_ok($$
  select * from api.read_household_split_decisions(
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001'
  )
$$, '42501', 'FORBIDDEN',
  'A10 a parent without household-review authority cannot read split decisions');
reset role;
select is(
  (select count(*)::integer
   from app.household_change_cases
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  0,
  'A10 the forbidden command leaves no partial split decision'
);
select is(
  (select count(*)::integer
   from app.idempotency_records
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and actor_auth_user_id = '51000000-0000-4000-8000-000000000005'
     and operation = 'apply_household_split'),
  0,
  'A10 a forbidden actor cannot reserve an idempotency key'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"51000000-0000-4000-8000-000000000004","email":"commissie@example.test","role":"authenticated"}',
  true
);
select lives_ok($$
  select * from api.apply_household_split(
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    3,
    '53000000-0000-4000-8000-000000000003',
    '53000000-0000-4000-8000-000000000004',
    'Tweede huishouden',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '54200000-0000-4000-8000-000000000001',
    'contributor',
    'Gedeeld kind; bestaande seizoensverplichting blijft leidend',
    '56600000-0000-4000-8000-000000000002'
  )
$$, 'A10 the volunteer committee applies the reviewed household split');
select lives_ok($$
  select * from api.apply_household_split(
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    3,
    '53000000-0000-4000-8000-000000000003',
    '53000000-0000-4000-8000-000000000004',
    'Tweede huishouden',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '54200000-0000-4000-8000-000000000001',
    'contributor',
    'Gedeeld kind; bestaande seizoensverplichting blijft leidend',
    '56600000-0000-4000-8000-000000000002'
  )
$$, 'A10 retry returns the original split result idempotently');
select is(
  (select count(*)::integer
   from api.read_household_split_decisions(
     '52000000-0000-4000-8000-000000000001',
     '54000000-0000-4000-8000-000000000001'
   ) as decision
   where decision.status = 'applied'
     and decision.obligation_link_kind = 'contributor'
     and decision.decided_by_auth_user_id = '51000000-0000-4000-8000-000000000004'),
  1,
  'A10 the committee can read back its applied decision through the scoped API'
);
reset role;

select set_config(
  'cluvo.test.split_household_id',
  (select destination_household_id::text
   from app.household_change_cases
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  true
);
select is(
  (select count(*)::integer
   from app.household_change_cases
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and kind = 'split'
     and status = 'applied'
     and decided_by_auth_user_id = '51000000-0000-4000-8000-000000000004'
     and obligation_link_kind = 'contributor'),
  1,
  'A10 one explicit committee split decision is stored'
);
select is(
  (select count(*)::integer
   from app.households
   where tenant_id = '52000000-0000-4000-8000-000000000001'),
  2,
  'A10 the reviewed split creates exactly one second dossier'
);
select is(
  (select encode(intake_code_hash, 'hex')
   from app.households
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and id = current_setting('cluvo.test.split_household_id')::uuid),
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'A10 the second dossier has its own intake-code hash'
);
select ok(
  (select source.intake_code_hash <> destination.intake_code_hash
   from app.households as source
   join app.households as destination
     on destination.tenant_id = source.tenant_id
    and destination.id = current_setting('cluvo.test.split_household_id')::uuid
   where source.tenant_id = '52000000-0000-4000-8000-000000000001'
     and source.id = '54000000-0000-4000-8000-000000000001'),
  'A10 the two dossiers never share an intake-code hash'
);
select is(
  (select count(*)::integer
   from app.household_obligation_links as obligation_link
   join app.household_change_cases as change_case
     on change_case.tenant_id = obligation_link.tenant_id
    and change_case.id = obligation_link.decision_ref
    and change_case.destination_household_id = obligation_link.household_id
   where obligation_link.tenant_id = '52000000-0000-4000-8000-000000000001'
     and obligation_link.household_id = current_setting('cluvo.test.split_household_id')::uuid
     and obligation_link.obligation_id = '54200000-0000-4000-8000-000000000001'
     and obligation_link.link_kind = 'contributor'
     and obligation_link.ends_at is null),
  1,
  'A10 the second dossier receives only the explicitly decided obligation link'
);
select is(
  (select count(*)::integer
   from app.obligations
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and season_id = '54100000-0000-4000-8000-000000000001'),
  1,
  'A10 the physical split does not duplicate the seasonal obligation'
);
select is(
  (select count(*)::integer
   from app.household_obligation_links
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and obligation_id = '54200000-0000-4000-8000-000000000001'
     and link_kind = 'liable'
     and ends_at is null),
  1,
  'A10 the existing obligation keeps exactly one liable household'
);
select is(
  (select count(*)::integer
   from app.household_person_links
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = '53000000-0000-4000-8000-000000000003'
     and kind = 'member'
     and ends_at is null),
  2,
  'A10 the child is explicitly shared between both dossiers'
);
select is(
  (select count(*)::integer
   from app.household_person_links
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and household_id = current_setting('cluvo.test.split_household_id')::uuid
     and person_id = '53000000-0000-4000-8000-000000000004'
     and kind = 'parent'
     and ends_at is null),
  1,
  'A10 the second parent is linked to the new dossier'
);
select is(
  (select count(*)::integer
   from app.intake_profiles
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = '53000000-0000-4000-8000-000000000004'),
  2,
  'A10 the new dossier starts a separate draft intake context without copying answers'
);
select is(
  (select count(*)::integer
   from app.hour_ledger_entries
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and obligation_id = '54200000-0000-4000-8000-000000000001'),
  1,
  'A10 the split does not duplicate existing ledger history'
);
select is(
  (select coalesce(sum(minutes_delta), 0)::integer
   from app.hour_ledger_entries
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and obligation_id = '54200000-0000-4000-8000-000000000001'),
  120,
  'A10 confirmed minutes remain wholly on the original obligation'
);
select is(
  (select count(*)::integer
   from app.obligation_coverage_decisions
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and household_id = current_setting('cluvo.test.split_household_id')::uuid),
  0,
  'A10 a source-household exemption is not copied to the second dossier'
);
select is(
  (select count(*)::integer
   from app.obligation_coverage_decisions
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and household_id = '54000000-0000-4000-8000-000000000001'
     and effect = 'household_exempt'),
  1,
  'A10 the source-household exemption remains historically intact'
);
select is(
  (select count(*)::integer
   from app.executor_obligation_grants
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and person_id = '53000000-0000-4000-8000-000000000004'
     and obligation_id = '54200000-0000-4000-8000-000000000001'
     and revoked_at is null),
  0,
  'A10 a contributor dossier does not silently grant booking authority'
);
select is(
  (select count(*)::integer
   from app.audit_events
   where tenant_id = '52000000-0000-4000-8000-000000000001'
     and action = 'household.split_applied'
     and actor_auth_user_id = '51000000-0000-4000-8000-000000000004'),
  1,
  'A10 the committee decision is auditable once despite command retry'
);
select throws_ok(
  $$update app.household_change_cases
      set decision_reason = 'Achteraf gewijzigd'$$,
  '55000',
  'household_change_cases is append-only',
  'A10 an applied household split decision cannot be updated'
);
select throws_ok(
  $$delete from app.household_change_cases$$,
  '55000',
  'household_change_cases is append-only',
  'A10 an applied household split decision cannot be deleted'
);

select * from finish();
rollback;
