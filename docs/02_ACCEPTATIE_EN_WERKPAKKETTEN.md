# Cluvo — acceptatie en verticale werkpakketten

Overdrachtsversie 1.0 · 2 oktober 2026

## 1. Doel en opleverritme

Bouw de volledige V1 in Next.js met Supabase. Het visuele prototype blijft de referentie voor Club Signal. Elk werkpakket levert een route op die van scherm via serveractie naar database en terug werkt, inclusief autorisatie, foutpad en relevante bewijsvoering. Lever geen verzameling nieuwe schermen op die opnieuw alleen in een browserobject werken.

Werk op staging tot de volledige V1 gereed is. `main` is de ontwikkel- en integratiebron voor staging. Productiepromotie is een afzonderlijke latere handeling van een gecontroleerde stagingrelease. Testdata, sleutels, providers en database moeten tussen omgevingen gescheiden zijn. Het deploymentdocument van dit pakket beschrijft de precieze branches, artifacts, runners, back-ups en gates.

WP1–WP12 zijn een **werkvolgorde binnen V1**, geen gefaseerde scopes waarmee verplichte functies verdwijnen. De relevante acceptatieproeven worden per werkpakket toegevoegd; pas een volledig geslaagde matrix A01–A30, alle aanvullende scenario's en operationele controles rechtvaardigt “Volledige V1”.

## 2. Algemene oplevervoorwaarden per werkpakket

1. De gebruiker kan het resultaat end-to-end op staging uitvoeren met daarvoor toegestane accounts.
2. Lees- én schrijfrechten zijn gecontroleerd aan de serverzijde en in de database. Negatieve tests gebruiken echte verschillende sessies/rollen, geen clientrolwissel.
3. Belangrijke mutaties zijn transactioneel en hebben een herhaalbare uitkomst; retry of dubbel klikken maakt geen dubbele boeking, urenpost of financiële afspraak.
4. De interface toont laden, validatiefout, conflict, lege uitkomst, ontbrekende koppeling en verbindingsverlies begrijpelijk. Definitieve bevestiging volgt pas op een opgeslagen serverresultaat.
5. Relevante actor, bevoegdheid, reden, versie en tijdstip zijn traceerbaar. Log geen OTP, servicegeheimen of onnodige gevoelige intaketekst.
6. Mobiele lijst-/formulierbediening heeft dezelfde mogelijkheden en voorwaarden als desktop. Slepen is nooit de enige route.
7. Gemigreerde gegevens, query's, indexen en constraints zijn reproduceerbaar via migraties; geen handmatige databasewijzigingen als verborgen afhankelijkheid.
8. De README en bewijsregistratie noemen wat werkelijk is uitgevoerd en welke externe inrichting nog ontbreekt. Geen groen vinkje op basis van alleen geschreven code.

## 3. Verticale implementatievolgorde

### WP0 — overdracht en reproduceerbare start

WP0 is de technische intake vóór de twaalf inhoudelijke werkpakketten. Controleer de broncommit, pakketchecksums, bestaande repository-instructies en beschikbare infrastructuur. Start de meegeleverde Next.js-app, voer typecheck, tests en build uit en leg de visuele baseline vast. Controleer dat production geblokkeerd blijft. Richt uitsluitend de private repository en stagingbootstrap in voor zover de daarvoor benodigde toegang is gegeven. Het slagen van WP0 betekent niet dat een canonproef al als productiefunctionaliteit is opgeleverd.

### WP1 — basis, tenant en echte toegang

**Gebruikersresultaat:** een bevoegde persoon meldt zich met e-mail-OTP aan bij zijn vereniging en ziet alleen zijn beschikbare werkruimtes.

- Maak de officiële Next.js-productiestructuur; breng herbruikbare Club Signal-componenten en assets over. Houd het prototype herkenbaar afzonderlijk beschikbaar als referentie.
- Introduceer vereniging, account, persoon, lidmaatschap, toestemming/systeemrol, functionele aanstelling en scope. Maak alle acht canonrollen configureerbaar inzetbaar, inclusief afzonderlijke vrijwilligerscoördinator.
- Verbind Supabase Auth e-mail-OTP met echte sessievalidatie, gecontroleerde uitnodiging en toegestane accountkoppeling. Een intakecode is nooit authenticatie.
- Implementeer scoped serverqueries, mutaties, databasepolicies en documentopslag. Geen gevoelige brede dataset naar de client sturen.
- Maak stagingdeploystraat, configuratievalidatie, basishealthchecks, synthetische fixtures voor twee verenigingen en tests voor tenantisolatie.

**Bewijs:** A08, A11 en eerste autorisatiedeel A25; naast UI ook directe database-/API-afwijzingen. Productieroute blijft geblokkeerd.

