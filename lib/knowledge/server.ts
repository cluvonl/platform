import 'server-only';
import {notFound} from 'next/navigation';
import {requireWorkspace} from '@/lib/auth/workspace';
import {requireClubAdmin, requirePlatform} from '@/lib/admin/server';
import {books} from './catalog.mjs';
import {readableBooks, type KnowledgeContext} from './model.mjs';

export async function knowledgeAuthority(environment: KnowledgeContext['environment'], club?: string) {
  let context: KnowledgeContext;
  let label: string;
  let clubAdmin = false, platformAdmin = false;
  if (environment === 'platform') {
    const {permissions} = await requirePlatform();
    context = {environment, permissions: permissions.map(p => ({key:p.key, global:p.tenant_id === null}))};
    label = 'Platformbeheer';
  } else if (environment === 'club') {
    if (!club) notFound();
    const {access} = await requireClubAdmin(club);
    context = {environment, permissions: access.permissions.map(p => ({key:p.key}))};
    label = access.name;
  } else {
    if (!club) notFound();
    const {client, workspace} = await requireWorkspace(club);
    context = {environment, member:true, permissions:[]};
    label = workspace.tenant_name;
    const [c,p] = await Promise.all([client.schema('api').rpc('club_admin_access',{p_slug:club}),client.schema('api').rpc('platform_access')]);
    clubAdmin = !c.error && c.data?.authorized === true;
    platformAdmin = !p.error && p.data?.authorized === true;
  }
  // Content filtering runs on the server before results, snippets or links are rendered.
  return {context, label, books:readableBooks(books, context), clubAdmin, platformAdmin};
}

export function knowledgePath(base: string, path: string[] | undefined, allowedBooks: ReturnType<typeof readableBooks>) {
  const parts = path ?? [];
  if (parts.length > 2) notFound();
  const book = parts[0] ? allowedBooks.find(b => b.id === parts[0]) : undefined;
  if (parts[0] && !book) notFound();
  const entry = parts[1] ? book?.articles.find(a => a.id === parts[1]) : undefined;
  if (parts[1] && !entry) notFound();
  return {base, book, entry};
}
