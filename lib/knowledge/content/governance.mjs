import {article as a} from '../model.mjs';
const organization=['organization.manage'];
const book = {id:'bestuur',title:'Bestuur en verenigingsbeheer',environment:'club',description:'Verenigingsinrichting, personen, toegang, beleid, communicatie, rapportages en seizoenen.',articles:[
  a('beheer-start','Inloggen als verenigingsbeheerder en het overzicht gebruiken','Je eigen geverifieerde account opent uitsluitend de daadwerkelijk toegekende beheeronderdelen.',['organization.manage','organization.access.manage','report.season.view'],`
## Het beheermandaat
Een beheerder gebruikt dezelfde persoonlijke OTP-login als een lid. Bij Mijn werkruimtes of in de app Meer verschijnt verenigingsbeheer alleen met een actueel mandaat. Bestuur is geen onbeperkte superrol: organisatie, dossiers, beleidsbeheer en financiën hebben afzonderlijke bevoegdheden.
## Stappenplan
1. Log als jezelf in en kies de bedoelde vereniging.
2. Open Verenigingsbeheer en controleer vereniging, status en seizoen boven de werkruimte.
3. Bekijk het Overzicht voor de beschikbare actuele bronnen en signalen.
4. Kies het relevante onderdeel in de gegroepeerde navigatie. Ontbrekende onderdelen kunnen buiten je huidige mandaat vallen.
5. Controleer bij iedere gevoelige wijziging de actuele gegevens en versie; wacht op bevestigde opslag.
## Geen stille rolwisseling
Een trainingsfunctie, vrijstelling of teamouderaanstelling verleent niet automatisch bestuursrechten. Een expliciet aangeboden beheeruitnodiging moet door de benoemde geverifieerde ontvanger worden geaccepteerd. Verlopen of ingetrokken toegang blokkeert ook directe links en open formulieren.
## Ondersteuning
Een platformmedewerker kan alleen via benoemde tijdelijke support met clubtoestemming toegelaten werkzaamheden doen. Dat geeft geen toegang tot private intakes, gezinnen of financiële achtergrond. Controleer het doel, bereik en einde voordat je toestemming geeft.`,['toegang-beheer','vereniging-inrichten','supporttoestemming']),
  a('vereniging-inrichten','Verenigingsgegevens, huisstijl en locaties beheren','Leg actuele contactinformatie en werkplekken vast binnen Club Signal.',organization,`
## De verenigingscontext
Elke vereniging heeft eigen naam, contactroute, huisstijl, locaties en afspraken. Cluvo blijft de gezamenlijke productnaam en Club Signal de visuele basis. Branding verandert geen bevoegdheden en mag geen private persoonsgegevens bevatten.
## Stappenplan
1. Open Vereniging → Vereniging en controleer de bestaande gegevens.
2. Vul de juiste naam, contactnaam, e-mailadres en telefoon in. Gebruik een bereikbare praktische contactroute.
3. Kies de toegestane logo-asset of uploadroute en een geldige accentkleur. Controleer de preview voor leesbaarheid.
4. Leg een concrete wijzigingsreden vast en sla op.
5. Open Locaties, maak of wijzig de werkplek en controleer of die actief moet zijn.
6. Bekijk de nieuwe verenigingsweergave en toekomstige taakselecties na bevestigde opslag.
## Historie en veiligheid
Een locatie deactiveren wist oude taken en afspraken niet. Een huisstijlwijziging opent geen dossier of module. Alleen bewust goedgekeurde publieke branding mag publiek beschikbaar zijn; besloten documenten blijven via hun eigen scope beschermd.
## Nieuwe of gepauzeerde vereniging
De platformstatus en modulekeuzes kunnen nieuwe werkzaamheden beperken. Een contactwijziging activeert de vereniging niet automatisch. Controleer de actuele status en benoemde beheermandaten voordat je leden uitnodigt of aanbod publiceert.`,['afspraken-instellingen','personen-beheer','beheer-start']),
  a('personen-beheer','Personen, huishoudens en team- of commissieleden beheren','Maak expliciete relaties en behoud historische koppelingen.',organization,`
## Personen zijn geen accounts
Een verenigingspersoon beschrijft iemand binnen die club. Het geverifieerde account bepaalt wie handelt. Een huishouden, teamlidmaatschap, commissietaak en systeemgrant zijn afzonderlijke relaties. Een naam of e-mailadres mag geen automatische identiteitsfusie veroorzaken.
## Stappenplan
1. Open Personen en huishoudens en zoek de bestaande persoon voordat je een nieuwe toevoegt.
2. Leg naam, status en alleen een betrouwbare lidmaatschapsstart vast. Laat onbekende broninformatie onbekend.
3. Open Huishoudens voor label en praktische dossiermarkering. Maak expliciete persoonskoppelingen met het juiste type.
4. Open Teams of Commissies voor de betreffende lidmaatschappen en contactverantwoordelijkheid.
5. Beëindig een relatie via de daarvoor bedoelde actie met reden. Controleer de actuele lijst en historie.
6. Laat de seizoensverplichtingsmapping en eventuele dossiertransitie afzonderlijk door bevoegde beoordelaars vastleggen.
## Grenzen
Een toegevoegd persoon heeft nog geen geverifieerde login, boekingsrecht of vrijstelling. Een teamlid kan speler, coach of staf zijn; teamoudertoegang vraagt het eigen mandaat. Een huishouddetail opent niet automatisch de persoonlijke intake van een andere ouder.
## Herstel
Archiveer zorgvuldig in plaats van historische ledger, besluiten of lidmaatschappen te verwijderen. Koppel of splits dossiers niet op alleen naam- of adresgelijkheid. Een CSV-voorstel of bronimport moet dezelfde controles volgen.`,['dossierkoppelingen','toegang-beheer','ledenimport']),
  a('toegang-beheer','Benoemde rollen, uitnodigingen en intrekking','Geef minimale rechten met expliciet bereik en eindtijd.',['organization.access.manage'],`
## Het mandaat
Een systeemrol bestaat uit afzonderlijke rechten en een tenant-, commissie-, team- of huishoudscope. Benoeming is niet hetzelfde als een vrijwilligersfunctie of vrijstelling. Rechten moeten bij iedere handeling nog geldig zijn.
## Stappenplan
1. Open Rollen en toegang en controleer bestaande grants en open uitnodigingen.
2. Selecteer het bestaande geverifieerde persoonlijke account. Controleer naam en adres zonder een gedeeld account te maken.
3. Kies de rol, het exacte bereik en de mandaat-eindtijd.
4. Gebruik een benoemde beheeruitnodiging wanneer aanvaarding nodig is. Stel ook Accepteren vóór in en lees de aangeboden rechten na.
5. De ontvanger accepteert de huidige rechten en eindtijd bij Mijn werkruimtes. Controleer daarna het daadwerkelijke grantresultaat.
6. Trek een verkeerd of beëindigd mandaat met reden in; annuleer een onjuiste open uitnodiging afzonderlijk.
## Controle
Een nog open of verlopen uitnodiging verleent geen rechten. Een oude acceptatie mag niet een gewijzigd aanbod accepteren. Intrekking sluit ook een gemonteerde beheercontext na hercontrole en blokkeert nieuwe mutaties direct.
## Grenzen
Geef geen extra financiële of private dossierrechten om een menuknop zichtbaar te maken. Tijdelijke support heeft een afzonderlijke toestemmingsroute. De actuele actor, scope, versie, opdrachtsleutel en reden blijven bij gevoelige wijzigingen herleidbaar.`,['beheer-start','supporttoestemming','intakehulp']),
  a('afspraken-instellingen','Verenigingsafspraken en termijnen wijzigen','Nieuwe regels gelden via hun eigen versie; bestaande boekingsafspraken blijven traceerbaar.',organization,`
## Instellingen en seizoensdoelen
Verenigingsafspraken bevatten onder meer normale afmeldtermijn, bevestigingsdagen en bezwaardagen. Seizoensdoelen, wintergrens en effectieve individuele besluiten hebben hun eigen bron. Een huidige algemene instelling mag een oudere booking niet stilzwijgend herschrijven.
## Stappenplan
1. Open Vereniging → Afspraken en lees de huidige versie.
2. Vul de normale afmeldtermijn in hele minuten en bevestigings- en bezwaartermijnen in dagen in.
3. Controleer welke nieuwe afspraken de versie zullen gebruiken en welke bestaande snapshots behouden blijven.
4. Leg de reden vast, sla op en lees de nieuwe versie terug.
5. Controleer een nieuwe taak en een bestaande afspraak om de verschillende grondslagen te begrijpen.
## Startwaarden
Het standaardjaardoel is 720 minuten met 360 winterminuten. Starttermijnen voor uitvoering en bezwaar zijn zeven en veertien dagen. Dienstreminders hebben configureerbare regels; de bekende startmomenten zijn zeven dagen en 24 uur vooraf. De werkelijk gepubliceerde club- en seizoensversies zijn leidend.
## Essentiële uitzonderingen
Ziekte en nood blijven meldbaar buiten de normale afmeldgrens. Een administratieve fout kan later herstel nodig hebben. Een wijziging mag geen open bezwaar, eerdere beleidsacceptatie of seizoenshistorie verwijderen. Gebruik de afzonderlijke bevoegde route voor financiële basis en effectieve huishoudbesluiten.`,['seizoen-inrichten','uitzonderingen','communicatieregels']),
  a('functiecatalogus','Vrijwilligersrolcatalogus en vacatures beheren','Beheer erkenningsvoorwaarden, vrijstellend effect en werving in afzonderlijke versies.',['volunteer_role.manage','vacancy.manage'],`
## De catalogus
Een erkende vrijwilligersfunctie kan een huishoudvrijstelling hebben. De functieversie beschrijft voorwaarden en effectieve periode. Een vacature verwijst naar de functie en beschrijft concrete werkzaamheden, inzet, begeleiding en een benoemde contactpersoon.
## Stappenplan
1. Open Aanvragen → Structurele functies en controleer de bestaande rol.
2. Maak of wijzig naam en activiteit. Leg de erkenningsvoorwaarden en het vrijstellende effect vast als expliciete functieversie.
3. Open Vacatures en kies de juiste functieversie en commissie- of teamcontext.
4. Vul titel, werkzaamheden, gewenste inzet, begeleiding, contactpersoon en publicatieperiode in.
5. Publiceer bewust en controleer de zichtbare vacature. Volg belangstelling en kennismaking via de afzonderlijke opvolgroute.
6. Sluit een vacature met reden wanneer de werving eindigt. Eerdere belangstelling blijft behouden.
## Regels
Een functiewijziging overschrijft geen oude aanstelling of ledger. Interesse geeft nog geen erkenning. De erkende rol werkt alleen op het expliciet gekoppelde huishouden en maakt geen fictieve minuten. Een systeemmandaat blijft een aparte benoeming.
## Tussentijdse wijzigingen
Een start, einde of onvoldoende activiteit vraagt een gemotiveerde herbeoordeling van de resterende verplichting. Controleer de toepasselijke periode en oude versies voordat je een nieuw effect als definitief presenteert.`,['vacature-opvolging','functie-erkennen','toegang-beheer']),
  a('beleid-publiceren','Beleid opstellen, publiceren en heracceptatie','Bied de exacte versie aan de expliciet gekozen doelgroep aan.',['policy.manage'],`
## Document en versie
Beleid heeft een documentbron, exacte tekst, doelgroep, ingangsdatum en eventueel heracceptatiebesluit. Een gepubliceerde versie en bijbehorende acceptaties blijven onveranderlijk. Lezen, sluiten van uitleg of wijzigen van berichtvoorkeuren is geen beleidsakkoord.
## Stappenplan
1. Open Beleid en instructies en maak of kies het beleidsdocument.
2. Stel het concept met documentidentificatie, titel en exacte tekst op.
3. Controleer de aangeboden tekst, ingangsdatum en noodzaak van heracceptatie.
4. Kies expliciet de bedoelde personen en publiceer de huidige conceptversie met actieve bevestiging.
5. Bekijk aangeboden, geopende en geaccepteerde opdrachten per persoon. Een ouder moet bevoegde kinderen expliciet selecteren.
6. Volg vragen en bezwaren op en bewaar oudere tekst- en acceptatieversies.
## Herinneringen
Een open relevante vraag of bezwaar pauzeert de bijbehorende reminderroute tijdens behandeling. Essentiële communicatie en ziekmelden blijven bereikbaar. Een niet-geaccepteerd document creëert geen automatische sportieve sanctie.
## Controle
Een document downloaden of openen telt uitsluitend als die eigen leeshandeling. De uiteindelijke acceptatie moet exact de aangeboden hash en versie vastleggen. Bij een gewijzigde conceptversie moeten doelgroep en besluit opnieuw bij de actuele inhoud passen.`,['bestuursescalatie','communicatieregels','documenten']),
  a('opleiding-beheer','Cursussen, kwalificaties en certificering beheren','Verifieer resultaat en geldigheid afzonderlijk van inschrijving.',['development.manage'],`
## Aanbod en bewijs
Een cursus heeft een bron en concrete sessies met tijd en capaciteit. Een kwalificatietype beschrijft wat voor taken vereist kan zijn. Inschrijving of cursusbezoek is geen automatische geverifieerde bevoegdheid.
## Stappenplan
1. Open Opleidingen en maak of controleer het cursusaanbod.
2. Leg sessie, begin, einde, capaciteit en een eventueel beoogd kwalificatietype vast.
3. Controleer aanmeldingen en behaalde resultaten via de aanwezige bevoegde route.
4. Certificeer alleen een werkelijk geverifieerd resultaat, of registreer een afzonderlijk gecontroleerd kwalificatiebewijs met behaaldatum en geldigheid.
5. Controleer het Kwalificatieregister en de toekomstige taken die dit bewijs nodig hebben.
6. Trek een onjuist of ongeldig bewijs expliciet met reden in en volg geraakte boekingen op.
## Buddy en verval
Een maatje moet daadwerkelijk beschikbaar en geschikt zijn. Een voorkeur voor begeleiding vervangt geen veiligheidsvereiste. Bij verval worden toekomstige afspraken niet stilzwijgend verwijderd; er is praktische opvolging en mogelijk heropleiding nodig.
## Privacy en historie
Bewaar het geverifieerde resultaat en actor. Leg geen medische achtergrond vast om een certificaatroute te onderbouwen. Een oude kwalificatieversie, intrekking en toekenning blijven traceerbaar voor de betreffende bevoegde context.`,['taakcatalogus','passend-aanbod-beoordelen','werkdruk']),
  a('berichttemplates','Een berichttemplate maken, testen en publiceren','Doorloop concept, voorbeelden, echte test, goedkeuring en publicatie.',['communication.manage'],`
## Een volledige versie
Een templateversie bevat onderwerp, preheader, afzender, antwoordadres, berichttekst en toegestane knopelementen of afbeelding. Variabelen zijn gecontroleerde invulvelden met veilige fallbacks, geen uitvoerbare code. Een bestaande publicatie blijft bewaard.
## Stappenplan
1. Open Communicatie → Berichttemplates en kies de bestaande template of maak een nieuw concept.
2. Controleer onderwerp, afzender, reply-to, tekst, knoppen en toegestane merkafbeelding.
3. Maak previews voor standaard, ontbrekende naam, lange titel, twee kinderen, geen urenplicht en vertegenwoordigd lid.
4. Zet de echte testverzending naar de ingestelde veilige testontvanger klaar. Controleer de feitelijke testuitkomst van exact deze versie.
5. Laat de huidige geteste versie bevoegd goedkeuren.
6. Publiceer alleen na de vereiste complete route. Controleer de gepubliceerde revision en bewaarde versiehistorie.
## Aflevering
Provideracceptatie bewijst geen inboxaflevering. Een timeout kan onbekend betekenen; blind opnieuw sturen kan duplicaten maken. Een mislukte preview, ontbrekende testreceipt of gewijzigde tekst mag de goedkeuringsroute niet passeren.
## Staging
Testontvangers en verzending volgen de bestaande allowlist. Maak geen echte ledenlijst of geheime credential onderdeel van een preview. Een algemene campagne- of segmentbeschrijving betekent niet dat ieder scherm een volledige campagne-editor heeft.`,['verzendlog','communicatieregels']),
  a('communicatieregels','Automatische communicatie, doelgroepen en deduplicatie','Houd nieuwe-aanbodmeldingen en andere functionele berichten gescheiden.',['communication.manage'],`
## Gebeurtenis en ontvanger
Een gepubliceerde brongebeurtenis bepaalt toegestane ontvangers, templateversie en kanaal. Meerdere rollen, segmentmatches of een combinatie van toewijzing en mention mogen geen dubbel logisch bericht opleveren. Een mention verruimt geen bronrecht.
## Stappenplan
1. Controleer bij Communicatie de relevante inbox-, kanaal- en verzendstatus.
2. Gebruik alleen goedgekeurde templateversies voor de bedoelde functionele route.
3. Controleer doelgroep en bronrechten vóór een campagneconcept of automatische regel wordt toegepast.
4. Bekijk voorkeuren, lokale kalenderdag en nog passend aanbod voor een digest.
5. Volg fouten via de verzendlog en bewezen status; vermijd handmatig extra verzending buiten de gecontroleerde route.
## Daglimiet en reminders
Nieuwe-takenmail is maximaal één digest per persoon per lokale kalenderdag. Nieuwe passende gepubliceerde taken kunnen elk één logisch pushevent opleveren, zonder dagmaximum. Bevestigingen, belangrijke wijzigingen, ziekte en dienstreminders volgen eigen categorieën. Gewijzigde afspraken moeten toekomstige reminders op de juiste bronversie laten aansluiten.
## Grenzen
Het actieve scherm toont kanalen, bronnen en logstatus; dat is geen vrijbrief voor ongecontroleerde massamail of een onbeperkte HTML-editor. Gebruik alleen aanwezige bevoegde automatische regels. Staging behoudt de ingestelde testallowlist. Private intake- of financiële achtergrond hoort niet in algemene previews of pushteksten.`,['berichttemplates','verzendlog','supporttoestemming']),
  a('verzendlog','Verzendstatus en onbekende provideruitkomsten beoordelen','Aangenomen, afgeleverd, mislukt en onbekend zijn verschillende statussen.',['communication.manage'],`
## Wat de status bewijst
Een bericht kan klaarstaan, worden verwerkt, door de provider geaccepteerd, afgeleverd, mislukt of onbekend zijn. Alleen de passende delivery-evidence bewijst de betreffende stap. Een groene testaanvraag is niet automatisch een ontvangen inboxmail.
## Stappenplan
1. Open Communicatie en de relevante template- of verzendhistorie.
2. Controleer kanaal, exacte bron- en templateversie, poging en beschikbare receipt.
3. Bij een bewezen tijdelijke fout laat je de bevoegde begrensde retryroute volgen.
4. Bij onbekend controleert technisch beheer de providerstatus of reconciliatie. Verstuur geen nieuwe losse kopie.
5. Controleer daarna de actuele status en of hetzelfde logische bericht is afgehandeld.
## Regels
Een provider-timeout kan optreden nadat het bericht toch is geaccepteerd. Blind opnieuw sturen kan de dagelijkse digestcap of bevestigingsdeduplicatie breken. Permanente fouten en dode pushendpoints worden anders behandeld dan tijdelijke storingen.
## Privacy
Een algemene log hoort geen geheime sleutel, OTP, volledige uitnodigingstoken of private dossierachtergrond te bevatten. Technisch integratiebeheer heeft niet automatisch onbeperkte clubdossierinzage. Vraag bij een echte ontvangstproef de benoemde testontvanger om ontvangst te bevestigen, zonder de code of volledige link te delen.`,['berichttemplates','integraties-platform','communicatieregels']),
  a('sportlink','Sportlink per vereniging instellen en synchronisatie volgen','Gebruik de eigen koppeling, echte bronvelden en herkenbare importstatus.',['match.import'],`
## Per vereniging
De Sportlink ClientID hoort bij de betreffende vereniging en wordt serverzijdig versleuteld opgeslagen. Hij is geen vaste globale waarde in de browser. Sportlink is de bron voor beschikbare wedstrijdidentificatie, team, aftrap, tegenstander, locatie en status.
## Stappenplan
1. Open Sportlink & wedstrijden en controleer de vereniging.
2. Sla de juiste geautoriseerde ClientID via de beveiligde beheerinvoer op; zet hem niet in een gesprek, export of broncode.
3. Voer de beschikbare verbindings- of importcontrole uit en bekijk het echte resultaat.
4. Controleer laatste succesvolle synchronisatie en foutstatus. Gebruik Nu synchroniseren als een handmatige verversing nodig en toegestaan is.
5. Beoordeel gewijzigde wedstrijden met de gekoppelde taakimpact vóór diensten worden aangepast.
## Schema en herhaling
De startinstelling is tweemaal per lokale kalenderdag, 06.00 en 18.00 in Europe/Amsterdam. De momenten zijn configureerbaar en blijven lokale tijden bij zomer- en wintertijd. Herhaalde verwerking van dezelfde bron hoort geen duplicaten te maken.
## Ontbrekende velden
Veld, kleedkamer en andere data worden alleen getoond als aanwezig. De betekenis van duur is nog niet bevestigd; er wordt geen echte eindtijd uit afgeleid. Een onvolledige of mislukte import annuleert geen verdwenen bronrecords. De laatst bekende gegevens blijven herkenbaar.`,['wedstrijdvoorstellen','wedstrijdzaken','ledenimport']),
  a('ledenimport','Ledenimport en bronconflicten zorgvuldig behandelen','Gebruik stabiele bronidentiteit en controleer voorstellen vóór bevestiging.',organization,`
## Bron en importvoorstel
Beschikbare wedstrijdgegevens zijn geen automatisch bewijs van volledige ledenexport. Een ledenkoppeling of gecontroleerde CSV-route moet expliciet geschikte bronvelden leveren. Onbekende geboorte- of lidmaatschapsdatums blijven onbekend.
## Stappenplan
1. Controleer met de bronverantwoordelijke welke geautoriseerde ledenvelden werkelijk beschikbaar zijn.
2. Gebruik de aanwezige gecontroleerde import- of voorbereidingsroute met mapping en proefcontrole.
3. Match op stabiele bronidentificatie. Laat tegenstrijdige bron-ID, naam of e-mail handmatig beoordelen.
4. Controleer foutregels, voorgestelde wijzigingen en de gevolgen voor bestaande personen.
5. Bevestig pas de gecontroleerde import en lees de personen en provenance terug.
## Grenzen
Een import maakt geen huishoudverplichting, gezinsrelatie, geverifieerd account of systeemgrant op alleen naam- of e-mailgelijkheid. Persoonlijke intake, besluiten en ledger mogen niet door brondata worden overschreven. Herimport van dezelfde bron moet ontdubbelen.
## Huidige bediening
Het actieve verenigingsbeheer heeft expliciete persoons- en relatieformulieren en de wedstrijdkoppeling. Een historische CSV-preview uit het prototype bewijst geen huidige volledige ledenimportwizard. Als die bediening in jouw omgeving ontbreekt, laat een bevoegde verantwoordelijke de gecontroleerde native import voorbereiden; upload geen ongecontroleerde ledenlijst als algemene bijlage.`,['personen-beheer','dossierkoppelingen','sportlink']),
  a('rapporten','Rapportages, filters en CSV-export interpreteren','Lees dezelfde geautoriseerde bronstanden met de juiste periode en telling.',['report.season.view'],`
## Bronnen en reikwijdte
Rapportages biedt huishoudvoortgang, winterstand, jaarstand, teamtaken en bezetting binnen het toegekende bereik. Een tabel is geen nieuw urenbewijs. Bronstatus en peildatum bepalen wat werkelijk gemeten is.
## Stappenplan
1. Kies vereniging en seizoen en open Rapportages.
2. Selecteer het bedoelde rapport en relevante commissie-, team-, categorie-, periode- of statusfilters.
3. Vergelijk bevestigd, gepland, ter controle, gereserveerd en toegewezen afzonderlijk.
4. Bekijk de bronstatus bij onbekende historische gegevens; onbekend mag niet als nul worden geïnterpreteerd.
5. Download de toegestane CSV met dezelfde filters en scope. Behandel de export als een momentopname.
## Telling
Verenigingsrapporten tellen de expliciete huishoudverplichting eenmaal. Een gezin met meerdere kinderen of teams maakt geen extra huishoudtotaal. Teamrapportages tellen concrete plaatsen hoogstens voor één gekozen speler. Gereserveerde teamplaatsen zijn niet tegelijkertijd openbare vrije plaatsen.
## Privacy en grenzen
Een teamouderrapport bevat alleen minimale praktische voortgang, geen private intake, uitzonderingsreden of financiële achterstand. Een technische of algemene bestuursrol geeft geen extra exportrecht. Bij een gepauzeerde rapportagemodule kan het rapportdeel niet beschikbaar zijn; een oude downloadlink omzeilt die controle niet.`,['winterplanning','seizoenssluiting','passend-aanbod-beoordelen']),
  a('seizoen-inrichten','Een seizoen en wintergrens inrichten','Leg lokale datums en effectieve doelen vast vóór nieuwe verplichtingen worden gebruikt.',['organization.manage','season.rollover'],`
## Een afzonderlijke periode
Een seizoen heeft eigen begin, einde, wintergrens, doelen en status. Oude ledgerstanden en besluiten blijven bij hun oorspronkelijke seizoen. Het nieuwe seizoen is geen stille voortzetting van een willekeurige huidige meter.
## Stappenplan
1. Open Seizoenen en controleer welke perioden al bestaan.
2. Leg naam, begin, einde en expliciete wintergrens vast in de verenigingstijdzone.
3. Vul het jaardoel en winterdoel in hele minuten in. Controleer dat nul bewust geldig kan zijn en het winterdoel niet boven het jaardoel ligt.
4. Controleer de bedoelde status en aanvullende afspraken voordat je activeert of overdraagt.
5. Lees de seizoensversie terug en controleer de contextselectie in de werkruimtes.
## Startafspraak
De generieke standaard is 720 jaarminuten en 360 winterminuten. De wintergrens is een exact lokaal moment dat naar de opgeslagen tijd wordt vertaald. Kies geen impliciete datum alleen op basis van een kalenderlabel.
## Grenzen
Een nieuwe periode maakt geen fictieve starturen. Oude afspraken, functie-effecten en effectieve uitzonderingen moeten via de expliciete bevoegde route worden meegenomen of opnieuw beoordeeld. Overuren worden niet automatisch overgedragen of uitbetaald. Een wijziging aan een bestaand seizoen bewaart de relevante historie en vraagt beoordeling van bestaande verplichtingen.`,['seizoenssluiting','seizoensovergang','afspraken-instellingen']),
  a('seizoenssluiting','Een seizoen gecontroleerd afsluiten','Beoordeel open uitvoering, bezwaren, besluiten en financiële verwerking.',['season.close'],`
## Eerst volledigheid
Een seizoen sluiten is een gevoelige handeling. Open uitvoering, geschillen, uitzonderingen, financiële processen en onvolledige brondata kunnen sluiting blokkeren. Een groen overzicht zonder broncontrole is onvoldoende.
## Stappenplan
1. Kies het bronseizoen en open Seizoenen.
2. Controleer open boekingen ter beoordeling, uurvragen, beleids- of uitzonderingsbesluiten en de relevante financiële status.
3. Los fouten en open opvolging via hun eigen bevoegde routes op. Bevestig niet willekeurig nul om de lijst leeg te maken.
4. Controleer doelen, ledgerstand, rollen, besluiten en de beschikbare historische rapportages.
5. Bevestig Sluiten met een concrete reden en wacht op het definitieve resultaat.
6. Lees de gesloten status en bewaarde snapshots terug.
## Historie
Afsluiting bewaart reproduceerbare standen en besluiten. Zij verwijdert geen personen, documenten, betalingen of oude ledger. Onbekende historische metingen worden niet tot verzonnen nulwaarden gemaakt.
## Correctie na afsluiting
Een aantoonbare fout kan een gecontroleerde herzieningsroute nodig hebben. Het terugrollen van de app is geen terugrollen van de database of ledger. Voor een volgend seizoen gebruik je de expliciete overgang met geselecteerde sjablonen en herbevestiging.`,['seizoensovergang','rapporten','financiele-herziening']),
  a('seizoensovergang','Een nieuw seizoen voorbereiden en overdragen','Kopieer alleen gekozen sjablonen en volg echte herbevestigingsacties.',['season.rollover'],`
## Wat wordt overgedragen
Een nieuw seizoen krijgt eigen inrichting en verplichtingen. Alleen bewust geselecteerde sjablonen mogen worden gekopieerd. Rollen, intake en afspraken vragen waar nodig herbevestiging; oude saldi en besluiten blijven behouden.
## Stappenplan
1. Controleer dat het bronseizoen volledig en bevoegd is afgesloten.
2. Kies of bereid het doel­seizoen met geldige begin-, eind- en winterdatum voor.
3. Selecteer expliciet de bedoelde sjabloonsleutels en controleer wat de overgang werkelijk zal aanmaken.
4. Bevestig de overgang met een concrete reden en wacht op opslag.
5. Lees het nieuwe seizoen en de aangemaakte herbevestigingsacties terug.
6. Volg intake, rol- en afspraakherbevestiging via de concrete toegewezen personen en bronroutes.
## Regels
Overuren worden niet automatisch naar het volgende jaar meegenomen of uitbetaald. Een herhaalde overgang met dezelfde opdrachtsleutel mag geen tweede seizoen, verplichting of actie maken. Eerdere financiële verwerking en ledger blijven op het bronseizoen staan.
## Bij ontbrekende voorbereiding
Voer de overgang niet uit met een verzonnen winterdatum of ongecontroleerde sjabloonlijst. Een losse prototype-snapshot is geen afgeronde native rollover. Beoordeel eerst de echte blokkerende bronnen en lees daarna de doelperiode terug.`,['seizoen-inrichten','seizoenssluiting','functie-erkennen']),
  a('bestuursescalatie','Bezwaren, belangenconflict en bestuursbesluiten','Beoordeel escalaties met afzonderlijke actuele bevoegdheden.',['exception.review','exception.finalize'],`
## Wanneer escaleren
Verschil van mening tussen reviewers, belangenconflict, bezwaar of een afwijking buiten beleid vraagt de bestuursroute. Een bestuursnaam op een account maakt niet automatisch iedere private aanvraag toegankelijk. De concrete beoordelingsrechten en scope blijven vereist.
## Stappenplan
1. Open de toegestane actuele aanvraag en lees voorstel, reviews en escalatiereden.
2. Controleer je bevoegdheid en eigen onafhankelijkheid voor dit concrete besluit.
3. Beoordeel praktische feiten en toepasselijk beleid. Vraag geen diagnose of medische bewijsstukken als vervanging voor functionele beoordeling.
4. Leg een gemotiveerd resultaat of verdere escalatie vast op dezelfde actuele besluitversie.
5. Laat de afzonderlijk bevoegde finaliseerder het complete besluit verwerken.
6. Controleer effectieve doelen, periode en eventuele financiële vervolgroute; informeer de persoon via de toegestane opvolging.
## Grenzen
Eén persoon met meerdere rollen levert geen twee onafhankelijke reviews op. Een gewijzigde voorstelversie vraagt hercontrole. Een open bezwaar mag niet verdwijnen door een algemene statuswijziging of andere urenbevestiging.
## Gevolgen
Een besluit bewaart de eerdere historie en voegt de actuele beoordeling toe. No-show, niet-geaccepteerd beleid of een open vraag maken geen automatische sportieve sanctie. Essentiële informatie en ziekmelden blijven bereikbaar.`,['uitzonderingen','uurvragen-beoordelen','financiele-goedkeuring']),
  a('supporttoestemming','Tijdelijke platformondersteuning toestaan en stoppen','Beoordeel benoemde medewerker, doel, bereik en eindtijd.',['organization.access.manage'],`
## Benoemde ondersteuning
Een platformmedewerker werkt met het eigen account en een concrete tijdelijke aanvraag. De vereniging geeft expliciete toestemming voor de getoonde werkzaamheden. Een aanvraag alleen geeft nog geen clubrecht en support kan maximaal 24 uur gelden.
## Stappenplan
1. Open Ondersteuning en audit → Supporttoestemming.
2. Bekijk de benoemde medewerker, het doel, de gevraagde minimale rechten, scope en eindtijd.
3. Keur de actuele aanvraag bewust goed of wijs af met reden.
4. Controleer de nieuwe status. De medewerker kan alleen de toegestane tijdelijke beheercontext openen.
5. Stop support zodra het werk klaar is of de aanvraag niet meer klopt. Leg de reden vast en controleer intrekking.
## Grenzen
Support krijgt geen onbeperkte toegang tot private huishoudens, intakes of financiële achtergrond. De medewerker wordt geen lid of persoon in de club alleen door support. De feitelijke actor blijft in de audit zichtbaar; er is geen gedeeld beheeraccount of verborgen impersonatie.
## Directe intrekking
Nieuwe mutaties controleren het mandaat direct. Een open supportwerkruimte wordt na autorisatiehercontrole gesloten. Een oude link of bekende bron-ID mag intrekking niet omzeilen.
## Audit
Bekijk alleen de auditregels die jouw scope toestaat. De audit bewaart actor, handeling, bereik en tijd, geen OTP of geheime providercredential.`,['toegang-beheer','support-platform','beheer-start']),
]};
export default book;
