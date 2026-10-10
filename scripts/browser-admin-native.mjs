import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base='http://127.0.0.1:3400';
const mail='http://127.0.0.1:62324';
const output='docs/release/evidence/local/20261009-admin-native';
const checks=[],contexts=[];
let phase='launch',browser;
const sql=query=>execFileSync('docker',['exec','-i','supabase_db_cluvo-local','psql','-U','supabase_admin','-d','cluvo_admin_browser_20261009','-XAt','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'}).trim();
const mark=(name,detail={})=>checks.push({name,status:'PASS',...detail});
async function login(email){
 assert.ok(['coordinator@example.test','ouder-a@example.test','tenant-b@example.test','platform@example.test','invitee@example.test'].includes(email));
 phase='native-otp:'+email.split('@')[0];
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'});contexts.push(context);
 const page=await context.newPage();
 const previous=new Set((await fetch(mail+'/api/v1/messages').then(r=>r.json())).messages.map(m=>m.ID));
 await page.goto(base+'/login');
 await page.getByLabel('Persoonlijk e-mailadres').fill(email);
 await page.getByRole('button',{name:'Stuur mijn inlogcode'}).click();
 await page.waitForURL('**/auth/verify?sent=1');
 let token;
 for(let i=0;i<80&&!token;i++){
  const messages=await fetch(mail+'/api/v1/messages').then(r=>r.json());
  const found=messages.messages.find(m=>!previous.has(m.ID)&&m.To?.some(r=>r.Address===email));
  if(found){const content=await fetch(mail+'/api/v1/message/'+found.ID).then(r=>r.json());token=(content.Text??content.HTML??'').match(/\b\d{6,10}\b/)?.[0];}
  if(!token)await page.waitForTimeout(250);
 }
 assert.ok(token,'Native OTP captured locally');
 await page.getByLabel('Eenmalige code').fill(token);
 await page.getByRole('button',{name:'Veilig inloggen'}).click();
 await page.waitForURL(email==='platform@example.test'?/\/platform\/overview$/:/\/workspaces$/);
 if(email==='platform@example.test')await page.locator('.cluvo-admin').first().waitFor();
 mark('native OTP session',{account:email.split('@')[0]});return {page,context};
}
async function visit(page,path){phase='route:'+path;console.log(JSON.stringify({phase}));const response=await page.goto(base+path);assert.ok(response?.status()<400,'Authorized page renders');await page.locator('.cluvo-admin').first().waitFor();await page.locator('main h1').first().waitFor();if(await page.locator('.admin-form-panel').count())await page.locator('.admin-form-panel[data-ready=true]').first().waitFor({state:'attached'});}
async function rejected(page,path){phase='denied:'+path;const response=await page.goto(base+path);assert.ok([200,404].includes(response?.status()));await page.getByRole('heading',{name:'404',exact:true}).waitFor();assert.equal(await page.locator('.cluvo-admin').count(),0);mark('Forged route rejected',{path,http_status:response.status(),not_found_ui:true});}
try{
 await mkdir(output,{recursive:true});browser=await chromium.launch({headless:true});
 const admin=await login('coordinator@example.test');
 const clubRoutes=['cockpit','organization','organization?part=locations','organization?part=settings','people','people?part=households','access','committees','teams','planning','planning?part=catalogue','planning?part=calendar','execution','requests','policies','courses','courses?part=qualifications','communication','communication?part=templates','reports','reports?part=winter','reports?part=annual','reports?part=report_teams','reports?part=report_occupancy','reports?part=fund','requests?part=vacancies','requests?part=volunteer_roles','finance','finance?part=fund','seasons','support','support?part=audit'];
 for(const route of clubRoutes){await visit(admin.page,'/c/club-a/beheer/'+route);mark('Club route renders',{route});}
 const platform=await login('platform@example.test');
 for(const route of ['overview','tenants','staff','defaults','integrations','support','audit']){await visit(platform.page,'/platform/'+route);mark('Platform route renders',{route});}
 await rejected(platform.page,'/c/club-a/beheer/people');
 const member=await login('ouder-a@example.test');
 await rejected(member.page,'/platform');await rejected(member.page,'/c/club-a/beheer/finance');
 const other=await login('tenant-b@example.test');await rejected(other.page,'/c/club-a/beheer/people');
 // Own native identity on a second device, without exporting session tokens.
 const sessionsBefore=Number(sql("select count(*)from auth.sessions where user_id='33333333-3333-4333-8333-333333333333';"));const secondNative=await login('coordinator@example.test');const secondPage=secondNative.page;await secondPage.setViewportSize({width:390,height:844});assert.ok(Number(sql("select count(*)from auth.sessions where user_id='33333333-3333-4333-8333-333333333333';"))>sessionsBefore,'Second device has its own native Auth session');
 await visit(admin.page,'/c/club-a/beheer/organization?part=locations');
 const panel=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Locatie',exact:true})});const form=panel.locator('form');
 await form.getByLabel('Naam',{exact:true}).fill('Beheerproef tweede apparaat');
 await form.getByLabel('Reden en vervolgstap').fill('Lokale native beheerproef met readback');
 await form.getByRole('button',{name:'Locatie opslaan'}).click();
 await panel.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 assert.equal(sql("select count(*)from app.locations where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and name='Beheerproef tweede apparaat';"),'1');
 await visit(secondPage,'/c/club-a/beheer/organization?part=locations');await secondPage.getByText('Beheerproef tweede apparaat',{exact:true}).first().waitFor();
 mark('Stored location survives reload and second device',{canonical_rows:1});
 // Real native organization logo, committee membership and vacancy publication.
 await visit(admin.page,'/c/club-a/beheer/organization');
 const organization=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Verenigingsgegevens',exact:true})});
 const logo=await admin.page.evaluate(()=>{const c=document.createElement('canvas');c.width=96;c.height=96;const x=c.getContext('2d');x.fillStyle='#f34f3d';x.fillRect(0,0,96,96);x.fillStyle='#fff';x.font='bold 50px sans-serif';x.fillText('A',29,67);return c.toDataURL('image/png').split(',')[1];});
 await organization.getByLabel('Contactpersoon',{exact:true}).fill('Synthetic contact');await organization.getByLabel('Contactadres',{exact:true}).fill('club-a@example.test');await organization.locator('input[type=file]').setInputFiles({name:'synthetic-club-a.png',mimeType:'image/png',buffer:Buffer.from(logo,'base64')});await organization.getByLabel('Reden en vervolgstap').fill('Eigen synthetisch logo lokaal opslaan en controleren');await organization.getByRole('button',{name:'Verenigingsgegevens opslaan'}).click();await organization.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 await visit(secondPage,'/c/club-a/beheer/organization');const storedLogo=secondPage.getByAltText('Huidig verenigingslogo',{exact:true});await storedLogo.waitFor();assert.ok(await storedLogo.evaluate(img=>img.complete&&img.naturalWidth>0));assert.equal(sql("select length(branding_json->>'logo_path')<33000 from app.tenants where slug='club-a';"),'t');mark('Uploaded club logo renders after stored read on a second native device');
 await visit(admin.page,'/c/club-a/beheer/committees/a2000000-0000-4000-8000-000000000001');const committeeContact=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Commissiecontact',exact:true})});await committeeContact.getByLabel('Contactpersoon',{exact:true}).fill('Synthetic committee contact');await committeeContact.getByLabel('Commissieadres',{exact:true}).fill('committee@example.test');await committeeContact.getByLabel('Reden en vervolgstap').fill('Benoemd aanspreekpunt voor de lokale proef');await committeeContact.getByRole('button',{name:'Contactpunt bewaren'}).click();await committeeContact.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 await visit(admin.page,'/c/club-a/beheer/committees/a2000000-0000-4000-8000-000000000001');const committeeMember=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Commissielid toevoegen',exact:true})});await committeeMember.getByLabel('Persoon',{exact:true}).selectOption('a1000000-0000-4000-8000-000000000001');await committeeMember.getByLabel('Werkzaamheden of verantwoordelijkheid').fill('Benoemde synthetische bardienstcoördinatie');await committeeMember.getByLabel('Reden en vervolgstap').fill('Lidmaatschap is afzonderlijk van toegangsrechten');await committeeMember.getByRole('button',{name:'Benoemd lid toevoegen'}).click();await committeeMember.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();await visit(secondPage,'/c/club-a/beheer/committees/a2000000-0000-4000-8000-000000000001');await secondPage.getByText('Synthetic committee contact',{exact:true}).first().waitFor();await secondPage.getByText('Benoemde synthetische bardienstcoördinatie',{exact:true}).first().waitFor();mark('Committee contact and service membership persist across native devices');
 await visit(admin.page,'/c/club-a/beheer/requests?part=vacancies');const vacancy=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Vacature voorbereiden',exact:true})});await vacancy.getByLabel('Vacaturetitel').fill('Native beheerproef vacature');await vacancy.getByLabel('Werkzaamheden',{exact:true}).fill('Werkelijke lokaal opgeslagen vrijwilligerstaak');const roleChoice=await vacancy.locator('select[name=role_version_id] option').evaluateAll(options=>options.map(o=>o.value).find(Boolean));assert.ok(roleChoice);await vacancy.getByLabel('Gepubliceerde functieversie',{exact:true}).selectOption(roleChoice);await vacancy.getByLabel('Benoemde contactpersoon',{exact:true}).selectOption('a1000000-0000-4000-8000-000000000003');await vacancy.getByLabel('Reden en vervolgstap').fill('Concept voor oorspronkelijke ledenapp publiceren');await vacancy.getByRole('button',{name:'Vacatureconcept bewaren'}).click();await vacancy.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();const vacancyId=sql("select id from app.vacancies where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and title='Native beheerproef vacature';");assert.match(vacancyId,/^[0-9a-f-]{36}$/);
 await visit(admin.page,'/c/club-a/beheer/requests/'+vacancyId+'?part=vacancies');const publishVacancy=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Vacature publiceren of sluiten',exact:true})});await publishVacancy.getByLabel('Ik heb de werkzaamheden, functieversie en gevolgen voor belangstellenden gecontroleerd').check();await publishVacancy.getByLabel('Reden en vervolgstap').fill('Deze getoonde versie bevoegd publiceren');await publishVacancy.getByRole('button',{name:'Vacaturestatus bevestigen'}).click();await publishVacancy.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();await member.page.goto(base+'/app/c/club-a/opportunities');await member.page.getByText('Native beheerproef vacature',{exact:true}).first().waitFor();assert.equal(sql("select state from app.vacancies where id='"+vacancyId+"';"),'published');mark('Admin vacancy publication appears in the original member PWA from the same row');
 for(const section of ['reports','report_teams','report_occupancy']){const report=await admin.context.request.get(base+'/c/club-a/beheer/export?section='+section+'&season=a5000000-0000-4000-8000-000000000001');assert.equal(report.status(),200);assert.match(report.headers()['content-type'],/text\/csv/);assert.equal(report.headers()['cache-control'],'private, no-store');const otherReport=await other.context.request.get(base+'/c/club-a/beheer/export?section='+section+'&season=a5000000-0000-4000-8000-000000000001');assert.equal(otherReport.status(),404);mark('Report CSV uses scoped canonical source',{section});}
 // X and Gezien both save actor/topic/version, including another native session.
 for(const [topic,route,selector]of [['admin.club.planning.v1','/c/club-a/beheer/planning','.cluvo-help-close'],['admin.club.courses.v1','/c/club-a/beheer/courses','.cluvo-help-seen']]){
  await visit(admin.page,route);const banner=admin.page.locator(`[data-help-id="${topic}"]`);await banner.locator(selector).click();await banner.waitFor({state:'hidden'});await admin.page.reload();assert.equal(await admin.page.locator(`[data-help-id="${topic}"]`).count(),0);
  await visit(secondPage,route);assert.equal(await secondPage.locator(`[data-help-id="${topic}"]`).count(),0);
  assert.equal(sql(`select count(*)from app.user_help_seen where auth_user_id='33333333-3333-4333-8333-333333333333'and topic_id='${topic}';`),'1');mark('Explanation preference persists across native sessions',{topic,control:selector});
 }
 await visit(platform.page,'/platform/staff');await platform.page.getByLabel('Persoonlijk e-mailadres van de beheerder').fill('ouder-a@example.test');await platform.page.getByRole('button',{name:'Geverifieerd account controleren'}).click();await platform.page.getByLabel('Bestaand persoonlijk account').waitFor();mark('Named verified account selected through native platform RPC');
 // A native recipient accepts a scoped club offer, then sees the same grant
 // from a separate actual OTP session. No rights exist before that decision.
 const localDate=value=>{const x=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(value).map(p=>[p.type,p.value]));return `${x.year}-${x.month}-${x.day}T${x.hour}:${x.minute}`;};
 await visit(admin.page,'/c/club-a/beheer/access');
 const offer=admin.page.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Benoemde beheeruitnodiging',exact:true})});
 await offer.getByLabel('Geverifieerd persoonlijk account',{exact:true}).selectOption('11111111-1111-4111-8111-111111111111');
 const offeredRole=sql("select id from app.permission_roles where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'and role_key='committee_coordinator';");
 await offer.getByLabel('Rol',{exact:true}).selectOption(offeredRole);await offer.getByLabel('Bereik',{exact:true}).selectOption('committee');
 await offer.getByLabel('Commissie of huishouden',{exact:true}).selectOption('a2000000-0000-4000-8000-000000000001');
 await offer.getByLabel('Einddatum van het mandaat').fill(localDate(new Date(Date.now()+86400000)));
 await offer.getByLabel('Accepteren vóór').fill(localDate(new Date(Date.now()+3600000)));
 await offer.getByLabel('Reden en vervolgstap').fill('Benoemde lokale beheeruitnodiging met echte ontvangeracceptatie');
 await offer.getByRole('button',{name:'Uitnodiging in Cluvo klaarzetten'}).click();await offer.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 assert.equal(sql("select state from app.admin_access_invitations where invited_auth_user_id='11111111-1111-4111-8111-111111111111';"),'pending');
 await member.page.goto(base+'/workspaces');await member.page.getByRole('button',{name:'Deze rechten en eindtijd accepteren'}).click();
 await member.page.getByText('Status: Geaccepteerd',{exact:true}).waitFor();
 assert.equal(sql("select count(*)from app.admin_access_invitations i join app.access_grants g on g.tenant_id=i.tenant_id and g.id=i.access_grant_id where i.invited_auth_user_id='11111111-1111-4111-8111-111111111111'and i.state='accepted'and g.scope_kind='committee';"),'1');
 const invitedDevice=await login('ouder-a@example.test');await invitedDevice.page.getByText('Status: Geaccepteerd',{exact:true}).waitFor();
 await visit(invitedDevice.page,'/c/club-a/beheer/planning');await rejected(invitedDevice.page,'/c/club-a/beheer/people');
 mark('Scoped administration invitation grants only after recipient acceptance and survives a second native OTP session');
 // Platform onboarding persists an invitation for an existing verified person
 // without creating membership in the new club before their acceptance.
 await visit(platform.page,'/platform/tenants');
 const newClub=platform.page.locator('.admin-form-panel').filter({has:platform.page.getByRole('heading',{name:'Vereniging aanmaken',exact:true})});
 await newClub.getByLabel('Naam',{exact:true}).fill('Native uitnodigingsvereniging');await newClub.getByLabel('Korte verenigingsnaam in links').fill('native-invite-browser');
 await newClub.getByLabel('Reden en vervolgstap').fill('Eigen lokale native onboardingproef');await newClub.getByRole('button',{name:'Vereniging voorbereiden'}).click();await newClub.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 const createdClub=sql("select id from app.tenants where slug='native-invite-browser';");assert.match(createdClub,/^[0-9a-f-]{36}$/);
 await visit(platform.page,'/platform/tenants/'+createdClub);
 await platform.page.getByLabel('Persoonlijk e-mailadres van de beheerder').nth(1).fill('invitee@example.test');
 await platform.page.getByRole('button',{name:'Geverifieerd account controleren'}).nth(1).click();
 const firstOffer=platform.page.locator('.admin-form-panel').filter({has:platform.page.getByRole('heading',{name:'Eerste beheerder uitnodigen',exact:true})});await firstOffer.waitFor();
 await firstOffer.getByLabel('Voornaam',{exact:true}).fill('Benoemde');await firstOffer.getByLabel('Achternaam',{exact:true}).fill('Beheerder');
 await firstOffer.getByLabel('Einddatum van het mandaat').fill(localDate(new Date(Date.now()+86400000)));
 await firstOffer.getByLabel('Accepteren vóór').fill(localDate(new Date(Date.now()+3600000)));
 await firstOffer.getByLabel('Ik bied uitsluitend deze getoonde rechten en eindtijd aan').check();
 await firstOffer.getByLabel('Reden en vervolgstap').fill('Benoemde eerste beheerder accepteert de huidige rechten');
 await firstOffer.getByRole('button',{name:'Benoemde uitnodiging in Cluvo klaarzetten'}).click();await firstOffer.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 assert.equal(sql("select count(*)from app.tenant_memberships where tenant_id='"+createdClub+"';"),'0');
 const firstInvitee=await login('invitee@example.test');await firstInvitee.page.getByRole('button',{name:'Deze rechten en eindtijd accepteren'}).click();await firstInvitee.page.getByText('Status: Geaccepteerd',{exact:true}).waitFor();
 assert.equal(sql("select count(*)from app.tenant_memberships where tenant_id='"+createdClub+"'and auth_user_id='66666666-6666-4666-8666-666666666666';"),'1');
 assert.equal(sql("select count(*)from app.tenant_memberships where tenant_id='"+createdClub+"'and auth_user_id='55555555-5555-4555-8555-555555555555';"),'0');
 await visit(platform.page,'/platform/tenants/'+createdClub+'?tab=administrators');await platform.page.getByText('Geaccepteerd',{exact:true}).first().waitFor();
 mark('Platform onboarding invitation creates the named membership only after verified recipient acceptance');
 // Scoped calendar export uses the same native planning and excludes dossiers.
 const exported=await admin.context.request.get(base+'/c/club-a/beheer/export?section=planning&format=ics&season=a5000000-0000-4000-8000-000000000001');assert.equal(exported.status(),200);assert.match(await exported.text(),/BEGIN:VCALENDAR/);assert.equal(exported.headers()['cache-control'],'private, no-store');
 const deniedExport=await other.context.request.get(base+'/c/club-a/beheer/export?section=planning&format=ics&season=a5000000-0000-4000-8000-000000000001');assert.equal(deniedExport.status(),404);mark('Native calendar export is scoped and private');
 // Real named support: request, consent, own account context and mounted revocation.
 await visit(platform.page,'/platform/support');
 await platform.page.getByLabel('Vereniging voor ondersteuning').selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 await platform.page.locator('.admin-form-panel[data-ready=true]').waitFor({state:'attached'});
 const supportRequest=platform.page.locator('.admin-form-panel').filter({has:platform.page.getByRole('heading',{name:'Ondersteuning aanvragen',exact:true})});
 await supportRequest.getByLabel('Doel en werkzaamheden').fill('Lokale native ondersteuning voor planning');await supportRequest.getByLabel('Taakplanning beheren',{exact:true}).check();
 const supportEnd=new Date(Date.now()+3600000);const localParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(supportEnd).map(p=>[p.type,p.value]));
 await supportRequest.getByLabel('Einddatum, maximaal 24 uur').fill(`${localParts.year}-${localParts.month}-${localParts.day}T${localParts.hour}:${localParts.minute}`);await supportRequest.getByLabel('Reden en vervolgstap').fill('Lokale proef met afzonderlijke toestemming');await supportRequest.getByRole('button',{name:'Toestemming aanvragen'}).click();await supportRequest.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 await visit(admin.page,'/c/club-a/beheer/support');const namedSupport=admin.page.locator('details').filter({has:admin.page.locator('summary').filter({hasText:'Lokale native ondersteuning voor planning'})});await namedSupport.locator('summary').click();
 const consent=namedSupport.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Toestemming voor benoemde ondersteuning',exact:true})});await consent.getByLabel('Ik geef toestemming voor het getoonde doel, bereik en de eindtijd').check();await consent.getByLabel('Reden en vervolgstap').fill('Deze vereniging stemt in met de benoemde proef');await consent.getByRole('button',{name:'Keuze vastleggen'}).click();await consent.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 const supportPage=await platform.context.newPage();await visit(supportPage,'/c/club-a/beheer/planning');await supportPage.getByText('Tijdelijke benoemde ondersteuning',{exact:true}).waitFor();assert.equal(sql("select count(*)from app.account_person_links where auth_user_id='55555555-5555-4555-8555-555555555555';"),'0');
 const supportNegative=await platform.context.newPage();await rejected(supportNegative,'/c/club-a/beheer/finance');await rejected(supportNegative,'/c/club-a/beheer/people');await supportNegative.close();mark('Consented support uses own account and cannot open private dossiers');
 await visit(admin.page,'/c/club-a/beheer/support');const approvedSupport=admin.page.locator('details').filter({has:admin.page.locator('summary').filter({hasText:'Lokale native ondersteuning voor planning'})});await approvedSupport.locator('summary').click();const ending=approvedSupport.locator('.admin-form-panel').filter({has:admin.page.getByRole('heading',{name:'Ondersteuning stoppen',exact:true})});await ending.getByLabel('Reden en vervolgstap').fill('Benoemde native proef afgerond');await ending.getByRole('button',{name:'Tijdelijke toegang intrekken'}).click();await ending.getByText('De wijziging is opgeslagen.',{exact:true}).waitFor();
 // No reload on the supported device: native authority polling closes its children.
 await supportPage.waitForFunction(()=>!document.querySelector('.cluvo-admin'),{},{timeout:25000});assert.equal(sql("select count(*)from app.platform_support_requests where employee_auth_user_id='55555555-5555-4555-8555-555555555555'and state='revoked';"),'1');mark('Mounted support context closes after native revocation without reload');await supportPage.close();
 await visit(platform.page,'/platform/overview');await platform.page.waitForTimeout(16000);assert.ok(await platform.page.locator('.cluvo-admin').count()>0);mark('Authorized platform context remains stable after native authority recheck');
 // Every administrative list/tab is checked at each viewport. Cockpit labels
 // and unknown report values need the same width checks as form screens.
 for(const width of [320,390,768,1440])for(const [page,paths]of [[admin.page,clubRoutes.map(route=>'/c/club-a/beheer/'+route)],[platform.page,['overview','tenants','staff','defaults','integrations','support','audit'].map(route=>'/platform/'+route)]])for(const path of paths){
  await page.setViewportSize({width,height:1000});await visit(page,path);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Responsive overflow at ${width}: ${path}`);
  mark('Administrative route fits viewport',{path,width});
 }
 for(const width of [320,390,768,1440])for(const [page,path]of [[admin.page,'/c/club-a/beheer/planning'],[platform.page,'/platform/tenants']]){
  await page.setViewportSize({width,height:1000});await visit(page,path);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow');
  mark('Responsive native page',{path,width});await page.screenshot({path:`${output}/${path.includes('platform')?'platform':'club'}-${width}.png`,fullPage:true});
 }
 phase='complete';await writeFile(output+'/results.json',JSON.stringify({status:'PASS',native_auth:true,database:'cluvo_admin_browser_20261009',synthetic_accounts_only:true,physical_device:false,browser:browser.version(),checks},null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',checks:checks.length,output}));
}catch(error){
 await mkdir(output,{recursive:true});await writeFile(output+'/failed-attempt.json',JSON.stringify({status:'FAIL',phase,error_kind:error.name,error_category:error.message.includes('strict mode violation')?'test locator':error.message.includes('net::ERR_ABORTED')?'navigation interrupted':'check failed',completed_checks:checks},null,2)+'\n');
 console.error(JSON.stringify({status:'FAIL',phase,error_kind:error.name}));process.exitCode=1;
}finally{for(const context of contexts)await context.close().catch(()=>{});await browser?.close();}
