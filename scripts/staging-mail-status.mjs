import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget} from './staging-preflight.mjs';

const SEND_RUN = '37591201027';
const SEND_SHA = '9bd1cc19a398086b2177304870eb53c04e1d3db9';
const SUBJECT = 'Cluvo — testmail voor staging';
const SEND_PROOF = new URL('../docs/release/evidence/staging/20261007-mail-9bd1cc1/mail-results.json', import.meta.url);
const STATUSES = new Set(['processed', 'processing', 'delivered', 'not_delivered']);
const EVENTS = new Set(['processed', 'delivered', 'deferred', 'bounced', 'dropped', 'blocked',
  'opened', 'clicked', 'spam_report', 'unsubscribe', 'group_unsubscribe', 'group_resubscribe']);
const REASON_PATTERNS = [
  ['CREDIT_LIMIT_REPORTED', /maximum credits|credits? (?:exceeded|exhausted)|sending quota exceeded/i],
  ['ACCOUNT_DISABLED_REPORTED', /account (?:is )?(?:disabled|suspended|under review)|sending (?:is )?disabled/i],
  ['SENDER_AUTHENTICATION_REPORTED', /\bunauthenticated\b|\bsender (?:is )?not verified\b|\b(?:spf|dkim|dmarc)\b.{0,80}\b(?:fail(?:ed)?|reject(?:ed)?|missing|invalid)\b|\b(?:fail(?:ed)?|missing|invalid)\b.{0,80}\b(?:spf|dkim|dmarc)\b/i],
  ['RECIPIENT_SUPPRESSION_REPORTED', /unsubscribed|suppression|spam report|previously bounced/i],
  ['RECIPIENT_ADDRESS_REPORTED', /mailbox (?:does not exist|not found)|user unknown|invalid recipient/i],
  ['MAILBOX_FULL_REPORTED', /mailbox full|over quota/i],
  ['DELIVERY_DEFERRED_REPORTED', /temporarily|try again later|rate limit/i],
];
const email = (value) => typeof value === 'string' && value.length <= 254
  && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
class StatusError extends Error {constructor(code) {super(code); this.code = code;}}
const fail = (code) => {throw new StatusError(code);};

async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) fail('SENDGRID_ACTIVITY_RESPONSE_INVALID');
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65_536) {await reader.cancel(); fail('SENDGRID_ACTIVITY_RESPONSE_INVALID');}
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof StatusError) throw error;
    fail('SENDGRID_ACTIVITY_RESPONSE_INVALID');
  } finally {reader.releaseLock();}
}

