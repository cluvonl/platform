'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {intakeMinutesFromHours, intakeUnavailabilityDates} from '@/lib/domain/intake.mjs';

export type IntakeActionState = {status: 'idle' | 'error' | 'saved'; message?: string; version?: number; idempotencyKey?: string};
const list = z.array(z.string().trim().min(1).max(2_000)).max(60).refine((values) => new Set(values).size === values.length);
const schema = z.object({
  club: z.string().min(1).max(80),
  profileId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
  idempotencyKey: z.string().uuid(),
  experience: z.string().trim().max(2_000),
  preferences: list, skills: list, availability: list, trainingNeeds: list, fixedRoleInterest: list,
  buddyRequested: z.enum(['true', 'false']), reserveWilling: z.enum(['true', 'false']),
  monthlyHours: z.string().max(20), unavailability: z.string().max(2_000),
  assistanceReason: z.string().trim().max(2_000).default(''),
  practicalLimitations: z.string().trim().max(2_000),
});

export async function saveIntakeAction(previous: IntakeActionState, formData: FormData): Promise<IntakeActionState> {
  const parsed = schema.safeParse({...Object.fromEntries(formData),
    ...Object.fromEntries(['preferences', 'skills', 'availability', 'trainingNeeds', 'fixedRoleInterest'].map((key) => [key, formData.getAll(key)])),
  });
  if (!parsed.success) return {...previous, status: 'error', message: 'Controleer de ingevulde velden. Je antwoorden zijn nog niet opgeslagen.'};
  const failure = (message: string): IntakeActionState => ({status: 'error', message, version: parsed.data.expectedVersion, idempotencyKey: parsed.data.idempotencyKey});
  let desiredMonthlyMinutes: number | null;
  try {
    desiredMonthlyMinutes = intakeMinutesFromHours(parsed.data.monthlyHours);
  } catch {
    return failure('Gebruik een geldig aantal uren, bijvoorbeeld 2 of 1:30.');
  }
  const {client, workspace} = await requireWorkspace(parsed.data.club);
  // Resolve the subject through RLS. Representation is never a client choice.
  const {data: profile, error: profileError} = await client.schema('api').from('my_intake')
    .select('profile_id,person_id,desired_minutes,answers').eq('tenant_id', workspace.tenant_id)
    .eq('profile_id', parsed.data.profileId).maybeSingle();
  if (profileError || !profile) return failure('Deze persoonlijke intake is niet beschikbaar.');
  const representedPersonId = profile.person_id === workspace.person_id ? null : profile.person_id;
  if (representedPersonId && !parsed.data.assistanceReason) return failure('Leg de reden of context van de hulp vast.');
  let unavailableDates: string[] | string;
  try { unavailableDates = intakeUnavailabilityDates(parsed.data.unavailability); }
  catch {
    // An unchanged legacy note remains data; new input requires real dates.
    const oldValue = profile.answers?.unavailability;
    if (typeof oldValue !== 'string' || oldValue !== parsed.data.unavailability) return failure('Gebruik echte datums zoals 2026-10-10, gescheiden door een komma.');
    unavailableDates = oldValue;
  }
  const {data, error} = await client.schema('api').rpc('save_intake_revision', {
    p_tenant_id: workspace.tenant_id,
    p_profile_id: profile.profile_id,
    p_expected_version: parsed.data.expectedVersion,
    p_answers: {
      schema_version: 2,
      experience: parsed.data.experience, preferences: parsed.data.preferences, skills: parsed.data.skills,
      availability: parsed.data.availability, unavailability: unavailableDates,
      training_needs: parsed.data.trainingNeeds, fixed_role_interest: parsed.data.fixedRoleInterest,
      practical_limitations: parsed.data.practicalLimitations,
      buddy_requested: parsed.data.buddyRequested === 'true', reserve_willing: parsed.data.reserveWilling === 'true',
      desired_monthly_minutes: desiredMonthlyMinutes,
    },
    p_desired_minutes: profile.desired_minutes,
    p_represented_person_id: representedPersonId,
    p_assistance_reason: representedPersonId ? parsed.data.assistanceReason : null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) return failure(error.message.includes('STALE_VERSION')
    ? 'Je intake is intussen gewijzigd. Je ingevulde antwoorden blijven staan. Herlaad de pagina om de opgeslagen versie te bekijken.'
    : error.message.includes('IDEMPOTENCY_CONFLICT')
      ? 'De vorige opslag is mogelijk al verwerkt. Herlaad de pagina voordat je andere antwoorden opslaat.'
      : 'Opslaan is niet gelukt. Je ingevulde antwoorden blijven staan; probeer het opnieuw.');
  const version = (data as Array<{ok?: boolean; version?: number}> | null)?.[0]?.version;
  if (!Number.isSafeInteger(version)) return failure('De opslag kon niet worden bevestigd. Herlaad de pagina om de actuele versie te bekijken.');
  revalidatePath(`/c/${parsed.data.club}/intake`);
  revalidatePath(`/c/${parsed.data.club}/taken`);
  return {status: 'saved', message: 'Je persoonlijke intake is veilig opgeslagen.', version, idempotencyKey: randomUUID()};
}
