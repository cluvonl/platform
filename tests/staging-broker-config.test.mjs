import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const source = await readFile(new URL('../ops/cluvo-deploy-staging', import.meta.url), 'utf8');
const blocks = [...source.matchAll(/<<'PY'\n([\s\S]*?)\nPY/g)].map((match) => match[1]);
const configuration = blocks.find((body) => body.includes('config_path, env_path, image, run_id, current_path'));
const health = blocks.find((body) => body.includes('http://127.0.0.1:3100/api/health/live'));
assert.ok(configuration && health, 'test the executable broker fragments');
const previousSha = 'a'.repeat(40), sha = 'b'.repeat(40);
const image = 'ghcr.io/cluvonl/platform@sha256:' + 'c'.repeat(64);
const project = 'abcdefghijklmnopqrst';
const baseConfig = {image_repository:'ghcr.io/cluvonl/platform', app_url:'https://staging.cluvo.example', supabase_url:''};
const baseEnvironment = {APP_ENV:'staging', APP_MODE:'prototype', APP_URL:baseConfig.app_url};
const appConfig = {...baseConfig, app_mode:'app', supabase_project_ref:project,
  supabase_url:`https://${project}.supabase.co`, compatible_rollback_shas:[previousSha]};
const appEnvironment = {...baseEnvironment, APP_MODE:'app', SUPABASE_URL:appConfig.supabase_url,
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_contract_test', SUPABASE_SECRET_KEY:'sb_secret_contract_test',
  INVITATION_TOKEN_SECRET:'not-a-secret-contract-test-32-bytes', MAIL_ALLOWLIST:'reviewer@cluvo.example'};

async function validate(config, environment, previous = {workflow_run_id:'1', source_sha:previousSha, mode:'app'}, selectedImage = image, runId = '2') {
  const directory = await mkdtemp(join(tmpdir(), 'cluvo-broker-contract-'));
  try {
    const configPath = join(directory, 'target.json'), envPath = join(directory, 'runtime.env'), currentPath = join(directory, 'current.json');
    await writeFile(configPath, JSON.stringify(config));
    await writeFile(envPath, Object.entries(environment).map(([key, value]) => `${key}=${value}`).join('\n'), {mode:0o600});
    await writeFile(currentPath, JSON.stringify(previous));
    return spawnSync('python3', ['-', configPath, envPath, selectedImage, runId, currentPath], {input:configuration, encoding:'utf8'});
  } finally {await rm(directory, {recursive:true, force:true});}
}

test('the existing prototype target keeps working and app mode needs an explicit root target', async () => {
  const prototype = await validate(baseConfig, baseEnvironment);
  assert.equal(prototype.status, 0);
  assert.equal(prototype.stdout.trim(), 'prototype');
  const implicit = await validate(baseConfig, appEnvironment);
  assert.notEqual(implicit.status, 0);
  const app = await validate(appConfig, appEnvironment);
  assert.equal(app.status, 0);
  assert.equal(app.stdout.trim(), 'app', 'only the validated mode is printed');
  const firstApp = await validate({...appConfig, compatible_rollback_shas:[]}, appEnvironment,
    {workflow_run_id:'1', source_sha:previousSha, mode:'prototype'});
  assert.notEqual(firstApp.status, 0, 'restoring prototype mode does not restore the previous runtime credentials');
  assert.equal((await validate(appConfig, appEnvironment,
    {workflow_run_id:'1', source_sha:previousSha, mode:'prototype'})).status, 0);
});

test('production, foreign project, missing secrets and an unexpected origin fail without printing values', async () => {
  for (const change of [{APP_ENV:'production'}, {SUPABASE_URL:'https://foreign.supabase.co'},
    {SUPABASE_SECRET_KEY:'not-a-real-key'}, {SUPABASE_PUBLISHABLE_KEY:'not-a-real-key'},
    {INVITATION_TOKEN_SECRET:'short'}, {APP_URL:'https://production.cluvo.example'}]) {
    const result = await validate(appConfig, {...appEnvironment, ...change});
    assert.notEqual(result.status, 0);
    assert.ok(!result.stdout.includes(appEnvironment.INVITATION_TOKEN_SECRET));
    assert.ok(!result.stderr.includes(appEnvironment.INVITATION_TOKEN_SECRET));
  }
  const wrongPin = await validate({...appConfig, supabase_project_ref:'z'.repeat(20)}, appEnvironment);
  assert.notEqual(wrongPin.status, 0);
});

