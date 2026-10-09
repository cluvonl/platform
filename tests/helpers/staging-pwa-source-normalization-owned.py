"""Actual PWA methods on an explicitly owned network-none PG17 fixture only.

Public synthetic catalog/data results stay inside the test process. No hosted
connection, credentials, source setting or DDL/data mutation is performed here.
"""
import json
from pathlib import Path
import sys
import subprocess

sys.path.insert(0, '/restore/pwa-source-normalization')
import staging_backup_session as base
from staging_pwa_upgrade_session import PwaUpgradeSession, LOCK_OBJECT

session = None
stage = 'open_actual_local_libpq'
try:
    session = PwaUpgradeSession.__new__(PwaUpgradeSession)
    session.upgrade_environment, session.source_precision_normalizations = {}, {}
    base.Session.__init__(session, {'PGHOST': '/restore', 'PGUSER': 'postgres', 'PGSSLMODE': 'disable',
                                   'PGDATABASE': 'postgres', 'PGPORT': '5432'},
                          LOCK_OBJECT, local=True, library='/restore/public-python/systemlib/libpq.so.5')
    assert session.transport['scope'] == 'LOCAL_ONLY'
    # This is only an owned synthetic control CONNECTION default, not ALTER
    # ROLE/DATABASE/SYSTEM and never part of a dump/archive subprocess.
    stage = 'source_connection_setting_zero'
    assert session.run('SET extra_float_digits TO 0;') == [{'command': 'SET', 'rows': []}]
    lock_before = session.check_lock()
    defaults = "SELECT jsonb_build_object('float',current_setting('extra_float_digits')::int,'settings',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY to_jsonb(s)::text) FROM pg_db_role_setting s),'[]'::jsonb));"
    before = session.one_json(defaults)
    catalog_sql = Path('/restore/pwa-source-normalization/catalog.sql').read_text()
    data_sql = "SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex'),'float_bits',jsonb_agg(jsonb_build_array(encode(float8send(t.precise_double),'hex'),encode(float4send(t.precise_real),'hex')) ORDER BY id)) FROM public.pwa_lossless_fixture t;"
    def read_json(method, sql):
        result = method(sql)
        assert len(result) == 1 and result[0]['command'] == 'SELECT 1' and len(result[0]['rows']) == 1
        return json.loads(result[0]['rows'][0][0])
    stage = 'first_readonly_snapshot'
    first_snapshot = session.begin_capture()
    first_proof = session.read_deparse_normalization()
    assert session.read_deparse_context()['extra_float_digits'] == 3
    stage = 'first_catalog_and_rows'
    first_catalog = read_json(session.capture_query, catalog_sql)
    first_data = read_json(session.capture_query, data_sql)
    stage = 'actual_export_bound_pg_dump'
    dumped = subprocess.run(['pg_dump', '-h', '/restore', '-U', 'postgres', '-d', 'postgres',
                             '--no-password', '--schema=public', '--format=custom',
                             '--snapshot=' + first_snapshot['exported_snapshot'],
                             '--file=/restore/pwa-source-normalization/fixture.archive'],
                            env={'PATH': '/usr/bin:/bin'}, capture_output=True, timeout=20)
    assert dumped.returncode == 0 and not dumped.stdout and not dumped.stderr
    assert Path('/restore/pwa-source-normalization/fixture.archive').read_bytes()[:5] == b'PGDMP'
    stage = 'first_rollback'
    session.end_capture()
    after_capture = session.one_json(defaults)
    assert after_capture == before and after_capture['float'] == 0
    stage = 'fresh_readonly_snapshot'
    fresh_snapshot = session.begin_fresh_read()
    fresh_proof = session.read_deparse_normalization()
    fresh_catalog = read_json(session.fresh_read_query, catalog_sql)
    fresh_data = read_json(session.fresh_read_query, data_sql)
    stage = 'fresh_rollback'
    session.end_fresh_read()
    after_fresh = session.one_json(defaults)
    assert after_fresh == before and after_fresh['float'] == 0
    assert first_catalog == fresh_catalog and first_data == fresh_data
    lock_after = session.check_lock()
    assert lock_before['backend_pid'] == lock_after['backend_pid'] and lock_before['backend_start'] == lock_after['backend_start']
    assert lock_after['exclusive_lock'] is True
    assert first_snapshot['exported_snapshot'] and first_snapshot['visibility_snapshot'] and fresh_snapshot['visibility_snapshot']
    print(json.dumps({'first_proof': first_proof, 'fresh_proof': fresh_proof,
                      'catalog': first_catalog, 'data': first_data,
                      'rollback_restored_original_zero_twice': True,
                      'same_backend_exclusive_lock_preserved': True,
                      'actual_pg_dump_same_live_exported_snapshot': True,
                      'archive_process_settings_changed': False,
                      'database_and_role_settings_unchanged': before['settings'] == after_fresh['settings']}))
except BaseException as error:
    code = getattr(error, 'code', None)
    if not isinstance(code, str) or len(code) > 100 or not all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_' for c in code):
        code = None
    print(json.dumps({'owned_stage': stage, 'error_kind': type(error).__name__, 'safe_code': code}), file=sys.stderr)
    sys.exit(1)
finally:
    if session is not None:
        session.close()