### WP2 — huishouden, uitnodiging en persoonlijke intake

**Gebruikersresultaat:** ouder nodigt een extra uitvoerder uit; die accepteert en vult persoonlijk in; gescheiden ouders delen alleen toegestane gezamenlijke voortgang.

- Maak dossier, code, personenrelaties, vertegenwoordiging, verplichtingskoppeling en contactafspraken; geen impliciete fusie op adres/e-mail.
- Implementeer intake voor vader/moeder/lid16+, extra uitvoerder, begeleid invullen, praktische beperking zonder medische bewijsvelden, jaarlijkse herbevestiging.
- Implementeer gescheiden-oudersroutes met afzonderlijke accounts en volledige veld-/dossierafscherming.
- Implementeer koppelen/splitsen/herstellen als echte gecontroleerde transitie, met impactvoorstel en beoordeelde toerekening van verplichtingen en bestaande inzet.
- Voeg portefeuilles voor vrijwilligerscoördinatoren en tijdgebonden team-/commissierelaties toe.
- Bouw gecontroleerde ledenimportpreview, stabiel bronnummer, veldmapping en herstelbare fouten. Onzekere koppelingen blijven voorstellen.

**Bewijs:** A07–A10, delegatiedeel A29, ont-dubbeling uit A30. Proef met gedeeld e-mailadres toont één identiteit, geen schijnbaar gescheiden toegang.

### WP3 — verplichting, urenbasis, erkende rollen en uitzonderingsbesluit

**Gebruikersresultaat:** het huishouden ziet een betrouwbare stand; een erkende trainer stelt het juiste hele huishouden vrij; beëindiging start een beoordeling.

- Implementeer seizoensverplichting en expliciete doelen in gehele minuten; bewaar geldende beleids-/besluitversie.
- Maak urenboekingen en correcties append-only of equivalent controleerbaar; geplande, pending en bevestigde inzet zijn verschillend.
- Maak configureerbare vrijstellende rolcatalogus, aanstelling met geldigheid en bevestiger, huishoudeffect zonder fictieve uren of extra toegangsrechten.
- Implementeer aanvraagtypen: aangepaste inzet, uitstel, vermindering, tijdelijke/volledige vrijstelling, afkoop en beoordeling bij start/einde van rollen of dossierwijziging.
- Bouw tweebeoordelaarsworkflow met unieke bevoegde acteurs, versiehash/revisie, afwijzing, motivering, effectieve doelen/looptijd, belangenconflict, bestuursescalatie en bezwaar.
- Maak winterwerklijst die pending uitvoering eerst laat beoordelen; plaatsingsactie wordt verbonden met WP4/WP5.

**Bewijs:** A01, A02, A04–A06, besluitdeel A26. Voor A03 gebruiken WP4/WP5 dezelfde domeinservices; geen tweede rekenimplementatie.

### WP4 — catalogus, markt, planbord en veilige boeking

**Gebruikersresultaat:** commissie maakt en publiceert een rooster; een geschikt huishoudlid reserveert een echte plek en ziet die direct in Mijn diensten.

- Maak taaktypen, toegestane urenwaarden, commissiecategorieën, dienst, bezettingsplaatsen, voorwaarden, vensters, contactpersoon en instructieversie.
- Implementeer taaktype-/afwijkende-urenwaardegoedkeuring; commissies publiceren binnen het eigen mandaat.
- Maak dag/week/maand, minimaal bar3/keuken2, verplaatsen/resize/formulier, losse opeenvolgende bezetting per plaats, sjablonen, kopiëren, herhaling, concepten en batchpublicatie.
- Gebruik één geschiktheidsservice voor leeftijd op taakdatum, kwalificatie/expiry, harde beschikbaarheid, verhindering, overlap, begeleiding en minimale bevoegde bezetting.
- Maak atomaire serverboeking met veilige retry; huishouduitvoerderkeuze is geautoriseerd, huidige plaatscapaciteit wordt onder transactie gecontroleerd.
- Voeg alle canonfilters, verklaarbare taaksuggesties, hulpverzoek, gezin-/wedstrijdconflictsignaal en mobiel roosterlijstalternatief toe.
- Publicatie maakt het aanbod-event; concepten en kleine wijzigingen doen dat niet. Maak individuele impact en herbevestiging bij wezenlijke wijziging.

**Bewijs:** A13, A16, A17; boekingsvoorwaarden van A27. Gebruik twee afzonderlijke clients voor concurrentie. Plaatsidentiteit blijft gelijk na verplaatsen en resize.

### WP5 — uitvoering, winterplaatsing, ruil en bezettingsherstel

**Gebruikersresultaat:** een dienst kan tijdig of laat worden afgemeld, altijd ziek/nood gemeld, gecontroleerd geruild en daarna bevestigd met juiste uren.

