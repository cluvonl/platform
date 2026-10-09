import {AuthShell} from '@/components/auth/auth-shell';
import {RequestOtpForm} from '@/components/auth/otp-forms';
import {mobileReturnPath} from '@/lib/auth/mobile-return';
import {InstallAppControl} from '@/components/pwa/pwa-controls';

export default async function MobileLoginPage({searchParams}:{searchParams:Promise<{next?:string|string[]}>}) {
  const requested=await searchParams;const nextPath=mobileReturnPath(requested.next)??'/app/workspaces';
  return <AuthShell eyebrow="Persoonlijke toegang" title="Welkom bij Cluvo" intro="Ontvang je inlogcode op het persoonlijke e-mailadres dat bij jouw vereniging is geverifieerd. Vul de code vervolgens hier in de app in."><RequestOtpForm mobile nextPath={nextPath} /><InstallAppControl compact /></AuthShell>;
}
