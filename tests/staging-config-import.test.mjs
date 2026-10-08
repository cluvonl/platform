import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmod, link, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const helper = fileURLToPath(new URL('../ops/cluvo-import-staging-config', import.meta.url));
const original = 'a'.repeat(40), selected = 'b'.repeat(40);
const payload = {
  format:'cluvo-staging-runtime-config-v1', source_sha:selected, workflow_run_id:'20',
  expected_source_sha:original, expected_config_version:0, actor:'contract-test',
  project_ref:'fbozlbgmktkgcdfqdaaz', app_url:'https://staging.cluvo.nl',
  supabase_url:'https://fbozlbgmktkgcdfqdaaz.supabase.co',
  supabase_publishable_key:'sb_publishable_contract_test',
  supabase_secret_key:'sb_secret_contract_test',
  invitation_token_secret:'synthetic-secret-with-$-and-#-32-bytes',
  mail_allowlist:'recipient@cluvo.example', compatible_rollback_shas:[original],
};
const environment = '# preserved settings\nAPP_ENV=staging\nAPP_MODE=prototype\nAPP_URL=https://staging.cluvo.nl\nMAIL_DRIVER=log\nKEEP_THIS=unchanged\n';
const target = {image_repository:'ghcr.io/cluvonl/platform', app_url:'https://staging.cluvo.nl',
  supabase_url:'', custom_setting:{unchanged:true}};
const current = {source_sha:original, workflow_run_id:'10', mode:'prototype'};

// Execute the actual installed helper's functions. Only this test harness
// replaces fixed paths/owner/group with its own private disposable fixture.
// No such path or privilege override exists in the production CLI.
const harness = `
import grp,os,pathlib,runpy,sys
module=runpy.run_path(sys.argv[1])
scope=module['main'].__globals__
root=pathlib.Path(sys.argv[2])
scope.update(CONFIG_DIR=root/'config',STATE_DIR=root/'state',TRUSTED_ROOT=root,
 ROOT_UID=os.getuid(),RUNTIME_GROUP=grp.getgrgid(os.getgid()).gr_name)
scenario=sys.argv[3]
if scenario in ('fail-second','crash-second','interrupt-second','fail-commit','crash-committed','crash-rollback-cleanup'):
 original_write=scope['atomic_write']
 fired=False
 def fault(directory,name,data,mode,gid):
  global fired
  matching=(name=='staging-target.json' and scenario in ('fail-second','crash-second','interrupt-second','crash-rollback-cleanup')) or \
   (name=='metadata.json' and b'"phase":"committed"' in data and scenario in ('fail-commit','crash-committed'))
  if matching and not fired:
   fired=True
   if scenario=='crash-second': os._exit(99)
   if scenario=='interrupt-second':
    import signal
    os.kill(os.getpid(),signal.SIGTERM)
   if scenario=='crash-committed':
    original_write(directory,name,data,mode,gid)
    os._exit(99)
   raise OSError('synthetic-private-error-'+scope['SUPABASE_URL'])
  return original_write(directory,name,data,mode,gid)
 scope['atomic_write']=fault
elif scenario=='assert-lock':
 original_transaction=scope['transaction']
 def locked_transaction(*arguments):
  import fcntl
  probe=os.open(root/'state'/'deploy.lock',os.O_RDWR)
  try:
   try: fcntl.flock(probe,fcntl.LOCK_EX|fcntl.LOCK_NB)
   except BlockingIOError: pass
   else: raise RuntimeError('lock-not-held')
  finally: os.close(probe)
  return original_transaction(*arguments)
 scope['transaction']=locked_transaction
elif scenario=='busy-lock':
 original_configure=scope['configure']
 def busy_configure(*arguments):
  import fcntl
  held=os.open(root/'state'/'deploy.lock',os.O_RDWR)
  fcntl.flock(held,fcntl.LOCK_EX)
  tick=[0]
  def clock():
   tick[0]+=61
   return tick[0]
  scope['time'].monotonic=clock
  try: return original_configure(*arguments)
  finally: os.close(held)
 scope['configure']=busy_configure
if scenario in ('crash-cleanup-backup','crash-cleanup-marker','crash-rollback-cleanup'):
 original_unlink=os.unlink
 def interrupted_unlink(name,*arguments,**options):
  result=original_unlink(name,*arguments,**options)
  matching=(name=='environment.old' and scenario in ('crash-cleanup-backup','crash-rollback-cleanup')) or \
   (name=='metadata.json' and scenario=='crash-cleanup-marker')
  if matching: os._exit(99)
  return result
 os.unlink=interrupted_unlink
elif scenario in ('crash-backup-temp','crash-metadata-temp','crash-config-temp'):
 original_write=os.write
 def interrupted_write(descriptor,data):
  filename=pathlib.Path(os.readlink('/proc/self/fd/'+str(descriptor)))
  matching=(scenario=='crash-backup-temp' and filename.parent.name=='config-import.pending') or \
   (scenario=='crash-metadata-temp' and b'"phase":"prepared"' in data) or \
   (scenario=='crash-config-temp' and filename.parent==root/'config')
  if matching and filename.name.startswith('.cluvo-import-'):
   original_write(descriptor,data[:max(1,len(data)//2)])
   os._exit(99)
  return original_write(descriptor,data)
 os.write=interrupted_write
raise SystemExit(scope['main'](sys.argv[4:]))
`;

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'cluvo-config-import-'));
  await chmod(root, 0o700);
  const config = join(root,'config'), state = join(root,'state');
  await mkdir(config,{mode:0o700});
  await mkdir(state,{mode:0o700});
  await writeFile(join(config,'staging.env'),environment,{mode:0o600});
  await writeFile(join(config,'staging-target.json'),JSON.stringify(target),{mode:0o600});
  await writeFile(join(state,'current.json'),JSON.stringify(current),{mode:0o600});
  await writeFile(join(state,'deploy.lock'),'',{mode:0o600});
  const invoke = (value = payload, scenario = '', argumentsOverride = [selected,'20']) => {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    return spawnSync('/usr/bin/python3',['-I','-c',harness,helper,root,scenario,...argumentsOverride],
      {input:raw,encoding:'utf8',timeout:10_000,env:{PATH:'/usr/bin:/bin'}});
  };
  try {await run({root,config,state,invoke});}
  finally {await rm(root,{recursive:true,force:true});}
}

