# 04 — Domeintransacties, achtergrondwerk en integraties

Status: uitvoerbaar te maken implementatiecontract voor Cluvo V1, 2 oktober 2026. Dit document is een ontwerp, geen bewijs dat externe koppelingen of databasefuncties al bestaan. Tabelnamen sluiten aan op document 03. De canon bepaalt het gedrag; onderstaande keuzes maken dat gedrag betrouwbaar bouwbaar.

## 1. Commandcontract

Een Next.js Server Action of Route Handler valideert input en sessie en roept één atomaire domeincommand aan. De command controleert autorisatie opnieuw en schrijft bronrecords, audit en `domain_events` in dezelfde transactie. De worker verwerkt pas gecommitteerde events. Geen combinatie “eerst e-mail sturen, daarna booking opslaan”.

Elke mutatie bevat `tenant_id`, een UUID `idempotency_key`, relevante resource-ID's en `expected_version` waar een bestaand object wordt gewijzigd. De server bepaalt actor, tijdstip en bronwaarden. Zelfde key + zelfde payload geeft dezelfde uitkomst; dezelfde key + andere payload geeft `IDEMPOTENCY_CONFLICT`. Een verloren HTTP-response mag niet tot een tweede booking, factuur of akkoord leiden.

Succescontract: `{ok:true, resource_id, version, event_ids, result}`. Foutcontract: `{ok:false, code, message, field_errors?, retryable, correlation_id}`. Stabiele codes omvatten `FORBIDDEN`, `STALE_VERSION`, `CAPACITY_FULL`, `PERSON_OVERLAP`, `NOT_ELIGIBLE`, `QUALIFICATION_EXPIRED`, `BUDDY_UNAVAILABLE`, `CANCELLATION_DEADLINE_PASSED`, `OFFER_EXPIRED`, `REVIEW_REQUIRED`, `SECOND_REVIEW_REQUIRED`, `FINANCIAL_BLOCKED` en `INTEGRATION_UNAVAILABLE`. Geen stacktrace of privéreden in een foutmelding aan onbevoegden.

Locks worden in vaste volgorde genomen: betrokken personen, verplichtingen en daarna shifts/posities op stabiele ID-volgorde. Gebruik transactionele locks, geen sessielocks die door pooling kunnen blijven hangen. Intervallen zijn halfopen `[start, end)`, zodat 10:00–12:00 en 12:00–14:00 geen overlap zijn. Retry alleen expliciet herhaalbare transactionele conflicten met dezelfde idempotencykey; een inhoudelijke weigering niet automatisch omzeilen.

## 2. Identiteit, intake en vertegenwoordiging

### OTP-login

1. E-mail invoeren; antwoord onthult niet onnodig of een dossier/account bestaat.
2. Supabase Auth verstuurt een numerieke e-mail-OTP via een ingerichte Auth-template en eigen SMTP-provider. Code/expiry/bruteforcebescherming blijven verantwoordelijkheid van Auth, geen zelfgebouwde database-OTP.
3. `verifyOtp` rondt de geverifieerde sessie af; de server leest de actuele tenantmembership en grants.
4. Bestaande login gebruikt `shouldCreateUser:false`. Nieuwe gebruikers ontstaan alleen via de gecontroleerde uitnodigings/onboardingroute; een Auth-account op zichzelf geeft geen verenigings- of dossierinzage.
5. Sessiecookies worden volgens de actuele `@supabase/ssr`-Next.js-gids verwerkt. Geauthenticeerde pagina's en responses met sessieverversing worden niet publiek gecachet. Logout/intrekking verwijdert lokale gevoelige cache; privé-API-responses komen niet in een algemene PWA-cache.

Auth OTP-mail blijft afzonderlijk van de gewone club-template-editor. OTP's komen nooit in verzendlogs, audit-events, analytics, browserconsole of supportexports. Het prototypewachtwoord `246810` en de vrije rolwisselaar mogen niet in de productie-authroute blijven bestaan.

### Huishouden-/intakecommands

