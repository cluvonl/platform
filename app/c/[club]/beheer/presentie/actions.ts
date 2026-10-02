'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';

export type AttendanceState = {status: 'idle' | 'error' | 'confirmed'; message?: string};

const schema = z.object({
  club: z.string().min(1).max(80),
  bookingId: z.string().uuid(),
  bookingVersion: z.coerce.number().int().positive(),
  result: z.enum(['present', 'partial', 'no_show', 'club_cancelled']),
  awardedMinutes: z.string().max(6).optional(),
  reason: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid(),
});

export async function confirmAttendanceAction(
  _previous: AttendanceState,
  formData: FormData,
): Promise<AttendanceState> {
  void _previous;
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status: 'error', message: 'Controleer de presentiekeuze en toelichting.'};

  const awarded = parsed.data.awardedMinutes ? Number(parsed.data.awardedMinutes) : null;
  const needsReason = parsed.data.result === 'partial' || parsed.data.result === 'club_cancelled';
  if ((awarded !== null && (!Number.isInteger(awarded) || awarded < 0)) || (needsReason && !parsed.data.reason)) {
    return {status: 'error', message: 'Gedeeltelijke of clubgeannuleerde inzet vereist geldige minuten en een reden.'};
  }

  const {client, workspace} = await requireWorkspace(parsed.data.club);
  const {data, error} = await client.schema('api').rpc('confirm_attendance', {
    p_tenant_id: workspace.tenant_id,
    p_booking_id: parsed.data.bookingId,
    p_expected_booking_version: parsed.data.bookingVersion,
    p_result: parsed.data.result,
    p_awarded_minutes: parsed.data.result === 'present' ? null : parsed.data.result === 'no_show' ? 0 : awarded,
    p_reason: needsReason ? parsed.data.reason : null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  const bookingId = (data as Array<{resource_id?: unknown}> | null)?.[0]?.resource_id;
  if (error || typeof bookingId !== 'string') {
    const conflict = /STALE_VERSION|ALREADY_CONFIRMED/.test(error?.message ?? '');
    return {status: 'error', message: conflict ? 'Deze presentie is al gewijzigd. Vernieuw de pagina.' : 'De presentie is geweigerd; controleer tijdstip, minuten en commissiebevoegdheid.'};
  }

  revalidatePath(`/c/${encodeURIComponent(parsed.data.club)}/beheer/presentie`);
  revalidatePath(`/c/${encodeURIComponent(parsed.data.club)}/overzicht`);
  return {status: 'confirmed', message: 'Presentie bevestigd; de urenledger en huishoudoverzicht zijn bijgewerkt.'};
}
