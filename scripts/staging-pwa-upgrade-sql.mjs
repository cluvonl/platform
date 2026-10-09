// Private fixed generator. Arguments select a known suffix index, never SQL.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {UPGRADE_FILES,createUpgradeMigrationManifest,upgradeMigrationSQL} from './staging-pwa-upgrade-migrations.mjs';

export async function renderFixedUpgrade(input){
 const fields=['actor','backupArtifactId','backupArtifactSha256','expectedBackendPid','expectedBackendStart','index','manifestSha256','sourceSha','workflowRunId'];
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).sort().join(',')!==fields.sort().join(','))throw Error('PWA_UPGRADE_GENERATOR_ARGUMENT_INVALID');
 const sources=await Promise.all(UPGRADE_FILES.map(async file=>({file:file.file,bytes:await readFile(new URL('../supabase/migrations/'+file.file,import.meta.url))})));
 const manifest=createUpgradeMigrationManifest(input.sourceSha,sources);
 if(input.manifestSha256!==manifest.sha256)throw Error('PWA_UPGRADE_MANIFEST_CHANGED');
 return upgradeMigrationSQL(manifest,input.index,input);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--private-fixed-pwa-upgrade-sql')throw Error('PWA_UPGRADE_GENERATOR_ARGUMENT_INVALID');
  let bytes=0,raw='';
  for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>16384)throw Error('PWA_UPGRADE_GENERATOR_ARGUMENT_INVALID');raw+=chunk;}
  process.stdout.write(await renderFixedUpgrade(JSON.parse(raw)));
 }catch{process.exitCode=1;}
}
