#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

[[ "$SSH_PORT" =~ ^[0-9]+$ && ${#SSH_PORT} -le 5 ]] || { echo 'Invalid SSH port.' >&2; exit 1; }
(( 10#$SSH_PORT >= 1 && 10#$SSH_PORT <= 65535 )) || exit 1
[[ "$SSH_USER" =~ ^[a-zA-Z0-9_]+$ && "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Invalid SSH destination configuration.' >&2; exit 1; }
[[ -n "$SSH_PRIVATE_KEY" ]] || { echo 'Missing SSH key.' >&2; exit 1; }

# Everything created/removed here is on the disposable Actions runner.
diag_dir=$(mktemp -d "$RUNNER_TEMP/cpanel-quota.XXXXXX")
agent_started=false
cleanup() {
  if "$agent_started"; then ssh-agent -k >/dev/null 2>&1 || true; fi
  rm -f -- "$diag_dir/key" "$diag_dir/askpass" "$diag_dir/ssh-errors" "$diag_dir/known_hosts" "$diag_dir/known_hosts.old"
  rmdir -- "$diag_dir" 2>/dev/null || true
}
trap cleanup EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" > "$diag_dir/key"
cat > "$diag_dir/askpass" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$SSH_PASSPHRASE"
ASKPASS
chmod 600 "$diag_dir/key"
chmod 700 "$diag_dir/askpass"
if ! agent_config=$(ssh-agent -s 2>/dev/null); then echo 'SSH agent initialization failed.' >&2; exit 1; fi
if ! eval "$agent_config" >/dev/null 2>&1; then echo 'SSH agent configuration failed.' >&2; exit 1; fi
agent_started=true
unset agent_config
export SSH_ASKPASS="$diag_dir/askpass" SSH_ASKPASS_REQUIRE=force
if ! setsid ssh-add "$diag_dir/key" < /dev/null >/dev/null 2>&1; then
  echo 'SSH key loading failed; raw authentication output suppressed.' >&2
  exit 1
fi

# A single fixed remote command: no mode/command inputs, uploads or remote cleanup.
# Node's sanitized stderr joins stdout; SSH/activation stderr is never printed.
set +e
ssh -p "$SSH_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
  -o UserKnownHostsFile="$diag_dir/known_hosts" "$SSH_USER@$SSH_HOST" \
  'source "$HOME/nodevenv/waterfall-backend/22/bin/activate" >/dev/null 2>&1 && node --input-type=module - --diagnose-quota 2>&1' \
  < scripts/deploy/backend-deploy.mjs 2> "$diag_dir/ssh-errors" \
  | node scripts/deploy/cpanel-quota-output.mjs
pipeline_status=("${PIPESTATUS[@]}")
set -e
if (( pipeline_status[1] != 0 )); then echo 'Diagnostic output filtering failed; do not publish raw logs.' >&2; exit 1; fi
if (( pipeline_status[0] != 0 )); then
  echo "Read-only diagnostic exited with status ${pipeline_status[0]}. Quotas may remain unverified; no deployment was requested. SSH/activation errors are suppressed."
  exit 1
fi
echo 'Read-only quota diagnostic completed. No deployment was requested.'
