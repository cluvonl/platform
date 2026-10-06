import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

// Use a separately installed, pinned browser toolchain; runtime dependencies and
// the application lockfile stay unchanged. Only local synthetic accounts/mail.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:3200';
const mail = 'http://127.0.0.1:55324';
const output = 'docs/release/evidence/local/20261006-w01';
await mkdir(`${output}/screenshots`, {recursive: true});
const browser = await chromium.launch({headless: true});
const checks = [];
const contexts = [];
const hydrationErrors = [];
const options = {locale: 'nl-NL', timezoneId: 'Europe/Amsterdam', viewport: {width: 1440, height: 1024}, reducedMotion: 'reduce'};

function track(context) {
  contexts.push(context);
  context.on('page', (page) => page.on('console', (message) => {
    if (/hydration|hydrated|didn't match/i.test(message.text())) hydrationErrors.push(message.text());
  }));
  return context;
}

async function login(email) {
  assert.ok(email.endsWith('@example.test'));
  const context = track(await browser.newContext(options));
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  const previousMail = new Set((await fetch(`${mail}/api/v1/messages`).then((response) => response.json())).messages.map(({ID}) => ID));
  await page.getByLabel('Persoonlijk e-mailadres').fill(email);
  await page.getByRole('button', {name: 'Stuur mijn inlogcode'}).click();
  await page.waitForURL('**/auth/verify?sent=1');
  let token;
  for (let attempt = 0; attempt < 60 && !token; attempt++) {
    const list = await fetch(`${mail}/api/v1/messages`).then((response) => response.json());
    const message = list.messages.find((item) => !previousMail.has(item.ID) && item.To?.some((recipient) => recipient.Address === email));
    if (message) {
      const content = await fetch(`${mail}/api/v1/message/${message.ID}`).then((response) => response.json());
      token = (content.Text ?? content.HTML ?? '').match(/\b\d{6}\b/)?.[0];
    }
    if (!token) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(token, 'OTP arrives in local mail capture');
  await page.getByLabel('Eenmalige code').fill(token);
  await page.getByRole('button', {name: 'Veilig inloggen'}).click();
  await page.waitForURL('**/workspaces');
  await page.goto(`${base}/c/club-a/overzicht`);
  await page.getByRole('heading', {name: /Fijn dat je er bent/}).waitFor();
  if (hydrationErrors.length) await writeFile('/tmp/cluvo-browser-hydration.txt', hydrationErrors.join('\n'), {mode: 0o600});
  assert.equal(hydrationErrors.length, 0, 'server and browser hydrate consistently');
  assert.equal(await page.locator('.stat').nth(1).locator('strong').textContent(), '11 uur');
  return {context, page};
}

async function capture(page, name) {
  // Exclude the framework's development overlay from product screenshots.
  await page.addStyleTag({content: 'nextjs-portal{display:none!important}'});
  for (const viewport of [{width: 1440, height: 1024}, {width: 390, height: 844}, {width: 768, height: 1024}]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: `${output}/screenshots/${name}-${viewport.width}x${viewport.height}.png`, fullPage: true, caret: 'initial'});
  }
  await page.setViewportSize(options.viewport);
}

