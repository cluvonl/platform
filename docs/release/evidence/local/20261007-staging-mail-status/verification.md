# Alleen-lezen mailstatuscontrole

De gebruiker meldt na de ene geaccepteerde SendGrid-testmail dat deze nog niet ontvangen is. De nieuwe handmatige statusworkflow doet uitsluitend GET-verzoeken voor die testrun: exacte afgeschermde ontvanger, afzender, onderwerp en een expliciet tijdvenster vanaf de verzending. Geen nieuwe mail, providerinstelling, aankoop of databasewijziging.

[validation.json](validation.json) legt parentcommit `9bd1cc19a398086b2177304870eb53c04e1d3db9`, finale bronhashes, 82 geslaagde Node-tests en geslaagde lint vast. Vijf gerichte proeven controleren GET-only, scopeweigering vóór netwerkverkeer, privéfoutredactie, een begrensde responsebody, ontbrekende/multiple matches en afzonderlijke provideraflevering versus daadwerkelijke gebruikersontvangst. Alle zestien gepubliceerde migraties en de lockfile blijven behouden.

De controle gebruikt de officiële [SendGrid-filterroute](https://www.twilio.com/docs/sendgrid/api-reference/email-activity/filter-all-messages) en [detailsroute](https://www.twilio.com/docs/sendgrid/api-reference/email-activity/filter-messages-by-message-id). Providerbody, ontvanger, query-URL, message-ID en eventredenen blijven uitsluitend in procesgeheugen. Alleen vaste statuses, vaste foutcodes en eventcounts worden geëxporteerd. Zonder uniek herkend bericht wordt geen afleverclaim gemaakt. Aanvullende Activity-rechten of history worden niet automatisch ingericht of gekocht.

De hosted statusproef is bij deze lokale capture nog niet uitgevoerd. Native OTP, SMTP, uitnodigingen, volledige appkoppeling, backup/restore, V1 en productie blijven afzonderlijke open bewijspunten.
