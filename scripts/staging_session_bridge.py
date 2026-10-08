#!/usr/bin/env python3
"""Private pipe protocol for a single fixed-staging libpq session.

This is not a public reporting CLI. The trusted owner must keep stdout private;
results contain provider catalog/data hashes and private session identifiers.
There is no reconnect, DDL, migration, shell or caller-supplied command route.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

from staging_backup_session import Failure, Session, MAX_INPUT, MAX_RESULT, require

PROJECT = 'fbozlbgmktkgcdfqdaaz'
LOCK_OBJECT = int.from_bytes(hashlib.sha256(PROJECT.encode()).digest()[:4], 'big', signed=True)
OPERATIONS = {
    'begin_capture': 'begin_capture', 'capture_query': 'capture_query',
    'check_lock': 'check_lock', 'end_capture': 'end_capture',
    'begin_fresh_read': 'begin_fresh_read', 'fresh_read_query': 'fresh_read_query',
    'end_fresh_read': 'end_fresh_read',
}
SESSION_SOURCE_SHA256 = 'e2623e24a311c9a888e13146db4ff31b6be9e65abd8e8d37032762b9c618f1e1'


def main():
    session, sequence = None, 1
    try:
        require(len(sys.argv) == 1 and os.environ.get('APP_ENV') == 'staging', 'BRIDGE_CONTEXT_REQUIRED')
        require(hashlib.sha256(Path(__file__).with_name('staging_backup_session.py').read_bytes()).hexdigest()
                == SESSION_SOURCE_SHA256, 'BRIDGE_SESSION_SOURCE_CHANGED')
        while True:
            raw = sys.stdin.buffer.readline(MAX_INPUT + 1)
            if not raw:
                break
            require(len(raw) <= MAX_INPUT and raw.endswith(b'\n'), 'BRIDGE_REQUEST_BOUND_EXCEEDED')
            try:
                request = json.loads(raw.decode('utf-8', 'strict'))
            except (UnicodeError, ValueError):
                raise Failure('BRIDGE_REQUEST_INVALID') from None
            require(type(request) is dict and set(request) == {'id', 'operation', 'argument'}
                    and type(request['id']) is int and request['id'] == sequence,
                    'BRIDGE_REQUEST_INVALID')
            sequence += 1
            operation, argument = request['operation'], request['argument']
            require(type(operation) is str, 'BRIDGE_OPERATION_INVALID')
            try:
                if operation == 'connect':
                    require(session is None and sequence == 2 and argument == {'lock_object': LOCK_OBJECT},
                            'BRIDGE_CONNECT_INVALID')
                    session = Session(dict(os.environ), LOCK_OBJECT)
                    value = session.transport
                elif operation == 'close':
                    require(argument is None and session is not None, 'BRIDGE_OPERATION_INVALID')
                    session.close()
                    value = {'closed': True}
                else:
                    require(operation in OPERATIONS and session is not None, 'BRIDGE_OPERATION_INVALID')
                    method = getattr(session, OPERATIONS[operation])
                    if operation in ('capture_query', 'fresh_read_query'):
                        require(type(argument) is str, 'BRIDGE_QUERY_INVALID')
                        value = method(argument)
                    else:
                        require(argument is None, 'BRIDGE_OPERATION_INVALID')
                        value = method()
                response = {'id': request['id'], 'ok': True, 'value': value}
            except Failure as error:
                response = {'id': request['id'], 'ok': False, 'code': error.code, 'sqlstate': error.sqlstate}
            encoded = (json.dumps(response, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
            require(len(encoded) <= MAX_RESULT, 'BRIDGE_RESPONSE_BOUND_EXCEEDED')
            sys.stdout.buffer.write(encoded)
            sys.stdout.buffer.flush()
            if operation == 'close' or not response['ok']:
                break
        return 0
    except BaseException:
        # No raw exception/traceback/private provider detail is printed.
        return 1
    finally:
        if session is not None:
            session.close()


if __name__ == '__main__':
    sys.exit(main())
