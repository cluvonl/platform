-- Additive V1 completion: a named, actually booked qualified mentor, atomic
-- club distribution, and own intake initialization. The original 16 and the
-- first four PWA migrations remain immutable.
begin;
-- PWA expectedVersion checking locks a vacancy before the unchanged native
-- interest command. A row lock requires UPDATE privilege; only version is
-- granted to the private command role, with no human table-write grant.
grant update(version) on app.vacancies to cluvo_command_owner;
create policy pwa_command_lock on app.vacancies for update to cluvo_command_owner using(true) with check(true);

create table app.pwa_buddy_authorizations (
 tenant_id uuid not null references app.tenants(id), transaction_id bigint not null,
 actor_auth_user_id uuid not null references auth.users(id), session_id uuid not null,
 position_id uuid not null, executor_person_id uuid not null, obligation_id uuid not null,
 buddy_booking_id uuid not null, buddy_expected_version bigint not null check(buddy_expected_version>0),
 native_idempotency_key uuid not null,purpose text not null default 'book' check(purpose in('book','waitlist')),
 primary key(tenant_id,transaction_id,actor_auth_user_id,session_id,position_id),
 foreign key(tenant_id,position_id) references app.shift_positions(tenant_id,id),
 foreign key(tenant_id,executor_person_id) references app.persons(tenant_id,id),
 foreign key(tenant_id,obligation_id) references app.obligations(tenant_id,id),
 foreign key(tenant_id,buddy_booking_id) references app.bookings(tenant_id,id)
);
create table app.pwa_buddy_links (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id),
 booking_id uuid not null,buddy_booking_id uuid not null,buddy_booking_version bigint not null check(buddy_booking_version>0),
 revision bigint not null check(revision>0),reason text not null check(reason in('chosen','qualified_replacement')),
 qualification_type_id uuid not null,actor_auth_user_id uuid not null references auth.users(id),
 idempotency_key uuid not null,created_at timestamptz not null default statement_timestamp(),
 unique(tenant_id,id),unique(tenant_id,booking_id,revision),check(booking_id<>buddy_booking_id),
 foreign key(tenant_id,booking_id) references app.bookings(tenant_id,id),
 foreign key(tenant_id,buddy_booking_id) references app.bookings(tenant_id,id),
 foreign key(tenant_id,qualification_type_id) references app.qualification_types(tenant_id,id)
);
do $tables$ declare n text;begin
 foreach n in array array['pwa_buddy_authorizations','pwa_buddy_links'] loop
  execute format('alter table app.%I enable row level security',n);
  execute format('alter table app.%I force row level security',n);
  execute format('revoke all on app.%I from public,anon,authenticated,service_role',n);
  execute format('grant select,insert on app.%I to cluvo_command_owner',n);
  execute format('create policy command_owner_read on app.%I for select to cluvo_command_owner using(true)',n);
  execute format('create policy command_owner_insert on app.%I for insert to cluvo_command_owner with check(true)',n);
  execute format('create policy native_session_required on app.%I as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()))',n);
 end loop;
end;$tables$;
grant delete on app.pwa_buddy_authorizations to cluvo_command_owner;
create policy command_owner_delete on app.pwa_buddy_authorizations for delete to cluvo_command_owner using(true);
create trigger pwa_buddy_links_immutable before update or delete on app.pwa_buddy_links for each row execute function internal.reject_immutable_change();
create table app.pwa_club_contacts (
 tenant_id uuid primary key references app.tenants(id),name text not null check(length(btrim(name)) between 1 and 200),
 email text check(email is null or (length(email)<=254 and email~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 phone text check(phone is null or length(phone)<=40),version bigint not null default 1 check(version>0),
 changed_by_auth_user_id uuid not null references auth.users(id),updated_at timestamptz not null default statement_timestamp(),
 check(email is not null or phone is not null)
);
alter table app.pwa_club_contacts enable row level security;
alter table app.pwa_club_contacts force row level security;
revoke all on app.pwa_club_contacts from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_club_contacts to cluvo_command_owner;
create policy command_owner_read on app.pwa_club_contacts for select to cluvo_command_owner using(true);
create policy command_owner_write on app.pwa_club_contacts for all to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_club_contacts as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));
alter table app.pwa_notifications add column essential boolean not null default false;

create function internal.pwa_shift_mutex(p_tenant_id uuid,p_shift_id uuid) returns void
language plpgsql volatile set search_path='' as $$begin
 if p_shift_id is not null then perform pg_advisory_xact_lock(hashtextextended('pwa-shift:'||p_tenant_id::text||':'||p_shift_id::text,0));end if;
end;$$;
create function internal.pwa_qualified(p_tenant_id uuid,p_person_id uuid,p_shift_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.shifts s join app.shift_requirements r on r.tenant_id=s.tenant_id and r.shift_id=s.id
 join app.persons p on p.tenant_id=s.tenant_id and p.id=p_person_id join app.tenants t on t.id=p.tenant_id
 where s.tenant_id=p_tenant_id and s.id=p_shift_id and p.status='active' and p.birth_date_precision='day'
 and p.birth_date+make_interval(years=>greatest(16,coalesce(r.minimum_age,16)))<=(s.starts_at at time zone t.timezone)::date
 and exists(select 1 from app.account_person_links l join app.tenant_memberships m on m.tenant_id=l.tenant_id and m.auth_user_id=l.auth_user_id where l.tenant_id=p_tenant_id and l.person_id=p_person_id and l.revoked_at is null and l.verified_at is not null and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()))
 and r.qualification_type_id is not null and exists(select 1 from app.person_qualifications q where q.tenant_id=p_tenant_id and q.person_id=p_person_id and q.qualification_type_id=r.qualification_type_id and q.revoked_at is null and q.achieved_at<=s.starts_at and (q.expires_at is null or q.expires_at>=s.ends_at)));
