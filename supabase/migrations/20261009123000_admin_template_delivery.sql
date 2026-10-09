-- Template versions join the existing, receipted notification delivery chain.
begin;
grant create on schema internal to cluvo_command_owner;
alter table app.template_test_runs
 add column outbox_id uuid,
 add column rendered_subject text,
 add column rendered_text text,
 add column last_delivery_state text check(last_delivery_state in('pending','leased','sent','failed','unknown','cancelled')),
 add foreign key(tenant_id,outbox_id) references app.pwa_delivery_outbox(tenant_id,id) on delete restrict,
 add unique(tenant_id,outbox_id);

create function internal.admin_template_example(p_club text,p_slug text,p_scenario text)returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare v jsonb;begin
 if p_scenario is null or p_scenario<>all(array['standard','missing_name','long_title','two_children','no_hours','represented'])then raise exception using errcode='22023',message='INVALID_TEMPLATE_SCENARIO';end if;
 v:=jsonb_build_object('vereniging',p_club,'voornaam','Voorbeeldlid','huishouden','Voorbeeldhuishouden','dienst','Bardienst','commissie','Vrijwilligerscommissie','urenstand','0 bevestigde minuten','beleidsversie','Voorbeeldversie 1','actielink','https://staging.cluvo.nl/app/c/'||p_slug||'/notifications');
 if p_scenario='missing_name' then v:=v-'voornaam';
 elsif p_scenario='long_title' then v:=jsonb_set(v,'{dienst}',to_jsonb(repeat('Een lange taaknaam ',10)));
 elsif p_scenario='two_children' then v:=jsonb_set(v,'{huishouden}','"Voorbeeldhuishouden met twee kinderen; één gekozen kindtelling"');
 elsif p_scenario='no_hours' then v:=jsonb_set(v,'{urenstand}','"Nog geen bevestigde minuten"');
 elsif p_scenario='represented' then v:=jsonb_set(v,'{voornaam}','"Benoemde vertegenwoordiger"');end if;
 return v;
end;$$;
create function internal.admin_template_render(p_text text,p_variables jsonb)returns text
language plpgsql immutable security invoker set search_path='' as $$
declare m text[];k text;r text:=p_text;fallback jsonb:='{"voornaam":"beste clublid","vereniging":"jouw vereniging","huishouden":"jouw huishouden","dienst":"de taak","commissie":"de verantwoordelijke commissie","urenstand":"Nog geen bevestigde minuten","beleidsversie":"de aangeboden versie","actielink":"https://staging.cluvo.nl/app/"}'::jsonb;begin
 if p_text is null or length(p_text)>10000 or jsonb_typeof(p_variables) is distinct from 'object' then raise exception using errcode='22023',message='INVALID_TEMPLATE';end if;
 for m in select regexp_matches(p_text,'\{\{([^{}]+)\}\}','g')loop
  k:=btrim(m[1]);if not fallback?k then raise exception using errcode='22023',message='UNKNOWN_TEMPLATE_VARIABLE';end if;
  r:=replace(r,'{{'||m[1]||'}}',coalesce(nullif(p_variables->>k,''),fallback->>k));
 end loop;
 if r~'\{\{|\}\}' or length(r)>20000 then raise exception using errcode='22023',message='INVALID_TEMPLATE';end if;
 return r;
end;$$;
-- Bind the existing current-identity column grants at migration time, as the
-- native session helpers do. No Auth schema access or directory is delegated.
create function internal.admin_template_current_recipient_hash()returns bytea
language sql stable security definer set search_path=''
begin atomic
 select extensions.digest(convert_to(lower(u.email),'UTF8'),'sha256') from auth.users u
 where u.id=internal.current_actor_uid() and internal.actor_has_active_session();
end;

