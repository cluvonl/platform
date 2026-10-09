'use client';

import {useRef, useState} from 'react';
import {signOutMobileAction} from '@/app/auth/actions';
import {revokeDevicePushSubscriptionsAction} from '@/lib/pwa/actions';
import {revokeDevicePushBinding} from './push-device.mjs';

export function MobileSignOutControl({club, className, children}: {club: string; className?: string; children?: React.ReactNode}) {
  const readyToSubmit = useRef(false);
  const commandKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form action={signOutMobileAction} onSubmit={async event => {
    if (readyToSubmit.current || !('serviceWorker' in navigator)) return;
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/app/');
      const subscription = registration?.scope === new URL('/app/', window.location.origin).href && registration.pushManager ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        commandKey.current ??= crypto.randomUUID();
        const result = await revokeDevicePushBinding(subscription,
          (endpoint: string, key: string) => revokeDevicePushSubscriptionsAction(club, endpoint, key), commandKey.current);
        if (!result.deviceRemoved) setMessage('Je meldingen zijn bij Cluvo afgemeld. Het toestel kon zijn lokale abonnement nog niet verwijderen.');
      }
      readyToSubmit.current = true;
      form.requestSubmit();
    } catch {
      setMessage('Uitloggen is nog niet bevestigd. Probeer het opnieuw om de meldingen op dit toestel veilig af te melden.');
      setBusy(false);
    }
  }}><button className={className} disabled={busy} type="submit">{busy ? 'Veilig uitloggen…' : children ?? 'Uitloggen'}</button>{message ? <p className="cluvo-pwa-install-help" role="alert">{message}</p> : null}</form>;
}
