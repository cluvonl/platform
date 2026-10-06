# 09 — Bronnen, provenance en bewijsgrenzen

## Direct gecontroleerd in deze overdracht

- Actuele Sites-bron: `e9c1d8bca2089b0944577eed73d1bedf7e70a3b6`, project `appgprj_6ac4423a3f00819194808afc8e9dc22a`, live URL `https://cluvo-prototype.dgwebserv.chatgpt.site`.
- Platformbron en workflows: `47386491859b47fbebf85c3b209724dcc20407fc`; remote main en staging op dezelfde SHA bij controle op 6 oktober.
- Alle 23 actieve pagina's, shell en domain/UI-bronnen; automatisch AST-overzicht van 82 named functies, 206 benoemde knoppen/callbacks en modaal/veldmetadata. Dit is een technische broninventaris; 206 is geen telling van afzonderlijke productfuncties.
- Zeven migraties, 140 `app`-tabellen, 52 API-functiondefinities en 16 API-views; serverroute/RPC-verwijzingen op bron-SHA.
- Originele V1-releasecanon en A01–A30; nieuw addendum voor teammarkt/zes uitbreidingen/uitlegbanners.
- Huidige prototypechecks: 29 Node-tests voor team-/coordination-/helpflows; typecheck en statische build in bewijsregister. Resultaatvelden worden bij pakketvalidatie aangevuld met de werkelijk uitgevoerde uitkomst.

## Niet als nieuw bewijs geclaimd

Geen nieuwe SSH-/VPS-configinspectie, remote-Supabase-schema-inspectie, secretwaarden of GitHub-secretlijst. Geen complete browserwandeling, volledige screenshotset, echte OTP/mail/push/Sportlinkverzending of end-to-end stagingrelease in deze documentopdracht. De oudere repo-evidence uit 2 oktober is herkenbaar als historisch en blijft los van nieuwe broninventaris/tests. Geen status A01–A30 wordt door deze audit op PASSED gezet.

Het eerder ingerichte stagingdomein en broker/runtimegebruikers zijn meegenomen als bestaande operationele context; Codex verifieert ze bij implementatie tegen de rootbeheerde targetconfig. Een lokaal workflowbestand kan niet bewijzen dat een runtimecredential geldig is of een worker op de VPS draait.

## Officiële technische bronnen

Geraadpleegd op 6 oktober 2026; primaire documentatie. Controleer bij uitvoering ook de gepinde lokale CLI-/bibliotheekversie. De Cluvo-model- en commandvoorstellen zijn eigen projectontwerp en worden niet toegeschreven aan deze documenten.

- GitHub automatic token en workflowtriggergedrag: https://docs.github.com/en/actions/concepts/security/github_token
- GitHub deploymentomgeving/branchbescherming: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments
- GitHub variables: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables
- Supabase publishable/secret keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase server-side Auth-client: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Supabase CLI db-push en db-url/dry-run: https://supabase.com/docs/reference/cli/supabase-db-push
- Supabase data/RLS: https://supabase.com/docs/guides/database/secure-data

De ZIP bevat `PROVENANCE.json`, het functionele/registerbewijs en `SHA256SUMS.txt`. Checksums leggen de meegeleverde referentie vast; ze zijn geen handtekening of bewijs van werkende staging. Bouw- en package-artifacts, credentials, node_modules en gitgeschiedenis zijn bewust niet geëxporteerd.