-- Return a scoped yes/no proof without delegating private worker tables.
create function internal.template_provider_acceptance_for_admin(p_tenant uuid,p_revision uuid)returns boolean
language sql stable security definer set search_path=''
begin atomic
 select internal.actor_has_active_session() and exists(
  select 1 from app.template_test_runs tr
  join app.message_template_versions v on v.tenant_id=tr.tenant_id and v.id=tr.template_version_id
  join app.message_templates mt on mt.tenant_id=v.tenant_id and mt.id=v.template_id
  join app.pwa_delivery_targets target on target.tenant_id=tr.tenant_id and target.outbox_id=tr.outbox_id
  join app.pwa_provider_receipts receipt on receipt.tenant_id=target.tenant_id and receipt.target_id=target.id
  join app.pwa_delivery_attempt_log attempt on attempt.tenant_id=receipt.tenant_id and attempt.id=receipt.attempt_log_id
  where tr.tenant_id=p_tenant and tr.template_version_id=p_revision and tr.status='accepted'
   and internal.club_admin_can(p_tenant,'communication.manage',case when mt.committee_id is null then 'tenant'else 'committee'end,coalesce(mt.committee_id,p_tenant))
   and attempt.state='sent'and attempt.provider_status=202 and receipt.body_sha256 is not null and receipt.template_revision=v.revision);
