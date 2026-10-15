#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
[[ "$SSH_PORT" =~ ^[0-9]+$ && ${#SSH_PORT} -le 5 ]] || { echo 'Invalid SSH port.' >&2; exit 1; }
(( 10#$SSH_PORT >= 1 && 10#$SSH_PORT <= 65535 )) || exit 1
[[ "$SSH_USER" =~ ^[a-zA-Z0-9_]+$ && "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Invalid SSH settings.' >&2; exit 1; }
[[ -n "$SSH_PRIVATE_KEY" ]] || { echo 'Missing SSH key.' >&2; exit 1; }
# Temporary authentication files exist only on the disposable Actions runner.
inventory_dir=$(mktemp -d "$RUNNER_TEMP/inode-inventory.XXXXXX")
agent_started=false
cleanup() {
  if "$agent_started"; then ssh-agent -k >/dev/null 2>&1 || true; fi
  rm -f -- "$inventory_dir/key" "$inventory_dir/askpass" "$inventory_dir/known_hosts" "$inventory_dir/known_hosts.old" "$inventory_dir/ssh-errors"
  rmdir -- "$inventory_dir" 2>/dev/null || true
}
trap cleanup EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$inventory_dir/key"
cat > "$inventory_dir/askpass" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$SSH_PASSPHRASE"
ASKPASS
chmod 600 "$inventory_dir/key"
chmod 700 "$inventory_dir/askpass"
if ! agent_config=$(ssh-agent -s 2>/dev/null); then echo 'SSH agent unavailable.' >&2; exit 1; fi
eval "$agent_config" >/dev/null 2>&1
agent_started=true
unset agent_config
export SSH_ASKPASS="$inventory_dir/askpass" SSH_ASKPASS_REQUIRE=force
if ! setsid ssh-add "$inventory_dir/key" < /dev/null >/dev/null 2>&1; then echo 'SSH authentication setup failed; raw output suppressed.' >&2; exit 1; fi
set +e
ssh -p "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  -o UserKnownHostsFile="$inventory_dir/known_hosts" -o ConnectTimeout=20 \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=3 "$SSH_USER@$SSH_HOST" \
  'source "$HOME/nodevenv/waterfall-backend/22/bin/activate" >/dev/null 2>&1 && node --input-type=module - --inventory 2>&1' \
  < scripts/deploy/inode-inventory.mjs 2> "$inventory_dir/ssh-errors" \
  | node scripts/deploy/inode-inventory.mjs --filter
statuses=("${PIPESTATUS[@]}")
set -e
if (( statuses[0] != 0 || statuses[1] != 0 )); then echo 'Read-only inventory incomplete or SSH unavailable; raw errors suppressed. No cleanup or deployment requested.' >&2; exit 1; fi
echo 'Read-only inventory finished. Inspect partial statuses and protection policies; counts are not additive. No cleanup or deployment requested.'
