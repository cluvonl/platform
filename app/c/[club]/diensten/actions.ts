'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';

export type BookShiftState = {status: 'idle' | 'error' | 'booked'; message?: string};

const schema = z.object({
  club: z.string().min(1).max(80),
  shiftId: z.string().uuid(),
  positionId: z.string().uuid(),
  obligationId: z.string().uuid(),
  shiftVersion: z.coerce.number().int().positive(),
  idempotencyKey: z.string().uuid(),
});

export async function bookShiftAction(
  _previous: BookShiftState,
  formData: FormData,
): Promise<BookShiftState> {
  void _previous;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status: 'error', message: 'De gekozen dienst of verplichting is niet geldig.'};

  const {client, workspace} = await requireWorkspace(parsed.data.club);
  const {data, error} = await client.schema('api').rpc('book_shift', {
    p_tenant_id: workspace.tenant_id,
    p_shift_id: parsed.data.shiftId,
    p_position_id: parsed.data.positionId,
    p_executor_person_id: workspace.person_id,
    p_obligation_id: parsed.data.obligationId,
    p_expected_shift_version: parsed.data.shiftVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  const bookingId = (data as Array<{resource_id?: unknown}> | null)?.[0]?.resource_id;
  if (error || typeof bookingId !== 'string') {
    const conflict = /CAPACITY_FULL|STALE_VERSION|PERSON_OVERLAP/.test(error?.message ?? '');
    return {
      status: 'error',
      message: conflict
        ? 'Deze plek is zojuist gewijzigd of bezet. Vernieuw de pagina om het actuele aanbod te zien.'
        : 'Je kunt deze dienst niet boeken. Controleer je bevoegdheid, beschikbaarheid en kwalificaties.',
    };
  }

  revalidatePath(`/c/${encodeURIComponent(parsed.data.club)}/diensten`);
  revalidatePath(`/c/${encodeURIComponent(parsed.data.club)}/overzicht`);
  return {status: 'booked', message: 'De dienst is opgeslagen. Uren tellen pas mee na bevestigde uitvoering.'};
}
