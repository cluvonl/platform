# 6–7 oktober 2026 — persoonlijke jaarlijkse intakeherbevestiging

Lokaal W02-deelbewijs bovenop `71a914490304b4032740c19eb30fa9a69c144426`.
De veertiende migratie voegt de jaarlijkse persoonlijke controle toe. Alle
dertien gepubliceerde migraties en de lockfile blijven bytegelijk. De volledige
23-pagina-/219-functiescope en alle 102 open criteria blijven behouden.

## Gedrag en gegevensgrens

De persoonlijke intake toont de open seizoensaanvragen. De nieuwe route laat de
opgeslagen antwoorden zien, noemt de werkelijke persoon en onderscheidt de
maandinzet van de eerder opgegeven seizoenswens. Een expliciet controlevakje is
verplicht; namens iemand bevestigen vereist een actuele assistentiemachtiging
én vastgelegde reden. De feitelijke actor en vertegenwoordigde persoon blijven
apart. Een ander ouderaccount krijgt geen antwoorden of bevestigingscontext.

Het command controleert native geverifieerde identiteit, huidige bevoegdheid,
itemversie en profielversie. De lockvolgorde is doelseizoen → intakeprofiel →
seizoensaanvraag. Identiteit en bevoegdheid worden na het wachten opnieuw
gecontroleerd. Een afgesloten seizoen, superseded rollover, niet-opgeslagen
intake of verouderde versie levert geen nieuwe bevestiging op.

Elke bevestiging verwijst naar de exact gecontroleerde onveranderlijke
antwoordversie. De afzonderlijke receipt kan niet worden bijgewerkt of gewist,
ook niet via een gewone native operator-UPDATE. Een latere intakewijziging
verandert de eerdere bevestiging niet. De UI noemt de getoonde antwoorden dan
uitdrukkelijk de huidige opgeslagen antwoorden. Herbevestigen maakt geen
antwoorden, verplichting, urenpost, boeking of nieuw recht aan.

Het formulier bevriest beide versies en de idempotencykey. Een werkelijk
opgeslagen actie waarvan het HTTP-antwoord wordt afgebroken, houdt de controle
beschikbaar. Exact herhalen behoudt één receipt, command en audit. Gewijzigde
payload met dezelfde key wordt geweigerd; actuele bevoegdheid wordt ook vóór
het teruggeven van een eerder resultaat gecontroleerd.

## Uitgevoerd bewijs

- Lege database met veertien migraties: 768 pgTAP-asserties in zestien bestanden
  geslaagd. De 55 nieuwe asserties behandelen eigen en begeleide bevestiging,
  tenant- en ouderprivacy, native ongeverifieerde/gebanneerde identiteit,
  ontbrekende versies, stale antwoorden, afgesloten seizoen, superseded
  rollover, ingetrokken machtiging, idempotency, onveranderlijkheid en behoud
  van antwoorden, verplichtingen en ledger.
- Gevulde upgrade: de eerder werkelijk herstelde private dertien-migratiebackup
  is naar een afzonderlijke lokale database hersteld. De exacte definitieve
  migratie is toegepast. Alle 142 bestaande applicatietabellen behouden hun
  rijaantallen en JSON-digests. De nieuwe receipt-tabel is leeg; alle 143
  tabellen hebben geforceerde RLS. Dit is een databehoudproef en geen tweede
  uitvoering van de volledige pgTAP-suite.
- Actuele production standalone-build: 89 browsercontroles geslaagd, verdeeld
  over 18 jaarlijkse controles, 28 dossier-/uitnodigingscontroles, 14 account-/
  boekingscontroles, 22 persoonlijke/begeleide intakecontroles en zeven
  sessie-/verloren-antwoordcontroles. Dit zijn echte lokale OTP-sessies,
  SMTP-opvang en daadwerkelijke serveractions met database-readbacks.
