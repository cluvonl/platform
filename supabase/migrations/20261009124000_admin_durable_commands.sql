-- Prepared administrative commands survive reloads and a second device.
-- Existing native receipts remain the authority for completed domain mutations.
begin;
grant create on schema internal,api to cluvo_command_owner;
create table app.admin_command_intents(
 actor_auth_user_id uuid not null references auth.users(id),idempotency_key uuid not null,
 surface text not null check(surface in('club','platform')),tenant_id uuid references app.tenants(id),
 action text not null,resource_id uuid not null,expected_version bigint not null check(expected_version>=0),
 payload jsonb not null check(jsonb_typeof(payload)='object'and octet_length(payload::text)<=65536),
 request_hash bytea not null check(octet_length(request_hash)=32),
 state text not null default 'prepared'check(state in('prepared','confirmed','cancelled')),
 prepared_at timestamptz not null default statement_timestamp(),resolved_at timestamptz,
 primary key(actor_auth_user_id,idempotency_key),check((surface='club')=(tenant_id is not null))
);
alter table app.admin_command_intents enable row level security;
alter table app.admin_command_intents force row level security;
revoke all on app.admin_command_intents from public,anon,authenticated,service_role;
grant select,insert,update on app.admin_command_intents to cluvo_command_owner;
create policy command_owner on app.admin_command_intents for all to cluvo_command_owner using(true)with check(true);
create policy native_session_required on app.admin_command_intents as restrictive for all to authenticated using((select internal.actor_has_active_session()))with check((select internal.actor_has_active_session()));

