-- A29: auditable telephone assistance on behalf of a member.
--
-- The service record is append-only. A correction never rewrites the original
-- telephone record and an optional dispute transition is constrained to the
-- single, explicitly linked dispute.

insert into app.permissions (permission_key, description) values
  ('member.assist_by_phone', 'Record a telephone action on behalf of a member'),
  ('hour_dispute.resolve_by_phone', 'Resolve a reviewed hour dispute received by telephone')
on conflict (permission_key) do nothing;

create table app.assisted_member_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  actor_auth_user_id uuid not null,
  subject_person_id uuid not null,
  source_channel text not null default 'telephone'
    check (source_channel = 'telephone'),
  action_kind text not null
    check (action_kind in ('booking', 'notification', 'correction_request', 'record_correction')),
  resource_kind text not null
    check (resource_kind in ('person', 'booking', 'hour_dispute')),
  resource_id uuid not null,
  reason text not null check (nullif(btrim(reason), '') is not null),
  effect jsonb not null
    check (jsonb_typeof(effect) = 'object' and effect <> '{}'::jsonb),
  corrects_action_id uuid,
  idempotency_key uuid not null,
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, actor_auth_user_id, idempotency_key),
  foreign key (tenant_id) references app.tenants(id) on delete restrict,
  foreign key (tenant_id, subject_person_id)
    references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  foreign key (tenant_id, corrects_action_id)
    references app.assisted_member_actions(tenant_id, id) on delete restrict,
  check (
    (action_kind = 'record_correction' and corrects_action_id is not null)
    or (action_kind <> 'record_correction' and corrects_action_id is null)
  )
);

create unique index assisted_member_actions_single_correction_uq
  on app.assisted_member_actions (tenant_id, corrects_action_id)
  where corrects_action_id is not null;

create index assisted_member_actions_subject_history_idx
  on app.assisted_member_actions (tenant_id, subject_person_id, occurred_at, id);

grant select, insert, update on app.assisted_member_actions to cluvo_command_owner;
grant update (state, updated_at, version) on app.hour_disputes
  to cluvo_command_owner;

alter table app.assisted_member_actions enable row level security;
alter table app.assisted_member_actions force row level security;

create policy command_owner_select on app.assisted_member_actions
  for select to cluvo_command_owner using (true);
create policy command_owner_insert on app.assisted_member_actions
  for insert to cluvo_command_owner with check (true);
create policy command_owner_update on app.assisted_member_actions
  for update to cluvo_command_owner using (true) with check (true);
create policy command_owner_hour_dispute_update on app.hour_disputes
  for update to cluvo_command_owner using (true) with check (true);

create policy visible_assisted_member_actions on app.assisted_member_actions
  for select to authenticated
  using (
    (select internal.is_self_person(tenant_id, subject_person_id))
    or (select internal.has_permission(
      tenant_id, 'member.assist_by_phone', 'tenant', tenant_id
    ))
  );

grant select on app.assisted_member_actions to authenticated;

create trigger assisted_member_actions_immutable
before update or delete on app.assisted_member_actions
for each row execute function internal.reject_immutable_change();

-- Future tenant role rows receive the permission through this trigger; the
-- statement following it backfills roles that already exist.
create or replace function internal.seed_assisted_member_action_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into app.role_permissions (tenant_id, role_id, permission_key)
  select new.tenant_id, new.id, mapping.permission_key
  from (
    values
      ('volunteer_coordinator', 'member.assist_by_phone'),
      ('volunteer_committee', 'member.assist_by_phone'),
      ('volunteer_committee', 'hour_dispute.resolve_by_phone')
  ) as mapping(role_key, permission_key)
  where mapping.role_key = new.role_key
  on conflict (tenant_id, role_id, permission_key) do nothing;
  return new;
end;
$function$;

alter function internal.seed_assisted_member_action_permissions()
  owner to cluvo_command_owner;
revoke execute on function internal.seed_assisted_member_action_permissions()
  from public, anon, authenticated, service_role;

create trigger permission_roles_seed_assisted_member_actions
after insert on app.permission_roles
for each row execute function internal.seed_assisted_member_action_permissions();

