# 6 oktober 2026 — persoonlijke en begeleide intake

Dit is lokaal deelbewijs voor W02. De V1-scope blijft 23 pagina's, 219 functies,
102 criteria, alle 28 aanvullingen en A01–A30. Geen acceptatiestatus is gesloten;
`v1_ready=false` en `production_enabled=false` blijven gelden.

## Bron en gedrag

De wijziging is gebouwd bovenop `72f4a76d9d7361eac5d8fd8d78350fe9d0efff75`.
[Het manifest](capture-manifest.json) legt de exacte bronbestanden, migraties en
beelden met SHA-256 vast, zodat het bewijs aan de volgende commit kan worden
getoetst. De oorspronkelijke acht migraties en prototypebron zijn behouden.
Dependencies en lockfile zijn ongewijzigd.

De persoonlijke intake volgt de vier Club Signal-stappen: Over jou, Talenten,
Beschikbaarheid en Afronden. Alleen expliciet opslaan schrijft een nieuwe
immutable antwoordrevisie. De server bepaalt actor, dossier en vertegenwoordigde
persoon via de geverifieerde werkruimte, RLS en een expliciete machtiging. Bij
begeleid invullen is een reden verplicht. Een minimale namenprojectie geeft
alleen reeds toegestane intakecontexten terug; zij opent geen brede personentabel.
Intrekking blokkeert lezen, schrijven én replay van een eerder command.

De antwoorden ondersteunen getypeerde keuzelijsten, buddywens, reservebereidheid
en gewenste maandinzet in gehele minuten. Leeg blijft null; nul blijft nul.
Oude tekstvelden blijven leesbaar en onbekende bestaande keuzes blijven zichtbaar.
Een talentkeuze is geen kwalificatiebewijs. De maandwens wijzigt geen seizoensdoel,
vrijstelling of ledger. De bestaande seizoenswens wordt serverzijdig behouden.

Echte verhinderdatums worden met de tenanttijdzone naar de bestaande eligibility-
gegevens geprojecteerd. Zomer- en wintertijd leveren juiste daggrenzen. Wissen
verwijdert uitsluitend perioden uit deze intakebron; handmatige perioden,
andere dossiercontexten, boekingen en antwoordhistorie blijven behouden.
Opslaan en boeken vergrendelen dezelfde uitvoerder, zodat een nieuwe boeking
geen ondertussen opgeslagen verhindering passeert.

Een formulier bewaart de versie waarop zijn draft is gestart. Een focus-refresh
verhoogt die versie niet. Een conflict overschrijft geen nieuwere antwoorden;
een netwerkfout behoudt draft en idempotencykey. Alleen bevestigde opslag geeft
nieuwe retrygegevens terug. Er wordt geen persoonlijke intaketekst in audit-
events of bewijsexports opgenomen.

## Uitgevoerd bewijs

| Controle | Waargenomen resultaat |
|---|---|
| `npm run check` | PASS: lint, typecheck, 26 Node-tests, production build, 5 WP0-contracttests en standalone HTTP-smoke |
| Upgrade acht naar negen migraties | PASS: lokale reset naar `20261006180000`, daarna `migration up --local`; 11 pgTAP-bestanden, 540 asserties |
| Lege installatie | PASS: negen migraties via lokale reset; dezelfde 540 asserties |
| Nieuwe intake-databaseproef | 65 asserties: vorm/minuten/datumgrenzen, legacy, RLS/privacy, audit, stale versie, retry/conflict, bronnen, expliciete hulp en intrekking |
| Database-lint app/api/internal | PASS: geen warnings of schemafouten |
| Productiegate | Verwachte weigering: `check:release` exit 1; V1 is niet vrijgegeven |
| Laatste plaats, twee sessies | PASS: één persisted booking, één `CAPACITY_FULL` |
| Seizoen/ledger, twee sessies | PASS: de tweede sessie wachtte 3002 ms |
| Intakeverhindering/boeking, twee sessies | PASS: 2926 ms wachten, `NOT_ELIGIBLE`, nul nieuwe boekingen en één intakebronperiode |
| Bestaande W01-browserketen op deze build | PASS: 14 controles; [resultaat](w01-regression/browser-results.json) |
| Intake via echte lokale OTP-sessies | PASS: 22 controles; [resultaat en SQL-readback](browser-results.json) |
| Backup/restore | PASS: 142 app-tabellen gelijk in aantal én inhoudsdigest; [resultaat](restore-results.json) |
| Visuele vergelijking | 12 referentie/app-paren plus 13 regressiecaptures; alle paren laden en overlay/opacity werken; [vergelijking](compare.html) |

