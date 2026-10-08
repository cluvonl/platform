import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

test('private libpq results enforce row, column, cell, command, JSON byte and processing time budgets', () => {
  const result = spawnSync('/usr/bin/python3', ['-B', 'tests/helpers/staging-session-result-tests.py'], {
    env: {PATH: '/usr/bin:/bin', LANG: 'C.UTF-8'}, encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Ran 14 tests/);
  assert.match(result.stderr, /\bOK\b/);
});
