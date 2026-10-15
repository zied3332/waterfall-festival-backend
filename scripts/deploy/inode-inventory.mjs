import { lstat, realpath, opendir } from 'node:fs/promises';
import { resolve, join, dirname, basename, sep, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const schema = 'waterfall_inode_inventory_v1';
const childPattern =
  /^(?:backend-\d{8}-\d{6}|backend-[a-f0-9]{12}-\d+-[a-f0-9]+\.tar\.gz(?:\.partial)?|release-[a-f0-9]{12}-\d+-[a-f0-9]+)$/;
const incomingPattern = /^\.waterfall-incoming-\d+-\d+$/;
const snapshotPattern = /^\.dist-before-[a-f0-9]{12}-\d+-[a-f0-9]+$/;
const codes = [
  'ENOENT',
  'EACCES',
  'EPERM',
  'ELOOP',
  'ENOTDIR',
  'EMFILE',
  'ENFILE',
  'EIO',
];
const within = (path, home) => path === home || path.startsWith(home + sep);
const overlap = (a, b) => within(a, b) || within(b, a);
const safeCode = (error) =>
  codes.includes(error?.code) ? error.code : 'UNKNOWN';

// Paths are fixed by this module. No production filenames, file contents,
// environment values, UIDs or absolute/canonical paths are emitted.
export async function inventory(home, emit, limits = {}) {
  const deadline = Date.now() + (limits.maxMilliseconds ?? 240000);
  const maxEntries = limits.maxEntries ?? 1500000;
  const maxCandidates = limits.maxCandidates ?? 200;
  let visited = 0,
    reports = 0,
    incomplete = false;
  const exhausted = () => Date.now() >= deadline || visited >= maxEntries;
  let canonicalHome;
  try {
    canonicalHome = await realpath(home);
  } catch (error) {
    emit({
      schema,
      kind: 'summary',
      status: 'unavailable',
      errorCode: safeCode(error),
      countsAreNotAdditive: true,
      deletionPerformed: false,
    });
    return;
  }
  if (dirname(canonicalHome) === canonicalHome) {
    emit({
      schema,
      kind: 'summary',
      status: 'unavailable',
      reason: 'root_home_not_scanned',
      countsAreNotAdditive: true,
      deletionPerformed: false,
    });
    return;
  }
  const homeIsCanonical = canonicalHome === resolve(home);
  const app = join(canonicalHome, 'waterfall-backend');
  const protectedRoots = [
    app,
    join(canonicalHome, 'nodevenv/waterfall-backend/22'),
  ];
  let activeRuntime = null,
    activeDependencies = null;
  async function safeReal(path) {
    try {
      return await realpath(path);
    } catch {
      return null;
    }
  }
  const resolvedEnvironment = await safeReal(
    join(canonicalHome, 'nodevenv/waterfall-backend/22'),
  );
  if (resolvedEnvironment) protectedRoots.push(resolvedEnvironment);
  const resolvedApp = await safeReal(app);
  if (resolvedApp) protectedRoots.push(resolvedApp);
  const dist = await safeReal(join(app, 'dist'));
  if (dist && within(dist, canonicalHome)) {
    const root = dirname(dist);
    if (
      basename(dist) === 'dist' &&
      (root === app ||
        root.startsWith(join(canonicalHome, 'waterfall-releases') + sep))
    ) {
      activeRuntime = root;
      protectedRoots.push(root);
    }
  }
  const dependencyTargets = new Set();
  for (const path of [
    join(app, 'node_modules'),
    ...(activeRuntime ? [join(activeRuntime, 'node_modules')] : []),
  ]) {
    const target = await safeReal(path);
    if (target) {
      protectedRoots.push(target);
      if (within(target, canonicalHome)) dependencyTargets.add(target);
    }
  }
  activeDependencies = dependencyTargets.size > 0;
  let lockPresent = null;
  try {
    await lstat(join(canonicalHome, '.waterfall-deploy.lock'));
    lockPresent = true;
  } catch (error) {
    if (error.code === 'ENOENT') lockPresent = false;
  }
  emit({
    schema,
    kind: 'header',
    homeIsCanonical,
    activeRuntimeIdentified: Boolean(activeRuntime),
    activeDependenciesIdentified: activeDependencies,
    lockPresent,
    accountQuotaMeasured: false,
    countsAreNotAdditive: true,
    deletionPerformed: false,
  });

  async function count(root) {
    const counts = {
      entries: 0,
      regularFiles: 0,
      directories: 0,
      symlinks: 0,
      otherEntries: 0,
      uniqueInodes: 0,
      hardLinkedFiles: 0,
      sensitiveEntries: 0,
    };
    const seen = new Set(),
      stack = [root];
    let partial = false,
      errorCode,
      rootDevice;
    while (stack.length) {
      if (exhausted()) {
        partial = true;
        errorCode = 'LIMIT_REACHED';
        break;
      }
      const path = stack.pop();
      let info;
      try {
        info = await lstat(path, { bigint: true });
      } catch (error) {
        partial = true;
        errorCode ??= safeCode(error);
        continue;
      }
      if (rootDevice === undefined) rootDevice = info.dev;
      if (info.dev !== rootDevice) {
        partial = true;
        errorCode ??= 'MOUNT_BOUNDARY';
        continue;
      }
      visited++;
      counts.entries++;
      const identity = `${info.dev}:${info.ino}`;
      if (!seen.has(identity)) {
        seen.add(identity);
        counts.uniqueInodes++;
      }
      const segments = relative(root, path).split(sep);
      const name = basename(path);
      if (
        segments.includes('uploads') ||
        /^\.env/.test(name) ||
        /\.(?:db|sqlite3?|dump)(?:-(?:wal|shm|journal))?$/i.test(name) ||
        (/\.sql$/i.test(name) &&
          !/[\\/]prisma[\\/]migrations[\\/].+[\\/]migration\.sql$/.test(path))
      )
        counts.sensitiveEntries++;
      if (info.isSymbolicLink()) {
        counts.symlinks++;
        continue;
      }
      if (info.isFile()) {
        counts.regularFiles++;
        if (info.nlink > 1n) counts.hardLinkedFiles++;
        continue;
      }
      if (!info.isDirectory()) {
        counts.otherEntries++;
        continue;
      }
      counts.directories++;
      try {
        if ((await realpath(path)) !== resolve(path)) {
          partial = true;
          errorCode ??= 'PATH_CHANGED';
          continue;
        }
        // Stream children, never follow symlinks, and bound memory as well as time.
        for await (const entry of await opendir(path)) {
          if (exhausted() || visited + stack.length >= maxEntries) {
            partial = true;
            errorCode = 'LIMIT_REACHED';
            break;
          }
          stack.push(join(path, entry.name));
        }
      } catch (error) {
        partial = true;
        errorCode ??= safeCode(error);
      }
    }
    return {
      ...counts,
      status: partial ? 'partial' : 'complete',
      ...(errorCode ? { errorCode } : {}),
    };
  }

  async function candidate(
    target,
    path,
    category,
    policy = 'explicit_review_required',
    allowResolved = false,
  ) {
    if (reports >= maxCandidates) {
      incomplete = true;
      return;
    }
    reports++;
    if (['retained_backup', 'backup_dependency_copy'].includes(category))
      policy = 'backup_verification_required';
    if (category === 'retained_release')
      policy = 'rollback_verification_required';
    const report = {
      schema,
      kind: 'candidate',
      target,
      category,
      policy,
      activityVerified: false,
      backupRecoverabilityVerified: false,
    };
    let info;
    try {
      info = await lstat(path);
    } catch (error) {
      emit({
        ...report,
        status: error.code === 'ENOENT' ? 'absent' : 'unavailable',
        errorCode: safeCode(error),
      });
      if (error.code !== 'ENOENT') incomplete = true;
      return;
    }
    if (info.isSymbolicLink() && !allowResolved) {
      emit({
        ...report,
        status: 'symlink_not_followed',
        policy: 'never_delete',
      });
      return;
    }
    const canonical = await safeReal(path);
    if (!canonical || !within(canonical, canonicalHome)) {
      emit({
        ...report,
        status: 'outside_home_not_scanned',
        policy: 'never_delete',
      });
      incomplete = true;
      return;
    }
    if (protectedRoots.some((root) => overlap(canonical, root)))
      report.policy = 'never_delete';
    if (!activeRuntime && category === 'retained_release')
      report.policy = 'never_delete';
    const counted = await count(canonical);
    if (counted.status !== 'complete') incomplete = true;
    if (counted.sensitiveEntries > 0) report.policy = 'never_delete_whole_tree';
    // Active roots remain categorically protected even when they contain data.
    if (
      policy === 'never_delete' ||
      protectedRoots.some((root) => overlap(canonical, root))
    )
      report.policy = 'never_delete';
    emit({ ...report, ...counted });
  }
  async function children(
    container,
    prefix,
    category,
    selector = childPattern,
  ) {
    try {
      const info = await lstat(container);
      if (
        info.isSymbolicLink() ||
        !info.isDirectory() ||
        (await realpath(container)) !== resolve(container) ||
        !within(resolve(container), canonicalHome)
      ) {
        incomplete = true;
        emit({
          schema,
          kind: 'candidate',
          target: prefix,
          category,
          policy: 'never_delete',
          status: 'symlink_not_followed',
        });
        return;
      }
      for await (const entry of await opendir(container)) {
        if (reports >= maxCandidates || exhausted()) {
          incomplete = true;
          break;
        }
        if (!selector.test(entry.name)) {
          if (['waterfall-releases', 'waterfall-backups'].includes(prefix))
            incomplete = true;
          continue;
        }
        const path = join(container, entry.name),
          target = `${prefix}/${entry.name}`;
        await candidate(target, path, category);
        // Separate dependency-copy count: overlaps its backup parent; never sum rows.
        if (category === 'retained_backup' && entry.isDirectory())
          await candidate(
            `${target}/node_modules`,
            join(path, 'node_modules'),
            'backup_dependency_copy',
          );
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        incomplete = true;
        emit({
          schema,
          kind: 'candidate',
          target: prefix,
          category,
          policy: 'never_delete',
          status: 'unavailable',
          errorCode: safeCode(error),
        });
      }
    }
  }
  await candidate('.npm', join(canonicalHome, '.npm'), 'npm_cache');
  await candidate('.cache', join(canonicalHome, '.cache'), 'other_cache');
  await candidate(
    'waterfall-backend',
    app,
    'active_application',
    'never_delete',
  );
  await candidate(
    'waterfall-backend/uploads',
    join(app, 'uploads'),
    'persistent_media',
    'never_delete',
  );
  await candidate(
    'waterfall-backend/node_modules',
    join(app, 'node_modules'),
    'active_dependency_link',
    'never_delete',
  );
  let dependencyNumber = 0;
  for (const target of dependencyTargets)
    await candidate(
      `active-dependencies-${++dependencyNumber}`,
      target,
      'active_dependencies',
      'never_delete',
      true,
    );
  await candidate(
    'nodevenv/waterfall-backend/22',
    join(canonicalHome, 'nodevenv/waterfall-backend/22'),
    'active_node_environment',
    'never_delete',
  );
  await children(
    join(canonicalHome, 'waterfall-releases'),
    'waterfall-releases',
    'retained_release',
  );
  await children(
    join(canonicalHome, 'waterfall-backups'),
    'waterfall-backups',
    'retained_backup',
  );
  await children(
    canonicalHome,
    'incoming',
    'incoming_artifact',
    incomingPattern,
  );
  await children(app, 'legacy-runtime', 'legacy_runtime', snapshotPattern);
  emit({
    schema,
    kind: 'summary',
    status: incomplete ? 'partial' : 'complete',
    visitedEntries: visited,
    candidateReports: reports,
    countsAreNotAdditive: true,
    accountQuotaMeasured: false,
    deletionPerformed: false,
  });
}

const categories = [
  'npm_cache',
  'other_cache',
  'active_application',
  'persistent_media',
  'active_dependency_link',
  'active_dependencies',
  'active_node_environment',
  'retained_release',
  'retained_backup',
  'backup_dependency_copy',
  'incoming_artifact',
  'legacy_runtime',
];
const fixedTargets = [
  '.npm',
  '.cache',
  'waterfall-backend',
  'waterfall-backend/uploads',
  'waterfall-backend/node_modules',
  'nodevenv/waterfall-backend/22',
  'waterfall-releases',
  'waterfall-backups',
  'incoming',
  'legacy-runtime',
];
function validTarget(target) {
  if (
    fixedTargets.includes(target) ||
    /^active-dependencies-[1-9]\d*$/.test(target)
  )
    return true;
  if (typeof target !== 'string') return false;
  const [parent, child, extra, ...rest] = target.split('/');
  return (
    rest.length === 0 &&
    (!extra || extra === 'node_modules') &&
    ((['waterfall-releases', 'waterfall-backups'].includes(parent) &&
      childPattern.test(child)) ||
      (parent === 'incoming' && incomingPattern.test(child)) ||
      (parent === 'legacy-runtime' && snapshotPattern.test(child)))
  );
}
export function sanitizeInventory(line) {
  let data;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }
  if (
    !data ||
    data.schema !== schema ||
    !['header', 'candidate', 'summary'].includes(data.kind)
  )
    return null;
  const safe = { schema, kind: data.kind };
  const enumFields = {
    category: categories,
    policy: [
      'never_delete',
      'never_delete_whole_tree',
      'explicit_review_required',
      'backup_verification_required',
      'rollback_verification_required',
    ],
    status: [
      'complete',
      'partial',
      'unavailable',
      'absent',
      'symlink_not_followed',
      'outside_home_not_scanned',
    ],
    errorCode: [
      ...codes,
      'UNKNOWN',
      'LIMIT_REACHED',
      'PATH_CHANGED',
      'MOUNT_BOUNDARY',
    ],
    reason: ['root_home_not_scanned'],
  };
  for (const [key, allowed] of Object.entries(enumFields))
    if (allowed.includes(data[key])) safe[key] = data[key];
  if (validTarget(data.target)) safe.target = data.target;
  for (const key of [
    'entries',
    'regularFiles',
    'directories',
    'symlinks',
    'otherEntries',
    'uniqueInodes',
    'hardLinkedFiles',
    'sensitiveEntries',
    'visitedEntries',
    'candidateReports',
  ])
    if (Number.isSafeInteger(data[key]) && data[key] >= 0)
      safe[key] = data[key];
  for (const key of [
    'homeIsCanonical',
    'activeRuntimeIdentified',
    'activeDependenciesIdentified',
    'lockPresent',
    'countsAreNotAdditive',
  ])
    if (
      typeof data[key] === 'boolean' ||
      (key === 'lockPresent' && data[key] === null)
    )
      safe[key] = data[key];
  for (const key of [
    'accountQuotaMeasured',
    'deletionPerformed',
    'activityVerified',
    'backupRecoverabilityVerified',
  ])
    if (data[key] === false) safe[key] = false;
  return safe;
}

async function main() {
  if (process.argv.length !== 3) throw Error('no_inventory_arguments_accepted');
  if (process.argv[2] === '--inventory') {
    if (!process.env.HOME) throw Error('home_unavailable');
    await inventory(process.env.HOME, (report) =>
      console.log(JSON.stringify(report)),
    );
  } else if (process.argv[2] === '--filter') {
    let count = 0;
    for await (const line of createInterface({
      input: process.stdin,
      crlfDelay: Infinity,
    })) {
      const report = line.length <= 65536 ? sanitizeInventory(line) : null;
      if (report) {
        console.log(JSON.stringify(report));
        count++;
      }
    }
    if (!count) {
      console.error(
        'No sanitized inventory report received; SSH/activation output suppressed.',
      );
      process.exitCode = 1;
    }
  } else throw Error('unsupported_inventory_mode');
}
if (
  process.argv[1] === '-' ||
  (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
) {
  main().catch(() => {
    console.error(
      'Read-only inode inventory could not complete; raw errors suppressed.',
    );
    process.exitCode = 1;
  });
}