end;
alter function internal.template_provider_acceptance_for_admin(uuid,uuid)owner to postgres;
revoke all on function internal.template_provider_acceptance_for_admin(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function internal.template_provider_acceptance_for_admin(uuid,uuid)to cluvo_command_owner;

create function internal.admin_template_command(p_tenant uuid,p_action text,p_resource uuid,p_expected_version bigint,p_payload jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare t app.message_templates%rowtype;v app.message_template_versions%rowtype;club app.tenants%rowtype;
 actor uuid:=internal.current_actor_uid();person uuid;email_hash bytea;variables jsonb;subject text;body text;html text;test_id uuid:=gen_random_uuid();event_id uuid:=gen_random_uuid();notification_id uuid:=gen_random_uuid();outbox_id uuid:=gen_random_uuid();revision_id uuid;committee uuid;
begin
 if p_key is null then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant)then raise exception using errcode='42501',message='FORBIDDEN';end if;
 select * into strict club from app.tenants where id=p_tenant;
 select * into t from app.message_templates where tenant_id=p_tenant and id=p_resource for update;
 if coalesce(t.version,0)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
 committee:=case when t.id is null then (p_payload->>'committee_id')::uuid else t.committee_id end;
 if not internal.club_admin_can(p_tenant,'communication.manage',case when committee is null then 'tenant'else 'committee'end,coalesce(committee,p_tenant))then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_action='save_template_draft' then
  if coalesce(p_payload->>'template_key','')!~'^[a-z][a-z0-9_.-]{0,99}$' or length(coalesce(btrim(p_payload->>'name'),''))not between 1 and 150
   or length(coalesce(btrim(p_payload->>'subject'),''))not between 1 and 200 or length(coalesce(p_payload->>'text_body',''))not between 1 and 10000
   or length(coalesce(p_payload->>'sender_name',''))not between 1 and 150 or length(coalesce(p_payload->>'preheader',''))>300 or length(coalesce(p_payload->>'button_label',''))>100
   or coalesce(p_payload->>'subject','')~'[\r\n]' or coalesce(p_payload->>'sender_name','')~'[\r\n]'
   or (coalesce(p_payload->>'reply_to','')<>''and p_payload->>'reply_to'!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
   or (coalesce(p_payload->>'image_path','')<>''and p_payload->>'image_path'!~'^/brand/[a-zA-Z0-9/_-]+[.](png|svg|webp)$')then raise exception using errcode='22023',message='INVALID_TEMPLATE';end if;
  if committee is not null and not exists(select 1 from app.committees where tenant_id=p_tenant and id=committee)then raise exception using errcode='42501',message='FORBIDDEN';end if;
  variables:=internal.admin_template_example(club.name,club.slug,'standard');
  perform internal.admin_template_render(p_payload->>'subject',variables);perform internal.admin_template_render(p_payload->>'text_body',variables);perform internal.admin_template_render(coalesce(p_payload->>'preheader',''),variables);
  if t.id is null then
   insert into app.message_templates(id,tenant_id,template_key,name,owner_scope,committee_id)values(p_resource,p_tenant,p_payload->>'template_key',p_payload->>'name',case when committee is null then 'tenant'else 'committee'end,committee)returning * into t;
  elsif t.template_key<>p_payload->>'template_key' or t.committee_id is distinct from (p_payload->>'committee_id')::uuid then raise exception using errcode='55000',message='TEMPLATE_SCOPE_FROZEN';end if;
  -- React displays text safely; the stored HTML is generated from escaped text.
  html:='<p>'||replace(replace(replace(replace(p_payload->>'text_body','&','&amp;'),'<','&lt;'),'>','&gt;'),E'\n','<br>')||'</p>';
  insert into app.message_template_versions(tenant_id,template_id,revision,subject,preheader,sender_name,reply_to,html_body,text_body,button_json,variable_schema,fallback_values,created_by_auth_user_id)
   values(p_tenant,p_resource,t.current_revision+1,p_payload->>'subject',p_payload->>'preheader',p_payload->>'sender_name',nullif(p_payload->>'reply_to',''),html,p_payload->>'text_body',
    case when coalesce(p_payload->>'button_label','')=''then '[]'::jsonb else jsonb_build_array(jsonb_build_object('label',p_payload->>'button_label','url','{{actielink}}'))end,
    jsonb_build_object('allowed',jsonb_build_array('voornaam','vereniging','huishouden','dienst','commissie','urenstand','beleidsversie','actielink'),'image_path',coalesce(p_payload->>'image_path','')),variables-'voornaam',actor)returning id into revision_id;
  update app.message_templates set name=p_payload->>'name',current_revision=current_revision+1,version=case when p_expected_version=0 then 1 else version+1 end,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource returning * into t;
 else
  select * into v from app.message_template_versions where tenant_id=p_tenant and template_id=p_resource and id=(p_payload->>'revision_id')::uuid and revision=t.current_revision for update;
  if v.id is null then raise exception using errcode='40001',message='TEMPLATE_VERSION_CHANGED';end if;
  revision_id:=v.id;
  if p_action in('preview_template','queue_template_test')then
   if v.state not in('draft','previewed','test_sent')then raise exception using errcode='55000',message='TEMPLATE_VERSION_FROZEN';end if;
   if p_action='queue_template_test'and (v.state='draft'or p_payload->'explicit_confirmation' is distinct from 'true'::jsonb)then raise exception using errcode='55000',message='TEMPLATE_PREVIEW_REQUIRED';end if;
   variables:=internal.admin_template_example(club.name,club.slug,p_payload->>'scenario');
   if p_action='queue_template_test'then
    person:=internal.current_person_id(p_tenant);
    email_hash:=internal.admin_template_current_recipient_hash();
    if person is null or email_hash is null or not exists(select 1 from app.account_person_links where tenant_id=p_tenant and person_id=person and auth_user_id=actor and revoked_at is null and verified_at is not null)then raise exception using errcode='42501',message='VERIFIED_PERSONAL_RECIPIENT_REQUIRED';end if;
    if exists(select 1 from app.pwa_preferences where tenant_id=p_tenant and person_id=person and not email)then raise exception using errcode='55000',message='EMAIL_PREFERENCE_DISABLED';end if;
    -- A manual retry must never create a second delivery after an unknown result.
    if exists(select 1 from app.template_test_runs tr where tr.tenant_id=p_tenant and tr.template_version_id=v.id and tr.requested_by_auth_user_id=actor and tr.outbox_id is not null and tr.last_delivery_state in('pending','leased','unknown','sent'))then raise exception using errcode='55000',message='TEMPLATE_DELIVERY_ALREADY_TRACKED';end if;
   end if;
   subject:=internal.admin_template_render(v.subject,variables);body:=internal.admin_template_render(v.text_body,variables);
   if length(subject)>200 then raise exception using errcode='22023',message='RENDERED_SUBJECT_TOO_LONG';end if;
   if p_action='preview_template'then
    insert into app.template_test_runs(id,tenant_id,template_version_id,requested_by_auth_user_id,recipient_reference_hash,variable_snapshot,status,rendered_subject,rendered_text)
     values(test_id,p_tenant,v.id,actor,extensions.digest(convert_to('preview:'||actor::text,'UTF8'),'sha256'),variables,'rendered',subject,body);
    if v.state='draft'then update app.message_template_versions set state='previewed'where tenant_id=p_tenant and id=v.id;end if;
   else
    insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)values(event_id,p_tenant,'message_template',p_resource,t.version+1,'admin.template_test_requested',jsonb_build_object('revision_id',v.id,'requested_by',actor));
    insert into app.pwa_notifications(id,tenant_id,recipient_person_id,title,body,source_path,event_id)values(notification_id,p_tenant,person,'Persoonlijke templatecontrole','Je aangevraagde templatecontrole wordt volgens je voorkeuren verwerkt.','/app/c/'||club.slug||'/notifications',event_id);
    insert into app.pwa_delivery_outbox(id,tenant_id,recipient_person_id,notification_id,channel)values(outbox_id,p_tenant,person,notification_id,'email');
    insert into app.template_test_runs(id,tenant_id,template_version_id,requested_by_auth_user_id,recipient_reference_hash,variable_snapshot,status,outbox_id,rendered_subject,rendered_text,last_delivery_state)
     values(test_id,p_tenant,v.id,actor,email_hash,variables,'planned',outbox_id,subject,body,'pending');
   end if;
  elsif p_action='approve_template'then
   if p_payload->'explicit_confirmation' is distinct from 'true'::jsonb or v.state<>'test_sent'or not internal.template_provider_acceptance_for_admin(p_tenant,v.id)then raise exception using errcode='55000',message='ACTUAL_TEMPLATE_TEST_REQUIRED';end if;
   update app.message_template_versions set state='approved',approved_by_auth_user_id=actor,approved_at=statement_timestamp()where tenant_id=p_tenant and id=v.id;
  elsif p_action='publish_template'then
   if p_payload->'explicit_confirmation' is distinct from 'true'::jsonb or v.state<>'approved'then raise exception using errcode='55000',message='TEMPLATE_APPROVAL_REQUIRED';end if;
   update app.message_template_versions set state='published',published_at=statement_timestamp()where tenant_id=p_tenant and id=v.id;
  else raise exception using errcode='22023',message='UNKNOWN_COMMAND';end if;
  update app.message_templates set version=version+1,updated_at=statement_timestamp()where tenant_id=p_tenant and id=p_resource returning * into t;
 end if;
 if p_action<>'queue_template_test'then insert into app.domain_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal)values(p_tenant,'message_template',t.id,t.version,'admin.'||p_action,jsonb_build_object('revision_id',revision_id,'actor',actor));end if;
 return jsonb_build_object('ok',true,'resource_id',t.id,'version',t.version,'result',jsonb_build_object('revision_id',revision_id,'test_id',case when p_action in('preview_template','queue_template_test')then test_id end));
