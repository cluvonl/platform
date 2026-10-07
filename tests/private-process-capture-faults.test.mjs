import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);

test('isolated process and filesystem fault probes enforce rejection and honest cleanup',async()=>{
 const result=await execute(process.execPath,[new URL('./helpers/private-process-capture-faults.mjs',import.meta.url).pathname],{
  env:{PATH:'/usr/bin:/bin'},timeout:30000,maxBuffer:100000,encoding:'utf8',
 });
 assert.equal(result.stderr,'');const report=JSON.parse(result.stdout);
 assert.equal(report.scope,'SYNTHETIC_FILESYSTEM_AND_OWN_CHILDREN_ONLY');assert.equal(report.executed_probes,21);
 assert.equal(report.actual_expected_controls_passed,21);assert.equal(report.actual_confirmed_defects,0);
 assert.equal(report.database_calls,0);assert.equal(report.docker_calls,0);assert.equal(report.remote_calls,0);
 assert.equal(report.existing_private_backup_reads,0);assert.equal(report.credential_values_used_or_printed,false);
});
