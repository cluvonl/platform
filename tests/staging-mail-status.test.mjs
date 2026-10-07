import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingMailStatus} from '../scripts/staging-mail-status.mjs';

const environment = {APP_ENV:'staging',GITHUB_REPOSITORY:'cluvonl/platform',GITHUB_REF:'refs/heads/staging',
  RELEASE_SHA:'a'.repeat(40),STAGING_SUPABASE_PROJECT_REF:'fbozlbgmktkgcdfqdaaz',
  SUPABASE_URL:'https://fbozlbgmktkgcdfqdaaz.supabase.co',STAGING_TEST_RECIPIENT:'test@example.invalid',
  MAIL_ALLOWLIST:'test@example.invalid',SENDGRID_FROM_EMAIL:'sender@example.invalid',SENDGRID_API_KEY:'SG.test.synthetic'};
const proof = {source_sha:'9bd1cc19a398086b2177304870eb53c04e1d3db9',workflow_run_id:'37591201027',
  provider_status:202,send_outcome:'ACCEPTED',passed:true,observed_at:'2026-10-07T08:03:18.137Z'};
const now = new Date('2026-10-07T08:10:00Z');
const item = {to_email:environment.STAGING_TEST_RECIPIENT,from_email:environment.SENDGRID_FROM_EMAIL,
  subject:'Cluvo — testmail voor staging',status:'delivered',last_event_time:'2026-10-07T08:03:18Z',msg_id:'synthetic.message-1'};
const options = {sendProof:proof,now};

test('status inspection does GET only, exact scoped query and redacted events without a receipt claim',async()=>{
  const requests=[];
  const report=await stagingMailStatus(environment,{...options,fetcher:async(url,input)=>{
    requests.push({url:String(url),input});
    return Response.json(requests.length===1?{messages:[item]}:{...item,events:[{event_name:'delivered',reason:'private reason '+environment.STAGING_TEST_RECIPIENT},{event_name:'unknown-private'}]});
  }});
  assert.equal(report.passed,true); assert.equal(requests.length,2);
  assert.ok(requests.every(({input})=>input.method==='GET'&&input.redirect==='error'&&!input.body));
  const query=new URL(requests[0].url).searchParams.get('query');
  for(const part of ['to_email="test@example.invalid"','from_email="sender@example.invalid"','subject="Cluvo — testmail voor staging"','BETWEEN TIMESTAMP']) assert.ok(query.includes(part));
  assert.deepEqual(report.event_counts,{delivered:1}); assert.equal(report.mailbox_provider_delivery_reported,true);
  assert.equal(report.actual_delivery_verified,false);assert.equal(report.email_sent,false);
  for(const privateValue of [item.to_email,item.from_email,item.msg_id,'private reason']) assert.ok(!JSON.stringify(report).includes(privateValue));
});

test('denied activity access exports a fixed error, and never sends or retries',async()=>{
  let requests=0;
  const report=await stagingMailStatus(environment,{...options,fetcher:async()=>{requests++;return new Response('private key and recipient',{status:403});}});
  assert.equal(requests,1);assert.equal(report.passed,false);assert.equal(report.error,'SENDGRID_ACTIVITY_READ_DENIED');assert.equal(report.provider_status,403);
  assert.ok(!JSON.stringify(report).includes('private key'));assert.equal(report.email_sent,false);
});

test('wrong target, personal scope or send proof is rejected before network',async()=>{
  for(const changes of [{APP_ENV:'production'},{GITHUB_REF:'refs/heads/main'},{MAIL_ALLOWLIST:'*'},{STAGING_TEST_RECIPIENT:'test@example.invalid\nother@example.invalid'},{SENDGRID_API_KEY:''}]){
    let calls=0;
    const report=await stagingMailStatus({...environment,...changes},{...options,fetcher:()=>{calls++;throw new Error('unexpected request');}});
    assert.equal(report.passed,false);assert.equal(calls,0);
  }
  let calls=0;
  const report=await stagingMailStatus(environment,{...options,sendProof:{...proof,workflow_run_id:'0'},fetcher:()=>{calls++;throw new Error('unexpected request');}});
  assert.equal(report.error,'ACCEPTED_TEST_SEND_PROOF_REQUIRED');assert.equal(calls,0);
});

test('no match and multiple matches cannot prove delivery of the original mail',async()=>{
  for(const messages of [[],[item,item]]){
    let calls=0;const report=await stagingMailStatus(environment,{...options,fetcher:async()=>{calls++;return Response.json({messages});}});
    assert.equal(report.passed,true);assert.equal(report.actual_delivery_verified,false);assert.equal(calls,1);
    assert.equal(report.delivery_status,messages.length?'AMBIGUOUS_MATCH':'NO_MATCH_OBSERVED');
  }
});

test('foreign records, private transport errors and oversized payloads fail without exporting details',async()=>{
  for(const fetcher of [async()=>Response.json({messages:[{...item,to_email:'foreign@example.invalid'}]}),async()=>{throw new Error('private '+item.to_email);},async()=>new Response('x'.repeat(70_000))]){
    const report=await stagingMailStatus(environment,{...options,fetcher});assert.equal(report.passed,false);
    assert.ok(!JSON.stringify(report).includes(item.to_email));assert.ok(!JSON.stringify(report).includes('foreign@example.invalid'));
  }
  for (const msg_id of ['.', '..']) {
    let calls=0;
    const report=await stagingMailStatus(environment,{...options,fetcher:async()=>{calls++;return Response.json({messages:[{...item,msg_id}]});}});
    assert.equal(report.error,'SENDGRID_ACTIVITY_MESSAGE_ID_INVALID');assert.equal(calls,1);
  }
});
