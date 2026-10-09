#!/usr/bin/env python3
"""Run admin upgrade proofs in our named, disposable schema-only database.

The source database is read-only. No Auth/club rows are copied from it.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTAINER = 'supabase_db_cluvo-local'
OWNED = 'cluvo_admin_owned_20261009'


def run(args, payload=None):
    result = subprocess.run(['docker', 'exec', '-i', CONTAINER, *args], input=payload,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Only schema DDL and synthetic transactional fixtures enter this tool.
        raise RuntimeError(result.stderr.decode()[-3000:])
    return result.stdout


def sql(database, payload):
    return run(['psql', '-U', 'supabase_admin', '-d', database, '-X', '-At',
                '-v', 'ON_ERROR_STOP=1'], payload.encode() if isinstance(payload, str) else payload)


if '--rebuild' in sys.argv:
    assert OWNED == 'cluvo_admin_owned_20261009' and OWNED != 'postgres'
    # Schema only; keep catalog entries but no account, dossier or live rows.
    schema = run(['pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--schema-only', '--no-publications', '--no-subscriptions'])
    catalogs = run(['pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '--data-only',
                    '--table=app.permissions', '--table=app.help_topics', '--table=auth.schema_migrations'])
    sql('postgres', f'DROP DATABASE IF EXISTS {OWNED} WITH (FORCE); CREATE DATABASE {OWNED};')
    sql(OWNED, schema)
    sql(OWNED, catalogs)
    sql(OWNED, 'CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;')
    for migration in ['20261009120000_platform_administration.sql', '20261009121000_club_administration.sql', '20261009122000_administration_authority_fence.sql', '20261009123000_admin_template_delivery.sql', '20261009124000_admin_durable_commands.sql']:
        sql(OWNED, (ROOT / 'supabase/migrations' / migration).read_bytes())
    print(json.dumps({'owned_upgrade': 'PASS', 'account_or_club_rows_copied': False, 'catalog_tables_copied': 3, 'migrations_added': 5}))

paths = sys.argv[1:]
paths = [p for p in paths if not p.startswith('--')]
if not paths:
    paths = [str(p.relative_to(ROOT)) for p in sorted((ROOT / 'supabase/tests').glob('admin*.sql'))]
for name in paths:
    path = (ROOT / name).resolve()
    assert path.is_relative_to(ROOT / 'supabase/tests')
    output = sql(OWNED, path.read_bytes()).decode()
    lines = [line for line in output.splitlines() if re.match(r'^(ok |not ok |1\.\.|#)', line)]
    print('\n'.join(lines))
    if re.search(r'^not ok ', output, re.M):
        raise SystemExit(1)
