-- Every changed resource needs its own captured version, including nested
-- bulk items and the canonical policy vector used by both API routes.
begin;
do $nested_versions$
declare
 d text;a text;r text;target regprocedure;
 owner_before oid;acl_before aclitem[];config_before text[];
 definer_before boolean;volatility_before "char";
begin
 target:='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure;
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid=target;
 d:=pg_get_functiondef(target);
 foreach a in array array[
  'if v_allocation.version<>(v_other.item->>''expected_version'')::bigint then raise exception using errcode=''40001'',message=''STALE_VERSION'';end if;',
  'if v_row.version<>(v_other.item->>''expected_version'')::bigint then raise exception using errcode=''40001'',message=''STALE_VERSION'';end if;'
 ]loop
  if (length(d)-length(replace(d,a,'')))/length(a)<>1
   then raise exception 'PWA_113_NESTED_VERSION_SOURCE_MISMATCH';end if;
  r:=$replacement$if jsonb_typeof(v_other.item->'expected_version') is distinct from 'number'
    or (v_other.item->>'expected_version') !~ '^[1-9][0-9]*$'
   then raise exception using errcode='22023',message='EXPECTED_VERSION_REQUIRED';end if;
   $replacement$||replace(a,'.version<>','.version is distinct from ');
  d:=replace(d,a,r);
 end loop;
 a:=$source$if jsonb_typeof(p_payload->'assignment_ids')<>'array' or jsonb_typeof(p_payload->'expected_versions')<>'array' or jsonb_array_length(p_payload->'assignment_ids') not between 1 and 50 or jsonb_array_length(p_payload->'expected_versions')<>jsonb_array_length(p_payload->'assignment_ids') then raise exception using errcode='22023',message='INVALID_COMMAND';end if;$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_113_POLICY_VECTOR_SOURCE_MISMATCH';end if;
 d:=replace(d,a,$replacement$if jsonb_typeof(p_payload->'assignment_ids') is distinct from 'array' or jsonb_typeof(p_payload->'expected_versions') is distinct from 'array' then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  if jsonb_array_length(p_payload->'assignment_ids') not between 1 and 50 or jsonb_array_length(p_payload->'expected_versions')<>jsonb_array_length(p_payload->'assignment_ids') then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'expected_versions') item(value)
   where jsonb_typeof(item.value) is distinct from 'number' or item.value#>>'{}' !~ '^[1-9][0-9]*$')
  then raise exception using errcode='22023',message='EXPECTED_VERSION_REQUIRED';end if;$replacement$);
 execute d;
 if exists(select 1 from pg_proc where oid=target
  and(proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))
 then raise exception 'PWA_113_COMMAND_AUTHORITY_CHANGED';end if;

 target:='internal.accept_policy_assignments(uuid,uuid[],bigint[],text,boolean,uuid)'::regprocedure;
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid=target;
 d:=pg_get_functiondef(target);
 a:=$source$or cardinality(p_assignment_ids) <> cardinality(p_expected_versions)$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_113_CANONICAL_POLICY_VECTOR_SOURCE_MISMATCH';end if;
 d:=replace(d,a,$replacement$or cardinality(p_assignment_ids) is distinct from cardinality(p_expected_versions)
    or array_ndims(p_assignment_ids) is distinct from 1
    or array_lower(p_assignment_ids,1) is distinct from 1
    or array_ndims(p_expected_versions) is distinct from 1
    or array_lower(p_expected_versions,1) is distinct from 1
    or exists(select 1 from unnest(p_assignment_ids) item(id) where item.id is null)
    or exists(select 1 from unnest(p_expected_versions) item(version) where item.version is null or item.version<1)$replacement$);
 a:=$source$if v_assignment.version <> p_expected_versions[v_index] then$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
  then raise exception 'PWA_113_CANONICAL_POLICY_COMPARISON_SOURCE_MISMATCH';end if;
 d:=replace(d,a,'if v_assignment.version is distinct from p_expected_versions[v_index] then');
 execute d;
 if exists(select 1 from pg_proc where oid=target
  and(proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))
 then raise exception 'PWA_113_POLICY_AUTHORITY_CHANGED';end if;
end;$nested_versions$;
commit;
