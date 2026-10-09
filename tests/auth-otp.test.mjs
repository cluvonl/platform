import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../app/auth/actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'actions.ts',
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
}).outputText;
const returnSource = ts.transpileModule(await readFile(new URL('../lib/auth/mobile-return.ts', import.meta.url), 'utf8'), {
  fileName: 'mobile-return.ts',
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
}).outputText;
const returnModule = {exports: {}};
runInNewContext(returnSource, {module: returnModule, exports: returnModule.exports, URL, URLSearchParams});

// Execute the actual Server Action with synthetic cookies and provider replies.
// No native Auth request, session, real recipient or real OTP is used here.
function harness({email = 'otp-fixture@example.invalid', verifyError = null,
  workspaceRows = [{tenant_slug: 'synthetic-club'}], workspaceError = null,
  providerThrows = false} = {}) {
  const calls = [], deleted = [], queries = [], signouts = [];
  let clientCreations = 0;
  const client = {
    auth: {
      async verifyOtp(input) {
        calls.push(structuredClone(input));
        if (providerThrows) throw new Error('synthetic private provider diagnostic');
        return {error: verifyError};
      },
      async signOut(input) {signouts.push(structuredClone(input));},
    },
    schema(name) {
      queries.push(name);
      return {from(name) {
        queries.push(name);
        return {select(name) {
          queries.push(name);
          return {order(name) {
            queries.push(name);
            return {async limit(count) {
              queries.push(count);
              return {data: workspaceRows, error: workspaceError};
            }};
          }};
        }};
      }};
    },
  };
  const overrides = {
    'next/headers': {async cookies() {return {
      get(name) {assert.equal(name, 'cluvo_otp_email'); return email === null ? undefined : {value: email};},
      delete(input) {deleted.push(structuredClone(input));},
    };}},
    'next/navigation': {redirect(location) {throw Object.assign(new Error('REDIRECT'), {location});}},
    '@/lib/supabase/server': {async createSupabaseServerClient() {clientCreations++; return client;}},
    '@/lib/supabase/config': {appOrigin: () => 'https://staging.example.invalid'},
    '@/lib/auth/mobile-return': returnModule.exports,
  };
  const testModule = {exports: {}};
  runInNewContext(compiled, {
    module: testModule, exports: testModule.exports, URL,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : require(name),
  }, {filename: 'app/auth/actions.ts'});
  return {action: testModule.exports.verifyOtpAction, calls, queries, deleted, signouts,
    clientCreations: () => clientCreations};
}

function form(token) {
  const data = new FormData();
  if (token !== undefined) data.set('token', token);
  return data;
}

test('actual OTP action forwards all supported code lengths intact, including eight digits and leading zeroes', async () => {
  for (const length of [6, 7, 8, 9, 10]) {
    const syntheticToken = '0'.repeat(length - 1) + '8';
    const fixture = harness();
    await assert.rejects(fixture.action({status: 'idle'}, form(` ${syntheticToken} `)),
      error => error.location === '/workspaces');
    assert.deepEqual(fixture.calls, [{email: 'otp-fixture@example.invalid', token: syntheticToken, type: 'email'}]);
    assert.deepEqual(fixture.queries, ['api', 'my_workspaces', 'tenant_slug', 'tenant_slug', 1]);
    assert.deepEqual(fixture.deleted, [{name: 'cluvo_otp_email', path: '/auth/verify'}]);
    assert.equal(fixture.clientCreations(), 1);
  }
});

test('too short, too long and non-ASCII or non-numeric OTP input never reaches Auth', async () => {
  for (const token of ['', '00000', '00000000000', '0000000x', '１２３４５６７８',
    '1e000008', '+0000008', '0000 008', '0000\n008', undefined]) {
    const fixture = harness();
    const result = await fixture.action({status: 'idle'}, form(token));
    assert.equal(result.status, 'error');
    assert.equal(fixture.clientCreations(), 0);
    assert.equal(fixture.calls.length, 0);
    assert.equal(fixture.queries.length, 0);
  }
});

test('valid-shaped eight-digit OTP cannot bypass a missing or invalid email cookie', async () => {
  for (const email of [null, 'invalid-address']) {
    const fixture = harness({email});
    const result = await fixture.action({status: 'idle'}, form('00000008'));
    assert.equal(result.status, 'error');
    assert.equal(fixture.clientCreations(), 0);
  }
  const fixture = harness();
  const result = await fixture.action({status: 'idle'}, form(new Blob(['synthetic'])));
  assert.equal(result.status, 'error');
  assert.equal(fixture.clientCreations(), 0);
});

test('provider rejection of an eight-digit code prevents workspace lookup and keeps diagnostics private', async () => {
  const fixture = harness({verifyError: {message: 'synthetic private provider diagnostic'}});
  const result = await fixture.action({status: 'idle'}, form('00000008'));
  assert.equal(result.status, 'error');
  assert.equal(result.message, 'De code is ongeldig of verlopen. Vraag een nieuwe code aan.');
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.queries.length, 0);
  assert.equal(fixture.deleted.length, 0);
});

test('a successful provider reply for eight digits still requires a readable active workspace', async () => {
  for (const reply of [{workspaceRows: []}, {workspaceError: {message: 'synthetic forbidden'}}]) {
    const fixture = harness(reply);
    const result = await fixture.action({status: 'idle'}, form('00000008'));
    assert.equal(result.status, 'error');
    assert.match(result.message, /geen actieve verenigingswerkruimte/);
    assert.deepEqual(fixture.signouts, [{scope: 'local'}]);
    assert.deepEqual(fixture.deleted, [{name: 'cluvo_otp_email', path: '/auth/verify'}]);
  }
});

test('provider failure stays generic and is not retried', async () => {
  const fixture = harness({providerThrows: true});
  const result = await fixture.action({status: 'idle'}, form('00000008'));
  assert.equal(result.status, 'error');
  assert.equal(result.message, 'Inloggen is nu niet beschikbaar. Probeer het later opnieuw.');
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.queries.length, 0);
});
