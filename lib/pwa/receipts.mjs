import {createHmac, timingSafeEqual} from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const signature = (value, secret) => createHmac('sha256', secret).update('cluvo-pwa-receipts-v1\0').update(value).digest('base64url');
export function sealReceipts(receipts, secret) {
  const value = Buffer.from(JSON.stringify(receipts.slice(-10)), 'utf8').toString('base64url');
  return `${value}.${signature(value, secret)}`;
}
export function openReceipts(cookie, secret, scope, now = Date.now()) {
  if (typeof cookie !== 'string' || cookie.length > 3800) return [];
  const [value, signed, extra] = cookie.split('.');
  if (extra !== undefined || !value || !signed || !/^[A-Za-z0-9_-]+$/.test(value)) return [];
  const expected = Buffer.from(signature(value, secret));
  const actual = Buffer.from(signed);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return [];
  try {
    const records = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(records) || records.length > 10) return [];
    return records.filter((row) => row && row.tenant === scope.tenant && row.person === scope.person
      && UUID.test(row.key) && /^[a-z_]{1,60}$/.test(row.command)
      && Number.isSafeInteger(row.at) && row.at <= now && row.at > now - 86400000)
      .map(({tenant, person, key, command, at}) => ({tenant, person, key, command, at}));
  } catch {return [];}
}
