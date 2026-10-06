# 01 — Alle pagina’s en functies

Versie 1.0 • 6 oktober 2026

## Leeswijzer

Deze catalogus beschrijft 219 functionele onderdelen van de 23 actieve pagina’s en gedeelde werkruimte. Ieder onderdeel heeft een stabiel ID, gebruikershandeling/resultaat en koppelingen naar andere pagina’s. Het beschrijft de beoogde werkende staginguitvoering; bij iedere pagina staan de beperkingen van de huidige demo. Extra canonvereisten staan herkenbaar als nog aan te sluiten bediening. De AST-broninventaris bevat daarnaast de exacte callbacks, modalvelden en technische helperfuncties.

Menu-/hashnamen uit het prototype blijven bronverwijzingen. Stagingroutes zijn tenantgebonden, bijvoorbeeld `/c/[club]/taken`; de actuele repo-route `/c/[club]/diensten` is nu een taakmarkt. Stel een expliciete compatibele route-/redirectmapping vast, zodat Mijn taken en Takenmarkt niet dezelfde onduidelijke route krijgen.

## Pagina-index

| ID | Pagina | Prototype-route | Functies |
|---|---|---|---|
| P00 | Algemene werkruimte en toegang | shell | 16 |
| P01 | Overzicht | overzicht | 7 |
| P02 | Takenmarkt | taken | 10 |
| P03 | Mijn taken | diensten | 11 |
| P04 | Gezinsagenda | gezin | 8 |
| P05 | Ruilmarkt | ruilmarkt | 5 |
| P06 | Jaaragenda | agenda | 6 |
| P07 | Wedstrijden | wedstrijden | 5 |
| P08 | Planbord | planbord | 11 |
| P09 | Huishoudens | huishoudens | 13 |
| P10 | Commissies | commissies | 8 |
| P11 | Kanbanborden | kanban | 11 |
| P12 | Teams | teams | 22 |
| P13 | Mijn acties | acties | 7 |
| P14 | Berichten | berichten | 7 |
| P15 | Beleid & afspraken | beleid | 8 |
| P16 | Waardering | waardering | 8 |
| P17 | Opleidingen | opleidingen | 5 |
| P18 | Vrijwilligersfuncties | vacatures | 5 |
| P19 | Rapportages | rapportages | 6 |
| P20 | Vrijwilligerspot | financien | 9 |
| P21 | Communicatie | templates | 11 |
| P22 | Instellingen | instellingen | 14 |
| P23 | Mijn profiel en intake | intake | 6 |

## P00 — Algemene werkruimte en toegang

**Prototype-route:** `shell`. **Bron:** app.tsx, store.tsx, help-banner.tsx, help-preferences.ts, ui.tsx.

**Wie gebruikt dit:** Alle geauthenticeerde gebruikers; zichtbare werkruimtes volgen de echte mandaten.

### P00.F01 — Vereniging en seizoen

De zijbalk toont vereniging, seizoen, logo en werkruimte. Een account met meerdere verenigingen kiest alleen een vereniging waartoe het toegang heeft. Iedere pagina behoudt de tenantcontext.

**Relatie:** P01 Overzicht; P22 Instellingen.

### P00.F02 — Menu en rolwerkruimte

Het menu groepeert Mijn club, Samen organiseren en Vereniging. In de demo kiezen gebruikers vrij een rol en voorbeeldpersoon; staging vervangt dit door werkelijk verleende, tijdgebonden rechten.

**Relatie:** P09 Huishoudens; P10 Commissies; P12 Teams; P20 Vrijwilligerspot; P22 Instellingen.

### P00.F03 — Zoeken en snel openen

Zoek met de knop of Ctrl/Cmd+K naar toegestane pagina's en taaknamen. Open een resultaat met behoud van het betreffende team, de taak en het tabblad; toegang wordt opnieuw gecontroleerd.

**Relatie:** P02 Takenmarkt; P08 Planbord; P12 Teams; P14 Berichten.

### P00.F04 — Ongelezen meldingen

De bel, menudot en teller lezen dezelfde persoonlijke inbox. Openen of gelezen markeren wijzigt alleen de leesstatus van de ingelogde ontvanger.

**Relatie:** P14 Berichten; P13 Mijn acties.

### P00.F05 — Mijn profiel

De profielknop opent intake. Een gebruiker kan uitsluitend zijn eigen profiel en expliciet gemachtigde vertegenwoordiging openen.

**Relatie:** P23 Mijn profiel en intake; P09 Huishoudens.

### P00.F06 — Uitlegbanners tonen

Boven paginafuncties, tabbladen en dialoogvensters verschijnt de actuele zachte gele uitleg met informatie-icoon, afgeronde hoeken en subtiele rand. De bestaande teksten en plaatsing zijn de referentie.

**Relatie:** P01 Overzicht; P22 Instellingen. Proces R22.

### P00.F07 — Uitlegbanner afsluiten

Het kruisje en Gezien rechtsonder doen dezelfde handeling. Bewaar gezien per account en stabiel onderwerp; dezelfde persoon ziet de banner ook na herladen, rolwisselen en op een ander apparaat niet opnieuw.

**Relatie:** P23 Mijn profiel en intake; P22 Instellingen. Proces R22.

### P00.F08 — Zichtbaarheid zonder flits

Laad gebruikersvoorkeuren voordat een reeds gesloten banner zichtbaar wordt. Twee tabbladen mogen elkaars recent opgeslagen onderwerpen niet overschrijven; mislukte opslag krijgt een herstelbare fout.

**Relatie:** P14 Berichten; P22 Instellingen. Proces R22.

### P00.F09 — Responsief menu

Op telefoon kan het menu als paneel worden geopend. Tabellen mogen horizontaal scrollen en alle acties blijven bereikbaar met toetsenbord en aanraking.

**Relatie:** P08 Planbord; P12 Teams.

### P00.F10 — Mobiele demopreview

De demo opent een telefoonvenster met iframe. Dit is een referentiehulpmiddel; echte staging moet rechtstreeks op een telefoon werken, inclusief formulieren en veilige sessie.

**Relatie:** P22 Instellingen.

### P00.F11 — Hulp en prototype-informatie

Het hulpvenster beschrijft het demonstratiemodel en gesimuleerde koppelingen. In staging vervang de demotekst door werkende, contextgerichte hulp en actuele verbindingsstatussen.

**Relatie:** P14 Berichten; P22 Instellingen.

### P00.F12 — Formulieren en feedback

Modalen, bevestigingen, validatiemeldingen, badges, lege toestanden en toasts volgen de bestaande componenten. Serverfouten behouden ingevulde gegevens en bieden een concrete herstelactie.

**Relatie:** P02 Takenmarkt; P08 Planbord; P12 Teams; P20 Vrijwilligerspot.

### P00.F13 — Herstelbare navigatie

De demo bewaart de route in clientstate. Staging geeft iedere pagina en context een herlaadbare URL, bruikbare browserhistorie en veilige deeplinks vanuit acties, inbox en e-mail.

**Relatie:** P13 Mijn acties; P14 Berichten; P12 Teams.

### P00.F14 — Uitloggen en sessie

Bestaande repo-Auth verzorgt verificatie en sessies. Voeg zichtbaar uitloggen en herstel na verlopen sessie toe in dezelfde vormgeving; verifieer een mutatie opnieuw na login.

**Relatie:** P22 Instellingen; P23 Mijn profiel en intake.

### P00.F15 — Demodata en echte gegevens

De prototypegegevens blijven als visuele testfixture beschikbaar. Productgegevens, autorisatie, minuten, besluiten en betalingen komen in staging uit de server; demoherstel kan die nooit wissen.

**Relatie:** P09 Huishoudens; P20 Vrijwilligerspot; P22 Instellingen.

### P00.F16 — Installatie en offline

Behoud manifest, iconen en installatiegedrag. Toon bij offlineverbinding wat niet actueel is; voer kritische boekingen en betalingen niet ongemerkt offline uit.

**Relatie:** P02 Takenmarkt; P20 Vrijwilligerspot; P22 Instellingen.

**Demo → staging:** De prototype-shell heeft geen echte login- of rolbeveiliging. Club Signal en de bestaande componenten blijven leidend. Er zijn 22 menupagina’s plus de extra intakepagina; P00 is een gedeelde laag en telt niet als extra pagina.

**Pagina-acceptatie:** A08, A09, A11, A25, T10, H01, H02, H03, H04, H05, H06, O01, O02, O03, O04, O07, V00. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P01 — Overzicht

**Prototype-route:** `overzicht`. **Bron:** dashboard.tsx, coordination-workspace.tsx, team-workspace.tsx.

**Wie gebruikt dit:** Persoonlijk voor lid/huishouden; beheeroverzicht binnen toegewezen scope.

### P01.F01 — Persoonlijke voortgang

Toon bevestigde, geplande en in beoordeling zijnde verenigingsminuten, het geldende jaardoel, winterdoel en resterende inzet. Een vrijstelling toont dekking zonder fictieve uren.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P09 Huishoudens; P19 Rapportages; P20 Vrijwilligerspot.

### P01.F02 — Verenigingstotalen

Voor bevoegde beheerders: open plaatsen, bezetting, dossiers en aandachtspunten uit dezelfde databaseprojecties. Tel een huishouden of verplichting eenmaal, ook bij meerdere teams.

**Relatie:** P08 Planbord; P09 Huishoudens; P12 Teams; P19 Rapportages.

### P01.F03 — Dit vraagt je aandacht

Toon maximaal vier concrete volgende acties en een link naar alle acties. Een actie opent het juiste uitvoerdervenster, bevestiging, teamtabblad, feedback of overdracht.

**Relatie:** P13 Mijn acties; P12 Teams; P03 Mijn taken; P16 Waardering.

### P01.F04 — Passende taken ontdekken

Aanbevolen verenigingstaken verwijzen naar de takenmarkt; geschiktheid wordt bij openen en boeken opnieuw getoetst. Volle of gereserveerde plaatsen zijn geen passend aanbod.

**Relatie:** P02 Takenmarkt; P23 Mijn profiel en intake; P17 Opleidingen.

### P01.F05 — Komende activiteiten en wedstrijden

Toon kalenderitems en wedstrijden met actuele datum, tijd en bronstatus. Openen behoudt context en mag geen besloten informatie onthullen.

**Relatie:** P06 Jaaragenda; P07 Wedstrijden; P04 Gezinsagenda.

### P01.F06 — Mijn teams

Toon toegestane teams en hun seizoensdoel per lid. De link opent de actuele teamwerkruimte; doelen van twee kinderen blijven afzonderlijk.

**Relatie:** P12 Teams; P04 Gezinsagenda.

### P01.F07 — Aandacht en clubmomenten

Presenteer praktische signalen en waarderingsmomenten binnen de zichtbaarheid van de actor. Deze tegels veranderen geen verplichting, uren of rechten.

**Relatie:** P16 Waardering; P09 Huishoudens; P13 Mijn acties.

**Demo → staging:** Verwijder hardgecodeerde voorbeeldnaam, 12/6-uurmeters, vaste winterdatum en verouderde aandachtstekst uit de productieprojectie; behoud de exacte visuele vorm.

**Pagina-acceptatie:** A01, A02, A30, V01. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P02 — Takenmarkt

**Prototype-route:** `taken`. **Bron:** tasks.tsx, team-domain.ts.

**Wie gebruikt dit:** Lid en gemachtigd huishouden; beheerders alleen namens iemand binnen expliciet mandaat.

### P02.F01 — Open verenigingstaken

