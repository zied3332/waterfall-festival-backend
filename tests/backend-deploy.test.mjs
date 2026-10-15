import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  realpath,
  lstat,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import {
  codeManifest,
  archiveCode,
  run,
  checkHeadroom,
  preflight,
  retentionReport,
  deploy,
} from '../scripts/deploy/backend-deploy.mjs';
const revision = 'a'.repeat(40);
const sizes = { archiveBytes: 100, sourceBytes: 100, sourceFiles: 10 };
async function fixture(t) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'waterfall-deploy-test-')),
  );
  t.after(async () => {
    assert.equal(resolve(root), root);
    assert.ok(basename(root).startsWith('waterfall-deploy-test-'));
    await rm(root, { recursive: true, force: true });
  });
  const app = join(root, 'waterfall-backend');
  const source = join(root, 'source');
  async function put(base, name, value) {
    const target = join(base, name);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, value);
  }
  for (const base of [app, source]) {
    await put(
      base,
      'dist/src/main.js',
      `console.log('${base === app ? 'old' : 'new'}');`,
    );
    await put(base, 'src/main.ts', 'export {};');
    await put(
      base,
      'prisma/migrations/20261015000000_gallery_cleanup/migration.sql',
      'CREATE TABLE fixture (id integer);',
    );
    await put(
      base,
      'package.json',
      JSON.stringify({ type: 'module', version: base === app ? '1' : '2' }),
    );
    await put(base, 'package-lock.json', '{}');
    for (const name of [
      '.env',
      '.env.production',
      'uploads/photo.jpg',
      'node_modules/old/index.js',
      'src/.env.secret',
      'src/logs/error.log',
      'src/.cache/cache',
      'prisma/dump.sql',
      'src/backup.db',
      'src/state.sqlite3',
    ])
      await put(base, name, 'persistent-private-marker');
  }
  const incoming = join(root, '.waterfall-incoming-123-1');
  await mkdir(incoming);
  await archiveCode(source, join(incoming, 'backend.tar.gz'));
  await writeFile(join(incoming, 'database-url'), 'postgresql://fixture-only');
  return { root, app, source, incoming };
}
test('archive includes runtime and migration SQL; excludes secrets, uploads, dependencies and caches', async (t) => {
  const { app, incoming } = await fixture(t);
  const manifest = await codeManifest(app);
  assert.ok(
    manifest.files.includes(
      'prisma/migrations/20261015000000_gallery_cleanup/migration.sql',
    ),
  );
  assert.ok(manifest.files.includes('dist/src/main.js'));
  assert.ok(
    !manifest.files.some((name) =>
      /node_modules|uploads|\.env|logs|cache|dump|backup\.db|state\.sqlite3/.test(
        name,
      ),
    ),
  );
  assert.ok(
    run('tar', ['-tzf', join(incoming, 'backend.tar.gz')]).includes(
      'migration.sql',
    ),
  );
});
test('filesystem byte and inode checks reject shortages and invalid measurements', () => {
  const available = { filesystemBytes: 100, filesystemInodes: 100 };
  assert.throws(
    () => checkHeadroom({ ...available, filesystemBytes: 0 }, 10, 10),
    /FILESYSTEM BYTE/,
  );
  assert.throws(
    () => checkHeadroom({ ...available, filesystemInodes: 0 }, 10, 10),
    /FILESYSTEM INODE/,
  );
  assert.throws(
    () => checkHeadroom({ ...available, filesystemInodes: undefined }, 10, 10),
    /Invalid/,
  );
  assert.throws(
    () => checkHeadroom({ ...available, filesystemBytes: NaN }, 10, 10),
    /Invalid/,
  );
});

