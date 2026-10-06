'use server';

import {createHash, createHmac, randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {appOrigin, invitationTokenSecret} from '@/lib/supabase/config';
import {isAllowedMailRecipient} from '@/lib/domain/mail-recipient.mjs';
import {revalidatePath} from 'next/cache';

export type InviteExecutorState = {status: 'idle' | 'error' | 'sent'; message?: string};
export type CancelInvitationState = {status: 'idle' | 'error' | 'cancelled'; message?: string};

const cancellationSchema = z.object({
  club: z.string().min(1).max(80), invitationId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER), idempotencyKey: z.string().uuid(),
});

export async function cancelInvitationAction(_previous: CancelInvitationState, formData: FormData): Promise<CancelInvitationState> {
  void _previous;
  const parsed = cancellationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status: 'error', message: 'Open het dossier opnieuw om de actuele uitnodiging te controleren.'};
  const {client, workspace} = await requireWorkspace(parsed.data.club);
  const {data, error} = await client.schema('api').rpc('cancel_household_invitation', {
    p_tenant_id: workspace.tenant_id, p_invitation_id: parsed.data.invitationId,
    p_expected_version: parsed.data.expectedVersion, p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error?.message?.includes('STALE_VERSION')) return {status: 'error', message: 'Deze uitnodiging is intussen gewijzigd. Vernieuw het dossier voordat je opnieuw kiest.'};
  if (error?.message?.includes('INVITATION_ALREADY_ACCEPTED')) return {status: 'error', message: 'Deze uitnodiging is al geaccepteerd. Bestaande dossierrechten vragen een afzonderlijke beheeractie.'};
  const result = z.array(z.object({ok: z.literal(true), result: z.object({delivery_status: z.literal('cancelled')})})).min(1).safeParse(data);
  if (error || !result.success) return {status: 'error', message: 'De uitnodiging kon niet veilig worden ingetrokken. Controleer de actuele status en jouw rechten.'};
  revalidatePath(`/c/${parsed.data.club}/intake`);
  revalidatePath(`/c/${parsed.data.club}/huishouden`);
  revalidatePath(`/c/${parsed.data.club}/overzicht`);
  return {status: 'cancelled', message: 'Uitnodiging ingetrokken. De persoonlijke link geeft geen toegang.'};
}

const schema = z.object({
  club: z.string().min(1).max(80),
  householdId: z.string().uuid(),
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  canViewProgress: z.string().optional().transform((value) => value === 'on'),
  canBookFor: z.string().optional().transform((value) => value === 'on'),
  idempotencyKey: z.string().uuid(),
  expectedHouseholdVersion: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});

