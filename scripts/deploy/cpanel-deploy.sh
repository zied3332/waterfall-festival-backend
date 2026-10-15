#!/usr/bin/env bash
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
mkdir -p "$HOME/.ssh"
printf '%s\n' "$SSH_PRIVATE_KEY" > "$RUNNER_TEMP/deploy_key"
chmod 600 "$RUNNER_TEMP/deploy_key"
eval "$(ssh-agent -s)"
cat > "$RUNNER_TEMP/askpass.sh" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$SSH_PASSPHRASE"
ASKPASS
chmod 700 "$RUNNER_TEMP/askpass.sh"
export SSH_ASKPASS="$RUNNER_TEMP/askpass.sh" SSH_ASKPASS_REQUIRE=force
remote=(ssh -p "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST")
upload=(scp -P "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
incoming_created=false
cleanup() {
  # Only this run's private temporary credential; never a production .env or backup.
  if "$incoming_created"; then
    "${remote[@]}" "rm -f -- \"\$HOME/$incoming/database-url\"" || echo 'Temporary migration credential cleanup needs attention.' >&2
  fi
  rm -f -- "$RUNNER_TEMP/deploy_key" "$RUNNER_TEMP/askpass.sh"
  ssh-agent -k >/dev/null || true
}
trap cleanup EXIT
setsid ssh-add "$RUNNER_TEMP/deploy_key" < /dev/null

activate='source "$HOME/nodevenv/waterfall-backend/22/bin/activate"'
settings="BACKEND_BACKUP_KEEP=$BACKEND_BACKUP_KEEP BACKEND_DEPLOY_RESERVE_MB=$BACKEND_DEPLOY_RESERVE_MB BACKEND_DEPLOY_RESERVE_INODES=$BACKEND_DEPLOY_RESERVE_INODES"
sizes="$archiveBytes $sourceBytes $sourceFiles"
# Read-only remote quota checks run BEFORE uploading anything or creating a backup.
"${remote[@]}" "set -e; $activate; $settings node --input-type=module - --preflight $sizes" < scripts/deploy/backend-deploy.mjs
"${remote[@]}" "umask 077; mkdir -- \"\$HOME/$incoming\""
incoming_created=true
"${upload[@]}" "$RUNNER_TEMP/backend.tar.gz" "$SSH_USER@$SSH_HOST:~/$incoming/backend.tar.gz"
printf '%s' "$PRODUCTION_DATABASE_URL" | "${remote[@]}" "umask 077; cat > \"\$HOME/$incoming/database-url\""
# The helper verifies its backup before installing, migrating or switching code.
"${remote[@]}" "set -e; $activate; $settings node --input-type=module - --deploy $sizes \"\$HOME/$incoming\" $revision" < scripts/deploy/backend-deploy.mjs
