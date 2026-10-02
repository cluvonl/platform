begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Synthetic identities only; every fixture is rolled back.
insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'board@wp68.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'guardian@wp68.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('61000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'coordinator@wp68.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  ('61000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'outsider@wp68.test', '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());

insert into app.tenants (id, slug, name, timezone, status) values
  ('62000000-0000-4000-8000-000000000001', 'wp68-club', 'WP6-WP8 Club', 'Europe/Amsterdam', 'active');

insert into app.persons (id, tenant_id, given_name, family_name, birth_date, birth_date_precision, status) values
  ('63000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'Bo', 'Bestuur', '1980-01-01', 'day', 'active'),
  ('63000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 'Gina', 'Guardian', '1981-01-01', 'day', 'active'),
  ('63000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', 'Co', 'Ordinator', '1982-01-01', 'day', 'active'),
  ('63000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', 'Ona', 'Fhankelijk', '1983-01-01', 'day', 'active'),
  ('63000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', 'Kind', 'Een', '2012-01-01', 'day', 'active'),
  ('63000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000001', 'Kind', 'Twee', '2013-01-01', 'day', 'active'),
  ('63000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000001', 'Kind', 'Drie', '2014-01-01', 'day', 'active');

insert into app.account_person_links (tenant_id, auth_user_id, person_id, verified_at) values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', statement_timestamp()),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', statement_timestamp()),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000003', statement_timestamp()),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000004', statement_timestamp());

insert into app.tenant_memberships (tenant_id, auth_user_id, status, starts_at) values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', 'active', statement_timestamp() - interval '1 day'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'active', statement_timestamp() - interval '1 day'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003', 'active', statement_timestamp() - interval '1 day'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000004', 'active', statement_timestamp() - interval '1 day');

insert into app.committees (id, tenant_id, slug, name) values
  ('64000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'vrijwilligers', 'Vrijwilligers');
insert into app.teams (id, tenant_id, name) values
  ('64000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 'JO14-1');
insert into app.team_person_memberships (tenant_id, team_id, person_id, membership_kind) values
  ('62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', 'team_parent'),
  ('62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000005', 'player');

insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, starts_at, granted_by_auth_user_id
) values
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001',
   (select id from app.permission_roles where tenant_id = '62000000-0000-4000-8000-000000000001' and role_key = 'board'),
   'tenant', statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002',
   (select id from app.permission_roles where tenant_id = '62000000-0000-4000-8000-000000000001' and role_key = 'member'),
   'tenant', statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003',
   (select id from app.permission_roles where tenant_id = '62000000-0000-4000-8000-000000000001' and role_key = 'volunteer_committee'),
   'tenant', statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001');
insert into app.access_grants (
  tenant_id, auth_user_id, role_id, scope_kind, committee_id, starts_at, granted_by_auth_user_id
) values (
  '62000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000003',
  (select id from app.permission_roles where tenant_id = '62000000-0000-4000-8000-000000000001' and role_key = 'committee_coordinator'),
  'committee', '64000000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001'
);

-- A12: team work is zero-credit until the independently approved market path.
insert into app.team_tasks (
  id, tenant_id, team_id, title, assigned_person_id, credit_minutes, created_by_auth_user_id
) values (
  '65000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000002', 'Teamtaak zonder uren',
  '63000000-0000-4000-8000-000000000002', 0, '61000000-0000-4000-8000-000000000002'
);
select is(
  (select credit_minutes from app.team_tasks where id = '65000000-0000-4000-8000-000000000001'),
  0, 'A12: a team task stores zero credit minutes'
);
select throws_ok(
  $$insert into app.team_tasks (tenant_id, team_id, title, credit_minutes, created_by_auth_user_id)
    values ('62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000002',
            'Ongeldig', 30, '61000000-0000-4000-8000-000000000002')$$,
  '23514', null, 'A12: team tasks can never carry credit directly'
);

insert into app.task_categories (id, tenant_id, committee_id, name) values
  ('65000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', 'Wedstrijdondersteuning');
insert into app.task_types (id, tenant_id, category_id, name) values
  ('65000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000002', 'Marktdienst');
insert into app.task_type_versions (id, tenant_id, task_type_id, revision, credit_minutes, approved_by_auth_user_id) values
  ('65000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000003', 1, 90, '61000000-0000-4000-8000-000000000003');
insert into app.team_task_market_requests (
  id, tenant_id, team_task_id, committee_id, category_id, task_type_version_id,
  title, starts_at, ends_at, requested_minutes, requested_by_auth_user_id
) values (
  '65000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000002', '65000000-0000-4000-8000-000000000004',
  'Goedgekeurde marktdienst', '2026-09-15 18:00:00+02', '2026-09-15 19:30:00+02',
  90, '61000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$select api.review_team_task_market_request(
      '62000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000005',
      1, 'volunteer', 'approved', 90, 'Mandaat gecontroleerd', '65000000-0000-4000-8000-000000000006')$$,
  'A12: an authorized review approves conversion to a market shift'
);
select lives_ok(
  $$select api.review_team_task_market_request(
      '62000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000005',
      1, 'volunteer', 'approved', 90, 'Mandaat gecontroleerd', '65000000-0000-4000-8000-000000000006')$$,
  'A12: approval retry is idempotent'
);
select lives_ok(
  $$select api.publish_team_task_market_request(
      '62000000-0000-4000-8000-000000000001', '65000000-0000-4000-8000-000000000005',
      1, '65000000-0000-4000-8000-000000000007')$$,
  'A12: reviewed work publishes as a separate shift'
);
reset role;
select is(
  (select count(*)::integer from app.team_task_market_reviews where request_id = '65000000-0000-4000-8000-000000000005'),
  1, 'A12: approval retry creates no duplicate review'
);
select is(
  (select credit_minutes from app.team_tasks where id = '65000000-0000-4000-8000-000000000001'),
  0, 'A12: publishing does not mutate the zero-hour source task'
);
select set_config('cluvo.test.shift', (select market_shift_id::text from app.team_task_market_requests where id = '65000000-0000-4000-8000-000000000005'), true);
select is(
  (select credit_minutes from app.shifts where id = current_setting('cluvo.test.shift')::uuid),
  90, 'A12: only the approved market shift carries minutes'
);

-- A18/A19: stable provider identity, append-only deltas, conscious impacts,
-- incomplete imports, and DST-safe local scheduler identities.
insert into app.integration_connections (
  id, tenant_id, provider, connection_key, capabilities, credential_reference, status
) values (
  '66000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001',
  'sportlink', 'club-feed', '{"matches":true}'::jsonb, 'vault://sportlink/wp68', 'active'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config(
  'cluvo.test.run1',
  api.start_match_import(
    '62000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001',
    'manual', null, '66000000-0000-4000-8000-000000000002'
  ) ->> 'resource_id', true
);
select lives_ok(
  format(
    'select api.upsert_provider_match(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',
    '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.run1'), 'match-42',
    '64000000-0000-4000-8000-000000000002', 'Tegenstander', '2026-10-10 10:00:00+02', true,
    'Sportpark A', 'Veld 1', 'Kleedkamer 3', 'scheduled', '66000000-0000-4000-8000-000000000003'
  ),
  'A18: first provider import creates a current match and revision'
);
select lives_ok(
  format(
    'select api.finish_match_import(%L,%L,2,%L,true,%L,null::text,%L)',
    '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.run1'),
    'succeeded', 'cursor-1', '66000000-0000-4000-8000-000000000004'
  ),
  'A18: first complete import records success'
);
reset role;
select set_config('cluvo.test.match', (select id::text from app.matches where source_id = 'match-42'), true);
insert into app.match_shift_links (tenant_id, match_id, shift_id, link_kind) values (
  '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.match')::uuid,
  current_setting('cluvo.test.shift')::uuid, 'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config(
  'cluvo.test.run2',
  api.start_match_import(
    '62000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001',
    'scheduled', 'cursor-1', '66000000-0000-4000-8000-000000000005'
  ) ->> 'resource_id', true
);
select lives_ok(
  format(
    'select api.upsert_provider_match(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',
    '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.run2'), 'match-42',
    '64000000-0000-4000-8000-000000000002', 'Tegenstander', '2026-10-10 10:00:00+02', true,
    'Sportpark A', 'Veld 1', 'Kleedkamer 3', 'scheduled', '66000000-0000-4000-8000-000000000006'
  ),
  'A18: repeated identical import reuses provider identity'
);
select lives_ok(
  format(
    'select api.upsert_provider_match(%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L,%L)',
    '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.run2'), 'match-42',
    '64000000-0000-4000-8000-000000000002', 'Tegenstander', '2026-10-11 11:00:00+02', true,
    'Sportpark B', 'Veld 2', 'Kleedkamer 4', 'scheduled', '66000000-0000-4000-8000-000000000007'
  ),
  'A18: changed provider facts append a revision and impact case'
);
select lives_ok(
  format(
    'select api.finish_match_import(%L,%L,3,%L,true,%L,null::text,%L)',
    '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.run2'),
    'succeeded', 'cursor-2', '66000000-0000-4000-8000-000000000008'
  ),
  'A18: changed import completes without rewriting linked work'
);
reset role;
select is((select count(*)::integer from app.matches where source_id = 'match-42'), 1,
          'A18: one provider source remains one current match');
