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

insert into app.platform_access_grants(auth_user_id,display_name,permission_key,ends_at,granted_by_auth_user_id)
values('b1000000-0000-4000-8000-000000000001','Synthetic onboarding operator','platform.tenant.manage',statement_timestamp()+interval '1 year','b1000000-0000-4000-8000-000000000001');
insert into app.permission_roles(id,tenant_id,role_key,name,system_role)values('b4000000-0000-4000-8000-000000000009','b2000000-0000-4000-8000-000000000001','named_invitation_test','Named planning mandate',false);
insert into app.role_permissions(tenant_id,role_id,permission_key)values('b2000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000009','shift.manage');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","email":"admin-native@example.test","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','invite_access','bb000000-0000-4000-8000-000000000001',0,jsonb_build_object('auth_user_id','b1000000-0000-4000-8000-000000000003','role_id','b4000000-0000-4000-8000-000000000009','scope_kind','tenant','scope_id',null,'ends_at',statement_timestamp()+interval '1 day','expires_at',statement_timestamp()+interval '1 hour','reason','offer named planning mandate'),'bb100000-0000-4000-8000-000000000001')->>'ok','true','actual finite named invitation saved');
select is(jsonb_array_length(api.club_admin_read('b2000000-0000-4000-8000-000000000001','access')->'extras'->'invitations'),1,'club sees actual pending invitation');
select throws_ok($$select internal.admin_invitation_reply('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')$$,'42501',null,'private recipient helper has no callable client privilege');
select throws_ok($$select api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','inviter cannot accept for recipient');
reset role;
select is((select count(*)::integer from app.access_grants where auth_user_id='b1000000-0000-4000-8000-000000000003'),0,'pending offer grants no rights');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000002","email":"support-native@example.test","session_id":"b1000000-0000-4000-8000-000000000002"}',true);
select is(jsonb_array_length(api.platform_read('personal_invitations')->'rows'),0,'other verified identity sees no offers');
select throws_ok($$select api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','forged resource URL cannot accept another personal offer');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","email":"limited-native@example.test","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select is(jsonb_array_length(api.platform_read('personal_invitations')->'rows'),1,'named recipient sees minimal offered mandate');
select ok(not api.platform_read('personal_invitations')::text~'email|password|secret|token','personal offer exposes no Auth directory or credentials');
select throws_ok($$select api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',2,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')$$,'40001','STALE_VERSION','stale offer cannot be accepted');
select is(api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')->>'ok','true','named recipient accepts actual offer');
select is(api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')->>'version','2','retry returns original acceptance receipt');
select is(api.platform_command_status('bb100000-0000-4000-8000-000000000004')->>'state','confirmed','same personal command outcome can be recovered without platform grant');
select throws_ok($$select api.platform_command('decline_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')$$,'22000','IDEMPOTENCY_CONFLICT','unknown decision cannot become a second contradictory mutation');
select is(api.club_admin_access('club-admin-native')->>'authorized','true','accepted bounded grant provides actual planning workspace');
select is(jsonb_array_length(api.club_admin_access('club-admin-native')->'permissions'),1,'accepted planning mandate adds no household, finance or organization authority');
select is(api.platform_access()->>'authorized','false','club invite does not give platform access');
reset role;
select is((select count(*)::integer from app.access_grants where auth_user_id='b1000000-0000-4000-8000-000000000003'),1,'double click creates one grant');
select is((select state from app.admin_access_invitations where id='bb000000-0000-4000-8000-000000000001'),'accepted','real accepted status is retained');
select is((select count(*)::integer from app.audit_events where action='accept_admin_invitation'),1,'recipient decision has one immutable audit');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","email":"admin-native@example.test","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.platform_command('create_tenant','bb200000-0000-4000-8000-000000000001',0,'{"slug":"invited-first-club","name":"Invited first club","reason":"native empty onboarding proof"}','bb100000-0000-4000-8000-000000000010')->>'ok','true','initial invitation starts at an actual preparing tenant');
select is(api.platform_command('invite_administrator','bb000000-0000-4000-8000-000000000010',0,jsonb_build_object('tenant_id','bb200000-0000-4000-8000-000000000001','auth_user_id','b1000000-0000-4000-8000-000000000003','given_name','Named','family_name','Administrator','permission_keys',jsonb_build_array('organization.manage','organization.access.manage'),'ends_at',statement_timestamp()+interval '1 day','expires_at',statement_timestamp()+interval '1 hour','explicit_confirmation',true,'reason','named first admin accepts personal offer'),'bb100000-0000-4000-8000-000000000011')->>'ok','true','platform persists actual initial administrator invitation');
select is(jsonb_array_length(api.platform_read('administrators','bb200000-0000-4000-8000-000000000001')->'rows'),1,'platform administrator tab includes pending offer');
reset role;
select is((select count(*)::integer from app.persons where tenant_id='bb200000-0000-4000-8000-000000000001'),0,'initial pending invitation creates no person or membership');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","email":"limited-native@example.test","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select is(api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000010',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000012')->>'ok','true','recipient without former club membership accepts initial offer');
reset role;
select is((select count(*)::integer from app.persons where tenant_id='bb200000-0000-4000-8000-000000000001'),1,'accepted onboarding creates one actual named person');
select is((select count(*)::integer from app.tenant_memberships where tenant_id='bb200000-0000-4000-8000-000000000001'and auth_user_id='b1000000-0000-4000-8000-000000000001'),0,'platform inviter gains no club membership');
select is((select count(*)::integer from app.role_permissions rp join app.access_grants g on g.tenant_id=rp.tenant_id and g.role_id=rp.role_id where rp.tenant_id='bb200000-0000-4000-8000-000000000001'),2,'initial accepted role contains exactly offered permissions');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","email":"admin-native@example.test","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','invite_access','bb000000-0000-4000-8000-000000000020',0,jsonb_build_object('auth_user_id','b1000000-0000-4000-8000-000000000003','role_id','b4000000-0000-4000-8000-000000000009','scope_kind','tenant','scope_id',null,'ends_at',statement_timestamp()+interval '1 day','expires_at',statement_timestamp()+interval '1 hour','reason','cancelled offer proof'),'bb100000-0000-4000-8000-000000000020')->>'ok','true','another offer uses actual new command');
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','cancel_access_invitation','bb000000-0000-4000-8000-000000000020',1,'{"reason":"named offer cancelled by authorized manager"}','bb100000-0000-4000-8000-000000000021')->>'version','2','scoped inviter cancels actual pending offer');
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","email":"limited-native@example.test","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select throws_ok($$select api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000020',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000022')$$,'40001','STALE_VERSION','cancelled invitation cannot be accepted');

