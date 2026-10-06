# Cluvo — overdracht naar een werkend stagingplatform

Versie 1.0 • 6 oktober 2026 • eigenaar: Nick • taal: Nederlands

De opdracht is de volledige actuele Cluvo-ervaring operationeel maken in de bestaande GitHub-repository `cluvonl/platform`. Alle 23 pagina's, de oorspronkelijke V1-logica, de teamverdeling, de zes uitbreidingen en de persoonlijke uitlegbanners horen bij de scope. De bestaande vormgeving **Design 1 — Club Signal** is de visuele norm. Dit pakket is een bouwspecificatie en een bronreferentie; het bewijst geen reeds werkende volledige stagingrelease.

## Waarmee Codex begint

1. Open `CODEX_STARTPROMPT.md` en werk in de actuele repository `https://github.com/cluvonl/platform.git`.
2. Lees `01_FUNCTIES_PER_PAGINA.md`, `02_SAMENHANG_EN_PRODUCTREGELS.md` en `03_BACKEND_EN_TRANSACTIES.md`.
3. Vergelijk de actuele repository met de vastgelegde basis. Behoud reeds werkende Auth, Supabase-migraties, serveracties en deploymentbescherming.
4. Gebruik `referentie/prototype/` als exacte UI- en interactiereferentie. Deze bron bevat de recente uitbreidingen die niet automatisch in de platformrepository staan.
5. Volg `04_SECRETS_EN_STAGING.md`, `05_BOUWPLAN.md`, `06_ACCEPTATIE.md` en `07_VISUELE_PARITEIT.md`.
6. Bewijs werking op de echte stagingomgeving met meerdere accounts, harde serverchecks en een screenshotset. Een groene prototype-test is daarvoor onvoldoende.

## Bronnen en prioriteit

| Bron | Vastgelegd | Gebruik |
|---|---|---|
| Huidige gebruikersopdracht | 6 oktober 2026 | Volledige werking en behoud van prototype; bouwen op main, daarna exact promoveren naar staging; productie later. |
| Actueel Sites-prototype | commit `e9c1d8bca2089b0944577eed73d1bedf7e70a3b6` | Visuele referentie, interacties, teamuitbreidingen, zes ideeën, helpteksten. |
| Platformrepository | commit `47386491859b47fbebf85c3b209724dcc20407fc` | Bestaande Next.js/Supabase-implementatie en echte pipeline. Bij uitvoering eerst actuele wijzigingen beoordelen. |
| V1-releasecanon | Duindorp SV V1 v1.0, 2 oktober 2026 | Basisregels en A01–A30. Staat integraal in `referentie/canon/`. |
| Addendum in dit pakket | 6 oktober 2026 | Gesloten teamtakenmarkt, clusterplaatsen, afzonderlijke tellingen, zes uitbreidingen, gebruikersbanners. |

Bij overlap is de oorspronkelijke canon de basis, met de expliciete latere uitbreidingen uit het addendum. Demobugs zijn geen productbesluiten. Een oudere tekst die zegt dat de backend nog niet bestaat, is achterhaald door de zeven aanwezige migraties en bestaande serverroutes. Nieuwe beslissingen worden klein en expliciet vastgelegd; verander geen productregel stil om implementatie makkelijker te maken.

## Inhoud van het pakket

De PDF en DOCX bevatten alle nieuwe handoverdocumenten en de pagina-inventaris. De ZIP bevat daarnaast Markdown, JSON-registers, de actuele prototypebron, bestaande workflows/ops als leesreferentie, originele canon en checksums. De volledige oorspronkelijke gitrepository zit er niet nogmaals in: Codex gebruikt de echte repository. Bestanden onder `referentie/` zijn geen opdracht om de actuele repository blind te overschrijven.

GitHub en VPS zijn al ingericht. De gecontroleerde workflow gebruikt nu automatisch `GITHUB_TOKEN` en de repositoryvariabele `STAGING_DEPLOY_ENABLED`; er zijn geen custom SSH-secrets in die workflow. Voor een echte app zijn runtime-Supabasegegevens en gekozen integratiecredentials nodig. Een nieuwe staging-DB-migratiefase heeft een apart, beperkt credential nodig; de configuratie daarvan staat in document 04.

## Definitie van gereed

Alle zichtbare functies hebben een servermatige uitvoering of een eerlijk gecontroleerde leesprojectie. Dezelfde bron geeft op alle betrokken pagina's dezelfde telling. Persoonsrechten, privacy, capaciteit, versies en idempotentie zijn aantoonbaar afgedwongen. Alle bestaande A01–A30 en aanvullende acceptaties hebben bewijs op de release-SHA. Visuele vergelijking dekt alle pagina's, tabs, modalen en relevante rollen op desktop en mobiel. Productie blijft uitgeschakeld.

Het pakket introduceert geen publicatie, repo-commit of infrastructuurwijziging op zichzelf. Het is de concrete bouwopdracht voor de volgende Codex-uitvoering.
