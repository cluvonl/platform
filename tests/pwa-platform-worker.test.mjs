import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createServiceWorkerSource} from '../components/pwa/service-worker-source.mjs';

const origin = 'https://staging.example.invalid';
const release = 'a'.repeat(40);
const cacheName = `cluvo-app-assets-${release}`;
const publicPaths = ['/app/offline.html', '/app/icons/icon-192.png', '/app/icons/icon-512.png', '/app/icons/icon-maskable-512.png', '/app/icons/apple-touch-icon.png'];

function harness({networkFails = false, initialCaches = [], windows = []} = {}) {
  const listeners = new Map(), storage = new Map(initialCaches.map(name => [name, new Map()]));
  const calls = [], deletions = [], notifications = [], opened = [];
  let skipped = 0, claimed = 0;
  const normalize = input => new URL(typeof input === 'string' ? input : input.url, origin).href;
  const caches = {
    async open(name) {
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {async put(input, response) {entries.set(normalize(input), response.clone());},
        async match(input) {return entries.get(normalize(input))?.clone();}};
    },
    async keys() {return [...storage.keys()];},
    async delete(name) {deletions.push(name); return storage.delete(name);},
  };
  const self = {
    location: {origin},
    addEventListener(type, handler) {listeners.set(type, handler);},
    async skipWaiting() {skipped++;},
    registration: {async showNotification(title, options) {notifications.push({title, options: structuredClone(options)});}},
    clients: {async claim() {claimed++;}, async matchAll() {return windows;}, async openWindow(path) {opened.push(path);}},
  };
  runInNewContext(createServiceWorkerSource(release), {self, caches, URL, Response, fetch: async (request, options) => {
    const url = normalize(request);
    calls.push({url, options: structuredClone(options)});
    if (networkFails) throw new TypeError('synthetic network unavailable');
    return new Response(url.endsWith('/offline.html') ? 'public neutral offline page' : url.includes('/icons/') ? 'public icon' : 'SYNTHETIC_PRIVATE_HTML_CANARY', {headers: {'Content-Type': 'text/plain'}});
  }});
  return {listeners, storage, calls, deletions, notifications, opened, skipped: () => skipped, claimed: () => claimed,
    async lifecycle(type) {
      let pending;
      listeners.get(type)({waitUntil(promise) {pending = promise;}});
      await pending;
    },
    async request({path = '/app/c/synthetic/home', method = 'GET', mode = 'navigate', targetOrigin = origin} = {}) {
      let pending;
      listeners.get('fetch')({request: {url: `${targetOrigin}${path}`, method, mode}, respondWith(promise) {pending = promise;}});
      return pending ? await pending : null;
    }};
}

test('actual worker install stores only five public assets without account cookies and waits for explicit activation', async () => {
  const worker = harness();
  await worker.lifecycle('install');
  assert.deepEqual([...worker.storage.get(cacheName).keys()], publicPaths.map(path => origin + path));
  assert.equal(worker.calls.length, 5);
  for (const call of worker.calls) assert.deepEqual(call.options, {cache: 'reload', credentials: 'omit'});
  assert.equal(worker.skipped(), 0);
  worker.listeners.get('message')({data: {type: 'unrelated'}});
  assert.equal(worker.skipped(), 0);
  worker.listeners.get('message')({data: {type: 'ACTIVATE_UPDATE'}});
  assert.equal(worker.skipped(), 1);
});

test('actual push handler shows generic content and rejects foreign, token and credential destinations', async () => {
  for (const path of ['https://foreign.example.invalid/app/c/club/home', '/app/c/club/home?token=private',
    '/app/c/club/home#private', '//identity:secret@staging.example.invalid/app/c/club/home', '/c/club/home']) {
    const worker = harness();
    let pending;
    worker.listeners.get('push')({data: {json: () => ({path, title: 'PRIVATE_MEMBER_CANARY', body: 'PRIVATE_PERSON_CANARY'})}, waitUntil(value) {pending = value;}});
    await pending;
    assert.equal(worker.notifications[0].title, 'Cluvo');
    assert.equal(worker.notifications[0].options.data.path, '/app/');
    assert.equal(JSON.stringify(worker.notifications).includes('PRIVATE_'), false);
    assert.equal(worker.calls.length, 0);assert.equal(worker.storage.size, 0);
  }
  const worker = harness();let pending;
  worker.listeners.get('push')({data: {json: () => ({path: '/app/c/club/notifications'})}, waitUntil(value) {pending = value;}});
  await pending;assert.equal(worker.notifications[0].options.data.path, '/app/c/club/notifications');
});

