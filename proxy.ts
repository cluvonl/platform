import {type NextRequest} from 'next/server';
import {updateSupabaseSession} from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const {response} = await updateSupabaseSession(request);
  return response;
}

// Publieke PWA-assets blijven buiten sessieverversing. Iedere persoonlijke
// werkruimte controleert daarnaast de actuele rechten op de server.
export const config = {matcher: ['/c/:path*', '/workspaces', '/invite/:path*', '/app/workspaces', '/app/c/:path*', '/app/invite/:path*']};