end;$$;

-- The existing worker still obtains and verifies the same native delivery lease.
alter function internal.pwa_revalidate_delivery(uuid,uuid,bigint)rename to pwa_revalidate_delivery_before_admin_templates;
create function internal.pwa_revalidate_delivery(p_target_id uuid,p_worker_id uuid,p_expected_version bigint)returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;tr app.template_test_runs%rowtype;v app.message_template_versions%rowtype;recipient_email text;begin
 result:=internal.pwa_revalidate_delivery_before_admin_templates(p_target_id,p_worker_id,p_expected_version);
 select test.* into tr from app.pwa_delivery_targets t join app.template_test_runs test on test.tenant_id=t.tenant_id and test.outbox_id=t.outbox_id where t.id=p_target_id;
 if tr.id is null then return result;end if;
 select mv.* into v from app.message_template_versions mv join app.message_templates mt on mt.tenant_id=mv.tenant_id and mt.id=mv.template_id and mt.current_revision=mv.revision where mv.tenant_id=tr.tenant_id and mv.id=tr.template_version_id and mv.state in('previewed','test_sent');
 select u.email into recipient_email from auth.users u join app.account_person_links l on l.auth_user_id=u.id and l.tenant_id=tr.tenant_id and l.verified_at is not null and l.revoked_at is null join app.pwa_delivery_outbox o on o.tenant_id=l.tenant_id and o.id=tr.outbox_id and o.recipient_person_id=l.person_id
  join app.tenant_memberships m on m.tenant_id=l.tenant_id and m.auth_user_id=u.id and m.status='active'and m.starts_at<=statement_timestamp()and(m.ends_at is null or m.ends_at>statement_timestamp())
  where u.id=tr.requested_by_auth_user_id and u.email_confirmed_at is not null and u.deleted_at is null and(u.banned_until is null or u.banned_until<=statement_timestamp())and extensions.digest(convert_to(lower(u.email),'UTF8'),'sha256')=tr.recipient_reference_hash limit 1;
 return result||jsonb_build_object('eligible',coalesce((result->>'eligible')::boolean,false)and v.id is not null and recipient_email is not null and tr.last_delivery_state in('pending','leased','failed'),'email',recipient_email,'source_kind','template_test','template_test',jsonb_build_object('subject',tr.rendered_subject,'text',tr.rendered_text,'sender_name',v.sender_name,'reply_to',v.reply_to,'revision',v.revision,'preheader',internal.admin_template_render(coalesce(v.preheader,''),tr.variable_snapshot),'button_label',v.button_json->0->>'label','image_path',v.variable_schema->>'image_path'));
