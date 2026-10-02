# Uitgevoerde lokale controles

Datum: 2 oktober 2026 (`Europe/Amsterdam`). Dit verslag betreft de geverifieerde overdracht, de Next.js-app en de lokale database-implementatietranche. Het is geen staging- of productieacceptatie.

| Controle | Resultaat |
|---|---|
| Pakket en provenance | ZIP-inhoud 293/293 SHA-256-regels correct; baselinecommit `a9f62f3fe9e4ef5801b33a4247c74104017a9ba5`; prototypebron `5d96234ade7dba5f79bdd0f4ddbc21e26fc13801` |
| Overzetting naar Next.js | Next.js 16.3.8 zonder Vinext-, Cloudflare- of Sites-runtime; Club Signal-bron, CSS en merkassets behouden |
| Toolchain | `.nvmrc` Node 24.19.0; npm 11.16.0; Supabase CLI 2.119.0; directe dependencies exact vastgezet in lockfile |
| Applicatiecheck | `npm run check` geslaagd: lint, TypeScript, 22 Node-tests, productiebuild en standalone HTTP-rooktest |
| Dependency-audit | `npm audit --omit=dev --audit-level=high`: 0 kwetsbaarheden |
| Routes | Build bevat OTP/confirm, workspaces, tenantoverzicht, intake, diensten, presentie en invitation-accept routes; beveiligde routes zijn dynamisch |
| Lege database-opbouw | Zeven migraties in timestampvolgorde toegepast op een geïsoleerde Supabase Postgres 17.6.1.171-container |
| pgTAP | Acht bestanden, 435 assertions, alle geslaagd |
| Schema-readback | 140 `app`-tabellen; alle 140 met RLS enabled en forced; 52 API-functies en 16 API-views |
| Functiegrenzen | 0 `SECURITY DEFINER`-functies in `api`; alle 96 verhoogde `internal`-functies hebben een expliciet leeg `search_path` |
| Grants | 0 API-executierechten voor `public` of `anon`; 0 directe INSERT/UPDATE/DELETE-tabellen voor `authenticated` in `app` |
| Private Storage | Niet-publieke `cluvo-private`-bucket, 10 MiB-limiet, MIME-allowlist en vier RLS-policies geïnstalleerd tegen een lokale Storage-schemafixture |
| Database-lint | `supabase db lint` voor `app,api,internal` op warningniveau: geen resultaten |
| A13 concurrency | Twee echte psql-processen op één laatste plek: één boeking, één `CAPACITY_FULL`, exact één persistente booking |
| Season/ledger concurrency | Tweede transactie wacht aantoonbaar op de transaction-scoped lock; herhaalbaar via `npm run db:test:locks` |
| Runtimegate | Ontbrekende `APP_ENV` in appmodus en iedere productionomgeving stoppen vóór serverstart; prototype blijft lokaal zonder secrets bouwbaar |
| Productiereleasegate | `check-release.mjs` weigert; geen actieve productieworkflow; `v1_ready=false` en `production_enabled=false` |

## Niet uitgevoerd en niet als werkend geclaimd

- Er is geen Git-remote, Actions-run, private GHCR-publicatie, staginghost, TLS-domein of bevoegde deployrunner gekoppeld.
- Er is geen afzonderlijk Supabase-stagingproject verbonden. De Auth-, Storage- en Realtime-diensten zijn niet end-to-end tegen een remote project getest.
- Er is geen echte OTP-/mailaflevering, push, Sportlink/CSV-providerjob, financiële provider, webhook of scheduler uitgevoerd.
- Er is geen volledige browseracceptatie met de vereiste profielen, schermreadback, mobiel bewijs en alle negatieve directe URL-/search-/exportpaden uitgevoerd.
- Backup/restore, remote migratie, rollback en herdeploy van exact hetzelfde image-digest zijn niet bewezen.
- Een upgrade vanaf een eerder uitgerolde migratiestand is niet uitgevoerd; de
  databasecapture bewijst uitsluitend opbouw vanaf leeg.
- Buddy/minimum-ervaren bezetting en het bijbehorende A17/A27-impactpad zijn nog
  niet relationeel geïmplementeerd.
- Er is geen productieomgeving aangemaakt, gemigreerd of gepubliceerd.

## Open acceptatiestatus

Alle A01–A30 staan in `release/acceptance-register.json` op `OPEN`. De lokale
pgTAP- en concurrencyresultaten zijn D/R-deelbewijs; A13 heeft beperkt lokaal
concurrency-I-bewijs en A17 uitsluitend database→intent→outbox-I-deelbewijs.
A10, A16, A17 en A29 hebben nu gerichte lokale command-/invarianttests, maar
geen van deze resultaten vervangt ontbrekend provider-, browser- of
stagingbewijs. De exacte capture staat in
[20261002-84f234f-verification.md](release/evidence/local/20261002-84f234f-verification.md);
de precieze dekking en gaten staan in `docs/release/implementation-board.md` en
`docs/release/v1-evidence.md`.

Wijzig een acceptatiestatus uitsluitend na bewijs op de exacte broncommit en migratieversie, met fixture/rollen, waargenomen database- én schermresultaat, artefact en stagingomgeving. Productie kan pas na alle A01–A30, herstelbewijs en expliciet akkoord in een afzonderlijke wijziging worden geactiveerd.
