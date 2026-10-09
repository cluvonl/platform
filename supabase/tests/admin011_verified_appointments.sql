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
insert into auth.users(id,email,email_confirmed_at,banned_until)values
 ('a1000000-0000-4000-8000-000000000011','new-verified@example.test',statement_timestamp(),null),
 ('a1000000-0000-4000-8000-000000000012','unverified@example.test',null,null),
 ('a1000000-0000-4000-8000-000000000013','banned@example.test',statement_timestamp(),statement_timestamp()+interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","session_id":"a1000000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select api.platform_account_choice('new-verified@example.test','staff')$$,'42501','FORBIDDEN','club board cannot look up platform candidates');
select throws_ok($$select internal.admin_verified_platform_account('a1000000-0000-4000-8000-000000000011')$$,'42501',null,'private verification helper is not an Auth directory API');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","session_id":"a1000000-0000-4000-8000-000000000001"}',true);
select is(api.platform_account_choice(' NEW-VERIFIED@example.test ','staff')->>'auth_user_id','a1000000-0000-4000-8000-000000000011','exact normalized verified identity selected without a club link');
select ok(not api.platform_account_choice('new-verified@example.test','staff')::text~'email|raw_user_meta|password|token','candidate projection contains no email, Auth metadata or credentials');
select is(api.platform_account_choice('unverified@example.test','staff')->>'found','false','unverified identity is not selectable');
select is(api.platform_account_choice('banned@example.test','staff')->>'found','false','banned identity is not selectable');
select is(api.platform_account_choice('absent@example.test','staff')->>'found','false','unknown identity receives the same bounded unavailable result');
select throws_ok($$select api.platform_account_choice('%@example.test','directory')$$,'22023','INVALID_PURPOSE','there is no account listing mode');
select throws_ok($$select api.platform_account_choice('new-verified@example.test','initial_administrator','a2000000-0000-4000-8000-000000000001')$$,'55000','INITIAL_ONBOARDING_ONLY','initial appointment lookup cannot inspect identities for an existing club');
select is(api.platform_command('grant_staff','d5000000-0000-4000-8000-000000000001',0,jsonb_build_object('auth_user_id','a1000000-0000-4000-8000-000000000011','display_name','New verified employee','permission_key','platform.tenant.read','tenant_scope_id','a2000000-0000-4000-8000-000000000001','ends_at',statement_timestamp()+interval '1 hour','reason','verified targeted staff appointment'),'d6000000-0000-4000-8000-000000000001')->>'ok','true','new verified account can receive a bounded explicit platform grant');
select throws_ok($$select api.platform_command('grant_staff','d5000000-0000-4000-8000-000000000002',0,jsonb_build_object('auth_user_id','a1000000-0000-4000-8000-000000000012','display_name','Unverified employee','permission_key','platform.tenant.read','ends_at',statement_timestamp()+interval '1 hour','reason','negative unverified appointment'),'d6000000-0000-4000-8000-000000000002')$$,'42501','UNKNOWN_ACCOUNT','forged account UUID cannot bypass verification');
select is(api.platform_command('create_tenant','d2000000-0000-4000-8000-000000000001',0,'{"slug":"verified-new-club","name":"Verified new club","reason":"targeted initial onboarding"}','d6000000-0000-4000-8000-000000000003')->>'ok','true','new club remains preparing for explicit onboarding');
select is(api.platform_account_choice('new-verified@example.test','initial_administrator','d2000000-0000-4000-8000-000000000001')->>'found','true','empty preparing club can select its named first administrator');
select is(api.platform_command('onboard_administrator','d4000000-0000-4000-8000-000000000001',0,jsonb_build_object('tenant_id','d2000000-0000-4000-8000-000000000001','auth_user_id','a1000000-0000-4000-8000-000000000011','given_name','New','family_name','Administrator','permission_keys',jsonb_build_array('organization.manage','organization.access.manage'),'ends_at',statement_timestamp()+interval '1 hour','explicit_confirmation',true,'reason','first administrator is a different verified person'),'d6000000-0000-4000-8000-000000000004')->>'ok','true','operator explicitly appoints a different verified first administrator');
select throws_ok($$select api.platform_account_choice('new-verified@example.test','initial_administrator','d2000000-0000-4000-8000-000000000001')$$,'55000','INITIAL_ONBOARDING_ONLY','lookup closes after first appointment');
reset role;
select is((select count(*)::integer from app.account_person_links where tenant_id='d2000000-0000-4000-8000-000000000001'and auth_user_id='a1000000-0000-4000-8000-000000000011'),1,'native separate person-account link persisted');
select is((select count(*)::integer from app.tenant_memberships where tenant_id='d2000000-0000-4000-8000-000000000001'and auth_user_id='a1000000-0000-4000-8000-000000000001'),0,'platform operator gains no implicit club membership');
select ok(not has_table_privilege('cluvo_command_owner','auth.users','SELECT'),'restricted command owner still cannot read the Auth directory');
select * from finish();
rollback;
