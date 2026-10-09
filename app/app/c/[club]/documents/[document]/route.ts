import {createHash} from 'node:crypto';
import {z} from 'zod';
import {requireWorkspace} from '@/lib/auth/workspace';

const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"};
const metadata=z.object({title:z.string(),revision:z.number().int().positive(),bucket:z.literal('cluvo-private'),object_path:z.string().min(1),mime_type:z.string().min(1),size_bytes:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export async function GET(request:Request,{params}:{params:Promise<{club:string;document:string}>}) {
  const {club,document}=await params;
  const revision=new URL(request.url).searchParams.get('revision');
  if (!z.string().uuid().safeParse(document).success||revision!==null&&!/^[1-9]\d{0,8}$/.test(revision)) return new Response('Controleer het document.',{status:400,headers});
  const {client,workspace}=await requireWorkspace(club,'/app/login');
  const result=await client.schema('api').rpc('pwa_document',{p_tenant_id:workspace.tenant_id,p_document_id:document,p_revision:revision===null?null:Number(revision)});
  const parsed=metadata.safeParse(result.data);
  if (result.error||!parsed.success) return new Response('Dit document is niet beschikbaar binnen je toegang.',{status:404,headers});
  // Both the metadata and the private object are authorized with this user's
  // native session. No elevated Storage client or public signed URL is used.
  const content=await client.storage.from(parsed.data.bucket).download(parsed.data.object_path);
  if (content.error||!content.data) return new Response('Het document kan nu niet worden geladen.',{status:503,headers});
  const bytes=Buffer.from(await content.data.arrayBuffer());
  if (bytes.length!==parsed.data.size_bytes||createHash('sha256').update(bytes).digest('hex')!==parsed.data.sha256) return new Response('De documentversie kan niet worden gecontroleerd.',{status:503,headers});
  const filename=parsed.data.title.replace(/[^a-zA-Z0-9 ._-]/g,'_').slice(0,100)||'Cluvo-document';
  return new Response(bytes,{headers:{...headers,'Content-Type':parsed.data.mime_type,'Content-Length':String(bytes.length),'Content-Disposition':`attachment; filename="${filename}"`}});
}
