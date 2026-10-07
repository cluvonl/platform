# Alleen-lezen herstel- en migratierechten — lokale integratie

De [validatie](validation.json) bindt vier nieuwe script-/test-/workflowbestanden aan hun exacte SHA256 en de parentbron `1d56c628969249c2a0b8e0dd7967a42dc9044dae`. De werkmap bevat deze uitbreiding; dit is geen bewijs van een al uitgerolde commit.

Werkelijk uitgevoerd: alle 123 Node-tests PASS, nul failures/skips/TODO; volledige ESLint PASS. Daarbinnen slagen 36 gerichte capabilitytests. Negen [onafhankelijke synthetische probes](canonical-independent-probes.json) zijn daarnaast met een nieuwe canonical import uitgevoerd. De [bevroren onafhankelijke prototypereview](prototype-independent-review.md) bewaart zijn eerdere 27-testscope en wordt niet achteraf opgewaardeerd tot de geïntegreerde modulehash.

De exacte metadatavraag is werkelijk lokaal READ ONLY/REPEATABLE READ uitgevoerd tegen de gepinde bron: [veilig SQL-bewijs](local-sql-results.json), SQL-SHA256 `7b44dd336972a3bd6dd5811242011c7656ed1cb0ac9e1f435dc5389589013dac`. De geïntegreerde export heeft dezelfde queryhash. Dit lokale superuserbewijs betreft syntax en metadata: 197 datarelations, zes extensions en nul ongeregistreerde extensiondatarelations. Het bewijst geen hosted nonSU-uitvoering, clientcertificaatverificatie of gedeelde backupsnapshot.

De integratie gebruikt de bestaande asynchrone begrensde subprocess- en targethelpers, vaste stagingrepo/ref/project/SHA-gates, gecontroleerde gepinde CA, uitsluitend poort 5432 en verify-full. De echte CLI weigert apply/backup/andere arguments zonder query en schrijft uitsluitend het vaste exclusieve 0600-rapport. Private diagnostiek, raw cataloguswaarden en credentials bereiken artifact/stdout niet. De meting heeft een totale termijn van 120 seconden naast de afzonderlijke query-/outputlimieten.

Deze eerste capture bevat geen echte hostedmeting. De [handmatige workflow en grenzen](../../../../../ops/STAGING-BACKUP-CAPABILITIES.md) moeten afzonderlijk worden uitgevoerd en teruggelezen. `passed=true` betekent meting, ook bij captureblockers, migratiehiaten of onbekende extensions. Backup, restore, migratievrijgave, V1 en productie blijven false.
