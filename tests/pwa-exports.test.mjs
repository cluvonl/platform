import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarICS,householdCSV} from '../lib/pwa/exports.mjs';

test('CSV protects spreadsheet formulas and keeps exact integer minutes',()=>{
  const csv=householdCSV([{name:' =HYPERLINK("bad")',progress:{target:720,winterTarget:360,confirmed:15,winterConfirmed:15,planned:30,pending:0,remaining:705,exempt:false}}],'2026/27');
  assert.match(csv,/"' =HYPERLINK\(""bad""\)"/);assert.match(csv,/"720","360","15","15","30","0","705"/);
});
test('ICS preserves actual UTC instants around DST without fabricating a match duration',()=>{
  const ics=calendarICS([{id:'10000000-0000-4000-8000-000000000001',kind:'match',title:'Team, A\nBEGIN:VEVENT',location:'Veld; 1',startsAt:'2026-10-25T02:30:00+02:00',endsAt:null}],'2026-10-09T12:00:00Z');
  assert.match(ics,/DTSTART:20261025T003000Z/);assert.doesNotMatch(ics,/DTEND/);assert.equal(ics.match(/\r\nBEGIN:VEVENT/g).length,1);assert.match(ics,/Team\\, A\\nBEGIN:VEVENT/);
});
test('ICS folds Unicode safely to the RFC octet limit',()=>{
  const ics=calendarICS([{id:'10000000-0000-4000-8000-000000000001',kind:'event',title:'é'.repeat(100),location:'',startsAt:'2026-10-09T12:00:00Z',endsAt:'2026-10-09T13:00:00Z'}],'2026-10-09T12:00:00Z');
  assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));assert.match(ics.replaceAll('\r\n ',''),new RegExp('SUMMARY:'+'é'.repeat(100)));
});
