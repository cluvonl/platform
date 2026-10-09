import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileActionPath,normalizeMobilePath} from '../lib/pwa/links.mjs';
const id='10000000-0000-4000-8000-000000000001';
test('legacy Dutch routes become tenant-bound mobile links with safe resource selectors',()=>{
  assert.equal(normalizeMobilePath('/app/diensten?id='+id,'club-a'),'/app/c/club-a/tasks?task='+id+'&tab=mine');
  assert.equal(normalizeMobilePath('/#/gezin','club-a'),'/app/c/club-a/agenda');
  assert.equal(normalizeMobilePath('#kanban?id='+id,'club-a'),'/app/c/club-a/committees?view='+id);
  assert.equal(normalizeMobilePath('/app/teams?team='+id,'club-a'),'/app/c/club-a/teams?team='+id);
});
test('cross-club, external and token links cannot restore another scope or identity',()=>{
  for(const path of ['/app/c/club-b/tasks?task='+id,'https://evil.example/app/c/club-a/tasks','//evil.example/tasks','/app/c/club-a/../club-b/tasks','/app/c/club-a/tasks#access_token=secret','/app/c/club-a\\tasks'])assert.equal(normalizeMobilePath(path,'club-a'),'/app/c/club-a/notifications');
  assert.equal(normalizeMobilePath('/app/c/club-a/tasks?task='+id+'&token=private&auth_user_id='+id,'club-a'),'/app/c/club-a/tasks?task='+id);
  assert.equal(normalizeMobilePath('/tasks?task='+id+'&task='+id,'club-a'),'/app/c/club-a/tasks');
});
test('actual mobile sheets and tabs remain typed by screen while card, document and committee selectors stay UUIDs',()=>{
  for(const view of ['handover','distribution','create','goal','deadlines','feedback','assign'])assert.equal(normalizeMobilePath('/app/teams?team='+id+'&tab=organize&view='+view,'club-a'),'/app/c/club-a/teams?team='+id+'&view='+view+'&tab=organize');
  assert.equal(normalizeMobilePath('/committees?committee='+id+'&card='+id+'&doc='+id+'&view=create-card&tab=documents','club-a'),'/app/c/club-a/committees?committee='+id+'&card='+id+'&doc='+id+'&view=create-card&tab=documents');
  assert.equal(normalizeMobilePath('/manage?tab=confirm&view=create','club-a'),'/app/c/club-a/manage?view=create&tab=confirm');
  for(const screen of ['tasks','home','committees'])assert.equal(normalizeMobilePath('/'+screen+'?view=handover&committee=not-an-id&doc=private-token','club-a'),'/app/c/club-a/'+screen);
  assert.equal(normalizeMobilePath('/teams?view=handover&view=assign&tab=organize&tab=tasks','club-a'),'/app/c/club-a/teams');
  assert.equal(normalizeMobilePath('/teams?view='+'a'.repeat(2001),'club-a'),'/app/c/club-a/notifications');
});
test('notification links retain the exact typed question and handover and open the team handover view',()=>{
  assert.equal(normalizeMobilePath('/app/actions?question='+id,'club-a'),'/app/c/club-a/actions?question='+id);
  assert.equal(normalizeMobilePath('/app/teams?team='+id+'&handover='+id,'club-a'),'/app/c/club-a/teams?team='+id+'&handover='+id+'&view=handover&tab=organize');
  for(const key of ['question','handover']) {
    assert.equal(normalizeMobilePath('/app/actions?'+key+'=private-token','club-a'),'/app/c/club-a/actions');
    assert.equal(normalizeMobilePath('/app/actions?'+key+'='+id+'&'+key+'='+id,'club-a'),'/app/c/club-a/actions');
  }
});

