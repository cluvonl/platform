/** Decode the public P-256 VAPID key; this module contains no server secret. */
export function publicPushKeyBytes(publicKey) {
  if (typeof publicKey !== 'string' || !/^[A-Za-z0-9_-]{87}=?$/.test(publicKey)) throw new Error('PUSH_NOT_CONFIGURED');
  const value = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/').padEnd(88, '='));
  const bytes = Uint8Array.from(value, char => char.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('PUSH_NOT_CONFIGURED');
  return bytes;
}

/** Call directly from the click handler, before yielding user activation. */
export function subscribeDeviceWithGesture(registration, publicKey) {
  return registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: publicPushKeyBytes(publicKey).buffer});
}

export function serializeDeviceSubscription(subscription) {
  const value = subscription.toJSON();
  if (typeof value.endpoint !== 'string' || typeof value.keys?.p256dh !== 'string' || typeof value.keys?.auth !== 'string') throw new Error('PUSH_SUBSCRIPTION_UNAVAILABLE');
  return {endpoint: value.endpoint, keys: {p256dh: value.keys.p256dh, auth: value.keys.auth}};
}

/** Provider permission alone never establishes this account's server binding. */
export async function confirmDevicePushBinding(subscription, save, idempotencyKey) {
  const receipt = await save(serializeDeviceSubscription(subscription), idempotencyKey);
  if (!receipt?.ok) throw new Error('PUSH_BINDING_NOT_CONFIRMED');
  return receipt;
}

/** Revoke the native account binding before removing this device endpoint. */
export async function revokeDevicePushBinding(subscription, revoke, idempotencyKey) {
  const receipt = await revoke(subscription.endpoint, idempotencyKey);
  if (!receipt?.ok) throw new Error('PUSH_REVOCATION_NOT_CONFIRMED');
  let removed = false;
  try { removed = await subscription.unsubscribe(); } catch { /* Server revocation is already confirmed. */ }
  return {receipt, deviceRemoved: removed};
}
