import copy
from contextlib import closing
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('projects', Path(__file__).with_name('projects.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='fix-codex-project-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / 'home'
        self.home.mkdir()
        self.backup = self.root / 'backup'
        self.source = {
            'globals': {
                'local-projects': {'old': {'id': 'old', 'name': '旧项目', 'rootPaths': [str(self.root)]}},
                'electron-saved-workspace-roots': [str(self.root)],
                'active-workspace-roots': [str(self.root)],
                'thread-project-assignments': {
                    't-old': {'projectKind': 'local', 'projectId': 'old'},
                    't-conflict': {'projectKind': 'local', 'projectId': 'old'}},
                'project-order': ['old'],
                'app-server-project-id-by-legacy-project-id-by-host': {
                    'local:' + str(self.home): {'old': 'db-old'},
                    'ssh:remote': {'remote-old': 'remote-new'}},
            }, 'atoms': {'private-draft': 'preserve-only'},
        }
        self.state = {
            p.ACCOUNT: {'owner': 'target', 'inactive': {'source': self.source}},
            'local-projects': {'new': {'id': 'new', 'name': 'new', 'rootPaths': [str(self.home)]}},
            'thread-project-assignments': {
                't-new': {'projectKind': 'local', 'projectId': 'new'},
                't-conflict': {'projectKind': 'local', 'projectId': 'new'}},
            'project-order': ['new'], 'unrelated-setting': {'value': 123},
        }
        self.write()
        with closing(sqlite3.connect(self.home / 'state_5.sqlite')) as c, c:
            c.execute('CREATE TABLE threads (id TEXT, project_id TEXT, creator_account_id TEXT)')
            c.execute('INSERT INTO threads VALUES (?,?,?)', ('t-old', None, 'creator'))
            c.execute('CREATE TABLE projects(id TEXT)')
            c.execute('INSERT INTO projects VALUES (?)', ('db-old',))
        self.db_hash = p.file_hash(self.home / 'state_5.sqlite')
        self.guard = patch.object(p, 'desktop_running', return_value=False)
        self.guard.start()
        self.addCleanup(self.guard.stop)

    def write(self):
        p.atomic_json(self.home / p.STATE, self.state)
        p.atomic_json(self.home / (p.STATE + '.bak'), self.state)

    def test_readonly_inspect_and_cli_plan(self):
        before = p.file_hash(self.home / p.STATE)
        info = p.inspect(self.home)
        self.assertEqual(info['sqlite']['threads'], 1)
        self.assertEqual(info['scopes'][1]['existingRootPathEntries'], 1)
        out = self.root / 'plan.json'
        cmd = [sys.executable, '-B', str(Path(p.__file__)), 'plan', '--home', str(self.home), '--out', str(out)]
        done = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(p.read(out)['owner'], 'target')
        self.assertEqual(p.file_hash(self.home / p.STATE), before)

    def test_merge_backup_and_rollback(self):
        before = {n: (self.home / n).read_bytes() for n in [p.STATE, p.STATE + '.bak']}
        receipt = p.apply(self.home, p.plan(self.home), self.backup)
        merged = p.read(self.home / p.STATE)
        self.assertEqual(set(merged['local-projects']), {'old', 'new'})
        self.assertEqual(merged['project-order'], ['new', 'old'])
        self.assertEqual(merged[p.ACCOUNT], self.state[p.ACCOUNT])
        self.assertEqual(merged['unrelated-setting'], self.state['unrelated-setting'])
        self.assertEqual(merged['thread-project-assignments']['t-conflict']['projectId'], 'new')
        self.assertIn('t-old', merged['thread-project-assignments'])
        self.assertNotIn('ssh:remote', merged['app-server-project-id-by-legacy-project-id-by-host'])
        self.assertEqual(receipt['assignmentConflictsKeptTarget'], 1)
        self.assertEqual(p.file_hash(self.home / 'state_5.sqlite'), self.db_hash)
        with closing(sqlite3.connect(self.backup / 'state_5.sqlite')) as c:
            self.assertEqual(c.execute('PRAGMA quick_check').fetchone()[0], 'ok')
            self.assertEqual(c.execute('SELECT count(*) FROM threads').fetchone()[0], 1)
        p.rollback(self.home, self.backup)
        for n, data in before.items():
            self.assertEqual((self.home / n).read_bytes(), data)

    def test_target_identity_drift(self):
        plan = p.plan(self.home)
        self.state[p.ACCOUNT]['owner'] = 'other'
        self.write()
        with self.assertRaisesRegex(ValueError, 'Target account changed'):
            p.apply(self.home, plan, self.backup)
        self.assertFalse(self.backup.exists())

    def test_source_drift(self):
        plan = p.plan(self.home)
        self.state[p.ACCOUNT]['inactive']['source']['atoms']['changed'] = True
        self.write()
        with self.assertRaisesRegex(ValueError, 'Inactive source changed'):
            p.apply(self.home, plan, self.backup)

    def test_multiple_sources_and_unknown_target(self):
        self.state[p.ACCOUNT]['inactive']['second'] = copy.deepcopy(self.source)
        self.write()
        with self.assertRaisesRegex(ValueError, 'ambiguous'):
            p.plan(self.home)
        self.assertEqual(p.plan(self.home, 'source')['source'], 'source')
        self.state[p.ACCOUNT]['owner'] = None
        self.write()
        with self.assertRaisesRegex(ValueError, 'not established'):
            p.plan(self.home, 'source')

    def test_live_desktop_blocks_mutation(self):
        with patch.object(p, 'desktop_running', return_value=True):
            with self.assertRaisesRegex(RuntimeError, 'still running'):
                p.apply(self.home, p.plan(self.home), self.backup)
        self.assertFalse(self.backup.exists())

    def test_second_write_failure_reverts_first(self):
        original = (self.home / p.STATE).read_bytes()
        real = p.atomic_json
        def fail_second(path, value):
            if Path(path) == self.home / (p.STATE + '.bak'):
                raise OSError('injected second write failure')
            return real(path, value)
        with patch.object(p, 'atomic_json', side_effect=fail_second):
            with self.assertRaisesRegex(OSError, 'injected'):
                p.apply(self.home, p.plan(self.home), self.backup)
        self.assertEqual((self.home / p.STATE).read_bytes(), original)
        self.assertEqual((self.home / (p.STATE + '.bak')).read_bytes(), original)

    def test_rollback_rejects_newer_data(self):
        p.apply(self.home, p.plan(self.home), self.backup)
        updated = p.read(self.home / p.STATE)
        updated['new-setting'] = True
        p.atomic_json(self.home / p.STATE, updated)
        with self.assertRaisesRegex(ValueError, 'newer data'):
            p.rollback(self.home, self.backup)
        self.assertTrue(p.read(self.home / p.STATE)['new-setting'])

    def test_no_original_bak_and_existing_backup_directory(self):
        (self.home / (p.STATE + '.bak')).unlink()
        plan = p.plan(self.home)
        p.apply(self.home, plan, self.backup)
        with self.assertRaises(FileExistsError):
            p.apply(self.home, plan, self.backup)
        p.rollback(self.home, self.backup)
        self.assertFalse((self.home / (p.STATE + '.bak')).exists())

    def test_unknown_schema_and_remote_assignments_rejected(self):
        self.source['globals']['thread-project-assignments']['t-old']['projectKind'] = 'remote'
        self.write()
        with self.assertRaisesRegex(ValueError, 'non-local'):
            p.plan(self.home)

    def test_local_only_skips_remote_membership_preserves_source_and_target(self):
        self.source['globals']['thread-project-assignments']['t-remote'] = {
            'projectKind': 'remote', 'projectId': 'remote', 'hostId': 'ssh:remote'}
        self.source['globals']['thread-workspace-root-hints'] = {'t-remote': '/remote', 't-old': 'local'}
        self.state['thread-project-assignments']['target-remote'] = {
            'projectKind': 'remote', 'projectId': 'keep'}
        self.write()
        specification = p.plan(self.home, local_only=True)
        self.assertEqual(specification['sourceCounts']['thread-project-assignments'], 2)
        p.apply(self.home, specification, self.backup)
        merged = p.read(self.home / p.STATE)
        self.assertNotIn('t-remote', merged['thread-project-assignments'])
        self.assertNotIn('t-remote', merged['thread-workspace-root-hints'])
        self.assertIn('target-remote', merged['thread-project-assignments'])
        self.assertEqual(merged[p.ACCOUNT], self.state[p.ACCOUNT])
        self.assertEqual(p.file_hash(self.home / 'state_5.sqlite'), self.db_hash)

    def test_local_only_still_rejects_unknown_assignment_schema(self):
        self.source['globals']['thread-project-assignments']['t-old']['projectKind'] = 'unknown'
        self.write()
        with self.assertRaisesRegex(ValueError, 'non-local'):
            p.plan(self.home, local_only=True)

    def test_unknown_target_field_schema_rejected(self):
        self.state['local-projects'] = ['unexpected-new-schema']
        self.write()
        with self.assertRaisesRegex(ValueError, 'Unsupported field schema'):
            p.plan(self.home)

    def test_wal_backup_includes_committed_rows(self):
        c = sqlite3.connect(self.home / 'state_5.sqlite')
        try:
            c.execute('PRAGMA journal_mode=WAL')
            c.execute('INSERT INTO threads VALUES (?,?,?)', ('wal', None, 'creator'))
            c.commit()
            p.apply(self.home, p.plan(self.home), self.backup)
            with closing(sqlite3.connect(self.backup / 'state_5.sqlite')) as saved:
                self.assertEqual(saved.execute('SELECT count(*) FROM threads').fetchone()[0], 2)
        finally:
            c.close()

    def test_external_writer_during_backup_is_rejected(self):
        real = p.backup_files
        def changed_before_backup(home, folder):
            value = p.read(home / p.STATE)
            value['external-change'] = True
            p.atomic_json(home / p.STATE, value)
            return real(home, folder)
        with patch.object(p, 'backup_files', side_effect=changed_before_backup):
            with self.assertRaisesRegex(RuntimeError, 'State changed during backup'):
                p.apply(self.home, p.plan(self.home), self.backup)
        self.assertTrue(p.read(self.home / p.STATE)['external-change'])

    def test_writer_during_final_shutdown_check_is_rejected(self):
        calls = 0
        def guard():
            nonlocal calls
            calls += 1
            if calls == 2:
                value = p.read(self.home / p.STATE)
                value['late-writer'] = True
                p.atomic_json(self.home / p.STATE, value)
        with patch.object(p, 'require_stopped', side_effect=guard):
            with self.assertRaisesRegex(RuntimeError, 'after shutdown check'):
                p.apply(self.home, p.plan(self.home), self.backup)
        self.assertTrue(p.read(self.home / p.STATE)['late-writer'])

    def test_concurrent_restore_lock_rejects_mutation(self):
        with p.exclusive_restore(self.home):
            with self.assertRaises(FileExistsError):
                p.apply(self.home, p.plan(self.home), self.backup)
        self.assertFalse(self.backup.exists())
        self.assertFalse((self.home / '.fix-codex-project.lock').exists())

    def test_rollback_failure_restores_pre_rollback_state(self):
        p.apply(self.home, p.plan(self.home), self.backup)
        current = {name: (self.home / name).read_bytes() for name in [p.STATE, p.STATE + '.bak']}
        real = p.atomic_bytes
        def fail_bak(path, data):
            if Path(path) == self.home / (p.STATE + '.bak'):
                raise OSError('injected rollback second write failure')
            return real(path, data)
        with patch.object(p, 'atomic_bytes', side_effect=fail_bak):
            with self.assertRaisesRegex(OSError, 'rollback second'):
                p.rollback(self.home, self.backup)
        for name, data in current.items():
            self.assertEqual((self.home / name).read_bytes(), data)


if __name__ == '__main__':
    unittest.main(verbosity=2)
