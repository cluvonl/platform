-- An old queued/known-failed digest cannot consume a later day's send slot.
-- Revalidate the actual wall-clock day after taking the delivery lease lock.
-- Keep historical daily slots, receipts and unknown outcomes untouched.
begin;
do $dispatch_day$
declare d text;a text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
begin
 select proowner,proacl,proconfig,prosecdef into strict owner_before,acl_before,config_before,definer_before
 from pg_proc where oid='internal.pwa_revalidate_delivery(uuid,uuid,bigint)'::regprocedure;
 d:=pg_get_functiondef('internal.pwa_revalidate_delivery(uuid,uuid,bigint)'::regprocedure);
 a:=$source$and d.local_date=src.local_date and d.status in('queued','failed')$source$;
 if position(a in d)=0 then raise exception 'PWA_109_DIGEST_DAY_SOURCE_MISMATCH';end if;
 execute replace(d,a,$replacement$and d.local_date=src.local_date
   and d.local_date=(clock_timestamp() at time zone (select club.timezone from app.tenants club where club.id=o.tenant_id))::date
   and d.status in('queued','failed')$replacement$);
 if exists(select 1 from pg_proc where oid='internal.pwa_revalidate_delivery(uuid,uuid,bigint)'::regprocedure
  and (proowner is distinct from owner_before or proacl is distinct from acl_before
   or proconfig is distinct from config_before or prosecdef is distinct from definer_before))
 then raise exception 'PWA_109_DELIVERY_AUTHORITY_CHANGED';end if;
end;$dispatch_day$;
commit;
