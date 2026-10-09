-- Separate platform authority. No platform permission is a club/dossier grant.
begin;
grant create on schema internal, api to cluvo_command_owner;

create table app.platform_access_grants (
 id uuid primary key default gen_random_uuid(), auth_user_id uuid not null references auth.users(id) on delete restrict,
 display_name text not null check(length(display_name) between 1 and 150),
 permission_key text not null check(permission_key in ('platform.overview','platform.tenant.read','platform.tenant.manage','platform.access.manage','platform.config.manage','platform.integration.manage','platform.support','platform.audit.read')),
 tenant_scope_id uuid references app.tenants(id) on delete restrict,
 starts_at timestamptz not null default statement_timestamp(), ends_at timestamptz not null,
 revoked_at timestamptz, granted_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
 version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(),
 check(ends_at>starts_at), check(revoked_at is null or revoked_at>=starts_at)
);
create index platform_grants_actor on app.platform_access_grants(auth_user_id,permission_key,tenant_scope_id) where revoked_at is null;
create table app.platform_tenant_profiles (
 tenant_id uuid primary key references app.tenants(id) on delete restrict,
 contact_name text not null default '' check(length(contact_name)<=150), contact_email text not null default '' check(length(contact_email)<=254),
 adopted_defaults jsonb not null default '{}'::jsonb check(jsonb_typeof(adopted_defaults)='object'),
 onboarding_steps jsonb not null default '{"identity":false,"administrator":false,"season":false,"tasks":false,"integration":false}'::jsonb,
 version bigint not null default 1 check(version>0), changed_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default statement_timestamp(), check(jsonb_typeof(onboarding_steps)='object')
);
create table app.platform_module_settings (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id) on delete restrict,
 module_key text not null check(module_key in ('planning','teams','courses','policies','communication','sportlink','reporting')),
 enabled boolean not null default true, version bigint not null default 1 check(version>0),
 changed_by_auth_user_id uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default statement_timestamp(), unique(tenant_id,module_key)
);
create table app.platform_defaults (
 id uuid primary key default gen_random_uuid(), setting_key text not null unique check(setting_key in ('organization','planning','communication','template')),
 value_json jsonb not null check(jsonb_typeof(value_json)='object'), version bigint not null default 1 check(version>0),
 changed_by_auth_user_id uuid not null references auth.users(id) on delete restrict, updated_at timestamptz not null default statement_timestamp()
);
create table app.platform_support_requests (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id) on delete restrict,
 employee_auth_user_id uuid not null references auth.users(id) on delete restrict,
 purpose text not null check(length(purpose) between 10 and 1000), permission_keys text[] not null,
 scope_kind text not null check(scope_kind in ('tenant','committee','team')),scope_id uuid,
 ends_at timestamptz not null, state text not null default 'requested' check(state in ('requested','approved','rejected','revoked')),
 consented_by_auth_user_id uuid references auth.users(id) on delete restrict, consented_at timestamptz,
 access_grant_id uuid, version bigint not null default 1 check(version>0),created_at timestamptz not null default statement_timestamp(),
 check((scope_kind='tenant' and scope_id is null) or (scope_kind<>'tenant' and scope_id is not null)),
 check(cardinality(permission_keys) between 1 and 8), check(ends_at>created_at and ends_at<=created_at+interval '24 hours'),
 foreign key(tenant_id,access_grant_id) references app.access_grants(tenant_id,id) on delete restrict
);
create index platform_support_tenant on app.platform_support_requests(tenant_id,state,ends_at);
create table app.platform_command_receipts (
 actor_auth_user_id uuid not null references auth.users(id) on delete restrict, idempotency_key uuid not null,
 action text not null, request_hash bytea not null, resource_id uuid not null, result jsonb not null,
 completed_at timestamptz not null default statement_timestamp(),primary key(actor_auth_user_id,idempotency_key)
);
create table app.platform_audit_events (
 id uuid primary key default gen_random_uuid(), actor_auth_user_id uuid not null references auth.users(id) on delete restrict,
 tenant_id uuid references app.tenants(id) on delete restrict, action text not null,resource_id uuid not null,
 expected_version bigint not null, resulting_version bigint not null, idempotency_key uuid not null,
 reason text not null check(length(reason) between 3 and 1000), occurred_at timestamptz not null default statement_timestamp(),
 unique(actor_auth_user_id,idempotency_key,action,resource_id)
);
create index platform_audit_filter on app.platform_audit_events(tenant_id,action,occurred_at);
create trigger platform_audit_immutable before update or delete on app.platform_audit_events for each row execute function internal.reject_immutable_change();

do $security$ declare n text;begin
 foreach n in array array['platform_access_grants','platform_tenant_profiles','platform_module_settings','platform_defaults','platform_support_requests','platform_command_receipts','platform_audit_events'] loop
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('grant select,insert,update on app.%I to cluvo_command_owner',n);
  execute format('create policy platform_command_owner on app.%I for all to cluvo_command_owner using(true) with check(true)',n);
  execute format('create policy native_session_required on app.%I as restrictive for all to authenticated using((select internal.actor_has_active_session()))with check((select internal.actor_has_active_session()))',n);
 end loop;
end;$security$;
revoke update on app.platform_audit_events,app.platform_command_receipts from cluvo_command_owner;
grant select,insert,update on app.tenants,app.tenant_memberships,app.account_person_links,app.persons,app.permission_roles,app.role_permissions,app.access_grants,app.seasons to cluvo_command_owner;
do $writers$ declare n text;begin
 foreach n in array array['tenants','tenant_memberships','account_person_links','persons','permission_roles','role_permissions','access_grants','seasons'] loop
  execute format('create policy admin_organization_writer on app.%I for all to cluvo_command_owner using(true) with check(true)',n);
 end loop;
end;$writers$;

