-- Expand W02 invitation commands without editing published migrations.
-- Existing bootstrap signatures remain during the app transition. They must
-- be retired in a later contract migration before full V1 acceptance.
begin;

grant select (id, email, email_confirmed_at, deleted_at, banned_until) on auth.users to cluvo_command_owner;
create policy cluvo_current_identity_read on auth.users for select to cluvo_command_owner
using (id = (select internal.current_actor_uid()));

-- A signed email claim is checked against the current, confirmed Auth identity.
-- No Auth contact information is exposed through an API projection.
create or replace function internal.actor_has_verified_email()
returns boolean language sql stable security invoker set search_path = ''
-- Auth can restore its schema ACL on startup. Bind references at creation;
-- narrowly granted columns and the own-subject RLS policy remain sufficient.
begin atomic
  select exists (select 1 from auth.users as identity
    where identity.id = internal.current_actor_uid()
      and lower(identity.email) = internal.current_actor_email()
      and identity.email_confirmed_at is not null and identity.deleted_at is null
      and (identity.banned_until is null or identity.banned_until <= statement_timestamp()));
end;
alter function internal.actor_has_verified_email() owner to cluvo_command_owner;
revoke all on function internal.actor_has_verified_email() from public, anon, authenticated, service_role;

create or replace function internal.invitation_author_is_active(p_tenant_id uuid, p_household_id uuid, p_actor_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $function$
  select exists (select 1 from app.tenant_memberships as membership
    join app.tenants as tenant on tenant.id = membership.tenant_id and tenant.status = 'active'
    where membership.tenant_id = p_tenant_id and membership.auth_user_id = p_actor_id and membership.status = 'active'
      and membership.starts_at <= statement_timestamp() and (membership.ends_at is null or membership.ends_at > statement_timestamp()))
    and exists (select 1 from app.households where tenant_id = p_tenant_id and id = p_household_id and status <> 'archived')
    and (exists (select 1 from app.household_access_grants as grant_row
      where grant_row.tenant_id = p_tenant_id and grant_row.household_id = p_household_id and grant_row.auth_user_id = p_actor_id
        and grant_row.can_invite_executor and grant_row.revoked_at is null and grant_row.starts_at <= statement_timestamp()
        and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp()))
      or exists (select 1 from app.access_grants as grant_row
        join app.role_permissions as permission on permission.tenant_id = grant_row.tenant_id and permission.role_id = grant_row.role_id
        where grant_row.tenant_id = p_tenant_id and grant_row.auth_user_id = p_actor_id
          and permission.permission_key = 'household.invite_executor' and grant_row.revoked_at is null
          and grant_row.starts_at <= statement_timestamp() and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
          and (grant_row.scope_kind = 'tenant' or (grant_row.scope_kind = 'household' and grant_row.household_id = p_household_id))));
