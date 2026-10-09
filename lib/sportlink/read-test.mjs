import {validSportlinkClientId} from './credentials.mjs';
import {request as httpsRequest} from 'node:https';
import {Readable} from 'node:stream';

const ORIGIN = 'https://data.sportlink.com';
const capabilities = (matches = false, matchDetails = false, teams = false) => ({matches, match_details: matchDetails, teams, member_import: false, duration_units_verified: false});
class ReadTestFailure extends Error {constructor(code) {super(code); this.code = code;}}
export function sportlinkHttpsGet(url, init, transport = httpsRequest) {
  // Next.js instruments global fetch with the full URL. Sportlink requires the
  // ClientID in its query, so use an unlogged native HTTPS request instead.
  if (!(url instanceof URL) || url.origin !== ORIGIN || url.username || url.password || !['/list', '/programma'].includes(url.pathname)
    || init?.method !== 'GET') return Promise.reject(new Error('SPORTLINK_TRANSPORT_UNAVAILABLE'));
  return new Promise((resolve, reject) => {
    const request = transport(url, {method: 'GET', headers: {Accept: 'application/json'}, signal: init.signal, rejectUnauthorized: true, maxHeaderSize: 8192}, (response) => {
      const headers = new Headers();
      for (const name of ['content-type', 'content-length']) {
        const value = response.headers[name];
        if (typeof value === 'string') headers.set(name, value);
      }
      try {resolve(new Response(Readable.toWeb(response), {status: response.statusCode ?? 502, headers}));}
      catch {response.destroy(); reject(new Error('SPORTLINK_TRANSPORT_UNAVAILABLE'));}
    });
    request.once('error', () => reject(new Error('SPORTLINK_TRANSPORT_UNAVAILABLE')));
    request.end();
  });
}
async function boundedJson(response, maxBytes) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(contentType)) throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');
  const announced = response.headers.get('content-length');
  if (announced !== null && (!/^\d+$/.test(announced) || Number(announced) > maxBytes)) throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');
  if (!response.body) throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {await reader.cancel(); throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');}
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  } catch (error) {if (error instanceof ReadTestFailure) throw error; throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');}
  finally {reader.releaseLock();}
}
async function requestArticle(article, clientId, fetcher, signal) {
  const url = new URL(`/${article}`, ORIGIN);
  url.searchParams.set('client_id', clientId);
  if (article === 'programma') {
    url.searchParams.set('aantalregels', '1');
    url.searchParams.set('aantaldagen', '42');
    url.searchParams.set('gebruiklokaleteamgegevens', 'NEE');
  }
  let response;
  try {response = await fetcher(url, {method: 'GET', headers: {Accept: 'application/json'}, cache: 'no-store', credentials: 'omit', redirect: 'error', signal});}
  catch {throw new ReadTestFailure('PROVIDER_UNAVAILABLE');}
  if (response.status !== 200) {await response.body?.cancel(); throw new ReadTestFailure(response.status === 401 || response.status === 403 ? 'PROVIDER_DENIED' : 'PROVIDER_UNAVAILABLE');}
  if (response.redirected || (response.url && new URL(response.url).origin !== ORIGIN)) {await response.body?.cancel(); throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');}
  try {return await boundedJson(response, article === 'list' ? 131072 : 32768);}
  catch (error) {
    // Header rejection happens before a reader exists. Close that native HTTPS
    // stream too, so an unusable provider response cannot retain an open socket.
    await response.body?.cancel().catch(() => {});
    throw error;
  }
}
function articleAvailable(schema, name) {
  const article = schema[name];
  return article && typeof article === 'object' && !Array.isArray(article) && typeof article.name === 'string'
    && Array.isArray(article.input) && Array.isArray(article.output);
}
export async function testSportlinkReadAccess(clientId, {fetcher = sportlinkHttpsGet, timeoutMs = 12000} = {}) {
  if (!validSportlinkClientId(clientId)) return {code: 'PROVIDER_DENIED', capabilities: capabilities()};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const schema = await requestArticle('list', clientId, fetcher, controller.signal);
    if (!schema || typeof schema !== 'object' || Array.isArray(schema) || Object.hasOwn(schema, 'error') || Object.hasOwn(schema, 'errors')) throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');
    if (!articleAvailable(schema, 'programma')) throw new ReadTestFailure('CONTRACT_UNAVAILABLE');
    const programme = await requestArticle('programma', clientId, fetcher, controller.signal);
    if (!Array.isArray(programme) || programme.length > 1 || programme.some((row) => !row || typeof row !== 'object' || Array.isArray(row)
      || !Number.isSafeInteger(row.wedstrijdcode) || row.wedstrijdcode <= 0
      || typeof row.wedstrijddatum !== 'string' || row.wedstrijddatum.length < 1 || row.wedstrijddatum.length > 100
      || Object.hasOwn(row, 'error') || Object.hasOwn(row, 'errors'))) throw new ReadTestFailure('INVALID_SOURCE_RESPONSE');
    // No match rows, person names, officials or contact values leave this function.
    // A listed article is a capability; its fields/units still require a verified import contract.
    return {code: 'VERIFIED_READ_ACCESS', capabilities: capabilities(true, Boolean(articleAvailable(schema, 'wedstrijd-informatie')), Boolean(articleAvailable(schema, 'teams')))};
  } catch (error) {return {code: !controller.signal.aborted && error instanceof ReadTestFailure ? error.code : 'PROVIDER_UNAVAILABLE', capabilities: capabilities()};}
  finally {clearTimeout(timeout);}
}