Toon gepubliceerde toekomstige verenigingstaken met vrije openbare plaatsen. Teamtaken en voor een team gereserveerde plaatsen verschijnen hier niet als boekbaar.

**Relatie:** P08 Planbord; P12 Teams; P19 Rapportages. Proces R01.

### P02.F02 — Zoeken en categorieën

Zoek op taaknaam en filter op categorie, Alle taken, Past bij mij en Open plaatsen. Filters veranderen alleen het overzicht.

**Relatie:** P23 Mijn profiel en intake; P17 Opleidingen; P19 Rapportages.

### P02.F03 — Korte en passende taken

Gebruik voorkeuren en de filter voor korte taken. Maak duidelijk of een filter taakduur of toegekende verenigingsminuten gebruikt; geschiktheid omvat leeftijd, kwalificaties en beschikbaarheid.

**Relatie:** P23 Mijn profiel en intake; P17 Opleidingen; P12 Teams.

### P02.F04 — Taakdetails

Open datum, tijden, locatie, minimumleeftijd, certificaat, instructies, bezetting en afmeldafspraak. Leg de aangeboden instructieversie vast.

**Relatie:** P03 Mijn taken; P10 Commissies; P17 Opleidingen.

### P02.F05 — Uitvoerder kiezen

Kies een toegestane persoon die aan de gekozen verplichting mag bijdragen. De gebruiker die boekt en de persoon die uitvoert zijn apart geregistreerd.

**Relatie:** P09 Huishoudens; P23 Mijn profiel en intake; P04 Gezinsagenda.

### P02.F06 — Instructies erkennen en boeken

Een niet vooraf aangevinkte bevestiging is nodig. Reserveer precies één vrije openbare plaats atomair; controleer overlap, seizoen, leeftijd, geldig certificaat, buddy en autorisatie op de server.

**Relatie:** P03 Mijn taken; P08 Planbord; P12 Teams; P17 Opleidingen. Proces R01, R05, R09, R18.

### P02.F07 — Wachtlijst

Als geen plaats beschikbaar is, kan een geschikte uitvoerder op de wachtlijst. Vrijgekomen plaats biedt een tijdelijke, gecontroleerde hold; een ander kanaal kan die niet voorbij boeken.

**Relatie:** P03 Mijn taken; P05 Ruilmarkt; P14 Berichten.

### P02.F08 — Taak aanpassen

Een bevoegde planner opent de editor. Geplande deelnemers, voorwaarden, gereserveerde teamplaatsen en notificaties lopen via gevolgenpreview, niet via stil overschrijven.

**Relatie:** P08 Planbord; P03 Mijn taken; P12 Teams.

### P02.F09 — Passende taak aanvragen

Het formulier We denken met je mee registreert een hulpvraag met praktische context. De commissie of portefeuillehouder volgt deze op; een aanvraag levert nog geen uren of vrijstelling op.

**Relatie:** P09 Huishoudens; P13 Mijn acties; P19 Rapportages; P20 Vrijwilligerspot.

### P02.F10 — Vaste vrijwilligersfunctie verkennen

De link naar functies ondersteunt structurele inzet. Interesse wordt los geregistreerd van formele erkenning en eventuele huishoudvrijstelling.

**Relatie:** P18 Vrijwilligersfuncties; P09 Huishoudens; P22 Instellingen.

**Demo → staging:** De demo biedt een lokale inschrijving en lokale meldingen. Staging gebruikt de bestaande book_shift- en waitlist-RPC’s waar passend; openbare capaciteit houdt ook rekening met teamreserveringen en holds.

**Pagina-acceptatie:** A13, A15, A17, A27, T01, T02, T03, T12, V02. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P03 — Mijn taken

**Prototype-route:** `diensten`. **Bron:** tasks.tsx, team-workspace.tsx, coordination-panels.tsx.

**Wie gebruikt dit:** Eigen verplichting/huishouden; uitvoeringscontrole door bevoegde commissie of teambeheerder binnen taakscope.

**Tabbladen/weergaven:** Komend; Te bevestigen; Historie; Teamtaken: Komend/Historie.

### P03.F01 — Komende verenigingstaken

Toon afgesproken uitvoerder, taak, tijd, locatie, urensnapshot, afmeldtermijn en huidige status. Geplande uren zijn nog geen verdiende uren.

**Relatie:** P02 Takenmarkt; P04 Gezinsagenda; P09 Huishoudens. Proces R01, R05.

### P03.F02 — Te bevestigen en historie

Scheid komende afspraken, uitgevoerde maar nog te beoordelen taken en onveranderlijke historie. Datum en status worden samen gebruikt; een oude Ingepland-afspraak blijft als opvolgactie zichtbaar.

**Relatie:** P13 Mijn acties; P19 Rapportages; P20 Vrijwilligerspot. Proces R07, R09.

### P03.F03 — Toegewezen teamplaatsen

Toon een plaats namens een teamlid waarvoor het huishouden een uitvoerder moet kiezen. Dezelfde toewijzing staat in teamplanning, gezinsagenda en Mijn acties.

**Relatie:** P12 Teams; P04 Gezinsagenda; P13 Mijn acties. Proces R02.

### P03.F04 — Taken via mijn teams

Toon verenigingstaken en teamtaken die via een team zijn geboekt, met gekozen lid voor het teamdoel en daadwerkelijke uitvoerder. Tellingen komen uit dezelfde uitvoeringsbron.

**Relatie:** P12 Teams; P04 Gezinsagenda; P09 Huishoudens.

### P03.F05 — Uitvoering bevestigen

Na de uitvoering bevestigt een bevoegde actor aanwezigheid. Schrijf één uitvoeringsbesluit, één eventuele verenigingsurenpost en één eventuele teamtelling; een retry verdubbelt niets.

**Relatie:** P12 Teams; P09 Huishoudens; P13 Mijn acties; P19 Rapportages; P20 Vrijwilligerspot. Proces R01, R02, R03, R08, R16.

### P03.F06 — Niet verschenen registreren

Een bevoegde actor legt no-show met nul uren vast. Toon de correctie- en bezwaarroute; no-show is geen automatische geldboete buiten het vastgestelde afrekenbeleid.

**Relatie:** P09 Huishoudens; P20 Vrijwilligerspot; P13 Mijn acties.

### P03.F07 — Afmelden binnen afspraak

Bereken de afmelddeadline uit de booking-snapshot. Bij toegestane afmelding komt de juiste plaats vrij en worden wachtlijst, winterkoppeling en teamopvolging consistent bijgewerkt.

**Relatie:** P05 Ruilmarkt; P02 Takenmarkt; P09 Huishoudens; P12 Teams.

### P03.F08 — Ziekte of verhindering melden

Ziekmelden blijft mogelijk, ook na de afmelddeadline of zonder beleidsacceptatie. Bewaar alleen noodzakelijke praktische informatie; de oorspronkelijke afspraak blijft bestaan tot bevoegde verwerking of overname.

**Relatie:** P12 Teams; P13 Mijn acties; P14 Berichten; P15 Beleid & afspraken.

### P03.F09 — Overname vragen

Publiceer een gecontroleerd overnameverzoek voor een openbare taak of meld teamvervanging in de teamworkflow. Het origineel blijft verantwoordelijk tot een passende vervanger definitief bevestigt.

**Relatie:** P05 Ruilmarkt; P12 Teams; P14 Berichten. Proces R07.

### P03.F10 — Urenvraag en correctie

Open een bezwaar op de concrete booking/urenpost. Sluit alleen dat dossier na een gemotiveerd besluit; overige blokkades blijven bestaan. Correcties zijn tegenboekingen met historie.

**Relatie:** P09 Huishoudens; P13 Mijn acties; P20 Vrijwilligerspot. Proces R08.

### P03.F11 — Ervaring delen

Na bevestigde uitvoering kan de toegestane uitvoerder of gemachtigde vertegenwoordiger twee vragen beantwoorden en praktische feedback geven. Dit wijzigt geen uren.

**Relatie:** P16 Waardering; P12 Teams; P23 Mijn profiel en intake; P18 Vrijwilligersfuncties. Proces R16.

**Demo → staging:** De oude openbare presentieactie kan in de demo ook toekomstige taken bevestigen en alle Urencontrole-aanvragen van een huishouden sluiten. Dat gedrag moet worden vervangen door de bestaande servertransactie en gerichte casusafhandeling.

**Pagina-acceptatie:** A14, A15, A29, T04, T05, T07, T08, T13, T14, T18, C05, C10, F02, V03. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P04 — Gezinsagenda

**Prototype-route:** `gezin`. **Bron:** coordination-workspace.tsx.

**Wie gebruikt dit:** Alleen het eigen huishouden of expliciet gemachtigde dossiercontext, ook voor een beheerder.

**Tabbladen/weergaven:** Komend; Historie.

### P04.F01 — Een huishoudmeter

Toon één verenigingsurenstand met geldend doel, gepland, in beoordeling, bevestigd en resterend. Twee kinderen in verschillende teams maken geen tweede urendoel.

**Relatie:** P09 Huishoudens; P03 Mijn taken; P12 Teams; P20 Vrijwilligerspot. Proces R02, R11.

### P04.F02 — Meters per kind en team

Toon voor elk gekoppeld teamlid het eigen seizoensdoel, uitgevoerd, ingepland, toegewezen en nog te organiseren. Een plaats telt voor één gekozen lid.

**Relatie:** P12 Teams; P03 Mijn taken.

### P04.F03 — Gecombineerde tijdlijn

Combineer eigen bookings, toegewezen nog onbemenste plaatsen en wedstrijden van huishoudteams. Gebruik dezelfde bron-ID's; een afspraak wordt niet voor iedere weergave gekopieerd.

**Relatie:** P03 Mijn taken; P12 Teams; P07 Wedstrijden; P06 Jaaragenda. Proces R05, R07.

### P04.F04 — Komend en historie

Filter op actuele clubdatum en eindstatus. Overgenomen en niet verschenen afspraken blijven traceerbaar in historie maar tellen niet als komende bezetting.

**Relatie:** P03 Mijn taken; P19 Rapportages.

### P04.F05 — Planningswaarschuwingen

Waarschuw voor gezinswedstrijd of twee gelijktijdige huishoudafspraken. Dit is zacht bij verschillende personen; overlap van dezelfde uitvoerder is een harde boekingsblokkade.

**Relatie:** P02 Takenmarkt; P12 Teams; P07 Wedstrijden; P23 Mijn profiel en intake. Proces R05.

### P04.F06 — Uitvoerder kiezen

Een open toegewezen plaats opent het bestaande teamboekingsvenster. Het huishouden kiest het lid voor de telling en een geschikte toegestane uitvoerder; beide worden servermatig gevalideerd.

**Relatie:** P12 Teams; P03 Mijn taken; P13 Mijn acties. Proces R02.

### P04.F07 — Afspraak en overname bekijken

Open instructies, urenafspraak, gekozen lid en uitvoerder. Overname of verhindering gebruikt dezelfde broncasus als teamplanning en Mijn taken.

**Relatie:** P03 Mijn taken; P12 Teams; P14 Berichten.

### P04.F08 — Terugblik op uitvoering

Open eigen feedback of deel een ervaring na bevestiging. Toon de eigen historie zonder feedback, dossiers of privégegevens van andere huishoudens.

**Relatie:** P16 Waardering; P23 Mijn profiel en intake; P18 Vrijwilligersfuncties.

