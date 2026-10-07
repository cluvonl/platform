# Hosted stagingcontrole — 7 oktober 2026

Beide controle-artifacts zijn ongewijzigd overgenomen voor bron-SHA `b08415f6efce281501295a8faa994fbf6a9e7483`.

De [controle met certificaat- en hostnameverificatie](https://github.com/cluvonl/platform/actions/runs/37560498970) is niet geslaagd: psql meldt uitsluitend de veilige status `DATABASE_TLS_UNAVAILABLE`. De `verify-full`-controle gebruikte de Ubuntu CA-bundle en werd niet automatisch verlaagd. De ruwe providerdiagnostiek blijft onderdrukt. Supabase-keys en SendGrid sandboxvalidatie zijn in diezelfde run wel geslaagd.

De afzonderlijke [read-only transport-/metadatacontrole](https://github.com/cluvonl/platform/actions/runs/37560581752), expliciet gestart met `verify_system_ca=false`, is geslaagd. Psql bevestigt TLS 1.3, maar servercertificaatverificatie is hiermee niet bewezen. Dit resultaat geeft geen vrijgave voor remote DDL.

Beide moderne Supabase-keytypes worden geaccepteerd. Email Auth staat aan en e-mailbevestiging is verplicht. Het stagingproject heeft nul Cluvo-tabellen en nul toegepaste Cluvo-migraties; vijftien gepubliceerde migraties zijn pending. Het `api`-schema is nog niet beschikbaar via REST.

De migratierol is geen eigenaar van `auth.sessions`, maar heeft via de geladen `supautils`-extensie de expliciete policy-grant. De metadata bevestigt ook de vereiste SELECT-grantbevoegdheden op `auth.sessions` en `auth.users`. Er is geen hosted policy of migratie uitgevoerd en geen Auth-eigenaarschap gewijzigd.

SendGrid accepteert sandboxmail met afzender `info@cluvo.nl`. Er is geen e-mail verstuurd. Native OTP-aflevering, login, afzenderverificatie, SMTP-inrichting, remote backup/restore en negatieve staging-RLS-/privacyproeven blijven afzonderlijke bewijsstappen. Secrets en private providerbodies zijn niet geëxporteerd.

`core_dependencies_ready`, `app_deploy_ready`, `v1_ready` en `production_enabled` blijven false. De geteste VPS-patch is gepubliceerd in Git; de root-beheerde broker/compose/runtime zijn hiermee niet geïnstalleerd of aangepast. De officiële staging-CA en de geautoriseerde VPS-beheerroute zijn nog nodig om de aangesloten overgang af te ronden.
