import {AuthShell} from '@/components/auth/auth-shell';
import {RequestOtpForm} from '@/components/auth/otp-forms';

export default function LoginPage() {
  return <AuthShell eyebrow="Persoonlijke toegang" title="Welkom bij Cluvo" intro="Ontvang een eenmalige code op het e-mailadres dat bij jouw vereniging is geverifieerd."><RequestOtpForm /></AuthShell>;
}
