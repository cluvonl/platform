import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceBindingSnapshot,sourceBindingHash,syntheticBinding,SourceBindingError,PROJECT,OFFICIAL_CA_SHA256,IMAGE,SOCKET} from '../scripts/staging-capture-binding.mjs';
import {collectSnapshot,CollectorError} from '../scripts/staging-capture-collector.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
const clone=value=>JSON.parse(JSON.stringify(value));
const options=()=>({source_sha:'1'.repeat(40),migration_files:clone(IMMUTABLE16)});
const hosted=()=>({schema_version:1,source_scope:'HOSTED_VERIFY_FULL',actual_project_ref:PROJECT,intended_staging_project_ref:PROJECT,environment:'staging',target:{database:'postgres',host:'db.'+PROJECT+'.supabase.co',port:'5432',username:'postgres',mode:'direct'},transport:{client_tls:true,client_tls_protocol:'TLSv1.3',client_certificate_verified:true,ssl_mode:'verify-full',postgres_version:170011,libpq_version:180000,official_ca_sha256:OFFICIAL_CA_SHA256,bridge_source_sha256:'2'.repeat(64)}});
const local=()=>({schema_version:1,source_scope:'LOCAL_OWNED_CLONE',actual_project_ref:null,intended_staging_project_ref:PROJECT,environment:'local',owned_clone:{container_id:'3'.repeat(64),image_digest:IMAGE,daemon_socket:SOCKET,proof_binding_sha256:'4'.repeat(64)},transport:{client_tls:false,postgres_version:170011,libpq_version:170011}});
const rejected=fn=>assert.throws(fn,e=>e instanceof SourceBindingError&&/^[A-Z_]+$/.test(e.code));
function duck(){const calls={begin:0,query:0,check:0};return{calls,async beginCapture(){calls.begin++;throw Error('synthetic never begin');},async captureQuery(){calls.query++;throw Error('synthetic never query');},async checkLock(){calls.check++;throw Error('synthetic never lock');}};}
async function frontDoorRejects(bridge,opt=options()){
 await assert.rejects(collectSnapshot(bridge,opt),e=>e instanceof CollectorError&&['CAPTURE_SOURCE_OWNER_UNAVAILABLE','CAPTURE_SOURCE_BINDING_UNAVAILABLE'].includes(e.code));
 assert.deepEqual(bridge.calls,{begin:0,query:0,check:0});
}
test('record validator distinguishes exact target and measured transport; this is no source registration',()=>{
 for(const value of [hosted(),{...hosted(),target:{database:'postgres',host:'aws-0-eu-west-1.pooler.supabase.com',port:'5432',username:'postgres.'+PROJECT,mode:'session_pooler'}},local(),syntheticBinding()]){
  const snapshot=sourceBindingSnapshot(value);assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.transport));assert.equal(sourceBindingHash(snapshot).length,64);
  assert.ok(!Object.hasOwn(snapshot,'password')&&!Object.hasOwn(snapshot,'environment_values'));
 }
});
for(const [name,update] of [
 ['wrong actual project',r=>r.actual_project_ref='x'.repeat(20)],
 ['wrong intended project',r=>r.intended_staging_project_ref='x'.repeat(20)],
 ['production environment',r=>r.environment='production'],
 ['wrong database',r=>r.target.database='other'],
 ['transaction pooler port',r=>r.target.port='6543'],
 ['wrong hostname',r=>r.target.host='db.other.supabase.co'],
 ['wrong username',r=>r.target.username='supabase_admin'],
 ['wrong connection mode',r=>r.target.mode='transaction_pooler'],
 ['pooler with direct username',r=>{r.target.mode='session_pooler';r.target.host='aws-0-eu-west-1.pooler.supabase.com';}],
 ['TLS disabled',r=>r.transport.client_tls=false],
 ['certificate unverified',r=>r.transport.client_certificate_verified=false],
 ['SSL require downgrade',r=>r.transport.ssl_mode='require'],
 ['old TLS protocol',r=>r.transport.client_tls_protocol='TLSv1.1'],
 ['wrong server version',r=>r.transport.postgres_version=170010],
 ['unknown libpq version',r=>r.transport.libpq_version=null],
 ['wrong public CA',r=>r.transport.official_ca_sha256='5'.repeat(64)],
 ['missing bridge source pin',r=>r.transport.bridge_source_sha256=null],
 ['credential field',r=>r.password='SYNTHETIC_VALUE_MUST_NOT_BE_EXPORTED'],
 ['arbitrary transport field',r=>r.transport.unverified_extra=true]
])test('shape-only source contract rejects '+name,()=>{const value=hosted();update(value);rejected(()=>sourceBindingSnapshot(value));});
test('local and synthetic bindings can never carry actual hosted project labels',()=>{
 for(const value of [local(),clone(syntheticBinding())]){value.actual_project_ref=PROJECT;rejected(()=>sourceBindingSnapshot(value));}
 const value=local();value.owned_clone.image_digest='arbitrary';rejected(()=>sourceBindingSnapshot(value));
});
test('own data snapshots retain source values/hash when original nested records change after await',async()=>{
 const value=hosted(),copy=sourceBindingSnapshot(value),before=sourceBindingHash(copy);
 await Promise.resolve();value.target.host='changed.example.invalid';value.transport.postgres_version=0;value.actual_project_ref=null;
 assert.equal(copy.target.host,'db.'+PROJECT+'.supabase.co');assert.equal(copy.transport.postgres_version,170011);assert.equal(sourceBindingHash(copy),before);
});
test('getter/symbol/prototype/Proxy errors stay fixed without invoking source getters',()=>{
 let invoked=0;const value=hosted();Object.defineProperty(value,'transport',{get(){invoked++;throw Error('raw synthetic getter');}});rejected(()=>sourceBindingSnapshot(value));assert.equal(invoked,0);
 const symbol=hosted();symbol[Symbol('extra')]=true;rejected(()=>sourceBindingSnapshot(symbol));
 const proto=Object.create(hosted());rejected(()=>sourceBindingSnapshot(proto));
 const proxy=new Proxy(hosted(),{ownKeys(){throw Error('RAW_SYNTHETIC_PROXY_ERROR');}});
 assert.throws(()=>sourceBindingSnapshot(proxy),e=>e instanceof SourceBindingError&&e.code==='CAPTURE_SOURCE_BINDING_UNKNOWN'&&!e.message.includes('RAW'));
});
test('operational collector denies matching duck fields before beginCapture/query',async()=>{
 const b=duck();b.targetBinding=hosted().target;b.transport=hosted().transport;b.source_binding=hosted();await frontDoorRejects(b);
});
test('forged prototype and copied local clone manifest give no operational authority',async()=>{
 const proto={targetBinding:hosted().target,transport:hosted().transport};const b=Object.assign(Object.create(proto),duck());b.clone_manifest=local();await frontDoorRejects(b);
});
test('no operational caller parameter can supply a replacement source reader or attestation',async()=>{
 const b=duck();await assert.rejects(collectSnapshot(b,{...options(),sourceBindingForCollector:()=>hosted()}),e=>e.code==='CAPTURE_TRUSTED_SOURCE_REQUIRED');assert.equal(b.calls.begin,0);
});
test('operational options are snapshotted before owner-module await',async()=>{
 const b=duck(),o=options(),pending=collectSnapshot(b,o);o.source_sha='invalid-after-await';o.migration_files[0].sha256='invalid-after-await';
 await assert.rejects(pending,e=>['CAPTURE_SOURCE_OWNER_UNAVAILABLE','CAPTURE_SOURCE_BINDING_UNAVAILABLE'].includes(e.code));assert.equal(b.calls.begin,0);
});
test('unknown source scope is neither a hosted nor an owned-clone binding',()=>{const r=hosted();r.source_scope='CALLER_ASSERTED_STAGING';rejected(()=>sourceBindingSnapshot(r));});
