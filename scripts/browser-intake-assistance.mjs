import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

// This driver is deliberately bound to the disposable local Cluvo stack.
// Native OTPs, bearer tokens, cookies and request bodies stay in memory.
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = 'http://127.0.0.1:3200', mail = 'http://127.0.0.1:55324';
const output = process.env.EVIDENCE_OUTPUT ?? 'docs/release/evidence/local/20261007-w02-intake-assistance/assistance-ui-final';
const options = {viewport: {width:1440,height:1024},locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'};
const fixture = {
  tenant:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',household:'a3000000-0000-4000-8000-000000000001',
  profileA:'a4000000-0000-4000-8000-000000000001',profileB:'a4000000-0000-4000-8000-000000000002',
  personA:'a1000000-0000-4000-8000-000000000001',personB:'a1000000-0000-4000-8000-000000000002',
  actorA:'11111111-1111-4111-8111-111111111111',actorB:'22222222-2222-4222-8222-222222222222',
  reviewer:'33333333-3333-4333-8333-333333333333',
};
const management = `${base}/c/club-a/huishouden/intakehulp?household=${fixture.household}`;
const intakeB = `${base}/c/club-a/intake?profile=${fixture.profileB}`;
const contexts = [], checks = [], hydration = [], screenshots = [], computedStyles = [];
const roleGrant = randomUUID();
let browser, config, buildId, roleInserted = false, phase = 'INITIAL_TARGET_CHECK';
function sql(query) {
  try {return execFileSync('docker',['exec','-i','supabase_db_cluvo-local','psql','-U','postgres','-d','postgres','-qtA','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
  catch {throw new Error('Local fixture SQL failed; private input and diagnostics withheld.');}
}
const check = name => {checks.push(name);};
function snapshot() {
  return JSON.parse(sql(`select json_build_object(
    'household_version',(select version from app.households where id='${fixture.household}'),
    'delegations',(select count(*) from app.acting_delegations where tenant_id='${fixture.tenant}' and household_id='${fixture.household}'),
    'active_delegations',(select count(*) from app.acting_delegations where tenant_id='${fixture.tenant}' and household_id='${fixture.household}' and scope='intake_assistance' and revoked_at is null and (ends_at is null or ends_at>statement_timestamp())),
    'decisions',(select count(*) from app.intake_assistance_decisions where tenant_id='${fixture.tenant}' and household_id='${fixture.household}'),
    'audits',(select count(*) from app.audit_events where tenant_id='${fixture.tenant}' and action in ('intake.assistance_granted','intake.assistance_revoked')),
    'commands',(select count(*) from app.idempotency_records where tenant_id='${fixture.tenant}' and operation in ('grant_intake_assistance','revoke_intake_assistance') and status='completed'),
    'processing_commands',(select count(*) from app.idempotency_records where tenant_id='${fixture.tenant}' and operation in ('grant_intake_assistance','revoke_intake_assistance') and status='processing'),
    'profile_a_version',(select version from app.intake_profiles where id='${fixture.profileA}'),
    'profile_a_revision',(select current_revision from app.intake_profiles where id='${fixture.profileA}'),
    'profile_b_version',(select version from app.intake_profiles where id='${fixture.profileB}'),
    'profile_b_revision',(select current_revision from app.intake_profiles where id='${fixture.profileB}'),
    'answer_versions',(select count(*) from app.intake_answers_versions where tenant_id='${fixture.tenant}'),
    'intake_audits',(select count(*) from app.audit_events where tenant_id='${fixture.tenant}' and action='intake.revision_saved'),
    'intake_commands',(select count(*) from app.idempotency_records where tenant_id='${fixture.tenant}' and operation='save_intake_revision' and status='completed'),
    'confirmed_minutes',(select sum(minutes_delta) from app.hour_ledger_entries where tenant_id='${fixture.tenant}'),
    'target_minutes',(select effective_target_minutes from app.obligations where id='a6000000-0000-4000-8000-000000000001'),
    'bookings',(select count(*) from app.bookings where tenant_id='${fixture.tenant}'),
    'obligations',(select count(*) from app.obligations where tenant_id='${fixture.tenant}'));`));
}
function unrelatedDigest() {
  // Whole rows are compared in memory; neither rows nor their digests are exported.
  return sql(`select json_build_object(
    'ledger',(select md5(coalesce(jsonb_agg(to_jsonb(row) order by id)::text,'')) from app.hour_ledger_entries row where tenant_id='${fixture.tenant}'),
    'obligations',(select md5(coalesce(jsonb_agg(to_jsonb(row) order by id)::text,'')) from app.obligations row where tenant_id='${fixture.tenant}'),
    'bookings',(select md5(coalesce(jsonb_agg(to_jsonb(row) order by id)::text,'')) from app.bookings row where tenant_id='${fixture.tenant}'),
    'parent_a_answers',(select md5(coalesce(jsonb_agg(to_jsonb(row) order by revision)::text,'')) from app.intake_answers_versions row where profile_id='${fixture.profileA}'));`);
}
async function cooldown(actor) {
  assert.ok([fixture.actorA,fixture.actorB,fixture.reviewer].includes(actor));
  for (;;) {
    const seconds = Number(sql(`select greatest(0,ceil(61-extract(epoch from (statement_timestamp()-greatest(recovery_sent_at,confirmation_sent_at)))))::int from auth.users where id='${actor}';`));
    if (seconds <= 0) return;
    await new Promise(resolve => setTimeout(resolve,Math.min(seconds,30)*1000));
  }
}
function observe(context) {
  context.on('page',page => page.on('console',message => {
    if (/hydration|hydrated|didn't match/i.test(message.text())) hydration.push('hydration mismatch');
  }));
}
async function login(email,actor) {
  assert.ok(['ouder-a@example.test','ouder-b@example.test','coordinator@example.test'].includes(email));
  await cooldown(actor);
  const context = await browser.newContext(options); contexts.push(context); observe(context);
  const page = await context.newPage(); await page.goto(base+'/login');
  const previous = new Set((await fetch(mail+'/api/v1/messages').then(r=>r.json())).messages.map(({ID})=>ID));
  await page.getByLabel('Persoonlijk e-mailadres').fill(email);
  await page.getByRole('button',{name:'Stuur mijn inlogcode'}).click(); await page.waitForURL('**/auth/verify?sent=1');
  let token;
  for (let attempt=0;attempt<60&&!token;attempt++) {
    const messages = await fetch(mail+'/api/v1/messages').then(r=>r.json());
    const message = messages.messages.find(item=>!previous.has(item.ID)&&item.To?.some(recipient=>recipient.Address===email));
    if (message) {const content=await fetch(mail+'/api/v1/message/'+message.ID).then(r=>r.json());token=(content.Text??content.HTML??'').match(/\b\d{6}\b/)?.[0];}
    if (!token) await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(token,'OTP arrives only in local mail capture');
  try {await page.getByLabel('Eenmalige code').fill(token);await page.getByRole('button',{name:'Veilig inloggen'}).click();await page.waitForURL('**/workspaces');}
  catch {throw new Error('Local OTP verification failed; private code and diagnostics withheld.');}
  return {context,page,session:await nativeSession(context,actor)};
}
async function nativeSession(context,actor) {
  try {
    const cookies=await context.cookies();
    const value=cookies.filter(cookie=>/^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true})).map(cookie=>cookie.value).join('');
    const session=JSON.parse(value.startsWith('base64-')?Buffer.from(value.slice(7),'base64url').toString('utf8'):value);
    const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString('utf8'));
    if (claims.sub!==actor||!/^[0-9a-f-]{36}$/i.test(claims.session_id)) throw new Error('Invalid local session');
    return {token:session.access_token,id:claims.session_id};
  } catch {throw new Error('Synthetic native session validation failed; private diagnostics withheld.');}
}
const headers=session=>({apikey:config.publishableKey,Authorization:'Bearer '+session.token,'Accept-Profile':'api','Content-Profile':'api','Content-Type':'application/json'});
async function rpc(session,name,args) {
  try {return await fetch(config.url+'/rest/v1/rpc/'+name,{method:'POST',headers:headers(session),body:JSON.stringify(args)});}
  catch {throw new Error('Local scoped RPC failed; private request diagnostics withheld.');}
}
async function contextFor(session) {
  const response=await rpc(session,'get_intake_assistance_context',{p_tenant_id:fixture.tenant,p_household_id:fixture.household});
  assert.equal(response.status,200);return response.json();
}
async function personalRows(session,profile) {
  const response=await fetch(config.url+'/rest/v1/my_intake?select=profile_id&profile_id=eq.'+profile,{headers:headers(session)});
  assert.equal(response.status,200);return (await response.json()).length;
}
async function inspectManagementStyles(page,state,viewport) {
  const measured=await page.evaluate(()=>{
    const grant=document.querySelector('form[aria-label="Intakehulp verlenen"]');
    if (!grant) return null;
    const dimensions=element=>{
      const bounds=element.getBoundingClientRect(),style=getComputedStyle(element);
      return {width:bounds.width,height:bounds.height,border:Number.parseFloat(style.borderLeftWidth),padding_left:Number.parseFloat(style.paddingLeft),padding_top:Number.parseFloat(style.paddingTop)};
    };
    const fieldControl=element=>{
      const field=element.closest('label.field'),label=field?.querySelector(':scope > span');
      const bounds=element.getBoundingClientRect(),fieldBounds=field?.getBoundingClientRect(),labelBounds=label?.getBoundingClientRect();
      return {...dimensions(element),field_labelled:Boolean(field&&label&&element.labels?.[0]===field),
        label_above:Boolean(labelBounds&&labelBounds.height>0&&labelBounds.bottom<=bounds.top-4),
        full_width:Boolean(fieldBounds&&Math.abs(bounds.width-fieldBounds.width)<=2)};
    };
    const forms=[...document.querySelectorAll('form.intake-form[aria-label^="Intakehulp "]')];
    const textareas=forms.flatMap(form=>[...form.querySelectorAll('textarea')]).map(element=>({...fieldControl(element),styled_slot:element.dataset.slot==='textarea'}));
    const checkboxes=forms.flatMap(form=>[...form.querySelectorAll('[role="checkbox"]')]).map(element=>({...dimensions(element),
      styled_slot:element.dataset.slot==='checkbox',radius:Number.parseFloat(getComputedStyle(element).borderRadius),
      visible_label:Boolean(element.closest('label.checkline')?.querySelector(':scope > span')?.textContent?.trim())}));
    const back=[...document.querySelectorAll('a')].find(element=>element.textContent.trim()==='Terug naar dossier');
    return {selects:[...grant.querySelectorAll('select')].map(fieldControl),textareas,checkboxes,
      back:back?{...dimensions(back),styled_slot:back.dataset.slot==='button'}:null};
  });
  if (!measured) return;
  assert.equal(measured.selects.length,3);
  for (const select of measured.selects) {
    assert.equal(select.field_labelled,true,'native selects retain the existing labelled Field');
    assert.equal(select.label_above,true,'field label sits above its control');
    assert.equal(select.full_width,true,'select spans the available field width');
    assert.ok(select.height>=39.5&&select.height<=40.5,'select has the existing forty-pixel height');
    assert.ok(select.border>=1&&select.padding_left>=8,'select has a visible border and inner padding');
  }
  assert.ok(measured.textareas.length>=1);
  for (const textarea of measured.textareas) {
    assert.equal(textarea.field_labelled,true);assert.equal(textarea.label_above,true);assert.equal(textarea.full_width,true);assert.equal(textarea.styled_slot,true);
    assert.ok(textarea.border>=1&&textarea.padding_left>=8&&textarea.padding_top>=6,'textarea retains existing border and padding');
  }
  assert.ok(measured.checkboxes.length>=1);
  for (const checkbox of measured.checkboxes) {
    assert.equal(checkbox.styled_slot,true);assert.equal(checkbox.visible_label,true);
    assert.ok(checkbox.width>=16&&checkbox.height>=16&&checkbox.border>=1&&checkbox.radius>=3,'review uses the existing styled checkbox');
  }
  assert.equal(measured.back?.styled_slot,true);assert.ok(measured.back.height>=36&&measured.back.border>=1,'back link retains a full-height styled Button');
  computedStyles.push({state,viewport:viewport.width,...measured});
}
async function capture(page,name) {
  for (const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:1024}]) {
    await page.setViewportSize(viewport);await page.evaluate(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});return document.fonts.ready;});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'actual page has no horizontal overflow');
    await inspectManagementStyles(page,name,viewport);
    const filename=`${name}-${viewport.width}x${viewport.height}.png`;
    await page.screenshot({path:`${output}/screenshots/${filename}`,fullPage:true});screenshots.push(filename);
  }
  await page.setViewportSize(options.viewport);
}
async function fillGrant(page,profile=fixture.profileB,helper=fixture.personA,reason='Synthetische telefoonhulp met uitdrukkelijke toestemming') {
  const form=page.getByRole('form',{name:'Intakehulp verlenen',exact:true});
  await form.getByLabel('Persoon die hulp krijgt').selectOption(profile);
  await form.locator('select[name="helperPersonId"]').selectOption(helper);
  await form.getByLabel('Reden van de intakehulp').fill(reason);
  await form.getByRole('checkbox').check();return form;
}
async function loadManagement(page) {await page.goto(management);await page.getByRole('form',{name:'Intakehulp verlenen',exact:true}).waitFor();}
async function loseResponse(page,button,form) {
  let lost=false;
  await page.route('**/c/club-a/huishouden/intakehulp**',async route=>{
    if (route.request().method()!=='POST') return route.continue();
    let response;try {response=await route.fetch();}catch {throw new Error('Local assistance request failed; private request diagnostics withheld.');}
    assert.ok(response.ok());lost=true;await route.abort('failed');
  });
  await button.click();await form.getByRole('alert').filter({hasText:'geen bevestiging'}).waitFor();assert.ok(lost);
  await page.unroute('**/c/club-a/huishouden/intakehulp**');
}
async function prepareRevoke(page) {
  await loadManagement(page);
  const section=page.getByRole('region',{name:'Machtiging Ouder B'}).filter({has:page.getByText('Actief',{exact:true})});
  await section.getByRole('button',{name:'Intakehulp intrekken',exact:true}).click();
  const form=section.getByRole('form',{name:'Intakehulp intrekken voor Ouder B',exact:true});
  await form.getByLabel('Reden voor intrekken').fill('Synthetische telefonische intakehulp is afgerond');
  await form.getByRole('checkbox').check();
  const id=await form.locator('input[name="delegationId"]').inputValue();assert.match(id,/^[a-f0-9-]{36}$/);
  // A successful response can be lost while revalidation updates the badge.
  // Keep selecting the loaded command, independently of its current badge.
  return page.getByRole('form',{name:'Intakehulp intrekken voor Ouder B',exact:true})
    .filter({has:page.locator(`input[name="delegationId"][value="${id}"]`)});
}
async function summary(page,draft) {
  await page.getByLabel('Praktische ervaring').fill(draft);
  for (let step=0;step<3;step++) await page.getByRole('button',{name:'Verder',exact:true}).click();
  await page.getByRole('heading',{name:'Dit past bij jou.'}).waitFor();
}
try {
  config=await fetch(base+'/api/runtime-config').then(r=>r.json());
  const endpoint=new URL(config.url);assert.equal(endpoint.hostname,'127.0.0.1');assert.equal(endpoint.port,'55321');
  buildId=(await readFile('.next/BUILD_ID','utf8')).trim();assert.match(buildId,/^[A-Za-z0-9_-]+$/);
  if (process.env.EXPECT_BUILD_ID) assert.equal(buildId,process.env.EXPECT_BUILD_ID,'run the intended standalone build');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations;'),'16');
  try {await access(output+'/browser-results.json');throw new Error('Completed assistance evidence already exists and must be preserved.');}
  catch (error) {if (error.code!=='ENOENT') throw error;}
  await mkdir(output+'/screenshots',{recursive:true});browser=await chromium.launch({headless:true});
  const before=snapshot(),unrelatedBefore=unrelatedDigest();assert.equal(before.active_delegations,0,'preserve existing active assistance');
  sql(`insert into app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,household_id,starts_at,granted_by_auth_user_id)
    values('${roleGrant}','${fixture.tenant}','${fixture.reviewer}',(select id from app.permission_roles where tenant_id='${fixture.tenant}' and role_key='volunteer_committee'),'household','${fixture.household}',statement_timestamp()-interval '1 minute','${fixture.reviewer}');`);
  roleInserted=true;

  phase='ACTUAL_PARENT_OTP_AND_NEGATIVE_SCOPE';
  const parentA=await login('ouder-a@example.test',fixture.actorA),parentB=await login('ouder-b@example.test',fixture.actorB);
  const reviewer=await login('coordinator@example.test',fixture.reviewer);
  assert.equal(await contextFor(parentA.session),null);assert.equal(await contextFor(parentB.session),null);
  await parentA.page.goto(management);await parentA.page.getByRole('heading',{name:'Intakehulp niet beschikbaar'}).waitFor();
  assert.equal(await parentA.page.getByRole('form',{name:'Intakehulp verlenen',exact:true}).count(),0);
  await parentB.page.goto(management);await parentB.page.getByRole('heading',{name:'Intakehulp niet beschikbaar'}).waitFor();
  check('ACTUAL_PARENT_OTP_WITHOUT_COMMITTEE_MANDATE_HAS_NO_MANAGEMENT_CONTEXT_OR_FORM');
  const unauthorized=await rpc(parentA.session,'grant_intake_assistance',{p_tenant_id:fixture.tenant,p_household_id:fixture.household,p_profile_id:fixture.profileB,p_helper_person_id:fixture.personA,p_expected_household_version:before.household_version,p_ends_at:new Date(Date.now()+7*86400000).toISOString(),p_reason:'Synthetisch onbevoegd verzoek',p_idempotency_key:randomUUID()});
  assert.equal(unauthorized.status,403);assert.equal((await unauthorized.json()).message,'FORBIDDEN');assert.deepEqual(snapshot(),before);
  check('PARENT_CANNOT_SELF_AUTHORIZE_ASSISTANCE_THROUGH_DIRECT_RPC');
  assert.equal(await personalRows(parentA.session,fixture.profileB),0);
  await parentA.page.goto(intakeB);await parentA.page.getByRole('heading',{name:'Intake niet beschikbaar',exact:true}).waitFor();
  check('OTHER_PARENT_INTAKE_REMAINS_PRIVATE_BEFORE_EXPLICIT_GRANT');await capture(parentA.page,'assistance-parent-denied');

  phase='MINIMAL_REVIEWER_CONTEXT';
  const initialContext=await contextFor(reviewer.session);
  assert.deepEqual(Object.keys(initialContext).sort(),['can_grant','delegations','helpers','household_id','household_version','label','observed_at','subjects','timezone'].sort());
  for (const subject of initialContext.subjects) assert.deepEqual(Object.keys(subject).sort(),['display_name','person_id','profile_id']);
  for (const helper of initialContext.helpers) assert.deepEqual(Object.keys(helper).sort(),['display_name','person_id']);
  for (const delegation of initialContext.delegations) assert.deepEqual(Object.keys(delegation).sort(),['can_revoke','delegation_id','ends_at','helper_name','represented_person_id','revoked_at','starts_at','state','subject_name','version'].sort());
  assert.equal(JSON.stringify(initialContext).includes(fixture.actorA),false);assert.equal(JSON.stringify(initialContext).includes(fixture.actorB),false);
  assert.equal(await personalRows(reviewer.session,fixture.profileA),0);assert.equal(await personalRows(reviewer.session,fixture.profileB),0);
  await reviewer.page.goto(`${base}/c/club-a/huishouden?household=${fixture.household}`);
  await reviewer.page.getByRole('tab',{name:'Personen',exact:true}).click();
  await reviewer.page.getByRole('link',{name:'Intakehulp beheren',exact:true}).click();
  await reviewer.page.getByRole('form',{name:'Intakehulp verlenen',exact:true}).waitFor();
  const privateExperience=JSON.parse(sql(`select json_agg(answers->>'experience') from app.intake_answers_versions answer join app.intake_profiles profile on profile.id=answer.profile_id and profile.current_revision=answer.revision where profile.id in ('${fixture.profileA}','${fixture.profileB}');`));
  const managementHtml=await reviewer.page.content();for (const value of privateExperience.filter(value=>typeof value==='string'&&value.length>10)) assert.equal(managementHtml.includes(value),false);
  check('SCOPED_COMMITTEE_PERSONS_LINK_OPENS_MINIMAL_CONTEXT_WITHOUT_ANSWERS_REASONS_OR_AUTH_IDENTIFIERS');

  phase='CHECKBOX_REASON_AND_IDENTITY_ENFORCEMENT';
  const grant=await fillGrant(reviewer.page);await grant.evaluate(form=>{form.noValidate=true;});
  await grant.getByRole('checkbox').uncheck();await grant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();
  await grant.getByRole('alert').filter({hasText:'bevestig het verzoek'}).waitFor();assert.deepEqual(snapshot(),before);
  check('MISSING_EXPLICIT_REVIEW_CHECKBOX_REJECTED_BY_ACTUAL_SERVER_ACTION');
  await grant.getByRole('checkbox').check();await grant.getByLabel('Reden van de intakehulp').fill('');
  await grant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();await grant.getByRole('alert').filter({hasText:'leg de reden vast'}).waitFor();assert.deepEqual(snapshot(),before);
  check('MISSING_ASSISTANCE_REASON_REJECTED_BY_ACTUAL_SERVER_ACTION');
  await grant.getByLabel('Persoon die hulp krijgt').selectOption(fixture.profileA);
  assert.equal(await grant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).isDisabled(),true);
  await grant.getByText('Voor de eigen persoonlijke intake is geen machtiging nodig.',{exact:false}).waitFor();
  check('SELF_ASSISTANCE_UI_BLOCKED_WITH_PERSONAL_INTAKE_EXPLANATION');
  await fillGrant(reviewer.page);
  const reviewerCookies=await reviewer.context.cookies();await reviewer.context.clearCookies();await reviewer.context.addCookies(await parentA.context.cookies());
  await grant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();await grant.getByRole('alert').filter({hasText:'niet beschikbaar'}).waitFor();assert.deepEqual(snapshot(),before);
  await reviewer.context.clearCookies();await reviewer.context.addCookies(reviewerCookies);
  check('LOADED_COMMITTEE_FORM_REAUTHORIZES_ACTUAL_ACTOR_AND_DENIES_PARENT_COOKIE_SWAP');

  phase='COMMITTED_GRANT_RESPONSE_LOSS';
  await loadManagement(reviewer.page);const actualGrant=await fillGrant(reviewer.page);
  assert.equal(await actualGrant.evaluate(form=>new FormData(form).get('reviewed')),'on','styled Checkbox submits the reviewed value required by the server');
  const staleGrantPage=await reviewer.context.newPage();await loadManagement(staleGrantPage);
  const staleGrant=await fillGrant(staleGrantPage,fixture.profileA,fixture.personB,'Synthetische versiecontrole');
  const frozen={key:await actualGrant.locator('input[name="idempotencyKey"]').inputValue(),version:await actualGrant.locator('input[name="expectedHouseholdVersion"]').inputValue(),ends:await actualGrant.locator('input[name="endsAt"]').inputValue()};
  await capture(reviewer.page,'assistance-grant-reviewed');
  await loseResponse(reviewer.page,actualGrant.getByRole('button',{name:'Intakehulp verlenen',exact:true}),actualGrant);
  const granted=snapshot();assert.deepEqual(granted,{...before,household_version:before.household_version+1,delegations:before.delegations+1,active_delegations:1,decisions:before.decisions+1,audits:before.audits+1,commands:before.commands+1});
  assert.equal(unrelatedDigest(),unrelatedBefore);
  await reviewer.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await reviewer.page.waitForTimeout(800);
  assert.equal(await actualGrant.locator('input[name="idempotencyKey"]').inputValue(),frozen.key);
  assert.equal(await actualGrant.locator('input[name="expectedHouseholdVersion"]').inputValue(),frozen.version);
  assert.equal(await actualGrant.locator('input[name="endsAt"]').inputValue(),frozen.ends);
  check('COMMITTED_GRANT_RESPONSE_LOSS_PRESERVES_KEY_HOUSEHOLD_VERSION_AND_ABSOLUTE_END_TIME');await capture(reviewer.page,'assistance-grant-lost-response');
  await actualGrant.getByLabel('Reden van de intakehulp').fill('Synthetisch gewijzigd verzoek na reactie-uitval');
  // Native form reset can clear the styled checkbox after an action attempt.
  // Explicitly review again; the frozen command key/version/time remain intact.
  await actualGrant.getByRole('checkbox').check();
  await actualGrant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();await actualGrant.getByRole('alert').filter({hasText:'vorige verzoek'}).waitFor();assert.deepEqual(snapshot(),granted);
  check('COMMITTED_KEY_WITH_CHANGED_REASON_DENIED_WITHOUT_SECOND_DECISION');
  await actualGrant.getByLabel('Reden van de intakehulp').fill('Synthetische telefoonhulp met uitdrukkelijke toestemming');await actualGrant.getByRole('checkbox').check();
  await actualGrant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();await actualGrant.getByRole('status').filter({hasText:'machtiging voor intakehulp is vastgelegd'}).waitFor();assert.deepEqual(snapshot(),granted);
  check('EXACT_GRANT_RETRY_HAS_ONE_DELEGATION_ONE_IMMUTABLE_DECISION_ONE_AUDIT_ONE_COMMAND');
  await staleGrant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();await staleGrant.getByRole('alert').filter({hasText:'intussen gewijzigd'}).waitFor();assert.deepEqual(snapshot(),granted);
  check('STALE_HOUSEHOLD_VERSION_ACTUAL_GRANT_DENIED_WITHOUT_MUTATION');
  const delegation=sql(`select delegation_id from app.intake_assistance_decisions where tenant_id='${fixture.tenant}' and idempotency_key='${frozen.key}' and decision='granted';`);assert.match(delegation,/^[a-f0-9-]{36}$/);
  const grantAttribution=JSON.parse(sql(`select json_build_object('actor_correct',decision.actor_auth_user_id='${fixture.reviewer}','helper_correct',decision.helper_person_id='${fixture.personA}','represented_correct',decision.represented_person_id='${fixture.personB}','reason_recorded',char_length(decision.reason)>0,'delegation_helper_correct',delegation.actor_auth_user_id='${fixture.actorA}','explicit_scope',delegation.scope='intake_assistance','grant_actor_correct',delegation.granted_by_auth_user_id='${fixture.reviewer}','version_one',delegation.version=1,'bounded_period',delegation.ends_at>delegation.starts_at) from app.intake_assistance_decisions decision join app.acting_delegations delegation on delegation.id=decision.delegation_id where decision.tenant_id='${fixture.tenant}' and decision.idempotency_key='${frozen.key}';`));
  assert.ok(Object.values(grantAttribution).every(value=>value===true));check('GRANT_READBACK_DISTINGUISHES_REAL_REVIEWER_HELPER_AND_REPRESENTED_PERSON');
  await reviewer.page.reload();await reviewer.page.getByText('Actief',{exact:true}).waitFor();await capture(reviewer.page,'assistance-granted');

  phase='ACTUAL_ASSISTED_INTAKE_SAVE';
  assert.equal(await personalRows(parentA.session,fixture.profileB),1);assert.equal(await contextFor(parentA.session),null);
  await parentA.page.goto(intakeB);await parentA.page.getByLabel('Reden of context van de hulp').waitFor();
  assert.ok((await parentA.page.locator('.wizard').textContent()).includes('Ouder B'));
  await parentA.page.getByRole('button',{name:'Verder',exact:true}).click();await parentA.page.getByRole('alert').filter({hasText:'context van de hulp'}).waitFor();
  assert.deepEqual(snapshot(),granted);check('HELPER_GAINS_ONLY_EXPLICIT_PERSONAL_INTAKE_AND_MUST_RECORD_ASSISTANCE_CONTEXT');
  await parentA.page.getByLabel('Reden of context van de hulp').fill('Synthetische telefonische invoer met persoonlijke toestemming');
  await summary(parentA.page,'LOCAL_MANAGED_ASSISTANCE_B_REVIEWED');await capture(parentA.page,'assistance-helper-intake');
  await parentA.page.getByRole('button',{name:'Intake opslaan',exact:true}).click();await parentA.page.getByRole('status').filter({hasText:'veilig opgeslagen'}).waitFor();
  const saved=snapshot();assert.deepEqual(saved,{...granted,profile_b_version:granted.profile_b_version+1,profile_b_revision:granted.profile_b_revision+1,answer_versions:granted.answer_versions+1,intake_audits:granted.intake_audits+1,intake_commands:granted.intake_commands+1});
  const answerAttribution=JSON.parse(sql(`select json_build_object('actual_actor_correct',answers.authored_by_auth_user_id='${fixture.actorA}','represented_person_correct',answers.represented_person_id='${fixture.personB}','reason_recorded',nullif(answers.assistance_reason,'') is not null) from app.intake_answers_versions answers join app.intake_profiles profile on profile.id=answers.profile_id and profile.current_revision=answers.revision where profile.id='${fixture.profileB}';`));
  assert.deepEqual(answerAttribution,{actual_actor_correct:true,represented_person_correct:true,reason_recorded:true});assert.equal(unrelatedDigest(),unrelatedBefore);
  check('ACTUAL_HELPER_INTAKE_SERVER_ACTION_RECORDS_ACTOR_SUBJECT_AND_REASON_WITH_ONE_REVISION');
  const loadedHelper=await parentA.context.newPage();await loadedHelper.goto(intakeB);
  await loadedHelper.getByLabel('Reden of context van de hulp').fill('Synthetische nog geopende hulp na intrekken');await summary(loadedHelper,'LOCAL_MANAGED_ASSISTANCE_REVOKED_DRAFT');

  phase='COMMITTED_REVOCATION_RESPONSE_LOSS';
  const staleRevokePage=await reviewer.context.newPage(),staleRevoke=await prepareRevoke(staleRevokePage);
  const revoke=await prepareRevoke(reviewer.page);
  const revokeFrozen={key:await revoke.locator('input[name="idempotencyKey"]').inputValue(),householdVersion:await revoke.locator('input[name="expectedHouseholdVersion"]').inputValue(),delegationVersion:await revoke.locator('input[name="expectedDelegationVersion"]').inputValue()};
  await revoke.evaluate(form=>{form.noValidate=true;});await revoke.getByRole('checkbox').uncheck();
  await revoke.getByRole('button',{name:'Intrekken bevestigen',exact:true}).click();await revoke.getByRole('alert').filter({hasText:'bevestig het verzoek'}).waitFor();assert.deepEqual(snapshot(),saved);
  await revoke.getByRole('checkbox').check();await revoke.getByLabel('Reden voor intrekken').fill('');
  await revoke.getByRole('button',{name:'Intrekken bevestigen',exact:true}).click();await revoke.getByRole('alert').filter({hasText:'leg de reden vast'}).waitFor();assert.deepEqual(snapshot(),saved);
  check('REVOCATION_REQUIRES_EXPLICIT_REVIEW_AND_REASON_ON_ACTUAL_SERVER_ACTION');
  await revoke.getByLabel('Reden voor intrekken').fill('Synthetische telefonische intakehulp is afgerond');await revoke.getByRole('checkbox').check();await capture(reviewer.page,'assistance-revoke-reviewed');
  assert.equal(await revoke.evaluate(form=>new FormData(form).get('reviewed')),'on','styled Checkbox submits explicit revocation review');
  await loseResponse(reviewer.page,revoke.getByRole('button',{name:'Intrekken bevestigen',exact:true}),revoke);
  const revoked=snapshot();assert.deepEqual(revoked,{...saved,household_version:saved.household_version+1,active_delegations:0,decisions:saved.decisions+1,audits:saved.audits+1,commands:saved.commands+1});
  await reviewer.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await reviewer.page.waitForTimeout(800);
  assert.equal(await revoke.locator('input[name="idempotencyKey"]').inputValue(),revokeFrozen.key);
  assert.equal(await revoke.locator('input[name="expectedHouseholdVersion"]').inputValue(),revokeFrozen.householdVersion);
  assert.equal(await revoke.locator('input[name="expectedDelegationVersion"]').inputValue(),revokeFrozen.delegationVersion);
  check('COMMITTED_REVOCATION_RESPONSE_LOSS_PRESERVES_KEY_AND_BOTH_VERSION_SNAPSHOTS');await capture(reviewer.page,'assistance-revoke-lost-response');
  await revoke.getByRole('checkbox').check();
  await revoke.getByRole('button',{name:'Intrekken bevestigen',exact:true}).click();await revoke.getByRole('status').filter({hasText:'machtiging voor intakehulp is ingetrokken'}).waitFor();assert.deepEqual(snapshot(),revoked);
  check('EXACT_REVOCATION_RETRY_HAS_ONE_IMMUTABLE_DECISION_ONE_AUDIT_ONE_COMMAND');
  await staleRevoke.getByRole('button',{name:'Intrekken bevestigen',exact:true}).click();await staleRevoke.getByRole('alert').filter({hasText:'intussen gewijzigd'}).waitFor();assert.deepEqual(snapshot(),revoked);
  check('STALE_HOUSEHOLD_AND_DELEGATION_SNAPSHOTS_CANNOT_REVOKE_AGAIN');
  const revokeAttribution=JSON.parse(sql(`select json_build_object('actor_correct',decision.actor_auth_user_id='${fixture.reviewer}','helper_correct',decision.helper_person_id='${fixture.personA}','represented_correct',decision.represented_person_id='${fixture.personB}','reason_recorded',char_length(decision.reason)>0,'delegation_revoked',delegation.revoked_at is not null,'version_two',delegation.version=2) from app.intake_assistance_decisions decision join app.acting_delegations delegation on delegation.id=decision.delegation_id where decision.tenant_id='${fixture.tenant}' and decision.idempotency_key='${revokeFrozen.key}' and decision.decision='revoked';`));
  assert.ok(Object.values(revokeAttribution).every(value=>value===true));check('REVOCATION_ATTRIBUTION_AND_INCREMENTED_DELEGATION_VERSION_READ_BACK');
  await loadedHelper.getByRole('button',{name:'Intake opslaan',exact:true}).click();await loadedHelper.getByRole('alert').filter({hasText:'niet beschikbaar'}).waitFor();assert.deepEqual(snapshot(),revoked);
  check('PREVIOUSLY_LOADED_HELPER_FORM_DENIED_AFTER_REVOCATION_WITHOUT_NEW_ANSWER_OR_AUDIT');
  assert.equal(await personalRows(parentA.session,fixture.profileB),0);assert.equal(await personalRows(parentA.session,fixture.profileA),1);
  await loadedHelper.reload();await loadedHelper.getByRole('heading',{name:'Intake niet beschikbaar',exact:true}).waitFor();assert.equal((await loadedHelper.content()).includes('LOCAL_MANAGED_ASSISTANCE_B_REVIEWED'),false);
  check('FRESH_HELPER_VIEW_AND_OLD_SIGNED_REST_HAVE_NO_REPRESENTED_ANSWERS_AFTER_REVOCATION');
  await reviewer.page.reload();assert.equal(await reviewer.page.getByText('Actief',{exact:true}).count(),0);await capture(reviewer.page,'assistance-revoked');

  phase='NATIVE_SESSION_LOSS';
  await loadManagement(reviewer.page);const lostSessionGrant=await fillGrant(reviewer.page,fixture.profileA,fixture.personB,'Synthetisch verzoek na afmelden');
  const logout=await fetch(config.url+'/auth/v1/logout?scope=local',{method:'POST',headers:headers(reviewer.session)});assert.equal(logout.status,204);
  assert.equal(sql(`select exists(select 1 from auth.sessions where id='${reviewer.session.id}');`),'f');
  assert.equal(await contextFor(reviewer.session),null);
  await lostSessionGrant.getByRole('button',{name:'Intakehulp verlenen',exact:true}).click();await reviewer.page.waitForURL('**/login');assert.deepEqual(snapshot(),revoked);
  check('NATIVE_LOCAL_SIGNOUT_INVALIDATES_OLD_TOKEN_CONTEXT_AND_LOADED_MANAGEMENT_ACTION');await capture(reviewer.page,'assistance-native-session-login');
  assert.equal(await personalRows(parentA.session,fixture.profileA),1);assert.equal(await personalRows(parentB.session,fixture.profileB),1);
  check('REVIEWER_SIGNOUT_AND_ASSISTANCE_REVOCATION_PRESERVE_BOTH_PARENTS_OWN_NATIVE_ACCESS');
  assert.equal(unrelatedDigest(),unrelatedBefore);check('ALL_LEDGER_OBLIGATION_BOOKING_ROWS_AND_PARENT_A_ANSWER_HISTORY_UNCHANGED');
  assert.equal(revoked.confirmed_minutes,before.confirmed_minutes);assert.equal(revoked.target_minutes,before.target_minutes);
  assert.equal(revoked.processing_commands,0);check('INTEGER_MINUTES_AND_EXISTING_OBLIGATION_STABLE_WITH_NO_PROCESSING_COMMAND_LEFT');
  assert.deepEqual(hydration,[]);check('NO_HYDRATION_MISMATCHES_AT_390_768_1440_WIDTHS');
  assert.equal(computedStyles.length,18,'all six captured management states measured at each width');
  check('ACTUAL_CLUB_SIGNAL_UI_STYLED_FIELDS_CHECKBOXES_AND_BUTTON_AT_390_768_1440_WIDTHS_WITHOUT_OVERFLOW');

  phase='EVIDENCE_AND_FIXTURE_CLEANUP';
  sql(`update app.access_grants set revoked_at=statement_timestamp() where id='${roleGrant}' and revoked_at is null;`);roleInserted=false;
  assert.equal(sql(`select count(*) from app.access_grants where id='${roleGrant}' and revoked_at is null;`),'0');
  const result={observed_at:new Date().toISOString(),environment:'local',app_build:'production standalone',build_id:buildId,database_migrations:16,
    fixture:'existing synthetic core-v1 history preserved; actual local OTP for parents A/B and coordinator; one temporary household-scoped committee grant, revoked after proof',
    checks,passed:true,readback:{before,granted,saved,revoked,grant_attribution:grantAttribution,answer_attribution:answerAttribution,revoke_attribution:revokeAttribution,
      unrelated_rows_unchanged:true,private_answers_absent_from_reviewer_context:true,temporary_review_grant_revoked:true,native_session_material_exported:false},
    screenshots,computed_styles:computedStyles,staging_verified:false,release_ready:false,v1_ready:false,production_enabled:false};
  await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2)+'\n');
  await writeFile(output+'/verification.md',`# Intakehulp — uitgevoerd lokaal UI-bewijs\n\n${checks.length} controles geslaagd met echte lokale OTP-sessies, Native Auth-autorisatie en serveracties op standalonebuild \`${buildId}\`. De twee verloren succesvolle responses zijn werkelijk na serververwerking afgebroken; exact herhalen leverde telkens één besluit, audit en opdracht op.\n\nDe bestaande synthetische fixturehistorie is behouden. Eén huishoudgebonden commissiegrant is tijdelijk toegevoegd en weer ingetrokken; de werkelijk verleende hulp is via de app ingetrokken. Alle ledger-, verplichtings- en boekingsrijen en de antwoordhistorie van ouder A bleven gelijk. Ouder B heeft binnen deze proef één aantoonbaar door ouder A geschreven revisie erbij, met aparte actor, vertegenwoordigde persoon en hulprede. Tokens, OTP's, cookies, sessie-ID's, Auth-identifiers en private request bodies zijn niet geëxporteerd.\n\n${screenshots.length} echte schermafbeeldingen op 390, 768 en 1440 pixels; geen horizontale overflow of hydration mismatch. De gerenderde controls zijn in zes beheertoestanden op alle drie breedtes gemeten: gelabelde velden boven hun control, selectvelden met volledige veldbreedte en 40 pixels hoogte, borders en padding op select/textarea, bestaande Checkbox en een terug-link als Button van minstens 36 pixels hoog. Deze stijlmetingen onderbouwen de bestaande UI-controle en tellen niet als extra semantische scenario's. Dit is lokaal bewijs, geen stagingreadback, volledige V1-acceptatie of bewijs van mailbezorging.\n`);
  console.log(JSON.stringify({result:'PASS',checks:checks.length,screenshots:screenshots.length,environment:'local',staging_verified:false}));
} catch (error) {
  const locations=String(error.stack??'').split('\n').filter(line=>/^\s+at /.test(line)).map(line=>line.trim());
  console.error(JSON.stringify({result:'FAIL',phase,completed_checks:checks.length,failure_kind:error.name,source_locations:locations,private_diagnostics:'withheld'}));process.exitCode=1;
} finally {
  if (roleInserted) sql(`update app.access_grants set revoked_at=statement_timestamp() where id='${roleGrant}' and revoked_at is null;`);
  await Promise.all(contexts.map(context=>context.close()));if (browser) await browser.close();
}
