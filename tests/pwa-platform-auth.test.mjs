import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = async path => ts.transpileModule(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
const actionsSource = await compile('app/auth/actions.ts');
const confirmSource = await compile('app/auth/confirm/route.ts');
const invitationSource = await compile('app/invite/accept/actions.ts');
const workspaceSource = await compile('lib/auth/workspace.ts');
const returnSource=await compile('lib/auth/mobile-return.ts');
const proxySource=await compile('lib/supabase/proxy.ts');
const origin = 'https://staging.example.invalid';

function load(source, mocks) {
  const testModule = {exports: {}};
  runInNewContext(source, {module: testModule, exports: testModule.exports, URL, URLSearchParams, Headers, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name)});
  return testModule.exports;
}
function form(values) {const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data;}
function harness({emailCookies = {'cluvo_app_otp_email': 'synthetic@example.invalid'}, workspaceRows = [{tenant_slug: 'synthetic-club'}], verifyError = null, invitationError = null, claimsError = null,forwardedPath=null} = {}) {
  const authCalls = [], queryCalls = [], cookieSets = [], cookieDeletes = [], rpcCalls = [];
  const cookieStore = {get(name) {return emailCookies[name] ? {value: emailCookies[name]} : undefined;}, set(...input) {cookieSets.push(structuredClone(input));emailCookies[input[0]]=input[1];}, delete(input) {cookieDeletes.push(structuredClone(input));delete emailCookies[input.name];}};
  const client = {auth: {
    async signInWithOtp(input) {authCalls.push(['request', structuredClone(input)]); return {error: null};},
    async verifyOtp(input) {authCalls.push(['verify', structuredClone(input)]); return {error: verifyError};},
    async signOut(input) {authCalls.push(['signout', structuredClone(input)]); return {error: null};},
    async getClaims() {return {data: {claims: {sub: 'synthetic-principal'}}, error: claimsError};},
  }, schema(name) {queryCalls.push(name); return {
    from(name) {queryCalls.push(name); return {select(name) {queryCalls.push(name); return {
      order() {return {order() {return this;}, async limit() {return {data: workspaceRows, error: null};}};},
      async eq(_column, tenant) {queryCalls.push(tenant); return {data: workspaceRows.filter(row=>row.tenant_slug===tenant), error: null};},
    };}};},
    async rpc(name, input) {rpcCalls.push([name, structuredClone(input)]); return {data: [{result: {tenant_slug: 'synthetic-club'}}], error: invitationError};},
  };}};
  const returns=load(returnSource,{});
  const mocks = {
    './mobile-return':returns,
    '@/lib/auth/mobile-return':returns,
    'server-only': {},
    'next/headers': {async cookies() {return cookieStore;},async headers(){return new Headers(forwardedPath?{[returns.mobileReturnHeader]:forwardedPath}:{});}},
    'next/navigation': {redirect(path) {throw Object.assign(new Error('REDIRECT'), {location: path});}},
    '@/lib/supabase/server': {async createSupabaseServerClient() {return client;}},
    '@/lib/supabase/config': {appOrigin: () => origin},
    'next/server': {NextResponse: {redirect(url) {return {location: url.href, headers: new Headers(), cookies: {set(...input) {cookieSets.push(structuredClone(input));emailCookies[input[0]]=input[1];}}};}}},
  };
  return {actions: load(actionsSource, mocks), confirm: load(confirmSource, mocks), invite: load(invitationSource, mocks), workspace: load(workspaceSource, mocks), authCalls, queryCalls, cookieSets, cookieDeletes, rpcCalls};
}

test('actual mobile OTP request ignores client next and scopes personal email to mobile verify only', async () => {
  const h = harness();
  await assert.rejects(h.actions.requestMobileOtpAction({status: 'idle'}, form({email: ' SYNTHETIC@example.invalid ', next: 'https://foreign.example.invalid'})), error => error.location === '/app/auth/verify?sent=1');
  const call = h.authCalls[0][1];
  assert.equal(call.options.shouldCreateUser, false);
  assert.equal(call.options.emailRedirectTo, origin + '/auth/confirm?next=%2Fapp%2Fworkspaces');
  assert.equal(h.cookieSets[0][0], 'cluvo_app_otp_email');
  assert.equal(h.cookieSets[0][2].path, '/app/auth/verify');
  assert.equal(h.cookieSets[0][2].httpOnly, true);
  assert.equal(h.cookieSets[0][2].secure, true);
  assert.equal(h.cookieSets[0][2].sameSite, 'strict');
});

