# Cluvo — V1-canon en gapanalyse

Overdrachtsversie 1.0 · 2 oktober 2026

## 1. Welke afspraken zijn leidend?

De meegeleverde **Duindorp SV V1 releasecanon, versie 1.0 van 2 oktober 2026**, is de functionele scopebasis. Cluvo is de generieke productnaam; Duindorp SV is de eerste vereniging en de demonstratie-inrichting. Namen, teams, beleid, tijdzone, rollen en termijnen mogen daarom geen vaste productlogica worden. Deze gapanalyse verduidelijkt wat nog moet worden gebouwd en wijzigt de canon niet.

De gekozen visuele basis is **Design 1 — Club Signal**. Het bestaande prototype is de referentie voor merk, indeling, interactierichting en scherminhoud. Neem de premium uitstraling over: donkere zijbalk, licht dashboard, koraalaccent, duidelijke kaarten en formulieren, rustige typografie, royale witruimte en compacte mobiele bediening. De prototypecode is geen kant-en-klare productiebackend.

De bouwopdracht is een volledig werkende Next.js- en Supabase-toepassing. Ontwikkeling en oplevering vinden eerst uitsluitend op staging plaats. `main` levert aan staging; later wordt een op staging geteste release naar productie gepromoveerd. Geen productieactivering zolang V1 niet aantoonbaar compleet en vrijgegeven is. De precieze promotie- en infrastructuurprocedure staat in de deploymentdocumentatie van dit pakket.

Een werkpakket mag worden afgerond zonder de hele V1 af te hebben. **Geen van de 28 voorstellen mag om die reden als V2 worden weggezet.** Een simulator, toast, formulier zonder opgeslagen serverresultaat, lokale browserstand of geschreven test zonder uitgevoerde bewijsvoering telt niet als productie-implementatie.

## 2. Onveranderlijke domeinregels

| Onderwerp | Vereist gedrag |
|---|---|
| Seizoensverplichting | Standaard 720 minuten per huishouden voor het gehele seizoen; winterdoel standaard 360 minuten. |
| Wintercontrole | 50% moet vóór de winterstop bevestigd zijn. Het tekort wordt na beoordeling direct na de winterstop ingepland en blijft onderdeel van dezelfde jaarverplichting. |
| Geen twee jaarhelften | 8 uur vóór + 4 uur na winter voldoet; 12 uur vóór winter voldoet volledig. Geen extra zesuursminimum na winter. |
| Stand | Benodigd, bevestigd, gepland, te bevestigen, wintertekort en resterend zijn afzonderlijke begrippen. Alleen bevestigde toekenningen gelden als uitgevoerd. |
| Vaste functies | Configureerbare erkende rol kan het gehele expliciet gekoppelde huishouden vrijstellen. Dit verleent geen systeemrechten en maakt geen fictieve uren. |
| Tussentijdse wijzigingen | Start, einde, onvoldoende inzet, instroom, vertrek en huishoudwijziging leiden tot een gemotiveerd besluit over de resterende verplichting; geen stille terugwerkende claim. |
| Huishouden | Eén stabiel dossier, unieke intakecode, expliciete personen- en verplichtingskoppelingen. Een account is geen huishouden en een intake is geen verplichting. |
| Gescheiden ouders | Onafhankelijke geverifieerde accounts en persoonlijke intakes. De markering creëert geen tweede verplichting. Een werkelijk tweede huishouden krijgt een apart dossier en code; de commissie beslist over de verplichtingskoppeling. |
| Uitvoerder | De daadwerkelijke gekoppelde persoon wordt geboekt. Eén uitvoering draagt eenmaal bij aan één verplichting in één seizoen. Historische boekingen behouden hun oorspronkelijke toerekening. |
| Teamtaken | Standaard nul uren. Alleen na goedkeuring door vrijwilligerscommissie, marktpublicatie en bevestigde uitvoering ontstaat één toekenning. Een scheidsrechterverzoek vereist tevens de beoordeling door wedstrijdzaken. |
| Annuleren | Configureerbare termijn en uiterste datum worden bij inschrijving vastgelegd. Latere algemene wijzigingen herschrijven bestaande afspraken niet. Ziekte en nood blijven altijd meldbaar. |
| Ruil | De oorspronkelijke inschrijving blijft actief tot definitieve geschikte overname. Wederzijdse ruil controleert en verwerkt beide afspraken samen. |
| Financieel | Standaard €150 / 720 minuten; €12,50 per ontbrekend uur. Bereken vanuit minuten en rond het totaal eenmaal op eurocenten af. |
| Afkoop | Alleen na overleg, beoordeling van werkelijk ontbrekend passend aanbod en vereiste goedkeuring. Eén afkoopafspraak van €150; geen tweede tekortrekening. |
| Besluiten | Twee verschillende bevoegde beoordelaars voor uitzonderingen. Verschil van mening, bezwaar, belangenconflict en afwijking buiten beleid hebben een bestuursroute. |
| Beleid | Actieve acceptatie per lid en exacte documentversie; openen is geen akkoord. Een ouder kiest expliciet voor welke bevoegde kinderen hij/zij accepteert. |
| Aanbodmeldingen | Maximaal één nieuwe-takenmail per persoon per lokale kalenderdag. Per nieuwe passende gepubliceerde taak één pushgebeurtenis, zonder dagmaximum. Andere functionele meldingen hebben eigen regels. |
| Wedstrijdsync | Twee ingestelde lokale tijdstippen per dag; start 06.00 en 18.00 `Europe/Amsterdam`. Herhalen ontdubbelt, een mislukte import annuleert geen wedstrijden. |
| Kanban | Meerdere uitvoerders, optioneel aanspreekpunt, subtaken en koppelingen. Kaartafronding boekt geen uren. |
| Privacy | Rechten gelden gelijk voor scherm, API, database, opslag, realtime, zoekresultaat, export, directe link, mention en notificatie. |
| Seizoensovergang | Oude saldi en besluiten blijven bewaard; nieuw seizoen heeft eigen verplichtingen. Herbevestiging van rol, intake en beleid is controleerbaar. Geen automatische overdracht van extra uren. |

