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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a1000000-0000-4000-8000-000000000001"}',true);

select is(api.platform_command('create_tenant','c2000000-0000-4000-8000-000000000001',0,'{"slug":"platform-native-new","name":"Native onboarding club","contact_name":"Synthetic operator","contact_email":"operator@example.test","reason":"complete synthetic onboarding"}','c6000000-0000-4000-8000-000000000001')->>'ok','true','new native tenant stays separate');
select throws_ok($$select api.platform_command('set_tenant_status','c2000000-0000-4000-8000-000000000001',1,jsonb_build_object('status','active','impact_hash',api.platform_tenant_impact('c2000000-0000-4000-8000-000000000001','active')->>'impact_hash','reason','negative premature activation'),'c6000000-0000-4000-8000-000000000002')$$,'55000','ONBOARDING_INCOMPLETE','activation cannot skip named administrator and season');
select is(api.club_admin_access('platform-native-new')->>'authorized','false','platform creator has no implicit club administration');
select is(api.platform_command('onboard_administrator','c4000000-0000-4000-8000-000000000001',0,jsonb_build_object('tenant_id','c2000000-0000-4000-8000-000000000001','auth_user_id','a1000000-0000-4000-8000-000000000001','given_name','Synthetic','family_name','Administrator','permission_keys',jsonb_build_array('organization.manage','organization.access.manage'),'ends_at','2026-11-08T12:00:00Z'::timestamptz,'explicit_confirmation',true,'reason','explicit first two permissions only'),'c6000000-0000-4000-8000-000000000003')->>'ok','true','explicit bounded first-administrator command');
select is(api.platform_command('onboard_administrator','c4000000-0000-4000-8000-000000000001',0,jsonb_build_object('tenant_id','c2000000-0000-4000-8000-000000000001','auth_user_id','a1000000-0000-4000-8000-000000000001','given_name','Synthetic','family_name','Administrator','permission_keys',jsonb_build_array('organization.manage','organization.access.manage'),'ends_at','2026-11-08T12:00:00Z'::timestamptz,'explicit_confirmation',true,'reason','explicit first two permissions only'),'c6000000-0000-4000-8000-000000000003')->>'ok','true','same exact first-administrator retry is deduplicated');
select is(api.club_admin_access('platform-native-new')->>'authorized','false','preparation does not activate personal access');
select is(jsonb_array_length(api.platform_read('administrators','c2000000-0000-4000-8000-000000000001')->'rows'),1,'one operational administrator record without private dossier');
select throws_ok($$select api.platform_command('onboard_administrator','c4000000-0000-4000-8000-000000000002',0,jsonb_build_object('tenant_id','c2000000-0000-4000-8000-000000000001','auth_user_id','a1000000-0000-4000-8000-000000000001','given_name','Synthetic','family_name','Administrator','permission_keys',jsonb_build_array('organization.manage','organization.access.manage','finance.assessment.view'),'ends_at','2026-11-08T12:00:00Z'::timestamptz,'explicit_confirmation',true,'reason','negative later privilege escalation'),'c6000000-0000-4000-8000-000000000004')$$,'55000','INITIAL_ONBOARDING_ONLY','first-owner command cannot add later rights in existing club');
select is(api.platform_command('onboard_season','c5000000-0000-4000-8000-000000000001',0,'{"tenant_id":"c2000000-0000-4000-8000-000000000001","name":"Native onboarding season","starts_on":"2026-07-01","ends_on":"2027-06-30","winter_cutoff_at":"2026-12-31T23:00:00Z","target_minutes":720,"winter_target_minutes":360,"reason":"explicit first season configuration"}','c6000000-0000-4000-8000-000000000005')->>'ok','true','first season created while tenant is still preparing');
select is(api.platform_command('set_tenant_status','c2000000-0000-4000-8000-000000000001',1,jsonb_build_object('status','active','impact_hash',api.platform_tenant_impact('c2000000-0000-4000-8000-000000000001','active')->>'impact_hash','reason','explicit checked initial activation'),'c6000000-0000-4000-8000-000000000006')->>'ok','true','actual complete onboarding activates tenant');
select is(api.club_admin_access('platform-native-new')->>'authorized','true','named first owner gains only explicitly accepted club mandate');
select is(jsonb_array_length(api.club_admin_access('platform-native-new')->'permissions'),2,'no automatic finance, intake or planning permissions');
select throws_ok($$select api.club_admin_read('c2000000-0000-4000-8000-000000000001','reports')$$,'42501','FORBIDDEN','first identity mandate does not imply private household reporting');
select throws_ok($$select api.club_admin_read('c2000000-0000-4000-8000-000000000001','finance')$$,'42501','FORBIDDEN','first identity mandate does not imply finance authority');
select is((select count(*)::integer from api.my_workspaces where tenant_slug='platform-native-new'),1,'real member identity and selected club mandate available after activation');
select is((select count(*)::integer from api.mark_help_seen('admin.platform.tenants.v1')),1,'platform explanation dismissal persists for current actor and version');
select is((select count(*)::integer from api.mark_help_seen('admin.platform.tenants.v1')),1,'both dismissal controls share idempotent explanation preference');
select is((select count(*)::integer from api.my_help_seen where topic_id='admin.platform.tenants.v1'),1,'fresh second-device preference projection sees saved dismissal');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","session_id":"a1000000-0000-4000-8000-000000000002"}',true);
select is((select count(*)::integer from api.my_help_seen where topic_id='admin.platform.tenants.v1'),0,'another actor never inherits dismissal');
reset role;
select is((select count(*)::integer from app.persons where tenant_id='c2000000-0000-4000-8000-000000000001'),1,'retry did not create a second person');
select is((select count(*)::integer from app.platform_audit_events where action='onboard_administrator'),1,'one audited first-administrator decision');
select ok((select count(*)=5 and bool_and(position('club_admin_authority_fence' in prosrc)>0) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='internal' and p.proname in ('book_shift','pwa_command','confirm_attendance','correct_attendance_award','publish_shift_batch')) and (select count(*)=5 and bool_and(not p.prosecdef and p.prolang=(select oid from pg_language where lanname='sql'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname in ('book_shift','pwa_command','confirm_attendance','correct_attendance_award','publish_shift_batch')),'legacy handlers acquire authority fence while public SQL invoker bindings remain intact');
select * from finish();
rollback;
