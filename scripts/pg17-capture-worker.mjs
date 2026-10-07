// Concrete private PostgreSQL17 capture worker. No action on import.
// The caller owns staging authorization, the live exported snapshot and custody.
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {readFile,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capturePrivateOutput,CaptureError} from './private-process-capture.mjs';
import {projectTarget,databaseTarget,databaseEnvironment} from './staging-preflight.mjs';

export const IMAGE='public.ecr.aws/supabase/postgres@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53';
const DOCKER='/usr/bin/docker', SOCKET='unix:///run/user/1001/docker.sock';
const CA=fileURLToPath(new URL('../ops/tls/supabase-platform-root-ca.pem',import.meta.url));
const CA_HASH='6ecd239038a7db063a6619b71742372ecfe06c0b0ec12a9993fee4445bf0d4d6';
const PROJECT='fbozlbgmktkgcdfqdaaz';
const ENVIRONMENT={PATH:'/usr/bin:/bin',LANG:'C.UTF-8'};
const PG_NAMES=['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT','PGAPPNAME','PGOPTIONS'];
const CONFIG_KEYS=['secret_named_settings','unknown_named_settings','subscriptions','foreign_servers','foreign_user_mappings','custom_tablespaces'];
const PLANS=new WeakSet();
const INSPECT='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"config_image":{{json .Config.Image}},"user":{{json .Config.User}},"label":{{json (index .Config.Labels "cluvo.staging.capture")}},"network":{{json .HostConfig.NetworkMode}},"ports":{{json .HostConfig.PortBindings}},"binds":{{json .HostConfig.Binds}},"mounts":{{json .Mounts}},"configured_mounts":{{json (index .HostConfig "Mounts")}},"volumes_from":{{json .HostConfig.VolumesFrom}},"privileged":{{json .HostConfig.Privileged}},"readonly":{{json .HostConfig.ReadonlyRootfs}},"log":{{json .HostConfig.LogConfig.Type}},"restart":{{json .HostConfig.RestartPolicy.Name}},"entrypoint":{{json .Config.Entrypoint}},"arguments":{{json .Config.Cmd}},"state":{{json .State.Status}},"exit":{{json .State.ExitCode}}}';
export class WorkerError extends Error{constructor(code){super(code);this.code=code;}}
const requireValue=(v,code)=>{if(!v)throw new WorkerError(code);};
const sha=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const noPublishedPorts=value=>value===null||(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===0);
const fixed=e=>e instanceof WorkerError?e:e instanceof CaptureError?new WorkerError(e.code):new WorkerError('PG17_CAPTURE_UNAVAILABLE');
function exact(value,keys,code){
 requireValue(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype,code);
 const ds=Object.getOwnPropertyDescriptors(value);
 requireValue(Reflect.ownKeys(ds).length===keys.length&&keys.every(k=>Object.hasOwn(ds,k)&&Object.hasOwn(ds[k],'value')),code);
 return Object.fromEntries(keys.map(k=>[k,ds[k].value]));
}

