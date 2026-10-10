# Cluvo — analyse en rolgebaseerde kennisbank

De kennisbank is onderdeel van de bestaande Next.js-applicatie. De basis voor deze analyse is administratie-release `a874402851112dbce5fdc8763c2cbe497579307a`, de volledige V1-canon en de actuele broncode. De originele prototypebron blijft ongewijzigd. Er worden geen database-, rechten- of productieresources toegevoegd.

## Uitkomst van de codeanalyse

De actieve applicatie heeft twintig mobiele hoofdschermen, zestien verenigingsbeheeronderdelen en zeven platformbeheeronderdelen. De webwerkruimte bevat daarnaast onder meer persoonlijke intake, dossier, diensten, presentie en Sportlink-beheer. De database bevat 41 gedeelde migraties; deze wijziging verandert geen daarvan.

Identiteit komt uit de echte geverifieerde Supabase-sessie. `my_workspaces` bepaalt persoonlijk lidmaatschap; `club_admin_access` en `platform_access` bepalen actuele administratieve bevoegdheden. Een scope, uitnodiging, functionele aanstelling en huishoudvrijstelling zijn afzonderlijke bronnen. Serveracties en native commands valideren actor, bevoegdheid, bronversie en opdrachtsleutel. RLS en serverautorisatie begrenzen reads, writes en exports. De kennisbank gebruikt dezelfde bestaande autorisatieprojecties en introduceert geen tweede rolmodel.

De belangrijke functionele samenhang is: expliciete huishoud- en verplichtingsmapping → concrete taakplaats → geverifieerde echte uitvoerder → bevestigde uitvoering → onveranderlijke ledger met correcties → beoordeeld financieel voorstel → onafhankelijke goedkeuring → definitieve verwerking. Teamtoewijzing, werkkaartafronding, RSVP, interesse, voorbereiding en policy-openen zijn eigen gebeurtenissen en vormen geen vervanging voor een volgende formele stap.

De bronnen zijn onderzocht als functionele inventaris, met een afzonderlijk oordeel over de huidige bediening. De 219 functies uit de eerdere webinventaris en 147 mobiele functies worden allemaal naar artikelen herleid. Dat bewijst documentatiedekking, niet automatisch volledige V1-acceptatie. De historische inventarissen dateren van vóór het actuele beheer en zijn daarom geen actuele acceptatiestatus.

## De acht kennisbanken

| Kennisbank | Artikelen | Toegang |
|---|---:|---|
| Leden, ouders en uitvoerders | 27 | Actueel persoonlijk verenigingslidmaatschap |
| Teamouders | 10 | Actuele teambeheerbevoegdheid binnen de clubscope |
| Commissies en taakverantwoordelijken | 13 | Werkruimte-, planning-, cluster- of uitvoeringsrecht per artikel |
| Vrijwilligerscoördinatie | 6 | Dossierbegeleiding of vacatureopvolging per artikel |
| Vrijwilligerscommissie | 7 | Dossier-, uitzonderings-, uren-, functie- of teamtaakreview per artikel |
| Bestuur en verenigingsbeheer | 19 | Organisatie-, toegang-, beleid-, communicatie-, opleiding-, rapportage- of seizoensrecht per artikel |
| Financieel beheer | 7 | Financiële voorbereiding, goedkeuring, verwerking, inzage of potbeheer per artikel |
| Platformbeheer | 12 | Afzonderlijk platformrecht per artikel; medewerkers en globale standaarden vereisen een globaal mandaat |

De 101 artikelen bevatten circa 17.667 woorden, concrete stappen, voorbeelden, controles en herstelroutes. Alle 28 aanvullingen en A01–A30 hebben expliciete artikelbindings. Nieuwe commands of schermen zonder binding laten de volledigheidstest falen.

## Waar de kennisbank staat

- Mobiele app: Meer → Hulp en kennisbank, `/app/c/[club]/help`. De bestaande praktische vraagroute blijft onder de artikelen beschikbaar.
- Persoonlijke webwerkruimte: Kennisbank, `/c/[club]/kennisbank`.
- Verenigingsbeheer: Kennisbank beheer, `/c/[club]/beheer/kennisbank`.
- Platformbeheer: Kennisbank, `/platform/kennisbank`.

Elke verzameling heeft een eigen lijst en zoekfunctie. Een account met meerdere werkelijke bevoegdheden krijgt de passende verzamelingen, met filtering binnen de artikelen. Zoektermen, rolfilter en paginering werken via server-GET zonder client-side catalogus of browseropslag. Artikelen hebben een inhoudsopgave, genummerde stappen, verwante toegestane artikelen, leesduur en actualiteitsdatum. Onbekende, te diepe of onbevoegde directe links worden geweigerd. Alle kennisbankroutes blijven dynamisch en vallen onder de bestaande private/no-store headers. De serviceworker krijgt geen nieuwe private cachecategorie.

## Grenzen die de artikelen expliciet uitleggen

