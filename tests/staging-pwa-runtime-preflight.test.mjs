import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {runtimeConfigurationInputs,verifyRuntimePromotion,stagingPwaRuntimePreflight,runtimeReadOnlyPreflightSQL} from '../scripts/staging-pwa-runtime-preflight.mjs';

const release='a'.repeat(40),active='b'.repeat(40),project='fbozlbgmktkgcdfqdaaz';
const environment={APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:release,
 RELEASE_SHA:release,EXPECTED_ACTIVE_SOURCE_SHA:active,EXPECTED_CONFIG_VERSION:'2',COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([active,release]),GH_TOKEN:'synthetic-github-token',
 APP_URL:'https://staging.cluvo.nl',STAGING_SUPABASE_PROJECT_REF:project,SUPABASE_URL:'https://'+project+'.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',
 MIGRATION_DATABASE_URL:'postgresql://postgres:synthetic%24database%23password@db.'+project+'.supabase.co:5432/postgres?sslmode=require',
 SUPABASE_SECRET_KEY:'synthetic-private-server-key',INVITATION_TOKEN_SECRET:'synthetic-private-invitation-key',MAIL_ALLOWLIST:'synthetic-private@example.test',SENDGRID_API_KEY:'synthetic-private-provider-key',NODE_OPTIONS:'--inspect',PGOPTIONS:'unsafe-inherited-options'};
const green={head_sha:release,head_branch:'main',status:'completed',conclusion:'success'};
const database={scope:'STAGING_PWA_RUNTIME_READONLY41',migration_count:41,app_tables:191,forced_rls_tables:191,native_guarded_tables:191,api_only:true,
 command_owner_restricted:true,database_role_superuser:false,transaction_read_only:true,database_mutations:false,email_sent:false,production_enabled:false};
const response=(status,value)=>({status,json:async()=>value});
function fetcher(options={},calls=[]){return async(url,request)=>{
 calls.push({url,request});
 if(url.startsWith('https://api.github.com/')){
  assert.equal(request.headers.Authorization,'Bearer '+environment.GH_TOKEN);
  if(url.includes('git/ref/heads/main'))return response(200,{object:{sha:options.main??release}});
  if(url.includes('git/ref/heads/staging'))return response(200,{object:{sha:options.staging??release}});
  if(url.includes('actions/workflows/ci.yml/runs'))return response(200,{workflow_runs:options.runs??[green]});
  throw Error('unexpected public source query');
 }
 assert.equal(new URL(url).origin,environment.SUPABASE_URL);
 assert.equal(request.headers.apikey,environment.SUPABASE_PUBLISHABLE_KEY);
 assert.equal(request.headers.Authorization,undefined);
 if(url.endsWith('/auth/v1/settings'))return response(200,options.auth??{external:{email:true},mailer_autoconfirm:false});
 assert.equal(new URL(url).pathname,'/rest/v1/public_tenants');
 assert.equal(new URL(url).search,'?select=tenant_id&limit=0');
 if(request.headers['Accept-Profile']==='api')return response(200,[]);
 return options.exposePrivate?response(200,[]):response(406,{code:'PGRST106'});
};}
const execution=metadata=>({status:0,stdout:'You are connected to database "postgres".\nSSL connection (protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384)\n'+JSON.stringify(metadata??database)+'\n',stderr:''});
function redacted(report){
 const encoded=JSON.stringify(report);
 for(const key of ['GH_TOKEN','MIGRATION_DATABASE_URL','SUPABASE_SECRET_KEY','INVITATION_TOKEN_SECRET','MAIL_ALLOWLIST','SENDGRID_API_KEY'])assert.ok(!encoded.includes(environment[key]));
 assert.ok(!encoded.includes('synthetic$database#password'));
}

