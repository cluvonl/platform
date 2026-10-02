# UI behouden en de demo vervangen

## Visuele bron

Design 1 heet Club Signal. Neem `app/globals.css`, `components/cluvo/ui.tsx`, de schermindeling en `public/brand/cluvo-logo.png` als referentie. De primaire kleuren zijn: zijbalk `#111516`, achtergrond `#F5F6F7`, tekst `#202426`, accent `#F45F49` en wit `#FFFFFF`. Het dashboard combineert rustige kaarten met één duidelijke koraalkleurige hoofdkaart. De hoofdnavigatie staat links; context en rol staan bovenin. Houd herkenbare statussen, consistente marges, afgeronde panelen en overzichtelijke tabellen.

Het geleverde logo is de bestaande rasterasset; het favicon is een aparte, eenvoudige SVG. Presenteer het logo niet als originele vector. Opschonen of vectoriseren van het logo mag later als expliciete assetverbetering, zonder het gekozen concept te veranderen. De CSS noemt Inter met Arial als fallback; er wordt geen extern font als bewezen onderdeel meegeleverd. Documenteer de licentie van een eventueel ingesloten font.

## Routevertaling

| Demohash | Beoogde Next.js-route | Hoofddoel |
|---|---|---|
| `overzicht` | `/c/[club]/overzicht` | Rolgebonden startpagina |
| `taken` | `/c/[club]/taken` | Markt, voorwaarden en boeking |
| `diensten` | `/c/[club]/diensten` | Eigen afspraken en presentie |
| `ruilmarkt` | `/c/[club]/ruilmarkt` | Overname en wederzijdse ruil |
| `planbord` | `/c/[club]/planning` | Commissieplanning per dag, week of maand |
| `huishoudens` | `/c/[club]/huishoudens` | Dossiers en wintercontrole |
| `intake` | `/c/[club]/intake/[invitation]` | Persoonlijke intake |
| `commissies` | `/c/[club]/commissies/[committee]` | Werkruimte en documenten |
| `kanban` | `/c/[club]/commissies/[committee]/bord` | Kaarten en subtaken |
| `teams` | `/c/[club]/teams/[team]` | Teamoudertaken |
| `wedstrijden` | `/c/[club]/wedstrijden` | Eigen, gezins- en clubwedstrijden |
| `agenda` | `/c/[club]/agenda` | Kalenderlagen en RSVP |
| `berichten` | `/c/[club]/berichten` | Gesprekken en mentions |
| `acties` | `/c/[club]/acties` | Persoonlijke acties |
| `beleid` | `/c/[club]/beleid` | Acceptatie per lid |
| `waardering` | `/c/[club]/waardering` | Momenten, budget en eigenaar |
| `opleidingen` | `/c/[club]/opleidingen` | Inwerken en kwalificaties |
| `vacatures` | `/c/[club]/vrijwilligersfuncties` | Werving en aanstelling |
| `rapportages` | `/c/[club]/rapportages` | Rolgebonden inzichten |
| `financien` | `/c/[club]/financien` | Gecontroleerde bijdragen en vrijwilligerspot |
| `templates` | `/c/[club]/communicatie` | Templates, regels, log en segmenten |
| `instellingen` | `/c/[club]/instellingen` | Configuratie, import en jaarovergang |

Dit is de beoogde technische routestructuur. De starter behoudt nog de huidige hashrouting om de UI zonder functionele verandering overdraagbaar te maken. De nieuwe authenticatieroutes `/login` en `/auth/verify` horen bij WP1. Een URL met een clubslug geeft geen rechten: de server verifieert lidmaatschap en scope.

## Migratiestrategie

Bewaar lokale voorbeeldfixtures apart. Bouw per werkpakket serverqueries en mutaties en sluit pas daarna het betreffende UI-onderdeel aan. Splits de grote prototypecomponentbestanden op in domeincomponenten waar dat de begrijpelijkheid helpt. Valideer invoer aan de serverzijde en toon pas definitief succes na een bevestigde servertransactie. Bij direct, optimistisch slepen kan de UI terugrollen wanneer de onderliggende gegevens zijn gewijzigd of een conflict ontstaat. Toon na een 409-conflict het actuele rooster.

Geef ieder scherm een laad-, fout-, leeg- en geenrechtenstatus. Een 500-fout is geen lege takenmarkt. Behoud de focus na een fout, geef velden labels en ondersteun toetsenbordbediening en bediening zonder slepen. Vergelijk desktop en mobiel tegelijk met de referentie. Laat de layout ook op middelgrote schermen adaptief werken. Vaste pixelkolommen mogen alleen binnen een bewust horizontaal scrollbaar planbord of kanbanbord passen.

Tekstvergroting, contrast en toegankelijkheid hebben aanvullende controle nodig: de huidige demometadata is op sommige plekken klein. Verbeter de leesbaarheid met behoud van de uitstraling. Lever bewijs voor onder andere breedtes van 320, 390, 768 en 1440 px, 200% tekstvergroting, verminderde beweging, toetsenbordbediening en dialoogfocus.

## PWA

Behoud het manifest en de iconen als startpunt. Bouw het cachebeleid opnieuw op: alleen appassets waarvoor geen authenticatie nodig is mogen offline beschikbaar zijn. Bewaar geen private intakes, familiegegevens, beleidsbewijzen, financiële data of runtimeconfiguratie in de cache.

Toon offlineacties als niet verwerkt. Gebruik geen `localStorage`-wachtrij voor boekingen zonder een expliciet protocol voor conflicten. Uitloggen wist private lokale gegevens en caches met verenigingsgegevens. Test serviceworker-updates, rollback en het uitschrijven van pushsubscriptions.

## Focus van de overdracht

De huidige afbeelding is een visuele referentie, geen bewijs voor iedere V1-actie. De 30 canonproeven, negatieve privacyproeven en concurrencytests bepalen of de implementatie functioneel klaar is.