| Onderwerp | Correcte uitleg |
|---|---|
| Seizoensuren en winter | Eén jaarafspraak, standaard 720/360 minuten; alleen bevestigde minuten tellen als uitgevoerd |
| Gezinnen en gescheiden ouders | Persoonlijke intakes en accounttoegang apart; geen automatische dubbele verplichting of gedeelde vrijstelling |
| Functie en systeemrol | Erkenning, vrijstellend effect en mandaat apart; geen fictieve uren |
| Teams | Lidtoewijzing is geen uitvoerdersboeking; één plaats telt hoogstens voor één speler en eenmaal voor het huishouden |
| Teamtaakuren | Vooraf benodigde reviews, marktpublicatie en bevestigde uitvoering; geen dubbele broncredit |
| Planning | Concept of voorstel is geen publicatie; wijzigingen aan bezette diensten vragen impactcontrole |
| Sportlink | Tenantkoppeling en echte bronstatus; mislukte import is geen afgelasting; betekenis van `duur` blijft onbevestigd |
| Samenwerking | Kaarten, checklists, RSVP en mentions zijn geen urenbewijs; mentions geven geen rechten |
| Beleid | Actief akkoord per persoon en exacte versie; openen is geen acceptatie |
| Financieel | Minuten/eurocenten, totaal eenmaal ronden, open blokkades, gescheiden controles, geen dubbele afkoop/tekortclaim |
| Providerstatus | Geaccepteerd is geen bewezen inboxaflevering; onbekend mag niet blind worden herhaald |
| Seizoen | Oude standen behouden, expliciete geselecteerde sjablonen en herbevestiging; geen automatische overdracht van overuren |
| Platformsupport | Benoemde eigen actor, clubtoestemming, minimale scope, eindig maximaal 24 uur; geen private dossierinzage |
| PWA | Online serverbevestiging vereist; private inhoud niet offline cachen; geen onveilige Androidomweg adviseren |
| Uitgebreide native functies | Backend- of canoncontract is niet automatisch een volledige mobiele editor; de artikelen benoemen de actuele route en beperkingen |

Complexe merge/split, wederzijdse ruil, volledige plannerbediening, uitgebreide kanbanbewerking, reeksagenda, waarderingsautomatisering, ledenimport en volledige betaal-/refundbediening worden niet ten onrechte als overal aanwezige mobiele knoppen beschreven. De onderliggende volledige V1-scope blijft behouden.

## Bronnen en onderhoud

De artikelsource staat in `lib/knowledge/content/`. `catalog.mjs` verzamelt de boeken; `model.mjs` verwerkt uitsluitend plain text, filtert rechten en zoekt. `server.ts` haalt de bestaande actuele autoriteit op. `components/knowledge/` rendert de serverinhoud in Club Signal. De volledige catalogus wordt niet aan een onbevoegde clientcomponent doorgegeven.

`coverage.json` bevat de expliciete canon-, scherm-, sectie-, command- en functiebindings plus hashes van onderzochte kernbronnen. Genereer die na een inhoudelijke wijziging met `node scripts/knowledge-inventory.mjs`. Controleer daarna `node --test tests/knowledge-bank.test.mjs`. Een nieuwe bronfunctie moet inhoudelijk worden gekoppeld; genereren is geen toestemming om een ontbrekend artikel met een generieke lege verwijzing af te vinken.

Voor een nieuw artikel: kies de juiste omgeving en de daadwerkelijke actiebevoegdheden, schrijf een concrete samenvatting, uitleg, minimaal vier zinvolle stappen en controle-/herstelregels, en verwijs alleen naar bestaande artikel-ID's. Gebruik geen echte ledengegevens, sleutels, tokens of voorbeeldidentiteiten in gepubliceerde tekst. Verifieer nieuw UI-label en route tegen de actieve code. Pas geen domeinregel aan op basis van een historische prototypeweergave.

## Verificatie en uitrol

Gerichte tests controleren rechten, globale versus tenantgebonden platformgrants, negatieve zoekresultaten, canon- en commandvolledigheid en bestaande kruisverwijzingen. De volledige bestaande JavaScript-testset, lint, typecheck en standalone-build blijven vereist.

`scripts/browser-knowledge-native.mjs` gebruikt echte lokale OTP-sessies in de eigen geïsoleerde proefdatabase. Het opent alle 101 artikelen, controleert mobiel/desktop, zoeken, rolfilter, inhoudsopgave, vraagroute, directe denials en intrekking van een eigen lokale proefgrant. Het maakt geen remote persoonlijke rolwijziging.

De actieve staging-browserreadback controleert bovendien persoonlijke artikelen en zoeken, toegestane clubkennisbanken, ontbreken van financiële/platformartikelen zonder mandaat en foreign-tenant denials. Die workflow blijft bij zero aangemaakte platformgrants en gebruikt alleen bestaande synthetische native QA-resources met cleanup. Een positieve persoonlijke platformproef op hosting vereist afzonderlijk het benoemde echte platformmandaat; lokale platformproof is daarvan onderscheiden.

Promotie gebruikt uitsluitend de exacte groene main-SHA, de bestaande configuratie-import, alle staging-upgrade/restore/QA/deploygates en de actieve-image-readback. Er is geen productieactivering of nieuwe migratie voor de kennisbank.