select is((select count(*)::integer from app.match_revisions where match_id = current_setting('cluvo.test.match')::uuid), 2,
          'A18: identical import is quiet and a delta adds one revision');
select is((select count(*)::integer from app.match_change_impacts where shift_id = current_setting('cluvo.test.shift')::uuid), 1,
          'A18: linked shift receives a conscious impact case');
select is((select starts_at from app.shifts where id = current_setting('cluvo.test.shift')::uuid),
          '2026-09-15 16:00:00+00'::timestamptz,
          'A18: a match delta never silently moves its linked shift');

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select set_config(
  'cluvo.test.run3',
  api.start_match_import(
    '62000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001',
    'scheduled', 'cursor-2', '66000000-0000-4000-8000-000000000009'
  ) ->> 'resource_id', true
);
select lives_ok(
  format(
    'select api.finish_match_import(%L,%L,1,%L,false,null::text,%L,%L)',
    '62000000-0000-4000-8000-000000000001', current_setting('cluvo.test.run3'),
    'incomplete', 'SOURCE_TIMEOUT', '66000000-0000-4000-8000-000000000010'
  ),
  'A19: an incomplete import is recorded explicitly'
);
select lives_ok(
  $$select api.start_match_import(
      '62000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001',
      'retry', 'cursor-2', '66000000-0000-4000-8000-000000000011')$$,
  'A19: an errored connection permits an explicit retry run'
);
reset role;
select is((select status from app.matches where id = current_setting('cluvo.test.match')::uuid), 'scheduled',
          'A19: absence from an incomplete import does not mean cancelled');
