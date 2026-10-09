import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const {getPathMatch} = require('next/dist/shared/lib/router/utils/path-match');
const manifest = JSON.parse(await readFile(new URL('../public/app/manifest.webmanifest', import.meta.url), 'utf8'));

test('install identity and start stay in app scope without a tenant, account or temporary token', () => {
  const base = new URL('https://staging.example.invalid');
  for (const field of ['id', 'start_url', 'scope']) {
    const value = new URL(manifest[field], base);
    assert.equal(value.origin, base.origin);
    assert.equal(value.pathname, '/app/');
    assert.equal(value.search, '');
    assert.equal(value.hash, '');
  }
  assert.equal(manifest.display, 'standalone');
});

test('actual raster assets are correctly sized, opaque, and maskable mark fits the central safe circle', async () => {
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['icon-maskable-512.png', 512]]) {
    const bytes = await readFile(new URL(`../public/app/icons/${name}`, import.meta.url));
    const {data, info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    let foreground = 0;
    for (let i = 0; i < data.length; i += 4) {
      assert.equal(data[i + 3], 255);
      // Ignore the one-level dark antialiasing of the SVG background; test
      // the visible Cluvo mark against the maskable central safe circle.
      if (name.startsWith('icon-maskable') && Math.max(Math.abs(data[i] - 17), Math.abs(data[i + 1] - 19), Math.abs(data[i + 2] - 20)) > 3) {
        const pixel = i / 4, x = pixel % size, y = Math.floor(pixel / size);
        assert.ok(Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) <= size * .4);
        foreground++;
      }
    }
    if (name.startsWith('icon-maskable')) assert.ok(foreground > 1000);
  }
});

test('actual Next header rules keep private mobile routes no-store and revalidate public worker and manifest', async () => {
  const source = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  const testModule = {exports: {}};
  runInNewContext(compiled, {module: testModule, exports: testModule.exports,process:{env:{NODE_ENV:'production'}}});
  assert.equal(testModule.exports.default.allowedDevOrigins,undefined);
  const devModule={exports:{}};runInNewContext(compiled,{module:devModule,exports:devModule.exports,process:{env:{NODE_ENV:'development'}}});
  assert.deepEqual(Array.from(devModule.exports.default.allowedDevOrigins),['127.0.0.1']);
  const config = testModule.exports.default;
  assert.equal(config.skipTrailingSlashRedirect, true);
  const rules = await config.headers();
  const effective = path => {
    const result = new Headers();
    for (const rule of rules) if (getPathMatch(rule.source)(path)) for (const header of rule.headers) result.set(header.key, header.value);
    return result;
  };
  for (const path of ['/app/login', '/app/auth/verify', '/app/workspaces', '/app/c/synthetic/profile', '/app/invite/accept']) {
    assert.equal(effective(path).get('cache-control'), 'private, no-store');
    assert.equal(effective(path).get('x-robots-tag'), 'noindex, nofollow');
  }
  const worker = effective('/app/sw.js');
  assert.equal(worker.get('content-type'), 'application/javascript; charset=utf-8');
  assert.equal(worker.get('cache-control'), 'no-cache, no-store, must-revalidate');
  assert.equal(worker.get('service-worker-allowed'), '/app/');
  assert.equal(effective('/app/manifest.webmanifest').get('content-type'), 'application/manifest+json; charset=utf-8');
  assert.equal(effective('/app/manifest.webmanifest').get('cache-control'), 'public, max-age=0, must-revalidate');
});
