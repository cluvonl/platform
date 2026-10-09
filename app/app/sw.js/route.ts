import {createServiceWorkerSource} from '@/components/pwa/service-worker-source.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(createServiceWorkerSource(process.env.RELEASE_SHA ?? 'local'), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/app/',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; connect-src 'self'",
    },
  });
}