| Command | Invoer | Transactioneel resultaat / verplichte controle |
|---|---|---|
| `invite_household_executor` | household, e-mail, persoongegevens, toegestane scopes | Controle contactpersoon/commissie; eenmalige invite met expiry; geen toegang vóór acceptatie. |
| `accept_household_invitation` | invitation token | Geverifieerde juiste e-mail, ongebruikt token, eigen account; exacte scopes aanmaken; uitnodiging consumed. |
| `save_intake_revision` | profile, expected_version, antwoorden, namens-persoon?, reden? | Eigen profiel of expliciete assistentiebevoegdheid; nieuwe revision; actor en vertegenwoordigde apart. |
| `propose_household_change` | link/split/repair, betrokken dossiers, voorgestelde doelen/koppelingen | Effectpreview: bestaande verplichtingen, kinderen, bookings, vrijstellingen, saldo, zichtbaarheid. Geen automatische merge op naam/adres. |
| `apply_household_change` | goedgekeurde caserevision | Lock dossiers/verplichtingen; alleen beoordeelde nieuwe koppelingen/toekomstige doelen; historische booking-obligation intact. |
| `recognize_volunteer_appointment` | persoon, rolversie, huishouden, periode, bevestiger | Bevoegd erkenner; aparte dekkingsbeslissing voor het aangewezen huishouden; geen ledgerpost of systeemrecht. |
| `review_appointment_change` | beëindiging/startwijziging, caserevision, effectieve jaardoelen en winterdoelen | Markeer beoordelen, blokkeer automatische claim; pas doelen pas toe na gemotiveerd besluit. |

Een docent/trainer/commissielid kan dus structurele inzet hebben zonder toegang tot alle clubdossiers. Jaarlijkse herbevestiging maakt verlopen rollen zichtbaar; systeemrechten vervallen op hun ingestelde datum.

## 3. Publiceren, boeken en vrijgekomen plaatsen

### `publish_shift_batch`

Invoer: lijst conceptshift-ID's, expected versions, publicatietijd. Controleer bevoegdheid per commissie, goedgekeurd taaktype, vooraf zichtbare urenwaarde, instructies, tijden, capaciteit, minimumleeftijd en kwalificaties. Een afwijkende urenwaarde vraagt een geldig besluit. Geef vóór commit een preview van de gehele batch. Commit de gecontroleerde batch atomair of retourneer concrete fouten zonder gedeeltelijk onbedoeld publiceren. Een serverlimiet kan grote batches in expliciet bevestigde delen splitsen.

Eerste publicatie: `draft → published`, schrijf één stabiel `task.published`-event per taak. Dezelfde batch opnieuw uitvoeren geeft dezelfde uitkomst. Een tekstcorrectie/publicatie-retry maakt geen tweede “nieuwe taak”-push. Een echt nieuwe herhaalde dienst is een nieuwe taak-ID en mag een nieuwe aanbodmelding krijgen.

### `book_shift`

Invoer: `shift_id`, optionele gewenste `position_id`, daadwerkelijke `executor_person_id`, `obligation_id`, optionele `buddy_booking_id`, instructiebevestigingen, idempotencykey.

Binnen één transactie:

1. Bepaal actor en geautoriseerde uitvoerder/verplichtingskoppeling. Gebruik nooit automatisch de ingelogde ouder als feitelijke uitvoerder.
2. Controleer gepubliceerde staat, inschrijfvenster en actuele taakversie.
3. Lock uitvoerder en concrete vrije position. Een nog geldig wachtlijstaanbod bezet/holdt de betreffende plaats voor die kandidaat.
4. Controleer persoonlijke overlap, beschikbaarheid, minimumleeftijd op dienstdatum, kwalificatie gedurende de vereiste dienstperiode en instructievoorwaarden. Eigen/gezinswedstrijden zijn een zichtbare waarschuwing of ingestelde blokkade, niet een heimelijke reden.
5. Bij maatje: begeleider heeft een actieve passende booking op diezelfde dienst, is bevoegd/ervaren en niet overbezet; een willekeurige naam uit een dropdown is onvoldoende. Eventuele begeleidingscapaciteit locken en bewaken.
6. Controleer groepsbezetting: minimum aantal ervaren/bevoegde personen moet haalbaar blijven. Onderbezette concepten mogen zichtbaar zijn voor coordinatie, maar niet ten onrechte als volledig veilig bemand worden gemarkeerd.
7. Schrijf booking met server-snapshots van tijd, duur, urenwaarde, afmelddeadline, taakbeleid en gekozen verplichting. Zet een actieve positieclaim. Schrijf audit en bevestigingsevent.
8. Commit; pas daarna toont de UI definitief “Ingeschreven”. Zonder netwerkbevestiging blijft status “Nog niet bevestigd”.

Bij twee gelijktijdige claims op de laatste plaats slaagt exact één booking. Het tweede verzoek krijgt `CAPACITY_FULL` en een wachtlijstaanbod, geen stille overschrijving. Een procesbrede JavaScript-mutex is hiervoor niet voldoende.

### Wachtlijst en reservepool

