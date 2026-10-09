'use client';

import {CommandForm} from './command-form';
import {dateLabel, timeLabel, Tag} from './primitives';
import type {MobileSnapshot} from './types';

export function CommitteeFollowup({snapshot}: {snapshot: MobileSnapshot}) {
  const clusters = snapshot.committeeClusters ?? [];
  return <>{clusters.map((cluster) => {
    const phase = Date.parse(snapshot.readAt) <= Date.parse(cluster.selfUntil) ? 'Zelf kiezen' : Date.parse(snapshot.readAt) <= Date.parse(cluster.assignUntil) ? 'Teamouder verdeelt' : 'Commissie volgt op';
    const team = snapshot.receivingTeams?.find((item) => item.id === cluster.teamId) ?? snapshot.teams.find((item) => item.id === cluster.teamId);
    const committee = snapshot.committees.find((item) => item.id === cluster.committeeId);
    const places = snapshot.allocations.filter((item) => item.clusterId === cluster.id);
    return <article className="simple-card" key={cluster.id}><Tag tone="amber">{phase}</Tag><h3>{cluster.title}</h3>{(team || committee) && <p>{[team?.name, committee?.name].filter(Boolean).join(' · ')}</p>}<div className="summary-line"><span>Zelf kiezen tot</span><b>{dateLabel(cluster.selfUntil, snapshot.timezone)} · {timeLabel(cluster.selfUntil, snapshot.timezone)}</b></div><div className="summary-line"><span>Teamouder verdeelt tot</span><b>{dateLabel(cluster.assignUntil, snapshot.timezone)} · {timeLabel(cluster.assignUntil, snapshot.timezone)}</b></div>{!!places.length && <p>{places.length} concrete plaatsen zichtbaar in jouw scope · {places.filter((place) => place.bookingId).length} met bevestigde uitvoerder</p>}{cluster.canFollowup && <CommandForm snapshot={snapshot} command="set_followup" resourceId={cluster.id} version={cluster.version} fields={[{name: 'self_until', label: 'Zelf kiezen tot', type: 'datetime-local', value: cluster.selfUntil, required: true}, {name: 'assign_until', label: 'Teamouder verdeelt tot', type: 'datetime-local', value: cluster.assignUntil, required: true}]} submit="Opvolgafspraken opslaan" />}</article>;})}{!clusters.length && <p className="subtle">Er zijn geen concrete teamclusters in jouw geautoriseerde commissieoverzicht.</p>}</>;
}
