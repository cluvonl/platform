import assert from 'node:assert/strict';
import {mkdir, writeFile, readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.PWA_BROWSER_BASE ?? 'http://127.0.0.1:3200';
const endpoint = new URL(base);
assert.ok(['127.0.0.1', 'localhost'].includes(endpoint.hostname), 'This browser suite is fixed to a local synthetic environment.');
const mail = 'http://127.0.0.1:55324';
const output = process.env.EVIDENCE_OUTPUT ?? 'docs/release/evidence/local/20261009-pwa-mobile';
const routes = ['home','tasks','agenda','teams','more','actions','notifications','manage','profile','household','policies','courses','opportunities','messages','settings','help','install','reports','finance','committees'];
const widths = [320,390,430,1440];
const focused=process.env.PWA_BROWSER_FOCUS==='flows';
const options = {viewport:{width:390,height:844},locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'};
const accounts = ['ouder-a@example.test','ouder-b@example.test','coordinator@example.test','tenant-b@example.test'];
const contexts = [], checks = [], matrix = [], tabletMatrix = [], consoleFailures = [];
const pageActors = new WeakMap();
const fixtureId = (number) => `cb000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
let stage = 'preflight', browser, lastPage;
let lostResponseProof, authenticating=false, nativeSchemaAtStart=null, nativeDomainAtStart=null;
const mobileSources=(await readdir('components/mobile')).filter((file)=>/\.(tsx?|mjs|css)$/.test(file)).map((file)=>'components/mobile/'+file);
const appSources=(await readdir('app/app',{recursive:true})).filter((file)=>/\.(tsx?|mjs|css)$/.test(file)).map((file)=>'app/app/'+file);
const pwaSources=(await readdir('lib/pwa')).filter((file)=>/\.(tsx?|mjs)$/.test(file)).map((file)=>'lib/pwa/'+file);
const sourceFiles=[...mobileSources,...appSources,...pwaSources,'components/app/help-provider.tsx','components/pwa/pwa-controls.tsx','components/pwa/push-subscription-control.tsx','scripts/browser-pwa-mobile.mjs','scripts/pwa-mobile-extended-flows.mjs'];
const migrationFiles=(await readdir('supabase/migrations')).filter((file)=>file.endsWith('.sql')).sort();
const migrationHashes=Object.fromEntries(await Promise.all(migrationFiles.map(async(file)=>[file,createHash('sha256').update(await readFile('supabase/migrations/'+file)).digest('hex')])));
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async(file)=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const fixtureFiles=['supabase/tests/pwa_browser_fixture.psql','supabase/tests/pwa_browser_batch_fixture.psql','supabase/tests/pwa_browser_document_repair.psql','supabase/tests/pwa_browser_report_grant.psql'];
const fixtureHashes=Object.fromEntries(await Promise.all(fixtureFiles.map(async(file)=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
const buildId=(await readFile('.next/BUILD_ID','utf8')).trim();
const metadata=()=>({browser:{name:'Chromium',version:browser?.version(),headless:true},platform:{os:process.platform,architecture:process.arch,timezone:options.timezoneId,locale:options.locale},build:{mode:'production',id:buildId,sourceFilesSha256:sourceHashes},database:{sourceMigrationCount:migrationFiles.length,migrationsSha256:migrationHashes,nativeAppliedSchemaAtStart:nativeSchemaAtStart},test_scope:{native_auth:true,synthetic_accounts:true,fixtureSourcesSha256:fixtureHashes,tenant:'club-a',household:fixtureId(100),cross_tenant_account:true},physical_device:false});
function setStage(value) {stage=value;console.log(JSON.stringify({phase:stage}));}
const sql = (query) => execFileSync('docker',['exec','-i','supabase_db_cluvo-local','psql','-U','postgres','-d','postgres','-qtA','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'}).trim();
function profileReadback() {
  return JSON.parse(sql("select json_build_object('version',p.version,'revision',p.current_revision,'answers',(select count(*) from app.intake_answers_versions where profile_id=p.id),'ledger',(select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id=p.tenant_id),'target',(select effective_target_minutes from app.obligations where id='cb000000-0000-4000-8000-000000000600')) from app.intake_profiles p where p.id='cb000000-0000-4000-8000-000000000501';"));
}
function nativeDomainReadback() {
  return JSON.parse(sql(`select json_build_object(
    'historical_bookings',(select json_agg(json_build_object('fixture_id',right(b.id::text,4),'version',b.version,'state',b.state,'credit_snapshot_minutes',b.credit_minutes_snapshot,'ledger_minutes',(select coalesce(sum(e.minutes_delta),0) from app.hour_ledger_entries e where e.booking_id=b.id)) order by b.id) from app.bookings b where b.id in ('${fixtureId(904)}','${fixtureId(905)}')),
    'policy_acceptances',(select coalesce(json_agg(json_build_object('assignment_fixture_id',right(a.assignment_id::text,4),'capacity',a.capacity,'explicit_confirmation',a.explicit_confirmation) order by a.assignment_id),'[]'::json) from app.policy_acceptances a where a.assignment_id in ('${fixtureId(1403)}','${fixtureId(1404)}')),
    'handover_states',(select coalesce(json_agg(json_build_object('state',h.state,'version',h.version,'named_successor_is_parent_a',h.successor_person_id='a1000000-0000-4000-8000-000000000001') order by h.id),'[]'::json) from app.pwa_handovers h where h.team_id='${fixtureId(400)}'),
    'work_card',(select json_build_object('version',c.version,'state',c.status,'replies',(select count(*) from app.pwa_card_replies r where r.card_id=c.id),'checklist_completed',(select completed_at is not null from app.card_checklist_items where id='${fixtureId(1205)}')) from app.kanban_cards c where c.id='${fixtureId(1203)}'),
    'assigned_team_place',(select json_build_object('state',a.state,'version',a.version,'bookings',(select count(*) from app.bookings b where b.position_id=a.position_id and b.state='booked'),'team_execution_entries',(select count(*) from app.pwa_team_execution_entries e join app.bookings b on b.id=e.booking_id where b.position_id=a.position_id)) from app.pwa_allocations a where a.id='${fixtureId(1601)}'),
    'question_state',(select state from app.pwa_questions where id='${fixtureId(1800)}')
  );`));
}
function observeBrowserContext(context) {
  context.on('page', (page) => {
    page.on('pageerror', () => consoleFailures.push('uncaught page error'));
    page.on('console', (message) => {if (/hydration|hydrated|didn't match|maximum update depth/i.test(message.text())) consoleFailures.push('hydration/render error');});
  });
}
async function login(email) {
  authenticating=true;assert.ok(accounts.includes(email));
  const cooldown=Number(sql(`select ceil(greatest(0,61-extract(epoch from statement_timestamp()-greatest(confirmation_sent_at,recovery_sent_at))))::int from auth.users where email='${email}';`));
  if(cooldown>0)await new Promise((resolve)=>setTimeout(resolve,Math.min(cooldown,61)*1000));
  const context = await browser.newContext(options); contexts.push(context);
  observeBrowserContext(context);
  const page = await context.newPage(); lastPage=page; pageActors.set(page,email);
  page.on('dialog', async (dialog) => {if (dialog.type() === 'beforeunload') await dialog.accept(); else await dialog.dismiss();});
  const previous = new Set((await fetch(mail+'/api/v1/messages').then((response)=>response.json())).messages.map(({ID})=>ID));
  await page.goto(base+'/app/login');
  await page.getByLabel('Persoonlijk e-mailadres').fill(email);
  await page.getByRole('button',{name:'Stuur mijn inlogcode'}).click();
  await page.waitForURL('**/app/auth/verify?sent=1');
  let token;
  for(let attempt=0;attempt<80&&!token;attempt++) {
    const messages = await fetch(mail+'/api/v1/messages').then((response)=>response.json());
    const message = messages.messages.find((item)=>!previous.has(item.ID)&&item.To?.some((recipient)=>recipient.Address===email));
    if(message) {
      const content = await fetch(mail+'/api/v1/message/'+message.ID).then((response)=>response.json());
      token = (content.Text??content.HTML??'').match(/\b\d{6,10}\b/)?.[0];
    }
    if(!token) await new Promise((resolve)=>setTimeout(resolve,250));
  }
  assert.ok(token,'Actual OTP arrives in local capture.');
  await page.getByLabel('Eenmalige code').fill(token);
  await page.getByRole('button',{name:'Veilig inloggen'}).click();
  await page.waitForURL('**/app/workspaces');authenticating=false;
  return {page,context};
}
async function appPage(page,route,club='club-a') {
  const priorStage=stage; stage=`render:${club}:${route}`; lastPage=page;
  const target = new URL(`/app/c/${club}/${route}`,base);
  if(club==='club-a'&&[accounts[0],accounts[1]].includes(pageActors.get(page)))target.searchParams.set('household',fixtureId(100));
  const response=await page.goto(target.href);
  assert.ok(response&&response.status()<500,'No server rendering failure.');
  await page.locator('.cluvo-mobile main#main-content').waitFor();
  await page.locator('main h1').first().waitFor();
  await page.evaluate(()=>document.fonts.ready); stage=priorStage;
}
async function layoutCheck(page,route,width,enlarged=false,rows=matrix) {
  const priorStage=stage; stage=`layout:${route}:${width}:${enlarged?'text200':'normal'}`;
  await page.setViewportSize({width,height:width===1440?1024:844});
  await page.evaluate((large)=>{const elements=[...document.querySelectorAll('.cluvo-mobile *')].map((element)=>({element,size:parseFloat(getComputedStyle(element).fontSize)}));for(const {element,size} of elements) {if(large) {const property=element.matches('.avatar[aria-hidden="true"]')?'--avatar-font-size':'font-size'; element.dataset.pwaFontProperty=property;element.dataset.pwaOriginalFont=element.style.getPropertyValue(property);element.dataset.pwaOriginalFontPriority=element.style.getPropertyPriority(property);element.style.setProperty(property,`${size*2}px`,'important');} else if(element.dataset.pwaOriginalFont!==undefined) {element.style.setProperty(element.dataset.pwaFontProperty??'font-size',element.dataset.pwaOriginalFont,element.dataset.pwaOriginalFontPriority);delete element.dataset.pwaFontProperty;delete element.dataset.pwaOriginalFont;delete element.dataset.pwaOriginalFontPriority;}}window.scrollTo(0,0);},enlarged);
  await page.waitForTimeout(80);
  if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)) {const boxes=await page.evaluate(()=>[...document.querySelectorAll('.cluvo-mobile *')].filter((element)=>element.getBoundingClientRect().right>innerWidth+1).map((element)=>({tag:element.tagName,class:element.className,left:Math.round(element.getBoundingClientRect().left),right:Math.round(element.getBoundingClientRect().right),width:Math.round(element.getBoundingClientRect().width),font:parseFloat(getComputedStyle(element).fontSize)})).slice(0,30));await writeFile(output+'/overflow-'+route+'-'+width+'.json',JSON.stringify(boxes,null,2)+'\n');await page.screenshot({path:output+'/overflow-'+route+'-'+width+'.png',fullPage:true});}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route}: no horizontal page overflow at ${width}${enlarged?' enlarged':''}`);
  const avatarsFit=await page.evaluate(()=>[...document.querySelectorAll('.cluvo-mobile .avatar')].every((element)=>{
    const box=element.getBoundingClientRect();if(!box.width||!box.height)return true;
    const range=document.createRange();range.selectNodeContents(element);const text=range.getBoundingClientRect();
    return element.getAttribute('aria-hidden')==='true'&&getComputedStyle(element).whiteSpace==='nowrap'&&range.getClientRects().length===1&&text.left>=box.left-1&&text.right<=box.right+1&&text.top>=box.top-1&&text.bottom<=box.bottom+1;
  }));
  assert.ok(avatarsFit,`${route}: decorative avatar initials stay on one line inside their circles at ${width}${enlarged?' enlarged':''}`);
  const nav=page.locator(width>800?'.desktop-rail nav':'.bottom-nav');
  assert.equal(await nav.getByRole('link').count(),5);
  assert.equal(await nav.locator('[aria-current="page"]').count(),1);
  assert.equal(await page.locator('.app-header select').count(),0,'Club selection stays on Meer.');
  assert.equal(await page.locator('#mobile-club-choice').count(),route==='more'?1:0);
  if(width<=430) {
    for(const link of await nav.getByRole('link').all()) {const box=await link.boundingBox();assert.ok(box&&box.height>=44&&box.width>=44,'Bottom navigation touch targets are at least 44px.');}
    const safe=await nav.evaluate((element)=>({bottom:getComputedStyle(element).bottom,padding:getComputedStyle(element).paddingBottom}));
    assert.equal(safe.bottom,'0px');assert.ok(parseFloat(safe.padding)>=4);
  }
  const actor = pageActors.get(page)?.split('@')[0] ?? 'second-device';
  const screenshotPath=`${output}/screenshots/${actor}-${route}-${width}${enlarged?'-text200':''}.png`;
  const screenshotBytes=await page.screenshot({path:screenshotPath,fullPage:true});
  rows.push({actor,route,width,text200:enlarged,decorative_avatar_fits:true,no_overflow:true,nav:true,club_scope:true,screenshot:{path:screenshotPath,sha256:createHash('sha256').update(screenshotBytes).digest('hex')}}); stage=priorStage;
}
async function eventually(query, expected) {for(let attempt=0;attempt<100;attempt++){const actual=sql(query);if(actual===expected)return;await new Promise((resolve)=>setTimeout(resolve,100));}assert.fail('Confirmed browser action has authoritative SQL readback.');}
async function nativeTask(page,id,extra={}) {const query=new URLSearchParams({task:fixtureId(id),...extra});await appPage(page,`tasks?${query}`);await page.getByRole('dialog').waitFor();}
async function registerNativeDocument(context) {
  const runtime=await fetch(base+'/api/runtime-config').then((response)=>response.json());
  const cookies=await context.cookies(base);
  const pieces=cookies.filter(({name})=>/^sb-.+-auth-token(?:\.\d+)?$/.test(name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  const serialized=decodeURIComponent(pieces.map(({value})=>value).join(''));
  const session=JSON.parse(serialized.startsWith('base64-')?Buffer.from(serialized.slice(7),'base64url').toString('utf8'):serialized);
  const token=Array.isArray(session)?session[0]:session.access_token;
  assert.ok(typeof token==='string'&&token.split('.').length===3,'Native coordinator session exists only in memory.');
  const headers={apikey:runtime.publishableKey,Authorization:`Bearer ${token}`};
  const metadataResponse=await fetch(runtime.url+'/rest/v1/rpc/pwa_document',{method:'POST',headers:{...headers,'Content-Type':'application/json','Content-Profile':'api'},body:JSON.stringify({p_tenant_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_document_id:fixtureId(1300),p_revision:null})});
  assert.ok(metadataResponse.ok,'Coordinator can read authorized canonical document metadata.');
  const metadata=await metadataResponse.json();assert.equal(metadata.bucket,'cluvo-private');assert.ok([1,2].includes(metadata.revision));assert.equal(metadata.object_path,`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/committee/cb000000-0000-4000-8000-000000000300/pwa-local-proof${metadata.revision===2?'-v2':''}.txt`);assert.equal(metadata.sha256,'65e06d10678b708d6a85b83281344f275f75853796c66a6214ce8d53d1c4e04b');
  const bytes='Cluvo PWA lokale werkinstructie.';assert.equal(Buffer.byteLength(bytes),32);assert.equal(metadata.size_bytes,32);
  const upload=await fetch(`${runtime.url}/storage/v1/object/${metadata.bucket}/${metadata.object_path}`,{method:'POST',headers:{...headers,'Content-Type':'text/plain','x-upsert':'true'},body:bytes});
  assert.ok(upload.ok,`Ordinary native coordinator document upload is allowed (status ${upload.status}).`);
  const download=await context.request.get(`${base}/app/c/club-a/documents/${fixtureId(1300)}?revision=${metadata.revision}`);
  assert.equal(download.status(),200);assert.equal(await download.text(),bytes);const cacheControl=download.headers()['cache-control'].split(',').map((directive)=>directive.trim());assert.ok(cacheControl.includes('private')&&cacheControl.includes('no-store'),'Private document bytes must not enter browser or shared cache.');
  checks.push('NATIVE_REGISTERED_PRIVATE_DOCUMENT_UPLOAD_ACL_HASH_BYTES_DOWNLOAD');
}
async function wizardSummary(page,boundary) {
  await page.getByRole('button',{name:'Beschikbaar',exact:true}).click();
  await page.getByLabel('Praktische grenzen (optioneel)').fill(boundary);
  await page.getByRole('button',{name:'Controleren',exact:true}).click();
  await page.getByRole('heading',{name:'Dit heb je aangegeven'}).waitFor();
}
try {
  nativeSchemaAtStart=JSON.parse(sql("select json_build_object('migration_count',count(*),'versions',json_agg(version order by version)) from supabase_migrations.schema_migrations;"));
  assert.equal(nativeSchemaAtStart.migration_count,migrationFiles.length,'The actual preserved native schema matches the tested migration source count.');
  assert.deepEqual(nativeSchemaAtStart.versions,migrationFiles.map((file)=>file.split('_')[0]),'Every source migration is actually recorded in native schema history.');
  nativeDomainAtStart=nativeDomainReadback();
  const runtime=await fetch(base+'/api/runtime-config').then((response)=>response.json());
  const backend=new URL(runtime.url);assert.equal(backend.hostname,'127.0.0.1');assert.equal(backend.port,'55321');
  assert.equal(sql("select count(*) from auth.users where email in ('ouder-a@example.test','ouder-b@example.test','coordinator@example.test','tenant-b@example.test');"),'4');
  assert.equal(sql("select count(*) from information_schema.routines where routine_schema='api' and routine_name='pwa_snapshot';"),'1');
  assert.equal(sql("select count(*) from app.households where id='cb000000-0000-4000-8000-000000000100' and label='PWA lokaal testhuishouden';"),'1','The additive native browser fixture is present.');
  await mkdir(output+'/screenshots',{recursive:true});
  browser=await chromium.launch({headless:true});
  setStage('actual-mobile-otp');const {page:a,context:accountA}=await login(accounts[0]);checks.push('ACTUAL_MOBILE_OTP');
  if(process.env.PWA_BROWSER_FOCUS==='extended') {
    setStage('independent-native-extended-phase');const {page:c}=await login(accounts[2]);
    const before=profileReadback();
    const {runExtendedMobileFlows,runMobileReadFlows}=await import('./pwa-mobile-extended-flows.mjs');
    await runMobileReadFlows({a,c,sql,appPage,eventually,fixtureId,checks,setStage});
    await runExtendedMobileFlows({a,c,sql,appPage,eventually,fixtureId,checks,setStage});
    assert.deepEqual(consoleFailures,[]);checks.push('NO_HYDRATION_OR_UNCAUGHT_RENDER_ERRORS');
    await writeFile(output+'/browser-results.json',JSON.stringify({environment:'local',...metadata(),actual_otp:true,synthetic_accounts:true,checks,matrix,tabletMatrix,passed:true,whole_suite_passed:false,phase_scope:'Independent actual native read controls and extended team/club/policy/handover/attendance transitions. No main viewport, card, messages, full auth or cross-tenant scope claimed.',readback:{before,after:profileReadback()},nativeDomainReadback:{before:nativeDomainAtStart,after:nativeDomainReadback()},staging_verified:false},null,2)+'\n');
    console.log(JSON.stringify({result:'INDEPENDENT_NATIVE_PHASE_PASS',checks:checks.length,whole_suite_passed:false,environment:'local',staging_verified:false}));
  } else {
  setStage('filters-sheet-keyboard-back');await appPage(a,'tasks');
  const trigger=a.getByRole('button',{name:'Taken filteren'});await trigger.focus();await a.keyboard.press('Enter');
  await a.getByRole('dialog').waitFor();assert.ok(await a.locator('.app-sheet').evaluate((element)=>element.scrollHeight>=element.clientHeight));
  await a.keyboard.press('Escape');await a.getByRole('dialog').waitFor({state:'hidden'});await a.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Taken filteren',undefined,{timeout:5000});
  await trigger.focus();await trigger.click();await a.getByRole('dialog').waitFor();await a.goBack();await a.getByRole('dialog').waitFor({state:'hidden'});await a.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Taken filteren',undefined,{timeout:5000});
  assert.ok(await a.getByRole('button',{name:'Taken filteren'}).isVisible());checks.push('BOTTOM_SHEET_ENTER_ESCAPE_NATIVE_BACK_PRESERVES_OVERVIEW');
  setStage('twenty-screen-width-matrix');
  for(const route of focused?['profile']:routes) {
    await appPage(a,route);
    for(const width of widths) await layoutCheck(a,route,width);
    await layoutCheck(a,route,390,true);
    console.log(JSON.stringify({phase:'viewport_matrix',route,completed:matrix.length}));
    await a.evaluate(()=>{for(const element of document.querySelectorAll('[data-pwa-original-font]')){element.style.setProperty(element.dataset.pwaFontProperty??'font-size',element.dataset.pwaOriginalFont,element.dataset.pwaOriginalFontPriority);delete element.dataset.pwaFontProperty;delete element.dataset.pwaOriginalFont;delete element.dataset.pwaOriginalFontPriority;}});
  }
  checks.push(focused?'FOCUSED_PROFILE_VIEWPORT_MATRIX':'TWENTY_ROUTES_320_390_430_DESKTOP_AND_200_PERCENT_TEXT');
  checks.push('DECORATIVE_AVATARS_SINGLE_LINE_WITHIN_CIRCLES_AT_TEXT200_USER_COPY_DOUBLED');
  setStage('permission-scoped-more');await appPage(a,'more');
  assert.equal(await a.locator('.more-menu').getByRole('link',{name:/Vrijwilligerspot/}).count(),0);
  assert.equal(await a.locator('.more-menu').getByRole('link',{name:/Commissieoverzicht/}).count(),0);
  await appPage(a,'finance');await a.getByRole('heading',{name:'Geen toegang tot dit overzicht'}).waitFor();
  assert.equal(await a.locator('.money-card').count(),0);checks.push('UNAUTHORIZED_SCREEN_HAS_REASON_WITHOUT_FALSE_ZERO_BALANCE');
  setStage('real-task-sheet');await appPage(a,'tasks');
  const tasks=a.locator('button.task-card');
  if(await tasks.count()) {
    const title=await tasks.first().locator('h3').textContent();await tasks.first().click();await a.getByRole('dialog').waitFor();
    assert.ok((await a.getByRole('dialog').textContent()).includes(title));
    const box=await a.locator('.app-sheet').boundingBox();assert.ok(box&&box.width<=390&&box.height<=844);
    await a.keyboard.press('Escape');await a.getByRole('dialog').waitFor({state:'hidden'});checks.push('REAL_TASK_AGREEMENT_SHEET');
  } else checks.push('REAL_TASK_COLLECTION_EMPTY_READMODEL_NO_FAKE_FIXTURE');
  setStage('offline-preserved-form');await appPage(a,'profile');
  await wizardSummary(a,'PWA_LOCAL_OFFLINE_DRAFT');await accountA.setOffline(true);
  await a.getByRole('button',{name:'Profiel opslaan',exact:true}).click();
  await a.getByRole('alert').filter({hasText:'Je bent offline'}).waitFor();
  assert.ok((await a.locator('.form-card').textContent()).includes('PWA_LOCAL_OFFLINE_DRAFT'));
  await accountA.setOffline(false);checks.push('OFFLINE_DOES_NOT_SUBMIT_OR_LOSE_DRAFT');
  setStage('dirty-wizard-internal-navigation');
  await a.locator('.bottom-nav').getByRole('link',{name:'Home',exact:true}).focus();await a.keyboard.press('Enter');
  assert.ok(new URL(a.url()).pathname.endsWith('/profile'));assert.ok((await a.locator('.form-card').textContent()).includes('PWA_LOCAL_OFFLINE_DRAFT'));checks.push('DIRTY_WIZARD_INTERNAL_NAVIGATION_WARNING_PRESERVES_DRAFT');
  setStage('committed-response-lost');
  const before=profileReadback();
  await wizardSummary(a,'PWA_LOCAL_LOST_RESPONSE');
  let posts=0,committed=false;lostResponseProof={posts:0,committed:false};
  await a.route('**/app/c/club-a/profile**',async(route)=>{
    if(route.request().method()!=='POST')return route.continue();
    posts++;lostResponseProof.posts=posts;
    if(posts===1)return route.continue();
    if(posts===2){try {const response=await route.fetch();lostResponseProof.responseStatus=response.status();assert.ok(response.ok());committed=true;lostResponseProof.committed=true;return route.abort('failed');} catch(error) {lostResponseProof.fetchError=error?.name;throw error;}}
    return route.continue();
  });
  await a.getByRole('button',{name:'Profiel opslaan',exact:true}).click();
  await a.locator('.notice[role=status]').filter({hasText:'De uitkomst is nog niet bekend.'}).waitFor();
  assert.ok(committed);assert.equal(await a.getByRole('button',{name:'Profiel opslaan',exact:true}).isDisabled(),true);
  const after=profileReadback();assert.equal(after.version,before.version+1);assert.equal(after.revision,before.revision+1);assert.equal(after.answers,before.answers+1);assert.equal(after.ledger,before.ledger);assert.equal(after.target,before.target);
  await a.unroute('**/app/c/club-a/profile**');
  await a.getByRole('button',{name:'Controleer status',exact:true}).click();
  await a.locator('.notice[role=status]').filter({hasText:'De oorspronkelijke handeling is bevestigd.'}).waitFor();
  assert.deepEqual(profileReadback(),after);Object.assign(lostResponseProof,{statusConfirmed:true,versionDelta:after.version-before.version,revisionDelta:after.revision-before.revision,answerVersionDelta:after.answers-before.answers,ledgerUnchanged:after.ledger===before.ledger,householdTargetUnchanged:after.target===before.target});checks.push('PREPARE_ROUNDTRIP_LOST_COMMIT_RESPONSE_STATUS_READBACK_ONE_REVISION');
  setStage('second-device-and-separated-parent');
  const second=await browser.newContext({...options,storageState:await accountA.storageState(),viewport:{width:430,height:932},isMobile:true,hasTouch:true});contexts.push(second);observeBrowserContext(second);
  const touch=await second.newPage();pageActors.set(touch,accounts[0]);await appPage(touch,'profile');await touch.getByRole('button',{name:'Beschikbaar',exact:true}).tap();
  assert.equal(await touch.getByLabel('Praktische grenzen (optioneel)').inputValue(),'PWA_LOCAL_LOST_RESPONSE');
  const {page:b}=await login(accounts[1]);await appPage(b,'profile');assert.ok(!(await b.content()).includes('PWA_LOCAL_LOST_RESPONSE'));
  checks.push('SECOND_DEVICE_SERVER_READ_SEPARATED_PARENT_PRIVATE_INTAKE');
  setStage('native-stale-profile-keeps-input-and-explicit-refresh');
  await appPage(a,'profile');await appPage(touch,'profile');const conflictBefore=profileReadback();
  await wizardSummary(a,'PWA_LOCAL_CONFLICT_WINNER');await wizardSummary(touch,'PWA_LOCAL_CONFLICT_KEEP');
  await a.getByRole('button',{name:'Profiel opslaan',exact:true}).click();
  await a.locator('.notice[role=status]').filter({hasText:'Opgeslagen en bevestigd door je vereniging.'}).waitFor();
  await touch.getByRole('button',{name:'Profiel opslaan',exact:true}).click();
  await touch.locator('.notice[role=alert]').filter({hasText:'intussen'}).waitFor();
  assert.equal(profileReadback().version,conflictBefore.version+1);assert.ok((await touch.locator('.form-card').textContent()).includes('PWA_LOCAL_CONFLICT_KEEP'));
  const refreshed=touch.waitForResponse((response)=>new URL(response.url()).pathname.endsWith('/profile')&&response.request().method()==='GET'&&response.headers()['content-type']?.includes('text/x-component'));
  await touch.getByRole('button',{name:'Actuele gegevens ophalen',exact:true}).click();await refreshed;await touch.waitForTimeout(100);
  assert.ok((await touch.locator('.form-card').textContent()).includes('PWA_LOCAL_CONFLICT_KEEP'));
  await touch.getByRole('button',{name:'Profiel opslaan',exact:true}).click();await touch.locator('.notice[role=status]').filter({hasText:'Opgeslagen en bevestigd door je vereniging.'}).waitFor();
  assert.equal(profileReadback().version,conflictBefore.version+2);assert.equal(profileReadback().ledger,conflictBefore.ledger);assert.equal(profileReadback().target,conflictBefore.target);
  checks.push('NATIVE_STALE_EXPECTED_VERSION_REJECTS_WRITE_KEEPS_DRAFT_EXPLICIT_REFRESH_ACCEPTS_ONE_NEW_REVISION');
  setStage('native-help-seen-cross-device-and-own-reset');
  const profileHelp=(page)=>page.locator('.cluvo-help-banner[data-help-id="pwa.profile.v1"]');
  const helpRows=(person)=>`select count(*) from app.pwa_help_preferences where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and person_id='a1000000-0000-4000-8000-00000000000${person}' and topic='pwa.profile';`;
  const resetOwnHelp=async(page)=>{await appPage(page,'settings');await page.getByLabel('Toon mijn uitlegbanners opnieuw.').check();await page.getByRole('button',{name:'Uitleg opnieuw tonen',exact:true}).click();await page.locator('.notice[role=status]').filter({hasText:'Opgeslagen en bevestigd door je vereniging.'}).waitFor();await page.getByRole('button',{name:'Uitleg opnieuw tonen',exact:true}).waitFor();};
  await appPage(a,'profile');if(!await profileHelp(a).count()){await resetOwnHelp(a);await appPage(a,'profile');}
  await appPage(b,'profile');if(!await profileHelp(b).count()){await resetOwnHelp(b);await appPage(b,'profile');}
  lastPage=a;await a.getByRole('button',{name:'Beschikbaar',exact:true}).click();await a.getByLabel('Praktische grenzen (optioneel)').fill('PWA_LOCAL_HELP_DRAFT');const helpDraftBefore=profileReadback();
  await profileHelp(a).getByRole('button',{name:'Gezien: Vertel wat bij jou past',exact:true}).click();await profileHelp(a).waitFor({state:'hidden'});await eventually(helpRows(1),'1');
  assert.equal(await a.getByLabel('Praktische grenzen (optioneel)').inputValue(),'PWA_LOCAL_HELP_DRAFT');assert.deepEqual(profileReadback(),helpDraftBefore);checks.push('NATIVE_HELP_DISMISS_PRESERVES_DIRTY_PROFILE_STEP_AND_INPUT_WITHOUT_PROFILE_WRITE');
  await appPage(touch,'profile');assert.equal(await profileHelp(touch).count(),0);assert.equal(await profileHelp(b).count(),1);
  await profileHelp(b).getByRole('button',{name:'Uitleg sluiten: Vertel wat bij jou past',exact:true}).click();await profileHelp(b).waitFor({state:'hidden'});await eventually(helpRows(2),'1');
  await resetOwnHelp(a);await eventually(helpRows(1),'0');assert.equal(sql(helpRows(2)),'1');
  await appPage(a,'profile');assert.equal(await profileHelp(a).count(),1);await appPage(b,'profile');assert.equal(await profileHelp(b).count(),0);
  checks.push('NATIVE_VERSIONED_HELP_SEEN_CROSS_DEVICE_SEPARATED_PARENT_OWN_RESET');
  setStage('native-preferences-own-readback-restore');
  const preferencesReadback=(person)=>JSON.parse(sql(`select coalesce((select json_build_object('version',version,'email',email,'reminders',reminders,'team',team,'news',news,'push',push,'inbox',inbox) from app.pwa_preferences where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and person_id='a1000000-0000-4000-8000-00000000000${person}'),' {"version":0,"email":true,"reminders":true,"team":true,"news":true,"push":false,"inbox":true}'::json);`));
  const preferencesBefore=preferencesReadback(1),otherPreferencesBefore=preferencesReadback(2),preferenceLedger=profileReadback().ledger;
  const preferenceLabels={email:'E-mail van mijn vereniging',reminders:'Taakherinneringen',team:'Mijn teams',news:'Nieuwe passende taken'};
  await appPage(a,'settings');
  for(const [key,label] of Object.entries(preferenceLabels))await a.getByLabel(label,{exact:true}).setChecked(!preferencesBefore[key]);
  await a.getByRole('button',{name:'Meldingsvoorkeuren opslaan',exact:true}).click();await eventually(`select version from app.pwa_preferences where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and person_id='a1000000-0000-4000-8000-000000000001';`,String(preferencesBefore.version+1));
  const preferencesChanged=preferencesReadback(1);for(const key of Object.keys(preferenceLabels))assert.equal(preferencesChanged[key],!preferencesBefore[key]);assert.equal(preferencesChanged.push,preferencesBefore.push);assert.equal(preferencesChanged.inbox,preferencesBefore.inbox);assert.deepEqual(preferencesReadback(2),otherPreferencesBefore);
  await appPage(touch,'settings');for(const [key,label] of Object.entries(preferenceLabels))assert.equal(await touch.getByLabel(label,{exact:true}).isChecked(),!preferencesBefore[key]);
  await appPage(a,'settings');for(const [key,label] of Object.entries(preferenceLabels))await a.getByLabel(label,{exact:true}).setChecked(preferencesBefore[key]);
  await a.getByRole('button',{name:'Meldingsvoorkeuren opslaan',exact:true}).click();await eventually(`select version from app.pwa_preferences where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and person_id='a1000000-0000-4000-8000-000000000001';`,String(preferencesBefore.version+2));
  assert.deepEqual(preferencesReadback(1),{...preferencesBefore,version:preferencesBefore.version+2});assert.equal(profileReadback().ledger,preferenceLedger);checks.push('NATIVE_FOUR_NOTIFICATION_PREFERENCES_OWN_VERSION_CROSS_DEVICE_RESTORE_PUSH_INBOX_UNCHANGED');
  setStage('native-repeatable-own-inbox-read');
  const unread=(person)=>`select (select count(*) from app.pwa_notifications where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and recipient_person_id='a1000000-0000-4000-8000-00000000000${person}' and read_at is null)+(select count(*) from app.inbox_items where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and recipient_person_id='a1000000-0000-4000-8000-00000000000${person}' and read_at is null);`;
  const otherUnread=sql(unread(2));
  for(let repeat=0;repeat<2;repeat++){await appPage(a,'notifications');await a.getByRole('button',{name:'Alles gelezen',exact:true}).click();await a.locator('.notice[role=status]').filter({hasText:'Opgeslagen en bevestigd door je vereniging.'}).waitFor();await eventually(unread(1),'0');assert.equal(sql(unread(2)),otherUnread);}
  assert.equal(profileReadback().ledger,preferenceLedger);checks.push('NATIVE_TWO_FRESH_BULK_INBOX_READ_COMMANDS_OWN_SCOPE_OTHER_PARENT_UNCHANGED');
  setStage('native-course-and-vacancy');await appPage(a,'courses');
  const course=a.locator('.course-card').filter({hasText:'PWA cursus'});
  if(await course.getByRole('button',{name:'Afmelden',exact:true}).count()) {await course.getByRole('button',{name:'Afmelden',exact:true}).click();await course.getByRole('button',{name:'Ik doe mee',exact:true}).waitFor();}
  const qualificationsBefore=sql("select count(*) from app.person_qualifications where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';");
  await course.getByRole('button',{name:'Ik doe mee',exact:true}).click();
  await eventually(`select state from app.course_enrollments where session_id='${fixtureId(1001)}' and person_id='a1000000-0000-4000-8000-000000000001';`,'enrolled');
  await course.getByRole('button',{name:'Afmelden',exact:true}).click();
  await eventually(`select state from app.course_enrollments where session_id='${fixtureId(1001)}' and person_id='a1000000-0000-4000-8000-000000000001';`,'cancelled');await course.getByRole('button',{name:'Ik doe mee',exact:true}).waitFor();
  assert.equal(sql("select count(*) from app.person_qualifications where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"),qualificationsBefore);
  await appPage(a,'opportunities');await a.locator('.opportunity-card').filter({hasText:'PWA help de commissie'}).click();
  const interest=sql(`select count(*) from app.vacancy_interests where vacancy_id='${fixtureId(1502)}' and person_id='a1000000-0000-4000-8000-000000000001';`);
  if(interest==='0'&&process.env.PWA_DEBUG_SKIP_INTEREST!=='1') {await a.getByLabel('Wat spreekt je aan? (optioneel)').fill('PWA native browser motivatie');await a.getByRole('button',{name:'Ik heb interesse',exact:true}).click();await eventually(`select count(*) from app.vacancy_interests where vacancy_id='${fixtureId(1502)}' and person_id='a1000000-0000-4000-8000-000000000001';`,'1');}
  await appPage(a,'opportunities');if(process.env.PWA_DEBUG_SKIP_INTEREST!=='1') assert.ok((await a.locator('.opportunity-card').filter({hasText:'PWA help de commissie'}).textContent()).includes('Interesse vastgelegd'));
  checks.push(process.env.PWA_DEBUG_SKIP_INTEREST==='1'?'NATIVE_COURSE_ENROLL_WITHDRAW_WITHOUT_CERTIFICATE_DEBUG_INTEREST_BLOCKED':'NATIVE_COURSE_ENROLL_WITHDRAW_WITHOUT_CERTIFICATE_AND_VOLUNTARY_INTEREST_READBACK');
  setStage('native-booking-and-preparation');
  const already=sql(`select b.id from app.bookings b join app.shift_positions p on p.tenant_id=b.tenant_id and p.id=b.position_id where p.shift_id='${fixtureId(801)}' and b.executor_person_id='a1000000-0000-4000-8000-000000000001' and b.state='booked' limit 1;`);
  if(!already) {
    const ledger=profileReadback().ledger;await nativeTask(a,801);await a.getByRole('button',{name:'Ik help mee',exact:true}).click();
    await a.getByLabel('Ik heb de instructies gelezen.').check();await a.getByLabel('Ik ga akkoord met de afmeldafspraak.').check();await a.getByRole('button',{name:'Inschrijving bevestigen',exact:true}).click();
    await eventually(`select count(*) from app.bookings b join app.shift_positions p on p.tenant_id=b.tenant_id and p.id=b.position_id where p.shift_id='${fixtureId(801)}' and b.executor_person_id='a1000000-0000-4000-8000-000000000001' and b.state='booked';`,'1');assert.equal(profileReadback().ledger,ledger);await a.getByRole('dialog').waitFor({state:'hidden'});
  }
  await nativeTask(a,803,{booking:fixtureId(903)});await a.getByRole('button',{name:'Taak voorbereiden',exact:true}).click();await a.getByLabel('Ik heb de voorbereiding gecontroleerd.').check();await a.getByRole('button',{name:'Ik ben voorbereid',exact:true}).click();
  await eventually(`select (prepared_at is not null)::text from app.pwa_booking_details where booking_id='${fixtureId(903)}';`,'true');await a.getByRole('dialog').waitFor({state:'hidden'});checks.push('NATIVE_BOOKING_AND_PREPARATION_PRESERVE_LEDGER_UNTIL_ATTENDANCE');
  setStage('native-assigned-team-place-executor-choice');
  const teamPlaceLedger=profileReadback().ledger;
  if(sql(`select count(*) from app.bookings where position_id='${fixtureId(832)}' and state='booked';`)==='0') {
    await nativeTask(a,802,{allocation:fixtureId(1601)});
    await a.getByRole('button',{name:'Kies de uitvoerder',exact:true}).click();
    await a.getByLabel('Uit jouw huishouden').selectOption('a1000000-0000-4000-8000-000000000001');
    await a.getByLabel('Ik heb de instructies gelezen.').check();
    await a.getByLabel('Ik ga akkoord met de afmeldafspraak.').check();
    await a.getByRole('button',{name:'Inschrijving bevestigen',exact:true}).click();
    await eventually(`select count(*) from app.bookings where position_id='${fixtureId(832)}' and executor_person_id='a1000000-0000-4000-8000-000000000001' and state='booked';`,'1');
    await a.getByRole('dialog').waitFor({state:'hidden'});
  }
  assert.equal(sql(`select count(*) from app.pwa_booking_details d join app.bookings b on b.id=d.booking_id where d.allocation_id='${fixtureId(1601)}' and d.member_person_id='${fixtureId(200)}' and b.state='booked';`),'1');
  assert.equal(sql(`select state from app.pwa_allocations where id='${fixtureId(1601)}';`),'booked');
  assert.equal(sql(`select count(*) from app.pwa_team_execution_entries where booking_id in(select id from app.bookings where position_id='${fixtureId(832)}');`),'0');
  assert.equal(profileReadback().ledger,teamPlaceLedger);
  checks.push('NATIVE_ASSIGNED_TEAM_PLACE_REAL_HOUSEHOLD_EXECUTOR_ACKS_BOOKING_NO_LEDGER_OR_TEAM_COMPLETION');
  setStage('native-household-question');await appPage(a,'household');
  const questionsBefore=Number(sql(`select count(*) from app.pwa_questions where household_id='${fixtureId(100)}' and person_id='a1000000-0000-4000-8000-000000000001';`));
  await a.getByRole('button',{name:'Een vraag of persoonlijke afspraak',exact:true}).click();await a.getByLabel('Wat wil je bespreken?').fill('PWA native browser praktische vraag');await a.getByRole('button',{name:'Vraag indienen',exact:true}).click();
  await eventually(`select count(*) from app.pwa_questions where household_id='${fixtureId(100)}' and person_id='a1000000-0000-4000-8000-000000000001';`,String(questionsBefore+1));
  await a.getByRole('dialog').waitFor({state:'hidden'});
  await appPage(a,'household');assert.ok((await a.locator('main').textContent()).includes('PWA native browser praktische vraag'));checks.push('NATIVE_HOUSEHOLD_QUESTION_CONFIRMED_READBACK');
  setStage('cross-tenant-pages');const {page:tenantB}=await login(accounts[3]);
  const denied=await tenantB.goto(base+'/app/c/club-a/home');assert.ok(denied.status()===404||!new URL(tenantB.url()).pathname.includes('/club-a/'));assert.equal(await tenantB.locator('.household-meter').count(),0);
  await appPage(tenantB,'home','club-b');assert.ok(!(await tenantB.content()).includes('PWA_LOCAL_LOST_RESPONSE'));checks.push('CROSS_TENANT_READ_DENIED');
  setStage('coordinator-direct-routes');const {page:c,context:coordinatorContext}=await login(accounts[2]);
  setStage('native-private-document-storage');await registerNativeDocument(coordinatorContext);
  setStage('native-team-manager-per-position-performer-status');
  const currentTeamManager=sql(`select count(*) from app.pwa_handovers where team_id='${fixtureId(400)}' and state='accepted' and successor_person_id='a1000000-0000-4000-8000-000000000001';`)==='0'?c:a;
  await appPage(currentTeamManager,`teams?team=${fixtureId(400)}&tab=organize`);
  const occupiedTeamPlace=currentTeamManager.locator('.allocation-list>div').filter({hasText:'PWA teamplaats'});
  assert.equal(await occupiedTeamPlace.count(),1);assert.ok((await occupiedTeamPlace.textContent()).includes('Uitvoerder: Ouder A · Ingepland'));
  checks.push('NATIVE_TEAM_MANAGER_PER_POSITION_ACTUAL_EXECUTOR_AND_BOOKING_STATE');
  for(const route of ['home','manage','committees','messages','reports','finance']) {await appPage(c,route);for(const width of widths) await layoutCheck(c,route,width);await layoutCheck(c,route,390,true);await c.evaluate(()=>{for(const element of document.querySelectorAll('[data-pwa-original-font]')){element.style.setProperty(element.dataset.pwaFontProperty??'font-size',element.dataset.pwaOriginalFont,element.dataset.pwaOriginalFontPriority);delete element.dataset.pwaFontProperty;delete element.dataset.pwaOriginalFont;delete element.dataset.pwaOriginalFontPriority;}});}
  checks.push('ACTUAL_COORDINATOR_SCOPED_ROUTES_320_390_430_DESKTOP_200_PERCENT_TEXT');
  setStage('actual-tablet-width-768-all-screens');
  for(const route of routes){await appPage(a,route);await layoutCheck(a,route,768,false,tabletMatrix);}
  for(const route of ['home','manage','committees','messages','reports','finance']){await appPage(c,route);await layoutCheck(c,route,768,false,tabletMatrix);}
  checks.push('TWENTY_ROUTES_AND_SIX_COORDINATOR_ROUTES_ACTUAL_TABLET_768');
  await a.setViewportSize(options.viewport);await c.setViewportSize(options.viewport);
  setStage('native-message-cursor-and-live-draft');await appPage(c,'messages');await c.getByRole('button',{name:'PWA commissiegesprek',exact:true}).click();
  await c.getByRole('button',{name:'Eerdere berichten laden',exact:true}).waitFor();await c.getByRole('button',{name:'Eerdere berichten laden',exact:true}).click();
  assert.ok((await c.locator('.chat-messages').textContent()).includes('PWA lokaal bericht 1'));
  await c.getByLabel('Bericht schrijven').fill('PWA draft remains during live poll');await c.waitForTimeout(5200);assert.equal(await c.getByLabel('Bericht schrijven').inputValue(),'PWA draft remains during live poll');
  const sentBefore=Number(sql(`select count(*) from app.pwa_messages where channel_id='${fixtureId(1100)}' and body='PWA native browser authored message';`));
  await c.getByLabel('Bericht schrijven').fill('PWA native browser authored message');await c.getByRole('button',{name:'Bericht plaatsen',exact:true}).click();
  await eventually(`select count(*) from app.pwa_messages where channel_id='${fixtureId(1100)}' and body='PWA native browser authored message';`,String(sentBefore+1));
  await c.getByText('PWA native browser authored message',{exact:true}).first().waitFor();checks.push('NATIVE_MESSAGE_OLDER_CURSOR_AUTHORED_SEND_AND_LIVE_DRAFT_RETENTION');
  setStage('native-work-card-check-reply-completion');await appPage(c,'committees');
  await c.getByLabel('Commissie').selectOption(fixtureId(300));
  await c.locator('button.work-card').filter({hasText:'PWA concrete werkafspraak'}).click();await c.getByRole('dialog').waitFor();
  const cardLedger=profileReadback().ledger;
  if(sql(`select (completed_at is not null)::text from app.card_checklist_items where id='${fixtureId(1205)}';`)==='false') {await c.getByRole('button',{name:'Controle afvinken',exact:true}).click();await eventually(`select (completed_at is not null)::text from app.card_checklist_items where id='${fixtureId(1205)}';`,'true');}
  const repliesBefore=Number(sql(`select count(*) from app.pwa_card_replies where card_id='${fixtureId(1203)}';`));
  await c.getByLabel('Reactie').fill('PWA native browser werkafspraak reactie');await c.getByRole('button',{name:'Plaats reactie',exact:true}).click();await eventually(`select count(*) from app.pwa_card_replies where card_id='${fixtureId(1203)}';`,String(repliesBefore+1));
  await c.getByLabel('Kolom').selectOption(fixtureId(1202));await c.getByLabel('Status').selectOption('completed');
  if(sql(`select status from app.kanban_cards where id='${fixtureId(1203)}';`)!=='completed') {await c.getByRole('button',{name:'Werkafspraak bijwerken',exact:true}).click();await eventually(`select status from app.kanban_cards where id='${fixtureId(1203)}';`,'completed');}
  assert.equal(profileReadback().ledger,cardLedger);checks.push('NATIVE_WORK_CARD_CHECKLIST_REPLY_COMPLETION_WITHOUT_ATTENDANCE_LEDGER');
  setStage('native-question-review-answer-history');await appPage(c,'manage');await c.getByRole('button',{name:'Aanvragen',exact:true}).click();
  const question=c.locator('article.simple-card').filter({has:c.getByRole('heading',{name:'PWA praktische vraag',exact:true})});
  if(sql(`select state from app.pwa_questions where id='${fixtureId(1800)}';`)==='open') {await question.getByRole('button',{name:'Ik pak deze vraag op',exact:true}).click();await eventually(`select state from app.pwa_questions where id='${fixtureId(1800)}';`,'in_progress');}
  if(sql(`select state from app.pwa_questions where id='${fixtureId(1800)}';`)==='in_progress') {await question.getByLabel('Terugkoppeling').fill('Meld je bij de PWA lokale commissie.');await question.getByRole('button',{name:'Vraag beantwoorden',exact:true}).click();await eventually(`select state from app.pwa_questions where id='${fixtureId(1800)}';`,'answered');}
  await appPage(a,'household');const answered=a.locator('article.simple-card').filter({has:a.getByRole('heading',{name:'PWA praktische vraag',exact:true})});
  assert.ok((await answered.textContent()).includes('Meld je bij de PWA lokale commissie.'));assert.ok((await answered.locator('.question-history').textContent()).includes('In behandeling genomen'));checks.push('NATIVE_QUESTION_TAKE_ANSWER_OWN_HOUSEHOLD_IMMUTABLE_HISTORY');
  setStage('native-question-notification-exact-deep-link-and-other-parent-denial');
  await appPage(a,'notifications');await a.getByRole('button',{name:'Alles',exact:true}).click();
  const answerNotification=a.locator('.notification-list article').filter({has:a.getByText('Antwoord op je vraag',{exact:true})});
  assert.equal(await answerNotification.count(),1);
  if(await answerNotification.locator('button.notification-open').count())await answerNotification.locator('button.notification-open').click();else await answerNotification.getByRole('link').click();
  await a.waitForURL((url)=>url.pathname.endsWith('/actions')&&url.searchParams.get('question')===fixtureId(1800));
  const questionSheet=a.getByRole('dialog');await questionSheet.waitFor();
  assert.ok((await questionSheet.textContent()).includes('Meld je bij de PWA lokale commissie.'));
  assert.ok((await questionSheet.locator('.question-history').textContent()).includes('In behandeling genomen'));
  await questionSheet.getByRole('link',{name:'Bekijk mijn huishoudvraag',exact:true}).click();
  await a.waitForURL((url)=>url.pathname.endsWith('/household')&&url.searchParams.get('household')===fixtureId(100));
  await appPage(b,`actions?question=${fixtureId(1800)}`);await b.getByRole('dialog').waitFor();
  await b.getByRole('dialog').getByRole('heading',{name:'Deze vraag is niet beschikbaar',exact:true}).waitFor();
  assert.ok(!(await b.getByRole('dialog').textContent()).includes('Meld je bij de PWA lokale commissie.'));
  await appPage(a,`actions?question=${fixtureId(100)}`);await a.getByRole('dialog').waitFor();
  await a.getByRole('dialog').getByRole('heading',{name:'Deze vraag is niet beschikbaar',exact:true}).waitFor();
  assert.ok(!(await a.getByRole('dialog').textContent()).includes('Meld je bij de PWA lokale commissie.'));
  checks.push('NATIVE_ANSWER_INBOX_EXACT_QUESTION_BODY_HISTORY_OWN_DOSSIER_LINK_OTHER_PARENT_UNKNOWN_ID_DENIED');
  if(process.env.PWA_EXTENDED_FLOWS==='1') {const {runExtendedMobileFlows,runMobileReadFlows}=await import('./pwa-mobile-extended-flows.mjs');await runMobileReadFlows({a,c,sql,appPage,eventually,fixtureId,checks,setStage});await runExtendedMobileFlows({a,c,sql,appPage,eventually,fixtureId,checks,setStage});}
  setStage('native-other-parent-handover-deep-link-denied');
  const acceptedHandover=sql(`select id from app.pwa_handovers where team_id='${fixtureId(400)}' and state='accepted' and successor_person_id='a1000000-0000-4000-8000-000000000001' order by created_at desc limit 1;`);
  if(acceptedHandover) {
    await appPage(b,`teams?team=${fixtureId(400)}&handover=${acceptedHandover}`);await b.getByRole('dialog').waitFor();
    await b.getByRole('dialog').getByRole('heading',{name:'Deze overdracht is niet beschikbaar',exact:true}).waitFor();
    assert.equal(await b.getByRole('dialog').locator('.instruction-text').count(),0);assert.equal(await b.getByRole('dialog').getByRole('button',{name:'Ik neem het team over',exact:true}).count(),0);
    checks.push('NATIVE_OTHER_PARENT_HANDOVER_EXACT_ID_DENIED_NO_NOTE_NO_ACCEPT_ACTION');
  }
  assert.deepEqual(consoleFailures,[]);checks.push('NO_HYDRATION_OR_UNCAUGHT_RENDER_ERRORS');
  await writeFile(output+'/browser-results.json',JSON.stringify({environment:'local',...metadata(),actual_otp:true,synthetic_accounts:true,checks,matrix,tabletMatrix,debug_interest_blocked:process.env.PWA_DEBUG_SKIP_INTEREST==='1',passed:process.env.PWA_DEBUG_SKIP_INTEREST!=='1',readback:{before,after:profileReadback(),lost_response_only:after},lostResponseProof,nativeDomainReadback:{before:nativeDomainAtStart,after:nativeDomainReadback()},staging_verified:false},null,2)+'\n');
  console.log(JSON.stringify({result:process.env.PWA_DEBUG_SKIP_INTEREST==='1'?'DEBUG_PARTIAL_PROOF':'PASS',checks:checks.length,viewport_routes:matrix.length,tablet_routes:tabletMatrix.length,environment:'local',staging_verified:false}));
  }
} catch (error) {
  await mkdir(output,{recursive:true});
  if(lastPage&&!lastPage.isClosed()&&!authenticating) {await lastPage.screenshot({path:output+'/failed-state.png',fullPage:true}).catch(()=>{});await writeFile(output+'/failed-controls.json',JSON.stringify(await lastPage.evaluate(()=>({online:navigator.onLine,alerts:document.querySelectorAll('[role=alert]').length,formCount:document.querySelectorAll('form').length,saveButtons:[...document.querySelectorAll('button')].filter((button)=>button.textContent==='Profiel opslaan').map((button)=>({disabled:button.disabled,type:button.type})),hasOfflineMessage:document.body.textContent.includes('Je bent offline'),hasPendingMessage:document.body.textContent.includes('Een eerdere bevestiging wacht')})).catch(()=>({unavailable:true})),null,2)+'\n');}
  await writeFile(output+'/browser-results.json',JSON.stringify({environment:'local',...metadata(),checks,matrix,tabletMatrix,passed:false,failed_stage:stage,error_kind:error?.name,lostResponseProof,diagnostic:String(error?.message??'').split('\n')[0].replace(/https?:\/\/\S+/g,'[url]').replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[token]').replace(/[^\s]+@[^\s]+/g,'[address]'),assertion:error?.code==='ERR_ASSERTION'?error.message:undefined,staging_verified:false},null,2)+'\n');
  throw new Error(`PWA browser proof failed at ${stage}; private network/session diagnostics withheld.`);
} finally {
  await Promise.all(contexts.map((context)=>context.close()));
  if(browser)await browser.close();
}
