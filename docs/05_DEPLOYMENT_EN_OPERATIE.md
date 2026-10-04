# Cluvo — deployment en operatie

Versie 1.0 · 2 oktober 2026 · ontwerp voor de Codex-overdracht

## Status van de meegeleverde templates

Dit document beschrijft de **doelarchitectuur voor de echte V1**. De werkmap bevat inmiddels naast de prototype-UI een lokale Supabase-domeinbasis en een eerste echte Auth→dossier→boeking→presentie→ledger-keten. De stagingbootstrap bouwt een image, maar voert op een remote omgeving nog geen bewezen databasebackup of migratie uit. `/api/health/live` controleert het proces; `/api/health/ready` controleert in `APP_MODE=app` de databaseafhankelijkheid en blijft daarnaast eerlijk `release_ready=false` rapporteren. Appmodus is lokaal/test/staging toegestaan met volledige configuratie; `APP_ENV=production` blijft geblokkeerd. De productiontemplate staat buiten de actieve workflows en stopt bovendien onvoorwaardelijk met een fout.

De huidige Docker Compose-bootstrap vervangt de ene webcontainer op dezelfde poort en probeert bij mislukking het vorige image te herstellen. Dit kan een korte onderbreking veroorzaken. Blue/green, remote backup- en migratiegates, volledig geteste terugrol, echte provider-/browsergates en productiepromotie hieronder zijn **nog uit te voeren V1-werk**. Het meegeleverde release-manifest houdt daarom `v1_ready: false`. De exacte oorspronkelijke prototypebron staat afzonderlijk van de aangepaste Next.js-app, zodat de visuele referentie controleerbaar blijft.

## 1. Vast besluit en uitgangspunten

De ontwikkelroute is **`main` → staging → production**. Tot de volledige V1 is afgerond, getest en door Danny geaccepteerd, wordt uitsluitend op staging gewerkt en gedeployd. Het bestaande Sites-prototype blijft de visuele en interactieve referentie; dit document verplaatst of wijzigt die omgeving niet.

`main` is de integratie- en bronbranch en deployt nooit rechtstreeks. Iedere push naar `main` doorloopt CI. Een geaccepteerde groene `main`-commit wordt daarna zonder mergecommit exact naar de beschermde `staging`-branch gepromoveerd. Alleen een push naar `staging` start de stagingbuild en -deployment. Er wordt nooit rechtstreeks op `staging` ontwikkeld. Production krijgt later uitsluitend de op staging geteste broncommit en hetzelfde containerimage.

**Aanbevolen basis, nog in te richten:** een private GitHub-repository; een VPS voor Next.js via Docker met een reverse proxy en TLS; Supabase als beheerde dienst met een afzonderlijk project per omgeving; GitHub-hosted CI/builds en een uitsluitend voor Cluvo bedoelde deployrunner. Domeinen, VPS, repository, provideraccounts, Supabase-projecten en echte secrets zijn bij deze overdracht niet aangeleverd. De voorbeeldbestanden moeten daarom eerst op die infrastructuur worden ingevuld en gecontroleerd. Dit is geen bewering dat er al een VPS-deployment bestaat.

De applicatie wordt echte Next.js App Router, TypeScript en `output: 'standalone'`. De bestaande Vinext/Sites-runtime wordt niet het productiedeploypad. Pin de gekozen ondersteunde versies, containerbasis en Actions in de repository en commit de lockfile. Kies en verifieer de precieze versies bij implementatie; een losse `latest`-verwijzing is geen reproduceerbare release.

## 2. Omgevingen en toegangsgrenzen

| Omgeving | Code | Data en diensten | Toegestaan vóór V1-akkoord |
|---|---|---|---|
| Lokaal/CI | Featurebranch of exacte PR-commit | Lokale Supabase; synthetische fixtures; mailopvang | Ontwikkelen en alle tests uitvoeren |
| Staging | Geslaagde commit op `main` | Eigen Supabase-project; eigen buckets, Auth-instellingen, API-sleutels; testproviders | Automatisch deployen, migreren en gebruikersacceptatie |
| Production | Goedgekeurde staging-SHA en image-digest | Later eigen Supabase-project, domein en provideraccounts | Niet deployen, niet migreren, niet mailen, niet inrichten via automatische workflow |

