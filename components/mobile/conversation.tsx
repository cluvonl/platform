'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {mobileMessagePageAction, mobileCardReplyPageAction, type ConversationPage} from '@/lib/pwa/conversations';
import {CommandForm} from './command-form';
import {Avatar, Blank, Btn, timeLabel} from './primitives';
import type {MobileCard, MobileChannel, MobileSnapshot} from './types';

type Item = ConversationPage['items'][number];
function mergeItems(previous: Item[], incoming: Item[]) {return [...new Map([...previous, ...incoming].map((item) => [item.id, item])).values()].sort((a,b)=>a.sentAt.localeCompare(b.sentAt)||a.id.localeCompare(b.id));}
function useConversation({snapshot, id, kind, initial}: {snapshot: MobileSnapshot; id: string; kind: 'message' | 'card'; initial: Item[]}) {
  const [items, setItems] = useState(() => mergeItems([], initial));
  const [cursor, setCursor] = useState<ConversationPage['cursor']>(null);
  const [more, setMore] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const busy = useRef(false);
  const firstPage = useRef(true);
  const mounted = useRef(true);
  const read = useCallback(async (before?: NonNullable<ConversationPage['cursor']>) => {
    if (busy.current || !navigator.onLine || document.visibilityState !== 'visible') return;
    busy.current = true;
    if (before) setLoadingOlder(true);
    try {
      const page = await (kind === 'message' ? mobileMessagePageAction(snapshot.workspace.tenant_slug,id,before) : mobileCardReplyPageAction(snapshot.workspace.tenant_slug,id,before));
      if (!mounted.current) return;
      if (!page.ok) {setItems([]); setCursor(null); setMore(false); setDenied(true); return;}
      setDenied(false); setLoadError(false);
      setItems((previous)=>mergeItems(previous,page.items));
      if (before || firstPage.current) {setCursor(page.cursor); setMore(page.more); firstPage.current=false;}
    } catch {if (mounted.current) setLoadError(true);}
    finally {busy.current=false; if (mounted.current) setLoadingOlder(false);}
  }, [id,kind,snapshot.workspace.tenant_slug]);
  useEffect(() => {
    mounted.current=true;
    const refresh = () => {void read();};
    const timer = window.setInterval(refresh,5000);
    window.addEventListener('focus',refresh); window.addEventListener('online',refresh); document.addEventListener('visibilitychange',refresh);
    queueMicrotask(refresh);
    return () => {mounted.current=false; window.clearInterval(timer); window.removeEventListener('focus',refresh); window.removeEventListener('online',refresh); document.removeEventListener('visibilitychange',refresh);};
  }, [read]);
  return {items,denied,more,loadingOlder,loadError,refresh: ()=>void read(),loadOlder: ()=>{if (cursor) void read(cursor);}};
}
export function MessageConversation({snapshot, channel}: {snapshot: MobileSnapshot; channel: MobileChannel}) {
  const conversation=useConversation({snapshot,id:channel.id,kind:'message',initial:snapshot.messages.filter((item)=>item.channelId===channel.id)});
  if (conversation.denied) return <Blank title="Gesprek niet meer beschikbaar" text="Je huidige toegang tot dit gesprek is niet bevestigd. Open je eigen team- of commissieoverzicht opnieuw." />;
  return <>{conversation.more && <Btn tone="outline" disabled={conversation.loadingOlder} onClick={conversation.loadOlder}>{conversation.loadingOlder?'Eerdere berichten laden…':'Eerdere berichten laden'}</Btn>}<div className="chat-messages" aria-live="polite" aria-relevant="additions">{conversation.items.map((message)=><article className={message.own?'mine':''} key={message.id}><Avatar name={message.authorName} /><div><div className="chat-author"><b>{message.authorName}</b><small>{timeLabel(message.sentAt,snapshot.timezone)}</small></div><p>{message.text}</p></div></article>)}{!conversation.items.length && <Blank title="Begin het gesprek" text="Een korte praktische vraag helpt iedereen vooruit." />}</div>{conversation.loadError && <p className="notice amber" role="status">Vernieuwen lukt nu niet. De geladen berichten blijven zichtbaar; probeer het opnieuw met verbinding.</p>}<CommandForm snapshot={snapshot} command="send_message" resourceId={channel.id} version={channel.version} fields={[{name:'body',label:'Bericht schrijven',type:'textarea',required:true,maxLength:2000,placeholder:'Schrijf een bericht…'}]} submit="Bericht plaatsen" onConfirmed={conversation.refresh} /><p className="subtle">Nieuwe berichten worden met je actuele rechten opgehaald zolang dit gesprek zichtbaar is. Bevestig taakafspraken bij de taak zelf.</p></>;
}
export function CardConversation({snapshot, card}: {snapshot: MobileSnapshot; card: MobileCard}) {
  const initial=card.comments.map((item)=>({...item,version:item.version ?? 0,own:item.own === true}));
  const conversation=useConversation({snapshot,id:card.id,kind:'card',initial});
  if (conversation.denied) return <Blank title="Reacties niet meer beschikbaar" text="Je huidige toegang tot deze werkafspraak is niet bevestigd." />;
  return <>{conversation.more && <Btn tone="outline" disabled={conversation.loadingOlder} onClick={conversation.loadOlder}>{conversation.loadingOlder?'Eerdere reacties laden…':'Eerdere reacties laden'}</Btn>}<div aria-live="polite" aria-relevant="additions">{conversation.items.map((comment)=><div className="comment" key={comment.id}><b>{comment.authorName}</b><p>{comment.text}</p><small>{timeLabel(comment.sentAt,snapshot.timezone)}</small></div>)}</div>{conversation.loadError && <p role="status" className="notice amber">Reacties vernieuwen lukt nu niet. Je invoer blijft staan.</p>}<CommandForm snapshot={snapshot} command="reply_card" resourceId={card.id} version={card.version} fields={[{name:'body',label:'Reactie',type:'textarea',required:true,maxLength:2000}]} submit="Plaats reactie" onConfirmed={conversation.refresh} /></>;
}
