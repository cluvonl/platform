import type {EmailOtpType} from '@supabase/supabase-js';
import {NextResponse, type NextRequest} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {mobileReturnPath,mobileReturnTenant,mobileLoginPath} from '@/lib/auth/mobile-return';
import {appOrigin} from '@/lib/supabase/config';

const allowedTypes = new Set<EmailOtpType>(['email', 'invite', 'magiclink', 'recovery', 'signup']);
const invitationCookie = 'cluvo_household_invitation';

function privateRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const origin = appOrigin();
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const requestedType = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/workspaces';
  const mobileNext=mobileReturnPath(requestedNext);
  if (!tokenHash || !requestedType || !allowedTypes.has(requestedType)) {
    return privateRedirect(new URL(mobileNext?mobileLoginPath(mobileNext)+'&error=invalid_link':'/login?error=invalid_link', origin));
  }

  const client = await createSupabaseServerClient();
  const {error} = await client.auth.verifyOtp({token_hash: tokenHash, type: requestedType});
  if (error) return privateRedirect(new URL(mobileNext?mobileLoginPath(mobileNext)+'&error=expired_link':'/login?error=expired_link', origin));

  let next = '/workspaces';
  let invitationToken: string | null = null;
  if (requestedNext.startsWith('/') && !requestedNext.startsWith('//')) {
    const parsedNext = new URL(requestedNext, origin);
    if (parsedNext.origin === origin && ['/invite/accept', '/app/invite/accept'].includes(parsedNext.pathname)) {
      const candidate = parsedNext.searchParams.get('token');
      if (candidate && candidate.length >= 32 && candidate.length <= 200) {
        invitationToken = candidate;
        if (parsedNext.pathname === '/app/invite/accept') next = '/app/invite/accept';
        else next = '/invite/accept';
      }
    } else if (parsedNext.origin === origin && ['/workspaces', '/app/workspaces'].includes(parsedNext.pathname) && !parsedNext.search && !parsedNext.hash) {
      next = parsedNext.pathname;
    }
  }

  if(mobileNext){
    next='/app/workspaces';const tenant=mobileReturnTenant(mobileNext);
    if(!tenant)next=mobileNext;
    else{const target=await client.schema('api').from('my_workspaces').select('tenant_slug').eq('tenant_slug',tenant);if(!target.error&&target.data?.some(row=>row.tenant_slug===tenant))next=mobileNext;}
  }
  const response = privateRedirect(new URL(next, origin));
  if (invitationToken) {
    response.cookies.set(next === '/app/invite/accept' ? 'cluvo_app_household_invitation' : invitationCookie, invitationToken, {
      httpOnly: true,
      maxAge: 60 * 60,
      path: next === '/app/invite/accept' ? '/app/invite/accept' : '/invite/accept',
      sameSite: 'strict',
      secure: new URL(appOrigin()).protocol === 'https:',
    });
  }
  return response;
}
