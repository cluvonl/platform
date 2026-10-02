import {supabasePublicConfig} from '@/lib/supabase/config';
export const dynamic='force-dynamic';
export async function GET() {
  try { return Response.json(supabasePublicConfig(),{headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'SUPABASE_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
