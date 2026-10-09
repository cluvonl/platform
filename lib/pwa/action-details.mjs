const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const childKeys={subtask_assignment:'subtask_id',mention:'mention_id',team_task:'team_task_id',policy_follow_up:'policy_question_id'};
const referenceKeys=['card_id',...Object.values(childKeys)];
const sourceKinds={subtask_assignment:['subtask'],mention:['card_mention','event_mention'],team_task:['team_task'],policy_follow_up:['policy_question']};
const isId=(value)=>typeof value==='string'&&uuid.test(value);
const version=(value)=>Number.isSafeInteger(value)&&value>0;
const text=(value)=>typeof value==='string'?value:'';

export function scopedCardActionDetail(action,snapshot,tenantId) {
  if(action.action_kind!=='card_assignment'||action.state!=='open'||!isId(action.id)||!isId(action.card_id)||!version(action.version)||snapshot.context?.tenant_id!==tenantId)return null;
  const actions=Array.isArray(snapshot.actions)?snapshot.actions.filter((row)=>row.id===action.id):[];
  if(actions.length!==1||actions[0].version!==action.version||actions[0].card_id!==action.card_id||actions[0].state!=='open'||actions[0].action_kind!=='card_assignment')return null;
  const cards=Array.isArray(snapshot.cards)?snapshot.cards.filter((row)=>row.id===action.card_id):[];
  if(cards.length!==1||!version(cards[0].version)||typeof cards[0].title!=='string'||typeof cards[0].status!=='string')return null;
  const card=cards[0];
  return {kind:'work_card',resourceId:card.id,resourceVersion:card.version,title:card.title,text:text(card.description),state:card.status,parentTitle:card.title,parentKind:'card',parentId:card.id};
}

export function scopedActionDetail(snapshotAction,nativeAction,detail,tenantId) {
  const childKey=childKeys[snapshotAction.action_kind];
  if(!childKey||nativeAction.tenant_id!==tenantId||nativeAction.id!==snapshotAction.id||nativeAction.action_kind!==snapshotAction.action_kind||nativeAction.version!==snapshotAction.version||nativeAction.state!=='open'||!version(nativeAction.version))return null;
  const populated=referenceKeys.filter((key)=>nativeAction[key]!=null);
  if(populated.length!==1||populated[0]!==childKey||!isId(nativeAction[childKey]))return null;
  if(!detail||typeof detail!=='object'||Array.isArray(detail)||detail.tenant_id!==tenantId||detail.action_id!==snapshotAction.id||detail.action_version!==snapshotAction.version||detail.action_kind!==snapshotAction.action_kind||detail.resource_id!==nativeAction[childKey]||!sourceKinds[snapshotAction.action_kind].includes(detail.kind)||typeof detail.title!=='string'||typeof detail.state!=='string')return null;
  const parentKey={subtask:'card_id',card_mention:'card_id',event_mention:'occurrence_id',team_task:'team_id',policy_question:'policy_version_id'}[detail.kind];
  if(!isId(detail[parentKey])||(['card_mention','event_mention'].includes(detail.kind)?!version(detail.parent_version):!version(detail.resource_version)))return null;
  if(detail.kind==='team_task'&&detail.credit_minutes!==0)return null;
  if(detail.kind==='policy_question'&&!isId(detail.assignment_id))return null;
  // Explicit projection keeps arbitrary provider/identity fields out of RSC.
  return {kind:detail.kind,resourceId:detail.resource_id,title:detail.title,text:text(detail.text),state:detail.state,parentTitle:text(detail.parent_title),
    ...(version(detail.resource_version)?{resourceVersion:detail.resource_version}:{}),...(version(detail.parent_version)?{parentVersion:detail.parent_version}:{}),
    ...(typeof detail.due_at==='string'?{dueAt:detail.due_at}:{}),...(typeof detail.resolution_text==='string'?{resolution:detail.resolution_text}:{}),
    ...(detail.kind==='team_task'?{creditMinutes:0}:{}),parentKind:{subtask:'card',card_mention:'card',event_mention:'event',team_task:'team',policy_question:'policy'}[detail.kind],parentId:detail[parentKey]};
}

export async function loadScopedActionDetails(client,tenantId,snapshotActions) {
  const actions=snapshotActions.filter((action)=>childKeys[action.action_kind]&&action.state==='open');
  const result=new Map();
  if(!actions.length)return result;
  if(!isId(tenantId)||actions.some((action)=>!isId(action.id)||!version(action.version)))throw new Error('Je acties kunnen nu niet veilig worden geladen.');
  const {data,error}=await client.schema('api').from('my_actions').select('id,tenant_id,action_kind,card_id,subtask_id,mention_id,team_task_id,policy_question_id,state,version').eq('tenant_id',tenantId).in('id',[...new Set(actions.map((action)=>action.id))]);
  if(error||!Array.isArray(data)||data.some((row)=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('Je acties kunnen nu niet veilig worden geladen. Probeer het opnieuw.');
  for(const action of actions) {
    const native=data.filter((row)=>row.id===action.id&&row.tenant_id===tenantId&&row.action_kind===action.action_kind&&row.version===action.version&&row.state==='open');
    if(native.length!==1)continue;
    const key=childKeys[action.action_kind],references=referenceKeys.filter((key)=>native[0][key]!=null);
    if(references.length!==1||references[0]!==key||!isId(native[0][key]))continue;
    const response=await client.schema('api').rpc('pwa_personal_action_context',{p_tenant_id:tenantId,p_action_id:action.id,p_expected_version:action.version});
    if(response.error)throw new Error('Je acties kunnen nu niet veilig worden geladen. Probeer het opnieuw.');
    const detail=scopedActionDetail(action,native[0],response.data,tenantId);
    if(detail)result.set(action.id,detail);
  }
  return result;
}
