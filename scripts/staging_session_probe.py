"""Fixed read-only transport measurement; stdout contains safe evidence only."""
import hashlib
import json
import os
import re
import sys

from staging_backup_session import Failure, PROJECT, Session, require

LOCK_OBJECT = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
CHECKS = (
    'verified_client_tls',
    'sql_backend_identity_and_exclusive_lock',
    'second_same_key_session_refused',
    'original_session_survives_competitor',
    'exported_repeatable_read_snapshot',
    'single_statement_capture_read',
    'capture_rollback_retains_session_lock',
    'fresh_read_same_backend',
    'single_statement_fresh_read',
    'fresh_rollback_retains_session_lock',
    'close_releases_session_lock',
    'multiple_statements_rejected',
    'zero_row_write_cte_rejected_read_only',
    'final_lock_reacquisition',
)
NEGATIVE_QUERIES = (
    ('SELECT 1; SELECT 2;', '42601', CHECKS[11]),
    ('WITH attempted AS (DELETE FROM pg_catalog.pg_database WHERE false RETURNING oid) '
     'SELECT count(*) FROM attempted;', '25006', CHECKS[12]),
)
READ = "SELECT current_setting('transaction_read_only')='on';"
ERROR_CODES = frozenset((
    'DATABASE_CONNECT_FAILED', 'DATABASE_TIMEOUT', 'DATABASE_DISCONNECTED',
    'DATABASE_VERSION_MISMATCH', 'DATABASE_CLIENT_TLS_UNVERIFIED',
    'BACKEND_IDENTITY_UNVERIFIED', 'EXCLUSIVE_SESSION_LOCK_BUSY',
    'BACKEND_SQL_PID_UNVERIFIED', 'BACKEND_PROTOCOL_PID_UNVERIFIED',
    'BACKEND_DATABASE_UNVERIFIED', 'BACKEND_PRIMARY_UNVERIFIED',
    'BACKEND_START_UNVERIFIED', 'BACKEND_PID_MISMATCH',
    'SESSION_OR_EXCLUSIVE_LOCK_CHANGED', 'SNAPSHOT_VISIBILITY_CHANGED',
    'SESSION_LOCK_ALREADY_HELD',
    'DATABASE_QUERY_FAILED', 'DATABASE_UNEXPECTED_WARNING',
    'PROBE_TLS_UNVERIFIED', 'PROBE_COMPETITOR_ACCEPTED',
    'PROBE_COMPETITOR_FAILURE_UNKNOWN', 'PROBE_SNAPSHOT_UNVERIFIED',
    'PROBE_READ_UNVERIFIED', 'PROBE_TRANSITION_UNVERIFIED',
    'PROBE_BACKEND_CHANGED', 'PROBE_NEGATIVE_QUERY_ACCEPTED',
    'PROBE_NEGATIVE_FAILURE_UNKNOWN', 'PROBE_CONNECTION_CLOSE_UNPROVED',
))


