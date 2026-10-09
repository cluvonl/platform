import assert from 'node:assert/strict';
import {test} from 'node:test';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {sealSportlinkCredential, sealSportlinkTestReceipt} from '../lib/sportlink/credentials.mjs';
import {sportlinkHttpsGet, testSportlinkReadAccess} from '../lib/sportlink/read-test.mjs';
import {checkSportlinkConnection, saveSportlinkConnection, sportlinkStateDTO} from '../lib/sportlink/server-core.mjs';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', connectionId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const idempotencyKey = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const secret = 'synthetic-owned-sportlink-key-for-boundary-checks-12345', clientId = 'SyntheticClientID_123';
const scope = {tenantId, connectionId};
const sealed = sealSportlinkCredential(clientId, secret, scope);
const request = {club: 'synthetic-club', connectionId, expectedVersion: 1, idempotencyKey};
const caps = {matches: true, match_details: true, teams: false, member_import: false, duration_units_verified: false};
const blankCaps = {matches: false, match_details: false, teams: false, member_import: false, duration_units_verified: false};
const now = Date.now();
function fixture({connection = {id: connectionId, version: 1, status: 'preparing', configured: true, last_success_at: null, credential_fingerprint: sealed.fingerprint, last_test: null}, denied, credential, recordError, revokeAtRecord} = {}) {
  const calls = [], provider = [];
  const deps = {secret: () => secret, now: () => now, probe: async (value) => {provider.push(value); return {code: 'VERIFIED_READ_ACCESS', capabilities: caps};},
    authorize: async (club) => {assert.equal(club, 'synthetic-club'); return {tenantId, rpc: async (name, args) => {
      calls.push({name, args});
      assert.equal(args.p_tenant_id, tenantId);
      if (denied || (revokeAtRecord && calls.some((c) => c.name === 'record_sportlink_connection_test'))) return {data: null, error: {code: '42501', message: 'FORBIDDEN'}};
      if (name === 'sportlink_connection_state') return {data: {authorized: true, connection}, error: null};
      if (name === 'sportlink_connection_credential') return credential ?? {data: {connection_id: connectionId, version: connection.version, credential_envelope: sealed.envelope, credential_fingerprint: sealed.fingerprint}, error: null};
      if (name === 'configure_sportlink_connection') {
        connection = {id: connectionId, version: connection ? connection.version + 1 : 1, configured: true, status: 'preparing', last_success_at: null,
          credential_fingerprint: args.p_credential_fingerprint, last_test: null};
        return {data: {ok: true, resource_id: connectionId, version: connection.version}, error: null};
      }
      if (name === 'record_sportlink_connection_test') {
        connection = {...connection, version: connection.version + 1, last_test: args.p_test_result};
        return recordError ? {data: null, error: recordError} : {data: {ok: true, resource_id: connectionId, version: connection.version}, error: null};
      }
      throw new Error('Unexpected RPC');
    }};}};
  return {deps, calls, provider};
}
const schema = {programma: {name: 'Programma', input: [], output: []}, 'wedstrijd-informatie': {name: 'Wedstrijd-informatie', input: [], output: []}};
const programme = [{wedstrijdcode: 12345, wedstrijddatum: '2026-10-10', ignored_contact: 'synthetic-person@example.test'}];
function json(value, status = 200) {return new Response(JSON.stringify(value), {status, headers: {'content-type': 'application/json; charset=utf-8'}});}

