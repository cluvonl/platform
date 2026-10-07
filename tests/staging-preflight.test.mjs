import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseEnvironment, databaseTarget, stagingPreflight} from '../scripts/staging-preflight.mjs';

const ref = 'abcdefghijklmnopqrst';
const password = 'not-a-password:@/#';
const environment = {
  APP_ENV:'staging', RELEASE_SHA:'a'.repeat(40), STAGING_SUPABASE_PROJECT_REF:ref,
  SUPABASE_URL:`https://${ref}.supabase.co`, SUPABASE_PUBLISHABLE_KEY:'sb_publishable_contract_test',
  SUPABASE_SECRET_KEY:'sb_secret_contract_test', INVITATION_TOKEN_SECRET:'not-a-secret-contract-test-32-bytes',
  MIGRATION_DATABASE_URL:`postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`,
  SENDGRID_API_KEY:'SG.contract_test.not_a_real_key', SENDGRID_FROM_EMAIL:'info@cluvo.example', PATH:'/usr/bin:/bin',
};
const expectedMigrations = ['20261001000001', '20261001000002'];
const emptyDatabase = {postgres_version_num:170011, ssl_in_use:true, app_tables:0, forced_rls_tables:0,
  native_session_policies:0, api_definers:0, migration_table_exists:false, command_owner_restricted:false,
  native_session_policy_ddl_available:false, native_session_select_grantable:false, native_identity_select_grantable:false};

function fixtures({metadata = emptyDatabase, applied = '', fetchOverride, databaseOverride, connectionInfo = 'SSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384)'} = {}) {
  const requests = [], commands = [];
  const fetcher = async (url, options) => {
    requests.push({url, options});
    if (fetchOverride) {const response = await fetchOverride(url, options); if (response) return response;}
    assert.equal(options.redirect, 'error', 'no credential-bearing redirect');
    if (url.endsWith('/auth/v1/settings')) return {status:200, json:async () => ({external:{email:true}, autoconfirm:false})};
    if (url.includes('/rest/v1/')) return {status:200};
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(options.method, 'POST');
    assert.equal(JSON.parse(options.body).mail_settings.sandbox_mode.enable, true);
    return {status:200};
  };
  const execute = (command, args, options) => {
    commands.push({command, args, options});
    if (databaseOverride) return databaseOverride;
    if (options.input === '\\conninfo\n') return {status:0, stdout:connectionInfo, stderr:''};
    return {status:0, stdout:options.input.startsWith('select version') ? applied : JSON.stringify(metadata), stderr:''};
  };
  return {fetcher, execute, requests, commands, expectedMigrations};
}

test('secrets are checked without database writes or actual mail delivery; empty schema stays unready', async () => {
  const runtime = fixtures();
  const report = await stagingPreflight(environment, runtime);
  assert.equal(report.passed, true);
  assert.equal(report.app_deploy_ready, false);
  assert.equal(report.checks.database.pending_migrations, 2);
  assert.equal(report.checks.database.server_certificate_verified, false);
  assert.equal(report.checks.auth.smtp_configuration_verified, false);
  assert.equal(report.checks.sendgrid.actual_delivery_verified, false);
  assert.equal(report.database_mutations, false);
  assert.equal(report.email_sent, false);
  assert.equal(report.production_enabled, false);
  assert.equal(report.v1_ready, false);
  for (const secret of [password, environment.MIGRATION_DATABASE_URL, environment.SUPABASE_SECRET_KEY,
    environment.SENDGRID_API_KEY, environment.INVITATION_TOKEN_SECRET]) assert.ok(!JSON.stringify(report).includes(secret));
  assert.equal(runtime.commands[0].command, 'psql');
  assert.ok(!JSON.stringify(runtime.commands[0].args).includes(password));
  assert.equal(runtime.commands[0].options.env.PGPASSWORD, password);
  assert.match(runtime.commands[0].options.env.PGOPTIONS, /default_transaction_read_only=on/);
  assert.equal(runtime.commands[0].options.env.SUPABASE_SECRET_KEY, undefined);
  const payload = JSON.parse(runtime.requests.find(({url}) => url.includes('sendgrid.com')).options.body);
  assert.deepEqual(payload.personalizations, [{to:[{email:environment.SENDGRID_FROM_EMAIL}]}]);
});

