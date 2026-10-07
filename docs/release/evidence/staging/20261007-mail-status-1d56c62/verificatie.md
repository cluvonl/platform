# Stagingmailstatus — 7 oktober 2026

Broncode-SHA: `1d56c628969249c2a0b8e0dd7967a42dc9044dae`. De daadwerkelijke read-only diagnostiek is uitgevoerd in [GitHub Actions-run37600314465](https://github.com/cluvonl/platform/actions/runs/37600314465). Het rapport is waargenomen op `2026-10-07T09:24:02.282Z` en onderzoekt de oorspronkelijke testverzending uit run `37591201027`.

`staging-mail-status.json` is byte voor byte overgenomen uit het reeds gesaniteerde bronrapport. SHA256: `ed1dff73ac67e8eac7fdf9d6a7be881f244905254d095c91a7bbcdb3354869d5`. De kopie en de toegestane vaste stringwaarden zijn lokaal gecontroleerd; hierbij zijn geen providerverzoeken uitgevoerd.

Er is één kandidaat die voldoet aan de private ontvanger/afzender/onderwerp/tijd-filtercriteria. Zijn providerstatus is `not_delivered`, met één bekend processed-event en één ongeclassificeerd event. De koppeling met het exacte oorspronkelijke SendGrid-message-ID is **niet bewezen** (`original_send_message_binding_verified=false`); de oorspronkelijke verzendstatus blijft daarom **UNKNOWN**. `passed=true` betekent dat de beperkte diagnostiek is geslaagd, niet dat de mail is afgeleverd.

Een private providerreden is uitsluitend vertaald naar de vaste categorie `SENDER_AUTHENTICATION_REPORTED`. Dat is een inferentie uit toegestane tekstpatronen, geen bewezen oorzaak of bevestiging van de actuele DNS-configuratie. De accountcredits zijn via GET beschikbaar en positief (`balance_positive=true`); bedragen zijn niet geëxporteerd.

De gefilterde GET voor sender-domainmetadata van `cluvo.nl` geeft HTTP200, exact0 matches en `filtered_page_complete=true`. Binnen die onderzochte, complete filterpagina is geen exacte domeinmatch gevonden. Dit is beperkte cached providermetadata, geen live DNS-verificatie, succesvolle SendGrid Verify of bewijs over subuseraccounts buiten de onderzochte scope.

De gebruiker heeft de testmail nog niet ontvangen. Het laatste gebruikersantwoord is dat de eigenaar de inrichting zelf via SendGrid en Hostnet uitvoert. Er is nog geen succesvolle Verify of aansluitende verificatie/readback van die nieuwe inrichting vastgelegd.

Geen nieuwe mails verstuurd, geen DNS-, provider- of databaseinstellingen gewijzigd. Ontvangst, SMTP-configuratie, Native OTP en uitnodigingsaflevering blijven onbewezen. Het bewijs bevat geen ontvangeradres, message-ID, ruwe providerreden/-body, DNS-recordwaarden, accountbedragen of credentials. `v1_ready` en `production_enabled` blijven false.
