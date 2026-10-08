// Pure record validation. This module supplies NO bridge registration/authority.
// Only the operational collector's fixed bridge-owned reader can attest a source.
import {createHash} from 'node:crypto';
export const PROJECT='fbozlbgmktkgcdfqdaaz';
export const OFFICIAL_CA_SHA256='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
export const IMAGE='public.ecr.aws/supabase/postgres@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53';
export const SOCKET='unix:///run/user/1001/docker.sock';
export class SourceBindingError extends Error{constructor(code){super(code);this.code=code;}}
const requireValue=(value,code)=>{if(!value)throw new SourceBindingError(code);};
const isHash=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
function exact(value,keys){
 requireValue(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype,'CAPTURE_SOURCE_BINDING_UNKNOWN');
 const ds=Object.getOwnPropertyDescriptors(value);
 requireValue(Reflect.ownKeys(ds).length===keys.length&&keys.every(k=>Object.hasOwn(ds,k)&&Object.hasOwn(ds[k],'value')),'CAPTURE_SOURCE_BINDING_UNKNOWN');
 return Object.fromEntries(keys.map(k=>[k,ds[k].value]));
}
function frozen(value){if(value&&typeof value==='object'){for(const item of Object.values(value))frozen(item);Object.freeze(value);}return value;}
export function syntheticBinding(){return frozen({schema_version:1,source_scope:'SYNTHETIC_TEST_ONLY',actual_project_ref:null,intended_staging_project_ref:PROJECT,environment:'synthetic',transport:{client_tls:false,postgres_version:null,libpq_version:null},owned_clone:null});}
export function sourceBindingSnapshot(value){
 try{
  // Inspect the scope descriptor without invoking getters before exact shape.
  requireValue(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype,'CAPTURE_SOURCE_BINDING_UNKNOWN');
  const scope=Object.getOwnPropertyDescriptor(value,'source_scope');
  requireValue(scope&&Object.hasOwn(scope,'value'),'CAPTURE_SOURCE_BINDING_UNKNOWN');
  const common=['schema_version','source_scope','actual_project_ref','intended_staging_project_ref','environment'];
  let out;
  if(scope.value==='HOSTED_VERIFY_FULL'){
   out=exact(value,[...common,'target','transport']);
   requireValue(out.schema_version===1&&out.actual_project_ref===PROJECT&&out.intended_staging_project_ref===PROJECT&&out.environment==='staging','CAPTURE_HOSTED_SOURCE_LABEL_UNKNOWN');
   const t=exact(out.target,['database','host','port','username','mode']);
   const direct=t.mode==='direct'&&t.host==='db.'+PROJECT+'.supabase.co'&&t.username==='postgres';
   const pooler=t.mode==='session_pooler'&&typeof t.host==='string'&&/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(t.host)&&t.username==='postgres.'+PROJECT;
   requireValue(t.database==='postgres'&&t.port==='5432'&&(direct||pooler),'CAPTURE_HOSTED_TARGET_UNKNOWN');
   const r=exact(out.transport,['client_tls','client_tls_protocol','client_certificate_verified','ssl_mode','postgres_version','libpq_version','official_ca_sha256','bridge_source_sha256']);
   requireValue(r.client_tls===true&&['TLSv1.2','TLSv1.3'].includes(r.client_tls_protocol)&&r.client_certificate_verified===true&&r.ssl_mode==='verify-full'&&r.postgres_version===170011&&Number.isSafeInteger(r.libpq_version)&&r.libpq_version>0&&r.official_ca_sha256===OFFICIAL_CA_SHA256&&isHash(r.bridge_source_sha256),'CAPTURE_HOSTED_TRANSPORT_UNKNOWN');
   out.target=t;out.transport=r;
  }else if(scope.value==='LOCAL_OWNED_CLONE'){
   out=exact(value,[...common,'owned_clone','transport']);
   requireValue(out.schema_version===1&&out.actual_project_ref===null&&out.intended_staging_project_ref===PROJECT&&out.environment==='local','CAPTURE_LOCAL_SOURCE_LABEL_UNKNOWN');
   const clone=exact(out.owned_clone,['container_id','image_digest','daemon_socket','proof_binding_sha256']);
   requireValue(isHash(clone.container_id)&&clone.image_digest===IMAGE&&clone.daemon_socket===SOCKET&&isHash(clone.proof_binding_sha256),'CAPTURE_OWNED_CLONE_BINDING_UNKNOWN');
   const r=exact(out.transport,['client_tls','postgres_version','libpq_version']);
   requireValue(r.client_tls===false&&r.postgres_version===170011&&Number.isSafeInteger(r.libpq_version)&&r.libpq_version>0,'CAPTURE_LOCAL_TRANSPORT_UNKNOWN');
   out.owned_clone=clone;out.transport=r;
  }else if(scope.value==='SYNTHETIC_TEST_ONLY'){
   out=exact(value,[...common,'transport','owned_clone']);
   const r=exact(out.transport,['client_tls','postgres_version','libpq_version']);
   requireValue(out.schema_version===1&&out.actual_project_ref===null&&out.intended_staging_project_ref===PROJECT&&out.environment==='synthetic'&&out.owned_clone===null&&r.client_tls===false&&r.postgres_version===null&&r.libpq_version===null,'CAPTURE_SYNTHETIC_SOURCE_LABEL_UNKNOWN');
   out.transport=r;
  }else throw new SourceBindingError('CAPTURE_SOURCE_SCOPE_UNKNOWN');
  return frozen(out);
 }catch(error){throw error instanceof SourceBindingError?error:new SourceBindingError('CAPTURE_SOURCE_BINDING_UNKNOWN');}
}
export function sourceBindingHash(value){return createHash('sha256').update(JSON.stringify(sourceBindingSnapshot(value))).digest('hex');}
