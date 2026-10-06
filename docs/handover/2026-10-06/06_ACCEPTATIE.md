# 06 — Acceptatie en vrijgave

Alle criteria starten OPEN. De huidige groene prototypechecks veranderen geen A01–A30 of stagingcriterium in PASSED. Een volledige eerste stagingrelease vereist de basiscanon, nieuwe team-/coordination-/helpcriteria, operationele checks en alle visuele pagina’s.

## Registratieregel

Bewaar per criterium release-SHA, fixture/tenant/accountscope, testlaag, uitvoertijd, testbewijs, stagingbewijs en beoordelaar. Een unit-/DB-proef is geen visuele of providerproef. Leg een ontbrekende aansluiting vast als BLOCKED met concrete oorzaak; markeer haar niet als succesvol doordat een fixture dezelfde vorm teruggeeft.

## Bestaande A01–A30

### A01 — basiscanon

**Proef:** Huishouden doel720; bevestig480min vóór en240min na winter

**Verwacht:** Totaal720, resterend0; geen tweede-halftekort120.

**Lagen:** D,E. **Status:** OPEN.

### A02 — basiscanon

**Proef:** Bevestig720min vóór winter

**Verwacht:** Jaarvoldaan; geen verplichte plaatsing daarna; extra inzet vrijwillig.

**Lagen:** D,E. **Status:** OPEN.

### A03 — basiscanon

**Proef:** Bevestig240min vóór winter; winterdoel360; passende bestaande of nieuwe boeking na winter

**Verwacht:** Winterallocatie120; jaartotaal resterend480; bestaande boeking niet dubbel; herhaling maakt geen tweede allocatie.

**Lagen:** D,E. **Status:** OPEN.

### A04 — basiscanon

**Proef:** 240min bevestigd en120min pending vóór winter; start wintercontrole

**Verwacht:** Eerst pending beoordelen; vóór oplossing geen definitieve tekortplaatsing; na bevestiging winterdoelgehaald.

**Lagen:** D,E. **Status:** OPEN.

### A05 — basiscanon

**Proef:** Voeg vrijstellende rol toe; ken geldig toe aan persoon in huishouden

**Verwacht:** Hele gekoppelde huishouden voldaan via structurele inzet; feitelijke minuten ongewijzigd; geen nieuwe systeemrechten.

**Lagen:** D,R,E. **Status:** OPEN.

### A06 — basiscanon

**Proef:** Beëindig erkende rol halverwege seizoen

**Verwacht:** Beoordelingsactie; geen automatische terugwerkende rekening of ongemotiveerd nieuw doel. Definitief doel volgt gemotiveerd besluit en eerdere inzet blijft tellen.

**Lagen:** D,E. **Status:** OPEN.

### A07 — basiscanon

**Proef:** Vader/moeder/lid16+ vullen eigen intake; bevoegde persoon nodigt extra uitvoerder uit

**Verwacht:** Eigen profielen; uitnodiging aanvaard + e-mail geverifieerd vóór toegang; uitvoerder kan toegestane dienst boeken.

**Lagen:** D,R,E. **Status:** OPEN.

### A08 — basiscanon

**Proef:** Buitenstaander bezit alleen intakecode en vraagt dossier/API/export op

**Verwacht:** Geen gegevens, toegang of handelingsbevoegdheid; geverifieerd maar ongeautoriseerd account evenmin.

**Lagen:** R,E. **Status:** OPEN.

### A09 — basiscanon

**Proef:** Gescheiden ouder A vraagt persoonlijke intake/contactgegevens van ouder B via UI/search/export/directe URL/API

**Verwacht:** Overal geweigerd; noodzakelijke gezamenlijke voortgang alleen volgens expliciet recht.

**Lagen:** R,E. **Status:** OPEN.

### A10 — basiscanon

**Proef:** Extra account/intake; daarna echte huishoudsplitsing rond gedeeld kind

**Verwacht:** Account/intake creëert geen tweede verplichting; tweede dossier heeft eigen code; commissie beslist koppeling; geen automatisch delen of dubbelen van uren/vrijstelling.

**Lagen:** D,R,E. **Status:** OPEN.

### A11 — basiscanon