select is((select effective_local_time from internal.resolve_local_slot('2026-03-29', '02:30', 'Europe/Amsterdam')),
          '03:00'::time, 'A19: nonexistent spring time moves to the first real local minute');
select is((select dst_resolution from internal.resolve_local_slot('2026-03-29', '02:30', 'Europe/Amsterdam')),
          'gap_shift_forward', 'A19: spring gap handling is explicit');
select is((select scheduled_at from internal.resolve_local_slot('2026-10-25', '02:30', 'Europe/Amsterdam')),
          '2026-10-25 00:30:00+00'::timestamptz, 'A19: autumn fold deterministically chooses the first instant');
select is((select dst_resolution from internal.resolve_local_slot('2026-10-25', '02:30', 'Europe/Amsterdam')),
          'fold_first', 'A19: autumn fold handling is explicit');

-- A20/A21: per-person/task dedupe, one local-day digest, immutable template
-- versions, and a delivery state that does not overclaim provider evidence.
insert into app.notification_categories (id, tenant_id, category_key, name, essential) values
  ('67000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'task.offer', 'Taakaanbod', false);
insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type) values
  ('67000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', 'shift', current_setting('cluvo.test.shift')::uuid, 2, 'task.offer.created'),
  ('67000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', 'shift', current_setting('cluvo.test.shift')::uuid, 3, 'task.offer.created');