$$;
create function internal.pwa_shift_visible(p_tenant_id uuid,p_shift_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select internal.is_active_member(p_tenant_id) and exists(select 1 from app.shifts s join app.shift_positions pos on pos.tenant_id=s.tenant_id and pos.shift_id=s.id left join app.pwa_allocations a on a.tenant_id=pos.tenant_id and a.position_id=pos.id and a.state<>'released' left join app.pwa_clusters c on c.tenant_id=a.tenant_id and c.id=a.cluster_id
 where s.tenant_id=p_tenant_id and s.id=p_shift_id and s.state='published' and s.starts_at>statement_timestamp()
 and (a.id is null or internal.pwa_can_team(p_tenant_id,c.team_id) or exists(select 1 from app.pwa_reserve_requests rr where rr.tenant_id=a.tenant_id and rr.allocation_id=a.id and rr.recipient_person_id=internal.current_person_id(p_tenant_id) and rr.state='requested')));
$$;
create function internal.pwa_buddy_live(p_tenant_id uuid,p_shift_id uuid,p_executor_id uuid,p_booking_id uuid,p_expected_version bigint default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id join app.shifts s on s.tenant_id=pos.tenant_id and s.id=pos.shift_id join app.shift_requirements r on r.tenant_id=s.tenant_id and r.shift_id=s.id
 where b.tenant_id=p_tenant_id and b.id=p_booking_id and s.id=p_shift_id and r.buddy_allowed
 and (p_executor_id is null or b.executor_person_id<>p_executor_id) and b.state in('booked','reconfirmation_required','transfer_pending')
 and (p_expected_version is null or b.version=p_expected_version)
 and b.starts_at_snapshot=s.starts_at and b.ends_at_snapshot=s.ends_at
 and internal.pwa_qualified(p_tenant_id,b.executor_person_id,p_shift_id)
 and exists(select 1 from app.executor_obligation_grants eg where eg.tenant_id=b.tenant_id and eg.person_id=b.executor_person_id and eg.obligation_id=b.obligation_id and eg.revoked_at is null and eg.valid_from<=s.starts_at and (eg.valid_until is null or eg.valid_until>=s.ends_at))
 and not exists(select 1 from app.unavailability_periods u where u.tenant_id=b.tenant_id and u.person_id=b.executor_person_id and tstzrange(u.starts_at,u.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')));
$$;
create function internal.pwa_buddy_authorized(p_tenant_id uuid,p_shift_id uuid,p_position_id uuid,p_executor_id uuid,p_obligation_id uuid,p_key uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.pwa_buddy_authorizations a where a.tenant_id=p_tenant_id and a.transaction_id=txid_current() and a.actor_auth_user_id=internal.current_actor_uid() and a.session_id=internal.current_actor_session_id() and a.position_id=p_position_id and a.executor_person_id=p_executor_id and a.obligation_id=p_obligation_id and a.native_idempotency_key=p_key and a.purpose='book'
 and internal.pwa_buddy_live(p_tenant_id,p_shift_id,p_executor_id,a.buddy_booking_id,a.buddy_expected_version))
 and (select count(*) from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where b.tenant_id=p_tenant_id and pos.shift_id=p_shift_id and b.state in('booked','transfer_pending','reconfirmation_required') and internal.pwa_qualified(p_tenant_id,b.executor_person_id,p_shift_id))>=greatest(1,coalesce((select min_qualified_count from app.shift_requirements where tenant_id=p_tenant_id and shift_id=p_shift_id),0));
$$;
create function internal.pwa_authorize_buddy(p_tenant_id uuid,p_shift_id uuid,p_position_id uuid,p_executor_id uuid,p_obligation_id uuid,p_buddy_id uuid,p_version bigint,p_key uuid,p_purpose text default 'book') returns void
language plpgsql security definer set search_path='' as $$begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) or not internal.can_book_executor(p_tenant_id,p_executor_id,p_obligation_id) or not internal.pwa_shift_visible(p_tenant_id,p_shift_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 perform internal.pwa_shift_mutex(p_tenant_id,p_shift_id);
 if p_buddy_id is null and p_version is null then return;end if;
 if p_buddy_id is null or p_version is null or p_version<1 then raise exception using errcode='22023',message='BUDDY_VERSION_REQUIRED';end if;
 if p_purpose not in('book','waitlist') then raise exception using errcode='22023',message='INVALID_COMMAND';end if;
 if not exists(select 1 from app.shift_positions where tenant_id=p_tenant_id and id=p_position_id and shift_id=p_shift_id) then raise exception using errcode='42501',message='INVALID_BUDDY';end if;
 perform 1 from app.bookings where tenant_id=p_tenant_id and id=p_buddy_id for share;
 if not internal.pwa_buddy_live(p_tenant_id,p_shift_id,p_executor_id,p_buddy_id,p_version) then raise exception using errcode='42501',message='INVALID_BUDDY';end if;
 if exists(select 1 from app.pwa_transfer_offers pending_offer where pending_offer.tenant_id=p_tenant_id and pending_offer.booking_id=p_buddy_id and pending_offer.state='open') then raise exception using errcode='42501',message='BUDDY_REPLACEMENT_PENDING';end if;
 insert into app.pwa_buddy_authorizations(tenant_id,transaction_id,actor_auth_user_id,session_id,position_id,executor_person_id,obligation_id,buddy_booking_id,buddy_expected_version,native_idempotency_key,purpose)
 values(p_tenant_id,txid_current(),internal.current_actor_uid(),internal.current_actor_session_id(),p_position_id,p_executor_id,p_obligation_id,p_buddy_id,p_version,p_key,p_purpose);
end;$$;


create function internal.pwa_capture_buddy() returns trigger language plpgsql security definer set search_path='' as $$
declare a app.pwa_buddy_authorizations%rowtype;s uuid;q uuid;r record;v_event uuid;begin
 select pos.shift_id into strict s from app.shift_positions pos where pos.tenant_id=new.tenant_id and pos.id=new.position_id;
 select qualification_type_id into q from app.shift_requirements where tenant_id=new.tenant_id and shift_id=s;
 select * into a from app.pwa_buddy_authorizations where tenant_id=new.tenant_id and transaction_id=txid_current() and actor_auth_user_id=internal.current_actor_uid() and session_id=internal.current_actor_session_id() and position_id=new.position_id and executor_person_id=new.executor_person_id and obligation_id=new.obligation_id and native_idempotency_key=new.idempotency_key and purpose='book';
 if a.buddy_booking_id is not null then
  if not internal.pwa_buddy_authorized(new.tenant_id,s,new.position_id,new.executor_person_id,new.obligation_id,new.idempotency_key) then raise exception using errcode='42501',message='INVALID_BUDDY';end if;
  insert into app.pwa_buddy_links(tenant_id,booking_id,buddy_booking_id,buddy_booking_version,revision,reason,qualification_type_id,actor_auth_user_id,idempotency_key) values(new.tenant_id,new.id,a.buddy_booking_id,a.buddy_expected_version,1,'chosen',q,internal.current_actor_uid(),new.idempotency_key);
  delete from app.pwa_buddy_authorizations where tenant_id=a.tenant_id and transaction_id=a.transaction_id and actor_auth_user_id=a.actor_auth_user_id and session_id=a.session_id and position_id=a.position_id;
 end if;
 -- A real qualified takeover of the same place appends a mentor substitution;
 -- the original mentor choice and every previous booking remain unchanged.
 if internal.pwa_qualified(new.tenant_id,new.executor_person_id,s) then
  for r in select l.*,b.executor_person_id from app.pwa_buddy_links l join app.bookings origin on origin.tenant_id=l.tenant_id and origin.id=l.buddy_booking_id join app.bookings b on b.tenant_id=l.tenant_id and b.id=l.booking_id where l.tenant_id=new.tenant_id and origin.position_id=new.position_id and origin.state='transferred' and b.state in('booked','transfer_pending','reconfirmation_required') and l.revision=(select max(x.revision) from app.pwa_buddy_links x where x.tenant_id=l.tenant_id and x.booking_id=l.booking_id) loop
   if not internal.pwa_buddy_live(new.tenant_id,s,r.executor_person_id,new.id,new.version) then raise exception using errcode='42501',message='INVALID_BUDDY_REPLACEMENT';end if;
   insert into app.pwa_buddy_links(tenant_id,booking_id,buddy_booking_id,buddy_booking_version,revision,reason,qualification_type_id,actor_auth_user_id,idempotency_key) values(new.tenant_id,r.booking_id,new.id,new.version,r.revision+1,'qualified_replacement',q,internal.current_actor_uid(),new.idempotency_key);
   v_event:=gen_random_uuid();insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal) values(v_event,new.tenant_id,'booking',r.booking_id,r.revision+1,'pwa.buddy_replaced',jsonb_build_object('booking_id',r.booking_id,'buddy_booking_id',new.id));
   insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,idempotency_key,payload_minimal) values(new.tenant_id,internal.current_actor_uid(),'pwa.buddy_replaced','booking',r.booking_id,'tenant',new.tenant_id,new.idempotency_key,jsonb_build_object('previous_buddy_booking_id',r.buddy_booking_id,'previous_buddy_version',r.buddy_booking_version,'buddy_booking_id',new.id));
   perform internal.pwa_notify(new.tenant_id,r.executor_person_id,v_event,'Je begeleider is gewijzigd','Een bevoegde vervanger heeft de begeleidingsplek overgenomen.','/app/tasks?task='||s::text||'&booking='||r.booking_id::text);
  end loop;
 end if;
 return new;
end;$$;

create function internal.pwa_assert_waitlist_eligibility(p_tenant_id uuid,p_shift_id uuid,p_person_id uuid,p_obligation_id uuid,p_key uuid) returns void language plpgsql security definer set search_path='' as $$declare a app.pwa_buddy_authorizations%rowtype;v jsonb;begin
 select proof.* into a from app.pwa_buddy_authorizations proof join app.shift_positions pos on pos.tenant_id=proof.tenant_id and pos.id=proof.position_id where proof.tenant_id=p_tenant_id and pos.shift_id=p_shift_id and proof.transaction_id=txid_current() and proof.actor_auth_user_id=internal.current_actor_uid() and proof.session_id=internal.current_actor_session_id() and proof.executor_person_id=p_person_id and proof.obligation_id=p_obligation_id and proof.native_idempotency_key=p_key and proof.purpose='waitlist';
 if a.buddy_booking_id is null then perform internal.assert_booking_eligibility(p_tenant_id,p_shift_id,p_person_id,p_obligation_id,null);return;end if;
 v:=internal.pwa_suitability(p_tenant_id,a.position_id,p_person_id,p_obligation_id);
 if not(coalesce((v->>'eligible_with_buddy')::boolean,false) or coalesce((v->>'executor_eligible')::boolean,false)) or not internal.pwa_buddy_live(p_tenant_id,p_shift_id,p_person_id,a.buddy_booking_id,a.buddy_expected_version) then raise exception using errcode='42501',message='NOT_ELIGIBLE';end if;
end;$$;
create trigger pwa_capture_buddy after insert on app.bookings for each row execute function internal.pwa_capture_buddy();

create function internal.pwa_assert_buddy_coverage(p_tenant_id uuid,p_shift_id uuid) returns void
language plpgsql security definer set search_path='' as $$declare dependent record;v_required integer;begin
 if not exists(select 1 from app.shifts s join app.shift_requirements r on r.tenant_id=s.tenant_id and r.shift_id=s.id where s.tenant_id=p_tenant_id and s.id=p_shift_id and s.state='published' and s.starts_at>statement_timestamp() and r.qualification_type_id is not null) then return;end if;
 perform internal.pwa_shift_mutex(p_tenant_id,p_shift_id);
 for dependent in select b.id,b.executor_person_id,(select l.buddy_booking_id from app.pwa_buddy_links l where l.tenant_id=b.tenant_id and l.booking_id=b.id order by revision desc limit 1) buddy_id from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where b.tenant_id=p_tenant_id and pos.shift_id=p_shift_id and b.state in('booked','transfer_pending','reconfirmation_required') and not internal.pwa_qualified(p_tenant_id,b.executor_person_id,p_shift_id) loop
  if dependent.buddy_id is null or not internal.pwa_buddy_live(p_tenant_id,p_shift_id,dependent.executor_person_id,dependent.buddy_id,null) then raise exception using errcode='42501',message='BUDDY_COVERAGE_REQUIRED';end if;
  select greatest(1,min_qualified_count) into v_required from app.shift_requirements where tenant_id=p_tenant_id and shift_id=p_shift_id;
  if (select count(*) from app.bookings q join app.shift_positions pos on pos.tenant_id=q.tenant_id and pos.id=q.position_id where q.tenant_id=p_tenant_id and pos.shift_id=p_shift_id and q.state in('booked','transfer_pending','reconfirmation_required') and internal.pwa_qualified(p_tenant_id,q.executor_person_id,p_shift_id))<v_required then raise exception using errcode='42501',message='QUALIFIED_COVERAGE_REQUIRED';end if;
 end loop;
end;$$;
create function internal.pwa_buddy_coverage_trigger() returns trigger language plpgsql security definer set search_path='' as $$declare s uuid;begin
 select pos.shift_id into s from app.shift_positions pos where pos.tenant_id=new.tenant_id and pos.id=new.position_id;
 perform internal.pwa_assert_buddy_coverage(new.tenant_id,s);return null;
end;$$;
create constraint trigger pwa_buddy_coverage after insert or update on app.bookings deferrable initially deferred for each row execute function internal.pwa_buddy_coverage_trigger();
create function internal.pwa_qualification_coverage_trigger() returns trigger language plpgsql security definer set search_path='' as $$declare s record;begin
 for s in select distinct pos.shift_id from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id join app.shift_requirements r on r.tenant_id=pos.tenant_id and r.shift_id=pos.shift_id where b.tenant_id=old.tenant_id and b.executor_person_id=old.person_id and r.qualification_type_id=old.qualification_type_id and b.state in('booked','transfer_pending','reconfirmation_required') and exists(select 1 from app.pwa_buddy_links l where l.tenant_id=b.tenant_id and l.buddy_booking_id=b.id) order by pos.shift_id loop
  perform internal.pwa_assert_buddy_coverage(old.tenant_id,s.shift_id);
 end loop;return null;
end;$$;
create constraint trigger pwa_qualification_coverage after update or delete on app.person_qualifications deferrable initially deferred for each row execute function internal.pwa_qualification_coverage_trigger();

-- Patch the installed native functions, preserving the original16 session
-- guards, authority, receipt/audit history and restricted function owner.
do $native$ declare d text;x text;sig regprocedure;anchor text;begin
 sig:='internal.book_shift(uuid,uuid,uuid,uuid,uuid,bigint,uuid)'::regprocedure;d:=pg_get_functiondef(sig);x:=d;
 anchor:='  select * into v_person';
 if position(anchor in x)=0 or position('NATIVE_SESSION_COMMAND_GUARD' in x)=0 then raise exception 'NATIVE_BOOK_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,'  perform internal.pwa_shift_mutex(p_tenant_id,p_shift_id);'||chr(10)||anchor);
 anchor:='  if v_requirement.id is not null and v_requirement.minimum_age is not null then';
 if position(anchor in x)=0 then raise exception 'NATIVE_BOOK_AGE_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,$patch$  if v_person.birth_date_precision<>'day' or v_person.birth_date is null or v_person.birth_date+interval '16 years'>(v_shift.starts_at at time zone v_tenant_timezone)::date then raise exception using errcode='42501',message='MINIMUM_EXECUTION_AGE';end if;
  if not exists(select 1 from app.seasons z where z.tenant_id=p_tenant_id and z.id=v_obligation.season_id and (v_shift.starts_at at time zone v_tenant_timezone)::date>=z.starts_on and (v_shift.ends_at at time zone v_tenant_timezone)::date<=z.ends_on) then raise exception using errcode='42501',message='OBLIGATION_SEASON_MISMATCH';end if;
$patch$||anchor);
 anchor:='    raise exception using errcode = ''42501'', message = ''QUALIFICATION_EXPIRED'';';
 if position(anchor in x)=0 then raise exception 'NATIVE_BOOK_QUALIFICATION_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,'    if not internal.pwa_buddy_authorized(p_tenant_id,p_shift_id,p_position_id,p_executor_person_id,p_obligation_id,p_idempotency_key) then'||chr(10)||anchor||chr(10)||'    end if;');execute x;
 sig:='internal.cancel_booking(uuid,uuid,bigint,text,text,uuid)'::regprocedure;d:=pg_get_functiondef(sig);x:=d;
 anchor:='  select booking.* into v_booking';
 if position(anchor in x)=0 or position('NATIVE_SESSION_COMMAND_GUARD' in x)=0 then raise exception 'NATIVE_CANCEL_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,'  perform internal.pwa_shift_mutex(p_tenant_id,(select pos.shift_id from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where b.tenant_id=p_tenant_id and b.id=p_booking_id));'||chr(10)||anchor);
 anchor:='  v_late := v_now >= v_booking.cancellation_deadline_snapshot;';
 x:=replace(x,anchor,$patch$  if exists(select 1 from app.pwa_buddy_links l join app.bookings dependent on dependent.tenant_id=l.tenant_id and dependent.id=l.booking_id where l.tenant_id=p_tenant_id and l.buddy_booking_id=p_booking_id and dependent.state in('booked','transfer_pending','reconfirmation_required') and l.revision=(select max(x.revision) from app.pwa_buddy_links x where x.tenant_id=l.tenant_id and x.booking_id=l.booking_id)) then
   if p_reason_kind='regular' then raise exception using errcode='42501',message='BUDDY_REPLACEMENT_REQUIRED';end if;
   -- Sickness/emergency is always reportable. It does not free a mentor place
   -- or award execution credit: actual qualified replacement remains required.
   v_late:=v_now>=v_booking.cancellation_deadline_snapshot;v_outcome:=case p_reason_kind when 'sickness' then 'sickness_reported' else 'emergency_reported' end;
   insert into app.booking_cancellations(id,tenant_id,booking_id,reason_kind,outcome,requested_at,cancellation_deadline_snapshot,was_late,actor_auth_user_id,represented_person_id,description,idempotency_key) values(v_cancellation_id,p_tenant_id,p_booking_id,p_reason_kind,v_outcome,v_now,v_booking.cancellation_deadline_snapshot,v_late,v_actor,case when internal.is_self_person(p_tenant_id,v_booking.executor_person_id) then null else v_booking.executor_person_id end,nullif(btrim(p_description),''),p_idempotency_key);
   update app.bookings set state='transfer_pending',version=app.bookings.version+1,updated_at=v_now where tenant_id=p_tenant_id and id=p_booking_id returning app.bookings.version into v_new_version;
   insert into app.pwa_transfer_offers(tenant_id,booking_id,expires_at,reason) values(p_tenant_id,p_booking_id,greatest(v_now+interval '1 day',v_booking.starts_at_snapshot),p_reason_kind||case when nullif(btrim(p_description),'') is not null then ': '||btrim(p_description) else '' end) on conflict(tenant_id,booking_id) where state='open' do nothing;
   insert into app.booking_events(tenant_id,booking_id,event_type,actor_auth_user_id,reason_code,payload) values(p_tenant_id,p_booking_id,'booking.obstruction_reported',v_actor,p_reason_kind,jsonb_build_object('outcome',v_outcome,'replacement_required',true));
   insert into app.audit_events(tenant_id,actor_auth_user_id,action,resource_type,resource_id,scope_kind,scope_id,reason_code,idempotency_key,payload_minimal) values(p_tenant_id,v_actor,'booking.obstruction_reported','booking',p_booking_id,'household',(select assessed_household_id from app.obligations where tenant_id=p_tenant_id and id=v_booking.obligation_id),p_reason_kind,p_idempotency_key,jsonb_build_object('expected_version',p_expected_booking_version,'version',v_new_version,'replacement_required',true));
   insert into app.domain_events(id,tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload_minimal) values(v_event_id,p_tenant_id,'booking',p_booking_id,v_new_version,'pwa.report_obstruction',jsonb_build_object('booking_id',p_booking_id,'replacement_required',true));
   perform internal.pwa_notify(p_tenant_id,v_booking.executor_person_id,v_event_id,'Je verhindering is gemeld','Een bevoegde vervanger blijft nodig voor de begeleidingsplek.','/app/tasks?booking='||p_booking_id::text);
   v_result:=jsonb_build_object('resource_id',p_booking_id,'version',v_new_version,'event_ids',jsonb_build_array(v_event_id),'result',jsonb_build_object('cancellation_id',v_cancellation_id,'state','transfer_pending','outcome',v_outcome,'replacement_required',true));
   perform internal.complete_idempotency(v_claim.record_id,v_result);return query select true,p_booking_id,v_new_version,array[v_event_id],v_result->'result';return;
  end if;
$patch$||anchor);execute x;
 sig:='internal.accept_booking_transfer(uuid,uuid,bigint,uuid)'::regprocedure;d:=pg_get_functiondef(sig);x:=d;anchor:='  select * into v_request';
 if position(anchor in x)=0 or position('NATIVE_SESSION_COMMAND_GUARD' in x)=0 then raise exception 'NATIVE_TRANSFER_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,'  perform internal.pwa_shift_mutex(p_tenant_id,(select pos.shift_id from app.transfer_requests tr join app.bookings b on b.tenant_id=tr.tenant_id and b.id=tr.origin_booking_id join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where tr.tenant_id=p_tenant_id and tr.id=p_transfer_request_id));'||chr(10)||anchor);execute x;
 sig:='internal.assert_booking_eligibility(uuid,uuid,uuid,uuid,uuid)'::regprocedure;d:=pg_get_functiondef(sig);x:=d;anchor:='  if v_requirement.id is not null and v_requirement.minimum_age is not null';
 if position(anchor in x)=0 then raise exception 'NATIVE_ELIGIBILITY_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,$patch$  if v_person.birth_date_precision<>'day' or v_person.birth_date is null or v_person.birth_date+interval '16 years'>(v_shift.starts_at at time zone v_timezone)::date then raise exception using errcode='42501',message='MINIMUM_EXECUTION_AGE';end if;
  if not exists(select 1 from app.seasons z where z.tenant_id=p_tenant_id and z.id=v_obligation.season_id and (v_shift.starts_at at time zone v_timezone)::date>=z.starts_on and (v_shift.ends_at at time zone v_timezone)::date<=z.ends_on) then raise exception using errcode='42501',message='OBLIGATION_SEASON_MISMATCH';end if;
$patch$||anchor);execute x;
 sig:='internal.join_shift_waitlist(uuid,uuid,uuid,uuid,uuid)'::regprocedure;d:=pg_get_functiondef(sig);x:=d;
 anchor:='  perform internal.assert_booking_eligibility('||chr(10)||'    p_tenant_id, p_shift_id, p_person_id, p_obligation_id, null'||chr(10)||'  );';
 if position(anchor in x)=0 or position('NATIVE_SESSION_COMMAND_GUARD' in x)=0 then raise exception 'NATIVE_WAITLIST_SOURCE_MISMATCH';end if;
 x:=replace(x,anchor,'  perform internal.pwa_assert_waitlist_eligibility(p_tenant_id,p_shift_id,p_person_id,p_obligation_id,p_idempotency_key);');execute x;
