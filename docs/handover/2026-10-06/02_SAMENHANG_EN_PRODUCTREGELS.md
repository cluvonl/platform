# 02 — Samenhang, productregels en rechten

## De eenheid van werk

Een verenigingstaak is een geplande taak met concrete bezettingsplaatsen. Voorbeeld: bar op 10 oktober van 08:00 tot 11:00, drie plaatsen en 180 verenigingsminuten per bevestigde uitvoerder. De vrijwilligerscommissie kan een of meer vrije plaatsen uit een of meer taken als cluster aan een team reserveren. De plaats verdwijnt dan uit de boekbare openbare capaciteit, maar blijft dezelfde `shift_position`. Een teamouder wijst die plaats toe namens een teamlid; diens huishouden kiest de werkelijke uitvoerder. Een teamreservering, een lidtoewijzing, een booking en een uitvoeringsbevestiging zijn vier verschillende stappen.

Een eigen teamtaak, zoals fruit of bidons, krijgt een besloten markt en nul verenigingsminuten. Na de vereiste voorafgaande goedkeuring kan dezelfde concrete uitvoeringsplaats verenigingsminuten opleveren; de goedgekeurde snapshot geldt alleen voor een nieuwe afspraak. Scheidsrechter/grensrechter vragen eerst inhoudelijk akkoord van wedstrijdzaken en daarna uren-/publicatieakkoord van de vrijwilligerscommissie. Goedkeuring is geen uitvoering.

De teller voor teamtaken is een **aantal bevestigde plaatsen per gekozen teamlid/team/seizoen**. De huishoudteller is een **som bevestigde verenigingsminuten per expliciete seizoensverplichting**. Een korte en een lange taak kunnen elk één teamtaak tellen, terwijl taakduur wordt gebruikt voor eerlijk verdeeladvies. Een goedgekeurde taak kan beide tellers verhogen via één uitvoeringsbesluit; nooit twee keer dezelfde uren en nooit voor twee kinderen tegelijk.

## Expliciet addendum op de canon van 2 oktober

De oudere canon beschrijft de openbare marktroute voor goedgekeurde teamtaken. De latere gebruikersinstructies voegen een besloten teammarkt toe. Voor Cluvo geldt daarom: goedgekeurde marktopdracht kan openbaar óf teamgebonden zijn, met dezelfde inhoudelijke mandaten, vooraf vastgestelde minuten, booking-voorwaarden en uitvoeringscontrole. `publicatie` betekent beschikbaar binnen de goedgekeurde scope, niet automatisch beschikbaar voor ieder lid. De oorspronkelijke teamtaak als bronmetadata blijft nul minuten; de enige creditsbron is de verbonden shift/booking/attendance/ledgerroute.

De gebruiker vroeg daarnaast teamseizoensdoelen, individuele overrides, de zes hieronder beschreven verbeteringen en uitleg die na sluiten voor die gebruiker wegblijft. Deze uitbreidingen hebben geen automatische extra urendoelen, boetes, vrijstellingen of systeemrollen tot gevolg. Alle oorspronkelijke 28 canononderdelen en A01–A30 blijven in scope.

## Gedeelde gegevens en eigenaarschap

| Object | Bron/eigenaar | Afhankelijke functies |
|---|---|---|
| Account en sessie | Supabase Auth; geverifieerde actor | Iedere pagina, elke API/RPC, invites, acceptaties. |
| Persoon en actor–subjectmachtiging | Tenantpersoonsregister en grants | Intake, booker versus executor, beleid namens kind, telefonische hulp. |
| Huishouddossier | Expliciete dossierkoppelingen en ACL | Huishoudens, gezinsagenda, minimale teamvoortgang. |
| Seizoensverplichting | Beoordeeld dossier/seizoen, besluiten en coverage | Urenmeters, winterplanning, rapportages, afrekening. |
| Teamlidmaatschap | Seizoensgebonden team/persoonkoppeling | Teammarkt, teamdoel, gezinswedstrijden, teamouderbeheer. |
| Taak en versie | Commissie/type, tijden, voorwaarden/instructie | Markt, planbord, teammarkt, matchimpact, opleiding. |
| Concrete plaats | `shift_positions` met stabiele identiteit | Openbare booking, teamreservation, winterallocation, wachtlijstoffer. |
| Cluster en allocation | Commissie reserveert; teamouder verdeelt | Teamplanning, acties, opvolging, beschikbare capaciteit. |
| Booking | Toegestane uitvoerder + verplichting + snapshots | Mijn taken, gezinsagenda, presentie, overname, uren. |
| Uitvoeringsbesluit | Bevoegde actor en concrete booking | Ledger en teamtelling; feedback en correctie. |
| Urenledger | Append-only positieve post/tegenpost | Alle urenmeters, winterreview, financiële grondslag. |
| Teamdoel | Per seizoen/team en eventueel lid met reden | Voortgang per lid, advies, gezinsmeters, overdracht. |
| Taakervaring en instructieversie | Feedbackgever en verantwoordelijke scope | Feedback-inbox, toekomstig aanbod, instructieverbetering. |
| Domain-event en audit | Servercommand | Acties, inbox, outbox, bewijs; audit is geen verzendbewijs. |
| Provider-outboxstatus | Worker/providerreceipts | Verzendlog, retry, monitoring en eerlijke gebruikersmelding. |
| Gezien-uitleg | Account + stabiel help-onderwerp | Alle helpbanners, los van rol, seizoen en demoreset. |

