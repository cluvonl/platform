import {spawnSync} from 'node:child_process';

// Supabase start prints secret API keys in its status summary. Keep that output
// in memory; CI needs the exit status, never credentials or an environment dump.
console.log('Starting the isolated local Supabase test database.');
const result = spawnSync('npx', ['--no-install', 'supabase', 'start', '--exclude', 'studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
});
if (result.error || result.status !== 0) {
  console.error('Local Supabase startup failed. Sensitive CLI output is withheld; inspect the local containers through an authorized session.');
  process.exit(result.status || 1);
}
console.log('Local Supabase is running; credential status output was withheld.');