- Implementeer statusmachine voor boeking, overname, wederzijdse ruil, op tijd/laat afmelden, ziekte/nood, aanwezig/partial/no-show, clubannulering en in beoordeling.
- Bewaar afgesproken afmelddeadline, urenwaarde en dienstversie bij boeking; behandel belangrijke latere wijzigingen expliciet.
- Maak ruil-/overnameaanbod met instemming, geldigheid en atomaire overdracht. Oorspronkelijke inschrijving vervalt pas na definitieve commit.
- Maak wachtlijst met tijdelijk exclusief aanbod aan de eerstvolgende geschikte kandidaat; verlopen aanbod gaat naar volgende kandidaat. Voeg reservepoolbenadering toe.
- Maak uitvoering bevestigen, afwijking met reden, bevestigingstermijn, foutmelding, correctiedeadline en onbeperkt herstel van aantoonbare administratieve fout via bevoegde route.
- Implementeer winterallocaties naar bestaande of nieuwe passende boekingen, zonder dubbele allocatie en binnen beoordeeld jaartekort.
- Maak bevoegde telefonische registratie met actor, subject, reden en effect; beëindiging van één geschil laat andere open geschillen intact.

**Bewijs:** A03, A04, A14, A15, relevante A27 en A29. Test uitval van buddy en relevante voorwaarden direct vóór definitieve overdracht.

### WP6 — commissies, kanban, teamouders en persoonlijke acties

**Gebruikersresultaat:** commissie plant werk met meerdere uitvoerders; teamouder organiseert eigen team en vraagt een markttaak aan; Mijn acties verzamelt opvolging.

- Maak commissieleden/coördinatoren met geldigheid en eigen werkruimte voor instructies, documenten, gesprekken, rooster en kanban.
- Maak per-bord aanpasbare kolommen, kaarten met omschrijving, prioriteit, labels, start/deadline, bijlagen, reacties, geschiedenis, checklists en subtaken met eigen uitvoerders.
- Maak meerdere kaartuitvoerders, optioneel aanspreekpunt en relaties met activiteiten, wedstrijden, documenten en diensten.
- Maak echte gescopeerde gesprekken en mentions naar persoon-ID. Een mention kan geen bronrechten toekennen; toewijzing + mention vanuit één gebeurtenis worden ontdubbeld.
- Mijn acties bevat toegewezen kaarten/subtaken, mentions, deadlines, hulpverzoeken en opvolging uit alle toegestane werkruimtes.
- Teamouder ziet eigen teams en toegestane huishoudvoortgang; normale teamtaak is nul uur. Marktverzoek vraagt taakinhoud/urenvoorwaarden; wedstrijdzaken keurt zo nodig eerst scheidsrechternoodzaak/bevoegdheid goed.
- Vrijwilligerscommissie beslist over teamtaakuren en marktpublicatie; één bronkoppeling voorkomt dubbele uitvoering/uren.

**Bewijs:** A12, A24, rechten-/relatiedeel A25. Geen urenpost na kaart afronden, checklist afronden of nul-urenteamtaak uitvoeren.

### WP7 — Sportlink, wedstrijdgestuurde planning en jaaragenda

**Gebruikersresultaat:** gezin ziet geautoriseerd wedstrijdprogramma; commissie ontvangt conceptdiensten en verwerkt wedstrijdwijzigingen bewust.

- Verifieer bij inrichting de geautoriseerde Sportlinkbron en werkelijk beschikbare velden. Geen belofte dat publieke Dataservice volledige privéledenvelden bevat.
- Implementeer provideradapter met stabiel bron-ID, delta, idempotente upsert, laatste succes, foutstatus, handmatige refresh en onvolledige-importbescherming.
- Scheduler voert twee lokale momenten uit, inclusief DST-overgangen, concurrencylock, retry en instelbaarheid.
- Maak dienstenvoorstellen uit echte thuiswedstrijden en relatieve roostersjablonen; publicatie blijft commissiehandeling. Wijziging/afgelasting geeft impact, nooit stille verplaatsing/verwijdering.
- Maak agenda met Mijn/gezin/team/commissie/vereniging, lagen, locatie, organisator, deelnemers, RSVP, herhaling/uitzonderingen, herinneringen, documenten, comments en mentions.
- Houd kaarten/diensten gekoppeld aan één bronafspraak; wijzigingsimpact en overlapcontrole omvatten locaties én deelnemers.

**Bewijs:** A18, A19 en agenda-/privacydeel A25; zesweekmaand, herhaalde import, time-out, ontbrekend bronveld en dubbel familiepad testen.

### WP8 — communicatie, beleidsacceptatie en notificaties

