'use client';

import {MobileLink as Link} from './mobile-link';
import {Btn, dateLabel, Tag} from './primitives';
import type {MobileActionDetail} from './types';

const labels = {work_card: 'Werkafspraak', subtask: 'Subtaak', card_mention: 'Vermelding in werkafspraak', event_mention: 'Vermelding bij activiteit', team_task: 'Teamafspraak', policy_question: 'Vraag over beleid'};
const states: Record<string, string> = {open: 'Open', completed: 'Afgerond', archived: 'Gearchiveerd', cancelled: 'Geannuleerd', in_review: 'In behandeling', answered: 'Beantwoord', closed: 'Gesloten', scheduled: 'Gepland', moved: 'Verplaatst'};
const parentLabels = {card: 'Bekijk deze werkafspraak', event: 'Bekijk deze activiteit', team: 'Bekijk dit team', policy: 'Bekijk deze beleidsversie'};

export function ActionDetail({detail, timezone}: {detail: MobileActionDetail; timezone: string}) {
  return <><div className="detail-tags"><Tag tone="blue">{labels[detail.kind]}</Tag><Tag>{states[detail.state] ?? detail.state}</Tag></div>{detail.parentTitle && <p>{detail.parentTitle}</p>}{detail.dueAt && <p>{dateLabel(detail.dueAt, timezone)}</p>}<p className="instruction-text">{detail.text}</p>{detail.resolution && <div className="notice blue"><span><b>Terugkoppeling</b><p>{detail.resolution}</p></span></div>}{detail.kind === 'team_task' && <p className="notice blue">Deze teamafspraak kent geen verenigingsuren toe.</p>}{detail.parentHref && <Btn asChild tone="outline"><Link href={detail.parentHref}>{parentLabels[detail.parentKind]}</Link></Btn>}</>;
}
