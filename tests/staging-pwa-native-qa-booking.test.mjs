import assert from 'node:assert/strict';
import test from 'node:test';
import {buildStagingNativeQaBooking,nativeQaBookingRpc,validateNativeQaBookingReadback,
 validateNativeQaBookingRace,validateNativeQaBookingReplay,validateNativeQaBookingConflict} from '../scripts/staging-pwa-native-qa-booking.mjs';
import {nativeQaFixtureIds} from '../scripts/staging-pwa-native-qa-fixture.mjs';
import {initialSQLStatements} from '../scripts/staging-initial-migrations.mjs';

const input={actorA:'a1000000-0000-4000-8000-000000000001',actorB:'a1000000-0000-4000-8000-000000000002',
 sourceSha:'a'.repeat(40),workflowRunId:'123',actor:'contract-test',expectedVersion:0};
const failure=fn=>assert.throws(fn,error=>{
 assert.match(error.code,/^STAGING_NATIVE_QA_[A-Z_]+$/);assert.equal(error.message,error.code);return true;
});
const readback=phase=>({scope:'STAGING_NATIVE_QA_LAST_POSITION',
 ...Object.fromEntries(['bookings','active_bookings','valid_winner_rows','booking_events','booking_audits','booking_domain_events','completed_commands','pwa_completed_commands','pwa_booking_details','completed_intents'].map(key=>[key,phase==='booked'?1:0])),
 prepared_details:0,pending_intents:0,external_delivery_outbox:0,processing_commands:0,ledger_entries:0,confirmed_minutes:0,attendance_decisions:0,positions:1,shift_version:1});
const success={ok:true,code:null,sqlstate:null},capacity={ok:false,code:'CAPACITY_FULL',sqlstate:'P0001'};
const privateResult={ok:true,resource_id:'b1000000-0000-4000-8000-000000000001',version:1,
 event_ids:['b1000000-0000-4000-8000-000000000002'],result:{booking_id:nativeQaFixtureIds('123').positionRace,state:'booked'}};

test('private Native Auth actors remain bound in exactly four parameters, with stable public fixture IDs',()=>{
 const first=buildStagingNativeQaBooking(input),other=buildStagingNativeQaBooking({...input,
  actorA:'a2000000-0000-4000-8000-000000000001',actorB:'a2000000-0000-4000-8000-000000000002'});
 assert.deepEqual(first.parameters,[JSON.stringify({actorA:input.actorA,actorB:input.actorB}),input.sourceSha,'123','contract-test']);
 assert.equal(first.contextSql,other.contextSql);assert.equal(first.mutationSql,other.mutationSql);
 for(const sql of [first.contextSql,first.mutationSql,first.holderSql,first.blockingSql,first.readbackSql]){
  assert.ok(!sql.includes(input.actorA)&&!sql.includes(input.actorB));
  assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+auth\.(?:users|sessions)\b/i);
 }
 assert.match(first.contextSql,/\$1::jsonb/);assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.parameters)&&Object.isFrozen(first.fixture));
 assert.notEqual(first.fixture.shiftRace,buildStagingNativeQaBooking({...input,workflowRunId:'124'}).fixture.shiftRace);
});

test('fixture is additive, Native-verified, future one-place and uses independent executor obligations',()=>{
 const {fixture:f,mutationSql:sql}=buildStagingNativeQaBooking(input);
 assert.equal(initialSQLStatements(sql).length,1);
 assert.match(sql,/cluvo_qa_fixture.*cluvo-pwa-native-qa-fixture-v1/s);
 assert.match(sql,/auth\.sessions.*s\.not_after/s);assert.match(sql,/app\.account_person_links/);
 assert.match(sql,/qa_fixture_version.*'1'/s);assert.match(sql,/expected_version.*'0'/s);
 assert.match(sql,/interval '7 days'/);assert.match(sql,/interval '120 minutes'/);
 assert.match(sql,/INSERT INTO app\.shift_positions/);assert.match(sql,/count\(\*\).*app\.shift_positions.*=1/s);
 assert.match(sql,/shift\.book/);assert.match(sql,/g\.valid_until>=s\.ends_at/);
 assert.match(sql,/extensions\.gen_random_bytes\(32\)/);
 assert.match(sql,/'household_grant'.*'type_version'.*'shift'.*'position'/s);
 assert.notEqual(f.obligationA,f.obligationB);assert.notEqual(f.householdA,f.householdRaceB);
 assert.doesNotMatch(sql,/INSERT INTO app\.(?:hour_ledger_entries|bookings|booking_events|domain_events|policy_acceptances|intake_answers_versions)/);
 assert.match(sql,/EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION.*STAGING_NATIVE_QA_BOOKING_REFUSED/s);
});

test('fixed RPC arguments select the same last place, two own executors/obligations and distinct replay keys',()=>{
 const a=nativeQaBookingRpc('123','A'),b=nativeQaBookingRpc('123','B');
 assert.deepEqual(Object.keys(a).sort(),['p_action','p_expected_version','p_idempotency_key','p_payload','p_resource_id','p_tenant_id']);
 assert.equal(a.p_resource_id,b.p_resource_id);assert.equal(a.p_payload.shift_id,b.p_payload.shift_id);assert.equal(a.p_tenant_id,b.p_tenant_id);
 assert.equal(a.p_expected_version,1);assert.equal(b.p_expected_version,1);assert.equal(a.p_action,'book_shift');
 for(const field of ['executor_person_id','obligation_id'])assert.notEqual(a.p_payload[field],b.p_payload[field]);
 assert.notEqual(a.p_idempotency_key,b.p_idempotency_key);
 assert.equal(a.p_payload.instructions_ack,true);assert.equal(a.p_payload.cancellation_ack,true);
 failure(()=>nativeQaBookingRpc('123','other'));failure(()=>nativeQaBookingRpc('0','A'));
});

