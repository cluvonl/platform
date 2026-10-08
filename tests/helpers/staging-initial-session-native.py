"""Optional native LOCAL_ONLY transport smoke; no DDL or data mutations.

The sole connection target is the disposable cluvo-local Supabase CLI fixture
from supabase/config.toml. The connection-settings injection exists only in
this test harness and cannot be selected by a production child/protocol call.
"""
import importlib.util
import json
from pathlib import Path
import sys
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'scripts/staging_initial_session.py'
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('initial_native_local_test', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def main():
    session = None
    try:
        module.verify_sources()
        config = (source.parent.parent / 'supabase/config.toml').read_text()
        assert 'project_id = "cluvo-local"' in config and 'port = 55322' in config
        def settings(unused_environment, local):
            assert local is True
            # Public Supabase CLI disposable-fixture default, never an env key.
            return {'host':'127.0.0.1','port':'55322','user':'postgres','dbname':'postgres',
                    'password':'postgres','sslmode':'disable','connect_timeout':'5',
                    'application_name':'cluvo-local-native-writer-test','passfile':'/dev/null',
                    'options':'-c default_transaction_read_only=on -c search_path=pg_catalog -c statement_timeout=15000'}
        session = module.InitialSession.__new__(module.InitialSession)
        session.initial_environment, session.initial_next = {}, None
        with patch.object(module.InitialSession, 'connection_settings', staticmethod(settings)):
            module.Session.__init__(session, {}, module.LOCK_OBJECT, local=True)
        assert session.transport['scope'] == 'LOCAL_ONLY'
        before = session.check_lock()
        session.begin_capture()
        captured = session.capture_query('SELECT 1 AS synthetic_read;')
        assert captured == [{'command':'SELECT 1','rows':[['1']]}]
        session.end_capture()
        session.begin_fresh_read()
        session.fresh_read_query('SELECT 1 AS synthetic_read;')
        session.end_fresh_read()

        previous = module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT
        try:
            module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT = module.INITIAL_COMMANDS, module.INITIAL_TIMEOUT
            results = session.run('SELECT 1;' * 334)
            assert len(results) == 334 and all(value == {'command':'SELECT 1','rows':[['1']]} for value in results)
        finally:
            module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT = previous

        session.run('BEGIN READ ONLY;')
        parameters = ['synthetic-param4@example.test', 'a'*40, '123', 'contract-test']
        fixed_context = "SELECT set_config('cluvo.synthetic_param4',jsonb_build_array($1::text,$2::text,$3::text,$4::text)::text,true) IS NOT NULL;"
        assert session.run_params(fixed_context, parameters) == [{'command':'SELECT 1','rows':[['t']]}]
        readback = session.run("SELECT current_setting('cluvo.synthetic_param4')", single=True)
        assert json.loads(readback[0]['rows'][0][0]) == parameters
        assert session.pq.PQtransactionStatus(session.connection) == module.bounded.TX_VALID
        session.run('ROLLBACK;')
        after = session.check_lock()
        assert before['backend_pid'] == after['backend_pid'] and before['backend_start'] == after['backend_start']
        assert after['exclusive_lock'] is True
        assert (module.bounded.MAX_COMMANDS, module.bounded.TIMEOUT) == previous
        print('LOCAL_ONLY_NATIVE_TRANSPORT_PASS: capture/fresh, 334 bounded commandresults, bound param4, same backend/lock; no DDL/data mutations')
        return 0
    except BaseException:
        # Native connection/provider diagnostics remain private even for tests.
        print('LOCAL_ONLY_NATIVE_TRANSPORT_UNPROVED', file=sys.stderr)
        return 1
    finally:
        if session is not None:
            session.close()


if __name__ == '__main__':
    sys.exit(main())
