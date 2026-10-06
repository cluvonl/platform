# 03 — Bestaand backend, uitbreiding en transacties

## Wat er al staat

De platformrepository is een echte Next.js App Router-/TypeScript-app met Supabase Auth/SSR, Postgres/RLS en private-storagefundament. Op de vastgelegde main-SHA staan zeven migraties met 140 tabellen, 52 API-functiondefinities en 16 API-views. Deze broninventaris is opgenomen als `registers/backend-inventaris.json`; aantallen zeggen niets over volledige UI-dekking of actuele stagingwerking.

De bestaande serverroutes sluiten reeds aan op login, geverifieerde werkruimtes, eigen overzicht, intake, verenigingstaakmarkt/booking, presentie en uitnodigingsacceptatie. De overige prototypewerkruimtes zijn nog niet volledig als echte app aangesloten. De snapshot bevat ook commands voor veel grotere domeinen; die moeten eerst worden gelezen en getest, niet opnieuw los worden ontworpen.

| Functiegroep | Bestaande basis | Bouwactie |
|---|---|---|
| Auth/workspace | `app/auth`, `app/login`, `app/workspaces`, `lib/auth/workspace.ts`, `lib/supabase/*` | Behoud claims, cookies, veilige origin en concrete grants; geef Club Signal-layout. |
| Intake/invite | `save_intake_revision`, `create_household_invitation`, `mark_household_invitation_delivery`, `accept_household_invitation` | Sluit vier intake-stappen, vertegenwoordiging en echte verzending aan. |
| Markt/presentie | `book_shift`, `list_shift_market`, `list_bookable_obligations`, `confirm_attendance`, `list_attendance_queue` | Behoud invariant/ledger; voeg openbare versus teamplaats-scope toe in dezelfde lockroute. |
| Verplichting/rollen | appointment-, coverage-, exception-/reviewtabellen en commands | Sluit dossier-UI, onafhankelijke reviews, nuldoel en echte portefeuillegrants aan. |
| Winter/overname | winterreview/allocation, cancellation, transfer, waitlist-RPC’s | Breid reserveringscontrole uit; behoud oude booking tot definitieve vervanging. |
| Planbord/match | `manage_planboard_shift`, publication/change-RPC’s, match-importcommands | Behoud stabiele posities, impact en dedupe; bouw echte editor en provideradapter. |
| Samenwerking/beleid | Kanban/document/policy/mention/notification/outboxtabellen en RPC’s | Bied ontbrekende veilige commands/read-models en verbind de UI en workers. |
| Financiën/seizoen | assessment/finalize/correction/fund, `close_season`, `rollover_season` | Behoud bestaande locks, connecteer alle UI-stappen, snapshots en werkende overgang. |
| Teamtaken oud | `team_tasks` (credit = 0), market_requests/reviews, publicatie naar shift | Voeg gesloten scope en één verbonden uitvoeringspad toe; geen tweede creditsbron. |
| Zes nieuwe ideeën + banners | Nog vooral in actuele prototypebron | Nieuwe schema/commands/projecties naast de bestaande tabellen, append-only migraties. |

De zeven bestaande migraties blijven immutable. Gepinde Next/React/Supabase-versies en npm-lock blijven behouden tenzij een concrete compatibiliteitsfix nodig is. De Site heeft een aangepaste statische export; de VPS-app blijft de bestaande dynamische Next-server met Docker. Kopieer dus niet blind de Site-buildscript/config over het platform.

## Voorgesteld model voor de nieuwe uitbreiding

Onderstaande namen zijn ontwerpvoorstellen, **geen reeds bestaande databaseobjecten**. Codex kiest na de actuele schema-audit consistente namen en legt de uiteindelijke mapping vast. Het semantische contract is verplicht.

