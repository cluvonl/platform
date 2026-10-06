# 7 oktober 2026 — actuele native inlogsessie

Lokaal W01-deelbewijs bovenop `8f6190f77605edd8e191425f2790bc194ae28175`.
De vijftiende migratie voegt de actuele native sessie als verplichte toegangsvoorwaarde toe.
Alle veertien gepubliceerde migraties, appbron en lockfiles blijven bytegelijk.
De volledige 23-pagina-/219-functiescope en alle 102 open criteria blijven behouden.

## Aangetoond probleem en wijziging

Op de veertien-migratiedatabase is met een echte lokale OTP-login aangetoond dat
native uitloggen de sessie verwijderde, terwijl dezelfde nog ondertekende token
nog één eigen intakerij kon lezen. Er zijn bij die reproductie geen
applicatiegegevens gewijzigd. [Het afzonderlijke voorafbewijs](pre-change-results.json)
legt die waarneming vast zonder token, cookie, OTP of native session-ID te bewaren.

De nieuwe guard koppelt de JWT-`session_id` aan de actuele native Auth-sessie
van dezelfde gebruiker. Ook geverifieerde identiteit, huidige blokkade,
verwijderstatus en sessievervaldatum worden gecontroleerd. Dit volgt de
[officiële Supabase-sessiecontrole](https://supabase.com/docs/guides/auth/sessions).
Een geldige ondertekening alleen geeft daarmee geen toegang meer.

Alle 143 applicatietabellen krijgen een extra restrictieve RLS-voorwaarde.
De 53 bestaande private menselijke commands controleren de sessie vóór hun
bestaande domeinbody; de 51 publieke API-ingangen blijven invoker-wrappers.
Bestaande owners, ACLs, signatures en commandbodies blijven behouden. Tenant-,
persoon- en actiebevoegdheden worden nog steeds afzonderlijk gecontroleerd.
De uitnodigings-/herbevestigingscontrole behoudt de aanvullende actuele
native e-mailmatch; de algemene sessiepoort gebruikt de stabiele gebruiker-ID.

De beperkte command-eigenaar kan alleen de benodigde drie native session-kolommen
lezen, met een policy voor de huidige eigen sessie. Hij krijgt geen Auth-schema-
USAGE, native mutatierecht, secrets, superuser of BYPASSRLS. Bound SQL-referenties
blijven werken wanneer Auth bij herstart de schema-ACL herstelt. Nieuwe tabellen
of menselijke commands moeten dezelfde sessievoorwaarde expliciet meenemen.
Hieruit volgt geen workerautoriteit of nieuwe productieresource.

## Uitgevoerd bewijs

- Lege lokale wegwerpdatabase met de exacte vijftien migraties: 810 pgTAP-asserties
  in zeventien bestanden geslaagd, waaronder 42 nieuwe sessiecontroles. Alle
  104 beschikbare API-/private command-ingangen weigeren een verwijderde sessie
  vóór argumentverwerking. Ontbrekende, ongeldige en verkeerde session-ID,
  andere gebruiker, ongeverifieerde/gebanneerde/verwijderde identiteit en verlopen
  sessie zijn negatief getest. Eigen membership-, account- en intakeprojecties
  leveren daarna nul rijen; antwoorden, commandrecords en ledger blijven behouden.
- Gevulde upgrade van een gecontroleerde veertien-migratiebackup naar de exacte
  vijftiende SQL-migratie: 143 gelijke applicatietabellen/digests. Metadata van
  alle 190 bestaande API-/internalfuncties en de oorspronkelijke domeinbodies
  van alle 53 bewaakte commands zijn behouden. Geen tabel of geschiedenis is
  verwijderd; alle 143 tabellen behouden geforceerde RLS.
- 90 bestaande browsercontroles opnieuw geslaagd: 29 dossier/uitnodiging,
  14 account/boeking, 22 persoonlijke/begeleide intake, 18 jaarlijkse controle
  en zeven sessie/verloren-responsecontroles. De dossierproef controleert ook
  via echte REST dat ingetrokken bootstrap-ingangen afgesloten blijven.
- Vijftien aanvullende browsercontroles gebruiken echte lokale OTP's en
  native Auth-sessies. Een native ban, soft deletion en sessieverval sluiten
  persoonlijke REST-projecties af. Een geladen formulier bij een ban commit
  niets. Na opheffen van de ban blijft de bestaande geldige sessie bruikbaar.
- Native lokale sign-out verwijdert de eerste sessie en blokkeert dezelfde oude
  ondertekende token voor intake, dossier, werkruimte en accountvoorkeur.
  Directe intake-/voorkeur-RPC's geven FORBIDDEN. Een al geopend intakeformulier
  verwijst naar inloggen en maakt geen antwoordversie, command of audit aan.
  De tweede werkelijk ingelogde sessie van dezelfde ouder blijft geldig.
- Native globale sign-out verwijdert alle sessies van die ouder. Het tweede
  geladen formulier kan daarna evenmin opslaan. Het andere ouderaccount houdt
  uitsluitend zijn eigen intake. Een latere nieuwe OTP maakt een nieuwe native
  sessie aan; de oude tokens krijgen hun toegang daarmee niet terug. Deze nieuwe
  sessie wordt gebruikt voor de afzonderlijke herstelproef.
- Dertien daadwerkelijke tweesessieraces geslaagd: vijf jaarlijkse controles,
  vijf uitnodigingscontroles, de laatste plaats, seizoenssluiting/ledger en
  intakeverhindering/boeking. De nieuwe jaarlijkse race wacht werkelijk op een
  profiel-lock; een winnende native sessie-intrekking geeft na het wachten
  FORBIDDEN zonder receipt, audit of onafgerond commandrecord.
- De actuele vijftien-migratiedatabase is volledig privé geback-upt en naar een
  nieuwe lokale database hersteld. Alle 143 tabellen/digests, forced RLS,
  invoker-API, beperkte eigenaar en negen ingetrokken invitation-signatures
  blijven behouden. Eigen dossier, intake en jaarlijkse historische receipt
  werken met de herstelde native sessie; andere oudergegevens blijven verborgen.
  Verwijderen van die sessie in een teruggedraaide hersteltransactie geeft nul
  eigen rijen en weigert de voorkeurmutatie. De private backup blijft buiten Git.
- 94 beelden: 70 actuele appbeelden en 24 ongewijzigde referenties met hashes.
  Alle 24 intake-/dossierparen, overlay en opacitybediening zijn uitgevoerd.
  Mobiele jaarlijkse controle en de loginpagina na native intrekking zijn
  visueel bekeken; Club Signal en de bestaande navigatie blijven behouden.
- Lint, 28 Node-tests, vijf WP0-contracttests, standalone HTTP-smoke en
  database-lint zonder waarschuwingen geslaagd. App/components/lib en lockfiles
  zijn bytegelijk aan `8f6190f`; de eerder geslaagde typecheck en production
  standalone-build `h2Cja3UFbszEOMcWMc6qD` zijn hergebruikt voor alle huidige
  browserproeven. Een nieuwe appbuild wordt hiermee niet geclaimd.

De pgTAP- en concurrencyproeven gebruiken bewust lokale SQL-sessiecontexten;
die zijn afzonderlijk van het werkelijke OTP-/SMTP-/native browserbewijs.
Het [stagingreadback van `8f6190f`](../../staging/20261007-8f6190f/readback.json)
bewijst de werkelijk uitgerolde prototype-image en veertien migratiehashes.
Remote Auth, toegepaste databaseversies, workers en aangesloten stagingproeven
blijven onuitgevoerd zolang de veilige beheerroute ontbreekt.

## Open scope

Deze proef bewijst geen algemene serialisatie van elke reeds lopende transactie
met native uitloggen: alleen herbevestiging na de lock is zo gecontroleerd.
Realtime, Storage en live providerintrekking zijn niet bewezen. Onafhankelijke
host, Storage-binaries en stagingherstel blijven open. Grantbeheer,
bronverificatie, admin zoeken/aanmaken/importeren, splitsen/herstellen, volledige
seizoenscyclus, W03–W11 en volledige stagingacceptatie blijven open.
Geen acceptatiecriterium is gesloten; `v1_ready=false` en `production_enabled=false`.
