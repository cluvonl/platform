// Actual SQL in the caller's labelled, network-isolated disposable PostgreSQL.
// Synthetic Auth rows/claims are deliberately LOCAL ONLY. These tests prove
// dispatcher/fixture/locking behavior; hosted QA still obtains real provider JWTs.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {buildStagingNativeQaFixture,nativeQaProviderEmail,nativeQaProviderMetadata,nativeQaPreflightSql} from '../../scripts/staging-pwa-native-qa-fixture.mjs';
import {buildStagingNativeQaBooking} from '../../scripts/staging-pwa-native-qa-booking.mjs';
import {buildStagingNativeQaAutomation} from '../../scripts/staging-pwa-native-qa-automation.mjs';
import {runOwnedPwaAutomation} from './pwa-owned-automation.mjs';
import {runPwaNativeQaApiChecks} from '../../scripts/staging-pwa-native-qa.mjs';
import {runtimeReadOnlyPreflightSQL,runtimeReadOnlyGuardSQL} from '../../scripts/staging-pwa-runtime-preflight.mjs';

const quote=value=>"'"+value.replaceAll("'","''")+"'";
const atom=value=>value===null?'NULL':typeof value==='number'?String(value):typeof value==='object'?quote(JSON.stringify(value))+'::jsonb':quote(value);
function persistent(args){
 const child=spawn('docker',args,{env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});
 let pending,buffer='',diagnostic='',ended=false;
 const exited=new Promise(resolve=>child.once('close',code=>{ended=true;if(pending)clearTimeout(pending.timer);if(diagnostic)process.stderr.write((diagnostic.match(/ERROR:[^\n]*/)?.[0]??'OWNED_QA_SQL_FAILURE')+'\n');pending?.reject(Error('OWNED_QA_SQL_SESSION_CLOSED_'+(diagnostic.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??'UNKNOWN')));resolve(code);}));
 child.stderr.on('data',bytes=>{diagnostic+=bytes;});
 child.stdout.on('data',bytes=>{
  buffer+=bytes;
  if(!pending)return;
  const end=buffer.indexOf(pending.marker+'\n');if(end<0)return;
  const current=pending;pending=undefined;clearTimeout(current.timer);
  const value=buffer.slice(0,end).trim();buffer=buffer.slice(end+current.marker.length+1);
  if(diagnostic){diagnostic='';current.reject(Error('OWNED_QA_SQL_WARNING_REFUSED'));}else current.resolve(value);
 });
 return {query:sql=>new Promise((resolve,reject)=>{
  assert.equal(pending,undefined);assert.equal(ended,false);
  const marker='owned_pwa_qa_'+randomBytes(12).toString('hex');
  pending={marker,resolve,reject,timer:setTimeout(()=>{pending=undefined;child.kill('SIGKILL');reject(Error('OWNED_QA_SQL_TIMEOUT'));},15000)};
  child.stdin.write(sql+'\n\\echo '+marker+'\n');
 }),close:async()=>{
  child.stdin.end('\\q\n');const timer=setTimeout(()=>child.kill('SIGKILL'),2000);
  try{assert.equal(await exited,0,'OWNED_QA_SESSION_CLEANUP_FAILED');}finally{clearTimeout(timer);}
 }};
}

