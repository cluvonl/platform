# Onafhankelijke read-only review hosted-capabilityprototype

7 oktober2026. Alleen `/tmp/cluvo-staging-restore-adapter/hosted-capability-collector.mjs`, bijbehorende synthetische tests, publieke pinned-extensionconstants en relevante canonical migraties/helpers gelezen. Geen database-/Docker-/hosted-/providerquery, dump/key/env/log/private-catalog lezen, verzending of canonical wijziging uitgevoerd. Bestaande werkelijk bewezen restoredriver blijft ongewijzigd.

## Uitgevoerde eigen proeven

Finale collector `bdf8fcc7ba63904c8530ab50a8a9bf90f7280860803c2834126b86292d7ce814`, tests `cbffeb966722a90f6145c14d2ac92b8f7857e1e12cb6217b7c2a0d31954f62f6`:27/27 bestaande fake-executortests PASS. Daarnaast9/9 onafhankelijke fake-executorprobes PASS in `/tmp/cluvo-staging-restore-adapter/collector-independent-probes.mjs`:

- Verkeerd project: nul executorcalls.
- SQL-achtige schema/relatienamen met doublequote: exact één veilig quoted identifier; nergens namen/code in rapport.
- NUL in naam: failclosed vóór dynamische count.
- Count met extra privéveld: failclosed, inhoud niet in rapport.
- RLS-onzichtbare materialized relation: geen count, unknown1/empty0.
- Count-query privilege/scopefout: volledig onbekende/falende meting, nooit empty0bewijs.
- Onbekende extension: known_subset_complete false, compatibility unknown, geen naam in rapport.
- READONLYfalse en niet-veilige integer: failclosed.
- BackendSSLtrue zonder werkelijk client-TLSconninfo: weigering na één call.

Eigen omvangprobe bevestigt dat oversized executorstdout nu wordt geweigerd vóór trim/JSONparse. Alle proeven gebruiken uitsluitend synthetische waarden en een fake async executor; dit bewijst geen werkende hosted psql/TLS/DDL of daadwerkelijke providerrechten.

## Concrete bevindingen en correcties

1. **Gecorrigeerd: responsebudget.** Oud collector959c... accepteerde een geldig profiel plus2.000.001 trailing spaces uit een alternatief executor, ondanks maxBuffer2MBoptie. Canonical `executeDatabaseProcess` begrensde echte stdout/stderr al, dus daar is geen runtimebypass aangetoond. Nieuwe collector controleert UTF8bytes stdout+stderr zelf vóór trim/parse; eigen reproduceerprobe is nu false, regressietest PASS.
2. **Gecorrigeerd: volledige policyfamilie.** Oorspronkelijke metadata controleerde alleen expliciete supautilsgrant voor auth.sessions. Gepubliceerde16 vragen ook auth.users-policy(migr11) en vier Storageobjects-policies(migr4). Nieuwe afzonderlijke owner/providerflags en gaps onderzoeken alle drie bekende relationfamilies; beide narrowly granted Auth-columnsets blijven aparte precondities. Eigendom en expliciete providerpolicyroute niet met SELECTprivilege verwarren.
3. **Gecorrigeerd: ontbrekende Storage-relatie.** Oud SQL `rolsuper OR coalesce(relowner...,false)` rapporteerde owner_availabletrue als superuser terwijl storage.objects ontbrak. Nu vereisen alle Auth/Storage-owner/providerflags bestaande relationpresence. Storageobjects en buckets hebben afzonderlijke presenceflags en vaste missing-gaps, ook bij syntheticSU. Een providergrant voor een niet-bestaande relatienaam is daardoor geen bestaande-capabilitybewijs.
4. **Aangevuld: migr4 bucketrechten.** Nieuwe metadata toetst INSERT op id/name/public/file_size_limit/allowed_mime_types, UPDATE op public/file_size_limit/allowed_mime_types en benodigde SELECT voor conflict-ID/EXCLUDED-waarden. Dit stemt overeen met de gelezen migr4INSERT/ONCONFLICTUPDATE. SchemaUSAGE en actieve bucketRLS zijn aparte flags/gaps. Een RLSfilter blijft `STORAGE_BUCKET_RLS_WRITE_ROUTE_UNPROVED`; SELECT/BYPASSinference wordt niet voor een uitgevoerde UPSERT gehouden. `storage_bucket_upsert_executed` en `full16_migration_execution_verified` blijvenfalse. Geen actuele hosted privilegeblokkade uit lokaleSU metadata afleiden.

