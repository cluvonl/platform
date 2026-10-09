'use client';

import {useEffect, useRef, useState, useTransition} from 'react';
import {MobileLink as Link} from './mobile-link';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {CalendarDays, Check, ChevronRight, Clock, Coffee, Flag, HandHeart, Inbox, MapPin, Users, Utensils, Wrench, X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose} from '@/components/ui/sheet';
import {mobileCommandAction, mobileCommandStatusAction, mobilePrepareCommandAction} from '@/lib/pwa/actions';
import {AccountHelpBanner} from '@/components/app/help-provider';
import {clearMobileDrafts} from './draft-state';
import type {MobileCommandInput, MobileCommandResult, MobileProgress, MobileSnapshot, MobileTask} from './types';

export const hours = (minutes: number) => new Intl.NumberFormat('nl-NL', {maximumFractionDigits: 2}).format(minutes / 60);
export const money = (cents: number) => new Intl.NumberFormat('nl-NL', {style: 'currency', currency: 'EUR'}).format(cents / 100);
export const dateLabel = (value: string, timezone = 'Europe/Amsterdam') => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('nl-NL', {day: 'numeric', month: 'short', timeZone: timezone}).format(new Date(value)) : 'Geen datum';
export const timeLabel = (value: string | null, timezone = 'Europe/Amsterdam') => value ? new Intl.DateTimeFormat('nl-NL', {hour: '2-digit', minute: '2-digit', timeZone: timezone}).format(new Date(value)) : 'Eindtijd onbekend';
const activeCommands = new Set<string>();
const openedSheets = new Set<string>();
const sheetOpeners = new Map<string, HTMLElement>();
let activeScope = '';
export const enterMobileScope = (scope: string) => {if (scope !== activeScope) {activeCommands.clear(); openedSheets.clear(); sheetOpeners.clear(); clearMobileDrafts(); activeScope = scope;}};
export const resolveMobileCommand = (key: string) => {activeCommands.delete(key);};
export const hasUnresolvedMobileCommand = () => activeCommands.size > 0;
export function Btn({tone = 'primary', className = '', children, ...props}: React.ComponentProps<typeof Button> & {tone?: 'primary' | 'quiet' | 'outline' | 'danger'}) {
  return <Button {...props} className={`app-btn ${tone} ${className}`}>{children}</Button>;
}
export function Tag({tone = 'neutral', children}: {tone?: string; children: React.ReactNode}) {return <span className={`tag ${tone}`}>{children}</span>;}
export function Avatar({name, large = false}: {name: string; large?: boolean}) {return <span aria-hidden="true" className={`avatar${large ? ' large' : ''}`}>{name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('')}</span>;}
export function Heading({title, subtitle, action}: {title: string; subtitle?: string; action?: React.ReactNode}) {return <div className="page-heading"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;}
export function Section({title, action, children, className = ''}: {title: string; action?: React.ReactNode; children: React.ReactNode; className?: string}) {return <section className={`section ${className}`}><div className="section-heading"><h2>{title}</h2>{action}</div>{children}</section>;}
export function Blank({title, text, action}: {title: string; text: string; action?: React.ReactNode}) {return <div className="empty"><Inbox size={28} aria-hidden="true" /><h2>{title}</h2><p>{text}</p>{action}</div>;}
export function Help({topic}: {topic: string}) {
  const parts = topic.split('.');
  const aliases: Record<string, string> = {club: 'more', 'task-filters': 'tasks', takeovers: 'tasks', team: 'teams', 'team-tool': 'teams', planning: 'manage', cluster: 'manage', 'household-invite': 'household', 'household-question': 'household', 'policy-accept': 'policies', 'opportunity-detail': 'opportunities', 'work-card': 'committees', 'work-create': 'committees', document: 'committees'};
  const dialogues: Record<string, string> = {'task-detail': 'instructions', 'choose-executor': 'booking', issue: 'booking', 'hours-check': 'booking', feedback: 'feedback', 'team-allocation': 'team-allocation', handover: 'handover'};
  const id = parts[0] === 'app' ? `pwa.${aliases[parts[1]] ?? parts[1]}.v1` : parts[0] === 'dialog' ? `pwa.${dialogues[parts[1]] ?? 'booking'}.v1` : topic;
  return <AccountHelpBanner topicId={id} />;
}
export function Meter({progress, seasonName, href}: {progress: MobileProgress; seasonName?: string; href?: string}) {
  const percent = progress.exempt || progress.target === 0 ? 100 : Math.min(100, progress.confirmed / progress.target * 100);
  return <article className="household-meter"><div className="meter-top"><span>Ons huishouden</span>{seasonName && <Tag tone="dark">{seasonName}</Tag>}</div><div className="meter-figure"><div><strong>{progress.exempt ? 'Vrijgesteld' : hours(progress.confirmed)}</strong>{!progress.exempt && <span> / {hours(progress.target)} uur</span>}<p>{progress.exempt ? 'Een erkende huishoudafspraak' : 'Bevestigde verenigingsuren'}</p></div><span className="meter-symbol"><HandHeart size={30} /></span></div><div className="meter-progress" role="progressbar" aria-label="Bevestigde verenigingsuren" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><i style={{width: `${percent}%`}} /></div><div className="meter-split"><span><i /> {hours(progress.planned)} uur ingepland</span><span>{hours(progress.pending)} uur ter controle</span></div><div className="winter-line"><span>Vóór de winterstop</span><b>{hours(progress.winterConfirmed)} / {hours(progress.winterTarget)} uur</b></div><div className="winter-progress"><i style={{width: `${progress.winterTarget === 0 ? 100 : Math.min(100, progress.winterConfirmed / progress.winterTarget * 100)}%`}} /></div>{href && <Link className="meter-link" href={href}>Bekijk uren en afspraken</Link>}</article>;
}
export function TaskCard({task, snapshot, onClick, compact, status}: {task: MobileTask; snapshot: MobileSnapshot; onClick: () => void; compact?: boolean; status?: string}) {
  const Icon = task.category === 'Bar' ? Coffee : task.category === 'Keuken' ? Utensils : task.category === 'Onderhoud' ? Wrench : ['Fluiten', 'Grensrechter'].includes(task.category) ? Flag : task.category === 'Ontvangst' ? Users : HandHeart;
  return <button type="button" className={`task-card${compact ? ' compact' : ''}`} onClick={onClick}><span className={`task-icon category-${task.category}`}><Icon size={23} /></span><span className="task-copy"><span className="task-top"><Tag tone={task.kind === 'team' ? 'purple' : 'coral'}>{task.kind === 'team' ? 'Teamtaak' : 'Verenigingstaak'}</Tag>{status && <Tag tone="blue">{status}</Tag>}</span><h3>{task.title}</h3><span className="task-meta"><CalendarDays size={14} />{dateLabel(task.startsAt, snapshot.timezone)} · {timeLabel(task.startsAt, snapshot.timezone)}–{timeLabel(task.endsAt, snapshot.timezone)}</span>{!compact && <span className="task-meta"><MapPin size={14} />{task.location}</span>}<span className="task-bottom"><b>{task.minutes > 0 ? `${hours(task.minutes)} verenigingsuur` : 'Geen verenigingsuren'}</b><span>{status ?? `${task.freePlaces} ${task.freePlaces === 1 ? 'plek' : 'plekken'} vrij`}</span></span></span><ChevronRight size={18} className="row-chevron" /></button>;
}
export function Drawer({open, onClose, title, description, footer, children}: {open: boolean; onClose: () => void; title: string; description?: string; footer?: React.ReactNode; children: React.ReactNode}) {
  const [blocked, setBlocked] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const openerKey = useRef('');
  const rememberOpener = () => {
    openerKey.current = `${window.location.pathname}${window.location.search}`;
    const active = document.activeElement;
    returnFocus.current = sheetOpeners.get(openerKey.current) ?? (active instanceof HTMLElement && active !== document.body ? active : null);
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    sheetOpeners.delete(openerKey.current);
    if (returnFocus.current?.isConnected) {returnFocus.current.focus({preventScroll: true}); return;}
    const heading = document.querySelector<HTMLElement>('.cluvo-mobile main h1');
    if (heading) {
      const hadTabIndex = heading.hasAttribute('tabindex');
      if (!hadTabIndex) heading.setAttribute('tabindex', '-1');
      heading.focus({preventScroll: true});
      if (!hadTabIndex) heading.addEventListener('blur', () => heading.removeAttribute('tabindex'), {once: true});
    }
  };
  return <Sheet open={open} onOpenChange={(next) => {if (!next) {if (activeCommands.size) setBlocked(true); else onClose();}}}><SheetContent side="bottom" className="cluvo-mobile-portal app-sheet" showCloseButton={false} onOpenAutoFocus={rememberOpener} onCloseAutoFocus={restoreFocus}><span className="sheet-handle" aria-hidden="true" /><SheetHeader className="sheet-head"><SheetTitle>{title}</SheetTitle><SheetDescription>{description ?? 'Bekijk de gegevens en kies je volgende stap.'}</SheetDescription><SheetClose className="sheet-close" aria-label="Sluiten"><X size={22} /></SheetClose></SheetHeader><div className="sheet-body">{blocked && <p role="status" className="notice amber">Controleer eerst de uitkomst van je bevestiging voordat je dit venster sluit.</p>}{children}</div>{footer && <div className="sheet-foot">{footer}</div>}</SheetContent></Sheet>;
}
export function Field({label, children}: {label: string; children: React.ReactNode}) {return <label className="field"><span>{label}</span>{children}</label>;}
export function Pick({label, value, onChange, options, disabled}: {label: string; value: string; onChange: (value: string) => void; options: {value: string; label: string}[]; disabled?: boolean}) {return <Field label={label}><select className="field-select" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{!value && <option value="" disabled>Kies een optie</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;}
export function Segments({value, options, onChange}: {value: string; options: {value: string; label: string}[]; onChange: (value: string) => void}) {return <div className="mobile-segments" role="group" aria-label="Weergave">{options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;}
export function Facts({task, snapshot}: {task: MobileTask; snapshot: MobileSnapshot}) {return <div className="detail-facts"><div><CalendarDays /><span>{dateLabel(task.startsAt, snapshot.timezone)}</span></div><div><Clock /><span>{timeLabel(task.startsAt, snapshot.timezone)}–{timeLabel(task.endsAt, snapshot.timezone)}</span></div><div><MapPin /><span>{task.location}</span></div><div><HandHeart /><span>{hours(task.minutes)} verenigingsuur ({task.minutes} minuten)</span></div></div>;}
export function Capability({snapshot, screen}: {snapshot: MobileSnapshot; screen: keyof MobileSnapshot['capabilities']}) {
  const capability = snapshot.capabilities[screen];
  return capability?.available === false ? <p className="notice blue" role="status">{capability.reason ?? 'Dit onderdeel kan nu niet worden geladen. Probeer het opnieuw met verbinding.'}</p> : null;
}
export function useSheetQuery() {
  const router = useRouter();
  const search = useSearchParams();
  const pathname = usePathname();
  const open = (values: Record<string, string>) => {const next = new URLSearchParams(search.toString()); for (const [key, value] of Object.entries(values)) next.set(key, value); const key = `${pathname}?${next}`; openedSheets.add(key); if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) sheetOpeners.set(key, document.activeElement); router.push(`?${next}`, {scroll: false});};
  const close = (keys = ['task', 'booking', 'allocation', 'transfer', 'reserve', 'view']) => {const current = `${pathname}?${search}`; if (openedSheets.delete(current)) {router.back(); return;} const next = new URLSearchParams(search.toString()); for (const key of keys) next.delete(key); router.replace(next.size ? `?${next}` : '?', {scroll: false});};
  return {search, open, close};
}
export function useUrlSegment(key: string, options: readonly string[], fallback: string) {
  const search = useSearchParams();
  const router = useRouter();
  const requested = search.get(key);
  const value = requested && options.includes(requested) ? requested : fallback;
  const setValue = (nextValue: string) => {
    if (!options.includes(nextValue) || nextValue === value) return;
    const next = new URLSearchParams(search.toString());
    next.set(key, nextValue);
    router.push(`?${next}`, {scroll: false});
  };
  return [value, setValue] as const;
}
export function useMobileCommand(snapshot: MobileSnapshot, command: string, resourceId?: string, expectedVersion = 0) {
  const router = useRouter();
  const frozen = useRef<MobileCommandInput | null>(null);
  const anchor = useRef({resourceId, expectedVersion});
  const refreshRequested = useRef(false);
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<MobileCommandResult | null>(null);
  const available = snapshot.commands.includes(command);
  const previousPending = (snapshot.pendingCommands?.length ?? 0) > 0;
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {if (frozen.current) {event.preventDefault();}};
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const run = (payload: Record<string, unknown>, onConfirmed?: () => void) => {
    if (busy.current || frozen.current || previousPending || activeCommands.size || !available) return;
    if (!navigator.onLine) {setResult({status: 'rejected', message: 'Je bent offline. Maak verbinding om deze stap te bevestigen.', idempotencyKey: ''}); return;}
    if (anchor.current.resourceId !== resourceId || result?.status === 'confirmed' || refreshRequested.current) {anchor.current = {resourceId, expectedVersion}; refreshRequested.current = false;}
    const input: MobileCommandInput = {club: snapshot.workspace.tenant_slug, command, resourceId, expectedVersion: anchor.current.expectedVersion, payload, idempotencyKey: crypto.randomUUID()};
    frozen.current = input; busy.current = true; activeCommands.add(input.idempotencyKey);
    startTransition(async () => {
      try {
        const prepared = await mobilePrepareCommandAction(input);
        if (!prepared.ok) {frozen.current = null; activeCommands.delete(input.idempotencyKey); setResult({status: 'rejected', message: prepared.message ?? 'Je keuze kon niet worden klaargezet.', idempotencyKey: input.idempotencyKey}); return;}
        const response = await mobileCommandAction(input);
        setResult(response);
        if (response.status !== 'unknown') {frozen.current = null; activeCommands.delete(input.idempotencyKey);}
        if (response.status === 'confirmed') {router.refresh(); onConfirmed?.();}
      } catch {setResult({status: 'unknown', message: 'De uitkomst is nog niet bekend. Controleer de status voordat je opnieuw bevestigt.', idempotencyKey: input.idempotencyKey});}
      finally {busy.current = false;}
    });
  };
  const check = () => {
    const input = frozen.current;
    if (!input || busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {const response = await mobileCommandStatusAction({club: input.club, idempotencyKey: input.idempotencyKey}); setResult(response); if (response.status !== 'unknown') {frozen.current = null; activeCommands.delete(input.idempotencyKey);} if (response.status === 'confirmed') router.refresh();}
      catch {setResult({status: 'unknown', message: 'Status ophalen lukt nog niet. De bevestiging blijft bewaard.', idempotencyKey: input.idempotencyKey});}
      finally {busy.current = false;}
    });
  };
  return {run, check, refresh: () => {refreshRequested.current = true; router.refresh();}, result, pending, frozen: result?.status === 'unknown' || previousPending, disabled: pending || result?.status === 'unknown' || previousPending || !available, available};
}
export function CommandStatus({command, onRefresh}: {command: ReturnType<typeof useMobileCommand>; onRefresh?: () => void}) {
  return <>{command.result && <div role={command.result.status === 'rejected' ? 'alert' : 'status'} className={`notice ${command.result.status === 'confirmed' ? 'success' : 'amber'}`}><span>{command.result.status === 'confirmed' && <Check size={18} />}{command.result.message}</span>{command.result.status === 'unknown' && <Btn tone="outline" disabled={command.pending} onClick={command.check}>Controleer status</Btn>}{command.result.status === 'rejected' && /intussen|instructies zijn gewijzigd|inmiddels bezet/.test(command.result.message) && <Btn tone="outline" onClick={() => {command.refresh(); onRefresh?.();}}>Actuele gegevens ophalen</Btn>}</div>}</>;
}
