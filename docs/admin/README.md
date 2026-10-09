# Verenigingsbeheer en platformbeheer

De beheeromgevingen gebruiken dezelfde personen, huishoudens, taakplaatsen, boekingen, teamafspraken, uitvoeringsbesluiten en ledger als de ledenapp. Alle lezingen, formulieren, resource-URL’s en exports worden afzonderlijk op de server en in de database geautoriseerd. De eerste 36 migraties blijven ongewijzigd. De database bevat 191 tabellen met verplichte native sessiecontrole en RLS, 102 publieke invokerfuncties en 21 invokerviews.

## Inloggen en toegang

Open `/login` en gebruik je persoonlijke, geverifieerde e-mailadres en de Supabase-inlogcode. Dezelfde persoonlijke sessie wordt gebruikt voor de ledenapp, verenigingsbeheer en platformbeheer. Er is geen apart beheerderswachtwoord of demorol.

`/workspaces` toont uitsluitend de werkruimtes waarvoor een actuele bevoegdheid bestaat. In de PWA blijft de clubkeuze bovenaan **Meer**. De beheeringang verschijnt alleen bij een expliciet verenigingsmandaat; platformbeheer vraagt afzonderlijke platformgrants.

Benoemde beheeruitnodigingen verschijnen na persoonlijk inloggen in `/workspaces`. Zij bevatten de vereniging, de specifieke commissie/het huishouden, afzonderlijke rechten, acceptatietermijn en eindtijd. Alleen de geverifieerde ontvanger kan de actuele versie accepteren of weigeren. De server controleert dan opnieuw het mandaat van de uitnodiger. Intrekken, verlopen, wijzigen of verliezen van dat mandaat blokkeert acceptatie. Deze in-app-uitnodiging verzendt geen losse e-mail; huishoudelijke e-mailuitnodigingen behouden hun bestaande verzendflow.

Het eerste platformmandaat wordt eenmalig via de bestaande GitHub-stagingbeheerroute ingericht, uitsluitend na een expliciete accountkeuze. `staging-admin-bootstrap.yml` verlangt de actuele groene en actieve stagingcommit, de bevestigingsinvoer en een bestaand, geverifieerd account. Het verleent acht afzonderlijke platformrechten voor 90 dagen, met idempotent ontvangstbewijs en audit. Het maakt geen Auth-account, verenigingslidmaatschap of privédossierrecht aan. Herhalen herstelt of verlengt ingetrokken rechten niet.

Hiervoor zijn geen nieuwe credentials nodig: de workflow gebruikt de bestaande `MIGRATION_DATABASE_URL`, `SUPABASE_URL`, `STAGING_SUPABASE_PROJECT_REF` en de persoonlijk aangewezen `STAGING_TEST_RECIPIENT` uit environment **staging**. Alleen wanneer een ander bestaand account expliciet wordt benoemd, kan diens adres tijdelijk in `STAGING_ADMIN_BOOTSTRAP_EMAIL` worden gezet. Een persoonlijk adres of sleutel wordt niet als workflow-invoer of bewijs geëxporteerd.

## Routes en bevoegdheden

Onderstaande routes staan onder `/c/{club}/beheer`. De actuele vereniging en het seizoen blijven bovenaan zichtbaar. Een beperkt recht geeft uitsluitend de bijbehorende commissie, het team of het huishouden vrij.

