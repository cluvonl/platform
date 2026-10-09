import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../.github/workflows/staging.yml',import.meta.url),'utf8');
const ci=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const jobs=Object.fromEntries([...source.slice(source.indexOf('jobs:\n')+6).matchAll(/^  ([a-z][a-z-]*):\n([\s\S]*?)(?=^  [a-z][a-z-]*:\n|$(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
const condition=job=>job.match(/^    if: (.*)(?:\n((?:      .*\n)*))?/m);
function enabled(name,event='workflow_dispatch',options={}){
 const match=condition(jobs[name]);assert.ok(match);
 const expression=match[1]==='>-'?match[2].trim().replaceAll('\n',' '):match[1];
 return runInNewContext(expression,{github:{repository:'cluvonl/platform',ref:'refs/heads/staging',event_name:event,...options.github},vars:{STAGING_DEPLOY_ENABLED:'true',...options.vars}});
}
function dependencies(name){
 const value=jobs[name].match(/^    needs: (.*)$/m)?.[1];
 return value?value.replace(/[\[\]]/g,'').split(',').map(item=>item.trim()):[];
}
function activate(event,failed=[]){
 const states={};
 for(const name of Object.keys(jobs))states[name]=!enabled(name,event)||dependencies(name).some(dep=>states[dep]!=='success')?'skipped':failed.includes(name)?'failure':'success';
 return states;
}

test('CI owned lineage proof receives fixed historical Git objects before testing without credential persistence or runtime fetch fallback',async()=>{
 const ciJobs=Object.fromEntries([...ci.slice(ci.indexOf('jobs:\n')+6).matchAll(/^  ([a-z][a-z-]*):\n([\s\S]*?)(?=^  [a-z][a-z-]*:\n|$(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
 for(const name of ['verify','database']){
  const checkout=ciJobs[name].match(/- uses: actions\/checkout@[0-9a-f]{40}[^\n]*\n([\s\S]*?)(?=\n      -)/)?.[1];assert.ok(checkout);
  assert.match(checkout,/fetch-depth: 0/);assert.match(checkout,/persist-credentials: false/);
 }
 assert.match(ciJobs.database,/CLUVO_PWA_UPGRADE_NATIVE_TESTS: owned-pg17/);
 assert.match(ciJobs.database,/node --test tests\/staging-pwa-upgrade-native.test.mjs/);
 assert.match(jobs.build,/fetch-depth: 0/);
 const helper=await readFile(new URL('./helpers/pwa-closed31-upgrade.mjs',import.meta.url),'utf8');
 assert.match(helper,/APPROVED_PWA_PREDECESSOR35.sourceSha|loadClosedUpgrade\(APPROVED_PWA_PREDECESSOR35,pins35\)/);
 assert.match(helper,/\['show',approved.sourceSha\+':scripts\/'\+file\]/);
 assert.doesNotMatch(helper,/\['fetch'|\['pull'|process\.env|process\.argv/);
});

test('the real staging job DAG activates only after a manual exact-source build, additive upgrade and PWA native QA',()=>{
 assert.deepEqual(Object.keys(jobs),['build','database-upgrade','pwa-native-qa','deploy']);
 assert.deepEqual(dependencies('database-upgrade'),['build']);
 assert.deepEqual(dependencies('pwa-native-qa'),['database-upgrade']);
 assert.deepEqual(dependencies('deploy'),['build','database-upgrade','pwa-native-qa']);
 assert.deepEqual(activate('push'),{build:'success','database-upgrade':'skipped','pwa-native-qa':'skipped',deploy:'skipped'});
 assert.equal(activate('workflow_dispatch').deploy,'success');
 for(const failure of ['build','database-upgrade','pwa-native-qa'])assert.equal(activate('workflow_dispatch',[failure]).deploy,'skipped');
 for(const name of Object.keys(jobs))assert.equal(enabled(name,'workflow_dispatch',{github:{repository:'foreign/repository'}}),false);
 assert.equal(enabled('deploy','workflow_dispatch',{vars:{STAGING_DEPLOY_ENABLED:'false'}}),false);
});

test('both actual hosted gates require the same current main SHA and completed successful CI before credentials are used',async()=>{
 const release='a'.repeat(40),green={head_sha:release,head_branch:'main',status:'completed',conclusion:'success'};
 for(const name of ['database-upgrade','pwa-native-qa']){
  const gate=jobs[name].match(/node --input-type=module <<'JS'\n([\s\S]+?)\n\s+JS\n/)?.[1];assert.ok(gate);
  const run=async(main=release,runs=[green])=>await runInNewContext(`(async()=>{${gate}\n})()`,{process:{env:{RELEASE_SHA:release,GH_TOKEN:'synthetic'}},AbortSignal,console:{log(){}},fetch:async url=>({status:200,json:async()=>url.includes('git/ref/')?{object:{sha:main}}:{workflow_runs:runs}})});
  await run();await assert.rejects(run('b'.repeat(40)));await assert.rejects(run(release,[]));
  for(const changed of [{head_sha:'b'.repeat(40)},{head_branch:'staging'},{status:'in_progress'},{conclusion:'failure'}])await assert.rejects(run(release,[{...green,...changed}]));
 }
});

test('private upgrade and provider work remain hosted while runner receives only the immutable broker image/source/run envelope',()=>{
 for(const name of ['database-upgrade','pwa-native-qa'])assert.match(jobs[name],/runs-on: ubuntu-24\.04\n    environment: staging/);
 assert.match(jobs['database-upgrade'],/PWA_UPGRADE_APPLY_MIGRATIONS: 'true'/);
 assert.match(jobs['database-upgrade'],/uses: \.\/\.github\/actions\/staging-pwa-upgrade/);
 assert.match(jobs['pwa-native-qa'],/run: node scripts\/staging-pwa-native-qa\.mjs/);
 const runner=jobs.deploy.replace(/^\s*#.*$/gm,'');
 assert.match(runner,/runs-on: \[self-hosted, Linux, X64, cluvo-staging-deploy\]/);
 assert.doesNotMatch(runner,/secrets\.|uses:|npm|git |curl|SUPABASE_|MIGRATION_|INVITATION_|SENDGRID_|VAPID_/);
 assert.deepEqual([...runner.matchAll(/^          ([A-Z_]+): /gm)].map(match=>match[1]),['CLUVO_IMAGE','CLUVO_SOURCE_SHA','CLUVO_RUN_ID']);
 assert.match(runner,/sudo --non-interactive \\\n            \/usr\/local\/sbin\/cluvo-deploy-staging \\\n            "\$CLUVO_IMAGE" \\\n            "\$CLUVO_SOURCE_SHA" \\\n            "\$CLUVO_RUN_ID"/);
 assert.match(jobs.build,/staging_sha.*!=.*RELEASE_SHA/s);
 assert.match(jobs.build,/git merge-base --is-ancestor/);
 assert.match(jobs.build,/org\.opencontainers\.image\.revision=\$SOURCE_SHA/);
 assert.match(jobs.build,/RepoDigests 0/);
 assert.match(source,/group: cluvo-staging\n  cancel-in-progress: false/);
});