test('runtime inputs bind the existing version, both compatible sources and a manual exact staging release without getters',()=>{
 const result=runtimeConfigurationInputs(environment);assert.deepEqual(result.rollback,[active,release]);assert.ok(Object.isFrozen(result));
 for(const changed of [{APP_ENV:'production'},{GITHUB_REPOSITORY:'foreign/platform'},{GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:active},
  {EXPECTED_ACTIVE_SOURCE_SHA:'unsafe'},{EXPECTED_CONFIG_VERSION:'1'},{EXPECTED_CONFIG_VERSION:'02'},{EXPECTED_CONFIG_VERSION:'1000000'},
  {COMPATIBLE_ROLLBACK_SHAS:'not-json'},{COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([release])},{COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([active])},
  {COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([active,release,release])},{COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([active,release,'c'.repeat(40)])}])assert.throws(()=>runtimeConfigurationInputs({...environment,...changed}));
 let invoked=false;const accessor={...environment};Object.defineProperty(accessor,'EXPECTED_CONFIG_VERSION',{get(){invoked=true;return'2';}});
 assert.throws(()=>runtimeConfigurationInputs(accessor));assert.equal(invoked,false);
});

test('configuration version3 accepts the active hosted35 source and exact new release without certifying an app rollback',()=>{
 const hosted35='9ae1d3b0cefb0fb6f19c586b6dcfd611131366ef';
 const result=runtimeConfigurationInputs({...environment,EXPECTED_ACTIVE_SOURCE_SHA:hosted35,EXPECTED_CONFIG_VERSION:'3',
  COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([hosted35,release])});
 assert.equal(result.EXPECTED_CONFIG_VERSION,'3');assert.deepEqual(result.rollback,[hosted35,release]);
 assert.throws(()=>runtimeConfigurationInputs({...environment,EXPECTED_ACTIVE_SOURCE_SHA:hosted35,EXPECTED_CONFIG_VERSION:'3',
  COMPATIBLE_ROLLBACK_SHAS:JSON.stringify([hosted35,release,'6029b482c06669aa37806d3aa90f70b59e6ccfd4'])}));
});

test('actual release verifier rejects either moving branch and every incomplete or failed CI state',async()=>{
 await verifyRuntimePromotion(environment,fetcher());
 for(const options of [{main:active},{staging:active},{runs:[]},...['head_sha','head_branch','status','conclusion'].map(key=>({runs:[{...green,[key]:{head_sha:active,head_branch:'staging',status:'in_progress',conclusion:'failure'}[key]}]}))])await assert.rejects(verifyRuntimePromotion(environment,fetcher(options)),/PWA_RUNTIME_TESTED_RELEASE_REQUIRED/);
});

test('a failed CI gate never reads private runtime/DB inputs, source bytes or starts a process',async()=>{
 const value={...environment};let touched=false;
 for(const key of ['MIGRATION_DATABASE_URL','SUPABASE_SECRET_KEY','INVITATION_TOKEN_SECRET','MAIL_ALLOWLIST'])Object.defineProperty(value,key,{get(){touched=true;throw Error('must not read');}});
 const report=await stagingPwaRuntimePreflight(value,{fetcher:fetcher({runs:[{...green,conclusion:'failure'}]}),readSource:async()=>{touched=true;throw Error('must not read');},execute:async()=>{touched=true;throw Error('must not execute');}});
 assert.equal(report.passed,false);assert.equal(report.error,'PWA_RUNTIME_TESTED_RELEASE_REQUIRED');assert.equal(touched,false);redacted(report);
});

test('actual readonly preflight validates all41 source bytes and a minimal verified-TLS process, with only zero-row public API probes',async()=>{
 const calls=[];let processes=0;
 const report=await stagingPwaRuntimePreflight(environment,{fetcher:fetcher({},calls),execute:async(command,args,options)=>{
  processes++;assert.equal(command,'psql');assert.deepEqual(args,['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set','ON_ERROR_STOP=1']);
  assert.equal(options.input,'\\conninfo\n'+runtimeReadOnlyPreflightSQL());assert.equal(options.timeout,30000);
  assert.equal(options.env.PGSSLMODE,'verify-full');assert.equal(options.env.PGUSER,'postgres');assert.equal(options.env.PGPASSWORD,'synthetic$database#password');
  assert.equal(options.env.PGHOST,'db.'+project+'.supabase.co');assert.match(options.env.PGOPTIONS,/default_transaction_read_only=on/);
  assert.deepEqual(Object.keys(options.env).sort(),['PATH','LANG','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT','PGAPPNAME','PGOPTIONS'].sort());
  assert.ok(!JSON.stringify(args).includes(options.env.PGPASSWORD));return execution();
 }});
 assert.equal(report.passed,true);assert.equal(processes,1);assert.equal(report.database.transaction_read_only,true);
 assert.equal(report.migration_manifest_sha256,'50b9d494b967681b5a88b8e1e15480ddc0966394a1a51b2e916dedc25efb6173');
 assert.equal(calls.filter(call=>call.url.includes('supabase.co')).length,4);assert.ok(calls.every(call=>!call.request.method||call.request.method==='GET'));redacted(report);
});

