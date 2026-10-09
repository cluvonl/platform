import {createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual} from 'node:crypto';

// Node-only cryptography. The Next.js entry point is marked server-only.
// The existing runtime secret is purpose-separated; it is never used as an AES key directly.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ID = /^[A-Za-z0-9_-]{6,128}$/;
const HEX = /^[0-9a-f]{64}$/;
const base64url = /^[A-Za-z0-9_-]+$/;
export const SPORTLINK_TEST_CODES = ['VERIFIED_READ_ACCESS', 'PROVIDER_DENIED', 'PROVIDER_UNAVAILABLE', 'INVALID_SOURCE_RESPONSE', 'CONTRACT_UNAVAILABLE'];

function scopeValue(scope) {
  if (!scope || !UUID.test(scope.tenantId) || !UUID.test(scope.connectionId)) throw new Error('INVALID_CREDENTIAL_SCOPE');
  return `${scope.tenantId.toLowerCase()}:${scope.connectionId.toLowerCase()}`;
}
function key(secret, scope, purpose) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) throw new Error('CREDENTIAL_KEY_UNAVAILABLE');
  return Buffer.from(hkdfSync('sha256', secret, 'cluvo-sportlink-v1', `${purpose}\0${scopeValue(scope)}`, 32));
}
function safeEqual(left, right) {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validSportlinkClientId(value) {return typeof value === 'string' && CLIENT_ID.test(value);}
export function credentialFingerprint(clientId, secret, scope) {
  if (!validSportlinkClientId(clientId)) throw new Error('INVALID_CLIENT_ID');
  return createHmac('sha256', key(secret, scope, 'credential-fingerprint')).update(clientId).digest('hex');
}
export function sealSportlinkCredential(clientId, secret, scope) {
  if (!validSportlinkClientId(clientId)) throw new Error('INVALID_CLIENT_ID');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret, scope, 'credential-encryption'), nonce);
  cipher.setAAD(Buffer.from(`cluvo-sportlink-credential-v1\0${scopeValue(scope)}`));
  const ciphertext = Buffer.concat([cipher.update(clientId, 'utf8'), cipher.final()]);
  return {envelope: {v: 1, nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url')}, fingerprint: credentialFingerprint(clientId, secret, scope)};
}
export function openSportlinkCredential(envelope, fingerprint, secret, scope) {
  try {
    if (!envelope || Object.keys(envelope).sort().join(',') !== 'ciphertext,nonce,tag,v' || envelope.v !== 1
      || typeof envelope.nonce !== 'string' || envelope.nonce.length !== 16 || !base64url.test(envelope.nonce)
      || typeof envelope.tag !== 'string' || envelope.tag.length !== 22 || !base64url.test(envelope.tag)
      || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 8 || envelope.ciphertext.length > 171 || !base64url.test(envelope.ciphertext)
      || typeof fingerprint !== 'string' || !HEX.test(fingerprint)) throw new Error();
    const nonce = Buffer.from(envelope.nonce, 'base64url'), tag = Buffer.from(envelope.tag, 'base64url');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64url');
    if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length < 6 || ciphertext.length > 128
      || nonce.toString('base64url') !== envelope.nonce || tag.toString('base64url') !== envelope.tag || ciphertext.toString('base64url') !== envelope.ciphertext) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', key(secret, scope, 'credential-encryption'), nonce);
    decipher.setAAD(Buffer.from(`cluvo-sportlink-credential-v1\0${scopeValue(scope)}`));
    decipher.setAuthTag(tag);
    const clientId = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    if (!validSportlinkClientId(clientId) || !safeEqual(credentialFingerprint(clientId, secret, scope), fingerprint)) throw new Error();
    return clientId;
  } catch {throw new Error('CREDENTIAL_UNAVAILABLE');}
}
function cleanReceipt(receipt) {
  if (!receipt || Object.keys(receipt).sort().join(',') !== 'capabilities,checked_at,code,idempotency_key,source'
    || receipt.source !== 'sportlink_dataservice_read_test_v1' || !UUID.test(receipt.idempotency_key)
    || typeof receipt.checked_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(receipt.checked_at)
    || !Number.isFinite(Date.parse(receipt.checked_at)) || !SPORTLINK_TEST_CODES.includes(receipt.code)) return null;
  const c = receipt.capabilities;
  if (!c || Object.keys(c).sort().join(',') !== 'duration_units_verified,match_details,matches,member_import,teams'
    || typeof c.matches !== 'boolean' || typeof c.match_details !== 'boolean' || typeof c.teams !== 'boolean'
    || c.member_import !== false || c.duration_units_verified !== false
    || (receipt.code === 'VERIFIED_READ_ACCESS' && !c.matches)
    || (receipt.code !== 'VERIFIED_READ_ACCESS' && Object.values(c).some(Boolean))) return null;
  return {source: receipt.source, idempotency_key: receipt.idempotency_key.toLowerCase(), checked_at: receipt.checked_at, code: receipt.code,
    capabilities: {matches: c.matches, match_details: c.match_details, teams: c.teams, member_import: false, duration_units_verified: false}};
}
function receiptSignature(receipt, fingerprint, secret, scope) {
  if (typeof fingerprint !== 'string' || !HEX.test(fingerprint)) throw new Error('INVALID_CREDENTIAL_FINGERPRINT');
  return createHmac('sha256', key(secret, scope, 'read-test-attestation')).update(fingerprint).update('\0').update(JSON.stringify(receipt)).digest('base64url');
}
export function sealSportlinkTestReceipt(receipt, fingerprint, secret, scope) {
  const clean = cleanReceipt(receipt);
  if (!clean) throw new Error('INVALID_TEST_RECEIPT');
  return {v: 1, receipt: clean, signature: receiptSignature(clean, fingerprint, secret, scope)};
}
export function openSportlinkTestReceipt(envelope, fingerprint, secret, scope, now = Date.now()) {
  try {
    if (!envelope || Object.keys(envelope).sort().join(',') !== 'receipt,signature,v' || envelope.v !== 1 || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(envelope.signature)) return null;
    const clean = cleanReceipt(envelope.receipt);
    if (!clean || Date.parse(clean.checked_at) > now + 30000 || !safeEqual(envelope.signature, receiptSignature(clean, fingerprint, secret, scope))) return null;
    return clean;
  } catch {return null;}
}
