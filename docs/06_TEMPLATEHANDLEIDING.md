# Meegeleverde templates: installatie en grenzen

Dit hoofdstuk beschrijft de daadwerkelijk geleverde bestanden. Hoofdstuk 05 beschrijft het volledige doelpad voor V1. De huidige scripts vormen een **stagingbootstrap voor de prototype-UI**. Er zijn geen externe acties uitgevoerd.

## Wat werkt na juiste inrichting?

| Bestand | Gedrag |
|---|---|
| `next.config.ts` | Next.js standalone-output, basisheaders en noindex |
| `scripts/runtime-guard.mjs` | Weigert vóór de serverstart productie, onbekende omgevingen en de nog niet gebouwde appmodus; Docker CMD en `npm start` laden deze guard via `--import` |
| `instrumentation.ts` | Aanvullende controle die productie en de nog niet gebouwde appmodus weigert |
| `lib/supabase/*` | Getypeerde helpers voor SSR, browser en sessies; nog niet gekoppeld aan de demostore |
| `/api/runtime-config` | Levert dynamisch uitsluitend de publieke URL en publishable key; geeft 503 als deze niet zijn ingesteld |
| `/api/health/live` | Toont of de app draait, plus omgevingsnaam, modus en bron-SHA |
| `/api/health/ready` | Geeft bewust 503 totdat de V1-backend gereed is |
| `Dockerfile` | Bouwt en test de standalone-app; de runtime draait niet als root |
| `.github/workflows/ci.yml` | PR-controles op een hosted runner, zonder deploysecrets |
| `.github/workflows/staging.yml` | Bouwt `main`, maakt een GHCR-image per SHA en een manifest; stagingdeploy is opt-in |
| `ops/cluvo-deploy-staging` | Valideert target, image, SHA en run; gebruikt een hostlock, voert een Compose-update uit, leest liveness terug en rolt de app bij een fout terug |
| `ops/templates/promote-production.yml.disabled` | Geen actieve workflow; bevat ook na activering een harde `exit 1` |
| `release/readiness.json` / `check:release` | V1 staat op false; de productiecheck faalt expliciet |

De bootstrap voert **geen databasemigraties, workers, OTP-configuratie, RLS-inrichting, blue/green-omschakeling of publieke rooktest** uit. Het is een gecontroleerde manier om dezelfde UI op staging te tonen. De Compose-update kan een korte onderbreking veroorzaken. `health/live=200` betekent alleen dat het proces draait, niet dat V1 klaar is.

Bij een mislukte eerste deployment zonder vorige versie stopt de broker ook de mislukte webcontainer. Bij een rollback wacht Compose op een gezonde container. Deze appcontroles vervangen geen controle van de database of de volledige gebruikersroute.

## Repository inrichten

Maak of gebruik een private GitHub-repository met `nextjs-starter/` als repositoryroot. De volledige documentatie en de canon staan ook in de starter. Zet bescherming voor `main` en verplichte CI aan. Gebruik featurebranches en PR's; alleen vertrouwde code op `main` mag staging bereiken. Controleer welke functies voor private environments beschikbaar zijn binnen het daadwerkelijke GitHub-plan.

De workflows veronderstellen dat `package.json` in de repositoryroot staat. Plaats ze niet ongewijzigd in de bovenliggende exportmap. De oorspronkelijke Siteconfiguratie blijft uitsluitend in de referentiekopie. Maak geen tweede Sites-publicatie voor deze migratie.

## Staginghost voorbereiden — uit te voeren door Codex of de operator

