-- Durable command identities contain no form contents or credentials. They are
-- not an offline queue: only an explicit foreground action submits a command.
begin;
grant create on schema api to cluvo_command_owner;
create table app.pwa_command_intents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id),
  actor_auth_user_id uuid not null references auth.users(id), person_id uuid not null,
  idempotency_key uuid not null, action text not null check(action ~ '^[a-z_]{1,60}$'),
  resource_id uuid not null, expected_version bigint not null check(expected_version>=0),
  request_hash bytea not null check(octet_length(request_hash)=32),
  state text not null default 'pending' check(state in ('pending','completed','rejected')),
  created_at timestamptz not null default statement_timestamp(), resolved_at timestamptz,
  version bigint not null default 1 check(version>0),
  foreign key(tenant_id,person_id) references app.persons(tenant_id,id),
  unique(tenant_id,actor_auth_user_id,idempotency_key),unique(tenant_id,id)
);
alter table app.pwa_command_intents enable row level security;
alter table app.pwa_command_intents force row level security;
revoke all on app.pwa_command_intents from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_command_intents to cluvo_command_owner;
create policy command_owner_read on app.pwa_command_intents for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_command_intents for insert to cluvo_command_owner with check(actor_auth_user_id=internal.current_actor_uid());
create policy command_owner_update on app.pwa_command_intents for update to cluvo_command_owner using(actor_auth_user_id=internal.current_actor_uid()) with check(actor_auth_user_id=internal.current_actor_uid());
create policy native_session_required on app.pwa_command_intents as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create function internal.pwa_complete_command_intent() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.operation='pwa' and new.status='completed' then
  update app.pwa_command_intents set state='completed',resolved_at=statement_timestamp(),version=version+1
   where tenant_id=new.tenant_id and actor_auth_user_id=new.actor_auth_user_id and idempotency_key=new.idempotency_key and state='pending';
 end if;
 return new;
end;$$;
alter function internal.pwa_complete_command_intent() owner to cluvo_command_owner;
revoke all on function internal.pwa_complete_command_intent() from public,anon,authenticated,service_role;
create trigger pwa_complete_command_intent after insert or update of status on app.idempotency_records for each row execute function internal.pwa_complete_command_intent();

