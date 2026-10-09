import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadScopedMatchDetails,mergeScopedMatchDetails} from '../lib/pwa/match-details.mjs';

const id=(number)=>`30000000-0000-4000-8000-${String(number).padStart(12,'0')}`;
const tenant=id(1),otherTenant=id(2),team=id(3),match=id(4);
const snapshot=()=>[{id:match,team_id:team,version:2,starts_at:'2026-10-10T08:00:00Z',opponent:'Other team'}];
const native=(changes={})=>({id:match,tenant_id:tenant,team_id:team,version:2,field_name:'Veld 3',locker_room_text:'Kleedkamer 8',...changes});
test('native metadata enriches only the exact existing match and does not expose unrelated fields or rows',()=>{
  const result=mergeScopedMatchDetails(snapshot(),[native({email:'private@example.test',auth_user_id:id(5)}),native({id:id(6)})],tenant);
  assert.deepEqual(result,[{...snapshot()[0],field_name:'Veld 3',locker_room_text:'Kleedkamer 8'}]);
  assert.equal(Object.hasOwn(result[0],'ends_at'),false);
  assert.equal(Object.hasOwn(result[0],'email'),false);
});
test('tenant, team, version and ambiguous native rows cannot contribute practical match details',()=>{
  for(const candidates of [[native({tenant_id:otherTenant})],[native({team_id:id(7)})],[native({version:3})],[native({version:'2'})],[native(),native()],[]]) {
    const result=mergeScopedMatchDetails(snapshot(),candidates,tenant);
    assert.equal(result.length,1);
    assert.equal(result[0].id,match);
    assert.equal(result[0].field_name,undefined);
    assert.equal(result[0].locker_room_text,undefined);
  }
  assert.deepEqual(mergeScopedMatchDetails(snapshot(),[native({field_name:'  ',locker_room_text:null})],tenant),[{...snapshot()[0],field_name:undefined,locker_room_text:undefined}]);
});
const queryClient=(response,calls=[])=>({schema(value){calls.push(['schema',value]);return {from(value){calls.push(['from',value]);return {select(value){calls.push(['select',value]);return {eq(key,value){calls.push(['eq',key,value]);return {async in(key,value){calls.push(['in',key,value]);return response;}};}};}};}};}});
test('the actor client reads the native API with an explicit tenant and only snapshot match IDs',async()=>{
  const calls=[];
  const result=await loadScopedMatchDetails(queryClient({data:[native()],error:null},calls),tenant,snapshot());
  assert.equal(result[0].field_name,'Veld 3');
  assert.deepEqual(calls,[['schema','api'],['from','my_matches'],['select','id,tenant_id,team_id,version,field_name,locker_room_text'],['eq','tenant_id',tenant],['in','id',[match]]]);
  const emptyCalls=[];
  assert.deepEqual(await loadScopedMatchDetails(queryClient({},emptyCalls),tenant,[]),[]);
  assert.deepEqual(emptyCalls,[]);
});
test('failed native reads and malformed selectors fail closed without leaking provider errors',async()=>{
  for(const response of [{data:null,error:{message:'secret connection'}},{data:{field_name:'Veld'},error:null},{data:[null],error:null}])await assert.rejects(loadScopedMatchDetails(queryClient(response),tenant,snapshot()),(error)=>error.message.includes('niet veilig')&&!error.message.includes('secret'));
  const calls=[];
  await assert.rejects(loadScopedMatchDetails(queryClient({},calls),tenant,[{id:'private-token'}]));
  assert.deepEqual(calls,[]);
});
