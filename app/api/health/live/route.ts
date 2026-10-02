export const dynamic='force-dynamic';
export async function GET() {
  return Response.json({status:'ok',service:'cluvo',mode:process.env.APP_MODE||'prototype',environment:process.env.APP_ENV||'local',release:process.env.RELEASE_SHA||'local'},{headers:{'Cache-Control':'no-store'}});
}
