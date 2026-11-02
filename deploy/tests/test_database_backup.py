import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
import subprocess
import types

spec = importlib.util.spec_from_file_location(
    'database_backup', Path(__file__).parents[1] / 'backup/backup_database.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class RetentionTest(unittest.TestCase):
    def test_failed_dump_or_archive_read_never_prunes(self):
        for failed_call in (2, 3):
            with self.subTest(failed_call=failed_call), tempfile.TemporaryDirectory() as temp:
                root = Path(temp).resolve()
                old = root / 'manual'
                old.mkdir()
                fake_lock = types.SimpleNamespace(LOCK_EX=1, LOCK_NB=2, flock=Mock())
                calls = [Mock(stdout='1'), None, None]
                calls[failed_call - 1] = subprocess.CalledProcessError(1, 'docker')
                with patch.dict('sys.modules', {'fcntl': fake_lock}), \
                     patch.object(backup, 'ROOT', root), \
                     patch.object(backup, 'run', side_effect=calls), \
                     patch.object(backup, 'prune') as prune, \
                     patch.object(backup.os, 'umask'), \
                     patch.object(backup.shutil, 'disk_usage', return_value=Mock(free=10**12)):
                    with self.assertRaises(subprocess.CalledProcessError):
                        backup.backup()
                    prune.assert_not_called()
                self.assertTrue(old.exists())
                self.assertEqual(list(root.glob('.partial-*')), [])

    def test_keeps_seven_completed_and_preserves_manual_and_incomplete(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for day in range(1, 10):
                folder = root / f'202611{day:02d}T190000Z'
                folder.mkdir()
                (folder / 'database.dump').touch()
                (folder / 'manifest.json').write_text('{}')
            for name in ['manual-before-change', '.partial-test',
                         '20261031T190000Z']:
                (root / name).mkdir()
            backup.prune(root)
            self.assertFalse((root / '20261101T190000Z').exists())
            self.assertFalse((root / '20261102T190000Z').exists())
            self.assertTrue((root / '20261103T190000Z').exists())
            self.assertEqual(len(list(root.iterdir())), 10)

    def test_fewer_than_seven_are_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            folder = root / '20261102T190000Z'
            folder.mkdir()
            (folder / 'database.dump').touch()
            (folder / 'manifest.json').touch()
            backup.prune(root)
            self.assertTrue(folder.exists())
