'use server';

import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export type AcceptInvitationState = {status: 'idle' | 'error'; message?: string};
const tokenSchema = z.string().min(32).max(200);
const commandSchema = z.object({expectedVersion: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER), idempotencyKey: z.string().uuid()});
const invitationCookie = 'cluvo_household_invitation';

export async function acceptInvitationAction(
  _previous: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  void _previous;
  const cookieStore = await cookies();
  const token = tokenSchema.safeParse(cookieStore.get(invitationCookie)?.value);
  if (!token.success) return {status: 'error', message: 'Deze uitnodiging is ongeldig of onvolledig.'};
  const command = commandSchema.safeParse(Object.fromEntries(formData));
  if (!command.success) return {status: 'error', message: 'Open de uitnodiging opnieuw om de actuele gegevens te controleren.'};

  let tenantSlug: string;
  try {
    const client = await createSupabaseServerClient();
    const {data, error} = await client.schema('api').rpc('accept_household_invitation_v2', {p_token: token.data, p_expected_version: command.data.expectedVersion, p_idempotency_key: command.data.idempotencyKey});
    if (error?.message?.includes('STALE_VERSION')) return {status: 'error', message: 'Deze uitnodiging is intussen gewijzigd. Open de uitnodiging opnieuw voordat je accepteert.'};
    const value = (data as Array<{result?: {tenant_slug?: unknown}}> | null)?.[0]?.result?.tenant_slug;
    if (error || typeof value !== 'string') return {status: 'error', message: 'Deze uitnodiging is ongeldig, verlopen of hoort bij een ander account.'};
    tenantSlug = value;
  } catch {
    return {status: 'error', message: 'De uitnodiging kan nu niet worden verwerkt. Probeer het later opnieuw.'};
  }
  cookieStore.delete({name: invitationCookie, path: '/invite/accept'});
  redirect(`/c/${encodeURIComponent(tenantSlug)}/intake`);
}
