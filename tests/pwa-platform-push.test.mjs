import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPushKeyBytes, subscribeDeviceWithGesture, confirmDevicePushBinding, revokeDevicePushBinding} from '../components/pwa/push-device.mjs';

const publicKey = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url');
const endpoint = 'https://web.push.apple.com/synthetic-fixture';
const subscription = {endpoint, toJSON() {return {endpoint, keys: {p256dh: 'synthetic-public-key', auth: 'synthetic-auth-key'}};}};

test('actual device subscribe is invoked synchronously within the gesture and requests visible native notifications', async () => {
  let invoked = false;
  const registration = {pushManager: {subscribe(options) {
    invoked = true;
    assert.equal(options.userVisibleOnly, true);
    assert.equal(options.applicationServerKey.byteLength, 65);
    return Promise.resolve(subscription);
  }}};
  const result = subscribeDeviceWithGesture(registration, publicKey);
  assert.equal(invoked, true);
  assert.equal(await result, subscription);
});

test('invalid public VAPID config cannot request native permission', () => {
  for (const key of ['', 'arbitrary', Buffer.alloc(65).toString('base64url')]) {
    assert.throws(() => publicPushKeyBytes(key), /PUSH_NOT_CONFIGURED/);
  }
});

test('actual account registration remains unconfirmed when native server write fails and is not automatically replayed', async () => {
  let calls = 0;
  await assert.rejects(confirmDevicePushBinding(subscription, async (value, key) => {
    calls++; assert.equal(value.endpoint, endpoint); assert.equal(value.keys.auth, 'synthetic-auth-key'); assert.equal(key, 'stable-synthetic-command');
    return {ok: false};
  }, 'stable-synthetic-command'), /PUSH_BINDING_NOT_CONFIRMED/);
  assert.equal(calls, 1);
  const result = await confirmDevicePushBinding(subscription, async () => ({ok: true}), 'stable-synthetic-command');
  assert.equal(result.ok, true);
});

test('actual revoke requires native server confirmation before browser unsubscribe; unknown writes are not replayed', async () => {
  const steps = [];
  const device = {...subscription, async unsubscribe() {steps.push('device'); return true;}};
  await assert.rejects(revokeDevicePushBinding(device, async () => {steps.push('server-denied'); return {ok: false};}, 'synthetic-command'), /PUSH_REVOCATION_NOT_CONFIRMED/);
  assert.deepEqual(steps, ['server-denied']);
  steps.length = 0;
  const result = await revokeDevicePushBinding(device, async (value, key) => {assert.equal(value, endpoint); assert.equal(key, 'stable-command'); steps.push('server-confirmed'); return {ok: true};}, 'stable-command');
  assert.deepEqual(steps, ['server-confirmed', 'device']);
  assert.equal(result.deviceRemoved, true);
});
