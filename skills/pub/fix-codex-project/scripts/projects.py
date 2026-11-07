"""Inspect and restore account-scoped desktop project metadata; Python stdlib only."""
import argparse
import copy
from contextlib import closing, contextmanager
from functools import wraps
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

ACCOUNT = 'electron-account-renderer-state-v1'
STATE = '.codex-global-state.json'
MAP_KEYS = {
    'local-projects', 'electron-workspace-root-labels', 'project-appearances',
    'project-writable-roots', 'project-files', 'sidebar-project-thread-orders',
    'thread-project-assignments', 'thread-project-membership-host-ids',
    'thread-workspace-root-hints', 'thread-writable-roots',
    'app-server-project-id-by-legacy-project-id-by-host',
    'app-server-projects-migration-by-host',
}
LIST_KEYS = {'electron-saved-workspace-roots', 'active-workspace-roots',
             'project-order', 'pinned-project-ids'}
KEYS = MAP_KEYS | LIST_KEYS | {'selected-project'}


@contextmanager
def exclusive_restore(home):
    lock = Path(home) / '.fix-codex-project.lock'
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.write(fd, str(os.getpid()).encode())
        yield
    finally:
        os.close(fd)
        lock.unlink()


def serialized(function):
    @wraps(function)
    def guarded(home, *args, **kwargs):
        with exclusive_restore(home):
            return function(home, *args, **kwargs)
    return guarded


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest() if Path(path).exists() else None


def atomic_bytes(path, data):
    path = Path(path)
    temp = path.with_name(path.name + '.fix-project-' + str(os.getpid()))
    try:
        with temp.open('xb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def atomic_json(path, value):
    atomic_bytes(path, json.dumps(value, ensure_ascii=False,
                                 separators=(',', ':')).encode('utf-8'))


def load(home):
    state = read(Path(home) / STATE)
    account = state.get(ACCOUNT)
    if not isinstance(account, dict) or not isinstance(account.get('inactive'), dict):
        raise ValueError('Unsupported account state schema')
    return state


def summary(g):
    return {k: len(g.get(k, {})) for k in
            ['local-projects', 'electron-saved-workspace-roots', 'thread-project-assignments']}


def sqlite_path(home):
    found = list(Path(home).glob('state_*.sqlite'))
    if len(found) > 1:
        raise ValueError('Multiple state databases: inspect the current runtime before restoring')
    return found[0] if found else None


def inspect(home):
    home = Path(home).resolve()
    state = load(home)
    scopes = [{'scope': 'current', 'ownerPrefix': str(state[ACCOUNT].get('owner'))[:12],
               **summary(state)}]
    for owner, saved in state[ACCOUNT]['inactive'].items():
        g = saved.get('globals', {})
        roots = [r for p in g.get('local-projects', {}).values() for r in p.get('rootPaths', [])]
        scopes.append({'scope': 'inactive', 'ownerPrefix': owner[:12], **summary(g),
                       'rootPathEntries': len(roots),
                       'existingRootPathEntries': sum(Path(r).is_dir() for r in roots)})
    result = {'home': str(home), 'scopes': scopes}
    db = sqlite_path(home)
    if db:
        with closing(sqlite3.connect(db.as_uri() + '?mode=ro', uri=True)) as c:
            c.execute('PRAGMA query_only=ON')
            tables = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            result['sqlite'] = {'file': db.name}
            if 'threads' in tables:
                columns = {r[1] for r in c.execute('PRAGMA table_info(threads)')}
                result['sqlite']['threads'] = c.execute('SELECT COUNT(*) FROM threads').fetchone()[0]
                result['sqlite']['creatorColumns'] = sorted(columns & {'creator_user_id', 'creator_account_id'})
                if 'project_id' in columns:
                    result['sqlite']['threadsWithProjectId'] = c.execute(
                        'SELECT COUNT(*) FROM threads WHERE project_id IS NOT NULL').fetchone()[0]
            if 'projects' in tables:
                result['sqlite']['projects'] = c.execute('SELECT COUNT(*) FROM projects').fetchone()[0]
    return result


def validate_globals(g):
    if not isinstance(g, dict):
        raise ValueError('Unsupported globals schema')
    for key in KEYS & g.keys():
        expected = list if key in LIST_KEYS else dict
        if g[key] is not None and not isinstance(g[key], expected):
            raise ValueError('Unsupported field schema: ' + key)
        if key != 'selected-project' and g[key] is None:
            raise ValueError('Unsupported null field: ' + key)
    for project in g.get('local-projects', {}).values():
        if not isinstance(project, dict) or not isinstance(project.get('rootPaths'), list):
            raise ValueError('Unsupported local project schema')
        if any(not isinstance(p, str) for p in project['rootPaths']):
            raise ValueError('Invalid root path')
    for assignment in g.get('thread-project-assignments', {}).values():
        if not isinstance(assignment, dict) or assignment.get('projectKind') != 'local':
            raise ValueError('Source includes non-local or unknown assignments; narrow manually')
        if not isinstance(assignment.get('projectId'), str):
            raise ValueError('Invalid project assignment')


def validate_source(source):
    g = source.get('globals')
    if not isinstance(g, dict) or not isinstance(g.get('local-projects'), dict) or not g['local-projects']:
        raise ValueError('Source has no local projects')
    validate_globals(g)


def plan(home, source_id=None):
    state = load(home)
    validate_globals(state)
    account = state[ACCOUNT]
    if not isinstance(account.get('owner'), str) or not account['owner']:
        raise ValueError('Current target account is not established')
    candidates = {k: v for k, v in account['inactive'].items()
                  if isinstance(v, dict) and v.get('globals', {}).get('local-projects')}
    if source_id is None:
        if len(candidates) != 1:
            raise ValueError('Select an exact inactive source; candidates are ambiguous or absent')
        source_id = next(iter(candidates))
    if source_id not in candidates:
        raise ValueError('Selected source is not an inactive scope with projects')
    source = candidates[source_id]
    validate_source(source)
    return {'schemaVersion': 1, 'home': str(Path(home).resolve()),
            'owner': account['owner'], 'source': source_id, 'sourceHash': digest(source),
            'keys': sorted(KEYS & source['globals'].keys()),
            'sourceCounts': summary(source['globals']), 'targetCounts': summary(state)}


def desktop_running():
    if os.name != 'nt':
        return False
    # The CLI/daemon can also be named codex.exe; it is not the desktop GUI.
    command = ("@(Get-Process -Name ChatGPT,Codex -ErrorAction SilentlyContinue | "
               "Where-Object { $_.ProcessName -eq 'ChatGPT' -or "
               "-not $_.Path -or (Test-Path -LiteralPath "
               "(Join-Path (Split-Path -Parent $_.Path) 'resources\\app.asar')) }).Count")
    p = subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', command],
                       capture_output=True, text=True, timeout=20)
    if p.returncode != 0 or not p.stdout.strip().isdigit():
        raise RuntimeError('Cannot verify desktop shutdown')
    return int(p.stdout.strip()) > 0