def measure(environment, session_factory=Session):
    report = {'passed': False, 'scope': 'HOSTED_TRANSPORT_ONLY', 'checks': [],
              'transport': None, 'returned_sessions_closed': False,
              'backup_created': False, 'restore_executed': False,
              'snapshot_import_verified': False, 'catalog_data_compared': False,
              'migration_ready': False, 'remote_ddl_ready': False,
              'v1_ready': False, 'production_enabled': False}
    sessions = []

    def connect():
        session = session_factory(environment, LOCK_OBJECT)
        sessions.append(session)
        return session

    def closed(session):
        session.close()
        require(session.connection is None and session.state == 'closed',
                'PROBE_CONNECTION_CLOSE_UNPROVED')

    def read_result(value):
        require(value == [{'command': 'SELECT 1', 'rows': [['t']]}], 'PROBE_READ_UNVERIFIED')

    try:
        session = connect()
        transport = session.transport
        require(transport['scope'] == 'HOSTED_VERIFY_FULL' and transport['client_tls'] is True
                and transport['client_tls_protocol'] in ('TLSv1.2', 'TLSv1.3')
                and transport['postgres_version'] == 170011
                and type(transport['libpq_version']) is int
                and transport['libpq_version'] >= 120000
                and transport['backend_identity_mode'] in
                ('session_sql_backend_and_lock', 'direct_wire_sql_equal'), 'PROBE_TLS_UNVERIFIED')
        report['transport'] = {key: transport[key] for key in (
            'client_tls', 'client_tls_protocol', 'postgres_version', 'libpq_version',
            'backend_identity_mode')}
        report['transport']['protocol_pid_matches_sql_backend'] = (
            session.pq.PQbackendPID(session.connection) == session.identity['backend_pid'])
        report['checks'].append(CHECKS[0])
        session.check_lock()
        report['checks'].append(CHECKS[1])
        try:
            competitor = connect()
            closed(competitor)
            raise Failure('PROBE_COMPETITOR_ACCEPTED')
        except Failure as error:
            require(error.code == 'EXCLUSIVE_SESSION_LOCK_BUSY', 'PROBE_COMPETITOR_FAILURE_UNKNOWN')
        report['checks'].append(CHECKS[2])
        session.check_lock()
        report['checks'].append(CHECKS[3])
        snapshot = session.begin_capture()
        require(snapshot['backend_pid'] == session.identity['backend_pid']
                and snapshot['backend_start'] == session.identity['backend_start']
                and re.fullmatch(r'[0-9A-F]+-[0-9A-F]+-[0-9]+', snapshot['exported_snapshot'], re.I),
                'PROBE_SNAPSHOT_UNVERIFIED')
        report['checks'].append(CHECKS[4])
        read_result(session.capture_query(READ))
        report['checks'].append(CHECKS[5])
        require(session.end_capture() == {'snapshot_transaction_ended': True,
                                         'exclusive_session_lock_retained': True},
                'PROBE_TRANSITION_UNVERIFIED')
        report['checks'].append(CHECKS[6])
        fresh = session.begin_fresh_read()
        require(fresh['backend_pid'] == snapshot['backend_pid']
                and fresh['backend_start'] == snapshot['backend_start'], 'PROBE_BACKEND_CHANGED')
        report['checks'].append(CHECKS[7])
        read_result(session.fresh_read_query(READ))
        report['checks'].append(CHECKS[8])
        require(session.end_fresh_read() == {'fresh_read_transaction_ended': True,
                                           'exclusive_session_lock_retained': True},
                'PROBE_TRANSITION_UNVERIFIED')
        report['checks'].append(CHECKS[9])
        closed(session)
        for index, (query, expected, check) in enumerate(NEGATIVE_QUERIES):
            negative = connect()
            if index == 0:
                report['checks'].append(CHECKS[10])
            negative.begin_capture()
            try:
                negative.capture_query(query)
                raise Failure('PROBE_NEGATIVE_QUERY_ACCEPTED')
            except Failure as error:
                require(error.code == 'DATABASE_QUERY_FAILED' and error.sqlstate == expected,
                        'PROBE_NEGATIVE_FAILURE_UNKNOWN')
            require(negative.connection is None and negative.state == 'closed',
                    'PROBE_CONNECTION_CLOSE_UNPROVED')
            report['checks'].append(check)
        final = connect()
        final.check_lock()
        closed(final)
        report['checks'].append(CHECKS[13])
        report['passed'] = True
    except BaseException as error:
        report['error'] = error.code if isinstance(error, Failure) and error.code in ERROR_CODES \
            else 'TRANSPORT_PROBE_FAILED'
        report['sqlstate'] = error.sqlstate if isinstance(error, Failure) else None
    finally:
        close_failed = False
        for session in sessions:
            try:
                closed(session)
            except BaseException:
                close_failed = True
        report['returned_sessions_closed'] = not close_failed and all(
            session.connection is None and session.state == 'closed' for session in sessions)
        if close_failed:
            report.update(passed=False, error='PROBE_CONNECTION_CLOSE_UNPROVED', sqlstate=None)
    return report


def main():
    if len(sys.argv) != 1:
        return 1
    if not (os.environ.get('APP_ENV') == 'staging'
            and os.environ.get('GITHUB_REPOSITORY') == 'cluvonl/platform'
            and os.environ.get('GITHUB_REF') == 'refs/heads/staging'
            and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'):
        return 1
    report = measure(os.environ)
    sys.stdout.write(json.dumps(report, separators=(',', ':')) + '\n')
    return 0


if __name__ == '__main__':
    try:
        status = main()
    except BaseException:
        # No exception text, tracebacks or provider messages leave the process.
        status = 1
    sys.exit(status)