create function internal.pwa_prepare_command(p_tenant_id uuid,p_idempotency_key uuid,p_action text,p_resource_id uuid,p_expected_version bigint,p_request_hash_hex text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=internal.current_actor_uid();v_person uuid;v_row app.pwa_command_intents%rowtype;begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 v_person:=internal.current_person_id(p_tenant_id);
 if v_person is null or p_idempotency_key is null or p_action is null or p_action !~ '^[a-z_]{1,60}$' or p_resource_id is null or p_expected_version is null or p_expected_version<0 or p_request_hash_hex is null or p_request_hash_hex !~ '^[0-9a-f]{64}$' then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 perform pg_advisory_xact_lock(hashtextextended('pwa:'||p_tenant_id::text||':'||v_actor::text||':'||p_idempotency_key::text,0));
 select * into v_row from app.pwa_command_intents where tenant_id=p_tenant_id and actor_auth_user_id=v_actor and idempotency_key=p_idempotency_key for update;
 if found then
  if v_row.action<>p_action or v_row.resource_id<>p_resource_id or v_row.expected_version<>p_expected_version or v_row.request_hash<>decode(p_request_hash_hex,'hex') then raise exception using errcode='22000',message='IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('ok',true,'idempotency_key',v_row.idempotency_key,'state',v_row.state);
 end if;
 if (select count(*) from app.pwa_command_intents where tenant_id=p_tenant_id and actor_auth_user_id=v_actor and state='pending' and created_at>statement_timestamp()-interval '1 day')>=50 then raise exception using errcode='54000',message='PENDING_COMMAND_LIMIT';end if;
 insert into app.pwa_command_intents(tenant_id,actor_auth_user_id,person_id,idempotency_key,action,resource_id,expected_version,request_hash) values(p_tenant_id,v_actor,v_person,p_idempotency_key,p_action,p_resource_id,p_expected_version,decode(p_request_hash_hex,'hex')) returning * into v_row;
 return jsonb_build_object('ok',true,'idempotency_key',v_row.idempotency_key,'state',v_row.state);
end;$$;
create function api.pwa_prepare_command(p_tenant_id uuid,p_idempotency_key uuid,p_action text,p_resource_id uuid,p_expected_version bigint,p_request_hash_hex text) returns jsonb language sql security invoker set search_path='' as $$select internal.pwa_prepare_command(p_tenant_id,p_idempotency_key,p_action,p_resource_id,p_expected_version,p_request_hash_hex);$$;

create function internal.pwa_pending_commands(p_tenant_id uuid)
returns table(idempotency_key uuid,action text) language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 return query select i.idempotency_key,i.action from app.pwa_command_intents i where i.tenant_id=p_tenant_id and i.actor_auth_user_id=internal.current_actor_uid() and i.state='pending' and i.created_at>statement_timestamp()-interval '1 day' order by i.created_at;
end;$$;
create function api.pwa_pending_commands(p_tenant_id uuid) returns table(idempotency_key uuid,action text) language sql stable security invoker set search_path='' as $$select * from internal.pwa_pending_commands(p_tenant_id);$$;

create function internal.pwa_resolve_command_intent(p_tenant_id uuid,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_status jsonb;v_row app.pwa_command_intents%rowtype;v_invitation uuid;v_delivery text;begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 v_status:=internal.pwa_command_status(p_tenant_id,p_idempotency_key);
 select * into v_row from app.pwa_command_intents where tenant_id=p_tenant_id and actor_auth_user_id=internal.current_actor_uid() and idempotency_key=p_idempotency_key for update;
 if v_row.action='invite_executor' and v_status->>'status'='confirmed' then
  v_invitation:=(v_status->'receipt'->>'resource_id')::uuid;
  select delivery_status into v_delivery from app.household_invitations where tenant_id=p_tenant_id and id=v_invitation;
  if v_delivery not in ('sent','accepted') or v_delivery is null then return jsonb_build_object('status','pending_delivery');end if;
 end if;
 if v_status->>'status' in ('confirmed','rejected') then
  update app.pwa_command_intents set state=case when v_status->>'status'='confirmed' then 'completed' else 'rejected' end,resolved_at=statement_timestamp(),version=version+1 where id=v_row.id and state='pending';
 end if;
 return jsonb_build_object('status',v_status->>'status');
end;$$;
create function api.pwa_resolve_command_intent(p_tenant_id uuid,p_idempotency_key uuid) returns jsonb language sql security invoker set search_path='' as $$select internal.pwa_resolve_command_intent(p_tenant_id,p_idempotency_key);$$;

-- A mobile invitation shares the same transaction fence as status lookup.
-- The canonical command still performs every dossier/version/rights check.
create function internal.pwa_create_household_invitation(p_tenant_id uuid,p_household_id uuid,p_given_name text,p_family_name text,p_email text,p_token_hash_hex text,p_can_view_progress boolean,p_can_book_for boolean,p_expected_household_version bigint,p_idempotency_key uuid)
returns table(ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb) language plpgsql security definer set search_path='' as $$
begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('pwa:'||p_tenant_id::text||':'||internal.current_actor_uid()::text||':'||p_idempotency_key::text,0));
 return query select * from internal.create_household_invitation_v2(p_tenant_id,p_household_id,p_given_name,p_family_name,p_email,p_token_hash_hex,p_can_view_progress,p_can_book_for,p_expected_household_version,p_idempotency_key);
end;$$;
create function api.pwa_create_household_invitation(p_tenant_id uuid,p_household_id uuid,p_given_name text,p_family_name text,p_email text,p_token_hash_hex text,p_can_view_progress boolean,p_can_book_for boolean,p_expected_household_version bigint,p_idempotency_key uuid)
returns table(ok boolean,resource_id uuid,version bigint,event_ids uuid[],result jsonb) language sql security invoker set search_path='' as $$select * from internal.pwa_create_household_invitation(p_tenant_id,p_household_id,p_given_name,p_family_name,p_email,p_token_hash_hex,p_can_view_progress,p_can_book_for,p_expected_household_version,p_idempotency_key);$$;

-- Per-device receipts prevent one successful device from hiding failure on a
-- second device. Provider credentials and subscription secrets remain separate.
create table app.pwa_delivery_targets (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id),
 outbox_id uuid not null,subscription_id uuid,target_key text not null,
 state text not null default 'pending' check(state in ('pending','leased','sent','failed','unknown','cancelled')),
 lease_owner uuid,lease_until timestamptz,attempts integer not null default 0 check(attempts>=0),
 next_attempt_at timestamptz not null default statement_timestamp(),provider_status smallint,
 version bigint not null default 1 check(version>0),created_at timestamptz not null default statement_timestamp(),
 foreign key(tenant_id,outbox_id) references app.pwa_delivery_outbox(tenant_id,id),
 foreign key(tenant_id,subscription_id) references app.pwa_push_subscriptions(tenant_id,id),
 unique(tenant_id,outbox_id,target_key),unique(tenant_id,id)
);
alter table app.pwa_delivery_targets enable row level security;
alter table app.pwa_delivery_targets force row level security;
revoke all on app.pwa_delivery_targets from public,anon,authenticated,service_role;
create policy native_session_required on app.pwa_delivery_targets as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));
-- This table is used solely by the trusted hosted worker through the fixed
-- staging database connection; neither application role can bypass its RLS.
create table app.pwa_delivery_attempt_log (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id),target_id uuid not null,
 attempt integer not null check(attempt>0),state text not null check(state in ('leased','sent','failed','unknown','cancelled')),
 provider_status smallint,worker_id uuid not null,occurred_at timestamptz not null default statement_timestamp(),
 source_sha text not null default current_setting('cluvo.delivery_source',true) check(source_sha ~ '^[0-9a-f]{40}$'),
 workflow_run_id text not null default current_setting('cluvo.delivery_run',true) check(workflow_run_id ~ '^[1-9][0-9]{0,19}$'),
 actor text not null default current_setting('cluvo.delivery_actor',true) check(actor ~ '^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$'),
 foreign key(tenant_id,target_id) references app.pwa_delivery_targets(tenant_id,id),unique(tenant_id,id)
);
alter table app.pwa_delivery_attempt_log enable row level security;
alter table app.pwa_delivery_attempt_log force row level security;
revoke all on app.pwa_delivery_attempt_log from public,anon,authenticated,service_role;
create policy native_session_required on app.pwa_delivery_attempt_log as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));
create trigger pwa_delivery_attempt_log_immutable before update or delete on app.pwa_delivery_attempt_log for each row execute function internal.reject_immutable_change();

