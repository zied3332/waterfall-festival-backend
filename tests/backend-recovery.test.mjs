import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, link, rm, realpath, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyRecovery, sanitizeRecovery } from '../scripts/deploy/verify-backend-recovery.mjs';
const name = 'backend-20261015-090000';
async function fixture(t) {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'waterfall-recovery-test-')));
  t.after(async () => { assert.ok(basename(home).startsWith('waterfall-recovery-test-')); await rm(home, { recursive: true, force: true }); });
  const put = async (path) => { await mkdir(join(home,path,'..'), {recursive:true}); await writeFile(join(home,path), 'PRIVATE'); };
  await put('waterfall-backend/dist/src/main.js');
  await mkdir(join(home,'waterfall-releases'));
  for(const file of ['dist/src/main.js','package.json','package-lock.json','prisma/schema.prisma','node_modules/pkg/index.js']) await put(`waterfall-backups/${name}/${file}`);
  return {home,put};
}
test('structural suitability never claims tested restore or confirmed inode savings', async t => {
  const {home}=await fixture(t), rows=[];
  const before=await readdir(home);
  await verifyRecovery(home,r=>rows.push(r));
  const row=rows.find(r=>r.kind==='backup');
  assert.equal(row.structure,'appears_suitable');
  assert.equal(row.restoreTested,false);
  assert.equal(row.reclaimableInodes,null);
  assert.equal(rows[0].databaseRecoveryVerified,false);
  assert.equal(rows[0].safestCandidate,'not_established');
  assert.ok(!JSON.stringify(rows).includes(home));
  assert.deepEqual(await readdir(home),before);
});
test('active release references protect backup dependencies, hard links are reported', async t => {
  const {home,put}=await fixture(t);
  const candidate=join(home,'waterfall-backups',name,'node_modules');
  await symlink(candidate,join(home,'waterfall-backend/node_modules'),process.platform==='win32'?'junction':'dir');
  await link(join(candidate,'pkg/index.js'),join(home,'external-link'));
  await put('waterfall-releases/release-aaaaaaaaaaaa-100-abcd/dist/src/main.js');
  await symlink(candidate,join(home,'waterfall-releases/release-aaaaaaaaaaaa-100-abcd/node_modules'),process.platform==='win32'?'junction':'dir');
  const rows=[];await verifyRecovery(home,r=>rows.push(r));
  assert.equal(rows[0].activeBackupReference,true);
  const row=rows.find(r=>r.kind==='backup');
  assert.equal(row.protected,true);assert.equal(row.backupReference,true);
  assert.equal(row.dependencyType,'contains_hardlinks');assert.equal(row.hardLinkedFiles,1);
});
test('symlinked candidate boundary is not traversed or declared suitable', async t => {
  const {home}=await fixture(t);
  const other='backend-20261014-204213';
  await symlink(join(home,'waterfall-backups',name),join(home,'waterfall-backups',other),process.platform==='win32'?'junction':'dir');
  const rows=[];await verifyRecovery(home,r=>rows.push(r));
  const row=rows.find(r=>r.target===`${other}/node_modules`);
  assert.equal(row.scanComplete,false);assert.equal(row.structure,'unverified');assert.equal(row.uniqueInodes,0);
});
test('budget exhaustion and missing files never establish recovery', async t => {
  const {home}=await fixture(t),rows=[];
  assert.equal(await verifyRecovery(home,r=>rows.push(r),{maxEntries:1}),false);
  assert.equal(rows[0].scanComplete,false);
  assert.ok(rows.filter(r=>r.kind==='backup').every(r=>r.structure==='unverified'));
});
test('database artifact metadata is not a verified database recovery point', async t=>{
  const {home,put}=await fixture(t);await put(`waterfall-backups/${name}/database.dump`);
  const rows=[];await verifyRecovery(home,r=>rows.push(r));
  assert.equal(rows[0].databaseArtifactFound,true);assert.equal(rows[0].databaseRecoveryVerified,false);
  assert.ok(!JSON.stringify(rows).includes('database.dump'));
});
test('output whitelist suppresses sensitive fields and optimistic claims',()=>{
  const safe=sanitizeRecovery(JSON.stringify({schema:'backend_recovery_v1',kind:'backup',target:'/home/PRIVATE',secret:'PRIVATE',restoreTested:true,cleanupApproved:true,reclaimableInodes:999}));
  assert.ok(!JSON.stringify(safe).includes('PRIVATE'));assert.equal(safe.restoreTested,undefined);assert.equal(safe.reclaimableInodes,undefined);
  assert.equal(sanitizeRecovery('raw PRIVATE error'),null);
});
test('workflow is manual-only and SSH executes only the streamed verifier',()=>{
  const workflow=readFileSync('.github/workflows/backend-recovery-verify.yml','utf8');
  assert.match(workflow,/name: Verify Backend Recovery/);assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/workflow_run:|push:|PRODUCTION_DATABASE_URL|CPANEL_API_TOKEN|cpanel-deploy/);
  const source=readFileSync('scripts/deploy/verify-backend-recovery.mjs','utf8');
  assert.doesNotMatch(source,/\b(?:writeFile|readFile|unlink|mkdir|chmod|chown|rename)\b|node:child_process/);
  const wrapper=readFileSync('scripts/deploy/verify-backend-recovery.sh','utf8');
  assert.match(wrapper,/node --input-type=module - --verify 2>&1/);
  assert.doesNotMatch(wrapper,/--deploy|--inventory|\bscp\b/);
});