**Proef:** OTP geldig/verlopen/hergebruik/teveel foute pogingen/te snelle herverzending; meerdere scopes

**Verwacht:** Alleen geldige eenmalige code geeft sessie; throttling werkt; rechten komen uit registratie. Uitgetreden rol geeft geen toegang.

**Lagen:** I,R,E. **Status:** OPEN.

### A12 — basiscanon

**Proef:** Voer teamtaak uit; keur andere taak goed voor markt en bevestig uitvoering

**Verwacht:** Eerste nul uren; tweede één boeking na vereiste goedkeuring/publicatie/uitvoering. Herhaalde goedkeuring geen duplicate. Scheidsrechter volgt beide mandaten.

**Lagen:** D,R,E. **Status:** OPEN.

### A13 — basiscanon

**Proef:** Twee afzonderlijke sessies boeken tegelijk laatste plaats

**Verwacht:** Precies één definitieve inschrijving; ander ontvangt conflict/wachtlijstoptie; geen overboeking, dubbele uren of ongeautoriseerd huishouden.

**Lagen:** D,I,E. **Status:** OPEN.

### A14 — basiscanon

**Proef:** Overname en wederzijdse ruil; verander tussentijds beschikbaarheid/kwalificatie

**Verwacht:** Hercontrole direct bij commit; voorwaarden van beide diensten gelden; oorspronkelijke inschrijving(en) pas na definitieve geschikte overdracht vervallen.

**Lagen:** D,I,E. **Status:** OPEN.

### A15 — basiscanon

**Proef:** Boek met oude afmeldafspraak, wijzig clubtermijn, boek opnieuw; meld ziek vlak voor start

**Verwacht:** Oude snapshot behouden; nieuwe afspraak gebruikt nieuwe waarde; gewone tijdgrens correct; ziekte/nood altijd meldbaar.

**Lagen:** D,E. **Status:** OPEN.

### A16 — basiscanon

**Proef:** Plan bar3/keuken2 via dag/week/maand; sleep, resize en formulierroute

**Verwacht:** Zelfde gecontroleerde dienstplaats, tijden en impact; minimale bezetting/overlap bewaakt; mobiel bruikbare equivalente lijst/formulier.

**Lagen:** D,E. **Status:** OPEN.

### A17 — basiscanon

**Proef:** Maak conceptrooster, publiceer batch, wijzig tekst, daarna bezette tijd/locatie wezenlijk

**Verwacht:** Concept geen aanbodmeldingen; publicatie opent booking; kleine wijziging geen nieuw aanbod; grote wijziging toont impact en gerichte herbevestiging/informatie.

**Lagen:** D,I,E. **Status:** OPEN.

### A18 — basiscanon

**Proef:** Importeer wedstrijd, herhaal, wijzig tijd/locatie, annuleer

**Verwacht:** Eén bronwedstrijd, geen dubbele voorstellen/meldingen; gekoppelde bezette diensten blijven tot bewuste afhandeling; juiste gezins- en commissieprogrammarechten.

**Lagen:** I,R,E. **Status:** OPEN.

### A19 — basiscanon

**Proef:** Draai twee lokale synctijden rond zomer-/wintertijd; simuleer mislukte/onvolledige import

**Verwacht:** Twee bedoelde lokale runs, idempotente retry, laatste succes/fout zichtbaar; laatst bekende wedstrijden niet als afgelast gemarkeerd door ontbrekende import.

**Lagen:** I,E. **Status:** OPEN.

### A20 — basiscanon

**Proef:** Eén persoon matcht nieuwe taak via twee rollen; meerdere taken dezelfde dag; herpublicatie/retry

**Verwacht:** Eén taakpush per persoon/taak; iedere nieuwe taak heeft eigen pushkans; hoogstens één aanbodmail per lokale dag; transactieberichten volgen eigen regels.

**Lagen:** D,I,E. **Status:** OPEN.

### A21 — basiscanon

**Proef:** Preview/test/publiceer template; ontbrekende/onjuiste variabele; providerretry/webhook

**Verwacht:** Veilige juiste invulling/terugval; volledige versie blijft bewaard; ongeldige template niet ongecontroleerd verstuurd; succesvolle verzending niet opnieuw aangemaakt; log eerlijk over aflevering.