**Demo → staging:** De nieuwe gezinsagenda is leidend voor huishoudoverzicht. De algemene jaaragenda is een andere weergave; voeg daar dezelfde teamafspraken als projectie aan toe, niet als losse events.

**Pagina-acceptatie:** A01, A02, A30, T04, T05, T06, T07, T13, T15, C03, C04, V04. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P05 — Ruilmarkt

**Prototype-route:** `ruilmarkt`. **Bron:** tasks.tsx.

**Wie gebruikt dit:** Geschikte toegestane uitvoerders; ruilinstemming door de betrokken accounts of expliciet gemachtigde actor.

### P05.F01 — Open overnameverzoeken

Toon actieve overnameverzoeken van openbare verenigingstaken. Teamgereserveerde taken worden opgelost binnen het team en lekken niet naar de openbare ruilmarkt.

**Relatie:** P03 Mijn taken; P12 Teams; P02 Takenmarkt. Proces R07.

### P05.F02 — Passende vervanger kiezen

Kies een gemachtigde uitvoerder en toets leeftijd, certificaten, seizoen, overlap en toegang opnieuw. Een onscreen keuze is geen bewijs van toestemming.

**Relatie:** P23 Mijn profiel en intake; P17 Opleidingen; P09 Huishoudens. Proces R07.

### P05.F03 — Definitief overnemen

Maak de vervangende booking en sluit de oorspronkelijke afspraak als Overgenomen in één transactie. Bewaar historie en boek geen uitgevoerde uren op basis van overname.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P08 Planbord; P14 Berichten. Proces R07.

### P05.F04 — Wederzijds ruilen

Selecteer een eigen afspraak en verkrijg expliciete instemming van beide kanten voor de actuele ruilversie. Hercontroleer beide afspraken en pas alles of niets toe.

**Relatie:** P03 Mijn taken; P17 Opleidingen; P09 Huishoudens. Proces R07.

### P05.F05 — Verlopen of gewijzigde ruil

Een stale versie, verlopen aanbod, ingetrokken toestemming of ongeschikte uitvoerder blokkeert de ruil met hersteloptie; beide originele afspraken blijven intact.

**Relatie:** P03 Mijn taken; P13 Mijn acties; P14 Berichten.

**Demo → staging:** De demo behandelt de eigen bevestiging alsof beide kanten instemmen en herschrijft soms de uitvoerder van een booking. Staging gebruikt transfer-events en nieuwe bookings met bronverwijzing.

**Pagina-acceptatie:** A14, V05. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P06 — Jaaragenda

**Prototype-route:** `agenda`. **Bron:** collaboration.tsx.

**Wie gebruikt dit:** Alleen toegestane verenigings-, commissie-, team- en huishouditems.

**Tabbladen/weergaven:** Alles; Activiteiten; Wedstrijden; Verenigingstaken.

### P06.F01 — Maandkalender en lagen

Kies een maand en soort afspraak. Toon activiteiten, wedstrijden en eigen verenigingstaken; staging neemt ook eigen teamafspraken mee via gedeelde projecties.

**Relatie:** P04 Gezinsagenda; P07 Wedstrijden; P03 Mijn taken; P12 Teams.

### P06.F02 — Kalenderitem openen

Open categorie, datum, tijd, locatie, omschrijving en zichtbaarheid. Dezelfde bronrechten gelden bij rechtstreeks openen van het item.

**Relatie:** P10 Commissies; P12 Teams; P14 Berichten.

### P06.F03 — Activiteit maken

Vul titel, datum, begin/einde, locatie, categorie, zichtbaarheid, herhaling en omschrijving in. Alleen een actor met publicatierecht voor de gekozen scope kan opslaan.

**Relatie:** P10 Commissies; P11 Kanbanborden; P16 Waardering; P17 Opleidingen.

### P06.F04 — Locatieconflict controleren

Einde moet na begin vallen. Toets overlappende reserveringen voor dezelfde echte locatie en scope servermatig, ook bij twee gelijktijdige requests.

**Relatie:** P08 Planbord; P07 Wedstrijden.

### P06.F05 — Aanwezigheid bij activiteit

Ik ben erbij en Afmelden wijzigen een unieke RSVP van de gebruiker. Aanwezigheid bij een activiteit geeft geen verenigingsuren.

**Relatie:** P14 Berichten; P19 Rapportages.

### P06.F06 — Herhaling van activiteiten

De demo bewaart alleen de gekozen herhalingsnaam. Staging genereert concrete lokale occurrences, met keuze voor deze afspraak of toekomstige reeks en een vaste DST-strategie.

**Relatie:** P22 Instellingen; P14 Berichten; P08 Planbord.

**Demo → staging:** De huidige kalender telt 35 cellen, waardoor maanden met zes weken onvolledig zijn. Staging moet alle dagen tonen met dezelfde styling, echte vandaagmarkering en de gekozen datum als formulierstart.

**Pagina-acceptatie:** A25, V06. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P07 — Wedstrijden

**Prototype-route:** `wedstrijden`. **Bron:** collaboration.tsx.

**Wie gebruikt dit:** Wedstrijdinzage volgens teamscope; import en gevolgenbeoordeling alleen voor bevoegd beheer.

**Tabbladen/weergaven:** Alle teams; Mijn gezin; Specifiek team.

### P07.F01 — Wedstrijdprogramma filteren

Toon datum, tegenstander, thuis/uit, aanvang, locatie, veld en wijzigingsstatus. Mijn gezin gebruikt echte teamkoppelingen, niet de twee hardgecodeerde demoteams.

**Relatie:** P04 Gezinsagenda; P06 Jaaragenda; P12 Teams. Proces R05.

### P07.F02 — Nu synchroniseren

Start dezelfde gecontroleerde Sportlink-import als de automatische lokale syncmomenten. Toon werkelijke runstatus en laatste volledige geslaagde synchronisatie.

**Relatie:** P22 Instellingen; P14 Berichten; P13 Mijn acties. Proces R13.

### P07.F03 — Taakvoorstellen bij thuiswedstrijd

Maak Bar, Keuken en Ontvangst als conceptvoorstellen vanuit het gekozen roostersjabloon. Herhaald klikken of dezelfde import maakt geen dubbele voorstellen.

**Relatie:** P08 Planbord; P02 Takenmarkt; P10 Commissies. Proces R13.

### P07.F04 — Wijzigingsgevolgen bekijken

Vergelijk de nieuwe wedstrijdversie met gekoppelde verenigingstaken, bookings, teamplaatsen en instructies. Verplaats of annuleer geen toezeggingen zonder bewuste verwerking.

**Relatie:** P08 Planbord; P12 Teams; P03 Mijn taken; P13 Mijn acties. Proces R13.

### P07.F05 — Tijden behouden en informeren

De huidige dialoog kan de bestaande tijden behouden en betrokkenen informeren. Voeg de canonroute voor gecontroleerd aanpassen toe in dezelfde dialoogstijl; sluit alleen de beoordeelde impactversie.

**Relatie:** P08 Planbord; P14 Berichten; P06 Jaaragenda. Proces R13.

**Demo → staging:** Sportlink is in de demo een simulatie. Een fout of gedeeltelijke response is geen afgelasting. Welke velden en credentials beschikbaar zijn hangt af van de daadwerkelijk geautoriseerde providerverbinding.

**Pagina-acceptatie:** A18, A19, T09, T11, C04, O04, O06, O09, V07. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P08 — Planbord

**Prototype-route:** `planbord`. **Bron:** tasks.tsx, team-workspace.tsx.

**Wie gebruikt dit:** Eigen commissie voor commissiecoördinator; centrale verdeling voor vrijwilligerscommissie/bestuur.

**Tabbladen/weergaven:** Dag; Week; Maand; Commissiekeuze.

### P08.F01 — Rooster per commissie en datum

Kies commissie, datum en dag/week/maand. Toon categorieën, rijplaatsen, tijden, bezetting en publicatiestatus uit stabiele shift_positions.

**Relatie:** P02 Takenmarkt; P10 Commissies; P12 Teams; P07 Wedstrijden.

### P08.F02 — Verenigingstaak maken

Vul naam, datum, begin/einde, bezetting, verenigingsminuten, minimumleeftijd, afmelddagen, commissie, categorie, publicatie, kwalificatie, instructie en buddy in. Server bepaalt versies en toegestane waarden.

**Relatie:** P02 Takenmarkt; P03 Mijn taken; P17 Opleidingen; P22 Instellingen. Proces R01.

### P08.F03 — Vrije markt of team kiezen

Bij maken kiest de commissie openbare markt of teamreservering; de standaard komt uit instellingen. Voor bestaande taken wordt de plaatsgewijze clusterworkflow gebruikt.

**Relatie:** P12 Teams; P22 Instellingen; P02 Takenmarkt.

### P08.F04 — Taak openen en bewerken

Open de bestaande editor. Bij bezetting verschijnt gevolgencontrole; capaciteit kan niet onder bestaande afspraken worden verlaagd en voorwaarden worden niet stil herschreven.

**Relatie:** P03 Mijn taken; P12 Teams; P07 Wedstrijden.

### P08.F05 — Tijdblok verplaatsen of verlengen

Sleep of wijzig één concrete plaats. Gebruik gevolgenpreview en expected_version; houd bookinghistorie, position-ID, locatieconflicten en teamreserveringen intact.

**Relatie:** P03 Mijn taken; P06 Jaaragenda; P12 Teams.

### P08.F06 — Roostersjabloon toepassen

Kies Normaler/drukker thuisprogramma of toernooi en aantal weken. Genereer maximaal de toegestane reeks als concept; herhaald toepassen geeft een bewust duplicatievoorstel of dedupe.

**Relatie:** P07 Wedstrijden; P22 Instellingen; P02 Takenmarkt. Proces R13.

### P08.F07 — Concepten publiceren

Publiceer een gecontroleerde batch met stabiele publicatiegebeurtenissen. Alleen werkelijk nieuwe beschikbare taken starten passende meldingen; taakedit is geen nieuwe eerste publicatie.

**Relatie:** P02 Takenmarkt; P14 Berichten; P21 Communicatie. Proces R01, R13, R15.

### P08.F08 — Vrije plaatsen clusteren

Selecteer precies de vrije plaatsen over één of meer verenigingstaken en geef clusternaam, team, uiterste verdeeldatum, werkwijze, meetellen voor teamdoel en afspraken op.

**Relatie:** P12 Teams; P02 Takenmarkt; P03 Mijn taken. Proces R02.

### P08.F09 — Teamadvies bij cluster

Vergelijk teams op geschikte huishoudens, totale taakduur, seizoensbelasting en wedstrijdwaarschuwingen. De commissie kiest; advies reserveert geen uitvoerders en verleent geen rechten.

**Relatie:** P12 Teams; P04 Gezinsagenda; P23 Mijn profiel en intake; P17 Opleidingen.

### P08.F10 — Clusterbezetting volgen

Toon gereserveerd, verdeeld, uitvoerder bevestigd en uitgevoerd apart. Een toegewezen huishouden is nog geen bezette plaats.

**Relatie:** P12 Teams; P13 Mijn acties; P19 Rapportages.

### P08.F11 — Cluster vrijgeven

Alleen volledig onverdeelde en onbevestigde plaatsen kunnen gecontroleerd terug naar openbare markt. Een bezette afspraak blijft staan; vrije capaciteit wijzigt atomair.

**Relatie:** P02 Takenmarkt; P12 Teams; P03 Mijn taken.