end;$native$;

create or replace function internal.pwa_suitability(p_tenant_id uuid,p_position_id uuid,p_person_id uuid,p_obligation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s app.shifts%rowtype;r app.shift_requirements%rowtype;p app.persons%rowtype;o app.obligations%rowtype;z app.seasons%rowtype;why text:='ELIGIBLE';tz text;age integer;v_full boolean;buddy_needed boolean:=false;buddy_available boolean:=false;begin
 if not internal.is_active_member(p_tenant_id) or not internal.can_book_executor(p_tenant_id,p_person_id,p_obligation_id) then return jsonb_build_object('eligible',false,'executor_eligible',false,'eligible_with_buddy',false,'reason','EXECUTOR_MANDATE_REQUIRED');end if;
 select sh.* into strict s from app.shift_positions pos join app.shifts sh on sh.tenant_id=pos.tenant_id and sh.id=pos.shift_id where pos.tenant_id=p_tenant_id and pos.id=p_position_id;
 if not internal.pwa_shift_visible(p_tenant_id,s.id) then return jsonb_build_object('eligible',false,'executor_eligible',false,'eligible_with_buddy',false,'reason','BOOKING_CLOSED');end if;
 select * into strict p from app.persons where tenant_id=p_tenant_id and id=p_person_id;
 select * into strict o from app.obligations where tenant_id=p_tenant_id and id=p_obligation_id;
 select * into strict z from app.seasons where tenant_id=p_tenant_id and id=o.season_id;
 select * into r from app.shift_requirements where tenant_id=p_tenant_id and shift_id=s.id;
 select timezone into tz from app.tenants where id=p_tenant_id;
 if p.birth_date_precision='day' then age:=extract(year from age((s.starts_at at time zone tz)::date,p.birth_date))::integer;end if;
 if s.starts_at<=statement_timestamp() or s.state<>'published' then why:='BOOKING_CLOSED';
 elsif p.status<>'active' then why:='EXECUTOR_INACTIVE';
 elsif (s.starts_at at time zone tz)::date<z.starts_on or (s.ends_at at time zone tz)::date>z.ends_on or o.status not in('active','review_hold','fulfilled') then why:='OBLIGATION_SEASON_MISMATCH';
 elsif not internal.has_permission(p_tenant_id,'shift.book','household',o.assessed_household_id) then why:='BOOKING_PERMISSION_REQUIRED';
 elsif not exists(select 1 from app.executor_obligation_grants g where g.tenant_id=p_tenant_id and g.person_id=p_person_id and g.obligation_id=p_obligation_id and g.revoked_at is null and g.valid_from<=s.starts_at and (g.valid_until is null or g.valid_until>=s.ends_at)) then why:='EXECUTOR_MANDATE_EXPIRED';
 elsif age is null or age<greatest(16,coalesce(r.minimum_age,16)) then why:='MINIMUM_AGE_NOT_MET';
 elsif exists(select 1 from app.unavailability_periods u where u.tenant_id=p_tenant_id and u.person_id=p_person_id and tstzrange(u.starts_at,u.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')) then why:='EXECUTOR_UNAVAILABLE';
 elsif exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.executor_person_id=p_person_id and b.state in('booked','transfer_pending','reconfirmation_required','performed_pending') and tstzrange(coalesce(b.pending_starts_at,b.starts_at_snapshot),coalesce(b.pending_ends_at,b.ends_at_snapshot),'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')) then why:='EXECUTOR_OVERLAP';
 elsif (s.booking_opens_at is not null and s.booking_opens_at>statement_timestamp()) or (s.booking_closes_at is not null and s.booking_closes_at<=statement_timestamp()) then why:='BOOKING_WINDOW_CLOSED';end if;
 if why='ELIGIBLE' and r.qualification_type_id is not null and not internal.pwa_qualified(p_tenant_id,p_person_id,s.id) then
  buddy_needed:=r.buddy_allowed;
  buddy_available:=buddy_needed and exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and internal.pwa_buddy_live(p_tenant_id,s.id,p_person_id,b.id,b.version) and not exists(select 1 from app.pwa_transfer_offers pending_offer where pending_offer.tenant_id=b.tenant_id and pending_offer.booking_id=b.id and pending_offer.state='open')) and (select count(*) from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where b.tenant_id=p_tenant_id and pos.shift_id=s.id and b.state in('booked','transfer_pending','reconfirmation_required') and internal.pwa_qualified(p_tenant_id,b.executor_person_id,s.id))>=greatest(1,r.min_qualified_count);
  why:=case when buddy_needed then case when buddy_available then 'QUALIFIED_BUDDY_REQUIRED' else 'QUALIFIED_BUDDY_UNAVAILABLE' end else 'QUALIFICATION_REQUIRED_OR_EXPIRED' end;
 end if;
 v_full:=exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.position_id=p_position_id and b.state not in('cancelled','transferred'));
 return jsonb_build_object('eligible',why='ELIGIBLE' and not v_full,'executor_eligible',why='ELIGIBLE','eligible_with_buddy',buddy_available,'buddy_required',buddy_needed,'capacity_full',v_full,'reason',case when why='ELIGIBLE' and v_full then 'CAPACITY_FULL' else why end,'age_band',case when age is null then 'unknown' when age>=18 then 'adult' when age>=16 then '16_plus' else 'under_16' end);
