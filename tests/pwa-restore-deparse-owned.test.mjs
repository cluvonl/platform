// Public synthetic DDL only. This opt-in experiment owns an isolated PG17 and
// two databases; it never receives a hosted backup, source role or credential.
import test from 'node:test';
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {IMAGE} from '../scripts/pg17-capture-worker.mjs';
import {INITIAL_RESTORE_STARTUP} from '../scripts/staging-pwa-upgrade-restore.mjs';
import {CATALOG_QUERIES} from '../scripts/staging-capture-catalog.mjs';
import {aggregate} from '../scripts/staging-capture-queries.mjs';
import {catalogMismatchDiagnostic} from '../scripts/staging-catalog-diagnostic.mjs';
import {PWA_DEPARSE_CONTEXT_SQL,publicDeparseContext,cloneDeparseSettingsSQL,publicConstraintDefinitionDiagnostics,publicRestoreDefinitionDiagnostics} from '../scripts/staging-pwa-restore-diagnostic.mjs';

const literal=value=>"'"+value.replaceAll("'","''")+"'";
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceDatabase='deparse_source',restoredDatabase='deparse_restored';
const table='public.pwa_restore_deparse_fixture';
const syntheticDdl=`CREATE TABLE ${table}(
 id integer PRIMARY KEY,
 happened_at timestamptz NOT NULL,
 fixed_date date NOT NULL,
 duration interval NOT NULL,
 credit numeric(10,2) NOT NULL,
 CONSTRAINT pwa_restore_deparse_bound CHECK(
  happened_at >= TIMESTAMPTZ '2026-10-09 12:34:56+00'
  AND fixed_date >= DATE '2026-10-09'
  AND duration >= INTERVAL '1 day 02:03:04'
  AND credit >= NUMERIC '123.45'
 )
);`;
const base={timezone:'UTC',datestyle:'ISO, MDY',intervalstyle:'postgres',search_path:'pg_catalog'};
const variants=[
 {name:'timezone',settings:{...base,timezone:'Europe/Amsterdam'}},
 {name:'datestyle',settings:{...base,datestyle:'SQL, DMY'}},
 {name:'intervalstyle',settings:{...base,intervalstyle:'sql_standard'}},
 {name:'search_path',settings:{...base,search_path:'public'}},
];
const settingsSql=settings=>Object.entries(settings).map(([key,value])=>`SET ${key} TO ${literal(value)};`).join('\n');
const catalogSql='SELECT jsonb_build_object('+Object.entries(CATALOG_QUERIES).map(([family,query])=>literal(family)+',('+aggregate(query)+')').join(',')+');';
const validRow="(1,'2026-10-09 12:34:56+00','2026-10-09','1 day 02:03:04',123.45)";
const inspectFormat='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"config_image":{{json .Config.Image}},"label":{{json (index .Config.Labels "cluvo.pwa.deparse-test")}},"network":{{json .HostConfig.NetworkMode}},"ports":{{json .HostConfig.PortBindings}},"binds":{{json .HostConfig.Binds}},"mounts":{{json .Mounts}},"privileged":{{json .HostConfig.Privileged}},"log":{{json .HostConfig.LogConfig.Type}},"restart":{{json .HostConfig.RestartPolicy.Name}},"user":{{json .Config.User}}}';

