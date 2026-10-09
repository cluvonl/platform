import {AccountHelpProvider} from '@/components/app/help-provider';
import {loadMobileSnapshot} from '@/lib/pwa/server';
import {markMobileHelpSeenAction} from '@/lib/pwa/actions';
import '@/components/mobile/mobile.css';

export const dynamic = 'force-dynamic';
export default async function MobileClubLayout({children, params}: {children: React.ReactNode; params: Promise<{club: string}>}) {
  const {club} = await params;
  const snapshot = await loadMobileSnapshot(club);
  const seen = snapshot.helpSeen ?? [];
  return <AccountHelpProvider key={`${snapshot.workspace.tenant_id}:${snapshot.workspace.person_id}`} initialSeen={seen} loaded markSeen={markMobileHelpSeenAction.bind(null, club)}>{children}</AccountHelpProvider>;
}
