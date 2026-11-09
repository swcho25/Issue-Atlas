#!/usr/bin/env python3
"""Read-only live audit and isolated restore rehearsal. Never restores production."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import uuid

DEVELOPMENT = 'issueatlas-dev-postgres-1'
PRODUCTION = 'issueatlas-prod-postgres-1'
ROOT = Path('/var/backups/issueatlas/backfill-rehearsal')
LABEL = 'kr.issue-atlas.backfill-rehearsal'
PSQL = 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
METADATA = """
SELECT json_build_object(
 'database_bytes', pg_database_size(current_database()),
 'counts', (SELECT json_object_agg(c.relname,
   (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I',
     c.relname), false, true, '')))[1]::text::bigint)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'),
 'flyway', (SELECT json_agg(row_to_json(f) ORDER BY f.installed_rank)
   FROM (SELECT installed_rank,version,script,checksum,success FROM public.flyway_schema_history) f),
 'extensions', (SELECT json_object_agg(extname,extversion) FROM pg_extension),
 'unvalidated_constraints', (SELECT count(*) FROM pg_constraint c
   JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND NOT c.convalidated)
);
"""
SEQUENCE_CHECK = """
DO $$
DECLARE s record; last_id bigint; called boolean; max_id bigint;
BEGIN
    FOR s IN SELECT seq.oid AS seq_oid, tab.oid AS tab_oid, a.attname
        FROM pg_class seq JOIN pg_depend d ON d.objid=seq.oid AND d.deptype IN ('a','i')
        JOIN pg_class tab ON tab.oid=d.refobjid
        JOIN pg_namespace n ON n.oid=tab.relnamespace
        JOIN pg_attribute a ON a.attrelid=tab.oid AND a.attnum=d.refobjsubid
        WHERE seq.relkind='S' AND n.nspname='public' LOOP
        EXECUTE format('SELECT last_value,is_called FROM %s',s.seq_oid::regclass)
            INTO last_id,called;
        EXECUTE format('SELECT max(%I) FROM %s',s.attname,s.tab_oid::regclass) INTO max_id;
        IF max_id IS NOT NULL AND (last_id<max_id OR (last_id=max_id AND NOT called)) THEN
            RAISE EXCEPTION 'Sequence behind table: %',s.seq_oid::regclass;
        END IF;
    END LOOP;