**Lagen:** D,I,E. **Status:** OPEN.

### A22 — basiscanon

**Proef:** Publiceer exacte beleidsversie aan leden; bevoegde ouder accepteert expliciet voor twee kinderen

**Verwacht:** Twee acceptatieregistraties, ieder met lid/actor/hoedanigheid/tijd/exacte versie; onbevoegde vertegenwoordiging geweigerd.

**Lagen:** D,R,E. **Status:** OPEN.

### A23 — basiscanon

**Proef:** Open zonder akkoord; dien vraag in; publiceer nieuwe versie

**Verwacht:** Openen geen akkoord; opvolging/reminderstop voor vraag; oude tekst/acceptatie intact; ziekmelden, bestaande diensten en essentiële berichten bereikbaar.

**Lagen:** D,E. **Status:** OPEN.

### A24 — basiscanon

**Proef:** Kaart met meerdere uitvoerders/aanspreekpunt/subtaken; mention; afronden

**Verwacht:** Verschijnt in relevante Mijn acties; mention respecteert bronrechten en ontdubbelt; afronden geen urenpost.

**Lagen:** D,R,E. **Status:** OPEN.

### A25 — basiscanon

**Proef:** Verbind activiteit aan kaart/dienst/document; wijzig; probeer besloten items via andere rol

**Verwacht:** Samenhang behouden, impact gecontroleerd; geen data via agenda/export/search/directe link/storage/realtime/notificatie buiten scope.

**Lagen:** D,R,E. **Status:** OPEN.

### A26 — basiscanon

**Proef:** Doel720/uitgevoerd540; bezwaar; één en twee beoordelaars; afkoop; dubbel verwerken

**Verwacht:** Voorstel€37,50; bezwaar blokkeert definitieve verwerking; één beoordelaar onvoldoende; afkoop geen tweede tekortrekening; besluit-/geldtransactie herhaalbaar.

**Lagen:** D,R,I,E. **Status:** OPEN.

### A27 — basiscanon

**Proef:** Doorloop wachtlijstoffer/reserve/maatje/vacature; aanbodtekort, verlopen certificaat en overbelasting

**Verwacht:** Alle routes uitvoerbaar; geen ongeschikte plaatsing; tijdelijk aanbod vervalt correct; juiste signalen en opvolging; belangstelling verandert geen aanstelling.

**Lagen:** D,I,E. **Status:** OPEN.

### A28 — basiscanon

**Proef:** Laat waarderingsregel draaien, herhaal vanuit twee commissies; toon lief-en-leed aan onbevoegde

**Verwacht:** Eén relevante actie/bericht; eigenaar/uitvoerders/deadline/budget/status terugvindbaar; persoonlijke informatie afgeschermd; onbekende datum geeft geen verzonnen moment.

**Lagen:** D,I,R,E. **Status:** OPEN.

### A29 — basiscanon

**Proef:** Bevoegde functionaris registreert telefonische booking/melding/correctie namens lid; herstel fout

**Verwacht:** Actor, subject, reden en effect blijvend zichtbaar; onbevoegde actie geweigerd; correctie behoudt historie en sluit alleen betreffende geschil.

**Lagen:** D,R,E. **Status:** OPEN.

### A30 — basiscanon

**Proef:** Sluit seizoen; bereid nieuw voor; huishouden in meerdere teams; wijzig rol/huishouden na afsluiting

**Verwacht:** Oude stand/besluiten reproduceerbaar; gekozen sjablonen/herbevestigingen operationeel; nieuw seizoen apart; huishouden één keer in clubaggregaat.

**Lagen:** D,I,E. **Status:** OPEN.

## Nieuwe criteria voor de actuele prototype-uitbreidingen

### T01 — Bar heeft drie vrije plaatsen; reserveer die als cluster voor JO13; een vierde andere taak heeft al een booking.

**Verwacht:** Precies gekozen vrije plaatsen gereserveerd; bestaande booking onaangeroerd; openbare capaciteit daalt met gereserveerd aantal.

**Pagina’s:** P08, P02, P12. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T02 — Twee sessies proberen dezelfde laatste plaats: openbaar boeken en cluster reserveren; herhaal met winterallocation en waitlisthold.

