import test from 'node:test';
import assert from 'node:assert/strict';
import {sealReceipts, openReceipts} from '../lib/pwa/receipts.mjs';

const secret = 'synthetic-test-secret-for-pwa-receipts-001';
const scope = {tenant:'11111111-1111-4111-8111-111111111111', person:'22222222-2222-4222-8222-222222222222'};
const now = 1800000000000;
const record = {...scope,key:'33333333-3333-4333-8333-333333333333',command:'book_shift',at:now-1000};
test('receipt survives reload with only a signed command identity', () => {
  const cookie = sealReceipts([record], secret);
  assert.deepEqual(openReceipts(cookie, secret, scope, now), [record]);
  assert.ok(!cookie.includes('payload'));
});
test('tampered, wrong-user, wrong-tenant, expired and future receipts cannot be restored', () => {
  const cookie = sealReceipts([record], secret);
  assert.deepEqual(openReceipts(cookie+'x',secret,scope,now), []);
  assert.deepEqual(openReceipts(cookie,secret,{...scope,person:'other'},now), []);
  assert.deepEqual(openReceipts(cookie,secret,{...scope,tenant:'other'},now), []);
  assert.deepEqual(openReceipts(cookie,secret,scope,now+86400000), []);
  assert.deepEqual(openReceipts(cookie,secret,scope,now-2000), []);
});
