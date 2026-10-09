// Load only the previously committed pure renderer into a temporary directory.
// This helper never connects to a database or accepts arbitrary source code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {APPROVED_PWA_PREDECESSOR31,APPROVED_PWA_PREDECESSOR35} from '../../scripts/staging-pwa-upgrade-migrations.mjs';

const pins=Object.freeze({
 'staging-pwa-upgrade-migrations.mjs':'f3806ede75794d7c1bebe9960eccba38cb6439add629557018d154d63f85c8a7',
 'staging-pwa-upgrade-files.mjs':'d0e103f5e99ec06daef466089492abe7e4a834383716b7808e16fbb8f2b03f4b',
 'staging-initial-migrations.mjs':'7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004',
 'staging-migration-files.mjs':'83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd',
});
const pins35=Object.freeze({
 'staging-pwa-upgrade-migrations.mjs':'9cb88a31b773a04f161ed5ec3a92506833eeb6f57c2802a45b8a268ea1840a77',
 'staging-pwa-upgrade-files.mjs':'198c5ba8dd2483500db097260a71b91b02263ea565df24d7b55686c2aa8b196c',
 'staging-initial-migrations.mjs':'7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004',
 'staging-migration-files.mjs':'83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd',
});
async function loadClosedUpgrade(approved,sourcePins){
 const directory=await mkdtemp(join(tmpdir(),'cluvo-pwa-closed-renderer-'));
 try{
  for(const [file,expected]of Object.entries(sourcePins)){
   const result=spawnSync('git',['show',approved.sourceSha+':scripts/'+file],
    {cwd:new URL('../../',import.meta.url),env:{PATH:'/usr/bin:/bin'},maxBuffer:250000,timeout:15000});
   assert.equal(result.status,0,'CLOSED31_RENDERER_UNAVAILABLE');
   assert.equal(createHash('sha256').update(result.stdout).digest('hex'),expected,'CLOSED31_RENDERER_BYTES_CHANGED');
   await writeFile(join(directory,file),result.stdout);
  }
  return await import(pathToFileURL(join(directory,'staging-pwa-upgrade-migrations.mjs')).href);
 }finally{await rm(directory,{recursive:true,force:true});}
}
export const loadClosed31Upgrade=()=>loadClosedUpgrade(APPROVED_PWA_PREDECESSOR31,pins);
export const loadClosed35Upgrade=()=>loadClosedUpgrade(APPROVED_PWA_PREDECESSOR35,pins35);
