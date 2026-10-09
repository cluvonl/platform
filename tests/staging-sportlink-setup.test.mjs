import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildStagingSportlinkSetup,SPORTLINK_SETUP_SCOPE,sportlinkSetupPrivateRecipe} from '../scripts/staging-sportlink-setup-sql.mjs';
import {createExistingSportlinkOperatorSession,closeSportlinkOperatorSession} from '../scripts/staging-sportlink-setup-auth.mjs';
import {sportlinkSetupContext,assertSportlinkSetupPublicBody} from '../scripts/staging-sportlink-setup.mjs';

const input={recipient:'owned-contract@example.test',sourceSha:'a'.repeat(40),workflowRunId:'123',actor:'owned-contract',expectedVersion:0};
function provider(){
 const id=randomUUID(),sid=randomUUID(),access=randomBytes(32).toString('hex'),refresh=randomBytes(24).toString('hex'),calls=[];
 const user={id,email:input.recipient,email_confirmed_at:new Date().toISOString(),is_anonymous:false};
 const admin={auth:{admin:{getUserById:async uid=>{calls.push(['getUserById',uid]);return {data:{user},error:null};},
  generateLink:async params=>{calls.push(['generateLink',params]);return {data:{user,properties:{verification_type:'recovery',hashed_token:randomBytes(32).toString('hex')}},error:null};},
  signOut:async(_token,scope)=>{calls.push(['signOut',scope]);return {error:null};}}}};
 const client={auth:{verifyOtp:async params=>{calls.push(['verifyOtp',params.type]);return {data:{user,session:{access_token:access,refresh_token:refresh}},error:null};},
  getUser:async()=>({data:{user},error:null}),getClaims:async()=>({data:{claims:{sub:id,role:'authenticated',session_id:sid,iss:'https://fbozlbgmktkgcdfqdaaz.supabase.co/auth/v1',exp:Math.floor(Date.now()/1000)+3600}},error:null})}};
 return {id,sid,calls,user,admin,client};
}
test('fixed operational recipe has no ClientID, native Auth writes, generic grant target or account-profile writes',()=>{
 const v=buildStagingSportlinkSetup(input);assert.equal(v.parameters.length,4);assert.deepEqual(v.parameters,[input.recipient,input.sourceSha,input.workflowRunId,input.actor]);
 assert.doesNotMatch(v.mutationSql,/INSERT INTO auth\.|UPDATE auth\.|DELETE FROM auth\.|INSERT INTO app\.account_profiles|UPDATE app\.account_profiles|ClientID|client_id/i);
 assert.match(v.mutationSql,/ARRAY\['match\.import'\]::text\[\]/);assert.match(v.mutationSql,/ends_at=starts_at\+interval '1 year'/);
 assert.match(v.mutationSql,/beneficiary_auth_user_used_as_fk/);assert.match(v.mutationSql,/native_session_claimed',false/);
 assert.equal(SPORTLINK_SETUP_SCOPE.slug,'duindorp-sv-staging');assert.notEqual(SPORTLINK_SETUP_SCOPE.tenant,'c1000000-0000-4000-8000-000000000001');
 assert.throws(()=>buildStagingSportlinkSetup({...input,clientId:'forbidden'}));
});
test('operational input rejects accessors, unexpected fields, non-string values and wrong expected version',()=>{
 const getter={...input};Object.defineProperty(getter,'recipient',{get(){throw Error('getter must not run');}});assert.throws(()=>buildStagingSportlinkSetup(getter),/INPUT_INVALID/);
 for(const value of [{...input,sourceSha:123},{...input,actor:null},{...input,expectedVersion:1},{...input,recipient:'x\n@example.test'},{...input,workflowRunId:123}])assert.throws(()=>buildStagingSportlinkSetup(value),/INPUT_INVALID/);
 assert.throws(()=>sportlinkSetupPrivateRecipe({operation:'arbitrary_sql',recipient:input.recipient,sourceSha:input.sourceSha,workflowRunId:input.workflowRunId,actor:input.actor,authUserId:null,sessionId:null}));
});
test('staging context refuses production, different repository/ref/event/project and missing designated account',()=>{
 const env={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:input.sourceSha,
  RELEASE_SHA:input.sourceSha,GITHUB_RUN_ID:input.workflowRunId,GITHUB_ACTOR:input.actor,STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',STAGING_TEST_RECIPIENT:input.recipient};
 assert.equal(sportlinkSetupContext(env).sourceSha,input.sourceSha);
 for(const [k,v]of [['APP_ENV','production'],['GITHUB_REF','refs/heads/main'],['GITHUB_EVENT_NAME','push'],['SUPABASE_URL','https://other.example'],['STAGING_TEST_RECIPIENT','']])assert.throws(()=>sportlinkSetupContext({...env,[k]:v}));
});
test('existing-only recovery creates actual-authority boundary before return and cleanup is explicit local scope',async()=>{
 const p=provider();let verified=false;
 const session=await createExistingSportlinkOperatorSession({admin:p.admin,client:p.client,recipient:input.recipient,authUserId:p.id,projectUrl:'https://fbozlbgmktkgcdfqdaaz.supabase.co',verifyNativeSession:async(uid,sid)=>{assert.equal(uid,p.id);assert.equal(sid,p.sid);verified=true;}});
 assert.equal(verified,true);assert.equal(session.authUserId,p.id);assert.deepEqual(p.calls.find(c=>c[0]==='generateLink')[1],{type:'recovery',email:input.recipient});
 assert.deepEqual(p.calls.find(c=>c[0]==='verifyOtp'),['verifyOtp','recovery']);
 await closeSportlinkOperatorSession(p.admin,session);assert.deepEqual(p.calls.at(-1),['signOut','local']);
});
test('unknown, unconfirmed and foreign generated identities never proceed to native operator authority',async()=>{
 for(const change of ['missing','unconfirmed','foreign']){
  const p=provider();let verified=false;
  if(change==='missing')p.admin.auth.admin.getUserById=async()=>({data:{user:null},error:null});
  if(change==='unconfirmed')p.user.email_confirmed_at=null;
  if(change==='foreign')p.admin.auth.admin.generateLink=async()=>({data:{user:{...p.user,id:randomUUID()},properties:{verification_type:'recovery',hashed_token:randomBytes(32).toString('hex')}},error:null});
  await assert.rejects(createExistingSportlinkOperatorSession({admin:p.admin,client:p.client,recipient:input.recipient,authUserId:p.id,projectUrl:'https://fbozlbgmktkgcdfqdaaz.supabase.co',verifyNativeSession:async()=>{verified=true;}}),/AUTH_REFUSED/);
  assert.equal(verified,false);assert.ok(!p.calls.some(c=>c[0]==='verifyOtp'));
 }
});
test('post-issuance native refusal closes only the newly issued session',async()=>{
 const p=provider();await assert.rejects(createExistingSportlinkOperatorSession({admin:p.admin,client:p.client,recipient:input.recipient,authUserId:p.id,projectUrl:'https://fbozlbgmktkgcdfqdaaz.supabase.co',verifyNativeSession:async()=>{throw Error('native refusal');}}),/AUTH_REFUSED/);
 assert.deepEqual(p.calls.at(-1),['signOut','local']);
});
test('private response values are rejected instead of appearing in public body/report',()=>{
 const sentinel=randomBytes(24).toString('hex');assert.doesNotThrow(()=>assertSportlinkSetupPublicBody('safe state',[sentinel]));
 assert.throws(()=>assertSportlinkSetupPublicBody('unsafe '+sentinel,[sentinel]),/PRIVATE_DATA_LEAK/);
});
test('workflow is manual, no credential dispatch fields, hosted runner, read-only token and gated before secret ingestion',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/staging-sportlink-setup.yml',import.meta.url),'utf8');
 assert.match(yaml,/workflow_dispatch:\s*\n\npermissions:/);assert.doesNotMatch(yaml,/inputs:|schedule:|self-hosted|INVITATION_TOKEN_SECRET|secrets: write|secrets\.SENDGRID/);
 assert.match(yaml,/runs-on: ubuntu-24\.04/);assert.match(yaml,/contents: read\s+actions: read/);
 assert.ok(yaml.indexOf('TESTED_ACTIVE_RELEASE_PASS')<yaml.indexOf('STAGING_SPORTLINK_SETUP_CLIENT_ID:'));
 assert.match(yaml,/cancel-in-progress: false/);assert.match(yaml,/environment: staging/);
});
