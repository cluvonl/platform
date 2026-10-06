# 10 — Dialoogvensters en invoervelden

Dit appendix hoort bij document01. Titels en velddefinities zijn rechtstreeks uit de actuele TSX-bron gehaald. Dynamische titels blijven als bronexpressie herkenbaar. Bij ieder formulier gelden ook de concrete mandaat-, validatie-, transactieregels en demoherstelpunten uit de paginacatalogus. De JSON-bron bevat volledige options/value-expressies en callbacks.

Een helpercomponent is geen extra productpagina. Ongebruikte legacy Teams/TeamActions en het generieke FormModal worden niet als actieve modaal geteld. De actieve dialogen worden op hun eigen route en waar ze worden hergebruikt beoordeeld.

## D01 — Cluvo op je telefoon

**Component/bron:** `Shell` in `app.tsx`.

**Uitleg:** Dezelfde werkruimte, met ruimte voor je duim.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D02 — Zoeken in Cluvo

**Component/bron:** `Shell` in `app.tsx`.

**Uitleg:** Spring direct naar een werkruimte of een taak.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D03 — Ontdek Cluvo

**Component/bron:** `Shell` in `app.tsx`.

**Uitleg:** Een interactieve demonstratie van de volledige V1-werkruimtes.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D04 — Commissielid toevoegen

**Component/bron:** `Committees` in `collaboration.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Persoon | select | Serverregel/context | s.people.map(p=>({value:p.id,label:p.name})) |

## D05 — Kennis toevoegen

**Component/bron:** `Committees` in `collaboration.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Titel | text | Ja |  |
| Type | select | Serverregel/context | ['Document','Instructie'] |
| Inhoud, checklist of videoverwijzing | textarea | Ja |  |
| Zichtbaarheid | select | Serverregel/context | ['Commissie','Vereniging','Coördinatoren'] |

## D06 — {doc.title}

**Component/bron:** `Committees` in `collaboration.tsx`.

**Uitleg:** {'Versie '+doc.version+' · '+doc.committee}

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D07 — Nieuwe kanbankaart

**Component/bron:** `Kanban` in `collaboration.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Titel | text | Ja |  |
| Omschrijving | textarea | Serverregel/context |  |
| Commissie | select | Serverregel/context | committees |
| Deadline | date | Serverregel/context |  |
| Prioriteit | select | Serverregel/context | ['Laag','Normaal','Hoog'] |

## D08 — Kolom toevoegen

**Component/bron:** `Kanban` in `collaboration.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Kolomnaam | text | Ja |  |

## D09 — {c.title}

**Component/bron:** `CardDetail` in `collaboration.tsx`.

**Uitleg:** {c.committee+' · '+c.priority+' prioriteit'}

**Inlinevelden van component:** Status; Deadline; Uitvoerders (meerdere mogelijk); Aanspreekpunt (optioneel); Gekoppelde activiteit; Gekoppelde verenigingstaak; Bijlage toevoegen. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D10 — Wedstrijdwijziging beoordelen

**Component/bron:** `Matches` in `collaboration.tsx`.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D11 — {selected.title}

**Component/bron:** `Calendar` in `collaboration.tsx`.

**Uitleg:** {selected.kind+' · '+fullDate(selected.date)}

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D12 — Activiteit in de jaaragenda

