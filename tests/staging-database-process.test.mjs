import test from 'node:test';
import assert from 'node:assert/strict';
import {executeDatabaseProcess} from '../scripts/staging-database-process.mjs';

const run = (source, overrides = {}) => executeDatabaseProcess(process.execPath, ['-e', source], {
  env:{PATH:process.env.PATH, LANG:'C.UTF-8'}, input:'', timeout:5_000, maxBuffer:10_000, ...overrides,
});

test('database subprocess leaves the event loop available and captures complete UTF-8 output', async () => {
  let completed = false;
  const pending = run("process.stdout.write('{\"value\":\"'); process.stdout.write(Buffer.from([0xc3])); setTimeout(() => process.stdout.end(Buffer.from([0xa9,0xc3,0xa9,0x6e,0x22,0x7d])), 150);")
    .then((result) => {completed = true; return result;});
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(completed, false, 'an independent timer runs before database completion');
  const result = await pending;
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {value:'één'});
});

test('a descendant retaining pipes cannot extend the timeout beyond the kill grace', async () => {
  const started = Date.now();
  const source = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setTimeout(() => {}, 2500);'],{stdio:['ignore',process.stdout,process.stderr]}); child.unref(); process.exit(0);";
  const result = await run(source, {timeout:200});
  assert.equal(result.error, true);
  assert.equal(result.stdout, '');
  assert.ok(Date.now() - started < 2_200, 'failure settles before the descendant closes its pipes');
});

test('timeout and excess stdout or stderr terminate the child and discard incomplete output', async () => {
  for (const pending of [run('setInterval(() => {}, 100);', {timeout:50}),
    run("process.stdout.write('x'.repeat(30_000));", {maxBuffer:1_000}),
    run("process.stderr.write('x'.repeat(30_000));", {maxBuffer:1_000})]) {
    const result = await pending;
    assert.equal(result.error, true);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.length <= 1_000);
  }
});

test('private child diagnostics remain data for caller redaction and are never logged by the adapter', async () => {
  const result = await run("process.stderr.end('PRIVATE_CONTRACT_MARKER'); process.exitCode=1;");
  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'PRIVATE_CONTRACT_MARKER');
  assert.equal(result.stdout, '');
});

test('missing executable completes through a bounded error result', async () => {
  const result = await executeDatabaseProcess('/cluvo-contract/nonexistent', [], {
    env:{PATH:'/usr/bin'}, input:'', timeout:100, maxBuffer:1_000,
  });
  assert.equal(result.status, null);
  assert.equal(result.error, true);
  assert.equal(result.stdout, '');
});

test('an early reader fails by default and succeeds only with explicit opt-in and a zero exit', async () => {
  const input = Buffer.alloc(16 * 1024 * 1024, 65);
  const source = "process.stdout.end('SELECTIVE_READER_COMPLETE');";
  const strict = await run(source, {input});
  assert.equal(strict.error, true);
  assert.equal(strict.stdout, '');
  const selected = await run(source, {input, allowEarlyInputClose:true});
  assert.equal(selected.status, 0);
  assert.equal(selected.error, undefined);
  assert.equal(selected.inputClosedEarly, true);
  assert.equal(selected.stdout, 'SELECTIVE_READER_COMPLETE');
  const failed = await run("process.stderr.end('CONTROLLED_READER_FAILURE'); process.exitCode=3;", {input, allowEarlyInputClose:true});
  assert.equal(failed.status, 3);
  assert.equal(failed.error, true);
  assert.equal(failed.stdout, '');
  assert.equal(failed.stderr, 'CONTROLLED_READER_FAILURE');
});

test('early-input opt-in preserves timeout and output limits', async () => {
  for (const pending of [run('setInterval(() => {}, 100);', {timeout:50, allowEarlyInputClose:true}),
    run("process.stdout.end('x'.repeat(30_000));", {maxBuffer:1_000, allowEarlyInputClose:true}),
    run("process.stderr.end('x'.repeat(30_000));", {maxBuffer:1_000, allowEarlyInputClose:true})]) {
    const result = await pending;
    assert.equal(result.error, true);
    assert.equal(result.stdout, '');
  }
});
