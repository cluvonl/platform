import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for the disposable A13 concurrency test.');
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [
      '--no-psqlrc',
      '--set', 'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
      '--dbname', databaseUrl,
    ], {stdio: ['pipe', 'pipe', 'pipe']});
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
  if (result.code !== 0) {
    throw new Error(`${label} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

const ids = Object.fromEntries([
  'tenant', 'actorA', 'actorB', 'personA', 'personB', 'committee',
  'household', 'season', 'obligation', 'category', 'taskType', 'taskVersion',
  'shift', 'position', 'grantA', 'grantB', 'idempotencyA', 'idempotencyB',
].map((key) => [key, randomUUID()]));
const suffix = ids.tenant.slice(0, 8);
const shiftStartsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const shiftEndsAt = new Date(Date.parse(shiftStartsAt) + 2 * 60 * 60 * 1000).toISOString();

const setup = `
begin;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  (${sqlLiteral(ids.actorA)}, 'authenticated', 'authenticated', ${sqlLiteral(`race-a-${suffix}@example.test`)}, '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp()),
  (${sqlLiteral(ids.actorB)}, 'authenticated', 'authenticated', ${sqlLiteral(`race-b-${suffix}@example.test`)}, '{}'::jsonb, '{}'::jsonb, statement_timestamp(), statement_timestamp());
update auth.users set email_confirmed_at=statement_timestamp() where id in (${sqlLiteral(ids.actorA)},${sqlLiteral(ids.actorB)});
insert into auth.sessions(id,user_id,created_at,updated_at) values
 (${sqlLiteral(ids.actorA)},${sqlLiteral(ids.actorA)},statement_timestamp(),statement_timestamp()),
 (${sqlLiteral(ids.actorB)},${sqlLiteral(ids.actorB)},statement_timestamp(),statement_timestamp());
insert into app.tenants (id, slug, name, status) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(`race-${suffix}`)}, 'A13 concurrency fixture', 'active');
insert into app.account_profiles (auth_user_id, display_name) values
  (${sqlLiteral(ids.actorA)}, 'Race A'), (${sqlLiteral(ids.actorB)}, 'Race B');
insert into app.persons (id, tenant_id, given_name, family_name, birth_date, birth_date_precision, status) values
  (${sqlLiteral(ids.personA)}, ${sqlLiteral(ids.tenant)}, 'Race', 'A', '1980-01-01', 'day', 'active'),
  (${sqlLiteral(ids.personB)}, ${sqlLiteral(ids.tenant)}, 'Race', 'B', '1980-01-01', 'day', 'active');
insert into app.account_person_links (tenant_id, auth_user_id, person_id, verified_at) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.actorA)}, ${sqlLiteral(ids.personA)}, statement_timestamp()),
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.actorB)}, ${sqlLiteral(ids.personB)}, statement_timestamp());
insert into app.tenant_memberships (tenant_id, auth_user_id, status) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.actorA)}, 'active'),
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.actorB)}, 'active');
insert into app.committees (id, tenant_id, slug, name) values
  (${sqlLiteral(ids.committee)}, ${sqlLiteral(ids.tenant)}, 'race', 'Racecommissie');
insert into app.households (id, tenant_id, label, intake_code_hash, status) values
  (${sqlLiteral(ids.household)}, ${sqlLiteral(ids.tenant)}, 'Racehuishouden', extensions.digest('race-${suffix}', 'sha256'), 'active');
insert into app.household_person_links (tenant_id, household_id, person_id, kind, verified_by_auth_user_id) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.household)}, ${sqlLiteral(ids.personA)}, 'executor', ${sqlLiteral(ids.actorA)}),
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.household)}, ${sqlLiteral(ids.personB)}, 'executor', ${sqlLiteral(ids.actorA)});
insert into app.seasons (id, tenant_id, name, starts_on, ends_on, winter_cutoff_at, target_minutes, winter_target_minutes, status) values
  (${sqlLiteral(ids.season)}, ${sqlLiteral(ids.tenant)}, 'A13', current_date - 30, current_date + 335, statement_timestamp() + interval '90 days', 720, 360, 'active');
insert into app.obligations (id, tenant_id, season_id, assessed_household_id, base_target_minutes, effective_target_minutes, effective_winter_minutes, status) values
  (${sqlLiteral(ids.obligation)}, ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.season)}, ${sqlLiteral(ids.household)}, 720, 720, 360, 'active');
