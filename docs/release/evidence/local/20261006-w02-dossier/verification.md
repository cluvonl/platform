# 6 oktober 2026 — huishouddossier en persoonlijke uitnodiging

Dit is lokaal W02-deelbewijs bovenop `b00024a43f8f98b8e960ba1e422c7dcc03969b06`.
De volledige V1-scope blijft 23 pagina’s, 219 functies, 102 criteria, alle
28 aanvullingen en A01–A30. Alle acceptatiestatussen blijven OPEN; productie
blijft geblokkeerd. Het bron- en capturemanifest legt de uiteindelijke bestanden
met SHA-256 vast. De negen gepubliceerde migraties, lockfile en oorspronkelijke
prototypebron zijn ongewijzigd.

## Gedrag en grenzen

Het eigen of expliciet toegestane huishouddossier is bereikbaar vanuit intake
en overzicht, als vier Club Signal-tabs en via `/c/[club]/huishouden`.
Overzicht leest de canonieke minutenstand van één gekozen seizoen. Personen
toont uitsluitend de eigen persoon of expliciet toegestane minimale namen;
intake-ID en status vragen afzonderlijke actuele intakebevoegdheid. Een gedeelde
voortgang opent geen andere ouder, geboortedatum, contactgegevens of antwoorden.
Identiteitskoppeling komt van de server en heeft geen demo-verificatietoggle.
Afspraken toont de actuele rechten en doelstand. Historie toont alleen toegestane
dossieracties, zonder globale auditpayload, redenen of actoridentiteiten.

De afzonderlijke read-RPC controleert tenantlidmaatschap en dossier-/actiebevoegdheid.
Ook directe URL’s, vreemde seizoens-ID’s, ingetrokken grants en een beperkte
beheerder worden negatief getest. De API-wrapper is SECURITY INVOKER; de interne
functie heeft een lege search_path en de bestaande eigenaar zonder superuser
of BYPASSRLS. Geen nieuwe brede tabellenprojectie is gepubliceerd.

De uitnodigingsactie controleert de mailontvanger vóór database/provider:
lokaal uitsluitend `@example.test`, op staging uitsluitend exacte adressen in
`MAIL_ALLOWLIST`. Wildcards, alias-afleiding en onbekende omgevingen zijn geweigerd.
Na een verloren actieantwoord blijven naam, e-mail, rechten en dezelfde
idempotencykey staan. Een reeds geregistreerde verzending stuurt geen tweede
mail. Niet-bevestigde aflevering krijgt een onzekere statusmelding.

Een werkelijk door lokale Supabase verzonden uitnodigingslink verifieert de
persoonlijke identiteit. Het server-only HMAC-token verdwijnt daarna uit de URL
naar een HttpOnly, SameSite=Strict-cookie met beperkt pad en één uur geldigheid.
Alle callbackredirects blijven op de gevalideerde APP_URL-origin; een interne
standalone-hostnaam mag de browser niet naar een andere cookie-origin sturen.
Secure volgt dezelfde gevalideerde APP_URL: lokale HTTP werkt ook met een production
build; staging vereist HTTPS en behoudt Secure. De juiste bevestigde e-mail kan
accepteren; een ander bevestigd account met hetzelfde token wordt geweigerd.
Acceptatie geeft alleen gekozen dossiergrants en een eigen persoonlijke intake,
zonder tweede verplichting of extra ledgeruren.

## Uitgevoerd bewijs

- `npm run check`: lint, typecheck, 28 Node-tests, Next.js production build,
  vijf WP0-contracttests en standalone HTTP-smoke geslaagd.
- Upgrade van negen naar tien migraties en lege database: 575 pgTAP-asserties
  in twaalf bestanden geslaagd. De dossieruitbreiding bevat 35 gerichte rechten-,
  privacy-, readback- en intrekkingstests. Zowel upgrade als lege database zijn
  opnieuw met de uiteindelijke testbron uitgevoerd en zonder waarschuwingen geslaagd.
- Database lint voor app/api/internal: geen waarschuwingen.
- De bestaande A13-proef houdt één boeking op de laatste plaats over; de verliezer
  krijgt CAPACITY_FULL. Seizoenslock en intake/boeking-lock blijven bewezen:
  wachten op commit, vervolgens NOT_ELIGIBLE en nul nieuwe boekingen voor de
  verhinderdatum.

- De lokale browserproef voor dossier en uitnodiging: 16 controles geslaagd,
  inclusief echte linkverificatie, juiste/verkeerde identiteit, verloren antwoord,
  minimale grants, persoonlijke intake en database-readback.
- De bestaande keten heeft 14 geslaagde account-/navigatiecontroles en de
  intakeketen 22 geslaagde controles. De afzonderlijke JSON-resultaten staan in
  `w01-regression/` en `intake-regression/`.
- Twaalf dossierbeeldparen zijn werkelijk geladen; overlay en opacity werken.
  Mobiele Personen-tabs voor ouder A en extra uitvoerder zijn visueel bekeken.
  Captures op 1440×1024, 390×844 en 768×1024 hebben geen horizontale overflow.

- Een volledige private PostgreSQL-backup is teruggezet in een nieuwe lokale
  database. Alle 142 applicatietabellen hebben identieke rijtellingen en
  gesorteerde JSON-digests. Geforceerde RLS, invoker-API en de beperkte eigenaar
  zijn behouden. Een authenticated ouder-A-readback ziet het eigen dossier,
  de geaccepteerde uitnodiging, 60 bevestigde minuten en uitsluitend de eigen intake.
  Het backupbestand met Auth-data blijft buiten Git; alleen hash en resultaten
  zijn vastgelegd. Onafhankelijke host, Storage-binaries en stagingrestore zijn
  nog niet bewezen.

De browser-, herstel- en beeldresultaten staan naast dit document.
Alle lokale accounts, e-mails en fixtures zijn synthetisch. Auth rate-limit-
processtatus is tussen suites lokaal opnieuw gestart; dit is geen A11-bewijs
voor providerlimieten of staging.

## Resterende V1-scope

Dit is geen volledige W02-acceptatie. Beheerderszoeken, aanmaken/importeren,
verificatie uit een ledenbron, machtigingenbeheer, formele aanvragen/besluiten,
splitsen/herstellen en jaarlijkse herbevestiging blijven open. De bestaande
bootstrap-uitnodigingscommands moeten nog worden uitgebreid met het volledige
versioned lifecycle-/auditcontract. Providerconcurrency, onbekende aflevering en
outboxverwerking blijven in W09. De dossierhistorie is nog beperkt.

De vorige tussenrelease is werkelijk uitgerold en teruggelezen op staging:
[bron b00024a](../../staging/20261006-b00024a/readback.json). Zij draait nog in
prototype-modus: live 200, ready 503, database niet aangesloten, workers niet
gestart. Dit bewijst de artifact-/deploystraat, geen aangesloten app op staging.
Een veilige VPS-/Supabase-beheerroute blijft nodig voor remote migraties,
providers, appconfiguratie en operationele bewijsvoering. W03–W11 en de volledige
stagingreleaseproef blijven onderdeel van het geautoriseerde werk.