def require_stopped():
    if desktop_running():
        raise RuntimeError('Desktop is still running; close it before mutation')


def merge(source, target):
    if isinstance(source, dict) and isinstance(target, dict):
        result = copy.deepcopy(source)
        for k, v in target.items():
            result[k] = merge(result[k], v) if k in result else copy.deepcopy(v)
        return result
    if isinstance(source, list) and isinstance(target, list):
        result = copy.deepcopy(target)
        for v in source:
            if v not in result:
                result.append(copy.deepcopy(v))
        return result
    return copy.deepcopy(target)


def backup_files(home, folder):
    folder = Path(folder)
    skill_root = Path(__file__).resolve().parents[1]
    if folder.resolve().is_relative_to(skill_root.parent):
        raise ValueError('Backup must be outside the skill scan root')
    folder.mkdir(parents=True, exist_ok=False)
    files = {}
    for name in [STATE, STATE + '.bak']:
        path = Path(home) / name
        data = path.read_bytes() if path.exists() else None
        files[name] = hashlib.sha256(data).hexdigest() if data is not None else None
        if data is not None:
            atomic_bytes(folder / name, data)
    db = sqlite_path(home)
    if db:
        with closing(sqlite3.connect(db.as_uri() + '?mode=ro', uri=True)) as src:
            with closing(sqlite3.connect(folder / db.name)) as dst:
                src.backup(dst)
                if dst.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                    raise RuntimeError('SQLite backup failed validation')
    return files


def restore_files(home, backup, hashes):
    for name, expected in hashes.items():
        target = Path(home) / name
        if expected is None:
            if target.exists():
                target.unlink()
        else:
            data = (Path(backup) / name).read_bytes()
            if hashlib.sha256(data).hexdigest() != expected:
                raise ValueError('Backup fingerprint mismatch')
            atomic_bytes(target, data)