create function internal.admin_intent_authorized(p_surface text,p_tenant uuid,p_action text,p_resource uuid,p_payload jsonb)returns boolean
language plpgsql stable security definer set search_path='' as $$
declare permission text;kind text:='tenant';scope uuid:=p_tenant;tenant uuid;begin
 if not internal.actor_has_active_session()then return false;end if;
 if p_surface='platform'and p_tenant is null then
  permission:=case when p_action in('create_tenant','update_tenant','set_tenant_status','set_module','onboard_administrator','onboard_season','invite_administrator','cancel_administrator_invitation')then 'platform.tenant.manage'when p_action in('grant_staff','revoke_staff')then 'platform.access.manage'when p_action='save_default'then 'platform.config.manage'when p_action='retry_delivery'then 'platform.integration.manage'when p_action in('request_support','revoke_support')then 'platform.support'end;
  tenant:=case when p_action in('update_tenant','set_tenant_status')then p_resource when p_action in('set_module','onboard_administrator','onboard_season','invite_administrator','cancel_administrator_invitation','request_support')then(p_payload->>'tenant_id')::uuid end;
  if p_action='retry_delivery'then select tenant_id into tenant from app.pwa_delivery_targets where id=p_resource;end if;
  if p_action='revoke_support'then select tenant_id into tenant from app.platform_support_requests where id=p_resource;end if;
  return permission is not null and internal.platform_can(permission,tenant);
 elsif p_surface<>'club'or p_tenant is null or not internal.is_active_member(p_tenant)then return false;end if;
 permission:=case
  when p_action in('save_organization','save_location','save_committee','save_team','save_person','save_household','link_household_person','add_team_member','end_team_member','save_season','save_settings')then 'organization.manage'
  when p_action in('grant_access','revoke_access','invite_access','cancel_access_invitation','consent_support','end_support')then 'organization.access.manage'
  when p_action in('save_committee_contact','add_committee_member','end_committee_member')then 'committee.workspace.manage'
  when p_action in('save_category','save_task_type','revise_task_type')then 'shift.manage'
  when p_action in('save_course','save_qualification_type','save_course_session','certify_enrollment','register_qualification','revoke_qualification')then 'development.manage'
  when p_action in('save_policy_draft','publish_policy')then 'policy.manage'
  when p_action in('save_template_draft','preview_template','queue_template_test','approve_template','publish_template')then 'communication.manage'
  when p_action in('take_hour_dispute','resolve_hour_dispute')then 'hour_dispute.review'when p_action in('save_volunteer_role','revise_volunteer_role')then 'volunteer_role.manage'when p_action in('save_vacancy','set_vacancy_state','follow_vacancy_interest','recognize_vacancy_appointment')then 'vacancy.manage'
  when p_action in('confirm_attendance','correct_attendance_award')then 'attendance.confirm'
  when p_action='prepare_assessment'then 'finance.assessment.prepare'when p_action='approve_assessment'then 'finance.assessment.approve'
  when p_action='finalize_assessment'then 'finance.assessment.finalize'when p_action='post_fund_entry'then 'finance.fund.manage'
  when p_action='review_exception'then 'exception.review'when p_action='finalize_exception'then 'exception.finalize'
  when p_action='close_season'then 'season.close'when p_action='rollover_season'then 'season.rollover'end;
 if permission is null then return false;end if;
 if p_action in('confirm_attendance','correct_attendance_award')then kind:='committee';select sh.committee_id into scope from app.bookings b join app.shift_positions sp on sp.tenant_id=b.tenant_id and sp.id=b.position_id join app.shifts sh on sh.tenant_id=sp.tenant_id and sh.id=sp.shift_id where b.tenant_id=p_tenant and b.id=p_resource;
 elsif p_action='save_committee_contact'then kind:='committee';scope:=p_resource;
 elsif p_action='add_committee_member'then kind:='committee';scope:=(p_payload->>'committee_id')::uuid;
 elsif p_action='end_committee_member'then kind:='committee';select committee_id into scope from app.committee_person_memberships where tenant_id=p_tenant and id=p_resource;
 elsif p_action in('grant_access','invite_access')then kind:=p_payload->>'scope_kind';scope:=coalesce((p_payload->>'scope_id')::uuid,p_tenant);
 elsif p_action='cancel_access_invitation'then select i.scope_kind,coalesce(i.scope_id,p_tenant)into kind,scope from app.admin_access_invitations i where i.tenant_id=p_tenant and i.id=p_resource;
 elsif p_action='revoke_access'then select g.scope_kind,coalesce(g.committee_id,g.team_id,g.household_id,p_tenant)into kind,scope from app.access_grants g where g.tenant_id=p_tenant and g.id=p_resource;
 elsif p_action='save_category'then kind:='committee';scope:=(p_payload->>'committee_id')::uuid;
 elsif p_action='save_task_type'then kind:='committee';select committee_id into scope from app.task_categories where tenant_id=p_tenant and id=(p_payload->>'category_id')::uuid;
 elsif p_action='revise_task_type'then kind:='committee';select c.committee_id into scope from app.task_types t join app.task_categories c on c.tenant_id=t.tenant_id and c.id=t.category_id where t.tenant_id=p_tenant and t.id=p_resource;
 elsif p_action in('save_policy_draft','publish_policy')then
  select owner_committee_id into scope from app.policy_documents where tenant_id=p_tenant and id=p_resource;
  if p_action='save_policy_draft'and scope is null then scope:=(p_payload->>'owner_committee_id')::uuid;end if;
  if scope is not null then kind:='committee';else scope:=p_tenant;end if;
 elsif p_action in('save_template_draft','preview_template','queue_template_test','approve_template','publish_template')then
  select committee_id into scope from app.message_templates where tenant_id=p_tenant and id=p_resource;
  if p_action='save_template_draft'and scope is null then scope:=(p_payload->>'committee_id')::uuid;end if;
  if scope is not null then kind:='committee';else scope:=p_tenant;end if;
 end if;
 return internal.club_admin_can(p_tenant,permission,kind,scope)and(p_action<>'recognize_vacancy_appointment'or internal.club_admin_can(p_tenant,'volunteer_role.manage'));
end;$$;