`join_waitlist` controleert identiteit, de verplichte voorwaarden en bestaande deelname, en maakt een geordende entry. Bij vrijkomen van een plek selecteert `offer_next_waitlist_candidate` onder lock de eerstvolgende op dat moment geschikte kandidaat. Sla tijdelijk een positionhold met absolute `expires_at` op. Verzend aanbod via outbox. Een worker scant vervallen offers; een verlopen lease kan nooit de plek langer vasthouden.

`accept_waitlist_offer` controleert opnieuw geschiktheid, offerstatus, deadline en overlap, en vervangt hold + entry door booking in één transactie. Laat ontvangen push maakt een verlopen aanbod niet alsnog geldig. Bij weigering/verval volgt de volgende passende kandidaat. Als niemand past, kan een gerichte reservepooloproep worden gestart; leden worden niet zonder toestemming in de reservepool geplaatst.

## 4. Planbord, wijzigingen, ruilen en afmelden

### Eén command achter slepen, uitrekken en formulier

`preview_shift_change(shift_id, expected_version, proposed_change)` retourneert getroffen bookings, notificaties, leeftijd/kwalificatie/overlap/buddyproblemen, veranderde urenwaarde en eventuele herbevestiging. `apply_shift_change(proposal_id, expected_version, confirmed_impact_hash)` herhaalt de controle onder locks en past alleen de beoordeelde wijziging toe. Een verouderde impactpreview wordt geweigerd.

Het verslepen van één planbordpositie wijzigt uitsluitend dat blok/de gekoppelde booking, tenzij de gebruiker expliciet de hele dienst selecteert. Bij splitsen van een groepsdienst ontstaan correct gekoppelde nieuwe dienst/positie-ID's; bestaande publicatie-/afspraakgeschiedenis blijft traceerbaar. Capaciteit verminderen mag niet zonder opvang van bezette plaatsen. Nieuwe afmeldinstellingen veranderen bestaande deadlines niet; een bewuste nieuwe afspraak wordt als wijziging/herbevestiging vastgelegd.

Een belangrijke wijziging kan `reconfirmation_required` op betrokken bookings zetten; die deelnemers zijn niet stilzwijgend akkoord met nieuwe tijd/locatie/taak. Toon benodigde opvolging in planner en Mijn acties. Annulering van een wedstrijd wijzigt nooit automatisch die bookings.

### Overname en wederzijdse ruil

Statusverloop: `open → awaiting_acceptance → accepted` of `withdrawn/expired/rejected`. De oorspronkelijke booking blijft tot commit actief.

- `request_transfer(origin_booking)` opent de ruilmarkt zonder uren of bezetting vrij te geven.
- `accept_transfer(request, replacement_person, replacement_obligation)` lockt beide personen en positie, controleert beschikbaarheid/kwalificaties/age/buddy en de snapshotvoorwaarden. Nieuwe booking, oude `transferred`, verzoek `accepted` en meldingen ontstaan atomair.
- `propose_mutual_swap(booking_a, booking_b)` registreert de precieze versies en beide instemmingen. `commit_mutual_swap` lockt beide tijdblokken en personen in dezelfde volgorde, controleert beide nieuwe situaties en verwisselt de actieve claims samen. Bij één fout verandert geen van beide bookings.
- Heeft één booking intussen een wijziging of afmelding, dan vervallen oude instemmingen en is een nieuwe voorstelversie nodig. Een initiatiefnemer kan niet namens een ongeautoriseerde tweede uitvoerder instemmen.

### Afmelden en ziekmelden

`cancel_booking(reason_kind, description?)` beoordeelt de opgeslagen afmelddeadline. Tijdig: booking `cancelled`, position vrij, winterallocatie heropenen, wachtlijst starten. Laat: de melding wordt opgeslagen, gebrek aan bezetting direct zichtbaar en coordinatie krijgt opvolging volgens de ingestelde route. Toon expliciet of de inzet nog wordt verwacht; houd geen onduidelijke “succes”-melding zonder statuswijziging.

`report_sickness`/noodmelding blijft altijd mogelijk, ook bij ontbrekend beleidsakkoord en na de reguliere deadline. Sla praktische verhindering op; vraag geen diagnose. Markeer de position als ontbrekende bezetting en start vervanging volgens beleid. Eventuele afhandeling van geplande uren is een afzonderlijke uitvoering/besluitroute. Geen automatische boete of sportieve sanctie.

## 5. Uitvoering, wintercontrole en uren

### `confirm_attendance` en `correct_award`

Bevoegde taakeigenaar registreert aanwezig, gedeeltelijk uitgevoerd, no-show of clubannulering. De startinstelling is bevestigen binnen zeven dagen, fouten melden binnen veertien dagen; overschrijding maakt een actie aan, geen blokkade op het herstellen van aantoonbare fouten.

