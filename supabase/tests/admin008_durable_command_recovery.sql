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

insert into auth.sessions(id,user_id)values('ad080000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001');
insert into app.platform_access_grants(auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)values('b1000000-0000-4000-8000-000000000001','Synthetic onboarding owner','platform.tenant.manage',statement_timestamp()+interval '1 day','b1000000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000002','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Forbidden team","active":true,"reason":"Negatieve clubcontrole"}','ad860000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','preparation cannot use a forged club context');
select is(api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Prepared actual team","active":true,"reason":"Opgeslagen concrete invoer voor hervatten"}','ad860000-0000-4000-8000-000000000001')->>'state','prepared','server persists exact command before mutation');
select is(api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Prepared actual team","active":true,"reason":"Opgeslagen concrete invoer voor hervatten"}','ad860000-0000-4000-8000-000000000001')->>'state','prepared','lost preparation response safely repeats the same ID');
select is(api.admin_pending_commands('club','b2000000-0000-4000-8000-000000000001')->0->'payload'->>'name','Prepared actual team','reload reads the same stored choice');
select is(api.admin_pending_commands('club','b2000000-0000-4000-8000-000000000001')->0->>'key','ad860000-0000-4000-8000-000000000001','reloaded choice preserves the exact command ID');
select throws_ok($$select api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000002',0,'{"name":"Second command","active":true,"reason":"Afgewezen nieuwe opdracht bij onbekende uitkomst"}','ad860000-0000-4000-8000-000000000002')$$,'55000','ADMIN_PENDING_COMMAND','second device cannot create another unresolved command');
select throws_ok($$select api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Changed choice","active":true,"reason":"Opgeslagen concrete invoer voor hervatten"}','ad860000-0000-4000-8000-000000000001')$$,'22000','IDEMPOTENCY_CONFLICT','same ID cannot acquire altered form values');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"ad080000-0000-4000-8000-000000000001"}',true);
select is(jsonb_array_length(api.admin_pending_commands('club','b2000000-0000-4000-8000-000000000001')),1,'second native session of same actor sees durable pending command');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select is(jsonb_array_length(api.admin_pending_commands('club','b2000000-0000-4000-8000-000000000001')),0,'another person never reads pending form values');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Prepared actual team","active":true,"reason":"Opgeslagen concrete invoer voor hervatten"}','ad860000-0000-4000-8000-000000000001')$$,'42501','FORBIDDEN','borrowed command ID grants no mutation authority');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"ad080000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Prepared actual team","active":true,"reason":"Opgeslagen concrete invoer voor hervatten"}','ad860000-0000-4000-8000-000000000001')->>'ok','true','second device resumes exact native mutation');
select is(jsonb_array_length(api.admin_pending_commands('club','b2000000-0000-4000-8000-000000000001')),0,'committed domain result atomically clears pending state');
select is(api.club_admin_command_status('b2000000-0000-4000-8000-000000000001','ad860000-0000-4000-8000-000000000001')->>'state','confirmed','lost final response reconciles canonical receipt');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000001',0,'{"name":"Prepared actual team","active":true,"reason":"Opgeslagen concrete invoer voor hervatten"}','ad860000-0000-4000-8000-000000000001')->>'version','1','late duplicate request returns one actual mutation');
select is(api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000002',0,'{"name":"Cancelled team","active":true,"reason":"Een voorbereide opdracht bewust intrekken"}','ad860000-0000-4000-8000-000000000002')->>'state','prepared','new command allowed after confirmed outcome');
select is(api.admin_cancel_command('club','b2000000-0000-4000-8000-000000000001','ad860000-0000-4000-8000-000000000002')->>'state','cancelled','explicit cancellation is durable');
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000002',0,'{"name":"Cancelled team","active":true,"reason":"Een voorbereide opdracht bewust intrekken"}','ad860000-0000-4000-8000-000000000002')$$,'55000','ADMIN_COMMAND_CANCELLED','delayed original request cannot mutate after cancellation');
select is(api.admin_cancel_command('club','b2000000-0000-4000-8000-000000000001','ad860000-0000-4000-8000-000000000001')->>'state','confirmed','cancelling already completed command preserves its real result');
select throws_ok($$select api.admin_prepare_command('club','b2000000-0000-4000-8000-000000000001','save_team','ad850000-0000-4000-8000-000000000003',0,'{"name":"Unsafe payload","active":true,"reason":"Negatieve opslagcontrole","service_secret":"synthetic-not-a-secret"}','ad860000-0000-4000-8000-000000000003')$$,'22023','INVALID_COMMAND','secret fields cannot enter durable form storage');
select throws_ok($$select * from app.admin_command_intents$$,'42501','permission denied for table admin_command_intents','ordinary authenticated client cannot read raw pending commands');
select is(api.admin_prepare_command('platform',null,'create_tenant','ad820000-0000-4000-8000-000000000001',0,'{"slug":"cancelled-native-onboarding","name":"Cancelled native onboarding","contact_name":"Synthetic operator","contact_email":"operator@example.test","reason":"Voorbereide onboarding bewust intrekken"}','ad860000-0000-4000-8000-000000000004')->>'state','prepared','platform-only command has separate durable scope');
select is(api.admin_cancel_command('platform',null,'ad860000-0000-4000-8000-000000000004')->>'state','cancelled','platform preparation can be cancelled with same ID');
select throws_ok($$select api.platform_command('create_tenant','ad820000-0000-4000-8000-000000000001',0,'{"slug":"cancelled-native-onboarding","name":"Cancelled native onboarding","contact_name":"Synthetic operator","contact_email":"operator@example.test","reason":"Voorbereide onboarding bewust intrekken"}','ad860000-0000-4000-8000-000000000004')$$,'55000','ADMIN_COMMAND_CANCELLED','late platform request cannot bypass durable cancellation');
reset role;
select is((select count(*)::integer from app.teams where id='ad850000-0000-4000-8000-000000000001'),1,'same command creates one team');
select is((select count(*)::integer from app.teams where id='ad850000-0000-4000-8000-000000000002'),0,'cancelled command creates no team');
select is((select count(*)::integer from app.tenants where id='ad820000-0000-4000-8000-000000000001'),0,'cancelled onboarding creates no tenant');
select is((select count(*)::integer from app.audit_events where action='admin.save_team'),1,'double device retry has one domain audit');
select * from finish();
rollback;
