import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {supabaseAdminConfig} from './config';

export function createSupabaseAdminClient() {
  const {url, secretKey} = supabaseAdminConfig();
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
