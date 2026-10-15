import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  mkdtemp,
  writeFile,
  mkdir,
  readdir,
  rm,
  chmod,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { sanitizeDiagnosticLine } from '../scripts/deploy/cpanel-quota-output.mjs';
const workflow = readFileSync(
  '.github/workflows/cpanel-quota-diagnose.yml',
  'utf8',
);
const shell = readFileSync('scripts/deploy/cpanel-quota-diagnose.sh', 'utf8');
const helper = readFileSync('scripts/deploy/backend-deploy.mjs', 'utf8');

test('diagnostic workflow is manual, main-only, read-only and isolated from deployment triggers', () => {
  assert.match(workflow, /name: Diagnose cPanel Quotas/);
  assert.match(workflow, /on:\s*\n\s+workflow_dispatch:\s*\n\npermissions:/);
  assert.match(workflow, /if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /contents: read/);
  const deployment = readFileSync(
    '.github/workflows/backend-deploy.yml',
    'utf8',
  );
  assert.match(deployment, /workflows: \[Backend CI\]/);
  assert.ok(!deployment.includes('Diagnose cPanel Quotas'));

  for (const secret of [
    'CPANEL_SSH_KEY',
    'CPANEL_SSH_PASSPHRASE',
    'CPANEL_HOST',
    'CPANEL_USERNAME',
    'CPANEL_PORT',
  ])
    assert.ok(workflow.includes(`secrets.${secret}`));
  assert.doesNotMatch(
    workflow,
    /workflow_run|push:|pull_request:|PRODUCTION_DATABASE_URL|CPANEL_API_TOKEN|cpanel-deploy\.sh|npm ci/,
  );
  assert.match(shell, /node --input-type=module - --diagnose-quota/);
  assert.match(shell, /< scripts\/deploy\/backend-deploy\.mjs/);
  assert.doesNotMatch(
    shell,
    /\bscp\b|--deploy\b|--preflight\b|migrate|restart|npm\b|mkdir.*\$HOME/,
  );
  const branch = helper.slice(
    helper.indexOf("if (mode === '--diagnose-quota')"),
    helper.indexOf(
      '  const sizes = {',
      helper.indexOf("if (mode === '--diagnose-quota')"),
    ),
  );
  assert.doesNotMatch(
    branch,
    /\bdeploy\(|writeFile|mkdir|unlink|rename|symlink|productionHealth|restart/,
  );
});

test('output filter retains diagnostic facts and strips commands, identities, raw errors and secrets', () => {
  const payload = {
    source: 'local_cpanel_uapi',
    category: 'command_failed',
    exitStatus: 2,
    stdoutKind: 'empty',
    stderrBytes: 208,
    requestedMetrics: ['diskusage', 'fileusage'],
    outputHints: ['cpanel_backend_unavailable', 'SECRET'],
    command: '--user=PRIVATE',
    username: 'PRIVATE',
    stderr: 'SECRET',
    token: 'SECRET',
  };
  const report = sanitizeDiagnosticLine(
    `Cannot verify ACCOUNT disk and inode quotas: ${JSON.stringify(payload)}. Deployment stopped.`,
  );
  assert.equal(report.exitStatus, 2);
  assert.equal(report.stderrBytes, 208);
  assert.deepEqual(report.outputHints, ['cpanel_backend_unavailable']);
  assert.ok(!JSON.stringify(report).match(/SECRET|PRIVATE|command"|stderr"/));
  assert.deepEqual(
    sanitizeDiagnosticLine(
      '{"binary":{"visible":true,"executable":false,"username":"PRIVATE"}}',
    ),
    { binary: { visible: true, executable: false } },
  );
  assert.equal(sanitizeDiagnosticLine('SSH failed for PRIVATE: SECRET'), null);
  assert.equal(sanitizeDiagnosticLine('{"stderr":"SECRET"}'), null);
  assert.equal(
    sanitizeDiagnosticLine('{"category":"SECRET","exitStatus":"PRIVATE"}'),
    null,
  );
});

const bash =
  process.platform === 'win32'
    ? 'C:/Program Files/Git/bin/bash.exe'
    : '/bin/bash';
const posixPath = (path) =>
  process.platform === 'win32'
    ? path
        .replaceAll('\\', '/')
        .replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
    : path;
for (const exitStatus of [0, 1, 255]) {
  test(
    `mocked SSH exit ${exitStatus}: fixed read-only command, filtered output and runner-only cleanup`,
    { skip: !existsSync(bash) },
    async (t) => {
      const root = await mkdtemp(
        join(tmpdir(), 'waterfall-quota-workflow-test-'),
      );
      t.after(async () => {
        assert.ok(basename(root).startsWith('waterfall-quota-workflow-test-'));
        await rm(root, { recursive: true, force: true });
      });
      const bin = join(root, 'bin');
      const runner = join(root, 'runner');
      await mkdir(bin);
      await mkdir(runner);
      const mock = {
        'ssh-agent':
          '#!/bin/sh\nif [ "$1" = "-k" ]; then exit 0; fi\nprintf "SSH_AGENT_PID=99999; export SSH_AGENT_PID;\\n"\n',
        'ssh-add': '#!/bin/sh\nexit 0\n',
        setsid: '#!/bin/sh\nexec "$@"\n',
        ssh: `#!/bin/sh
for arg do last="$arg"; done
expected='source "$HOME/nodevenv/waterfall-backend/22/bin/activate" >/dev/null 2>&1 && node --input-type=module - --diagnose-quota 2>&1'
[ "$last" = "$expected" ] || exit 99
cat > "$DIAGNOSTIC_CAPTURE"
printf '%s\\n' 'RAW-PRIVATE-SSH-ERROR' >&2
printf '%s\\n' '{"binary":{"visible":true,"executable":true}}' 'RAW-PRIVATE-REMOTE-ERROR' '{"category":"command_failed","exitStatus":2,"stderrBytes":208,"username":"RAW-PRIVATE-ACCOUNT"}'
exit ${exitStatus}
`,
      };
      for (const [name, value] of Object.entries(mock)) {
        await writeFile(join(bin, name), value);
        await chmod(join(bin, name), 0o700);
      }
      const capture = join(root, 'streamed-helper');
      const result = spawnSync(
        bash,
        [
          '-c',
          'export PATH="$DIAGNOSTIC_MOCK_BIN:$PATH"; bash "$DIAGNOSTIC_SCRIPT"',
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 20000,
          env: {
            ...process.env,
            DIAGNOSTIC_MOCK_BIN: posixPath(bin),
            DIAGNOSTIC_SCRIPT: posixPath(
              resolve('scripts/deploy/cpanel-quota-diagnose.sh'),
            ),
            DIAGNOSTIC_CAPTURE: posixPath(capture),
            RUNNER_TEMP: posixPath(runner),
            SSH_USER: 'fixture',
            SSH_HOST: 'fixture.invalid',
            SSH_PORT: '22',
            SSH_PRIVATE_KEY: 'FIXTURE-PRIVATE-KEY',
            SSH_PASSPHRASE: 'FIXTURE-PASSPHRASE',
          },
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, exitStatus === 0 ? 0 : 1, result.stderr);
      assert.equal(readFileSync(capture, 'utf8'), helper);
      assert.ok(result.stdout.includes('"stderrBytes":208'));
      assert.ok(
        !`${result.stdout}${result.stderr}`.match(
          /RAW-PRIVATE|FIXTURE-PRIVATE|FIXTURE-PASSPHRASE/,
        ),
      );
      assert.deepEqual(await readdir(runner), []);
    },
  );
}