end;$$;

create or replace function internal.pwa_executor_fits(p_tenant_id uuid,p_person_id uuid,p_shift_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.persons p join app.shifts s on s.tenant_id=p.tenant_id and s.id=p_shift_id join app.tenants t on t.id=p.tenant_id left join app.shift_requirements r on r.tenant_id=s.tenant_id and r.shift_id=s.id
 where p.tenant_id=p_tenant_id and p.id=p_person_id and p.status='active' and s.state='published' and s.starts_at>statement_timestamp()
 and p.birth_date_precision='day' and p.birth_date+make_interval(years=>greatest(16,coalesce(r.minimum_age,16)))<=(s.starts_at at time zone t.timezone)::date
 and (r.qualification_type_id is null or internal.pwa_qualified(p_tenant_id,p_person_id,p_shift_id) or (r.buddy_allowed and exists(select 1 from app.bookings buddy where buddy.tenant_id=p_tenant_id and internal.pwa_buddy_live(p_tenant_id,p_shift_id,p_person_id,buddy.id,buddy.version) and not exists(select 1 from app.pwa_transfer_offers pending_offer where pending_offer.tenant_id=buddy.tenant_id and pending_offer.booking_id=buddy.id and pending_offer.state='open')) and (select count(*) from app.bookings q join app.shift_positions qp on qp.tenant_id=q.tenant_id and qp.id=q.position_id where q.tenant_id=p_tenant_id and qp.shift_id=p_shift_id and q.state in('booked','transfer_pending','reconfirmation_required') and internal.pwa_qualified(p_tenant_id,q.executor_person_id,p_shift_id))>=greatest(1,r.min_qualified_count)))
 and exists(select 1 from app.executor_obligation_grants g join app.obligations o on o.tenant_id=g.tenant_id and o.id=g.obligation_id join app.seasons z on z.tenant_id=o.tenant_id and z.id=o.season_id where g.tenant_id=p_tenant_id and g.person_id=p_person_id and g.revoked_at is null and g.valid_from<=s.starts_at and (g.valid_until is null or g.valid_until>=s.ends_at) and o.status in('active','review_hold','fulfilled') and (s.starts_at at time zone t.timezone)::date>=z.starts_on and (s.ends_at at time zone t.timezone)::date<=z.ends_on)
 and not exists(select 1 from app.unavailability_periods u where u.tenant_id=p_tenant_id and u.person_id=p_person_id and tstzrange(u.starts_at,u.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)'))
 and not exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.executor_person_id=p_person_id and b.state in('booked','transfer_pending','reconfirmation_required','performed_pending') and tstzrange(coalesce(b.pending_starts_at,b.starts_at_snapshot),coalesce(b.pending_ends_at,b.ends_at_snapshot),'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')));
