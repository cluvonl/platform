import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const installer = fileURLToPath(new URL('../ops/install-staging-app-broker', import.meta.url));
// Import the actual installer, replacing fixed paths/account lookups only inside
// this owned temporary-filesystem harness. No production CLI path override exists.
const harness = String.raw`
import fcntl, hashlib, importlib.machinery, importlib.util, json, os
from pathlib import Path
import stat, sys, tempfile, types
sys.dont_write_bytecode = True
loader = importlib.machinery.SourceFileLoader('tested_installer', sys.argv[1])
spec = importlib.util.spec_from_loader(loader.name, loader)
m = importlib.util.module_from_spec(spec)
loader.exec_module(m)
source_sha = 'a' * 40
def digest(data): return hashlib.sha256(data).hexdigest()
with tempfile.TemporaryDirectory(prefix='cluvo-broker-install-fixture-') as owned:
    root = Path(owned)
    root.chmod(0o700)
    m.ROOT_UID, m.ROOT_GID, m.TRUST_ROOT = os.geteuid(), os.getegid(), root
    m.STATE = root / 'var/lib/cluvo-staging'
    m.DESTINATIONS = {
        'cluvo-deploy-staging': root / 'usr/local/sbin/cluvo-deploy-staging',
        'compose.staging.yml': root / 'etc/cluvo/compose.staging.yml',
        'cluvo-import-staging-config': root / 'usr/local/sbin/cluvo-import-staging-config',
    }
    m.PRIVATE_CONFIG = (root / 'etc/cluvo/staging-target.json', root / 'etc/cluvo/staging.env')
    m.SUDOERS = root / 'etc/sudoers.d/cluvo-staging-config-import'
    m.SYSTEM_SUDOERS = root / 'etc/sudoers'
    m.SUDOERS_DIRECTORY = m.SUDOERS.parent
    m.pwd.getpwnam = lambda name: types.SimpleNamespace(
        pw_uid=2000 if name == 'cluvo-staging' else 2001,
        pw_gid=2000 if name == 'cluvo-staging' else 2001)
    m.os.getgrouplist = lambda name, primary: [primary]
    for directory in (m.STATE, m.SUDOERS.parent, *(p.parent for p in m.DESTINATIONS.values())):
        directory.mkdir(parents=True, exist_ok=True)
    def write(path, data, mode=0o600):
        if path.exists(): path.chmod(0o600)
        path.write_bytes(data)
        path.chmod(mode)
    old = {
        m.DESTINATIONS['cluvo-deploy-staging']: (b'#!/usr/bin/env bash\nexit 0\n', 0o755),
        m.DESTINATIONS['compose.staging.yml']: (b'old compose fixture\n', 0o644),
        m.PRIVATE_CONFIG[0]: (b'{"app_mode":"prototype","fixture":"private"}\n', 0o600),
        m.PRIVATE_CONFIG[1]: (b'APP_MODE=prototype\nFIXTURE=synthetic-private-config\n', 0o640),
    }
    for path, (data, mode) in old.items(): write(path, data, mode)
    private_before = {p: (p.read_bytes(), m.stable(os.lstat(p))) for p in m.PRIVATE_CONFIG}
    write(m.STATE / 'deploy.lock', b'')
    bundle = root / 'bundle'
    bundle.mkdir(mode=0o700)
    contents = {
        'cluvo-deploy-staging': b'#!/usr/bin/env bash\n# reviewed synthetic fixture\nexit 0\n',
        'compose.staging.yml': b'services:\n  web:\n    image: synthetic-fixture\n',
        'cluvo-import-staging-config': b'#!/usr/bin/python3 -I\nraise SystemExit(0)\n',
        'install-staging-app-broker': Path(sys.argv[1]).read_bytes(),
    }
    manifest = {
        'format': 'cluvo-public-staging-server-bootstrap', 'source_sha': source_sha,
        'project_ref': 'fbozlbgmktkgcdfqdaaz', 'origin': 'https://staging.cluvo.nl',
        'contains_credentials': False, 'production_enabled': False,
        'files': {name: {'repo_path': 'ops/' + name, 'sha256': digest(data)}
                  for name, data in contents.items()},
    }
    for name, data in contents.items(): write(bundle / name, data)
    def update_manifest():
        data = (json.dumps(manifest, sort_keys=True) + '\n').encode()
        write(bundle / 'bootstrap-manifest.json', data)
        return digest(data)
    manifest_sha = update_manifest()
    validations = []
    m.validate_sudoers = lambda path=None: validations.append(path)
    grant_available = True
    grant_queries = []
    run_process = m.subprocess.run
    def query_process(command, **options):
        if command[0] == '/usr/bin/sudo':
            assert command == ['/usr/bin/sudo', '--non-interactive', '--list', '--other-user',
                               'fixture-runner', '--user=root', '--',
                               '/usr/local/sbin/cluvo-import-staging-config', source_sha, '1']
            assert options['stdin'] == m.subprocess.DEVNULL
            assert options['stdout'] == m.subprocess.DEVNULL
            assert options['stderr'] == m.subprocess.DEVNULL
            assert options['env'] == m.SAFE_ENV and options['timeout'] == 15
            grant_queries.append(True)
            return types.SimpleNamespace(returncode=0 if grant_available else 1)
        return run_process(command, **options)
    m.subprocess.run = query_process
    def run(): return m.install(source_sha, 'fixture-runner', bundle, manifest_sha)
    def assert_private_preserved():
        for path, (data, identity) in private_before.items():
            assert path.read_bytes() == data
            assert m.stable(os.lstat(path)) == identity
    def assert_originals_restored():
        for path, (data, mode) in old.items():
            assert path.read_bytes() == data
            assert stat.S_IMODE(os.lstat(path).st_mode) == mode
        assert not m.DESTINATIONS['cluvo-import-staging-config'].exists()
        assert not m.SUDOERS.exists()
        assert_private_preserved()
    def failure(expected):
        try: run()
        except m.InstallFailure as error: assert str(error) == expected, str(error)
        else: raise AssertionError('operation unexpectedly succeeded')
    scenario = sys.argv[2]
    if scenario == 'success':
        result = run()
        assert result['configuration_backup_created'] is True
        assert result['app_activation_performed'] is False
        assert result['database_mutations_performed'] is False
        assert result['production_enabled'] is False and result['v1_ready'] is False
        for name, destination in m.DESTINATIONS.items():
            assert destination.read_bytes() == contents[name]
            assert stat.S_IMODE(os.lstat(destination).st_mode) == m.MODES[name]
        assert_private_preserved()
        sudoers = m.SUDOERS.read_text()
        assert sudoers == ('Defaults!/usr/local/sbin/cluvo-import-staging-config !log_input, !log_output\n'
                           'fixture-runner ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-import-staging-config *\n')
        assert stat.S_IMODE(os.lstat(m.SUDOERS).st_mode) == 0o440
        backups = list((m.STATE / 'provision-backups').iterdir())
        assert len(backups) == 1 and stat.S_IMODE(os.lstat(backups[0]).st_mode) == 0o700
        record = json.loads((backups[0] / 'restore.private.json').read_text())
        for path, (data, mode) in old.items():
            original = record['files'][str(path)]
            backup_file = backups[0] / str(original['index'])
            assert backup_file.read_bytes() == data
            assert stat.S_IMODE(os.lstat(backup_file).st_mode) == 0o600
            assert original['mode'] == mode
        assert run()['configuration_backup_created'] is False
        assert len(list((m.STATE / 'provision-backups').iterdir())) == 1
        assert len(grant_queries) == 2, 'idempotent installation must also confirm effective permission'
        assert_private_preserved()
    elif scenario == 'bindings':
        trusted_sha = manifest_sha
        manifest_sha = '0' * 64
        failure('BOOTSTRAP_MANIFEST_HASH_MISMATCH')
        manifest_sha = trusted_sha
        manifest['source_sha'] = 'b' * 40
        manifest_sha = update_manifest()
        failure('INVALID_BOOTSTRAP_TARGET')
        manifest['source_sha'] = source_sha
        manifest['project_ref'] = 'b' * 20
        manifest_sha = update_manifest()
        failure('INVALID_BOOTSTRAP_TARGET')
        manifest['project_ref'] = 'fbozlbgmktkgcdfqdaaz'
        manifest_sha = update_manifest()
        write(bundle / 'compose.staging.yml', b'changed bytes')
        failure('BOOTSTRAP_FILE_HASH_MISMATCH')
        assert validations == []
        assert_originals_restored()
    elif scenario == 'paths':
        target = bundle / 'compose.staging.yml'
        target.unlink()
        target.symlink_to(m.PRIVATE_CONFIG[1])
        failure('UNTRUSTED_INSTALL_FILE')
        target.unlink()
        write(target, contents['compose.staging.yml'])
        bundle.chmod(0o755)
        failure('PRIVATE_BUNDLE_REQUIRED')
        bundle.chmod(0o700)
        runtime = m.PRIVATE_CONFIG[1]
        saved = runtime.with_name('saved-private-fixture')
        runtime.rename(saved)
        runtime.symlink_to(saved)
        failure('UNTRUSTED_INSTALL_FILE')
        runtime.unlink()
        saved.rename(runtime)
        # The fixture's own rename changes ctime; establish the baseline again
        # after removing that deliberately unsafe fixture, without blaming install.
        private_before[runtime] = (runtime.read_bytes(), m.stable(os.lstat(runtime)))
        assert_originals_restored()
    elif scenario in ('write_failure', 'rollback_failure'):
        replace = m.atomic_replace
        failed = False
        def fault(path, data, mode, uid=None, gid=None):
            global failed
            if path == m.DESTINATIONS['compose.staging.yml'] and not failed:
                failed = True
                raise OSError('synthetic write failure')
            if (scenario == 'rollback_failure' and failed
                    and path == m.DESTINATIONS['cluvo-deploy-staging']
                    and data == old[path][0]):
                raise OSError('synthetic restoration failure')
            return replace(path, data, mode, uid, gid)
        m.atomic_replace = fault
        failure('BROKER_INSTALL_ROLLBACK_FAILED' if scenario == 'rollback_failure'
                else 'BROKER_INSTALL_FAILED_RESTORED')
        assert (m.STATE / 'provision-backups').is_dir()
        assert_private_preserved()
        if scenario == 'write_failure': assert_originals_restored()
    elif scenario == 'post_validation':
        def validate(path=None):
            validations.append(path)
            if len(validations) == 3:
                raise m.InstallFailure('SUDOERS_VALIDATION_FAILED')
        m.validate_sudoers = validate
        failure('BROKER_INSTALL_FAILED_RESTORED')
        assert len(validations) == 4
        assert_originals_restored()
    elif scenario == 'grant_denied':
        # The main file has a usable direct deploy rule but does not include the
        # directory in which the new importer drop-in would otherwise be written.
        write(m.SYSTEM_SUDOERS,
              b'fixture-runner ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging\n', 0o440)
        grant_available = False
        try: m.install(source_sha, None, bundle, manifest_sha)
        except m.InstallFailure as error: assert str(error) == 'IMPORT_GRANT_UNCONFIRMED'
        else: raise AssertionError('ignored sudo drop-in reported as authorized')
        assert len(grant_queries) == 1
        assert_originals_restored()
        assert len(validations) == 4, 'rollback must revalidate the restored policy'
    elif scenario == 'unchanged_grant_denied':
        assert run()['configuration_backup_created'] is True
        installed = {path: (path.read_bytes(), m.stable(os.lstat(path)))
                     for path in (*m.DESTINATIONS.values(), m.SUDOERS)}
        grant_available = False
        failure('IMPORT_GRANT_UNCONFIRMED')
        assert len(grant_queries) == 2
        for path, (data, identity) in installed.items():
            assert path.read_bytes() == data and m.stable(os.lstat(path)) == identity
        assert len(list((m.STATE / 'provision-backups').iterdir())) == 1
        assert_private_preserved()
    elif scenario == 'lock':
        held = os.open(m.STATE / 'deploy.lock', os.O_RDWR)
        fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
        ticks = iter([31, 62])
        m.time.monotonic = lambda: next(ticks)
        try: failure('DEPLOY_LOCK_BUSY')
        finally: os.close(held)
        assert validations == []
        assert_originals_restored()
    elif scenario == 'accounts':
        try: m.install(source_sha, 'root;bad', bundle, manifest_sha)
        except m.InstallFailure as error: assert str(error) == 'INVALID_RUNNER_ACCOUNT'
        else: raise AssertionError('unsafe account accepted')
        m.pwd.getpwnam = lambda name: types.SimpleNamespace(pw_uid=2000)
        failure('DEDICATED_RUNNER_REQUIRED')
        m.pwd.getpwnam = lambda name: types.SimpleNamespace(
            pw_uid=2000 if name == 'cluvo-staging' else 2001,
            pw_gid=2000 if name == 'cluvo-staging' else 2001)
        m.os.getgrouplist = lambda name, primary: [primary, 2000]
        failure('RUNNER_RUNTIME_GROUP_MUST_BE_SEPARATE')
        assert validations == []
        assert_originals_restored()
    elif scenario == 'derive_runner':
        write(m.SYSTEM_SUDOERS, b'@includedir /etc/sudoers.d\n', 0o440)
        write(m.SUDOERS_DIRECTORY / 'cluvo-existing-deploy',
              b'fixture-runner ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging *\n', 0o440)
        # An ignored editor backup must not introduce a second candidate.
        write(m.SUDOERS_DIRECTORY / 'cluvo-existing-deploy.backup',
              b'wrong-fixture ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging\n', 0o440)
        result = m.install(source_sha, None, bundle, manifest_sha)
        assert result['configuration_backup_created'] is True
        assert 'fixture-runner' not in json.dumps(result)
        assert m.SUDOERS.read_text().endswith(
            'fixture-runner ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-import-staging-config *\n')
        assert m.install(source_sha, None, bundle, manifest_sha)['configuration_backup_created'] is False
        assert_private_preserved()
    elif scenario == 'ambiguous_runner':
        for policy in (
            b'fixture-runner ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging\n'
            b'other-fixture ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging\n',
            b'%fixture-group ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging\n',
            b'FIXTURE_ALIAS ALL=(root) NOPASSWD: /usr/local/sbin/cluvo-deploy-staging\n',
            b'fixture-runner ALL=(root) NOPASSWD: /bin/true, /usr/local/sbin/cluvo-deploy-staging\n',
        ):
            write(m.SYSTEM_SUDOERS, policy, 0o440)
            try: m.install(source_sha, None, bundle, manifest_sha)
            except m.InstallFailure as error: assert str(error) == 'RUNNER_USER_REQUIRED'
            else: raise AssertionError('ambiguous or indirect runner recognized')
        assert validations == []
        assert_originals_restored()
    else: raise AssertionError('unknown test scenario')
    print(json.dumps({'scope': 'SYNTHETIC_INSTALL_FILESYSTEM_ONLY', 'scenario': scenario, 'passed': True}))
`;

