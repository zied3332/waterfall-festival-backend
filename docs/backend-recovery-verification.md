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
