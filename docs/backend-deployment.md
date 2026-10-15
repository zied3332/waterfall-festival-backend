# Backend deployment and uploaded-media monitoring

## Supported layout and scope

The established workflow remains GitHub Actions -> SSH -> the existing cPanel
Node 22 environment -> Prisma migrate deploy -> Passenger restart. The app stays
at `~/waterfall-backend`, with startup file `dist/src/main.js` and application
working directory `~/waterfall-backend`. Activation is sourced from
`~/nodevenv/waterfall-backend/22/bin/activate`.

The repository's uploaders and static media mount both use the application
working directory. Gallery images/videos live in `uploads/gallery/images` and
`uploads/gallery/videos`; event posters live in `uploads/events`. Preserve that
working directory, persistent uploads and production `.env`/Passenger settings.
A release changes only the runtime pointer and root package manifests. It does
not replace the application directory or install into active node_modules.

The existing scripts and upload layout were reviewed locally. Production was
not accessed during this change. Confirm the release layout on an isolated
Namecheap staging app before rollout: the host must allow symlinks to the
sibling `~/waterfall-releases` directory and an independent dependency tree.
The active app must be a real directory, and its `dist` must resolve either to
that app or an approved retained release; other layouts stop before changes.
Node `--preserve-symlinks` options are rejected because imports must resolve
against each release's own dependencies.

## Media statistics and compatibility

`GET /admin/storage/stats` is unchanged. It requires the existing administrator
JWT and ADMIN role and reads actual regular media files from the uploaders'
captured roots. It returns gallery image/video and event poster counts, bytes,
averages, largest sizes, totals, category percentages and measurement warnings.
Missing or unreadable directories remain partial/unavailable, not fabricated
zero totals. Complete measurements may be cached for five seconds. See
[the existing media statistics contract](storage-monitoring.md).

The frontend still calls `GET /admin/storage/hosting`, so that authenticated
route remains as a deprecated compatibility endpoint:

```json
{
  "status": "unavailable",
  "source": "cpanel_uapi",
  "measuredAt": null,
  "quotaBytes": null,
  "usedBytes": null,
  "availableBytes": null,
  "usagePercent": null,
  "isUnlimited": false,
  "errorCode": "integration_disabled"
}
```

`source` retains the legacy identifier solely because the existing frontend
parser requires it. No cPanel request or measurement occurs. The frontend
accepts this response and shows unavailable hosting values while media usage
continues working. Null capacity is never interpreted as unlimited or zero.

The cPanel HTTP client/parser/diagnostics, local UAPI probes, diagnostic CLI,
and manual quota diagnostic workflow have been removed. The backend no longer
reads `CPANEL_HOST`, `CPANEL_USERNAME` or `CPANEL_API_TOKEN`; it never invokes
StatsBar or Quota APIs. Existing production environment variables are untouched.
The GitHub secret names `CPANEL_HOST` and `CPANEL_USERNAME` are still needed by
the established SSH transport, along with its key, passphrase and port. They
are SSH destination settings here, not a hosting statistics integration.

## Deployment sequence and safeguards

1. Existing trusted-main CI/manual gating and serialized deployment remain.
2. The runner installs/builds and creates a code-only package using explicit
   allowed roots: `dist`, `src`, `prisma`, package manifests and required build
   configuration. No Dockerfile, uploads, node_modules, `.env*`, caches, logs,
   private keys or database dumps/files are archived. Actual Prisma migration
   SQL is included. Symlinks/special archive members and unsafe paths are rejected.
3. Before upload, a read-only filesystem preflight checks free bytes and inodes.
   A deployment lock is acquired before repeating that check and making a
   rollback archive. Code size is bounded to 128 MiB and 20,000 regular files;
   compressed archives are also limited to 128 MiB. Archive contents are listed
   and verified exactly before a `.partial` archive is renamed complete.
4. A failed backup immediately stops deployment, before npm, migration or code
   activation. Existing code is untouched. There is no recursive app backup.
5. A fresh sibling release gets code, its own npm ci/build with a dummy database
   URL, and a regular compiled entrypoint/syntax check. The active dependency
   tree, uploads and environment files are never staging destinations.
6. The existing Prisma 7 `migrate deploy` runs from the staged release using a
   private per-run temporary production database URL. A failure stops before
   activation. Subprocess output and credentials are never logged. Retain a
   separately verified recoverable PostgreSQL backup before release; code
   archives are not database backups. Review migration compatibility first.
   The gallery cleanup migration is additive, but pending production migration
   state has not been verified here.
