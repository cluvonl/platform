'use server';

import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {checkSportlink, saveSportlink} from '@/lib/sportlink/server';
import type {SportlinkActionState} from '@/lib/sportlink/contracts';

const common = z.object({club: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/), connectionId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER), idempotencyKey: z.string().uuid()});
const configure = common.extend({clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{6,128}$/)});

export async function saveSportlinkAction(_previous: SportlinkActionState, formData: FormData): Promise<SportlinkActionState> {
  const parsed = configure.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status: 'rejected', message: 'Vul de Sportlink ClientID van deze vereniging in en controleer de invoer.'};
  const result = await saveSportlink(parsed.data);
  if (result.status === 'confirmed') revalidatePath(`/c/${encodeURIComponent(parsed.data.club)}/beheer/sportlink`);
  return result;
}

export async function checkSportlinkAction(_previous: SportlinkActionState, formData: FormData): Promise<SportlinkActionState> {
  const parsed = common.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.expectedVersion < 1) return {status: 'rejected', message: 'Vernieuw de pagina om de actuele Sportlink-koppeling te controleren.'};
  const result = await checkSportlink(parsed.data);
  if (result.status === 'confirmed') revalidatePath(`/c/${encodeURIComponent(parsed.data.club)}/beheer/sportlink`);
  return result;
}