create function internal.platform_can(p_permission text,p_tenant uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select internal.actor_has_active_session() and exists(select 1 from app.platform_access_grants g
 where g.auth_user_id=internal.current_actor_uid() and g.permission_key=p_permission and g.revoked_at is null
 and g.starts_at<=statement_timestamp() and g.ends_at>statement_timestamp()
 and (g.tenant_scope_id is null or p_tenant is not null and g.tenant_scope_id=p_tenant));
$$;
-- Bounded account selection for an explicit appointment. No directory is
-- exposed, and a lookup does not confer access or create an Auth identity.
create function internal.admin_verified_platform_account(p_uid uuid)returns boolean
language sql stable security definer set search_path=''begin atomic
 select exists(select 1 from auth.users u where u.id=p_uid and u.email_confirmed_at is not null
 and u.deleted_at is null and(u.banned_until is null or u.banned_until<=statement_timestamp()));
end;
alter function internal.admin_verified_platform_account(uuid)owner to postgres;
revoke all on function internal.admin_verified_platform_account(uuid)from public,anon,authenticated,service_role;
grant execute on function internal.admin_verified_platform_account(uuid)to cluvo_command_owner;

create function internal.admin_platform_account_choice(p_email text,p_purpose text,p_tenant uuid default null)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare uid uuid;label text;begin
 if not internal.actor_has_active_session()then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_purpose='staff'then
  if p_tenant is not null or not internal.platform_can('platform.access.manage')then raise exception using errcode='42501',message='FORBIDDEN';end if;
 elsif p_purpose='initial_administrator'then
  if p_tenant is null or not internal.platform_can('platform.tenant.manage',p_tenant)then raise exception using errcode='42501',message='FORBIDDEN';end if;
  if not exists(select 1 from app.tenants t where t.id=p_tenant and t.status='preparing')
   or exists(select 1 from app.access_grants where tenant_id=p_tenant)
   or exists(select 1 from app.persons where tenant_id=p_tenant)
   or exists(select 1 from app.households where tenant_id=p_tenant)
   or exists(select 1 from app.obligations where tenant_id=p_tenant)then raise exception using errcode='55000',message='INITIAL_ONBOARDING_ONLY';end if;
 else raise exception using errcode='22023',message='INVALID_PURPOSE';end if;
 if length(coalesce(p_email,''))not between 3 and 254 or btrim(p_email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'then raise exception using errcode='22023',message='INVALID_EMAIL';end if;
 select u.id,coalesce(nullif(btrim(p.display_name),''),'Geverifieerd persoonlijk account')into uid,label
 from auth.users u left join app.account_profiles p on p.auth_user_id=u.id
 where lower(u.email)=lower(btrim(p_email))and internal.admin_verified_platform_account(u.id)
 order by u.id limit 1;
 if uid is null then return jsonb_build_object('found',false);end if;
 return jsonb_build_object('found',true,'auth_user_id',uid,'label',label);
end;$$;
alter function internal.admin_platform_account_choice(text,text,uuid)owner to postgres;
revoke all on function internal.admin_platform_account_choice(text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function internal.admin_platform_account_choice(text,text,uuid)to authenticated;
-- Expose a yes/no operational retry proof, never raw worker receipts.
create function internal.admin_delivery_retry_safe(p_tenant uuid,p_target uuid)returns boolean
language sql stable security definer set search_path=''begin atomic
 select internal.actor_has_active_session()and internal.platform_can('platform.integration.manage',p_tenant)
 and not exists(select 1 from app.pwa_provider_receipts r where r.tenant_id=p_tenant and r.target_id=p_target)
 and exists(select 1 from app.pwa_delivery_targets target join app.pwa_delivery_outbox o on o.tenant_id=target.tenant_id and o.id=target.outbox_id
  join app.pwa_delivery_attempt_log a on a.tenant_id=target.tenant_id and a.target_id=target.id and a.attempt=target.attempts
  where target.tenant_id=p_tenant and target.id=p_target and target.state='failed'and target.attempts between 1 and 4
  -- Native completion retains lease metadata; terminal state plus the
  -- exact recorded attempt proves completion. An active lease has state leased.
  and a.state='failed'and a.provider_status=target.provider_status
  and(a.provider_status=429 or o.channel='push'and a.provider_status in(500,502,503,504))
  and not exists(select 1 from app.pwa_delivery_attempt_log unknown_attempt where unknown_attempt.tenant_id=target.tenant_id and unknown_attempt.target_id=target.id and unknown_attempt.state in('sent','unknown')));
end;
alter function internal.admin_delivery_retry_safe(uuid,uuid)owner to postgres;
revoke all on function internal.admin_delivery_retry_safe(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function internal.admin_delivery_retry_safe(uuid,uuid)to cluvo_command_owner;
grant select(id,tenant_id,outbox_id,state,lease_owner,lease_until,attempts,next_attempt_at,provider_status,version,created_at),update(next_attempt_at,version)on app.pwa_delivery_targets to cluvo_command_owner;
create policy platform_delivery_read on app.pwa_delivery_targets for select to cluvo_command_owner using(internal.platform_can('platform.integration.manage',tenant_id));
create policy platform_delivery_retry on app.pwa_delivery_targets for update to cluvo_command_owner using(internal.platform_can('platform.integration.manage',tenant_id))with check(internal.platform_can('platform.integration.manage',tenant_id));

-- The immutable V1 seed trigger runs with the restricted command owner. Only
-- its exact canonical first rule may omit a human approver during onboarding.
create policy platform_canonical_reminder_seed on app.pwa_reminder_rules
 for insert to cluvo_command_owner with check(
 pg_trigger_depth()>0 and revision=1 and offset_minutes=array[10080,1440]
 and approval_kind='canon_default' and approved_by_auth_user_id is null
 and reason='V1: zeven dagen en 24 uur voor de dienst'
 and internal.platform_can('platform.tenant.manage')
 and exists(select 1 from app.tenants t where t.id=tenant_id and t.status='preparing')
 );
create function internal.platform_access() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('authorized',internal.actor_has_active_session() and exists(select 1 from app.platform_access_grants g
 where g.auth_user_id=internal.current_actor_uid() and g.revoked_at is null and g.starts_at<=statement_timestamp() and g.ends_at>statement_timestamp()),
 'permissions',coalesce((select jsonb_agg(jsonb_build_object('key',g.permission_key,'tenant_id',g.tenant_scope_id)) from app.platform_access_grants g
 where internal.actor_has_active_session() and g.auth_user_id=internal.current_actor_uid() and g.revoked_at is null and g.starts_at<=statement_timestamp() and g.ends_at>statement_timestamp()),'[]'::jsonb));
$$;

create function internal.platform_tenant_impact(p_tenant uuid,p_status text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v app.tenants%rowtype;r jsonb;begin
 if not internal.platform_can('platform.tenant.manage',p_tenant) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_status<>all(array['preparing','active','suspended','archived']) then raise exception using errcode='22023',message='INVALID_STATUS';end if;
 select * into strict v from app.tenants where id=p_tenant;
 r:=jsonb_build_object('tenant_id',v.id,'version',v.version,'from',v.status,'to',p_status,
 'active_memberships',(select count(*) from app.tenant_memberships where tenant_id=p_tenant and status='active' and starts_at<=statement_timestamp() and (ends_at is null or ends_at>statement_timestamp())),
 'future_bookings',(select count(*) from app.bookings where tenant_id=p_tenant and ends_at_snapshot>statement_timestamp() and state in ('booked','performed_pending')),
 'pending_deliveries',(select count(*) from app.pwa_delivery_outbox where tenant_id=p_tenant and state='pending'),
 'history_deleted',false,'member_access_after',p_status='active');
 return r||jsonb_build_object('impact_hash',encode(extensions.digest(convert_to(r::text,'UTF8'),'sha256'),'hex'));
end;$$;

-- Invitations are named, finite offers. They confer no membership or grant
-- until the verified recipient accepts the unchanged offer.
create table app.admin_access_invitations(
 id uuid primary key,tenant_id uuid not null references app.tenants(id),
 invited_auth_user_id uuid not null references auth.users(id),
 invited_by_auth_user_id uuid not null references auth.users(id),
 invitation_kind text not null check(invitation_kind in('initial','club')),
 given_name text,family_name text,role_id uuid,
 permission_keys text[] not null check(cardinality(permission_keys) between 1 and 60),
 scope_kind text not null check(scope_kind in('tenant','committee','team','household')),scope_id uuid,
 ends_at timestamptz not null,expires_at timestamptz not null,
 state text not null default 'pending'check(state in('pending','accepted','declined','cancelled')),
 version bigint not null default 1 check(version>0),created_at timestamptz not null default statement_timestamp(),
 responded_at timestamptz,access_grant_id uuid,
 foreign key(tenant_id,role_id)references app.permission_roles(tenant_id,id),
 foreign key(tenant_id,access_grant_id)references app.access_grants(tenant_id,id),
 check((scope_kind='tenant')=(scope_id is null)),check(expires_at<=ends_at),
 check((invitation_kind='initial')=(role_id is null)),
 check((state='accepted')=(access_grant_id is not null)),
 check((state='pending')=(responded_at is null))
);
create unique index admin_invitation_pending on app.admin_access_invitations(tenant_id,invited_auth_user_id)
 where state='pending';
alter table app.admin_access_invitations enable row level security;
alter table app.admin_access_invitations force row level security;
revoke all on app.admin_access_invitations from public,anon,authenticated,service_role;
grant select,insert,update on app.admin_access_invitations to cluvo_command_owner;
create policy command_owner on app.admin_access_invitations for all to cluvo_command_owner using(true)with check(true);
create policy native_session_required on app.admin_access_invitations as restrictive for all to authenticated
 using((select internal.actor_has_active_session()))with check((select internal.actor_has_active_session()));

create function internal.admin_invitation_authorized(r app.admin_access_invitations)returns boolean
language plpgsql stable security definer set search_path=''as $$
begin
 if not internal.admin_verified_platform_account(r.invited_by_auth_user_id)
 or not internal.admin_verified_platform_account(r.invited_auth_user_id)then return false;end if;
 if r.invitation_kind='initial'then
  return exists(select 1 from app.tenants where id=r.tenant_id and status='preparing')
   and not exists(select 1 from app.access_grants where tenant_id=r.tenant_id)
   and not exists(select 1 from app.persons where tenant_id=r.tenant_id)
   and not exists(select 1 from app.households where tenant_id=r.tenant_id)
   and not exists(select 1 from app.obligations where tenant_id=r.tenant_id)
   and exists(select 1 from app.platform_access_grants g where g.auth_user_id=r.invited_by_auth_user_id
    and g.permission_key='platform.tenant.manage' and(g.tenant_scope_id is null or g.tenant_scope_id=r.tenant_id)
    and g.revoked_at is null and g.starts_at<=statement_timestamp()and g.ends_at>=r.ends_at);
 end if;
 return exists(select 1 from app.tenants where id=r.tenant_id and status='active')
 and exists(select 1 from app.tenant_memberships m where m.tenant_id=r.tenant_id and m.auth_user_id=r.invited_auth_user_id
  and m.status='active'and m.starts_at<=statement_timestamp()and(m.ends_at is null or m.ends_at>statement_timestamp()))
 and exists(select 1 from app.tenant_memberships m where m.tenant_id=r.tenant_id and m.auth_user_id=r.invited_by_auth_user_id
  and m.status='active'and m.starts_at<=statement_timestamp()and(m.ends_at is null or m.ends_at>=r.ends_at))
 and r.permission_keys=(select array_agg(permission_key order by permission_key)from app.role_permissions where tenant_id=r.tenant_id and role_id=r.role_id)
 and not exists(select 1 from unnest(r.permission_keys||array['organization.access.manage'])k where
  not exists(select 1 from app.access_grants g join app.role_permissions rp on rp.tenant_id=g.tenant_id and rp.role_id=g.role_id
   where g.tenant_id=r.tenant_id and g.auth_user_id=r.invited_by_auth_user_id and rp.permission_key=k
   and g.revoked_at is null and g.starts_at<=statement_timestamp()and(g.ends_at is null or g.ends_at>=r.ends_at)
   and(g.scope_kind='tenant'or g.scope_kind=r.scope_kind and coalesce(g.committee_id,g.team_id,g.household_id)=r.scope_id)));
end;$$;
create function internal.admin_invitation_offer(p_tenant uuid,p_id uuid,p_version bigint,p_payload jsonb,p_initial boolean)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare r app.admin_access_invitations%rowtype;actor uuid:=internal.current_actor_uid();begin
 if not internal.actor_has_active_session()then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_initial then
  if not internal.platform_can('platform.tenant.manage',p_tenant)then raise exception using errcode='42501',message='FORBIDDEN';end if;
 elsif not internal.club_admin_can(p_tenant,'organization.access.manage',p_payload->>'scope_kind',coalesce((p_payload->>'scope_id')::uuid,p_tenant))then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_version<>0 then raise exception using errcode='40001',message='STALE_VERSION';end if;
 r.id:=p_id;r.tenant_id:=p_tenant;r.invited_by_auth_user_id:=actor;r.invited_auth_user_id:=(p_payload->>'auth_user_id')::uuid;
 r.invitation_kind:=case when p_initial then 'initial'else 'club'end;
 r.role_id:=case when not p_initial then(p_payload->>'role_id')::uuid end;
 r.scope_kind:=case when p_initial then 'tenant'else p_payload->>'scope_kind'end;
 r.scope_id:=case when not p_initial then(p_payload->>'scope_id')::uuid end;
 r.given_name:=p_payload->>'given_name';r.family_name:=p_payload->>'family_name';
 r.ends_at:=(p_payload->>'ends_at')::timestamptz;r.expires_at:=(p_payload->>'expires_at')::timestamptz;
 r.permission_keys:=case when p_initial then array(select jsonb_array_elements_text(p_payload->'permission_keys')order by 1)
 else(select array_agg(permission_key order by permission_key)from app.role_permissions where tenant_id=p_tenant and role_id=r.role_id)end;
 if not internal.admin_verified_platform_account(r.invited_auth_user_id)or r.invited_auth_user_id=actor then raise exception using errcode='42501',message='UNKNOWN_ACCOUNT';end if;
 if r.ends_at is null or r.ends_at<=statement_timestamp()or r.ends_at>statement_timestamp()+interval '1 year'
 or r.expires_at is null or r.expires_at<=statement_timestamp()or r.expires_at>least(r.ends_at,statement_timestamp()+interval '7 days')
 or r.permission_keys is null or cardinality(r.permission_keys)not between 1 and 60
 or cardinality(r.permission_keys)<>(select count(distinct k)from unnest(r.permission_keys)k)
 or exists(select 1 from unnest(r.permission_keys)k where not exists(select 1 from app.permissions where permission_key=k))
 or (r.scope_kind='tenant')is distinct from(r.scope_id is null)then raise exception using errcode='22023',message='INVALID_INVITATION';end if;
 if p_initial and(not coalesce((p_payload->>'explicit_confirmation')::boolean,false)
 or length(coalesce(btrim(r.given_name),''))not between 1 and 150 or length(coalesce(btrim(r.family_name),''))not between 1 and 150
 or not('organization.manage'=any(r.permission_keys))or not('organization.access.manage'=any(r.permission_keys)))then raise exception using errcode='22023',message='INVALID_INVITATION';end if;
 if not p_initial and(r.scope_kind='team'or r.role_id is null)then raise exception using errcode='42501',message='TEAM_PARENT_REQUIRES_HANDOVER';end if;
 if not p_initial and(r.scope_kind='committee'and not exists(select 1 from app.committees where tenant_id=p_tenant and id=r.scope_id)
 or r.scope_kind='household'and not exists(select 1 from app.households where tenant_id=p_tenant and id=r.scope_id))then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if not internal.admin_invitation_authorized(r)then raise exception using errcode='42501',message='CANNOT_DELEGATE_PERMISSION';end if;
 if exists(select 1 from app.admin_access_invitations where tenant_id=p_tenant and state='pending'and (invited_auth_user_id=r.invited_auth_user_id or p_initial and invitation_kind='initial'))then raise exception using errcode='55000',message='INVITATION_ALREADY_PENDING';end if;
 insert into app.admin_access_invitations(id,tenant_id,invited_auth_user_id,invited_by_auth_user_id,invitation_kind,given_name,family_name,role_id,permission_keys,scope_kind,scope_id,ends_at,expires_at)
 values(r.id,r.tenant_id,r.invited_auth_user_id,actor,r.invitation_kind,r.given_name,r.family_name,r.role_id,r.permission_keys,r.scope_kind,r.scope_id,r.ends_at,r.expires_at);
 return jsonb_build_object('ok',true,'resource_id',p_id,'version',1);
end;$$;
create function internal.admin_invitation_cancel(p_tenant uuid,p_id uuid,p_version bigint,p_initial boolean)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare r app.admin_access_invitations%rowtype;begin
 select * into r from app.admin_access_invitations where id=p_id and tenant_id=p_tenant for update;
 if not found or not internal.actor_has_active_session()or p_initial and(r.invitation_kind<>'initial'or not internal.platform_can('platform.tenant.manage',p_tenant))
 or not p_initial and not internal.club_admin_can(p_tenant,'organization.access.manage',r.scope_kind,coalesce(r.scope_id,p_tenant))then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if r.version<>p_version or r.state<>'pending'then raise exception using errcode='40001',message='STALE_VERSION';end if;
 update app.admin_access_invitations set state='cancelled',responded_at=statement_timestamp(),version=version+1 where id=p_id;
 return jsonb_build_object('ok',true,'resource_id',p_id,'version',p_version+1);
end;$$;
create function internal.admin_invitation_reply(p_action text,p_id uuid,p_version bigint,p_payload jsonb,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare r app.admin_access_invitations%rowtype;actor uuid:=internal.current_actor_uid();hash bytea;prior app.platform_command_receipts%rowtype;
 person uuid;role uuid;grant_id uuid:=gen_random_uuid();result jsonb;begin
 if not internal.actor_has_active_session()or not internal.actor_has_verified_email()then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_key is null or p_version is null or p_version<1 or p_action<>all(array['accept_admin_invitation','decline_admin_invitation'])
 or p_payload is distinct from jsonb_build_object('explicit_confirmation',true)then raise exception using errcode='22023',message='INVALID_INVITATION';end if;
 perform pg_advisory_xact_lock(hashtextextended('cluvo-platform-authority',0));
 select * into r from app.admin_access_invitations where id=p_id and invited_auth_user_id=actor;
 if not found then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('cluvo-admin-tenant:'||r.tenant_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('platform:'||actor::text||':'||p_key::text,0));
 hash:=extensions.digest(convert_to(jsonb_build_object('action',p_action,'id',p_id,'version',p_version,'payload',p_payload)::text,'UTF8'),'sha256');
 select * into prior from app.platform_command_receipts where actor_auth_user_id=actor and idempotency_key=p_key;
 if found then if prior.request_hash<>hash then raise exception using errcode='22000',message='IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into strict r from app.admin_access_invitations where id=p_id and invited_auth_user_id=actor for update;
 if not internal.actor_has_active_session()then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if r.version<>p_version or r.state<>'pending'then raise exception using errcode='40001',message='STALE_VERSION';end if;
 if r.expires_at<=clock_timestamp()or r.ends_at<=clock_timestamp()then raise exception using errcode='55000',message='INVITATION_EXPIRED';end if;
 if p_action='accept_admin_invitation'then
  if not internal.admin_invitation_authorized(r)then raise exception using errcode='42501',message='INVITATION_AUTHORITY_ENDED';end if;
  role:=r.role_id;
  if r.invitation_kind='initial'then
   insert into app.persons(tenant_id,given_name,family_name)values(r.tenant_id,r.given_name,r.family_name)returning id into person;
   insert into app.account_person_links(tenant_id,person_id,auth_user_id,verified_at)values(r.tenant_id,person,actor,statement_timestamp());
   insert into app.tenant_memberships(tenant_id,auth_user_id,ends_at)values(r.tenant_id,actor,r.ends_at);
   insert into app.permission_roles(tenant_id,role_key,name,system_role)values(r.tenant_id,'accepted_'||replace(r.id::text,'-',''),'Geaccepteerd benoemd eerste mandaat',false)returning id into role;
   insert into app.role_permissions(tenant_id,role_id,permission_key)select r.tenant_id,role,k from unnest(r.permission_keys)k;
  end if;
  insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,committee_id,team_id,household_id,ends_at,granted_by_auth_user_id)
   values(grant_id,r.tenant_id,actor,role,r.scope_kind,case when r.scope_kind='committee'then r.scope_id end,
    case when r.scope_kind='team'then r.scope_id end,case when r.scope_kind='household'then r.scope_id end,r.ends_at,r.invited_by_auth_user_id);
  update app.admin_access_invitations set state='accepted',responded_at=statement_timestamp(),access_grant_id=grant_id,version=version+1 where id=p_id;
 else update app.admin_access_invitations set state='declined',responded_at=statement_timestamp(),version=version+1 where id=p_id;end if;
 result:=jsonb_build_object('ok',true,'resource_id',p_id,'version',p_version+1,'action',p_action,'tenant_id',r.tenant_id);
 insert into app.platform_command_receipts(actor_auth_user_id,idempotency_key,action,request_hash,resource_id,result)values(actor,p_key,p_action,hash,p_id,result);
 insert into app.platform_audit_events(actor_auth_user_id,tenant_id,action,resource_id,expected_version,resulting_version,idempotency_key,reason)
  values(actor,r.tenant_id,p_action,p_id,p_version,p_version+1,p_key,'Benoemde ontvanger bevestigt actuele uitnodigingsversie');
 insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal)
  values(r.tenant_id,actor,p_action,'admin_access_invitations',p_id,r.scope_kind,coalesce(r.scope_id,r.tenant_id),'NAMED_RECIPIENT_DECISION',p_key,
   jsonb_build_object('expected_version',p_version,'resulting_version',p_version+1,'invited_by',r.invited_by_auth_user_id,'permission_keys',r.permission_keys));
 return result;
end;$$;
do $invitation_functions$declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='internal'and p.proname like 'admin_invitation_%'loop
  execute format('alter function %s owner to cluvo_command_owner',r.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
 end loop;
end;$invitation_functions$;

create function internal.platform_read(p_section text,p_tenant uuid default null,p_query text default '',p_status text default '',p_limit integer default 100,p_actor uuid default null,p_after date default null,p_before date default null,p_resource uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare rows jsonb:='[]'::jsonb;v_permission text;begin
 if p_section='personal_invitations'then
  if not internal.actor_has_active_session()or not internal.actor_has_verified_email()then raise exception using errcode='42501',message='FORBIDDEN';end if;
  return jsonb_build_object('rows',coalesce((select jsonb_agg(x.item)from(select jsonb_build_object('id',i.id,'tenant_name',t.name,'state',i.state,'version',i.version,
   'permission_keys',i.permission_keys,'scope_kind',i.scope_kind,'scope_name',case when i.scope_kind='tenant'then t.name when i.scope_kind='committee'then(select name from app.committees where tenant_id=i.tenant_id and id=i.scope_id)when i.scope_kind='household'then(select label from app.households where tenant_id=i.tenant_id and id=i.scope_id)end,
   'ends_at',i.ends_at,'expires_at',i.expires_at,'expired',i.expires_at<=statement_timestamp(),'authority_current',internal.admin_invitation_authorized(i))item
   from app.admin_access_invitations i join app.tenants t on t.id=i.tenant_id where i.invited_auth_user_id=internal.current_actor_uid()order by i.created_at desc,i.id limit 100)x),'[]'::jsonb));
 end if;

 v_permission:=case p_section when 'overview' then 'platform.overview' when 'tenants' then 'platform.tenant.read' when 'tenant' then 'platform.tenant.read'
 when 'staff' then 'platform.access.manage' when 'administrators' then 'platform.tenant.manage' when 'defaults' then 'platform.config.manage' when 'modules' then 'platform.tenant.read'
 when 'integrations' then 'platform.integration.manage' when 'delivery' then 'platform.integration.manage' when 'delivery_targets'then 'platform.integration.manage' when 'support' then 'platform.support' when 'support_scopes'then 'platform.support'
 when 'audit' then 'platform.audit.read' else null end;
 if v_permission is null or length(coalesce(p_query,''))>200 or p_limit not between 1 and 200 then raise exception using errcode='22023',message='INVALID_READ';end if;
 if not internal.actor_has_active_session() then raise exception using errcode='42501',message='FORBIDDEN';end if;
 -- A tenant-scoped employee may see only those named tenants. It does not
 -- obtain global totals or global defaults through an unfiltered list.
 if p_section in ('staff','defaults') and not internal.platform_can(v_permission) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_tenant is not null and not internal.platform_can(v_permission,p_tenant) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if not exists(select 1 from app.platform_access_grants g where g.auth_user_id=internal.current_actor_uid() and g.permission_key=v_permission and g.revoked_at is null and g.starts_at<=statement_timestamp() and g.ends_at>statement_timestamp()) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 case p_section
 when 'overview' then
  select jsonb_build_object('tenant_count',count(*),'active',count(*)filter(where t.status='active'),'preparing',count(*)filter(where t.status='preparing'),'suspended',count(*)filter(where t.status='suspended'),'archived',count(*)filter(where t.status='archived')) into rows from app.tenants t where internal.platform_can(v_permission,t.id);
 when 'tenants','tenant' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (select t.id,t.slug,t.name,t.status,t.version,t.created_at,t.updated_at,
   coalesce(p.contact_name,'') contact_name,coalesce(p.contact_email,'') contact_email,
   jsonb_build_object('identity',true,'administrator',exists(select 1 from app.access_grants ag join app.role_permissions rp on rp.tenant_id=ag.tenant_id and rp.role_id=ag.role_id where ag.tenant_id=t.id and ag.revoked_at is null and (ag.ends_at is null or ag.ends_at>statement_timestamp()) and rp.permission_key='organization.manage'),
   'season',exists(select 1 from app.seasons se where se.tenant_id=t.id and se.status='active'),'tasks',exists(select 1 from app.shifts sh where sh.tenant_id=t.id and sh.state='published'),'integration',exists(select 1 from app.integration_connections ic where ic.tenant_id=t.id and ic.last_success_at is not null)) onboarding_steps,
   (select count(*) from app.tenant_memberships m where m.tenant_id=t.id and m.status='active' and (m.ends_at is null or m.ends_at>statement_timestamp())) active_accounts,
   (select max(last_success_at) from app.integration_connections c where c.tenant_id=t.id) last_sync_at
   from app.tenants t left join app.platform_tenant_profiles p on p.tenant_id=t.id
   where internal.platform_can(v_permission,t.id) and (p_tenant is null or t.id=p_tenant) and (p_status='' or t.status=p_status)
   and (p_query='' or t.name ilike '%'||p_query||'%' or t.slug ilike '%'||p_query||'%') order by lower(t.name),t.id limit p_limit)r;
 when 'support_scopes'then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]')into rows from(
   select t.id,t.name,'tenant'::text scope_kind from app.tenants t where internal.platform_can('platform.support',t.id)and(p_tenant is null or t.id=p_tenant)
   union all select c.id,c.name,'committee'::text from app.committees c where p_tenant is not null and c.tenant_id=p_tenant and c.active and internal.platform_can('platform.support',p_tenant))r;
 when 'staff' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from (select g.id,g.auth_user_id,g.display_name,g.permission_key,g.tenant_scope_id,g.starts_at,g.ends_at,g.revoked_at,g.version
   from app.platform_access_grants g where p_query='' or g.display_name ilike '%'||p_query||'%' order by g.display_name,g.permission_key limit p_limit)r;
 when 'administrators' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select g.id,g.tenant_id,g.auth_user_id,pr.name role_name,g.scope_kind,g.ends_at,g.revoked_at,g.version,
   coalesce((select p.given_name||' '||p.family_name from app.account_person_links a join app.persons p on p.tenant_id=a.tenant_id and p.id=a.person_id where a.tenant_id=g.tenant_id and a.auth_user_id=g.auth_user_id and a.revoked_at is null limit 1),'Benoemd tijdelijk account') display_name
   from app.access_grants g join app.permission_roles pr on pr.tenant_id=g.tenant_id and pr.id=g.role_id where internal.platform_can(v_permission,g.tenant_id) and (p_tenant is null or g.tenant_id=p_tenant)
   and exists(select 1 from app.role_permissions rp where rp.tenant_id=g.tenant_id and rp.role_id=g.role_id and rp.permission_key<>all(array['shift.view','shift.book'])) order by g.created_at desc limit p_limit)r;
  rows:=rows||coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'tenant_id',i.tenant_id,'display_name',coalesce(nullif(btrim(i.given_name||' '||i.family_name),''),'Benoemd persoonlijk account'),
   'role_name','Uitnodiging','scope_kind',i.scope_kind,'ends_at',i.ends_at,'expires_at',i.expires_at,'invitation_status',case when i.state='pending'and i.expires_at<=statement_timestamp()then 'expired'else i.state end,
   'version',i.version,'invitation_kind',i.invitation_kind,'permission_keys',i.permission_keys))from app.admin_access_invitations i
   where internal.platform_can(v_permission,i.tenant_id)and(p_tenant is null or i.tenant_id=p_tenant)),'[]'::jsonb);
 when 'defaults' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select id,setting_key,value_json,version,updated_at from app.platform_defaults order by setting_key)r;
 when 'modules' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select m.id,t.id tenant_id,t.name tenant_name,key module_key,coalesce(m.enabled,true)enabled,coalesce(m.version,0)version,m.updated_at,(m.id is not null)configured
   from app.tenants t cross join unnest(array['planning','teams','courses','policies','communication','sportlink','reporting'])key left join app.platform_module_settings m on m.tenant_id=t.id and m.module_key=key
   where internal.platform_can(v_permission,t.id)and(p_tenant is null or t.id=p_tenant)order by t.name,key limit p_limit)r;
 when 'integrations' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select c.id,c.tenant_id,t.name tenant_name,c.provider,c.status,c.version,c.last_success_at,c.credential_reference is not null configured,
   (select jsonb_build_object('status',x.status,'started_at',x.started_at,'completed_at',x.completed_at,'error_code',x.error_code) from app.integration_runs x where x.tenant_id=c.tenant_id and x.connection_id=c.id order by x.started_at desc limit 1)last_run
   from app.integration_connections c join app.tenants t on t.id=c.tenant_id where internal.platform_can(v_permission,c.tenant_id) and (p_tenant is null or c.tenant_id=p_tenant) order by t.name,c.provider limit p_limit)r;
 when 'delivery' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select o.tenant_id,t.name tenant_name,o.channel,o.state,count(*) total,max(o.created_at) last_created_at
   from app.pwa_delivery_outbox o join app.tenants t on t.id=o.tenant_id where internal.platform_can(v_permission,o.tenant_id) and (p_tenant is null or o.tenant_id=p_tenant) group by o.tenant_id,t.name,o.channel,o.state order by t.name,o.channel,o.state limit p_limit)r;
 when 'delivery_targets'then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]')into rows from(select d.id,d.tenant_id,t.name tenant_name,o.channel,d.state,d.provider_status,d.attempts,d.next_attempt_at,d.version,internal.admin_delivery_retry_safe(d.tenant_id,d.id)can_retry from app.pwa_delivery_targets d join app.pwa_delivery_outbox o on o.tenant_id=d.tenant_id and o.id=d.outbox_id join app.tenants t on t.id=d.tenant_id where internal.platform_can(v_permission,d.tenant_id)and(p_tenant is null or d.tenant_id=p_tenant)and(p_status=''or d.state=p_status)order by d.created_at desc,d.id limit p_limit)r;
 when 'support' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select s.id,s.tenant_id,t.name tenant_name,s.employee_auth_user_id,s.purpose,s.permission_keys,s.scope_kind,s.scope_id,s.state,s.version,s.ends_at,s.created_at,s.consented_at
   from app.platform_support_requests s join app.tenants t on t.id=s.tenant_id where internal.platform_can(v_permission,s.tenant_id) and (p_tenant is null or s.tenant_id=p_tenant) and (s.employee_auth_user_id=internal.current_actor_uid() or internal.platform_can('platform.access.manage')) order by s.created_at desc limit p_limit)r;
 when 'audit' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(select a.id,a.actor_auth_user_id,a.tenant_id,a.action,a.resource_id,a.expected_version,a.resulting_version,a.reason,a.occurred_at from app.platform_audit_events a
   where (a.tenant_id is null and internal.platform_can(v_permission) or a.tenant_id is not null and internal.platform_can(v_permission,a.tenant_id))
   and (p_tenant is null or a.tenant_id=p_tenant) and (p_query='' or a.action ilike '%'||p_query||'%')and(p_actor is null or a.actor_auth_user_id=p_actor)and(p_resource is null or a.resource_id=p_resource)and(p_after is null or a.occurred_at>=p_after::timestamp at time zone'Europe/Amsterdam')and(p_before is null or a.occurred_at<(p_before+1)::timestamp at time zone'Europe/Amsterdam') order by a.occurred_at desc limit p_limit)r;
 end case;
 return jsonb_build_object('section',p_section,'tenant_id',p_tenant,'observed_at',statement_timestamp(),'source','native_authorized_database','rows',rows,'access',internal.platform_access());
