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

insert into app.committees(id,tenant_id,slug,name)values('ad140000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','own-committee','Own committee'),('ad140000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','other-committee','Other committee');
insert into app.permission_roles(id,tenant_id,role_key,name,system_role)values('ad140000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000001','committee_native_only','Own committee workspace only',false);
insert into app.role_permissions(tenant_id,role_id,permission_key)values('b2000000-0000-4000-8000-000000000001','ad140000-0000-4000-8000-000000000003','committee.workspace.manage');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,committee_id,granted_by_auth_user_id)values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','ad140000-0000-4000-8000-000000000003','committee','ad140000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select is(jsonb_array_length(api.club_admin_read('b2000000-0000-4000-8000-000000000001','committees')->'rows'),1,'coordinator sees only explicitly managed committee');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','committees',null,'ad140000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','forged other committee detail refused');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_committee_contact','ad140000-0000-4000-8000-000000000001',1,'{"contact_name":"Native contact","contact_email":"contact@example.test","contact_phone":"","reason":"Synthetic committee contact proof"}','ad146000-0000-4000-8000-000000000001')->>'version','2','own native contact update persists');
select is(api.club_admin_read('b2000000-0000-4000-8000-000000000001','committees')->'rows'->0->>'contact_name','Native contact','fresh context sees stored contact');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_committee_contact','ad140000-0000-4000-8000-000000000002',1,'{"contact_name":"Forged","contact_email":"","contact_phone":"","reason":"Synthetic scope refusal"}','ad146000-0000-4000-8000-000000000002')$$,'42501','FORBIDDEN','same-tenant unrelated committee mutation refused');
select ok(not(api.club_admin_read('b2000000-0000-4000-8000-000000000001','committees')->'extras'->'people'->0?'birth_date'),'purpose-bound person choice excludes private birth date');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','add_committee_member','ad140000-0000-4000-8000-000000000004',0,'{"committee_id":"ad140000-0000-4000-8000-000000000001","person_id":"b3000000-0000-4000-8000-000000000003","duty":"Material coordinator","reason":"Synthetic service appointment only"}','ad146000-0000-4000-8000-000000000003')->>'version','1','committee service membership persists');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','add_committee_member','ad140000-0000-4000-8000-000000000004',0,'{"committee_id":"ad140000-0000-4000-8000-000000000001","person_id":"b3000000-0000-4000-8000-000000000003","duty":"Material coordinator","reason":"Synthetic service appointment only"}','ad146000-0000-4000-8000-000000000003')->>'version','1','retry returns same membership receipt');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','add_committee_member','ad140000-0000-4000-8000-000000000005',0,'{"committee_id":"ad140000-0000-4000-8000-000000000001","person_id":"b3000000-0000-4000-8000-000000000003","duty":"Duplicate","reason":"Synthetic duplicate membership proof"}','ad146000-0000-4000-8000-000000000004')$$,'55000','MEMBERSHIP_EXISTS','different command cannot duplicate active membership');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','add_committee_member','ad140000-0000-4000-8000-000000000006',0,'{"committee_id":"ad140000-0000-4000-8000-000000000001","person_id":"b1000000-0000-4000-8000-000000000001","duty":"Forged person","reason":"Cross-tenant person proof"}','ad146000-0000-4000-8000-000000000005')$$,'42501','FORBIDDEN','unavailable person is refused');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','end_committee_member','ad140000-0000-4000-8000-000000000004',1,'{"reason":"Synthetic service period completed"}','ad146000-0000-4000-8000-000000000006')->>'version','2','ending membership retains native history');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','end_committee_member','ad140000-0000-4000-8000-000000000004',1,'{"reason":"Synthetic stale end proof"}','ad146000-0000-4000-8000-000000000007')$$,'40001','STALE_VERSION','stale membership end refused');
select is(jsonb_array_length(api.club_admin_read('b2000000-0000-4000-8000-000000000001','committees')->'rows'->0->'members'),1,'ended service membership stays visible in history');
select throws_ok($$select * from app.committee_person_memberships$$,'42501','permission denied for table committee_person_memberships','raw membership table unavailable');
reset role;
select is((select count(*)::integer from app.access_grants where auth_user_id='b1000000-0000-4000-8000-000000000003'),1,'service appointment did not create account authority');
select is((select count(*)::integer from app.hour_ledger_entries where tenant_id='b2000000-0000-4000-8000-000000000001'),0,'service membership did not create worked minutes');
select is((select count(*)::integer from app.audit_events where tenant_id='b2000000-0000-4000-8000-000000000001'and action='admin.add_committee_member'),1,'same-ID retry yields one audit');
select * from finish();rollback;
