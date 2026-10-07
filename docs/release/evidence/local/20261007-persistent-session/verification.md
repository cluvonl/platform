# Blijvende databaseverbinding — lokaal bewijs

De gerichte Node-suite heeft 11 geslaagde tests. Eén daarvan start 24 echte Python-unitproeven in een eigen proces zonder credentials. Deze proeven valideren de vaste targetroute, SQL-/protocol-PIDregels, lifecycle, alleen vaste queries, onbekende providerfouten, lockverlies, afwijkende backend, negatieve-queryuitkomsten en zichtbare closefouten. De Pythonlifecycle gebruikt fixtures en vormt geen databasebewijs.

De volledige canonical Node-suite heeft 285 geslaagde tests, nul failures/skips/TODOs. Lint met `--max-warnings 0` en TypeScriptcontrole zijn geslaagd. `local-results.json` bindt de exact geteste bronnen op SHA256. De geoptimaliseerde Next.js-build en WP0-standalone-smoke zijn eveneens geslaagd. CI, deployment en hosted meting worden pas na werkelijke uitvoering vastgelegd.

Deze bestanden geven geen dump-, herstel-, migratie- of V1-toestemming. De bestaande 16 migraties, runtimegates en productieblokkade zijn niet veranderd. Het nieuwe handmatige meetpad uploadt uitsluitend het vaste gesaniteerde rapport; private queryresultaten en snapshot-/backendIDs blijven in memory.
