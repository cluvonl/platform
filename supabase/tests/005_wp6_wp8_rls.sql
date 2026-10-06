begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('71000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'member-a@rls.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('71000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'outsider-a@rls.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('71000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'member-b@rls.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('71000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'admin-a@rls.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, timezone, status) values
  ('72000000-0000-4000-8000-000000000001', 'rls-club-a', 'RLS Club A', 'Europe/Amsterdam', 'active'),
  ('72000000-0000-4000-8000-000000000002', 'rls-club-b', 'RLS Club B', 'Europe/Amsterdam', 'active');
insert into app.persons (id, tenant_id, given_name, family_name, status) values
  ('73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'Member', 'A', 'active'),
  ('73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'Outsider', 'A', 'active'),
  ('73000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000002', 'Member', 'B', 'active'),
  ('73000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000001', 'Admin', 'A', 'active');
insert into app.account_person_links (tenant_id, auth_user_id, person_id, verified_at) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', statement_timestamp()),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000002', statement_timestamp()),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000003', statement_timestamp()),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004', '73000000-0000-4000-8000-000000000004', statement_timestamp());
insert into app.tenant_memberships (tenant_id, auth_user_id, status, starts_at) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'active', statement_timestamp() - interval '1 day'),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'active', statement_timestamp() - interval '1 day'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000003', 'active', statement_timestamp() - interval '1 day'),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004', 'active', statement_timestamp() - interval '1 day');

insert into app.committees (id, tenant_id, slug, name) values
  ('74000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'private-a', 'Private A'),
  ('74000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000002', 'private-b', 'Private B');
insert into app.teams (id, tenant_id, name) values
  ('74000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', 'Team A'),
  ('74000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000002', 'Team B');
insert into app.team_person_memberships (tenant_id, team_id, person_id, membership_kind) values
  ('72000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000001', 'player'),
  ('72000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000004', '73000000-0000-4000-8000-000000000003', 'player');
insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, starts_at, granted_by_auth_user_id
) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001',
   (select id from app.permission_roles where tenant_id = '72000000-0000-4000-8000-000000000001' and role_key = 'member'),
   'tenant', statement_timestamp() - interval '1 day', '71000000-0000-4000-8000-000000000004'),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000003',
   (select id from app.permission_roles where tenant_id = '72000000-0000-4000-8000-000000000002' and role_key = 'member'),
   'tenant', statement_timestamp() - interval '1 day', '71000000-0000-4000-8000-000000000003'),
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004',
   (select id from app.permission_roles where tenant_id = '72000000-0000-4000-8000-000000000001' and role_key = 'board'),
   'tenant', statement_timestamp() - interval '1 day', '71000000-0000-4000-8000-000000000004');
insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, committee_id, starts_at, granted_by_auth_user_id
) values (
  '72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004',
  (select id from app.permission_roles where tenant_id = '72000000-0000-4000-8000-000000000001' and role_key = 'committee_coordinator'),
  'committee', '74000000-0000-4000-8000-000000000001', statement_timestamp() - interval '1 day',
  '71000000-0000-4000-8000-000000000004'
);

insert into app.kanban_boards (id, tenant_id, committee_id, name) values
  ('75000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', 'Private Board A');
insert into app.kanban_columns (id, tenant_id, board_id, title, position) values
  ('75000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001', 'Open', 0);
insert into app.kanban_cards (id, tenant_id, board_id, column_id, title, created_by_auth_user_id) values
  ('75000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000002', 'Private card A', '71000000-0000-4000-8000-000000000004');
insert into app.kanban_card_assignees (tenant_id, card_id, person_id, assigned_by_auth_user_id) values
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000004');

insert into app.committee_documents (id, tenant_id, title, owner_person_id, visibility, committee_id) values
  ('75000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000001', 'Private document A', '73000000-0000-4000-8000-000000000004', 'private', '74000000-0000-4000-8000-000000000001');
insert into app.committee_document_acl (tenant_id, document_id, person_id, can_read, granted_by_auth_user_id) values
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000004', '73000000-0000-4000-8000-000000000001', true, '71000000-0000-4000-8000-000000000004');

insert into app.integration_connections (id, tenant_id, provider, connection_key, status) values
  ('75000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000001', 'test', 'a', 'active');
