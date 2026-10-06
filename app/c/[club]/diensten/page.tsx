import {randomUUID} from 'node:crypto';
import {BookShiftForm, type ObligationOption} from '@/components/app/book-shift-form';
import {requireWorkspace} from '@/lib/auth/workspace';
import {AccountHelpBanner} from '@/components/app/help-provider';
import {Badge, PageTitle} from '@/components/cluvo/ui';

type ShiftRow = {
  shift_id: string;
  shift_version: number;
  position_id: string;
  position_ordinal: number;
  title: string;
  starts_at: string;
  ends_at: string;
  credit_minutes: number;
  location_name: string | null;
  available: boolean;
};
type BookableObligationRow = {
  obligation_id: string;
  label: string;
  valid_from: string;
  valid_until: string | null;
};

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

export default async function ShiftsPage({params}: {params: Promise<{club: string}>}) {
  const {club} = await params;
  const {client, workspace} = await requireWorkspace(club);
  const [marketResult, obligationsResult, tenantResult] = await Promise.all([
    client.schema('api').rpc('list_shift_market', {p_tenant_id: workspace.tenant_id}),
    client.schema('api').rpc('list_bookable_obligations', {
      p_tenant_id: workspace.tenant_id,
      p_person_id: workspace.person_id,
    }),
    client.schema('api').from('public_tenants').select('timezone').eq('tenant_id', workspace.tenant_id).limit(1),
  ]);
  const loadError = marketResult.error ?? obligationsResult.error ?? tenantResult.error;
  const shifts = (marketResult.data ?? []) as ShiftRow[];
  const bookableObligations = (obligationsResult.data ?? []) as BookableObligationRow[];
  const timezone = tenantResult.data?.[0]?.timezone ?? 'UTC';

  return (
    <div className="page-enter">
      <PageTitle eyebrow="SAMEN MAKEN WE DE CLUB" title="Vind jouw verenigingstaak." description="Kies een taak die past bij jou. Bevestigde uitvoering telt mee voor jouw huishouden." />
      <AccountHelpBanner topicId="page.taken" />
      {loadError ? <p className="auth-error" role="alert">Het actuele dienstenaanbod kan nu niet veilig worden geladen.</p> : null}
      {!loadError && shifts.length === 0 ? <section className="secure-empty"><h2>Geen gepubliceerd aanbod</h2><p>Er zijn nu geen toekomstige diensten om te tonen.</p></section> : null}
      <div className="cards-grid">
        {shifts.map((shift) => {
          const obligations: ObligationOption[] = bookableObligations
            .filter((row) => (
              new Date(row.valid_from).getTime() <= new Date(shift.starts_at).getTime()
              && (!row.valid_until || new Date(row.valid_until).getTime() >= new Date(shift.ends_at).getTime())
            ))
            .map((row) => ({id: row.obligation_id, label: row.label}));
          return (
          <article className="task-card account-task-card" key={shift.position_id}>
            <div>
              <Badge tone={shift.available ? 'green' : 'neutral'}>{shift.available ? 'Beschikbaar' : 'Bezet of gesloten'} · plaats {shift.position_ordinal}</Badge>
              <h3>{shift.title}</h3>
              <p className="mini-details">{formatDate(shift.starts_at, timezone)} – {formatDate(shift.ends_at, timezone)}</p>
              <p>{shift.location_name ?? 'Locatie volgt'}</p>
              <p className="card-footnote">{shift.credit_minutes} minuten na bevestigde uitvoering</p>
            </div>
            {shift.available ? (
              <BookShiftForm
                club={club}
                shiftId={shift.shift_id}
                positionId={shift.position_id}
                shiftVersion={shift.shift_version}
                idempotencyKey={randomUUID()}
                obligations={obligations}
              />
            ) : <span className="shift-unavailable">Bezet of gesloten</span>}
          </article>
          );
        })}
      </div>
    </div>
  );
}