test('notification click validates the destination again and opens only a freshly authorized app route', async () => {
  const visited = [];
  const worker = harness({windows: [{url: origin + '/app/c/club/home', async navigate(path) {visited.push(path);}, async focus() {visited.push('focus');}}]});
  let pending, closed = false;
  worker.listeners.get('notificationclick')({notification: {data: {path: '/app/c/club/notifications'}, close() {closed = true;}}, waitUntil(value) {pending = value;}});
  await pending;assert.equal(closed, true);assert.deepEqual(visited, ['/app/c/club/notifications', 'focus']);
  assert.equal(worker.opened.length, 0);
  const other = harness({windows: [{url: 'https://foreign.example.invalid/app/', async focus() {assert.fail('foreign client');}}]});
  other.listeners.get('notificationclick')({notification: {data: {path: 'https://foreign.example.invalid/app/'}, close() {}}, waitUntil(value) {pending = value;}});
  await pending;assert.deepEqual(other.opened, ['/app/']);
});

test('actual N to N+1 activation cleans only this app asset prefix and claims its scoped clients', async () => {
  const oldCache = `cluvo-app-assets-${'b'.repeat(40)}`;
  const worker = harness({initialCaches: ['another-app-cache', 'cluvo-prototype-v1', oldCache, cacheName]});
  await worker.lifecycle('activate');
  assert.deepEqual(worker.deletions, [oldCache]);
  assert.deepEqual([...worker.storage.keys()], ['another-app-cache', 'cluvo-prototype-v1', cacheName]);
  assert.equal(worker.claimed(), 1);
});

test('actual worker returns private online HTML without caching it and excludes RSC, API, POST and foreign origins', async () => {
  const worker = harness();
  await worker.lifecycle('install');
  assert.equal(await (await worker.request()).text(), 'SYNTHETIC_PRIVATE_HTML_CANARY');
  assert.deepEqual(worker.calls.at(-1).options, {cache: 'no-store'});
  assert.equal(worker.storage.get(cacheName).size, 5);
  for (const input of [
    {path: '/app/c/synthetic/home?_rsc=canary', mode: 'cors'},
    {path: '/app/c/synthetic/home', method: 'POST'},
    {path: '/app/c/synthetic/home', method: 'POST', mode: 'cors'},
    {path: '/api/runtime-config'}, {path: '/auth/confirm?token_hash=synthetic'},
    {path: '/app/c/synthetic/home', targetOrigin: 'https://foreign.example.invalid'},
    {path: '/app/icons/icon-192.png?token=synthetic', mode: 'cors'},
  ]) assert.equal(await worker.request(input), null);
  assert.equal(worker.calls.length, 6);
  assert.deepEqual([...worker.storage.get(cacheName).keys()], publicPaths.map(path => origin + path));
});

test('failed GET navigation shows only the neutral public offline page; failed POST is never acknowledged or queued', async () => {
  const worker = harness({networkFails: true});
  const cache = new Map([[origin + '/app/offline.html', new Response('neutral fallback')]]);
  worker.storage.set(cacheName, cache);
  const reply = await worker.request({path: '/app/invite/accept?token=synthetic-private-canary'});
  assert.equal(await reply.text(), 'neutral fallback');
  assert.equal(cache.size, 1);
  const before = worker.calls.length;
  assert.equal(await worker.request({method: 'POST'}), null);
  assert.equal(worker.calls.length, before);
});

test('worker release content changes for new release and cannot interpolate arbitrary source', () => {
  assert.notEqual(createServiceWorkerSource('a'.repeat(40)), createServiceWorkerSource('b'.repeat(40)));
  assert.equal(createServiceWorkerSource("');SYNTHETIC_INJECTION//"), createServiceWorkerSource('local'));
});

test('legacy root worker activation preserves other applications and mobile app caches', async () => {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const handlers = new Map(), removed = [];
  runInNewContext(source, {self: {addEventListener: (name, handler) => handlers.set(name, handler)}, caches: {
    async keys() {return ['cluvo-prototype-old', 'cluvo-prototype-v1', cacheName, 'other-app'];},
    async delete(name) {removed.push(name);},
  }});
  let pending;
  handlers.get('activate')({waitUntil(value) {pending = value;}});
  await pending;
  assert.deepEqual(removed, ['cluvo-prototype-old']);
});
