'use client';

import {useId} from 'react';
import {Btn, CommandStatus, useMobileCommand} from './primitives';
import type {MobileSnapshot} from './types';

export type CommandField = {name: string; label: string; type?: 'text' | 'textarea' | 'email' | 'number' | 'date' | 'time' | 'datetime-local' | 'checkbox' | 'select'; value?: string | number | boolean; required?: boolean; min?: number; max?: number; maxLength?: number; placeholder?: string; onValueChange?: (value: string) => void; options?: {value: string; label: string; disabled?: boolean}[]};
function initialFieldValue(field: CommandField, timezone: string) {
  if (!field.value || !['date', 'datetime-local'].includes(field.type ?? '') || typeof field.value !== 'string' || !field.value.includes('T')) return String(field.value ?? '');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(field.value)).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return field.type === 'date' ? date : `${date}T${parts.hour}:${parts.minute}`;
}
export function CommandForm({snapshot, command, resourceId, version = 0, fields, payload = {}, submit, disabledReason, onConfirmed, transform, onConflictRefresh}: {snapshot: MobileSnapshot; command: string; resourceId?: string; version?: number; fields: CommandField[]; payload?: Record<string, unknown>; submit: string; disabledReason?: string; onConfirmed?: () => void; onConflictRefresh?: () => void; transform?: (values: Record<string, unknown>) => Record<string, unknown>}) {
  const action = useMobileCommand(snapshot, command, resourceId, version);
  const prefix = useId();
  return <form onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {...payload};
    for (const field of fields) values[field.name] = field.type === 'checkbox' ? data.has(field.name) : field.type === 'number' ? Number(data.get(field.name)) : String(data.get(field.name) ?? '');
    action.run(transform ? transform(values) : values, onConfirmed);
  }}><fieldset disabled={action.pending || action.frozen}><legend className="sr-only">{submit}</legend>{fields.map((field) => {
    const id = `${prefix}-${field.name}`;
    if (field.type === 'checkbox') return <label className="check-row" key={field.name} htmlFor={id}><input id={id} name={field.name} type="checkbox" defaultChecked={field.value === true} required={field.required} /><span>{field.label}</span></label>;
    return <label className="field" key={field.name} htmlFor={id}><span>{field.label}{field.type === 'datetime-local' ? ` (${snapshot.timezone})` : ''}</span>{field.type === 'textarea' ? <textarea id={id} name={field.name} defaultValue={String(field.value ?? '')} maxLength={field.maxLength ?? 2000} placeholder={field.placeholder} required={field.required} /> : field.type === 'select' ? <select id={id} className="field-select" name={field.name} defaultValue={String(field.value ?? '')} required={field.required} onChange={(event) => field.onValueChange?.(event.target.value)}><option value="" disabled={field.required}>{field.options?.find((option) => option.value === '')?.label ?? (field.required ? 'Kies een optie' : 'Geen keuze')}</option>{field.options?.filter((option) => option.value !== '').map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select> : <input id={id} name={field.name} type={field.type ?? 'text'} defaultValue={initialFieldValue(field, snapshot.timezone)} min={field.min} max={field.max} maxLength={field.maxLength} placeholder={field.placeholder} required={field.required} />}</label>;
  })}<Btn type="submit" className="full" disabled={action.disabled || !!disabledReason}>{action.pending ? 'Bevestigen…' : submit}</Btn></fieldset>{disabledReason && <p className="subtle">{disabledReason}</p>}{!action.available && <p className="subtle">Deze handeling is nu niet beschikbaar. Vernieuw het overzicht of vraag je vereniging om hulp.</p>}<CommandStatus command={action} onRefresh={onConflictRefresh} /></form>;
}
