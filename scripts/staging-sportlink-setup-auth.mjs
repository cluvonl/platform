// An administrative recovery token creates only a genuine session for the
// exact already-confirmed identity. No mail, signup, password or administrative
// metadata update. Auth may update its recovery and sign-in lifecycle metadata.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=()=>{throw Object.assign(Error('STAGING_SPORTLINK_SETUP_AUTH_REFUSED'),{code:'STAGING_SPORTLINK_SETUP_AUTH_REFUSED'});};
const need=v=>{if(!v)fail();};
function exactUser(user,id,email){
 need(user&&user.id===id&&typeof user.email==='string'&&user.email.toLowerCase()===email.toLowerCase()
  &&typeof user.email_confirmed_at==='string'&&Number.isFinite(Date.parse(user.email_confirmed_at))
  &&user.is_anonymous!==true&&!user.deleted_at&&(!user.banned_until||Date.parse(user.banned_until)<=Date.now()));
}
async function existingSession({admin,client,recipient,authUserId,projectUrl,verifyNativeSession},fixedUrl){
 let issuedAccessToken,phase='INPUT';
 try{
  need(typeof recipient==='string'&&recipient.length<=254&&UUID.test(authUserId??'')
   &&projectUrl===fixedUrl&&typeof verifyNativeSession==='function');
  phase='EXISTING_IDENTITY';const before=await admin.auth.admin.getUserById(authUserId);need(before.error===null);exactUser(before.data?.user,authUserId,recipient);
  // Official Auth mail.go refuses recovery for an unknown user. Magic links
  // can create a signup, so this owner never calls the magiclink/signup route.
  phase='RECOVERY_TOKEN';const generated=await admin.auth.admin.generateLink({type:'recovery',email:recipient});need(generated.error===null);
  exactUser(generated.data?.user,authUserId,recipient);
  const properties=generated.data?.properties;
  need(properties?.verification_type==='recovery'&&typeof properties.hashed_token==='string'&&/^[a-f0-9]{40,128}$/i.test(properties.hashed_token));
  phase='VERIFY_RECOVERY';const verified=await client.auth.verifyOtp({token_hash:properties.hashed_token,type:'recovery'});
  issuedAccessToken=verified.data?.session?.access_token;
  need(verified.error===null);exactUser(verified.data?.user,authUserId,recipient);
  const session=verified.data?.session;
  need(typeof issuedAccessToken==='string'&&issuedAccessToken.length<=8192&&typeof session?.refresh_token==='string'&&session.refresh_token.length<=4096);
  phase='PROVIDER_GET_USER';const user=await client.auth.getUser(issuedAccessToken);need(user.error===null);exactUser(user.data?.user,authUserId,recipient);
  phase='VERIFIED_CLAIMS';const claims=await client.auth.getClaims(issuedAccessToken);need(claims.error===null);
  const c=claims.data?.claims;
  need(c?.sub===authUserId&&c.role==='authenticated'&&c.iss===projectUrl+'/auth/v1'&&UUID.test(c.session_id??'')
   &&Number.isSafeInteger(c.exp)&&c.exp>Math.floor(Date.now()/1000)+30);
  phase='NATIVE_SESSION';await verifyNativeSession(authUserId,c.session_id);
  phase='FINAL_IDENTITY';const after=await admin.auth.admin.getUserById(authUserId);need(after.error===null);exactUser(after.data?.user,authUserId,recipient);
  return Object.freeze({accessToken:issuedAccessToken,refreshToken:session.refresh_token,authUserId,sessionId:c.session_id});
 }catch{
  if(typeof issuedAccessToken==='string')try{await admin.auth.admin.signOut(issuedAccessToken,'local');}catch{}
  throw Object.assign(Error('STAGING_SPORTLINK_SETUP_AUTH_REFUSED_'+phase),{code:'STAGING_SPORTLINK_SETUP_AUTH_REFUSED_'+phase});
 }
}
export async function createExistingSportlinkOperatorSession(input){
 return existingSession(input,'https://fbozlbgmktkgcdfqdaaz.supabase.co');
}
// Separate local contract proof, never selected by an environment or dispatch
// input. The staging worker only imports the fixed hosted entry point above.
export async function createLocalExistingSportlinkOperatorSession(input){
 return existingSession(input,'http://127.0.0.1:55321');
}
export async function closeSportlinkOperatorSession(admin,session){
 need(session&&typeof session.accessToken==='string'&&UUID.test(session.authUserId??'')&&UUID.test(session.sessionId??''));
 const result=await admin.auth.admin.signOut(session.accessToken,'local');need(result.error===null);
 return {new_session_signed_out:true};
}
