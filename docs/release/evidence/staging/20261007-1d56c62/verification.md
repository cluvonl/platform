# Stagingtussenrelease 1d56c62

De exacte groene bron `1d56c628969249c2a0b8e0dd7967a42dc9044dae` is via main naar staging gepromoveerd. [CI](https://github.com/cluvonl/platform/actions/runs/37599324842) en [imagebuild/deployment](https://github.com/cluvonl/platform/actions/runs/37600084020) zijn geslaagd. De [HTTP- en screenshotreadback](readback.json) controleert de uitgerolde release en alle zestien immutable migratiehashes uit het [releaseartifact](release-manifest.json).

De runtime staat nog in prototype-modus: liveness geeft 200; readiness geeft 503 met `APP_MODE_PROTOTYPE`; runtimeconfig geeft 503 met `SUPABASE_NOT_CONFIGURED`. De [afzonderlijke geverifieerde preflight](../20261007-credentials-1d56c62/verification.md) meet nul app-tabellen en nul toegepaste migraties. De artifacthashcontrole bewijst geen database-installatie.

Desktop 1440×1024 en mobiel 390×844 zijn werkelijk met de browser vastgelegd en visueel gecontroleerd. Club Signal en de bestaande navigatie blijven behouden. Deze afbeeldingen bewijzen uitsluitend het bestaande prototype. Functionele app, workers, Native login, staging RLS/privacy, operationele restore en volledige V1-acceptatie blijven open.
