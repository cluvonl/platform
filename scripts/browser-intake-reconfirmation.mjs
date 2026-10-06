import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:3200', mail = 'http://127.0.0.1:55324';
const output = process.env.EVIDENCE_OUTPUT ?? 'docs/release/evidence/local/20261006-w02-intake-reconfirmation';
const options = {viewport: {width: 1440, height: 1024}, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce'};
const browser = await chromium.launch({headless: true}), contexts = [], checks = [], hydration = [];
const sql = (query) => execFileSync('docker', ['exec', '-i', 'supabase_db_cluvo-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-qtA', '-v', 'ON_ERROR_STOP=1'], {input: query, encoding: 'utf8'}).trim();
const profiles = {A: 'a4000000-0000-4000-8000-000000000001', B: 'a4000000-0000-4000-8000-000000000002'};
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
const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids={previous:'ad170000-0000-4000-8000-000000000001',season:'ad170000-0000-4000-8000-000000000002',later:'ad170000-0000-4000-8000-000000000003',rollover:'ad171000-0000-4000-8000-000000000001',laterRun:'ad171000-0000-4000-8000-000000000002',a:'ad172000-0000-4000-8000-000000000001',b:'ad172000-0000-4000-8000-000000000002',laterA:'ad172000-0000-4000-8000-000000000003',delegate:'ad173000-0000-4000-8000-000000000001',newDelegate:'ad173000-0000-4000-8000-000000000002'};
const annualUrl=(profile,item)=>`${base}/c/club-a/intake/herbevestigen?profile=${profile}&item=${item}`;
function annualReadback(profile,item){
 assert.ok(Object.values(profiles).includes(profile)&&[ids.a,ids.b,ids.laterA].includes(item));
 return JSON.parse(sql(`select json_build_object('profile_version',p.version,'answer_revision',p.current_revision,
  'answer_versions',(select count(*) from app.intake_answers_versions where profile_id=p.id),
  'item_version',i.version,'item_state',i.state,'receipts',(select count(*) from app.intake_reconfirmation_receipts where reconfirmation_item_id=i.id),
  'receipt_revision',(select answer_revision from app.intake_reconfirmation_receipts where reconfirmation_item_id=i.id),
  'annual_audits',(select count(*) from app.audit_events where action='intake.annually_reconfirmed' and payload_minimal->>'item_id'=i.id::text),
  'annual_commands',(select count(*) from app.idempotency_records where operation='confirm_intake_reconfirmation' and status='completed' and result_jsonb->>'resource_id'=i.id::text),
  'confirmed_minutes',(select sum(minutes_delta) from app.hour_ledger_entries where tenant_id=p.tenant_id),
  'target_minutes',(select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001'),
  'obligations',(select count(*) from app.obligations where tenant_id=p.tenant_id),
  'bookings',(select count(*) from app.bookings where tenant_id=p.tenant_id))
  from app.intake_profiles p join app.season_reconfirmation_items i on i.source_resource_id=p.id and i.tenant_id=p.tenant_id where p.id='${profile}' and i.id='${item}';`));
}
function createDelegate(id){
 assert.ok([ids.delegate,ids.newDelegate].includes(id));
 sql(`insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,granted_by_auth_user_id)
  values('${id}','${tenant}','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','intake_assistance',statement_timestamp()-interval '1 day','22222222-2222-4222-8222-222222222222');`);
}
async function confirm(page){await page.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await page.getByRole('status').filter({hasText:'Je intake is herbevestigd'}).waitFor();}
try{
 const config=await fetch(base+'/api/runtime-config').then(r=>r.json());const endpoint=new URL(config.url);assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.port,'55321');
 await mkdir(output+'/screenshots',{recursive:true});
 assert.equal(sql(`select count(*) from app.rollover_runs where id='${ids.rollover}';`),'0','preserve any existing yearly fixture');
 // Only a disposable local downstream fixture. Scheduler/rollover acceptance is separate.
 sql(`begin;
  insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,status) values
   ('${ids.previous}','${tenant}','Vorige intakeproef','2025-07-01','2026-06-30','2025-12-15','closed'),
   ('${ids.season}','${tenant}','2027–2028','2027-07-01','2028-06-30','2027-12-15','preparing');
  insert into app.rollover_runs(id,tenant_id,source_season_id,target_season_id,created_by_auth_user_id,idempotency_key)
   values('${ids.rollover}','${tenant}','${ids.previous}','${ids.season}','33333333-3333-4333-8333-333333333333','ad179000-0000-4000-8000-000000000001');
  insert into app.season_reconfirmation_items(id,tenant_id,rollover_run_id,target_season_id,subject_kind,person_id,source_resource_id) values
   ('${ids.a}','${tenant}','${ids.rollover}','${ids.season}','intake','a1000000-0000-4000-8000-000000000001','${profiles.A}'),
   ('${ids.b}','${tenant}','${ids.rollover}','${ids.season}','intake','a1000000-0000-4000-8000-000000000002','${profiles.B}');commit;`);
 const {context:accountA,page:a}=await login('ouder-a@example.test');const originalA=annualReadback(profiles.A,ids.a);
 await a.getByRole('link',{name:'Intake controleren voor 2027–2028'}).click();await a.getByRole('heading',{name:'Past je intake nog bij je?'}).waitFor();
 assert.equal(await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).isDisabled(),true);assert.ok((await a.locator('.detail-meta').textContent()).includes('Eerder opgegeven seizoenswens'));checks.push('EXPLICIT_REVIEW_OF_SAVED_PERSONAL_ANSWERS_REQUIRED');
 const {context:accountB,page:b}=await login('ouder-b@example.test');await b.goto(annualUrl(profiles.A,ids.a));await b.getByRole('heading',{name:'Herbevestiging niet beschikbaar'}).waitFor();assert.equal(await b.locator('.detail-meta').count(),0);checks.push('OTHER_PARENT_DIRECT_REQUEST_AND_ANSWERS_DENIED');
 await b.goto(`${base}/c/club-a/intake/herbevestigen?profile=b4000000-0000-4000-8000-000000000001&item=${ids.a}`);await b.getByRole('heading',{name:'Herbevestiging niet beschikbaar'}).waitFor();checks.push('FOREIGN_TENANT_PROFILE_CONTEXT_DENIED');
 const ownCookies=await accountA.cookies();await a.getByRole('checkbox').check();await accountA.clearCookies();await accountA.addCookies(await accountB.cookies());
 await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.getByRole('alert').filter({hasText:'niet beschikbaar'}).waitFor();assert.deepEqual(annualReadback(profiles.A,ids.a),originalA);checks.push('WRONG_SIGNED_IDENTITY_ACTUAL_SERVER_ACTION_DENIED');
 await accountA.clearCookies();await accountA.addCookies(ownCookies);
 const edit=await accountA.newPage();await edit.goto(base+'/c/club-a/intake');await summary(edit,'LOCAL_RECONFIRM_A_REVIEWED');
 await edit.getByRole('button',{name:'Intake opslaan',exact:true}).click();await edit.getByRole('status').filter({hasText:'veilig opgeslagen'}).waitFor();
 const revised=annualReadback(profiles.A,ids.a);assert.equal(revised.profile_version,originalA.profile_version+1);assert.equal(revised.receipts,0);
 await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.waitForTimeout(800);
 assert.equal(await a.locator('input[name="expectedProfileVersion"]').inputValue(),String(originalA.profile_version));
 await a.getByRole('checkbox').check();
 await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.getByRole('alert').filter({hasText:'intussen gewijzigd'}).waitFor();assert.deepEqual(annualReadback(profiles.A,ids.a),revised);checks.push('FOCUS_REFRESH_CANNOT_CONFIRM_A_STALE_ANSWER_SNAPSHOT');
 await a.reload();await a.getByRole('checkbox').waitFor();assert.equal(await a.getByRole('checkbox').isChecked(),false);assert.ok((await a.locator('.detail-meta').textContent()).includes('LOCAL_RECONFIRM_A_REVIEWED'));await capture(a,'app-annual-review');
 await a.getByRole('checkbox').check();const key=await a.locator('input[name="idempotencyKey"]').inputValue();
 let lost=false;await a.route('**/c/club-a/intake/herbevestigen**',async route=>{if(route.request().method()!=='POST')return route.continue();let response;try{response=await route.fetch();}catch{throw new Error('Local confirmation request failed; private request diagnostics withheld.');}assert.ok(response.ok());lost=true;await route.abort('failed');});
 await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.getByRole('alert').filter({hasText:'geen bevestiging'}).waitFor();assert.ok(lost);
 const committed=annualReadback(profiles.A,ids.a);assert.deepEqual(committed,{...revised,profile_version:revised.profile_version+1,item_version:2,item_state:'confirmed',receipts:1,receipt_revision:revised.answer_revision,annual_audits:1,annual_commands:1});
 await a.unroute('**/c/club-a/intake/herbevestigen**');await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await a.waitForTimeout(800);
 assert.equal(await a.locator('input[name="idempotencyKey"]').inputValue(),key);assert.equal(await a.locator('input[name="expectedProfileVersion"]').inputValue(),String(revised.profile_version));checks.push('COMMITTED_LOST_RESPONSE_PRESERVES_REVIEW_AND_FROZEN_COMMAND');await capture(a,'app-annual-lost-response');
 await a.locator('input[name="expectedProfileVersion"]').evaluate((input,value)=>{input.value=value;},String(committed.profile_version));await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.getByRole('alert').filter({hasText:'vorige bevestiging'}).waitFor();assert.deepEqual(annualReadback(profiles.A,ids.a),committed);checks.push('CHANGED_PAYLOAD_WITH_COMMITTED_KEY_DENIED');
 await a.locator('input[name="expectedProfileVersion"]').evaluate((input,value)=>{input.value=value;},String(revised.profile_version));
 // The completed, deliberately conflicting form action resets the native checkbox.
 // Review again before replay; a missing explicit review must remain rejected.
 await a.getByRole('checkbox').check();assert.equal(await a.locator('input[name="idempotencyKey"]').inputValue(),key);
 await confirm(a);assert.deepEqual(annualReadback(profiles.A,ids.a),committed);checks.push('EXACT_RETRY_ONE_RECEIPT_ONE_COMMAND_ONE_AUDIT');await capture(a,'app-annual-confirmed');
 await a.getByRole('link',{name:'Terug naar je intake'}).click();await summary(a,'LOCAL_CHANGED_AFTER_RECONFIRMATION');await a.getByRole('button',{name:'Intake opslaan',exact:true}).click();await a.getByRole('status').filter({hasText:'veilig opgeslagen'}).waitFor();
 const updated=annualReadback(profiles.A,ids.a);assert.equal(updated.answer_revision,committed.answer_revision+1);assert.equal(updated.receipt_revision,committed.receipt_revision);assert.equal(updated.annual_audits,1);checks.push('LATER_ANSWER_REVISION_PRESERVES_HISTORICAL_REVIEW_RECEIPT');
 await a.goto(annualUrl(profiles.A,ids.a));await a.getByRole('status').filter({hasText:'herbevestigd'}).waitFor();assert.ok((await a.locator('.detail-meta').textContent()).includes('LOCAL_CHANGED_AFTER_RECONFIRMATION'));assert.ok((await a.locator('.page-title').textContent()).includes('huidige opgeslagen antwoorden'));checks.push('CURRENT_ANSWERS_DISTINGUISHED_FROM_PREVIOUS_YEAR_CONFIRMATION');
 createDelegate(ids.delegate);await a.goto(annualUrl(profiles.B,ids.b));await a.getByLabel('Reden of context van de hulp').waitFor();assert.ok((await a.locator('.stack').first().textContent()).includes('Ouder B'));await a.getByRole('checkbox').check();
 const beforeB=annualReadback(profiles.B,ids.b);await a.locator('form').filter({has:a.locator('input[name="itemId"]')}).evaluate(form=>{form.noValidate=true;});await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.getByRole('alert').filter({hasText:'context van de hulp'}).waitFor();assert.deepEqual(annualReadback(profiles.B,ids.b),beforeB);checks.push('ASSISTED_CONFIRMATION_REASON_ENFORCED_BY_SERVER');
 await a.getByLabel('Reden of context van de hulp').fill('Synthetische telefoonhulp met toestemming');await a.getByRole('checkbox').check();sql(`update app.acting_delegations set revoked_at=statement_timestamp() where id='${ids.delegate}';`);
 await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.getByRole('alert').filter({hasText:'niet beschikbaar'}).waitFor();assert.deepEqual(annualReadback(profiles.B,ids.b),beforeB);await a.reload();await a.getByRole('heading',{name:'Herbevestiging niet beschikbaar'}).waitFor();assert.equal(await a.locator('.detail-meta').count(),0);checks.push('REVOKED_ASSISTANCE_BLOCKS_ACTUAL_ACTION_AND_PRIVATE_PAGE');
 createDelegate(ids.newDelegate);await a.goto(annualUrl(profiles.B,ids.b));await a.getByLabel('Reden of context van de hulp').fill('Nieuwe synthetische telefoonhulp met toestemming');await a.getByRole('checkbox').check();await capture(a,'app-annual-assisted-review');
 let originalRequest;await a.route('**/c/club-a/intake/herbevestigen**',route=>{if(route.request().method()==='POST')originalRequest={url:route.request().url(),headers:route.request().headers(),body:route.request().postDataBuffer()};return route.continue();});
 await confirm(a);await a.unroute('**/c/club-a/intake/herbevestigen**');const confirmedB=annualReadback(profiles.B,ids.b);assert.equal(confirmedB.receipts,1);assert.equal(confirmedB.answer_revision,beforeB.answer_revision);assert.equal(confirmedB.profile_version,beforeB.profile_version+1);
 const attribution=JSON.parse(sql(`select json_build_object('actor_correct',actor_auth_user_id='11111111-1111-4111-8111-111111111111','subject_correct',represented_person_id='a1000000-0000-4000-8000-000000000002','reason_recorded',assistance_reason is not null) from app.intake_reconfirmation_receipts where reconfirmation_item_id='${ids.b}';`));assert.deepEqual(attribution,{actor_correct:true,subject_correct:true,reason_recorded:true});checks.push('ASSISTED_CONFIRMATION_RECORDS_REAL_ACTOR_AND_SUBJECT_PRIVATELY');
 sql(`update app.acting_delegations set revoked_at=statement_timestamp() where id='${ids.newDelegate}';`);assert.ok(originalRequest?.body);
 let replay;try{replay=await a.request.post(originalRequest.url,{headers:originalRequest.headers,data:originalRequest.body});}catch{throw new Error('Scoped action replay failed; private request diagnostics withheld.');}assert.ok((await replay.text()).includes('Deze intakeherbevestiging is niet beschikbaar'));assert.deepEqual(annualReadback(profiles.B,ids.b),confirmedB);checks.push('REVOKED_HELPER_CANNOT_REPLAY_PRIOR_SERVER_ACTION_SUCCESS');
 await b.goto(annualUrl(profiles.B,ids.b));await b.getByRole('status').filter({hasText:'herbevestigd'}).waitFor();await b.goto(annualUrl(profiles.A,ids.a));await b.getByRole('heading',{name:'Herbevestiging niet beschikbaar'}).waitFor();assert.ok(!(await b.content()).includes('LOCAL_CHANGED_AFTER_RECONFIRMATION'));checks.push('RECEIPT_OWNER_READS_OWN_CONFIRMATION_WITH_SEPARATED_PARENT_PRIVACY');
 sql(`begin;insert into app.seasons(id,tenant_id,name,starts_on,ends_on,winter_cutoff_at,status) values('${ids.later}','${tenant}','2028–2029','2028-07-01','2029-06-30','2028-12-15','preparing');
  insert into app.rollover_runs(id,tenant_id,source_season_id,target_season_id,created_by_auth_user_id,idempotency_key) values('${ids.laterRun}','${tenant}','${ids.previous}','${ids.later}','33333333-3333-4333-8333-333333333333','ad179000-0000-4000-8000-000000000002');
  insert into app.season_reconfirmation_items(id,tenant_id,rollover_run_id,target_season_id,subject_kind,person_id,source_resource_id) values('${ids.laterA}','${tenant}','${ids.laterRun}','${ids.later}','intake','a1000000-0000-4000-8000-000000000001','${profiles.A}');commit;`);
 await a.goto(annualUrl(profiles.A,ids.laterA));await a.getByRole('checkbox').check();const pendingLater=annualReadback(profiles.A,ids.laterA);await accountA.clearCookies();await a.getByRole('button',{name:'Intake herbevestigen',exact:true}).click();await a.waitForURL('**/login');assert.deepEqual(annualReadback(profiles.A,ids.laterA),pendingLater);checks.push('LOST_SESSION_REDIRECTS_WITHOUT_YEAR_CONFIRMATION');
 assert.equal(updated.confirmed_minutes,60);assert.equal(updated.target_minutes,720);assert.equal(updated.obligations,originalA.obligations);assert.equal(updated.bookings,originalA.bookings);assert.equal(confirmedB.confirmed_minutes,60);assert.equal(confirmedB.target_minutes,720);checks.push('TARGET_LEDGER_BOOKINGS_AND_OBLIGATIONS_UNCHANGED');
 assert.deepEqual(hydration,[]);checks.push('NO_HYDRATION_MISMATCHES');
 const result={environment:'local',app_build:'production standalone',fixture:'synthetic downstream rollover items; actual local OTP and native server actions; scheduler/rollover/provider acceptance not claimed',checks,passed:true,readback:{parent_a:updated,parent_b:confirmedB,pending_next_year:pendingLater,assisted_attribution:attribution},staging_verified:false};
 await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'PASS',checks:checks.length,environment:'local',staging_verified:false}));
}finally{await Promise.all(contexts.map(context=>context.close()));await browser.close();}