**Demo → staging:** Corrigeer vaste 08:00–18:00-begrenzing waar taken erbuiten liggen, onjuiste maandnavigatie en 35-dagenweergave. Verplaatsing mag geen historische positie-identiteit veranderen. De bestaande visuele roostervorm blijft behouden.

**Pagina-acceptatie:** A13, A16, A17, T01, T02, T03, T09, T12, C01, C03, V08. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P09 — Huishoudens

**Prototype-route:** `huishoudens`. **Bron:** people.tsx.

**Wie gebruikt dit:** Vrijwilligerscommissie/bestuur; vrijwilligerscoördinator uitsluitend portefeuille, financiële details apart afgeschermd.

**Tabbladen/weergaven:** Alle huishoudens; Wintercontrole; Vrijstellingen; Aanvragen; Dossier: Overzicht/Personen/Afspraken/Historie.

### P09.F01 — Dossiers zoeken en filteren

Zoek huishoudens en filter op wintertekort, vrijstelling of open aanvragen. Samenvattingen tellen één aansprakelijke seizoensverplichting per vastgesteld dossier.

**Relatie:** P01 Overzicht; P19 Rapportages; P20 Vrijwilligerspot.

### P09.F02 — Nieuw huishouddossier

Maak een dossier met naam, intakecodeverwijzing en expliciet beoordeeld seizoensdoel. Een nieuw account of gedeeld kind maakt nooit automatisch een tweede urendoel.

**Relatie:** P23 Mijn profiel en intake; P22 Instellingen; P20 Vrijwilligerspot. Proces R11.

### P09.F03 — Huishouddossier openen

De tabs tonen overzicht, personen, afspraken en dossierhistorie binnen rechten. Uren, doel, dekking en blokkades zijn aparte gegevens.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P12 Teams; P20 Vrijwilligerspot. Proces R01, R03.

### P09.F04 — Personen en verificatie

Toon dossierkoppelingen, intake- en verificatiestatus. Verificatie en toegang volgen Auth en grants; een lokale checkbox kan geen echte identiteit verifiëren.

**Relatie:** P23 Mijn profiel en intake; P22 Instellingen.

### P09.F05 — Extra uitvoerder uitnodigen

Vul naam, e-mail en relevante persoonsgegevens in. Stuur een beperkte eenmalige uitnodiging; acceptatie vereist matching geverifieerde identiteit en expliciete uitvoerder-/dossierrechten.

**Relatie:** P22 Instellingen; P23 Mijn profiel en intake; P02 Takenmarkt. Proces R11.

### P09.F06 — Individuele afspraak aanvragen

Registreer vermindering, vrijstelling, uitstel of afkoop met reden en voorgestelde minuten. Doelwijziging wacht op een formeel besluit; nul minuten is een geldige expliciete waarde.

**Relatie:** P20 Vrijwilligerspot; P13 Mijn acties; P22 Instellingen.

### P09.F07 — Aanvragen beoordelen

Twee verschillende bevoegde accounts beoordelen dezelfde voorstelversie. Een aangepast voorstel maakt eerdere reviews ongeldig; belangenconflict gaat naar bestuur.

**Relatie:** P13 Mijn acties; P20 Vrijwilligerspot; P15 Beleid & afspraken. Proces R08, R20.

### P09.F08 — Vaste vrijwilligersrol erkennen

Kies persoon, rolversie, begin/einde en scope. Vrijstelling dekt uitsluitend expliciet gekoppelde verplichting/huishouden; er ontstaan geen fictieve uren of systeemrechten.

**Relatie:** P18 Vrijwilligersfuncties; P22 Instellingen; P20 Vrijwilligerspot. Proces R10.

### P09.F09 — Einde rol opvolgen

Een beëindiging start een beoordeelde wijzigingscasus. Behoud historie en voorkom een automatische terugwerkende urenclaim totdat het besluit definitief is.

**Relatie:** P22 Instellingen; P13 Mijn acties; P20 Vrijwilligerspot. Proces R10.

### P09.F10 — Huishoudens koppelen splitsen herstellen

Registreer type, reden en voorgestelde koppeling. Gebruik servermatige gevolgenpreview en besluit; verhuis geen historische uren en deel geen onafhankelijke intake van gescheiden ouders.

**Relatie:** P23 Mijn profiel en intake; P04 Gezinsagenda; P20 Vrijwilligerspot. Proces R11.

### P09.F11 — Wintertekort passend plannen

Beoordeel eerst open uitvoeringen en geschillen. Link bestaande passende na-winterbooking of boek één echte vrije plaats; winterallocatie vermindert alleen het tekort binnen hetzelfde jaardoel.

**Relatie:** P03 Mijn taken; P02 Takenmarkt; P12 Teams; P20 Vrijwilligerspot. Proces R09.

### P09.F12 — Dossierhistorie

Toon uitsluitend relevante beslissingen, uitnodigingen, wijzigingen en urenacties van dit dossier. Een globale auditlijst hoort niet in een huishoudvenster.

**Relatie:** P22 Instellingen; P20 Vrijwilligerspot; P23 Mijn profiel en intake.

### P09.F13 — CSV-overzicht exporteren

Exporteer toegestane actuele dossiergegevens met dezelfde filters en bronrevisie. Exportrechten en veldprivacy zijn gelijk aan of strenger dan schermrechten.

**Relatie:** P19 Rapportages; P20 Vrijwilligerspot; P12 Teams.

**Demo → staging:** Winterplanning in de demo kan teamgereserveerde capaciteit missen. Alle plaatskanalen moeten één invariant delen. De demo gebruikt beoordelaarslabels; twee labels van dezelfde actor gelden op staging als één reviewer.

**Pagina-acceptatie:** A01, A02, A03, A04, A05, A06, A07, A08, A09, A10, A26, A29, T02, T05, T07, T08, T10, T15, T16, T17, T18, C09, F01, F02, O07, O09, O10, V09. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P10 — Commissies

**Prototype-route:** `commissies`. **Bron:** collaboration.tsx.

**Wie gebruikt dit:** Eigen commissie en expliciete leden/document-ACL; centraal beheer volgens mandaat.

**Tabbladen/weergaven:** Overzicht; Mensen; Documenten; Instructies.

### P10.F01 — Commissie kiezen

Open de eigen toegestane commissie met coordinator, werk en kennis. Wisselen verleent geen rechten voor andere commissies.

**Relatie:** P08 Planbord; P11 Kanbanborden; P14 Berichten.

### P10.F02 — Actueel werk bekijken

Toon relevante kanbankaarten en roosterinformatie. Planbord-, kanban- en chatlinks behouden de gekozen commissiecontext.

**Relatie:** P08 Planbord; P11 Kanbanborden; P14 Berichten. Proces R12.

### P10.F03 — Commissielid toevoegen

Voeg een bestaande toegestane persoon toe, zonder dubbele lidkoppeling. Commissiebetrokkenheid en systeembevoegdheid worden afzonderlijk vastgelegd.

**Relatie:** P22 Instellingen; P18 Vrijwilligersfuncties.

### P10.F04 — Coordinator wijzigen

Wijzig de formele contactpersoon binnen mandaat en looptijd. Rechten worden apart toegekend of ingetrokken en gelogd.

**Relatie:** P22 Instellingen; P13 Mijn acties.

### P10.F05 — Documenten en instructies zoeken

Toon type, eigenaar, versie en toegestane zichtbaarheid. Een documentlink kan geen ACL omzeilen.

**Relatie:** P02 Takenmarkt; P12 Teams; P11 Kanbanborden.

### P10.F06 — Kennis toevoegen

Maak document/instructie met titel, tekst, checklist, optionele video en scope. Veilige video- en bestandslinks behouden toegang en delen geen privéteksten in previews.

**Relatie:** P02 Takenmarkt; P11 Kanbanborden; P14 Berichten.

### P10.F07 — Documentversie bewerken

Opslaan maakt een nieuwe immutable tekstversie en bewaart de vorige. Gekoppelde bookings behouden hun aangeboden instructieversie en krijgen zo nodig een herbevestigingsactie.

**Relatie:** P02 Takenmarkt; P03 Mijn taken; P12 Teams.

### P10.F08 — Document downloaden

Lever exact de toegestane versie via gecontroleerde download. Private bestanden gebruiken tijdelijke toegang, geen publiek gedeelde data-URL.

**Relatie:** P11 Kanbanborden; P22 Instellingen.

**Demo → staging:** In de demo is documenttekst lokaal en commissielidmaatschap niet serverbeveiligd. Gebruik de bestaande committee_documents, versions en ACL-tabellen. De directe links verliezen nu soms de commissiecontext.

**Pagina-acceptatie:** A24, A25, C11, V10. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P11 — Kanbanborden

**Prototype-route:** `kanban`. **Bron:** collaboration.tsx.

**Wie gebruikt dit:** Boardleden/commissie binnen bronrechten; persoonlijk alleen eigen toegestane kaarten.

**Tabbladen/weergaven:** Commissiebord; Persoonlijk via Mijn acties.

### P11.F01 — Bord en commissie kiezen

Toon kolommen en kaarten van één toegestaan bord. Het persoonlijke overzicht projecteert eigen toewijzingen uit dezelfde kaarten.

**Relatie:** P10 Commissies; P13 Mijn acties.

### P11.F02 — Kaart maken

Vul titel, omschrijving, commissie, deadline en prioriteit in. Een persoonlijke kaart start met de actor als uitvoerder; opslag vraagt boardrecht.

**Relatie:** P13 Mijn acties; P10 Commissies. Proces R12.

### P11.F03 — Kolom maken en ordenen

Maak een kolom op het gekozen bord en orden kolommen binnen dat bord. Nieuwe kolommen zijn geen globale configuratie voor alle commissies.

**Relatie:** P10 Commissies; P22 Instellingen.

### P11.F04 — Kaart verplaatsen en afronden

Sleep of kies status met actuele versie. Schrijf historie; Done kent nul verenigingsuren toe en bevestigt geen teamtaak.

**Relatie:** P03 Mijn taken; P12 Teams; P19 Rapportages. Proces R12.

### P11.F05 — Omschrijving en planning bewerken

Bewerk omschrijving, status, deadline en prioriteit in het kaartvenster. Voeg canonvelden zoals startdatum/labels met bestaande componenten toe wanneer nog geen control aanwezig is.

**Relatie:** P06 Jaaragenda; P13 Mijn acties.

### P11.F06 — Meerdere uitvoerders en aanspreekpunt

Wijs meerdere toegestane personen toe en eventueel één contactpersoon. Een aanspreekpunt is optioneel en geen alleenstaande uitvoerder.

**Relatie:** P10 Commissies; P13 Mijn acties; P14 Berichten. Proces R12.

### P11.F07 — Checklist en subtaken

Voeg checklisttekst toe, vink af en koppel subtaken aan uitvoerders. Staging ondersteunt de canon-subtaakstatus/deadline en meerdere uitvoerders waar vereist.

**Relatie:** P13 Mijn acties; P14 Berichten. Proces R12.

### P11.F08 — Reacties en mentions

Plaats een reactie; resolve @mentions naar echte persoon-ID's met bronrecht. Een mention geeft geen toegang en stuurt geen globale tekstmelding.

**Relatie:** P14 Berichten; P13 Mijn acties. Proces R12.

### P11.F09 — Bijlage toevoegen en downloaden

De demo accepteert een lokaal bestand kleiner dan 1 MB. Staging gebruikt private Storage, gecontroleerd MIME/formaat/grootte en geautoriseerde downloads; behoud de zichtbare uploadflow.

**Relatie:** P10 Commissies; P22 Instellingen.

