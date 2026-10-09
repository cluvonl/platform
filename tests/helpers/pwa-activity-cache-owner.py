"""Owned network-isolated test transport for the actual private owner method."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import staging_pwa_native_qa_session as native

recipe_path, socket_path = Path(sys.argv[1]), Path(sys.argv[2])
assert recipe_path.parent.name.startswith('cluvo-pwa-activity-cache-')
assert recipe_path.name == 'recipe.json' and socket_path == recipe_path.parent / 'socket'
assert (recipe_path.parent / 'empty-passfile').stat().st_size == 0
recipe = json.loads(recipe_path.read_text())
owner = native.NativeSession.__new__(native.NativeSession)
# Only the test dial target differs: a newly owned container's network-isolated
# Unix socket. The production monitoring/identity/holder methods run unchanged.
connection_settings = native.Session.connection_settings
try:
    native.Session.connection_settings = staticmethod(lambda environment, local: {
        'host': str(socket_path), 'port': '5432', 'user': 'postgres', 'dbname': 'postgres',
        'sslmode': 'disable', 'connect_timeout': '12', 'application_name': 'cluvo-owned-activity-test',
        'options': '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=15000 -c row_security=off -c client_encoding=UTF8 -c search_path=pg_catalog',
        'passfile': str(recipe_path.parent / 'empty-passfile'), 'target_session_attrs': 'any'})
    native.Session.__init__(owner, {}, native.LOCK, local=True)
finally:
    native.Session.connection_settings = staticmethod(connection_settings)
owner.phase, owner.booking = 'booking', recipe


def emit(value):
    print(json.dumps(value), flush=True)


try:
    owner.hold_last_position()
    emit({'holder_ready': True})
    for line in sys.stdin:
        operation = line.strip()
        if operation == 'cached_probe':
            # Exact pre-fix behavior: identity check first accesses activity,
            # but no monitoring-snapshot refresh inside the holder transaction.
            owner.check_lock()
            emit(owner.one_json(recipe['blockingSql']))
        elif operation == 'fresh_probe':
            emit(owner.count_blocked())
        elif operation == 'status':
            guard = owner.check_lock()
            emit({'same_backend': guard['backend_pid'] == owner.identity['backend_pid']
                  and guard['backend_start'] == owner.identity['backend_start'],
                  'exclusive_lock_retained': guard['exclusive_lock'] is True,
                  'holder_transaction_alive': owner.pq.PQtransactionStatus(owner.connection) == native.TX_VALID})
        elif operation == 'release':
            emit(owner.release_holder())
        elif operation == 'close':
            break
        else:
            raise RuntimeError('OWNED_ACTIVITY_TEST_OPERATION_INVALID')
finally:
    owner.close()
