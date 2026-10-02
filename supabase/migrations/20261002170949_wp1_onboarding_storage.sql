-- Cluvo WP1 hardening: controlled household invitations and private document
-- paths. Auth user creation remains a server-only Supabase Admin operation;
-- these commands are the tenant/RLS boundary before and after that operation.

alter table app.household_invitations
  add column delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'delivery_failed', 'accepted', 'cancelled')),
  add column delivered_at timestamptz,
  add column delivery_failed_at timestamptz,
  add column cancelled_at timestamptz,
  add column version bigint not null default 1 check (version > 0),
  add constraint household_invitations_delivery_state_ck check (
    (delivery_status = 'pending' and delivered_at is null and delivery_failed_at is null and accepted_at is null and cancelled_at is null)
    or (delivery_status = 'sent' and delivered_at is not null and delivery_failed_at is null and accepted_at is null and cancelled_at is null)
    or (delivery_status = 'delivery_failed' and delivery_failed_at is not null and accepted_at is null and cancelled_at is null)
    or (delivery_status = 'accepted' and delivered_at is not null and accepted_at is not null and cancelled_at is null)
    or (delivery_status = 'cancelled' and cancelled_at is not null and accepted_at is null)
  );

create index household_invitations_pending_lookup_idx
  on app.household_invitations (tenant_id, household_id, expires_at)
  where delivery_status in ('pending', 'sent');
create unique index household_invitations_active_email_uq
  on app.household_invitations (tenant_id, household_id, invited_email_hash)
  where delivery_status in ('pending', 'sent');

-- A household split is a reviewed dossier transition, not a side effect of a
-- second account or intake.  The applied decision identifies the shared child,
-- the parent moving to the new dossier and the explicit link to the already
-- existing seasonal obligation.
create table app.household_change_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  kind text not null check (kind = 'split'),
  source_household_id uuid not null,
  destination_household_id uuid not null,
  shared_child_person_id uuid not null,
  destination_parent_person_id uuid not null,
  obligation_id uuid not null,
  obligation_link_kind text not null
    check (obligation_link_kind in ('contributor', 'progress_only')),
  source_household_version bigint not null check (source_household_version > 0),
  status text not null default 'applied' check (status = 'applied'),
  decision_reason text not null check (nullif(btrim(decision_reason), '') is not null),
  decided_by_auth_user_id uuid not null,
  idempotency_key uuid not null,
  decided_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  version bigint not null default 1 check (version > 0),
  unique (tenant_id, id),
  unique (tenant_id, destination_household_id),
  unique (tenant_id, decided_by_auth_user_id, idempotency_key),
  foreign key (tenant_id, source_household_id)
    references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, destination_household_id)
    references app.households(tenant_id, id) on delete restrict,
  foreign key (tenant_id, shared_child_person_id)
    references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, destination_parent_person_id)
    references app.persons(tenant_id, id) on delete restrict,
  foreign key (tenant_id, obligation_id)
    references app.obligations(tenant_id, id) on delete restrict,
  foreign key (decided_by_auth_user_id) references auth.users(id) on delete restrict,
  check (source_household_id <> destination_household_id),
  check (shared_child_person_id <> destination_parent_person_id)
);

alter table app.household_change_cases enable row level security;
alter table app.household_change_cases force row level security;
revoke all on table app.household_change_cases from public, anon, authenticated, service_role;

create trigger household_change_cases_immutable
before update or delete on app.household_change_cases
for each row execute function internal.reject_immutable_change();

grant insert on
  app.persons,
  app.households,
  app.household_invitations,
  app.account_profiles,
  app.account_person_links,
  app.tenant_memberships,
  app.household_person_links,
  app.household_access_grants,
  app.household_obligation_links,
  app.household_change_cases,
  app.executor_obligation_grants,
  app.access_grants,
  app.intake_profiles
to cluvo_command_owner;

grant update on
  app.persons,
  app.household_invitations,
  app.account_profiles,
  app.tenant_memberships
to cluvo_command_owner;

grant update (separated_parents, updated_at, version)
  on app.households to cluvo_command_owner;
grant update (ends_at)
  on app.household_person_links to cluvo_command_owner;
grant update (revoked_at, updated_at, version)
  on app.household_access_grants to cluvo_command_owner;

grant select on app.household_change_cases to cluvo_command_owner;

