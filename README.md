# Cluvo V1 — lokale implementatietranche

Deze werkmap bevat het Club Signal-prototype én de eerste echte Next.js/Supabase-productketen: persoonlijke e-mail-OTP, tenantwerkruimtes, huishouduitnodiging en intake, veilige dienstboeking, presentiebevestiging en een append-only urenledger. De SQL-migraties modelleren daarnaast de domeinen van WP3–WP11 en hebben lokale pgTAP-dekking. Dit is nog geen geaccepteerde of productieklare V1: alle A01–A30 blijven open totdat de vereiste staging-, browser- en providerproeven zijn uitgevoerd.

## Lokaal

Gebruik de Node-versie uit `.nvmrc`. Voer `npm ci` en daarna `npm run dev` uit. Open [http://localhost:3000](http://localhost:3000). `APP_MODE=prototype` toont de geïsoleerde visuele referentie zonder backend. `APP_MODE=app` vereist een expliciete `APP_ENV`, Supabase-URL, publishable key, server-only secret key, `APP_URL` en een afzonderlijk `INVITATION_TOKEN_SECRET` van minimaal 32 bytes; zie `.env.example`.

Met `npm run check` voer je lint, typecheck, Node-contracttests, de productiebuild en de lokale HTTP-rooktest uit. De databasecontroles staan apart omdat zij een lokale Supabase/Postgres-omgeving vereisen: `npm run db:start`, `npm run db:test` en, met `DATABASE_URL`, `npm run db:test:race` plus `npm run db:test:locks`.

## Status

- UI, CSS, logo en de fysiek gescheiden prototypeweergave zijn behouden.
- Vinext, Cloudflare, Sites-auth en de connectorruntime zijn niet vereist.
- Echte app-routes vertrouwen uitsluitend op serverclaims, API-readmodels, RLS en transactionele commands; prototype-`localStorage` is daar geen autoriteit.
- `/api/health/live` controleert het proces. `/api/health/ready` controleert in appmodus de databaseafhankelijkheid, maar rapporteert ook dan `release_ready=false` zolang de releasegate dichtstaat.
- De browser krijgt alleen de Supabase-URL en publishable key. De secret key en uitnodigings-HMAC blijven server-only.
- `APP_MODE=app` mag lokaal, in test en op staging draaien. `APP_ENV=production` is technisch geblokkeerd totdat volledige acceptatie en expliciete vrijgave zijn vastgelegd.
- De bestaande demo-serviceworker wordt buiten de oorspronkelijke Sites-host niet geregistreerd. Bouw het offlinegedrag opnieuw en cache geen privédossiers of private API-responses.

## Hosting

Lees `docs/05_DEPLOYMENT_EN_OPERATIE.md`, `docs/06_TEMPLATEHANDLEIDING.md` en `docs/release/v1-evidence.md`. CI verifieert app en migraties; staging moet eerst met de bedoelde repositoryvariabelen, secrets, runner en host worden ingericht. Production bestaat uitsluitend als uitgeschakelde template met een harde stop. Deze lokale run heeft niets op een VPS, provider of remote Supabase-project aangemaakt.

## Starten met Codex

Lees `AGENTS.md` en gebruik `docs/CODEX-STARTPROMPT.md`. Alle technische documenten, de canon en het acceptatieregister staan ook in deze repositorymap. Bewaar het volledige overdrachtspakket als bronreferentie; daarin staan de oorspronkelijke, onveranderde prototype-export en merkassets.
