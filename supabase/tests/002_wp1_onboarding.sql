begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('51000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'uitnodiger@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('51000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'uitvoerder@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('51000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'aanvaller@example.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, status) values
  ('52000000-0000-4000-8000-000000000001', 'invite-club', 'Invite Club', 'active'),
  ('52000000-0000-4000-8000-000000000002', 'andere-club', 'Andere Club', 'active');

insert into app.account_profiles (auth_user_id, display_name) values
  ('51000000-0000-4000-8000-000000000001', 'Uitnodiger');

insert into app.persons (id, tenant_id, given_name, family_name, status) values
  ('53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'Uit', 'Nodiger', 'active');

insert into app.account_person_links (
  tenant_id, auth_user_id, person_id, verified_at
) values (
  '52000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000001',
  statement_timestamp()
);

insert into app.tenant_memberships (tenant_id, auth_user_id, status) values (
  '52000000-0000-4000-8000-000000000001',
  '51000000-0000-4000-8000-000000000001',
  'active'
);

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
) values (
  '52000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000001',
  'parent', '51000000-0000-4000-8000-000000000001'
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
    'select * from api.create_household_invitation(%L,%L,%L,%L,%L,%L,%L,%L,%L)',
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    'Extra', 'Uitvoerder', 'uitvoerder@example.test',
    encode(extensions.digest(convert_to('correct-horse-battery-staple-invite-token', 'UTF8'), 'sha256'), 'hex'),
    true, true,
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
    'select api.mark_household_invitation_delivery(%L,%L,true)',
    '52000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.invitation_id')
  ),
  'the creating actor marks successful Auth delivery'
);
select lives_ok(
  format(
    'select api.mark_household_invitation_delivery(%L,%L,true)',
    '52000000-0000-4000-8000-000000000001',
    current_setting('cluvo.test.invitation_id')
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
  $$select * from api.accept_household_invitation('correct-horse-battery-staple-invite-token')$$,
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
  $$select * from api.accept_household_invitation('correct-horse-battery-staple-invite-token')$$,
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
  $$select * from api.accept_household_invitation('correct-horse-battery-staple-invite-token')$$,
  '42501', 'INVALID_INVITATION',
  'a different verified email cannot reuse the accepted token'
);
select throws_ok(
  $$select * from api.create_household_invitation(
    '52000000-0000-4000-8000-000000000001',
    '54000000-0000-4000-8000-000000000001',
    'Niet', 'Bevoegd', 'niemand@example.test',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    false, false, '55000000-0000-4000-8000-000000000002'
  )$$,
  '42501', 'FORBIDDEN',
  'verified outsider cannot invite into a known household'
);

reset role;
select * from finish();
rollback;
