// Native authority fences in the caller's existing disposable PG17 fixture.
// Ciphertexts and receipts below are structural test inputs. They contain no
// ClientID and prove neither provider access nor a valid server attestation.
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import {IMAGE} from '../../scripts/pg17-capture-worker.mjs';
import {INITIAL_RESTORE_STARTUP} from '../../scripts/staging-pwa-upgrade-restore.mjs';

const environment = {PATH: '/usr/bin:/bin', LANG: 'C.UTF-8'};
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const jsonLiteral = value => literal(JSON.stringify(value)) + '::jsonb';
const jsonRows = value => value.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
const structuralEnvelope = character => ({v: 1, nonce: character.repeat(16), ciphertext: character.repeat(8), tag: character.repeat(22)});

export async function runOwnedSportlinkAuthority({name, socket, sql, json}) {
  assert.match(name, /^cluvo-pwa-writer-test-[0-9a-f]{24}$/);
  assert.ok(['unix:///run/user/1001/docker.sock', 'unix:///var/run/docker.sock'].includes(socket));
  assert.equal(typeof sql, 'function');
  assert.equal(typeof json, 'function');

  const docker = (args, input) => spawnSync('/usr/bin/docker', ['--host', socket, ...args], {
    input, env: environment, encoding: 'utf8', timeout: 15000, maxBuffer: 1000000,
  });
  const controlJson = args => {
    const result = docker(args);
    assert.equal(result.status, 0, 'OWNED_SPORTLINK_CONTROL_FAILED');
    return JSON.parse(result.stdout);
  };
  const image = controlJson(['image', 'inspect', IMAGE, '--format', '{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']);
  assert.ok(image.digests.includes(IMAGE), 'OWNED_SPORTLINK_IMAGE_PIN_REQUIRED');
  const guard = () => {
    const owned = controlJson(['inspect', name, '--format', '{"name":{{json .Name}},"image":{{json .Image}},"config_image":{{json .Config.Image}},"label":{{json (index .Config.Labels "cluvo.pwa.writer-test")}},"network":{{json .HostConfig.NetworkMode}},"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}},"ports":{{json .HostConfig.PortBindings}},"binds":{{json .HostConfig.Binds}},"volumes_from":{{json .HostConfig.VolumesFrom}},"privileged":{{json .HostConfig.Privileged}},"log":{{json .HostConfig.LogConfig.Type}},"user":{{json .Config.User}},"entrypoint":{{json .Config.Entrypoint}},"arguments":{{json .Config.Cmd}},"restart":{{json .HostConfig.RestartPolicy.Name}},"state":{{json .State.Status}}}']);
    assert.equal(owned.name, '/' + name);
    assert.equal(owned.image, image.id);
    assert.equal(owned.config_image, IMAGE);
    assert.equal(owned.label, name);
    assert.equal(owned.network, 'none');
    // Docker --tmpfs is represented by HostConfig.Tmpfs and can leave Mounts
    // empty. Match the established restore guard, including any actual mounts.
    assert.deepEqual(owned.tmpfs, {'/restore': 'rw,size=512m,mode=1777'});
    assert.ok(Array.isArray(owned.mounts) && owned.mounts.every(mount => mount.Type === 'tmpfs' && mount.Destination === '/restore'));
    assert.deepEqual(owned.entrypoint, ['/bin/sh']);
    assert.deepEqual(owned.arguments, ['-c', INITIAL_RESTORE_STARTUP, 'cluvo-pwa-writer-test', 'supabase_admin']);
    assert.equal(owned.restart, 'no');
    assert.ok(owned.ports === null || Object.keys(owned.ports).length === 0);
    assert.ok(!owned.binds && !owned.volumes_from && !owned.privileged);
    assert.equal(owned.log, 'none');
    assert.equal(owned.user, 'postgres');
    assert.equal(owned.state, 'running');
  };
  guard();
  const inventory = JSON.parse(sql(`SELECT jsonb_build_object('version',current_setting('server_version_num')::integer,
    'migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),
    'cipher_table',to_regclass('app.sportlink_connection_credentials') IS NOT NULL,
    'authenticator_login',(SELECT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='authenticator'),
    'authenticator_member',pg_has_role('authenticator','authenticated','MEMBER'),
    'data_directory',current_setting('data_directory'),'config_file',current_setting('config_file'),
    'hba_file',current_setting('hba_file'),'unix_socket_directories',current_setting('unix_socket_directories'),
    'logging_collector',current_setting('logging_collector'),'listen_addresses',current_setting('listen_addresses'),
    'archive_mode',current_setting('archive_mode'),'temp_tablespaces',current_setting('temp_tablespaces'),
    'external_tablespaces',(SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN ('pg_default','pg_global')));`, {role: 'supabase_admin'}));
  assert.ok(inventory.version >= 170000 && inventory.version < 180000);
  assert.equal(inventory.migrations, 35);
  assert.equal(inventory.cipher_table, true);
  assert.equal(inventory.authenticator_login, true);
  assert.equal(inventory.authenticator_member, true);
  assert.equal(inventory.data_directory, '/restore/pgdata');
  assert.equal(inventory.config_file, '/restore/pgdata/postgresql.conf');
  assert.equal(inventory.hba_file, '/restore/pgdata/pg_hba.conf');
  assert.equal(inventory.unix_socket_directories, '/restore');
  assert.equal(inventory.logging_collector, 'off');
  assert.equal(inventory.listen_addresses, '');
  assert.equal(inventory.archive_mode, 'off');
  assert.equal(inventory.temp_tablespaces, '');
  assert.equal(inventory.external_tablespaces, 0);

  const psqlArguments = (role = 'postgres') => ['--host', socket, 'exec', '-i', name, 'psql', '-X', '--quiet',
    '--no-align', '--tuples-only', '--no-password', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=verbose',
    '-h', '/restore', '-U', role, '-d', 'postgres'];

  function persistent() {
    const child = spawn('/usr/bin/docker', psqlArguments(), {env: environment, stdio: ['pipe', 'pipe', 'pipe']});
    let output = '', diagnostic = '', pending, ended = false;
    const exited = new Promise(resolve => {
      child.once('error', () => { pending?.reject(Error('OWNED_SPORTLINK_HOLDER_UNAVAILABLE')); });
      child.once('close', code => {
        ended = true;
        if (pending) { clearTimeout(pending.timer); pending.reject(Error('OWNED_SPORTLINK_HOLDER_CLOSED')); pending = undefined; }
        resolve(code);
      });
    });
    child.stderr.on('data', bytes => { diagnostic += bytes.toString(); });
    child.stdout.on('data', bytes => {
      output += bytes.toString();
      if (output.length + diagnostic.length > 1000000) { child.kill('SIGKILL'); return; }
      if (!pending) return;
      const end = output.indexOf(pending.marker + '\n');
      if (end < 0) return;
      const active = pending;
      pending = undefined;
      clearTimeout(active.timer);
      const value = output.slice(0, end).trim();
      output = output.slice(end + active.marker.length + 1);
      if (diagnostic) active.reject(Error('OWNED_SPORTLINK_HOLDER_SQL_FAILED'));
      else active.resolve(value);
    });
    return {
      query: text => new Promise((resolve, reject) => {
        assert.equal(ended, false);
        assert.equal(pending, undefined);
        const marker = 'owned_sportlink_' + randomBytes(12).toString('hex');
        pending = {marker, resolve, reject, timer: setTimeout(() => {
          pending = undefined; child.kill('SIGKILL'); reject(Error('OWNED_SPORTLINK_HOLDER_TIMEOUT'));
        }, 15000)};
        child.stdin.write(text + '\n\\echo ' + marker + '\n');
      }),
      close: async () => {
        if (!ended) child.stdin.end('ROLLBACK;\n\\q\n');
        const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
        try { return (await exited) === 0; } finally { clearTimeout(timer); }
      },
    };
  }

  function contender(text) {
    const child = spawn('/usr/bin/docker', psqlArguments('authenticator'), {env: environment, stdio: ['pipe', 'pipe', 'pipe']});
    let output = '', diagnostic = '', timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 20000);
    const done = new Promise(resolve => {
      child.once('error', () => { timedOut = true; });
      child.once('close', code => {
        clearTimeout(timer);
        resolve({code, stdout: output, timedOut,
          sqlstate: diagnostic.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? null,
          error: diagnostic.match(/ERROR:\s+[A-Z0-9]{5}:\s*([A-Z_]+)/)?.[1] ?? null});
      });
    });
    for (const [stream, append] of [[child.stdout, bytes => { output += bytes; }], [child.stderr, bytes => { diagnostic += bytes; }]]) {
      stream.on('data', bytes => { append(bytes.toString()); if (output.length + diagnostic.length > 1000000) { timedOut = true; child.kill('SIGKILL'); } });
    }
    child.stdin.end('SET client_min_messages=warning;\n' + text);
    return {done, stop: () => child.kill('SIGKILL')};
  }

  // The independent administrative observers are restricted to this guarded
  // container. API contenders always log in as authenticator and SET ROLE.
  const observe = text => JSON.parse(sql(text, {role: 'supabase_admin'}));
  async function waitForBlock(applicationName, holderPid, functionName) {
    let before;
    for (let attempt = 0; attempt < 60; attempt++) {
      before = observe(`SELECT jsonb_build_object('observer_pid',pg_backend_pid(),'count',count(*),'pid',max(pid),
        'wait_lock',bool_and(wait_event_type='Lock'),'holder_blocks',bool_and(${holderPid}=ANY(pg_blocking_pids(pid))),
        'query_matches',bool_and(query LIKE '%api.${functionName}(%')) FROM pg_stat_activity
        WHERE application_name=${literal(applicationName)};`);
      if (before.count === 1 && before.wait_lock && before.holder_blocks && before.query_matches) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(before.count, 1, 'OWNED_SPORTLINK_SINGLE_CONTENDER_REQUIRED');
    assert.equal(before.wait_lock, true, 'OWNED_SPORTLINK_REAL_LOCK_WAIT_REQUIRED');
    assert.equal(before.holder_blocks, true, 'OWNED_SPORTLINK_ACTUAL_BLOCKER_REQUIRED');
    assert.equal(before.query_matches, true, 'OWNED_SPORTLINK_NATIVE_CALL_REQUIRED');
    const independent = observe(`SELECT jsonb_build_object('observer_pid',pg_backend_pid(),'pid',pid,
      'holder_blocks',${holderPid}=ANY(pg_blocking_pids(pid)),'wait_event_type',wait_event_type)
      FROM pg_stat_activity WHERE pid=${before.pid} AND application_name=${literal(applicationName)};`);
    assert.notEqual(independent.observer_pid, before.observer_pid);
    assert.equal(independent.pid, before.pid);
    assert.equal(independent.holder_blocks, true);
    assert.equal(independent.wait_event_type, 'Lock');
    return {holder_backend_pid: holderPid, contender_backend_pid: before.pid,
      observer_backend_pids: [before.observer_pid, independent.observer_pid],
      actual_blocked_contenders: 1, independent_observer_confirmations: 2,
      holder_is_actual_blocker: true, native_call_matches: true, wait_event_type: 'Lock',
      wait_observed_before_revocation: true};
  }
  function assertStillBlocked(applicationName, proof) {
    const after = observe(`SELECT jsonb_build_object('observer_pid',pg_backend_pid(),'pid',pid,
      'holder_blocks',${proof.holder_backend_pid}=ANY(pg_blocking_pids(pid)),'wait_event_type',wait_event_type)
      FROM pg_stat_activity WHERE pid=${proof.contender_backend_pid} AND application_name=${literal(applicationName)};`);
    assert.equal(after.pid, proof.contender_backend_pid);
    assert.equal(after.holder_blocks, true);
    assert.equal(after.wait_event_type, 'Lock');
    assert.ok(!proof.observer_backend_pids.includes(after.observer_pid));
    proof.observer_backend_pids.push(after.observer_pid);
    proof.wait_observed_after_revocation = true;
    proof.independent_revocation_committed_while_blocked = true;
  }

  const scenarios = [];
  for (const kind of ['authorized_configuration_retry', 'configure_grant_revoked_while_waiting', 'record_test_session_expired_while_waiting']) {
    guard();
    const ids = Object.fromEntries(['tenant', 'actor', 'session', 'grant', 'connection', 'configureKey', 'testKey'].map(key => [key, randomUUID()]));
    const suffix = ids.tenant.slice(0, 12).replaceAll('-', '');
    const email = 'owned-sportlink-' + suffix + '@example.test';
    const applicationName = 'owned-sportlink-' + suffix;
    const envelope = structuralEnvelope('A'), fingerprint = '8'.repeat(64);
    sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(${literal(ids.actor)},${literal(email)},statement_timestamp());
      INSERT INTO auth.sessions(id,user_id) VALUES(${literal(ids.session)},${literal(ids.actor)});
      INSERT INTO app.tenants(id,slug,name,status) VALUES(${literal(ids.tenant)},${literal('owned-sportlink-' + suffix)},'Owned synthetic Sportlink club','active');
      INSERT INTO app.tenant_memberships(tenant_id,auth_user_id,status) VALUES(${literal(ids.tenant)},${literal(ids.actor)},'active');
      INSERT INTO app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id)
      SELECT ${literal(ids.grant)},${literal(ids.tenant)},${literal(ids.actor)},id,'tenant',${literal(ids.actor)}
      FROM app.permission_roles WHERE tenant_id=${literal(ids.tenant)} AND role_key='board';`);
    assert.equal(json(`SELECT count(*) FROM app.access_grants WHERE id=${literal(ids.grant)} AND tenant_id=${literal(ids.tenant)};`), 1);
    const claims = {sub: ids.actor, session_id: ids.session, email, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600};
    const authenticated = statement => `SET application_name=${literal(applicationName)};SET statement_timeout='15s';BEGIN;
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claims',${literal(JSON.stringify(claims))},true) IS NOT NULL;
      SELECT set_config('request.jwt.claim.sub',${literal(ids.actor)},true) IS NOT NULL;
      SELECT set_config('request.jwt.claim.email',${literal(email)},true) IS NOT NULL;
      SELECT jsonb_build_object('native_session_valid',internal.actor_has_active_session(),'database_role',current_user,
        'database_session_user',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),
        'bypassrls',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user));
      ${statement}\nCOMMIT;`;
    const configure = (value = envelope) => `SELECT api.configure_sportlink_connection(${literal(ids.tenant)},${literal(ids.connection)},0,
      ${jsonLiteral(value)},${literal(fingerprint)},${literal(ids.configureKey)});`;
    const assertNativeActor = result => {
      assert.equal(result.timedOut, false, 'OWNED_SPORTLINK_CONTENDER_TIMEOUT');
      assert.deepEqual(jsonRows(result.stdout)[0], {native_session_valid: true, database_role: 'authenticated',
        database_session_user: 'authenticator', superuser: false, bypassrls: false});
    };
    const successful = async statement => {
      const result = await contender(authenticated(statement)).done;
      assertNativeActor(result);
      assert.equal(result.code, 0, 'OWNED_SPORTLINK_POSITIVE_COMMAND_FAILED');
      assert.equal(result.sqlstate, null);
      return jsonRows(result.stdout).at(-1);
    };
    let holder, pending, waitProof = null, result, retryProved = false;
    const started = Date.now();
    try {
      if (kind === 'authorized_configuration_retry') {
        const receipt = await successful(configure());
        const retry = await successful(configure(structuralEnvelope('B')));
        assert.deepEqual(retry, receipt, 'OWNED_SPORTLINK_SEMANTIC_RETRY_CHANGED_RECEIPT');
        assert.equal(receipt.ok, true); assert.equal(receipt.resource_id, ids.connection); assert.equal(receipt.version, 1);
        assert.equal(receipt.event_ids.length, 1);
        const credential = await successful(`SELECT api.sportlink_connection_credential(${literal(ids.tenant)},${literal(ids.connection)},1);`);
        assert.deepEqual(credential, {connection_id: ids.connection, version: 1, credential_envelope: envelope, credential_fingerprint: fingerprint});
        const state = await successful(`SELECT api.sportlink_connection_state(${literal(ids.tenant)});`);
        assert.deepEqual(state, {authorized: true, connection: {id: ids.connection, version: 1, status: 'preparing',
          configured: true, last_success_at: null, credential_fingerprint: fingerprint, last_test: null}});
        retryProved = true;
        result = {code: 0, sqlstate: null, error: null};
      } else {
        let statement, holderStatement, functionName;
        if (kind === 'configure_grant_revoked_while_waiting') {
          functionName = 'configure_sportlink_connection'; statement = configure();
          holderStatement = `SELECT pg_advisory_xact_lock(hashtextextended('cluvo-sportlink:' || ${literal(ids.tenant)}::uuid::text,0));`;
        } else {
          await successful(configure());
          functionName = 'record_sportlink_connection_test';
          const structuralReceipt = {v: 1, signature: 'A'.repeat(43), receipt: {source: 'sportlink_dataservice_read_test_v1',
            idempotency_key: ids.testKey, checked_at: new Date().toISOString(), code: 'VERIFIED_READ_ACCESS',
            capabilities: {matches: true, match_details: false, teams: false, member_import: false, duration_units_verified: false}}};
          statement = `SELECT api.record_sportlink_connection_test(${literal(ids.tenant)},${literal(ids.connection)},1,
            ${jsonLiteral(structuralReceipt)},${literal(ids.testKey)});`;
          holderStatement = `SELECT 1 FROM app.integration_connections WHERE tenant_id=${literal(ids.tenant)} AND id=${literal(ids.connection)} FOR UPDATE;`;
        }
        holder = persistent();
        const held = jsonRows(await holder.query(`SET client_min_messages=warning;SET idle_in_transaction_session_timeout='25s';BEGIN;
          ${holderStatement} SELECT jsonb_build_object('pid',pg_backend_pid());`)).at(-1);
        assert.ok(Number.isSafeInteger(held.pid) && held.pid > 0);
        pending = contender(authenticated(statement));
        waitProof = await waitForBlock(applicationName, held.pid, functionName);
        const changed = kind === 'configure_grant_revoked_while_waiting'
          ? json(`WITH changed AS (UPDATE app.access_grants SET revoked_at=clock_timestamp(),version=version+1
              WHERE id=${literal(ids.grant)} AND tenant_id=${literal(ids.tenant)} AND auth_user_id=${literal(ids.actor)}
              AND revoked_at IS NULL RETURNING id) SELECT jsonb_build_object('changed_rows',count(*)) FROM changed;`)
          : json(`WITH changed AS (UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 day'
              WHERE id=${literal(ids.session)} AND user_id=${literal(ids.actor)} AND not_after IS NULL RETURNING id)
              SELECT jsonb_build_object('changed_rows',count(*)) FROM changed;`);
        assert.equal(changed.changed_rows, 1);
        assertStillBlocked(applicationName, waitProof);
        await holder.query('COMMIT;');
        result = await pending.done;
        assertNativeActor(result);
        assert.notEqual(result.code, 0);
        assert.equal(result.sqlstate, '42501', 'OWNED_SPORTLINK_REVOKED_AUTHORITY_NOT_RECHECKED');
        assert.equal(result.error, 'FORBIDDEN');
      }
      const configured = kind !== 'configure_grant_revoked_while_waiting';
      const readback = json(`SELECT jsonb_build_object(
        'connections',(SELECT count(*) FROM app.integration_connections WHERE tenant_id=${literal(ids.tenant)}),
        'credentials',(SELECT count(*) FROM app.sportlink_connection_credentials WHERE tenant_id=${literal(ids.tenant)}),
        'connection_version',(SELECT version FROM app.integration_connections WHERE tenant_id=${literal(ids.tenant)} AND id=${literal(ids.connection)}),
        'connection_status',(SELECT status FROM app.integration_connections WHERE tenant_id=${literal(ids.tenant)} AND id=${literal(ids.connection)}),
        'capabilities',(SELECT capabilities FROM app.integration_connections WHERE tenant_id=${literal(ids.tenant)} AND id=${literal(ids.connection)}),
        'last_test',(SELECT last_test FROM app.sportlink_connection_credentials WHERE tenant_id=${literal(ids.tenant)} AND connection_id=${literal(ids.connection)}),
        'last_success_at',(SELECT last_success_at FROM app.integration_connections WHERE tenant_id=${literal(ids.tenant)} AND id=${literal(ids.connection)}),
        'audits',(SELECT count(*) FROM app.audit_events WHERE tenant_id=${literal(ids.tenant)}),
        'events',(SELECT count(*) FROM app.domain_events WHERE tenant_id=${literal(ids.tenant)}),
        'configured_audits',(SELECT count(*) FROM app.audit_events WHERE tenant_id=${literal(ids.tenant)} AND action='integration.sportlink_configured'),
        'configured_events',(SELECT count(*) FROM app.domain_events WHERE tenant_id=${literal(ids.tenant)} AND event_type='integration.sportlink_configured'),
        'recorded_test_audits',(SELECT count(*) FROM app.audit_events WHERE tenant_id=${literal(ids.tenant)} AND action='integration.sportlink_read_test_recorded'),
        'recorded_test_events',(SELECT count(*) FROM app.domain_events WHERE tenant_id=${literal(ids.tenant)} AND event_type='integration.sportlink_read_test_recorded'),
        'completed_configuration_commands',(SELECT count(*) FROM app.idempotency_records WHERE tenant_id=${literal(ids.tenant)} AND operation='configure_sportlink_connection' AND status='completed'),
        'record_test_commands',(SELECT count(*) FROM app.idempotency_records WHERE tenant_id=${literal(ids.tenant)} AND operation='record_sportlink_connection_test'),
        'grant_revoked',(SELECT revoked_at IS NOT NULL FROM app.access_grants WHERE id=${literal(ids.grant)} AND tenant_id=${literal(ids.tenant)}),
        'grant_version',(SELECT version FROM app.access_grants WHERE id=${literal(ids.grant)} AND tenant_id=${literal(ids.tenant)}),
        'session_expired',(SELECT not_after IS NOT NULL AND not_after<statement_timestamp() FROM auth.sessions WHERE id=${literal(ids.session)} AND user_id=${literal(ids.actor)}),
        'matches',(SELECT count(*) FROM app.matches WHERE tenant_id=${literal(ids.tenant)}),
        'ledger_rows',(SELECT count(*) FROM app.hour_ledger_entries WHERE tenant_id=${literal(ids.tenant)}));`);
      const count = configured ? 1 : 0;
      assert.deepEqual(readback, {connections: count, credentials: count, connection_version: configured ? 1 : null,
        connection_status: configured ? 'preparing' : null, capabilities: configured ? {} : null, last_test: null, last_success_at: null,
        audits: count, events: count, configured_audits: count, configured_events: count, recorded_test_audits: 0, recorded_test_events: 0,
        completed_configuration_commands: count, record_test_commands: 0,
        grant_revoked: !configured, grant_version: configured ? 1 : 2,
        session_expired: kind === 'record_test_session_expired_while_waiting', matches: 0, ledger_rows: 0});
      scenarios.push({kind, elapsed_ms: Date.now() - started, exit_status: result.code, sqlstate: result.sqlstate,
        error_code: result.error, native_actor_proved: true, same_command_retry_proved: retryProved, wait_proof: waitProof, readback});
    } finally {
      if (holder) assert.equal(await holder.close(), true, 'OWNED_SPORTLINK_HOLDER_CLEANUP_FAILED');
      if (pending) { pending.stop(); await pending.done; }
    }
  }
  guard();
  return {scope: 'LOCAL_OWNED_PG17_SPORTLINK_AUTHORITY_FENCE', passed: true, migrations: inventory.migrations,
    guarded_container_reused: true, container_lifecycle_owned_by_caller: true, network: 'none', postgres_writes_on_tmpfs: true,
    native_claims_and_confirmed_auth_fixture: true, structural_ciphertext_fixture_only: true,
    structural_receipt_fixture_only: true, provider_access_proved: false, provider_called: false,
    shared_database_connections: 0, production_enabled: false, scenarios};
}