### P11.F10 — Agenda of verenigingstaak koppelen

Koppel een bestaand toegelaten event of taak via typed FK. De link leest de bron; wijzigen van de kaart wijzigt de taak of het event niet automatisch.

**Relatie:** P06 Jaaragenda; P08 Planbord; P02 Takenmarkt.

### P11.F11 — Historie en toegankelijk openen

Open kaarten met klik of Enter; bewaar status- en inhoudsgeschiedenis per actor. Historie en gekoppelde gegevens blijven beperkt tot het bord.

**Relatie:** P22 Instellingen; P13 Mijn acties.

**Demo → staging:** De demo bewaart bijlagen als data-URL en mentions als substring. De canon heeft uitgebreidere kaartvelden dan de huidige controls; ontbrekende controls zijn aanvullingen binnen Club Signal, geen toestemming voor een nieuw ontwerp.

**Pagina-acceptatie:** A24, A25, O07, V11. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P12 — Teams

**Prototype-route:** `teams`. **Bron:** team-workspace.tsx, team-domain.ts, coordination-panels.tsx, coordination-domain.ts.

**Wie gebruikt dit:** Eigen teamhuishouden ziet eigen benodigde voortgang; teamouder beheert eigen team; commissie verdeelt verenigingstaken.

**Tabbladen/weergaven:** Takenmarkt; Planning; Voortgang per lid; Huishoudens; Slim verdelen; Opvolging; Overdracht.

### P12.F01 — Team kiezen en statusmeters

Kies een toegestaan team. Toon nog te bemensen, ingepland, uitgevoerd en seizoensdoel; een toegewezen lid is nog geen bevestigde uitvoerder.

**Relatie:** P01 Overzicht; P04 Gezinsagenda; P13 Mijn acties; P08 Planbord.

### P12.F02 — Besloten teamtakenmarkt

Toon gepubliceerde eigen teamtaken en gereserveerde verenigingstaken. Filter Alle taken, Verenigingstaken en Teamtaken. Openbare markt en ander team kunnen dezelfde plaats niet boeken.

**Relatie:** P02 Takenmarkt; P08 Planbord; P03 Mijn taken. Proces R02.

### P12.F03 — Inschrijfwijze per cluster

De commissie kiest zelf inschrijven, rechtstreeks verdelen of gecombineerd. Termijnen bepalen wanneer vrije zelfinschrijving sluit; een toegewezen huishouden kan zijn uitvoerder daarna nog bevestigen.

**Relatie:** P08 Planbord; P13 Mijn acties; P14 Berichten. Proces R06.

### P12.F04 — Teamplanning en clusters

Toon elke vaste plaats met cluster, taak, namens welk lid, uitvoerder en status. Dezelfde booking wordt op Mijn taken en Gezinsagenda getoond.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P08 Planbord. Proces R02, R05, R17.

### P12.F05 — Plaats aan lid toewijzen

De teamouder kiest een teamlid en stuurt een toewijzing aan diens huishouden. Herbevestig geschiktheid en geldend doel; een voldaan doel kan niet stil verplicht extra worden belast.

**Relatie:** P04 Gezinsagenda; P13 Mijn acties; P23 Mijn profiel en intake. Proces R02, R04.

### P12.F06 — Toewijzing opnieuw vrijmaken

Maak een onbevestigde toewijzing opnieuw beschikbaar binnen hetzelfde team. Een actieve booking blijft totdat definitieve overname of formele annulering is geregeld.

**Relatie:** P03 Mijn taken; P08 Planbord; P13 Mijn acties.

### P12.F07 — Huishouden kiest uitvoerder

Kies het lid voor de telling en een geschikte uitvoerder uit toegestane huishoudpersonen. De teamouder mag die keuze niet automatisch namens andere huishoudens maken.

**Relatie:** P04 Gezinsagenda; P03 Mijn taken; P09 Huishoudens; P17 Opleidingen. Proces R02, R03, R06, R09, R18.

### P12.F08 — Vrijwillig extra helpen

Als toepasselijk teamdoel of verenigingsurendoel is bereikt, is een expliciet vrijwillig akkoord nodig. Reservebereidheid en advies zijn geen akkoord voor een extra booking.

**Relatie:** P23 Mijn profiel en intake; P09 Huishoudens; P13 Mijn acties. Proces R06.

### P12.F09 — Verhindering en vervanging

Meld een praktische verhindering en houd de oude booking staan tot een geschikte vervanger bevestigt. De teamouder krijgt gerichte opvolging; medische details horen hier niet.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P13 Mijn acties; P14 Berichten.

### P12.F10 — Eigen teamtaak publiceren

Maak Fluiten, Grensrechter, Fruit, Vervoer, Bidons of Overige teamtaak met datum/tijd, capaciteit, leeftijd, kwalificatie, instructies en meetellen. Zonder goedkeuring geeft deze nul verenigingsminuten.

**Relatie:** P07 Wedstrijden; P17 Opleidingen; P08 Planbord. Proces R03, R16.

### P12.F11 — Wekelijks herhalen

Publiceer maximaal 12 gevraagde wekelijkse teamtaken binnen het seizoen in één transactie. Een ongeldige datum voorkomt de hele reeks; dedupe maakt retries veilig.

**Relatie:** P06 Jaaragenda; P07 Wedstrijden; P22 Instellingen. Proces R03.

### P12.F12 — Verenigingsuren aanvragen

Vraag minuten per plaats vooraf aan. Voor fluiten/grensrechter is eerst inhoudelijk akkoord van wedstrijdzaken nodig, daarna goedkeuring van vrijwilligerscommissie; geen achteraf opgehoogde booking.

**Relatie:** P08 Planbord; P09 Huishoudens; P19 Rapportages; P20 Vrijwilligerspot. Proces R03.

### P12.F13 — Teamdoel per seizoen

De teamouder stelt een heel aantal taken per lid in, 0–100. Dit wijzigt nooit het huishoudelijke verenigingsurendoel.

**Relatie:** P04 Gezinsagenda; P09 Huishoudens; P22 Instellingen. Proces R04, R21.

### P12.F14 — Individuele doelafwijking

Leg een afwijkend aantal en reden vast voor precies dit lid/team/seizoen. Beperk inzage in gevoelige redenen; nul is geldig.

**Relatie:** P04 Gezinsagenda; P13 Mijn acties; P22 Instellingen. Proces R04.

### P12.F15 — Voortgang per lid

Scheid uitgevoerd, ingepland, toegewezen, nog te organiseren en werkelijk uitgevoerde taakduur. Eén uitvoering telt voor één gekozen lid; taakduur en urenkrediet kunnen verschillen.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P19 Rapportages. Proces R02, R03, R17.

### P12.F16 — Huishoudvoortgang van team

Toon minimale relevante bevestigd/gepland/resterend/dekkingsstatus per uniek huishouden. Toon geen financiële gegevens, diagnoses of vrijstellingsredenen aan teamouders.

**Relatie:** P09 Huishoudens; P04 Gezinsagenda; P20 Vrijwilligerspot.

### P12.F17 — Slim verdeelvoorstel

Rangschik geschikte huishoudens op duur en totale seizoenbelasting over alle teams, doelruimte, leeftijd, kwalificatie, beschikbaarheid, voorkeur en zachte wedstrijdwaarschuwing. Het is uitlegbaar advies, geen automatisch besluit.

**Relatie:** P23 Mijn profiel en intake; P17 Opleidingen; P04 Gezinsagenda; P09 Huishoudens. Proces R04.

### P12.F18 — Voorstel aanpassen en bevestigen

Pas het voorgestelde lid per plaats aan, sla lege plaatsen over en bevestig atomair met versiechecks. Virtuele checks voorkomen één geschikte persoon op twee gelijktijdige plaatsen; er wordt nog geen uitvoerder geboekt.

**Relatie:** P13 Mijn acties; P04 Gezinsagenda; P03 Mijn taken. Proces R04.

### P12.F19 — Deadlines en escalatie

Opvolging kent zelfinschrijving, teamouderverdeling en commissiehulp. Stel opeenvolgende deadlines vóór de eerste taakdatum in; unresolved betekent dat de uitvoerder nog ontbreekt, ook na lidtoewijzing.

**Relatie:** P13 Mijn acties; P14 Berichten; P08 Planbord. Proces R06.

### P12.F20 — Passende reservepool benaderen

Na teamdeadline kan de commissie geschikte vrijwillige reserves uit dat team benaderen, eenmaal per afspraak/lokale dag. Een uitnodiging opent alleen toegestane vrije plaatsen en is geen booking.

**Relatie:** P23 Mijn profiel en intake; P14 Berichten; P13 Mijn acties. Proces R06.

### P12.F21 — Overdracht voorbereiden en aannemen

Bewaar een notitie en vijf controles, kies een volgende volwassen bevoegde contactpersoon en zet een versie klaar. Huidige teamouder blijft actief tot de opvolger exact die versie accepteert; behoud andere teamouders, doelen, taken en uren.

**Relatie:** P13 Mijn acties; P14 Berichten; P22 Instellingen; P09 Huishoudens. Proces R17.

### P12.F22 — Feedback en instructie verbeteren

De teamouder ziet praktische feedback voor eigen teamtaken en kan een instructie verbeteren, optioneel voor toekomstige taken van hetzelfde type en team. Uren en bookings worden niet herschreven.

**Relatie:** P16 Waardering; P23 Mijn profiel en intake; P18 Vrijwilligersfuncties; P03 Mijn taken. Proces R16.

**Demo → staging:** De huidige domeinhelpers demonstreren de keten en hebben tests, maar opslag en rollen zijn lokaal. Goedkeuring door wedstrijdzaken gebruikt in de demo nog een centrale beheerknop; staging vereist het echte afzonderlijke mandaat. Nieuwe gesloten-markt-urengoedkeuring is een expliciet addendum op de oudere canon, met behoud van één uitvoeringsbron.

**Pagina-acceptatie:** A12, A13, A14, A27, A30, T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T16, T17, T18, C01, C02, C03, C04, C05, C06, C07, C08, C09, C11, O06, O10, V12. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P13 — Mijn acties

**Prototype-route:** `acties`. **Bron:** coordination-workspace.tsx, coordination-domain.ts, collaboration.tsx.

**Wie gebruikt dit:** Eigen acties en toegestane taak-, team- en commissieverantwoordelijkheden.

**Tabbladen/weergaven:** Volgende stappen; Persoonlijke kanbankaarten.

### P13.F01 — Volgende stappen berekenen

Toon uit actuele bronnen wie nog een uitvoerder moet kiezen, plaatsen moet verdelen, vervanging moet regelen, uitvoering moet controleren, feedback kan geven of overdracht moet lezen.

**Relatie:** P12 Teams; P03 Mijn taken; P16 Waardering; P04 Gezinsagenda. Proces R06, R14, R18.

### P13.F02 — Acties ordenen en ontdubbelen

Prioriteit en deadline komen uit dezelfde bronversie; één gebeurtenis met meerdere rolroutes maakt geen dubbele actie. Afgehandelde bron verdwijnt uit open acties.

**Relatie:** P14 Berichten; P12 Teams; P11 Kanbanborden.

### P13.F03 — Direct uitvoerder kiezen

Open het bestaande boekingsvenster voor de specifieke allocation. Hercontroleer rechten en versie voordat de gekozen uitvoerder wordt opgeslagen.

**Relatie:** P12 Teams; P04 Gezinsagenda; P03 Mijn taken.

### P13.F04 — Direct vervanging verdelen

