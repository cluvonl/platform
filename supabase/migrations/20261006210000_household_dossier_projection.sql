-- W02: minimal dossier tabs; personal answers, contacts and token material are
-- deliberately absent. Existing commands and published migrations are retained.
begin;

grant select on api.my_obligation_status to cluvo_command_owner;

create or replace function internal.get_household_dossier(p_tenant_id uuid, p_household_id uuid, p_season_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_household app.households%rowtype;
  v_progress boolean;
  v_contacts boolean;
  v_invite boolean;
  v_review boolean;
  v_season uuid := p_season_id;
  v_seasons jsonb;
  v_balances jsonb := '[]'::jsonb;
  v_people jsonb;
  v_history jsonb;
  v_invitations jsonb;
begin
  if not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not internal.can_access_household(p_tenant_id, p_household_id, 'base')
    and not internal.has_permission(p_tenant_id, 'household.view', 'household', p_household_id) then
    return null;
  end if;
  select * into v_household from app.households
    where tenant_id = p_tenant_id and id = p_household_id and status <> 'archived';
  if not found then return null; end if;
  v_progress := internal.can_access_household(p_tenant_id, p_household_id, 'view_progress')
    or internal.has_permission(p_tenant_id, 'household.progress.view', 'household', p_household_id);
  v_contacts := internal.can_access_household(p_tenant_id, p_household_id, 'manage_contacts')
    or internal.has_permission(p_tenant_id, 'household.view', 'household', p_household_id);
  v_invite := internal.can_access_household(p_tenant_id, p_household_id, 'invite_executor')
    or internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', p_household_id);
  v_review := internal.has_permission(p_tenant_id, 'household.review', 'household', p_household_id);

  select coalesce(jsonb_agg(jsonb_build_object('season_id', id, 'name', name) order by name, id), '[]'::jsonb)
    into v_seasons from app.seasons where tenant_id = p_tenant_id and status = 'active';
  if v_season is null and jsonb_array_length(v_seasons) = 1 then
    v_season := (v_seasons -> 0 ->> 'season_id')::uuid;
  end if;
  -- URL season IDs never select a foreign tenant or an unavailable season.
  if v_season is not null and not exists (
    select 1 from app.seasons where tenant_id = p_tenant_id and id = v_season and status = 'active'
  ) then return null; end if;
  if v_progress and v_season is not null then
    select coalesce(jsonb_agg(to_jsonb(balance) order by balance.obligation_id), '[]'::jsonb)
      into v_balances from (
        select distinct status.obligation_id, status.season_id, status.effective_target_minutes,
          status.effective_winter_minutes, status.confirmed_minutes, status.planned_minutes,
          status.pending_minutes, status.remaining_minutes, status.winter_deficit_minutes,
          status.structurally_covered, status.annual_state, status.open_dispute_count
        from api.my_obligation_status as status
        join app.household_obligation_links as link on link.tenant_id = status.tenant_id and link.obligation_id = status.obligation_id
        where status.tenant_id = p_tenant_id and status.season_id = v_season
          and link.household_id = p_household_id and link.starts_at <= statement_timestamp()
          and (link.ends_at is null or link.ends_at > statement_timestamp())
      ) as balance;
  end if;

  select coalesce(jsonb_agg(to_jsonb(person_row) order by person_row.display_name, person_row.person_id), '[]'::jsonb)
    into v_people from (
      select person.id as person_id, concat_ws(' ', person.given_name, person.family_name) as display_name,
        link.kind, exists (select 1 from app.account_person_links as identity
          where identity.tenant_id = p_tenant_id and identity.person_id = person.id and identity.revoked_at is null
            and identity.verified_at is not null) as verified,
        profile.id as profile_id, profile.status as intake_status,
        internal.is_self_person(p_tenant_id, person.id) as is_self
      from app.household_person_links as link
      join app.persons as person on person.tenant_id = link.tenant_id and person.id = link.person_id
      left join app.intake_profiles as profile on profile.tenant_id = link.tenant_id
        and profile.person_id = link.person_id and profile.household_context_id = link.household_id
        and internal.can_edit_intake(p_tenant_id, profile.id)
      where link.tenant_id = p_tenant_id and link.household_id = p_household_id
        and link.starts_at <= statement_timestamp() and (link.ends_at is null or link.ends_at > statement_timestamp())
        and person.status <> 'archived'
        and (v_contacts or internal.is_self_person(p_tenant_id, person.id) or profile.id is not null)
    ) as person_row;

  select coalesce(jsonb_agg(to_jsonb(invitation_row) order by invitation_row.created_at desc, invitation_row.invitation_id), '[]'::jsonb)
    into v_invitations from (
      select invitation.id as invitation_id, concat_ws(' ', person.given_name, person.family_name) as display_name,
        invitation.delivery_status, invitation.expires_at, invitation.created_at
      from app.household_invitations as invitation
      join app.persons as person on person.tenant_id = invitation.tenant_id and person.id = invitation.invited_person_id
      where invitation.tenant_id = p_tenant_id and invitation.household_id = p_household_id
        and (invitation.created_by_auth_user_id = internal.current_actor_uid()
          or internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', p_household_id))
      order by invitation.created_at desc, invitation.id limit 30
    ) as invitation_row;

  select coalesce(jsonb_agg(to_jsonb(history_row) order by history_row.occurred_at desc, history_row.event_id), '[]'::jsonb)
    into v_history from (
      select event.id as event_id, event.action, event.occurred_at,
        event.actor_auth_user_id = internal.current_actor_uid() as actor_is_self
      from app.audit_events as event
      where event.tenant_id = p_tenant_id
        and (event.actor_auth_user_id = internal.current_actor_uid() or v_review)
        and (
          (event.scope_kind = 'household' and event.scope_id = p_household_id
            and event.action in ('household.invitation_created', 'household.invitation_accepted', 'household.split_applied'))
          or (v_progress and event.resource_type = 'booking'
            and event.action in ('booking.created', 'attendance.confirmed', 'booking.cancelled', 'booking.transferred')
            and exists (select 1 from app.bookings as booking
              join app.household_obligation_links as link on link.tenant_id = booking.tenant_id and link.obligation_id = booking.obligation_id
              where booking.tenant_id = p_tenant_id and booking.id = event.resource_id and link.household_id = p_household_id))
        )
      order by event.occurred_at desc, event.id limit 50
    ) as history_row;

  return jsonb_build_object('timezone', (select timezone from app.tenants where id = p_tenant_id), 'household', jsonb_build_object('household_id', v_household.id,
    'label', v_household.label, 'version', v_household.version, 'status', v_household.status,
    'separated_parents', v_household.separated_parents, 'intake_code_hint', v_household.intake_code_hint,
    'can_view_progress', v_progress, 'can_invite_executor', v_invite),
    'seasons', v_seasons, 'selected_season_id', v_season, 'balances', v_balances,
    'people', v_people, 'invitations', v_invitations, 'history', v_history);
end;
$function$;
alter function internal.get_household_dossier(uuid, uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.get_household_dossier(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.get_household_dossier(uuid, uuid, uuid) to authenticated;

create or replace function api.get_household_dossier(p_tenant_id uuid, p_household_id uuid, p_season_id uuid default null)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select internal.get_household_dossier(p_tenant_id, p_household_id, p_season_id); $function$;
revoke all on function api.get_household_dossier(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function api.get_household_dossier(uuid, uuid, uuid) to authenticated;

-- A lost server-action response must not send a second provider invitation.
-- Only the still-authorized creator can read this status; no token or email.
create or replace function internal.household_invitation_delivery(p_tenant_id uuid, p_invitation_id uuid)
returns text language plpgsql stable security definer set search_path = ''
as $function$
declare v_invitation app.household_invitations%rowtype;
begin
  if not internal.is_active_member(p_tenant_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  select * into v_invitation from app.household_invitations where tenant_id = p_tenant_id and id = p_invitation_id
    and created_by_auth_user_id = internal.current_actor_uid();
  if not found or (not internal.can_access_household(p_tenant_id, v_invitation.household_id, 'invite_executor')
    and not internal.has_permission(p_tenant_id, 'household.invite_executor', 'household', v_invitation.household_id)) then
    return null;
  end if;
  return v_invitation.delivery_status;
end;
$function$;
alter function internal.household_invitation_delivery(uuid, uuid) owner to cluvo_command_owner;
revoke all on function internal.household_invitation_delivery(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function internal.household_invitation_delivery(uuid, uuid) to authenticated;
create or replace function api.household_invitation_delivery(p_tenant_id uuid, p_invitation_id uuid)
returns text language sql stable security invoker set search_path = ''
as $function$ select internal.household_invitation_delivery(p_tenant_id, p_invitation_id); $function$;
revoke all on function api.household_invitation_delivery(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function api.household_invitation_delivery(uuid, uuid) to authenticated;

commit;