| Nieuwe/uitgebreide bron | Belangrijkste velden/invariant |
|---|---|
| `task_market_scopes` | Een verbonden shift heeft openbare of besloten teammarkt; scope kan per concrete gereserveerde plaats worden verfijnd. Teamtaakbron en gekoppelde shift hebben één uitvoeringsidentiteit. |
| `task_clusters` | Tenant, seizoen, team, titel, market/assign/mixed, afspraken, versie, creator en status. Deadlines vóór eerste taak; team/seizoen-FK correct. |
| `team_position_allocations` | Tenant, seizoen, `position_id`, team, cluster?, target member?, counts_for_team, status, versie. Maximaal één actieve teamreservering per positie. Actor-toewijzing blijft historisch. |
| `team_goal_versions` + `team_member_goal_overrides` | Team/seizoen, geheel doel 0–100, lid-specifieke reden en besluitversie. Geen invloed op obligation-target. |
| Booking-uitbreiding | Allocation en gekozen team-member-snapshot, counts_for_team en vrijwillig akkoord. Executor/obligation blijven de bestaande expliciete bron. |
| `team_execution_entries` | Eén uitvoeringsbron per booking/member/team/seizoen; correctie verwijst naar vorige entry. Geen extra huishoudledger of dubbel teamkrediet. |
| `follow_up_policies` en occurrences | self_until, assign_until, lokale zone/versie; unresolved uit de plaats/booking. Dedupe per unit/stage/ontvanger/lokale dag. |
| `reserve_help_requests` + recipients | Geautoriseerde vrijwillige uitnodiging voor concrete open allocations; alleen teamhuishoudens die passen; geen automatische booking. |
| `team_handovers` + immutable versions | From/to, team/seizoen, notitie, vijf checks, draft/ready/accepted, expected_version en acceptatietijd. To grant wordt pas bij acceptatie actief, from grant daarna gericht afgesloten. |
| `task_feedback` + revisions | Booking, actual executor, feitelijke actor, repeat yes/maybe/no, clear/unclear, praktische tekst. Max één actuele terugblik per booking, historie bij wijziging. |
| `task_instruction_guides` | Team/commissie/type, gekoppelde immutable documentversie; toepasselijkheid toekomstige versies expliciet. Oude aangeboden instructie blijft traceerbaar. |
| `user_help_seen` | Account, stabiel topic_id, seen_at. Unique `(auth_user_id,topic_id)`; op termijn contentrevision mogelijk, standaard geen stille herhaling voor dezelfde functie. |

Voeg composite tenant-FK's, constraints, partial unique indexes, RLS, privileges en transactionele commands samen toe. Beschermde privéteksten krijgen een eigen read-model, geen generiek JSON dat een teamouder kan uitlezen. Een teamlid verwijst naar een echte seizoensgebonden persoon, niet naar de losse demo-string noor/sem.

## Commandcontract

Alle writes gebruiken geverifieerde actor, tenant/scope, actuele bronversie en idempotencykey. Kritische effecten gebeuren in één database-transactie: validatie → locks → bronwijziging → ledger/team-entry indien nodig → domain-event → audit → commandresultaat. UI, e-mail, push en andere realtimeclients lezen daarna dezelfde commit. Kritieke bedragen, minutes, actor-ID, rollen en status worden niet uit clientpayload vertrouwd.

| Commandroute | Bestaand of nieuw | Belangrijkste commitvoorwaarde en effect |
|---|---|---|
| `book_shift` | Bestaand, uitbreiden | Auth/executor/obligation, juiste openbare of allocation-scope, positie vrij zonder andere hold, versie, seizoen, leeftijd/qual/buddy/overlap; maak één booking + snapshots. |
| `create_cluster` | Nieuw voorstel | Commissiegrant; lock alle gekozen posities deterministisch; alleen vrije/niet-geholde plaatsen; reserveer alles of niets en informeer teamouder. |
| `assign_team_member` | Nieuw voorstel | Eigen-teamgrant, doelruimte en allocationversie; geen actieve booking vervangen. Wijzig namens-lid en maak uitvoerderkeuzeactie, geen booking. |
| `apply_distribution` | Nieuw voorstel | Hercontroleer alle geselecteerde rows/versions en virtuele executormatching onder consistente bronrevision; atomair toewijzen, nul echte bookings. |
| `book_team_position` | Nieuwe façade op bestaande bookingkernel | Eigen gemachtigd huishouden of geregistreerde expliciete assistentie; allocation/member, deadline/reserve-invite, vrijwillig extra akkoord; book dezelfde positie. |
| `confirm_attendance` | Bestaand, uitbreiden | Na werkelijke uitvoering, juiste commissie-/teamurenauthorisatie; één attendance en één geldige urenpost; optioneel één team-entry. Correctiepad bewaart beide tellers. |
| `accept_booking_transfer` | Bestaand, uitbreiden | Alle vereiste consents voor actuele requestversie, beide executors passend, locks op beide posities/obligations; origineel eindigt pas samen met vervangende booking. |
| `approve_team_task_credit` | Façade op reviews/publicatie | Inhoudelijk mandaat indien nodig plus vrijwilligerscommissie; vaste minutes/scope voor nieuwe bookings; bronteamtaak blijft credit0. Geen publicatie-/goedkeuringsretryduplicaten. |
| `release_cluster` | Nieuw voorstel | Commissiegrant en actuele versie; alleen volledig onverdeeld zonder actieve booking/hold; geef posities atomair vrij aan openbare scope. |
| `set_team_goal` | Nieuw voorstel | Eigen-teamgrant, seizoen en versie, integer0–100; individuele override met reden; geen wijziging van obligation of ledger. |
| `dispatch_follow_up` | Workercommand | Occurrence claim met lease, lokale dag/stage, actuele unresolvedstatus/ACL; idempotente intents naar verantwoordelijk huishouden, teamouder of commissie. |
| `save/prepare/accept_handover` | Nieuwe commands | Notitie/checks/volwassen opvolger gecontroleerd; accept alleen geadresseerde geldige actor op exact ready-versie; behoud ander mandaat en alle brondata. |
| `save_task_feedback` | Nieuw voorstel | Aanwezig, uitgevoerd, toegestane actor/subject; valide antwoorden/lengte, eigen voorkeur alleen door executor; geen ledger-effect. |
| `revise_instructions` | Nieuw voorstel | Taakverantwoordelijkheid, immutable nieuwe versie, expliciete toekomstige scope; pas geen boekingsvoorwaarden achteraf aan. |
| `mark_help_seen` | Nieuw voorstel | Alleen eigen Auth-user; upsert unieke topic, mergevriendelijk; geen rol-/persoonselector uit de client. |
| `finalize_financial_assessment` | Bestaand | Lock dezelfde obligationgrondslag als uren/bezwaarcommands; actuele reviews/bronrevisie en nul blockers; één actieve verwerking met cents-snapshot. |
| `close/rollover_season` | Bestaand, uitbreiding teamdata | Controleer blockers en snapshot alle nieuwe teambronnen; nieuwe seizoensverplichtingen/herbevestigingen/templates idempotent. |