$$;

create or replace function internal.pwa_repeat_time(p_original timestamptz,p_weeks integer,p_timezone text) returns timestamptz language plpgsql stable set search_path='' as $$
declare local_at timestamp;r record;begin
 if p_original is null or p_weeks is null or p_weeks not between 0 and 7 then raise exception using errcode='22023',message='INVALID_INTERVAL';end if;
 -- An explicitly selected base instant is already unambiguous, including an
 -- offset-selected autumn fold. Only inferred subsequent weeks are resolved.
 if p_weeks=0 then return p_original;end if;
 local_at:=(p_original at time zone p_timezone)+make_interval(weeks=>p_weeks);
 select * into strict r from internal.resolve_local_slot(local_at::date,local_at::time,p_timezone);
 if r.dst_resolution<>'exact' then raise exception using errcode='22023',message='DST_AMBIGUOUS_OR_MISSING_TIME';end if;
 return r.scheduled_at;
end;$$;

-- Add new fixed command branches to the installed dispatcher, with guarded
-- source anchors rather than replacing an earlier shared migration.
do $commands$ declare d text;x text;a text;begin
 d:=pg_get_functiondef('internal.pwa_command(uuid,text,uuid,bigint,jsonb,uuid)'::regprocedure);x:=d;
 a:='when ''join_waitlist'' then array[''executor_person_id'',''obligation_id'']';
 if position(a in x)=0 then raise exception 'PWA_WAITLIST_FIELDS_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'when ''join_waitlist'' then array[''executor_person_id'',''obligation_id'',''buddy_booking_id'',''buddy_expected_version'']');
 a:='  select app.vacancies.version into v_version from app.vacancies where tenant_id=p_tenant_id and id=p_resource_id for update;';
 if position(a in x)=0 then raise exception 'PWA_VACANCY_LOCK_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$  select app.vacancies.version into v_version from app.vacancies where tenant_id=p_tenant_id and id=p_resource_id and state='published' and (opens_at is null or opens_at<=statement_timestamp()) and (closes_at is null or closes_at>statement_timestamp()) for update;
  if not found then raise exception using errcode='42501',message='VACANCY_NOT_AVAILABLE';end if;