test('preflight only measures filesystem headroom, warns about account quotas and writes nothing', async (t) => {
  const { root } = await fixture(t);
  const before = await readdir(root);
  const settings = {
    BACKEND_DEPLOY_RESERVE_MB: 1,
    BACKEND_DEPLOY_RESERVE_INODES: 1,
  };
  const dependencies = {
    run: () => {
      throw Error('External quota command must never run');
    },
    statfs: async () => ({
      files: 100000,
      ffree: 100000,
      bavail: 1000000,
      bsize: 4096,
    }),
  };
  const result = await preflight(root, sizes, settings, dependencies);
  assert.equal(result.status, 'ok');
  assert.equal(result.accountQuotaVerified, false);
  assert.equal(result.scope, 'filesystem_only');
  assert.match(result.warning, /does not prove/);
  assert.equal(result.accountBytes, undefined);
  assert.equal(result.accountInodes, undefined);
  await assert.rejects(
    preflight(root, sizes, settings, {
      ...dependencies,
      statfs: async () => {
        throw Error('private path');
      },
    }),
    /Filesystem headroom measurement unavailable/,
  );
  await assert.rejects(
    preflight(root, sizes, settings, {
      ...dependencies,
      statfs: async () => ({
        files: 100,
        ffree: 0,
        bavail: 1000000,
        bsize: 4096,
      }),
    }),
    /FILESYSTEM INODE/,
  );
  await assert.rejects(
    preflight(root, sizes, settings, {
      ...dependencies,
      statfs: async () => ({
        files: 100,
        ffree: 100000,
        bavail: 0,
        bsize: 4096,
      }),
    }),
    /FILESYSTEM BYTE/,
  );
  assert.deepEqual(await readdir(root), before);
});

test('retention reports excess and legacy entries without deleting backups', async (t) => {
  const { root } = await fixture(t);
  const backups = join(root, 'waterfall-backups');
  await mkdir(backups);
  const names = [
    'backend-aaaaaaaaaaaa-100-abcd.tar.gz',
    'backend-aaaaaaaaaaaa-200-abcd.tar.gz',
    'backend-20261015-090000',
  ];
  for (const name of names) await writeFile(join(backups, name), 'keep');
  assert.deepEqual(await retentionReport(backups, 1), {
    keep: 1,
    completeManagedArchives: 2,
    beyondRetention: 1,
    legacyOrPartialEntries: 1,
    automaticDeletion: false,
  });
  assert.deepEqual((await readdir(backups)).sort(), names.sort());
});
for (const failure of [
  'preflight',
  'backup',
  'install',
  'build',
  'migration',
  'health',
  'none',
]) {
  test(`deployment ${failure}: persistent data preserved, previous runtime recoverable`, async (t) => {
    const { root, app, incoming } = await fixture(t);
    const calls = [];
    const execute = (command, args, options) => {
      calls.push([command, ...args]);
      if (command === 'npm') {
        assert.notEqual(options.cwd, app);
        assert.ok(options.cwd.startsWith(join(root, 'waterfall-releases')));
      }

      if (command === 'tar') {
        if (failure === 'backup' && args[0] === '-czf')
          throw new Error('tar: account quota exceeded');
        return run(command, args, options);
      }
      if (
        (failure === 'install' && command === 'npm' && args[0] === 'ci') ||
        (failure === 'build' && command === 'npm' && args[0] === 'run') ||
        (failure === 'migration' && args[0] === 'migrate')
      )
        throw new Error(`fixture ${failure} failed`);
      return '';
    };
    const inspect = async () => {
      if (failure === 'preflight') throw new Error('fixture preflight failed');
      return { status: 'fixture-ok' };
    };
    const health = async () => {
      if (failure === 'health') throw new Error('fixture health failed');
    };
    const operation = deploy(
      root,
      incoming,
      revision,
      sizes,
      {},
      execute,
      health,
      inspect,
    );
    if (failure === 'none') await operation;
    else await assert.rejects(operation, /failed|quota exceeded/);
    for (const name of [
      '.env',
      'uploads/photo.jpg',
      'node_modules/old/index.js',
    ])
      assert.equal(
        await readFile(join(app, name), 'utf8'),
        'persistent-private-marker',
      );
    assert.ok(
      (await readFile(join(app, 'dist/src/main.js'), 'utf8')).includes(
        failure === 'none' ? 'new' : 'old',
      ),
    );
    assert.equal(
      JSON.parse(await readFile(join(app, 'package.json'), 'utf8')).version,
      failure === 'none' ? '2' : '1',
    );
    await assert.rejects(lstat(join(root, '.waterfall-deploy.lock')), {
      code: 'ENOENT',
    });
    await assert.rejects(lstat(join(incoming, 'database-url')), {
      code: 'ENOENT',
    });
    if (['preflight', 'backup'].includes(failure))
      assert.ok(!calls.some(([command]) => command === 'npm'));
    if (['install', 'build'].includes(failure))
      assert.ok(!calls.some(([, arg]) => arg === 'migrate'));
  });
}