function refused(result, code) {
  assert.equal(result.status,1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status,'refused');
  if (code) assert.equal(report.code,code);
  assert.equal(result.stderr,'');
  for (const privateValue of [payload.mail_allowlist,payload.supabase_secret_key,payload.invitation_token_secret]) {
    assert.ok(!result.stdout.includes(privateValue));
  }
}

test('imports the core config under the shared lock, preserves unrelated fields and audits scope/version', async () => {
  await fixture(async ({config,state,invoke}) => {
    const result=invoke(payload,'assert-lock');
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.deepEqual(JSON.parse(result.stdout),{status:'configured',config_version:1,source_sha:selected,
      workflow_run_id:'20',production_enabled:false,database_mutations:false,mail_delivery_claim:false});
    const value=await readFile(join(config,'staging.env'),'utf8');
    assert.ok(value.includes('MAIL_DRIVER=log\nKEEP_THIS=unchanged\n'));
    assert.ok(value.includes("APP_MODE='app'\n"));
    assert.ok(value.includes("INVITATION_TOKEN_SECRET='"+payload.invitation_token_secret+"'\n"));
    assert.equal((await stat(join(config,'staging.env'))).mode&0o777,0o640);
    const importedTarget=JSON.parse(await readFile(join(config,'staging-target.json'),'utf8'));
    assert.deepEqual(importedTarget.custom_setting,target.custom_setting);
    assert.equal(importedTarget.image_repository,target.image_repository);
    assert.equal(importedTarget.production_enabled,false);
    assert.deepEqual(importedTarget.compatible_rollback_shas,[original]);
    const record=JSON.parse(await readFile(join(state,'config-import.json'),'utf8'));
    assert.equal(record.version,1);
    assert.equal(record.audit[0].expected_version,0);
    assert.equal(record.audit[0].actor,payload.actor);
    assert.equal(record.audit[0].scope,'staging');
    assert.equal(record.audit[0].idempotency_key,'github-staging-config:20');
    assert.equal((await stat(join(state,'config-import.json'))).mode&0o777,0o600);
    await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
  });
});

