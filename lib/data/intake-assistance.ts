import 'server-only';
import type {createSupabaseServerClient} from '@/lib/supabase/server';

export type IntakeAssistanceContext = {
  household_id: string; label: string; household_version: number; can_grant: boolean; timezone: string; observed_at: string;
  subjects: Array<{person_id: string; profile_id: string; display_name: string}>;
  helpers: Array<{person_id: string; display_name: string}>;
  delegations: Array<{delegation_id: string; version: number; represented_person_id: string;
    subject_name: string; helper_name: string; starts_at: string; ends_at: string | null;
    revoked_at: string | null; state: 'revoked' | 'expired' | 'scheduled' | 'active'; can_revoke: boolean}>;
};

export async function loadIntakeAssistanceContext(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, tenantId: string, householdId: string) {
  const {data, error} = await client.schema('api').rpc('get_intake_assistance_context', {p_tenant_id: tenantId, p_household_id: householdId});
  return {data: data as IntakeAssistanceContext | null, error};
}
