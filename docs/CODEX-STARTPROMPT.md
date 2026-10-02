# Startopdracht voor Codex — Cluvo V1

Je bouwt Cluvo voor Danny Goldenbelt: een generiek platform voor meerdere verenigingen, met verenigingstaken, vrijwilligers, huishoudens, commissies en teamouders. Duindorp SV is de eerste voorbeeldvereniging. Neem het bestaande **Design 1 — Club Signal** nauwkeurig over. Ontwerp geen nieuw dashboard en reduceer de functionele scope niet tot een MVP.

## Eerst lezen, dan uitvoeren

Lees `AGENTS.md`, `START-HIER.md`, het volledige `canon/RELEASECANON-V1.txt`, `docs/01_CANON_EN_GAPANALYSE.md`, `docs/02_ACCEPTATIE_EN_WERKPAKKETTEN.md` en de overige technische documenten. Als je al in de nieuwe repository staat, vind je dezelfde documenten onder `docs/` en de canon onder `docs/canon/`. De laatste expliciete besluiten van Danny zijn leidend, daarna de canon en daarna deze technische uitwerking. De 28 voorstellen horen allemaal bij V1.

Bekijk de bron, merkassets en screenshot. Het originele prototype staat in `reference/prototype-source/`, met de exacte broncommit in `SOURCE-PROVENANCE.json`. De werkmap voor verdere ontwikkeling is `nextjs-starter/`, niet de referentiekopie. De referentie heeft Sites/Vinext-configuratie; neem die hosting, authenticatie en connectorruntime niet mee in het Next.js-product.

## Stack en omgevingen

- Echte Next.js App Router, TypeScript, de bestaande Tailwind/Shadcn/Radix UI en het Club Signal-design.
- Supabase: Postgres, Auth met persoonlijke e-mail-OTP, private Storage en beperkte Realtime. Gebruik afzonderlijke projecten per omgeving; begin alleen lokaal en op staging.
- Een tenant op alle clubdata, relationele scopecontrole, RLS, expliciete grants, stabiele ID's en transactionele servermutaties.
- Houd account, persoon, huishouddossier, vertegenwoordiging, seizoensverplichting, functionele aanstelling en systeemrecht afzonderlijk.
- Pin dependencies en CLI-versies en gebruik lockfiles. Gebruik actuele officiële Next.js- en Supabase-documentatie. Geen service-role- of geheime sleutels in de browser.
- Aanbevolen hostingpad: een private GitHub-repository, een Next.js standalone Docker-image op een VPS, een TLS-reverse-proxy, GitHub-hosted builds en een dedicated runner voor stagingdeployments. Verifieer of de beschikbare infrastructuur hiermee overeenkomt voordat je die inricht.

## Verplicht deploybeleid

De flow is **main → staging → production**. `main` is de integratiebranch; staging is de testomgeving. Elke vertrouwde versie van `main` gaat pas na geslaagde controles naar staging. Werk zolang V1 niet gereed is uitsluitend daar. Maak geen productieprojecten, productiecronjobs of actieve productieworkflow.

Productie blijft geblokkeerd. Omzeil of verwijder de gates niet om een build of test groen te krijgen. Een volledige V1-acceptatie én expliciet akkoord van Danny zijn nodig voor latere activering. Promoveer dan exact de bewezen stagingcommit en hetzelfde image-digest, met afzonderlijke runtimeconfiguratie en database. Bouw productie niet opnieuw vanaf de inmiddels gewijzigde branchkop. Gebruik geen directe trigger van `main` naar productie.

## Functionele regels die nooit mogen verschuiven

