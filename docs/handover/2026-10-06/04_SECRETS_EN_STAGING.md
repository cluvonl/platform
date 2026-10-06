# 04 — GitHub-secrets, runtime en stagingdeployment

## De bestaande route blijft staan

De actuele workflows en promotiescript zijn op 6 oktober uit de repository gelezen. `main` en remote `staging` wezen bij de inventarisatie beide naar `47386491859b47fbebf85c3b209724dcc20407fc`. Dat is bronbewijs van branchstanden en pipeline-inrichting, geen nieuwe meting van de actieve VPS-container.

| Stap | Bestaande uitvoering |
|---|---|
| Ontwikkelen op main | Push/PR voert `.github/workflows/ci.yml` uit: lint, typecheck, Node-tests, Next-build, WP0-check; apart lokaal Supabase/pgTAP, races/locks en database-lint. |
| Exact promoveren | `scripts/promote-staging.sh EXPLICIETE_SHA` verifieert succesvolle push-CI voor die SHA en ancestorrelatie met main. Push exact SHA naar `refs/heads/staging`, idempotent en zonder force/mergecommit. |
| Staging build | `.github/workflows/staging.yml` triggert op push staging. Host runner controleert de branch/SHA, voert opnieuw checks uit en bouwt/pusht het Docker-image naar GHCR. |
| Immutable release | Image label bewaart source-SHA; workflow geeft immutable digest en release-manifest door, artifactretentie 90 dagen. |
| VPS deploy | Environment `staging`; self-hosted label `[self-hosted, Linux, X64, cluvo-staging-deploy]`; alleen als repositoryvariabele `STAGING_DEPLOY_ENABLED=true`. |
| Broker | Runner voert uitsluitend beperkte sudo-opdracht `/usr/local/sbin/cluvo-deploy-staging IMAGE SHA RUN_ID` uit. Geen repositorycheckout, npm-build of Supabase-credential op deze deployrunner. |
| Runtime | Rootless Docker van `cluvo-staging`, image by digest, loopback `127.0.0.1:3100`, bestaande reverseproxy/TLS voor staging. |

De broncode wordt op main gecontroleerd. Het huidige stagingimage wordt daarna opnieuw uit exact dezelfde gepromoveerde SHA gebouwd; claim dus niet dat de pipeline nu al een op main gebouwd Dockerimage hergebruikt. Voor eventuele latere productiepromotie is hergebruik van goedgekeurd digest een afzonderlijk ontwerpbesluit buiten deze stagingopdracht.

## Wat je nu in GitHub nodig hebt

**De gecontroleerde bestaande workflow vraagt geen handmatig aangemaakt GitHub-secret.** `GITHUB_TOKEN` wordt automatisch per run beschikbaar gesteld. De workflow heeft `packages: write` voor GHCR-push. GitHub-configuratie die de build al gebruikt, hoeft niet opnieuw te worden uitgevonden.

| Naam | Soort en plek | Nodig wanneer | Wie gebruikt het? |
|---|---|---|---|
| `GITHUB_TOKEN` | Automatisch Actions-token; niet zelf als repositorysecret aanmaken | Reeds gebruikte checkout/fetch/GHCR-push | Hosted workflow, minimale bestaande permissions. |
| `STAGING_DEPLOY_ENABLED` | **Repository Actions-variable**, waarde `true`; geen secret | Reeds gebruikte gate voor VPS-deploy | Staging deployjob. |
| Environment `staging` | GitHub Environment, geen secretnaam | Reeds gebruikt door deployjob | Branch-/deploymentbeleid. Controleer actuele inrichting, niet opnieuw aanmaken als aanwezig. |
| `MIGRATION_DATABASE_URL` | **Nieuw/conditioneel Environment-secret `staging`** | Als nieuwe remote-stagingmigratiefase in Actions wordt gebouwd | Alleen aparte hosted migratiejob; bevat de juiste staging-DB-credential. Niet de deployrunner. |
| `STAGING_SUPABASE_PROJECT_REF` | Voorgestelde niet-geheime Environment/repo-variable | Als de migratiejob het target project daarmee vastzet | Projectguard naast bestaande URL/targetcheck. Dit is een voorstel, geen bestaande workflowdependency. |

`MIGRATION_DATABASE_URL` wordt nog niet gelezen door de huidige stagingworkflow voor een remote database; de `.env.example` reserveert de naam wel. De bestaande Supabase-job test alleen een lokale tijdelijke database. Voeg voor een echte app een geordende remote-stagingmigratieroute toe, of sluit een aantoonbaar reeds beheerde migratieroute aan. Documenteer welke eigenaar die route heeft. Zonder dat kan een image een schema verwachten dat op staging niet is toegepast.

Een directe DB-URL-route met Supabase CLI `db push --db-url` gebruikt de DB-credential in die URL en hoeft niet daarnaast een Supabase Management API-token te hebben. Als in plaats daarvan `supabase link`/Management API wordt gebruikt, is `SUPABASE_ACCESS_TOKEN` plus projectref en databasecredential een **alternatieve gekozen route**, niet een extra lijst die je altijd moet invullen. Verifieer de gepinde CLI-help, databasebereikbaarheid, TLS en correct URL-encoding; geen connectionstring in logs of release-manifest. Geef nooit `--debug` of shell tracing bij secrets.