// PRIVATE: the resulting environment contains a password and must not be logged.
async function createCapturePlan(environment,context,configurationSafety,runId,kind){
 const settings=exact(environment,['APP_ENV','STAGING_SUPABASE_PROJECT_REF','SUPABASE_URL','MIGRATION_DATABASE_URL'],'PG17_TARGET_REQUIRED');
 const snapshot=exact(context,['backend_pid','backend_start','database','primary','exported_snapshot','visibility_snapshot'],'PG17_SNAPSHOT_REQUIRED');
 const safety=exact(configurationSafety,CONFIG_KEYS,'PG17_CONFIG_GATE_REQUIRED');
 requireValue(CONFIG_KEYS.every(k=>safety[k]===0),'PG17_CONFIG_GATE_BLOCKED');
 requireValue(snapshot.database==='postgres'&&snapshot.primary===true&&Number.isSafeInteger(snapshot.backend_pid)&&snapshot.backend_pid>0
  &&typeof snapshot.backend_start==='string'&&Number.isFinite(Date.parse(snapshot.backend_start))
  &&typeof snapshot.exported_snapshot==='string'&&/^[0-9A-F]+-[0-9A-F]+-[0-9]+$/.test(snapshot.exported_snapshot)
  &&typeof snapshot.visibility_snapshot==='string'&&/^[0-9]+:[0-9]+:[0-9,]*$/.test(snapshot.visibility_snapshot),'PG17_SNAPSHOT_REQUIRED');
 requireValue(typeof runId==='string'&&/^[0-9a-f]{32}$/.test(runId)&&['database','globals'].includes(kind),'PG17_WORKER_KIND_REQUIRED');
 let project,target;try{project=projectTarget(settings);target=databaseTarget(settings.MIGRATION_DATABASE_URL,project.ref);}catch{throw new WorkerError('PG17_TARGET_REQUIRED');}
 requireValue(project.ref===PROJECT,'PG17_PROJECT_PIN_MISMATCH');
 const [ca,metadata]=await Promise.all([readFile(CA),lstat(CA)]);
 requireValue(metadata.isFile()&&!metadata.isSymbolicLink()&&ca.length<65536&&sha(ca)===CA_HASH,'PG17_CA_PIN_MISMATCH');
 const pg=databaseEnvironment(target,{PATH:ENVIRONMENT.PATH,MIGRATION_SSL_ROOT_CERT_PATH:'/cluvo-ca.pem'});
 pg.PGAPPNAME='cluvo-staging-private-capture';
 pg.PGOPTIONS='-c default_transaction_read_only=on -c row_security=off -c statement_timeout=120000 -c idle_in_transaction_session_timeout=120000';
 const name='cluvo-staging-capture-'+runId+'-'+kind;
 const program=kind==='database'?'pg_dump':'pg_dumpall';
 const arguments_=kind==='database'
  ?['--no-password','--format=custom','--quote-all-identifiers','--large-objects','--lock-wait-timeout=15000ms','--snapshot='+snapshot.exported_snapshot]
  :['--globals-only','--no-role-passwords','--quote-all-identifiers','--no-password'];
 const create=['create','--pull=never','--name',name,'--label','cluvo.staging.capture='+name,
  '--network=bridge','--restart=no','--log-driver=none','--no-healthcheck','--user=postgres','--read-only',
  '--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=512m','--cpus=1',
  '--tmpfs','/tmp:rw,noexec,nosuid,mode=1777','--mount','type=bind,source='+CA+',target=/cluvo-ca.pem,readonly',
  ...PG_NAMES.flatMap(name=>['--env',name]),'--entrypoint='+program,IMAGE,...arguments_];
 const plan=Object.freeze({name,kind,program,arguments:Object.freeze(arguments_),create:Object.freeze(create),
  // A stable private orchestration parent and official public CA are required.
  environment:Object.freeze({...ENVIRONMENT,...pg}),file:kind==='database'?'database.dump':'globals.sql'});
 PLANS.add(plan);return plan;
}

export async function capturePlan(environment,context,configurationSafety,runId,kind){
 try{return await createCapturePlan(environment,context,configurationSafety,runId,kind);}
 catch(error){throw fixed(error);}
}

async function dockerControl(args,env=ENVIRONMENT){
 let child,closed,timer,killer,failed=false,stdout=[],stderr=[],bytes=0;
 try{
  child=spawn(DOCKER,['--host',SOCKET,...args],{env,stdio:['ignore','pipe','pipe']});
  closed=new Promise(resolve=>child.once('close',(status,signal)=>resolve({status,signal})));
  const stop=()=>{failed=true;child.kill('SIGTERM');killer??=setTimeout(()=>{child.kill('SIGKILL');child.stdout.destroy();child.stderr.destroy();},2000);};
  child.once('error',stop);timer=setTimeout(stop,20000);
  for(const [stream,parts]of [[child.stdout,stdout],[child.stderr,stderr]])stream.on('data',chunk=>{bytes+=chunk.length;if(bytes>200000)stop();else parts.push(chunk);});
  const exit=await closed;requireValue(!failed&&exit.signal===null,'PG17_CONTROL_UNAVAILABLE');
  return {status:exit.status,stdout:Buffer.concat(stdout).toString('utf8'),stderr:Buffer.concat(stderr).toString('utf8')};
 }catch(e){throw fixed(e);}finally{clearTimeout(timer);clearTimeout(killer);stdout=[];stderr=[];}
}
function absent(result,reference){
 const prefix='(?:error:|error response from daemon:)\\s+(?:no such object|no such container):\\s+';
 return result.status===1&&result.stdout.trim()===''&&result.stderr.length<=1024
  &&new RegExp('^'+prefix+reference+'$','i').test(result.stderr.trim());
}
function parsed(result){requireValue(result.status===0&&result.stderr==='', 'PG17_CONTROL_FAILED');try{return JSON.parse(result.stdout);}catch{throw new WorkerError('PG17_INSPECT_UNKNOWN');}}
function ownership(value,plan,imageId,expectedId){
 requireValue(value&&typeof value==='object'&&/^[0-9a-f]{64}$/.test(value.id??'')&&value.name==='/'+plan.name&&value.label===plan.name
  &&value.image===imageId&&value.config_image===IMAGE&&value.user==='postgres'&&(!expectedId||value.id===expectedId),'PG17_WORKER_OWNERSHIP_UNKNOWN');
 return value.id;
}
function isolation(value,plan){
 requireValue(value.network==='bridge'&&noPublishedPorts(value.ports)&&!value.binds&&!value.volumes_from&&!value.privileged
  &&value.readonly===true&&value.log==='none'&&value.restart==='no'&&equal(value.entrypoint,[plan.program])
  &&equal(value.arguments,plan.arguments)&&Array.isArray(value.mounts)&&value.mounts.every(m=>m.Type==='tmpfs'
   ||(m.Type==='bind'&&m.Source===CA&&m.Destination==='/cluvo-ca.pem'&&m.RW===false))
  &&value.mounts.filter(m=>m.Type==='bind').length===1&&Array.isArray(value.configured_mounts)
  &&value.configured_mounts.length===1&&value.configured_mounts[0].Type==='bind'
  &&value.configured_mounts[0].Source===CA&&value.configured_mounts[0].Target==='/cluvo-ca.pem'
  &&value.configured_mounts[0].ReadOnly===true,'PG17_WORKER_ISOLATION_UNKNOWN');
}

