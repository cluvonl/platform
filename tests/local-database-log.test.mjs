import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('local database startup withholds sensitive CLI output on success and failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cluvo-cli-log-'));
  try {
    for (const code of [0, 1]) {
      await writeFile(join(directory, 'npx'), `#!/bin/sh\nprintf 'sensitive-status-probe\\n'\nprintf 'sensitive-error-probe\\n' >&2\nexit ${code}\n`, {mode: 0o700});
      const result = spawnSync(process.execPath, ['scripts/start-local-database.mjs'], {encoding: 'utf8', env: {...process.env, PATH: `${directory}:${process.env.PATH}`}});
      assert.equal(result.status, code);
      assert.doesNotMatch(result.stdout + result.stderr, /sensitive-(status|error)-probe/);
    }
  } finally {await rm(directory, {recursive: true, force: true});}
});
