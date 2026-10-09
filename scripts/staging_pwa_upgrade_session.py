#!/usr/bin/env python3
"""Fixed additive owner; unchanged bounded transport, no caller-supplied writer SQL."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import staging_backup_session as bounded
from staging_backup_session import Failure, Session, require, MAX_INPUT, MAX_RESULT, TX_IDLE

ROOT = Path(__file__).resolve().parent
PROJECT = 'fbozlbgmktkgcdfqdaaz'
LOCK_OBJECT = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
# Regenerated from reviewed owner source before release, never from secrets.
PINS = {'staging_backup_session.py': 'e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1', 'staging-pwa-upgrade-sql.mjs': '0337f2134a3c57128719a26287d4395ade94471ad4e8939ee70d7fc51166d242', 'staging-pwa-upgrade-migrations.mjs': '289792c7990eb3657c1cd59db8bd9acd1f89e190fca70ef30c9f13770f2ab8e7', 'staging-pwa-upgrade-files.mjs': 'a41f1da30fe1c1a0296aa5f1dfe229f177a208950a681bd06be53c2da90b61f5', 'staging-initial-migrations.mjs': '7f49cf8dcdb2eda53633dd3596486779ea2dd001d1a2813a07fa45e859784004', 'staging-migration-files.mjs': '83aa2aae6d4cc358965208e39e73dd0d1038ee4a6c0bc9a62675b829e30c94bd'}
READ_OPERATIONS = {'begin_capture', 'capture_query', 'check_lock', 'end_capture',
                   'begin_fresh_read', 'fresh_read_query', 'end_fresh_read'}
DEPARSE_CONTEXT_SQL = "SELECT jsonb_build_object('server_version_num',current_setting('server_version_num')::int,'time_zone',current_setting('TimeZone'),'date_style',current_setting('DateStyle'),'interval_style',current_setting('IntervalStyle'),'search_path',current_setting('search_path'),'extra_float_digits',current_setting('extra_float_digits')::int,'standard_conforming_strings',current_setting('standard_conforming_strings')='on','quote_all_identifiers',current_setting('quote_all_identifiers')='on','bytea_output',current_setting('bytea_output'),'client_encoding',current_setting('client_encoding'));"


def verify_sources():
    require(len(PINS) == 6, 'PWA_UPGRADE_SOURCE_PINS_REQUIRED')
    for name, expected in PINS.items():
        path = ROOT / name
        require(path.is_file() and not path.is_symlink() and path.stat().st_size <= 100000
                and hashlib.sha256(path.read_bytes()).hexdigest() == expected,
                'PWA_UPGRADE_SOURCE_CHANGED')


def trusted_context(environment):
    require(environment.get('APP_ENV') == 'staging' and environment.get('GITHUB_REPOSITORY') == 'cluvonl/platform'
            and environment.get('GITHUB_REF') == 'refs/heads/staging'
            and environment.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
            and environment.get('GITHUB_SHA') == environment.get('RELEASE_SHA')
            and re.fullmatch(r'[0-9a-f]{40}', environment.get('RELEASE_SHA', ''))
            and re.fullmatch(r'[1-9][0-9]{0,19}', environment.get('GITHUB_RUN_ID', ''))
            and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.\[\]-]{0,63}', environment.get('GITHUB_ACTOR', '')),
            'PWA_UPGRADE_WORKFLOW_CONTEXT_REQUIRED')


def fixed_sql(argument, identity, environment):
    fields = {'index', 'actor', 'workflow_run_id', 'source_sha', 'manifest_sha256',
              'backup_artifact_id', 'backup_artifact_sha256'}
    require(type(argument) is dict and set(argument) == fields and type(argument['index']) is int
            and 16 <= argument['index'] < 64 and argument['actor'] == environment.get('GITHUB_ACTOR')
            and argument['workflow_run_id'] == environment.get('GITHUB_RUN_ID')
            and argument['source_sha'] == environment.get('RELEASE_SHA')
            and re.fullmatch(r'[0-9a-f]{64}', argument['manifest_sha256'])
            and re.fullmatch(r'[1-9][0-9]{0,19}', argument['backup_artifact_id'])
            and re.fullmatch(r'[0-9a-f]{64}', argument['backup_artifact_sha256']), 'PWA_UPGRADE_ARGUMENT_INVALID')
    verify_sources()
    node = environment.get('PWA_UPGRADE_NODE_EXECUTABLE', '')
    require(os.path.isabs(node) and Path(node).name == 'node' and len(node) <= 4096,
            'PWA_UPGRADE_GENERATOR_UNAVAILABLE')
    info = os.lstat(node)
    require(stat.S_ISREG(info.st_mode) and os.access(node, os.X_OK), 'PWA_UPGRADE_GENERATOR_UNAVAILABLE')
    request = {'index': argument['index'], 'actor': argument['actor'], 'sourceSha': argument['source_sha'],
               'workflowRunId': argument['workflow_run_id'], 'manifestSha256': argument['manifest_sha256'],
               'backupArtifactId': argument['backup_artifact_id'], 'backupArtifactSha256': argument['backup_artifact_sha256'],
               'expectedBackendPid': identity['backend_pid'], 'expectedBackendStart': identity['backend_start']}
    result = subprocess.run([node, str(ROOT / 'staging-pwa-upgrade-sql.mjs'), '--private-fixed-pwa-upgrade-sql'],
                            input=json.dumps(request).encode(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            env={'PATH': '/usr/bin:/bin'}, timeout=15, check=False)
    require(result.returncode == 0 and not result.stderr and 0 < len(result.stdout) < 1000000,
            'PWA_UPGRADE_GENERATOR_FAILED')
    try:
        return result.stdout.decode('utf-8', 'strict')
    except UnicodeError:
        raise Failure('PWA_UPGRADE_GENERATOR_FAILED') from None


class PwaUpgradeSession(Session):
    def __init__(self, environment, lock):
        self.upgrade_environment = dict(environment)
        self.source_precision_normalizations = {}
        super().__init__(environment, lock)

    def _raw_deparse_context(self):
        # The existing snapshot and same-backend project lock remain authority.
        # No caller SQL or setting name enters this fixed READ ONLY operation.
        require(self.state in ('capture', 'fresh_read') and self.pq.PQtransactionStatus(self.connection) == bounded.TX_VALID,
                'PWA_DEPARSE_CONTEXT_PHASE_INVALID')
        before = self.check_lock()
        require(before.get('read_only') is True and before.get('isolation') == 'repeatable read',
                'PWA_DEPARSE_CONTEXT_PHASE_INVALID')
        value = self.one_json(DEPARSE_CONTEXT_SQL)
        after = self.check_lock()
        require(self.pq.PQtransactionStatus(self.connection) == bounded.TX_VALID
                and after.get('read_only') is True and after.get('isolation') == 'repeatable read'
                and before['backend_pid'] == after['backend_pid']
                and before['backend_start'] == after['backend_start'], 'PWA_DEPARSE_CONTEXT_SESSION_CHANGED')
        fields = {'server_version_num', 'time_zone', 'date_style', 'interval_style', 'search_path',
                  'extra_float_digits', 'standard_conforming_strings', 'quote_all_identifiers',
                  'bytea_output', 'client_encoding'}
        require(type(value) is dict and set(value) == fields
                and type(value['server_version_num']) is int and 100000 <= value['server_version_num'] <= 999999
                and type(value['extra_float_digits']) is int and -15 <= value['extra_float_digits'] <= 3
                and type(value['standard_conforming_strings']) is bool and type(value['quote_all_identifiers']) is bool
                and value['bytea_output'] in ('hex', 'escape')
                and all(type(value[field]) is str and len(value[field].encode()) <= 1024
                        and not re.search(r'[\r\n\x00]', value[field])
                        for field in ('time_zone', 'date_style', 'interval_style', 'search_path', 'client_encoding')),
                'PWA_DEPARSE_CONTEXT_UNKNOWN')
        return value

    def _normalize_source_precision(self):
        # Only this PWA-owned, real READ ONLY/RR control transaction changes.
        # The frozen base transport, database/role defaults, archive workers,
        # catalog query bytes and exact comparisons remain unchanged.
        original = self._raw_deparse_context()
        result = self.run('SET LOCAL extra_float_digits TO 3;')
        require(type(result) is list and len(result) == 1 and result[0] == {'command': 'SET', 'rows': []},
                'PWA_SOURCE_PRECISION_SET_UNPROVED')
        effective = self._raw_deparse_context()
        require(effective == {**original, 'extra_float_digits': 3}, 'PWA_SOURCE_PRECISION_CONTEXT_CHANGED')
        self.source_precision_normalizations[self.state] = {
            'format': 'PWA_SOURCE_DEPARSE_NORMALIZATION_V1', 'used': True,
            'scope': 'SOURCE_READ_ONLY_CONTROL_SESSION_ONLY', 'phase': self.state,
            'original_context': original, 'effective_context': effective,
            'fixed_extra_float_digits': 3, 'transaction_local': True,
            'source_read_only_control_session_setting_changed': original['extra_float_digits'] != 3,
            'same_backend_verified': True, 'same_snapshot_verified': True,
            'read_only': True, 'isolation': 'repeatable read',
            'source_global_or_database_settings_changed': False,
            'provider_archive_process_settings_changed': False, 'source_database_mutated': False,
            'row_or_catalog_values_rewritten': False,
        }

    def begin_capture(self):
        snapshot = super().begin_capture()
        self._normalize_source_precision()
        return snapshot

    def begin_fresh_read(self):
        snapshot = super().begin_fresh_read()
        self._normalize_source_precision()
        return snapshot

    def read_deparse_normalization(self):
        current = self._raw_deparse_context()
        proof = self.source_precision_normalizations.get(self.state)
        require(type(proof) is dict and current == proof['effective_context']
                and current['extra_float_digits'] == 3, 'PWA_SOURCE_PRECISION_UNPROVED')
        return json.loads(json.dumps(proof))

    def read_deparse_context(self):
        require(self.state == 'capture', 'PWA_DEPARSE_CONTEXT_PHASE_INVALID')
        return self.read_deparse_normalization()['effective_context']

    def read_upgrade_state(self):
        require(self.state in ('fresh_read_complete', 'initial_ready')
                and self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'PWA_UPGRADE_PHASE_INVALID')
        self.check_lock()
        layout = self.one_json("SELECT jsonb_build_object('schemas',(SELECT coalesce(jsonb_agg(nspname ORDER BY nspname),'[]'::jsonb) FROM pg_namespace WHERE nspname IN ('app','api','internal')),'app_objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('app','api','internal')),'history_present',to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,'source_history_present',to_regclass('supabase_migrations.cluvo_migration_source') IS NOT NULL,'upgrade_history_present',to_regclass('supabase_migrations.cluvo_pwa_upgrade_source') IS NOT NULL)")
        def rows(sql):
            result = self.run(sql, single=True)
            require(len(result) == 1 and len(result[0]['rows']) == 1 and len(result[0]['rows'][0]) == 1, 'PWA_UPGRADE_READBACK_UNVERIFIED')
            try:
                value = json.loads(result[0]['rows'][0][0])
            except (ValueError, TypeError):
                raise Failure('PWA_UPGRADE_READBACK_UNVERIFIED') from None
            require(type(value) is list and len(value) <= 64, 'PWA_UPGRADE_READBACK_UNVERIFIED')
            return value
        history = rows("SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statement_count',cardinality(statements),'single_statement_sha256',CASE WHEN cardinality(statements)=1 THEN encode(sha256(convert_to(statements[1],'UTF8')),'hex') ELSE NULL END) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.schema_migrations") if layout['history_present'] else []
        source = rows("SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'file',file,'sha256',sha256,'source_sha',source_sha,'actor',actor,'scope',scope,'expected_version',expected_version,'idempotency_key',idempotency_key,'workflow_run_id',workflow_run_id) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.cluvo_migration_source") if layout['source_history_present'] else []
        upgrades = rows("SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'file',file,'sha256',sha256,'source_sha',source_sha,'actor',actor,'scope',scope,'expected_version',expected_version,'idempotency_key',idempotency_key,'workflow_run_id',workflow_run_id,'manifest_sha256',manifest_sha256,'backup_artifact_id',backup_artifact_id,'backup_artifact_sha256',backup_artifact_sha256) ORDER BY version),'[]'::jsonb) FROM supabase_migrations.cluvo_pwa_upgrade_source") if layout['upgrade_history_present'] else []
        guards = self.one_json("SELECT jsonb_build_object('app_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r'),'forced_rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity),'native_policies',(SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND p.polname='native_session_required'),'api_only_exposed',EXISTS(SELECT 1 FROM pg_db_role_setting s JOIN pg_roles r ON r.oid=s.setrole WHERE r.rolname='authenticator' AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres') AND 'pgrst.db_schemas=api'=ANY(s.setconfig)),'command_owner_restricted',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cluvo_command_owner' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcanlogin))")
        self.check_lock()
        self.state = 'initial_ready'
        return {'layout': layout, 'historyRows': history, 'sourceRows': source, 'upgradeRows': upgrades, 'guards': guards}

    def apply_upgrade(self, argument):
        require(self.state == 'initial_ready' and self.pq.PQtransactionStatus(self.connection) == TX_IDLE,
                'PWA_UPGRADE_PHASE_INVALID')
        before = self.check_lock()
        sql = fixed_sql(argument, self.identity, self.upgrade_environment)
        self.check_lock()
        previous_commands, previous_timeout = bounded.MAX_COMMANDS, bounded.TIMEOUT
        try:
            bounded.MAX_COMMANDS, bounded.TIMEOUT = 1024, 240.0
            results = self.run(sql)
        finally:
            bounded.MAX_COMMANDS, bounded.TIMEOUT = previous_commands, previous_timeout
        require(results and results[0]['command'] == 'BEGIN' and results[-1]['command'] == 'COMMIT'
                and self.pq.PQtransactionStatus(self.connection) == TX_IDLE, 'PWA_UPGRADE_COMMIT_UNPROVED')
        after = self.check_lock()
        require(before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start'],
                'PWA_UPGRADE_SESSION_CHANGED')
        return {'applied_prefix': argument['index'] + 1, 'atomic_transaction_committed': True,
                'exclusive_session_lock_retained': True}


def duplicate_free(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('duplicate')
        result[key] = value
    return result


def main():
    session, sequence = None, 1
    try:
        require(len(sys.argv) == 1, 'PWA_UPGRADE_CONTEXT_REQUIRED')
        trusted_context(os.environ)
        verify_sources()
        while True:
            raw = sys.stdin.buffer.readline(MAX_INPUT + 1)
            if not raw:
                break
            require(len(raw) <= MAX_INPUT and raw.endswith(b'\n'), 'PWA_UPGRADE_REQUEST_BOUND_EXCEEDED')
            request = json.loads(raw.decode('utf-8', 'strict'), object_pairs_hook=duplicate_free)
            require(type(request) is dict and set(request) == {'id', 'operation', 'argument'}
                    and type(request['id']) is int and request['id'] == sequence, 'PWA_UPGRADE_REQUEST_INVALID')
            sequence += 1
            operation, argument = request['operation'], request['argument']
            try:
                if operation == 'connect':
                    require(session is None and sequence == 2 and argument == {'lock_object': LOCK_OBJECT}, 'PWA_UPGRADE_CONNECT_INVALID')
                    session = PwaUpgradeSession(dict(os.environ), LOCK_OBJECT)
                    value = session.transport
                elif operation == 'close':
                    require(argument is None and session is not None, 'PWA_UPGRADE_OPERATION_INVALID')
                    session.close()
                    value = {'closed': True}
                elif operation == 'read_upgrade_state':
                    require(argument is None and session is not None, 'PWA_UPGRADE_OPERATION_INVALID')
                    value = session.read_upgrade_state()
                elif operation == 'read_deparse_context':
                    require(argument is None and session is not None, 'PWA_UPGRADE_OPERATION_INVALID')
                    value = session.read_deparse_context()
                elif operation == 'read_deparse_normalization':
                    require(argument is None and session is not None, 'PWA_UPGRADE_OPERATION_INVALID')
                    value = session.read_deparse_normalization()
                elif operation == 'apply_upgrade':
                    require(session is not None, 'PWA_UPGRADE_OPERATION_INVALID')
                    value = session.apply_upgrade(argument)
                else:
                    require(operation in READ_OPERATIONS and session is not None, 'PWA_UPGRADE_OPERATION_INVALID')
                    if operation in ('capture_query', 'fresh_read_query'):
                        require(type(argument) is str, 'PWA_UPGRADE_QUERY_INVALID')
                        value = getattr(session, operation)(argument)
                    else:
                        require(argument is None, 'PWA_UPGRADE_OPERATION_INVALID')
                        value = getattr(session, operation)()
                response = {'id': request['id'], 'ok': True, 'value': value}
            except Failure as error:
                response = {'id': request['id'], 'ok': False, 'code': error.code, 'sqlstate': error.sqlstate}
            encoded = (json.dumps(response, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
            require(len(encoded) <= MAX_RESULT, 'PWA_UPGRADE_RESPONSE_BOUND_EXCEEDED')
            sys.stdout.buffer.write(encoded)
            sys.stdout.buffer.flush()
            if operation == 'close' or not response['ok']:
                break
        return 0
    except BaseException:
        return 1
    finally:
        if session is not None:
            session.close()


if __name__ == '__main__':
    sys.exit(main())
