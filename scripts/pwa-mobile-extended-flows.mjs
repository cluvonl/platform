import assert from 'node:assert/strict';

// Only called by the native local synthetic browser suite. Every transition
// below uses the rendered application; SQL is readback, never a fixture edit.
export async function runExtendedMobileFlows({a,c,sql,appPage,eventually,fixtureId,checks,setStage}) {
  const teamId=fixtureId(400);
  const run=String(Date.now());
  const selectedTeam=(page,view)=>appPage(page,`teams?team=${teamId}&tab=organize${view?`&view=${view}`:''}`);
  const teamOwner=sql(`select count(*) from app.pwa_handovers where team_id='${teamId}' and state='accepted' and successor_person_id='a1000000-0000-4000-8000-000000000001';`)==='0'?c:a;
  const ledgerBefore=sql("select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';");
  const publicDate=sql("select greatest(date '2027-02-10',coalesce(max((b.starts_at_snapshot at time zone 'Europe/Amsterdam')::date)+7,date '2027-02-10')) from app.bookings b join app.shift_positions p on p.tenant_id=b.tenant_id and p.id=b.position_id join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where b.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and b.executor_person_id='a1000000-0000-4000-8000-000000000001' and b.state in ('booked','reconfirmation_required','transfer_pending','performed_pending','confirmed') and s.title like 'PWA browser club public %';");
  assert.match(publicDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(sql(`select count(*) from app.seasons s join app.obligations o on o.tenant_id=s.tenant_id and o.season_id=s.id where o.id='${fixtureId(600)}' and s.starts_on<=date '${publicDate}' and s.ends_on>=date '${publicDate}'+2;`),'1','The next independent synthetic booking date stays inside the actual fixture season.');
  const clubDate=(offset)=>{const day=new Date(`${publicDate}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+offset);return day.toISOString().slice(0,10);};


  async function teamTask({title,repeat,minutes,starts,ends}) {
    await selectedTeam(teamOwner,'create');
    const sheet=teamOwner.getByRole('dialog');await sheet.waitFor();
    await sheet.getByLabel('Naam van de taak').fill(title);
    await sheet.getByLabel('Soort teamtaak').selectOption(fixtureId(711));
    await sheet.getByLabel(/^Begint op \(Europe\/Amsterdam\)$/).fill(starts);
    await sheet.getByLabel(/^Eindigt op \(Europe\/Amsterdam\)$/).fill(ends);
    await sheet.getByLabel('Aantal plaatsen').fill('2');
    await sheet.getByLabel('Herhalen').selectOption(String(repeat));
    await sheet.getByLabel('Praktische instructies').fill('Lees de voorbereiding en meld je bij de lokale PWA commissie.');
    await sheet.getByLabel('Verenigingsminuten aanvragen (optioneel)').fill(String(minutes));
    await sheet.getByRole('button',{name:'Publiceer op de teammarkt',exact:true}).click();
    await eventually(`select count(*) from app.team_tasks where team_id='${teamId}' and title='${title}';`,String(repeat));
    await sheet.waitFor({state:'hidden'});
  }

  setStage('native-team-series-and-zero-credit');
  const seriesTitle=`PWA browser teamserie ${run}`;
  await teamTask({title:seriesTitle,repeat:4,minutes:0,starts:'2027-03-20T09:00',ends:'2027-03-20T10:00'});
  assert.equal(sql(`select count(*) from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where s.title='${seriesTitle}';`),'8');
  assert.equal(sql(`select sum(credit_minutes) from app.team_tasks where title='${seriesTitle}';`),'0');
  assert.equal(sql(`select count(*) from app.shifts where title='${seriesTitle}' and (starts_at at time zone 'Europe/Amsterdam')::time='09:00';`),'4');
  checks.push('NATIVE_TEAM_SERIES_FOUR_WEEK_LOCAL_TIME_EIGHT_REAL_POSITIONS_ZERO_CREDIT');

  setStage('native-team-goals-and-real-distribution');
  const initialGoal=sql(`select goal from app.pwa_team_goals where team_id='${teamId}' and member_person_id is null;`);
  async function goal(value,member) {
    await selectedTeam(teamOwner,'goal');const sheet=teamOwner.getByRole('dialog');await sheet.waitFor();
    if(member)await sheet.getByLabel('Deze afspraak geldt voor').selectOption(member);
    await sheet.getByLabel('Aantal teamtaken per seizoen').fill(String(value));
    if(member)await sheet.getByLabel('Reden voor de persoonlijke afspraak').fill('Deze expliciete persoonlijke PWA testafspraak is met het lid afgestemd.');
    await sheet.getByRole('button',{name:'Doel opslaan',exact:true}).click();
    await eventually(`select goal from app.pwa_team_goals where team_id='${teamId}' and member_person_id ${member?`='${member}'`:'is null'};`,String(value));await sheet.waitFor({state:'hidden'});
  }
  await goal(0);await goal(Number(initialGoal));await goal(4,fixtureId(200));
  assert.equal(sql(`select count(*) from app.pwa_team_goals where team_id='${teamId}' and member_person_id='${fixtureId(200)}' and goal=4 and length(reason)>0;`),'1');
  await selectedTeam(teamOwner,'distribution');const distribution=teamOwner.getByRole('dialog');await distribution.waitFor();
  const cards=distribution.locator('.proposal-card');assert.ok(await cards.count()>=8);
  let chosen=0;
  for(const card of await cards.all()) {
    const ownSeries=(await card.getByRole('heading').textContent())===seriesTitle;
    const value=ownSeries&&chosen<2?fixtureId(200):'none';if(value!=='none')chosen++;
    await card.getByLabel('Lid voor deze plaats').selectOption(value);
  }
  assert.equal(chosen,2);assert.equal(await distribution.getByRole('button',{name:'Bevestig deze volledige verdeling',exact:true}).isDisabled(),true);
  await distribution.getByLabel('Ik heb de complete verdeling gecontroleerd.').check();
  await distribution.getByRole('button',{name:'Bevestig deze volledige verdeling',exact:true}).click();
  await eventually(`select count(*) from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where s.title='${seriesTitle}' and a.member_person_id='${fixtureId(200)}' and a.state='assigned';`,'2');
  await distribution.waitFor({state:'hidden'});
  assert.equal(sql(`select count(*) from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where s.title='${seriesTitle}' and a.member_person_id is null and a.state='reserved';`),'6');
  checks.push('NATIVE_ZERO_DEFAULT_GOAL_RESTORE_PERSONAL_HIGHER_REASON_REAL_PROPOSAL_TWO_ATOMIC_ASSIGNMENTS_SIX_LEFT_OPEN');
  await appPage(a,'tasks?tab=mine');
  const ownAssignedCards=a.locator('button.task-card').filter({hasText:seriesTitle});assert.equal(await ownAssignedCards.count(),2,'The two newly assigned own-child places remain visible in Mine.');
  for(const card of await ownAssignedCards.all())assert.ok((await card.textContent()).includes('Uitvoerder kiezen'));
  await ownAssignedCards.first().click();await a.getByRole('dialog').waitFor();
  const assignedId=new URL(a.url()).searchParams.get('allocation');assert.match(assignedId,/^[0-9a-f-]{36}$/);
  assert.equal(sql(`select count(*) from app.pwa_allocations a join app.household_person_links h on h.tenant_id=a.tenant_id and h.person_id=a.member_person_id where a.id='${assignedId}' and a.state='assigned' and h.household_id='${fixtureId(100)}' and h.starts_at<=statement_timestamp() and (h.ends_at is null or h.ends_at>statement_timestamp());`),'1');
  assert.equal(await a.getByRole('dialog').getByRole('button',{name:'Kies de uitvoerder',exact:true}).count(),1);await a.keyboard.press('Escape');await a.getByRole('dialog').waitFor({state:'hidden'});
  checks.push('NATIVE_NEW_ASSIGNED_OWN_CHILD_PLACES_STAY_IN_MINE_WITH_EXACT_ALLOCATION_EXECUTOR_ACTION');


  setStage('native-team-credit-review-before-publication');
  const creditTitle=`PWA browser vooraf beoordeeld ${run}`;
  await teamTask({title:creditTitle,repeat:1,minutes:75,starts:'2027-04-20T09:00',ends:'2027-04-20T10:15'});
  const requestId=sql(`select id from app.team_task_market_requests where title='${creditTitle}';`);
  assert.match(requestId,/^[a-f0-9-]{36}$/);
  assert.equal(sql(`select (market_shift_id is null)::text from app.team_task_market_requests where id='${requestId}';`),'true');
  await appPage(c,'manage?tab=requests');
  const credit=c.locator('.approval-card').filter({has:c.getByRole('heading',{name:creditTitle,exact:true})});
  assert.equal(await credit.getByRole('button',{name:'Goedgekeurde teamtaak publiceren',exact:true}).count(),0);
  await credit.getByLabel('Vrijwilligerscommissiebesluit').selectOption('approved');
  await credit.getByLabel('Goedgekeurde verenigingsminuten').fill('75');
  await credit.getByLabel('Reden voor het besluit').fill('De concrete voorbereiding en uitvoering zijn vooraf beoordeeld.');
  await credit.getByRole('button',{name:'Urenbesluit vastleggen',exact:true}).click();
  await credit.getByRole('button',{name:'Goedgekeurde teamtaak publiceren',exact:true}).waitFor();
  await credit.getByLabel('Ik heb de beoordelingen gecontroleerd en publiceer deze concrete afspraak.').check();
  await credit.getByRole('button',{name:'Goedgekeurde teamtaak publiceren',exact:true}).click();
  await eventually(`select (market_shift_id is not null)::text from app.team_task_market_requests where id='${requestId}';`,'true');
  assert.equal(sql(`select s.credit_minutes from app.shifts s join app.team_task_market_requests r on r.tenant_id=s.tenant_id and r.market_shift_id=s.id where r.id='${requestId}';`),'75');
  assert.equal(sql(`select t.credit_minutes from app.team_tasks t join app.team_task_market_requests r on r.tenant_id=t.tenant_id and r.team_task_id=t.id where r.id='${requestId}';`),'0');
  checks.push('NATIVE_POSITIVE_TEAM_CREDIT_UNBOOKABLE_UNTIL_REVIEW_AND_EXPLICIT_PUBLICATION_SOURCE_ZERO');

  async function clubTask(mode,offset) {
    const title=`PWA browser club ${mode} ${run}`;
    await appPage(c,'manage?view=create');
    const sheet=c.getByRole('dialog');await sheet.waitFor();
    await sheet.getByLabel('Verdelingswijze').selectOption(mode);
    if(mode!=='public')await sheet.getByLabel('Ontvangend team').selectOption(teamId);
    await sheet.getByLabel('Taaknaam').fill(title);
    await sheet.getByLabel('Categorie').selectOption(fixtureId(721));
    await sheet.getByLabel(/^Begint op \(Europe\/Amsterdam\)$/).fill(`${clubDate(offset)}T10:00`);
    await sheet.getByLabel(/^Eindigt op \(Europe\/Amsterdam\)$/).fill(`${clubDate(offset)}T12:00`);
    await sheet.getByLabel('Aantal plaatsen').fill('2');
    await sheet.getByLabel('Praktische instructies').fill('Deze echte plaatsen hebben concrete voorbereiding en actuele toelatingsvoorwaarden.');
    if(mode!=='public') {
      await sheet.getByLabel(/^Zelf inschrijven tot \(Europe\/Amsterdam\)$/).fill(`${clubDate(offset)}T08:00`);
      await sheet.getByLabel(/^Teamouder verdeelt tot \(Europe\/Amsterdam\)$/).fill(`${clubDate(offset)}T09:00`);
    }
    await sheet.getByRole('button',{name:mode==='public'?'Publiceer op de verenigingsmarkt':'Publiceer en reserveer deze teamplaatsen',exact:true}).click();
    await eventually(`select count(*) from app.shifts where title='${title}' and state='published';`,'1');
    await sheet.waitFor({state:'hidden'});
    assert.equal(sql(`select count(*) from app.shift_positions p join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where s.title='${title}';`),'2');
    assert.equal(sql(`select count(*) from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where s.title='${title}';`),mode==='public'?'0':'2');
    if(mode!=='public')assert.equal(sql(`select distinct x.mode from app.pwa_clusters x join app.pwa_allocations a on a.tenant_id=x.tenant_id and a.cluster_id=x.id join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id join app.shifts s on s.tenant_id=p.tenant_id and s.id=p.shift_id where s.title='${title}';`),mode);
    return title;
  }
  setStage('native-club-task-atomic-distribution-modes');
  const publicTitle=await clubTask('public',0);await clubTask('self',1);await clubTask('assign',2);
  checks.push('NATIVE_CLUB_CREATION_PUBLIC_SELF_ASSIGN_ATOMIC_NATIVE_POSITIONS_AND_TEAM_RESERVATIONS');

  setStage('native-cluster-real-team-proposal-confirmation');
  await appPage(c,'manage?view=cluster');
  const cluster=c.getByRole('dialog');await cluster.waitFor();
  await cluster.getByLabel(new RegExp(`${publicTitle} · plek 1`)).check();
  await cluster.getByRole('button',{name:'Bekijk het teamvoorstel',exact:true}).click();
  await cluster.getByRole('heading',{name:'2. Controleer het voorstel en kies een team',exact:true}).waitFor();
  const actualTeam=cluster.locator('.radio-card').filter({hasText:'PWA lokaal team'});
  assert.ok((await actualTeam.textContent()).includes('passende leden'));
  await actualTeam.getByRole('radio').check();
  const clusterTitle=`PWA browser gecontroleerd cluster ${run}`;
  await cluster.getByLabel('Naam van het cluster').fill(clusterTitle);
  await cluster.getByLabel('Verdelingswijze').selectOption('self');
  await cluster.getByLabel(/^Zelf inschrijven tot \(Europe\/Amsterdam\)$/).fill(`${publicDate}T08:00`);
  await cluster.getByLabel(/^Teamouder verdeelt tot \(Europe\/Amsterdam\)$/).fill(`${publicDate}T09:00`);
  await cluster.getByRole('button',{name:'Wijs dit cluster toe aan het team',exact:true}).click();
  await eventually(`select count(*) from app.pwa_clusters where title='${clusterTitle}' and team_id='${teamId}';`,'1');
  assert.equal(sql(`select count(*) from app.pwa_allocations a join app.pwa_clusters x on x.tenant_id=a.tenant_id and x.id=a.cluster_id where x.title='${clusterTitle}';`),'1');
  checks.push('NATIVE_CLUSTER_CONCRETE_POSITION_REAL_TEAM_FACTS_EXPLICIT_SELECTION_AND_RESERVATION');

  setStage('native-new-public-booking-returns-to-mine');
  const publicShift=sql(`select id from app.shifts where title='${publicTitle}';`);
  await appPage(a,`tasks?task=${publicShift}`);
  await a.getByRole('dialog').waitFor();
  await a.getByRole('button',{name:'Ik help mee',exact:true}).click();
  await a.getByLabel('Ik heb de instructies gelezen.').check();
  await a.getByLabel('Ik ga akkoord met de afmeldafspraak.').check();
  await a.getByRole('button',{name:'Inschrijving bevestigen',exact:true}).click();
  await eventually(`select count(*) from app.bookings b join app.shift_positions p on p.tenant_id=b.tenant_id and p.id=b.position_id where p.shift_id='${publicShift}' and b.executor_person_id='a1000000-0000-4000-8000-000000000001' and b.state='booked';`,'1');
  await a.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(new URL(a.url()).searchParams.get('tab'),'mine');
  assert.equal(await a.locator('.mobile-segments').getByRole('button',{name:'Mijn taken',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await a.locator('button.task-card').filter({hasText:publicTitle}).count(),1,'Only the own booked place appears in Mine; the other unassigned reserved place remains a team-market offer.');
  assert.ok((await a.locator('button.task-card').filter({hasText:publicTitle}).textContent()).includes('Ingepland'));
  await a.locator('.mobile-segments').getByRole('button',{name:'Ontdekken',exact:true}).click();
  await a.getByLabel('Zoek een taak').waitFor();
  await a.goBack();
  await a.locator('.mobile-segments').getByRole('button',{name:'Mijn taken',exact:true}).waitFor();
  assert.equal(await a.locator('.mobile-segments').getByRole('button',{name:'Mijn taken',exact:true}).getAttribute('aria-pressed'),'true');
  checks.push('NATIVE_CONFIRMED_PUBLIC_BOOKING_URL_AND_VISIBLE_MINE_TAB_NATIVE_BACK');
  const reservedId=sql(`select a.id from app.pwa_allocations a join app.shift_positions p on p.tenant_id=a.tenant_id and p.id=a.position_id where p.shift_id='${publicShift}' and p.ordinal=1 and a.member_person_id is null and a.state='reserved';`);
  assert.match(reservedId,/^[0-9a-f-]{36}$/);
  await a.locator('.mobile-segments').getByRole('button',{name:'Ontdekken',exact:true}).click();await a.getByLabel('Zoek een taak').waitFor();
  await a.locator('.scope-chips').getByRole('button',{name:'PWA lokaal team',exact:true}).click();
  const teamOffer=a.locator('button.task-card').filter({hasText:publicTitle});assert.equal(await teamOffer.count(),1);assert.ok((await teamOffer.textContent()).includes('1 teamplaats vrij'));
  await teamOffer.click();await a.getByRole('dialog').waitFor();assert.equal(new URL(a.url()).searchParams.get('allocation'),reservedId);assert.equal(await a.getByRole('dialog').getByRole('button',{name:'Ik help mee',exact:true}).count(),1);
  await a.keyboard.press('Escape');await a.getByRole('dialog').waitFor({state:'hidden'});
  await appPage(a,`teams?team=${teamId}&tab=tasks`);const teamTaskOffer=a.locator('button.task-card').filter({hasText:publicTitle});assert.equal(await teamTaskOffer.count(),1);await teamTaskOffer.click();await a.getByRole('dialog').waitFor();assert.equal(new URL(a.url()).searchParams.get('allocation'),reservedId);
  assert.equal(sql(`select count(*) from app.pwa_allocations where id='${reservedId}' and member_person_id is null and state='reserved';`),'1','Viewing the unassigned offer does not assign or book it.');
  checks.push('NATIVE_MINE_ONLY_OWN_BOOKING_UNASSIGNED_TEAM_PLACE_DISCOVER_AND_TEAM_ALLOCATION_CONTEXT_PRESERVED');


  setStage('native-policy-self-and-guardian-exact-version');
  const policyIds=`'${fixtureId(1403)}','${fixtureId(1404)}'`;
  const policyRows=()=>JSON.parse(sql(`select json_agg(json_build_object('id',id,'version',version,'state',state,'opened',opened_at is not null) order by id) from app.policy_assignments where id in (${policyIds});`));
  const policyBefore=policyRows();
  const beforeReadonly=JSON.stringify(policyRows());await appPage(c,'policies');await c.locator('button.document-card').filter({hasText:'PWA lokale clubafspraken'}).click();await c.getByRole('dialog').waitFor();
  assert.ok((await c.getByRole('dialog').locator('.policy-text').textContent()).includes('PWA lokale afspraken: kies een concrete taak en volg de instructies.'));assert.equal(await c.getByRole('dialog').locator('fieldset').count(),0);assert.equal(await c.getByRole('dialog').getByRole('button',{name:'Akkoord vastleggen',exact:true}).count(),0);
  assert.ok((await c.getByRole('dialog').textContent()).includes('Voor jouw huidige bevoegdheid is er geen akkoord vast te leggen.'));
  assert.equal(JSON.stringify(policyRows()),beforeReadonly,'A real policy.follow_up viewer reads the exact body without recording another person opening or acceptance.');
  assert.equal(sql(`select count(*) from app.policy_assignment_events where assignment_id in (${policyIds}) and actor_person_id='a1000000-0000-4000-8000-000000000003';`),'0');
  checks.push('NATIVE_POLICY_FOLLOW_UP_READONLY_EXACT_BODY_NO_FORM_NO_OPEN_OR_ACCEPTANCE_MUTATION');
  const policyVersionId=sql(`select policy_version_id from app.policy_assignments where id='${fixtureId(1403)}';`);
  const directBefore=JSON.stringify(policyRows());const directEvents=sql(`select count(*) from app.policy_assignment_events where assignment_id in (${policyIds});`);
  await appPage(a,`policies?view=${policyVersionId}`);const directPolicy=a.getByRole('dialog');await directPolicy.waitFor();
  assert.ok((await directPolicy.locator('.policy-text').textContent()).includes('PWA lokale afspraken: kies een concrete taak en volg de instructies.'));
  assert.ok((await directPolicy.textContent()).includes('Versie 1'));
  if(policyBefore.some((item)=>item.state==='offered')) {
    assert.equal(await directPolicy.getByRole('button',{name:'Document openen',exact:true}).count(),1,'An offered typed policy link has an explicit opening action.');
    assert.equal(await directPolicy.getByLabel('Ik heb de afspraken gelezen en ga akkoord met deze versie.').isDisabled(),true);
    assert.equal(await directPolicy.getByRole('button',{name:'Akkoord vastleggen',exact:true}).isDisabled(),true);
  }
  assert.equal(JSON.stringify(policyRows()),directBefore,'A typed policy GET does not record opening or acceptance.');
  assert.equal(sql(`select count(*) from app.policy_assignment_events where assignment_id in (${policyIds});`),directEvents);
  await a.keyboard.press('Escape');await directPolicy.waitFor({state:'hidden'});
  checks.push(policyBefore.some((item)=>item.state==='offered')?'NATIVE_OFFERED_POLICY_TYPED_DEEPLINK_EXPLICIT_OPEN_CONTROL_ACK_DISABLED_NO_GET_MUTATION':'NATIVE_PREVIOUS_POLICY_TYPED_DEEPLINK_EXACT_BODY_NO_GET_MUTATION');
  let checkedOpening=false;
  for(const [capacity,assignment] of [['self',1403],['guardian',1404]]) {
    await appPage(a,'policies');
    await a.locator('button.document-card').filter({hasText:'PWA lokale clubafspraken'}).click();
    const sheet=a.getByRole('dialog');await sheet.waitFor();
    assert.ok((await sheet.locator('.policy-text').textContent()).includes('PWA lokale afspraken: kies een concrete taak en volg de instructies.'));
    assert.ok((await sheet.textContent()).includes('Versie 1'),'The displayed immutable revision remains1, independent of assignment versions.');
    if(!checkedOpening) {
      const current=policyRows();for(const before of policyBefore) {const row=current.find((item)=>item.id===before.id);assert.ok(row.opened);if(before.state==='offered'){assert.equal(row.state,'opened');assert.equal(row.version,before.version+1);}}
      assert.equal(sql(`select count(*) from app.policy_acceptances where assignment_id in (${policyIds});`),String(policyBefore.filter((item)=>item.state==='accepted').length),'Opening the exact body creates no acceptance.');
      assert.equal(sql(`select count(*) from app.policy_assignment_events where assignment_id in (${policyIds}) and event_type='opened' and actor_person_id='a1000000-0000-4000-8000-000000000001';`),'2','Exactly one real actor-bound opening event exists per actionable assignment.');
      checkedOpening=true;checks.push(policyBefore.some((item)=>item.state==='offered')?'NATIVE_POLICY_CARD_EXPLICIT_OPEN_TWO_CURRENT_ASSIGNMENTS_NO_ACCEPTANCE_EXACT_REVISION':'NATIVE_PREVIOUS_POLICY_OPEN_EVENTS_EXACT_REVISION_READBACK');
    }

    if(sql(`select count(*) from app.policy_acceptances where assignment_id='${fixtureId(assignment)}';`)==='0') {
      await sheet.getByLabel('In welke hoedanigheid geef je akkoord?').selectOption(capacity);
      await sheet.locator('fieldset .check-row input').first().check();
      await sheet.getByLabel('Ik heb de afspraken gelezen en ga akkoord met deze versie.').check();
      await sheet.getByRole('button',{name:'Akkoord vastleggen',exact:true}).click();
      await eventually(`select capacity from app.policy_acceptances where assignment_id='${fixtureId(assignment)}';`,capacity);
    }
    assert.equal(sql(`select count(*) from app.policy_acceptances where assignment_id='${fixtureId(assignment)}' and explicit_confirmation and actor_person_id='a1000000-0000-4000-8000-000000000001';`),'1');
  }
  checks.push('NATIVE_POLICY_EXACT_BODY_EXPLICIT_SELF_AND_VERIFIED_GUARDIAN_IMMUTABLE_ACCEPTANCES');
  const acceptedBefore=JSON.stringify(policyRows());await appPage(a,'policies');await a.locator('button.document-card').filter({hasText:'PWA lokale clubafspraken'}).click();await a.getByRole('dialog').waitFor();
  assert.equal(await a.getByRole('dialog').getByRole('button',{name:'Akkoord vastleggen',exact:true}).count(),0);assert.equal(await a.getByRole('dialog').locator('fieldset').count(),0);assert.ok((await a.getByRole('dialog').textContent()).includes('Je akkoord met deze exacte versie is vastgelegd.'));
  assert.equal(JSON.stringify(policyRows()),acceptedBefore,'Reading the accepted exact version again does not mutate assignments or acceptances.');
  assert.equal(sql(`select count(*) from app.policy_acceptances where assignment_id in (${policyIds});`),'2');
  checks.push('NATIVE_ACCEPTED_POLICY_BODY_READONLY_REOPEN_NO_NEW_ASSIGNMENT_OR_ACCEPTANCE');


  setStage('native-handover-draft-ready-exact-successor-acceptance');
  if(teamOwner===c) {
    await selectedTeam(c,'handover');const sheet=c.getByRole('dialog');await sheet.waitFor();
    await sheet.getByLabel('Nieuwe teamouder').selectOption('a1000000-0000-4000-8000-000000000001');
    const note=`PWA browser exact gecontroleerde overdracht ${run}`;
    await sheet.getByLabel('Overdrachtsnotitie').fill(note);
    await sheet.getByLabel('Open taken gecontroleerd').uncheck();
    assert.equal(await sheet.getByRole('button',{name:'Overdracht klaarzetten',exact:true}).isDisabled(),true,'An incomplete checklist cannot be prepared.');
    await sheet.getByRole('button',{name:'Concept bewaren',exact:true}).click();
    await eventually(`select count(*) from app.pwa_handovers where team_id='${teamId}' and note='${note}' and state='draft';`,'1');
    await selectedTeam(a,'handover');const draftForSuccessor=a.getByRole('dialog');await draftForSuccessor.waitFor();
    assert.equal(await draftForSuccessor.getByRole('button',{name:'Ik neem het team over',exact:true}).count(),0,'A draft grants no successor acceptance action.');
    assert.ok((await draftForSuccessor.textContent()).includes(note),'The named successor can read only the actual shared handover note.');
    assert.ok((await draftForSuccessor.textContent()).includes('Deze overdracht is nog een concept.'));
    assert.equal(await draftForSuccessor.locator('.checklist>div').count(),5);
    await a.keyboard.press('Escape');await draftForSuccessor.waitFor({state:'hidden'});
    await sheet.getByLabel('Open taken gecontroleerd').check();
    for(const label of ['Belangrijke afspraken vastgelegd','Contacten gecontroleerd','Seizoensdoelen gecontroleerd','Open opvolging doorgenomen'])await sheet.getByLabel(label,{exact:true}).check();
    await sheet.getByRole('button',{name:'Overdracht klaarzetten',exact:true}).click();
    await eventually(`select count(*) from app.pwa_handovers where team_id='${teamId}' and note='${note}' and state='ready';`,'1');
    const readyId=sql(`select id from app.pwa_handovers where team_id='${teamId}' and note='${note}' and state='ready';`);
    await appPage(a,'notifications');await a.getByRole('button',{name:'Alles',exact:true}).click();
    const notification=a.locator('.notification-list article').filter({has:a.getByText('Teamoverdracht klaar',{exact:true})});assert.equal(await notification.count(),1);
    if(await notification.locator('button.notification-open').count())await notification.locator('button.notification-open').click();else await notification.getByRole('link').click();
    await a.waitForURL((url)=>url.pathname.endsWith('/teams')&&url.searchParams.get('team')===teamId&&url.searchParams.get('handover')===readyId);
    assert.equal(new URL(a.url()).searchParams.get('tab'),'organize');assert.equal(new URL(a.url()).searchParams.get('view'),'handover');
    const successor=a.getByRole('dialog');await successor.waitFor();
    assert.ok((await successor.textContent()).includes(note));
    await successor.getByLabel('Ik neem deze overdracht aan.').check();
    await successor.getByRole('button',{name:'Ik neem het team over',exact:true}).click();
    await eventually(`select count(*) from app.pwa_handovers where team_id='${teamId}' and note='${note}' and state='accepted';`,'1');
    await selectedTeam(a);assert.equal(await a.getByRole('button',{name:'Een teamtaak maken',exact:false}).count(),1);
    await selectedTeam(c);assert.equal(await c.getByRole('button',{name:'Een teamtaak maken',exact:false}).count(),0);
    await appPage(a,`teams?team=${teamId}&handover=${readyId}`);await a.getByRole('dialog').waitFor();
    assert.ok((await a.getByRole('dialog').textContent()).includes(note));assert.ok((await a.getByRole('dialog').textContent()).includes('Deze overdracht is aangenomen.'));
    assert.equal(await a.getByRole('dialog').getByRole('button',{name:'Ik neem het team over',exact:true}).count(),0);
    await appPage(a,`teams?team=${teamId}&handover=${fixtureId(100)}`);await a.getByRole('dialog').waitFor();
    await a.getByRole('dialog').getByRole('heading',{name:'Deze overdracht is niet beschikbaar',exact:true}).waitFor();assert.ok(!(await a.getByRole('dialog').textContent()).includes(note));
    checks.push('NATIVE_HANDOVER_INBOX_EXACT_READY_ID_ACCEPTED_HISTORY_READONLY_UNKNOWN_ID_NO_CURRENT_FALLBACK');
    checks.push('NATIVE_HANDOVER_DRAFT_BLOCKS_ACCEPTANCE_FIVE_CHECKS_EXACT_VERSION_NAMED_SUCCESSOR_AUTHORITY');
  } else checks.push('NATIVE_PREVIOUS_HANDOVER_READBACK_ACTIVE_SUCCESSOR_SCOPE_PRESERVED');
  assert.equal(sql("select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"),ledgerBefore);
  checks.push('NATIVE_TEAM_PLANNING_APPROVAL_POLICY_AND_HANDOVER_DO_NOT_AWARD_ATTENDANCE_MINUTES');

  setStage('native-atomic-attendance-partial-and-acknowledged-no-show');
  assert.equal(sql(`select count(*) from app.bookings where id='${fixtureId(905)}';`),'1','The additive second historical booking is present.');
  const executionStates=()=>sql(`select string_agg(state,',' order by id) from app.bookings where id in ('${fixtureId(904)}','${fixtureId(905)}');`);
  const freshAttendance=executionStates()!=='confirmed,no_show';
  if(freshAttendance) {
    assert.equal(executionStates(),'booked,booked','Both untouched canonical executions are ready for the real atomic batch.');
    await appPage(c,'manage?tab=confirm');
    const noShowTitle=sql(`select title from app.shifts where id='${fixtureId(805)}';`);
    const partial=c.locator('.confirmation-card').filter({hasText:'PWA uitvoering controleren'});
    const noShow=c.locator('.confirmation-card').filter({hasText:noShowTitle});
    await partial.getByRole('checkbox').first().check();
    await partial.getByLabel('Uitvoering na controle').selectOption('partial');
    await partial.getByLabel('Bevestigde minuten').fill('75');
    await partial.getByLabel('Reden voor de gedeeltelijke uitvoering').fill('De gecontroleerde uitvoering duurde 75 minuten.');
    await noShow.getByRole('checkbox').first().check();
    await noShow.getByLabel('Uitvoering na controle').selectOption('no_show');
    assert.equal(await c.getByRole('button',{name:'Bevestig 2 gecontroleerde afspraken',exact:true}).isDisabled(),true);
    await noShow.getByLabel('Ik heb gecontroleerd dat deze afspraak niet is uitgevoerd. Er worden geen minuten of teamafronding toegekend.').check();
    await c.getByLabel('Ik heb iedere geselecteerde uitvoering en de minuten gecontroleerd.').check();
    await c.getByRole('button',{name:'Bevestig 2 gecontroleerde afspraken',exact:true}).click();
    await eventually(`select string_agg(state,',' order by id) from app.bookings where id in ('${fixtureId(904)}','${fixtureId(905)}');`,'confirmed,no_show');
    await c.locator('.notice[role=status]').filter({hasText:'Opgeslagen en bevestigd door je vereniging.'}).waitFor();
  }
  assert.equal(sql(`select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where booking_id='${fixtureId(904)}';`),'75');
  assert.equal(sql(`select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where booking_id='${fixtureId(905)}';`),'0');
  assert.equal(sql(`select credit_minutes_snapshot from app.bookings where id='${fixtureId(904)}';`),'120');
  await appPage(a,'household');
  assert.equal(await a.locator('.meter-figure strong').textContent(),'3,25');
  const partialHistory=a.locator('.history-entry').filter({hasText:'PWA uitvoering controleren'});
  assert.ok((await partialHistory.textContent()).includes('75 minuten'));
  checks.push(freshAttendance?'NATIVE_ATOMIC_TWO_EXECUTIONS_PARTIAL_REASON_EXPLICIT_NO_SHOW_ACK_ONE75_MINUTE_LEDGER_POST_BOOKING_SNAPSHOT_UNCHANGED':'NATIVE_PREVIOUS_ATOMIC_ATTENDANCE_CANONICAL_STATE75_MINUTES_HISTORY_SNAPSHOT_READBACK');
}

export async function runMobileReadFlows({a,c,sql,appPage,fixtureId,checks,setStage}) {
  const beforeLedger=sql("select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';");
  setStage('native-search-navigation-and-context');
  await appPage(a,'home');
  await a.getByRole('button',{name:'Zoeken in Cluvo',exact:true}).click();
  const search=a.getByRole('dialog');await search.waitFor();
  await search.getByLabel('Waar zoek je naar?').fill('Mijn profiel');
  assert.equal(await search.locator('.mobile-search-results').getByRole('link').count(),1);
  await search.getByRole('link',{name:'Mijn profiel',exact:true}).click();
  await a.waitForURL('**/profile?household=*');await search.waitFor({state:'hidden'});
  assert.equal(new URL(a.url()).searchParams.get('household'),fixtureId(100));
  await a.locator('.app-header').getByRole('link',{name:/^Meldingen/}).click();await a.waitForURL('**/notifications?household=*');
  await a.getByRole('button',{name:'Alles',exact:true}).click();assert.ok(await a.locator('.mobile-segments button[aria-pressed="true"]').filter({hasText:'Alles'}).isVisible());
  await a.getByRole('button',{name:'Ongelezen',exact:true}).click();
  await a.locator('.app-header').getByRole('link',{name:'Mijn profiel',exact:true}).click();await a.waitForURL('**/profile?household=*');
  await appPage(a,'more');assert.ok(await a.locator('#mobile-club-choice').isVisible());
  assert.ok((await a.locator('.more-club').textContent()).includes('Seizoen'));
  await a.locator('.profile-card').click();await a.waitForURL('**/profile?household=*');
  assert.equal(await a.getByRole('button',{name:/Demorol|Offline proberen|Demo herstellen/}).count(),0);
  checks.push('NATIVE_SEARCH_RESULT_SINGLE_NAVIGATION_HEADER_LINKS_MORE_PROFILE_CONTEXT_AND_DEMO_ABSENCE');

  setStage('native-task-search-filter-and-history');await appPage(a,'tasks');
  await a.getByLabel('Zoek een taak').fill('PWA impossible no task');
  await a.getByRole('heading',{name:'Geen taken gevonden',exact:true}).waitFor();
  await a.getByRole('button',{name:'Filters wissen',exact:true}).click();assert.equal(await a.getByLabel('Zoek een taak').inputValue(),'');
  await a.getByRole('button',{name:'Taken filteren',exact:true}).click();const filter=a.getByRole('dialog');
  await filter.getByLabel('Maximaal 2 uur taakduur').check();
  await filter.getByLabel('Er is een geschikte uitvoerder in ons huishouden').check();
  await filter.getByRole('button',{name:'Toon taken',exact:true}).click();await filter.waitFor({state:'hidden'});
  assert.ok((await a.locator('.results-line').textContent()).includes('taken in deze selectie'));
  await a.getByRole('button',{name:'Mijn taken',exact:true}).click();await a.waitForURL((url)=>url.searchParams.get('tab')==='mine');assert.equal(new URL(a.url()).searchParams.get('tab'),'mine');
  await a.getByRole('button',{name:'Afgerond & historie',exact:true}).click();assert.ok(await a.getByRole('button',{name:'Actueel',exact:true}).isVisible());
  await a.getByRole('button',{name:'Overnemen',exact:true}).click();await a.waitForURL((url)=>url.searchParams.get('tab')==='takeovers');assert.equal(new URL(a.url()).searchParams.get('tab'),'takeovers');
  checks.push('NATIVE_TASK_SEARCH_EMPTY_FILTER_SELECTION_CLEAR_URL_TABS_AND_HISTORY');

  setStage('native-calendar-controls-and-private-ics');await appPage(a,'agenda');
  const week=await a.locator('.week-control b').textContent();await a.getByRole('button',{name:'Volgende',exact:true}).click();assert.notEqual(await a.locator('.week-control b').textContent(),week);
  await a.getByRole('button',{name:'Vorige',exact:true}).click();assert.equal(await a.locator('.week-control b').textContent(),week);
  const day=a.locator('.week-strip button').first();await day.click();assert.equal(await day.getAttribute('aria-pressed'),'true');
  await day.click();assert.equal(await day.getAttribute('aria-pressed'),'false');
  await a.getByRole('button',{name:'Wedstrijden',exact:true}).click();assert.equal(await a.locator('.agenda-row.task,.agenda-row.assignment').count(),0);
  await a.getByLabel('Bekijk afspraken van').selectOption('a1000000-0000-4000-8000-000000000001');
  if(await a.getByRole('button',{name:'Toon de hele week',exact:true}).count())await a.getByRole('button',{name:'Toon de hele week',exact:true}).click();
  assert.equal(await a.getByLabel('Bekijk afspraken van').inputValue(),'all');
  const icsHref=await a.getByRole('link',{name:'Gezinsagenda downloaden',exact:true}).getAttribute('href');
  const ics=await a.context().request.get(new URL(icsHref,a.url()).href);assert.equal(ics.status(),200);assert.ok(ics.headers()['cache-control'].includes('no-store'));
  const icsBody=await ics.text();assert.ok(icsBody.startsWith('BEGIN:VCALENDAR\r\n'));assert.ok(icsBody.includes('UID:'));assert.ok(!icsBody.includes('PWA_LOCAL_LOST_RESPONSE'));
  checks.push('NATIVE_CALENDAR_WEEK_DAY_LAYERS_PERSON_RESET_AND_AUTHORIZED_PRIVATE_ICS');

  setStage('native-faq-question-subject-and-install-help');await appPage(a,'help');
  const faq=a.locator('.faq details').first();await faq.locator('summary').click();assert.ok(await faq.locator('p').isVisible());
  await a.getByLabel('Onderwerp').selectOption('Geen passende taak');assert.equal(await a.getByLabel('Onderwerp').inputValue(),'Geen passende taak');
  await appPage(a,'install');const install=a.getByRole('button',{name:'Cluvo op je beginscherm',exact:true});
  if(await install.count()){await install.click();await a.locator('.install-card .cluvo-pwa-install-help').waitFor();assert.ok(await a.locator('.install-card .cluvo-pwa-install-help').isVisible());}
  else assert.ok(await a.getByRole('button',{name:'Cluvo installeren',exact:true}).isVisible());
  checks.push('NATIVE_FAQ_SUBJECT_SELECTION_HONEST_BROWSER_INSTALL_HELP_NO_FAKE_INSTALL');

  setStage('native-reports-export-authorization');await appPage(c,'reports');
  if(!await c.locator('.report-stats>div').count()) {
    await c.getByRole('heading',{name:'Geen toegang tot dit overzicht',exact:true}).waitFor();
    const href=new URL('/app/c/club-a/reports/export',c.url()).href;
    assert.equal((await c.context().request.get(href)).status(),403);assert.equal((await a.context().request.get(href)).status(),403);
    assert.equal(sql("select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"),beforeLedger);
    checks.push('NATIVE_REPORT_PAGE_AND_CSV_DENIED_WITHOUT_REPORT_CAPABILITY_NO_LEDGER_CHANGE');return;
  }
  assert.equal(await c.locator('.report-stats>div').count(),3);
  const csvHref=await c.getByRole('link',{name:'Huishoudoverzicht als CSV downloaden',exact:true}).getAttribute('href');
  const csv=await c.context().request.get(new URL(csvHref,c.url()).href);assert.equal(csv.status(),200);assert.ok(csv.headers()['cache-control'].includes('no-store'));
  const csvBody=await csv.text();assert.ok(csvBody.includes('"Doel minuten"'));assert.ok(csvBody.includes('"Winterdoel minuten"'));assert.ok(!csvBody.includes('PWA_LOCAL_LOST_RESPONSE'));
  const denied=await a.context().request.get(new URL(csvHref,c.url()).href);assert.equal(denied.status(),403);
  assert.equal(sql("select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';"),beforeLedger);
  checks.push('NATIVE_REPORT_TOTALS_REAL_MINUTE_CSV_UNAUTHORIZED_PARENT_DENIED_READ_CONTROLS_NO_LEDGER_MUTATION');
}
