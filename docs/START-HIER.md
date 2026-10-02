# Cluvo — volledige Codex-overdracht

Versie 1.0 · 2 oktober 2026 · eigenaar Danny Goldenbelt

Dit pakket draagt de gekozen **Club Signal**-vormgeving, de exacte bestaande prototypebron en de volledige V1-opdracht over naar een bouwtraject met **Next.js + Supabase**. Het bevat bovendien een gewone Next.js-startversie met dezelfde UI, bouwstenen voor Supabase SSR en templates voor staging. De V1-backend is nog niet gebouwd.

## In drie stappen verder

1. Pak het volledige ZIP-bestand uit in een eigen projectmap en open die map in Codex.
2. Gebruik `CODEX-STARTPROMPT.md` als eerste opdracht. Codex leest de canon, de gapanalyse en het deploybeleid voordat productlogica wordt veranderd.
3. Laat Codex de werkpakketten in volgorde uitvoeren, met echte serveropslag en tests. Begin in `nextjs-starter/`; dit wordt de root van de nieuwe private Git-repository. `reference/prototype-source/` is uitsluitend een onveranderlijke referentie.

## Wat zit erin?

| Bestand/map | Gebruik |
|---|---|
| `CODEX-STARTPROMPT.md` | Direct te kopiëren startopdracht |
| `AGENTS.md` | Vaste afspraken voor de bouwagent |
| `canon/` | Oorspronkelijke V1-canon als DOCX/PDF en doorzoekbare tekst |
| `docs/01_CANON_EN_GAPANALYSE.md` | Canonregels, alle 28 aanvullingen, ontbrekende functies en concrete hiaten in de demo |
| `docs/02_ACCEPTATIE_EN_WERKPAKKETTEN.md` | A01–A30, verticale bouwfasen en bewijs per release |
| `docs/03_SUPABASE_DATAMODEL_EN_RECHTEN.md` | Ontwerp voor tenants, huishoudens, uren, rollen en privacy |
| `docs/04_DOMEINTRANSACTIES_EN_INTEGRATIES.md` | Statusovergangen, RPC-contracten, outbox en Sportlink |
| `docs/05_DEPLOYMENT_EN_OPERATIE.md` | Volledige doelarchitectuur voor staging en latere productie |
| `docs/06_TEMPLATEHANDLEIDING.md` | Precies wat de meegeleverde scripts doen en nog niet doen |
| `docs/07_UI_EN_MIGRATIE.md` | Vormgeving behouden en de demo gefaseerd vervangen |
| `docs/08_BESLUITEN_EN_INVOER.md` | Vastgezette keuzes en infrastructuurgegevens die nog nodig zijn |
| `docs/09_VALIDATIE.md` | Werkelijk uitgevoerde controles en grenzen |
| `docs/10_BRONNEN.md` | Officiële technische documentatie |
| `nextjs-starter/` | Next.js-app, lockfile, Supabase-helpers, rekentests, Docker en workflows |
| `reference/prototype-source/` | Exacte Git-export van het gepubliceerde prototype |
| `branding/` | Bestaand logo, iconen en dashboardreferentie |
| `SOURCE-PROVENANCE.json` | Broncommit en herkomst |
| `MANIFEST-SHA256.txt` | Checksums van alle pakketbestanden |

## Vast deploybesluit

`main` is de integratiebranch en deployt, na controles, **alleen naar staging**. Staging is een omgeving, niet stilzwijgend een extra ontwikkelbranch. Productie ontvangt later exact de goedgekeurde broncommit van staging en hetzelfde image-digest. Er wordt dan niet opnieuw gebouwd vanaf de laatste `main`.

Productie blijft technisch geblokkeerd: een uitgeschakelde workflowtemplate met een harde stop, `v1_ready=false`, weigering tijdens runtime bij `APP_ENV=production` en geen meegeleverde productiecredentials. Pas na volledige V1-acceptatie mag dit met een afzonderlijke, reviewbare wijziging worden geactiveerd.

## Direct de startversie bekijken

Voer in `nextjs-starter/` met Node 22.13+ of Node 24 eerst `npm ci` en daarna `npm run dev` uit. Open vervolgens [http://localhost:3000](http://localhost:3000). De startversie heeft geen Supabase-project nodig om de demo te bekijken. Voor echte ledenopslag is WP1 vereist. `npm run typecheck`, `npm test` en `npm run build` voeren de meegeleverde controles uit.

## Wat is wel en niet geleverd?

Er is een overdraagbare UI-startbasis, een compleet bouw- en acceptatieplan, een datamodelontwerp en concrete deploytemplates. Er zijn nog geen Supabase-projecten, GitHub-repository, VPS, domeinen, providercredentials of echte migraties aangemaakt. Dit pakket beweert niet dat OTP, RLS, gelijktijdige boekingen, automatische e-mail of financiële verwerking al productiegeschikt zijn.

De oorspronkelijke demo blijft beschikbaar: [Cluvo — Club Signal](https://cluvo-club-signal.famgoldenbelt.chatgpt.site).
