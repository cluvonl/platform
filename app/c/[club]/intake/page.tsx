import {randomUUID} from 'node:crypto';
import {IntakeForm} from '@/components/app/intake-form';
import {requireWorkspace} from '@/lib/auth/workspace';

type IntakeRow = {profile_id: string; person_id: string; household_context_id: string; version: number; status: string; desired_minutes: number | null; annual_confirmed_at: string | null; answers: Record<string, unknown> | null};

export default async function IntakePage({params}: {params: Promise<{club: string}>}) {
  const {club} = await params;
  const {client, workspace} = await requireWorkspace(club);
  const {data, error} = await client.schema('api').from('my_intake')
    .select('profile_id,person_id,household_context_id,version,status,desired_minutes,annual_confirmed_at,answers')
    .eq('tenant_id', workspace.tenant_id).eq('person_id', workspace.person_id).limit(1);
  const intake = (data?.[0] ?? null) as IntakeRow | null;
  return (
    <div className="secure-page page-enter">
      <p className="secure-eyebrow">PERSOONLIJK EN AFGESCHERMD</p><h1>Mijn intake</h1>
      <p className="secure-lead">Deze antwoorden horen bij jou. Andere ouders, teamouders en onbevoegde commissieleden kunnen ze niet opvragen.</p>
      {error ? <p className="auth-error" role="alert">De intake kan nu niet worden geladen.</p> : null}
      {!error && !intake ? <section className="secure-empty"><h2>Nog geen intakeprofiel</h2><p>Een bevoegde contactpersoon moet eerst een persoonlijk profiel in jouw huishoudcontext aanmaken.</p></section> : null}
      {intake ? <IntakeForm club={club} record={intake} idempotencyKey={randomUUID()} /> : null}
    </div>
  );
}
