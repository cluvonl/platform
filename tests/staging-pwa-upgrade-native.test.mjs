import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {UPGRADE_FILES,APPROVED_PWA_PREDECESSOR31,APPROVED_PWA_PREDECESSOR35,createUpgradeMigrationManifest,upgradeMigrationSQL,validateUpgradeHistory,UPGRADE_SOURCE_HISTORY_SQL} from '../scripts/staging-pwa-upgrade-migrations.mjs';
import {createInitialMigrationManifest,initialMigrationSQL,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT,INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL} from '../scripts/staging-initial-migrations.mjs';
import {INITIAL_RESTORE_STARTUP,PWA_RESTORE_SUFFIX_LAYOUT_SQL} from '../scripts/staging-pwa-upgrade-restore.mjs';
import {IMAGE} from '../scripts/pg17-capture-worker.mjs';
import {runOwnedPwaNativeQa} from './helpers/pwa-owned-native-qa.mjs';
import {runOwnedSportlinkAuthority} from './helpers/pwa-owned-sportlink-authority.mjs';
import {loadClosed31Upgrade,loadClosed35Upgrade} from './helpers/pwa-closed31-upgrade.mjs';

const literal=value=>"'"+value.replaceAll("'","''")+"'";
const sourceSha='a'.repeat(40),sentinel='2000-01-01T00:00:00Z';
const context={actor:'local-upgrade-test',workflowRunId:'123',expectedBackendPid:1,expectedBackendStart:sentinel,backupArtifactId:'456',backupArtifactSha256:'b'.repeat(64)};
function localBackend(sql){
 assert.ok(sql.includes('OR pg_backend_pid()<>1\n'));assert.ok(sql.includes(literal(sentinel)+'::timestamptz'));
 return sql.replace('OR pg_backend_pid()<>1\n','OR pg_backend_pid()<>pg_backend_pid()\n')
  .replace(literal(sentinel)+'::timestamptz','(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid())');
}