insert into app.notification_intents (
  id, tenant_id, domain_event_id, recipient_person_id, category_id, channels,
  dedupe_key, safe_title, safe_body
) values
  ('67000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', '67000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', '67000000-0000-4000-8000-000000000001', array['push','inbox'], 'task:one:person-2', 'Nieuwe taak', 'Taak één'),
  ('67000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', '67000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000002', '67000000-0000-4000-8000-000000000001', array['push','inbox'], 'task:two:person-2', 'Nog een taak', 'Taak twee');
select throws_ok(
  $$insert into app.notification_intents (
      tenant_id, domain_event_id, recipient_person_id, category_id, channels, dedupe_key, safe_title, safe_body
    ) values ('62000000-0000-4000-8000-000000000001', '67000000-0000-4000-8000-000000000002',
              '63000000-0000-4000-8000-000000000002', '67000000-0000-4000-8000-000000000001',
              array['push'], 'task:one:person-2', 'Dubbel', 'Tweede rol')$$,
  '23505', null, 'A20: two matching roles cannot duplicate a person/task intent'
);
select is((select count(*)::integer from app.notification_intents where recipient_person_id = '63000000-0000-4000-8000-000000000002'), 2,
          'A20: distinct tasks retain distinct notification opportunities');
insert into app.daily_task_digests (tenant_id, recipient_person_id, local_date, timezone) values
  ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', '2026-10-02', 'Europe/Amsterdam');
select throws_ok(
  $$insert into app.daily_task_digests (tenant_id, recipient_person_id, local_date, timezone)
    values ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002',
            '2026-10-02', 'Europe/Amsterdam')$$,
  '23505', null, 'A20: at most one offer digest exists per person/local day'
);

insert into app.message_templates (id, tenant_id, template_key, name, owner_scope) values
  ('67000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000001', 'task.offer', 'Taakaanbod', 'tenant');
insert into app.message_template_versions (
  id, tenant_id, template_id, revision, subject, sender_name, html_body, text_body,
  variable_schema, fallback_values, state, approved_by_auth_user_id, approved_at,
  published_at, created_by_auth_user_id
) values (
  '67000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000001',
  '67000000-0000-4000-8000-000000000006', 1, 'Nieuwe taak', 'Cluvo', '<p>{{task}}</p>', '{{task}}',
  '{"task":{"type":"string"}}'::jsonb, '{"task":"clubtaak"}'::jsonb, 'published',
  '61000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp(),
  '61000000-0000-4000-8000-000000000001'
);
select is((select fallback_values ->> 'task' from app.message_template_versions where id = '67000000-0000-4000-8000-000000000007'),
          'clubtaak', 'A21: published templates retain safe fallback data');
