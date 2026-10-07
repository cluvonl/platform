# Eén geautoriseerde stagingtestmail — 9bd1cc1

De gebruiker koos het persoonlijke testadres en vroeg om ontvangstbevestiging. Dat adres staat uitsluitend in de GitHub Environment-secrets `STAGING_TEST_RECIPIENT` en de exacte `MAIL_ALLOWLIST`.

De [eenmalige handmatige mailworkflow](https://github.com/cluvonl/platform/actions/runs/37591201027) is geslaagd op exact `9bd1cc19a398086b2177304870eb53c04e1d3db9`, branch staging. Er is één SendGrid-POST gedaan, met sandboxmodus uit en afzender `info@cluvo.nl`. De provider antwoordde HTTP 202. [mail-results.json](mail-results.json) is een ongewijzigde kopie van het veilige artifact: uitkomst ACCEPTED, `email_request_attempted=true`, geen retry of rerun.

Onderwerp: **Cluvo — testmail voor staging**. Na de provideracceptatie is de gebruiker gevraagd of de mail ontvangen is, ook in de spammap. De gebruiker antwoordde vervolgens: **Nog niet ontvangen**. Het oorspronkelijke providerartifact blijft ongewijzigd; deze latere terugkoppeling bevestigt dat daadwerkelijke ontvangst nog niet bewezen is. Er is geen tweede mail verstuurd. Geen ontvangerwaarde, providerbody, message-ID, credential of token is opgeslagen.

Deze mail maakt geen Auth-account aan en bewijst nog geen Supabase SMTP, OTP-login, uitnodigingsflow of transactionele appworker. Er zijn geen databasewijzigingen of productieacties uitgevoerd. V1-acceptatie blijft OPEN.
