// Separate PWA owner; original native QA remains unchanged.
// Fixed private recipes for the concrete Native QA owner; no IO on import.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildStagingNativeQaFixture,nativeQaPreflightSql,nativeQaSchemaGuardSql} from './staging-pwa-native-qa-fixture.mjs';
import {buildStagingNativeQaBooking} from './staging-pwa-native-qa-booking.mjs';
import {buildStagingNativeQaAutomation} from './staging-pwa-native-qa-automation.mjs';
import {UPGRADE_FILES} from './staging-pwa-upgrade-migrations.mjs';

export function nativeQaPrivateRecipe(value){
 const keys=['operation','sourceSha','workflowRunId','actor','providers'];
 if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key))
  ||!['preflight','fixture','booking','automation'].includes(value.operation)||!/^[0-9a-f]{40}$/.test(value.sourceSha??'')
  ||!/^[1-9][0-9]{0,19}$/.test(value.workflowRunId??'')||!/^[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}$/.test(value.actor??''))throw Error('STAGING_NATIVE_QA_RECIPE_INVALID');
 if(value.operation==='preflight'){
  if(value.providers!==null)throw Error('STAGING_NATIVE_QA_RECIPE_INVALID');
  return {preflightSql:nativeQaPreflightSql(),migrationCount:UPGRADE_FILES.length};
 }
 const fixture=buildStagingNativeQaFixture({sourceSha:value.sourceSha,workflowRunId:value.workflowRunId,actor:value.actor,expectedVersion:0,providers:value.providers});
 if(value.operation==='fixture')return fixture;
 if(value.operation==='automation')return buildStagingNativeQaAutomation({sourceSha:value.sourceSha,workflowRunId:value.workflowRunId,actor:value.actor,expectedVersion:0,providers:value.providers});
 return {...buildStagingNativeQaBooking({sourceSha:value.sourceSha,workflowRunId:value.workflowRunId,actor:value.actor,expectedVersion:0,
  actorA:value.providers[0].id,actorB:value.providers[1].id}),guardSql:nativeQaSchemaGuardSql()};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--private-fixed-native-qa-sql')throw Error();
  const raw=await readFile('/dev/stdin');if(raw.length===0||raw.length>32_768)throw Error();
  const recipe=nativeQaPrivateRecipe(JSON.parse(raw.toString('utf8')));
  process.stdout.write(JSON.stringify(recipe));raw.fill(0);
 }catch{process.exitCode=1;}
}
