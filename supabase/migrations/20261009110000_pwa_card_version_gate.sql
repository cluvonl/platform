-- A record field in a CASE is planned even when its branch is not selected.
-- Read the checklist record only in the action which actually assigned it.
-- Preserve the card/checklist version rule and all dispatcher authority.
begin;
do $card_version_gate$
declare
 d text;a text;owner_before oid;acl_before aclitem[];config_before text[];
 definer_before boolean;volatility_before "char";
begin
 select proowner,proacl,proconfig,prosecdef,provolatile into strict
  owner_before,acl_before,config_before,definer_before,volatility_before
 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure;
 d:=pg_get_functiondef('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure);
 a:=$source$if (case when p_action='check_card_item' then v_other.version else v_row.version end)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;$source$;
 if (length(d)-length(replace(d,a,'')))/length(a)<>1
 then raise exception 'PWA_110_CARD_VERSION_SOURCE_MISMATCH';end if;
 execute replace(d,a,$replacement$if p_action='check_card_item' then
   if v_other.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  else
   if v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  end if;$replacement$);
 if exists(select 1 from pg_proc where oid='internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure
  and (proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before
   or provolatile is distinct from volatility_before))
 then raise exception 'PWA_110_COMMAND_AUTHORITY_CHANGED';end if;
end;$card_version_gate$;
commit;
