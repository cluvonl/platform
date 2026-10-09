import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const compile=async path=>ts.transpileModule(await readFile(new URL('../'+path,import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const validationSource=await compile('lib/pwa/validation.ts');
const actionSource=await compile('lib/pwa/actions.ts');
function load(source,overrides={}) {
  const testModule={exports:{}};
  runInNewContext(source,{module:testModule,exports:testModule.exports,URL,Buffer,process:{env:{APP_ENV:'local'}},
    require:name=>Object.hasOwn(overrides,name)?overrides[name]:require(name)});
  return testModule.exports;
}
function harness() {
  let authorizations=0;
  const validation=load(validationSource);
  const actions=load(actionSource,{
    'next/cache':{},
    '@/lib/auth/workspace':{async requireWorkspace(){authorizations++;throw Error('AUTHORIZATION_BOUNDARY');}},
    '@/app/c/[club]/huishouden/actions':{},
    './validation':validation,'./pending':{},'./time.mjs':{},
    '@/lib/domain/mail-recipient.mjs':{},
  });
  return {...actions,authorizations:()=>authorizations};
}
const input=command=>({club:'synthetic-club',command,expectedVersion:1,
  idempotencyKey:'00000000-0000-4000-8000-000000000001',payload:{}});

test('actual mobile actions reject inherited and unknown command names before any authorization or mutation',async()=>{
  const h=harness();
  for(const command of ['constructor','toString','__proto__','hasOwnProperty','unknown_command']) {
    assert.equal((await h.mobilePrepareCommandAction(input(command))).ok,false);
    assert.equal((await h.mobileCommandAction(input(command))).status,'rejected');
  }
  assert.equal(h.authorizations(),0);
});

test('actual mobile actions reject payload authority while a supported valid shape reaches server authorization',async()=>{
  const h=harness();
  for(const payload of [{actor:'synthetic'},{tenant_id:'00000000-0000-4000-8000-000000000002'},{role:'board'}]) {
    assert.equal((await h.mobilePrepareCommandAction({...input('start_profile'),payload})).ok,false);
  }
  assert.equal(h.authorizations(),0);
  await assert.rejects(h.mobilePrepareCommandAction(input('start_profile')),/AUTHORIZATION_BOUNDARY/);
  assert.equal(h.authorizations(),1);
});

test('actual mobile actions validate handover and contact input before authorization',async()=>{
  const h=harness();
  const handover={season_id:'00000000-0000-4000-8000-000000000002',
    successor_person_id:'00000000-0000-4000-8000-000000000003',note:'Overdracht',
    checks:[true,false,false,false,false]};
  const contact={name:'Cluvo',email:'contact@example.test',phone:'1'.repeat(40)};
  const invalid=[
    ['save_handover_draft',{...handover,note:'  '}],
    ['save_handover_draft',{...handover,checks:[]}],
    ['save_handover_draft',{...handover,checks:[true,true,true,true,null]}],
    ['prepare_handover',handover],
    ['save_club_contact',{...contact,phone:'1'.repeat(41)}],
  ];
  for(const [command,payload] of invalid) {
    assert.equal((await h.mobilePrepareCommandAction({...input(command),payload})).ok,false);
    assert.equal((await h.mobileCommandAction({...input(command),payload})).status,'rejected');
  }
  assert.equal(h.authorizations(),0);
  for(const [command,payload] of [['save_handover_draft',handover],['save_club_contact',contact]]) {
    await assert.rejects(h.mobilePrepareCommandAction({...input(command),payload}),/AUTHORIZATION_BOUNDARY/);
  }
  assert.equal(h.authorizations(),2);
});

test('actual policy actions reject malformed assignment/version pairs before authorization',async()=>{
  const h=harness();
  const id='00000000-0000-4000-8000-000000000002';
  const other='00000000-0000-4000-8000-000000000003';
  for(const command of ['open_policy','accept_policy']) {
    const extra=command==='accept_policy'?{capacity:'self',explicit_confirmation:true}:{};
    for(const pair of [
      {assignment_ids:[id],expected_versions:[]},
      {assignment_ids:[id,other],expected_versions:[1]},
      {assignment_ids:[id,id],expected_versions:[1,1]},
      {assignment_ids:[id],expected_versions:[null]},
      {assignment_ids:[id],expected_versions:[0]},
    ]) {
      const value={...input(command),payload:{...pair,...extra}};
      assert.equal((await h.mobilePrepareCommandAction(value)).ok,false);
      assert.equal((await h.mobileCommandAction(value)).status,'rejected');
    }
  }
  assert.equal(h.authorizations(),0);
  await assert.rejects(h.mobilePrepareCommandAction({...input('open_policy'),
    payload:{assignment_ids:[id],expected_versions:[1]}}),/AUTHORIZATION_BOUNDARY/);
  assert.equal(h.authorizations(),1);
});