test(
  'Linux repeated promotion and rollback preserve the previously linked runtime',
  {
    skip:
      process.platform === 'win32'
        ? 'Atomic POSIX symlink replacement requires Linux; CI runs this test.'
        : false,
  },
  async (t) => {
    const { root, app, incoming } = await fixture(t);
    const execute = (command, args, options) =>
      command === 'tar' ? run(command, args, options) : '';
    const inspect = async () => ({ status: 'fixture-ok' });
    await deploy(
      root,
      incoming,
      revision,
      sizes,
      {},
      execute,
      async () => {},
      inspect,
    );
    const previous = await realpath(join(app, 'dist'));
    await writeFile(
      join(incoming, 'database-url'),
      'postgresql://fixture-only',
    );
    await assert.rejects(
      deploy(
        root,
        incoming,
        'b'.repeat(40),
        sizes,
        {},
        execute,
        async () => {
          throw new Error('fixture unhealthy');
        },
        inspect,
      ),
      /unhealthy/,
    );
    assert.equal(await realpath(join(app, 'dist')), previous);
    await writeFile(
      join(incoming, 'database-url'),
      'postgresql://fixture-only',
    );
    await deploy(
      root,
      incoming,
      'c'.repeat(40),
      sizes,
      {},
      execute,
      async () => {},
      inspect,
    );
    assert.notEqual(await realpath(join(app, 'dist')), previous);
  },
);

test('a competing deployment lock blocks writes and stays owned by the other run', async (t) => {
  const { root, incoming, app } = await fixture(t);
  await mkdir(join(root, '.waterfall-deploy.lock'));
  let inspected = false;
  await assert.rejects(
    deploy(
      root,
      incoming,
      revision,
      sizes,
      {},
      () => {
        throw Error('unexpected command');
      },
      async () => {},
      async () => {
        inspected = true;
      },
    ),
    { code: 'EEXIST' },
  );
  assert.equal(inspected, false);
  assert.ok((await lstat(join(root, '.waterfall-deploy.lock'))).isDirectory());
  assert.ok(
    (await readFile(join(app, 'dist/src/main.js'), 'utf8')).includes('old'),
  );
});

test('child process failures report quota category without exposing stderr secrets', () => {
  assert.throws(
    () =>
      run(process.execPath, [
        '-e',
        'console.error("quota exceeded secret-fixture-token");process.exit(1)',
      ]),
    (error) =>
      /account quota exceeded/.test(error.message) &&
      !error.message.includes('secret-fixture-token'),
  );
});

for (const unsafe of [
  'uploads/photo.jpg',
  '.env',
  'node_modules/index.js',
  'dist/.env.production',
  'src/backup.db',
]) {
  test(`rejects incoming persistent/secret/database path ${unsafe} before npm or activation`, async (t) => {
    const { root, app, incoming } = await fixture(t);
    let installed = false;
    const execute = (command, args, options) => {
      if (command === 'npm') installed = true;
      if (
        command === 'tar' &&
        args[0] === '-tzf' &&
        args[1] === join(incoming, 'backend.tar.gz')
      )
        return unsafe + '\n';
      return run(command, args, options);
    };
    await assert.rejects(
      deploy(
        root,
        incoming,
        revision,
        sizes,
        {},
        execute,
        async () => {},
        async () => ({ status: 'fixture-ok' }),
      ),
      /unsafe or persistent-data/,
    );
    assert.equal(installed, false);
    assert.equal(
      await readFile(join(app, '.env'), 'utf8'),
      'persistent-private-marker',
    );
    assert.equal(
      await readFile(join(app, 'uploads/photo.jpg'), 'utf8'),
      'persistent-private-marker',
    );
    assert.equal(
      await readFile(join(app, 'node_modules/old/index.js'), 'utf8'),
      'persistent-private-marker',
    );
    assert.ok(
      (await readFile(join(app, 'dist/src/main.js'), 'utf8')).includes('old'),
    );
  });
}
