import importlib.util
import io
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'scripts/staging_session_bridge.py'
sys.path.insert(0, str(source.parent))
spec = importlib.util.spec_from_file_location('private_protocol', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SyntheticSession:
    instances = []
    failure = None

    def __init__(self, environment, lock):
        self.calls = []
        self.closed = 0
        self.transport = {'scope': 'SYNTHETIC_TEST_ONLY'}
        SyntheticSession.instances.append(self)
        self.calls.append(('connect', lock))

    def __getattr__(self, operation):
        def call(*arguments):
            self.calls.append((operation, *arguments))
            if SyntheticSession.failure == 'known':
                raise module.Failure('DATABASE_QUERY_FAILED', '25006')
            if SyntheticSession.failure == 'private':
                raise RuntimeError('SYNTHETIC_PRIVATE_PROVIDER_ERROR')
            return {'synthetic_result': operation}
        return call

    def close(self):
        self.closed += 1


class PipeProtocol(unittest.TestCase):
    def setUp(self):
        SyntheticSession.instances = []
        SyntheticSession.failure = None

    def encoded(self, operations):
        return b''.join((json.dumps({'id': i, 'operation': op, 'argument': argument}) + '\n').encode()
                        for i, (op, argument) in enumerate(operations, 1))

    def run_bridge(self, raw, environment=None, arguments=None):
        stdout = io.BytesIO()
        with patch.object(module, 'Session', SyntheticSession), \
                patch.object(module.sys, 'stdin', SimpleNamespace(buffer=io.BytesIO(raw))), \
                patch.object(module.sys, 'stdout', SimpleNamespace(buffer=stdout)), \
                patch.object(module.sys, 'argv', arguments or [str(source)]), \
                patch.dict(os.environ, environment or {'APP_ENV': 'staging'}, clear=True):
            result = module.main()
        return result, stdout.getvalue()

    def test_fixed_operations_and_single_connection_are_dispatched_and_closed(self):
        operations = [('connect', {'lock_object': module.LOCK_OBJECT}), ('begin_capture', None),
                      ('capture_query', 'SELECT synthetic'), ('check_lock', None), ('end_capture', None),
                      ('begin_fresh_read', None), ('fresh_read_query', 'SELECT fresh_synthetic'),
                      ('end_fresh_read', None), ('close', None)]
        result, output = self.run_bridge(self.encoded(operations))
        self.assertEqual(result, 0)
        responses = [json.loads(row) for row in output.splitlines()]
        self.assertEqual([response['id'] for response in responses], list(range(1, 10)))
        self.assertTrue(all(response['ok'] for response in responses))
        self.assertEqual(len(SyntheticSession.instances), 1)
        self.assertEqual(SyntheticSession.instances[0].closed, 2)

    def test_eof_closes_open_session(self):
        result, output = self.run_bridge(self.encoded([('connect', {'lock_object': module.LOCK_OBJECT})]))
        self.assertEqual(result, 0)
        self.assertEqual(SyntheticSession.instances[0].closed, 1)
        self.assertEqual(len(output.splitlines()), 1)

    def test_unknown_apply_and_reconnect_operations_never_dispatch(self):
        for operation, argument in [('apply', 'CREATE TABLE synthetic'), ('run', 'SELECT 1'),
                                    ('connect', {'lock_object': module.LOCK_OBJECT})]:
            result, output = self.run_bridge(self.encoded([
                ('connect', {'lock_object': module.LOCK_OBJECT}), (operation, argument)]))
            response = json.loads(output.splitlines()[-1])
            self.assertFalse(response['ok'])
            self.assertEqual(len(SyntheticSession.instances[-1].calls), 1)
            self.assertEqual(SyntheticSession.instances[-1].closed, 1)
            self.assertEqual(result, 0)

    def test_other_key_and_local_mode_cannot_create_connection(self):
        for argument in ({'lock_object': module.LOCK_OBJECT + 1},
                         {'lock_object': module.LOCK_OBJECT, 'local': True}, None):
            _, output = self.run_bridge(self.encoded([('connect', argument)]))
            self.assertFalse(json.loads(output)['ok'])
        self.assertEqual(SyntheticSession.instances, [])

    def test_queries_and_arguments_have_fixed_types(self):
        for operation, argument in [('capture_query', {'sql': 'SELECT 1'}), ('check_lock', 'arbitrary'),
                                    ('close', {'command': 'shell'})]:
            _, output = self.run_bridge(self.encoded([
                ('connect', {'lock_object': module.LOCK_OBJECT}), (operation, argument)]))
            self.assertFalse(json.loads(output.splitlines()[-1])['ok'])
            self.assertEqual(len(SyntheticSession.instances[-1].calls), 1)

    def test_sequence_shape_and_utf8_errors_never_dispatch(self):
        for raw in (b'{"id":true,"operation":"connect","argument":null}\n',
                    b'{"id":2,"operation":"connect","argument":null}\n',
                    b'{"id":1,"operation":"connect","argument":null,"extra":true}\n',
                    b'\xff\n', b'[]\n', b'invalid\n'):
            result, output = self.run_bridge(raw)
            self.assertEqual(result, 1)
            self.assertEqual(output, b'')
        self.assertEqual(SyntheticSession.instances, [])

    def test_oversized_and_unterminated_input_closes_without_output(self):
        with patch.object(module, 'MAX_INPUT', 50):
            for raw in (b' ' * 51 + b'\n', b'{"id":1}'):
                result, output = self.run_bridge(raw)
                self.assertEqual(result, 1)
                self.assertEqual(output, b'')

    def test_response_bound_is_enforced_before_stdout(self):
        with patch.object(module, 'MAX_RESULT', 10):
            result, output = self.run_bridge(self.encoded([('connect', {'lock_object': module.LOCK_OBJECT})]))
        self.assertEqual(result, 1)
        self.assertEqual(output, b'')
        self.assertEqual(SyntheticSession.instances[0].closed, 1)

    def test_known_failure_returns_only_fixed_code_and_sqlstate_then_closes(self):
        SyntheticSession.failure = 'known'
        result, output = self.run_bridge(self.encoded([
            ('connect', {'lock_object': module.LOCK_OBJECT}), ('capture_query', 'SELECT synthetic'),
            ('check_lock', None)]))
        self.assertEqual(result, 0)
        self.assertEqual(len(output.splitlines()), 2)
        self.assertEqual(json.loads(output.splitlines()[-1]), {
            'id': 2, 'ok': False, 'code': 'DATABASE_QUERY_FAILED', 'sqlstate': '25006'})
        self.assertEqual(SyntheticSession.instances[0].closed, 1)

    def test_unknown_private_exception_is_never_printed(self):
        SyntheticSession.failure = 'private'
        result, output = self.run_bridge(self.encoded([
            ('connect', {'lock_object': module.LOCK_OBJECT}), ('capture_query', 'SELECT synthetic')]))
        self.assertEqual(result, 1)
        self.assertNotIn(b'SYNTHETIC_PRIVATE_PROVIDER_ERROR', output)
        self.assertEqual(len(output.splitlines()), 1)
        self.assertEqual(SyntheticSession.instances[0].closed, 1)

    def test_production_context_and_cli_arguments_are_refused_without_connecting(self):
        for environment, arguments in [({'APP_ENV': 'production'}, [str(source)]),
                                       ({'APP_ENV': 'staging'}, [str(source), '--apply'])]:
            result, output = self.run_bridge(b'', environment, arguments)
            self.assertEqual((result, output), (1, b''))
        self.assertEqual(SyntheticSession.instances, [])

    def test_changed_session_source_is_refused_before_connection(self):
        with patch.object(module, 'SESSION_SOURCE_SHA256', '0' * 64):
            result, output = self.run_bridge(self.encoded([('connect', {'lock_object': module.LOCK_OBJECT})]))
        self.assertEqual((result, output), (1, b''))
        self.assertEqual(SyntheticSession.instances, [])


if __name__ == '__main__':
    unittest.main()
