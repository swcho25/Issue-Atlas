import importlib.util
import json
from pathlib import Path
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'backfill_rehearsal', Path(__file__).parents[1] / 'backup/rehearse_backfill.py')
backfill = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backfill)


class RehearsalSafetyTest(unittest.TestCase):
    def test_failed_migration_or_unvalidated_constraint_blocks_readiness(self):
        for data in ({'flyway': [], 'unvalidated_constraints': 0},
                     {'flyway': [{'success': False}], 'unvalidated_constraints': 0},
                     {'flyway': [{'success': True}], 'unvalidated_constraints': 1}):
            with self.assertRaises(RuntimeError):
                backfill.validate_metadata(data)

    def test_comparison_includes_counts_checksums_extensions_and_constraints(self):
        source = {'counts': {'card': 2}, 'flyway': [{'checksum': 123}],
                  'extensions': {'vector': '0.8.7'}, 'unvalidated_constraints': 0,
                  'database_bytes': 100}
        restored = dict(source, database_bytes=200)
        self.assertEqual(backfill.comparable(source), backfill.comparable(restored))
        for key, changed in [('counts', {'card': 1}), ('flyway', [{'checksum': 456}]),
                             ('extensions', {'vector': '0.8.6'}),
                             ('unvalidated_constraints', 1)]:
            with self.subTest(key=key):
                self.assertNotEqual(backfill.comparable(source),
                                    backfill.comparable(dict(restored, **{key: changed})))

    def test_cleanup_rejects_live_service_names_before_running_docker(self):
        with patch.object(backfill.subprocess, 'run') as docker:
            for name in (backfill.DEVELOPMENT, backfill.PRODUCTION, 'issueatlas-backfill-x'):
                with self.assertRaises(RuntimeError):
                    backfill.cleanup(name, 'token')
            docker.assert_not_called()

    def test_cleanup_requires_matching_invocation_label(self):
        name = 'issueatlas-backfill-' + 'a' * 32
        inspection = types.SimpleNamespace(returncode=0, stdout=json.dumps([
            {'Config': {'Labels': {backfill.LABEL: 'another-run'}}}]))
        with patch.object(backfill.subprocess, 'run', return_value=inspection), \
                patch.object(backfill, 'run') as remove:
            with self.assertRaises(RuntimeError):
                backfill.cleanup(name, 'current-run')
            remove.assert_not_called()

    def test_cleanup_removes_only_owned_container_then_volume(self):
        name = 'issueatlas-backfill-' + 'a' * 32
        inspections = [types.SimpleNamespace(returncode=0, stdout=json.dumps([item])) for item in
                       ({'Config': {'Labels': {backfill.LABEL: 'token'}}},
                        {'Labels': {backfill.LABEL: 'token'}})]
        with patch.object(backfill.subprocess, 'run', side_effect=inspections), \
                patch.object(backfill, 'run') as remove:
            backfill.cleanup(name, 'token')
            self.assertEqual([call.args for call in remove.call_args_list],
                             [('docker', 'container', 'rm', '-f', name),
                              ('docker', 'volume', 'rm', name)])

    def test_cleanup_does_not_hide_daemon_error_as_missing_resource(self):
        failure = types.SimpleNamespace(returncode=1, stderr='Cannot connect to Docker daemon')
        with patch.object(backfill.subprocess, 'run', return_value=failure):
            with self.assertRaises(RuntimeError):
                backfill.cleanup('issueatlas-backfill-' + 'a' * 32, 'token')

    def test_partial_setup_allows_already_missing_temporary_resources(self):
        missing = types.SimpleNamespace(returncode=1, stderr='Error: no such volume')
        with patch.object(backfill.subprocess, 'run', return_value=missing), \
                patch.object(backfill, 'run') as remove:
            backfill.cleanup('issueatlas-backfill-' + 'a' * 32, 'token')
            remove.assert_not_called()


if __name__ == '__main__':
    unittest.main()
