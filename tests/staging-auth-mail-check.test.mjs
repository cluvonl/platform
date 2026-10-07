import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingAuthMailCheck, runAuthMailCli} from '../scripts/staging-auth-mail-check.mjs';

const sha = 'a'.repeat(40), project = 'fbozlbgmktkgcdfqdaaz';
function environment() {
  return {APP_ENV: 'staging', GITHUB_REPOSITORY: 'cluvonl/platform', GITHUB_REF: 'refs/heads/staging',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: sha, RELEASE_SHA: sha,
    GITHUB_RUN_ID: '123456', GITHUB_RUN_ATTEMPT: '1', GITHUB_ACTOR: 'synthetic-test-actor', STAGING_SUPABASE_PROJECT_REF: project,
    SUPABASE_URL: `https://${project}.supabase.co`, SEND_STAGING_AUTH_EMAIL: 'true',
    STAGING_TEST_RECIPIENT: 'person@example.test', MAIL_ALLOWLIST: 'PERSON@example.test',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only',
    SUPABASE_SECRET_KEY: 'synthetic-private-server-key-must-not-be-used',
    SENDGRID_API_KEY: 'synthetic-private-mail-key-must-not-be-used'};
}

test('one fixed native Auth request uses only the publishable key and preserves truthful proof limits', async () => {
  let calls = 0;
  const report = await stagingAuthMailCheck(environment(), {fetcher: async (url, options) => {
    calls++;
    const target = new URL(url);
    assert.equal(target.origin, `https://${project}.supabase.co`);
    assert.equal(target.pathname, '/auth/v1/otp');
    assert.equal(target.searchParams.get('redirect_to'), 'https://staging.cluvo.nl/auth/confirm?next=%2Fworkspaces');
    assert.deepEqual(options.headers, {apikey: 'sb_publishable_synthetic_test_only', 'Content-Type': 'application/json'});
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), {email: 'person@example.test', create_user: true});
    return {status: 200, json: () => {throw new Error('success body must not be read');}};
  }});
  assert.equal(calls, 1);
  assert.equal(report.passed, true);
  assert.equal(report.request_outcome, 'ACCEPTED');
  assert.equal(report.auth_user_creation_possible, true);
  assert.equal(report.auth_metadata_mutations_possible, true);
  assert.equal(report.actor, 'synthetic-test-actor');
  assert.equal(report.audit_reference, '123456:1');
  assert.equal(report.provider_idempotency_supported, false);
  assert.equal(report.expected_version, 'NOT_SUPPORTED_BY_AUTH_OTP_API');
  for (const field of ['actual_delivery_verified', 'native_session_verified', 'app_login_verified',
    'smtp_configuration_independently_verified', 'app_data_mutations', 'app_roles_assigned',
    'v1_ready', 'production_enabled', 'actual_redirect_target_verified', 'mail_template_type_verified']) {
    assert.equal(report[field], false);
  }
  for (const privateValue of ['person@example.test', 'synthetic-private', 'sb_publishable_synthetic']) {
    assert.equal(JSON.stringify(report).includes(privateValue), false);
  }
});

test('wrong environment, route, SHA, rerun and project never send mail', async () => {
  for (const change of [{APP_ENV: 'production'}, {GITHUB_REPOSITORY: 'foreign/platform'},
    {GITHUB_REF: 'refs/heads/main'}, {GITHUB_EVENT_NAME: 'push'}, {GITHUB_RUN_ATTEMPT: '2'},
    {GITHUB_RUN_ID: 'private-invalid'}, {GITHUB_SHA: 'b'.repeat(40)}, {RELEASE_SHA: 'latest'},
    {GITHUB_ACTOR: 'private-invalid@value'},
    {STAGING_SUPABASE_PROJECT_REF: 'b'.repeat(20)}, {SUPABASE_URL: 'https://foreign.supabase.co'},
    {SUPABASE_URL: `https://${project}.supabase.co/foreign`}, {SEND_STAGING_AUTH_EMAIL: 'yes'}]) {
    let calls = 0;
    const report = await stagingAuthMailCheck({...environment(), ...change}, {fetcher: async () => {calls++;}});
    assert.equal(report.passed, false);
    assert.equal(report.request_attempted, false);
    assert.equal(calls, 0);
  }
});

