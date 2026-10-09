import {openSportlinkCredential, openSportlinkTestReceipt, sealSportlinkCredential, sealSportlinkTestReceipt, validSportlinkClientId} from './credentials.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{64}$/;
const states = ['preparing', 'active', 'error', 'disabled'];
const unknown = () => ({status: 'unknown', message: 'De vereniging heeft de wijziging nog niet bevestigd. Probeer dezelfde handeling opnieuw.'});
const rejected = (message) => ({status: 'rejected', message});
const confirmedSave = () => ({status: 'confirmed', message: 'De Sportlink-koppeling is veilig opgeslagen voor deze vereniging. Je kunt nu de verbinding controleren.'});
const testMessages = {
  VERIFIED_READ_ACCESS: 'Sportlink heeft de leesaanvraag bevestigd. Wedstrijden importeren vraagt eerst een gecontroleerde koppeling met de teams van je vereniging.',
  PROVIDER_DENIED: 'Sportlink heeft de aanvraag geweigerd. Controleer of deze ClientID bij de vereniging hoort en Club.Dataservice is ingeschakeld.',
  PROVIDER_UNAVAILABLE: 'Sportlink is nu niet bereikbaar. De laatst bekende wedstrijden blijven bewaard. Probeer de controle later opnieuw.',
  INVALID_SOURCE_RESPONSE: 'Sportlink gaf geen bruikbaar wedstrijdantwoord. De laatst bekende wedstrijden blijven bewaard.',
  CONTRACT_UNAVAILABLE: 'Het wedstrijdprogramma is niet beschikbaar in dit Sportlink-contract. Controleer de toegang bij Sportlink.',
};
const confirmedTest = (receipt) => ({status: 'confirmed', testCode: receipt.code, message: testMessages[receipt.code]});
function request(input, needsClientId) {
  if (!input || typeof input.club !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.club)
    || !UUID.test(input.connectionId) || !UUID.test(input.idempotencyKey)
    || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < (needsClientId ? 0 : 1)
    || (needsClientId && !validSportlinkClientId(input.clientId))) return null;
  return input;
}
function parsedState(value) {
  if (!value || value.authorized !== true) return null;
  if (value.connection === null) return {authorized: true, connection: null};
  const c = value.connection;
  if (!c || !UUID.test(c.id) || !Number.isSafeInteger(c.version) || c.version < 1 || !states.includes(c.status) || typeof c.configured !== 'boolean'
    || (c.configured && (typeof c.credential_fingerprint !== 'string' || !HEX.test(c.credential_fingerprint)))) return null;
  return {authorized: true, connection: c};
}
function failure(error) {
  if (error?.code === '42501' || /\bFORBIDDEN\b/.test(error?.message ?? '')) return rejected('Je hebt geen actuele bevoegdheid om de Sportlink-koppeling van deze vereniging te beheren.');
  if (/\bSTALE_VERSION\b|\bIDEMPOTENCY_CONFLICT\b/.test(error?.message ?? '')) return rejected('De koppeling is intussen gewijzigd. Vernieuw de pagina en controleer de actuele gegevens.');
  if (/\bINVALID_[A-Z_]+\b/.test(error?.message ?? '')) return rejected('Controleer de gegevens van de koppeling.');
  return unknown();
}
async function state(rpc, tenantId) {
  const result = await rpc('sportlink_connection_state', {p_tenant_id: tenantId});
  return {...result, parsed: result.error ? null : parsedState(result.data)};
}
function scopeFor(tenantId, connectionId) {return {tenantId, connectionId};}
function currentReceipt(connection, secret, tenantId, key) {
  if (!connection?.configured) return null;
  const receipt = openSportlinkTestReceipt(connection.last_test, connection.credential_fingerprint, secret, scopeFor(tenantId, connection.id));
  return receipt?.idempotency_key === key.toLowerCase() ? receipt : null;
}
function savedResult(data, id) {return data?.ok === true && data.resource_id === id && Number.isSafeInteger(data.version) && data.version > 0;}

