-- Additive PWA domain; original16 migrations and canonical ledgers remain unchanged.
begin;
insert into app.help_topics(topic_id) values ('pwa.home'),('pwa.tasks'),('pwa.agenda'),('pwa.teams'),('pwa.more'),('pwa.actions'),('pwa.notifications'),('pwa.manage'),('pwa.profile'),('pwa.household'),('pwa.policies'),('pwa.courses'),('pwa.opportunities'),('pwa.messages'),('pwa.settings'),('pwa.help'),('pwa.install'),('pwa.reports'),('pwa.finance'),('pwa.committees'),('pwa.booking'),('pwa.team-allocation'),('pwa.handover'),('pwa.instructions'),('pwa.feedback') on conflict do nothing;

create table app.pwa_instruction_versions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), shift_id uuid not null, revision integer not null check(revision>0), body text not null check(length(btrim(body)) between 1 and 4000), author_auth_user_id uuid not null references auth.users(id), unique(tenant_id,shift_id,revision), foreign key(tenant_id,shift_id) references app.shifts(tenant_id,id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_instruction_versions enable row level security;
alter table app.pwa_instruction_versions force row level security;
revoke all on app.pwa_instruction_versions from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_instruction_versions to cluvo_command_owner;
create policy command_owner_read on app.pwa_instruction_versions for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_instruction_versions for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_instruction_versions for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_instruction_versions as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_clusters (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), season_id uuid not null, team_id uuid not null, title text not null check(length(btrim(title)) between 1 and 200), mode text not null check(mode in ('self','assign')), self_until timestamptz not null, assign_until timestamptz not null, state text not null default 'active' check(state in ('active','closed')), foreign key(tenant_id,season_id) references app.seasons(tenant_id,id), foreign key(tenant_id,team_id) references app.teams(tenant_id,id), check(assign_until>=self_until), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_clusters enable row level security;
alter table app.pwa_clusters force row level security;
revoke all on app.pwa_clusters from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_clusters to cluvo_command_owner;
create policy command_owner_read on app.pwa_clusters for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_clusters for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_clusters for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_clusters as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_allocations (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), cluster_id uuid not null, position_id uuid not null, member_person_id uuid, counts_for_team boolean not null default true, state text not null default 'reserved' check(state in ('reserved','assigned','booked','released')), foreign key(tenant_id,cluster_id) references app.pwa_clusters(tenant_id,id), foreign key(tenant_id,position_id) references app.shift_positions(tenant_id,id), foreign key(tenant_id,member_person_id) references app.persons(tenant_id,id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_allocations enable row level security;
alter table app.pwa_allocations force row level security;
revoke all on app.pwa_allocations from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_allocations to cluvo_command_owner;
create policy command_owner_read on app.pwa_allocations for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_allocations for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_allocations for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_allocations as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_team_goals (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), season_id uuid not null, team_id uuid not null, member_person_id uuid, goal integer not null check(goal between 0 and 100), reason text, foreign key(tenant_id,season_id) references app.seasons(tenant_id,id), foreign key(tenant_id,team_id) references app.teams(tenant_id,id), foreign key(tenant_id,member_person_id) references app.persons(tenant_id,id), check(member_person_id is null or length(btrim(reason)) between 1 and 2000), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_team_goals enable row level security;
alter table app.pwa_team_goals force row level security;
revoke all on app.pwa_team_goals from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_team_goals to cluvo_command_owner;
create policy command_owner_read on app.pwa_team_goals for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_team_goals for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_team_goals for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_team_goals as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_booking_details (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), booking_id uuid not null, instruction_version_id uuid not null, instruction_body_snapshot text not null, title_snapshot text, location_snapshot text, acknowledged_at timestamptz not null default statement_timestamp(), actor_auth_user_id uuid not null references auth.users(id), allocation_id uuid, member_person_id uuid, buddy_booking_id uuid, prepared_at timestamptz, foreign key(tenant_id,booking_id) references app.bookings(tenant_id,id), foreign key(tenant_id,instruction_version_id) references app.pwa_instruction_versions(tenant_id,id), foreign key(tenant_id,allocation_id) references app.pwa_allocations(tenant_id,id), foreign key(tenant_id,member_person_id) references app.persons(tenant_id,id), foreign key(tenant_id,buddy_booking_id) references app.bookings(tenant_id,id), unique(tenant_id,booking_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_booking_details enable row level security;
alter table app.pwa_booking_details force row level security;
revoke all on app.pwa_booking_details from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_booking_details to cluvo_command_owner;
create policy command_owner_read on app.pwa_booking_details for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_booking_details for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_booking_details for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_booking_details as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_booking_authorizations (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), transaction_id bigint not null, position_id uuid not null, actor_auth_user_id uuid not null references auth.users(id), foreign key(tenant_id,position_id) references app.shift_positions(tenant_id,id), unique(transaction_id,tenant_id,position_id,actor_auth_user_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_booking_authorizations enable row level security;
alter table app.pwa_booking_authorizations force row level security;
revoke all on app.pwa_booking_authorizations from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_booking_authorizations to cluvo_command_owner;
create policy command_owner_read on app.pwa_booking_authorizations for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_booking_authorizations for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_booking_authorizations for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_booking_authorizations as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_team_execution_entries (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), booking_id uuid not null, decision_id uuid not null, season_id uuid not null, team_id uuid not null, member_person_id uuid not null, count_delta integer not null check(count_delta between -1 and 1), foreign key(tenant_id,booking_id) references app.bookings(tenant_id,id), foreign key(tenant_id,decision_id) references app.attendance_decisions(tenant_id,id), foreign key(tenant_id,season_id) references app.seasons(tenant_id,id), foreign key(tenant_id,team_id) references app.teams(tenant_id,id), foreign key(tenant_id,member_person_id) references app.persons(tenant_id,id), unique(tenant_id,booking_id,decision_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_team_execution_entries enable row level security;
alter table app.pwa_team_execution_entries force row level security;
revoke all on app.pwa_team_execution_entries from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_team_execution_entries to cluvo_command_owner;
create policy command_owner_read on app.pwa_team_execution_entries for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_team_execution_entries for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_team_execution_entries for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_team_execution_entries as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_handovers (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), season_id uuid not null, team_id uuid not null, predecessor_person_id uuid not null, successor_person_id uuid not null, note text not null check(length(btrim(note)) between 1 and 4000), checks boolean[] not null check(array_length(checks,1)=5 and array_position(checks,null) is null), state text not null default 'ready' check(state in ('draft','ready','accepted','revoked')), accepted_at timestamptz, foreign key(tenant_id,season_id) references app.seasons(tenant_id,id), foreign key(tenant_id,team_id) references app.teams(tenant_id,id), foreign key(tenant_id,predecessor_person_id) references app.persons(tenant_id,id), foreign key(tenant_id,successor_person_id) references app.persons(tenant_id,id), check(predecessor_person_id<>successor_person_id), check(state<>'ready' or array_position(checks,false) is null), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_handovers enable row level security;
alter table app.pwa_handovers force row level security;
revoke all on app.pwa_handovers from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_handovers to cluvo_command_owner;
create policy command_owner_read on app.pwa_handovers for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_handovers for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_handovers for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_handovers as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_feedback (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), booking_id uuid not null, person_id uuid not null, repeat boolean not null, instruction_clarity boolean not null, tip text not null default '' check(length(tip)<=2000), foreign key(tenant_id,booking_id) references app.bookings(tenant_id,id), foreign key(tenant_id,person_id) references app.persons(tenant_id,id), unique(tenant_id,booking_id,person_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_feedback enable row level security;
alter table app.pwa_feedback force row level security;
revoke all on app.pwa_feedback from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_feedback to cluvo_command_owner;
create policy command_owner_read on app.pwa_feedback for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_feedback for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_feedback for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_feedback as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_questions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), household_id uuid not null, person_id uuid not null, booking_id uuid, subject text not null check(length(btrim(subject)) between 1 and 200), body text not null check(length(btrim(body)) between 1 and 2000), answer text check(length(answer)<=4000), state text not null default 'open' check(state in ('open','answered','closed')), foreign key(tenant_id,household_id) references app.households(tenant_id,id), foreign key(tenant_id,person_id) references app.persons(tenant_id,id), foreign key(tenant_id,booking_id) references app.bookings(tenant_id,id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_questions enable row level security;
alter table app.pwa_questions force row level security;
revoke all on app.pwa_questions from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_questions to cluvo_command_owner;
create policy command_owner_read on app.pwa_questions for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_questions for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_questions for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_questions as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_channels (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), scope_kind text not null check(scope_kind in ('team','committee')), scope_id uuid not null, title text not null check(length(btrim(title)) between 1 and 200), unique(tenant_id,scope_kind,scope_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_channels enable row level security;
alter table app.pwa_channels force row level security;
revoke all on app.pwa_channels from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_channels to cluvo_command_owner;
create policy command_owner_read on app.pwa_channels for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_channels for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_channels for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_channels as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_messages (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), channel_id uuid not null, person_id uuid not null, body text not null check(length(btrim(body)) between 1 and 4000), foreign key(tenant_id,channel_id) references app.pwa_channels(tenant_id,id), foreign key(tenant_id,person_id) references app.persons(tenant_id,id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_messages enable row level security;
alter table app.pwa_messages force row level security;
revoke all on app.pwa_messages from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_messages to cluvo_command_owner;
create policy command_owner_read on app.pwa_messages for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_messages for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_messages for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_messages as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_card_replies (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), card_id uuid not null, person_id uuid not null, body text not null check(length(btrim(body)) between 1 and 4000), foreign key(tenant_id,card_id) references app.kanban_cards(tenant_id,id), foreign key(tenant_id,person_id) references app.persons(tenant_id,id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_card_replies enable row level security;
alter table app.pwa_card_replies force row level security;
revoke all on app.pwa_card_replies from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_card_replies to cluvo_command_owner;
create policy command_owner_read on app.pwa_card_replies for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_card_replies for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_card_replies for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_card_replies as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_preferences (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), person_id uuid not null, email boolean not null default true, reminders boolean not null default true, team boolean not null default true, news boolean not null default true, push boolean not null default false, inbox boolean not null default true, foreign key(tenant_id,person_id) references app.persons(tenant_id,id), unique(tenant_id,person_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_preferences enable row level security;
alter table app.pwa_preferences force row level security;
revoke all on app.pwa_preferences from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_preferences to cluvo_command_owner;
create policy command_owner_read on app.pwa_preferences for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_preferences for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_preferences for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_preferences as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_help_preferences (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), person_id uuid not null, topic text not null references app.help_topics(topic_id) check(topic ~ '^[a-z][a-z0-9_.-]{1,178}$'), explanation_version integer not null check(explanation_version>0), seen_at timestamptz not null default statement_timestamp(), foreign key(tenant_id,person_id) references app.persons(tenant_id,id), unique(tenant_id,person_id,topic,explanation_version), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_help_preferences enable row level security;
alter table app.pwa_help_preferences force row level security;
revoke all on app.pwa_help_preferences from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_help_preferences to cluvo_command_owner;
create policy command_owner_read on app.pwa_help_preferences for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_help_preferences for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_help_preferences for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_help_preferences as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_transfer_offers (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), booking_id uuid not null, expires_at timestamptz not null, reason text not null check(length(btrim(reason)) between 1 and 2000), state text not null default 'open' check(state in ('open','accepted','revoked','expired')), replacement_booking_id uuid, foreign key(tenant_id,booking_id) references app.bookings(tenant_id,id), foreign key(tenant_id,replacement_booking_id) references app.bookings(tenant_id,id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_transfer_offers enable row level security;
alter table app.pwa_transfer_offers force row level security;
revoke all on app.pwa_transfer_offers from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_transfer_offers to cluvo_command_owner;
create policy command_owner_read on app.pwa_transfer_offers for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_transfer_offers for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_transfer_offers for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_transfer_offers as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_notifications (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), recipient_person_id uuid not null, notification_kind text not null default 'general' check(notification_kind in ('general','team','reminder','news')),deliver_inbox boolean not null default true, title text not null, body text not null, source_path text not null, read_at timestamptz, event_id uuid not null, foreign key(tenant_id,recipient_person_id) references app.persons(tenant_id,id), foreign key(tenant_id,event_id) references app.domain_events(tenant_id,id), unique(tenant_id,recipient_person_id,event_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_notifications enable row level security;
alter table app.pwa_notifications force row level security;
revoke all on app.pwa_notifications from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_notifications to cluvo_command_owner;
create policy command_owner_read on app.pwa_notifications for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_notifications for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_notifications for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_notifications as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_delivery_outbox (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), recipient_person_id uuid not null, notification_id uuid not null, channel text not null check(channel in ('email','push')), state text not null default 'pending' check(state in ('pending','sent','failed','cancelled')), attempts integer not null default 0 check(attempts>=0), foreign key(tenant_id,recipient_person_id) references app.persons(tenant_id,id), foreign key(tenant_id,notification_id) references app.pwa_notifications(tenant_id,id), unique(tenant_id,notification_id,channel), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_delivery_outbox enable row level security;
alter table app.pwa_delivery_outbox force row level security;
revoke all on app.pwa_delivery_outbox from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_delivery_outbox to cluvo_command_owner;
create policy command_owner_read on app.pwa_delivery_outbox for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_delivery_outbox for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_delivery_outbox for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_delivery_outbox as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_reserve_requests (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), allocation_id uuid not null, recipient_person_id uuid not null, state text not null default 'requested' check(state in ('requested','accepted','declined','expired')), foreign key(tenant_id,allocation_id) references app.pwa_allocations(tenant_id,id), foreign key(tenant_id,recipient_person_id) references app.persons(tenant_id,id), unique(tenant_id,allocation_id,recipient_person_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_reserve_requests enable row level security;
alter table app.pwa_reserve_requests force row level security;
revoke all on app.pwa_reserve_requests from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_reserve_requests to cluvo_command_owner;
create policy command_owner_read on app.pwa_reserve_requests for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_reserve_requests for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_reserve_requests for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_reserve_requests as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_push_subscriptions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), person_id uuid not null, endpoint text not null check(length(endpoint) between 8 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'), p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{80,100}$'), auth_secret text not null check(auth_secret ~ '^[A-Za-z0-9_-]{20,30}$'), revoked_at timestamptz, foreign key(tenant_id,person_id) references app.persons(tenant_id,id), unique(tenant_id,person_id,endpoint), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_push_subscriptions enable row level security;
alter table app.pwa_push_subscriptions force row level security;
revoke all on app.pwa_push_subscriptions from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_push_subscriptions to cluvo_command_owner;
create policy command_owner_read on app.pwa_push_subscriptions for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_push_subscriptions for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_push_subscriptions for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_push_subscriptions as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_team_task_sources (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), team_task_id uuid not null, season_id uuid not null, request_id uuid, shift_id uuid, capacity integer not null check(capacity between 1 and 30), instructions text not null check(length(btrim(instructions)) between 1 and 4000), counts_for_team boolean not null, foreign key(tenant_id,team_task_id) references app.team_tasks(tenant_id,id), foreign key(tenant_id,season_id) references app.seasons(tenant_id,id), foreign key(tenant_id,request_id) references app.team_task_market_requests(tenant_id,id), foreign key(tenant_id,shift_id) references app.shifts(tenant_id,id), unique(tenant_id,team_task_id), unique(tenant_id,request_id), unique(tenant_id,shift_id), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_team_task_sources enable row level security;
alter table app.pwa_team_task_sources force row level security;
revoke all on app.pwa_team_task_sources from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_team_task_sources to cluvo_command_owner;
create policy command_owner_read on app.pwa_team_task_sources for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_team_task_sources for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_team_task_sources for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_team_task_sources as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create table app.pwa_feedback_revisions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references app.tenants(id), feedback_id uuid not null, revision bigint not null check(revision>0), repeat boolean not null, instruction_clarity boolean not null, tip text not null check(length(tip)<=2000), actor_auth_user_id uuid not null references auth.users(id), foreign key(tenant_id,feedback_id) references app.pwa_feedback(tenant_id,id), unique(tenant_id,feedback_id,revision), version bigint not null default 1 check(version>0), created_at timestamptz not null default statement_timestamp(), unique(tenant_id,id));
alter table app.pwa_feedback_revisions enable row level security;
alter table app.pwa_feedback_revisions force row level security;
revoke all on app.pwa_feedback_revisions from public,anon,authenticated,service_role;
grant select,insert,update on app.pwa_feedback_revisions to cluvo_command_owner;
create policy command_owner_read on app.pwa_feedback_revisions for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_feedback_revisions for insert to cluvo_command_owner with check(true);
create policy command_owner_update on app.pwa_feedback_revisions for update to cluvo_command_owner using(true) with check(true);
create policy native_session_required on app.pwa_feedback_revisions as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));

create unique index pwa_allocations_active_position_uq on app.pwa_allocations(tenant_id,position_id) where state<>'released';
create unique index pwa_team_goals_scope_uq on app.pwa_team_goals(tenant_id,season_id,team_id,member_person_id) nulls not distinct;
create unique index pwa_handovers_ready_team_uq on app.pwa_handovers(tenant_id,team_id) where state='ready';
create unique index pwa_transfer_open_uq on app.pwa_transfer_offers(tenant_id,booking_id) where state='open';
grant delete on app.pwa_booking_authorizations,app.pwa_help_preferences to cluvo_command_owner;
create policy command_owner_delete on app.pwa_booking_authorizations for delete to cluvo_command_owner using(true);
create policy command_owner_delete on app.pwa_help_preferences for delete to cluvo_command_owner using(true);
-- Minimal additional writer capabilities on already-existing command relations.
grant insert,update on app.course_enrollments,app.event_attendees,app.kanban_cards,app.card_checklist_items,app.access_grants,app.team_person_memberships,app.team_tasks,app.team_task_market_requests to cluvo_command_owner;
grant insert on app.kanban_card_history to cluvo_command_owner;
-- All these relations already have command-owner policies. Do not grant human direct mutation.

create function internal.pwa_can_team(p_tenant_id uuid,p_team_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.is_active_member(p_tenant_id) and internal.can_person_view_team(p_tenant_id,internal.current_person_id(p_tenant_id),p_team_id);
$$;
create function internal.pwa_can_channel(p_tenant_id uuid,p_channel_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.is_active_member(p_tenant_id) and exists(select 1 from app.pwa_channels c where c.tenant_id=p_tenant_id and c.id=p_channel_id and ((c.scope_kind='team' and internal.pwa_can_team(p_tenant_id,c.scope_id)) or (c.scope_kind='committee' and internal.has_permission(p_tenant_id,'committee.workspace.view','committee',c.scope_id))));
$$;
create function internal.pwa_owns_booking(p_tenant_id uuid,p_booking_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.is_active_member(p_tenant_id) and exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.id=p_booking_id and (internal.is_self_person(p_tenant_id,b.executor_person_id) or internal.can_book_executor(p_tenant_id,b.executor_person_id,b.obligation_id)));
$$;
create function internal.pwa_position_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Terminal outcomes never reopen a historical concrete place.
 if exists(select 1 from app.bookings b where b.tenant_id=new.tenant_id and b.position_id=new.position_id and b.id<>new.id and b.state in ('confirmed','no_show')) then
  raise exception using errcode='P0001',message='CAPACITY_FULL';
 end if;
 if exists(select 1 from app.pwa_allocations a where a.tenant_id=new.tenant_id and a.position_id=new.position_id and a.state<>'released') and not exists(select 1 from app.pwa_booking_authorizations a where a.transaction_id=txid_current() and a.tenant_id=new.tenant_id and a.position_id=new.position_id and a.actor_auth_user_id=internal.current_actor_uid()) then
  raise exception using errcode='42501',message='TEAM_POSITION_RESERVED';
 end if;
 return new;
end; $$;
create trigger pwa_position_guard before insert on app.bookings for each row execute function internal.pwa_position_guard();

create function internal.pwa_team_execution() returns trigger language plpgsql security definer set search_path='' as $$
declare v_detail app.pwa_booking_details%rowtype;v_allocation app.pwa_allocations%rowtype;v_cluster app.pwa_clusters%rowtype;v_previous integer;v_desired integer;
begin
 select * into v_detail from app.pwa_booking_details where tenant_id=new.tenant_id and booking_id=new.booking_id;
 if v_detail.allocation_id is null or v_detail.member_person_id is null then return new; end if;
 select * into strict v_allocation from app.pwa_allocations where tenant_id=new.tenant_id and id=v_detail.allocation_id;
 if not v_allocation.counts_for_team then return new; end if;
 select * into strict v_cluster from app.pwa_clusters where tenant_id=new.tenant_id and id=v_allocation.cluster_id;
 select coalesce(sum(count_delta),0) into v_previous from app.pwa_team_execution_entries where tenant_id=new.tenant_id and booking_id=new.booking_id;
 v_desired:=case when new.result in ('present','partial') then 1 else 0 end;
 insert into app.pwa_team_execution_entries(tenant_id,booking_id,decision_id,season_id,team_id,member_person_id,count_delta)
 values(new.tenant_id,new.booking_id,new.id,v_cluster.season_id,v_cluster.team_id,v_detail.member_person_id,v_desired-v_previous);
 return new;
end; $$;
create trigger pwa_team_execution after insert on app.attendance_decisions for each row execute function internal.pwa_team_execution();
create trigger pwa_team_entries_immutable before update or delete on app.pwa_team_execution_entries for each row execute function internal.reject_immutable_change();
create trigger pwa_instructions_immutable before update or delete on app.pwa_instruction_versions for each row execute function internal.reject_immutable_change();

-- Retain the exact market result shape, excluding reserved and terminal places.
create or replace function internal.list_shift_market(p_tenant_id uuid)
returns table(tenant_id uuid,shift_id uuid,shift_version bigint,position_id uuid,position_ordinal integer,title text,starts_at timestamptz,ends_at timestamptz,credit_minutes integer,location_name text,available boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not internal.is_active_member(p_tenant_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 return query select s.tenant_id,s.id,s.version,p.id,p.ordinal,s.title,s.starts_at,s.ends_at,s.credit_minutes,l.name,
 p.state='open' and (s.booking_opens_at is null or s.booking_opens_at<=statement_timestamp()) and (s.booking_closes_at is null or s.booking_closes_at>statement_timestamp())
 and not exists(select 1 from app.bookings b where b.tenant_id=p.tenant_id and b.position_id=p.id and b.state in ('booked','reconfirmation_required','transfer_pending','performed_pending','confirmed','no_show'))
 from app.shifts s join app.shift_positions p on p.tenant_id=s.tenant_id and p.shift_id=s.id left join app.locations l on l.tenant_id=s.tenant_id and l.id=s.location_id
 where s.tenant_id=p_tenant_id and s.state='published' and s.starts_at>statement_timestamp()
 and not exists(select 1 from app.pwa_allocations a where a.tenant_id=p.tenant_id and a.position_id=p.id and a.state<>'released')
 order by s.starts_at,s.id,p.ordinal;
end; $$;

-- Eligibility is evaluated inside the database. Candidate readmodels expose a
-- name and a suitability flag, never the private intake/availability behind it.
create function internal.pwa_executor_fits(p_tenant_id uuid,p_person_id uuid,p_shift_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.persons p join app.shifts s on s.tenant_id=p.tenant_id and s.id=p_shift_id join app.tenants t on t.id=p.tenant_id left join app.shift_requirements r on r.tenant_id=s.tenant_id and r.shift_id=s.id
 where p.tenant_id=p_tenant_id and p.id=p_person_id and p.status='active'
 and (r.minimum_age is null or (p.birth_date_precision='day' and p.birth_date+make_interval(years=>r.minimum_age)<=(s.starts_at at time zone t.timezone)::date))
 and (r.qualification_type_id is null or exists(select 1 from app.person_qualifications q where q.tenant_id=p_tenant_id and q.person_id=p_person_id and q.qualification_type_id=r.qualification_type_id and q.revoked_at is null and q.achieved_at<=s.starts_at and (q.expires_at is null or q.expires_at>=s.ends_at)))
 and exists(select 1 from app.executor_obligation_grants g join app.obligations o on o.tenant_id=g.tenant_id and o.id=g.obligation_id where g.tenant_id=p_tenant_id and g.person_id=p_person_id and g.revoked_at is null and g.valid_from<=s.starts_at and (g.valid_until is null or g.valid_until>=s.ends_at) and o.status in ('active','review_hold','fulfilled'))
 and not exists(select 1 from app.unavailability_periods u where u.tenant_id=p_tenant_id and u.person_id=p_person_id and tstzrange(u.starts_at,u.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)'))
 and not exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.executor_person_id=p_person_id and b.state in ('booked','transfer_pending','reconfirmation_required','performed_pending') and tstzrange(coalesce(b.pending_starts_at,b.starts_at_snapshot),coalesce(b.pending_ends_at,b.ends_at_snapshot),'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')));
$$;
create function internal.pwa_distribution(p_tenant_id uuid,p_team_id uuid,p_season_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a record;m uuid;counts jsonb:='{}';proposal jsonb:='[]';begin
 if not internal.is_active_member(p_tenant_id) or not internal.has_permission(p_tenant_id,'team_task.manage','team',p_team_id) then raise exception using errcode='42501',message='FORBIDDEN';end if;
 for a in select al.id,al.version,s.id shift_id,s.starts_at,s.ends_at from app.pwa_allocations al join app.pwa_clusters c on c.tenant_id=al.tenant_id and c.id=al.cluster_id join app.shift_positions pos on pos.tenant_id=al.tenant_id and pos.id=al.position_id join app.shifts s on s.tenant_id=pos.tenant_id and s.id=pos.shift_id where al.tenant_id=p_tenant_id and c.team_id=p_team_id and c.season_id=p_season_id and c.state='active' and al.state='reserved' and al.member_person_id is null and s.starts_at>statement_timestamp() order by s.starts_at,al.id loop
  select tm.person_id into m from app.team_person_memberships tm where tm.tenant_id=p_tenant_id and tm.team_id=p_team_id and tm.membership_kind='player' and tm.starts_at<=statement_timestamp() and (tm.ends_at is null or tm.ends_at>statement_timestamp())
  and exists(select 1 from app.household_person_links child join app.household_obligation_links ho on ho.tenant_id=child.tenant_id and ho.household_id=child.household_id and ho.starts_at<=statement_timestamp() and (ho.ends_at is null or ho.ends_at>statement_timestamp()) join app.executor_obligation_grants eg on eg.tenant_id=ho.tenant_id and eg.obligation_id=ho.obligation_id where child.tenant_id=p_tenant_id and child.person_id=tm.person_id and child.starts_at<=statement_timestamp() and (child.ends_at is null or child.ends_at>statement_timestamp()) and eg.revoked_at is null and internal.pwa_executor_fits(p_tenant_id,eg.person_id,a.shift_id))
  and not exists(select 1 from app.matches mt where mt.tenant_id=p_tenant_id and mt.team_id=p_team_id and mt.status='scheduled' and mt.starts_at>=a.starts_at and mt.starts_at<a.ends_at)
  order by coalesce((select sum(e.count_delta) from app.pwa_team_execution_entries e where e.tenant_id=p_tenant_id and e.team_id=p_team_id and e.season_id=p_season_id and e.member_person_id=tm.person_id),0)+(select count(*) from app.pwa_allocations x join app.pwa_clusters c on c.tenant_id=x.tenant_id and c.id=x.cluster_id where x.tenant_id=p_tenant_id and c.team_id=p_team_id and c.season_id=p_season_id and x.member_person_id=tm.person_id and x.state in('assigned','booked'))+coalesce((counts->>tm.person_id::text)::integer,0),tm.person_id limit 1;
  if m is not null then proposal:=proposal||jsonb_build_array(jsonb_build_object('allocation_id',a.id,'expected_version',a.version,'member_person_id',m,'reason','Laagste bevestigde en geplande teaminzet bij een passende uitvoerder'));counts:=jsonb_set(counts,array[m::text],to_jsonb(coalesce((counts->>m::text)::integer,0)+1));end if;
 end loop;
 return jsonb_build_object('team_id',p_team_id,'assignments',proposal);
end;$$;

alter table app.pwa_questions drop constraint pwa_questions_state_check;
alter table app.pwa_questions add check(state in ('open','in_progress','answered','closed'));
create table app.pwa_question_history(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references app.tenants(id),question_id uuid not null,question_version bigint not null,answer text check(length(answer)<=4000),state text not null check(state in ('open','in_progress','answered','closed')),actor_auth_user_id uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),unique(tenant_id,id),unique(tenant_id,question_id,question_version),foreign key(tenant_id,question_id) references app.pwa_questions(tenant_id,id));
alter table app.pwa_question_history enable row level security;
alter table app.pwa_question_history force row level security;
revoke all on app.pwa_question_history from public,anon,authenticated,service_role;
grant select,insert on app.pwa_question_history to cluvo_command_owner;
create policy command_owner_read on app.pwa_question_history for select to cluvo_command_owner using(true);
create policy command_owner_insert on app.pwa_question_history for insert to cluvo_command_owner with check(true);
create policy native_session_required on app.pwa_question_history as restrictive for all to authenticated using((select internal.actor_has_active_session())) with check((select internal.actor_has_active_session()));
create trigger pwa_question_history_immutable before update or delete on app.pwa_question_history for each row execute function internal.reject_immutable_change();
alter table app.kanban_card_assignees add column revoked_at timestamptz,add column version bigint not null default 1 check(version>0);
-- Native authorization must stop treating a revoked assignment as authority.
do $assignee_auth$ declare sig regprocedure;definition text;patched text;begin
 foreach sig in array array['internal.can_person_view_card(uuid,uuid,uuid)'::regprocedure,'internal.complete_kanban_card(uuid,uuid,bigint,uuid)'::regprocedure] loop
  definition:=pg_get_functiondef(sig);
  patched:=replace(definition,'and assignee.person_id =','and assignee.revoked_at is null and assignee.person_id =');
  if patched=definition then raise exception 'ASSIGNEE_AUTHORITY_SOURCE_MISMATCH';end if;
  execute patched;
 end loop;
end;$assignee_auth$;
create function internal.pwa_repeat_time(p_original timestamptz,p_weeks integer,p_timezone text) returns timestamptz language plpgsql stable set search_path='' as $$
declare local_at timestamp:=(p_original at time zone p_timezone)+make_interval(weeks=>p_weeks);r record;begin
 select * into strict r from internal.resolve_local_slot(local_at::date,local_at::time,p_timezone);
 if r.dst_resolution<>'exact' then raise exception using errcode='22023',message='DST_AMBIGUOUS_OR_MISSING_TIME';end if;
 return r.scheduled_at;
end;$$;
create function internal.pwa_can_edit_card(p_tenant_id uuid,p_card_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select internal.is_active_member(p_tenant_id) and exists(select 1 from app.kanban_cards c join app.kanban_boards b on b.tenant_id=c.tenant_id and b.id=c.board_id where c.tenant_id=p_tenant_id and c.id=p_card_id and (internal.has_permission(p_tenant_id,'committee.workspace.manage','committee',b.committee_id) or c.accountable_person_id=internal.current_person_id(p_tenant_id) or exists(select 1 from app.kanban_card_assignees a where a.tenant_id=c.tenant_id and a.card_id=c.id and a.person_id=internal.current_person_id(p_tenant_id) and a.revoked_at is null)));
$$;

create function internal.pwa_suitability(p_tenant_id uuid,p_position_id uuid,p_person_id uuid,p_obligation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s app.shifts%rowtype;r app.shift_requirements%rowtype;p app.persons%rowtype;o app.obligations%rowtype;z app.seasons%rowtype;why text:='ELIGIBLE';tz text;age integer;v_full boolean;begin
 if not internal.is_active_member(p_tenant_id) or not internal.can_book_executor(p_tenant_id,p_person_id,p_obligation_id) then return jsonb_build_object('eligible',false,'reason','EXECUTOR_MANDATE_REQUIRED');end if;
 select sh.* into strict s from app.shift_positions pos join app.shifts sh on sh.tenant_id=pos.tenant_id and sh.id=pos.shift_id where pos.tenant_id=p_tenant_id and pos.id=p_position_id;
 select * into strict p from app.persons where tenant_id=p_tenant_id and id=p_person_id;
 select * into strict o from app.obligations where tenant_id=p_tenant_id and id=p_obligation_id;
 select * into strict z from app.seasons where tenant_id=p_tenant_id and id=o.season_id;
 select * into r from app.shift_requirements where tenant_id=p_tenant_id and shift_id=s.id;
 select timezone into tz from app.tenants where id=p_tenant_id;
 if p.birth_date_precision='day' then age:=extract(year from age((s.starts_at at time zone tz)::date,p.birth_date))::integer;end if;
 if s.starts_at<=statement_timestamp() or s.state<>'published' then why:='BOOKING_CLOSED';
 elsif (s.starts_at at time zone tz)::date<z.starts_on or (s.ends_at at time zone tz)::date>z.ends_on or o.status not in('active','review_hold','fulfilled') then why:='OBLIGATION_SEASON_MISMATCH';
 elsif not internal.has_permission(p_tenant_id,'shift.book','household',o.assessed_household_id) then why:='BOOKING_PERMISSION_REQUIRED';
 elsif not exists(select 1 from app.executor_obligation_grants g where g.tenant_id=p_tenant_id and g.person_id=p_person_id and g.obligation_id=p_obligation_id and g.revoked_at is null and g.valid_from<=s.starts_at and (g.valid_until is null or g.valid_until>=s.ends_at)) then why:='EXECUTOR_MANDATE_EXPIRED';
 elsif age is null or age<greatest(16,coalesce(r.minimum_age,16)) then why:='MINIMUM_AGE_NOT_MET';

 elsif r.qualification_type_id is not null and not exists(select 1 from app.person_qualifications q where q.tenant_id=p_tenant_id and q.person_id=p_person_id and q.qualification_type_id=r.qualification_type_id and q.revoked_at is null and q.achieved_at<=s.starts_at and (q.expires_at is null or q.expires_at>=s.ends_at)) then why:=case when r.buddy_allowed then 'QUALIFIED_BUDDY_REQUIRED' else 'QUALIFICATION_REQUIRED_OR_EXPIRED' end;
 elsif exists(select 1 from app.unavailability_periods u where u.tenant_id=p_tenant_id and u.person_id=p_person_id and tstzrange(u.starts_at,u.ends_at,'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')) then why:='EXECUTOR_UNAVAILABLE';
 elsif exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.executor_person_id=p_person_id and b.state in('booked','transfer_pending','reconfirmation_required','performed_pending') and tstzrange(coalesce(b.pending_starts_at,b.starts_at_snapshot),coalesce(b.pending_ends_at,b.ends_at_snapshot),'[)')&&tstzrange(s.starts_at,s.ends_at,'[)')) then why:='EXECUTOR_OVERLAP';
 elsif (s.booking_opens_at is not null and s.booking_opens_at>statement_timestamp()) or (s.booking_closes_at is not null and s.booking_closes_at<=statement_timestamp()) then why:='BOOKING_WINDOW_CLOSED';end if;
 v_full:=exists(select 1 from app.bookings b where b.tenant_id=p_tenant_id and b.position_id=p_position_id and b.state not in('cancelled','transferred'));
 return jsonb_build_object('eligible',why='ELIGIBLE' and not v_full,'executor_eligible',why='ELIGIBLE','eligible_with_buddy',why='QUALIFIED_BUDDY_REQUIRED','capacity_full',v_full,'reason',case when why='ELIGIBLE' and v_full then 'CAPACITY_FULL' else why end,'age_band',case when age is null then 'unknown' when age>=18 then 'adult' when age>=16 then '16_plus' else 'under_16' end);
end;$$;

do $owners$ declare r record;begin
 for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='internal' and p.proname like 'pwa_%' loop
  execute format('alter function %s owner to cluvo_command_owner',r.sig);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);
 end loop;
end;$owners$;
create trigger pwa_feedback_revisions_immutable before update or delete on app.pwa_feedback_revisions for each row execute function internal.reject_immutable_change();
commit;