test('read test performs only two bounded fixed HTTPS GETs and returns no rows or credential', async () => {
  const calls = [];
  const result = await testSportlinkReadAccess(clientId, {fetcher: async (url, init) => {
    calls.push({url, init}); return json(url.pathname === '/list' ? schema : programme);
  }});
  assert.deepEqual(result, {code: 'VERIFIED_READ_ACCESS', capabilities: caps});
  assert.equal(calls.length, 2);
  for (const {url, init} of calls) {
    assert.equal(url.origin, 'https://data.sportlink.com');
    assert.equal(url.searchParams.get('client_id'), clientId);
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'omit');
    assert.ok(init.signal instanceof AbortSignal);
  }
  assert.deepEqual([...calls[1].url.searchParams.keys()].sort(), ['aantaldagen', 'aantalregels', 'client_id', 'gebruiklokaleteamgegevens']);
  assert.equal(calls[1].url.searchParams.get('aantalregels'), '1');
  assert.equal(JSON.stringify(result).includes(clientId), false);
  assert.equal(JSON.stringify(result).includes('synthetic-person'), false);
});
test('native transport avoids Next.js full-URL fetch instrumentation and keeps TLS/host/method fixed', async () => {
  const url = new URL('https://data.sportlink.com/list');
  url.searchParams.set('client_id', clientId);
  const signal = new AbortController().signal;
  let count = 0;
  const response = await sportlinkHttpsGet(url, {method: 'GET', signal}, (target, options, callback) => {
    count++;
    assert.equal(target, url); assert.equal(options.rejectUnauthorized, true); assert.equal(options.signal, signal);
    assert.deepEqual(options.headers, {Accept: 'application/json'});
    const request = new EventEmitter();
    request.end = () => {
      const body = Readable.from([Buffer.from(JSON.stringify(schema))]);
      body.statusCode = 200; body.headers = {'content-type': 'application/json', 'set-cookie': `ignored=${clientId}`};
      callback(body);
    };
    return request;
  });
  assert.deepEqual(await response.json(), schema); assert.equal(response.headers.has('set-cookie'), false); assert.equal(count, 1);
  await assert.rejects(sportlinkHttpsGet(new URL('http://127.0.0.1/list'), {method: 'GET'}, () => {throw new Error('Must never contact foreign host');}), /SPORTLINK_TRANSPORT_UNAVAILABLE/);
  await assert.rejects(sportlinkHttpsGet(url, {method: 'POST'}, () => {throw new Error('Must never send provider write');}), /SPORTLINK_TRANSPORT_UNAVAILABLE/);
});
test('provider errors, malicious redirects and unrecognized HTTP/body shapes never become verified access', async () => {
  for (const [fetcher, code] of [
    [async () => json({error: `rejected ${clientId}`}), 'INVALID_SOURCE_RESPONSE'],
    [async () => json({}, 403), 'PROVIDER_DENIED'],
    [async () => json({}, 429), 'PROVIDER_UNAVAILABLE'],
    [async () => {throw new Error(`secret URL ${clientId}`);}, 'PROVIDER_UNAVAILABLE'],
    [async () => new Response('<html>failure</html>', {headers: {'content-type': 'text/html'}}), 'INVALID_SOURCE_RESPONSE'],
    [async () => {const r = json(schema); Object.defineProperty(r, 'url', {value: 'https://attacker.invalid/list'}); return r;}, 'INVALID_SOURCE_RESPONSE'],
    [async () => json({...schema, error: null}), 'INVALID_SOURCE_RESPONSE'],
    [async () => json({'wedstrijd-informatie': schema['wedstrijd-informatie']}), 'CONTRACT_UNAVAILABLE'],
  ]) {
    const result = await testSportlinkReadAccess(clientId, {fetcher});
    assert.deepEqual(result, {code, capabilities: blankCaps});
    assert.equal(JSON.stringify(result).includes(clientId), false);
  }
});
test('response byte limits and one-record limit are enforced; an empty programme retains honest capability scope', async () => {
  for (const body of [[{error: 'provider error'}], [{wedstrijdcode: '123', wedstrijddatum: '2026-10-10'}], [...programme, ...programme]]) {
    const result = await testSportlinkReadAccess(clientId, {fetcher: async (url) => json(url.pathname === '/list' ? schema : body)});
    assert.equal(result.code, 'INVALID_SOURCE_RESPONSE');
  }
  const tooLarge = await testSportlinkReadAccess(clientId, {fetcher: async () => new Response(' '.repeat(131073), {headers: {'content-type': 'application/json'}})});
  assert.equal(tooLarge.code, 'INVALID_SOURCE_RESPONSE');
  const empty = await testSportlinkReadAccess(clientId, {fetcher: async (url) => json(url.pathname === '/list' ? schema : [])});
  assert.deepEqual(empty, {code: 'VERIFIED_READ_ACCESS', capabilities: caps});
});
test('early header rejection closes an unfinished native HTTPS response without requesting another article', async () => {
  for (const headers of [{'content-type': 'text/html'}, {'content-type': 'application/json', 'content-length': '131073'},
    {'content-type': 'application/json', 'content-length': 'invalid'}]) {
    let body, calls = 0;
    const result = await testSportlinkReadAccess(clientId, {fetcher: (url, init) => sportlinkHttpsGet(url, init, (_url, _options, callback) => {
      calls++;
      const request = new EventEmitter();
      request.end = () => {
        body = new Readable({read() {}});
        body.statusCode = 200; body.headers = headers;
        callback(body);
      };
      return request;
    })});
    assert.deepEqual(result, {code: 'INVALID_SOURCE_RESPONSE', capabilities: blankCaps});
    assert.equal(calls, 1); assert.equal(body.destroyed, true);
  }
});
test('a provider timeout is bounded and returns a safe failure', async () => {
  const result = await testSportlinkReadAccess(clientId, {timeoutMs: 5, fetcher: async (_url, {signal}) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error(clientId)), {once: true}))});
  assert.equal(result.code, 'PROVIDER_UNAVAILABLE');
});
test('configuring an authorized tenant stores only an encrypted envelope and confirms native readback', async () => {
  const f = fixture({connection: null});
  const result = await saveSportlinkConnection({...request, expectedVersion: 0, clientId}, f.deps);
  assert.equal(result.status, 'confirmed');
  assert.equal(f.provider.length, 0);
  assert.deepEqual(f.calls.map((c) => c.name), ['sportlink_connection_state', 'configure_sportlink_connection', 'sportlink_connection_state', 'sportlink_connection_credential']);
  const command = f.calls[1].args;
  assert.equal(command.p_expected_version, 0); assert.equal(command.p_idempotency_key, idempotencyKey);
  assert.equal(command.p_credential_fingerprint, sealed.fingerprint);
  assert.equal(JSON.stringify(command).includes(clientId), false);
  assert.equal(JSON.stringify(result).includes(clientId), false);
});
test('native denied member, foreign manager and expired session boundaries never decrypt or contact a provider', async () => {
  for (const denied of ['member', 'foreign-tenant', 'expired-session']) {
    const f = fixture({denied});
    assert.equal((await checkSportlinkConnection(request, f.deps)).status, 'rejected');
    assert.equal((await saveSportlinkConnection({...request, clientId}, f.deps)).status, 'rejected');
    assert.equal(f.provider.length, 0);
    assert.ok(f.calls.every((c) => c.name === 'sportlink_connection_state'));
  }
});
test('foreign connection, stale version, denied credential read and corrupt ciphertext stop before provider access', async () => {
  const cases = [
    [{...request, connectionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}, {}],
    [{...request, expectedVersion: 2}, {}],
    [request, {credential: {data: null, error: {code: '42501', message: 'FORBIDDEN'}}}],
    [request, {credential: {data: {connection_id: connectionId, version: 1, credential_envelope: {...sealed.envelope, tag: 'A'.repeat(22)}, credential_fingerprint: sealed.fingerprint}, error: null}}],
  ];
  for (const [attempt, options] of cases) {
    const f = fixture(options), result = await checkSportlinkConnection(attempt, f.deps);
    assert.notEqual(result.status, 'confirmed'); assert.equal(f.provider.length, 0);
    assert.ok(f.calls.every((c) => c.name !== 'record_sportlink_connection_test'));
  }
});
test('an authorized read test confirms only its persisted signed receipt; replay performs no second provider request', async () => {
  const f = fixture();
  const first = await checkSportlinkConnection(request, f.deps), again = await checkSportlinkConnection(request, f.deps);
  assert.equal(first.status, 'confirmed'); assert.equal(first.testCode, 'VERIFIED_READ_ACCESS');
  assert.deepEqual(again, first); assert.equal(f.provider.length, 1);
  assert.equal(f.calls.filter((c) => c.name === 'record_sportlink_connection_test').length, 1);
  assert.equal(JSON.stringify(first).includes(clientId), false);
});
test('lost record acknowledgement reconciles from readback; native revocation blocks confirmation after the provider response', async () => {
  const lost = fixture({recordError: {message: 'transport lost'}});
  assert.equal((await checkSportlinkConnection(request, lost.deps)).status, 'confirmed');
  assert.equal(lost.provider.length, 1);
  const revoked = fixture({revokeAtRecord: true});
  assert.equal((await checkSportlinkConnection(request, revoked.deps)).status, 'rejected');
  assert.equal(revoked.provider.length, 1);
});
test('a forged native test object, extra provider data or a changed credential never enters the UI DTO', () => {
  const receipt = {source: 'sportlink_dataservice_read_test_v1', idempotency_key: idempotencyKey, checked_at: new Date(now).toISOString(), code: 'VERIFIED_READ_ACCESS', capabilities: caps};
  const proof = sealSportlinkTestReceipt(receipt, sealed.fingerprint, secret, scope);
  const connection = {id: connectionId, version: 2, status: 'preparing', configured: true, last_success_at: null, credential_fingerprint: sealed.fingerprint,
    last_test: proof, credential_envelope: sealed.envelope, plaintext: clientId};
  const dto = sportlinkStateDTO({authorized: true, connection}, secret, tenantId);
  assert.equal(dto.connection.test.code, 'VERIFIED_READ_ACCESS');
  assert.equal(JSON.stringify(dto).includes(clientId), false);
  assert.equal(JSON.stringify(dto).includes('credential'), false);
  for (const changed of [{...proof, signature: 'A'.repeat(43)}, {...proof, receipt: {...receipt, raw_provider_data: clientId}}]) {
    assert.equal(sportlinkStateDTO({authorized: true, connection: {...connection, last_test: changed}}, secret, tenantId).connection.test, null);
  }
  assert.equal(sportlinkStateDTO({authorized: true, connection: {...connection, credential_fingerprint: '0'.repeat(64)}}, secret, tenantId).connection.test, null);
});