create function internal.admin_intent_hash(p_surface text,p_tenant uuid,p_action text,p_resource uuid,p_version bigint,p_payload jsonb)returns bytea
language sql immutable security invoker set search_path='' as $$select extensions.digest(convert_to(jsonb_build_object('surface',p_surface,'tenant',p_tenant,'action',p_action,'resource',p_resource,'version',p_version,'payload',p_payload)::text,'UTF8'),'sha256');$$;
create function internal.admin_intent_lock(p_key uuid)returns void
language sql volatile security invoker set search_path='' as $$select pg_advisory_xact_lock(hashtextextended('admin-intent:'||internal.current_actor_uid()::text||':'||p_key::text,0));$$;
create function internal.admin_intent_guard(p_surface text,p_tenant uuid,p_action text,p_resource uuid,p_version bigint,p_payload jsonb,p_key uuid)returns void
language plpgsql volatile security definer set search_path='' as $$
declare r app.admin_command_intents%rowtype;begin
 perform internal.admin_intent_lock(p_key);
 select * into r from app.admin_command_intents where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key;
 if not found then return;end if;
 if r.request_hash<>internal.admin_intent_hash(p_surface,p_tenant,p_action,p_resource,p_version,p_payload)then raise exception using errcode='22000',message='IDEMPOTENCY_CONFLICT';end if;
 if r.state='cancelled'then raise exception using errcode='55000',message='ADMIN_COMMAND_CANCELLED';end if;
end;$$;
create function internal.admin_intent_finish(p_key uuid)returns void language sql volatile security definer set search_path='' as $$
 update app.admin_command_intents set state='confirmed',resolved_at=statement_timestamp()where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key and state='prepared';$$;

create function internal.admin_prepare_command(p_surface text,p_tenant uuid,p_action text,p_resource uuid,p_expected_version bigint,p_payload jsonb,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r app.admin_command_intents%rowtype;hash bytea;completed boolean;begin
 if not internal.actor_has_active_session()then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_key is null or p_resource is null or p_expected_version is null or p_expected_version<0 or jsonb_typeof(p_payload)is distinct from 'object'or octet_length(p_payload::text)>65536
  or exists(select 1 from jsonb_object_keys(p_payload)k where k~*'(password|secret|credential|token)')then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 if not internal.admin_intent_authorized(p_surface,p_tenant,p_action,p_resource,p_payload)then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform internal.admin_intent_lock(p_key);
 hash:=internal.admin_intent_hash(p_surface,p_tenant,p_action,p_resource,p_expected_version,p_payload);
 select * into r from app.admin_command_intents where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key;
 if found then
  if r.request_hash<>hash then raise exception using errcode='22000',message='IDEMPOTENCY_CONFLICT';end if;
  if r.state='cancelled'then raise exception using errcode='55000',message='ADMIN_COMMAND_CANCELLED';end if;
  return jsonb_build_object('ok',true,'state',r.state);
 end if;
 -- Serializing preparation per actor/context prevents a second device from
 -- creating another pending mutation while the first outcome is unresolved.
 perform pg_advisory_xact_lock(hashtextextended('admin-prepare:'||internal.current_actor_uid()::text||':'||p_surface||':'||coalesce(p_tenant::text,'platform'),0));
 if exists(select 1 from app.admin_command_intents pending where pending.actor_auth_user_id=internal.current_actor_uid()and pending.surface=p_surface and pending.tenant_id is not distinct from p_tenant and pending.state='prepared'and internal.admin_intent_authorized(pending.surface,pending.tenant_id,pending.action,pending.resource_id,pending.payload))then raise exception using errcode='55000',message='ADMIN_PENDING_COMMAND';end if;
 completed:=case when p_surface='club'then exists(select 1 from app.idempotency_records where tenant_id=p_tenant and actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key and operation='club_admin:'||p_action and status='completed')else exists(select 1 from app.platform_command_receipts where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key)end;
 if completed then
  if p_surface='club'and exists(select 1 from app.idempotency_records where tenant_id=p_tenant and actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key and operation='club_admin:'||p_action and request_hash<>extensions.digest(convert_to(jsonb_build_object('action',p_action,'resource',p_resource,'version',p_expected_version,'payload',p_payload)::text,'UTF8'),'sha256'))or p_surface='platform'and exists(select 1 from app.platform_command_receipts where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key and request_hash<>extensions.digest(convert_to(jsonb_build_object('action',p_action,'id',p_resource,'version',p_expected_version,'payload',p_payload)::text,'UTF8'),'sha256'))then raise exception using errcode='22000',message='IDEMPOTENCY_CONFLICT';end if;
 end if;
 insert into app.admin_command_intents(actor_auth_user_id,idempotency_key,surface,tenant_id,action,resource_id,expected_version,payload,request_hash,state,resolved_at)
 values(internal.current_actor_uid(),p_key,p_surface,p_tenant,p_action,p_resource,p_expected_version,p_payload,hash,case when completed then 'confirmed'else 'prepared'end,case when completed then statement_timestamp()end);
 return jsonb_build_object('ok',true,'state',case when completed then 'confirmed'else 'prepared'end);
end;$$;
create function internal.admin_pending_commands(p_surface text,p_tenant uuid)returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.actor_has_active_session()or (p_surface='club'and not internal.is_active_member(p_tenant))or(p_surface='platform'and not coalesce((internal.platform_access()->>'authorized')::boolean,false))or p_surface<>all(array['club','platform'])then raise exception using errcode='42501',message='FORBIDDEN';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('key',r.idempotency_key,'surface',r.surface,'club',(select slug from app.tenants where id=r.tenant_id),'action',r.action,'resource_id',r.resource_id,'version',r.expected_version,'payload',r.payload,'prepared_at',r.prepared_at,'state',r.state)order by r.prepared_at)from app.admin_command_intents r
  where r.actor_auth_user_id=internal.current_actor_uid()and r.surface=p_surface and r.tenant_id is not distinct from p_tenant and r.state='prepared'and internal.admin_intent_authorized(r.surface,r.tenant_id,r.action,r.resource_id,r.payload)),'[]');
