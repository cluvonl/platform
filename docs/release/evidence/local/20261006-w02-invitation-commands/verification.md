# 6 oktober 2026 — versie, identiteit en audit van uitnodigingen

Lokaal W02-deelbewijs bovenop `e0d35d756ae706473f8601b7042e9501f2db4db1`.
De volledige scope blijft 23 pagina’s, 219 functies, 102 criteria, alle 28
voorstellen en A01–A30. Geen acceptatiecriterium is gesloten; productie blijft
geblokkeerd. Tien gepubliceerde migraties en de lockfile blijven ongewijzigd.
De elfde migratie is een additive expand-stap.

## Gedrag

Aanmaken gebruikt de gelezen dossierversie. Dossierlock, idempotencyrecord,
uitgenodigde persoon, invitation, nieuwe dossierversie, audit en event worden
transactioneel vastgelegd. Een exacte replay werkt na de versieophoging;
een andere payload met dezelfde key wordt geweigerd. Een nieuwe mutatie met
een verouderde versie wordt geweigerd. De browser bevriest versie én key
bij de oorspronkelijke invoer, ook wanneer servergegevens verversen.

Verzendregistratie gebruikt een actuele invitationversie en een afzonderlijke
commandkey. De oorspronkelijke actor moet nog een actieve membership en het
uitnodigingsrecht hebben. Actor, dossier, verwachte/nieuwe versie, uitkomst,
commandkey, audit en event worden in dezelfde transactie vastgelegd.
Dit is registratie van provideracceptatie; daadwerkelijke aflevering is nog
geen bewezen uitkomst.

Vóór acceptatie ziet alleen de juiste bevestigde e-mailidentiteit het minimale
dossierlabel en de aangeboden voortgangs-/boekingsrechten. De Auth-status wordt
gelezen via een private, parameterloze predicate met een lege search_path,
gebonden SQL-referenties, minimale kolomgrants en een own-subject RLS-policy.
De command-eigenaar blijft NOSUPERUSER/NOBYPASSRLS en ziet uitsluitend het
huidige Auth-subject. De browserrol krijgt geen Auth-tabel- of helpertoegang.
Native Auth-RLS blijft ingeschakeld. Startup en lege database zijn werkelijk getest.

Acceptatie controleert de geverifieerde identiteit, token, expiry, actuele
uitnodigingsbevoegdheid van de afzender, invitationversie en commandkey.
Dossierlock gaat vóór invitationlock. De bestaande domeinkernel maakt uitsluitend
de afgesproken grants en één eigen persoonlijke intake. De aanvullende command
legt versie/key/audit/event vast. Na acceptatie vraagt replay de nog geldige
eigen koppeling en dossiermachtiging; intrekking wordt niet hersteld door retry.

Na een verloren acceptatieantwoord blijven dezelfde versie, key en uitnodiging
beschikbaar. Een retry bevestigt dezelfde acceptatie en maakt geen extra grants,
profielen, verplichting of ledgerpost. Next.js-redirects worden door de officiële
rethrow-helper doorgelaten; transportfouten krijgen een herstelbare foutmelding.

## Uitgevoerd bewijs

- De uiteindelijke migratie is opnieuw als upgrade van tien naar elf toegepast
  op de gevulde synthetische fixture: alle 142 applicatietabellen bleven identiek.
- 627 pgTAP-asserties in dertien bestanden geslaagd, waaronder 52 nieuwe controles
  voor huidige Auth-identiteit, minimale native Auth-kolomrechten, own-subject RLS,
  ontbrekende/verouderde versie, gewijzigde idempotencypayload, intrekking, audit,
  correcte identiteit, exacte grants en ongewijzigde verplichting/ledger.
- Lint, typecheck, 28 Node-tests, Next.js production build, vijf WP0-contracttests
  en standalone HTTP-smoke geslaagd. De toegevoegde CI-/stagingracegate is daarna
  nogmaals met Node-/WP0-tests en lint gecontroleerd.
- Browser: 19 controles geslaagd met echte lokale OTP, SMTP-opvang, uitnodigingslink,
  vier dossiertabs op drie viewports, twee verloren antwoorden, een echt geposte
  serveractie met het verkeerde ingelogde account en serverreadback. Eén
  acceptatiecommand/audit, invitationversie 3, dossierversie 3, één persoonlijk
  extra profiel, één verplichting en 60 bevestigde minuten.
- De nieuwe bevestigingskaart is ook op 390 px visueel bekeken; dossierlabel,
  aangeboden rechten, actie en Club Signal-merk blijven bruikbaar zonder overflow.
- De nieuwe tweesessierace wacht 3007 ms op de dossierversie: één invitation,
  één completed command en één creation-audit; de verliezer krijgt STALE_VERSION.
  De gate is aan CI en staging toegevoegd en is begrensd tot de lokale database.
- De bestaande laatste-plaatsrace houdt één boeking over; de verliezer krijgt
  CAPACITY_FULL. De seizoenslock wacht 2999 ms. De intake-/boekingslock wacht
  2916 ms en weigert de boeking met NOT_ELIGIBLE.
- De afzonderlijke account-/boekingsregressie slaagt met 14 browsercontroles;
  de volledige intake-/assistentieregressie slaagt met 22 controles. Echte lokale
  OTP-sessies, directe serveracties, privacy en readback zijn opnieuw uitgevoerd.
- Alle twaalf referentie-/appparen en de overlay-/opacitybediening zijn in de
  browser gecontroleerd. Het bronmanifest bevat 55 captures en hun SHA-256.
- De volledige private PostgreSQL-backup is in een nieuwe lokale database hersteld.
  Alle 142 applicatietabellen hebben identieke rijaantallen en JSON-digests.
  Geforceerde RLS, invoker-API en de beperkte eigenaar zijn behouden. De
  authenticated ouder-A-readback ziet uitsluitend de eigen intake en de actuele
  deliveryversie 3 via de herstelde private Auth-predicate. Het bestand met
  Auth-data blijft buiten Git; onafhankelijke host/Storage-binaries/staging zijn
  niet bewezen.

De actuele readback, captures, herstelresultaten en het bronmanifest staan naast
het document. Alle gegevens en ontvangers zijn synthetisch; de tests verzenden
uitsluitend naar lokale opvang. De vorige release is werkelijk op staging
uitgerold en teruggelezen: [e0d35d7](../../staging/20261006-e0d35d7/readback.json).
Zij draait nog in prototype-modus; aangesloten Auth/database/workers en remote
migratiestatus zijn niet bewezen.

## Open scope en rollout

De oude bootstrap-API-signatures blijven in de expand-stap voor de appovergang.
Zij moeten in een afzonderlijke contractmigratie worden ingetrokken voordat
V1 kan worden geaccepteerd. Versioned annulering, grantbeheer, bronverificatie,
beheerderszoeken/aanmaken/importeren, splitsen/herstellen, aanvragen/besluiten
zijn nog niet volledig aangesloten. Jaarlijkse herbevestiging blijft open.

Providerconcurrency, delivery_unknown, outbox/leases en echte providerreadback
blijven W09-scope. De huidige retry bewijst alleen reeds geregistreerde
provideracceptatie. W03–W11, veilige VPS-/Supabase-toegang en de volledige
stagingreleaseproef blijven onderdeel van het geautoriseerde werk.
