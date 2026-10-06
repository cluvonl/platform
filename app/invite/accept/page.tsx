import {AuthShell} from '@/components/auth/auth-shell';
import {AcceptInvitationForm} from '@/components/auth/accept-invitation-form';
import {cookies} from 'next/headers';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';

const contextSchema = z.object({version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), household_label: z.string(), can_view_progress: z.boolean(), can_book_for: z.boolean(), accepted: z.boolean()});

export default async function AcceptInvitationPage() {
  const token = (await cookies()).get('cluvo_household_invitation')?.value;
  let context: z.infer<typeof contextSchema> | null = null;
  try {
    if (token && token.length >= 32 && token.length <= 200) {
      const client = await createSupabaseServerClient();
      const {data, error} = await client.schema('api').rpc('household_invitation_context', {p_token: token});
      const parsed = contextSchema.safeParse(data);
      if (!error && parsed.success) context = parsed.data;
    }
  } catch { /* Alle ontbrekende, verlopen en onbevoegde contexten blijven gelijk. */ }
  if (!context) return <AuthShell eyebrow="Persoonlijke uitnodiging" title="Uitnodiging niet beschikbaar" intro="Deze uitnodiging kan met dit account niet worden geopend. Gebruik de persoonlijke link en het account waarop je de uitnodiging ontving."><p className="auth-error" role="alert">Open een geldige persoonlijke uitnodiging of ga naar jouw werkruimtes.</p></AuthShell>;
  return (
    <AuthShell eyebrow="Persoonlijke uitnodiging" title="Word extra uitvoerder" intro="Controleer de uitnodiging met het geverifieerde account waarop je deze e-mail ontving. Pas na acceptatie ontstaan de expliciet gekozen dossierrechten.">
      <div className="detail-meta"><div><span>Huishouden</span><b>{context.household_label}</b></div><div><span>Gezamenlijke voortgang bekijken</span><b>{context.can_view_progress ? 'Toegestaan' : 'Niet verleend'}</b></div><div><span>Voor het huishouden boeken</span><b>{context.can_book_for ? 'Toegestaan' : 'Niet verleend'}</b></div></div>
      {context.accepted ? <p className="secure-notice">Deze uitnodiging is al geaccepteerd. Je kunt jouw persoonlijke intake openen.</p> : null}
      <AcceptInvitationForm expectedVersion={context.version} idempotencyKey={randomUUID()} />
    </AuthShell>
  );
}
