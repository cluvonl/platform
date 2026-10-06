-- Complete the intake reconfirmation items created by controlled season rollover.
-- Preserve immutable answers and record the exact reviewed revision separately.
begin;

alter table app.season_reconfirmation_items add constraint reconfirmation_item_source_key
  unique (tenant_id, id, source_resource_id);

create table app.intake_reconfirmation_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  reconfirmation_item_id uuid not null,
  profile_id uuid not null,
  answer_revision integer not null check (answer_revision > 0),
  profile_version_before bigint not null check (profile_version_before > 0),
  item_version_before bigint not null check (item_version_before > 0),
  actor_auth_user_id uuid not null,
  represented_person_id uuid,
  assistance_reason text,
  idempotency_key uuid not null,
  confirmed_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, id),
  unique (tenant_id, reconfirmation_item_id),
  foreign key (tenant_id, reconfirmation_item_id, profile_id) references app.season_reconfirmation_items(tenant_id, id, source_resource_id) on delete restrict,
  foreign key (tenant_id, profile_id, answer_revision) references app.intake_answers_versions(tenant_id, profile_id, revision) on delete restrict,
  foreign key (tenant_id, represented_person_id) references app.persons(tenant_id, id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check ((represented_person_id is null) = (assistance_reason is null)),
  check (assistance_reason is null or (char_length(btrim(assistance_reason)) between 1 and 2000))
);
alter table app.intake_reconfirmation_receipts enable row level security;
alter table app.intake_reconfirmation_receipts force row level security;
revoke all on app.intake_reconfirmation_receipts from public, anon, authenticated, service_role;
grant select on app.intake_reconfirmation_receipts to authenticated;
grant select, insert on app.intake_reconfirmation_receipts to cluvo_command_owner;
create trigger immutable_intake_reconfirmation_receipts before update or delete on app.intake_reconfirmation_receipts
  for each row execute function internal.reject_immutable_change();
