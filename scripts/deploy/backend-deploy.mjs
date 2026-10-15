import {
  lstat,
  realpath,
  readdir,
  statfs,
  mkdir,
  readFile,
  writeFile,
  rename,
  symlink,
  readlink,
  unlink,
  rmdir,
} from 'node:fs/promises';
import { resolve, join, dirname, basename, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Explicit rollback/package scope. Never archive the production directory tree.
export const CODE_ROOTS = [
  'dist',
  'src',
  'prisma',
  'package.json',
  'package-lock.json',
  'prisma.config.ts',
  'nest-cli.json',
  'tsconfig.json',
  'tsconfig.build.json',
];
const excluded = (name) =>
  /^(?:node_modules|uploads|logs?|tmp|temp|\.tmp|\.temp|\.cache|\.npm|\.git|coverage|cache|caches|\.yarn|\.pnpm-store|\.next|\.turbo|backups?|\.aws|\.ssh)$/.test(
    name,
  ) ||
  /^\.env/.test(name) ||
  /\.(?:log|tsbuildinfo|pem|key|zip|gz|db|sqlite|sqlite3|dump|bak|tar|tgz)$/.test(
    name,
  );
const excludedPath = (name) =>
  name.split(/[\\/]/).some(excluded) ||
  (/\.sql$/i.test(name) &&
    !/^prisma[\\/]migrations[\\/].+[\\/]migration\.sql$/.test(name));
const MiB = 1024 ** 2;

export function integer(value, fallback, name) {
  const text = String(value ?? fallback);
  if (
    !/^\d+$/.test(text) ||
    !Number.isSafeInteger(Number(text)) ||
    Number(text) < 1
  )
    throw new Error(`Invalid ${name}.`);
  return Number(text);
}

export async function codeManifest(root) {
  const files = [];
  let bytes = 0;
  async function visit(name) {
    if (excludedPath(name)) return;
    if (/[\x00-\x1f]/.test(name)) throw new Error('Unsafe code filename.');
    let stat;
    try {
      stat = await lstat(join(root, name));
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    if (stat.isSymbolicLink())
      throw new Error('Code archive contains a symbolic link.');
    if (stat.isDirectory())
      for (const child of await readdir(join(root, name)))
        await visit(join(name, child));
    else if (stat.isFile()) {
      files.push(name.replaceAll('\\', '/'));
      bytes += stat.size;
      if (bytes > 128 * MiB || files.length > 20000)
        throw new Error(
          'Code archive exceeds the 128 MiB / 20000 file safety bound.',
        );
    }
  }
  for (const name of CODE_ROOTS) await visit(name);
  for (const required of [
    'dist/src/main.js',
    'package.json',
    'package-lock.json',
  ])
    if (!files.includes(required))
      throw new Error('Essential runtime/rollback files are missing.');
  return { files: files.sort(), bytes };
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 10 * 60 * 1000,
    maxBuffer: 16 * MiB,
    ...options,
  });
  if (result.error || result.status !== 0) {
    const text = String(result.stderr ?? '');
    const reason = /quota exceeded/i.test(text)
      ? 'account quota exceeded'
      : /no space left/i.test(text)
        ? 'space or inode exhaustion'
        : /file too large/i.test(text)
          ? 'filesystem file-size limit'
          : 'command failed';
    const error = new Error(
      `${basename(command)}: ${reason} (exit ${result.status ?? 'unavailable'}).`,
    );
    throw error;
  }
  return result.stdout;
}

export async function archiveCode(root, archive, execute = run) {
  const manifest = await codeManifest(root);
  execute('tar', ['-czf', archive, '--null', '--no-recursion', '-T', '-'], {
    cwd: root,
    input: manifest.files.join('\0') + '\0',
  });
  if ((await lstat(archive)).size > 128 * MiB)
    throw new Error(
      'Compressed code archive exceeds the 128 MiB safety bound.',
    );
  const listed = execute('tar', ['-tzf', archive])
    .trim()
    .split(/\r?\n/)
    .map((name) => name.replace(/\/$/, ''))
    .sort();
  if (JSON.stringify(listed) !== JSON.stringify(manifest.files))
    throw new Error('Code backup verification failed.');
  return manifest;
}

