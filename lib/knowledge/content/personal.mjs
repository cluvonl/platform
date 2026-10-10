import {article as a} from '../model.mjs';
const book = {
  id: 'leden', title: 'Leden, ouders en uitvoerders', environment: 'personal',
  description: 'Je account, huishouden, taken, teamafspraken en de mobiele Cluvo-app.',
  articles: [
    a('starten', 'Starten met Cluvo en je werkruimte kiezen', 'Vind je vereniging, seizoen en persoonlijke onderdelen zonder je rollen door elkaar te halen.', [], `
## Hoe je toegang werkt
Je logt in als jezelf. Een account kan bij meerdere verenigingen horen en daar verschillende taken hebben. Een verenigingsnaam in een link geeft je geen toegang: Cluvo controleert steeds jouw huidige koppelingen en mandaten. Een vrijwilligersfunctie, huishoudvrijstelling en beheermandaat zijn afzonderlijke afspraken.
## Stappenplan
1. Open Cluvo en log in met het persoonlijke e-mailadres dat je vereniging heeft geverifieerd.
2. Kies de juiste vereniging bij Mijn werkruimtes. In de app kun je via Meer van vereniging wisselen.
3. Controleer het seizoen en, wanneer je meerdere dossiers mag zien, het geselecteerde huishouden. De contextkeuze bepaalt welke afspraken en standen je bekijkt.
4. Begin bij Home. Dit vraagt je aandacht opent je concrete vervolgstap; Binnenkort toont afspraken en activiteiten. Gebruik Taken, Agenda, Teams en Meer voor de overige onderdelen.
5. Open via Meer alleen de beheerwerkruimtes die bij jouw echte rechten horen. Gebruik de kennisbank in die werkruimte voor de betreffende instructies.
## Als er iets ontbreekt
Een leeg huishoudoverzicht betekent dat er nog geen toegestane dossier- of seizoenskoppeling beschikbaar is. Vraag je vereniging om die te controleren. Kies geen ander persoon om toegang na te bootsen; de app heeft geen demorolwisselaar. Een gepauzeerde module kan bestaande afspraken en historie nog tonen terwijl nieuwe werkzaamheden zijn geblokkeerd.
## Controle
Controleer vóór een boeking of vraag altijd vereniging, seizoen, huishouden en uitvoerder. Een opgeslagen voorkeur voor een scherm verandert deze bevoegdheden niet.`, ['inloggen', 'urenstand', 'hulpvragen']),
    a('inloggen', 'Inloggen, uitnodigingen en uitloggen', 'Gebruik je persoonlijke inlogcode en accepteer alleen de uitnodiging die voor jou bedoeld is.', [], `
## Persoonlijke toegang
Cluvo gebruikt een eenmalige code die je per e-mail ontvangt. Een intakecode verwijst naar een dossier en is nooit een inlogmiddel. Ouders die onafhankelijk toegang willen, gebruiken elk een eigen geverifieerd e-mailadres. Deel je code of volledige uitnodigingslink niet met een ander.
## Stappenplan
1. Vul Persoonlijk e-mailadres in en kies Stuur mijn inlogcode. Gebruik hetzelfde adres als in de uitnodiging of je geverifieerde verenigingsaccount.
2. Open de nieuwste inlogmail, neem de code over en kies Veilig inloggen. Controleer ook ongewenste mail wanneer het bericht ontbreekt.
3. Open een ontvangen dossieruitnodiging terwijl je als de juiste persoon bent ingelogd. Controleer vereniging, bereik en geldigheid voordat je accepteert.
4. Een beheeruitnodiging staat bij Mijn werkruimtes. Lees de aangeboden rechten en eindtijd en accepteer deze actief. Een nog open uitnodiging geeft nog geen beheerrechten.
5. Log op een gedeeld apparaat uit via Uitloggen. Open daarna geen eerder opgeslagen besloten pagina alsof je nog bevoegd bent.
## Problemen oplossen
Een oude, gebruikte of verlopen code kan worden geweigerd. Vraag dan een nieuwe code aan en gebruik alleen de nieuwste mail. Maak bij een verkeerde dossierkoppeling geen tweede account met hetzelfde adres: laat de vereniging de koppeling controleren. E-mailaflevering kan vertraging hebben; herhaald aanvragen maakt eerder ontvangen codes mogelijk onbruikbaar.
## Wat je daarna ziet
Alleen geaccepteerde, geldige koppelingen en mandaten openen een werkruimte. Een ingetrokken rol verdwijnt ook wanneer je de oude URL nog kent.`, ['starten', 'extra-uitvoerder', 'privacy']),
    a('urenstand', 'Je urenstand en winterdoel begrijpen', 'Benodigd, bevestigd, gepland en te bevestigen betekenen verschillende dingen.', [], `
## Eén doel voor het hele seizoen
De standaardafspraak is 720 minuten, dus 12 uur, per expliciet gekoppeld huishouden. Het standaardwinterdoel is 360 minuten. Je actuele goedgekeurde afspraak bij Ons huishouden is leidend; een aangepast doel, ook nul, kan daarvan afwijken.
## De standen lezen
- Bevestigd zijn toegekende minuten na controle van uitvoering. Alleen die minuten tellen als uitgevoerd.
- Gepland zijn toekomstige afspraken. Ze helpen je vooruit te kijken, maar zijn nog geen uitvoering.
- Te bevestigen zijn uitgevoerde of verstreken afspraken die nog gecontroleerd moeten worden.
- Resterend is de nog ontbrekende bevestigde inzet voor je jaarafspraak. Een wintertekort hoort bij hetzelfde jaar en vormt geen extra verplichting.
## Stappenplan
1. Open Meer → Ons huishouden en kies het juiste seizoen.
2. Vergelijk het seizoensdoel met Bevestigd. Bekijk daarna Gepland en Te bevestigen afzonderlijk.
3. Open de historie voor concrete boekingen en correctieposten. Vraag bij een ontbrekende uitvoering de verantwoordelijke om controle.
4. Bekijk rond de wintergrens welke bevestigde minuten vóór die grens tellen. Bespreek ontbrekende inzet via een praktische hulpvraag.
## Voorbeelden
8 uur vóór de winter en 4 uur daarna voldoen aan een standaardjaar van 12 uur. Wie 12 uur vóór de winter heeft bevestigd, hoeft niet nog eens 6 uur erna te doen. Bij 4 uur vóór de winter is het wintertekort 2 uur; dat blijft onderdeel van de 8 nog ontbrekende jaaruren.
## Controle
Een geplande taak of afgeronde werkkaart is geen urenboeking. Laat fouten corrigeren met een herleidbare correctie, zodat oude afspraken zichtbaar blijven.`, ['taak-boeken', 'uren-vraag', 'winter-hulp', 'vaste-functie']),
    a('huishouden', 'Je huishouden, kinderen en dossier bekijken', 'Lees gezamenlijke voortgang en persoonlijke koppelingen met behoud van privacy.', [], `
## Wat bij elkaar hoort
Een account is de persoon die handelt. Een huishouden is een dossier met expliciete toegangsrechten. De seizoensverplichting bepaalt waar minuten op worden geboekt. Een kind, intake of tweede ouderaccount maakt niet automatisch een nieuwe urenverplichting.
## Stappenplan
1. Open Ons huishouden via Meer of de huishoudmeter op Home.
2. Kies het dossier en seizoen dat je wilt bekijken. Je ziet alleen contexten waartoe je bent toegelaten.
3. Bekijk personen, huishoudafspraak, bevestigde minuten, geplande afspraken en historie. Een niet-geverifieerde uitvoerder kan aanvullende controle nodig hebben.
4. Bekijk kinderstanden via Teams. Dezelfde huishoudstand kan bij meerdere teams voorkomen; dat verdubbelt je jaaruren niet.
5. Meld een verkeerde persoon, dubbeltelling of onjuiste dossierkoppeling met een praktische uitleg aan de vereniging. Laat een bevoegde medewerker de formele wijziging beoordelen.
## Privacy en vertegenwoordiging
Een gezinsband geeft geen automatische inzage in ieders persoonlijke intake. Onafhankelijke ouders kunnen ieder een eigen intake en contactroute hebben. Een ouder kan alleen namens een kind beleid accepteren als daarvoor een actuele bevoegdheid bestaat. Een lid van 16 jaar of ouder krijgt niet daardoor automatisch vertegenwoordigingsrechten voor anderen.
## Historie
Samenvoegen, splitsen of wijzigen van een huishouden herschrijft eerdere boekingen niet. De vereniging moet expliciet besluiten welke verplichting bij welke seizoenskoppeling hoort. Namen, adressen en hetzelfde kind zijn controlesignalen, geen bewijs om dossiers automatisch samen te voegen.`, ['gescheiden-ouders', 'extra-uitvoerder', 'beleid']),
    a('gescheiden-ouders', 'Onafhankelijke toegang bij gescheiden ouders', 'Houd accounts, intakes en verplichtingen zorgvuldig uit elkaar.', [], `
## Afzonderlijke persoonlijke routes
Als ouders onafhankelijk willen handelen, hebben ze verschillende geverifieerde e-mailadressen nodig. Een gedeeld adres is één loginidentiteit en kan geen twee onafhankelijk afgeschermde accounts vertegenwoordigen. Persoonlijke intakes en contactgegevens blijven alleen zichtbaar binnen hun eigen bevoegdheden.
## Stappenplan
1. Geef aan de vereniging door dat onafhankelijke toegang nodig is. Bespreek welke bestaande personen en dossiers betrokken zijn.
2. Gebruik ieder een eigen persoonlijk adres en accepteer alleen de eigen uitnodiging.
3. Vul je intake vanuit je eigen account en dossiercontext in. Leg praktische beschikbaarheid vast zonder medische of privé-informatie over de andere ouder.
4. Controleer bij Ons huishouden welke seizoensafspraak aan jouw dossier is gekoppeld.
5. Vraag om formele beoordeling wanneer een werkelijk tweede huishouden, nieuwe verplichtingskoppeling of wijziging nodig is.
## Regels
De markering gescheiden ouders maakt geen tweede verplichting. Een extra account, intake of kinderteammeter doet dat ook niet. Een vrijstelling werkt alleen op het expliciet goedgekeurde huishouden en wordt niet vanzelf naar een andere ouderroute gekopieerd. Een teamouder heeft geen toegang tot de private reden achter deze afspraken.
## Als de weergave niet klopt
Deel geen code of volledige dossierexport met de andere ouder om dit te herstellen. Meld de betreffende vereniging, het seizoen en de praktische fout aan de bevoegde vereniging. Na beoordeling volgt een herleidbare wijziging; eerdere uren en besluiten blijven bewaard.`, ['privacy', 'huishouden', 'hulpvragen']),
    a('extra-uitvoerder', 'Een extra uitvoerder uitnodigen', 'Laat een gekoppelde persoon helpen zonder onbeperkte dossierrechten te geven.', [], `
## Wanneer dit kan
Bij Ons huishouden verschijnt de uitnodigingsmogelijkheid alleen wanneer je daarvoor bevoegd bent. Een extra uitvoerder krijgt niet automatisch alle rechten op contacten, intakes of beleid. De echte persoon moet geverifieerd zijn en aan de juiste verplichting zijn gekoppeld voordat die een taak kan uitvoeren.
## Stappenplan
1. Open Ons huishouden en kies Extra uitvoerder uitnodigen.
2. Vul voornaam, achternaam en het persoonlijke e-mailadres van die persoon in. Controleer het adres samen voordat je verdergaat.
3. Selecteer alleen de benodigde rechten, zoals voortgang bekijken en boeken. Bevestig de uitnodiging.
4. De ontvanger opent de uitnodiging, logt met het matching geverifieerde adres in en accepteert de aangeboden toegang.
5. Controleer daarna de personenlijst en, bij een nieuwe taak, de keuzelijst Uitvoerder. Selecteer altijd degene die daadwerkelijk aanwezig zal zijn.
## Controle en herstel
Een verzonden of open uitnodiging is nog geen aanvaarde toegang. Een verlopen, ingetrokken of al gebruikte uitnodiging kan niet alsnog onbeperkt worden gebruikt. Laat een verkeerde uitnodiging intrekken en maak een correcte nieuwe uitnodiging; geef je eigen account of inlogcode niet door.
## Uren en privacy
Een uitvoering telt eenmaal voor de expliciet gekoppelde verplichting. Een extra persoon maakt geen extra jaarverplichting en krijgt niet automatisch een ouderrol of recht om namens kinderen beleid te accepteren.`, ['inloggen', 'taak-boeken', 'huishouden']),
    a('profiel', 'Je intake en vrijwilligersprofiel invullen', 'Leg ervaring, voorkeuren, talenten en praktische beschikbaarheid vast.', [], `
## Waarom een persoonlijk profiel
Je profiel helpt de vereniging passend werk en begeleiding te vinden. Voorkeuren bepalen de volgorde van suggesties; ze vervangen geen leeftijds-, kwalificatie- of beschikbaarheidscontrole. De persoonlijke intake blijft gescheiden van de gezamenlijke urenafspraak.
## Stappenplan
1. Open Meer → Mijn profiel. Controleer persoon, vereniging en dossiercontext.
2. Beschrijf je ervaring en kies taakvoorkeuren. Geef talenten aan die je wilt inzetten.
3. Leg praktische beschikbaarheid en gewenste maandelijkse inzet vast. Geef aan of je vrijwillig in een reservepool wilt helpen of bij een eerste taak een maatje nodig hebt.
4. Beschrijf beperkingen praktisch, bijvoorbeeld welke handelingen of tijden niet mogelijk zijn. Een diagnose of medische verklaring hoort hier niet thuis.
5. Ga naar het controleoverzicht, lees je antwoorden en sla ze op. Wacht op bevestigde opslag voordat je het scherm verlaat.
## Jaarlijkse controle en ondersteuning
Bij een nieuw seizoen kan Cluvo vragen om herbevestiging. Open het verzoek, controleer de actuele antwoorden en bevestig bewust. Als iemand je helpt, moet die daarvoor een benoemde, geldige machtiging hebben; de daadwerkelijke helper blijft bij de wijziging geregistreerd. Een leeftijd van 16+ geeft geen automatische machtiging voor een ander.
## Problemen oplossen
Wanneer het formulier meldt dat gegevens zijn gewijzigd, vernieuw je eerst de actuele versie en vergelijk je je antwoord. Voer niet blind dezelfde wijziging als een nieuwe opdracht uit bij een onbekende uitkomst.`, ['passend-aanbod', 'online-status', 'privacy']),
    a('taak-boeken', 'Een verenigingstaak vinden en boeken', 'Kies de echte uitvoerder, lees de voorwaarden en bevestig een concrete plaats.', [], `
## Voor je boekt
Een taakkaart toont tijd, locatie, capaciteit, afgesproken minuten en vereisten. De duur op de klok kan verschillen van de urenwaarde. Alleen openbare vrije plaatsen zijn in de verenigingsmarkt boekbaar; besloten teamplaatsen hebben hun eigen route.
## Stappenplan
1. Open Taken → Ontdekken. Zoek op titel en filter op categorie, maximaal twee uur taakduur of geschikte uitvoerder in je huishouden.
2. Open een taak. Lees de start- en eindtijd, locatie, leeftijd, kwalificatie, afmeldafspraak en actuele instructies.
3. Kies degene die werkelijk komt helpen. Controleer diens beschikbaarheid en eventuele waarschuwing voor een gezinswedstrijd.
4. Kies indien toegestaan een concreet beschikbaar maatje. Een voorkeur voor begeleiding is nog geen bevestigde buddyboeking.
5. Bevestig de instructies en afmeldvoorwaarden. Als je boven je afspraak vrijwillig extra helpt, bevestig die extra inzet apart.
6. Bevestig de inschrijving en wacht op het opgeslagen resultaat. Controleer de afspraak bij Mijn taken en in de agenda.
## Als boeken niet lukt
De server controleert de plaats, overlap, leeftijd op de taakdatum, kwalificatie, begeleiding en jouw boekingsrecht opnieuw. Een andere persoon kan de laatste plaats net eerder vastleggen. Kies dan een andere plaats of, wanneer aangeboden, de wachtlijst. Een foutmelding is geen succesvolle afspraak.
## Resultaat
Je hebt een geplande afspraak, nog geen bevestigde uren. Na uitvoering beoordeelt de bevoegde verantwoordelijke de toekenning.`, ['wachtlijst', 'taak-voorbereiden', 'passend-aanbod', 'teamplaats']),
    a('passend-aanbod', 'Waarom een taak wel of niet passend is', 'Begrijp geschiktheid, waarschuwingen en wat je doet bij onvoldoende aanbod.', [], `
## Wat Cluvo controleert
Een taak is pas geschikt als er een boekbare plaats is, de juiste uitvoerder bevoegd is en tijd, beschikbaarheid, minimumleeftijd, kwalificatie en eventuele begeleiding passen. Een categorievoorkeur is een suggestie, geen toestemming om een harde eis te negeren. Onbekende leeftijd of kwalificatie wordt niet als bewezen geldigheid ingevuld.
## Stappenplan
1. Gebruik bij Taken het filter voor een geschikte uitvoerder in je huishouden.
2. Open de taak en bekijk de uitleg bij de beschikbare personen. Controleer ook tijdsoverlap en je eigen profiel.
3. Werk onjuiste praktische beschikbaarheid bij in Mijn profiel. Vraag voor een ontbrekend geldig certificaat de opleidingsverantwoordelijke om verificatie.
4. Kies een andere geschikte plaats of vraag begeleiding wanneer de taak een geldige buddyroute biedt.
5. Vind je geen passende taak, gebruik dan de hulpvraag Geen passende taak. Geef aan welke tijden of handelingen praktisch mogelijk zijn.
## Geen automatisch financieel gevolg
Een algemene hoeveelheid open cluburen bewijst niet dat jij genoeg passend aanbod hebt gekregen. De vrijwilligerscommissie beoordeelt echte mogelijkheden, aangeboden alternatieven en opvolging. Een hulpvraag of ontbrekend aanbod wordt niet automatisch omgezet in afkoop of een rekening.
## Controle
Een gezinswedstrijd kan een nuttige planningswaarschuwing geven. Sportlink levert niet altijd een bewezen eindtijd; Cluvo verzint die niet. Beoordeel dan je eigen praktische beschikbaarheid en vraag bij twijfel uitleg.`, ['profiel', 'hulpvragen', 'opleidingen']),
    a('wachtlijst', 'Een wachtlijst of vrijkomende plaats gebruiken', 'Een wachtlijstinschrijving is nog geen vaste taakafspraak.', [], `
## Hoe het werkt
Wanneer een openbare taak vol is, kan een wachtlijstmogelijkheid verschijnen. Je meldt een concrete bevoegde uitvoerder aan. Bij een vrijgekomen plaats worden geschiktheid en de geldende volgorde opnieuw beoordeeld. Een tijdelijk aanbod heeft een vervaldatum; een oude aanbieding garandeert geen plaats.
## Stappenplan
1. Open de volle taak bij Taken en lees dezelfde eisen als voor een gewone inschrijving.
2. Selecteer een geschikte uitvoerder en, indien nodig, de toegestane buddykoppeling.
3. Kies de wachtlijstactie en wacht op de serverbevestiging. Plan nog geen bevestigde uren in je eigen administratie.
4. Ontvang je een plaatsaanbod, controleer dan de huidige taakvoorwaarden en de reactietermijn.
5. Bevestig binnen de termijn en controleer of een echte afspraak bij Mijn taken is verschenen.
## Wat je moet onthouden
Een verlopen aanbod of inmiddels ongeschikte uitvoerder wordt niet alsnog toegelaten. Een tijdelijke reservering wordt gecontroleerd afgehandeld voordat de volgende kandidaat een aanbod krijgt. Opnieuw klikken of een oude URL gebruiken kan geen capaciteit omzeilen.
## Als je geen bericht ziet
Controleer Meldingen en je voorkeuren. Een browser die push weigert verandert de onderliggende inbox of je inschrijving niet. Vraag de vereniging om statuscontrole wanneer de huidige weergave onduidelijk is; maak geen dubbele aanmelding om voorrang te krijgen.`, ['taak-boeken', 'meldingen', 'online-status']),
    a('taak-voorbereiden', 'Je taak voorbereiden en terugblikken', 'Gebruik actuele instructies en geef praktische feedback na afloop.', [], `
## Voorbereiding
Een taakafspraak bewaart de afgesproken voorwaarden en instructieversie. Belangrijke nieuwe instructies kunnen gericht worden aangeboden. Een vinkje Taak voorbereiden bevestigt voorbereiding en is geen bewijs van uitvoering of uren.
## Stappenplan
1. Open Taken → Mijn taken en kies de actuele afspraak.
2. Controleer tijd, locatie, contactpersoon, uitvoerder en instructies. Lees eventuele gewijzigde werkafspraken.
3. Gebruik de voorbereidingsactie wanneer die beschikbaar is. Vraag bij onduidelijkheid praktisch om uitleg vóór de taak.
4. Voer de taak uit. Bekijk daarna of deze ter controle staat of al bevestigd is.
5. Open de terugblik en geef aan of je het werk opnieuw wilt doen, of de instructie duidelijk was en welke praktische tip helpt.
## Feedback en historie
Een terugblik kan de commissie helpen een volgende instructieversie te verbeteren. Je eigen bevestigde afspraak en eerdere toekenning blijven daarbij herleidbaar. Een tevredenheidsreactie, voorbereidingsvinkje of afgeronde werkkaart boekt nooit automatisch uren.
## Als iets veranderd is
Bij een wezenlijke tijd- of taakwijziging moet de vereniging de gevolgen voor betrokken afspraken beoordelen. Controleer een ontvangen herbevestigingsvraag actief; neem bij twijfel contact op. Meld een onjuiste toekenning via een urenvraag in plaats van de oude uitvoering zelf te overschrijven.`, ['uren-vraag', 'afmelden', 'berichten']),
    a('afmelden', 'Afmelden, ziekte en verhindering melden', 'Kies de juiste route en controleer of je oorspronkelijke afspraak nog actief is.', [], `
## De vastgelegde afmeldafspraak
De normale afmeldtermijn wordt bij je inschrijving vastgelegd. Een latere algemene regelwijziging herschrijft die afspraak niet. Ziekte en nood blijven meldbaar, ook wanneer regulier afmelden niet meer mogelijk is.
## Stappenplan
1. Open Taken → Mijn taken en de betreffende afspraak.
2. Bekijk de vastgelegde afmeldgrens. Gebruik regulier afmelden wanneer die route nog is toegestaan.
3. Ben je ziek of is er een noodsituatie, kies dan de passende reden en beschrijf de praktische verhindering. Medische details zijn niet nodig.
4. Als vervanging nodig is, open het overnameverzoek en volg de aangeboden route. Vermeld een concrete reden en eventuele reactietermijn.
5. Wacht op bevestiging en controleer de actuele status bij Mijn taken. Een vervangingsverzoek alleen beëindigt de oorspronkelijke afspraak niet.
## Wie blijft verantwoordelijk
Bij een overname blijft de oorspronkelijke inschrijving actief totdat een geschikte vervanger definitief heeft bevestigd. Maak geen onderlinge afspraak buiten Cluvo alsof daarmee de boeking al is gewijzigd. De verantwoordelijke moet de actuele bezetting kunnen zien.
## Uren en sancties
Niet verschijnen levert geen automatische uren op. Het is ook geen automatische boete of sportieve sanctie. De bevoegde verantwoordelijke registreert uitvoering en eventuele afwijkingen gemotiveerd; een urenbezwaar heeft een afzonderlijke route.`, ['overnemen', 'uren-vraag', 'online-status']),
    a('overnemen', 'Een taak overnemen of een ruil volgen', 'Een overname is pas definitief na controle en bevestigde verwerking.', [], `
## De oorspronkelijke afspraak
Taken → Overnemen toont de toegestane open overnameverzoeken. De huidige uitvoerder blijft gekoppeld totdat een passende vervanger de concrete plaats definitief overneemt. Bekende namen of een bericht in een gesprek veranderen de boeking niet.
## Stappenplan voor overname
1. Open Taken → Overnemen en kies een verzoek dat bij je past.
2. Controleer de taakdatum, locatie, afgesproken minuten, instructies en geldigheid van het aanbod.
3. Kies de echte uitvoerder uit je bevoegde personen. Bevestig opnieuw de actuele voorwaarden en eventuele begeleiding.
4. Bevestig de overname en wacht op het opgeslagen resultaat.
5. Controleer Mijn taken en de agenda. Pas een definitief bevestigde overname beëindigt de oude toewijzing.
## Wederzijdse ruil
Een formele wederzijdse ruil vereist instemming van beide partijen en een gezamenlijke hercontrole van beide afspraken. Als één persoon niet voldoet aan leeftijd, kwalificatie, overlap of geldigheid, verandert geen van beide boekingen. De mobiele Overnemen-route is een overname van een plaats; die moet niet als een vrij te klikken wederzijdse ruilknop worden geïnterpreteerd. Vraag de vereniging om de juiste begeleide route wanneer nodig.
## Bij gewijzigde of verlopen aanbiedingen
Open het actuele overzicht opnieuw. Gebruik een oude bevestiging of link niet om gewijzigde voorwaarden te passeren. Bij een onbekende opslaguitkomst controleer je eerst de huidige afspraak voordat je opnieuw handelt.`, ['afmelden', 'taak-boeken', 'online-status']),
    a('teamplaats', 'Een teamplaats kiezen en de echte uitvoerder boeken', 'Een toewijzing aan een speler is nog geen inschrijving van een uitvoerder.', [], `
## Teamtelling en huishouduren
Teams kunnen vrije verenigingsplaatsen als besloten cluster krijgen. De teamouder verdeelt concrete plaatsen over spelers; het huishouden kiest daarna de echte uitvoerder. De plaats is pas bezet door een boeking na die bevestiging. Een uitvoering telt hoogstens voor één gekozen speler of team en eenmaal voor de huishoudverplichting.
## Stappenplan
1. Open Teams en kies het juiste team, of bekijk Uitvoerder kiezen bij Mijn taken.
2. Lees de teamafspraak, de gereserveerde plaats en eventuele inschrijf- of toewijzingsdeadline.
3. Open de plaats en selecteer de bevoegde persoon die werkelijk helpt. Lees de taakvoorwaarden en actuele instructies.
4. Bevestig de boeking. Controleer de uitvoerder en status in Mijn taken en de agenda.
5. Na uitvoering volgt de bevoegde controle. Alleen de bevestigde stand telt als voltooid.
## Eigen teamtaken
Praktische teamtaken, zoals fruit of bidons, hebben standaard nul verenigingsminuten. Alleen vooraf goedgekeurde marktpublicatie kan de urenroute openen. Een losse teamtaak en de gekoppelde markttaak zijn één uitvoering, geen twee boekingen.
## Voorbeeld
Twee kinderen van hetzelfde huishouden spelen in verschillende teams. Als een ouder één concrete plaats uitvoert, kan die plaats niet voor beide kinderen worden afgevinkt. De goedgekeurde huishoudminuten worden eenmaal geboekt. Vrijwillig een extra plaats helpen kan, maar vraagt een eigen geschikte boeking en bewust akkoord.`, ['urenstand', 'afmelden', 'agenda']),
    a('agenda', 'De gezinsagenda en kalenderexport gebruiken', 'Combineer toegestane taken, teamplaatsen, wedstrijden en activiteiten.', [], `
## Wat de agenda toont
De agenda gebruikt dezelfde toegestane afspraken als Taken en Teams. Een toegewezen teamplaats zonder uitvoerder wordt als toewijzing getoond en is nog geen boeking. Gezinswedstrijden komen uit de toegestane teamkoppelingen; dezelfde wedstrijd wordt niet onnodig dubbel weergegeven.
## Stappenplan
1. Open Agenda en ga met de weeknavigatie naar de gewenste periode.
2. Kies een dag, kalenderlaag of persoon om je selectie te beperken. Wis filters als je een lege selectie niet verwacht.
3. Open een taak of toewijzing voor de concrete plaats, instructies en vervolgactie.
4. Open een wedstrijd voor aftrap, locatie en beschikbare veld- of kleedkamerinformatie. Een onbekende eindtijd blijft onbekend.
5. Open een clubactiviteit en geef je deelname door wanneer RSVP is toegestaan.
6. Download het kalenderbestand wanneer aangeboden. Een export bevat dezelfde geautoriseerde scope als de actuele agenda.
## Belangrijke grenzen
RSVP is geen taakboeking en boekt geen uren. Een gedownload kalenderbestand is een momentopname; controleer Cluvo bij belangrijke wijzigingen. Geef een export met persoonlijke afspraken niet onbeperkt door. Een mislukte Sportlink-import bewijst niet dat een wedstrijd is afgelast.
## Als informatie ontbreekt
Controleer eerst vereniging, seizoen, team, persoonfilter en laatste bekende bronstatus. Vraag de vereniging om controle wanneer een echte teamkoppeling of wedstrijd ontbreekt. Vul een vermoedelijke eindtijd niet zelf in als officiële broninformatie.`, ['teamplaats', 'meldingen', 'privacy']),
    a('beleid', 'Beleid lezen en actief akkoord vastleggen', 'Acceptatie geldt per persoon en exacte documentversie.', [], `
## Lezen en accepteren zijn verschillend
Bij Beleid & afspraken staat de aangeboden documentversie. Openen, downloaden, scrollen of een uitlegkaart sluiten is geen akkoord. Cluvo bewaart voor een acceptatie de exacte tekstversie, de handelende persoon en het vertegenwoordigde lid.
## Stappenplan
1. Open Meer → Beleid & afspraken en kies een document.
2. Lees de exacte aangeboden tekst en bekijk voor wie de opdracht geldt.
3. Kies jezelf of selecteer expliciet de kinderen voor wie je een geldige vertegenwoordigingsbevoegdheid hebt.
4. Vink actief het akkoord aan en bevestig. Een onbevoegd kind kan niet door een vrije selectie alsnog worden vertegenwoordigd.
5. Controleer de acceptatiestatus voor ieder gekozen lid. Oudere versies en acceptaties blijven behouden wanneer nieuw beleid verschijnt.
## Vragen en bezwaren
Stel bij onduidelijk beleid een vraag en wacht op bevoegde opvolging. Een open beleidsvraag of bezwaar pauzeert de relevante herinneringsroute tijdens behandeling; het verandert je intake of berichtvoorkeuren niet. Essentiële informatie en ziekmelden blijven bereikbaar. Een niet-geaccepteerd document leidt niet vanzelf tot een sportieve sanctie.
## Als bevestigen niet lukt
De documentversie, opdracht of vertegenwoordigingsbevoegdheid kan zijn gewijzigd. Vernieuw het actuele aanbod en lees wat nu ter acceptatie staat. Vraag bij een fout om controle; accepteer nooit namens iemand uitsluitend omdat die in hetzelfde gezin woont.`, ['huishouden', 'hulpvragen', 'meldingen']),
    a('opleidingen', 'Opleidingen, certificaten en een maatje', 'Een cursusinschrijving is nog geen geldige kwalificatie.', [], `
## Aanbod en bevoegdheid
Opleidingen toont cursusaanbod en je eigen geverifieerde kwalificaties. Een interesse, talent, aanmelding of cursusdeelname is niet automatisch een certificaat. Voor een taak kan de vereiste kwalificatie op de datum van uitvoering geldig moeten zijn.
## Stappenplan
1. Open Meer → Opleidingen en bekijk datum, capaciteit en kwalificatie van een cursus.
2. Schrijf je in wanneer een plek beschikbaar is. Wacht op bevestiging en controleer je aanmeldstatus.
3. Kun je niet deelnemen, gebruik dan de afmeldmogelijkheid in dezelfde cursus.
4. Laat na het behalen een bevoegde opleidingsverantwoordelijke het resultaat verifiëren en de geldigheid vastleggen.
5. Controleer je kwalificatieregister en eventuele einddatum voordat je een toekomstige taak kiest.
## Begeleiding
In Mijn profiel kun je aangeven dat je bij een eerste taak een maatje wenst. Een boeking vereist vervolgens een concrete toegestane buddy die werkelijk beschikbaar en passend gekwalificeerd is. De buddyroute mag een harde veiligheidsvereiste niet willekeurig uitschakelen.
## Bij verval of intrekking
Een verlopen of ingetrokken kwalificatie kan gevolgen hebben voor toekomstige afspraken. De vereniging volgt dit op; oude toezeggingen worden niet stilzwijgend gewist. Bespreek heropleiding of passende vervanging wanneer nodig. Een volle cursus of wachtlijst is nog geen bewijs dat je bevoegd bent voor de bijbehorende taak.`, ['taak-boeken', 'profiel', 'vaste-functie']),
    a('vaste-functie', 'Interesse in een vaste vrijwilligersfunctie', 'Een belangstelling wordt pas een erkende aanstelling na beoordeling.', [], `
## Wat een functie betekent
Vaste vrijwilligersfuncties toont vacatures met werkzaamheden, commissie, gewenste inzet, begeleiding en mogelijke vrijstelling. Een onbekende verwachte inzet wordt niet als nul ingevuld. De vrijstellende werking hangt af van de goedgekeurde rolversie en de expliciete huishoudkoppeling.
## Stappenplan
1. Open Meer → Vaste vrijwilligersfuncties en kies een vacature.
2. Lees werkzaamheden, inzet, begeleiding en contactroute. Controleer of de mogelijke vrijstelling voor jouw situatie bedoeld is.
3. Geef interesse door met een praktische toelichting. Wacht op de opgeslagen bevestiging.
4. Bespreek bij kennismaking de echte aanstelling, periode, voorwaarden en het betreffende huishouden.
5. Controleer na erkenning de actuele huishoudafspraak en je functie. Meld een start, einde of gewijzigde inzet tijdig aan de vereniging.
## Regels
Interesse of een afspraak voor kennismaking maakt nog geen vrijstelling. Een erkende functie kan het hele expliciet gekoppelde huishouden vrijstellen, zonder fictieve uren aan de ledger toe te voegen. De functie verleent geen systeemrechten: een trainer wordt niet automatisch beheerder en een beheerder wordt niet automatisch vrijgesteld.
## Tussentijdse verandering
Bij beëindiging, instroom, vertrek of onvoldoende inzet beoordeelt de vereniging gemotiveerd de resterende afspraak. Er ontstaat geen stille terugwerkende urenclaim. Vraag om uitleg wanneer de huidige stand of periode niet overeenkomt met het vastgelegde besluit.`, ['urenstand', 'hulpvragen', 'profiel']),
    a('acties', 'Mijn acties, werkafspraken en mentions', 'Open de concrete vervolgstap uit je toegestane teams en commissies.', [], `
## Eén persoonlijke actielijst
Mijn acties bundelt toegewezen werkkaarten, subtaken, mentions, deadlines, hulpvragen en relevante opvolging. Dezelfde gebeurtenis kan je toewijzen én noemen; dat hoort geen dubbele vervolgstap op te leveren. Een mention geeft nooit nieuwe toegang tot een besloten bron.
## Stappenplan
1. Open Dit vraagt je aandacht op Home of Meer → Mijn acties.
2. Kies een actie en lees de concrete bron, status en deadline. Gebruik de bronlink om de juiste kaart, teamafspraak, activiteit of beleidsvraag te openen.
3. Werk een toegestane checklist, reactie of status bij. Controleer dat de wijziging bevestigd is.
4. Als de actie een taakuitvoerder of vervanging vraagt, rond dan die afzonderlijke boekingsroute af.
5. Herlaad bij een gewijzigde opdracht zodat je niet op een oude versie verderwerkt.
## Wat afronden betekent
Een werkkaart afronden of een checklist aanvinken verandert de werkstatus. Het boekt geen uren. Alleen bevestigde uitvoering van een gekoppelde verenigingstaak of een afzonderlijk goedgekeurde registratie geeft minuten. Een deadline is ook geen automatische urenplicht.
## Als een bron niet meer opent
Je rol, teamkoppeling of commissieopdracht kan zijn verlopen of ingetrokken. Een oude actie of link omzeilt die controle niet. Vraag je huidige verantwoordelijke om opvolging in plaats van de besloten inhoud via een onbevoegde collega op te vragen.`, ['berichten', 'meldingen', 'urenstand']),
    a('berichten', 'Gesprekken, documenten en contact met je vereniging', 'Communiceer binnen de toegestane team- en commissieruimtes.', [], `
## De juiste ontvangers
Berichten zijn georganiseerd in toegestane team- en commissiekanalen. Een gesprek is geen openbare clubbrede adreslijst. Bij documenten gelden de eigenaar, zichtbaarheid en actuele versie; een ontvangen link verandert je bronrechten niet.
## Stappenplan
1. Open Meer → Berichten en kies het bedoelde kanaal.
2. Lees de context en plaats een praktische reactie. Controleer de opgeslagen status voordat je hetzelfde bericht opnieuw probeert.
3. Open een relevante mention vanuit Meldingen of Mijn acties. De ontvanger ziet alleen informatie die bij diens bronrechten past.
4. Open bij Samen organiseren het toegestane document of de werkafspraak. Gebruik de downloadroute wanneer aangeboden; de huidige toegang wordt opnieuw gecontroleerd.
5. Gebruik voor een persoonlijke dossier- of urenvraag de hulpvraagroute, zodat die bij de bevoegde behandelaar komt.
## Privacy
Plaats geen medische achtergrond, gegevens van de andere ouder of financiële achterstand in een algemeen teamgesprek. Een teamouder heeft daarvoor geen onbeperkt dossiermandaat. Een privédocument mag niet als openbare bijlage opnieuw worden verspreid.
## Herstel
Een ontbrekend kanaal kan duiden op een ontbrekende of beëindigde koppeling. Vraag de vereniging om controle. Als je bericht een onbekende uitkomst heeft, kijk dan eerst of het al is verschenen en gebruik de bestaande opdrachtstatus; opnieuw verzenden als een nieuwe handeling kan een duplicaat veroorzaken.`, ['hulpvragen', 'acties', 'privacy']),
    a('meldingen', 'Meldingen en persoonlijke berichtvoorkeuren', 'Begrijp de inbox, e-mail en push zonder belangrijke gebeurtenissen te missen.', [], `
## Drie kanalen
Meldingen is je geautoriseerde inbox. E-mail en push hebben daarnaast persoonlijke voorkeuren en apparaatinstellingen. Een melding openen kan naar een concreet bronobject gaan; gelezen markeren verandert de uitvoering of acceptatie van dat object niet.
## Stappenplan
1. Open het belletje of Meer → Meldingen. Wissel tussen ongelezen en alle meldingen.
2. Open een melding om de concrete vervolgstap te bekijken. Gebruik Alles gelezen alleen voor je eigen inbox.
3. Open Instellingen en controleer voorkeuren voor e-mail, dienstherinneringen, teaminformatie en nieuws.
4. Stel push op het betreffende apparaat bewust in via Cluvo installeren. Zonder toestemming is er geen werkende pushsubscription.
5. Controleer na een voorkeurwijziging het bevestigde resultaat. Andere apparaten lezen dezelfde opgeslagen persoonlijke voorkeuren.
## Daglimiet
Voor nieuwe passende taken geldt maximaal één nieuwe-takendigest per persoon per lokale kalenderdag. Een nieuwe passende gepubliceerde taak kan daarnaast één logisch pushevent krijgen, zonder dagmaximum. Bevestigingen, belangrijke wijzigingen en andere functionele meldingen hebben eigen regels.
## Als e-mail ontbreekt
Bekijk eerst de inbox, je voorkeuren en ongewenste mail. Een provider die een mail accepteert bewijst nog geen aflevering in je inbox. Bij een onbekende verzenduitkomst moet beheer de status controleren, niet onbeperkt opnieuw verzenden.`, ['installeren', 'online-status', 'acties']),
    a('installeren', 'Cluvo installeren, updates en ontbrekende styling', 'Gebruik de bestaande installatiehulp en controleer de app met verbinding.', [], `
## De mobiele webapp
Cluvo is een webapp die vanaf het beginscherm kan worden geopend. De installatiehulp gebruikt de mogelijkheden van je browser. Er is geen door Cluvo geleverd APK-bestand nodig. Appinstallatie, inloggen en toestemming voor push zijn afzonderlijke stappen.
## Stappenplan
1. Open de juiste Cluvo-omgeving met HTTPS en controleer het adres.
2. Open Meer → Cluvo installeren en volg de installatieknop of de getoonde handmatige browserhulp.
3. Open de geïnstalleerde app en log in als jezelf. Controleer of Home, Taken en de navigatie normaal zijn vormgegeven.
4. Geef alleen bewust toestemming voor push op dit apparaat en controleer de getoonde subscriptionstatus.
5. Open bij een update de app met verbinding en controleer de actuele afspraken. Een wijziging is pas uitgevoerd na serverbevestiging.
## Problemen oplossen
Een Androidmelding over een onveilige of oude wrapper bewijst niet wat de oorzaak is. Omzeil de apparaatbeveiliging niet. Controleer browserupdates en gebruik de getoonde browserroute; meld apparaat, browser, versie en handeling aan beheer. Bij een ongestileerde pagina controleer je met verbinding of ook de browserpagina styling mist. Meld de omgeving en het tijdstip; beheer kan de daadwerkelijk geleverde assets controleren.
## Offline en uitloggen
Offline toont Cluvo dat bevestigen niet kan. Besloten dossierinhoud hoort niet in de offlinecache. Uitloggen beëindigt de toegang; een icoon op het beginscherm is geen blijvend accountrecht.`, ['online-status', 'inloggen', 'meldingen']),
    a('online-status', 'Opslaan, conflicten en onbekende uitkomsten', 'Handel alleen door op een bevestigde serverstatus.', [], `
## Wat de melding betekent
Bevestigd betekent dat de server de opdracht heeft verwerkt. Afgewezen betekent dat de huidige regels of versie de opdracht niet toelaten. Onbekend betekent dat de app nog niet kan vaststellen of de opdracht is verwerkt, bijvoorbeeld na een verbindingstime-out. Een succesanimatie of offline klik is geen bewijs van opslag.
## Stappenplan
1. Controleer of je online bent voordat je boekt, toewijst, accepteert of een bericht plaatst.
2. Verstuur een wijziging eenmaal en wacht op de status. Bewaar bij onduidelijkheid het huidige scherm.
3. Bij een versieconflict laad je de actuele gegevens opnieuw en vergelijk je wat een ander heeft gewijzigd.
4. Bij een onbekende uitkomst controleer je de bestaande opdrachtstatus en het bronoverzicht. Gebruik de aangeboden herstelroute met dezelfde opdrachtsleutel.
5. Begin pas een nieuwe wijziging als duidelijk is wat met de eerdere opdracht is gebeurd.
## Regels
Cluvo controleert rechten per handeling, niet alleen bij het openen van een pagina. De laatste vrije plaats kan intussen zijn geboekt. Een ingetrokken rol kan na het openen van een formulier geen nieuwe wijziging meer uitvoeren. Oude versies worden niet stilzwijgend over de actuele administratie heen geschreven.
## Offline
Er is geen lokale wachtrij die je taakboekingen vanzelf bevestigt. Maak bij een storing een praktische afspraak met je vereniging en laat een bevoegde medewerker de juiste route volgen. Deel geen inlogcode om een probleem te omzeilen.`, ['taak-boeken', 'hulpvragen', 'privacy']),
    a('uren-vraag', 'Een vraag over uitvoering of uren stellen', 'Laat ontbrekende minuten of een fout met een herleidbare correctie beoordelen.', [], `
## Wanneer een vraag nodig is
Een taak kan nog ter controle staan of anders zijn toegekend dan je verwachtte. Geplande duur, afgesproken urenwaarde en bevestigde minuten zijn aparte gegevens. De historie mag niet verdwijnen wanneer een fout wordt hersteld.
## Stappenplan
1. Open Mijn taken en bekijk de uitvoering en afgesproken minuten van de betreffende afspraak.
2. Controleer of de taak nog Te bevestigen is. Vraag de verantwoordelijke eerst om uitvoering te beoordelen wanneer die controle ontbreekt.
3. Gebruik de taak- of huishoudvraag voor een concrete uitleg: welke taak, wanneer, welke afwijking en wat volgens jou is gebeurd.
4. Volg de behandeling bij Mijn vragen in Ons huishouden. De bevoegde behandelaar neemt de vraag in behandeling en legt het antwoord of besluit vast.
5. Controleer na correctie de nieuwe post en de oorspronkelijke historie. Een correctie vervangt geen eerdere bronafspraak.
## Termijnen en gevolgen
De startinstellingen voor bevestiging en bezwaar zijn zeven en veertien dagen; je actuele verenigingsafspraak is leidend. Een aantoonbare administratieve fout kan ook later een herstelroute nodig hebben. Een open urenbezwaar moet bij relevante financiële finalisatie worden meegenomen en mag niet door bevestiging van een andere taak verdwijnen.
## Geen automatische sanctie
Een no-show, partial of clubannulering vraagt de juiste registratie en eventuele reden. Dat maakt niet vanzelf een boete of sportieve maatregel.`, ['urenstand', 'hulpvragen', 'online-status']),
    a('winter-hulp', 'Een wintertekort of persoonlijke afspraak bespreken', 'Vraag om passende ondersteuning voordat een besluit over je resterende inzet wordt genomen.', [], `
## Het winterdoel
Het winterdoel controleert een deel van dezelfde jaarafspraak. Een tekort maakt geen tweede verplichting. De vereniging beoordeelt eerst bevestigde uren, open controles en al geplande passende afspraken. Een bestaande boeking mag niet nogmaals als nieuwe plaatsing worden aangemaakt.
## Stappenplan
1. Bekijk Ons huishouden voor de actuele winter- en jaarstand van het juiste seizoen.
2. Benoem praktische mogelijkheden voor inhalen en wijs op uitvoering die nog gecontroleerd moet worden.
3. Dien bij Hulp een vraag over geen passend aanbod, verenigingsuren of een persoonlijke situatie in.
4. Geef functionele beperkingen aan zonder diagnose of medische bewijsstukken. Bespreek alternatieven met de bevoegde coördinator of commissie.
5. Controleer een genomen besluit op de effectieve jaar- en winterafspraak, periode en eventuele vervolgplaatsing.
## Beoordeling
Een uitzondering vraagt twee verschillende bevoegde beoordelaars van dezelfde besluitversie. Verschil van mening, belangenconflict, bezwaar of afwijking buiten beleid heeft een bestuursroute. Eén persoon met twee rollen telt niet als twee beoordelaars.
## Financiële uitleg
Een afgesproken afkoop of tekortbijdrage heeft een afzonderlijke goedgekeurde route. Ontbrekend aanbod of een open vraag is geen automatische afkoop. Bij de standaardbasis van €150 voor 720 minuten is drie uur definitief tekort €37,50; je eigen effectieve afspraak en open besluiten bepalen of die berekening überhaupt aan de orde is.`, ['hulpvragen', 'urenstand', 'vaste-functie']),
    a('hulpvragen', 'Hulp vragen en de opvolging terugvinden', 'Stel een praktische vraag aan de juiste vereniging en volg het antwoord.', [], `
## De hulpvraagroute
Hulp bevat de contactpersoon die je vereniging heeft ingesteld en, bij een toegestaan huishouden, een opgeslagen vraagroute. Die route helpt de bevoegde medewerker je vraag te behandelen zonder privégegevens in een teamgesprek te zetten.
## Stappenplan
1. Open Meer → Hulp en kennisbank. Zoek eerst op het onderwerp of kies het passende artikel.
2. Ga naar Vraag het je vereniging en kies een onderwerp, zoals Geen passende taak, Verenigingsuren, Teamafspraak of Een persoonlijke situatie.
3. Beschrijf kort het praktische probleem, het relevante seizoen en een gewenste vervolgstap. Een diagnose, wachtwoord, code of sleutel hoort niet in de tekst.
4. Kies Vraag indienen en wacht op de serverbevestiging.
5. Open Ons huishouden → Mijn vragen om status, antwoord en behandeling terug te vinden.
## Als indienen ontbreekt
Er is mogelijk nog geen toegestaan huishouden gekoppeld. Gebruik dan de ingestelde contactroute en vraag om toegangscontrole. Een ontbrekend aanspreekpunt is een verenigingsinstelling die beheer moet aanvullen; Cluvo verzint geen contactpersoon.
## Behandeling
Een bevoegde behandelaar kan een vraag oppakken, beantwoorden en eventueel een formele beoordelingsroute starten. Een praktische vraag verleent die behandelaar niet automatisch aanvullende dossierrechten. Voor besluiten over uitzondering, afkoop of uren gelden afzonderlijke bevoegdheden en controlepunten.`, ['uren-vraag', 'winter-hulp', 'privacy']),
    a('privacy', 'Privacy, rollen en veilige documenten', 'Dezelfde toegangsgrenzen gelden voor schermen, links, zoekresultaten en exports.', [], `
## Je daadwerkelijke bevoegdheid
Cluvo controleert huidige account-, tenant- en scoperechten. Je mag meerdere rollen hebben, ieder met een eigen bereik en geldigheidsperiode. Alleen een zichtbaar menu, bekende UUID, gekozen rolnaam of ontvangen mention bewijst geen toegang.
## Praktische regels
- Gebruik je eigen account; geef nooit een inlogcode, uitnodigingstoken of beheercredential door.
- Deel privé-intakes, gegevens van de andere ouder en financiële details niet via algemene teamkanalen.
- Download alleen documenten en exports voor je toegestane werkzaamheden en verspreid die binnen hetzelfde bereik.
- Een teamouder ziet beperkte benodigde voortgang, geen privéreden voor een vrijstelling of financiële achterstand.
- Een vrijwillige functie en een vrijstelling geven geen automatisch beheermandaat.
## Stappenplan bij een fout
1. Stop met verder openen of verspreiden van inhoud die kennelijk niet voor jou bedoeld is.
2. Meld de vereniging, route en soort onjuiste informatie aan de bevoegde beheerder zonder een volledige dossierkopie rond te sturen.
3. Laat de benoemde koppeling of scope controleren. Een directe link moet na intrekking dezelfde grens volgen als het menu.
4. Log op gedeelde apparaten uit en controleer de nieuwe werkruimte na herstel.
## Uitlegvoorkeuren
De gele uitlegbanners kun je met het kruisje of Gezien afsluiten. De voorkeur hoort bij je account, onderwerp en uitlegversie en kan op andere apparaten terugkomen. Uitleg opnieuw tonen is een persoonlijke instelling, geen beleidsacceptatie of verandering van rechten.`, ['inloggen', 'berichten', 'online-status']),
  ],
};
export default book;