insert into app.integration_runs (
  id, tenant_id, connection_id, trigger_kind, status, source_complete, completed_at,
  requested_by_auth_user_id, idempotency_key
) values (
  '75000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000005', 'manual', 'succeeded', true, statement_timestamp(),
  '71000000-0000-4000-8000-000000000004', '75000000-0000-4000-8000-000000000007'
);
insert into app.matches (
  id, tenant_id, connection_id, source_id, team_id, opponent, starts_at, is_home,
  status, source_hash, last_seen_run_id
) values (
  '75000000-0000-4000-8000-000000000008', '72000000-0000-4000-8000-000000000001',
  '75000000-0000-4000-8000-000000000005', 'private-match-a', '74000000-0000-4000-8000-000000000003',
  'Opponent', '2026-11-01 10:00:00+01', true, 'scheduled', extensions.digest('private-match-a', 'sha256'),
  '75000000-0000-4000-8000-000000000006'
);

insert into app.events (id, tenant_id, title, organizer_person_id, visibility, timezone, status) values
  ('75000000-0000-4000-8000-000000000009', '72000000-0000-4000-8000-000000000001', 'Private event A', '73000000-0000-4000-8000-000000000004', 'private', 'Europe/Amsterdam', 'active');
insert into app.event_occurrences (id, tenant_id, event_id, recurrence_key, starts_at, ends_at, local_date) values
  ('75000000-0000-4000-8000-000000000010', '72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000009', 'one', '2026-11-01 09:00:00+01', '2026-11-01 12:00:00+01', '2026-11-01');
insert into app.event_attendees (tenant_id, occurrence_id, person_id, rsvp) values
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000010', '73000000-0000-4000-8000-000000000001', 'invited');
insert into app.event_resource_links (tenant_id, occurrence_id, card_id, created_by_auth_user_id) values
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000010', '75000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000004');
insert into app.event_resource_links (tenant_id, occurrence_id, document_id, created_by_auth_user_id) values
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000010', '75000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004');
insert into app.event_resource_links (tenant_id, occurrence_id, match_id, created_by_auth_user_id) values
  ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000010', '75000000-0000-4000-8000-000000000008', '71000000-0000-4000-8000-000000000004');

insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type) values
  ('76000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001', 'kanban_card', '75000000-0000-4000-8000-000000000003', 1, 'kanban.mentioned'),
  ('76000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001', 'match', '75000000-0000-4000-8000-000000000008', 1, 'match.changed');
insert into app.mentions (id, tenant_id, recipient_person_id, author_person_id, card_id, source_event_id, excerpt) values
  ('76000000-0000-4000-8000-000000000003', '72000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000004', '75000000-0000-4000-8000-000000000003', '76000000-0000-4000-8000-000000000001', 'Private mention');
insert into app.notification_categories (id, tenant_id, category_key, name) values
  ('76000000-0000-4000-8000-000000000004', '72000000-0000-4000-8000-000000000001', 'match.change', 'Matchwijziging');
insert into app.notification_intents (
  id, tenant_id, domain_event_id, recipient_person_id, category_id, channels,
  dedupe_key, safe_title, safe_body
) values (
  '76000000-0000-4000-8000-000000000005', '72000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000002', '73000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000004', array['inbox'], 'match-a:member-a', 'Wedstrijd gewijzigd', 'Bekijk de wijziging.'
);
insert into app.inbox_items (tenant_id, intent_id, recipient_person_id, title, body) values
  ('72000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000005', '73000000-0000-4000-8000-000000000001', 'Wedstrijd gewijzigd', 'Bekijk de wijziging.');

insert into app.policy_documents (id, tenant_id, document_key, title, current_revision) values
  ('76000000-0000-4000-8000-000000000006', '72000000-0000-4000-8000-000000000001', 'private.policy', 'Private policy A', 1);
insert into app.policy_versions (
  id, tenant_id, document_id, revision, exact_body, state, approved_by_auth_user_id,
  approved_at, published_at, created_by_auth_user_id
) values (
  '76000000-0000-4000-8000-000000000007', '72000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000006', 1, 'Private exact policy text.', 'published',
  '71000000-0000-4000-8000-000000000004', statement_timestamp(), statement_timestamp(),
  '71000000-0000-4000-8000-000000000004'
);
insert into app.policy_audiences (id, tenant_id, policy_version_id, audience_key, criteria_snapshot, approved_by_auth_user_id) values
  ('76000000-0000-4000-8000-000000000008', '72000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000007', 'member-a', '{"person":"member-a"}'::jsonb, '71000000-0000-4000-8000-000000000004');
insert into app.policy_assignments (id, tenant_id, policy_version_id, audience_id, member_person_id) values
  ('76000000-0000-4000-8000-000000000009', '72000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000007', '76000000-0000-4000-8000-000000000008', '73000000-0000-4000-8000-000000000001');

