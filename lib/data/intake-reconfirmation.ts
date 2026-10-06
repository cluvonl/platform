import 'server-only';

import type {SupabaseClient} from '@supabase/supabase-js';

export type IntakeReconfirmation = {
  item_id: string; item_version: number; profile_id: string; profile_version: number;
  person_id: string; is_self: boolean; season_name: string; season_status: string;
  state: string; confirmed_at: string | null; confirmed_answer_revision: number | null; can_confirm: boolean;
};

export async function loadIntakeReconfirmations(client: SupabaseClient, tenantId: string, profileId: string) {
  const {data, error} = await client.schema('api').rpc('get_intake_reconfirmations', {p_tenant_id: tenantId, p_profile_id: profileId});
  return {data: (data ?? []) as IntakeReconfirmation[], error};
}