Ook wanneer er aanvankelijk één VPS wordt gebruikt, zijn containerprojecten, netwerk, volumes, omgevingsbestanden, deployidentiteiten en secrets gescheiden. Bij ingebruikname van production is een aparte VPS of duidelijke isolatie de voorkeur. Een Supabase-schema `staging` naast `production` in hetzelfde project is niet de standaardisolatie: Auth, Storage, configuratie en beheerrechten zouden dan nog steeds gedeeld worden.

Staging gebruikt verzonnen huishoudens en leden. Een eventuele import van echte persoonsgegevens is een apart besluit met doel, toegang en bewaartermijn. Staging stuurt e-mail alleen naar een ingestelde testlijst of mailopvang; push alleen naar expliciete testaccounts. Sportlink importeert eerst via een read-only adapter of representatieve fixtures. Betalingen blijven sandbox. Zet de omgevingsnaam blijvend zichtbaar in staging.

## 3. Harde productionblokkade

De blokkade mag niet alleen uit een tekst in een README bestaan.

1. Het productionworkflowbestand wordt als uitgeschakelde template buiten de actieve `.github/workflows/*.yml`-set geleverd. Er is dus geen werkende automatische productietrigger.
2. Productioncredentials en een productiondeployrunner worden niet aan de ontwikkelworkflow toegevoegd. De stagingidentiteit heeft geen toegang tot production.
3. Het stagingdeployscript accepteert uitsluitend de vaste omgevingsnaam `staging`, de verwachte staginghost en het vooraf vastgelegde Supabase-project. Onbekende of ontbrekende waarden stoppen de deployment vóór migraties.
4. Een runtimecontrole bevestigt bij opstarten dat `APP_ENV=staging`, de openbare app-URL, de Supabase-URL en de verwachte projectreferentie bij elkaar horen. Geen stille fallback naar production.
5. Activering van production vraagt later een reviewbare wijziging met het V1-acceptatiebewijs, de releasegegevens, een geteste herstelprocedure en de inrichting van afzonderlijke productiontoegang.

Na activering komen daar een beschermde GitHub Environment `production`, beperkte deploybranches en een expliciete releasegoedkeuring bij. Controleer vooraf welke environmentregels het gekozen GitHub-abonnement voor een private repository daadwerkelijk ondersteunt. Ga niet uit van beschikbare verplichte reviewers zonder dit te toetsen. Als die functie ontbreekt, blijft de technische blokkade bestaan totdat een passende goedkeuringsroute is ingericht.

## 4. CI: testen zonder toegang tot servers

Pull requests draaien op GitHub-hosted runners, met minimaal `contents: read`, zonder omgevingssecrets en zonder netwerktoegang tot een deployhost. Gebruik nooit `pull_request_target` om de onbetrouwbare broncode van een PR met verhoogde rechten uit te voeren. Een PR kan geen self-hosted deployrunner selecteren en krijgt geen productie- of stagingdatabasecredentials.

CI moet betekenisvolle gates bevatten:

- installatie uit de vastgelegde lockfile, lint en TypeScript;
- unit- en integratietests van de canonregels;
- volledige opbouw van een lege lokale Supabase-database uit de migraties;
- negatieve RLS-tests tussen tenants, huishoudens, commissieleden en gescheiden ouderdossiers;
- transactionele tests voor gelijktijdig inschrijven, capaciteit, ruilen en urenboeken;
- browserflows voor OTP, intake, boeking, aanwezigheid, winterplaatsing, beleidsacceptatie en vierogenbesluiten;
- productiebuild van echte Next.js en een lokale rooktest van het gebouwde image.