1. Standaard 720 minuten per huishouden per heel seizoen, met een winterdoel van 360 minuten. Zowel 8 uur vóór + 4 uur na de winterstop als 12 uur vóór de winterstop voldoet. Een winterinhaalplaatsing valt binnen het bestaande jaardoel. Beoordeel eerst onbevestigde registraties; plan hetzelfde tekort niet dubbel in.
2. Configureerbare, erkende vaste rollen stellen het hele expliciet gekoppelde huishouden vrij. Geen fictieve uren, geen automatische beheertoegang en geen stille terugwerkende claim bij rolbeëindiging.
3. Iedere persoon heeft een eigen intake en bevoegdheden. Een extra uitvoerder krijgt toegang via een aanvaarde uitnodiging. Gescheiden ouders krijgen onafhankelijke toegang; een tweede account of intake maakt geen tweede verplichting. Kindkoppelingen en vertegenwoordiging zijn expliciet.
4. Teamtaken leveren 0 uur op, tenzij de vrijwilligerscommissie vooraf marktpublicatie en urenwaarde goedkeurt. Scheidsrechterverzoeken krijgen ook een beoordeling door wedstrijdzaken. Kaartafronding boekt nooit uren.
5. Valideer de werkelijke uitvoerder, capaciteit, leeftijd, kwalificaties, overlap en begeleiding altijd aan de serverzijde. De laatste plek, ruil, wachtlijstaanbod, correcties en afkoop worden transactioneel en idempotent verwerkt.
6. Leg de afmeldtermijn bij inschrijving vast; ziekte en nood zijn altijd meldbaar. Bij overname blijft de oorspronkelijke afspraak bestaan tot definitieve acceptatie. Controleer bij een ruil beide diensten samen.
7. Laat de exacte beleidsversie per lid actief accepteren; openen is geen acceptatie. Alleen een bevoegde vertegenwoordiger kan voor geselecteerde kinderen akkoord gaan. Bewaar alle bewijs- en versiehistorie.
8. Standaard €150 per 12 uur, proportioneel berekend op basis van minuten en eurocenten. Een open bezwaar, beoordeling of nog te bevestigen uren blokkeren de afrekening. Geen dubbele afkoop- en tekortbijdrage. Gebruik twee verschillende bevoegde authenticatie-actoren voor uitzonderingen.
9. Maximaal één verzamelmail voor nieuwe taken per persoon per lokale kalenderdag. Per nieuwe passende taak één pushgebeurtenis, zonder dagmaximum. Retries mogen geen duplicaten veroorzaken. Mentions verlenen geen toegang.
10. Synchroniseer wedstrijden tweemaal per dag, standaard om 06:00 en 18:00 in `Europe/Amsterdam`, met zomertijdcorrectie. Laat bestaande diensten bij een wedstrijdwijziging eerst beoordelen. Gebruik ledenvelden uit Sportlink alleen als de geautoriseerde bron dit echt ondersteunt; een gecontroleerde CSV-fallback blijft nodig.

## Begin daadwerkelijk met WP0 en WP1

Inventariseer eerst de echte repository, huidige bestanden, instructies en beschikbare omgeving. Bewaar bestaande wijzigingen. Start de Next.js-startbasis, draai de meegeleverde checks en leg referentiebeelden vast. Maak een traceerbaar implementatiebord vanuit de acceptatiematrix. Zet ongeteste onderdelen niet op gereed.

Voer daarna een volledige eerste verticale keten uit: tenant, echte OTP, sessie, beperkte gebruikersrechten en een persoonlijk huishouddossier met intake. Doe dit met lokale migraties, RLS, negatieve toegangstests en serveropslag. Verbind vervolgens taakinschrijving → presentie → urenledger → huishoudvoortgang, inclusief concurrencyproeven. Bouw de overige werkpakketten in volgorde totdat de hele canon aantoonbaar klaar is. Behoud ondertussen de huidige premium interface, mobiele bruikbaarheid en duidelijke laad-, fout- en leegstaten.

Vervang de demomutaties stapsgewijs door echte queries en transacties. De huidige rolwisselaar en `localStorage` mogen nooit autoriteit zijn voor echte data. De demo bevat bekende hiaten: gebruik de gapanalyse als herschrijflijst en beschouw de oude implementatie niet als bewijs van juist gedrag. Houd demofixtures fysiek en logisch apart van echte data en verwijder vaste datums, leeftijden en clubnamen uit productlogica.

Vraag alleen ontbrekende gegevens die een concrete volgende stap blokkeren: GitHub-repository, stagingdomein/VPS en toegang tot het Supabase-project. Werk alle onafhankelijke code-, documentatie- en teststappen ondertussen af. Vraag geen secrets in de chat; gebruik de daarvoor bedoelde secretomgeving. Maak geen andere infrastructuur aan op basis van gegokte identifiers.

## Werkwijze en bewijs

Werk per werkpakket als volgt: implementeer → migreer lokaal → test echte grenzen → controleer de UI → deploy naar staging indien ingericht → leg exact bewijs vast. Onderhoud het voortgangsoverzicht met canon-ID, bestanden en migraties, uitgevoerde tests en resterende blokkades. Geef korte updates over wat werkt, wat nog ontbreekt en het volgende concrete resultaat. Een toast, simulator of testbestand zonder uitvoering is geen gereedmelding.

Voer geen echte berichten, schrijfacties in Sportlink of betalingen uit als test. Gebruik een allowlist, mailopvang en testaccounts. Houd productie geblokkeerd tot afzonderlijke toestemming na V1. Stop niet bij een nieuw plan of een fraaie frontend; het doel van deze bouwopdracht is de volledige, geteste Cluvo V1 op staging.
