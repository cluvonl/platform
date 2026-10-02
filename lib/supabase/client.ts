import {createBrowserClient} from '@supabase/ssr';
export type PublicSupabaseConfig={url:string;publishableKey:string};
// Config komt per request uit de server. Nooit een secret key of service_role doorgeven.
export function createSupabaseBrowserClient(config:PublicSupabaseConfig) {
  return createBrowserClient(config.url,config.publishableKey);
}