**Component/bron:** `Calendar` in `collaboration.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Titel | text | Ja |  |
| Datum | date | Serverregel/context |  |
| Begintijd | time | Serverregel/context |  |
| Eindtijd | time | Serverregel/context |  |
| Locatie | text | Serverregel/context |  |
| Categorie | select | Serverregel/context | ['Activiteit','Vergadering','Opleiding','Waardering','Deadline'] |
| Zichtbaarheid | select | Serverregel/context | ['Vereniging',...committees,'JO13-1','Besloten'] |
| Herhaling | select | Serverregel/context | ['Geen','Wekelijks','Maandelijks','Jaarlijks'] |
| Omschrijving | textarea | Serverregel/context |  |

## D13 — Opvolgafspraken

**Component/bron:** `FollowUpBoard` in `coordination-panels.tsx`.

**Uitleg:** {edit.title+' · deadlines vóór '+fullDate(edit.date)}

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Zelf inschrijven tot en met | date | Ja |  |
| Teamouder verdeelt uiterlijk op | date | Ja |  |

## D14 — {done?'Bedankt voor je terugblik!':'Hoe ging deze taak?'}

**Component/bron:** `FeedbackDialog` in `coordination-panels.tsx`.

**Uitleg:** {t.title+' · '+dateLabel(t.date)+' · uitgevoerd door '+nameOf(s,booking.personId)}

**Inlinevelden van component:** {'Zou '+(booking.personId===person.id?'je':nameOf(s,booking.personId))+' deze taak nog eens willen doen?'}; Was de uitleg duidelijk?; Wat kunnen we praktisch verbeteren?. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D15 — Een duidelijkere taakinstructie

**Component/bron:** `InstructionDialog` in `coordination-panels.tsx`.

**Uitleg:** {t.title+' · '+t.category}

**Inlinevelden van component:** Instructie voor de uitvoerder. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D16 — Uitvoering controleren

**Component/bron:** `NextActions` in `coordination-workspace.tsx`.

**Uitleg:** {s.shifts.find(t=>t.id===confirm.shiftId)?.title}

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D17 — {selected.title}

**Component/bron:** `FamilyAgenda` in `coordination-workspace.tsx`.

**Uitleg:** {selected.kind==='match'?'Wedstrijd van jouw gezin':'Afspraak van jouw huishouden'}

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D18 — {read.title+' · versie '+read.version}

**Component/bron:** `Policies` in `governance.tsx`.

**Uitleg:** Lees de volledige tekst. Alleen je actieve bevestiging geldt als akkoord.

**Inlinevelden van component:** Je vraag of bezwaar. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D19 — Vraag over het beleid

**Component/bron:** `Policies` in `governance.tsx`.

**Inlinevelden van component:** Je vraag of bezwaar. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D20 — Nieuwe beleidsversie publiceren

**Component/bron:** `Policies` in `governance.tsx`.

**Uitleg:** Een nieuwe versie bewaart alle oude teksten en acceptaties. In de demo bevestig je de interne goedkeuring bij publicatie.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Documenttitel | text | Ja |  |
| Nieuw versienummer | text | Ja |  |
| Ingangsdatum | date | Serverregel/context |  |
| Volledige beleidsinhoud | textarea | Ja |  |

## D21 — Een moment van aandacht

**Component/bron:** `Appreciation` in `governance.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Titel | text | Ja |  |
| Aanleiding | select | Serverregel/context | ['Verjaardag','Jubileum','Waardering','Afscheid','Opleiding','Lief & leed'] |
| Datum | date | Serverregel/context |  |
| Voor wie | select | Serverregel/context | s.people.map(p=>({value:p.id,label:p.name})) |
| Verantwoordelijke | select | Serverregel/context | s.people.map(p=>({value:p.id,label:p.name})) |
| Budget (€) | number | Serverregel/context |  |

## D22 — Kwalificatie vastleggen

**Component/bron:** `Training` in `governance.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Persoon | select | Serverregel/context | s.people.map(p=>({value:p.id,label:p.name})) |
| Kwalificatie | select | Serverregel/context | ['IVA','EHBO','Scheidsrechter'] |
| Geldig tot | date | Serverregel/context |  |

## D23 — Onbetaalde afspraak corrigeren

**Component/bron:** `Finance` in `governance.tsx`.

**Uitleg:** De oorspronkelijke afspraak blijft in de historie. Een nieuwe financiële route kan daarna worden beoordeeld.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Reden voor intrekken / vervangen | textarea | Ja |  |

## D24 — Budgetpost toevoegen

**Component/bron:** `Finance` in `governance.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Doel / omschrijving | text | Ja |  |
| Bedrag (€) | number | Ja |  |
| Soort post | select | Serverregel/context | ['Reservering','Uitgave','Inkomst'] |