**Verwacht:** Een winnaar per race; verliezer krijgt concrete conflictoptie. Geen dubbele reservering/booking of negatieve vrije capaciteit.

**Pagina’s:** P02, P08, P09, P12. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T03 — Reserveer één van drie plaatsen; boek één openbare en één teamplaats en verwerk een afmelding.

**Verwacht:** Zelfde drie stabiele position-ID’s; alle vier overzichten tonen dezelfde juiste capaciteit en bezetting na iedere commit.

**Pagina’s:** P02, P08, P12, P19. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T04 — Teamouder wijst een gereserveerde plaats toe aan Noor.

**Verwacht:** Allocation heeft lid; geen booking, teamuitvoering of uren. HH ziet uitvoerderkeuzeactie, team ziet toegewezen maar onbemenst.

**Pagina’s:** P12, P03, P04, P13. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T05 — Huishouden Noor kiest passende ouder als uitvoerder; andere teamouder probeert uitvoerder uit ander HH te boeken.

**Verwacht:** HH-boeking slaagt binnen grant; onbevoegde proxyhandeling wordt servermatig geweigerd. Audit toont actor en executor apart.

**Pagina’s:** P12, P03, P04, P09. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T06 — Teamdoel4; lidoverride0 met reden; nieuw seizoen ander doel; HH heeft twee kinderen in twee teams.

**Verwacht:** Doelen exact per lid/team/seizoen; nul geldig; HH-minutendoel verandert niet; teamouder ziet geen privé-override van andere teams.

**Pagina’s:** P12, P04, P22. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T07 — Bevestig één 180min-clusterplaats namens één van twee kinderen in hetzelfde HH.

**Verwacht:** Eén teamtelling voor gekozen lid en één HH-ledgerpost180; tweede kind blijft ongewijzigd; alle dashboards/projecties gelijk.

**Pagina’s:** P12, P03, P04, P09, P19. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T08 — Bevestig fruitteamtaak met0min; keur andere teamtaak vooraf voor90min besloten markt goed en voer uit.

**Verwacht:** Fruit telt één teamtaak en0HHmin; goedgekeurde90 telt eenmaal90HHmin en optionele ene teamtelling, geen tweede publieke bronbooking.

**Pagina’s:** P12, P03, P09, P19. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T09 — Refereetaak aanvragen; vrijwilligerscommissie probeert zonder matchreview; verkeerde rol probeert matchreview; wijzig requestversie.

**Verwacht:** Beide echte mandaten nodig op actuele versie; stale/wrong-grant review geweigerd; eenmaal goedgekeurde publicatie.

**Pagina’s:** P12, P07, P08. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T10 — Account wisselt clientrol/persoon/team-ID en roept direct cluster/assignment/attendance-RPC op.

**Verwacht:** Geen extra recht of datatoegang; tenant/teamscope/grants servermatig getoetst; veilige forbidden.

**Pagina’s:** P00, P12, P09. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T11 — Maak12 wekelijkse teamtaken; één valt buiten seizoen; retry valide reeks.

**Verwacht:** Ongeldige reeks maakt niets; geldige reeks exact12, unieke posities, retry geen duplicaat; harde leeftijd/kwalificatie op booking.

**Pagina’s:** P12, P07, P22. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T12 — Cluster vrijgeven zonder toewijzing; daarna proberen met assigned of bevestigde plaats.

**Verwacht:** Vrij cluster atomair openbaar; toegewezen/bezet cluster geweigerd; geen verlies toezegging of credits.

**Pagina’s:** P08, P12, P02. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T13 — Executor meldt overname; teamouder kiest nieuw lid; vervanger ongeschikt en vervolgens geschikt; retry.

**Verwacht:** Oude afspraak blijft tot geschikte vervanger commit; historie behouden; nieuwe credit/lid-snapshot exact; geen dubbel actieve booking.

**Pagina’s:** P12, P03, P04. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T14 — Na booking verhoogt beheer requested/approved minutes of wijzigt afmeldtermijn.

**Verwacht:** Bestaande bookingvoorwaarden blijven snapshot; historische credits niet stil verhoogd; concrete herzieningsroute of blokkade.

**Pagina’s:** P12, P03, P22. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T15 — Verenigingsdoel of toepasselijk teamdoel bereikt; ouder verplicht nieuwe taak; HH kiest vrijwillig extra.