select throws_ok(
  $$update app.message_template_versions set text_body = 'rewritten'
    where id = '67000000-0000-4000-8000-000000000007'$$,
  '55000', 'published template version is immutable', 'A21: published template text is immutable'
);
insert into app.notification_outbox (
  id, tenant_id, intent_id, recipient_person_id, channel, template_version_id,
  dedupe_key, body_hash, due_at, status, provider_message_key
) values (
  '67000000-0000-4000-8000-000000000008', '62000000-0000-4000-8000-000000000001',
  '67000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000002',
  'email', '67000000-0000-4000-8000-000000000007', 'email:task:one:person-2',
  extensions.digest(convert_to('rendered', 'UTF8'), 'sha256'), statement_timestamp(),
  'provider_accepted', 'provider-message-1'
);
select throws_ok(
  $$insert into app.notification_outbox (
      tenant_id, intent_id, recipient_person_id, channel, template_version_id, dedupe_key, body_hash, due_at
    ) values ('62000000-0000-4000-8000-000000000001', '67000000-0000-4000-8000-000000000004',
              '63000000-0000-4000-8000-000000000002', 'email', '67000000-0000-4000-8000-000000000007',
              'email:task:one:person-2', '\x01'::bytea, statement_timestamp())$$,
  '23505', null, 'A21: a send unit is not recreated by retry'
);
select isnt((select status from app.notification_outbox where id = '67000000-0000-4000-8000-000000000008'),
            'delivered', 'A21: provider acceptance is not reported as delivery');

-- A22/A23: exact text, explicit guardian acceptance, and questions without
-- accidental acceptance.
insert into app.policy_documents (id, tenant_id, document_key, title, current_revision) values
  ('68000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', 'privacy.youth', 'Jeugdprivacy', 1);
insert into app.policy_versions (
  id, tenant_id, document_id, revision, exact_body, state, approved_by_auth_user_id,
  approved_at, published_at, created_by_auth_user_id
) values (
  '68000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001',
  '68000000-0000-4000-8000-000000000001', 1, 'Exacte tekst versie één.', 'published',
  '61000000-0000-4000-8000-000000000001', statement_timestamp(), statement_timestamp(),
  '61000000-0000-4000-8000-000000000001'
);
insert into app.policy_audiences (id, tenant_id, policy_version_id, audience_key, criteria_snapshot, approved_by_auth_user_id) values
  ('68000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001',
   '68000000-0000-4000-8000-000000000002', 'youth', '{"team":"JO14-1"}'::jsonb, '61000000-0000-4000-8000-000000000001');
insert into app.policy_assignments (id, tenant_id, policy_version_id, audience_id, member_person_id) values
  ('68000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000002', '68000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000005'),
  ('68000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000002', '68000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000006'),
  ('68000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000002', '68000000-0000-4000-8000-000000000003', '63000000-0000-4000-8000-000000000007');
insert into app.guardian_authorizations (
  tenant_id, guardian_person_id, represented_member_id, scope, valid_from, verified_by_auth_user_id
) values
  ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000005', 'policy_acceptance', statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000006', 'policy_acceptance', statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000007', 'policy_acceptance', statement_timestamp() - interval '1 day', '61000000-0000-4000-8000-000000000001');

-- Oversight permissions retain read access but cannot impersonate the member
-- or guardian by recording an open or submitting a question.
set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*)::integer from app.policy_assignments), 3,
          'policy manager retains oversight read access');
select throws_ok(
  $$select api.record_policy_open(
      '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000004',
      1, '68000000-0000-4000-8000-000000000013')$$,
  '42501', 'FORBIDDEN', 'policy manager cannot record a member open'
);
select throws_ok(
  $$select api.ask_policy_question(
      '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000004',
      1, 'Manager mag geen ledenvraag simuleren', '68000000-0000-4000-8000-000000000014')$$,
  '42501', 'FORBIDDEN', 'policy manager cannot submit a member question'
);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is((select count(*)::integer from app.policy_assignments), 3,
          'policy follow-up role retains oversight read access');