Binnen deze beperkte prototype-meting geen overblijvende concrete privacy-/count-/redactionblocker gevonden na deze correcties. Dit is geen goedkeuring voor remote capture, canonical promotie of DDL; onderstaande proofgrenzen blijven gelden.

## Wat de code daadwerkelijk aantoont

Stagingproject en exact helpercontract zijn vóór executorcalls vereist; directe of sessionpooler5432, explicit libpqenv zonder URL/password in argv, officiële CA verify-full en readonly PGOPTIONS. Werkelijke client-TLS1.2/1.3 wordt uit `psql\\conninfo` afgeleid; `pg_stat_ssl` meet onafhankelijk de backend. Een plaintext backend achter sessionpooler kan naast geverifieerde clientTLS voorkomen. Geen zekerheid over hosted verbinding ontlenen aan de lokaalSU SQLvalidatie van Ops.

Metadataquery is BEGIN REPEATABLE READ READ ONLY, row_securityoff en15sstatementtimeout; elke count heeft hetzelfde beperkte ROcontract, plus process30stimeout/2MBbudget. Alle relationnamen komen uitsluitend uit de private metadataprojectie in memory en worden strikt gevalideerd/quoted. Rapport bevat alleen vaste velden, booleans, veilige niet-negatieve integers, vaste foutcodes en publieke pinnedimage/proofhashes. Onverwachte keys, diagnostics, rawbody en private cataloglabels verlaten de module niet.

SELECTtoegang en RLSvisibility worden afzonderlijk bekeken. All-columnSELECT kan een leesroute zijn, maar alleen metadatahasprivilege is nog geen daadwerkelijke dump/capture. row_securityoff schakelt policies niet uit: een later count die onder RLS zou vallen moet falen; code zet zo'n fout niet om in0. Geclassificeerde extensionrefs die unreadable/rlsfalse zijn worden niet geteld en expliciet unknown. Niet-superuser subscriptions, foreigndata, grote-object-ACLproblemen, sequenceSELECTgebrek en versieverschillen worden vaste concrete capturegaps.

Unknown extension is niet “complete”: alleen zes publiek gepinde daadwerkelijk lokaal bewezen package/defaultversions matchen de known subset. Match op naam/version bewijst geen gelijke extensionmemberdefinitions, secrets/rootkeys, externe objectbytes of fullrestorecompatibility. Het rapport verklaart die grenzen uitdrukkelijk false.

## Beperkingen voor integratie

`passed:true` betekent dat de beperkte meting/decodering geslaagd is; concrete_capture_blockers/native prerequisite gaps/unknownpackages kunnen tegelijk aanwezig zijn. Het is geen capture-, migratie- of restoregate. Een consumer moet de afzonderlijke gaps/unknowns en false-proofvelden respecteren en mag niet alleen passed controleren.

De metadata/countqueries gebruiken afzonderlijke processen/verbindingen; geen gezamenlijk exported backupsnapshot. Een tussentijdse schema/data/RLSwijziging kan daarom de meting veranderen. `count_connections_share_backup_snapshot:false` is correct; “proven_empty” geldt uitsluitend voor de getelde relation op die call, niet voor een toekomstige capturedataset. Privilege/vlagmetingen zijn niet dezelfde bewijslaag als werkelijk pg_dump, owner/ACLrestore, sourcebound backup of nonSU-DDL.

Gefilterde extension-configconditions worden alleen geteld; niet vastgesteld of er door die voorwaarden rijen buiten gewone extensiondump vallen. Rolpasswords/private rolconfigs, rootkeymateriaal, Authbinaryversieattestatie, grote-objectbytes, volledige catalogverschillen, providerPolicyDDL en private blobrestore blijven ononderzocht. Geen full16/fullV1/hostedrestoreclaim op basis van deze prototype-inventaris.

De pure import voert niets uit en er is geen CLI/apply/backupflow. Geen additional approvalgate nodig voor deze read-only codebeoordeling; eventuele echte hostedmeting/capture/migratie hoort bij de afzonderlijke roottaak en vaste geautoriseerde stagingroute.
