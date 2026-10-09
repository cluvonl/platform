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

insert into app.permission_roles(id,tenant_id,role_key,name,system_role)values('af400000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','fund_only_native','Only fund operations',false);
insert into app.role_permissions(tenant_id,role_id,permission_key)values('b2000000-0000-4000-8000-000000000001','af400000-0000-4000-8000-000000000001','finance.fund.manage');
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','af400000-0000-4000-8000-000000000001','tenant','b1000000-0000-4000-8000-000000000001');
insert into app.platform_module_settings(tenant_id,module_key,enabled,changed_by_auth_user_id)values('b2000000-0000-4000-8000-000000000001','teams',false,'b1000000-0000-4000-8000-000000000001');
select set_config('cluvo.admin.sole_grant',(select id::text from app.access_grants where auth_user_id='b1000000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_access('club-admin-native')->'modules'->>'teams','false','native context exposes actual module availability');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','af500000-0000-4000-8000-000000000001',0,'{"name":"Disabled new team","active":true,"reason":"module authority negative proof"}','af600000-0000-4000-8000-000000000001')$$,'55000','MODULE_UNAVAILABLE','disabled module blocks new work server-side');
select lives_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','teams')$$,'module pause retains authorized history');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','planning',null,null,'','',100,0,'{"queue":"invented"}')$$,'22023','INVALID_FILTER','unknown cockpit filter is rejected');
select lives_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','qualifications')$$,'qualification subtab is a native read contract');
select lives_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','fund')$$,'fund subtab is a native read contract');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_qualification_type','af500000-0000-4000-8000-000000000002',0,'{"name":"Native certificate type","active":true,"reason":"verified qualification lifecycle"}','af600000-0000-4000-8000-000000000002')->>'ok','true','qualification type persists');
select set_config('cluvo.admin.certificate_input',jsonb_build_object('person_id','b3000000-0000-4000-8000-000000000003','qualification_type_id','af500000-0000-4000-8000-000000000002','achieved_at',statement_timestamp()-interval '1 day','expires_at',statement_timestamp()+interval '1 year','explicit_confirmation',true,'reason','Actual reviewed synthetic certificate')::text,true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','register_qualification','af500000-0000-4000-8000-000000000003',0,current_setting('cluvo.admin.certificate_input')::jsonb,'af600000-0000-4000-8000-000000000003')->>'version','1','reviewed certificate has actual native version');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','register_qualification','af500000-0000-4000-8000-000000000003',0,current_setting('cluvo.admin.certificate_input')::jsonb,'af600000-0000-4000-8000-000000000003')->>'version','1','double certificate command retains one result');
select is(api.club_admin_read('b2000000-0000-4000-8000-000000000001','qualifications')->'rows'->0->>'name','Limited Coordinator','qualification registry uses reduced person names');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000002','qualifications',null,'af500000-0000-4000-8000-000000000003')$$,'42501','FORBIDDEN','forged certificate tenant is refused');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','revoke_qualification','af500000-0000-4000-8000-000000000003',1,'{"explicit_confirmation":true,"reason":"Reviewed expiry and existing agreements"}','af600000-0000-4000-8000-000000000004')->>'version','2','revocation appends a native lifecycle decision');
select is(api.club_admin_read('b2000000-0000-4000-8000-000000000001','qualifications')->'rows'->0->>'version','2','fresh native read observes revoked certificate version');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','revoke_qualification','af500000-0000-4000-8000-000000000003',1,'{"explicit_confirmation":true,"reason":"Stale certificate command"}','af600000-0000-4000-8000-000000000005')$$,'40001','STALE_VERSION','stale revocation cannot repeat lifecycle decision');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','revoke_access',current_setting('cluvo.admin.sole_grant')::uuid,1,'{"reason":"Prevent loss of final access administrator"}','af600000-0000-4000-8000-000000000006')$$,'55000','LAST_ACCESS_MANAGER','final access manager cannot be silently removed');
select ok(jsonb_array_length(api.club_admin_read('b2000000-0000-4000-8000-000000000001','access')->'extras'->'people')>0,'access manager gets reduced verified account choices');
select ok(not(api.club_admin_read('b2000000-0000-4000-8000-000000000001','access')->'extras'->'people'->0?'birth_date'),'access account choices exclude private birth dates');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select lives_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','fund')$$,'fund-only employee can open own operational screen');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','finance')$$,'42501','FORBIDDEN','fund-only authority cannot inspect household assessments');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','qualifications')$$,'42501','FORBIDDEN','fund-only authority cannot inspect certificate registry');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','register_qualification','af500000-0000-4000-8000-000000000004',0,current_setting('cluvo.admin.certificate_input')::jsonb,'af600000-0000-4000-8000-000000000007')$$,'42501','FORBIDDEN','forged certificate command refuses unrelated role');
reset role;
select is((select count(*)::integer from app.person_qualifications where id='af500000-0000-4000-8000-000000000003'),1,'one certificate after same-ID retry');
select is((select count(*)::integer from app.qualification_events where qualification_id='af500000-0000-4000-8000-000000000003'),2,'verification and revocation remain separate immutable history');
select is((select count(*)::integer from app.hour_ledger_entries where tenant_id='b2000000-0000-4000-8000-000000000001'),0,'certificate decisions do not invent household minutes');
select * from finish();
rollback;
