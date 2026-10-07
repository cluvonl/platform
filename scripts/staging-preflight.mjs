import {spawnSync} from 'node:child_process';
import {readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

class CheckError extends Error {
  constructor(code) {super(code); this.code = code;}
}
const fail = (code) => {throw new CheckError(code);};
const codeOf = (error) => error instanceof CheckError ? error.code : 'CHECK_UNAVAILABLE';

export function projectTarget(environment) {
  if (environment.APP_ENV !== 'staging') fail('STAGING_ENVIRONMENT_REQUIRED');
  const ref = environment.STAGING_SUPABASE_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/.test(ref ?? '')) fail('PROJECT_REF_REQUIRED');
  let target;
  try {target = new URL(environment.SUPABASE_URL);} catch {fail('PROJECT_URL_INVALID');}
  if (target.origin !== `https://${ref}.supabase.co` || !['', '/'].includes(target.pathname)
    || target.username || target.password || target.search || target.hash) fail('PROJECT_URL_MISMATCH');
  return {ref, origin:target.origin};
}

export function databaseTarget(value, ref) {
  let target, username, password;
  try {target = new URL(value); username = decodeURIComponent(target.username); password = decodeURIComponent(target.password);}
  catch {fail('DATABASE_URL_INVALID');}
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || target.pathname !== '/postgres'
    || !password || /[\r\n\0]|\[YOUR[-_]PASSWORD\]/i.test(password) || target.hash) fail('DATABASE_URL_INVALID');
  if (target.port && target.port !== '5432') fail('DATABASE_SESSION_CONNECTION_REQUIRED');
  const direct = target.hostname === `db.${ref}.supabase.co` && username === 'postgres';
  const pooled = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(target.hostname) && username === `postgres.${ref}`;
  if (!direct && !pooled) fail('DATABASE_PROJECT_MISMATCH');
  for (const [key, item] of target.searchParams) {
    if (key === 'sslmode' && ['require', 'verify-full'].includes(item)) continue;
    if (key === 'connect_timeout' && /^\d{1,2}$/.test(item)) continue;
    fail('DATABASE_OPTIONS_UNSUPPORTED');
  }
  return {host:target.hostname, port:'5432', username, password, sslMode:target.searchParams.get('sslmode') ?? 'require', mode:direct ? 'direct' : 'session_pooler'};
}

export function databaseEnvironment(target, environment = {}) {
  // No credential-bearing argv, URL, shell expansion or inherited libpq options.
  return {
    PATH:environment.PATH, LANG:'C.UTF-8', PGHOST:target.host, PGPORT:target.port,
    PGUSER:target.username, PGPASSWORD:target.password, PGDATABASE:'postgres',
    PGSSLMODE:environment.MIGRATION_SSL_ROOT_CERT_PATH ? 'verify-full' : target.sslMode,
    ...(environment.MIGRATION_SSL_ROOT_CERT_PATH ? {PGSSLROOTCERT:environment.MIGRATION_SSL_ROOT_CERT_PATH} : {}),
    PGCONNECT_TIMEOUT:'12', PGAPPNAME:'cluvo-staging-preflight',
    PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=15000',
  };
}

function queryDatabase(query, target, environment, execute) {
  const result = execute('psql', ['--no-psqlrc', '--no-password', '--quiet', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1'], {
    env:databaseEnvironment(target, environment), input:query, encoding:'utf8', timeout:30_000, maxBuffer:1_000_000,
  });
  if (result.status !== 0 || result.error) {
    if (/Network is unreachable|No route to host/i.test(result.stderr ?? '')) fail('DATABASE_NETWORK_UNREACHABLE');
    if (/password authentication failed|SASL authentication failed|SASL_SIGNATURE_MISMATCH/i.test(result.stderr ?? '')) fail('DATABASE_CREDENTIAL_REJECTED');
    if (/certificate|SSL error/i.test(result.stderr ?? '')) fail('DATABASE_TLS_UNAVAILABLE');
    fail('DATABASE_CONNECTION_UNAVAILABLE');
  }
  return result.stdout.trim();
}

