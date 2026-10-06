# 6 oktober 2026 — W00/W01 en bestaande bookingketen

Dit is lokaal deelbewijs voor een tussenrelease. De volledige V1-scope blijft
23 pagina's, 219 functies en 102 acceptatiecriteria. Alle criteria blijven OPEN;
`v1_ready=false` en `production_enabled=false`. De historische registers van
2 oktober zijn behouden. De actuele functiematrix staat in
[function-matrix.json](../../../function-coverage/function-matrix.json).

De gebruikersvraag om autonoom te werken en de meegeleverde startopdracht
bepalen de uitvoering. Overdrachtsdocumenten zijn product- en referentiemateriaal;
voorbeelden daarin verlenen geen toegang tot productie of echte ledengegevens.

## Bron en wijzigingen

De beginwerkboom was schoon op `main`, met HEAD, remote main en remote staging
op `47386491859b47fbebf85c3b209724dcc20407fc`. Het nieuwe overdrachtspakket is
gecontroleerd: 134/134 SHA-256-manifestregels overeenkomend. De referentienorm is
prototype-SHA `e9c1d8bca2089b0944577eed73d1bedf7e70a3b6`. De oorspronkelijke
referentie is niet gewijzigd; de nulmeting draait uit een aparte werkcopy.
De geïmporteerde CSV behoudt via `.gitattributes` haar originele CRLF-bytes.

De aangesloten app gebruikt de bestaande Club Signal-sidebar, navigatie,
topbar, kaarten, inzetmeter, buttons en mobiele drawer. Vrije demo-rol- en
persoonskeuze zijn vervangen door serververleende werkruimtes en een echte
uitlogactie. De eigen dossierstand gebruikt een expliciete seizoenselectie en
hergebruikt de canonieke obligation-status, inclusief structurele dekking.
Andere dossier-/seizoen-ID's uit een URL worden niet als toegangsrecht gebruikt.

Persoonlijke uitleg wordt per geverifieerde Auth-gebruiker en stabiel onderwerp
bewaard. De 149 onderwerp-ID's komen uit het register. Kruis en Gezien gebruiken
hetzelfde command; de eerste serverdatum blijft behouden bij retries. De
unieke account/onderwerpcombinatie is de natuurlijke idempotencykey. Dit is een
monotone, niet-gevoelige voorkeur, zonder mutabele versie of tenantdossier.
De registratie bevat actor en tijd; zij schrijft geen tenantbrede audit- of
notificatiegegevens. Beide tabellen hebben geforceerde RLS; gebruikers hebben
geen directe schrijf-/wisrechten. Er is geen client-actorparameter.

De nieuwe canonieke markt is `/c/[club]/taken`; de bestaande `/diensten`-route
blijft als compatibiliteitsroute werken. Persoonlijke taken worden later onder
`/mijn-taken` aangesloten. De bestaande `book_shift`-transactie blijft de enige
bookingroute. Deze tussenstap implementeert nog geen teams/clusters of volledige
uitvoerder-/buddy-/instructiekeuze.