end;$$;

create function internal.admin_template_delivery_attempt()returns trigger
language plpgsql security invoker set search_path='' as $$begin
 update app.template_test_runs tr set last_delivery_state=new.state,status=case when new.state in('failed','cancelled')then 'failed'else tr.status end,error_code=case when new.state='failed'then 'PROVIDER_REJECTED'else null end,version=tr.version+1,updated_at=statement_timestamp()
 from app.pwa_delivery_targets t where t.tenant_id=tr.tenant_id and t.id=new.target_id and t.outbox_id=tr.outbox_id;
 return new;
end;$$;
create trigger admin_template_delivery_attempt after insert on app.pwa_delivery_attempt_log for each row execute function internal.admin_template_delivery_attempt();
create function internal.admin_template_provider_receipt()returns trigger
language plpgsql security invoker set search_path='' as $$
declare tr app.template_test_runs%rowtype;v app.message_template_versions%rowtype;begin
 select test.* into tr from app.pwa_delivery_targets t join app.template_test_runs test on test.tenant_id=t.tenant_id and test.outbox_id=t.outbox_id join app.pwa_delivery_attempt_log a on a.tenant_id=t.tenant_id and a.id=new.attempt_log_id and a.state='sent'and a.provider_status=202 where t.tenant_id=new.tenant_id and t.id=new.target_id;
 if tr.id is null or new.body_sha256 is null then return new;end if;
 select * into v from app.message_template_versions where tenant_id=tr.tenant_id and id=tr.template_version_id;
 if new.template_revision<>v.revision then raise exception using errcode='23514',message='TEMPLATE_RECEIPT_REVISION_MISMATCH';end if;
 update app.template_test_runs set status='accepted',version=version+1,updated_at=statement_timestamp()where tenant_id=tr.tenant_id and id=tr.id;
 if v.state='previewed'then
  update app.message_template_versions set state='test_sent'where tenant_id=v.tenant_id and id=v.id;
  update app.message_templates set version=version+1,updated_at=statement_timestamp()where tenant_id=v.tenant_id and id=v.template_id;
 end if;
 return new;
end;$$;
create trigger admin_template_provider_receipt after insert on app.pwa_provider_receipts for each row execute function internal.admin_template_provider_receipt();

do $privacy$declare r record;begin
 for r in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='internal'and p.proname like 'admin_template_%'loop
  execute format('alter function %s owner to cluvo_command_owner',r.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
 end loop;
end;$privacy$;
revoke all on function internal.pwa_revalidate_delivery(uuid,uuid,bigint)from public,anon,authenticated,service_role,cluvo_command_owner;
revoke create on schema internal from cluvo_command_owner;
notify pgrst,'reload schema';
commit;