## De zes verbeteringen als één proces

1. **Uitlegbaar verdelen:** geschiktheid is eerst een harde filter; de rangschikking gebruikt taakduur en totale huishoudbelasting over alle teams, doelruimte, voorkeuren en wedstrijdwaarschuwingen. Commissie kiest team; teamouder kiest lid. Een voorstel kan nooit uitvoerders boeken zonder huishoudakkoord. Virtuele matching maakt geen echte bookings.
2. **Gezinsagenda:** één tijdlijn voor eigen team- en verenigingstaken en wedstrijden, met aparte meters per kind en één huishoudstand. Wedstrijdoverlap is een zachte gezinswaarschuwing; dezelfde persoon dubbel boeken is een hard conflict.
3. **Concrete volgende acties:** afgeleid uit actuele bronstatus/mandaten, ontdubbeld en met veilige deeplink naar precies de vervolgstap. Geen los mutabel actieresultaat dat kan afwijken van de bron.
4. **Opvolging met deadlines:** zelfinschrijving → teamouder → commissie. Tijdgrenzen zijn lokale clubafspraken met expliciete inclusiviteit. Deadline verstreken annuleert geen booking. Toegewezen huishoudens mogen de uitvoerder nog bevestigen; passende reserve-uitnodiging blijft vrijwillig en doet geen stille booking.
5. **Overdracht:** notitie, vijf controles, opvolger, actuele versie en expliciet aannemen. De oude teamouder blijft tot acceptatie bevoegd; alleen diens mandaat eindigt, andere teamouders blijven. Taken, doelen, ledger en historie blijven bij het team.
6. **Ervaring en instructies:** na bevestigde uitvoering twee vragen en praktische toelichting. Feedback is geen urencorrectie. Alleen de uitvoerder kan de eigen voorkeur bijwerken; alleen de verantwoordelijke kan een nieuwe instructieversie publiceren.

### Exacte advieslogica uit de prototypebron

Het advies is deterministische domeinlogica, geen AI-koppeling. `coordination-domain.ts` bevat de reproduceerbare referentie. Na correctie van de genoemde dubbeltellings-/rechtengaps behoud Codex deze rankingbasis en verklaart ieder verschil.

