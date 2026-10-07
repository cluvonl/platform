import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DATASETS, inventoryPlan, inventoryReport} from './staging-data-inventory.mjs';
import {executeDatabaseProcess} from './staging-database-process.mjs';

// Execute the production-generated aggregate SQL on synthetic VALUES only.
// No Auth tables, decrypted views, root keys or actual provider values are read.
// A validated local Unix Docker socket and fixed container exclude remote DBs.
const ROOT = new URL('../', import.meta.url);
const EVIDENCE = new URL('docs/release/evidence/local/20261007-staging-data-checks/sql-format-results.json', ROOT);
const CONTRACT = 'ce9a8eee0cc042be8c7a42981a7ddae631e41d91';
const SOURCE_FILES = ['scripts/test-staging-data-sql.mjs', 'scripts/staging-data-inventory.mjs', 'scripts/staging-database-process.mjs'];
const FIELDS = Object.freeze([
  {id:'auth_password_envelopes', table:'users', column:'encrypted_password', legacy:'$2b$10$' + 'A'.repeat(53)},
  {id:'auth_mfa_factor_envelopes', table:'mfa_factors', column:'secret', legacy:'A'.repeat(32)},
  {id:'auth_mfa_challenge_envelopes', table:'mfa_challenges', column:'otp_code', legacy:'123456'},
  {id:'auth_session_hmac_envelopes', table:'sessions', column:'refresh_token_hmac_key', legacy:Buffer.alloc(32, 251).toString('base64url')},
  {id:'auth_oauth_provider_envelopes', table:'custom_oauth_providers', column:'client_secret', legacy:'opaque-synthetic-provider-format'},
]);
class CheckError extends Error {
  constructor(code, caseId = null) {super(code); this.code = code; this.caseId = caseId;}
}
const fail = (code, caseId) => {throw new CheckError(code, caseId);};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const quote = (value) => value === null ? 'NULL' : "'" + value.replaceAll("'", "''") + "'";
const countFields = ['count', 'valid_envelope_count', 'legacy_count', 'nonempty_count', 'row_count'];

function localEnvironment() {
  const endpoint = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
  let url;
  try {url = new URL(endpoint);} catch {fail('LOCAL_UNIX_DOCKER_REQUIRED');}
  if (url.protocol !== 'unix:' || url.hostname || !url.pathname.startsWith('/')
    || url.username || url.password || url.search || url.hash) fail('LOCAL_UNIX_DOCKER_REQUIRED');
  return {PATH:process.env.PATH, LANG:'C.UTF-8', DOCKER_HOST:endpoint};
}

function plansForFields() {
  for (const field of FIELDS) {
    const dataset = DATASETS.find((item) => item.id === field.id);
    if (!dataset || dataset.schema !== 'auth' || dataset.table !== field.table
      || dataset.column !== field.column || dataset.kind !== 'auth_envelope') fail('FIXED_DATASET_CONTRACT_CHANGED');
  }
  return inventoryPlan({namespaces:['auth'], role_security:{superuser:false, bypass_rls:false}, tce_labels:[],
    relations:FIELDS.map((field) => ({schema_name:'auth', table_name:field.table, kind:'r', count_readable:true,
      rls_enabled:false, force_rls:false, owner_matches_current:false, row_security_active:false,
      columns:[{name:field.column, type:'text'}]}))});
}

function generatedValuesSql(plan, field, values) {
  const suffix = ` FROM "auth"."${field.table}";`;
  if (!plan.sql?.startsWith('SELECT json_build_object(') || !plan.sql.endsWith(suffix)
    || plan.sql.split(suffix).length !== 2) fail('GENERATED_SQL_SCOPE_CHANGED');
  const rows = values.map((value) => `(${quote(value)}::text)`).join(',');
  // OFFSET 0 keeps literals as runtime columns. Without this barrier PostgreSQL
  // can constant-fold a malformed JSON cast before the production CASE guard.
  return plan.sql.slice(0, -suffix.length)
    + ` FROM (SELECT "value" FROM (VALUES ${rows}) AS "synthetic_input" ("value") OFFSET 0) AS "synthetic_format_values" ("${field.column}");`;
}