export function checkHeadroom(
  { filesystemBytes, filesystemInodes },
  requiredBytes,
  requiredInodes,
) {
  for (const value of [
    filesystemBytes,
    filesystemInodes,
    requiredBytes,
    requiredInodes,
  ]) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error('Invalid filesystem headroom measurement.');
  }
  if (filesystemBytes < requiredBytes)
    throw new Error(
      'Insufficient FILESYSTEM BYTE headroom. Account quota is not measured. No backups or uploads were deleted.',
    );
  if (filesystemInodes < requiredInodes)
    throw new Error(
      'Insufficient FILESYSTEM INODE headroom. Account quota is not measured. No files were deleted.',
    );
}

async function runtimeRoot(home) {
  const app = join(home, 'waterfall-backend');
  if ((await realpath(app)) !== resolve(app))
    throw new Error('Application directory must be a real directory.');
  const dist = await realpath(join(app, 'dist'));
  const root = dirname(dist);
  const releases = join(home, 'waterfall-releases');
  if (
    basename(dist) !== 'dist' ||
    (root !== resolve(app) && !root.startsWith(resolve(releases) + sep))
  )
    throw new Error('Active runtime is outside approved locations.');
  return root;
}

export async function preflight(
  home,
  incoming,
  settings = {},
  dependencies = {},
) {
  if (/--preserve-symlinks/.test(process.env.NODE_OPTIONS ?? ''))
    throw new Error(
      'Runtime symlink preservation flags are incompatible with isolated release dependencies.',
    );
  const root = await runtimeRoot(home);
  const manifest = await codeManifest(root);
  const reserveBytes =
    integer(settings.BACKEND_DEPLOY_RESERVE_MB, 1024, 'byte reserve') * MiB;
  const reserveInodes = integer(
    settings.BACKEND_DEPLOY_RESERVE_INODES,
    50000,
    'inode reserve',
  );
  const requiredBytes =
    reserveBytes +
    manifest.bytes +
    incoming.archiveBytes +
    incoming.sourceBytes;
  const requiredInodes = reserveInodes + incoming.sourceFiles + 20;
  let fs;
  try {
    fs = await (dependencies.statfs ?? statfs)(home);
  } catch {
    throw new Error(
      'Filesystem headroom measurement unavailable. Deployment stopped.',
    );
  }
  if (
    !fs ||
    !Number.isSafeInteger(fs.files) ||
    fs.files <= 0 ||
    !Number.isSafeInteger(fs.bavail) ||
    fs.bavail < 0 ||
    !Number.isSafeInteger(fs.bsize) ||
    fs.bsize <= 0
  )
    throw new Error(
      'Filesystem headroom measurement unavailable. Deployment stopped.',
    );
  const measured = {
    filesystemBytes: fs.bavail * fs.bsize,
    filesystemInodes: fs.ffree,
  };
  checkHeadroom(measured, requiredBytes, requiredInodes);
  return {
    status: 'ok',
    scope: 'filesystem_only',
    accountQuotaVerified: false,
    warning:
      'Filesystem availability does not prove cPanel account quota headroom. Writes may still fail with Disk quota exceeded.',
    requiredBytes,
    requiredInodes,
    ...measured,
    codeBackupFiles: manifest.files.length,
    codeBackupBytes: manifest.bytes,
  };
}

export async function retentionReport(directory, keep) {
  const entries = await readdir(directory, { withFileTypes: true });
  const archives = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^backend-[a-f0-9]{12}-\d+-[a-f0-9]+\.tar\.gz$/.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort((a, b) => Number(b.split('-')[2]) - Number(a.split('-')[2]));
  return {
    keep,
    completeManagedArchives: archives.length,
    beyondRetention: Math.max(0, archives.length - keep),
    legacyOrPartialEntries: entries.length - archives.length,
    automaticDeletion: false,
  };
}

async function atomicFile(path, content, suffix) {
  const temporary = `${path}.${suffix}`;
  await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
  await rename(temporary, path);
}

