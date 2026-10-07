# Alleen-lezen mailstatuscontrole

De gebruiker meldt na de ene geaccepteerde SendGrid-testmail dat deze nog niet ontvangen is. De nieuwe handmatige statusworkflow doet uitsluitend GET-verzoeken voor die testrun: exacte afgeschermde ontvanger, afzender, onderwerp en een expliciet tijdvenster vanaf de verzending. Geen nieuwe mail, providerinstelling, aankoop of databasewijziging.

[Finale validatie](validation-candidate-status.json) legt de parentcommit, finale bronhashes, 83 geslaagde Node-tests en geslaagde lint vast. Zes gerichte proeven controleren GET-only, scopeweigering vóór netwerkverkeer, privéfoutredactie, een begrensde responsebody, ontbrekende/multiple matches en afzonderlijke provideraflevering versus daadwerkelijke gebruikersontvangst. Een geweigerde of vreemde detailresponse laat geen positieve status in het rapport staan. Alle zestien gepubliceerde migraties en de lockfile blijven behouden.

De controle gebruikt de officiële [SendGrid-filterroute](https://www.twilio.com/docs/sendgrid/api-reference/email-activity/filter-all-messages) en [detailsroute](https://www.twilio.com/docs/sendgrid/api-reference/email-activity/filter-messages-by-message-id). Providerbody, ontvanger, query-URL, message-ID en eventredenen blijven uitsluitend in procesgeheugen. Alleen vaste statuses, vaste foutcodes en eventcounts worden geëxporteerd. Zonder uniek herkend bericht wordt geen afleverclaim gemaakt. Aanvullende Activity-rechten of history worden niet automatisch ingericht of gekocht.

De hosted statusproef is bij deze lokale capture nog niet uitgevoerd. Native OTP, SMTP, uitnodigingen, volledige appkoppeling, backup/restore, V1 en productie blijven afzonderlijke open bewijspunten.

Een match op ontvanger, afzender, onderwerp en laatste eventtijd is uitsluitend een kandidaat. De oorspronkelijke provider-ID is bij verzending niet bewaard; de binding aan precies de oorspronkelijke verzending blijft daarom expliciet onbewezen. Het rapport onderscheidt de kandidaatstatus van `delivery_status=UNKNOWN` en houdt `original_send_message_binding_verified=false`.

De [eerste 82-testcapture](validation.json) blijft bevroren met haar eigen eerdere bronhashes. Zij geldt niet als bewijs voor de latere kandidaatstatus- en detailfoutcorrectie.