create function internal.pwa_claim_deliveries(p_worker_id uuid,p_limit integer default 20) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_ids uuid[];v_result jsonb;begin
 if p_worker_id is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='INVALID_DELIVERY_REQUEST';end if;
 -- An expired external-send lease has an unknown outcome and is never replayed.
 with expired as (update app.pwa_delivery_targets set state='unknown',version=version+1 where state='leased' and lease_until<statement_timestamp() returning *)
 insert into app.pwa_delivery_attempt_log(tenant_id,target_id,attempt,state,worker_id) select tenant_id,id,attempts,'unknown',lease_owner from expired;
 insert into app.pwa_delivery_targets(tenant_id,outbox_id,target_key)
  select o.tenant_id,o.id,'email' from app.pwa_delivery_outbox o where o.state='pending' and o.channel='email' on conflict do nothing;
 insert into app.pwa_delivery_targets(tenant_id,outbox_id,subscription_id,target_key)
  select o.tenant_id,o.id,s.id,s.id::text from app.pwa_delivery_outbox o join app.pwa_push_subscriptions s on s.tenant_id=o.tenant_id and s.person_id=o.recipient_person_id and s.revoked_at is null where o.state='pending' and o.channel='push' on conflict do nothing;
 with chosen as (select id from app.pwa_delivery_targets where state in ('pending','failed') and next_attempt_at<=statement_timestamp() and attempts<5 order by created_at,id limit p_limit for update skip locked),
 claimed as (update app.pwa_delivery_targets t set state='leased',lease_owner=p_worker_id,lease_until=statement_timestamp()+interval '3 minutes',attempts=attempts+1,version=version+1 from chosen where t.id=chosen.id returning t.*)
 select array_agg(id) into v_ids from claimed;
 insert into app.pwa_delivery_attempt_log(tenant_id,target_id,attempt,state,worker_id) select tenant_id,id,attempts,'leased',p_worker_id from app.pwa_delivery_targets where id=any(v_ids);
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'channel',o.channel,'path','/app/c/'||club.slug||'/notifications',
 'eligible',person.status='active' and account.id is not null and membership.id is not null and case when o.channel='email' then coalesce(pref.email,true) else coalesce(pref.push,false) end and case notification.notification_kind when 'team' then coalesce(pref.team,true) when 'reminder' then coalesce(pref.reminders,true) when 'news' then coalesce(pref.news,true) else true end,
 'email',account.email,'subscription',case when s.id is not null and s.revoked_at is null then jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth_secret)) end)),'[]') into v_result
 from app.pwa_delivery_targets t join app.pwa_delivery_outbox o on o.tenant_id=t.tenant_id and o.id=t.outbox_id
 join app.pwa_notifications notification on notification.tenant_id=o.tenant_id and notification.id=o.notification_id
 join app.tenants club on club.id=t.tenant_id join app.persons person on person.tenant_id=o.tenant_id and person.id=o.recipient_person_id
 left join app.account_person_links link on link.tenant_id=o.tenant_id and link.person_id=o.recipient_person_id and link.revoked_at is null
 left join auth.users account on account.id=link.auth_user_id and account.deleted_at is null and (account.banned_until is null or account.banned_until<=statement_timestamp())
 left join app.tenant_memberships membership on membership.tenant_id=o.tenant_id and membership.auth_user_id=account.id and membership.status='active' and membership.starts_at<=statement_timestamp() and (membership.ends_at is null or membership.ends_at>statement_timestamp())
 left join app.pwa_push_subscriptions s on s.tenant_id=t.tenant_id and s.id=t.subscription_id
 left join app.pwa_preferences pref on pref.tenant_id=o.tenant_id and pref.person_id=o.recipient_person_id
 where t.id=any(v_ids);
 return v_result;