test('actual mobile verification needs its own email cookie and current readable workspace before scoped return', async () => {
  const h = harness();
  await assert.rejects(h.actions.verifyMobileOtpAction({status: 'idle'}, form({token: '00000008', next: '//foreign.example.invalid'})), error => error.location === '/app/workspaces');
  assert.deepEqual(h.authCalls, [['verify', {email: 'synthetic@example.invalid', token: '00000008', type: 'email'}]]);
  assert.deepEqual(h.cookieDeletes, [{name: 'cluvo_app_otp_email', path: '/app/auth/verify'},{name:'cluvo_app_otp_return',path:'/app/auth/verify'}]);
  const wrongCookie = harness({emailCookies: {cluvo_otp_email: 'synthetic@example.invalid'}});
  assert.equal((await wrongCookie.actions.verifyMobileOtpAction({status: 'idle'}, form({token: '00000008'}))).status, 'error');
  assert.equal(wrongCookie.authCalls.length, 0);
  const noMembership = harness({workspaceRows: []});
  assert.equal((await noMembership.actions.verifyMobileOtpAction({status: 'idle'}, form({token: '00000008'}))).status, 'error');
  assert.equal(noMembership.authCalls.at(-1)[0], 'signout');
});

test('actual callback whitelists mobile workspace and token-free invitation return without open redirect', async () => {
  for (const next of ['https://foreign.example.invalid/app/workspaces', '//foreign.example.invalid', '/app/workspaces?next=https://foreign.example.invalid', '/app/c/unauthorized/not-a-screen']) {
    const h = harness();
    const reply = await h.confirm.GET({nextUrl: new URL(`${origin}/auth/confirm?token_hash=synthetic&type=email&next=${encodeURIComponent(next)}`)});
    assert.equal(reply.location, origin + '/workspaces');
    assert.equal(h.cookieSets.length, 0);
  }
  const h = harness();
  assert.equal((await h.confirm.GET({nextUrl: new URL(`${origin}/auth/confirm?token_hash=synthetic&type=email&next=%2Fapp%2Fworkspaces`)})).location, origin + '/app/workspaces');
  const token = 'synthetic-invitation-canary-'.padEnd(48, 'x');
  const next = '/app/invite/accept?token=' + token;
  const reply = await h.confirm.GET({nextUrl: new URL(`${origin}/auth/confirm?token_hash=synthetic&type=invite&next=${encodeURIComponent(next)}`)});
  assert.equal(reply.location, origin + '/app/invite/accept');
  assert.equal(reply.location.includes(token), false);
  assert.equal(reply.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(h.cookieSets[0][0], 'cluvo_app_household_invitation');
  assert.equal(h.cookieSets[0][2].path, '/app/invite/accept');
  assert.equal(h.cookieSets[0][2].httpOnly, true);
});

test('actual mobile invite uses existing audited command and fixed profile destination; desktop remains intact', async () => {
  for (const mobile of [false, true]) {
    const cookieName = mobile ? 'cluvo_app_household_invitation' : 'cluvo_household_invitation';
    const h = harness({emailCookies: {[cookieName]: 'synthetic-invitation-canary-'.padEnd(48, 'x')}});
    const action = mobile ? h.invite.acceptMobileInvitationAction : h.invite.acceptInvitationAction;
    await assert.rejects(action({status: 'idle'}, form({expectedVersion: '2', idempotencyKey: '00000000-0000-4000-8000-000000000001', next: 'https://foreign.example.invalid'})), error => error.location === (mobile ? '/app/c/synthetic-club/profile' : '/c/synthetic-club/intake'));
    assert.equal(h.rpcCalls[0][0], 'accept_household_invitation_v2');
    assert.equal(h.rpcCalls[0][1].p_expected_version, 2);
    assert.deepEqual(h.cookieDeletes, [{name: cookieName, path: mobile ? '/app/invite/accept' : '/invite/accept'}]);
  }
});

test('actual mobile logout closes provider session and pending app cookies before returning to mobile login', async () => {
  const h = harness();
  await assert.rejects(h.actions.signOutMobileAction(), error => error.location === '/app/login');
  assert.deepEqual(h.authCalls, [['signout', {scope: 'local'}]]);
  assert.deepEqual(h.cookieDeletes, [{name: 'cluvo_app_otp_email', path: '/app/auth/verify'}, {name:'cluvo_app_otp_return',path:'/app/auth/verify'}, {name: 'cluvo_app_household_invitation', path: '/app/invite/accept'}]);
});

test('actual workspace gate rejects missing membership and expired claims inside fixed app login scope', async () => {
  for (const options of [{workspaceRows: []}, {claimsError: {message: 'synthetic expired'}}]) {
    const h = harness(options);
    await assert.rejects(h.workspace.requireWorkspace('synthetic-club', '/app/login'), error => error.location === '/app/login');
  }
  const h = harness({workspaceRows: []});
  await assert.rejects(h.workspace.requireWorkspace('synthetic-club', 'https://foreign.example.invalid'), error => error.location === '/login');
});


test('actual typed return accepts only the twenty mobile views and bounded resource selections',()=>{
 const returns=load(returnSource,{}),id='00000000-0000-4000-8000-000000000008';
 for(const route of ['notifications','tasks','agenda','teams','profile'])assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/${route}?task=${id}`),`/app/c/synthetic-club/${route}?task=${id}`);
 for(const view of ['handover','distribution','create','goal','deadlines','feedback','assign'])assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/teams?tab=organize&view=${view}`),`/app/c/synthetic-club/teams?tab=organize&view=${view}`);
 assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/committees?committee=${id}&card=${id}&doc=${id}&view=create-card`),`/app/c/synthetic-club/committees?committee=${id}&card=${id}&doc=${id}&view=create-card`);
 assert.equal(returns.mobileReturnPath('/app/c/synthetic-club/manage?tab=confirm&view=create'),'/app/c/synthetic-club/manage?tab=confirm&view=create');
 assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/actions?question=${id}`),`/app/c/synthetic-club/actions?question=${id}`);
 assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/teams?team=${id}&handover=${id}&view=handover&tab=organize`),`/app/c/synthetic-club/teams?team=${id}&handover=${id}&view=handover&tab=organize`);
 for(const key of ['question','handover']) {
  assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/actions?${key}=private-token`),null);
  assert.equal(returns.mobileReturnPath(`/app/c/synthetic-club/actions?${key}=${id}&${key}=${id}`),null);
 }
 for(const value of ['/app/c/synthetic-club/home?view=handover','/app/c/synthetic-club/tasks?view=handover','/app/c/synthetic-club/teams?view=handover&view=assign','/app/c/synthetic-club/committees?committee=private-token','/app/c/synthetic-club/teams?view='+id+'x','/app/c/synthetic-club/teams?view='+'a'.repeat(1601)])assert.equal(returns.mobileReturnPath(value),null,value);
 for(const value of ['https://foreign.invalid/app/c/synthetic-club/home','//foreign.invalid','/app/c/synthetic-club/home#token','/app/c/synthetic-club/../home','/app/c/synthetic-club/documents/'+id,'/app/c/synthetic-club/home?token_hash=canary','/app/c/synthetic-club/home?next=/login','/app/c/synthetic-club/tasks?task=canary','/app/c/synthetic-club/tasks?task='+id+'&task='+id,'/app/c/synthetic-club/tasks?view=delete','/app/c/synthetic-club/tasks?tab=delete','/app/c/synthetic-club/home\\foreign.invalid'])assert.equal(returns.mobileReturnPath(value),null,value);
});

