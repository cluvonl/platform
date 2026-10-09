import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deliverTarget} from '../scripts/pwa-delivery-provider.mjs';

const configuration={allowlist:'template@example.test',sendgridKey:'synthetic-not-a-secret',from:'info@cluvo.nl'};
const target={id:'11111111-1111-4111-8111-111111111111',eligible:true,email:'template@example.test',channel:'email',path:'/app/c/synthetic/notifications',source_kind:'template_test',template_test:{subject:'Welkom beste clublid',text:'Jouw goedgekeurde voorbeeldtekst. Nog geen bevestigde minuten.',sender_name:'Cluvo',reply_to:'info@cluvo.nl',revision:4,preheader:'Een heldere voorvertoning',button_label:'Open je Cluvo-inbox',image_path:'/brand/cluvo-logo.png'}};

test('template provider request sends the rendered version and receipts its exact bytes',async()=>{
 let requestBody;
 const result=await deliverTarget(target,configuration,{fetcher:async(url,request)=>{
  assert.equal(url,'https://api.sendgrid.com/v3/mail/send');requestBody=request.body;
  const body=JSON.parse(request.body);assert.equal(body.subject,'Cluvo staging — Welkom beste clublid');
  assert.equal(body.personalizations.length,1);assert.deepEqual(body.personalizations[0].to,[{email:'template@example.test'}]);
  assert.deepEqual(body.reply_to,{email:'info@cluvo.nl'});assert.ok(body.content[0].value.includes(target.template_test.text));assert.equal(body.content[1].type,'text/html');assert.ok(body.content[1].value.includes('Een heldere voorvertoning'));assert.ok(body.content[1].value.includes('https://staging.cluvo.nl/brand/cluvo-logo.png'));assert.ok(body.content[1].value.includes('Open je Cluvo-inbox'));
  return new Response(null,{status:202,headers:{'x-message-id':'synthetic-native-template-receipt'}});
 }});
 assert.equal(result.state,'sent');assert.equal(result.templateRevision,4);
 assert.equal(result.bodyHash,createHash('sha256').update(requestBody).digest('hex'));
 assert.equal(result.providerMessageKey,'synthetic-native-template-receipt');
});
test('malformed template headers and unknown recipients cause no external call',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw new Error('must not send');};
 for(const altered of [{...target,email:'outside@example.test'},{...target,template_test:{...target.template_test,image_path:'https://outside.example/tracker.png'}},{...target,template_test:{...target.template_test,subject:'Bad\r\nBcc: other@example.test'}},{...target,template_test:{...target.template_test,revision:0}},{...target,template_test:{...target.template_test,reply_to:'info@cluvo.nl\r\nBcc: other@example.test'}}])assert.equal((await deliverTarget(altered,configuration,{fetcher})).state,'cancelled');
 assert.equal(calls,0);
});
test('template transport failure retains the actual revision and an unknown outcome without retry',async()=>{
 let calls=0;const result=await deliverTarget(target,configuration,{fetcher:async()=>{calls++;throw new Error('synthetic connection lost after submission');}});
 assert.equal(calls,1);assert.equal(result.state,'unknown');assert.equal(result.templateRevision,4);assert.match(result.bodyHash,/^[a-f0-9]{64}$/);
});

test('template HTML escapes text and labels rather than interpreting markup',async()=>{await deliverTarget({...target,template_test:{...target.template_test,text:'<script>alert(1)</script>',button_label:'<b>Ga verder</b>'}},configuration,{fetcher:async(_url,request)=>{const html=JSON.parse(request.body).content[1].value;assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;b&gt;Ga verder&lt;/b&gt;'));return new Response(null,{status:202});}});});
