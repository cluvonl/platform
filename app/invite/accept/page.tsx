import {AuthShell} from '@/components/auth/auth-shell';
import {AcceptInvitationForm} from '@/components/auth/accept-invitation-form';

export default function AcceptInvitationPage() {
  return (
    <AuthShell eyebrow="Persoonlijke uitnodiging" title="Word extra uitvoerder" intro="Controleer de uitnodiging met het geverifieerde account waarop je deze e-mail ontving. Pas na acceptatie ontstaan de expliciet gekozen dossierrechten.">
      <AcceptInvitationForm />
    </AuthShell>
  );
}
