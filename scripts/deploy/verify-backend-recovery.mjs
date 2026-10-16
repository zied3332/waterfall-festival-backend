import { lstat, realpath, opendir } from 'node:fs/promises';
import { join, resolve, dirname, basename, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

const schema = 'backend_recovery_v1';
const backupName = /^backend-\d{8}-\d{6}$/;
const releaseName = /^release-[a-f0-9]{12}-\d+-[a-f0-9]+$/;
const within = (p, root) => p === root || p.startsWith(root + sep);
const overlap = (a, b) => within(a, b) || within(b, a);

// Metadata only. No file bodies, environment files, journals or database data.
export async function verifyRecovery(home, emit, options = {}) {
  const root = await realpath(home);
  if (root !== resolve(home) || dirname(root) === root) throw Error('unsafe_home');
  const deadline = Date.now() + (options.maxMilliseconds ?? 240000);
  const maximum = options.maxEntries ?? 1000000;
  let visited = 0, complete = true, databaseArtifactFound = false;
  const backups = join(root, 'waterfall-backups');
  const app = join(root, 'waterfall-backend');
  const releases = join(root, 'waterfall-releases');
  const protectedRoots = [app, join(root, 'nodevenv/waterfall-backend/22')];
  const expired = () => visited >= maximum || Date.now() >= deadline;
  const canonical = async (p) => { try { return await realpath(p); } catch { return null; } };
  const active = await canonical(join(app, 'dist'));
  let activeBackupReference = active ? within(active, backups) : null;
  const activeRuntimeIdentified = Boolean(active && within(active, root));
  const currentRelease = active && releaseName.test(basename(dirname(active))) ? basename(dirname(active)) : 'unresolved_or_legacy';
  for (const p of [app, join(app, 'node_modules'), join(root, 'nodevenv/waterfall-backend/22'), ...(active ? [dirname(active), join(dirname(active), 'node_modules')] : [])]) {
    const target = await canonical(p);
    if (target) {
      protectedRoots.push(target);
      if (within(target, backups)) activeBackupReference = true;
    }
  }
  const references = [];
  async function walk(start, visit) {
    const stack = [start];
    let done = true, device;
    while (stack.length) {
      if (expired()) { done = false; break; }
      const p = stack.pop();
      try {
        // Reject substituted ancestor symlinks before inspecting a descendant.
        if (p !== start && await canonical(dirname(p)) !== resolve(dirname(p))) { done = false; continue; }
        const s = await lstat(p, { bigint: true });
        visited++;
        device ??= s.dev;
        if (s.dev !== device) { done = false; continue; }
        await visit(p, s);
        if (s.isSymbolicLink()) {
          const target = await canonical(p);
          if (!target) done = false;
          else if (within(target, backups)) references.push(target);
        } else if (s.isDirectory()) {
          if (await canonical(p) !== resolve(p)) { done = false; continue; }
          for await (const item of await opendir(p)) {
            if (expired() || stack.length + visited >= maximum) { done = false; break; }
            stack.push(join(p, item.name));
          }
        }
      } catch { done = false; }
    }
    if (!done) complete = false;
    return done;
  }
  async function list(container, pattern) {
    const result = [];
    try {
      if (await canonical(container) !== resolve(container)) throw Error('unsafe_container');
      for await (const item of await opendir(container)) {
        if (expired() || result.length >= 200) { complete = false; break; }
        if (pattern.test(item.name)) result.push(item.name);
        else complete = false;
      }
    } catch { complete = false; }
    return result.sort();
  }
  const names = await list(backups, backupName);
  const retained = await list(releases, releaseName);
  // References discovered from the active app or any retained release protect targets.
  await walk(app, () => {});
  if (references.length) activeBackupReference = true;
  for (const name of retained) {
    const release = join(releases, name);
    const dist = await canonical(join(release, 'dist'));
    const dependencies = await canonical(join(release, 'node_modules'));
    if (dist && within(dist, backups)) references.push(dist);
    if (dependencies && within(dependencies, backups)) references.push(dependencies);
    await walk(release, () => {});
  }
  const rows = [];
  async function regularUnder(base, relative) {
    let p = base;
    try {
      for (const part of relative.split('/')) {
        p = join(p, part);
        const s = await lstat(p);
        if (s.isSymbolicLink() || await canonical(p) !== resolve(p)) return false;
      }
      const s = await lstat(p);
      return s.isFile() && s.size > 0;
    } catch { return false; }
  }
  for (const name of names) {
    const base = join(backups, name), target = join(base, 'node_modules');
    const row = { schema, kind: 'backup', target: `${name}/node_modules`, restoreTested: false, databaseRecoveryVerified: false, cleanupApproved: false, reclaimableInodes: null };
    let dependencyType = 'unavailable', singleLinkFiles = 0, hardLinkedFiles = 0, symlinks = 0, allocatedBytes = 0;
    const seen = new Set();
    let scanned = false;
    if (await canonical(base) === resolve(base)) {
      try {
        const info = await lstat(target);
        if (info.isSymbolicLink()) dependencyType = 'symlink_target';
        else if (info.isDirectory()) {
          scanned = await walk(target, (p, s) => {
            const identity = `${s.dev}:${s.ino}`;
            if (seen.has(identity)) return;
            seen.add(identity);
            if (s.isFile()) {
              if (s.nlink === 1n) singleLinkFiles++; else hardLinkedFiles++;
            }
            if (s.isSymbolicLink()) symlinks++;
            allocatedBytes += Number(s.blocks ?? 0n) * 512;
          });
          dependencyType = hardLinkedFiles ? 'contains_hardlinks' : 'directory_copy';
        }
      } catch { complete = false; }
    } else complete = false;
    const structuralChecks = [];
    for (const file of ['dist/src/main.js', 'package.json', 'package-lock.json', 'prisma/schema.prisma']) structuralChecks.push(await regularUnder(base, file));
    rows.push({ ...row, structure: structuralChecks.every(Boolean) && scanned ? 'appears_suitable' : 'unverified', dependencyType, scanComplete: scanned, uniqueInodes: seen.size, singleLinkFiles, hardLinkedFiles, symlinks, allocatedBytes, protected: !activeRuntimeIdentified || protectedRoots.some(p => overlap(p, target)), _target: target });
  }
  // Backup links may refer to other backup dependency trees; inspect metadata,
  // never follow symlinks or assume the candidate list exhausts provider backups.
  await walk(backups, (p, s) => {
    if (s.isFile() && /\.(?:sql(?:\.gz)?|dump|backup)$/i.test(p)) databaseArtifactFound = true;
  });
  emit({ schema, kind: 'summary', currentRelease, activeRuntimeIdentified, activeBackupReference, scanComplete: complete, databaseArtifactFound, databaseRecoveryVerified: false, restoreTested: false, cleanupApproved: false, journalsChecked: false, processReferencesChecked: false, externalDatabaseBackupsChecked: false, safestCandidate: 'not_established' });
  for (const row of rows) {
    row.backupReference = references.some(p => overlap(p, row._target));
    row.protected ||= row.backupReference;
    row.referenceScanComplete = complete;
    delete row._target;
    emit(row);
  }
  return complete;
}

export function sanitizeRecovery(line) {
  let d;
  try { d = JSON.parse(line); } catch { return null; }
  if (!d || d.schema !== schema || !['backup', 'summary'].includes(d.kind)) return null;
  const out = { schema, kind: d.kind };
  if (/^backend-\d{8}-\d{6}\/node_modules$/.test(d.target)) out.target = d.target;
  for (const k of ['activeRuntimeIdentified','activeBackupReference','scanComplete','databaseArtifactFound','protected','backupReference','referenceScanComplete']) if (typeof d[k] === 'boolean' || (k === 'activeBackupReference' && d[k] === null)) out[k] = d[k];
  for (const k of ['restoreTested','databaseRecoveryVerified','cleanupApproved','journalsChecked','processReferencesChecked','externalDatabaseBackupsChecked']) if (d[k] === false) out[k] = false;
  for (const k of ['uniqueInodes','singleLinkFiles','hardLinkedFiles','symlinks','allocatedBytes']) if (Number.isSafeInteger(d[k]) && d[k] >= 0) out[k] = d[k];
  if (d.reclaimableInodes === null) out.reclaimableInodes = null;
  if (['appears_suitable','unverified'].includes(d.structure)) out.structure = d.structure;
  if (['unavailable','symlink_target','contains_hardlinks','directory_copy'].includes(d.dependencyType)) out.dependencyType = d.dependencyType;
  if (d.currentRelease === 'unresolved_or_legacy' || (typeof d.currentRelease === 'string' && releaseName.test(d.currentRelease))) out.currentRelease = d.currentRelease;
  if (d.safestCandidate === 'not_established') out.safestCandidate = d.safestCandidate;
  return out;
}

async function main() {
  if (process.argv.length !== 3) throw Error('invalid_mode');
  if (process.argv[2] === '--verify') {
    if (!await verifyRecovery(process.env.HOME, row => console.log(JSON.stringify(row)))) process.exitCode = 1;
  } else if (process.argv[2] === '--filter') {
    let summary = false;
    for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
      const safe = line.length <= 65536 ? sanitizeRecovery(line) : null;
      if (safe) { console.log(JSON.stringify(safe)); if (safe.kind === 'summary') summary = true; }
    }
    if (!summary) process.exitCode = 1;
  } else throw Error('invalid_mode');
}
if (process.argv[1] === '-' || (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)) main().catch(() => { console.error('Recovery verification unavailable; raw errors suppressed.'); process.exitCode = 1; });
