-- Corrective expand migration. Applied 100000--106000 bytes stay immutable.
-- Central club distribution is a separate capability from managing one's team.
begin;

create temporary table pwa_107_function_authority on commit drop as
select p.oid, p.proowner, p.proacl, p.prosecdef, p.proleakproof,
       p.proconfig, p.prorettype, p.proargtypes, p.provolatile
from pg_proc p where p.oid = any(array[
 'internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure,
 'internal.pwa_distribution(uuid,uuid,uuid)'::regprocedure,
 'internal.pwa_revalidate_delivery(uuid,uuid,bigint)'::regprocedure,
 'internal.pwa_automation_guard()'::regprocedure,
 'internal.pwa_snapshot(uuid,uuid,uuid)'::regprocedure,
 'internal.pwa_receiving_team_proposals(uuid,uuid,uuid[])'::regprocedure,
 'internal.seed_wp6_wp8_permissions(uuid)'::regprocedure]);

insert into app.permissions(permission_key,description)
values('club_cluster.manage','Centrally reserve club positions and distribute them to receiving teams')
on conflict(permission_key) do nothing;

-- Seed permission catalogues, never infer a runtime permission from a role name.
-- Reusing the native seed also covers tenants created after this migration.
do $catalogue$ declare d text; a text; begin
 d:=pg_get_functiondef('internal.seed_wp6_wp8_permissions(uuid)'::regprocedure);
 a:='      (''team_parent'', ''team_task.view''),';
 if position(a in d)=0 then raise exception 'PWA_107_PERMISSION_SEED_SOURCE_MISMATCH';end if;
 execute replace(d,a,$replacement$      ('volunteer_committee', 'club_cluster.manage'),
      ('board', 'club_cluster.manage'),
$replacement$||a);
end;$catalogue$;
select internal.seed_wp6_wp8_permissions(id) from app.tenants;