1. Kies een nog aan te leveren host en domein. Geen van de voorbeeldwaarden in de templates verwijst naar echte infrastructuur.
2. Installeer Docker Engine met de Compose-plugin, Python 3, util-linux/flock en een TLS-reverse-proxy. Pin de gekozen containerbasis op een digest vóór operationele ingebruikname. Het huidige Node 24-majorlabel is een onderhoudbaar startpunt, geen volledig vastgezet image.
3. Richt een aparte stagingidentiteit en private GHCR-pulltoegang in. Geef de deployrunner geen adminscope op GitHub en geen productiegeheimen. Dockerrechten zijn vergaand: gebruik een vaste broker of een dedicated host en bescherm scripts en configuratie tegen wijzigingen door de runner.
4. Plaats `ops/cluvo-deploy-staging` als `/usr/local/bin/cluvo-deploy-staging`. Maak het script en `/etc/cluvo/` root-beheerd. De runner moet de broker kunnen uitvoeren, maar mag die niet overschrijven. Stem eventuele sudo- of servicebroker-inrichting af op de bestaande server; gebruik geen brede `NOPASSWD:ALL`.
5. Plaats `ops/compose.staging.yml` in `/etc/cluvo/compose.staging.yml`. Vul `ops/staging-target.example.json` in en sla het op als `/etc/cluvo/staging-target.json`. Gebruik de exacte registry in kleine letters, bijvoorbeeld de echte GHCR-namespace en repositorynaam. Vul de eigen stagingorigin in. Laat `supabase_url` leeg tot WP1 of gebruik uitdrukkelijk het stagingproject.
6. Maak `/etc/cluvo/staging.env` vanuit `.env.staging.example`, met de daadwerkelijke `APP_URL`. Houd `APP_ENV=staging` en `APP_MODE=prototype`. Configuratie en environmentvariabelen moeten overeenkomen. Bewaar het secretsbestand buiten Git en beperk de leesrechten.
7. Maak `/var/lib/cluvo-staging/` lees- en schrijfbaar voor uitsluitend de bevoegde brokeridentiteit. Hier komen de deploylock, `current.json`, `previous.json` en het deploymentlog. Bewaar logging niet publiek.
8. Installeer een GitHub-deployrunner die uitsluitend voor Cluvo bedoeld is, met labels `self-hosted,linux,x64,cluvo-staging-deploy`. Laat daar geen PR-jobs op draaien. De deployjob checkt geen broncode uit en voert geen `npm install` uit.
9. Configureer de TLS-reverse-proxy naar `127.0.0.1:3100`. Zolang de authenticatie van het prototype bestaat, moet het stagingdomein achter een toegangsbeperking blijven. Vervang eerst de voorbeeldplaceholder voor Caddy Basic Auth.
10. Zet de repositoryvariabele `STAGING_DEPLOY_ENABLED=true` pas nadat het bovenstaande pad is getest. Gebruik GitHub Environment `staging` met de beschikbare branch- en goedkeuringsregels. Bouw geen geheime stagingwaarden in het image.
11. Push of merge geteste code naar `main`. Controleer Actions, het vaste image-digest en `/var/lib/cluvo-staging/current.json`. Controleer zelf ook het stagingdomein. Registreer het bewijs; ga niet alleen af op de kleur van de job.

## Configuratieoverzicht

| Sleutel | Waar | Nu nodig |
|---|---|---|
| `APP_ENV` / `APP_MODE` / `APP_URL` | Serveromgeving | Ja: staging, prototype en de echte origin |
| `RELEASE_SHA` | Ingesteld door de broker | Ja |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Serveromgeving; publieke configuratie via allowlist | Vanaf WP1 |
| `SUPABASE_SECRET_KEY` | Alleen privé op server of worker | Alleen bij afgebakende beheeroperaties |
| `MIGRATION_DATABASE_URL` | Secret voor de migrator | Vanaf WP1; geen toegang vanuit de webcontainer |
| `BACKUP_DATABASE_URL` | Secret voor het back-upproces | Vanaf WP1, met minimale rechten |
| `MAIL_DRIVER` / `MAIL_ALLOWLIST` | Worker/runtime | Logdriver en allowlist totdat de verzendtest is vrijgegeven |
| `SPORTLINK_DRIVER` | Worker/runtime | Fixtures totdat contract en adapter geautoriseerd zijn ingericht |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Respectievelijk publiek en op de server | Bij het werkpakket voor PWA-push |
| `GITHUB_TOKEN` | Alleen de GitHub-buildjob | Automatisch; `packages: write` alleen daar |
| GHCR-pullcredential | Registrylogin op de host | Afzonderlijke, geteste private leestoegang |

Plak geen `.env`-bestand, OTP, databasewachtwoord of API-key in de handmatige Codex-prompt.

## Voor de eerste echte gegevens

WP1 vervangt `localStorage` en demorechten en activeert sessieproxy, OTP, echte RLS- en tenanttests en servermutaties. Geef pas daarna bewust `APP_MODE=app` vrij in de runtime en de broker. Voeg ook databaseback-ups, een migratielock, migratiechecksums, advisors, schemacompatibiliteit, readiness en workerchecks aan het deploypad toe. Alleen afvinken is onvoldoende: toon aan dat concurrency op de laatste dienstplaats en negatieve ouder- en tenanttests slagen.

## Latere productiepromotie

De meegeleverde productietemplate is opzettelijk onvolledig als uitvoerpad: er is een harde weigering ingebouwd. Codex mag deze uitsluitend bij afzonderlijk V1-akkoord implementeren.

Gebruik dan exact de geteste SHA en het image-digest uit het bewijs van een geslaagde stagingdeployment. Controleer repository, workflow, runconclusie en migratiehashes. Gebruik een aparte productieomgeving met eigen secrets, expliciete goedkeuring, back-up en readinesscontroles. Activeer de productierunner pas op dat moment. Controleer dat hetzelfde image via de runtimeconfiguratie de productieomgeving van Supabase benadert. Verwijder gates niet alleen om de workflow groen te krijgen.
