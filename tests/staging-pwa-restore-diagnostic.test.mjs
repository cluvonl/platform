import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PWA_DEPARSE_CONTEXT_SQL,publicDeparseContext,cloneDeparseSettingsSQL,publicConstraintDefinitionDiagnostics,publicRestoreDefinitionDiagnostics,publicDeparseAlignment,publicSourceDeparseNormalization} from '../scripts/staging-pwa-restore-diagnostic.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const raw={server_version_num:170011,time_zone:'UTC',date_style:'ISO, MDY',interval_style:'postgres',search_path:'pg_catalog',extra_float_digits:1,standard_conforming_strings:true,quote_all_identifiers:false,bytea_output:'hex',client_encoding:'UTF8'};
const row=(definition,overrides={})=>({schema:'app',relation:'synthetic_private_relation',name:'synthetic_private_constraint',kind:'c',deferrable:false,deferred:false,validated:true,definition,...overrides});
const diagnose=(source,restored,options={})=>publicConstraintDefinitionDiagnostics([row(source)],[row(restored)],options);

test('deparser metadata query uses only fixed harmless setting names and does not set any source GUC',()=>{
 const settings=[...PWA_DEPARSE_CONTEXT_SQL.matchAll(/current_setting\('([^']+)'\)/g)].map(match=>match[1]);
 assert.deepEqual(settings,['server_version_num','TimeZone','DateStyle','IntervalStyle','search_path','extra_float_digits','standard_conforming_strings','quote_all_identifiers','bytea_output','client_encoding']);
 assert.match(PWA_DEPARSE_CONTEXT_SQL,/^SELECT /);assert.equal(/SHOW|set_config|SET |pg_settings|pg_read_file|PASSWORD|secret/i.test(PWA_DEPARSE_CONTEXT_SQL),false);
});

test('GUC projection reports whitelisted metadata and hashes unrecognized values without exporting their text',()=>{
 const context=publicDeparseContext({...raw,search_path:'synthetic_private_schema',time_zone:'synthetic_unknown_zone',client_encoding:'synthetic_unknown_encoding'});
 for(const [key,value]of [['search_path','synthetic_private_schema'],['time_zone','synthetic_unknown_zone'],['client_encoding','synthetic_unknown_encoding']]){
  assert.equal(context[key].category,'OTHER');assert.equal(context[key].sha256,hash(value));assert.equal(JSON.stringify(context).includes(value),false);
 }
 assert.equal(context.date_style.category,'ISO, MDY');assert.equal(context.server_version_num,170011);
 assert.ok(Object.isFrozen(context));
});

test('malformed GUC fields, arbitrary settings, inherited authority and accessors are refused without evaluation',()=>{
 for(const changed of [{...raw,server_version_num:true},{...raw,extra_float_digits:4},{...raw,search_path:'invalid\nprivate'},
  {...raw,standard_conforming_strings:'on'},{...raw,private_setting:'synthetic-secret'},Object.create(raw)])assert.throws(()=>publicDeparseContext(changed),/PWA_DEPARSE_CONTEXT_UNKNOWN/);
 let evaluated=false;const accessor={...raw};Object.defineProperty(accessor,'time_zone',{get(){evaluated=true;return 'synthetic-secret';}});
 assert.throws(()=>publicDeparseContext(accessor),/PWA_DEPARSE_CONTEXT_UNKNOWN/);assert.equal(evaluated,false);
});

test('clone session alignment reconstructs only exact known native values and rejects unknown or lossy profiles',()=>{
 const sql=cloneDeparseSettingsSQL(publicDeparseContext({...raw,time_zone:'Europe/Amsterdam',date_style:'SQL, DMY',interval_style:'sql_standard',extra_float_digits:3}));
 assert.match(sql,/SET TimeZone TO 'Europe\/Amsterdam';/);assert.match(sql,/SET DateStyle TO 'SQL, DMY';/);assert.match(sql,/SET IntervalStyle TO 'sql_standard';/);
 assert.match(sql,/SET extra_float_digits TO 3;/);assert.match(sql,/SET search_path TO pg_catalog;/);
 assert.equal(sql.split(';').filter(text=>text.trim()).length,9);
 for(const changed of [{...raw,time_zone:'synthetic_private_zone'},{...raw,search_path:'synthetic_private_schema'},
  {...raw,date_style:'synthetic_private_style'},{...raw,interval_style:'synthetic_private_interval'},
  {...raw,extra_float_digits:0},{...raw,extra_float_digits:-1},{...raw,standard_conforming_strings:false},
  {...raw,client_encoding:'LATIN1'},{...raw,server_version_num:170012}])assert.throws(()=>cloneDeparseSettingsSQL(publicDeparseContext(changed)),/RESTORE_DEPARSE_PROFILE_UNSUPPORTED/);
 const forged=publicDeparseContext(raw);assert.throws(()=>cloneDeparseSettingsSQL({...forged,time_zone:{category:'UTC',sha256:hash('synthetic-private')}}),/RESTORE_DEPARSE_PROFILE_UNSUPPORTED/);
});

test('constraint classification exports hashes and bounded categories while preserving exact rejection',()=>{
 const a="CHECK ((synthetic_private_column > '2026-10-09 10:00:00+02'::timestamp with time zone))";
 const b="CHECK ((synthetic_private_column > '2026-10-09 08:00:00+00'::timestamp with time zone))";
 const sourceContext=publicDeparseContext({...raw,time_zone:'Europe/Amsterdam'}),restoredContext=publicDeparseContext({...raw,search_path:''});
 const result=diagnose(a,b,{sourceContext,restoredContext});
 assert.equal(result.changed_definition_rows,1);assert.equal(result.entries[0].schema_category,'APP');assert.equal(result.entries[0].kind_category,'CHECK');
 assert.equal(result.entries[0].source_definition_sha256,hash(a));assert.equal(result.entries[0].restored_definition_sha256,hash(b));
 assert.equal(result.entries[0].flags.temporal_cast_present,true);assert.equal(result.entries[0].flags.temporal_literal_text_changed,true);
 assert.equal(result.guc_difference_flags.time_zone_changed,true);assert.equal(result.guc_difference_flags.search_path_changed,true);
 assert.equal(result.guc_difference_flags.date_style_changed,false);assert.equal(result.exact_comparison_rejected,true);assert.equal(result.semantic_equivalence_proven,false);
 for(const privateText of ['synthetic_private_relation','synthetic_private_constraint','synthetic_private_column','2026-10-09'])assert.equal(JSON.stringify(result).includes(privateText),false);
 assert.deepEqual(publicRestoreDefinitionDiagnostics(result),result);
});

test('numeric semantic change and changed timestamp boundaries cannot become restore permission',()=>{
 for(const [a,b,flag]of [["CHECK (credit >= 120)","CHECK (credit >= 121)",'numeric_literal_text_changed'],
  ["CHECK (happened_at > '2026-10-09'::date)","CHECK (happened_at > '2026-10-10'::date)",'temporal_literal_text_changed']]){
  const result=diagnose(a,b);
  assert.equal(result.entries[0].flags[flag],true);assert.equal(result.entries[0].flags.unchanged_after_literals_redacted,true);
  assert.equal(result.exact_comparison_rejected,true);assert.equal(result.semantic_equivalence_proven,false);
  assert.ok(Object.values(result.guc_difference_flags).every(value=>value===null));
 }
});

test('lexical classifiers preserve literal contents and do not equate comments or arbitrary semantics',()=>{
 assert.equal(diagnose("CHECK (value > 1)","CHECK  ( value > 1 )").entries[0].flags.whitespace_only,true);
 assert.equal(diagnose("CHECK (value > 1)","check (VALUE > 1)").entries[0].flags.case_only_outside_literals,true);
 assert.equal(diagnose("CHECK (value = 'AB')","check (value = 'ab')").entries[0].flags.case_only_outside_literals,false);
 assert.equal(diagnose("CHECK (value > 1)","CHECK (value < 1)").entries[0].flags.unchanged_after_literals_redacted,false);
 assert.equal(diagnose("CHECK (value > 1)","CHECK (value > 1) /* private comment */").entries[0].flags.whitespace_only,false);
 assert.equal(diagnose("CHECK (value > 1)","CHECK ((value > 1))").entries[0].flags.parenthesis_tokens_only,true);
 assert.equal(diagnose("CHECK (value::date > '2026-10-09'::date)","CHECK (value::timestamp > '2026-10-09'::date)").entries[0].flags.casts_changed,true);
});

test('unchanged definitions, foreign identities and non-definition differences do not invent a diagnosis',()=>{
 assert.equal(diagnose('CHECK (value > 1)','CHECK (value > 1)'),null);
 assert.equal(publicConstraintDefinitionDiagnostics([row('CHECK (value > 1)')],[row('CHECK (value > 2)',{name:'different_private_constraint'})]),null);
 assert.equal(publicConstraintDefinitionDiagnostics([row('CHECK (value > 1)')],[row('CHECK (value > 1)',{validated:false})]),null);
});

test('diagnostics cap rows and DDL size and never copy unknown schema or kind strings',()=>{
 const source=Array.from({length:10},(_,index)=>row('CHECK (value > 1)',{name:'synthetic_private_constraint_'+index,schema:'synthetic_private_schema',kind:'private_kind'}));
 const restored=source.map(value=>({...value,definition:'CHECK (value > 2)'}));
 source[9].definition='X'.repeat(65_537);
 const result=publicConstraintDefinitionDiagnostics(source,restored);
 assert.equal(result.changed_definition_rows,10);assert.equal(result.classified_rows,8);assert.equal(result.omitted_rows,2);assert.equal(result.entries.length,8);
 for(const entry of result.entries){assert.equal(entry.schema_category,'OTHER');assert.equal(entry.kind_category,'OTHER');}
 assert.equal(JSON.stringify(result).includes('synthetic_private_schema'),false);assert.equal(JSON.stringify(result).includes('private_kind'),false);
 const oversized=diagnose('X'.repeat(65_537),'Y');assert.equal(oversized.classified_rows,0);assert.equal(oversized.omitted_rows,1);
});

test('public error projection rejects injected fields, raw definitions, fake hashes or any equality authorization',()=>{
 const original=diagnose('CHECK (value > 1)','CHECK (value > 2)');
 for(const changed of [{...original,definition:'synthetic-private'}, {...original,semantic_equivalence_proven:true},
  {...original,exact_comparison_rejected:false},{...original,entries:[{...original.entries[0],definition:'private'}]},
  {...original,entries:[{...original.entries[0],source_definition_sha256:'unknown'}]},
  {...original,guc_difference_flags:{...original.guc_difference_flags,private_setting:true}}])assert.equal(publicRestoreDefinitionDiagnostics(changed),null);
 let evaluated=false;const accessor={...original};Object.defineProperty(accessor,'entries',{get(){evaluated=true;throw Error('private');}});
 assert.equal(publicRestoreDefinitionDiagnostics(accessor),null);assert.equal(evaluated,false);
});

test('alignment projection requires actual identical source/aligned contexts and cannot claim source writes or ignored differences',()=>{
 const source=publicDeparseContext(raw),before=publicDeparseContext({...raw,time_zone:'Europe/Amsterdam',search_path:''});
 const alignment={format:'PWA_RESTORE_DEPARSE_ALIGNMENT_V2',used:true,scope:'OWNED_CLONE_CONTROL_SESSIONS_ONLY',source_context:source,before_context:before,
  aligned_context:source,before_constraint_diagnostics:null,exact_catalog_comparison_unchanged:true,source_global_or_database_settings_changed:false,
  provider_archive_process_settings_changed:false,source_database_mutated:false,semantic_differences_ignored:false};
 assert.deepEqual(publicDeparseAlignment(alignment),alignment);
 for(const changed of [{...alignment,aligned_context:before},{...alignment,scope:'SOURCE'}, {...alignment,source_database_mutated:true},
  {...alignment,semantic_differences_ignored:true},{...alignment,private_sql:'synthetic-private'}])assert.equal(publicDeparseAlignment(changed),null);
});

const sourceNormalization=()=>({format:'PWA_SOURCE_DEPARSE_NORMALIZATION_V1',used:true,scope:'SOURCE_READ_ONLY_CONTROL_SESSION_ONLY',phase:'capture',
 original_context:{...raw,extra_float_digits:0},effective_context:{...raw,extra_float_digits:3},fixed_extra_float_digits:3,transaction_local:true,
 source_read_only_control_session_setting_changed:true,same_backend_verified:true,same_snapshot_verified:true,read_only:true,isolation:'repeatable read',
 source_global_or_database_settings_changed:false,provider_archive_process_settings_changed:false,source_database_mutated:false,row_or_catalog_values_rewritten:false});

test('source precision proof distinguishes observed zero from fixed session-local lossless precision without changing clone authority',()=>{
 const proof=publicSourceDeparseNormalization(sourceNormalization());
 assert.equal(proof.original_context.extra_float_digits,0);assert.equal(proof.effective_context.extra_float_digits,3);
 assert.equal(proof.source_read_only_control_session_setting_changed,true);assert.equal(proof.source_global_or_database_settings_changed,false);
 assert.equal(proof.scope,'SOURCE_READ_ONLY_CONTROL_SESSION_ONLY');assert.ok(Object.isFrozen(proof));
 assert.throws(()=>cloneDeparseSettingsSQL(proof.original_context),/RESTORE_DEPARSE_PROFILE_UNSUPPORTED/);
 assert.match(cloneDeparseSettingsSQL(proof.effective_context),/SET extra_float_digits TO 3;/);
 const already=publicSourceDeparseNormalization({...sourceNormalization(),phase:'fresh_read',original_context:{...raw,extra_float_digits:3},source_read_only_control_session_setting_changed:false});
 assert.equal(already.source_read_only_control_session_setting_changed,false);
 const unknown=publicSourceDeparseNormalization({...sourceNormalization(),original_context:{...raw,extra_float_digits:0,time_zone:'synthetic_private_zone'},effective_context:{...raw,extra_float_digits:3,time_zone:'synthetic_private_zone'}});
 assert.equal(JSON.stringify(unknown).includes('synthetic_private_zone'),false);
});

test('source precision proof cannot authorize source writes, lossy capture, another setting, foreign scope or forged snapshot evidence',()=>{
 const good=sourceNormalization();
 for(const change of [{effective_context:{...raw,extra_float_digits:0}},{effective_context:{...raw,extra_float_digits:3,time_zone:'Europe/Amsterdam'}},
  {phase:'locked'},{scope:'GLOBAL_DATABASE'},{fixed_extra_float_digits:1},{transaction_local:false},{read_only:false},{isolation:'read committed'},
  {same_backend_verified:false},{same_snapshot_verified:false},{source_read_only_control_session_setting_changed:false},
  {source_global_or_database_settings_changed:true},{provider_archive_process_settings_changed:true},{source_database_mutated:true},{row_or_catalog_values_rewritten:true},
  {private_setting:'synthetic-secret'},{original_context:{...good.original_context,private_setting:'synthetic-secret'}}])assert.throws(()=>publicSourceDeparseNormalization({...good,...change}),/PWA_SOURCE_PRECISION_UNPROVED/);
 assert.throws(()=>publicSourceDeparseNormalization(Object.create(good)),/PWA_SOURCE_PRECISION_UNPROVED/);
 let touched=false;const accessor={...good};Object.defineProperty(accessor,'original_context',{get(){touched=true;throw Error('synthetic-private');}});
 assert.throws(()=>publicSourceDeparseNormalization(accessor),/PWA_SOURCE_PRECISION_UNPROVED/);assert.equal(touched,false);
});
