import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
import {INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT,createInitialMigrationManifest,
  initialMigrationBody,initialSQLStatements,validateInitialHistory,initialMigrationSQL,
  initialMigrationErrorCode,INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL}
  from '../scripts/staging-initial-migrations.mjs';

const sourceSha='a'.repeat(40),otherSha='b'.repeat(40);
const sources=await Promise.all(IMMUTABLE16.map(async entry=>({file:entry.file,
  bytes:await readFile(new URL('../supabase/migrations/'+entry.file,import.meta.url))})));
const manifest=createInitialMigrationManifest(sourceSha,sources);
const context={actor:'contract-test',workflowRunId:'123',expectedBackendPid:321,
  expectedBackendStart:'2026-10-08 12:30:01.123456+00'};
const code=expected=>error=>error?.code===expected;
const hash=value=>createHash('sha256').update(value).digest('hex');
function prefixState(count){
  return {
    layout:{schemas:count?['app','api','internal']:[],app_objects:count?144:0},
    historyRows:manifest.migrations.slice(0,count).map(migration=>({version:migration.version,name:migration.name,
      statement_count:1,single_statement_sha256:migration.sha256})),
    sourceRows:manifest.migrations.slice(0,count).map((migration,index)=>({version:migration.version,file:migration.file,
      sha256:migration.sha256,source_sha:otherSha,actor:'previous-test',scope:'staging',expected_version:index,
      idempotency_key:'cluvo-staging-initial16:100:'+migration.version,workflow_run_id:'100'})),
  };
}
function archivedSource(transaction){
  const insertion=transaction.indexOf('INSERT INTO supabase_migrations.schema_migrations');
  let index=transaction.indexOf("ARRAY['",insertion)+7;
  assert.ok(index>insertion);
  let decoded='';
  while(index<transaction.length){
    if(transaction[index]==="'"){
      if(transaction[index+1]==="'"){decoded+="'";index+=2;continue;}
      return decoded;
    }
    decoded+=transaction[index++];
  }
  assert.fail('unterminated archive SQL literal');
}

test('all original16 source hashes remain exact; outer transactions are removed only from execution bodies',()=>{
  assert.equal(manifest.migrations.length,16);
  const expectedStatements=[223,201,319,63,221,26,38,32,26,15,44,14,14,29,15,42];
  for(const [index,migration]of manifest.migrations.entries()){
    assert.equal(hash(migration.sql),IMMUTABLE16[index].sha256);
    assert.equal(initialSQLStatements(migration.body).length,expectedStatements[index]);
    assert.ok(Object.isFrozen(migration));
    assert.equal(initialSQLStatements(migration.body).some(statement=>['BEGIN','COMMIT'].includes(statement.words[0])),false);
  }
  assert.equal(manifest.migrations.reduce((count,migration)=>count+initialSQLStatements(migration.body)
    .filter(statement=>statement.words.includes('<atomic-body>')).length,0),4);
  assert.ok(Object.isFrozen(manifest)&&Object.isFrozen(manifest.migrations));
});

test('source manifest refuses missing/reordered/modified files and copies caller buffers',()=>{
  assert.throws(()=>createInitialMigrationManifest(sourceSha,sources.slice(0,15)),code('INITIAL_SOURCE_FILES_INVALID'));
  assert.throws(()=>createInitialMigrationManifest(sourceSha,[sources[1],sources[0],...sources.slice(2)]),code('INITIAL_SOURCE_BYTES_CHANGED'));
  const changed=sources.map(source=>({...source,bytes:Buffer.from(source.bytes)}));
  changed[0].bytes[20]^=1;
  assert.throws(()=>createInitialMigrationManifest(sourceSha,changed),code('INITIAL_SOURCE_BYTES_CHANGED'));
  const originalCopy=sources.map(source=>({...source,bytes:Buffer.from(source.bytes)}));
  const independent=createInitialMigrationManifest(sourceSha,originalCopy);
  originalCopy[0].bytes.fill(0);
  assert.equal(hash(independent.migrations[0].sql),IMMUTABLE16[0].sha256);
});

