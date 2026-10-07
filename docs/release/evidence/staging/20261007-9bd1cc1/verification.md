# Exacte stagingreadback — 9bd1cc1

[CI](https://github.com/cluvonl/platform/actions/runs/37590610667) en de [stagingbuild en brokerdeployment](https://github.com/cluvonl/platform/actions/runs/37591176121) zijn geslaagd op exact `9bd1cc19a398086b2177304870eb53c04e1d3db9`. De promotiecontrole bevestigde deze groene main-SHA voordat dezelfde commit naar staging ging.

De daadwerkelijke HTTP-readback in [readback.json](readback.json) bevestigt deze SHA op `https://staging.cluvo.nl`: liveness 200, omgeving staging, modus prototype; readiness 503 met `APP_MODE_PROTOTYPE`; runtimeconfig 503 met `SUPABASE_NOT_CONFIGURED`. Het [releaseartifact](release-manifest.json) bevat de immutable imagedigest en zestien migratiehashes, elk gecontroleerd tegen de exacte Git-tree van deze commit. Dit zijn gepubliceerde bronbestanden, geen bewijs van remote toepassing.

De remote counts zijn afzonderlijk gemeten door de [volledig geverifieerde read-only credentialpreflight](../20261007-credentials-9bd1cc1/verification.md), eerder dan deze HTTP-capture: nul app-tabellen en nul toegepaste Cluvo-migraties. De readback vermeldt die bron en het meettijdstip expliciet. Deze HTTP-capture leest de hosted database niet opnieuw.

De screenshots op 390×844 en 1440×1024 zijn daadwerkelijk op de uitgerolde site gemaakt en visueel gecontroleerd. De bestaande Club Signal-kaarten en mobiele/desktopnavigatie blijven behouden.

Dit bewijst de tussenrelease in prototype-modus. De afzonderlijke echte testmail is door SendGrid aangenomen, maar de gebruiker heeft ontvangst nog niet bevestigd. Functionele appkoppeling, staging Native/RLS/privacyproeven, backup/restore, workers, OTP/uitnodiging en V1-acceptatie blijven open. Er zijn geen productieacties uitgevoerd.
