import 'server-only';

import {unstable_rethrow} from 'next/navigation';
import {requireWorkspace} from '@/lib/auth/workspace';
import {invitationTokenSecret} from '@/lib/supabase/config';
import {testSportlinkReadAccess} from './read-test.mjs';
import {openSportlinkCredential} from './credentials.mjs';
import {checkSportlinkConnection, saveSportlinkConnection, sportlinkStateDTO} from './server-core.mjs';
import type {SportlinkActionState, SportlinkState} from './contracts';

async function authorize(club: string) {
  const {client, workspace} = await requireWorkspace(club);
  return {tenantId: workspace.tenant_id, rpc: async (name: string, args: Record<string, unknown>) => client.schema('api').rpc(name, args)};
}
const dependencies = {authorize, secret: invitationTokenSecret, probe: testSportlinkReadAccess, rethrow: unstable_rethrow};

export async function readSportlinkState(club: string): Promise<{status: 'available'; state: SportlinkState} | {status: 'forbidden' | 'unavailable'}> {
  const {tenantId, rpc} = await authorize(club);
  const {data, error} = await rpc('sportlink_connection_state', {p_tenant_id: tenantId});
  if (error) return {status: error.code === '42501' || /\bFORBIDDEN\b/.test(error.message ?? '') ? 'forbidden' : 'unavailable'};
  try {
    const secret = invitationTokenSecret();
    const state = sportlinkStateDTO(data, secret, tenantId) as SportlinkState | null;
    if (state?.connection?.configured) {
      const c = state.connection;
      const credentials = await rpc('sportlink_connection_credential', {p_tenant_id: tenantId, p_connection_id: c.id, p_expected_version: c.version});
      if (credentials.error) return {status: credentials.error.code === '42501' ? 'forbidden' : 'unavailable'};
      const stored = credentials.data;
      if (!stored || stored.connection_id !== c.id || stored.version !== c.version || stored.credential_fingerprint !== data.connection.credential_fingerprint) return {status: 'unavailable'};
      try {openSportlinkCredential(stored.credential_envelope, stored.credential_fingerprint, secret, {tenantId, connectionId: c.id});}
      catch {c.configured = false; c.test = null;}
    }
    return state ? {status: 'available', state} : {status: 'unavailable'};
  } catch (error) {unstable_rethrow(error); return {status: 'unavailable'};}
}
export async function saveSportlink(input: {club: string; connectionId: string; expectedVersion: number; idempotencyKey: string; clientId: string}): Promise<SportlinkActionState> {
  return await saveSportlinkConnection(input, dependencies) as SportlinkActionState;
}
export async function checkSportlink(input: {club: string; connectionId: string; expectedVersion: number; idempotencyKey: string}): Promise<SportlinkActionState> {
  return await checkSportlinkConnection(input, dependencies) as SportlinkActionState;
}
