# Hosted credentialcontrole — 7 oktober 2026

De [daadwerkelijke hosted preflight](https://github.com/cluvonl/platform/actions/runs/37558442471) op bron-SHA `aea29261335876672a6c9aac96f6b648fccbb12e` is geslaagd. Het artifact is ongewijzigd overgenomen.

Beide moderne Supabase-keytypes worden geaccepteerd. Email Auth staat aan en e-mailbevestiging is verplicht. De PostgreSQL-credential werkt voor hetzelfde vastgezette stagingproject via de session pooler; psql bevestigt TLS 1.3 op de clientverbinding. De verbinding achter de pooler is afzonderlijk gemeten als niet-TLS. Dat was de oorzaak van de onjuiste eerste check. Certificaat- en hostnameverificatie is nog niet aangesloten en wordt niet als bewezen gemeld.

Het app-schema is leeg: nul applicatietabellen en nul toegepaste migraties; alle vijftien gepubliceerde migraties zijn nog pending. De API-schema is nog niet beschikbaar via REST. Er is geen databasewijziging uitgevoerd en er zijn geen Auth-gebruikers of echte ledengegevens uitgelezen.

SendGrid accepteert de sandboxaanvraag met `info@cluvo.nl`. Er is geen e-mail verstuurd. Afzenderverificatie, SMTP-inrichting en echte OTP-aflevering/Native login zijn afzonderlijke bewijsstappen. De run exporteert geen secretwaarden, connectionstring of private providerbody.

`core_dependencies_ready`, `app_deploy_ready`, `v1_ready` en `production_enabled` zijn false. De [VPS-readback van dezelfde release](../20261007-aea2926/readback.json) bewijst nog prototype-modus zonder runtime-Supabaseconfig. Backup/restore, schema-upgrade, serverconfigoverdracht, negatieve RLS/privacyproeven en volledige acceptatie blijven open.
