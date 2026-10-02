import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for the disposable season/ledger lock test.');
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql, applicationName) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [
      '--no-psqlrc',
      '--set', 'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--dbname', databaseUrl,
    ], {
      env: {...process.env, PGAPPNAME: applicationName},
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({code, stdout, stderr}));
    child.stdin.end(sql);
  });
}

function requireSuccess(result, label) {
  if (result.code !== 0) throw new Error(`${label} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const tenantId = randomUUID();
const seasonId = randomUUID();
const holderName = `cluvo-season-lock-holder-${tenantId.slice(0, 8)}`;
const lockSql = `select internal.lock_season_ledger(${sqlLiteral(tenantId)}, ${sqlLiteral(seasonId)});`;
const holderPromise = psql(`begin; ${lockSql} select pg_sleep(3); commit;`, holderName);

let holderReady = false;
for (let attempt = 0; attempt < 40; attempt += 1) {
  const probe = requireSuccess(await psql(
    `select count(*) from pg_stat_activity where application_name=${sqlLiteral(holderName)} and state='active';`,
    'cluvo-season-lock-probe',
  ), 'lock holder probe');
  if (Number(probe) === 1) {
    holderReady = true;
    break;
  }
  await pause(50);
}
if (!holderReady) throw new Error('Season lock holder did not become observable in time.');

const startedAt = performance.now();
const waiter = await psql(`begin; ${lockSql} commit;`, 'cluvo-season-lock-waiter');
const waitedMilliseconds = Math.round(performance.now() - startedAt);
requireSuccess(waiter, 'season lock waiter');
requireSuccess(await holderPromise, 'season lock holder');

if (waitedMilliseconds < 1500 || waitedMilliseconds > 8000) {
  throw new Error(`Expected the second transaction to wait for the first; observed ${waitedMilliseconds} ms.`);
}

console.log(JSON.stringify({
  scenario: 'SEASON_CLOSE_LEDGER_SERIALIZATION',
  contenders: 2,
  waited_milliseconds: waitedMilliseconds,
  result: 'PASS',
}));
