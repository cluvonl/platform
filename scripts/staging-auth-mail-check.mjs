import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget} from './staging-preflight.mjs';

const PROJECT = 'fbozlbgmktkgcdfqdaaz';
const REDIRECT = 'https://staging.cluvo.nl/auth/confirm?next=%2Fworkspaces';
const SAFE_PROVIDER_CODES = new Set(['email_address_not_authorized', 'email_address_invalid',
  'email_provider_disabled', 'signup_disabled', 'otp_disabled', 'over_email_send_rate_limit',
  'over_request_rate_limit', 'captcha_failed', 'unexpected_failure', 'validation_failed']);
class CheckError extends Error {constructor(code) {super(code); this.code = code;}}
const need = (condition, code) => {if (!condition) throw new CheckError(code);};
const email = value => typeof value === 'string' && value.length <= 254
  && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

function capture(environment) {
  need(environment && (environment === process.env
    || [Object.prototype, null].includes(Object.getPrototypeOf(environment))), 'STAGING_CONTEXT_REQUIRED');
  const descriptors = Object.getOwnPropertyDescriptors(environment), fixed = {};
  for (const key of ['APP_ENV', 'GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_EVENT_NAME', 'GITHUB_SHA',
    'RELEASE_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_ACTOR', 'STAGING_SUPABASE_PROJECT_REF', 'SUPABASE_URL',
    'SEND_STAGING_AUTH_EMAIL', 'STAGING_TEST_RECIPIENT', 'MAIL_ALLOWLIST', 'SUPABASE_PUBLISHABLE_KEY']) {
    const field = descriptors[key];
    need(field && Object.hasOwn(field, 'value') && typeof field.value === 'string'
      && field.value.length <= 16_384 && !/[\r\n\0]/.test(field.value), 'STAGING_CONTEXT_REQUIRED');
    fixed[key] = field.value;
  }
  return Object.freeze(fixed);
}

