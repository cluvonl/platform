// Additive PWA diagnostics. Private DDL is classified in memory; no result can
// authorize a restore, suppress the exact comparison, or return object names.
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
const HASH=/^[0-9a-f]{64}$/;
const FORMAT='PWA_CONSTRAINT_DEFINITION_DIAGNOSTICS_V1';
const CONTEXT_FORMAT='PWA_RESTORE_DEPARSE_CONTEXT_V1';
const MAX_DEFINITION=65_536,MAX_ENTRIES=8;
const contexts={
 time_zone:{known:['UTC','Etc/UTC','Europe/Amsterdam'],categories:{UTC:'UTC','Etc/UTC':'UTC','Europe/Amsterdam':'EUROPE_AMSTERDAM'}},
 date_style:{known:['ISO, MDY','ISO, DMY','ISO, YMD','SQL, MDY','SQL, DMY','SQL, YMD','Postgres, MDY','Postgres, DMY','Postgres, YMD','German, MDY','German, DMY','German, YMD']},
 interval_style:{known:['postgres','postgres_verbose','sql_standard','iso_8601']},
 search_path:{known:['pg_catalog','""',''],categories:{pg_catalog:'PG_CATALOG','""':'EMPTY','':'EMPTY'}},
 client_encoding:{known:['UTF8','SQL_ASCII','LATIN1']}
};
const schemaCategories={app:'APP',auth:'AUTH',api:'API',internal:'INTERNAL',supabase_migrations:'SUPABASE_MIGRATIONS',public:'PUBLIC',storage:'PROVIDER',extensions:'PROVIDER',vault:'PROVIDER',pgsodium:'PROVIDER',realtime:'PROVIDER',graphql:'PROVIDER',graphql_public:'PROVIDER',cron:'PROVIDER',net:'PROVIDER'};
const kindCategories={c:'CHECK',f:'FOREIGN_KEY',p:'PRIMARY_KEY',u:'UNIQUE',x:'EXCLUSION',n:'NOT_NULL'};
const FLAGS=['temporal_cast_present','temporal_literal_text_changed','string_literal_text_changed','numeric_literal_text_changed','whitespace_only','case_only_outside_literals','parenthesis_tokens_only','casts_changed','unchanged_after_literals_redacted'];
const GUC_FLAGS=['server_version_changed','time_zone_changed','date_style_changed','interval_style_changed','search_path_changed','extra_float_digits_changed','standard_conforming_strings_changed','quote_all_identifiers_changed','bytea_output_changed','client_encoding_changed'];
const own=(value,keys)=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==keys.length||!keys.every(key=>Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key],'value')))return null;
 return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
};
export const PWA_DEPARSE_CONTEXT_SQL="SELECT jsonb_build_object('server_version_num',current_setting('server_version_num')::int,'time_zone',current_setting('TimeZone'),'date_style',current_setting('DateStyle'),'interval_style',current_setting('IntervalStyle'),'search_path',current_setting('search_path'),'extra_float_digits',current_setting('extra_float_digits')::int,'standard_conforming_strings',current_setting('standard_conforming_strings')='on','quote_all_identifiers',current_setting('quote_all_identifiers')='on','bytea_output',current_setting('bytea_output'),'client_encoding',current_setting('client_encoding'));";
export function publicDeparseContext(raw){
 const keys=['server_version_num',...Object.keys(contexts),'extra_float_digits','standard_conforming_strings','quote_all_identifiers','bytea_output'];
 const value=own(raw,keys);
 if(!value||!Number.isSafeInteger(value.server_version_num)||value.server_version_num<100000||value.server_version_num>999999
  ||!Number.isSafeInteger(value.extra_float_digits)||value.extra_float_digits< -15||value.extra_float_digits>3
  ||typeof value.standard_conforming_strings!=='boolean'||typeof value.quote_all_identifiers!=='boolean'
  ||!['hex','escape'].includes(value.bytea_output))throw Error('PWA_DEPARSE_CONTEXT_UNKNOWN');
 const result={format:CONTEXT_FORMAT,server_version_num:value.server_version_num};
 for(const [key,{known,categories}]of Object.entries(contexts)){
  const text=value[key];
  if(typeof text!=='string'||Buffer.byteLength(text)>1024||/[\r\n\0]/.test(text))throw Error('PWA_DEPARSE_CONTEXT_UNKNOWN');
  result[key]={category:known.includes(text)?categories?.[text]??text:'OTHER',sha256:sha(text)};
 }
 return Object.freeze({...result,extra_float_digits:value.extra_float_digits,standard_conforming_strings:value.standard_conforming_strings,
  quote_all_identifiers:value.quote_all_identifiers,bytea_output:value.bytea_output});
}
function context(value){
 const keys=['format','server_version_num',...Object.keys(contexts),'extra_float_digits','standard_conforming_strings','quote_all_identifiers','bytea_output'];
 const row=own(value,keys);
 if(!row||row.format!==CONTEXT_FORMAT||!Number.isSafeInteger(row.server_version_num)||row.server_version_num<100000||row.server_version_num>999999
  ||!Number.isSafeInteger(row.extra_float_digits)||row.extra_float_digits< -15||row.extra_float_digits>3
  ||typeof row.standard_conforming_strings!=='boolean'||typeof row.quote_all_identifiers!=='boolean'||!['hex','escape'].includes(row.bytea_output))return null;
 const result={format:CONTEXT_FORMAT,server_version_num:row.server_version_num};
 for(const [key,{known,categories}]of Object.entries(contexts)){
  const field=own(row[key],['category','sha256']),allowed=['OTHER',...known.map(text=>categories?.[text]??text)];
  if(!field||!allowed.includes(field.category)||!HASH.test(field.sha256??''))return null;
  result[key]=Object.freeze({...field});
 }
 return Object.freeze({...result,extra_float_digits:row.extra_float_digits,standard_conforming_strings:row.standard_conforming_strings,
  quote_all_identifiers:row.quote_all_identifiers,bytea_output:row.bytea_output});
}
export function cloneDeparseSettingsSQL(sourceContext){
 // Reconstruct only exact native values already recognized and hashed by the
 // snapshot-bound bridge. No raw setting, caller SQL, or arbitrary identifier
 // is interpolated. This prefix is for owned clone sessions only.
 const source=context(sourceContext),fail=()=>{throw Error('RESTORE_DEPARSE_PROFILE_UNSUPPORTED');};
 if(!source||source.server_version_num!==170011||source.extra_float_digits<1||source.extra_float_digits>3
  ||source.standard_conforming_strings!==true||source.client_encoding.category!=='UTF8'
  ||source.client_encoding.sha256!==sha('UTF8')||source.search_path.category!=='PG_CATALOG'
  ||source.search_path.sha256!==sha('pg_catalog'))fail();
 const setting=key=>{
  const rule=contexts[key],value=rule.known.find(text=>source[key].sha256===sha(text)&&source[key].category===(rule.categories?.[text]??text));
  if(value===undefined)fail();return value;
 };
 const zone=setting('time_zone'),date=setting('date_style'),interval=setting('interval_style');
 return `SET TimeZone TO '${zone}';\nSET DateStyle TO '${date}';\nSET IntervalStyle TO '${interval}';\nSET extra_float_digits TO ${source.extra_float_digits};\nSET standard_conforming_strings TO on;\nSET quote_all_identifiers TO ${source.quote_all_identifiers?'on':'off'};\nSET bytea_output TO ${source.bytea_output};\nSET client_encoding TO 'UTF8';\nSET search_path TO pg_catalog;\n`;
}
function tokenize(text){
 const tokens=[];let i=0;
 while(i<text.length){
  const remaining=text.slice(i);
  const blank=remaining.match(/^\s+/);if(blank){i+=blank[0].length;continue;}
  if(remaining.startsWith('--')){const end=text.indexOf('\n',i);tokens.push({kind:'comment',value:text.slice(i,end<0?text.length:end)});i=end<0?text.length:end;continue;}
  if(remaining.startsWith('/*')){let end=i+2,depth=1;while(end<text.length&&depth){if(text.startsWith('/*',end)){depth++;end+=2;}else if(text.startsWith('*/',end)){depth--;end+=2;}else end++;}tokens.push({kind:'comment',value:text.slice(i,end)});i=end;continue;}
  if(text[i]==="'"||text[i]==='"'){
   const quote=text[i];let end=i+1;
   while(end<text.length){if(text[end]===quote){if(text[end+1]===quote){end+=2;continue;}end++;break;}if(text[end]==='\\'&&quote==="'"){end+=2;continue;}end++;}
   tokens.push({kind:quote==="'"?'string':'quoted',value:text.slice(i,end)});i=end;continue;
  }
  const word=remaining.match(/^[A-Za-z_][A-Za-z_0-9$]*/);if(word){tokens.push({kind:'word',value:word[0]});i+=word[0].length;continue;}
  const number=remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);if(number){tokens.push({kind:'number',value:number[0]});i+=number[0].length;continue;}
  const operator=remaining.match(/^(?:::|<=|>=|<>|!=|=>|\|\||[-+*/%=<>~!&|^?]+)/);
  if(operator){tokens.push({kind:'operator',value:operator[0]});i+=operator[0].length;continue;}
  tokens.push({kind:'punctuation',value:text[i++]});
 }
 return tokens;
}
const canonical=(tokens,{redact=false,lower=false,parens=false}={})=>JSON.stringify(tokens.filter(token=>!(parens&&['(',')'].includes(token.value))).map(token=>[token.kind,
 redact&&['string','number'].includes(token.kind)?'<LITERAL>':lower&&token.kind==='word'?token.value.toLowerCase():token.value]));
