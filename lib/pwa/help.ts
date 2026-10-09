import type {HelpTopic} from '@/components/app/help-content';

const entries: [string,string,string][] = [
  ['home','Jouw startpunt','Hier zie je de bevestigde stand van jouw huishouden en wat jouw aandacht vraagt. Geplande inzet telt pas mee nadat die is bevestigd.'],
  ['tasks','Kies een concrete plaats','Open een taak, lees de instructies en kies een bevoegde uitvoerder. De vereniging bevestigt de boeking; beschikbaarheid kan intussen veranderen.'],
  ['agenda','De afspraken van je gezin','Hier komen geboekte taken, gereserveerde teamplaatsen, wedstrijden en evenementen samen. Een gereserveerde plaats is nog geen boeking.'],
  ['teams','Samen bijdragen aan je team','Teamdoelen tellen uitvoeringen per lid. Cluburen tellen minuten voor het huishouden. Eén uitvoerder en één gekozen lid horen bij iedere bevestigde uitvoering.'],
  ['more','Jouw vereniging en functies','Bovenaan kies je een vereniging waarvoor je persoonlijke account toegang heeft. De functies hieronder volgen jouw actuele bevoegdheden.'],
  ['actions','Wat vraagt aandacht','Open een actie om de bijbehorende taak of afspraak te bekijken. Alleen een bevestigde handeling werkt de gezamenlijke stand bij.'],
  ['notifications','Meldingen in Cluvo','Meldingen staan bij je persoonlijke account. Je kunt ze lezen zonder push aan te zetten en bepaalt zelf of je apparaatmeldingen wilt ontvangen.'],
  ['manage','Werk van je commissie','Je ziet alleen de taken en mensen binnen je actuele commissiebevoegdheid. Een aanwezigheidsbesluit legt minuten vast in de bevestigde urenhistorie.'],
  ['profile','Vertel wat bij jou past','Vul je ervaring, talenten, voorkeuren en beschikbaarheid in. Je antwoorden worden bij je persoonlijke profiel opgeslagen en blijven op andere apparaten beschikbaar.'],
  ['household','Jouw huishouddossier','Dossierinzage, voortgang bekijken en namens een ander boeken zijn verschillende rechten. Een extra uitvoerder verandert het doel van je huishouden niet.'],
  ['policies','Lees de aangeboden versie','Je bevestigt de exacte aangeboden tekst voor de persoon namens wie je bevoegd bent. Een nieuwe beleidsversie vraagt een nieuwe bevestiging.'],
  ['courses','Opleidingen en bevoegdheden','Een cursusinschrijving is nog geen behaalde bevoegdheid. De actuele geldigheid en de voorwaarden van de taak bepalen of je deze mag uitvoeren.'],
  ['opportunities','Vaste vrijwilligersfuncties','Met interesse maak je kenbaar dat een functie bij je past. Pas een formeel erkende aanstelling kan invloed hebben op je seizoensverplichting.'],
  ['messages','Samen afstemmen','Gesprekken horen bij jouw team of commissie. Alleen personen met actuele toegang kunnen de berichten zien en beantwoorden.'],
  ['settings','Jouw meldingskeuzes','Je voorkeuren worden bij je account bewaard. Push staat pas aan nadat jij toestemming geeft op dit apparaat en de vereniging de koppeling bevestigt.'],
  ['help','Uitleg bij Cluvo','Hier kun je uitleg teruglezen. Met opnieuw tonen zet je alleen jouw eigen bevestigde uitlegkeuzes terug; anderen behouden hun instellingen.'],
  ['install','Cluvo op je beginscherm','Installeren is vrijwillig. Je kunt Cluvo ook in de browser gebruiken. Zonder verbinding kun je geen boekingen of andere wijzigingen bevestigen.'],
  ['reports','Bevestigde inzet bekijken','Overzichten gebruiken de bevestigde urenhistorie. Correcties voegen een nieuwe post toe, zodat de oorspronkelijke boeking en besluiten zichtbaar blijven.'],
  ['finance','Vrijwilligerspot','Bedragen worden in eurocenten vastgelegd. Een reservering, uitgave en ontvangst zijn afzonderlijke posten in de financiële historie.'],
  ['committees','Samen organiseren','Werkkaarten, instructies en documenten horen bij hun bevoegde team of commissie. Een afgeronde werkkaart levert op zichzelf geen cluburen op.'],
  ['booking','Controleer je boeking','Controleer de uitvoerder, concrete plaats, instructies, minuten en annuleringsafspraken. Sluit een onzekere boeking pas nadat de oorspronkelijke status is gecontroleerd.'],
  ['team-allocation','Reserve is geen boeking','Een cluster houdt concrete plaatsen voor het team apart. De boeking ontstaat pas wanneer een bevoegde uitvoerder de toegewezen of gekozen plaats bevestigt.'],
  ['handover','Een zorgvuldige overdracht','De aangewezen opvolger leest en accepteert de klaargezette versie. Pas die bevestiging draagt de teamrechten over en beëindigt de oude rechten.'],
  ['instructions','De juiste instructies','Lees de aangeboden instructieversie voordat je bevestigt. De boeking bewaart deze versie; gewijzigde instructies veranderen je bestaande historie niet.'],
  ['feedback','Korte terugblik','Je terugblik helpt de commissie haar instructies te verbeteren. Jouw voorkeur om de taak opnieuw te doen blijft persoonlijk.'],
];
export const PWA_HELP_TOPICS: Record<string,HelpTopic> = Object.fromEntries(entries.map(([name,title,text])=>{
  const id=`pwa.${name}.v1`;return [id,{id,title,text}];
}));