test('time and entry exhaustion expose finite phase reasons without paths',async t=>{
  const {home}=await fixture(t);
  for (const options of [{maxMilliseconds:0},{maxEntries:1}]) {
    const rows=[];
    assert.equal(await verifyRecovery(home,r=>rows.push(r),options),false);
    const summary=sanitizeRecovery(JSON.stringify(rows[0]));
    const reasons=summary.phases.flatMap(p=>p.reasons);
    assert.ok(reasons.includes(options.maxMilliseconds===0?'time_limit':'entry_limit'));
    assert.equal(summary.databaseScanComplete,false);
    assert.ok(!JSON.stringify(summary).includes(home));
  }
});

test('internal dependency links are distinct from external references and never approve cleanup',async t=>{
  const {home}=await fixture(t);
  const base=join(home,'waterfall-backups',name,'node_modules');
  await symlink(join(base,'pkg'),join(base,'pkg-alias'),process.platform==='win32'?'junction':'dir');
  const rows=[];await verifyRecovery(home,r=>rows.push(r));
  const row=rows.find(r=>r.kind==='backup');
  assert.equal(row.backupReference,false);
  assert.equal(row.cleanupApproved,false);
  assert.equal(row.internalDependencyReference,true);
  assert.equal(row.activeReference,false);
  assert.equal(row.releaseReference,false);
});

test('legacy resolved runtime is distinguished from an unresolved runtime',async t=>{
  const {home}=await fixture(t), rows=[];
  await verifyRecovery(home,r=>rows.push(r));
  assert.equal(rows[0].runtimeLayout,'legacy_directory');
  assert.equal(rows[0].activeRuntimeIdentified,true);
  const missing=join(home,'missing-home');await mkdir(missing);
  const unknown=[];await verifyRecovery(missing,r=>unknown.push(r));
  assert.equal(unknown[0].runtimeLayout,'unresolved');
  assert.ok(unknown[0].phases.some(p=>p.reasons.includes('ENOENT')));
});

test('unresolved links report safe failure reasons and malicious diagnostic strings are suppressed',async t=>{
  const {home}=await fixture(t);
  await symlink(join(home,'missing-PRIVATE'),join(home,'waterfall-backend/broken'),process.platform==='win32'?'junction':'dir');
  const rows=[];assert.equal(await verifyRecovery(home,r=>rows.push(r)),false);
  assert.ok(rows[0].phases.some(p=>p.reasons.includes('unresolved_symlink')));
  const safe=sanitizeRecovery(JSON.stringify({schema:'backend_recovery_v1',kind:'summary',phases:[{phase:'active_references',reasons:['EACCES','PRIVATE /home/user'],elapsedMilliseconds:1,visitedEntries:2},{phase:'PRIVATE',reasons:[]}]}));
  assert.equal(safe.phases.length,1);assert.deepEqual(safe.phases[0].reasons,['EACCES']);
  assert.ok(!JSON.stringify(safe).includes('PRIVATE'));
});

test('targeted mode reuses complete dependency scans but still finds references from unselected backups',async t=>{
  const {home,put}=await fixture(t);
  const other='backend-20261014-204213';
  await put(`waterfall-backups/${other}/node_modules/pkg/other.js`);
  await symlink(join(home,'waterfall-backups',name,'node_modules/pkg'),join(home,'waterfall-backups',other,'node_modules/shared'),process.platform==='win32'?'junction':'dir');
  const rows=[];assert.equal(await verifyRecovery(home,r=>rows.push(r),{candidates:[name]}),true);
  assert.equal(rows[0].targetedMode,true);assert.equal(rows[0].reusedTrees,1);
  const candidates=rows.filter(r=>r.kind==='backup');assert.equal(candidates.length,1);
  assert.equal(candidates[0].otherBackupReference,true);
  assert.equal(candidates[0].backupReference,true);assert.equal(candidates[0].protected,true);
  assert.equal(candidates[0].referenceScanComplete,true);assert.equal(candidates[0].cleanupApproved,false);
});

