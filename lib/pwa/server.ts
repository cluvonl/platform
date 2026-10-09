import 'server-only';

import {cache} from 'react';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import type {HouseholdDossier} from '@/lib/data/household';
import type {MobileSnapshot,MobileTask,MobileProgress,MobileCalendarEvent} from '@/components/mobile/types';
import {MOBILE_SCREENS} from '@/components/mobile/types';
import {actionContextParentPath,mobileActionPath,normalizeMobilePath} from './links.mjs';
import {loadScopedMatchDetails} from './match-details.mjs';
import {loadCommitteePlanning} from './planning.mjs';
import {loadScopedActionDetails,scopedCardActionDetail} from './action-details.mjs';
import {mobilePayloadSchemas} from './validation';
import {mobilePushPublicKey} from './push-config';

type Row=Record<string,unknown>;
const records=(value:unknown): Row[] => z.array(z.record(z.unknown())).parse(value??[]);
const object=(value:unknown): Row => z.record(z.unknown()).parse(value??{});
const string=(value:unknown,fallback=''): string => typeof value==='string'?value:fallback;
const integer=(value:unknown,fallback=0): number => typeof value==='number'&&Number.isSafeInteger(value)?value:fallback;
const yes=(value:unknown): boolean => value===true;
const strings=(value:unknown): string[] => Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'):[];
const resource=(row:Row) => ({id:string(row.id),version:integer(row.version)});
const actionKindLabels: Record<string,string> = {card_assignment:'Werkafspraak',subtask_assignment:'Subtaak',mention:'Vermelding',team_task:'Teamafspraak',policy_follow_up:'Vraag over beleid',choose_executor:'Uitvoerder kiezen',prepare_booking:'Taak voorbereiden',accept_handover:'Overdracht aannemen',find_replacement:'Vervanging regelen'};
const progress=(row:Row): MobileProgress => ({confirmed:integer(row.confirmed_minutes),planned:integer(row.planned_minutes),pending:integer(row.pending_minutes),target:integer(row.effective_target_minutes),winterTarget:integer(row.effective_winter_minutes),winterConfirmed:integer(row.confirmed_before_winter_minutes),remaining:integer(row.remaining_minutes),exempt:yes(row.structurally_covered)});
const allowedSelection=(value:string|undefined) => value===undefined?null:z.string().uuid().parse(value);
// React cache is request-scoped. Never cache an authenticated snapshot across
// users, tenants or sessions, and never use an admin key for these projections.
const load=cache(async (club:string,householdId:string|null,seasonId:string|null): Promise<MobileSnapshot> => {
  const {client,workspace}=await requireWorkspace(club,'/app/login');
  const [snapshotResult,intakeResult,policyResult,workspacesResult,pendingResult,marketResult]=await Promise.all([
    client.schema('api').rpc('pwa_snapshot',{p_tenant_id:workspace.tenant_id,p_household_id:householdId,p_season_id:seasonId}),
    client.schema('api').from('my_intake').select('profile_id,person_id,household_context_id,version,desired_minutes,answers').eq('tenant_id',workspace.tenant_id).eq('person_id',workspace.person_id),
    client.schema('api').from('pwa_policy_assignments').select('id,member_person_id,state,version,policy_version_id,policy_revision,policy_document_id,policy_document_title,exact_body,published_at,effective_at,offered_at,is_actor_subject,can_accept').eq('tenant_id',workspace.tenant_id),
    client.schema('api').from('my_workspaces').select('tenant_slug,tenant_name'),
    client.schema('api').rpc('pwa_pending_commands',{p_tenant_id:workspace.tenant_id}),
    client.schema('api').rpc('list_shift_market',{p_tenant_id:workspace.tenant_id}),
  ]);
  if (snapshotResult.error||intakeResult.error||policyResult.error||workspacesResult.error||pendingResult.error||marketResult.error||!snapshotResult.data) throw new Error('Het mobiele overzicht kan nu niet veilig worden geladen. Probeer het opnieuw.');
  const raw=object(snapshotResult.data),context=object(raw.context),base=`/app/c/${encodeURIComponent(workspace.tenant_slug)}`;
  if (context.tenant_id!==workspace.tenant_id||context.person_id!==workspace.person_id) throw new Error('Het mobiele overzicht hoort niet bij deze persoonlijke toegang.');
  const [matchDetails,actionDetails]=await Promise.all([
    loadScopedMatchDetails(client,workspace.tenant_id,records(raw.matches)),
    loadScopedActionDetails(client,workspace.tenant_id,records(raw.actions)),
  ]);
  const matches=records(matchDetails);
  const rawCapabilities=object(context.capabilities);
  const households=records(context.households),seasons=records(context.seasons);
  const selectedSeason=seasons.find((row)=>row.id===context.season_id);
  const committeePlanning=await loadCommitteePlanning(client,workspace.tenant_id,selectedSeason?string(selectedSeason.id):null);
  const dossier=records(raw.household)[0] as HouseholdDossier|undefined;
  const balances=dossier?.balances??[];
  const balance=balances.length===1?balances[0]:null;
  const people=records(dossier?.people).map((row)=>({...row,...records(raw.people_metadata).find((metadata)=>metadata.person_id===row.person_id)})),executors=records(raw.executors).map((row)=>({...row,...records(raw.people_metadata).find((metadata)=>metadata.person_id===row.person_id)})),rawBookings=records(raw.bookings),allocations=records(raw.allocations),rawTeams=records(raw.teams),goals=records(raw.goals),teamProgress=records(raw.team_progress);
  const capabilities=Object.fromEntries(MOBILE_SCREENS.map((screen)=>[screen,{available:!['manage','reports','finance','committees'].includes(screen)||yes(rawCapabilities[screen==='committees'?'committee':screen]),reason:'Deze functie vraagt een actuele, specifieke bevoegdheid binnen je vereniging.'}])) as MobileSnapshot['capabilities'];
  // Use the existing native market projection for actual place numbers. The
  // snapshot provides reserved numbers; never infer a number from row order.
  const ordinals=new Map<string,number>();
  for (const place of records(marketResult.data)) {
    const ordinal=integer(place.position_ordinal);
    if (ordinal>0) ordinals.set(string(place.position_id),ordinal);
  }
  for (const allocation of allocations) {
    const ordinal=integer(allocation.ordinal);
    if (ordinal>0) ordinals.set(string(allocation.position_id),ordinal);
  }
  const market=records(raw.market),groups=new Map<string,Row[]>();
  for (const row of market) {
    const key=string(row.shift_id);if (!key) throw new Error('De taakplaatsen zijn niet volledig geladen.');
    groups.set(key,[...(groups.get(key)??[]),row]);
  }
  const tasks:MobileTask[]=[...groups].map(([id,rows])=>{
    const row=rows[0],publicPlaces=rows.filter((place)=>!place.allocation_id),available=publicPlaces.filter((place)=>yes(place.available));
    const chosen=available[0]??publicPlaces[0]??row;
    return {id,version:integer(row.version),title:string(row.title),category:string(row.category_name),kind:yes(row.is_team_task)?'team':'club',startsAt:string(row.starts_at),endsAt:string(row.ends_at),location:string(row.location_name),minutes:integer(row.credit_minutes),capacity:rows.length,freePlaces:available.length,instructions:string(row.instructions),minAge:integer(row.minimum_age),qualification:string(row.qualification_name),cancelDays:integer(row.cancellation_minutes)/1440,
      teamId:string(row.team_id)||undefined,positionId:string(chosen.position_id)||undefined,instructionVersionId:string(row.instruction_version_id)||undefined,taskTypeVersionId:string(row.task_type_version_id)||undefined,
      positions:rows.flatMap((place)=>{
        const id=string(place.position_id),ordinal=ordinals.get(id);
        return ordinal?[{id,ordinal,allocationId:string(place.allocation_id)||undefined}]:[];
      }),
      canWaitlist:publicPlaces.length>0&&available.length===0&&executors.length>0,
      canBook:available.length>0&&executors.length>0&&!!row.instruction_version_id,canManage:yes(row.can_manage),canConfirm:rawBookings.some((booking)=>booking.shift_id===id&&yes(booking.can_confirm)),state:'published'};
  });
  for (const booking of rawBookings) if (!tasks.some((task)=>task.id===booking.shift_id)) tasks.push({id:string(booking.shift_id),version:integer(booking.shift_version),title:string(booking.title),category:string(booking.category_name),kind:yes(booking.is_team_task)?'team':'club',startsAt:string(booking.starts_at),endsAt:string(booking.ends_at),location:string(booking.location_name),minutes:integer(booking.credit_minutes),capacity:0,freePlaces:0,instructions:string(booking.instructions),minAge:0,qualification:'',cancelDays:0,canBook:false,canConfirm:yes(booking.can_confirm),state:'historical'});
  const teams=rawTeams.map((team)=>({...resource(team),name:string(team.name),parentName:string(team.parent_name),goal:integer(goals.find((goal)=>goal.team_id===team.id&&!goal.member_person_id)?.goal),goalVersion:integer(goals.find((goal)=>goal.team_id===team.id&&!goal.member_person_id)?.version),handoverVersion:integer(records(raw.handovers).find((handover)=>handover.team_id===team.id&&['draft','ready'].includes(string(handover.state)))?.version),canManage:yes(team.can_manage),members:records(team.members).map((member)=>{
    const tally=teamProgress.find((item)=>item.team_id===team.id&&item.member_person_id===member.person_id);
    const goal=goals.find((item)=>item.team_id===team.id&&item.member_person_id===member.person_id);
    return {id:string(member.person_id),version:integer(member.version),goalVersion:integer(goal?.version),name:string(member.display_name),householdId:string(member.household_id),goal:integer(tally?.goal),completed:integer(tally?.confirmed),planned:integer(tally?.planned),assigned:integer(tally?.assigned),unallocated:Math.max(0,integer(tally?.goal)-integer(tally?.confirmed)-integer(tally?.planned)-integer(tally?.assigned)),canAdjust:yes(team.can_manage)};
  })}));
  const agenda:MobileCalendarEvent[]=[
    ...records(raw.agenda).map((row)=>({...resource(row),title:string(row.title),startsAt:string(row.starts_at),endsAt:string(row.ends_at),location:string(row.location_name),state:string(row.state),kind:'event' as const,description:string(row.description),canJoin:yes(row.can_join),joined:row.rsvp==='accepted',attendees:integer(row.attendees)})),
    // The native match source has no end time. Do not invent a duration.
    ...matches.map((row)=>({...resource(row),title:`${teams.find((team)=>team.id===row.team_id)?.name??'Team'} – ${string(row.opponent)}`,startsAt:string(row.starts_at),endsAt:null,location:string(row.location_text),fieldName:string(row.field_name)||undefined,lockerRoom:string(row.locker_room_text)||undefined,state:string(row.status),kind:'match' as const,teamName:teams.find((team)=>team.id===row.team_id)?.name,description:row.is_home===true?'Thuiswedstrijd':'Uitwedstrijd',canJoin:false,joined:false,attendees:0})),
    ...rawBookings.filter((row)=>yes(row.personal_calendar)&&!['cancelled','transferred'].includes(string(row.state))).map((row)=>({...resource(row),title:string(row.title),startsAt:string(row.starts_at),endsAt:string(row.ends_at),location:string(row.location_name),kind:'task' as const,taskId:string(row.shift_id),bookingId:string(row.id),personId:string(row.executor_person_id),personName:string(row.executor_name),description:string(row.instructions),canJoin:false,joined:true,attendees:1})),
    ...allocations.filter((row)=>yes(row.personal_calendar)&&['reserved','assigned'].includes(string(row.state))&&!rawBookings.some((booking)=>booking.allocation_id===row.id&&!['cancelled','transferred'].includes(string(booking.state)))).map((row)=>({...resource(row),title:string(row.title),startsAt:string(row.starts_at),endsAt:string(row.ends_at),location:string(row.location_name),kind:'assignment' as const,taskId:string(row.shift_id),allocationId:string(row.id),personId:string(row.member_person_id)||undefined,teamName:teams.find((team)=>team.id===row.team_id)?.name,description:'Gereserveerde teamplaats. Er is pas een boeking nadat een bevoegde uitvoerder bevestigd heeft.',canJoin:false,joined:false,attendees:0})),
  ].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
  const ownProfiles=records(intakeResult.data).filter((profile)=>!context.household_id||profile.household_context_id===context.household_id);
  const profile=ownProfiles.length===1?ownProfiles[0]:null,answers=object(profile?.answers);
  const policyGroups=new Map<string,Row[]>();
  for(const assignment of records(policyResult.data)) policyGroups.set(string(assignment.policy_version_id),[...(policyGroups.get(string(assignment.policy_version_id))??[]),assignment]);
  const boards=records(raw.boards);
  const result:MobileSnapshot={workspace,workspaces:[...new Map(records(workspacesResult.data).map((row)=>[string(row.tenant_slug),{slug:string(row.tenant_slug),name:string(row.tenant_name)}])).values()],
    season:selectedSeason?{id:string(selectedSeason.id),name:string(selectedSeason.name)}:null,timezone:string(context.timezone,'Europe/Amsterdam'),readAt:new Date().toISOString(),capabilities,commands:Object.keys(mobilePayloadSchemas),
    household:dossier?{id:dossier.household.household_id,version:dossier.household.version,name:dossier.household.label,canInvite:dossier.household.can_invite_executor,obligationId:balance?.obligation_id}:null,
    householdMemberIds:records(dossier?.people).map((person)=>string(person.person_id)),
    progress:raw.progress?progress(object(raw.progress)):null,
    profile:profile?{id:string(profile.profile_id),version:integer(profile.version),experience:string(answers.experience),preferences:strings(answers.preferences),talents:strings(answers.skills),availability:strings(answers.availability),monthlyMinutes:integer(answers.desired_monthly_minutes),boundaries:string(answers.practical_limitations),reserve:yes(answers.reserve_willing),buddy:yes(answers.buddy_requested)}:null,
    people:[...new Map([...people.map((row)=>({id:string(row.person_id),version:integer(row.version),name:string(row.display_name),verified:yes(row.verified),adult:yes(row.adult),ageBand:string(row.age_band,'unknown'),canExecute:executors.some((executor)=>executor.person_id===row.person_id)})),...executors.map((row)=>({id:string(row.person_id),version:integer(row.version),name:string(row.display_name),verified:yes(row.verified),adult:yes(row.adult),ageBand:string(row.age_band,'unknown'),canExecute:yes(row.can_execute)}))].map((person)=>[person.id,person])).values()],tasks,
    committeePlanning,
    bookings:rawBookings.map((row)=>({...resource(row),taskId:string(row.shift_id),positionId:string(row.position_id),executorId:string(row.executor_person_id),executorName:string(row.executor_name),householdId:string(row.household_id),state:string(row.state),startsAt:string(row.starts_at),endsAt:string(row.ends_at),instructions:string(row.instructions),location:string(row.location_name),cancellationDeadline:string(row.cancellation_deadline),minutes:integer(row.credit_minutes),teamId:string(row.team_id)||undefined,memberName:string(row.member_name)||undefined,canCancel:yes(row.can_cancel),canReplace:yes(row.can_replace),canPrepare:yes(row.can_prepare),canFeedback:yes(row.can_feedback),canConfirm:yes(row.can_confirm)&&['booked','performed_pending'].includes(string(row.state))&&Date.parse(string(row.ends_at))<=Date.now(),replacementRequested:yes(row.replacement_requested)})),
    allocations:allocations.map((row)=>({...resource(row),taskId:string(row.shift_id),teamId:string(row.team_id),memberId:string(row.member_person_id)||undefined,memberName:string(row.member_name)||undefined,position:integer(row.ordinal),positionId:string(row.position_id),clusterId:string(row.cluster_id),clusterVersion:integer(row.cluster_version),selfUntil:string(row.self_until),assignUntil:string(row.assign_until),canChoose:yes(row.can_choose),canAssign:yes(row.can_assign),canRequestReserve:yes(row.can_request_reserve),bookingId:string(row.booking_id)||undefined,bookingVersion:integer(row.booking_version),bookingState:string(row.booking_state)||undefined,executorName:string(row.executor_name)||undefined,countsForTeam:yes(row.counts_for_team)})),teams,
    actions:records(raw.actions).filter((row)=>row.state!=='completed').map((row)=>{
      const detailResource=actionDetails.get(string(row.id))??scopedCardActionDetail(row,raw,workspace.tenant_id);
      const actionKind=string(row.action_kind),rowTitle=string(row.title),rowDetail=string(row.detail,string(row.description));
      return {...resource(row),title:detailResource?.title??(rowTitle&&rowTitle!==actionKind?rowTitle:actionKindLabels[actionKind]??'Open actie'),detail:actionKindLabels[rowDetail]??rowDetail,label:'Bekijken',due:string(row.due_at)||undefined,href:mobileActionPath(row,raw,workspace.tenant_slug),
        ...(detailResource?{detailResource:{...detailResource,parentHref:actionContextParentPath(detailResource,raw,workspace.tenant_slug,[...policyGroups.keys()])}}:{})};
    }),
    notifications:records(raw.inbox).map((row)=>({...resource(row),title:string(row.title),text:string(row.body),kind:string(row.notification_kind,'inbox'),read:typeof row.read_at==='string',href:normalizeMobilePath(row.source_path,workspace.tenant_slug)})),agenda,
    policies:[...policyGroups].map(([id,rows])=>{
      const actorSubjects=rows.filter((row)=>yes(row.is_actor_subject));
      return {id,version:integer(rows[0].policy_revision),title:string(rows[0].policy_document_title),publishedAt:string(rows[0].published_at,string(rows[0].effective_at,string(rows[0].offered_at))),text:string(rows[0].exact_body),accepted:actorSubjects.length>0&&actorSubjects.every((row)=>row.state==='accepted'),subjects:actorSubjects.map((row)=>({id:string(row.member_person_id),name:people.find((person)=>person.person_id===row.member_person_id)?.display_name as string??'Bevoegde persoon',accepted:row.state==='accepted',canAccept:yes(row.can_accept),needsOpening:yes(row.can_accept)&&row.state==='offered',assignmentId:string(row.id),assignmentVersion:integer(row.version),capacity:row.member_person_id===workspace.person_id?'self':'guardian'}))};
    }),
    courses:records(raw.courses).map((row)=>({...resource(row),title:string(row.title),startsAt:string(row.starts_at),qualification:string(row.qualification_name),capacity:integer(row.capacity),enrolledCount:integer(row.enrolled_count),enrolled:typeof row.own_state==='string'&&row.own_state!=='cancelled'})),
    qualifications:records(raw.qualifications).map((row)=>({...resource(row),title:string(row.title),expiresAt:string(row.expires_at)||undefined,valid:!yes(row.revoked)&&(!row.expires_at||Date.parse(string(row.expires_at))>Date.now())})),
    opportunities:records(raw.vacancies).map((row)=>({...resource(row),title:string(row.title),committee:string(row.committee_name),expectedMinutes:typeof row.expected_minutes==='number'&&Number.isSafeInteger(row.expected_minutes)&&row.expected_minutes>=0?row.expected_minutes:null,commitment:string(row.guidance),description:string(row.description),exemptionPossible:yes(row.exemption_possible),interested:records(raw.interests).some((interest)=>interest.vacancy_id===row.id&&interest.state==='interested')})),
    channels:records(raw.channels).map((row)=>({...resource(row),name:string(row.title),kind:row.scope_kind==='team'?'team':'committee'})),
    messages:records(raw.messages).map((row)=>({...resource(row),channelId:string(row.channel_id),authorName:string(row.author_name),own:yes(row.is_self),text:string(row.body),sentAt:string(row.created_at)})),
    questions:records(raw.questions).map((row)=>({...resource(row),householdId:string(row.household_id)||undefined,subject:string(row.subject),text:string(row.body),answer:string(row.answer)||undefined,history:records(row.history).map((event)=>({state:string(event.state),at:string(event.created_at,string(event.occurred_at))})),state:string(row.state),own:yes(row.own),canReview:yes(row.can_review)})),
    feedback:records(raw.feedback).map((row)=>{const booking=rawBookings.find((item)=>item.id===row.booking_id);return {...resource(row),taskId:string(row.shift_id,string(booking?.shift_id)),taskTitle:string(row.shift_title,string(booking?.title)),text:string(row.tip),clarity:row.instruction_clarity===true?'clear':'unclear',canImprove:yes(row.can_improve)};}),
    committees:records(raw.committees).map((row)=>({...resource(row),name:string(row.name),canManage:yes(row.can_manage)})),
    boards:boards.map((row)=>({...resource(row),committeeId:string(row.committee_id),name:string(row.name),columns:records(row.columns).map((column)=>({id:string(column.id),title:string(column.title)}))})),
    cards:records(raw.cards).map((row)=>({...resource(row),boardId:string(row.board_id),columnId:string(row.column_id),committeeId:string(boards.find((board)=>board.id===row.board_id)?.committee_id),title:string(row.title),text:string(row.description),state:string(row.status),deadline:string(row.due_at),assignees:records(row.assignees).map((person)=>string(person.name)),assigneeIds:strings(row.assignee_person_ids),canManageDetails:yes(row.can_manage_details),canEdit:yes(row.can_edit),checks:records(row.checklist).map((item)=>({id:string(item.id),version:integer(item.version),text:string(item.label),done:yes(item.completed)})),comments:records(row.replies).map((item)=>({id:string(item.id),authorName:string(item.author_name),text:string(item.body),sentAt:string(item.created_at)}))})),
    documents:records(raw.documents).map((row)=>({...resource(row),committeeId:string(row.committee_id)||undefined,title:string(row.title),text:string(row.body),revision:integer(row.revision),downloadHref:`${base}/documents/${encodeURIComponent(string(row.id))}?revision=${integer(row.revision)}`,checklist:strings(row.checklist)})),
    handovers:records(raw.handovers).map((row)=>({...resource(row),teamId:string(row.team_id),fromName:string(row.predecessor_name),toName:string(row.successor_name),successorId:string(row.successor_person_id),note:string(row.note),checkValues:Array.isArray(row.checks)?row.checks.map(yes):[],checks:strings(row.check_labels),state:string(row.state),canAccept:yes(row.can_accept),canPrepare:yes(row.can_prepare)})),
    reports:records(raw.reports).map((row)=>({...resource(row),name:string(row.name),progress:progress(object(row.progress))})),
    finance:records(raw.finance).map((row)=>({...resource(row),title:string(row.purpose),amountCents:integer(row.available_cents_delta)||integer(row.reserved_cents_delta)||integer(row.spent_cents_delta),kind:integer(row.reserved_cents_delta)!==0?'reservation':integer(row.available_cents_delta)>0?'income':'expense',state:string(row.entry_kind),availableDelta:integer(row.available_cents_delta),reservedDelta:integer(row.reserved_cents_delta),spentDelta:integer(row.spent_cents_delta)})),
    preferences:{email:yes(object(raw.preferences).email),reminders:yes(object(raw.preferences).reminders),team:yes(object(raw.preferences).team),news:yes(object(raw.preferences).news)},contact:raw.club_contact?{...resource(object(raw.club_contact)),name:string(object(raw.club_contact).name),description:'',email:string(object(raw.club_contact).email),phone:string(object(raw.club_contact).phone)}:null,
  };
  return Object.assign(result,{households:households.map((row)=>({id:string(row.id),name:string(row.label)})),seasons:seasons.map((row)=>({id:string(row.id),name:string(row.name)})),
    canManageClubContact:yes(context.can_manage_club_contact),
    helpSeen:records(raw.help_seen).map((row)=>`${string(row.topic_id)}.v${integer(row.topic_version)}`),
    pendingCommands:records(pendingResult.data).map((row)=>({idempotencyKey:string(row.idempotency_key),command:string(row.action)})),
    executors:executors.map((row)=>({personId:string(row.person_id),obligationId:string(row.obligation_id)})),
    qualificationTypes:records(raw.qualification_types).map((row)=>({id:string(row.id),name:string(row.name)})),
    matches:records(raw.matches).map((row)=>({id:string(row.id),name:`${string(row.opponent)} · ${string(row.starts_at)}`})),
    reserveRequests:records(raw.reserve_requests).map((row)=>({...resource(row),allocationId:string(row.allocation_id),positionId:string(row.position_id),taskId:string(row.shift_id),memberId:string(row.member_person_id)||undefined,canBook:yes(row.can_book)})),
    canManageClubClusters:yes(context.can_manage_club_clusters),
    receivingTeams:records(raw.receiving_teams).filter((row)=>yes(row.can_receive_club_tasks)).map((row)=>({...resource(row),name:string(row.name)})),
    reservePreview:records(raw.reserve_preview).map((row)=>({positionId:string(row.position_id),taskId:string(row.shift_id),canReserve:yes(row.can_reserve),reason:string(row.reason)})),
    committeeAllocations:records(raw.committee_allocations).map((row)=>({...resource(row),taskId:string(row.shift_id),teamId:string(row.team_id),committeeId:string(row.committee_id),clusterId:string(row.cluster_id),clusterVersion:integer(row.cluster_version),positionId:string(row.position_id),position:integer(row.ordinal),title:string(row.title),startsAt:string(row.starts_at),endsAt:string(row.ends_at),state:string(row.state),selfUntil:string(row.self_until),assignUntil:string(row.assign_until),canRequestReserve:yes(row.can_request_reserve)})),
    committeeClusters:records(raw.committee_clusters).map((row)=>({...resource(row),teamId:string(row.team_id),committeeId:string(row.committee_id),title:string(row.title),selfUntil:string(row.self_until),assignUntil:string(row.assign_until),canFollowup:yes(row.can_followup)})),
    assigneeCandidates:records(raw.assignee_candidates).map((row)=>({committeeId:string(row.committee_id),personId:string(row.person_id),name:string(row.name)})),
    instructionTargets:records(raw.instruction_targets).map((row)=>({sourceTaskId:string(row.source_shift_id),taskId:string(row.shift_id),version:integer(row.version),title:string(row.title),startsAt:string(row.starts_at)})),
    suitability:records(raw.suitability).map((row)=>({positionId:string(row.position_id),taskId:string(row.shift_id),personId:string(row.person_id),obligationId:string(row.obligation_id),eligible:yes(row.eligible),executorEligible:yes(row.executor_eligible),eligibleWithBuddy:yes(row.eligible_with_buddy),capacityFull:yes(row.capacity_full),ageBand:string(row.age_band,'unknown'),reason:string(row.reason)})),
    ledgerHistory:records(raw.ledger_history).map((row)=>({id:string(row.id),minutesDelta:integer(row.minutes_delta),performedAt:string(row.performed_at),postedAt:string(row.posted_at),kind:string(row.entry_kind),bookingId:string(row.booking_id)||undefined,reversesEntryId:string(row.reverses_entry_id)||undefined,reason:string(row.correction_reason),evidenceKind:string(row.evidence_kind),evidenceHref:`${base}/ledger/${encodeURIComponent(string(row.id))}`})),
    taskTypes:records(raw.task_types).map((row)=>({id:string(row.id),title:string(row.title),category:string(row.category_name)})),
    handoverCandidates:records(raw.handover_candidates).map((row)=>({id:string(row.id),name:string(row.name),teamId:string(row.team_id)})),
    transferOffers:records(raw.transfer_offers).map((row)=>({...resource(row),positionId:string(row.position_id),taskId:string(row.shift_id),expiresAt:string(row.expires_at)})),
    buddies:records(raw.buddies).map((row)=>({bookingId:string(row.booking_id),version:integer(row.version),personId:string(row.person_id),name:string(row.name),taskId:string(row.shift_id),qualified:yes(row.qualified)})),
    reserveCandidates:records(raw.reserve_candidates).map((row)=>({allocationId:string(row.allocation_id),personId:string(row.person_id),name:string(row.name),reason:string(row.reason)})),
    distributionProposals:records(raw.distribution_proposals).map((row)=>({teamId:string(row.team_id),assignments:records(row.assignments).map((assignment)=>({allocationId:string(assignment.allocation_id),expectedVersion:integer(assignment.expected_version),memberId:string(assignment.member_person_id),reason:string(assignment.reason)}))})),
    teamCreditRequests:records(raw.team_credit_requests).map((row)=>({...resource(row),teamId:string(row.team_id),title:string(row.title),requestedMinutes:integer(row.requested_minutes),approvedMinutes:typeof row.approved_minutes==='number'?integer(row.approved_minutes):null,state:string(row.state),refereeNeeded:yes(row.referee_needed),matchId:string(row.match_id)||undefined,matchReviewed:yes(row.match_reviewed),canReviewMatch:yes(row.can_review_match),canReviewVolunteer:yes(row.can_review_volunteer),canPublish:yes(row.can_publish)})),
    preferenceVersion:integer(object(raw.preferences).version),pushPublicKey:mobilePushPublicKey,serverPreferences:Object.fromEntries(['email','push','inbox','reminders','team','news'].map((key)=>[key,yes(object(raw.preferences)[key])]))});
});

export async function loadMobileSnapshot(club:string,selection?:{household?:string;season?:string}) {
  return load(club,allowedSelection(selection?.household),allowedSelection(selection?.season));
}