GitHub Environment kan deploymentbranches en bescherming beperken; behoud de bestaande inrichting en sta alleen de beoogde `staging`-route toe. De actuele secretwaarden en dashboard-instellingen zijn in deze audit niet uitgelezen. Dit register is gebaseerd op daadwerkelijke codeverwijzingen, niet op de onbewezen aanname dat elk credential al is ingevuld.

## Wat op de staging-VPS hoort

De huidige broker leest `/etc/cluvo/staging.env`, compose `/etc/cluvo/compose.staging.yml` en rootbeheerd target `/etc/cluvo/staging-target.json`. Onderstaande runtime-namen staan daadwerkelijk in de repository of worden expliciet als adaptervoorstel aangemerkt.

| Naam | Geheim? | Status voor werkende app | Plaats en randvoorwaarde |
|---|---|---|---|
| `APP_ENV=staging` | Nee | Verplicht | VPS-runtime; productieguard blijft actief. |
| `APP_MODE=app` | Nee | Verplicht na gecontroleerde overgang | Nu broker/compose nog prototype; documenteer gezamenlijke wijziging. |
| `APP_URL` | Nee | Verplicht | HTTPS-origin van staging zonder extra pad, query of userinfo. Targetconfig moet exact overeenkomen. |
| `RELEASE_SHA` | Nee | Verplicht | Broker zet exacte release-SHA; gebruiker hoeft geen waarde als secret op te slaan. |
| `SUPABASE_URL` | Nee | Verplicht | Alleen het stagingproject; broker vergelijkt met vast target. |
| `SUPABASE_PUBLISHABLE_KEY` | Nee, publiceerbare sleutel | Verplicht | Huidige code verwacht prefix `sb_publishable_`; runtimeconfig aan client. Geen automatische noodzaak voor build-time `NEXT_PUBLIC_*`. |
| `SUPABASE_SECRET_KEY` | **Ja** | Verplicht voor huidige serverconfig | Huidige code verwacht `sb_secret_`; alleen server. Deze sleutel heeft brede toegang en komt nooit in client/bundel/export/log. |
| `INVITATION_TOKEN_SECRET` | **Ja** | Verplicht | Afzonderlijk sterk random geheim van minimaal 32 bytes, voor beperkte uitnodigingstokens; geen hergebruik van Supabase-sleutel. |
| `MAIL_DRIVER` | Nee | Driver moet eerlijk zijn | Nu `log` voor ontwikkeling; kies echte sandbox/provideradapter voor staging. `log` is geen afleverende mailroute. |
| `MAIL_ALLOWLIST` | Geen secret, wel persoonsgegevens | Verplicht voor gecontroleerde uitgaande stagingcommunicatie | Alleen expliciete testontvangers; worker handhaaft allowlist, ook bij jobs/imports. |
| `SPORTLINK_DRIVER` | Nee | `fixture` is een testadapter, geen liveverbinding | Echte adapter gebruikt contractueel beschikbare bron en bevoegd credentials. |
| `VAPID_PUBLIC_KEY` | Nee | Nodig voor echte Web Push indien aangesloten | Per omgeving/push-subscriptionconfig. |
| `VAPID_PRIVATE_KEY` | **Ja** | Nodig voor echte Web Push indien aangesloten | Alleen server/worker, niet in openbare runtimeconfig. |
| `BACKUP_DATABASE_URL` | **Ja** | Nodig voor gekozen backupjob | Backupbeheer, beperkt passende rol; geen appbrowser of bouwtoken. |

Het huidige browserclient ontvangt public Supabase-config per request vanuit de runtime. Introduceer geen extra buildsecrets om public URL/publishable key in een Dockerimage vast te bakken, tenzij een gecontroleerde architectuurwijziging dat expliciet rechtvaardigt.

## Andere credentials, uitsluitend na adapterkeuze

| Aansluiting | Wat nodig kan zijn | Waar het hoort | Geen claim over bestaande secretnaam |
|---|---|---|---|
| Supabase Auth-OTP | Geautoriseerde SMTP/providerconfig en juiste afzender | Supabase Auth-dashboard/config voor OTP; eventueel aparte uitnodigingsadapter op server | `SMTP_PASSWORD`/providerkey zijn pas concrete runtime-namen na adapterkeuze. |
| Transactionele e-mail | Provider-API-key of SMTP-credentials plus verified sender/reply-to | Worker/VPS-secretbeheer | Dit pakket verzint geen bestaande `RESEND_API_KEY` of andere leverancier. |
| Mail/providerwebhook | Signing secret als provider dat gebruikt | Alleen ontvangende serverroute | Signature controleren, event-ID dedupe; naam volgt adapter. |
| Sportlink | De voor het daadwerkelijke contract/providerendpoint vereiste credentials | Server/worker-secretbeheer of versleutelde integration_connection | Geen verzonnen verplichte `SPORTLINK_API_KEY`; capabilities eerst controleren. |
| GHCR imagepull | Bestaande pull-only registrylogin met minimaal `read:packages` volgens eerdere inrichting | Dockerconfig van runtimeuser `/home/cluvo-staging/.docker/config.json` of bestaand credentialbeheer | Dit is VPS-toegang voor pull, niet het GitHub-buildsecret. Aanwezigheid/rotatie op VPS nog operationeel verifiëren. |
| Automatische branchpromotie | GitHub App-installation token of beperkte PAT als toekomstig Actions-push workflow moet starten | Alleen indien de huidige operatorpromotie naar automatisering wordt veranderd | Niet vereist voor huidig `promote-staging.sh`. |

