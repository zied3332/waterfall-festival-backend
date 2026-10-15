# Incoming-directory failure investigation and read-only workflow proposal

## Findings for c89c38c / Deploy Backend #24

`IO_ERROR` is an application fallback label, not a proven OS EIO error.
The old `prepareIncoming` catch covers three operations:

| Operation                                 | What can happen                                                                          | Old reported phase/code                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `realpath(home)`                          | Missing/inaccessible home, symlink loop, unknown runtime error                           | `directory creation`; whitelisted code or `IO_ERROR`                         |
| Canonical-home/root validation            | Real home differs from resolved HOME, or HOME resolves to filesystem root                | Plain `Error('Unsafe home')` has no code, so `directory creation / IO_ERROR` |
| `mkdir(join(home, name), { mode: 0700 })` | Collision, permission denial, quota exhaustion, inode/space exhaustion, other OS failure | `directory creation`; whitelisted code or `IO_ERROR`                         |

The invalid identifier check is outside that catch and would produce a different
message. Probe/open/write/fsync failures also have different phase names. Thus
this log confines the failure to home resolution/validation or directory creation;
it does not establish which one ran or failed. No raw error details survive in
the old message, so the exact production operation cannot be recovered from it.

Normal EEXIST, EACCES/EPERM, ENOSPC and EDQUOT are already whitelisted and would
have been printed as such if emitted by Node. They should not be inferred from
`IO_ERROR`. However, an unknown/unmapped runtime error may carry a numeric errno
without a recognized symbolic code; the old wrapper discarded that evidence.
Other errors such as ELOOP were also not whitelisted. See
[libuv error handling](https://docs.libuv.org/en/stable/errors.html): Unix errno
and Windows error numbering differ. Interpret numeric errno on the actual host,
not the local Windows development machine. Do not infer quota from message text.

A successful preflight proves the application/runtime paths were readable at
that point and that supplementary filesystem measurements passed. It does not
prove mkdir permissions or account quota headroom. A stable HOME alias would
normally also fail the earlier application's canonical-path check, making it
less convincing as a diagnosis without inspecting actual sanitized results.
The root-home guard is another distinct possibility. No path restriction should
be relaxed before confirming what the deployment account actually sees.

The SSH wrapper streams `--prepare-incoming` and captures its result. `set -e`
stops on that command's failure, before setting `incoming_created`, SCP, database
credential upload, code backup, staging, migration or activation. The target is
the current SSH HOME plus a fixed numeric run/attempt identifier; SCP is not
involved yet. No destination guessing or fallback protocol can fix this phase.

## Smallest local fix prepared

The helper now separates `home resolution`, `home validation` and `directory
creation`. Canonical mismatch and root-home guards have fixed codes
`HOME_NOT_CANONICAL` and `HOME_IS_ROOT`; recognized additional OS codes including
UNKNOWN and ELOOP are retained. Messages include only bounded numeric errno and
an allowlisted syscall name, never raw errors, paths, user identity or secrets.
Unknown errors remain unknown. This is an observability-only change: exclusive
mkdir, canonical checks, probe ownership/cleanup, and deployment failure behavior
are unchanged. Synthetic tests inject each failure before writes, verifying
classification and redaction. No production operation was attempted.

## Proposed separate workflow (not implemented or triggered)

Name: **Inspect cPanel Incoming Directory**.
Proposed filename: `.github/workflows/cpanel-incoming-inspect.yml`.

- Manual `workflow_dispatch` only, main only, repository contents read permission.
- Numeric required inputs `failed_run_id` and `failed_run_attempt`. The Actions
  run number **#24 is not the numeric run ID**. Inspect the failed deployment's
  `.waterfall-incoming-ID-ATTEMPT`, not the diagnostic workflow's own run ID.
- Reuse the five existing SSH authentication/destination secrets and the working
  agent/askpass setup. Do not request a database URL or an API token.
- Use the same deployment concurrency group, cancellation disabled, short timeout.
- Stream a separate, narrowly scoped read-only Node module through SSH, after
  activating the existing Node environment. Do not upload the script or invoke
  `cpanel-deploy.sh`, `--prepare-incoming`, `--probe-incoming` or `--deploy`.
- Allow only read-only filesystem functions (`lstat`, `stat`, `realpath`,
  `access`, optionally `statfs`). No mkdir, writes, open-for-write, unlink,
  chmod, symlink creation, backup, npm, migrations, restarts or remote cleanup.
- Capture/filter unexpected SSH, activation and Node errors on the runner.
  Print only allowlisted JSON fields; never raw error messages, HOME, paths,
  usernames, uid/gid numbers, keys, tokens, cookies or environment dumps.
- Do not listen to or dispatch deployment events. Completing this diagnostic
  cannot start Deploy Backend. Do not push or trigger the proposal automatically.

### Read-only report fields

1. HOME present/absolute; resolves to root yes/no; realpath matches resolved
   HOME yes/no. Home lstat/stat type: directory, symlink-to-directory, other,
   missing, inaccessible or unknown. No actual home string is printed.
2. Expected parent (HOME) exists and is a directory; canonical-parent relationship
   and whether the app parent agrees with the configured home. No full paths.
3. Compare owner uid to effective process uid in memory only. Report
   `current_user`, `other_owner` or `unknown`, plus group-match classification,
   permission-bit write/search booleans and access(W_OK | X_OK) result. These
   checks are evidence only, not proof that writes or quota checks would pass.
4. Target lstat/realpath classification: absent, existing real directory, symlink,
   file, inaccessible or unknown; canonical parent matches expectation yes/no.
   Do not reuse, clear, rename or remove an existing target.
5. Every failed read/access operation reports its own fixed phase, allowlisted
   code/syscall, and bounded numeric errno. No attempt to reproduce mkdir failure.
6. Optional filesystem free bytes/inodes are labeled supplementary. Account
   quota values stay null/unavailable unless a host-supported, authenticated,
   read-only source has been verified for this exact account. Do not revive the
   removed mandatory UAPI dependency, infer quota from df/du, trust stale cached
   files, substitute plan marketing limits, or invent an unlimited quota.
   Namecheap's authenticated cPanel Disk Usage/File Usage views or provider
   confirmation remain manual options if no reliable machine source is exposed.

### Fundamental limit

A read-only diagnostic cannot reproduce the errno from a forbidden mkdir/write
operation or recover details already discarded by an earlier process. It can
show missing parents, aliases, target collisions and access restrictions, but
cannot prove sufficient quota for a future write. The exact historical mkdir
errno requires retained provider logs, or the local observability fix in a
separately approved future deployment attempt. No deployment attempt is part
of this investigation.

## Recommended next action

Review this proposal and the observability-only patch. Collect the read-only
home/parent/target classifications before changing path logic. If HOME is a
root/alias, establish the provider's supported canonical application parent;
do not bypass the root or symlink safeguards. If a target exists, determine
its ownership/run provenance without deleting it. If errors indicate EDQUOT
or ENOSPC, ask Namecheap to distinguish account bytes, file/inode quota and
filesystem exhaustion. No backup, media or configuration cleanup is authorized.
Only after the operation and cause are established should a functional fix be
selected. No commit, push, workflow trigger or production change was performed.
