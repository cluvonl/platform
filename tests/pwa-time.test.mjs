import test from 'node:test';
import assert from 'node:assert/strict';
import {localDateTimeCandidates,resolveClubTimestamp} from '../lib/pwa/time.mjs';
test('club wall time uses club timezone independently of device timezone',()=>{
  assert.equal(resolveClubTimestamp('2026-07-05T09:00','Europe/Amsterdam'),'2026-07-05T07:00:00.000Z');
  assert.equal(resolveClubTimestamp('2026-01-05T09:00','Europe/Amsterdam'),'2026-01-05T08:00:00.000Z');
  assert.equal(resolveClubTimestamp('2026-07-05T09:00','Asia/Kathmandu'),'2026-07-05T03:15:00.000Z');
});
test('nonexistent and repeated DST hours demand an explicit unambiguous time',()=>{
  assert.deepEqual(localDateTimeCandidates('2026-03-29T02:30','Europe/Amsterdam'),[]);
  assert.deepEqual(localDateTimeCandidates('2026-10-25T02:30','Europe/Amsterdam'),['2026-10-25T00:30:00.000Z','2026-10-25T01:30:00.000Z']);
  assert.throws(()=>resolveClubTimestamp('2026-03-29T02:30','Europe/Amsterdam'),/NONEXISTENT/);
  assert.throws(()=>resolveClubTimestamp('2026-10-25T02:30','Europe/Amsterdam'),/AMBIGUOUS/);
  assert.equal(resolveClubTimestamp('2026-10-25T02:30+01:00','Europe/Amsterdam'),'2026-10-25T01:30:00.000Z');
  assert.throws(()=>resolveClubTimestamp('2026-02-30T12:00','Europe/Amsterdam'),/INVALID/);
  assert.throws(()=>resolveClubTimestamp('2026-02-30T12:00+01:00','Europe/Amsterdam'),/INVALID/);
});