Alleen een geslaagde, vertrouwde `main`-run mag een stagingrelease leveren. Pin externe Actions op gecontroleerde volledige commit-SHA's; houd versienamen als commentaar bij. Geef `packages: write` alleen aan de imagepublicatiestap/-job. Een deployjob hoeft geen broncode te wijzigen en krijgt geen `contents: write`.

## 5. Build eenmaal, promoveer hetzelfde image

De build vindt op een GitHub-hosted runner plaats. De server voert geen `npm install`, `next build` of willekeurige PR-scripts uit. Publiceer een private containerimage met bron-SHA als traceerbare tag en leg de door het register gerapporteerde **digest** vast. Deploy met `registry/namespace/cluvo@sha256:…`; een tag zoals `latest` is geen release-identiteit.

Elke release krijgt een machineleesbaar manifest met ten minste:

| Veld | Betekenis |
|---|---|
| `source_sha` | De volledige Git-commit die CI heeft gecontroleerd |
| `image` en `image_digest` | Vastgepinde registryreferentie van de build |
| `workflow_run_id` | Herkomst van de vertrouwde build |
| `migration_manifest_sha256` | Hash van de geordende migratielijst en bestandschecksums |
| `config_schema_version` | Versie van de vereiste omgevingsconfiguratie |
| `built_at` | UTC-tijdstip van de build |
| `staging_verified_at` | Wordt pas na geslaagde deployment en controles vastgelegd |
| `previous_release` | Vorige geslaagde release voor applicatieterugrol |

De promotionjob accepteert later uitsluitend een manifest afkomstig uit een geslaagde stagingdeployment van deze repository. Controleer workflowherkomst, bron-SHA, digest en migratiechecksums; laat een handmatig ingevoerde digest niet zonder herkomstcontrole door. Een migratiebundel komt uit dezelfde commit en krijgt ook een checksum. Het image wordt bij productiepromotie niet opnieuw gebouwd, ook niet wanneer `main` inmiddels verder is.

### Publieke Supabase-configuratie op runtime

Next.js vervangt `NEXT_PUBLIC_*`-waarden tijdens het bouwen. Een image dat zo met de staging-Supabase-URL is gebouwd, kan na promotie nog steeds staging benaderen. Daarom wordt de browserconfiguratie voor Cluvo dynamisch vanaf de server geleverd.

Gebruik een kleine, expliciete runtimeconfiguratie met uitsluitend `appEnv`, `appUrl`, `supabaseUrl` en de Supabase publishable key. Geef die via een dynamisch serveronderdeel aan de browserclient door of lever een dynamische configuratieroute met `Cache-Control: no-store`. De route moet daadwerkelijk dynamisch blijven en mag niet tijdens `next build` worden geprerenderd. Cache deze configuratie ook niet in de serviceworker. Test na elke deployment dat de browser het juiste Supabase-project gebruikt.

Een publishable key mag in de browser voorkomen; een Supabase secret key/service-role-key, databasewachtwoord, SMTP-token of Sportlinkcredential nooit. Exporteer geen volledig `process.env`-object. Bouw zonder echte omgevingssecrets; geef runtimeconfiguratie pas bij het starten van de container mee.

## 6. Stagingdeploy in vaste volgorde

