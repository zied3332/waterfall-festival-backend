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
  accountHeadroom,
  readAccountQuotas,
  inspectLegacyBackup,
  checkHeadroom,
  preflight,
  retentionReport,
  deploy,
} from '../scripts/deploy/backend-deploy.mjs';
const revision = 'a'.repeat(40);
const sizes = { archiveBytes: 100, sourceBytes: 100, sourceFiles: 10 };
const quotas = {
  result: {
    status: 1,
    data: [
      { id: 'diskusage', _count: '100', _max: '10000', units: 'MB' },
      { id: 'fileusage', _count: '100', _max: '300000', units: '' },
    ],
  },
};
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
      /node_modules|uploads|\.env|logs|cache|dump/.test(name),
    ),
  );
  assert.ok(
    run('tar', ['-tzf', join(incoming, 'backend.tar.gz')]).includes(
      'migration.sql',
    ),
  );
});
test('byte and inode quotas are distinguished, malformed measurements rejected', () => {
  assert.deepEqual(accountHeadroom(quotas), {
    accountBytes: 9900 * 1024 ** 2,
    accountInodes: 299900,
  });
  assert.throws(
    () => accountHeadroom({ result: { status: 1, data: [] } }),
    /unavailable/,
  );
  const available = {
    accountBytes: 100,
    accountInodes: 100,
    filesystemBytes: 100,
    filesystemInodes: 100,
  };
  for (const [key, message] of [
    ['accountBytes', /ACCOUNT DISK/],
    ['accountInodes', /ACCOUNT INODE/],
    ['filesystemBytes', /FILESYSTEM BYTE/],
    ['filesystemInodes', /FILESYSTEM INODE/],
  ])
    assert.throws(
      () => checkHeadroom({ ...available, [key]: 0 }, 10, 10),
      message,
    );
  assert.throws(
    () => checkHeadroom({ ...available, filesystemInodes: undefined }, 10, 10),
    /Invalid/,
  );
});
test('preflight is read-only and fails closed when account measurements are unavailable', async (t) => {
  const { root } = await fixture(t);
  const before = await readdir(root);
  const settings = {
    BACKEND_DEPLOY_RESERVE_MB: 1,
    BACKEND_DEPLOY_RESERVE_INODES: 1,
  };
  const dependencies = {
    run: () => JSON.stringify(quotas),
    statfs: async () => ({
      files: 100000,
      ffree: 100000,
      bavail: 1000000,
      bsize: 4096,
    }),
  };
  assert.equal(
    (await preflight(root, sizes, settings, dependencies)).status,
    'ok',
  );
  await assert.rejects(
    preflight(root, sizes, settings, { ...dependencies, run: () => '{}' }),
    /Cannot verify ACCOUNT/,
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

test('quota probe distinguishes sanitized command failures without exposing stderr or arbitrary error fields', () => {
  for (const [spawnCode, category] of [
    ['ENOENT', 'command_or_interpreter_unavailable'],
    ['EACCES', 'execution_denied'],
    ['EPERM', 'execution_denied'],
    ['ETIMEDOUT', 'command_timeout'],
    [null, 'command_failed'],
  ]) {
    assert.throws(
      () =>
        readAccountQuotas(() => {
          const error = Error('SECRET-CREDENTIAL-FIXTURE');
          error.diagnostics = {
            spawnCode,
            exitStatus: 1,
            category: ['EACCES', 'EPERM'].includes(spawnCode)
              ? 'permission_denied'
              : 'command failed',
            arbitrary: 'SECRET-CREDENTIAL-FIXTURE',
          };
          throw error;
        }),
      (error) =>
        error.diagnostics.category === category &&
        !error.message.includes('SECRET-CREDENTIAL-FIXTURE'),
    );
  }
  assert.throws(
    () => run('waterfall-test-command-does-not-exist', []),
    (error) => error.diagnostics.spawnCode === 'ENOENT',
  );
});

test('quota probe differentiates malformed data, API rejection and unsupported metrics', () => {
  const cases = [
    ['not-json SECRET-CREDENTIAL-FIXTURE', 'invalid_json'],
    [
      JSON.stringify({
        result: {
          status: 0,
          errors: ['Permission denied SECRET-CREDENTIAL-FIXTURE'],
        },
      }),
      'uapi_rejected',
    ],
    ['{}', 'invalid_envelope'],
    [
      JSON.stringify({
        result: { status: 1, data: [null, quotas.result.data[0]] },
      }),
      'missing_metrics',
    ],
    [
      JSON.stringify({
        result: {
          status: 1,
          data: [
            quotas.result.data[0],
            {
              id: 'fileusage',
              count: 'bad SECRET-CREDENTIAL-FIXTURE',
              max: 10,
            },
          ],
        },
      }),
      'invalid_metric_values',
    ],
  ];
  for (const [payload, category] of cases)
    assert.throws(
      () => readAccountQuotas(() => payload),
      (error) =>
        error.diagnostics.category === category &&
        !error.message.includes('SECRET-CREDENTIAL-FIXTURE'),
    );
  assert.deepEqual(
    readAccountQuotas(() => JSON.stringify(quotas)),
    accountHeadroom(quotas),
  );
  assert.deepEqual(
    accountHeadroom({ result: { ...quotas.result, status: '1' } }),
    accountHeadroom(quotas),
  );
});

test('legacy backup inspection measures only the fixed failed directory and never deletes it', async (t) => {
  const { root } = await fixture(t);
  assert.equal((await inspectLegacyBackup(root)).status, 'absent');
  const backup = join(root, 'waterfall-backups/backend-20261015-090000');
  await mkdir(backup, { recursive: true });
  await writeFile(join(backup, 'keep'), 'unchanged');
  const calls = [];
  const report = await inspectLegacyBackup(root, (command, args) => {
    calls.push([command, ...args]);
    assert.equal(command, 'du');
    assert.equal(args.at(-1), backup);
    return `${args[0] === '-sk' ? 123 : 7}\tprivate-path-not-logged\n`;
  });
  assert.equal(report.allocatedBytes, 123 * 1024);
  assert.equal(report.inodeCount, 7);
  assert.equal(report.deletionPerformed, false);
  assert.equal(calls.length, 2);
  assert.equal(await readFile(join(backup, 'keep'), 'utf8'), 'unchanged');
  assert.ok(!JSON.stringify(report).includes('private-path-not-logged'));
  const unavailable = await inspectLegacyBackup(root, () => {
    throw Error('SECRET-CREDENTIAL-FIXTURE');
  });
  assert.equal(unavailable.allocatedBytes, null);
  assert.equal(unavailable.inodeCount, null);
});
