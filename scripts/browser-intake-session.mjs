import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:3200', mail = 'http://127.0.0.1:55324';
const output = process.env.EVIDENCE_OUTPUT ?? 'docs/release/evidence/local/20261006-w02-intake-session';
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
try {
  const config = await fetch(base + '/api/runtime-config').then((r) => r.json());
  const endpoint = new URL(config.url); assert.equal(endpoint.hostname, '127.0.0.1'); assert.equal(endpoint.port, '55321');
  await mkdir(output + '/screenshots', {recursive: true});
  const {context: accountA, page: a} = await login('ouder-a@example.test');
  const originalA = readback(profiles.A);
  await summary(a, 'LOCAL_SESSION_EXPIRED_DRAFT');
  await accountA.clearCookies(); await a.getByRole('button', {name: 'Intake opslaan', exact: true}).click();
  await a.waitForFunction(() => location.pathname === '/login' || [...document.querySelectorAll('[role="alert"]')].some((node) => node.textContent.includes('geen bevestiging')));
  assert.deepEqual(readback(profiles.A), originalA, 'lost session cannot mutate an intake or ledger');
    await a.waitForURL('**/login'); await capture(a, 'app-intake-session-login'); checks.push('LOST_SESSION_INTAKE_ACTION_REDIRECTS_TO_LOGIN');
    checks.push('LOST_SESSION_HAS_NO_INTAKE_AUDIT_OR_LEDGER_MUTATION');
    const {context: accountB, page: b} = await login('ouder-b@example.test');
    const originalB = readback(profiles.B); await summary(b, 'LOCAL_SESSION_RETRY_B');
    const key = await b.locator('input[name="idempotencyKey"]').inputValue();
    const version = await b.locator('input[name="expectedVersion"]').inputValue();
    let committedResponseLost = false;
    await b.route('**/c/club-a/intake', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      let response;
      try {response = await route.fetch();} catch {throw new Error('Local intake request failed; private request diagnostics withheld.');}
      assert.ok(response.ok()); committedResponseLost = true;
      await route.abort('failed');
    });
    await b.getByRole('button', {name:'Intake opslaan', exact:true}).click();
    await b.getByRole('alert').filter({hasText:'geen bevestiging'}).waitFor(); assert.ok(committedResponseLost);
    assert.equal(await b.locator('input[name="idempotencyKey"]').inputValue(),key);
    assert.equal(await b.locator('input[name="expectedVersion"]').inputValue(),version);
    assert.ok((await b.locator('.detail-meta').textContent()).includes('LOCAL_SESSION_RETRY_B'));
    const committedB = readback(profiles.B);
    assert.deepEqual(committedB, {...originalB,version:originalB.version+1,revision:originalB.revision+1,
      answer_versions:originalB.answer_versions+1,save_audits:originalB.save_audits+1,completed_commands:originalB.completed_commands+1});
    checks.push('COMMITTED_RESPONSE_LOST_RETAINS_DRAFT_VERSION_AND_COMMAND_KEY'); await capture(b,'app-intake-lost-response');
    await b.unroute('**/c/club-a/intake'); await b.getByRole('button', {name:'Intake opslaan',exact:true}).click();
    await b.getByRole('status').filter({hasText:'Je persoonlijke intake is veilig opgeslagen.'}).waitFor();
    assert.deepEqual(readback(profiles.B),committedB); checks.push('EXACT_RETRY_ONE_REVISION_ONE_COMMAND_ONE_AUDIT');
    assert.equal(await b.locator('input[name="expectedVersion"]').inputValue(),String(committedB.version));
    assert.notEqual(await b.locator('input[name="idempotencyKey"]').inputValue(),key); checks.push('CONFIRMED_SAVE_ADVANCES_VERSION_AND_ROTATES_KEY');
    await accountB.clearCookies(); await b.getByRole('button', {name:'Intake opslaan',exact:true}).click(); await b.waitForURL('**/login');
    assert.deepEqual(readback(profiles.B),committedB); checks.push('SESSION_LOST_AFTER_SAVE_REDIRECTS_WITHOUT_SECOND_REVISION');
    assert.deepEqual(hydration,[]); checks.push('NO_HYDRATION_MISMATCHES');
    const result={environment:'local',app_build:'production standalone',fixture:'existing synthetic core-v1; independent actual OTP sessions',checks,passed:true,
      readback:{parent_a_unchanged:true,parent_b_before:originalB,parent_b_after:committedB,exact_retry_unchanged:true},staging_verified:false};
    await writeFile(output + '/browser-results.json',JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({result:'PASS',checks:checks.length,environment:'local',staging_verified:false}));
} finally {await Promise.all(contexts.map((context)=>context.close())); await browser.close();}