**Gebruikersresultaat:** lid ontvangt begrijpelijke dienstmeldingen en passend aanbod, beheert kanalen en accepteert beleid expliciet voor bevoegde personen.

- Maak outbox/inbox met stabiel event-ID, ontvanger, kanaal en templateversie; handlers werken herhaalbaar en reconciliëren onzekere provideruitkomsten.
- Bouw persoonlijke kanaalvoorkeuren en categorieën, pushsubscription met bewuste toestemming, limietloze afzonderlijke taakpush en maximaal één aanbodmail per lokale dag.
- Filter de digest op nog bruikbaar aanbod. Bevestigingen en essentiële dienstinformatie lopen onafhankelijk van de aanbodmaillimiet.
- Maak centrale/commissietemplates met concept, complete versie, voorbeeld voor meerdere personen/missende velden, veilige variabelen, test, goedkeuring, afbeelding/knop, afzender/reply/preheader.
- Verzendlog onderscheidt gepland, provider geaccepteerd, bevestigd afgeleverd, mislukt, retry en onzekere status. Testomgeving verstuurt uitsluitend naar toegestane testontvangers.
- Bouw beleidconcept, goedkeuring, exacte gepubliceerde versie, doelgroep/ingang/reactietermijn, aangeboden/geopend/akkoord/vraagstatus en bewijsdownload/export.
- Bevestiging is een actieve accountactie per lid; expliciete vertegenwoordiging per kind; oude tekst en acceptatie blijven behouden. Heracceptatie en herinneringsstop volgen een bewust besluit/status.

**Bewijs:** A20–A23. Geen akkoord op alleen openen/scrollen; essentiële diensten en ziekmelden blijven toegankelijk bij beleidsvraag.

### WP9 — gecontroleerde afrekening en vrijwilligerspot

**Gebruikersresultaat:** vrijwilligerscommissie keurt het vastgestelde tekort goed; financieel beheer verwerkt één juiste bijdrage en bewaakt besteding.

- Maak afrekenvoorstel uit geldend doel, bevestigde ledger, definitieve uitzonderingen, rolstatus, afkoop en open beoordelingen; reken in minuten/centen.
- Laat passend aanbod en alternatieven aantoonbaar beoordelen vóór afkoop/afrekening. Alleen ontbrekend aanbod maakt geen factuur.
- Scheid inhoudelijke goedkeuring van financiële verwerking en toegang tot aanvraagachtergronden. Maak factuur óf gecontroleerde export volgens inrichting, betaalstatus en audit.
- Unieke actieve financiële route per verplichting voorkomt afkoop plus tekortrekening. Bouw correctie/credit/herziening zonder oude grondslag te wissen, ook na betaling.
- Pot ondersteunt ontvangen, gereserveerd, besteed en beschikbaar, met doel, eigenaar en vereiste goedkeuring. Een reservering die wordt betaald telt niet tevens als blijvende reservering.

**Bewijs:** A26 en extra financiële scenario's hieronder; concurrencytest op twee maal verwerken en meerdere nog open bezwaren.

### WP10 — waardering, ontwikkeling en structurele vrijwilligers

**Gebruikersresultaat:** de club ondersteunt vrijwilligers met maatjes, opleidingen, een passende functie en aandacht op relevante momenten.

- Maak opleidingsaanbod, deelname, inwerken, instructiebevestiging, kwalificatie met bewijs/geldigheid en consequenties op bestaande toekomstige diensten.
- Bouw functiebeheer van vacature tot belangstelling, kennismaking, aanstelling en jaarlijkse herbevestiging. Belangstelling geeft geen rol/vrijstelling.
- Maak gewenste inzet per afgesproken periode, reservebeschikbaarheid en signalen bij herhaald invallen/overbelasting.
- Maak waarderingsregels voor gecontroleerde verjaardag, lidmaatschaps-/vrijwilligersjubileum, opleiding, afscheid en ander goedgekeurd moment; onbekende brongegevens leiden tot controle, geen verzonnen datum.
- Eén gelegenheid resulteert in één actie/bericht volgens de regel, ook over commissies heen; eigenaar, meerdere uitvoerders, deadline, budget en afhandeling. Lief en leed en publieke felicitatie apart autoriseren.

**Bewijs:** A27 en A28. Test onvolledige geboortedatum, dubbele gelegenheid, vervallen kwalificatie en inzet verdeeld over twee maanden.

### WP11 — dashboards, rapportages en seizoenscyclus

**Gebruikersresultaat:** bestuur kan bijsturen en een seizoen sluiten zonder verlies van bewijs of dubbele huishoudtelling.

