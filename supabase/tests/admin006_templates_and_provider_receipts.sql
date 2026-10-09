begin;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at)values
 ('b1000000-0000-4000-8000-000000000001','admin-native@example.test',statement_timestamp()),
 ('b1000000-0000-4000-8000-000000000002','support-native@example.test',statement_timestamp()),
 ('b1000000-0000-4000-8000-000000000003','limited-native@example.test',statement_timestamp());
insert into auth.sessions(id,user_id)select id,id from auth.users where id::text like 'b1000000-%';
insert into app.tenants(id,slug,name)values
 ('b2000000-0000-4000-8000-000000000001','club-admin-native','Synthetic administrative club'),
 ('b2000000-0000-4000-8000-000000000002','club-admin-other','Other synthetic club');
insert into app.persons(id,tenant_id,given_name,family_name)values
 ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Native','Administrator'),
 ('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','Limited','Coordinator');
insert into app.account_person_links(tenant_id,auth_user_id,person_id,verified_at)values
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',statement_timestamp()),
 ('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000003',statement_timestamp());
insert into app.tenant_memberships(tenant_id,auth_user_id)select 'b2000000-0000-4000-8000-000000000001',u.id from auth.users u where id in ('b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003');
insert into app.permission_roles(id,tenant_id,role_key,name,system_role)values('b4000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','native_admin_test','Explicit synthetic test authority',false);
insert into app.role_permissions(tenant_id,role_id,permission_key)select 'b2000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001',permission_key from app.permissions;
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','tenant','b1000000-0000-4000-8000-000000000001');
insert into app.platform_access_grants(auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)values('b1000000-0000-4000-8000-000000000002','Named support employee','platform.support',statement_timestamp()+interval '1 day','b1000000-0000-4000-8000-000000000001');