**Verwacht:** Verplichte toewijzing geweigerd waar toepasselijk doel voldaan; eigen booking alleen met expliciet vrijwillig akkoord; geen tweede urendoel.

**Pagina’s:** P12, P09, P04. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T16 — Volledige winter-/jaarinzet al vóór winter; teamclusters verschijnen daarna in nieuw/seizoenscontext.

**Verwacht:** Geen extra verplichte jaarinzet; bookings/tellingen blijven binnen juiste seizoen; vrijwillige extra teamhulp vraagt passend akkoord.

**Pagina’s:** P09, P12, P19. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T17 — Teamouder en teamlid vragen private intake, finance, reason, anderteamplanning via scherm/RPC/zoek/export/storage/realtime.

**Verwacht:** Alle ongeautoriseerde varianten geweigerd; minimaal relevante eigen teamvoortgang blijft toegankelijk.

**Pagina’s:** P12, P09, P20, P23. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### T18 — Dubbele presence request, no-show, bezwaar en correctie voor teambooking met180min.

**Verwacht:** Eén geldige attendance/ledger/team-entry per effect; correctie/tegenpost herleidbaar; alleen betreffende casus gesloten en alle meters gelijk.

**Pagina’s:** P03, P12, P09, P20. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C01 — Advies voor cluster met IVA, minderjarige, beschikbaarheid, vrijstelling en meerdere huishoudteams.

**Verwacht:** Ongeschikt huishouden niet aanbevolen; uitleg noemt duur/last/geschiktheid; medische/intakereden blijft privé; advies kiest niets definitief.

**Pagina’s:** P08, P12, P23, P17. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C02 — Teamouder past voorstel aan; tegelijk andere sessie wijzigt één allocation; bevestig oude voorstel.

**Verwacht:** Stale batch maakt geen gedeeltelijke toewijzingen/bookings; herstel toont nieuw voorstel. Geldige batch alleen lidtoewijzingen.

**Pagina’s:** P12, P13. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C03 — Eén IVA-ouder in HH, twee gelijktijdige barplaatsen; verschillende leden zelfde HH en andere open toewijzing.

**Verwacht:** Virtuele voorstelvalidatie biedt die ouder niet tweemaal; vervangingsvraag telt plaatsbelasting niet dubbel; echte executor nog niet gekozen.

**Pagina’s:** P12, P08, P04. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C04 — Twee kinderen/twee teams, eigen tasks/matches; open als beheerder met eigen HH en ander lid.

**Verwacht:** Eén HH-meter, afzonderlijke teamdoelen; timeline zonder andermans privédata; family-matchwarning zacht, eigenpersonoverlap hard.

**Pagina’s:** P04, P12, P07. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C05 — Open choose/assign/confirm/feedback/followup/handover/instructions en beleids-/winteracties; handel af.

**Verwacht:** Acties ontdubbeld, correct geprioriteerd, directe contextlink; afgehandelde bron verdwijnt; kaartDone geeft geen uren.

**Pagina’s:** P13, P12, P03, P15. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C06 — Doorloop dag vóór/op/na selfdeadline en assign-deadline; pas ongeldige/gelijke/na-taakdatums toe.

**Verwacht:** Gedocumenteerde inclusieve grens; unassigned zelfboeken sluit; assigned HH kan executor bevestigen; deadlines vóór taak; geen bookingautoannulering.

**Pagina’s:** P12, P13, P14. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C07 — Commissiefase; reservebereide persoon in team/anderteam/ongeschikt; twee workers retry dezelfde request/dag.

**Verwacht:** Alleen passende eigen-teamHH ontvangers eenmaal; extra inzet vrijwillig; reserve-invite geen booking of rechten buiten gekozen places.

**Pagina’s:** P12, P23, P14. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C08 — Bereid5-checkhandover naar volwassene, save nieuwe versie; verkeerde actor of oude versie accepteert.

**Verwacht:** Draft/private en Ready/toegang juist; oude ouder blijft tot juiste actuele accept; stale/andere actor geweigerd.

**Pagina’s:** P12, P13, P14. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C09 — Nieuwe contactpersoon zonder bestaand teamoudermandaat accepteert geldige readyhandover; er is nog tweede teamouder.

