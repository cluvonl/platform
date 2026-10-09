import webpush from 'web-push';
import {createHash} from 'node:crypto';
import {isAllowedMailRecipient} from '../lib/domain/mail-recipient.mjs';

export function pushEndpointAllowed(value) {
  try {
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash
      && ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname);
  } catch {return false;}
}
export function classifyDelivery(channel,status,transportFailure=false) {
  if (transportFailure) return {state:'unknown',providerStatus:null};
  if ((channel==='email'&&status===202)||(channel==='push'&&[201,202].includes(status))) return {state:'sent',providerStatus:status};
  if (status===429||(channel==='push'&&[500,502,503,504].includes(status))) return {state:'failed',providerStatus:status};
  return {state:'cancelled',providerStatus:Number.isInteger(status)&&status>=100&&status<=599?status:null};
}
export async function deliverTarget(target,configuration,{fetcher=fetch,push=webpush.sendNotification.bind(webpush)}={}) {
  if (!target.eligible||!isAllowedMailRecipient(target.email,{environment:'staging',allowlist:configuration.allowlist})) return {state:'cancelled',providerStatus:null};
  const path=typeof target.path==='string'&&/^\/app\/c\/[a-z0-9-]+\/notifications$/.test(target.path)?target.path:'/app/';
  if (target.channel==='email') {
    if (!configuration.sendgridKey||configuration.from!=='info@cluvo.nl') throw new Error('STAGING_MAIL_CONFIGURATION_REQUIRED');
    const digest=target.source_kind==='daily_digest';
    const templateTest=target.source_kind==='template_test';
    const template=target.template_test;
    if(templateTest&&(!template||typeof template.subject!=='string'||template.subject.length<1||template.subject.length>200||/[\r\n]/.test(template.subject)||typeof template.text!=='string'||template.text.length>20000||typeof template.sender_name!=='string'||template.sender_name.length<1||template.sender_name.length>150||/[\r\n]/.test(template.sender_name)||!Number.isSafeInteger(template.revision)||template.revision<1||template.reply_to!=null&&(typeof template.reply_to!=='string'||!/^\S+@[^\s@]+\.[^\s@]+$/.test(template.reply_to))))return {state:'cancelled',providerStatus:null};
    const items=digest&&Array.isArray(target.digest_items)?target.digest_items.slice(0,100).filter(item=>
      typeof item.title==='string'&&item.title.length<=200&&typeof item.starts_at==='string'&&Number.isFinite(Date.parse(item.starts_at))
      &&typeof item.path==='string'&&/^\/app\/c\/[a-z0-9-]+\/tasks\?(?:task|shift)=[0-9a-f-]{36}$/.test(item.path)
      &&item.path.split('/')[3]===path.split('/')[3]):[];
    if(digest&&!items.length)return {state:'cancelled',providerStatus:null};
    const clean=value=>value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
    const content=digest?`Dit is een Cluvo stagingtest. Deze passende taken zijn nu nog beschikbaar:\n\n${items.map(item=>`${clean(item.title)} — ${new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'medium',timeStyle:'short'}).format(new Date(item.starts_at))}\nhttps://staging.cluvo.nl${item.path.replace('?shift=','?task=')}`).join('\n\n')}\n\nBekijk de actuele taak voordat je boekt.`:`Dit is een Cluvo stagingtest. Er staat een nieuwe melding voor je klaar.\n\nOpen https://staging.cluvo.nl${path}\n\nDeze e-mail bevat geen persoonlijke dossiergegevens.`;
    const templateRevision=templateTest?template.revision:1;
    const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    if(templateTest&&((template.preheader!=null&&(typeof template.preheader!=='string'||template.preheader.length>2000))||(template.button_label!=null&&(typeof template.button_label!=='string'||template.button_label.length>100))||(template.image_path!=null&&(typeof template.image_path!=='string'||template.image_path!==''&&!/^\/brand\/[a-zA-Z0-9/_-]+\.(png|svg|webp)$/.test(template.image_path)))))return {state:'cancelled',providerStatus:null};
    const templateHtml=templateTest?`<!doctype html><html lang="nl"><body style="margin:0;background:#f7f8fa;font-family:Arial,sans-serif;color:#172638"><div style="max-width:600px;margin:auto;padding:24px;background:white;border-radius:16px"><span style="display:none">${escapeHtml(template.preheader??'')}</span>${template.image_path?`<img src="https://staging.cluvo.nl${template.image_path}" alt="" style="max-width:100%;height:auto">`:''}<p style="font-size:12px;color:#586675">Aangevraagde Cluvo-templatecontrole op staging</p><h1 style="font-size:24px">${escapeHtml(template.subject)}</h1><p style="line-height:1.6">${escapeHtml(template.text).replaceAll('\n','<br>')}</p>${template.button_label?`<p><a href="https://staging.cluvo.nl${path}" style="display:inline-block;padding:12px 18px;background:#f34f3d;color:white;border-radius:12px;text-decoration:none">${escapeHtml(template.button_label)}</a></p>`:`<p><a href="https://staging.cluvo.nl${path}">Open je Cluvo-inbox</a></p>`}</div></body></html>`:null;
    const body=JSON.stringify({personalizations:[{to:[{email:target.email}],custom_args:{cluvo_pwa_target:target.id,cluvo_pwa_scope:'staging'}}],from:{email:configuration.from,name:templateTest?template.sender_name:'Cluvo'},...(templateTest&&template.reply_to?{reply_to:{email:template.reply_to}}:{}),subject:templateTest?`Cluvo staging — ${template.subject}`:digest?'Cluvo staging — nieuwe passende taken':'Cluvo staging — nieuwe melding',content:[{type:'text/plain',value:templateTest?`Dit is je aangevraagde Cluvo-templatecontrole op staging.\n\n${template.text}\n\nOpen https://staging.cluvo.nl${path}`:content},...(templateHtml?[{type:'text/html',value:templateHtml}]:[])]});
    const bodyHash=createHash('sha256').update(body).digest('hex');
    try {
      const response=await fetcher('https://api.sendgrid.com/v3/mail/send',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
        headers:{Authorization:`Bearer ${configuration.sendgridKey}`,'Content-Type':'application/json'},
        body});
      const messageKey=response.headers.get('x-message-id');
      // The status and message reference are already authoritative. Failure
      // while discarding an unused response body cannot undo that receipt.
      try {await response.body?.cancel();} catch {}
      return {...classifyDelivery('email',response.status),bodyHash,templateRevision,providerMessageKey:messageKey&&/^[A-Za-z0-9_.-]{1,200}$/.test(messageKey)?messageKey:null};
    } catch {return {...classifyDelivery('email',null,true),bodyHash,templateRevision,providerMessageKey:null};}
  }
  if (target.channel!=='push'||!target.subscription||!pushEndpointAllowed(target.subscription.endpoint)) return {state:'cancelled',providerStatus:null};
  if (!configuration.publicKey||!configuration.privateKey) throw new Error('STAGING_PUSH_CONFIGURATION_REQUIRED');
  const payload=JSON.stringify({path});
  const bodyHash=createHash('sha256').update(payload).digest('hex');
  try {
    const response=await push(target.subscription,payload,{
      vapidDetails:{subject:'mailto:info@cluvo.nl',publicKey:configuration.publicKey,privateKey:configuration.privateKey},
      timeout:10000,TTL:3600,urgency:'normal',topic:(typeof target.notification_tag==='string'?target.notification_tag:target.id).replaceAll('-','').slice(0,32),
    });
    return {...classifyDelivery('push',response.statusCode),bodyHash,templateRevision:1,providerMessageKey:null};
  } catch (error) {
    return {...classifyDelivery('push',Number.isInteger(error?.statusCode)?error.statusCode:null,!Number.isInteger(error?.statusCode)),bodyHash,templateRevision:1,providerMessageKey:null};
  }
}