## 3. Rollen: drie verschillende registraties

Leg **systeembevoegdheid**, **functionele aanstelling** en **vrijstellend effect** afzonderlijk vast. Een trainer kan bijvoorbeeld vrijstelling hebben zonder toegang tot andere huishoudens. Iemand kan tegelijk ouder, commissiecoördinator en teamouder zijn, ieder binnen een eigen bereik en geldigheidsperiode.

| Canonrol | Toegestaan bereik | Belangrijke grens |
|---|---|---|
| Lid, ouder of uitvoerder | Eigen persoon en expliciet toegestane huishoud-, vertegenwoordigings- en teamkoppelingen | Een gezinsverband geeft niet automatisch inzage in andermans persoonlijke intake. |
| Vaste vrijwilliger | Eigen functie, inzet, opleidingen en instructies | Erkenning is geen bestuurs- of coördinatorrecht. |
| Commissiebeheerder / commissiecoördinator | Eigen commissie, categorieën, roosters, uitvoering, documenten, kanban | Geen centrale bevoegdheid over alle huishoudens of alle commissies. |
| **Vrijwilligerscoördinator** | Toegewezen portefeuille met huishoudens, commissies en teamouders | Dit is een aparte rol, niet dezelfde als commissiecoördinator of vrijwilligerscommissie. Bouw portefeuillebeheer, begeleiding en opvolging. |
| Vrijwilligerscommissie | Centrale urencontrole, dossierkoppelingen, taakwaarden, winterplanning, uitzonderingen en teamtaakgoedkeuring | Niet iedere centrale medewerker is automatisch één van de vereiste bevoegde beoordelaars. |
| Teamouder | Alleen eigen teams; beperkte huishoudvoortgang, teamtaken en communicatie | Geen private intake, medische achtergrond, financiële achterstand of eigen opgelegde urenplicht. |
| Bestuur | Organisatie, beleid, rolcatalogus, geaggregeerde rapportages en bevoegde escalaties | Geen impliciete behoefte aan onbeperkte gevoelige persoonsgegevens. Geef alleen vastgestelde bevoegdheden. |
| Financieel beheer | Goedgekeurde bedragen, rekenbasis, factuur/export, betaalstatus en vrijwilligerspot | Geen medische of persoonlijke aanvraagachtergrond. |