END $$;
"""


def run(*args, **kwargs):
    return subprocess.run(args, check=True, timeout=3600, **kwargs)


def query(container, sql):
    return run('docker', 'exec', '-i', container, 'sh', '-ec', PSQL,
               input=sql, text=True, capture_output=True).stdout.strip()


def metadata(container):
    return json.loads(query(container, METADATA))


def comparable(data):
    # Physical size changes on restore; logical contents and migration checksums must match.
    return {key: data[key] for key in
            ('counts', 'flyway', 'extensions', 'unvalidated_constraints')}


def validate_metadata(data):
    if not data['flyway'] or not all(row['success'] for row in data['flyway']):
        raise RuntimeError('Migration history contains a failed migration')
    if data['unvalidated_constraints']:
        raise RuntimeError('Unvalidated database constraints need review')


def cleanup(name, token):
    # Only resources with this invocation's unguessable ownership label may be removed.
    if not re.fullmatch(r'issueatlas-backfill-[0-9a-f]{32}', name):
        raise RuntimeError('Invalid temporary resource name')
    for kind in ('container', 'volume'):
        found = subprocess.run(['docker', kind, 'inspect', name],
                               capture_output=True, text=True, timeout=30)
        if found.returncode:
            # A missing resource is expected after partial setup; daemon failures are not.
            if 'no such' not in found.stderr.lower():
                raise RuntimeError(f'Cannot inspect temporary {kind}: {found.stderr.strip()}')
            continue
        item = json.loads(found.stdout)[0]
        labels = item['Config'].get('Labels') if kind == 'container' else item.get('Labels')
        if (labels or {}).get(LABEL) != token:
            raise RuntimeError(f'Refusing to remove unowned {kind}')
        args = ['docker', kind, 'rm']
        if kind == 'container':
            args.append('-f')
        run(*args, name, capture_output=True)


def restore_archive(folder, report, name, token, clean_qa=False):
    image = run('docker', 'inspect', '--format', '{{.Image}}', DEVELOPMENT,
                capture_output=True, text=True).stdout.strip()
    run('docker', 'volume', 'create', '--label', f'{LABEL}={token}', name,
        capture_output=True)
    run('docker', 'run', '-d', '--name', name, '--label', f'{LABEL}={token}',
        '--network', 'none', '--cpus', '1', '--memory', '2g', '--pids-limit', '256',
        '--shm-size', '256m', '--mount', f'type=volume,src={name},dst=/var/lib/postgresql/data',
        '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_USER=postgres',
        '-e', 'POSTGRES_DB=rehearsal', image, 'postgres',
        '-c', 'max_wal_size=4GB', '-c', 'max_parallel_maintenance_workers=0',
        capture_output=True)
    for _ in range(90):
        # The entrypoint's temporary initialization server has only a Unix socket.
        ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1',
                                '-U', 'postgres', '-d', 'rehearsal'],
                               capture_output=True, timeout=15)
        if ready.returncode == 0:
            break
        time.sleep(2)
    else:
        raise RuntimeError('Temporary PostgreSQL did not become ready')
    # Avoid preinstalled PostGIS schemas/data in the image's default database.
    run('docker', 'exec', name, 'dropdb', '-U', 'postgres', 'rehearsal')
    run('docker', 'exec', name, 'createdb', '-U', 'postgres', '-T', 'template0', 'rehearsal')
    with (folder / 'database.dump').open('rb') as source, \
            (folder / 'restore.stderr').open('w') as errors:
        run('docker', 'exec', '-i', '-e',
            'PGOPTIONS=-c maintenance_work_mem=64MB -c max_parallel_maintenance_workers=0',
            name, 'pg_restore', '--exit-on-error', '--no-owner', '--no-privileges',
            '-U', 'postgres', '-d', 'rehearsal', stdin=source,
            stdout=subprocess.DEVNULL, stderr=errors)
    report['restored'] = metadata(name)
    validate_metadata(report['restored'])
    if comparable(report['source']) != comparable(report['restored']):
        raise RuntimeError('Restored counts, migrations, extensions or constraints differ')
    query(name, SEQUENCE_CHECK)
    report['sequences_checked'] = True
    if clean_qa:
        # Caller-created isolated container only; no production connection exists here.
        query(name, Path(__file__).with_name('backfill_qa.sql').read_text(encoding='utf-8'))
        report['prepared'] = metadata(name)
        validate_metadata(report['prepared'])
        query(name, SEQUENCE_CHECK)
        report['sequences_checked'] = True
        filtered = folder / 'prepared.dump'
        pending = folder / 'prepared.partial'
        with pending.open('wb') as output:
            run('docker', 'exec', name, 'sh', '-ec',
                'exec pg_dump -Fc --no-owner --no-privileges '
                '-U "$POSTGRES_USER" -d "$POSTGRES_DB"', stdout=output)
        with pending.open('rb') as source:
            run('docker', 'exec', '-i', name, 'pg_restore', '--file=/dev/null',
                stdin=source, stdout=subprocess.DEVNULL)
        pending.replace(filtered)
        with filtered.open('rb') as source:
            report['prepared_sha256'] = hashlib.file_digest(source, 'sha256').hexdigest()
        report['prepared_bytes'] = filtered.stat().st_size
    report['status'] = 'passed'


def retry(stamp, clean_qa=False):
    import fcntl
    os.umask(0o077)
    if not re.fullmatch(r'\d{8}T\d{6}Z', stamp):
        raise ValueError('Use the exact rehearsal UTC timestamp')
    folder = ROOT / stamp
    if folder.is_symlink() or folder.resolve() != folder:
        raise RuntimeError('Unsafe backup path')
    with (ROOT / '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        report = json.loads((folder / 'report.json').read_text())
        with (folder / 'database.dump').open('rb') as source:
            if hashlib.file_digest(source, 'sha256').hexdigest() != report['sha256']:
                raise RuntimeError('Backup checksum mismatch')
        if shutil.disk_usage(ROOT).free < max(2 * report['source']['database_bytes'], 4 * 1024**3):
            raise RuntimeError('Insufficient disk space')
        token = uuid.uuid4().hex
        name = f'issueatlas-backfill-{token}'
        report.update(status='started', temporary_resource=name,
                      temporary_resources_removed=False)
        report.pop('error_type', None)
        for field in ('prepared', 'prepared_sha256', 'prepared_bytes'):
            report.pop(field, None)
        try:
            restore_archive(folder, report, name, token, clean_qa)
        except BaseException as error:
            report.update(status='failed', error_type=type(error).__name__)
            # Keep diagnostics private on the host; never print DB payloads.
            result = subprocess.run(['docker', 'logs', name], capture_output=True, timeout=30)
            (folder / 'container.log').write_bytes(result.stdout + result.stderr)
            raise
        finally:
            try:
                cleanup(name, token)
                report['temporary_resources_removed'] = True
            finally:
                (folder / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'report': str(folder / 'report.json'),
                          'tables': len(report['source']['counts']),
                          'temporary_resources_removed': True, 'production_modified': False}), flush=True)


def rehearse(clean_qa=False):
    import fcntl  # Server-only; all unit-testable helpers also work on Windows.
    os.umask(0o077)
    ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    if ROOT.is_symlink() or ROOT.resolve() != ROOT:
        raise RuntimeError('Unsafe rehearsal backup directory')
    with (ROOT / '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        size = int(query(DEVELOPMENT, 'SELECT pg_database_size(current_database());'))
        if shutil.disk_usage(ROOT).free < max(3 * size, 4 * 1024**3):
            raise RuntimeError('Insufficient disk space; no resources created')
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        folder = ROOT / stamp
        folder.mkdir(mode=0o700)
        token = uuid.uuid4().hex
        name = f'issueatlas-backfill-{token}'
        report = {'created_utc': stamp, 'production_modified': False,
                  'temporary_resource': name, 'status': 'started'}
        keeper = None
        try:
            # Keep an exported READ ONLY snapshot alive until pg_dump has finished.
            keeper = subprocess.Popen(['docker', 'exec', '-i', DEVELOPMENT, 'sh', '-ec', PSQL],
                                      stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=(folder / 'snapshot.stderr').open('w'), text=True)
            keeper.stdin.write('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'
                               "SET idle_in_transaction_session_timeout='60min';\n"
                               'SELECT pg_export_snapshot();\n')
            keeper.stdin.flush()
            snapshot = keeper.stdout.readline().strip()
            if not re.fullmatch(r'[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+', snapshot):
                raise RuntimeError('Could not export source snapshot')
            keeper.stdin.write(METADATA + '\n')
            keeper.stdin.flush()
            report['source'] = json.loads(keeper.stdout.readline())
            validate_metadata(report['source'])
            archive = folder / 'database.dump'
            with archive.open('wb') as output:
                run('docker', 'exec', DEVELOPMENT, 'sh', '-ec',
                    'exec pg_dump -Fc --no-owner --no-privileges --snapshot="$1" '
                    '-U "$POSTGRES_USER" -d "$POSTGRES_DB"', 'sh', snapshot, stdout=output)
            keeper.communicate('ROLLBACK;\n', timeout=30)
            if keeper.returncode:
                raise RuntimeError('Source snapshot session failed')
            keeper = None
            with archive.open('rb') as source:
                report['sha256'] = hashlib.file_digest(source, 'sha256').hexdigest()
            report['archive_bytes'] = archive.stat().st_size
            print('Snapshot backup complete; restoring isolated temporary DB', flush=True)
            restore_archive(folder, report, name, token, clean_qa)
        except BaseException as error:
            report['status'] = 'failed'
            report['error_type'] = type(error).__name__
            raise
        finally:
            if keeper is not None:
                try:
                    keeper.communicate('ROLLBACK;\n', timeout=30)
                except (subprocess.TimeoutExpired, BrokenPipeError):
                    keeper.kill()
                    keeper.wait(timeout=30)
            try:
                cleanup(name, token)
                report['temporary_resources_removed'] = True
            finally:
                (folder / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'report': str(folder / 'report.json'),
                          'tables': len(report['source']['counts']),
                          'temporary_resources_removed': True, 'production_modified': False}),
              flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('audit', 'rehearse', 'retry'))
    parser.add_argument('--stamp', help='Retry the already backed-up snapshot without another dump')
    parser.add_argument('--clean-qa', action='store_true',
                        help='Test the dated QA exclusions in the isolated DB and export prepared.dump')
    args = parser.parse_args()
    if args.action == 'audit':
        print(json.dumps({'development': metadata(DEVELOPMENT),
                          'production': metadata(PRODUCTION)}, indent=2))
    elif args.action == 'retry':
        if not args.stamp:
            parser.error('retry requires --stamp')
        retry(args.stamp, args.clean_qa)
    else:
        rehearse(args.clean_qa)


if __name__ == '__main__':
    main()
