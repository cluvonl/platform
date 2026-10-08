# Overgang van het stagingprototype naar de aangesloten core

Deze patch bereidt de bestaande VPS-broker voor op appmodus. Zij wordt niet automatisch op de VPS geïnstalleerd door een repositorypush. De self-hosted deployrunner blijft uitsluitend de vaste sudo-broker met image-digest, bron-SHA en run-ID aanroepen. Hij krijgt geen Supabase- of mailcredentials.

De GitHub-credentials zijn ingesteld in Environment `staging`. De aparte hosted preflight controleert die credentials zonder databasewijzigingen of mailaflevering. Het bedoelde project is `fbozlbgmktkgcdfqdaaz`, origin `https://staging.cluvo.nl`, afzender `info@cluvo.nl`. Een afzenderadres is niet automatisch een lijst van geautoriseerde testontvangers.

## Voorwaarden vóór activeren

De preflight moet de clientverbinding en keybruikbaarheid aantonen. Bouw vervolgens de geordende remote-migratieroute met een herstelbare private backup, een proefrestore en doel-/migratiehistorycontrole voor de exacte release. Sluit certificaat- en hostnameverificatie aan voor remote DDL. De actuele gedeelde migraties blijven onveranderd; voer geen reset of achteraf herschreven migratie uit.