Dit zijn domeincommands; transport mag veilige server actions/RPC zijn. Nieuwe HTTP-routes mogen hetzelfde command niet buiten de beschermde kernel dupliceren. Responses onderscheiden validation, forbidden, stale_version, position_unavailable en provider_unknown; stuur geen interne SQL of geheimen naar de client.

## Locks en concurrency

Gebruik één gedocumenteerde globale lockvolgorde voor bestaande en nieuwe commands. Behoud de bestaande lockontwerpen; voeg allocation/reservationchecks binnen dezelfde position-/shift-/obligation-locks toe, niet in een losse voorafgaande clientquery. Meerdere posities worden op stabiele ID gesorteerd. Transfer neemt beide posities/obligations in vaste volgorde. Boekingsconstraints sluiten actieve persoonsinterval-overlap en dubbele actieve position uit. De laatste vrije plaats kan gelijktijdig via openbare markt, team, winterplanning en waitlist slechts één winnaar krijgen.

Alle grondslagwijzigingen van minuten/doel/dekking/bezwaar en financiële finalisering nemen dezelfde obligationlock. Season-close sluit muterende commands consistent af. Deadlocks/retries hebben een begrensde herstelroute met dezelfde idempotencykey, geen herhaald onbeheerd side effect. Verdeeladvies mag verouderen; commit moet een conflict tonen en nieuw voorstel aanbieden.

## Statusovergangen en afgeleide tellers

Onderstaande labels beschrijven het functionele contract; gebruik de bestaande database-enums waar aanwezig en leg de definitieve NL-labelmapping vast. Een statusstring uit de client kan geen transactie overslaan.

| Bron | Toegestane keten | Bij iedere stap behouden/afleiden |
|---|---|---|
| Verenigingstaak | Concept → gecontroleerd gepubliceerd → eventueel wijzigingsvoorstel of annulering | Publicatie-event en instructieversie; toekomstige boekbaarheid uit werkelijk beschikbare posities. Een edit is geen nieuwe eerste publicatie. |
| Plaats | Vrij openbaar óf teamgereserveerd óf tijdelijke hold → geboekt → uitgevoerd; alleen correcte annulering/expiry/vrijgave maakt plaats opnieuw boekbaar | Eén stabiele ID en exclusieve actieve bezetting/hold/allocation. Een uitgevoerde plaats is historisch, niet opnieuw vrije capaciteit. |
| Teamtoewijzing | Gereserveerd → lid gekozen → uitvoerder bevestigd → uitvoering bevestigd | Gekozen lid, uitvoerder en afspraak apart; toewijzing geeft nul telling/uren. Verhindering is opvolging naast bestaande booking. |
| Booking | Ingepland → uitvoering te bevestigen → aanwezig/no-show; of gecontroleerd afgemeld/overgenomen | Afspraak-snapshots en actor; overname maakt nieuwe booking met supersedes-link. No-show = nul credits; correctie is een nieuwe uitvoeringsbeslissing. |
| Uren/teamkrediet | Alleen attendancebesluit → geldige entry → eventueel gemotiveerde tegen-/herstelentry | Retry maakt geen tweede post. HH-minuten en teamtelling blijven consistent met dezelfde concrete uitvoering. |
| Dossierbesluit | Aanvraag → voorstelversie → onafhankelijke reviews → definitief besluit of afwijzing/escalatie | Twee accounts, scope, reden en revision; nieuw voorstel reset bruikbaarheid van oude reviews. Alleen definitief besluit wijzigt dekking/doel. |
| Overdracht | Concept → klaar op versie → geadresseerde acceptatie | Oude teamouder tot accept actief; nieuwe beperkte grant na accept; andere grants en alle taak-/urendata ongewijzigd. |
| Template/beleid | Concept → preview/test/bevoegd akkoord → immutable publicatie → nieuwe conceptversie | Eerdere verzending/acceptatie verwijst naar exacte versie en hash, nooit naar een mutabele laatst-versie. |
| Verzending | Queued → processing onder lease → provider accepted → delivered, failed of unknown/reconcile | Event/recipient/channel/template-dedupe; retry en webhooks houden dezelfde logische boodschap. Accepted bewijst nog geen aflevering. |
| Seizoen | Actief → sluitcontrole → immutable afgesloten → aparte rollover naar nieuw actief seizoen | Blockers/revisions onder lock, historische standen intact; geen automatische extra claim of saldooverdracht. |

