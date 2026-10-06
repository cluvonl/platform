# Cluvo V1 — implementatiebord

Actuele aanvulling van 6 oktober 2026: [W00/W01 lokaal deelbewijs](evidence/local/20261006-w01/verification.md), [W02 persoonlijke/begeleide intake](evidence/local/20261006-w02/verification.md), [huishouddossier en uitnodiging](evidence/local/20261006-w02-dossier/verification.md), [versioned uitnodigingscommands](evidence/local/20261006-w02-invitation-commands/verification.md), [werkelijk uitgerolde stagingtussenrelease](evidence/staging/20261006-e0d35d7/readback.json) en [volledige 219-functiematrix](function-coverage/function-matrix.json). Staging draait nog in prototype-modus; de veilige beheerroute voor de aangesloten app blijft nodig. Het onderstaande register bewaart de historische capture van 2 oktober. De volledige V1-acceptatie blijft OPEN.

Laatst bijgewerkt: 2 oktober 2026 (`Europe/Amsterdam`)

## Bron en statusregels

Dit bord volgt de releasecanon V1.0, `docs/01_CANON_EN_GAPANALYSE.md` en
`docs/02_ACCEPTATIE_EN_WERKPAKKETTEN.md`. De machineleesbare bron voor de
acceptatiestatus is het
[acceptatieregister](../../release/acceptance-register.json). Bij afwijking is
dat register leidend.

- `OPEN`: nog geen volledig uitgevoerd en geregistreerd bewijs.
- `BEZIG`: implementatie of lokaal bewijs is onderweg, maar acceptatie blijft
  open.
- `GEBLOKKEERD`: vereist een externe toegang, inrichting of beslissing.
- `GESLAAGD`: alleen na bewijs met bron-SHA, migratieversie, fixture, omgeving,
  waargenomen resultaat en artefactverwijzing.
- Bewijslagen: `D` = domein/database, `R` = negatieve rechten/isolatie, `I` =
  integratie/job en `E` = browserroute met serverreadback.

De huidige releasewaarde is `v1_ready=false`. Alle A01–A30 zijn `OPEN`.
Prototypegedrag, screenshots, een geschreven test of een lokale toast maken een
acceptatie-ID niet geslaagd.

## Werkpakketten