Het prototype heeft zeven demo-rollen: de afzonderlijke vrijwilligerscoördinator ontbreekt. Een extra platformbeheerrol voor de generieke multi-verenigingsapplicatie kan technisch nodig zijn; die staat buiten deze acht verenigingsrollen en krijgt geen impliciete inhoudelijke inzage in clubdossiers.

## 4. Herbruikbare bron en grenzen

| Prototypebron | Goed herbruikbaar | Productiewerk dat ontbreekt |
|---|---|---|
| `app/globals.css`, `components/cluvo/ui.tsx`, merkassets | Visuele tokens, lay-outs, basiscomponenten, stijlen en micro-interacties | Toegankelijkheid, volledige responsieve afwerking, fout- en laadstaten, productieassetcontrole. |
| `components/cluvo/app.tsx` | Navigatiegroepering en werkruimtes | Next.js-routes, echte sessie en serverautorisatie; demo-rolwissel niet als autoriteit meenemen. |
| `data.ts` | Fictieve fixtures en eerste rekenspecificatie | Genormaliseerd tenant-/seizoenmodel, constraints, transacties en onveranderlijke registraties. |
| `store.tsx` | Demonstreert samenhang tussen acties | Vervangen door servermutaties, queries en veilige realtime-updates. `localStorage` is geen database. |
| `tasks.tsx` | Markt, dienstmodals, ruilrichting, planbord | Atomaire capaciteit, stabiele dienstplaatsen, volledige voorwaarden, wederzijdse instemming, wijzigingsversies. |
| `people.tsx` | Dossierindeling, intake, wintercontrole, vacatures | Persoonlijke rechten, uitnodigingsacceptatie, dossiertransities, echte beoordelingen en portefeuillecoördinatie. |
| `collaboration.tsx` | Commissie, kanban, teamtaken, wedstrijden, agenda en gesprekken | Scopecontrole, uploads, echte mentions, taakgoedkeuring, recurrence, integraties en berichtontvangers. |
| `governance.tsx` | Acceptatie-ervaring, waardering, opleidingen, financiële schermen | Exacte bewijsregistraties, besluitregels, financiële correcties, kwalificatiebewaking en echte rapportages. |
| `management.tsx` | Configuratie, template-editor, importpreview, seizoenvoorbereiding | Providerkoppelingen, jobs, audit, robuuste import, volledige versiehistorie en OTP. |

Er zijn 22 routewaarden in de lokale demonstratie: overzicht, taken, diensten, ruilmarkt, planbord, huishoudens, intake, commissies, kanban, teams, wedstrijden, agenda, berichten, acties, beleid, waardering, opleidingen, vacatures, rapportages, financiën, templates en instellingen. Het aantal schermen is geen bewijs dat alle canonfuncties compleet zijn.

## 5. Gapanalyse per domein

Alle onderstaande productiepunten staan open totdat tests en stagingbewijs in de acceptatiematrix zijn toegevoegd. De bestaande demonstratie wordt als referentie meegeleverd, niet als afgevinkte V1.

