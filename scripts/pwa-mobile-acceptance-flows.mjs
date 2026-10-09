import assert from 'node:assert/strict';

// Local synthetic native users only. Mutations use the rendered app; SQL is
// readback. This supplements, and never overwrites, the earlier browser proof.
export async function runMobileAcceptanceFlows({a,b,c,sql,appPage,eventually,fixtureId,checks,setStage,capture}) {
  const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const personA='a1000000-0000-4000-8000-000000000001';
  const personB='a1000000-0000-4000-8000-000000000002';
  const run=String(Date.now()),cases=[];
  const ledger=()=>sql(`select coalesce(sum(minutes_delta),0) from app.hour_ledger_entries where tenant_id='${tenant}';`);
  const ledgerBefore=ledger();
  const pass=(id,functionIds,description)=>{checks.push(id);cases.push({id,functionIds,description,passed:true,environment:'local',staging_verified:false});};
  const publicDate=sql(`select greatest(date '2027-02-10',coalesce((select max((s.starts_at at time zone 'Europe/Amsterdam')::date)+7 from app.shifts s where tenant_id='${tenant}'and title like 'PWA browser acceptatie %'),date '2027-02-10'),coalesce((select max((x.starts_at_snapshot at time zone 'Europe/Amsterdam')::date)+7 from app.bookings x where tenant_id='${tenant}'and executor_person_id in('${personA}','${personB}')and state in('booked','transfer_pending','reconfirmation_required','performed_pending','confirmed')),date '2027-02-10'));`);
  assert.match(publicDate,/^\d{4}-\d{2}-\d{2}$/);
  const matchId=sql(`select id from app.matches where tenant_id='${tenant}'and connection_id='${fixtureId(1921)}'and source_id='pwa-local-read-context-${publicDate}';`);
  assert.match(matchId,/^[0-9a-f-]{36}$/,'This run needs its exact fresh additive overlap source.');
  const date=(offset)=>{const value=new Date(`${publicDate}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10);};
  assert.equal(sql(`select count(*) from app.seasons s join app.obligations o on o.tenant_id=s.tenant_id and o.season_id=s.id where o.id='${fixtureId(600)}' and s.starts_on<=date '${publicDate}' and s.ends_on>=date '${date(2)}';`),'1');
  async function createPublic(offset) {
    const title=`PWA browser acceptatie ${run} ${offset}`;
    await appPage(c,'manage?view=create');const sheet=c.getByRole('dialog');await sheet.waitFor();
    await sheet.getByLabel('Verdelingswijze').selectOption('public');
    await sheet.getByLabel('Taaknaam').fill(title);
    await sheet.getByLabel('Categorie').selectOption(fixtureId(721));
    await sheet.getByLabel(/^Begint op \(Europe\/Amsterdam\)$/).fill(`${date(offset)}T10:00`);
    await sheet.getByLabel(/^Eindigt op \(Europe\/Amsterdam\)$/).fill(`${date(offset)}T12:00`);
    await sheet.getByLabel('Aantal plaatsen').fill('1');
    await sheet.getByLabel('Praktische instructies').fill('Meld je bij de synthetische PWA commissie en lees de voorbereiding.');
    await sheet.getByRole('button',{name:'Publiceer op de verenigingsmarkt',exact:true}).click();
    await eventually(`select count(*) from app.shifts where tenant_id='${tenant}' and title='${title}' and state='published';`,'1');
    await sheet.waitFor({state:'hidden'});
    const shift=sql(`select id from app.shifts where tenant_id='${tenant}' and title='${title}';`);
    assert.match(shift,/^[0-9a-f-]{36}$/);
    assert.equal(sql(`select count(*) from app.shift_positions where tenant_id='${tenant}' and shift_id='${shift}';`),'1');
    return {shift,title,offset};
  }
  async function open(page,shift,booking) {
    await appPage(page,`tasks?task=${shift}${booking?`&booking=${booking}`:''}`);
    const sheet=page.getByRole('dialog');await sheet.waitFor();return sheet;
  }
  async function book(page,task,person) {
    const sheet=await open(page,task.shift);
    if(page===a&&task.offset===0) {
      await sheet.getByText(/Er staat ook een gezinswedstrijd rond dit moment:/).waitFor();
      assert.equal(await sheet.getByRole('button',{name:'Ik help mee',exact:true}).isEnabled(),true);
    }
    await sheet.getByRole('button',{name:'Ik help mee',exact:true}).click();
    await sheet.getByLabel('Uit jouw huishouden').selectOption(person);
    await sheet.getByLabel('Ik heb de instructies gelezen.').check();
    await sheet.getByLabel('Ik ga akkoord met de afmeldafspraak.').check();
    await sheet.getByRole('button',{name:'Inschrijving bevestigen',exact:true}).click();
    await eventually(`select count(*) from app.bookings x join app.shift_positions p on p.tenant_id=x.tenant_id and p.id=x.position_id where x.tenant_id='${tenant}' and p.shift_id='${task.shift}' and x.executor_person_id='${person}' and x.state='booked';`,'1');
    await sheet.waitFor({state:'hidden'});
    return sql(`select x.id from app.bookings x join app.shift_positions p on p.tenant_id=x.tenant_id and p.id=x.position_id where x.tenant_id='${tenant}' and p.shift_id='${task.shift}' and x.executor_person_id='${person}' and x.state='booked';`);
  }

  cases.push(...await runMobileReadContextFlows({a,b,c,sql,appPage,fixtureId,checks,setStage,capture,matchId}));

  setStage('native-full-public-waitlist-and-deadline-cancellation');
  const full=await createPublic(0),fullBooking=await book(a,full,personA);
  pass('FAMILY_MATCH_OVERLAP_PRACTICAL_WARNING_BOOKING_STILL_POSSIBLE',['F019'],'An overlapping authorized family match produces a practical warning while an eligible executor can still explicitly confirm the public place.');
  let sheet=await open(b,full.shift);
  assert.equal(await sheet.getByRole('button',{name:'Ik help mee',exact:true}).count(),0);
  await sheet.getByRole('button',{name:'Op de wachtlijst',exact:true}).click();
  await sheet.getByLabel('Uit jouw huishouden').selectOption(personB);
  await sheet.getByRole('button',{name:'Wachtlijst bevestigen',exact:true}).click();
  await eventually(`select count(*) from app.waitlist_entries where tenant_id='${tenant}' and shift_id='${full.shift}' and person_id='${personB}' and state='waiting';`,'1');
  await sheet.waitFor({state:'hidden'});
  assert.equal(sql(`select count(*) from app.bookings x join app.shift_positions p on p.id=x.position_id and p.tenant_id=x.tenant_id where p.shift_id='${full.shift}' and x.state='booked';`),'1');
  pass('PUBLIC_FULL_WAITLIST_WITHOUT_EXTRA_BOOKING',['F024'],'A full public place offers a native waitlist and records one waiting entry while one place remains occupied.');
  sheet=await open(a,full.shift,fullBooking);
  await sheet.getByLabel('Toelichting bij de afmelding').fill(`Concrete synthetische afmelding ${run}`);
  await sheet.getByRole('button',{name:'Afmelden binnen de termijn',exact:true}).click();
  await eventually(`select state from app.bookings where id='${fullBooking}';`,'cancelled');
  await sheet.waitFor({state:'hidden'});
  assert.equal(sql(`select count(*) from app.bookings where id='${fullBooking}' and state='cancelled' and version>1;`),'1');
  assert.equal(sql(`select count(*) from app.booking_cancellations where tenant_id='${tenant}' and booking_id='${fullBooking}' and reason_kind='regular' and outcome='timely_cancelled' and not was_late;`),'1');
  assert.equal(sql(`select count(*) from app.booking_events where tenant_id='${tenant}' and booking_id='${fullBooking}' and event_type='booking.cancelled';`),'1');
  assert.equal(ledger(),ledgerBefore);
  pass('OWN_PUBLIC_CANCEL_WITHIN_SNAPSHOT_DEADLINE_PRESERVES_HISTORY',['F027'],'Own public booking is cancelled using its current version before its original deadline; historical booking and ledger remain.');

  setStage('native-practical-question-obstruction-and-exact-takeover');
  const takeover=await createPublic(1),original=await book(a,takeover,personA);
  sheet=await open(a,takeover.shift,original);
  await sheet.getByRole('button',{name:'Een vraag stellen over deze taak',exact:true}).click();
  const question=`Concrete plaatsvraag ${run}`;
  await sheet.getByLabel('Waar gaat je vraag over?').fill(question);
  await sheet.getByRole('button',{name:'Vraag indienen',exact:true}).click();
  await eventually(`select count(*) from app.pwa_questions where tenant_id='${tenant}' and booking_id='${original}' and body='${question}' and person_id='${personA}';`,'1');
  await sheet.waitFor({state:'hidden'});
  assert.equal(ledger(),ledgerBefore);
  pass('OWN_TASK_QUESTION_LINKED_TO_EXACT_BOOKING_NO_LEDGER_CHANGE',['F029'],'A practical question retains the selected task booking and own household without correcting confirmed minutes.');
  sheet=await open(a,takeover.shift,original);
  await sheet.getByRole('button',{name:'Ik kan niet',exact:true}).click();
  await sheet.getByLabel('Wat wil je doorgeven?').fill(`Praktische verhindering ${run}`);
  await sheet.getByRole('button',{name:'Vraag om vervanging',exact:true}).click();
  await eventually(`select count(*) from app.pwa_transfer_offers where tenant_id='${tenant}' and booking_id='${original}' and state='open';`,'1');
  await sheet.waitFor({state:'hidden'});
  assert.equal(sql(`select state from app.bookings where id='${original}';`),'booked');
  const position=sql(`select position_id from app.bookings where id='${original}';`);
  pass('OBSTRUCTION_PRACTICAL_REASON_ORIGINAL_STILL_OCCUPIES_POSITION',['F026'],'Reporting a practical obstruction creates a replacement offer while the current executor remains accountable and occupies the same place.');
  const offer=sql(`select id from app.pwa_transfer_offers where tenant_id='${tenant}' and booking_id='${original}' and state='open';`);
  await appPage(b,`tasks?task=${takeover.shift}&transfer=${offer}`);sheet=b.getByRole('dialog');await sheet.waitFor();
  await sheet.getByRole('button',{name:'Ik neem deze taak over',exact:true}).click();
  await sheet.getByLabel('Uit jouw huishouden').selectOption(personB);
  await sheet.getByLabel('Ik heb de instructies gelezen.').check();
  await sheet.getByLabel('Ik ga akkoord met de afmeldafspraak.').check();
  await sheet.getByRole('button',{name:'Overname bevestigen',exact:true}).click();
  await eventually(`select state from app.pwa_transfer_offers where id='${offer}';`,'accepted');
  await sheet.waitFor({state:'hidden'});
  assert.equal(sql(`select state from app.bookings where id='${original}';`),'transferred');
  assert.equal(sql(`select count(*) from app.bookings where tenant_id='${tenant}' and position_id='${position}' and executor_person_id='${personB}' and state='booked';`),'1');
  assert.equal(sql(`select count(*) from app.bookings where tenant_id='${tenant}' and position_id='${position}';`),'2');
  assert.equal(ledger(),ledgerBefore);
  pass('EXACT_POSITION_TRANSFER_NEW_EXECUTOR_OLD_BOOKING_RETAINED',['F025'],'The second eligible native user explicitly accepts the same place; the old booking is retained as transferred and exactly one new booking occupies that place.');

  setStage('native-own-confirmed-feedback-and-versioned-instructions');
  const confirmed=fixtureId(904),confirmedShift=sql(`select p.shift_id from app.bookings x join app.shift_positions p on p.tenant_id=x.tenant_id and p.id=x.position_id where x.id='${confirmed}' and x.state='confirmed';`);
  assert.match(confirmedShift,/^[0-9a-f-]{36}$/);
  const snapshot=sql(`select row_to_json(x)::text from (select credit_minutes_snapshot,task_version_snapshot from app.bookings where id='${confirmed}') x;`);
  const instructionSnapshot=sql(`select encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')from app.pwa_booking_details d where tenant_id='${tenant}'and booking_id='${confirmed}';`);
  assert.match(instructionSnapshot,/^[0-9a-f]{64}$/);
  sheet=await open(a,confirmedShift,confirmed);
  await sheet.getByRole('button',{name:'Hoe ging deze taak?',exact:true}).click();
  await sheet.getByLabel('Zou je dit nog eens willen doen?').check();
  await sheet.getByLabel('De instructies waren duidelijk.').check();
  const tip=`Praktische voorbereidingstip ${run}`;
  await sheet.getByLabel('Een praktische tip (optioneel)').fill(tip);
  await sheet.getByRole('button',{name:'Ervaring delen',exact:true}).click();
  await eventually(`select count(*) from app.pwa_feedback where tenant_id='${tenant}' and booking_id='${confirmed}' and person_id='${personA}' and repeat and instruction_clarity and tip='${tip}';`,'1');
  await sheet.waitFor({state:'hidden'});
  assert.equal(sql(`select count(*) from app.pwa_feedback_revisions r join app.pwa_feedback f on f.tenant_id=r.tenant_id and f.id=r.feedback_id where f.booking_id='${confirmed}' and r.tip='${tip}';`),'1');
  assert.equal(ledger(),ledgerBefore);
  pass('CONFIRMED_EXECUTOR_FEEDBACK_REPEAT_CLARITY_TIP_APPEND_REVISION',['F031'],'Only the confirmed executor records their own repeat preference, clarity and practical tip as an appended revision without awarded-minute changes.');
  await appPage(c,'manage?tab=requests');
  const feedback=c.locator('article.simple-card').filter({hasText:tip});await feedback.waitFor();
  const instructions=`Concrete verbeterde instructie ${run}`;
  await feedback.getByLabel('Nieuwe praktische instructie').fill(instructions);
  await feedback.getByRole('button',{name:'Praktische instructie opslaan',exact:true}).click();
  await eventually(`select count(*) from app.pwa_instruction_versions where tenant_id='${tenant}' and shift_id='${confirmedShift}' and body='${instructions}';`,'1');
  assert.equal(sql(`select row_to_json(x)::text from (select credit_minutes_snapshot,task_version_snapshot from app.bookings where id='${confirmed}') x;`),snapshot);
  assert.equal(sql(`select encode(extensions.digest(convert_to(to_jsonb(d)::text,'UTF8'),'sha256'),'hex')from app.pwa_booking_details d where tenant_id='${tenant}'and booking_id='${confirmed}';`),instructionSnapshot);
  assert.equal(ledger(),ledgerBefore);
  pass('COMMITTEE_FEEDBACK_TO_NEW_INSTRUCTIONS_PRESERVES_BOOKING_SNAPSHOT',['F080','F081'],'The scoped committee reads the actual practical feedback and publishes a new instruction version; previous booking snapshot and confirmed ledger stay unchanged.');

  setStage('native-team-followup-exact-cluster-deadlines');
  const cluster=fixtureId(1600),before=JSON.parse(sql(`select json_build_object('version',version,'self_until',(select to_char((min(p.starts_at)-interval '2 days') at time zone 'Europe/Amsterdam','YYYY-MM-DD"T"HH24:MI') from app.pwa_allocations x join app.shift_positions p on p.tenant_id=x.tenant_id and p.id=x.position_id where x.cluster_id=c.id),'assign_until',(select to_char((min(p.starts_at)-interval '1 day') at time zone 'Europe/Amsterdam','YYYY-MM-DD"T"HH24:MI') from app.pwa_allocations x join app.shift_positions p on p.tenant_id=x.tenant_id and p.id=x.position_id where x.cluster_id=c.id)) from app.pwa_clusters c where id='${cluster}';`));
  await appPage(a,`teams?team=${fixtureId(400)}&tab=organize&view=deadlines`);sheet=a.getByRole('dialog');await sheet.waitFor();
  await sheet.getByLabel('Taak of cluster').selectOption(cluster);
  await sheet.getByLabel('Zelf inschrijven tot en met').fill(before.self_until);
  await sheet.getByLabel('Teamouder verdeelt tot en met').fill(before.assign_until);
  await sheet.getByRole('button',{name:'Afspraken opslaan',exact:true}).click();
  await eventually(`select version from app.pwa_clusters where id='${cluster}';`,String(Number(before.version)+1));
  assert.equal(sql(`select (self_until<=assign_until and assign_until<(select min(p.starts_at) from app.pwa_allocations x join app.shift_positions p on p.tenant_id=x.tenant_id and p.id=x.position_id where x.cluster_id=c.id))::text from app.pwa_clusters c where c.id='${cluster}';`),'true');
  pass('NAMED_TEAM_PARENT_FOLLOWUP_EXACT_CLUSTER_ORDERED_DEADLINES',['F053'],'The current named team parent saves the explicitly selected cluster deadlines under a new version with self-selection, assignment and task start in order.');

  setStage('native-committee-work-card-explicit-column-deadline-assignee');
  await appPage(c,'committees');
  await c.getByLabel('Commissie').selectOption(fixtureId(300));
  await c.locator('.mobile-segments').getByRole('button',{name:'Instructies',exact:true}).click();
  await c.locator('button.document-card').filter({hasText:'PWA geregistreerde werkinstructie'}).waitFor();
  await c.locator('.mobile-segments').getByRole('button',{name:'Werkafspraken',exact:true}).click();
  await c.locator('button.work-card').filter({hasText:'PWA concrete werkafspraak'}).waitFor();
  pass('EXPLICIT_NATIVE_COMMITTEE_CHOICE_WORK_AND_INSTRUCTION_TABS',['F132','F133'],'The authorized committee choice shows its actual work cards and private registered instruction documents in their respective tabs.');
  await c.getByRole('button',{name:'Werkafspraak maken',exact:true}).click();sheet=c.getByRole('dialog');await sheet.waitFor();
  assert.equal(await sheet.getByRole('button',{name:'Maak de werkafspraak',exact:true}).isDisabled(),true);
  const cardTitle=`PWA browser werkafspraak ${run}`;
  await sheet.getByLabel('Wat moet er gebeuren?').fill(cardTitle);
  await sheet.getByLabel('Praktische toelichting').fill('Controleer de concrete synthetische afspraak en behoud de historie.');
  await sheet.getByLabel('Kolom').selectOption(fixtureId(1201));
  await sheet.getByLabel('Deadline (optioneel, Europe/Amsterdam)').fill('2027-05-01T12:00');
  await sheet.getByRole('checkbox',{name:/Co Ordinator/}).check();
  await sheet.getByRole('button',{name:'Maak de werkafspraak',exact:true}).click();
  await eventually(`select count(*) from app.kanban_cards where tenant_id='${tenant}' and board_id='${fixtureId(1200)}' and column_id='${fixtureId(1201)}' and title='${cardTitle}' and due_at='2027-05-01 12:00:00+02';`,'1');
  await sheet.waitFor({state:'hidden'});
  assert.equal(sql(`select count(*) from app.kanban_card_assignees x join app.kanban_cards k on k.tenant_id=x.tenant_id and k.id=x.card_id where k.title='${cardTitle}' and x.person_id='a1000000-0000-4000-8000-000000000003';`),'1');
  assert.equal(ledger(),ledgerBefore);
  pass('AUTHORIZED_CARD_CREATE_EXPLICIT_COLUMN_DEADLINE_ASSIGNEE_NO_HOURS',['F138'],'A scoped committee coordinator explicitly chooses the native work board column, local-time deadline and authorized assignee; card creation grants no hours.');
  return cases;
}

export async function runMobileReadContextFlows({a,b,c,sql,appPage,fixtureId,checks,setStage,capture,matchId}) {
  const tenant='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',cases=[];
  matchId??=sql(`select id from app.matches where tenant_id='${tenant}'and connection_id='${fixtureId(1921)}'and source_id like 'pwa-local-read-context-%'order by created_at desc,id limit 1;`);
  assert.match(matchId,/^[0-9a-f-]{36}$/);
  const pass=(id,functionIds,description)=>{checks.push(id);cases.push({id,functionIds,description,passed:true,environment:'local',staging_verified:false});};
  setStage('native-exact-personal-action-context-and-other-recipient-denial');
  const contextBefore=sql(`select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(x)order by id)::text,'UTF8'),'sha256'),'hex')from app.personal_action_items x where tenant_id='${tenant}';`);
  const contexts=[
    {page:c,id:1911,text:'PWA exacte lokale subtaak',parent:'Bekijk deze werkafspraak'},
    {page:c,id:1943,text:'PWA concrete lokale vermelding bij precies deze werkafspraak.',parent:'Bekijk deze werkafspraak'},
    {page:a,id:1913,text:'Deze teamafspraak kent geen verenigingsuren toe.',parent:'Bekijk dit team'},
    {page:a,id:1914,text:'PWA concrete vraag over precies deze beleidsversie.',parent:'Bekijk deze beleidsversie'},
  ];
  for(const context of contexts) {
    await appPage(context.page,'actions');
    const link=context.page.locator(`.action-list a[href*="action=${fixtureId(context.id)}"]`);assert.equal(await link.count(),1);
    assert.ok(!/^(?:subtask_assignment|card_assignment|mention|team_task|policy_follow_up)$/.test((await link.locator('small').textContent()).trim()),'Action metadata uses a human label.');
    await link.click();const detail=context.page.getByRole('dialog');await detail.waitFor();
    assert.ok((await detail.textContent()).includes(context.text));
    assert.equal(await detail.getByRole('link',{name:context.parent,exact:true}).count(),1);
    await capture(context.page,`action-context-${context.id}`);
  }
  await appPage(b,`actions?action=${fixtureId(1911)}`);
  await b.getByRole('dialog').getByRole('heading',{name:'Deze actie is niet beschikbaar',exact:true}).waitFor();
  assert.equal(await b.getByRole('dialog').getByText('PWA exacte lokale subtaak',{exact:true}).count(),0);
  assert.equal(sql(`select encode(extensions.digest(convert_to(jsonb_agg(to_jsonb(x)order by id)::text,'UTF8'),'sha256'),'hex')from app.personal_action_items x where tenant_id='${tenant}';`),contextBefore);
  pass('EXACT_ACTION_CONTEXT_FOUR_SOURCE_KINDS_OWN_RECIPIENT_NO_GET_WRITES',['F001','F063'],'Four historical action kinds open their exact authorized content and parent link; another native recipient gets no source content, and GETs leave action rows unchanged.');
  setStage('native-match-source-field-locker-room-no-invented-end');
  await appPage(a,`agenda?view=${matchId}`);
  const match=a.getByRole('dialog');await match.waitFor();
  await match.getByText('Veld: PWA veld 2',{exact:true}).waitFor();
  await match.getByText('Kleedkamer: PWA kleedkamer 3',{exact:true}).waitFor();
  await match.getByText('Eindtijd niet aangeleverd.',{exact:true}).waitFor();
  await capture(a,'match-source-details');
  pass('MATCH_DETAIL_AUTHORIZED_SOURCE_FIELD_LOCKER_ROOM_UNKNOWN_END',['F038'],'Actual source field and locker-room metadata are shown, while a missing source end time remains explicitly unknown.');

  return cases;
}