$patch$);
 a:='when ''book_shift'' then array[''shift_id'',''executor_person_id'',''obligation_id'',''instruction_version_id'',''instructions_ack'',''cancellation_ack'',''member_person_id'',''buddy_booking_id'',''extra_voluntary_ack'']';
 if position(a in x)=0 then raise exception 'PWA_BOOK_FIELDS_SOURCE_MISMATCH';end if;
 x:=replace(x,a,replace(a,'''extra_voluntary_ack''','''extra_voluntary_ack'',''buddy_expected_version'''));
 a:='when ''accept_transfer'' then array[''executor_person_id'',''obligation_id'',''member_person_id'',''instruction_version_id'',''instructions_ack'',''cancellation_ack'',''extra_voluntary_ack'']';
 if position(a in x)=0 then raise exception 'PWA_TRANSFER_FIELDS_SOURCE_MISMATCH';end if;
 x:=replace(x,a,replace(a,'''extra_voluntary_ack''','''extra_voluntary_ack'',''buddy_booking_id'',''buddy_expected_version'''));
 a:='when ''create_club_task'' then array[''season_id'',''title'',''starts_at'',''ends_at'',''task_type_version_id'',''capacity'',''repeat_count'',''instructions'',''minimum_age'',''qualification_type_id'',''min_qualified_count'',''buddy_allowed'']';
 if position(a in x)=0 then raise exception 'PWA_CLUB_FIELDS_SOURCE_MISMATCH';end if;
 x:=replace(x,a,replace(a,'''buddy_allowed''','''buddy_allowed'',''distribution_mode'',''receiving_team_id'',''receiving_team_expected_version'',''self_until'',''assign_until'',''counts_for_team'''));
 a:=' when ''save_profile'' then array[';
 x:=replace(x,a,' when ''start_profile'' then array[]::text[]'||chr(10)||' when ''save_club_contact'' then array[''name'',''email'',''phone'']'||chr(10)||a);
 -- Take the shift mutex before any person, offer, position or booking row lock.
 a:=' case p_action'||chr(10)||' when ''cancel_booking'' then';
 if position(a in x)=0 then raise exception 'PWA_COMMAND_LOCK_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$ if p_action='book_shift' then perform internal.pwa_shift_mutex(p_tenant_id,(p_payload->>'shift_id')::uuid);
 elsif p_action='join_waitlist' then perform internal.pwa_shift_mutex(p_tenant_id,p_resource_id);
 elsif p_action in('cancel_booking','open_transfer','report_obstruction') then perform internal.pwa_shift_mutex(p_tenant_id,(select pos.shift_id from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where b.tenant_id=p_tenant_id and b.id=p_resource_id));
 elsif p_action='accept_transfer' then perform internal.pwa_shift_mutex(p_tenant_id,(select pos.shift_id from app.pwa_transfer_offers o join app.bookings b on b.tenant_id=o.tenant_id and b.id=o.booking_id join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id where o.tenant_id=p_tenant_id and o.id=p_resource_id));end if;
$patch$||a);
 a:='  select * into strict v_row from internal.join_shift_waitlist(p_tenant_id,p_resource_id,(p_payload->>''executor_person_id'')::uuid,(p_payload->>''obligation_id'')::uuid,v_inner_key);';
 if position(a in x)=0 then raise exception 'PWA_WAITLIST_PROOF_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'  perform internal.pwa_authorize_buddy(p_tenant_id,p_resource_id,(select id from app.shift_positions where tenant_id=p_tenant_id and shift_id=p_resource_id order by ordinal limit 1),(p_payload->>''executor_person_id'')::uuid,(p_payload->>''obligation_id'')::uuid,(p_payload->>''buddy_booking_id'')::uuid,(p_payload->>''buddy_expected_version'')::bigint,v_inner_key,''waitlist'');'||chr(10)||a);
 a:='  if p_payload->>''buddy_booking_id'' is not null then';
 if position(a in x)=0 then raise exception 'PWA_BUDDY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'  perform internal.pwa_authorize_buddy(p_tenant_id,v_s.id,p_resource_id,v_target_person,v_target_obligation,(p_payload->>''buddy_booking_id'')::uuid,(p_payload->>''buddy_expected_version'')::bigint,v_inner_key);'||chr(10)||a);
 a:='  update app.bookings set state=''transferred'',version=app.bookings.version+1 where id=v_b.id;';
 if position(a in x)=0 then raise exception 'PWA_TRANSFER_BUDDY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'  perform internal.pwa_authorize_buddy(p_tenant_id,v_s.id,v_b.position_id,v_target_person,v_target_obligation,(p_payload->>''buddy_booking_id'')::uuid,(p_payload->>''buddy_expected_version'')::bigint,v_inner_key);'||chr(10)||a);
 a:='  v_result:=jsonb_build_object(''booking_id'',v_id,''origin_booking_id'',v_b.id);';
 x:=replace(x,a,'  perform internal.pwa_assert_buddy_coverage(p_tenant_id,v_s.id);'||chr(10)||a);
 a:=' when ''save_profile'' then'||chr(10)||'  select * into strict v_profile';
 if position(a in x)=0 then raise exception 'PWA_PROFILE_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$ when 'start_profile' then
  if not internal.can_access_household(p_tenant_id,p_resource_id,'base') or not exists(select 1 from app.household_person_links l where l.tenant_id=p_tenant_id and l.household_id=p_resource_id and l.person_id=v_person and l.starts_at<=statement_timestamp() and (l.ends_at is null or l.ends_at>statement_timestamp())) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  select h.version into strict v_version from app.households h where h.tenant_id=p_tenant_id and h.id=p_resource_id and h.status<>'archived' for update;
  if v_version<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  insert into app.intake_profiles(tenant_id,person_id,household_context_id,status) values(p_tenant_id,v_person,p_resource_id,'draft') on conflict(tenant_id,person_id,household_context_id) do nothing;
  select p.id,p.version into strict v_id,v_version from app.intake_profiles p where p.tenant_id=p_tenant_id and p.person_id=v_person and p.household_context_id=p_resource_id;
  v_result:=jsonb_build_object('profile_id',v_id,'household_id',p_resource_id);
 when 'save_club_contact' then
  if p_resource_id<>p_tenant_id or not internal.has_permission(p_tenant_id,'organization.manage','tenant',p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtextextended('pwa-club-contact:'||p_tenant_id::text,0));
  select c.version into v_version from app.pwa_club_contacts c where c.tenant_id=p_tenant_id for update;
  if coalesce(v_version,0)<>p_expected_version then raise exception using errcode='40001',message='STALE_VERSION';end if;
  insert into app.pwa_club_contacts(tenant_id,name,email,phone,changed_by_auth_user_id) values(p_tenant_id,btrim(p_payload->>'name'),nullif(btrim(p_payload->>'email'),''),nullif(btrim(p_payload->>'phone'),''),v_actor) on conflict(tenant_id) do update set name=excluded.name,email=excluded.email,phone=excluded.phone,version=app.pwa_club_contacts.version+1,changed_by_auth_user_id=v_actor,updated_at=statement_timestamp() returning app.pwa_club_contacts.version into v_version;
  v_id:=p_tenant_id;
