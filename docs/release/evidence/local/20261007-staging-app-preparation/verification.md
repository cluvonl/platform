# Voorbereide stagingbroker — lokaal bewijs

Deze wijziging ondersteunt een expliciet vastgezette overgang van prototype naar de aangesloten core. De root-beheerde VPS-configuratie is hiermee niet gewijzigd. De actuele hosted controle en staging-readback staan in de afzonderlijke evidencefolders voor `aea2926`.

Uitgevoerd op 7 oktober 2026:

- `npm run lint`: geslaagd.
- `node --test tests/*.test.mjs`: 44 tests geslaagd, waaronder negen credentialchecks en zeven tests die de echte brokerfragmenten en het herstelpad uitvoeren.
- `bash -n ops/cluvo-deploy-staging`: geslaagd.
- De eerste metadataquery uit `scripts/staging-preflight.mjs` in een read-only transactie op de lokale wegwerpdatabase: `postgres` heeft geen eigenaarsbevoegdheid op `auth.sessions`; `supabase_admin` heeft die wel. Beide rollen kunnen de gecontroleerde SELECT-grants geven. De eerste query hield geen rekening met de geladen `supautils`-extensie en haar expliciete policy-grants. Dat is hieronder gecorrigeerd; de eerste eigenaarscheck bewijst geen ontbrekende DDL-bevoegdheid.
- `git diff --check`: geslaagd.

De gecorrigeerde metadataquery is eveneens daadwerkelijk in read-only transacties uitgevoerd. `postgres` heeft lokaal een geladen `supautils`-extensie en de expliciete providergrant voor `auth.sessions`; `supabase_admin` heeft de normale eigenaarsbevoegdheid. Beide geven nu terecht policy-DDL-bevoegdheid aan. Vervolgens heeft de lokale `postgres`-rol daadwerkelijk een tijdelijke `USING(false)`-policy op `auth.sessions` aangemaakt binnen een transactie. De transactie is teruggedraaid en de afwezigheid van de policy is teruggelezen. Er is geen hosted DDL uitgevoerd en er is geen eigenaarschap of gedeelde migratie gewijzigd. Lint en alle 44 Node-tests zijn opnieuw geslaagd.

De workflow kan nu de Ubuntu CA-bundle gebruiken voor verplichte hostname-/certificaatverificatie. Die sterkere hosted controle moet nog worden uitgevoerd; het toevoegen van een bestandspad bewijst geen succesvolle verificatie.

De broker bewaart targetpinning, beperkte sudo, rootless Docker, exacte image/SHA/run-ID, run-order en productieblokkades. Appmodus vereist expliciete project-/runtimeconfig, testontvangers, goedgekeurde rollbackcompatibiliteit en core-readiness. Herstel gebruikt de eerder geregistreerde image én modus en bevestigt herstel via health; een mislukte deploy blijft mislukt.

Open voor aangesloten staging: geautoriseerde installatie-/credentialoverdracht naar de VPS, gecontroleerde CA-verificatie, voldoende migratiebevoegdheid, remote backup/restore en migraties, negatieve RLS-/privacyproeven en echte Native login/OTP-aflevering. V1 en productie blijven ongeaccepteerd en geblokkeerd.
