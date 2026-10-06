'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {loadIntakeReconfirmations} from '@/lib/data/intake-reconfirmation';

export type ReconfirmIntakeState = {status: 'idle' | 'error' | 'confirmed'; message?: string};
const schema = z.object({
  club: z.string().min(1).max(80), profileId: z.string().uuid(), itemId: z.string().uuid(),
  expectedItemVersion: z.coerce.number().int().positive().safe(),
  expectedProfileVersion: z.coerce.number().int().positive().safe(),
  idempotencyKey: z.string().uuid(), reviewed: z.literal('on'),
  assistanceReason: z.string().trim().max(2_000).default(''),
});

export async function reconfirmIntakeAction(_previous: ReconfirmIntakeState, formData: FormData): Promise<ReconfirmIntakeState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status:'error', message:'Controleer de opgeslagen antwoorden en bevestig dat deze nog bij je passen.'};
  const {client, workspace} = await requireWorkspace(parsed.data.club);
  const {data, error: scopeError} = await loadIntakeReconfirmations(client, workspace.tenant_id, parsed.data.profileId);
  const item = data.find(({item_id}) => item_id === parsed.data.itemId);
  if (scopeError || !item) return {status:'error', message:'Deze intakeherbevestiging is niet beschikbaar.'};
  if (!item.is_self && !parsed.data.assistanceReason) return {status:'error', message:'Leg de reden of context van de hulp vast.'};
  const {data: result, error} = await client.schema('api').rpc('confirm_intake_reconfirmation', {
    p_tenant_id: workspace.tenant_id, p_item_id: item.item_id,
    p_expected_item_version: parsed.data.expectedItemVersion, p_expected_profile_version: parsed.data.expectedProfileVersion,
    p_represented_person_id: item.is_self ? null : item.person_id,
    p_assistance_reason: item.is_self ? null : parsed.data.assistanceReason, p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return {status:'error', message: error.message.includes('STALE_VERSION')
    ? 'Je intake of deze herbevestiging is intussen gewijzigd. Herlaad de pagina en controleer de opgeslagen antwoorden opnieuw.'
    : error.message.includes('IDEMPOTENCY_CONFLICT')
      ? 'De vorige bevestiging is mogelijk al verwerkt. Herlaad de pagina voordat je een ander verzoek verstuurt.'
      : 'Herbevestigen is niet gelukt. Probeer hetzelfde verzoek opnieuw.'};
  const command = (result as Array<{ok?: boolean; resource_id?: string; result?: {profile_version?: number}}> | null)?.[0];
  if (command?.ok !== true || command.resource_id !== item.item_id || !Number.isSafeInteger(command.result?.profile_version)) {
    return {status:'error', message:'Er is geen bevestiging ontvangen. Probeer hetzelfde verzoek opnieuw.'};
  }
  revalidatePath(`/c/${parsed.data.club}/intake`);
  revalidatePath(`/c/${parsed.data.club}/intake/herbevestigen`);
  return {status:'confirmed', message:`Je intake is herbevestigd voor ${item.season_name}.`};
}
