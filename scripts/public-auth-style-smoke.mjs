import {createHash} from 'node:crypto';
import {access} from 'node:fs/promises';
import {join} from 'node:path';

export const PUBLIC_AUTH_ROUTES=Object.freeze(['/login','/app/login','/app/auth/verify']);
const sha256=value=>createHash('sha256').update(value).digest('hex');
const need=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
const exists=async path=>{try{await access(path);return true;}catch{return false;}};

export async function selectWp0Runtime(root){
 const standalone=(server,build,staticDir)=>({label:'Next.js standalone server',server,buildId:build,staticDir});
 const shipped=standalone(join(root,'server.js'),join(root,'.next','BUILD_ID'),join(root,'.next','static'));
 if(await exists(shipped.server)&&await exists(shipped.buildId)&&await exists(shipped.staticDir))return shipped;
 const next=join(root,'node_modules','next','dist','bin','next'),build=join(root,'.next','BUILD_ID'),staticDir=join(root,'.next','static');
 if(await exists(next)&&await exists(build)&&await exists(staticDir))return {label:'Next.js production server',server:next,buildId:build,staticDir,nextStart:true};
 const nested=standalone(join(root,'.next','standalone','server.js'),join(root,'.next','standalone','.next','BUILD_ID'),join(root,'.next','standalone','.next','static'));
 if(await exists(nested.server)&&await exists(nested.buildId)&&await exists(nested.staticDir))return nested;
 throw Object.assign(new Error('WP0_COMPLETE_BUILD_REQUIRED'),{code:'WP0_COMPLETE_BUILD_REQUIRED'});
}