7. Switch `dist` and package metadata, request the existing Passenger restart,
   and retry the existing HTTPS API `{status:"running"}` health check. Restore
   the previous runtime/manifests and request restart on activation/health
   failure. Database changes are never automatically reversed.

The first promotion of a physical `dist` needs two renames, with a brief
recoverable gap. It retains `.dist-before-*`. Later symlink promotion is atomic
on Linux. Old dependencies/releases remain available for recovery. Prepared
releases retain `deployment.json` and previous package manifests. Process
termination or SSH loss may require operator recovery from that journal.
An incomplete recovery retains `.waterfall-deploy.lock`; inspect the process
and journal before any separately authorized unlock. The public health check
checks service availability, not a revision or every application endpoint.

## Filesystem checks are supplementary, not account quotas

No cPanel account quota is required or measured. Preflight explicitly reports
`scope: filesystem_only`, `accountQuotaVerified: false` and a warning that free
filesystem capacity does **not** prove account quota headroom. Missing/invalid
filesystem readings or insufficient bytes/inodes still block deployment.
Actual writes may fail with `Disk quota exceeded` even when these checks pass;
archive creation, staging, build and migration failures remain guarded.

Optional existing positive-integer GitHub repository variables:

| Variable                        | Default | Purpose                                         |
| ------------------------------- | ------- | ----------------------------------------------- |
| `BACKEND_DEPLOY_RESERVE_MB`     | 1024    | Extra bytes budget for npm/cache/build activity |
| `BACKEND_DEPLOY_RESERVE_INODES` | 50000   | Extra file/inode budget for dependencies/build  |
| `BACKEND_BACKUP_KEEP`           | 5       | Desired retained complete code archive count    |

Bytes also budget the current code backup, incoming compressed package and
expanded source. These conservative checks cannot reserve storage or prevent
concurrent account writes. Staging needs one additional dependency tree.
Retention remains report-only: excess archive counts are reported, never
pruned. No backups, releases, uploads or production configuration are deleted.
Only a run's private temporary migration credential is cleaned up. The earlier
failed backup remains untouched; its reported 52,649,984 bytes and 5,869 inodes
still occupy account resources until a separate authorized cleanup decision.

## Frontend changes to make separately

The sibling frontend repository was inspected read-only. Its current parser
accepts the disabled compatibility response. No frontend files were edited.

In `waterfall-festival-website/src`:

- `admin/pages/AdminStorage.tsx`: remove the `AdminHostingCapacity` and
  `useHostingStorage` imports, hook call and capacity component. Update the
  sentence about separate hosting measurements. Keep `getAdminStorageStats`,
  gallery/video/poster cards, media breakdown, counts, bytes and refresh/error UI.
- `admin/hooks/useHostingStorage.ts`: retire the hosting request hook.
- `admin/components/AdminHostingCapacity.tsx`: retire hosting capacity cards.
- `services/hosting.service.ts`: retire `getAdminHostingStats` and its
  `/admin/storage/hosting` request/parser once callers are removed.
- `types/hosting.ts` and `admin/utils/hosting.ts`: retire unused hosting types,
  formatting and messages (including instructions to configure cPanel tokens).
- `admin/style/admin-storage.css`: remove only unused hosting styles after
  checking consumers; preserve shared media dashboard styles.

Keep `/admin/storage/stats`, `services/storage.service.ts`, `types/storage.ts`,
`admin/utils/storage.ts`, `AdminStorageBreakdown` and the uploaded-media dashboard.
No local-media response change is required. Review any UI estimator separately;
measured media totals must not be presented as estimates of hosting capacity.

## Local validation and production preparation

```sh
node --test tests/backend-deploy.test.mjs
bash -n scripts/deploy/cpanel-deploy.sh
node --check scripts/deploy/backend-deploy.mjs
npm run lint:check
npm test -- --runInBand
npm run build
```

Parse both remaining workflow YAML files and check their embedded shell syntax.
Fixture deployment tests mock npm/migration/health operations and prove staging
is outside the active app, preserve media/config/dependencies, and exercise
preflight, backup, install, build, migration and health failures. Fixtures never
connect to production. Linux CI also tests atomic linked-runtime replacement.

Before an approved production release: verify a recoverable database backup,
review pending migrations, rehearse the Namecheap staged runtime/Passenger
working directory, and ensure actual account writes are possible. No successful
production release is claimed by this local preparation. Do not run the real
SSH entry point as a dry run. No commit, push, workflow trigger or deployment
was performed during preparation.

## File inventory and proposed commit

Modified:

