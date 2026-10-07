import {createHash} from 'node:crypto';
import {readFile, lstat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {projectTarget, databaseTarget, databaseEnvironment} from './staging-preflight.mjs';
import {executeDatabaseProcess} from './staging-database-process.mjs';

const PROJECT = 'fbozlbgmktkgcdfqdaaz';
const CA = new URL('../ops/tls/supabase-platform-root-ca.pem', import.meta.url);
const SESSION = new URL('./staging_backup_session.py', import.meta.url);
const PROBE = new URL('./staging_session_probe.py', import.meta.url);
const PINS = Object.freeze({
  ca: '6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6',
  session: 'b44c01ae1a448eacdf7e41b35f52e8f1599089203db9a96716184bb5742150d5',
  probe: 'fdc85f6f52f01a7811781d4962f3339f74873e3927ea32af8dfc396135a54d2c',
});
export const SESSION_CHECKS = Object.freeze([
  'verified_client_tls', 'sql_backend_identity_and_exclusive_lock',
  'second_same_key_session_refused', 'original_session_survives_competitor',
  'exported_repeatable_read_snapshot', 'single_statement_capture_read',
  'capture_rollback_retains_session_lock', 'fresh_read_same_backend',
  'single_statement_fresh_read', 'fresh_rollback_retains_session_lock',
  'close_releases_session_lock', 'multiple_statements_rejected',
  'zero_row_write_cte_rejected_read_only', 'final_lock_reacquisition',
]);
const LIMITS = Object.freeze({
  backup_created: false, restore_executed: false, snapshot_import_verified: false,
  catalog_data_compared: false, migration_ready: false, remote_ddl_ready: false,
  v1_ready: false, production_enabled: false,
});
const SAFE_ERRORS = new Set([
  'DATABASE_CONNECT_FAILED', 'DATABASE_TIMEOUT', 'DATABASE_DISCONNECTED',
  'DATABASE_VERSION_MISMATCH', 'DATABASE_CLIENT_TLS_UNVERIFIED', 'BACKEND_IDENTITY_UNVERIFIED',
  'BACKEND_SQL_PID_UNVERIFIED', 'BACKEND_PROTOCOL_PID_UNVERIFIED',
  'BACKEND_DATABASE_UNVERIFIED', 'BACKEND_PRIMARY_UNVERIFIED',
  'BACKEND_START_UNVERIFIED', 'BACKEND_PID_MISMATCH',
  'EXCLUSIVE_SESSION_LOCK_BUSY', 'SESSION_OR_EXCLUSIVE_LOCK_CHANGED', 'SNAPSHOT_VISIBILITY_CHANGED',
  'SESSION_LOCK_ALREADY_HELD',
  'DATABASE_QUERY_FAILED', 'DATABASE_UNEXPECTED_WARNING', 'PROBE_TLS_UNVERIFIED',
  'PROBE_COMPETITOR_ACCEPTED', 'PROBE_COMPETITOR_FAILURE_UNKNOWN', 'PROBE_SNAPSHOT_UNVERIFIED',
  'PROBE_READ_UNVERIFIED', 'PROBE_TRANSITION_UNVERIFIED', 'PROBE_BACKEND_CHANGED',
  'PROBE_NEGATIVE_QUERY_ACCEPTED', 'PROBE_NEGATIVE_FAILURE_UNKNOWN',
  'PROBE_CONNECTION_CLOSE_UNPROVED', 'TRANSPORT_PROBE_FAILED',
]);
const hash = value => createHash('sha256').update(value).digest('hex');
class ProbeError extends Error {constructor(code) {super(code); this.code = code;}}
const need = (value, code) => {if (!value) throw new ProbeError(code);};

function fixedEnvironment(environment) {
  // Node's authentic process.env has a distinct prototype. Keep descriptor-only
  // capture for its required fields; arbitrary custom-prototype objects stay denied.
  need(environment && (environment === process.env
    || [Object.prototype, null].includes(Object.getPrototypeOf(environment))), 'STAGING_CONTEXT_REQUIRED');
  const descriptors = Object.getOwnPropertyDescriptors(environment), copy = {};
  for (const key of ['APP_ENV', 'GITHUB_REPOSITORY', 'GITHUB_REF', 'GITHUB_EVENT_NAME', 'GITHUB_SHA',
    'RELEASE_SHA', 'STAGING_SUPABASE_PROJECT_REF', 'SUPABASE_URL', 'MIGRATION_DATABASE_URL']) {
    const field = descriptors[key];
    need(field && Object.hasOwn(field, 'value') && typeof field.value === 'string' && field.value.length > 0
      && field.value.length <= 8192 && !/[\r\n\0]/.test(field.value), 'STAGING_CONTEXT_REQUIRED');
    copy[key] = field.value;
  }
  need(copy.APP_ENV === 'staging' && copy.GITHUB_REPOSITORY === 'cluvonl/platform'
    && copy.GITHUB_REF === 'refs/heads/staging' && copy.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && /^[0-9a-f]{40}$/.test(copy.RELEASE_SHA) && copy.GITHUB_SHA === copy.RELEASE_SHA,
  'FIXED_STAGING_RELEASE_REQUIRED');
  return Object.freeze(copy);
}

function exact(value, keys) {
  need(value && Object.getPrototypeOf(value) === Object.prototype
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'PROBE_REPORT_INVALID');
}

export function safeSessionResult(value) {
  need(typeof value?.passed === 'boolean', 'PROBE_REPORT_INVALID');
  exact(value, ['passed', 'scope', 'checks', 'transport', 'returned_sessions_closed', ...Object.keys(LIMITS),
    ...(value.passed ? [] : ['error', 'sqlstate'])]);
  need(value.scope === 'HOSTED_TRANSPORT_ONLY' && typeof value.returned_sessions_closed === 'boolean'
    && Array.isArray(value.checks) && value.checks.length <= SESSION_CHECKS.length
    && value.checks.every((check, index) => check === SESSION_CHECKS[index])
    && Object.keys(LIMITS).every(key => value[key] === false), 'PROBE_REPORT_INVALID');
  let transport = null;
  if (value.transport !== null) {
    const fields = ['client_tls', 'client_tls_protocol', 'postgres_version', 'libpq_version',
      'backend_identity_mode', 'protocol_pid_matches_sql_backend'];
    exact(value.transport, fields);
    const data = value.transport;
    need(data.client_tls === true && ['TLSv1.2', 'TLSv1.3'].includes(data.client_tls_protocol)
      && data.postgres_version === 170011 && Number.isSafeInteger(data.libpq_version) && data.libpq_version >= 120000
      && ['session_sql_backend_and_lock', 'direct_wire_sql_equal'].includes(data.backend_identity_mode)
      && typeof data.protocol_pid_matches_sql_backend === 'boolean'
      && (data.backend_identity_mode !== 'direct_wire_sql_equal' || data.protocol_pid_matches_sql_backend), 'PROBE_REPORT_INVALID');
    transport = Object.fromEntries(fields.map(key => [key, data[key]]));
  }
  if (value.passed) need(value.checks.length === SESSION_CHECKS.length && transport !== null
    && value.returned_sessions_closed === true, 'PROBE_REPORT_INVALID');
  else need(SAFE_ERRORS.has(value.error) && (value.sqlstate === null
    || (typeof value.sqlstate === 'string' && /^[0-9A-Z]{5}$/.test(value.sqlstate))), 'PROBE_REPORT_INVALID');
  return {passed: value.passed, scope: value.scope, checks: [...value.checks], transport,
    returned_sessions_closed: value.returned_sessions_closed, ...LIMITS,
    ...(value.passed ? {} : {error: value.error, sqlstate: value.sqlstate})};
}

async function verifySources(read, stat) {
  for (const [name, path] of [['ca', CA], ['session', SESSION], ['probe', PROBE]]) {
    const [bytes, details] = await Promise.all([read(path), stat(path)]);
    need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 65_536
      && details.isFile() && !details.isSymbolicLink() && hash(bytes) === PINS[name], 'PINNED_SESSION_SOURCE_CHANGED');
  }
}

