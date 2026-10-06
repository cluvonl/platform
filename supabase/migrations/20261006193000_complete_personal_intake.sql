-- W02: extend the existing versioned intake command; retain legacy string
-- answers and its authorization, actor, idempotency and audit contract.
begin;

create or replace function internal.valid_intake_answers(p_answers jsonb)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_field record;
  v_item jsonb;
  v_text text;
  v_structured boolean := coalesce(p_answers -> 'schema_version' = '2'::jsonb, false);
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
    or octet_length(p_answers::text) > 20000 then return false; end if;
  for v_field in select key, value from jsonb_each(p_answers) loop
    if v_field.key = 'schema_version' then
      if not v_structured then return false; end if;
    elsif v_field.key in ('buddy_requested', 'reserve_willing') then
      if not v_structured or jsonb_typeof(v_field.value) <> 'boolean' then return false; end if;
    elsif v_field.key = 'desired_monthly_minutes' then
      if not v_structured then return false; end if;
      if v_field.value <> 'null'::jsonb then
        v_text := v_field.value #>> '{}';
        if jsonb_typeof(v_field.value) <> 'number' or v_text !~ '^[0-9]{1,6}$'
          or v_text::integer > 100000 then return false; end if;
      end if;
    elsif v_field.key in ('experience', 'practical_limitations') then
      if jsonb_typeof(v_field.value) <> 'string'
        or char_length(v_field.value #>> '{}') > 2000 then return false; end if;
    elsif v_field.key in ('preferences', 'skills', 'availability', 'unavailability', 'training_needs', 'fixed_role_interest') then
      if jsonb_typeof(v_field.value) = 'string' then
        if char_length(v_field.value #>> '{}') > 2000 then return false; end if;
      elsif jsonb_typeof(v_field.value) = 'array' then
        if not v_structured or jsonb_array_length(v_field.value) > 60
          or (select count(distinct item) from jsonb_array_elements(v_field.value) as items(item)) <> jsonb_array_length(v_field.value)
          then return false; end if;
        for v_item in select value from jsonb_array_elements(v_field.value) loop
          v_text := v_item #>> '{}';
          if jsonb_typeof(v_item) <> 'string' or nullif(btrim(v_text), '') is null
            or char_length(v_text) > 2000 then return false; end if;
          if v_field.key = 'unavailability' and (
            v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            or v_text::date < date '1900-01-01' or v_text::date > date '2199-12-31'
            or to_char(v_text::date, 'YYYY-MM-DD') <> v_text
          ) then return false; end if;
        end loop;
      else return false;
      end if;
    else return false;
    end if;
  end loop;
  return true;
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then
  return false;
end;
$function$;
alter function internal.valid_intake_answers(jsonb) owner to cluvo_command_owner;
revoke all on function internal.valid_intake_answers(jsonb) from public, anon, authenticated, service_role;

-- Only this source's current availability projection is replaced. Independent
-- unavailable periods, bookings, ledgers and immutable answer revisions remain.
alter table app.intake_profiles add constraint intake_profile_person_key unique (tenant_id, id, person_id);
alter table app.unavailability_periods
  add column source_intake_profile_id uuid,
  add column source_unavailable_on date,
  add constraint unavailability_intake_source_pair check ((source_intake_profile_id is null) = (source_unavailable_on is null)),
  add constraint unavailability_intake_source_fk foreign key (tenant_id, source_intake_profile_id, person_id)
    references app.intake_profiles(tenant_id, id, person_id) on delete restrict,
  add constraint unavailability_intake_source_day_key unique (tenant_id, source_intake_profile_id, source_unavailable_on);
grant insert, update, delete on app.unavailability_periods to cluvo_command_owner;
create policy command_owner_insert on app.unavailability_periods for insert to cluvo_command_owner with check (true);
create policy command_owner_update on app.unavailability_periods for update to cluvo_command_owner using (true) with check (true);
create policy command_owner_delete on app.unavailability_periods for delete to cluvo_command_owner using (true);

create or replace function internal.sync_intake_unavailability(p_tenant_id uuid, p_profile_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_profile app.intake_profiles%rowtype;
  v_answers jsonb;
  v_zone text;
begin
  select * into strict v_profile from app.intake_profiles where tenant_id = p_tenant_id and id = p_profile_id;
  perform 1 from app.persons where tenant_id = p_tenant_id and id = v_profile.person_id for update;
  select answers into strict v_answers from app.intake_answers_versions
    where tenant_id = p_tenant_id and profile_id = p_profile_id and revision = v_profile.current_revision;
  if jsonb_typeof(v_answers -> 'unavailability') <> 'array' then return; end if;
  select timezone into strict v_zone from app.tenants where id = p_tenant_id;
  delete from app.unavailability_periods as unavailable
    where unavailable.tenant_id = p_tenant_id and unavailable.source_intake_profile_id = p_profile_id
      and not exists (select 1 from jsonb_array_elements_text(v_answers -> 'unavailability') as day(value)
        where day.value::date = unavailable.source_unavailable_on);
  insert into app.unavailability_periods (tenant_id, person_id, starts_at, ends_at, source_intake_profile_id, source_unavailable_on)
    select p_tenant_id, v_profile.person_id, day.value::date::timestamp at time zone v_zone,
      (day.value::date + 1)::timestamp at time zone v_zone, p_profile_id, day.value::date
    from jsonb_array_elements_text(v_answers -> 'unavailability') as day(value)
    on conflict on constraint unavailability_intake_source_day_key do update
      set starts_at = excluded.starts_at, ends_at = excluded.ends_at
      where app.unavailability_periods.starts_at is distinct from excluded.starts_at
        or app.unavailability_periods.ends_at is distinct from excluded.ends_at;
end;
$function$;
alter function internal.sync_intake_unavailability(uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.sync_intake_unavailability(uuid, uuid) from public, anon, authenticated, service_role;

create view api.intake_task_categories with (security_invoker = true) as
  select distinct tenant_id, name from app.task_categories;
revoke all on api.intake_task_categories from public, anon, service_role;
grant select on api.intake_task_categories to authenticated;

-- Return only the subject label needed for an already authorized intake. The
-- delegation does not expose the underlying person registry or date of birth.
create or replace function internal.list_intake_contexts(p_tenant_id uuid)
returns table (profile_id uuid, person_id uuid, household_context_id uuid, display_name text, is_self boolean)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  return query select profile.id, profile.person_id, profile.household_context_id,
    concat_ws(' ', person.given_name, person.family_name), internal.is_self_person(p_tenant_id, profile.person_id)
    from app.intake_profiles as profile
    join app.persons as person on person.tenant_id = profile.tenant_id and person.id = profile.person_id
    where profile.tenant_id = p_tenant_id and internal.can_edit_intake(p_tenant_id, profile.id)
    order by internal.is_self_person(p_tenant_id, profile.person_id) desc, profile.id;
end;
$function$;
alter function internal.list_intake_contexts(uuid) owner to cluvo_command_owner;
revoke all on function internal.list_intake_contexts(uuid) from public, anon, service_role;
grant execute on function internal.list_intake_contexts(uuid) to authenticated;
create or replace function api.list_intake_contexts(p_tenant_id uuid)
returns table (profile_id uuid, person_id uuid, household_context_id uuid, display_name text, is_self boolean)
language sql stable security invoker set search_path = ''
as $function$ select * from internal.list_intake_contexts(p_tenant_id); $function$;
revoke all on function api.list_intake_contexts(uuid) from public, anon, service_role;
grant execute on function api.list_intake_contexts(uuid) to authenticated;

create or replace function internal.save_intake_revision(
  p_tenant_id uuid,
  p_profile_id uuid,
  p_expected_version bigint,
  p_desired_minutes integer,
  p_answers jsonb,
  p_represented_person_id uuid,
  p_assistance_reason text,
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
  v_actor uuid := (select internal.current_actor_uid());
  v_profile app.intake_profiles%rowtype;
  v_idempotency app.idempotency_records%rowtype;
  v_request_hash bytea;
  v_revision integer;
  v_event_id uuid := gen_random_uuid();
  v_inserted_id uuid;
  v_merged_answers jsonb;
  v_result jsonb;
begin
  if v_actor is null or not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_idempotency_key is null or p_expected_version is null then
    raise exception using errcode = '22023', message = 'INVALID_COMMAND';
  end if;
  -- Replays also require the current subject mandate; revoked assistance must
  -- not remain available through an earlier idempotency result.
  if not internal.can_edit_intake(p_tenant_id, p_profile_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  v_request_hash := extensions.digest(
    convert_to(jsonb_build_object(
      'profile_id', p_profile_id,
      'expected_version', p_expected_version,
      'desired_minutes', p_desired_minutes,
      'answers', p_answers,
      'represented_person_id', p_represented_person_id,
      'assistance_reason', p_assistance_reason
    )::text, 'UTF8'),
    'sha256'
  );

  insert into app.idempotency_records (
    tenant_id, actor_auth_user_id, operation, idempotency_key, request_hash, status
  ) values (
    p_tenant_id, v_actor, 'save_intake_revision', p_idempotency_key, v_request_hash, 'processing'
  )
  on conflict (tenant_id, actor_auth_user_id, operation, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_idempotency
    from app.idempotency_records
    where tenant_id = p_tenant_id
      and actor_auth_user_id = v_actor
      and operation = 'save_intake_revision'
      and idempotency_key = p_idempotency_key
    for update;

    if v_idempotency.request_hash <> v_request_hash then
      raise exception using errcode = '22000', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_idempotency.status = 'completed' then
      return query select
        true,
        (v_idempotency.result_jsonb ->> 'resource_id')::uuid,
        (v_idempotency.result_jsonb ->> 'version')::bigint,
        array(
          select value::uuid
          from jsonb_array_elements_text(v_idempotency.result_jsonb -> 'event_ids')
        ),
        v_idempotency.result_jsonb -> 'result';
      return;
    end if;
    raise exception using errcode = '40001', message = 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  select * into v_profile
  from app.intake_profiles
  where tenant_id = p_tenant_id and id = p_profile_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if not internal.can_edit_intake(p_tenant_id, p_profile_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if v_profile.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'STALE_VERSION';
  end if;
  if not internal.valid_intake_answers(p_answers) then
    raise exception using errcode = '22023', message = 'INVALID_INTAKE_ANSWERS';
  end if;
  if p_desired_minutes is not null and p_desired_minutes not between 0 and 100000 then
    raise exception using errcode = '22023', message = 'INVALID_DESIRED_MINUTES';
  end if;
  if p_assistance_reason is not null and char_length(p_assistance_reason) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_REPRESENTATION';
  end if;

  select coalesce(answer_version.answers, '{}'::jsonb) || p_answers
  into v_merged_answers
  from (select 1) as singleton
  left join app.intake_answers_versions as answer_version
    on answer_version.tenant_id = p_tenant_id
   and answer_version.profile_id = p_profile_id
   and answer_version.revision = v_profile.current_revision;

  if internal.is_self_person(p_tenant_id, v_profile.person_id) then
    if p_represented_person_id is not null or p_assistance_reason is not null then
      raise exception using errcode = '22023', message = 'INVALID_REPRESENTATION';
    end if;
  elsif p_represented_person_id is distinct from v_profile.person_id
    or nullif(btrim(p_assistance_reason), '') is null then
    raise exception using errcode = '42501', message = 'INVALID_REPRESENTATION';
  end if;

  v_revision := v_profile.current_revision + 1;

  insert into app.intake_answers_versions (
    tenant_id,
    profile_id,
    revision,
    answers,
    authored_by_auth_user_id,
    represented_person_id,
    assistance_reason
  ) values (
    p_tenant_id,
    p_profile_id,
    v_revision,
    v_merged_answers,
    v_actor,
    p_represented_person_id,
    p_assistance_reason
  );

  update app.intake_profiles as profile_row
  set current_revision = v_revision,
      desired_minutes = p_desired_minutes,
      status = case when profile_row.status = 'draft' then 'submitted' else profile_row.status end,
      updated_at = statement_timestamp(),
      version = profile_row.version + 1
  where profile_row.tenant_id = p_tenant_id and profile_row.id = p_profile_id
  returning profile_row.* into v_profile;

  -- Only explicit structured dates update the projection. Legacy free text and
  -- all earlier intake revisions remain intact. This locks the same executor
  -- row as book_shift before changing eligibility for new bookings.
  if jsonb_typeof(v_merged_answers -> 'unavailability') = 'array' then
    perform internal.sync_intake_unavailability(p_tenant_id, p_profile_id);
  end if;

  insert into app.audit_events (
    tenant_id, actor_auth_user_id, represented_person_id, action,
    resource_type, resource_id, scope_kind, scope_id, reason_code,
    idempotency_key, payload_minimal
  ) values (
    p_tenant_id, v_actor, p_represented_person_id, 'intake.revision_saved',
    'intake_profile', p_profile_id, 'household', v_profile.household_context_id,
    case when p_represented_person_id is null then null else 'assisted' end,
    p_idempotency_key, jsonb_build_object('revision', v_revision)
  );

  insert into app.domain_events (
    id, tenant_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, payload_minimal
  ) values (
    v_event_id, p_tenant_id, 'intake_profile', p_profile_id, v_profile.version,
    'intake.revision_saved', jsonb_build_object('revision', v_revision)
  );

  v_result := jsonb_build_object(
    'resource_id', p_profile_id,
    'version', v_profile.version,
    'event_ids', jsonb_build_array(v_event_id),
    'result', jsonb_build_object('revision', v_revision)
  );

  update app.idempotency_records
  set status = 'completed', result_jsonb = v_result, completed_at = statement_timestamp()
  where id = v_inserted_id;

  return query select
    true,
    p_profile_id,
    v_profile.version,
    array[v_event_id],
    v_result -> 'result';
end;
$function$;

alter function internal.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  owner to cluvo_command_owner;
revoke execute on function internal.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  from public, anon, service_role;
grant execute on function internal.save_intake_revision(uuid, uuid, bigint, integer, jsonb, uuid, text, uuid)
  to authenticated;


commit;
