# Supabase: lokale migraties en bewijsgrenzen

Zie ../docs/03_SUPABASE_DATAMODEL_EN_RECHTEN.md en ../docs/04_DOMEINTRANSACTIES_EN_INTEGRATIES.md.

De migraties onder `migrations/` vormen lokaal de WP1–WP11-domeinbasis. Zij zijn vanaf een lege, geïsoleerde Postgres/Supabase-basis in timestampvolgorde getest met de pgTAP-bestanden onder `tests/`. Dit lokale bewijs vervangt geen remote stagingmigratie, echte Auth/Storage/Realtime-proef of browseracceptatie.

De geïmplementeerde volgorde is: tenants/identities/permissions en kerncommands → obligations/execution → collaboration/communication/policy → onboarding/private Storage → finance/people/seasons → privacy-reduced readmodels.

Voor wijziging van een migratie: bouw een lege lokale database op, voer alle tests uit, draai `supabase db lint` en herhaal de A13-tweesessierace. De `api`-schemafuncties zijn security-invoker wrappers; verhoogde implementaties blijven in `internal`, met een vast `search_path`. Applicatietabellen hebben geforceerde RLS en directe writes voor `authenticated` blijven ingetrokken.

De stagingworkflow bevat een backup/migrate/test/lint-volgorde, maar is nog niet aantoonbaar uitgevoerd: remote, runner, database-URL en secrets ontbreken. Gebruik nooit `db reset --linked`; plaats geen server- of legacy service-role-secret in de browser en voer geen automatische destructieve downmigraties uit. Productie blijft geblokkeerd.