test('wildcard/empty mail allowlists and an unapproved rollback image are refused', async () => {
  for (const MAIL_ALLOWLIST of ['', '*@cluvo.example', '*']) {
    assert.notEqual((await validate(appConfig, {...appEnvironment, MAIL_ALLOWLIST})).status, 0);
  }
  for (const compatible_rollback_shas of [[], previousSha, ['wrong-sha']]) {
    assert.notEqual((await validate({...appConfig, compatible_rollback_shas}, appEnvironment)).status, 0);
  }
});

test('repository pinning and monotonic run order remain required', async () => {
  assert.notEqual((await validate(appConfig, appEnvironment, undefined, 'ghcr.io/other/project@sha256:' + 'c'.repeat(64))).status, 0);
  for (const runId of ['1', '0']) assert.notEqual((await validate(appConfig, appEnvironment, undefined, image, runId)).status, 0);
});

function checkHealth(mode, liveChanges = {}, readyChanges = {}) {
  const live = {status:'ok', environment:'staging', mode, release:sha, ...liveChanges};
  const ready = {ready:true, release_ready:false, scope:'authenticated_core',
    checks:{database:'reachable', authorization:'rls_api', workers:'not_required_for_core'}, ...readyChanges};
  const injection = `\nresponses = ${JSON.stringify(JSON.stringify([live, ready]))}\nresponses = json.loads(responses)\ncalls = []\nclass FakeResponse:\n    def __init__(self, value): self.value = value\n    def __enter__(self): return self\n    def __exit__(self, *args): return False\n    def read(self): return json.dumps(self.value)\ndef fake_open(url, timeout):\n    expected = ["http://127.0.0.1:3100/api/health/live", "http://127.0.0.1:3100/api/health/ready"]\n    assert url == expected[len(calls)]\n    calls.append(url)\n    return FakeResponse(responses[len(calls)-1])\nurllib.request.urlopen = fake_open\n`;
  const actual = health.replace('import urllib.request\n', 'import urllib.request\n' + injection);
  return spawnSync('python3', ['-', sha, mode], {input:actual, encoding:'utf8'});
}

test('health verifies the exact SHA, environment and selected mode', () => {
  assert.equal(checkHealth('prototype').status, 0);
  assert.equal(checkHealth('app').status, 0);
  for (const change of [{release:previousSha}, {environment:'production'}, {mode:'prototype'}, {status:'failed'}]) {
    assert.notEqual(checkHealth('app', change).status, 0);
  }
});

test('app health cannot pass with missing database/RLS readiness or a release-ready claim', () => {
  for (const change of [{ready:false}, {release_ready:true}, {scope:'full_v1'},
    {checks:{database:'unavailable', authorization:'rls_api'}}, {checks:{database:'reachable', authorization:'demo_only'}}]) {
    assert.notEqual(checkHealth('app', {}, change).status, 0);
  }
});

test('failed transitions restore the recorded image and mode and verify recovery through health', () => {
  const recovery = source.match(/recover\(\) \{\n([\s\S]*?)\n\}\n\ntrap recover ERR/)?.[1];
  assert.ok(recovery);
  for (const previousMode of ['prototype', 'app']) {
    for (const verified of [true, false]) {
      const program = `previous_image='${image}'\nprevious_sha='${previousSha}'\nprevious_mode='${previousMode}'\nselected_mode='app'\nimage='${image}'\nsha='${sha}'\ndocker_runtime() { :; }\ncompose_runtime() { printf 'COMPOSE:%s\\n' "$3"; }\nverify_health() { printf 'HEALTH:%s:%s\\n' "$1" "$2"; test '${verified}' = 'true'; }\nrecover() {\n${recovery}\n}\nrecover\n`;
      const result = spawnSync('bash', ['-s'], {input:program, encoding:'utf8'});
      assert.equal(result.status, 1, 'the failed deployment remains failed even after recovery');
      assert.match(result.stdout, new RegExp(`COMPOSE:${previousMode}`));
      assert.match(result.stdout, new RegExp(`HEALTH:${previousSha}:${previousMode}`));
      if (verified) assert.match(result.stderr, /Vorige image en modus zijn via health teruggelezen/);
      else assert.match(result.stderr, /Herstel is niet bevestigd; operatoractie vereist/);
    }
  }
});
