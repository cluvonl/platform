# Staging — nieuwe alleen-lezen SendGrid-status op c3c24f4

De [werkelijk uitgevoerde workflow](https://github.com/cluvonl/platform/actions/runs/37608661920) op bron `c3c24f41ee9d6e3a2d4b21b0f843cabb7b9b2d37` is geslaagd. Het ongewijzigde veilige [rapport](status-results.json) is waargenomen op `2026-10-07T10:38:00.112Z`; SHA256 `d0b68754ccbe3a47f916832cd7fafd09d7fddd28ba04797ebf8586d6e27c503a`.

De volledig gelezen gefilterde domeinpagina bevat nog nul exacte `cluvo.nl`-matches in de huidige API-key/accountscope. Een geslaagde domeinverificatie is daarin nog niet zichtbaar. Dit controleert gecachete providergegevens; geen live DNS-validatie of conclusie over andere accounts/subusers. De gebruiker verzorgt de SendGrid-verificatie en gegenereerde Hostnet-records zelf.

Activity is toegankelijk en toont één passende kandidaat met `not_delivered` en de afgeleide vaste categorie voor afzenderauthenticatie. De originele verzending blijft zonder behouden provider-ID niet uniek gebonden: `delivery_status=UNKNOWN` en `original_send_message_binding_verified=false`. Het creditsaldo is positief. De gebruiker meldde eerder geen ontvangst; dit is geen nieuwe inboxwaarneming.

Alle calls waren GET. Geen nieuwe mail, providerconfiguratie, DNS, account, databasewijziging of sleutel uitgevoerd. SMTP/Native OTP/uitnodigingsaflevering, gebruikersontvangst, volledige V1 en productie blijven false.