export async function stagingSessionProbe(environment, {
  execute = executeDatabaseProcess, read = readFile, stat = lstat, now = new Date(),
} = {}) {
  const base = {environment: 'staging', project_ref: PROJECT, observed_at: now.toISOString(),
    measurement_only: true, email_sent: false, provider_resources_created: false, ddl_requested: false,
    negative_dml_uses_false_predicate: true, private_identifiers_exported: false, ...LIMITS};
  try {
    const fixed = fixedEnvironment(environment);
    const bound = {...base, source_sha: fixed.RELEASE_SHA};
    let target;
    try {
      need(projectTarget(fixed).ref === PROJECT, 'FIXED_PROJECT_REQUIRED');
      target = databaseTarget(fixed.MIGRATION_DATABASE_URL, PROJECT);
    } catch {throw new ProbeError('FIXED_PROJECT_DATABASE_REQUIRED');}
    await verifySources(read, stat);
    const result = await execute('/usr/bin/python3', ['-B', fileURLToPath(PROBE)], {
      env: {...databaseEnvironment(target, {PATH: '/usr/bin:/bin', MIGRATION_SSL_ROOT_CERT_PATH: fileURLToPath(CA)}),
        APP_ENV: 'staging', GITHUB_REPOSITORY: fixed.GITHUB_REPOSITORY,
        GITHUB_REF: fixed.GITHUB_REF, GITHUB_EVENT_NAME: fixed.GITHUB_EVENT_NAME},
      input: '', timeout: 180_000, maxBuffer: 64_000,
    });
    need(result.status === 0 && !result.error && result.stderr === '' && typeof result.stdout === 'string'
      && Buffer.byteLength(result.stdout) <= 64_000, 'SESSION_PROBE_PROCESS_FAILED');
    let safe;
    try {safe = safeSessionResult(JSON.parse(result.stdout));}
    catch {throw new ProbeError('SESSION_PROBE_REPORT_INVALID');}
    await verifySources(read, stat);
    need(safe.transport === null || safe.transport.backend_identity_mode ===
      (target.mode === 'session_pooler' ? 'session_sql_backend_and_lock' : 'direct_wire_sql_equal'),
    'SESSION_ROUTE_REPORT_MISMATCH');
    return {...bound, ...safe, target_mode: target.mode, source_pins: {...PINS}};
  } catch (error) {
    return {...base, passed: false, error: error instanceof ProbeError ? error.code : 'SESSION_PROBE_UNAVAILABLE',
      returned_sessions_closed: false};
  }
}

export async function runSessionProbeCli(environment, {
  argv = [], write = writeFile, log = value => console.log(value), ...options
} = {}) {
  try {
    const report = argv.length ? {passed: false, error: 'UNEXPECTED_ARGUMENTS', ...LIMITS}
      : await stagingSessionProbe(environment, options);
    await write('staging-session-probe.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    log(JSON.stringify({result: report.passed ? 'TRANSPORT_PASS' : 'FAIL',
      checks_passed: report.checks?.length ?? 0, ...(report.error ? {error: report.error} : {}), ...LIMITS}));
    return {exitCode: report.passed ? 0 : 1, report};
  } catch {
    log('STAGING_SESSION_PROBE_REPORT_UNAVAILABLE');
    return {exitCode: 1};
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = (await runSessionProbeCli(process.env, {argv: process.argv.slice(2)})).exitCode;
}