try { if (process.env.REFERENCE_ONLY !== '1') {
  const {page: a, context: accountA} = await login('ouder-a@example.test');
  checks.push('LOCAL_AUTH_OTP_TO_WORKSPACE');
  assert.equal(await a.locator('[data-help-id="page.overzicht"]').count(), 1);
  await capture(a, 'app-overzicht-unseen');
  await a.getByRole('button', {name: 'Uitleg sluiten: Jouw startpunt in Cluvo'}).click();
  await a.locator('[data-help-id="page.overzicht"]').waitFor({state: 'hidden'});
  await a.reload();
  assert.equal(await a.locator('[data-help-id="page.overzicht"]').count(), 0);
  checks.push('H01_CROSS_BUTTON_RELOAD');

  // A second independent cookie jar is a second device, not a client role.
  const secondDevice = track(await browser.newContext({...options, storageState: await accountA.storageState()}));
  const secondPage = await secondDevice.newPage();
  await secondPage.goto(`${base}/c/club-a/overzicht`);
  await secondPage.getByRole('heading', {name: /Fijn dat je er bent/}).waitFor();
  assert.equal(await secondPage.locator('[data-help-id="page.overzicht"]').count(), 0);
  checks.push('H01_SECOND_DEVICE_SERVER_READ');

  const {page: b} = await login('ouder-b@example.test');
  assert.equal(await b.locator('[data-help-id="page.overzicht"]').count(), 1);
  checks.push('H03_OTHER_VERIFIED_ACCOUNT_UNSEEN');
  await b.getByRole('button', {name: 'Gezien: Jouw startpunt in Cluvo'}).focus();
  await b.keyboard.press('Enter');
  await b.locator('[data-help-id="page.overzicht"]').waitFor({state: 'hidden'});
  checks.push('H02_SEEN_KEYBOARD');
  const touchContext = track(await browser.newContext({...options, viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, storageState: await b.context().storageState()}));
  const touchPage = await touchContext.newPage();
  await touchPage.goto(`${base}/c/club-a/overzicht`);
  await touchPage.getByRole('button', {name: 'Gezien: De inzet van jouw huishouden'}).tap();
  await touchPage.locator('[data-help-id="panel.household"]').waitFor({state: 'hidden'});
  await touchPage.reload();
  assert.equal(await touchPage.locator('[data-help-id="panel.household"]').count(), 0);
  checks.push('H02_TOUCH_AND_SERVER_READBACK');

  const tab1 = await accountA.newPage(), tab2 = await accountA.newPage();
  await Promise.all([tab1.goto(`${base}/c/club-a/intake`), tab2.goto(`${base}/c/club-a/taken`)]);
  await capture(tab1, 'app-intake-unseen');
  await capture(tab2, 'app-taken-unseen');
  await Promise.all([
    tab1.getByRole('button', {name: 'Gezien: Vertel wat bij jou past'}).click(),
    tab2.getByRole('button', {name: 'Uitleg sluiten: Kies een verenigingstaak'}).click(),
  ]);
  await Promise.all([
    tab1.locator('[data-help-id="page.intake"]').waitFor({state: 'hidden'}),
    tab2.locator('[data-help-id="page.taken"]').waitFor({state: 'hidden'}),
  ]);
  await Promise.all([tab1.reload(), tab2.reload()]);
  assert.equal(await tab1.locator('[data-help-id="page.intake"]').count(), 0);
  assert.equal(await tab2.locator('[data-help-id="page.taken"]').count(), 0);
  checks.push('H04_CONCURRENT_TABS_DIFFERENT_TOPICS');

  // Rollback a failed dismissal visually; it must never claim persistence.
  await b.goto(`${base}/c/club-a/intake`);
  await b.route('**/c/club-a/intake', (route) => route.request().method() === 'POST' ? route.abort('failed') : route.continue());
  await b.getByRole('button', {name: 'Gezien: Vertel wat bij jou past'}).click();
  await b.locator('[data-help-id="page.intake"] [role="alert"]').waitFor();
  assert.equal(await b.locator('[data-help-id="page.intake"]').count(), 1);
  await b.unroute('**/c/club-a/intake');
  await b.getByRole('button', {name: 'Gezien: Vertel wat bij jou past'}).click();
  await b.locator('[data-help-id="page.intake"]').waitFor({state: 'hidden'});
  checks.push('H04_FAILED_WRITE_RETRY');

  await b.goto(`${base}/c/club-a/taken`);
  const bookingForm = b.locator('form').filter({has: b.locator('input[name="positionId"][value="aa210000-0000-4000-8000-000000000002"]')});
  await bookingForm.getByRole('button', {name: 'Boek deze plek'}).click();
  await b.getByText('Bezet of gesloten · plaats 2', {exact: true}).waitFor();
  await b.goto(`${base}/c/club-a/overzicht`);
  assert.equal(await b.locator('.stat').nth(2).locator('strong').textContent(), '4 uur');
  assert.equal(await b.locator('.stat').nth(0).locator('strong').textContent(), '1 uur');
  checks.push('P02_REAL_BOOKING_SHARED_PLANNED_CONFIRMED_READBACK');

  await a.goto(`${base}/c/club-a/overzicht`);
  await a.addStyleTag({content: 'nextjs-portal{display:none!important}'});
  await a.getByRole('button', {name: 'Zoeken in Cluvo'}).click();
  await a.getByRole('dialog').getByLabel('Zoek een pagina').fill('intake');
  assert.equal(await a.getByRole('dialog').getByRole('link').count(), 1);
  await a.keyboard.press('Escape');
  checks.push('P00_SEARCH_DIALOG_KEYBOARD');
  for (const viewport of [{width: 1440, height: 1024}, {width: 768, height: 1024}, {width: 390, height: 844}, {width: 320, height: 844}]) {
    await a.setViewportSize(viewport);
    await a.screenshot({path: `${output}/screenshots/app-overzicht-${viewport.width}x${viewport.height}.png`, fullPage: true, caret: 'initial'});
    assert.ok(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'workspace fits viewport');
  }
  await a.getByRole('button', {name: 'Toggle Sidebar'}).click();
  await a.getByRole('button', {name: 'Uitloggen'}).click();
  await a.waitForURL('**/login');
  checks.push('P00_MOBILE_LOGOUT');
  await a.goto(`${base}/c/club-a/overzicht`);
  await a.waitForURL('**/login');
  checks.push('UNAUTHENTICATED_DIRECT_ROUTE_DENIED');
  await b.goto(`${base}/c/club-b/overzicht`);
  await b.waitForURL('**/login');
  checks.push('CROSS_TENANT_DIRECT_ROUTE_DENIED');

  const readback = execFileSync('docker', ['exec', 'supabase_db_cluvo-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', "select count(*) from app.user_help_seen where auth_user_id = '11111111-1111-4111-8111-111111111111';"], {encoding: 'utf8'}).trim();
  assert.equal(readback, '3');
  checks.push('DATABASE_READBACK_THREE_ACCOUNT_A_TOPICS');
  const bookingReadback = execFileSync('docker', ['exec', 'supabase_db_cluvo-local', 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', "select count(*) from app.bookings where position_id='aa210000-0000-4000-8000-000000000002' and executor_person_id='a1000000-0000-4000-8000-000000000002' and booked_by_auth_user_id='22222222-2222-4222-8222-222222222222' and state='booked';"], {encoding: 'utf8'}).trim();
  assert.equal(bookingReadback, '1');
  if (hydrationErrors.length) await writeFile('/tmp/cluvo-browser-hydration.txt', hydrationErrors.join('\n'), {mode: 0o600});
  assert.equal(hydrationErrors.length, 0, 'all tested routes hydrate consistently');
  await writeFile(`${output}/browser-results.json`, JSON.stringify({environment: 'local', fixture: 'core SQL fixture, synthetic example.test accounts', checks, passed: true, staging_verified: false}, null, 2));
  console.log(JSON.stringify({result: 'PASS', environment: 'local', checks: checks.length, staging_verified: false}));
}
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}

if (process.env.CAPTURE_REFERENCE === '1') {
  const catalogue = JSON.parse(await readFile('docs/handover/2026-10-06/registers/functies.json', 'utf8'));
  const referenceBrowser = await chromium.launch({headless: true});
  const context = await referenceBrowser.newContext(options);
  const page = await context.newPage();
  const role = process.env.REFERENCE_ROLE ?? 'bestuur';
  const referenceDirectory = role === 'bestuur' ? 'reference' : `reference-${role}`;
  await mkdir(`${output}/screenshots/${referenceDirectory}`, {recursive: true});
  try {
    await page.goto('http://127.0.0.1:3201');
    await page.locator('.page-title').waitFor();
    await page.waitForFunction(() => localStorage.getItem('cluvo-demo-v1') !== null);
    await page.evaluate((role) => {
      const state = JSON.parse(localStorage.getItem('cluvo-demo-v1'));
      state.role = role;
      localStorage.setItem('cluvo-demo-v1', JSON.stringify(state));
    }, role);
    await page.reload();
    for (const viewport of [{width: 1440, height: 1024}, {width: 390, height: 844}, {width: 768, height: 1024}]) {
      await page.setViewportSize(viewport);
      for (const item of catalogue.pages.filter(({id, route}) => id !== 'P00' && (!process.env.REFERENCE_ROUTES || process.env.REFERENCE_ROUTES.split(',').includes(route)))) {
        await page.goto(`http://127.0.0.1:3201/#${item.route}`);
        await page.locator(`[data-help-id="page.${item.route}"]`).waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({content: 'nextjs-portal{display:none!important}'});
        await page.screenshot({path: `${output}/screenshots/${referenceDirectory}/${item.id}-${item.route}-${viewport.width}x${viewport.height}.png`, fullPage: true, caret: 'initial'});
      }
    }
    console.log(JSON.stringify({prototype_sha: catalogue.source_sha, fixture_role: role, staging_verified: false}));
  } finally {await context.close(); await referenceBrowser.close();}
}
