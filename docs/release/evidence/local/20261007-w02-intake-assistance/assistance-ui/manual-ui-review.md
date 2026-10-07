# Visuele controle van intakehulp

Werkelijk bekeken: de screenshots van de ingevulde machtiging op 390 pixels, het verloren intrekantwoord op 768 pixels en het intrekformulier op 1440 pixels. Dit bewijs hoort bij standalonebuild `yV9pfW6gnUW3qIaEFbYU9`.

De bestaande Club Signal-navigatie, rustige kaarten, typografie en mobiele indeling blijven zichtbaar. De uitgevoerde browserproef controleerde daarnaast alle negen vastgelegde toestanden op 390, 768 en 1440 pixels: geen horizontale overflow of hydration mismatch.

Er staat nog een visuele correctie open: de nieuwe formulieren gebruiken ruwe HTML-controls. Labels en selectvelden renderen naast elkaar; de tekstvelden missen de bestaande veldstyling. Ook de terug-link met alleen `a.btn` renderde als een smalle inline-link. Gebruik de bestaande `Field`-, `Select`-, `Textarea`- en knopcomponenten, met behoud van de huidige kaarten en navigatie, en leg daarna nieuwe beelden van de aangepaste build vast. Deze controle geeft daarom nog geen finale visuele acceptatie van de nieuwe formulieren.