test('actual proxy overwrites a forged return header and retains the actual anonymous notification view through the login gate',async()=>{
 const returns=load(returnSource,{}),request={method:'GET',headers:new Headers({'x-cluvo-mobile-return':'//foreign.invalid'}),nextUrl:new URL(origin+'/app/c/synthetic-club/notifications'),cookies:{getAll(){return[];},set(){}}};
 const sdk={createServerClient(){return {auth:{async getClaims(){return {data:null,error:{code:'no-session'}};}}};}};
 const forwarded=load(proxySource,{'@/lib/auth/mobile-return':returns,'./config':{supabasePublicConfig:()=>({url:origin,publishableKey:'synthetic-public-key'})},'@supabase/ssr':sdk,'next/server':{NextResponse:{next({request}){return {forwardedHeaders:new Headers(request.headers),headers:new Headers(),cookies:{set(){}}};}}}});
 const result=await forwarded.updateSupabaseSession(request);
 assert.equal(result.response.forwardedHeaders.get(returns.mobileReturnHeader),'/app/c/synthetic-club/notifications');
 const h=harness({claimsError:{code:'expired'},forwardedPath:result.response.forwardedHeaders.get(returns.mobileReturnHeader)});
 await assert.rejects(h.workspace.requireWorkspace('synthetic-club','/app/login'),error=>error.location==='/app/login?next=%2Fapp%2Fc%2Fsynthetic-club%2Fnotifications');
 request.method='POST';request.headers.set(returns.mobileReturnHeader,'/app/c/synthetic-club/notifications');assert.equal((await forwarded.updateSupabaseSession(request)).response.forwardedHeaders.get(returns.mobileReturnHeader),null);
});

