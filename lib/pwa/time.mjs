const LOCAL=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
function wallTime(epoch, formatter) {
  const parts=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(({type,value})=>[type,value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function localDateTimeCandidates(value, timezone) {
  if (!LOCAL.test(value)) throw new Error('INVALID_LOCAL_TIME');
  const normalized=value.length===16?value+':00':value;
  const nominal=Date.parse(normalized+'Z');
  if (!Number.isFinite(nominal)||new Date(nominal).toISOString().slice(0,19)!==normalized) throw new Error('INVALID_LOCAL_TIME');
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const offsets=new Set();
  for (let hour=-48;hour<=48;hour+=3) {
    const sampled=nominal+hour*3600000;
    offsets.add(Date.parse(wallTime(sampled,formatter)+'Z')-sampled);
  }
  return [...offsets].map((offset)=>nominal-offset).filter((epoch)=>wallTime(epoch,formatter)===normalized).sort((a,b)=>a-b).map((epoch)=>new Date(epoch).toISOString());
}
export function resolveClubTimestamp(value, timezone) {
  if (typeof value!=='string') throw new Error('INVALID_LOCAL_TIME');
  if (!LOCAL.test(value)) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))) throw new Error('INVALID_LOCAL_TIME');
    const wall=value.replace(/(?:Z|[+-]\d{2}:\d{2})$/,'').split('.')[0];
    const normalized=wall.length===16?wall+':00':wall;
    if(new Date(normalized+'Z').toISOString().slice(0,19)!==normalized)throw new Error('INVALID_LOCAL_TIME');
    return new Date(value).toISOString();
  }
  const candidates=localDateTimeCandidates(value,timezone);
  if (candidates.length===0) throw new Error('NONEXISTENT_LOCAL_TIME');
  if (candidates.length!==1) throw new Error('AMBIGUOUS_LOCAL_TIME');
  return candidates[0];
}