- Voltooi rolgerichte dashboards en persoonlijke PWA: volgende actie, echte huishoudstand, erkende functie, diensten, wedstrijden, agenda, berichten, acties, profiel en afspraken.
- Maak bestuur-/commissieoverzichten voor bezetting, deelname, open uren, passend aanbod, uitval, vacatures, opleidingen, werkdruk en besteding.
- Aanbodrapportage gebruikt dezelfde geschiktheidsregels en tijdvak als inschrijving; capaciteit en passende behoefte worden naast elkaar getoond.
- Bouw seizoensvoorbereiding en afsluiting met openpuntencheck, onveranderlijke oude stand en besluiten, nieuwe verplichtingen, gekozen sjablonen en herbevestiging van functies/intakes/beleid.
- Test instroom, vertrek, splitsing en tussentijds rolverlies over seizoensgrenzen; oude boekingen blijven bij oorspronkelijke verplichting en oude export blijft reproduceerbaar.

**Bewijs:** A30 en rapportagegedeelte A27. Een kind in twee teams of twee kinderen in verschillende teams telt het huishouden clubbreed eenmaal.

### WP12 — volledige releaseproef en stagingvrijgave

**Gebruikersresultaat:** een complete vereniging kan alle V1-processen op staging betrouwbaar doorlopen.

- Voer uitnodiging → intake → boeking → wijziging/ruil → uitvoering → wintercontrole → uitzondering → afrekening → seizoenovergang als samenhangende keten uit.
- Voltooi A01–A30, de 28-voorstellenmatrix, negatieve autorisatieproeven en mobiele toegankelijkheid. Leg commit, migratieversie, testresultaten en screenshots per belangrijke rol vast.
- Verifieer werkelijk ingerichte externe koppelingen, jobs, e-mailstatus, push, back-upherstel, rollback en operationele signalering. Onbeschikbare integratie blijft expliciet releaseblokker voor de bijbehorende functie.
- Laat Danny de volledige V1 op staging beoordelen. Productie blijft uit tot expliciete vrijgave; de stagingrelease moet vervolgens exact herleidbaar gepromoveerd kunnen worden.

## 4. A01–A30: bindende acceptatiematrix

**Beginstatus bij deze overdracht: alle productieproeven zijn OPEN.** Het prototype en eventueel aanwezige demotests zijn bruikbare referenties, maar bewijzen geen veilige Supabase- of providerwerking. Codex moet aan iedere rij werkelijk bewijs toevoegen.

Bewijscodes: **D** = domein-/databasetest, **R** = negatieve rechten-/isolatietest, **I** = integratie-/jobtest, **E** = browserroute met serverreadback. Iedere bewijsregistratie bevat commit, migratieversie, fixture, omgeving, resultaat en tijdstip.