select ok(not has_table_privilege('authenticated', 'app.kanban_cards', 'INSERT'),
          'authenticated cannot directly insert collaboration rows');
select ok(not has_table_privilege('authenticated', 'app.policy_acceptances', 'INSERT'),
          'authenticated cannot directly forge policy acceptance');
select ok(not has_table_privilege('authenticated', 'app.notification_outbox', 'SELECT'),
          'provider outbox is not exposed through the Data API role');
select is(
  (select count(*)::integer
   from pg_catalog.pg_proc as procedure
   join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
   where namespace.nspname = 'api' and procedure.prosecdef),
  0,
  'WP6-WP8 keeps SECURITY DEFINER functions out of exposed api schema'
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
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('71000000-0000-4000-8000-000000000001','')::uuid),true);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}', true);
select is((select count(*)::integer from app.kanban_cards), 1, 'A25: assigned member sees the private card');
select is((select count(*)::integer from app.committee_documents), 1, 'A25: explicit ACL reveals the private document');
select is((select count(*)::integer from app.events), 1, 'A25: attendee sees the private event');
select is((select count(*)::integer from app.event_resource_links), 3, 'A25: authorized agenda exposes only authorized typed links');
select is((select count(*)::integer from app.matches), 1, 'A25: team member sees its match');
select is((select count(*)::integer from app.mentions), 1, 'A24: recipient sees its authorized mention');
select is((select count(*)::integer from app.inbox_items), 1, 'A20: recipient sees its inbox item');
select is((select count(*)::integer from app.policy_assignments), 1, 'A22: assigned member sees its policy assignment');
select is((select count(*)::integer from app.policy_versions), 1, 'A22: assignment reveals the exact policy version');
select is((select count(*)::integer from app.persons where tenant_id = '72000000-0000-4000-8000-000000000002'), 0,
          'tenant A session cannot read tenant B persons');
select throws_ok(
  $$insert into app.kanban_cards (
      tenant_id, board_id, column_id, title, created_by_auth_user_id
    ) values ('72000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001',
              '75000000-0000-4000-8000-000000000002', 'Bypass', '71000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'direct table mutation is denied even to an authorized reader'
);

select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('71000000-0000-4000-8000-000000000002','')::uuid),true);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000002"}', true);
select is((select count(*)::integer from app.kanban_cards), 0, 'A25: unrelated role cannot read private card');
select is((select count(*)::integer from app.committee_documents), 0, 'A25: unrelated role cannot read private document');
select is((select count(*)::integer from app.events), 0, 'A25: unrelated role cannot read private event');
select is((select count(*)::integer from app.event_resource_links), 0, 'A25: agenda links cannot leak hidden sources');
select is((select count(*)::integer from app.matches), 0, 'A25: unrelated role cannot read a team match');
select is((select count(*)::integer from app.mentions), 0, 'A24: mention is not visible to another person');
select is((select count(*)::integer from app.inbox_items), 0, 'A20: inbox item is private to its recipient');
select is((select count(*)::integer from app.policy_assignments), 0, 'A22: unassigned person cannot read policy assignment');
select is((select count(*)::integer from app.policy_versions), 0, 'A22: unassigned person cannot fetch exact policy text');
select is((select count(*)::integer from api.my_agenda), 0, 'A25: security-invoker agenda view preserves event RLS');
select is((select count(*)::integer from api.my_inbox), 0, 'A20: security-invoker inbox view preserves recipient RLS');

reset role;
update app.tenants
set status = 'suspended'
where id = '72000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('71000000-0000-4000-8000-000000000001','')::uuid),true);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}', true);
select is((select count(*)::integer from app.policy_assignments), 0,
          'suspended tenant loses direct RLS access despite an active membership');
select throws_ok(
  $$select api.record_policy_open(
      '72000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000009',
      1, '76000000-0000-4000-8000-000000000010')$$,
  '42501', 'FORBIDDEN', 'suspended tenant cannot mutate through a direct RPC'
);

reset role;
update app.tenants
set status = 'archived'
where id = '72000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('71000000-0000-4000-8000-000000000001','')::uuid),true);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"71000000-0000-4000-8000-000000000001"}', true);
select is((select count(*)::integer from app.policy_assignments), 0,
          'archived tenant loses direct RLS access despite an active membership');
select throws_ok(
  $$select api.record_policy_open(
      '72000000-0000-4000-8000-000000000001', '76000000-0000-4000-8000-000000000009',
      1, '76000000-0000-4000-8000-000000000011')$$,
  '42501', 'FORBIDDEN', 'archived tenant cannot mutate through a direct RPC'
);

select * from finish();
rollback;