- Geschikte uitvoerders: toegestane huishoudpersoon, geldige bookingchecks, niet verhinderd, leeftijd/kwalificatie geldig en beschikbare weekdag/periodenaam. Een lege beschikbaarheidslijst is in de demo geen expliciete blokkade. Ochtend = start vóór12:00, middag = start vóór18:00, anders avond. Staging legt onbekend/niet ingevuld en echte conflicten duidelijk uit en geeft de server de volledige intervalcontrole.
- Huishoudlast = werkelijk uitgevoerde taakduur + nog geplande taakduur + nog te bemensen toegewezen taakduur in dit seizoen, over alle teams. Creditminuten zijn daarvan los. Bij overname mag één plaats niet zowel als oude actieve booking als extra allocation worden gewogen.
- Lidkandidaat: voor meetellende teamtaken is er nog ruimte onder eigen effectief doel, en voor verenigingstaken met credits is de expliciete HH-urenplicht niet al voldaan. Er moet een geschikte uitvoerder mogelijk zijn; verplichte toewijzing wordt niet gebaseerd op alleen een naam.
- Lidscore (lager eerst) = `household_task_minutes + 30 × (completed + planned + assigned) + (match_warning ? 180 : 0) − (preference ? 20 : 0)`. Gelijke score sorteert op naam. Positieve eerdere feedback voor hetzelfde taaktype kan de aangegeven voorkeur ondersteunen, zonder de privé-intake te tonen.
- Verdeelvoorstel verwerkt onverdeelde gepubliceerde toekomstige plaatsen op datum in een tijdelijke kopie. Virtuele uitvoerderreserveringen bewaken dat één persoon niet twee gelijktijdige plaatsen krijgt. De echte commit hercontroleert alle gekozen lid/plaatscombinaties en verwijdert iedere virtuele booking; resultaat is uitsluitend een allocation-toewijzing.
- Teamscore (lager eerst) = gemiddelde seizoenlast per uniek teamhuishouden + `45 × household_match_warnings + 10000 × uncovered_positions + (suitable_households == 0 ? 20000 : 0)`. Coverage wordt via hetzelfde virtuele voorstel bepaald. Het scherm toont geschikte huishoudens, gemiddelde taakduur, passend aantal plaatsen en zachte wedstrijdwaarschuwingen, niet een verborgen prestatiebeoordeling.

De relevante doelcontrole volgt `countsForTeam` en de daadwerkelijke goedgekeurde credits; een taak die niet voor een doel meetelt mag door dat irrelevante doel niet worden geblokkeerd. Advies is vrijwillig te wijzigen, maar een aanpassing kan geen harde geschiktheids- of privacyregel omzeilen. Vrijwillig extra boeken blijft een aparte expliciete HH-handeling.

### Termijnen en filters uit de demo

Voor een cluster is de standaard selfUntil één dag vóór clusterdeadline, en assignUntil de clusterdeadline. Voor een losse teamtaak is selfUntil drie dagen vóór taakdatum en assignUntil één dag later. Zelfinschrijving is tot en met selfUntil; teamouderfase loopt tot en met assignUntil; daarna commissiehulp. Een rechtstreeks-verdeelcluster gaat direct naar teamouderfase. Serverdefaults worden gevalideerd vóór eerste taakdatum, zodat de huidige direct-teameditor geen ongeldige deadline op de taakdag kan maken.

De korte-taakfilter in de huidige takenmarkt gebruikt toegekende taakminuten met grens120. Dit is een bestaand creditfilter; maak de label/uitleg consistent en verander haar niet ongemerkt naar werkelijk verstreken duur wanneer de credits afwijken. De gezinswaarschuwing gebruikt eigen teamwedstrijden op dezelfde datum met start binnen het taakinterval; nieuwe werkelijk beschikbare wedstrijdduur kan een vollediger zachte intervalwaarschuwing mogelijk maken zonder een gezinswedstrijd als harde blokkade voor beide ouders te behandelen.

## Vaste rekenregels

De Duindorp-referentie gebruikt 720 minuten jaardoel en 360 vóór de wintergrens. Andere tenantconfiguratie is expliciet en versiegebonden. Meer inzet vóór winter telt volledig voor het hele jaar: 480 vóór + 240 na = 720, niet 720 plus een extra tweede-halfclaim. 720 vóór winter betekent volledig voldaan; extra inzet is vrijwillig. Winterplanning dekt alleen vastgesteld tekort binnen het jaardoel en linkt bestaande passende bookings zonder duplicatie. Open pending/bezwaar eerst beoordelen.

Vrijstelling door erkende structurele inzet dekt het expliciet gekoppelde huishouden/de verplichting en voegt geen uren toe. Individuele vermindering of splitsing vraagt een gemotiveerd besluit met onafhankelijke reviews. Een rolcataloguswijziging of einde aanstelling verandert geen historische snapshot zonder beoordeling. Een extra account, intake of tweede team creëert geen tweede 720-minutenclaim. Bij een werkelijk nieuw dossier beoordeelt de commissie expliciet of er een gedeelde uitvoerings-/voortgangskoppeling of een nieuwe verplichting ontstaat.

Urenstand = som geldige ledger-delta's voor de gekozen verplichting/seizoen. Gepland en pending zijn aparte projecties; betwist geeft een afrekenblokkade en een zichtbare status. No-show geeft normaal nul minuten. Een correctie houdt de oorspronkelijke attendance/urenpost en voegt een nieuwe beslissing en eventuele tegenpost toe. Alleen de concrete casus wordt afgesloten; overige blockers worden afgeleid uit hun bronnen.

