'use client';

import {useState, useTransition} from 'react';
import {mobileReceivingTeamProposalAction} from '@/lib/pwa/actions';
import {CommandForm} from './command-form';
import {Blank, Btn, dateLabel, hasUnresolvedMobileCommand, Tag} from './primitives';
import type {MobileSnapshot} from './types';

type Proposal = Awaited<ReturnType<typeof mobileReceivingTeamProposalAction>>;

export function ClusterReservation({snapshot, onConfirmed}: {snapshot: MobileSnapshot; onConfirmed: () => void}) {
  const [positions, setPositions] = useState<string[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [teamId, setTeamId] = useState('');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState('');
  const places = snapshot.tasks.filter((task) => task.kind === 'club').flatMap((task) => (task.positions ?? []).filter((position) => !position.allocationId && snapshot.reservePreview?.some((preview) => preview.positionId === position.id && preview.canReserve)).map((position) => ({...position, task})));
  const team = proposal?.ok ? proposal.teams.find((item) => item.id === teamId) : undefined;
  const preview = () => {
    if (snapshot.canManageClubClusters !== true || !snapshot.season || !positions.length || pending || hasUnresolvedMobileCommand()) return;
    setFailure('');
    startTransition(async () => {
      try {
        const result = await mobileReceivingTeamProposalAction(snapshot.workspace.tenant_slug, snapshot.season!.id, positions);
        setProposal(result); setTeamId('');
        if (!result.ok) setFailure('Het voorstel kan nu niet worden geladen. Controleer de actuele plaatsen en je bevoegdheid.');
      } catch {setFailure('Het voorstel ophalen lukt nu niet. Je geselecteerde plaatsen blijven staan.');}
    });
  };
  if (snapshot.canManageClubClusters !== true) return <Blank title="Clubclusters vragen een extra bevoegdheid" text="Je kunt de taken in je eigen commissiescope beheren. Het reserveren en verdelen van verenigingsplaatsen vraagt de actuele clubbevoegdheid voor clubclusters." />;
  return <><h3>1. Kies concrete vrije plaatsen</h3><p className="subtle">Het teamvoorstel gebruikt de taakvoorwaarden en de bevestigde, geplande en toegewezen inzet voor deze plaatsen.</p><fieldset disabled={pending || (snapshot.pendingCommands?.length ?? 0) > 0}><legend className="sr-only">Plaatsen voor een teamcluster</legend>{places.map((position) => <label className="check-row" key={position.id}><input type="checkbox" checked={positions.includes(position.id)} onChange={(event) => {if (hasUnresolvedMobileCommand()) return; setPositions(event.target.checked ? [...positions, position.id] : positions.filter((id) => id !== position.id)); setProposal(null); setTeamId('');}} /><span>{position.task.title} · plek {position.ordinal} · {dateLabel(position.task.startsAt, snapshot.timezone)}</span></label>)}<Btn className="full" tone="outline" disabled={!snapshot.season || !positions.length || pending} onClick={preview}>{pending ? 'Teamvoorstel ophalen…' : 'Bekijk het teamvoorstel'}</Btn></fieldset>{!places.length && <Blank title="Geen vrije plaatsen in deze scope" text="Er zijn geen concrete plaatsen die jij nu aan een team kunt reserveren." />}{failure && <p className="notice amber" role="alert">{failure}</p>}{proposal?.ok && <><h3>2. Controleer het voorstel en kies een team</h3><p className="subtle">Dit zijn actuele feiten per geautoriseerd team. Je kiest zelf welk team deze concrete plaatsen ontvangt.</p><fieldset disabled={hasUnresolvedMobileCommand() || (snapshot.pendingCommands?.length ?? 0) > 0}><legend className="sr-only">Ontvangend team kiezen</legend>{proposal.teams.map((item) => <label className="radio-card" key={item.id}><input type="radio" name="receiving-team" checked={teamId === item.id} onChange={() => {if (!hasUnresolvedMobileCommand()) setTeamId(item.id);}} /><span><b>{item.name}</b><small>{item.reason}</small><small>{item.suitableMembers} passende leden · {item.confirmed} afgerond · {item.planned} ingepland · {item.assigned} uitvoerder nodig</small><Tag tone="purple">Teamdoel: {item.goal}</Tag></span></label>)}</fieldset>{!proposal.teams.length && <Blank title="Geen passend teamvoorstel beschikbaar" text="Er is geen ontvangend team beschikbaar voor deze geselecteerde plaatsen en je actuele bevoegdheid." />}{team && <><h3>3. Leg de verdeling en opvolging vast</h3><CommandForm key={team.id} snapshot={snapshot} command="reserve_cluster" resourceId={team.id} version={team.version} payload={{season_id: snapshot.season?.id, position_ids: positions}} fields={[{name: 'title', label: 'Naam van het cluster', required: true}, {name: 'mode', label: 'Verdelingswijze', type: 'select', value: 'self', options: [{value: 'self', label: 'Besloten teammarkt, daarna verdelen'}, {value: 'assign', label: 'Teamouder wijst toe'}]}, {name: 'self_until', label: 'Zelf inschrijven tot', type: 'datetime-local', required: true}, {name: 'assign_until', label: 'Teamouder verdeelt tot', type: 'datetime-local', required: true}, {name: 'counts_for_team', label: 'Telt ook voor het teamdoel', type: 'checkbox', value: true}]} submit="Wijs dit cluster toe aan het team" onConfirmed={onConfirmed} /></>}</>}</>;
}
