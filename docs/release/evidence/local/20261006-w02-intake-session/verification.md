# 6 oktober 2026 — bestaande intake bij sessieverlies en verloren antwoord

Afzonderlijke lokale regressie op de dertien-migratiedatabase en synthetische
core-v1-accounts. Zeven uitgevoerde browsercontroles slagen met echte lokale OTP
en SMTP-opvang. Een verlopen sessie stuurt de geladen opslagactie naar de login
zonder nieuwe antwoordversie, audit of urenpost. Een werkelijk opgeslagen actie
waarvan het HTTP-antwoord wordt afgebroken, behoudt de draft, versiebasis en
idempotencykey; herhalen houdt één antwoordversie, command en audit over.

Het bestaande opslagformulier is hiervoor niet gewijzigd. Dit bewijs is een
controle van bestaand gedrag, geen bewijs van een gerepareerde redirectbug.
De zes beelden zijn lokaal; staging en echte mailaflevering zijn niet bewezen.
De [nieuwe jaarlijkse intakeproef](../20261006-w02-intake-reconfirmation/verification.md)
bevat een afzonderlijke herhaling op migratie 14 met de actuele appbuild.
Alle V1-criteria blijven OPEN.
