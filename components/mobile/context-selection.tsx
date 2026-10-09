'use client';

import {useRouter, useSearchParams} from 'next/navigation';
import {useState} from 'react';
import {mobileCommandStatusAction} from '@/lib/pwa/actions';
import {Btn, resolveMobileCommand} from './primitives';
import type {MobileSnapshot} from './types';

export function ContextSelection({snapshot}: {snapshot: MobileSnapshot}) {
  const router = useRouter();
  const search = useSearchParams();
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const needsSelection = (snapshot.households?.length ?? 0) > 1 || (snapshot.seasons?.length ?? 0) > 1;
  return <>{needsSelection && <form className="mobile-context-selection" method="get">{Object.entries(Object.fromEntries(search)).filter(([key]) => !['household', 'season'].includes(key)).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}{(snapshot.households?.length ?? 0) > 1 && <label>Huishouden<select name="household" defaultValue={snapshot.household?.id ?? ''}><option value="" disabled>Kies je huishouden</option>{snapshot.households?.map((household) => <option key={household.id} value={household.id}>{household.name}</option>)}</select></label>}{(snapshot.seasons?.length ?? 0) > 1 && <label>Seizoen<select name="season" defaultValue={snapshot.season?.id ?? ''}><option value="" disabled>Kies het seizoen</option>{snapshot.seasons?.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>}<Btn type="submit" tone="outline">Toon selectie</Btn></form>}{snapshot.pendingCommands?.length ? <div className="notice amber" role="status"><div><p>Een eerdere bevestiging wacht op een bekende uitkomst. Controleer de status voordat je dezelfde stap opnieuw zet.</p>{snapshot.pendingCommands.map((pending) => <Btn key={pending.idempotencyKey} tone="outline" disabled={checking} onClick={async () => {setChecking(true); try {const result = await mobileCommandStatusAction({club: snapshot.workspace.tenant_slug, idempotencyKey: pending.idempotencyKey}); setMessage(result.message); if (result.status !== 'unknown') {resolveMobileCommand(pending.idempotencyKey); router.refresh();}} catch {setMessage('De status kan nu niet worden opgehaald. Probeer opnieuw met verbinding.');} finally {setChecking(false);}}}>Controleer eerdere bevestiging</Btn>)}{message && <p>{message}</p>}</div></div> : null}</>;
}
