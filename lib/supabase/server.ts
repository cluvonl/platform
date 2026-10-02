import 'server-only';
import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {supabasePublicConfig} from './config';
export async function createSupabaseServerClient() {
  const {url,publishableKey} = supabasePublicConfig();
  const jar = await cookies();
  return createServerClient(url,publishableKey,{
    cookies:{
      getAll:()=>jar.getAll(),
      setAll: values=>{
        try { for (const {name,value,options} of values) jar.set(name,value,options); }
        catch { /* Alleen toegestaan in Server Components; session-refresh hoort in proxy.ts. */ }
      },
    },
  });
}
