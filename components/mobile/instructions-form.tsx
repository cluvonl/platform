'use client';

import {useState} from 'react';
import {Btn, CommandStatus, dateLabel, useMobileCommand} from './primitives';
import type {MobileSnapshot, MobileTask} from './types';

export function InstructionsForm({snapshot, task}: {snapshot: MobileSnapshot; task: MobileTask}) {
  const [body, setBody] = useState(task.instructions);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const targets = (snapshot.instructionTargets ?? []).filter((target) => target.sourceTaskId === task.id);
  const action = useMobileCommand(snapshot, 'publish_instructions', task.id, task.version);
  return <form onSubmit={(event) => {event.preventDefault(); action.run({body, ...(Object.keys(chosen).length ? {propagate_to: Object.entries(chosen).map(([shift_id, expected_version]) => ({shift_id, expected_version}))} : {})});}}><fieldset disabled={action.pending || action.frozen}><legend className="sr-only">Praktische instructie verbeteren</legend><label className="field"><span>Nieuwe praktische instructie</span><textarea required maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} /></label>{targets.length > 0 && <><h3>Ook bij toekomstige taken</h3><p className="subtle">Deze geautoriseerde taken hebben dezelfde categorie, commissie en teamscope. Kies expliciet welke toekomstige instructie je ook wilt bijwerken.</p>{targets.map((target) => <label className="check-row" key={target.taskId}><input type="checkbox" checked={Object.hasOwn(chosen, target.taskId)} disabled={!Object.hasOwn(chosen, target.taskId) && Object.keys(chosen).length >= 50} onChange={(event) => {const next = {...chosen}; if (event.target.checked) next[target.taskId] = target.version; else delete next[target.taskId]; setChosen(next);}} /><span>{target.title} · {dateLabel(target.startsAt, snapshot.timezone)}</span></label>)}</>}<Btn type="submit" className="full" disabled={action.disabled || !body.trim()}>{action.pending ? 'Instructies opslaan…' : Object.keys(chosen).length ? `Bewaar instructie bij ${Object.keys(chosen).length + 1} taken` : 'Praktische instructie opslaan'}</Btn></fieldset><CommandStatus command={action} /><p className="subtle">Bestaande boekingen behouden de instructieversie die de uitvoerder heeft bevestigd.</p></form>;
}
