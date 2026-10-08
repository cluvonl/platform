# Cluvo V1 — bewijsregister

Nieuwe stap van 8 oktober 2026 voor de door de gebruiker gevraagde omzetting naar aangesloten staging: de [echte snapshotmeting op `bf8e9f7`](evidence/staging/20261008-capture-bf8e9f7/verification.json) heeft28 catalogusfamilies,19 aanvullende families,38 fysieke datarelations/247 rijen,2 sequences en0 largeobjects gelezen via TLSv1.3 met certificaat-/hostnameverificatie. De bekende keydatasets en Storageobjecten zijn in dezelfde exportsnapshot geteld. Dezelfde geregistreerde backend hield de exclusieve sessionlock, beëindigde haar originele RR-snapshot, herhaalde de volledige verzameling in één verse RR-transactie en vond `SOURCE_UNCHANGED`; de verkregen verbinding is gesloten. De247 rijen zijn totale fysieke database-inhoud, geen gebruikersaantal. De prefix is nog0 van16, met expliciet nog geen backup, dump-snapshotimport, onafhankelijke restore of remote DDL. Globals en sequencewaarden zijn niet volledig door MVCC bevroren. Alleen vaste counts/booleans zijn geëxporteerd; private catalogi, datahashes, rollenconfig, identities en snapshotIDs blijven privé in geheugen. [Lokaal bewijs](evidence/local/20261008-staging-capture/verification.json) omvat401 Node-tests, build en HTTPsmoke; de volledige CI op dezelfde bron is groen. VPS-beheerroute en private backup-/sleutelbewaring blijven nodig voor activering. Alle V1-/productiegates blijven open/geblokkeerd.

De [webreadback van dezelfde `bf8e9f7`-release](evidence/staging/20261008-bf8e9f7/verification.json) bevestigt de groene build/deploy, alle16 oorspronkelijke migratiehashes, liveness met de juiste SHA en de visueel gecontroleerde desktop-/mobiele Club Signal-baseline. Beide screenshots zijn byte-identiek aan de vorige release. De VPS draait nog `APP_MODE=prototype`, readinessHTTP503 en runtimeconfigHTTP503. Er is nog geen staging-appactivering. De serverbootstrap is als publieke bronpackage voorbereid; GitHub-secrets zijn nog niet naar het private VPS-runtimebestand overgedragen. Op de laatste naamcontrole ontbreekt `STAGING_BACKUP_ENCRYPTION_KEY`; de beheerroute, backupbestemming en onafhankelijke sleutelbewaring zijn nog niet verstrekt. Bestaande SMTP- en achtcijferige mailontvangst blijven afzonderlijk bewijs; er is geen nieuwe mail verstuurd.

Nieuwe waarneming van 8 oktober 2026, 09:07 Europe/Amsterdam: na de gebruikersmelding dat de hosted templates zijn ingesteld, is [één nieuwe Supabase Auth-mail aangevraagd](evidence/staging/20261008-auth-otp-c89020d/request-verification.json). De handmatige stagingworkflow `37741514813` op `c89020d` is geslaagd; Supabase antwoordde HTTP200. De gebruiker heeft [ontvangst bevestigd en verduidelijkt dat de code acht cijfers heeft](evidence/staging/20261008-auth-otp-c89020d/receipt-confirmation.json). De mailaflevering en zichtbare code zijn daarmee bevestigd; de code is niet bij de provider geverifieerd. [De templatewijziging is door de gebruiker gemeld](evidence/staging/20261008-auth-otp-c89020d/template-configuration-confirmation.json), niet via beheertoegang uitgelezen. De oorspronkelijke rapporten met ontvangst nog pending blijven ongewijzigd. De eerdere bevestigde linkmail blijft afzonderlijk bewijs. Codes, tokens en het testadres worden niet geëxporteerd. Deze proef bewijst geen Native sessie, werkruimte-login, uitnodiging, V1-acceptatie of productievrijgave.

