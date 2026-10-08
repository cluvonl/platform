import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import('/home/codex/repos/fieldgrid/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs');
const [sha]=process.argv.slice(2);
assert.match(sha,/^[a-f0-9]{40}$/);
const origin='https://staging.cluvo.nl';
const output='docs/release/evidence/staging/20261008-'+sha.slice(0,7);
const parent=JSON.parse(await readFile(output+'/readback.json','utf8'));
assert.equal(parent.source_sha,sha);
assert.equal(parent.ci.conclusion,'success');assert.equal(parent.deployment.conclusion,'success');
const live=await fetch(origin+'/api/health/live',{cache:'no-store'}).then(r=>r.json());
assert.equal(live.release,sha);assert.equal(live.mode,'prototype');
const browser=await chromium.launch({headless:true}),captures=[];
try{
 for(const viewport of [{width:1440,height:1024},{width:390,height:844}]){
  const page=await browser.newPage({viewport,locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'});
  let posts=0,hydration=0;
  page.on('request',r=>{if(r.method()==='POST')posts++;});
  page.on('console',m=>{if(/hydration|hydrated|didn't match/i.test(m.text()))hydration++;});
  await page.goto(origin+'/auth/verify');
  await page.getByRole('heading',{name:'Vul je code in'}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const input=page.getByLabel('Eenmalige code');
  assert.equal(await input.getAttribute('maxlength'),'10');
  assert.equal(await input.getAttribute('minlength'),'6');
  for(const token of ['000006','00000008','0000000000']){
   await input.fill(token);assert.equal(await input.inputValue(),token);
   assert.equal(await input.evaluate(el=>el.checkValidity()),true);
  }
  for(const token of ['00000','0000000x']){
   await input.fill(token);assert.equal(await input.evaluate(el=>el.checkValidity()),false);
  }
  await input.fill('');
  assert.equal(await page.locator('body').innerText().then(t=>t.includes('zescijferige')),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  assert.equal(posts,0);assert.equal(hydration,0);
  const file='otp-form-'+viewport.width+'x'+viewport.height+'.png';
  await page.screenshot({path:output+'/'+file,fullPage:true});
  captures.push({file,viewport,sha256:createHash('sha256').update(await readFile(output+'/'+file)).digest('hex'),
   six_eight_and_ten_digits_intact:true,leading_zeroes_preserved:true,short_and_non_numeric_input_invalid:true,
   max_length:10,min_length:6,mobile_overflow_absent:true,hydration_errors:hydration,post_requests_observed:posts,
   synthetic_input_only:true,otp_value_exported:false});
  await page.close();
 }
 const result={observed_at:new Date().toISOString(),scope:'STAGING_FORM_PRESENTATION_ONLY',environment:'staging',
  source_sha:sha,observed_release:live.release,app_mode:'prototype',captures,
  actual_user_code_used:false,native_provider_request_executed:false,native_session_verified:false,
  app_login_verified:false,ddl_requested:false,v1_ready:false,production_enabled:false};
 await writeFile(output+'/otp-form-results.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({source_sha:sha,staging_form_checks:'PASS',viewports:2,actual_auth_requests:0,actual_user_code_used:false}));
}finally{await browser.close();}
