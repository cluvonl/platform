# Visuele nulmeting en vergelijking — 6 oktober 2026

Norm: Club Signal, prototype `e9c1d8bca2089b0944577eed73d1bedf7e70a3b6`.
[Capturemanifest met hashes](capture-manifest.json).

De referentie bevat 69 full-pagebeelden: alle 23 default-pagina's als bestuur,
op 1440×1024, 390×844 en 768×1024. Voor de drie aangesloten apppagina's zijn
bovendien negen referentiebeelden als lid vastgelegd. De prototypefixture is
ongewijzigd, met haar klok op 6 oktober 2026. Taal nl-NL, tijdzone
Europe/Amsterdam, reduced-motion en geladen fonts zijn vastgezet. De sourcecopy
loopt zelfstandig; zij is geen productieruntime.

De app heeft 13 beelden: overzicht, intake en markt met unseen uitleg op drie
formaten, plus overzicht met de paginauitleg gesloten op vier formaten
(inclusief 320×844). De appbeelden komen uit de production standalone-build met
echte lokale Auth. Alleen synthetische personen/tenants uit de core-SQL-fixture
worden getoond. Geen OTP-, sessie- of tokenbeeld is vastgelegd.

## Waargenomen verschillen

| Onderdeel | Beoordeling en vervolg |
|---|---|
| Sidebar 244px, logo, donker clubblok, topbar, breadcrumb en footer | Bestaande Club Signal-componenten/tokens hergebruikt. Geen nieuwe ontwerprichting. |
| Kaarten, typography, koraalvlak, inzetcirkel, badges, buttons en uitleg | Zelfde componenten/CSS. Inhoud en getallen komen nu uit serverprojecties. |
| Demo-rol/persoonswisselaar versus echte profiel-/werkruimtekeuze | Functioneel app-modeverschil; de serververleende scopes bepalen toegang. |
| Referentiehuishouden Vermeer versus apphuishouden A | Verschillende synthetische fixtures; getallen/labels vormen geen pixelpariteitsbewijs. |
| Bestuursdashboard versus eigen huishoudstand | Alleen eigen geautoriseerde stand aangesloten. Clubaggregaten en acties/teammeters nog OPEN. |
| Volledig referentiemenu versus aangesloten appnavigatie | Nog ontbrekende pagina's staan in de 219-functiematrix. Dit verschil is onvoltooide scope. |
| Referentie-marktfilters/dialoog versus eenvoudige echte plaatsbooking | Serverketen werkt; groepering, filters, volledige uitvoerderkeuze, buddy/instructieflow en modalen nog OPEN. |
| Vierstappenintake versus huidig eigen intakeformulier | Bestaande serveropslag hergebruikt; volledige prototypeflow nog OPEN. |
| Extra uitvoerderformulier op overzicht | Bestaande echte uitnodigingsroute, in Club Signal-panel. Volledige dossierwerkruimte volgt in W02. |
| Mobiel | Vier breedtes gecontroleerd zonder horizontale pagina-overflow; drawerlogout, toetsenbord en echte touch uitgevoerd. |
| Framework-devindicator | Alleen de ontwikkeloverlay uit captures weggelaten; productcontrols zijn niet verborgen. |

De gele paginauitleg staat onder de paginatitel, en de huishoudhulp in haar
panel. De browserproef controleert beide sluitacties, persistente serveropslag,
geen herhaling na reload, een andere echte gebruiker en herstel na een
verbindingsfout. Op 320px wikkelt het signal-panel zodat de CTA en meter leesbaar
blijven. De bestaande menu- en formcontrols blijven bereikbaar.

Deze vergelijking is gecontroleerd op layout, primaire bediening en overflow.
Er is geen automatische pixel-PASS, volledige role/state/tab/modal-capture of
stagingvergelijking geclaimd. Alle V00–V23 en H05 blijven OPEN. De registers
bevatten de overige te capturen tabs en dialogen.