test('exact repeated import is idempotent, changed content under the same run is refused', async () => {
  await fixture(async ({state,invoke}) => {
    assert.equal(invoke().status,0);
    const first=await readFile(join(state,'config-import.json'));
    const repeated=invoke();
    assert.equal(repeated.status,0);
    assert.equal(JSON.parse(repeated.stdout).status,'already_configured');
    assert.deepEqual(await readFile(join(state,'config-import.json')),first);
    refused(invoke({...payload,mail_allowlist:'other@cluvo.example'}),'CONFIG_IMPORT_REPLAY_REFUSED');
  });
});

test('version, current release and monotonic run guards prevent stale reconfiguration', async () => {
  await fixture(async ({invoke}) => {
    for (const changed of [{expected_config_version:1},{expected_source_sha:selected,compatible_rollback_shas:[selected]},
      {workflow_run_id:'9'}]) {
      const value={...payload,...changed};
      refused(invoke(value,'',[selected,value.workflow_run_id]));
    }
    assert.equal(invoke().status,0);
    refused(invoke({...payload,workflow_run_id:'21'},'',[selected,'21']),'CONFIG_EXPECTATION_CHANGED');
    assert.equal(invoke({...payload,workflow_run_id:'21',expected_config_version:1},'',[selected,'21']).status,0);
  });
});

test('duplicates, unknown fields, oversize input and malformed types fail before touching files', async () => {
  await fixture(async ({config,invoke}) => {
    const originalBytes=await readFile(join(config,'staging.env'));
    for (const value of ['{"format":"x","format":"y"}',JSON.stringify(payload).replace('"actor":"contract-test"',
      '"actor":"contract-test","actor":"other"'),JSON.stringify({...payload,extra:'not-allowed'}),
      ' '.repeat(32769),JSON.stringify({...payload,expected_config_version:true}),
      JSON.stringify({...payload,compatible_rollback_shas:[original,original]}),'{"nested":{"a":1,"a":2}}',
      JSON.stringify({...payload,actor:undefined}),JSON.stringify({...payload,workflow_run_id:20}),
      JSON.stringify(payload).replace('"expected_config_version":0','"expected_config_version":NaN')]) {
      refused(invoke(value));
    }
    assert.deepEqual(await readFile(join(config,'staging.env')),originalBytes);
  });
});

test('foreign targets, wrong keys, unsafe secret bytes, wildcard mail and missing compatibility are refused', async () => {
  await fixture(async ({invoke}) => {
    for (const change of [{project_ref:'z'.repeat(20)},{app_url:'https://production.cluvo.nl'},
      {supabase_url:'https://foreign.supabase.co'},{supabase_secret_key:'service-role-key'},
      {supabase_publishable_key:'sb_secret_wrong_type'},{invitation_token_secret:'short'},
      {invitation_token_secret:'synthetic-value-with-quote-32bytes\''},
      {invitation_token_secret:'synthetic-value-with-newline-32bytes\n'},
      {mail_allowlist:'*@cluvo.example'},{mail_allowlist:'one@cluvo.example\ntwo@cluvo.example'},
      {compatible_rollback_shas:[selected]},{mail_driver:'sendgrid'},{MIGRATION_DATABASE_URL:'forbidden'}]) {
      refused(invoke({...payload,...change}));
    }
    refused(invoke(payload,'',[selected,'21']));
    refused(invoke(payload,'',[selected,'20','unexpected']));
  });
});

test('root helper has no alternate path or environment configuration CLI and requires root', () => {
  const result=spawnSync('/usr/bin/python3',['-I',helper,selected,'20'],{input:JSON.stringify(payload),encoding:'utf8'});
  if (process.getuid()!==0) refused(result,'CONFIG_ROOT_REQUIRED');
  else assert.notEqual(result.status,0,'local machine does not have installed staging config');
});

test('symlinks, hardlinks, writable ancestors and public runtime secrets are refused', async () => {
  for (const attack of ['symlink','hardlink','writable-directory','public-runtime']) {
    await fixture(async ({config,invoke}) => {
      const filename=join(config,'staging.env');
      if (attack==='symlink') {
        await writeFile(join(config,'other.env'),environment,{mode:0o600});
        await rm(filename);
        await symlink('other.env',filename);
      } else if (attack==='hardlink') await link(filename,join(config,'other.env'));
      else if (attack==='writable-directory') await chmod(config,0o777);
      else await chmod(filename,0o644);
      refused(invoke());
    });
  }
});

