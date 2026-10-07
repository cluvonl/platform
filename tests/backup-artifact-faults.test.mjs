import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);

test('isolated FIFO and filesystem failure probes preserve private cleanup boundaries',async()=>{
 const result=await execute(process.execPath,[new URL('./helpers/backup-artifact-faults.mjs',import.meta.url).pathname],{
  env:{PATH:'/usr/bin:/bin'},timeout:30000,maxBuffer:100000,encoding:'utf8',
 });
 assert.equal(result.stderr,'');const report=JSON.parse(result.stdout);
 assert.equal(report.scope,'SYNTHETIC_FILESYSTEM_ONLY');assert.equal(report.executed_probes,8);assert.equal(report.actual_passed_probes,8);
 assert.ok(report.results.every(r=>r.pass===true));assert.equal(report.database_calls,0);assert.equal(report.docker_calls,0);assert.equal(report.remote_calls,0);
 assert.equal(report.existing_backup_reads,0);assert.equal(report.synthetic_worker_key_material_printed,false);
});