1. Controleer dat de run uit de vertrouwde repository, de bedoelde workflow en `refs/heads/main` komt. Lees de bron-SHA uit de run en checkout nooit stilzwijgend de nieuwste branchkop.
2. Haal het release-manifest en de bijbehorende image-digest op. Controleer formaat, herkomst, hashes en de ondersteunde configuratieversie.
3. Verkrijg een deploylock per omgeving. Gebruik GitHub-concurrency met `cancel-in-progress: false` voor de deployjob, plus een hostlock zodat een handmatige deployment niet tegelijk kan lopen.
4. Voer preflight uit: juiste omgeving/project, voldoende schijfruimte, bereikbare database, leesbaar image, migratiestatus en werkende backupbestemming.
5. Maak of verifieer het vereiste herstelpunt vóór een datamigratie. Bewaar herstelpunt-ID, schema-/migratieversie en objectbackupstatus in het deploylog. Een mislukte vereiste backup blokkeert de migratie.
6. Verkrijg een database-advisory-lock voor de volledige migratiesessie. De lock moet door dezelfde open databaseverbinding worden vastgehouden totdat de migrator klaar is; een los `psql`-commando dat meteen afsluit beschermt de volgende CLI-aanroep niet.
7. Pas alleen ontbrekende, gecontroleerde migraties van deze release toe. Controleer de opgeslagen checksums van reeds toegepaste migraties. Gebruik geen database-reset of automatische driftreparatie op een gedeelde omgeving.
8. Start een kandidaatcontainer met het nieuwe image en staging-runtimeconfiguratie. Controleer gereedheid rechtstreeks op de kandidaat, voordat verkeer omschakelt.
9. Schakel de reverse proxy om naar de gezonde kandidaat. Laat de vorige container kort beschikbaar om terug te kunnen schakelen en laat lopende verzoeken netjes aflopen.
10. Voer rooktests uit via het stagingdomein: loginpagina, runtimeconfiguratie, readiness, tenantgrens en een gecontroleerde testflow. Activeer of hervat daarna de betreffende workers.
11. Registreer de deployment pas als geslaagd wanneer image, schema, configuratie en rooktests overeenkomen. Bewaar vorige en huidige releasegegevens; ruim oude images volgens retentie op, nooit de enige bekende terugrolrelease.

Met één VPS kan blue/green via twee lokale containerpoorten en een proxy-upstream. Laat Docker niet rechtstreeks op een publieke applicatiepoort luisteren. De reverse proxy verzorgt TLS, requestlimieten en passend streaminggedrag. Authenticeerde antwoorden krijgen geen gedeelde publieke cache. Healthchecks geven geen secret, connectionstring of persoonlijke gegevens terug.

## 7. Migraties en herstel

Gebruik de Supabase CLI als vastgepinde ontwikkel- en migratietool. Controleer de actuele commando's via `--help` bij implementatie. Maak migraties met de CLI, review SQL, test een lege database én een upgrade vanuit de vorige release en commit de gegenereerde types. Staging en production volgen dezelfde geordende migratiereeks; een migratie die al op een gedeelde omgeving is toegepast wordt niet achteraf aangepast.

Werk met **expand → migrate → contract**:

- Eerst compatibele tabellen/kolommen/indexen/policies toevoegen.
- Applicatieversie uitrollen die oud en nieuw tijdelijk begrijpt.
- Grote backfills in hervatbare, gemonitorde batches uitvoeren.
- Pas in een latere release oude structuren verwijderen, nadat terugrol en actieve clients zijn beoordeeld.

Gebruik transacties waar het SQL-type dat toelaat. Documenteer niet-transactionele stappen, lockduur en herstel. Zet lock- en statementtime-outs bewust. Een migrator heeft apart DDL-recht; de webapp heeft geen migratiecredential nodig. Een databasepool in transaction mode is niet geschikt om zonder verdere voorzieningen een sessie-advisory-lock over opeenvolgende opdrachten vast te houden; gebruik hiervoor een directe of daarvoor geschikte sessieverbinding.

Bij applicatiefout: schakel terug naar het vorige gezonde image dat compatibel is met het uitgebreide schema. **Draai niet automatisch down-migraties.** Bij een fout na een reeds toegepaste migratie blijft die migratie staan en volgt meestal een gecontroleerde forward-fix. Bij datacorruptie: stop relevante schrijvers/workers, bepaal het herstelpunt, herstel eerst in een geïsoleerde omgeving, controleer dataverlies en referenties, en voer een expliciet goedgekeurd herstel uit. Het woord rollback mag niet verhullen dat een databaserestore recente gegevens kan verwijderen.

## 8. Backups omvatten database én bestanden

