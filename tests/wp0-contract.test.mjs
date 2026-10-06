import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(join(root, path), 'utf8');
const dockerDigest = 'sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6';

test('Docker gebruikt uitsluitend de gepinde Node-basis en draait non-root', async () => {
  const dockerfile = await read('Dockerfile');
  const fromLines = dockerfile.match(/^FROM .+$/gm) ?? [];
  assert.deepEqual(
    fromLines,
    ['deps', 'build', 'runner'].map(
      (stage) => `FROM node:24-bookworm-slim@${dockerDigest} AS ${stage}`,
    ),
  );
  assert.match(dockerfile, /^USER node$/m);
  assert.match(
    dockerfile,
    /^CMD \["node","--import","\.\/scripts\/runtime-guard\.mjs","server\.js"\]$/m,
  );
});

test('CI voert de reproduceerbare WP0-poorten in de juiste volgorde uit', async () => {
  const [workflow, nodeVersion] = await Promise.all([
    read('.github/workflows/ci.yml'),
    read('.nvmrc'),
  ]);
  assert.match(workflow, /pull_request:\n\s+branches: \[main\]/);
  assert.match(workflow, /node-version-file: '\.nvmrc'/);
  assert.equal(nodeVersion.trim(), '24.19.0');

  const commands = [
    'npm ci --no-audit --no-fund',
    'npm run lint',
    'npm run typecheck',
    'npm test',
    'npm run build',
    'npm run test:wp0',
  ];
  let previous = -1;
  for (const command of commands) {
    const index = workflow.indexOf(`run: ${command}`);
    assert.ok(index > previous, `${command} ontbreekt of staat in de verkeerde volgorde`);
    previous = index;
  }
  assert.doesNotMatch(workflow, /production|service_role|SUPABASE_SECRET_KEY/i);
});

test('CI en staging herhalen database-, race-, lock- en lintpoorten', async () => {
  const [ci, staging, packageJson] = await Promise.all([
    read('.github/workflows/ci.yml'),
    read('.github/workflows/staging.yml'),
    read('package.json').then(JSON.parse),
  ]);
  for (const workflow of [ci, staging]) {
    assert.match(workflow, /supabase test db --local/);
    assert.match(workflow, /npm run db:test:race/);
    assert.match(workflow, /npm run db:test:locks/);
    assert.match(workflow, /npm run db:test:invitations/);
    assert.match(workflow, /npm run db:test:reconfirmation/);
    assert.match(workflow, /supabase db lint --local --schema app,api,internal/);
  }
  assert.equal(packageJson.scripts['db:test:race'], 'node scripts/db-concurrency-a13.mjs');
  assert.equal(packageJson.scripts['db:test:locks'], 'node scripts/db-concurrency-season-lock.mjs');
  assert.equal(packageJson.scripts['db:test:invitations'], 'node scripts/db-concurrency-invitations.mjs && node scripts/db-concurrency-invitation-lifecycle.mjs');
  assert.equal(packageJson.scripts['db:test:reconfirmation'], 'node scripts/db-concurrency-intake-reconfirmation.mjs');
});

test('runtime en instrumentation blokkeren production en bewaken geconfigureerde appmodus', async () => {
  const [guard, instrumentation] = await Promise.all([
    read('scripts/runtime-guard.mjs'),
    read('instrumentation.ts'),
  ]);
  for (const source of [guard, instrumentation]) {
    assert.match(source, /APP_ENV/);
    assert.match(source, /production/);
    assert.match(source, /APP_MODE/);
    assert.match(source, /prototype/);
    assert.match(source, /app/);
    assert.match(source, /throw new Error/);
  }
  assert.match(guard, /\['local', 'staging', 'test'\]/);
  assert.match(guard, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(guard, /SUPABASE_SECRET_KEY/);
});

test('er bestaat geen actieve productieworkflow en de template weigert altijd', async () => {
  const workflowFiles = await readdir(join(root, '.github', 'workflows'));
  assert.ok(workflowFiles.includes('ci.yml'));
  assert.ok(workflowFiles.includes('staging.yml'));
  assert.equal(
    workflowFiles.some((file) => /prod|promot/i.test(file)),
    false,
    'Een productieworkflow mag pas na expliciete V1-acceptatie actief worden',
  );
  for (const file of workflowFiles) {
    const executableWorkflow = (await read(`.github/workflows/${file}`))
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    assert.doesNotMatch(
      executableWorkflow,
      /environment:\s*production|APP_ENV:\s*production|cluvo-production|promote-production/i,
    );
  }

  const [template, readiness] = await Promise.all([
    read('ops/templates/promote-production.yml.disabled'),
    read('release/readiness.json').then(JSON.parse),
  ]);
  assert.match(template, /exit 1/);
  assert.equal(readiness.v1_ready, false);
  assert.equal(readiness.production_enabled, false);
});
