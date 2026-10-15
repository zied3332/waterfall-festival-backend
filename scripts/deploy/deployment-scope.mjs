import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Only files packaged as backend application code qualify automatically.
// Workflow/tooling/docs/tests changes require an explicit manual deployment.
export const qualifies = (path) =>
  /^(?:src\/|prisma\/)/.test(path) ||
  /^(?:package(?:-lock)?\.json|nest-cli\.json|tsconfig(?:\.build)?\.json|prisma\.config\.ts)$/.test(path);

export function classify(before, git = execFileSync) {
  if (!/^[a-f0-9]{40}$/.test(before ?? '') || /^0+$/.test(before)) return false;
  const paths = git('git', ['diff', '--name-only', '--no-renames', '-z', before, 'HEAD'], { encoding: 'utf8' });
  return paths.split('\0').some(qualifies);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // PRs and unknown ranges cannot authorize deployment. Git errors fail CI closed.
  const application = process.env.GITHUB_EVENT_NAME === 'push' && classify(process.env.BEFORE_SHA);
  appendFileSync(process.env.GITHUB_OUTPUT, `application=${application}\n`);
}