test('public current-state files and unsafe lock files are refused; lock contention is bounded', async () => {
  for (const attack of ['public-current','public-lock','linked-lock','oversized-target','busy']) {
    await fixture(async ({config,state,invoke}) => {
      if (attack==='public-current') await chmod(join(state,'current.json'),0o644);
      else if (attack==='public-lock') await chmod(join(state,'deploy.lock'),0o644);
      else if (attack==='linked-lock') {
        await rm(join(state,'deploy.lock'));
        await symlink('current.json',join(state,'deploy.lock'));
      } else if (attack==='oversized-target') await writeFile(join(config,'staging-target.json'),' '.repeat(262145));
      refused(invoke(payload,attack==='busy'?'busy-lock':''),attack==='busy'?'CONFIG_LOCK_BUSY':undefined);
    });
  }
});

test('existing target mismatches and duplicate env names cannot be silently replaced', async () => {
  for (const attack of ['production-target','wrong-registry','wrong-project','duplicate-env','migration-env']) {
    await fixture(async ({config,invoke}) => {
      if (attack==='duplicate-env') await writeFile(join(config,'staging.env'),environment+'APP_ENV=staging\n');
      else if (attack==='migration-env') await writeFile(join(config,'staging.env'),environment+'MIGRATION_DATABASE_URL=synthetic\n');
      else await writeFile(join(config,'staging-target.json'),JSON.stringify({...target,...{
        'production-target':{production_enabled:true},'wrong-registry':{image_repository:'ghcr.io/foreign/app'},
        'wrong-project':{supabase_project_ref:'z'.repeat(20)},
      }[attack]}));
      refused(invoke());
    });
  }
});

test('second-file failure restores every previous byte and leaves no partial active pair', async () => {
  await fixture(async ({config,state,invoke}) => {
    const previousTarget=await readFile(join(config,'staging-target.json'));
    refused(invoke(payload,'fail-second'),'CONFIG_IMPORT_UNAVAILABLE');
    assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
    assert.deepEqual(await readFile(join(config,'staging-target.json')),previousTarget);
    await assert.rejects(stat(join(state,'config-import.json')),{code:'ENOENT'});
    await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
    assert.equal(invoke().status,0);
  });
});

test('actual SIGTERM during a config update rolls back the active files before exiting', async () => {
  await fixture(async ({config,state,invoke}) => {
    refused(invoke(payload,'interrupt-second'),'CONFIG_IMPORT_INTERRUPTED');
    assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
    assert.deepEqual(JSON.parse(await readFile(join(config,'staging-target.json'),'utf8')),target);
    await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
  });
});

test('process crash after first rename retains a private journal and the next import recovers before applying', async () => {
  await fixture(async ({config,state,invoke}) => {
    assert.equal(invoke(payload,'crash-second').status,99);
    const journal=join(state,'config-import.pending');
    assert.equal((await stat(journal)).mode&0o777,0o700);
    assert.equal((await stat(join(journal,'environment.old'))).mode&0o777,0o600);
    assert.ok((await readFile(join(config,'staging.env'),'utf8')).includes("APP_MODE='app'"));
    // An invalid expected version must fail only after recovery has restored
    // the prior pair; it may not strand the partial runtime update.
    refused(invoke({...payload,expected_config_version:1}),'CONFIG_EXPECTATION_CHANGED');
    assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
    assert.deepEqual(JSON.parse(await readFile(join(config,'staging-target.json'),'utf8')),target);
    await assert.rejects(stat(journal),{code:'ENOENT'});
    assert.equal(invoke().status,0);
  });
});

test('failure when committing restores an existing import version and its complete audit', async () => {
  await fixture(async ({config,state,invoke}) => {
    assert.equal(invoke().status,0);
    const files=[join(config,'staging.env'),join(config,'staging-target.json'),join(state,'config-import.json')];
    const before=await Promise.all(files.map(filename=>readFile(filename)));
    const next={...payload,workflow_run_id:'21',expected_config_version:1,mail_allowlist:'next@cluvo.example'};
    refused(invoke(next,'fail-commit',[selected,'21']),'CONFIG_IMPORT_UNAVAILABLE');
    assert.deepEqual(await Promise.all(files.map(filename=>readFile(filename))),before);
    assert.equal(invoke(next,'',[selected,'21']).status,0);
    const record=JSON.parse(await readFile(join(state,'config-import.json'),'utf8'));
    assert.equal(record.version,2);
    assert.equal(record.audit.length,2);
    assert.equal(record.audit[1].expected_version,1);
  });
});

