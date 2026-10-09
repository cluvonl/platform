'use server';

import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';

const cursor=z.object({at:z.string().datetime({offset:true}),id:z.string().uuid()}).strict();
const page=z.object({items:z.array(z.object({id:z.string().uuid(),version:z.number().int().positive(),author_name:z.string(),body:z.string(),created_at:z.string(),is_self:z.boolean().optional()})),more:z.boolean(),cursor:cursor.nullable()});
type Cursor=z.infer<typeof cursor>;
type Item={id:string;version:number;authorName:string;text:string;sentAt:string;own:boolean};
export type ConversationPage={ok:boolean;items:Item[];more:boolean;cursor:Cursor|null};

async function read(club:string,kind:'message'|'card_reply',resourceId:string,before?:Cursor):Promise<ConversationPage> {
  const denied:ConversationPage={ok:false,items:[],more:false,cursor:null};
  if(!z.string().uuid().safeParse(resourceId).success||before!==undefined&&!cursor.safeParse(before).success)return denied;
  const {client,workspace}=await requireWorkspace(club,'/app/login');
  const result=await client.schema('api').rpc(kind==='message'?'pwa_message_page':'pwa_card_reply_page',{
    p_tenant_id:workspace.tenant_id,[kind==='message'?'p_channel_id':'p_card_id']:resourceId,
    p_before_at:before?.at??null,p_before_id:before?.id??null,p_limit:50,
  });
  const parsed=page.safeParse(result.data);
  if(result.error||!parsed.success)return denied;
  return {ok:true,items:parsed.data.items.map(item=>({id:item.id,version:item.version,authorName:item.author_name,text:item.body,sentAt:item.created_at,own:item.is_self===true})),more:parsed.data.more,cursor:parsed.data.cursor};
}
export async function mobileMessagePageAction(club:string,channelId:string,before?:Cursor) {return read(club,'message',channelId,before);}
export async function mobileCardReplyPageAction(club:string,cardId:string,before?:Cursor) {return read(club,'card_reply',cardId,before);}