function casesForFields() {
  // Public synthetic bytes describe formats, not encrypted actual data.
  const envelope = {alg:'aes-gcm-hkdf', key_id:'synthetic-public-format-id',
    data:Buffer.alloc(20, 251).toString('base64'), nonce:Buffer.alloc(12, 255).toString('base64')};
  const json = (overrides = {}) => JSON.stringify({...envelope, ...overrides});
  const missing = (field) => {const value = {...envelope}; delete value[field]; return JSON.stringify(value);};
  const defs = [
    ['null_empty', null, 'empty'],
    ['string_empty', '', 'empty'],
    ['standard_base64_envelope', json(), 'present'],
    ['standard_base64_unpadded_data', json({data:Buffer.alloc(18, 251).toString('base64')}), 'present'],
    ['malformed_json', '{not-json', 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['leading_whitespace_envelope', ' ' + json(), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['base64url_data', json({data:Buffer.alloc(20, 251).toString('base64url')}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['base64url_nonce', json({nonce:Buffer.alloc(12, 255).toString('base64url')}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['short_nonce', json({nonce:Buffer.alloc(11, 255).toString('base64')}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['padded_nonce', json({nonce:envelope.nonce + '='}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['missing_algorithm', missing('alg'), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['missing_key_id', missing('key_id'), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['missing_data', missing('data'), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['missing_nonce', missing('nonce'), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['wrong_algorithm', json({alg:'unknown-algorithm'}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['numeric_algorithm', json({alg:1}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['numeric_key_id', json({key_id:1}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['numeric_data', json({data:1}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['numeric_nonce', json({nonce:1}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['null_key_id', json({key_id:null}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['null_data', json({data:null}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['null_nonce', json({nonce:null}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['empty_key_id', json({key_id:''}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['empty_data', json({data:''}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['empty_nonce', json({nonce:''}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['short_base64_data', json({data:'A'}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['excess_base64_padding', json({data:'AAAA==='}), 'AUTH_ENVELOPE_FORMAT_UNKNOWN'],
    ['nonempty_unknown', 'unknown-public-synthetic-format', 'AUTH_LEGACY_FORMAT_UNKNOWN'],
  ];
  const cases = [];
  const add = (field, name, values, classification, counts) => cases.push({field, id:field.id + ':' + name,
    values, classification, counts});
  for (const field of FIELDS) {
    for (const [name, value, classification] of defs) {
      const candidate = typeof value === 'string' && value.trimStart().startsWith('{');
      add(field, name, [value], classification, {count:Number(candidate),
        valid_envelope_count:Number(classification === 'present'), legacy_count:0,
        nonempty_count:Number(value !== null && value !== ''), row_count:1});
    }
    const opaque = field.id === 'auth_oauth_provider_envelopes';
    add(field, 'field_legacy', [field.legacy], opaque ? 'AUTH_LEGACY_FORMAT_UNKNOWN' : 'empty',
      {count:0, valid_envelope_count:0, legacy_count:Number(!opaque), nonempty_count:1, row_count:1});
    add(field, 'mixed_empty_cipher_and_legacy', [null, '', json(), field.legacy],
      opaque ? 'AUTH_LEGACY_FORMAT_UNKNOWN' : 'present',
      {count:1, valid_envelope_count:1, legacy_count:Number(!opaque), nonempty_count:2, row_count:4});
  }
  const password = FIELDS[0], factor = FIELDS[1], challenge = FIELDS[2], hmac = FIELDS[3];
  const legacyCounts = {count:0, valid_envelope_count:0, legacy_count:0, nonempty_count:1, row_count:1};
  add(password, 'argon2_legacy', ['$argon2id$v=19$m=65536,t=3,p=1$c3ludGhldGlj$c3ludGhldGlj'], 'empty', {...legacyCounts, legacy_count:1});
  add(password, 'firebase_scrypt_unclassified', ['$fbscrypt$synthetic-format'], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  add(factor, 'short_factor_secret', ['A'.repeat(15)], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  add(challenge, 'short_otp', ['12345'], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  add(hmac, 'padded_hmac', [hmac.legacy + '='], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  add(hmac, 'short_hmac', [hmac.legacy.slice(1)], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  add(hmac, 'long_hmac', [hmac.legacy + 'A'], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  add(hmac, 'noncanonical_hmac_tail', [hmac.legacy.slice(0, -1) + 'B'], 'AUTH_LEGACY_FORMAT_UNKNOWN', legacyCounts);
  return cases;
}

async function sourceInventory() {
  return Promise.all(SOURCE_FILES.map(async (file) => {
    const bytes = await readFile(new URL(file, ROOT));
    return {file, bytes:bytes.length, sha256:hash(bytes)};
  }));
}

async function run() {
  if (process.argv.slice(2).some((argument) => argument !== '--write-evidence')
    || process.argv.slice(2).length > 1) fail('UNSUPPORTED_ARGUMENT');
  const sources = await sourceInventory(), plans = plansForFields(), cases = casesForFields();
  const planFor = (field) => plans.find((plan) => plan.id === field.id);
  const queries = [
    "SELECT json_build_object('postgres_version_num',current_setting('server_version_num')::integer,'transaction_read_only',current_setting('transaction_read_only')='on');",
    ...FIELDS.map((field) => generatedValuesSql(planFor(field), field, [null])),
    ...cases.map((item) => generatedValuesSql(planFor(item.field), item.field, item.values)),
  ];
  const sql = 'BEGIN READ ONLY;\n' + queries.join('\n') + '\nROLLBACK;\n';
  const result = await executeDatabaseProcess('docker', ['exec', '-i',
    '-e', 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000',
    'supabase_db_cluvo-local', 'psql', '--no-psqlrc', '--no-password', '--quiet',
    '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
  {env:localEnvironment(), input:sql, timeout:60_000, maxBuffer:1_000_000});
  if (result.error || result.status !== 0) {
    // Only a fixed case ID can leave captured psql diagnostics, never its body.
    const line = Number(result.stderr?.match(/psql:<stdin>:(\d+):/)?.[1]);
    const failedCase = cases[line - FIELDS.length - 3];
    const code = /invalid input syntax/.test(result.stderr ?? '') ? 'LOCAL_SQL_INPUT_FORMAT_ERROR'
      : /syntax error/.test(result.stderr ?? '') ? 'LOCAL_SQL_SYNTAX_ERROR'
      : /function .* does not exist/.test(result.stderr ?? '') ? 'LOCAL_SQL_FUNCTION_UNAVAILABLE'
      : failedCase ? 'LOCAL_READ_ONLY_SQL_QUERY_REJECTED' : 'LOCAL_READ_ONLY_SQL_UNAVAILABLE';
    fail(code, failedCase?.id);
  }
  let rows;
  try {rows = result.stdout.trim().split('\n').map((line) => JSON.parse(line));}
  catch {fail('LOCAL_SQL_AGGREGATES_INVALID');}
  if (rows.length !== queries.length) fail('LOCAL_SQL_RESPONSE_COUNT_MISMATCH');
  const server = rows.shift();
  if (server.transaction_read_only !== true || server.postgres_version_num < 170000
    || server.postgres_version_num >= 180000) fail('LOCAL_READ_ONLY_POSTGRES17_REQUIRED');
  const baseline = rows.splice(0, FIELDS.length);
  baseline.forEach((row, index) => {
    if (row.id !== FIELDS[index].id || countFields.some((field) => row[field] !== Number(field === 'row_count')))
      fail('EMPTY_SQL_BASELINE_MISMATCH');
  });
  const proofs = [];
  for (const [index, item] of cases.entries()) {
    const actual = rows[index];
    if (actual.id !== item.field.id || countFields.some((field) => actual[field] !== item.counts[field]))
      fail('AUTH_SQL_FORMAT_COUNT_MISMATCH', item.id);
    let classification;
    try {
      const measured = baseline.map((row) => row.id === actual.id ? actual : row);
      const report = inventoryReport(plans, measured);
      classification = report.key_dependent_data === 'present' ? 'present' : 'empty';
      if (report.full_schema_decryptability_verified !== false || report.provider_services_verified !== false
        || report.full_database_restore_verified !== false || report.hosted_auth_binary_version_verified !== false)
        fail('INVENTORY_PROOF_BOUNDARY_CHANGED', item.id);
    } catch (error) {
      if (error instanceof CheckError) throw error;
      if (!['AUTH_ENVELOPE_FORMAT_UNKNOWN', 'AUTH_LEGACY_FORMAT_UNKNOWN'].includes(error?.code))
        fail('INVENTORY_CLASSIFICATION_UNEXPECTED_ERROR', item.id);
      classification = error.code;
    }
    if (classification !== item.classification) fail('INVENTORY_CLASSIFICATION_MISMATCH', item.id);
    proofs.push({case_id:item.id, passed:true, classification, counts:Object.fromEntries(countFields.map((field) => [field, actual[field]]))});
  }
  const finalSources = await sourceInventory();
  if (sources.some((source, index) => source.sha256 !== finalSources[index].sha256)) fail('SOURCE_CHANGED_DURING_CHECK');
  const metadata = await executeDatabaseProcess('git', ['rev-parse', 'HEAD'],
    {env:{PATH:process.env.PATH, LANG:'C.UTF-8'}, input:'', timeout:5_000, maxBuffer:1_000});
  const parent = metadata.stdout.trim();
  if (metadata.status !== 0 || !/^[a-f0-9]{40}$/.test(parent)) fail('PARENT_SOURCE_SHA_UNAVAILABLE');
  const report = {observed_at:new Date().toISOString(), scope:'local_postgresql17_read_only_synthetic_values',
    parent_source_sha:parent, passed:true, postgres_version_num:server.postgres_version_num,
    auth_field_count:FIELDS.length, sql_case_count:cases.length, baseline_query_count:FIELDS.length,
    metadata_query_count:1, executed_select_count:queries.length, case_assertion_count:cases.length * 6,
    generated_inventory_sql_executed:true, transaction_read_only:true, rollback_executed:true,
    actual_auth_rows_read:false, fixture_rows_written:false, database_mutations:false,
    ciphertext_values_exported:false, provider_values_exported:false, secret_values_exported:false,
    crypto_contract_source_commit:CONTRACT,
    primary_sources:[`https://github.com/supabase/auth/blob/${CONTRACT}/internal/crypto/crypto.go#L55`,
      `https://github.com/supabase/auth/blob/${CONTRACT}/internal/crypto/refresh_tokens.go#L16`,
      `https://github.com/supabase/auth/blob/${CONTRACT}/internal/models/refresh_token.go#L151`],
    sources, cases:proofs,
    acceptance:{remote_checks_executed:false, actual_envelope_decryption_verified:false,
      hosted_auth_binary_version_verified:false, full_database_restore_verified:false,
      provider_services_verified:false, ddl_authorized:false, v1_ready:false, production_enabled:false}};
  if (process.argv.includes('--write-evidence')) {
    try {await writeFile(EVIDENCE, JSON.stringify(report, null, 2) + '\n', {flag:'wx'});}
    catch (error) {fail(error?.code === 'EEXIST' ? 'EVIDENCE_ALREADY_EXISTS' : 'EVIDENCE_WRITE_UNAVAILABLE');}
  }
  process.stdout.write(`PASS ${report.sql_case_count} cases, ${report.auth_field_count} Auth fields, ${report.executed_select_count} read-only SELECTs\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    const code = error instanceof CheckError ? error.code : 'SQL_FORMAT_CHECK_UNAVAILABLE';
    const caseId = error instanceof CheckError && /^[a-z0-9_]+:[a-z0-9_]+$/.test(error.caseId ?? '') ? ` ${error.caseId}` : '';
    process.stderr.write(`FAIL ${code}${caseId}\n`);
    process.exitCode = 1;
  });
}