Volledige uitvoering boekt de afgesproken minuten. Een afwijking vraagt reden en passend mandaat; gedeeltelijke aanwezigheid is niet automatisch dezelfde proportie wanneer het vooraf vastgelegde taakbeleid anders bepaalt. Afgebroken/door de club ingekorte diensten volgen dat taakbeleid. Clubannulering vroegtijdig heeft een aparte route.

`confirm_attendance` lockt booking/verplichting en maakt één `attendance_decision` plus één idempotente ledgerpost. Een tweede klik boekt niet dubbel. Een correctie maakt eerst een negatieve tegenpost voor de oude toekenning en daarna zo nodig een vervangende positieve post, beide gekoppeld aan de oorspronkelijke beslissing en reden. Niet het oude `minutes`-veld overschrijven. Niet verschenen geeft nul uren en opvolging, geen automatische geldpost.

Handmatige inzet buiten een boeking gebruikt een goedgekeurde registratiecase met uitvoerder, verplichting, datum, minuten, bron en bevestiger; er is geen generieke “saldo ophogen”-knop.

### Jaar- en winterformules

```text
bevestigd_seizoen = som van geldige ledger-delta's op verplichting
bevestigd_voor_winter = som met uitvoeringsmoment voor wintergrens
jaar_resterend = max(0, effectief_jaardoel - bevestigd_seizoen)
winter_tekort = max(0, effectieve_wintergrens - bevestigd_voor_winter)
nog_in_te_plannen = max(0, min(winter_tekort, jaar_resterend)
                          - reeds_actief_toegewezen_inhaalminuten)
```

Pas `winter_tekort` pas definitief toe na controle van relevante nog te bevestigen/betwiste uitvoering en uitzonderingen. Bij 240 bevestigde minuten plus 120 onbevestigd moet die registratie eerst beoordeeld worden. Geef `needs_review` en leg geen tweede automatische 120 minuten op.

`create_winter_review` fixeert grens, ledgerrevision en beslissingen. `allocate_winter_booking` gebruikt dezelfde boekingscontrole als `book_shift`; de commissie kan een bestaande passende booking na de winter koppelen. Een allocation registreert alleen hoeveel van het tekort ermee wordt gedekt; de uiteindelijke dienst boekt eenmaal normale uitvoeringsminuten. Een geplande allocation telt niet als bevestigd. Bij annulering/transfer blijven allocation en gekozen verplichting inhoudelijk correct.

8 uur vóór + 4 uur na = voldaan. 12 uur vóór = voldaan. 4 uur vóór = 2 uur inhaalplanning binnen de resterende 8 jaaruren. Er bestaat geen zelfstandig minimum van 6 uur ná de winter.

## 6. Vierogenbesluiten en financiële afsluiting

### Uitzondering: aanvraag → voorstel → twee beoordelingen → besluit

`submit_exception_case` bevat type (vermindering, tijdelijk/volledig vrijgesteld, uitstel, afkoop, rolwijziging), praktische reden, looptijd, reikwijdte en voorgestelde effectieve jaar-/winterdoelen. Persoonlijke toelichting en financieel bruikbare beslistekst zijn gescheiden.

`review_exception(case_revision_id, outcome, reason)` herleidt de reviewer uit de sessie. Twee beoordelingen vereisen twee verschillende `auth_user_id` én twee verschillende natuurlijke `person_id`, ieder op beoordelingsmoment bevoegd, zonder geregistreerd belangenconflict. Twee rollen of twee klikken door dezelfde gebruiker zijn één reviewer. Een voorstelwijziging reset de geldigheid van eerdere reviews door een nieuwe revision/hash te maken; oude reviews blijven historisch zichtbaar.

`finalize_exception` accepteert alleen dezelfde actuele voorstelrevision met de vereiste twee geldige beoordelingen. Verschil van oordeel, bezwaar, belangenconflict of buiten-beleid vraagt de vastgelegde bestuursroute; het systeem maakt dit geen automatische meerderheid. Het bestuurlijke eindbesluit registreert de behandelaars en reden en bewaart de oorspronkelijke reviews. Bij financiële afkoop is vastgelegde beoordeling van werkelijk ontbrekend passend aanbod vereist; belangstelling om €150 te betalen is nog geen goedgekeurde afkoop.

### Afrekening

Default financieel beleid: standaardjaardoel 720 minuten en standaardbijdrage 15.000 cent. Het tarief blijft `15000 / 720` cent per ontbrekende minuut, ook bij een gemotiveerd verminderd jaardoel, tenzij een nieuw expliciet financieel beleidsbesluit anders bepaalt. Reken exact met integers/rationale verhouding en rond de totaaluitkomst eenmaal af op centen; niet per minuut of per taak tussentijds afronden.

