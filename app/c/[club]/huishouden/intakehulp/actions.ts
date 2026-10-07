'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {loadIntakeAssistanceContext} from '@/lib/data/intake-assistance';

export type AssistanceState = {status: 'idle' | 'error' | 'confirmed'; message?: string};
const common = {
  club: z.string().min(1).max(80), householdId: z.string().uuid(),
  expectedHouseholdVersion: z.coerce.number().int().positive().safe(),
  idempotencyKey: z.string().uuid(), reason: z.string().trim().min(1).max(2_000), reviewed: z.literal('on'),
};
const schema = z.discriminatedUnion('kind', [
  z.object({...common, kind: z.literal('grant'), profileId: z.string().uuid(), helperPersonId: z.string().uuid(), endsAt: z.string().datetime({offset:true})}),
  z.object({...common, kind: z.literal('revoke'), delegationId: z.string().uuid(), expectedDelegationVersion: z.coerce.number().int().positive().safe()}),
]);

export async function updateAssistanceAction(_previous: AssistanceState, formData: FormData): Promise<AssistanceState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status:'error', message:'Kies de persoon en hulpverlener, leg de reden vast en bevestig het verzoek.'};
  const input = parsed.data;
  const {client, workspace} = await requireWorkspace(input.club);
  const {data: context, error: scopeError} = await loadIntakeAssistanceContext(client, workspace.tenant_id, input.householdId);
  if (scopeError || !context) return {status:'error', message:'Intakehulp beheren is voor dit dossier niet beschikbaar.'};
  if (input.kind === 'grant' && (!context.subjects.some(({profile_id}) => profile_id === input.profileId)
    || !context.helpers.some(({person_id}) => person_id === input.helperPersonId))) {
    return {status:'error', message:'Deze persoon of hulpverlener is niet beschikbaar in dit dossier.'};
  }
  if (input.kind === 'revoke' && !context.delegations.some(({delegation_id}) => delegation_id === input.delegationId)) {
    return {status:'error', message:'Deze machtiging is niet beschikbaar in dit dossier.'};
  }
  const {data: result, error} = input.kind === 'grant'
    ? await client.schema('api').rpc('grant_intake_assistance', {p_tenant_id:workspace.tenant_id,
      p_household_id:context.household_id, p_profile_id:input.profileId, p_helper_person_id:input.helperPersonId,
      p_expected_household_version:input.expectedHouseholdVersion, p_ends_at:input.endsAt,
      p_reason:input.reason, p_idempotency_key:input.idempotencyKey})
    : await client.schema('api').rpc('revoke_intake_assistance', {p_tenant_id:workspace.tenant_id,
      p_delegation_id:input.delegationId, p_expected_household_version:input.expectedHouseholdVersion,
      p_expected_delegation_version:input.expectedDelegationVersion, p_reason:input.reason, p_idempotency_key:input.idempotencyKey});
  if (error) return {status:'error', message:error.message.includes('STALE_VERSION')
    ? 'Het dossier of de machtiging is intussen gewijzigd. Herlaad de pagina en controleer de gegevens opnieuw.'
    : error.message.includes('IDEMPOTENCY_CONFLICT') ? 'Je vorige verzoek is mogelijk al verwerkt. Herlaad de pagina voordat je iets wijzigt.'
      : error.message.includes('ASSISTANCE_ALREADY_GRANTED') ? 'Voor deze persoon en hulpverlener bestaat al een lopende machtiging.'
        : 'Het verzoek is niet bevestigd. Probeer hetzelfde verzoek opnieuw.'};
  const command = (result as Array<{ok?: boolean; resource_id?: string; version?: number; result?: {household_version?: number}}> | null)?.[0];
  if (command?.ok !== true || !z.string().uuid().safeParse(command.resource_id).success
    || !Number.isSafeInteger(command.result?.household_version)
    || (input.kind === 'revoke' && (command.resource_id !== input.delegationId || command.version !== input.expectedDelegationVersion + 1))) {
    return {status:'error', message:'Er is geen bevestiging ontvangen. Probeer hetzelfde verzoek opnieuw.'};
  }
  for (const path of ['huishouden', 'huishouden/intakehulp', 'intake', 'intake/herbevestigen']) revalidatePath(`/c/${input.club}/${path}`);
  return {status:'confirmed', message:input.kind === 'grant' ? 'De machtiging voor intakehulp is vastgelegd.' : 'De machtiging voor intakehulp is ingetrokken.'};
}