test('production, unknown origin, embedded credentials and mismatched project ref fail before any request', async () => {
  for (const change of [{APP_ENV:'production'}, {APP_ENV:undefined}, {SUPABASE_URL:'https://attacker.example'},
    {SUPABASE_URL:`https://user:password@${ref}.supabase.co`}, {SUPABASE_URL:`https://${ref}.supabase.co/path`},
    {SUPABASE_URL:`https://${ref}.supabase.co?credential=value`}, {STAGING_SUPABASE_PROJECT_REF:'b'.repeat(20)},
    {RELEASE_SHA:environment.SUPABASE_SECRET_KEY}]) {
    const runtime = fixtures();
    const result = await stagingPreflight({...environment, ...change}, runtime);
    assert.equal(result.passed, false);
    assert.equal(runtime.requests.length, 0);
    assert.equal(runtime.commands.length, 0);
    assert.ok(!JSON.stringify(result).includes(environment.SUPABASE_SECRET_KEY));
  }
});

test('database credentials are bound to the same direct project or session pooler', () => {
  const direct = databaseTarget(environment.MIGRATION_DATABASE_URL, ref);
  assert.equal(direct.password, password);
  const pooler = databaseTarget(`postgresql://postgres.${ref}:contract@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`, ref);
  assert.equal(pooler.mode, 'session_pooler');
  for (const value of [`postgresql://postgres:contract@db.${'b'.repeat(20)}.supabase.co:5432/postgres`,
    `postgresql://postgres.${'b'.repeat(20)}:contract@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:contract@attacker.pooler.supabase.com.example:5432/postgres`,
    `postgresql://postgres.${ref}:contract@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:contract@db.${ref}.supabase.co:5432/other_database`,
    `postgresql://postgres:contract@db.${ref}.supabase.co:5432/postgres?sslmode=disable`,
    `postgresql://postgres:contract@db.${ref}.supabase.co:5432/postgres?options=malicious`,
    `postgresql://postgres:[YOUR-PASSWORD]@db.${ref}.supabase.co:5432/postgres`]) {
    assert.throws(() => databaseTarget(value, ref), /^Error: DATABASE_/);
  }
});

test('libpq receives explicit TLS and read-only settings without inherited connection overrides', () => {
  const target = databaseTarget(environment.MIGRATION_DATABASE_URL, ref);
  const child = databaseEnvironment(target, {...environment, PGHOST:'attacker.example', PGSERVICE:'other', PGOPTIONS:'unsafe', PGSSLMODE:'disable'});
  assert.equal(child.PGHOST, `db.${ref}.supabase.co`);
  assert.equal(child.PGSERVICE, undefined);
  assert.equal(child.PGSSLMODE, 'require');
  assert.equal(child.MIGRATION_DATABASE_URL, undefined);
  assert.equal(databaseEnvironment({...target, sslMode:'verify-full'}).PGSSLMODE, 'verify-full');
  assert.equal(databaseEnvironment(target, {MIGRATION_SSL_ROOT_CERT_PATH:'/trusted/ca.pem'}).PGSSLMODE, 'verify-full');
});

test('a TLS-terminating pooler is verified at the client; an unverified client connection is rejected', async () => {
  const poolerUrl = `postgresql://postgres.${ref}:contract@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`;
  const behindPooler = await stagingPreflight({...environment, MIGRATION_DATABASE_URL:poolerUrl}, fixtures({metadata:{...emptyDatabase, ssl_in_use:false}}));
  assert.equal(behindPooler.checks.database.passed, true);
  assert.equal(behindPooler.checks.database.tls_encrypted, true);
  assert.equal(behindPooler.checks.database.client_tls_protocol, 'TLSv1.3');
  assert.equal(behindPooler.checks.database.database_backend_tls, false);
  for (const connectionInfo of ['You are connected without SSL.', 'SSL connection (protocol: TLSv1.1, cipher: OLD)']) {
    const unverified = await stagingPreflight(environment, fixtures({connectionInfo}));
    assert.equal(unverified.checks.database.passed, false);
    assert.equal(unverified.checks.database.error, 'DATABASE_CLIENT_TLS_UNVERIFIED');
  }
});

