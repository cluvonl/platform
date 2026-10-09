import test from 'node:test';
import assert from 'node:assert/strict';
import {adminBootstrapInputs,verifyAdminBootstrapRelease,stagingAdminBootstrap,FIRST_PLATFORM_PERMISSIONS} from '../scripts/staging-admin-bootstrap.mjs';
const release='a'.repeat(40);
const input={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:release,RELEASE_SHA:release,GITHUB_RUN_ID:'123',GITHUB_ACTOR:'owned-test',BOOTSTRAP_ACCOUNT_EMAIL:'approved@example.test',CONFIRM_PLATFORM_MANDATE:'true',GH_TOKEN:'synthetic-github',STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic-private@db.fbozlbgmktkgcdfqdaaz.supabase.co:5432/postgres'};
const response=value=>({status:200,json:async()=>value});
const fetcher=async url=>{
 if(url.endsWith('git/ref/heads/main')||url.endsWith('git/ref/heads/staging'))return response({object:{sha:release}});
 if(url.includes('actions/workflows/ci.yml/runs'))return response({workflow_runs:[{head_sha:release,head_branch:'main',status:'completed',conclusion:'success'}]});
 if(url.endsWith('/api/health/live'))return response({status:'ok',service:'cluvo',mode:'app',environment:'staging',release});
 if(url.endsWith('/api/health/ready'))return response({ready:true,scope:'authenticated_core',checks:{database:'reachable',authorization:'rls_api'}});
 throw Error('unexpected request');
};
test('first mandate requires a manual fixed staging context and explicit personal identity choice',()=>{
 assert.equal(FIRST_PLATFORM_PERMISSIONS.length,8);
 assert.ok(FIRST_PLATFORM_PERMISSIONS.every(key=>key.startsWith('platform.')));
 assert.equal(adminBootstrapInputs(input).BOOTSTRAP_ACCOUNT_EMAIL,'approved@example.test');
 for(const changed of [{CONFIRM_PLATFORM_MANDATE:'false'},{APP_ENV:'production'},{GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'push'},{GITHUB_REPOSITORY:'foreign/platform'},{GITHUB_SHA:'b'.repeat(40)},{BOOTSTRAP_ACCOUNT_EMAIL:'x\n@example.test'},{GITHUB_ACTOR:'$(unsafe)'}])assert.throws(()=>adminBootstrapInputs({...input,...changed}));
 let invoked=false;const value={...input};Object.defineProperty(value,'BOOTSTRAP_ACCOUNT_EMAIL',{get(){invoked=true;return 'unsafe';}});assert.throws(()=>adminBootstrapInputs(value));assert.equal(invoked,false);
});
test('failed CI or inactive staging refuses provisioning before reading the management credential',async()=>{
 await verifyAdminBootstrapRelease(input,fetcher);
 for(const failed of ['ci','active']){
  let touched=false;const value={...input};Object.defineProperty(value,'MIGRATION_DATABASE_URL',{get(){touched=true;throw Error('private');}});
  const result=await stagingAdminBootstrap(value,{fetcher:async url=>url.includes(failed==='ci'?'actions/workflows/ci.yml/runs':'/api/health/live')?response({}):fetcher(url),execute:async()=>{touched=true;throw Error('process');}});
  assert.equal(result.passed,false);assert.equal(touched,false);assert.equal(result.error,'ADMIN_BOOTSTRAP_ACTIVE_TESTED_RELEASE_REQUIRED');
 }
});
test('management process is certificate verified, carries credentials only in its isolated environment and redacts failure',async()=>{
 let called=false;
 const result=await stagingAdminBootstrap(input,{fetcher,execute:async(command,args,options)=>{
  called=true;assert.equal(command,'psql');assert.ok(!args.some(arg=>arg.includes('synthetic-private')));assert.equal(options.env.PGSSLMODE,'verify-full');assert.equal(options.env.PGPASSWORD,'synthetic-private');assert.equal(options.env.NODE_OPTIONS,undefined);
  return {status:1,stdout:'',stderr:'synthetic-private approved@example.test arbitrary private database diagnostic'};
 }});
 assert.equal(called,true);assert.equal(result.passed,false);assert.equal(result.error,'ADMIN_BOOTSTRAP_TRANSACTION_REFUSED');assert.ok(!JSON.stringify(result).includes('synthetic-private'));assert.ok(!JSON.stringify(result).includes('approved@example.test'));
});
