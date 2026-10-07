# 7 oktober 2026 — intakehulp beheren, lokaal deelbewijs

Deze bewijsset hoort bij de nog ongepubliceerde zestiende migratie en de nieuwe
beheerroute voor intakehulp. Zij bevat **133 verschillende geslaagde
browsercontroles**, 856 geslaagde SQL-asserties, 18 echte tweesessieraces,
een gevulde upgrade en een volledige private lokale backup/restore na de
definitieve UI-proef.

De 105 bestaande regressiecontroles horen bij standalonebuild
`yV9pfW6gnUW3qIaEFbYU9`. De 28 intakehulpcontroles zijn na de Club Signal-
veldstylingcorrectie uitgevoerd op `17e-qJQv9kTRgLesp3UKZ`; de zes betrokken
appbronhashes komen overeen met die build. De eerdere 28 intakehulpcontroles
en ongeslaagde voorbereidende pogingen zijn niet als extra verschillende
geslaagde controles geteld. Lint, types, 45 Node-tests, Next.js standalone,
WP0-smoke en database-lint zijn geslaagd; de productiepoort gaf de verwachte
weigering met exitcode 1.

[final-validation.json](final-validation.json) is de actuele lokale
deelbewijscapture; zij geeft geen staging- of V1-acceptatie. De oudere
[draft-validation.json](draft-validation.json) en `assistance-ui/` blijven
historisch behouden, inclusief de toen vastgelegde 90 browsercontroles en
de oorspronkelijke vastlegging van het stijlprobleem.

## Werkelijke wijziging

Een bevoegd commissielid met dossiergebonden `household.review` kan een concrete
hulpverlener kiezen voor één persoonlijke intake en de machtiging met reden en
eindmoment vastleggen. De route geeft alleen minimale personen-, dossier- en
machtigingscontext terug. Intakeantwoorden, hulpredenen en Auth-identifiers
worden niet in deze beheerprojectie opgenomen. Een huishouden-, ouder- of
leeftijdskoppeling verleent zelf geen toegang tot een andere persoonlijke intake.

Verlenen en intrekken gebruiken de actuele native sessie, echte actor,
vertegenwoordigde persoon, dossier- en machtigingsversies, idempotencykey en
append-only besluit/audit. Na wachten op een lock worden de relevante actuele
rechten opnieuw gecontroleerd. De versie wordt vooruit gebracht; historische
besluiten en antwoordrevisies worden behouden. Een verloren succesvolle response
kan met dezelfde vastgezette opdracht worden herhaald.

De nieuwe migratie voegt één tabel met geforceerde RLS en de restrictieve native
sessievoorwaarde toe. Twee nieuwe private commands gebruiken dezelfde native
guard; alle vijftien gepubliceerde migraties blijven bytegelijk. Deze beheeractie
wijzigt geen verplichting, urendoel, ledger of boekingsrecht.

## Uitgevoerd lokaal bewijs

- Lege wegwerpdatabase met zestien migraties: **856 asserties in achttien
  bestanden** geslaagd. De bestaande native-autoriteitsinventaris en 46 nieuwe
  intakehulpasserties controleren onder andere tenant- en persoonsprivacy,
  beperkte beheerprojecties, versies, idempotency, immutable besluiten en
  weigering zonder actuele native sessie.
- **105 bestaande browsercontroles** opnieuw uitgevoerd: 29 dossier/uitnodiging,
  14 account/boeking, 22 intake, 18 jaarlijkse controle, zeven geladen
  sessie/verloren-responsecontroles en vijftien native intrekkingscontroles.
  Deze gebruiken echte lokale OTP's en serveracties; SQL-sessiecontexten zijn
  daarvan een afzonderlijke bewijsvorm.
- **28 aanvullende intakehulpcontroles op de definitieve build** gebruiken echte lokale ouder- en
  coördinatorsessies. Een ouder kan zich geen hulp verlenen; een geladen
  commissieformulier autoriseert de actuele actor opnieuw. Verlenen en intrekken
  vereisen bewuste bevestiging en reden. Werkelijk na serververwerking afgebroken
  responses kunnen exact worden herhaald zonder tweede besluit, audit of command.
  Een veranderd verzoek met dezelfde key en verouderde versies worden geweigerd.
- De toegestane helper slaat daadwerkelijk één revisie voor de gekozen persoon
  op met aparte actor, subject en reden. Na intrekken weigeren zowel het reeds
  geladen formulier als de oude ondertekende REST-token toegang tot diens
  antwoorden. Native lokale sign-out sluit ook de beheercontext en geladen
  beheeractie af. Beide ouders behouden hun eigen onafhankelijke intake.