`missing_minutes = max(0, effective_target_minutes - confirmed_minutes)` na toepassing van geldige dekking/besluiten. `proposal_cents = round(missing_minutes * 15000 / 720)` voor de standaardtekortroute. Bij 540 bevestigde minuten is het voorstel 3.750 cent. Bij een verminderd doel van 480 en 360 bevestigd: 2.500 cent. Geldige volledige vrijstelling: nul. Volledige goedgekeurde afkoop: één afspraak van 15.000 cent en geen tekortfactuur.

`prepare_assessment` maakt een controleerbaar voorstel met ledgerrevision, effectieve doelen, gebruikte besluiten, tariefsnapshot en blokkades. Blokkeer finaliseren bij:

- relevante openstaande uitvoeringsbevestigingen, urenbezwaar of correcties;
- onbesliste uitzondering, rolwijziging, huishoudwijziging of belangenconflict;
- ontbrekende beoordeling van passend aanbod waar de canon dit vereist;
- ongeldige seizoensinrichting of ontbrekende financiële goedkeuring;
- reeds actieve definitieve afkoop-/tekortverwerking voor dezelfde verplichting/seizoen.

`approve_assessment` is de gecontroleerde overdracht van vrijwilligerscommissie naar financieel beheer. `finalize_assessment` lockt verplichting/financiële route, hercontroleert bronrevisies en blokkades, en maakt één finale factuur-/exportbasis. Alle uren/besluitcommands die dezelfde grondslag wijzigen nemen dezelfde verplichtingslock; anders bestaat er alsnog een race tussen “geen bezwaar” en factureren.

Een wijziging na financiële afsluiting maakt `reassessment_required` en een herziening/correctiepost. Een verstuurde/betaalde factuur wordt niet verwijderd of herschreven. Een oude tekortfactuur moet gecontroleerd zijn gecorrigeerd voordat dezelfde periode naar afkoop gaat. Bestaande betalingen worden via expliciete verrekening/credit/refundroute behandeld; niet opnieuw innen.

De vrijwilligerspot boekt werkelijk ontvangen bijdragen, uitgaven en correcties. Open facturen zijn vorderingen, reserveringen verminderen beschikbaar budget maar zijn nog geen uitgave. Iedere uitgave bewaart doel, verantwoordelijke en goedkeuring. Een incasso/betaalprovider is een adapterkeuze; V1 moet minimaal de canonroute factuur of gecontroleerde export en betaalstatus opleveren. Een provider is geen reden om de besluitcontrole te omzeilen.

## 7. Teamtaken, kanban, agenda en beleid

`create_team_task` forceert nul minuten. `request_market_publication` bewaart bronteamtaak en eventuele wedstrijd. Scheidsrechter: eerst de noodzakelijke inhoudelijke beoordeling door wedstrijdzaken, daarnaast vrijwilligerscommissie voor uren en publicatie. `approve_team_task_for_market` maakt één goedgekeurde markttaak met stabiele bronlink en vooraf bepaalde minuten. Alleen bevestigde uitvoering daarvan geeft ledgeruren; de oorspronkelijke teamtaak blijft nul.

Kanban heeft meerdere uitvoerders, optioneel één aanspreekpunt, subtaken met uitvoerders, labels, bijlagen, comments en mentions. `move_card` controleert boardrechten en versie. `complete_card` schrijft status/event, nooit een uurboeking. Taken, events en documenten worden via typed links verbonden. Het persoonlijke actieoverzicht leest de bevoegde bronnen en ontdubbelt een toewijzing/mention uit één gebeurtenis.

Voor agenda worden herhalingsregels in lokale tijd opgeslagen en concrete occurrences vooruit opgebouwd met unieke recurrencekey. Een enkele wijziging maakt een exception; wijziging van reeks maakt expliciet de gekozen toekomstige reeksversie. Ontbrekende/zich herhalende zomertijden gebruiken een vooraf vastgelegde strategie en worden zichtbaar in de editor. Een gekoppelde dienst gebruikt bron/impactworkflow, geen los gedupliceerde datum. RSVP verandert geen uren.

`publish_policy_version` bevriest exacte tekst, downloadbestand en hash; doelgroep, ingangsdatum en heracceptatiebesluit horen bij deze versie. `offer_policy` maakt een assignment per lid. `record_policy_open` is alleen geopend. `accept_policy` vereist niet-vooraf-aangevinkt actief akkoord, geverifieerde actor en expliciet geselecteerde leden. Voor ieder kind wordt een afzonderlijke acceptance geschreven na controle van geldige `guardian_authorization`; in één batch geldt alles-of-niets om een misleidend gedeeltelijk akkoord te voorkomen. De geregistreerde versionhash komt van de server.

