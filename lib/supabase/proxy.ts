import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {supabasePublicConfig} from './config';
// Bouwsteen voor WP1; nog NIET gekoppeld aan de lokale demo-UI.
export async function updateSupabaseSession(request:NextRequest) {
  let response=NextResponse.next({request});
  const {url,publishableKey}=supabasePublicConfig();
  const client=createServerClient(url,publishableKey,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll:values=>{
      for (const {name,value} of values) request.cookies.set(name,value);
      response=NextResponse.next({request});
      for (const {name,value,options} of values) response.cookies.set(name,value,options);
    },
  }});
  const {data,error}=await client.auth.getClaims();
  response.headers.set('Cache-Control','private, no-store');
  // Alleen identiteit. Membership- en scopetoetsen blijven verplicht bij elke dataactie.
  return {response,claims:error?null:data?.claims??null};
}
