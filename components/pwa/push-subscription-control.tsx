'use client';

import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Bell} from 'lucide-react';
import {savePushSubscriptionAction, revokePushSubscriptionAction, readPushBindingStatusAction} from '@/lib/pwa/actions';
import {confirmDevicePushBinding, revokeDevicePushBinding, subscribeDeviceWithGesture} from './push-device.mjs';

const subscribeCapabilities = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback);
  window.addEventListener('appinstalled', callback);
  return () => {document.removeEventListener('visibilitychange', callback); window.removeEventListener('appinstalled', callback);};
};
function capability() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;
  if (isIos && !standalone) return 'install';
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'supported';
}

export function PushSubscriptionControl({club, publicKey}: {club: string; publicKey: string | null}) {
  const support = useSyncExternalStore(subscribeCapabilities, capability, () => 'loading');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const commandKeys = useRef<{save?: string; revoke?: string}>({});
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.ready.then(async value => {
      if (cancelled || value.scope !== new URL('/app/', window.location.origin).href || !value.pushManager) return;
      const existing = await value.pushManager.getSubscription();
      if (!cancelled) {setRegistration(value); setSubscription(existing); setConfirmed(false);}
      if (existing && !cancelled) {
        setBusy(true);
        try {
          const state = await readPushBindingStatusAction(club, existing.endpoint);
          if (!cancelled) {setConfirmed(state.ok && state.registered); if (!state.ok) setMessage('Je accountkoppeling op dit toestel kan nu niet worden gecontroleerd. Je inbox blijft beschikbaar.');}
        } finally {if (!cancelled) setBusy(false);}
      }
    }).catch(() => {if (!cancelled) setMessage('De meldingsinstelling op dit toestel kan nu niet worden gecontroleerd. Je inbox blijft beschikbaar.');});
    return () => {cancelled = true;};
  }, [club]);
  if (!publicKey) return <p className="cluvo-pwa-install-help">Pushmeldingen zijn nog niet beschikbaar. Je meldingen blijven in de app zichtbaar.</p>;
  if (support === 'install') return <p className="cluvo-pwa-install-help">Zet Cluvo eerst op je beginscherm en open de app via dat icoon om pushmeldingen te kunnen inschakelen.</p>;
  if (support === 'unsupported') return <p className="cluvo-pwa-install-help">Deze browser ondersteunt geen pushmeldingen. Je meldingen blijven in de app zichtbaar.</p>;
  if (support === 'denied') return <p className="cluvo-pwa-install-help">Je hebt meldingen voor Cluvo geweigerd. Je kunt dit in de browser- of toestelinstellingen aanpassen. Je inbox blijft beschikbaar.</p>;
  return <section className="cluvo-pwa-install" aria-label="Pushmeldingen op dit toestel">
    <p className="cluvo-pwa-install-help">{confirmed ? 'Pushmeldingen zijn voor je account op dit toestel geregistreerd.' : 'Kies zelf of Cluvo je op dit toestel mag waarschuwen. Toestemming op het toestel en je meldingsvoorkeuren zijn afzonderlijk.'}</p>
    <button className="cluvo-pwa-install-button" type="button" disabled={busy || !registration || support === 'loading'} onClick={async () => {
      if (!registration) return;
      setBusy(true); setMessage('');
      try {
        if (confirmed && subscription) {
          commandKeys.current.revoke ??= crypto.randomUUID();
          const result = await revokeDevicePushBinding(subscription,
            (endpoint: string, key: string) => revokePushSubscriptionAction(club, endpoint, key), commandKeys.current.revoke);
          setConfirmed(false);
          if (result.deviceRemoved) setSubscription(null);
          commandKeys.current = {};
          setMessage(result.deviceRemoved ? 'Pushmeldingen zijn voor dit account op dit toestel afgemeld.' : 'De vereniging heeft dit abonnement afgemeld. De toestelinstelling kon nog niet worden verwijderd.');
        } else {
          // The native subscribe call happens immediately in this user gesture.
          const next = subscription ?? await subscribeDeviceWithGesture(registration, publicKey);
          setSubscription(next);
          commandKeys.current.save ??= crypto.randomUUID();
          await confirmDevicePushBinding(next,
            (value: {endpoint: string; keys: {p256dh: string; auth: string}}, key: string) => savePushSubscriptionAction(club, value, key), commandKeys.current.save);
          setConfirmed(true); commandKeys.current = {};
          setMessage('Je account is op dit toestel geregistreerd. Dit bevestigt nog geen aflevering van een melding.');
        }
      } catch {
        setMessage('De wijziging is niet volledig bevestigd. Je kunt opnieuw proberen; je inbox blijft beschikbaar.');
      } finally {setBusy(false);}
    }}><Bell size={18} />{busy ? 'Meldingen controleren…' : confirmed ? 'Pushmeldingen uitschakelen' : 'Pushmeldingen inschakelen'}</button>
    {message ? <p className="cluvo-pwa-install-help" role="status">{message}</p> : null}
  </section>;
}
