import test from 'node:test';
import assert from 'node:assert/strict';
import {DATASETS,CATALOG_SQL,inventoryPlan,inventoryReport,hostedDatasetInventory,parseAuthProviderVersion} from '../scripts/staging-data-inventory.mjs';

const ref='fbozlbgmktkgcdfqdaaz';
const relation=(schema,table,columns,overrides={})=>({schema_name:schema,table_name:table,kind:'r',count_readable:true,rls_enabled:false,force_rls:false,owner_matches_current:false,row_security_active:false,columns:columns.map(([name,type])=>({name,type})),...overrides});
const baseline=()=>({namespaces:['auth'],role_security:{superuser:false,bypass_rls:false},tce_labels:[],relations:[relation('auth','users',[['encrypted_password','character varying(255)']])]});
const measured=(plans,changes={})=>plans.filter(p=>p.sql).map(p=>({id:p.id,count:0,valid_envelope_count:0,legacy_count:0,nonempty_count:0,row_count:0,...changes[p.id]}));
const code=value=>error=>error?.code===value;
test('complete catalog proves absent optional tables empty without a tablequery',()=>{
 const plans=inventoryPlan(baseline());assert.equal(plans.length,DATASETS.length);assert.equal(plans.filter(p=>p.sql).length,1);const r=inventoryReport(plans,measured(plans));assert.equal(r.key_dependent_data,'proven_empty');assert.equal(r.datasets.find(d=>d.id==='vault').absence_proven,true);assert.equal(r.full_database_restore_verified,false);
});
test('missing required Auth/table or incomplete catalog is unknown',()=>{
 assert.throws(()=>inventoryPlan({...baseline(),namespaces:[]}),code('AUTH_SCHEMA_UNKNOWN'));
 assert.throws(()=>inventoryPlan({...baseline(),relations:[]}),code('REQUIRED_DATASET_TABLE_MISSING'));
 assert.throws(()=>inventoryPlan({...baseline(),role_security:{}}),code('DATASET_CATALOG_UNKNOWN'));
});
test('tableexists but expectedcolumn/type/COUNTpermission is missing failsclosed',()=>{
 for(const r of [relation('auth','users',[]),relation('auth','users',[['encrypted_password','bytea']]),relation('auth','users',[['encrypted_password','text']],{count_readable:false}),relation('auth','users',[['encrypted_password','text']],{kind:'f'})])assert.throws(()=>inventoryPlan({...baseline(),relations:[r]}));
});
test('SELECTprivilege + filtered RLS0 is never proof of emptiness',()=>{
 const r=relation('auth','users',[['encrypted_password','text']],{rls_enabled:true,force_rls:true,row_security_active:true});assert.throws(()=>inventoryPlan({...baseline(),relations:[r]}),code('DATASET_COUNT_SCOPE_UNKNOWN'));
 const forcedOwner={...r,row_security_active:false,owner_matches_current:true};assert.throws(()=>inventoryPlan({...baseline(),relations:[forcedOwner]}),code('DATASET_COUNT_SCOPE_UNKNOWN'));
 assert.ok(inventoryPlan({...baseline(),role_security:{superuser:false,bypass_rls:true},relations:[{...r,row_security_active:false}]}));
 assert.ok(inventoryPlan({...baseline(),relations:[{...r,row_security_active:false,owner_matches_current:true,force_rls:false}]}));
});
test('new cryptographic columns/security labels stay unknown even if one could count0',()=>{
 const c=baseline();c.relations.push(relation('auth','new_provider',[['encrypted_client_secret','text']]));assert.throws(()=>inventoryPlan(c),code('UNCLASSIFIED_CRYPTOGRAPHIC_COLUMN'));
 assert.throws(()=>inventoryPlan({...baseline(),tce_labels:[{schema_name:'app',table_name:'data',column_name:'payload',data_type:'bytea',table_label:false,count_readable:true}]}),code('UNCLASSIFIED_TCE_COLUMN'));
});
test('a known hashed or plaintext column never authorizes unexpected TCE',()=>{
 const c=baseline();c.relations.push(relation('auth','oauth_clients',[['client_secret_hash','text']]));c.tce_labels.push({schema_name:'auth',table_name:'oauth_clients',column_name:'client_secret_hash',data_type:'text',table_label:false,count_readable:true});assert.throws(()=>inventoryPlan(c),code('UNCLASSIFIED_TCE_COLUMN'));
});
test('Vault decrypted view is never read or counted',()=>{
 const c=baseline();c.namespaces.push('vault');c.relations.push(relation('vault','decrypted_secrets',[['decrypted_secret','text']],{kind:'v'}));const plans=inventoryPlan(c);assert.ok(plans.every(p=>!p.sql?.includes('decrypted_secrets')));
});
test('pgsodium metadata separates key definitions from actual wrapped keymaterial',()=>{
 const c=baseline();c.namespaces.push('pgsodium');c.relations.push(relation('pgsodium','key',[['raw_key','bytea']]));const plans=inventoryPlan(c);assert.match(plans.find(p=>p.id==='pgsodium_keys').sql,/count\(\*\) FILTER \(WHERE "raw_key" IS NOT NULL\)/);
 const r=inventoryReport(plans,measured(plans,{pgsodium_keys:{row_count:2}}));assert.equal(r.key_dependent_data,'proven_empty');assert.equal(r.datasets.find(d=>d.id==='pgsodium_keys').key_definition_count,2);
 assert.equal(inventoryReport(plans,measured(plans,{pgsodium_keys:{count:1,nonnull_count:1,nonempty_count:1,row_count:2}})).key_dependent_data,'present');
});
test('known bcrypt/plainlegacy do not become key-dependent ciphertext',()=>{
 const plans=inventoryPlan(baseline());const r=inventoryReport(plans,measured(plans,{auth_password_envelopes:{legacy_count:1,nonempty_count:1,row_count:1}}));assert.equal(r.key_dependent_data,'proven_empty');assert.equal(r.datasets.find(d=>d.id==='auth_password_envelopes').legacy_count,1);assert.match(plans[0+2].sql??plans.find(p=>p.id==='auth_password_envelopes').sql,/aes-gcm-hkdf/);
});
test('malformed/unrecognized envelope and other nonempty formats are unknown',()=>{
 const plans=inventoryPlan(baseline());assert.throws(()=>inventoryReport(plans,measured(plans,{auth_password_envelopes:{count:1,valid_envelope_count:0,nonempty_count:1,row_count:1}})),code('AUTH_ENVELOPE_FORMAT_UNKNOWN'));
 assert.throws(()=>inventoryReport(plans,measured(plans,{auth_password_envelopes:{count:0,legacy_count:0,nonempty_count:1,row_count:1}})),code('AUTH_LEGACY_FORMAT_UNKNOWN'));
 assert.equal(inventoryReport(plans,measured(plans,{auth_password_envelopes:{count:1,valid_envelope_count:1,nonempty_count:1,row_count:1}})).key_dependent_data,'present');
});
test('OAuthclient hash and private plaintexttoken are independent of Auth encryptionkey',()=>{
 const c=baseline();c.relations.push(relation('auth','oauth_clients',[['client_secret_hash','text']]));c.relations.push(relation('auth','flow_state',[['provider_access_token','text'],['provider_refresh_token','text']]));const plans=inventoryPlan(c);const r=inventoryReport(plans,measured(plans,{oauth_client_hashes:{count:1,nonempty_count:1,row_count:1},oauth_flow_access_tokens:{count:1,nonempty_count:1,row_count:1}}));assert.equal(r.key_dependent_data,'proven_empty');assert.equal(r.datasets.find(d=>d.id==='oauth_client_hashes').key_family,null);
});
test('positive storage count requests real objectbyte backup without pretending restore',()=>{
 const c=baseline();c.namespaces.push('storage');c.relations.push(relation('storage','objects',[['id','uuid']]));const plans=inventoryPlan(c),r=inventoryReport(plans,measured(plans,{storage_objects:{count:2,nonempty_count:2,row_count:2}}));assert.equal(r.storage_objects,2);assert.equal(r.storage_binary_backup_required,true);assert.equal(r.full_database_restore_verified,false);
});
test('no missing/null/negative/duplicate/outofrange counters default to0',()=>{
 const plans=inventoryPlan(baseline());for(const counts of [[],measured(plans,{auth_password_envelopes:{count:null}}),measured(plans,{auth_password_envelopes:{row_count:-1}}),[...measured(plans),...measured(plans)],measured(plans,{auth_password_envelopes:{count:2,valid_envelope_count:2,nonempty_count:1,row_count:1}})])assert.throws(()=>inventoryReport(plans,counts));
});
test('hosted adapter reuses isolated existinglibpq helpers, readonlyverify-full, no secretarg/stderr',async()=>{
 const environment={APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:ref,MIGRATION_DATABASE_URL:'synthetic-test-only',MIGRATION_SSL_ROOT_CERT_PATH:'/public-ca'},project={ref};let calls=0;
 const options={databaseTarget:()=>({}),databaseEnvironment:()=>({PGSSLMODE:'verify-full',PGSSLROOTCERT:'/public-ca',PGOPTIONS:'-c default_transaction_read_only=on'}),execute:(cmd,args,opt)=>{calls++;assert.equal(cmd,'psql');assert.ok(!args.some(a=>a.includes('synthetic')));assert.equal(opt.env.PGSSLMODE,'verify-full');return {status:0,stdout:JSON.stringify(calls===1?baseline():measured(inventoryPlan(baseline()))[0]),stderr:'suppressed PRIVATE_TEST_MARKER'};}};
 const r=await hostedDatasetInventory(environment,project,options);assert.equal(r.passed,true);assert.equal(calls,2);assert.ok(!JSON.stringify(r).includes('PRIVATE_TEST_MARKER'));assert.ok(!JSON.stringify(r).includes('columns'));assert.ok(!JSON.stringify(r).includes('namespaces'));
 const failed=await hostedDatasetInventory(environment,project,{...options,execute:()=>({status:1,stderr:'suppressed PRIVATE_TEST_MARKER'})});assert.equal(failed.error,'DATASET_QUERY_UNAVAILABLE');assert.equal(failed.key_dependent_data,'unknown');
});
test('dangerous scope and requireTLS are refused before query',async()=>{
 const options={databaseTarget:()=>({}),databaseEnvironment:()=>({PGSSLMODE:'require',PGOPTIONS:'-c default_transaction_read_only=on'}),execute:()=>{throw Error('must not query');}};
 await assert.rejects(()=>hostedDatasetInventory({APP_ENV:'production'},{ref},options));await assert.rejects(()=>hostedDatasetInventory({APP_ENV:'staging',STAGING_SUPABASE_PROJECT_REF:ref},{ref},options),code('READ_ONLY_VERIFY_FULL_REQUIRED'));
});
test('actual query text consists only metadata/COUNT aggregates, no rawdata projection',()=>{
 const plans=inventoryPlan(baseline());for(const p of plans.filter(x=>x.sql)){assert.match(p.sql,/SELECT json_build_object/);assert.match(p.sql,/count\(\*\)/);assert.ok(!p.sql.includes('decrypted_secrets'));assert.ok(!p.sql.includes('SELECT *'));}assert.ok(!CATALOG_SQL.includes('rolconfig'));assert.ok(!CATALOG_SQL.includes('s.label'));
});
test('healthversion is strictly allowlisted; rawbody/suffix/key-like data never exported',()=>{
 assert.deepEqual(parseAuthProviderVersion({version:'v2.197.1',secret:'suppressed'}),{provider_version:'v2.197.1',provider_version_available:true});
 for(const version of ['',null,'unknown version','v2.197.1-secret','a'.repeat(40),'v2.1.1\nPRIVATE','v999.1.1','v2.99999.1','v2.01.1']){const result=parseAuthProviderVersion({version,body:'PRIVATE_TEST_MARKER'});assert.equal(result.provider_version_available,false);assert.ok(!JSON.stringify(result).includes('PRIVATE_TEST_MARKER'));}
});