select throws_ok(
  $$select api.record_policy_open(
      '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000004',
      1, '68000000-0000-4000-8000-000000000015')$$,
  '42501', 'FORBIDDEN', 'policy follow-up role cannot record a member open'
);
select throws_ok(
  $$select api.ask_policy_question(
      '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000004',
      1, 'Opvolger mag geen ledenvraag simuleren', '68000000-0000-4000-8000-000000000016')$$,
  '42501', 'FORBIDDEN', 'policy follow-up role cannot submit a member question'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select lives_ok($$select api.record_policy_open('62000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000004',1,'68000000-0000-4000-8000-000000000007')$$,
                'A23: opening child one does not imply acceptance');
select lives_ok($$select api.record_policy_open('62000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000005',1,'68000000-0000-4000-8000-000000000008')$$,
                'A23: opening child two does not imply acceptance');
select lives_ok($$select api.record_policy_open('62000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000006',1,'68000000-0000-4000-8000-000000000009')$$,
                'A23: opening child three does not imply acceptance');
select is((select count(*)::integer from app.policy_acceptances), 0, 'A23: opening creates no acceptance row');
select lives_ok(
  $$select api.accept_policy_assignments(
      '62000000-0000-4000-8000-000000000001',
      array['68000000-0000-4000-8000-000000000004','68000000-0000-4000-8000-000000000005']::uuid[],
      array[2,2]::bigint[], 'guardian', true, '68000000-0000-4000-8000-000000000010')$$,
  'A22: explicit guardian confirmation accepts for two children atomically'
);
select lives_ok(
  $$select api.ask_policy_question(
      '62000000-0000-4000-8000-000000000001', '68000000-0000-4000-8000-000000000006',
      2, 'Welke gegevens worden gedeeld?', '68000000-0000-4000-8000-000000000011')$$,
  'A23: a question creates follow-up rather than acceptance'
);
reset role;
select is((select count(*)::integer from app.policy_acceptances where capacity = 'guardian'), 2,
          'A22: two represented children have two evidence rows');
select ok(not exists (
  select 1 from app.policy_acceptances as acceptance
  join app.policy_versions as version_row on version_row.tenant_id = acceptance.tenant_id and version_row.id = acceptance.policy_version_id
  where acceptance.version_hash <> version_row.body_hash
), 'A22: acceptance hashes exactly the displayed version');
select is((select state from app.policy_assignments where id = '68000000-0000-4000-8000-000000000006'),
          'question_pending', 'A23: a question enters explicit follow-up state');
select ok((select reminder_paused from app.policy_assignments where id = '68000000-0000-4000-8000-000000000006'),
          'A23: reminders pause while a question is pending');
select throws_ok(
  $$update app.policy_versions set exact_body = 'rewritten' where id = '68000000-0000-4000-8000-000000000002'$$,
  '55000', 'published policy version is immutable', 'A23: accepted exact policy text is immutable'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
select throws_ok(
  $$select api.accept_policy_assignments(
      '62000000-0000-4000-8000-000000000001', array['68000000-0000-4000-8000-000000000006']::uuid[],
      array[3]::bigint[], 'guardian', true, '68000000-0000-4000-8000-000000000012')$$,
  '42501', 'GUARDIAN_AUTHORIZATION_REQUIRED', 'A22: unauthorized representation is rejected'
);
reset role;

-- A24/A25: multiple workers and mentions project to My actions; completion is
-- non-ledger, while typed agenda relationships survive.
insert into app.kanban_boards (id, tenant_id, committee_id, name) values
  ('69000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', 'Commissiebord');
insert into app.kanban_columns (id, tenant_id, board_id, title, position, terminal) values
  ('69000000-0000-4000-8000-000000000002', '62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000001', 'Te doen', 0, false),
  ('69000000-0000-4000-8000-000000000003', '62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000001', 'Klaar', 1, true);
insert into app.kanban_cards (id, tenant_id, board_id, column_id, title, accountable_person_id, created_by_auth_user_id) values
  ('69000000-0000-4000-8000-000000000004', '62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000002', 'Clubdag', '63000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003');
insert into app.kanban_card_assignees (tenant_id, card_id, person_id, assigned_by_auth_user_id) values
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003'),
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000004', '63000000-0000-4000-8000-000000000003', '61000000-0000-4000-8000-000000000003');
insert into app.kanban_card_subtasks (id, tenant_id, card_id, title) values
  ('69000000-0000-4000-8000-000000000005', '62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000004', 'Materialen');
insert into app.kanban_subtask_assignees (tenant_id, subtask_id, person_id, assigned_by_auth_user_id) values
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000005', '63000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000003');
insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type) values
  ('69000000-0000-4000-8000-000000000006', '62000000-0000-4000-8000-000000000001', 'kanban_card', '69000000-0000-4000-8000-000000000004', 1, 'kanban.mentioned');
insert into app.mentions (id, tenant_id, recipient_person_id, author_person_id, card_id, source_event_id, excerpt) values
  ('69000000-0000-4000-8000-000000000007', '62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000003', '69000000-0000-4000-8000-000000000004', '69000000-0000-4000-8000-000000000006', 'Kun jij dit controleren?');
select throws_ok(
  $$insert into app.mentions (tenant_id, recipient_person_id, author_person_id, card_id, source_event_id, excerpt)
    values ('62000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000004',
            '63000000-0000-4000-8000-000000000003', '69000000-0000-4000-8000-000000000004',
            '69000000-0000-4000-8000-000000000006', 'Geen bronrecht')$$,
  '42501', 'MENTION_RECIPIENT_CANNOT_ACCESS_SOURCE', 'A24: mention cannot disclose a source without access'
);
select is((select count(*)::integer from app.personal_action_items
           where recipient_person_id = '63000000-0000-4000-8000-000000000002'
             and action_kind in ('card_assignment','subtask_assignment','mention')), 3,
          'A24: assignee, subtask, and mention project to My actions');

insert into app.events (id, tenant_id, title, organizer_person_id, visibility, timezone, status) values
  ('69000000-0000-4000-8000-000000000008', '62000000-0000-4000-8000-000000000001', 'Besloten clubdag', '63000000-0000-4000-8000-000000000003', 'private', 'Europe/Amsterdam', 'active');
insert into app.event_occurrences (id, tenant_id, event_id, recurrence_key, starts_at, ends_at, local_date) values
  ('69000000-0000-4000-8000-000000000009', '62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000008', '2026-10-10', '2026-10-10 09:00:00+02', '2026-10-10 12:00:00+02', '2026-10-10');
insert into app.event_attendees (tenant_id, occurrence_id, person_id, rsvp) values
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000009', '63000000-0000-4000-8000-000000000002', 'invited');
insert into app.event_resource_links (tenant_id, occurrence_id, card_id, created_by_auth_user_id) values
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000009', '69000000-0000-4000-8000-000000000004', '61000000-0000-4000-8000-000000000003');
insert into app.event_resource_links (tenant_id, occurrence_id, shift_id, created_by_auth_user_id) values
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000009', current_setting('cluvo.test.shift')::uuid, '61000000-0000-4000-8000-000000000003');
insert into app.event_resource_links (tenant_id, occurrence_id, match_id, created_by_auth_user_id) values
  ('62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000009', current_setting('cluvo.test.match')::uuid, '61000000-0000-4000-8000-000000000003');
select is((select count(*)::integer from app.event_resource_links where occurrence_id = '69000000-0000-4000-8000-000000000009'),
          3, 'A25: agenda keeps typed links to card, shift, and match');

set local role authenticated;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$select api.complete_kanban_card(
      '62000000-0000-4000-8000-000000000001', '69000000-0000-4000-8000-000000000004',
      1, '69000000-0000-4000-8000-000000000010')$$,
  'A24: accountable coordinator completes the card'
);
reset role;
select is((select count(*)::integer from app.hour_ledger_entries where tenant_id = '62000000-0000-4000-8000-000000000001'),
          0, 'A24: card completion never writes the hours ledger');
select is((select state from app.personal_action_items
           where recipient_person_id = '63000000-0000-4000-8000-000000000002' and action_kind = 'card_assignment'),
          'completed', 'A24: card completion resolves the card action');
select is((select count(*)::integer from app.event_resource_links where occurrence_id = '69000000-0000-4000-8000-000000000009'),
          3, 'A25: card completion preserves agenda relationships');

select * from finish();
rollback;