test('barrier locks the exact own shift and counts only private blocking chains reaching its backend',()=>{
 const recipe=buildStagingNativeQaBooking(input);
 assert.match(recipe.holderSql,/BEGIN READ WRITE/);assert.match(recipe.holderSql,/SELECT true AS holder_ready.*FOR UPDATE/s);
 assert.ok(recipe.holderSql.includes(recipe.fixture.shiftRace)&&recipe.holderSql.includes(recipe.fixture.qaBookingAudit));
 assert.match(recipe.blockingSql,/WITH RECURSIVE chain/);
 assert.match(recipe.blockingSql,/usename='authenticator'/);
 assert.match(recipe.blockingSql,/pg_blocking_pids\(chain.pid\)/);assert.match(recipe.blockingSql,/NOT blocking.pid=ANY\(chain.trail\)/);
 assert.match(recipe.blockingSql,/FROM pg_locks waiters/);assert.match(recipe.blockingSql,/NOT waiters.granted/);
 assert.doesNotMatch(recipe.blockingSql,/\bquery\b|wait_event_type|state='active'/);
 assert.match(recipe.blockingSql,/count\(DISTINCT origin\).*pid=pg_backend_pid\(\)/s);
 assert.equal(recipe.releaseHolderSql,'COMMIT;');assert.equal(recipe.cancelHolderSql,'ROLLBACK;');
 assert.doesNotMatch(recipe.blockingSql,/jsonb_build_object\('(?:pid|query|backend|token|identity)'/);
});

test('invalid versions, unknown knobs, getters and hostile proxy errors never become private diagnostics',()=>{
 for(const changed of [{actorA:input.actorB},{actorA:'private-invalid'},{sourceSha:'wrong'},
  {workflowRunId:'123;sql'},{actor:'unsafe actor'},{expectedVersion:1},{expectedVersion:false},{sql:'arbitrary'},{token:'synthetic-token'}])failure(()=>buildStagingNativeQaBooking({...input,...changed}));
 let reads=0;const accessor={...input};Object.defineProperty(accessor,'actorA',{get(){reads++;throw Error('SYNTHETIC_PRIVATE');}});
 failure(()=>buildStagingNativeQaBooking(accessor));assert.equal(reads,0);
 failure(()=>buildStagingNativeQaBooking(new Proxy(input,{ownKeys(){throw Error('SYNTHETIC_PRIVATE');}})));
 failure(()=>buildStagingNativeQaBooking({...input,[Symbol('alternative')]:true}));
});

test('last-place outcomes require exactly one committed success and the exact capacity SQLSTATE',()=>{
 assert.deepEqual(validateNativeQaBookingRace([success,capacity]),{contenders:2,successes:1,capacity_conflicts:1});
 assert.deepEqual(validateNativeQaBookingRace([capacity,success]),{contenders:2,successes:1,capacity_conflicts:1});
 for(const values of [[success,success],[capacity,capacity],[success],
  [success,{...capacity,code:'STALE_VERSION'}],[success,{...capacity,sqlstate:'42501'}],
  [{...success,ok:'true'},capacity],[{...success,token:'synthetic'},capacity]])failure(()=>validateNativeQaBookingRace(values));
 const overridden=[success,success];overridden.map=()=>[success,capacity];failure(()=>validateNativeQaBookingRace(overridden));
});

test('fresh readback requires one booking plus one event/audit/command and no confirmed minutes',()=>{
 assert.deepEqual(validateNativeQaBookingReadback(readback('empty'),'empty'),readback('empty'));
 assert.deepEqual(validateNativeQaBookingReadback(readback('booked')),readback('booked'));
 for(const changed of [{bookings:2},{active_bookings:2},{valid_winner_rows:0},{booking_events:2},
  {booking_audits:0},{booking_domain_events:2},{completed_commands:2},{processing_commands:1},
  {ledger_entries:1},{confirmed_minutes:120},{attendance_decisions:1},{positions:2},{shift_version:2},
  {private_identity:'synthetic'}])failure(()=>validateNativeQaBookingReadback({...readback('booked'),...changed}));
});

test('winner replay keeps the original private booking/event identities; altered payload requires idempotency conflict',()=>{
 assert.deepEqual(validateNativeQaBookingReplay(privateResult,structuredClone(privateResult)),{same_result:true});
 assert.deepEqual(validateNativeQaBookingConflict({code:'IDEMPOTENCY_CONFLICT',sqlstate:'22000'}),{altered_payload_conflict:'IDEMPOTENCY_CONFLICT'});
 for(const changed of [{resource_id:'b2000000-0000-4000-8000-000000000001'},
  {event_ids:['b2000000-0000-4000-8000-000000000002']},{version:2},{ok:false},
  {result:{...privateResult.result,booking_id:'b2000000-0000-4000-8000-000000000003'}},{result:{...privateResult.result,state:'confirmed'}},
  {private_identity:'synthetic'}])failure(()=>validateNativeQaBookingReplay(privateResult,{...privateResult,...changed}));
 for(const error of [{code:'CAPACITY_FULL',sqlstate:'P0001'},{code:'IDEMPOTENCY_CONFLICT',sqlstate:'40001'},
  {code:'IDEMPOTENCY_CONFLICT',sqlstate:'22000',token:'synthetic'}])failure(()=>validateNativeQaBookingConflict(error));
});