function probe(scenario) {
  const result = spawnSync('python3', ['-I', '-', installer, scenario], {
    input: harness, encoding: 'utf8', timeout: 15_000, maxBuffer: 64_000,
    env: {PATH: process.env.PATH, LANG: 'C.UTF-8'},
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    scope: 'SYNTHETIC_INSTALL_FILESYSTEM_ONLY', scenario, passed: true,
  });
}

test('installs the reviewed three files and narrow sudo rule, privately backs up configuration, and repeats without changes', () => probe('success'));
test('source/project/manifest/file mismatches stop before host validation or mutation', () => probe('bindings'));
test('symlinked files and a public bundle directory are refused', () => probe('paths'));
test('a partial file-write failure restores existing broker and compose with their modes', () => probe('write_failure'));
test('a failed final sudoers validation removes new files and restores previous files', () => probe('post_validation'));
test('a restoration failure is reported without claiming recovery and keeps the private backup', () => probe('rollback_failure'));
test('a held deploy lock prevents all installation mutations', () => probe('lock'));
test('injected and runtime-shared runner accounts fail before installation', () => probe('accounts'));
test('one existing direct broker sudo rule selects the runner without publishing its identity', () => probe('derive_runner'));
test('ambiguous, group, alias and command-list sudo rules require an explicit runner account', () => probe('ambiguous_runner'));
test('an ineffective sudo drop-in is refused and all installation mutations are restored', () => probe('grant_denied'));
test('an unchanged installation rechecks effective permission and cannot report success after authorization is lost', () => probe('unchanged_grant_denied'));