| ID | Domein | Huidig prototype | Nog te bouwen voor V1 |
|---|---|---|---|
| G01 | Identiteit, tenants en rechten | Vrij te kiezen demo-rol; alle data in één browserobject | Supabase Auth OTP; geverifieerde account-persoonkoppeling; tenantlidmaatschap; scopes; begin/einde; jaarlijkse herbevestiging; server- én databasedwang. |
| G02 | Huishoudens en privacy | Eén `Person.hh`; markering gescheiden; uitnodiging als ongeverifieerde demopersoon | Relationele dossier- en vertegenwoordigingsrechten; acceptatie uitnodiging; privaat intakeprofiel; unieke code; samenvoegen, splitsen en herstel met beoordeelde verplichtingsmapping en historie. |
| G03 | Uren en rollen | Lokale berekening met startstanden en actuele boekingen; rol-snapshot aanwezig | Seizoensgebonden verplichtingsversies en urenboekingen, correctieposten, expliciete winterbesluiten, tussentijdse rolbeoordeling en plaatsingstransactie. |
| G04 | Catalogus en markt | Categorie, duur en voorkeurfilter; concept/publicatie; lokale inschrijving | Volledige catalogus met taaktypegoedkeuring, eigenaar/contact, vensters, locaties, filters, uitlegbare matching en harde eisen; atomaire plaatsreservering; hulpverzoek. |
| G05 | Planning | Dag/week/maand, slepen, resize, sjablonen en batchpublicatie | Stabiele losse dienstplaatsen, gelijke validatie voor formulier/slepen, min. ervaren bezetting, begeleidingscapaciteit, deelnemersherbevestiging, vaste roosters en tijdelijke vervanging. |
| G06 | Uitvoering en ruil | Afmelden/ziek/overname/ruil/bevestiging lokaal | Serverstatusmachine, exacte tijdgrenzen, dubbele instemming bij ruil, hele transactie, clubannuleringbeleid, partials met reden, geschillen en toewijzingsspecifieke correctiehistorie. |
| G07 | Commissie en kanban | Kaarten, meerdere uitvoerders, eigenaar, checklist, reacties, bijlage lokaal | Per-commissie kolommen/mandaat; startdatum, echte subtaken, labelsbewerking, kaartgeschiedenis; beheerde bestanden en versies; koppelingen naar wedstrijden/documenten/projecten; eigen werkruimte. |
| G08 | Teamouders en centrale coördinatie | Eén voorbeeldteam; beperkt voortgangsscherm; teamtaakmarktknop | Werkelijke team- en portefeuillekoppelingen, taaktype/urenbesluit, onafhankelijke wedstrijdzaken- en vrijwilligerscommissiecontrole, communicatie tussen toegewezen verantwoordelijken. |
| G09 | Sportlink en import | Voorbeeldwedstrijden; syncknoppen veranderen label/tijd; eenvoudige CSV | Beschikbare geautoriseerde wedstrijdbron; idempotente import/delta; lokale scheduler; foutrecovery; gekoppelde roostervoorstellen; gecontroleerde ledenimport zonder automatische identiteitsfusie. |
| G10 | Jaaragenda | Losse items, lagen en RSVP; herhaling slechts een veld | Werkelijke recurrence en uitzonderingen; zichtbaarheid; deelnemers- en locatieoverlap; documenten/reacties/mentions/herinneringen; wijzigingen met impact op gekoppelde registraties. |
| G11 | Communicatie | Lokale berichten; `@` maakt globale demomelding; templates met eenvoudige vervanging | Gesprekken met ontvangers/scopes; mention-IDs; actor/ontvangerautorisatie; outbox, inbox, pushsubscription, dagelijkse digest, idempotency, echte providerstatus en retry; volledige templateversies. |
| G12 | Beleid | Exacte voorbeeldteksten blijven lokaal; expliciete checkbox en vertegenwoordigingslijst | Documentgoedkeuring/publicatie, doelgroep/ingangsdatum/reactietermijn, aangeboden/geopend/vraagstatus, ondertekende serverregistratie, bewijsdownload, herinneringsstop en heracceptatiebesluit. |
| G13 | Uitzondering en financieel | Twee gekozen reviewerlabels; voorstel/afkoop en betaalstatus lokaal | Twee verschillende geverifieerde bevoegde accounts; onveranderlijke besluitversie; afwijzing/escalatie/bezwaar; beschikbaar aanbod beoordelen; financiële bevoegdheid; factuur/export/correctie; gecontroleerde potbesteding. |
| G14 | Waardering en opleiding | Handmatig moment; conceptbericht; cursussen/certificaatveld | Regels uit gecontroleerde geboorte-/startdatums; deduplicatie per gelegenheid; meerdere uitvoerders/deadline/budget; afgeschermd lief en leed; kwalificatieverval op toekomstige diensten en inwerkregistratie. |
| G15 | Rapportage, PWA en seizoen | Basisaggregaties, manifest/offlinepagina, lokale snapshot | Passend aanbod per echte geschiktheid; periodegebonden werkdruk; rolgebonden rapportages; serverbevestigde mobiele mutaties; pushkeuze; complete afgesloten seizoenen en operationele herbevestigingsflow. |