test('default no-send and invalid recipients or allowlists cannot mutate Auth', async () => {
  let calls = 0;
  const options = {fetcher: async () => {calls++;}};
  const skipped = await stagingAuthMailCheck({...environment(), SEND_STAGING_AUTH_EMAIL: 'false'}, options);
  assert.equal(skipped.passed, true);
  assert.equal(skipped.skipped, true);
  assert.equal(skipped.auth_user_creation_possible, false);
  for (const change of [{STAGING_TEST_RECIPIENT: 'private-invalid'}, {MAIL_ALLOWLIST: '*'},
    {MAIL_ALLOWLIST: 'other@example.test'}, {MAIL_ALLOWLIST: 'person@example.test,'},
    {STAGING_TEST_RECIPIENT: 'person@example.test\nother@example.test'},
    {SUPABASE_PUBLISHABLE_KEY: 'synthetic-private-server-key-must-not-be-used'}]) {
    const denied = await stagingAuthMailCheck({...environment(), ...change}, options);
    assert.equal(denied.passed, false);
    assert.equal(denied.request_attempted, false);
  }
  assert.equal(calls, 0);
});

test('accessors and arbitrary prototypes are refused without executing a getter', async () => {
  let getters = 0, calls = 0;
  const input = environment();
  Object.defineProperty(input, 'STAGING_TEST_RECIPIENT', {get() {getters++; return 'private';}});
  for (const value of [input, Object.assign(Object.create({inherited: true}), environment())]) {
    const report = await stagingAuthMailCheck(value, {fetcher: async () => {calls++;}});
    assert.equal(report.passed, false);
    assert.equal(report.error, 'STAGING_CONTEXT_REQUIRED');
  }
  assert.equal(getters, 0);
  assert.equal(calls, 0);
});

test('timeout or private transport exceptions stay unknown and are never retried', async () => {
  let calls = 0;
  const report = await stagingAuthMailCheck(environment(), {fetcher: async () => {
    calls++; throw new Error('synthetic-private-recipient-token-provider-message');
  }});
  assert.equal(calls, 1);
  assert.equal(report.passed, false);
  assert.equal(report.request_attempted, true);
  assert.equal(report.request_outcome, 'UNKNOWN');
  assert.equal(report.error, 'AUTH_EMAIL_REQUEST_UNAVAILABLE');
  assert.equal(JSON.stringify(report).includes('synthetic-private'), false);
});

test('known 4xx codes are sanitized and 5xx or unexpected success stay unknown', async () => {
  for (const status of [400, 401, 429, 500, 503, 201, 302]) {
    let calls = 0;
    const report = await stagingAuthMailCheck(environment(), {fetcher: async () => {
      calls++;
      return {status, json: async () => ({error_code: 'over_email_send_rate_limit',
        message: 'synthetic-private-token-url-email', user_id: 'synthetic-private-id'})};
    }});
    assert.equal(calls, 1);
    assert.equal(report.passed, false);
    assert.equal(report.provider_code, 'over_email_send_rate_limit');
    assert.equal(report.request_outcome, status >= 400 && status < 500 ? 'REJECTED' : 'UNKNOWN');
    assert.equal(report.actual_delivery_verified, false);
    assert.equal(JSON.stringify(report).includes('synthetic-private'), false);
  }
});

test('unknown or malformed provider errors never export values or claim delivery', async () => {
  for (const json of [async () => ({code: 'synthetic-private-code', msg: 'person@example.test'}),
    async () => ({code: 500}), async () => {throw new Error('synthetic-private-body');}]) {
    const report = await stagingAuthMailCheck(environment(), {fetcher: async () => ({status: 500, json})});
    assert.equal(report.provider_code, 'UNCLASSIFIED');
    assert.equal(report.provider_accepted, false);
    assert.equal(report.request_outcome, 'UNKNOWN');
    assert.equal(JSON.stringify(report).includes('synthetic-private'), false);
    assert.equal(JSON.stringify(report).includes('person@example.test'), false);
  }
});

test('CLI writes an exclusive private report, refuses arguments and sanitizes write errors', async () => {
  const logs = []; let written, calls = 0;
  const options = {fetcher: async () => {calls++; return {status: 200};},
    write: async (...args) => {written = args;}, log: value => logs.push(value)};
  const success = await runAuthMailCli(environment(), options);
  assert.equal(success.exitCode, 0);
  assert.equal(written[0], 'staging-auth-mail-check.json');
  assert.deepEqual(written[2], {flag: 'wx', mode: 0o600});
  assert.equal(JSON.stringify(logs).includes('person@example.test'), false);
  const denied = await runAuthMailCli(environment(), {...options, argv: ['unexpected']});
  assert.equal(denied.exitCode, 1);
  assert.equal(calls, 1);
  const failure = await runAuthMailCli(environment(), {...options,
    write: async () => {throw new Error('synthetic-private-write-error');}});
  assert.equal(failure.exitCode, 1);
  assert.equal(logs.at(-1), 'AUTH_MAIL_REPORT_UNAVAILABLE');
  assert.equal(JSON.stringify(logs).includes('synthetic-private'), false);
});
