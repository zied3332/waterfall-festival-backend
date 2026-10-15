# Backend deployment backup and recovery

## Cause and remaining production investigation

The old `cp -a "$APP/." "$BACKUP/"` recursively duplicated the entire live
application, including `node_modules`, uploads, production `.env`, caches and
logs. Every run added another unbounded copy. The observed `Disk quota exceeded`
means a quota was hit; that message alone does not distinguish account bytes
from account file/inode limits. It is not evidence that the whole server disk
is full. No production SSH inspection, deletion or configuration change was
performed for this fix. The failed legacy directory is left untouched.

The read-only preflight calls local cPanel UAPI `StatsBar get_stats` with
`display=diskusage|fileusage`, then Node `statfs` for filesystem bytes/inodes.
See [cPanel's StatsBar documentation](https://api.docs.cpanel.net/openapi/cpanel/operation/get_stats/).
It prints only numeric usage/headroom, not API bodies or credentials. It stops
if either account metric or filesystem measurement cannot be obtained. `df`
alone cannot prove that an account has sufficient quota. The host must expose
`/usr/local/cpanel/bin/uapi` to the SSH account and support these metrics. If it
does not, obtain verified account quota measurements from Namecheap before
adapting this preflight; do not bypass the check.

## What the workflow does

The existing GitHub Actions -> cPanel SSH -> Node 22 -> Prisma migrate deploy
-> Passenger restart workflow is retained. Deployments are serialized, and
only successful main-branch push CI runs or a manual main-branch run qualify.

1. Build and test locally on the runner. Package an explicit code allowlist:
   `dist`, `src`, `prisma`, package manifests and build/Prisma configuration.
   Exclude media, dependencies, `.env*`, logs, caches, temporary directories,
   keys and database dumps; retain actual Prisma migration SQL.
2. Stream a read-only preflight over SSH before uploading anything. Check both
   account and filesystem limits. Recheck under an exclusive deployment lock.
3. Create and verify a minimal compressed rollback archive using the active
   runtime's code. A partial/failed archive never qualifies as a backup.
   Stop before dependency installation, migrations or activation if it fails.
4. Extract into a new `~/waterfall-releases/release-*` directory and install
   independent dependencies there. Build with the existing dummy build URL.
   Active dependencies are never overwritten by `npm ci`.
5. Run the existing Prisma migration procedure from that staged release using
   this run's private temporary database URL. Never log subprocess output or
   secret values. On migration failure, leave the active runtime unchanged.
6. Switch only `waterfall-backend/dist` to the verified release, update root
   package metadata, and request the existing Passenger restart. The application
   directory and working directory stay `~/waterfall-backend`: uploads, `.env`,
   other production configuration and the original node_modules stay in place.
7. Retry the existing public API health check. Restore the previous runtime
   and package manifests and request restart on activation/health failure.

The first conversion of a real `dist` directory requires two renames, with a
brief recoverable gap. It retains `.dist-before-*`. Later symlink replacements
are atomic on Linux. Retained release dependencies support rollback; their
real paths supply the new runtime's imports. Do not set Node's
`--preserve-symlinks` flags. Confirm this runtime layout on an isolated cPanel
staging app before enabling a production run. Do not manually rebuild from
stale source in the application root; source/config for a new runtime resides
in its release directory.

Each prepared release contains `deployment.json`, previous package manifests,
and the previous runtime location. A process kill, SSH loss or host restart
can prevent automatic recovery; the journal and retained runtimes allow an
operator to recover the dist pointer and package metadata, then touch the
existing `tmp/restart.txt`. An incomplete automatic recovery retains the lock as well.
A leftover `.waterfall-deploy.lock` deliberately
blocks another deployment: inspect the process and journal before any manual
unlock. Failed releases, partial archives and incoming packages remain for
inspection. Only this run's temporary database credential is cleaned up.

Database changes are not reversed by code rollback. Migrations must remain
compatible with the previous runtime; maintain a separately verified database
backup and apply the existing migration review procedure before release.
Code archives contain neither a database backup nor an uploads backup.
The health check confirms `{status:"running"}` only; it does not attest a
specific revision, all endpoints, or completed database migration semantics.

## Configurable storage budget and retention

Optional GitHub repository variables (positive integers):

| Variable                        | Default | Meaning                                                     |
| ------------------------------- | ------- | ----------------------------------------------------------- |
| `BACKEND_DEPLOY_RESERVE_MB`     | 1024    | Extra free bytes budget for npm/cache/build activity        |
| `BACKEND_DEPLOY_RESERVE_INODES` | 50000   | Extra file/inode budget for dependencies and build activity |
| `BACKEND_BACKUP_KEEP`           | 5       | Desired count of complete code backups                      |

The preflight also budgets the incoming compressed package, its expanded code,
and an upper bound for the compressed active code backup. Reserve values are
headroom checks, not a guarantee against concurrent account writes or delayed
quota accounting. npm installation failures still stop before activation.
Staging requires room for one additional dependency tree. Existing retained
runtimes/dependencies still occupy space and must be managed deliberately.

Retention is **report-only in this change**. It reports complete managed archive
counts, excess over the configured count, and legacy/partial entries. It never
deletes a backup, release, uploaded image or production configuration. There is
no scheduled pruning task. If the account is already full, an operator must
review the failed backup and quota usage, then separately authorize cleanup or
increase capacity before retrying. Changing the retention count does not free
space automatically.

## Safe validation without deployment

From the repository, after installing existing dependencies:

```sh
node --check scripts/deploy/backend-deploy.mjs
bash -n scripts/deploy/cpanel-deploy.sh
node --test tests/backend-deploy.test.mjs
npm run lint:check
npm run build
```

Fixture tests use disposable local directories, dummy credentials and mocked
npm/migration/health operations. They test archive exclusions and migration
inclusion, account-vs-filesystem quota failures, no-write preflight, report-only
retention, failure before activation, and health-failure rollback. They never
connect to production. CI runs them on Linux, including repeated atomic
symlink promotion/recovery tests that Windows cannot reproduce reliably.

To test the host's measurement support separately, an operator can activate the
existing Node environment and stream this helper with `--preflight` and the
runner package's three positive size values (`archiveBytes sourceBytes
sourceFiles`). That mode only reads local files and quota statistics; it never
creates a backup or deploys. Do not execute `cpanel-deploy.sh` for a dry run:
that is the real deployment entry point. Use an isolated staging cPanel app
with synthetic uploads/config and a disposable PostgreSQL database for a full
SSH, Passenger, migration and recovery rehearsal before production rollout.
