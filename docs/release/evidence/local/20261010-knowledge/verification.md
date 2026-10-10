# Uitgevoerde kennisbankcontrole — 10 oktober 2026

De kandidaat heeft 101 artikelen in acht rolgebonden kennisbanken. De volledige documentatiedekking is vastgelegd in `docs/knowledge/coverage.json`: 28 V1-aanvullingen, A01–A30, 219 eerdere webfuncties, 147 mobiele functies, twintig schermen, zestien clubonderdelen, zeven platformonderdelen en 119 actuele native commands.

Uitgevoerde controles op de lokale kandidaat:

| Controle | Resultaat |
|---|---|
| Lint | Geen fouten; 21 bestaande waarschuwingen in eerdere bewijsbestanden, geen nieuwe kennisbankwaarschuwingen |
| TypeScript | Geslaagd |
| Volledige JavaScript-testset | 853 tests: 810 geslaagd, 43 conditioneel overgeslagen, nul fouten |
| Gerichte kennisbanktests | Alle zeven geslaagd, inclusief negatieve rollen, globale/tenantgebonden platformrechten, zoekprivacy en volledigheid |
| Next.js standalone-build | Geslaagd met alle nieuwe dynamische kennisbankroutes |
| WP0 en publieke Auth-styling | Alle vijf tests en echte Next-server-smoke geslaagd |
| Native kennisbankbrowserproef | 153 checks geslaagd met vier onafhankelijke echte OTP-sessies |

De native browserproef opent alle 101 artikelen en controleert de werkelijk zichtbare inhoud, genummerde stappen, private/no-store headers en Inter-styling. Hub en voorbeeldartikelen zijn getest op 320, 390, 768 en 1440 px. Zoekresultaten, rolfilter, inhoudsopgave, praktische vraagroute en dossier-/seizoenscontext worden door de echte app bediend. Tekst wordt daadwerkelijk verdubbeld en blijft binnen het scherm. Er zijn nul browser-pageerrors.

Negatieve controles weigeren onbevoegde directe financiële en platformartikelen, verkeerde omgeving, foreign tenant en extra padsegmenten. Een native commissiemandaat opent alleen de passende handleidingen. Een geopend platformartikel sluit na intrekking van het relevante eigen lokale proefmandaat; de oorspronkelijke grant wordt in de geïsoleerde database hersteld. Dit is geen wijziging aan een persoonlijk remote account.

De proef gebruikt uitsluitend `cluvo_admin_browser_20261009`, bestaande eigen lokale services en synthetische identiteiten. OTP blijft in geheugen en de lokale mailopvang. Er worden geen bronaccounts gekopieerd, remote mails gestuurd of productieresources gemaakt. `results.json` bevat hashes van de geteste kennisbankbron en browserhelpers. Er is geen claim van fysieke Samsung- of iPhone-acceptatie.

De screenshots tonen de werkelijke kandidaat:

- `member-article-390.png`: persoonlijk urenartikel op mobiel.
- `club-library-1440.png`: rolgebonden clubkennisbanken op desktop.
- `platform-library-390.png`: platformkennisbank op mobiel.

Stagingbewijs volgt uit de exacte commit, groene main-CI, de bestaande upgrade/restore/QA/deploygates en de uitgebreide actieve-image-browserreadback. Het lokale bewijs wordt daarmee niet tot een onbewezen remote resultaat verheven.
