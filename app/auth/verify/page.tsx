import Link from 'next/link';
import {AuthShell} from '@/components/auth/auth-shell';
import {VerifyOtpForm} from '@/components/auth/otp-forms';

export default function VerifyPage() {
  return (
    <AuthShell eyebrow="Controleer je e-mail" title="Vul je code in" intro="Als dit adres bekend en actief is, heeft Cluvo een tijdelijk geldige code gestuurd. Vul de volledige code uit je e-mail in.">
      <VerifyOtpForm />
      <Link className="auth-secondary" href="/login">Ander e-mailadres gebruiken</Link>
    </AuthShell>
  );
}
