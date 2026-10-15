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

## Quota preflight failure investigation (2026-10-15)

The supplied Actions log confirms successful SSH authentication and execution
of the remote Node preflight. It does **not** establish whether the UAPI binary
is available, executable, permitted, or returns usable account metrics. The
previous catch block collapsed all those cases into one message. The exact
read-only command being executed (argv, not a shell pipeline) is:

```sh
/usr/local/cpanel/bin/uapi --output=json StatsBar get_stats 'display=diskusage|fileusage' warnings=0 warnout=1
```

The path follows [cPanel's CloudLinux command-line guidance](https://api.docs.cpanel.net/cpanel/introduction).
The pipe is one argument and is not interpreted as a shell pipe. No account
API token is passed to the local CLI. Do not add root privileges or change the
hosting shell/jail to make this work. Availability inside this particular
Namecheap SSH environment has not been verified from this workspace.

The new error includes fixed, sanitized diagnostics:

| Category                             | Meaning / action                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `command_or_interpreter_unavailable` | Spawn returned ENOENT: executable or its interpreter is not visible. Ask support about the account's SSH jail. |
| `execution_denied`                   | EACCES/EPERM, or a permission-denial hint from a failed command. Ask support to confirm permitted access.      |
| `command_timeout`                    | Command exceeded 15 seconds. Ask support to check the local quota service.                                     |
| `command_failed`                     | Nonzero exit or another spawn failure; report the numeric exit status and permission hint to support.          |
| `invalid_json`                       | CLI returned a non-JSON payload. Only output byte length is reported.                                          |
| `uapi_rejected`                      | JSON status indicates failure; only a fixed permission/unsupported-function classification is exposed.         |
| `invalid_envelope`                   | JSON does not contain a recognized success/failure envelope.                                                   |
| `missing_metrics`                    | Disk or file quota row is absent; metric-presence booleans are shown.                                          |
| `invalid_metric_values`              | Counts, units or limits cannot be verified. No values or API bodies are echoed.                                |

No stderr, arbitrary exception text, raw API errors, cookies, environment values
or credentials are included in these diagnostics. Account limits remain
mandatory; successful `df`, `du`, or filesystem `statfs` cannot replace them.

### Independent sources and manual intervention

Namecheap documents [cPanel File Usage / Inodes Usage](https://www.namecheap.com/support/knowledgebase/article.aspx/9331/29/how-to-check-the-number-of-inodes-in-your-hosting-account/)
and [cPanel Disk Usage](https://www.namecheap.com/support/knowledgebase/article/9797/29/cpanel-control-panel-overview/).
Use those authenticated account views to establish current usage and the
actual account limits, then ask Namecheap support to confirm both if unclear.
Do not substitute advertised plan limits for verified account-specific limits.

An independent **access path** is authenticated HTTPS UAPI on the configured
cPanel host, with TLS verification enabled and no redirects:
`GET /execute/StatsBar/get_stats?display=diskusage%7Cfileusage&warnings=0&warnout=1`.
This bypasses CLI visibility restrictions; it is not an independent underlying
quota measurement. The existing `npm run diagnose:cpanel` can test the current
HTTPS client securely, but presently requests disk usage **only** and cannot
satisfy this deployment's inode requirement. Earlier HTTP 403 evidence means
that transport is not a verified fallback for this account. A response must
be authenticated for the same SSH account and include valid disk **and** inode
usage/limits before any integration could be enabled.

[cPanel Quota::get_quota_info](https://api.docs.cpanel.net/openapi/cpanel/operation/get_quota_info/)
is another documented read-only endpoint to investigate with support. Its
availability, returned fields/units, account identity and freshness must be
verified on this host before writing an adapter. No automatic fallback, saved
JSON snapshot, manual quota override, new token, or production configuration
change is introduced here. Standard per-user `quota` output can also be
inspected if the host exposes it, but cannot be assumed available in a shared
hosting jail or assumed to cover every account-specific restriction.

### Read-only diagnostic and failed legacy backup

From a trusted local Bash terminal with existing authorized SSH access, stream
the updated helper without uploading it or triggering deployment (replace only
the SSH placeholders):

```sh
ssh -p <port> <user>@<host> 'source "$HOME/nodevenv/waterfall-backend/22/bin/activate" && node --input-type=module - --diagnose-quota' < scripts/deploy/backend-deploy.mjs
```

This reports quota diagnostics, then inspects only
`~/waterfall-backups/backend-20261015-090000`. It reports absence, unsafe path,
unreadable path, or existence with allocated bytes and inode count
when `du` supports those measurements. Symlinked paths are not traversed.
`null` means measurement unavailable, **not zero**. Presence does not prove
backup completeness. These totals do not prove account headroom.

After a failed preflight, the SSH script also requests this same read-only
backup inspection using `--inspect-backup` before exiting with failure. It
never reaches upload, backup creation, npm installation, migration or code
activation. Both diagnostic modes make no deletions or configuration changes.
The earlier partial backup may still consume substantial bytes/inodes, but
its existence and size have **not** been verified on production here. A backup
inspection failure is reported separately and does not unblock deployment.

Safest next action: run the streamed diagnostic and inspect the authenticated
cPanel usage/limit views. Give Namecheap the fixed diagnostic category, numeric
exit status, server/account identity and backup totals. Ask them to confirm a
supported read-only quota source and current account byte/file limits. Review
any incomplete backup with its owner; cleanup requires a separate explicit
authorization. Keep deployment blocked until both quota measurements and
sufficient headroom can be verified.

## Exit status 2 and explicit account context

New production evidence supplied by the operator: the original command exited
with status **2**, and `backend-20261015-090000` uses **52,649,984 allocated
bytes** (about 50.2 MiB) and **5,869 inodes**. These measurements establish that
the failed backup occupies space; they do not identify the exhausted account
limit or prove sufficient remaining headroom. No backup was removed.

Exit 2 shows a child process launched and failed. It is not a direct ENOENT or
EACCES spawn error. It does not, by itself, prove incorrect arguments, missing
`fileusage`, an unavailable cPanel backend, or exhausted quotas. cPanel's
published documentation does not establish a unique meaning for this exit
status. The old diagnostic did not preserve enough classified evidence to
identify its exact cause retrospectively.

A concrete code issue was found: the command omitted explicit account context.
[cPanel's current CLI guidance](https://support.cpanel.net/hc/en-us/articles/360053404634-Using-cPanel-s-APIs-from-the-command-line)
specifies `--user` with the account-level username; its
[UAPI introduction](https://api.docs.cpanel.net/cpanel/introduction) documents
`--output=json` and the full CloudLinux executable path. The corrected command
is equivalent to this read-only command, executed as the existing SSH account:

```sh
/usr/local/cpanel/bin/uapi --output=json --user="$(id -un)" StatsBar get_stats 'display=diskusage|fileusage' warnings=0 warnout=1
```

The implementation obtains the current username from the OS, not environment
variables or arbitrary configuration, validates it, and passes it as one argv
entry. It refuses root and never logs the username; diagnostics show
`--user=<current-ssh-user>`. No escalation or hosting configuration change is
introduced. This corrects a documented invocation mismatch, but is not yet a
confirmed explanation for this installation's exit 2.

`display` remains a single argv entry; the pipe is never a shell operator.
`diskusage` and `fileusage` availability still depends on the installed cPanel
version and account/server configuration. The current installation has not
been queried directly from this workspace. Do not declare `fileusage`
unsupported simply because the combined command failed.

The updated `--diagnose-quota` mode performs only read-only probes:

1. Check executable visibility/access, returning booleans without paths or identity.
2. Request `uapi --help`, returning only whether output/user options are mentioned.
   Missing help text is not proof that an option is unsupported.
3. Compare the original combined invocation without `--user` to the corrected one.
4. Request `display=diskusage` and `display=fileusage` separately with `--user`.
5. Inspect the known legacy backup as before.

Nonzero exits now expose only byte counts, JSON/text/empty output shape,
recognized UAPI status, numeric exit status and fixed hints for invalid CLI
options, missing account context, missing cPanel components, access denial,
quota exhaustion and unsupported metrics. Raw stdout/stderr, user identities,
API bodies and credentials are never emitted. A valid JSON payload from a
failed process is classified but is **never accepted as quota verification**.
Unknown exit-2 failures remain unknown rather than receiving a guessed cause.

Disk and inode quotas can be verified independently if their individual calls
return valid usage, limits and units. A disk-only success cannot satisfy the
inode requirement. Normal deployment still requires both metrics in a
successful combined response; individual probes are diagnostic, not a bypass.
If only individual calls work, verify that behavior with Namecheap before
changing the acceptance procedure. If neither works, ask support to examine
account context, CLI argument support, jailed execution and cPanel backend
availability using the sanitized hints.

Other read-only candidates remain authenticated cPanel Disk Usage / File Usage,
HTTPS StatsBar and Quota::get_quota_info, or host-exposed per-user quota reports.
Their coverage of both limits, units, freshness and account identity must be
confirmed on this installation before adding an adapter. The previously
observed HTTP 403 makes HTTPS an unverified alternative. Filesystem `df` or
`statfs` and directory `du` are supplementary measurements only.

Safest next step: run the streamed `--diagnose-quota` command documented above
using existing authorized SSH access, without pushing or deploying. If adding
`--user` succeeds and the original invocation fails, the missing context is
confirmed. Otherwise use the fixed output hints and separate metric results
to request a Namecheap investigation. Keep deployment blocked until both
account quotas and sufficient headroom are verifiable. Do not remove the
known failed backup without a separate authorized cleanup decision.
