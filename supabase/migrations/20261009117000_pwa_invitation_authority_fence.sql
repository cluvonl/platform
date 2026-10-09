begin;

-- Keep the mobile command's idempotency fence and delegate to the same
-- canonical author checks before and after the household lock as the web API.
-- CREATE OR REPLACE preserves the existing signature, owner and ACL.
create or replace function internal.pwa_create_household_invitation(
  p_tenant_id uuid, p_household_id uuid, p_given_name text, p_family_name text,
  p_email text, p_token_hash_hex text, p_can_view_progress boolean, p_can_book_for boolean,
  p_expected_household_version bigint, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
begin
  if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'pwa:' || p_tenant_id::text || ':' || internal.current_actor_uid()::text || ':' || p_idempotency_key::text, 0));
  return query select * from internal.create_household_invitation_locked(
    p_tenant_id, p_household_id, p_given_name, p_family_name, p_email, p_token_hash_hex,
    p_can_view_progress, p_can_book_for, p_expected_household_version, p_idempotency_key);
end;
$function$;

commit;
