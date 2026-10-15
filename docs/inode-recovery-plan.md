# Read-only inode inventory and recovery approval plan

## Confirmed cause and recovery target

The operator reports File Usage **600,140 / 600,000**, Disk Usage **19.77 GB /
50 GB**, and a mkdir quota failure (errno -122 / EDQUOT). The current blocker
is account file/inode quota, despite sufficient account bytes and filesystem
space. No live production connection, scan or cleanup was performed locally.

Freeing 100,000 from that reported usage would leave 500,140 used and 99,860
free. Freeing **at least 100,140** would leave 500,000 used and 100,000 free.
Prefer planning for 120,000 or more only if genuinely disposable candidates
exist. The current configured 50,000 inode reserve does not reserve account
capacity, and a fresh release temporarily adds a dependency tree plus npm
cache/build files. Compare measured active dependency counts to the actual
required staging footprint before approving another release. There is no
promise that 100,000 removable inodes exist or that 100,000 will be sufficient.

## Reviewed deployment layout

- `~/waterfall-backend`: existing app, working directory, production environment,
  persistent uploads and runtime `dist`. Entire active app is protected.
- `~/waterfall-backend/node_modules`: may be a symlink into cPanel's Node
  environment. Its resolved target is protected, not a disposable copied tree.
- `~/nodevenv/waterfall-backend/22`: active Node environment, protected.
- `~/waterfall-releases/release-*`: staged code and independent node_modules.
  The release referenced by active `dist` is protected. Other releases can be
  required for rollback, unresolved migration recovery or prior package state.
- `~/waterfall-backups/backend-*`: legacy full-tree backups or minimal code
  archives. Legacy recursive copies can contain thousands of node_modules
  entries plus uploads and `.env`; never delete such a whole tree blindly.
  Compressed code archives occupy one regular-file inode each, so removing
  them usually provides little inode recovery. Integrity/recoverability is not
  established by presence, timestamp, size or archive naming.
- `~/.npm`: cache/log content can contain many small files; first review candidate
  if it is not also a backing path for active dependencies.
- `~/.cache`: secondary cache candidate requiring application-owner review.
- `~/.waterfall-incoming-ID-ATTEMPT`: abandoned or current preparation/upload
  directories. Small archives and empty folders often recover very few inodes.
- `~/waterfall-backend/.dist-before-*`: retained legacy runtimes, protected as
  part of the active app. Never delete an old runtime solely from its age.

The existing locks, filesystem preflight, verified bounded code-only archives,
staging, migration order, recovery and health checks are unchanged by this work.
A lock's absence is not proof that nothing is running: incoming preparation
occurs before deployment lock acquisition, and manual processes may exist.

The earlier failed `backend-20261015-090000` was previously reported to contain
5,869 inodes. That historical count alone is far short of the target and must
be refreshed. Preserve all backups until a known-good recovery source and its
active dependencies have been positively identified. No backup is labeled
known-good or safe to delete by this diagnostic.

## New manual diagnostic

Workflow **Inventory Backend Inodes**:
`.github/workflows/backend-inode-inventory.yml`.

It has only `workflow_dispatch`, is limited to main, uses the existing five SSH
secrets, and shares the existing production concurrency group. It streams
`scripts/deploy/inode-inventory.mjs` through SSH after activating the existing
Node 22 environment. It uploads no helper and creates no remote files,
directories, locks, probes, archives, logs or artifacts. It runs no npm,
application code, migration, quota API, restart or deployment operation.

The Node module imports only metadata/directory read functions. It never reads
file bodies, `.env`, credential contents, database contents or archive contents.
Symlinks are counted without traversal. Explicitly resolved active dependency
targets are counted only inside the canonical home and remain protected.
Symlinked containers, changed paths and mount boundaries are not traversed.
The SSH wrapper's temporary key/askpass/known-hosts/error files and cleanup are
confined to the disposable Actions runner. A runner-side allowlist filter drops
raw shell errors, paths, usernames, arbitrary filenames and credential values.
Only sanitized relative target aliases with known naming patterns are printed.

### Output interpretation

Each `candidate` row includes:

- `target`: a safe home-relative alias; `active-dependencies-N` represents a
  resolved dependency target without disclosing account/home information.
- `category`: active app/dependencies/environment, media, cache, retained release,
  retained backup, backup dependency copy, incoming artifact or legacy runtime.
- `entries`, `regularFiles`, `directories`, `symlinks`, `otherEntries`,
  `uniqueInodes`, `hardLinkedFiles`, `sensitiveEntries`.
- `status`: complete, partial, absent, unavailable, skipped symlink or external
  target. No count is invented for unreadable or unscanned candidates. Partial
  counts are lower bounds only, never deletion/recovery guarantees.
- `policy`: never delete, never delete the whole tree, explicit review required,
  backup verification required or rollback verification required.
- `activityVerified: false`, `backupRecoverabilityVerified: false`: metadata
  scanning cannot establish inactivity or prove successful recovery.

