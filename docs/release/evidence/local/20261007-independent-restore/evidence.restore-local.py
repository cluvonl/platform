#!/usr/bin/env python3
"""Local-only independent restore experiment; private material never reaches stdout."""
import argparse, base64, datetime, hashlib, io, json, os, pathlib, queue, re, secrets, select, stat, subprocess, sys, tarfile, threading, time, uuid
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

ROOT=pathlib.Path('/tmp/cluvo-staging-restore-adapter')
SOURCE='supabase_db_cluvo-local'
IMAGE='public.ecr.aws/supabase/postgres@sha256:0450166354dc9c1d25f0322ac8b580774d4fb0184d2b087f6e4fe9499c66cf53'
MIGRATIONS=pathlib.Path('/home/codex/repos/cluvo/nextjs-starter/supabase/migrations')
SOCKET='/run/user/1001/docker.sock'
DOCKER=['docker','--host','unix://'+SOCKET]
ENV={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C.UTF-8','LC_ALL':'C.UTF-8'}
RO='-c default_transaction_read_only=on -c row_security=off -c statement_timeout=600000 -c log_statement=none -c log_min_duration_statement=-1 -c log_min_error_statement=panic -c pgaudit.log=none -c auto_explain.log_min_duration=-1'
RO_UNPRIVILEGED='-c default_transaction_read_only=on -c row_security=off -c statement_timeout=600000'
LOCK_NAMESPACE=1129076054
LOCK_OBJECT=1465143369

class Failure(Exception):
 def __init__(self,code): self.code=code
def require(value,code):
 if not value: raise Failure(code)
def digest(value): return hashlib.sha256(value if isinstance(value,bytes) else json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def ident(value): return '"'+value.replace('"','""')+'"'
def literal(value): return "'"+value.replace("'","''")+"'"
def qualified(schema,name): return ident(schema)+'.'+ident(name)
def event(stage,**safe): print(json.dumps({'stage':stage,**safe},sort_keys=True),flush=True)
def private_write(path,data):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb') as f: f.write(data);f.flush();os.fsync(f.fileno())
def command(args,input=None,stdout=None,code='PROCESS_FAILED',timeout=600):
 r=subprocess.run(args,input=input,stdout=stdout if stdout is not None else subprocess.PIPE,stderr=subprocess.PIPE,env=ENV,timeout=timeout)
 if r.returncode!=0:
  kind='OTHER'
  for name,pattern in [('EXPECTED_PROBE_FAILED',rb'PROBE_FAILED'),('IMMUTABLE_DENIAL',rb'IMMUTABLE|APPEND_ONLY'),('LOGIN_PASSWORD_REQUIRED',rb'no password supplied|password authentication failed'),('LOGIN_DISABLED',rb'is not permitted to log in'),('SCHEMA_EXISTS',rb'schema .* already exists'),('ROLE_EXISTS',rb'role .* already exists'),('OBJECT_EXISTS',rb'already exists'),('MISSING_SCHEMA',rb'schema .* does not exist'),('MISSING_ROLE',rb'role .* does not exist'),('MISSING_FUNCTION',rb'function .* does not exist|could not find function'),('PERMISSION',rb'permission denied|must be owner'),('SUPERUSER',rb'must be superuser|Only superusers'),('EXTENSION_VERSION',rb'extension .* has no installation script|version.*is not installed|not available'),('DEPENDENCY',rb'cannot drop.*depend|cannot alter.*depend'),('PARAMETER',rb'unrecognized configuration parameter'),('READONLY',rb'read-only transaction'),('SYNTAX',rb'syntax error'),('FOREIGN_KEY',rb'violates foreign key constraint'),('DUPLICATE_KEY',rb'violates unique constraint')]:
   if re.search(pattern,r.stderr,re.I):kind=name;break
  state=re.search(rb'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):',r.stderr)
  event('private_process_diagnostic',operation=code,kind=kind,sqlstate=state.group(1).decode() if state else None,stderr_sha256=digest(r.stderr))
 require(r.returncode==0,code)
 require(not r.stderr.strip(),code+'_UNEXPECTED_STDERR')
 return r.stdout if stdout is None else b''
def docker(args,**kw): return command(DOCKER+args,**kw)
def sql_args(container,user,readonly=False):
 args=['exec','-i','-e','PGAPPNAME=cluvo-local-restore-proof']
 if readonly: args+=['-e','PGOPTIONS='+(RO if user=='supabase_admin' else RO_UNPRIVILEGED)]
 return DOCKER+args+[container,'psql','-X','-qAt','--no-password','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U',user,'-d','postgres']
def sql(container,user,query,readonly=False,code='SQL_FAILED'):
 return command(sql_args(container,user,readonly),input=query.encode(),code=code).decode().strip()
def json_sql(container,user,query,readonly=False,code='SQL_FAILED'):
 return json.loads(sql(container,user,"SET search_path TO '';\n"+query,readonly,code))

def stop_process(process):
 if process.poll() is None:
  process.terminate()
  try:process.wait(timeout=5)
  except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)

class SourceSession:
 def __init__(self):
  self.p=subprocess.Popen(sql_args(SOURCE,'supabase_admin',True),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV)
  self.lines=queue.Queue();self.errors=[]
  self.stdout_thread=threading.Thread(target=self.read_stdout,daemon=True);self.stdout_thread.start()
  self.stderr_thread=threading.Thread(target=self.read_stderr,daemon=True);self.stderr_thread.start()
  try:
   self.query("SELECT pg_advisory_lock(%s,%s); BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET search_path TO '';"%(LOCK_NAMESPACE,LOCK_OBJECT))
   self.state=json.loads(self.query("SELECT jsonb_build_object('snapshot',pg_export_snapshot(),'visibility',pg_current_snapshot()::text,'pid',pg_backend_pid(),'backend_start',(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid()),'readonly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'));"))
   require(self.state['readonly']=='on' and self.state['isolation']=='repeatable read','SOURCE_NOT_READONLY')
  except Exception:
   stop_process(self.p)
   self.stdout_thread.join(timeout=5);self.stderr_thread.join(timeout=5)
   raise
 def read_stdout(self):
  for b in iter(self.p.stdout.readline,b''): self.lines.put(b)
  self.lines.put(None)
 def read_stderr(self):
  for b in iter(self.p.stderr.readline,b''): self.errors.append(b)
 def query(self,query):
  token='CLUVO_PRIVATE_END_'+secrets.token_hex(12)
  self.p.stdin.write((query+'\n\\echo '+token+'\n').encode());self.p.stdin.flush()
  lines=[]
  deadline=time.monotonic()+600
  while time.monotonic()<deadline:
   try: line=self.lines.get(timeout=1)
   except queue.Empty:
    require(self.p.poll() is None,'SOURCE_SESSION_EXITED');continue
   require(line is not None,'SOURCE_SESSION_EXITED')
   if line.decode().strip()==token:
    require(not self.errors,'SOURCE_UNEXPECTED_STDERR')
    return b''.join(lines).decode().strip()
   lines.append(line)
  raise Failure('SOURCE_SESSION_TIMEOUT')
 def json(self,query): return json.loads(self.query(query))
 def check(self):
  state=self.json("SELECT jsonb_build_object('visibility',pg_current_snapshot()::text,'pid',pg_backend_pid(),'backend_start',(SELECT backend_start FROM pg_stat_activity WHERE pid=pg_backend_pid()),'readonly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),'exclusive',(SELECT count(*)=1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND classid=%s AND objid=%s AND objsubid=2 AND mode='ExclusiveLock' AND granted));"%(LOCK_NAMESPACE,LOCK_OBJECT))
  for k in ['visibility','pid','backend_start','readonly','isolation']: require(state[k]==self.state[k],'SOURCE_SNAPSHOT_SESSION_CHANGED')
  require(state['exclusive'],'SOURCE_EXCLUSIVE_LOCK_LOST')
 def close(self):
  try:
   if self.p.poll() is None:
    self.p.stdin.write(b'ROLLBACK;\n\\q\n');self.p.stdin.flush();self.p.stdin.close()
    self.p.wait(timeout=15)
  except Exception:
   stop_process(self.p);raise Failure('SOURCE_CLOSE_FAILED') from None
  finally:
   if not self.p.stdin.closed:self.p.stdin.close()
  self.stdout_thread.join(timeout=5);self.stderr_thread.join(timeout=5)
  require(not self.stdout_thread.is_alive() and not self.stderr_thread.is_alive(),'SOURCE_READER_CLOSE_FAILED')
  require(self.p.returncode==0 and not self.errors,'SOURCE_CLOSE_FAILED')

def aggregate(query):
 return "SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY to_jsonb(q)::text),'[]'::jsonb) FROM ("+query+") q;"
def acl(column,owner,kind):
 return "(SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(g.grantor),CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,g.privilege_type,g.is_grantable) ORDER BY pg_get_userbyid(g.grantor),g.grantee=0,pg_get_userbyid(g.grantee),g.privilege_type,g.is_grantable),'[]'::jsonb) FROM aclexplode(coalesce("+column+",acldefault('"+kind+"',"+owner+"))) g)"
NON_SYSTEM="n.nspname !~ '^pg_' AND n.nspname<>'information_schema'"
CATALOG={
 'schemas':"SELECT n.nspname name,pg_get_userbyid(n.nspowner) owner,"+acl('n.nspacl','n.nspowner','n')+" acl FROM pg_namespace n WHERE "+NON_SYSTEM,
 'relations':"SELECT n.nspname schema,c.relname name,c.relkind kind,c.relpersistence persistence,pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.relreplident replica_identity,c.reloptions options,CASE WHEN c.relkind='S' THEN "+acl('c.relacl','c.relowner','s')+" ELSE "+acl('c.relacl','c.relowner','r')+" END acl,CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,false) END viewdef FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE "+NON_SYSTEM+" AND c.relkind IN ('r','p','v','m','S','f')",
 'columns':"SELECT n.nspname schema,c.relname relation,a.attname name,row_number() OVER(PARTITION BY c.oid ORDER BY a.attnum) position,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,a.attidentity identity,a.attgenerated generated,a.attstorage storage,a.attcompression compression,pg_get_expr(d.adbin,d.adrelid,false) default_expression,"+acl('a.attacl','c.relowner','c')+" acl FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE "+NON_SYSTEM+" AND c.relkind IN ('r','p','v','m','S','f') AND a.attnum>0 AND NOT a.attisdropped",
 'policies':"SELECT n.nspname schema,c.relname relation,p.polname name,p.polcmd command,p.polpermissive permissive,(SELECT jsonb_agg(CASE WHEN roleid=0 THEN 'PUBLIC' ELSE pg_get_userbyid(roleid) END ORDER BY CASE WHEN roleid=0 THEN 'PUBLIC' ELSE pg_get_userbyid(roleid) END) FROM unnest(p.polroles) roleid) roles,pg_get_expr(p.polqual,p.polrelid,false) using_expression,pg_get_expr(p.polwithcheck,p.polrelid,false) check_expression FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE "+NON_SYSTEM,
 'functions':"SELECT n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) arguments,p.prokind kind,pg_get_userbyid(p.proowner) owner,l.lanname language,p.prosecdef security_definer,p.proleakproof leakproof,p.provolatile volatility,p.proparallel parallel,p.proisstrict strict,p.proconfig config,p.prosrc source,p.probin binary,CASE WHEN p.prokind<>'a' THEN pg_get_functiondef(p.oid) END definition,"+acl('p.proacl','p.proowner','f')+" acl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE "+NON_SYSTEM,
 'constraints':"SELECT n.nspname schema,c.relname relation,t.conname name,t.contype kind,t.condeferrable deferrable,t.condeferred deferred,t.convalidated validated,pg_get_constraintdef(t.oid,false) definition FROM pg_constraint t LEFT JOIN pg_class c ON c.oid=t.conrelid JOIN pg_namespace n ON n.oid=t.connamespace WHERE "+NON_SYSTEM,
 'indexes':"SELECT n.nspname schema,c.relname name,pg_get_indexdef(c.oid) definition,i.indisvalid valid,i.indisready ready,i.indisreplident replica_identity FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE "+NON_SYSTEM,
 'triggers':"SELECT n.nspname schema,c.relname relation,t.tgname name,t.tgenabled enabled,pg_get_triggerdef(t.oid,false) definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE "+NON_SYSTEM+" AND NOT t.tgisinternal",
 'event_triggers':"SELECT e.evtname name,e.evtevent event,pg_get_userbyid(e.evtowner) owner,e.evtfoid::regproc::text function,e.evtenabled enabled,e.evttags tags FROM pg_event_trigger e",
 'extensions':"SELECT e.extname name,e.extversion version,n.nspname schema,pg_get_userbyid(e.extowner) owner,e.extrelocatable relocatable,(SELECT coalesce(jsonb_agg(jsonb_build_array(pg_describe_object('pg_class'::regclass,configid,0),condition) ORDER BY pg_describe_object('pg_class'::regclass,configid,0)),'[]'::jsonb) FROM unnest(e.extconfig,e.extcondition) AS u(configid,condition)) config FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace",
 'extension_members':"SELECT e.extname extension,pg_describe_object(d.classid,d.objid,d.objsubid) object FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid WHERE d.refclassid='pg_extension'::regclass AND d.deptype='e'",
 'default_acls':"SELECT pg_get_userbyid(a.defaclrole) owner,n.nspname schema,a.defaclobjtype kind,"+acl('a.defaclacl','a.defaclrole','r')+" acl FROM pg_default_acl a LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace",
 'roles':"SELECT rolname name,rolsuper superuser,rolinherit inherit,rolcreaterole create_role,rolcreatedb create_db,rolcanlogin login,rolreplication replication,rolbypassrls bypass_rls,rolconnlimit connection_limit,rolvaliduntil valid_until,rolconfig config FROM pg_roles",
 'role_memberships':"SELECT pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,pg_get_userbyid(grantor) grantor,admin_option admin,inherit_option inherit,set_option can_set FROM pg_auth_members",
 'role_database_settings':"SELECT CASE WHEN s.setdatabase=0 THEN '*' ELSE d.datname END database,CASE WHEN s.setrole=0 THEN '*' ELSE pg_get_userbyid(s.setrole) END role,s.setconfig config FROM pg_db_role_setting s LEFT JOIN pg_database d ON d.oid=s.setdatabase WHERE s.setdatabase=0 OR d.datname='postgres'",
 'parameter_acls':"SELECT parname name,(SELECT coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(g.grantor),CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,g.privilege_type,g.is_grantable) ORDER BY pg_get_userbyid(g.grantor),g.grantee=0,pg_get_userbyid(g.grantee),g.privilege_type),'[]'::jsonb) FROM aclexplode(paracl) g) acl FROM pg_parameter_acl",
 'security_labels':"SELECT pg_describe_object(classoid,objoid,objsubid) object,provider,label FROM pg_seclabel WHERE classoid<>'pg_authid'::regclass UNION ALL SELECT 'role '||pg_get_userbyid(objoid),provider,label FROM pg_shseclabel WHERE classoid='pg_authid'::regclass",
 'sequences':"SELECT n.nspname schema,c.relname name,format_type(s.seqtypid,NULL) type,s.seqstart start,s.seqincrement increment,s.seqmax max,s.seqmin min,s.seqcache cache,s.seqcycle cycle FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE "+NON_SYSTEM,
 'database':"SELECT d.datname name,pg_get_userbyid(d.datdba) owner,pg_encoding_to_char(d.encoding) encoding,d.datlocprovider locale_provider,d.datcollate collate,d.datctype ctype,d.datlocale locale,d.daticurules icu_rules,d.datcollversion collation_version,d.datconnlimit connection_limit,d.datistemplate is_template,d.datallowconn allow_connections,"+acl('d.datacl','d.datdba','d')+" acl FROM pg_database d WHERE d.datname='postgres'",
 'types':"SELECT n.nspname schema,t.typname name,t.typtype kind,pg_get_userbyid(t.typowner) owner,t.typnotnull not_null,t.typdefault default_value,"+acl('t.typacl','t.typowner','T')+" acl,(SELECT jsonb_agg(jsonb_build_array(e.enumsortorder,e.enumlabel) ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid) enum_values FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE "+NON_SYSTEM,
}

# Include extension-owned pg_catalog routines/types, which a normal dump does not
# recreate individually, and logical partition/publication metadata.
MEMBER="EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid=%s::regclass AND d.objid=%s AND d.refclassid='pg_extension'::regclass AND d.deptype='e')"
CATALOG['functions']=CATALOG['functions'].replace('WHERE '+NON_SYSTEM,'WHERE ('+NON_SYSTEM+' OR '+MEMBER% (literal('pg_proc'),'p.oid')+')')
CATALOG['types']=CATALOG['types'].replace('WHERE '+NON_SYSTEM,'WHERE ('+NON_SYSTEM+' OR '+MEMBER% (literal('pg_type'),'t.oid')+')')
CATALOG.update({
 'inheritance':"SELECT pg_describe_object('pg_class'::regclass,i.inhrelid,0) child,pg_describe_object('pg_class'::regclass,i.inhparent,0) parent,i.inhseqno sequence,i.inhdetachpending detach_pending FROM pg_inherits i",
 'partition_bounds':"SELECT n.nspname schema,c.relname name,pg_get_expr(c.relpartbound,c.oid,false) bound,CASE WHEN p.partrelid IS NOT NULL THEN pg_get_partkeydef(c.oid) END key FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_partitioned_table p ON p.partrelid=c.oid WHERE c.relispartition OR p.partrelid IS NOT NULL",
 'publications':"SELECT pubname name,pg_get_userbyid(pubowner) owner,puballtables all_tables,pubinsert insert,pubupdate update,pubdelete delete,pubtruncate truncate,pubviaroot via_root FROM pg_publication",
 'publication_relations':"SELECT p.pubname publication,n.nspname schema,c.relname relation,(SELECT jsonb_agg(a.attname ORDER BY x.ordinality) FROM unnest(r.prattrs::smallint[]) WITH ORDINALITY x(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=x.attnum) AS attributes,pg_get_expr(r.prqual,r.prrelid,false) AS predicate FROM pg_publication_rel r JOIN pg_publication p ON p.oid=r.prpubid JOIN pg_class c ON c.oid=r.prrelid JOIN pg_namespace n ON n.oid=c.relnamespace",
 'publication_schemas':"SELECT p.pubname publication,n.nspname schema FROM pg_publication_namespace r JOIN pg_publication p ON p.oid=r.pnpubid JOIN pg_namespace n ON n.oid=r.pnnspid",
 'tablespaces':"SELECT spcname name,pg_get_userbyid(spcowner) owner,spcoptions options,"+acl('spcacl','spcowner','t')+" acl,pg_tablespace_location(oid) location FROM pg_tablespace",
 'ranges':"SELECT n.nspname schema,t.typname name,format_type(r.rngsubtype,NULL) subtype,pg_describe_object('pg_collation'::regclass,r.rngcollation,0) collation,pg_describe_object('pg_opclass'::regclass,r.rngsubopc,0) opclass,r.rngcanonical::regproc::text canonical,r.rngsubdiff::regproc::text subtype_diff,format_type(r.rngmultitypid,NULL) multirange FROM pg_range r JOIN pg_type t ON t.oid=r.rngtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE "+NON_SYSTEM,
 'collations':"SELECT n.nspname schema,c.collname name,pg_get_userbyid(c.collowner) owner,c.collprovider provider,c.collisdeterministic deterministic,c.collencoding encoding,c.collcollate collate,c.collctype ctype,c.colllocale locale,c.collicurules icu_rules,c.collversion version FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE "+NON_SYSTEM,
})

def collect_catalog(query,bootstrap=None):
 result={}
 for k,v in CATALOG.items():
  try:result[k]=json.loads(query(aggregate(v)))
  except Exception:raise Failure('CATALOG_CAPTURE_'+k.upper()+'_FAILED') from None
 if bootstrap: result['roles']=[r for r in result['roles'] if r['name']!=bootstrap]
 return result
def data_manifest(query,catalog):
 result=[]
 for r in catalog['relations']:
  if r['kind'] not in ['r','m']: continue
  table=qualified(r['schema'],r['name']);only='ONLY ' if r['kind']=='r' else ''
  q="SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex')) FROM "+only+table+' t;'
  result.append({'schema':r['schema'],'relation':r['name'],**json.loads(query(q))})
 return sorted(result,key=lambda r:(r['schema'],r['relation']))
def sequence_manifest(query,catalog):
 return [{**r,**json.loads(query('SELECT jsonb_build_object(\'last_value\',last_value,\'is_called\',is_called) FROM '+qualified(r['schema'],r['name'])+';'))} for r in catalog['sequences']]
def largeobjects(query):
 return json.loads(query(aggregate("SELECT oid,pg_get_userbyid(lomowner) owner,"+acl('lomacl','lomowner','L')+" acl,octet_length(lo_get(oid)) bytes,encode(sha256(lo_get(oid)),'hex') sha256 FROM pg_largeobject_metadata")))

PROFILE="""SELECT jsonb_build_object('server_version',current_setting('server_version_num')::int,'primary',NOT pg_is_in_recovery(),'readonly',current_setting('transaction_read_only')='on','application_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'),'migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations),'subscriptions',(SELECT count(*) FROM pg_subscription WHERE subdbid=(SELECT oid FROM pg_database WHERE datname=current_database())),'foreign_tables',(SELECT count(*) FROM pg_foreign_table),'large_objects',(SELECT count(*) FROM pg_largeobject_metadata),'vault_cipher_rows',(SELECT count(*) FROM vault.secrets),'storage_objects',(SELECT count(*) FROM storage.objects),'owner_restricted',(SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='cluvo_command_owner'));
"""

def validate_local_source():
 require(stat.S_ISSOCK(os.stat(SOCKET).st_mode),'LOCAL_DOCKER_SOCKET_REQUIRED')
 image_id=docker(['image','inspect',IMAGE,'--format','{{.Id}}']).decode().strip()
 source=json.loads(docker(['inspect',SOURCE,'--format','{"image":{{json .Image}},"running":{{json .State.Running}},"labels":{{json .Config.Labels}}}']))
 require(source['image']==image_id,'SOURCE_IMAGE_MISMATCH')
 require(source['running'],'SOURCE_NOT_RUNNING')
 labels=source.get('labels') or {}
 require(labels.get('com.supabase.cli.project')=='cluvo-local','SOURCE_PROJECT_LABEL_MISMATCH')
 return image_id

def capture_file(path,args,code):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb') as stream:
  command(args,stdout=stream,code=code);stream.flush();os.fsync(stream.fileno())
 require(path.stat().st_size>0,code+'_EMPTY')

def globals_state(container,user):
 q=lambda query:sql(container,user,"SET search_path TO '';"+query,True)
 return {k:json.loads(q(aggregate(CATALOG[k]))) for k in ['roles','role_memberships','role_database_settings','parameter_acls','tablespaces']}

def bundle_material(run_dir,files,manifest):
 # This is an executed encryption/decryption proof. The random demonstration key
 # is process-memory only and deliberately not an operational recovery key.
 plaintext=io.BytesIO()
 with tarfile.open(fileobj=plaintext,mode='w') as tar:
  for name,data in [*( (p.name,p.read_bytes()) for p in files),('manifest.private.json',json.dumps(manifest,sort_keys=True,separators=(',',':')).encode())]:
   member=tarfile.TarInfo(name);member.size=len(data);member.mode=0o600;member.mtime=0;tar.addfile(member,io.BytesIO(data))
 body=plaintext.getvalue();private_write(run_dir/'bundle.private.tar',body)
 key=AESGCM.generate_key(bit_length=256);nonce=secrets.token_bytes(12);aad=b'CLUVO_LOCAL_RESTORE_V1:'+digest(manifest).encode()
 encrypted=nonce+AESGCM(key).encrypt(nonce,body,aad);private_write(run_dir/'bundle.encrypted.aesgcm',encrypted)
 tampered=bytearray(encrypted);tampered[-1]^=1
 for trial_key,trial in [(AESGCM.generate_key(bit_length=256),encrypted),(key,bytes(tampered))]:
  try:AESGCM(trial_key).decrypt(trial[:12],trial[12:],aad);raise Failure('ENCRYPTION_NEGATIVE_NOT_REJECTED')
  except InvalidTag:pass
 restored=AESGCM(key).decrypt(encrypted[:12],encrypted[12:],aad);require(restored==body,'BUNDLE_DECRYPT_MISMATCH')
 private_write(run_dir/'bundle.decrypted.private.tar',restored)
 content={}
 with tarfile.open(fileobj=io.BytesIO(restored),mode='r:') as tar:
  require(len(tar.getmembers())==3,'BUNDLE_MEMBER_COUNT_MISMATCH')
  for member in tar.getmembers():
   require(member.name in [p.name for p in files]+['manifest.private.json'] and member.isfile(),'BUNDLE_MEMBER_INVALID')
   content[member.name]=tar.extractfile(member).read()
 for p in files:require(content[p.name]==p.read_bytes(),'BUNDLE_SOURCE_BYTES_CHANGED')
 require(json.loads(content['manifest.private.json'])==manifest,'BUNDLE_MANIFEST_CHANGED')
 return content,{'aes256_gcm':True,'tamper_rejected':True,'wrong_key_rejected':True,'ciphertext_sha256':digest(encrypted),'plaintext_sha256':digest(body)}

STARTUP="""set -eu
umask 077
if initdb -D /restore/pgdata -U "$1" --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=en_US.UTF-8 --locale-provider=icu --icu-locale=en-US >/restore/initdb.private.log 2>&1; then
 printf "include = '/etc/postgresql-custom/supautils.conf'\n" >>/restore/pgdata/postgresql.conf
 postgres -D /restore/pgdata -c listen_addresses='' -c unix_socket_directories=/restore -c unix_socket_permissions=0700 -c port=5432 -c max_worker_processes=0 -c max_parallel_workers=0 -c max_parallel_workers_per_gather=0 -c max_logical_replication_workers=0 -c autovacuum=off -c cron.launch_active_jobs=off -c shared_preload_libraries='pg_stat_statements,pgaudit,plpgsql,plpgsql_check,pg_cron,pg_net,pgsodium,auto_explain,pg_tle,plan_filter,supabase_vault' -c session_preload_libraries=supautils -c pgsodium.getkey_script=/usr/lib/postgresql/bin/pgsodium_getkey.sh -c vault.getkey_script=/usr/lib/postgresql/bin/pgsodium_getkey.sh -c logging_collector=off -c log_statement=none -c log_min_duration_statement=-1 -c log_min_error_statement=panic -c log_connections=off -c log_disconnections=off -c pgaudit.log=none -c auto_explain.log_min_duration=-1 -c log_parameter_max_length=0 -c log_parameter_max_length_on_error=0 -c archive_mode=off -c ssl=off >/restore/postgres.private.log 2>&1 &
 server_pid=$!
 if wait "$server_pid"; then printf 'POSTMASTER_STOPPED' >/restore/failure.fixed; else printf 'POSTMASTER_START_FAILED' >/restore/failure.fixed; fi
else
 printf 'INITDB_FAILED' >/restore/failure.fixed
fi
# Preserve private startup diagnostics until the parent removes this clone.
while :; do sleep 30; done
"""

def clone_sql_args(container,user,readonly=False):
 # The only endpoint is the private Unix socket inside the disposable container.
 return sql_args(container,user,readonly)+['-h','/restore']
def clone_sql(container,user,query,readonly=False,code='CLONE_SQL_FAILED'):
 return command(clone_sql_args(container,user,readonly),input=query.encode(),code=code).decode().strip()

def startup_clone(clone,bootstrap):
 docker(['run','--detach','--pull=never','--name',clone,'--network=none','--restart=no','--log-driver=none','--no-healthcheck','--user=postgres','--tmpfs','/restore:rw,mode=1777','--entrypoint=/bin/sh',IMAGE,'-c',STARTUP,'cluvo-local-init',bootstrap],code='CLONE_START_FAILED')
 for _ in range(120):
  r=subprocess.run(DOCKER+['exec',clone,'pg_isready','-h','/restore','-U',bootstrap,'-d','postgres'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV,timeout=10)
  if r.returncode==0:break
  failed=subprocess.run(DOCKER+['exec',clone,'test','-f','/restore/failure.fixed'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV,timeout=10)
  if failed.returncode==0:
   fixed=docker(['exec',clone,'cat','/restore/failure.fixed']).decode().strip();require(fixed in ['INITDB_FAILED','POSTMASTER_START_FAILED','POSTMASTER_STOPPED'],'CLONE_STARTUP_UNKNOWN_FAILURE')
   logname='initdb.private.log' if fixed=='INITDB_FAILED' else 'postgres.private.log';log=docker(['exec',clone,'cat','/restore/'+logname])
   kind='OTHER'
   for name,pattern in [('LOCALE',rb'invalid locale|locale.*not supported'),('AUTH_METHOD',rb'invalid authentication|unrecognized authentication'),('PERMISSION',rb'Permission denied'),('LIBRARY',rb'could not (access|load) file|cannot open shared object'),('WORKER_LIMIT',rb'worker.*(limit|register|slot)'),('UNRECOGNIZED_PARAMETER',rb'unrecognized configuration parameter'),('DIRECTORY',rb'could not create directory')]:
    if re.search(pattern,log,re.I):kind=name;break
   event('clone_startup_diagnostic',phase=fixed,kind=kind,private_log_sha256=digest(log))
   raise Failure(fixed)
  time.sleep(0.25)
 else:raise Failure('CLONE_NOT_READY')
 state=json.loads(docker(['inspect',clone,'--format','{"image":{{json .Image}},"user":{{json .Config.User}},"privileged":{{json .HostConfig.Privileged}},"binds":{{json .HostConfig.Binds}},"mounts":{{json .Mounts}},"network":{{json .HostConfig.NetworkMode}},"ports":{{json .HostConfig.PortBindings}},"log_driver":{{json .HostConfig.LogConfig.Type}},"running":{{json .State.Running}}}']))
 require(state['network']=='none' and not state['ports'] and state['log_driver']=='none' and state['running'],'CLONE_ISOLATION_MISMATCH')
 require(state['image']==docker(['image','inspect',IMAGE,'--format','{{.Id}}']).decode().strip() and state['user']=='postgres' and not state['privileged'] and not state['binds'],'CLONE_IMAGE_PRIVILEGE_MISMATCH')
 require(all(m['Type']=='tmpfs' and m['Destination']=='/restore' for m in state['mounts']),'CLONE_UNEXPECTED_EXTERNAL_MOUNT')
 for name in ['initdb.private.log','postgres.private.log']:
  private_log=docker(['exec',clone,'cat','/restore/'+name],code='CLONE_STARTUP_LOG_CHECK_FAILED')
  require(not re.search(rb'(?im)\b(WARNING|ERROR|FATAL|PANIC):',private_log),'UNEXPECTED_CLONE_STARTUP_DIAGNOSTIC')
 check_jobs(clone,bootstrap)

def check_jobs(clone,bootstrap):
 state=json.loads(clone_sql(clone,bootstrap,"SELECT jsonb_build_object('version',current_setting('server_version_num')::int,'max_workers',current_setting('max_worker_processes')::int,'cron_disabled',current_setting('cron.launch_active_jobs')='off','listen_disabled',current_setting('listen_addresses')='','unexpected_workers',(SELECT count(*) FROM pg_stat_activity WHERE backend_type NOT IN ('client backend','checkpointer','background writer','walwriter')));",True))
 require(state=={'version':170011,'max_workers':0,'cron_disabled':True,'listen_disabled':True,'unexpected_workers':0},'CLONE_JOB_SUPPRESSION_MISMATCH')

def restore_globals(clone,bootstrap,raw):
 # initdb must own OID10 using the same source role, to preserve grants whose
 # grantor is the hardwired bootstrap superuser. The archive remains untouched.
 declaration=('CREATE ROLE '+ident(bootstrap)+';').encode()
 lines=raw.splitlines(keepends=True)
 require(sum(line.strip()==declaration for line in lines)==1,'BOOTSTRAP_DECLARATION_NOT_UNIQUE')
 require(b'CREATE ROLE '+ident(bootstrap).encode()+b';'==declaration,'BOOTSTRAP_DECLARATION_INVALID')
 stream=b''.join(line for line in lines if line.strip()!=declaration)
 command(clone_sql_args(clone,bootstrap),input=stream,code='GLOBALS_RESTORE_FAILED')
 return 1

def restore_database(clone,bootstrap,raw,catalog):
 # PostgreSQL17 pg_dump deliberately omits CREATE for initdb's public schema.
 # Retain that fresh empty schema; its source ownership/ACL are replayed normally.
 # pg_restore's ordinary owner/ACL replay is retained. No object filters.
 command(DOCKER+['exec','-i',clone,'pg_restore','--exit-on-error','--single-transaction','--no-password','-h','/restore','-U',bootstrap,'-d','postgres'],input=raw,code='DATABASE_RESTORE_FAILED')
 db=catalog['database'][0]
 clone_sql(clone,bootstrap,'ALTER DATABASE postgres OWNER TO '+ident(db['owner'])+';',code='DATABASE_OWNER_RESTORE_FAILED')
 require(db['allow_connections'] and not db['is_template'],'SOURCE_DATABASE_PROPERTIES_UNSUPPORTED')
 clone_sql(clone,bootstrap,'ALTER DATABASE postgres CONNECTION LIMIT '+str(int(db['connection_limit']))+';',code='DATABASE_PROPERTIES_RESTORE_FAILED')
 # pg_dumpall cannot capture per-database role settings and --create is omitted
 # so the fresh cluster remains one database. Replay those private settings.
 statements=''
 for setting in catalog['role_database_settings']:
  if setting['database']!='postgres':continue
  for config in setting['config']:
   key,value=config.split('=',1);require(re.fullmatch(r'[a-z_][a-z0-9_.]*',key) is not None,'DATABASE_SETTING_NAME_INVALID')
   statements+=('ALTER DATABASE postgres' if setting['role']=='*' else 'ALTER ROLE '+ident(setting['role'])+' IN DATABASE postgres')+' SET '+key+' TO '+literal(value)+';'
 if statements:clone_sql(clone,bootstrap,statements,code='DATABASE_SETTINGS_RESTORE_FAILED')
 # The archive without --create does not contain database ACL. Replay normalized
 # grants under their original grantor instead of fabricating an effective ACL.
 current=json.loads(clone_sql(clone,bootstrap,aggregate(CATALOG['database']),True))[0]
 if current['acl']!=db['acl']:
  roles=sorted({g[1] for g in current['acl']+db['acl']})
  body=''
  for role in roles:body+='REVOKE ALL ON DATABASE postgres FROM '+('PUBLIC' if role=='PUBLIC' else ident(role))+';'
  for grantor,grantee,privilege,grantable in db['acl']:
   require(privilege in ['CREATE','CONNECT','TEMPORARY'],'DATABASE_ACL_PRIVILEGE_INVALID')
   body+='SET SESSION AUTHORIZATION '+ident(grantor)+';GRANT '+privilege+' ON DATABASE postgres TO '+('PUBLIC' if grantee=='PUBLIC' else ident(grantee))+(' WITH GRANT OPTION' if grantable else '')+';RESET SESSION AUTHORIZATION;'
  clone_sql(clone,bootstrap,body,code='DATABASE_ACL_RESTORE_FAILED')

def restore_extension_schema_acls(clone,bootstrap,catalog):
 # Normal pg_dump omits some schema grants attached to extension-created schemas.
 # Use the authenticated private catalog from the same capture to replay only
 # absent source grants; no unexplained clone privilege or owner is tolerated.
 restored=json.loads(clone_sql(clone,bootstrap,"SET search_path TO '';"+aggregate(CATALOG['schemas']),True))
 source={s['name']:s for s in catalog['schemas']};target={s['name']:s for s in restored}
 require(source.keys()==target.keys(),'SCHEMA_SET_CHANGED_BEFORE_ACL_REPLAY')
 statements='';replayed=0;plan=[]
 for name,expected in source.items():
  actual=target[name];require(expected['owner']==actual['owner'],'SCHEMA_OWNER_CHANGED_BEFORE_ACL_REPLAY')
  grants={tuple(g) for g in expected['acl']};present={tuple(g) for g in actual['acl']}
  require(present<=grants,'UNEXPECTED_CLONE_SCHEMA_GRANTS')
  if grants-present:plan.append({'schema':name,'owner':expected['owner'],'grants':sorted(grants-present)})
  for grantor,grantee,privilege,grantable in sorted(grants-present):
   require(privilege in ['USAGE','CREATE'],'SCHEMA_GRANT_PRIVILEGE_INVALID')
   statements+='SET SESSION AUTHORIZATION '+ident(grantor)+';GRANT '+privilege+' ON SCHEMA '+ident(name)+' TO '+('PUBLIC' if grantee=='PUBLIC' else ident(grantee))+(' WITH GRANT OPTION' if grantable else '')+';RESET SESSION AUTHORIZATION;';replayed+=1
 if statements:clone_sql(clone,bootstrap,statements,code='EXTENSION_SCHEMA_ACL_REPLAY_FAILED')
 return replayed,{'adapter':'extension_schema_missing_source_grants_v1','source_schemas_sha256':digest(catalog['schemas']),'objects':plan}

def compare(label,expected,actual):
 if expected!=actual:
  if label.startswith('catalog_') and isinstance(expected,list) and isinstance(actual,list):
   changed=set();mismatches=0
   keys=['schema','relation','name','arguments','kind','object','extension','role','member','grantor','database','owner','publication','child','parent','sequence']
   family=label[len('catalog_'):]
   identity=[k for k in keys if k in ('schema','relation','name','arguments','kind','object','extension','publication','child','parent','sequence') and any(isinstance(row,dict) and k in row for row in expected)]
   left={json.dumps([row.get(k) for k in identity],sort_keys=True):row for row in expected};right={json.dumps([row.get(k) for k in identity],sort_keys=True):row for row in actual}
   for key in left.keys()|right.keys():
    a=left.get(key);b=right.get(key)
    if a!=b:
     mismatches+=1
     if a is None or b is None:changed.add('presence')
     else:changed.update(k for k in a.keys()|b.keys() if a.get(k)!=b.get(k))
     if a and b and 'acl' in a and a.get('acl')!=b.get('acl'):
      aa=a['acl'];bb=b['acl'];event('private_acl_difference',family=family,source_grants=len(aa),clone_grants=len(bb),effective_grants_equal=sorted([g[1:] for g in aa])==sorted([g[1:] for g in bb]),grantor_sets_equal={g[0] for g in aa}=={g[0] for g in bb},owner_equal=a.get('owner')==b.get('owner'))
   event('private_catalog_difference',family=family,expected_records=len(expected),actual_records=len(actual),mismatched_records=mismatches,changed_fields=sorted(changed),expected_sha256=digest(expected),actual_sha256=digest(actual))
  # Only a fixed family label is exposed. Never values, names or catalog rows.
  raise Failure('RESTORE_MISMATCH_'+label.upper())

def immutable_source_files():
 files=sorted(MIGRATIONS.glob('*.sql'))
 require(len(files)==16,'SOURCE_FILE_COUNT_CHANGED')
 return [{'file':p.name,'sha256':digest(p.read_bytes())} for p in files]

def native_actor(session):
 actor=session.json("SELECT to_jsonb(q) FROM (SELECT u.id uid,u.email email,s.id session_id,g.tenant_id tenant_id,g.household_id household_id FROM auth.users u JOIN auth.sessions s ON s.user_id=u.id JOIN app.household_access_grants g ON g.auth_user_id=u.id JOIN app.tenant_memberships m ON m.tenant_id=g.tenant_id AND m.auth_user_id=u.id WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp()) AND (s.not_after IS NULL OR s.not_after>statement_timestamp()) AND g.can_view_progress AND g.revoked_at IS NULL AND g.starts_at<=statement_timestamp() AND (g.ends_at IS NULL OR g.ends_at>statement_timestamp()) AND m.status='active' AND m.starts_at<=statement_timestamp() AND (m.ends_at IS NULL OR m.ends_at>statement_timestamp()) ORDER BY s.created_at DESC LIMIT 1) q;")
 require(actor and all(actor.get(k) for k in ['uid','email','session_id','tenant_id','household_id']),'SOURCE_AUTHENTICATED_FIXTURE_MISSING')
 for k in ['uid','session_id','tenant_id','household_id']:require(str(uuid.UUID(actor[k]))==actor[k],'SOURCE_NATIVE_IDENTIFIER_INVALID')
 return actor

def claims_sql(actor):
 claims={'sub':actor['uid'],'email':actor['email'],'session_id':actor['session_id'],'role':'authenticated','aal':'aal1'}
 return "SELECT set_config('request.jwt.claims',"+literal(json.dumps(claims,separators=(',',':')))+",true) IS NOT NULL;"

def readback_query(actor):
 # Human API callers intentionally have no USAGE on internal. The public views
 # and dossier exercise their pre-bound Native guards without broadening access.
 return "SELECT jsonb_build_object('active',EXISTS(SELECT 1 FROM api.my_workspaces),'session_non_superuser',(SELECT NOT rolsuper FROM pg_roles WHERE rolname=session_user),'role_restricted',(SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname=current_user),'owner_restricted',(SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname='cluvo_command_owner'),'dossier',api.get_household_dossier_v2("+literal(actor['tenant_id'])+"::uuid,"+literal(actor['household_id'])+"::uuid,null),'workspaces',(SELECT count(*) FROM api.my_workspaces),'intake',(SELECT count(*) FROM api.my_intake));"

def source_readback(session,actor):
 # Source local HBA uses peer for authenticator. Avoid credentials or HBA writes:
 # a fresh read-only admin backend changes session authorization before any human
 # query. This proves SQL effective session/role, not source LOGIN authentication.
 query="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET TRANSACTION SNAPSHOT "+literal(session.state['snapshot'])+";SET SESSION AUTHORIZATION authenticator;SET LOCAL row_security=on;SET LOCAL ROLE authenticated;"+claims_sql(actor)+readback_query(actor)+"ROLLBACK;"
 output=sql(SOURCE,'supabase_admin',query,True,code='SOURCE_AUTHENTICATOR_READBACK_FAILED')
 data=json.loads(output.splitlines()[-1]);require(data['active'] and data['session_non_superuser'] and data['role_restricted'] and data['owner_restricted'] and data['dossier'],'SOURCE_NATIVE_READBACK_FAILED')
 return data

def command_owner_native_readback(container,actor,session=None):
 query="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"
 if session:query+='SET TRANSACTION SNAPSHOT '+literal(session.state['snapshot'])+';'
 if session:query+='SET SESSION AUTHORIZATION postgres;'
 query+="SET LOCAL row_security=on;SET LOCAL ROLE cluvo_command_owner;"+claims_sql(actor)+"SELECT jsonb_build_object('active',internal.actor_has_active_session(),'session_non_superuser',(SELECT NOT rolsuper FROM pg_roles WHERE rolname=session_user),'effective_restricted',(SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname=current_user));ROLLBACK;"
 output=(sql(container,'supabase_admin',query,True,code='SOURCE_COMMAND_OWNER_NATIVE_FAILED') if session else clone_sql(container,'postgres',query,True,code='CLONE_COMMAND_OWNER_NATIVE_FAILED'))
 result=json.loads(output.splitlines()[-1]);require(all(result.values()),'COMMAND_OWNER_NATIVE_PROOF_FAILED');return result

def clone_readback(clone,actor):
 # Actual LOGIN connection as restored authenticator, followed by its restored
 # membership in authenticated; no restore superuser participates in this call.
 query="BEGIN READ ONLY;SET LOCAL row_security=on; SET LOCAL ROLE authenticated;"+claims_sql(actor)+readback_query(actor)+"ROLLBACK;"
 output=clone_sql(clone,'authenticator',query,True,code='CLONE_NATIVE_READBACK_FAILED')
 data=json.loads(output.splitlines()[-1]);require(data['active'] and data['session_non_superuser'] and data['role_restricted'] and data['owner_restricted'] and data['dossier'],'CLONE_NATIVE_READBACK_DENIED')
 return data

def negative_probes(clone,bootstrap,actor):
 result={}
 missing={**actor,'session_id':str(uuid.uuid4())}
 # Missing session must deny the guarded command and hide the actor workspaces.
 guard="DO $probe$ BEGIN BEGIN PERFORM api.get_household_dossier_v2("+literal(actor['tenant_id'])+"::uuid,"+literal(actor['household_id'])+"::uuid,null);RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROBE_FAILED'; EXCEPTION WHEN insufficient_privilege THEN NULL;END; IF EXISTS(SELECT 1 FROM api.my_workspaces) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROBE_FAILED';END IF; END $probe$;"
 clone_sql(clone,'authenticator','BEGIN READ ONLY;SET LOCAL row_security=on;SET LOCAL ROLE authenticated;'+claims_sql(missing)+guard+'ROLLBACK;',True,code='MISSING_NATIVE_SESSION_NOT_DENIED');result['missing_native_session_denied']=True
 # Altered native records are visible inside a disposable clone transaction.
 # SET SESSION AUTHORIZATION switches both session/current role to the real
 # restricted LOGIN role; only the harness can reset the original superuser.
 other=clone_sql(clone,bootstrap,"SELECT id FROM auth.users WHERE id<>"+literal(actor['uid'])+"::uuid ORDER BY id LIMIT 1;",True)
 require(other and str(uuid.UUID(other))==other,'REPLACEMENT_AUTH_FIXTURE_MISSING')
 for name,mutation in [('deleted_native_session',"DELETE FROM auth.sessions WHERE id="+literal(actor['session_id'])+"::uuid;"),('replaced_native_identity',"UPDATE auth.sessions SET user_id="+literal(other)+"::uuid WHERE id="+literal(actor['session_id'])+"::uuid;")]:
  restricted="SET SESSION AUTHORIZATION authenticator; SET LOCAL ROLE authenticated;"+claims_sql(actor)+guard+"RESET ROLE;RESET SESSION AUTHORIZATION;"
  clone_sql(clone,bootstrap,'BEGIN;'+mutation+restricted+'ROLLBACK;',code=name.upper()+'_NOT_DENIED');result[name+'_denied']=True
 for table in ['intake_assistance_decisions','intake_reconfirmation_receipts']:
  for verb in ['UPDATE','DELETE']:
   statement=('UPDATE app.'+ident(table)+' SET id=id WHERE false;' if verb=='UPDATE' else 'DELETE FROM app.'+ident(table)+' WHERE false;')
   block="DO $probe$ BEGIN BEGIN "+statement+"RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROBE_FAILED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $probe$;"
   clone_sql(clone,'authenticator','BEGIN;SET LOCAL ROLE authenticated;'+claims_sql(actor)+block+'ROLLBACK;',code='IMMUTABLE_HISTORY_NOT_DENIED')
  # The owner has SELECT/INSERT but never UPDATE/DELETE, including RLS bypass.
  for verb in ['UPDATE','DELETE']:
   statement=('UPDATE app.'+ident(table)+' SET id=id WHERE false;' if verb=='UPDATE' else 'DELETE FROM app.'+ident(table)+' WHERE false;')
   block="DO $probe$ BEGIN BEGIN "+statement+"RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROBE_FAILED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $probe$;"
   clone_sql(clone,bootstrap,'BEGIN;SET LOCAL ROLE cluvo_command_owner;'+claims_sql(actor)+block+'ROLLBACK;',code='OWNER_IMMUTABLE_HISTORY_NOT_DENIED')
  require(int(clone_sql(clone,bootstrap,'SELECT count(*) FROM app.'+ident(table)+';',True))>0,'IMMUTABLE_TRIGGER_FIXTURE_EMPTY')
  for verb in ['UPDATE','DELETE']:
   selection='id=(SELECT id FROM app.'+ident(table)+' LIMIT 1)'
   statement=('UPDATE app.'+ident(table)+' SET id=id WHERE '+selection+';' if verb=='UPDATE' else 'DELETE FROM app.'+ident(table)+' WHERE '+selection+';')
   block="DO $probe$ BEGIN BEGIN "+statement+"RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PROBE_FAILED';EXCEPTION WHEN SQLSTATE '55000' THEN NULL;END;END $probe$;"
   clone_sql(clone,bootstrap,'BEGIN;'+block+'ROLLBACK;',code='IMMUTABLE_TRIGGER_NOT_DENIED')
 result['immutable_histories_denied']=True
 # Strict transaction failure must roll back both DDL and migration history.
 suffix=secrets.token_hex(6);table='cluvo_restore_failure_'+suffix;version='19990101'+str(secrets.randbelow(1000000)).zfill(6)
 failed=subprocess.run(clone_sql_args(clone,bootstrap),input=("BEGIN;CREATE TABLE public."+ident(table)+"(id integer);INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ("+literal(version)+",'local_restore_probe',ARRAY['local-only']);SELECT 1/0;COMMIT;").encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV)
 require(failed.returncode!=0 and b'ERROR:' in failed.stderr,'TRANSACTION_FAILURE_NOT_RAISED')
 state=json.loads(clone_sql(clone,bootstrap,"SELECT jsonb_build_object('relation_absent',to_regclass("+literal('public.'+table)+") IS NULL,'history_absent',NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version="+literal(version)+"));",True))
 require(all(state.values()),'FAILED_TRANSACTION_PERSISTED');result['ddl_history_atomic_rollback']=True
 # PostgreSQL itself distinguishes the prohibited shared lock from exclusive.
 state=json.loads(clone_sql(clone,bootstrap,"BEGIN;SELECT pg_advisory_lock_shared("+str(LOCK_NAMESPACE)+","+str(LOCK_OBJECT)+");SELECT jsonb_build_object('shared_only',(SELECT count(*)=1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND classid="+str(LOCK_NAMESPACE)+" AND objid="+str(LOCK_OBJECT)+" AND objsubid=2 AND mode='ShareLock' AND granted),'exclusive_absent',NOT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND classid="+str(LOCK_NAMESPACE)+" AND objid="+str(LOCK_OBJECT)+" AND objsubid=2 AND mode='ExclusiveLock' AND granted));ROLLBACK;",code='LOCK_PROBE_FAILED').splitlines()[-1])
 require(all(state.values()),'SHARED_LOCK_ACCEPTED_AS_EXCLUSIVE');result['shared_lock_distinguished']=True
 return result

def main(profile_only=False):
 validate_local_source();session=SourceSession();clone=None;run_dir=None;report=None
 try:
  profile=session.json(PROFILE)
  require(profile['server_version']==170011 and profile['primary'] and profile['readonly'],'SOURCE_PROFILE_MISMATCH')
  require(profile['migrations']==16 and profile['application_tables']==144 and profile['owner_restricted'],'SOURCE_APPLICATION_BASELINE_MISMATCH')
  require(profile['subscriptions']==0 and profile['foreign_tables']==0,'UNSUPPORTED_EXTERNAL_DATABASE_OBJECTS')
  require(profile['vault_cipher_rows']==0 and profile['storage_objects']==0,'LOCAL_EXTERNAL_KEY_OR_STORAGE_SCOPE_PRESENT')
  event('source_profile',**profile)
  if profile_only:return
  run_dir=ROOT/('run-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+secrets.token_hex(4))
  run_dir.mkdir(mode=0o700,exist_ok=False)
  event('capture_metadata_started')
  baseline=collect_catalog(session.query)
  bootstrap=session.query('SELECT rolname FROM pg_roles WHERE oid=10;')
  require(re.fullmatch(r'[a-z_][a-z0-9_]{0,62}',bootstrap) is not None,'BOOTSTRAP_NAME_PROFILE_UNSUPPORTED')
  data=data_manifest(session.query,baseline);sequences=sequence_manifest(session.query,baseline);objects=largeobjects(session.query)
  actor=native_actor(session);source_api=source_readback(session,actor);source_owner_native=command_owner_native_readback(SOURCE,actor,session)
  files=immutable_source_files();globals_before=globals_state(SOURCE,'supabase_admin')
  manifest={'local_only':True,'driver_sha256':digest(pathlib.Path(__file__).read_bytes()),'catalog':baseline,'data':data,'sequences':sequences,'large_objects':objects,'migration_files':files,'source_snapshot_digest':digest(session.state),'globals_before':globals_before,'authenticated_readback_sha256':digest(source_api)}
  event('capture_metadata_complete',catalog_families=len(baseline),tables=len(data),rows=sum(t['rows'] for t in data),sequences=len(sequences),large_objects=len(objects))
  session.check();snapshot=session.state['snapshot'];require(re.fullmatch(r'[0-9A-F]+-[0-9A-F]+-[0-9]+',snapshot) is not None,'SNAPSHOT_FORMAT_INVALID')
  dump=run_dir/'database.private.dump';globals_file=run_dir/'globals.private.sql'
  capture_file(dump,DOCKER+['exec','-e','PGOPTIONS='+RO,SOURCE,'pg_dump','--no-password','-U','supabase_admin','-d','postgres','--format=custom','--quote-all-identifiers','--large-objects','--lock-wait-timeout=15000ms','--snapshot='+snapshot],'DATABASE_CAPTURE_FAILED')
  capture_file(globals_file,DOCKER+['exec','-e','PGOPTIONS='+RO,SOURCE,'pg_dumpall','--globals-only','--no-role-passwords','--quote-all-identifiers','--no-password','-U','supabase_admin'],'GLOBALS_CAPTURE_FAILED')
  compare('global_capture',globals_before,globals_state(SOURCE,'supabase_admin'))
  compare('sequence_capture',sequences,sequence_manifest(session.query,baseline))
  compare('migration_files',files,immutable_source_files());session.check()
  contents,encryption=bundle_material(run_dir,[dump,globals_file],manifest)
  restored_manifest=json.loads(contents['manifest.private.json']);require(restored_manifest==manifest,'AUTHENTICATED_SOURCE_MANIFEST_CHANGED');restore_catalog=restored_manifest['catalog']
  event('encrypted_backup_roundtrip_complete',dump_bytes=dump.stat().st_size,globals_bytes=globals_file.stat().st_size,**encryption)
  clone='cluvo-restore-local-'+secrets.token_hex(8);startup_clone(clone,bootstrap)
  event('fresh_network_none_clone_ready',local_only=True,background_jobs_disabled=True)
  exception_count=restore_globals(clone,bootstrap,contents[globals_file.name]);event('independent_globals_restored',bootstrap_create_exceptions=exception_count)
  restore_database(clone,bootstrap,contents[dump.name],restore_catalog);schema_acl_replays,replay_plan=restore_extension_schema_acls(clone,bootstrap,restore_catalog);replay_plan['driver_sha256']=restored_manifest['driver_sha256'];replay_plan['source_manifest_sha256']=digest(restored_manifest);private_write(run_dir/'restore-replay.private.json',json.dumps(replay_plan,sort_keys=True,separators=(',',':')).encode());check_jobs(clone,bootstrap);event('database_restored',source_schema_grants_replayed=schema_acl_replays,replay_plan_sha256=digest(replay_plan))
  query=lambda q:clone_sql(clone,bootstrap,"SET search_path TO '';"+q,True)
  restored_catalog=collect_catalog(query)
  for family in baseline:compare('catalog_'+family,baseline[family],restored_catalog[family])
  compare('table_data',data,data_manifest(query,restored_catalog));compare('sequence_values',sequences,sequence_manifest(query,restored_catalog));compare('large_objects',objects,largeobjects(query));event('independent_metadata_data_equal')
  compare('authenticated_api',source_api,clone_readback(clone,actor));compare('command_owner_native',source_owner_native,command_owner_native_readback(clone,actor));event('authenticated_native_dossier_equal')
  negatives=negative_probes(clone,bootstrap,actor)
  post_probe_catalog=collect_catalog(query)
  for family in baseline:compare('post_probe_catalog_'+family,baseline[family],post_probe_catalog[family])
  compare('post_probe_data',data,data_manifest(query,restored_catalog));compare('post_probe_sequences',sequences,sequence_manifest(query,restored_catalog));check_jobs(clone,bootstrap);session.check()
  compare('source_globals_end',globals_before,globals_state(SOURCE,'supabase_admin'));compare('source_sequences_end',sequences,sequence_manifest(session.query,baseline));compare('source_migrations_end',files,immutable_source_files())
  report={'local_only':True,'status':'passed','source_version':170011,'image_digest':IMAGE.split('@')[1],'migrations':16,'application_tables':144,'catalog_families':len(baseline),'physical_tables':len(data),'table_rows':sum(t['rows'] for t in data),'sequences':len(sequences),'large_objects':len(objects),'table_data_sha256':digest(data),'catalog_sha256':digest(baseline),'migration_manifest_sha256':digest(files),'source_snapshot_digest':digest(session.state),'authenticated_dossier_sha256':digest(source_api),'globals_before_after_equal':True,'bootstrap_create_exceptions':exception_count,'source_schema_grants_replayed':schema_acl_replays,'native_authenticated_readback_equal':True,'negative_probes':negatives,'encryption':encryption,'proof_limits':{'role_passwords_restored':False,'provider_root_key_restored':False,'auth_service_http_proved':False,'storage_binaries_present':False,'global_snapshot_exported':False,'sequence_mvcc_snapshot':False,'hosted_target_proved':False,'operational_backup_key_retained':False,'full_provider_restore_claim':False,'all_database_object_classes_claim':False}}
 finally:
  primary_failure=sys.exc_info()[0] is not None
  cleanup_failure=None
  try:
   if clone:
    present=subprocess.run(DOCKER+['inspect','--format','{{.Id}}',clone],stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV,timeout=10)
    if present.returncode==0:docker(['rm','--force','--volumes',clone],code='CLONE_CLEANUP_FAILED')
    else:require(b'No such object:' in present.stderr or b'No such container:' in present.stderr,'CLONE_PRESENCE_CHECK_FAILED')
  except Exception:cleanup_failure=Failure('CLONE_CLEANUP_FAILED')
  finally:
   try:session.close()
   except Exception:cleanup_failure=Failure('SOURCE_CLOSE_FAILED')
  if cleanup_failure:
   if not primary_failure:raise cleanup_failure
   event('cleanup_failed',code=cleanup_failure.code)
 if report:
  private_write(run_dir/'report.json',json.dumps(report,sort_keys=True,indent=2).encode());event('local_restore_proof_complete',**report)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--profile-only',action='store_true');args=parser.parse_args()
 try:main(args.profile_only)
 except Failure as e:event('failed',code=e.code);raise SystemExit(1)
 except Exception:event('failed',code='UNEXPECTED_PRIVATE_FAILURE');raise SystemExit(1)