create policy command_owner_select on app.intake_reconfirmation_receipts for select to cluvo_command_owner using (true);
create policy command_owner_insert on app.intake_reconfirmation_receipts for insert to cluvo_command_owner with check (true);
create function internal.can_read_intake_reconfirmation(p_tenant_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$ select internal.actor_has_verified_email() and internal.can_edit_intake(p_tenant_id, p_profile_id); $function$;
alter function internal.can_read_intake_reconfirmation(uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.can_read_intake_reconfirmation(uuid, uuid) from public, anon, service_role;
grant execute on function internal.can_read_intake_reconfirmation(uuid, uuid) to authenticated;
create policy editable_intake_receipts on app.intake_reconfirmation_receipts for select to authenticated
  using (internal.can_read_intake_reconfirmation(tenant_id, profile_id));

create function internal.get_intake_reconfirmations(p_tenant_id uuid, p_profile_id uuid)
returns table (item_id uuid, item_version bigint, profile_id uuid, profile_version bigint,
  person_id uuid, is_self boolean, season_name text, season_status text, state text,
  confirmed_at timestamptz, confirmed_answer_revision integer, can_confirm boolean)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if not internal.actor_has_verified_email() or not internal.can_edit_intake(p_tenant_id, p_profile_id) then
    return;
  end if;
  return query select item.id, item.version, profile.id, profile.version, profile.person_id,
    internal.is_self_person(p_tenant_id, profile.person_id), season.name, season.status,
    item.state, receipt.confirmed_at, receipt.answer_revision,
    item.state = 'open' and rollover.state = 'completed' and season.status in ('preparing','active')
      and profile.status in ('submitted','confirmed') and profile.current_revision > 0
    from app.season_reconfirmation_items as item
    join app.intake_profiles as profile on profile.tenant_id = item.tenant_id
      and profile.id = item.source_resource_id and profile.person_id = item.person_id
    join app.seasons as season on season.tenant_id = item.tenant_id and season.id = item.target_season_id
    join app.rollover_runs as rollover on rollover.tenant_id = item.tenant_id and rollover.id = item.rollover_run_id
    left join app.intake_reconfirmation_receipts as receipt on receipt.tenant_id = item.tenant_id and receipt.reconfirmation_item_id = item.id
    where item.tenant_id = p_tenant_id and item.subject_kind = 'intake' and profile.id = p_profile_id
    order by season.starts_on desc, item.id;
end;
$function$;
alter function internal.get_intake_reconfirmations(uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.get_intake_reconfirmations(uuid, uuid) from public, anon, service_role;
grant execute on function internal.get_intake_reconfirmations(uuid, uuid) to authenticated;
create function api.get_intake_reconfirmations(p_tenant_id uuid, p_profile_id uuid)
returns table (item_id uuid, item_version bigint, profile_id uuid, profile_version bigint,
  person_id uuid, is_self boolean, season_name text, season_status text, state text,
  confirmed_at timestamptz, confirmed_answer_revision integer, can_confirm boolean)
language sql stable security invoker set search_path = ''
as $function$ select * from internal.get_intake_reconfirmations(p_tenant_id, p_profile_id); $function$;
revoke all on function api.get_intake_reconfirmations(uuid, uuid) from public, anon, service_role;
grant execute on function api.get_intake_reconfirmations(uuid, uuid) to authenticated;

create function internal.confirm_intake_reconfirmation(
  p_tenant_id uuid, p_item_id uuid, p_expected_item_version bigint,
  p_expected_profile_version bigint, p_represented_person_id uuid,
  p_assistance_reason text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := internal.current_actor_uid();
  v_item app.season_reconfirmation_items%rowtype;
  v_profile app.intake_profiles%rowtype;
  v_season app.seasons%rowtype;
  v_rollover app.rollover_runs%rowtype;
  v_claim record;
  v_receipt_id uuid := gen_random_uuid();
  v_event_id uuid := gen_random_uuid();
  v_result jsonb;
begin
  if not internal.actor_has_verified_email() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_expected_item_version is null or p_expected_item_version < 1
    or p_expected_profile_version is null or p_expected_profile_version < 1
    or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  select * into v_item from app.season_reconfirmation_items
    where tenant_id = p_tenant_id and id = p_item_id and subject_kind = 'intake';
  if not found or not internal.can_edit_intake(p_tenant_id, v_item.source_resource_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  -- Serialize with close/rollover, then the current answer writer, then the item.
  select * into strict v_season from app.seasons
    where tenant_id = p_tenant_id and id = v_item.target_season_id for update;
  select * into strict v_rollover from app.rollover_runs
    where tenant_id = p_tenant_id and id = v_item.rollover_run_id;
  select * into v_profile from app.intake_profiles
    where tenant_id = p_tenant_id and id = v_item.source_resource_id for update;
  select * into strict v_item from app.season_reconfirmation_items
    where tenant_id = p_tenant_id and id = p_item_id for update;
  if v_profile.id is null or v_profile.person_id <> v_item.person_id
    or v_item.subject_kind <> 'intake' or v_item.source_resource_id <> v_profile.id
    or v_item.target_season_id <> v_season.id
    or v_item.rollover_run_id <> v_rollover.id
    or not internal.actor_has_verified_email()
    or not internal.can_edit_intake(p_tenant_id, v_profile.id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if internal.is_self_person(p_tenant_id, v_profile.person_id) then
    if p_represented_person_id is not null or p_assistance_reason is not null then
      raise exception using errcode = '22023', message = 'INVALID_REPRESENTATION';
    end if;
  elsif p_represented_person_id is distinct from v_profile.person_id
    or nullif(btrim(p_assistance_reason), '') is null or char_length(p_assistance_reason) > 2000 then
    raise exception using errcode = '42501', message = 'INVALID_REPRESENTATION';
  end if;
  select * into v_claim from internal.claim_idempotency(p_tenant_id, 'confirm_intake_reconfirmation', p_idempotency_key,
    jsonb_build_object('item_id', p_item_id, 'expected_item_version', p_expected_item_version,
      'expected_profile_version', p_expected_profile_version, 'represented_person_id', p_represented_person_id,
      'assistance_reason', p_assistance_reason));
  if v_claim.replay_result is not null then
    return query select true, (v_claim.replay_result ->> 'resource_id')::uuid,
      (v_claim.replay_result ->> 'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result -> 'event_ids')),
      v_claim.replay_result -> 'result';
    return;
  end if;
  if v_item.version <> p_expected_item_version or v_profile.version <> p_expected_profile_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if v_season.status not in ('preparing','active') then
    raise exception using errcode = '23514', message = 'SEASON_NOT_OPEN';
  end if;
  if v_rollover.state <> 'completed' then
    raise exception using errcode = '23514', message = 'ROLLOVER_SUPERSEDED';
  end if;
  if v_item.state <> 'open' then
    raise exception using errcode = '23514', message = 'RECONFIRMATION_ALREADY_RESOLVED';
  end if;
  if v_profile.status not in ('submitted','confirmed') or v_profile.current_revision < 1 then
    raise exception using errcode = '23514', message = 'INTAKE_NOT_SUBMITTED';
  end if;
  insert into app.intake_reconfirmation_receipts (
    id, tenant_id, reconfirmation_item_id, profile_id, answer_revision,
    profile_version_before, item_version_before, actor_auth_user_id,
    represented_person_id, assistance_reason, idempotency_key
  ) values (v_receipt_id, p_tenant_id, v_item.id, v_profile.id, v_profile.current_revision,
    v_profile.version, v_item.version, v_actor, p_represented_person_id, p_assistance_reason, p_idempotency_key);
  update app.intake_profiles set annual_confirmed_at = statement_timestamp(),
    updated_at = statement_timestamp(), version = app.intake_profiles.version + 1
    where tenant_id = p_tenant_id and id = v_profile.id returning * into v_profile;
  update app.season_reconfirmation_items set state = 'confirmed', confirmed_by_auth_user_id = v_actor,
    confirmed_at = statement_timestamp(), updated_at = statement_timestamp(), version = app.season_reconfirmation_items.version + 1
    where tenant_id = p_tenant_id and id = v_item.id returning * into v_item;
  insert into app.audit_events (tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, reason_code, idempotency_key, payload_minimal)
    values (p_tenant_id, v_actor, p_represented_person_id, 'intake.annually_reconfirmed',
      'intake_profile', v_profile.id, 'household', v_profile.household_context_id,
      case when p_represented_person_id is null then 'annual_reconfirmation' else 'assisted' end,
      p_idempotency_key, jsonb_build_object('item_id', v_item.id, 'answer_revision', v_profile.current_revision,
        'expected_item_version', p_expected_item_version, 'expected_profile_version', p_expected_profile_version));
  insert into app.domain_events (id, tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type, payload_minimal)
    values (v_event_id, p_tenant_id, 'intake_profile', v_profile.id, v_profile.version,
      'intake.annually_reconfirmed', jsonb_build_object('item_id', v_item.id, 'answer_revision', v_profile.current_revision));
  v_result := jsonb_build_object('resource_id', v_item.id, 'version', v_item.version,
    'event_ids', jsonb_build_array(v_event_id), 'result', jsonb_build_object('profile_version', v_profile.version,
      'answer_revision', v_profile.current_revision, 'confirmed_at', v_item.confirmed_at));
  perform internal.complete_idempotency(v_claim.record_id, v_result);
  return query select true, v_item.id, v_item.version, array[v_event_id], v_result -> 'result';
end;
$function$;
alter function internal.confirm_intake_reconfirmation(uuid, uuid, bigint, bigint, uuid, text, uuid) owner to cluvo_command_owner;
revoke all on function internal.confirm_intake_reconfirmation(uuid, uuid, bigint, bigint, uuid, text, uuid) from public, anon, service_role;
grant execute on function internal.confirm_intake_reconfirmation(uuid, uuid, bigint, bigint, uuid, text, uuid) to authenticated;
create function api.confirm_intake_reconfirmation(
  p_tenant_id uuid, p_item_id uuid, p_expected_item_version bigint,
  p_expected_profile_version bigint, p_represented_person_id uuid,
  p_assistance_reason text, p_idempotency_key uuid
)
returns table (ok boolean, resource_id uuid, version bigint, event_ids uuid[], result jsonb)
language sql security invoker set search_path = ''
as $function$ select * from internal.confirm_intake_reconfirmation(p_tenant_id, p_item_id,
  p_expected_item_version, p_expected_profile_version, p_represented_person_id, p_assistance_reason, p_idempotency_key); $function$;
revoke all on function api.confirm_intake_reconfirmation(uuid, uuid, bigint, bigint, uuid, text, uuid) from public, anon, service_role;
grant execute on function api.confirm_intake_reconfirmation(uuid, uuid, bigint, bigint, uuid, text, uuid) to authenticated;

commit;
