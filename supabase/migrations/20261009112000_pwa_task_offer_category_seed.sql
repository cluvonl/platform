-- The first canonical publication needs this category before an offer worker
-- can exist. Preserve registered IDs, names, essential flags and preferences.
begin;
insert into app.notification_categories(tenant_id,category_key,name,essential)
 select t.id,'task.offer','Nieuw passend aanbod',false from app.tenants t
 on conflict(tenant_id,category_key)do nothing;
create function internal.pwa_seed_task_offer_category()returns trigger
 language plpgsql security invoker set search_path='' as $$begin
 insert into app.notification_categories(tenant_id,category_key,name,essential)
 values(new.id,'task.offer','Nieuw passend aanbod',false)
 on conflict(tenant_id,category_key)do nothing;
 return new;
end;$$;
revoke all on function internal.pwa_seed_task_offer_category()from public,anon,authenticated,service_role,cluvo_command_owner;
create trigger pwa_seed_task_offer_category after insert on app.tenants
 for each row execute function internal.pwa_seed_task_offer_category();
commit;
