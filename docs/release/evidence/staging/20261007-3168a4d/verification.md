# Stagingreadback — 3168a4d

[CI](https://github.com/cluvonl/platform/actions/runs/37579255866) en [staging](https://github.com/cluvonl/platform/actions/runs/37579683910) zijn geslaagd voor exact `3168a4dcc38a784ee21c6b3a17a9c1dbefcec41d`. De imagefix heeft de brokercontracttests in de Docker-bouwfase doorlopen. Python staat uitsluitend in de bouwfase.

De daadwerkelijke HTTP-readback bevestigt dezelfde SHA, environment `staging` en modus `prototype`: liveness 200, readiness 503 met `APP_MODE_PROTOTYPE`, runtimeconfig 503 met `SUPABASE_NOT_CONFIGURED`. Het releaseartifact bevat vijftien migraties; elk bestand en de inventarishash zijn gecontroleerd tegen de exacte Git-tree. Desktop en mobiele weergave zijn daadwerkelijk vastgelegd en de mobiele Club Signal-weergave is bekeken.

De databasecounts in `readback.json` verwijzen uitdrukkelijk naar de eerdere read-only credentialcontrole: nul app-tabellen en nul toegepaste Cluvo-migraties. Deze capture leest de remote database niet opnieuw. Geen aangesloten app, staging-RLS/privacyproef, stagingrestore, OTP-aflevering, volledige V1-acceptatie of productie wordt hiermee geclaimd.