| Prioriteit | WP | Canon / verplichte voorstellen | Acceptatie-ID's volgens register | Bewijsuitkomst en eerstvolgende gate | Status |
|---|---|---|---|---|---|
| P0 | WP0 — overdracht en reproduceerbare start | H14 en releasevoorwaarden; geen functionele canonproef | Geen; WP0 mag geen A-ID sluiten | Import/provenance, installatie, lint/typecheck/tests/build, HTTP-readback, productiegates en visuele baseline zijn lokaal vastgelegd in [v1-evidence.md](v1-evidence.md). Een echte remote stagingdeploy ontbreekt. | Lokaal geverifieerd; extern geblokkeerd |
| P0 | WP1 — basis, tenant en echte toegang | H02, H03, H14; voorstel 03; G01; B01–B02 | A08 (gedeeld met WP2), A11, A25 (gedeeld met WP6/WP7) | Tenantkern, persoonlijke OTP-route, account-persoonkoppeling, acht rollen, scopes, geforceerde RLS en private Storage-policies zijn lokaal geïmplementeerd en deels negatief getest. Echte Auth/Storage/Realtime en staging ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P1 | WP2 — huishouden, uitnodiging en persoonlijke intake | H03; voorstel 02 en 21; G02; B04–B05 | A07, A08, A09, A10, A29 | Dossier, persoonlijke intake, invitation-tokenhash, acceptatie en gescheiden-ouderprivacy hebben lokale commands/tests. A10-huishoudsplitsing en de A29-telefoonketen hebben lokaal D/R-deelbewijs; echte Auth-sessies, cross-tenant stagingreadback en browserbewijs ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P1 | WP3 — verplichting, urenbasis, erkende rollen en besluit | H04, H12, H14; voorstellen 01, 22 en 24; G03/G13 | A01, A02, A03, A04, A05, A06, A26 | Minutenledger, doelen, winterallocatie, vrijstelling zonder fictieve uren, uitzonderingsbesluit en financiële blockers zijn lokaal gemodelleerd/getest. Browser- en stagingbewijs ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P1 | WP4 — catalogus, markt, planbord en veilige boeking | H05–H06; voorstellen 04, 08, 09, 11 en 13; G04–G05 | A07, A13, A16, A17, A27 | Catalogus, stabiele positions, servervalidatie en atomaire boeking bestaan; A13 heeft een echte lokale tweesessierace. A16 draft-planbord en A17 batchpublicatie/preview/apply hebben lokaal D-bewijs. Dag/week/maand- en mobiele browserroutes, buddy/minimum-ervaren bezetting en stagingbewijs blijven open. | BEZIG — lokaal D/I-deelbewijs |
| P1 | WP5 — uitvoering, winterplaatsing, ruil en herstel | H04, H07; voorstellen 01, 08, 10, 21 en 22; G06 | A01, A03, A04, A14, A15, A27, A29 | Attendance→ledger, deadline-snapshot, uitzonderingen, overname/ruil en wachtlijstmodellen hebben lokaal deelbewijs. A29 heeft een atomaire telefoonboeking en append-only correctiehistorie met lokaal D/R-bewijs. Volledige browserroutes en integratiejobs ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P2 | WP6 — commissies, kanban, teamouders en acties | H08; voorstellen 15–18; G07–G08 | A12, A24, A25 | Gescopeerde commissies, kaarten, relaties, mentions en actions zijn lokaal gemodelleerd; teamtaakmandaten zijn gedeeltelijk getest. Realtime/Storage/browser ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P2 | WP7 — Sportlink, wedstrijdplanning en jaaragenda | H06, H09; voorstellen 05–07 en 16; G09–G10 | A18, A19, A25 | Provider-run-, wedstrijd-, impact- en agendaschema plus DST/dedupe-invarianten bestaan. Er is geen echte Sportlink/CSV-adapterrun of schedulerbewijs. | BEZIG — lokaal D/R-deelbewijs |
| P2 | WP8 — communicatie, beleid en notificaties | H10–H11; voorstellen 18, 25 en 26; G11–G12 | A17, A20, A21, A22, A23, A24 | Outbox/inbox, dedupe/daglimiet, templates, providerstatus en beleidsversies hebben lokale tests. A17 bewijst lokaal uitsluitend database→intent→queued outbox; worker-/provideraflevering en echte mail/push/webhook/job/browserproeven ontbreken. | BEZIG — lokaal D/R/I-deelbewijs |
| P2 | WP9 — afrekening en vrijwilligerspot | H12; voorstellen 23–24; G13 | A06, A26 | Centenberekening, blockers, twee beoordelaars, bezwaar, betaling en correctiehistorie zijn lokaal afgeschermd/getest. Financiële integratie en browserbewijs ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P3 | WP10 — waardering, ontwikkeling en functies | H05, H13; voorstellen 09, 11–14, 19–20; G14 | A27, A28 | Kwalificaties, belangstelling, workload en ontdubbelde waarderingsregels hebben lokaal deelbewijs. Operationele rule-runner en volledige routes ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P3 | WP11 — dashboards, rapportages en seizoenscyclus | H13–H14; voorstellen 02, 13–14 en 27–28; G15 | A10, A27, A30 | Seizoenssnapshot/rollover, rapportagegrondslag en de A10-basisinvarianten voor huishoudsplitsing zijn lokaal gemodelleerd/getest. Clubaggregaatreadback, operationele export/job en rolgerichte browserroutes ontbreken. | BEZIG — lokaal D/R-deelbewijs |
| P4 | WP12 — volledige releaseproef en stagingvrijgave | H15–H18; alle 28 voorstellen | A01–A30 | Vereist nog de volledige browserketen, echte providers, remote staging, backup/restore/rollback en expliciete acceptatie. Exact bewezen artifact kan daarna pas afzonderlijk voor productie worden voorgedragen. | GEBLOKKEERD — externe staging/inrichting |