## 6. Concrete codepunten die niet overgenomen mogen worden als productielogica

Deze bevindingen volgen uit de overgedragen bron op 2 oktober 2026. Ze zijn een gerichte lijst voor de migratie; geen claim dat hiermee ieder mogelijk defect gevonden is.

| ID | Bron / bevinding | Vereiste correctie en gerichte controle |
|---|---|---|
| B01 | `store.tsx`: volledig object in `localStorage`, actor/rol door client gekozen; `app.tsx` verbergt schermen | Autorisatie uit geverifieerde sessie en serverrelaties; RLS en opslagrechten. Negatieve cross-tenant-, cross-commissie- en oudertests op directe requests. |
| B02 | `data.ts`: `Role` mist vrijwilligerscoördinator; alle planners krijgen brede `canPlan` | Aparte rol plus portefeuillemodel; expliciete acties per scope. Geen brede globale adminboolean als domeinmodel. |
| B03 | `people.tsx`: twee reviewerlabels zijn door dezelfde gebruiker selecteerbaar | Twee unieke bevoegde actor-IDs op exact dezelfde besluitversie; wijziging invalideert goedkeuring; belangenconflict/escalatie vastleggen. |
| B04 | `management.tsx` import vindt bestaande persoon op lidnummer **of e-mail**, creëert anders huishouden met 720 minuten en leeftijd 18 | Match alleen gecontroleerde stabiele bronidentiteit; e-mail is controlesignaal. Onbekende leeftijd onbekend houden; importvoorstel krijgt pas na huishoudcontrole een verplichting. A10 ook op herimport testen. |
| B05 | `HouseholdDetail`: markering/intakeweergave beoogt privacy, maar data en globale historie blijven clientbreed aanwezig | Aparte private profielen en veldscope; dossierhistorie per bronobject; geen andere ouderdetails in exports, contactlijsten of meldingen. |
| B06 | `Households`: `Number(r.target) || 360` maakt een bedoeld doel van nul alsnog 360; winterdoel vaak automatisch helft | Valideer nul expliciet als toegestaan besluit; sla goedgekeurd jaardoel én winterdoel afzonderlijk op, inclusief effectieve periode. |
| B07 | `WinterPlanning`: bestaande inschrijving wordt gezocht op huishouden + dienst, niet noodzakelijk gekozen persoon; vrije keuze uit alle datums na winter | Koppel expliciet de geselecteerde bestaande booking en echte uitvoerder; configureer inhaalperiode; valideer geschiktheid, datums en resterende tekortallocatie onder lock. |
| B08 | `MyShifts`: uitvoering bevestigen sluit alle urencontrolevragen van hetzelfde huishouden; `blocked` wordt algemeen false | Sluit alleen het gekoppelde geschil; deriveer blokkade uit alle nog open dossiers. Test twee gelijktijdige betwistingen. |
| B09 | `MyShifts`: bevestigde minuten vervangen de bookingwaarde; ontbrekende redendwang bij afwijking; geplande toekomstige dienst kan bevestigd worden | Bewaar afgesproken waarde en uitvoering apart; autoriseer afwijking, registreer reden en bewijs; voeg correctiepost toe. Definieer moment waarop uitvoering mag worden bevestigd. |
| B10 | `MyShifts`: afmeldgrens vergelijkt vaste demodatum en hele dagen, niet starttijd/afgesproken deadline | Gebruik serverklok, zoned afspraak en onveranderlijke `cancel_deadline_at`; grensproeven één seconde vóór/op/na. Ziekte/nood omzeilt uitsluitend de reguliere blokkade. |
| B11 | `bookingError`: beschikbaarheidsblokken worden niet afgedwongen; overlap beperkt tot enkele statuslabels; buddyflag kan kwalificatie omzeilen | Eén centrale geschiktheidscontrole, ook bij overdracht/plaatsing/wijziging; gebruik leeftijd op dienstdatum; eerbiedig harde beschikbaarheid; toets juiste buddykwalificatie, bevoegdheid en daadwerkelijke aanwezigheid. |
| B12 | `Planner`: meerpersoonsdienst kan bij één verplaatsing opgesplitst worden in nieuwe taakrecords | Productie onderscheidt taak/dienst van bezettingsplaats. Verplaats een stabiele plaats of toewijzing; behoud bronkoppelingen, wachtlijst, publicatie-ID en audit; geen nieuwe aanbodmeldingen door intern splitsen. |
| B13 | `ShiftEditor`/planner tonen herbevestiging als tekst, maar maken geen individuele herbevestigingsstatus | Bereken change-impact; expliciet besluit; versiegebonden verzoek aan iedere geraakte deelnemer; aanvaard/weiger/opvolging. Geldige bestaande afmeldafspraak blijft traceerbaar. |
| B14 | Wachtlijst is alleen een array; geen tijdelijk aanbod, vervaldatum of opvolging | FIFO of expliciet ingestelde rechtvaardige volgorde, geschiktheidscontrole, reserveringstermijn en atomaire claim; aflopen leidt gecontroleerd tot volgende kandidaat. |
| B15 | `SwapMarket`: één demo-klik beweert instemming van twee personen; geen duurzaam aanbodobject | Per partij instemming en verval vastleggen; beide plaatsen/toewijzingen onder één transactie; hercontrole direct bij commit. Oorspronkelijke inschrijvingen blijven geldig tot dan. |
| B16 | `Teams`: goedkeuren publiceert iedere taak als scheidsrechter, 120 minuten, vaste tijden; `isAdmin` kan beide beoordelingen doen | Vraag gestructureerde taakinhoud; passend type/uren/voorwaarden; per benodigde rol beoordeelde stappen. Definitieve koppeling voorkomt dubbel tellen van teamtaak en markttaak. |
| B17 | `Kanban`: kolommen zijn globaal; Mijn acties toont alleen kaartassignees; mentions alleen `text.includes('@')` | Kolommen per bord; Mijn acties bevat mentions, subtaken, deadlines en hulpvragen; mentions refereren aan persoon-ID en bronrechten, notificaties ontdubbelen. |
| B18 | `Calendar` en plannerm maandweergave renderen steeds 35 dagen; recurrence wordt niet uitgevoerd; scopeveld filtert inhoud niet | Dynamisch 4–6 kalenderweken; echte herhalingen/uitzonderingen; autorisatie vóór data uitleveren; pagina-, lijst- en kalenderweergave tonen dezelfde toegestane items. |
| B19 | `Matches`: gezinsteams hardcoded; dienstvoorstel vaste 12–15u; sync geeft alleen label/timestamp | Teamrelaties via rechten; relatieve sjablonen rond echte aftrap; provider-delta's, bron-ID en jobresultaat. Geen geslaagde status zonder geverifieerde import. |
| B20 | Templatehistorie bewaart vooral onderwerp/body; notificaties missen ontvanger, providerstatus en effectieve kanaalvoorkeur | Onveranderlijke complete templateversie inclusief preheader/afzender/knoppen; event-ontvangerkanaal-idempotency; persoonlijke voorkeuren, testveiligheid en delivery-status. |
| B21 | `Policies`: eenvoudige huidige-versiekeuze, globale acceptatiestatus; geen volledige aangeboden/geopend/vraagcyclus | Per lid, versie, doelgroep en actor afzonderlijke status; compleet bewijs; expliciete toestemming voor heracceptatie; vragen pauzeren juiste reminders. |
| B22 | `Finance`: knop 'Controle akkoord' maakt rekening; budgetpost kan direct betaald/ontvangen zijn | Gescheiden inhoudelijke controle en financiële verwerking; preconditions server-side; exacte centen; afkoop/tekort uniek per verplichting; echte betaalbron of bevoegd handmatig bewijs; correctiehistorie. |
| B23 | `Reports`: matching telt voorkeur/leeftijd/plek maar niet alle eisen; werkdruk vergelijkt alle geplande uren met maandlimiet | Zelfde matchingengine als booking, expliciet tijdvak en echte resterende behoefte; maandgebonden belasting plus herhaald invallen; geen administratieve extra huishoudtelling. |
| B24 | `data.ts` en dashboard: `TODAY`, datums, /12 en winter6 vast; `uid` is korte `Math.random` | Serverklok en datumcontext; configureerbare doelen overal doorvoeren; database-ID's en unieke codeconstraint. Fictieve startstanden niet als ledger migreren. |
| B25 | Seizoensovergang bewaart losse snapshot en opties zonder nieuw actief seizoen/herbevestigingsproces | Gecontroleerde afsluiting, volledigheid, immutable snapshot, nieuw seizoen, geselecteerde sjablonen en echte toegewezen herbevestigingen. Oude exports en balances moeten reproduceerbaar zijn. |

