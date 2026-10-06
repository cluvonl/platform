# 08 — Gevonden demogaps en vereiste herstelacties

Deze punten volgen uit de actuele bron en maken deel uit van de bouwopdracht. Ze zijn geen bewijs dat de huidige demo onbruikbaar is als referentie. Visuele vorm en gebruikerstaal worden behouden; onveilige of onvolledige demo-effecten worden vervangen door samenhangende serverlogica.

| ID | Bron / gap | Vereiste uitkomst |
|---|---|---|
| G01 | Alle writes in localStorage; vrije rol/persoonkeuze | Echte serveropslag, Auth/grants, geen clientgestuurde autorisatie. |
| G02 | Publieke presentie kan toekomstige afspraak bevestigen | Pas na feitelijke uitvoering/einde en bevoegd mandaat; één attendance/ledger. |
| G03 | Urencontroleactie sluit alle HH-verzoeken en wist blocked | Sluit alleen betrokken case; blockers afgeleid uit alle relevante bronnen. |
| G04 | Winterbooking telt actieve bookings maar mist teamreserveringen | Eén positionkernel inclusief allocation, hold, waitlist en booking in alle kanalen. |
| G05 | Ruil overschrijft booking en gaat uit van toestemming | Twee echte consents waar nodig, atomic replacement, immutable historie. |
| G06 | Verlaagd doel `Number(v)||360` maakt nul onmogelijk | Expliciet integer0 geldig; validatie en besluitrevisie. |
| G07 | Globale audit in huishoudhistorie | Alleen dossiergebeurtenissen met concrete ACL. |
| G08 | Demo-invite maakt persoon; verificatiecheckbox | Echte beperkte invite, Auth-verificatie, matching identity en grants. |
| G09 | Team/referee review gebruikt centrale demoknop | Afzonderlijke match- en vrijwilligersmandaten op actuele requestversie. |
| G10 | Nieuwe direct-teamclusterdeadline kan op taakdatum staan | Valid self_until ≤ assign_until < eerste taakdatum; geen ongeldige standaard. |
| G11 | HH-belasting kan vervangingsbooking en open allocation dubbel tellen | Onderscheid feitelijke/verwachte inzet; bij overname één actuele plaatsbelasting, geen dubbel adviesgewicht. |
| G12 | Vaste datums/naam/12/6 in dashboard en rapporten | Actuele clubtijd, effectieve doelen/coverage en persoon uit read-model. |
| G13 | Planner vaste 08–18, onjuiste maandstap/35 dagen | Alle geldige taakuren/dagen zichtbaar; echte datumstap en behoud styling. |
| G14 | Algemene agenda bewaart repeatnaam zonder occurrences | Werkende reeks/exceptionworkflow, DST en teamafspraken via gedeelde projectie. |
| G15 | Mijn gezin/matches hardcoded JO13/JO17 | Echte season/team/personkoppeling; actuele importversies. |
| G16 | Nieuwe Kanbankolom globaal | Alleen eigen board met versie en geautoriseerde ordening. |
| G17 | Bijlage data-URL; mention iedere @ globaal | Private storage/ACL en geresolveerde ontvanger-ID's met bronrecht. |
| G18 | Templateknop verenigingstaak; validator dienst | Consistente allowlist/alias met versiecompatibiliteit en veilige escaping. |
| G19 | E-mail/push voorkeuren in globale settings | Per persoon/categorie/device; centrale regels apart. |
| G20 | Toast/test/log simuleert echt verzenden | Outbox/providerstatus, allowlist, realistische retry/Unknown; geen valse Delivered. |
| G21 | CSV simpele delimiter en automatch source-ID of email | Quoted CSV-parser, dry-run/conflicts, stable-ID + expliciete identityreview. |
| G22 | CSV verzint leeftijd18 en HH-koppeling | Werkelijke/nullable bronvelden; geen account/dossier/obligationcreatie zonder beoordeelde stap. |
| G23 | Finance floats en lokale betaaldcheckbox | Integer cents, onafhankelijke grondslag, locks, dedupe payment en correctiepost. |
| G24 | Rapportaanbod negeert reserve/kwalificatie; maandlast zonder maand | Periode-/seizoenprojectie, echte boekbaarheid en passende-aanbodsnapshot. |
| G25 | Waarderingsconcept kan afgerond status overschrijven | Expliciete lifecycle en once-per-occasion; concept doet finish niet ongedaan. |
| G26 | Vacatureaanvragen/personenlijsten breed zichtbaar | Eigen interesse of bevoegde private kandidaten/read-model. |
| G27 | Beleid vertegenwoordiging/opendatum beperkt | Per-lid assignment, exact hash en specifieke guardianmachtiging; geopend ≠ akkoord. |
| G28 | Seizoensvoorbereiding archiveert alleen kopie/melding | Werkelijk close/rollover/new obligation/template/herbevestiging, ook teamdata. |
| G29 | Teamopvolgingclock handmatig in demo | Eén echte scheduler met lease/local occurrences; democlock uitsluitend testfixture. |
| G30 | Handover verwacht demorol teamouder vooraf | Vooraf beperkte ontvangermachtiging; expliciete accept activeert echte teamoudergrant zonder bredere rechten. |
| G31 | Helpvoorkeur lokaal per person-ID | Per echte Auth-user/topic, cross-device en mergevriendelijk; onafhankelijk van demo-reset. |
| G32 | Bestaande release/health claim slechts core | Eerlijk readinessbereik incl. schema/workers; full-releaseflag pas na alle criteria. |
| G33 | Sportlink, OTP en seizoenroutes nog simulatie | Echte gecontroleerde aansluiting en status; onbekende providers benoemd als open afhankelijkheid. |
| G34 | UI-nav zoek/inbox verliest objectcontext | Herlaadbare scoped route/deeplink met actuele rechten en target-ID. |
| G35 | Vrijwilligerscoördinator ontbreekt in vrije demorollen | Bestaande backendrol met echte portefeuilleprojecties/assisted actions in Club Signal. |
| G36 | Teamhelp invite/feedback kan na retry dubbele melding maken | Event/recipient dedupe en source-version; nieuwsstatus herberekend voor verzending. |

Deze lijst is een herstelregister voor de bekende verschillen. Codex controleert ook iedere functie- en dialoogregel in de broninventaris; een ontbrekend punt in deze tabel geeft geen toestemming een knop zonder echte uitvoering te laten staan.
