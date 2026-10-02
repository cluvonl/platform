import { once } from 'node:events';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guard = join(root, 'scripts', 'runtime-guard.mjs');
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const buildId = join(root, '.next', 'BUILD_ID');
const release = 'wp0-smoke';
const startupTimeoutMs = 30_000;
const requestTimeoutMs = 3_000;

let child;
let stopping;

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function freePort() {
  const server = createServer();
  server.unref();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Kon geen vrije lokale TCP-poort reserveren.');
  }
  const port = address.port;
  server.close();
  await once(server, 'close');
  return port;
}

async function command() {
  const standaloneCandidates = [
    {
      server: join(root, 'server.js'),
      build: join(root, '.next', 'BUILD_ID'),
    },
    {
      server: join(root, '.next', 'standalone', 'server.js'),
      build: join(root, '.next', 'standalone', '.next', 'BUILD_ID'),
    },
  ];
  for (const candidate of standaloneCandidates) {
    if ((await exists(candidate.server)) && (await exists(candidate.build))) {
      return {
        label: 'Next.js standalone server',
        args: ['--import', guard, candidate.server],
        buildId: candidate.build,
      };
    }
  }

  if ((await exists(buildId)) && (await exists(nextBin))) {
    return {
      label: 'Next.js production server',
      args: ['--import', guard, nextBin, 'start'],
      buildId,
    };
  }

  throw new Error(
    'Geen gebouwde Next.js-app gevonden. Voer eerst `npm run build` uit.',
  );
}

function appendLog(buffer, chunk) {
  buffer.push(String(chunk));
  if (buffer.join('').length > 20_000) buffer.shift();
}

function childExit(childProcess) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return Promise.resolve({
      code: childProcess.exitCode,
      signal: childProcess.signalCode,
    });
  }
  return new Promise((resolveExit, rejectExit) => {
    childProcess.once('error', rejectExit);
    childProcess.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}

async function stopServer() {
  if (stopping) return stopping;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  stopping = (async () => {
    const exited = childExit(child);
    child.kill('SIGTERM');
    let timeout;
    const gracePeriod = new Promise((resolveTimeout) => {
      timeout = setTimeout(() => resolveTimeout(null), 5_000);
    });
    const result = await Promise.race([exited, gracePeriod]);
    clearTimeout(timeout);
    if (result === null && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await childExit(child);
    }
  })();

  return stopping;
}

async function get(path) {
  return fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers: { Connection: 'close' },
    redirect: 'manual',
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
}

async function waitUntilLive(exitPromise, logs) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    const outcome = await Promise.race([
      get('/api/health/live')
        .then((response) => ({ response }))
        .catch(() => ({ response: null })),
      exitPromise.then((exit) => ({ exit })),
    ]);

    if ('exit' in outcome) {
      throw new Error(
        `Server stopte tijdens opstarten (${JSON.stringify(outcome.exit)}).\n${logs.join('')}`,
      );
    }
    if (outcome.response?.status === 200) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`Server werd niet tijdig gereed.\n${logs.join('')}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectJson(path, status, validate) {
  const response = await get(path);
  assert(response.status === status, `${path}: verwacht HTTP ${status}, kreeg ${response.status}`);
  assert(
    response.headers.get('cache-control')?.includes('no-store'),
    `${path}: Cache-Control moet no-store bevatten`,
  );
  const body = await response.json();
  validate(body);
}

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const logs = [];
const selected = await command();
const env = {
  ...process.env,
  APP_ENV: 'staging',
  APP_MODE: 'prototype',
  APP_URL: baseUrl,
  HOSTNAME: '127.0.0.1',
  NODE_ENV: 'production',
  PORT: String(port),
  RELEASE_SHA: release,
  BACKUP_DATABASE_URL: '',
  MIGRATION_DATABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
  SUPABASE_SECRET_KEY: '',
  SUPABASE_URL: '',
};

const signals = ['SIGINT', 'SIGTERM'];
const signalHandlers = new Map();
for (const signal of signals) {
  const handler = () => {
    void stopServer().finally(() => process.exit(128 + (signal === 'SIGINT' ? 2 : 15)));
  };
  signalHandlers.set(signal, handler);
  process.once(signal, handler);
}

try {
  child = spawn(process.execPath, selected.args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => appendLog(logs, chunk));
  child.stderr.on('data', (chunk) => appendLog(logs, chunk));
  const exitPromise = childExit(child);

  await waitUntilLive(exitPromise, logs);

  const rootResponse = await get('/');
  assert(rootResponse.status === 200, `/: verwacht HTTP 200, kreeg ${rootResponse.status}`);
  assert(
    rootResponse.headers.get('content-type')?.includes('text/html'),
    '/: verwacht een HTML-respons',
  );
  assert(
    rootResponse.headers.get('x-robots-tag') === 'noindex, nofollow',
    '/: de noindex-productbescherming ontbreekt',
  );
  assert((await rootResponse.text()).includes('Cluvo'), '/: de Cluvo-shell ontbreekt');

  await expectJson('/api/health/live', 200, (body) => {
    assert(body.status === 'ok', 'live: status is niet ok');
    assert(body.service === 'cluvo', 'live: onverwachte service');
    assert(body.environment === 'staging', 'live: onverwachte omgeving');
    assert(body.mode === 'prototype', 'live: onverwachte appmodus');
    assert(body.release === release, 'live: onverwachte release-SHA');
  });

  await expectJson('/api/health/ready', 503, (body) => {
    assert(body.ready === false, 'ready: prototype mag niet gereed melden');
    assert(
      body.reason === 'APP_MODE_PROTOTYPE',
      'ready: de expliciete prototypeblokkade ontbreekt',
    );
  });

  await expectJson('/api/runtime-config', 503, (body) => {
    assert(
      body.error === 'SUPABASE_NOT_CONFIGURED',
      'runtime-config: ontbrekende configuratie moet expliciet worden geweigerd',
    );
  });

  // Lees het build-ID zodat een ontbrekende of halfgeschreven build niet stilzwijgend slaagt.
  assert(
    (await readFile(selected.buildId, 'utf8')).trim().length > 0,
    'Het Next.js build-ID ontbreekt.',
  );
  console.log(`WP0-smoke geslaagd via ${selected.label} op ${baseUrl}.`);
} finally {
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
  await stopServer();
}
