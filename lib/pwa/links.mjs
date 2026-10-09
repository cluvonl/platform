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
    for(const key of ['task','booking','allocation','transfer','reserve','team','member','channel','household','season','committee','card','doc','question','handover']) {
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