## 7. Traceerbaarheid van alle 28 V1-voorstellen

De nummers volgen exact de canon. “Demo” hieronder betekent zichtbare of deels interactieve demonstratie; voor alle rijen blijft serverimplementatie en releasebewijs vereist.

| Nr | Verplicht voorstel | Canon | Proeven | Prototype / gap | Werkpakket |
|---|---|---|---|---|---|
| 01 | Eerlijke urenstatussen en structurele inzet zonder fictieve uren | H4, H7 | A01–A06 | Demo berekening; ledger/besluitversies ontbreken, G03/G06 | WP3, WP5 |
| 02 | Gecontroleerde huishoudkoppeling en geen dubbele telling | H3, H4 | A07–A10, A30 | Dossiers/aanvraag; echte transities ontbreken, G02 | WP2, WP11 |
| 03 | Eén account met meerdere rollen en geldigheidsperioden | H2, H14 | A11, A25 | Rolwisselsimulator; autorisaties en vrijwilligerscoördinator ontbreken, G01 | WP1, WP2 |
| 04 | Roostersjablonen, concepten en batchpublicatie | H6 | A16, A17 | Interactieve demo; stabiele plaatsmodellen/publicatie-outbox, G05 | WP4 |
| 05 | Dienstvoorstellen op basis van wedstrijden | H6, H9 | A18 | Voorbeeldknop; relatieve sjablonen en bronimport, G09 | WP7 |
| 06 | Bewuste verwerking van wedstrijdwijzigingen | H6, H9 | A18, A19 | Wijzigingsmodal; echte delta/afgelasting/herbevestiging, G09/G05 | WP7 |
| 07 | Sync 06.00/18.00, actualiteit, handmatig verversen | H9, H14 | A19 | Simulatie; echte scheduler en import, G09 | WP7 |
| 08 | Beschikbaarheid, overlap, leeftijd en kwalificaties | H5, H6 | A13–A15, A27 | Deels lokale checks; centrale volledige controle, G04/G05/G06 | WP4, WP5 |
| 09 | Uitlegbare taaksuggesties en keuzevrijheid | H3, H5 | A27 | Voorkeurlabel; complete verklaarbare matching, G04 | WP4, WP10 |
| 10 | Wachtlijst en reservepool | H5 | A13, A27 | Inschrijflijst/voorkeur; tijdelijke aanbieding ontbreekt, G04 | WP5 |
| 11 | Eerste dienst met een maatje | H6, H13 | A27 | Lokale gekoppelde buddy; minimumbezetting/verval/opvolging, G05/G14 | WP4, WP10 |
| 12 | Markt structurele vrijwilligersfuncties | H5 | A27 | Belangstelling/kennismakingdemo; beheer/aanstellingcyclus, G04 | WP10 |
| 13 | Controle op voldoende passend aanbod | H5, H13 | A27 | Eenvoudige teller; tijd-/kwalificatiebewuste analyse, G15 | WP4, WP11 |
| 14 | Gewenste inzet en overbelastingssignalen | H13 | A27 | Intakeveld/totale teller; periode en signaleringsregels, G14/G15 | WP10, WP11 |
| 15 | Persoonlijke actielijst over commissies heen | H8, H13 | A24 | Alleen kaartassignees; mentions/verzoeken/opvolging, G07/G11 | WP6 |
| 16 | Kaarten, agenda en diensten gekoppeld zonder automatische uren | H8, H9 | A24, A25 | Kaartrelaties lokaal; alle brontypen/wijzigingsimpact, G07/G10 | WP6, WP7 |
| 17 | Meerdere uitvoerders, optioneel aanspreekpunt | H8 | A24 | Interactieve kaartdemo; relationele opslag/rechten, G07 | WP6 |
| 18 | Mentions met rechten en ontdubbelde meldingen | H8, H10 | A20, A24 | @-tekstsignaal; persoon-ID/scopes/dedupe, G11 | WP6, WP8 |
| 19 | Waardering met eigenaar, budget en beperkte inzage | H13 | A28 | Handmatige demo; regels/ontdubbeling/rechten, G14 | WP10 |
| 20 | Opleidingen, inwerken en kwalificaties | H5, H6, H13 | A27 | Cursus/certificaatdemo; verval/backcheck/inwerken, G14 | WP10 |
| 21 | Bevoegd namens iemand handelen | H3, H7 | A29 | Keuze uitvoerder + algemene lokale actorlog; expliciete delegatie/redenen, G01/G02/G06 | WP2, WP5 |
| 22 | Urenbevestiging, foutmelding en correctiehistorie | H4, H7, H14 | A04, A29 | Lokale statusoverschrijving; correctieledger/termijnen, G03/G06 | WP3, WP5 |
| 23 | Controle vóór afrekening, geen dubbele bijdrage | H12 | A26 | Lokaal voorstel en checks; transacties en reviewbasis, G13 | WP9 |
| 24 | Twee beoordelaars voor uitzonderingen | H12, H14 | A26 | Vrij gekozen labels; echte bevoegdheid/unieke actors, G13 | WP3, WP9 |
| 25 | Acceptatie per lid/versie en historie | H11 | A22, A23 | Lokaal akkoord; volledige bewijs- en doelgroepcyclus, G12 | WP8 |
| 26 | Templatecontrole, tests, versies en verzendlog | H10 | A20, A21 | Editor en simulaties; volledige versie/outbox/providerbewijs, G11 | WP8 |
| 27 | Controleerbare seizoensovergang | H14 | A30 | Snapshotdemo; echte nieuwe cyclus, G15 | WP11 |
| 28 | Bestuursrapportages die helpen bijsturen | H13 | A27, A30 | Basisaggregaties; reproduceerbaar bevoegd inzicht, G15 | WP11 |

## 8. Bouwgrenzen en open inrichting

De canon geeft de volledige scope; onderstaande gegevens zijn nog in te richten en mogen niet worden verzonnen: staginghost/repository, Supabaseprojecten, SMTP/e-mailprovider, pushsleutels, Sportlinkcontract en beschikbare artikelen/velden, geautoriseerde ledenbron, beheerdersaccounts, doelgroepen, werkelijke seizoensdata, beoordelaarsmandaten en beleidsdocumenten.

Ontbrekende externe toegang blokkeert alleen de betreffende liveacceptatie. Bouw ondertussen adapters, foutafhandeling, contracttests en beheerschermen met herkenbare fixtures. Een scherm mag geen “gekoppeld”, “verzonden”, “afgeleverd” of “productieklaar” tonen als daarvoor geen bewijs bestaat. Neem geen demogegevens, demo-OTP, voorbeeldacceptaties of voorbeeldbetalingen mee naar echte clubadministratie.

De bindende releasechecklist en verticale volgorde staan in `02_ACCEPTATIE_EN_WERKPAKKETTEN.md`.
