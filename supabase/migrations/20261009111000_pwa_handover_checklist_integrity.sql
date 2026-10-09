-- Five typed choices are required independently of the web form. Empty arrays
-- have a NULL array_length and must never qualify for authority transfer.
begin;
do $handover_checks$
declare d text;a text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;volatility_before "char";
begin
 select proowner,proacl,proconfig,prosecdef,provolatile into strict owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure;
 d:=pg_get_functiondef('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure);
 a:=$source$v_checks:=array(select value::boolean from jsonb_array_elements_text(p_payload->'checks'));
  if array_length(v_checks,1)<>5 or array_position(v_checks,null) is not null or (p_action='prepare_handover' and array_position(v_checks,false) is not null) then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_111_CHECKLIST_SOURCE_MISMATCH';end if;
 d:=replace(d,a,$replacement$if jsonb_typeof(p_payload->'checks') is distinct from 'array' then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;
  if jsonb_array_length(p_payload->'checks')<>5 then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'checks') item(value) where jsonb_typeof(item.value) is distinct from 'boolean') then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;
  v_checks:=array(select value::boolean from jsonb_array_elements_text(p_payload->'checks'));
  if cardinality(v_checks) is distinct from 5 or array_position(v_checks,null) is not null or (p_action='prepare_handover' and array_position(v_checks,false) is not null) then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;$replacement$);
 a:=$source$if v_h.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  -- Successor is authorized by the named version, without a prior team-parent role.$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'PWA_111_ACCEPT_SOURCE_MISMATCH';end if;
 d:=replace(d,a,$replacement$if v_h.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if cardinality(v_h.checks) is distinct from 5 or array_ndims(v_h.checks) is distinct from 1 then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;
  if array_position(v_h.checks,null) is not null or array_position(v_h.checks,false) is not null then raise exception using errcode='22023',message='CHECKLIST_INCOMPLETE';end if;
  -- Successor is authorized by the named version, without a prior team-parent role.$replacement$);
 execute d;
 if exists(select 1 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure
  and(proowner is distinct from owner_before or proacl is distinct from acl_before or proconfig is distinct from config_before or prosecdef is distinct from definer_before or provolatile is distinct from volatility_before))then raise exception 'PWA_111_COMMAND_AUTHORITY_CHANGED';end if;
end;$handover_checks$;
-- NOT VALID then VALIDATE preserves every valid historical row; invalid legacy
-- rows stop the whole upgrade instead of silently accepting or rewriting them.
alter table app.pwa_handovers add constraint pwa_handover_five_boolean_checks
 check(case when cardinality(checks)=5 and array_ndims(checks)=1
  then array_position(checks,null) is null and(state not in('ready','accepted')or array_position(checks,false)is null)
  else false end) not valid;
alter table app.pwa_handovers validate constraint pwa_handover_five_boolean_checks;
commit;
