# Staging — vijf configuratiecontroles op 1d56c62

Bron: `1d56c628969249c2a0b8e0dd7967a42dc9044dae`. De [handmatige hosted controle](https://github.com/cluvonl/platform/actions/runs/37601863046) is werkelijk geslaagd. Het ongewijzigde veilige [rapport](strong-preflight-results.json), waargenomen op `2026-10-07T09:37:24.606Z`, heeft SHA256 `31d3007620cc45f2b818e848cae3e42de0bbf2c195d913a8f23456d5447617b6`.

Alle vijf checks slagen: gateway/Auth, database, SendGrid sandbox, beperkte datasetinventaris en API-configuratiemetadata. De databaseclient gebruikt TLS 1.3 met gecontroleerd servercertificaat en hostname. De pooler-backendmetadata staat afzonderlijk. De Cluvo-database blijft leeg: nul toegepaste van zestien verwachte migraties. Het API-schema is nog niet beschikbaar.

Dit is uitsluitend een configuratie- en metadatawaarneming. Er zijn geen accounts, migraties of echte e-mails aangemaakt. De sandbox bewijst geen afzenderauthenticatie of aflevering. Backup/restore, daadwerkelijke Native login, remote RLS/privacy en aangesloten app-runtime zijn niet bewezen. V1 en productie blijven false.