const casts=tokens=>tokens.flatMap((token,index)=>{
 if(token.value!=='::')return [];
 const type=[];for(let at=index+1;at<tokens.length&&type.length<8;at++){
  const next=tokens[at];if(!['word','quoted'].includes(next.kind)&&next.value!=='.')break;type.push(next.kind==='word'?next.value.toLowerCase():next.value);
 }
 return [type.join(' ')];
});
const temporal=type=>/(?:^|[ .])(?:timestamp|timestamptz|date|time|timetz|interval)(?:$|[ ])/i.test(type);
function flags(source,restored){
 const a=tokenize(source),b=tokenize(restored),aCasts=casts(a),bCasts=casts(b);
 const changed=kind=>a.some((token,index)=>token.kind===kind&&b[index]?.kind===kind&&token.value!==b[index].value);
 const temporalChanged=a.some((token,index)=>token.kind==='string'&&b[index]?.kind==='string'&&token.value!==b[index].value
  &&a[index+1]?.value==='::'&&temporal(casts(a.slice(index+1))[0]??'')
  &&b[index+1]?.value==='::'&&temporal(casts(b.slice(index+1))[0]??''));
 return {temporal_cast_present:aCasts.some(temporal)||bCasts.some(temporal),temporal_literal_text_changed:temporalChanged,
  string_literal_text_changed:changed('string'),numeric_literal_text_changed:changed('number'),
  whitespace_only:source!==restored&&canonical(a)===canonical(b),
  case_only_outside_literals:canonical(a)!==canonical(b)&&canonical(a,{lower:true})===canonical(b,{lower:true}),
  parenthesis_tokens_only:canonical(a)!==canonical(b)&&canonical(a,{parens:true})===canonical(b,{parens:true}),
  casts_changed:JSON.stringify(aCasts)!==JSON.stringify(bCasts),
  unchanged_after_literals_redacted:canonical(a,{redact:true,lower:true})===canonical(b,{redact:true,lower:true})};
}
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000;
export function publicRestoreDefinitionDiagnostics(input){
 const row=own(input,['format','changed_definition_rows','classified_rows','omitted_rows','source_deparse_context','restored_deparse_context','guc_difference_flags','entries','exact_comparison_rejected','semantic_equivalence_proven']);
 if(!row||row.format!==FORMAT||!['changed_definition_rows','classified_rows','omitted_rows'].every(key=>count(row[key]))
  ||row.changed_definition_rows!==row.classified_rows+row.omitted_rows||row.exact_comparison_rejected!==true||row.semantic_equivalence_proven!==false
  ||!Array.isArray(row.entries)||row.entries.length>MAX_ENTRIES||row.entries.length!==row.classified_rows)return null;
 const source=context(row.source_deparse_context),restored=context(row.restored_deparse_context);
 if((row.source_deparse_context!==null&&!source)||(row.restored_deparse_context!==null&&!restored))return null;
 const differences=own(row.guc_difference_flags,GUC_FLAGS);
 if(!differences||!GUC_FLAGS.every(key=>typeof differences[key]==='boolean'||differences[key]===null))return null;
 const entries=[];
 for(const item of row.entries){
  const entry=own(item,['schema_category','kind_category','source_definition_sha256','restored_definition_sha256','flags']);
  if(!entry||!['OTHER',...Object.values(schemaCategories)].includes(entry.schema_category)||!['OTHER',...Object.values(kindCategories)].includes(entry.kind_category)
   ||!HASH.test(entry.source_definition_sha256??'')||!HASH.test(entry.restored_definition_sha256??''))return null;
  const classification=own(entry.flags,FLAGS);if(!classification||!FLAGS.every(key=>typeof classification[key]==='boolean'))return null;
  entries.push(Object.freeze({...entry,flags:Object.freeze(classification)}));
 }
 return Object.freeze({...row,source_deparse_context:source,restored_deparse_context:restored,guc_difference_flags:Object.freeze(differences),entries:Object.freeze(entries)});
}
export function publicDeparseAlignment(input){
 const row=own(input,['format','used','scope','source_context','before_context','aligned_context','before_constraint_diagnostics',
  'exact_catalog_comparison_unchanged','source_settings_changed','provider_archive_process_settings_changed','source_database_mutated','semantic_differences_ignored']);
 if(!row||row.format!=='PWA_RESTORE_DEPARSE_ALIGNMENT_V1'||row.used!==true||row.scope!=='OWNED_CLONE_CONTROL_SESSIONS_ONLY'
  ||row.exact_catalog_comparison_unchanged!==true||row.source_settings_changed!==false||row.provider_archive_process_settings_changed!==false
  ||row.source_database_mutated!==false||row.semantic_differences_ignored!==false)return null;
 const source=context(row.source_context),before=context(row.before_context),aligned=context(row.aligned_context);
 const diagnostic=publicRestoreDefinitionDiagnostics(row.before_constraint_diagnostics);
 if(!source||!before||!aligned||JSON.stringify(source)!==JSON.stringify(aligned)||(row.before_constraint_diagnostics!==null&&!diagnostic))return null;
 return Object.freeze({...row,source_context:source,before_context:before,aligned_context:aligned,before_constraint_diagnostics:diagnostic});
}
export function publicConstraintDefinitionDiagnostics(sourceRows,restoredRows,{sourceContext=null,restoredContext=null}={}){
 const groups=new Map(),entries=[];let changed=0,omitted=0;
 if(!Array.isArray(sourceRows)||!Array.isArray(restoredRows)||sourceRows.length>1_000_000||restoredRows.length>1_000_000)return null;
 const key=row=>JSON.stringify([row?.schema,row?.relation,row?.name]);
 for(const row of restoredRows){const identity=key(row);if(!groups.has(identity))groups.set(identity,[]);groups.get(identity).push(row);}
 for(const expected of sourceRows){
  const group=groups.get(key(expected));if(!group?.length)continue;
  const exact=group.findIndex(row=>row?.definition===expected?.definition);
  if(exact>=0){group.splice(exact,1);continue;}
  const actual=group.shift();changed++;
  if(entries.length>=MAX_ENTRIES||typeof expected?.definition!=='string'||typeof actual?.definition!=='string'
   ||Buffer.byteLength(expected.definition)>MAX_DEFINITION||Buffer.byteLength(actual.definition)>MAX_DEFINITION){omitted++;continue;}
  entries.push({schema_category:schemaCategories[expected.schema]??'OTHER',kind_category:kindCategories[expected.kind]??'OTHER',
   source_definition_sha256:sha(expected.definition),restored_definition_sha256:sha(actual.definition),flags:flags(expected.definition,actual.definition)});
 }
 if(!changed)return null;
 const source=context(sourceContext),restored=context(restoredContext),guc_difference_flags={};
 for(const key of GUC_FLAGS){const name=key.replace(/_changed$/,'');
  guc_difference_flags[key]=source&&restored?(name==='server_version'?source.server_version_num!==restored.server_version_num
   :Object.hasOwn(contexts,name)?source[name].sha256!==restored[name].sha256:source[name]!==restored[name]):null;
 }
 return publicRestoreDefinitionDiagnostics({format:FORMAT,changed_definition_rows:changed,classified_rows:entries.length,omitted_rows:omitted,
  source_deparse_context:source,restored_deparse_context:restored,guc_difference_flags,entries,
  exact_comparison_rejected:true,semantic_equivalence_proven:false});
}
