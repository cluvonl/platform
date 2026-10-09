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

insert into app.platform_access_grants(auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)select 'b1000000-0000-4000-8000-000000000001','Named synthetic platform access manager',k,statement_timestamp()+interval '1 day','b1000000-0000-4000-8000-000000000001'from unnest(array['platform.access.manage','platform.audit.read','platform.tenant.read'])k;
update app.access_grants set ends_at=statement_timestamp()+interval '30 minutes'where tenant_id='b2000000-0000-4000-8000-000000000001'and auth_user_id='b1000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select throws_ok($$select api.platform_command('request_support','af700000-0000-4000-8000-000000000001',0,jsonb_build_object('tenant_id','b2000000-0000-4000-8000-000000000001','permission_keys',jsonb_build_array('shift.manage'),'scope_kind','tenant','ends_at',statement_timestamp()+interval '25 hours','purpose','Afgewezen langere looptijd dan eigen recht','reason','Negatieve looptijdcontrole'),'af600000-0000-4000-8000-000000000001')$$,'42501','CANNOT_EXTEND_DELEGATION','support request cannot outlast its own platform mandate');
select is(api.platform_command('request_support','af700000-0000-4000-8000-000000000001',0,jsonb_build_object('tenant_id','b2000000-0000-4000-8000-000000000001','permission_keys',jsonb_build_array('shift.manage'),'scope_kind','tenant','ends_at',statement_timestamp()+interval '1 hour','purpose','Benoemde beperkte planningcontrole met toestemming','reason','Geldige tijdgebonden aanvraag'),'af600000-0000-4000-8000-000000000002')->>'ok','true','bounded named platform support request');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select throws_ok($$select api.club_admin_command('b2000000-0000-4000-8000-000000000001','consent_support','af700000-0000-4000-8000-000000000001',1,'{"approved":true,"reason":"Afgewezen verlengen van eigen clubmandaat"}','af600000-0000-4000-8000-000000000003')$$,'42501','CANNOT_EXTEND_DELEGATION','club consent cannot delegate a longer expiry than the granting actor');
reset role;
update app.access_grants set ends_at=statement_timestamp()+interval '2 hours'where tenant_id='b2000000-0000-4000-8000-000000000001'and auth_user_id='b1000000-0000-4000-8000-000000000001';
select set_config('cluvo.admin.support_staff_grant',(select id::text from app.platform_access_grants where auth_user_id='b1000000-0000-4000-8000-000000000002'),true);
set local role authenticated;
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','consent_support','af700000-0000-4000-8000-000000000001',1,'{"approved":true,"reason":"Club benoemt de medewerker binnen actuele looptijd"}','af600000-0000-4000-8000-000000000004')->>'ok','true','actual current club mandate may consent');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(api.club_admin_access('club-admin-native')->>'authorized','true','consented named support is active');
select throws_ok($$select api.club_admin_read('b2000000-0000-4000-8000-000000000001','finance')$$,'42501','FORBIDDEN','named planning support has no financial dossier access');
reset role;
select set_config('cluvo.admin.support_club_grant',(select access_grant_id::text from app.platform_support_requests where id='af700000-0000-4000-8000-000000000001'),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','revoke_access',current_setting('cluvo.admin.support_club_grant')::uuid,1,'{"reason":"Club withdraws the exact temporary grant"}','af600000-0000-4000-8000-000000000008')->>'ok','true','ordinary scoped grant revocation closes linked named support');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(api.club_admin_access('club-admin-native')->>'authorized','false','current native support session immediately loses club entry');
select is(api.platform_access()->>'authorized','true','separate platform support mandate remains active');
reset role;
select is((select state from app.platform_support_requests where id='af700000-0000-4000-8000-000000000001'),'revoked','linked support status remains coherent with the ended grant');
select ok((select ends_at<=statement_timestamp()from app.tenant_memberships where id=(select support_membership_id from app.platform_support_requests where id='af700000-0000-4000-8000-000000000001')),'only the owned temporary membership ends');
select is((select count(*)::integer from app.audit_events where action='admin.support_ended_with_grant'and resource_id='af700000-0000-4000-8000-000000000001'),1,'linked revocation receives one named audit event');
select *from finish();rollback;