insert into app.role_permissions (tenant_id, role_id, permission_key)
select role_row.tenant_id, role_row.id, mapping.permission_key
from app.permission_roles as role_row
join (
  values
    ('volunteer_coordinator', 'member.assist_by_phone'),
    ('volunteer_committee', 'member.assist_by_phone'),
    ('volunteer_committee', 'hour_dispute.resolve_by_phone')
) as mapping(role_key, permission_key)
  on mapping.role_key = role_row.role_key
on conflict (tenant_id, role_id, permission_key) do nothing;

create or replace function internal.record_assisted_member_action(
  p_tenant_id uuid,
  p_subject_person_id uuid,
  p_action_kind text,
  p_resource_kind text,
  p_resource_id uuid,
  p_reason text,
  p_effect jsonb,
  p_corrects_action_id uuid,
  p_close_hour_dispute boolean,
  p_expected_dispute_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_subject app.persons%rowtype;
  v_booking app.bookings%rowtype;
  v_dispute app.hour_disputes%rowtype;
  v_ledger app.hour_ledger_entries%rowtype;
  v_bound_booking_id uuid;
  v_original app.assisted_member_actions%rowtype;
  v_action_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_effect jsonb;
  v_result jsonb;
begin
  if v_actor is null
    or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'member.assist_by_phone', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_subject_person_id is null
    or p_resource_id is null
    or p_action_kind not in ('booking', 'notification', 'correction_request', 'record_correction')
    or p_resource_kind not in ('person', 'booking', 'hour_dispute')
    or nullif(btrim(p_reason), '') is null
    or p_effect is null
    or jsonb_typeof(p_effect) <> 'object'
    or p_effect = '{}'::jsonb
    or p_idempotency_key is null
    or (p_action_kind = 'record_correction') <> (p_corrects_action_id is not null)
    or coalesce(p_close_hour_dispute, false) and (
      p_action_kind <> 'record_correction'
      or p_resource_kind <> 'hour_dispute'
      or p_expected_dispute_version is null
    )
    or not coalesce(p_close_hour_dispute, false)
      and p_expected_dispute_version is not null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'record_assisted_member_action',
    p_idempotency_key,
    jsonb_build_object(
      'subject_person_id', p_subject_person_id,
      'action_kind', p_action_kind,
      'resource_kind', p_resource_kind,
      'resource_id', p_resource_id,
      'reason', btrim(p_reason),
      'effect', p_effect,
      'corrects_action_id', p_corrects_action_id,
      'close_hour_dispute', coalesce(p_close_hour_dispute, false),
      'expected_dispute_version', p_expected_dispute_version
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid
        from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select person_row.* into v_subject
  from app.persons as person_row
  where person_row.tenant_id = p_tenant_id
    and person_row.id = p_subject_person_id;
  if not found or v_subject.status <> 'active' then
    raise exception using errcode = 'P0002', message = 'SUBJECT_NOT_FOUND';
  end if;

  if p_resource_kind = 'person' then
    if p_resource_id <> p_subject_person_id then
      raise exception using errcode = '42501', message = 'RESOURCE_SUBJECT_MISMATCH';
    end if;
  elsif p_resource_kind = 'booking' then
    select booking.* into v_booking
    from app.bookings as booking
    where booking.tenant_id = p_tenant_id and booking.id = p_resource_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
    end if;
    if v_booking.executor_person_id <> p_subject_person_id then
      raise exception using errcode = '42501', message = 'RESOURCE_SUBJECT_MISMATCH';
    end if;
    if p_action_kind = 'booking' and v_booking.booked_by_auth_user_id <> v_actor then
      raise exception using errcode = '42501', message = 'BOOKING_ACTOR_MISMATCH';
    end if;
  else
    select dispute.* into v_dispute
    from app.hour_disputes as dispute
    where dispute.tenant_id = p_tenant_id and dispute.id = p_resource_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
    end if;

    if v_dispute.ledger_entry_id is not null then
      select ledger.* into v_ledger
      from app.hour_ledger_entries as ledger
      where ledger.tenant_id = p_tenant_id
        and ledger.id = v_dispute.ledger_entry_id;
      if not found
        or v_ledger.obligation_id <> v_dispute.obligation_id
        or (
          v_dispute.booking_id is not null
          and v_ledger.booking_id is distinct from v_dispute.booking_id
        ) then
        raise exception using errcode = '55000', message = 'DISPUTE_RESOURCE_MISMATCH';
      end if;
    end if;

    v_bound_booking_id := coalesce(v_dispute.booking_id, v_ledger.booking_id);
    if v_bound_booking_id is not null then
      select booking.* into v_booking
      from app.bookings as booking
      where booking.tenant_id = p_tenant_id
        and booking.id = v_bound_booking_id;
      if not found
        or v_booking.obligation_id <> v_dispute.obligation_id then
        raise exception using errcode = '55000', message = 'DISPUTE_RESOURCE_MISMATCH';
      end if;
      if v_booking.executor_person_id <> p_subject_person_id then
        raise exception using errcode = '42501', message = 'RESOURCE_SUBJECT_MISMATCH';
      end if;
    elsif not exists (
        select 1
        from app.obligations as obligation
        join app.household_person_links as person_link
          on person_link.tenant_id = obligation.tenant_id
         and person_link.household_id = obligation.assessed_household_id
         and person_link.person_id = p_subject_person_id
         and person_link.starts_at <= statement_timestamp()
         and (person_link.ends_at is null or person_link.ends_at > statement_timestamp())
        where obligation.tenant_id = p_tenant_id
          and obligation.id = v_dispute.obligation_id
      ) then
      raise exception using errcode = '42501', message = 'RESOURCE_SUBJECT_MISMATCH';
    end if;
  end if;

  if p_action_kind = 'booking' and p_resource_kind <> 'booking' then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  if p_action_kind = 'correction_request' and p_resource_kind <> 'hour_dispute' then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  if p_corrects_action_id is not null then
    select action_row.* into v_original
    from app.assisted_member_actions as action_row
    where action_row.tenant_id = p_tenant_id
      and action_row.id = p_corrects_action_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'ORIGINAL_ACTION_NOT_FOUND';
    end if;
    if v_original.subject_person_id <> p_subject_person_id then
      raise exception using errcode = '42501', message = 'CORRECTION_SUBJECT_MISMATCH';
    end if;
    if v_original.resource_kind <> p_resource_kind
      or v_original.resource_id <> p_resource_id then
      raise exception using errcode = '42501', message = 'CORRECTION_RESOURCE_MISMATCH';
    end if;
    if v_original.action_kind = 'record_correction' then
      raise exception using errcode = '22023', message = 'CORRECTION_CHAIN_NOT_ALLOWED';
    end if;
    if exists (
      select 1
      from app.assisted_member_actions as correction
      where correction.tenant_id = p_tenant_id
        and correction.corrects_action_id = p_corrects_action_id
    ) then
      raise exception using errcode = 'P0001', message = 'ALREADY_CORRECTED';
    end if;
    if p_close_hour_dispute and (
      v_original.action_kind <> 'correction_request'
      or v_original.resource_kind <> 'hour_dispute'
      or v_original.resource_id <> p_resource_id
    ) then
      raise exception using errcode = '22023', message = 'DISPUTE_CORRECTION_MISMATCH';
    end if;
  end if;

  v_effect := case
    when p_action_kind = 'booking' then p_effect || jsonb_build_object(
      'booking_state', v_booking.state,
      'booking_version', v_booking.version,
      'position_id', v_booking.position_id,
      'obligation_id', v_booking.obligation_id
    )
    else p_effect
  end;
  if coalesce(p_close_hour_dispute, false) then
    if not internal.has_permission(
      p_tenant_id, 'hour_dispute.resolve_by_phone', 'tenant', p_tenant_id
    ) then
      raise exception using errcode = '42501', message = 'DISPUTE_RESOLUTION_FORBIDDEN';
    end if;
    if v_dispute.version <> p_expected_dispute_version then
      raise exception using errcode = '40001', message = 'STALE_VERSION';
    end if;
    if v_dispute.state not in ('open', 'in_review') then
      raise exception using errcode = 'P0001', message = 'DISPUTE_NOT_OPEN';
    end if;
    update app.hour_disputes as dispute
    set state = 'resolved',
        updated_at = statement_timestamp(),
        version = dispute.version + 1
    where dispute.tenant_id = p_tenant_id and dispute.id = p_resource_id;
    v_effect := p_effect || jsonb_build_object(
      'dispute_previous_state', v_dispute.state,
      'dispute_state', 'resolved',
      'dispute_version', v_dispute.version + 1
    );
  end if;

  insert into app.assisted_member_actions (
    id, tenant_id, actor_auth_user_id, subject_person_id, action_kind,
    resource_kind, resource_id, reason, effect, corrects_action_id,
    idempotency_key
  ) values (
    v_action_id, p_tenant_id, v_actor, p_subject_person_id, p_action_kind,
    p_resource_kind, p_resource_id, btrim(p_reason), v_effect,
    p_corrects_action_id, p_idempotency_key
  );

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, reason_code,
    idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, p_subject_person_id,
    'member.assisted_by_phone.' || p_action_kind,
    'assisted_member_action', v_action_id, 'tenant', p_tenant_id,
    'telephone_request', p_idempotency_key,
    jsonb_strip_nulls(jsonb_build_object(
      'resource_kind', p_resource_kind,
      'resource_id', p_resource_id,
      'corrects_action_id', p_corrects_action_id,
      'closed_hour_dispute', coalesce(p_close_hour_dispute, false)
    ))
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'assisted_member_action', v_action_id, 1,
    'member.assisted_by_phone.' || p_action_kind,
    jsonb_build_object(
      'subject_person_id', p_subject_person_id,
      'resource_kind', p_resource_kind,
      'resource_id', p_resource_id
    )
  );

  v_result := jsonb_build_object(
    'resource_id', v_action_id,
    'version', 1,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object(
      'action_kind', p_action_kind,
      'subject_person_id', p_subject_person_id,
      'resource_kind', p_resource_kind,
      'linked_resource_id', p_resource_id,
      'effect', v_effect
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_action_id, 1::bigint, array[v_event_id], v_result -> 'result';
end;
$function$;

alter function internal.record_assisted_member_action(
  uuid, uuid, text, text, uuid, text, jsonb, uuid, boolean, bigint, uuid
) owner to cluvo_command_owner;
revoke execute on function internal.record_assisted_member_action(
  uuid, uuid, text, text, uuid, text, jsonb, uuid, boolean, bigint, uuid
) from public, anon, service_role;
grant execute on function internal.record_assisted_member_action(
  uuid, uuid, text, text, uuid, text, jsonb, uuid, boolean, bigint, uuid
) to authenticated;

create or replace function api.record_assisted_member_action(
  p_tenant_id uuid,
  p_subject_person_id uuid,
  p_action_kind text,
  p_resource_kind text,
  p_resource_id uuid,
  p_reason text,
  p_effect jsonb,
  p_corrects_action_id uuid,
  p_close_hour_dispute boolean,
  p_expected_dispute_version bigint,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.record_assisted_member_action(
    p_tenant_id, p_subject_person_id, p_action_kind, p_resource_kind,
    p_resource_id, p_reason, p_effect, p_corrects_action_id,
    p_close_hour_dispute, p_expected_dispute_version, p_idempotency_key
  );
$function$;

revoke execute on function api.record_assisted_member_action(
  uuid, uuid, text, text, uuid, text, jsonb, uuid, boolean, bigint, uuid
) from public, anon, service_role;
grant execute on function api.record_assisted_member_action(
  uuid, uuid, text, text, uuid, text, jsonb, uuid, boolean, bigint, uuid
) to authenticated;

-- Booking by telephone is one transaction: the normal booking invariants and
-- explicit acting delegation still apply, while the service history captures
-- the factual operator and reason before the transaction can commit.
create or replace function internal.assisted_book_shift_by_phone(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_position_id uuid,
  p_executor_person_id uuid,
  p_obligation_id uuid,
  p_expected_shift_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select internal.current_actor_uid());
  v_claim record;
  v_booking record;
  v_action record;
  v_booking_idempotency_key uuid := gen_random_uuid();
  v_event_ids uuid[];
  v_result jsonb;
begin
  if v_actor is null
    or not internal.is_active_member(p_tenant_id)
    or not internal.has_permission(
      p_tenant_id, 'member.assist_by_phone', 'tenant', p_tenant_id
    ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if nullif(btrim(p_reason), '') is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;

  select * into v_claim
  from internal.claim_idempotency(
    p_tenant_id,
    'assisted_book_shift_by_phone',
    p_idempotency_key,
    jsonb_build_object(
      'shift_id', p_shift_id,
      'position_id', p_position_id,
      'executor_person_id', p_executor_person_id,
      'obligation_id', p_obligation_id,
      'expected_shift_version', p_expected_shift_version,
      'reason', btrim(p_reason)
    )
  );
  if v_claim.replay_result is not null then
    return query select
      true,
      (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid
        from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;

  select * into v_booking
  from internal.book_shift(
    p_tenant_id, p_shift_id, p_position_id, p_executor_person_id,
    -- Keep the nested booking command's idempotency namespace isolated from
    -- caller-supplied online booking keys; the outer command owns retries.
    p_obligation_id, p_expected_shift_version, v_booking_idempotency_key
  );

  select * into v_action
  from internal.record_assisted_member_action(
    p_tenant_id, p_executor_person_id, 'booking', 'booking',
    v_booking.resource_id, btrim(p_reason),
    jsonb_build_object('command', 'assisted_book_shift_by_phone'),
    null, false, null, p_idempotency_key
  );

  v_event_ids := coalesce(v_booking.event_ids, array[]::uuid[])
    || coalesce(v_action.event_ids, array[]::uuid[]);
  v_result := jsonb_build_object(
    'resource_id', v_booking.resource_id,
    'version', v_booking.version,
    'event_ids', to_jsonb(v_event_ids),
    'result', jsonb_build_object(
      'booking', v_booking.result,
      'assisted_action_id', v_action.resource_id,
      'subject_person_id', p_executor_person_id,
      'reason_recorded', true
    )
  );
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select
    true, v_booking.resource_id, v_booking.version, v_event_ids,
    v_result -> 'result';
end;
$function$;

alter function internal.assisted_book_shift_by_phone(
  uuid, uuid, uuid, uuid, uuid, bigint, text, uuid
) owner to cluvo_command_owner;
revoke execute on function internal.assisted_book_shift_by_phone(
  uuid, uuid, uuid, uuid, uuid, bigint, text, uuid
) from public, anon, service_role;
grant execute on function internal.assisted_book_shift_by_phone(
  uuid, uuid, uuid, uuid, uuid, bigint, text, uuid
) to authenticated;

create or replace function api.assisted_book_shift_by_phone(
  p_tenant_id uuid,
  p_shift_id uuid,
  p_position_id uuid,
  p_executor_person_id uuid,
  p_obligation_id uuid,
  p_expected_shift_version bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql
security invoker
set search_path = ''
as $function$
  select * from internal.assisted_book_shift_by_phone(
    p_tenant_id, p_shift_id, p_position_id, p_executor_person_id,
    p_obligation_id, p_expected_shift_version, p_reason, p_idempotency_key
  );
$function$;

revoke execute on function api.assisted_book_shift_by_phone(
  uuid, uuid, uuid, uuid, uuid, bigint, text, uuid
) from public, anon, service_role;
grant execute on function api.assisted_book_shift_by_phone(
  uuid, uuid, uuid, uuid, uuid, bigint, text, uuid
) to authenticated;

create view api.assisted_member_action_history
with (security_invoker = true)
as
select
  action_row.tenant_id,
  action_row.id as action_id,
  action_row.actor_auth_user_id,
  action_row.subject_person_id,
  action_row.source_channel,
  action_row.action_kind,
  action_row.resource_kind,
  action_row.resource_id,
  action_row.reason,
  action_row.effect,
  action_row.corrects_action_id,
  action_row.occurred_at
from app.assisted_member_actions as action_row;

revoke all on api.assisted_member_action_history
  from public, anon, authenticated, service_role;
grant select on api.assisted_member_action_history to authenticated;

comment on view api.assisted_member_action_history is
  'Append-only A29 telephone assistance history; RLS exposes it only to the subject or an authorized functionary.';
