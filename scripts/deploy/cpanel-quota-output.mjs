import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const enums = {
  source: ['local_cpanel_uapi'],
  category: [
    'command_or_interpreter_unavailable',
    'command_timeout',
    'execution_denied',
    'command_failed',
    'invalid_json',
    'uapi_rejected',
    'invalid_envelope',
    'missing_metrics',
    'invalid_metric_values',
  ],
  spawnCode: ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ENOBUFS', 'OTHER'],
  stdoutKind: ['empty', 'json', 'text', 'unknown'],
  status: [
    'verified',
    'help_returned',
    'help_unavailable',
    'absent',
    'unreadable',
    'unsafe_path_not_inspected',
    'present_completeness_unknown',
  ],
  hint: ['permission_denied', 'function_or_feature_unavailable', 'unspecified'],
  legacyCommand: ['succeeded'],
  backup: ['backend-20261015-090000'],
};
const hints = [
  'unsupported_cli_arguments',
  'missing_account_context',
  'cpanel_backend_unavailable',
  'permission_denied',
  'quota_exceeded',
  'unsupported_metric',
  'function_unavailable',
];
const booleans = new Set([
  'visible',
  'executable',
  'outputOptionMentioned',
  'userOptionMentioned',
  'permissionHint',
  'diskMetricPresent',
  'inodeMetricPresent',
]);
const numbers = new Set([
  'stdoutBytes',
  'stderrBytes',
  'outputBytes',
  'accountBytes',
  'accountInodes',
  'allocatedBytes',
  'inodeCount',
]);
function pick(object) {
  const safe = {};
  for (const [key, value] of Object.entries(object)) {
    if (enums[key]?.includes(value)) safe[key] = value;
    else if (key === 'spawnCode' && value === null) safe[key] = null;
    else if (booleans.has(key) && typeof value === 'boolean') safe[key] = value;
    else if (
      numbers.has(key) &&
      (value === null || (Number.isSafeInteger(value) && value >= 0))
    )
      safe[key] = value;
    else if (
      key === 'exitStatus' &&
      (value === null ||
        (Number.isInteger(value) && value >= -255 && value <= 255))
    )
      safe[key] = value;
    else if (key === 'uapiStatus' && [null, 0, 1].includes(value))
      safe[key] = value;
    else if (key === 'deletionPerformed' && value === false) safe[key] = false;
    else if (
      key === 'requestedMetrics' &&
      Array.isArray(value) &&
      value.length > 0 &&
      value.length <= 2 &&
      value.every((item) => ['diskusage', 'fileusage'].includes(item))
    )
      safe[key] = value;
    else if (key === 'outputHints' && Array.isArray(value))
      safe[key] = value.filter((item) => hints.includes(item));
    else if (
      ['binary', 'options'].includes(key) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    )
      safe[key] = pick(value);
  }
  return safe;
}

export function sanitizeDiagnosticLine(line) {
  if (line.length > 65536) return null;
  let text = line.trim();
  const prefix = 'Cannot verify ACCOUNT disk and inode quotas: ';
  if (text.startsWith(prefix))
    text = text.slice(prefix.length, text.lastIndexOf('}') + 1);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return null;
  const safe = pick(parsed);
  return Object.keys(safe).length ? safe : null;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let omitted = 0;
  let reports = 0;
  for await (const line of lines) {
    const safe = sanitizeDiagnosticLine(line);
    if (safe) {
      console.log(JSON.stringify(safe));
      reports++;
    } else if (line.trim()) omitted++;
  }
  if (omitted)
    console.log(
      `Suppressed ${omitted} unrecognized diagnostic lines; raw output was not printed.`,
    );
  if (!reports) {
    console.error('No recognized sanitized diagnostic reports received.');
    process.exitCode = 1;
  }
}
