-- Explicit, scoped management of personal intake assistance. No other rights,
-- answers, bookings, obligations or ledger entries are created by this command.
begin;

alter table app.acting_delegations add column version bigint not null default 1 check (version > 0);
-- A scheduled delegation must also be cancellable before its start. Every
-- previously valid revocation remains valid; the recorded time stays factual.
alter table app.acting_delegations drop constraint acting_delegations_check1;
alter table app.acting_delegations add constraint acting_delegations_revocation_time
  check (revoked_at is null or revoked_at >= least(created_at, starts_at));
grant insert on app.acting_delegations to cluvo_command_owner;
grant update (revoked_at,version) on app.acting_delegations to cluvo_command_owner;
create policy command_owner_insert on app.acting_delegations for insert to cluvo_command_owner with check (true);
create policy command_owner_update on app.acting_delegations for update to cluvo_command_owner using (true) with check (true);

create table app.intake_assistance_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  delegation_id uuid not null,
  household_id uuid not null,
  represented_person_id uuid not null,
  helper_person_id uuid,
  actor_auth_user_id uuid not null,
  decision text not null check (decision in ('granted','revoked')),
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  household_version_before bigint not null check (household_version_before > 0),
  delegation_version_before bigint,
  idempotency_key uuid not null,
  decided_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,id),
  foreign key (tenant_id,delegation_id) references app.acting_delegations(tenant_id,id) on delete restrict,
  foreign key (tenant_id,household_id) references app.households(tenant_id,id) on delete restrict,
  foreign key (tenant_id,represented_person_id) references app.persons(tenant_id,id) on delete restrict,
  foreign key (tenant_id,helper_person_id) references app.persons(tenant_id,id) on delete restrict,
  foreign key (actor_auth_user_id) references auth.users(id) on delete restrict,
  check (decision<>'granted' or helper_person_id is not null),
  check ((decision='granted' and delegation_version_before is null)
    or (decision='revoked' and delegation_version_before is not null and delegation_version_before > 0))
);
alter table app.intake_assistance_decisions enable row level security;
alter table app.intake_assistance_decisions force row level security;
revoke all on app.intake_assistance_decisions from public,anon,authenticated,service_role;
grant select on app.intake_assistance_decisions to authenticated;
grant select,insert on app.intake_assistance_decisions to cluvo_command_owner;
create policy command_owner_select on app.intake_assistance_decisions for select to cluvo_command_owner using (true);
create policy command_owner_insert on app.intake_assistance_decisions for insert to cluvo_command_owner with check (true);
create policy native_session_required on app.intake_assistance_decisions as restrictive for all to authenticated
  using ((select internal.actor_has_active_session())) with check ((select internal.actor_has_active_session()));
create policy scoped_review on app.intake_assistance_decisions for select to authenticated
  using (internal.has_permission(tenant_id,'household.review','household',household_id));
create trigger immutable_intake_assistance_decisions before update or delete on app.intake_assistance_decisions
  for each row execute function internal.reject_immutable_change();

-- The reviewer can select a verified person, never a supplied Auth user ID.
-- Candidates are linked household people or intake assistants in this scope.
create function internal.intake_assistance_helpers(p_tenant_id uuid,p_household_id uuid)
returns table (person_id uuid,auth_user_id uuid,display_name text)
language sql stable security invoker set search_path='' as $function$
  select distinct person.id,identity.auth_user_id,concat_ws(' ',person.given_name,person.family_name)
  from app.account_person_links identity
  join app.persons person on person.tenant_id=identity.tenant_id and person.id=identity.person_id and person.status='active'
  join app.tenant_memberships membership on membership.tenant_id=identity.tenant_id
    and membership.auth_user_id=identity.auth_user_id and membership.status='active'
    and membership.starts_at<=statement_timestamp() and (membership.ends_at is null or membership.ends_at>statement_timestamp())
  where identity.tenant_id=p_tenant_id and identity.verified_at is not null and identity.revoked_at is null
    and (exists(select 1 from app.household_person_links link where link.tenant_id=p_tenant_id
      and link.household_id=p_household_id and link.person_id=person.id and link.starts_at<=statement_timestamp()
      and (link.ends_at is null or link.ends_at>statement_timestamp()))
      or exists(select 1 from app.access_grants grant_row join app.role_permissions permission
        on permission.tenant_id=grant_row.tenant_id and permission.role_id=grant_row.role_id and permission.permission_key='intake.assist'
        where grant_row.tenant_id=p_tenant_id and grant_row.auth_user_id=identity.auth_user_id
          and grant_row.revoked_at is null and grant_row.starts_at<=statement_timestamp()
          and (grant_row.ends_at is null or grant_row.ends_at>statement_timestamp())
          and (grant_row.scope_kind='tenant' or (grant_row.scope_kind='household' and grant_row.household_id=p_household_id))));
