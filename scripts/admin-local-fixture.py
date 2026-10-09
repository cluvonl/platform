#!/usr/bin/env python3
"""Build only the explicitly named, disposable admin browser database.

Schema/catalog copy from local Cluvo; identities are synthetic fixtures only.
The existing psql fixture's target guard is adapted in memory to this fixed DB.
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTAINER = 'supabase_db_cluvo-local'
DB = 'cluvo_admin_browser_20261009'


def run(args, payload=None):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, *args],
                            input=payload, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode()[-2000:])
    return result.stdout


def sql(database, payload):
    return run(['psql', '-U', 'supabase_admin', '-d', database, '-X', '-At',
                '-v', 'ON_ERROR_STOP=1'], payload.encode() if isinstance(payload, str) else payload)


assert DB == 'cluvo_admin_browser_20261009' and DB != 'postgres'
schema = run(['pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--schema-only',
              '--no-publications', '--no-subscriptions'])
catalogs = run(['pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--data-only',
                '--table=app.permissions', '--table=app.help_topics',
                '--table=auth.schema_migrations'])
sql('postgres', f'DROP DATABASE IF EXISTS {DB} WITH (FORCE); CREATE DATABASE {DB};')
sql(DB, schema)
sql(DB, catalogs)
new_migrations = sorted((ROOT / 'supabase/migrations').glob('2026100912*.sql'))
for path in new_migrations:
    sql(DB, path.read_bytes())
core = (ROOT / 'supabase/fixtures/core-v1.sql').read_text()
identity_setup = """
update auth.users set email_confirmed_at=statement_timestamp(),
 instance_id='00000000-0000-0000-0000-000000000000',
 raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
 confirmation_token='',recovery_token='',email_change_token_new='',email_change='',
 reauthentication_token='',email_change_token_current='',phone_change_token=''
where email like '%@example.test';
insert into auth.identities(id,user_id,identity_data,provider,provider_id,created_at,updated_at)
select id,id,jsonb_build_object('sub',id,'email',email,'email_verified',true),'email',id::text,
 statement_timestamp(),statement_timestamp()from auth.users where email like '%@example.test';
"""
sql(DB, 'begin;\n' + core + '\n' + identity_setup + '\ncommit;')
source = ROOT / 'supabase/tests/pwa_browser_fixture.psql'
fixture = source.read_text()
guard = "current_database()<>'postgres' or current_user<>'postgres'"
assert fixture.count(guard) == 1
fixture = fixture.replace(guard, f"current_database()<>'{DB}' or current_user<>'supabase_admin'")
sql(DB, '\\set cluvo_native_pwa_fixture 1\n' + fixture)
sql(DB, """
begin;
insert into app.permission_roles(id,tenant_id,role_key,name,system_role)
values('ad000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'admin_browser_explicit','Expliciet lokaal beheerproefmandaat',false);
insert into app.role_permissions(tenant_id,role_id,permission_key)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ad000000-0000-4000-8000-000000000001',permission_key
from app.permissions;
insert into app.access_grants(tenant_id,auth_user_id,role_id,scope_kind,ends_at,granted_by_auth_user_id)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333',
 'ad000000-0000-4000-8000-000000000001','tenant',statement_timestamp()+interval '30 days',
 '33333333-3333-4333-8333-333333333333');
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,
 raw_user_meta_data,created_at,updated_at,instance_id,confirmation_token,recovery_token,
 email_change_token_new,email_change,reauthentication_token,email_change_token_current,phone_change_token)
values('55555555-5555-4555-8555-555555555555','authenticated','authenticated','platform@example.test',
 statement_timestamp(),'{"provider":"email","providers":["email"]}','{}',statement_timestamp(),
 statement_timestamp(),'00000000-0000-0000-0000-000000000000','','','','','','','');
insert into auth.identities(id,user_id,identity_data,provider,provider_id,created_at,updated_at)
values('55555555-5555-4555-8555-555555555555','55555555-5555-4555-8555-555555555555',
 '{"sub":"55555555-5555-4555-8555-555555555555","email":"platform@example.test","email_verified":true}',
 'email','55555555-5555-4555-8555-555555555555',statement_timestamp(),statement_timestamp());
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,
 raw_user_meta_data,created_at,updated_at,instance_id,confirmation_token,recovery_token,
 email_change_token_new,email_change,reauthentication_token,email_change_token_current,phone_change_token)
values('66666666-6666-4666-8666-666666666666','authenticated','authenticated','invitee@example.test',
 statement_timestamp(),'{"provider":"email","providers":["email"]}','{}',statement_timestamp(),
 statement_timestamp(),'00000000-0000-0000-0000-000000000000','','','','','','','');
insert into auth.identities(id,user_id,identity_data,provider,provider_id,created_at,updated_at)
values('66666666-6666-4666-8666-666666666666','66666666-6666-4666-8666-666666666666',
 '{"sub":"66666666-6666-4666-8666-666666666666","email":"invitee@example.test","email_verified":true}',
 'email','66666666-6666-4666-8666-666666666666',statement_timestamp(),statement_timestamp());
insert into app.platform_access_grants(auth_user_id,permission_key,display_name,ends_at,
 granted_by_auth_user_id)
select '55555555-5555-4555-8555-555555555555',permission,'Lokale platformproef',
 statement_timestamp()+interval '30 days','55555555-5555-4555-8555-555555555555'
from unnest(array['platform.overview','platform.tenant.read','platform.tenant.manage',
 'platform.access.manage','platform.config.manage','platform.integration.manage',
 'platform.support','platform.audit.read'])permission;
commit;
""")
print(json.dumps({'database': DB, 'synthetic_accounts': 6, 'synthetic_tenants': 2,
                  'native_migrations_added': len(new_migrations),
                  'original_fixture_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'source_accounts_copied': False, 'database_reset_scope': DB}))
