begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table retired_invitation_entries(signature text, invocation text, function_name text, schema_name text);
insert into retired_invitation_entries values
 ('api.create_household_invitation(uuid,uuid,text,text,text,text,boolean,boolean,uuid)',
  'select * from api.create_household_invitation(null::uuid,null::uuid,null::text,null::text,null::text,null::text,false,false,null::uuid)', 'create_household_invitation','api'),
 ('internal.create_household_invitation(uuid,uuid,text,text,text,text,boolean,boolean,uuid)',
  'select * from internal.create_household_invitation(null::uuid,null::uuid,null::text,null::text,null::text,null::text,false,false,null::uuid)', 'create_household_invitation','internal'),
 ('api.mark_household_invitation_delivery(uuid,uuid,boolean)',
  'select api.mark_household_invitation_delivery(null::uuid,null::uuid,true)', 'mark_household_invitation_delivery','api'),
 ('internal.mark_household_invitation_delivery(uuid,uuid,boolean)',
  'select internal.mark_household_invitation_delivery(null::uuid,null::uuid,true)', 'mark_household_invitation_delivery','internal'),
 ('api.accept_household_invitation(text)',
  'select * from api.accept_household_invitation(null::text)', 'accept_household_invitation','api'),
 ('internal.accept_household_invitation(text)',
  'select * from internal.accept_household_invitation(null::text)', 'accept_household_invitation','internal'),
 ('api.household_invitation_delivery(uuid,uuid)',
  'select api.household_invitation_delivery(null::uuid,null::uuid)', 'household_invitation_delivery','api'),
 ('internal.household_invitation_delivery(uuid,uuid)',
  'select internal.household_invitation_delivery(null::uuid,null::uuid)', 'household_invitation_delivery','internal');
grant select on retired_invitation_entries to authenticated;

select ok(not has_function_privilege(role_name,'internal.create_household_invitation_v2(uuid,uuid,text,text,text,text,boolean,boolean,bigint,uuid)','EXECUTE'),role_name||' cannot call the pre-lock creation kernel')
 from (values('anon'),('authenticated'),('service_role')) as roles(role_name);
select ok(has_function_privilege('cluvo_command_owner','internal.create_household_invitation_v2(uuid,uuid,text,text,text,text,boolean,boolean,bigint,uuid)','EXECUTE'),'guarded owner retains creation kernel delegation');
select ok(not has_function_privilege(role_name, signature,'EXECUTE'), role_name||' has no legacy execution: '||signature)
 from retired_invitation_entries cross join (values('anon'),('authenticated'),('service_role')) as roles(role_name)
 order by signature,role_name;
select ok(has_function_privilege('cluvo_command_owner',signature,'EXECUTE'),'private owner retains kernel delegation: '||signature)
 from retired_invitation_entries where schema_name='internal' order by signature;
select ok(bool_and(has_function_privilege('authenticated',signature,'EXECUTE')),'current authenticated versioned commands/projections remain available')
 from (values
 ('api.create_household_invitation_v2(uuid,uuid,text,text,text,text,boolean,boolean,bigint,uuid)'),
 ('api.mark_household_invitation_delivery_v2(uuid,uuid,bigint,boolean,uuid)'),
 ('api.accept_household_invitation_v2(text,bigint,uuid)'),
 ('api.cancel_household_invitation(uuid,uuid,bigint,uuid)'),
 ('api.household_invitation_delivery_v2(uuid,uuid)'),
 ('api.household_invitation_context(text)'),
 ('api.get_household_dossier_v2(uuid,uuid,uuid)')) as current_entries(signature);

-- SQL unit contexts use explicit disposable native session rows. Browser
-- integration separately obtains real OTP-issued sessions; this is no provider proof.
update auth.users set email_confirmed_at=statement_timestamp() where email_confirmed_at is null;
insert into auth.sessions(id,user_id,created_at,updated_at)
select id,id,statement_timestamp(),statement_timestamp() from auth.users
on conflict(id) do nothing;
create function pg_temp.cluvo_test_claims(p_actor uuid) returns text
language sql security definer set search_path='' as $claims$
select jsonb_build_object('sub',p_actor,'role','authenticated','session_id',p_actor,
 'email',(select email from auth.users where id=p_actor))::text;
$claims$;

set local role authenticated;
select throws_ok($$select * from internal.create_household_invitation_v2(null::uuid,null::uuid,null::text,null::text,null::text,null::text,false,false,null::bigint,null::uuid)$$,
 '42501','permission denied for function create_household_invitation_v2','direct authenticated pre-lock creation kernel denied');
select throws_ok(invocation,'42501','permission denied for function '||function_name,'direct authenticated legacy call denied: '||signature)
 from retired_invitation_entries order by signature;
reset role;
select * from finish();
rollback;
