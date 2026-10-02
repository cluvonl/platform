# Supabase: bewust nog geen uitgevoerde migraties

Zie ../docs/03_SUPABASE_DATAMODEL_EN_RECHTEN.md en ../docs/04_DOMEINTRANSACTIES_EN_INTEGRATIES.md.

Er bestaat nog geen gekoppeld Supabase-project in deze starter. Maak eerst een lokaal project via een exact gepinde Supabase CLI, daarna uitsluitend het stagingproject. Start met standaard Postgres, niet een onnodige databasebeta. Ontwikkel en test schema/RLS lokaal. Genereer migraties met de CLI; zet geen handgeschreven alles-in-een ongeteste productieschema-migratie live.

Volgorde: tenants/identities/permissions → dossiers/intake → obligations/ledger → taskcatalog/shifts/slots/bookings → attendance/swap/waitlist → exceptions/finance → policies → collaboration → integrations/outbox → season snapshots.

Voor elke tranche: positieve én negatieve RLS-proeven (incl. tweede tenant), database/advisors, migratie op lege en bestaande DB, transactionele concurrencyproeven en gerichte API/E2E-test. Public-schema tabellen moeten expliciete grants én RLS krijgen; persoonlijke gegevens zijn standaard niet publiek.

Database-migraties zijn NOG NIET aan de meegeleverde stagingworkflow gekoppeld. WP1 maakt daar een expliciete backup/migrate/verify stap van voordat APP_MODE=app wordt vrijgegeven. Geen db reset --linked; geen service_role in browser; geen automatische destructive downmigraties.