Een nieuwe versie bewaart oudere acceptaties. `ask_policy_question` start opvolging en pauzeert alleen de relevante herinneringsroute. Taken, belangrijke berichten en ziekmelden blijven bereikbaar. Een beleidsvraag wijzigt geen contactvoorkeur of intake.

## 8. Sportlink en gecontroleerde ledenimport

Maak een provideradapter met expliciet capability-overzicht: wedstrijden, teams, eventuele beschikbare ledenvelden. Toon pas “Verbonden” nadat een geautoriseerde verbinding en proefimport slagen. Bewaar secrets server-side, nooit in browserbundel, exports of logs.

### Twee lokale syncmomenten per kalenderdag

Start: `06:00` en `18:00` in `Europe/Amsterdam`, configureerbaar. Een periodieke dispatcher vergelijkt lokale tijd met geplande occurrences en vertaalt elke occurrence naar UTC. De database bewaart `(tenant, job_kind, local_date, slot_key)` uniek en claimt deze met een lease. Twee workers of een wintertijdherhaling kunnen dezelfde occurrence dus niet tweemaal uitvoeren. Een zomer-/wintertijdwisseling verandert de UTC-offset, niet de lokale ingestelde tijden. Definieer bij een aangepaste tijd die in een DST-gat valt: de eerstvolgende bestaande lokale tijd; bij een dubbele lokale tijd: eenmaal, het eerste voorkomen. Laat dit vooraf in de instellingenpreview zien.

Supabase Cron kan een korte dispatcher activeren; de langdurige import loopt als workerjob. Kies één scheduler als eigenaar, niet tegelijk een GitHub-cron én databasecron die dezelfde sync onafhankelijk aanmaken. Handmatig verversen gebruikt dezelfde importfunctie, bronkeys en locks, maar een afzonderlijk triggerlabel. Het hoeft niet tot het volgende automatische slot te wachten.

Importstappen:

1. Claim connection/job, registreer start en laatste succesvolle cursor.
2. Haal paginagewijs op; volg providerlimieten en herken incomplete antwoorden/timeouts.
3. Valideer bron-ID's, datums, teammapping en aanwezigheidsmetadata. Bewaar een beperkte bronhash/revisie, geen ongefilterd persoonsgegevensarchief.
4. Upsert wedstrijden op `(tenant_id, provider, source_id)`. Wijzig alleen beschikbare bronvelden. Niet-aangeleverde veld-/kleedkamerinformatie blijft onbekend.
5. Vergelijk relevante velden, maak alleen echte `match.changed`/`cancelled`-events en impactcases voor gekoppelde diensten. Geen automatische dienstverplaatsing of verwijdering.
6. Maak dienstvoorstellen via template; UQ match/templateversie/voorsteltype. Herhaalde identieke import maakt geen nieuwe voorstellen/meldingen.
7. Markeer alleen een volledige geslaagde run als nieuwe `last_success_at`. Een ontbrekend record in een mislukte/onvolledige import is nooit bewijs van afgelasting. Zichtbare bronstatus en actualiteit blijven beschikbaar.

Voor leden: verifieer eerst welke contractueel beschikbare bron geboortedatum, e-mail en lidmaatschapsstart levert. Publieke verjaardagsinformatie is geen volledige ledenbron. Ontbreekt die koppeling, gebruik gecontroleerde CSV-import met mapping, dry-run, foutregels en expliciete importbevestiging. Match stabiel lidnummer; conflicterend bron-ID/e-mail gaat naar handmatige controle. Geïmporteerde velden hebben provenance en mogen intake, huishouddossier, toegangsrechten, uren of besluiten niet overschrijven. Een import mag geen accounts of gezinsrelaties op naamgelijkheid creëren.

## 9. Notificaties, templates en betrouwbare verzending

### Gebeurtenis → intent → outbox → providerstatus

Elke domain-event wordt idempotent vertaald naar ontvangers die het bronobject mogen zien. Leg minimaal event-ID, recipient-person-ID, templateversie, kanaal en dedupekey vast. Schrijf een inbox-item met een veilige tekst en bronlink. De browser krijgt nooit een diagnose, besloten ouderantwoord of financiële achterstand via een algemene pushpreview.

Voor nieuwe taken gelden twee aparte routes:

