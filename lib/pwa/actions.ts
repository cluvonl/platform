'use server';

import {createHash,randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';
import {inviteExecutorAction} from '@/app/c/[club]/huishouden/actions';
import {mobileCommandSchema, mobilePayloadSchemas} from './validation';
import {forgetReceipt, rememberReceipt} from './pending';
import {resolveClubTimestamp} from './time.mjs';
import {isAllowedMailRecipient} from '@/lib/domain/mail-recipient.mjs';
import type {MobileCommandInput, MobileCommandResult} from '@/components/mobile/types';

const genericFailure='Deze wijziging is nog niet bevestigd. Controleer de status voordat je opnieuw kiest.';
const messages: Record<string,string> = {
  STALE_VERSION:'De gegevens zijn intussen gewijzigd. Vernieuw het overzicht en controleer je keuze.',
  POLICY_VERSION_CHANGED:'De beleidsversie of toewijzing is intussen gewijzigd. Vernieuw het overzicht en lees de actuele afspraken.',
  POLICY_MUST_BE_OPENED:'Open eerst deze beleidsversie voordat je het akkoord bevestigt.',
  INSTRUCTIONS_CHANGED:'De instructies zijn gewijzigd. Lees de actuele instructies voordat je bevestigt.',
  CAPACITY_FULL:'Deze plaats is inmiddels bezet. Kies een andere plaats.',
  IDEMPOTENCY_CONFLICT:'Deze referentie hoort bij een andere keuze. Controleer eerst de oorspronkelijke status.',
  FORBIDDEN:'Je hebt voor deze handeling geen actuele toestemming.',
  NOT_FOUND:'Deze gegevens zijn niet beschikbaar binnen jouw vereniging en rechten.',
  ACK_REQUIRED:'Lees en bevestig de instructies en annuleringsafspraken.',
  VOLUNTARY_ACK_REQUIRED:'Het teamdoel is bereikt. Bevestig afzonderlijk dat deze extra inzet vrijwillig is.',
  INVALID_BUDDY:'Deze buddy is niet beschikbaar of niet bevoegd voor deze taak.',
  TEAM_TASK_CREDIT_REQUIRES_REVIEW:'Clubminuten voor een teamtaak vragen vooraf beoordeling en publicatie.',
  OVERLAP:'Deze uitvoerder heeft op dit tijdstip al een afspraak.',
  NONEXISTENT_LOCAL_TIME:'Dit tijdstip bestaat niet door de overgang naar zomertijd. Kies een geldig tijdstip in de tijdzone van je vereniging.',
  AMBIGUOUS_LOCAL_TIME:'Dit tijdstip komt tweemaal voor bij de overgang naar wintertijd. Kies een ondubbelzinnig tijdstip of geef een expliciete tijdzone-offset.',
  INVALID_LOCAL_TIME:'Controleer de datum en tijd in de tijdzone van je vereniging.',
};
function parsedCommand(input: unknown) {
  const parsed=mobileCommandSchema.safeParse(input);
  if (!parsed.success) return null;
  if (!Object.hasOwn(mobilePayloadSchemas,parsed.data.command)) return null;
  const schema=mobilePayloadSchemas[parsed.data.command];
  if (!schema) return null;
  const payload=schema.safeParse(parsed.data.payload);
  return payload.success ? {...parsed.data,payload:payload.data as Record<string,unknown>} : null;
}
function rejected(key:string,message:string): MobileCommandResult {return {status:'rejected',message,idempotencyKey:key};}
function unknown(key:string): MobileCommandResult {return {status:'unknown',message:genericFailure,idempotencyKey:key};}
function errorMessage(error: {message?: string}) {
  return Object.entries(messages).find(([code]) => error.message?.includes(code))?.[1]
    ?? 'De wijziging is afgewezen. Controleer de invoer, de actuele gegevens en je toestemming.';
}
function refresh(club:string) {
  revalidatePath(`/app/c/${encodeURIComponent(club)}`,'layout');
  revalidatePath(`/c/${encodeURIComponent(club)}`,'layout');
}
async function normalizeTimes(client:Awaited<ReturnType<typeof requireWorkspace>>['client'],tenantId:string,payload:Record<string,unknown>) {
  const fields=['starts_at','ends_at','self_until','assign_until','expires_at','due_at'].filter((field)=>Object.hasOwn(payload,field)&&payload[field]!==null);
  if (!fields.length) return payload;
  const {data,error}=await client.schema('api').from('public_tenants').select('timezone').eq('tenant_id',tenantId).single();
  if (error||typeof data?.timezone!=='string') throw new Error('TIMEZONE_UNAVAILABLE');
  return {...payload,...Object.fromEntries(fields.map((field)=>[field,resolveClubTimestamp(payload[field],data.timezone)]))};
}
function preparation(parsed:NonNullable<ReturnType<typeof parsedCommand>>,tenantId:string,payload:Record<string,unknown>) {
  return {p_tenant_id:tenantId,p_idempotency_key:parsed.idempotencyKey,p_action:parsed.command,
    p_resource_id:parsed.resourceId??tenantId,p_expected_version:parsed.expectedVersion,
    p_request_hash_hex:createHash('sha256').update(JSON.stringify({action:parsed.command,resource:parsed.resourceId??tenantId,version:parsed.expectedVersion,payload})).digest('hex')};
}
async function resolveIntent(client:Awaited<ReturnType<typeof requireWorkspace>>['client'],tenantId:string,key:string) {
  return client.schema('api').rpc('pwa_resolve_command_intent',{p_tenant_id:tenantId,p_idempotency_key:key});
}

// A separate confirmed roundtrip places the signed identity on the device
// BEFORE any transaction is submitted. No payload is stored or replayed.
export async function mobilePrepareCommandAction(input: MobileCommandInput): Promise<{ok:boolean;message?:string}> {
  const parsed=parsedCommand(input);
  if (!parsed) return {ok:false,message:'Controleer de ingevulde velden voordat je bevestigt.'};
  if (parsed.command==='invite_executor'&&!isAllowedMailRecipient(parsed.payload.email,{environment:process.env.APP_ENV??'local',allowlist:process.env.MAIL_ALLOWLIST})) return {ok:false,message:'Dit e-mailadres is niet beschikbaar voor uitnodigingen in deze testomgeving.'};
  const {client,workspace}=await requireWorkspace(parsed.club,'/app/login');
  try {
    const payload=await normalizeTimes(client,workspace.tenant_id,parsed.payload);
    const {data,error}=await client.schema('api').rpc('pwa_prepare_command',preparation(parsed,workspace.tenant_id,payload));
    if (error||!z.object({ok:z.literal(true)}).safeParse(data).success) return {ok:false,message:error?errorMessage(error):'Je keuze is nog niet veilig klaargezet. Probeer het opnieuw.'};
  }
  catch (error) {return {ok:false,message:error instanceof Error?messages[error.message]??'De tijdzone kan nu niet worden gecontroleerd. Probeer het opnieuw.':'Controleer de datum en tijd.'};}
  await rememberReceipt({tenant:workspace.tenant_id,person:workspace.person_id},parsed.idempotencyKey,parsed.command);
  return {ok:true};
}

export async function mobileCommandAction(input: MobileCommandInput): Promise<MobileCommandResult> {
  const parsed=parsedCommand(input);
  if (!parsed) return rejected(typeof input?.idempotencyKey==='string'?input.idempotencyKey:'','Controleer de ingevulde velden voordat je bevestigt.');
  const {client,workspace}=await requireWorkspace(parsed.club,'/app/login');
  const scope={tenant:workspace.tenant_id,person:workspace.person_id};
  const pending=await client.schema('api').rpc('pwa_pending_commands',{p_tenant_id:workspace.tenant_id});
  if (pending.error) return unknown(parsed.idempotencyKey);
  const receipt=z.array(z.object({idempotency_key:z.string().uuid(),action:z.string()})).safeParse(pending.data);
  if (!receipt.success) return unknown(parsed.idempotencyKey);
  if (!receipt.data.some((row)=>row.idempotency_key===parsed.idempotencyKey&&row.action===parsed.command)) {
    // A lost response may have committed and cleared its pending intent. Check
    // the same exact prepared payload and receipt; never submit it again.
    try {
      const payload=await normalizeTimes(client,workspace.tenant_id,parsed.payload);
      const prepared=await client.schema('api').rpc('pwa_prepare_command',preparation(parsed,workspace.tenant_id,payload));
      if(prepared.error)return rejected(parsed.idempotencyKey,errorMessage(prepared.error));
      return await mobileCommandStatusAction({club:parsed.club,idempotencyKey:parsed.idempotencyKey});
    } catch {return unknown(parsed.idempotencyKey);}
  }
  const resource=parsed.resourceId??workspace.tenant_id;
  let payload:Record<string,unknown>;
  try {payload=await normalizeTimes(client,workspace.tenant_id,parsed.payload);}
  catch (error) {
    if (error instanceof Error&&messages[error.message]) {await forgetReceipt(scope,parsed.idempotencyKey);return rejected(parsed.idempotencyKey,messages[error.message]);}
    return unknown(parsed.idempotencyKey);
  }
  const common={p_tenant_id:workspace.tenant_id,p_idempotency_key:parsed.idempotencyKey};
  let response: {data: unknown;error: {code?:string;message?:string}|null};
  try {
    const prepared=await client.schema('api').rpc('pwa_prepare_command',preparation(parsed,workspace.tenant_id,payload));
    if (prepared.error) return rejected(parsed.idempotencyKey,errorMessage(prepared.error));
    switch (parsed.command) {
      case 'invite_executor': {
        const form=new FormData();
        for (const [key,value] of Object.entries({club:parsed.club,householdId:resource,
          givenName:payload.given_name,familyName:payload.family_name,email:payload.email,
          expectedHouseholdVersion:parsed.expectedVersion,idempotencyKey:parsed.idempotencyKey,surface:'mobile'})) form.set(key,String(value));
        if (payload.can_view_progress) form.set('canViewProgress','on');
        if (payload.can_book_for) form.set('canBookFor','on');
        const invitation=await inviteExecutorAction({status:'idle'},form);
        if (invitation.status!=='sent') return {...unknown(parsed.idempotencyKey),message:invitation.message??genericFailure};
        await resolveIntent(client,workspace.tenant_id,parsed.idempotencyKey);
        await forgetReceipt(scope,parsed.idempotencyKey);refresh(parsed.club);
        return {status:'confirmed',message:invitation.message??'Uitnodiging bevestigd.',idempotencyKey:parsed.idempotencyKey};
      }
      default:response=await client.schema('api').rpc('pwa_command',{...common,p_action:parsed.command,
        p_resource_id:resource,p_expected_version:parsed.expectedVersion,p_payload:payload});
    }
  } catch {return unknown(parsed.idempotencyKey);}
  if (response.error) {
    // A provider transport failure has no authoritative database outcome.
    if (!/^[0-9A-Z]{5}$/.test(response.error.code??'')) return unknown(parsed.idempotencyKey);
    await resolveIntent(client,workspace.tenant_id,parsed.idempotencyKey);
    await forgetReceipt(scope,parsed.idempotencyKey);
    return rejected(parsed.idempotencyKey,errorMessage(response.error));
  }
  const row=Array.isArray(response.data)?response.data[0]:response.data;
  const confirmed=z.object({ok:z.literal(true)}).safeParse(row);
  if (!confirmed.success) return unknown(parsed.idempotencyKey);
  await forgetReceipt(scope,parsed.idempotencyKey);refresh(parsed.club);
  return {status:'confirmed',message:'Opgeslagen en bevestigd door je vereniging.',idempotencyKey:parsed.idempotencyKey};
}

export async function mobileCommandStatusAction(input: {club:string;idempotencyKey:string}): Promise<MobileCommandResult> {
  const parsed=z.object({club:z.string().min(1).max(80),idempotencyKey:z.string().uuid()}).strict().safeParse(input);
  if (!parsed.success) return rejected('','Open het overzicht opnieuw om de status te controleren.');
  const {client,workspace}=await requireWorkspace(parsed.data.club,'/app/login');
  const scope={tenant:workspace.tenant_id,person:workspace.person_id};
  try {
    const {data,error}=await resolveIntent(client,workspace.tenant_id,parsed.data.idempotencyKey);
    const row=Array.isArray(data)?data[0]:data;
    if (!error && (row as {status?:string}|null)?.status==='rejected') {
      await forgetReceipt(scope,parsed.data.idempotencyKey);refresh(parsed.data.club);
      return rejected(parsed.data.idempotencyKey,'De oorspronkelijke handeling is niet opgeslagen. Controleer het actuele overzicht voordat je opnieuw bevestigt.');
    }
    if (error || !row || !((row as {ok?:boolean}).ok || (row as {status?:string}).status==='confirmed')) return unknown(parsed.data.idempotencyKey);
    await forgetReceipt(scope,parsed.data.idempotencyKey);refresh(parsed.data.club);
    return {status:'confirmed',message:'De oorspronkelijke handeling is bevestigd. Het overzicht is vernieuwd.',idempotencyKey:parsed.data.idempotencyKey};
  } catch {return unknown(parsed.data.idempotencyKey);}
}

export async function savePushSubscriptionAction(club:string,subscription:{endpoint:string;keys:{p256dh:string;auth:string}},idempotencyKey:string) {
  const command={club,command:'save_push_subscription',expectedVersion:0,idempotencyKey,
    payload:{endpoint:subscription.endpoint,p256dh:subscription.keys.p256dh,auth_secret:subscription.keys.auth}};
  const prepared=await mobilePrepareCommandAction(command);
  if (!prepared.ok) return {ok:false,message:prepared.message??'Push is nog niet ingesteld.'};
  const result=await mobileCommandAction(command);return {ok:result.status==='confirmed',message:result.message};
}
export async function revokePushSubscriptionAction(club:string,endpoint:string,idempotencyKey:string) {
  const command={club,command:'revoke_push_subscription',expectedVersion:0,idempotencyKey,payload:{endpoint}};
  const prepared=await mobilePrepareCommandAction(command);
  if (!prepared.ok) return {ok:false,message:prepared.message??'Push is nog niet uitgezet.'};
  const result=await mobileCommandAction(command);return {ok:result.status==='confirmed',message:result.message};
}

export async function readPushBindingStatusAction(club:string,endpoint:string):Promise<{ok:boolean;registered:boolean}> {
  if(!z.string().min(1).max(80).safeParse(club).success||!mobilePayloadSchemas.revoke_push_subscription.safeParse({endpoint}).success)return {ok:false,registered:false};
  const {client,workspace}=await requireWorkspace(club,'/app/login');
  const {data,error}=await client.schema('api').rpc('pwa_push_binding_status',{p_tenant_id:workspace.tenant_id,p_endpoint:endpoint});
  const result=z.object({registered:z.boolean()}).strict().safeParse(data);
  return !error&&result.success?{ok:true,registered:result.data.registered}:{ok:false,registered:false};
}

export async function revokeDevicePushSubscriptionsAction(club:string,endpoint:string,idempotencyKey:string) {
  if(!z.string().uuid().safeParse(idempotencyKey).success||!mobilePayloadSchemas.revoke_push_subscription.safeParse({endpoint}).success)return {ok:false,message:'De apparaatkoppeling kan niet worden gecontroleerd.'};
  const {client}=await requireWorkspace(club,'/app/login');
  const scopes=await client.schema('api').from('my_workspaces').select('tenant_slug');
  if(scopes.error)return {ok:false,message:'Je persoonlijke toegang kan nu niet worden gecontroleerd.'};
  const parsed=z.array(z.object({tenant_slug:z.string().min(1).max(80)})).max(100).safeParse(scopes.data);
  if(!parsed.success)return {ok:false,message:'Je persoonlijke toegang kan nu niet worden gecontroleerd.'};
  for(const slug of new Set(parsed.data.map(row=>row.tenant_slug))) {
    const bytes=createHash('sha256').update('pwa-device-logout:'+idempotencyKey+':'+slug).digest().subarray(0,16);
    bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=bytes.toString('hex'),key=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    const result=await revokePushSubscriptionAction(slug,endpoint,key);
    if(!result.ok)return result;
  }
  return {ok:true,message:'De meldingen op dit apparaat zijn voor je verenigingen afgemeld.'};
}

export async function markMobileHelpSeenAction(club:string,topicId:string): Promise<{ok:boolean;message?:string}> {
  const match=/^(pwa\.[a-z-]{1,30})\.v1$/.exec(topicId);
  if (!match) return {ok:false,message:'Deze uitleg is niet beschikbaar.'};
  const command={club,command:'dismiss_help',expectedVersion:0,idempotencyKey:randomUUID(),payload:{topic_id:match[1],topic_version:1}};
  const prepared=await mobilePrepareCommandAction(command);
  if (!prepared.ok) return prepared;
  const result=await mobileCommandAction(command);return {ok:result.status==='confirmed',message:result.message};
}

export async function mobileReceivingTeamProposalAction(club:string,seasonId:string,positionIds:string[]) {
  const denied={ok:false,teams:[],readAt:''};
  if(!z.string().uuid().safeParse(seasonId).success||!z.array(z.string().uuid()).min(1).max(50).refine(values=>new Set(values).size===values.length).safeParse(positionIds).success)return denied;
  const {client,workspace}=await requireWorkspace(club,'/app/login');
  const result=await client.schema('api').rpc('pwa_receiving_team_proposals',{p_tenant_id:workspace.tenant_id,p_season_id:seasonId,p_position_ids:positionIds});
  const parsed=z.object({teams:z.array(z.object({team_id:z.string().uuid(),version:z.number().int().positive(),name:z.string(),goal_total:z.number().int().nonnegative(),confirmed_count:z.number().int().nonnegative(),assigned_count:z.number().int().nonnegative(),planned_count:z.number().int().nonnegative(),suitable_member_count:z.number().int().nonnegative(),reason:z.string()})),read_at:z.string()}).safeParse(result.data);
  if(result.error||!parsed.success)return denied;
  return {ok:true,teams:parsed.data.teams.map(row=>({id:row.team_id,version:row.version,name:row.name,goal:row.goal_total,confirmed:row.confirmed_count,assigned:row.assigned_count,planned:row.planned_count,suitableMembers:row.suitable_member_count,reason:row.reason})),readAt:parsed.data.read_at};
}
