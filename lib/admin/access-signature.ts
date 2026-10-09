function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export function adminAccessSignature(surface:'club'|'platform',access:{permissions:unknown;tenant_id?:string;status?:string;support?:unknown}){
 const ordered=(value:unknown)=>Array.isArray(value)?value.map(v=>JSON.stringify(canonical(v))).sort():[];
 return JSON.stringify([surface,access.tenant_id??null,access.status??null,ordered(access.permissions),ordered(access.support)]);
}