De inventaris is negen migraties, 142 applicatietabellen, 54 API-functiedefinities
en 20 API-views. Alle 142 app-tabellen forceren RLS. De API bevat geen SECURITY
DEFINER-functies; private commands gebruiken `cluvo_command_owner` zonder
superuser of BYPASSRLS, met een lege search_path. Rechtstreekse clientwrites
naar intakeantwoorden of beschikbaarheidsprojecties zijn geweigerd.

De browser bewijst twee aparte ouderaccounts, herladen en een tweede touchdevice,
ongeldige datum zonder draftverlies, nul versus 90 maandminuten, stale tabs na
focus-refresh, netwerkfout/retry, directe vreemde dossier-URL en getamperde
serveractie. Eigen verhindering blokkeert een nieuwe booking; de andere ouder
kan dezelfde plek boeken. Expliciete telefoonhulp schrijft actor A, persoon B en
reden; intrekking sluit beide routes. De oorspronkelijke booking, doel van
720 minuten en bevestigde ledger van 60 minuten blijven behouden.

De fixture bevat alleen synthetische `example.test`-accounts. OTP's, Auth-cookies
en tokens blijven in geheugen of private lokale runtimebestanden. De full-DB-
backup staat privaat buiten Git. Restore is uitgevoerd op een nieuwe database
in dezelfde geïsoleerde cluster, met bestaande clusterrollen en oorspronkelijke
function owners/grants. De herstelde geauthenticeerde account A leest versie 4,
90 maandminuten, drie uitlegvoorkeuren en drie eigen verhinderdatums; na ingetrokken
hulp blijft precies één toegestane intakecontext over. Een onafhankelijke host,
Storage-objectbinaries en stagingherstel zijn hiermee niet bewezen.

## Reproduceren en grenzen

Gebruik uitsluitend de lokale wegwerpstack. Databasechecks horen vóór het
persistente browserseed. Na `node scripts/seed-local-browser.mjs` loopt eerst
`scripts/browser-w01.mjs` met een aparte W02-bewijsbestemming, daarna
`scripts/browser-w02.mjs`. Respecteer de OTP-cooldown tussen sessies. Een herhaling
op reeds gemuteerde fixtures is geen schone proef. Playwright 1.63.0 wordt via
`PLAYWRIGHT_MODULE` uit een aparte gepinde toolchain gebruikt; geen dependency
is aan de app toegevoegd. De standalone app draait lokaal op 3200 en de
ongewijzigde referentiewerkcopy op 3201. De concurrencyscript is begrensd tot de
lokale database op 55322; CI en staging voeren dit als extra gate uit.

De vierstappencaptures zijn na de proef opnieuw zonder mutaties gemaakt van
serverrevisie 4, met scrollpositie nul. Zij tonen dus de bevestigde 90-minutenwens;
de nulwaarde is apart functioneel bewezen. De referentie heeft een andere
voorbeeldpersoon en zes categorieën; de testclub heeft één echte categorie.
Dit is visueel deelbewijs, geen volledig V23-akkoord.

De vorige stagingrelease is werkelijk uitgerold en teruggelezen:
[bron 72f4a76](../../staging/20261006-72f4a76/readback.json). Zij draait nog in
prototype-modus: live 200, ready 503, database niet aangesloten en workers niet
gestart. Dit bewijst de artifact-/deploystraat, geen appfunctionaliteit op staging.
De veilige VPS-/Supabase-beheerroute blijft nodig voor remote migraties, echte
Auth/Storage/Realtime, allowlist en operationele gates.

W02 is nog niet volledig afgerond: huishouddossiertabs, nieuwe dossiers,
uitnodiging en accountacceptatie, beheer van machtigingen, grondslag/besluit,
import-/splitsroutes en jaarlijkse herbevestiging blijven in de volledige scope.
Ook W03–W11 en de volledige stagingreleaseproef blijven open.
