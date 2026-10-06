begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, aud, role, email) values
  ('91111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'help-a@example.test'),
  ('92222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'help-b@example.test');

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app.user_help_seen'::regclass), 'account preferences force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app.help_topics'::regclass), 'help catalog forces RLS');
select is((select count(*)::integer from app.help_topics), 149, 'all reference topics are registered');
select ok(not has_table_privilege('authenticated', 'app.user_help_seen', 'INSERT'), 'no direct preference insert');
select ok(not has_table_privilege('authenticated', 'app.user_help_seen', 'UPDATE'), 'no direct preference update');
select ok(not has_table_privilege('authenticated', 'app.user_help_seen', 'DELETE'), 'no direct preference delete');
select ok(not has_function_privilege('anon', 'api.mark_help_seen(text)', 'EXECUTE'), 'anonymous account cannot dismiss');
select ok(not has_function_privilege('service_role', 'api.mark_help_seen(text)', 'EXECUTE'), 'service key does not replace user action');
select ok(not (select prosecdef from pg_proc where oid = 'api.mark_help_seen(text)'::regprocedure), 'API wrapper is invoker');
select ok((select reloptions @> array['security_invoker=true'] from pg_class where oid = 'api.my_help_seen'::regclass), 'read projection is invoker');

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
set local request.jwt.claim.sub = '';
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('','')::uuid),true);
select throws_ok($$select * from api.mark_help_seen('page.overzicht')$$, '42501', 'FORBIDDEN', 'no verified actor is rejected');
set local request.jwt.claim.sub = '91111111-1111-4111-8111-111111111111';
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('91111111-1111-4111-8111-111111111111','')::uuid),true);
select is((select count(*)::integer from api.my_help_seen), 0, 'new account starts unseen');
select throws_ok($$select * from api.mark_help_seen('constructor')$$, '22023', 'UNKNOWN_HELP_TOPIC', 'unknown topic is rejected');
select throws_ok($$select * from api.mark_help_seen(null)$$, '22023', 'UNKNOWN_HELP_TOPIC', 'null topic is rejected');
select throws_ok($$insert into app.user_help_seen(auth_user_id,topic_id) values ('92222222-2222-4222-8222-222222222222','page.overzicht')$$, '42501', 'permission denied for table user_help_seen', 'cannot write for another account');

select lives_ok($$select * from api.mark_help_seen('page.overzicht')$$, 'dismiss succeeds for own verified account');
create temporary table first_seen as select seen_at from api.my_help_seen where topic_id = 'page.overzicht';
select lives_ok($$select * from api.mark_help_seen('page.overzicht')$$, 'dismiss retry succeeds');
select is((select count(*)::integer from api.my_help_seen), 1, 'same topic retry has one row');
select is((select seen_at from api.my_help_seen where topic_id = 'page.overzicht'), (select seen_at from first_seen), 'retry preserves first server timestamp');
select lives_ok($$select * from api.mark_help_seen('page.intake')$$, 'independent topic can be dismissed');
select is((select count(*)::integer from api.my_help_seen), 2, 'two topics merge without overwriting');

set local request.jwt.claim.sub = '92222222-2222-4222-8222-222222222222';
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('92222222-2222-4222-8222-222222222222','')::uuid),true);
select is((select count(*)::integer from api.my_help_seen), 0, 'other account still sees all topics');
select is((select count(*)::integer from app.user_help_seen), 0, 'direct table read also hides other account');
select lives_ok($$select * from api.mark_help_seen('page.taken')$$, 'other account can store its own preference');
select is((select count(*)::integer from api.my_help_seen), 1, 'other account reads only own preference');
set local request.jwt.claim.sub = '91111111-1111-4111-8111-111111111111';
select set_config('request.jwt.claims',pg_temp.cluvo_test_claims(nullif('91111111-1111-4111-8111-111111111111','')::uuid),true);
select is((select count(*)::integer from api.my_help_seen), 2, 'new session retains first account preferences');
select is((select count(*)::integer from api.my_help_seen where topic_id='page.taken'), 0, 'other account dismissal does not affect first account');
select throws_ok($$delete from app.user_help_seen$$, '42501', 'permission denied for table user_help_seen', 'cannot reset account preferences with a demo reset');
reset role;

select is((select count(*)::integer from app.user_help_seen), 3, 'exactly three independent account/topic effects');
select * from finish();
rollback;