**Verwacht:** Specifiek ontvangermandaat volstaat voor accept; atomair oud mandaat beëindigd, nieuw exact-teammandaat actief; tweede ouder, doelen, bookings en uren behouden.

**Pagina’s:** P12, P22, P09. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C10 — Executor en volwassen HH-proxy geven feedback na aanwezigheid; proxy probeert voorkeur uitvoerder te wijzigen.

**Verwacht:** Alleen toegestaan subject/actor; andere voorkeurwijziging geweigerd; eigen voorkeur expliciet; feedback geeft0ledger/team-effect.

**Pagina’s:** P16, P23, P03. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### C11 — Commissie/teamouder verbetert instructie en kiest toekomstige gelijke type-scope.

**Verwacht:** Nieuwe versie op juiste toekomsttaken; vorige aangeboden instructie historisch intact; andere team/commissie onaangeroerd; geen creditswijziging.

**Pagina’s:** P16, P12, P10. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### H01 — Sluit uitleg met kruis; reload, andere rol en tweede apparaat zelfde account.

**Verwacht:** Hetzelfde stabiele onderwerp blijft verborgen; opgeslagen door echte accountidentiteit, niet clientpersoon/rol.

**Pagina’s:** P00, P22. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### H02 — Sluit met Gezien; probeer via toetsenbord en touch.

**Verwacht:** Exact hetzelfde opslageffect als kruis; geen formulier-submit; juiste focus/labels en bannerlayout.

**Pagina’s:** P00. **Lagen:** E2E,VIS. **Status:** OPEN.

### H03 — Andere echte gebruiker bezoekt dezelfde functie.

**Verwacht:** Banner is zichtbaar voor die gebruiker; geen globale dismissal of gedeelde persoonsverwisseling.

**Pagina’s:** P00, P23. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### H04 — Twee tabs sluiten twee onderwerpen tegelijk; instabiele verbinding en hernieuwde sessie.

**Verwacht:** Merge/upsert behoudt beide; geen eerder gezien-bannersflits; opslagfout herstelbaar; read/write alleen eigen voorkeuren.

**Pagina’s:** P00. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### H05 — Loop iedere pagina/tab/form/modal uit registry langs met unseen voorkeuren.

**Verwacht:** Zachte gele uitleg aanwezig boven relevante functie, eenvoudige actuele tekst, geldige unieke stabiele topics; geen modal zonder hulp.

**Pagina’s:** P00. **Lagen:** E2E,VIS. **Status:** OPEN.

### H06 — Fixture-reset, seizoenwissel en rolwijziging; direct RPC met andermans auth-user-ID.

**Verwacht:** Seen blijft per eigen account; geen reset of toegang tot andermans dismissal; nieuwe content forceert geen ongevraagde herhaling.

**Pagina’s:** P00, P22. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### F01 — 720/540,480/360,20min tekort,0doel,volledige dekking en afkoop met oudere claim.

**Verwacht:** Respectievelijk3750/2500/417/0/0cent; afkoop eenmaal15000 zonder tweede claim, tarief constant en een eindafronding.

**Pagina’s:** P20, P09, P19. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### F02 — Nieuw urenbezwaar/pending/coveragewijziging tegelijk met finalize; verschillende reviewerlabels zelfde account.

**Verwacht:** Consistente blokkade of expliciete herziening; geen genegeerd bezwaar; twee verschillende bevoegde accounts op actuele proposal nodig.

**Pagina’s:** P20, P09, P03. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### F03 — Markeer betaalde factuur tweemaal; corrigeer betaalde ontvangst en onbetaalde afspraak.

**Verwacht:** Een echte ontvangstpost; betaalde correctie als traceerbare credit/verrekening, niet wissen; unpaid void met reden en historie.

**Pagina’s:** P20, P19. **Lagen:** DB,RLS,E2E. **Status:** OPEN.

### O01 — Geldige mainpush-CI promotie-SHA, oude/verkeerde SHA en non-fast-forward staging.

**Verwacht:** Exact promotiescriptgedrag; geen mergecommit/force; succesvolle SHA-identiteit en provenance in artifact.