Bereken een doelstand uit geldige bronnen. `uitgevoerd` is niet hetzelfde als `ingepland`, `toegewezen` of `pending`; labels, meters, exports en financiering houden die scheiding aan. Voor matching wordt taakduur gebruikt; voor de verplichting wordt goedgekeurde credit gebruikt. Teamdoelremaining is `max(0, doel − bevestigd aantal)`, nog-te-organiseren houdt daarnaast rekening met valide geplande/toegewezen plaatsen, zonder dezelfde plaats tweemaal te wegen.

## Read-models en caches

Maak geautoriseerde projecties voor persoonlijke dashboard/acties, openbare markt, eigen huishoudprogress, gezinsagenda, eigen teamplanning/minimale huishoudstand, portefeuille, feedback, matching en rapportage. Een centrale brede SELECT met clientfilter voldoet niet. Hergebruik bestaande API-views waar correct; zet nieuwe security-invoker-projecties en expliciete scopes op dezelfde wijze neer.

Na commit worden alle betrokken views gerevalideerd. Realtime kan veilige invalidatie met bron-ID/revision sturen, waarna de client onder huidige rechten leest; stuur geen privépayload naar een oude socket. Na intrekking van mandaat, householdgrant of sessie verdwijnen gegevens en stopt toegang ook op export/deeplink/private file.

## Workers en integraties

Gebruik de bestaande notification-intent/outbox/attempt/provider-event- en scheduled-occurrence-tabellen. Eén scheduler claimt lokale occurrences; een worker verwerkt import, digest, push, reminders, opvolging, certificaatverval, waardering en herbevestiging met lease/retry/dead-letter. Leg worker-runtime en health vast: bron-SHA, laatst geslaagde occurrence, lease/retry-backlog en providerstatus. Een workercrash kan een job opnieuw claimen zonder dubbele uren, import, invoice of communicatie.

Supabase Auth-OTP en uitnodigingen vereisen echte afleverroute en gecontroleerde origin/redirects. E-mailadapter, Sportlinkcapabilities en credentials worden na de actuele aansluiting vastgesteld. Staging-uitgaande communicatie blijft sandbox/allowlist, met herkenbare stagingmarkering. Private Storage gebruikt geautoriseerde tijdelijke downloads en valide bestanden. Push gebruikt persoon/device-subscriptions met revoke en endpointopruiming. Financiële V1 mag gecontroleerde factuur/export plus betaalregistratie gebruiken; een betaalprovider is geen bestaande verplichting.

## Migratiepad

1. Reproduceer bestaande zeven migraties lokaal, pgTAP en races. Controleer remote history read-only tegen dezelfde lijst.
2. Voeg nieuwe tabellen/kolommen/constraints/read-models/commands in nieuwe timestamp-migraties toe. Maak uitbreidingen compatible met vorige app waar nodig voor image-rollback.
3. Converteer referentiefixture expliciet naar tenant, echte season/team/person/member en position-ID's. Geen automatische import van localStorage of privégegevens in gebruikersbrowser.
4. Bestaande goedgekeurde public-market-teamtaak houdt dezelfde historische booking/ledger. Nieuwe gesloten scopes worden expliciet aangewezen; geen credits-migratie die historische minuten dupliceert.
5. Pas core booking/presentie/transfer/season-close veilig via nieuwe functiondefinities aan. Breid bestaande RLS-tests plus nieuwe teamauthorisatie/races uit.
6. Test backup/restore en vorige image tegen expanded schema. Pas alleen stagingmigraties uit de release-SHA toe vóór app-mode-deploy; geen remote reset, repair of squash als normale release.

De bestaande repo heeft veel tabellen maar slechts een deel van de gebruikersflows. “Tabel bestaat” of “RPC compileert” is geen afgeronde pagina. De route-dekkingsmatrix en stagingtests blijven beslissend.