end;$$;

create function internal.pwa_finish_delivery(p_target_id uuid,p_worker_id uuid,p_expected_version bigint,p_state text,p_provider_status integer default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_row app.pwa_delivery_targets%rowtype;begin
 if p_state not in ('sent','failed','unknown','cancelled') or p_provider_status is not null and p_provider_status not between 100 and 599 then raise exception using errcode='22023',message='INVALID_DELIVERY_RESULT';end if;
 select * into strict v_row from app.pwa_delivery_targets where id=p_target_id for update;
 if v_row.state<>'leased' or v_row.lease_owner is distinct from p_worker_id or v_row.version<>p_expected_version then raise exception using errcode='40001',message='STALE_DELIVERY_LEASE';end if;
 update app.pwa_delivery_targets set state=p_state,provider_status=p_provider_status,next_attempt_at=statement_timestamp()+make_interval(secs=>least(3600,60*(2^least(attempts,6))::integer)),version=version+1 where id=p_target_id;
 insert into app.pwa_delivery_attempt_log(tenant_id,target_id,attempt,state,provider_status,worker_id) values(v_row.tenant_id,p_target_id,v_row.attempts,p_state,p_provider_status,p_worker_id);
 if p_provider_status in (404,410) and v_row.subscription_id is not null then update app.pwa_push_subscriptions set revoked_at=statement_timestamp(),version=version+1 where tenant_id=v_row.tenant_id and id=v_row.subscription_id;end if;
 update app.pwa_delivery_outbox o set state='sent',attempts=attempts+1,version=version+1 where o.tenant_id=v_row.tenant_id and o.id=v_row.outbox_id and not exists(select 1 from app.pwa_delivery_targets t where t.tenant_id=o.tenant_id and t.outbox_id=o.id and t.state<>'sent');
 return jsonb_build_object('ok',true,'state',p_state);
end;$$;
revoke all on function internal.pwa_claim_deliveries(uuid,integer),internal.pwa_finish_delivery(uuid,uuid,bigint,text,integer) from public,anon,authenticated,service_role,cluvo_command_owner;

-- Cursor reads always reauthorize the live native actor. Cursor contents are
-- immutable timestamps/IDs, never alternate identity or scope selectors.
create function internal.pwa_message_page(p_tenant_id uuid,p_channel_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_more boolean;begin
 if p_limit is null or p_limit not between 1 and 50 or (p_before_at is null)<>(p_before_id is null) then raise exception using errcode='22023',message='INVALID_CURSOR';end if;
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) or not internal.pwa_can_channel(p_tenant_id,p_channel_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 select coalesce(jsonb_agg(q.item order by q.created_at desc,q.id desc),'[]') into v_items from (
 select m.id,m.created_at,jsonb_build_object('id',m.id,'version',m.version,'channel_id',m.channel_id,'author_name',concat_ws(' ',p.given_name,p.family_name),'is_self',m.person_id=internal.current_person_id(p_tenant_id),'body',m.body,'created_at',m.created_at) item
 from app.pwa_messages m join app.persons p on p.tenant_id=m.tenant_id and p.id=m.person_id
 where m.tenant_id=p_tenant_id and m.channel_id=p_channel_id and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id)) order by m.created_at desc,m.id desc limit p_limit+1)q;
 v_more:=jsonb_array_length(v_items)>p_limit;
 if v_more then v_items:=v_items #- array[p_limit::text];end if;
 return jsonb_build_object('items',v_items,'more',v_more,'cursor',case when v_more then jsonb_build_object('at',v_items->(p_limit-1)->>'created_at','id',v_items->(p_limit-1)->>'id') end);
