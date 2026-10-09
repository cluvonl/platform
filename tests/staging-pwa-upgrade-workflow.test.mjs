import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {deriveInitialBackupKey,encryptedArtifactName,readbackInitialArtifact} from '../scripts/staging-pwa-upgrade-backup-custody.mjs';
import {deriveInitialBackupKey as deriveOriginalKey} from '../scripts/staging-initial-backup-custody.mjs';
import {stagingPwaUpgrade} from '../scripts/staging-pwa-upgrade.mjs';

const workflow=await readFile(new URL('../.github/workflows/staging-pwa-upgrade.yml',import.meta.url),'utf8');
const gate=workflow.match(/node --input-type=module <<'JS'\n([\s\S]+?)\n\s+JS\n/)?.[1];
assert.ok(gate);
const release='a'.repeat(40),success={head_sha:release,head_branch:'main',status:'completed',conclusion:'success'};
async function checkGate({main=release,runs=[success],status=200}={}){
 const calls=[],logs=[];
 await runInNewContext(`(async()=>{${gate}\n})()`,{process:{env:{RELEASE_SHA:release,GH_TOKEN:'synthetic-token'}},AbortSignal,
  console:{log:value=>logs.push(value)},fetch:async(url,options)=>{
   calls.push({url,options});return {status,json:async()=>url.includes('git/ref/')?{object:{sha:main}}:{workflow_runs:runs}};
  }});
 return {calls,logs};
}

test('actual promotion gate requires exact current main SHA and its completed green CI run',async()=>{
 const {calls,logs}=await checkGate();assert.equal(calls.length,2);assert.deepEqual(logs,['STAGING_TESTED_RELEASE_PASS']);
 for(const call of calls){assert.equal(call.options.redirect,'error');assert.ok(call.options.signal instanceof AbortSignal);}
 for(const value of [{main:'b'.repeat(40)},{runs:[]},{runs:[{...success,head_sha:'b'.repeat(40)}]},
  {runs:[{...success,head_branch:'staging'}]},{runs:[{...success,status:'in_progress'}]},
  {runs:[{...success,conclusion:'failure'}]},{status:403}])await assert.rejects(checkGate(value));
});

test('encrypted additive custody is isolated from original16 and binds the actual remote archive receipt',async()=>{
 const root='synthetic-existing-invitation-root'.repeat(2),key=deriveInitialBackupKey(root),original=deriveOriginalKey(root);
 assert.equal(key.length,32);assert.notDeepEqual(key,original);key.fill(0);original.fill(0);
 const name=encryptedArtifactName(release,'123','1');assert.ok(name.startsWith('cluvo-staging-pwa-upgrade-encrypted-'));
 const environment={GITHUB_SHA:release,GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SERVER_URL:'https://github.com',GITHUB_TOKEN:'synthetic-token'};
 const output=Buffer.from('artifact-id=456\nartifact-url=https://github.com/cluvonl/platform/actions/runs/123/artifacts/456\nartifact-digest='+'b'.repeat(64)+'\n');
 const remote={id:456,name,expired:false,size_in_bytes:100,digest:'sha256:'+'b'.repeat(64),workflow_run:{id:123,head_sha:release}};
 const read=async value=>await readbackInitialArtifact(output,environment,{fetcher:async()=>({status:200,json:async()=>value})});
 assert.deepEqual(await read(remote),{remote_readback:true,artifact_id:'456',archive_sha256:'b'.repeat(64)});
 for(const change of [{name:'foreign-artifact'},{digest:'sha256:'+'c'.repeat(64)},{workflow_run:{id:124,head_sha:release}},{expired:true}])await assert.rejects(read({...remote,...change}));
});

test('production and missing execution authorization fail before toolchain, connection or mutation',async()=>{
 for(const environment of [{APP_ENV:'production'},{APP_ENV:'staging'}]){
  const report=await stagingPwaUpgrade(environment);
  assert.equal(report.passed,false);assert.equal(report.database_mutations_performed,false);assert.equal(report.applied_migrations,0);
  assert.equal(report.production_enabled,false);assert.equal(report.private_values_exported,false);
  assert.equal(Object.hasOwn(report,'pg17_toolchain'),false);assert.equal(Object.hasOwn(report,'backup_custody'),false);
 }
});
