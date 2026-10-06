-- Contract after the verified v2 app expansion (9d9c365 and later).
-- Keep private kernel definitions for v2 delegation; retire direct callers.
-- Connected app rollback floor: 9d9c365261b28ef99ef1a8345c21ae9e818ed6a1.
-- App rollback does not undo this migration. No production gate is changed.
begin;

revoke all on function api.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  from public, anon, authenticated, service_role;
revoke all on function internal.create_household_invitation(uuid, uuid, text, text, text, text, boolean, boolean, uuid)
  from public, anon, authenticated, service_role;
revoke all on function api.mark_household_invitation_delivery(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function internal.mark_household_invitation_delivery(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function api.accept_household_invitation(text)
  from public, anon, authenticated, service_role;
revoke all on function internal.accept_household_invitation(text)
  from public, anon, authenticated, service_role;
revoke all on function api.household_invitation_delivery(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function internal.household_invitation_delivery(uuid, uuid)
  from public, anon, authenticated, service_role;

-- The expanded creation kernel checked authority before waiting. Acquire the
-- dossier lock in a guarded entrypoint and recheck current authority after it.
-- Retire the old direct entry, while preserving the public v2 app signature.
create function internal.create_household_invitation_locked(
  p_tenant_id uuid, p_household_id uuid, p_given_name text, p_family_name text,
  p_email text, p_token_hash_hex text, p_can_view_progress boolean, p_can_book_for boolean,
  p_expected_household_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
begin
  if not internal.actor_has_verified_email()
    or not internal.invitation_author_is_active(p_tenant_id, p_household_id, internal.current_actor_uid()) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  perform 1 from app.households where tenant_id = p_tenant_id and id = p_household_id for update;
  if not internal.actor_has_verified_email()
    or not internal.invitation_author_is_active(p_tenant_id, p_household_id, internal.current_actor_uid()) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return query select * from internal.create_household_invitation_v2(
    p_tenant_id, p_household_id, p_given_name, p_family_name, p_email,
    p_token_hash_hex, p_can_view_progress, p_can_book_for, p_expected_household_version, p_idempotency_key);
end;
$function$;
alter function internal.create_household_invitation_locked(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  owner to cluvo_command_owner;
revoke all on function internal.create_household_invitation_locked(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  from public, anon, authenticated, service_role;
grant execute on function internal.create_household_invitation_locked(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  to authenticated;
revoke all on function internal.create_household_invitation_v2(uuid, uuid, text, text, text, text, boolean, boolean, bigint, uuid)
  from public, anon, authenticated, service_role;
create or replace function api.create_household_invitation_v2(
  p_tenant_id uuid, p_household_id uuid, p_given_name text, p_family_name text,
  p_email text, p_token_hash_hex text, p_can_view_progress boolean, p_can_book_for boolean,
  p_expected_household_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$
  select * from internal.create_household_invitation_locked(
    p_tenant_id, p_household_id, p_given_name, p_family_name, p_email,
    p_token_hash_hex, p_can_view_progress, p_can_book_for, p_expected_household_version, p_idempotency_key);
$function$;

commit;
