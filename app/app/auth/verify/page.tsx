import Link from 'next/link';
import {AuthShell} from '@/components/auth/auth-shell';
import {VerifyOtpForm} from '@/components/auth/otp-forms';

export default function MobileVerifyPage() {
  return <AuthShell eyebrow="Controleer je e-mail" title="Vul je code in" intro="Als dit adres bekend en actief is, is een tijdelijk geldige code verstuurd. Vul de volledige code hier in; zo blijf je in dezelfde app."><VerifyOtpForm mobile /><Link className="auth-secondary" href="/app/login">Ander e-mailadres gebruiken</Link></AuthShell>;
}
