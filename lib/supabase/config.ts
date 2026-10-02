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

export function supabaseAdminConfig() {
  const {url} = supabasePublicConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey || !secretKey.startsWith('sb_secret_')) {
    throw new Error('Configureer uitsluitend een server-side Supabase secret key voor beheeracties.');
  }
  return {url, secretKey};
}

export function invitationTokenSecret() {
  const secret = process.env.INVITATION_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Configureer een afzonderlijk uitnodigingsgeheim van minimaal 32 bytes.');
  }
  return secret;
}

export function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error('Configureer APP_URL voor deze omgeving.');
  const url = new URL(value);
  const environment = process.env.APP_ENV ?? 'local';
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('APP_URL moet uitsluitend de publieke origin bevatten.');
  }
  if (url.protocol !== 'https:' && !(environment === 'local' && url.protocol === 'http:')) {
    throw new Error('APP_URL moet buiten lokaal gebruik HTTPS gebruiken.');
  }
  return url.origin;
}
