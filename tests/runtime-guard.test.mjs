import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const appConfiguration = {
  APP_URL: 'https://staging.cluvo.example',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_contract_test',
  SUPABASE_SECRET_KEY: 'sb_secret_contract_test',
  INVITATION_TOKEN_SECRET: 'contract-test-secret-with-32-bytes-minimum',
};
const run = (environment, mode = 'prototype', extra = {}) => {
  const env = {...process.env, APP_MODE: mode, ...extra};
  if (environment === undefined) delete env.APP_ENV;
  else env.APP_ENV = environment;
  return spawnSync(
    process.execPath,
    ['scripts/runtime-guard.mjs'],
    {env, encoding: 'utf8'},
  );
};

test('production wordt voor serverstart geweigerd, ook met geldige appconfiguratie', () => {
  const result = run('production', 'app', appConfiguration);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /production blijft geblokkeerd/);
});

test('appmodus vereist volledige expliciete serverconfiguratie', () => {
  const missingEnvironment = run(undefined, 'app', appConfiguration);
  assert.notEqual(missingEnvironment.status, 0);
  assert.match(missingEnvironment.stderr, /vereist een expliciete APP_ENV/);

  const missing = run('staging', 'app', {
    APP_URL: '',
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    INVITATION_TOKEN_SECRET: '',
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /mist verplichte serverconfiguratie/);
  assert.equal(run('staging', 'app', appConfiguration).status, 0);
});

test('alleen bekende omgevingen en modi worden geaccepteerd', () => {
  assert.equal(run(undefined).status, 0);
  for (const environment of ['local', 'staging', 'test']) {
    assert.equal(run(environment).status, 0);
  }
  assert.notEqual(run('unknown').status, 0);
  assert.notEqual(run('staging', 'unknown').status, 0);
});
