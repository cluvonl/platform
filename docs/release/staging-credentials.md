# Stagingcredentials — inrichting op 7 oktober 2026

GitHub Environment `staging` bestaat. De gebruiker heeft op 7 oktober bevestigd dat de credentials zijn ingesteld en `info@cluvo.nl` als afzender opgegeven. De aanwezigheid van alle vier de hieronder genoemde secretnamen en de twee Supabase-variables is teruggelezen. De secretwaarden zijn niet uitgelezen. `INVITATION_TOKEN_SECRET` is vooraf veilig aangemaakt: 32 cryptografisch willekeurige bytes, gecodeerd als 64 hextekens; de waarde is niet weergegeven, lokaal opgeslagen of opgenomen in Git.

Daarna zijn de ontbrekende niet-geheime variables `STAGING_SUPABASE_PROJECT_REF` en `SENDGRID_FROM_EMAIL` ingesteld. De projectref is afgeleid uit de door de gebruiker ingestelde project-URL: `fbozlbgmktkgcdfqdaaz`. De afzender is `info@cluvo.nl`.

Open [GitHub Environments van cluvonl/platform](https://github.com/cluvonl/platform/settings/environments) en selecteer `staging`. Gebruik uitsluitend het aparte Supabase-stagingproject en de afgesproken testontvangers.

## Secrets in het environment

| Naam | Waarde en herkomst | Gebruik en huidige status |
|---|---|---|
| `INVITATION_TOKEN_SECRET` | Reeds veilig aangemaakt; geen vervanging nodig | Apart geheim voor uitnodigingstokens. De huidige workflow draagt dit nog niet over aan de VPS. |
| `SUPABASE_SECRET_KEY` | Serverkey van het stagingproject, met prefix `sb_secret_` | Naam aanwezig; geldigheid wordt vanuit de hosted preflight gecontroleerd. Uitsluitend serverruntime; niet in browser, Docker-build of artifact. |
| `MIGRATION_DATABASE_URL` | TLS-databaseconnectionstring van staging, inclusief correct URL-gecodeerde databasecredential | Naam aanwezig. De hosted preflight leest uitsluitend metadata; een geordende remote-migratieroute moet nog worden aangesloten. |
| `SENDGRID_API_KEY` | SendGrid-key met de benodigde Mail Send-bevoegdheid | Naam aanwezig. De hosted preflight gebruikt alleen sandboxvalidatie. Voor Auth-OTP hoort de key als SMTP-wachtwoord in het Supabase-stagingproject. De app heeft nog geen transactionele SendGrid-worker. |

Een legacy `service_role`-JWT vervangt de moderne `SUPABASE_SECRET_KEY` niet: de huidige runtime valideert het moderne keytype. Een serverkey is ook geen databasewachtwoord. De gekozen directe database-URL-route vraagt geen extra Supabase Management API-token; een eventuele geautomatiseerde wijziging van Auth-instellingen via de Management API zou een afzonderlijke toegang vereisen.

## Variables en overige configuratie

| Naam of gegeven | Plaats | Betekenis |
|---|---|---|
| `SUPABASE_URL` | Environmentvariable `staging`, later gecontroleerde VPS-runtime | Ingesteld; project-URL is gebonden aan de expliciete stagingprojectref. |
| `SUPABASE_PUBLISHABLE_KEY` | Environmentvariable `staging`, later VPS-runtime en publieke runtimeconfig | Ingesteld. Dit is een publiceerbare sleutel; de hosted preflight controleert of de gateway deze accepteert. |
| `STAGING_SUPABASE_PROJECT_REF` | Environmentvariable `staging` | Ingesteld; de preflight weigert een afwijkende URL, databasehost of pooler-gebruikersnaam. |
| `SENDGRID_FROM_EMAIL` | Environmentvariable `staging` | Ingesteld op `info@cluvo.nl`. Sandboxvalidatie bewijst nog geen afzenderverificatie of aflevering. |
| Auth SMTP-config, afzendernaam, Site URL en redirects | Supabase Auth-dashboard | Gebruiker meldt de inrichting voltooid; echte OTP-aflevering en login moeten nog worden teruggelezen. Geen productieaccount aanmaken. |
| `MAIL_ALLOWLIST` | Gecontroleerde server/workerconfig | Alleen afgesproken testontvangers; geen echte ledengegevens gebruiken. |

Voor SendGrid SMTP gebruikt Supabase Auth `smtp.sendgrid.net`, poort `587`, gebruikersnaam `apikey` en de SendGrid API-key als wachtwoord. Stel de geverifieerde afzender in en configureer de Auth Site URL en toegestane redirects voor `https://staging.cluvo.nl`. Bewaar geheime waarden via de beheerinterfaces; deel ze niet in chat of overdrachtsdocumenten. Zie [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase API-keys](https://supabase.com/docs/guides/getting-started/api-keys) en [SendGrid SMTP](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/integrating-with-the-smtp-api).

## Hosted configuratiecontrole

`.github/workflows/staging-preflight.yml` is een handmatig startbare controle, uitsluitend voor `cluvonl/platform` op de branch `staging`, met GitHub Environment `staging` en een hosted Ubuntu-runner. De deployrunner ontvangt geen credentials. Het script `scripts/staging-preflight.mjs` gebruikt geen nieuwe dependencies.

De controle doet drie onafhankelijke controles: Supabase gateway/Auth-instellingen met beide keytypes; PostgreSQL-connectiviteit en metadata met een aan hetzelfde project gebonden directe verbinding of session pooler; SendGrid Mail Send in sandboxmodus. PostgreSQL krijgt alleen SELECT-queries en expliciet `default_transaction_read_only=on`. Wachtwoord en URL komen niet in procesargumenten; psql-diagnostiek en providerbodies komen niet in logs of artifacts. Redirects voor HTTPS-verzoeken zijn uitgeschakeld. Er worden geen accounts, migraties of berichten aangemaakt en geen e-mails verstuurd.

Het veilige artifact `staging-preflight.json` bevat uitsluitend status, counts en de bron-SHA. Een geslaagde check bewijst key-/connectionbruikbaarheid, geen V1-acceptatie, eigen Native login, afzenderverificatie of daadwerkelijke mailaflevering. `app_deploy_ready`, `v1_ready` en `production_enabled` blijven false. Een lege appdatabase wordt expliciet als nog te migreren gemeld; onbekende migratiehistory maakt de schema-afhankelijkheid ongeschikt.

TLS is minimaal verplicht. Een expliciete `sslmode=verify-full` wordt niet verlaagd; met een gecontroleerd CA-bestand via `MIGRATION_SSL_ROOT_CERT_PATH` gebruikt het script eveneens hostname- en certificaatverificatie. De workflow probeert standaard de beheerde CA-bundle van de Ubuntu-runner met `verify-full`; een afwijzing wordt niet automatisch omzeild. Voor een endpoint met een private Supabase-CA moet die CA via de geautoriseerde providerroute beschikbaar komen. De optionele input `verify_system_ca=false` geeft uitsluitend de eerdere transport-/metadatacontrole terug en geldt niet als toestemming voor remote DDL. Het report onderscheidt versleuteld transport van certificaatverificatie; bewijs die verificatie voordat een remote migratie wordt uitgevoerd. Zie [Supabase SSL-modi](https://supabase.com/docs/guides/platform/ssl-enforcement), [databaseverbindingen](https://supabase.com/docs/guides/database/connecting-to-postgres) en [SendGrid sandboxmodus](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode).

De negen gerichte Node-tests controleren onder meer productie/targetweigering vóór netwerkverkeer, onjuiste poolerprojecten, TLS-/libpq-overrides, een pooler die TLS beëindigt, private fouten, ontbrekende Mail Send-bevoegdheid, onbekende migraties en Native/RLS-schema-afhankelijkheden. TLS wordt gemeten via de clientverbinding van psql (`\conninfo`). `pg_stat_ssl` beschrijft de database-backend en wordt afzonderlijk gerapporteerd; een niet-versleutelde verbinding achter de pooler wordt niet verward met de externe clientverbinding.

De volgende preflight leest ook uitsluitend metadata over de bevoegdheid om de vereiste Native session-policy te installeren en de beperkte SELECT-grants op `auth.sessions` en `auth.users` te geven. Een werkende databasecredential bewijst deze DDL-bevoegdheid niet. Naast eigenaarschap telt de controle de geladen Supabase-extensie `supautils` en haar expliciete policy-grant voor `auth.sessions` mee. Supabase ondersteunt deze gerichte grant zonder wijziging van Auth-eigenaarschap; zie de [providerwijziging van 21 april 2025](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025) en [supautils policy-grants](https://github.com/supabase/supautils/blob/master/README.md#manage-policies). De eerdere controle op uitsluitend roleigenaarschap was onvoldoende om de DDL-bevoegdheid te bepalen. De gecorrigeerde bevoegdheidsvelden moeten nog op hosted staging worden gemeten. Wijzig geen Auth-eigenaarschap en verlaag de Native session-guards niet.

## Opslaan is nog geen werkende stagingkoppeling

De bestaande deployjob ontvangt uitsluitend image-digest, release-SHA en run-ID. De beperkte VPS-broker leest `/etc/cluvo/staging.env`; hij ontvangt nu geen Supabase- of mailcredentials uit GitHub. De daadwerkelijk gemeten VPS-runtime staat nog op `APP_MODE=prototype`. Het [readback van `aea2926`](evidence/staging/20261007-aea2926/readback.json) bewijst de exacte release: liveness is geslaagd, readiness meldt prototype en `/api/runtime-config` meldt `SUPABASE_NOT_CONFIGURED`.

De [gecorrigeerde hosted preflight](https://github.com/cluvonl/platform/actions/runs/37558442471) is geslaagd: beide Supabase-keytypes worden geaccepteerd, de databasecredential werkt via de session pooler met TLS 1.3 en SendGrid accepteert sandboxmail van `info@cluvo.nl`. Het app-schema is leeg: nul toegepaste Cluvo-migraties, vijftien verwachte migraties. Het `api`-schema is nog niet exposed. Certificaatverificatie, backup/restore, migratie, VPS-runtimeoverdracht en daadwerkelijke OTP-aflevering blijven open. Secrets worden niet opnieuw gevraagd omdat ze al zijn ingesteld en gecontroleerd.

De repository bevat de geteste broker-/composepatch en [concrete VPS-instructies](../../ops/STAGING-APP.md). De patch ondersteunt expliciet vastgezette appmodus, controleert beperkte core-readiness en herstelt de eerdere image én modus met health-readback bij een mislukte overgang. Installatie moet via de geautoriseerde beheerroute plaatsvinden; een repositorypush wijzigt de root-owned bestanden op de VPS niet.

Voor de overgang naar appmodus moet de geautoriseerde VPS-beheerroute worden aangesloten of een beperkte overdracht van runtimeconfig worden gebouwd en getest. Daarbij blijven de bestaande broker, rootless Docker, targetpinning en productieblokkades behouden. Vervolgens hoort de releasevolgorde databasebackup en herstelbewijs → gecontroleerde migratie → compatibel appimage → daadwerkelijke Auth/RPC/mail-readback op staging te omvatten. Het vullen van secrets activeert deze stappen niet vanzelf.

De lokale Supabase-sleutels en mailopvang bewijzen uitsluitend lokaal gedrag. Ze worden niet hergebruikt als stagingcredentials. Volledige V1-acceptatie, provideraflevering en productie blijven open. Het bestaande [secret- en stagingregister](../handover/2026-10-06/04_SECRETS_EN_STAGING.md) blijft van toepassing.
