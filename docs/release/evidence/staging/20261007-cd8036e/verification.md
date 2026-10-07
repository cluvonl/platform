# Stagingreadback — intakehulprelease cd8036e

[CI](https://github.com/cluvonl/platform/actions/runs/37581433836) en [staging](https://github.com/cluvonl/platform/actions/runs/37582146452) zijn geslaagd voor exact `cd8036eafca47e88f4014bf5bd0c8a70d9403a30`. De databasegate herhaalt de lege opbouw, SQL-asserties, database-lint en concurrencyproeven, inclusief intakehulp.

De daadwerkelijke HTTP-readback bevestigt dezelfde SHA, environment `staging` en modus `prototype`: liveness 200, readiness 503 met `APP_MODE_PROTOTYPE`, runtimeconfig 503 met `SUPABASE_NOT_CONFIGURED`. Alle zestien migratiehashes en de inventarishash in het releaseartifact zijn gecontroleerd tegen de exacte Git-tree. De Club Signal-overzichtspagina is daadwerkelijk op desktop en mobiel vastgelegd.

De intakehulpbeheerroute en haar Native/RLS/browser-/restorebewijs horen bij de afzonderlijke [lokale featurecapture](../../local/20261007-w02-intake-assistance/verification.md). Deze deployment activeert de aangesloten app niet. De databasecounts in `readback.json` verwijzen uitdrukkelijk naar de eerdere read-only credentialcontrole: nul app-tabellen en nul toegepaste Cluvo-migraties. Zij zijn geen nieuwe remote databaseobservatie tijdens deze HTTP-capture.

Staging-RLS/privacy, stagingrestore, daadwerkelijke OTP/mailaflevering, workers, volledige V1-acceptatie en productie blijven open. De roots, runtimeconfig en database moeten via hun afzonderlijke gecontroleerde routes worden aangesloten.