```text
.github/workflows/backend-ci.yml
package.json
scripts/deploy/backend-deploy.mjs
scripts/deploy/cpanel-deploy.sh
src/storage/hosting-storage.dto.ts
src/storage/hosting-storage.service.ts
src/storage/hosting-storage.service.spec.ts
src/storage/storage.controller.ts
src/storage/storage.controller.spec.ts
src/storage/storage.module.ts
tests/backend-deploy.test.mjs
docs/backend-deployment.md
docs/hosting-storage-monitoring.md
docs/cpanel-403-investigation.md
```

Removed obsolete quota integration code and its tests/workflow:

```text
.github/workflows/cpanel-quota-diagnose.yml
scripts/deploy/cpanel-quota-diagnose.sh
scripts/deploy/cpanel-quota-output.mjs
src/storage/cpanel-client.service.ts
src/storage/cpanel-client.service.spec.ts
src/storage/cpanel-diagnostic-command.ts
src/storage/cpanel-diagnostics.ts
src/storage/cpanel-diagnostics.spec.ts
src/storage/cpanel-disk-parser.ts
tests/cpanel-quota-workflow.test.mjs
```

The measured media service/DTO, uploaders, gallery cleanup worker, Prisma
migrations and production deployment trigger/authentication/health workflow
are preserved. The unrelated untracked Dockerfile is excluded.

Recommended commit message:
`fix(deploy): remove cPanel quota dependency and preserve media statistics`

## SCP incoming-path verification

The deployment at `0077c14` created `"$HOME/.waterfall-incoming-RUN-ATTEMPT"`
through SSH, but passed `~/.waterfall-incoming-RUN-ATTEMPT/backend.tar.gz` to
SCP. Those are two independently interpreted paths. Modern
[OpenSSH SCP uses SFTP](https://man.openbsd.org/man1/scp.1), and tilde support
depends on the server/protocol. The reported generic `dest open ...: Failure`
does not prove tilde expansion caused the failure. Account quota, permissions,
or different SSH/SFTP filesystem namespaces remain possible. No production
connection was made during this fix, so the host-side cause is not confirmed.

The revised preparation sequence is:

1. Keep the existing supplementary filesystem preflight.
2. Stream the helper with `--prepare-incoming NAME`. It validates the canonical
   home and identifier, creates a fresh private directory without recursive
   mkdir or reuse, and verifies a real nonsymlink directory and write access.
3. Exclusively create a randomized `.write-probe-*` file inside that new
   directory, write 4096 zero bytes, fsync, close and remove only that probe.
   Errors distinguish EDQUOT, ENOSPC, EACCES/EPERM, EROFS and other fixed codes;
   raw errors, account paths and credentials are not logged. Probe cleanup
   failures also stop preparation. A failed directory remains for inspection.
4. Capture the verified absolute directory through SSH stdout. The runner
   validates its characters, absolute form and exact run identifier, rejecting
   whitespace, shell metacharacters, traversal, banners and multiline output.
   The path is held privately and used for SCP, migration credentials and the
   deployment helper. No tilde expansion or fallback to legacy SCP is used.
5. SCP to that exact absolute path. On error, report a fixed sanitized category
   and run only another small probe in this run's incoming directory, then
   stop. A generic SFTP Failure remains unknown, not labeled as a proven quota
   or path error. Neither raw SCP output nor credentials are printed.
6. On successful SCP, verify through SSH that `backend.tar.gz` is a regular
   nonsymlink file with the expected byte length (and within the archive cap)
   before sending a database URL or invoking deployment. Archive validation,
   code backup, locking, staging, migrations, recovery and health checks remain.

A successful small write verifies that operation only. It does **not** prove
account quota headroom for an archive, dependencies or database operations.
If SSH probes succeed but SFTP fails, ask Namecheap to confirm whether its SSH
and SFTP namespaces expose the same absolute home path and whether SFTP writes
are permitted. Do not retry using guessed paths or automatically force `-O`.
If the probe reports EDQUOT/ENOSPC, review account limits with the provider;
backup or media deletion needs separate authorization. An uploaded partial
archive is left intact for investigation. Existing backups, uploads, `.env`
and database files are never probe or upload destinations.

New regression tests in `tests/cpanel-upload.test.mjs` cover directory creation,
collisions, traversal/symlink rejection, sanitized quota/permission failures,
probe cleanup, transferred file verification and the absolute SCP destination.
Mocked SSH/SCP tests exercise success and failures before upload, during SCP,
and after upload, ensuring no deployment occurs on failure. Both CI and the
production workflow run these tests on the runner before SSH. All local tests
use disposable fixtures and mocks, not production connections.
