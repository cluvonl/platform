# Voorbereide stagingbroker — lokaal bewijs

Deze wijziging ondersteunt een expliciet vastgezette overgang van prototype naar de aangesloten core. De root-beheerde VPS-configuratie is hiermee niet gewijzigd. De actuele hosted controle en staging-readback staan in de afzonderlijke evidencefolders voor `aea2926`.

Uitgevoerd op 7 oktober 2026:

- `npm run lint`: geslaagd.
- `node --test tests/*.test.mjs`: 44 tests geslaagd, waaronder negen credentialchecks en zeven tests die de echte brokerfragmenten en het herstelpad uitvoeren.
- `bash -n ops/cluvo-deploy-staging`: geslaagd.
- De exacte metadataquery uit `scripts/staging-preflight.mjs` in een read-only transactie op de lokale wegwerpdatabase: beide rollen gaven uitsluitend de verwachte metadata. `postgres` heeft geen policy-DDL-bevoegdheid op `auth.sessions`; `supabase_admin` heeft die wel. Beide rollen kunnen de gecontroleerde SELECT-grants geven. Dit is lokaal bewijs, geen uitspraak over de hosted bevoegdheden.
- `git diff --check`: geslaagd.

De broker bewaart targetpinning, beperkte sudo, rootless Docker, exacte image/SHA/run-ID, run-order en productieblokkades. Appmodus vereist expliciete project-/runtimeconfig, testontvangers, goedgekeurde rollbackcompatibiliteit en core-readiness. Herstel gebruikt de eerder geregistreerde image én modus en bevestigt herstel via health; een mislukte deploy blijft mislukt.

Open voor aangesloten staging: geautoriseerde installatie-/credentialoverdracht naar de VPS, gecontroleerde CA-verificatie, voldoende migratiebevoegdheid, remote backup/restore en migraties, negatieve RLS-/privacyproeven en echte Native login/OTP-aflevering. V1 en productie blijven ongeaccepteerd en geblokkeerd.
