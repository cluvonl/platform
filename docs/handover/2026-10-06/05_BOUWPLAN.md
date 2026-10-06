# 05 — Bouwvolgorde en overdraagbare werkpakketten

Iedere fase levert een verticale keten op: pagina → command/RLS → gedeelde projectie → actie/inbox/outbox → audit → tests. De omvang van een fase bepaalt welke gerichte checks nodig zijn. Bundel samenhangende kleine edits vóór volledige checks; behoud bestaande verplichte CI. De gebruikersvraag blijft de volledige scope, ook als een tussenrelease sneller kan worden gedemonstreerd.

| Pakket | Uitkomst en afhankelijke pagina's | Vereist vóór volgende stap |
|---|---|---|
| W00 Bron en visuele norm | Actuele branchvergelijking, canon/addendum, functie→route→command-matrix, reproduceerbare prototypefixture en screenshotbaseline | Geen overschrijven van gebruikerswerk; alle 23 routes/tabs/modals in register. |
| W01 Identiteit en platformlayout | Echte Auth/workspaces/logout, tenantgrants, Club Signal-shell, veilige runtimeconfig en persoonlijke banneropslag | Twee tenants en gescheiden ouders RLS; session expiry; cross-device seen; geen demorol als recht. |
| W02 Huishouden en intake | Dossierrechten, vier intake-stappen, invitations/executorgrants, assisted action en basisverplichting | Account/persoon/dossier/verplichting gescheiden; uitnodiging/OTP echt; privacy ook search/files/export. |
| W03 Taak en openbare plaats | Planbord/editor/templates/publicatie, qualifications/buddy, openbare markt/booking en juiste snapshots | Two-session last-slot/overlaptests; historische positie-ID's; aanpasimpact; nieuwe takenoutbox. |
| W04 Teams en clusters | Teamseizoenen/leden/grants, plaatsreservering, besloten markt, doelen/overrides, lidtoewijzing en uitvoerderkeuze | Openbare/team/winter/waitlist-reserveringsrace; één bronplaats; één lidtelling; teamouder kan geen HH-uitvoerder afdwingen. |
| W05 Uitvoering en wijziging | Beide tellers via attendance, no-show, afmelding/ziekte, overname/wederzijdse instemming, gerichte geschillen/correcties | Ledger/team-entry idempotent; beide consents; geen verdwijnen oorspronkelijke afspraak; blockers consistent. |
| W06 Zes uitbreidingen | Slim advies, gezinsagenda, actieprojectie, opvolging/reserve, handover en praktische feedback/instructie | Advies reserveert niet; eigen HH/team/privacy; handoverversies/mandoverdracht; geen feedback-urenmutatie. |
| W07 Formele beoordeling | Roldekking, uitzonderingen/twee reviewers, rolbeëindiging, winterreview/allocatie, passend aanbod | Nuldoel geldig; pending eerst oplossen; geen tweede seizoensclaim; portefeuilleworkflow werkt. |
| W08 Samenwerking en beleid | Commissies/docs, kanban/subtaken/bijlagen/mentions, chat, jaaragenda/recurrence, exacte beleidsacceptaties | Bronrechten op alle transports; Done = nuluren; exacte tekst/hash + echte guardian-grant. |
| W09 Integraties en communicatie | Sportlink en CSV, scheduler/workers, mail/push/outbox, templates/segmenten/campagnes en statuslog | DST, providerfouten/Unknown/retries, dailycap vs pushes, allowlist; geen fixture als live-verbonden presenteren. |
| W10 Mensen en financiën | Opleidingen/certificaten/buddy/reserve, werving/erkenning, waardering, pot/assessment/betaalcorrectie/exports | Onbekende datum geen event; financial/obligation locks en independent approval; integer cents. |
| W11 Seizoen en rapportage | Shared aggregates, echte periode/seizoen, distinct huishoudens, snapshots/rollover/herbevestiging | Oude data reproduceerbaar; geen automatische overurenoverdracht; alle nieuwe teamdata in close/rollover. |
| W12 Stagingrelease | App-mode, migratiepad, workers/health, exacte promotie/digest, restoreproef, functionele én visuele acceptatie | Alle A-, T-, C-, H-, O- en V-criteria met actueel stagingbewijs; productie blijft dicht. |

W09-outboxbasis begint al bij W03 omdat publicatie/booking intentvorming nodig heeft; provideradapter wordt volledig afgemaakt in W09. W10 en W11 mogen eerder voorbereide backendcommands hergebruiken. Tabellen of schermen zonder aangesloten keten tellen niet als voltooid werkpakket.

## Per functie bijhouden

Gebruik `registers/functie-dekking.csv` als start. Noteer catalogus-ID, route/component, read-model, command/transport, servermandaat, test-ID's, visueel bewijs, bron-SHA en status. Startstatus is `TE_BOUWEN_OF_VERIFIEREN`; de reeds aanwezige basis is geen automatisch bewijs. Voltooid vraagt een actueel geslaagde proef met meerdere accounts waar de functie dat vereist.

De builder rapporteert concreet: wat werkt end-to-end, welke demo werd vervangen, welk bestaand command is gebruikt, welke nieuwe migratie is toegevoegd, welke pagina's het resultaat delen en welk bewijs beschikbaar is. “Backend 90% klaar” zonder dekkingsmatrix is geen bruikbare overdracht.

## Beslispunten die infrastructuur niet mogen laten blokkeren

De exacte mailprovider/SMTPadapter, Sportlinkcontractcapabilities, actieve Supabase-projectref, backupdoel/retentie en workerbeheervorm zijn niet uit de lokale bron als volledig geïnstalleerde services vastgesteld. Lees de bestaande niet-geheime config en vraag alleen concrete ontbrekende aansluitgegevens indien noodzakelijk. Bouw adapterinterfaces, testfixtures, validatie, UI en domeintransacties intussen door. Geen fictieve credentials of providers aannemen.

Een tussenrelease kan Auth, task/position, teamverdeling en beide tellers eerst aan staging toevoegen. Noem die expliciet **tussenrelease** met resterende functies; dit voldoet nog niet aan “alle prototype-logica werkt”. De definitieve eerste stagingplatformrelease omvat ook de overige pagina's, workers, integraties en canonprocessen. Productieconfiguratie, echte ledenmigratie en productiepromotie zijn een latere opdracht.