Een Supabase-databasebackup bevat niet de bestanden die via Storage zijn opgeslagen. Daarom zijn twee herstelstromen nodig: database/rollen/configuratie en objectbestanden met bijbehorende metadata. Commissie-documenten, certificaten, logo's en uploads mogen niet alleen in het live bucket staan.

Voorstel voor de operationele inrichting, nog door de beheerder te bevestigen:

- Dagelijkse versleutelde backups naar een afzonderlijke bestemming en account; pre-migratieherstelpunt bij risicovolle changes.
- Objectbackup met checksums en zo mogelijk versiegeschiedenis; verwijderingen in live Storage niet meteen blind doorzetten naar de backup.
- Minimaal 30 dagen herstelhistorie als initiële retentie, daarna afstemmen op beleid, kosten en privacy.
- Stagingdoel: maximaal 24 uur verlies van testgegevens en herstel binnen één werkdag. Productiondoelen worden vóór ingebruikname vastgesteld en met een restore-oefening aangetoond; PITR en retentie hangen af van de gekozen dienstconfiguratie.
- Maandelijkse geautomatiseerde integriteitscontrole en periodieke echte restore-oefening naar een afgeschermde omgeving. Log bewijs: tabelaantallen, tenantisolatie, policies, login, documentchecksums en werkende downloads.

Bewaar ook de benodigde configuratie veilig: Auth-redirects en templates, bucketbeleid, workerplanning, domein/proxyconfiguratie en providerinstellingen. Secrets gaan naar een secretmanager of beveiligde beheerlocatie, niet naar de broncode of algemene backupdocumentatie.

## 9. Secrets, runtime en workers

| Soort | Locatie | Regels |
|---|---|---|
| Supabase URL + publishable key | Runtime; beperkte browserconfiguratie | Omgevingsspecifiek; juiste projectref valideren |
| Supabase secret key | Alleen server/worker | Geen browserimport; geen clientlog; apart van publishable key |
| Database migratiecredential | Alleen migrator | Geen webcontainer; project- en omgevingsbinding |
| Registry pullcredential | Deployidentiteit | Alleen lezen; alleen benodigd registryproject |
| SendGrid/SMTP, Sportlink, pushsleutels | Betreffende serveradapter/worker | Apart per omgeving; staginguitgaande berichten begrenzen |
| Backupcredential | Backupjob | Gescheiden bestemming; beperkte rechten |

Een deployrunner krijgt uitsluitend de rechten die het vaste deploymentpad nodig heeft. Een gebruiker in de Docker-groep heeft praktisch vergaande hostmacht; behandel dit als een expliciete vertrouwensgrens. Draai geen andere projecten of onbetrouwbare buildjobs op dezelfde runner. Bij voorkeur krijgt de runner alleen toegang tot een vast, door root beheerd deployscript met strikt gevalideerde input. Log geen volledige omgevingsdump.

Next.js-webverzoeken zijn niet de plek voor een betrouwbare tweemaal-daagse Sportlinktaak of lange e-mailbatch. Gebruik een aparte worker met persistente databasequeue en een scheduler. Een crontrigger maakt idempotente jobs; de worker claimt jobs transactioneel, hanteert retries met back-off en verplaatst blijvende fouten naar een herstelbare foutlijst. Voorkom dubbel verzenden met een unieke gebeurtenis-/ontvanger-/kanaalsleutel en registreer provider-ID's.

De gewenste Sportlinksynchronisatie draait volgens `Europe/Amsterdam`, standaard 06:00 en 18:00, configureerbaar. Test zomertijd/wintertijd; een kale UTC-cron is niet automatisch dezelfde lokale tijd. Een nieuwe deployment mag niet tijdelijk twee schedulers met dubbele taken creëren. Het maximum van één dagelijkse nieuwe-takenmail geldt per persoon en lokale verenigingsdag; matching pushmeldingen krijgen hun eigen deduplicatie per nieuwe taak. Een databaserestore kan reeds verzonden providerberichten niet terugdraaien: herstart daarom nooit blind de gehele outbox.

