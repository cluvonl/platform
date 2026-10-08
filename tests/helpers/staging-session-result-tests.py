import ctypes as C
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[2] / 'scripts/staging_backup_session.py'
spec = importlib.util.spec_from_file_location('bounded_session', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(*values, **options):
    return {'status': 9, 'values': list(values), **options}


def end(command='SELECT 1', columns=1, **options):
    return {'status': 2, 'values': [], 'columns': columns, 'command': command, **options}


class FakePQ:
    def __init__(self, results, mode=True):
        self.results = results
        self.pending = list(range(1, len(results) + 1))
        self.mode = mode
        self.events = []
        self.buffers = []
        self.cleared = []
        self.finished = False

    def PQstatus(self, _):
        return 0

    def PQsendQuery(self, _, sql):
        self.events.append('send')
        return 1

    def PQsendQueryParams(self, _, sql, *_args):
        self.events.append('send_params')
        return 1

    def PQsetSingleRowMode(self, _):
        self.events.append('row_mode')
        return int(self.mode)

    def PQflush(self, _):
        self.events.append('flush')
        return 0

    def PQisBusy(self, _):
        return 0

    def PQgetResult(self, _):
        self.events.append('get')
        return self.pending.pop(0) if self.pending else None

    def result(self, value):
        return self.results[value - 1]

    def PQresultStatus(self, value):
        return self.result(value)['status']

    def PQnfields(self, value):
        result = self.result(value)
        return result.get('columns', len(result['values']))

    def PQntuples(self, value):
        return self.result(value).get('tuples', int(self.result(value)['status'] == 9))

    def PQgetisnull(self, value, _, column):
        return self.result(value)['values'][column] is None

    def raw(self, value, column):
        result = self.result(value)['values'][column]
        return result if isinstance(result, bytes) else result.encode()

    def PQgetlength(self, value, _, column):
        return self.result(value).get('claimed_size', len(self.raw(value, column)))

    def PQgetvalue(self, value, _, column):
        self.events.append('value')
        buffer = C.create_string_buffer(self.raw(value, column))
        self.buffers.append(buffer)
        return C.addressof(buffer)

    def PQcmdStatus(self, value):
        return self.result(value).get('command', '').encode()

    def PQresultErrorField(self, value, _):
        return self.result(value).get('sqlstate', 'XX000').encode()

    def PQclear(self, value):
        self.cleared.append(value)

    def PQfinish(self, _):
        self.finished = True


def session(results, **options):
    value = module.Session.__new__(module.Session)
    value.connection = object()
    value.state = 'capture'
    value.warning = False
    value.pq = FakePQ(results, **options)
    return value


class ResultBudgets(unittest.TestCase):
    def deny(self, value, code, sql='SELECT synthetic_fixture', **options):
        with self.assertRaises(module.Failure) as caught:
            value.run(sql, **options)
        self.assertEqual(caught.exception.code, code)
        self.assertTrue(value.pq.finished)
        self.assertIsNone(value.connection)
        self.assertEqual(value.state, 'closed')

    def test_row_mode_is_selected_before_flush_and_rows_keep_command_boundaries(self):
        value = session([row('a', None), row('b', '€'), end('SELECT 2', 2),
                         {'status': 1, 'values': [], 'command': 'ROLLBACK'}, end('SELECT 0', 1)])
        self.assertEqual(value.run('SELECT synthetic; ROLLBACK; SELECT empty'), [
            {'command': 'SELECT 2', 'rows': [['a', None], ['b', '€']]},
            {'command': 'ROLLBACK', 'rows': []}, {'command': 'SELECT 0', 'rows': []}])
        self.assertEqual(value.pq.events[:3], ['send', 'row_mode', 'flush'])
        self.assertEqual(value.pq.cleared, [1, 2, 3, 4, 5])
        self.assertFalse(value.pq.finished)

    def test_parameter_query_uses_same_row_protocol(self):
        value = session([row('t'), end()])
        self.assertEqual(value.run('SELECT true', single=True)[0]['rows'], [['t']])
        self.assertEqual(value.pq.events[:3], ['send_params', 'row_mode', 'flush'])

    def test_mode_refusal_closes_before_flush(self):
        value = session([], mode=False)
        self.deny(value, 'DATABASE_ROW_MODE_FAILED')
        self.assertEqual(value.pq.events, ['send', 'row_mode'])

    def test_null_and_empty_rows_count_towards_row_budget(self):
        for text in (None, ''):
            value = session([row(text), row(text), end('SELECT 2')])
            with patch.object(module, 'MAX_ROWS', 1):
                self.deny(value, 'DATABASE_ROW_BOUND_EXCEEDED')
            self.assertEqual(value.pq.cleared, [1, 2])
            self.assertEqual(value.pq.pending, [3])

    def test_columns_are_bounded_before_values_are_read(self):
        value = session([row(None, None)])
        with patch.object(module, 'MAX_COLUMNS', 1):
            self.deny(value, 'DATABASE_COLUMN_BOUND_EXCEEDED')
        self.assertNotIn('value', value.pq.events)
        self.assertEqual(value.pq.cleared, [1])

    def test_cells_include_nulls(self):
        value = session([row(None, None), row(None, None), end('SELECT 2', 2)])
        with patch.object(module, 'MAX_CELLS', 3):
            self.deny(value, 'DATABASE_CELL_BOUND_EXCEEDED')
        self.assertEqual(value.pq.cleared, [1, 2])

    def test_serialized_byte_budget_includes_nulls_escapes_and_commands(self):
        for results in ([row(*([None] * 10)), end(columns=10)],
                        [row('\x00' * 12), end()],
                        [end('SELECT 0', 1), end('SELECT 0', 1)]):
            value = session(results)
            with patch.object(module, 'MAX_RESULT', 60):
                self.deny(value, 'DATABASE_RESULT_BOUND_EXCEEDED')

    def test_declared_oversized_field_is_rejected_before_copy(self):
        value = session([row('synthetic', claimed_size=module.MAX_RESULT + 1)])
        self.deny(value, 'DATABASE_RESULT_BOUND_EXCEEDED')
        self.assertNotIn('value', value.pq.events)

    def test_command_count_is_bounded_even_for_zero_row_results(self):
        value = session([end('SELECT 0'), end('SELECT 0')])
        with patch.object(module, 'MAX_COMMANDS', 1):
            self.deny(value, 'DATABASE_COMMAND_BOUND_EXCEEDED')
        self.assertEqual(value.pq.cleared, [1, 2])

    def test_terminal_error_discards_earlier_rows_and_keeps_only_sqlstate(self):
        value = session([row('synthetic-private-value'), {'status': 7, 'values': [], 'sqlstate': '22012'}])
        self.deny(value, 'DATABASE_QUERY_FAILED')
        self.assertEqual(value.pq.cleared, [1, 2])
        self.assertEqual(value.pq.pending, [])

    def test_missing_terminal_result_closes_instead_of_returning_partial_rows(self):
        self.deny(session([row('synthetic')]), 'DATABASE_RESULT_INCOMPLETE')

    def test_unexpected_buffered_rows_or_changed_column_shape_are_rejected(self):
        for results in ([end(tuples=1)], [row('a'), row('b', 'c')],
                        [row('a'), end(columns=2)],
                        [row('a'), {'status': 1, 'values': [], 'command': 'COMMIT'}]):
            value = session(results)
            expected = 'DATABASE_ROW_MODE_INVALID' if results[0].get('tuples') else 'DATABASE_RESULT_SHAPE_CHANGED'
            self.deny(value, expected)

    def test_invalid_utf8_is_a_fixed_failure_and_clears_result(self):
        value = session([row(b'\xff')])
        self.deny(value, 'DATABASE_RESULT_ENCODING_INVALID')
        self.assertEqual(value.pq.cleared, [1])

    def test_cpu_deadline_is_checked_between_buffered_results(self):
        value = session([row('a'), row('b'), end('SELECT 2')])
        with patch.object(module.time, 'monotonic', side_effect=[0, 0, 0, 0, 31]):
            self.deny(value, 'DATABASE_TIMEOUT')
        self.assertEqual(value.pq.cleared, [1])
        self.assertEqual(value.pq.pending, [2, 3])


if __name__ == '__main__':
    unittest.main()