- Push: één logisch event per `(tenant, person, shift_id)` bij nieuwe passende eerste publicatie; geen dagmaximum. Meerdere rollen/segmentmatches maken geen extra event. Meerdere ingeschakelde apparaten mogen hetzelfde logische event ontvangen; gebruik een stabiele notificationtag om apparaatduplicaten te beperken.
- E-mail: maximaal één nieuwe-takendigest per `(tenant, person, local_date)` volgens de clubtijdzone. Bouw de inhoud vlak voor verzending opnieuw uit nog beschikbare, passende taken. Verwijder geannuleerde/volle/verlopen aanbiedingen. Nieuwe taken na een reeds verzonden digest schuiven naar de volgende lokale dag als ze dan nog bruikbaar zijn.

Bevestigingen, definitieve ruil, belangrijke wijzigingen, ziekte en dienstherinneringen zijn aparte categorieën en worden niet door de nieuwe-takenmailcap tegengehouden. Startreminders: zeven dagen en 24 uur voor dienst, configureerbaar. Een wijziging vervangt toekomstige reminders op bronversie; oude niet-verzonden reminderjobs vervallen. Een reeds verzonden melding wordt niet uit het historische log verwijderd.

### Daglimiet en retries

Digestselectie en reservering van het lokale dagslot vinden transactioneel plaats. Een providerattempt claimt een outboxrecord met een lease, bewaart exact dezelfde dedupe-/message-ID en verandert `queued → processing → provider_accepted → delivered` of `failed/unknown`. Alleen expliciete providerbevestiging bewijst aflevering.

Externe e-mail/push ondersteunt niet altijd volledige exactly-once-aflevering. Bij timeout ná een mogelijk geaccepteerde providerrequest: status `unknown`, reconcile met provider-ID/webhook of idempotente providerfunctie. Stuur niet blind een nieuwe mail; daarmee zou de dagelijkse cap of bevestigingsontdubbeling breken. Webhooks worden op handtekening gecontroleerd en op provider-event-ID ontdubbeld. Permanente errors/dead endpoints worden onderdrukt; tijdelijke fouten krijgen begrensde backoff en een dead-letter-/beheerrij.

De dagelijkse cap geldt per persoon binnen de vereniging. Een gedeeld e-mailadres maakt niet automatisch één persoon en is geen reden om dossiers samen te voegen; beheer kan voor hetzelfde afleveradres een expliciete extra deduplicatieregel instellen zonder individuele inboxregistratie te verliezen. Verschillende verenigingen hebben eigen branded communicatie en eigen cap.

### Templatelevenscyclus

`draft → previewed → test_sent → approved → published`, met versiehistorie. Onderwerp, preheader, afzender/reply-to, HTML/text, knoplinks, variabelenschema en ontbrekende-waarde-fallbacks worden samen beoordeeld. Variabelen zijn een allowlist, worden contextueel ge-escaped en zijn geen uitvoerbare templatecode. Geen ongecontroleerde HTML uit intake/comments in e-mail. Preview test minstens naam ontbreekt, meerdere kinderen, lange taaknaam, geen urenplicht en vertegenwoordigd lid. Testverzending gaat naar expliciet geselecteerd testadres.

In staging: outbound standaard naar sandbox/allowlist, duidelijke stagingmarkering en productie-afzenders/webhooks niet actief. Dit geldt ook voor verjaardagen, OTP, reminders en geplande campagnes. Aanpassingen van centrale automatische regels vereisen bevoegdheid; commissie kan binnen mandaat content maken uit goedgekeurde templates.

## 10. Waardering, opleidingen, passend aanbod en seizoensovergang

Waardering berekent gelegenheden alleen uit betrouwbare datums. Onvolledige geboortedatum of onbekend lidmaatschapsbegin produceert geen verzonnen verjaardag/jubileum. Eén `appreciation_occasion` per persoon/gelegenheid/mijlpaal/periode voorkomt dubbele acties via verschillende commissies. De regel kiest conceptbericht, automatische felicitatie of actiekaart met eigenaar, uitvoerders, deadline en budget. Openbare felicitaties zijn apart ingesteld; lief en leed blijft besloten.

Opleidingsresultaat/geverifieerd certificaat heeft geldigheid. Een vervaljob controleert toekomstige bookings en maakt opvolging; hij verbergt of verwijdert bestaande toezeggingen niet stilzwijgend. De begeleidingsregeling van de eerste dienst koppelt een echt beschikbare buddy. Workloadsignalen vergelijken gewenste inzet met geplande/uitgevoerde inzet en extra invallen; signaleren een gesprek, geen automatische straf.

Passend aanbod wordt berekend per verplichting/uitvoerder uit werkelijk boekbare posities, tijden, leeftijd, kwalificaties en beschikbaarheid. Een totaal “100 open uren” bewijst niet dat ieder huishouden voldoende aanbod had. Bewaar bij een hulpverzoek/afkoopbeoordeling een reproduceerbare aanbodbeoordeling, aangeboden alternatieven en opvolging.

