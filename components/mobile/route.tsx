import {loadMobileSnapshot} from '@/lib/pwa/server';
import {MobileScreenView} from './screens';
import {MobileShell} from './shell';
import {ContextSelection} from './context-selection';
import type {MobileScreen} from './types';

export type MobileRouteProps = {params: Promise<{club: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>};
export async function MobileRoutePage({screen, params, searchParams}: MobileRouteProps & {screen: MobileScreen}) {
  const [{club}, selection] = await Promise.all([params, searchParams]);
  const snapshot = await loadMobileSnapshot(club, {household: typeof selection.household === 'string' ? selection.household : undefined, season: typeof selection.season === 'string' ? selection.season : undefined});
  return <MobileShell snapshot={snapshot}><ContextSelection snapshot={snapshot} /><MobileScreenView snapshot={snapshot} screen={screen} /></MobileShell>;
}