Open toewijzing voor precies de betreffende teamplaats. Laat de oorspronkelijke bevestigde afspraak staan totdat de overname is voltooid.

**Relatie:** P12 Teams; P03 Mijn taken; P14 Berichten.

### P13.F05 — Uitvoering controleren

Open persoon, taakdatum en credits, en kies Uitvoering bevestigen of Niet verschenen binnen het juiste mandaat. Alleen na uitvoering kan een definitief resultaat ontstaan.

**Relatie:** P03 Mijn taken; P12 Teams; P09 Huishoudens; P20 Vrijwilligerspot.

### P13.F06 — Teamstap openen

Ga naar het juiste team en tabblad Slim verdelen, Opvolging of Overdracht. Gebruik herlaadbare deeplinks; een link verleent geen rechten.

**Relatie:** P12 Teams; P14 Berichten. Proces R17.

### P13.F07 — Persoonlijke kaarten

Toon en beheer eigen toegestane kanbanopdrachten via het gedeelde bordmodel. Kaartafronding kan geen urenactie afsluiten of teamtelling opleveren.

**Relatie:** P11 Kanbanborden; P10 Commissies; P19 Rapportages. Proces R12.

**Demo → staging:** De huidige NextActions toont de zes uitbreidingen. Canonacties voor beleid, uitzonderingen, wintercontrole, opleidingen en financiën moeten via dezelfde actieprojectie worden aangesloten; geen tweede los takenlijstmodel.

**Pagina-acceptatie:** A24, A27, A29, T04, C02, C05, C06, C08, V13. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P14 — Berichten

**Prototype-route:** `berichten`. **Bron:** collaboration.tsx.

**Wie gebruikt dit:** Gesprekken alleen voor deelnemers met bronrecht; inbox en voorkeuren per persoon/account.

**Tabbladen/weergaven:** Gesprekken; Meldingen; Voorkeuren.

### P14.F01 — Gesprekskanaal kiezen

Open toegestane commissie-, team- en coordinatorgesprekken. Dynamische memberships vervangen de demokanaallijst; een oud teamoudermandaat geeft na intrekking geen toegang.

**Relatie:** P10 Commissies; P12 Teams; P22 Instellingen.

### P14.F02 — Bericht plaatsen

Plaats tekst onder de geverifieerde actor met tijd en kanaal. Een retry maakt geen dubbele post; bewerk/verwijder binnen vastgelegde regels en historie.

**Relatie:** P10 Commissies; P12 Teams; P13 Mijn acties.

### P14.F03 — Gerichte mention

Resolve een genoemde persoon met bronrecht en maak één persoonlijke intent. Geen algemene notificatie voor iedere tekst met @ en geen lek uit een besloten gesprek.

**Relatie:** P11 Kanbanborden; P13 Mijn acties.

### P14.F04 — Persoonlijke inbox

Toon alleen meldingen voor de actor over bookings, acties, wijzigingen, teamdeadlines, reserves, feedback en overdracht. Bronrechten worden bij verzending en openen getoetst.

**Relatie:** P03 Mijn taken; P12 Teams; P15 Beleid & afspraken; P16 Waardering. Proces R06, R12, R17.

### P14.F05 — Openen en gelezen markeren

Open het doelobject en markeer de eigen ontvangerstatus gelezen. Alles gelezen raakt uitsluitend eigen zichtbare inboxitems.

**Relatie:** P00 Algemene werkruimte en toegang; P13 Mijn acties; P12 Teams.

### P14.F06 — Persoonlijke meldingsvoorkeuren

Sla e-mail- en pushvoorkeuren per ontvanger/categorie op; in de demo wijzigen ze globale settings. Essentiële bevestigingen en veiligheidsinformatie volgen hun aparte regels.

**Relatie:** P21 Communicatie; P22 Instellingen; P02 Takenmarkt. Proces R15.

### P14.F07 — Echte verzending en logstatus

Inbox ontstaat uit domain-events; workers leveren mail/push via versiegebonden templates en outbox. Toon queued, accepted, delivered, failed of unknown eerlijk; lokale toast betekent niet verstuurd.

**Relatie:** P21 Communicatie; P22 Instellingen; P13 Mijn acties. Proces R13, R15.

**Demo → staging:** Taskdigest: maximaal één nieuwe-takenmail per persoon/lokale dag. Push: per nieuwe passende taak, geen dagelijks maximum. Bookingbevestigingen, ziekte en belangrijke wijzigingen worden niet door die mailcap geblokkeerd.

**Pagina-acceptatie:** A20, A21, A25, C06, C07, C08, O04, O05, O06, V14. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P15 — Beleid & afspraken

**Prototype-route:** `beleid`. **Bron:** governance.tsx.

**Wie gebruikt dit:** Eigen geselecteerde leden; publiceren/beoordelen volgens expliciet beleidmandaat.

**Tabbladen/weergaven:** Mijn afspraken; Acceptatieoverzicht (beheer); Versiehistorie.

### P15.F01 — Actueel beleid aanbieden

Toon de exacte geldende tekstversie, ingangsdatum en individuele acceptatiestatus. Bewaar een assignment per doelgroeplid, ook bij gezamenlijke huishouduitleg.

**Relatie:** P09 Huishoudens; P13 Mijn acties; P22 Instellingen. Proces R14, R21.

### P15.F02 — Lezen en downloaden

Open de exacte tekst en download dezelfde versie. Registratie van geopend is geen akkoord en blokkeert geen toegang tot ziekte- of belangrijke informatie.

**Relatie:** P14 Berichten; P03 Mijn taken. Proces R14.

### P15.F03 — Eigen actief akkoord

Een niet aangevinkte checkbox en expliciete bevestiging registreren actor, capaciteit, lid, timestamp en versiehash. Geen stil akkoord na openen of login.

**Relatie:** P23 Mijn profiel en intake; P22 Instellingen; P09 Huishoudens. Proces R14.

### P15.F04 — Kinderen vertegenwoordigen

Selecteer expliciet de vertegenwoordigde leden en controleer geldige guardian_authorization. Registreer ieder akkoord apart in één atomaire batch; dossierlidmaatschap alleen is onvoldoende.

**Relatie:** P09 Huishoudens; P23 Mijn profiel en intake. Proces R14.

### P15.F05 — Vraag stellen

Open een beleidsvraag met praktische tekst; de bevoegde commissie volgt op. Pauzeer alleen de betrokken herinnering, geen taken of ziekmeldroute.

**Relatie:** P13 Mijn acties; P14 Berichten; P09 Huishoudens. Proces R14.

### P15.F06 — Nieuwe versie publiceren

Publiceer titel, versie, tekst en ingangsdatum als immutable bron. Behoud alle oude acceptaties en maak nieuwe assignments/heracceptaties volgens besluit.

**Relatie:** P21 Communicatie; P22 Instellingen; P13 Mijn acties. Proces R14.

### P15.F07 — Herinnering sturen

Stuur doelgroepgerichte herinneringen via outbox, met dedupe en respect voor open vragen. Laat echte verzendstatus zien.

**Relatie:** P14 Berichten; P21 Communicatie. Proces R14.

### P15.F08 — Versiehistorie raadplegen

Toon vorige teksten en relevante eigen acceptaties. Herschrijf een eerder akkoord nooit naar de nieuwste tekst.

**Relatie:** P09 Huishoudens; P22 Instellingen.

**Demo → staging:** De demo controleert ouderschap beperkt en registreert geopend vooral in audittekst. Het bestaande backend heeft policy_versions, assignments, questions, acceptances en concrete RPC’s; sluit die aan.

**Pagina-acceptatie:** A22, A23, C05, V15. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P16 — Waardering

**Prototype-route:** `waardering`. **Bron:** governance.tsx, coordination-panels.tsx.

**Wie gebruikt dit:** Publieke momenten volgens toestemming; private lief-en-leed en feedback alleen voor bevoegde verantwoordelijke.

**Tabbladen/weergaven:** Alle momenten; Lief & leed (beheer); Afgerond.

### P16.F01 — Momenten van aandacht

Toon verjaardag, jubileum, bedanken, afscheid, opleiding en lief en leed met eigenaar, budget en status. Onbekende geboortedatum of lidmaatschapsstart geeft geen verzonnen gelegenheid.

**Relatie:** P17 Opleidingen; P18 Vrijwilligersfuncties; P22 Instellingen.

### P16.F02 — Nieuw waarderingsmoment

Vul gelegenheid, datum, persoon, eigenaar, zichtbaarheid en budget in. Een unieke gelegenheid voorkomt dubbele acties via meerdere commissies.

**Relatie:** P11 Kanbanborden; P20 Vrijwilligerspot; P21 Communicatie. Proces R19.

### P16.F03 — Waarderingsactie afronden

Registreer de concrete afronding en werkelijke budgetpost via bevoegdheid. Een afgeronde actie mag niet door een later conceptbericht weer Open worden.

**Relatie:** P20 Vrijwilligerspot; P13 Mijn acties; P11 Kanbanborden. Proces R19.

### P16.F04 — Conceptbericht maken

Maak eenmaal een gekoppeld concept via de juiste template en zichtbaarheid. Echt versturen volgt beoordeling en outbox; lief-en-leedtekst komt niet in algemene previews.

**Relatie:** P21 Communicatie; P14 Berichten. Proces R19.

### P16.F05 — Persoonlijke terugblik

De uitvoerder of toegestane vertegenwoordiger deelt twee antwoorden over opnieuw doen en duidelijke uitleg, plus optionele praktische toelichting na bevestiging.

**Relatie:** P03 Mijn taken; P04 Gezinsagenda; P12 Teams. Proces R16.

### P16.F06 — Voorkeur zelf onthouden

Alleen de uitvoerder kan een positieve terugblik toevoegen aan diens eigen taakvoorkeuren. Namens een huishouden feedback geven wijzigt niet andermans persoonlijke intake.

**Relatie:** P23 Mijn profiel en intake; P02 Takenmarkt; P12 Teams. Proces R16.

### P16.F07 — Feedback-inbox beheren

De verantwoordelijke commissie of teamouder ziet feedback binnen eigen scope, inclusief namens wie gegeven. Geen tenantbrede feedbacklijst voor iedere teamouder.

**Relatie:** P12 Teams; P10 Commissies; P13 Mijn acties. Proces R16.

### P16.F08 — Instructie en vervolgaanbod

Verbeter maximaal de toegestane taak-/type-instructie, optioneel toekomstige taken in dezelfde scope. Een positieve terugblik verwijst naar vrijwilligersfuncties; beide veranderen geen bestaande credits.

**Relatie:** P02 Takenmarkt; P12 Teams; P18 Vrijwilligersfuncties; P23 Mijn profiel en intake. Proces R16.

**Demo → staging:** Feedback is praktische verbetering en geen beoordelingsscore of automatische vrijstelling. Correcte rol/ACL geldt ook voor individuele commentaren, exports en notificaties.

**Pagina-acceptatie:** A28, C10, C11, V16. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P17 — Opleidingen

**Prototype-route:** `opleidingen`. **Bron:** governance.tsx.

**Wie gebruikt dit:** Eigen deelname en certificaten; beheer en verificatie met opleidings-/kwalificatiemandaat.

**Tabbladen/weergaven:** Opleidingen; Maatjes & reservepool; Kwalificaties.

### P17.F01 — Opleidingsaanbod

Toon cursussen met tijd, locatie, capaciteit en doelgroep. Een cursus is een agenda-/opleidingsbron, geen verenigingstaak met automatische uren.

