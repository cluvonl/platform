'use server';

import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export type AcceptInvitationState = {status: 'idle' | 'error'; message?: string};
const tokenSchema = z.string().min(32).max(200);
const invitationCookie = 'cluvo_household_invitation';

export async function acceptInvitationAction(
  _previous: AcceptInvitationState,
  _formData: FormData,
): Promise<AcceptInvitationState> {
  void _previous;
  void _formData;
  const cookieStore = await cookies();
  const token = tokenSchema.safeParse(cookieStore.get(invitationCookie)?.value);
  if (!token.success) return {status: 'error', message: 'Deze uitnodiging is ongeldig of onvolledig.'};

  let tenantSlug: string;
  try {
    const client = await createSupabaseServerClient();
    const {data, error} = await client.schema('api').rpc('accept_household_invitation', {p_token: token.data});
    const value = (data as Array<{tenant_slug?: unknown}> | null)?.[0]?.tenant_slug;
    if (error || typeof value !== 'string') return {status: 'error', message: 'Deze uitnodiging is ongeldig, verlopen of hoort bij een ander account.'};
    tenantSlug = value;
  } catch {
    return {status: 'error', message: 'De uitnodiging kan nu niet worden verwerkt. Probeer het later opnieuw.'};
  }
  cookieStore.delete({name: invitationCookie, path: '/invite/accept'});
  redirect(`/c/${encodeURIComponent(tenantSlug)}/intake`);
}
