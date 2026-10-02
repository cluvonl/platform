import {createClient} from '@supabase/supabase-js';
import {supabaseAdminConfig, supabasePublicConfig} from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = {'Cache-Control': 'no-store'};
  if ((process.env.APP_MODE ?? 'prototype') !== 'app') {
    return Response.json(
      {
        ready: false,
        release_ready: false,
        reason: 'APP_MODE_PROTOTYPE',
        checks: {database: 'not_connected', workers: 'not_started', authorization: 'demo_only'},
      },
      {status: 503, headers},
    );
  }

  try {
    const {url, publishableKey} = supabasePublicConfig();
    supabaseAdminConfig();
    const client = createClient(url, publishableKey, {
      auth: {autoRefreshToken: false, detectSessionInUrl: false, persistSession: false},
    });
    const {error} = await client.schema('api').from('public_tenants').select('tenant_id').limit(1);
    if (error) throw error;
    return Response.json(
      {
        ready: true,
        release_ready: false,
        scope: 'authenticated_core',
        checks: {database: 'reachable', workers: 'not_required_for_core', authorization: 'rls_api'},
      },
      {headers},
    );
  } catch {
    return Response.json(
      {
        ready: false,
        release_ready: false,
        reason: 'DEPENDENCY_UNAVAILABLE',
        checks: {database: 'unavailable', workers: 'unknown', authorization: 'unverified'},
      },
      {status: 503, headers},
    );
  }
}