Standaardbijdrage = 15000 cent, standaarddoel = 720 minuten. Tekortvoorstel = `round(missing_minutes × 15000 / 720)` met één eindafronding. 180 ontbrekend = €37,50; 20 ontbrekend = €4,17. Verminderd doel 480 en bevestigd 360 geeft €25,00, zonder het tarief naar €150/8 uur te verhogen. Geldige volledige dekking geeft nul. Goedgekeurde afkoop is eenmaal €150,00 en geen extra tekortclaim. Geldbeheer is integer centadministratie, met aparte vorderingen, ontvangsten, reserveringen en correcties.

## Mandaten en privacy

| Werkruimte | Toegestaan | Buiten mandaat |
|---|---|---|
| Lid/huishoudcontact | Eigen intake, toegestane bookings/voortgang, eigen inbox, teammarkt, expliciet bevoegd beleid namens lid | Andere ouderintake, andermans dossier, besluiten of uitvoeringsbevestiging zonder mandaat. |
| Vrijwilliger | Eigen commissie-/boarddeelname en eigen taken | Centrale dossiers/financiën of zelfstandig goedkeuren van uren. |
| Teamouder | Eigen teamtaken/doelen/verdeling, minimale huishoudvoortgang, nul-uren-teamuitvoering binnen bevoegdheid, praktische feedback | Privé-intakes, financiële achterstand, vrijstellingsreden, automatisch andere huishoudens boeken. |
| Commissiecoördinator | Eigen commissieplanbord, instructies, toegestane uitvoering/feedback en samenwerking | Andere commissies of centrale huishoud-/financiële besluiten zonder extra grant. |
| Vrijwilligerscoördinator | Expliciet toegewezen portefeuille, begeleiding en vastgelegde hulp namens lid | Geen impliciet tenantbreed overzicht; deze canonrol ontbreekt als aparte vrije demorol maar staat al in backend. |
| Vrijwilligerscommissie | Verenigingstaakpublicatie, clusterreservering, formele huishoudbeoordeling en opvolging | Verificatie/ouders vertegenwoordigen zonder toestemming; niet automatisch financieel finaliseren. |
| Financieel beheer | Goedgekeurde financiële grondslag, verwerking, ontvangsten/correcties/export | Zelf vrije urendoelen wijzigen of gevoelige intakes opvragen. |
| Bestuur | Bevoegde escalaties, belangenconflict en verleende centrale grants | Bestuursrol is geen reden om alle private ouderantwoorden standaard bloot te leggen. |

Een gebruiker kan meerdere mandaten hebben. Een rolwisselaar kiest een werkruimte; de server bepaalt de rechten. Een vrijstellende vrijwilligersfunctie is geen systeemrol. Rechten gelden op UI, API, query, export, Storage, Realtime, zoekresultaat, deeplink en notificatie. Een bronlink verleent geen toegang. E-mail/naam/intakecode zijn geen identiteits- of gezinsbewijs.

## Tijd en publicatie

Alle daadwerkelijke tijdstippen worden UTC opgeslagen met clubtijdzone `Europe/Amsterdam` voor lokale afspraken. Halfopen persoonsintervallen `[start,end)` laten aansluitende taken toe maar verbieden overlap voor dezelfde uitvoerder. Minimumleeftijd en certificaatgeldigheid gelden op de uitvoering, niet alleen op de boekdatum. Booking bewaart tijden, credits, deadline, instructie en voorwaarden als server-snapshot.

Sportlink start standaard 06:00 en 18:00 lokaal, met één occurrence per club/taak/lokale dag/slot. DST-gat: eerstvolgende bestaande tijd; dubbele tijd: eerste voorkomen eenmaal. Een gedeeltelijke import annuleert geen wedstrijd. Wedstrijdwijziging leidt tot impactcase, niet directe verplaatsing van bezette taken.

Nieuwe passende taakpush wordt per persoon/taak-publicatiegebeurtenis ontdubbeld en heeft geen dagcap. De nieuwe-takenmail heeft maximaal één digest per persoon/lokale dag. Verschillende rollen/segmenten maken geen extra bericht. Essentiële bevestiging, ziekte, belangrijke wijziging, ruil en reminders volgen eigen categorieën. Provider-timeout kan Unknown zijn; niet blind dubbel versturen.

