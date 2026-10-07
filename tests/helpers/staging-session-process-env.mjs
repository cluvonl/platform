import assert from 'node:assert/strict';
import {stagingSessionProbe, SESSION_CHECKS} from '../../scripts/staging-session-probe.mjs';

assert.notEqual(Object.getPrototypeOf(process.env), Object.prototype);
process.env.LD_PRELOAD = 'must-not-be-inherited';
let calls = 0;
const report = await stagingSessionProbe(process.env, {execute: async (command, args, options) => {
  calls++;
  assert.equal(command, '/usr/bin/python3');
  assert.equal(args[0], '-B');
  assert.equal(options.env.PGPASSWORD, 'synthetic-password');
  assert.equal(options.env.PGSSLMODE, 'verify-full');
  assert.equal(Object.hasOwn(options.env, 'SECRET_EXTRA'), false);
  assert.equal(Object.hasOwn(options.env, 'LD_PRELOAD'), false);
  const value = {passed: true, scope: 'HOSTED_TRANSPORT_ONLY', checks: [...SESSION_CHECKS],
    transport: {client_tls: true, client_tls_protocol: 'TLSv1.3', postgres_version: 170011,
      libpq_version: 160015, backend_identity_mode: 'session_sql_backend_and_lock', protocol_pid_matches_sql_backend: false},
    returned_sessions_closed: true, backup_created: false, restore_executed: false,
    snapshot_import_verified: false, catalog_data_compared: false, migration_ready: false,
    remote_ddl_ready: false, v1_ready: false, production_enabled: false};
  return {status: 0, stdout: JSON.stringify(value), stderr: ''};
}});
assert.equal(calls, 1);
assert.equal(report.passed, true);
assert.equal(JSON.stringify(report).includes('synthetic-password'), false);
console.log('ACTUAL_PROCESS_ENV_TEST_PASS');
