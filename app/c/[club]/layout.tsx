import {SecureShell} from '@/components/app/secure-shell';
import {requireWorkspace} from '@/lib/auth/workspace';

export const dynamic = 'force-dynamic';

export default async function ClubLayout({children, params}: {children: React.ReactNode; params: Promise<{club: string}>}) {
  const {club} = await params;
  const {workspace} = await requireWorkspace(club);
  return <SecureShell workspace={workspace}>{children}</SecureShell>;
}
