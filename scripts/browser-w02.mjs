import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:3200', mail = 'http://127.0.0.1:55324';
const output = 'docs/release/evidence/local/20261006-w02';
const options = {viewport: {width: 1440, height: 1024}, locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', reducedMotion: 'reduce'};
await mkdir(`${output}/screenshots`, {recursive: true});
const browser = await chromium.launch({headless: true}), contexts = [], checks = [], hydration = [];
const sql = (query) => execFileSync('docker', ['exec', '-i', 'supabase_db_cluvo-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'], {input: query, encoding: 'utf8'}).trim();
async function login(email) {
  assert.ok(email.endsWith('@example.test'));
  const context = await browser.newContext(options); contexts.push(context);
  context.on('page', (page) => page.on('console', (message) => {if (/hydration|hydrated|didn't match/i.test(message.text())) hydration.push(message.text());}));
  const page = await context.newPage(); await page.goto(`${base}/login`);
  const previous = new Set((await fetch(`${mail}/api/v1/messages`).then((response) => response.json())).messages.map(({ID}) => ID));
  await page.getByLabel('Persoonlijk e-mailadres').fill(email); await page.getByRole('button', {name: 'Stuur mijn inlogcode'}).click(); await page.waitForURL('**/auth/verify?sent=1');
  let token;
  for (let attempt = 0; attempt < 60 && !token; attempt++) {
    const list = await fetch(`${mail}/api/v1/messages`).then((response) => response.json());
    const message = list.messages.find((item) => !previous.has(item.ID) && item.To?.some((recipient) => recipient.Address === email));
    if (message) { const content = await fetch(`${mail}/api/v1/message/${message.ID}`).then((response) => response.json()); token = (content.Text ?? content.HTML ?? '').match(/\b\d{6}\b/)?.[0]; }
    if (!token) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(token); await page.getByLabel('Eenmalige code').fill(token); await page.getByRole('button', {name: 'Veilig inloggen'}).click(); await page.waitForURL('**/workspaces');
  await page.goto(`${base}/c/club-a/intake`); await page.getByRole('heading', {name: 'Jouw talent. Jouw bijdrage.'}).waitFor();
  return {context, page};
}
async function summary(page) {for (let step = 0; step < 3; step++) await page.getByRole('button', {name: 'Verder', exact: true}).click(); await page.getByRole('heading', {name: 'Dit past bij jou.'}).waitFor();}
async function save(page) {await page.getByRole('button', {name: 'Intake opslaan', exact: true}).click(); await page.getByRole('status').filter({hasText: 'Je persoonlijke intake is veilig opgeslagen.'}).waitFor();}
async function capture(page, step, prefix = 'app') {
  for (const viewport of [{width:1440,height:1024},{width:390,height:844},{width:768,height:1024}]) {
    await page.setViewportSize(viewport); await page.evaluate(() => {window.scrollTo({top: 0, left: 0, behavior: 'instant'}); return document.fonts.ready;});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({path:`${output}/screenshots/${prefix}-intake-step${step}-${viewport.width}x${viewport.height}.png`,fullPage:true,caret:'initial'});
  }
  await page.setViewportSize(options.viewport);
}
try {
  const {context: accountA, page: a} = await login('ouder-a@example.test'); checks.push('REAL_LOCAL_OTP_ACCOUNT_A');
  await a.getByLabel('Praktische ervaring').fill('LOCAL_INTAKE_A_PRIVATE');
  await a.getByRole('checkbox', {name: 'Ik start graag samen met een ervaren maatje'}).check(); await capture(a,0);
  await a.getByRole('button', {name:'Verder',exact:true}).click();
  assert.equal(await a.getByRole('button', {name:'Bar',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await a.getByRole('button', {name:'EHBO',exact:true}).getAttribute('aria-pressed'),'true'); checks.push('LEGACY_PREFERENCES_VISIBLE_AND_PRESERVED');
  await a.getByRole('button', {name:'Gastvrijheid',exact:true}).click(); await a.getByRole('button', {name:'Trainer',exact:true}).click(); await capture(a,1);
  await a.getByRole('button', {name:'Verder',exact:true}).click();
  await a.getByRole('button', {name:'Zaterdag ochtend',exact:true}).click();
  await a.getByLabel('Gewenste inzet per maand (uur)').fill('0');
  await a.getByLabel('Wat lukt minder goed?').fill('LOCAL_PRACTICAL_BOUNDARY_A');
  await a.getByLabel('Verhinderde datums').fill('2026-02-30');
  await a.getByRole('button', {name:'Verder',exact:true}).click(); await a.getByRole('alert').filter({hasText:'echte datums'}).waitFor(); checks.push('IMPOSSIBLE_DAY_REJECTED_WITH_DRAFT_INTACT');
  await a.getByLabel('Verhinderde datums').fill('2026-03-29, 2026-10-25, 2027-02-01');
  await a.getByRole('button', {name:'IVA',exact:true}).click(); await a.getByRole('checkbox', {name:'Je mag mij benaderen voor een last-minute plek'}).check(); await capture(a,2);
  await a.getByRole('button', {name:'Verder',exact:true}).click(); await capture(a,3); await save(a); checks.push('FOUR_STEPS_EXPLICIT_SAVE');
  const zero = JSON.parse(sql("select json_build_object('version',p.version,'monthly',a.answers->'desired_monthly_minutes','annual',p.desired_minutes) from app.intake_profiles p join app.intake_answers_versions a on a.profile_id=p.id and a.revision=p.current_revision where p.id='a4000000-0000-4000-8000-000000000001';"));
  assert.equal(zero.version,2); assert.equal(zero.monthly,0); assert.equal(zero.annual,240); checks.push('ZERO_MONTHLY_MINUTES_DISTINCT_FROM_SEASONAL_WISH');
  await a.reload(); assert.equal(await a.getByLabel('Praktische ervaring').inputValue(),'LOCAL_INTAKE_A_PRIVATE'); await a.getByRole('checkbox', {name:'Ik start graag samen met een ervaren maatje'}).waitFor();
  assert.equal(await a.getByRole('checkbox', {name:'Ik start graag samen met een ervaren maatje'}).isChecked(),true); checks.push('SERVER_RELOAD_PRESERVES_PERSONAL_ANSWERS');
  const device = await browser.newContext({...options,viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:await accountA.storageState()}); contexts.push(device);
  const touch = await device.newPage(); await touch.goto(`${base}/c/club-a/intake`); assert.equal(await touch.getByLabel('Praktische ervaring').inputValue(),'LOCAL_INTAKE_A_PRIVATE'); await touch.getByRole('button',{name:'Verder',exact:true}).tap(); await touch.getByRole('button',{name:'Verder',exact:true}).tap(); assert.equal(await touch.getByLabel('Gewenste inzet per maand (uur)').inputValue(),'0'); checks.push('SECOND_DEVICE_TOUCH_SERVER_READ');
  const {page:b} = await login('ouder-b@example.test'); assert.ok(!(await b.content()).includes('LOCAL_INTAKE_A_PRIVATE')); assert.ok(!(await b.content()).includes('LOCAL_PRACTICAL_BOUNDARY_A')); checks.push('SEPARATED_PARENT_HTML_PRIVACY');
  const stale = await accountA.newPage(); await stale.goto(`${base}/c/club-a/intake`); await stale.getByLabel('Praktische ervaring').fill('LOCAL_STALE_DRAFT'); await summary(stale);
  await a.getByLabel('Praktische ervaring').fill('LOCAL_INTAKE_A_LATEST'); await a.getByRole('button',{name:'Verder',exact:true}).click(); await a.getByRole('button',{name:'Verder',exact:true}).click(); await a.getByLabel('Gewenste inzet per maand (uur)').fill('1:30'); await a.getByRole('button',{name:'Verder',exact:true}).click(); await save(a);
  await stale.evaluate(()=>window.dispatchEvent(new Event('focus'))); await stale.waitForTimeout(800); assert.equal(await stale.locator('input[name="expectedVersion"]').inputValue(),'2');
  await stale.getByRole('button',{name:'Intake opslaan',exact:true}).click(); await stale.getByRole('alert').filter({hasText:'intussen gewijzigd'}).waitFor(); assert.ok((await stale.locator('.detail-meta').textContent()).includes('LOCAL_STALE_DRAFT')); checks.push('FOCUS_REFRESH_CANNOT_ADVANCE_STALE_DRAFT_VERSION');
  assert.equal(sql("select answers->>'experience' from app.intake_answers_versions a join app.intake_profiles p on p.id=a.profile_id and p.current_revision=a.revision where p.id='a4000000-0000-4000-8000-000000000001';"),'LOCAL_INTAKE_A_LATEST'); checks.push('STALE_WRITE_DOES_NOT_OVERWRITE_DATABASE');
  const retry = await accountA.newPage(); await retry.goto(`${base}/c/club-a/intake`); await retry.getByLabel('Praktische ervaring').fill('LOCAL_INTAKE_A_RETRY'); await summary(retry);
  await retry.route('**/c/club-a/intake',(route)=>route.request().method()==='POST'?route.abort('failed'):route.continue()); await retry.getByRole('button',{name:'Intake opslaan',exact:true}).click(); await retry.getByRole('alert').filter({hasText:'geen bevestiging'}).waitFor();
  assert.ok((await retry.locator('.detail-meta').textContent()).includes('LOCAL_INTAKE_A_RETRY')); await retry.unroute('**/c/club-a/intake'); await save(retry); checks.push('FAILED_NETWORK_SAVE_RETAINS_DRAFT_AND_RETRIES');
  await retry.goto(`${base}/c/club-a/taken`);
  const blocked = retry.locator('form').filter({has:retry.locator('input[name="positionId"][value="aa210000-0000-4000-8000-000000000004"]')}); await blocked.getByRole('button',{name:'Boek deze plek'}).click(); await blocked.getByRole('alert').waitFor(); assert.equal(sql("select count(*) from app.bookings where position_id='aa210000-0000-4000-8000-000000000004';"),'0'); checks.push('PERSISTED_INTAKE_DAY_BLOCKS_NEW_BOOKING');
  await b.goto(`${base}/c/club-a/taken`); const available=b.locator('form').filter({has:b.locator('input[name="positionId"][value="aa210000-0000-4000-8000-000000000004"]')}); await available.getByRole('button',{name:'Boek deze plek'}).click(); await b.locator('.task-card').filter({hasText:'Aansluitende dienst'}).getByText('Bezet of gesloten · plaats 1',{exact:true}).waitFor(); assert.equal(sql("select count(*) from app.bookings where position_id='aa210000-0000-4000-8000-000000000004' and executor_person_id='a1000000-0000-4000-8000-000000000002';"),'1'); checks.push('OTHER_PARENT_AVAILABILITY_IS_INDEPENDENT');
  await retry.goto(`${base}/c/club-a/intake?profile=a4000000-0000-4000-8000-000000000002`); await retry.getByRole('heading',{name:'Intake niet beschikbaar'}).waitFor(); assert.equal(await retry.locator('.wizard').count(),0); checks.push('DIRECT_OTHER_PARENT_PROFILE_URL_DENIED');
  await retry.goto(`${base}/c/club-a/intake`); await summary(retry); await retry.locator('input[name="profileId"]').evaluate((element)=>{element.value='a4000000-0000-4000-8000-000000000002';}); await retry.getByRole('button',{name:'Intake opslaan',exact:true}).click(); await retry.getByRole('alert').filter({hasText:'niet beschikbaar'}).waitFor(); assert.equal(sql("select version from app.intake_profiles where id='a4000000-0000-4000-8000-000000000002';"),'1'); checks.push('TAMPERED_PROFILE_ACTION_DENIED');
  assert.equal(sql("select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001';"),'720'); assert.equal(sql("select sum(minutes_delta) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"),'60'); assert.equal(sql("select count(*) from app.bookings where id='aa300000-0000-4000-8000-000000000001' and state='booked';"),'1'); checks.push('TARGET_LEDGER_AND_ORIGINAL_BOOKING_UNCHANGED');
  const readback=JSON.parse(sql("select json_build_object('revisions',p.current_revision,'version',p.version,'monthly_minutes',a.answers->'desired_monthly_minutes','source_dates',(select count(*) from app.unavailability_periods where source_intake_profile_id=p.id),'authored_by_verified_actor',(a.authored_by_auth_user_id='11111111-1111-4111-8111-111111111111')) from app.intake_profiles p join app.intake_answers_versions a on a.profile_id=p.id and a.revision=p.current_revision where p.id='a4000000-0000-4000-8000-000000000001';")); assert.equal(readback.version,4); assert.equal(readback.monthly_minutes,90); assert.equal(readback.source_dates,3); assert.equal(readback.authored_by_verified_actor,true); checks.push('SQL_VERSION_ACTOR_AND_INTEGER_MINUTES_READBACK');

  sql("insert into app.acting_delegations(id,tenant_id,actor_auth_user_id,represented_person_id,household_id,scope,starts_at,granted_by_auth_user_id) values('ac029000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','intake_assistance',statement_timestamp()-interval '1 day','22222222-2222-4222-8222-222222222222');");
  await retry.goto(`${base}/c/club-a/intake?profile=a4000000-0000-4000-8000-000000000002`); await retry.getByLabel('Reden of context van de hulp').waitFor(); assert.ok((await retry.locator('.wizard').textContent()).includes('Ouder B')); checks.push('EXPLICIT_ASSISTED_CONTEXT_ALLOWED');
  await retry.getByRole('button',{name:'Verder',exact:true}).click(); await retry.getByRole('alert').filter({hasText:'context van de hulp'}).waitFor(); checks.push('ASSISTED_REASON_REQUIRED');
  await retry.getByLabel('Reden of context van de hulp').fill('Telefoonhulp met persoonlijke toestemming, synthetische proef'); await retry.getByLabel('Praktische ervaring').fill('LOCAL_ASSISTED_B'); await summary(retry); await save(retry);
  const assisted=JSON.parse(sql("select json_build_object('actor_correct',authored_by_auth_user_id='11111111-1111-4111-8111-111111111111','subject_correct',represented_person_id='a1000000-0000-4000-8000-000000000002','reason_present',nullif(assistance_reason,'') is not null) from app.intake_answers_versions where profile_id='a4000000-0000-4000-8000-000000000002' and revision=2;")); assert.deepEqual(assisted,{actor_correct:true,subject_correct:true,reason_present:true}); checks.push('ASSISTED_ACTOR_SUBJECT_AUDIT_READBACK');
  sql("update app.acting_delegations set revoked_at=statement_timestamp() where id='ac029000-0000-4000-8000-000000000001';");
  await retry.getByRole('button',{name:'Intake opslaan',exact:true}).click(); await retry.getByRole('alert').filter({hasText:'niet beschikbaar'}).waitFor(); assert.equal(sql("select version from app.intake_profiles where id='a4000000-0000-4000-8000-000000000002';"),'2');
  await retry.reload(); await retry.getByRole('heading',{name:'Intake niet beschikbaar'}).waitFor(); assert.ok(!(await retry.content()).includes('LOCAL_ASSISTED_B')); checks.push('REVOKED_DELEGATION_BLOCKS_ACTION_AND_READ');
  assert.deepEqual(hydration,[]); checks.push('NO_HYDRATION_MISMATCHES');
  await writeFile(`${output}/browser-results.json`,JSON.stringify({environment:'local',app_build:'production standalone',fixture:'core-v1 synthetic example.test accounts plus W01 booking',checks,passed:true,readback,staging_verified:false},null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',checks:checks.length,environment:'local',staging_verified:false}));
} finally {await Promise.all(contexts.map((context)=>context.close())); await browser.close();}