function attributes(tag){
 return Object.fromEntries([...tag.matchAll(/\b([a-z][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
  .map(match=>[match[1].toLowerCase(),match[2]??match[3]??match[4]]));
}
function hasClass(html,tag,name){
 return [...html.matchAll(new RegExp('<'+tag+'\\b[^>]*>','gi'))].some(match=>(attributes(match[0]).class??'').split(/\s+/).includes(name));
}
export function publicAuthCssRules(css){
 need(typeof css==='string'&&Buffer.byteLength(css)<=3_000_000,'PUBLIC_AUTH_CSS_INVALID');
 const rules=new Map();
 for(const match of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  for(const selector of match[1].split(',').map(value=>value.trim())){
   if(!['body','.auth-screen','.auth-card','.auth-primary'].includes(selector))continue;
   const values=rules.get(selector)??[];
   values.push(Object.fromEntries(match[2].split(';').map(value=>value.split(/:(.*)/s)).filter(parts=>parts.length>=2)
    .map(([key,value])=>[key.trim().toLowerCase(),value.trim().replace(/\s*!important\s*$/i,'')])));
   rules.set(selector,values);
  }
 }
 const matches=(selector,checks)=>(rules.get(selector)??[]).some(values=>Object.entries(checks).every(([property,pattern])=>pattern.test(values[property]??'')));
 return Object.freeze({body:matches('body',{'margin':/^0(?:px)?$/,'font-family':/\bInter\b/i,'background':/^(?:var\(--background\)|#f5f6f7)$/i}),
  auth_screen:matches('.auth-screen',{'display':/^grid$/,'min-height':/^100vh$/,'background':/^#f5f6f7$/i}),
  auth_card:matches('.auth-card',{'background':/^(?:#fff(?:fff)?|white)$/i,'border-radius':/^18px$/,'padding':/^38px$/}),
  auth_primary:matches('.auth-primary',{'background':/^#f45f49$/i,'color':/^(?:#fff(?:fff)?|white)$/i,'border-radius':/^10px$/,'padding':/^14px\s+18px$/})});
}

export async function publicAuthStyleSmoke(origin,{fetcher=fetch,timeoutMs=3000}={}){
 const report={scope:'PUBLIC_AUTH_SSR_LINKED_STYLE_SMOKE_V1',passed:false,routes:[],stylesheets:[],
  authenticated:false,provider_requests_performed:false,private_values_exported:false,production_enabled:false,v1_ready:false};
 try{
  const target=new URL(origin);
  need(target.origin===origin&&!target.username&&!target.password&&(origin==='https://staging.cluvo.nl'
   ||target.protocol==='http:'&&['127.0.0.1','localhost'].includes(target.hostname)&&/^\d+$/.test(target.port)),'PUBLIC_AUTH_TARGET_REFUSED');
  need(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=15000,'PUBLIC_AUTH_TIMEOUT_INVALID');
  const get=path=>fetcher(origin+path,{method:'GET',redirect:'manual',cache:'no-store',credentials:'omit',
   headers:{Accept:path.endsWith('.css')?'text/css':'text/html',Connection:'close'},signal:AbortSignal.timeout(timeoutMs)});
  const cached=new Map();
  for(const path of PUBLIC_AUTH_ROUTES){
   const row={path,passed:false,stylesheets:[]};report.routes.push(row);
   try{
    const response=await get(path);row.status=response.status;
    need(response.status===200,'PUBLIC_AUTH_HTML_HTTP_FAILED');
    need(/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??''),'PUBLIC_AUTH_HTML_TYPE_FAILED');
    const html=await response.text();need(Buffer.byteLength(html)<=4_000_000,'PUBLIC_AUTH_HTML_INVALID');row.html_sha256=sha256(html);
    row.auth_shell=hasClass(html,'main','auth-screen')&&hasClass(html,'div','auth-card')&&/<h1\b[^>]*>/i.test(html);
    row.primary_control=hasClass(html,'button','auth-primary');
    need(row.auth_shell&&row.primary_control,'PUBLIC_AUTH_HTML_SHELL_MISSING');
    for(const match of html.matchAll(/<link\b[^>]*>/gi)){
     const attrs=attributes(match[0]);if(!(attrs.rel??'').split(/\s+/).includes('stylesheet'))continue;
     const asset=new URL(attrs.href??'',origin);
     need(asset.origin===origin&&!asset.search&&!asset.hash&&/^\/_next\/static\/(?:css|chunks)\/[A-Za-z0-9._-]+\.css$/.test(asset.pathname),'PUBLIC_AUTH_CSS_TARGET_REFUSED');
     if(!row.stylesheets.includes(asset.pathname))row.stylesheets.push(asset.pathname);
    }
    need(row.stylesheets.length>0&&row.stylesheets.length<=16,'PUBLIC_AUTH_LINKED_CSS_MISSING');
    const text=[];
    for(const asset of row.stylesheets){
     if(!cached.has(asset)){
      const cssRow={path:asset,passed:false};report.stylesheets.push(cssRow);cached.set(asset,{row:cssRow,text:null});
      const response=await get(asset);cssRow.status=response.status;
      need(response.status===200,'PUBLIC_AUTH_CSS_HTTP_FAILED');
      cssRow.content_type_valid=/^text\/css(?:;|$)/i.test(response.headers.get('content-type')??'');
      need(cssRow.content_type_valid,'PUBLIC_AUTH_CSS_TYPE_FAILED');
      const bytes=await response.text();need(Buffer.byteLength(bytes)>0&&Buffer.byteLength(bytes)<=3_000_000,'PUBLIC_AUTH_CSS_INVALID');
      cssRow.bytes=Buffer.byteLength(bytes);cssRow.sha256=sha256(bytes);cssRow.passed=true;cached.get(asset).text=bytes;
     }
     const saved=cached.get(asset);need(saved.row.passed&&saved.text,'PUBLIC_AUTH_CSS_HTTP_FAILED');text.push(saved.text);
    }
    row.style_rules=publicAuthCssRules(text.join('\n'));
    need(Object.values(row.style_rules).every(Boolean),'PUBLIC_AUTH_STYLE_RULES_MISSING');row.passed=true;
   }catch(error){row.error=['PUBLIC_AUTH_HTML_HTTP_FAILED','PUBLIC_AUTH_HTML_TYPE_FAILED','PUBLIC_AUTH_HTML_INVALID','PUBLIC_AUTH_HTML_SHELL_MISSING',
    'PUBLIC_AUTH_CSS_TARGET_REFUSED','PUBLIC_AUTH_LINKED_CSS_MISSING','PUBLIC_AUTH_CSS_HTTP_FAILED','PUBLIC_AUTH_CSS_TYPE_FAILED',
    'PUBLIC_AUTH_CSS_INVALID','PUBLIC_AUTH_STYLE_RULES_MISSING'].includes(error?.code)?error.code:'PUBLIC_AUTH_READ_UNAVAILABLE';}
  }
  report.passed=report.routes.length===PUBLIC_AUTH_ROUTES.length&&report.routes.every(row=>row.passed);
 }catch{report.error='PUBLIC_AUTH_CONTEXT_REFUSED';}
 return report;
}
