# Cluvo V1 — lokaal bewijsregister

Actuele aanvulling van 7 oktober 2026: [intakehulpbeheer en lokaal herstelbewijs](evidence/local/20261007-w02-intake-assistance/verification.md), [feitelijke stagingreadback van `3168a4d`](evidence/staging/20261007-3168a4d/readback.json), [hosted credential- en certificaatcontrole](evidence/staging/20261007-credentials-b08415f/verification.md) en [volledige 219-functiematrix](function-coverage/function-matrix.json). Lokaal zijn zestien migraties, 144 applicatietabellen, 856 database-asserties, achttien concurrencyproeven, 105 eerdere browserregressies en 28 intakehulpcontroles op de definitief gestileerde build bewezen. De private herstelproef na de browsermutaties bewaart alle 144 tabelinhouden, Native guards en onveranderlijke hulpbesluiten. De stagingreadback bewijst uitsluitend prototype-modus; aangesloten RLS/privacy, backup/restore en daadwerkelijke OTP/mailaflevering blijven open. Het onderstaande register bewaart de historische capture van 2 oktober. De volledige V1-acceptatie blijft OPEN.

Bewijscapture: 2 oktober 2026, 21:33 CEST (`Europe/Amsterdam`)

## Huidig oordeel

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
