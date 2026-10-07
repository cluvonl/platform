# Lokale operationele controle — 7 oktober 2026

Parentcommit: `318d91774cdf022dfaa8e59550b5f33895cfedfc`. Deze capture betreft de aangegeven lokale werkboom vóór publicatie. [Finale validatie](final-validation.json) legt de bronhashes en de zestien ongewijzigde migraties vast.

- `npm test`: 77 geslaagd, nul mislukt; inventaris/privacy, API-metadata, begrensde subprocessen, mailallowlist en onafhankelijke preflightchecks inbegrepen.
- `npm run lint` en `npm run typecheck`: geslaagd.
- [PostgreSQL-formatproef](sql-format-results.json): 158 synthetische cases op PostgreSQL 17.11, vijf Auth-velden, 164 SELECTs en 948 case-asserties. Alle gegenereerde COUNT-queries liepen in alleen-lezen transacties met ROLLBACK; geen Auth-rijen gelezen of geschreven. De drie vastgelegde bronhashes komen overeen met de finale bestanden.
- [Eerdere lokale querycapture](query-results.json): elf datasetqueries en de API-configuratiemetadata zijn daadwerkelijk uitgevoerd tegen de lokale database. Deze capture blijft bevroren met haar eigen eerdere bronhashes; zij geldt niet als uitvoering van latere formatwijzigingen.

De vaste CI- en staging-databasejobs voeren de PostgreSQL-formatproef voortaan uit naast de bestaande database-, concurrency- en lintpoorten. De handmatige mailworkflow gebruikt uitsluitend het afgeschermde, door de gebruiker gekozen testadres en doet na expliciete dispatch één providerverzoek. Reruns worden geweigerd; een verloren response blijft UNKNOWN zonder automatische retry. Geen ontvangerwaarde, providerbody of geheim wordt geëxporteerd.

De [318-stagingreadback](../../staging/20261007-318d917/verification.md) en [sterke hosted certificaatcontrole](../../staging/20261007-credentials-318d917/verification.md) blijven afzonderlijk historisch bewijs. De nieuwe hosted inventaris, daadwerkelijke mailontvangst, gekoppelde app, Native staginglogin en volledige remote backup/restore zijn bij deze lokale capture nog niet uitgevoerd. V1-acceptatie blijft OPEN en productie blijft geblokkeerd.