test('foreign origin/project/database and changed source bytes fail before any DB process or public Auth request',async()=>{
 for(const changed of [{APP_URL:'https://www.cluvo.nl'},{STAGING_SUPABASE_PROJECT_REF:'z'.repeat(20)},{SUPABASE_URL:'https://foreign.supabase.co'},
  {SUPABASE_PUBLISHABLE_KEY:'sb_secret_wrong'},{MIGRATION_DATABASE_URL:environment.MIGRATION_DATABASE_URL.replace(project,'z'.repeat(20))}]){
  let executed=false;const calls=[];const report=await stagingPwaRuntimePreflight({...environment,...changed},{fetcher:fetcher({},calls),execute:async()=>{executed=true;return execution();}});
  assert.equal(report.passed,false);assert.equal(executed,false);assert.equal(calls.filter(call=>call.url.includes('supabase.co')).length,0);redacted(report);
 }
 let executed=false;const report=await stagingPwaRuntimePreflight(environment,{fetcher:fetcher(),readSource:async path=>{
  const original=await readFile(path);return String(path).endsWith('_pwa_automation.sql')?Buffer.concat([original,Buffer.from('\n-- changed')]):original;
 },execute:async()=>{executed=true;return execution();}});
 assert.equal(report.passed,false);assert.equal(executed,false);redacted(report);
});

test('wrong roles/schema/readback and private-schema exposure are refused with redacted diagnostics',async()=>{
 const badResults=[{status:1,stdout:'synthetic-private-server-key',stderr:environment.MIGRATION_DATABASE_URL},
  execution({...database,command_owner_restricted:false}),execution({...database,database_role_superuser:true}),execution({...database,transaction_read_only:false}),
  execution({...database,native_guarded_tables:169}),execution({...database,migration_count:23}),execution({...database,migration_count:32}),execution({...database,private:'synthetic-private-server-key'}),
  {...execution(),stdout:JSON.stringify(database)+'\n'},{...execution(),stdout:execution().stdout+JSON.stringify(database)+'\n'}];
 for(const result of badResults){const report=await stagingPwaRuntimePreflight(environment,{fetcher:fetcher(),execute:async()=>result});assert.equal(report.passed,false);redacted(report);}
 for(const options of [{exposePrivate:true},{auth:{external:{email:true},mailer_autoconfirm:true}},{auth:{external:{email:false},mailer_autoconfirm:false}}]){
  const report=await stagingPwaRuntimePreflight(environment,{fetcher:fetcher(options),execute:async()=>execution()});assert.equal(report.passed,false);redacted(report);
 }
});

