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

## Proposed optimization after run #2

The operator confirmed time_limit in backup_metadata, a legacy_directory active
runtime, and no active/release references in completed checks. This does not
establish complete reference coverage or usable database recovery.

The workflow now accepts an optional `candidates` string with one to three
comma-separated exact legacy backup names, for example:
`backend-20261015-090000,backend-20261014-204213`.
Blank preserves full candidate counting. Both the shell and Node validate names;
no paths, shell operators, arbitrary commands or broader patterns are accepted.
Selection limits detailed dependency counts, NOT external-reference coverage.
The app, retained releases and backup container are still traversed. References
from unselected trees are collected; timeout, unreadable paths, unresolved links
or unknown entries keep coverage incomplete, fail the job and protect candidates.

Completed dependency scans contribute both link and database-artifact metadata.
The later backup traversal reuses those records only for matching canonical,
real directory roots with matching device/inode and root mtime/ctime fingerprints.
Changed roots fail closed and are rescanned within the original budget. Incomplete
scans are never reused. This avoids a second full dependency-tree traversal for
counted candidates. It is a snapshot, not an atomic filesystem view: unchanged
root metadata cannot prove no nested file changed concurrently. No cleanup is
authorized by cached records; immediate pre-cleanup verification remains mandatory.
Metadata from unselected backups is still scanned once. Scanning an entire hosting
account or all external/provider references is outside this helper's scope.

Internal dependency links now require BOTH source and resolved destination to
lie within the exact same candidate subtree. They are reported separately and
no longer imply an external backupReference. Active and release references,
links from another backup or the candidate's parent, and links to a candidate's
ancestor remain external protections. Unknown target/coverage protects every
selected row. cleanupApproved stays false and reclaimableInodes stays null even
when only internal links are found.

Database artifact reports contain only extension type (`sql`, `sql.gz`, `dump`,
`backup`), approximate whole-day age from mtime (null for future/unusable times),
and fixed metadata_only_unverified status. At most 50 distinct artifact inodes
are reported; no names, paths, contents, credentials or database identities.
Known Prisma migration.sql paths are excluded. Other package SQL or unrelated
files can still be false positives. Provider/off-host backups, restore integrity
and freshness against the required RPO still require owner confirmation.

Check first the failed backup dependency tree
`backend-20261015-090000/node_modules` (previously 5,147 inodes), together with
`backend-20261014-204213/node_modules` (previously approximately 45,436). These are
verification candidates only, not deletion priorities based on age. Preserve
`backend-20261014-231344` as a potential recovery-source candidate pending actual
verification; its date alone establishes no completeness. A subsequent approved
batch can inspect `backend-20261004-131949/node_modules` and
`backend-20260922-153102/node_modules` if reference and recovery evidence supports
further review. None is confirmed disposable or independently reclaimable.

The 240-second / one-million-entry budgets remain unchanged. Targeted mode does
not guarantee completion: unselected external-reference trees still consume I/O.
Review phase diagnostics before proposing any further narrowing; never treat
skipped external scopes as evidence that a candidate is unused. No scan, database
change, deployment, restart, deletion, commit or push accompanies this local patch.