## Acceptatiematrix — traceerbare statussnapshot

Scenario en verwachte uitkomst staan volledig in het
[acceptatieregister](../../release/acceptance-register.json). Deze tabel legt de
WP- en bewijslaagkoppeling vast zonder een onuitgevoerde proef als gereed te
markeren.

| ID | WP(s) | Bewijs | Status |
|---|---:|---|---|
| A01 | 3, 5 | D, E | OPEN |
| A02 | 3 | D, E | OPEN |
| A03 | 3, 5 | D, E | OPEN |
| A04 | 3, 5 | D, E | OPEN |
| A05 | 3 | D, R, E | OPEN |
| A06 | 3, 9 | D, E | OPEN |
| A07 | 2, 4 | D, R, E | OPEN |
| A08 | 1, 2 | R, E | OPEN |
| A09 | 2 | R, E | OPEN |
| A10 | 2, 11 | D, R, E | OPEN |
| A11 | 1 | I, R, E | OPEN |
| A12 | 6 | D, R, E | OPEN |
| A13 | 4 | D, I, E | OPEN |
| A14 | 5 | D, I, E | OPEN |
| A15 | 5 | D, E | OPEN |
| A16 | 4 | D, E | OPEN |
| A17 | 4, 8 | D, I, E | OPEN |
| A18 | 7 | I, R, E | OPEN |
| A19 | 7 | I, E | OPEN |
| A20 | 8 | D, I, E | OPEN |
| A21 | 8 | D, I, E | OPEN |
| A22 | 8 | D, R, E | OPEN |
| A23 | 8 | D, E | OPEN |
| A24 | 6, 8 | D, R, E | OPEN |
| A25 | 1, 6, 7 | D, R, E | OPEN |
| A26 | 3, 9 | D, R, I, E | OPEN |
| A27 | 4, 5, 10, 11 | D, I, E | OPEN |
| A28 | 10 | D, I, R, E | OPEN |
| A29 | 2, 5 | D, R, E | OPEN |
| A30 | 11 | D, I, E | OPEN |

## Actieve externe blokkades en gates

| Benodigd | Effect | Wat zonder deze invoer wel kan |
|---|---|---|
| Private GitHub-repository/remote, Actions en bevoegde stagingdeployidentiteit | Blokkeert bewijs van de echte `main`-naar-stagingstraat en herleidbare workflow-run. Er is lokaal geen remote geregistreerd. | Lokale implementatie, migraties en tests voorbereiden; geen stagingclaim. |
| Staginghost of VPS, domein/TLS en runner-/brokerinrichting | Blokkeert remote HTTP-readback, containerdeploy, rollback- en operationeel bewijs. | Lokale standalone-/containerchecks uitvoeren. |
| Afzonderlijk Supabase-stagingproject en veilige secretinrichting | Blokkeert echte Auth-OTP, database, RLS, Storage, Realtime, migraties en WP1-acceptatie. | Schema/migraties en lokale wegwerptests bouwen; geen werkende backend claimen. |
| Staging-e-mail/OTP-provider en toegestane testontvangers | Blokkeert providerbewijs voor A11 en later A20–A23. | Adapter en mailopvang/allowlist voorbereiden; geen aflevering claimen. |
| Sportlinkcontract/velden, ledenbron, push- en overige providerinrichting | Blokkeert de bijbehorende live-integratieproeven in latere werkpakketten. | Adapters, contracttests, fixtures en foutpaden bouwen. |
| Werkelijke seizoensdata, beheerders, beoordelaarsmandaten, doelgroepen en beleidsdocumenten | Blokkeert volledige clubinrichting en uiteindelijke stagingacceptatie. | Configureerbare modellen en synthetische fixtures gebruiken. |
| Volledige A01–A30, herstelproef en expliciet akkoord van Danny | Blokkeert productie terecht. `v1_ready` en `production_enabled` blijven `false`; er is geen actieve productieworkflow. | Uitsluitend lokaal en op staging verder bouwen. |

Vraag credentials niet in chat en leg ze niet vast in bewijs, fixtures of Git.
