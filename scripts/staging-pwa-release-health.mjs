const ORIGIN='https://staging.cluvo.nl';

// Provider work must follow the active image, including during promotion or
// an application rollback. These public probes never receive GitHub tokens.
export async function activeStagingRelease(release,fetcher=fetch) {
  if(!/^[0-9a-f]{40}$/.test(release??''))return false;
  const request=async path=>{
    const response=await fetcher(ORIGIN+path,{
      headers:{Accept:'application/json'},cache:'no-store',redirect:'error',
      signal:AbortSignal.timeout(15000),
    });
    if(response.status!==200)return null;
    return response.json();
  };
  const matches=live=>live?.status==='ok'&&live.service==='cluvo'
    &&live.mode==='app'&&live.environment==='staging'&&live.release===release;
  try {
    if(!matches(await request('/api/health/live')))return false;
    const ready=await request('/api/health/ready');
    if(ready?.ready!==true||ready.scope!=='authenticated_core'
      ||ready.checks?.database!=='reachable'||ready.checks?.authorization!=='rls_api')return false;
    return matches(await request('/api/health/live'));
  } catch {return false;}
}
