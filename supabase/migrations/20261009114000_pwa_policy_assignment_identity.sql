-- Assigned policy identity follows the exact historical version, never the
-- document's latest draft. Read access and permission to act stay distinct.
begin;
create function internal.pwa_can_accept_policy(p_tenant_id uuid,p_assignment_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select internal.is_active_member(p_tenant_id)
  and internal.can_person_act_on_policy_assignment(p_tenant_id,internal.current_person_id(p_tenant_id),p_assignment_id);
$$;
alter function internal.pwa_can_accept_policy(uuid,uuid) owner to cluvo_command_owner;
revoke all on function internal.pwa_can_accept_policy(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function internal.pwa_can_accept_policy(uuid,uuid) to authenticated;
create view api.pwa_policy_assignments with(security_invoker=true) as
 select assigned.id,assigned.tenant_id,assigned.member_person_id,assigned.state,
  assigned.offered_at,assigned.opened_at,assigned.due_at,assigned.reminder_paused,
  assigned.version,assigned.policy_version_id,assigned.policy_revision,
  assigned.exact_body,assigned.version_hash,assigned.effective_at,
  version_row.document_id as policy_document_id,document_row.title as policy_document_title,
  version_row.published_at,
  internal.pwa_can_accept_policy(assigned.tenant_id,assigned.id) as is_actor_subject,
  (internal.pwa_can_accept_policy(assigned.tenant_id,assigned.id)
   and version_row.state='published' and assigned.state in('offered','opened','question_pending')) as can_accept
 from api.my_policy_assignments assigned
 join app.policy_versions version_row on version_row.tenant_id=assigned.tenant_id and version_row.id=assigned.policy_version_id
 join app.policy_documents document_row on document_row.tenant_id=version_row.tenant_id and document_row.id=version_row.document_id;
revoke all on api.pwa_policy_assignments from public,anon,authenticated,service_role;
grant select on api.pwa_policy_assignments to authenticated;

do $policy_identity$
declare d text;a text;owner_before oid;acl_before aclitem[];config_before text[];
 definer_before boolean;volatility_before "char";
begin
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure;
 d:=pg_get_functiondef('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure);
 a:=$source$when 'accept_policy' then array['assignment_ids','expected_versions','capacity','explicit_confirmation']$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_114_OPEN_POLICY_WHITELIST_SOURCE_MISMATCH';end if;
 d:=replace(d,a,'when ''open_policy'' then array[''assignment_ids'',''expected_versions''] '||a);
 a:=$source$when 'accept_policy' then
  if jsonb_typeof(p_payload->'assignment_ids') is distinct from 'array'$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_114_OPEN_POLICY_BRANCH_SOURCE_MISMATCH';end if;
 d:=replace(d,a,replace(a,'when ''accept_policy'' then','when ''open_policy'',''accept_policy'' then'));
 a:=$source$  v_result:=internal.accept_policy_assignments(p_tenant_id,array(select value::uuid from jsonb_array_elements_text(p_payload->'assignment_ids')),array(select value::bigint from jsonb_array_elements_text(p_payload->'expected_versions')),p_payload->>'capacity',(p_payload->>'explicit_confirmation')::boolean,v_inner_key);$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_114_POLICY_IDENTITY_SOURCE_MISMATCH';end if;
 d:=replace(d,a,$replacement$  -- Match the document the user actually read; assignment versions remain
  -- separate optimistic locks, checked by the unchanged canonical command.
  if exists(select 1 from jsonb_array_elements(p_payload->'assignment_ids') item(value)
    where jsonb_typeof(item.value) is distinct from 'string'
     or item.value#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  if (select count(distinct value::uuid) from jsonb_array_elements_text(p_payload->'assignment_ids'))
      <>jsonb_array_length(p_payload->'assignment_ids')
  then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  perform 1 from app.policy_assignments assignment_row where assignment_row.tenant_id=p_tenant_id
   and assignment_row.id=any(array(select value::uuid from jsonb_array_elements_text(p_payload->'assignment_ids')))
   order by assignment_row.id for update;
  if exists(select 1 from jsonb_array_elements_text(p_payload->'assignment_ids') item(id)
   where not exists(select 1 from app.policy_assignments assignment_row
    where assignment_row.tenant_id=p_tenant_id and assignment_row.id=item.id::uuid
     and internal.can_person_act_on_policy_assignment(p_tenant_id,v_person,assignment_row.id)))
  then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if exists(select 1 from app.policy_assignments assignment_row where assignment_row.tenant_id=p_tenant_id
    and assignment_row.id=any(array(select value::uuid from jsonb_array_elements_text(p_payload->'assignment_ids')))
    and assignment_row.policy_version_id is distinct from p_resource_id)
   or not exists(select 1 from app.policy_versions version_row where version_row.tenant_id=p_tenant_id
    and version_row.id=p_resource_id and version_row.revision=p_expected_version)
  then raise exception using errcode='40001',message='POLICY_VERSION_CHANGED';end if;
$replacement$||$open$  if p_action='open_policy' then
   if exists(select 1 from app.policy_assignments assignment_row where assignment_row.tenant_id=p_tenant_id
     and assignment_row.id=any(array(select value::uuid from jsonb_array_elements_text(p_payload->'assignment_ids')))
     and assignment_row.state='expired')
   then raise exception using errcode='55000',message='POLICY_NOT_OPENABLE';end if;
   if not exists(select 1 from app.policy_versions version_row where version_row.tenant_id=p_tenant_id
     and version_row.id=p_resource_id and version_row.state='published')
   then raise exception using errcode='55000',message='POLICY_NOT_PUBLISHED';end if;
   v_result:='[]'::jsonb;
   for v_other in select assignment_item.value as id,version_item.value as expected_version
    from jsonb_array_elements_text(p_payload->'assignment_ids') with ordinality assignment_item(value,ordinal)
    join jsonb_array_elements_text(p_payload->'expected_versions') with ordinality version_item(value,ordinal)
     on version_item.ordinal=assignment_item.ordinal order by assignment_item.value
   loop
    v_result:=v_result||jsonb_build_array(internal.record_policy_open(p_tenant_id,v_other.id::uuid,v_other.expected_version::bigint,md5(v_inner_key::text||':open:'||v_other.id)::uuid));
   end loop;
  else
$open$||a||chr(10)||'  end if;');
 -- Opening is a per-command read acknowledgement; different readers must
 -- neither collide on a shared document/version nor receive a notification.
 a:=$source$'reset_help','dismiss_help','mark_all_inbox_read','confirm_attendance_batch','accept_policy','start_profile','revoke_push_subscription','apply_distribution','request_reserve'$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>3 then raise exception 'PWA_114_OPEN_POLICY_EVENT_SOURCE_MISMATCH';end if;
 d:=replace(d,a,a||',''open_policy''');
 a:=$source$if p_action not in ('dismiss_help','reset_help','mark_inbox_read','mark_all_inbox_read','save_preferences','save_push_subscription','revoke_push_subscription') then perform internal.pwa_notify$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_114_OPEN_POLICY_NOTIFICATION_SOURCE_MISMATCH';end if;
 d:=replace(d,a,replace(a,'''revoke_push_subscription'')','''revoke_push_subscription'',''open_policy'')'));
 execute d;
 if exists(select 1 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure
  and(proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))then raise exception 'PWA_114_COMMAND_AUTHORITY_CHANGED';end if;
 -- Direct native callers need the same captured-version integrity as the
 -- typed PWA vector. Read registration cannot advance without a version.
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid='internal.record_policy_open(uuid,uuid,bigint,uuid)'::regprocedure;
 d:=pg_get_functiondef('internal.record_policy_open(uuid,uuid,bigint,uuid)'::regprocedure);
 a:=$source$  v_request_hash := extensions.digest(convert_to(jsonb_build_object(
    'assignment_id', p_assignment_id, 'expected_version', p_expected_version$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_114_NATIVE_OPEN_VERSION_SOURCE_MISMATCH';end if;
 d:=replace(d,a,$replacement$  if p_expected_version is null or p_expected_version<=0 then
    raise exception using errcode='22023',message='EXPECTED_VERSION_REQUIRED';
  end if;
$replacement$||a);
 a:=$source$if v_assignment.version <> p_expected_version then$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_114_NATIVE_OPEN_COMPARATOR_SOURCE_MISMATCH';end if;
 d:=replace(d,a,'if v_assignment.version is distinct from p_expected_version then');
 execute d;
 if exists(select 1 from pg_proc where oid='internal.record_policy_open(uuid,uuid,bigint,uuid)'::regprocedure
  and(proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))then raise exception 'PWA_114_NATIVE_OPEN_AUTHORITY_CHANGED';end if;
end;$policy_identity$;
commit;
