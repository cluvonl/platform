# Codex-startopdracht — Cluvo staging

Gebruik dit bestand als opdracht in Codex bij `cluvonl/platform`.

## Opdracht

Bouw vanuit de bestaande repository een volledig samenhangend stagingplatform dat de actuele Cluvo-prototypebron in dit pakket volgt. Werk op `main`, bundel logische wijzigingen en laat een groene expliciete commit-SHA via de bestaande promotieroute naar branch `staging` gaan. Een push van die promotie activeert de bestaande stagingworkflow en VPS-deployment. Maak geen nieuwe losstaande app, kies geen nieuw ontwerp en vervang de bestaande pipeline niet zonder aantoonbare noodzaak. Productie volgt pas na een afzonderlijk vrijgavebesluit.

De te bouwen scope omvat de volledige V1-releasecanon, 23 pagina's en alle functies van het nieuwe catalogusregister; vrije verenigingstakenmarkt; clustering van concrete plaatsen naar teams; teamouderverdeling naar leden; uitvoerderkeuze door het huishouden; eigen teamtakenmarkt en seizoensdoelen; uitlegbaar verdeeladvies; gezinsagenda; concrete volgende acties; deadlineopvolging/reservehulp; teamouderoverdracht; praktische feedback/instructieverbetering; persoonlijke afsluitbare gele uitleg. Staging moet echte accounts, serveropslag, consistente tellingen, veilige integraties en correct werkende processen hebben.

## Eerst vaststellen

- Lees de actuele `AGENTS.md`, dit pakket en de originele canon. De expliciete laatste gebruikersopdracht bepaalt de main→staging-route en staging-only-scope.
- Leg HEAD, remote main/staging en werkboomstatus vast. Bewaar bestaande gebruikerswijzigingen. De referentie-SHA's zijn vergelijkingspunten, geen opdracht om terug te resetten.
- Maak een pagina/functie→route/read-model/command/acceptatie-matrix. `registers/functies.json` en `registers/relaties.json` zijn de start.
- Controleer de zeven bestaande migraties, 140 tabellen, 52 API-RPC-definities, 16 API-views en de werkelijk aangesloten serverroutes. Deze telling is broninventaris, geen bewijs dat alle functies gereed zijn.
- Start de prototypebron naast de app en maak een visuele nulmeting met de referentiefixture. Gebruik de aangewezen browserworkflow wanneer beschikbaar. Het overdrachtspakket bevat nog geen volledige nieuwe browserscreenshotset.
- Controleer zonder secretwaarden te printen of stagingtarget, Supabase-project, Auth-redirects, runtimebestand, workerroute, migratieroute en uitgaande allowlist aanwezig zijn. Stel alleen een concrete ontbrekende configuratievraag als afhankelijk werk daadwerkelijk geblokkeerd is; bouw onafhankelijk werk door.

## Implementatiegrenzen

Behoud Next.js App Router, TypeScript, de gepinde dependencies, Supabase Auth/Postgres/private Storage en de huidige serverhelpers. Gebruik append-only nieuwe migraties; wijzig geen reeds toegepaste migratiehistorie. Gebruik tenant-FK's en RLS plus concrete servermandaten; een verborgen knop is geen beveiliging. Gebruik bestaande databasecommands waar mogelijk, en breid hun beschermde transactionele route uit voor teamreserveringen. Gebruik `SUPABASE_SECRET_KEY` nooit in de browser en nooit als alternatief voor controle van een gebruikersactie.

Account, persoon, huishouddossier, teamlid en seizoensverplichting zijn verschillende objecten. Een account/extra intake/teamlid creëert geen tweede 12-uursverplichting. Iedere booking verwijst naar één echte plaats, één uitvoerder, één expliciete verplichting en zo nodig één teamlid voor de teamtelling. Alle geldwaarden zijn gehele centen, inzetwaarden gehele minuten. Uitvoering en financiële correcties blijven historisch herleidbaar.

