import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
const target = databaseUrl ? new URL(databaseUrl) : null;
if (!target || !['postgres:', 'postgresql:'].includes(target.protocol)
  || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55322' || target.pathname !== '/postgres') {
  throw new Error('Invitation concurrency is restricted to the disposable local database on port 55322.');
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function psql(sql, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--dbname', databaseUrl], {stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => {stdout += chunk; if (ready && stdout.includes('INVITATION_LOCK_HELD')) {ready(); ready = null;}});
    child.stderr.on('data', (chunk) => {stderr += chunk;});
    child.on('error', reject);
    child.on('exit', (code) => resolve({code, stdout, stderr}));
    child.stdin.end(sql);
  });
}
function requireSuccess(result) {
  if (result.code !== 0) throw new Error('Local invitation concurrency query failed; SQL diagnostics are withheld.');
  return result.stdout.trim();
}
const ids = Object.fromEntries(['tenant', 'household', 'actorA', 'actorB', 'keyA', 'keyB'].map((name) => [name, randomUUID()]));
const suffix = ids.tenant.slice(0, 8);
const emails = [`invite-race-a-${suffix}@example.test`, `invite-race-b-${suffix}@example.test`];
requireSuccess(await psql(`begin;
insert into auth.users (id,aud,role,email,email_confirmed_at) values
  (${literal(ids.actorA)},'authenticated','authenticated',${literal(emails[0])},statement_timestamp()),
  (${literal(ids.actorB)},'authenticated','authenticated',${literal(emails[1])},statement_timestamp());
insert into auth.sessions(id,user_id,created_at,updated_at) values (${literal(ids.actorA)},${literal(ids.actorA)},statement_timestamp(),statement_timestamp()),(${literal(ids.actorB)},${literal(ids.actorB)},statement_timestamp(),statement_timestamp());
    insert into app.tenants (id,slug,name,status) values (${literal(ids.tenant)},${literal('invite-race-'+suffix)},'Invitation concurrency fixture','active');
insert into app.tenant_memberships (tenant_id,auth_user_id,status) values
  (${literal(ids.tenant)},${literal(ids.actorA)},'active'),(${literal(ids.tenant)},${literal(ids.actorB)},'active');
insert into app.households (id,tenant_id,label,intake_code_hash,status) values
  (${literal(ids.household)},${literal(ids.tenant)},'Invitation race',extensions.digest(${literal(randomUUID())},'sha256'),'active');
insert into app.household_access_grants (tenant_id,household_id,auth_user_id,can_view_progress,can_invite_executor,granted_by_auth_user_id) values
  (${literal(ids.tenant)},${literal(ids.household)},${literal(ids.actorA)},false,true,${literal(ids.actorA)}),
  (${literal(ids.tenant)},${literal(ids.household)},${literal(ids.actorB)},false,true,${literal(ids.actorA)});
commit;`));
const command = (actor, email, key, index, hold) => `begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',${literal(actor)},true);
select set_config('request.jwt.claim.email',${literal(email)},true);select set_config('request.jwt.claims',${literal(JSON.stringify({sub:actor,session_id:actor,email,role:'authenticated'}))},true);
select * from api.create_household_invitation_v2(${literal(ids.tenant)},${literal(ids.household)},'Extra','Race',
  ${literal(`recipient-${index}-${suffix}@example.test`)},${literal(createHash('sha256').update(randomUUID()).digest('hex'))},false,false,1,${literal(key)});
${hold ? "select 'INVITATION_LOCK_HELD'; select pg_sleep(3);" : ''}
commit;`;
let markReady;
const ready = new Promise((resolve) => {markReady = resolve;});
const first = psql(command(ids.actorA, emails[0], ids.keyA, 'a', true), markReady);
await Promise.race([ready, first.then((result) => {requireSuccess(result); throw new Error('Invitation race did not reach its lock barrier.');})]);
const started = Date.now();
const second = await psql(command(ids.actorB, emails[1], ids.keyB, 'b', false));
const waited = Date.now() - started;
requireSuccess(await first);
assert.notEqual(second.code, 0);
assert.ok(second.stderr.includes('STALE_VERSION'), 'same dossier version must lose with STALE_VERSION');
assert.ok(waited >= 2500, 'second command must wait for the first transaction');
const readback = JSON.parse(requireSuccess(await psql(`select json_build_object(
  'invitations',(select count(*) from app.household_invitations where tenant_id=${literal(ids.tenant)}),
  'household_version',(select version from app.households where id=${literal(ids.household)}),
  'completed_commands',(select count(*) from app.idempotency_records where tenant_id=${literal(ids.tenant)} and status='completed'),
  'creation_audits',(select count(*) from app.audit_events where tenant_id=${literal(ids.tenant)} and action='household.invitation_created'));`)));
assert.deepEqual(readback, {invitations: 1, household_version: 2, completed_commands: 1, creation_audits: 1});
console.log(JSON.stringify({scenario: 'HOUSEHOLD_INVITATION_VERSION_SERIALIZATION', contenders: 2, waited_milliseconds: waited, conflict: 'STALE_VERSION', readback, result: 'PASS'}));