do $command_policies$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'persons', 'households', 'household_invitations', 'account_profiles',
    'account_person_links', 'tenant_memberships', 'household_person_links',
    'household_access_grants', 'household_obligation_links',
    'household_change_cases', 'executor_obligation_grants', 'access_grants',
    'intake_profiles'
  ]
  loop
    execute format(
      'create policy wp1_command_owner_insert on app.%I for insert to cluvo_command_owner with check (true)',
      relation_name
    );
  end loop;

  foreach relation_name in array array[
    'persons', 'households', 'household_invitations', 'account_profiles',
    'tenant_memberships', 'household_person_links', 'household_access_grants'
  ]
  loop
    execute format(
      'create policy wp1_command_owner_update on app.%I for update to cluvo_command_owner using (true) with check (true)',
      relation_name
    );
  end loop;
end
$command_policies$;

create or replace function internal.current_actor_email()
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select lower(nullif(btrim(coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    case
      when nullif(current_setting('request.jwt.claims', true), '') is null then null
      else nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
    end
  )), ''));
$function$;

revoke execute on function internal.current_actor_email() from public, anon, authenticated, service_role;
grant execute on function internal.current_actor_email() to cluvo_command_owner;

create or replace function internal.try_uuid(p_value text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$function$;

revoke execute on function internal.try_uuid(text) from public, anon, service_role;
grant execute on function internal.try_uuid(text) to authenticated;

create or replace function internal.can_access_private_object(p_name text, p_write boolean default false)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_tenant_id uuid := internal.try_uuid(split_part(p_name, '/', 1));
  v_scope_kind text := split_part(p_name, '/', 2);
  v_scope_id uuid := internal.try_uuid(split_part(p_name, '/', 3));
begin
  if v_tenant_id is null or v_scope_id is null or split_part(p_name, '/', 4) = '' then
    return false;
  end if;
  if not internal.is_active_member(v_tenant_id) then
    return false;
  end if;

  return case v_scope_kind
    when 'personal' then internal.is_self_person(v_tenant_id, v_scope_id)
    when 'household' then internal.can_access_household(
      v_tenant_id,
      v_scope_id,
      case when p_write then 'manage_contacts' else 'base' end
    )
    when 'committee' then internal.has_permission(
      v_tenant_id,
      'shift.manage',
      'committee',
      v_scope_id
    )
    else false
  end;
end;
$function$;

revoke execute on function internal.can_access_private_object(text, boolean)
  from public, anon, service_role;
grant execute on function internal.can_access_private_object(text, boolean)
  to authenticated;

create or replace function internal.create_household_invitation(
  p_tenant_id uuid,
  p_household_id uuid,
  p_given_name text,
  p_family_name text,
  p_email text,
  p_token_hash_hex text,
  p_can_view_progress boolean,
  p_can_book_for boolean,
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
  v_request_hash bytea;
  v_existing app.idempotency_records%rowtype;
  v_idempotency_id uuid;
  v_person_id uuid := gen_random_uuid();
  v_invitation_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
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
    or p_idempotency_key is null
  then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;

  perform 1 from app.households
  where tenant_id = p_tenant_id and id = p_household_id and status <> 'archived';
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'household_id', p_household_id,
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
    p_tenant_id, v_actor, 'create_household_invitation', p_idempotency_key,
    v_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_idempotency_id;

  if v_idempotency_id is null then
    select * into v_existing
    from app.idempotency_records
    where tenant_id = p_tenant_id
      and actor_auth_user_id = v_actor
      and operation = 'create_household_invitation'
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

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'household.invitation_created', 'household_invitation',
    v_invitation_id, 'household', p_household_id, p_idempotency_key,
    jsonb_build_object('person_id', v_person_id)
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
    'result', jsonb_build_object('person_id', v_person_id, 'expires_in_seconds', 3600)
  );
  update app.idempotency_records
  set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp()
  where id = v_idempotency_id;

  return query select true, v_invitation_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  from public, anon, service_role;
grant execute on function internal.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  to authenticated;

create or replace function api.create_household_invitation(
  p_tenant_id uuid,
  p_household_id uuid,
  p_given_name text,
  p_family_name text,
  p_email text,
  p_token_hash_hex text,
  p_can_view_progress boolean,
  p_can_book_for boolean,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.create_household_invitation(
    p_tenant_id, p_household_id, p_given_name, p_family_name, p_email,
    p_token_hash_hex, p_can_view_progress, p_can_book_for, p_idempotency_key
  );
$function$;

revoke execute on function api.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  from public, anon, service_role;
grant execute on function api.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  to authenticated;

create or replace function internal.mark_household_invitation_delivery(
  p_tenant_id uuid,
  p_invitation_id uuid,
  p_delivered boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_invitation app.household_invitations%rowtype;
begin
  select invitation.* into v_invitation
  from app.household_invitations as invitation
  where invitation.tenant_id = p_tenant_id
    and invitation.id = p_invitation_id
    and invitation.created_by_auth_user_id = v_actor
  for update;
  if v_actor is null or not found then
    raise exception using errcode = '42501', message = 'INVITATION_NOT_PENDING';
  end if;

  if p_delivered then
    if v_invitation.delivery_status in ('sent', 'accepted') then
      return;
    end if;
    if v_invitation.delivery_status not in ('pending', 'delivery_failed') then
      raise exception using errcode = '42501', message = 'INVITATION_NOT_PENDING';
    end if;
    update app.household_invitations as invitation
    set delivery_status = 'sent', delivered_at = statement_timestamp(),
        delivery_failed_at = null, version = invitation.version + 1
    where invitation.id = v_invitation.id;
    update app.persons as person
    set status = 'invited', updated_at = statement_timestamp(), version = person.version + 1
    where person.tenant_id = p_tenant_id
      and person.id = v_invitation.invited_person_id
      and person.status = 'archived';
  else
    if v_invitation.delivery_status = 'delivery_failed' then
      return;
    end if;
    if v_invitation.delivery_status <> 'pending' then
      raise exception using errcode = '42501', message = 'INVITATION_NOT_PENDING';
    end if;
    update app.household_invitations as invitation
    set delivery_status = 'delivery_failed', delivery_failed_at = statement_timestamp(),
        delivered_at = null, version = invitation.version + 1
    where invitation.id = v_invitation.id;
    update app.persons as person
    set status = 'archived', updated_at = statement_timestamp(), version = person.version + 1
    where person.tenant_id = p_tenant_id
      and person.id = v_invitation.invited_person_id
      and person.status = 'invited';
  end if;
end;
$function$;

alter function internal.mark_household_invitation_delivery(uuid, uuid, boolean)
  owner to cluvo_command_owner;
revoke execute on function internal.mark_household_invitation_delivery(uuid, uuid, boolean)
  from public, anon, service_role;
grant execute on function internal.mark_household_invitation_delivery(uuid, uuid, boolean)
  to authenticated;

create or replace function api.mark_household_invitation_delivery(
  p_tenant_id uuid,
  p_invitation_id uuid,
  p_delivered boolean
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select internal.mark_household_invitation_delivery(p_tenant_id, p_invitation_id, p_delivered);
$function$;

revoke execute on function api.mark_household_invitation_delivery(uuid, uuid, boolean)
  from public, anon, service_role;
grant execute on function api.mark_household_invitation_delivery(uuid, uuid, boolean)
  to authenticated;

create or replace function internal.accept_household_invitation(p_token text)
returns table (tenant_slug text, household_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_email text := internal.current_actor_email();
  v_invitation app.household_invitations%rowtype;
  v_role_id uuid;
  v_tenant_slug text;
begin
  if v_actor is null or v_email is null or p_token is null or length(p_token) not between 32 and 200 then
    raise exception using errcode = '42501', message = 'INVALID_INVITATION';
  end if;

  select invitation.* into v_invitation
  from app.household_invitations as invitation
  where invitation.token_hash = extensions.digest(convert_to(p_token, 'UTF8'), 'sha256')
  for update;

  if not found
    or v_invitation.expires_at <= statement_timestamp()
    or v_invitation.delivery_status not in ('pending', 'sent', 'delivery_failed', 'accepted')
    or v_invitation.invited_email_hash <> extensions.digest(convert_to(v_email, 'UTF8'), 'sha256')
  then
    raise exception using errcode = '42501', message = 'INVALID_INVITATION';
  end if;
  if v_invitation.delivery_status = 'accepted' then
    if v_invitation.accepted_by_auth_user_id <> v_actor then
      raise exception using errcode = '42501', message = 'INVALID_INVITATION';
    end if;
    select tenant.slug into v_tenant_slug from app.tenants as tenant where tenant.id = v_invitation.tenant_id;
    return query select v_tenant_slug, v_invitation.household_id;
    return;
  end if;

  if exists (
    select 1 from app.account_person_links as link
    where link.tenant_id = v_invitation.tenant_id
      and link.auth_user_id = v_actor
      and link.revoked_at is null
      and link.person_id <> v_invitation.invited_person_id
  ) or exists (
    select 1 from app.account_person_links as link
    where link.tenant_id = v_invitation.tenant_id
      and link.person_id = v_invitation.invited_person_id
      and link.revoked_at is null
      and link.auth_user_id <> v_actor
  ) then
    raise exception using errcode = '23505', message = 'IDENTITY_ALREADY_LINKED';
  end if;

  insert into app.account_profiles (auth_user_id, display_name)
  select v_actor, concat_ws(' ', person.given_name, person.family_name)
  from app.persons as person
  where person.tenant_id = v_invitation.tenant_id and person.id = v_invitation.invited_person_id
  on conflict (auth_user_id) do nothing;

  update app.persons as person
  set status = 'active', updated_at = statement_timestamp(), version = person.version + 1
  where person.tenant_id = v_invitation.tenant_id and person.id = v_invitation.invited_person_id;

  if not exists (
    select 1 from app.tenant_memberships as membership
    where membership.tenant_id = v_invitation.tenant_id
      and membership.auth_user_id = v_actor and membership.status = 'active'
  ) then
    insert into app.tenant_memberships (tenant_id, auth_user_id, status)
    values (v_invitation.tenant_id, v_actor, 'active');
  end if;

  if not exists (
    select 1 from app.account_person_links as link
    where link.tenant_id = v_invitation.tenant_id
      and link.auth_user_id = v_actor and link.revoked_at is null
  ) then
    insert into app.account_person_links (
      tenant_id, auth_user_id, person_id, verified_at
    ) values (
      v_invitation.tenant_id, v_actor, v_invitation.invited_person_id, statement_timestamp()
    );
  end if;

  if v_invitation.can_book_for then
    insert into app.executor_obligation_grants (
      tenant_id, person_id, obligation_id, valid_from,
      approved_by_auth_user_id
    )
    select distinct
      v_invitation.tenant_id,
      v_invitation.invited_person_id,
      obligation_link.obligation_id,
      statement_timestamp(),
      v_invitation.created_by_auth_user_id
    from app.household_obligation_links as obligation_link
    join app.obligations as obligation
      on obligation.tenant_id = obligation_link.tenant_id
     and obligation.id = obligation_link.obligation_id
    where obligation_link.tenant_id = v_invitation.tenant_id
      and obligation_link.household_id = v_invitation.household_id
      and obligation_link.starts_at <= statement_timestamp()
      and (obligation_link.ends_at is null or obligation_link.ends_at > statement_timestamp())
      and obligation.status in ('active', 'review_hold', 'fulfilled')
      and not exists (
        select 1
        from app.executor_obligation_grants as existing_grant
        where existing_grant.tenant_id = v_invitation.tenant_id
          and existing_grant.person_id = v_invitation.invited_person_id
          and existing_grant.obligation_id = obligation_link.obligation_id
          and existing_grant.revoked_at is null
          and existing_grant.valid_until is null
      );
  end if;

  if not exists (
    select 1 from app.household_person_links as link
    where link.tenant_id = v_invitation.tenant_id
      and link.household_id = v_invitation.household_id
      and link.person_id = v_invitation.invited_person_id
      and link.kind = 'executor' and link.ends_at is null
  ) then
    insert into app.household_person_links (
      tenant_id, household_id, person_id, kind, verified_by_auth_user_id
    ) values (
      v_invitation.tenant_id, v_invitation.household_id,
      v_invitation.invited_person_id, 'executor', v_actor
    );
  end if;

  if not exists (
    select 1 from app.household_access_grants as household_grant
    where household_grant.tenant_id = v_invitation.tenant_id
      and household_grant.household_id = v_invitation.household_id
      and household_grant.auth_user_id = v_actor
      and household_grant.revoked_at is null
      and household_grant.ends_at is null
  ) then
    insert into app.household_access_grants (
      tenant_id, household_id, auth_user_id, can_view_progress,
      can_manage_contacts, can_invite_executor, can_book_for,
      granted_by_auth_user_id
    ) values (
      v_invitation.tenant_id, v_invitation.household_id, v_actor,
      v_invitation.can_view_progress, false, false, v_invitation.can_book_for,
      v_invitation.created_by_auth_user_id
    );
  end if;

  select role_row.id into v_role_id
  from app.permission_roles as role_row
  where role_row.tenant_id = v_invitation.tenant_id and role_row.role_key = 'member';
  if v_role_id is null then
    raise exception using errcode = '55000', message = 'MEMBER_ROLE_MISSING';
  end if;
  if not exists (
    select 1 from app.access_grants as grant_row
    where grant_row.tenant_id = v_invitation.tenant_id
      and grant_row.auth_user_id = v_actor
      and grant_row.role_id = v_role_id
      and grant_row.scope_kind = 'tenant'
      and grant_row.revoked_at is null
      and (grant_row.ends_at is null or grant_row.ends_at > statement_timestamp())
  ) then
    insert into app.access_grants (
      tenant_id, auth_user_id, role_id, scope_kind, granted_by_auth_user_id
    ) values (
      v_invitation.tenant_id, v_actor, v_role_id, 'tenant',
      v_invitation.created_by_auth_user_id
    );
  end if;

  insert into app.intake_profiles (
    tenant_id, person_id, household_context_id, status
  ) values (
    v_invitation.tenant_id, v_invitation.invited_person_id,
    v_invitation.household_id, 'draft'
  ) on conflict (tenant_id, person_id, household_context_id) do nothing;

  update app.household_invitations as invitation
  set delivery_status = 'accepted', accepted_at = statement_timestamp(),
      accepted_by_auth_user_id = v_actor,
      delivered_at = coalesce(invitation.delivered_at, statement_timestamp()),
      delivery_failed_at = null,
      version = invitation.version + 1
  where invitation.id = v_invitation.id;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, payload_minimal
  ) values (
    v_invitation.tenant_id, v_actor, 'household.invitation_accepted',
    'household_invitation', v_invitation.id, 'household',
    v_invitation.household_id,
    jsonb_build_object('person_id', v_invitation.invited_person_id)
  );

  insert into app.domain_events (
    tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_invitation.tenant_id, 'household_invitation', v_invitation.id,
    v_invitation.version + 1, 'household.invitation_accepted',
    jsonb_build_object('household_id', v_invitation.household_id)
  );

  select tenant.slug into v_tenant_slug
  from app.tenants as tenant where tenant.id = v_invitation.tenant_id;
  return query select v_tenant_slug, v_invitation.household_id;
end;
$function$;

alter function internal.accept_household_invitation(text) owner to cluvo_command_owner;
revoke execute on function internal.accept_household_invitation(text)
  from public, anon, service_role;
grant execute on function internal.accept_household_invitation(text) to authenticated;

create or replace function api.accept_household_invitation(p_token text)
returns table (tenant_slug text, household_id uuid)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.accept_household_invitation(p_token);
$function$;

revoke execute on function api.accept_household_invitation(text)
  from public, anon, service_role;
grant execute on function api.accept_household_invitation(text) to authenticated;

create policy wp1_command_owner_select on app.household_change_cases
  for select to cluvo_command_owner using (true);

create or replace function internal.apply_household_split(
  p_tenant_id uuid,
  p_source_household_id uuid,
  p_expected_source_version bigint,
  p_shared_child_person_id uuid,
  p_destination_parent_person_id uuid,
  p_destination_label text,
  p_destination_intake_code_hash_hex text,
  p_obligation_id uuid,
  p_obligation_link_kind text,
  p_decision_reason text,
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
  v_claim record;
  v_source app.households%rowtype;
  v_destination_parent_auth_user_id uuid;
  v_destination_parent_kind text;
  v_destination_household_id uuid := gen_random_uuid();
  v_case_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_effective_at timestamptz := statement_timestamp();
  v_result jsonb;
begin
  if v_actor is null
    or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id,
      'household.review',
      'household',
      p_source_household_id
    )
  then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_source_version is null
    or p_expected_source_version < 1
    or p_source_household_id is null
    or p_shared_child_person_id is null
    or p_destination_parent_person_id is null
    or p_shared_child_person_id = p_destination_parent_person_id
    or nullif(btrim(p_destination_label), '') is null
    or length(btrim(p_destination_label)) > 200
    or p_destination_intake_code_hash_hex is null
    or p_destination_intake_code_hash_hex !~ '^[0-9a-f]{64}$'
    or p_obligation_id is null
    or p_obligation_link_kind is null
    or p_obligation_link_kind not in ('contributor', 'progress_only')
    or nullif(btrim(p_decision_reason), '') is null
    or length(btrim(p_decision_reason)) > 2000
    or p_idempotency_key is null
  then
    raise exception using errcode = '22023', message = 'INVALID_HOUSEHOLD_SPLIT';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'apply_household_split',
    p_idempotency_key,
    jsonb_build_object(
      'source_household_id', p_source_household_id,
      'expected_source_version', p_expected_source_version,
      'shared_child_person_id', p_shared_child_person_id,
      'destination_parent_person_id', p_destination_parent_person_id,
      'destination_label', btrim(p_destination_label),
      'destination_intake_code_hash', p_destination_intake_code_hash_hex,
      'obligation_id', p_obligation_id,
      'obligation_link_kind', p_obligation_link_kind,
      'decision_reason', btrim(p_decision_reason)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(
        select value::uuid
        from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')
      ),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select household.* into v_source
  from app.households as household
  where household.tenant_id = p_tenant_id
    and household.id = p_source_household_id
  for update;
  if not found or v_source.status = 'archived' then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if v_source.version <> p_expected_source_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;

  perform obligation.id
  from app.obligations as obligation
  where obligation.tenant_id = p_tenant_id
    and obligation.id = p_obligation_id
    and obligation.assessed_household_id = p_source_household_id
    and obligation.status in ('active', 'review_hold', 'fulfilled')
  for update;
  if not found or not exists (
    select 1
    from app.household_obligation_links as obligation_link
    where obligation_link.tenant_id = p_tenant_id
      and obligation_link.household_id = p_source_household_id
      and obligation_link.obligation_id = p_obligation_id
      and obligation_link.link_kind = 'liable'
      and obligation_link.starts_at <= v_effective_at
      and (obligation_link.ends_at is null or obligation_link.ends_at > v_effective_at)
  ) then
    raise exception using errcode = 'P0002', message = 'OBLIGATION_NOT_LINKED';
  end if;

  perform 1
  from app.household_person_links as child_link
  where child_link.tenant_id = p_tenant_id
    and child_link.household_id = p_source_household_id
    and child_link.person_id = p_shared_child_person_id
    and child_link.kind = 'member'
    and child_link.starts_at <= v_effective_at
    and (child_link.ends_at is null or child_link.ends_at > v_effective_at);
  if not found then
    raise exception using errcode = '42501', message = 'SHARED_CHILD_NOT_IN_SOURCE_HOUSEHOLD';
  end if;

  perform 1
  from app.household_person_links as parent_link
  where parent_link.tenant_id = p_tenant_id
    and parent_link.household_id = p_source_household_id
    and parent_link.person_id = p_destination_parent_person_id
    and parent_link.kind in ('parent', 'guardian')
    and parent_link.starts_at <= v_effective_at
    and (parent_link.ends_at is null or parent_link.ends_at > v_effective_at)
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'DESTINATION_PARENT_NOT_IN_SOURCE_HOUSEHOLD';
  end if;
  select case
      when bool_or(parent_link.kind = 'parent') then 'parent'
      else 'guardian'
    end
  into v_destination_parent_kind
  from app.household_person_links as parent_link
  where parent_link.tenant_id = p_tenant_id
    and parent_link.household_id = p_source_household_id
    and parent_link.person_id = p_destination_parent_person_id
    and parent_link.kind in ('parent', 'guardian')
    and parent_link.starts_at <= v_effective_at
    and (parent_link.ends_at is null or parent_link.ends_at > v_effective_at);

  select account_link.auth_user_id into v_destination_parent_auth_user_id
  from app.account_person_links as account_link
  join app.tenant_memberships as membership
    on membership.tenant_id = account_link.tenant_id
   and membership.auth_user_id = account_link.auth_user_id
   and membership.status = 'active'
   and membership.starts_at <= v_effective_at
   and (membership.ends_at is null or membership.ends_at > v_effective_at)
  where account_link.tenant_id = p_tenant_id
    and account_link.person_id = p_destination_parent_person_id
    and account_link.revoked_at is null;
  if v_destination_parent_auth_user_id is null then
    raise exception using errcode = '42501', message = 'DESTINATION_PARENT_ACCOUNT_REQUIRED';
  end if;
  if exists (
    select 1
    from app.households as household
    where household.tenant_id = p_tenant_id
      and household.intake_code_hash = decode(p_destination_intake_code_hash_hex, 'hex')
  ) then
    raise exception using errcode = '23505', message = 'INTAKE_CODE_ALREADY_USED';
  end if;

  insert into app.households (
    id, tenant_id, label, intake_code_hash, separated_parents, status
  ) values (
    v_destination_household_id, p_tenant_id, btrim(p_destination_label),
    decode(p_destination_intake_code_hash_hex, 'hex'), true, 'active'
  );

  update app.households as household
  set separated_parents = true,
      updated_at = v_effective_at,
      version = household.version + 1
  where household.tenant_id = p_tenant_id
    and household.id = p_source_household_id
    and household.version = p_expected_source_version;
  if not found then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;

  update app.household_person_links as parent_link
  set ends_at = v_effective_at
  where parent_link.tenant_id = p_tenant_id
    and parent_link.household_id = p_source_household_id
    and parent_link.person_id = p_destination_parent_person_id
    and parent_link.kind in ('parent', 'guardian')
    and parent_link.ends_at is null;

  insert into app.household_person_links (
    tenant_id, household_id, person_id, kind, starts_at,
    verified_by_auth_user_id
  ) values
  (
    p_tenant_id, v_destination_household_id,
    p_destination_parent_person_id, v_destination_parent_kind,
    v_effective_at, v_actor
  ),
  (
    p_tenant_id, v_destination_household_id,
    p_shared_child_person_id, 'member', v_effective_at, v_actor
  );

  update app.household_access_grants as household_grant
  set revoked_at = v_effective_at,
      updated_at = v_effective_at,
      version = household_grant.version + 1
  where household_grant.tenant_id = p_tenant_id
    and household_grant.household_id = p_source_household_id
    and household_grant.auth_user_id = v_destination_parent_auth_user_id
    and household_grant.revoked_at is null
    and (household_grant.ends_at is null or household_grant.ends_at > v_effective_at);

  insert into app.household_access_grants (
    tenant_id, household_id, auth_user_id, can_view_progress,
    can_manage_contacts, can_invite_executor, can_book_for,
    starts_at, granted_by_auth_user_id
  ) values (
    p_tenant_id, v_destination_household_id,
    v_destination_parent_auth_user_id, true, true, true, false,
    v_effective_at, v_actor
  );

  insert into app.intake_profiles (
    tenant_id, person_id, household_context_id, status
  ) values (
    p_tenant_id, p_destination_parent_person_id,
    v_destination_household_id, 'draft'
  );

  insert into app.household_change_cases (
    id, tenant_id, kind, source_household_id, destination_household_id,
    shared_child_person_id, destination_parent_person_id, obligation_id,
    obligation_link_kind, source_household_version, decision_reason,
    decided_by_auth_user_id, idempotency_key, decided_at
  ) values (
    v_case_id, p_tenant_id, 'split', p_source_household_id,
    v_destination_household_id, p_shared_child_person_id,
    p_destination_parent_person_id, p_obligation_id,
    p_obligation_link_kind, p_expected_source_version,
    btrim(p_decision_reason), v_actor, p_idempotency_key, v_effective_at
  );

  insert into app.household_obligation_links (
    tenant_id, household_id, obligation_id, link_kind,
    starts_at, decision_ref
  ) values (
    p_tenant_id, v_destination_household_id, p_obligation_id,
    p_obligation_link_kind, v_effective_at, v_case_id
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, action, resource_type, resource_id,
    scope_kind, scope_id, reason_code, idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, 'household.split_applied',
    'household_change_case', v_case_id, 'household',
    p_source_household_id, 'committee_household_split', p_idempotency_key,
    jsonb_build_object(
      'destination_household_id', v_destination_household_id,
      'shared_child_person_id', p_shared_child_person_id,
      'obligation_id', p_obligation_id,
      'obligation_link_kind', p_obligation_link_kind
    )
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'household_change_case', v_case_id, 1,
    'household.split_applied',
    jsonb_build_object(
      'source_household_id', p_source_household_id,
      'destination_household_id', v_destination_household_id,
      'obligation_id', p_obligation_id
    )
  );

  v_result := jsonb_build_object(
    'resource_id', v_case_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'destination_household_id', v_destination_household_id,
      'shared_child_person_id', p_shared_child_person_id,
      'destination_parent_person_id', p_destination_parent_person_id,
      'obligation_id', p_obligation_id,
      'obligation_link_kind', p_obligation_link_kind
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);

  return query select
    true, v_case_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.apply_household_split(
  uuid, uuid, bigint, uuid, uuid, text, text, uuid, text, text, uuid
) owner to cluvo_command_owner;
revoke execute on function internal.apply_household_split(
  uuid, uuid, bigint, uuid, uuid, text, text, uuid, text, text, uuid
) from public, anon, service_role;
grant execute on function internal.apply_household_split(
  uuid, uuid, bigint, uuid, uuid, text, text, uuid, text, text, uuid
) to authenticated;

create or replace function api.apply_household_split(
  p_tenant_id uuid,
  p_source_household_id uuid,
  p_expected_source_version bigint,
  p_shared_child_person_id uuid,
  p_destination_parent_person_id uuid,
  p_destination_label text,
  p_destination_intake_code_hash_hex text,
  p_obligation_id uuid,
  p_obligation_link_kind text,
  p_decision_reason text,
  p_idempotency_key uuid
)
returns table (
  ok boolean,
  resource_id uuid,
  version bigint,
  event_ids uuid[],
  result jsonb
)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.apply_household_split(
    p_tenant_id, p_source_household_id, p_expected_source_version,
    p_shared_child_person_id, p_destination_parent_person_id,
    p_destination_label, p_destination_intake_code_hash_hex,
    p_obligation_id, p_obligation_link_kind, p_decision_reason,
    p_idempotency_key
  );
$function$;

revoke execute on function api.apply_household_split(
  uuid, uuid, bigint, uuid, uuid, text, text, uuid, text, text, uuid
) from public, anon, service_role;
grant execute on function api.apply_household_split(
  uuid, uuid, bigint, uuid, uuid, text, text, uuid, text, text, uuid
) to authenticated;

-- Split decisions contain family links and the committee's motivation.  Keep
-- the base table private and expose only a source-household-scoped readback to
-- actors who still hold the review capability used to apply the decision.
create or replace function internal.read_household_split_decisions(
  p_tenant_id uuid,
  p_source_household_id uuid
)
returns table (
  decision_id uuid,
  destination_household_id uuid,
  shared_child_person_id uuid,
  destination_parent_person_id uuid,
  obligation_id uuid,
  obligation_link_kind text,
  status text,
  decision_reason text,
  decided_by_auth_user_id uuid,
  decided_at timestamptz,
  version bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if internal.current_actor_uid() is null
    or p_tenant_id is null
    or p_source_household_id is null
    or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id,
      'household.review',
      'household',
      p_source_household_id
    )
  then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    change_case.id,
    change_case.destination_household_id,
    change_case.shared_child_person_id,
    change_case.destination_parent_person_id,
    change_case.obligation_id,
    change_case.obligation_link_kind,
    change_case.status,
    change_case.decision_reason,
    change_case.decided_by_auth_user_id,
    change_case.decided_at,
    change_case.version
  from app.household_change_cases as change_case
  where change_case.tenant_id = p_tenant_id
    and change_case.source_household_id = p_source_household_id
    and change_case.kind = 'split'
  order by change_case.decided_at, change_case.id;
end;
$function$;

alter function internal.read_household_split_decisions(uuid, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.read_household_split_decisions(uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.read_household_split_decisions(uuid, uuid)
  to authenticated;

create or replace function api.read_household_split_decisions(
  p_tenant_id uuid,
  p_source_household_id uuid
)
returns table (
  decision_id uuid,
  destination_household_id uuid,
  shared_child_person_id uuid,
  destination_parent_person_id uuid,
  obligation_id uuid,
  obligation_link_kind text,
  status text,
  decision_reason text,
  decided_by_auth_user_id uuid,
  decided_at timestamptz,
  version bigint
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from internal.read_household_split_decisions(
    p_tenant_id,
    p_source_household_id
  );
$function$;

revoke execute on function api.read_household_split_decisions(uuid, uuid)
  from public, anon, service_role;
grant execute on function api.read_household_split_decisions(uuid, uuid)
  to authenticated;

-- The Storage service owns these relations. On a normal Supabase project they
-- are present before application migrations run. The guard keeps the core SQL
-- testable in a database-only container and emits a visible warning instead of
-- pretending Storage was verified there.
do $storage$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise warning 'Supabase Storage relations are absent; private bucket policies were not installed in this database-only run';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'cluvo-private', 'cluvo-private', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'text/plain']::text[]
  )
  on conflict (id) do update set
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists cluvo_private_read on storage.objects';
  execute 'drop policy if exists cluvo_private_insert on storage.objects';
  execute 'drop policy if exists cluvo_private_update on storage.objects';
  execute 'drop policy if exists cluvo_private_delete on storage.objects';

  execute $policy$
    create policy cluvo_private_read on storage.objects
    for select to authenticated
    using (
      bucket_id = 'cluvo-private'
      and internal.can_access_private_object(name, false)
    )
  $policy$;
  execute $policy$
    create policy cluvo_private_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'cluvo-private'
      and internal.can_access_private_object(name, true)
    )
  $policy$;
  execute $policy$
    create policy cluvo_private_update on storage.objects
    for update to authenticated
    using (
      bucket_id = 'cluvo-private'
      and internal.can_access_private_object(name, true)
    )
    with check (
      bucket_id = 'cluvo-private'
      and internal.can_access_private_object(name, true)
    )
  $policy$;
  execute $policy$
    create policy cluvo_private_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'cluvo-private'
      and internal.can_access_private_object(name, true)
    )
  $policy$;
end
$storage$;

revoke execute on all functions in schema api from public, anon, service_role;
revoke execute on all functions in schema internal from public, anon, service_role;
