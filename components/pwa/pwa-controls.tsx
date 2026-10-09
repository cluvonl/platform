'use client';

import {createContext, useContext, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import {Download, RefreshCw, WifiOff} from 'lucide-react';
import './pwa.css';

type InstallEvent = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>};
type PwaContextValue = {installEvent: InstallEvent | null; clearInstallEvent: () => void};
const PwaContext = createContext<PwaContextValue>({installEvent: null, clearInstallEvent: () => undefined});
const serverFalse = () => false;
const serverOnline = () => true;
function installed() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;
}
function ios() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function subscribeInstallState(callback: () => void) {
  const query = window.matchMedia('(display-mode: standalone)');
  query.addEventListener('change', callback);
  window.addEventListener('appinstalled', callback);
  return () => {query.removeEventListener('change', callback); window.removeEventListener('appinstalled', callback);};
}
function subscribeNetwork(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {window.removeEventListener('online', callback); window.removeEventListener('offline', callback);};
}
const subscribeIdentity = () => () => undefined;

export function PwaProvider({children}: {children: React.ReactNode}) {
  const router = useRouter();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const requestedUpdate = useRef(false);
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine, serverOnline);
  useEffect(() => {
    const prompt = (event: Event) => {event.preventDefault(); setInstallEvent(event as InstallEvent);};
    const installedEvent = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', prompt);
    window.addEventListener('appinstalled', installedEvent);
    return () => {window.removeEventListener('beforeinstallprompt', prompt); window.removeEventListener('appinstalled', installedEvent);};
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let hiddenAt = 0;
    let installingWorker: ServiceWorker | null = null;
    const examine = () => {if (!cancelled && registration?.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);};
    const updateFound = () => {
      installingWorker?.removeEventListener('statechange', examine);
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener('statechange', examine);
    };
    const changed = () => {
      if (requestedUpdate.current) {requestedUpdate.current = false; window.location.reload();}
    };
    const resumed = () => {
      if (document.visibilityState === 'hidden') {hiddenAt = Date.now(); return;}
      if (document.visibilityState === 'visible') {
        void registration?.update().catch(() => undefined);
        if (hiddenAt && Date.now() - hiddenAt > 60_000 && navigator.onLine) router.refresh();
        hiddenAt = 0;
      }
    };
    const restored = (event: PageTransitionEvent) => {if (event.persisted) router.refresh();};
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    document.addEventListener('visibilitychange', resumed);
    window.addEventListener('pageshow', restored);
    void navigator.serviceWorker.register('/app/sw.js', {scope: '/app/', updateViaCache: 'none'}).then(value => {
      if (cancelled) return;
      registration = value;
      examine();
      value.addEventListener('updatefound', updateFound);
      updateFound();
      return value.update();
    }).catch(() => { /* Online gebruik blijft mogelijk zonder worker. */ });
    return () => {
      cancelled = true;
      registration?.removeEventListener('updatefound', updateFound);
      installingWorker?.removeEventListener('statechange', examine);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      document.removeEventListener('visibilitychange', resumed);
      window.removeEventListener('pageshow', restored);
    };
  }, [router]);
  return <PwaContext.Provider value={{installEvent, clearInstallEvent: () => setInstallEvent(null)}}>
    <div className="cluvo-pwa-root">
      {!online ? <div className="cluvo-pwa-status" role="status"><WifiOff size={18} /><span>Geen verbinding. Een nieuwe actie is pas bevestigd nadat Cluvo die heeft opgeslagen.</span></div> : null}
      {waiting ? <div className="cluvo-pwa-update" role="status"><RefreshCw size={18} /><span>Nieuwe versie beschikbaar. Rond eerst je invoer af.</span><button type="button" onClick={() => {requestedUpdate.current = true; waiting.postMessage({type: 'ACTIVATE_UPDATE'});}}>Vernieuwen</button></div> : null}
      {children}
    </div>
  </PwaContext.Provider>;
}

export function InstallAppControl({compact = false}: {compact?: boolean} = {}) {
  const {installEvent, clearInstallEvent} = useContext(PwaContext);
  const standalone = useSyncExternalStore(subscribeInstallState, installed, serverFalse);
  const isIos = useSyncExternalStore(subscribeIdentity, ios, serverFalse);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  if (standalone) return compact ? null : <p className="cluvo-pwa-installed">Cluvo staat op je beginscherm.</p>;
  return <section className={`cluvo-pwa-install${compact ? ' compact' : ''}`} aria-label="Cluvo op je beginscherm">
    <button type="button" className="cluvo-pwa-install-button" disabled={busy} onClick={async () => {
      if (!installEvent || isIos) {setShowHelp(value => !value); return;}
      setBusy(true);
      try {await installEvent.prompt(); await installEvent.userChoice;}
      catch {setShowHelp(true);}
      finally {clearInstallEvent(); setBusy(false);}
    }}><Download size={18} />{installEvent && !isIos ? 'Cluvo installeren' : 'Cluvo op je beginscherm'}</button>
    {showHelp ? <p className="cluvo-pwa-install-help">{isIos ? 'Open deze pagina in Safari. Tik op Delen, eventueel via Meer, en kies Zet op beginscherm. Schakel Open als webapp in als je die keuze ziet. Tik op Voeg toe en open daarna Cluvo via het nieuwe icoon.' : 'Open het menu van je browser. Kies in Chrome Installeren en snelkoppeling maken en daarna Installeren. In andere versies kan dit App installeren of Toevoegen aan beginscherm heten. Blokkeert Samsung Internet de installatie met een waarschuwing over een oudere Android-versie? Open deze pagina in een bijgewerkte Google Chrome en installeer daar. Laat de beveiliging van je telefoon ingeschakeld. Je kunt Cluvo ook gewoon in de browser gebruiken.'}</p> : null}
  </section>;
}
