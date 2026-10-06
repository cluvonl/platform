import type {EmailOtpType} from '@supabase/supabase-js';
import {NextResponse, type NextRequest} from 'next/server';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {appOrigin} from '@/lib/supabase/config';

const allowedTypes = new Set<EmailOtpType>(['email', 'invite', 'magiclink', 'recovery', 'signup']);
const invitationCookie = 'cluvo_household_invitation';

export async function GET(request: NextRequest) {
  const origin = appOrigin();
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const requestedType = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const requestedNext = request.nextUrl.searchParams.get('next') ?? '/workspaces';
  if (!tokenHash || !requestedType || !allowedTypes.has(requestedType)) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin));
  }

  const client = await createSupabaseServerClient();
  const {error} = await client.auth.verifyOtp({token_hash: tokenHash, type: requestedType});
  if (error) return NextResponse.redirect(new URL('/login?error=expired_link', origin));

  let next = '/workspaces';
  let invitationToken: string | null = null;
  if (requestedNext.startsWith('/') && !requestedNext.startsWith('//')) {
    const parsedNext = new URL(requestedNext, origin);
    if (parsedNext.origin === origin && parsedNext.pathname === '/invite/accept') {
      const candidate = parsedNext.searchParams.get('token');
      if (candidate && candidate.length >= 32 && candidate.length <= 200) {
        invitationToken = candidate;
        next = '/invite/accept';
      }
    } else if (parsedNext.origin === origin && parsedNext.pathname === '/workspaces') {
      next = '/workspaces';
    }
  }

  const response = NextResponse.redirect(new URL(next, origin));
  if (invitationToken) {
    response.cookies.set(invitationCookie, invitationToken, {
      httpOnly: true,
      maxAge: 60 * 60,
      path: '/invite/accept',
      sameSite: 'strict',
      secure: new URL(appOrigin()).protocol === 'https:',
    });
  }
  return response;
}
