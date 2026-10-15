import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  realpath,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
  open,
  unlink,
  chmod,
  symlink,
} from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  prepareIncoming,
  probeIncoming,
  verifyIncomingUpload,
  uploadErrorCategory,
} from '../scripts/deploy/backend-deploy.mjs';
const name = '.waterfall-incoming-123-1';
async function fixture(t) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'waterfall-upload-test-')),
  );
  t.after(async () => {
    assert.ok(basename(root).startsWith('waterfall-upload-test-'));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
test('creates a fresh verified incoming directory, fsyncs a small probe and removes only that probe', async (t) => {
  const home = await fixture(t);
  await writeFile(join(home, 'keep'), 'keep');
  const result = await prepareIncoming(home, name);
  assert.equal(result.path, join(home, name));
  assert.equal(result.probeBytes, 4096);
  assert.equal(result.accountQuotaVerified, false);
  assert.deepEqual(await readdir(result.path), []);
  assert.equal(await readFile(join(home, 'keep'), 'utf8'), 'keep');
  await assert.rejects(
    prepareIncoming(home, name),
    (error) => error.code === 'EEXIST' && !error.message.includes(home),
  );
  await assert.rejects(prepareIncoming(home, '../uploads'), /Invalid incoming/);
});
test('quota and permission failures are sanitized and only a successfully opened probe is cleaned up', async (t) => {
  const home = await fixture(t);
  await prepareIncoming(home, name);
  const calls = [];
  await assert.rejects(
    probeIncoming(home, name, {
      access: async () => {},
      open: async () => {
        throw Object.assign(Error('SECRET'), { code: 'EACCES' });
      },
      unlink: async () => {
        throw Error('must not unlink');
      },
    }),
    (e) => e.code === 'EACCES' && !e.message.includes('SECRET'),
  );
  await assert.rejects(
    probeIncoming(home, name, {
      access: async () => {},
      open: async (path) => {
        calls.push(['open', path]);
        return {
          writeFile: async () => {
            throw Object.assign(Error('SECRET'), { code: 'EDQUOT' });
          },
          sync: async () => {},
          close: async () => calls.push(['close']),
        };
      },
      unlink: async (path) => calls.push(['unlink', path]),
    }),
    (e) => e.code === 'EDQUOT' && !e.message.includes('SECRET'),
  );
  assert.equal(calls.at(-1)[0], 'unlink');
  assert.equal(calls[0][1], calls.at(-1)[1]);
  assert.match(basename(calls[0][1]), /^\.write-probe-[a-f0-9]{32}$/);
  assert.deepEqual(await readdir(join(home, name)), []);
});
test('rejects symlinked incoming directories and verifies uploaded archive type and exact size', async (t) => {
  const home = await fixture(t);
  await mkdir(join(home, 'other'));
  await symlink(
    join(home, 'other'),
    join(home, name),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(probeIncoming(home, name), /directory verification/);
  assert.deepEqual(await readdir(join(home, 'other')), []);
  const second = '.waterfall-incoming-123-2';
  await prepareIncoming(home, second);
  await writeFile(join(home, second, 'backend.tar.gz'), 'archive');
  assert.equal(
    (await verifyIncomingUpload(home, second, 7)).status,
    'verified',
  );
  await assert.rejects(
    verifyIncomingUpload(home, second, 8),
    /archive verification/,
  );
});
test('SFTP failure remains unknown unless explicit error evidence exists', () => {
  assert.equal(
    uploadErrorCategory('scp: dest open private-path: Failure'),
    'sftp_upload_failed_unknown',
  );
  assert.equal(
    uploadErrorCategory('Disk quota exceeded SECRET'),
    'account_quota_exceeded',
  );
  assert.equal(
    uploadErrorCategory('Permission denied SECRET'),
    'permission_denied',
  );
  assert.equal(
    uploadErrorCategory('No space left on device'),
    'space_or_inode_exhaustion',
  );
});
const bash =
  process.platform === 'win32'
    ? 'C:/Program Files/Git/bin/bash.exe'
    : '/bin/bash';
const posix = (path) =>
  process.platform === 'win32'
    ? path
        .replaceAll('\\', '/')
        .replace(/^([A-Za-z]):/, (_, drive) => '/' + drive.toLowerCase())
    : path;
for (const mode of [
  'success',
  'prepare-failure',
  'invalid-path',
  'scp-failure',
  'verify-failure',
]) {
  test(
    `mocked upload ${mode}: absolute SCP path, safe order, no deployment after failure`,
    { skip: !existsSync(bash) },
    async (t) => {
      const root = await fixture(t);
      const bin = join(root, 'bin'),
        runner = join(root, 'runner'),
        home = join(root, 'home');
      for (const dir of [bin, runner, home]) await mkdir(dir);
      const events = join(root, 'events');
      const incoming = '/home/fixture/' + name;
      const mocks = {
        git: '#!/bin/sh\nprintf "%040d\\n" 1\n',
        'ssh-agent':
          '#!/bin/sh\nif [ "$1" = "-k" ];then exit 0;fi\nprintf "SSH_AGENT_PID=99999; export SSH_AGENT_PID;\\n"\n',
        'ssh-add': '#!/bin/sh\nexit 0\n',
        setsid: '#!/bin/sh\nexec "$@"\n',
        scp: `#!/bin/sh
for arg do last="$arg";done
[ "$last" = "fixture@fixture.invalid:${incoming}/backend.tar.gz" ] || exit 99
printf 'scp\\n' >> "$EVENTS"
if [ "$MODE" = scp-failure ];then printf 'scp: private-path SECRET: Failure\\n' >&2;exit 1;fi
`,
        ssh: `#!/bin/sh
for arg do last="$arg";done
case "$last" in
 *--preflight*) printf 'preflight\\n' >> "$EVENTS";cat >/dev/null;printf '{"scope":"filesystem_only"}\\n';;
 *--prepare-incoming*) printf 'prepare\\n' >> "$EVENTS";cat >/dev/null;if [ "$MODE" = prepare-failure ];then echo 'Incoming upload write probe failed (EDQUOT).' >&2;exit 1;fi;if [ "$MODE" = invalid-path ];then echo '/home/fixture/../uploads';else echo '${incoming}';fi;;
 *--verify-incoming*) printf 'verify\\n' >> "$EVENTS";cat >/dev/null;if [ "$MODE" = verify-failure ];then exit 1;fi;;
 *--probe-incoming*) printf 'probe\\n' >> "$EVENTS";cat >/dev/null;;
 *--deploy*) printf 'deploy\\n' >> "$EVENTS";cat >/dev/null;case "$last" in *'"${incoming}"'*) :;;*) exit 98;;esac;;
 *database-url*) printf 'credential\\n' >> "$EVENTS";case "$last" in rm*) :;;*) cat >/dev/null;;esac;;
 *) exit 97;;
esac
`,
      };
      for (const [file, body] of Object.entries(mocks)) {
        await writeFile(join(bin, file), body);
        await chmod(join(bin, file), 0o700);
      }
      const result = spawnSync(
        bash,
        [
          '-c',
          'export PATH="$MOCK_BIN:$PATH"; export HOME="$MOCK_HOME"; bash "$DEPLOY_SCRIPT"',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 20000,
          env: {
            ...process.env,
            MOCK_BIN: posix(bin),
            MOCK_HOME: posix(home),
            DEPLOY_SCRIPT: posix(resolve('scripts/deploy/cpanel-deploy.sh')),
            EVENTS: posix(events),
            MODE: mode,
            RUNNER_TEMP: posix(runner),
            HOME: posix(home),
            SSH_USER: 'fixture',
            SSH_HOST: 'fixture.invalid',
            SSH_PORT: '22',
            SSH_PRIVATE_KEY: 'FIXTURE-KEY',
            SSH_PASSPHRASE: 'FIXTURE-PASS',
            PRODUCTION_DATABASE_URL: 'FIXTURE-DATABASE',
            archiveBytes: '7',
            sourceBytes: '100',
            sourceFiles: '10',
            BACKEND_BACKUP_KEEP: '5',
            BACKEND_DEPLOY_RESERVE_MB: '1024',
            BACKEND_DEPLOY_RESERVE_INODES: '50000',
            GITHUB_RUN_ID: '123',
            GITHUB_RUN_ATTEMPT: '1',
          },
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, mode === 'success' ? 0 : 1, result.stderr);
      const order = (await readFile(events, 'utf8')).trim().split('\n');
      assert.deepEqual(order.slice(0, 2), ['preflight', 'prepare']);
      assert.equal(order.includes('deploy'), mode === 'success');
      if (['prepare-failure', 'invalid-path'].includes(mode))
        assert.equal(order.includes('scp'), false);
      if (mode === 'success')
        assert.deepEqual(order.slice(0, 5), [
          'preflight',
          'prepare',
          'scp',
          'verify',
          'credential',
        ]);
      if (mode === 'scp-failure') {
        assert.ok(order.includes('probe'));
        assert.ok(result.stderr.includes('sftp_upload_failed_unknown'));
        assert.ok(!result.stderr.includes('SECRET'));
      }
    },
  );
}

test('fsync quota failure removes the actual probe; cleanup failure stops with a safe message', async (t) => {
  const home = await fixture(t);
  await prepareIncoming(home, name);
  await assert.rejects(
    probeIncoming(home, name, {
      access: async () => {},
      unlink,
      open: async (path) => {
        const handle = await open(path, 'wx', 0o600);
        return {
          writeFile: handle.writeFile.bind(handle),
          close: handle.close.bind(handle),
          sync: async () => {
            throw Object.assign(Error('PRIVATE'), { code: 'EDQUOT' });
          },
        };
      },
    }),
    (error) => error.code === 'EDQUOT' && !error.message.includes('PRIVATE'),
  );
  assert.deepEqual(await readdir(join(home, name)), []);
  await assert.rejects(
    probeIncoming(home, name, {
      access: async () => {},
      open,
      unlink: async () => {
        throw Object.assign(Error('PRIVATE'), { code: 'EACCES' });
      },
    }),
    (error) =>
      error.code === 'EACCES' &&
      error.message.includes('probe cleanup') &&
      !error.message.includes('PRIVATE'),
  );
  const retained = await readdir(join(home, name));
  assert.equal(retained.length, 1);
  assert.match(retained[0], /^\.write-probe-[a-f0-9]{32}$/);
});
