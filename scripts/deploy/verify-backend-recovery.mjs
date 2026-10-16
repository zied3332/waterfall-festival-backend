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
  const selected = options.candidates ?? [];
  if (!Array.isArray(selected) || selected.length > 3 || selected.some(n => typeof n !== 'string' || !backupName.test(n)) || new Set(selected).size !== selected.length) throw Error('invalid_candidates');
  const root = await realpath(home);
  if (root !== resolve(home) || dirname(root) === root) throw Error('unsafe_home');
  const started = Date.now();
  const phases = [];
  let phase = 'discovery';
  let phaseStarted = started, phaseVisited = 0;
  const failures = new Set();
  const safeCodes = ['ENOENT','EACCES','EPERM','ENOSPC','EDQUOT','EIO','ELOOP','ENOTDIR','EMFILE','ENFILE'];
  const fail = reason => { failures.add(reason); };
  const begin = name => {
    phases.push({ phase, elapsedMilliseconds: Date.now() - phaseStarted, visitedEntries: visited - phaseVisited, reasons: [...failures] });
    failures.clear(); phase = name; phaseStarted = Date.now(); phaseVisited = visited;
  };
  const deadline = started + (options.maxMilliseconds ?? 240000);
  const maximum = options.maxEntries ?? 1000000;
  let visited = 0, complete = true, databaseArtifactFound = false;
  const backups = join(root, 'waterfall-backups');
  const app = join(root, 'waterfall-backend');
  const releases = join(root, 'waterfall-releases');
  const protectedRoots = [app, join(root, 'nodevenv/waterfall-backend/22')];
  const expired = () => {
    if (visited >= maximum) { fail('entry_limit'); return true; }
    if (Date.now() >= deadline) { fail('time_limit'); return true; }
    return false;
  };
  const canonical = async (p) => { try { return await realpath(p); } catch (error) { fail(safeCodes.includes(error.code) ? error.code : 'unknown_filesystem_error'); return null; } };
  const active = await canonical(join(app, 'dist'));
  let activeBackupReference = active ? within(active, backups) : null;
  const activeRuntimeIdentified = Boolean(active && within(active, root));
  const runtimeLayout = active === join(app, 'dist') ? 'legacy_directory' : active && within(active, releases) ? 'retained_release' : active ? 'other_resolved_layout' : 'unresolved';
  const currentRelease = active && releaseName.test(basename(dirname(active))) ? basename(dirname(active)) : 'unresolved_or_legacy';
  for (const p of [app, join(app, 'node_modules'), join(root, 'nodevenv/waterfall-backend/22'), ...(active ? [dirname(active), join(dirname(active), 'node_modules')] : [])]) {
    const target = await canonical(p);
    if (target) {
      protectedRoots.push(target);
      if (within(target, backups)) activeBackupReference = true;
    }
  }
  const references = [];
  const completedTrees = new Map();
  let reusedTrees = 0;
  const artifacts = [];
  const artifactIdentities = new Set();
  function observeArtifact(p, s) {
    if (!s.isFile() || /[\\/]prisma[\\/]migrations[\\/].+[\\/]migration\.sql$/i.test(p)) return;
    const match = /\.(sql\.gz|sql|dump|backup)$/i.exec(p);
    if (!match) return;
    databaseArtifactFound = true;
    const identity = `${s.dev}:${s.ino}`;
    if (artifactIdentities.has(identity) || artifacts.length >= 50) return;
    artifactIdentities.add(identity);
    const age = Math.floor((started - Number(s.mtimeMs)) / 86400000);
    artifacts.push({type:match[1].toLowerCase(), approximateAgeDays:age >= 0 && Number.isSafeInteger(age) ? age : null, verification:'metadata_only_unverified'});
  }
  const fingerprint = s => `${s.dev}:${s.ino}:${s.mtimeNs}:${s.ctimeNs}`;
  let referenceOrigin = 'active';
  async function walk(start, visit, reuse = false) {
    const stack = [start];
    let done = true, device;
    while (stack.length) {
      if (expired()) { done = false; break; }
      const p = stack.pop();
      try {
        // Reject substituted ancestor symlinks before inspecting a descendant.
        if (p !== start && await canonical(dirname(p)) !== resolve(dirname(p))) { fail('path_boundary'); done = false; continue; }
        const s = await lstat(p, { bigint: true });
        visited++;
        device ??= s.dev;
        if (s.dev !== device) { fail('mount_boundary'); done = false; continue; }
        await visit(p, s);
        if (reuse && completedTrees.has(p)) {
          if (s.isDirectory() && await canonical(p) === resolve(p) && completedTrees.get(p) === fingerprint(s)) { reusedTrees++; continue; }
          fail('cached_tree_changed'); done = false;
        }
        if (s.isSymbolicLink()) {
          const target = await canonical(p);
          if (!target) { fail('unresolved_symlink'); done = false; }
          else if (within(target, backups)) references.push({ target, source: p, origin: referenceOrigin });
        } else if (s.isDirectory()) {
          if (await canonical(p) !== resolve(p)) { fail('path_boundary'); done = false; continue; }
          for await (const item of await opendir(p)) {
            if (expired() || stack.length + visited >= maximum) { fail('pending_entry_limit'); done = false; break; }
            stack.push(join(p, item.name));
          }
        }
      } catch (error) { fail(safeCodes.includes(error.code) ? error.code : 'unknown_filesystem_error'); done = false; }
    }
    if (!done) complete = false;
    return done;
  }
  async function list(container, pattern) {
    const result = [];
    try {
      if (await canonical(container) !== resolve(container)) throw Object.assign(Error(), { code: 'unsafe_container' });
      for await (const item of await opendir(container)) {
        if (expired() || result.length >= 200) { fail('container_limit'); complete = false; break; }
        if (pattern.test(item.name)) result.push(item.name);
        else { fail('unrecognized_entry'); complete = false; }
      }
    } catch (error) { fail(error.code === 'unsafe_container' ? error.code : safeCodes.includes(error.code) ? error.code : 'unknown_filesystem_error'); complete = false; }
    return result.sort();
  }
  const names = await list(backups, backupName);
  const retained = await list(releases, releaseName);
  // References discovered from the active app or any retained release protect targets.
  begin('active_references');
  await walk(app, () => {});
  if (references.length) activeBackupReference = true;
  begin('release_references');
  referenceOrigin = 'release';
  for (const name of retained) {
    const release = join(releases, name);
    const dist = await canonical(join(release, 'dist'));
    const dependencies = await canonical(join(release, 'node_modules'));
    if (dist && within(dist, backups)) references.push({target: dist, origin: 'release', internal: false});
    if (dependencies && within(dependencies, backups)) references.push({target: dependencies, origin: 'release', internal: false});
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
  referenceOrigin = 'candidate';
  if (selected.some(n => !names.includes(n))) { fail('selected_candidate_missing'); complete = false; }
  for (const name of (selected.length ? selected.filter(n => names.includes(n)) : names)) {
    begin('candidate_dependencies');
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
          let rootFingerprint;
          scanned = await walk(target, (p, s) => {
            if (p === target) rootFingerprint = fingerprint(s);
            observeArtifact(p, s);
            const identity = `${s.dev}:${s.ino}`;
            if (seen.has(identity)) return;
            seen.add(identity);
            if (s.isFile()) {
              if (s.nlink === 1n) singleLinkFiles++; else hardLinkedFiles++;
            }
            if (s.isSymbolicLink()) symlinks++;
            allocatedBytes += Number(s.blocks ?? 0n) * 512;
          });
          if (scanned && rootFingerprint) completedTrees.set(target, rootFingerprint);
          dependencyType = hardLinkedFiles ? 'contains_hardlinks' : 'directory_copy';
        }
      } catch (error) { fail(safeCodes.includes(error.code) ? error.code : 'unknown_filesystem_error'); complete = false; }
    } else { fail('path_boundary'); complete = false; }
    const structuralChecks = [];
    for (const file of ['dist/src/main.js', 'package.json', 'package-lock.json', 'prisma/schema.prisma']) structuralChecks.push(await regularUnder(base, file));
    rows.push({ ...row, structure: structuralChecks.every(Boolean) && scanned ? 'appears_suitable' : 'unverified', dependencyType, scanComplete: scanned, uniqueInodes: seen.size, singleLinkFiles, hardLinkedFiles, symlinks, allocatedBytes, protected: !activeRuntimeIdentified || protectedRoots.some(p => overlap(p, target)), _target: target });
  }
  // Backup links may refer to other backup dependency trees; inspect metadata,
  // never follow symlinks or assume the candidate list exhausts provider backups.
  begin('backup_metadata');
  referenceOrigin = 'backup';
  const databaseScanComplete = await walk(backups, (p, s) => {
    observeArtifact(p, s);
  }, true);
  begin('finished');
  emit({ schema, kind: 'summary', phases, artifacts, reusedTrees, targetedMode: selected.length > 0, visitedEntries: visited, elapsedMilliseconds: Date.now() - started, databaseScanComplete, runtimeLayout, currentRelease, activeRuntimeIdentified, activeBackupReference, scanComplete: complete, databaseArtifactFound, databaseRecoveryVerified: false, restoreTested: false, cleanupApproved: false, journalsChecked: false, processReferencesChecked: false, externalDatabaseBackupsChecked: false, safestCandidate: 'not_established' });
  for (const row of rows) {
    row.internalDependencyReference = references.some(p => p.source && within(p.source, row._target) && within(p.target, row._target));
    const external = references.filter(p => !p.source || !within(p.source, row._target) || !within(p.target, row._target));
    row.backupReference = external.some(p => overlap(p.target, row._target));
    row.activeReference = references.some(p => p.origin === 'active' && overlap(p.target, row._target));
    row.releaseReference = references.some(p => p.origin === 'release' && overlap(p.target, row._target));
    row.otherBackupReference = external.some(p => ['candidate','backup'].includes(p.origin) && overlap(p.target, row._target));
    row.referenceUncertain = !complete;
    row.protected ||= row.backupReference || !complete || !row.scanComplete || row.dependencyType === 'symlink_target';
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
  for (const k of ['activeRuntimeIdentified','activeBackupReference','scanComplete','databaseArtifactFound','protected','backupReference','referenceScanComplete','databaseScanComplete','activeReference','releaseReference','internalDependencyReference','otherBackupReference','referenceUncertain','targetedMode']) if (typeof d[k] === 'boolean' || (k === 'activeBackupReference' && d[k] === null)) out[k] = d[k];
  for (const k of ['restoreTested','databaseRecoveryVerified','cleanupApproved','journalsChecked','processReferencesChecked','externalDatabaseBackupsChecked']) if (d[k] === false) out[k] = false;
  for (const k of ['uniqueInodes','singleLinkFiles','hardLinkedFiles','symlinks','allocatedBytes','visitedEntries','elapsedMilliseconds','reusedTrees']) if (Number.isSafeInteger(d[k]) && d[k] >= 0) out[k] = d[k];
  if (Array.isArray(d.phases)) out.phases = d.phases.slice(0,210).filter(p => p && ['discovery','active_references','release_references','candidate_dependencies','backup_metadata'].includes(p.phase)).map(p => ({phase:p.phase, elapsedMilliseconds:Number.isSafeInteger(p.elapsedMilliseconds) && p.elapsedMilliseconds >= 0 ? p.elapsedMilliseconds : null, visitedEntries:Number.isSafeInteger(p.visitedEntries) && p.visitedEntries >= 0 ? p.visitedEntries : null, reasons:Array.isArray(p.reasons) ? p.reasons.filter(r => ['ENOENT','EACCES','EPERM','ENOSPC','EDQUOT','EIO','ELOOP','ENOTDIR','EMFILE','ENFILE','time_limit','entry_limit','pending_entry_limit','path_boundary','mount_boundary','unresolved_symlink','container_limit','unrecognized_entry','unsafe_container','unknown_filesystem_error','cached_tree_changed','selected_candidate_missing'].includes(r)).slice(0,30) : []}));
  if (Array.isArray(d.artifacts)) out.artifacts = d.artifacts.slice(0,50).filter(a => a && ['sql','sql.gz','dump','backup'].includes(a.type)).map(a => ({type:a.type, approximateAgeDays:Number.isSafeInteger(a.approximateAgeDays) && a.approximateAgeDays >= 0 ? a.approximateAgeDays : null, verification:'metadata_only_unverified'}));
  if (d.fatalReason === 'verification_unavailable') out.fatalReason = d.fatalReason;
  if (d.reclaimableInodes === null) out.reclaimableInodes = null;
  if (['appears_suitable','unverified'].includes(d.structure)) out.structure = d.structure;
  if (['unavailable','symlink_target','contains_hardlinks','directory_copy'].includes(d.dependencyType)) out.dependencyType = d.dependencyType;
  if (d.currentRelease === 'unresolved_or_legacy' || (typeof d.currentRelease === 'string' && releaseName.test(d.currentRelease))) out.currentRelease = d.currentRelease;
  if (['legacy_directory','retained_release','other_resolved_layout','unresolved'].includes(d.runtimeLayout)) out.runtimeLayout = d.runtimeLayout;
  if (d.safestCandidate === 'not_established') out.safestCandidate = d.safestCandidate;
  return out;
}

async function main() {
  if (process.argv.length !== 3 && !(process.argv.length === 4 && process.argv[2] === '--verify')) throw Error('invalid_mode');
  if (process.argv[2] === '--verify') {
    if (!await verifyRecovery(process.env.HOME, row => console.log(JSON.stringify(row)), {candidates:process.argv[3] ? process.argv[3].split(',') : []})) process.exitCode = 1;
  } else if (process.argv[2] === '--filter') {
    let summary = false;
    for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
      const safe = line.length <= 65536 ? sanitizeRecovery(line) : null;
      if (safe) { console.log(JSON.stringify(safe)); if (safe.kind === 'summary') summary = true; }
    }
    if (!summary) process.exitCode = 1;
  } else throw Error('invalid_mode');
}
if (process.argv[1] === '-' || (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)) main().catch(() => { console.log(JSON.stringify({schema,kind:'summary',scanComplete:false,fatalReason:'verification_unavailable',cleanupApproved:false})); process.exitCode = 1; });
