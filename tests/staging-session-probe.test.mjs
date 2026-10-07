import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile, lstat} from 'node:fs/promises';
import {SESSION_CHECKS, safeSessionResult, stagingSessionProbe, runSessionProbeCli} from '../scripts/staging-session-probe.mjs';

const project = 'fbozlbgmktkgcdfqdaaz', sha = 'a'.repeat(40);
function environment() {
  return {APP_ENV: 'staging', GITHUB_REPOSITORY: 'cluvonl/platform', GITHUB_REF: 'refs/heads/staging',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: sha, RELEASE_SHA: sha,
    STAGING_SUPABASE_PROJECT_REF: project, SUPABASE_URL: `https://${project}.supabase.co`,
    MIGRATION_DATABASE_URL: `postgresql://postgres.${project}:synthetic-password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    PGSERVICE: 'must-not-be-inherited', PGHOSTADDR: 'must-not-be-inherited',
    LD_PRELOAD: 'must-not-be-inherited', SECRET_EXTRA: 'must-not-be-inherited'};
}
function result() {
  return {passed: true, scope: 'HOSTED_TRANSPORT_ONLY', checks: [...SESSION_CHECKS],
    transport: {client_tls: true, client_tls_protocol: 'TLSv1.3', postgres_version: 170011,
      libpq_version: 160015, backend_identity_mode: 'session_sql_backend_and_lock', protocol_pid_matches_sql_backend: false},
    returned_sessions_closed: true, backup_created: false, restore_executed: false,
    snapshot_import_verified: false, catalog_data_compared: false, migration_ready: false,
    remote_ddl_ready: false, v1_ready: false, production_enabled: false};
}
const processResult = value => ({status: 0, stdout: JSON.stringify(value), stderr: ''});

test('29 Python identity and cleanup tests run with no credentials or database', () => {
  const run = spawnSync('/usr/bin/python3', ['-B', 'tests/helpers/staging-session-probe-tests.py'], {
    env: {PATH: '/usr/bin:/bin', LANG: 'C.UTF-8'}, encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /Ran 29 tests/);
  assert.match(run.stderr, /\bOK\b/);
});

test('the authentic Node process.env works with a bounded fake transport and excludes inherited secrets', () => {
  const bootstrapEnvironment = {...environment(), PATH: '/usr/bin:/bin', LANG: 'C.UTF-8'};
  // Install the fake inherited setting after Node starts: the OS loader itself
  // consumes LD_PRELOAD before any application can isolate a child environment.
  delete bootstrapEnvironment.LD_PRELOAD;
  const run = spawnSync(process.execPath, ['tests/helpers/staging-session-process-env.mjs'], {
    env: bootstrapEnvironment, encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), 'ACTUAL_PROCESS_ENV_TEST_PASS');
  assert.equal(run.stderr, '');
});

test('trusted source pins and isolated credential environment precede the owned process', async () => {
  let calls = 0;
  const report = await stagingSessionProbe(environment(), {execute: async (command, argv, options) => {
    calls++;
    assert.equal(command, '/usr/bin/python3');
    assert.equal(argv.length, 2);
    assert.equal(argv[0], '-B');
    assert.match(argv[1], /\/scripts\/staging_session_probe\.py$/);
    assert.equal(options.env.PGPASSWORD, 'synthetic-password');
    assert.equal(options.env.PGSSLMODE, 'verify-full');
    assert.equal(options.env.PGPORT, '5432');
    for (const name of ['PGSERVICE', 'PGHOSTADDR', 'LD_PRELOAD', 'SECRET_EXTRA', 'MIGRATION_DATABASE_URL']) {
      assert.equal(Object.hasOwn(options.env, name), false);
    }
    assert.equal(options.input, '');
    assert.equal(options.timeout, 180_000);
    return processResult(result());
  }});
  assert.equal(calls, 1);
  assert.equal(report.passed, true);
  assert.equal(report.source_sha, sha);
  assert.equal(report.migration_ready, false);
  assert.equal(report.target_mode, 'session_pooler');
  assert.equal(JSON.stringify(report).includes('synthetic-password'), false);
});

test('foreign repo, branch, event, source SHA and project never start a process', async () => {
  for (const change of [{APP_ENV: 'production'}, {GITHUB_REPOSITORY: 'foreign/platform'},
    {GITHUB_REF: 'refs/heads/main'}, {GITHUB_EVENT_NAME: 'push'}, {GITHUB_SHA: 'b'.repeat(40)},
    {RELEASE_SHA: 'latest'}, {STAGING_SUPABASE_PROJECT_REF: 'b'.repeat(20)},
    {SUPABASE_URL: 'https://foreign.supabase.co'},
    {MIGRATION_DATABASE_URL: environment().MIGRATION_DATABASE_URL.replace(':5432/', ':6543/')},
    {MIGRATION_DATABASE_URL: 'postgresql://postgres:synthetic-password@foreign.example.com/postgres'}]) {
    let calls = 0;
    const report = await stagingSessionProbe({...environment(), ...change}, {execute: async () => {calls++;}});
    assert.equal(report.passed, false);
    assert.equal(calls, 0);
  }
});

test('environment accessors do not run and caller mutation cannot change captured credentials', async () => {
  let getters = 0, calls = 0;
  const source = environment();
  Object.defineProperty(source, 'MIGRATION_DATABASE_URL', {get() {getters++; return 'private';}});
  const denied = await stagingSessionProbe(source, {execute: async () => {calls++;}});
  assert.equal(denied.passed, false);
  assert.equal(getters, 0);
  assert.equal(calls, 0);
  const mutable = environment();
  const report = await stagingSessionProbe(mutable, {
    read: async path => {mutable.MIGRATION_DATABASE_URL = 'private-changed-url'; return await readFile(path);},
    execute: async (_command, _args, options) => {
      assert.equal(options.env.PGPASSWORD, 'synthetic-password');
      return processResult(result());
    },
  });
  assert.equal(report.passed, true);
});

test('changed source or symlink input prevents execution', async () => {
  for (const options of [
    {read: async path => path.pathname.endsWith('staging_backup_session.py') ? Buffer.from('changed') : await readFile(path)},
    {stat: async path => path.pathname.endsWith('staging_session_probe.py')
      ? {isFile: () => true, isSymbolicLink: () => true} : await lstat(path)},
  ]) {
    let calls = 0;
    const report = await stagingSessionProbe(environment(), {...options, execute: async () => {calls++;}});
    assert.equal(report.passed, false);
    assert.equal(report.error, 'PINNED_SESSION_SOURCE_CHANGED');
    assert.equal(calls, 0);
  }
});

test('source changes after process completion invalidate the result', async () => {
  let ran = false;
  const report = await stagingSessionProbe(environment(), {
    read: async path => ran && path.pathname.endsWith('staging_backup_session.py') ? Buffer.from('changed') : await readFile(path),
    execute: async () => {ran = true; return processResult(result());},
  });
  assert.equal(report.passed, false);
  assert.equal(report.error, 'PINNED_SESSION_SOURCE_CHANGED');
});

test('stderr, nonzero, timeout, malformed and extra private process fields never become evidence', async () => {
  for (const outcome of [{status: 1, stdout: 'synthetic-private-body', stderr: ''},
    {status: 0, stdout: JSON.stringify(result()), stderr: 'synthetic-private-provider-error'},
    {status: null, error: true, stdout: '', stderr: ''},
    {status: 0, stdout: 'synthetic-private-body', stderr: ''},
    processResult({...result(), backend_pid: 123}),
    processResult({...result(), transport: {...result().transport, snapshot: 'private'}})]) {
    const report = await stagingSessionProbe(environment(), {execute: async () => outcome});
    assert.equal(report.passed, false);
    for (const text of ['synthetic-private', 'backend_pid', 'snapshot:']) assert.equal(JSON.stringify(report).includes(text), false);
  }
});

test('wrong route, missing checks, unsafe limits and unproved cleanup cannot pass', async () => {
  for (const changed of [{...result(), checks: SESSION_CHECKS.slice(0, -1)},
    {...result(), migration_ready: true}, {...result(), returned_sessions_closed: false},
    {...result(), transport: {...result().transport, client_tls: false}},
    {...result(), transport: {...result().transport, backend_identity_mode: 'direct_wire_sql_equal', protocol_pid_matches_sql_backend: true}}]) {
    const report = await stagingSessionProbe(environment(), {execute: async () => processResult(changed)});
    assert.equal(report.passed, false);
    assert.equal(report.migration_ready, false);
  }
});

test('partial safe failure retains only completed fixed checks and fixed error', () => {
  const failed = {...result(), passed: false, checks: SESSION_CHECKS.slice(0, 4),
    error: 'DATABASE_QUERY_FAILED', sqlstate: '42703'};
  assert.deepEqual(safeSessionResult(failed), failed);
  for (const changed of [{...failed, error: 'PRIVATE_ERROR'}, {...failed, sqlstate: 'private'},
    {...failed, sqlstate: 42703}, {...failed, sqlstate: {toString: () => '42703'}},
    {...failed, checks: [SESSION_CHECKS[2]]}]) assert.throws(() => safeSessionResult(changed), /PROBE_REPORT_INVALID/);
});

test('CLI writes only fixed exclusive 0600 report and small safe summary', async () => {
  let written;
  const logs = [];
  const outcome = await runSessionProbeCli(environment(), {
    execute: async () => processResult(result()),
    write: async (...args) => {written = args;}, log: value => logs.push(value),
  });
  assert.equal(outcome.exitCode, 0);
  assert.equal(written[0], 'staging-session-probe.json');
  assert.deepEqual(written[2], {flag: 'wx', mode: 0o600});
  assert.equal(logs.length, 1);
  assert.equal(JSON.parse(logs[0]).checks_passed, 14);
  assert.equal(JSON.stringify(written).includes('synthetic-password'), false);
});

test('CLI extra arguments and write failure never trigger unsafe diagnostics', async () => {
  let calls = 0;
  const logs = [];
  const denied = await runSessionProbeCli(environment(), {
    argv: ['unexpected'], execute: async () => {calls++;}, write: async () => {}, log: value => logs.push(value),
  });
  assert.equal(denied.exitCode, 1);
  assert.equal(calls, 0);
  const failed = await runSessionProbeCli(environment(), {
    execute: async () => processResult(result()),
    write: async () => {throw new Error('synthetic-private-write-failure');}, log: value => logs.push(value),
  });
  assert.equal(failed.exitCode, 1);
  assert.equal(logs.at(-1), 'STAGING_SESSION_PROBE_REPORT_UNAVAILABLE');
});