export async function runOwnedPwaNativeQa({name,socket,sql,json,lock}){
 const sourceSha='a'.repeat(40),workflowRunId='987654321',actor='local-owned-pwa-native-qa';
 const users=['a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002'];
 const sessions=['a2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002'];
 const providers=users.map((id,index)=>({id,email:nativeQaProviderEmail(workflowRunId,index===0?'a':'b'),appMetadata:{provider:'email',providers:['email'],...nativeQaProviderMetadata({sourceSha,workflowRunId,actor,slot:index===0?'a':'b'})}}));
 const fixture=buildStagingNativeQaFixture({sourceSha,workflowRunId,actor,expectedVersion:0,providers});
 const booking=buildStagingNativeQaBooking({actorA:users[0],actorB:users[1],sourceSha,workflowRunId,actor,expectedVersion:0});
 const f=booking.fixture;
 const claims=index=>({sub:users[index],email:providers[index].email,role:'authenticated',session_id:sessions[index],exp:Math.floor(Date.now()/1000)+3600});
 const context=recipe=>recipe.contextSql.replace(/\$(\d)/g,(_whole,number)=>quote(recipe.parameters[Number(number)-1]));
 const rows=value=>value.split('\n').filter(line=>line.startsWith('{')||line.startsWith('[')||line==='null').map(line=>JSON.parse(line));
 const command=['--host',socket,'exec','-i',name,'psql','-X','--quiet','--no-align','--tuples-only','--no-password','--set=ON_ERROR_STOP=1','--set=VERBOSITY=verbose','-h','/restore','-U','supabase_admin','-d','postgres'];
 const ownerSql=persistent(command);let primary;
 try{
  sql("ALTER ROLE authenticator LOGIN;GRANT authenticated TO authenticator;ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_schemas=\'api\';ALTER TABLE auth.users ADD COLUMN role text DEFAULT 'authenticated',ADD COLUMN raw_app_meta_data jsonb DEFAULT '{}'::jsonb;"+
   providers.map(user=>`INSERT INTO auth.users(id,email,email_confirmed_at,role,raw_app_meta_data) VALUES('${user.id}',${quote(user.email)},statement_timestamp(),'authenticated',${quote(JSON.stringify(user.appMetadata))}::jsonb);`).join('\n')+
   sessions.map((id,index)=>`INSERT INTO auth.sessions(id,user_id) VALUES('${id}','${users[index]}');`).join('\n'),{role:'supabase_admin'});
  await ownerSql.query('SET client_min_messages=warning;SET ROLE postgres;'+lock);
  const preflight=rows(await ownerSql.query(nativeQaPreflightSql())).at(-1);
  assert.equal(preflight.scope,'STAGING_PWA_NATIVE_QA_PREFLIGHT_V1');assert.ok(preflight.native_guarded_tables>144);
  const readonly=rows(await ownerSql.query(runtimeReadOnlyPreflightSQL())).at(-1);
  assert.equal(readonly.scope,'STAGING_PWA_RUNTIME_READONLY36');assert.equal(readonly.transaction_read_only,true);
  assert.equal(readonly.migration_count,36);assert.equal(readonly.database_role_superuser,false);
  assert.equal(readonly.app_tables,readonly.native_guarded_tables);assert.equal(readonly.app_tables,readonly.forced_rls_tables);
  await ownerSql.query("RESET ROLE;ALTER ROLE cluvo_command_owner BYPASSRLS;SET ROLE postgres;BEGIN READ ONLY;"+`DO $runtime_role_negative$BEGIN
   BEGIN EXECUTE ${quote(runtimeReadOnlyGuardSQL())};RAISE EXCEPTION 'OWNED_RUNTIME_UNRESTRICTED_COMMAND_OWNER_ALLOWED';
   EXCEPTION WHEN SQLSTATE 'P0001'THEN IF SQLERRM<>'STAGING_NATIVE_QA_REFUSED'THEN RAISE;END IF;END;
  END $runtime_role_negative$;COMMIT;RESET ROLE;ALTER ROLE cluvo_command_owner NOBYPASSRLS;SET ROLE postgres;`);
  const apiViews=rows(await ownerSql.query("SELECT jsonb_build_object('views',count(*),'invoker_views',count(*) FILTER(WHERE 'security_invoker=true'=ANY(coalesce(c.reloptions,ARRAY[]::text[])))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='api' AND c.relkind='v';")).at(-1);
  assert.deepEqual(apiViews,{views:21,invoker_views:21});
  await ownerSql.query("ALTER VIEW api.pwa_policy_assignments SET(security_invoker=false);BEGIN READ ONLY;"+`DO $runtime_view_negative$BEGIN
   BEGIN EXECUTE ${quote(runtimeReadOnlyGuardSQL())};RAISE EXCEPTION 'OWNED_RUNTIME_UNSAFE_API_VIEW_ALLOWED';
   EXCEPTION WHEN SQLSTATE 'P0001'THEN IF SQLERRM<>'STAGING_NATIVE_QA_REFUSED'THEN RAISE;END IF;END;
  END $runtime_view_negative$;COMMIT;ALTER VIEW api.pwa_policy_assignments SET(security_invoker=true);`);
  const planningIdentity='api.pwa_committee_planning(uuid,uuid)';
  const apiFunctions=rows(await ownerSql.query("SELECT jsonb_build_object('functions',count(*),'invoker_functions',count(*)FILTER(WHERE NOT p.prosecdef))FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='api';")).at(-1);
  assert.deepEqual(apiFunctions,{functions:89,invoker_functions:89});
  for(const [change,restore]of [
   ["CREATE FUNCTION api.pwa_unregistered_inventory_probe()RETURNS integer LANGUAGE sql STABLE SECURITY INVOKER AS 'SELECT 1';","DROP FUNCTION api.pwa_unregistered_inventory_probe();"],
   [`ALTER FUNCTION ${planningIdentity} RENAME TO pwa_committee_planning_missing;`,`ALTER FUNCTION api.pwa_committee_planning_missing(uuid,uuid) RENAME TO pwa_committee_planning;`],
   [`ALTER FUNCTION ${planningIdentity} VOLATILE;`,`ALTER FUNCTION ${planningIdentity} STABLE;`],
   [`ALTER FUNCTION ${planningIdentity} SECURITY DEFINER;`,`ALTER FUNCTION ${planningIdentity} SECURITY INVOKER;`],
   [`ALTER FUNCTION ${planningIdentity} SET search_path=public;`,`ALTER FUNCTION ${planningIdentity} SET search_path='';`],
   [`GRANT EXECUTE ON FUNCTION ${planningIdentity} TO anon;`,`REVOKE EXECUTE ON FUNCTION ${planningIdentity} FROM anon;`],
   [`GRANT EXECUTE ON FUNCTION ${planningIdentity} TO service_role;`,`REVOKE EXECUTE ON FUNCTION ${planningIdentity} FROM service_role;`],
   [`REVOKE EXECUTE ON FUNCTION ${planningIdentity} FROM authenticated;`,`GRANT EXECUTE ON FUNCTION ${planningIdentity} TO authenticated;`],
  ])await ownerSql.query(change+"BEGIN READ ONLY;"+`DO $runtime_rpc_negative$BEGIN
   BEGIN EXECUTE ${quote(runtimeReadOnlyGuardSQL())};RAISE EXCEPTION 'OWNED_RUNTIME_UNSAFE_PLANNING_RPC_ALLOWED';
   EXCEPTION WHEN SQLSTATE 'P0001'THEN IF SQLERRM<>'STAGING_NATIVE_QA_REFUSED'THEN RAISE;END IF;END;
  END $runtime_rpc_negative$;COMMIT;`+restore);
  const setup=rows(await ownerSql.query('BEGIN;'+context(fixture)+fixture.mutationSql+fixture.readbackSql+'COMMIT;')).at(-1);
  assert.equal(setup.persons,3);
  // The fixed scope guard must reject an adopted foreign team before teardown.
  await ownerSql.query(`BEGIN;${context(fixture)}DO $local_scope_drift$ BEGIN
   BEGIN
    UPDATE app.teams SET name='unexpected' WHERE id='${f.teamA}';
    EXECUTE ${quote(fixture.teardownSql)};
    RAISE EXCEPTION 'LOCAL_SCOPE_DRIFT_ALLOWED';
   EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'STAGING_NATIVE_QA_REFUSED' THEN RAISE;END IF;
   END;
  END $local_scope_drift$;COMMIT;`);
  assert.equal(json(`SELECT to_jsonb(name) FROM app.teams WHERE id='${f.teamA}';`),'QA team A');

  const rpcArrays=new Set(['pwa_command','pwa_pending_commands','list_intake_contexts']);
  const allowed=new Set([...rpcArrays,'pwa_snapshot','get_household_dossier','pwa_prepare_command','pwa_command_status','pwa_resolve_command_intent']);
  const apiQuery=async(index,query)=>{
   // A fresh authenticator backend for every API request ensures the barrier
   // observes actual independent contenders, not a Promise-only simulation.
   const statement=`SET client_min_messages=warning;SET SESSION AUTHORIZATION authenticator;BEGIN;SET LOCAL ROLE authenticated;SELECT set_config('request.jwt.claims',${quote(JSON.stringify(claims(index)))},true) IS NOT NULL;${query}COMMIT;`;
   const apiCommand=command.map(value=>value==='supabase_admin'?'authenticator':value);
   const child=spawn('docker',apiCommand,{env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});let out='',err='';
   child.stdout.on('data',value=>{out+=value;});child.stderr.on('data',value=>{err+=value;});
   const code=await new Promise(resolve=>{child.once('close',resolve);child.stdin.end(statement);});
   if(code){const sqlstate=err.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1];const message=err.match(/ERROR:\s+[0-9A-Z]{5}:\s*([A-Z_]+)/)?.[1];if(!['FORBIDDEN','CAPACITY_FULL','IDEMPOTENCY_CONFLICT'].includes(message??'')){process.stderr.write('OWNED_QA_API_SQL_FAILED_'+(sqlstate??'UNKNOWN')+' '+(err.match(/ERROR:[^\n]*/)?.[0]??'')+'\n');throw Error('OWNED_QA_API_SQL_FAILED_'+(sqlstate??'UNKNOWN'));}return {data:null,error:{code:sqlstate??'LOCAL_SQL_FAILURE',message:message??'LOCAL_SQL_FAILURE'}};}
   return {data:rows(out).at(-1),error:null};
  };
  const client=index=>({schema:schema=>{
   if(schema!=='api')return {from:()=>({select:()=>({limit:async()=>({data:null,error:{code:'PGRST106'}})})})};
   return {rpc:async(name,args)=>{
    assert.ok(allowed.has(name));assert.ok(Object.keys(args).every(key=>/^p_[a-z_]+$/.test(key)));
    const call='api.'+name+'('+Object.entries(args).map(([key,value])=>key+'=>'+atom(value)).join(',')+')';
    return await apiQuery(index,rpcArrays.has(name)?`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM ${call} t;`:`SELECT coalesce(to_jsonb(${call}),'null'::jsonb);`);
   },from:table=>({select:async fields=>{
    assert.ok(['my_intake','my_workspaces'].includes(table));assert.ok(/^[a-z_,]+$/.test(fields));
    return await apiQuery(index,`SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM(SELECT ${fields} FROM api.${table})t;`);
   }})};
  }});
  const provider={withActor:async(slot,operation)=>{
   const index=slot==='a'?0:1,accessToken='local.'+Buffer.from(JSON.stringify(claims(index))).toString('base64url')+'.local';
   return await operation({client:client(index),accessToken});
  },revokeSession:async slot=>{assert.equal(slot,'a');sql(`DELETE FROM auth.sessions WHERE id='${sessions[0]}' AND user_id='${users[0]}';`);}};
  const owner={setupBooking:async()=>rows(await ownerSql.query('BEGIN;'+context(booking)+booking.mutationSql+booking.readbackSql+'COMMIT;')).at(-1),
   // Match the private Python owner: its identity/lock check reads activity
   // before the fresh independent API backends start within the holder tx.
   holdLastPosition:async()=>await ownerSql.query(booking.holderSql+"SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid();"),
   countBlocked:async()=>{await ownerSql.query('SELECT pg_catalog.pg_stat_clear_snapshot();');return rows(await ownerSql.query(booking.blockingSql)).at(-1);},
   releaseHolder:async()=>await ownerSql.query(booking.releaseHolderSql),
   bookingReadback:async()=>rows(await ownerSql.query(booking.readbackSql)).at(-1)};
  const proof=await runPwaNativeQaApiChecks(owner,provider,workflowRunId);
  assert.equal(proof.privacy.minor_contacts_hidden_with_team_positive_control,true);
  assert.equal(proof.last_position.actual_blocked_contenders,2);assert.equal(proof.last_position.external_delivery_outbox,0);
  assert.equal(proof.logout.revoked_old_bearer_command_refused,true);
  const scoped=buildStagingNativeQaAutomation({sourceSha,workflowRunId,actor,expectedVersion:0,providers});
  await ownerSql.query('BEGIN;'+context(scoped)+`DO $automation_source_negative$BEGIN
   BEGIN
    PERFORM set_config('cluvo.native_qa_context',jsonb_set(current_setting('cluvo.native_qa_context')::jsonb,'{source_sha}',to_jsonb(repeat('b',40)))::text,true);
    EXECUTE ${quote(scoped.guardSql)};
    RAISE EXCEPTION 'OWNED_AUTOMATION_FOREIGN_SOURCE_ALLOWED';
   EXCEPTION WHEN SQLSTATE 'P0001'THEN IF SQLERRM<>'STAGING_NATIVE_QA_REFUSED'THEN RAISE;END IF;END;
  END $automation_source_negative$;ROLLBACK;`);
  const scopedProof=rows(await ownerSql.query('BEGIN;'+context(scoped)+scoped.guardSql+scoped.mutationSql+scoped.readbackSql+'ROLLBACK;')).at(-1);
  assert.equal(scopedProof.actual_synthetic_imports,4);assert.equal(scopedProof.provider_called,false);assert.equal(scopedProof.global_scheduler_called,false);
  assert.deepEqual(rows(await ownerSql.query(scoped.rollbackReadbackSql)).at(-1),{rollback_verified:true});
  const automation=await runOwnedPwaAutomation({ownerSql,f,claims,json,runWorker:async statement=>{
   const child=spawn('docker',command,{env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'},stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',bytes=>{out+=bytes;});child.stderr.on('data',bytes=>{err+=bytes;});
   const code=await new Promise(resolve=>{child.once('close',resolve);child.stdin.end('SET client_min_messages=warning;SET ROLE postgres;'+statement);});
   assert.equal(code,0,'OWNED_AUTOMATION_WORKER_FAILED_'+(err.match(/ERROR:\s+([0-9A-Z]{5}):/)?.[1]??'UNKNOWN'));return rows(out).at(-1);
  }});assert.equal(automation.unknown_slot_retained,true);
  const cleanup=rows(await ownerSql.query('BEGIN;'+context(fixture)+fixture.teardownSql+fixture.teardownReadbackSql+'COMMIT;')).at(-1);
  assert.equal(cleanup.qa_scopes_archived,2);assert.equal(cleanup.retained_answer_revisions,3);assert.equal(cleanup.retained_bookings,1);assert.equal(cleanup.retained_ledger_entries,0);
  const again=rows(await ownerSql.query('BEGIN;'+context(fixture)+fixture.teardownSql+fixture.teardownReadbackSql+'COMMIT;')).at(-1);
  assert.equal(again.status,'already_archived');
  return {scope:'LOCAL_OWNED_PG17',readonly_runtime_configuration_guard:true,api_security_invoker_functions:apiFunctions.functions,actual_planning_rpc_metadata_negatives:8,api_security_invoker_views:21,actual_unsafe_api_view_refused_in_readonly_transaction:true,actual_native_last_position_contenders:2,private_teams_and_minor_contacts:true,old_bearer_after_logout_refused:true,scoped_automation:{...scopedProof,rollback_verified:true},automation};
 }catch(error){primary=error;throw error;}finally{try{await ownerSql.close();}catch(error){if(!primary)throw error;}}
}
