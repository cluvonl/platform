# Uitgevoerde controles bij deze overdracht

Datum: 2 oktober 2026. Dit verslag betreft het overdrachtspakket en de Next.js-startbasis. Het is geen V1-productieacceptatie.

| Controle | Resultaat |
|---|---|
| Actuele canon | Volledige actuele Library-versie gelezen; 18 pagina's; bronbestand van 58.894 bytes |
| Herkomst prototype | Schone lokale Git-bron, commit `5d96234ade7dba5f79bdd0f4ddbc21e26fc13801`; gepubliceerde versie 1 |
| Referentie-export | Git-archief van de exacte commit; bestandshashes gecontroleerd bij pakketvalidatie |
| Overzetting naar Next.js | Gewone Next.js 16.3.8, zonder Vinext-, Cloudflare- of Sites-runtime; oorspronkelijke schermcode en CSS behouden |
| Afhankelijkheden | Installatie geslaagd; vastgepinde directe versies en een nieuwe `package-lock.json` |
| TypeScript | `tsc --noEmit` geslaagd |
| Unit- en gateproeven | 11 tests geslaagd: 8 voor uren, bedragen en invarianten en 3 voor runtimeblokkades |
| Next.js-build | `next build --webpack` succesvol op Node 24.19.0; routes en standalone-output gegenereerd |
| SSR-rooktest | Gebouwde standalone-app: HTTP 200 voor de root met Cluvo-UI, het logo en het manifest |
| Liveness | `/api/health/live` geeft 200 met staging/prototype en de verwachte bron-SHA |
| Backend readiness | `/api/health/ready` geeft zoals bedoeld 503: de echte backend ontbreekt |
| Niet-ingestelde Supabase-configuratie | `/api/runtime-config` geeft zoals bedoeld 503; voor de demo zijn geen credentials nodig |
| Productiereleasegate | `check-release.mjs` weigert met exitcode 1 |
| Opstartgate | De Node-preload weigert vóór de serverstart productie, onbekende omgevingen en de nog niet gebouwde appmodus |
| Deploytemplates | YAML-structuur, main/staging-event, opt-in-gate, het ontbreken van een actieve productieworkflow, Bash-syntax en ongeldige invoer getest |
| Onafhankelijke review | Canon/gapanalyse, datamodel/rechten en deploytemplates afzonderlijk gereviewd |

## Niet uitgevoerd en niet als werkend geclaimd

- In deze uitvoeromgeving is geen Docker Engine beschikbaar. Het bouwen van het image, Compose, Caddy en de VPS-broker zijn niet op een echte host getest. De gewone Next.js standalone-build en de HTTP-rooktest zijn wel uitgevoerd.
- Er is geen GitHub-repository of Actions-run aangemaakt. De workflowtemplates zijn niet daadwerkelijk op een self-hosted runner uitgevoerd.
- Er is geen Supabase-project verbonden en geen SQL-migratie toegepast. Er zijn geen database-, RLS-, advisor- of concurrencytests uitgevoerd. Het meegeleverde schema is een ontwerp; de serverhelpers zijn alleen op typen gecontroleerd.
- Er is geen provider voor OTP, e-mail, push, Sportlink of betalingen aangeroepen. Integratiedata blijft voorbeelddata.
- Er is geen productieomgeving aangemaakt of gepubliceerd. Het oorspronkelijke Sites-prototype is niet gewijzigd.
- De bestaande prototype-UI was in de voorafgaande bouwronde gecontroleerd op desktop, mobiel en kernflows. De overzetting behoudt die bron. Een volledige browserregressie onder echte Next.js/Supabase is een gate voor het werkpakket; die is hier niet als bewijs van een werkende backend opgevoerd.

## Open acceptatiestatus

Alle A01–A30 staan in `release/acceptance-register.json` op OPEN. De elf startertests bewijzen een beperkte set losse reken- en opstartregels. Ze vervangen geen transactionele, RLS- of E2E-proeven van Cluvo V1. Wijzig een acceptatiestatus pas na werkelijk uitgevoerd bewijs op de juiste broncommit en stagingomgeving.

## Bij een volgende wijziging

Test de relevante risico's opnieuw en voer de verplichte releasegates uit. Behoud de bronhash, runtimeversies en bewijsverwijzingen. Een latere geslaagde build mag eerdere, onbewezen databaseaannames niet stilzwijgend op GOEDGEKEURD zetten.
