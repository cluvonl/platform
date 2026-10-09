import Link from 'next/link';
import {cookies} from 'next/headers';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AuthShell} from '@/components/auth/auth-shell';
import {AcceptInvitationForm} from '@/components/auth/accept-invitation-form';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const contextSchema = z.object({version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), household_label: z.string(), can_view_progress: z.boolean(), can_book_for: z.boolean(), accepted: z.boolean()});

export default async function MobileAcceptInvitationPage() {
  const token = (await cookies()).get('cluvo_app_household_invitation')?.value;
  let context: z.infer<typeof contextSchema> | null = null;
  try {
    if (token && token.length >= 32 && token.length <= 200) {
      const client = await createSupabaseServerClient();
      const {data, error} = await client.schema('api').rpc('household_invitation_context', {p_token: token});
      const parsed = contextSchema.safeParse(data);
      if (!error && parsed.success) context = parsed.data;
    }
  } catch { /* Geen persoonlijke providerdiagnostiek in de pagina. */ }
  if (!context) return <AuthShell eyebrow="Persoonlijke uitnodiging" title="Uitnodiging niet beschikbaar" intro="Open je persoonlijke uitnodiging met het account waarop je deze hebt ontvangen."><p className="auth-error" role="alert">Deze uitnodiging kan met dit account niet worden geopend.</p><Link className="auth-secondary" href="/app/workspaces">Mijn verenigingen</Link></AuthShell>;
  return <AuthShell eyebrow="Persoonlijke uitnodiging" title="Word extra uitvoerder" intro="Pas na acceptatie krijg je de rechten die in deze uitnodiging staan.">
    <div className="detail-meta"><div><span>Huishouden</span><b>{context.household_label}</b></div><div><span>Voortgang bekijken</span><b>{context.can_view_progress ? 'Toegestaan' : 'Niet verleend'}</b></div><div><span>Voor het huishouden boeken</span><b>{context.can_book_for ? 'Toegestaan' : 'Niet verleend'}</b></div></div>
    {context.accepted ? <p className="secure-notice">Deze uitnodiging is al geaccepteerd.</p> : null}
    <AcceptInvitationForm mobile expectedVersion={context.version} idempotencyKey={randomUUID()} />
  </AuthShell>;
}