insert into app.household_obligation_links (tenant_id, household_id, obligation_id, link_kind) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.household)}, ${sqlLiteral(ids.obligation)}, 'liable');
insert into app.executor_obligation_grants (tenant_id, person_id, obligation_id, valid_from, approved_by_auth_user_id) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.personA)}, ${sqlLiteral(ids.obligation)}, statement_timestamp() - interval '1 day', ${sqlLiteral(ids.actorA)}),
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.personB)}, ${sqlLiteral(ids.obligation)}, statement_timestamp() - interval '1 day', ${sqlLiteral(ids.actorA)});
insert into app.access_grants (tenant_id, auth_user_id, role_id, scope_kind, granted_by_auth_user_id) values
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.actorA)}, (select id from app.permission_roles where tenant_id=${sqlLiteral(ids.tenant)} and role_key='member'), 'tenant', ${sqlLiteral(ids.actorA)}),
  (${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.actorB)}, (select id from app.permission_roles where tenant_id=${sqlLiteral(ids.tenant)} and role_key='member'), 'tenant', ${sqlLiteral(ids.actorA)});
insert into app.task_categories (id, tenant_id, committee_id, name) values
  (${sqlLiteral(ids.category)}, ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.committee)}, 'Racecategorie');
insert into app.task_types (id, tenant_id, category_id, name) values
  (${sqlLiteral(ids.taskType)}, ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.category)}, 'Racetaak');
insert into app.task_type_versions (id, tenant_id, task_type_id, revision, credit_minutes, approved_by_auth_user_id) values
  (${sqlLiteral(ids.taskVersion)}, ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.taskType)}, 1, 120, ${sqlLiteral(ids.actorA)});
insert into app.shifts (id, tenant_id, type_version_id, committee_id, category_id, title, starts_at, ends_at, credit_minutes, cancellation_minutes, state, published_at) values
  (${sqlLiteral(ids.shift)}, ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.taskVersion)}, ${sqlLiteral(ids.committee)}, ${sqlLiteral(ids.category)}, 'Laatste plaats race', ${sqlLiteral(shiftStartsAt)}, ${sqlLiteral(shiftEndsAt)}, 120, 2880, 'published', statement_timestamp());
insert into app.shift_positions (id, tenant_id, shift_id, ordinal, starts_at, ends_at) values
  (${sqlLiteral(ids.position)}, ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.shift)}, 1, ${sqlLiteral(shiftStartsAt)}, ${sqlLiteral(shiftEndsAt)});
commit;
`;
requireSuccess(await psql(setup), 'fixture setup');

function bookingSql(actor, person, idempotencyKey) {
  return `
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', ${sqlLiteral(actor)}, true);
select set_config('request.jwt.claims', ${sqlLiteral(JSON.stringify({sub: actor, role: 'authenticated', session_id: actor}))}, true);
select pg_sleep(0.2);
select resource_id from api.book_shift(
  ${sqlLiteral(ids.tenant)}, ${sqlLiteral(ids.shift)}, ${sqlLiteral(ids.position)},
  ${sqlLiteral(person)}, ${sqlLiteral(ids.obligation)}, 1, ${sqlLiteral(idempotencyKey)}
);
commit;
`;
}

const [first, second] = await Promise.all([
  psql(bookingSql(ids.actorA, ids.personA, ids.idempotencyA)),
  psql(bookingSql(ids.actorB, ids.personB, ids.idempotencyB)),
]);
const outcomes = [first, second];
const successes = outcomes.filter(({code}) => code === 0);
const conflicts = outcomes.filter(({code, stderr}) => code !== 0 && stderr.includes('CAPACITY_FULL'));
if (successes.length !== 1 || conflicts.length !== 1) {
  throw new Error(`Expected one booking and one CAPACITY_FULL; got ${JSON.stringify(outcomes.map(({code, stderr}) => ({code, error: stderr.trim()})))}`);
}

const bookingCount = Number(requireSuccess(await psql(
  `select count(*) from app.bookings where tenant_id=${sqlLiteral(ids.tenant)} and position_id=${sqlLiteral(ids.position)};`,
), 'booking readback'));
if (bookingCount !== 1) throw new Error(`Expected exactly one persisted booking, got ${bookingCount}.`);

console.log(JSON.stringify({scenario: 'A13_LAST_POSITION_RACE', contenders: 2, persisted_bookings: bookingCount, conflict: 'CAPACITY_FULL', result: 'PASS'}));
