import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeek} from '../components/mobile/calendar.mjs';
const localDay = (value, timezone='Europe/Amsterdam') => new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(value));
test('mobile week follows local Monday when UTC still has Sunday',()=>{
  const week=calendarWeek('2026-10-04T22:30:00Z','Europe/Amsterdam');
  assert.equal(localDay(week[0]),'2026-10-05');
  assert.equal(localDay(week[6]),'2026-10-11');
});
test('next and previous are seven calendar days through year boundary',()=>{
  assert.equal(localDay(calendarWeek('2026-12-31T18:00:00Z','Europe/Amsterdam',1)[0]),'2027-01-04');
  assert.equal(localDay(calendarWeek('2027-01-04T00:30:00Z','Europe/Amsterdam',-1)[0]),'2026-12-28');
});
test('DST weeks keep seven consecutive local dates instead of 24-hour blocks',()=>{
  const spring=calendarWeek('2026-03-28T12:00:00Z','Europe/Amsterdam');
  assert.equal(localDay(spring[6]),'2026-03-29');
  assert.equal(Date.parse(spring[6])-Date.parse(spring[5]),23*3600000);
  const autumn=calendarWeek('2026-10-24T12:00:00Z','Europe/Amsterdam');
  assert.equal(localDay(autumn[6]),'2026-10-25');
  assert.equal(Date.parse(autumn[6])-Date.parse(autumn[5]),25*3600000);
});
test('calendar is tenant-zone based for offsets on either side of UTC',()=>{
  assert.equal(localDay(calendarWeek('2026-10-04T12:30:00Z','Pacific/Kiritimati')[0],'Pacific/Kiritimati'),'2026-10-05');
  assert.equal(localDay(calendarWeek('2026-10-05T06:30:00Z','America/Los_Angeles')[0],'America/Los_Angeles'),'2026-09-28');
});
