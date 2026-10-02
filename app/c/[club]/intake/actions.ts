'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';

export type IntakeActionState = {status: 'idle' | 'error' | 'saved'; message?: string};

const schema = z.object({
  club: z.string().min(1).max(80),
  profileId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
  desiredMinutes: z.preprocess(
    (value) => value === '' || value === null ? null : value,
    z.coerce.number().int().min(0).max(100_000).nullable(),
  ),
  availability: z.string().trim().max(2_000),
  preferences: z.string().trim().max(2_000),
  practicalLimitations: z.string().trim().max(2_000),
});

export async function saveIntakeAction(_previous: IntakeActionState, formData: FormData): Promise<IntakeActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status: 'error', message: 'Controleer de ingevulde velden.'};

  const {client, workspace} = await requireWorkspace(parsed.data.club);
  const {data, error} = await client.schema('api').rpc('save_intake_revision', {
    p_tenant_id: workspace.tenant_id,
    p_profile_id: parsed.data.profileId,
    p_expected_version: parsed.data.expectedVersion,
    p_answers: {
      availability: parsed.data.availability,
      preferences: parsed.data.preferences,
      practical_limitations: parsed.data.practicalLimitations,
    },
    p_desired_minutes: parsed.data.desiredMinutes,
    p_represented_person_id: null,
    p_assistance_reason: null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) {
    const stale = error.message.includes('STALE_VERSION');
    return {status: 'error', message: stale ? 'Je intake is intussen gewijzigd. Vernieuw de pagina en probeer opnieuw.' : 'Opslaan is niet gelukt. De bestaande intake is ongewijzigd.'};
  }
  revalidatePath(`/c/${parsed.data.club}/intake`);
  return {status: 'saved', message: data ? 'Je persoonlijke intake is veilig opgeslagen.' : 'Je persoonlijke intake is opgeslagen.'};
}
