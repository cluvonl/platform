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
  assert.deepEqual(report.event_counts,{delivered:1}); assert.equal(report.candidate_mailbox_delivery_reported,true);
  assert.equal(report.delivery_status,'UNKNOWN');assert.equal(report.original_send_message_binding_verified,false);
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
    assert.equal(report.candidate_delivery_status,messages.length?'AMBIGUOUS_MATCH':'NO_MATCH_OBSERVED');
  }
});

test('failed or foreign detail cannot leave a positive delivery finding in the report',async()=>{
  for (const detail of [new Response('private error',{status:403}),Response.json({...item,to_email:'foreign@example.invalid',events:[]})]) {
    let calls=0;
    const report=await stagingMailStatus(environment,{...options,fetcher:async()=>++calls===1?Response.json({messages:[item]}):detail});
    assert.equal(report.passed,false);assert.equal(report.delivery_status,'UNKNOWN');
    assert.equal(report.candidate_delivery_status,'UNKNOWN');assert.equal(report.candidate_mailbox_delivery_reported,false);
    assert.equal(report.original_send_message_binding_verified,false);assert.equal(calls,2);
  }
});

test('private failure reasons become fixed categories and credits only a boolean without account mutations',async()=>{
  for (const creditsResponse of [Response.json({remain:0,total:100,private_account:'private'}),new Response('private quota body',{status:403})]) {
    const requests=[];const candidate={...item,status:'not_delivered'};
    const report=await stagingMailStatus(environment,{...options,fetcher:async(url,input)=>{
      requests.push({url:String(url),input});
      if (requests.length===1) return Response.json({messages:[candidate]});
      if (requests.length===2) return Response.json({...candidate,events:[
        {event_name:'dropped',reason:'Maximum credits exceeded '+item.to_email},
        {event_name:'private-event-name',reason:'unclassified private token'},
      ]});
      return creditsResponse;
    }});
    assert.equal(requests.length,3);assert.ok(requests.every(({input})=>input.method==='GET'&&!input.body));
    assert.equal(requests[2].url,'https://api.sendgrid.com/v3/user/credits');
    assert.deepEqual(report.candidate_reason_categories,['CREDIT_LIMIT_REPORTED','UNCLASSIFIED_PRIVATE_REASON']);
    assert.equal(report.unclassified_event_count,1);assert.equal(report.private_reason_count,2);
    assert.equal(report.delivery_status,'UNKNOWN');assert.equal(report.email_sent,false);assert.equal(report.provider_mutations,false);
    assert.equal(report.credit_check.available,creditsResponse.status===200);
    if (creditsResponse.status===200) assert.equal(report.credit_check.balance_positive,false);
    for (const value of ['private token','private-event-name',item.to_email,'private quota body','private_account']) assert.ok(!JSON.stringify(report).includes(value));
  }
});

test('recipient mailbox quota and private address substrings cannot become account or sender failures',async()=>{
  let calls=0;const candidate={...item,status:'not_delivered'};
  const report=await stagingMailStatus(environment,{...options,fetcher:async()=>{
    calls++;
    if (calls===1) return Response.json({messages:[candidate]});
    if (calls===2) return Response.json({...candidate,events:[
      {event_name:'bounced',reason:'Recipient mailbox quota exceeded'},
      {event_name:'bounced',reason:'Unknown recipient dkim_user@example.invalid'},
    ]});
    return Response.json({remain:10});
  }});
  assert.equal(report.passed,true);assert.equal(report.credit_check.balance_positive,true);
  assert.ok(!report.candidate_reason_categories.includes('CREDIT_LIMIT_REPORTED'));
  assert.ok(!report.candidate_reason_categories.includes('SENDER_AUTHENTICATION_REPORTED'));
  assert.ok(!JSON.stringify(report).includes('dkim_user'));
});

test('sender authentication failure inspects only fixed domain booleans without exposing generated records',async()=>{
  const requests=[]; const candidate={...item,status:'not_delivered'};
  const report=await stagingMailStatus({...environment,SENDGRID_FROM_EMAIL:'info@cluvo.nl'},{...options,fetcher:async(url,input)=>{
    requests.push({url:String(url),input});
    if(requests.length===1) return Response.json({messages:[{...candidate,from_email:'info@cluvo.nl'}]});
    if(requests.length===2) return Response.json({...candidate,from_email:'info@cluvo.nl',events:[{event_name:'bounced',reason:'Unauthenticated sender: DKIM failed'}]});
    if(requests.length===3) return Response.json({remain:10});
    return Response.json([{domain:'cluvo.nl',valid:false,automatic_security:true,id:987654,username:'private-account',
      dns:{dkim1:{valid:false,host:'private-selector.cluvo.nl',data:'private-target.sendgrid.net'},dkim2:{valid:true}}}]);
  }});
  assert.equal(requests.length,4); assert.ok(requests.every(({input})=>input.method==='GET'&&!input.body));
  assert.match(requests[3].url,/^https:\/\/api\.sendgrid\.com\/v3\/whitelabel\/domains\?domain=cluvo.nl&/);
  assert.equal(report.sender_domain_check.provider_valid,false);
  assert.deepEqual(report.sender_domain_check.dns_record_status,{dkim1:false,dkim2:true});
  assert.equal(report.sender_domain_check.validation_is_cached_provider_metadata,true);
  for(const value of ['987654','private-account','private-selector','private-target']) assert.ok(!JSON.stringify(report).includes(value));
});

test('unavailable domain metadata preserves activity and partial pages never prove a domain absent',async()=>{
  const candidate={...item,from_email:'info@cluvo.nl',status:'not_delivered'};
  for(const response of [new Response('private domain body',{status:403}),Response.json(Array.from({length:5},()=>({domain:'other.example.invalid',valid:true})))]){
    let calls=0;
    const report=await stagingMailStatus({...environment,SENDGRID_FROM_EMAIL:'info@cluvo.nl'},{...options,fetcher:async()=>{
      calls++;
      if(calls===1)return Response.json({messages:[candidate]});
      if(calls===2)return Response.json({...candidate,events:[{event_name:'bounced',reason:'Unauthenticated sender'}]});
      if(calls===3)return Response.json({remain:10});
      return response;
    }});
    assert.equal(report.passed,true);assert.equal(report.candidate_delivery_status,'not_delivered');
    assert.equal(report.delivery_status,'UNKNOWN');assert.equal(report.provider_mutations,false);
    if(response.status===200){assert.equal(report.sender_domain_check.exact_domain_matches,0);assert.equal(report.sender_domain_check.filtered_page_complete,false);}
    else assert.equal(report.sender_domain_check.available,false);
    for(const value of ['private domain body','other.example.invalid'])assert.ok(!JSON.stringify(report).includes(value));
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
