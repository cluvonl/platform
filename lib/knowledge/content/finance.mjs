import {article as a} from '../model.mjs';
const view=['finance.assessment.view','finance.assessment.prepare','finance.assessment.approve','finance.assessment.finalize'];
const book = {id:'financien',title:'Financieel beheer',environment:'club',description:'Rekenbasis, onafhankelijke overdracht, definitieve verwerking, correcties en vrijwilligerspot.',articles:[
  a('financiele-basis','De financiële rekenbasis en aangepaste doelen','Bereken met minuten en eurocenten en rond het totaal eenmaal af.',view,`
## De standaardbasis
De standaard is €150 voor 720 minuten: €12,50 per ontbrekend uur. Cluvo rekent met gehele minuten en eurocenten en rondt het totale bedrag eenmaal af. De effectieve goedgekeurde jaarafspraak bepaalt ontbrekende minuten; open controles of besluiten moeten eerst worden beoordeeld.
## Voorbeelden
Bij 12 uur doel en 9 uur bevestigd ontbreken 180 minuten: €37,50. Bij een goedgekeurd doel van 8 uur en 6 uur bevestigd ontbreken 120 minuten: €25 op de standaardminutenprijs. Rond niet elk afzonderlijk minuutbedrag af, want dat kan het totaal veranderen.
## Stappenplan
1. Kies vereniging en seizoen en open Financiële besluiten.
2. Controleer effectieve verplichting, bevestigde ledgerstand, financiële regelversie en eventuele uitzonderingsbesluiten.
3. Controleer alle relevante open uren, geschillen, aanvragen en aanbodbeoordelingen.
4. Kies pas daarna de toegestane tekort- of afkooproute en lees de berekende grondslag terug.
5. Laat voorbereiding, goedkeuring en verwerking door de daarvoor afzonderlijk bevoegde accounts uitvoeren.
## Afkoop
Een goedgekeurde volledige afkoop is één financiële afspraak van €150 op de standaardroute. Ze wordt niet daarnaast nogmaals als tekort gefactureerd. Een gewijzigde afspraak na definitieve verwerking vraagt een herziening, geen stille vervanging van het oude bedrag.
## Privacy
Financieel beheer leest de nodige bedragen en rekenbasis. Private medische of persoonlijke aanvraagachtergrond geeft geen extra financieel werkrecht en hoort niet in de export.`,['financiele-voorbereiding','financiele-goedkeuring','financiele-herziening']),
  a('financiele-voorbereiding','Een afrekenvoorstel voorbereiden','Controleer grondslag en blokkades vóór overdracht voor goedkeuring.',['finance.assessment.prepare'],`
## Voorstel en eindbedrag
Een voorbereid voorstel is nog geen definitieve factuur of gecontroleerde export. Het verwijst naar actuele verplichting, ledger, financiële regel en zo nodig uitzondering of reproduceerbare aanbodbeoordeling.
## Stappenplan
1. Open Financiële besluiten en de juiste huishoudverplichting van het seizoen.
2. Controleer jaarafspraak, bevestigde minuten, te beoordelen uitvoering en bestaande besluiten.
3. Kies tekort of afkoop. Koppel alleen echte vereiste besluit- en aanbodbronnen.
4. Beschrijf de concrete grondslag en reden. Bereken vanuit minuten en rond het totaal eenmaal af.
5. Sla het voorstel op en controleer versie, bedrag, bronnen en blokkades.
6. Draag het actuele voorstel over aan een bevoegde onafhankelijke goedkeurder.
## Blokkades
Open relevante urencontrole, geschillen, uitzonderingen, bezwaren of ontbrekende beoordelingen moeten eerst worden opgelost. Er mag niet tegelijk een actieve afkoop- en tekortclaim voor dezelfde verplichting ontstaan. Algemene open cluburen bewijzen geen voldoende passend aanbod.
## Gewijzigde bron
Een latere ledgercorrectie, nieuw bezwaar of gewijzigd besluit kan de grondslag veranderen. Laat het voorstel opnieuw beoordelen voordat definitieve verwerking volgt. Een voorbereid bedrag mag niet als betaalverzoek worden verspreid alsof het al is goedgekeurd.`,['financiele-basis','financiele-goedkeuring','uitzonderingen']),
  a('financiele-goedkeuring','Een financieel voorstel onafhankelijk goedkeuren','Beoordeel de huidige bronversie en houd voorbereiding en verwerking afzonderlijk.',['finance.assessment.approve'],`
## De overdracht
Goedkeuren is de gecontroleerde inhoudelijke overdracht aan financieel beheer. De voorbereiding, goedkeuring en definitieve verwerking zijn afzonderlijke bevoegdheden. Dezelfde persoon kan niet zomaar zijn eigen voorstel als onafhankelijke controle behandelen.
## Stappenplan
1. Open het actuele voorstel en controleer de feitelijke voorbereider.
2. Lees de effectieve jaarafspraak, bevestigde minuten, financiële regel, gekozen route en besluitbronnen.
3. Controleer of nog relevante uitvoering, bezwaren, uitzonderingen of aanbodvragen openstaan.
4. Controleer het totaalbedrag en het ontbreken van een dubbele afkoop- of tekortclaim.
5. Leg bevoegd akkoord met concrete reden op de huidige versie vast.
6. Lees de goedgekeurde status terug en draag uitsluitend die versie over voor verwerking.
## Grenzen
Een algemene bestuursrol geeft niet automatisch dit financiële recht. Een vraag beantwoorden of een urenbesluit bevestigen is geen financiële goedkeuring. Private aanvraagachtergrond hoort niet onnodig in deze controle.
## Na een verandering
Een nieuwe ledgerpost of gewijzigd besluit kan de oude goedkeuring achterhalen. Definitieve verwerking moet de huidige bronnen nogmaals controleren. Geef geen blanketgoedkeuring aan alle toekomstige versies en verwijder geen open blokkades om een batch te laten doorgaan.`,['financiele-verwerking','financiele-voorbereiding','financiele-herziening']),
  a('financiele-verwerking','Definitief verwerken als factuur of gecontroleerde export','Finaliseer alleen een complete goedgekeurde huidige rekenbasis.',['finance.assessment.finalize'],`
## De finale stap
Definitieve verwerking maakt de vastgelegde factuur- of exportbasis. De server hercontroleert bronnen en blokkades onder dezelfde verplichtingsbescherming als relevante uren- en besluitwijzigingen. Een eerder groen voorstel alleen is onvoldoende.
## Stappenplan
1. Open de huidige goedgekeurde beoordeling van het juiste seizoen.
2. Controleer actor, bronversies, bedrag, route en eventuele recente herzieningen.
3. Kies factuur of gecontroleerde export en leg de concrete verwerkingsreden vast.
4. Bevestig eenmaal en wacht op de serverstatus.
5. Lees het finale verwerkingsrecord en de exact gefixeerde grondslag terug.
6. Gebruik alleen een geautoriseerde export met dezelfde scope; houd betaalregistratie en potontvangst als afzonderlijke bewezen gebeurtenissen bij.
## Bij gelijktijdige wijzigingen
Een nieuw relevant bezwaar of urenbesluit mag niet ongemerkt worden genegeerd. De opdracht kan worden geblokkeerd of een herzieningsroute vereisen. Bij onbekende uitkomst controleer je dezelfde opdrachtsleutel en het verwerkingsrecord, zodat geen tweede claim ontstaat.
## Grenzen
Een gecontroleerde export is geen automatisch bewezen betaalprovidertransactie. Een open factuur is een vordering, nog geen werkelijk ontvangen vrijwilligerspotgeld. Een later gecorrigeerde grondslag vraagt herziening; verwijder het oude verwerkingsrecord niet.`,['financiele-herziening','betalingen','vrijwilligerspot']),
  a('betalingen','Betaalstatus, bewijs en financiële exports','Maak onderscheid tussen verwerkt bedrag, werkelijke ontvangst en potboeking.',view,`
## Afzonderlijke gebeurtenissen
Een definitief voorstel of factuurbasis bewijst het verschuldigde verwerkte bedrag. Een betaling vraagt een bewezen betaalbron of de bevoegde gecontroleerde handmatige route. De vrijwilligerspot registreert werkelijke ontvangsten, reserveringen en uitgaven; een open claim is geen potontvangst.
## Stappenplan
1. Controleer het finale verwerkingsrecord, bedrag, route en seizoen.
2. Verifieer de feitelijke betaalbron en de beschikbare native statusroute voordat je een betaling als ontvangen presenteert.
3. Leg de ontvangst alleen via de toegestane bewezen route vast en controleer bronverwijzing en actuele status.
4. Boek een potontvangst alleen met echte grondslag; dezelfde betaling mag bij retry niet dubbel worden geboekt.
5. Exporteer uitsluitend de gefixeerde geautoriseerde financiële basis en bescherm de download.
## Huidige bediening
Het actieve beheer biedt voorbereiden, goedkeuren, definitief verwerken en gecontroleerde potposten. Dat bewijst geen complete automatische incasso- of betaalproviderkoppeling in dit scherm. Ontbreekt de benodigde betaalstatusbediening, laat de bevoegde financiële verantwoordelijke de gecontroleerde native verwerking volgen in plaats van een losse notitie als betaalbewijs te gebruiken.
## Correcties
Een betaalde of verstuurde claim wordt niet gewist. Een herziening moet expliciet verrekening, credit of terugbetaling behandelen waar van toepassing. Een oude tekortclaim moet gecontroleerd worden gecorrigeerd voordat dezelfde periode naar afkoop gaat.`,['financiele-verwerking','financiele-herziening','vrijwilligerspot']),
  a('financiele-herziening','Een financiële grondslag na verwerking corrigeren','Behoud oude claims en betaalhistorie en verwerk een expliciete herziening.',view,`
## Waarom herziening nodig is
Een latere urenboeking, ledgercorrectie, vrijstellingsbesluit of bezwaar kan het definitieve bedrag veranderen. De oorspronkelijke claim en eventuele betaling blijven bewaard. De app terugrollen maakt de financiële databasehistorie niet ongedaan.
## Stappenplan
1. Bekijk het oorspronkelijke verwerkingsrecord en de concrete gewijzigde bron.
2. Controleer of de claim al verstuurd of betaald is en welke gevolgen het nieuwe besluit heeft.
3. Laat de bevoegde inhoudelijke correctie eerst met eigen audit en bronversie vastleggen.
4. Volg de gecontroleerde financiële herbeoordelingsroute voor de nieuwe grondslag.
5. Leg waar nodig expliciete verrekening, credit of refund vast via de toegestane native verwerking.
6. Controleer het actuele netto-effect en behoud oude records, ontvangstbewijs en oorspronkelijke ledger.
## Regels
Een bestaande actieve tekortclaim en afkoop mogen niet dubbel dezelfde verplichting innen. Potcorrecties verwijzen naar de juiste oorspronkelijke post. Een negatieve of gewijzigde grondslag mag niet door handmatige overschrijving verdwijnen.
## Als de editor ontbreekt
Het bestaan van financiële backendcontracten bewijst niet dat elke complexe refund in de compacte interface kan worden ingevoerd. Vraag de benoemde financiële verantwoordelijke de geautoriseerde native route te gebruiken. Presenteer een voorgenomen correctie pas als uitgevoerd nadat de nieuwe bron en eindstand zijn teruggelezen.`,['financiele-basis','betalingen','uitvoering-correctie']),
  a('vrijwilligerspot','Ontvangsten, reserveringen en uitgaven in de vrijwilligerspot','Boek alleen werkelijke financiële gebeurtenissen met doel en verantwoordelijke.',['finance.fund.manage'],`
## De potstanden
Ontvangen, vrij beschikbaar, gereserveerd en besteed zijn verschillende standen. Een reservering vermindert beschikbaar budget, maar is nog geen uitgave. Een open factuur is geen ontvangen geld.
## Stappenplan
1. Open Financiële besluiten → Vrijwilligerspot en controleer de actuele posten.
2. Kies de passende soort: ontvangst, reservering, vrijgave, besteding uit reservering, directe besteding of correctie.
3. Vul het bedrag in eurocenten in, met doel, verantwoordelijke en concrete reden.
4. Koppel waar nodig de juiste reservering, financiële verwerking of oorspronkelijke te corrigeren post.
5. Sla eenmaal op en controleer het effect op beschikbaar, gereserveerd en besteed.
6. Bekijk de historie en de toegestane potweergave in de app.
## Voorbeeld
Een reservering van €50 maakt 5000 cent minder vrij beschikbaar en 5000 cent gereserveerd. Pas een bewezen besteding uit die reservering wordt een uitgave. Vrijgave van een ongebruikte reservering maakt budget weer beschikbaar.
## Grenzen
Een waarderingskaart afronden betaalt geen bedrag. Iedere uitgave vraagt de benodigde grondslag, doel en verantwoordelijkheid. Correcties voegen nieuwe herleidbare posten toe; ze overschrijven de oude ontvangsten niet. De pot is geen nieuw abonnements-, incasso- of commerciële facturatiesysteem.`,['betalingen','financiele-herziening','instructie-feedback']),
]};
export default book;
