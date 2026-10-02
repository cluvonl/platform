-- Minimal, privacy-reduced read models for the real booking -> attendance ->
-- ledger chain. Mutations remain exclusively in the transaction commands from
-- the core migration; these functions never accept an actor from the client.

create or replace function internal.list_shift_market(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  shift_id uuid,
  shift_version bigint,
  position_id uuid,
  position_ordinal integer,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  credit_minutes integer,
  location_name text,
  available boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    shift_row.tenant_id,
    shift_row.id,
    shift_row.version,
    position.id,
    position.ordinal,
    shift_row.title,
    shift_row.starts_at,
    shift_row.ends_at,
    shift_row.credit_minutes,
    location.name,
    position.state = 'open'
      and shift_row.starts_at > statement_timestamp()
      and (shift_row.booking_opens_at is null or shift_row.booking_opens_at <= statement_timestamp())
      and (shift_row.booking_closes_at is null or shift_row.booking_closes_at > statement_timestamp())
      and not exists (
        select 1
        from app.bookings as booking
        where booking.tenant_id = position.tenant_id
          and booking.position_id = position.id
          and booking.state in (
            'booked', 'reconfirmation_required', 'transfer_pending',
            'performed_pending'
          )
      ) as available
  from app.shifts as shift_row
  join app.shift_positions as position
    on position.tenant_id = shift_row.tenant_id
   and position.shift_id = shift_row.id
  left join app.locations as location
    on location.tenant_id = shift_row.tenant_id
   and location.id = shift_row.location_id
  where shift_row.tenant_id = p_tenant_id
    and shift_row.state = 'published'
    and shift_row.starts_at > statement_timestamp()
  order by shift_row.starts_at, shift_row.id, position.ordinal;
end;
$function$;

alter function internal.list_shift_market(uuid) owner to cluvo_command_owner;
revoke execute on function internal.list_shift_market(uuid)
  from public, anon, service_role;
grant execute on function internal.list_shift_market(uuid) to authenticated;

create or replace function api.list_shift_market(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  shift_id uuid,
  shift_version bigint,
  position_id uuid,
  position_ordinal integer,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  credit_minutes integer,
  location_name text,
  available boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from internal.list_shift_market(p_tenant_id);
$function$;

revoke execute on function api.list_shift_market(uuid)
  from public, anon, service_role;
grant execute on function api.list_shift_market(uuid) to authenticated;

create or replace function internal.list_bookable_obligations(
  p_tenant_id uuid,
  p_person_id uuid
)
returns table (
  obligation_id uuid,
  household_id uuid,
  label text,
  valid_from timestamptz,
  valid_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not internal.is_active_member(p_tenant_id)
    or not internal.is_self_person(p_tenant_id, p_person_id)
  then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    obligation.id,
    obligation.assessed_household_id,
    household.label,
    executor_grant.valid_from,
    executor_grant.valid_until
  from app.executor_obligation_grants as executor_grant
  join app.obligations as obligation
    on obligation.tenant_id = executor_grant.tenant_id
   and obligation.id = executor_grant.obligation_id
  join app.households as household
    on household.tenant_id = obligation.tenant_id
   and household.id = obligation.assessed_household_id
  where executor_grant.tenant_id = p_tenant_id
    and executor_grant.person_id = p_person_id
    and executor_grant.revoked_at is null
    and executor_grant.valid_from <= statement_timestamp()
    and (executor_grant.valid_until is null or executor_grant.valid_until > statement_timestamp())
    and obligation.status in ('active', 'review_hold', 'fulfilled')
    and household.status <> 'archived'
  order by household.label, obligation.id;
end;
$function$;

alter function internal.list_bookable_obligations(uuid, uuid) owner to cluvo_command_owner;
revoke execute on function internal.list_bookable_obligations(uuid, uuid)
  from public, anon, service_role;
grant execute on function internal.list_bookable_obligations(uuid, uuid) to authenticated;

create or replace function api.list_bookable_obligations(
  p_tenant_id uuid,
  p_person_id uuid
)
returns table (
  obligation_id uuid,
  household_id uuid,
  label text,
  valid_from timestamptz,
  valid_until timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from internal.list_bookable_obligations(p_tenant_id, p_person_id);
$function$;

revoke execute on function api.list_bookable_obligations(uuid, uuid)
  from public, anon, service_role;
grant execute on function api.list_bookable_obligations(uuid, uuid) to authenticated;

create or replace function internal.list_attendance_queue(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  booking_id uuid,
  booking_version bigint,
  booking_state text,
  shift_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  credit_minutes integer,
  executor_display_name text,
  can_confirm boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select
    booking.tenant_id,
    booking.id,
    booking.version,
    booking.state,
    shift_row.title,
    booking.starts_at_snapshot,
    booking.ends_at_snapshot,
    booking.credit_minutes_snapshot,
    concat_ws(' ', person.given_name, person.family_name),
    booking.state in ('booked', 'performed_pending')
      and booking.current_attendance_decision_id is null
      and booking.ends_at_snapshot <= statement_timestamp()
  from app.bookings as booking
  join app.shift_positions as position
    on position.tenant_id = booking.tenant_id
   and position.id = booking.position_id
  join app.shifts as shift_row
    on shift_row.tenant_id = position.tenant_id
   and shift_row.id = position.shift_id
  join app.persons as person
    on person.tenant_id = booking.tenant_id
   and person.id = booking.executor_person_id
  where booking.tenant_id = p_tenant_id
    and booking.state in (
      'booked', 'reconfirmation_required', 'performed_pending',
      'confirmed', 'no_show'
    )
    and internal.has_permission(
      booking.tenant_id,
      'attendance.confirm',
      'committee',
      shift_row.committee_id
    )
  order by booking.ends_at_snapshot desc, booking.id;
end;
$function$;

alter function internal.list_attendance_queue(uuid) owner to cluvo_command_owner;
revoke execute on function internal.list_attendance_queue(uuid)
  from public, anon, service_role;
grant execute on function internal.list_attendance_queue(uuid) to authenticated;

create or replace function api.list_attendance_queue(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  booking_id uuid,
  booking_version bigint,
  booking_state text,
  shift_title text,
  starts_at timestamptz,
  ends_at timestamptz,
  credit_minutes integer,
  executor_display_name text,
  can_confirm boolean
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select * from internal.list_attendance_queue(p_tenant_id);
$function$;

revoke execute on function api.list_attendance_queue(uuid)
  from public, anon, service_role;
grant execute on function api.list_attendance_queue(uuid) to authenticated;

comment on function api.list_shift_market(uuid) is
  'Privacy-reduced published shift positions. Availability is advisory; api.book_shift is authoritative and transactional.';
comment on function api.list_bookable_obligations(uuid, uuid) is
  'Only the current actor self-person obligations with an active executor grant; exposes no progress or finance.';
comment on function api.list_attendance_queue(uuid) is
  'Minimal attendance queue filtered by the actor current committee-scoped attendance.confirm permission.';

revoke execute on all functions in schema api from public, anon, service_role;
revoke execute on all functions in schema internal from public, anon, service_role;
