import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:3200', mail = 'http://127.0.0.1:55324';
const output = process.env.EVIDENCE_OUTPUT ?? 'docs/release/evidence/local/20261007-w01-native-session/native-revocation';
const options = {viewport: {width: 1440, height: 1024}, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce'};
const browser = await chromium.launch({headless: true}), contexts = [], checks = [], hydration = [];
const sql = (query) => execFileSync('docker', ['exec', '-i', 'supabase_db_cluvo-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-qtA', '-v', 'ON_ERROR_STOP=1'], {input: query, encoding: 'utf8'}).trim();
const profiles = {A: 'a4000000-0000-4000-8000-000000000001', B: 'a4000000-0000-4000-8000-000000000002'};
function readback(profile) {
  assert.ok(Object.values(profiles).includes(profile));
  return JSON.parse(sql(`select json_build_object('version',p.version,'revision',p.current_revision,
    'answer_versions',(select count(*) from app.intake_answers_versions where profile_id=p.id),
    'save_audits',(select count(*) from app.audit_events where resource_id=p.id and action='intake.revision_saved'),
    'completed_commands',(select count(*) from app.idempotency_records where tenant_id=p.tenant_id and operation='save_intake_revision' and status='completed' and result_jsonb->>'resource_id'=p.id::text),
    'confirmed_minutes',(select sum(minutes_delta) from app.hour_ledger_entries where tenant_id=p.tenant_id),
    'target_minutes',(select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001'))
    from app.intake_profiles p where p.id='${profile}';`));
}
async function login(email) {
  assert.ok(['ouder-a@example.test', 'ouder-b@example.test'].includes(email));
  const context = await browser.newContext(options); contexts.push(context);
  context.on('page', (page) => page.on('console', (message) => {if (/hydration|hydrated|didn't match/i.test(message.text())) hydration.push('hydration mismatch');}));
  const page = await context.newPage(); await page.goto(base + '/login');
  const previous = new Set((await fetch(mail + '/api/v1/messages').then((r) => r.json())).messages.map(({ID}) => ID));
  await page.getByLabel('Persoonlijk e-mailadres').fill(email);
  await page.getByRole('button', {name: 'Stuur mijn inlogcode'}).click(); await page.waitForURL('**/auth/verify?sent=1');
  let token;
  for (let attempt = 0; attempt < 60 && !token; attempt++) {
    const list = await fetch(mail + '/api/v1/messages').then((r) => r.json());
    const message = list.messages.find((item) => !previous.has(item.ID) && item.To?.some((recipient) => recipient.Address === email));
    if (message) {
      const content = await fetch(mail + '/api/v1/message/' + message.ID).then((r) => r.json());
      token = (content.Text ?? content.HTML ?? '').match(/\b\d{6}\b/)?.[0];
    }
    if (!token) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(token, 'OTP arrives in local mail capture');
  try {await page.getByLabel('Eenmalige code').fill(token); await page.getByRole('button', {name: 'Veilig inloggen'}).click(); await page.waitForURL('**/workspaces');}
  catch {throw new Error('Local OTP verification failed; private code and session diagnostics withheld.');}
  await page.goto(base + '/c/club-a/intake');
  await page.getByRole('heading', {name: 'Jouw talent. Jouw bijdrage.'}).waitFor(); return {context, page};
}
async function summary(page, draft) {
  await page.getByLabel('Praktische ervaring').fill(draft);
  for (let step = 0; step < 3; step++) await page.getByRole('button', {name: 'Verder', exact: true}).click();
  await page.getByRole('heading', {name: 'Dit past bij jou.'}).waitFor();
}
async function capture(page, name) {
  for (const viewport of [{width:1440,height:1024},{width:390,height:844},{width:768,height:1024}]) {
    await page.setViewportSize(viewport); await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({path: `${output}/screenshots/${name}-${viewport.width}x${viewport.height}.png`, fullPage: true});
  }
  await page.setViewportSize(options.viewport);
}
function nativeSession(context,expectedActor) {
 let value,claims;
 return context.cookies().then(cookies=>{
  try{value=cookies.filter(c=>/^sb-.*-auth-token(?:\.\d+)?$/.test(c.name)).sort((x,y)=>x.name.localeCompare(y.name,undefined,{numeric:true})).map(c=>c.value).join('');const session=JSON.parse(value.startsWith('base64-')?Buffer.from(value.slice(7),'base64url').toString('utf8'):value);claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString('utf8'));assert.equal(claims.sub,expectedActor);assert.match(claims.session_id,/^[0-9a-f-]{36}$/i);return {token:session.access_token,id:claims.session_id};}
  catch{throw new Error('Unable to inspect a synthetic native session; private diagnostics withheld.');}
 });
}
async function cooldownA(){
 for(;;){const seconds=Number(sql("select greatest(0,ceil(61-extract(epoch from (statement_timestamp()-greatest(recovery_sent_at,confirmation_sent_at)))))::int from auth.users where id='11111111-1111-4111-8111-111111111111';"));if(seconds<=0)break;await new Promise(resolve=>setTimeout(resolve,Math.min(seconds,30)*1000));}
}
try {
 const repro=process.env.REPRODUCE_NATIVE_SESSION_GAP==='1';
 const config=await fetch(base+'/api/runtime-config').then(r=>r.json());const endpoint=new URL(config.url);assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.port,'55321');
 await mkdir(output+'/screenshots',{recursive:true});
 const actorA='11111111-1111-4111-8111-111111111111';
 const {context:accountA,page:a}=await login('ouder-a@example.test');const first=await nativeSession(accountA,actorA);
 const header=session=>({apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Accept-Profile':'api','Content-Profile':'api','Content-Type':'application/json'});
 async function read(session,projection,filter=''){
  let response;try{response=await fetch(config.url+'/rest/v1/'+projection+filter,{headers:header(session)});}catch{throw new Error('Local scoped read failed; private request diagnostics withheld.');}
  assert.equal(response.status,200);return (await response.json()).length;
 }
 async function rpc(session,name,args){let response;try{response=await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:header(session),body:JSON.stringify(args)});}catch{throw new Error('Local scoped command failed; private request diagnostics withheld.');}return response;}
 async function logout(session,scope){let response;try{response=await fetch(config.url+'/auth/v1/logout?scope='+scope,{method:'POST',headers:header(session)});}catch{throw new Error('Local native sign-out failed; private request diagnostics withheld.');}assert.equal(response.status,204);}
 const intake=(session,profile=profiles.A)=>read(session,'my_intake','?select=profile_id&profile_id=eq.'+profile);
 const sessionExists=session=>sql(`select exists(select 1 from auth.sessions where id='${session.id}' and user_id='${actorA}');`)==='t';
 assert.equal(sessionExists(first),true);assert.equal(await intake(first),1);
 const originalA=readback(profiles.A);
 if(repro){
  await logout(first,'local');assert.equal(sessionExists(first),false);const rows=await intake(first);assert.equal(rows,1);
  const result={observed_at:new Date().toISOString(),environment:'local',source_commit:'8f6190f77605edd8e191425f2790bc194ae28175',database_migrations:14,fixture:'synthetic parent A, actual local OTP and native local-scope sign-out; bearer/cookies remain only in memory',scenario:'NATIVE_SIGNED_TOKEN_AFTER_SESSION_REMOVAL',native_logout_status:204,native_session_exists_after:false,personal_intake_rows_after:rows,result:'REPRODUCED',application_data_mutations:0,staging_verified:false};
  await writeFile(output+'/pre-change-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'REPRODUCED',personal_intake_rows_after:rows,application_data_mutations:0}));
 }else{
  checks.push('REAL_OTP_NATIVE_SESSION_AND_OWN_REST_READ');
  await summary(a,'LOCAL_NATIVE_BANNED_SESSION_DRAFT');
  sql(`update auth.users set banned_until=statement_timestamp()+interval '1 day' where id='${actorA}';`);
  assert.equal(await intake(first),0);assert.equal(await read(first,'my_workspaces'),0);
  await a.getByRole('button',{name:'Intake opslaan',exact:true}).click();await a.waitForURL('**/login');assert.deepEqual(readback(profiles.A),originalA);checks.push('CURRENT_NATIVE_BAN_BLOCKS_OLD_SIGNED_REST_AND_ACTUAL_ACTION');
  sql(`update auth.users set banned_until=null where id='${actorA}';`);
  assert.equal(await intake(first),1);checks.push('UNBANNING_PRESERVES_CURRENT_SESSION_AND_EXISTING_RIGHTS');
  sql(`update auth.users set deleted_at=statement_timestamp() where id='${actorA}';`);assert.equal(await intake(first),0);assert.equal(await read(first,'my_workspaces'),0);sql(`update auth.users set deleted_at=null where id='${actorA}';`);checks.push('NATIVE_SOFT_DELETION_BLOCKS_OLD_SIGNED_PERSONAL_ROWS');
  sql(`update auth.sessions set not_after=statement_timestamp()-interval '1 second' where id='${first.id}';`);assert.equal(await intake(first),0);assert.equal(await read(first,'my_help_seen'),0);sql(`update auth.sessions set not_after=null where id='${first.id}';`);assert.equal(await intake(first),1);checks.push('NATIVE_SESSION_LIFETIME_APPLIES_TO_PERSONAL_AND_ACCOUNT_DATA');
  await a.goto(base+'/c/club-a/intake');await summary(a,'LOCAL_NATIVE_REVOKED_SESSION_DRAFT');
  await cooldownA();const {context:secondAccount,page:secondPage}=await login('ouder-a@example.test');const second=await nativeSession(secondAccount,actorA);assert.ok(first.id!==second.id,'distinct native sessions; identifiers withheld');assert.equal(await intake(second),1);checks.push('SECOND_DEVICE_USES_A_DISTINCT_ACTUAL_NATIVE_SESSION');
  const {context:accountB}=await login('ouder-b@example.test');const nativeB=await nativeSession(accountB,'22222222-2222-4222-8222-222222222222');assert.equal(await intake(nativeB),0);assert.equal(await intake(nativeB,profiles.B),1);checks.push('OTHER_PARENT_KEEPS_SEPARATE_NATIVE_SESSION_AND_PERSONAL_PRIVACY');
  await logout(first,'local');assert.equal(sessionExists(first),false);assert.equal(sessionExists(second),true);
  assert.equal(await intake(first),0);assert.equal(await read(first,'my_workspaces'),0);assert.equal(await read(first,'my_households'),0);assert.equal(await read(first,'my_help_seen'),0);assert.equal(await intake(second),1);checks.push('LOCAL_NATIVE_SIGNOUT_CLOSES_STALE_TOKEN_WITHOUT_REVOKING_SECOND_DEVICE');
  const preference=await rpc(first,'mark_help_seen',{p_topic_id:'page.overzicht'});assert.equal(preference.status,403);assert.equal((await preference.json()).message,'FORBIDDEN');checks.push('REVOKED_TOKEN_CANNOT_WRITE_ACCOUNT_PREFERENCE');
  const revision=await rpc(first,'save_intake_revision',{p_tenant_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_profile_id:profiles.A,p_expected_version:originalA.version,p_desired_minutes:null,p_answers:{schema_version:2,experience:'LOCAL_REVOKED_RPC'},p_represented_person_id:null,p_assistance_reason:null,p_idempotency_key:randomUUID()});assert.equal(revision.status,403);assert.equal((await revision.json()).message,'FORBIDDEN');assert.deepEqual(readback(profiles.A),originalA);checks.push('REVOKED_TOKEN_CANNOT_WRITE_INTAKE_THROUGH_DIRECT_RPC');
  await a.getByRole('button',{name:'Intake opslaan',exact:true}).click();await a.waitForURL('**/login');assert.deepEqual(readback(profiles.A),originalA);assert.ok(!(await a.content()).includes('LOCAL_NATIVE_REVOKED_SESSION_DRAFT'));await capture(a,'app-native-session-login');checks.push('LOADED_FORM_AFTER_NATIVE_SIGNOUT_REDIRECTS_WITHOUT_MUTATION');
  await secondPage.goto(base+'/c/club-a/intake');await summary(secondPage,'LOCAL_GLOBAL_NATIVE_REVOKED_DRAFT');await logout(second,'global');assert.equal(sql(`select count(*) from auth.sessions where user_id='${actorA}';`),'0');assert.equal(await intake(second),0);assert.equal(await intake(nativeB,profiles.B),1);checks.push('GLOBAL_NATIVE_SIGNOUT_CLOSES_ALL_ACTOR_SESSIONS_AND_PRESERVES_OTHER_PARENT');
  await secondPage.getByRole('button',{name:'Intake opslaan',exact:true}).click();await secondPage.waitForURL('**/login');assert.deepEqual(readback(profiles.A),originalA);checks.push('GLOBAL_NATIVE_REVOKED_FORM_CANNOT_COMMIT');
  await cooldownA();const {context:renewedAccount}=await login('ouder-a@example.test');const renewed=await nativeSession(renewedAccount,actorA);assert.ok(renewed.id!==first.id && renewed.id!==second.id,'fresh native session; identifiers withheld');assert.equal(await intake(renewed),1);assert.equal(await intake(renewed,profiles.B),0);assert.deepEqual(readback(profiles.A),originalA);checks.push('NEW_OTP_AFTER_GLOBAL_SIGNOUT_REQUIRES_AND_ISSUES_A_NEW_NATIVE_SESSION');
  assert.deepEqual(hydration,[]);checks.push('NO_HYDRATION_MISMATCHES');
  const result={observed_at:new Date().toISOString(),environment:'local',app_build:'production standalone; exact source and BUILD_ID in the paired capture manifest',database_migrations:Number(sql('select count(*) from supabase_migrations.schema_migrations;')),fixture:'synthetic core-v1; actual local OTP, distinct actual native sessions and native local/global sign-out; session material only in process memory',checks,passed:true,readback:{parent_a_unchanged:true,first_session_removed_at_local_probe:true,all_parent_a_sessions_removed_at_global_probe:true,new_native_session_after_fresh_otp:true,other_parent_personal_intake_rows:1,profile:originalA},staging_verified:false};
  await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'PASS',checks:checks.length,environment:'local',staging_verified:false}));
 }
}finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();}
