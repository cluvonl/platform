export const dynamic='force-dynamic';
export async function GET() {
  return Response.json({ready:false,reason:'V1_BACKEND_NOT_IMPLEMENTED',checks:{database:'not_connected',workers:'not_implemented',authorization:'demo_only'}},{status:503,headers:{'Cache-Control':'no-store'}});
}