**Relatie:** P06 Jaaragenda; P16 Waardering; P23 Mijn profiel en intake.

### P17.F02 — Inschrijven en afmelden

Reserveer een unieke cursusplaats atomair en meld gecontroleerd af. De laatste plek heeft één winnaar bij gelijktijdige inschrijving.

**Relatie:** P14 Berichten; P06 Jaaragenda. Proces R18.

### P17.F03 — Geverifieerd certificaat vastleggen

Bevoegd beheer kiest persoon, type en geldigheid. Inschrijving alleen maakt geen certificaat; bewijs wordt privé opgeslagen indien nodig.

**Relatie:** P02 Takenmarkt; P12 Teams; P22 Instellingen. Proces R04, R18.

### P17.F04 — Buddy en reservebereidheid

Toon benodigde begeleiding en vrijwillige reservebereidheid binnen beperkte scope. Een buddy moet bij de echte booking beschikbaar en gekwalificeerd zijn.

**Relatie:** P23 Mijn profiel en intake; P02 Takenmarkt; P12 Teams.

### P17.F05 — Verval en toekomstige afspraken

Controleer certificaatgeldigheid op uitvoeringsdatum; verval maakt opvolging voor betrokken bookings. Verwijder geen afspraak stil en biedt opleiding of geschikte vervanging.

**Relatie:** P13 Mijn acties; P03 Mijn taken; P12 Teams; P14 Berichten. Proces R18.

**Demo → staging:** De demo heeft seat toggles en lokale certificaten. Sluit existing courses, sessions, enrollments, qualifications en booking-impacttabellen aan met serverchecks.

**Pagina-acceptatie:** A27, C01, V17. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P18 — Vrijwilligersfuncties

**Prototype-route:** `vacatures`. **Bron:** people.tsx.

**Wie gebruikt dit:** Eigen interesse; kandidaten en erkenning alleen binnen wervings-/commissiemandaat.

### P18.F01 — Vaste functies verkennen

Toon rol, commissie, inzetomschrijving, beschikbare functie en eventuele vrijstelling na formele erkenning. Interesse is nog geen aanstelling.

**Relatie:** P09 Huishoudens; P22 Instellingen; P23 Mijn profiel en intake. Proces R16.

### P18.F02 — Functie openen

Open de volledige toelichting en selectievoorwaarden in de bestaande dialoog. Toon alleen de eigen interesse of de bevoegde kandidatenlijst.

**Relatie:** P10 Commissies; P23 Mijn profiel en intake.

### P18.F03 — Interesse aangeven

Kies de eigen toegestane persoon en registreer één actieve interesse per vacature. Maak een opvolgactie en passende bevestiging, zonder rechten of uren toe te kennen.

**Relatie:** P13 Mijn acties; P14 Berichten; P16 Waardering. Proces R10.

### P18.F04 — Kennismaking opvolgen

Bevoegd beheer registreert de kennismakingsstap en uitkomst. Kandidatengegevens zijn beperkt zichtbaar en worden niet aan alle leden getoond.

**Relatie:** P10 Commissies; P13 Mijn acties. Proces R10.

### P18.F05 — Erkende aanstelling verbinden

Na formeel besluit sluit de nieuwe aanstelling aan op de rolcatalogus, expliciete huishouddekking en jaarlijkse herbevestiging. Een systeemmandaat blijft een afzonderlijke aanvraag.

**Relatie:** P09 Huishoudens; P22 Instellingen; P20 Vrijwilligerspot.

**Demo → staging:** De demo kan aanvragen van andere personen in de functiekaart tonen. Op staging zijn kandidaatlijsten private; gebruik existing vacancies, vacancy_interests en appointment_cases.

**Pagina-acceptatie:** A27, V18. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P19 — Rapportages

**Prototype-route:** `rapportages`. **Bron:** governance.tsx.

**Wie gebruikt dit:** Verenigingsrapporten door commissie/bestuur binnen scope; financiële exports apart recht.

### P19.F01 — Huishouduren en resterende inzet

Bereken uitgevoerd/bevestigd/gepland/pending/resterend per distinct seizoensverplichting. Teammeters lezen hetzelfde resultaat maar mogen het niet opnieuw optellen.

**Relatie:** P09 Huishoudens; P04 Gezinsagenda; P12 Teams; P20 Vrijwilligerspot. Proces R01, R08, R21.

### P19.F02 — Commissiebezetting

Bereken daadwerkelijk beschikbare capaciteit en bezetting in de gekozen periode met openbare, gereserveerde en bevestigde plaatsen apart. Geannuleerde taken tellen niet als aanbod.

**Relatie:** P08 Planbord; P02 Takenmarkt; P12 Teams.

### P19.F03 — Winteroverzicht

Toon echte wintergrens, effectief winterdoel, uitgevoerd vóór grens en gedekte allocaties. Open controlezaken krijgen herkenbare status en kunnen nog geen definitieve claim opleveren.

**Relatie:** P09 Huishoudens; P03 Mijn taken; P20 Vrijwilligerspot. Proces R09.

### P19.F04 — Passend aanbod beoordelen

Toon boekbare plaatsen per toegestane uitvoerder met leeftijd, kwalificatie, beschikbaarheid en termijnen. Bewaar een reproduceerbare aanbodsnapshot voor afkoop/tekortbeoordeling.

**Relatie:** P23 Mijn profiel en intake; P17 Opleidingen; P02 Takenmarkt; P20 Vrijwilligerspot. Proces R20.

### P19.F05 — Overbelasting signaleren

Vergelijk taakduur over alle teams in de juiste periode met vrijwillig opgegeven gewenste maandinzet. Gebruik het als gesprekssignaal, geen automatische sanctie.

**Relatie:** P12 Teams; P23 Mijn profiel en intake; P16 Waardering.

### P19.F06 — CSV-export en bronstatus

Exporteer de toegestane projectie met periode, seizoen, revisie en kolomdefinities. Verborgen privévelden mogen niet via CSV alsnog beschikbaar zijn.

**Relatie:** P09 Huishoudens; P20 Vrijwilligerspot; P22 Instellingen.

**Demo → staging:** De huidige pagina heeft geen uitgebreid filterpaneel. Een productieperiode-/seizoenkeuze is nodig voor juiste cijfers en moet de huidige stijl volgen. Hardgecodeerde datums, vaste winterbalkschaal en aanbod zonder kwalificatietoets zijn demogaps.

**Pagina-acceptatie:** A01, A02, A03, A26, A30, T03, T07, T08, T16, F01, F03, O10, V19. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P20 — Vrijwilligerspot

**Prototype-route:** `financien`. **Bron:** governance.tsx.

**Wie gebruikt dit:** Financieel beheer met expliciet mandaat; commissie besluit de grondslag, geen vrije wijziging door cliënt.

**Tabbladen/weergaven:** Vrijwilligerspot; Seizoensafrekening; Financiële afspraken.

### P20.F01 — Potstand en beschikbaar budget

Toon werkelijk ontvangen inkomsten, uitgaven, reserveringen en beschikbaar budget in gehele centen. Open facturen zijn vorderingen, geen ontvangen geld.

**Relatie:** P16 Waardering; P19 Rapportages; P09 Huishoudens. Proces R19, R20.

### P20.F02 — Budgetpost toevoegen

Vul titel, bedrag en type in voor ontvangst, uitgave of reservering binnen recht. Bewaar eigenaar, doel, goedkeuring en onveranderlijke correctieroute.

**Relatie:** P16 Waardering; P11 Kanbanborden; P22 Instellingen. Proces R19.

### P20.F03 — Afrekenvoorstel berekenen

Bereken ontbrekende bevestigde minuten onder effectief doel en dekking. Het standaardtarief blijft 15000/720 cent per minuut, ook bij een verminderd doel; rond het eindtotaal eenmaal af.

**Relatie:** P09 Huishoudens; P19 Rapportages; P03 Mijn taken; P22 Instellingen. Proces R01, R09, R10, R20.

### P20.F04 — Blokkades en onderbouwing

Toon pending uitvoering, bezwaar, open uitzonderingen/rol-/huishoudwijziging, ontbrekend passend-aanbodbesluit en bestaande afkoop/claim. Finaliseren hercontroleert deze bronnen onder dezelfde lock.

**Relatie:** P09 Huishoudens; P13 Mijn acties; P19 Rapportages. Proces R08, R20.

### P20.F05 — Goedkeuren en definitief verwerken

Vereiste onafhankelijke beoordeling maakt een revisiegebonden grondslag. Financieel beheer finaliseert één actieve financiële verwerking per verplichting/seizoen; geen directe Approved-knop op clientstate.

**Relatie:** P09 Huishoudens; P13 Mijn acties; P22 Instellingen. Proces R08, R20.

### P20.F06 — Afkoop onderscheiden

Een volledige goedgekeurde afkoop is één afspraak van 15000 cent. Geen tweede tekortfactuur of extra betalingsclaim voor hetzelfde seizoen; bestaande betaalde claim vraagt expliciete verrekening/correctie.

**Relatie:** P09 Huishoudens; P19 Rapportages.

### P20.F07 — Betaalstatus registreren

Markeer een gecontroleerde ontvangst met bewijs/referentie en dedupekey. Een dubbele klik, import of webhook kan de pot niet twee keer verhogen.

**Relatie:** P14 Berichten; P19 Rapportages; P22 Instellingen. Proces R20.

### P20.F08 — Onbetaalde en betaalde correcties

Onbetaalde afspraak kan met reden worden gevoid of herzien, zonder verwijderen. Betaalde correctie maakt credit/verrekening/refundadministratie; behoud de oorspronkelijke ontvangen post.

**Relatie:** P09 Huishoudens; P03 Mijn taken; P22 Instellingen. Proces R20.

### P20.F09 — Financiële export

Maak gecontroleerde factuur- of exportbasis met bronrevisie en status. Bewaar exports privé; huidige scope vereist geen automatische PSP-koppeling om functioneel te kunnen afrekenen.

**Relatie:** P19 Rapportages; P09 Huishoudens; P21 Communicatie.

**Demo → staging:** De demo rekent met floating point euro’s en wijzigt lokale invoice-status. De repo heeft financiële assessment/processing/correction/fund-RPC’s; gebruik die en bewijs concurrency met uren- en bezwaartransacties.

**Pagina-acceptatie:** A26, T17, T18, F01, F02, F03, V20. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P21 — Communicatie

**Prototype-route:** `templates`. **Bron:** management.tsx.

**Wie gebruikt dit:** Templatebeheer volgens centrale/commissierechten; voorkeuren en ontvangers volgens bron-ACL.

**Tabbladen/weergaven:** Templates: Bewerken/Voorbeeld; Verzendregels; Segmenten; Verzendlog.

### P21.F01 — Template kiezen en versie lezen

Toon kanaal, categorie, status en versie voor e-mail, push en inbox. Een gepubliceerde versie blijft immutable; edit maakt een nieuw concept.

**Relatie:** P14 Berichten; P15 Beleid & afspraken; P16 Waardering. Proces R15.

### P21.F02 — Template bewerken

Bewerk onderwerp, preheader, afzender, reply-to, inhoud, knoplabel/link en toegestane variabelen. Wijzigingen staan in concept en raken geen eerder verzonden berichten.

**Relatie:** P22 Instellingen; P14 Berichten.

### P21.F03 — Variabelen invoegen

Gebruik een allowlist en veilige contextescaping. Ondersteun de zichtbare term verenigingstaak en behoud oude dienst-variabele als versiegebonden compatibiliteitsalias.