- **18 tweesessieraces** geslaagd: laatste plaats, seizoenssluiting/ledger,
  intakeverhindering/boeking, vijf uitnodigingsraces, vijf jaarlijkse races en
  vijf intakehulpraces. De nieuwe races controleren dezelfde key, concurrerende
  dossierversies, ingetrokken commissie- of native rechten na werkelijk wachten
  en intrekken tegenover opslaan door een helper. Er blijft geen onafgerond
  commandrecord of ongeoorloofde revisie over.
- [De gevulde upgrade](upgrade-results.json) herstelt een gecontroleerde
  vijftien-migratiebackup en past de exacte nieuwe SQL-migratie toe. Alle
  oorspronkelijke kolommen en digests van 143 tabellen blijven gelijk; bestaande
  machtigingen krijgen versie 1. De 192 bestaande API-/internalfuncties en de
  53 oorspronkelijke bewaakte commandbodies blijven behouden. Daarna zijn er
  144 tabellen en twee aanvullende bewaakte commands.
- [De private lokale restore na de UI-proef](restore-ui-results.json) bewijst 144 gelijke
  tabellen/digests, 144 restrictieve native policies, 55 bewaakte commands,
  invoker-API en een command-eigenaar zonder superuser of BYPASSRLS. De herstelde
  actuele sessie geeft eigen dossier-, intake- en jaarlijkse context; andere
  oudergegevens blijven verborgen. Verwijderen van die sessie in een
  teruggedraaide hersteltransactie weigert persoonlijke toegang en een command.
  Acht historische hulpbesluiten, waaronder vier verleningen en vier
  intrekkingen, zijn behouden; er is geen actieve helpermachtiging over.
  UPDATE en DELETE van die besluiten zijn daadwerkelijk geweigerd in de
  herstelde database. De eerdere [restorecapture](restore-results.json) blijft
  behouden. De nieuwe backup blijft privé buiten Git met modus `0600`;
  Storage-binaries en een onafhankelijke host zijn niet gecontroleerd.
- **124 bewaarde appbeelden**: 70 eerdere regressiebeelden, 27 oorspronkelijke
  intakehulpbeelden en 27 nieuwe beelden van negen intakehulptoestanden op
  390, 768 en 1440 pixels. De nieuwe browsercontrole vond geen horizontale
  overflow of hydration mismatch. Achttien afzonderlijke stylecaptures meten
  de veldbreedte, labels, padding, borders, checkbox en terugknop in zes
  beheertoestanden; zij verhogen het functionele scenarioaantal niet.
  [De finale handmatige controle](assistance-ui-final/manual-ui-review.md)
  bevestigt de bestaande Club Signal-kaarten, navigatie en mobiele variant.
  De oorspronkelijke prototypebron is niet gewijzigd. De checkbox wordt na
  een actionpoging bewust opnieuw bevestigd; key, versies en absoluut eindmoment
  blijven bij de werkelijk uitgevoerde exacte retries gelijk.

De JSON-resultaten exporteren aantallen, booleans en digests. Native session-ID's,
OTP's, tokens, cookies, geheime sleutels en private request bodies zijn niet
geëxporteerd. De inventaris hashte uitsluitend featurebron en veilige artefacten;
runtimeconfiguratie, stagingcredentials en losse opswijzigingen zijn geen
onderdeel van het featurebronbewijs.

## Nog vereist

De aangepaste Club Signal-velden en lokale hersteltoestand zijn daadwerkelijk
gecontroleerd. De bijgewerkte functiematrix bevat alle 219 functies en 102 OPEN
criteria, met zestien migraties en 144 tabellen. De jaarlijkse route heeft ook
de eigen `P23.F06`-mapping; dat sluit geen functieacceptatie.

Exact-commit CI, vertrouwde stagingpromotie, deploy en HTTP-readback ontbreken
nog voor deze ongepubliceerde feature. Het reeds uitgevoerde
[readback van `3168a4d`](../../staging/20261007-3168a4d/readback.json) bewijst
afzonderlijk de prototype-image en vijftien gepubliceerde migratiehashes.
De lege remote Cluvo-schemastand in dat bestand komt uit de eerdere read-only
credentialcontrole; het is geen nieuwe databaseobservatie tijdens dat readback.

Lokale proeven bewijzen geen aangesloten stagingdatabase, live SMTP-bezorging,
workerketen, Realtime, Storage of volledige W02/V1-acceptatie. Alle 28 aanvullingen,
A01–A30, 219 functies en 102 acceptatiecriteria blijven in scope; geen criterium
is gesloten. `staging_verified=false`, `release_ready=false`, `v1_ready=false`
en `production_enabled=false`.
