import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeStagingRelease} from '../scripts/staging-pwa-release-health.mjs';

const release='a'.repeat(40);
const live={status:'ok',service:'cluvo',mode:'app',environment:'staging',release};
const ready={ready:true,scope:'authenticated_core',checks:{database:'reachable',authorization:'rls_api'}};
const response=value=>({status:200,json:async()=>value});

test('the active staging image must match before and after native readiness without sending credentials',async()=>{
  const calls=[];
  assert.equal(await activeStagingRelease(release,async(url,options)=>{
    calls.push(url);
    assert.equal(new URL(url).origin,'https://staging.cluvo.nl');
    assert.deepEqual(options.headers,{Accept:'application/json'});
    assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    return response(url.endsWith('/ready')?ready:live);
  }),true);
  assert.deepEqual(calls.map(url=>new URL(url).pathname),['/api/health/live','/api/health/ready','/api/health/live']);
});

test('an old, foreign, prototype or unready image and a changing release cannot activate delivery',async()=>{
  for(const changed of [{release:'b'.repeat(40)},{environment:'production'},{mode:'prototype'},{service:'other'},{status:'starting'}])
    assert.equal(await activeStagingRelease(release,async()=>response({...live,...changed})),false);
  for(const changed of [{ready:false},{scope:'other'},{checks:{database:'unavailable',authorization:'rls_api'}},{checks:{database:'reachable',authorization:'demo_only'}}])
    assert.equal(await activeStagingRelease(release,async url=>response(url.endsWith('/ready')?{...ready,...changed}:live)),false);
  let liveCalls=0;
  assert.equal(await activeStagingRelease(release,async url=>response(url.endsWith('/ready')?ready:{...live,release:++liveCalls===1?release:'b'.repeat(40)})),false);
});

test('invalid release, unavailable HTTP, malformed JSON and redirect/network rejection all fail closed',async()=>{
  assert.equal(await activeStagingRelease('staging',()=>{throw Error('must not call');}),false);
  for(const fetcher of [async()=>({status:503}),async()=>({status:200,json:async()=>{throw Error('invalid json');}}),async()=>{throw Error('redirect or transport failure');}])
    assert.equal(await activeStagingRelease(release,fetcher),false);
});
