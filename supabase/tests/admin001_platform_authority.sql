begin;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email,email_confirmed_at)values
 ('a1000000-0000-4000-8000-000000000001','platform-owner@example.test',statement_timestamp()),
 ('a1000000-0000-4000-8000-000000000002','club-board@example.test',statement_timestamp()),
 ('a1000000-0000-4000-8000-000000000003','platform-support@example.test',statement_timestamp());
insert into auth.sessions(id,user_id)select id,id from auth.users where id::text like 'a1000000-%';
insert into app.tenants(id,slug,name)values
 ('a2000000-0000-4000-8000-000000000001','admin-alpha','Admin Alpha'),
 ('a2000000-0000-4000-8000-000000000002','admin-beta','Admin Beta');
insert into app.persons(id,tenant_id,given_name,family_name)values('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','Synthetic','Board');
insert into app.account_person_links(tenant_id,auth_user_id,person_id,verified_at)values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000002',statement_timestamp());
insert into app.tenant_memberships(tenant_id,auth_user_id)values('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)
 select tenant_id,'a1000000-0000-4000-8000-000000000002',id,'tenant','a1000000-0000-4000-8000-000000000002' from app.permission_roles where tenant_id='a2000000-0000-4000-8000-000000000001' and role_key='board';
insert into app.platform_access_grants(auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)
 select 'a1000000-0000-4000-8000-000000000001','Synthetic platform owner',p,statement_timestamp()+interval '365 days','a1000000-0000-4000-8000-000000000001'
 from unnest(array['platform.overview','platform.tenant.read','platform.tenant.manage','platform.access.manage','platform.config.manage','platform.integration.manage','platform.support','platform.audit.read'])p;
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind='r' and c.relname like 'platform_%'),'all new platform relations force RLS');
select ok(not has_table_privilege('authenticated','app.platform_access_grants','SELECT'),'no raw platform grant directory');
select ok(not has_table_privilege('authenticated','app.platform_tenant_profiles','UPDATE'),'no direct tenant profile writes');
select ok(not has_table_privilege('service_role','app.platform_command_receipts','SELECT'),'service key cannot read command receipts');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","session_id":"a1000000-0000-4000-8000-000000000002","email":"club-board@example.test"}',true);
select is(api.platform_access()->>'authorized','false','club board is not a platform actor');
select throws_ok($$select api.platform_read('tenants')$$,'42501','FORBIDDEN','club board cannot list other tenants');
select throws_ok($$select api.platform_command('create_tenant','a2000000-0000-4000-8000-000000000004',0,'{"slug":"illegal","name":"Illegal","reason":"negative scope"}','a4000000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','forged platform command refused');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a1000000-0000-4000-8000-000000000001","email":"platform-owner@example.test"}',true);
select is(api.platform_access()->>'authorized','true','native platform session authorized without club membership');
select is((select count(*)::integer from api.my_workspaces),0,'platform rights create no implicit club workspace');
select is(jsonb_array_length(api.platform_read('tenants')->'rows'),2,'platform operational list sees two clubs');
select ok(not (api.platform_read('tenants')::text~'intake|password|private_answers|credential_envelope'),'operational projection omits private content and secrets');
select throws_ok($$select api.platform_read('raw_sql')$$,'22023','INVALID_READ','no arbitrary platform SQL');
select is(api.platform_command('create_tenant','a2000000-0000-4000-8000-000000000004',0,'{"slug":"admin-new","name":"New synthetic club","contact_name":"Test contact","contact_email":"contact@example.test","reason":"native onboarding test"}','a4000000-0000-4000-8000-000000000004')->>'ok','true','native tenant onboarding command');
select is(api.platform_command('create_tenant','a2000000-0000-4000-8000-000000000004',0,'{"slug":"admin-new","name":"New synthetic club","contact_name":"Test contact","contact_email":"contact@example.test","reason":"native onboarding test"}','a4000000-0000-4000-8000-000000000004')->>'version','1','identical retry returns durable receipt');
select is(jsonb_array_length(api.platform_read('tenants')->'rows'),3,'retry creates one tenant');
select is(api.platform_read('tenant','a2000000-0000-4000-8000-000000000004')->'rows'->0->>'status','preparing','new club stays in preparation');
select throws_ok($$select api.platform_command('create_tenant','a2000000-0000-4000-8000-000000000004',0,'{"slug":"admin-new","name":"Changed","contact_name":"Test contact","contact_email":"contact@example.test","reason":"native onboarding test"}','a4000000-0000-4000-8000-000000000004')$$,'22000','IDEMPOTENCY_CONFLICT','changed retry cannot reuse receipt');
select is(api.platform_command_status('a4000000-0000-4000-8000-000000000004')->>'state','confirmed','same command status readback');
select is(api.platform_command_status('a4000000-0000-4000-8000-000000000099')->>'state','unknown','missing response is unknown rather than invented success');
select throws_ok($$select api.platform_command('grant_staff','a5000000-0000-4000-8000-000000000001',0,'{"auth_user_id":"a1000000-0000-4000-8000-000000000001","display_name":"Self","permission_key":"platform.tenant.read","ends_at":"2026-11-09T12:00:00Z","reason":"invalid self escalation"}','a4000000-0000-4000-8000-000000000005')$$,'42501','SELF_GRANT_REFUSED','self grants are refused');
select is(api.platform_command('grant_staff','a5000000-0000-4000-8000-000000000002',0,jsonb_build_object('auth_user_id','a1000000-0000-4000-8000-000000000002','display_name','Scoped employee','permission_key','platform.tenant.read','tenant_scope_id','a2000000-0000-4000-8000-000000000001','ends_at',statement_timestamp()+interval '1 hour','reason','bounded staff delegation'),'a4000000-0000-4000-8000-000000000006')->>'ok','true','delegate one permission for one tenant');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","session_id":"a1000000-0000-4000-8000-000000000002","email":"club-board@example.test"}',true);
select is(jsonb_array_length(api.platform_read('tenants')->'rows'),1,'tenant-scoped platform employee sees only named club');
select throws_ok($$select api.platform_read('tenant','a2000000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','forged other club detail denied');
select throws_ok($$select api.platform_read('staff')$$,'42501','FORBIDDEN','tenant reader cannot read platform staff');
select throws_ok($$select api.platform_read('overview')$$,'42501','FORBIDDEN','tenant reader cannot read global totals');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a1000000-0000-4000-8000-000000000001","email":"platform-owner@example.test"}',true);
select is(api.platform_command('revoke_staff','a5000000-0000-4000-8000-000000000002',1,'{"reason":"end bounded access"}','a4000000-0000-4000-8000-000000000007')->>'ok','true','targeted platform permission revocation');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","session_id":"a1000000-0000-4000-8000-000000000002","email":"club-board@example.test"}',true);
select throws_ok($$select api.platform_read('tenants')$$,'42501','FORBIDDEN','current session loses revoked platform permission immediately');
select is((select count(*)::integer from api.my_workspaces),1,'platform revocation preserves separate club membership');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a1000000-0000-4000-8000-000000000001","email":"platform-owner@example.test"}',true);
select is(api.platform_command('save_default','a6000000-0000-4000-8000-000000000001',0,'{"setting_key":"planning","value":{"cancellation_minutes":2880,"confirmation_days":7,"dispute_days":14},"reason":"native default configuration"}','a4000000-0000-4000-8000-000000000008')->>'ok','true','global default saved');
select is(api.platform_read('defaults')->'rows'->0->'value_json'->>'cancellation_minutes','2880','default persists through fresh read');
select throws_ok($$select api.platform_command('save_default','a6000000-0000-4000-8000-000000000001',0,'{"setting_key":"planning","value":{"cancellation_minutes":100,"confirmation_days":7,"dispute_days":14},"reason":"stale configuration attempt"}','a4000000-0000-4000-8000-000000000009')$$,'40001','STALE_VERSION','stale defaults refused');
select throws_ok($$select api.platform_command('save_default','a6000000-0000-4000-8000-000000000002',0,'{"setting_key":"organization","value":{"secret":"negative"},"reason":"unsafe config field"}','a4000000-0000-4000-8000-000000000010')$$,'22023','INVALID_SETTING','secret and arbitrary configuration fields refused');
select is(api.platform_command('set_module','a7000000-0000-4000-8000-000000000001',0,'{"tenant_id":"a2000000-0000-4000-8000-000000000001","module_key":"courses","enabled":false,"reason":"native module test"}','a4000000-0000-4000-8000-000000000011')->>'ok','true','module setting saved for named club');
select is((select m->>'enabled'from jsonb_array_elements(api.platform_read('modules','a2000000-0000-4000-8000-000000000001')->'rows')m where m->>'module_key'='courses'),'false','module setting durable');
select is(api.platform_tenant_impact('a2000000-0000-4000-8000-000000000001','suspended')->>'member_access_after','false','pause preview states actual existing membership consequence');
select throws_ok($$select api.platform_command('set_tenant_status','a2000000-0000-4000-8000-000000000001',1,'{"status":"suspended","impact_hash":"forged","reason":"missing actual impact"}','a4000000-0000-4000-8000-000000000012')$$,'40001','IMPACT_CHANGED','lifecycle requires current impact hash');
select is(api.platform_command('set_tenant_status','a2000000-0000-4000-8000-000000000001',1,jsonb_build_object('status','suspended','impact_hash',api.platform_tenant_impact('a2000000-0000-4000-8000-000000000001','suspended')->>'impact_hash','reason','explicit checked pause'),'a4000000-0000-4000-8000-000000000013')->>'ok','true','explicit checked pause persisted');
select is(api.platform_read('tenant','a2000000-0000-4000-8000-000000000001')->'rows'->0->>'status','suspended','platform may inspect paused tenant identity');
select ok(not (api.platform_read('audit')::text ~ 'credential_envelope|password|private_answers'),'audit uses bounded operational metadata');
reset role;
select is((select count(*)::integer from app.persons where tenant_id='a2000000-0000-4000-8000-000000000001'),1,'pause preserves person history');
select is((select count(*)::integer from app.platform_audit_events where action='create_tenant'),1,'identical retries have one audit');
update auth.sessions set not_after=statement_timestamp()-interval '1 second' where id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select api.platform_read('tenants')$$,'42501','FORBIDDEN','revoked native session denied despite platform grants');
select is(api.platform_access()->>'authorized','false','access bootstrap also refuses expired native session');
reset role;
select * from finish();
rollback;
