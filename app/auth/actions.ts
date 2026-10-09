'use server';

import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {z} from 'zod';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {mobileReturnCookie,mobileReturnPath,mobileReturnTenant} from '@/lib/auth/mobile-return';
import {appOrigin} from '@/lib/supabase/config';

export type AuthActionState = {status: 'idle' | 'error'; message?: string};

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const otpSchema = z.string().trim().regex(/^\d{6,10}$/);
const otpEmailCookie = 'cluvo_otp_email';
const mobileOtpEmailCookie = 'cluvo_app_otp_email';

export async function requestOtpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return requestOtp(false, formData);
}

export async function requestMobileOtpAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  return requestOtp(true, formData);
}

async function requestOtp(mobile: boolean, formData: FormData): Promise<AuthActionState> {
  const emailResult = emailSchema.safeParse(formData.get('email'));
  if (!emailResult.success) {
    return {status: 'error', message: 'Vul een geldig persoonlijk e-mailadres in.'};
  }

  const returnPath=mobile?mobileReturnPath(formData.get('next'))??'/app/workspaces':'/workspaces';
  try {
    const client = await createSupabaseServerClient();
    await client.auth.signInWithOtp({
      email: emailResult.data,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appOrigin()}/auth/confirm?next=${encodeURIComponent(returnPath)}`,
      },
    });
  } catch {
    // Geef niet prijs of een adres, account of verenigingslidmaatschap bestaat.
  }

  const cookieStore = await cookies();
  cookieStore.set(mobile ? mobileOtpEmailCookie : otpEmailCookie, emailResult.data, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: mobile ? '/app/auth/verify' : '/auth/verify',
    sameSite: 'strict',
    secure: new URL(appOrigin()).protocol === 'https:',
  });
  if(mobile)cookieStore.set(mobileReturnCookie,returnPath,{httpOnly:true,maxAge:10*60,path:'/app/auth/verify',sameSite:'strict',secure:new URL(appOrigin()).protocol==='https:'});
  redirect(mobile ? '/app/auth/verify?sent=1' : '/auth/verify?sent=1');
}

export async function verifyOtpAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return verifyOtp(false, formData);
}

export async function verifyMobileOtpAction(_previous: AuthActionState, formData: FormData): Promise<AuthActionState> {
  return verifyOtp(true, formData);
}

async function verifyOtp(mobile: boolean, formData: FormData): Promise<AuthActionState> {
  const cookieStore = await cookies();
  const emailResult = emailSchema.safeParse(cookieStore.get(mobile ? mobileOtpEmailCookie : otpEmailCookie)?.value);
  const tokenResult = otpSchema.safeParse(formData.get('token'));
  if (!emailResult.success || !tokenResult.success) {
    return {status: 'error', message: 'Vraag een nieuwe code aan en controleer de code uit je e-mail.'};
  }

  let returnPath=mobile?mobileReturnPath(cookieStore.get(mobileReturnCookie)?.value)??'/app/workspaces':'/workspaces';
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
      if (mobile) {cookieStore.delete({name: mobileOtpEmailCookie, path: '/app/auth/verify'});cookieStore.delete({name:mobileReturnCookie,path:'/app/auth/verify'});}
      else cookieStore.delete({name: otpEmailCookie, path: '/auth/verify'});
      return {status: 'error', message: 'Dit account heeft geen actieve verenigingswerkruimte. Neem contact op met de beheerder.'};
    }
    const tenant=mobile?mobileReturnTenant(returnPath):null;
    if(tenant){const target=await client.schema('api').from('my_workspaces').select('tenant_slug').eq('tenant_slug',tenant);if(target.error||!target.data?.some(row=>row.tenant_slug===tenant))returnPath='/app/workspaces';}
  } catch {
    return {status: 'error', message: 'Inloggen is nu niet beschikbaar. Probeer het later opnieuw.'};
  }
  if (mobile) {cookieStore.delete({name: mobileOtpEmailCookie, path: '/app/auth/verify'});cookieStore.delete({name:mobileReturnCookie,path:'/app/auth/verify'});}
  else cookieStore.delete({name: otpEmailCookie, path: '/auth/verify'});
  redirect(returnPath);
}

export async function signOutMobileAction(): Promise<void> {
  try {
    const client = await createSupabaseServerClient();
    await client.auth.signOut({scope: 'local'});
  } finally {
    const cookieStore = await cookies();
    cookieStore.delete({name: mobileOtpEmailCookie, path: '/app/auth/verify'});
    cookieStore.delete({name:mobileReturnCookie,path:'/app/auth/verify'});
    cookieStore.delete({name: 'cluvo_app_household_invitation', path: '/app/invite/accept'});
    redirect('/app/login');
  }
}

export async function signOutAction(): Promise<void> {
  try {
    const client = await createSupabaseServerClient();
    await client.auth.signOut({scope: 'local'});
  } finally {
    redirect('/login');
  }
}
