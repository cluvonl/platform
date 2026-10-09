import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deliverTarget,classifyDelivery,pushEndpointAllowed} from '../scripts/pwa-delivery-provider.mjs';

const target={id:'11111111-1111-4111-8111-111111111111',eligible:true,email:'pwa-delivery@example.test',channel:'email',path:'/app/c/synthetic/notifications'};
const configuration={allowlist:'pwa-delivery@example.test',sendgridKey:'synthetic-not-a-secret',from:'info@cluvo.nl',publicKey:'synthetic-public',privateKey:'synthetic-private'};
test('a transport timeout remains unknown and is never classified as retryable',()=>{
  assert.deepEqual(classifyDelivery('email',null,true),{state:'unknown',providerStatus:null});
  assert.equal(classifyDelivery('email',429).state,'failed');
  assert.equal(classifyDelivery('email',202).state,'sent');
  assert.equal(classifyDelivery('push',410).state,'cancelled');
});
test('inactive or nonallowlisted recipients cause no provider call',async()=>{
  let calls=0;const fetcher=async()=>{calls++;throw new Error('should not send');};
  assert.equal((await deliverTarget({...target,eligible:false},configuration,{fetcher})).state,'cancelled');
  assert.equal((await deliverTarget({...target,email:'outside@example.test'},configuration,{fetcher})).state,'cancelled');
  assert.equal(calls,0);
});
test('SendGrid acceptance sends only a generic same-origin staging link',async()=>{
  const result=await deliverTarget(target,configuration,{fetcher:async(url,request)=>{
    assert.equal(url,'https://api.sendgrid.com/v3/mail/send');assert.equal(request.redirect,'error');
    const body=JSON.parse(request.body);assert.equal(body.personalizations[0].to[0].email,target.email);
    assert.ok(body.content[0].value.includes('https://staging.cluvo.nl/app/c/synthetic/notifications'));
    assert.ok(!body.content[0].value.includes('executor'));
    return new Response(null,{status:202});
  }});assert.equal(result.state,'sent');
});
test('push permits known TLS endpoints and sends no private lockscreen text',async()=>{
  assert.equal(pushEndpointAllowed('https://fcm.googleapis.com/fcm/send/synthetic'),true);
  for(const endpoint of ['http://fcm.googleapis.com/a','https://localhost/a','https://fcm.googleapis.com.attacker.test/a','https://fcm.googleapis.com:444/a','https://user:secret@fcm.googleapis.com/a']) assert.equal(pushEndpointAllowed(endpoint),false);
  const subscription={endpoint:'https://web.push.apple.com/synthetic',keys:{p256dh:'synthetic',auth:'synthetic'}};
  const result=await deliverTarget({...target,channel:'push',subscription},configuration,{push:async(actual,payload,options)=>{
    assert.deepEqual(actual,subscription);assert.deepEqual(JSON.parse(payload),{path:target.path});assert.equal(options.timeout,10000);return {statusCode:201};
  }});assert.equal(result.state,'sent');
});
test('a digest sends only revalidated items from the same club and records its actual request hash',async()=>{
  let requestBody;
  const result=await deliverTarget({...target,source_kind:'daily_digest',digest_items:[
    {title:'Vrije taak',starts_at:'2026-10-16T07:00:00Z',path:'/app/c/synthetic/tasks?task=11111111-1111-4111-8111-111111111111'},
    {title:'Ander dossier',starts_at:'2026-10-16T07:00:00Z',path:'/app/c/other/tasks?task=22222222-2222-4222-8222-222222222222'},
  ]},configuration,{fetcher:async(url,request)=>{requestBody=request.body;return new Response(null,{status:202,headers:{'x-message-id':'actual-synthetic-provider-id'}});}});
  const body=JSON.parse(requestBody);assert.match(body.subject,/staging/);
  assert.match(body.content[0].value,/Vrije taak/);assert.doesNotMatch(body.content[0].value,/Ander dossier/);
  assert.equal(result.bodyHash,createHash('sha256').update(requestBody).digest('hex'));
  assert.equal(result.providerMessageKey,'actual-synthetic-provider-id');assert.equal(result.templateRevision,1);
});
test('an empty revalidated digest makes no provider request',async()=>{
  let calls=0;const result=await deliverTarget({...target,source_kind:'daily_digest',digest_items:[]},configuration,{fetcher:async()=>{calls++;throw Error('should not send');}});
  assert.equal(result.state,'cancelled');assert.equal(calls,0);
});
test('an ambiguous email outcome preserves the hash without inventing a provider receipt',async()=>{
  const result=await deliverTarget(target,configuration,{fetcher:async()=>{throw Error('connection lost after send');}});
  assert.equal(result.state,'unknown');assert.match(result.bodyHash,/^[0-9a-f]{64}$/);assert.equal(result.providerMessageKey,null);
});
test('discarding an unused response body cannot erase an already received provider acceptance',async()=>{
  const result=await deliverTarget(target,configuration,{fetcher:async()=>new Response(new ReadableStream({cancel(){throw Error('late connection failure');}}),{status:202,headers:{'x-message-id':'accepted-test-reference'}})});
  assert.equal(result.state,'sent');assert.equal(result.providerStatus,202);assert.equal(result.providerMessageKey,'accepted-test-reference');
});
