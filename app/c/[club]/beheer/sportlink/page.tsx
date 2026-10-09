import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {Badge} from '@/components/cluvo/ui';
import {SportlinkConfigureForm, SportlinkTestForm} from '@/components/app/sportlink-connection-forms';
import {readSportlinkState} from '@/lib/sportlink/server';
import type {SportlinkTestCode} from '@/lib/sportlink/contracts';

export const dynamic = 'force-dynamic';
const testLabels: Record<SportlinkTestCode, string> = {VERIFIED_READ_ACCESS: 'Leesaanvraag bevestigd', PROVIDER_DENIED: 'Toegang geweigerd',
  PROVIDER_UNAVAILABLE: 'Sportlink niet bereikbaar', INVALID_SOURCE_RESPONSE: 'Antwoord vraagt controle', CONTRACT_UNAVAILABLE: 'Wedstrijdprogramma ontbreekt'};
function date(value: string) {return new Intl.DateTimeFormat('nl-NL', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(new Date(value));}

export default async function SportlinkPage({params}: {params: Promise<{club: string}>}) {
  const {club} = await params;
  const result = await readSportlinkState(club);
  const connection = result.status === 'available' ? result.state.connection : null;
  const connectionId = connection?.id ?? randomUUID();
  return <div className="secure-page page-enter">
    <p className="secure-eyebrow">VERENIGINGSBEHEER</p>
    <h1>Sportlink &amp; wedstrijden</h1>
    <p className="secure-lead">Beheer de Sportlink-koppeling van jouw vereniging en controleer de beschikbare wedstrijdbron.</p>
    {result.status === 'forbidden' ? <section className="secure-empty"><h2>Geen toegang tot deze koppeling</h2><p>Voor deze instellingen is een actuele bevoegdheid voor wedstrijdimport nodig.</p></section>
      : result.status === 'unavailable' ? <p className="auth-error" role="alert">De koppeling kan nu niet veilig worden geladen. Vernieuw de pagina om het opnieuw te proberen.</p>
      : <div className="stack">
        <section className="panel pad stack" aria-labelledby="sportlink-status-title">
          <div className="row between wrap"><h2 id="sportlink-status-title">De koppeling van deze vereniging</h2><Badge tone="amber">{connection?.configured ? 'In voorbereiding' : 'Nog niet ingesteld'}</Badge></div>
          <p className="small-text">{connection?.configured ? 'Een ClientID is opgeslagen voor deze vereniging.' : 'Voeg de ClientID van deze vereniging toe om de leesverbinding te controleren.'}</p>
          {connection?.test ? <p role="status">{testLabels[connection.test.code]} · {date(connection.test.checkedAt)}</p> : connection?.configured ? <p className="small-text">Deze opgeslagen koppeling heeft nog geen bevestigde verbindingstest.</p> : null}
          {connection?.lastSuccessAt ? <p className="small-text">Laatste volledige wedstrijdimport: {date(connection.lastSuccessAt)}</p> : <p className="small-text">Er is nog geen volledige wedstrijdimport bevestigd voor deze koppeling.</p>}
        </section>
        <section className="panel pad stack" aria-labelledby="sportlink-client-title"><h2 id="sportlink-client-title">{connection?.configured ? 'ClientID wijzigen' : 'ClientID toevoegen'}</h2>
          <SportlinkConfigureForm key={`configure:${connectionId}:${connection?.version ?? 0}`} club={club} connectionId={connectionId} expectedVersion={connection?.version ?? 0} idempotencyKey={randomUUID()} configured={connection?.configured ?? false} />
        </section>
        {connection?.configured && connection.status !== 'disabled' ? <section className="panel pad stack" aria-labelledby="sportlink-check-title"><h2 id="sportlink-check-title">Verbinding controleren</h2>
          <SportlinkTestForm key={`test:${connection.id}:${connection.version}`} club={club} connectionId={connection.id} expectedVersion={connection.version} idempotencyKey={randomUUID()} />
        </section> : null}
        <section className="panel pad stack"><h2>Wedstrijden zorgvuldig overnemen</h2><p className="small-text">Na de verbindingstest moeten de Sportlink-teams aan de juiste verenigingsteams worden gekoppeld. Wedstrijden worden daarna gecontroleerd geïmporteerd; bestaande diensten blijven hun eigen afspraken houden.</p>
          <p className="small-text">Ontbrekende wedstrijdgegevens blijven onbekend. Een fout in de verbinding verandert de laatst bekende wedstrijden niet in afgelastingen.</p>
          <Link className="btn secondary row" href={`/app/c/${encodeURIComponent(club)}/agenda?layer=matches`}>Naar mijn gezinsagenda</Link>
        </section>
      </div>}
  </div>;
}