Het eerdere invoerveld en de servervalidatie accepteerden uitsluitend zes cijfers. Beide laten nu de [door Supabase ondersteunde zes tot tien numerieke cijfers](https://github.com/supabase/supabase/blob/master/apps/docs/spec/cli_v1_config.yaml) toe, met behoud van voorloopnullen. De tekst vraagt om de volledige code uit de e-mail. [Lokaal bewijs](evidence/local/20261008-otp-length/verification.json) omvat 300 Node-tests, waaronder zes nieuwe tests die de echte Server Action met synthetische providerantwoorden uitvoeren, lint, typecheck, build, standalone HTTP en de desktop-/mobiele invoercontrole. Ongeldige invoer bereikt Auth niet; providerweigering en ontbrekende werkruimte blijven toegang weigeren. Dit is formaat- en autorisatieflowbewijs met mocks, geen echte sessievalidatie. De hosted Auth-instellingen zijn niet gewijzigd door de agent.

Eerdere waarneming van 8 oktober 2026: de gebruiker heeft Supabase SMTP ingesteld. De [eerste echte Supabase Auth-mailproef](evidence/staging/20261008-auth-mail-c89020d/request-verification.json) op `c89020d` heeft precies één aanvraag voor het vooraf afgesproken testadres gedaan. Supabase antwoordde HTTP200. De gebruiker heeft daarna [ontvangst van de nieuwe mail met een link bevestigd](evidence/staging/20261008-auth-mail-c89020d/receipt-confirmation.json). Bij die eerste proef waren aanwezigheid van een code, correcte linkredirect en echte sessievalidatie niet bevestigd. De oorspronkelijke request- en readbackrapporten blijven ongewijzigd als historische producerwaarneming met ontvangst nog pending. SMTP-configuratie is door de gebruiker gemeld, niet met een managementtoken uitgelezen. Er is geen Native sessie of werkruimte-login bewezen.

De [stagingreadback van `2f03bbe`](evidence/staging/20261008-2f03bbe/verification.json) bevestigt exact dezelfde groene main-/deploymentrelease, zestien ongewijzigde migraties en het bestaande desktop-/mobiele prototypebeeld. De [online OTP-formuliercontrole](evidence/staging/20261008-2f03bbe/otp-form-results.json) bewaart zes, acht en tien cijfers volledig, inclusief voorloopnullen, op desktop en mobiel. De screenshots zijn visueel gecontroleerd en byte-identiek aan de lokale build. Er is geen echte code ingevuld of Auth-request door de browser verstuurd. De [nieuwe alleen-lezen preflight](evidence/staging/20261008-preflight-2f03bbe/verification.json) ziet nog één Auth-record, nul app-tabellen en nul toegepaste van zestien migraties; certificaat- en hostnamecontrole zijn geslaagd. De bekende sleutelafhankelijke families zijn leeg binnen de vastgelegde scope, maar de Auth-records zijn niet leeg en een consistente snapshot of volledige restore is niet bewezen. De runtime blijft prototype met readiness HTTP503 en ontbrekende Supabase-runtimeconfiguratie. Appactivering, echte sessie/login, staging-RLS/privacy, backup/restore, uitnodigingsaflevering en volledige V1 blijven OPEN.

De eerdere [alleen-lezen preflight na de eerste Auth-aanvraag](evidence/staging/20261008-preflight-c89020d/verification.json) en [stagingreadback van `c89020d`](evidence/staging/20261008-c89020d/verification.json) blijven bewaard als historische waarnemingen. De volledige scope en productiegates blijven gelden.

## Eerdere waarnemingen van 7 oktober 2026

Waarneming van 7 oktober 2026: de [SendGrid-domeinmetadata](evidence/staging/20261007-mail-after-domain-verification/status-results.json) bevestigt de geverifieerde `cluvo.nl`-afzenderconfiguratie. Precies één nieuwe [echte testmail](evidence/staging/20261007-mail-after-domain-verification/send-results.json) is door SendGrid aangenomen; de gebruiker heeft daarna [ontvangst in de inbox bevestigd](evidence/staging/20261007-mail-after-domain-verification/receipt-confirmation.json) voor de opgegeven testreferentie. Dit afzonderlijke ontvangstbewijs verandert de eerdere onbekende aflevering niet. Supabase SMTP-configuratie, Native OTP en uitnodigingsaflevering zijn nog niet bewezen.

De [echte blijvende databasesessie op `937db4d`](evidence/staging/20261007-persistent-session-937db4d/verification.json) heeft alle 14 vaste transportcontroles doorstaan via de staging-sessionpooler: TLSv1.3, dezelfde SQL-backend en exclusieve lock, weigering van een tweede lockhouder, capture en verse alleen-lezen transactie, lockvrijgave en weigering van meerdere statements en schrijf-CTE. De oorspronkelijke mislukte metingen blijven bewaard; de precieze oorzaak van de eerdere generieke identityfout blijft onbekend. Een export/import met PostgreSQL17, volledige catalogus-/datavergelijking, versleutelde backup, sleutelbewaring en onafhankelijke restore zijn hiermee niet uitgevoerd. Er is geen migratievrijgave en geen app-DDL uitgevoerd.

De [stagingreadback van `937db4d`](evidence/staging/20261007-937db4d/verification.json) bevestigt de prototype-runtime, de exacte CI-/deploymentrelease, zestien ongewijzigde migratiehashes en het bestaande desktop- en mobiele beeld. De [aparte actuele alleen-lezen preflight](evidence/staging/20261007-preflight-4b04ff9/verification.json) telde nul app-tabellen en nul toegepaste migraties, met zestien migraties nog open. De functionele app, aangesloten staging-RLS/privacy en volledige V1-acceptatie blijven OPEN; productie blijft geblokkeerd. Alle 219 functies, 28 aanvullingen en A01–A30 blijven V1-scope.

## Historische aanvullingen van 7 oktober 2026

Eerdere operationele waarneming: de [domeincontrole op 1d56c62](evidence/staging/20261007-mail-status-1d56c62/verificatie.md) vindt geen geauthenticeerd cluvo.nl-domein in SendGrid. De gebruiker verzorgt de gegenereerde DNS-records en verificatie zelf via SendGrid en Hostnet. Ontvangst, succesvolle domeinverificatie, SMTP/OTP en uitnodigingsaflevering zijn nog niet bewezen. De [stagingreadback](evidence/staging/20261007-1d56c62/verification.md) en [vijf hosted configuratiecontroles](evidence/staging/20261007-credentials-1d56c62/verification.md) zijn geslaagd; de runtime blijft prototype, met nul toegepaste van zestien migraties. Er is geen tweede echte mail verstuurd. De [aanvullende alleen-lezen herstel-/migratierechtencontrole](evidence/local/20261007-staging-backup-capabilities/verification.md) heeft 123 Node-tests en negen onafhankelijke synthetische probes doorstaan; de echte hostedmeting volgt afzonderlijk en verleent geen DDL-vrijgave.

Eerdere aanvulling van 7 oktober 2026: [intakehulpbeheer en lokaal herstelbewijs](evidence/local/20261007-w02-intake-assistance/verification.md), [feitelijke stagingreadback van `30e2610`](evidence/staging/20261007-1d56c62/readback.json), [hosted credential- en certificaatcontrole](evidence/staging/20261007-credentials-1d56c62/verification.md) en [volledige 219-functiematrix](function-coverage/function-matrix.json). Lokaal zijn zestien migraties, 144 applicatietabellen, 856 database-asserties, achttien concurrencyproeven, 105 eerdere browserregressies en 28 intakehulpcontroles op de definitief gestileerde build bewezen. De private herstelproef na de browsermutaties bewaart alle 144 tabelinhouden, Native guards en onveranderlijke hulpbesluiten. De stagingreadback bewijst uitsluitend prototype-modus; aangesloten RLS/privacy, backup/restore en daadwerkelijke OTP/mailaflevering blijven open. De [nieuwe operationele controles](evidence/local/20261007-staging-data-checks/verification.md) voegen 77 geslaagde Node-tests en 158 uitgevoerde PostgreSQL-formatproeven toe. Alle vijf hosted checks zijn daarna geslaagd; de echte SendGrid-mail is aangenomen, maar de gebruiker meldt nog geen ontvangst. De [alleen-lezen mailstatus](evidence/staging/20261007-mail-status-6edb68d/verification.md) vindt één passende kandidaat met `not_delivered`; de exacte oorspronkelijke verzending en gebruikersontvangst blijven onbewezen. De aanvullende GET-diagnose is lokaal met 85 Node-tests gecontroleerd. De [onafhankelijke lokale herstelproef](evidence/local/20261007-independent-restore/verification.md) bewaart daarnaast 196 fysieke tabellen/4.000 synthetische rijen en 28 catalogusfamilies in een nieuwe rolcluster, met expliciete hosted/providerbeperkingen. De [hosted maildiagnose](evidence/staging/20261007-mail-status-30e2610/verification.md) wijst op afzenderauthenticatie bij positieve credits; de volgende domeinmetadata-GET is met 87 Node-tests gecontroleerd. Het onderstaande register bewaart de historische capture van 2 oktober. De volledige V1-acceptatie blijft OPEN.

Bewijscapture: 2 oktober 2026, 21:33 CEST (`Europe/Amsterdam`)

## Historisch oordeel bij de capture van 2 oktober 2026

De overdracht, Club Signal-baseline, echte appketen en uitgebreide lokale domeinbasis zijn reproduceerbaar gecontroleerd op implementatiecommit `84f234fdc64e4b3d98fa88edaad952d5cbbe8297`.

Lokaal geslaagd:

- Next.js lint, typecheck, 22 Node-tests, productiebuild en standalone HTTP-readback;
- zeven migraties vanaf een lege database en 435/435 pgTAP-asserties;
- schema-/grant-/RLS-readback en database-lint;
- een echte tweesessie-race voor de laatste dienstplaats;
- een echte tweesessie-lockproef voor season close versus ledgerwriters;
- negatieve runtime- en releasegates voor productie.

Dit is **geen V1- of stagingacceptatie**. Er is geen remote stagingomgeving,
echte Auth/Storage/Realtime-service, providerproef of volledige browser-E2E
uitgevoerd. `release/acceptance-register.json` houdt A01–A30 alle dertig
`OPEN`; `release/readiness.json` houdt `v1_ready=false` en
`production_enabled=false`.

## E01 — bron, pakket en provenance

| Veld | Waarde |
|---|---|
| Werkmap | `/home/codex/repos/cluvo/nextjs-starter` |
| Gecontroleerde implementatiecommit | `84f234fdc64e4b3d98fa88edaad952d5cbbe8297` |
| Commitonderwerp | `feat: close local acceptance command gaps` |
| Geïmporteerde baselinecommit | `a9f62f3fe9e4ef5801b33a4247c74104017a9ba5` |
| Oorspronkelijke prototypecommit | `5d96234ade7dba5f79bdd0f4ddbc21e26fc13801` |
| Canon | `Duindorp_SV_V1_Releasecanon_v1.0.docx` |
| Productierelease toegestaan | `false` |
| Lokale verificatiecapture | [20261002-84f234f-verification.md](evidence/local/20261002-84f234f-verification.md) |
| SHA-256 verificatiecapture | `dd06814736a90519315194b89123d4e9aff56841d4aa1c1314319eecc1280b9d` |

| Controle | Resultaat |
|---|---|
| SHA-256 overdrachts-ZIP | `c35447c17864191f4af837f3c2de10f9e64a32f5af49db9997fd405733eb6dd5` |
| ZIP-integriteit | `unzip -t` geslaagd |
| Pakketmanifest | 293/293 regels `OK`; geen `FAILED` |
| Losse/package/repository-startprompt | Alle drie `741d01125c486b9dd27de2ffae73567ac9ec6baf9d3f89f241a923384dd7432f` |
| Package/repository-provenance | Beide `950c6c5f065009ab609403ca3b13909041deb52e305badae549f5ff16cd9ffcc` |

## E02 — applicatie en toolchain

| Onderdeel | Uitvoering | Waargenomen resultaat |
|---|---|---|
| Node/npm | `.nvmrc`, `packageManager` | Node 24.19.0 doelversie; npm 11.16.0 |
| Supabase CLI | exact devDependency | 2.119.0 |
| Volledige lokale appgate | `npm run check` | Geslaagd: ESLint, TypeScript, 22/22 Node-tests, Next.js-build en WP0-rooktest |
| Productiebouw | `next build --webpack` | Next.js 16.3.8; alle publieke en beveiligde routes gebouwd; standalone-output geslaagd |
| HTTP-readback | `scripts/wp0-smoke.mjs` | Root, liveness, readinessblokkade en runtimeconfiguratie gecontroleerd op een ephemeral poort |
| Dependency-audit | `npm audit --omit=dev --audit-level=high` | 0 kwetsbaarheden |
| Productiegate | `npm run check:release` | Verwachte exitcode 1: production geblokkeerd |

De appmodus bevat serverroutes voor persoonlijke OTP, claims, workspaces, intake, huishouduitnodiging, boeking en presentiebevestiging. Build zonder runtimegeheimen blijft mogelijk; appmodus zelf vereist expliciete serverconfiguratie en een afzonderlijk uitnodigingsgeheim.

## E03 — databaseopbouw en pgTAP

Testbasis: geïsoleerde wegwerpcontainer `cluvo-db-test-20261002`, Supabase Postgres `17.6.1.171`, database `postgres`. Voor Storage waren de relationele schema-objecten aanwezig; de Storage API/service zelf draaide niet.

Migraties zijn op een leeggemaakte app/api/internal-basis in timestampvolgorde toegepast:

1. `20261002163042_cluvo_wp1_wp2_core.sql`
2. `20261002165306_wp3_wp5_obligations_execution.sql`
3. `20261002165327_wp6_wp8_collaboration_communication_policy.sql`
4. `20261002170949_wp1_onboarding_storage.sql`
5. `20261002171135_wp9_wp11_finance_people_seasons.sql`
6. `20261002183000_vertical_read_models.sql`
7. `20261002184500_assisted_member_actions.sql`

Dit bewijst een opbouw vanaf leeg. Een afzonderlijk upgradepad vanaf een eerder
uitgerolde migratiestand is niet uitgevoerd en blijft `OPEN`.

| pgTAP-bestand | Assertions | Resultaat |
|---|---:|---|
| `001_wp1_wp2_core.sql` | 32 | PASS |
| `002_wp1_onboarding.sql` | 56 | PASS |
| `003_wp3_wp5_obligations_execution.sql` | 74 | PASS |
| `004_wp6_wp8_domain_invariants.sql` | 113 | PASS |
| `005_wp6_wp8_rls.sql` | 30 | PASS |
| `006_vertical_read_models.sql` | 11 | PASS |
| `007_wp9_wp11_finance_people_seasons.sql` | 81 | PASS |
| `008_a29_assisted_member_actions.sql` | 38 | PASS |
| **Totaal** | **435** | **PASS** |

Gerichte hardening die in deze run is bewezen:

- suspended/archived tenants verliezen ook via directe Data API/RPC de centrale autorisatie;
- policy-managers en follow-uprollen mogen lezen/toezien maar niet namens een lid openen of vragen;
- progress-only huishoudtoegang geeft geen financiële details en geen bezwaarrecht;
- verlopen, onbevestigde diensten blokkeren finance en season close;
- ledgerwijziging na finalisatie vereist eerst expliciete reassessment/correctie;
- een gesloten seizoen accepteert geen nieuwe ledgerpost;
- verleden diensten zonder expliciete booking-close kunnen niet achteraf worden geboekt;
- invitation-acceptatie met bookingrecht maakt exact één executor-obligation-grant.
- A10-huishoudsplitsing maakt geen tweede verplichting, ledger, vrijstelling of
  bookingrecht en bewaart een afzonderlijk dossier met gecontroleerde readback;
- A16 gebruikt één servercommand voor formulier/drag-semantiek, stabiele
  positions en optimistic concurrency; gepubliceerde wijzigingen kunnen deze
  route niet omzeilen;
- A17 publiceert batches atomair, bewaart de exacte publicatiesnapshot en
  verwerkt materiële wijzigingen via preview/hash/apply, met transfer-,
  overlap-, serverklok-, grant-, leeftijd-, kwalificatie- en
  onbeschikbaarheidscontroles plus gerichte lokale outboxunits;
- A29 boekt telefonisch in één transactie via de normale bookinginvarianten en
  bewaart actor, subject, reden, effect en append-only correctiehistorie met
  gescheiden geschilbevoegdheid.

## E04 — schema-, RLS- en grant-readback

| Controle | Waargenomen resultaat |
|---|---:|
| `app`-tabellen | 140 |
| RLS enabled | 140/140 |
| RLS forced | 140/140 |
| API-functies | 52 |
| API-views | 16 |
| `SECURITY DEFINER` in `api` | 0 |
| Verhoogde `internal`-functies | 96; alle met expliciet leeg `search_path` |
| API EXECUTE voor `public` | 0 |
| API EXECUTE voor `anon` | 0 |
| Directe app-table writes voor `authenticated` | 0 |
| Storage-policies | 4 |
| `cluvo-private` | `public=false`, 10 MiB, PDF/JPEG/PNG/text-allowlist |
| `supabase db lint --schema app,api,internal --level warning --fail-on warning` | Geen schemafouten of waarschuwingen |

## E05 — echte lokale concurrency

### A13 laatste plek

`DATABASE_URL=… npm run db:test:race` start twee afzonderlijke psql-processen met verschillende geverifieerde actoren tegen dezelfde open position.

```json
{"scenario":"A13_LAST_POSITION_RACE","contenders":2,"persisted_bookings":1,"conflict":"CAPACITY_FULL","result":"PASS"}
```

Dit is lokaal concurrency-I-deelbewijs voor A13. De browserconflict-/wachtlijstroute en stagingherhaling ontbreken nog.

### Season close versus ledgerwriter

`DATABASE_URL=… npm run db:test:locks` laat twee afzonderlijke transacties dezelfde transaction-scoped season/ledger-lock claimen. De tweede transactie wachtte in deze capture 3002 ms op de eerste en ging daarna door.

```json
{"scenario":"SEASON_CLOSE_LEDGER_SERIALIZATION","contenders":2,"waited_milliseconds":3002,"result":"PASS"}
```

De workflow herhaalt beide concurrencyproeven na de lokale pgTAP-run.

## E06 — visuele Club Signal-baseline

| Weergave | Bewijsbestand | SHA-256 |
|---|---|---|
| Desktop, 1440 × 1024 | [club-signal-1440x1024.png](evidence/wp0/screenshots/club-signal-1440x1024.png) | `45ecf306045880d49c1f9c940cf5901db5f9046fa8e7e11fbb3b327d299fd7e9` |
| Mobiel, 390 × 844 | [club-signal-390x844.png](evidence/wp0/screenshots/club-signal-390x844.png) | `439aafca839e460c0d01f4dd24cfaa8c26d1f35bdcfc1cf6f6754f2a01719e92` |

Deze afbeeldingen bewijzen uitsluitend de visuele startbaseline, niet de mobiele gelijkwaardigheid of browserwerking van de beveiligde appketen.

## Lokale dekking versus resterend bewijs

- Lokaal D-deelbewijs bestaat nu ook voor A10, A16, A17 en A29. A10 en A29
  hebben gericht lokaal R-deelbewijs. Buddy/minimum-ervaren bezetting en het
  bijbehorende A17/A27-impactpad zijn nog niet relationeel geïmplementeerd.
- A17 heeft uitsluitend lokaal database→intent→outbox-I-deelbewijs; een lokale
  queued outboxunit is niet hetzelfde als worker- of provideraflevering.
- R-deelbewijs is sterk voor delen van A05, A07–A12, A14, A18, A22,
  A24–A26, A28 en A29, maar vervangt geen echte sessie-/browserproef.
- A13 heeft lokale D plus een echte tweesessie-race. De overige vereiste integratie-/jobproeven zijn niet volledig.
- E/browserbewijs en remote stagingbewijs ontbreken voor alle A01–A30.

Daarom blijft ieder acceptatie-ID `OPEN`; zie [implementation-board.md](implementation-board.md) voor de volledige matrix.

## Externe blokkades

1. Private GitHub-remote, Actions en vertrouwde stagingdeployidentiteit ontbreken.
2. Staginghost/VPS, domein/TLS, broker, runner en remote rollbackpad ontbreken.
3. Afzonderlijk Supabase-stagingproject en veilige secretinrichting ontbreken.
4. OTP/mailopvang en toegestane testontvangers ontbreken; echte A11/A20–A23-aflevering is niet bewezen.
5. Sportlink/ledenbron, push en financiële providers zijn niet geautoriseerd of ingericht.
6. Werkelijke testaccounts, beheerdersmandaten, seizoensdata en beleidsdocumenten ontbreken voor volledige clubacceptatie.
7. Backup/restore en promotie van exact dezelfde bewezen image-digest zijn niet uitgevoerd.

Vraag credentials niet in chat en leg ze niet vast in fixtures, logs of Git. Production blijft technisch geblokkeerd tot volledige A01–A30, herstelbewijs en expliciete vrijgave.
