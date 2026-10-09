import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadScopedActionDetails,scopedActionDetail,scopedCardActionDetail} from '../lib/pwa/action-details.mjs';
import {actionContextParentPath} from '../lib/pwa/links.mjs';

const id=(n)=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),actionId=id(2),childId=id(3),parentId=id(4);
const action=(kind)=>({id:actionId,version:2,action_kind:kind,state:'open'});
const native=(kind,key,changes={})=>({id:actionId,tenant_id:tenant,version:2,action_kind:kind,state:'open',[key]:childId,...changes});
const detail=(kind,sourceKind,parentKey,changes={})=>({tenant_id:tenant,action_id:actionId,action_version:2,action_kind:kind,resource_id:childId,resource_version:3,kind:sourceKind,title:'Exact source',text:'Actual authorized body',state:'open',parent_title:'Exact parent',[parentKey]:parentId,...changes});
const forms=[
  ['subtask_assignment','subtask_id','subtask','card_id'],
  ['mention','mention_id','card_mention','card_id'],
  ['mention','mention_id','event_mention','occurrence_id'],
  ['team_task','team_task_id','team_task','team_id'],
  ['policy_follow_up','policy_question_id','policy_question','policy_version_id'],
];
test('an assigned work card can be read from the exact authorized snapshot without committee-wide rights',()=>{
  const own={...action('card_assignment'),card_id:childId};
  const snapshot={context:{tenant_id:tenant},actions:[own],cards:[{id:childId,version:3,title:'Assigned card only',description:'Actual private instructions',status:'open',email:'private'}],committees:[],boards:[]};
  const result=scopedCardActionDetail(own,snapshot,tenant);
  assert.deepEqual(result,{kind:'work_card',resourceId:childId,resourceVersion:3,title:'Assigned card only',text:'Actual private instructions',state:'open',parentTitle:'Assigned card only',parentKind:'card',parentId:childId});
  assert.equal(actionContextParentPath(result,snapshot,'club-a'),undefined);
});
test('a foreign, stale, dismissed or ambiguous card action cannot contribute snapshot card content',()=>{
  const own={...action('card_assignment'),card_id:childId};
  const snapshot={context:{tenant_id:tenant},actions:[own],cards:[{id:childId,version:3,title:'Own card',description:'Private body',status:'open'}]};
  for(const changed of [{id:id(99)},{version:1},{card_id:id(99)},{state:'dismissed'},{action_kind:'subtask_assignment'}])assert.equal(scopedCardActionDetail({...own,...changed},snapshot,tenant),null);
  assert.equal(scopedCardActionDetail(own,snapshot,id(99)),null);
  assert.equal(scopedCardActionDetail(own,{...snapshot,cards:[]},tenant),null);
  assert.equal(scopedCardActionDetail(own,{...snapshot,cards:[...snapshot.cards,...snapshot.cards]},tenant),null);
  assert.equal(scopedCardActionDetail(own,{...snapshot,actions:[own,own]},tenant),null);
});
const sourceDetail=(kind,form,key)=>detail(kind,form,key,{...(['card_mention','event_mention'].includes(form)?{resource_version:undefined,parent_version:7}:{}),...(form==='team_task'?{credit_minutes:0}:{}),...(form==='policy_question'?{assignment_id:id(5),resolution_text:'Actual answer'}:{})});
test('all five native parent forms expose the exact authorized body through a private-field whitelist',()=>{
  for(const [kind,childKey,form,parentKey]of forms){
    const result=scopedActionDetail(action(kind),native(kind,childKey),{...sourceDetail(kind,form,parentKey),email:'private@example.test',auth_user_id:id(50),endpoint:'private',unknown:{secret:true}},tenant);
    assert.equal(result.kind,form);assert.equal(result.resourceId,childId);assert.equal(result.parentId,parentId);assert.equal(result.text,'Actual authorized body');
    assert.equal(Object.hasOwn(result,'email'),false);assert.equal(Object.hasOwn(result,'auth_user_id'),false);assert.equal(Object.hasOwn(result,'endpoint'),false);assert.equal(Object.hasOwn(result,'unknown'),false);
    if(form.endsWith('mention')){assert.equal(Object.hasOwn(result,'resourceVersion'),false);assert.equal(result.parentVersion,7);}
    if(form==='team_task')assert.equal(result.creditMinutes,0);
  }
});
test('a mismatched actor snapshot/native reference or transport body never contributes private source content',()=>{
  const own=action('subtask_assignment'),n=native('subtask_assignment','subtask_id'),body=sourceDetail('subtask_assignment','subtask','card_id');
  for(const changed of [{tenant_id:id(90)},{id:id(90)},{version:3},{version:'2'},{state:'completed'},{action_kind:'mention'},{subtask_id:id(90)},{card_id:id(90)}])assert.equal(scopedActionDetail(own,{...n,...changed},body,tenant),null);
  for(const changed of [{tenant_id:id(90)},{action_id:id(90)},{action_version:3},{action_kind:'mention'},{resource_id:id(90)},{kind:'team_task'},{card_id:'private-token'},{resource_version:'3'},{title:null}])assert.equal(scopedActionDetail(own,n,{...body,...changed},tenant),null);
  assert.equal(scopedActionDetail(own,n,null,tenant),null);
  assert.equal(scopedActionDetail(action('team_task'),native('team_task','team_task_id'),detail('team_task','team_task','team_id',{credit_minutes:120}),tenant),null);
});
const transport=(nativeRows,responses,calls=[])=>({schema(schema){calls.push(['schema',schema]);return {
  from(view){calls.push(['from',view]);return {select(fields){calls.push(['select',fields]);return {eq(key,value){calls.push(['eq',key,value]);return {async in(key,value){calls.push(['in',key,value]);return {data:nativeRows,error:null};}};}};}};},
  async rpc(name,parameters){calls.push(['rpc',name,parameters]);return responses.shift();}
};}});
test('native actor reads are restricted to snapshot IDs and an exact version before any child content RPC',async()=>{
  const calls=[],snapshot=[action('subtask_assignment')];
  const result=await loadScopedActionDetails(transport([native('subtask_assignment','subtask_id')],[{data:sourceDetail('subtask_assignment','subtask','card_id'),error:null}],calls),tenant,snapshot);
  assert.equal(result.get(actionId).text,'Actual authorized body');
  assert.deepEqual(calls.filter(([operation])=>operation==='from'||operation==='eq'||operation==='in'||operation==='rpc'),[['from','my_actions'],['eq','tenant_id',tenant],['in','id',[actionId]],['rpc','pwa_personal_action_context',{p_tenant_id:tenant,p_action_id:actionId,p_expected_version:2}]]);
  for(const rows of [[],[native('subtask_assignment','subtask_id',{version:3})],[native('subtask_assignment','subtask_id',{card_id:parentId})],[native('subtask_assignment','subtask_id'),native('subtask_assignment','subtask_id')]]){
    const denied=[];assert.equal((await loadScopedActionDetails(transport(rows,[],denied),tenant,snapshot)).size,0);assert.equal(denied.some(([operation])=>operation==='rpc'),false);
  }
  const empty=[];assert.equal((await loadScopedActionDetails(transport([],[],empty),tenant,[action('prepare_booking')])).size,0);assert.deepEqual(empty,[]);
});
test('revoked source content is absent and provider failures fail closed with no secret diagnostic',async()=>{
  assert.equal((await loadScopedActionDetails(transport([native('subtask_assignment','subtask_id')],[{data:null,error:null}]),tenant,[action('subtask_assignment')])).size,0);
  await assert.rejects(loadScopedActionDetails(transport([native('subtask_assignment','subtask_id')],[{data:null,error:{message:'private secret'}}]),tenant,[action('subtask_assignment')]),error=>error.message.includes('niet veilig')&&!error.message.includes('private'));
  const calls=[];await assert.rejects(loadScopedActionDetails(transport([],[],calls),tenant,[{...action('subtask_assignment'),id:'private-token'}]));assert.deepEqual(calls,[]);
});
test('context parent links require the same parent already authorized in the current snapshot',()=>{
  const card=id(10),board=id(11),committee=id(12),event=id(13),team=id(14),policy=id(15);
  const snapshot={cards:[{id:card,board_id:board}],boards:[{id:board,committee_id:committee}],committees:[{id:committee}],agenda:[{id:event}],teams:[{id:team}]};
  for(const [kind,parent,path]of [['card',card,`committees?committee=${committee}&view=${card}`],['event',event,`agenda?view=${event}`],['team',team,`teams?team=${team}&tab=tasks`],['policy',policy,`policies?view=${policy}`]]){
    assert.equal(actionContextParentPath({parentKind:kind,parentId:parent},snapshot,'club-a',[policy]),'/app/c/club-a/'+path);
    assert.equal(actionContextParentPath({parentKind:kind,parentId:id(90)},snapshot,'club-a',[policy]),undefined);
  }
  assert.equal(actionContextParentPath({parentKind:'card',parentId:card},{...snapshot,committees:[]},'club-a'),undefined);
  assert.equal(actionContextParentPath({parentKind:'policy',parentId:policy},snapshot,'club-a',[]),undefined);
});