test('incomplete external coverage protects selected candidates and never authorizes cleanup',async t=>{
  const {home,put}=await fixture(t);
  await put('waterfall-backups/backend-20261014-204213/other/file');
  await symlink(join(home,'missing'),join(home,'waterfall-backups/backend-20261014-204213/broken'),process.platform==='win32'?'junction':'dir');
  const rows=[];assert.equal(await verifyRecovery(home,r=>rows.push(r),{candidates:[name]}),false);
  const row=rows.find(r=>r.kind==='backup');
  assert.equal(row.referenceScanComplete,false);assert.equal(row.referenceUncertain,true);
  assert.equal(row.protected,true);assert.equal(row.cleanupApproved,false);
  assert.equal(row.reclaimableInodes,null);
});

test('candidate selection rejects paths, shell text, duplicates and oversized batches',async t=>{
  const {home}=await fixture(t);
  for(const candidates of [['../secret'],[name+';id'],[name,name],Array(4).fill(name)]) await assert.rejects(verifyRecovery(home,()=>{}, {candidates}));
  const rows=[];assert.equal(await verifyRecovery(home,r=>rows.push(r),{candidates:['backend-20200101-000000']}),false);
  assert.ok(rows[0].phases.some(p=>p.reasons.includes('selected_candidate_missing')));
});

test('database artifact reports are metadata only, deduplicated and exclude migration SQL',async t=>{
  const {home,put}=await fixture(t);
  await put(`waterfall-backups/${name}/node_modules/pkg/database.dump`);
  await put(`waterfall-backups/${name}/prisma/migrations/test/migration.sql`);
  const rows=[];await verifyRecovery(home,r=>rows.push(r),{candidates:[name]});
  const summary=sanitizeRecovery(JSON.stringify(rows[0]));
  assert.equal(summary.artifacts.length,1);assert.equal(summary.artifacts[0].type,'dump');
  assert.equal(summary.artifacts[0].approximateAgeDays,0);
  assert.equal(summary.artifacts[0].verification,'metadata_only_unverified');
  assert.equal(summary.databaseRecoveryVerified,false);
  assert.ok(!JSON.stringify(summary).includes('database.dump'));
  const dirty=sanitizeRecovery(JSON.stringify({schema:'backend_recovery_v1',kind:'summary',artifacts:[{type:'dump',path:'PRIVATE',approximateAgeDays:3,verification:'tested'},{type:'PRIVATE'}]}));
  assert.equal(dirty.artifacts.length,1);assert.ok(!JSON.stringify(dirty).includes('PRIVATE'));
  assert.equal(dirty.artifacts[0].verification,'metadata_only_unverified');
});

test('invalid workflow candidate input is rejected before authentication or remote operations',async t=>{
  const {home}=await fixture(t);
  const before=await readdir(home);
  const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
  for(const selection of [name+';echo PRIVATE',name+",$(id)",[name,name,name,name].join(',')]) {
    const result=spawnSync(bash,['scripts/deploy/verify-backend-recovery.sh'],{encoding:'utf8',env:{...process.env,SSH_PORT:'22',SSH_USER:'fixture',SSH_HOST:'fixture.invalid',SSH_PRIVATE_KEY:'fixture',RUNNER_TEMP:home,RECOVERY_CANDIDATES:selection}});
    assert.equal(result.status,1);assert.match(result.stderr,/Invalid recovery candidate selection/);
    assert.ok(!result.stdout.includes('PRIVATE'));
  }
  assert.deepEqual(await readdir(home),before);
});

test('candidate dependency symlink targets remain protected',async t=>{
  const {home}=await fixture(t);
  const other='backend-20261014-204213';
  await mkdir(join(home,'waterfall-backups',other));
  await symlink(join(home,'waterfall-backups',name,'node_modules'),join(home,'waterfall-backups',other,'node_modules'),process.platform==='win32'?'junction':'dir');
  const rows=[];await verifyRecovery(home,r=>rows.push(r),{candidates:[other]});
  const row=rows.find(r=>r.kind==='backup');
  assert.equal(row.dependencyType,'symlink_target');assert.equal(row.protected,true);
  assert.equal(row.cleanupApproved,false);assert.equal(row.reclaimableInodes,null);
});
