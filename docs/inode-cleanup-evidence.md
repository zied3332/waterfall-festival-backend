# Inode recovery: evidence and approval gates

## Evidence source and limits

Reviewed existing manual inventory run
[38805475429](https://github.com/zied3332/waterfall-festival-backend/actions/runs/38805475429).
Only existing sanitized log reports were retrieved; no new remote scan was run.
The workflow succeeded, but the inventory summary is **partial**: 1,051,727
visited entries and 35 candidate reports. The 240-second budget was exhausted.
Success is not proof of complete coverage, backup integrity or account headroom.

The operator's account measurement is 600,140 / 600,000 inodes. Freeing
100,140 would leave 500,000 used and 100,000 free, before concurrent writes.
Fresh cPanel File Usage must establish the actual result. Disk space and
filesystem statistics cannot establish account inode headroom.

## Exact observed backup inventory

All entries below are children of `/home/watezkir/waterfall-backups/`.
These are all **observed** entries, not a certified exhaustive directory listing.
Counts are unique inodes within each row; parent and dependency counts overlap.
Sensitive counts are heuristic flags, not a complete data or secret inventory.
Every complete parent scan found sensitive entries: preserve the parent tree.

| Backup directory | Parent unique inodes | Dependency subtree unique inodes | Sensitive parent entries | Interpretation |
| --- | ---: | ---: | ---: | --- |
| backend-20260909-054224 | 621 | Not traversed: symlink | 1 | Dependency target and recoverability unknown |
| backend-20260909-054647 | 635 | Not traversed: symlink | 2 | Dependency target and recoverability unknown |
| backend-20260909-055344 | 20,484 | 19,850 | 2 | Smaller dependency tree; completeness unknown |
| backend-20260909-060340 | 46,070 | 45,436 | 2 | Directory copy, independence unverified |
| backend-20260912-095628 | 46,070 | 45,436 | 2 | Directory copy, independence unverified |
| backend-20260918-161211 | 46,076 | 45,436 | 2 | Directory copy, independence unverified |
| backend-20260922-153102 | 46,086 | 45,436 | 6 | Directory copy, independence unverified |
| backend-20260922-160022 | 46,086 | 45,436 | 6 | Directory copy, independence unverified |
| backend-20261004-131949 | 46,089 | 45,436 | 8 | Directory copy, independence unverified |
| backend-20261004-135434 | 46,099 | 45,436 | 18 | Directory copy, independence unverified |
| backend-20261014-204213 | 46,103 | 45,436 | 22 | Directory copy, independence unverified |
| backend-20261014-231344 | 46,145 | 45,436 | 37 | Directory copy, independence unverified |
| backend-20261015-081410 | At least 29,812 | Not measured: scan exhausted | Not established | Partial scan does not prove incomplete backup |
| backend-20261015-090000 | 5,869 | 5,147 | 13 | Known failed backup from deployment evidence |

The nine 45,436-inode dependency trees each report two hard-linked regular
files and 49 symlinks. Equal counts do not establish equal content or separate
physical copies. The 19,850 and 5,147 dependency scans report no hard-linked
files and 11 and zero symlinks respectively. These are historical snapshots.

## Active and protected files; recoverability

The active application scan reports 46,187 unique inodes, including 37 sensitive
entries. Active node_modules reports 45,436, and its resolved dependency alias
reports the same count; these are overlapping rows, not separate savings.
Uploads report 24 inodes; the Node 22 environment reports 10. Protect all of
these, including resolved targets and dependencies outside the visible app.

The header identified an active runtime and dependency target and reported no
deployment lock at that moment. It does not prove current process inactivity.
Release inventory and incoming artifact coverage are not established by this
partial result. No release should be considered disposable from these logs.

No current application recovery point, complete usable backup, previous healthy
rollback release, database backup, or absence of backup references is verified.
Every backup could still be needed. Keep all backup trees protected until a
specific recovery source is verified and reserved. A complete metadata scan
means traversal completed, not that backup creation completed successfully.
Code archives exclude the database and media and cannot substitute for either.

## Ranked conditional cleanup shortlist

No row is approved for deletion. Each target must pass the verification below.
Disk recovery is **unmeasured** for every shortlisted subtree; do not extrapolate
from inode counts. The earlier 52,649,984 allocated bytes describes the entire
failed backup, not its node_modules subtree.

| Priority | Exact target | Observed subtree inodes; independently reclaimable estimate | Disk recovered | Why potentially redundant / current protection | Verification / risk |
| --- | --- | --- | --- | --- | --- |
| 1 | /home/watezkir/waterfall-backups/backend-20261015-090000/node_modules | 5,147; unverified, no positive guaranteed saving | Unknown | Failed copy; parent has sensitive data; backup verification required | Exclude all active/recovery references and retain verified recovery source; medium until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20260909-060340/node_modules | 45,436; unverified | Unknown | Potential duplicated dependencies; protected pending recovery review | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20260912-095628/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20260918-161211/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20260922-153102/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20260922-160022/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20261004-131949/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20261004-135434/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20261014-204213/node_modules | 45,436; unverified | Unknown | Same conditional classification | Full checks below; high until verified |
| 2 | /home/watezkir/waterfall-backups/backend-20261014-231344/node_modules | 45,436; unverified | Unknown | May be especially useful as recovery source; retain if selected | Full checks below; high until verified |
| 3 | /home/watezkir/waterfall-backups/backend-20260909-055344/node_modules | 19,850; unverified | Unknown | Different dependency tree may be required for older rollback | Full checks below; high until verified |
| 4 | /home/watezkir/.npm | 8,432; unverified | Unknown | Potential regenerable cache; activity and offline recovery needs unknown | Select cache-only content after checking configuration/credentials and process use; medium |

Priority 2 rows are tied: dates do not establish redundancy. Select only after
identifying the retained recovery source and comparing manifests/references.
Do not select symlinked dependency trees or the unmeasured 081410 tree yet.

For planning only, three independently disposable 45,436-inode trees would
represent 136,308 inodes, exceeding the target by 36,168. Two such trees plus
the reported cache and failed dependency tree give only 104,451, leaving just
4,311 above the target before overlap, credentials/config exclusions, open files
or concurrent writes. Neither sum is verified reclaimable capacity. Prefer
three verified redundant copies if available, while retaining a verified
complete backup with its dependencies. Do not authorize a batch from this sum.

## Additional read-only checks to design/run before cleanup approval

Use the existing working Actions SSH access for a separately reviewed metadata
diagnostic. Do not run deployment, install dependencies, create probes, change
permissions or write remote reports. Stream code and sanitize output on runner.

1. Enumerate every immediate backup/release child before recursive counting;
   paginate the reports so a slow scan cannot hide names. Report a complete
   manifest separately from partial subtree counts. Sanitize identifiers and
   keep unknown names private for operator review; never silently omit them.
2. Independently count each nominated dependency subtree with a separate budget,
   using lstat/opendir, without following links or crossing mounts. Record
   device/inode identities internally, regular-file link counts, directories,
   symlinks and allocated blocks. Output only approved relative target aliases,
   totals, completeness and protected classifications; no file bodies or IDs.
3. For each regular-file identity compare links inside that exact proposed
   deletion set against st_nlink. External links mean no confirmed reclaim for
   that inode. Deduplicate across nominated targets, not just within each row.
   Examine process references/open files with account-visible read-only process
   metadata; unavailable permissions mean unknown, not unused. Directory and
   symlink identity overlap also requires rejection/review. Allocated blocks
   are an estimate, not a promise of quota release on shared/reflink storage.
4. Resolve active dist, app/node_modules, runtime/node_modules and Node environment
   targets; reject all ancestor/descendant overlap with nominated backup trees.
   Inspect symlinks under app, releases and backups without traversing them;
   classify whether destinations reference a nominated backup. Consult existing
   deployment journals for previousRuntime/release pointers through a dedicated
   field allowlist. Never print journals wholesale or expose account paths.
   Confirm startup configuration and owner-known external recovery references.
   No finite local path scan proves that external references do not exist.
5. Compare non-secret package/lock/build manifests and runtime file hashes against
   the designated recovery source. Confirm essential runtime files, complete
   migrations and usable matching dependencies. For existing archives, stream
   integrity/listing checks and output only fixed booleans/counts, never archive
   member names or contents. Do not extract onto production or execute backup
   code. Integrity and matching hashes alone do not prove restore success.
6. Have the owner identify and retain a specific complete known-good backend
   recovery source with dependencies, plus separately preserved media/config.
   Verify any existing isolated restore-test evidence. If no such evidence
   exists, report recoverability unverified; a future isolated restore rehearsal
   needs separate authorization, not changes to the production application.
7. Obtain database backup provenance from the existing backup provider/operator:
   PostgreSQL instance identity, time/RPO, successful completion, retention,
   off-host availability, integrity checks, restore instructions and prior
   isolated restore evidence. Do not dump, query/change the production database
   or inspect SQL bodies. A filename alone is insufficient. Missing evidence
   keeps recoverability unverified and cleanup blocked.

## Future exact-target cleanup approval procedure (no deletion commands)

1. Choose one exact target only after the checks above pass; reserve the verified
   recovery sources and dependencies. Record the expected exclusive inode/block
   savings and evidence time. Obtain explicit approval naming that exact target.
2. Immediately before action, re-resolve its full parent chain and canonical
   target beneath the approved backup parent; require a real directory, same
   device/inode identity, unchanged boundary, no symlink substitution, no active
   overlap, no deployment/npm/recovery activity and no sensitive/persistent data
   inside the proposed subtree. Nested symlinks must never be followed. Detect
   concurrent changes; abort on uncertainty rather than widen the target.
3. A later reviewed cleanup implementation must accept only that exact approved
   target, never glob expansion or the backup parent. It must stop at the first
   error, with no chmod/chown fallback, retry-to-broader-path or automatic extra
   target. No executable cleanup implementation is supplied by this change.
4. After that one separately approved action, check site/media health using
   non-destructive requests and obtain refreshed cPanel account File Usage.
   Allow for provider accounting delay. Stop on mismatch or unexpected health;
   preserve remaining recovery sources and diagnostic evidence. Reassess whether
   more cleanup is needed and obtain new approval for every additional target.
5. Deletion is not undoable. On unexpected impact, stop all cleanup and engage
   the owner with the retained verified recovery source. Recreating dependencies
   or activating/restoring code requires a separately approved recovery operation;
   a database restore is not an automatic response to dependency cleanup. If
   verified recovery or disposable copies cannot be established, ask Namecheap
   for temporary inode relief rather than risk production data.

## Recurrence prevention review

Current deployment archives use an explicit code allowlist, reject code symlinks,
exclude node_modules/uploads/.env/cache/logs/database dumps, enforce 128 MiB /
20,000-file bounds and verify archive membership before promoting a partial
archive. Backup failure stops before staging, migration or activation. The
archive is code-only and cannot provide standalone dependency/media/DB recovery.
No return to recursive whole-backend copies is needed or recommended.

Retention remains report-only. Independent staged release dependency trees and
npm caches can still accumulate; bounded code archives do not solve those inode
costs. Recommend periodic read-only account/inventory review and separately
approved exact-target release/cache maintenance with retained healthy rollback
dependencies. No automatic pruning or production behavior change is implemented.

This preparation changes only local documentation. No production files were
deleted, moved, written, chmod/chowned or restarted; no database changes,
deployment, workflow launch, Git commit or push was performed.
