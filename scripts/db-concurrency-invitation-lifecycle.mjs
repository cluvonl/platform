import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
const target = databaseUrl ? new URL(databaseUrl) : null;
if (!target || !['postgres:', 'postgresql:'].includes(target.protocol)
  || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55322' || target.pathname !== '/postgres') {
  throw new Error('Invitation lifecycle concurrency requires the disposable local database on port 55322.');
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function psql(sql, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--dbname', databaseUrl], {stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => {stdout += chunk; if (ready && stdout.includes('LIFECYCLE_LOCK_HELD')) {ready(); ready = null;}});
    child.stderr.on('data', (chunk) => {stderr += chunk;});
    child.on('error', reject);
    child.on('exit', (code) => resolve({code, stdout, stderr}));
    child.stdin.end(sql);
  });
}
function requireSuccess(result) {
  if (result.code !== 0) throw new Error('Invitation lifecycle query failed; private SQL diagnostics withheld.');
  return result.stdout.trim();
}
const scenarios = [];
for (const winner of ['cancellation', 'acceptance', 'authority_revocation', 'creation_authority_revocation']) {
  const ids = Object.fromEntries(['tenant', 'household', 'author', 'recipient'].map((name) => [name, randomUUID()]));
  const suffix = ids.tenant.slice(0, 8);
  const authorEmail = `lifecycle-author-${suffix}@example.test`, recipientEmail = `lifecycle-recipient-${suffix}@example.test`;
  const token = randomUUID() + randomUUID();
  requireSuccess(await psql(`begin;
    insert into auth.users (id,aud,role,email,email_confirmed_at) values
      (${literal(ids.author)},'authenticated','authenticated',${literal(authorEmail)},statement_timestamp()),
      (${literal(ids.recipient)},'authenticated','authenticated',${literal(recipientEmail)},statement_timestamp());
    insert into auth.sessions(id,user_id,created_at,updated_at) values (${literal(ids.author)},${literal(ids.author)},statement_timestamp(),statement_timestamp()),(${literal(ids.recipient)},${literal(ids.recipient)},statement_timestamp(),statement_timestamp());
    insert into app.tenants (id,slug,name,status) values (${literal(ids.tenant)},${literal('lifecycle-'+suffix)},'Local invitation lifecycle race','active');
    insert into app.tenant_memberships (tenant_id,auth_user_id,status) values (${literal(ids.tenant)},${literal(ids.author)},'active');
    insert into app.households (id,tenant_id,label,intake_code_hash,status) values
      (${literal(ids.household)},${literal(ids.tenant)},'Lifecycle fixture',extensions.digest(${literal(randomUUID())},'sha256'),'active');
    insert into app.household_access_grants (tenant_id,household_id,auth_user_id,can_view_progress,can_invite_executor,granted_by_auth_user_id) values
      (${literal(ids.tenant)},${literal(ids.household)},${literal(ids.author)},true,true,${literal(ids.author)});
    commit;`));
  const actor = (id, email) => `set local role authenticated;
    select set_config('request.jwt.claim.sub',${literal(id)},true);
    select set_config('request.jwt.claim.email',${literal(email)},true);select set_config('request.jwt.claims',${literal(JSON.stringify({sub:id,session_id:id,email,role:'authenticated'}))},true);`;
  requireSuccess(await psql(`begin; ${actor(ids.author, authorEmail)}
    select * from api.create_household_invitation_v2(${literal(ids.tenant)},${literal(ids.household)},'Extra','Lifecycle',
      ${literal(recipientEmail)},${literal(createHash('sha256').update(token).digest('hex'))},true,false,1,${literal(randomUUID())}); commit;`));
  const invitationId = requireSuccess(await psql(`select id from app.household_invitations where tenant_id=${literal(ids.tenant)};`));
  const cancel = (version = 1) => `${actor(ids.author, authorEmail)}
    select * from api.cancel_household_invitation(${literal(ids.tenant)},${literal(invitationId)},${version},${literal(randomUUID())});`;
  const accept = `${actor(ids.recipient, recipientEmail)}
    select * from api.accept_household_invitation_v2(${literal(token)},1,${literal(randomUUID())});`;
  const revoke = `select 1 from app.households where id=${literal(ids.household)} for update;
    update app.household_access_grants set can_invite_executor=false,version=version+1
      where tenant_id=${literal(ids.tenant)} and auth_user_id=${literal(ids.author)};`;
  const winningCommand = winner === 'cancellation' ? cancel() : winner === 'acceptance' ? accept : revoke;
  const creation = `${actor(ids.author, authorEmail)}
    select * from api.create_household_invitation_v2(${literal(ids.tenant)},${literal(ids.household)},'Extra','After revoke',
      ${literal('second-'+recipientEmail)},${literal(createHash('sha256').update(randomUUID()).digest('hex'))},true,false,2,${literal(randomUUID())});`;
  const losingCommand = winner === 'cancellation' ? accept : winner === 'creation_authority_revocation' ? creation : cancel();
  let markReady;
  const ready = new Promise((resolve) => {markReady = resolve;});
  const first = psql(`begin; ${winningCommand} select 'LIFECYCLE_LOCK_HELD'; select pg_sleep(3); commit;`, markReady);
  await Promise.race([ready, first.then((result) => {requireSuccess(result); throw new Error('Lifecycle race missed its lock barrier.');})]);
  const started = Date.now();
  const second = await psql(`begin; ${losingCommand} commit;`);
  const waited = Date.now() - started;
  requireSuccess(await first);
  const conflict = winner === 'cancellation' ? 'INVALID_INVITATION' : winner === 'acceptance' ? 'STALE_VERSION' : 'FORBIDDEN';
  assert.notEqual(second.code, 0);
  assert.ok(second.stderr.includes(conflict), 'losing command must return its expected conflict');
  assert.ok(waited >= 2500, 'losing command must actually wait on the winning dossier transaction');
  if (winner === 'acceptance') {
    const current = await psql(`begin; ${cancel(2)} commit;`);
    assert.notEqual(current.code, 0);
    assert.ok(current.stderr.includes('INVITATION_ALREADY_ACCEPTED'));
  }
  const readback = JSON.parse(requireSuccess(await psql(`select json_build_object(
    'invitations',(select count(*) from app.household_invitations where tenant_id=${literal(ids.tenant)}),
    'status',(select delivery_status from app.household_invitations where id=${literal(invitationId)}),
    'invitation_version',(select version from app.household_invitations where id=${literal(invitationId)}),
    'household_version',(select version from app.households where id=${literal(ids.household)}),
    'recipient_grants',(select count(*) from app.household_access_grants where tenant_id=${literal(ids.tenant)} and auth_user_id=${literal(ids.recipient)}),
    'recipient_profiles',(select count(*) from app.intake_profiles where tenant_id=${literal(ids.tenant)}),
    'cancellation_audits',(select count(*) from app.audit_events where tenant_id=${literal(ids.tenant)} and action='household.invitation_cancelled'),
    'acceptance_audits',(select count(*) from app.audit_events where tenant_id=${literal(ids.tenant)} and action='household.invitation_acceptance_recorded'),
    'processing_commands',(select count(*) from app.idempotency_records where tenant_id=${literal(ids.tenant)} and status='processing'));`)));
  const accepted = winner === 'acceptance', revoked = ['authority_revocation', 'creation_authority_revocation'].includes(winner);
  assert.deepEqual(readback, {invitations: 1, status: accepted ? 'accepted' : revoked ? 'pending' : 'cancelled', invitation_version: revoked ? 1 : 2,
    household_version: revoked ? 2 : 3, recipient_grants: accepted ? 1 : 0, recipient_profiles: accepted ? 1 : 0,
    cancellation_audits: winner === 'cancellation' ? 1 : 0, acceptance_audits: accepted ? 1 : 0, processing_commands: 0});
  scenarios.push({winner, contenders: 2, waited_milliseconds: waited, conflict, readback, result: 'PASS'});
}
console.log(JSON.stringify({scenario: 'INVITATION_LIFECYCLE_SERIALIZATION', scenarios, result: 'PASS'}));
