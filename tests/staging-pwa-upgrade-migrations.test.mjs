import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {UPGRADE_FILES,APPROVED_PWA_PREDECESSOR31,createUpgradeMigrationManifest,validateUpgradeHistory,upgradeMigrationSQL,upgradeReceiptLineageSQL} from '../scripts/staging-pwa-upgrade-migrations.mjs';
import {IMMUTABLE16} from '../scripts/staging-migration-files.mjs';
import {initialSQLStatements} from '../scripts/staging-initial-migrations.mjs';
import {renderFixedUpgrade} from '../scripts/staging-pwa-upgrade-sql.mjs';

const sourceSha='a'.repeat(40),hash=value=>createHash('sha256').update(value).digest('hex');
const sources=await Promise.all(UPGRADE_FILES.map(async file=>({file:file.file,bytes:await readFile(new URL('../supabase/migrations/'+file.file,import.meta.url))})));
const manifest=createUpgradeMigrationManifest(sourceSha,sources);
const context={actor:'upgrade-test',workflowRunId:'123',backupArtifactId:'456',backupArtifactSha256:'b'.repeat(64),expectedBackendPid:321,expectedBackendStart:'2026-10-09 12:30:01.123456+00'};
const errorCode=code=>error=>error?.code===code;
function state(prefix){return {
 layout:{schemas:['api','app','internal'],app_objects:144},
 historyRows:manifest.migrations.slice(0,prefix).map(m=>({version:m.version,name:m.name,statement_count:1,single_statement_sha256:m.sha256})),
 sourceRows:manifest.migrations.slice(0,16).map((m,index)=>({version:m.version,file:m.file,sha256:m.sha256,source_sha:'c'.repeat(40),actor:'prior-run',scope:'staging',expected_version:index,idempotency_key:'cluvo-staging-initial16:1:'+m.version,workflow_run_id:'1'})),
 upgradeRows:manifest.migrations.slice(16,prefix).map((m,index)=>({version:m.version,file:m.file,sha256:m.sha256,source_sha:'d'.repeat(40),actor:'prior-upgrade',scope:'staging',expected_version:index+16,idempotency_key:'cluvo-staging-pwa-upgrade:2:'+m.version,workflow_run_id:'2',manifest_sha256:manifest.sha256,backup_artifact_id:'3',backup_artifact_sha256:'e'.repeat(64)})),
};}
function archivedSource(sql){
 const insertion=sql.indexOf('INSERT INTO supabase_migrations.schema_migrations');
 let index=sql.indexOf("ARRAY['",insertion)+7,decoded='';
 assert.ok(index>insertion);
 while(index<sql.length){
  if(sql[index]==="'"){if(sql[index+1]==="'"){decoded+="'";index+=2;continue;}return decoded;}
  decoded+=sql[index++];
 }
 assert.fail('unterminated source literal');
}

test('closed PWA source manifest retains exact original16 and detects any suffix byte/order change',()=>{
 assert.deepEqual(UPGRADE_FILES.slice(0,16),IMMUTABLE16);
 assert.equal(hash(JSON.stringify(UPGRADE_FILES.slice(0,32))),'e1087c300882adcf8be7a5087507c824a7cfd10bd5f66133646315dba7d10c42');
 assert.equal(manifest.migrations.length,UPGRADE_FILES.length);
 for(let index=0;index<UPGRADE_FILES.length;index++)assert.equal(hash(manifest.migrations[index].sql),UPGRADE_FILES[index].sha256);
 for(const index of [0,16,UPGRADE_FILES.length-1]){
  const changed=sources.map(source=>({...source,bytes:Buffer.from(source.bytes)}));changed[index].bytes[20]^=1;
  assert.throws(()=>createUpgradeMigrationManifest(sourceSha,changed));
 }
 assert.throws(()=>createUpgradeMigrationManifest(sourceSha,sources.slice(0,-1)));
 assert.throws(()=>createUpgradeMigrationManifest(sourceSha,[...sources.slice(0,16),sources[17],sources[16],...sources.slice(18)]));
});

test('known receipts resume exactly after original16 without executing already committed migrations',()=>{
 for(let prefix=16;prefix<=UPGRADE_FILES.length;prefix++){
  const history=validateUpgradeHistory(manifest,state(prefix));
  assert.equal(history.appliedPrefix,prefix);
  assert.deepEqual(history.pending.map(m=>m.file),UPGRADE_FILES.slice(prefix).map(m=>m.file));
  assert.equal(history.complete,prefix===UPGRADE_FILES.length);
  assert.equal(history.productionEnabled,false);
 }
 const incomplete=state(16);incomplete.historyRows.pop();assert.throws(()=>validateUpgradeHistory(manifest,incomplete));
});

