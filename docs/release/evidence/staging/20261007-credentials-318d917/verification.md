# Stagingcredentials — volledig geverifieerde TLS op 318d917

De [hosted stagingpreflight van 7 oktober 2026](https://github.com/cluvonl/platform/actions/runs/37584421729) is geslaagd op de exacte bron-SHA `318d91774cdf022dfaa8e59550b5f33895cfedfc`. De standaardinput `verify_system_ca=true` gebruikte de hashgecontroleerde openbare officiële Supabase-roots naast de beheerde Ubuntu-roots. Libpq verifieerde het servercertificaat en de hostname (`verify-full`) en mat TLS 1.3 naar de session pooler. Het aparte backendveld `database_backend_tls=false` beschrijft de verbinding achter die pooler.

Het [ongewijzigde veilige workflowartifact](preflight-results.json) bevestigt PostgreSQL 17.11, nul app-tabellen, nul toegepaste Cluvo-migraties en zestien verwachte migraties met consistente lege history. De geladen providerextensie verleent de vereiste Native session-policybevoegdheid; beide beperkte SELECT-grants zijn beschikbaar. Er is geen remote DDL uitgevoerd.

Beide Supabase-keytypes zijn geaccepteerd, de emailprovider is ingeschakeld en emailbevestiging is vereist. Het `api`-schema is nog niet toegankelijk via PostgREST. SendGrid accepteerde de sandboxvalidatie met `info@cluvo.nl` als afzender; geen email is verstuurd. SMTP-configuratie, afzenderverificatie, aflevering en een eigen Native staginglogin zijn niet bewezen.

Deze read-only controle maakt de databaseverbinding bruikbaar voor de volgende stap. Backup en herstelbewijs, geordende migratie, gecontroleerde API-exposure en VPS-runtimeoverdracht blijven vereist voor de functionele stagingkoppeling. Appvrijgave, V1-acceptatie en productie blijven false. Oudere falende of alleen transportcontrolerende captures blijven ongewijzigd.
