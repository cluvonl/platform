# Overgang van het stagingprototype naar de aangesloten core

Deze patch bereidt de bestaande VPS-broker voor op appmodus. Zij wordt niet automatisch op de VPS geïnstalleerd door een repositorypush. De self-hosted deployrunner blijft uitsluitend de vaste sudo-broker met image-digest, bron-SHA en run-ID aanroepen. Hij krijgt geen Supabase- of mailcredentials.

De GitHub-credentials zijn ingesteld in Environment `staging`. De aparte hosted preflight controleert die credentials zonder databasewijzigingen of mailaflevering. Het bedoelde project is `fbozlbgmktkgcdfqdaaz`, origin `https://staging.cluvo.nl`, afzender `info@cluvo.nl`. Een afzenderadres is niet automatisch een lijst van geautoriseerde testontvangers.

## Voorwaarden vóór activeren

De preflight moet de clientverbinding en keybruikbaarheid aantonen. Bouw vervolgens de geordende remote-migratieroute met een herstelbare private backup, een proefrestore en doel-/migratiehistorycontrole voor de exacte release. Sluit certificaat- en hostnameverificatie aan voor remote DDL. De actuele gedeelde migraties blijven onveranderd; voer geen reset of achteraf herschreven migratie uit.

Expose alleen de bedoelde `api`-schema in de staging Data API; `app` en `internal` blijven privé. Lees de toegepaste migratiestatus, forced RLS, beperkte function-owners, Native session-guards en negatieve privacyproeven op staging terug. De bestaande [compatibiliteitsgrens](../docs/release/database-compatibility.md) blijft gelden: voor een aangesloten app minimaal `9d9c365261b28ef99ef1a8345c21ae9e818ed6a1`. De huidige hosted credentialcheck implementeert de remote-migratie-/restorestappen nog niet.

Voor Auth-OTP horen SendGrid SMTP, de geverifieerde afzender, Site URL en toegestane redirects in het Supabase-project. Test echte aflevering en Native login afzonderlijk. SendGrid sandboxvalidatie bewijst die aflevering niet. De transactionele worker is nog niet aangesloten; `MAIL_DRIVER=log` blijft eerlijk als ontwikkeladapter aangeduid.

## Installatie via de geautoriseerde VPS-beheerroute

Gebruik de exacte gereviewde Git-versies van `ops/cluvo-deploy-staging` en `ops/compose.staging.yml`. Voer installatie uit via serverbeheer, met de bestaande deploy-lock `/var/lib/cluvo-staging/deploy.lock` gehouden zodat geen brokerdeployment tussen de configuratiestappen kan lopen. Maak eerst een root-only backup van de bestaande broker, compose, targetconfig en runtimeconfig in een directory met mode `0700`; runtimebackups blijven privé op de server en komen niet in GitHub-artifacts of chat.

Installeer de broker op `/usr/local/sbin/cluvo-deploy-staging` als root-owned executable, mode `0755`. Installeer compose op `/etc/cluvo/compose.staging.yml`, root-owned en zonder schrijfbevoegdheid voor de runner/runtime. De bestaande beperkte sudo-regel blijft staan. Behoud rootless Docker, de runtimegebruiker, loopback `127.0.0.1:3100`, state/locks, GHCR pull-login, reverseproxy/TLS en noindex. Gebruik geen checkout of build op de deployrunner.

De nieuwe broker werkt met de bestaande prototypeconfig: een ontbrekende `app_mode` in het root-owned target betekent nog steeds `prototype`. De nieuwe compose krijgt de gecontroleerde modus via `CLUVO_APP_MODE` van de broker. Vervang nooit het actuele targetbestand door de voorbeeldfile met placeholders. Lees na installatie eerst een prototypepromotie terug voordat appmodus wordt geactiveerd.

Het transport van secrets uit GitHub naar het vaste VPS-runtimebestand moet via de geautoriseerde beheerroute worden aangesloten. De huidige workflow levert alleen image/SHA/run-ID; het vullen van GitHub-secrets maakt `/etc/cluvo/staging.env` niet automatisch gevuld. Geef geen plaintext Supabase-credentials aan de self-hosted runner en introduceer geen brede SSH-deploysleutel als vervanging van de broker.

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

Als de nieuwe app faalt, herstelt de broker de vorige immutable image en de eerder geregistreerde modus. Ook dat herstel wordt via health gecontroleerd; onbevestigd herstel meldt operatoractie. De mislukte deployment blijft mislukt. Een approllback herstelt geen database, credentials, provider-event of verzonden mail.

Zeven gerichte tests voeren de echte Python-validatiefragmenten en het herstelpad uit met wegwerpbestanden en gesimuleerde healthresponses. Ze bewijzen target/mode/key-/allowlistweigering, run-order, expliciete rollbackcompatibiliteit, beperkte readiness en herstel van de vorige modus. Bash-syntax is gecontroleerd. VPS-installatie, socket-/bestandseigenaarschap, echte database-/Auth-/provider-readback en herstel op staging blijven afzonderlijk bewijs vereisen.