export async function stagingAuthMailCheck(environment, {fetcher = fetch, now = new Date()} = {}) {
  const report = {environment: 'staging', project_ref: PROJECT, observed_at: now.toISOString(),
    scope: 'AUTH_EMAIL_REQUEST_ONLY', recipient: 'configured_staging_test_recipient',
    recipient_value_exported: false, secret_values_exported: false,
    smtp_configuration_basis: 'USER_REPORTED', smtp_configuration_independently_verified: false,
    request_attempted: false, request_outcome: 'NOT_REQUESTED', provider_accepted: false,
    actual_delivery_verified: false, mail_template_type_verified: false,
    auth_user_creation_possible: false, auth_metadata_mutations_possible: false,
    app_data_mutations: false, app_roles_assigned: false, ddl_requested: false,
    requested_redirect_to: REDIRECT, actual_redirect_target_verified: false,
    native_session_verified: false, app_login_verified: false,
    provider_idempotency_supported: false, expected_version: 'NOT_SUPPORTED_BY_AUTH_OTP_API',
    invitation_delivery_verified: false, v1_ready: false, production_enabled: false};
  try {
    const fixed = capture(environment);
    need(fixed.APP_ENV === 'staging' && fixed.GITHUB_REPOSITORY === 'cluvonl/platform'
      && fixed.GITHUB_REF === 'refs/heads/staging' && fixed.GITHUB_EVENT_NAME === 'workflow_dispatch'
      && /^[0-9a-f]{40}$/.test(fixed.RELEASE_SHA) && fixed.GITHUB_SHA === fixed.RELEASE_SHA,
    'FIXED_STAGING_RELEASE_REQUIRED');
    need(/^\d{1,20}$/.test(fixed.GITHUB_RUN_ID), 'WORKFLOW_RUN_REQUIRED');
    need(fixed.GITHUB_RUN_ATTEMPT === '1', 'NEW_AUTH_MAIL_RUN_REQUIRED');
    need(/^[A-Za-z0-9_-]{1,100}(?:\[bot\])?$/.test(fixed.GITHUB_ACTOR), 'WORKFLOW_ACTOR_REQUIRED');
    const project = projectTarget(fixed);
    need(project.ref === PROJECT, 'FIXED_STAGING_PROJECT_REQUIRED');
    Object.assign(report, {source_sha: fixed.RELEASE_SHA, workflow_run_id: fixed.GITHUB_RUN_ID,
      actor: fixed.GITHUB_ACTOR, audit_reference: `${fixed.GITHUB_RUN_ID}:1`});
    need(['true', 'false'].includes(fixed.SEND_STAGING_AUTH_EMAIL), 'EXPLICIT_SEND_CHOICE_REQUIRED');
    if (fixed.SEND_STAGING_AUTH_EMAIL === 'false') return {...report, passed: true, skipped: true};
    const recipient = fixed.STAGING_TEST_RECIPIENT;
    need(email(recipient), 'STAGING_TEST_RECIPIENT_REQUIRED');
    const allowed = fixed.MAIL_ALLOWLIST.split(',').map(value => value.trim());
    need(allowed.length > 0 && allowed.every(email), 'EXACT_MAIL_ALLOWLIST_REQUIRED');
    need(allowed.some(value => value.toLowerCase() === recipient.toLowerCase()), 'RECIPIENT_NOT_ALLOWLISTED');
    need(/^sb_publishable_[A-Za-z0-9_-]+$/.test(fixed.SUPABASE_PUBLISHABLE_KEY), 'PUBLISHABLE_KEY_REQUIRED');
    Object.assign(report, {request_attempted: true, request_outcome: 'UNKNOWN',
      auth_user_creation_possible: true, auth_metadata_mutations_possible: true});
    let response;
    try {
      // One provider request, no retries. No admin/server/database/SendGrid key.
      const url = new URL(project.origin + '/auth/v1/otp');
      url.searchParams.set('redirect_to', REDIRECT);
      response = await fetcher(url.href, {method: 'POST', redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: {apikey: fixed.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({email: recipient, create_user: true})});
    } catch {throw new CheckError('AUTH_EMAIL_REQUEST_UNAVAILABLE');}
    need(Number.isInteger(response.status) && response.status >= 100 && response.status <= 599,
      'AUTH_RESPONSE_INVALID');
    report.provider_status = response.status;
    if (response.status === 200) {
      // A successful request is not proof of mail delivery, user creation or login.
      return {...report, passed: true, provider_accepted: true,
        request_outcome: 'ACCEPTED', receipt_confirmation: 'PENDING_USER'};
    }
    if (response.status >= 400 && response.status < 500) report.request_outcome = 'REJECTED';
    report.provider_code = 'UNCLASSIFIED';
    try {
      const body = await response.json();
      const code = body?.error_code ?? body?.code;
      if (typeof code === 'string' && SAFE_PROVIDER_CODES.has(code)) report.provider_code = code;
    } catch { /* Raw body, email, token, IDs and provider diagnostics stay private. */ }
    throw new CheckError(report.request_outcome === 'REJECTED'
      ? 'AUTH_EMAIL_REQUEST_REJECTED' : 'AUTH_EMAIL_ACCEPTANCE_UNKNOWN');
  } catch (error) {
    return {...report, passed: false,
      error: error instanceof CheckError ? error.code : 'AUTH_MAIL_CHECK_UNAVAILABLE'};
  }
}

export async function runAuthMailCli(environment, {
  argv = [], write = writeFile, log = value => console.log(value), ...options
} = {}) {
  try {
    const report = argv.length ? {passed: false, error: 'UNEXPECTED_ARGUMENTS'}
      : await stagingAuthMailCheck(environment, options);
    await write('staging-auth-mail-check.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    log(JSON.stringify({result: report.passed ? report.skipped ? 'SKIPPED' : 'REQUEST_ACCEPTED' : 'FAIL',
      request_attempted: report.request_attempted ?? false, request_outcome: report.request_outcome ?? 'NOT_REQUESTED',
      actual_delivery_verified: false, native_session_verified: false,
      ...(report.error ? {error: report.error} : {})}));
    return {exitCode: report.passed ? 0 : 1, report};
  } catch {log('AUTH_MAIL_REPORT_UNAVAILABLE'); return {exitCode: 1};}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = (await runAuthMailCli(process.env, {argv: process.argv.slice(2)})).exitCode;
}