| ID | Invoer en handeling | Vereiste uitkomst | Bewijs | WP |
|---|---|---|---|---|
| A01 | Huishouden doel720; bevestig480min vóór en240min na winter | Totaal720, resterend0; geen tweede-halftekort120. | D,E | 3,5 |
| A02 | Bevestig720min vóór winter | Jaarvoldaan; geen verplichte plaatsing daarna; extra inzet vrijwillig. | D,E | 3 |
| A03 | Bevestig240min vóór winter; winterdoel360; passende bestaande of nieuwe boeking na winter | Winterallocatie120; jaartotaal resterend480; bestaande boeking niet dubbel; herhaling maakt geen tweede allocatie. | D,E | 3,5 |
| A04 | 240min bevestigd en120min pending vóór winter; start wintercontrole | Eerst pending beoordelen; vóór oplossing geen definitieve tekortplaatsing; na bevestiging winterdoelgehaald. | D,E | 3,5 |
| A05 | Voeg vrijstellende rol toe; ken geldig toe aan persoon in huishouden | Hele gekoppelde huishouden voldaan via structurele inzet; feitelijke minuten ongewijzigd; geen nieuwe systeemrechten. | D,R,E | 3 |
| A06 | Beëindig erkende rol halverwege seizoen | Beoordelingsactie; geen automatische terugwerkende rekening of ongemotiveerd nieuw doel. Definitief doel volgt gemotiveerd besluit en eerdere inzet blijft tellen. | D,E | 3,9 |
| A07 | Vader/moeder/lid16+ vullen eigen intake; bevoegde persoon nodigt extra uitvoerder uit | Eigen profielen; uitnodiging aanvaard + e-mail geverifieerd vóór toegang; uitvoerder kan toegestane dienst boeken. | D,R,E | 2,4 |
| A08 | Buitenstaander bezit alleen intakecode en vraagt dossier/API/export op | Geen gegevens, toegang of handelingsbevoegdheid; geverifieerd maar ongeautoriseerd account evenmin. | R,E | 1,2 |
| A09 | Gescheiden ouder A vraagt persoonlijke intake/contactgegevens van ouder B via UI/search/export/directe URL/API | Overal geweigerd; noodzakelijke gezamenlijke voortgang alleen volgens expliciet recht. | R,E | 2 |
| A10 | Extra account/intake; daarna echte huishoudsplitsing rond gedeeld kind | Account/intake creëert geen tweede verplichting; tweede dossier heeft eigen code; commissie beslist koppeling; geen automatisch delen of dubbelen van uren/vrijstelling. | D,R,E | 2,11 |
| A11 | OTP geldig/verlopen/hergebruik/teveel foute pogingen/te snelle herverzending; meerdere scopes | Alleen geldige eenmalige code geeft sessie; throttling werkt; rechten komen uit registratie. Uitgetreden rol geeft geen toegang. | I,R,E | 1 |
| A12 | Voer teamtaak uit; keur andere taak goed voor markt en bevestig uitvoering | Eerste nul uren; tweede één boeking na vereiste goedkeuring/publicatie/uitvoering. Herhaalde goedkeuring geen duplicate. Scheidsrechter volgt beide mandaten. | D,R,E | 6 |
| A13 | Twee afzonderlijke sessies boeken tegelijk laatste plaats | Precies één definitieve inschrijving; ander ontvangt conflict/wachtlijstoptie; geen overboeking, dubbele uren of ongeautoriseerd huishouden. | D,I,E | 4 |
| A14 | Overname en wederzijdse ruil; verander tussentijds beschikbaarheid/kwalificatie | Hercontrole direct bij commit; voorwaarden van beide diensten gelden; oorspronkelijke inschrijving(en) pas na definitieve geschikte overdracht vervallen. | D,I,E | 5 |
| A15 | Boek met oude afmeldafspraak, wijzig clubtermijn, boek opnieuw; meld ziek vlak voor start | Oude snapshot behouden; nieuwe afspraak gebruikt nieuwe waarde; gewone tijdgrens correct; ziekte/nood altijd meldbaar. | D,E | 5 |
| A16 | Plan bar3/keuken2 via dag/week/maand; sleep, resize en formulierroute | Zelfde gecontroleerde dienstplaats, tijden en impact; minimale bezetting/overlap bewaakt; mobiel bruikbare equivalente lijst/formulier. | D,E | 4 |
| A17 | Maak conceptrooster, publiceer batch, wijzig tekst, daarna bezette tijd/locatie wezenlijk | Concept geen aanbodmeldingen; publicatie opent booking; kleine wijziging geen nieuw aanbod; grote wijziging toont impact en gerichte herbevestiging/informatie. | D,I,E | 4,8 |
| A18 | Importeer wedstrijd, herhaal, wijzig tijd/locatie, annuleer | Eén bronwedstrijd, geen dubbele voorstellen/meldingen; gekoppelde bezette diensten blijven tot bewuste afhandeling; juiste gezins- en commissieprogrammarechten. | I,R,E | 7 |
| A19 | Draai twee lokale synctijden rond zomer-/wintertijd; simuleer mislukte/onvolledige import | Twee bedoelde lokale runs, idempotente retry, laatste succes/fout zichtbaar; laatst bekende wedstrijden niet als afgelast gemarkeerd door ontbrekende import. | I,E | 7 |
| A20 | Eén persoon matcht nieuwe taak via twee rollen; meerdere taken dezelfde dag; herpublicatie/retry | Eén taakpush per persoon/taak; iedere nieuwe taak heeft eigen pushkans; hoogstens één aanbodmail per lokale dag; transactieberichten volgen eigen regels. | D,I,E | 8 |
| A21 | Preview/test/publiceer template; ontbrekende/onjuiste variabele; providerretry/webhook | Veilige juiste invulling/terugval; volledige versie blijft bewaard; ongeldige template niet ongecontroleerd verstuurd; succesvolle verzending niet opnieuw aangemaakt; log eerlijk over aflevering. | D,I,E | 8 |
| A22 | Publiceer exacte beleidsversie aan leden; bevoegde ouder accepteert expliciet voor twee kinderen | Twee acceptatieregistraties, ieder met lid/actor/hoedanigheid/tijd/exacte versie; onbevoegde vertegenwoordiging geweigerd. | D,R,E | 8 |
| A23 | Open zonder akkoord; dien vraag in; publiceer nieuwe versie | Openen geen akkoord; opvolging/reminderstop voor vraag; oude tekst/acceptatie intact; ziekmelden, bestaande diensten en essentiële berichten bereikbaar. | D,E | 8 |
| A24 | Kaart met meerdere uitvoerders/aanspreekpunt/subtaken; mention; afronden | Verschijnt in relevante Mijn acties; mention respecteert bronrechten en ontdubbelt; afronden geen urenpost. | D,R,E | 6,8 |
| A25 | Verbind activiteit aan kaart/dienst/document; wijzig; probeer besloten items via andere rol | Samenhang behouden, impact gecontroleerd; geen data via agenda/export/search/directe link/storage/realtime/notificatie buiten scope. | D,R,E | 1,6,7 |
| A26 | Doel720/uitgevoerd540; bezwaar; één en twee beoordelaars; afkoop; dubbel verwerken | Voorstel€37,50; bezwaar blokkeert definitieve verwerking; één beoordelaar onvoldoende; afkoop geen tweede tekortrekening; besluit-/geldtransactie herhaalbaar. | D,R,I,E | 3,9 |
| A27 | Doorloop wachtlijstoffer/reserve/maatje/vacature; aanbodtekort, verlopen certificaat en overbelasting | Alle routes uitvoerbaar; geen ongeschikte plaatsing; tijdelijk aanbod vervalt correct; juiste signalen en opvolging; belangstelling verandert geen aanstelling. | D,I,E | 4,5,10,11 |
| A28 | Laat waarderingsregel draaien, herhaal vanuit twee commissies; toon lief-en-leed aan onbevoegde | Eén relevante actie/bericht; eigenaar/uitvoerders/deadline/budget/status terugvindbaar; persoonlijke informatie afgeschermd; onbekende datum geeft geen verzonnen moment. | D,I,R,E | 10 |
| A29 | Bevoegde functionaris registreert telefonische booking/melding/correctie namens lid; herstel fout | Actor, subject, reden en effect blijvend zichtbaar; onbevoegde actie geweigerd; correctie behoudt historie en sluit alleen betreffende geschil. | D,R,E | 2,5 |
| A30 | Sluit seizoen; bereid nieuw voor; huishouden in meerdere teams; wijzig rol/huishouden na afsluiting | Oude stand/besluiten reproduceerbaar; gekozen sjablonen/herbevestigingen operationeel; nieuw seizoen apart; huishouden één keer in clubaggregaat. | D,I,E | 11 |

