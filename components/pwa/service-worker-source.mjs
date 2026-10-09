/** Public worker source; the release is deployment metadata, never identity. */
export function createServiceWorkerSource(release) {
  const version = /^[a-f0-9]{40}$/.test(release) ? release : 'local';
  return `'use strict';
const CACHE_PREFIX = 'cluvo-app-assets-';
const CACHE = CACHE_PREFIX + ${JSON.stringify(version)};
const PUBLIC_ASSETS = ['/app/offline.html', '/app/icons/icon-192.png', '/app/icons/icon-512.png', '/app/icons/icon-maskable-512.png', '/app/icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PUBLIC_ASSETS.map(async path => {
      const response = await fetch(path, {cache: 'reload', credentials: 'omit'});
      if (!response.ok || response.redirected) throw new Error('PUBLIC_ASSET_UNAVAILABLE');
      await cache.put(path, response);
    }));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/app/')) return;
  if (!url.search && PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(request)));
    return;
  }
  if (request.mode !== 'navigate') return;
  event.respondWith(fetch(request, {cache: 'no-store'}).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match('/app/offline.html')) || new Response('Geen verbinding. Open Cluvo opnieuw zodra je online bent.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}});
  }));
});
self.addEventListener('push', event => {
  let path = '/app/';
  try {
    const payload = event.data ? event.data.json() : {};
    const candidate = new URL(payload.path || '/app/', self.location.origin);
    if (candidate.origin === self.location.origin && candidate.pathname.startsWith('/app/') && !candidate.search && !candidate.hash && !candidate.username && !candidate.password) path = candidate.pathname;
  } catch { /* A generic notification never reveals untrusted payload text. */ }
  event.waitUntil(self.registration.showNotification('Cluvo', {
    body: 'Er staat een nieuwe melding voor je klaar. Open Cluvo om die veilig te bekijken.',
    icon: '/app/icons/icon-192.png', badge: '/app/icons/icon-192.png',
    data: {path},
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.path;
  let path = '/app/';
  try {
    const candidate = new URL(raw || '/app/', self.location.origin);
    if (candidate.origin === self.location.origin && candidate.pathname.startsWith('/app/') && !candidate.search && !candidate.hash && !candidate.username && !candidate.password) path = candidate.pathname;
  } catch { /* Fall back to the freshly authorized app entry. */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    const existing = windows.find(client => client.url.startsWith(self.location.origin + '/app/'));
    if (existing) {await existing.navigate(path); await existing.focus();}
    else await self.clients.openWindow(path);
  })());
});
`;
}
