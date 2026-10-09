import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {IMAGE}=await import(root+'scripts/pg17-capture-worker.mjs');
const {INITIAL_RESTORE_STARTUP}=await import(root+'scripts/staging-pwa-upgrade-restore.mjs');
const {UPGRADE_FILES,createUpgradeMigrationManifest,upgradeMigrationSQL}=await import(root+'scripts/staging-pwa-upgrade-migrations.mjs');
const {createInitialMigrationManifest,initialMigrationSQL,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT}=await import(root+'scripts/staging-initial-migrations.mjs');
export async function runOwnedInvitationAuthorityFence(){
const sourceSha='a'.repeat(40),socket=process.env.CLUVO_PWA_UPGRADE_DOCKER_SCOPE==='hosted'?'unix:///var/run/docker.sock':'unix:///run/user/1001/docker.sock';
const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8'};
const name='cluvo-inviter-race-'+randomBytes(12).toString('hex');let cid,imageId,created=false,removed=false;
const quote=value=>"'"+value.replaceAll("'","''")+"'",sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(args,input)=>spawnSync('/usr/bin/docker',['--host',socket,...args],{input,env,encoding:'utf8',maxBuffer:8_000_000,timeout:90000});
const checked=(args,input)=>{const r=run(args,input);assert.equal(r.status,0,'OWNED_PROCESS_FAILED');return r.stdout;};
const args=(role='postgres')=>['--host',socket,'exec','-i',cid,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U',role,'-d','postgres'];
const sql=(text,role='postgres')=>{const r=spawnSync('/usr/bin/docker',args(role),{input:'SET client_min_messages=warning;\n'+text,env,encoding:'utf8',maxBuffer:8_000_000,timeout:90000});assert.equal(r.status,0,'OWNED_SQL_FAILED_'+(r.stderr.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1]??'UNKNOWN'));return r.stdout.trim();};
const json=text=>JSON.parse(sql(text).split('\n').filter(l=>l.startsWith('{')||l.startsWith('[')).at(-1));
const inspect=()=>JSON.parse(checked(['inspect',cid,'--format','{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"label":{{json (index .Config.Labels "cluvo.pwa.inviter-race")}},"network":{{json .HostConfig.NetworkMode}},"mounts":{{json .Mounts}},"ports":{{json .HostConfig.PortBindings}},"log":{{json .HostConfig.LogConfig.Type}},"user":{{json .Config.User}}}']));
const guard=()=>{const v=inspect();assert.equal(v.id,cid);assert.equal(v.name,'/'+name);assert.equal(v.image,imageId);assert.equal(v.label,name);assert.equal(v.network,'none');assert.ok(v.mounts.every(x=>x.Type==='tmpfs'));assert.ok(v.ports===null||Object.keys(v.ports).length===0);assert.equal(v.log,'none');assert.equal(v.user,'postgres');};
function persistent(){
 const child=spawn('/usr/bin/docker',args(),{env,stdio:['pipe','pipe','pipe']});let out='',err='',pending;
 child.stdout.on('data',b=>{out+=b.toString();if(pending&&out.includes(pending.marker+'\n')){const p=pending;pending=undefined;const end=out.indexOf(p.marker+'\n'),value=out.slice(0,end);out=out.slice(end+p.marker.length+1);p.resolve(value);}});child.stderr.on('data',b=>{err+=b.toString();});
 const exited=new Promise(resolve=>child.once('close',code=>{pending?.reject(Error('OWNED_HOLDER_FAILED'));resolve({code,err});}));
 return {query:text=>new Promise((resolve,reject)=>{assert.equal(pending,undefined);const marker='owned_'+randomBytes(10).toString('hex');pending={marker,resolve,reject};child.stdin.write(text+'\n\\echo '+marker+'\n');}),close:async()=>{child.stdin.end('ROLLBACK;\n\\q\n');const r=await exited;assert.equal(r.code,0,'OWNED_HOLDER_CLEANUP_FAILED');}};
}
function contender(text){
 const child=spawn('/usr/bin/docker',args('authenticator'),{env,stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>{out+=b.toString();});child.stderr.on('data',b=>{err+=b.toString();});
 const done=new Promise(resolve=>child.once('close',code=>resolve({code,stdout:out,sqlstate:err.match(/ERROR:\s+([A-Z0-9]{5})/)?.[1]??null,error:err.match(/ERROR:\s+[A-Z0-9]{5}:\s*([A-Z_]+)/)?.[1]??null})));
 child.stdin.end('SET client_min_messages=warning;\n'+text);return {done};
}
const rows=text=>text.split('\n').filter(l=>l.startsWith('{')).map(l=>JSON.parse(l));
const localBackend=text=>{assert.ok(text.includes('OR pg_backend_pid()<>1\n'));return text.replace('OR pg_backend_pid()<>1\n','OR pg_backend_pid()<>pg_backend_pid()\n').replace(quote('2000-01-01T00:00:00Z')+'::timestamptz','(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid())');};
const scenarios=[];
try{
 const image=JSON.parse(checked(['image','inspect',IMAGE,'--format','{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']));assert.ok(image.digests.includes(IMAGE));imageId=image.id;
 assert.equal(run(['inspect',name]).status,1);created=true;cid=checked(['create','--pull=never','--name',name,'--label','cluvo.pwa.inviter-race='+name,'--network=none','--restart=no','--log-driver=none','--user=postgres','--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint','/bin/sh',IMAGE,'-c',INITIAL_RESTORE_STARTUP,'cluvo-inviter-race','supabase_admin']).trim();guard();checked(['start',cid]);
 let ready=false;for(let a=0;a<50;a++){if(run(['exec',cid,'pg_isready','-h','/restore','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(ready,true);
 sql(`CREATE ROLE postgres LOGIN CREATEDB CREATEROLE BYPASSRLS;GRANT pg_read_all_stats TO postgres;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE ROLE authenticator LOGIN;GRANT authenticated TO authenticator;ALTER DATABASE postgres OWNER TO postgres;CREATE SCHEMA auth AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;SET ROLE postgres;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),not_after timestamptz);
 ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;RESET ROLE;`,'supabase_admin');
 const sources=await Promise.all(UPGRADE_FILES.map(async file=>({file:file.file,bytes:await readFile(root+'supabase/migrations/'+file.file)})));assert.equal(sources.length,35);
 const initial=createInitialMigrationManifest(sourceSha,sources.slice(0,16)),manifest=createUpgradeMigrationManifest(sourceSha,sources);
 const context={actor:'owned-inviter-race',workflowRunId:'995533',expectedBackendPid:1,expectedBackendStart:'2000-01-01T00:00:00Z',backupArtifactId:'123',backupArtifactSha256:'b'.repeat(64)};
 const lock=`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});\n`;
 sql(lock+initial.migrations.map((_,i)=>localBackend(initialMigrationSQL(initial,i,context))).join('\n'));
 sql(lock+manifest.migrations.slice(16).map((_,i)=>localBackend(upgradeMigrationSQL(manifest,i+16,context))).join('\n'));
 assert.equal(json("SELECT jsonb_build_object('n',count(*)) FROM supabase_migrations.schema_migrations;").n,35);
 console.log(JSON.stringify({phase:'FULL35_READY',network:'none',source_sha:sourceSha}));
 for(const kind of ['authorized_mobile_control','mobile_author_revoked_while_waiting','mobile_session_expired_while_waiting','web_author_revoked_while_waiting']){
  const tenant=randomUUID(),household=randomUUID(),actor=randomUUID(),session=randomUUID(),grant=randomUUID(),key=randomUUID();
  const suffix=tenant.slice(0,8),email='owned-inviter-'+suffix+'@example.test',recipient='owned-invitee-'+suffix+'@example.test';
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at)VALUES(${quote(actor)},${quote(email)},statement_timestamp());INSERT INTO auth.sessions(id,user_id)VALUES(${quote(session)},${quote(actor)});
  INSERT INTO app.tenants(id,slug,name,status)VALUES(${quote(tenant)},${quote('race-'+suffix)},'Owned inviter race','active');INSERT INTO app.tenant_memberships(tenant_id,auth_user_id,status)VALUES(${quote(tenant)},${quote(actor)},'active');
  INSERT INTO app.households(id,tenant_id,label,intake_code_hash,status)VALUES(${quote(household)},${quote(tenant)},'Owned synthetic household',extensions.digest('public-synthetic-code','sha256'),'active');
  INSERT INTO app.household_access_grants(id,tenant_id,household_id,auth_user_id,can_view_progress,can_invite_executor,granted_by_auth_user_id)VALUES(${quote(grant)},${quote(tenant)},${quote(household)},${quote(actor)},true,true,${quote(actor)});`);
  const appName='owned-inviter-contender-'+suffix;
  const actorSql=`SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote(JSON.stringify({sub:actor,session_id:session,email,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}))},true) IS NOT NULL;SELECT set_config('request.jwt.claim.sub',${quote(actor)},true) IS NOT NULL;SELECT set_config('request.jwt.claim.email',${quote(email)},true) IS NOT NULL;`;
  const functionName=kind.startsWith('web')?'create_household_invitation_v2':'pwa_create_household_invitation';
  const command=`SET application_name=${quote(appName)};SET statement_timeout='15s';BEGIN;${actorSql}SELECT jsonb_build_object('native_session_valid',internal.actor_has_active_session());SELECT to_jsonb(t) FROM api.${functionName}(${quote(tenant)},${quote(household)},'Owned','Recipient',${quote(recipient)},${quote(sha(randomBytes(32)))},true,false,1,${quote(key)})t;COMMIT;`;
  let holder,holderPid=null,waitProof=null,revocation=null,result;const started=Date.now();
  try{
   if(kind==='authorized_mobile_control'){
    result=await contender(command).done;
    const retry=await contender(command).done;
    assert.equal(result.code,0);assert.equal(retry.code,0);
    assert.deepEqual(rows(result.stdout).at(-1),rows(retry.stdout).at(-1),'SAME_COMMAND_RETRY_CHANGED_RECEIPT');
   }
   else{
    holder=persistent();const held=rows(await holder.query(`SET client_min_messages=warning;BEGIN;SELECT 1 FROM app.households WHERE id=${quote(household)} FOR UPDATE;SELECT jsonb_build_object('pid',pg_backend_pid());`)).at(-1);holderPid=held.pid;
    const pending=contender(command);let observed;
    for(let attempt=0;attempt<30;attempt++){
     observed=json(`SELECT jsonb_build_object('count',count(*),'pid',max(pid),'wait_lock',bool_and(wait_event_type='Lock'),'holder_blocks',bool_and(${holderPid}=ANY(pg_blocking_pids(pid))),'query_matches',bool_and(query LIKE '%api.${functionName}(%')) FROM pg_stat_activity WHERE application_name=${quote(appName)};`);
     if(observed.count===1&&observed.wait_lock&&observed.holder_blocks&&observed.query_matches)break;
     await new Promise(r=>setTimeout(r,50));
    }
    assert.equal(observed.count,1);assert.equal(observed.wait_lock,true);assert.equal(observed.holder_blocks,true);assert.equal(observed.query_matches,true);
    const again=json(`SELECT jsonb_build_object('pid',pid,'holder_blocks',${holderPid}=ANY(pg_blocking_pids(pid)),'wait_event_type',wait_event_type)FROM pg_stat_activity WHERE pid=${observed.pid};`);assert.equal(again.pid,observed.pid);assert.equal(again.holder_blocks,true);assert.equal(again.wait_event_type,'Lock');
    waitProof={holder_backend_pid:holderPid,contender_backend_pid:observed.pid,actual_blocked_contenders:1,independent_observer_confirmations:2,native_call_matches:true,holder_is_actual_blocker:true,wait_event_type:'Lock',wait_observed_before_revocation:true};
    if(kind==='mobile_session_expired_while_waiting'){
     revocation=json(`WITH changed AS(UPDATE auth.sessions SET not_after=statement_timestamp()-interval '1 second' WHERE id=${quote(session)} AND user_id=${quote(actor)} AND not_after IS NULL RETURNING id)SELECT jsonb_build_object('changed_rows',count(*))FROM changed;`);assert.equal(revocation.changed_rows,1);
    }else{
     revocation=json(`WITH changed AS(UPDATE app.household_access_grants SET can_invite_executor=false,revoked_at=statement_timestamp(),version=version+1 WHERE id=${quote(grant)} AND tenant_id=${quote(tenant)} AND household_id=${quote(household)} AND auth_user_id=${quote(actor)} AND revoked_at IS NULL AND can_invite_executor RETURNING id)SELECT jsonb_build_object('changed_rows',count(*))FROM changed;`);assert.equal(revocation.changed_rows,1);
     const after=json(`SELECT jsonb_build_object('revoked',revoked_at IS NOT NULL,'can_invite',can_invite_executor,'rows',1) FROM app.household_access_grants WHERE id=${quote(grant)};`);assert.equal(after.revoked,true);assert.equal(after.can_invite,false);
    }
    const still=json(`SELECT jsonb_build_object('blocked',${holderPid}=ANY(pg_blocking_pids(pid)))FROM pg_stat_activity WHERE pid=${observed.pid};`);assert.equal(still.blocked,true);
    waitProof.independent_revocation_committed_while_blocked=true;
    await holder.query('COMMIT;');result=await pending.done;
   }
   console.log(JSON.stringify({phase:'NATIVE_RESULT',kind,exit_status:result.code,sqlstate:result.sqlstate,error_code:result.error,json_rows:rows(result.stdout).length}));
   assert.equal(rows(result.stdout)[0]?.native_session_valid,true);
   const readback=json(`SELECT jsonb_build_object('invitations',(SELECT count(*)FROM app.household_invitations WHERE tenant_id=${quote(tenant)}),'created_audits',(SELECT count(*)FROM app.audit_events WHERE tenant_id=${quote(tenant)} AND action='household.invitation_created'),'created_domain_events',(SELECT count(*)FROM app.domain_events WHERE tenant_id=${quote(tenant)} AND event_type='household.invitation_created'),'invited_persons',(SELECT count(*)FROM app.persons WHERE tenant_id=${quote(tenant)} AND status='invited'),'household_version',(SELECT version FROM app.households WHERE id=${quote(household)}),'completed_creation_commands',(SELECT count(*)FROM app.idempotency_records WHERE tenant_id=${quote(tenant)} AND operation='create_household_invitation_v2' AND status='completed'),'grant_rows',(SELECT count(*)FROM app.household_access_grants WHERE id=${quote(grant)}),'grant_revoked',(SELECT revoked_at IS NOT NULL FROM app.household_access_grants WHERE id=${quote(grant)}),'grant_can_invite',(SELECT can_invite_executor FROM app.household_access_grants WHERE id=${quote(grant)}),'ledger_rows',(SELECT count(*)FROM app.hour_ledger_entries WHERE tenant_id=${quote(tenant)}));`);
   const positive=kind==='authorized_mobile_control',sessionExpired=kind==='mobile_session_expired_while_waiting';
   assert.equal(result.code===0,positive);assert.equal(result.sqlstate,positive?null:'42501');
   assert.deepEqual(readback,{invitations:positive?1:0,created_audits:positive?1:0,created_domain_events:positive?1:0,invited_persons:positive?1:0,household_version:positive?2:1,completed_creation_commands:positive?1:0,grant_rows:1,grant_revoked:!positive&&!sessionExpired,grant_can_invite:positive||sessionExpired,ledger_rows:0});
   const scenario={kind,native_rpc:functionName,exit_status:result.code,sqlstate:result.sqlstate,error_code:result.error,elapsed_ms:Date.now()-started,wait_proof:waitProof,same_command_retry_proved:positive,readback};
   if(positive){
    const revoked=json(`WITH changed AS(UPDATE app.household_access_grants SET can_invite_executor=false,revoked_at=statement_timestamp(),version=version+1 WHERE id=${quote(grant)} AND tenant_id=${quote(tenant)} AND auth_user_id=${quote(actor)} AND revoked_at IS NULL RETURNING id)SELECT jsonb_build_object('changed_rows',count(*))FROM changed;`);assert.equal(revoked.changed_rows,1);
    const retryAfterRevocation=await contender(command).done;
    assert.notEqual(retryAfterRevocation.code,0);assert.equal(retryAfterRevocation.sqlstate,'42501');
    const unchanged=json(`SELECT jsonb_build_object('invitations',(SELECT count(*)FROM app.household_invitations WHERE tenant_id=${quote(tenant)}),'audits',(SELECT count(*)FROM app.audit_events WHERE tenant_id=${quote(tenant)}),'events',(SELECT count(*)FROM app.domain_events WHERE tenant_id=${quote(tenant)}),'household_version',(SELECT version FROM app.households WHERE id=${quote(household)}));`);
    assert.deepEqual(unchanged,{invitations:1,audits:1,events:1,household_version:2});
    scenario.completed_key_retry_after_authority_revocation_refused=true;
   }
   scenarios.push(scenario);console.log(JSON.stringify({phase:'SCENARIO_COMPLETE',...scenario}));
  }finally{if(holder)await holder.close();}
 }
 const proof={scope:'LOCAL_OWNED_PG17_INVITATION_AUTHORITY_FENCE_REGRESSION',source_sha:sourceSha,server_version:json("SELECT jsonb_build_object('v',current_setting('server_version'));").v,pinned_image:IMAGE,migrations:35,migration_manifest_sha256:manifest.sha256,migration_source_bytes_sha256:sources.map(s=>({file:s.file,sha256:sha(s.bytes)})),network:'none',native_claims_and_confirmed_auth_fixture:true,provider_called:false,shared_database_connections:0,hosted_connections:0,source_files_edited:false,scenarios};
 guard();checked(['rm','--force','--volumes',cid]);assert.equal(run(['inspect',cid]).status,1);removed=true;proof.owned_container_removed=true;
 proof.passed=true;proof.production_enabled=false;return proof;
}finally{if(created&&cid&&!removed){guard();checked(['rm','--force','--volumes',cid]);}}

}
