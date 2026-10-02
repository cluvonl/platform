# Cluvo — vaste bouwafspraken

- Lees de volledige V1-canon en documentatie voordat je domeinregels verandert. De laatste gebruikersinstructies gaan vóór technische voorstellen.
- Alle 28 aanvullingen en A01–A30 horen bij V1. Gefaseerde uitvoering is geen scopeverlaging.
- Behoud Design 1 — Club Signal. Kies geen nieuwe visuele richting; behoud de huidige navigatie, rustige kaarten en mobiele variant.
- Deze repositorymap is de uitvoerbare werkmap. De canon staat onder `docs/canon/`; begin met `docs/CODEX-STARTPROMPT.md`. De oorspronkelijke referentie staat in het uitgepakte overdrachtspakket onder `reference/prototype-source/`. Wijzig die niet en gebruik die niet als productieruntime.
- Gebruik echte Next.js + Supabase, met tenantisolatie en serverautorisatie. `localStorage` en de demorol zijn geen autoriteit.
- `main` → staging; werk uitsluitend op staging zolang V1 niet geaccepteerd is. Omzeil productiegates niet en verwijder ze niet zonder expliciet V1-akkoord.
- Maak geen productieaccounts, productieresources of productiecronjobs aan. Gebruik geen echte ledengegevens in de demo.
- Reken in minuten en eurocenten. Gebruik een bevestigde urenledger met correctieposten; overschrijf de boekingshistorie niet.
- Leg bij gevoelige mutaties actor, scope, `expected_version`, idempotencykey en auditgegevens vast. Autoriseer per actie, niet alleen per pagina.
- Geen credentials in Git, logs, fixtures, exports of prompts. Alleen de publishable key mag publiek zijn; `service_role` en geheime sleutels blijven uitsluitend op de server.
- Behoud bestaande instructies, lokale wijzigingen en lockfiles. Pin nieuwe dependencies. Voer geen destructieve databasereset uit buiten een lokale wegwerpomgeving.
- Wijzig gedeelde migraties nooit achteraf. Test zowel een upgrade als een lege database. Gebruik expand/contract; het terugrollen van een app is geen rollback van de database.
- De technische scripts in dit pakket vormen een bootstrap voor het prototype. De productiebackend, migraties en operationele gates moeten nog worden gebouwd.
- Bewijs is verplicht: uitgevoerde gerichte tests, negatieve RLS- en privacytests, concurrency op de laatste plaats, UI-controle en readback op staging.
- Werk door totdat het geautoriseerde werk is afgerond. Vraag alleen ontbrekende toegang of informatie bij een concrete blokkade.