test('scanner retains SQL function atomic bodies, nested cases, dollar strings and escaped strings',()=>{
  const sql="begin;create function f() returns int language sql begin atomic select case when true then case when false then 1 end else 2 end; select 'END;COMMIT;'; select $$END;$$; end;commit;";
  const body=initialMigrationBody(sql);
  assert.equal(initialSQLStatements(body).length,1);
  assert.ok(body.includes('begin atomic'));
  assert.ok(body.endsWith('end;'));
  assert.equal(initialSQLStatements(initialMigrationBody("do $x$ begin raise notice 'COMMIT'; end $x$;")).length,1);
  assert.equal(initialSQLStatements(initialMigrationBody("select E'escaped\\\'quote;'; /* nested /* ; */ */ select 2;")).length,2);
});

test('top-level transaction injection, psql controls and non-atomic operations are rejected',()=>{
  for(const sql of ['begin;select 1;','select 1;commit;','begin;select 1;rollback;commit;',
    'create function f() returns int language sql begin atomic select 1; end;commit;',
    "select 1;prepare transaction 'test';",'select 1;\\i private.sql',
    'create index concurrently test on app.example(id);','vacuum;',
    'create database test;','create tablespace test;','alter system set test=1;',
    'copy app.example from stdin;',"copy app.example from program 'command';"]){
    assert.throws(()=>initialMigrationBody(sql));
  }
});

test('unterminated or empty SQL fails closed',()=>{
  for(const sql of ['', '/* comment */',"select 'unclosed",'/* nested /* comment */',
    'create function f() returns int language sql begin atomic select 1;',
    'select 1', 'begin;commit;'])assert.throws(()=>initialMigrationBody(sql));
});

test('empty, resumed and complete prefixes select the exact pending immutable suffix',()=>{
  for(let count=0;count<=16;count++){
    const result=validateInitialHistory(manifest,prefixState(count));
    assert.equal(result.appliedPrefix,count);
    assert.deepEqual(result.pending.map(entry=>entry.file),IMMUTABLE16.slice(count).map(entry=>entry.file));
    assert.equal(result.complete,count===16);
    assert.equal(result.executionProved,false);
    assert.equal(result.v1Ready,false);
    assert.equal(result.productionEnabled,false);
  }
});

test('untracked app schemas and incomplete layout cannot authorize an initial or resumed plan',()=>{
  for(const layout of [{schemas:['app'],app_objects:0},{schemas:[],app_objects:1},
    {schemas:['app','api','internal'],app_objects:-1},{schemas:['production'],app_objects:0}]){
    assert.throws(()=>validateInitialHistory(manifest,{...prefixState(0),layout}));
  }
  assert.throws(()=>validateInitialHistory(manifest,{...prefixState(1),layout:{schemas:['app'],app_objects:144}}));
});

test('diverged, duplicated, missing or rehashed history is refused before SQL generation',()=>{
  for(const mutation of [state=>state.historyRows.reverse(),state=>state.historyRows.push(state.historyRows[0]),
    state=>{state.historyRows[0].name='other';},state=>{state.historyRows[0].statement_count=2;},
    state=>{state.historyRows[0].single_statement_sha256='0'.repeat(64);},
    state=>{state.historyRows[0].version='20990101000000';},state=>state.sourceRows.pop()]){
    const state=prefixState(2);mutation(state);assert.throws(()=>validateInitialHistory(manifest,state));
  }
});

test('source audit requires exact hashes, actor, staging scope, expected version and idempotency binding',()=>{
  for(const change of [{file:'other.sql'},{sha256:'0'.repeat(64)},{source_sha:'invalid'},
    {actor:"private';select 1;"},{scope:'production'},{expected_version:1},
    {idempotency_key:'unrelated-run'},{workflow_run_id:'0'}]){
    const state=prefixState(1);Object.assign(state.sourceRows[0],change);
    assert.throws(()=>validateInitialHistory(manifest,state),code('INITIAL_SOURCE_HISTORY_INVALID'));
  }
});

