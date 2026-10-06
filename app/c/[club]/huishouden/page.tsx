import {randomUUID} from 'node:crypto';
import {requireWorkspace} from '@/lib/auth/workspace';
import {loadHouseholdDossier} from '@/lib/data/household';
import {HouseholdDossierTabs} from '@/components/app/household-dossier';
import {Empty, PageTitle, Panel} from '@/components/cluvo/ui';
import {z} from 'zod';

export default async function HouseholdPage({params, searchParams}: {params: Promise<{club: string}>; searchParams: Promise<{household?: string; season?: string}>}) {
  const [{club}, selection] = await Promise.all([params, searchParams]);
  const {client, workspace} = await requireWorkspace(club);
  const householdId = z.string().uuid().safeParse(selection.household), seasonId = z.string().uuid().safeParse(selection.season);
  const result = householdId.success && (!selection.season || seasonId.success)
    ? await loadHouseholdDossier(client, workspace.tenant_id, householdId.data, seasonId.success ? seasonId.data : null) : {data: null, error: null};
  return <div className="page-enter"><PageTitle eyebrow="MIJN HUISHOUDEN" title={result.data?.household.label ?? 'Huishouddossier'} description="Jouw afspraken, voortgang en persoonlijke toegang." />
    {result.error ? <p className="auth-error" role="alert">Het dossier kan nu niet worden geladen. Open de pagina opnieuw.</p> : result.data ? <Panel><div className="account-panel-content"><HouseholdDossierTabs club={club} dossier={result.data} invitationKey={randomUUID()} /></div></Panel> : <Empty title="Dossier niet beschikbaar" text="Open een gekoppeld dossier vanuit jouw overzicht of persoonlijke intake." />}
  </div>;
}