function predecessorState(prefix=31){
 const value=state(prefix),approved=APPROVED_PWA_PREDECESSOR31;
 for(const row of value.upgradeRows.slice(0,15))Object.assign(row,{manifest_sha256:approved.manifestSha256,source_sha:approved.sourceSha,
  workflow_run_id:approved.workflowRunId,idempotency_key:'cluvo-staging-pwa-upgrade:'+approved.workflowRunId+':'+row.version,
  backup_artifact_id:approved.backupArtifactId,backup_artifact_sha256:approved.backupArtifactSha256});
 return value;
}
test('only the complete approved hosted31 predecessor can resume35 without rewriting previous receipts',()=>{
 assert.equal(UPGRADE_FILES.length,35);
 const prior=predecessorState(),before=JSON.stringify(prior);
 const remaining=validateUpgradeHistory(manifest,prior);
 assert.equal(remaining.appliedPrefix,31);assert.equal(remaining.pending.length,4);
 assert.equal(JSON.stringify(prior),before);
 assert.equal(validateUpgradeHistory(manifest,predecessorState(32)).pending.length,3);
 assert.equal(validateUpgradeHistory(manifest,predecessorState(33)).pending.length,2);
 assert.equal(validateUpgradeHistory(manifest,predecessorState(35)).complete,true);
 const negative=[s=>{s.historyRows.pop();s.upgradeRows.pop();},s=>{s.upgradeRows[0]=state(31).upgradeRows[0];},
  s=>{s.upgradeRows[0].source_sha='e'.repeat(40);},s=>{s.upgradeRows[0].workflow_run_id='987';},
  s=>{s.upgradeRows[0].backup_artifact_id='999';},s=>{s.upgradeRows[0].backup_artifact_sha256='e'.repeat(64);},
  s=>{s.upgradeRows[0].manifest_sha256='f'.repeat(64);},s=>{s.upgradeRows[0].idempotency_key='foreign';},
  s=>{s.historyRows[30].single_statement_sha256='0'.repeat(64);}];
 for(const mutate of negative){const value=predecessorState();mutate(value);assert.throws(()=>validateUpgradeHistory(manifest,value));}
 for(const index of [31,32,33,34]){
  const wrongLatest=predecessorState(index+1);
  Object.assign(wrongLatest.upgradeRows[index-16],wrongLatest.upgradeRows[14],{version:manifest.migrations[index].version,file:manifest.migrations[index].file,sha256:manifest.migrations[index].sha256,expected_version:index});
  assert.throws(()=>validateUpgradeHistory(manifest,wrongLatest));
 }
 const unapproved32=predecessorState(32);unapproved32.upgradeRows[15].manifest_sha256='e1087c300882adcf8be7a5087507c824a7cfd10bd5f66133646315dba7d10c42';
 assert.throws(()=>validateUpgradeHistory(manifest,unapproved32));
 const unapproved33=predecessorState(33);unapproved33.upgradeRows[15].manifest_sha256='3153f4cffbf47c1c8d0821e0fa80c4bc5146964a188a4ee21a71c3e1de6b1090';
 assert.throws(()=>validateUpgradeHistory(manifest,unapproved33));
});
test('writer and native gates use the same bounded predecessor lineage and reject arbitrary SQL expressions',()=>{
 const sql=upgradeReceiptLineageSQL(manifest.sha256,31);
 for(const value of Object.values(APPROVED_PWA_PREDECESSOR31).filter(value=>typeof value==='string'))assert.ok(sql.rowInvalidSql.includes(value));
 assert.match(sql.aggregateInvalidSql,/<>15/);assert.match(sql.rowInvalidSql,/BETWEEN 16 AND 30/);
 assert.throws(()=>upgradeReceiptLineageSQL(manifest.sha256,30,'e.position;COMMIT;'));
 assert.throws(()=>upgradeReceiptLineageSQL('not-a-hash',31));
 assert.throws(()=>upgradeReceiptLineageSQL(manifest.sha256,36));
});

test('unknown, missing, duplicated and modified full-byte history or receipts fail closed',()=>{
 const changes=[s=>s.sourceRows.pop(),s=>s.upgradeRows.pop(),s=>s.upgradeRows.push(s.upgradeRows[0]),s=>s.historyRows.reverse(),
  s=>s.historyRows.push({...s.historyRows.at(-1),version:'20990101000000'}),s=>{s.historyRows[0].single_statement_sha256='0'.repeat(64);},
  s=>{s.historyRows[16].statement_count=2;},s=>{s.historyRows[16].name='unknown';}];
 for(const change of changes){const value=state(UPGRADE_FILES.length);change(value);assert.throws(()=>validateUpgradeHistory(manifest,value));}
});

