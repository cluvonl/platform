# Besluiten en nog benodigde invoer

## Vastgelegd door de gebruiker

- Merk Cluvo, Design 1 — Club Signal.
- De volledige V1-canon, inclusief alle 28 voorstellen; 12 uur met een winterdoel van 50%.
- Huishoudvrijstelling door een configureerbare vaste functie en onafhankelijke persoonlijke intakes.
- Inloggen met een persoonlijk e-mailadres en OTP; Sportlink-wedstrijden tweemaal daags synchroniseren.
- Voorkeur voor Next.js en Supabase.
- `main` → staging; productie uitsluitend later, wanneer V1 gereed is.

## Technische keuzes in dit pakket

Deze keuzes zijn concrete implementatievoorstellen; de infrastructuur is hiermee nog niet ingericht: één Next.js App Router-app, een standaard Supabase Postgres-project per omgeving, meerdere tenants in één database per omgeving met RLS, private Storage, servermutaties met een outboxworker, GitHub-hosted builds, Docker standalone op een VPS, private GHCR-images en een dedicated deployrunner.

Zo blijft uitrol naar meerdere verenigingen mogelijk. Abonnementspakketten en een marketingwebsite vallen buiten de huidige gevraagde V1; tenantisolatie en clubinstellingen horen wel bij de basis.

## Nog nodig om staging daadwerkelijk in te richten

| Gegeven | Waarom | Intussen mogelijk |
|---|---|---|
| Doelrepository en organisatie op GitHub | Broncode, branchbescherming, Actions en GHCR | Lokaal bouwen en testen met Next.js en Supabase |
| Stagingdomein en DNS-beheer | HTTPS en authenticatieredirects | Werken op localhost |
| VPS, OS en toegangsroute, of bestaande deployomgeving | Container, proxy en broker | Image bouwen in CI |
| Supabase-stagingproject of autorisatie om dit aan te maken | Database, Auth en Storage | Lokale Supabase-migraties |
| SMTP/e-mailprovider en afzenderdomein | OTP en functionele e-mail | Mailopvang of logdriver |
| Geautoriseerd Sportlink-contract en gegevenstoegang | Wedstrijden en beschikbare ledenvelden | Fixtures en gecontroleerde CSV-import |
| Wie V1-acceptatietests uitvoert en goedkeurt | Bewijs en releasebesluit | Volledige acceptatiematrix voorbereiden |

Ontbrekende infrastructuur is geen reden om het ontwerp, het overzetten van de broncode of lokale tests stil te leggen. Vraag gerichte invoer pas bij de concrete aansluitstap. Wacht met het activeren van een productiedomein, productieaccount of productieprovider tot afzonderlijke vrijgave.

## Administratieve invulpunten

| Invulpunt | Waarde |
|---|---|
| Repository | NOG_IN_TE_VULLEN |
| Stagingdomein | NOG_IN_TE_VULLEN |
| Staginghost | NOG_IN_TE_VULLEN |
| Supabase-projectreferentie voor staging | NOG_IN_TE_VULLEN |
| Providerafzender | NOG_IN_TE_VULLEN |
| Technisch beheerder | NOG_IN_TE_VULLEN |
| Verantwoordelijke voor V1-acceptatie | Danny Goldenbelt / nog aan te wijzen testgroep |
| Productiestatus | GEBLOKKEERD |

Sla geen secrets in dit document op.