// Dependencies keep the core testable without provider requests, administrative access or a fake role.
// authorize() is the real Next.js workspace boundary. Every RPC repeats native action authorization.
export async function saveSportlinkConnection(input, deps) {
  const parsed = request(input, true);
  if (!parsed) return rejected('Vul de Sportlink ClientID van deze vereniging in en controleer de invoer.');
  const {tenantId, rpc} = await deps.authorize(parsed.club);
  try {
    const before = await state(rpc, tenantId);
    if (!before.parsed) return before.error ? failure(before.error) : unknown();
    if (before.parsed.connection && before.parsed.connection.id !== parsed.connectionId) return rejected('Deze koppeling hoort niet bij de gekozen vereniging.');
    if (!before.parsed.connection && parsed.expectedVersion !== 0) return rejected('De koppeling is nog niet ingericht. Vernieuw de pagina.');
    const secret = deps.secret(), scope = scopeFor(tenantId, parsed.connectionId);
    const sealed = sealSportlinkCredential(parsed.clientId, secret, scope);
    const result = await rpc('configure_sportlink_connection', {p_tenant_id: tenantId, p_connection_id: parsed.connectionId,
      p_expected_version: parsed.expectedVersion, p_credential_envelope: sealed.envelope, p_credential_fingerprint: sealed.fingerprint, p_idempotency_key: parsed.idempotencyKey});
    if (result.error) return failure(result.error);
    if (!savedResult(result.data, parsed.connectionId)) return unknown();
    const after = await state(rpc, tenantId);
    const c = after.parsed?.connection;
    if (c?.id !== parsed.connectionId || !c.configured || c.credential_fingerprint !== sealed.fingerprint || c.version < result.data.version) return after.error ? failure(after.error) : unknown();
    const readback = await rpc('sportlink_connection_credential', {p_tenant_id: tenantId, p_connection_id: c.id, p_expected_version: c.version});
    if (readback.error) return failure(readback.error);
    const stored = readback.data;
    if (!stored || stored.connection_id !== c.id || stored.version !== c.version || stored.credential_fingerprint !== c.credential_fingerprint) return unknown();
    return openSportlinkCredential(stored.credential_envelope, stored.credential_fingerprint, secret, scope) === parsed.clientId ? confirmedSave() : unknown();
  } catch (error) {deps.rethrow?.(error); return unknown();}
}

export async function checkSportlinkConnection(input, deps) {
  const parsed = request(input, false);
  if (!parsed) return rejected('Vernieuw de pagina om de actuele koppeling te controleren.');
  const {tenantId, rpc} = await deps.authorize(parsed.club);
  try {
    const before = await state(rpc, tenantId);
    if (!before.parsed) return before.error ? failure(before.error) : unknown();
    const c = before.parsed.connection;
    if (!c?.configured || c.id !== parsed.connectionId || c.status === 'disabled') return rejected('Sla eerst een Sportlink-koppeling op voor deze vereniging.');
    const secret = deps.secret();
    const previous = currentReceipt(c, secret, tenantId, parsed.idempotencyKey);
    if (previous) return confirmedTest(previous);
    if (c.version !== parsed.expectedVersion) return rejected('De koppeling is intussen gewijzigd. Vernieuw de pagina en controleer de actuele gegevens.');
    const credentials = await rpc('sportlink_connection_credential', {p_tenant_id: tenantId, p_connection_id: c.id, p_expected_version: c.version});
    if (credentials.error) return failure(credentials.error);
    const stored = credentials.data;
    if (!stored || stored.connection_id !== c.id || stored.version !== c.version || stored.credential_fingerprint !== c.credential_fingerprint) return unknown();
    const scope = scopeFor(tenantId, c.id);
    const clientId = openSportlinkCredential(stored.credential_envelope, stored.credential_fingerprint, secret, scope);
    // No provider access occurs until both native metadata and the encrypted credential are authorized.
    const probe = await deps.probe(clientId);
    const receipt = sealSportlinkTestReceipt({source: 'sportlink_dataservice_read_test_v1', idempotency_key: parsed.idempotencyKey,
      checked_at: new Date(deps.now?.() ?? Date.now()).toISOString(), code: probe.code, capabilities: probe.capabilities}, c.credential_fingerprint, secret, scope);
    const result = await rpc('record_sportlink_connection_test', {p_tenant_id: tenantId, p_connection_id: c.id, p_expected_version: c.version,
      p_test_result: receipt, p_idempotency_key: parsed.idempotencyKey});
    const after = await state(rpc, tenantId);
    const accepted = currentReceipt(after.parsed?.connection, secret, tenantId, parsed.idempotencyKey);
    if (accepted && after.parsed.connection.id === c.id && after.parsed.connection.credential_fingerprint === c.credential_fingerprint) return confirmedTest(accepted);
    return after.error ? failure(after.error) : result.error ? failure(result.error) : unknown();
  } catch (error) {deps.rethrow?.(error); return error?.message === 'CREDENTIAL_UNAVAILABLE' ? rejected('De opgeslagen koppeling kan niet worden gecontroleerd. Sla de ClientID van deze vereniging opnieuw op.') : unknown();}
}

export function sportlinkStateDTO(raw, secret, tenantId) {
  const parsed = parsedState(raw);
  if (!parsed) return null;
  const c = parsed.connection;
  if (!c) return {connection: null};
  const receipt = c.configured ? openSportlinkTestReceipt(c.last_test, c.credential_fingerprint, secret, scopeFor(tenantId, c.id)) : null;
  const successAt = typeof c.last_success_at === 'string' && c.last_success_at.length <= 40 && Number.isFinite(Date.parse(c.last_success_at)) ? c.last_success_at : null;
  return {connection: {id: c.id, version: c.version, status: c.status, configured: c.configured, lastSuccessAt: successAt,
    test: receipt ? {code: receipt.code, checkedAt: receipt.checked_at, capabilities: receipt.capabilities} : null}};
}