Expose alleen de bedoelde `api`-schema in de staging Data API; `app` en `internal` blijven privé. Lees de toegepaste migratiestatus, forced RLS, beperkte function-owners, Native session-guards en negatieve privacyproeven op staging terug. De bestaande [compatibiliteitsgrens](../docs/release/database-compatibility.md) blijft gelden: voor een aangesloten app minimaal `9d9c365261b28ef99ef1a8345c21ae9e818ed6a1`. De huidige hosted credentialcheck implementeert de remote-migratie-/restorestappen nog niet. De [snapshotcollector](STAGING-PERSISTENT-SESSION.md#snapshotcollector-voor-de-omzetting-naar-appmodus) voert de consistente private meting en verse driftcontrole uit; zij maakt nog geen backup en autoriseert geen DDL.

Voor Auth-OTP horen SendGrid SMTP, de geverifieerde afzender, Site URL en toegestane redirects in het Supabase-project. Test echte aflevering en Native login afzonderlijk. SendGrid sandboxvalidatie bewijst die aflevering niet. De transactionele worker is nog niet aangesloten; `MAIL_DRIVER=log` blijft eerlijk als ontwikkeladapter aangeduid.

## Installatie via de geautoriseerde VPS-beheerroute

Gebruik de exacte gereviewde Git-versies van `ops/cluvo-deploy-staging` en `ops/compose.staging.yml`. Voer installatie uit via serverbeheer, met de bestaande deploy-lock `/var/lib/cluvo-staging/deploy.lock` gehouden zodat geen brokerdeployment tussen de configuratiestappen kan lopen. Maak eerst een root-only backup van de bestaande broker, compose, targetconfig en runtimeconfig in een directory met mode `0700`; runtimebackups blijven privé op de server en komen niet in GitHub-artifacts of chat.

Installeer de broker op `/usr/local/sbin/cluvo-deploy-staging` als root-owned executable, mode `0755`. Installeer compose op `/etc/cluvo/compose.staging.yml`, root-owned en zonder schrijfbevoegdheid voor de runner/runtime. De bestaande beperkte sudo-regel blijft staan. Behoud rootless Docker, de runtimegebruiker, loopback `127.0.0.1:3100`, state/locks, GHCR pull-login, reverseproxy/TLS en noindex. Gebruik geen checkout of build op de deployrunner.

De nieuwe broker werkt met de bestaande prototypeconfig: een ontbrekende `app_mode` in het root-owned target betekent nog steeds `prototype`. De nieuwe compose krijgt de gecontroleerde modus via `CLUVO_APP_MODE` van de broker. Vervang nooit het actuele targetbestand door de voorbeeldfile met placeholders. Lees na installatie eerst een prototypepromotie terug voordat appmodus wordt geactiveerd.

Een nieuwe deployment in prototype-modus wordt geweigerd zolang de runtime een Supabase publishable key of serverkey bevat. Alleen de mode wijzigen sluit de afzonderlijke Auth-/app-routes niet af. De broker verwijdert geen credentials; een bewust losgekoppeld prototype vereist afzonderlijk gecontroleerde runtimeconfig. Een URL zonder keys blijft als voorbereid, losgekoppeld prototype toegestaan.

De bestaande self-hosted runner is de geautoriseerde VPS-deployroute. De huidige workflow levert alleen image/SHA/run-ID; het vullen van GitHub-secrets maakt `/etc/cluvo/staging.env` niet automatisch gevuld. De [uitgevoerde runnercontrole](../docs/release/evidence/staging/20261008-runner-83328b0/verification.json) heeft de oorspronkelijke prototypebroker werkelijk aangetroffen. `staging-runner-capabilities.yml` controleert de daadwerkelijk geïnstalleerde broker en sudo-rechten voordat aanvullende toegang wordt gevraagd. Deze handmatige meting gebruikt geen checkout of secrets, voert geen geprivilegieerde opdracht uit en rapporteert alleen vaste booleans en hashes van publieke broker-/composebron. Een meting vanaf main is uitsluitend een alleen-lezen stagingcontrole, geen imagepromotie.

Sluit configuratie-import aan als een beperkte serveroperatie via dezelfde runner. Als die operatie nog niet bestaat en de runner uitsluitend de deploybroker mag uitvoeren, is een eenmalige installatie via bestaande root-provisioning nodig. Vraag dan alleen naar die concrete mogelijkheid; introduceer geen brede SSH-deploysleutel of algemene sudo-regel. Runtimecredentials blijven privé op de server.

`ops/install-staging-app-broker` voert die eenmalige installatie uit. De gebruiker heeft gekozen deze stap zelf in de VPS-console uit te voeren. De installer controleert een publiek, aan de exacte bron-SHA en SHA256-hashes gebonden pakket, installeert alleen broker/compose/importer en één beperkte sudoersregel, en bewaart runtime/target ongewijzigd. Hij leidt uitsluitend een eenduidige bestaande runneraccount uit de brokerregel af; ambiguïteit vereist een expliciete accountnaam. Lokale root-only herstelkopieën blijven onder `/var/lib/cluvo-staging/provision-backups`, zonder nieuw backupaccount of externe opslag. De installer activeert geen app en voert geen migratie uit.

`staging-configure-app.yml` sluit daarna de bestaande GitHub-stagingsecrets aan via de vertrouwde, uitsluitend voor Cluvo gebruikte runner op dezelfde VPS. Zij reizen kort via serverprocessen en een besloten stdin-pipe naar de vaste `cluvo-import-staging-config`; geen plaintextbestand, artifact of credentialargument. Dit is een bewuste vereenvoudiging van de eerdere technische keuze dat ook de runner geen plaintext mocht verwerken. De gebruikersregel blijft server-only. De importer weigert onbekende velden, ander project/origin, ontbrekende rollbackcompatibiliteit, gewijzigde bron/versie en conflicterende retries. Actor, vaste stagingscope, verwachte versie en idempotencykey komen in een privé serveraudit. Runtime/target/audit worden onder de deploylock geschreven met een hersteljournal. De deploybroker weigert een nog aanwezig journal tot de import is herhaald/hersteld.

De handmatige configuratieworkflow weigert import vóór de zestien oorspronkelijke migraties, 144 forced-RLS-/Native-guardtabellen, beperkte command-owner en bereikbare `api`-schema zijn teruggelezen met certificaat-/hostnameverificatie. Zij voert geen DDL of mailverzending uit. De gewone stagingworkflow voert daarna de deployment uit. Configuratie-import alleen bewijst geen appactivering, echte login of V1-acceptatie. `MAIL_DRIVER` en overige bestaande velden blijven behouden; de nog niet aangesloten transactionele mailworker en uitnodigingsaflevering worden hiermee niet als werkend geregistreerd. Native Auth gebruikt de al ingestelde Supabase-SMTP.

De gebruiker heeft op 8 oktober expliciet toegestaan het prototype te vervangen. Een nieuw extern backupaccount en de specifieke sleutelnaam `STAGING_BACKUP_ENCRYPTION_KEY` zijn geen voorwaarden voor die appvervanging. De afzonderlijke backupbestemming/retentie uit het deploymentdocument zijn technische voorstellen, geen canonieke vereisten. Behoud bestaande Supabase-providerstate en pas de oorspronkelijke migraties geordend toe; vervangbaarheid van het prototype autoriseert geen hosted databasereset. Herstelbewijs blijft een V1-acceptatiecriterium en mag niet als reeds uitgevoerd worden geregistreerd.

## Vastgezette appconfig

Werk het bestaande root-owned `/etc/cluvo/staging-target.json` gezamenlijk met de runtimeconfig bij. Behoud de bestaande imagerepository en origin. De extra velden zijn:

```json
{
  "app_mode": "app",
  "supabase_project_ref": "fbozlbgmktkgcdfqdaaz",
  "supabase_url": "https://fbozlbgmktkgcdfqdaaz.supabase.co",
  "compatible_rollback_shas": []
}
```

`compatible_rollback_shas` bevat uitsluitend expliciet geteste, met het reeds toegepaste schema compatibele vorige appreleases. De bron-SHA van de vorige release moet in de lijst staan; een willekeurige of lege lijst laat zo'n deployment niet starten. Dat geldt ook voor een eerder als prototype gebruikte image: de eerdere modus herstellen draait runtimecredentials of de database niet terug, en de image kan ook afzonderlijke Auth-/app-routes bevatten.

Het vaste `/etc/cluvo/staging.env` bevat voor appmodus:

| Configuratie | Vereiste |
|---|---|
| `APP_ENV` | `staging`; `production` wordt geweigerd. |
| `APP_MODE` | `app`, gelijk aan het root-owned target. |
| `APP_URL` | Exact de vaste HTTPS-origin van staging. |
| `SUPABASE_URL` | Exact de URL van het vastgezette stagingproject. |
| `SUPABASE_PUBLISHABLE_KEY` | De gecontroleerde moderne publishable key. |
| `SUPABASE_SECRET_KEY` | De gecontroleerde moderne serverkey, uitsluitend serverruntime. |
| `INVITATION_TOKEN_SECRET` | Het apart aangemaakte geheim van minimaal 32 bytes. |
| `MAIL_ALLOWLIST` | Expliciete goedgekeurde testontvangers; geen wildcard of echte ledenlijst. |
| `MAIL_DRIVER` | Een werkelijk aangesloten adapter; `log` levert geen e-mail af. |

Bewaar de runtimefile root-owned, alleen leesbaar voor de noodzakelijke runtimegroep, bijvoorbeeld mode `0640` met groep `cluvo-staging`. Geef de runner geen lees- of schrijfrecht. Voeg geen `MIGRATION_DATABASE_URL` of backupcredential toe aan de browser/appcontainer. `RELEASE_SHA` wordt per deployment door de broker gezet; het is geen secret.

## Teruglezen en herstellen

Appmodus vereist exacte liveness-SHA/mode/environment én readiness van de beperkte `authenticated_core`: database bereikbaar, autorisatie `rls_api`, `release_ready=false`. De broker registreert de werkelijke modus en databasebereikbaarheid, maar blijft `database_migrated=false` en `v1_ready=false` vastleggen; een healthresponse bewijst geen migratie- of V1-acceptatie.

Als de nieuwe app faalt, herstelt de broker de expliciet compatibele vorige immutable image in appmodus: de nieuwe runtimecredentials blijven aanwezig en vereisen appautorisatie. Ook het herstel controleert liveness en appreadiness en legt de werkelijk herstelde modus atomisch vast; onbevestigd herstel meldt operatoractie. De mislukte deployment blijft mislukt. Een approllback herstelt geen database, credentials, provider-event of verzonden mail.

Tien gerichte brokertests voeren de echte Python-validatiefragmenten en het herstelpad uit met wegwerpbestanden en gesimuleerde healthresponses. Ze bewijzen target/mode/key-/allowlistweigering, een prototype-aanvraag met aangesloten credentials, run-order, expliciete rollbackcompatibiliteit, beperkte readiness, journalweigering en atomisch vastgelegde appmodus na herstel van de vorige compatibele image. Bash-syntax is gecontroleerd. De importer heeft daarnaast negentien gerichte filesystem-/procesproeven, inclusief onderbrekingen tijdens schrijven, herstel en cleanup. VPS-installatie, socket-/bestandseigenaarschap, echte database-/Auth-/provider-readback en herstel op staging blijven afzonderlijk bewijs vereisen.