test('suffix audit requires staging actor/run, exact global index, manifest and encrypted custody identity',()=>{
 for(const change of [{scope:'production'},{source_sha:'invalid'},{actor:'unsafe actor'},{workflow_run_id:'0'},
  {expected_version:0},{idempotency_key:'foreign'},{manifest_sha256:'f'.repeat(64)},
  {backup_artifact_id:'0'},{backup_artifact_sha256:'invalid'},{file:'foreign.sql'},{sha256:'0'.repeat(64)}]){
  const value=state(17);Object.assign(value.upgradeRows[0],change);
  assert.throws(()=>validateUpgradeHistory(manifest,value),errorCode('PWA_UPGRADE_RECEIPT_CHANGED'));
 }
});

test('actual generated envelopes contain one transaction and archive complete unchanged SQL bytes',()=>{
 for(let index=16;index<UPGRADE_FILES.length;index++){
  const sql=upgradeMigrationSQL(manifest,index,context),statements=initialSQLStatements(sql);
  assert.equal(statements[0].words.join(' '),'BEGIN READ WRITE');assert.equal(statements.at(-1).words.join(' '),'COMMIT');
  assert.equal(statements.filter(s=>s.words[0]==='COMMIT').length,1);
  assert.equal(archivedSource(sql),manifest.migrations[index].sql);
  assert.ok(sql.indexOf('PWA_UPGRADE_SESSION_OR_LOCK_CHANGED')<sql.indexOf(manifest.migrations[index].body));
  assert.ok(sql.indexOf('PWA_UPGRADE_HISTORY_CHANGED')<sql.indexOf(manifest.migrations[index].body));
  assert.ok(sql.indexOf(manifest.migrations[index].body)<sql.indexOf('INSERT INTO supabase_migrations.schema_migrations'));
  assert.ok(!sql.includes('ALTER TABLE supabase_migrations.cluvo_migration_source'));
 }
});

test('generator rejects unknown index, foreign manifest, injected context and accessor objects before rendering',async()=>{
 for(const index of [-1,0,15,UPGRADE_FILES.length,16.5,'16'])assert.throws(()=>upgradeMigrationSQL(manifest,index,context));
 for(const change of [{actor:"actor';commit;"},{workflowRunId:'123;commit;'},
  {backupArtifactId:'../1'},{backupArtifactSha256:'unknown'},{expectedBackendPid:0},{expectedBackendStart:"2026-10-09';commit;"}])assert.throws(()=>upgradeMigrationSQL(manifest,16,{...context,...change}));
 let accessed=false;const getter={...context};Object.defineProperty(getter,'actor',{get(){accessed=true;throw Error('private');}});
 assert.throws(()=>upgradeMigrationSQL(manifest,16,getter));assert.equal(accessed,false);
 const changed={...manifest,migrations:manifest.migrations.map(m=>({...m}))};changed.migrations[16].body='DELETE FROM auth.users;';
 assert.throws(()=>upgradeMigrationSQL(changed,16,context));
 const overridden={...manifest,migrations:[...manifest.migrations]};overridden.migrations.map=()=>changed.migrations;
 assert.equal(upgradeMigrationSQL(overridden,16,context),upgradeMigrationSQL(manifest,16,context));
 const request={...context,index:16,sourceSha,manifestSha256:manifest.sha256};
 assert.equal(await renderFixedUpgrade(request),upgradeMigrationSQL(manifest,16,context));
 await assert.rejects(renderFixedUpgrade({...request,manifestSha256:'f'.repeat(64)}));
 await assert.rejects(renderFixedUpgrade({...request,sql:'DELETE FROM auth.users'}));
});

test('private generator CLI never prints invalid requests, secrets, diagnostics or arbitrary SQL',()=>{
 for(const input of [{actor:'synthetic-private'},null,{...context,index:0,sourceSha,manifestSha256:manifest.sha256},
  {...context,index:16,sourceSha,manifestSha256:'f'.repeat(64)}]){
  const result=spawnSync(process.execPath,['scripts/staging-pwa-upgrade-sql.mjs','--private-fixed-pwa-upgrade-sql'],{input:JSON.stringify(input),encoding:'utf8',env:{PATH:'/usr/bin:/bin',UNRELATED_SECRET:'synthetic-private'},timeout:15000});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
 }
});
