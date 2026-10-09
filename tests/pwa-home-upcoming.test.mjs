import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectHomeUpcoming} from '../lib/pwa/home-upcoming.mjs';

const now='2026-10-09T10:00:00Z',early='2026-10-16T08:00:00Z',later='2026-10-17T08:00:00Z';
const task=(id,changes={})=>({id,version:2,title:id,startsAt:later,endsAt:'2026-10-17T10:00:00Z',location:'Current location',minutes:120,instructions:'Current instructions',...changes});
const booking=(id,changes={})=>({id,taskId:'task',householdId:'own',state:'booked',startsAt:early,endsAt:'2026-10-16T09:00:00Z',location:'Agreed location',minutes:60,instructions:'Agreed instructions',...changes});
const snapshot=(changes={})=>({readAt:now,household:{id:'own'},householdMemberIds:['child'],tasks:[task('task')],bookings:[],allocations:[],agenda:[],...changes});
const event=(id,kind,state,changes={})=>({id,kind,state,startsAt:early,...changes});

test('cancelled, transferred and unknown future bookings remain history while current bookings are ordered by their original start',()=>{
  const input=snapshot({bookings:[booking('late',{startsAt:later}),booking('cancelled',{state:'cancelled'}),booking('transferred',{state:'transferred'}),booking('early'),booking('confirmed',{state:'confirmed'}),booking('unknown',{state:'new_state'})]});
  const before=structuredClone(input);
  assert.deepEqual(selectHomeUpcoming(input).bookings.map(({booking})=>booking.id),['early','late']);
  assert.deepEqual(input,before);
});

test('future replacement and reconfirmation preserve the current executor appointment until a final state',()=>{
  const input=snapshot({bookings:['booked','transfer_pending','reconfirmation_required','performed_pending'].map((state)=>booking(state,{state}))});
  assert.deepEqual(selectHomeUpcoming(input).bookings.map(({booking})=>booking.state).sort(),['booked','performed_pending','reconfirmation_required','transfer_pending']);
});

test('Home preserves zero-minute and changed agreements from the selected booking instead of the currently published shift',()=>{
  const input=snapshot({tasks:[task('task',{startsAt:'2026-10-01T08:00:00Z'})],bookings:[booking('exact',{minutes:0,location:'',instructions:''})]});
  const {booking:selected,task:card}=selectHomeUpcoming(input).bookings[0];
  assert.equal(selected.id,'exact');assert.equal(card.id,'task');assert.equal(card.version,2);
  assert.equal(card.startsAt,early);assert.equal(card.endsAt,'2026-10-16T09:00:00Z');
  assert.equal(card.minutes,0);assert.equal(card.location,'');assert.equal(card.instructions,'');
  assert.equal(input.tasks[0].minutes,120);assert.equal(input.tasks[0].startsAt,'2026-10-01T08:00:00Z');
});

test('current shift dates cannot resurrect past, missing, invalid or foreign-household booking appointments',()=>{
  const input=snapshot({bookings:[booking('past',{startsAt:'2026-10-01T08:00:00Z'}),booking('started',{startsAt:now}),booking('missing',{startsAt:undefined}),booking('invalid',{startsAt:'unknown'}),booking('foreign',{householdId:'another'}),booking('missing-task',{taskId:'another'})]});
  assert.deepEqual(selectHomeUpcoming(input).bookings,[]);
  assert.deepEqual(selectHomeUpcoming(snapshot({household:null,bookings:[booking('unscoped')]})).bookings,[]);
});

test('assigned cards require a future actual task, an own represented member and current executor choice, and are chronological',()=>{
  const allocation=(id,taskId,changes={})=>({id,taskId,memberId:'child',canChoose:true,...changes});
  const input=snapshot({tasks:[task('early',{startsAt:early}),task('late'),task('past',{startsAt:now})],allocations:[allocation('late','late'),allocation('early','early'),allocation('foreign','early',{memberId:'other-child'}),allocation('closed','early',{canChoose:false}),allocation('missing','missing'),allocation('past','past'),allocation('unassigned','early',{memberId:undefined})]});
  assert.deepEqual(selectHomeUpcoming(input).assigned.map(({allocation})=>allocation.id),['early','late']);
});

test('the next live match and the next live club activity both remain reachable, regardless of which is earlier',()=>{
  for(const kinds of [['match','event'],['event','match']]) {
    const input=snapshot({agenda:[event('later',kinds[1],'scheduled',{startsAt:later}),event('early',kinds[0],'scheduled')]});
    const result=selectHomeUpcoming(input).events;
    assert.equal(result.length,2);assert.deepEqual(result.map((item)=>item.kind),['match','event']);
    assert.deepEqual(result.map((item)=>item.id).sort(),['early','later']);
  }
});

test('cancelled, completed, past, missing-state and unknown-state events never hide a later valid source',()=>{
  const input=snapshot({agenda:[event('cancelled-match','match','cancelled'),event('completed-match','match','completed'),event('old-match','match','scheduled',{startsAt:now}),event('missing-match','match',undefined),event('unknown-match','match','other'),event('next-match','match','postponed',{startsAt:later}),event('cancelled-activity','event','cancelled'),event('missing-activity','event',undefined),event('unknown-activity','event','other'),event('next-activity','event','moved',{startsAt:later}),event('task-is-not-event','task','scheduled')]});
  assert.deepEqual(selectHomeUpcoming(input).events.map((item)=>item.id),['next-match','next-activity']);
});

test('an own pending assignment is a real upcoming item even when no booking, match or club activity exists',()=>{
  const result=selectHomeUpcoming(snapshot({allocations:[{id:'assignment',taskId:'task',memberId:'child',canChoose:true}]}));
  assert.equal(result.assigned.length,1);assert.deepEqual(result.bookings,[]);assert.deepEqual(result.events,[]);
  assert.deepEqual(selectHomeUpcoming(snapshot()),{assigned:[],bookings:[],events:[]});
});