**Pagina’s:** P00. **Lagen:** OPS. **Status:** OPEN.

### O02 — Actionsremote stagingmigratie met verkeerde projecttarget/history, lokaal groen schema maar remoteachterstand.

**Verwacht:** Target/historyguard stopt; alleen appendmigrations release-SHA; appdeploy pas na geslaagde compatibele migratie; geen remote reset.

**Pagina’s:** P00. **Lagen:** OPS,DB. **Status:** OPEN.

### O03 — VPS app-mode met juiste/onjuiste origin/Supabaseproject, mode of digest/SHA.

**Verwacht:** Alle bestaande target/rootless/lock/run/SHA-guards intact; app start alleen vast stagingtarget; production blijft geblokkeerd.

**Pagina’s:** P00. **Lagen:** OPS. **Status:** OPEN.

### O04 — Worker uit, DB onbereikbaar, schemaachterstand; live-page nog200.

**Verwacht:** Readiness geeft correcte beperkte/falende status incl nodige workers/schema; geen full-ready op alleen frontendliveness.

**Pagina’s:** P00, P14, P07. **Lagen:** OPS,I. **Status:** OPEN.

### O05 — Stagingmail/OTP/push/campaign gepland naar buiten allowlist; provider timeout na mogelijk accept.

**Verwacht:** Geen ongeautoriseerde echte ontvangers; correctsandbox, Unknown/reconcile/dedupe in plaats van blind dubbel; logs zonder tokens.

**Pagina’s:** P14, P21, P22. **Lagen:** I,E2E,OPS. **Status:** OPEN.

### O06 — Workercrash na leaseclaim/commit, tweede worker en retries van sync/digest/reminder.

**Verwacht:** Unieke occurrence, begrensde leases/backoff, geen duplicaat; juiste lokale DST-slot en zichtbaar herstel/deadletter.

**Pagina’s:** P07, P14, P12. **Lagen:** DB,I,OPS. **Status:** OPEN.

### O07 — Remote login/invite/storage/RPC/export en twee-tenantprivacy via direct requests.

**Verwacht:** Auth redirects veilig, alleen expliciete grants; secret/admin key nooit browser; private objects/downloads bronrecht.

**Pagina’s:** P00, P09, P23, P11. **Lagen:** RLS,I,E2E,OPS. **Status:** OPEN.

### O08 — Backup maken, restore op geïsoleerd doel, vorige image na compatibele migration, mislukte release.

**Verwacht:** Controleerbaar restorebewijs en imageherstel; schema/objects/config consistent; geen claim dat image-rollback DB terugdraait.

**Pagina’s:** P22. **Lagen:** OPS,DB. **Status:** OPEN.

### O09 — CSV met quotes/delimiters/zelfde email twee source-IDs en onbekende leeftijd; providerpartial failure.

**Verwacht:** Dryrunconflict, geen automerge of verzonnen bronveld; expliciete confirm; partial import annuleert niets.

**Pagina’s:** P22, P09, P07. **Lagen:** DB,I,E2E. **Status:** OPEN.

### O10 — Sluit/rollover seizoen met teamdata, workers/herbevestiging; herhaal; oude correctie.

**Verwacht:** Immutable nieuwe en oude stands, precies geselecteerde templates, operationele reconfirmation, geen dubbele obligation/autooveruren, correctiehistorie.

**Pagina’s:** P22, P09, P12, P19. **Lagen:** DB,I,E2E. **Status:** OPEN.

## Visuele pagina-acceptatie

V00 is de shell. V01–V23 volgen één op één de pagina-ID’s. Iedere proef omvat alle beschreven tabs, primaire states en modalen bij de betrokken rollen, op desktop, mobiel en medium. Het volledige visuele register staat in JSON; laat geen pagina op PASS zonder haar eigen captures.

## Volledige gereedverklaring

Geen dead button, UI-only autorisatie, fictieve verzending of globale clientinstelling achter een persoonlijke functie. Alle tellers tonen hetzelfde bronresultaat. Als één onderdeel nog niet operationeel is, vermeld het als resterend werk; de gebruiker vroeg om alle samenhangende logica. `v1_ready` en productie blijven false totdat de aparte scope en bewijsvoorwaarden daadwerkelijk zijn gehaald.
