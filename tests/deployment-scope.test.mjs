import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify, qualifies } from '../scripts/deploy/deployment-scope.mjs';

test('diagnostic publication and deployment tooling do not authorize automatic deployment', () => {
  for (const path of ['.github/workflows/backend-inode-inventory.yml', '.github/workflows/backend-deploy.yml', '.github/workflows/backend-ci.yml', 'scripts/deploy/inode-inventory.mjs', 'scripts/deploy/deployment-scope.mjs', 'docs/inode-recovery-plan.md', 'tests/inode-inventory.test.mjs']) assert.equal(qualifies(path), false);
});
test('runtime, dependency and migration changes qualify, including mixed pushes', () => {
  for (const path of ['src/main.ts', 'prisma/migrations/new/migration.sql', 'package.json', 'package-lock.json', 'tsconfig.build.json', 'nest-cli.json', 'prisma.config.ts']) assert.equal(qualifies(path), true);
  const before = 'a'.repeat(40);
  assert.equal(classify(before, (command, args) => {
    assert.equal(command, 'git');
    assert.deepEqual(args, ['diff', '--name-only', '--no-renames', '-z', before, 'HEAD']);
    return 'docs/a.md\0src/main.ts\0';
  }), true);
  assert.equal(classify(before, () => 'docs/a.md\0'), false);
});
test('missing ranges fail closed and git failures cannot authorize deployment', () => {
  for (const before of [undefined, '', '0'.repeat(40), '--anything']) assert.equal(classify(before), false);
  assert.throws(() => classify('a'.repeat(40), () => { throw Error('missing history'); }));
});
test('workflow gate requires same-run successful eligibility; manual path remains main-only', () => {
  const ci = readFileSync('.github/workflows/backend-ci.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/backend-deploy.yml', 'utf8');
  assert.match(ci, /fetch-depth: 0/);
  assert.match(ci, /github.event.before/);
  assert.match(ci, /needs.changes.outputs.application == 'true'/);
  assert.match(deploy, /run_id: run.id, filter: 'latest'/);
  assert.match(deploy, /job.name === 'Application changes qualify for deployment' && job.conclusion === 'success'/);
  assert.match(deploy, /context.eventName === 'workflow_dispatch' && context.ref === 'refs\/heads\/main'/);
  assert.match(deploy, /if: needs.eligibility.outputs.allowed == 'true'/);
  assert.match(deploy, /run.event === 'push' && run.head_branch === 'main'/);
});
