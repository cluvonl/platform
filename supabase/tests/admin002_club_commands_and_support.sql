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
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_access('club-admin-native')->>'authorized','true','explicit club administrative access');
select is(api.club_admin_access('club-admin-other')->>'authorized','false','other club URL denied');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000002','people')$$,'42501','FORBIDDEN','forged cross-club directory refused');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000002','save_team','b5000000-0000-4000-8000-000000000001',0,'{"name":"Illegal","active":true,"reason":"negative tenant test"}','b6000000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','forged cross-club mutation refused');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','b5000000-0000-4000-8000-000000000001',0,'{"name":"Native team","active":true,"reason":"synthetic organization proof"}','b6000000-0000-4000-8000-000000000001')->>'ok','true','real team creation');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','b5000000-0000-4000-8000-000000000001',0,'{"name":"Native team","active":true,"reason":"synthetic organization proof"}','b6000000-0000-4000-8000-000000000001')->>'version','1','duplicate returns one durable receipt');
select is(api.club_admin_read('b2000000-0000-4000-8000-000000000001','teams')->'rows'->0->>'name','Native team','new read observes persisted team');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','b5000000-0000-4000-8000-000000000001',0,'{"name":"Changed","active":true,"reason":"synthetic organization proof"}','b6000000-0000-4000-8000-000000000001')$$,'22000','IDEMPOTENCY_CONFLICT','payload conflict on same command ID');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','b5000000-0000-4000-8000-000000000001',3,'{"name":"Changed","active":true,"reason":"stale update test"}','b6000000-0000-4000-8000-000000000002')$$,'40001','STALE_VERSION','stale team edit refused');
select is(api.club_admin_command_status('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001')->>'state','confirmed','same command status available');
select is(api.club_admin_command_status('b2000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000099')->>'state','unknown','unknown response remains unknown');
select lives_ok(format('select api.club_admin_read(%L,%L)','b2000000-0000-4000-8000-000000000001',section),'native readmodel '||section) from unnest(array['cockpit','organization','locations','people','households','access','committees','teams','catalogue','planning','execution','requests','policies','courses','communication','templates','reports','finance','seasons','support','audit'])section;
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','grant_access','b5000000-0000-4000-8000-000000000002',0,'{"auth_user_id":"b1000000-0000-4000-8000-000000000001","role_id":"b4000000-0000-4000-8000-000000000001","scope_kind":"tenant","ends_at":"2026-11-09T12:00:00Z","reason":"negative self grant"}','b6000000-0000-4000-8000-000000000003')$$,'42501','SELF_GRANT_REFUSED','administrator cannot grant own higher rights');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','add_team_member','b5000000-0000-4000-8000-000000000003',0,'{"team_id":"b5000000-0000-4000-8000-000000000001","person_id":"b3000000-0000-4000-8000-000000000003","membership_kind":"team_parent","reason":"bypass handover test"}','b6000000-0000-4000-8000-000000000004')$$,'42501','TEAM_PARENT_REQUIRES_HANDOVER','CRUD cannot bypass named-successor handover');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(api.club_admin_access('club-admin-native')->>'authorized','false','platform support has no automatic club authority');
select is(api.platform_command('request_support','b7000000-0000-4000-8000-000000000001',0,jsonb_build_object('tenant_id','b2000000-0000-4000-8000-000000000001','permission_keys',jsonb_build_array('shift.manage'),'scope_kind','tenant','ends_at',statement_timestamp()+interval '1 hour','purpose','Inspect synthetic planning with consent','reason','synthetic support request'),'b6000000-0000-4000-8000-000000000005')->>'ok','true','named expiring support request');
select is(api.club_admin_access('club-admin-native')->>'authorized','false','requested support is not approved access');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','consent_support','b7000000-0000-4000-8000-000000000001',1,'{"approved":true,"reason":"club consent for one bounded purpose"}','b6000000-0000-4000-8000-000000000006')->>'ok','true','authorized club consents to exact temporary scope');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(api.club_admin_access('club-admin-native')->>'authorized','true','approved support grants bounded administrative access without impersonation');
select is(jsonb_array_length(api.club_admin_access('club-admin-native')->'support'),1,'support purpose and expiry visible in current context');
select lives_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','planning')$$,'support sees only permitted planning projection');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','people')$$,'42501','FORBIDDEN','support planning cannot inspect person directory');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','reports')$$,'42501','FORBIDDEN','support cannot inspect household finance and progress');
select is((select count(*)::integer from api.my_workspaces),0,'support did not invent a member/person identity');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','end_support','b7000000-0000-4000-8000-000000000001',2,'{"reason":"bounded support completed"}','b6000000-0000-4000-8000-000000000007')->>'ok','true','club ends exact support grant');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(api.club_admin_access('club-admin-native')->>'authorized','false','revocation immediately removes support context');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','planning')$$,'42501','FORBIDDEN','old session cannot use revoked support projection');
reset role;
select is((select count(*)::integer from app.audit_events where tenant_id='b2000000-0000-4000-8000-000000000001' and action='admin.save_team'),1,'one audit despite repeated click');
select is((select count(*)::integer from app.domain_events where tenant_id='b2000000-0000-4000-8000-000000000001' and event_type='admin.save_team'),1,'one canonical event despite repeated click');
select * from finish();
rollback;
