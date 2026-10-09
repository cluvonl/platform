-- Read-only committee planning, including internal drafts. A shift has no
-- canonical season_id: its local start date belongs to the selected window.
-- Existing row policies and shift.manage remain the authority for every row.
begin;

create function api.pwa_committee_planning(p_tenant_id uuid, p_season_id uuid)
returns table (
  tenant_id uuid, season_id uuid, id uuid, version bigint, state text,
  committee_id uuid, committee_name text, category_name text, title text,
  starts_at timestamptz, ends_at timestamptz, location_name text,
  credit_minutes integer, position_count integer
)
language sql stable security invoker set search_path = ''
as $function$
  select s.tenant_id, season.id, s.id, s.version, s.state,
    s.committee_id, committee.name, category.name, s.title,
    s.starts_at, s.ends_at, location.name, s.credit_minutes,
    (select count(*)::integer from app.shift_positions position
      where position.tenant_id = s.tenant_id and position.shift_id = s.id)
  from app.shifts s
  join app.tenants tenant on tenant.id = s.tenant_id
  join app.seasons season on season.tenant_id = s.tenant_id and season.id = p_season_id
  join app.committees committee on committee.tenant_id = s.tenant_id and committee.id = s.committee_id
  join app.task_categories category on category.tenant_id = s.tenant_id and category.id = s.category_id
  left join app.locations location on location.tenant_id = s.tenant_id and location.id = s.location_id
  where s.tenant_id = p_tenant_id
    and internal.actor_has_active_session()
    and internal.is_active_member(p_tenant_id)
    and internal.has_permission(p_tenant_id, 'shift.manage', 'committee', s.committee_id)
    and s.state in ('draft', 'published')
    and s.starts_at > statement_timestamp()
    and (s.starts_at at time zone tenant.timezone)::date between season.starts_on and season.ends_on
  order by s.starts_at, s.id;
$function$;

revoke all on function api.pwa_committee_planning(uuid,uuid) from public, anon, service_role;
grant execute on function api.pwa_committee_planning(uuid,uuid) to authenticated;

commit;