test('actual owned PG17: formatter changes constraint text without authorizing comparison or semantic drift',
 {skip:process.env.CLUVO_PWA_DEPARSE_NATIVE_TESTS!=='owned-pg17',timeout:90000},async t=>{
 const socket='unix:///run/user/1001/docker.sock';
 const name='cluvo-pwa-deparse-test-'+randomBytes(12).toString('hex');
 let id,imageId,created=false,removed=false;
 const run=(args,input)=>spawnSync('/usr/bin/docker',['--host',socket,...args],{
  input,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},timeout:30000,maxBuffer:2_000_000,
 });
 const checked=(args,input)=>{const result=run(args,input);assert.equal(result.status,0,'OWNED_DEPARSE_PROCESS_FAILED');assert.equal(result.stderr.length,0,'OWNED_DEPARSE_PROCESS_WARNING');return result.stdout;};
 const sql=(database,text,{expectedFailure=false}={})=>{
  const result=run(['exec','-i',id,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=sqlstate','-h','/restore','-U','supabase_admin','-d',database],
   'SET client_min_messages=warning;\n'+text);
  if(expectedFailure){assert.notEqual(result.status,0,'OWNED_DEPARSE_NEGATIVE_ACCEPTED');assert.match(result.stderr.toString(),/23514/);return;}
  assert.equal(result.status,0,'OWNED_DEPARSE_SQL_FAILED');assert.equal(result.stderr.length,0,'OWNED_DEPARSE_SQL_WARNING');return result.stdout.toString().trim();
 };
 const json=(database,text)=>JSON.parse(sql(database,text));
 const constraintRows=(database,settings=base)=>json(database,settingsSql(settings)+'\n'+aggregate(CATALOG_QUERIES.constraints));
 const catalogs=(database,settings=base)=>json(database,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+settingsSql(settings)+'\n'+catalogSql+'\nROLLBACK;');
 const deparseContext=(database,settings=base)=>publicDeparseContext(json(database,settingsSql(settings)+'\n'+PWA_DEPARSE_CONTEXT_SQL));
 const safeDiagnostic=(source,restored,sourceContext,restoredContext)=>{
  const diagnostic=publicConstraintDefinitionDiagnostics(source,restored,{sourceContext,restoredContext});
  assert.equal(diagnostic.exact_comparison_rejected,true);assert.equal(diagnostic.semantic_equivalence_proven,false);
  assert.equal(diagnostic.changed_definition_rows,1);assert.equal(diagnostic.classified_rows,1);assert.equal(diagnostic.omitted_rows,0);
  assert.deepEqual(publicRestoreDefinitionDiagnostics(diagnostic),diagnostic);
  const changed=source.find(row=>!restored.some(other=>isDeepStrictEqual(other,row)));
  const actual=restored.find(row=>row.schema===changed.schema&&row.relation===changed.relation&&row.name===changed.name);
  const entry=diagnostic.entries[0];assert.equal(entry.schema_category,'PUBLIC');assert.equal(entry.kind_category,'CHECK');
  assert.equal(entry.source_definition_sha256,hash(changed.definition));assert.equal(entry.restored_definition_sha256,hash(actual.definition));
  const publicText=JSON.stringify(diagnostic);
  for(const row of [...source,...restored]){
   assert.equal(publicText.includes(row.relation),false,'OWNED_DEPARSE_RELATION_LEAK');
   assert.equal(publicText.includes(row.name),false,'OWNED_DEPARSE_CONSTRAINT_LEAK');
   assert.equal(publicText.includes(row.definition),false,'OWNED_DEPARSE_DEFINITION_LEAK');
  }
  for(const literal of ['2026-10-09','09/10/2026','123.45','123.46'])assert.equal(publicText.includes(literal),false,'OWNED_DEPARSE_LITERAL_LEAK');
  return diagnostic;
 };
 const guard=()=>{
  const value=JSON.parse(checked(['inspect',id,'--format',inspectFormat]).toString());
  assert.equal(value.id,id);assert.equal(value.name,'/'+name);assert.equal(value.label,name);
  assert.equal(value.image,imageId);assert.equal(value.config_image,IMAGE);assert.equal(value.user,'postgres');
  assert.equal(value.network,'none');assert.ok(value.ports===null||Object.keys(value.ports).length===0);
  assert.equal(value.binds,null);assert.ok(value.mounts.every(m=>m.Type==='tmpfs'));assert.equal(value.privileged,false);
  assert.equal(value.log,'none');assert.equal(value.restart,'no');
 };
 let proof;
 try{
  const image=JSON.parse(checked(['image','inspect',IMAGE,'--format','{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']).toString());
  assert.ok(image.digests.includes(IMAGE));imageId=image.id;
  const missing=run(['inspect',name]);assert.equal(missing.status,1);
  created=true;
  id=checked(['create','--pull=never','--name',name,'--label','cluvo.pwa.deparse-test='+name,'--network=none',
   '--restart=no','--log-driver=none','--no-healthcheck','--user=postgres','--cap-drop=ALL','--security-opt=no-new-privileges',
   '--pids-limit=64','--memory=512m','--cpus=1','--tmpfs','/restore:rw,size=512m,mode=1777','--entrypoint','/bin/sh',
   IMAGE,'-c',INITIAL_RESTORE_STARTUP,'cluvo-pwa-deparse-test','supabase_admin']).toString().trim();
  assert.match(id,/^[0-9a-f]{64}$/);guard();checked(['start',id]);
  let ready=false;
  for(let attempt=0;attempt<50;attempt++){
   if(run(['exec',id,'pg_isready','-h','/restore','-U','supabase_admin','-d','postgres']).status===0){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(ready,true,'OWNED_DEPARSE_READY_REQUIRED');guard();
  const version=json('postgres',"SELECT jsonb_build_object('server_version_num',current_setting('server_version_num')::int,'server_version',current_setting('server_version')); ");
  assert.ok(version.server_version_num>=170000&&version.server_version_num<180000);
  sql('postgres',`CREATE DATABASE ${sourceDatabase};CREATE DATABASE ${restoredDatabase};`);
  sql(sourceDatabase,settingsSql(base)+'\n'+syntheticDdl);
  const baseline=constraintRows(sourceDatabase);
  const sourceContext=deparseContext(sourceDatabase);
  assert.equal(baseline.length,2);
  const formatter=[];
  for(const variant of variants){
   const actual=constraintRows(sourceDatabase,variant.settings);
   const changed=!isDeepStrictEqual(baseline,actual);
   if(variant.name==='search_path')assert.equal(changed,false);
   else assert.equal(changed,true,'OWNED_DEPARSE_FORMATTER_CHANGE_UNPROVED');
   let definitionDiagnostic=null;
   if(changed){
    const diagnostic=catalogMismatchDiagnostic('constraints',baseline,actual);
    assert.equal(diagnostic.changed_rows,1);assert.equal(diagnostic.missing_rows,0);assert.equal(diagnostic.extra_rows,0);
    assert.deepEqual(diagnostic.changed_fields,['definition']);
    definitionDiagnostic=safeDiagnostic(baseline,actual,sourceContext,deparseContext(sourceDatabase,variant.settings));
    assert.equal(definitionDiagnostic.entries[0].flags.temporal_cast_present,true);
    assert.equal(definitionDiagnostic.entries[0].flags.temporal_literal_text_changed,true);
    assert.equal(definitionDiagnostic.entries[0].flags.unchanged_after_literals_redacted,true);
    const gucKey={timezone:'time_zone_changed',datestyle:'date_style_changed',intervalstyle:'interval_style_changed'}[variant.name];
    assert.equal(definitionDiagnostic.guc_difference_flags[gucKey],true);
   }
   sql(sourceDatabase,settingsSql(variant.settings)+`\nBEGIN;INSERT INTO ${table} VALUES ${validRow};ROLLBACK;`);
   sql(sourceDatabase,settingsSql(variant.settings)+`\nINSERT INTO ${table} VALUES (2,'2026-10-09 12:34:56+00','2026-10-09','1 day 02:03:04',123.44);`,{expectedFailure:true});
   formatter.push({setting:variant.name,definition_changed:changed,exact_comparison_rejected:changed,same_valid_row_accepted:true,same_below_threshold_row_rejected:true,definition_diagnostics:definitionDiagnostic});
  }
  const archive=checked(['exec',id,'pg_dump','-h','/restore','-U','supabase_admin','-d',sourceDatabase,'--schema-only','--format=custom','--no-owner','--no-acl']);
  assert.equal(archive.subarray(0,5).toString(),'PGDMP');assert.ok(archive.length<1_000_000);
  checked(['exec','-i',id,'pg_restore','-h','/restore','-U','supabase_admin','-d',restoredDatabase,'--single-transaction','--exit-on-error','--no-owner','--no-acl'],archive);
  const restored=constraintRows(restoredDatabase);
  assert.deepEqual(restored,baseline,'OWNED_DEPARSE_RESTORE_UNEQUAL_WITH_SAME_SETTINGS');
  const sourceCatalog=catalogs(sourceDatabase),restoredCatalog=catalogs(restoredDatabase);
  assert.equal(Object.keys(CATALOG_QUERIES).length,28);assert.deepEqual(Object.keys(sourceCatalog).sort(),Object.keys(CATALOG_QUERIES).sort());
  assert.deepEqual(restoredCatalog,sourceCatalog,'OWNED_DEPARSE_RESTORE_CATALOG28_UNEQUAL');
  const alternate={timezone:'Europe/Amsterdam',datestyle:'SQL, DMY',intervalstyle:'sql_standard',search_path:'public'};
  const alternateRestored=constraintRows(restoredDatabase,alternate);
  const alternateCatalog=catalogs(restoredDatabase,alternate);
  assert.equal(isDeepStrictEqual(sourceCatalog,alternateCatalog),false,'OWNED_DEPARSE_ALTERNATE_CATALOG28_ACCEPTED');
  const alternateChangedFamilies=Object.keys(CATALOG_QUERIES).filter(family=>!isDeepStrictEqual(sourceCatalog[family],alternateCatalog[family]));
  assert.deepEqual(alternateChangedFamilies,['constraints']);
  assert.equal(isDeepStrictEqual(baseline,alternateRestored),false);
  assert.equal(catalogMismatchDiagnostic('constraints',baseline,alternateRestored).changed_rows,1);
  const alternateDiagnostic=safeDiagnostic(baseline,alternateRestored,sourceContext,deparseContext(restoredDatabase,alternate));
  assert.equal(alternateDiagnostic.guc_difference_flags.time_zone_changed,true);
  assert.equal(alternateDiagnostic.guc_difference_flags.date_style_changed,true);
  assert.equal(alternateDiagnostic.guc_difference_flags.interval_style_changed,true);
  assert.equal(alternateDiagnostic.guc_difference_flags.search_path_changed,true);
  const alignment=cloneDeparseSettingsSQL(sourceContext);
  assert.equal(alignment.split('\n').filter(line=>line.startsWith('SET ')).length,9);
  const divergentSession={...alternate,extra_float_digits:'3',quote_all_identifiers:'on',bytea_output:'escape'};
  const alignedReadback=(before='',after='')=>{
   const value=json(restoredDatabase,'BEGIN;\n'+settingsSql(divergentSession)+'\n'+alignment+before+'\n'+
    "SELECT jsonb_build_object('context',("+PWA_DEPARSE_CONTEXT_SQL.replace(/;$/,'')+"),'catalog',("+catalogSql.replace(/;$/,'')+'));\n'+after+'\nROLLBACK;');
   assert.deepEqual(publicDeparseContext(value.context),sourceContext,'OWNED_DEPARSE_ALIGNMENT_CONTEXT_UNEQUAL');
   return value.catalog;
  };
  assert.deepEqual(alignedReadback(),sourceCatalog,'OWNED_DEPARSE_ALIGNED_CATALOG28_UNEQUAL');
  const missingTableCatalog=alignedReadback(`DROP TABLE ${table};`);
  assert.equal(isDeepStrictEqual(missingTableCatalog,sourceCatalog),false,'OWNED_DEPARSE_ALIGNED_MISSING_TABLE_ACCEPTED');
  assert.equal(catalogMismatchDiagnostic('relations',sourceCatalog.relations,missingTableCatalog.relations).missing_rows,1);
  const extraTableCatalog=alignedReadback('CREATE TABLE public.pwa_restore_deparse_extra(id integer);');
  assert.equal(isDeepStrictEqual(extraTableCatalog,sourceCatalog),false,'OWNED_DEPARSE_ALIGNED_EXTRA_TABLE_ACCEPTED');
  assert.equal(catalogMismatchDiagnostic('relations',sourceCatalog.relations,extraTableCatalog.relations).extra_rows,1);
  const aclDriftCatalog=alignedReadback(`GRANT SELECT ON TABLE ${table} TO PUBLIC;`);
  assert.equal(isDeepStrictEqual(aclDriftCatalog,sourceCatalog),false,'OWNED_DEPARSE_ALIGNED_ACL_DRIFT_ACCEPTED');
  assert.equal(catalogMismatchDiagnostic('relations',sourceCatalog.relations,aclDriftCatalog.relations).acl_extra_entries,1);
  assert.deepEqual(alignedReadback(),sourceCatalog,'OWNED_DEPARSE_NEGATIVE_ROLLBACK_UNPROVED');
  sql(restoredDatabase,settingsSql(base)+`\nALTER TABLE ${table} DROP CONSTRAINT pwa_restore_deparse_bound;
   ALTER TABLE ${table} ADD CONSTRAINT pwa_restore_deparse_bound CHECK(
    happened_at >= TIMESTAMPTZ '2026-10-09 12:34:56+00' AND fixed_date >= DATE '2026-10-09'
    AND duration >= INTERVAL '1 day 02:03:04' AND credit >= NUMERIC '123.46');`);
  const semantic=constraintRows(restoredDatabase);
  const semanticCatalog=catalogs(restoredDatabase);
  assert.equal(isDeepStrictEqual(sourceCatalog,semanticCatalog),false,'OWNED_DEPARSE_SEMANTIC_CATALOG28_ACCEPTED');
  assert.deepEqual(Object.keys(CATALOG_QUERIES).filter(family=>!isDeepStrictEqual(sourceCatalog[family],semanticCatalog[family])),['constraints']);
  const alignedSemantic=alignedReadback();
  assert.equal(isDeepStrictEqual(sourceCatalog,alignedSemantic),false,'OWNED_DEPARSE_ALIGNMENT_SEMANTIC_CHANGE_ACCEPTED');
  assert.deepEqual(Object.keys(CATALOG_QUERIES).filter(family=>!isDeepStrictEqual(sourceCatalog[family],alignedSemantic[family])),['constraints']);
  assert.equal(isDeepStrictEqual(baseline,semantic),false);
  assert.equal(catalogMismatchDiagnostic('constraints',baseline,semantic).changed_rows,1);
  const semanticDiagnostic=safeDiagnostic(baseline,semantic,sourceContext,deparseContext(restoredDatabase));
  assert.equal(semanticDiagnostic.entries[0].flags.numeric_literal_text_changed,true);
  assert.equal(semanticDiagnostic.entries[0].flags.temporal_literal_text_changed,false);
  assert.equal(semanticDiagnostic.entries[0].flags.unchanged_after_literals_redacted,true);
  assert.ok(Object.values(semanticDiagnostic.guc_difference_flags).every(value=>value===false));
  sql(restoredDatabase,settingsSql(base)+`\nINSERT INTO ${table} VALUES ${validRow};`,{expectedFailure:true});
  proof={scope:'LOCAL_OWNED_PG17_SYNTHETIC_DEPARSE',public_synthetic_ddl_only:true,pinned_image:IMAGE,server_version:version.server_version,
   network:'none',owned_databases:2,hosted_connections:0,shared_database_connections:0,credentials_received:false,private_backups_received:false,
   constraint_rows:2,formatter,actual_custom_schema_archive_restore:true,restore_equal_under_identical_settings:true,
   exact_catalog_families_compared:28,all_catalogs_equal_under_identical_settings:true,
   catalog_family_row_counts:Object.fromEntries(Object.entries(sourceCatalog).map(([family,rows])=>[family,rows.length])),
   alternate_formatter_changed_catalog_families:alternateChangedFamilies,alternate_formatter_catalog_comparison_rejected:true,
   actual_semantic_change_catalog_comparison_rejected:true,
   clone_session_alignment:{known_source_context_only:true,fixed_set_statements:9,actual_clone_context_equals_source:true,
    all28_raw_catalogs_equal_after_session_alignment:true,query_bytes_redefined:false,comparison_normalized:false,
    actual_missing_table_rejected:true,actual_extra_table_rejected:true,actual_acl_drift_rejected:true,
    all_three_structural_negatives_rolled_back:true,actual_semantic_threshold_change_still_rejected:true},
   restore_rejected_under_different_formatter_settings:true,actual_numeric_threshold_change_rejected:true,
   accepted_source_boundary_rejected_after_semantic_change:true,canonical_comparison_waived:false,
   restored_alternate_formatter_diagnostics:alternateDiagnostic,actual_semantic_threshold_diagnostics:semanticDiagnostic,
   hosted_restore_cause_proven:false,staging_activation_proven:false,physical_device_acceptance_proven:false,
  };
 }finally{
  if(created&&id){guard();checked(['rm','--force','--volumes',id]);const missing=run(['inspect',id]);assert.equal(missing.status,1);removed=true;}
 }
 assert.equal(removed,true);proof.owned_container_removed=true;
 const self=await readFile(new URL(import.meta.url));proof.test_source_sha256=hash(self);
 proof.diagnostic_source_sha256=hash(await readFile(new URL('../scripts/staging-pwa-restore-diagnostic.mjs',import.meta.url)));
 if(process.env.CLUVO_PWA_DEPARSE_EVIDENCE==='owned-pg17')await writeFile(new URL('../docs/release/evidence/staging/20261009-pwa33-deparse-owned-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
 t.diagnostic(JSON.stringify(proof));
});
