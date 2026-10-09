begin;

-- Per-tenant configuration only. A read test never starts an import or changes
-- a connection to active. Plaintext ClientIDs are never stored in this schema.
create table app.sportlink_connection_credentials (
  tenant_id uuid not null,
  connection_id uuid not null,
  credential_envelope jsonb not null,
  credential_fingerprint text not null check (credential_fingerprint ~ '^[0-9a-f]{64}$'),
  last_test jsonb,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (tenant_id, connection_id),
  foreign key (tenant_id, connection_id) references app.integration_connections(tenant_id, id) on delete restrict,
  check (jsonb_typeof(credential_envelope) = 'object'),
  check (last_test is null or jsonb_typeof(last_test) = 'object')
);
alter table app.sportlink_connection_credentials enable row level security;
alter table app.sportlink_connection_credentials force row level security;
revoke all on app.sportlink_connection_credentials from public, anon, authenticated, service_role;
grant select, insert, update on app.sportlink_connection_credentials to cluvo_command_owner;
create policy native_session_required on app.sportlink_connection_credentials as restrictive for all to authenticated
  using ((select internal.actor_has_active_session())) with check ((select internal.actor_has_active_session()));
create policy command_owner_read on app.sportlink_connection_credentials for select to cluvo_command_owner using (true);
create policy command_owner_insert on app.sportlink_connection_credentials for insert to cluvo_command_owner with check (true);
create policy command_owner_update on app.sportlink_connection_credentials for update to cluvo_command_owner using (true) with check (true);

create function internal.sportlink_valid_envelope(p_envelope jsonb) returns boolean
language sql immutable security invoker set search_path = '' as $function$
  select case when jsonb_typeof(p_envelope) = 'object' then coalesce(
    (select count(*) from jsonb_object_keys(p_envelope)) = 4
    and p_envelope -> 'v' = '1'::jsonb
    and jsonb_typeof(p_envelope -> 'nonce') = 'string' and p_envelope ->> 'nonce' ~ '^[A-Za-z0-9_-]{16}$'
    and jsonb_typeof(p_envelope -> 'tag') = 'string' and p_envelope ->> 'tag' ~ '^[A-Za-z0-9_-]{22}$'
    and jsonb_typeof(p_envelope -> 'ciphertext') = 'string' and p_envelope ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{8,171}$', false) else false end;
$function$;

create function internal.sportlink_valid_test(p_test jsonb, p_key uuid) returns boolean
language plpgsql immutable security invoker set search_path = '' as $function$
declare r jsonb; c jsonb; code text;
begin
  if jsonb_typeof(p_test) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_test)) <> 3
    or p_test -> 'v' is distinct from '1'::jsonb or jsonb_typeof(p_test -> 'signature') is distinct from 'string'
    or (p_test ->> 'signature') !~ '^[A-Za-z0-9_-]{43}$' then return false; end if;
  r := p_test -> 'receipt';
  if jsonb_typeof(r) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(r)) <> 5
    or r ->> 'source' is distinct from 'sportlink_dataservice_read_test_v1'
    or r ->> 'idempotency_key' is distinct from p_key::text
    or jsonb_typeof(r -> 'checked_at') is distinct from 'string'
    or (r ->> 'checked_at') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    or jsonb_typeof(r -> 'code') is distinct from 'string' then return false; end if;
  code := r ->> 'code'; c := r -> 'capabilities';
  if jsonb_typeof(c) is distinct from 'object' then return false; end if;
  if code not in ('VERIFIED_READ_ACCESS', 'PROVIDER_DENIED', 'PROVIDER_UNAVAILABLE', 'INVALID_SOURCE_RESPONSE', 'CONTRACT_UNAVAILABLE')
    or (select count(*) from jsonb_object_keys(c)) <> 5
    or c -> 'member_import' is distinct from 'false'::jsonb or c -> 'duration_units_verified' is distinct from 'false'::jsonb
    or jsonb_typeof(c -> 'matches') is distinct from 'boolean' or jsonb_typeof(c -> 'match_details') is distinct from 'boolean'
    or jsonb_typeof(c -> 'teams') is distinct from 'boolean' then return false; end if;
  if code = 'VERIFIED_READ_ACCESS' then return c -> 'matches' = 'true'::jsonb; end if;
  return c -> 'matches' = 'false'::jsonb and c -> 'match_details' = 'false'::jsonb and c -> 'teams' = 'false'::jsonb;
