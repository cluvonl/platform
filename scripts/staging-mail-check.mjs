import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget} from './staging-preflight.mjs';

class MailCheckError extends Error {constructor(code) {super(code); this.code = code;}}
const fail = (code) => {throw new MailCheckError(code);};
const email = (value) => typeof value === 'string' && value.length <= 254
  && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

export async function stagingMailCheck(environment, {fetcher = fetch} = {}) {
  const report = {environment:'staging', observed_at:new Date().toISOString(),
    database_mutations:false, email_sent:false, email_request_attempted:false, send_outcome:'NOT_REQUESTED',
    actual_delivery_verified:false,
    smtp_configuration_verified:false, native_otp_verified:false, invitation_delivery_verified:false,
    recipient:'configured_staging_test_recipient', recipient_value_exported:false,
    secret_values_exported:false, v1_ready:false, production_enabled:false};
  try {
    if (environment.APP_ENV !== 'staging'
      || environment.GITHUB_REPOSITORY !== 'cluvonl/platform'
      || environment.GITHUB_REF !== 'refs/heads/staging') fail('FIXED_STAGING_RELEASE_REQUIRED');
    if (!/^[0-9a-f]{40}$/.test(environment.RELEASE_SHA ?? '')) fail('RELEASE_SHA_REQUIRED');
    report.source_sha = environment.RELEASE_SHA;
    if (projectTarget(environment).ref !== 'fbozlbgmktkgcdfqdaaz') fail('FIXED_STAGING_PROJECT_REQUIRED');
    if (!/^\d{1,20}$/.test(environment.GITHUB_RUN_ID ?? '')) fail('WORKFLOW_RUN_REQUIRED');
    report.workflow_run_id = environment.GITHUB_RUN_ID;
    if (environment.GITHUB_RUN_ATTEMPT !== '1') fail('NEW_MAIL_TEST_RUN_REQUIRED');
    if (environment.SEND_STAGING_TEST_EMAIL !== 'true') {
      report.passed = true; report.skipped = true; report.reason = 'TEST_DELIVERY_NOT_REQUESTED'; return report;
    }
    const recipient = environment.STAGING_TEST_RECIPIENT;
    const allowlist = environment.MAIL_ALLOWLIST;
    if (!email(recipient)) fail('STAGING_TEST_RECIPIENT_REQUIRED');
    if (typeof allowlist !== 'string' || allowlist.length > 16_384 || /[\r\n\0]/.test(allowlist)) fail('EXACT_MAIL_ALLOWLIST_REQUIRED');
    const allowed = allowlist.split(',').map((value) => value.trim());
    if (!allowed.length || allowed.some((value) => !email(value))) fail('EXACT_MAIL_ALLOWLIST_REQUIRED');
    if (!allowed.map((value) => value.toLowerCase()).includes(recipient.toLowerCase())) fail('STAGING_TEST_RECIPIENT_NOT_ALLOWLISTED');
    const from = environment.SENDGRID_FROM_EMAIL;
    if (!email(from)) fail('SENDGRID_FROM_REQUIRED');
    if (!/^SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(environment.SENDGRID_API_KEY ?? '')) fail('SENDGRID_KEY_REQUIRED');
    let response;
    report.email_request_attempted = true;
    report.email_sent = null; report.send_outcome = 'UNKNOWN';
    try {
      response = await fetcher('https://api.sendgrid.com/v3/mail/send', {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(20_000),
        headers:{Authorization:'Bearer ' + environment.SENDGRID_API_KEY, 'Content-Type':'application/json'},
        body:JSON.stringify({from:{email:from, name:'Cluvo'}, personalizations:[{to:[{email:recipient}]}],
          subject:'Cluvo — testmail voor staging',
          content:[{type:'text/plain', value:'Dit is de afgesproken testmail voor de Cluvo-testomgeving. Je hoeft niets aan te klikken. Laat in Codex weten of deze mail is aangekomen.\n\nTestreferentie: ' + report.workflow_run_id}],
          mail_settings:{sandbox_mode:{enable:false}}}),
      });
    } catch {fail('STAGING_TEST_MAIL_REQUEST_UNAVAILABLE');}
    // No providerbody, recipient, message-ID, token or key is exported.
    if (response.status !== 202) {
      if (response.status >= 400 && response.status < 500) {report.email_sent = false; report.send_outcome = 'REJECTED';}
      fail(response.status === 401 ? 'SENDGRID_KEY_REJECTED'
        : response.status === 403 ? 'SENDGRID_TEST_MAIL_DENIED'
        : report.send_outcome === 'REJECTED' ? 'SENDGRID_TEST_MAIL_REJECTED' : 'STAGING_TEST_MAIL_ACCEPTANCE_UNKNOWN');
    }
    report.passed = true; report.provider_accepted = true; report.provider_status = 202;
    report.email_sent = true; report.send_outcome = 'ACCEPTED'; report.receipt_confirmation = 'PENDING_USER';
  } catch (error) {
    report.passed = false;
    report.error = error instanceof MailCheckError ? error.code : 'STAGING_MAIL_CHECK_UNAVAILABLE';
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = await stagingMailCheck(process.env);
    await writeFile('staging-mail-check.json', JSON.stringify(report, null, 2) + '\n', {mode:0o600});
    console.log(JSON.stringify({result:report.passed ? report.skipped ? 'SKIPPED' : 'PASS' : 'FAIL',
      email_sent:report.email_sent, send_outcome:report.send_outcome, email_request_attempted:report.email_request_attempted,
      actual_delivery_verified:false, database_mutations:false,
      ...(report.error ? {error:report.error} : {})}));
    if (!report.passed) process.exitCode = 1;
  } catch {console.error('STAGING_MAIL_REPORT_UNAVAILABLE'); process.exitCode = 1;}
}
