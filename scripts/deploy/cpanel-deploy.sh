#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

# Only validated numeric/hex identifiers are interpolated into remote commands.
for value in "$archiveBytes" "$sourceBytes" "$sourceFiles" "$BACKEND_BACKUP_KEEP" "$BACKEND_DEPLOY_RESERVE_MB" "$BACKEND_DEPLOY_RESERVE_INODES" "$GITHUB_RUN_ID" "$GITHUB_RUN_ATTEMPT" "$SSH_PORT"; do
  [[ "$value" =~ ^[0-9]+$ && "$value" != 0 ]] || { echo 'Invalid deployment numeric setting.' >&2; exit 1; }
done
revision=$(git rev-parse HEAD)
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 1
[[ -n "$PRODUCTION_DATABASE_URL" ]] || { echo 'Missing production migration secret.' >&2; exit 1; }
incoming=".waterfall-incoming-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
printf '%s\n' "$SSH_PRIVATE_KEY" > "$RUNNER_TEMP/deploy_key"
chmod 600 "$RUNNER_TEMP/deploy_key"
eval "$(ssh-agent -s)" >/dev/null
cat > "$RUNNER_TEMP/askpass.sh" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$SSH_PASSPHRASE"
ASKPASS
chmod 700 "$RUNNER_TEMP/askpass.sh"
export SSH_ASKPASS="$RUNNER_TEMP/askpass.sh" SSH_ASKPASS_REQUIRE=force
remote=(ssh -p "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$RUNNER_TEMP/deploy_known_hosts" "$SSH_USER@$SSH_HOST")
upload=(scp -P "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$RUNNER_TEMP/deploy_known_hosts")
incoming_created=false
incoming_path=''
cleanup() {
  # Only this run's private temporary credential; never a production .env or backup.
  if "$incoming_created"; then
    "${remote[@]}" "rm -f -- \"$incoming_path/database-url\"" || echo 'Temporary migration credential cleanup needs attention.' >&2
  fi
  rm -f -- "$RUNNER_TEMP/deploy_key" "$RUNNER_TEMP/askpass.sh" "$RUNNER_TEMP/backend-upload-errors" "$RUNNER_TEMP/deploy_known_hosts" "$RUNNER_TEMP/deploy_known_hosts.old"
  ssh-agent -k >/dev/null || true
}
trap cleanup EXIT
if ! setsid ssh-add "$RUNNER_TEMP/deploy_key" < /dev/null >/dev/null 2>&1; then
  echo 'SSH key loading failed; raw authentication output suppressed.' >&2
  exit 1
fi

activate='source "$HOME/nodevenv/waterfall-backend/22/bin/activate"'
settings="BACKEND_BACKUP_KEEP=$BACKEND_BACKUP_KEEP BACKEND_DEPLOY_RESERVE_MB=$BACKEND_DEPLOY_RESERVE_MB BACKEND_DEPLOY_RESERVE_INODES=$BACKEND_DEPLOY_RESERVE_INODES"
sizes="$archiveBytes $sourceBytes $sourceFiles"
# Supplementary filesystem checks run before upload. They do not prove account quota headroom.
if ! "${remote[@]}" "set -e; $activate; $settings node --input-type=module - --preflight $sizes" < scripts/deploy/backend-deploy.mjs; then
  echo 'Filesystem preflight failed; deployment stopped before upload. Nothing was deleted.' >&2
  exit 1
fi
# Obtain the canonical destination through SSH; never rely on SFTP '~' expansion.
incoming_path=$("${remote[@]}" "set -e; $activate; node --input-type=module - --prepare-incoming $incoming" < scripts/deploy/backend-deploy.mjs)
if [[ ! "$incoming_path" =~ ^/([a-zA-Z0-9._-]+/)*\.waterfall-incoming-[0-9]+-[0-9]+$ || "${incoming_path##*/}" != "$incoming" || "/$incoming_path/" == *'/../'* || "/$incoming_path/" == *'/./'* ]]; then
  echo 'Invalid absolute incoming path returned by SSH; upload stopped.' >&2
  exit 1
fi
incoming_created=true
echo 'Incoming directory verified; exclusive 4096-byte write/fsync probe passed and was removed. This does not prove account quota headroom.'
if ! "${upload[@]}" "$RUNNER_TEMP/backend.tar.gz" "$SSH_USER@$SSH_HOST:$incoming_path/backend.tar.gz" > "$RUNNER_TEMP/backend-upload-errors" 2>&1; then
  node scripts/deploy/backend-deploy.mjs --upload-error "$RUNNER_TEMP/backend-upload-errors"
  echo 'SCP failed; probing only this run-owned incoming directory. No alternate protocol or destination will be tried.' >&2
  "${remote[@]}" "set -e; $activate; node --input-type=module - --probe-incoming $incoming" < scripts/deploy/backend-deploy.mjs || echo 'Post-failure write probe failed; storage or permissions require operator attention.' >&2
  exit 1
fi
"${remote[@]}" "set -e; $activate; node --input-type=module - --verify-incoming $incoming $archiveBytes" < scripts/deploy/backend-deploy.mjs
printf '%s' "$PRODUCTION_DATABASE_URL" | "${remote[@]}" "umask 077; cat > \"$incoming_path/database-url\""
# The helper verifies its backup before installing, migrating or switching code.
"${remote[@]}" "set -e; $activate; $settings node --input-type=module - --deploy $sizes \"$incoming_path\" $revision" < scripts/deploy/backend-deploy.mjs
