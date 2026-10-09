begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

-- Disposable local test transaction only. Envelopes below are structural
-- ciphertext fixtures, not a ClientID, provider credential or successful probe.
insert into auth.users(id, aud, role, email, email_confirmed_at, created_at, updated_at) values
 ('35110000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'sportlink-manager@example.test', statement_timestamp(), statement_timestamp(), statement_timestamp()),
 ('35110000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'sportlink-member@example.test', statement_timestamp(), statement_timestamp(), statement_timestamp()),
 ('35110000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sportlink-foreign@example.test', statement_timestamp(), statement_timestamp(), statement_timestamp());
insert into auth.sessions(id, user_id, created_at, updated_at)
 select id, id, statement_timestamp(), statement_timestamp() from auth.users where id::text like '35110000-%';
insert into app.tenants(id, slug, name, status) values
 ('35100000-0000-4000-8000-000000000001', 'sportlink-owned-a', 'Synthetic club A', 'active'),
 ('35100000-0000-4000-8000-000000000002', 'sportlink-owned-b', 'Synthetic club B', 'active');
insert into app.tenant_memberships(tenant_id, auth_user_id, status) values
 ('35100000-0000-4000-8000-000000000001', '35110000-0000-4000-8000-000000000001', 'active'),
 ('35100000-0000-4000-8000-000000000001', '35110000-0000-4000-8000-000000000002', 'active'),
 ('35100000-0000-4000-8000-000000000002', '35110000-0000-4000-8000-000000000003', 'active');
insert into app.access_grants(id, tenant_id, auth_user_id, role_id, scope_kind, granted_by_auth_user_id)
 select '35150000-0000-4000-8000-000000000001', '35100000-0000-4000-8000-000000000001',
 '35110000-0000-4000-8000-000000000001', id, 'tenant', '35110000-0000-4000-8000-000000000001'
 from app.permission_roles where tenant_id = '35100000-0000-4000-8000-000000000001' and role_key = 'board';
insert into app.access_grants(id, tenant_id, auth_user_id, role_id, scope_kind, granted_by_auth_user_id)
 select '35150000-0000-4000-8000-000000000003', '35100000-0000-4000-8000-000000000002',
 '35110000-0000-4000-8000-000000000003', id, 'tenant', '35110000-0000-4000-8000-000000000003'
 from app.permission_roles where tenant_id = '35100000-0000-4000-8000-000000000002' and role_key = 'board';
create function pg_temp.sportlink_actor(p_actor uuid) returns void language plpgsql security invoker as $$begin
 perform set_config('request.jwt.claims', jsonb_build_object('sub', p_actor, 'session_id', p_actor, 'role', 'authenticated',
  'email', (select email from auth.users where id = p_actor), 'exp', extract(epoch from clock_timestamp())::bigint + 3600)::text, true);
 perform set_config('request.jwt.claim.sub', p_actor::text, true);
 perform set_config('request.jwt.claim.email', (select email from auth.users where id = p_actor), true);
end;$$;
grant execute on function pg_temp.sportlink_actor(uuid) to authenticated;

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'app.sportlink_connection_credentials'::regclass), 'ciphertext table forces RLS');
select ok(not has_table_privilege('authenticated', 'app.sportlink_connection_credentials', 'SELECT'), 'native manager uses scoped RPC, not raw credential table');
select ok(not has_table_privilege('service_role', 'app.sportlink_connection_credentials', 'SELECT'), 'no service credential lookup bypass');
select ok(not has_function_privilege('anon', 'api.sportlink_connection_state(uuid)', 'EXECUTE'), 'anonymous connection access denied');
select ok(not has_function_privilege('service_role', 'api.configure_sportlink_connection(uuid,uuid,bigint,jsonb,text,uuid)', 'EXECUTE'), 'service role cannot configure for an actor');
select ok(not has_function_privilege('authenticated', 'internal.sportlink_valid_test(jsonb,uuid)', 'EXECUTE'), 'validators are private');

select pg_temp.sportlink_actor('35110000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_ok($$select api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')$$, '42501', 'FORBIDDEN', 'member cannot read manager configuration');
select throws_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}', repeat('8',64),'35130000-0000-4000-8000-000000000001')$$, '42501', 'FORBIDDEN', 'member cannot save ciphertext configuration');
reset role;

