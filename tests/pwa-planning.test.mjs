import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadCommitteePlanning,projectCommitteePlanning} from '../lib/pwa/planning.mjs';

const id=(n)=>`16000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tenant=id(1),season=id(2);
const row=(changes={})=>({tenant_id:tenant,season_id:season,id:id(3),version:1,state:'draft',committee_id:id(4),committee_name:'Actual committee',category_name:'Actual category',title:'Actual draft',starts_at:'2027-02-01T10:00:00+01:00',ends_at:'2027-02-01T12:00:00+01:00',location_name:'Actual location',credit_minutes:120,position_count:2,...changes});
const client=(response,calls=[])=>({schema(value){calls.push(['schema',value]);return {async rpc(name,args){calls.push(['rpc',name,args]);return response;}};}});

test('exact tenant and selected season bind real draft metadata without exposing private fields or bookable task state',()=>{
  const projected=projectCommitteePlanning([row({email:'private@example.test',actor_auth_user_id:id(99),instructions:'unrequested private content',can_book:true,recipient_person_id:id(98)})],tenant,season);
  assert.deepEqual(projected,[{id:id(3),version:1,state:'draft',committeeId:id(4),committeeName:'Actual committee',category:'Actual category',title:'Actual draft',startsAt:'2027-02-01T10:00:00+01:00',endsAt:'2027-02-01T12:00:00+01:00',location:'Actual location',minutes:120,positions:2}]);
});

test('foreign context, ambiguous IDs, stale-shape and non-planning states fail closed',()=>{
  for(const change of [{tenant_id:id(9)},{season_id:id(9)},{id:'token'},{committee_id:'token'},{version:0},{version:'1'},{state:'cancelled'},{state:'completed'},{state:'unknown'},{title:' '},{starts_at:'unknown'},{ends_at:'2027-02-01T09:00:00+01:00'},{credit_minutes:-1},{credit_minutes:1.5},{position_count:-1}])assert.throws(()=>projectCommitteePlanning([row(change)],tenant,season),/niet veilig/);
  for(const rows of [null,{},[null],[[]],[row(),row()]])assert.throws(()=>projectCommitteePlanning(rows,tenant,season),/niet veilig/);
});

test('empty authorized planner remains empty and zero values remain exact',()=>{
  assert.deepEqual(projectCommitteePlanning([],tenant,season),[]);
  const [draft]=projectCommitteePlanning([row({credit_minutes:0,position_count:0,location_name:null})],tenant,season);
  assert.equal(draft.minutes,0);assert.equal(draft.positions,0);assert.equal(draft.location,'');
  assert.equal(projectCommitteePlanning([row({state:'published'})],tenant,season)[0].state,'published');
});

test('actor client requests only the narrow native API with the exact selected tenant and season',async()=>{
  const calls=[];
  assert.equal((await loadCommitteePlanning(client({data:[row()],error:null},calls),tenant,season))[0].state,'draft');
  assert.deepEqual(calls,[['schema','api'],['rpc','pwa_committee_planning',{p_tenant_id:tenant,p_season_id:season}]]);
  const noCalls=[];assert.deepEqual(await loadCommitteePlanning(client({},noCalls),tenant,null),[]);assert.deepEqual(noCalls,[]);
});

test('malformed context makes no request and provider failures never disclose credentials or errors',async()=>{
  for(const [t,s]of [['token',season],[tenant,'token'],[null,season],[tenant,undefined]]){const calls=[];await assert.rejects(loadCommitteePlanning(client({},calls),t,s),/niet veilig/);assert.deepEqual(calls,[]);}
  for(const response of [{data:null,error:{message:'secret provider credentials'}},{data:{},error:null},{data:[row({tenant_id:id(9)})],error:null}])await assert.rejects(loadCommitteePlanning(client(response),tenant,season),(error)=>error.message.includes('niet veilig')&&!error.message.includes('secret'));
});
