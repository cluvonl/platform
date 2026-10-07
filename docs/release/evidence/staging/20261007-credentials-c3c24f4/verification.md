# Staging — vijf configuratiecontroles op c3c24f4

Bron `c3c24f41ee9d6e3a2d4b21b0f843cabb7b9b2d37`. De [handmatige hosted preflight](https://github.com/cluvonl/platform/actions/runs/37603823535) is werkelijk geslaagd. Het ongewijzigde veilige [rapport](strong-preflight-results.json), waargenomen op `2026-10-07T09:54:52.913Z`, heeft SHA256 `5d27ae83099e87fe801a989699e901d75d8ac7cab26772533ca8c5d462f93fcb`.

Alle vijf checks slagen: gateway/Auth, database, SendGrid sandbox, beperkte datasetinventaris en API-configuratiemetadata. De databaseclient gebruikt TLS 1.3 met gecontroleerd servercertificaat en hostname; backendmetadata achter de pooler staat afzonderlijk. Nul app-tabellen en nul toegepaste van zestien verwachte migraties; het API-schema is niet beschikbaar. De bekende zeven keyafhankelijke datasets zijn leeg volgens de beperkte inventaris, geen volledige providerinventaris of gezamenlijke backupsnapshot.

Geen accounts, migraties of echte e-mails aangemaakt. Sandboxvalidatie bewijst geen afzenderauthenticatie of aflevering. Operationele backup/restore, Native login, remote RLS/privacy en aangesloten app-runtime zijn niet bewezen. De [aanvullende rechtenmeting](../20261007-backup-capabilities-c3c24f4/capability-results.json) is een aparte read-only waarneming. V1 en productie blijven false.
