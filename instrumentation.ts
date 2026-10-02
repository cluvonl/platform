import {appOrigin, invitationTokenSecret, supabaseAdminConfig, supabasePublicConfig} from '@/lib/supabase/config';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const configuredEnvironment = process.env.APP_ENV;
    const mode = process.env.APP_MODE ?? 'prototype';
    const environment = configuredEnvironment ?? 'local';
    if (environment === 'production') throw new Error('Cluvo V1 is niet vrijgegeven: production blijft geblokkeerd.');
    if (mode === 'app' && !configuredEnvironment) throw new Error('Appmodus vereist een expliciete APP_ENV.');
    if (!['local', 'staging', 'test'].includes(environment)) throw new Error('Onbekende Cluvo-omgeving.');
    if (!['prototype', 'app'].includes(mode)) throw new Error('Onbekende Cluvo-appmodus.');
    if (mode === 'app') {
      supabasePublicConfig();
      supabaseAdminConfig();
      invitationTokenSecret();
      appOrigin();
    }
  }
}