## 5. Aanvullende concrete scenario's

Deze scenario's verdiepen bestaande canonregels; zij introduceren geen nieuwe productmodule.

### Uren en financiële berekening

| Scenario | Verwachte uitkomst |
|---|---|
| 12u doel, 9u bevestigd | 180min tekort; €37,50 voorstel. |
| Besluit verlaagt doel naar8u, 6u bevestigd | 120min tekort; €25,00 bij ongewijzigd standaarduurtarief. Geen herberekend tarief van €150/8. |
| Doel720, 700min bevestigd | 20min tekort; bedrag eenmaal afronden: €4,17. |
| Doel720, 780min bevestigd | Resterend0; extra60min inzet zichtbaar; geen negatief bedrag/automatische vergoeding of overdracht. |
| Goedgekeurd jaardoel0 | Doel blijft0, geen terugval naar360; voortgang zonder deling-door-nul; winterdoel uit besluit. |
| Geldige huishoudvrijstelling met0 feitelijke uren | Voldaan via erkende inzet; bevestigde uren0; tekortbedrag0. |
| Eén betwist uur en afzonderlijk open afkoopverzoek | Afhandeling van uur laat afkoopverzoek/blokkade bestaan; geen vroege factuur. |
| Afkoop bestaat, daarna eindafrekening | Eén financiële route; geen tekortinvoice. Concurrent dubbel verwerken levert geen tweede afspraak op. |
| Reeds betaalde tekortbijdrage wordt herzien | Bevoegde herziening/credit/correctiepost; oorspronkelijk bedrag en betaalbewijs blijven behouden. |
| Potreservering€100 wordt uitgave€100 | Beschikbaar budget eenmaal belast; reservering afgeboekt of gekoppeld vrijgevallen. |

### Rechten en documenten

- Test minimaal vereniging A versus B, commissie A versus B, team A versus B, twee gescheiden ouders, verlopen rol, extra uitvoerder zonder vertegenwoordiging en financieel beheer zonder aanvraagachtergrond.
- Herhaal negatieve gevallen voor query, mutatie, zoekresultaat, export, downloadlink, signed storage URL, realtime-subscriptie, notificatiebody en serviceworker/cache waar relevant.
- Een niet-bestaand object en een onbevoegd object mogen geen dossierinhoud prijsgeven. Een geslaagde tenantmutatie kan geen foreign key naar een andere tenant gebruiken.
- Een beëindigde functionele rol verandert niet vanzelf de beoordeelde financiële verplichting; ingetrokken systeemrechten zijn wel direct effectief voor volgende geautoriseerde requests.
- Een publiek/verenigingsbreed document mag geen besloten bijlage via een ongecontroleerde embedded URL tonen.

