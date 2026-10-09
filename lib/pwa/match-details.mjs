const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text=(value)=>typeof value==='string'&&value.trim()?value.trim():undefined;

// The native view enforces the current actor's RLS. Its response may enrich
// only the same tenant, team, ID and version already present in the snapshot.
export function mergeScopedMatchDetails(snapshotMatches,nativeMatches,tenantId) {
  return snapshotMatches.map((match)=>{
    const candidates=nativeMatches.filter((row)=>row.id===match.id&&row.tenant_id===tenantId&&row.team_id===match.team_id&&row.version===match.version);
    const detail=candidates.length===1?candidates[0]:null;
    return {...match,field_name:text(detail?.field_name),locker_room_text:text(detail?.locker_room_text)};
  });
}

export async function loadScopedMatchDetails(client,tenantId,snapshotMatches) {
  if(!snapshotMatches.length)return [];
  if(typeof tenantId!=='string'||!uuid.test(tenantId)||snapshotMatches.some((match)=>typeof match.id!=='string'||!uuid.test(match.id)))throw new Error('De wedstrijdgegevens kunnen nu niet veilig worden geladen.');
  const ids=[...new Set(snapshotMatches.map((match)=>match.id))];
  const {data,error}=await client.schema('api').from('my_matches').select('id,tenant_id,team_id,version,field_name,locker_room_text').eq('tenant_id',tenantId).in('id',ids);
  if(error||!Array.isArray(data)||data.some((row)=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('De wedstrijdgegevens kunnen nu niet veilig worden geladen. Probeer het opnieuw.');
  return mergeScopedMatchDetails(snapshotMatches,data,tenantId);
}
