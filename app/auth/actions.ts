'use server';

import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {appOrigin} from '@/lib/supabase/config';

export type AuthActionState = {status: 'idle' | 'error'; message?: string};

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const otpSchema = z.string().trim().regex(/^\d{6}$/);
const otpEmailCookie = 'cluvo_otp_email';

export async function requestOtpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailResult = emailSchema.safeParse(formData.get('email'));
  if (!emailResult.success) {
    return {status: 'error', message: 'Vul een geldig persoonlijk e-mailadres in.'};
  }

  try {
    const client = await createSupabaseServerClient();
    await client.auth.signInWithOtp({
      email: emailResult.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appOrigin()}/auth/confirm?next=${encodeURIComponent('/workspaces')}`,
      },
    });
  } catch {
    // Geef niet prijs of een adres, account of verenigingslidmaatschap bestaat.
  }

  const cookieStore = await cookies();
  cookieStore.set(otpEmailCookie, emailResult.data, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: '/auth/verify',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/auth/verify?sent=1');
}

export async function verifyOtpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const cookieStore = await cookies();
  const emailResult = emailSchema.safeParse(cookieStore.get(otpEmailCookie)?.value);
  const tokenResult = otpSchema.safeParse(formData.get('token'));
  if (!emailResult.success || !tokenResult.success) {
    return {status: 'error', message: 'Vraag een nieuwe code aan en controleer de zescijferige code.'};
  }

  try {
    const client = await createSupabaseServerClient();
    const {error: verifyError} = await client.auth.verifyOtp({
      email: emailResult.data,
      token: tokenResult.data,
      type: 'email',
    });
    if (verifyError) {
      return {status: 'error', message: 'De code is ongeldig of verlopen. Vraag een nieuwe code aan.'};
    }

    const {data, error: workspaceError} = await client
      .schema('api')
      .from('my_workspaces')
      .select('tenant_slug')
      .order('tenant_slug')
      .limit(1);
    const selectedTenantSlug = data?.[0]?.tenant_slug;
    if (workspaceError || typeof selectedTenantSlug !== 'string') {
      await client.auth.signOut({scope: 'local'});
      cookieStore.delete({name: otpEmailCookie, path: '/auth/verify'});
      return {status: 'error', message: 'Dit account heeft geen actieve verenigingswerkruimte. Neem contact op met de beheerder.'};
    }
  } catch {
    return {status: 'error', message: 'Inloggen is nu niet beschikbaar. Probeer het later opnieuw.'};
  }
  cookieStore.delete({name: otpEmailCookie, path: '/auth/verify'});
  redirect('/workspaces');
}

export async function signOutAction(): Promise<void> {
  try {
    const client = await createSupabaseServerClient();
    await client.auth.signOut({scope: 'local'});
  } finally {
    redirect('/login');
  }
}
