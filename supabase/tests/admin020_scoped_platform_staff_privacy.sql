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

insert into app.platform_access_grants(auth_user_id,display_name,permission_key,tenant_scope_id,ends_at,granted_by_auth_user_id)
select 'a1000000-0000-4000-8000-000000000003','Named one-club operational staff',k,'a2000000-0000-4000-8000-000000000001',statement_timestamp()+interval '1 day','a1000000-0000-4000-8000-000000000001'
from unnest(array['platform.access.manage','platform.config.manage','platform.tenant.read'])k;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","email":"platform-support@example.test","session_id":"a1000000-0000-4000-8000-000000000003"}',true);
select is(api.platform_access()->>'authorized','true','named one-club staff has actual separate platform context');
select is(jsonb_array_length(api.platform_read('tenants')->'rows'),1,'one-club staff receives exactly its operational tenant');
select is(api.platform_read('tenants')->'rows'->0->>'id','a2000000-0000-4000-8000-000000000001','positive own-tenant control is native');
select throws_ok($$select api.platform_read('tenant','a2000000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','foreign tenant detail is refused before projection');
select throws_ok($$select api.platform_read('staff')$$,'42501','FORBIDDEN','tenant-scoped staff authority cannot read the global employee directory');
select throws_ok($$select api.platform_read('defaults')$$,'42501','FORBIDDEN','tenant-scoped config authority cannot read global configuration');
select throws_ok($$select api.platform_account_choice('new-verified@example.test','staff')$$,'42501','FORBIDDEN','tenant staff grant does not open a global identity lookup');
select throws_ok($$select api.platform_command('grant_staff','d5000000-0000-4000-8000-000000000001',0,jsonb_build_object('auth_user_id','a1000000-0000-4000-8000-000000000011','display_name','Forged global employee','permission_key','platform.tenant.read','ends_at',statement_timestamp()+interval '1 hour','reason','negative global escalation'),'d6000000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','one-club staff cannot grant global employee rights');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","email":"platform-owner@example.test","session_id":"a1000000-0000-4000-8000-000000000001"}',true);
select lives_ok($$select api.platform_read('staff')$$,'explicit global staff administrator retains its authorized projection');
select lives_ok($$select api.platform_read('defaults')$$,'explicit global configuration administrator retains its authorized projection');
select * from finish();rollback;
