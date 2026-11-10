#!/usr/bin/env python3
"""Root-run development DB backups; no credentials leave the DB container."""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path('/var/backups/issueatlas/daily/development')
CONTAINER = 'issueatlas-dev-postgres-1'
NAME = re.compile(r'\d{8}T\d{6}Z')


def run(*args, **kwargs):
    return subprocess.run(args, check=True, timeout=7200, **kwargs)


def prune(root, keep=7):
    # Only this program's completed directories; never follow symlinks.
    backups = sorted(p for p in root.iterdir() if NAME.fullmatch(p.name)
                     and not p.is_symlink() and p.is_dir()
                     and (p / 'manifest.json').is_file()
                     and (p / 'database.dump').is_file())
    for old in backups[:-keep]:
        shutil.rmtree(old)


def backup():
    import fcntl  # Linux only; tests can exercise retention on other platforms.
    os.umask(0o077)
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    if ROOT.is_symlink() or ROOT.resolve() != ROOT:
        raise RuntimeError('Backup path must not contain symlinks')
    ROOT.chmod(0o700)
    with (ROOT / '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        size = int(run('docker', 'exec', CONTAINER, 'sh', '-ec',
                       'psql -XAt -U "$POSTGRES_USER" -d "$POSTGRES_DB" '
                       '-c "SELECT pg_database_size(current_database())"',
                       capture_output=True, text=True).stdout.strip())
        if shutil.disk_usage(ROOT).free < max(2 * size, 2 * 1024**3):
            raise RuntimeError('Insufficient free space; existing backups preserved')
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        pending = Path(tempfile.mkdtemp(prefix='.partial-', dir=ROOT))
        try:
            archive = pending / 'database.dump'
            with archive.open('wb') as output:
                run('docker', 'exec', CONTAINER, 'sh', '-ec',
                    'exec pg_dump -Fc --no-owner --no-privileges '
                    '-U "$POSTGRES_USER" -d "$POSTGRES_DB"', stdout=output)
                output.flush()
                os.fsync(output.fileno())
            # Consume all archive entries, including decompression. This is NOT
            # a restore test: SQL execution/constraints require a separate DB.
            with archive.open('rb') as source:
                run('docker', 'exec', '-i', CONTAINER, 'pg_restore',
                    '--file=/dev/null', stdin=source)
            with archive.open('rb') as source:
                digest = hashlib.file_digest(source, 'sha256').hexdigest()
            manifest = {'created_utc': stamp, 'environment': 'development',
                        'container': CONTAINER, 'bytes': archive.stat().st_size,
                        'sha256': digest, 'validation': 'full archive read',
                        'restore_tested': False}
            with (pending / 'manifest.json').open('w') as output:
                json.dump(manifest, output, indent=2)
                output.flush()
                os.fsync(output.fileno())
            pending.rename(ROOT / stamp)
            directory = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            if pending.exists():
                shutil.rmtree(pending)
        # Only reached after a successful dump, full read, and publication.
        prune(ROOT)
        print(f'Backup complete: {ROOT / stamp}', flush=True)


if __name__ == '__main__':
    backup()
