import {article as a} from '../model.mjs';
const global = entry => ({...entry,global:true});
const book = {id:'platform',title:'Platformbeheer',environment:'platform',description:'Verenigingen, benoemde medewerkers, standaarden, integraties, tijdelijke support en audit.',articles:[
  a('platform-start','Inloggen als platformbeheerder en je mandaat controleren','Platformrechten zijn afzonderlijk van lidmaatschap of clubbeheer.',['platform.overview','platform.tenant.read','platform.tenant.manage','platform.access.manage','platform.config.manage','platform.integration.manage','platform.support','platform.audit.read'],`
## Persoonlijk platformmandaat
Een platformmedewerker logt in met het eigen geverifieerde persoonlijke account. Alleen een actuele expliciete platformgrant opent Platformbeheer. Een clubbestuurder, vaste vrijwilliger of geaccepteerde V1-release krijgt daardoor geen platformrechten.
## Stappenplan
1. Gebruik de normale persoonlijke OTP-login.
2. Open Platformbeheer via Mijn werkruimtes of de beschikbare beheerlink in Meer.
3. Controleer welke onderdelen jouw actuele mandaat aanbiedt: overzicht, verenigingen, medewerkers, standaarden, integraties, ondersteuning of audit.
4. Kies waar nodig de expliciet toegestane vereniging. Een tenantgebonden grant is geen globaal recht.
5. Voer alleen de aangeboden handelingen uit en lees gevoelige wijzigingen terug.
## Als de werkruimte ontbreekt
Laat de bevoegde platformtoegangsbeheerder je benoemde grant, bereik en eindtijd controleren. Maak geen eigen clubrol om het platformmenu te openen. De eerste platformbenoeming heeft een aparte gecontroleerde installatieprocedure; deze kennisbank creëert geen account of grant.
## Privacy
Platformbeheer biedt operationele inrichting en beperkte bronstatus. Het is geen automatisch recht op privé-intakes, huishoudens of financiële achtergrond. Tijdelijke clubwerkzaamheden vragen afzonderlijke benoemde support en clubtoestemming.`,['platformrechten','tenant-inrichten','support-platform']),
  a('platformoverzicht','Het platformoverzicht en operationele signalen lezen','Lees bereik en bronstatus zonder ontbrekende metingen als nul te presenteren.',['platform.overview'],`
## Operationeel overzicht
Het overzicht toont de actuele toegestane operationele bronnen. Een platformgrant kan globaal of tenantgebonden zijn; het zichtbare totaal volgt dat bereik. Een samenvatting vervangt geen clubbesluit of volledige private administratie.
## Stappenplan
1. Open Platformoverzicht en controleer je actuele mandaat.
2. Lees verenigingsstatus, bron- of verzendsignalen en eventuele peildatum.
3. Open een concrete vervolgpagina uitsluitend wanneer je daarvoor het afzonderlijke recht hebt.
4. Vraag bij onbekende of foutieve bronstatus de bevoegde integratieverantwoordelijke om controle.
5. Behandel onbekende historische metingen als onbekend, niet als een gemeten nul.
## Grenzen
Een operationele fout rechtvaardigt geen onbeperkte clubdossierinzage. Platformoverzicht verleent geen personeelsbeheer, configuratie of supportrecht. Een oude link moet dezelfde actuele autorisatie volgen als de navigatie.
## Verificatie
Een live processtatus bewijst alleen dat een proces draait. Readiness en daadwerkelijke route- of providerproeven moeten hun eigen bron hebben. Een geaccepteerde e-mailaanvraag bewijst geen inboxaflevering. Controleer concrete tijd, omgeving en bronstatus wanneer je een storing beoordeelt.`,['integraties-platform','platformaudit','platform-start']),
  a('tenant-inrichten','Een vereniging voorbereiden en de eerste beheerder benoemen','Maak een tenant en benoemde eindige toegang zonder automatisch ledenrechten toe te kennen.',['platform.tenant.manage'],`
## Voorbereiding
Een nieuwe vereniging begint als voorbereid. Naam, slug en contactroute bepalen de context; rechten en seizoensinrichting zijn afzonderlijke stappen. Een platformmedewerker wordt niet automatisch clublid.
## Stappenplan
1. Open Verenigingen met het daarvoor benodigde leesrecht en kies Vereniging aanmaken.
2. Vul de unieke korte naam in links, verenigingsnaam en praktische contactinformatie in. Leg de reden vast.
3. Open de nieuwe vereniging en controleer de voorbereide status.
4. Selecteer een bestaand geverifieerd persoonlijk account voor de eerste beheerder. Controleer de gevonden identiteit.
5. Kies de minimale expliciete clubrechten, mandaat-eindtijd en eventueel uitnodigingsverval. Organisatie- en toegangsbeheer zijn de noodzakelijke basis van de eerste inrichting.
6. Zet een benoemde uitnodiging klaar en laat de ontvanger die huidige rechten en eindtijd actief accepteren.
7. Lees de aangemaakte membership en grants terug; controleer daarna het seizoen en activeringsvoorwaarden.
## Grenzen
Initiële directe onboarding is alleen geldig zolang de nieuwe club nog geen bestaande beheergrants of verplichtingen heeft. Het is geen algemene route om later willekeurig beheer toe te voegen. Een open uitnodiging geeft nog geen membership of rechten. De platformmedewerker krijgt niet stilzwijgend een clubpersoon.`,['tenant-uitnodigingen','tenant-status','tenant-seizoen']),
  a('tenant-uitnodigingen','Benoemde beheeruitnodigingen volgen en annuleren','De geverifieerde ontvanger accepteert de exacte actuele aanbieding.',['platform.tenant.manage'],`
## Uitnodiging en rechten
Een eerste beheeruitnodiging bewaart ontvanger, aangeboden rechten, eindtijd en acceptatietermijn. Ze bestaat in Cluvo en vereist actieve acceptatie door het bedoelde matching geverifieerde account. Een weergegeven aanbod is nog geen grant.
## Stappenplan
1. Open de toegestane vereniging en het beheerdersdeel.
2. Controleer bestaande beheerders en open uitnodigingen voordat je opnieuw aanbiedt.
3. Selecteer het juiste geverifieerde account en bevestig alleen de werkelijk bedoelde rechten en eindtijd.
4. Laat de ontvanger bij Mijn werkruimtes de huidige aanbieding lezen en accepteren.
5. Controleer de geaccepteerde status en expliciete clubtoegang op een nieuwe sessie.
6. Annuleer een onjuiste open aanbieding met reden. Een verlopen of ingetrokken aanbod mag niet later alsnog rechten geven.
## Privacy en identiteit
Een emailzoekveld kiest een geverifieerd account; het creëert geen willekeurige nieuwe Auth-identiteit. De acceptatie mag geen private intake of andere clubmembership kopiëren. Een oorspronkelijke uitnodigingstoken of OTP hoort nooit in log, kennisbank of export.
## Herstel
Een gewijzigde aanbieding vraagt de juiste actuele acceptatieversie. Bij onbekende uitkomst controleer je dezelfde opdracht en grantresultaat. Nieuwe losse uitnodigingen als retry kunnen dubbel werk of verwarring maken.`,['tenant-inrichten','platformrechten']),
  a('tenant-status','Een vereniging activeren, pauzeren of archiveren','Controleer eerst de actuele impact en behoud gegevens en historie.',['platform.tenant.manage'],`
## Status en impact
Voorbereid, actief, gepauzeerd en gearchiveerd hebben verschillende operationele gevolgen. Een statuswijziging is geen databasereset. De actuele impact moet worden beoordeeld en bevestigd voordat het besluit wordt uitgevoerd.
## Stappenplan
1. Open de toegestane vereniging en bekijk huidige status, versie en inrichting.
2. Bekijk de actuele impactvoorvertoning voor de gewenste status.
3. Controleer benoemde beheerders, seizoen, open werkzaamheden, modules en benodigde vervolgcommunicatie.
4. Bevestig alleen de huidige impactversie met een concrete reden.
5. Lees de nieuwe tenantstatus en operationele gevolgen terug.
## Pauzeren
Nieuwe werkzaamheden kunnen worden beperkt terwijl bestaande afspraken en historie beschikbaar blijven volgens hun eigen rechten. Een individuele modulepauze heeft een aparte configuratieroute. Een statusbesluit geeft geen nieuwe private clubinzage.
## Archiveren en herstel
Archivering bewaart ledger, financiële verwerking, beleidsacceptaties en audit. Verwijder of reset de database niet om de status te veranderen. Als de impact ondertussen is gewijzigd, vraag je de actuele preview opnieuw op; een oude bevestiging mag geen nieuw risico stilzwijgend goedkeuren.`,['tenant-modules','tenant-inrichten','platformaudit']),
  a('tenant-seizoen','Het eerste clubseizoen via platformonboarding voorbereiden','Gebruik expliciete datums en doelen voor een nieuwe vereniging.',['platform.tenant.manage'],`
## Afzonderlijke seizoensinrichting
Het voorbereiden van een tenant maakt nog geen complete seizoensafspraak. Het eerste seizoen vereist begin, einde, wintergrens en doelen. Latere seizoenssluiting en rollover behoren tot expliciet bevoegde clubroutes.
## Stappenplan
1. Open de nieuwe toegestane vereniging en de eerste-inrichtingsroute.
2. Controleer de huidige beheerbenoeming en voorwaarden voor onboarding.
3. Vul seizoensnaam, begin- en einddatum en het exacte lokale wintermoment in.
4. Stel het jaardoel en winterdoel in hele minuten vast; standaard zijn dat 720 en 360.
5. Leg de reden vast en lees het aangemaakte seizoen terug.
6. Laat de clubbeheerder de eigen inrichting en verplichtingsmapping controleren vóór activering.
## Regels
Een doel van nul kan bewust geldig zijn. Het winterdoel kan niet boven het jaardoel liggen. De wintergrens moet een concrete datum en tijd hebben en mag niet worden afgeleid uit een willekeurige labelnaam.
## Grenzen
Platformonboarding creëert geen fictieve beginuren of automatische privéhuishoudens. Oude clubhistorie wordt niet overschreven door globale standaarden. Gebruik deze initiële route niet als vervanging voor latere clubseizoensovergang of een inhoudelijk huishoudbesluit.`,['tenant-inrichten','tenant-status']),
  a('tenant-modules','Modules per vereniging beheren','Pauzeer nieuwe functionaliteit met behoud van bestaande bronnen.',['platform.tenant.manage'],`
## Modulekeuze
Planning, teams, opleidingen, beleid, communicatie, Sportlink en rapportage kunnen per vereniging afzonderlijk worden ingeschakeld of gepauzeerd. Een moduleflag is een operationele keuze en verleent geen persoonlijke rechten.
## Stappenplan
1. Open de toegestane vereniging en de module-instellingen.
2. Controleer huidige waarde, betrokken werkzaamheden en tenantstatus.
3. Kies de bedoelde module en leg een duidelijke reden voor inschakelen of pauzeren vast.
4. Sla op en lees de nieuwe waarde terug.
5. Controleer de betreffende club- en appwerkruimte binnen de echte bevoegdheden.
## Gevolgen
Een gepauzeerde module kan nieuwe handelingen blokkeren terwijl bestaande afspraken en historie beschikbaar blijven. De precieze bronroute controleert dat opnieuw; een oud menu of geopende formulierpagina omzeilt de flag niet.
## Grenzen
Een module aanzetten benoemt niemand tot beheerder, activeert niet automatisch alle providerjobs en publiceert geen concepttaken. Een Sportlink-module vereist nog een werkelijke geautoriseerde tenantkoppeling. Een rapportageflag verandert geen ledger en mag onbekende historische data niet als nul presenteren.
## Herstel
Bij een onbedoelde wijziging leg je een volgende gecontroleerde waarde met reden vast. Verwijder de tenant of bronhistorie niet als herstelmaatregel.`,['tenant-status','integraties-platform','platformaudit']),
  global(a('platformrechten','Platformmedewerkers en eindige rechten beheren','Geef elk afzonderlijk platformrecht een benoemde actor, bereik en eindtijd.',['platform.access.manage'],`
## Acht afzonderlijke rechten
Platformoverzicht, tenant lezen, tenant beheren, toegang beheren, configuratie beheren, integraties beheren, ondersteuning en audit lezen zijn afzonderlijke rechten. Een globaal recht en een grant voor één tenant hebben verschillend bereik. Het medewerkersscherm vraagt een globaal toegangsbeheermandaat.
## Stappenplan
1. Open Medewerkers en toegang en lees bestaande grants en hun eindtijd.
2. Zoek het bedoelde bestaande geverifieerde persoonlijke account en controleer de identiteit.
3. Kies het concrete recht en zo nodig de tenantbeperking.
4. Stel een eindtijd in en leg de reden vast. Ken alleen de werkzaamheden toe die werkelijk nodig zijn.
5. Controleer de nieuwe grant in de actuele lijst.
6. Trek het mandaat bij einde of fout expliciet in en controleer de nieuwe sessie- en mutatiegrenzen.
## Grenzen
Een platformgrant geeft niet automatisch clublidmaatschap, een clubpersoon of private dossierinzage. Globale toegang of configuratie mag niet door een tenantgebonden variant van hetzelfde recht worden gebruikt.
## Eerste benoeming
De gecontroleerde eerste platformbootstrap kan uitsluitend de benoemde bestaande geverifieerde identiteit met eindige rechten toelaten onder de vereiste begincondities. Dit is geen knop om jezelf onbeperkt beheer te geven. Bewaar credentials en OTP uitsluitend via de bestaande beveiligde beheerroutes.`,['platform-start','support-platform','platformaudit'])),
  global(a('platformstandaarden','Globale standaardinstellingen wijzigen','Nieuwe inrichting gebruikt standaarden; bestaande clubafspraken behouden hun eigen versie.',['platform.config.manage'],`
## Het bereik
Standaardinstellingen beschrijven nieuwe organisatie-, planning-, communicatie- en template-inrichting. Het scherm vraagt een globaal configuratiemandaat. Een tenantgebonden grant opent geen onbeperkte globale wijziging.
## Stappenplan
1. Open Standaardinstellingen en kies organisatie, planning, communicatie of template.
2. Lees de huidige standaardversie en controleer veldbetekenis en eenheden.
3. Wijzig bijvoorbeeld tijdzone, taal, afmeldminuten, bevestigingsdagen, bezwaardagen of reminderwaarden binnen hun geldige grenzen.
4. Leg een concrete reden vast en sla op.
5. Lees de nieuwe versie terug en controleer welke toekomstige inrichting haar gebruikt.
## Regels
Een globale wijziging herschrijft geen bestaande clubafspraak, templatepublicatie, bookinguurwaarde of cancellation-snapshot. Een vereniging past een afwijking via het eigen bevoegde besluit toe. Minuten, dagen, uren en eurocenten blijven afzonderlijke eenheden.
## Controle
Test een nieuwe voorbereiding en bekijk een bestaande vereniging om de verschillende versies te begrijpen. Gebruik geen globale default als omweg voor een individueel uitzonderingsbesluit. Secrets, providercredentials en OTP horen niet in een templatewaarde of JSON-configuratie.`,['tenant-inrichten','integraties-platform','platformaudit'])),
  a('integraties-platform','Integraties, echte testverzending en retry beoordelen','Gebruik operationele status en retry alleen een bewezen mislukte poging.',['platform.integration.manage'],`
## Operationele gegevens
Integraties en verzending toont de toegestane provider- en verzendbronnen. Het scherm is geen credentialconsole. Alleen serverbeheerroutes gebruiken geheime sleutels; browser, export, log en kennisbank mogen die waarden niet bevatten.
## Stappenplan
1. Open Integraties en verzending en kies de relevante toegestane bron.
2. Controleer kanaal, bronversie, huidige poging, status en beschikbare receipt.
3. Laat een onbekende uitkomst eerst reconciliëren. Aangenomen of mogelijk aangenomen verzoeken worden niet blind herhaald.
4. Gebruik Retry alleen bij bewezen mislukking en de aangeboden expliciete bevestiging met reden.
5. Lees het nieuwe resultaat terug en controleer dat dezelfde logische gebeurtenis niet dubbel is afgehandeld.
## E-mail en push
Provideracceptatie is geen inboxdelivery. Dagelijkse taakdigest, andere functionele mails en push hebben hun eigen dedupe- en voorkeursregels. Dode endpoints en permanente errors moeten anders worden behandeld dan tijdelijke storingen.
## Omgevingen
Staging houdt de bestaande testallowlist en eigen credentials. Een succesvolle stagingproef maakt geen productieprovider of productiecron aan. Ontbrekende Sportlinkvelden blijven onbekend; operationeel beheer mag ze niet als bewezen brondata invullen.`,['support-platform','platformaudit','platform-start']),
  a('support-platform','Benoemde tijdelijke clubondersteuning aanvragen','Werk onder je eigen account met clubtoestemming en maximaal 24 uur.',['platform.support'],`
## De aanvraag
Support is tijdelijk, doelgericht en expliciet. De club moet de huidige aanvraag goedkeuren voordat clubwerkzaamheden openen. Je wordt hierdoor geen clublid en handelt nooit onder het account van een clubbeheerder.
## Stappenplan
1. Open Ondersteuning en kies een toegestane vereniging.
2. Beschrijf doel en werkzaamheden concreet. Selecteer uitsluitend de toegestane minimale supportrechten.
3. Kies tenant- of commissiescope en een eindtijd van maximaal 24 uur.
4. Vraag toestemming met reden en controleer de opgeslagen aanvraagstatus.
5. De bevoegde clubbeheerder beoordeelt de actuele medewerker, rechten, scope en eindtijd.
6. Na goedkeuring open je alleen de toegestane tijdelijke clubbeheercontext. Controleer je eigen actor en voer het afgesproken werk uit.
7. Stop de support na afronding of laat de club die intrekken. Controleer dat de tijdelijke context sluit.
## Grenzen
Support geeft geen private huishoud-, intake- of financiële achtergrondrechten. Een niet-goedgekeurde of verlopen aanvraag opent geen clubroute. Een bekende directe link of opengelaten pagina kan de nieuwe autorisatie niet passeren.
## Audit
De werkelijke platformactor, clubscope, opdracht en reden blijven geregistreerd. Zoekresultaten, documenten en mutaties volgen hetzelfde tijdelijke bereik.`,['platform-start','integraties-platform','platformaudit']),
  a('platformaudit','Platformaudit en bewijs controleren','Lees herleidbare gebeurtenissen binnen je actuele bereik.',['platform.audit.read'],`
## Wat audit vastlegt
Gevoelige gebeurtenissen bewaren de feitelijke actor, handeling, scope, bronversie, opdrachtsleutel en auditgegevens. Een auditregel is een bewijs van die concrete gebeurtenis en geen onbeperkte toegang tot de private inhoud van alle bronnen.
## Stappenplan
1. Open Platformaudit met je huidige globale of tenantgebonden mandaat.
2. Kies de relevante periode of bronfilters die de pagina aanbiedt.
3. Controleer actor, handeling, scope, tijd en de concrete bronrelatie.
4. Vergelijk het event met de actuele status en oorspronkelijke versie wanneer je een support- of toegangsbesluit onderzoekt.
5. Bewaar alleen geautoriseerd bewijs met dezelfde scope en bescherm eventuele export.
## Controle van veranderingen
Een nieuwe tenantstatus, grant, supporttoestemming of defaultversie moet herleidbaar zijn. Een herhaalde opdracht met dezelfde sleutel hoort hetzelfde resultaat te geven in plaats van een tweede ongecontroleerde wijziging. Een approllback draait opgeslagen databasebesluiten niet terug.
## Privacy
Audit bevat geen OTP, geheime sleutel, volledige uitnodigingstoken of onbeperkte medische achtergrond. Operationele metadata wordt niet als vrijbrief voor private dossierinzage gebruikt. Bij een ontbrekend bewijs geef je aan wat werkelijk bekend en onbekend is; vul historische metingen niet achteraf als nul in.`,['platformrechten','tenant-status','support-platform']),
]};
export default book;
