# 07 — Visuele en interactionele overeenkomst

## De norm

De actuele Site-bron op commit `e9c1d8bca2089b0944577eed73d1bedf7e70a3b6` is de norm voor Club Signal. Behoud `app/globals.css`, team-workspace-/coordination-/help-bannercss en alle gekoppelde assets/componenten. De live URL is `https://cluvo-prototype.dgwebserv.chatgpt.site`; toegang volgt de bestaande eigenaarinstelling. De ZIP-bron is daarom de betrouwbare overdraagbare referentie voor Codex, ook als het live prototype niet toegankelijk is in zijn browser.

De inventarisatie in dit pakket is een volledige bronanalyse per pagina/functionele interactie. Er is in deze overdrachtsronde geen nieuwe complete browserwandeling/screenshotset gemaakt; er wordt dus geen visuele browseracceptatie geclaimd. De twee oudere WP0-screenshots in het pakket zijn historische layoutvoorbeelden en missen de latere uitbreidingen.

## Reproduceerbare nulmeting

Gebruik een kopie van de referentiebron, installeer met de meegeleverde lockfile en start met de scripts uit die referentie. De Site-exportscript is statisch en hoort niet de dynamische VPS-build te vervangen. Zet demo-state terug naar de meegeleverde seed en laat de coordination-clock op 6 oktober 2026. Gebruik vaste taal nl-NL, timezone Europe/Amsterdam en laat fonts/assets laden vóór capture. Capture dezelfde branch, fixture, rol, persoon, viewport, tab en geopende dialoog in referentie en staging.

| Profiel | Minimum |
|---|---|
| Desktop | 1440 × 1024; identieke zoom en device scale bij vergelijkingsparen. |
| Mobiel | 390 × 844; echte touch/form flow; geen uitsluitend iframebewijs. |
| Middelbreed | 768 × 1024 voor sidebar, segmentoverflow, modalen en tabellen. |
| Bannerstates | Nog niet gezien; kruisje gesloten; Gezien gesloten; herladen; andere echte gebruiker. |
| Taakstates | Concept/open/full/wachtlijst, reserved team, assigned/no executor, confirmed, performed, disputed, takeover. |
| Teamstates | Markt/Planning/Voortgang/Huishoudens/Slim verdelen/Opvolging/Overdracht; eigen lid en teamouder. |
| Rechtenstates | Lid, vrijwilliger, commissiecoördinator, teamouder, commissie, financieel beheer, bestuur en echte portefeuillehouder. |

Het JSON-register `registers/visuele-checklist.json` bevat iedere pagina en de verwachte tabs. Voeg vanuit `registers/ui-broninventaris.json` ieder werkelijk bereikt dialoog-/formulier toe. Dynamische titels worden met de fixture ingevuld. Legacy-functies `Teams` uit collaboration en `TeamActions` worden niet als actieve schermen gerekend; de huidige app gebruikt `TeamWorkspace` en `NextActions`.

## Wat gelijk moet zijn

- Logo, sidebarbreedte/-structuur, menu-iconen, clubblok, topbar, breadcrumb, typography, hoofdkoppen, achtergrond en footer.
- Kleurwaarden, kaarten, randen, radius, badges, shadow, meters, knoppen, iconen, invoervelden en spacing uit bron-CSS.
- Gele uitleg boven de juiste functie, met icoon en twee toegankelijke sluitacties. Geen informatieflits voor eerder gezien.
- Dezelfde tabs, filters, modalvorm/volgorde, inhoudshiërarchie en functionele lege toestanden.
- Planbordblokken, drag/form-equivalent, kanbankolommen, teamcards, tijdlijn, doelenmeters en overdrachtspaneel.
- Mobiele sidebar, breedtegedrag, touchdoelen, modal-scroll, horizontaal scrollbare datatabellen en zichtbare foutmeldingen.

Echte staging vervangt de vrije demo-persoon/rolkeuze en footer/demo-simulatiestatus door echte geautoriseerde werkruimte/status, binnen dezelfde ontwerpstijl. Echte laad-, fout-, sessie- en conflictstates zijn nodig. Ontbrekende canoncontrols zoals dubbele ruilinstemming of betaalde correctie worden opgebouwd uit dezelfde componenten; geen nieuw generiek dashboard.

## Controle en bewijs

Capture full-page en belangrijke modalen; maak side-by-side en overlaydiff. Leg verschillen per screenshot-ID vast als functionele inhoud, rechtmatig app-mode-verschil of onbedoelde visuele regressie. Een automatische pixeldiff helpt vinden, maar vaste percentages zijn geen automatische goedkeuring: een verdwenen CTA kan klein zijn en toch de functie breken. Beoordeel alle primaire controles, tekstafbreking, meters, hover/focus en mobile-overflow handmatig naast de screenshotdiff.

Iedere ontbrekende screenshot/capture blijft OPEN. Bewijs bewaart referentie-SHA, staging-SHA, fixture, account/rolscope, viewport, route/tab/modal, tijd en uitkomst. Dit pakket verlangt volledige paginadekking; alleen het dashboard opnieuw bekijken is niet genoeg. Gouden screenshots worden niet aangepast om een regressie te verbergen.

Controleer keyboardfocus, Escape/close, labels, Enter, niet vooraf aangevinkte akkoordcheckboxes, aria-live foutmelding, contrast en reduced-motion met de bestaande rustige page-enterstijl. Bewegende decoratie heeft geen prioriteit boven correcte taak- en dossierflows.
