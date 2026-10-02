# Lokale verificatiecapture — 84f234f

- Capture afgerond: 2 oktober 2026, 21:33 CEST (`Europe/Amsterdam`)
- Broncommit: `84f234fdc64e4b3d98fa88edaad952d5cbbe8297`
- Werkmap: `/home/codex/repos/cluvo/nextjs-starter`
- Database: geïsoleerde wegwerpcontainer `cluvo-db-test-20261002`
- Image: `public.ecr.aws/supabase/postgres:17.6.1.171`
- Databasepoort: uitsluitend `127.0.0.1:55322`

## Lege database en pgTAP

Zeven migraties zijn in timestampvolgorde op een volledig nieuwe database
toegepast. Een minimale lokale `storage.buckets`/`storage.objects`-fixture was
aanwezig om de relationele bucketconfiguratie en policies te installeren; de
Storage-service zelf draaide niet.

`pg_prove --host 127.0.0.1 --port 55322 --username postgres --dbname postgres /tests/*.sql`
eindigde met `Result: PASS`.

| Bestand | Assertions | Resultaat |
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

## Schema, rechten en lint

| Readback | Waarde |
|---|---:|
| `app`-tabellen | 140 |
| RLS enabled / forced | 140 / 140 |
| API-functies / API-views | 52 / 16 |
| `SECURITY DEFINER` in `api` | 0 |
| Verhoogde `internal`-functies | 96 |
| Verhoogde `internal`-functies zonder expliciet leeg `search_path` | 0 |
| API EXECUTE voor `anon` / `public` | 0 / 0 |
| Directe app-writetabellen voor `authenticated` | 0 |
| Storage-policies op `storage.objects` | 4 |

`cluvo-private` las terug als niet-publiek, met een limiet van 10 MiB en de
allowlist PDF/JPEG/PNG/text. `supabase db lint` voor `app,api,internal` op
warningniveau eindigde met `No schema errors found` en een lege resultatenlijst.

## Concurrency

`DATABASE_URL=… npm run db:test:race`:

```json
{"scenario":"A13_LAST_POSITION_RACE","contenders":2,"persisted_bookings":1,"conflict":"CAPACITY_FULL","result":"PASS"}
```

`DATABASE_URL=… npm run db:test:locks`:

```json
{"scenario":"SEASON_CLOSE_LEDGER_SERIALIZATION","contenders":2,"waited_milliseconds":3002,"result":"PASS"}
```

## Applicatie- en releasepoorten

- `npm run check`: PASS — ESLint, TypeScript, 22/22 Node-tests, Next.js
  16.3.8 productiebuild, 5/5 WP0-contracttests en standalone HTTP-smoke.
- `npm audit --omit=dev --audit-level=high`: PASS — 0 kwetsbaarheden.
- `npm run check:release`: verwachte exitcode 1 met
  `PRODUCTION GEBLOKKEERD: V1 is niet vrijgegeven. Werk uitsluitend op staging.`

## Bewuste grenzen

Deze capture bewijst geen upgrade vanaf een eerder uitgerolde migratiestand,
geen remote Supabase Auth/Storage/Realtime, geen provideraflevering, geen
browseracceptatie en geen stagingdeploy. Buddy/minimum-ervaren bezetting en het
bijbehorende A17/A27-impactpad zijn nog niet relationeel geïmplementeerd. Alle
A01–A30 blijven daarom `OPEN`; productie blijft geblokkeerd.
