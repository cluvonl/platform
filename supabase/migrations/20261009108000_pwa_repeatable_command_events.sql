-- Bulk and acknowledgement actions have a command identity, not a shared
-- tenant/version-one resource identity. Keep the actual resource receipt,
-- actor, audit, native guards, payload validation and idempotency unchanged.
begin;
do $commands$
declare
 d text; a text; original_owner oid; original_acl aclitem[];
 original_definer boolean; original_config text[];
begin
 select proowner,proacl,prosecdef,proconfig into strict
  original_owner,original_acl,original_definer,original_config
 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure;
 d:=pg_get_functiondef('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure);
 a:=$source$ values(v_event,p_tenant_id,'pwa_resource',v_id,v_version,'pwa.'||p_action,jsonb_build_object('resource_id',v_id));$source$;
 if position(a in d)=0 then raise exception 'PWA_108_COMMAND_EVENT_SOURCE_MISMATCH';end if;
 execute replace(d,a,$replacement$ values(v_event,p_tenant_id,
  case when p_action in('reset_help','dismiss_help','mark_all_inbox_read','confirm_attendance_batch','accept_policy','start_profile','revoke_push_subscription','apply_distribution','request_reserve') then 'pwa_command' else 'pwa_resource' end,
  case when p_action in('reset_help','dismiss_help','mark_all_inbox_read','confirm_attendance_batch','accept_policy','start_profile','revoke_push_subscription','apply_distribution','request_reserve') then v_event else v_id end,
  case when p_action in('reset_help','dismiss_help','mark_all_inbox_read','confirm_attendance_batch','accept_policy','start_profile','revoke_push_subscription','apply_distribution','request_reserve') then 1 else v_version end,
  'pwa.'||p_action,jsonb_build_object('resource_id',v_id));$replacement$);
 if exists(select 1 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure
  and (proowner is distinct from original_owner or proacl is distinct from original_acl
   or prosecdef is distinct from original_definer or proconfig is distinct from original_config))
 then raise exception 'PWA_108_COMMAND_AUTHORITY_CHANGED';end if;
end;$commands$;
commit;