const resourceId=(number)=>`20000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
const taskA=resourceId(1),taskB=resourceId(2),allocationId=resourceId(3),bookingId=resourceId(4),teamId=resourceId(5),handoverId=resourceId(6),offerId=resourceId(7),cardId=resourceId(8),boardId=resourceId(9),committeeId=resourceId(10),actionId=resourceId(11);
const actionSnapshot=()=>({market:[{shift_id:taskA},{shift_id:taskB}],bookings:[{id:resourceId(99),shift_id:taskA},{id:bookingId,shift_id:taskB}],allocations:[{id:allocationId,shift_id:taskB}],teams:[{id:teamId}],handovers:[{id:handoverId,team_id:teamId}],transfer_offers:[{id:offerId,booking_id:bookingId,shift_id:taskB}],cards:[{id:cardId,board_id:boardId}],boards:[{id:boardId,committee_id:committeeId}],committees:[{id:committeeId}]});
test('derived actions open the exact reserved place, booking and team handover instead of the first resource',()=>{
  const snapshot=actionSnapshot(),base='/app/c/club-a';
  assert.equal(mobileActionPath({id:allocationId,action_kind:'choose_executor'},snapshot,'club-a'),`${base}/tasks?task=${taskB}&allocation=${allocationId}&tab=mine`);
  assert.equal(mobileActionPath({id:bookingId,action_kind:'prepare_booking'},snapshot,'club-a'),`${base}/tasks?task=${taskB}&booking=${bookingId}&tab=mine`);
  assert.equal(mobileActionPath({id:handoverId,action_kind:'accept_handover'},snapshot,'club-a'),`${base}/teams?team=${teamId}&handover=${handoverId}&view=handover&tab=organize`);
  const replacement=mobileActionPath({id:offerId,action_kind:'find_replacement'},snapshot,'club-a');
  assert.equal(replacement,`${base}/tasks?task=${taskB}&booking=${bookingId}&tab=mine`);
  assert.equal(new URL(replacement,'https://cluvo.invalid').searchParams.has('transfer'),false);
});
test('card actions retain the authorized committee and exact card drawer',()=>{
  assert.equal(mobileActionPath({id:actionId,action_kind:'card_assignment',card_id:cardId},actionSnapshot(),'club-a'),`/app/c/club-a/committees?committee=${committeeId}&view=${cardId}`);
});
test('removed, ambiguous and unrelated action references never fall through to an available resource',()=>{
  for(const kind of ['choose_executor','prepare_booking','accept_handover','find_replacement','card_assignment','subtask_assignment','mention','team_task','policy_follow_up']) {
    assert.equal(mobileActionPath({id:actionId,action_kind:kind,card_id:resourceId(90),source_path:'/app/c/club-b/teams?team='+teamId},actionSnapshot(),'club-a'),`/app/c/club-a/actions?action=${actionId}`);
  }
  const cases=[
    [{id:allocationId,action_kind:'choose_executor'}, {...actionSnapshot(),market:[],bookings:[]}],
    [{id:bookingId,action_kind:'prepare_booking'}, {...actionSnapshot(),bookings:[{id:bookingId,shift_id:taskA},{id:bookingId,shift_id:taskB}]}],
    [{id:handoverId,action_kind:'accept_handover'}, {...actionSnapshot(),teams:[]}],
    [{id:offerId,action_kind:'find_replacement'}, {...actionSnapshot(),transfer_offers:[{id:offerId,booking_id:bookingId,shift_id:taskA}]}],
    [{id:actionId,action_kind:'card_assignment',card_id:cardId}, {...actionSnapshot(),committees:[]}],
    [{id:actionId,action_kind:'card_assignment',card_id:cardId}, {...actionSnapshot(),boards:[]}],
  ];
  for(const [action,snapshot] of cases)assert.equal(mobileActionPath(action,snapshot,'club-a'),`/app/c/club-a/actions?action=${action.id}`);
  assert.equal(mobileActionPath({id:'private-token',action_kind:'prepare_booking'},actionSnapshot(),'club-a'),'/app/c/club-a/actions');
  assert.equal(normalizeMobilePath('/app/actions?action='+actionId+'&token=private','club-a'),`/app/c/club-a/actions?action=${actionId}`);
  assert.equal(normalizeMobilePath('/app/actions?action='+actionId+'&action='+actionId,'club-a'),'/app/c/club-a/actions');
});