const workflow=await readFile(new URL('../.github/workflows/staging-pwa-configure-app.yml',import.meta.url),'utf8');
const originalWorkflow=await readFile(new URL('../.github/workflows/staging-configure-app.yml',import.meta.url),'utf8');
const jobs=Object.fromEntries([...workflow.slice(workflow.indexOf('jobs:\n')+6).matchAll(/^  ([a-z][a-z_]*):\n([\s\S]*?)(?=^  [a-z][a-z_]*:\n|$(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
const python=source=>source.match(/^          import json\n([\s\S]*?)^          PY$/m)?.[0].replace(/^          /gm,'').replace(/\nPY$/,'');

test('new real workflow DAG makes configuration conditional on hosted readonly success and exact staging activation',()=>{
 assert.deepEqual(Object.keys(jobs),['verify_database','configure']);assert.match(jobs.configure,/needs: verify_database/);
 const condition=name=>{const match=jobs[name].match(/^    if: (.*)(?:\n((?:      .*\n)*))?/m);return match[1]==='>-'?match[2].trim().replaceAll('\n',' '):match[1];};
 const run=(values={},failed=false)=>{
  const context={github:{repository:'cluvonl/platform',ref:'refs/heads/staging',event_name:'workflow_dispatch',...values.github},vars:{STAGING_DEPLOY_ENABLED:'true',...values.vars}};
  const verified=runInNewContext(condition('verify_database'),context)&&!failed;
  return verified&&runInNewContext(condition('configure'),context);
 };
 assert.equal(run(),true);assert.equal(run({},true),false);
 for(const github of [{repository:'foreign/platform'},{ref:'refs/heads/main'},{event_name:'push'}])assert.equal(run({github}),false);
 assert.equal(run({vars:{STAGING_DEPLOY_ENABLED:'false'}}),false);
 assert.match(jobs.verify_database,/runs-on: ubuntu-24\.04\n    environment: staging/);assert.match(workflow,/group: cluvo-staging\n  cancel-in-progress: false/);
 const before=jobs.verify_database.slice(0,jobs.verify_database.indexOf('--verify-release'));
 assert.doesNotMatch(before,/secrets\.|SUPABASE_|MIGRATION_DATABASE_URL/);
 assert.doesNotMatch(jobs.verify_database,/SUPABASE_SECRET_KEY|INVITATION_TOKEN_SECRET|MAIL_ALLOWLIST|SENDGRID|VAPID/);
 assert.doesNotMatch(jobs.configure.replace(/^\s*#.*$/gm,''),/MIGRATION_DATABASE_URL|uses:|checkout|npm |curl |psql|git /);
 assert.match(jobs.configure,/\/usr\/local\/sbin\/cluvo-import-staging-config "\$CONFIG_SOURCE_SHA" "\$CONFIG_RUN_ID"/);
});

test('new workflow executes the unchanged isolated env-to-stdin payload, preserving CAS/source/actor compatibility and refusing malformed input',()=>{
 const script=python(workflow);assert.ok(script);assert.equal(script,python(originalWorkflow));
 const value={EXPECTED_CONFIG_VERSION:'2',COMPATIBLE_ROLLBACK_SHAS:environment.COMPATIBLE_ROLLBACK_SHAS,CONFIG_SOURCE_SHA:release,CONFIG_RUN_ID:'9000',CONFIG_ACTOR:'synthetic-operator',
  EXPECTED_SOURCE_SHA:active,SUPABASE_URL:environment.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:environment.SUPABASE_PUBLISHABLE_KEY,SUPABASE_SECRET_KEY:environment.SUPABASE_SECRET_KEY,
  INVITATION_TOKEN_SECRET:environment.INVITATION_TOKEN_SECRET,MAIL_ALLOWLIST:environment.MAIL_ALLOWLIST};
 const invoke=changed=>spawnSync('/usr/bin/python3',['-I','-c',script],{env:{...value,...changed},encoding:'utf8',timeout:3000});
 const result=invoke({});assert.equal(result.status,0,result.stderr);const payload=JSON.parse(result.stdout);
 assert.equal(payload.format,'cluvo-staging-runtime-config-v1');assert.equal(payload.source_sha,release);assert.equal(payload.expected_source_sha,active);
 assert.equal(payload.expected_config_version,2);assert.deepEqual(payload.compatible_rollback_shas,[active,release]);assert.equal(payload.project_ref,project);
 assert.equal(payload.actor,'synthetic-operator');assert.equal(payload.workflow_run_id,'9000');assert.equal(payload.invitation_token_secret,value.INVITATION_TOKEN_SECRET);
 for(const changed of [{EXPECTED_CONFIG_VERSION:'02'},{COMPATIBLE_ROLLBACK_SHAS:'{}'},{COMPATIBLE_ROLLBACK_SHAS:'["malformed"]'},{SUPABASE_SECRET_KEY:'x'.repeat(33000)}]){
  const failure=invoke(changed);assert.equal(failure.status,1);assert.equal(failure.stdout,'');assert.equal(failure.stderr,'STAGING_RUNTIME_INPUT_INVALID\n');
 }
});
