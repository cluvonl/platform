import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {cp,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import('/home/codex/repos/fieldgrid/node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs');
const output='docs/release/evidence/local/20261008-otp-length';
await mkdir(output,{recursive:true});
await cp('public','.next/standalone/public',{recursive:true});
await cp('.next/static','.next/standalone/.next/static',{recursive:true});
const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');
const port=listener.address().port;listener.close();await once(listener,'close');
const origin='http://127.0.0.1:'+port;
const child=spawn(process.execPath,['--import',resolve('scripts/runtime-guard.mjs'),resolve('.next/standalone/server.js')],{
 cwd:process.cwd(),env:{PATH:process.env.PATH,APP_ENV:'local',APP_MODE:'prototype',APP_URL:origin,
 NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:String(port),RELEASE_SHA:'otp-length-local',
 SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_SECRET_KEY:'',MIGRATION_DATABASE_URL:'',BACKUP_DATABASE_URL:''},
 stdio:'ignore'});
const exited=new Promise(r=>child.once('exit',r));
let browser;
const captures=[];
try {
 let live=false;
 for(let i=0;i<100;i++) {
  try{const r=await fetch(origin+'/api/health/live',{signal:AbortSignal.timeout(1000)});if(r.status===200){live=true;break;}}catch{}
  if(child.exitCode!==null)break;
  await new Promise(r=>setTimeout(r,100));
 }
 assert.ok(live,'local guarded prototype server starts');
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:1440,height:1024},{width:390,height:844}]){
  const page=await browser.newPage({viewport,locale:'nl-NL',timezoneId:'Europe/Amsterdam',reducedMotion:'reduce'});
  const hydration=[];
  page.on('console',m=>{if(/hydration|hydrated|didn't match/i.test(m.text()))hydration.push(true);});
  await page.goto(origin+'/auth/verify');
  await page.getByRole('heading',{name:'Vul je code in'}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const input=page.getByLabel('Eenmalige code');
  assert.equal(await input.getAttribute('maxlength'),'10');
  assert.equal(await input.getAttribute('minlength'),'6');
  for(const token of ['000006','00000008','0000000000']){
   await input.fill(token);
   assert.equal(await input.inputValue(),token);
   assert.equal(await input.evaluate(el=>el.checkValidity()),true);
  }
  for(const invalid of ['00000','0000000x']){
   await input.fill(invalid);
   assert.equal(await input.evaluate(el=>el.checkValidity()),false);
  }
  await input.fill('');
  assert.equal(await page.locator('body').innerText().then(t=>t.includes('zescijferige')),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  assert.equal(hydration.length,0);
  const file='otp-form-'+viewport.width+'x'+viewport.height+'.png';
  await page.screenshot({path:output+'/'+file,fullPage:true});
  captures.push({file,viewport,six_eight_and_ten_digits_intact:true,leading_zeroes_preserved:true,
   short_and_non_numeric_input_invalid:true,max_length:10,min_length:6,
   mobile_overflow_absent:true,hydration_errors:0,synthetic_input_only:true,otp_value_exported:false});
  await page.close();
 }
 const result={observed_at:new Date().toISOString(),scope:'LOCAL_FORM_PRESENTATION_ONLY',environment:'local',app_mode:'prototype',
  captures,native_provider_request_executed:false,actual_user_code_used:false,native_session_verified:false,
  app_login_verified:false,ddl_requested:false,v1_ready:false,production_enabled:false};
 await writeFile(output+'/browser-results.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({browser_checks:'PASS',viewports:2,actual_auth_requests:0,actual_user_code_used:false}));
}finally{
 await browser?.close();
 child.kill('SIGTERM');
 await Promise.race([exited,new Promise(r=>setTimeout(r,5000))]);
 if(child.exitCode===null){child.kill('SIGKILL');await exited;}
}
