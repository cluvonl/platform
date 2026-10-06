-- W02 expand: revoke an unaccepted invitation without removing its history.
-- Dossier-first locking serializes cancellation with recipient acceptance.
begin;

create function internal.cancel_household_invitation(
  p_tenant_id uuid, p_invitation_id uuid, p_expected_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_invitation app.household_invitations%rowtype;
  v_household_version bigint;
  v_existing app.idempotency_records%rowtype;
  v_idempotency_id uuid;
  v_hash bytea;
  v_result jsonb;
  v_event uuid;
  v_events uuid[] := '{}'::uuid[];
begin
  if v_actor is null or not internal.actor_has_verified_email() or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_version is null or p_expected_version < 1 or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_INVITATION';
  end if;
  select * into v_invitation from app.household_invitations where tenant_id = p_tenant_id and id = p_invitation_id;
  if not found or not internal.invitation_author_is_active(p_tenant_id, v_invitation.household_id, v_actor)
    or (v_invitation.created_by_auth_user_id <> v_actor
      and not internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', v_invitation.household_id)) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select household.version into v_household_version from app.households as household
    where household.tenant_id = p_tenant_id and household.id = v_invitation.household_id for update;
  select * into v_invitation from app.household_invitations where tenant_id = p_tenant_id and id = p_invitation_id for update;
  if not internal.actor_has_verified_email() or not internal.is_active_member(p_tenant_id)
    or not internal.invitation_author_is_active(p_tenant_id, v_invitation.household_id, v_actor)
    or (v_invitation.created_by_auth_user_id <> v_actor
      and not internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', v_invitation.household_id)) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_hash := extensions.digest(convert_to(jsonb_build_object('invitation_id', p_invitation_id,
    'expected_version', p_expected_version)::text, 'UTF8'), 'sha256');
  insert into app.idempotency_records (tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status)
    values (p_tenant_id, v_actor, 'cancel_household_invitation', p_idempotency_key, v_hash, 'processing')
    on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing returning id into v_idempotency_id;
  if v_idempotency_id is null then
    select * into v_existing from app.idempotency_records where tenant_id = p_tenant_id and actor_auth_user_id = v_actor
      and operation = 'cancel_household_invitation' and idempotency_key = p_idempotency_key for update;
    if v_existing.request_hash <> v_hash then raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT'; end if;
    if v_existing.status <> 'completed' then raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS'; end if;
    return query select true, (v_existing.result_jsonb->>'resource_id')::uuid, (v_existing.result_jsonb->>'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_existing.result_jsonb->'event_ids')), v_existing.result_jsonb->'result';
    return;
  end if;
  if v_invitation.version <> p_expected_version then raise exception using errcode = '40001', message = 'STALE_VERSION'; end if;
  if v_invitation.delivery_status = 'accepted' then raise exception using errcode = '22023', message = 'INVITATION_ALREADY_ACCEPTED'; end if;
  if v_invitation.delivery_status <> 'cancelled' then
    update app.household_invitations as invitation
      set delivery_status = 'cancelled', cancelled_at = statement_timestamp(), version = invitation.version + 1
      where invitation.tenant_id = p_tenant_id and invitation.id = p_invitation_id;
    update app.households as household set version = household.version + 1, updated_at = statement_timestamp()
      where household.tenant_id = p_tenant_id and household.id = v_invitation.household_id;
    select * into v_invitation from app.household_invitations where tenant_id = p_tenant_id and id = p_invitation_id;
    v_event := gen_random_uuid(); v_events := array[v_event];
    insert into app.audit_events (tenant_id, actor_auth_user_id, action, resource_type, resource_id, scope_kind, scope_id, idempotency_key, payload_minimal)
      values (p_tenant_id, v_actor, 'household.invitation_cancelled', 'household_invitation', p_invitation_id,
        'household', v_invitation.household_id, p_idempotency_key,
        jsonb_build_object('expected_version', p_expected_version, 'version', v_invitation.version, 'household_version', v_household_version + 1));
    insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal)
      values (v_event, p_tenant_id, 'household_invitation', p_invitation_id, v_invitation.version,
        'household.invitation_cancelled', jsonb_build_object('household_id', v_invitation.household_id));
  end if;
  v_result := jsonb_build_object('resource_id', p_invitation_id, 'version', v_invitation.version, 'event_ids', to_jsonb(v_events),
    'result', jsonb_build_object('delivery_status', v_invitation.delivery_status));
  update app.idempotency_records set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp() where id = v_idempotency_id;
  return query select true, p_invitation_id, v_invitation.version, v_events, v_result->'result';
