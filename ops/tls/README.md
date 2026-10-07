# Openbare Supabase platform-CA's

`supabase-platform-root-ca.pem` bevat uitsluitend twee openbare rootcertificaten. Er staan geen private keys, projectcredentials of Cluvo-productiegegevens in. De `prod`-naam in de providerbron verwijst naar het gehoste Supabase-platform; de Cluvo-target blijft het aparte stagingproject.

De roots komen uit de reeds gepinde officiële Supabase CLI `v2.119.0`, tag-object `c66274cc6dc278a9413a6b0f099367ce150555ac`, commit `3cb948c5a70d31fbcb0fd1dcc616ee196a125cd0`. De [officiële bundelfunctie](https://github.com/supabase/cli/blob/3cb948c5a70d31fbcb0fd1dcc616ee196a125cd0/apps/cli-go/internal/gen/types/types.go#L114-L146) neemt beide platformroots op. De provider-interne staging-root uit die functie is niet opgenomen.

| Root | Officiële bron | DER SHA-256 | Geldigheid UTC |
|---|---|---|---|
| 2021 | [CLI-certificaat](https://github.com/supabase/cli/blob/3cb948c5a70d31fbcb0fd1dcc616ee196a125cd0/apps/cli-go/internal/gen/types/templates/prod-ca-2021.crt) | `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa` | 2021-04-28 10:56:53 → 2031-04-26 10:56:53 |
| 2025 | [CLI-certificaat](https://github.com/supabase/cli/blob/3cb948c5a70d31fbcb0fd1dcc616ee196a125cd0/apps/cli-go/internal/gen/types/templates/prod-ca-2025.crt) | `5f9b77951a7aa1303f9b58eea9bfa89e358cfdc15f9786ff10d4930a722c9ae2` | 2025-09-03 08:01:25 → 2035-09-01 08:01:25 |

De 2021-root is via gecontroleerd HTTPS opgehaald uit de expliciete URL in de [officiële dashboardtemplate](https://github.com/supabase/supabase/blob/a4910196b822f1c3bed12f8deed7b4ff99df0f20/apps/studio/hooks/custom-content/custom-content.json#L55) en bytegelijk met de DER uit de gepinde CLI-bron. Voor beide roots zijn CA-constraints, keyCertSign, geldigheid en zelfsignature gecontroleerd. Er is geen peer-certificaat als trust anchor gebruikt.

De bundlehash is `6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6`. De hosted preflight controleert die hash voordat hij deze roots toevoegt aan de runner-CA's en `sslmode=verify-full` gebruikt. De bestaande input `verify_system_ca` blijft behouden; false voert uitsluitend de afzonderlijke transport-/metadatacontrole uit. Er is geen automatische downgrade na een afwijzing.

De publieke bronnen bewijzen de herkomst van de trust anchors. Alleen een daadwerkelijk geslaagde hosted `verify-full`-verbinding bewijst ook het stagingservercertificaat en de hostname. Certificaatherkomst alleen geeft geen vrijgave voor migraties, appmodus of V1.