`prepare_season_close` controleert open registraties, geschillen, uitzonderingen, financiële verwerking en onvolledige brondata. `close_season` maakt immutable snapshots van doelen, ledgerstand, rollen/besluiten en benodigde rapporten. `rollover_season` is idempotent, kopieert alleen geselecteerde sjablonen en maakt herbevestigingsacties voor intake, rollen en afspraken. Nieuwe verplichtingen komen uit de nieuweseizoeninrichting; overuren worden niet automatisch overgedragen of uitbetaald. Correcties in het oude seizoen blijven via herzieningsroute mogelijk.

Verenigingsrapportages tellen distinct verplichting/huishouden volgens de expliciete seizoenskoppeling. Teams kunnen dezelfde huishoudstand tonen; een rapport mag die stand niet opnieuw optellen per kind/team.

## 11. Concrete releaseproeven voor deze contracten

Naast A01–A30 uit de canon:

1. Twee databaseverbindingen boeken tegelijk de laatste plek: één winnaar; één ledgerbron bij dubbele bevestigingsrequest.
2. Wederzijdse ruil met verlopen kwalificatie bij één deelnemer: geen enkele booking verandert.
3. Vrijgekomen plek gaat naar wachtlijsthold; andere booking kan hold niet passeren; verlopen offer wordt niet geaccepteerd.
4. Gewijzigde afmeldregel beïnvloedt nieuwe booking, niet oude snapshot; ziekmelden werkt in beide gevallen.
5. Winterallocatie wordt niet dubbel aangemaakt bij retries; bestaande passende booking wordt gekoppeld; annulering heropent slechts de gedekte minuten.
6. Twee reviews van hetzelfde account met verschillende rollen blijven onvoldoende. Een gewijzigde proposalrevision maakt eerdere approvals onbruikbaar.
7. Een nieuwe urenbezwaartransactie tegelijk met finaliseren van afrekening resulteert in een consistente blokkade of geregistreerde herzieningsroute; nooit een onzichtbaar genegeerd bezwaar.
8. Afkoop plus bestaande shortagefactuur kan niet twee actieve claims geven; betaling wordt niet opnieuw geboekt bij webhookretry.
9. Tweemaal importeren geeft dezelfde wedstrijden/voorstellen; incomplete response annuleert niets; 06:00 en 18:00 blijven lokale momenten rond beide DST-overgangen.
10. Twee rollen matchen dezelfde task: één pushintent; vijf nieuwe tasks op één dag: vijf pushintents en maximaal één digest. Provider-timeout geeft `unknown` in plaats van blind opnieuw verzenden.
11. Geopend beleid zonder checkbox blijft niet-geaccepteerd; bevoegde ouder accepteert twee geselecteerde kinderen: twee exact-version registraties. Onbevoegd kind/andere ouder krijgt geen autorisatie.
12. Een mention naar iemand zonder bronrecht lekt geen tekst en verleent geen toegang; oude socket na intrekking ontvangt hoogstens een onbruikbare invalidatie-ID.
13. Directe REST/RPC/Storage/exportverzoeken van tenant A voor tenant B en van ouder A voor intake ouder B falen, ook wanneer ID's bekend zijn.
14. Stagingoutbox kan zonder expliciete allowlist geen echte clubleden mailen; secrets en OTP ontbreken in logs en browserbundel.

## 12. Officiële bronnen en verificatie

Geraadpleegd op 2 oktober 2026; controleer de actuele API/CLI bij implementatie. De beschreven Cluvo-commandnamen zijn eigen ontwerpcontracten, geen bestaande Supabase-functies.

- [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) en [Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs).
- [Auth-templatewijziging voor nieuwe Free-projecten](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier): eigen SMTP gebruiken voor de beoogde branded OTP-flow.
- [Supabase Cron](https://supabase.com/docs/guides/cron): technisch planningsmechanisme; de lokale-dag/DST-idempotentie hierboven is Cluvo-applicatielogica.
- [Postgres locking](https://www.postgresql.org/docs/current/explicit-locking.html): transactionele synchronisatie; de Cluvo-lockvolgorde is een ontwerpkeuze die met concurrerende tests moet worden bewezen.
- [Sportlink Club Dataservice](https://www.sportlink.nl/ons-aanbod/club-dataservice/) en [officiële artikelenlijst](https://sportlinkservices.freshdesk.com/nl/support/solutions/articles/9000062942-lijst-met-artikelen-van-club-dataservice): beschikbare artikelen/velden bij aansluiting verifiëren; geen impliciete toezegging van volledige ledenexport.