export async function captureWithOwnedWorker(plan,privateDirectory,maximumBytes,{control=dockerControl,capture=capturePrivateOutput}={}){
 // The plan must come from the trusted target/snapshot caller; this component
 // does not authenticate arbitrary objects as staging authorization.
 requireValue(PLANS.has(plan),'PG17_PLAN_REQUIRED');
 let id,imageId,creationAttempted=false,fileCreated=false,primary,cleanupFailed=false,result;
 const inspect=reference=>control(['inspect',reference,'--format',INSPECT]);
 try{
  const image=parsed(await control(['image','inspect',IMAGE,'--format','{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']));
  requireValue(/^sha256:[0-9a-f]{64}$/.test(image.id??'')&&Array.isArray(image.digests)&&image.digests.includes(IMAGE),'PG17_IMAGE_PIN_UNPROVED');imageId=image.id;
  requireValue(absent(await control(['inspect',plan.name,'--format','{{.Id}}']),plan.name),'PG17_NAME_NOT_PROVEN_UNUSED');
  creationAttempted=true;const created=await control(plan.create,plan.environment);
  requireValue(created.status===0&&created.stderr===''&&/^[0-9a-f]{64}$/.test(created.stdout.trim()),'PG17_CREATE_FAILED');id=created.stdout.trim();
  const before=parsed(await inspect(id));ownership(before,plan,imageId,id);isolation(before,plan);requireValue(before.state==='created','PG17_WORKER_STARTED_EARLY');
  result=await capture(DOCKER,['--host',SOCKET,'start','--attach',id],ENVIRONMENT,privateDirectory,plan.file,{maximumBytes,timeoutMs:180000});fileCreated=true;
  const after=parsed(await inspect(id));ownership(after,plan,imageId,id);isolation(after,plan);requireValue(after.state==='exited'&&after.exit===0,'PG17_WORKER_EXIT_UNPROVED');
 }catch(e){primary=fixed(e);if(e instanceof CaptureError&&e.code==='PRIVATE_CAPTURE_CLEANUP_FAILED')cleanupFailed=true;}
 finally{
  if(creationAttempted){
   try{
    // A create-client failure can leave a worker. Recover ownership from the
    // unique prechecked name and exact run label/image before any removal.
    const reference=id??plan.name,present=await inspect(reference);
    if(!absent(present,reference)){
     const observed=parsed(present);id=ownership(observed,plan,imageId,id);
     const removed=await control(['rm','--force','--volumes',id]);requireValue(removed.status===0&&removed.stderr==='','PG17_WORKER_REMOVE_FAILED');
    }
    const referenceAfter=id??plan.name;requireValue(absent(await control(['inspect',referenceAfter,'--format','{{.Id}}']),referenceAfter),'PG17_WORKER_REMOVAL_UNPROVED');
   }catch{cleanupFailed=true;}
  }
  if(fileCreated&&(primary||cleanupFailed)){try{await unlink(join(privateDirectory,plan.file));}catch(e){if(e?.code!=='ENOENT')cleanupFailed=true;}}
 }
 if(cleanupFailed)throw new WorkerError('PG17_CAPTURE_CLEANUP_FAILED');if(primary)throw primary;
 return Object.freeze({...result,worker_removed:true,pinned_image:IMAGE,unfiltered_database_dump_requested:plan.kind==='database',role_password_export_requested:false});
}

