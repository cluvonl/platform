'use client';

import {createContext, useContext, useEffect, useId, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {Info, X} from 'lucide-react';
import {markHelpSeenAction} from '@/app/help/actions';
import {HELP_TOPICS} from './help-content';
import {PWA_HELP_TOPICS} from '@/lib/pwa/help';

type HelpContextValue = {
  seen: ReadonlySet<string>;
  loaded: boolean;
  markSeen: typeof markHelpSeenAction;
  confirmSeen: (topicId: string) => void;
};
const HelpContext = createContext<HelpContextValue | null>(null);

export function AccountHelpProvider({initialSeen, loaded, children, markSeen = markHelpSeenAction}: {
  initialSeen: string[];
  loaded: boolean;
  children: React.ReactNode;
  markSeen?: typeof markHelpSeenAction;
}) {
  const seenSignature = JSON.stringify([...initialSeen].sort());
  const [confirmation, setConfirmation] = useState<{snapshot: string; topics: string[]}>({snapshot: seenSignature, topics: []});
  // A refreshed server snapshot can also contain a reset made on another
  // device. Reconcile the acknowledgement without remounting form children.
  if (confirmation.snapshot !== seenSignature) {
    setConfirmation({snapshot: seenSignature, topics: []});
  }
  const confirmed = confirmation.snapshot === seenSignature ? confirmation.topics : [];
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);
  return <HelpContext.Provider value={{
    seen: new Set([...initialSeen, ...confirmed]), loaded, markSeen,
    confirmSeen: (topicId) => setConfirmation((previous) => ({
      snapshot: seenSignature,
      topics: [...new Set([...(previous.snapshot === seenSignature ? previous.topics : []), topicId])],
    })),
  }}>{children}</HelpContext.Provider>;
}

export function AccountHelpBanner({topicId}: {topicId: string}) {
  const context = useContext(HelpContext);
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const topic = HELP_TOPICS[topicId] ?? PWA_HELP_TOPICS[topicId];
  if (!context?.loaded || !topic || context.seen.has(topicId)) return null;
  const dismiss = () => startTransition(async () => {
    setError(null);
    try {
      const result = await context.markSeen(topicId);
      if (result.ok) context.confirmSeen(topicId);
      else setError(result.message ?? 'Opslaan is niet gelukt. Probeer het opnieuw.');
    } catch {
      setError('Je keuze is nog niet opgeslagen. Controleer je verbinding en probeer opnieuw.');
    }
  });
  return <aside className="cluvo-help-banner" role="note" aria-labelledby={titleId} data-help-id={topicId} aria-busy={pending}>
    <Info className="cluvo-help-icon" size={21} aria-hidden="true" />
    <div className="cluvo-help-copy"><h3 id={titleId}>{topic.title}</h3><p>{topic.text}</p>{error ? <p role="alert">{error}</p> : null}</div>
    <button type="button" className="cluvo-help-close" onClick={dismiss} disabled={pending} aria-label={`Uitleg sluiten: ${topic.title}`}><X size={18} aria-hidden="true" /></button>
    <div className="cluvo-help-footer"><button type="button" className="cluvo-help-seen" onClick={dismiss} disabled={pending} aria-label={`Gezien: ${topic.title}`}>{pending ? 'Opslaan…' : 'Gezien'}</button></div>
  </aside>;
}