### Tijd, planning en jobs

- Annuleren net vóór/op/na de geldende deadline; nachtdienst over middernacht; gelijktijdige persoonsdiensten; verlopen kwalificatie op dienstdatum; overlap na bewerkte dienst; geen dubbele boeking via retry.
- Dagrooster heeft realistische tijdgrenzen die uit club/rooster volgen, geen vaste demo08–18beperking. Een maand met zes kalenderweken toont alle datums.
- Wijzig één plaats van een meerpersoonsdienst: andere plaatsen, personen, wachtlijst en bronpublicatie behouden hun identiteit.
- Maatje kan niet zichzelf begeleiden; vertrek of verplaatsing van de enige gekwalificeerde begeleider leidt tot blokkade of expliciet herstel vóór bevestiging.
- Een roostersjabloon voor een wedstrijd rekent ten opzichte van aftrap; afgelasting wordt pas door een geldige bronstatus geactiveerd.
- Twee workers ontvangen dezelfde job; één worker crasht na verzending maar vóór statusopslag; providerwebhook wordt herhaald. Gebruik persistente sleutels en reconciliatie, claim geen onbewijsbare externe “exactly once”.
- Nieuwe-takendigest rondom lokale middernacht en zomertijd blijft maximaal één per lokale dag; transactionele ziekte-/wijzigingsmeldingen worden niet door die limiet onderdrukt.

### Mobiel en operationele betrouwbaarheid

- Test op smalle mobiele breedte en met toetsenbord: boeking, ziekmelden, ruil, planformulier, intake, beleidsacceptatie en Mijn acties; geen horizontale hoofdschermblokkade.
- Verlies verbinding tijdens boeken: geen definitief succes vóór serverbevestiging; retry leest/verwerkt dezelfde opdracht en toont echte uitkomst.
- Refresh/back/duplicaat-tab behouden de serverstand; sluiten van een browser wist geen administratie.
- Installeerbare PWA en pushkeuze op ondersteunde apparaten; unsupported push blijft bruikbaar via inbox. Geen clientcache met ongeautoriseerde voorgaande sessiedata.
- Test databaseback-up + herstel inclusief relaties naar bestanden; rollback van applicatie moet met migratiecompatibiliteit worden beoordeeld. Productie wordt niet als testomgeving gebruikt.

## 6. Bewijsregistratie voor Codex

Houd bijvoorbeeld `docs/release/v1-evidence.md` bij. Onderstaande structuur is een afspraak voor nieuw bewijswerk en betekent niet dat dit bestand of de tests al uitgevoerd zijn:

```text
Acceptatie-ID:
Canonversie: 1.0 — 2026-10-02
Commit/artifact:
Database-migratieversie:
Omgeving: staging
Testdatum en tijdzone:
Fixture en accounts/rollen (geen geheimen):
Uitgevoerde opdracht of handmatige stappen:
Verwachte uitkomst:
Waargenomen database- en schermuitkomst:
Testreport/screenshot/logreferentie:
Resultaat: OPEN | GESLAAGD | MISLUKT | GEBLOKKEERD
Blokkade en opvolgeigenaar:
```

Automatiseer vooral de regels waar fouten schade of onbetrouwbare administratie veroorzaken: tenant/privacy, boekingsconcurrentie, ledgerberekening, besluitbevoegdheid, financiële uniciteit, OTP, idempotency en kalenderjobs. Controleer lage-impact presentatieverschillen gericht in de browser; schrijf geen triviale tests alleen om een hoog aantal te kunnen noemen.

## 7. Definition of Done voor volledige V1

- Alle canonhoofdstukken2–14 en alle28voorstellen hebben een productie-implementatie en bewijsverwijzing; A01–A30 slagen.
- De acht verenigingsrollen werken met echte bevoegdheden en scopes; meerdere rollen per account, einddatums en onafhankelijke ouderprivacy zijn bewezen.
- De uitnodiging-tot-seizoensafsluitingketen werkt met persistente gegevens; geen essentieel onderdeel afhankelijk van lokale demonstratiestatus.
- Verplichte clubinstellingen zijn aanwezig en gevalideerd. Beschikbare externe verbindingen zijn werkelijk ingericht en gecontroleerd, overige blockers expliciet opgelost vóór volledige vrijgave.
- De gekozen premium stijl is behouden en mobiele kernflows zijn gelijkwaardig bruikbaar.
- Operationele taken, foutmeldingen, back-ups, herstel, deployment en rollback zijn gedocumenteerd en uitgevoerd op staging.
- Productieactivering gebeurt pas na expliciete goedkeuring; het vrijgegeven commit/artifact en migratiepad zijn herleidbaar. Tot dan staat “V1 in ontwikkeling op staging” correct vermeld.
