import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingMailCheck} from '../scripts/staging-mail-check.mjs';

const environment = {APP_ENV:'staging', GITHUB_REPOSITORY:'cluvonl/platform', GITHUB_REF:'refs/heads/staging',
  RELEASE_SHA:'a'.repeat(40), GITHUB_RUN_ID:'123456', GITHUB_RUN_ATTEMPT:'1',
  STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz', SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',
  SEND_STAGING_TEST_EMAIL:'true', STAGING_TEST_RECIPIENT:'synthetic-test@cluvo.example',
  MAIL_ALLOWLIST:'synthetic-test@cluvo.example', SENDGRID_FROM_EMAIL:'info@cluvo.example',
  SENDGRID_API_KEY:'SG.synthetic_contract.not_a_real_key'};

test('one allowlisted staging request keeps provider acceptance separate from receipt, OTP and invitation proof', async () => {
  let calls = 0;
  const report = await stagingMailCheck(environment, {fetcher:async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer ' + environment.SENDGRID_API_KEY);
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.personalizations, [{to:[{email:environment.STAGING_TEST_RECIPIENT}]}]);
    assert.equal(payload.mail_settings.sandbox_mode.enable, false);
    return {status:202, json:async () => {throw Error('providerbody must not be read');}};
  }});
  assert.equal(calls, 1);
  assert.equal(report.passed, true);
  assert.equal(report.email_sent, true);
  assert.equal(report.send_outcome, 'ACCEPTED');
  assert.equal(report.email_request_attempted, true);
  assert.equal(report.receipt_confirmation, 'PENDING_USER');
  for (const field of ['actual_delivery_verified', 'smtp_configuration_verified', 'native_otp_verified',
    'invitation_delivery_verified', 'database_mutations', 'v1_ready', 'production_enabled']) assert.equal(report[field], false);
  assert.ok(!JSON.stringify(report).includes(environment.STAGING_TEST_RECIPIENT));
  assert.ok(!JSON.stringify(report).includes(environment.SENDGRID_API_KEY));
});

test('default check sends nothing and exports no configured recipient', async () => {
  let calls = 0;
  const report = await stagingMailCheck({...environment, SEND_STAGING_TEST_EMAIL:'false'}, {fetcher:async () => {calls++;}});
  assert.equal(report.passed, true);
  assert.equal(report.skipped, true);
  assert.equal(report.email_sent, false);
  assert.equal(report.email_request_attempted, false);
  assert.equal(calls, 0);
});

test('production, foreign project, retries and absent or expanded recipient authority fail before sending', async () => {
  for (const change of [{APP_ENV:'production'}, {GITHUB_REF:'refs/heads/main'}, {GITHUB_REPOSITORY:'other/repo'},
    {STAGING_SUPABASE_PROJECT_REF:'b'.repeat(20)}, {SUPABASE_URL:'https://other.example'},
    {RELEASE_SHA:environment.SENDGRID_API_KEY}, {GITHUB_RUN_ATTEMPT:'2'}, {GITHUB_RUN_ID:undefined},
    {STAGING_TEST_RECIPIENT:undefined}, {STAGING_TEST_RECIPIENT:'other@cluvo.example'}, {MAIL_ALLOWLIST:'*'},
    {MAIL_ALLOWLIST:'synthetic-test@cluvo.example\nother@cluvo.example'}, {MAIL_ALLOWLIST:undefined},
    {SENDGRID_FROM_EMAIL:'info@cluvo.example\r\nInjected:value'}, {SENDGRID_API_KEY:'invalid'}]) {
    let calls = 0;
    const report = await stagingMailCheck({...environment, ...change}, {fetcher:async () => {calls++;}});
    assert.equal(report.passed, false);
    assert.equal(report.email_sent, false);
    assert.equal(calls, 0);
    assert.ok(!JSON.stringify(report).includes(environment.SENDGRID_API_KEY));
  }
});

test('provider rejection exports only a fixed code, never response details', async () => {
  const report = await stagingMailCheck(environment, {fetcher:async () => ({status:403,
    json:async () => ({error:'PRIVATE_CONTRACT_MARKER'})})});
  assert.equal(report.passed, false);
  assert.equal(report.email_sent, false);
  assert.equal(report.email_request_attempted, true);
  assert.equal(report.send_outcome, 'REJECTED');
  assert.ok(!JSON.stringify(report).includes('PRIVATE_CONTRACT_MARKER'));
  assert.ok(!JSON.stringify(report).includes(environment.STAGING_TEST_RECIPIENT));
});

test('lost response or server error preserves unknown send outcome and never retries', async () => {
  for (const outcome of ['lost_response', 'server_error']) {
    let calls = 0;
    const report = await stagingMailCheck(environment, {fetcher:async () => {
      calls++;
      if (outcome === 'lost_response') throw Error('PRIVATE_CONTRACT_MARKER');
      return {status:500};
    }});
    assert.equal(calls, 1);
    assert.equal(report.passed, false);
    assert.equal(report.email_request_attempted, true);
    assert.equal(report.email_sent, null);
    assert.equal(report.send_outcome, 'UNKNOWN');
    assert.ok(!JSON.stringify(report).includes('PRIVATE_CONTRACT_MARKER'));
  }
});