$function$;
alter function internal.intake_assistance_helpers(uuid,uuid) owner to cluvo_command_owner;
revoke all on function internal.intake_assistance_helpers(uuid,uuid) from public,anon,authenticated,service_role;

create function internal.get_intake_assistance_context(p_tenant_id uuid,p_household_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare v_household app.households%rowtype; v_subjects jsonb; v_helpers jsonb; v_delegations jsonb;
begin
  if not internal.actor_has_verified_email()
    or not internal.has_permission(p_tenant_id,'household.review','household',p_household_id) then return null; end if;
  select * into v_household from app.households where tenant_id=p_tenant_id and id=p_household_id;
  if not found then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(subject) order by subject.display_name,subject.person_id),'[]') into v_subjects
  from (select distinct person.id person_id,profile.id profile_id,concat_ws(' ',person.given_name,person.family_name) display_name
    from app.household_person_links link join app.persons person on person.tenant_id=link.tenant_id and person.id=link.person_id
    join app.intake_profiles profile on profile.tenant_id=link.tenant_id and profile.person_id=person.id and profile.household_context_id=link.household_id
    where link.tenant_id=p_tenant_id and link.household_id=p_household_id and person.status='active'
      and profile.status<>'archived' and link.starts_at<=statement_timestamp() and (link.ends_at is null or link.ends_at>statement_timestamp())) subject;
  select coalesce(jsonb_agg(jsonb_build_object('person_id',helper.person_id,'display_name',helper.display_name)
    order by helper.display_name,helper.person_id),'[]') into v_helpers from internal.intake_assistance_helpers(p_tenant_id,p_household_id) helper;
  select coalesce(jsonb_agg(to_jsonb(delegation) order by delegation.starts_at desc,delegation.delegation_id),'[]') into v_delegations
  from (select grant_row.id delegation_id,grant_row.version,grant_row.represented_person_id,
    concat_ws(' ',subject.given_name,subject.family_name) subject_name,
    concat_ws(' ',helper.given_name,helper.family_name) helper_name,
    grant_row.starts_at,grant_row.ends_at,grant_row.revoked_at,
    case when grant_row.revoked_at is not null then 'revoked'
      when grant_row.ends_at<=statement_timestamp() then 'expired'
      when grant_row.starts_at>statement_timestamp() then 'scheduled' else 'active' end state,
    grant_row.revoked_at is null can_revoke
    from app.acting_delegations grant_row join app.persons subject on subject.tenant_id=grant_row.tenant_id and subject.id=grant_row.represented_person_id
    left join app.account_person_links identity on identity.tenant_id=grant_row.tenant_id and identity.auth_user_id=grant_row.actor_auth_user_id
      and identity.verified_at is not null and identity.revoked_at is null
    left join app.persons helper on helper.tenant_id=identity.tenant_id and helper.id=identity.person_id
    where grant_row.tenant_id=p_tenant_id and grant_row.household_id=p_household_id and grant_row.scope='intake_assistance') delegation;
  return jsonb_build_object('household_id',v_household.id,'label',v_household.label,'household_version',v_household.version,'observed_at',statement_timestamp(),
    'can_grant',v_household.status<>'archived','timezone',(select timezone from app.tenants where id=p_tenant_id),
    'subjects',v_subjects,'helpers',v_helpers,'delegations',v_delegations);
