'use client';

import {useState} from 'react';
import {Btn, CommandStatus, Pick, useMobileCommand} from './primitives';
import type {MobileCard, MobileSnapshot} from './types';

type Board = NonNullable<MobileSnapshot['boards']>[number];
function localDeadline(value: string, timezone: string) {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(({type,value})=>[type,value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function WorkCardForm({snapshot, board, card, onConfirmed}: {snapshot: MobileSnapshot; board: Board; card?: MobileCard; onConfirmed?: () => void}) {
  const [title, setTitle] = useState(card?.title ?? '');
  const [description, setDescription] = useState(card?.text ?? '');
  const [column, setColumn] = useState(card?.columnId ?? '');
  const [status, setStatus] = useState(card?.state ?? 'open');
  const [deadline, setDeadline] = useState(() => localDeadline(card?.deadline ?? '', snapshot.timezone));
  const [assignees, setAssignees] = useState<string[]>(card?.assigneeIds ?? []);
  const candidates = (snapshot.assigneeCandidates ?? []).filter((person) => person.committeeId === board.committeeId);
  const command = card ? 'update_card' : 'create_card';
  const action = useMobileCommand(snapshot, command, card?.id ?? board.id, card?.version ?? board.version);
  const canManage = !card || card.canManageDetails === true;
  return <form onSubmit={(event) => {event.preventDefault(); action.run(card ? {column_id:column,status,...(canManage ? {due_at:deadline||null,assignee_person_ids:assignees} : {})} : {title,description,column_id:column,due_at:deadline||null,assignee_person_ids:assignees}, onConfirmed);}}><fieldset disabled={action.pending || action.frozen}><legend className="sr-only">{card ? 'Werkafspraak bijwerken' : 'Werkafspraak maken'}</legend>{!card && <><label className="field"><span>Wat moet er gebeuren?</span><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>Praktische toelichting</span><textarea maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} /></label></>}<Pick label="Kolom" value={column} onChange={setColumn} options={board.columns.map((item)=>({value:item.id,label:item.title}))} />{card && <Pick label="Status" value={status} onChange={setStatus} options={[{value:'open',label:'Open'},{value:'completed',label:'Afgerond'},{value:'archived',label:'Gearchiveerd'}]} />}{canManage && <><label className="field"><span>Deadline (optioneel, {snapshot.timezone})</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><h3>Uitvoerders van deze werkafspraak</h3>{candidates.map((person)=> <label className="check-row" key={person.personId}><input type="checkbox" checked={assignees.includes(person.personId)} onChange={(event)=>setAssignees(event.target.checked?[...assignees,person.personId]:assignees.filter((id)=>id!==person.personId))} /><span>{person.name}</span></label>)}{!assignees.length && <p className="subtle">Er is geen uitvoerder toegewezen.</p>}</>}<Btn type="submit" className="full" disabled={action.disabled || !column || !card && !title.trim()}>{action.pending ? 'Werkafspraak opslaan…' : card ? 'Werkafspraak bijwerken' : 'Maak de werkafspraak'}</Btn></fieldset><CommandStatus command={action} /><p className="subtle">Een afgeronde werkafspraak registreert geen presentie of verenigingsuren.</p></form>;
}
