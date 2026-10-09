// Additive PWA owner fork; original initial16 implementation remains unchanged.
// Existing staging secret -> domain-separated backup key. No action on import.
import {hkdfSync,createHash} from 'node:crypto';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {executeDatabaseProcess} from './staging-database-process.mjs';

export const INITIAL_BACKUP_KEY_PROFILE='cluvo-staging-pwa-upgrade-backup-hkdf-sha256-v1';
export const UPLOAD_ACTION_SHA='ea165f8d65b6e75b540449e92b4886f43607fa02';
export const UPLOAD_ACTION_BUNDLE_SHA256='0165b8a75330f3228f2c7a234b4ff8a107b9139c2b519147f4c8e9fe99b262d8';
const PROJECT='fbozlbgmktkgcdfqdaaz';
const RETRY_HTTP=new Set([404,429,500,502,503,504]);
const PUBLIC_HTTP=new Set([200,301,302,303,307,308,400,401,403,404,408,410,422,429,500,502,503,504]);
const RETRY_NETWORK=new Set(['EAI_AGAIN','ECONNRESET','ECONNREFUSED','ECONNABORTED','ETIMEDOUT','EPIPE','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET']);
const READBACK_BACKOFF=[250,500,1000,2000],READBACK_BUDGET=15000,READBACK_ATTEMPT=3000;
export class BackupCustodyError extends Error{constructor(code,httpStatus=null){super(code);this.code=code;this.httpStatus=PUBLIC_HTTP.has(httpStatus)?httpStatus:null;}}
const need=(value,code)=>{if(!value)throw new BackupCustodyError(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const plain=value=>value&&Object.getPrototypeOf(value)===Object.prototype;

export function deriveInitialBackupKey(secret){
 need(typeof secret==='string'&&Buffer.byteLength(secret)>=32&&Buffer.byteLength(secret)<=8192&&!/[\r\n\0]/.test(secret),'INITIAL_BACKUP_ROOT_REQUIRED');
 const input=Buffer.from(secret);
 try{return Buffer.from(hkdfSync('sha256',input,Buffer.from(PROJECT),Buffer.from(INITIAL_BACKUP_KEY_PROFILE),32));}
 finally{input.fill(0);}
}

export function encryptedArtifactName(sourceSha,runId,attempt){
 need(/^[0-9a-f]{40}$/.test(sourceSha??'')&&/^[1-9][0-9]{0,19}$/.test(runId??'')&&/^[1-9][0-9]{0,3}$/.test(attempt??''),'INITIAL_BACKUP_RUN_REQUIRED');
 return `cluvo-staging-pwa-upgrade-encrypted-${sourceSha}-${runId}-${attempt}`;
}

// Parser only: neither this projection nor a remote JSON object authorizes DDL.
export function parseInitialArtifactOutput(outputBytes,runId){
 need(Buffer.isBuffer(outputBytes)&&outputBytes.length>0&&outputBytes.length<=16384,'INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID');
 const outputs={},lines=outputBytes.toString('utf8').trim().split('\n');
 for(let index=0;index<lines.length;index++){
  const simple=/^(artifact-id|artifact-url|artifact-digest)=(.{1,2048})$/.exec(lines[index]);
  const multiline=/^(artifact-id|artifact-url|artifact-digest)<<(ghadelimiter_[0-9a-f-]{36})$/.exec(lines[index]);
  need(simple||multiline,'INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID');
  const key=(simple??multiline)[1],value=simple?.[2]??lines[index+1];
  if(multiline){need(lines[index+2]===multiline[2]&&typeof value==='string'&&value.length<=2048,'INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID');index+=2;}
  need(!Object.hasOwn(outputs,key),'INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID');outputs[key]=value;
 }
 need(/^[1-9][0-9]{0,19}$/.test(runId??'')&&Object.keys(outputs).length===3
  &&/^[1-9][0-9]{0,19}$/.test(outputs['artifact-id'])&&/^[0-9a-f]{64}$/.test(outputs['artifact-digest'])
  &&outputs['artifact-url']===`https://github.com/cluvonl/platform/actions/runs/${runId}/artifacts/${outputs['artifact-id']}`,'INITIAL_BACKUP_UPLOAD_RECEIPT_INVALID');
 return Object.freeze(outputs);
}

function readbackContext(environment){
 need(environment&&typeof environment==='object','INITIAL_BACKUP_STAGING_CONTEXT_REQUIRED');
 const context={};
 for(const key of ['GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_EVENT_NAME','GITHUB_SERVER_URL','GITHUB_TOKEN']){
  const descriptor=Object.getOwnPropertyDescriptor(environment,key),value=descriptor?.value;
  need(typeof value==='string'&&value.length>0&&value.length<=32768&&!/[\r\n\0]/.test(value),key==='GITHUB_TOKEN'?'INITIAL_BACKUP_READBACK_TOKEN_REQUIRED':'INITIAL_BACKUP_STAGING_CONTEXT_REQUIRED');
  context[key]=value;
 }
 encryptedArtifactName(context.GITHUB_SHA,context.GITHUB_RUN_ID,context.GITHUB_RUN_ATTEMPT);
 need(context.GITHUB_REPOSITORY==='cluvonl/platform'&&context.GITHUB_REF==='refs/heads/staging'
  &&context.GITHUB_EVENT_NAME==='workflow_dispatch'&&context.GITHUB_SERVER_URL==='https://github.com','INITIAL_BACKUP_STAGING_CONTEXT_REQUIRED');
 return Object.freeze(context);
}

// Readback projection only: this helper does not upload or authorize DDL. Each
// request targets the same fixed GitHub API endpoint and receipt identity.
export async function readbackInitialArtifact(outputBytes,environment,{fetcher=fetch,sleep=pause,now=()=>performance.now()}={}){
 try{
  const context=readbackContext(environment),outputs=parseInitialArtifactOutput(outputBytes,context.GITHUB_RUN_ID);
  const name=encryptedArtifactName(context.GITHUB_SHA,context.GITHUB_RUN_ID,context.GITHUB_RUN_ATTEMPT);
  const url=`https://api.github.com/repos/cluvonl/platform/actions/artifacts/${outputs['artifact-id']}`;
  const deadline=now()+READBACK_BUDGET;
  let lastError=new BackupCustodyError('INITIAL_BACKUP_REMOTE_READBACK_FAILED');
  for(let attempt=0;attempt<=READBACK_BACKOFF.length;attempt++){
   const remaining=deadline-now();if(remaining<=0)throw lastError;
   const signal=AbortSignal.timeout(Math.max(1,Math.min(READBACK_ATTEMPT,Math.floor(remaining))));
   try{
    const response=await fetcher(url,{method:'GET',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+context.GITHUB_TOKEN,'X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal});
    if(response.status!==200){
     lastError=new BackupCustodyError('INITIAL_BACKUP_REMOTE_READBACK_FAILED',response.status);
     // Never read or replay error bodies, including authorization failures.
     void response.body?.cancel().catch(()=>{});
     if(!RETRY_HTTP.has(response.status))throw lastError;
    }else{
     let remote;
     try{remote=await response.json();}catch(error){if(error instanceof SyntaxError)throw new BackupCustodyError('INITIAL_BACKUP_REMOTE_RECEIPT_INVALID',200);throw error;}
     need(plain(remote)&&String(remote.id)===outputs['artifact-id']&&remote.name===name&&remote.expired===false
      &&Number.isSafeInteger(remote.size_in_bytes)&&remote.size_in_bytes>0&&remote.digest==='sha256:'+outputs['artifact-digest']
      &&String(remote.workflow_run?.id)===context.GITHUB_RUN_ID&&remote.workflow_run?.head_sha===context.GITHUB_SHA,'INITIAL_BACKUP_REMOTE_RECEIPT_INVALID');
     if(now()>=deadline)throw new BackupCustodyError('INITIAL_BACKUP_REMOTE_READBACK_FAILED',200);
     return Object.freeze({remote_readback:true,artifact_id:outputs['artifact-id'],archive_sha256:outputs['artifact-digest']});
    }
   }catch(error){
    if(error instanceof BackupCustodyError)throw error;
    if(!signal.aborted&&!(error instanceof TypeError&&RETRY_NETWORK.has(error.cause?.code)))throw new BackupCustodyError('INITIAL_BACKUP_REMOTE_READBACK_FAILED');
    lastError=new BackupCustodyError('INITIAL_BACKUP_REMOTE_READBACK_FAILED');
   }
   if(attempt===READBACK_BACKOFF.length||deadline-now()<=READBACK_BACKOFF[attempt])throw lastError;
   await sleep(READBACK_BACKOFF[attempt]);
  }
  throw lastError;
 }catch(error){throw error instanceof BackupCustodyError?error:new BackupCustodyError('INITIAL_BACKUP_REMOTE_READBACK_FAILED');}
}

// A successful local JSON report is never a custody receipt. This function runs
// the pinned official uploader and reads back its actual remote artifact.
export async function uploadEncryptedInitialBackup({directory,actionBundle,environment},{run=executeDatabaseProcess,fetcher=fetch}={}){
 let output;
 try{
  need(isAbsolute(directory??'')&&isAbsolute(actionBundle??'')&&environment&&typeof environment==='object','INITIAL_BACKUP_UPLOAD_INPUT_REQUIRED');
  const context=readbackContext(environment);
  const dir=await lstat(directory),file=await lstat(join(directory,'backup.encrypted.json')),bundle=await lstat(actionBundle);
  need(dir.isDirectory()&&!dir.isSymbolicLink()&&dir.uid===process.getuid()&&(dir.mode&0o777)===0o700
   &&file.isFile()&&!file.isSymbolicLink()&&file.nlink===1&&file.uid===process.getuid()&&(file.mode&0o777)===0o600
   &&file.size>0&&file.size<=90*1024*1024,'INITIAL_BACKUP_PRIVATE_ARTIFACT_REQUIRED');
  need(bundle.isFile()&&!bundle.isSymbolicLink()&&bundle.size===5051718&&hash(await readFile(actionBundle))===UPLOAD_ACTION_BUNDLE_SHA256,'INITIAL_BACKUP_UPLOADER_SOURCE_CHANGED');
  const name=encryptedArtifactName(context.GITHUB_SHA,context.GITHUB_RUN_ID,context.GITHUB_RUN_ATTEMPT);
  const env={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GITHUB_WORKSPACE:directory};
  for(const key of ['ACTIONS_RUNTIME_TOKEN','ACTIONS_RUNTIME_URL','ACTIONS_RESULTS_URL','GITHUB_REPOSITORY','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','GITHUB_SERVER_URL']){
   const value=context[key]??environment[key];need(typeof value==='string'&&value.length>0&&value.length<=32768&&!/[\r\n\0]/.test(value),'INITIAL_BACKUP_UPLOAD_CONTEXT_REQUIRED');env[key]=value;
  }
  need(env.GITHUB_SERVER_URL==='https://github.com','INITIAL_BACKUP_UPLOAD_CONTEXT_REQUIRED');
  for(const key of ['ACTIONS_RUNTIME_URL','ACTIONS_RESULTS_URL']){
   const url=new URL(env[key]);need(url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.endsWith('.actions.githubusercontent.com'),'INITIAL_BACKUP_UPLOAD_CONTEXT_REQUIRED');
  }
  output=join(directory,'upload.output');await writeFile(output,'',{flag:'wx',mode:0o600});
  Object.assign(env,{GITHUB_OUTPUT:output,INPUT_NAME:name,INPUT_PATH:join(directory,'backup.encrypted.json'),
   'INPUT_IF-NO-FILES-FOUND':'error','INPUT_RETENTION-DAYS':'30','INPUT_COMPRESSION-LEVEL':'0',INPUT_OVERWRITE:'false','INPUT_INCLUDE-HIDDEN-FILES':'false'});
  // stdout/stderr are bounded private buffers; never replay action diagnostics.
  const result=await run(process.execPath,[actionBundle],{env,timeout:180000,maxBuffer:128000});
  need(result.status===0&&!result.error,'INITIAL_BACKUP_UPLOAD_FAILED');
  const receipt=await readbackInitialArtifact(await readFile(output),context,{fetcher});
  return Object.freeze({uploaded:true,...receipt,
   retention_days:30,key_profile:INITIAL_BACKUP_KEY_PROFILE,plaintext_uploaded:false,secret_key_uploaded:false});
 }catch(error){throw error instanceof BackupCustodyError?error:new BackupCustodyError('INITIAL_BACKUP_CUSTODY_UNAVAILABLE');}
}