end;
$function$;
alter function internal.get_intake_assistance_context(uuid,uuid) owner to cluvo_command_owner;
revoke all on function internal.get_intake_assistance_context(uuid,uuid) from public,anon,service_role;
grant execute on function internal.get_intake_assistance_context(uuid,uuid) to authenticated;
create function api.get_intake_assistance_context(p_tenant_id uuid,p_household_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $function$
  select internal.get_intake_assistance_context(p_tenant_id,p_household_id);
$function$;
revoke all on function api.get_intake_assistance_context(uuid,uuid) from public,anon,service_role;
grant execute on function api.get_intake_assistance_context(uuid,uuid) to authenticated;

create function internal.grant_intake_assistance(p_tenant_id uuid,p_household_id uuid,p_profile_id uuid,
  p_helper_person_id uuid,p_expected_household_version bigint,p_ends_at timestamptz,p_reason text,p_idempotency_key uuid)
returns table (ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb)
language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=internal.current_actor_uid(); v_household app.households%rowtype; v_profile app.intake_profiles%rowtype;
  v_helper uuid; v_claim record; v_delegation uuid:=gen_random_uuid(); v_event uuid:=gen_random_uuid(); v_result jsonb;
begin
  -- NATIVE_SESSION_COMMAND_GUARD
  if not internal.actor_has_active_session() or not internal.actor_has_verified_email()
    or not internal.has_permission(p_tenant_id,'household.review','household',p_household_id) then
    raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if p_expected_household_version is null or p_expected_household_version<1 or p_idempotency_key is null
    or p_ends_at is null or not isfinite(p_ends_at) or p_ends_at>='10000-01-01 00:00:00+00'::timestamptz
    or nullif(btrim(p_reason),'') is null or char_length(p_reason)>2000 then
    raise exception using errcode='22023',message='INVALID_COMMAND'; end if;
  -- Serialize with answer writers/reconfirmation before the dossier and grant.
  select * into v_profile from app.intake_profiles where tenant_id=p_tenant_id and id=p_profile_id
    and household_context_id=p_household_id for update;
  select * into v_household from app.households where tenant_id=p_tenant_id and id=p_household_id for update;
  if v_profile.id is null or v_household.id is null or not internal.actor_has_verified_email()
    or not internal.has_permission(p_tenant_id,'household.review','household',p_household_id) then
    raise exception using errcode='42501',message='FORBIDDEN'; end if;
  select helper.auth_user_id into v_helper from internal.intake_assistance_helpers(p_tenant_id,p_household_id) helper
    where helper.person_id=p_helper_person_id;
  if v_helper is null or p_helper_person_id=v_profile.person_id then
    raise exception using errcode='42501',message='INVALID_ASSISTANT'; end if;
  select * into v_claim from internal.claim_idempotency(p_tenant_id,'grant_intake_assistance',p_idempotency_key,
    jsonb_build_object('household_id',p_household_id,'profile_id',p_profile_id,'helper_person_id',p_helper_person_id,
      'expected_household_version',p_expected_household_version,'ends_at',p_ends_at,'reason',p_reason));
  if v_claim.replay_result is not null then
    return query select true,(v_claim.replay_result->>'resource_id')::uuid,(v_claim.replay_result->>'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result->'event_ids')),v_claim.replay_result->'result'; return; end if;
  if v_household.version<>p_expected_household_version then raise exception using errcode='40001',message='STALE_VERSION'; end if;
  if v_household.status='archived' or v_profile.status='archived' or p_ends_at<=statement_timestamp()
    or not exists(select 1 from app.persons person join app.household_person_links link
      on link.tenant_id=person.tenant_id and link.person_id=person.id
      where person.tenant_id=p_tenant_id and person.id=v_profile.person_id and person.status='active'
        and link.household_id=p_household_id and link.starts_at<=statement_timestamp()
        and (link.ends_at is null or link.ends_at>statement_timestamp())) then
    raise exception using errcode='23514',message='ASSISTANCE_NOT_AVAILABLE'; end if;
  if exists(select 1 from app.acting_delegations delegation where tenant_id=p_tenant_id
    and household_id=p_household_id and actor_auth_user_id=v_helper and represented_person_id=v_profile.person_id
    and scope='intake_assistance' and revoked_at is null
    and (ends_at is null or ends_at>statement_timestamp()) and starts_at<p_ends_at) then
    raise exception using errcode='23514',message='ASSISTANCE_ALREADY_GRANTED'; end if;
  insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,ends_at,granted_by_auth_user_id)
    values(v_delegation,p_tenant_id,v_helper,v_profile.person_id,p_household_id,'intake_assistance',statement_timestamp(),p_ends_at,v_actor);
  insert into app.intake_assistance_decisions(tenant_id,delegation_id,household_id,represented_person_id,helper_person_id,
    actor_auth_user_id,decision,reason,household_version_before,idempotency_key)
    values(p_tenant_id,v_delegation,p_household_id,v_profile.person_id,p_helper_person_id,v_actor,'granted',p_reason,v_household.version,p_idempotency_key);
  update app.households set version=app.households.version+1,updated_at=statement_timestamp()
    where tenant_id=p_tenant_id and id=p_household_id returning * into v_household;
  insert into app.audit_events(tenant_id,actor_auth_user_id,represented_person_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
    values(p_tenant_id,v_actor,v_profile.person_id,'intake.assistance_granted','acting_delegation',v_delegation,'household',p_household_id,
      'explicit_assistance',p_idempotency_key,jsonb_build_object('expected_household_version',p_expected_household_version,'profile_id',v_profile.id,'helper_person_id',p_helper_person_id));
  insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)
    values(v_event,p_tenant_id,'household',p_household_id,v_household.version,'intake.assistance_granted',jsonb_build_object('delegation_id',v_delegation));
  v_result:=jsonb_build_object('resource_id',v_delegation,'version',1,'event_ids',jsonb_build_array(v_event),
    'result',jsonb_build_object('household_version',v_household.version));
  perform internal.complete_idempotency(v_claim.record_id,v_result);
  return query select true,v_delegation,1::bigint,array[v_event],v_result->'result';
end;
$function$;
alter function internal.grant_intake_assistance(uuid,uuid,uuid,uuid,bigint,timestamptz,text,uuid) owner to cluvo_command_owner;
revoke all on function internal.grant_intake_assistance(uuid,uuid,uuid,uuid,bigint,timestamptz,text,uuid) from public,anon,service_role;
grant execute on function internal.grant_intake_assistance(uuid,uuid,uuid,uuid,bigint,timestamptz,text,uuid) to authenticated;
create function api.grant_intake_assistance(p_tenant_id uuid,p_household_id uuid,p_profile_id uuid,
  p_helper_person_id uuid,p_expected_household_version bigint,p_ends_at timestamptz,p_reason text,p_idempotency_key uuid)
returns table (ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb)
language sql security invoker set search_path='' as $function$
  select * from internal.grant_intake_assistance(p_tenant_id,p_household_id,p_profile_id,p_helper_person_id,p_expected_household_version,p_ends_at,p_reason,p_idempotency_key);
$function$;
revoke all on function api.grant_intake_assistance(uuid,uuid,uuid,uuid,bigint,timestamptz,text,uuid) from public,anon,service_role;
grant execute on function api.grant_intake_assistance(uuid,uuid,uuid,uuid,bigint,timestamptz,text,uuid) to authenticated;

create function internal.revoke_intake_assistance(p_tenant_id uuid,p_delegation_id uuid,
  p_expected_household_version bigint,p_expected_delegation_version bigint,p_reason text,p_idempotency_key uuid)
returns table (ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb)
language plpgsql security definer set search_path='' as $function$
declare v_actor uuid:=internal.current_actor_uid(); v_delegation app.acting_delegations%rowtype;
  v_household app.households%rowtype; v_profile app.intake_profiles%rowtype;
  v_helper_person uuid; v_claim record; v_event uuid:=gen_random_uuid(); v_result jsonb;
begin
  -- NATIVE_SESSION_COMMAND_GUARD
  if not internal.actor_has_active_session() or not internal.actor_has_verified_email() then
    raise exception using errcode='42501',message='FORBIDDEN'; end if;
  select * into v_delegation from app.acting_delegations where tenant_id=p_tenant_id and id=p_delegation_id and scope='intake_assistance';
  if not found or not internal.has_permission(p_tenant_id,'household.review','household',v_delegation.household_id) then
    raise exception using errcode='42501',message='FORBIDDEN'; end if;
  if p_expected_household_version is null or p_expected_household_version<1 or p_expected_delegation_version is null
    or p_expected_delegation_version<1 or p_idempotency_key is null or nullif(btrim(p_reason),'') is null or char_length(p_reason)>2000 then
    raise exception using errcode='22023',message='INVALID_COMMAND'; end if;
  select * into v_profile from app.intake_profiles where tenant_id=p_tenant_id
    and person_id=v_delegation.represented_person_id and household_context_id=v_delegation.household_id for update;
  select * into v_household from app.households where tenant_id=p_tenant_id and id=v_delegation.household_id for update;
  select * into strict v_delegation from app.acting_delegations where tenant_id=p_tenant_id and id=p_delegation_id for update;
  if v_household.id is null or v_delegation.scope<>'intake_assistance'
    or v_delegation.household_id<>v_household.id
    or (v_profile.id is not null and v_delegation.represented_person_id<>v_profile.person_id)
    or not internal.actor_has_verified_email() or not internal.has_permission(p_tenant_id,'household.review','household',v_household.id) then
    raise exception using errcode='42501',message='FORBIDDEN'; end if;
  -- Loss of the helper's person link must never prevent ending the permission.
  select person_id into v_helper_person from app.account_person_links where tenant_id=p_tenant_id
    and auth_user_id=v_delegation.actor_auth_user_id and verified_at is not null
    order by verified_at desc,id limit 1;
  select * into v_claim from internal.claim_idempotency(p_tenant_id,'revoke_intake_assistance',p_idempotency_key,
    jsonb_build_object('delegation_id',p_delegation_id,'expected_household_version',p_expected_household_version,
      'expected_delegation_version',p_expected_delegation_version,'reason',p_reason));
  if v_claim.replay_result is not null then
    return query select true,(v_claim.replay_result->>'resource_id')::uuid,(v_claim.replay_result->>'version')::bigint,
      array(select value::uuid from jsonb_array_elements_text(v_claim.replay_result->'event_ids')),v_claim.replay_result->'result'; return; end if;
  if v_household.version<>p_expected_household_version or v_delegation.version<>p_expected_delegation_version then
    raise exception using errcode='40001',message='STALE_VERSION'; end if;
  if v_delegation.revoked_at is not null then raise exception using errcode='23514',message='ASSISTANCE_ALREADY_REVOKED'; end if;
  insert into app.intake_assistance_decisions(tenant_id,delegation_id,household_id,represented_person_id,helper_person_id,
    actor_auth_user_id,decision,reason,household_version_before,delegation_version_before,idempotency_key)
    values(p_tenant_id,v_delegation.id,v_household.id,v_delegation.represented_person_id,v_helper_person,v_actor,'revoked',p_reason,
      v_household.version,v_delegation.version,p_idempotency_key);
  update app.acting_delegations set revoked_at=statement_timestamp(),version=app.acting_delegations.version+1
    where tenant_id=p_tenant_id and id=v_delegation.id returning * into v_delegation;
  update app.households set version=app.households.version+1,updated_at=statement_timestamp()
    where tenant_id=p_tenant_id and id=v_household.id returning * into v_household;
  insert into app.audit_events(tenant_id,actor_auth_user_id,represented_person_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
    values(p_tenant_id,v_actor,v_delegation.represented_person_id,'intake.assistance_revoked','acting_delegation',v_delegation.id,'household',v_household.id,
      'explicit_revocation',p_idempotency_key,jsonb_build_object('expected_household_version',p_expected_household_version,'expected_delegation_version',p_expected_delegation_version));
  insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)
    values(v_event,p_tenant_id,'household',v_household.id,v_household.version,'intake.assistance_revoked',jsonb_build_object('delegation_id',v_delegation.id));
  v_result:=jsonb_build_object('resource_id',v_delegation.id,'version',v_delegation.version,'event_ids',jsonb_build_array(v_event),
    'result',jsonb_build_object('household_version',v_household.version));
  perform internal.complete_idempotency(v_claim.record_id,v_result);
  return query select true,v_delegation.id,v_delegation.version,array[v_event],v_result->'result';
end;
$function$;
alter function internal.revoke_intake_assistance(uuid,uuid,bigint,bigint,text,uuid) owner to cluvo_command_owner;
revoke all on function internal.revoke_intake_assistance(uuid,uuid,bigint,bigint,text,uuid) from public,anon,service_role;
grant execute on function internal.revoke_intake_assistance(uuid,uuid,bigint,bigint,text,uuid) to authenticated;
create function api.revoke_intake_assistance(p_tenant_id uuid,p_delegation_id uuid,
  p_expected_household_version bigint,p_expected_delegation_version bigint,p_reason text,p_idempotency_key uuid)
returns table (ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb)
language sql security invoker set search_path='' as $function$
  select * from internal.revoke_intake_assistance(p_tenant_id,p_delegation_id,p_expected_household_version,p_expected_delegation_version,p_reason,p_idempotency_key);
$function$;
revoke all on function api.revoke_intake_assistance(uuid,uuid,bigint,bigint,text,uuid) from public,anon,service_role;
grant execute on function api.revoke_intake_assistance(uuid,uuid,bigint,bigint,text,uuid) to authenticated;

commit;
