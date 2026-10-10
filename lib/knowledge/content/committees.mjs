import {article as a} from '../model.mjs';
const workspace=['committee.workspace.manage'], planning=['shift.manage'], execution=['attendance.confirm'];
const book = {id:'commissies',title:'Commissies en taakverantwoordelijken',environment:'club',description:'Werkruimtes, planning, uitvoering, documenten en samenwerking binnen je eigen commissie.',articles:[
  a('commissie-start','Je commissiewerkruimte gebruiken','Werk met de leden, documenten, kaarten en taken binnen je toegewezen commissie.',workspace,`
## Bereik van een commissie
Een commissie heeft een eigen werkruimte. De commissiecoördinator is niet automatisch de centrale vrijwilligerscommissie of vrijwilligerscoördinator. Je systeemmandaat bepaalt welke commissie, werkkaarten, documenten en taken je mag beheren.
## Stappenplan
1. Open verenigingsbeheer → Commissies of in de app Samen organiseren.
2. Kies de erkende commissie en controleer het huidige seizoen.
3. Bekijk Werkafspraken en Instructies. Open een bestaande kaart of document voordat je dezelfde inhoud opnieuw maakt.
4. Gebruik Planning en Uitvoering alleen wanneer daarvoor afzonderlijke rechten zijn toegekend.
5. Stem praktische verantwoordelijkheden af met de ingestelde contactpersoon of coördinator.
## Leden en contact
Bevoegde beheerders kunnen commissielidmaatschap starten of beëindigen en commissiecontact wijzigen. Lidmaatschap, functionele taak en systeemrecht blijven verschillende registraties. Het toevoegen van een naam is geen vrijbrief om alle private huishoudens te lezen.
## Controle
Een gewijzigde of ingetrokken commissiescope moet ook directe kaart-, document- en exportlinks blokkeren. Een mention of algemene bestuursrol verruimt dat bereik niet. Bewaar praktische afspraken in de juiste werkruimte, zodat historie en opvolging bij hun bron blijven.`,['werkkaarten','documenten','commissieplanning']),
  a('commissieplanning','Een verenigingstaak maken en verdelen','Maak gecontroleerde plaatsen voor de vrije markt of een toegestaan team.',planning,`
## Taak en plaats
Een taak beschrijft het werk; afzonderlijke plaatsen beschrijven de capaciteit. De afgesproken urenwaarde komt uit de vastgelegde taaksoortversie en is niet automatisch gelijk aan de klokduur. Alleen het juiste commissie- en planningsmandaat mag nieuwe taken publiceren.
## Stappenplan
1. Open Planning en verdeling of Commissieoverzicht → Een verenigingstaak maken.
2. Kies seizoen en taaksoort. Vul titel, begin, einde, aantal plaatsen en praktische instructies in.
3. Controleer minimumleeftijd, vereiste kwalificatie, minimum ervaren bezetting en of een buddy is toegestaan.
4. Kies vrije verenigingsmarkt, zelfinschrijving door een toegestaan team of toewijzing via de teamouder.
5. Bij teamverdeling kies je het echte ontvangende team en beide deadlines. Controleer de weergegeven actuele teamversie.
6. Bevestig en controleer de publicatie, concrete plaatsen en bezetting in het actuele overzicht.
## Validatie
Tijd, locatie, capaciteit, scope en vereisten moeten samen kloppen. Herhalen maakt geen fictieve uitvoerders of bevestigde uren. Een taakvoorstel of concept is nog geen gepubliceerd aanbod en hoort geen aanbodmeldingen te versturen.
## Bij een fout
Een geweigerde of onbekende uitkomst mag niet als gepubliceerde taak worden gecommuniceerd. Controleer de bestaande opdrachtstatus en actuele lijst voordat je een nieuwe taak met dezelfde inhoud maakt.`,['taakcatalogus','concepten-sjablonen','clusters','wijzigingsimpact']),
  a('taakcatalogus','Categorieën, taaksoorten en urenwaarden beheren','Beheer eigenaar en taakvoorwaarden in versies, met behoud van bestaande afspraken.',planning,`
## De catalogus
Categorieën horen bij een commissie. Taaksoorten leggen naam, activiteit, afgesproken creditminuten en eventuele afwijkende afmeldtermijn vast. Bestaande boekingen verwijzen naar hun toen geldende voorwaarden; een algemene nieuwe waarde schrijft die historie niet over.
## Stappenplan
1. Open Planning en verdeling → Taaksoorten.
2. Controleer de commissie-eigenaar en bestaande categorie voordat je een nieuwe toevoegt.
3. Leg een categorie en het benodigde minimumaantal plaatsen vast binnen je scope.
4. Maak of wijzig een taaksoort. Publiceer een expliciete nieuwe voorwaardenversie voor creditminuten en eventuele afmeldtermijn.
5. Controleer welke nieuwe taken deze versie gebruiken en welke oude afspraken hun eerdere versie behouden.
## Minuten en vereisten
Reken in hele minuten. Een taak van twee uur kan een afzonderlijk afgesproken urenwaarde hebben; maak die zichtbaar. Minimumleeftijd, kwalificaties, buddyregeling en ervaren bezetting moeten bij de concrete taak passen. Gewenste categorieën van een uitvoerder kunnen deze harde eisen niet uitschakelen.
## Grenzen
Zet een taaksoort niet stilzwijgend op inactief om bestaande boekingen te laten verdwijnen. Geef een praktische contactroute en duidelijke instructies. Een teamtaak krijgt geen verenigingsminuten alleen doordat een soort met een andere waarde bestaat; de voorafgaande review- en publicatieroute blijft nodig.`,['commissieplanning','uitvoering','wijzigingsimpact']),
  a('concepten-sjablonen','Concepten, herhaling en roostersjablonen','Controleer de reeks vóór publicatie en houd voorstellen gescheiden van aanbod.',planning,`
## Voorbereiding en publicatie
De canon onderscheidt roostersjablonen, concepten en bewuste publicatie. In de huidige mobiele maakroute staan Eenmalig, 4 weken en 8 weken als herhaling. Het planningsoverzicht toont native concept- en publicatiestatus. Die herhalingskeuze is geen onbeperkte sjablooneditor of vrij slepen van bestaande afspraken.
## Stappenplan
1. Kies de juiste commissie, seizoen en taaksoort voordat je een reeks voorbereidt.
2. Vul tijden, plaatsen, eisen en instructies in. Controleer de concrete datums van de gekozen herhaling.
3. Controleer locatieconflicten, capaciteit en eventuele aansluiting op wedstrijden voor alle afspraken.
4. Bekijk concepten en voorstellen als voorbereiding. Communiceer ze niet alsof mensen zich al kunnen inschrijven.
5. Publiceer via de aangeboden bevoegde route en controleer welke afzonderlijke taken werkelijk zichtbaar zijn.
## Regels
Een concept veroorzaakt geen nieuwe-aanbodmelding. Publicatie is een expliciete gebeurtenis en retries mogen geen dubbele taken of meldingen maken. Formulierwijziging en een eventuele plannerhandeling moeten dezelfde vereisten volgen. Reeds bezette afspraken vragen impactcontrole en kunnen herbevestiging nodig hebben.
## Als een hulpmiddel ontbreekt
Gebruik alleen de aanwezige werkroute of laat de bevoegde verantwoordelijke de taak via de native route voorbereiden. Een historische prototypeknop voor slepen, batchpublicatie of sjabloonkeuze bewijst niet dat dezelfde bediening nu in ieder scherm bestaat.`,['commissieplanning','wijzigingsimpact','wedstrijdvoorstellen']),
  a('clusters','Vrije verenigingsplaatsen clusteren voor een team','Reserveer bestaande vrije plaatsen met deadlines en expliciete teamtelling.',['club_cluster.manage'],`
## Een cluster reserveert plaatsen
Een cluster verwijst naar bestaande concrete vrije verenigingsplaatsen. Gereserveerde plaatsen verdwijnen uit de openbare markt en gaan naar exact het ontvangende team. Dit maakt nog geen uitvoerdersboeking.
## Stappenplan
1. Open Planning en verdeling en kies Verenigingstaken clusteren.
2. Controleer de vrije plaatsen en de reden wanneer een plaats niet reserveerbaar is.
3. Kies het toegestane ontvangende team en een duidelijke clustertitel.
4. Kies zelfinschrijving of toewijzing en leg beide opvolgdeadlines vast.
5. Geef bewust aan of bevestigde plaatsen voor de teamtelling meetellen.
6. Bevestig de reservering en controleer clusterbezetting, openbare beschikbaarheid en de teamwerkruimte.
## Controle
Een inmiddels geboekte of gereserveerde plaats kan niet alsnog onder een oud voorstel worden weggehaald. Het teamadvies helpt bij verdeling maar verleent geen extra teammandaat. Een concrete plaats behoudt haar taakbron, instructies en afgesproken minuten.
## Opvolging en vrijgeven
Volg open, toegewezen en geboekte plaatsen afzonderlijk. Vrijgeven mag alleen de huidige toegestane vrije plaatsen betreffen en moet bezette afspraken behouden. Een teamouder kiest later een lid; het huishouden kiest daarna de echte uitvoerder. Eén uitvoering telt nooit dubbel voor twee kinderen of huishoudens.`,['commissieplanning','verdeling','teamplaats-controle']),
  a('wijzigingsimpact','Een bezette taak of instructie wijzigen','Beoordeel gevolgen voor deelnemers voordat je een nieuwe versie doorvoert.',planning,`
## Wat een wezenlijke wijziging is
Een gewijzigde tijd, locatie, duur, urenwaarde, instructie of vereiste kan de oorspronkelijke toezegging veranderen. Een interne planningsaanpassing mag geen stabiele plaats in een los nieuw taakrecord opsplitsen waardoor historie, bronkoppeling of wachtlijst verloren gaat.
## Stappenplan
1. Open de actuele taak en bekijk concrete plaatsen, boekingen en bronversies.
2. Vergelijk de voorgenomen wijziging met de eerder afgesproken voorwaarden.
3. Controleer opnieuw locatie, capaciteit, overlap, kwalificaties, begeleiding en de geraakte deelnemers.
4. Volg de aanwezige impact- en herbevestigingsroute. Informeer betrokkenen met de concrete gevolgen, niet alleen een algemene planningstekst.
5. Controleer na bevestigde verwerking de taakversie, plaatsbezetting en benodigde reacties.
## Instructies
Een verbeterde instructie is een nieuwe bronversie. Kies expliciet welke bestaande taken die ontvangen en volg eventuele herbevestiging. Eerdere erkenning van een oude versie blijft in de historie.
## Grenzen
Een nieuwe algemene afmeldregel herschrijft oude cancellation-snapshots niet. Een wedstrijdwijziging is eerst een impactgeval, geen toestemming om alle gekoppelde diensten te verschuiven. Als een benodigde editor of impactstap niet in jouw scherm aanwezig is, laat de bevoegde verantwoordelijke de native route volgen in plaats van een tweede taak te maken.`,['uitvoering','documenten','wedstrijdvoorstellen']),
  a('uitvoering','Uitvoering bevestigen, gedeeltelijk toekennen en no-show','Bevestig de echte boeking na afloop met de juiste minuten en reden.',execution,`
## Bevestigen na uitvoering
Geplande duur, afgesproken credit en uiteindelijke toekenning zijn verschillende waarden. Alleen de bevoegde bevestiging na de taak maakt ledgeruren. Een kaartstatus, voorbereidingsvinkje of teamtoewijzing doet dat niet.
## Stappenplan
1. Open Uitvoering of Commissieoverzicht → Uitvoering en kies de verstreken boeking.
2. Controleer taak, concrete plaats, uitvoerder, huishouden en afgesproken minuten.
3. Kies aanwezig, gedeeltelijk of niet verschenen. Bij gedeeltelijke toekenning leg je de afwijkende minuten en concrete reden vast.
4. Bij no-show bevestig je bewust dat geen uitvoering is toegekend; de minuten zijn nul.
5. Bij een batch controleer je iedere geselecteerde boeking en versie. Bevestig de gecontroleerde groep en wacht op opslag.
6. Controleer de nieuwe status en huishoudstand. Teamtelling volgt dezelfde uitvoering, met hoogstens één gekozen speler per plaats.
## Clubannulering
Voortijdige clubannulering, afgebroken dienst of eerder naar huis sturen vraagt de toepasselijke taakafspraak en gemotiveerde toekenning. Gebruik de formele administratieve uitvoeringsroute wanneer de mobiele keuzelijst dit geval niet aanbiedt.
## Grenzen
No-show maakt geen automatische boete of sportieve sanctie. Een bevestiging sluit niet zomaar andere open urenvragen van hetzelfde huishouden. Fouten worden via een correctiepost hersteld, niet door de oorspronkelijke historie te vervangen.`,['uitvoering-correctie','taakcatalogus','teamplaats-controle']),
  a('uitvoering-correctie','Een bevestigde uitvoering corrigeren','Herstel aantoonbare fouten met reden en behoud de oorspronkelijke toekenning.',execution,`
## Een correctie is nieuwe historie
Een foutieve toekenning mag worden hersteld, ook als de oorspronkelijke registratie al bevestigd is. De correctieroute bewaart de eerdere bronpost en voegt een herleidbare aanpassing toe. Oude minuten of bevestigers worden niet stilzwijgend overschreven.
## Stappenplan
1. Open Uitvoering en de concrete bevestigde boeking.
2. Lees het actuele bevestigd uitvoeringsbesluit, de afgesproken credit en eventuele gekoppelde urenvraag.
3. Controleer de feitelijke uitvoering en de reden voor herstel met de bevoegde betrokkenen.
4. Gebruik Correctie van uitvoering voor het juiste resultaat en de uiteindelijke toekenning. Vul een concrete reden in en bevestig bewust.
5. Controleer de correctiepost, oorspronkelijke historie en nieuwe stand na verwerking.
6. Bekijk of een financiële beoordeling moet worden herzien. Een reeds definitief verwerkt bedrag mag niet ongemerkt op dezelfde oude rekenbasis blijven staan.
## Grenzen
Een correctie van één booking sluit geen unrelated bezwaar of alle blokkades van het huishouden. Een open vraag wordt via de eigen besluitroute afgehandeld. De actor, scope, versie en opdrachtsleutel blijven bij de gevoelige wijziging vastgelegd.
## Bij een gewijzigde versie
Herlaad de huidige toekenning en vergelijk het recente besluit voordat je nog een correctie indient. Bij een onbekende uitkomst controleer je dezelfde opdracht en ledger; een nieuwe correctie kan anders onbedoeld twee keer werken.`,['uitvoering','uurvragen-beoordelen','financiele-herziening']),
  a('werkkaarten','Werkkaarten, meerdere uitvoerders en subtaken','Organiseer werk op het commissiebord zonder automatisch uren te boeken.',workspace,`
## Kaart en uitvoering
Een werkkaart ordent werk binnen een commissie. Ze kan meerdere uitvoerders en eventueel één aanspreekpunt hebben. Checklist, subtaken, planning, reacties en bronkoppelingen helpen de opvolging. Een afgeronde kaart is geen urenregistratie.
## Stappenplan
1. Open Samen organiseren en kies het juiste bord van je commissie.
2. Maak een werkafspraak met titel, omschrijving, kolom, deadline en de toegestane uitvoerders.
3. Open de kaart en werk status, checklist en reacties bij via de aangeboden acties.
4. Controleer gekoppelde bronnen, uitvoerders en deadlines bij de eigen actieoverzichten.
5. Rond de kaart af wanneer het werk klaar is. Laat een gekoppelde verenigingstaak afzonderlijk op uitvoering bevestigen.
## Uitgebreide bordregels
Kolommen horen bij het betreffende bord, met als startindeling Ideeën, Te doen, Bezig, Wacht op en Afgerond. Subtaken kunnen eigen uitvoerders hebben. Labels, aanspreekpunt, bijlagen en typed koppelingen mogen alleen via hun werkelijk aanwezige native werkroute worden gewijzigd; de compacte mobiele kaarteditor biedt niet iedere uitgebreide beheerhandeling.
## Privacy en mentions
Een mention verleent geen bronrecht. Toewijzing en mention uit één gebeurtenis worden ontdubbeld in opvolging. Reageer binnen de juiste commissie en bewaar private huishoudredenen niet als algemene kaartbeschrijving.`,['documenten','commissie-start','commissieberichten']),
  a('documenten','Documenten, instructieversies en veilige downloads','Leg eigenaar, zichtbaarheid en versies vast en deel de juiste bronlink.',workspace,`
## De documentbron
Commissiedocumenten hebben een eigenaar, zichtbaarheid en versie. De compacte app toont de toegestane tekst, checklist en een geautoriseerde downloadroute. Een versie is niet hetzelfde als een los opnieuw geüpload bestand zonder historie.
## Stappenplan
1. Kies je commissie en open Instructies of Documentversies in verenigingsbeheer.
2. Zoek het bestaande document en controleer titel, revision en zichtbaarheid.
3. Lees of download de aangeboden versie. Deel de bronlink alleen met personen die dezelfde bron mogen zien.
4. Gebruik voor verbeteren de bevoegde native document- of instructieroute. Leg een volgende versie vast met een herkenbare reden.
5. Controleer of gekoppelde taken de nieuwe versie bewust aangeboden krijgen en of belangrijke wijzigingen opvolging vragen.
## Bijlagen en opslag
Besloten bijlagen horen bij private opslag en dezelfde scopecontrole als het document. Een downloadlink of oude export geeft geen blijvend recht. Publieke branding mag geen private intake- of gezinsinformatie bevatten.
## Als wijzigen niet beschikbaar is
Vraag de huidige documenteigenaar of bevoegde coördinator om de wijziging. De huidige leeslijst bewijst niet dat iedere gebruiker upload- of publicatierechten heeft. Maak geen openbare kopie als omweg.
## Controle
Na intrekking moet de server ook de concrete download weigeren. Een oude kaartmention of zoekhit mag de afgeschermde tekst niet alsnog onthullen.`,['werkkaarten','wijzigingsimpact','instructie-feedback']),
  a('commissieberichten','Commissiegesprekken, mentions en agenda-opvolging','Houd gesprekken, activiteiten en persoonlijke acties bij hun geautoriseerde bron.',workspace,`
## Samenwerking binnen bereik
Een commissiekanaal is beperkt tot de toegestane ontvangers. Werkkaarten, agenda-items en gesprekken kunnen mentions en opvolging bevatten. Dezelfde toegangsgrens geldt voor tekst, notificatie, zoekresultaat en export.
## Stappenplan
1. Open het bedoelde commissiekanaal bij Berichten.
2. Plaats een concrete praktische boodschap en controleer de bevestigde opslag.
3. Gebruik mentions alleen voor bestaande bevoegde personen en de juiste broncontext.
4. Open persoonlijke acties voor concrete kaart-, subtaak-, agenda- of vraagopvolging.
5. Gebruik bij activiteiten de juiste kalenderlaag, tijd, locatie en doelgroep. RSVP bevestigt deelname, geen uren.
## Herhaling en kalender
Herhaalde activiteiten houden reeks en uitzonderingen apart. Een locatieconflict, gekoppelde taak of wedstrijdwijziging kan aanvullende beoordeling vragen. Een kalenderbestand bevat uitsluitend de toegestane scope en is een momentopname.
## Grenzen van bediening
De compacte mobiele agenda is vooral lezen, filteren, bron openen en RSVP. Volledige reeksbewerking of bijlagebeheer hoort bij een aanwezige bevoegde native route; een prototypeveld is geen bewijs dat dezelfde editor nu beschikbaar is.
## Goede opvolging
Bewaar een concrete vraag bij de bron in plaats van meerdere algemene groepsmeldingen. Een dubbele mention/toewijzing hoort één logisch actie-item op te leveren. Privéredenen en financiële achtergrond horen niet in een commissiekanaal zonder specifieke bevoegdheid.`,['werkkaarten','documenten','commissie-start']),
  a('instructie-feedback','Feedback verwerken en praktische waardering organiseren','Verbeter werkafspraken en houd aandacht voor vrijwilligers zorgvuldig afgeschermd.',workspace,`
## Praktische terugblik
Uitvoerders kunnen aangeven of ze opnieuw willen helpen, of instructies duidelijk waren en welke tip helpt. Gebruik die informatie om de taakervaring te verbeteren, zonder hun private dossier of urenstand automatisch te veranderen.
## Stappenplan
1. Lees de toegestane taakfeedback bij de commissie- of teamwerkruimte.
2. Maak een concrete vervolgstap voor onduidelijke instructie, materiaal of begeleiding.
3. Publiceer een verbeterde instructieversie via je bevoegde route en selecteer bewust geraakte taken.
4. Leg een passende waarderingsactie bij een geautoriseerde werkkaart vast met eigenaar, uitvoerders en deadline.
5. Stem een eventueel budget af via de afzonderlijke vrijwilligerspotroute.
## Waarderingsregels
Verjaardagen en jubilea mogen alleen uit betrouwbare geboortedata en lidmaatschapsstart worden afgeleid. Onbekende datums blijven onbekend. Eén gelegenheid moet niet door meerdere commissies tot dubbele acties leiden. Publieke felicitatie en besloten lief en leed zijn afzonderlijke keuzes; persoonlijke achtergrond blijft beperkt toegankelijk.
## Wat de huidige schermen bieden
De actieve app heeft feedback, werkkaarten en instructieverbetering. Dat is geen bewijs van een volledige automatische verjaardags- of jubileumplanner in de compacte app. Laat de bevoegde verantwoordelijke de aanwezige native waarderingsroute controleren voordat automatische verzending wordt toegezegd. Kaartafronding, waardering en feedback boekt geen uren.`,['documenten','werkkaarten','vrijwilligerspot']),
  a('wedstrijdvoorstellen','Wedstrijdgebonden taakvoorstellen beoordelen','Gebruik echte brongegevens en controleer impact voordat diensten worden gepubliceerd.',planning,`
## Bron en voorstel
Sportlink levert beschikbare wedstrijdgegevens. Een thuiswedstrijd kan aanleiding zijn voor taakvoorstellen rond de echte aftrap. Een voorstel is voorbereiding en maakt niet automatisch een bezette dienst. De betekenis van het Sportlinkveld duur is nog niet bevestigd; Cluvo gebruikt geen verzonnen wedstrijdeindtijd.
## Stappenplan
1. Controleer het wedstrijdrecord, team, aftrap, thuis/uit, locatie en bronstatus.
2. Bekijk de aanwezige taakvoorstellen en relatieve planning binnen je commissie.
3. Controleer taaksoort, capaciteit, tijden, locatie en praktische instructies.
4. Beoordeel wijzigingen of afgelasting met de gekoppelde plaatsen en boekingen erbij.
5. Publiceer of wijzig pas via de bevoegde expliciete route, met noodzakelijke deelnemersopvolging.
## Als de bron faalt
Een mislukte of onvolledige import bewijst geen afgelasting. Laat de laatste bekende informatie herkenbaar staan en vraag de importverantwoordelijke om controle. Een identieke herimport hoort geen dubbele wedstrijden, voorstellen of meldingen te maken.
## Grenzen
Behouden tijden en informeren is een bewust besluit, niet een automatische standaard voor iedere wijziging. Een bronwijziging mag al toegezegde minuten, cancellation-afspraken of uitvoerders niet stilzwijgend herschrijven. Als voorstel- of impactbediening niet in jouw scherm staat, laat de bevoegde native route volgen.`,['sportlink','wijzigingsimpact','concepten-sjablonen']),
]};
export default book;
