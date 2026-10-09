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


-- Synthetic provider outcomes exercise the actual native lease and attempt
-- contracts. This is not proof of an external email or an inbox delivery.
insert into app.platform_access_grants(auth_user_id,display_name,permission_key,tenant_scope_id,ends_at,granted_by_auth_user_id)values('b1000000-0000-4000-8000-000000000002','Scoped native operations','platform.integration.manage','b2000000-0000-4000-8000-000000000001',statement_timestamp()+interval '1 day','b1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_template_draft','af500000-0000-4000-8000-000000000001',0,'{"template_key":"retry.native","name":"Retry proof","committee_id":null,"subject":"Welkom {{voornaam}}","preheader":"","sender_name":"Cluvo","reply_to":"info@cluvo.nl","text_body":"Exacte native test","button_label":"","image_path":"","reason":"Synthetic controlled delivery proof"}','af600000-0000-4000-8000-000000000001');
select set_config('cluvo.admin.retry_revision',api.club_admin_read('b2000000-0000-4000-8000-000000000001','templates')->'rows'->0->'revisions'->0->>'id',true);
select api.club_admin_command('b2000000-0000-4000-8000-000000000001','preview_template','af500000-0000-4000-8000-000000000001',1,jsonb_build_object('revision_id',current_setting('cluvo.admin.retry_revision'),'scenario','standard','reason','Actual native preview before queue'),'af600000-0000-4000-8000-000000000002');
select api.club_admin_command('b2000000-0000-4000-8000-000000000001','queue_template_test','af500000-0000-4000-8000-000000000001',2,jsonb_build_object('revision_id',current_setting('cluvo.admin.retry_revision'),'scenario','standard','explicit_confirmation',true,'reason','Personal native outbox proof'),'af600000-0000-4000-8000-000000000003');
reset role;
set local cluvo.delivery_source='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
set local cluvo.delivery_run='1';
set local cluvo.delivery_actor='owned-admin-retry-test';
select internal.pwa_claim_deliveries('af700000-0000-4000-8000-000000000001',20);
select set_config('cluvo.admin.retry_target',(select id::text from app.pwa_delivery_targets where tenant_id='b2000000-0000-4000-8000-000000000001'),true);
select internal.pwa_finish_delivery(current_setting('cluvo.admin.retry_target')::uuid,'af700000-0000-4000-8000-000000000001',2,'failed',429);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(api.platform_read('delivery_targets')->'rows'->0->>'can_retry','true','actual bounded failure has a safe retry projection');
select ok(not(api.platform_read('delivery_targets')->'rows'->0?'email'),'operations projection never loads recipient addresses');
select throws_ok($$select * from app.pwa_delivery_targets$$,'42501',null,'ordinary authenticated client cannot inspect raw worker targets');
select is(api.platform_command('retry_delivery',current_setting('cluvo.admin.retry_target')::uuid,3,'{"explicit_confirmation":true,"reason":"Review known temporary native failure"}','af600000-0000-4000-8000-000000000004')->>'version','4','known failure reuses the original target and budget');
select is(api.platform_command('retry_delivery',current_setting('cluvo.admin.retry_target')::uuid,3,'{"explicit_confirmation":true,"reason":"Review known temporary native failure"}','af600000-0000-4000-8000-000000000004')->>'version','4','double retry command has one outcome');
select throws_ok($$select api.platform_command('retry_delivery',current_setting('cluvo.admin.retry_target')::uuid,3,'{"explicit_confirmation":true,"reason":"Refused stale retry choice"}','af600000-0000-4000-8000-000000000005')$$,'40001','STALE_VERSION','stale retry does not reset the delivery');
reset role;
select is((select count(*)::integer from app.pwa_delivery_targets),1,'retry creates no second logical target');
select is((select attempts from app.pwa_delivery_targets),1,'operator retry does not reset attempt budget');
select internal.pwa_claim_deliveries('af700000-0000-4000-8000-000000000001',20);
select internal.pwa_finish_delivery(current_setting('cluvo.admin.retry_target')::uuid,'af700000-0000-4000-8000-000000000001',5,'unknown',null);
set local role authenticated;
select is(api.platform_read('delivery_targets')->'rows'->0->>'can_retry','false','lost provider response is visibly not safe to retry');
select throws_ok($$select api.platform_command('retry_delivery',current_setting('cluvo.admin.retry_target')::uuid,6,'{"explicit_confirmation":true,"reason":"Refused unknown provider outcome"}','af600000-0000-4000-8000-000000000006')$$,'55000','DELIVERY_RETRY_NOT_PROVEN_SAFE','operator cannot force an unknown response into resend');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select api.platform_command('retry_delivery',current_setting('cluvo.admin.retry_target')::uuid,6,'{"explicit_confirmation":true,"reason":"Refused club role operational elevation"}','af600000-0000-4000-8000-000000000007')$$,'42501','FORBIDDEN','club administrator has no implicit platform retry authority');
reset role;
select is((select count(*)::integer from app.platform_audit_events where action='retry_delivery'),1,'same target retry has one platform audit event');
select is((select count(*)::integer from app.pwa_delivery_attempt_log where target_id=current_setting('cluvo.admin.retry_target')::uuid),4,'both native leases and outcomes remain in immutable attempt history');
select is((select state from app.pwa_delivery_targets),'unknown','rejected retries preserve actual unknown outcome');
select * from finish();
rollback;
