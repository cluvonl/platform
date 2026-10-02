const configuredEnvironment = process.env.APP_ENV;
const mode = process.env.APP_MODE || 'prototype';
const environment = configuredEnvironment || 'local';

if (environment === 'production') {
  throw new Error('Cluvo V1 is niet vrijgegeven: production blijft geblokkeerd.');
}
if (mode === 'app' && !configuredEnvironment) {
  throw new Error('Appmodus vereist een expliciete APP_ENV.');
}
if (!['local', 'staging', 'test'].includes(environment)) {
  throw new Error('Onbekende Cluvo-omgeving.');
}
if (!['prototype', 'app'].includes(mode)) {
  throw new Error('Onbekende Cluvo-appmodus.');
}

if (mode === 'app') {
  const required = [
    'APP_URL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
    'INVITATION_TOKEN_SECRET',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Appmodus mist verplichte serverconfiguratie: ${missing.join(', ')}.`);
  }

  const appUrl = new URL(process.env.APP_URL);
  const supabaseUrl = new URL(process.env.SUPABASE_URL);
  if (appUrl.username || appUrl.password || appUrl.pathname !== '/' || appUrl.search || appUrl.hash) {
    throw new Error('APP_URL moet uitsluitend de publieke origin bevatten.');
  }
  if (environment !== 'local' && appUrl.protocol !== 'https:') {
    throw new Error('APP_URL moet buiten lokaal gebruik HTTPS gebruiken.');
  }
  if (!['http:', 'https:'].includes(supabaseUrl.protocol)) {
    throw new Error('Ongeldige Supabase-URL.');
  }
  if (!process.env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    throw new Error('Appmodus vereist een Supabase publishable key.');
  }
  if (!process.env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) {
    throw new Error('Appmodus vereist een server-side Supabase secret key.');
  }
  if (Buffer.byteLength(process.env.INVITATION_TOKEN_SECRET, 'utf8') < 32) {
    throw new Error('Appmodus vereist een uitnodigingsgeheim van minimaal 32 bytes.');
  }
}
