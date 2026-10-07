# Herstel van de stagingimagebuild — 7 oktober 2026

De [stagingbuild van `b08415f`](https://github.com/cluvonl/platform/actions/runs/37560492004) faalde in Docker bij de brokercontracttests: `python3` ontbrak in de vaste Node bookworm-slim bouwomgeving. De deployjob is overgeslagen. Een daadwerkelijke livenesscontrole daarna bevestigde dat de vorige release `aea29261335876672a6c9aac96f6b648fccbb12e` nog actief was in prototype-modus.

De Dockerfile installeert nu `python3=3.11.2-1+b1` uitsluitend in de bouwfase. Deze exacte packageversie is teruggelezen uit de getekende Debian Bookworm-package-index. De top-level testvoorwaarde vereist een werkende Python-interpreter, zodat negatieve validatietests niet kunnen slagen door een ontbrekend proces.

Een afzonderlijke review reproduceerde een prototype-aanvraag met behouden Supabase-credentials en een lege compatibiliteitslijst. De broker weigert deze aanvraag nu. Een vastgezette URL zonder keys blijft toegestaan als losgekoppeld prototype; expliciet goedgekeurd herstel naar de eerder geregistreerde prototype-image blijft geldig. Alle 17 gerichte broker-/preflighttests zijn na deze correctie opnieuw geslaagd.

Het volledige lokale image is opgebouwd vanuit een exacte Git-archive van `b08415f`, met uitsluitend de vier in `build-results.json` gehashte fixbestanden. De onafgeronde intakehulpwijziging is niet in die build opgenomen: vijftien migraties. De bouwfase voerde typecheck, alle 45 Node-tests en Next.js build succesvol uit. Het uiteindelijke runtime-image is gestart en via echte HTTP teruggelezen: correcte staging/prototype-liveness, geblokkeerde prototype-readiness en ontbrekende runtime-Supabaseconfig. In de runtime is Python aantoonbaar niet aanwezig. De tijdelijke testcontainer is daarna gestopt.

Lint, Bash-syntax en `git diff --check` zijn geslaagd. Hosted CI/deployment voor de fix, VPS-installatie van de root-beheerde patch, de officiële staging-CA en aangesloten database-/Auth-readback blijven afzonderlijke stappen. V1 en productie zijn niet vrijgegeven.
