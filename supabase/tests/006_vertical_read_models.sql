begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  has_function_privilege('authenticated', 'api.list_shift_market(uuid)', 'EXECUTE'),
  'authenticated actors can call the reduced shift market'
);
select ok(
  not has_function_privilege('anon', 'api.list_shift_market(uuid)', 'EXECUTE'),
  'anonymous actors cannot call the shift market'
);
select ok(
  has_function_privilege('authenticated', 'api.list_attendance_queue(uuid)', 'EXECUTE'),
  'authenticated actors can call the permission-filtered attendance queue'
);
select ok(
  not has_function_privilege('anon', 'api.list_attendance_queue(uuid)', 'EXECUTE'),
  'anonymous actors cannot call the attendance queue'
);
select ok(
  has_function_privilege('authenticated', 'api.list_bookable_obligations(uuid,uuid)', 'EXECUTE'),
  'authenticated actors can request only their explicitly bookable obligations'
);
select ok(
  not has_function_privilege('anon', 'api.list_bookable_obligations(uuid,uuid)', 'EXECUTE'),
  'anonymous actors cannot request bookable obligations'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.proname in ('list_shift_market', 'list_bookable_obligations', 'list_attendance_queue')
      and procedure.prosecdef
  ),
  0,
  'exposed api wrappers remain security invoker'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'internal'
      and procedure.proname in ('list_shift_market', 'list_bookable_obligations', 'list_attendance_queue')
      and procedure.prosecdef
  ),
  3,
  'only the internal, explicitly filtered read implementations elevate privileges'
);

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
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('','')::uuid),true);
select throws_ok(
  $$select * from api.list_shift_market('00000000-0000-4000-8000-000000000001')$$,
  '42501',
  'FORBIDDEN',
  'missing actor context cannot enumerate shifts'
);
select throws_ok(
  $$select * from api.list_attendance_queue('00000000-0000-4000-8000-000000000001')$$,
  '42501',
  'FORBIDDEN',
  'missing actor context cannot enumerate attendance data'
);
select throws_ok(
  $$select * from api.list_bookable_obligations(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'FORBIDDEN',
  'missing actor context cannot enumerate executor grants or obligation labels'
);

reset role;
select * from finish();
rollback;