## Seizoenen en historisch herstel

Sluiten vereist controle van relevante open uitvoering, bezwaar, besluiten en financiën. Immutable snapshots leggen doelen, coverage, ledgerrevisie, teamdoelen/tellingen en besluitbasis vast. Overgang kopieert alleen gekozen templates en maakt werkende herbevestigingsitems; nieuwe verplichtingen komen uit het nieuwe beoordeelde seizoen. Geen automatische overurentransfer of uitbetaling. Historische boekingen verhuizen niet bij later huishoud- of rolwijziging.


## Concrete relatieketens
De volgende ketens maken de samenhang tussen individuele functie-ID’s toetsbaar. Iedere stap leest of wijzigt de genoemde gedeelde bron; effecten worden servermatig in dezelfde commit of via gecontroleerde event/outboxafhandeling verwerkt.
| Relatie | Functieketen | Gedeelde bron en effect |
|---|---|---|
| R01 Openbare taak naar uitvoering | P08.F02 → P08.F07 → P02.F01 → P02.F06 → P03.F01 → P03.F05 → P09.F03 → P19.F01 → P20.F03 | Taakversie → concrete positie → booking → attendance/ledger. Publicatie opent juiste vrije capaciteit; booking maakt planning; bevestiging voedt alle urenmeters en financiële grondslag. |
| R02 Cluster via team naar huishouden | P08.F08 → P12.F02 → P12.F05 → P03.F03 → P04.F06 → P12.F07 → P12.F04 → P03.F05 → P12.F15 → P04.F01 | Dezelfde shift_position; allocation, target member, executor, obligation. Teamreservering haalt capaciteit uit openbare markt; lidtoewijzing maakt keuzeactie; uitvoering telt één lid en eenmaal HH-minuten. |
| R03 Eigen teamtaak en goedgekeurde minuten | P12.F10 → P12.F11 → P12.F12 → P12.F07 → P03.F05 → P12.F15 → P09.F03 | Bronteamtaak credit0 en één verbonden approved shift. Publicatie is besloten; uitsluitend vooraf goedgekeurde bookingcredits leveren bij bevestiging verenigingsuren, naast één teamtelling. |
| R04 Doelen en eerlijk verdelen | P12.F13 → P12.F14 → P23.F04 → P17.F03 → P12.F17 → P12.F18 → P12.F05 | Seizoensdoelen, leeftijd/qual, beschikbaarheid, taakduur, load. Advies toont redenen en totale HH-last; atomair voorstel geeft alleen lidtoewijzingen, nog geen bookings of verdiende inzet. |
| R05 Gezinsplanning | P07.F01 → P12.F04 → P03.F01 → P04.F03 → P04.F05 → P02.F06 | Match, allocation en booking read-models. Eén tijdlijn; gezinsconflict zacht, executoroverlap hard; één HH-meter en afzonderlijke kind/teammeters. |
| R06 Deadline en reservehulp | P12.F03 → P12.F19 → P13.F01 → P14.F04 → P12.F20 → P12.F08 → P12.F07 | Follow-up policy/occurrence en unresolved-allocations. Markt sluit; ouder/commissie volgt op; gerichte passende vrijwillige reserve-invite geeft geen stille booking. |
| R07 Overname en ruil | P03.F09 → P05.F01 → P05.F02 → P05.F04 → P05.F03 → P03.F02 → P04.F03 | Transferrequest/consents en replacement bookings. Origineel blijft tot geschikte atomaire overname; historie, capacity en snapshots worden samen bijgewerkt. |
| R08 Urenvraag en financiële hold | P03.F10 → P09.F07 → P03.F05 → P20.F04 → P20.F05 → P19.F01 | Concrete dispute, attendance revisions en obligationlock. Alleen betrokken casus oplossen; overige blockers blijven; financiële finalisatie leest actuele grondslag. |
| R09 Winterafspraak binnen jaardoel | P09.F11 → P03.F02 → P02.F06 → P12.F07 → P19.F03 → P20.F03 | Winterreview en allocation aan echte booking. Pending eerst beoordelen; passend bestaande/new booking niet dubbelen; geen tweede jaarclaim, dezelfde capacitykernel. |
| R10 Werving naar structurele dekking | P23.F03 → P18.F03 → P18.F04 → P09.F08 → P22.F05 → P22.F06 → P09.F09 → P20.F03 | Vacancyinterest → formele appointment/coverage/review. Interesse is geen recht/vrijstelling; erkenning dekt expliciete verplichting; einde vraagt besluit en geen automatische retroclaim. |
| R11 Huishouden en onafhankelijke intake | P09.F02 → P09.F05 → P22.F09 → P23.F01 → P23.F05 → P09.F10 → P04.F01 | Auth, persons, grants, household, obligation. Extra account creëert geen doel; invite vraagt verificatie/grant; splitsing bewaart private intakes en historische uren. |
| R12 Kanban en samenwerking | P10.F02 → P11.F02 → P11.F06 → P11.F07 → P11.F08 → P13.F07 → P14.F04 → P11.F04 | Board/card/assignees/mentions en ACL. Persoonlijke acties en gerichte mentions uit bron; kaartDone kent geen verenigingsuren/teamuitvoering toe. |
| R13 Wedstrijd naar roosterimpact | P22.F07 → P07.F02 → P07.F03 → P08.F06 → P08.F07 → P07.F04 → P07.F05 → P14.F07 | Provider source revision, voorstel en impactcase. Idempotente import; partial geen afgelasting; bevestigde afspraken pas na bewuste gevolgenverwerking wijzigen. |
| R14 Beleidversie en individuele instemming | P15.F06 → P15.F01 → P15.F02 → P15.F03 → P15.F04 → P15.F05 → P15.F07 → P13.F01 | Immutable policy, assignments, guardiangrants/acceptances. Geopend is geen akkoord; ieder lid exact hash/actor; vraag stopt alleen eigen reminder en houdt ziekmelding open. |
| R15 Communicatie per gebeurtenis | P08.F07 → P21.F08 → P21.F01 → P21.F06 → P14.F06 → P14.F07 → P21.F11 | Domain-event → recipient intent → outbox → attempt/receipt. Daily taskdigestcap en per-taskpush apart; essentiële transacties eigen categorie, retries/provider-Unknown eerlijk. |
| R16 Ervaring naar instructie en voorkeur | P03.F05 → P03.F11 → P16.F05 → P16.F06 → P16.F07 → P16.F08 → P12.F22 → P12.F10 → P18.F01 | Aanwezige booking, feedback, instructionversion, personal preference. Eigen voorkeur uitsluitend executor; praktische verbetering in eigen scope, geen wijziging credits/besluiten. |
| R17 Teamouderoverdracht | P12.F21 → P13.F06 → P14.F04 → P22.F14 → P12.F04 → P12.F15 | Handover readyversion en scoped accessgrants. Opvolger accepteert exact versie; oude grant eindigt, overige ouders/brondata intact; geen privéschermen in overdracht. |
| R18 Opleiding en geschiktheid | P17.F02 → P17.F03 → P17.F05 → P02.F06 → P12.F07 → P13.F01 | Courses/enrollments/verified qualifications/bookingimpacts. Seatbooking geen certificaat; geldigheid op taakdatum, verval leidt tot opvolging en geen stille afspraakverwijdering. |
| R19 Waardering en pot | P16.F02 → P16.F04 → P21.F06 → P16.F03 → P20.F02 → P20.F01 | Unieke appreciationoccasion/action en financieel fundevent. Eén moment per bron, private lief-en-leed, echte budgetpost en eerlijk verzendstatus. |
| R20 Afrekening en werkelijk geld | P19.F04 → P09.F07 → P20.F03 → P20.F04 → P20.F05 → P20.F07 → P20.F08 → P20.F01 | Assessmentversion/approvals, processing, payment/correction. Independent approvals en blockerlock, integercent, geen dubbele afkoop/claim/ontvangst; betaalde correctie houdt historie. |
| R21 Nieuw seizoen | P22.F12 → P22.F13 → P23.F06 → P12.F13 → P15.F01 → P19.F01 | Close/snapshot/rollover/reconfirmation. Alle oude standen reproduceerbaar; uitsluitend gekozen templates, nieuwe expliciete verplichtingen, geen autooveruren. |
| R22 Persoonlijke uitleg | P00.F06 → P00.F07 → P00.F08 → P23.F01 → P22.F11 | Auth-user en stabiel topic_id. Gezien en kruis dezelfde upsert; mergevriendelijk/cross-device; rol/seizoen/demo-reset herhalen niet. |