@serialized
def apply(home, specification, backup):
    require_stopped()
    initial_bytes = (Path(home) / STATE).read_bytes()
    initial_hash = hashlib.sha256(initial_bytes).hexdigest()
    state = json.loads(initial_bytes.decode('utf-8-sig'))
    validate_globals(state)
    if specification.get('schemaVersion') != 1 or specification.get('home') != str(Path(home).resolve()):
        raise ValueError('Plan version or Codex Home mismatch')
    if state[ACCOUNT]['owner'] != specification['owner']:
        raise ValueError('Target account changed')
    source = state[ACCOUNT]['inactive'].get(specification['source'])
    if source is None or digest(source) != specification['sourceHash']:
        raise ValueError('Inactive source changed')
    validate_source(source)
    if specification['keys'] != sorted(KEYS & source['globals'].keys()):
        raise ValueError('Plan fields do not match the supported allowlist')
    original = copy.deepcopy(state)
    conflicts = 0
    for key in specification['keys']:
        value = copy.deepcopy(source['globals'][key])
        if key.startswith('app-server-project'):
            value = {k: v for k, v in value.items()
                     if k.startswith('local:') and Path(k[6:]).resolve() == Path(home).resolve()}
        if key == 'thread-project-assignments':
            conflicts = sum(k in state.get(key, {}) and state[key][k] != v for k, v in value.items())
        state[key] = merge(value, state[key]) if key in state and state[key] is not None else value
    if state[ACCOUNT] != original[ACCOUNT]:
        raise RuntimeError('Inactive state or account identity changed')
    if any(state[k] != v for k, v in original.items() if k not in KEYS):
        raise RuntimeError('Unrelated state changed')
    before = backup_files(home, backup)
    if before[STATE] != initial_hash or file_hash(Path(home) / STATE) != initial_hash:
        raise RuntimeError('State changed during backup; no files written')
    require_stopped()
    if any(file_hash(Path(home) / name) != expected for name, expected in before.items()):
        raise RuntimeError('State changed after shutdown check; no files written')
    try:
        atomic_json(Path(home) / STATE, state)
        atomic_json(Path(home) / (STATE + '.bak'), state)
        if read(Path(home) / STATE) != state or read(Path(home) / (STATE + '.bak')) != state:
            raise RuntimeError('Write verification failed')
        receipt = {'status': 'RESTORED_ON_DISK', 'home': str(Path(home).resolve()),
                   'beforeHashes': before,
                   'afterHashes': {n: file_hash(Path(home) / n) for n in before},
                   'counts': summary(state), 'assignmentConflictsKeptTarget': conflicts,
                   'inactivePreserved': True, 'sqliteModified': False,
                   'uiVerification': 'NOT_RUN', 'crossAccountSharing': 'NOT_IMPLEMENTED'}
        atomic_json(Path(backup) / 'receipt.json', receipt)
        return receipt
    except Exception:
        restore_files(home, backup, before)
        raise


@serialized
def rollback(home, backup):
    require_stopped()
    receipt = read(Path(backup) / 'receipt.json')
    if set(receipt.get('beforeHashes', {})) != {STATE, STATE + '.bak'} or set(receipt.get('afterHashes', {})) != {STATE, STATE + '.bak'}:
        raise ValueError('Unsupported receipt file set')
    if receipt['home'] != str(Path(home).resolve()):
        raise ValueError('Receipt home mismatch')
    if any(file_hash(Path(home) / n) != h for n, h in receipt['afterHashes'].items()):
        raise ValueError('State changed after restore; refusing to overwrite newer data')
    for name, expected in receipt['beforeHashes'].items():
        if expected is not None and file_hash(Path(backup) / name) != expected:
            raise ValueError('Backup fingerprint mismatch')
    current = {name: (Path(home) / name).read_bytes() if (Path(home) / name).exists() else None
               for name in receipt['afterHashes']}
    if any(file_hash(Path(home) / n) != h for n, h in receipt['afterHashes'].items()):
        raise ValueError('State changed while preparing rollback')
    try:
        restore_files(home, backup, receipt['beforeHashes'])
        if any(file_hash(Path(home) / n) != h for n, h in receipt['beforeHashes'].items()):
            raise RuntimeError('Rollback verification failed')
    except Exception:
        for name, data in current.items():
            path = Path(home) / name
            expected = hashlib.sha256(data).hexdigest() if data is not None else None
            if file_hash(path) == expected:
                continue
            if data is None:
                if path.exists():
                    path.unlink()
            else:
                atomic_bytes(path, data)
        raise
    return {'status': 'ROLLED_BACK', 'sqliteModified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest='action', required=True)
    for action in ['inspect', 'plan', 'apply', 'rollback']:
        p = subs.add_parser(action)
        p.add_argument('--home', type=Path, default=Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')))
        if action == 'plan':
            p.add_argument('--source')
            p.add_argument('--out', type=Path, required=True)
        if action == 'apply':
            p.add_argument('--plan', type=Path, required=True)
        if action in ['apply', 'rollback']:
            p.add_argument('--backup-dir', type=Path, required=True)
    a = parser.parse_args()
    a.home = a.home.resolve()
    if a.action == 'inspect':
        result = inspect(a.home)
    elif a.action == 'plan':
        result = plan(a.home, a.source)
        if a.out.exists():
            raise FileExistsError('Plan output already exists')
        a.out.parent.mkdir(parents=True, exist_ok=True)
        atomic_json(a.out, result)
    elif a.action == 'apply':
        result = apply(a.home, read(a.plan), a.backup_dir)
    else:
        result = rollback(a.home, a.backup_dir)
    print(json.dumps(result, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'FAILED', 'reason': str(error)}, ensure_ascii=True), file=sys.stderr)
        sys.exit(1)