test('crash after a durable commit preserves the new pair and completes idempotently on retry', async () => {
  await fixture(async ({state,invoke}) => {
    assert.equal(invoke(payload,'crash-committed').status,99);
    const stateBytes=await readFile(join(state,'config-import.json'));
    const next=invoke();
    assert.equal(next.status,0);
    assert.equal(JSON.parse(next.stdout).status,'already_configured');
    assert.deepEqual(await readFile(join(state,'config-import.json')),stateBytes);
    await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
  });
});

test('actual crashes during committed backup deletion or after the last marker deletion resume cleanup', async () => {
  for (const scenario of ['crash-cleanup-backup','crash-cleanup-marker']) {
    await fixture(async ({state,invoke}) => {
      assert.equal(invoke(payload,scenario).status,99);
      const record=await readFile(join(state,'config-import.json'));
      const repeated=invoke();
      assert.equal(repeated.status,0,repeated.stdout);
      assert.equal(JSON.parse(repeated.stdout).status,'already_configured');
      assert.deepEqual(await readFile(join(state,'config-import.json')),record);
      await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
    });
  }
});

test('a crash during rollback cleanup does not require the already deleted backup', async () => {
  await fixture(async ({config,state,invoke}) => {
    assert.equal(invoke(payload,'crash-rollback-cleanup').status,99);
    assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
    const marker=JSON.parse(await readFile(join(state,'config-import.pending','metadata.json'),'utf8'));
    assert.equal(marker.phase,'rolled_back');
    await assert.rejects(stat(join(state,'config-import.pending','environment.old')),{code:'ENOENT'});
    refused(invoke({...payload,expected_config_version:1}),'CONFIG_EXPECTATION_CHANGED');
    assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
    await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
    assert.equal(invoke().status,0);
  });
});

test('partial owned temporary files from backup, metadata or active-file writes are cleaned up on retry', async () => {
  for (const scenario of ['crash-backup-temp','crash-metadata-temp','crash-config-temp']) {
    await fixture(async ({config,state,invoke}) => {
      assert.equal(invoke(payload,scenario).status,99);
      assert.equal(invoke().status,0);
      const {readdir}=await import('node:fs/promises');
      assert.ok(!(await readdir(config)).some(name=>name.startsWith('.cluvo-import-')));
      assert.ok(!(await readdir(state)).some(name=>name.startsWith('.cluvo-import-')));
      await assert.rejects(stat(join(state,'config-import.pending')),{code:'ENOENT'});
    });
  }
});

test('unknown or unsafe temporary recovery files remain fail-closed', async () => {
  for (const attack of ['unknown-name','temporary-symlink','temporary-public']) {
    await fixture(async ({config,state,invoke}) => {
      const journal=join(state,'config-import.pending');
      await mkdir(journal,{mode:0o700});
      const filename=join(journal,attack==='unknown-name'?'unknown.private':'.cluvo-import-'+'c'.repeat(32));
      if (attack==='temporary-symlink') await symlink(join(config,'staging.env'),filename);
      else await writeFile(filename,'synthetic partial bytes',{mode:attack==='temporary-public'?0o644:0o600});
      refused(invoke());
      assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
      assert.ok(await stat(journal));
    });
  }
});

test('a hostile recovery marker is refused without opening a linked backup', async () => {
  await fixture(async ({config,state,invoke}) => {
    const journal=join(state,'config-import.pending');
    await mkdir(journal,{mode:0o700});
    await symlink(join(config,'staging.env'),join(journal,'environment.old'));
    await writeFile(join(journal,'metadata.json'),JSON.stringify({phase:'prepared',files:[
      {present:true,mode:0o600,gid:process.getgid(),sha256:'0'.repeat(64)},
      {present:true,mode:0o600,gid:process.getgid(),sha256:'0'.repeat(64)},
      {present:false,mode:null,gid:null,sha256:null},
    ]}),{mode:0o600});
    refused(invoke());
    assert.equal(await readFile(join(config,'staging.env'),'utf8'),environment);
  });
});