test('actual mobile OTP retains only its bounded HttpOnly destination and rechecks current workspace on verification',async()=>{
 const next='/app/c/synthetic-club/tasks?task=00000000-0000-4000-8000-000000000008',h=harness();
 await assert.rejects(h.actions.requestMobileOtpAction({status:'idle'},form({email:'synthetic@example.invalid',next})),error=>error.location==='/app/auth/verify?sent=1');
 assert.equal(h.authCalls[0][1].options.emailRedirectTo,origin+'/auth/confirm?next='+encodeURIComponent(next));
 const cookie=h.cookieSets.find(item=>item[0]==='cluvo_app_otp_return');assert.equal(cookie[1],next);assert.equal(cookie[2].httpOnly,true);assert.equal(cookie[2].path,'/app/auth/verify');
 await assert.rejects(h.actions.verifyMobileOtpAction({status:'idle'},form({token:'00000008',next:'//foreign.invalid'})),error=>error.location===next);
 const foreign=harness({emailCookies:{cluvo_app_otp_email:'synthetic@example.invalid',cluvo_app_otp_return:'/app/c/foreign-club/tasks'}});
 await assert.rejects(foreign.actions.verifyMobileOtpAction({status:'idle'},form({token:'00000008'})),error=>error.location==='/app/workspaces');
 for(const value of ['//foreign.invalid','/app/c/synthetic-club/tasks?token=canary']){
  const unsafe=harness({emailCookies:{cluvo_app_otp_email:'synthetic@example.invalid',cluvo_app_otp_return:value}});
  await assert.rejects(unsafe.actions.verifyMobileOtpAction({status:'idle'},form({token:'00000008'})),error=>error.location==='/app/workspaces');
 }
});

test('actual email callback rechecks typed mobile destination membership and never preserves a secret query',async()=>{
 for(const [next,expected]of [['/app/c/synthetic-club/notifications','/app/c/synthetic-club/notifications'],['/app/c/foreign-club/home','/app/workspaces'],['/app/c/synthetic-club/home?token=canary','/workspaces']]){
  const h=harness(),reply=await h.confirm.GET({nextUrl:new URL(origin+'/auth/confirm?token_hash=synthetic&type=email&next='+encodeURIComponent(next))});
  assert.equal(reply.location,origin+expected);assert.equal(reply.location.includes('canary'),false);
 }
});