The header reports canonical-home agreement, active-runtime/dependency discovery
and lock presence without exposing paths or identities. Account quota is **not
measured** by this scan. Keep using fresh authenticated cPanel account File
Usage to confirm the provider's actual accounting after separately approved
cleanup; df, statfs or this inventory cannot replace that measurement.

**Counts are not additive.** App, media, dependency and environment rows overlap;
backup dependency-copy rows overlap their backup parents. Hardlinks are
uniquely counted within a row, not deduplicated across rows. An inode with a
link elsewhere or an open file handle may not be freed by removing one entry.
The inventory is a changing snapshot, not a guaranteed account quota total.
Scope is fixed selected paths, not the whole hosting account or other sites,
mailboxes, databases or arbitrary user-selected directories.

The production traversal is bounded to 240 seconds, 1.5 million visited entries
(including repeated overlapping scans) and 200 candidate reports. Cache rows
are counted first. Limits, unreadable/changed paths, unknown names inside
backup/release containers, and unsupported metadata produce partial coverage.
Partial coverage must be reviewed; it is not permission to clean unscanned data.
Scanning metadata still causes shared-hosting I/O and consumes Node memory;
run during a quiet period. Do not repeatedly scan while a deployment is active.

### Launch only after approval

Nothing has been committed, pushed or triggered. After an approved publishing
plan makes this workflow available on main, open Actions -> **Inventory Backend
Inodes** -> Run workflow -> main. No inputs or cleanup commands are accepted.
Share the run URL, commit and filtered header/candidate/summary JSON. Do not
share raw SSH errors, credentials, environment dumps or absolute paths.

Publishing to main still invokes the repository's existing automatic CI and
possible deployment. This new manual diagnostic does not change or trigger
those workflows itself. Obtain approval for publishing with that existing
behavior understood; do not manually start a deployment while investigating.

## Cleanup sequence for a future explicit approval

This is a proposal, **not authorization or executable cleanup code**.

1. Inspect complete inventory rows and confirm there is no current deployment,
   npm process or pending recovery. Positively identify the active dist target,
   active cPanel dependency target and Node environment. If identification is
   incomplete, preserve all possibly referenced releases/dependency trees.
2. Prefer inactive, regenerable `.npm` cache content if it alone provides enough
   inodes and is not an active dependency backing path. Ask the owner to verify
   offline/recovery requirements and preserve credentials/configuration. Review
   `.cache` separately; it may belong to other running applications.
3. Review old incoming directories against their exact GitHub run/attempt and
   terminal status; verify no process uses them. Do not expect many inodes from
   directories containing only one archive. Preserve environment/credential,
   database or media entries discovered there; never approve a broad wildcard.
4. Review dependency copies in a known failed/redundant legacy backup only after
   a separate known-good recoverable backup is verified and retained. Approve
   exact node_modules subtrees rather than a whole legacy backup containing
   uploads, `.env` or database files. The only known-good backup remains protected.
5. Review obsolete release trees only if still necessary: confirm they are not
   active, referenced by a rollback/recovery journal, a known-good recovery path,
   or a running process. Retain the current release and a verified previous
   healthy rollback runtime with its dependencies. Do not delete active or
   ambiguously referenced node_modules. Releases with media/env/database files
   must not be removed wholesale.
6. Compressed code archives are a poor inode target. Keep the only known-good
   backup and recovery essentials; age or retention count alone is insufficient.
7. Before **each** deletion, request explicit approval for concrete target(s),
   expected inode benefit, reason, protected alternatives and recovery plan.
   Re-resolve the exact target under the approved canonical parent; check for
   symlink/path changes, active dependency overlap, sensitive content, current
   journal references, running processes and changed directory identity.
   Abort on any mismatch. Never delete uploads, `.env`, databases, active app,
   active dependencies or the only known-good backup. No deletion commands are
   included in this diagnostic or plan.
8. After separately approved cleanup, refresh cPanel File Usage and confirm
   actual headroom. Do not add overlapping rows or treat unique-inode counts as
   guaranteed recovery. Recheck storage budget and backup recovery before an
   approved deployment. If disposable candidates cannot meet the target, ask
   Namecheap for temporary inode relief or capacity assistance; do not sacrifice
   production data or active dependencies to reach an arbitrary number.

## Local validation

```sh
node --check scripts/deploy/inode-inventory.mjs
bash -n scripts/deploy/inode-inventory.sh
node --test tests/inode-inventory.test.mjs
```

Parse the new workflow YAML and run existing deployment/upload regression tests.
Tests use disposable fixtures, synthetic data and mocked SSH only. They verify
counts, hardlink handling, no symlink traversal, active-path protection,
partial results, redaction, manual trigger isolation, exact streamed command,
and cleanup of runner fixtures. The production deployment files are unchanged.
Production counts and an achievable cleanup total remain pending an explicitly
approved diagnostic run.
