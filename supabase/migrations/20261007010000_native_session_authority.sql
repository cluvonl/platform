-- Require the currently existing native session, not just an unexpired signature.
-- Application/permission histories and existing RPC signatures are unchanged.
begin;

create function internal.current_actor_session_id()
returns uuid language sql stable security invoker set search_path = ''
begin atomic
  select case when (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'session_id')
    ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then (nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'session_id')::uuid end;
end;
alter function internal.current_actor_session_id() owner to cluvo_command_owner;
revoke all on function internal.current_actor_session_id() from public, anon, authenticated, service_role;

grant select (id,user_id,not_after) on auth.sessions to cluvo_command_owner;
create policy cluvo_current_session_read on auth.sessions for select to cluvo_command_owner
  using (user_id = (select internal.current_actor_uid()) and id = (select internal.current_actor_session_id()));

-- Bound references survive Auth restoring the schema ACL on startup. Only the
-- existing five identity columns and three session columns are readable.
create function internal.actor_has_active_session()
returns boolean language sql stable security definer set search_path = ''
begin atomic
  select exists (select 1 from auth.users as identity join auth.sessions as session
    on session.user_id=identity.id and session.id=internal.current_actor_session_id()
    where identity.id=internal.current_actor_uid()
      and identity.email_confirmed_at is not null and identity.deleted_at is null
      and (identity.banned_until is null or identity.banned_until <= statement_timestamp())
      and (session.not_after is null or session.not_after > statement_timestamp()));
end;
alter function internal.actor_has_active_session() owner to cluvo_command_owner;
revoke all on function internal.actor_has_active_session() from public, anon, service_role;
grant execute on function internal.actor_has_active_session() to authenticated;

create or replace function internal.actor_has_verified_email()
returns boolean language sql stable security invoker set search_path = ''
begin atomic
  select internal.actor_has_active_session() and exists (select 1 from auth.users as identity
    where identity.id = internal.current_actor_uid()
      and lower(identity.email) = internal.current_actor_email()
      and identity.email_confirmed_at is not null and identity.deleted_at is null
      and (identity.banned_until is null or identity.banned_until <= statement_timestamp()));
end;
alter function internal.actor_has_verified_email() owner to cluvo_command_owner;
revoke all on function internal.actor_has_verified_email() from public, anon, authenticated, service_role;

create or replace function internal.is_active_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select internal.actor_has_active_session()
    and exists (
      select 1
      from app.tenant_memberships as membership
      join app.tenants as tenant
        on tenant.id = membership.tenant_id
       and tenant.status = 'active'
      where membership.tenant_id = p_tenant_id
        and membership.auth_user_id = (select internal.current_actor_uid())
        and membership.status = 'active'
        and membership.starts_at <= statement_timestamp()
        and (membership.ends_at is null or membership.ends_at > statement_timestamp())
    );
$function$;

-- Guard every currently callable human command, including direct private
-- execution. Preserve each signature, owner, ACL and existing domain body.
-- Future commands and app tables must explicitly carry the same native guard.
do $commands$
declare v_command record; v_definition text; v_body text;
begin
 for v_command in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  join pg_language l on l.oid=p.prolang
  where n.nspname='internal' and p.provolatile='v' and l.lanname='plpgsql'
   and p.prorettype<>'trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE')
  order by p.oid loop
  if v_command.prosrc !~* '\mbegin\M' then raise exception 'UNSUPPORTED_COMMAND_BODY'; end if;
  v_body:=regexp_replace(v_command.prosrc,'\mbegin\M',
   E'begin\n  -- NATIVE_SESSION_COMMAND_GUARD\n  if not internal.actor_has_active_session() then\n    raise exception using errcode=''42501'', message=''FORBIDDEN'';\n  end if;', 'i');
  v_definition:=pg_get_functiondef(v_command.oid);
  v_definition:=replace(v_definition,v_command.prosrc,v_body);
  execute v_definition;
 end loop;
end;
$commands$;

-- Apply an additional restrictive guard to every current application table.
-- Existing tenant/subject policies still decide which rows a live user sees.
do $guard$
declare v_table record;
begin
  for v_table in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='app' and c.relkind='r' order by c.relname loop
    execute format('create policy native_session_required on app.%I as restrictive for all to authenticated using ((select internal.actor_has_active_session())) with check ((select internal.actor_has_active_session()))',v_table.relname);
  end loop;
end;
$guard$;

commit;
