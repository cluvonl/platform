import assert from 'node:assert/strict';

export async function knowledgeRouteProof(page,origin,path,environment,forbidden=[]) {
  const response=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response?.status(),200,'KNOWLEDGE_AUTHORIZED_ROUTE_REQUIRED');
  assert.equal(new URL(page.url()).pathname,new URL(origin+path).pathname,'KNOWLEDGE_ROUTE_REQUIRED');
  const html=await response.text();
  for(const value of forbidden)assert.ok(!html.includes(value),'KNOWLEDGE_PRIVATE_BODY_REFUSED');
  const bank=page.locator(`.knowledge-bank[data-knowledge-environment="${environment}"]:visible`);
  const title=bank.locator(':scope > .kb-heading > h1');
  await title.waitFor({state:'visible',timeout:15000});
  assert.equal(await title.count(),1,'KNOWLEDGE_SINGLE_TITLE_REQUIRED');
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'KNOWLEDGE_OVERFLOW_REFUSED');
  assert.match(response.headers()['cache-control']??'',/private/,'KNOWLEDGE_PRIVATE_CACHE_REQUIRED');
  assert.match(response.headers()['cache-control']??'',/no-store/,'KNOWLEDGE_NO_STORE_REQUIRED');
  assert.ok(await title.evaluate(el=>getComputedStyle(el).fontFamily.toLowerCase().includes('inter')),'KNOWLEDGE_STYLE_REQUIRED');
  const body=await bank.innerText();for(const value of forbidden)assert.ok(!body.includes(value),'KNOWLEDGE_PRIVATE_DOM_REFUSED');
  return {environment,status:200,private_cache:true,styled:true,overflow:false};
}

export async function knowledgeDeniedProof(page,origin,path,forbidden=[]) {
  const response=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:45000});
  const html=await response.text();
  // A late server notFound can have a streamed 200 shell. Wait for its actual
  // denial UI instead of interpreting the initial loading shell as authorization.
  if (!/\/login/.test(page.url())) await page.getByRole('heading',{name:'404',exact:true}).waitFor({state:'visible',timeout:15000});
  const body=await page.locator('body').innerText();
  for(const value of forbidden){assert.ok(!html.includes(value),'KNOWLEDGE_DENIAL_BODY_REFUSED');assert.ok(!body.includes(value),'KNOWLEDGE_DENIAL_DOM_REFUSED');}
  assert.equal(await page.locator('.knowledge-bank').count(),0,'KNOWLEDGE_DENIAL_REQUIRED');
  assert.ok(response.status()===404||body.includes('404')||/\/login/.test(page.url()),'KNOWLEDGE_DENIAL_REQUIRED');
  return {denied:true,article_hidden:true};
}
