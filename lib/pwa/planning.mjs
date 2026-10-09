const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId=(value)=>typeof value==='string'&&uuid.test(value);
const validTime=(value)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const error=()=>new Error('De commissieplanning kan nu niet veilig worden geladen. Probeer het opnieuw.');

/** Native RLS and the RPC authorize newly discovered draft IDs. Whitelist the
 * projection and bind every returned row to the exact selected native context.
 * @returns {import('../../components/mobile/types').MobilePlanningTask[]}
 */
export function projectCommitteePlanning(rows,tenantId,seasonId) {
  if(!validId(tenantId)||!validId(seasonId)||!Array.isArray(rows))throw error();
  const seen=new Set();
  return rows.map((row)=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||row.tenant_id!==tenantId||row.season_id!==seasonId||!validId(row.id)||!validId(row.committee_id)||!Number.isSafeInteger(row.version)||row.version<1||!['draft','published'].includes(row.state)||typeof row.title!=='string'||!row.title.trim()||typeof row.committee_name!=='string'||typeof row.category_name!=='string'||!validTime(row.starts_at)||!validTime(row.ends_at)||Date.parse(row.ends_at)<=Date.parse(row.starts_at)||!Number.isSafeInteger(row.credit_minutes)||row.credit_minutes<0||!Number.isSafeInteger(row.position_count)||row.position_count<0||seen.has(row.id))throw error();
    seen.add(row.id);
    return {id:row.id,version:row.version,state:row.state,committeeId:row.committee_id,committeeName:row.committee_name,category:row.category_name,title:row.title,startsAt:row.starts_at,endsAt:row.ends_at,location:typeof row.location_name==='string'?row.location_name:'',minutes:row.credit_minutes,positions:row.position_count};
  });
}

export async function loadCommitteePlanning(client,tenantId,seasonId) {
  if(!validId(tenantId)||seasonId!==null&&!validId(seasonId))throw error();
  if(seasonId===null)return [];
  const {data,error:providerError}=await client.schema('api').rpc('pwa_committee_planning',{p_tenant_id:tenantId,p_season_id:seasonId});
  if(providerError)throw error();
  return projectCommitteePlanning(data,tenantId,seasonId);
}