end;$$;

create function internal.platform_command(p_action text,p_resource_id uuid,p_expected_version bigint,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
<<platform_command>>
declare actor uuid:=internal.current_actor_uid();tenant uuid;allowed text[];permission text;hash bytea;prior app.platform_command_receipts%rowtype;
 v app.tenants%rowtype;g app.platform_access_grants%rowtype;s app.platform_support_requests%rowtype;d app.platform_defaults%rowtype;m app.platform_module_settings%rowtype;
 id uuid:=p_resource_id;version bigint:=1;reason text:=p_payload->>'reason';result jsonb;keys text[];impact jsonb;uid uuid;delivery record;revoked_support app.platform_support_requests%rowtype;
begin
 if p_action in('accept_admin_invitation','decline_admin_invitation')then return internal.admin_invitation_reply(p_action,p_resource_id,p_expected_version,p_payload,p_idempotency_key);end if;
 if not internal.actor_has_active_session() then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if id is null or p_idempotency_key is null or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>32768 then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 allowed:=case p_action
 when 'create_tenant' then array['slug','name','contact_name','contact_email','reason']
 when 'update_tenant' then array['name','contact_name','contact_email','reason']
 when 'invite_administrator' then array['tenant_id','auth_user_id','given_name','family_name','permission_keys','ends_at','expires_at','explicit_confirmation','reason']
 when 'cancel_administrator_invitation' then array['tenant_id','reason']
 when 'onboard_administrator' then array['tenant_id','auth_user_id','given_name','family_name','permission_keys','ends_at','explicit_confirmation','reason']
 when 'onboard_season' then array['tenant_id','name','starts_on','ends_on','winter_cutoff_at','target_minutes','winter_target_minutes','reason']
 when 'set_tenant_status' then array['status','impact_hash','reason']
 when 'grant_staff' then array['auth_user_id','display_name','permission_key','tenant_scope_id','ends_at','reason']
 when 'retry_delivery'then array['explicit_confirmation','reason']
 when 'revoke_staff' then array['reason']
 when 'save_default' then array['setting_key','value','reason']
 when 'set_module' then array['tenant_id','module_key','enabled','reason']
 when 'request_support' then array['tenant_id','permission_keys','scope_kind','scope_id','ends_at','purpose','reason']
 when 'revoke_support' then array['reason'] else null end;
 if allowed is null or exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(allowed))) or reason is null or length(trim(reason)) not between 3 and 1000 then raise exception using errcode='22023',message='INVALID_FIELD';end if;
 tenant:=case when p_action in('create_tenant','update_tenant','set_tenant_status') then id when p_action in('set_module','request_support','onboard_administrator','onboard_season','invite_administrator','cancel_administrator_invitation') then (p_payload->>'tenant_id')::uuid else null end;
 if p_action='retry_delivery'then select tenant_id into tenant from app.pwa_delivery_targets where app.pwa_delivery_targets.id=id;end if;
 if p_action='revoke_support' then select tenant_id into tenant from app.platform_support_requests where app.platform_support_requests.id=id;end if;
 permission:=case when p_action in('create_tenant','update_tenant','set_tenant_status','set_module','onboard_administrator','onboard_season','invite_administrator','cancel_administrator_invitation') then 'platform.tenant.manage' when p_action in('grant_staff','revoke_staff') then 'platform.access.manage' when p_action='save_default' then 'platform.config.manage'when p_action='retry_delivery'then 'platform.integration.manage' else 'platform.support' end;
 if not internal.platform_can(permission,case when p_action='create_tenant' then null else tenant end) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 -- Locks precede authority revalidation, idempotency and version checks.
 -- Staff revocation and platform mutation serialize on the same lock.
 perform pg_advisory_xact_lock(hashtextextended('cluvo-platform-authority',0));
 if not internal.platform_can(permission,case when p_action='create_tenant' then null else tenant end) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('platform:'||actor::text||':'||p_idempotency_key::text,0));
 if tenant is not null then perform pg_advisory_xact_lock(hashtextextended('cluvo-admin-tenant:'||tenant::text,0));end if;
 hash:=extensions.digest(convert_to(jsonb_build_object('action',p_action,'id',id,'version',p_expected_version,'payload',p_payload)::text,'UTF8'),'sha256');
 perform internal.admin_intent_guard('platform',null,p_action,id,p_expected_version,p_payload,p_idempotency_key);
 select * into prior from app.platform_command_receipts where actor_auth_user_id=actor and idempotency_key=p_idempotency_key;
 if found then if prior.request_hash<>hash then raise exception using errcode='22000',message='IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 case p_action
 when 'create_tenant' then
  if p_expected_version<>0 or length(coalesce(btrim(p_payload->>'name'),'')) not between 1 and 150 or coalesce(p_payload->>'slug','')!~'^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_payload->>'slug')>80 then raise exception using errcode='22023',message='INVALID_TENANT';end if;
  if exists(select 1 from app.tenants where app.tenants.id=id or slug=p_payload->>'slug') then raise exception using errcode='40001',message='TENANT_ALREADY_EXISTS';end if;
  insert into app.tenants(id,slug,name,status) values(id,p_payload->>'slug',p_payload->>'name','preparing');
  insert into app.platform_tenant_profiles(tenant_id,contact_name,contact_email,changed_by_auth_user_id,adopted_defaults) values(id,coalesce(p_payload->>'contact_name',''),coalesce(p_payload->>'contact_email',''),actor,coalesce((select jsonb_object_agg(setting_key,jsonb_build_object('version',version,'value',value_json))from app.platform_defaults),'{}'));
 when 'update_tenant' then
  select * into strict v from app.tenants where app.tenants.id=id for update;
  if v.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if length(coalesce(btrim(p_payload->>'name'),'')) not between 1 and 150 then raise exception using errcode='22023',message='INVALID_TENANT';end if;
  version:=v.version+1;update app.tenants set name=p_payload->>'name',version=platform_command.version,updated_at=statement_timestamp() where app.tenants.id=id;
  insert into app.platform_tenant_profiles(tenant_id,contact_name,contact_email,changed_by_auth_user_id) values(id,coalesce(p_payload->>'contact_name',''),coalesce(p_payload->>'contact_email',''),actor)
   on conflict(tenant_id) do update set contact_name=excluded.contact_name,contact_email=excluded.contact_email,version=app.platform_tenant_profiles.version+1,changed_by_auth_user_id=actor,updated_at=statement_timestamp();
 when 'set_tenant_status' then
  select * into strict v from app.tenants where app.tenants.id=id for update;
  if v.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  impact:=internal.platform_tenant_impact(id,p_payload->>'status');
  if p_payload->>'impact_hash' is distinct from impact->>'impact_hash' then raise exception using errcode='40001',message='IMPACT_CHANGED';end if;
  if p_payload->>'status'='active' and (not exists(select 1 from app.seasons where tenant_id=id and status='active') or not exists(select 1 from app.tenant_memberships tm join app.access_grants ag on ag.tenant_id=tm.tenant_id and ag.auth_user_id=tm.auth_user_id join app.role_permissions rp on rp.tenant_id=ag.tenant_id and rp.role_id=ag.role_id where tm.tenant_id=id and tm.status='active' and tm.starts_at<=statement_timestamp() and (tm.ends_at is null or tm.ends_at>statement_timestamp()) and ag.scope_kind='tenant' and ag.revoked_at is null and ag.starts_at<=statement_timestamp() and (ag.ends_at is null or ag.ends_at>statement_timestamp()) and rp.permission_key='organization.manage')) then raise exception using errcode='55000',message='ONBOARDING_INCOMPLETE';end if;
  version:=v.version+1;update app.tenants set status=p_payload->>'status',version=platform_command.version,updated_at=statement_timestamp() where app.tenants.id=id;
 when 'invite_administrator' then
  perform internal.admin_invitation_offer(tenant,id,p_expected_version,p_payload,true);
 when 'cancel_administrator_invitation' then
  perform internal.admin_invitation_cancel(tenant,id,p_expected_version,true);version:=p_expected_version+1;
 when 'onboard_administrator' then
  select * into strict v from app.tenants where app.tenants.id=tenant for update;
  if v.status<>'preparing' or p_expected_version<>0 or exists(select 1 from app.access_grants where tenant_id=tenant) or exists(select 1 from app.persons where tenant_id=tenant) or exists(select 1 from app.households where tenant_id=tenant) or exists(select 1 from app.obligations where tenant_id=tenant) then raise exception using errcode='55000',message='INITIAL_ONBOARDING_ONLY';end if;
  uid:=(p_payload->>'auth_user_id')::uuid;keys:=array(select jsonb_array_elements_text(p_payload->'permission_keys'));
  if not internal.admin_verified_platform_account(uid)then raise exception using errcode='42501',message='UNKNOWN_ACCOUNT';end if;
  if not coalesce((p_payload->>'explicit_confirmation')::boolean,false) or cardinality(keys) not between 1 and 60 or cardinality(keys)<>(select count(distinct k)from unnest(keys)k)
   or not('organization.manage'=any(keys)) or not('organization.access.manage'=any(keys)) or exists(select 1 from unnest(keys)k where not exists(select 1 from app.permissions where permission_key=k))
   or length(coalesce(p_payload->>'given_name','')) not between 1 and 150 or length(coalesce(p_payload->>'family_name','')) not between 1 and 150 or (p_payload->>'ends_at')::timestamptz is null or (p_payload->>'ends_at')::timestamptz<=statement_timestamp() or (p_payload->>'ends_at')::timestamptz>statement_timestamp()+interval '1 year' then raise exception using errcode='22023',message='INVALID_ONBOARDING';end if;
  insert into app.persons(tenant_id,given_name,family_name)values(tenant,p_payload->>'given_name',p_payload->>'family_name') returning app.persons.id into uid;
  insert into app.account_person_links(tenant_id,person_id,auth_user_id,verified_at) values(tenant,uid,(p_payload->>'auth_user_id')::uuid,statement_timestamp());
  insert into app.tenant_memberships(tenant_id,auth_user_id,ends_at)values(tenant,(p_payload->>'auth_user_id')::uuid,(p_payload->>'ends_at')::timestamptz);
  insert into app.permission_roles(tenant_id,role_key,name,description,system_role)values(tenant,'onboarding_'||replace(id::text,'-',''),'Benoemd eerste verenigingsmandaat','Expliciet gekozen rechten bij lege vereniging in voorbereiding',false)returning app.permission_roles.id into uid;
  insert into app.role_permissions(tenant_id,role_id,permission_key)select tenant,uid,k from unnest(keys)k;
  insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,ends_at,granted_by_auth_user_id)values(id,tenant,(p_payload->>'auth_user_id')::uuid,uid,'tenant',(p_payload->>'ends_at')::timestamptz,actor);
 when 'onboard_season' then
  select * into strict v from app.tenants where app.tenants.id=tenant for update;
  if v.status<>'preparing' or p_expected_version<>0 or exists(select 1 from app.seasons where tenant_id=tenant and status='active') or exists(select 1 from app.obligations where tenant_id=tenant) then raise exception using errcode='55000',message='INITIAL_ONBOARDING_ONLY';end if;
  if length(coalesce(p_payload->>'name','')) not between 1 and 150 or (p_payload->>'starts_on')::date is null or (p_payload->>'ends_on')::date is null or (p_payload->>'winter_cutoff_at')::timestamptz is null
   or (p_payload->>'target_minutes')::integer is null or (p_payload->>'winter_target_minutes')::integer is null or (p_payload->>'winter_cutoff_at')::timestamptz not between (p_payload->>'starts_on')::timestamptz and ((p_payload->>'ends_on')::date+1)::timestamptz then raise exception using errcode='22023',message='INVALID_ONBOARDING';end if;
  insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,target_minutes,winter_target_minutes,status)values(id,tenant,p_payload->>'name',(p_payload->>'starts_on')::date,(p_payload->>'ends_on')::date,(p_payload->>'winter_cutoff_at')::timestamptz,(p_payload->>'target_minutes')::integer,(p_payload->>'winter_target_minutes')::integer,'active');
 when 'grant_staff' then
  if p_expected_version<>0 then raise exception using errcode='40001',message='STALE_VERSION';end if;
  uid:=(p_payload->>'auth_user_id')::uuid;
  if not internal.admin_verified_platform_account(uid)then raise exception using errcode='42501',message='UNKNOWN_ACCOUNT';end if;
  if not internal.platform_can(p_payload->>'permission_key',(p_payload->>'tenant_scope_id')::uuid) then raise exception using errcode='42501',message='CANNOT_DELEGATE_PERMISSION';end if;
  if not exists(select 1 from app.platform_access_grants parent where parent.auth_user_id=actor and parent.permission_key=p_payload->>'permission_key'
   and parent.revoked_at is null and parent.starts_at<=statement_timestamp() and parent.ends_at>=(p_payload->>'ends_at')::timestamptz
   and (parent.tenant_scope_id is null or parent.tenant_scope_id=(p_payload->>'tenant_scope_id')::uuid)) then raise exception using errcode='42501',message='CANNOT_EXTEND_DELEGATION';end if;
  if uid=actor then raise exception using errcode='42501',message='SELF_GRANT_REFUSED';end if;
  if (p_payload->>'ends_at')::timestamptz<=statement_timestamp() or (p_payload->>'ends_at')::timestamptz>statement_timestamp()+interval '1 year' then raise exception using errcode='22023',message='INVALID_EXPIRY';end if;
  insert into app.platform_access_grants(id,auth_user_id,display_name,permission_key,tenant_scope_id,ends_at,granted_by_auth_user_id)
   values(id,uid,p_payload->>'display_name',p_payload->>'permission_key',(p_payload->>'tenant_scope_id')::uuid,(p_payload->>'ends_at')::timestamptz,actor);
 when 'revoke_staff' then
  select * into strict g from app.platform_access_grants where app.platform_access_grants.id=id for update;
  if g.version<>p_expected_version or g.revoked_at is not null then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if g.auth_user_id=actor and g.permission_key='platform.access.manage' and not exists(select 1 from app.platform_access_grants where auth_user_id<>actor and permission_key='platform.access.manage' and tenant_scope_id is null and revoked_at is null and ends_at>statement_timestamp()) then raise exception using errcode='55000',message='LAST_PLATFORM_ACCESS_MANAGER';end if;
  version:=g.version+1;update app.platform_access_grants set revoked_at=statement_timestamp(),version=platform_command.version where app.platform_access_grants.id=id;
  if g.permission_key='platform.support'then
   for revoked_support in select sr.* from app.platform_support_requests sr where sr.employee_auth_user_id=g.auth_user_id and sr.state in('requested','approved')
    and(g.tenant_scope_id is null or sr.tenant_id=g.tenant_scope_id)
    and not exists(select 1 from app.platform_access_grants remaining where remaining.auth_user_id=g.auth_user_id and remaining.permission_key='platform.support'and remaining.revoked_at is null and remaining.starts_at<=statement_timestamp()and remaining.ends_at>statement_timestamp()and(remaining.tenant_scope_id is null or remaining.tenant_scope_id=sr.tenant_id))order by sr.tenant_id,sr.id
   loop
    perform pg_advisory_xact_lock(hashtextextended('cluvo-admin-tenant:'||revoked_support.tenant_id::text,0));
    update app.platform_support_requests sr set state='revoked',version=sr.version+1 where sr.id=revoked_support.id;
    update app.access_grants ag set revoked_at=statement_timestamp(),version=ag.version+1 where ag.tenant_id=revoked_support.tenant_id and ag.id=revoked_support.access_grant_id and ag.revoked_at is null;
    update app.tenant_memberships tm set ends_at=statement_timestamp(),version=tm.version+1 where tm.tenant_id=revoked_support.tenant_id and tm.id=(select sr.support_membership_id from app.platform_support_requests sr where sr.id=revoked_support.id);
    insert into app.platform_audit_events(actor_auth_user_id,tenant_id,action,resource_id,expected_version,resulting_version,idempotency_key,reason)values(actor,revoked_support.tenant_id,'support_revoked_with_staff_right',revoked_support.id,revoked_support.version,revoked_support.version+1,p_idempotency_key,reason);
   end loop;
  end if;
 when 'save_default' then
  if coalesce(p_payload->>'setting_key','')<>all(array['organization','planning','communication','template']) or jsonb_typeof(p_payload->'value') is distinct from 'object' then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  keys:=case p_payload->>'setting_key' when 'organization' then array['timezone','locale'] when 'planning' then array['cancellation_minutes','confirmation_days','dispute_days'] when 'communication' then array['reminder_days','reminder_hours'] else array['subject','text','sender_name'] end;
  if exists(select 1 from jsonb_object_keys(p_payload->'value') k where not(k=any(keys))) or exists(select 1 from unnest(keys)k where not(p_payload->'value'?k) or p_payload->'value'->k='null'::jsonb) then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  if p_payload->>'setting_key'='organization' and (p_payload->'value'->>'timezone' is distinct from 'Europe/Amsterdam' or p_payload->'value'->>'locale' is distinct from 'nl-NL') then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  if p_payload->>'setting_key'='planning' and ((p_payload->'value'->>'cancellation_minutes')::integer not between 0 and 44640 or (p_payload->'value'->>'confirmation_days')::integer not between 1 and 365 or (p_payload->'value'->>'dispute_days')::integer not between 1 and 365) then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  if p_payload->>'setting_key'='communication' and ((p_payload->'value'->>'reminder_days')::integer not between 1 and 30 or (p_payload->'value'->>'reminder_hours')::integer not between 1 and 720) then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  if p_payload->>'setting_key'='template' and (length(btrim(p_payload->'value'->>'subject')) not between 1 and 200 or length(btrim(p_payload->'value'->>'text')) not between 1 and 4000 or length(btrim(p_payload->'value'->>'sender_name')) not between 1 and 150) then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  select * into d from app.platform_defaults where setting_key=p_payload->>'setting_key' for update;
  if coalesce(d.version,0)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if d.id is not null and d.id<>id then raise exception using errcode='40001',message='RESOURCE_CHANGED';end if;
  version:=coalesce(d.version,0)+1;
  insert into app.platform_defaults(id,setting_key,value_json,version,changed_by_auth_user_id)values(id,p_payload->>'setting_key',p_payload->'value',version,actor)
  on conflict(setting_key) do update set value_json=excluded.value_json,version=excluded.version,changed_by_auth_user_id=actor,updated_at=statement_timestamp();
 when 'set_module' then
  select * into m from app.platform_module_settings where tenant_id=tenant and module_key=p_payload->>'module_key' for update;
  if coalesce(m.version,0)<>p_expected_version or m.id is not null and m.id<>id then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception using errcode='22023',message='INVALID_SETTING';end if;
  version:=coalesce(m.version,0)+1;
  insert into app.platform_module_settings(id,tenant_id,module_key,enabled,version,changed_by_auth_user_id) values(id,tenant,p_payload->>'module_key',(p_payload->>'enabled')::boolean,version,actor)
   on conflict(tenant_id,module_key) do update set enabled=excluded.enabled,version=excluded.version,changed_by_auth_user_id=actor,updated_at=statement_timestamp();
 when 'retry_delivery'then
  select retry_target.id,retry_target.tenant_id,retry_target.version into delivery from app.pwa_delivery_targets retry_target where retry_target.id=platform_command.id for update;
  if delivery.id is null or delivery.version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  if p_payload->'explicit_confirmation'is distinct from 'true'::jsonb or not internal.admin_delivery_retry_safe(delivery.tenant_id,id)then raise exception using errcode='55000',message='DELIVERY_RETRY_NOT_PROVEN_SAFE';end if;
  version:=delivery.version+1;
  -- Retain state, attempt budget, source version and logical target identity.
  -- The existing worker rechecks source, preference, allowlist and lease.
  update app.pwa_delivery_targets set next_attempt_at=statement_timestamp(),version=platform_command.version where app.pwa_delivery_targets.id=id;
 when 'request_support' then
  if not exists(select 1 from app.platform_access_grants parent where parent.auth_user_id=actor and parent.permission_key='platform.support'and parent.revoked_at is null and parent.starts_at<=statement_timestamp()and parent.ends_at>=(p_payload->>'ends_at')::timestamptz and(parent.tenant_scope_id is null or parent.tenant_scope_id=tenant))then raise exception using errcode='42501',message='CANNOT_EXTEND_DELEGATION';end if;
  keys:=array(select jsonb_array_elements_text(p_payload->'permission_keys'));
  if cardinality(keys) not between 1 and 8 or exists(select 1 from unnest(keys) k where k<>all(array['organization.manage','shift.view','shift.manage','attendance.confirm','committee.workspace.view','committee.workspace.manage','match.import']))
   or (select count(distinct k) from unnest(keys)k)<>cardinality(keys) then raise exception using errcode='22023',message='INVALID_SUPPORT_SCOPE';end if;
  if p_payload->>'scope_kind' is null or p_payload->>'scope_kind'<>all(array['tenant','committee'])or(p_payload->>'scope_kind'='tenant'and p_payload->>'scope_id'is not null)or(p_payload->>'scope_kind'='committee'and p_payload->>'scope_id'is null)or p_expected_version<>0 or (p_payload->>'ends_at')::timestamptz<=statement_timestamp() then raise exception using errcode='22023',message='INVALID_SUPPORT_SCOPE';end if;
  if p_payload->>'scope_kind'='committee' and not exists(select 1 from app.committees where tenant_id=tenant and app.committees.id=(p_payload->>'scope_id')::uuid)
   or p_payload->>'scope_kind'='team' and not exists(select 1 from app.teams where tenant_id=tenant and app.teams.id=(p_payload->>'scope_id')::uuid) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  insert into app.platform_support_requests(id,tenant_id,employee_auth_user_id,purpose,permission_keys,scope_kind,scope_id,ends_at)
  values(id,tenant,actor,p_payload->>'purpose',keys,p_payload->>'scope_kind',(p_payload->>'scope_id')::uuid,(p_payload->>'ends_at')::timestamptz);
 when 'revoke_support' then
  select * into strict s from app.platform_support_requests where app.platform_support_requests.id=id for update;
  if s.employee_auth_user_id<>actor or s.version<>p_expected_version or s.state not in('requested','approved') then raise exception using errcode='42501',message='FORBIDDEN';end if;
  version:=s.version+1;update app.platform_support_requests set state='revoked',version=platform_command.version where app.platform_support_requests.id=id;
  update app.access_grants set revoked_at=statement_timestamp(),version=app.access_grants.version+1 where tenant_id=s.tenant_id and app.access_grants.id=s.access_grant_id and revoked_at is null;
  -- This column is added by the club migration before application activation.
  update app.tenant_memberships tm set ends_at=statement_timestamp(),version=tm.version+1 where tm.tenant_id=s.tenant_id and tm.id=(select sr.support_membership_id from app.platform_support_requests sr where sr.id=s.id);
 end case;
 result:=jsonb_build_object('ok',true,'resource_id',id,'version',version,'action',p_action,'tenant_id',tenant);
 insert into app.platform_audit_events(actor_auth_user_id,tenant_id,action,resource_id,expected_version,resulting_version,idempotency_key,reason) values(actor,tenant,p_action,id,p_expected_version,version,p_idempotency_key,reason);
 insert into app.platform_command_receipts(actor_auth_user_id,idempotency_key,action,request_hash,resource_id,result) values(actor,p_idempotency_key,p_action,hash,id,result);
 perform internal.admin_intent_finish(p_idempotency_key);
 return result;
