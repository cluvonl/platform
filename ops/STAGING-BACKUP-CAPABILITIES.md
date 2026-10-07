# Staging — alleen-lezen herstel- en migratierechten

De handmatige workflow `staging-backup-capabilities.yml` onderzoekt uitsluitend het vaste Cluvo-stagingproject. Hij gebruikt de bestaande databasecredential, een directe verbinding of session pooler op poort 5432 en de gecontroleerde officiële CA-bundle met `verify-full`. Er worden geen dumps, accounts, sleutels, providerresources of migraties aangemaakt.

Het veilige rapport maakt concrete ontbrekende toegang zichtbaar: SELECT op alle gegevenskolommen, schema-USAGE, actieve RLS-filtering, sequences, grote-objectmetadata, globale autorisatiecatalogi, foreign tables, subscriptions, custom tablespaces en gegevens van extensions buiten hun dumpconfiguratie. Namen van private objecten en extensioncataloguswaarden blijven intern; alleen vaste codes, booleans en counts verlaten het script. Onleesbare of onbekende datasets worden nooit leeg genoemd.

De daadwerkelijk gemeten client-TLS staat los van `pg_stat_ssl`, dat de databaseverbinding achter de session pooler beschrijft. Metadataqueries en eventuele begrensde extensioncounts gebruiken READ ONLY/REPEATABLE READ. Zij hebben afzonderlijke verbindingen en vormen geen gezamenlijke backupsnapshot.

De migratievoorvoorwaarden bevatten de volledige bestaande zestien-migratieroute: de gerichte policies op Auth-users, Auth-sessions en Storage-objects; de beperkte Auth-kolomgrants; en de kolomrechten voor de Storage-bucketupsert. Eigenaarschap of een expliciete geladen providerpolicygrant is uitsluitend een metadata-inferentie. Een actieve bucket-RLS of ontbrekende relatie verschijnt als afzonderlijk hiaat. De daadwerkelijke statements moeten later in een herstelde wegwerpclone onder de echte migratieactor worden uitgevoerd.

De extensionvergelijking betreft zes packageversies die werkelijk in de [lokale herstelproef](../docs/release/evidence/local/20261007-independent-restore/verification.md) met de gepinde image zijn vergeleken. Een andere package of versie blijft onbekend of afwijkend. Een gelijke versie bewijst geen gelijke definitions, providerrootkeys of volledig herstel.

`passed=true` betekent uitsluitend dat de meting is uitgevoerd en gevalideerd. Lees ook `concrete_capture_blockers`, `native_migration_prerequisite_gaps`, onbekende extensions en de expliciete bewijsbeperkingen. Backup, restore en remote-DDL-vrijgave blijven false. Een consumer mag `passed` niet als migratiegate gebruiken.

Deze controle vervangt geen operationele versleutelde backup, onafhankelijke restore, onveranderde volledige catalogus-/datavergelijking, gebonden snapshot/advisorylock, lege-database- en upgradeproef of stagingreadback. Native login, SMTP/OTP, private Storage-bytes en V1-acceptatie blijven afzonderlijke bewijsroutes. De workflow uploadt uitsluitend het gesaniteerde JSON-rapport; geen database-inhoud, credentials of raw providerdiagnostiek.
