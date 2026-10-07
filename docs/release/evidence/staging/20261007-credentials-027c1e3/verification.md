# Hosted credentialcontrole — 7 oktober 2026

De [daadwerkelijk uitgevoerde preflight](https://github.com/cluvonl/platform/actions/runs/37557451328) op bron-SHA `027c1e386d9eea2d91bf367a2fbb34a09bb44d8d` accepteert de Supabase publishable key en serverkey. Email Auth staat aan en e-mailbevestiging is verplicht. De API-schema is nog niet toegankelijk. SendGrid accepteert de Mail Send-sandboxaanvraag met `info@cluvo.nl`; er is geen e-mail verstuurd.

De run faalt bij `DATABASE_TLS_REQUIRED`: de metadataquery heeft `pg_stat_ssl` van de database-backend gemeten. Dat bewijst niet wat de clientverbinding doet wanneer een tussenliggende pooler TLS beëindigt. De vervolgaanpassing meet de clientverbinding met psql `\conninfo`, vereist TLS 1.2 of 1.3 en rapporteert backend-TLS afzonderlijk. Een nieuwe run moet die correctie daadwerkelijk teruglezen. Deze mislukte eerste meting blijft als historisch bewijs behouden; er is geen reden bewezen om het databasewachtwoord te wijzigen.

Het bijgevoegde artifact is ongewijzigd overgenomen uit de run. Het bevat geen sleutelwaarden, connectionstring, private providerbody, Auth-gebruiker of inlogcode. Alleen read-only databasemetadata en sandboxmail zijn uitgevoerd. Remote migraties, SMTP-aflevering, Native login, VPS-configuratie en volledige V1-acceptatie blijven open.
