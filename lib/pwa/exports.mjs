function csvCell(value) {
  const text=String(value??'');
  const neutral=/^[\s\u0000-\u001f]*[=+@-]/u.test(text)?"'"+text:text;
  return '"'+neutral.replaceAll('"','""')+'"';
}
export function householdCSV(reports,season) {
  const rows=[['Huishouden','Seizoen','Doel minuten','Winterdoel minuten','Bevestigd minuten','Voor winter bevestigd minuten','Ingepland minuten','Ter controle minuten','Resterend minuten','Structureel vrijgesteld'],
    ...reports.map(row=>[row.name,season??'',row.progress.target,row.progress.winterTarget,row.progress.confirmed,row.progress.winterConfirmed,row.progress.planned,row.progress.pending,row.progress.remaining,row.progress.exempt?'ja':'nee'])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
const escapeICS=value=>String(value??'').replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[\u0000-\u001f\u007f]/g,'').replaceAll(';','\\;').replaceAll(',','\\,');
function instant(value) {
  const time=new Date(value);if(!Number.isFinite(time.getTime()))throw Error('CALENDAR_TIME_INVALID');
  return time.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
}
function fold(line) {
  const parts=[];let part='',bytes=0;
  for(const char of line) {
    const length=Buffer.byteLength(char);
    if(bytes+length>75){parts.push(part);part=' ';bytes=1;}
    part+=char;bytes+=length;
  }
  parts.push(part);return parts.join('\r\n');
}
export function calendarICS(events,readAt) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Cluvo//Persoonlijke agenda//NL','CALSCALE:GREGORIAN'];
  for(const event of events) {
    if(!/^[0-9a-f-]{36}$/i.test(event.id))throw Error('CALENDAR_RESOURCE_INVALID');
    lines.push('BEGIN:VEVENT',`UID:${event.kind}-${event.id}@cluvo.nl`,`DTSTAMP:${instant(readAt)}`,`DTSTART:${instant(event.startsAt)}`);
    if(event.endsAt)lines.push(`DTEND:${instant(event.endsAt)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`,`LOCATION:${escapeICS(event.location)}`,'END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