De lokale Auth-config had de e-mailprovider uitgeschakeld. `[auth.email]`
`enable_signup=true` schakelt de provider in; `[auth] enable_signup=false` en
`shouldCreateUser=false` houden publieke registratie dicht. Zie de
[provider/config-mapping bij Supabase](https://github.com/supabase/supabase/issues/40582).
De lokale container kon de gebinde mailsjablonen aanvankelijk niet lezen; alleen
deze niet-geheime HTML-bestanden zijn lokaal leesbaar gemaakt (`chmod 644`).

CI en staging behouden hun bestaande gates en volgorde. Alleen Supabase-start
loopt nu via `scripts/start-local-database.mjs`: de CLI-status met sleutels wordt
niet gelogd. Een subprocessproef controleert dit bij succes én fout. Next.js
heeft zijn eigen instructieblok in `AGENTS.md` toegevoegd; dit blok is behouden.
Dependencies en lockfile zijn ongewijzigd.

## Uitgevoerde controles

| Controle | Uitkomst |
|---|---|
| `npm run check` | PASS: lint, typecheck, 23 Node-tests, production build, 5 WP0-contracttests en standalone HTTP-smoke |
| Upgrade vanaf zeven migraties | PASS: lokale reset naar `20261002184500`, daarna `migration up --local` |
| pgTAP na upgrade | PASS: 10 bestanden, 475 asserties |
| Lege installatie | PASS: acht migraties via `db reset --local --no-seed` |
| pgTAP na lege installatie | PASS: 10 bestanden, 475 asserties |
| Nieuwe uitlegtests | 29 asserties: onbekend onderwerp, ontbrekende actor, eigen account, andere gebruiker, retry, geen direct schrijven/wissen |
| Nieuwe seizoensprojectie | 11 asserties: actueel versus historisch seizoen, eigen tenant, expliciet voortgangsrecht en intrekking |
| Laatste plaats, twee DB-sessies | PASS: één persisted booking en één `CAPACITY_FULL` |
| Seizoen/ledger, twee DB-sessies | PASS: lock wachtte 3004 ms |
| Database-lint app/api/internal | PASS: geen warnings of schemafouten |
| Productiegate | Verwachte weigering: `check:release` exit 1 |
| Browser via production standalone + lokale Supabase Auth/Mailpit | PASS: 14 benoemde controles; [resultaat](browser-results.json) |
| Backup/restore in geïsoleerde DB | PASS: 142 app-tabellen gelijk; [resultaat en grenzen](restore-results.json) |

De oude zeven migraties blijven bytegelijk aan de begin-SHA. Er is één nieuwe,
append-only migratie: `20261006180000_account_help_preferences.sql`.
De inventaris verandert van 140 tabellen / 52 API-functies / 16 API-views naar
142 / 53 / 19. Alle 142 applicatietabellen forceren RLS, de API bevat geen
SECURITY DEFINER-functies en het uitlegcommand blijft eigendom van
`cluvo_command_owner`, zonder superuser/BYPASSRLS.

De browserproef verifieert OTP-login van twee synthetische accounts, kruis en
Gezien, apart browserprofiel, keyboard en echte touch, gelijktijdige tabbladen,
fout plus retry, zoeken/Escape, mobile logout en directe URL-weigering zonder
sessie of naar een andere tenant. Een echte booking door ouder B verhoogt de
gedeelde planning van 120 naar 240 minuten; bevestigd blijft 60 minuten.
SQL-readback vindt precies één booking met actor B, uitvoerder B en de gekozen
plaats. De urenstand wordt hierdoor niet als uitgevoerd verhoogd.

De fixture komt uit de bestaande coretest en bevat uitsluitend `example.test`
accounts. OTP's en sessies blijven in geheugen/lokale mailopvang; ze staan niet
in de bewijsbestanden. Voor herhaalde browserproeven zijn alleen de voorkeuren
van deze twee accounts in de lokale wegwerpdatabase teruggezet. De restoreproef
gebruikt een vaste snapshot vóór de laatste bookingproef. De database wordt
teruggezet met haar oorspronkelijke function owners en grants; 142 tabelchecks
vergelijken zowel aantallen als inhoudsdigests. De backup zelf blijft privé
buiten Git. Clusterrollen bestaan op hetzelfde cluster; een onafhankelijke
host, Storage-objectbinaries en een stagingbackup zijn hiermee niet bewezen.

## Reproduceren

Gebruik uitsluitend de lokale `cluvo-local`-wegwerpstack. Een reset is geen
staging- of productiehandeling. Start zonder CLI-sleuteluitvoer via
`node scripts/start-local-database.mjs`; voer de databasechecks uit vóór het
persistente browserseed. `node scripts/seed-local-browser.mjs` weigert een
niet-lege identitytabel. Gebruik de lokale publishable/secret key uitsluitend
in een privaat runtimebestand en start de gebouwde standalone app op poort
3200. De mailopvang gebruikt poort 55324. Geen waarden opnemen in logs.

`PLAYWRIGHT_MODULE` verwijst naar een apart geïnstalleerde, gepinde Playwright
1.63.0-toolchain; de applicatielockfile is hiervoor niet aangepast. Uitvoering:
`node scripts/browser-w01.mjs`. Voor de referentie draait de aparte werkcopy op
3201 (webpack omdat de dependency-symlink buiten de Turbopack-root ligt).
`CAPTURE_REFERENCE=1 REFERENCE_ONLY=1` maakt de default-page-nulmeting.
De framework-devoverlay wordt alleen in captures verborgen; `caret: initial`
voorkomt dat de screenshottool inputstijl wijzigt terwijl React hydrateert.

## Staging en resterend werk

De bestaande GitHub-remote, groene historische CI, stagingrunner en
`https://staging.cluvo.nl` zijn vastgesteld. De site draaide bij deze capture
nog `APP_MODE=prototype`: live 200, ready 503 met `database=not_connected`,
`workers=not_started`, `authorization=demo_only`. Dit is geen app-acceptatie.

Lokaal is geen toegang tot `/etc/cluvo/staging-target.json`,
`/etc/cluvo/staging.env` of de beheersroute gevonden. Alleen veilige namen zijn
gecontroleerd: APP_ENV, APP_MODE, APP_URL, SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY en INVITATION_TOKEN_SECRET.
De geïnstalleerde broker, compose/runtime, gekoppelde Supabase-projectref,
Auth-redirects, remote migratieroute en allowlist moeten via de bestaande veilige
beheerroute worden gelezen en aangesloten. Hiervoor is een concrete vraag naar
de toegangsroute gesteld; geen secretwaarden zijn gevraagd.

W00/W01 zijn deelwerk, geen volledige werkpakketacceptatie. W02–W11 blijven
volledig in scope, inclusief teams/clusters, uitvoering/overname, acties,
gezinsagenda, advies, reserve/opvolging, overdracht, beleid/samenwerking,
providers/workers, financiën en seizoenovergang. De huidige intake is nog niet
de volledige vierstappenflow. Volledige tabs/modals, staging-RLS/privacy,
workerbewaking, live providers, herstel/rollback en de visuele stagingvergelijking
blijven vereist vóór V1-acceptatie. De prototype- en productiegates zijn behouden.