## 10. Observability en incidenten

Leg per request/job een correlation-ID, tenant-ID waar passend, eventtype, uitkomst en release-SHA vast. Log geen intake-antwoorden, medische redenen, OTP's of volledige berichtinhoud. Beperk toegang en bewaartermijn. Applicatie-audit en technische logs hebben verschillende doelen en rechten.

Voorzie monitoring op beschikbaarheid, readiness, 5xx, responstijd, databasebereikbaarheid, resterende schijfruimte, backupouderdom, mislukte migraties, queueleeftijd, providerfouten en laatste geslaagde Sportlinksync. Waarschuw een aangewezen beheerder via een ingerichte route; deze overdracht verstuurt zelf geen meldingen en creëert geen planning in externe accounts.

Minimale endpoints: liveness toont dat het proces draait; readiness controleert de vereiste configuratie, databasebereikbaarheid en ondersteunde schemaversie. Een tijdelijk defecte Sportlinkprovider maakt het hele ledendashboard niet onbruikbaar; toon synchronisatiestatus en handel de fout afzonderlijk af.

Bij incident: bepaal omgeving en actieve SHA/digest, blokkeer zo nodig de getroffen mutatie of worker, behoud logs, kies applicatieterugrol of forward-fix, voer rooktests uit en documenteer oorzaak en herstel. Een lokaal demoresetknopje uit het prototype hoort niet in de echte staging-/productiebeheeromgeving.

## 11. Startvolgorde voor Codex

1. Neem canon, visuele referentie en broncode door; leg gekozen versies en ontbrekende infrastructuurwaarden vast.
2. Bouw lokaal echte Next.js + lokale Supabase en laat de fundamentele tenant-/RLS- en canonproeven slagen.
3. Richt alleen de private repository, stagingomgeving en staging-Supabase in zodra de benodigde accounts beschikbaar zijn.
4. Test het containerimage lokaal zonder echte secrets en controleer de runtimeconfiguratie.
5. Vul de stagingdeploymenttemplates in, valideer hun syntax en voer preflight uit voordat infrastructuurmutaties plaatsvinden.
6. Laat één volledige stagingrelease slagen, inclusief backup, migratie, rooktests en terugrol naar het vorige image.
7. Bouw V1 in afgebakende verticale onderdelen verder; elke merge naar `main` houdt staging bruikbaar.
8. Houd production geblokkeerd totdat de V1-acceptatiematrix, herstelproef, beheerafspraken en expliciete releasebeslissing compleet zijn.

## 12. Officiële referenties en controledatum

Documentatie gecontroleerd op 2 oktober 2026. De architectuurkeuzes hierboven zijn aanbevelingen voor Cluvo; ze zijn geen letterlijke implementatiehandleiding van een leverancier.

- Next.js, runtime- en buildtimevariabelen: https://nextjs.org/docs/app/guides/environment-variables
- Next.js, self-hosting, proxy en shutdown: https://nextjs.org/docs/app/guides/self-hosting
- Supabase, gescheiden omgevingen en migraties: https://supabase.com/docs/guides/deployment/managing-environments
- Supabase, backups en beperking voor Storageobjecten: https://supabase.com/docs/guides/platform/backups
- GitHub, environmentregels, secrets en abonnementsbeperkingen: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- GitHub, self-hosted runners en private repositories: https://docs.github.com/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners
- GitHub, veilig gebruik van Actions: https://docs.github.com/en/actions/reference/security/secure-use

De Supabase changelog-index op `https://supabase.com/changelog.md` is voor dit overdrachtspakket opgehaald en op relevante breaking-change-vermeldingen gecontroleerd. Daaronder staat de PostgreSQL 15.19/17.11-update van 25 september 2026 met aandachtspunten voor bepaalde extensies en bestaande indexen. Dit pakket voert geen database-upgrade uit. Codex controleert vóór de feitelijke implementatie de volledige release-notes die gelden voor het gekozen project, de gebruikte extensies en de vastgepinde versies.
