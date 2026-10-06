# 6 oktober 2026 — invitation-API contract en actuele bevoegdheid

Lokaal W02-deelbewijs bovenop `a4cf17b43f6a1fa94b92e452b9429819db29295c`.
De dertiende migratie sluit de bootstrap-ingangen na de v2-expand af. Alle twaalf
gepubliceerde migraties, de appbron en de lockfile blijven ongewijzigd. De volledige
23-pagina-/219-functiescope en alle 102 open criteria blijven behouden.

## Gedrag en herstelgrens

De oude API- en private signatures voor aanmaken, deliveryregistratie,
deliveryuitlezen en accepteren zijn voor anon, authenticated en service_role
ingetrokken. De beperkte eigenaar behoudt de private kernels voor gecontroleerde
v2-delegatie. De oude dossierleesprojectie blijft beschikbaar.

Een werkelijke tweesessierace reproduceerde in de eerste ongepubliceerde
contractversie een fout: aanmaken controleerde het uitnodigingsrecht vóór de
dossierlock, waarna een concurrent dat recht kon intrekken. De verliezende
aanmaak maakte na het wachten toch een tweede invitation. Het
[reproductiebewijs](pre-guard-regression.json) legt alleen minimale metadata vast.

De publieke v2-aanmaaksignature gaat nu door een private ingang die identiteit,
membership en uitnodigingsscope vóór én na de dossierlock controleert. Directe
aanroep van de eerdere v2-kernel is eveneens ingetrokken. De bestaande
version-/idempotencycontrole, audit, events en resultaten blijven intact.
API-functies blijven invoker; de command-eigenaar krijgt geen superuser of RLS-bypass.

De [compatibiliteitstabel](../../../database-compatibility.md) legt de aangesloten
appgrens op `9d9c365261b28ef99ef1a8345c21ae9e818ed6a1` of later. De werkelijk
geteste lokale app is `a4cf17b`. Een approllback draait de database niet terug.

## Uitgevoerd bewijs

- Lege database met dertien migraties: 713 pgTAP-asserties in vijftien bestanden
  geslaagd. De 42 contractasserties controleren privileges en daadwerkelijke
  authenticated aanroepen. De bestaande positieve onboarding- en dossiertests
  gebruiken nu v2 en geverifieerde synthetische identiteiten.
- Gevulde upgrade: de eerder werkelijk herstelde private twaalf-migratiebackup
  is naar een afzonderlijke lokale database hersteld. De exacte definitieve
  migratie is toegepast. Alle 142 applicatietabellen behouden hun rijaantallen
  en JSON-digests; geforceerde RLS en eigenaarsbeperkingen blijven intact.
  Dit is een afzonderlijke databehoudproef, geen tweede uitvoering van 713 tests.
- Browser: 29 controles geslaagd met echte lokale OTP, SMTP-opvang en de actuele
  database. Een werkelijke authenticated sessie krijgt zijn eigen v2-dossier
  via REST; alle vier oude REST-ingangen worden op de uitvoergrens geweigerd.
  Tokens en cookies blijven uitsluitend in procesgeheugen.
- De volledige uitnodigingsketen blijft werken: aanmaken, toestemmingscontext,
  accepteren, persoonlijke intake, bewuste intrekking, verloren-antwoordretries,
  verkeerd account, persoonlijke privacy en sessieverlies. Readbacks bewijzen
  één geaccepteerde en één ingetrokken invitation, dossierversie 5, één
  intrekcommand/audit, geen toegang voor de ingetrokken recipient en behoud van
  één verplichting en 60 bevestigde minuten.
- Vier lifecycle-races geslaagd. Acceptatie en intrekking kunnen elk winnen;
  de tegenactie wacht op de dossiertransactie. Bevoegdheidsverlies vóór intrekken
  én vóór aanmaken geeft na het wachten FORBIDDEN. De laatste proef houdt één
  bestaande invitation, dossierversie 2 en nul nieuwe grant/profiel/audit over.
  De afzonderlijke creatierace blijft één invitation houden met STALE_VERSION
  voor de verliezer. Actuele wachttijden staan in `test-results.json`.
- De overige database-races zijn opnieuw uitgevoerd: de laatste plaats houdt
  één boeking met CAPACITY_FULL voor de verliezer; de seizoenslock wacht 2993 ms
  en de intake-/boekingslock wacht 2930 ms met NOT_ELIGIBLE en nul boekingen.
- Volledige private backup van de actuele dertien-migratiedatabase naar een
  nieuwe lokale database hersteld: 142 gelijke tabellen/digests, beperkte rollen,
  alle negen ingetrokken signatures en de actuele v2-grants behouden. De echte
  authenticated dossier-/intake-/deliveryreadback werkt na herstel en toont
  geen persoonlijke intake van ouder B. De Auth-bevattende backup blijft buiten Git.
- De 36 beelden bevatten 24 actuele appbeelden en twaalf ongewijzigde
  referenties met bronprovenance. Alle twaalf dossierparen laden; overlay en
  opacitybediening zijn uitgevoerd. Mobiele intrekbevestiging en geweigerde
  context zijn visueel bekeken. Club Signal blijft behouden.
- Lint, 28 Node-tests, vijf WP0-contracttests, standalone HTTP-smoke en
  database-lint zonder fouten geslaagd. Typecheck en production build zijn
  hergebruikt uit de groene `a4cf17b`-release: de appbron is bytegelijk.
  De eerdere 14 account-/boekings- en 22 intakebrowserproeven staan afzonderlijk
  in het [vorige bewijs](../20261006-w02-invitation-cancellation/verification.md);
  ze zijn voor deze contractwijziging niet opnieuw uitgevoerd.

De [a4cf17b-stagingrelease](../../staging/20261006-a4cf17b/readback.json) is na groene
CI uitgerold en werkelijk teruggelezen, inclusief alle twaalf migratiehashes.
Die readback bewijst prototype-modus; aangesloten Auth/database/workers en de
remote contractupgrade zijn nog niet bewezen. Productie blijft geblokkeerd.

## Open scope

Grantbeheer, bronverificatie, beheerderszoeken/aanmaken/importeren,
splitsen/herstellen, formele besluiten en jaarlijkse herbevestiging blijven W02.
Providerconcurrency, delivery_unknown, outbox/leases en werkelijke aflevering
blijven W09. Onafhankelijke host, Storage-binaries, stagingherstel, W03–W11 en
volledige stagingacceptatie blijven open. Geen acceptatiecriterium is gesloten.
