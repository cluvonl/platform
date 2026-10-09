import 'server-only';
import {cookies} from 'next/headers';
import {invitationTokenSecret} from '@/lib/supabase/config';
import {openReceipts, sealReceipts} from './receipts.mjs';

const NAME = 'cluvo-pwa-pending';
export type PendingReceipt = {tenant: string; person: string; key: string; command: string; at: number};
type Scope = {tenant: string; person: string};
export async function pendingReceipts(scope: Scope): Promise<PendingReceipt[]> {
  return openReceipts((await cookies()).get(NAME)?.value, invitationTokenSecret(), scope);
}
export async function rememberReceipt(scope: Scope, key: string, command: string) {
  const previous = await pendingReceipts(scope);
  await write([...previous.filter((row) => row.key !== key), {...scope, key, command, at: Date.now()}]);
}
export async function forgetReceipt(scope: Scope, key: string) {
  await write((await pendingReceipts(scope)).filter((row) => row.key !== key));
}
async function write(receipts: PendingReceipt[]) {
  (await cookies()).set(NAME, receipts.length ? sealReceipts(receipts, invitationTokenSecret()) : '', {
    path: '/app', httpOnly: true, sameSite: 'lax', secure: process.env.APP_ENV !== 'local',
    maxAge: receipts.length ? 86400 : 0,
  });
}
