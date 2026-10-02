# Herkomst en technische bronnen

Gecontroleerd op 2 oktober 2026. Documentatie verandert; verifieer bij implementatie de actuele versies. De productbesluiten voor Cluvo komen uitsluitend uit de meegeleverde canon en de gebruikersinstructies.

- Canon: `Duindorp_SV_V1_Releasecanon_v1.0.docx`, 2 oktober 2026, 18 pagina's. De oorspronkelijke bestandsbytes en de PDF-referentie zijn meegenomen.
- Prototype: [Cluvo — Club Signal](https://cluvo-club-signal.famgoldenbelt.chatgpt.site).
- Broncommit: `5d96234ade7dba5f79bdd0f4ddbc21e26fc13801`.
- [Next.js: standalone, self-hosting en runtimeconfiguratie](https://nextjs.org/docs/app/guides/self-hosting).
- [Next.js: output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- [Supabase: SSR-clients en sessieverificatie](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- [Supabase: e-mail-OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless).
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: API-grants](https://supabase.com/docs/guides/api/securing-your-api).
- [Supabase: omgevingen en migraties](https://supabase.com/docs/guides/deployment/managing-environments).
- [Supabase: Storage-beveiliging](https://supabase.com/docs/guides/storage/security/access-control).
- [Supabase: back-ups](https://supabase.com/docs/guides/platform/backups).
- [Supabase: changelog](https://supabase.com/changelog.md).
- [GitHub: environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
- [GitHub: self-hosted runners](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners).

De Next.js-starter pint Next.js 16.3.8, `@supabase/ssr` 0.12.7 en `@supabase/supabase-js` 2.117.2. De versies zijn gecontroleerd via de officiële npm-registry. Het oorspronkelijke prototype had Next.js 16.3.4 als compatibiliteitsdependency voor Vinext; de referentielockfile blijft ongewijzigd.

De commitpins voor Actions v4 zijn via de bijbehorende officiële GitHub-repositories opgehaald. Docker en CI gebruiken Node 24; de lokale build, typecheck en elf tests zijn geslaagd met Node 24.19.0. De tests omvatten acht domeinproeven en drie controles op blokkades bij het opstarten. De Node 24-tag voor de Dockerbasis is nog geen vaste digestsnapshot: pin bij het inrichten van de host een actuele, geteste digest.

Het inlinen van publieke Next.js-variabelen, SSR-cookies, RLS en bescherming van private omgevingen volgen uit de technische bronnen. De datamodellen en workflows van Cluvo zijn maatwerkontwerp. Een volledig SQL-databaseontwerp wordt nergens als al getest of uitgevoerd gepresenteerd.