end;$$;
create function api.pwa_message_page(p_tenant_id uuid,p_channel_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50) returns jsonb language sql stable security invoker set search_path='' as $$select internal.pwa_message_page(p_tenant_id,p_channel_id,p_before_at,p_before_id,p_limit);$$;
create function internal.pwa_card_reply_page(p_tenant_id uuid,p_card_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb;v_more boolean;begin
 if p_limit is null or p_limit not between 1 and 50 or (p_before_at is null)<>(p_before_id is null) then raise exception using errcode='22023',message='INVALID_CURSOR';end if;
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) or not internal.can_person_view_card(p_tenant_id,internal.current_person_id(p_tenant_id),p_card_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 select coalesce(jsonb_agg(q.item order by q.created_at desc,q.id desc),'[]') into v_items from (
 select r.id,r.created_at,jsonb_build_object('id',r.id,'version',r.version,'author_name',concat_ws(' ',p.given_name,p.family_name),'body',r.body,'created_at',r.created_at) item
 from app.pwa_card_replies r join app.persons p on p.tenant_id=r.tenant_id and p.id=r.person_id
 where r.tenant_id=p_tenant_id and r.card_id=p_card_id and (p_before_at is null or (r.created_at,r.id)<(p_before_at,p_before_id)) order by r.created_at desc,r.id desc limit p_limit+1)q;
 v_more:=jsonb_array_length(v_items)>p_limit;
 if v_more then v_items:=v_items #- array[p_limit::text];end if;
 return jsonb_build_object('items',v_items,'more',v_more,'cursor',case when v_more then jsonb_build_object('at',v_items->(p_limit-1)->>'created_at','id',v_items->(p_limit-1)->>'id') end);
end;$$;
create function api.pwa_card_reply_page(p_tenant_id uuid,p_card_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50) returns jsonb language sql stable security invoker set search_path='' as $$select internal.pwa_card_reply_page(p_tenant_id,p_card_id,p_before_at,p_before_id,p_limit);$$;

do $owners$ declare r record;begin
 for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('internal','api') and p.proname in ('pwa_prepare_command','pwa_pending_commands','pwa_resolve_command_intent','pwa_create_household_invitation','pwa_message_page','pwa_card_reply_page') loop
  execute format('alter function %s owner to cluvo_command_owner',r.sig);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);
  execute format('grant execute on function %s to authenticated',r.sig);
 end loop;
end;$owners$;
revoke create on schema api from cluvo_command_owner;
commit;