const metadataQuery = `with native_policy_capability as (
 select
  coalesce((select rolsuper from pg_roles where rolname=current_user),false) or coalesce((select pg_has_role(current_user,c.relowner,'USAGE') from pg_class c where c.oid=to_regclass('auth.sessions')),false) as owner_available,
  (current_setting('shared_preload_libraries') || ',' || current_setting('session_preload_libraries') || ',' || current_setting('local_preload_libraries')) ~ '(^|,)\\s*supautils\\s*(,|$)'
   and coalesce((coalesce(nullif(current_setting('supautils.policy_grants',true),''),'{}')::jsonb -> current_user) ? 'auth.sessions',false) as provider_granted
) select json_build_object(
 'postgres_version_num',current_setting('server_version_num')::integer,
 'ssl_in_use',coalesce((select ssl from pg_stat_ssl where pid=pg_backend_pid()),false),
 'app_tables',(select count(*) from pg_tables where schemaname='app'),
 'forced_rls_tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity),
 'native_session_policies',(select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='app' and p.polname='native_session_required' and not p.polpermissive),
 'api_definers',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.prosecdef),
 'migration_table_exists',to_regclass('supabase_migrations.schema_migrations') is not null,
 'command_owner_restricted',coalesce((select not rolsuper and not rolbypassrls from pg_roles where rolname='cluvo_command_owner'),false),
 'native_session_policy_owner_available',(select owner_available from native_policy_capability),
 'native_session_policy_provider_granted',(select provider_granted from native_policy_capability),
 'native_session_policy_ddl_available',(select owner_available or provider_granted from native_policy_capability),
 'native_session_select_grantable',has_table_privilege(current_user,'auth.sessions','SELECT WITH GRANT OPTION'),
 'native_identity_select_grantable',has_table_privilege(current_user,'auth.users','SELECT WITH GRANT OPTION'));
`;

async function checkDatabase(environment, project, expected, execute) {
  const target = databaseTarget(environment.MIGRATION_DATABASE_URL, project.ref);
  // pg_stat_ssl observes the database backend, which may be behind a TLS-
  // terminating pooler. Measure the libpq client connection independently.
  const connection = queryDatabase('\\conninfo\n', target, environment, execute);
  const protocol = connection.match(/SSL connection \(protocol:\s*(TLSv1\.[23])[,)]/i)?.[1];
  if (!protocol) fail('DATABASE_CLIENT_TLS_UNVERIFIED');
  let data;
  try {data = JSON.parse(queryDatabase(metadataQuery, target, environment, execute));}
  catch (error) {if (error instanceof CheckError) throw error; fail('DATABASE_METADATA_INVALID');}
  const counts = {};
  for (const field of ['postgres_version_num', 'app_tables', 'forced_rls_tables', 'native_session_policies', 'api_definers']) {
    if (!Number.isSafeInteger(data[field]) || data[field] < 0) fail('DATABASE_METADATA_INVALID');
    counts[field] = data[field];
  }
  for (const field of ['ssl_in_use', 'migration_table_exists', 'command_owner_restricted', 'native_session_policy_owner_available', 'native_session_policy_provider_granted', 'native_session_policy_ddl_available', 'native_session_select_grantable', 'native_identity_select_grantable']) {
    if (typeof data[field] !== 'boolean') fail('DATABASE_METADATA_INVALID');
  }
  const applied = data.migration_table_exists
    ? queryDatabase('select version from supabase_migrations.schema_migrations order by version;', target, environment, execute).split('\n').filter(Boolean)
    : [];
  const prefix = applied.length <= expected.length && applied.every((version, index) => version === expected[index]);
  const consistent = prefix && (applied.length > 0 || data.app_tables === 0);
  return {
    connected:true, transport:target.mode, tls_encrypted:true, client_tls_protocol:protocol,
    database_backend_tls:data.ssl_in_use,
    server_certificate_verified:Boolean(environment.MIGRATION_SSL_ROOT_CERT_PATH) || target.sslMode === 'verify-full', ...counts,
    command_owner_restricted:data.command_owner_restricted, applied_migrations:applied.length,
    native_session_policy_owner_available:data.native_session_policy_owner_available,
    native_session_policy_provider_granted:data.native_session_policy_provider_granted,
    native_session_policy_ddl_available:data.native_session_policy_ddl_available,
    native_session_select_grantable:data.native_session_select_grantable,
    native_identity_select_grantable:data.native_identity_select_grantable,
    expected_migrations:expected.length, migration_history_consistent:consistent,
    pending_migrations:prefix ? expected.length - applied.length : null,
    schema_ready:consistent && applied.length === expected.length && data.app_tables > 0
      && data.forced_rls_tables === data.app_tables && data.native_session_policies === data.app_tables
      && data.api_definers === 0 && data.command_owner_restricted,
  };
}

async function request(fetcher, url, options) {
  try {return await fetcher(url, {...options, redirect:'error', signal:AbortSignal.timeout(20_000)});}
  catch {fail('HTTPS_CHECK_UNAVAILABLE');}
}

async function checkAuth(environment, project, fetcher) {
  for (const [name, prefix, errorCode] of [
    ['SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_', 'PUBLISHABLE_KEY_REQUIRED'],
    ['SUPABASE_SECRET_KEY', 'sb_secret_', 'SERVER_SECRET_KEY_REQUIRED'],
  ]) {
    if (!environment[name]?.startsWith(prefix)) fail(errorCode);
  }
  const publishable = await request(fetcher, project.origin + '/auth/v1/settings', {headers:{apikey:environment.SUPABASE_PUBLISHABLE_KEY}});
  if (publishable.status !== 200) fail('PUBLISHABLE_KEY_REJECTED');
  let settings;
  try {settings = await publishable.json();} catch {fail('AUTH_SETTINGS_UNAVAILABLE');}
  const secret = await request(fetcher, project.origin + '/auth/v1/settings', {headers:{apikey:environment.SUPABASE_SECRET_KEY}});
  if (secret.status !== 200) fail('SERVER_SECRET_KEY_REJECTED');
  const exposed = await request(fetcher, project.origin + '/rest/v1/public_tenants?select=tenant_id&limit=0', {
    headers:{apikey:environment.SUPABASE_PUBLISHABLE_KEY, 'Accept-Profile':'api'},
  });
  const autoConfirm = settings.mailer_autoconfirm ?? settings.autoconfirm;
  return {
    publishable_key_accepted:true, server_secret_key_accepted:true, email_provider_enabled:settings.external?.email === true,
    email_confirmation_required:typeof autoConfirm === 'boolean' ? !autoConfirm : null,
    api_schema_accessible:exposed.status === 200, smtp_configuration_verified:false, actual_mail_delivery_verified:false,
  };
}