export async function deploy(
  home,
  incomingDir,
  revision,
  sizes,
  settings = {},
  execute = run,
  health = productionHealth,
  inspect = preflight,
) {
  if (
    !/^[a-f0-9]{40}$/.test(revision) ||
    !/^\.waterfall-incoming-\d+-\d+$/.test(basename(incomingDir)) ||
    dirname(resolve(incomingDir)) !== resolve(home)
  )
    throw new Error('Invalid deployment inputs.');
  if ((await realpath(incomingDir)) !== resolve(incomingDir))
    throw new Error('Unsafe incoming directory.');
  const secretFile = join(incomingDir, 'database-url');
  const app = join(home, 'waterfall-backend');
  const lock = join(home, '.waterfall-deploy.lock');
  let lockOwned = false;
  let recoveryIncomplete = false;
  let pointerChanged = false;
  let legacyMoved = false;
  let release;
  let previousLink;
  let legacyDist;
  let journal;
  let packageBefore;
  let lockBefore;
  let phase = 'preflight';
  let migrationsAttempted = false;
  try {
    await mkdir(lock, { mode: 0o700 });
    lockOwned = true;
    console.log(
      JSON.stringify(await inspect(home, sizes, settings, { run: execute })),
    );
    const oldRoot = await runtimeRoot(home);
    const id = `${revision.slice(0, 12)}-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const backups = join(home, 'waterfall-backups');
    const releases = join(home, 'waterfall-releases');
    for (const directory of [backups, releases]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if ((await realpath(directory)) !== resolve(directory))
        throw new Error('Unsafe deployment directory.');
    }
    phase = 'backup';
    const partial = join(backups, `backend-${id}.tar.gz.partial`);
    await archiveCode(oldRoot, partial, execute);
    const backup = partial.replace(/\.partial$/, '');
    await rename(partial, backup);
    console.log(
      'Minimal code backup verified; uploads, dependencies and secrets are excluded.',
    );
    console.log(
      JSON.stringify(
        await retentionReport(
          backups,
          integer(settings.BACKEND_BACKUP_KEEP, 5, 'backup retention'),
        ),
      ),
    );
    phase = 'stage';
    release = join(releases, `release-${id}`);
    await mkdir(release, { mode: 0o700 });
    const archive = join(incomingDir, 'backend.tar.gz');
    const members = execute('tar', ['-tzf', archive]).trim().split(/\r?\n/);
    if (
      members.some(
        (name) =>
          !CODE_ROOTS.includes(name.split('/')[0]) ||
          excludedPath(name) ||
          name.split('/').some((part) => part === '..' || part === '.') ||
          name.startsWith('/') ||
          /[\\\x00-\x1f]/.test(name),
      )
    )
      throw new Error(
        'Incoming package has unsafe or persistent-data entries.',
      );
    // Reject all symbolic/hard links before extracting into the fresh release.
    if (
      execute('tar', ['-tvzf', archive])
        .trim()
        .split(/\r?\n/)
        .some((line) => !/^[d-]/.test(line))
    )
      throw new Error('Incoming package contains links or special files.');
    execute('tar', [
      '-xzf',
      archive,
      '--no-same-owner',
      '--no-same-permissions',
      '-C',
      release,
    ]);
    const dummy = 'postgresql://ci_user:ci_password@localhost:5432/ci_database';
    const buildEnvironment = { ...process.env, DATABASE_URL: dummy };
    phase = 'install';
    execute('npm', ['ci', '--include=dev'], {
      cwd: release,
      env: buildEnvironment,
    });
    phase = 'build';
    execute('npm', ['run', 'build'], { cwd: release, env: buildEnvironment });
    if (!(await lstat(join(release, 'dist/src/main.js'))).isFile())
      throw new Error('Staged runtime entry is not a regular file.');
    execute('node', ['--check', join(release, 'dist/src/main.js')]);
    packageBefore = await readFile(join(app, 'package.json'));
    lockBefore = await readFile(join(app, 'package-lock.json'));
    await writeFile(join(release, 'previous-package.json'), packageBefore, {
      mode: 0o600,
    });
    await writeFile(join(release, 'previous-package-lock.json'), lockBefore, {
      mode: 0o600,
    });
    const distStat = await lstat(join(app, 'dist'));
    if (distStat.isSymbolicLink())
      previousLink = await readlink(join(app, 'dist'));
    else legacyDist = join(app, `.dist-before-${id}`);
    journal = {
      revision,
      backup: basename(backup),
      previousLink,
      legacyDist,
      phase: 'prepared',
    };
    await writeFile(join(release, 'deployment.json'), JSON.stringify(journal), {
      mode: 0o600,
    });
    const databaseUrl = (await readFile(secretFile, 'utf8')).trim();
    if (!databaseUrl)
      throw new Error('Production migration configuration is missing.');
    phase = 'migration';
    migrationsAttempted = true;
    journal.phase = phase;
    await writeFile(join(release, 'deployment.json'), JSON.stringify(journal));
    execute(join(release, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
      cwd: release,
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    phase = 'activate';
    journal.phase = phase;
    await writeFile(join(release, 'deployment.json'), JSON.stringify(journal));
    const next = join(app, `.dist-next-${id}`);
    await symlink(
      join(release, 'dist'),
      next,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    if (legacyDist) {
      await rename(join(app, 'dist'), legacyDist);
      legacyMoved = true;
    }
    await rename(next, join(app, 'dist'));
    pointerChanged = true;
    await atomicFile(
      join(app, 'package.json'),
      await readFile(join(release, 'package.json')),
      id,
    );
    await atomicFile(
      join(app, 'package-lock.json'),
      await readFile(join(release, 'package-lock.json')),
      id,
    );
    await mkdir(join(app, 'tmp'), { recursive: true });
    await writeFile(join(app, 'tmp/restart.txt'), '');
    phase = 'health';
    await health();
    journal.phase = 'healthy';
    await writeFile(join(release, 'deployment.json'), JSON.stringify(journal));
    console.log(
      JSON.stringify({
        status: 'deployed',
        revision,
        backup: basename(backup),
        runtime: basename(release),
      }),
    );
  } catch (error) {
    if (pointerChanged || legacyMoved) {
      try {
        if (legacyDist) {
          const failed = join(release, 'failed-dist-link');
          try {
            if (pointerChanged) await rename(join(app, 'dist'), failed);
          } catch (failure) {
            if (failure.code !== 'ENOENT') throw failure;
          }
          await rename(legacyDist, join(app, 'dist'));
        } else {
          const restore = join(
            app,
            `.dist-restore-${randomBytes(4).toString('hex')}`,
          );
          await symlink(
            previousLink,
            restore,
            process.platform === 'win32' ? 'junction' : 'dir',
          );
          await rename(restore, join(app, 'dist'));
        }
        await atomicFile(
          join(app, 'package.json'),
          packageBefore,
          'rollback-' + Date.now(),
        );
        await atomicFile(
          join(app, 'package-lock.json'),
          lockBefore,
          'rollback-' + Date.now(),
        );
        await mkdir(join(app, 'tmp'), { recursive: true });
        await writeFile(join(app, 'tmp/restart.txt'), '');
        console.error(
          'Previous runtime and package metadata restored; database changes were NOT reversed.',
        );
      } catch {
        recoveryIncomplete = true;
        console.error(
          'Automatic runtime recovery incomplete. Use retained runtime, code backup and deployment journal; do not rerun deployment blindly.',
        );
      }
    }
    console.error(
      `Deployment stopped during ${phase}. ${migrationsAttempted ? 'Inspect migration state before retrying; no database rollback was attempted.' : 'Active runtime has not been changed.'}`,
    );
    throw error;
  } finally {
    // Only this run's temporary credential is removed. Never remove backups,
    // old releases, uploads, production environment files, or active dependencies.
    try {
      await unlink(secretFile);
    } catch (error) {
      if (error.code !== 'ENOENT')
        console.error(
          'Temporary credential cleanup requires operator attention.',
        );
    }
    if (lockOwned && !recoveryIncomplete) {
      try {
        await rmdir(lock);
      } catch {
        console.error('Deployment lock cleanup requires operator attention.');
      }
    }
  }
}

async function productionHealth() {
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const response = await fetch(
        'https://api.waterfallpartykohphangan.com/',
        { signal: AbortSignal.timeout(10000), redirect: 'error' },
      );
      if (response.ok && (await response.json()).status === 'running') return;
    } catch {
      /* Retry only the fixed read-only health URL. */
    }
  }
  throw new Error('Production health check failed.');
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--package') {
    const manifest = await archiveCode(process.cwd(), resolve(args[0]));
    console.log(
      JSON.stringify({
        archiveBytes: (await lstat(args[0])).size,
        sourceBytes: manifest.bytes,
        sourceFiles: manifest.files.length,
      }),
    );
    return;
  }
  if (!['--preflight', '--deploy'].includes(mode))
    throw new Error(
      'Unknown deployment mode. Hosting quota diagnostics have been retired.',
    );
  const sizes = {
    archiveBytes: integer(args[0], undefined, 'archive size'),
    sourceBytes: integer(args[1], undefined, 'source size'),
    sourceFiles: integer(args[2], undefined, 'source count'),
  };
  const home = resolve(process.env.HOME);
  if (mode === '--preflight')
    console.log(JSON.stringify(await preflight(home, sizes, process.env)));
  else if (mode === '--deploy')
    await deploy(home, resolve(args[3]), args[4], sizes, process.env);
  else throw new Error('Unknown deployment mode.');
}

if (
  process.argv[1] === '-' ||
  (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
) {
  process.umask(0o077);
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
