import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,mkdtemp,chmod,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {knownPwaCheckAstReconstruction} from '../scripts/staging-pwa-check-ast-reconstruction.mjs';
test('actual owned approved31 archive: BETWEEN AST and private comment reconstructed, strict28 then only4 migrations', {skip:process.env.CLUVO_PWA_CHECK_AST_NATIVE_TESTS!=='owned-pg17',timeout:180000},async t=>{
const repo=fileURLToPath(new URL('../',import.meta.url));
const {IMAGE}=await import(repo+'scripts/pg17-capture-worker.mjs');
const {INITIAL_RESTORE_STARTUP,restoreInitialBackup,PWA_RESTORE_SUFFIX_LAYOUT_SQL}=await import(repo+'scripts/staging-pwa-upgrade-restore.mjs');
const {IMMUTABLE16}=await import(repo+'scripts/staging-migration-files.mjs');
const {PWA_ADDITIONS}=await import(repo+'scripts/staging-pwa-upgrade-files.mjs');
const {createInitialMigrationManifest,initialMigrationSQL,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT}=await import(repo+'scripts/staging-initial-migrations.mjs');
const {CATALOG_QUERIES}=await import(repo+'scripts/staging-capture-catalog.mjs');
const {aggregate,CONFIG_SAFETY_SQL,DATA_RELATIONS_SQL}=await import(repo+'scripts/staging-capture-queries.mjs');
const scope='unix:///run/user/1001/docker.sock',name='cluvo-pwa-owned-archive-source-'+randomBytes(12).toString('hex');
const sourceSha='6029b482c06669aa37806d3aa90f70b59e6ccfd4';
let created=false,privateDirectory=null,publicReport=null,probePhase='image';
const run=(args,input,encoding='utf8')=>spawnSync('/usr/bin/docker',['--host',scope,...args],{input,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'},encoding,timeout:180000,maxBuffer:64*1024*1024});
const checked=(args,input,encoding)=>{const result=run(args,input,encoding);if(result.status!==0){const error=new Error('OWNED_ARCHIVE_PROCESS_FAILED');error.code='OWNED_ARCHIVE_PROCESS_FAILED';error.exitStatus=result.status;throw error;}return result.stdout;};
const sql=(statement,role='supabase_admin')=>checked(['exec','-i',name,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U',role,'-d','postgres'],"SET client_min_messages=warning;\nSET search_path TO pg_catalog;SET extra_float_digits TO 3;SET TimeZone TO 'UTC';\n"+statement).trim();
const json=statement=>JSON.parse(sql(statement));
const ident=value=>'"'+value.replaceAll('"','""')+'"';
try{
 checked(['image','inspect',IMAGE]);
 checked(['create','--pull=never','--name',name,'--label','cluvo.pwa.owned-archive-source='+name,'--network=none','--restart=no','--user=postgres','--log-driver=none','--no-healthcheck','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=1g','--memory-swap=1g','--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint=/bin/sh',IMAGE,'-c',INITIAL_RESTORE_STARTUP,'cluvo-pwa-owned-archive-source','supabase_admin']);
 created=true;checked(['start',name]);
 let ready=false;for(let attempt=0;attempt<100;attempt++){if(run(['exec',name,'pg_isready','-h','/restore','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,100));}assert.equal(ready,true);
 probePhase='source_setup';sql(`CREATE ROLE postgres LOGIN CREATEDB CREATEROLE BYPASSRLS;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE ROLE authenticator NOLOGIN;ALTER DATABASE postgres OWNER TO postgres;CREATE SCHEMA auth AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;SET ROLE postgres;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),not_after timestamptz);ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;RESET ROLE;`);
 probePhase='original16';const sources=await Promise.all([...IMMUTABLE16,...PWA_ADDITIONS].map(async file=>({file:file.file,bytes:await readFile(repo+'supabase/migrations/'+file.file)})));
 const manifest=createInitialMigrationManifest(sourceSha,sources.slice(0,16)),context={actor:'local-owned-archive-proof',workflowRunId:'1',expectedBackendPid:1,expectedBackendStart:'2000-01-01T00:00:00Z'};
 const fixed=index=>initialMigrationSQL(manifest,index,context).replace('OR pg_backend_pid()<>1\n','OR pg_backend_pid()<>pg_backend_pid()\n').replace("'2000-01-01T00:00:00Z'::timestamptz",'(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid())');
 sql(`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});\n`+manifest.migrations.map((_,index)=>fixed(index)).join('\n'),'postgres');
 assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'16');
 assert.equal(sql("SELECT to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NOT NULL;"),'f');
 assert.equal(json(PWA_RESTORE_SUFFIX_LAYOUT_SQL),false);
 probePhase='missing_storage_warning_diagnostic';
 const warningSource=await readFile(repo+'supabase/migrations/20261009102000_pwa_snapshot.sql','utf8');
 const storagePolicyStatement=warningSource.match(/do \$storage\$ begin if to_regclass\('storage\.objects'\)[\s\S]*?end;\$storage\$;/)?.[0];assert.equal(typeof storagePolicyStatement,'string');
 const missingStorage=run(['exec','-i',name,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=verbose','-h','/restore','-U','postgres','-d','postgres'],"SET client_min_messages=warning;\n"+storagePolicyStatement);
 assert.equal(missingStorage.status,0);assert.equal(/WARNING:\s+01000: Supabase Storage relations are absent; PWA registered document Storage policy was not installed in this database-only run/.test(missingStorage.stderr),true);
 console.log(JSON.stringify({scope:'LOCAL_OWNED_ARCHIVE_DIAGNOSTIC',known_source_warning:'PWA_DATABASE_ONLY_STORAGE_ABSENT',sqlstate:'01000',strict_restore_gate_preserved:true}));
 probePhase='owned_storage_setup';sql(`CREATE ROLE supabase_storage_admin NOLOGIN;GRANT supabase_storage_admin TO postgres;CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;SET ROLE supabase_storage_admin;CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL,owner uuid,created_at timestamptz,updated_at timestamptz,last_accessed_at timestamptz,metadata jsonb);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;RESET ROLE;`);
 assert.equal(json('SELECT count(*) FROM storage.objects;'),0);
 probePhase='closed31';
 const {loadClosed31Upgrade}=await import(repo+'tests/helpers/pwa-closed31-upgrade.mjs');
 const {APPROVED_PWA_PREDECESSOR31}=await import(repo+'scripts/staging-pwa-upgrade-migrations.mjs');
 const closed=await loadClosed31Upgrade(),approved=APPROVED_PWA_PREDECESSOR31;
 const previous=closed.createUpgradeMigrationManifest(approved.sourceSha,sources.slice(0,31));
 const closedContext={...context,workflowRunId:approved.workflowRunId,backupArtifactId:approved.backupArtifactId,backupArtifactSha256:approved.backupArtifactSha256};
 const envelope=(statement)=>statement.replace('OR pg_backend_pid()<>1\n','OR pg_backend_pid()<>pg_backend_pid()\n').replace("'2000-01-01T00:00:00Z'::timestamptz",'(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid())');
 sql(`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});`+previous.migrations.slice(16).map((_,i)=>envelope(closed.upgradeMigrationSQL(previous,i+16,closedContext))).join('\n'),'postgres');
 assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'31');
 probePhase='owned_endpoint_fixture';
 sql(`INSERT INTO app.tenants(id,slug,name) VALUES('35a50000-0000-4000-8000-000000000001','owned-check-ast','Owned CHECK AST');
 INSERT INTO app.persons(id,tenant_id,given_name,family_name) VALUES('35a50000-0000-4000-8000-000000000002','35a50000-0000-4000-8000-000000000001','Owned','Check AST');
 INSERT INTO app.pwa_push_subscriptions(id,tenant_id,person_id,endpoint,p256dh,auth_secret) VALUES('35a50000-0000-4000-8000-000000000003','35a50000-0000-4000-8000-000000000001','35a50000-0000-4000-8000-000000000002','https://fcm.googleapis.com/owned-check-ast',repeat('A',80),repeat('B',20));
 COMMENT ON CONSTRAINT pwa_push_subscriptions_endpoint_check ON app.pwa_push_subscriptions IS 'Owned quote '' ; DROP TABLE app.pwa_push_subscriptions; -- preserved literal';`);
 const endpointAST=json("SELECT jsonb_build_object('ast_sha',encode(sha256(convert_to(conbin::text,'UTF8')),'hex'),'definition_sha',encode(sha256(convert_to(pg_get_constraintdef(oid,false),'UTF8')),'hex'),'comment_sha',encode(sha256(convert_to(obj_description(oid,'pg_constraint'),'UTF8')),'hex')) FROM pg_constraint WHERE conrelid='app.pwa_push_subscriptions'::regclass AND conname='pwa_push_subscriptions_endpoint_check';");
 assert.equal(endpointAST.definition_sha,'7c0d72ecafb4ead98076419e9b1b47bbc06885137f3388b76409f0f3a156d72b');
 probePhase='catalog_capture';const catalog=Object.fromEntries(Object.entries(CATALOG_QUERIES).map(([family,query])=>[family,json(aggregate(query))]));
 probePhase='data_capture';const data=json(DATA_RELATIONS_SQL).map(row=>{
  const counted=json("SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM "+(row.kind==='r'?'ONLY ':'')+ident(row.schema)+'.'+ident(row.name)+' t;');
  return {schema:row.schema,relation:row.name,kind:row.kind,...counted};
 });
 probePhase='sequence_capture';const sequences=catalog.sequences.map(row=>({...row,...json('SELECT jsonb_build_object(\'last_value\',last_value::text,\'is_called\',is_called) FROM '+ident(row.schema)+'.'+ident(row.name))}));
 probePhase='capability';const capability=json("SELECT jsonb_build_object('server_version',current_setting('server_version_num')::int,'bootstrap_anchor_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin'),'role_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname='postgres'),'role_bypassrls',(SELECT rolbypassrls FROM pg_roles WHERE rolname='postgres'));"),configuration_safety=json(CONFIG_SAFETY_SQL);
 assert.equal(json('SELECT jsonb_build_object(\'users\',(SELECT count(*) FROM auth.users),\'sessions\',(SELECT count(*) FROM auth.sessions),\'largeobjects\',(SELECT count(*) FROM pg_largeobject_metadata));').users,0);
 const original={format:'cluvo-staging-private-snapshot',schema_version:2,environment:'staging',project_ref:'fbozlbgmktkgcdfqdaaz',logical_capture_metadata_complete:true,source_sha:sourceSha,source_history:{applied_prefix:31,original_source_bytes_proven:true},dataset_inventory:{key_dependent_data:'proven_empty',count_snapshot_consistent:true,storage_objects:0},large_objects:[],catalog,data,sequences,capability,configuration_safety,source_files:[...IMMUTABLE16,...PWA_ADDITIONS]};
 probePhase='archive_dump';privateDirectory=await mkdtemp(join(tmpdir(),'cluvo-pwa-owned-archive-'));await chmod(privateDirectory,0o700);
 probePhase='archive_dump_database';const dump=checked(['exec',name,'pg_dump','--no-password','--format=custom','--quote-all-identifiers','--large-objects','-h','/restore','-U','supabase_admin','-d','postgres'],undefined,null);
 probePhase='archive_dump_globals';const globals=checked(['exec',name,'pg_dumpall','--globals-only','--no-role-passwords','--quote-all-identifiers','--no-password','-h','/restore','-U','supabase_admin']);
 probePhase='archive_write_database';await writeFile(join(privateDirectory,'database.dump'),dump,{mode:0o600});dump.fill(0);
 probePhase='archive_write_globals';await writeFile(join(privateDirectory,'globals.sql'),globals,{mode:0o600});
 const sourceHashes=data.map(({schema,relation,sha256,rows})=>({schema,relation,sha256,rows}));
 probePhase='restore';const {PWA_DEPARSE_CONTEXT_SQL,publicDeparseContext}=await import(repo+'scripts/staging-pwa-restore-diagnostic.mjs');
 let cloneAST,injectData=false,removedClones=0,reconstructionSeen=false;
 const restoredBefore={};
 const actualRun=async(args,input,maximum=8000000,timeout=30000)=>{
  if(args.includes('rm')&&args.includes('--force')){
   const target=args.at(-1),guard=JSON.parse(run(['inspect',target,'--format','{"label":{{json (index .Config.Labels "cluvo.staging.initial-restore")}},"name":{{json .Name}},"id":{{json .Id}}}']).stdout);
   assert.equal(guard.label,guard.name.slice(1));assert.ok([guard.label,guard.id].includes(target));
   const r=run(['exec','-i',target,'psql','-X','-qtA','--no-password','--set=ON_ERROR_STOP=1','-h','/restore','-U','supabase_admin','-d','postgres'],"SET search_path=pg_catalog;SET extra_float_digits=3;SELECT jsonb_build_object('ast_sha',encode(sha256(convert_to(conbin::text,'UTF8')),'hex'),'definition_sha',encode(sha256(convert_to(pg_get_constraintdef(oid,false),'UTF8')),'hex'),'comment_sha',encode(sha256(convert_to(obj_description(oid,'pg_constraint'),'UTF8')),'hex')) FROM pg_constraint WHERE conrelid='app.pwa_push_subscriptions'::regclass AND conname='pwa_push_subscriptions_endpoint_check';");
   assert.equal(r.status,0);assert.equal(r.stderr,'');cloneAST=JSON.parse(r.stdout.trim());
   if(injectData){
    const history=run(['exec','-i',target,'psql','-X','-qtA','--no-password','-h','/restore','-U','supabase_admin','-d','postgres'],'SELECT count(*) FROM supabase_migrations.schema_migrations;');
    assert.equal(history.status,0);assert.equal(history.stdout.trim(),'31');
   }
   removedClones++;
  }
  const r=spawnSync('/usr/bin/docker',args,{input,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8'},encoding:'utf8',timeout,maxBuffer:maximum});
  const text=typeof input==='string'?input:Buffer.isBuffer(input)?input.toString():'';
  if(r.status===0&&args.includes('psql')){
   for(const [family,query]of Object.entries(CATALOG_QUERIES))if(text.includes(aggregate(query))&&!reconstructionSeen)restoredBefore[family]=JSON.parse(r.stdout.trim());
   if(text.includes('DO $cluvo_known_check_ast$'))reconstructionSeen=true;
   if(injectData&&text.includes('DO $cluvo_known_check_ast$')){
    const target=args[args.indexOf('exec')+2];
    const change=run(['exec','-i',target,'psql','-X','-qtA','--no-password','--set=ON_ERROR_STOP=1','-h','/restore','-U','supabase_admin','-d','postgres'],"INSERT INTO app.pwa_push_subscriptions(id,tenant_id,person_id,endpoint,p256dh,auth_secret) VALUES('35a50000-0000-4000-8000-000000000004','35a50000-0000-4000-8000-000000000001','35a50000-0000-4000-8000-000000000002','https://fcm.googleapis.com/owned-check-ast-extra',repeat('A',80),repeat('B',20));");
    assert.equal(change.status,0);assert.equal(change.stderr,'');
   }
  }
  return {status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error};
 };
 const report=await restoreInitialBackup({directory:privateDirectory,original,bootstrapRole:'supabase_admin',sourceDeparseContext:publicDeparseContext(json(PWA_DEPARSE_CONTEXT_SQL))},{run:actualRun});
 assert.deepEqual(cloneAST,endpointAST);assert.equal(report.check_ast_reconstruction.used,true);
 assert.equal(report.check_ast_reconstruction.known_check_comment_preserved_and_rechecked,true);
 assert.equal(Object.keys(restoredBefore).length,28);
 const originalBytes=sources.find(e=>e.file==='20261009100000_pwa_domain.sql').bytes;
 assert.ok(knownPwaCheckAstReconstruction(catalog,restoredBefore,originalBytes));
 const endpointExpression="length(endpoint) between 8 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'";
 const nativeGuards=[];
 for(const [kind,expr,flag]of [['numeric',endpointExpression.replace('2048','2049'),false],['regex',endpointExpression.replace('fcm[.]googleapis[.]com','fcm[.]googleapis[.]com|evil[.]example[.]test'),false],['validated',endpointExpression,true]]){
  const actual=json('BEGIN;ALTER TABLE app.pwa_push_subscriptions DROP CONSTRAINT pwa_push_subscriptions_endpoint_check;ALTER TABLE app.pwa_push_subscriptions ADD CONSTRAINT pwa_push_subscriptions_endpoint_check CHECK('+expr+')'+(flag?' NOT VALID':'')+';'+aggregate(CATALOG_QUERIES.constraints)+';ROLLBACK;');
  assert.equal(knownPwaCheckAstReconstruction(catalog,{...restoredBefore,constraints:actual},originalBytes),null);nativeGuards.push(kind);
 }
 const changedAcl=json('BEGIN;GRANT SELECT ON app.pwa_push_subscriptions TO anon;'+aggregate(CATALOG_QUERIES.relations)+';ROLLBACK;');
 assert.equal(knownPwaCheckAstReconstruction(catalog,{...restoredBefore,relations:changedAcl},originalBytes),null);nativeGuards.push('acl');
 assert.deepEqual(json(aggregate(CATALOG_QUERIES.constraints)),catalog.constraints);assert.deepEqual(json(aggregate(CATALOG_QUERIES.relations)),catalog.relations);
 injectData=true;
 await assert.rejects(restoreInitialBackup({directory:privateDirectory,original,bootstrapRole:'supabase_admin',sourceDeparseContext:publicDeparseContext(json(PWA_DEPARSE_CONTEXT_SQL))},{run:actualRun}),e=>e.code==='RESTORE_PHYSICAL_DATA_MISMATCH'&&e.phase==='data');
 injectData=false;assert.equal(removedClones,2);nativeGuards.push('physical_data_no_upgrade');
 probePhase='restore_result';assert.equal(report.passed,true);assert.equal(report.source_migration_prefix,31);assert.equal(report.final_migration_prefix,35);assert.equal(report.non_superuser_upgrade_migrations,4);assert.equal(report.owned_clone_removed,true);
 probePhase='source_preservation';assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations;'),'31');
 assert.deepEqual(json(aggregate(CATALOG_QUERIES.constraints)),catalog.constraints);
 for(const row of sourceHashes){const count=json("SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM ONLY "+ident(row.schema)+'.'+ident(row.relation)+' t;');assert.equal(count.rows,row.rows);assert.equal(count.sha256,row.sha256);}
 publicReport={scope:'LOCAL_OWNED_PG17_CLOSED31_EXACT_CHECK_AST_RESTORE_TO35',observed_at:new Date().toISOString(),baseline_source_sha:sourceSha,restore_helper_sha256:createHash('sha256').update(await readFile(repo+'scripts/staging-pwa-upgrade-restore.mjs')).digest('hex'),actual_pg_dump:true,actual_pg_dumpall_no_role_passwords:true,source_fixture:'owned-empty-auth-storage-approved31-with-synthetic-endpoint-and-comment',native_shaped_storage_fixture:true,missing_storage_warning_explained:true,strict_restore_warning_refusal_preserved:true,source_fixture_native_users:0,source_fixture_native_sessions:0,actual_full_restore:report,raw_constraint_AST_exact:true,known_constraint_comment_preserved:true,actual_native_negative_guards:nativeGuards,own_negative_fixture_mutations_rolled_back:true,source_data_after_restore_unchanged:true,private_values_exported:false,hosted_backup_downloaded:false,hosted_writes:false,providers_called:false};
}catch(error){console.log(JSON.stringify({scope:'LOCAL_OWNED_PG17_CLOSED31_EXACT_CHECK_AST_RESTORE_TO35',passed:false,code:typeof error?.code==='string'?error.code:'OWNED_ARCHIVE_PROOF_FAILED',phase:typeof error?.phase==='string'?error.phase:probePhase,exit_status:error?.exitStatus??null,sqlstate:error?.sqlstate??null,errorReason:error?.errorReason??null,catalog_mismatches:error?.catalogMismatches??[]}));throw error;
}finally{
 if(privateDirectory)await rm(privateDirectory,{recursive:true,force:true});
 if(created){assert.equal(checked(['inspect',name,'--format','{{index .Config.Labels "cluvo.pwa.owned-archive-source"}}']).trim(),name);checked(['rm','--force','--volumes',name]);}
 if(publicReport){publicReport.source_owned_clone_removed=true;publicReport.private_archive_files_removed=true;if(process.env.CLUVO_PWA_CHECK_AST_EVIDENCE)await writeFile(process.env.CLUVO_PWA_CHECK_AST_EVIDENCE,JSON.stringify(publicReport,null,2)+'\n',{mode:0o600});t.diagnostic(JSON.stringify(publicReport));}
}

});

test('actual owned PG17 null comments, inheritance dependencies and endpoint-bound negatives remain exact', {skip:process.env.CLUVO_PWA_CHECK_AST_NATIVE_TESTS!=='owned-pg17',timeout:90000},async t=>{
const repo=fileURLToPath(new URL('../',import.meta.url));
const {IMAGE}=await import(repo+'scripts/pg17-capture-worker.mjs');
const {INITIAL_RESTORE_STARTUP}=await import(repo+'scripts/staging-pwa-upgrade-restore.mjs');
const {CATALOG_QUERIES}=await import(repo+'scripts/staging-capture-catalog.mjs');
const {aggregate}=await import(repo+'scripts/staging-capture-queries.mjs');
const bytes=await readFile(repo+'supabase/migrations/20261009100000_pwa_domain.sql');
const name='cluvo-pwa35-check-ast-owned-'+randomBytes(12).toString('hex'),socket='unix:///run/user/1001/docker.sock';
const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},key='cluvo.pwa.check-ast-owned';
const sourceHash='7c0d72ecafb4ead98076419e9b1b47bbc06885137f3388b76409f0f3a156d72b',dumpHash='48ba42e6e666c6b5035a70176d12d0163a6a51ac1e2d080f1fb56c51f69ffc12';
const run=(args,input)=>spawnSync('/usr/bin/docker',['--host',socket,...args],{env,input,timeout:120000,maxBuffer:12000000});
const check=(args,input)=>{const r=run(args,input);assert.equal(r.status,0,'OWNED_AST_PROCESS_FAILED');assert.equal(r.stderr.toString(),'');return r.stdout;};
const inspect=()=>{
 const v=JSON.parse(check(['inspect',name,'--format','{"name":{{json .Name}},"label":{{json (index .Config.Labels "cluvo.pwa.check-ast-owned")}},"image":{{json .Config.Image}},"network":{{json .HostConfig.NetworkMode}},"binds":{{json .HostConfig.Binds}},"mounts":{{json .Mounts}},"user":{{json .Config.User}},"privileged":{{json .HostConfig.Privileged}}}']).toString());
 assert.equal(v.name,'/'+name);assert.equal(v.label,name);assert.equal(v.image,IMAGE);assert.equal(v.network,'none');assert.equal(v.user,'postgres');assert.equal(v.privileged,false);assert.ok(!v.binds);assert.ok(v.mounts.every(m=>m.Type==='tmpfs'&&m.Destination==='/restore'));
};
const sql=(db,s,failure=false)=>{
 const r=run(['exec','-i',name,'psql','-X','-qAt','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U','supabase_admin','-d',db],Buffer.from('SET client_min_messages=warning;'+s));
 if(failure){assert.notEqual(r.status,0);return r.stderr.toString();}
 assert.equal(r.status,0,'OWNED_AST_SQL_FAILED');assert.equal(r.stderr.toString(),'');return r.stdout.toString().trim();
};
const catalogs=db=>JSON.parse(sql(db,'SET search_path=pg_catalog;SET extra_float_digits=3;SELECT jsonb_build_object('+Object.entries(CATALOG_QUERIES).map(([family,query])=>"'"+family+"',"+'('+aggregate(query)+')').join(',')+');'));
const snapshot=db=>JSON.parse(sql(db,"SET search_path=pg_catalog;SET extra_float_digits=3;SELECT jsonb_build_object('hash',encode(sha256(convert_to(pg_get_constraintdef(t.oid,false),'UTF8')),'hex'),'definition',pg_get_constraintdef(t.oid,false),'ast_hash',encode(sha256(convert_to(t.conbin::text,'UTF8')),'hex'),'data',(SELECT encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\\n' ORDER BY to_jsonb(p)::text),''),'UTF8')),'hex') FROM app.pwa_push_subscriptions p),'rows',(SELECT count(*) FROM app.pwa_push_subscriptions)) FROM pg_constraint t WHERE t.conrelid='app.pwa_push_subscriptions'::regclass AND t.conname='pwa_push_subscriptions_endpoint_check';"));
const expression="length(endpoint) between 8 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[^[:space:]#]+$'";
let created=false,proof;
try{
 assert.equal(run(['inspect',name]).status,1);
 check(['create','--pull=never','--name',name,'--label',key+'='+name,'--network=none','--restart=no','--log-driver=none','--user=postgres','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=512m','--cpus=1','--no-healthcheck','--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint','/bin/sh',IMAGE,'-c',INITIAL_RESTORE_STARTUP,'cluvo-pwa35-check-ast-owned','supabase_admin']);created=true;inspect();check(['start',name]);
 let ready=false;for(let n=0;n<60;n++){if(run(['exec',name,'pg_isready','-h','/restore','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(ready,true);inspect();
 sql('postgres','CREATE DATABASE owned_clone;CREATE SCHEMA app;CREATE TABLE app.pwa_push_subscriptions(id integer primary key,endpoint text not null check('+expression+'));INSERT INTO app.pwa_push_subscriptions VALUES(1,\'https://fcm.googleapis.com/test-owned\');');
 const source=snapshot('postgres');assert.equal(source.hash,sourceHash);
 const archive=check(['exec',name,'pg_dump','-h','/restore','-U','supabase_admin','-d','postgres','--format=custom','--schema=app','--no-password']);
 check(['exec','-i',name,'pg_restore','-h','/restore','-U','supabase_admin','-d','owned_clone','--exit-on-error','--no-password'],archive);
 const restored=snapshot('owned_clone');assert.equal(restored.hash,dumpHash);assert.equal(restored.data,source.data);assert.notEqual(restored.ast_hash,source.ast_hash);
 const sourceCatalog=catalogs('postgres'),before=catalogs('owned_clone');const plan=knownPwaCheckAstReconstruction(sourceCatalog,before,bytes);assert.ok(plan);sql('owned_clone',plan.sql);assert.deepEqual(catalogs('owned_clone'),sourceCatalog);assert.equal(sql('owned_clone',"SELECT obj_description(oid,'pg_constraint') IS NULL FROM pg_constraint WHERE conrelid='app.pwa_push_subscriptions'::regclass AND conname='pwa_push_subscriptions_endpoint_check';"),'t');
 const fixed=snapshot('owned_clone');assert.equal(fixed.hash,sourceHash);assert.equal(fixed.data,source.data);assert.equal(fixed.rows,source.rows);
 const rejects=[];
 for(const e of ["'http://fcm.googleapis.com/no'","'https://evil.example.test/no'","'https://fcm.googleapis.com/a#fragment'","'https://fcm.googleapis.com/'||repeat('x',2049)"]){assert.match(sql('owned_clone','BEGIN;INSERT INTO app.pwa_push_subscriptions VALUES(2,'+e+');ROLLBACK;',true),/23514/);rejects.push(true);}
 sql('postgres',"CREATE DATABASE child_source;CREATE DATABASE child_clone;");
 sql('child_source','CREATE SCHEMA app;CREATE TABLE app.pwa_push_subscriptions(id integer primary key,endpoint text not null check('+expression+'));CREATE TABLE app.owned_child() INHERITS(app.pwa_push_subscriptions);');
 const childSource=catalogs('child_source');
 const childArchive=check(['exec',name,'pg_dump','-h','/restore','-U','supabase_admin','-d','child_source','--format=custom','--schema=app','--no-password']);
 check(['exec','-i',name,'pg_restore','-h','/restore','-U','supabase_admin','-d','child_clone','--exit-on-error','--no-password'],childArchive);
 const childRestored=catalogs('child_clone');assert.equal(knownPwaCheckAstReconstruction(childSource,childRestored,bytes),null);
 const childBaseline=snapshot('child_clone');assert.match(sql('child_clone',plan.sql,true),/42P16/);assert.deepEqual(snapshot('child_clone'),childBaseline);
 assert.deepEqual(snapshot('postgres'),source);assert.deepEqual(snapshot('owned_clone'),fixed);inspect();
 proof={scope:'OWNED_NETWORK_NONE_PG17_CHECK_AST_ROUNDTRIP_FEASIBILITY',passed:true,source_definition_sha256:source.hash,restored_definition_sha256:restored.hash,clone_fixed_definition_sha256:fixed.hash,source_ast_sha256:source.ast_hash,restored_ast_sha256:restored.ast_hash,clone_fixed_ast_sha256:fixed.ast_hash,raw_ast_exact_after_recreate:fixed.ast_hash===source.ast_hash,actual_pg_dump_pg_restore:true,immutable_between_expression_recreated:true,data_sha_preserved:fixed.data===source.data,source_unchanged:true,bounds_and_provider_host_regex_negatives:rejects.length,network:'none',shared_database_mutations:false,hosted_database_mutations:false,external_provider_calls:0,full28_catalogs_exact_after_reconstruction:true,null_comment_preserved:true,native_inherited_check_dependency_repair_refused:true,native_drop_without_cascade_dependency_error:'42P16',production_enabled:false};
}finally{if(created){inspect();check(['rm','--force','--volumes',name]);assert.equal(run(['inspect',name]).status,1);}}
proof.owned_container_removed=true;
if(process.env.CLUVO_PWA_CHECK_AST_NULL_EVIDENCE)await writeFile(process.env.CLUVO_PWA_CHECK_AST_NULL_EVIDENCE,JSON.stringify(proof,null,2)+'\n',{mode:0o600});t.diagnostic(JSON.stringify(proof));
});