select pg_temp.sportlink_actor('35110000-0000-4000-8000-000000000001');
set local role authenticated;
select ok(current_user = 'authenticated' and not (select rolsuper from pg_roles where rolname = current_user), 'tested API actor is authenticated and not a superuser');
select ok(internal.actor_has_active_session(), 'manager fixture uses a confirmed user and an actual active native session');
select is(api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')->'connection', 'null'::jsonb, 'new club has no global or fixed ClientID');
select throws_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '[]', repeat('8',64),'35130000-0000-4000-8000-000000000001')$$, '22023', 'INVALID_SPORTLINK_CONFIGURATION', 'malformed envelope rejected without mutation');
select lives_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}', repeat('8',64),'35130000-0000-4000-8000-000000000001')$$, 'native manager saves own encrypted setting');
select is((api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')->'connection'->>'version')::bigint, 1::bigint, 'first setting version is one');
select is(api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')->'connection'->>'status', 'preparing', 'configuration does not claim a connected import');
select lives_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"BBBBBBBBBBBBBBBB","ciphertext":"BBBBBBBB","tag":"BBBBBBBBBBBBBBBBBBBBBB"}', repeat('8',64),'35130000-0000-4000-8000-000000000001')$$, 'same semantic ClientID retry ignores new encryption nonce');
select throws_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"BBBBBBBBBBBBBBBB","ciphertext":"BBBBBBBB","tag":"BBBBBBBBBBBBBBBBBBBBBB"}', repeat('9',64),'35130000-0000-4000-8000-000000000001')$$, '22000', 'IDEMPOTENCY_CONFLICT', 'same key cannot replace with another semantic credential');
select throws_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"BBBBBBBBBBBBBBBB","ciphertext":"BBBBBBBB","tag":"BBBBBBBBBBBBBBBBBBBBBB"}', repeat('9',64),'35130000-0000-4000-8000-000000000002')$$, '40001', 'STALE_VERSION', 'stale update cannot overwrite the existing setting');
select throws_ok($$select api.sportlink_connection_credential('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0)$$,
 '40001', 'STALE_VERSION', 'credential read is bound to its current configuration version');
select lives_ok($$select api.sportlink_connection_credential('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',1)$$, 'own native manager retrieves only an encrypted envelope');
select throws_ok($$select api.sportlink_connection_state('35100000-0000-4000-8000-000000000002')$$, '42501', 'FORBIDDEN', 'club A manager cannot access club B setting');
select throws_ok($$select api.start_match_import('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001','manual',null,'35130000-0000-4000-8000-000000000007')$$,
 '55000', 'INTEGRATION_UNAVAILABLE', 'saving a ClientID cannot activate the import kernel');
select throws_ok($$select api.record_sportlink_connection_test('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',1,
 '{"v":1,"signature":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","receipt":{"source":"sportlink_dataservice_read_test_v1","idempotency_key":"35140000-0000-4000-8000-000000000001","checked_at":"2026-10-09T09:00:00.000Z","code":"VERIFIED_READ_ACCESS","capabilities":{"matches":true,"match_details":true,"teams":true,"member_import":true,"duration_units_verified":false}}}',
 '35140000-0000-4000-8000-000000000001')$$, '22023', 'INVALID_SPORTLINK_TEST', 'read test cannot assert member import capabilities');
select lives_ok($$select api.record_sportlink_connection_test('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',1,
 '{"v":1,"signature":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","receipt":{"source":"sportlink_dataservice_read_test_v1","idempotency_key":"35140000-0000-4000-8000-000000000001","checked_at":"2026-10-09T09:00:00.000Z","code":"VERIFIED_READ_ACCESS","capabilities":{"matches":true,"match_details":true,"teams":true,"member_import":false,"duration_units_verified":false}}}',
 '35140000-0000-4000-8000-000000000001')$$, 'bounded test receipt recorded; fake signature is independently rejected by the server readmodel');
select is(api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')->'connection'->>'status', 'preparing', 'even read receipt cannot activate imports');
select is(api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')->'connection'->'last_success_at', 'null'::jsonb, 'read receipt cannot manufacture last successful import');
reset role;
select is((select count(*) from app.integration_connections where tenant_id = '35100000-0000-4000-8000-000000000001'), 1::bigint, 'timeout retry creates one connection');
select is((select count(*) from app.audit_events where tenant_id = '35100000-0000-4000-8000-000000000001'), 2::bigint, 'one configuration and one bounded test audit');
select is((select count(*) from app.domain_events where tenant_id = '35100000-0000-4000-8000-000000000001' and aggregate_type = 'integration_connection'), 2::bigint, 'canonical domain events committed exactly once');
select ok(not exists(select 1 from app.audit_events where tenant_id = '35100000-0000-4000-8000-000000000001'
 and (payload_minimal ? 'credential_envelope' or payload_minimal ? 'credential_fingerprint' or payload_minimal ? 'client_id')), 'no credential or fingerprint audit/export');
select is((select count(*) from app.matches where tenant_id = '35100000-0000-4000-8000-000000000001'), 0::bigint, 'connectivity test imports no real data');

update auth.sessions set not_after = statement_timestamp() - interval '1 second' where user_id = '35110000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select api.sportlink_connection_state('35100000-0000-4000-8000-000000000001')$$, '42501', 'FORBIDDEN', 'expired native session cannot view settings');
select throws_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}', repeat('8',64),'35130000-0000-4000-8000-000000000001')$$,
 '42501', 'FORBIDDEN', 'completed key replay does not restore expired session authority');
reset role;
update auth.sessions set not_after = null where user_id = '35110000-0000-4000-8000-000000000001';
update app.access_grants set revoked_at = statement_timestamp(), version = version + 1 where id = '35150000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select api.sportlink_connection_credential('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',2)$$,
 '42501', 'FORBIDDEN', 'revoked manager cannot retrieve encrypted credentials');
select throws_ok($$select api.configure_sportlink_connection('35100000-0000-4000-8000-000000000001','35120000-0000-4000-8000-000000000001',0,
 '{"v":1,"nonce":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAA","tag":"AAAAAAAAAAAAAAAAAAAAAA"}', repeat('8',64),'35130000-0000-4000-8000-000000000001')$$,
 '42501', 'FORBIDDEN', 'completed key replay does not restore revoked mandate');
reset role;
select is((select version from app.integration_connections where id = '35120000-0000-4000-8000-000000000001'), 2::bigint, 'all negative probes preserve the confirmed connection version');
select * from finish();
rollback;