// Public version output only. These workers receive no PG environment, CA,
// network, database input, host mount or source-container reference.
export async function probeOwnedPg17Toolchain({control=dockerControl,runId=randomBytes(16).toString('hex')}={}){
 requireValue(typeof runId==='string'&&/^[0-9a-f]{32}$/.test(runId),'PG17_PROBE_RUN_REQUIRED');
 const image=parsed(await control(['image','inspect',IMAGE,'--format','{"id":{{json .Id}},"digests":{{json .RepoDigests}}}']));
 requireValue(/^sha256:[0-9a-f]{64}$/.test(image.id??'')&&Array.isArray(image.digests)&&image.digests.includes(IMAGE),'PG17_IMAGE_PIN_UNPROVED');
 const tools={};
 for(const program of ['pg_dump','pg_dumpall','pg_restore']){
  const plan={name:'cluvo-staging-capture-'+runId+'-version-'+program,program,arguments:['--version']};
  let id,created=false,primary,cleanupFailed=false,version;
  const inspect=reference=>control(['inspect',reference,'--format',INSPECT]);
  function guard(value,expectedState){
   ownership(value,plan,image.id,id);
   requireValue(value.network==='none'&&noPublishedPorts(value.ports)&&!value.binds&&!value.volumes_from&&!value.privileged
    &&value.readonly===true&&value.log==='none'&&value.restart==='no'&&equal(value.entrypoint,[program])
    &&equal(value.arguments,['--version'])&&Array.isArray(value.mounts)&&value.mounts.every(m=>m.Type==='tmpfs')
    &&(!value.configured_mounts||value.configured_mounts.length===0)&&value.state===expectedState,'PG17_PROBE_ISOLATION_UNKNOWN');
  }
  try{
   requireValue(absent(await control(['inspect',plan.name,'--format','{{.Id}}']),plan.name),'PG17_NAME_NOT_PROVEN_UNUSED');
   created=true;
   const started=await control(['create','--pull=never','--name',plan.name,'--label','cluvo.staging.capture='+plan.name,
    '--network=none','--restart=no','--log-driver=none','--no-healthcheck','--user=postgres','--read-only',
    '--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=32','--memory=512m','--cpus=1',
    '--tmpfs','/tmp:rw,noexec,nosuid,mode=1777','--entrypoint='+program,IMAGE,'--version']);
   requireValue(started.status===0&&started.stderr===''&&/^[0-9a-f]{64}$/.test(started.stdout.trim()),'PG17_CREATE_FAILED');id=started.stdout.trim();
   guard(parsed(await inspect(id)),'created');
   const output=await control(['start','--attach',id]);
   requireValue(output.status===0&&output.stderr==='','PG17_TOOL_VERSION_FAILED');
   const expected=new RegExp('^'+program+' \\(PostgreSQL\\) (17\\.[0-9]+)\\n?$'),match=expected.exec(output.stdout);
   requireValue(match,'PG17_TOOL_VERSION_UNKNOWN');version=match[1];
   const after=parsed(await inspect(id));guard(after,'exited');requireValue(after.exit===0,'PG17_WORKER_EXIT_UNPROVED');
  }catch(error){primary=fixed(error);}
  finally{
   if(created){try{
    const reference=id??plan.name,present=await inspect(reference);
    if(!absent(present,reference)){
     id=ownership(parsed(present),plan,image.id,id);
     const removed=await control(['rm','--force','--volumes',id]);requireValue(removed.status===0&&removed.stderr==='','PG17_WORKER_REMOVE_FAILED');
    }
    const referenceAfter=id??plan.name;requireValue(absent(await control(['inspect',referenceAfter,'--format','{{.Id}}']),referenceAfter),'PG17_WORKER_REMOVAL_UNPROVED');
   }catch{cleanupFailed=true;}}
  }
  if(cleanupFailed)throw new WorkerError('PG17_CAPTURE_CLEANUP_FAILED');if(primary)throw primary;
  tools[program]=version;
 }
 requireValue(Object.values(tools).every(version=>version===tools.pg_dump),'PG17_TOOLCHAIN_VERSION_MISMATCH');
 return Object.freeze({image:IMAGE,tools:Object.freeze(tools),workers_removed:3,network:'none',database_connections:0,source_calls:0});
}
