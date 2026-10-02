import {type NextRequest} from 'next/server';
import {updateSupabaseSession} from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const {response} = await updateSupabaseSession(request);
  return response;
}

// De onveranderde demo-root en de publieke loginroute blijven ook zonder
// Supabase-configuratie bekijkbaar. Alleen echte dossierwerkruimtes verversen
// een sessiecookie via de geconfigureerde Supabase-omgeving.
export const config = {matcher: ['/c/:path*', '/workspaces', '/invite/:path*']};