## D25 — Nieuw communicatietemplate

**Component/bron:** `Communication` in `management.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Templatenaam | text | Ja |  |
| Kanaal | select | Serverregel/context | ['E-mail','Push','Inbox'] |
| Berichtsoort | select | Serverregel/context | ['Verenigingstaak','Aanbod','Waardering','Beleid'] |

## D26 — Vrijwilligersrol toevoegen

**Component/bron:** `Settings` in `management.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Rolnaam | text | Ja |  |
| Vrijstelling voor het hele huishouden | check | Serverregel/context |  |

## D27 — Voorbeeldgegevens herstellen?

**Component/bron:** `Settings` in `management.tsx`.

**Uitleg:** Je lokale demoaanpassingen worden vervangen door de oorspronkelijke voorbeeldsituatie.

**Inlinevelden van component:** {label}; {['Naam','E-mail','Stabiel lidnummer'][i]}. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D28 — Seizoensvoorbereiding

**Component/bron:** `Settings` in `management.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Nieuw seizoen | text | Ja |  |
| Rollen opnieuw laten bevestigen | check | Serverregel/context |  |
| Intake opnieuw laten bevestigen | check | Serverregel/context |  |
| Roostersjablonen meenemen | check | Serverregel/context |  |

## D29 — Nieuw huishouddossier

**Component/bron:** `Households` in `people.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Naam huishouden | text | Ja |  |
| Team | select | Serverregel/context | ['JO13-1','JO17-1','Geen team'] |

## D30 — Wintertekort passend inplannen

**Component/bron:** `WinterPlanning` in `people.tsx`.

**Inlinevelden van component:** Uitvoerder; Verenigingstaak na de winterstop. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D31 — {h.name}

**Component/bron:** `HouseholdDetail` in `people.tsx`.

**Uitleg:** {'Dossier '+h.id+' · Intakecode '+h.code}

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D32 — Extra persoon uitnodigen

**Component/bron:** `HouseholdDetail` in `people.tsx`.

**Uitleg:** Een ouder, lid van 16+ of extra uitvoerder krijgt een eigen profiel en persoonlijke toegang.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Volledige naam | text | Ja |  |
| Persoonlijk e-mailadres | email | Ja |  |
| Leeftijd | number | Serverregel/context |  |

## D33 — Een passende afspraak aanvragen

**Component/bron:** `HouseholdDetail` in `people.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Soort aanvraag | select | Serverregel/context | ['Vermindering','Vrijstelling','Uitstel','Afkoop'] |
| Toelichting en praktische mogelijkheden | textarea | Ja |  |
| Voorgesteld jaardoel in minuten | number | Serverregel/context |  |

## D34 — Vaste vrijwilligersrol toekennen

**Component/bron:** `HouseholdDetail` in `people.tsx`.

**Uitleg:** De erkende rol kan het hele huishouden vrijstellen. Dit verleent geen systeemrechten en boekt geen fictieve uren.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Rolhouder | select | Serverregel/context | persons.map(p=>({value:p.id,label:p.name})) |
| Rol | select | Serverregel/context | s.roleCatalog.map(r=>({value:r.id,label:r.name})) |
| Vanaf | date | Serverregel/context |  |
| Tot en met | date | Serverregel/context |  |

## D35 — Huishoudwijziging ter beoordeling

**Component/bron:** `HouseholdDetail` in `people.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Wijziging | select | Serverregel/context | ['Koppelen','Splitsen','Herstellen'] |
| Betrokken dossiers en gewenste verplichtingskoppeling | textarea | Ja |  |

## D36 — {selected.title}

**Component/bron:** `Vacancies` in `people.tsx`.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D37 — We denken met je mee