Voeg de gesloten teammarkt toe zonder dubbele taak of tweede urenbron. De bestaande `app.team_tasks.credit_minutes = 0`-regel blijft bruikbaar als bronmetadata; goedgekeurde inzet gebruikt één verbonden shift/position/booking. Documenteer de migratie van de huidige publicatie-RPC die nog uitgaat van openbare markt. Maak geen twee uitvoeringsafspraken voor één taakplaats.

Vervang lokale simulaties door echte werking. UI-keuze van een demorol of voorbeeldpersoon mag geen platformtoegang geven. De huidige demo-fouten uit document 08 worden gecorrigeerd; hun visuele componenten blijven. Uitlegbanners worden per geauthenticeerde gebruiker en onderwerp opgeslagen, inclusief cross-device-gedrag. De rolwisselaar kiest alleen echt verleende werkruimtes; de vrije persoonswisselaar verdwijnt uit echte staging.

## Vormgeving

Gebruik `referentie/prototype/components/cluvo`, de bestaande UI-componenten, CSS, iconen, logo en assets. Behoud zijbalk, typography, kleuren, ruimte, kaarten, tabellen, tabs, modalen, badges, gele uitleg en mobiele werking. Voor login, echte fout-/laadstatus, canonvelden en ontbrekende bediening gebruikt de app dezelfde componenten. Geen generieke nieuwe dashboardstijl. Vermeng de eerdere sobere backendpagina's niet met de gewenste visuele referentie.

## Uitvoering

Volg de verticale bouwpakketten uit document 05. Bouw een keten steeds af van UI via servercommand/RLS tot read-model, actie, outbox en audit. Een mockverzending of providerfixture blijft eerlijk gemarkeerd; rapporteer die als nog niet operationele integratie, niet als volledig geslaagde V1. Houd `release/readiness.json` en de acceptatieregisters gebaseerd op bewijs, niet op aantallen bestanden of lokale toasts.

Voer passende tests en bestaande checks uit na samenhangende wijzigingen: lint, typecheck, Node-tests, build, WP0-guard, lokale Supabase pgTAP, echte two-session race/season-lock-tests en database-lint. Voeg nieuwe tests toe voor nieuwe serverinvarianten en privacyroutes. Leg functionele stagingproeven en visuele vergelijking vast per SHA, rol, fixture en viewport. Volledige stagingacceptatie verlangt werkende workers en geautoriseerde integraties of een expliciet als onvolledig vermelde ontbrekende aansluiting.

Maak de gecontroleerde wijziging van `APP_MODE=prototype` naar `APP_MODE=app` in de compose/broker/runtimeketen. Behoud project/originchecks, immutable digest, SHA-label, rootless Docker, lock, run-orderguard, beperkte sudo-route en productieblokkade. Pas readiness en workerbewaking aan voor het werkelijk aangeboden bereik. Een bestaande livenesscheck die een pagina teruggeeft is geen bewijs van een werkend platform.

Promoveer alleen een expliciete groene SHA volgens `scripts/promote-staging.sh`. Geen mergecommit op staging, geen forcepush en geen impliciete “latest main”. Controleer release-manifest, image digest, migratiestatus, live/ready en smoke-uitkomsten op de VPS. Een image-rollback is geen database-rollback; houd migraties compatibel en maak herstel reproduceerbaar.

## Op te leveren bewijs

Lever de functiedekking, migratielijst, configuratienamen zonder waarden, testresultaten, screenshotset met verschillen, release-SHA/image-digest, daadwerkelijke staging-URL, backup/restoreproef en resterende geblokkeerde items. Zet geen onderdeel op gereed zonder bewijs. De opdracht is volledig als alle beschreven logica samenhangend werkt en visueel overeenkomt; een eerste tussenrelease mag, maar wordt expliciet een tussenrelease genoemd.

Bij een inhoudelijke beslissing die niet uit de bronnen volgt: geef concrete opties en gevolgen. Vraag geen toestemming voor normale reversibele code-, test- of documentwerkzaamheden binnen deze opdracht. Stuur geen mails naar echte clubleden buiten de vastgelegde staging-allowlist en activeer geen productie.
