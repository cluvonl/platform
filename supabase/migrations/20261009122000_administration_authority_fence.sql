-- Take the tenant fence before existing native command authority checks. A
-- command and a lifecycle/access change cannot race past each other's check.
begin;
grant create on schema internal,api to cluvo_command_owner;
create function internal.club_admin_authority_fence(p_tenant_id uuid)returns void
language plpgsql volatile security definer set search_path='' as $$begin
 if p_tenant_id is null or not internal.actor_has_active_session() then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('cluvo-admin-tenant:'||p_tenant_id::text,0));
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
end;$$;
alter function internal.club_admin_authority_fence(uuid) owner to cluvo_command_owner;
revoke all on function internal.club_admin_authority_fence(uuid) from public,anon,authenticated,service_role;
grant execute on function internal.club_admin_authority_fence(uuid) to authenticated;
-- Fence the existing private handler, preserving each public API's exact SQL
-- binding, security mode, signature/defaults and ACL. No direct EXECUTE on
-- private handlers is added. Their original per-action authorization remains.
do $fence$ declare r record;source text;definition text;opening text;guard text;begin
 for r in select i.oid,i.proname,i.prosrc from pg_proc i join pg_namespace ni on ni.oid=i.pronamespace
 where ni.nspname='internal'and i.provolatile='v'and i.proargtypes[0]='uuid'::regtype and i.proargnames[1]='p_tenant_id'
 and i.prolang=(select oid from pg_language where lanname='plpgsql')and i.proname not like'platform_%'
 and exists(select 1 from pg_proc api join pg_namespace na on na.oid=api.pronamespace where na.nspname='api'and api.proname=i.proname and api.proargtypes=i.proargtypes)
 loop
  definition:=pg_get_functiondef(r.oid);
  opening:=substring(r.prosrc from '(?i)(?:^|\n|;)[[:space:]]*begin[[:space:];]');
  if opening is null or position(r.prosrc in definition)=0 or position('ADMIN_TENANT_AUTHORITY_FENCE'in r.prosrc)>0 then raise exception'ADMIN_FENCE_HANDLER_COHORT_MISMATCH';end if;
  guard:=opening||E'\n -- ADMIN_TENANT_AUTHORITY_FENCE\n perform internal.club_admin_authority_fence(p_tenant_id);\n perform internal.admin_assert_module(p_tenant_id,'||case when r.proname='pwa_command'then'p_action'else quote_literal(r.proname)end||E');\n';
  source:=overlay(r.prosrc placing guard from position(opening in r.prosrc)for length(opening));
  execute replace(definition,r.prosrc,source);
 end loop;
end;$fence$;
-- Versioned explanation identifiers retain the existing account preference
-- contract. A platform-only account may dismiss its own explanation too.
create or replace function internal.mark_help_seen(p_topic_id text)
returns table(topic_id text,seen_at timestamptz)language plpgsql security definer set search_path='' as $$
declare actor uuid:=internal.current_actor_uid();begin
 if not internal.actor_has_active_session() then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if not exists(select 1 from app.help_topics h where h.topic_id=p_topic_id) then raise exception using errcode='22023',message='UNKNOWN_HELP_TOPIC';end if;
 insert into app.user_help_seen(auth_user_id,topic_id) values(actor,p_topic_id) on conflict on constraint user_help_seen_pkey do nothing;
 return query select h.topic_id,h.seen_at from app.user_help_seen h where h.auth_user_id=actor and h.topic_id=p_topic_id;
end;$$;
revoke create on schema internal,api from cluvo_command_owner;
notify pgrst,'reload schema';
commit;
