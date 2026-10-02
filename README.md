# Cluvo Next.js starter

Dit is de bestaande visuele demobasis, overgezet naar gewone Next.js, met Supabase SSR-bouwstenen en stagingtemplates. De volledige backend moet nog worden geïmplementeerd volgens de documenten in `docs/`. Dit is nog geen productieklare V1.

## Lokaal

Gebruik Node 24 (hiermee getest), of Node 22 vanaf 22.13. Voer `npm ci` en daarna `npm run dev` uit. Open [http://localhost:3000](http://localhost:3000). De lokale demo werkt zonder Supabase-credentials. Met `npm run typecheck`, `npm test` en `npm run build` voer je de meegeleverde controles uit. Houd de lockfile in Git.

## Status

- UI, CSS, logo en demo-interacties zijn behouden.
- Vinext, Cloudflare, Sites-auth en de connectorruntime zijn niet vereist.
- De Supabase-clients zijn bouwstenen; de demo gebruikt nog `localStorage` en een rolwisselaar.
- `/api/health/live` controleert alleen het app-proces. `/api/health/ready` geeft bewust 503: de V1-backend is niet gereed.
- De runtimeconfiguratie geeft alleen de publishable key en URL terug. Zonder configuratie geeft het endpoint 503.
- `APP_MODE=app` en `APP_ENV=production` zijn opzettelijk geblokkeerd totdat de bijbehorende werkpakketten en gates zijn voltooid.
- De bestaande demo-serviceworker wordt buiten de oorspronkelijke Sites-host niet geregistreerd. Bouw het offlinegedrag opnieuw en cache geen privédossiers of private API-responses.

## Hosting

Lees `docs/05_DEPLOYMENT_EN_OPERATIE.md` en `docs/06_TEMPLATEHANDLEIDING.md`. De workflows staan op de juiste plek, maar de stagingdeploy moet eerst met repositoryvariabele `STAGING_DEPLOY_ENABLED` worden geactiveerd. De beschreven runner en hostconfiguratie zijn vereist. Production bestaat uitsluitend als `.disabled`-template met een harde stop. Dit pakket heeft niets op een VPS of in Supabase aangemaakt.

## Starten met Codex

Lees `AGENTS.md` en gebruik `docs/CODEX-STARTPROMPT.md`. Alle technische documenten, de canon en het acceptatieregister staan ook in deze repositorymap. Bewaar het volledige overdrachtspakket als bronreferentie; daarin staan de oorspronkelijke, onveranderde prototype-export en merkassets.
