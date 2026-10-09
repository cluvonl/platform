const bookingStates: Record<string, string> = {booked: 'Ingepland', reconfirmation_required: 'Nieuwe afspraak te bevestigen', transfer_pending: 'Vervanger gezocht', performed_pending: 'Ter controle', confirmed: 'Uitvoering bevestigd', cancelled: 'Afgemeld', transferred: 'Overgenomen', no_show: 'Niet uitgevoerd'};
const financeKinds: Record<string, string> = {receipt: 'Bijdrage ontvangen', reservation: 'Bedrag gereserveerd', reservation_release: 'Reservering vrijgegeven', release: 'Reservering vrijgegeven', expenditure: 'Besteding betaald', payment: 'Besteding betaald', expense: 'Besteding betaald', correction: 'Correctiepost', reversal: 'Correctiepost'};
export const bookingStateLabel = (state: string) => bookingStates[state] ?? 'Afspraak in verwerking';
export const financeKindLabel = (kind: string) => financeKinds[kind] ?? 'Vastgelegde financiële registratie';

export const questionStateLabel = (state: string) => ({open: 'Vraag ingediend', in_progress: 'In behandeling genomen', answered: 'Terugkoppeling gegeven', closed: 'Afgesloten'} as Record<string, string>)[state] ?? state;
