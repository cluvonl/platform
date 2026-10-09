const screens=new Set(['home','tasks','agenda','teams','more','actions','notifications','manage','profile','household','policies','courses','opportunities','messages','settings','help','install','reports','finance','committees']);
const aliases={diensten:'tasks',taken:'tasks',gezin:'agenda',kanban:'committees',huishouden:'household',overzicht:'home',beleid:'policies',berichten:'messages'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tabs={tasks:new Set(['market','mine','takeovers']),teams:new Set(['tasks','progress','organize']),manage:new Set(['plan','confirm','requests']),committees:new Set(['tasks','documents'])};
const views={tasks:new Set(['filters']),teams:new Set(['handover','distribution','create','goal','deadlines','feedback','assign']),manage:new Set(['create','cluster']),committees:new Set(['create-card']),household:new Set(['invite','question']),help:new Set(['request'])};
export function normalizeMobilePath(value,club) {
  const base=`/app/c/${encodeURIComponent(club)}`,fallback=`${base}/notifications`;
  if(typeof value!=='string'||value.length>2000||/[\\\u0000-\u001f]/.test(value))return fallback;
  let candidate=value;
  if(candidate.startsWith('#/'))candidate=candidate.slice(1);
  else if(candidate.startsWith('#'))candidate='/'+candidate.slice(1);
  try {
    let url=new URL(candidate,'https://cluvo.invalid');
    if(url.origin!=='https://cluvo.invalid')return fallback;
    if(url.pathname==='/'&&url.hash.startsWith('#/'))url=new URL(url.hash.slice(1),'https://cluvo.invalid');
    if(url.hash)return fallback;
    let name;
    if(url.pathname.startsWith(base+'/'))name=url.pathname.slice(base.length+1);
    else if(url.pathname.startsWith(`/c/${encodeURIComponent(club)}/`))name=url.pathname.slice(`/c/${encodeURIComponent(club)}/`.length);
    else if(url.pathname.startsWith('/app/c/')||url.pathname.startsWith('/c/'))return fallback;
    else name=url.pathname.replace(/^\/app\//,'/').replace(/^\//,'');
    const screen=aliases[name]??name;if(!screens.has(screen))return fallback;
    const query=new URLSearchParams();
    for(const key of ['task','booking','allocation','transfer','reserve','team','member','channel','household','season','committee','card','doc','question','handover','action']) {
      const selected=url.searchParams.getAll(key);
      if(selected.length===1&&uuid.test(selected[0]))query.set(key,selected[0]);
    }
    const view=url.searchParams.getAll('view');
    if(view.length===1&&(uuid.test(view[0])||views[screen]?.has(view[0])))query.set('view',view[0]);
    const oldId=url.searchParams.getAll('id');
    if(oldId.length===1&&uuid.test(oldId[0])&&!query.has(screen==='committees'?'view':'task')) {
      if(screen==='tasks')query.set('task',oldId[0]);
      if(screen==='committees')query.set('view',oldId[0]);
    }
    const tab=url.searchParams.getAll('tab');
    if(tab.length===1&&tabs[screen]?.has(tab[0]))query.set('tab',tab[0]);
    else if(name==='diensten')query.set('tab','mine');
    if(screen==='teams'&&query.has('handover')) {
      if(!query.has('view'))query.set('view','handover');
      if(!query.has('tab'))query.set('tab','organize');
    }
    return `${base}/${screen}${query.size?'?'+query:''}`;
  } catch {return fallback;}
}

const rows=(value)=>Array.isArray(value)?value.filter((row)=>row&&typeof row==='object'&&!Array.isArray(row)):[];
const one=(value,id)=>{
  if(typeof id!=='string'||!uuid.test(id))return null;
  const matches=rows(value).filter((row)=>row.id===id);
  return matches.length===1?matches[0]:null;
};

// These are already authorized snapshot resources, not an authorization cache.
// A missing/stale reference must never select another task, team or work card.
export function mobileActionPath(action,snapshot,club) {
  const base=`/app/c/${encodeURIComponent(club)}`;
  const unavailable=typeof action.id==='string'&&uuid.test(action.id)?`${base}/actions?action=${action.id}`:`${base}/actions`;
  const taskAvailable=(id)=>typeof id==='string'&&uuid.test(id)&&[...rows(snapshot.market),...rows(snapshot.bookings)].some((row)=>row.shift_id===id);
  const taskPath=(row,selector)=>row&&taskAvailable(row.shift_id)?normalizeMobilePath(`/app/tasks?task=${row.shift_id}&${selector}=${row.id}&tab=mine`,club):unavailable;
  switch(action.action_kind) {
    case 'choose_executor':return taskPath(one(snapshot.allocations,action.id),'allocation');
    case 'prepare_booking':return taskPath(one(snapshot.bookings,action.id),'booking');
    case 'accept_handover': {
      const handover=one(snapshot.handovers,action.id);
      return handover&&one(snapshot.teams,handover.team_id)?normalizeMobilePath(`/app/teams?team=${handover.team_id}&handover=${handover.id}`,club):unavailable;
    }
    case 'find_replacement': {
      const offer=one(snapshot.transfer_offers,action.id);
      const booking=offer&&one(snapshot.bookings,offer.booking_id);
      // This is the current executor's booking, never their own takeover offer.
      return booking&&booking.shift_id===offer.shift_id?taskPath(booking,'booking'):unavailable;
    }
    case 'card_assignment': {
      const card=one(snapshot.cards,action.card_id);
      const board=card&&one(snapshot.boards,card.board_id);
      return board&&one(snapshot.committees,board.committee_id)?normalizeMobilePath(`/app/committees?committee=${board.committee_id}&view=${card.id}`,club):unavailable;
    }
    default:return unavailable;
  }
}

export function actionContextParentPath(detail,snapshot,club,policyIds=[]) {
  if(!detail)return undefined;
  switch(detail.parentKind) {
    case 'card': {
      const card=one(snapshot.cards,detail.parentId),board=card&&one(snapshot.boards,card.board_id);
      return board&&one(snapshot.committees,board.committee_id)?normalizeMobilePath(`/app/committees?committee=${board.committee_id}&view=${card.id}`,club):undefined;
    }
    case 'event':return one(snapshot.agenda,detail.parentId)?normalizeMobilePath(`/app/agenda?view=${detail.parentId}`,club):undefined;
    case 'team':return one(snapshot.teams,detail.parentId)?normalizeMobilePath(`/app/teams?team=${detail.parentId}&tab=tasks`,club):undefined;
    case 'policy':return isPolicyId(detail.parentId,policyIds)?normalizeMobilePath(`/app/policies?view=${detail.parentId}`,club):undefined;
    default:return undefined;
  }
}
const isPolicyId=(id,ids)=>typeof id==='string'&&uuid.test(id)&&ids.includes(id);