test('each generated transaction archives the full original source bytes and encloses body+history+audit',()=>{
  for(let index=0;index<16;index++){
    const transaction=initialMigrationSQL(manifest,index,context),statements=initialSQLStatements(transaction);
    assert.equal(statements[0].words.join(' '),'BEGIN READ WRITE');
    assert.equal(statements.at(-1).words.join(' '),'COMMIT');
    assert.equal(statements.filter(statement=>statement.words[0]==='COMMIT').length,1);
    assert.equal(hash(archivedSource(transaction)),IMMUTABLE16[index].sha256);
    assert.equal(archivedSource(transaction),manifest.migrations[index].sql);
    assert.ok(transaction.includes(manifest.migrations[index].body));
    assert.ok(transaction.indexOf('INITIAL_SESSION_OR_LOCK_CHANGED')<transaction.indexOf('CREATE SCHEMA'));
    assert.ok(transaction.indexOf('INITIAL_HISTORY_CHANGED')<transaction.indexOf(manifest.migrations[index].body));
    assert.ok(transaction.indexOf(manifest.migrations[index].body)<transaction.indexOf('INSERT INTO supabase_migrations.schema_migrations'));
    assert.ok(transaction.includes('INSERT INTO supabase_migrations.cluvo_migration_source'));
    assert.ok(transaction.includes(`'staging',${index},'cluvo-staging-initial16:123:${manifest.migrations[index].version}'`));
  }
});

test('generated SQL binds the physical backend, exclusive shared project lock and primary postgres target',()=>{
  const transaction=initialMigrationSQL(manifest,0,context);
  assert.ok(transaction.includes('pg_backend_pid()<>321'));
  assert.ok(transaction.includes("'2026-10-08 12:30:01.123456+00'::timestamptz"));
  assert.ok(transaction.includes("mode='ExclusiveLock'"));
  assert.ok(transaction.includes(`classid=${INITIAL_MIGRATION_POLICY.lockNamespace}::oid`));
  assert.ok(transaction.includes(`objid=${INITIAL_MIGRATION_LOCK_OBJECT>>>0}::oid`));
  assert.ok(transaction.includes('objsubid=2'));
  assert.ok(transaction.includes("current_user<>'postgres'"));
  assert.ok(transaction.includes('pg_is_in_recovery()'));
  assert.ok(transaction.includes('SET LOCAL row_security=off;'));
  assert.ok(transaction.includes('INITIAL_UNTRACKED_APPLICATION_STATE'));
});

test('SQL generation refuses foreign source bytes, overridden array methods and context injection',()=>{
  const changed={...manifest,migrations:manifest.migrations.map(entry=>({...entry}))};
  changed.migrations[0].body='delete from auth.users;';
  assert.throws(()=>initialMigrationSQL(changed,0,context),code('INITIAL_SOURCE_BYTES_CHANGED'));
  const overridden={...manifest,migrations:[...manifest.migrations]};
  overridden.migrations.map=()=>changed.migrations;
  assert.equal(initialMigrationSQL(overridden,0,context),initialMigrationSQL(manifest,0,context));
  for(const change of [{actor:"actor';select 1;"},{workflowRunId:'123;commit;'},
    {expectedBackendPid:-1},{expectedBackendStart:"2026-10-08';commit;"}]){
    assert.throws(()=>initialMigrationSQL(manifest,0,{...context,...change}),code('INITIAL_CONTEXT_INVALID'));
  }
  for(const index of [-1,16,0.5,'0'])assert.throws(()=>initialMigrationSQL(manifest,index,context),code('INITIAL_MIGRATION_INDEX_INVALID'));
});

test('accessor metadata is refused without evaluating private getters and unknown errors are redacted',()=>{
  let read=false;
  const malicious={...context};Object.defineProperty(malicious,'actor',{get(){read=true;throw Error('synthetic-private-error');}});
  assert.throws(()=>initialMigrationSQL(manifest,0,malicious),code('INITIAL_CONTEXT_INVALID'));
  assert.equal(read,false);
  const unsafe={...manifest,migrations:[...manifest.migrations]};
  Object.defineProperty(unsafe.migrations,'0',{get(){read=true;throw Error('synthetic-private-error');}});
  assert.throws(()=>initialMigrationSQL(unsafe,0,context),code('INITIAL_MANIFEST_INVALID'));
  assert.equal(read,false);
  assert.equal(initialMigrationErrorCode(Error('synthetic-private-error')),'INITIAL_MIGRATION_UNAVAILABLE');
});

test('fixed readback queries contain no mutation path and stage plans make no execution or V1 claim',()=>{
  for(const query of [INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL]){
    assert.ok(query.startsWith('SELECT '));
    assert.ok(!/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/.test(query));
  }
  assert.equal(INITIAL_MIGRATION_POLICY.productionEnabled,false);
  assert.equal(INITIAL_MIGRATION_POLICY.v1Ready,false);
});