select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","email":"admin-native@example.test","session_id":"b1000000-0000-4000-8000-000000000001"}',true);
select is(api.club_admin_command('b2000000-0000-4000-8000-000000000001','invite_access','bb000000-0000-4000-8000-000000000030',0,jsonb_build_object('auth_user_id','b1000000-0000-4000-8000-000000000003','role_id','b4000000-0000-4000-8000-000000000009','scope_kind','tenant','scope_id',null,'ends_at',statement_timestamp()+interval '1 day','expires_at',statement_timestamp()+interval '1 hour','reason','late revoked authority proof'),'bb100000-0000-4000-8000-000000000030')->>'ok','true','current inviter prepares a later offer');
reset role;
update app.access_grants set revoked_at=statement_timestamp(),version=version+1 where auth_user_id='b1000000-0000-4000-8000-000000000001'and tenant_id='b2000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000003","email":"limited-native@example.test","session_id":"b1000000-0000-4000-8000-000000000003"}',true);
select throws_ok($$select api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000030',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000031')$$,'42501','INVITATION_AUTHORITY_ENDED','inviter revocation blocks a formerly valid pending offer');
select is(api.platform_command('decline_admin_invitation','bb000000-0000-4000-8000-000000000030',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000031')->>'ok','true','recipient can decline an offer after inviter revocation');
reset role;
select is((select count(*)::integer from app.access_grants where auth_user_id='b1000000-0000-4000-8000-000000000003'and tenant_id='b2000000-0000-4000-8000-000000000001'),1,'declined or authority-rejected offer adds no second grant');
delete from auth.sessions where user_id='b1000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select api.platform_read('personal_invitations')$$,'42501','FORBIDDEN','removed native session cannot view invitation history');
select throws_ok($$select api.platform_command('accept_admin_invitation','bb000000-0000-4000-8000-000000000001',1,'{"explicit_confirmation":true}','bb100000-0000-4000-8000-000000000004')$$,'42501','FORBIDDEN','old native session cannot recover an acceptance receipt');
select * from finish();rollback;
