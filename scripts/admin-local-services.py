#!/usr/bin/env python3
"""Native local HTTP services for the named, disposable admin proof database.

Reuse installed Cluvo image versions and signing configuration in memory.
Never copy source Auth or club rows and never accept a remote database URL.
"""
import json
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parent.parent
DB = 'cluvo_admin_browser_20261009'
NETWORK = 'supabase_network_cluvo-local'
PREFIX = 'cluvo_admin_owned_'
PRIVATE = Path('/tmp/cluvo-admin-local-services')
PRIVATE.mkdir(mode=0o700, exist_ok=True)
os.chmod(PRIVATE, 0o700)


def docker(*args, payload=None):
    result = subprocess.run(['docker', *args], input=payload, capture_output=True)
    if result.returncode:
        # Docker diagnostics may contain configuration; do not print them.
        raise RuntimeError('The fixed local admin service operation failed.')
    return result.stdout


def inspect(name):
    return json.loads(docker('inspect', name))[0]


def environment(container):
    return dict(item.split('=', 1) for item in container['Config']['Env'])


def owned_url(value):
    parsed = urlsplit(value)
    assert parsed.hostname == 'supabase_db_cluvo-local'
    return urlunsplit(parsed._replace(path='/' + DB))


def launch(name, source, env, port, target, mounts=()):
    assert name.startswith(PREFIX) and NETWORK in source['NetworkSettings']['Networks']
    existing = subprocess.run(['docker', 'inspect', name], capture_output=True)
    if existing.returncode == 0:
        prior = json.loads(existing.stdout)[0]
        assert prior['Config']['Labels'].get('cluvo.admin.proof') in (DB, 'cluvo_admin_owned_20261009')
        docker('rm', '-f', name)
    with tempfile.NamedTemporaryFile(dir=PRIVATE, mode='w', delete=False) as handle:
        os.chmod(handle.name, 0o600)
        for key, value in env.items():
            assert '\n' not in value and '\r' not in value
            handle.write(key + '=' + value + '\n')
        env_path = handle.name
    try:
        docker('run', '-d', '--name', name, '--label', 'cluvo.admin.proof=' + DB,
               '--network', NETWORK, '--env-file', env_path,
               '-p', f'127.0.0.1:{port}:{target}', *mounts, source['Config']['Image'])
    finally:
        os.unlink(env_path)


auth = inspect('supabase_auth_cluvo-local')
rest = inspect('supabase_rest_cluvo-local')
kong = inspect('supabase_kong_cluvo-local')
mail = inspect('supabase_inbucket_cluvo-local')
auth_env = environment(auth)
rest_env = environment(rest)
kong_env = environment(kong)
kong_env.pop('KONG_SSL_CERT', None)
kong_env.pop('KONG_SSL_CERT_KEY', None)
kong_env['KONG_PROXY_LISTEN'] = '0.0.0.0:8000'
kong_env['KONG_ADMIN_LISTEN'] = 'off'
auth_env['GOTRUE_DB_DATABASE_URL'] = owned_url(auth_env['GOTRUE_DB_DATABASE_URL'])
rest_env['PGRST_DB_URI'] = owned_url(rest_env['PGRST_DB_URI'])
auth_env.update({'API_EXTERNAL_URL': 'http://127.0.0.1:62321',
                 'GOTRUE_SITE_URL': 'http://127.0.0.1:3400',
                 'GOTRUE_URI_ALLOW_LIST': 'http://127.0.0.1:3400/**',
                 'GOTRUE_JWT_ISSUER': 'http://127.0.0.1:62321/auth/v1',
                 'GOTRUE_SMTP_HOST': PREFIX + 'mail',
                 'GOTRUE_SMTP_MAX_FREQUENCY': '1s'})
config_path = kong_env['KONG_DECLARATIVE_CONFIG']
config = docker('exec', 'supabase_kong_cluvo-local', 'cat', config_path).decode()
config = config.replace('supabase_auth_cluvo-local', PREFIX + 'auth')
config = config.replace('supabase_rest_cluvo-local', PREFIX + 'rest')
private_config = PRIVATE / 'gateway.yml'
private_config.touch(mode=0o600, exist_ok=True)
os.chmod(private_config, 0o600)
private_config.write_text(config)
# The gateway needs to read a mode-0600 bind mount owned by this harness.
# Its isolated local container runs as root; no privileged host options.

launch(PREFIX + 'mail', mail, environment(mail), 62324, 8025)
launch(PREFIX + 'rest', rest, rest_env, 62322, 3000)
launch(PREFIX + 'auth', auth, auth_env, 62323, 9999)
launch(PREFIX + 'gateway', kong, kong_env, 62321, 8000,
       ('--user', '0:0', '--mount', f'type=bind,source={private_config},target={config_path},readonly'))
print(json.dumps({'database': DB, 'http': 'http://127.0.0.1:62321',
                  'mail_capture': 'http://127.0.0.1:62324',
                  'source_accounts_copied': False, 'remote_resources_created': False}))