| Route | Functie | Vereiste bevoegdheid |
| --- | --- | --- |
| `/cockpit` | Eigen werkvoorraad, doorklik naar gefilterde lijst en seizoensstanden | Minimaal één actueel beheerrecht; iedere telling heeft eigen scope |
| `/organization` | Identiteit, logo, contact, locaties en versiegebonden nieuwe afspraken | `organization.manage` |
| `/people` | Personen en geautoriseerde huishoudens, koppelingen, persoonlijke huishoudelijke uitnodigingsstatus | `organization.manage` of afzonderlijk `household.review` |
| `/access` | Scoped rollen/grants en benoemde beheeruitnodigingen vastleggen, accepteren, beëindigen en inzien | `organization.access.manage`; elke gedelegeerde bevoegdheid en eindtijd worden opnieuw gecontroleerd |
| `/committees/{id}` | Contact, leden, verantwoordelijken en bestaande commissieafspraken | Organisatiebeheer of het betreffende commissie-/planningsmandaat |
| `/teams/{id}` | Leden, individuele doelen, historische afspraken, planning en overdracht | Organisatiebeheer of `team_task.manage` binnen dit team |
| `/planning` | Verenigingstaken, teamreserveringen, concrete plaatsen, kalender en taaksoorten | `shift.manage`, `team_task.manage` of `club_cluster.manage`, per actie en broncommissie |
| `/execution` | Bevestigen en gemotiveerd corrigeren van feitelijke uitvoering | `attendance.confirm` binnen de broncommissie |
| `/requests/{id}` | Huishoudvragen, uitzonderingen, uurvragen, vacatureinteresse, overnames en teamtaakminuten | De afzonderlijke beoordelings- of opvolgingsbevoegdheid van het aanvraagtype |
| `/policies/{id}` | Exacte conceptversie, publicatie, doelgroep en echte akkoordstatus | `policy.manage`; opening is geen acceptatie |
| `/courses/{id}` | Cursuscapaciteit, inschrijvingen en geregistreerde kwalificaties | `development.manage`; inschrijving is geen kwalificatie |
| `/communication` | Bestaande inbox/kanalen, templateversies, proefverzending en outboxstatus | `communication.manage`, binnen de eigen scope |
| `/reports` | Huishoud-, winter-, jaar-, team- en bezettingsrapporten | `report.season.view`; vrijwilligerspot vraagt afzonderlijk financieel mandaat |
| `/finance` | Bestaande financiële voorbereiding, goedkeuring, verwerking en pot | Afzonderlijke `finance.assessment.*` of `finance.fund.manage` |
| `/seasons/{id}` | Doelen, wintergrens, sluitcontrole en seizoensovergang | Organisatiebeheer; sluiten/overgang vragen afzonderlijk `season.close` / `season.rollover` |
| `/support` | Benoemde supportaanvraag, verenigingsconsent, beëindiging en audit | `organization.access.manage` |
| `/export` | CSV of kalender, met dezelfde bron en filters | De bevoegdheid van het geëxporteerde onderdeel; geen extra exportrecht |
| `/sportlink` | Bestaande versleutelde koppeling en veilige verbindingstest | Het bestaande native `match.import`-mandaat; ook benoemde support blijft hierop gecontroleerd |

Detailpagina’s behouden context en tabs. Bestaande routes zoals `/beheer/presentie` en `/beheer/sportlink` blijven bruikbaar. Huishoudelijke uitnodigingen en hun cancel-/acceptatieflow blijven de bestaande canonieke `/huishouden`- en `/invite/accept`-routes gebruiken. Een teamouderbenoeming blijft gebonden aan de benoemde opvolger en de actuele gereedstaande overdrachtsversie.

| Platformroute | Functie | Apart platformrecht |
| --- | --- | --- |
| `/platform/overview` | Gemeten, geautoriseerde verenigingstotalen | `platform.overview` |
| `/platform/tenants` | Zoeken, identiteit, onboarding en detailtabs | `platform.tenant.read` |
| `/platform/tenants/{id}` | Eerste beheerder per directe expliciete benoeming of persoonlijke uitnodiging/acceptatie, eerste seizoen, impactcontrole, activeren/pauzeren/archiveren en modules | Mutaties: `platform.tenant.manage` binnen de vereniging |
| `/platform/staff` | Bestaand geverifieerd account benoemen en specifieke platformgrants intrekken | `platform.access.manage` |
| `/platform/defaults` | Vier begrensde standaardinstellingen voor nieuwe inrichting | `platform.config.manage` |
| `/platform/integrations` | Configuratiestatus, laatste geslaagde synchronisatie en veilige verzendherstelactie | `platform.integration.manage` |
| `/platform/support` | Doel, één vereniging/commissie, gevraagde acties, consent en eindtijd | `platform.support`; zonder consent geen verenigingswerkruimte |
| `/platform/audit` | Filteren op actor, vereniging, actie, periode en resource | `platform.audit.read` |

Platformrechten geven geen toegang tot private intakes, financiële huishoudinhoud of een algemene tenantdump. Een bestaande vereniging kan niet via de eerste-onboardingroute extra beheerdersrechten krijgen. Een platformmedewerker werkt met het eigen account; tijdelijk support wordt zichtbaar getoond, heeft maximaal 24 uur geldigheid en sluit bij intrekking ook een al geopend beheerscherm.

## API- en domeinkoppelingen

