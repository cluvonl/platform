import 'server-only';
import type {createSupabaseServerClient} from '@/lib/supabase/server';

export type HouseholdBalance = {
  obligation_id: string; season_id: string; effective_target_minutes: number; effective_winter_minutes: number;
  confirmed_minutes: number; planned_minutes: number; pending_minutes: number; remaining_minutes: number;
  winter_deficit_minutes: number; structurally_covered: boolean; annual_state: string; open_dispute_count: number | null;
};
export type HouseholdDossier = {
  timezone: string;
  household: {household_id: string; label: string; version: number; status: string; separated_parents: boolean;
    intake_code_hint: string | null; can_view_progress: boolean; can_invite_executor: boolean};
  seasons: Array<{season_id: string; name: string}>; selected_season_id: string | null; balances: HouseholdBalance[];
  people: Array<{person_id: string; display_name: string; kind: string; verified: boolean; profile_id: string | null; intake_status: string | null; is_self: boolean}>;
  invitations: Array<{invitation_id: string; display_name: string; delivery_status: string; expires_at: string; created_at: string; version: number; expired: boolean; can_cancel: boolean}>;
  history: Array<{event_id: string; action: string; occurred_at: string; actor_is_self: boolean}>;
};
export async function loadHouseholdDossier(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, tenantId: string, householdId: string, seasonId: string | null = null) {
  const {data, error} = await client.schema('api').rpc('get_household_dossier_v2', {p_tenant_id: tenantId, p_household_id: householdId, p_season_id: seasonId});
  return {data: data as HouseholdDossier | null, error};
}
