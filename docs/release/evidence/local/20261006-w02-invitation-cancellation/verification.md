# 6 oktober 2026 — persoonlijke uitnodiging intrekken

Lokaal W02-deelbewijs bovenop `9d9c365261b28ef99ef1a8345c21ae9e818ed6a1`.
De volledige V1-scope en alle 102 open criteria blijven behouden. Productie is
geblokkeerd. Elf gepubliceerde migraties en de lockfile blijven ongewijzigd;
de twaalfde migratie is een expand-stap.

## Gedrag

De actuele bevestigde maker met geldig uitnodigingsrecht, of een expliciet
bevoegde commissie binnen de dossierscope, kan een ongeaccepteerde uitnodiging
intrekken. Een andere contactpersoon krijgt daarmee geen beheerrecht over de
persoonlijke uitnodiging. De UI vraagt een bewuste bevestiging en bevriest de
gelezen invitationversie en commandkey. De server bepaalt tenant en actor.

Intrekking lockt eerst het dossier, daarna de invitation. De actuele identiteit,
membership en scope worden na het wachten opnieuw gecontroleerd. Intrekking,
nieuwe invitation-/dossierversie, idempotencyresultaat, actor/scope/key/audit en
event worden in één transactie vastgelegd. De uitnodigingsrij blijft bestaan.
De persoonlijke link levert daarna geen context of toegang op. Bestaande
geaccepteerde rechten vragen afzonderlijk grantbeheer.

Na een verloren antwoord werkt dezelfde retry. Een gewijzigd verzoek met dezelfde
key wordt geweigerd; een nieuwe mutatie met een oude versie wordt geweigerd.
Een current-version no-op maakt geen tweede overgang of audit. Het dossier toont
alleen reeds zichtbare invitationrijen met actuele versie, expiry en minimaal
annuleringsrecht. Historie bevat geen e-mail, token/hash, actor-ID of auditpayload.

## Uitgevoerd bewijs

- 671 pgTAP-asserties in veertien bestanden geslaagd op een upgrade en op een
  lege database; 44 nieuwe negatieve rechten-, privacy- en lifecyclecontroles.
- Een afzonderlijke gevulde upgrade van elf naar twaalf behoudt aantoonbaar
  alle 142 applicatietabellen, rijaantallen en JSON-digests.
- De echte tweesessieraces laten zowel intrekking als acceptatie winnen. De
  tegenactie wacht ongeveer drie seconden en wordt geweigerd. Intrekking kent
  geen profiel of grant toe; acceptatie behoudt exact één eigen profiel/grant.
- Bij een concurrent ingetrokken uitnodigingsbevoegdheid wacht de command
  op de dossierlock en krijgt daarna FORBIDDEN. Geen overgang of audit ontstaat.
- De bestaande creatierace blijft groen: één invitation, één completed command
  en één creation-audit; een nieuwe command met oude dossierversie verliest.
- Browser: 28 controles geslaagd met echte lokale OTP, SMTP-opvang en twee
  persoonlijke uitnodigingen.
  Werkelijke serveracties met het verkeerde ingelogde account worden geweigerd.
  Verloren antwoorden bij aanmaken, accepteren en intrekken zijn herhaald zonder
  dubbele mutatie. De ingetrokken link toont geen dossierlabel of acceptatieknop.
  Readback: één intrekking, versie 3, dossierversie 5, één command/audit, nul
  recipientgrants/personkoppelingen, één verplichting en 60 bevestigde minuten.
- Sessieverlies tijdens een open uitnodigingsformulier leidt werkelijk naar
  login, zonder nieuwe invitation. De officiële Next.js-rethrow-helper laat
  gecontroleerde redirects door; een transportfout houdt dezelfde retry vast.
- De mobiele bevestiging en de geweigerde linkcontext zijn visueel bekeken.
  De twaalf dossierparen en overlay-/opacitybediening werken in de browser.
- De afzonderlijke account-/boekingsregressie slaagt met 14 browsercontroles;
  de persoonlijke/begeleide intake met 22. Het manifest bevat 61 beelden:
  twaalf referenties, 24 dossier-/uitnodigingsbeelden en 25 regressiebeelden.
- De bestaande laatste-plaatsrace houdt één boeking over, met CAPACITY_FULL
  voor de verliezer. De seizoenslock wacht 3000 ms; de intake-/boekingslock
  wacht 2928 ms en weigert de boeking met NOT_ELIGIBLE.
- Lint, typecheck, 28 Node-tests, production build, vijf WP0-contracttests,
  standalone HTTP-smoke en database-lint zijn geslaagd.
- De volledige private PostgreSQL-backup is werkelijk naar een nieuwe lokale
  database hersteld. Alle 142 applicatietabellen, digests, geforceerde RLS,
  invoker-API en beperkte eigenaar zijn behouden. Authenticated ouder A ziet
  alleen zijn intake, de geaccepteerde en ingetrokken invitation, minimale
  intrekhistorie en de actuele deliveryversie via de private Auth-predicate.
  Het Auth-bevattende backupbestand blijft buiten Git.

De voorgaande release is op staging uitgerold en teruggelezen:
[9d9c365](../../staging/20261006-9d9c365/readback.json). Die draait nog in
prototype-modus. De aangesloten Auth/database/workers en remote migratiestatus
zijn niet bewezen. Lokale Auth is tussen onafhankelijke browserfixtures herstart;
dit bewijst geen provider-ratelimitacceptatie.

## Open scope

De bootstrap-API-signatures blijven tijdens de expand-overgang bestaan; een
contractmigratie blijft vereist vóór V1-acceptatie. Grantbeheer, bronverificatie,
beheerderszoeken/aanmaken/importeren, splitsen/herstellen, formele besluiten en
jaarlijkse herbevestiging zijn nog niet volledig aangesloten. Providerconcurrency,
delivery_unknown, outbox/leases en werkelijke aflevering blijven W09-scope.
Onafhankelijke host/Storage-binaries/stagingherstel blijven open, evenals
W03–W11 en de volledige stagingacceptatie. Geen acceptatiecriterium is gesloten.