$patch$||a);
 a:='  v_capacity:=coalesce((p_payload->>''capacity'')::integer,1);v_repeat:=coalesce((p_payload->>''repeat_count'')::integer,1);';
 -- This anchor occurs in club/team commands; the action guard is intentional.
 if position(a in x)=0 then raise exception 'PWA_CLUB_DISTRIBUTION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$  if p_action='create_club_task' then
   if coalesce(p_payload->>'distribution_mode','public') not in('public','self','assign') then raise exception using errcode='22023',message='INVALID_DISTRIBUTION_MODE';end if;
   if coalesce(p_payload->>'distribution_mode','public')='public' then
    if p_payload->>'receiving_team_id' is not null or p_payload->>'receiving_team_expected_version' is not null or p_payload->>'self_until' is not null or p_payload->>'assign_until' is not null then raise exception using errcode='22023',message='PUBLIC_DISTRIBUTION_HAS_TEAM_FIELDS';end if;
   else
    v_team:=(p_payload->>'receiving_team_id')::uuid;
    select t.version into strict v_version from app.teams t where t.tenant_id=p_tenant_id and t.id=v_team and t.active for update;
    if v_version is distinct from (p_payload->>'receiving_team_expected_version')::bigint then raise exception using errcode='40001',message='STALE_VERSION';end if;
    if p_payload->>'self_until' is null or p_payload->>'assign_until' is null or (p_payload->>'self_until')::timestamptz<=statement_timestamp() or (p_payload->>'self_until')::timestamptz>(p_payload->>'assign_until')::timestamptz or (p_payload->>'assign_until')::timestamptz>=(p_payload->>'starts_at')::timestamptz then raise exception using errcode='22023',message='INVALID_DEADLINE';end if;
   end if;
  end if;
$patch$||a);
 a:='   v_created:=v_created||jsonb_build_array(jsonb_build_object(''shift_id'',v_id,''capacity'',v_capacity));';
 if position(a in x)=0 then raise exception 'PWA_CLUB_RESERVATION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$   if coalesce(p_payload->>'distribution_mode','public')<>'public' then
    insert into app.pwa_clusters(tenant_id,season_id,team_id,title,mode,self_until,assign_until) values(p_tenant_id,(p_payload->>'season_id')::uuid,v_team,p_payload->>'title',p_payload->>'distribution_mode',(p_payload->>'self_until')::timestamptz,(p_payload->>'assign_until')::timestamptz) returning id into v_scope;
    insert into app.pwa_allocations(tenant_id,cluster_id,position_id,counts_for_team) select p_tenant_id,v_scope,pos.id,coalesce((p_payload->>'counts_for_team')::boolean,true) from app.shift_positions pos where pos.tenant_id=p_tenant_id and pos.shift_id=v_id;
   end if;
   v_created:=v_created||jsonb_build_array(jsonb_build_object('shift_id',v_id,'capacity',v_capacity,'cluster_id',case when coalesce(p_payload->>'distribution_mode','public')<>'public' then v_scope end));
$patch$);
 -- Existing reservation can also be made by the owning task committee, while
 -- assignment of an actual child continues to require team_parent authority.
 a:='  if not internal.has_permission(p_tenant_id,''team_task.manage'',''team'',v_team) then raise exception using errcode=''42501'',message=''FORBIDDEN'';end if;';
 if position(a in x)=0 then raise exception 'PWA_RESERVATION_AUTHORITY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$  if p_action<>'reserve_cluster' and not internal.has_permission(p_tenant_id,'team_task.manage','team',v_team) then raise exception using errcode='42501',message='FORBIDDEN';end if;
$patch$);
 a:=' v_receipt:=jsonb_build_object(''resource_id'',v_id';
 if position(a in x)=0 then raise exception 'PWA_EXECUTOR_NOTIFICATION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$ delete from app.pwa_buddy_authorizations where tenant_id=p_tenant_id and transaction_id=txid_current() and actor_auth_user_id=v_actor and session_id=internal.current_actor_session_id() and native_idempotency_key=v_inner_key;
 if p_action in('book_shift','accept_transfer','cancel_booking','open_transfer','report_obstruction','confirm_attendance') then
  select b.executor_person_id into v_target_person from app.bookings b where b.tenant_id=p_tenant_id and b.id=case when p_action in('book_shift','accept_transfer') then v_id else p_resource_id end;
  if v_target_person is not null and v_target_person<>v_person then perform internal.pwa_notify(p_tenant_id,v_target_person,v_event,'Je dienst is bijgewerkt','Een bevoegde gebruiker heeft een wijziging voor jouw dienst vastgelegd.',coalesce(v_path,'/app/agenda'));end if;
 end if;
$patch$||a);
 if x=d then raise exception 'PWA_COMMAND_SOURCE_MISMATCH';end if;execute x;
end;$commands$;