export async function stagingMailStatus(environment, {fetcher = fetch, sendProof, now = new Date()} = {}) {
  const report = {environment:'staging', observed_at:now.toISOString(), checked_send_run_id:SEND_RUN,
    read_only:true, email_sent:false, database_mutations:false, provider_mutations:false,
    actual_delivery_verified:false, user_receipt_verified:false,
    delivery_status:'UNKNOWN', original_send_message_binding_verified:false,
    smtp_configuration_verified:false, native_otp_verified:false, invitation_delivery_verified:false,
    recipient_value_exported:false, provider_values_exported:false, secret_values_exported:false,
    v1_ready:false, production_enabled:false};
  try {
    if (environment.APP_ENV !== 'staging' || environment.GITHUB_REPOSITORY !== 'cluvonl/platform'
      || environment.GITHUB_REF !== 'refs/heads/staging' || !/^[0-9a-f]{40}$/.test(environment.RELEASE_SHA ?? '')) fail('FIXED_STAGING_RELEASE_REQUIRED');
    if (projectTarget(environment).ref !== 'fbozlbgmktkgcdfqdaaz') fail('FIXED_STAGING_PROJECT_REQUIRED');
    report.source_sha = environment.RELEASE_SHA;
    const recipient = environment.STAGING_TEST_RECIPIENT;
    const from = environment.SENDGRID_FROM_EMAIL;
    const allowlist = environment.MAIL_ALLOWLIST;
    if (!email(recipient) || !email(from) || typeof allowlist !== 'string' || allowlist.length > 16_384
      || /[\r\n\0]/.test(allowlist)) fail('EXACT_STAGING_RECIPIENT_REQUIRED');
    const allowed = allowlist.split(',').map((value) => value.trim());
    if (allowed.some((value) => !email(value)) || !allowed.some((value) => value.toLowerCase() === recipient.toLowerCase())) fail('EXACT_STAGING_RECIPIENT_REQUIRED');
    if (!/^SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(environment.SENDGRID_API_KEY ?? '')) fail('SENDGRID_KEY_REQUIRED');
    const proof = sendProof ?? JSON.parse(await readFile(SEND_PROOF, 'utf8'));
    if (proof.source_sha !== SEND_SHA || proof.workflow_run_id !== SEND_RUN || proof.provider_status !== 202
      || proof.send_outcome !== 'ACCEPTED' || proof.passed !== true) fail('ACCEPTED_TEST_SEND_PROOF_REQUIRED');
    const sent = Date.parse(proof.observed_at);
    if (!Number.isFinite(sent) || sent > now.getTime() || now.getTime() - sent > 30 * 86_400_000) fail('TEST_SEND_TIME_WINDOW_INVALID');
    const start = new Date(sent - 60_000).toISOString();
    const end = new Date(now.getTime() + 60_000).toISOString();
    const query = `to_email="${recipient}" AND from_email="${from}" AND subject="${SUBJECT}" AND last_event_time BETWEEN TIMESTAMP "${start}" AND TIMESTAMP "${end}"`;
    const url = new URL('https://api.sendgrid.com/v3/messages');
    url.searchParams.set('query', query); url.searchParams.set('limit', '5');
    async function get(target) {
      let response;
      try {response = await fetcher(target, {method:'GET', redirect:'error',
        signal:AbortSignal.timeout(20_000), headers:{Authorization:'Bearer ' + environment.SENDGRID_API_KEY}});}
      catch {fail('SENDGRID_ACTIVITY_REQUEST_UNAVAILABLE');}
      if (response.status !== 200) {
        report.provider_status = response.status;
        fail(response.status === 401 ? 'SENDGRID_ACTIVITY_KEY_REJECTED'
          : response.status === 403 ? 'SENDGRID_ACTIVITY_READ_DENIED' : 'SENDGRID_ACTIVITY_READ_UNAVAILABLE');
      }
      return readJson(response);
    }
    const result = await get(url);
    if (!Array.isArray(result.messages) || result.messages.length > 5) fail('SENDGRID_ACTIVITY_RESPONSE_INVALID');
    if (!result.messages.length) {
      report.passed = true; report.activity_accessible = true; report.match_count = 0;
      report.candidate_delivery_status = 'NO_MATCH_OBSERVED'; return report;
    }
    const matches = result.messages;
    for (const item of matches) {
      if (typeof item?.to_email !== 'string' || item.to_email.toLowerCase() !== recipient.toLowerCase()
        || typeof item.from_email !== 'string' || item.from_email.toLowerCase() !== from.toLowerCase()
        || item.subject !== SUBJECT || !STATUSES.has(item.status)
        || !Number.isFinite(Date.parse(item.last_event_time))
        || Date.parse(item.last_event_time) < Date.parse(start) || Date.parse(item.last_event_time) > Date.parse(end)) fail('SENDGRID_ACTIVITY_SCOPE_MISMATCH');
    }
    report.activity_accessible = true; report.match_count = matches.length;
    if (matches.length !== 1) {report.passed = true; report.candidate_delivery_status = 'AMBIGUOUS_MATCH'; return report;}
    const item = matches[0];
    if (typeof item.msg_id !== 'string' || !/^[A-Za-z0-9_.-]{1,512}$/.test(item.msg_id)
      || item.msg_id === '.' || item.msg_id === '..') fail('SENDGRID_ACTIVITY_MESSAGE_ID_INVALID');
    const detail = await get('https://api.sendgrid.com/v3/messages/' + encodeURIComponent(item.msg_id));
    if (detail.msg_id !== item.msg_id || typeof detail.to_email !== 'string'
      || detail.to_email.toLowerCase() !== recipient.toLowerCase()
      || typeof detail.from_email !== 'string' || detail.from_email.toLowerCase() !== from.toLowerCase()
      || detail.subject !== SUBJECT || !STATUSES.has(detail.status)
      || !Array.isArray(detail.events) || detail.events.length > 100) fail('SENDGRID_ACTIVITY_DETAIL_INVALID');
    const eventCounts = {}; const categories = new Set();
    let unclassifiedEvents = 0; let reasons = 0;
    for (const event of detail.events) {
      if (EVENTS.has(event.event_name)) eventCounts[event.event_name] = (eventCounts[event.event_name] ?? 0) + 1;
      else unclassifiedEvents++;
      if (typeof event.reason === 'string' && event.reason.length) {
        reasons++;
        const reason = event.reason.replace(/[^\s<>()]+@[^\s<>()]+/g, '[private recipient]');
        const matches = event.reason.length <= 1024 ? REASON_PATTERNS.filter(([, pattern]) => pattern.test(reason)) : [];
        if (matches.length) for (const [category] of matches) categories.add(category);
        else categories.add('UNCLASSIFIED_PRIVATE_REASON');
      }
    }
    report.candidate_delivery_status = detail.status;
    // Mailbox-provider delivery is separate from the user's inbox receipt.
    report.candidate_mailbox_delivery_reported = detail.status === 'delivered';
    report.event_counts = eventCounts; report.unclassified_event_count = unclassifiedEvents;
    report.private_reason_count = reasons; report.candidate_reason_categories = [...categories].sort();
    report.reason_classification_basis = 'allowlisted_patterns_in_private_provider_reason';
    if (detail.status === 'not_delivered') {
      // Only a boolean is exported; balance alone is not proof of a sending block.
      report.credit_check = {attempted:true, available:false};
      try {
        const response = await fetcher('https://api.sendgrid.com/v3/user/credits', {method:'GET',redirect:'error',
          signal:AbortSignal.timeout(20_000),headers:{Authorization:'Bearer ' + environment.SENDGRID_API_KEY}});
        report.credit_check.http_status = response.status;
        if (response.status === 200) {
          const credits = await readJson(response);
          if (Number.isSafeInteger(credits.remain)) {
            report.credit_check.available = true;
            report.credit_check.balance_positive = credits.remain > 0;
          }
        }
      } catch {report.credit_check.error = 'CREDIT_METADATA_UNAVAILABLE';}
    }
    report.passed = true;
    // Never export recipient, URL/query, message ID, raw event, reason or responsebody.
  } catch (error) {
    report.passed = false; report.delivery_status = 'UNKNOWN'; report.candidate_delivery_status = 'UNKNOWN';
    report.candidate_mailbox_delivery_reported = false; delete report.event_counts;
    report.error = error instanceof StatusError ? error.code : 'STAGING_MAIL_STATUS_UNAVAILABLE';
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const report = await stagingMailStatus(process.env);
    await writeFile('staging-mail-status.json', JSON.stringify(report, null, 2) + '\n', {mode:0o600});
    console.log(JSON.stringify({result:report.passed ? 'PASS' : 'FAIL', email_sent:false,
      delivery_status:report.delivery_status ?? 'UNKNOWN', ...(report.error ? {error:report.error} : {})}));
    if (!report.passed) process.exitCode = 1;
  } catch {console.error('STAGING_MAIL_STATUS_REPORT_UNAVAILABLE'); process.exitCode = 1;}
}
