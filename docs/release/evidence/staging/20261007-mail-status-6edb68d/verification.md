# Uitgevoerde alleen-lezen mailstatus — 6edb68d

De [handmatige statusrun](https://github.com/cluvonl/platform/actions/runs/37593990203) is geslaagd op exact `6edb68d667e2a9d43867ad054b3f3660c1e7ef41`, na groene main-CI en stagingpromotie. [status-results.json](status-results.json) is het ongewijzigde veilige artifact; SHA-256 `4a36ddc3817e3ed61f830970632ab2a2b4ff33f82522adfad2a613124c1df432`.

De Email Activity API is daadwerkelijk toegankelijk. Eén bericht voldoet aan de afgeschermde ontvanger, afzender, onderwerp en laatste-eventtijdscope van de ene [geaccepteerde mailproef](../20261007-mail-9bd1cc1/verification.md). De gevalideerde kandidaat heeft status `not_delivered` en één `processed`-event. De gebruiker meldt dat de mail nog niet is ontvangen.

De oorspronkelijke provider-ID is niet vastgelegd bij verzending. Daarom is de precieze binding aan de oorspronkelijke verzending onbewezen: `delivery_status=UNKNOWN`, `original_send_message_binding_verified=false`, `actual_delivery_verified=false` en `user_receipt_verified=false`. De kandidaatstatus is afzonderlijk vastgelegd.

Deze run deed uitsluitend GET-verzoeken en heeft geen mail, database- of providerwijziging uitgevoerd. Providerbody, ontvanger, message-ID en redenen zijn niet geëxporteerd. Foutcategorieën en creditmetadata zijn in deze bronversie nog niet onderzocht. SMTP, Native OTP, uitnodigingen, V1 en productie blijven open.