do $readmodels$ declare d text;x text;a text;begin
 d:=pg_get_functiondef('internal.pwa_snapshot(uuid,uuid,uuid)'::regprocedure);x:=d;
 a:='''can_book'',s.starts_at>statement_timestamp(),''can_confirm''';
 if position(a in x)=0 then raise exception 'PWA_MARKET_CAPABILITY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'''can_book'',s.starts_at>statement_timestamp(),''can_manage'',internal.has_permission(p_tenant_id,''shift.manage'',''committee'',s.committee_id),''can_confirm''');
 a:='''booking_id'',o.booking_id,''expires_at''';
 if position(a in x)=0 then raise exception 'PWA_TRANSFER_POSITION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'''booking_id'',o.booking_id,''position_id'',b.position_id,''expires_at''');
 a:=$anchor$v_data:=v_data||jsonb_build_object('receiving_teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'name',t.name)) from app.teams t where t.tenant_id=p_tenant_id and t.active and internal.has_permission(p_tenant_id,'team_task.manage','team',t.id)),'[]'));$anchor$;
 if position(a in x)=0 then raise exception 'PWA_RECEIVING_TEAM_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$v_data:=v_data||jsonb_build_object('receiving_teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'name',t.name)) from app.teams t where t.tenant_id=p_tenant_id and t.active and (internal.has_permission(p_tenant_id,'team_task.manage','team',t.id) or exists(select 1 from app.committees c where c.tenant_id=p_tenant_id and internal.has_permission(p_tenant_id,'shift.manage','committee',c.id)))),'[]'));$patch$);
 a:='''receiving_teams'',coalesce((select jsonb_agg(jsonb_build_object(''id'',t.id,''version'',t.version,''name'',t.name))';
 if position(a in x)=0 then raise exception 'PWA_RECEIVING_CAPABILITY_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'''receiving_teams'',coalesce((select jsonb_agg(jsonb_build_object(''id'',t.id,''version'',t.version,''name'',t.name,''can_manage'',internal.has_permission(p_tenant_id,''team_task.manage'',''team'',t.id),''can_receive_club_tasks'',exists(select 1 from app.committees c where c.tenant_id=p_tenant_id and internal.has_permission(p_tenant_id,''shift.manage'',''committee'',c.id))))');
 a:=' return v_data;';
 if position(a in x)=0 then raise exception 'PWA_SNAPSHOT_COMPLETION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$ v_data:=v_data||jsonb_build_object('buddies',coalesce((select jsonb_agg(jsonb_build_object('booking_id',b.id,'version',b.version,'person_id',p.id,'name',concat_ws(' ',p.given_name,p.family_name),'shift_id',s.id,'qualified',true) order by s.starts_at,b.id) from app.bookings b join app.shift_positions pos on pos.tenant_id=b.tenant_id and pos.id=b.position_id join app.shifts s on s.tenant_id=pos.tenant_id and s.id=pos.shift_id join app.persons p on p.tenant_id=b.tenant_id and p.id=b.executor_person_id where b.tenant_id=p_tenant_id and internal.pwa_shift_visible(p_tenant_id,s.id) and internal.pwa_buddy_live(p_tenant_id,s.id,null,b.id,b.version) and not exists(select 1 from app.pwa_transfer_offers pending_offer where pending_offer.tenant_id=b.tenant_id and pending_offer.booking_id=b.id and pending_offer.state='open')),'[]'));
 v_data:=jsonb_set(v_data,'{context,can_start_profile}',to_jsonb(v_household is not null and exists(select 1 from app.household_person_links l where l.tenant_id=p_tenant_id and l.household_id=v_household and l.person_id=v_person and l.starts_at<=statement_timestamp() and (l.ends_at is null or l.ends_at>statement_timestamp()))));
 v_data:=v_data||jsonb_build_object('club_contact',(select jsonb_build_object('name',c.name,'email',c.email,'phone',c.phone,'version',c.version) from app.pwa_club_contacts c where c.tenant_id=p_tenant_id));
 v_data:=jsonb_set(v_data,'{context,can_manage_club_contact}',to_jsonb(internal.has_permission(p_tenant_id,'organization.manage','tenant',p_tenant_id)));
 return v_data;
$patch$);execute x;
 d:=pg_get_functiondef('internal.pwa_receiving_team_proposals(uuid,uuid,uuid[])'::regprocedure);x:=d;
 a:=' and internal.has_permission(p_tenant_id,''team_task.manage'',''team'',t.id);';
 if position(a in x)=0 then raise exception 'PWA_RECEIVING_PROPOSAL_SOURCE_MISMATCH';end if;
 x:=replace(x,a,';');execute x;
end;$readmodels$;

do $essential$ declare d text;x text;a text;begin
 d:=pg_get_functiondef('internal.pwa_notify(uuid,uuid,uuid,text,text,text)'::regprocedure);x:=d;
 a:='v_enabled boolean;';x:=replace(x,a,'v_enabled boolean;v_essential boolean;');
 a:=' insert into app.pwa_notifications(tenant_id,recipient_person_id,event_id,notification_kind,deliver_inbox,title,body,source_path)';
 if position(a in x)=0 then raise exception 'PWA_ESSENTIAL_NOTIFICATION_SOURCE_MISMATCH';end if;
 x:=replace(x,a,$patch$ select event_type=any(array['pwa.book_shift','pwa.accept_transfer','pwa.cancel_booking','pwa.report_obstruction','pwa.open_transfer','pwa.confirm_attendance','pwa.confirm_attendance_batch','pwa.buddy_replaced','pwa.reminder','pwa.prepare_handover','pwa.accept_handover','pwa.request_reserve']) into v_essential from app.domain_events where tenant_id=p_tenant_id and id=p_event_id;
 insert into app.pwa_notifications(tenant_id,recipient_person_id,event_id,notification_kind,deliver_inbox,essential,title,body,source_path)
$patch$);
 a:='coalesce(v_p.inbox,true) and v_enabled,p_title';
 if position(a in x)=0 then raise exception 'PWA_INBOX_PREFERENCE_SOURCE_MISMATCH';end if;
 x:=replace(x,a,'coalesce(v_essential,false) or (coalesce(v_p.inbox,true) and v_enabled),coalesce(v_essential,false),p_title');execute x;
end;$essential$;

do $owners$ declare r record;begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='internal' and p.proname=any(array['pwa_shift_mutex','pwa_qualified','pwa_shift_visible','pwa_buddy_live','pwa_buddy_authorized','pwa_authorize_buddy','pwa_capture_buddy','pwa_assert_buddy_coverage','pwa_buddy_coverage_trigger','pwa_qualification_coverage_trigger','pwa_assert_waitlist_eligibility','pwa_suitability']) loop
  execute format('alter function %s owner to cluvo_command_owner',r.sig);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);
 end loop;
end;$owners$;
grant create on schema api to cluvo_command_owner;
create function internal.pwa_push_binding_status(p_tenant_id uuid,p_endpoint text) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 if not internal.actor_has_active_session() or not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 if p_endpoint is null or length(p_endpoint) not between 1 and 2048 or p_endpoint!~'^https://' then raise exception using errcode='22023',message='INVALID_ENDPOINT';end if;
 return jsonb_build_object('registered',exists(select 1 from app.pwa_push_subscriptions s where s.tenant_id=p_tenant_id and s.person_id=internal.current_person_id(p_tenant_id) and s.endpoint=p_endpoint and s.revoked_at is null));
end;$$;
create function api.pwa_push_binding_status(p_tenant_id uuid,p_endpoint text) returns jsonb language sql stable security invoker set search_path='' as $$select internal.pwa_push_binding_status(p_tenant_id,p_endpoint);$$;
alter function internal.pwa_push_binding_status(uuid,text) owner to cluvo_command_owner;
alter function api.pwa_push_binding_status(uuid,text) owner to cluvo_command_owner;
revoke all on function internal.pwa_push_binding_status(uuid,text),api.pwa_push_binding_status(uuid,text) from public,anon,authenticated,service_role;
grant execute on function internal.pwa_push_binding_status(uuid,text),api.pwa_push_binding_status(uuid,text) to authenticated;
revoke create on schema api from cluvo_command_owner;
commit;