// This is an explicitly selected disposable PostgreSQL17 fixture. Its minimal
// auth tables permit actual canonical migration SQL; it proves neither hosted
// provider restoration nor real auth/login/mail delivery.
for(const lineage of ['fresh16','approved31','known35'])test(`actual owned PG17 ${lineage}: fixed additive envelope preserves whole-byte history/audit and rejects drift`,
 {skip:process.env.CLUVO_PWA_UPGRADE_NATIVE_TESTS!=='owned-pg17',timeout:180000},async t=>{
 const socket=process.env.CLUVO_PWA_UPGRADE_DOCKER_SCOPE==='hosted'?'unix:///var/run/docker.sock':'unix:///run/user/1001/docker.sock';
 const name='cluvo-pwa-writer-test-'+randomBytes(12).toString('hex');let created=false;
 const run=(args,input)=>spawnSync('docker',['--host',socket,...args],{input,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},encoding:'utf8',timeout:120000,maxBuffer:12000000});
 const checked=(args,input)=>{const result=run(args,input);assert.equal(result.status,0,'OWNED_PG17_PROCESS_FAILED');return result.stdout;};
 const sql=(text,{role='postgres',expectedFailure=false}={})=>{
  const result=run(['exec','-i',name,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=verbose','-h','/restore','-U',role,'-d','postgres'],"SET client_min_messages=warning;\n"+text);
  if(expectedFailure){assert.notEqual(result.status,0);return result.stderr;}
  const state=result.stderr.match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1]??'UNCLASSIFIED';
  const line=result.stderr.match(/:(\d+):\s+ERROR:/)?.[1]??'0';
  const permission=result.stderr.match(/permission denied for (?:schema|table|function) ([a-z_][a-z_0-9]*)/)?.[1]??'';
  const lastTap=result.stdout.split('\n').filter(line=>/^(?:not )?ok [0-9]+ - /.test(line)).at(-1)??'';
  const contextFunction=result.stderr.match(/PL\/pgSQL function ([a-z_][a-z_0-9.]*)\(/)?.[1]??'';
  assert.equal(result.status,0,`OWNED_PG17_SQL_FAILED_${state}_LINE_${line}${permission?'_PERMISSION_'+permission:''}${contextFunction?'_FUNCTION_'+contextFunction:''}${lastTap?'_LAST_ASSERTION_'+lastTap:''}`);return result.stdout.trim();
 };
 const json=text=>JSON.parse(sql(text));
 const lock=`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});\n`;
 try{
  checked(['image','inspect',IMAGE]);
  checked(['create','--name',name,'--label','cluvo.pwa.writer-test='+name,'--network=none','--user=postgres','--log-driver=none','--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint','/bin/sh',IMAGE,'-c',INITIAL_RESTORE_STARTUP,'cluvo-pwa-writer-test','supabase_admin']);created=true;
  checked(['start',name]);
  let ready=false;
  for(let attempt=0;attempt<50;attempt++){
   if(run(['exec',name,'pg_isready','-h','/restore','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(ready,true,'OWNED_PG17_READY_REQUIRED');
  sql(`CREATE ROLE postgres LOGIN CREATEDB CREATEROLE BYPASSRLS;
CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE ROLE authenticator NOLOGIN;
ALTER DATABASE postgres OWNER TO postgres;
CREATE SCHEMA auth AUTHORIZATION postgres;
CREATE SCHEMA extensions AUTHORIZATION postgres;
SET ROLE postgres;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),not_after timestamptz);
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
RESET ROLE;`,{role:'supabase_admin'});
  assert.deepEqual(json("SELECT jsonb_build_object('role',current_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'bypass',(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user));"),{role:'postgres',superuser:false,bypass:true});
  const sources=await Promise.all(UPGRADE_FILES.map(async file=>({file:file.file,bytes:await readFile(new URL('../supabase/migrations/'+file.file,import.meta.url))})));
  const initial=createInitialMigrationManifest(sourceSha,sources.slice(0,16));
  sql(lock+initial.migrations.map((_,index)=>localBackend(initialMigrationSQL(initial,index,context))).join('\n'));
  assert.equal(json('SELECT count(*) FROM supabase_migrations.schema_migrations;'),16);
  const rawSuffixLayout="SELECT to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NOT NULL;";
  const beforeSuffix=sql(rawSuffixLayout);
  assert.equal(beforeSuffix,'f');assert.throws(()=>JSON.parse(beforeSuffix),SyntaxError);
  assert.equal(json(PWA_RESTORE_SUFFIX_LAYOUT_SQL),false);
  const manifest=createUpgradeMigrationManifest(sourceSha,sources);
  const envelope=index=>localBackend(upgradeMigrationSQL(manifest,index,context));
  assert.match(sql(envelope(16),{expectedFailure:true}),/P0001/);
  assert.equal(json("SELECT to_jsonb(to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NULL);"),true);
  const first=initial.migrations[0];
  sql("UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['modified']::text[] WHERE version="+literal(first.version)+';');
  assert.match(sql(lock+envelope(16),{expectedFailure:true}),/P0001/);
  assert.equal(json('SELECT count(*) FROM supabase_migrations.schema_migrations;'),16);
  sql('UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['+literal(first.sql)+']::text[] WHERE version='+literal(first.version)+';');
  sql('CREATE TABLE app.pwa_instruction_versions(id uuid);');
  assert.match(sql(lock+envelope(16),{expectedFailure:true}),/42P07/);
  assert.equal(json("SELECT to_jsonb(to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NULL);"),true);
  assert.equal(json("SELECT count(*) FROM app.help_topics WHERE topic_id LIKE 'pwa.%';"),0);
  sql('DROP TABLE app.pwa_instruction_versions;');
  let predecessorProof=null;
  if(lineage!=='fresh16'){
   assert.equal(manifest.migrations.length,36);
   const closed=await loadClosed31Upgrade(),approved=APPROVED_PWA_PREDECESSOR31;
   const previous=closed.createUpgradeMigrationManifest(approved.sourceSha,sources.slice(0,31));
   assert.equal(previous.sha256,approved.manifestSha256);assert.equal(previous.migrations.length,31);
   const previousContext={...context,workflowRunId:approved.workflowRunId,backupArtifactId:approved.backupArtifactId,backupArtifactSha256:approved.backupArtifactSha256};
   sql(lock+previous.migrations.slice(16).map((_,index)=>localBackend(closed.upgradeMigrationSQL(previous,index+16,previousContext))).join('\n'));
   const approved31History=json(INITIAL_HISTORY_SQL),approved31Receipts=json(UPGRADE_SOURCE_HISTORY_SQL);
   const previousPrefix=lineage==='known35'?35:31;
   if(lineage==='known35'){
    const closed35=await loadClosed35Upgrade(),approved35=APPROVED_PWA_PREDECESSOR35;
    const old35=closed35.createUpgradeMigrationManifest(approved35.sourceSha,sources.slice(0,35));
    assert.equal(old35.sha256,approved35.manifestSha256);
    const context35={...context,workflowRunId:approved35.workflowRunId,backupArtifactId:approved35.backupArtifactId,backupArtifactSha256:approved35.backupArtifactSha256};
    sql(lock+old35.migrations.slice(31).map((_,index)=>localBackend(closed35.upgradeMigrationSQL(old35,index+31,context35))).join('\n'));
    assert.deepEqual(json(INITIAL_HISTORY_SQL).slice(0,31),approved31History);
    assert.deepEqual(json(UPGRADE_SOURCE_HISTORY_SQL).slice(0,15),approved31Receipts);
   }
   const previousHistory=json(INITIAL_HISTORY_SQL),previousReceipts=json(UPGRADE_SOURCE_HISTORY_SQL),previousInitial=json(INITIAL_SOURCE_HISTORY_SQL);
   const helpDigest=json("SELECT to_jsonb(md5(coalesce(jsonb_agg(to_jsonb(t)ORDER BY topic_id)::text,'')))FROM app.help_topics t;");
   const functionSql="SELECT to_jsonb(md5(coalesce(jsonb_agg(pg_get_functiondef(p.oid)ORDER BY p.oid)::text,'')))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='internal'AND p.proname IN('pwa_command','pwa_snapshot');";
   const functionDigest=json(functionSql);
   const prior={layout:json(INITIAL_LAYOUT_SQL),historyRows:previousHistory,sourceRows:previousInitial,upgradeRows:previousReceipts};
   assert.equal(validateUpgradeHistory(manifest,prior).pending.length,36-previousPrefix);
   const targets=lineage==='known35'?[previousReceipts[0],previousReceipts[15]]:[previousReceipts[0]];
   const badMutations=targets.flatMap(row=>{
    const firstReceipt=literal(row.version);
    return [
     `UPDATE supabase_migrations.cluvo_pwa_upgrade_source SET source_sha='${'e'.repeat(40)}'WHERE version=${firstReceipt};`,
     `UPDATE supabase_migrations.cluvo_pwa_upgrade_source SET workflow_run_id='987',idempotency_key='cluvo-staging-pwa-upgrade:987:'||version WHERE version=${firstReceipt};`,
     `UPDATE supabase_migrations.cluvo_pwa_upgrade_source SET backup_artifact_id='999'WHERE version=${firstReceipt};`,
     `UPDATE supabase_migrations.cluvo_pwa_upgrade_source SET backup_artifact_sha256='${'e'.repeat(64)}'WHERE version=${firstReceipt};`,
     `UPDATE supabase_migrations.cluvo_pwa_upgrade_source SET manifest_sha256='${'e'.repeat(64)}'WHERE version=${firstReceipt};`,
     `UPDATE supabase_migrations.cluvo_pwa_upgrade_source SET manifest_sha256=${literal(manifest.sha256)}WHERE version=${firstReceipt};`,
     `DELETE FROM supabase_migrations.cluvo_pwa_upgrade_source WHERE version=${firstReceipt};`,
     `UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['altered']::text[]WHERE version=${firstReceipt};`,
    ];
   });
   for(const mutation of badMutations){
    // All deliberate fixture corruption rolls back with the rejected envelope.
    assert.match(sql(lock+'BEGIN;'+mutation+envelope(previousPrefix),{expectedFailure:true}),/P0001/);
    assert.deepEqual(json(INITIAL_HISTORY_SQL),previousHistory);assert.deepEqual(json(UPGRADE_SOURCE_HISTORY_SQL),previousReceipts);
    assert.equal(json(functionSql),functionDigest);
   }
   for(let index=previousPrefix;index<36;index++){
    sql(lock+envelope(index));
    const middle={layout:json(INITIAL_LAYOUT_SQL),historyRows:json(INITIAL_HISTORY_SQL),sourceRows:json(INITIAL_SOURCE_HISTORY_SQL),upgradeRows:json(UPGRADE_SOURCE_HISTORY_SQL)};
    assert.equal(middle.historyRows.length,index+1);assert.equal(validateUpgradeHistory(manifest,middle).pending.length,35-index);
   }
   assert.deepEqual(json(INITIAL_HISTORY_SQL).slice(0,previousPrefix),previousHistory);
   assert.deepEqual(json(UPGRADE_SOURCE_HISTORY_SQL).slice(0,previousPrefix-16),previousReceipts);
   assert.deepEqual(json(INITIAL_SOURCE_HISTORY_SQL),previousInitial);
   assert.equal(json("SELECT to_jsonb(md5(coalesce(jsonb_agg(to_jsonb(t)ORDER BY topic_id)::text,'')))FROM app.help_topics t;"),helpDigest);
   predecessorProof={actual_closed31_renderer:true,actual_closed35_renderer:lineage==='known35',previous_migrations:previousPrefix,executed_new_migrations:36-previousPrefix,previous_history_and_receipts_unchanged:true,
    original16_receipts_unchanged:true,help_catalog_data_unchanged:true,actual_tamper_negatives:badMutations.length,approved_predecessor_source_sha:lineage==='known35'?APPROVED_PWA_PREDECESSOR35.sourceSha:approved.sourceSha,
    approved_predecessor_manifest_sha256:lineage==='known35'?APPROVED_PWA_PREDECESSOR35.manifestSha256:approved.manifestSha256};
  }else sql(lock+manifest.migrations.slice(16).map((_,index)=>envelope(index+16)).join('\n'));
  const readback={layout:json(INITIAL_LAYOUT_SQL),historyRows:json(INITIAL_HISTORY_SQL),sourceRows:json(INITIAL_SOURCE_HISTORY_SQL),upgradeRows:json(UPGRADE_SOURCE_HISTORY_SQL)};
  const redeploy=validateUpgradeHistory(manifest,readback);assert.equal(redeploy.complete,true);assert.deepEqual(redeploy.pending,[]);
  const redeployStatements=redeploy.pending.map((_,index)=>envelope(index+redeploy.appliedPrefix));assert.equal(redeployStatements.length,0);
  sql(lock+redeployStatements.join('\n'));
  assert.deepEqual(json(INITIAL_HISTORY_SQL),readback.historyRows);assert.deepEqual(json(UPGRADE_SOURCE_HISTORY_SQL),readback.upgradeRows);
  const afterSuffix=sql(rawSuffixLayout);
  assert.equal(afterSuffix,'t');assert.throws(()=>JSON.parse(afterSuffix),SyntaxError);
  assert.equal(json(PWA_RESTORE_SUFFIX_LAYOUT_SQL),true);
  assert.equal(readback.sourceRows.length,16);assert.equal(readback.upgradeRows.length,UPGRADE_FILES.length-16);
  for(const [index,receipt]of readback.upgradeRows.entries()){
   const previous=lineage!=='fresh16'&&index<15?APPROVED_PWA_PREDECESSOR31:lineage==='known35'&&index<19?APPROVED_PWA_PREDECESSOR35:null;
   assert.equal(receipt.actor,'local-upgrade-test');assert.equal(receipt.workflow_run_id,previous?previous.workflowRunId:'123');
   assert.equal(receipt.source_sha,previous?previous.sourceSha:sourceSha);assert.equal(receipt.backup_artifact_id,previous?previous.backupArtifactId:'456');
   assert.equal(receipt.backup_artifact_sha256,previous?previous.backupArtifactSha256:context.backupArtifactSha256);
  }
  assert.match(sql(lock+envelope(16),{expectedFailure:true}),/P0001/);
  assert.equal(json('SELECT count(*) FROM supabase_migrations.schema_migrations;'),UPGRADE_FILES.length);
  const guards=json("SELECT jsonb_build_object('tables',count(*),'forced',count(*) FILTER(WHERE c.relrowsecurity AND c.relforcerowsecurity),'native',count(*) FILTER(WHERE EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='native_session_required'))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r';");
  assert.equal(guards.forced,guards.tables);assert.equal(guards.native,guards.tables);
  assert.ok(guards.tables>144);
  const proof=await runOwnedPwaNativeQa({name,socket,sql,json,lock});
  // Extend only this owned minimal Auth fixture to run the same transactionally
  // rolled-back native Sportlink privacy/commands suite as the real local CLI.
  sql(`CREATE EXTENSION pgtap WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated;
ALTER TABLE auth.users ADD COLUMN aud text,ADD COLUMN created_at timestamptz,ADD COLUMN updated_at timestamptz;
ALTER TABLE auth.sessions ADD COLUMN created_at timestamptz,ADD COLUMN updated_at timestamptz;`,{role:'supabase_admin'});
  const sportlinkTap=sql(await readFile(new URL('../supabase/tests/pwa016_sportlink_connection.sql',import.meta.url),'utf8'),{role:'supabase_admin'});
  assert.doesNotMatch(sportlinkTap,/^not ok\b/m,'OWNED_SPORTLINK_NATIVE_ASSERTION_FAILED');
  const sportlinkAssertions=sportlinkTap.split('\n').filter(line=>/^ok [0-9]+ - /.test(line)).length;
  assert.ok(sportlinkAssertions>=30,'OWNED_SPORTLINK_NATIVE_ASSERTIONS_MISSING');
  const sportlinkAuthority=await runOwnedSportlinkAuthority({name,socket,sql,json});
  t.diagnostic(JSON.stringify({...proof,lineage,predecessor_upgrade:predecessorProof,actual_native_guard_inventory:guards,actual_migration_count:readback.historyRows.length,actual_suffix_history_typed_json_boolean:true,actual36_redeploy_pending_sql:0,redeploy_history_and_receipts_unchanged:true,sportlink_native_privacy_command_assertions:sportlinkAssertions,sportlink_suite_rolled_back:true,sportlink_native_authority_fence:sportlinkAuthority}));
 }finally{
  if(created){
   const ownership=checked(['inspect',name,'--format','{{index .Config.Labels "cluvo.pwa.writer-test"}}']);
   assert.equal(ownership.trim(),name);checked(['rm','--force','--volumes',name]);
  }
 }
});
