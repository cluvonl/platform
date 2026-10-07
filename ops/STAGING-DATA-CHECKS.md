# Alleen-lezen stagingdata- en configuratiecontrole

De bestaande handmatige stagingpreflight gebruikt de officiële hashgecontroleerde CA-bundle, `verify-full`, targetpinning en een expliciete read-only libpq-omgeving. Naast verbindingen en keys leest zij een beperkte datasetinventaris en API-configuratiemetadata. Er is geen remote migratie-/restoredriver aan deze controles verbonden.

## Wat de inventaris meet

`scripts/staging-data-inventory.mjs` leest eerst de catalogus, datatypes, COUNT-rechten, huidige RLS-zichtbaarheid en aanwezigheid van pgsodium-securitylabels. Daarna selecteert zij alleen COUNT-aggregaten van vooraf bepaalde velden. Ontbrekende optionele tabellen gelden pas als afwezig na complete catalogusmetadata. Onvoldoende rechten, mogelijke RLS-filtering, gewijzigde types, onbekende cryptografische kolommen, onverwachte TCE-contracten of onbekende Auth-formaten geven `UNKNOWN`.

| Dataset | Gemeten gegevens | Sleutelfamilie |
|---|---|---|
| Vault | Rijen in `vault.secrets`; de decrypted view wordt niet gelezen | Beheerde Vault/pgsodium-root |
| pgsodium | Niet-null `raw_key`; definitierijen worden afzonderlijk geteld | Beheerde Vault/pgsodium-root |
| Auth | Bekende envelopes in password, MFA-factor, MFA-challenge, session-HMAC en custom-OAuth-secretvelden | Afzonderlijke Auth database-encryptie |
| OAuth | Clienthash en twee private flow-state-tokenvelden, alleen counters | Geen bewijs van root-encryptie |
| Storage | Objectmetadata, alleen aantal | Positieve count vraagt ook herstel van de bestanden |

De primaire [Vault-documentatie](https://supabase.com/docs/guides/database/vault) en [logische restoreprocedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) bevestigen dat een dump de beheerde rootkey niet bevat. Auth gebruikt een afzonderlijk contract: de [gepinde crypto-implementatie](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/crypto/crypto.go#L55) serialiseert cipherdata en nonce als standaard-base64 in JSON. De [session-HMAC-code](https://github.com/supabase/auth/blob/ce9a8eee0cc042be8c7a42981a7ddae631e41d91/internal/models/refresh_token.go#L151) genereert een legacyvorm van 32 bytes in ongepadde base64url. Bekende bcrypt/Argon2-hashes en andere gecontroleerde legacyvormen worden apart van envelopes geteld. Een onbekende waarde wordt nooit teruggegeven of als leeg aangemerkt.

`proven_empty` betreft uitsluitend de zeven bekende key-afhankelijke datasets in deze twee sleutelfamilies. De daadwerkelijke hosted Auth-versie wordt als beperkte semver uit de [officiële healthroute](https://supabase.com/docs/guides/troubleshooting/how-do-i-check-gotrueapi-version-of-a-supabase-project-lQAnOR) gelezen. Die versie is geen attestatie van de exacte broncommit of een compleet providerprofiel. De inventaris geeft daarom expliciet `full_schema_decryptability_verified=false`, `hosted_auth_binary_version_verified=false` en `count_snapshot_consistent=false`. De afzonderlijke queries delen nog geen exportedsnapshot. Een volledige dump-/restore-adapter moet haar eigen complete, consistente inventaris en noodzakelijke sleutel-/bestandsherstelroute bewijzen.

## API-configuratiemetadata

`scripts/staging-api-config-metadata.sql` selecteert uitsluitend booleans over providerrol-/configbevoegdheid, aanwezigheid van een authenticator-schema-override en API-schema-USAGE. `scripts/staging-api-config-metadata.mjs` exporteert alleen die vaste booleanvelden. Geen volledige GUC-, rolconfig- of providerbody wordt opgeslagen.

Supabase ondersteunt een gerichte [authenticator-override](https://supabase.com/docs/guides/troubleshooting/pgrst106-the-schema-must-be-one-of-the-following-error-when-querying-an-exposed-schema), maar die neemt het exposed-schema-beheer van Dashboard over. De [Supautils-rolhook](https://github.com/supabase/supautils/blob/df32bd65e4d13212bf812ee966a51132d034bc17/src/roles.c#L133) gebruikt eigen privileged-role-, reserved-role- en configallowlistvoorwaarden. De bestaande Native policy-grant bewijst deze bevoegdheid niet. Positieve metadata is een inference uit de providerbron; `ddl_executed=false` en `actual_config_change_verified=false` blijven staan.

Expose `api` pas na de geordende migraties en daadwerkelijke ACL-/privacyreadback. Bewaar de gecontroleerde bestaande schemalijst. Voeg `app`, `internal`, `auth` of `storage` niet toe. Wijzig geen providerrolmembership, Auth-owner of beschermende Supautils-config om ontbrekende bevoegdheid te omzeilen. Een ontbrekende role-override bewijst niet welke lijst de externe providerconfig gebruikt. De gewone Dashboard-/Management API-route blijft beschikbaar via geautoriseerd beheer; een projectserverkey is geen beheertoken.

## Bewijs en vrijgavegrens

De Node-tests controleren onder meer unknown-datasets, RLS-filtering, TCE op een al bekend hashveld, privé-errorredactie, nullable/afwijkende counters en vaste booleanexport. De PostgreSQL-formatcheck voert de gegenereerde COUNT-SQL uit op synthetische VALUES binnen read-only transacties. Zo worden echte JSON-/base64-/legacyvormen beoordeeld zonder Auth- of app-rijen te schrijven. Beide bestaande CI- en staging-databasejobs herhalen deze formatcheck.

De subprocesshelper is asynchroon, begrenst bytes en tijd, verwerkt UTF-8 na complete buffering en wacht normaal op gesloten stdio. Bij een overschreden deadline eindigt de poging ook wanneer een descendant een pipe openhoudt. De caller reduceert alle private diagnostiek tot vaste foutcodes. Wachtwoord en URL komen niet in argv; de deployrunner ontvangt geen databasecredential.

De lokale query-, format- en Node-proeven en de daadwerkelijke hosted metadata worden afzonderlijk vastgelegd. Zij sluiten geen backup/restore, remote DDL, Native staginglogin, mailaflevering, functionele appkoppeling of volledige V1 af. De zestien gepubliceerde migraties blijven ongewijzigd; productie blijft geblokkeerd.
