# Vier intake-stappen — visueel deelbewijs

[Open de vergelijking](compare.html). De twaalf paren bevatten alle vier stappen
op 1440×1024, 390×844 en 768×1024. Referentie: ongewijzigde prototype-SHA
`e9c1d8bca2089b0944577eed73d1bedf7e70a3b6`, rol lid. App: lokale production
standalone, synthetisch account A via echte Supabase Auth.

De mobiele beschikbaarheidsstap is visueel gecontroleerd. Club Signal-topbar,
achtergrond, rustige kaart, stepper, invoervelden, keuzeknoppen en vorige/verder-
bediening zijn behouden. Captures beginnen op scrollpositie nul; bij deze
schermformaten is geen horizontale overflow gemeten. Alle twaalf paren en de
overlay-/opacitybediening zijn met de browser geladen en gecontroleerd.

De fixtures verschillen: naam, antwoorden, categorie-aanbod en dossierstand.
De app heeft haar uitleg al gezien tijdens de regressieproef en toont expliciet
persoonlijke bevoegdheid en opgeslagen status. De maandwaarde is 1:30 voor de
bevestigde 90 minuten. De reference gebruikt zes voorbeeldcategorieën; de app
haalt de ene beschikbare categorie uit de testtenant. De huishouddossiermodal
is nog een deelimplementatie.

Het manifest bevat 37 lokale beelden: 24 vierstappencaptures en 13 bestaande
ketencaptures. Dit is geen pixelvergelijking met een gelijke fixture en geen
volledige visuele acceptatie van 23 pagina's, alle rollen of staging. V23 blijft
OPEN. De uitgebreide oorspronkelijke nulmeting blijft in het W01-bewijs.