| Contract | Gebruik |
| --- | --- |
| `api.club_admin_access`, `api.club_admin_read` | Actuele tenant/scope, minimale pickers, werkvoorraad, detail- en rapportprojecties |
| `api.club_admin_command`, `api.club_admin_command_status` | Nieuwe ontbrekende beheeracties met versie, command-ID, audit en echte opslag |
| Bestaande `api.pwa_snapshot` / `api.pwa_command` en domein-RPC’s | Taakpublicatie, cluster/toewijzing, uitvoerderkeuze, overname, teamouderacceptatie, beleidsacceptatie, presentie en correcties |
| `api.platform_access`, `api.platform_read`, `api.platform_account_choice` | Afzonderlijk platformmandaat, operationele projecties en exacte geverifieerde accountkeuze |
| `api.platform_tenant_impact`, `api.platform_command`, `api.platform_command_status` | Onboarding, lifecycle, medewerkers, defaults, modules, support en gecontroleerde retry |
| `api.admin_prepare_command`, `api.admin_pending_commands`, `api.admin_cancel_command` | Duurzame opdrachten: bij onbekende uitkomst dezelfde command-ID controleren/herhalen of bevoegd annuleren |
| Bestaande account-helpvoorkeur | Kruisje en **Gezien** bewaren dezelfde voorkeur per persoon, onderwerp en uitlegversie |

Huishoudrapporten en de persoonlijke ledenstand gebruiken de gedeelde canonieke verplichtingsberekening. Teamvoortgang gebruikt dezelfde bron in PWA en beheer. Bij nieuwe seizoenssluiting worden de teamstanden vastgelegd in het bestaande sluitrecord; een oude gesloten periode zonder destijds vastgelegde meting wordt als onbekend getoond. Er is geen tweede urenledger of teamdoelenadministratie.

Een templateproef loopt via de bestaande outbox, ontvangerscontrole en voorkeuren. Provideracceptatie vraagt een daadwerkelijk geregistreerd receipt voor de exacte templateversie. Acceptatie door de provider bewijst geen inboxaflevering. Verzending met onbekende uitkomst wordt niet opnieuw gestart. Herstel biedt alleen de bewezen tijdelijke fouten aan waarvoor de actuele bron, lease, versie, poging en dedupe geldig zijn.

## Nieuwe migraties

| Migratie | Contract |
| --- | --- |
| `20261009120000_platform_administration.sql` | Acht platformrechten, benoemde beheeruitnodigingen/ontvangeracceptatie, onboarding/lifecycle, operationele projecties, modules/defaults, support en audit |
| `20261009121000_club_administration.sql` | Ontbrekende organisatie-/catalogusacties, minimale beheerprojecties, commissielidmaatschappen en gedeelde rapportbronnen |
| `20261009122000_administration_authority_fence.sql` | Tenantlock vóór bestaande private actieautorisatie, met behoud van de publieke SQL-invokerbindings en ACL |
| `20261009123000_admin_template_delivery.sql` | Onveranderlijke templateversies, preview/proef, werkelijk providerbewijs en publicatie |
| `20261009124000_admin_durable_commands.sql` | Duurzame voorbereide opdrachten en herstel van onbekende uitkomsten |

De migraties zijn additief. De bestaande stagingflow bewaart en vergelijkt de volledige oudere SQL-bytes en ontvangstbewijzen. De bekende voltooide versies met 31, 35 en 36 migraties worden exact herkend; onbekende of gewijzigde herkomst wordt geweigerd. Een approllback rolt de database niet terug.

## Bewijs en resterende controles

`implementation-inventory.json` houdt de uitgangssituatie, aansluiting en uitgevoerde acceptatie bij. Lokaal bewijs staat onder `docs/release/evidence/local/20261009-admin-native/`: 77 uitgevoerde native Supabase-OTP-browsercontroles, opgeslagen acties op twee sessies/apparaten, responsieve schermen en zes echte raceproeven met twee databaseverbindingen. Alle 55 SQL-testbestanden zijn uitgevoerd in een eigen PostgreSQL 17-database: 2.060 asserties, waaronder 448 beheerasserties, plus acht vaste bootstrapcontroles. De upgrades vanuit de exacte versies met 31, 35 en 36 migraties en een lege applicatiedatabase slagen; de oude geschiedenis en ontvangstbewijzen blijven behouden. Er zijn 801 JavaScript-tests uitgevoerd en 41 expliciet overgeslagen. Typecheck, productiebuild, lint en databaselint slagen. SQL-proeven gebruiken uitsluitend synthetische accounts in eigen wegwerpdatabases; zij gelden niet als mail- of fysieke-telefoonbewijs.

De bestaande GitHub-flow valideert op main, promoveert exact dezelfde groene commit naar staging, controleert de additieve upgrade met versleutelde custody en eigen restore, voert native provider/privacy/race-QA uit en activeert het immutable image via de bestaande selfhosted runner en rootbroker. De staging-SHA en readback worden pas als bewezen vastgelegd na een geslaagde uitvoering.

Open controles blijven expliciet: de benoeming van het eerste persoonlijke platformaccount, de live staging-readback van deze beheeruitbreiding, de fysieke Samsung S24-acceptatie en Sportlinks nog onbevestigde betekenis van `duur` (F038). Een ontbrekende duur wordt niet gebruikt om wedstrijdeindtijden te verzinnen.
