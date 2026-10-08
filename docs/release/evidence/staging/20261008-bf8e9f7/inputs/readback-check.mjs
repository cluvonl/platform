import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=await import('/home/codex/repos/fieldgrid/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs');
const [sha,ciId,deploymentId,artifactDir,remoteEvidence]=process.argv.slice(2);
assert.ok(/^[a-f0-9]{40}$/.test(sha)&&/^\d+$/.test(ciId)&&/^\d+$/.test(deploymentId)&&artifactDir.startsWith('/tmp/cluvo-staging-'));
const out='docs/release/evidence/staging/20261008-'+sha.slice(0,7);
for(const id of [ciId,deploymentId]){const run=JSON.parse(execFileSync('gh',['run','view',id,'--json','status,conclusion,headSha'],{encoding:'utf8'}));assert.equal(run.headSha,sha);assert.equal(run.status,'completed');assert.equal(run.conclusion,'success');}
const manifest=JSON.parse(await readFile(artifactDir+'/release-manifest.json','utf8'));assert.equal(manifest.source_sha,sha);assert.equal(manifest.workflow_run_id,deploymentId);
const files=execFileSync('git',['ls-tree','-r','--name-only',sha,'supabase/migrations'],{encoding:'utf8'}).trim().split('\n').map(p=>p.split('/').at(-1));
assert.deepEqual(manifest.migrations.map(m=>m.file),files);assert.equal(createHash('sha256').update(JSON.stringify(manifest.migrations)).digest('hex'),manifest.migration_manifest_sha256);
for(const m of manifest.migrations)assert.equal(createHash('sha256').update(execFileSync('git',['show',sha+':supabase/migrations/'+m.file])).digest('hex'),m.sha256);
const endpoints=[];
for(const path of ['/api/health/live','/api/health/ready','/api/runtime-config']){const r=await fetch('https://staging.cluvo.nl'+path,{cache:'no-store'});endpoints.push({path,status:r.status,body:await r.json()});}
assert.equal(endpoints[0].body.release,sha);assert.equal(endpoints[0].body.mode,'prototype');assert.equal(endpoints[0].body.environment,'staging');assert.equal(endpoints[0].status,200);assert.equal(endpoints[1].status,503);assert.equal(endpoints[1].body.reason,'APP_MODE_PROTOTYPE');assert.deepEqual(endpoints[2],{path:'/api/runtime-config',status:503,body:{error:'SUPABASE_NOT_CONFIGURED'}});
await mkdir(out,{recursive:true});await writeFile(out+'/release-manifest.json',JSON.stringify(manifest,null,2)+'\n');
const browser=await chromium.launch({headless:true}),captures=[];
try{for(const viewport of [{width:1440,height:1024},{width:390,height:844}]){const page=await browser.newPage({viewport,locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'});await page.goto('https://staging.cluvo.nl');await page.getByRole('heading',{name:/Goedemiddag/}).waitFor();await page.evaluate(()=>document.fonts.ready);const file='prototype-overzicht-'+viewport.width+'x'+viewport.height+'.png';await page.screenshot({path:out+'/'+file,fullPage:true});captures.push({file,viewport,sha256:createHash('sha256').update(await readFile(out+'/'+file)).digest('hex')});await page.close();}}finally{await browser.close();}
const proof={observed_at:new Date().toISOString(),source_sha:sha,url:'https://staging.cluvo.nl',ci:{url:'https://github.com/cluvonl/platform/actions/runs/'+ciId,conclusion:'success'},deployment:{url:'https://github.com/cluvonl/platform/actions/runs/'+deploymentId,conclusion:'success',image:manifest.image,image_digest:manifest.image_digest},mode:'prototype',endpoints,captures,migrations:{artifact_hashes_verified:true,count:manifest.migrations.length,remote_applied_status:'NOT_APPLIED_AT_CREDENTIAL_PREFLIGHT',remote_state_observed_from:'docs/release/evidence/staging/20261007-credentials-b08415f/metadata-results.json',remote_app_tables:0,remote_migrations:0,remote_observation_is_prior_readonly_preflight:true},acceptance:{intermediate_release:true,v1_ready:false,functional_app_on_staging:false,workers_connected:false,staging_rls_privacy_tests:'NOT_EXECUTED',staging_backup_restore:'NOT_EXECUTED'}};
if(remoteEvidence){
 const observed=JSON.parse(await readFile(remoteEvidence,'utf8'));
 assert.equal(observed.source_sha,sha);assert.equal(observed.passed,true);assert.equal(observed.database_mutations,false);
 assert.equal(observed.transport.certificate_and_hostname_verified,true);assert.equal(observed.applied_prefix,0);
 assert.equal(observed.pending_migrations,16);assert.equal(observed.fresh_source_status,'SOURCE_UNCHANGED');
 assert.equal(observed.migration_manifest_sha256,manifest.migration_manifest_sha256);
 proof.migrations={artifact_hashes_verified:true,count:manifest.migrations.length,
  remote_applied_status:'NOT_APPLIED_AT_SNAPSHOT_CAPTURE',remote_state_observed_from:remoteEvidence,
  remote_observed_at:observed.observed_at,remote_snapshot_source_sha:observed.source_sha,remote_snapshot_same_release:true,
  remote_app_tables:0,remote_migrations:observed.applied_prefix,remote_app_schema_absence_basis:'ENFORCED_COLLECTOR_STAGE0_LAYOUT',
  remote_observation_before_deployment:true,remote_snapshot_fresh_source_unchanged:true};
}

await writeFile(out+'/readback.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({release:sha,mode:'prototype',readback:'PASS',functional_app_verified:false,migration_hashes:manifest.migrations.length,captures:2}));