$function$;
alter function internal.invitation_author_is_active(uuid, uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.invitation_author_is_active(uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- Append the concurrency version to the already restricted invoker projection.
create or replace view api.my_households with (security_invoker = true) as
select household.tenant_id, household.id as household_id, household.label,
  grant_row.can_view_progress, grant_row.can_invite_executor, household.version
from app.household_access_grants as grant_row
join app.households as household on household.tenant_id = grant_row.tenant_id and household.id = grant_row.household_id
where grant_row.auth_user_id = (select auth.uid())
  and grant_row.starts_at <= statement_timestamp()
  and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
  and grant_row.revoked_at is null and household.status <> 'archived';

create or replace function internal.create_household_invitation_v2(
  p_tenant_id uuid,
  p_household_id uuid,
  p_given_name text,
  p_family_name text,
  p_email text,
  p_token_hash_hex text,
  p_can_view_progress boolean,
  p_can_book_for boolean,
  p_expected_household_version bigint,
  p_idempotency_key uuid
)
returns table (
  ok boolean,
  resource_id uuid,
  version bigint,
  event_ids uuid[],
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_email text := lower(nullif(btrim(p_email), ''));
  v_given_name text := nullif(btrim(p_given_name), '');
  v_family_name text := nullif(btrim(p_family_name), '');
  v_household_version bigint;
  v_request_hash bytea;
  v_existing app.idempotency_records%rowtype;
  v_idempotency_id uuid;
  v_person_id uuid := gen_random_uuid();
  v_invitation_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.actor_has_verified_email() or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not internal.can_access_household(p_tenant_id, p_household_id, 'invite_executor')
    and not internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', p_household_id)
  then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_email) > 254
    or v_given_name is null or length(v_given_name) > 100
    or v_family_name is null or length(v_family_name) > 150
    or p_token_hash_hex !~ '^[0-9a-f]{64}$'
    or p_token_hash_hex is null or p_can_view_progress is null or p_can_book_for is null
    or p_expected_household_version is null or p_expected_household_version < 1
    or p_idempotency_key is null
  then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;

  select household.version into v_household_version from app.households as household
  where household.tenant_id = p_tenant_id and household.id = p_household_id and household.status <> 'archived'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'household_id', p_household_id,
    'expected_household_version', p_expected_household_version,
    'given_name', v_given_name,
    'family_name', v_family_name,
    'email_hash', encode(extensions.digest(convert_to(v_email, 'UTF8'), 'sha256'), 'hex'),
    'token_hash', p_token_hash_hex,
    'can_view_progress', p_can_view_progress,
    'can_book_for', p_can_book_for
  )::text, 'UTF8'), 'sha256');

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, 'create_household_invitation_v2', p_idempotency_key,
    v_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_idempotency_id;

  if v_idempotency_id is null then
    select * into v_existing
    from app.idempotency_records
    where tenant_id = p_tenant_id
      and actor_auth_user_id = v_actor
      and operation = 'create_household_invitation_v2'
      and idempotency_key = p_idempotency_key
    for update;
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.status = 'completed' then
      return query select
        true,
        (v_existing.result_jsonb ->> 'resource_id')::uuid,
        (v_existing.result_jsonb ->> 'version')::bigint,
        array(select value::uuid from jsonb_array_elements_text(v_existing.result_jsonb -> 'event_ids')),
        v_existing.result_jsonb -> 'result';
      return;
    end if;
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  if v_household_version <> p_expected_household_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;

  insert into app.persons (
    id, tenant_id, given_name, family_name, status
  ) values (
    v_person_id, p_tenant_id, v_given_name, v_family_name, 'invited'
  );

  insert into app.household_invitations (
    id, tenant_id, household_id, invited_email_hash, invited_person_id,
    token_hash, can_view_progress, can_book_for, expires_at,
    created_by_auth_user_id
  ) values (
    v_invitation_id, p_tenant_id, p_household_id,
    extensions.digest(convert_to(v_email, 'UTF8'), 'sha256'), v_person_id,
    decode(p_token_hash_hex, 'hex'), p_can_view_progress, p_can_book_for,
    statement_timestamp() + interval '1 hour', v_actor
  );

  update app.households as household
  set version = household.version + 1, updated_at = statement_timestamp()
  where household.tenant_id = p_tenant_id and household.id = p_household_id;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'household.invitation_created', 'household_invitation',
    v_invitation_id, 'household', p_household_id, p_idempotency_key,
    jsonb_build_object('person_id', v_person_id, 'expected_household_version', p_expected_household_version,
      'household_version', v_household_version + 1, 'invitation_version', 1)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'household_invitation', v_invitation_id, 1,
    'household.invitation_created', jsonb_build_object('household_id', p_household_id)
  );

  v_result := jsonb_build_object(
    'resource_id', v_invitation_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('person_id', v_person_id, 'expires_in_seconds', 3600, 'household_version', v_household_version + 1)
  );
  update app.idempotency_records
  set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp()
  where id = v_idempotency_id;

  return query select true, v_invitation_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.create_household_invitation_v2(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.create_household_invitation_v2(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  from public, anon, service_role;
grant execute on function internal.create_household_invitation_v2(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  to authenticated;

create or replace function api.create_household_invitation_v2(
  p_tenant_id uuid,
  p_household_id uuid,
  p_given_name text,
  p_family_name text,
  p_email text,
  p_token_hash_hex text,
  p_can_view_progress boolean,
  p_can_book_for boolean,
  p_expected_household_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.create_household_invitation_v2(
    p_tenant_id, p_household_id, p_given_name, p_family_name, p_email,
    p_token_hash_hex, p_can_view_progress, p_can_book_for, p_expected_household_version, p_idempotency_key
  );
$function$;

revoke execute on function api.create_household_invitation_v2(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  from public, anon, service_role;
grant execute on function api.create_household_invitation_v2(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  to authenticated;


create or replace function internal.household_invitation_delivery_v2(p_tenant_id uuid, p_invitation_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_invitation app.household_invitations%rowtype;
begin
  if not internal.actor_has_verified_email() or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_invitation from app.household_invitations
    where tenant_id = p_tenant_id and id = p_invitation_id and created_by_auth_user_id = internal.current_actor_uid();
  if not found or not internal.invitation_author_is_active(p_tenant_id, v_invitation.household_id, internal.current_actor_uid()) then return null; end if;
  return jsonb_build_object('delivery_status', v_invitation.delivery_status, 'version', v_invitation.version,
    'expired', v_invitation.expires_at <= statement_timestamp());
end;
$function$;
alter function internal.household_invitation_delivery_v2(uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.household_invitation_delivery_v2(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.household_invitation_delivery_v2(uuid, uuid) to authenticated;
create or replace function api.household_invitation_delivery_v2(p_tenant_id uuid, p_invitation_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select internal.household_invitation_delivery_v2(p_tenant_id, p_invitation_id); $function$;
revoke all on function api.household_invitation_delivery_v2(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function api.household_invitation_delivery_v2(uuid, uuid) to authenticated;

create or replace function internal.mark_household_invitation_delivery_v2(
  p_tenant_id uuid, p_invitation_id uuid, p_expected_version bigint, p_delivered boolean, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_invitation app.household_invitations%rowtype;
  v_idempotency_id uuid;
  v_existing app.idempotency_records%rowtype;
  v_hash bytea;
  v_result jsonb;
  v_events uuid[] := '{}'::uuid[];
  v_event uuid;
begin
  if v_actor is null or not internal.actor_has_verified_email() or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_version is null or p_expected_version < 1 or p_idempotency_key is null or p_delivered is null then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;
  select * into v_invitation from app.household_invitations
    where tenant_id = p_tenant_id and id = p_invitation_id and created_by_auth_user_id = v_actor for update;
  if not found or not internal.invitation_author_is_active(p_tenant_id, v_invitation.household_id, v_actor) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  v_hash := extensions.digest(convert_to(jsonb_build_object('invitation_id', p_invitation_id,
    'expected_version', p_expected_version, 'delivered', p_delivered)::text, 'UTF8'), 'sha256');
  insert into app.idempotency_records (tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status)
    values (p_tenant_id, v_actor, 'mark_household_invitation_delivery_v2', p_idempotency_key, v_hash, 'processing')
    on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing returning id into v_idempotency_id;
  if v_idempotency_id is null then
    select * into v_existing from app.idempotency_records where tenant_id = p_tenant_id and actor_auth_user_id = v_actor
      and operation = 'mark_household_invitation_delivery_v2' and idempotency_key = p_idempotency_key for update;
    if v_existing.request_hash <> v_hash then raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status <> 'completed' then raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return query select true, (v_existing.result_jsonb->>'resource_id')::uuid, (v_existing.result_jsonb->>'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_existing.result_jsonb->'event_ids')), v_existing.result_jsonb->'result';
    return;
  end if;
  if v_invitation.version <> p_expected_version then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
  if v_invitation.expires_at <= statement_timestamp() then raise exception using errcode = '42501', message = 'INVALID_INVITATION'; end if;
  perform internal.mark_household_invitation_delivery(p_tenant_id, p_invitation_id, p_delivered);
  select * into v_invitation from app.household_invitations where tenant_id = p_tenant_id and id = p_invitation_id;
  if v_invitation.version <> p_expected_version then
    v_event := gen_random_uuid(); v_events := array[v_event];
    insert into app.audit_events (tenant_id, actor_auth_user_id, action, resource_type, resource_id, scope_kind, scope_id, idempotency_key, payload_minimal)
      values (p_tenant_id, v_actor, 'household.invitation_delivery_recorded', 'household_invitation', p_invitation_id,
        'household', v_invitation.household_id, p_idempotency_key,
        jsonb_build_object('expected_version', p_expected_version, 'version', v_invitation.version, 'delivery_status', v_invitation.delivery_status));
    insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal)
      values (v_event, p_tenant_id, 'household_invitation', p_invitation_id, v_invitation.version,
        'household.invitation_delivery_recorded', jsonb_build_object('delivery_status', v_invitation.delivery_status));
  end if;
  v_result := jsonb_build_object('resource_id', p_invitation_id, 'version', v_invitation.version, 'event_ids', to_jsonb(v_events),
    'result', jsonb_build_object('delivery_status', v_invitation.delivery_status));
  update app.idempotency_records set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp() where id = v_idempotency_id;
  return query select true, p_invitation_id, v_invitation.version, v_events, v_result->'result';
end;
$function$;
alter function internal.mark_household_invitation_delivery_v2(uuid, uuid, bigint, boolean, uuid) owner to cluvo_command_owner;
revoke all on function internal.mark_household_invitation_delivery_v2(uuid, uuid, bigint, boolean, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.mark_household_invitation_delivery_v2(uuid, uuid, bigint, boolean, uuid) to authenticated;
create or replace function api.mark_household_invitation_delivery_v2(
  p_tenant_id uuid, p_invitation_id uuid, p_expected_version bigint, p_delivered boolean, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$ select * from internal.mark_household_invitation_delivery_v2(p_tenant_id, p_invitation_id, p_expected_version, p_delivered, p_idempotency_key); $function$;
revoke all on function api.mark_household_invitation_delivery_v2(uuid, uuid, bigint, boolean, uuid) from public, anon, authenticated, service_role;
grant execute on function api.mark_household_invitation_delivery_v2(uuid, uuid, bigint, boolean, uuid) to authenticated;

-- Invitation recipients have no membership yet. A confirmed, matching Auth
-- identity can see only this consent context, never an arbitrary dossier.
create or replace function internal.household_invitation_context(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_invitation app.household_invitations%rowtype; v_label text;
begin
  if not internal.actor_has_verified_email() or p_token is null or length(p_token) not between 32 and 200 then return null; end if;
  select * into v_invitation from app.household_invitations
    where token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
      and invited_email_hash = extensions.digest(convert_to(internal.current_actor_email(), 'UTF8'), 'sha256');
  if not found or v_invitation.expires_at <= statement_timestamp()
    or v_invitation.delivery_status not in ('pending', 'sent', 'delivery_failed', 'accepted') then return null; end if;
  select household.label into v_label from app.households as household
    join app.tenants as tenant on tenant.id = household.tenant_id and tenant.status = 'active'
    where household.tenant_id = v_invitation.tenant_id and household.id = v_invitation.household_id and household.status <> 'archived';
  if not found then return null; end if;
  if v_invitation.delivery_status = 'accepted' then
    if v_invitation.accepted_by_auth_user_id <> internal.current_actor_uid()
      or not internal.is_self_person(v_invitation.tenant_id, v_invitation.invited_person_id)
      or not internal.can_access_household(v_invitation.tenant_id, v_invitation.household_id, 'base') then return null; end if;
  elsif not internal.invitation_author_is_active(v_invitation.tenant_id, v_invitation.household_id, v_invitation.created_by_auth_user_id) then return null;
  end if;
  return jsonb_build_object('version', v_invitation.version, 'household_label', v_label,
    'can_view_progress', v_invitation.can_view_progress, 'can_book_for', v_invitation.can_book_for,
    'accepted', v_invitation.delivery_status = 'accepted', 'expires_at', v_invitation.expires_at);
end;
$function$;
alter function internal.household_invitation_context(text) owner to cluvo_command_owner;
revoke all on function internal.household_invitation_context(text) from public, anon, authenticated, service_role;
grant execute on function internal.household_invitation_context(text) to authenticated;
create or replace function api.household_invitation_context(p_token text)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select internal.household_invitation_context(p_token); $function$;
revoke all on function api.household_invitation_context(text) from public, anon, authenticated, service_role;
grant execute on function api.household_invitation_context(text) to authenticated;

create or replace function internal.accept_household_invitation_v2(p_token text, p_expected_version bigint, p_idempotency_key uuid)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_invitation app.household_invitations%rowtype;
  v_idempotency_id uuid;
  v_existing app.idempotency_records%rowtype;
  v_hash bytea;
  v_token_hash bytea;
  v_result jsonb;
  v_tenant_slug text;
  v_events uuid[] := '{}'::uuid[];
  v_event uuid;
begin
  if v_actor is null or not internal.actor_has_verified_email() or p_token is null or length(p_token) not between 32 and 200 then
    raise exception using errcode = '42501', message = 'INVALID_INVITATION';
  end if;
  if p_expected_version is null or p_expected_version < 1 or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;
  v_token_hash := extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
  select * into v_invitation from app.household_invitations
    where token_hash = v_token_hash and invited_email_hash = extensions.digest(convert_to(internal.current_actor_email(), 'UTF8'), 'sha256');
  if not found then raise exception using errcode = '42501', message = 'INVALID_INVITATION'; end if;
  -- The dossier lock precedes the invitation lock, also for active-email
  -- uniqueness conflicts with a simultaneous new invitation.
  perform 1 from app.households where tenant_id = v_invitation.tenant_id and id = v_invitation.household_id for update;
  select * into v_invitation from app.household_invitations where token_hash = v_token_hash for update;
  if internal.household_invitation_context(p_token) is null then
    raise exception using errcode = '42501', message = 'INVALID_INVITATION';
  end if;
  v_hash := extensions.digest(convert_to(jsonb_build_object('invitation_id', v_invitation.id,
    'token_hash', encode(v_token_hash, 'hex'), 'expected_version', p_expected_version)::text, 'UTF8'), 'sha256');
  insert into app.idempotency_records (tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status)
    values (v_invitation.tenant_id, v_actor, 'accept_household_invitation_v2', p_idempotency_key, v_hash, 'processing')
    on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing returning id into v_idempotency_id;
  if v_idempotency_id is null then
    select * into v_existing from app.idempotency_records where tenant_id = v_invitation.tenant_id and actor_auth_user_id = v_actor
      and operation = 'accept_household_invitation_v2' and idempotency_key = p_idempotency_key for update;
    if v_existing.request_hash <> v_hash then raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status <> 'completed' then raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return query select true, (v_existing.result_jsonb->>'resource_id')::uuid, (v_existing.result_jsonb->>'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_existing.result_jsonb->'event_ids')), v_existing.result_jsonb->'result';
    return;
  end if;
  if v_invitation.version <> p_expected_version then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
  select accepted.tenant_slug into v_tenant_slug from internal.accept_household_invitation(p_token) as accepted;
  select * into v_invitation from app.household_invitations where token_hash = v_token_hash;
  if v_invitation.version <> p_expected_version then
    update app.households as household set version = household.version + 1, updated_at = statement_timestamp()
      where household.tenant_id = v_invitation.tenant_id and household.id = v_invitation.household_id;
    v_event := gen_random_uuid(); v_events := array[v_event];
    insert into app.audit_events (tenant_id, actor_auth_user_id, action, resource_type, resource_id, scope_kind, scope_id, idempotency_key, payload_minimal)
      values (v_invitation.tenant_id, v_actor, 'household.invitation_acceptance_recorded', 'household_invitation', v_invitation.id,
        'household', v_invitation.household_id, p_idempotency_key,
        jsonb_build_object('expected_version', p_expected_version, 'version', v_invitation.version));
    insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal)
      values (v_event, v_invitation.tenant_id, 'household_invitation', v_invitation.id, v_invitation.version,
        'household.invitation_acceptance_recorded', jsonb_build_object('household_id', v_invitation.household_id));
  end if;
  v_result := jsonb_build_object('resource_id', v_invitation.id, 'version', v_invitation.version, 'event_ids', to_jsonb(v_events),
    'result', jsonb_build_object('tenant_slug', v_tenant_slug, 'household_id', v_invitation.household_id));
  update app.idempotency_records set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp() where id = v_idempotency_id;
  return query select true, v_invitation.id, v_invitation.version, v_events, v_result->'result';
end;
$function$;
alter function internal.accept_household_invitation_v2(text, bigint, uuid) owner to cluvo_command_owner;
revoke all on function internal.accept_household_invitation_v2(text, bigint, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.accept_household_invitation_v2(text, bigint, uuid) to authenticated;
create or replace function api.accept_household_invitation_v2(p_token text, p_expected_version bigint, p_idempotency_key uuid)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$ select * from internal.accept_household_invitation_v2(p_token, p_expected_version, p_idempotency_key); $function$;
revoke all on function api.accept_household_invitation_v2(text, bigint, uuid) from public, anon, authenticated, service_role;
grant execute on function api.accept_household_invitation_v2(text, bigint, uuid) to authenticated;

commit;