Er is in deze pipeline geen noodzaak voor `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, een brede deploy-PAT of een handmatige GHCR-pushsleutel. De deployjob gebruikt de self-hosted broker. Cluvo heeft in deze scope geen AI-functionaliteit en geen reeds gekoppelde Mollie/Stripe-PSP: maak daarvoor geen secrets aan.

Een promotiepush vanuit een Actions-job met standaard `GITHUB_TOKEN` activeert normaal niet opnieuw een pushworkflow. Behoud dus de werkende expliciete operatorpromotie, of kies bewust een GitHub App/PAT bij toekomstige automatisering. Dit is geen reden om nu de bestaande pipeline te vervangen.

## Gecontroleerde overgang naar APP_MODE=app

De broker en compose accepteren nu bewust het prototype. In `ops/cluvo-deploy-staging` staan expliciete modechecks, livenessverwachting en statusregistratie; `ops/compose.staging.yml` overschrijft `APP_MODE` bovendien naar `prototype`. Alleen het runtimebestand wijzigen werkt dus niet.

1. Bouw en test echte app met gecontroleerde staging-Supabaseconfig, juiste Auth Site URL en allowlisted confirm/verify/invite-redirects; behoud origin-validatie.
2. Pas bestaande compose-mode, brokerverwachting, healthcheckvalidatie, state/mode-registratie en runtimeconfig samen aan. Sta app alleen toe voor het vastgezette stagingtarget; behoud alle productieblokkades en immutable image/SHA/run-orderchecks.
3. Breng worker en readiness in scope. Huidige `/api/health/ready` meldt voor app alleen `authenticated_core`, `release_ready=false`, workers niet nodig voor die beperkte core. Maak dit eerlijk uitgebreider voor volledige functionaliteit; zet niet alleen een vlag true.
4. Laat nieuwe remote-migratiejob alleen met environment-stagingcredential op hosted runner werken, exact release-SHA, targetcheck, migrationhistorycontrole en compatibiliteit; geen build of DDL als root op de deployrunner.
5. Houd releasevolgorde onder bestaande stagingconcurrency: checks/image → staged DB-migratie → brokerdeploy → Auth/storage/RPC/worker-smoke → visuele/functionele acceptatie. Een mislukte migratie laat de oude app staan; een mislukte nieuwe app herstelt naar een compatibel vorig image.
6. Controleer root-owned bestanden, bestaande beperkte sudo-policy en loopbackbinding. Runtimegeheimen zijn alleen leesbaar voor de noodzakelijke runtime/brokerrollen; logs/health/manifests bevatten uitsluitend veilige status.

Verwijder geen rootless socket-eigenaarschapchecks, locks, targetpinning, SHA-labelvalidatie, beschermde origin of productieguard om app-mode sneller te laten starten. `production_enabled=false` blijft behouden. Reverseproxy/noindex blijven de bestaande stagingroute. De bekende bedoelde URL is `https://staging.cluvo.nl` uit eerdere inrichting; bevestig bij uitvoering de actuele targetconfig en response.

## Vrijgave en herstel

Promotie gebeurt op een expliciet geslaagde main-SHA. Release-manifest bevat SHA, immutable digest, CI/run-ID, schema/migratierevisie en relevante acceptatie-evidence. Health live moet de exacte SHA tonen; ready moet database/schema/connectiviteit en de benodigde actuele workers bewijzen zonder gevoelige details.

Maak voor schemawijzigingen een herstelbare backup van staging volgens het afgesproken beheerpad. Proefrestore in een geïsoleerd doel omvat database plus benodigde private-bestandmetadata/objects en Auth-config waar nodig. Meet resultaat en herstelprocedure; een bestand dat “backup.sql” heet is geen restorebewijs. Containerrollback herstelt geen database, provider-event of verzonden mail. Gebruik compatibele expandmigraties, en plan destructieve cleanup pas na afzonderlijk bewijs.

Bij eerste volledige stagingrelease: OTP→werkruimte, invite→executor, openbare/teambooking, uitvoering→beide tellers, ruil, een formeel dossierbesluit, financiële verwerking, outbox/push en season-close op testfixture. Geen echte clubleden of productiegegevens inzetten om een ontbrekende sandbox te omzeilen.
