-- Immutable proof of the request actually offered to a provider. Acceptance
-- remains distinct from delivery to a device or mailbox. No message content,
-- address, subscription credential or API key is stored in these receipts.
begin;
create table app.pwa_provider_receipts (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id),
 target_id uuid not null,attempt_log_id uuid not null,attempt integer not null check(attempt>0),
 body_sha256 bytea,template_revision integer,provider_message_key text,
 created_at timestamptz not null default statement_timestamp(),
 foreign key(tenant_id,target_id) references app.pwa_delivery_targets(tenant_id,id),
 foreign key(tenant_id,attempt_log_id) references app.pwa_delivery_attempt_log(tenant_id,id),
 unique(tenant_id,target_id,attempt),unique(tenant_id,id),
 check(body_sha256 is null or octet_length(body_sha256)=32),
 check((body_sha256 is null)=(template_revision is null)),
 check(template_revision is null or template_revision>0),
 check(provider_message_key is null or (body_sha256 is not null and provider_message_key ~ '^[A-Za-z0-9_.-]{1,200}$'))
);
alter table app.pwa_provider_receipts enable row level security;
alter table app.pwa_provider_receipts force row level security;
revoke all on app.pwa_provider_receipts from public,anon,authenticated,service_role,cluvo_command_owner;
create policy native_session_required on app.pwa_provider_receipts as restrictive for all to authenticated
 using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));
create trigger pwa_provider_receipts_immutable before update or delete on app.pwa_provider_receipts
 for each row execute function internal.reject_immutable_change();

create function internal.pwa_finish_delivery_receipted(p_target_id uuid,p_worker_id uuid,p_expected_version bigint,p_state text,p_provider_status integer,p_body_sha256_hex text,p_template_revision integer,p_provider_message_key text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;v_log app.pwa_delivery_attempt_log%rowtype;begin
 perform internal.pwa_automation_guard();
 if (p_body_sha256_hex is null)<>(p_template_revision is null)
 or (p_body_sha256_hex is not null and p_body_sha256_hex !~ '^[0-9a-f]{64}$')
 or (p_template_revision is not null and p_template_revision<1)
 or (p_provider_message_key is not null and (p_body_sha256_hex is null or p_provider_message_key !~ '^[A-Za-z0-9_.-]{1,200}$'))
 then raise exception using errcode='22023',message='INVALID_PROVIDER_RECEIPT';end if;
 v_result:=internal.pwa_finish_delivery(p_target_id,p_worker_id,p_expected_version,p_state,p_provider_status);
 select l.* into strict v_log from app.pwa_delivery_attempt_log l
 join app.pwa_delivery_targets t on t.tenant_id=l.tenant_id and t.id=l.target_id
 where l.target_id=p_target_id and l.worker_id=p_worker_id and l.attempt=t.attempts and l.state=p_state;
 insert into app.pwa_provider_receipts(tenant_id,target_id,attempt_log_id,attempt,body_sha256,template_revision,provider_message_key)
 values(v_log.tenant_id,p_target_id,v_log.id,v_log.attempt,decode(p_body_sha256_hex,'hex'),p_template_revision,p_provider_message_key);
 return v_result;
end;$$;
revoke all on function internal.pwa_finish_delivery_receipted(uuid,uuid,bigint,text,integer,text,integer,text)
 from public,anon,authenticated,service_role,cluvo_command_owner;
commit;