end;
$function$;

create function internal.sportlink_connection_state(p_tenant_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $function$
declare result jsonb;
begin
  if not internal.actor_has_active_session() or not internal.has_permission(p_tenant_id, 'match.import', 'tenant', p_tenant_id)
    or internal.current_actor_uid() is null then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  select jsonb_build_object('id', c.id, 'version', c.version, 'status', c.status,
    'configured', s.connection_id is not null, 'last_success_at', c.last_success_at,
    'credential_fingerprint', s.credential_fingerprint, 'last_test', s.last_test)
    into result from app.integration_connections c left join app.sportlink_connection_credentials s
      on s.tenant_id = c.tenant_id and s.connection_id = c.id
    where c.tenant_id = p_tenant_id and c.provider = 'sportlink' and c.connection_key = 'cluvo-sportlink-dataservice-v1';
  return jsonb_build_object('authorized', true, 'connection', result);
end;
$function$;

create function internal.configure_sportlink_connection(
  p_tenant_id uuid, p_connection_id uuid, p_expected_version bigint, p_credential_envelope jsonb,
  p_credential_fingerprint text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare actor uuid := internal.current_actor_uid(); c app.integration_connections%rowtype;
  prior jsonb; result jsonb; version bigint; event uuid := gen_random_uuid();
begin
  if actor is null or not internal.actor_has_active_session()
    or not internal.has_permission(p_tenant_id, 'match.import', 'tenant', p_tenant_id)
    then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if p_connection_id is null or p_expected_version is null or p_expected_version < 0 or p_idempotency_key is null
    or not internal.sportlink_valid_envelope(p_credential_envelope) or p_credential_fingerprint is null
    or p_credential_fingerprint !~ '^[0-9a-f]{64}$'
    then raise exception using errcode = '22023', message = 'INVALID_SPORTLINK_CONFIGURATION'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cluvo-sportlink:' || p_tenant_id::text, 0));
  select * into c from app.integration_connections where tenant_id = p_tenant_id and provider = 'sportlink'
    and connection_key = 'cluvo-sportlink-dataservice-v1' for update;
  if not internal.actor_has_active_session() or not internal.has_permission(p_tenant_id, 'match.import', 'tenant', p_tenant_id)
    then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  prior := internal.claim_idempotency(p_tenant_id, 'configure_sportlink_connection', p_idempotency_key,
    extensions.digest(convert_to(jsonb_build_object('connection_id', p_connection_id, 'expected_version', p_expected_version,
      'credential_fingerprint', p_credential_fingerprint)::text, 'UTF8'), 'sha256'));
  if prior is not null then return prior; end if;
  if c.id is null then
    if p_expected_version <> 0 then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
    insert into app.integration_connections(id, tenant_id, provider, connection_key, credential_reference, status)
      values (p_connection_id, p_tenant_id, 'sportlink', 'cluvo-sportlink-dataservice-v1', 'server-envelope:v1', 'preparing')
      returning app.integration_connections.version into version;
  else
    if c.id <> p_connection_id or c.version <> p_expected_version
      then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
    update app.integration_connections set status = 'preparing', credential_reference = 'server-envelope:v1',
      capabilities = '{}'::jsonb, updated_at = statement_timestamp(), version = c.version + 1
      where tenant_id = p_tenant_id and id = p_connection_id returning app.integration_connections.version into version;
  end if;
  insert into app.sportlink_connection_credentials(tenant_id, connection_id, credential_envelope, credential_fingerprint)
    values (p_tenant_id, p_connection_id, p_credential_envelope, p_credential_fingerprint)
    on conflict (tenant_id, connection_id) do update set credential_envelope = excluded.credential_envelope,
      credential_fingerprint = excluded.credential_fingerprint, last_test = null, updated_at = statement_timestamp();
  insert into app.audit_events(tenant_id, actor_auth_user_id, action, resource_type, resource_id, scope_kind, scope_id,
      idempotency_key, payload_minimal) values (p_tenant_id, actor, 'integration.sportlink_configured', 'integration_connection',
      p_connection_id, 'tenant', p_tenant_id, p_idempotency_key, jsonb_build_object('expected_version', p_expected_version,
      'new_version', version, 'credential_changed', true));
  insert into app.domain_events(id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal)
    values (event, p_tenant_id, 'integration_connection', p_connection_id, version, 'integration.sportlink_configured',
      jsonb_build_object('connection_id', p_connection_id, 'configuration_only', true));
  result := jsonb_build_object('ok', true, 'resource_id', p_connection_id, 'version', version, 'event_ids', jsonb_build_array(event));
  perform internal.finish_idempotency(p_tenant_id, 'configure_sportlink_connection', p_idempotency_key, result);
  return result;
end;
$function$;

create function internal.sportlink_connection_credential(p_tenant_id uuid, p_connection_id uuid, p_expected_version bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare c app.integration_connections%rowtype; s app.sportlink_connection_credentials%rowtype;
begin
  if internal.current_actor_uid() is null or not internal.actor_has_active_session()
    or not internal.has_permission(p_tenant_id, 'match.import', 'tenant', p_tenant_id)
    then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  select * into c from app.integration_connections where tenant_id = p_tenant_id and id = p_connection_id
    and provider = 'sportlink' and connection_key = 'cluvo-sportlink-dataservice-v1';
  if c.id is null or c.version <> p_expected_version or p_expected_version is null
    then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
  select * into s from app.sportlink_connection_credentials where tenant_id = p_tenant_id and connection_id = p_connection_id;
  if s.connection_id is null then raise exception using errcode = '55000', message = 'SPORTLINK_NOT_CONFIGURED'; end if;
  return jsonb_build_object('connection_id', c.id, 'version', c.version, 'credential_envelope', s.credential_envelope,
    'credential_fingerprint', s.credential_fingerprint);
end;
$function$;

create function internal.record_sportlink_connection_test(p_tenant_id uuid, p_connection_id uuid, p_expected_version bigint,
  p_test_result jsonb, p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare actor uuid := internal.current_actor_uid(); c app.integration_connections%rowtype;
  s app.sportlink_connection_credentials%rowtype; prior jsonb; result jsonb; version bigint; event uuid := gen_random_uuid();
begin
  if actor is null or not internal.actor_has_active_session()
    or not internal.has_permission(p_tenant_id, 'match.import', 'tenant', p_tenant_id)
    then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if p_connection_id is null or p_expected_version is null or p_expected_version < 1 or p_idempotency_key is null
    or not internal.sportlink_valid_test(p_test_result, p_idempotency_key)
    then raise exception using errcode = '22023', message = 'INVALID_SPORTLINK_TEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cluvo-sportlink:' || p_tenant_id::text, 0));
  select * into c from app.integration_connections where tenant_id = p_tenant_id and id = p_connection_id
    and provider = 'sportlink' and connection_key = 'cluvo-sportlink-dataservice-v1' for update;
  if not internal.actor_has_active_session() or not internal.has_permission(p_tenant_id, 'match.import', 'tenant', p_tenant_id)
    then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if c.id is null then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
  select * into s from app.sportlink_connection_credentials where tenant_id = p_tenant_id and connection_id = p_connection_id;
  if s.connection_id is null then raise exception using errcode = '55000', message = 'SPORTLINK_NOT_CONFIGURED'; end if;
  prior := internal.claim_idempotency(p_tenant_id, 'record_sportlink_connection_test', p_idempotency_key,
    extensions.digest(convert_to(jsonb_build_object('connection_id', p_connection_id, 'expected_version', p_expected_version,
      'credential_fingerprint', s.credential_fingerprint, 'code', p_test_result -> 'receipt' -> 'code',
      'capabilities', p_test_result -> 'receipt' -> 'capabilities')::text, 'UTF8'), 'sha256'));
  if prior is not null then return prior; end if;
  if c.version <> p_expected_version then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
  update app.sportlink_connection_credentials set last_test = p_test_result, updated_at = statement_timestamp()
    where tenant_id = p_tenant_id and connection_id = p_connection_id;
  update app.integration_connections set version = c.version + 1, updated_at = statement_timestamp(),
    capabilities = p_test_result -> 'receipt' -> 'capabilities'
    where tenant_id = p_tenant_id and id = p_connection_id returning app.integration_connections.version into version;
  insert into app.audit_events(tenant_id, actor_auth_user_id, action, resource_type, resource_id, scope_kind, scope_id,
    idempotency_key, payload_minimal) values (p_tenant_id, actor, 'integration.sportlink_read_test_recorded', 'integration_connection',
    p_connection_id, 'tenant', p_tenant_id, p_idempotency_key, jsonb_build_object('expected_version', p_expected_version,
      'new_version', version, 'read_test_only', true));
  insert into app.domain_events(id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal)
    values (event, p_tenant_id, 'integration_connection', p_connection_id, version, 'integration.sportlink_read_test_recorded',
      jsonb_build_object('connection_id', p_connection_id, 'read_test_only', true));
  result := jsonb_build_object('ok', true, 'resource_id', p_connection_id, 'version', version, 'event_ids', jsonb_build_array(event));
  perform internal.finish_idempotency(p_tenant_id, 'record_sportlink_connection_test', p_idempotency_key, result);
  return result;
end;
$function$;

create function api.sportlink_connection_state(p_tenant_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $function$ select internal.sportlink_connection_state(p_tenant_id); $function$;
create function api.configure_sportlink_connection(p_tenant_id uuid, p_connection_id uuid, p_expected_version bigint,
  p_credential_envelope jsonb, p_credential_fingerprint text, p_idempotency_key uuid) returns jsonb
language sql security invoker set search_path = '' as $function$
  select internal.configure_sportlink_connection(p_tenant_id, p_connection_id, p_expected_version,
    p_credential_envelope, p_credential_fingerprint, p_idempotency_key); $function$;
create function api.sportlink_connection_credential(p_tenant_id uuid, p_connection_id uuid, p_expected_version bigint) returns jsonb
language sql stable security invoker set search_path = '' as $function$
  select internal.sportlink_connection_credential(p_tenant_id, p_connection_id, p_expected_version); $function$;
create function api.record_sportlink_connection_test(p_tenant_id uuid, p_connection_id uuid, p_expected_version bigint,
  p_test_result jsonb, p_idempotency_key uuid) returns jsonb
language sql security invoker set search_path = '' as $function$
  select internal.record_sportlink_connection_test(p_tenant_id, p_connection_id, p_expected_version, p_test_result, p_idempotency_key); $function$;

grant create on schema api to cluvo_command_owner;
do $owners$ declare r record; begin
  for r in select p.oid::regprocedure sig, n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('api', 'internal') and p.proname in ('sportlink_valid_envelope', 'sportlink_valid_test',
      'sportlink_connection_state', 'configure_sportlink_connection', 'sportlink_connection_credential', 'record_sportlink_connection_test')
  loop
    execute format('alter function %s owner to cluvo_command_owner', r.sig);
    execute format('revoke all on function %s from public, anon, authenticated, service_role', r.sig);
    if r.proname not in ('sportlink_valid_envelope', 'sportlink_valid_test') then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end; $owners$;
revoke create on schema api from cluvo_command_owner;

commit;