async function checkSendgrid(environment, fetcher) {
  if (!/^SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(environment.SENDGRID_API_KEY ?? '')) fail('SENDGRID_KEY_REQUIRED');
  const from = environment.SENDGRID_FROM_EMAIL;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from ?? '') || /[\r\n\0]/.test(from)) fail('SENDGRID_FROM_REQUIRED');
  // Sandbox validates Mail Send authorization/payload without sending a message.
  const response = await request(fetcher, 'https://api.sendgrid.com/v3/mail/send', {
    method:'POST', headers:{Authorization:'Bearer ' + environment.SENDGRID_API_KEY, 'Content-Type':'application/json'},
    body:JSON.stringify({from:{email:from, name:'Cluvo'}, personalizations:[{to:[{email:from}]}],
      subject:'Cluvo staging configuratiecontrole', content:[{type:'text/plain', value:'Alleen sandboxvalidatie; geen e-mailaflevering.'}],
      mail_settings:{sandbox_mode:{enable:true}}}),
  });
  if (response.status !== 200) fail(response.status === 401 ? 'SENDGRID_KEY_REJECTED' : response.status === 403 ? 'SENDGRID_MAIL_SEND_DENIED' : 'SENDGRID_SANDBOX_REJECTED');
  return {mail_send_sandbox_validated:true, configured_from:from, email_sent:false, sender_verification_proven:false, actual_delivery_verified:false};
}

export async function stagingPreflight(environment, {fetcher = fetch, execute = spawnSync, expectedMigrations = []} = {}) {
  const report = {environment:'staging', observed_at:new Date().toISOString(), source_sha:environment.RELEASE_SHA,
    database_mutations:false, email_sent:false, secret_values_exported:false, v1_ready:false, production_enabled:false, checks:{}};
  let project;
  try {
    project = projectTarget(environment);
    if (!/^[0-9a-f]{40}$/.test(environment.RELEASE_SHA ?? '')) fail('RELEASE_SHA_REQUIRED');
    if (Buffer.byteLength(environment.INVITATION_TOKEN_SECRET ?? '', 'utf8') < 32) fail('INVITATION_SECRET_REQUIRED');
  } catch (error) {
    // Unvalidated input, including a malicious SHA, never reaches the artifact.
    delete report.source_sha; report.error = codeOf(error); report.passed = false; return report;
  }
  report.project_ref = project.ref;
  const checks = [['auth', () => checkAuth(environment, project, fetcher)],
    ['database', () => checkDatabase(environment, project, expectedMigrations, execute)],
    ['sendgrid', () => checkSendgrid(environment, fetcher)]];
  const results = await Promise.allSettled(checks.map(([, check]) => check()));
  results.forEach((result, index) => {report.checks[checks[index][0]] = result.status === 'fulfilled' ? {passed:true, ...result.value} : {passed:false, error:codeOf(result.reason)};});
  report.passed = Object.values(report.checks).every(({passed}) => passed);
  report.core_dependencies_ready = report.passed && report.checks.database.schema_ready
    && report.checks.auth.api_schema_accessible && report.checks.auth.email_provider_enabled
    && report.checks.auth.email_confirmation_required === true;
  // Connectivity is not a deployment/readback, Native login or delivery proof.
  report.app_deploy_ready = false;
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const files = (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
    const report = await stagingPreflight(process.env, {expectedMigrations:files.map((name) => name.slice(0, 14))});
    await writeFile('staging-preflight.json', JSON.stringify(report, null, 2) + '\n', {mode:0o600});
    console.log(JSON.stringify({result:report.passed ? 'PASS' : 'FAIL', core_dependencies_ready:report.core_dependencies_ready ?? false, app_deploy_ready:false,
      checks:Object.fromEntries(Object.entries(report.checks).map(([name, value]) => [name, value.passed ? 'PASS' : value.error])),
      ...(report.error ? {error:report.error} : {}), email_sent:false, database_mutations:false}));
    if (!report.passed) process.exitCode = 1;
  } catch {console.error('Stagingpreflight kon niet worden vastgelegd; geheime diagnostiek onderdrukt.'); process.exitCode = 1;}
}