end;$$;

create function internal.platform_command_status(p_idempotency_key uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r app.platform_command_receipts%rowtype;begin
 if not internal.actor_has_active_session() then raise exception using errcode='42501',message='FORBIDDEN';end if;
 select * into r from app.platform_command_receipts where actor_auth_user_id=internal.current_actor_uid() and idempotency_key=p_idempotency_key;
 if not found then return jsonb_build_object('state','unknown');end if;
 if r.action not in('accept_admin_invitation','decline_admin_invitation')and not (internal.platform_access()->>'authorized')::boolean then raise exception using errcode='42501',message='FORBIDDEN';end if;
 return jsonb_build_object('state','confirmed','result',jsonb_build_object('action',r.action,'resource_id',r.resource_id,'version',r.result->'version'));
end;$$;

create function api.platform_access()returns jsonb language sql stable security invoker set search_path='' as $$select internal.platform_access();$$;
create function api.platform_account_choice(p_email text,p_purpose text,p_tenant uuid default null)returns jsonb language sql stable security invoker set search_path=''as $$select internal.admin_platform_account_choice(p_email,p_purpose,p_tenant);$$;
create function api.platform_read(p_section text,p_tenant uuid default null,p_query text default '',p_status text default '',p_limit integer default 100,p_actor uuid default null,p_after date default null,p_before date default null,p_resource uuid default null)returns jsonb language sql stable security invoker set search_path='' as $$select internal.platform_read(p_section,p_tenant,p_query,p_status,p_limit,p_actor,p_after,p_before,p_resource);$$;
create function api.platform_tenant_impact(p_tenant uuid,p_status text)returns jsonb language sql stable security invoker set search_path='' as $$select internal.platform_tenant_impact(p_tenant,p_status);$$;
create function api.platform_command(p_action text,p_resource_id uuid,p_expected_version bigint,p_payload jsonb,p_idempotency_key uuid)returns jsonb language sql volatile security invoker set search_path='' as $$select internal.platform_command(p_action,p_resource_id,p_expected_version,p_payload,p_idempotency_key);$$;
create function api.platform_command_status(p_idempotency_key uuid)returns jsonb language sql stable security invoker set search_path='' as $$select internal.platform_command_status(p_idempotency_key);$$;
do $functions$ declare r record;begin
 for r in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('api','internal') and p.proname like 'platform_%' loop
  execute format('alter function %s owner to cluvo_command_owner',r.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  if coalesce(r.proname,'')<>'platform_can' then execute format('grant execute on function %s to authenticated',r.signature);end if;
 end loop;
end;$functions$;
revoke create on schema internal,api from cluvo_command_owner;
notify pgrst,'reload schema';
commit;