export async function inviteExecutorAction(
  _previous: InviteExecutorState,
  formData: FormData,
): Promise<InviteExecutorState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return {status: 'error', message: 'Controleer de naam, het e-mailadres en de gekozen rechten.'};

  const {client, workspace} = await requireWorkspace(parsed.data.club);
  if (!isAllowedMailRecipient(parsed.data.email, {environment: process.env.APP_ENV ?? 'local', allowlist: process.env.MAIL_ALLOWLIST})) {
    return {status: 'error', message: 'Dit e-mailadres is niet beschikbaar voor uitnodigingen in deze testomgeving.'};
  }
  // Een retry van exact dezelfde command moet exact hetzelfde dossiertoken
  // opleveren. Het token blijft onvoorspelbaar door de afzonderlijke,
  // server-only HMAC-sleutel en wordt in PostgreSQL uitsluitend gehasht bewaard.
  const token = createHmac('sha256', invitationTokenSecret())
    .update('cluvo-household-invitation-v1\0', 'utf8')
    .update(workspace.tenant_id, 'utf8')
    .update('\0', 'utf8')
    .update(parsed.data.householdId, 'utf8')
    .update('\0', 'utf8')
    .update(parsed.data.email, 'utf8')
    .update('\0', 'utf8')
    .update(parsed.data.idempotencyKey, 'utf8')
    .digest('base64url');
  const tokenHashHex = createHash('sha256').update(token, 'utf8').digest('hex');
  const {data, error} = await client.schema('api').rpc('create_household_invitation_v2', {
    p_tenant_id: workspace.tenant_id,
    p_household_id: parsed.data.householdId,
    p_given_name: parsed.data.givenName,
    p_family_name: parsed.data.familyName,
    p_email: parsed.data.email,
    p_token_hash_hex: tokenHashHex,
    p_can_view_progress: parsed.data.canViewProgress,
    p_can_book_for: parsed.data.canBookFor,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_expected_household_version: parsed.data.expectedHouseholdVersion,
  });
  const invitationId = (data as Array<{resource_id?: unknown}> | null)?.[0]?.resource_id;
  if (error || typeof invitationId !== 'string') {
    if (error?.message?.includes('STALE_VERSION')) return {status: 'error', message: 'Dit dossier is intussen gewijzigd. Je invoer blijft staan; vernieuw het dossier voordat je opnieuw uitnodigt.'};
    return {status: 'error', message: 'De uitnodiging kon niet veilig worden klaargezet.'};
  }

  const {data: delivery, error: deliveryError} = await client.schema('api').rpc('household_invitation_delivery_v2', {
    p_tenant_id: workspace.tenant_id, p_invitation_id: invitationId,
  });
  const deliveryState = z.object({delivery_status: z.enum(['pending', 'delivery_failed', 'sent', 'accepted', 'cancelled']), version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), expired: z.boolean()}).safeParse(delivery);
  if (deliveryError || !deliveryState.success || deliveryState.data.expired || deliveryState.data.delivery_status === 'cancelled') {
    return {status: 'error', message: 'Deze uitnodiging kan niet worden verzonden. Vernieuw de pagina om de actuele status te bekijken.'};
  }
  if (deliveryState.data.delivery_status === 'sent' || deliveryState.data.delivery_status === 'accepted') {
    return {status: 'sent', message: deliveryState.data.delivery_status === 'accepted' ? 'Deze uitnodiging is al geaccepteerd.' : 'Deze persoonlijke uitnodiging is al verzonden. Er is geen tweede e-mail gestuurd.'};
  }

  let delivered = false;
  try {
    const admin = createSupabaseAdminClient();
    const next = `/invite/accept?token=${encodeURIComponent(token)}`;
    const redirectTo = `${appOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;
    const {error: inviteError} = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo,
    });
    if (!inviteError) {
      delivered = true;
    } else if (inviteError.code === 'email_exists') {
      // Supabase weigert admin-invites voor reeds bevestigde accounts. Stuur
      // diezelfde geverifieerde identiteit daarom een gewone, niet-aanmakende
      // OTP/magic-link met exact dezelfde beperkte acceptatieroute.
      const {error: otpError} = await admin.auth.signInWithOtp({
        email: parsed.data.email,
        options: {shouldCreateUser: false, emailRedirectTo: redirectTo},
      });
      delivered = !otpError;
    }
  } catch {
    delivered = false;
  }

  const {error: statusError} = await client.schema('api').rpc('mark_household_invitation_delivery_v2', {
    p_tenant_id: workspace.tenant_id,
    p_invitation_id: invitationId,
    p_delivered: delivered,
    p_expected_version: deliveryState.data.version,
    p_idempotency_key: randomUUID(),
  });
  revalidatePath(`/c/${parsed.data.club}/intake`);
  revalidatePath(`/c/${parsed.data.club}/huishouden`);
  revalidatePath(`/c/${parsed.data.club}/overzicht`);
  if (statusError) return {status: 'error', message: 'De verzendstatus kon niet worden bevestigd. Je invoer blijft staan; controleer de uitnodiging voordat je opnieuw verzendt.'};
  if (!delivered) return {status: 'error', message: 'De verzending kon niet worden bevestigd. Je invoer blijft staan; probeer dezelfde uitnodiging opnieuw.'};
  return {status: 'sent', message: 'De persoonlijke uitnodiging is verzonden en verloopt na één uur.'};
}