do $commands$ declare d text; x text; a text; begin
 d:=pg_get_functiondef('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure);x:=d;
 a:='v_result jsonb:=''{}'';';
 if position(a in x)=0 then raise exception 'PWA_107_RESULT_DEFAULT_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'v_result jsonb:=''{}''::jsonb;');
 a:='v_created jsonb:=''[]'';';
 if position(a in x)=0 then raise exception 'PWA_107_CREATED_DEFAULT_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'v_created jsonb:=''[]''::jsonb;');
 a:='v_repeat integer;v_index integer;v_ordinal integer;';
 if position(a in x)=0 then raise exception 'PWA_107_LOOP_DECLARATION_SOURCE_MISMATCH';end if;
 -- Integer FOR loops declare their own index; the instruction revision is a
 -- separate scalar, so its name must not shadow the position loop index.
 x:=replace(x,a,'v_repeat integer;v_instruction_revision integer;');
 a:='into v_ordinal from app.pwa_instruction_versions';
 if position(a in x)=0 then raise exception 'PWA_107_INSTRUCTION_REVISION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'into v_instruction_revision from app.pwa_instruction_versions');
 a:='v_row.id,v_ordinal,p_payload->>''body''';
 if position(a in x)=0 then raise exception 'PWA_107_INSTRUCTION_INSERT_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'v_row.id,v_instruction_revision,p_payload->>''body''');
 a:='v_text text;';
 if position(a in x)=0 then raise exception 'PWA_107_UNUSED_TEXT_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'');
 a:='v_transfer uuid;';
 if position(a in x)=0 then raise exception 'PWA_107_UNUSED_TRANSFER_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'');
 a:='v_targets uuid[];';
 if position(a in x)=0 then raise exception 'PWA_107_UNUSED_TARGETS_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'');
 a:=$source$ if p_action='answer_question' then perform internal.pwa_notify(p_tenant_id,v_row.person_id,v_event,'Antwoord op je vraag','Je vraag heeft een antwoord gekregen.',coalesce(v_path,'/app/actions'));end if;$source$;
 if position(a in x)=0 then raise exception 'PWA_107_QUESTION_RECIPIENT_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$ if p_action='answer_question' then
  select q.person_id into strict v_target_person from app.pwa_questions q where q.tenant_id=p_tenant_id and q.id=p_resource_id;
  perform internal.pwa_notify(p_tenant_id,v_target_person,v_event,'Antwoord op je vraag','Je vraag heeft een antwoord gekregen.',coalesce(v_path,'/app/actions'));
 end if;$replacement$);
 a:=$source$    v_team:=(p_payload->>'receiving_team_id')::uuid;
    select t.version into strict v_version$source$;
 if position(a in x)=0 then raise exception 'PWA_107_CLUB_CREATE_SCOPE_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$    v_team:=(p_payload->>'receiving_team_id')::uuid;
    if not internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
    select t.version into strict v_version$replacement$);
 a:=$source$ when 'reserve_cluster' then
  v_team:=p_resource_id;v_season:=(p_payload->>'season_id')::uuid;$source$;
 if position(a in x)=0 then raise exception 'PWA_107_CLUSTER_SCOPE_SOURCE_MISMATCH';end if;
 x:=replace(x,a,a||$replacement$
  if not internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;$replacement$);
 -- The existing receiving-team predicate requires team membership. Central
 -- authority replaces that predicate only for reservation, never team actions.
 a:=$source$  if not internal.pwa_can_team(p_tenant_id,v_team) then raise exception using errcode='42501',message='FORBIDDEN';end if;$source$;
 if position(a in x)=0 then raise exception 'PWA_107_RECEIVING_SCOPE_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$  if p_action<>'reserve_cluster' and not internal.pwa_can_team(p_tenant_id,v_team) then raise exception using errcode='42501',message='FORBIDDEN';end if;$replacement$);
 execute x;
end;$commands$;

do $compatibility$ declare d text; a text; begin
 d:=pg_get_functiondef('internal.pwa_distribution(uuid,uuid,uuid)'::regprocedure);
 a:='counts jsonb:=''{}'';proposal jsonb:=''[]'';';
 if position(a in d)=0 then raise exception 'PWA_107_DISTRIBUTION_DEFAULT_SOURCE_MISMATCH';end if;
 execute replace(d,a,'counts jsonb:=''{}''::jsonb;proposal jsonb:=''[]''::jsonb;');
 d:=pg_get_functiondef('internal.pwa_revalidate_delivery(uuid,uuid,bigint)'::regprocedure);
 a:='v_items jsonb:=''[]'';';
 if position(a in d)=0 then raise exception 'PWA_107_DELIVERY_DEFAULT_SOURCE_MISMATCH';end if;
 execute replace(d,a,'v_items jsonb:=''[]''::jsonb;');
end;$compatibility$;
-- pg_is_in_recovery() is volatile. The trusted worker guard remains private.
alter function internal.pwa_automation_guard() volatile;

do $readmodels$ declare d text; x text; a text; begin
 d:=pg_get_functiondef('internal.pwa_snapshot(uuid,uuid,uuid)'::regprocedure);x:=d;
 a:=$source$'can_receive_club_tasks',exists(select 1 from app.committees c where c.tenant_id=p_tenant_id and internal.has_permission(p_tenant_id,'shift.manage','committee',c.id))$source$;
 if position(a in x)=0 then raise exception 'PWA_107_RECEIVING_CAPABILITY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$'can_receive_club_tasks',internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) and exists(select 1 from app.committees c where c.tenant_id=p_tenant_id and internal.has_permission(p_tenant_id,'shift.manage','committee',c.id))$replacement$);
 a:=$source$and (internal.has_permission(p_tenant_id,'team_task.manage','team',t.id) or exists(select 1 from app.committees c where c.tenant_id=p_tenant_id and internal.has_permission(p_tenant_id,'shift.manage','committee',c.id)))),'[]'));$source$;
 if position(a in x)=0 then raise exception 'PWA_107_RECEIVING_ROWS_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$and internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) and exists(select 1 from app.committees c where c.tenant_id=p_tenant_id and internal.has_permission(p_tenant_id,'shift.manage','committee',c.id))),'[]'));$replacement$);
 a:=$source$'can_reserve',s.starts_at>statement_timestamp() and pos.state='open' and internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id)$source$;
 if position(a in x)=0 then raise exception 'PWA_107_RESERVE_CAPABILITY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,a||$replacement$ and internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id)$replacement$);
 a:=$source$'reason',case when not internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id) then 'FORBIDDEN'$source$;
 if position(a in x)=0 then raise exception 'PWA_107_RESERVE_REASON_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$'reason',case when not internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id) or not internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) then 'FORBIDDEN'$replacement$);
 a:=$source$'can_manage',internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id),'can_confirm'$source$;
 if position(a in x)=0 then raise exception 'PWA_107_MARKET_DISTRIBUTION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$'can_manage',internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id),'can_reserve_club_tasks',internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) and internal.has_permission(p_tenant_id,'shift.manage','committee',s.committee_id),'can_confirm'$replacement$);
 a:=' return v_data;';
 if position(a in x)=0 then raise exception 'PWA_107_CONTEXT_SCOPE_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$replacement$ v_data:=jsonb_set(v_data,'{context,can_manage_club_clusters}',to_jsonb(internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id)));
$replacement$||a);
 execute x;
 d:=pg_get_functiondef('internal.pwa_receiving_team_proposals(uuid,uuid,uuid[])'::regprocedure);
 a:='begin';
 if position(a in d)=0 then raise exception 'PWA_107_PROPOSAL_SCOPE_SOURCE_MISMATCH';end if;
 -- Guard the read as well: no household suitability/counts for plain coordinators.
 execute replace(d,a,$replacement$begin
 if not internal.has_permission(p_tenant_id,'club_cluster.manage','tenant',p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;$replacement$);
end;$readmodels$;

-- Replacing a body must not broaden its execution or database authority.
do $authority$ begin
 if exists(select 1 from pwa_107_function_authority before join pg_proc after on after.oid=before.oid
 where before.proowner is distinct from after.proowner or before.proacl is distinct from after.proacl
 or before.prosecdef is distinct from after.prosecdef or before.proleakproof is distinct from after.proleakproof
 or before.proconfig is distinct from after.proconfig or before.prorettype is distinct from after.prorettype
 or before.proargtypes is distinct from after.proargtypes
 or (before.oid<>'internal.pwa_automation_guard()'::regprocedure and before.provolatile is distinct from after.provolatile))
 then raise exception 'PWA_107_FUNCTION_AUTHORITY_CHANGED';end if;
end;$authority$;
commit;
