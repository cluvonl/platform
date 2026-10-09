'use server';

import {revalidatePath} from 'next/cache';
import {HELP_TOPICS} from '@/components/app/help-content';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export async function markHelpSeenAction(topicId: string): Promise<{ok: boolean; message?: string}> {
  if (typeof topicId !== 'string' || !Object.hasOwn(HELP_TOPICS, topicId)) {
    return {ok: false, message: 'Deze uitleg is niet beschikbaar.'};
  }
  const client = await createSupabaseServerClient();
  const {data: claims, error: claimsError} = await client.auth.getClaims();
  if (claimsError || typeof claims?.claims?.sub !== 'string') {
    return {ok: false, message: 'Meld je opnieuw aan om je keuze te bewaren.'};
  }
  const {data, error} = await client.schema('api').rpc('mark_help_seen', {p_topic_id: topicId});
  if (error || !Array.isArray(data) || data[0]?.topic_id !== topicId) {
    return {ok: false, message: 'Je keuze is nog niet opgeslagen. Probeer het opnieuw.'};
  }
  revalidatePath('/c', 'layout');
  revalidatePath('/platform', 'layout');
  return {ok: true};
}
