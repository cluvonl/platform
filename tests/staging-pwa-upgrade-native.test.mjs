import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {UPGRADE_FILES,createUpgradeMigrationManifest,upgradeMigrationSQL,validateUpgradeHistory,UPGRADE_SOURCE_HISTORY_SQL} from '../scripts/staging-pwa-upgrade-migrations.mjs';
import {createInitialMigrationManifest,initialMigrationSQL,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT,INITIAL_LAYOUT_SQL,INITIAL_HISTORY_SQL,INITIAL_SOURCE_HISTORY_SQL} from '../scripts/staging-initial-migrations.mjs';
import {INITIAL_RESTORE_STARTUP} from '../scripts/staging-pwa-upgrade-restore.mjs';
import {IMAGE} from '../scripts/pg17-capture-worker.mjs';
import {runOwnedPwaNativeQa} from './helpers/pwa-owned-native-qa.mjs';

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
test('actual owned PG17: fixed additive envelope commits whole-byte history/audit, rejects drift and rolls failures back',
 {skip:process.env.CLUVO_PWA_UPGRADE_NATIVE_TESTS!=='owned-pg17',timeout:180000},async t=>{
 const socket=process.env.CLUVO_PWA_UPGRADE_DOCKER_SCOPE==='hosted'?'unix:///var/run/docker.sock':'unix:///run/user/1001/docker.sock';
 const name='cluvo-pwa-writer-test-'+randomBytes(12).toString('hex');let created=false;
 const run=(args,input)=>spawnSync('docker',['--host',socket,...args],{input,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},encoding:'utf8',timeout:120000,maxBuffer:12000000});
 const checked=(args,input)=>{const result=run(args,input);assert.equal(result.status,0,'OWNED_PG17_PROCESS_FAILED');return result.stdout;};
 const sql=(text,{role='postgres',expectedFailure=false}={})=>{
  const result=run(['exec','-i',name,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U',role,'-d','postgres'],"SET client_min_messages=warning;\n"+text);
  if(expectedFailure){assert.notEqual(result.status,0);return result.stderr;}
  const state=result.stderr.match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1]??'UNCLASSIFIED';
  const line=result.stderr.match(/:(\d+):\s+ERROR:/)?.[1]??'0';
  assert.equal(result.status,0,`OWNED_PG17_SQL_FAILED_${state}_LINE_${line}`);return result.stdout.trim();
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
  sql(lock+manifest.migrations.slice(16).map((_,index)=>envelope(index+16)).join('\n'));
  const readback={layout:json(INITIAL_LAYOUT_SQL),historyRows:json(INITIAL_HISTORY_SQL),sourceRows:json(INITIAL_SOURCE_HISTORY_SQL),upgradeRows:json(UPGRADE_SOURCE_HISTORY_SQL)};
  assert.equal(validateUpgradeHistory(manifest,readback).complete,true);
  assert.equal(readback.sourceRows.length,16);assert.equal(readback.upgradeRows.length,UPGRADE_FILES.length-16);
  for(const receipt of readback.upgradeRows){assert.equal(receipt.actor,'local-upgrade-test');assert.equal(receipt.workflow_run_id,'123');assert.equal(receipt.source_sha,sourceSha);assert.equal(receipt.backup_artifact_id,'456');}
  assert.match(sql(lock+envelope(16),{expectedFailure:true}),/P0001/);
  assert.equal(json('SELECT count(*) FROM supabase_migrations.schema_migrations;'),UPGRADE_FILES.length);
  const guards=json("SELECT jsonb_build_object('tables',count(*),'forced',count(*) FILTER(WHERE c.relrowsecurity AND c.relforcerowsecurity),'native',count(*) FILTER(WHERE EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='native_session_required'))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r';");
  assert.equal(guards.forced,guards.tables);assert.equal(guards.native,guards.tables);
  assert.ok(guards.tables>144);
  const proof=await runOwnedPwaNativeQa({name,socket,sql,json,lock});t.diagnostic(JSON.stringify(proof));
 }finally{
  if(created){
   const ownership=checked(['inspect',name,'--format','{{index .Config.Labels "cluvo.pwa.writer-test"}}']);
   assert.equal(ownership.trim(),name);checked(['rm','--force','--volumes',name]);
  }
 }
});