**Component/bron:** `TaskMarket` in `tasks.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Wat zou voor jou wel passen? | textarea | Ja |  |

## D38 — {t.title}

**Component/bron:** `ShiftDetail` in `tasks.tsx`.

**Uitleg:** {t.committee+' · '+t.category}

**Inlinevelden van component:** Wie pakt deze taak op?; Kies een bevoegd maatje. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D39 — {shift?'Verenigingstaak aanpassen':'Nieuwe verenigingstaak'}

**Component/bron:** `ShiftEditor` in `tasks.tsx`.

**Uitleg:** Maak een concept en publiceer wanneer de bezetting en instructies kloppen.

**Inlinevelden van component:** {f.label}; Commissie; Categorie; Publicatie; Vereiste kwalificatie; Instructie; Verdeling van de verenigingstaak; Verantwoordelijk team. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D40 — {action.type}

**Component/bron:** `MyShifts` in `tasks.tsx`.

**Uitleg:** {s.shifts.find(t=>t.id===action.b.shiftId)?.title}

**Inlinevelden van component:** Bevestigde minuten; Toelichting. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D41 — Overnemen of wederzijds ruilen

**Component/bron:** `SwapMarket` in `tasks.tsx`.

**Inlinevelden van component:** Uitvoerder; Ruil met een eigen verenigingstaak (optioneel). De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D42 — Planningwijziging controleren

**Component/bron:** `Planner` in `tasks.tsx`.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D43 — Roostersjabloon toepassen

**Component/bron:** `Planner` in `tasks.tsx`.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Sjabloon | select | Serverregel/context | ['Normale zaterdag','Drukke thuisdag','Toernooi'] |
| Startdatum | date | Serverregel/context |  |
| Aantal weken | number | Serverregel/context |  |

## D44 — Cluster aan een team toewijzen

**Component/bron:** `ClusterEditor` in `team-workspace.tsx`.

**Uitleg:** Selecteer vrije bezettingsplekken. Bestaande inschrijvingen blijven behouden.

**Inlinevelden van component:** Naam van het cluster; Verantwoordelijk team; Uiterste datum voor verdeling; Verdeling binnen het team; Afspraken voor de teamouder. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D45 — Seizoensdoel voor het team

**Component/bron:** `TeamWorkspace` in `team-workspace.tsx`.

**Uitleg:** Aantal bevestigde taken per lid. Dit doel verandert de huishoudelijke verenigingsuren niet.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Taken per lid dit seizoen | number | Ja |  |

## D46 — {'Doel voor '+team.members.find(m=>m.id===adjust)?.name}

**Component/bron:** `TeamWorkspace` in `team-workspace.tsx`.

**Uitleg:** Een afwijking geldt alleen voor dit lid, dit team en dit seizoen.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Aantal taken | number | Ja |  |
| Reden voor de aanpassing | textarea | Ja |  |

## D47 — Verenigingsuren goedkeuren

**Component/bron:** `TeamTaskCard` in `team-workspace.tsx`.

**Uitleg:** De goedgekeurde waarde geldt voor nieuwe inschrijvingen. Bestaande afspraken blijven behouden.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Goedgekeurde minuten per plaats | number | Ja |  |

## D48 — Plaats aan een lid toewijzen

**Component/bron:** `AssignModal` in `team-workspace.tsx`.

**Uitleg:** {t.title+' · '+t.start+'–'+t.end}

**Inlinevelden van component:** Lid namens wie het huishouden de taak oppakt. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D49 — {t.title}

**Component/bron:** `TeamBookModal` in `team-workspace.tsx`.

**Uitleg:** {kindLabel(t)+' · '+team.name+' · plaats '+a.position}

**Inlinevelden van component:** Voor welk lid telt deze taak?; Wie voert de taak daadwerkelijk uit?. De juiste conditionele groep volgt het geopende tabblad/venster.

**Bediening:** zie bijbehorende functieomschrijving en exact broncomponent; dit venster gebruikt inline of gedeelde controls en heeft geen losse FormModal-array.

## D50 — Verhindering of overname melden

**Component/bron:** `IssueModal` in `team-workspace.tsx`.

**Uitleg:** De teamouder krijgt een opvolgactie. Een bevestigde uitvoerder blijft staan totdat een vervanger definitief overneemt.

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Wat moet de teamouder weten? | textarea | Ja |  |

## D51 — Teamtaak op de teamtakenmarkt

**Component/bron:** `TeamTaskEditor` in `team-workspace.tsx`.

**Uitleg:** {'Alleen zichtbaar binnen '+team.name+'. Verenigingsuren vragen voorafgaande goedkeuring.'}

| Veld | Type | Vereist | Opties of grens |
|---|---|---|---|
| Taaknaam | text | Ja |  |
| Soort teamtaak | select | Serverregel/context | ['Fluiten','Grensrechter','Fruit','Vervoer','Bidons','Overige teamtaak'] |
| Datum | date | Ja |  |
| Begintijd | time | Ja |  |
| Eindtijd | time | Ja |  |
| Benodigde personen | number | Ja |  |
| Minimumleeftijd uitvoerder | number | Serverregel/context |  |
| Vereiste kwalificatie | select | Serverregel/context | [{value:'',label:'Geen'},'IVA','EHBO'] |
| Aantal wekelijkse herhalingen | number | Serverregel/context | Maximaal 12; alle data moeten binnen het seizoen vallen. |
| Meetellen voor teamdoel | check | Serverregel/context | Elke bevestigde plaats telt als één taak voor het gekozen lid |
| Verenigingsuren aanvragen (minuten) | number | Serverregel/context | 0 = alleen teamtaak. Fluiten en grensrechter krijgen eerst beoordeling door wedstrijdzaken. |
| Instructies | textarea | Serverregel/context |  |

## Vaste inline-editors en grenzen

De verenigingstaakeditor bevat naam, datum, start/einde, capaciteit, minuten, minimumleeftijd, afmeldtermijn, commissie/categorie/status/kwalificatie/instructie/buddy en nieuwe verdelingskeuze. De intake heeft vier stappen met ervaring, buddy, talenten, taak-/functievoorkeur, weekbeschikbaarheid, gewenste maandinzet, praktische grenzen, verhinderdatums, leerwens en reservebereidheid.

Team clustereditor: clusternaam, verantwoordelijk team, deadline, market/assign/mixed, teamtellingcheckbox, gekozen vrije places en afspraken; plus uitlegbaar teamadvies. Handover: opvolger, praktische notitie maximaal4000tekens, vijf checks en concept/klaarzetten/actuele acceptatie. Feedback: repeat ja/misschien/nee, instructie duidelijk/onduidelijk, toelichting maximaal2000tekens en alleen eigen voorkeur onthouden. Instructie-update maximaal4000tekens en optionele toekomstscope.

Instellingen: club/season/start/end/winter; jaardoel/winterpercentage/bijdrage/afmeld-/bevestigings-/correctietermijn/reminders; twee synctijden; CSV-mapping. Communicatie-editor: subject/preheader/sender/reply/body/button, allowlisted variabelen en previewpersoon. Kaarteditor: description/checklist/subtaken/reacties/status/deadline/multiassignees/contactpersoon/event/shift/file.

Servergrenzen: teamdoel integer0–100; teamtaakcapaciteit1–30; requested credit integer0–1440; geldige positieve goedgekeurde credit maximaal1440; herhalingen1–12 binnen season; begin<einde; opvolgdeadline vóór eerste taak; kwalificatie geldig op uitvoering. Formuliervelden die in de demo minder strikt zijn blijven onder dezelfde serverregels. Locatie/commissie/type-grants, numeric-ranges en filecontrols worden extra servermatig getoetst.