- De 18 jaarlijkse controles behandelen onder meer een verkeerd ingelogd
  account, directe ouder-/tenant-ID's, wijziging van antwoorden terwijl de
  controlepagina openstaat, verloren response na commit, gewijzigde payload,
  exact herhalen, latere antwoordversie, ontbrekende hulpreden, ingetrokken
  hulpbevoegdheid, replay na intrekking en sessieverlies. Ouder A houdt één
  receipt voor revision 5 terwijl zijn actuele antwoorden revision 6 zijn.
  Ouder B houdt één receipt voor revision 2. Een volgend jaar blijft open.
  Eén verplichting, 720 doelminuten, 60 bevestigde minuten en de bestaande
  vier boekingen blijven tijdens de herbevestigingsproef behouden.
- Vier werkelijke tweesessieraces geslaagd: dezelfde bevestiging levert één
  resultaat op; een winnende antwoordwijziging geeft STALE_VERSION, ingetrokken
  hulp geeft FORBIDDEN en een winnende seizoenssluiting geeft SEASON_NOT_OPEN.
  De verliezende acties wachten op de transactie en maken geen receipt, audit
  of onafgerond idempotencyrecord aan. De afzonderlijke laatste-plaats-,
  seizoens-, intake-/boekings- en vijf uitnodigingsraces zijn ook uitgevoerd.
- Volledige private backup van de actuele veertien-migratiedatabase naar een
  nieuwe lokale database hersteld: 143 gelijke tabellen/digests, geforceerde RLS,
  invoker-API en beperkte command-eigenaar behouden. De authenticated native
  identiteit, eigen intake, dossier, minimale delivery en beide jaarlijkse
  aanvragen werken na herstel. De ingetrokken helper ziet geen receipt of
  projectie van ouder B; historische revision, open volgend jaar en immutable
  trigger blijven behouden. Alle negen ingetrokken invitation-signatures
  blijven ingetrokken. De Auth-bevattende backup blijft buiten Git.
- 91 beelden: 67 actuele appbeelden en 24 ongewijzigde referenties met
  bronprovenance. Alle 24 intake-/dossierparen laden; overlay en opacitybediening
  zijn uitgevoerd. Mobiele eigen controle, gemachtigde controle en verloren
  response zijn visueel bekeken. Voor de nieuwe jaarlijkse route is geen
  identiek prototypepaar beschikbaar; de bestaande Club Signal-kaarten en
  navigatie blijven behouden.
- Lint, typecheck, production build, 28 Node-tests, vijf WP0-contracttests,
  standalone HTTP-smoke en database-lint zonder fouten geslaagd. De vier nieuwe
  races zijn toegevoegd aan de bestaande CI- en stagingpoorten. Bestaande
  poorten en productieblokkade zijn behouden.

De browser gebruikt synthetische downstream rollover-items. De bestaande
rollovercommandproef blijft afzonderlijk in pgTAP; hiermee wordt geen operationele
scheduler, volledige seizoensacceptatie of echte provideraflevering geclaimd.
Het [stagingreadback van `71a9144`](../../staging/20261006-71a9144/readback.json)
bewijst de werkelijk uitgerolde prototype-image en dertien migratiehashes.
Remote Auth/database/workers, de remote veertien-migratie-upgrade en aangesloten
browser-/privacyproeven blijven onuitgevoerd tot de veilige beheerroute beschikbaar is.

## Open scope

Grantbeheer, bronverificatie, beheerderszoeken/aanmaken/importeren,
splitsen/herstellen, formele besluiten en jaarlijkse rollen-/afsprakenbevestiging
blijven open. Providerconcurrency, delivery_unknown, outbox/leases en werkelijke
aflevering blijven W09. Onafhankelijke host, Storage-binaries, stagingherstel,
W03–W11 en volledige stagingacceptatie blijven open. Geen acceptatiecriterium is
gesloten; `v1_ready=false` en `production_enabled=false`.
