# Verify Backend Recovery (manual and read-only)

Prepared locally; not published or run. Workflow:
`.github/workflows/backend-recovery-verify.yml`, **Verify Backend Recovery**.
After a separate approved publication, select it in Actions, choose main and
Run workflow. No inputs, deployment, backup creation, migrations or restart.
Existing SSH authentication, runner-only credential cleanup, production
concurrency and a runner output allowlist follow the inode inventory pattern.
Runner chmod secures temporary authentication files only; no remote chmod/chown.

The streamed Node helper imports only lstat/realpath/opendir for filesystem
access. It reads no file bodies, environment files, secrets, journal contents,
SQL or database contents. It resolves active dist/dependency targets, checks
links in the active app and retained releases, lists recognized legacy backup
directories, checks nonempty regular essential runtime/manifests/schema files,
and scans dependency metadata without traversing links or mount boundaries.
Unknown backup/release names (including code archives), unreadable directories,
changed paths, unresolved links or exhausted budgets make coverage incomplete.
Incomplete coverage fails the remote command; sanitized reports are retained
in workflow output. Complete metadata coverage does not certify recoverability.

`appears_suitable` means only that essential files and a traversable dependency
directory exist. Package compatibility, dependency completeness, archive
integrity, application execution and a tested restore are NOT established.
All outputs retain `restoreTested:false`, `databaseRecoveryVerified:false` and
`cleanupApproved:false`. Never delete the only recovery source based on this.

Database artifact detection searches metadata below waterfall-backups only
for `.sql`, `.sql.gz`, `.dump` and `.backup` names. These may include migration
SQL or unrelated files. A match is NOT a database recovery point. No match is
NOT evidence that off-host/provider backups are absent. Obtain backup provider
provenance, retention, integrity and prior isolated restore evidence separately.

Single-link regular-file counts are potential exclusive file inodes at scan
time; hard-linked files are excluded from that estimate. Directories and
symlink entries are not included in that potential-file count. Per-candidate
allocated blocks are observed metadata, not guaranteed disk recovery. Counts
are not additive across candidates. Symlink targets remain protected. No
confirmed reclaimable estimate is emitted: `reclaimableInodes:null`. Open-file
references, races, process use, deployment journal pointers and external recovery
references remain unchecked. Symlinks within candidates can make a directory
copy dependent on external files, even when no hard links are observed.

The helper intentionally reports `safestCandidate:not_established`: an automated
metadata scan cannot authorize cleanup. Review exact backup dependency aliases
against docs/inode-cleanup-evidence.md, reserve verified recovery sources and
complete missing checks before requesting exact-target deletion approval.
Active application and resolved runtime/dependency roots, and backup targets
referenced by observed symlinks, are protected. Unknown active runtime protects
all candidates. No absence of observed links proves absence of references.

Traversal is bounded to 240 seconds / one million metadata visits, and each
container enumeration to 200 recognized entries. The app/release scans may
consume the budget before backup checks finish. Partial counts are lower bounds.
Run during a quiet period; metadata scanning still consumes shared-hosting I/O.

Local validation: Node syntax check, Bash syntax check, YAML parsing,
`node --test tests/backend-recovery.test.mjs`, plus existing deployment,
inventory, upload and deployment-scope regressions. Fixtures are local only.
No deployment gate or production behavior is changed by this preparation.

## Failed run #1 investigation and proposed diagnostic improvement

Existing run 38908375590 connected and emitted JSON, then failed deliberately
because scanComplete was false. Its recovery job ran 13:30:36?13:34:49 UTC on
2026-10-16 (253 seconds). The helper's global metadata budget is 240 seconds.
Time exhaustion is strongly suggested, but the old code discarded the exact
reason: permission errors, missing/unrecognized entries, broken links, mount
boundaries and the one-million-entry limit could also mark coverage incomplete.
The GitHub 12-minute timeout was not reached. Neither EDQUOT nor ENOSPC has
been established by this read-only run. databaseArtifactFound:false with an
incomplete database scan is inconclusive, not proof of absent backups.

Proposed local changes add finite per-phase reason lists, visit counts and
elapsed milliseconds: discovery, active references, release references,
individual candidate dependency traversals and final backup metadata traversal.
Reasons distinguish time/entry/pending-entry/container limits, path/mount
boundaries, unresolved symlinks, unrecognized entries and allowlisted filesystem
error codes. Codes from optional absent paths can appear even when a phase's
required traversal completes; reason presence alone is not proof of fatal error.
Fatal verifier failures emit only a fixed machine-readable unavailable reason.
The runner separately reports numeric SSH/helper and output-filter exit statuses;
SSH status 1 alone cannot distinguish transport failure from helper failure,
so correlate it with the structured scan summary. No raw exception is printed.

The old reference collection treated every resolved symlink into waterfall-backups
as a reference, including a backup's own node_modules/.bin links. Such internal
links can set backupReference/protected without active-backend usage. The old
log does not identify the origin; do not dismiss those flags as false positives.
New booleans separate activeReference, releaseReference,
internalDependencyReference and otherBackupReference. All previously observed
references still set backupReference and protected, including internal links.
No cleanup protection or automatic approval criterion has been relaxed.

runtimeLayout now distinguishes legacy_directory, retained_release,
other_resolved_layout and unresolved. The previous unresolved_or_legacy value
alone did not prove a failed realpath; a normal app/dist directory also produced
that label. The reported activeRuntimeIdentified:true establishes resolution
inside the home, not a tested runnable application or known healthy revision.

The expensive pattern scans the app and releases, scans every backup dependency
subtree, then scans the entire backup container again for links/database names.
A second run with phase diagnostics would show which phase consumes the budget.
Do not simply increase limits on the shared host. Prefer a future reviewed
small exact-candidate mode with independent phase budgets, preserving broad
reference coverage or explicitly marking it incomplete. A selected candidate
cannot be declared unreferenced by skipping other releases/backups. This patch
adds phase observability without changing scan scope or raising budgets; no
new workflow inputs or arbitrary remote commands are accepted. Obtain approval
before publishing or running the instrumented verifier.
