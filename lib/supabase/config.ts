import 'server-only';
export function supabasePublicConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Configureer het Supabase-project voor deze omgeving.');
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Ongeldige Supabase-URL.');
  if (!key.startsWith('sb_publishable_')) throw new Error('Gebruik uitsluitend de publishable key in de publieke configuratie.');
  return {url, publishableKey:key};
}
