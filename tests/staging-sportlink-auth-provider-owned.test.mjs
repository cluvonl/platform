// Explicit local contract proof on one NEW owned fake Auth identity. This is
// separate from staging provisioning and receives no hosted secrets or users.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {createClient} from '@supabase/supabase-js';
import {createLocalExistingSportlinkOperatorSession,closeSportlinkOperatorSession} from '../scripts/staging-sportlink-setup-auth.mjs';

test('actual owned local Auth: recovery is existing-only, verified native session, local logout preserves old users/sessions',
 {skip:process.env.CLUVO_SPORTLINK_AUTH_PROVIDER_NATIVE_TESTS!=='owned-local-provider',timeout:90000},async t=>{
 const root='/home/codex/repos/cluvo/nextjs-starter',api='http://127.0.0.1:55321',container='supabase_db_cluvo-local';
 const env={PATH:process.env.PATH,HOME:process.env.HOME,DOCKER_HOST:'unix:///run/user/1001/docker.sock'};
 const run=(cmd,args,input)=>execFileSync(cmd,args,{cwd:root,env,input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000,maxBuffer:4000000});
 const need=(v,c)=>assert.equal(Boolean(v),true,c),literal=v=>"'"+v.replaceAll("'","''")+"'";
 const guard=()=>{
  const v=JSON.parse(run('/usr/bin/docker',['inspect',container,'--format','{"name":{{json .Name}},"project":{{json (index .Config.Labels "com.supabase.cli.project")}},"ports":{{json .NetworkSettings.Ports}}}']));
  need(v.name==='/'+container&&v.project==='cluvo-local','LOCAL_PROVIDER_OWNER_REQUIRED');
  need(v.ports?.['5432/tcp']?.every(p=>['127.0.0.1','0.0.0.0','::'].includes(p.HostIp)&&p.HostPort==='55322'),'LOCAL_PROVIDER_DATABASE_PORT_REQUIRED');
 };
 const sql=query=>{guard();return run('/usr/bin/docker',['exec','-i',container,'psql','-X','-qtA','-U','postgres','-d','postgres','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate'],
  "BEGIN READ ONLY;SET LOCAL timezone='UTC';SET LOCAL extra_float_digits=3;"+query+';ROLLBACK;').trim();};
 const json=q=>JSON.parse(sql(q));
 const snapshot=()=>json("SELECT jsonb_build_object('users',(SELECT coalesce(jsonb_object_agg(id::text,encode(sha256(convert_to(jsonb_build_object('id',id,'email',email,'password',encrypted_password,'confirmed',email_confirmed_at,'deleted',deleted_at,'banned',banned_until,'role',role,'aud',aud,'app_metadata',raw_app_meta_data,'user_metadata',raw_user_meta_data)::text,'UTF8')),'hex')),'{}'::jsonb) FROM auth.users),'sessions',(SELECT coalesce(jsonb_object_agg(id::text,jsonb_build_object('user',user_id,'not_after',not_after)),'{}'::jsonb) FROM auth.sessions))");
 const preserve=(before,after)=>{for(const type of ['users','sessions'])for(const [id,value]of Object.entries(before[type]))need(isDeepStrictEqual(after[type]?.[id],value),'ORIGINAL_LOCAL_AUTH_AUTHORITY_PRESERVATION_FAILED');};
 let admin,user,session,baseline,proof;const nonce=randomBytes(12).toString('hex'),email='sportlink-owned-recovery-'+nonce+'@example.test',missing='sportlink-owned-unknown-'+nonce+'@example.test';
 try{
  guard();const status=JSON.parse(run('npx',['supabase','status','--output','json']));need(status.API_URL===api,'LOCAL_PROVIDER_URL_REQUIRED');
  const pub=status.PUBLISHABLE_KEY??status.ANON_KEY,secret=status.SECRET_KEY??status.SERVICE_ROLE_KEY;need(typeof pub==='string'&&typeof secret==='string','LOCAL_PROVIDER_KEYS_REQUIRED');
  const fixedFetch=(input,init={})=>{const u=new URL(input instanceof Request?input.url:String(input));need(u.origin===api&&u.pathname.startsWith('/auth/v1/'),'LOCAL_PROVIDER_AUTH_TARGET_REQUIRED');return fetch(input,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});};
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fixedFetch}};
  admin=createClient(api,secret,options);const client=createClient(api,pub,options);baseline=snapshot();
  const unknown=await admin.auth.admin.generateLink({type:'recovery',email:missing});need(unknown.error?.code==='user_not_found'||unknown.error?.status===404,'UNKNOWN_RECOVERY_MUST_BE_REFUSED');
  need(json('SELECT count(*) FROM auth.users WHERE lower(email)='+literal(missing))===0,'UNKNOWN_RECOVERY_MUST_NOT_CREATE_USER');preserve(baseline,snapshot());
  const created=await admin.auth.admin.createUser({email,email_confirm:true,app_metadata:{cluvo_sportlink_setup_proof:nonce}});
  need(created.error===null&&created.data?.user?.app_metadata?.cluvo_sportlink_setup_proof===nonce&&created.data.user.email===email,'OWNED_AUTH_USER_CREATE_FAILED');user=created.data.user;
  session=await createLocalExistingSportlinkOperatorSession({admin,client,recipient:email,authUserId:user.id,projectUrl:api,
   verifyNativeSession:async(uid,sid)=>{need(uid===user.id,'OWNED_PROVIDER_IDENTITY_REQUIRED');need(json("SELECT to_jsonb(EXISTS(SELECT 1 FROM auth.sessions WHERE id="+literal(sid)+" AND user_id="+literal(uid)+" AND(not_after IS NULL OR not_after>now())))"),'PROVIDER_NATIVE_SESSION_REQUIRED');}});
  preserve(baseline,snapshot());await closeSportlinkOperatorSession(admin,session);
  need(json('SELECT count(*) FROM auth.sessions WHERE id='+literal(session.sessionId))===0,'CREATED_PROVIDER_SESSION_DELETE_REQUIRED');preserve(baseline,snapshot());
  proof={scope:'LOCAL_OWNED_SPORTLINK_SETUP_AUTH_PROVIDER_CONTRACT',passed:true,unknown_recovery_no_signup:true,new_fake_identity_only:true,
   genuine_admin_issued_recovery_session:true,provider_get_user_and_verified_claims:true,native_session_row_verified:true,
   explicit_local_signout_only:true,created_session_absent:true,all_original_users_and_sessions_preserved:true,
   email_sent:false,password_changed:false,real_credentials_used:false,hosted_requests:0,provider_requests:0,production_enabled:false};
 }finally{
  if(admin&&user){
   const current=await admin.auth.admin.getUserById(user.id);need(current.error===null&&current.data.user?.email===email&&current.data.user?.app_metadata?.cluvo_sportlink_setup_proof===nonce,'OWNED_AUTH_CLEANUP_OWNER_REQUIRED');
   if(session)try{await closeSportlinkOperatorSession(admin,session);}catch{}
   const deleted=await admin.auth.admin.deleteUser(user.id);need(deleted.error===null,'OWNED_AUTH_CLEANUP_FAILED');
   need(json('SELECT count(*) FROM auth.users WHERE id='+literal(user.id))===0,'OWNED_AUTH_USER_DELETE_REQUIRED');
  }
  if(baseline)preserve(baseline,snapshot());
 }
 need(proof,'LOCAL_PROVIDER_PROOF_REQUIRED');proof.owned_identity_and_sessions_removed=true;
 proof.test_source_sha256=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
 proof.auth_adapter_sha256=createHash('sha256').update(await readFile(new URL('../scripts/staging-sportlink-setup-auth.mjs',import.meta.url))).digest('hex');
 await writeFile('/tmp/cluvo-sportlink-setup-auth-provider-owned-proof.json',JSON.stringify(proof,null,2)+'\n',{mode:0o600});t.diagnostic(JSON.stringify(proof));
});
