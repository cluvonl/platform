import assert from 'node:assert/strict';
import {test} from 'node:test';
import {credentialFingerprint, openSportlinkCredential, openSportlinkTestReceipt, sealSportlinkCredential, sealSportlinkTestReceipt} from '../lib/sportlink/credentials.mjs';

const secret = 'synthetic-owned-sportlink-key-for-unit-checks-12345';
const scope = {tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', connectionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
const clientId = 'SyntheticClientID_123';
const fingerprint = credentialFingerprint(clientId, secret, scope);
const receipt = {source: 'sportlink_dataservice_read_test_v1', idempotency_key: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', checked_at: '2026-10-09T10:00:00.000Z', code: 'VERIFIED_READ_ACCESS',
  capabilities: {matches: true, match_details: true, teams: false, member_import: false, duration_units_verified: false}};

test('per-tenant credential roundtrip has fresh random encryption and stable semantic fingerprint', () => {
  const first = sealSportlinkCredential(clientId, secret, scope), second = sealSportlinkCredential(clientId, secret, scope);
  assert.notDeepEqual(first.envelope, second.envelope);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(openSportlinkCredential(first.envelope, fingerprint, secret, scope), clientId);
  assert.equal(JSON.stringify(first).includes(clientId), false);
  assert.notEqual(credentialFingerprint(clientId, secret, {...scope, connectionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}), fingerprint);
});
test('ciphertext cannot be copied across tenants, connections, master keys or semantic payloads', () => {
  const {envelope} = sealSportlinkCredential(clientId, secret, scope);
  for (const [attemptSecret, attemptScope, attemptFingerprint] of [
    [secret, {...scope, tenantId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}, fingerprint],
    [secret, {...scope, connectionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}, fingerprint],
    [`${secret}-rotated`, scope, fingerprint], [secret, scope, '0'.repeat(64)],
  ]) assert.throws(() => openSportlinkCredential(envelope, attemptFingerprint, attemptSecret, attemptScope), /^Error: CREDENTIAL_UNAVAILABLE$/);
});
test('malformed and tampered envelopes fail without returning the credential or cryptographic exception', () => {
  const {envelope} = sealSportlinkCredential(clientId, secret, scope);
  for (const changed of [null, {...envelope, v: 2}, {...envelope, arbitrary: clientId}, {...envelope, tag: 'A'.repeat(22)},
    {...envelope, nonce: envelope.nonce + '='}, {...envelope, ciphertext: 'A'.repeat(172)}]) {
    assert.throws(() => openSportlinkCredential(changed, fingerprint, secret, scope), /^Error: CREDENTIAL_UNAVAILABLE$/);
  }
});
test('a test receipt is bound to the current tenant, connection, credential and whitelisted result', () => {
  const sealed = sealSportlinkTestReceipt(receipt, fingerprint, secret, scope), now = Date.parse(receipt.checked_at);
  assert.deepEqual(openSportlinkTestReceipt(sealed, fingerprint, secret, scope, now), receipt);
  assert.equal(openSportlinkTestReceipt({...sealed, receipt: {...receipt, code: 'PROVIDER_DENIED'}}, fingerprint, secret, scope, now), null);
  assert.equal(openSportlinkTestReceipt(sealed, '0'.repeat(64), secret, scope, now), null);
  assert.equal(openSportlinkTestReceipt(sealed, fingerprint, secret, {...scope, tenantId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}, now), null);
  assert.equal(openSportlinkTestReceipt(sealed, fingerprint, secret, scope, now - 60000), null);
  assert.throws(() => sealSportlinkTestReceipt({...receipt, capabilities: {...receipt.capabilities, duration_units_verified: true}}, fingerprint, secret, scope), /INVALID_TEST_RECEIPT/);
  assert.throws(() => sealSportlinkTestReceipt({...receipt, raw_provider_data: clientId}, fingerprint, secret, scope), /INVALID_TEST_RECEIPT/);
});