end;$$;
create function internal.admin_cancel_command(p_surface text,p_tenant uuid,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r app.admin_command_intents%rowtype;begin
 if not internal.actor_has_active_session()then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform internal.admin_intent_lock(p_key);
 select * into r from app.admin_command_intents where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key and surface=p_surface and tenant_id is not distinct from p_tenant for update;
 if not found then return jsonb_build_object('state','unknown');end if;
 if r.state='confirmed'then return jsonb_build_object('state','confirmed');end if;
 if not internal.admin_intent_authorized(r.surface,r.tenant_id,r.action,r.resource_id,r.payload)then raise exception using errcode='42501',message='FORBIDDEN';end if;
 update app.admin_command_intents set state='cancelled',resolved_at=statement_timestamp()where actor_auth_user_id=internal.current_actor_uid()and idempotency_key=p_key;
 return jsonb_build_object('state','cancelled');
end;$$;
create function api.admin_prepare_command(p_surface text,p_tenant uuid,p_action text,p_resource uuid,p_expected_version bigint,p_payload jsonb,p_key uuid)returns jsonb language sql volatile security invoker set search_path='' as $$select internal.admin_prepare_command(p_surface,p_tenant,p_action,p_resource,p_expected_version,p_payload,p_key);$$;
create function api.admin_pending_commands(p_surface text,p_tenant uuid default null)returns jsonb language sql stable security invoker set search_path='' as $$select internal.admin_pending_commands(p_surface,p_tenant);$$;
create function api.admin_cancel_command(p_surface text,p_tenant uuid,p_key uuid)returns jsonb language sql volatile security invoker set search_path='' as $$select internal.admin_cancel_command(p_surface,p_tenant,p_key);$$;
do $privacy$declare r record;begin
 for r in select p.oid::regprocedure signature,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('internal','api')and(p.proname like 'admin_intent_%'or p.proname in('admin_prepare_command','admin_pending_commands','admin_cancel_command'))loop
  execute format('alter function %s owner to cluvo_command_owner',r.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  if r.nspname='api'or r.proname in('admin_prepare_command','admin_pending_commands','admin_cancel_command')then execute format('grant execute on function %s to authenticated',r.signature);end if;
 end loop;
end;$privacy$;
revoke create on schema internal,api from cluvo_command_owner;
notify pgrst,'reload schema';
commit;