-- Native SQL lifecycle proof with synthetic provider acknowledgement fixtures.
-- This is not evidence of an actual external email or inbox delivery.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_template_draft','ae500000-0000-4000-8000-000000000001',0,'{"template_key":"admin.native","name":"Native template","committee_id":null,"subject":"Welkom {{voornaam}}","preheader":"Jouw vereniging","sender_name":"Cluvo","reply_to":"info@cluvo.nl","text_body":"Beste {{voornaam}}, {{vereniging}}: {{dienst}}. {{huishouden}}. {{urenstand}}. {{actielink}}","button_label":"Open Cluvo","image_path":"","reason":"Exacte synthetische templatecontrole"}','ae600000-0000-4000-8000-000000000001')->>'ok','true','actual immutable concept version persists');
select set_config('cluvo.admin.template_revision',(api.club_admin_read('b2000000-0000-4000-8000-000000000001','templates',null,'ae500000-0000-4000-8000-000000000001')->'rows'->0->'revisions'->0->>'id'),true);
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','queue_template_test','ae500000-0000-4000-8000-000000000001',1,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'scenario','standard','explicit_confirmation',true,'reason','Verzending zonder voorafgaande controle'),'ae600000-0000-4000-8000-000000000002')$$,'55000','TEMPLATE_PREVIEW_REQUIRED','test cannot skip the actual preview step');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','preview_template','ae500000-0000-4000-8000-000000000001',i,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'scenario',scenario,'reason','Controle van de volledige voorbeeldtekst'),('ae600000-0000-4000-8000-'||lpad((i+10)::text,12,'0'))::uuid)->>'ok','true','saved template example: '||scenario)from unnest(array['standard','missing_name','long_title','two_children','no_hours','represented'])with ordinality x(scenario,i);
select ok(exists(select 1 from jsonb_array_elements(api.club_admin_read('b2000000-0000-4000-8000-000000000001','templates',null,'ae500000-0000-4000-8000-000000000001')->'extras'->'tests')t where t->>'rendered_subject'='Welkom beste clublid'),'missing personal name gets useful fallback');
select ok(exists(select 1 from jsonb_array_elements(api.club_admin_read('b2000000-0000-4000-8000-000000000001','templates',null,'ae500000-0000-4000-8000-000000000001')->'extras'->'tests')t where t->>'rendered_text'like '%één gekozen kindtelling%'),'two-child example preserves explicit single-child counting');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','preview_template','ae500000-0000-4000-8000-000000000001',1,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'scenario','standard','reason','Afgewezen verouderde templatekeuze'),'ae600000-0000-4000-8000-000000000021')$$,'40001','STALE_VERSION','stale template action cannot overwrite the reviewed choice');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','queue_template_test','ae500000-0000-4000-8000-000000000001',7,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'scenario','standard','explicit_confirmation',true,'reason','Persoonlijke geverifieerde test aanvragen'),'ae600000-0000-4000-8000-000000000022')->>'ok','true','test enters existing personal notification outbox');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','queue_template_test','ae500000-0000-4000-8000-000000000001',7,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'scenario','standard','explicit_confirmation',true,'reason','Persoonlijke geverifieerde test aanvragen'),'ae600000-0000-4000-8000-000000000022')->>'version','8','double click returns same durable queued test');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','queue_template_test','ae500000-0000-4000-8000-000000000001',8,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'scenario','standard','explicit_confirmation',true,'reason','Afgewezen nieuw ID voor onbekende verzending'),'ae600000-0000-4000-8000-000000000023')$$,'55000','TEMPLATE_DELIVERY_ALREADY_TRACKED','new command ID cannot duplicate pending or unknown provider work');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','approve_template','ae500000-0000-4000-8000-000000000001',8,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'explicit_confirmation',true,'reason','Afgewezen fictieve providergoedkeuring'),'ae600000-0000-4000-8000-000000000024')$$,'55000','ACTUAL_TEMPLATE_TEST_REQUIRED','queuing alone is no provider test proof');
reset role;
select is((select count(*)::integer from app.pwa_delivery_outbox where tenant_id='b2000000-0000-4000-8000-000000000001'),1,'one outbox despite repeated queue request');
select is((select recipient_person_id from app.pwa_delivery_outbox where tenant_id='b2000000-0000-4000-8000-000000000001'),'b3000000-0000-4000-8000-000000000001'::uuid,'test recipient is the requesting verified person');
set local cluvo.delivery_source='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
set local cluvo.delivery_run='1';
set local cluvo.delivery_actor='owned-admin-template-test';
select internal.pwa_claim_deliveries('ae700000-0000-4000-8000-000000000001',20);
select set_config('cluvo.admin.target',(select id::text from app.pwa_delivery_targets where tenant_id='b2000000-0000-4000-8000-000000000001'),true);
select is((select last_delivery_state from app.template_test_runs where outbox_id is not null),'leased','worker lease is shown as actual pending delivery work');
set local cluvo.delivery_scope='local';
select throws_ok($$select internal.pwa_revalidate_delivery(current_setting('cluvo.admin.target')::uuid,'ae700000-0000-4000-8000-000000000001',2)$$,'P0001','STAGING_AUTOMATION_CONTEXT_REQUIRED','worker revalidation rejects a context outside the bound staging scope');
set local cluvo.delivery_scope='staging';
select internal.pwa_finish_delivery(current_setting('cluvo.admin.target')::uuid,'ae700000-0000-4000-8000-000000000001',2,'sent',202);
select is((select status from app.template_test_runs where outbox_id is not null),'planned','bare synthetic acceptance without request receipt still cannot approve');
insert into app.pwa_provider_receipts(tenant_id,target_id,attempt_log_id,attempt,body_sha256,template_revision,provider_message_key)
 select t.tenant_id,t.id,a.id,a.attempt,decode(repeat('ab',32),'hex'),1,'synthetic-template-provider-ack' from app.pwa_delivery_targets t join app.pwa_delivery_attempt_log a on a.tenant_id=t.tenant_id and a.target_id=t.id and a.state='sent' where t.id=current_setting('cluvo.admin.target')::uuid;
select is((select status from app.template_test_runs where outbox_id is not null),'accepted','native receipt links exact template revision and provider acknowledgement fixture');
set local role authenticated;
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','approve_template','ae500000-0000-4000-8000-000000000001',9,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'explicit_confirmation',true,'reason','Bevoegde expliciete goedkeuring na bewijs'),'ae600000-0000-4000-8000-000000000025')->>'ok','true','actual reviewed version may be explicitly approved');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','publish_template','ae500000-0000-4000-8000-000000000001',10,jsonb_build_object('revision_id',current_setting('cluvo.admin.template_revision'),'explicit_confirmation',true,'reason','Bevoegde publicatie van exact geteste versie'),'ae600000-0000-4000-8000-000000000026')->>'ok','true','publication persists same exact approved revision');
select is(api.club_admin_read('b2000000-0000-4000-8000-000000000001','templates',null,'ae500000-0000-4000-8000-000000000001')->'rows'->0->'revisions'->0->>'state','published','fresh second-device read sees published version');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','templates',null,'ae500000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','unprivileged direct template URL is refused');
reset role;
select throws_ok($$update app.message_template_versions set text_body='Illegale wijziging'where id=current_setting('cluvo.admin.template_revision')::uuid$$,'55000','published template version is immutable','published message bytes cannot be rewritten');
select is((select count(*)::integer from app.audit_events where action='admin.queue_template_test'),1,'one actor-scoped queue audit despite retries');
select * from finish();
rollback;
