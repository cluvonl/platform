// Actual new network-none PG17 fixture. No hosted account, secret or provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {IMAGE} from '../scripts/pg17-capture-worker.mjs';
import {INITIAL_RESTORE_STARTUP} from '../scripts/staging-pwa-upgrade-restore.mjs';
import {UPGRADE_FILES,createUpgradeMigrationManifest,upgradeMigrationSQL} from '../scripts/staging-pwa-upgrade-migrations.mjs';
import {createInitialMigrationManifest,initialMigrationSQL,INITIAL_MIGRATION_POLICY,INITIAL_MIGRATION_LOCK_OBJECT} from '../scripts/staging-initial-migrations.mjs';
import {buildStagingSportlinkSetup,SPORTLINK_SETUP_SCOPE,sportlinkSetupStableAccountSql} from '../scripts/staging-sportlink-setup-sql.mjs';
import {sealSportlinkCredential,openSportlinkCredential} from '../lib/sportlink/credentials.mjs';

const literal=v=>"'"+String(v).replaceAll("'","''")+"'",f=SPORTLINK_SETUP_SCOPE;
test('actual owned fresh35: narrow staging scope, replay, no adoption and native actor/foreign/member/revocation fences',
 {skip:process.env.CLUVO_SPORTLINK_SETUP_NATIVE_TESTS!=='owned-pg17',timeout:180000},async t=>{
 const socket=process.env.CLUVO_SPORTLINK_SETUP_DOCKER_SCOPE==='hosted'?'unix:///var/run/docker.sock':'unix:///run/user/1001/docker.sock';
 const name='cluvo-sportlink-setup-owned-'+randomBytes(12).toString('hex'),env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8'};
 let created=false,imageId;
 const run=(args,input)=>spawnSync('/usr/bin/docker',['--host',socket,...args],{input,env,encoding:'utf8',timeout:120000,maxBuffer:12000000});
 const checked=(args,input)=>{const r=run(args,input);assert.equal(r.status,0,'OWNED_SPORTLINK_SETUP_PROCESS_FAILED');assert.equal(r.stderr,'');return r.stdout;};
 const sql=(text,{role='postgres',failure=false,canonicalMigration=false}={})=>{
  const r=run(['exec','-i',name,'psql','-X','-qtA','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U',role,'-d','postgres'],"SET client_min_messages=warning;\n"+text);
  if(failure){assert.notEqual(r.status,0,'OWNED_SPORTLINK_SETUP_EXPECTED_DENIAL');return r.stderr;}
  assert.equal(r.status,0,'OWNED_SPORTLINK_SETUP_SQL_FAILED:'+r.stderr.match(/ERROR:\s*([0-9A-Z]{5})/)?.[1]);
  if(canonicalMigration)assert.match(r.stderr,/^(?:WARNING:  01007\n|WARNING:  01000\n)*$/);else assert.equal(r.stderr,'');
  return r.stdout.trim();
 };
 const json=(text,options)=>JSON.parse(sql(text,options));
 const guard=()=>{
  const v=JSON.parse(checked(['inspect',name,'--format','{"label":{{json (index .Config.Labels "cluvo.sportlink.setup-test")}},"name":{{json .Name}},"image":{{json .Image}},"config_image":{{json .Config.Image}},"network":{{json .HostConfig.NetworkMode}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}},"ports":{{json .HostConfig.PortBindings}},"binds":{{json .HostConfig.Binds}},"volumes_from":{{json .HostConfig.VolumesFrom}},"user":{{json .Config.User}},"privileged":{{json .HostConfig.Privileged}},"log":{{json .HostConfig.LogConfig.Type}},"restart":{{json .HostConfig.RestartPolicy.Name}},"entrypoint":{{json .Config.Entrypoint}},"args":{{json .Config.Cmd}}}']));
  assert.equal(v.label,name);assert.equal(v.name,'/'+name);assert.equal(v.image,imageId);assert.equal(v.config_image,IMAGE);
  assert.equal(v.network,'none');assert.deepEqual(v.tmpfs,{'/restore':'rw,size=512m,mode=1777'});
  assert.ok(v.mounts.every(m=>m.Type==='tmpfs'&&m.Destination==='/restore'));
  assert.ok(v.ports===null||Object.keys(v.ports).length===0);assert.ok(!v.binds&&!v.volumes_from&&!v.privileged);
  assert.equal(v.user,'postgres');assert.equal(v.log,'none');assert.equal(v.restart,'no');assert.deepEqual(v.entrypoint,['/bin/sh']);
  assert.deepEqual(v.args,['-c',INITIAL_RESTORE_STARTUP,'cluvo-sportlink-setup-owned','supabase_admin']);
 };
 const sha='a'.repeat(40),recipient='owned-sportlink-operator@example.test',lock=`SELECT pg_advisory_lock(${INITIAL_MIGRATION_POLICY.lockNamespace},${INITIAL_MIGRATION_LOCK_OBJECT});`;
 const context={actor:'owned-sportlink-setup',workflowRunId:'123',expectedBackendPid:1,expectedBackendStart:'2000-01-01T00:00:00Z',backupArtifactId:'456',backupArtifactSha256:'b'.repeat(64)};
 const nativeEnvelope=sql=>sql.replace('OR pg_backend_pid()<>1\n','OR pg_backend_pid()<>pg_backend_pid()\n')
  .replace("'2000-01-01T00:00:00Z'::timestamptz",'(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid())');
 const setup=buildStagingSportlinkSetup({recipient,sourceSha:sha,workflowRunId:'123',actor:'owned-sportlink-setup',expectedVersion:0});
 const provision=(before='')=>lock+'BEGIN READ WRITE;'+before+setup.guardSql+'PREPARE own_setup(text,text,text,text) AS '+setup.contextSql
  +'EXECUTE own_setup('+setup.parameters.map(literal).join(',')+');DEALLOCATE own_setup;'+setup.mutationSql+setup.readbackSql+'COMMIT;';
 const actor=randomUUID(),session=randomUUID(),member=randomUUID(),memberSession=randomUUID(),foreign=randomUUID(),foreignSession=randomUUID(),oldTenant=randomUUID(),oldPerson=randomUUID(),oldGrant=randomUUID();
 const oldScope=()=>json(`SELECT jsonb_build_object('profile',(SELECT to_jsonb(t) FROM app.account_profiles t WHERE auth_user_id='${actor}'),
 'person',(SELECT to_jsonb(t) FROM app.persons t WHERE id='${oldPerson}'),'grant',(SELECT to_jsonb(t) FROM app.access_grants t WHERE id='${oldGrant}'),
 'membership',(SELECT jsonb_agg(to_jsonb(t)) FROM app.tenant_memberships t WHERE tenant_id='${oldTenant}'),
 'links',(SELECT jsonb_agg(to_jsonb(t)) FROM app.account_person_links t WHERE tenant_id='${oldTenant}'));`);
 const native=(uid,sid,body,options={})=>sql(`BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',
 '${JSON.stringify({sub:uid,role:'authenticated',session_id:sid})}',true);${body}COMMIT;`,{role:'authenticator',...options});
 const nativeJson=(uid,sid,body)=>JSON.parse(native(uid,sid,body).split('\n').filter(l=>l.startsWith('{')||l.startsWith('[')).at(-1));
 try{
  const image=JSON.parse(checked(['image','inspect',IMAGE,'--format','{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']));
  assert.ok(image.digests.includes(IMAGE));imageId=image.id;assert.equal(run(['inspect',name]).status,1);
  checked(['create','--pull=never','--name',name,'--label','cluvo.sportlink.setup-test='+name,'--network=none','--restart=no','--log-driver=none',
   '--user=postgres','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=512m','--cpus=1','--no-healthcheck',
   '--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint','/bin/sh',IMAGE,'-c',INITIAL_RESTORE_STARTUP,'cluvo-sportlink-setup-owned','supabase_admin']);created=true;guard();checked(['start',name]);
  let ready=false;for(let n=0;n<50;n++){if(run(['exec',name,'pg_isready','-h','/restore','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,100));}assert.equal(ready,true);guard();
  sql(`CREATE ROLE postgres LOGIN CREATEDB CREATEROLE BYPASSRLS;CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE ROLE authenticator LOGIN NOSUPERUSER NOBYPASSRLS;GRANT authenticated TO authenticator;
ALTER DATABASE postgres OWNER TO postgres;CREATE SCHEMA auth AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;SET ROLE postgres;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz,encrypted_password text,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),not_after timestamptz);
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;RESET ROLE;`,{role:'supabase_admin'});
  sql("ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas='api';",{role:'supabase_admin'});
  const sources=await Promise.all(UPGRADE_FILES.map(e=>readFile(new URL('../supabase/migrations/'+e.file,import.meta.url)).then(bytes=>({file:e.file,bytes}))));
  const initial=createInitialMigrationManifest(sha,sources.slice(0,16)),upgrade=createUpgradeMigrationManifest(sha,sources);
  sql(lock+initial.migrations.map((_,i)=>nativeEnvelope(initialMigrationSQL(initial,i,context))).join('\n'),{canonicalMigration:true});
  sql(lock+upgrade.migrations.slice(16).map((_,i)=>nativeEnvelope(upgradeMigrationSQL(upgrade,i+16,context))).join('\n'),{canonicalMigration:true});
  const paths=json(`SELECT jsonb_build_object('data',current_setting('data_directory'),'config',current_setting('config_file'),'hba',current_setting('hba_file'),
 'socket',current_setting('unix_socket_directories'),'listen',current_setting('listen_addresses'),'archive',current_setting('archive_mode'),
 'logging',current_setting('logging_collector'),'temp',current_setting('temp_tablespaces'),'external',(SELECT count(*) FROM pg_tablespace WHERE spcname NOT IN('pg_default','pg_global')));`,{role:'supabase_admin'});
  assert.deepEqual(paths,{data:'/restore/pgdata',config:'/restore/pgdata/postgresql.conf',hba:'/restore/pgdata/pg_hba.conf',socket:'/restore',listen:'',archive:'off',logging:'off',temp:'',external:0});
  sql(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('${actor}','${recipient}',now()),('${member}','owned-sportlink-member@example.test',now()),('${foreign}','owned-sportlink-foreign@example.test',now());
INSERT INTO auth.sessions(id,user_id) VALUES('${session}','${actor}'),('${memberSession}','${member}'),('${foreignSession}','${foreign}');
INSERT INTO app.tenants(id,slug,name) VALUES('${oldTenant}','owned-sportlink-original','Original owned scope');
INSERT INTO app.account_profiles(auth_user_id,display_name) VALUES('${actor}','Unchanged original profile');
INSERT INTO app.persons(id,tenant_id,given_name,family_name) VALUES('${oldPerson}','${oldTenant}','Owned','Original');
INSERT INTO app.account_person_links(tenant_id,auth_user_id,person_id,verified_at) VALUES('${oldTenant}','${actor}','${oldPerson}',now());
INSERT INTO app.tenant_memberships(tenant_id,auth_user_id) VALUES('${oldTenant}','${actor}');
INSERT INTO app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) SELECT '${oldGrant}','${oldTenant}','${actor}',id,'tenant','${actor}' FROM app.permission_roles WHERE tenant_id='${oldTenant}' AND role_key='member';`);
  const original=oldScope();
  const originalStable=json(sportlinkSetupStableAccountSql(actor));
  assert.match(sql(provision(`UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['drift'] WHERE version='${UPGRADE_FILES[34].file.slice(0,14)}';`),{failure:true}),/P0001/);
  assert.match(sql(provision(`INSERT INTO app.tenants(id,slug,name) VALUES('${randomUUID()}','${f.slug}','Conflicting tenant');`),{failure:true}),/P0001/);
  assert.equal(json(`SELECT count(*) FROM app.tenants WHERE id='${f.tenant}' OR slug='${f.slug}';`),0);
  const first=sql(provision()).split('\n').filter(l=>l.startsWith('{')).map(JSON.parse).at(-1);assert.equal(first.outcome,'created');assert.equal(first.permission_count,1);
  const second=sql(provision()).split('\n').filter(l=>l.startsWith('{')).map(JSON.parse).at(-1);assert.equal(second.outcome,'already_configured');
  assert.deepEqual(oldScope(),original);
  assert.deepEqual(json(sportlinkSetupStableAccountSql(actor)),originalStable);
  const checks=json(`SELECT jsonb_build_object('roles',(SELECT array_agg(p.permission_key) FROM app.access_grants g JOIN app.role_permissions p ON p.tenant_id=g.tenant_id AND p.role_id=g.role_id WHERE g.tenant_id='${f.tenant}'),
 'audits',(SELECT count(*) FROM app.audit_events WHERE tenant_id='${f.tenant}'),'events',(SELECT count(*) FROM app.domain_events WHERE tenant_id='${f.tenant}'),
 'commands',(SELECT count(*) FROM app.idempotency_records WHERE tenant_id='${f.tenant}'),'annual',(SELECT ends_at=starts_at+interval '1 year' AND renewed_at IS NULL FROM app.access_grants WHERE id='${f.grant}'),
 'truth',(SELECT payload_minimal->>'provisioning_actor'='owned-sportlink-setup' AND payload_minimal->>'native_session_claimed'='false' AND payload_minimal->>'beneficiary_auth_user_used_as_fk'='true' FROM app.audit_events WHERE id='${f.audit}'));
`);assert.deepEqual(checks,{roles:['match.import'],audits:1,events:1,commands:1,annual:true,truth:true});
  const workspace=nativeJson(actor,session,`SELECT coalesce(jsonb_agg(to_jsonb(w)),'[]') FROM api.my_workspaces w WHERE tenant_id='${f.tenant}';`);
  assert.equal(workspace.length,1);assert.equal(workspace[0].role_key,f.roleKey);assert.equal(workspace[0].person_id,f.person);
  assert.deepEqual(nativeJson(actor,session,`SELECT api.sportlink_connection_state('${f.tenant}');`),{authorized:true,connection:null});
  const connection=randomUUID(),key=randomUUID(),testSecret=randomBytes(32).toString('hex'),fakeClientId='owned_'+randomBytes(12).toString('hex');
  const sealed=sealSportlinkCredential(fakeClientId,testSecret,{tenantId:f.tenant,connectionId:connection});
  const save=nativeJson(actor,session,`SELECT api.configure_sportlink_connection('${f.tenant}','${connection}',0,${literal(JSON.stringify(sealed.envelope))}::jsonb,${literal(sealed.fingerprint)},'${key}');`);
  assert.equal(save.ok,true);assert.equal(save.version,1);
  const credential=nativeJson(actor,session,`SELECT api.sportlink_connection_credential('${f.tenant}','${connection}',1);`);
  assert.equal(openSportlinkCredential(credential.credential_envelope,credential.credential_fingerprint,testSecret,{tenantId:f.tenant,connectionId:connection}),fakeClientId);
  const memberPerson=randomUUID(),memberLink=randomUUID(),memberMembership=randomUUID(),memberGrant=randomUUID();
  // Make the denial an actual ordinary member of this same tenant. These
  // separate owned fixture rows are removed before testing bootstrap replay.
  sql(`INSERT INTO app.persons(id,tenant_id,given_name,family_name) VALUES('${memberPerson}','${f.tenant}','Owned','Member');
INSERT INTO app.account_person_links(id,tenant_id,auth_user_id,person_id,verified_at) VALUES('${memberLink}','${f.tenant}','${member}','${memberPerson}',now());
INSERT INTO app.tenant_memberships(id,tenant_id,auth_user_id) VALUES('${memberMembership}','${f.tenant}','${member}');
INSERT INTO app.access_grants(id,tenant_id,auth_user_id,role_id,scope_kind,granted_by_auth_user_id) SELECT '${memberGrant}','${f.tenant}','${member}',id,'tenant','${actor}' FROM app.permission_roles WHERE tenant_id='${f.tenant}' AND role_key='member';`);
  const ordinary=nativeJson(member,memberSession,`SELECT coalesce(jsonb_agg(to_jsonb(w)),'[]') FROM api.my_workspaces w WHERE tenant_id='${f.tenant}';`);
  assert.equal(ordinary.length,1);assert.equal(ordinary[0].role_key,'member');
  assert.match(native(member,memberSession,`SELECT api.sportlink_connection_state('${f.tenant}');`,{failure:true}),/42501/);
  sql(`DELETE FROM app.access_grants WHERE id='${memberGrant}';DELETE FROM app.account_person_links WHERE id='${memberLink}';
DELETE FROM app.tenant_memberships WHERE id='${memberMembership}';DELETE FROM app.persons WHERE id='${memberPerson}';`);
  assert.match(native(foreign,foreignSession,`SELECT api.sportlink_connection_credential('${f.tenant}','${connection}',1);`,{failure:true}),/42501/);
  assert.match(native(actor,session,`SELECT api.sportlink_connection_state('${oldTenant}');`,{failure:true}),/42501/);
  sql(`UPDATE auth.sessions SET not_after=now()-interval '1 minute' WHERE id='${session}';`);
  assert.match(native(actor,session,`SELECT api.sportlink_connection_state('${f.tenant}');`,{failure:true}),/42501/);
  sql(`UPDATE app.access_grants SET revoked_at=now(),version=version+1 WHERE id='${f.grant}';`);
  const freshActorSession=randomUUID();sql(`INSERT INTO auth.sessions(id,user_id) VALUES('${freshActorSession}','${actor}');`);
  assert.match(native(actor,freshActorSession,`SELECT api.sportlink_connection_state('${f.tenant}');`,{failure:true}),/42501/);
  assert.match(sql(provision(),{failure:true}),/P0001/);
  assert.equal(json(`SELECT count(*) FROM app.audit_events WHERE action='staging.sportlink_operator_scope_created' AND tenant_id='${f.tenant}';`),1);
  assert.equal(json(`SELECT count(*) FROM app.access_grants WHERE id='${f.grant}' AND revoked_at IS NOT NULL AND version=2;`),1);
  assert.deepEqual(oldScope(),original);guard();
  t.diagnostic(JSON.stringify({scope:'LOCAL_OWNED_PG17_SPORTLINK_STAGE_SETUP',actual_migration_count:35,network:'none',hosted_connections:0,
   fresh_scope_created:true,same_key_replay_no_duplicate:true,byte_history_drift_rejected:true,slug_collision_no_adoption:true,
   permission_keys:['match.import'],annual_grant:true,existing_profile_and_foreign_grants_unchanged:true,native_operator_workspace:true,
   native_save_encrypted_readback:true,same_tenant_active_member_denied:true,foreign_denied:true,old_tenant_import_denied:true,expired_session_denied:true,new_active_session_revoked_grant_denied:true,
   revoked_grant_not_restored_by_replay:true,provider_requests:0,real_credentials_used:false,production_enabled:false}));
 }finally{if(created){guard();checked(['rm','--force','--volumes',name]);assert.equal(run(['inspect',name]).status,1);}}
});