**Relatie:** P02 Takenmarkt; P03 Mijn taken; P14 Berichten.

### P21.F04 — Persoonlijke preview

Kies een geautoriseerde testpersoon en context voor preview; toon ontbrekende waarden en veilige fallbacks. Gebruik geen echte privé-intake in algemene voorbeeldmails.

**Relatie:** P23 Mijn profiel en intake; P09 Huishoudens.

### P21.F05 — Test versturen

Verstuur een echte gecontroleerde test naar expliciet geselecteerd staging-testadres via de provider/outbox. Bewaar resultaat; een toast zonder verzending is geen geslaagde test.

**Relatie:** P14 Berichten; P22 Instellingen.

### P21.F06 — Goedkeuren en publiceren

Valideer variabelen, kanalen, links en verplichte test. Bevoegd akkoord publiceert een bevroren versie en registreert actor/hash.

**Relatie:** P15 Beleid & afspraken; P14 Berichten; P22 Instellingen. Proces R15, R19.

### P21.F07 — Dupliceren en nieuw template

Maak een nieuw concept van een bestaande versie of start met naam, kanaal en categorie. Publicatie blijft een afzonderlijke gecontroleerde stap.

**Relatie:** P10 Commissies; P16 Waardering; P15 Beleid & afspraken.

### P21.F08 — Automatische regels

Stel digest, push en bookingreminders centraal in. Nieuwe-takenmailcap en essentiële transactionele categorieën blijven gescheiden; jobs lezen versiegebonden regels.

**Relatie:** P14 Berichten; P02 Takenmarkt; P03 Mijn taken; P22 Instellingen. Proces R15.

### P21.F09 — Segment samenstellen

Filter geautoriseerde ontvangers op taakvoorkeur/talent binnen mandaat. Opgeslagen segment geeft geen recht op nieuwe privévelden of besloten teams.

**Relatie:** P23 Mijn profiel en intake; P18 Vrijwilligersfuncties; P16 Waardering.

### P21.F10 — Campagneconcept maken

Gebruik een segment en template voor een gecontroleerd campagneconcept. Preview en verstuurbevestiging tonen werkelijke doelgroepomvang en staging-allowlist.

**Relatie:** P14 Berichten; P22 Instellingen.

### P21.F11 — Verzendlog

Lees outbox, attempts en provider-events met dedupekeys en status. Het auditlog is aanvullend en geen bewijs dat mail of push is afgeleverd.

**Relatie:** P14 Berichten; P13 Mijn acties; P22 Instellingen. Proces R15.

**Demo → staging:** De eigen variabeleknop maakt nu {{verenigingstaak}} terwijl de renderer {{dienst}} verwacht. Corrigeer de alias/validatie. E-mail, push en tests zijn momenteel gesimuleerd; workers en echte providerstatus moeten aansluiten.

**Pagina-acceptatie:** A20, A21, O05, V21. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P22 — Instellingen

**Prototype-route:** `instellingen`. **Bron:** management.tsx, team-workspace.tsx.

**Wie gebruikt dit:** Beheer volgens afzonderlijke configuratie-, rechten- en integratiemandaten; financiële regels met besluit.

**Tabbladen/weergaven:** Vereniging; Uren & termijnen; Rollen & vrijstelling; Sportlink & import; Toegang & PWA; Seizoensovergang; Wijzigingslog.

### P22.F01 — Standaard verdelingswijze

Kies vrije verenigingsmarkt of toewijzing aan team. De keuze is een standaard voor nieuwe verenigingstaken; bestaande allocations en bookings blijven bestaan.

**Relatie:** P08 Planbord; P12 Teams; P02 Takenmarkt.

### P22.F02 — Vereniging en seizoen

Bewaar clubnaam, seizoen, begin/einde en wintergrens als gevalideerde configuratieversie. Tenant-ID en Auth-omgeving zijn geen vrij invulbare presentatiekeuze.

**Relatie:** P00 Algemene werkruimte en toegang; P09 Huishoudens; P19 Rapportages.

### P22.F03 — Uren en financiële basis

Stel standaardjaardoel, winterpercentage en bijdrage in met ingangsdatum/besluit. Bestaande verplichtingen en financiële snapshots veranderen niet zonder expliciete herbeoordeling.

**Relatie:** P09 Huishoudens; P19 Rapportages; P20 Vrijwilligerspot.

### P22.F04 — Termijnen en reminders

Beheer afmelden, uitvoeringsbevestiging, bezwaar en herinneringen. Een booking bewaart zijn eigen afmeldafspraak; wijziging van instellingen herschrijft die niet.

**Relatie:** P03 Mijn taken; P14 Berichten; P21 Communicatie.

### P22.F05 — Vrijwilligersrolcatalogus

Maak of versieer rollen met huishouddekking. Erkenning bewaart de toen geldende rolversie; een checkbox is geen retroactieve vrijstelling of systeemrecht.

**Relatie:** P09 Huishoudens; P18 Vrijwilligersfuncties; P20 Vrijwilligerspot. Proces R10.

### P22.F06 — Actieve rollen en einde

Toon aanstellingen en start een beoordeelde beëindiging. Jaarlijkse herbevestiging en mandaatverloop blijven afzonderlijke processen.

**Relatie:** P09 Huishoudens; P13 Mijn acties; P18 Vrijwilligersfuncties. Proces R10.

### P22.F07 — Sportlinkmomenten en status

Beheer twee lokale synctijden en geautoriseerde providerverbinding. Toon succes, fout, cursor/actualiteit en handmatige herstelactie. Demo succes/foutknoppen bestaan alleen in referentie/testmodus.

**Relatie:** P07 Wedstrijden; P13 Mijn acties; P14 Berichten. Proces R13.

### P22.F08 — Gecontroleerde CSV-import

Upload CSV, kies kolommen naam/e-mail/stabiel lidnummer, preview conflicten/fouten en bevestig. Parse quoted velden correct; match niet automatisch op e-mail of naam en verzin geen leeftijd.

**Relatie:** P09 Huishoudens; P23 Mijn profiel en intake; P07 Wedstrijden.

### P22.F09 — Toegang en verificatie

De OTP-demo is vervangen door bestaande Supabase Auth-flow met echte geverifieerde identiteit, eenmaligheid, verval, rate limiting en veilige terugkeer-URL.

**Relatie:** P00 Algemene werkruimte en toegang; P09 Huishoudens; P23 Mijn profiel en intake. Proces R11.

### P22.F10 — PWA installeren

Behoud installeerbare iconen/manifest en toegankelijke instructies voor het beginscherm. Cache geen privéresponse als publiek offlinebestand.

**Relatie:** P00 Algemene werkruimte en toegang; P14 Berichten.

### P22.F11 — Demogegevens herstellen

Herstel uitsluitend de geïsoleerde visuele fixture, met bevestiging. De knop verschijnt niet als vernietigende actie op echte staginggegevens.

**Relatie:** P00 Algemene werkruimte en toegang; P08 Planbord. Proces R22.

### P22.F12 — Seizoensovergang voorbereiden

Kies volgend seizoen en welke templates en herbevestigingen meegaan. Controleer open uren/casus/financiën, archiveer immutable snapshots en activeer nieuwe seizoensverplichtingen idempotent.

**Relatie:** P09 Huishoudens; P12 Teams; P15 Beleid & afspraken; P19 Rapportages; P20 Vrijwilligerspot; P23 Mijn profiel en intake. Proces R21.

### P22.F13 — Seizoensstanden raadplegen

Lees gearchiveerde doelen, uren, besluiten en teamtellingen met juiste historische toegang. Correcties op een oud seizoen volgen de herzieningsroute.

**Relatie:** P09 Huishoudens; P19 Rapportages; P20 Vrijwilligerspot. Proces R21.

### P22.F14 — Wijzigingslog

Toon geautoriseerde auditgebeurtenissen met feitelijke actor, vertegenwoordiging, bronversie en tijd. Geen OTP, token, secret of medische inhoud in logs.

**Relatie:** P09 Huishoudens; P11 Kanbanborden; P20 Vrijwilligerspot; P21 Communicatie. Proces R17.

**Demo → staging:** De huidige seizoensvoorbereiding maakt alleen een lokale archiefkopie en melding; opties worden nog niet uitgevoerd en nieuw seizoen wordt niet geactiveerd. De repo heeft close_season/rollover_season die moeten worden aangesloten.

**Pagina-acceptatie:** A06, A11, A19, A30, T06, T11, T14, C09, H01, H06, O05, O08, O09, O10, V22. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.

## P23 — Mijn profiel en intake

**Prototype-route:** `intake`. **Bron:** people.tsx.

**Wie gebruikt dit:** Eigen intake; vertegenwoordiging uitsluitend met concrete machtiging; gescheiden ouders houden onafhankelijke privacy.

**Tabbladen/weergaven:** Over jou; Talenten; Beschikbaarheid; Samenvatting.

### P23.F01 — Persoon en dossiercontext kiezen

Toon de eigen toegestane intake of specifiek gemachtigde persoon/context. Leeftijd 16+ of hetzelfde huishouden geeft geen automatisch recht op andermans antwoorden.

**Relatie:** P09 Huishoudens; P00 Algemene werkruimte en toegang; P15 Beleid & afspraken. Proces R11, R22.

### P23.F02 — Ervaring en begeleiding

Leg praktische ervaring, behoefte aan buddy en betrokkenheid vast. Een begeleidingsvraag maakt passend aanbod of opvolging, geen vrijstelling.

**Relatie:** P17 Opleidingen; P02 Takenmarkt; P13 Mijn acties.

### P23.F03 — Talenten en voorkeuren

Selecteer talenten, voorkeurstaken en interesse in structurele functies. Bewaar persoonsgegevens en voorkeuren in versiegebonden intake zonder ze als certificaat te behandelen.

**Relatie:** P02 Takenmarkt; P12 Teams; P18 Vrijwilligersfuncties; P21 Communicatie. Proces R10.

### P23.F04 — Beschikbaarheid en grenzen

Vul weekmomenten, gewenste maandinzet, verhinderdatums, praktische grenzen, leerwensen en vrijwillige reservebereidheid in. Vraag geen diagnose; verberg persoonlijke redenen voor teamouders.

**Relatie:** P12 Teams; P17 Opleidingen; P19 Rapportages; P14 Berichten. Proces R04.

### P23.F05 — Controleren en opslaan

De vier stappen eindigen in een samenvatting en expliciete opslag. Maak een intakeversie met feitelijke actor en vertegenwoordiging; herladen bewaart de servergegevens.

**Relatie:** P09 Huishoudens; P02 Takenmarkt; P22 Instellingen. Proces R11.

### P23.F06 — Jaarlijks herbevestigen en profiel openen

Een nieuw seizoen biedt bestaande antwoorden ter controle en registreert herbevestiging. Een verwijzing naar huishoudprofiel gebruikt dezelfde grants; intake verandert geen urendoel.

**Relatie:** P22 Instellingen; P09 Huishoudens; P04 Gezinsagenda. Proces R21.

**Demo → staging:** De demo schrijft een lokale persoonskopie weg en heeft geen complete onafhankelijke intake-ACL. Bestaande save_intake_revision, profile/granttabellen en assisted_member_actions zijn de basis. Behoud alle vier stappen en zichtbare velden.

**Pagina-acceptatie:** A07, A09, A10, A29, T17, C01, C07, C10, H03, O07, V23. De exacte functietestmapping wordt tijdens bouw ingevuld; een paginaproef is geen automatisch bewijs voor iedere functie.