test('private provider or connection errors are reduced to fixed codes and do not hide independent checks', async () => {
  const runtime = fixtures({databaseOverride:{status:1, stderr:`Network is unreachable ${environment.MIGRATION_DATABASE_URL}`},
    fetchOverride:(url) => {if (url.includes('sendgrid.com')) throw new Error(environment.SENDGRID_API_KEY);}});
  const report = await stagingPreflight(environment, runtime);
  assert.equal(report.passed, false);
  assert.equal(report.checks.auth.passed, true);
  assert.equal(report.checks.database.error, 'DATABASE_NETWORK_UNREACHABLE');
  assert.equal(report.checks.sendgrid.error, 'HTTPS_CHECK_UNAVAILABLE');
  assert.ok(!JSON.stringify(report).includes(password));
  assert.ok(!JSON.stringify(report).includes(environment.SENDGRID_API_KEY));
});

test('rejected Supabase keys and SendGrid Mail Send scope fail without exposing response bodies', async () => {
  for (const rejected of ['publishable', 'server', 'sendgrid']) {
    const runtime = fixtures({fetchOverride:(url, options) => {
      if ((rejected === 'publishable' && options.headers?.apikey === environment.SUPABASE_PUBLISHABLE_KEY)
        || (rejected === 'server' && options.headers?.apikey === environment.SUPABASE_SECRET_KEY)
        || (rejected === 'sendgrid' && url.includes('sendgrid.com'))) return {status:rejected === 'sendgrid' ? 403 : 401, json:async () => ({private:environment.SUPABASE_SECRET_KEY})};
    }});
    const report = await stagingPreflight(environment, runtime);
    assert.equal(report.passed, false);
    assert.equal(report.app_deploy_ready, false);
    assert.ok(!JSON.stringify(report).includes(environment.SUPABASE_SECRET_KEY));
  }
});

test('migration completeness, Native guards and forced RLS all participate in app readiness', async () => {
  const complete = {...emptyDatabase, app_tables:143, forced_rls_tables:143, native_session_policies:143,
    migration_table_exists:true, command_owner_restricted:true};
  const valid = await stagingPreflight(environment, fixtures({metadata:complete, applied:expectedMigrations.join('\n')}));
  assert.equal(valid.core_dependencies_ready, true);
  assert.equal(valid.app_deploy_ready, false);
  for (const change of [{forced_rls_tables:142}, {native_session_policies:142}, {api_definers:1}, {command_owner_restricted:false}]) {
    const result = await stagingPreflight(environment, fixtures({metadata:{...complete, ...change}, applied:expectedMigrations.join('\n')}));
    assert.equal(result.core_dependencies_ready, false);
  }
  const mismatch = await stagingPreflight(environment, fixtures({metadata:complete, applied:'UNRECOGNIZED_PRIVATE_VALUE'}));
  assert.equal(mismatch.core_dependencies_ready, false);
  assert.ok(!JSON.stringify(mismatch).includes('UNRECOGNIZED_PRIVATE_VALUE'));
  const unmanaged = await stagingPreflight(environment, fixtures({metadata:{...complete, migration_table_exists:false}}));
  assert.equal(unmanaged.checks.database.migration_history_consistent, false);
});

test('disabled email verification or an inaccessible API schema never makes the app ready', async () => {
  const metadata = {...emptyDatabase, app_tables:143, forced_rls_tables:143, native_session_policies:143,
    migration_table_exists:true, command_owner_restricted:true};
  for (const condition of ['autoconfirm', 'api_hidden']) {
    const runtime = fixtures({metadata, applied:expectedMigrations.join('\n'), fetchOverride:(url) => {
      if (condition === 'autoconfirm' && url.endsWith('/auth/v1/settings')) return {status:200, json:async () => ({external:{email:true}, autoconfirm:true})};
      if (condition === 'api_hidden' && url.includes('/rest/v1/')) return {status:406};
    }});
    assert.equal((await stagingPreflight(environment, runtime)).core_dependencies_ready, false);
  }
});
