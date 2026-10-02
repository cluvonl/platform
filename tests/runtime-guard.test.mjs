import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const run=(environment,mode='prototype')=>spawnSync(process.execPath,['scripts/runtime-guard.mjs'],{env:{...process.env,APP_ENV:environment,APP_MODE:mode},encoding:'utf8'});
test('production wordt voor serverstart geweigerd',()=>{const r=run('production');assert.notEqual(r.status,0);assert.match(r.stderr,/production blijft geblokkeerd/)});
test('niet-geimplementeerde appmodus wordt geweigerd',()=>{const r=run('staging','app');assert.notEqual(r.status,0);assert.match(r.stderr,/prototype-UI/)});
test('alleen bekende prototypeomgevingen worden geaccepteerd',()=>{for(const e of ['local','staging','test'])assert.equal(run(e).status,0);assert.notEqual(run('unknown').status,0)});
