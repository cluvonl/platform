-- Read an exact historical action's current authorized source. Existing
-- action and source RLS remain authoritative; this never opens or accepts it.
begin;

create function api.pwa_personal_action_context(
  p_tenant_id uuid, p_action_id uuid, p_expected_version bigint
) returns jsonb
language sql stable security invoker set search_path = ''
as $function$
  with own_action as (
    select a.* from app.personal_action_items a
    where a.tenant_id = p_tenant_id and a.id = p_action_id
      and a.version = p_expected_version and p_expected_version > 0
      and a.state = 'open'
      and a.recipient_person_id = internal.current_person_id(p_tenant_id)
      and internal.actor_has_active_session()
      and internal.is_active_member(p_tenant_id)
  ), source as (
    select a.id action_id, a.tenant_id, a.version action_version, a.action_kind,
      jsonb_build_object('kind','subtask','resource_id',s.id,'resource_version',s.version,
        'title',s.title,'text',c.description,'state',s.status,'due_at',s.due_at,
        'card_id',c.id,'parent_title',c.title) detail
    from own_action a
    join app.kanban_card_subtasks s on s.tenant_id=a.tenant_id and s.id=a.subtask_id
    join app.kanban_cards c on c.tenant_id=s.tenant_id and c.id=s.card_id
    where a.action_kind='subtask_assignment'
    union all
    select a.id,a.tenant_id,a.version,a.action_kind,
      jsonb_build_object('kind','card_mention','resource_id',m.id,'parent_version',c.version,
        'title',c.title,'text',m.excerpt,'state',c.status,'card_id',c.id,'parent_title',c.title)
    from own_action a
    join app.mentions m on m.tenant_id=a.tenant_id and m.id=a.mention_id
    join app.kanban_cards c on c.tenant_id=m.tenant_id and c.id=m.card_id
    where a.action_kind='mention'
    union all
    select a.id,a.tenant_id,a.version,a.action_kind,
      jsonb_build_object('kind','event_mention','resource_id',m.id,'parent_version',o.version,
        'title',e.title,'text',m.excerpt,'state',o.state,'due_at',o.starts_at,
        'occurrence_id',o.id,'parent_title',e.title)
    from own_action a
    join app.mentions m on m.tenant_id=a.tenant_id and m.id=a.mention_id
    join app.event_occurrences o on o.tenant_id=m.tenant_id and o.id=m.occurrence_id
    join app.events e on e.tenant_id=o.tenant_id and e.id=o.event_id
    where a.action_kind='mention'
    union all
    select a.id,a.tenant_id,a.version,a.action_kind,
      jsonb_build_object('kind','team_task','resource_id',t.id,'resource_version',t.version,
        'title',t.title,'text',t.description,'state',t.state,'due_at',t.due_at,
        'team_id',t.team_id,'parent_title',team.name,'credit_minutes',t.credit_minutes)
    from own_action a
    join app.team_tasks t on t.tenant_id=a.tenant_id and t.id=a.team_task_id
    join app.teams team on team.tenant_id=t.tenant_id and team.id=t.team_id
    where a.action_kind='team_task'
    union all
    select a.id,a.tenant_id,a.version,a.action_kind,
      jsonb_build_object('kind','policy_question','resource_id',q.id,'resource_version',q.version,
        'title',d.title,'text',q.question_text,'state',q.state,'resolution_text',q.resolution_text,
        'assignment_id',pa.id,'policy_version_id',pv.id,'parent_title',d.title)
    from own_action a
    join app.policy_questions q on q.tenant_id=a.tenant_id and q.id=a.policy_question_id
    join app.policy_assignments pa on pa.tenant_id=q.tenant_id and pa.id=q.assignment_id
    join app.policy_versions pv on pv.tenant_id=pa.tenant_id and pv.id=pa.policy_version_id
    join app.policy_documents d on d.tenant_id=pv.tenant_id and d.id=pv.document_id
    where a.action_kind='policy_follow_up'
  )
  select jsonb_build_object('tenant_id',tenant_id,'action_id',action_id,
    'action_version',action_version,'action_kind',action_kind) || detail
  from source;
$function$;

revoke all on function api.pwa_personal_action_context(uuid,uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function api.pwa_personal_action_context(uuid,uuid,bigint)
  to authenticated;

commit;
