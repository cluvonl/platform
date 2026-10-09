import {resolveClubTimestamp} from '../../lib/pwa/time.mjs';

export function calendarWeek(readAt, timezone, offset = 0) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(readAt)).map(({type, value}) => [type, value]));
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (date.getUTCDay() + 6) % 7 + offset * 7, 12);
  return Array.from({length: 7}, (_, index) => resolveClubTimestamp(new Date(monday + index * 86400000).toISOString().slice(0, 10) + 'T12:00', timezone));
}
