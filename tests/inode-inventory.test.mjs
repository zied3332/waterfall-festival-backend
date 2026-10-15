import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  realpath,
  symlink,
  link,
  rm,
  chmod,
} from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  inventory,
  sanitizeInventory,
} from '../scripts/deploy/inode-inventory.mjs';
const release = 'release-aaaaaaaaaaaa-100-abcd';
const backup = 'backend-20261015-090000';
async function fixture(t) {
  const home = await realpath(
    await mkdtemp(join(tmpdir(), 'waterfall-inode-test-')),
  );
  t.after(async () => {
    assert.ok(basename(home).startsWith('waterfall-inode-test-'));
    await rm(home, { recursive: true, force: true });
  });
  const put = async (path, text = 'PRIVATE') => {
    await mkdir(join(home, path, '..'), { recursive: true });
    await writeFile(join(home, path), text);
  };
  await put('waterfall-backend/uploads/gallery/images/keep.jpg');
  await put('waterfall-backend/.env');
  await put(`waterfall-releases/${release}/dist/src/main.js`);
  await put(`waterfall-releases/${release}/node_modules/library/main.js`);
  await symlink(
    join(home, 'waterfall-releases', release, 'dist'),
    join(home, 'waterfall-backend/dist'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await symlink(
    join(home, 'waterfall-releases', release, 'node_modules'),
    join(home, 'waterfall-backend/node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await put('.npm/_cacache/a');
  await put('.npm/_cacache/b');
  await put(`waterfall-backups/${backup}/node_modules/library/index.js`);
  await put(`waterfall-backups/${backup}/.env`);
  await put('.waterfall-incoming-123-1/backend.tar.gz');
  return { home, put };
}
test('inventory distinguishes active roots, cache, backup copies and incoming artifacts without changing files', async (t) => {
  const { home } = await fixture(t);
  const reports = [];
  const before = await readdir(home);
  await inventory(home, (row) => reports.push(row));
  const target = (name) => reports.find((row) => row.target === name);
  assert.equal(target('.npm').regularFiles, 2);
  assert.equal(target('.npm').uniqueInodes, 4);
  assert.equal(target('.npm').policy, 'explicit_review_required');
  assert.equal(target('waterfall-backend').policy, 'never_delete');
  assert.equal(target('active-dependencies-1').policy, 'never_delete');
  assert.equal(target(`waterfall-releases/${release}`).policy, 'never_delete');
  assert.equal(
    target(`waterfall-backups/${backup}`).policy,
    'never_delete_whole_tree',
  );
  assert.equal(
    target(`waterfall-backups/${backup}/node_modules`).category,
    'backup_dependency_copy',
  );
  assert.equal(
    target('incoming/.waterfall-incoming-123-1').category,
    'incoming_artifact',
  );
  assert.equal(reports.at(-1).countsAreNotAdditive, true);
  assert.equal(reports[0].accountQuotaMeasured, false);
  assert.deepEqual(await readdir(home), before);
  assert.equal(
    await readFile(join(home, 'waterfall-backend/.env'), 'utf8'),
    'PRIVATE',
  );
  assert.ok(!JSON.stringify(reports).includes(home));
  assert.ok(!JSON.stringify(reports).includes('keep.jpg'));
  assert.ok(!JSON.stringify(reports).includes('PRIVATE'));
});
test('hardlinks are deduplicated within a row; symlinks are not followed', async (t) => {
  const { home } = await fixture(t);
  await link(join(home, '.npm/_cacache/a'), join(home, '.npm/_cacache/c'));
  await symlink(
    join(home, 'waterfall-backend'),
    join(home, '.npm/app-link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const rows = [];
  await inventory(home, (row) => rows.push(row));
  const cache = rows.find((row) => row.target === '.npm');
  assert.equal(cache.regularFiles, 3);
  assert.equal(cache.hardLinkedFiles, 2);
  assert.equal(cache.symlinks, 1);
  assert.equal(cache.uniqueInodes, 5);
});
test('scan limits produce partial reports rather than invented complete counts', async (t) => {
  const { home } = await fixture(t);
  const rows = [];
  await inventory(home, (row) => rows.push(row), { maxEntries: 2 });
  assert.equal(rows.at(-1).status, 'partial');
  assert.ok(rows.some((row) => row.errorCode === 'LIMIT_REACHED'));
  assert.ok(rows.at(-1).visitedEntries <= 2);
});
test('unsafe/unrecognized input lines cannot leak paths, usernames, environment values or arbitrary names', () => {
  const report = sanitizeInventory(
    JSON.stringify({
      schema: 'waterfall_inode_inventory_v1',
      kind: 'candidate',
      target: '/home/PRIVATE/.npm',
      category: 'npm_cache',
      policy: 'explicit_review_required',
      entries: 12,
      path: 'PRIVATE',
      secret: 'PRIVATE',
      deletionPerformed: true,
    }),
  );
  assert.equal(report.entries, 12);
  assert.equal(report.target, undefined);
  assert.ok(!JSON.stringify(report).includes('PRIVATE'));
  assert.equal(report.deletionPerformed, undefined);
  assert.equal(sanitizeInventory('PRIVATE raw shell error'), null);
});
test('module imports only read-only production filesystem operations and workflow has only a manual trigger', () => {
  const source = readFileSync('scripts/deploy/inode-inventory.mjs', 'utf8');
  assert.doesNotMatch(
    source,
    /\b(?:mkdir|unlink|writeFile|chmod|rename|rmdir)\b|from 'node:child_process'/,
  );
  const workflow = readFileSync(
    '.github/workflows/backend-inode-inventory.yml',
    'utf8',
  );
  assert.match(workflow, /on:\s*\n\s+workflow_dispatch:\s*\n\npermissions:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(
    workflow,
    /workflow_run|push:|PRODUCTION_DATABASE_URL|CPANEL_API_TOKEN|cpanel-deploy\.sh/,
  );
  const wrapper = readFileSync('scripts/deploy/inode-inventory.sh', 'utf8');
  assert.match(wrapper, /--inventory 2>&1/);
  assert.doesNotMatch(
    wrapper,
    /--deploy|--prepare-incoming|--probe-incoming|\bscp\b/,
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
test(
  'SSH wrapper streams only inventory code, suppresses raw errors, and cleans only runner fixtures',
  { skip: !existsSync(bash) },
  async (t) => {
    const { home } = await fixture(t);
    const bin = join(home, 'mock-bin'),
      runner = join(home, 'runner');
    await mkdir(bin);
    await mkdir(runner);
    const mock = {
      'ssh-agent':
        '#!/bin/sh\nif [ "$1" = "-k" ];then exit 0;fi\nprintf "SSH_AGENT_PID=99999; export SSH_AGENT_PID;\\n"\n',
      'ssh-add': '#!/bin/sh\nexit 0\n',
      setsid: '#!/bin/sh\nexec "$@"\n',
      ssh: `#!/bin/sh
for arg do last="$arg";done
expected='source "$HOME/nodevenv/waterfall-backend/22/bin/activate" >/dev/null 2>&1 && node --input-type=module - --inventory 2>&1'
[ "$last" = "$expected" ] || exit 99
cat > "$CAPTURE"
echo 'PRIVATE-SSH-ERROR' >&2
echo 'PRIVATE-REMOTE-ERROR'
echo '{"schema":"waterfall_inode_inventory_v1","kind":"summary","status":"complete","deletionPerformed":false,"secret":"PRIVATE"}'
`,
    };
    for (const [file, body] of Object.entries(mock)) {
      await writeFile(join(bin, file), body);
      await chmod(join(bin, file), 0o700);
    }
    const capture = join(home, 'streamed-code');
    const result = spawnSync(
      bash,
      ['-c', 'export PATH="$MOCK_BIN:$PATH";bash "$INVENTORY_SCRIPT"'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 20000,
        env: {
          ...process.env,
          MOCK_BIN: posix(bin),
          INVENTORY_SCRIPT: posix(resolve('scripts/deploy/inode-inventory.sh')),
          CAPTURE: posix(capture),
          RUNNER_TEMP: posix(runner),
          SSH_PORT: '22',
          SSH_USER: 'fixture',
          SSH_HOST: 'fixture.invalid',
          SSH_PRIVATE_KEY: 'PRIVATE-KEY',
          SSH_PASSPHRASE: 'PRIVATE-PASS',
        },
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('PRIVATE'));
    assert.equal(
      await readFile(capture, 'utf8'),
      readFileSync('scripts/deploy/inode-inventory.mjs', 'utf8'),
    );
    assert.deepEqual(await readdir(runner), []);
  },
);

test('cache that backs active dependencies is protected and unknown runtime protects all releases', async (t) => {
  const { home, put } = await fixture(t);
  await put(
    'waterfall-releases/release-bbbbbbbbbbbb-200-abcd/dist/src/main.js',
  );
  // A separate application without dist deliberately cannot establish the active release.
  const empty = await realpath(
    await mkdtemp(join(tmpdir(), 'waterfall-inode-test-')),
  );
  t.after(async () => {
    assert.ok(basename(empty).startsWith('waterfall-inode-test-'));
    await rm(empty, { recursive: true, force: true });
  });
  await mkdir(join(empty, 'waterfall-releases/release-cccccccccccc-300-abcd'), {
    recursive: true,
  });
  const unresolved = [];
  await inventory(empty, (row) => unresolved.push(row));
  assert.equal(
    unresolved.find(
      (row) =>
        row.target === 'waterfall-releases/release-cccccccccccc-300-abcd',
    ).policy,
    'never_delete',
  );
  // Point an additional known app's active node_modules at its real .npm cache.
  await mkdir(join(empty, 'waterfall-backend/dist'), { recursive: true });
  await mkdir(join(empty, '.npm'));
  await writeFile(join(empty, '.npm/cache'), 'keep');
  await symlink(
    join(empty, '.npm'),
    join(empty, 'waterfall-backend/node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const protectedRows = [];
  await inventory(empty, (row) => protectedRows.push(row));
  assert.equal(
    protectedRows.find((row) => row.target === '.npm').policy,
    'never_delete',
  );
});

test('symlinked backup container is never traversed', async (t) => {
  const { home } = await fixture(t);
  const other = join(home, 'other');
  await mkdir(other);
  const alias = join(home, 'alias-home');
  await mkdir(alias);
  await symlink(
    join(home, 'waterfall-backups'),
    join(alias, 'waterfall-backups'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const rows = [];
  await inventory(alias, (row) => rows.push(row));
  assert.equal(
    rows.find((row) => row.target === 'waterfall-backups').status,
    'symlink_not_followed',
  );
  assert.ok(!rows.some((row) => row.target === `waterfall-backups/${backup}`));
});