end;
$function$;
alter function internal.cancel_household_invitation(uuid, uuid, bigint, uuid) owner to cluvo_command_owner;
revoke all on function internal.cancel_household_invitation(uuid, uuid, bigint, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.cancel_household_invitation(uuid, uuid, bigint, uuid) to authenticated;
create function api.cancel_household_invitation(p_tenant_id uuid, p_invitation_id uuid, p_expected_version bigint, p_idempotency_key uuid)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$ select * from internal.cancel_household_invitation(p_tenant_id, p_invitation_id, p_expected_version, p_idempotency_key); $function$;
revoke all on function api.cancel_household_invitation(uuid, uuid, bigint, uuid) from public, anon, authenticated, service_role;
grant execute on function api.cancel_household_invitation(uuid, uuid, bigint, uuid) to authenticated;

-- Extend only the already authorized invitation rows and minimal history.
-- The earlier dossier signature remains compatible during app rollout.
create function internal.get_household_dossier_v2(p_tenant_id uuid, p_household_id uuid, p_season_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_dossier jsonb;
  v_invite boolean;
  v_review boolean;
  v_invitations jsonb;
  v_history jsonb;
begin
  v_dossier := internal.get_household_dossier(p_tenant_id, p_household_id, p_season_id);
  if v_dossier is null then return null; end if;
  v_invite := internal.actor_has_verified_email() and internal.invitation_author_is_active(p_tenant_id, p_household_id, internal.current_actor_uid());
  v_review := internal.has_permission(p_tenant_id, 'household.review', 'household', p_household_id);
  select coalesce(jsonb_agg(item.value || jsonb_build_object('version', invitation.version,
    'expired', invitation.expires_at <= statement_timestamp(),
    'can_cancel', v_invite and invitation.delivery_status not in ('accepted', 'cancelled')
      and (invitation.created_by_auth_user_id = internal.current_actor_uid()
        or internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', p_household_id)))
    order by invitation.created_at desc, invitation.id), '[]'::jsonb)
    into v_invitations from jsonb_array_elements(v_dossier->'invitations') as item(value)
    join app.household_invitations as invitation on invitation.tenant_id = p_tenant_id
      and invitation.household_id = p_household_id and invitation.id = (item.value->>'invitation_id')::uuid;
  select coalesce(jsonb_agg(value order by occurred_at desc, event_id), '[]'::jsonb) into v_history from (
    select * from (
      select item.value, (item.value->>'occurred_at')::timestamptz as occurred_at, (item.value->>'event_id')::uuid as event_id
        from jsonb_array_elements(v_dossier->'history') as item(value)
      union all
      select jsonb_build_object('event_id', event.id, 'action', event.action, 'occurred_at', event.occurred_at,
        'actor_is_self', event.actor_auth_user_id = internal.current_actor_uid()), event.occurred_at, event.id
        from app.audit_events as event where event.tenant_id = p_tenant_id and event.scope_kind = 'household'
          and event.scope_id = p_household_id and event.action = 'household.invitation_cancelled'
          and (event.actor_auth_user_id = internal.current_actor_uid() or v_review)
    ) as visible_history order by occurred_at desc, event_id limit 50
  ) as recent_history;
  return v_dossier || jsonb_build_object('invitations', v_invitations, 'history', v_history);
end;
$function$;
alter function internal.get_household_dossier_v2(uuid, uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.get_household_dossier_v2(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.get_household_dossier_v2(uuid, uuid, uuid) to authenticated;
create function api.get_household_dossier_v2(p_tenant_id uuid, p_household_id uuid, p_season_id uuid default null)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select internal.get_household_dossier_v2(p_tenant_id, p_household_id, p_season_id); $function$;
revoke all on function api.get_household_dossier_v2(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_household_dossier_v2(uuid, uuid, uuid) to authenticated;

commit;
