/** Requires Studio build and public Host package artifacts; subprocesses use plain Node. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const fixture = fileURLToPath(new URL('./fixtures/roles-restart-process.mjs', import.meta.url));
const roles = {
  implementer: { instructions: 'Implement the requested change and run focused checks.', provider: 'test', model: 'fixed-model', reasoningEffort: 'high' },
  reviewer: { instructions: 'Review the change without editing implementation files.', provider: 'test', model: 'fixed-model', reasoningEffort: 'low' },
};

async function runProcess(root, phase, input) {
  // No inherited --import/loader flags or credentials: this is the installed-artifact plane.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_OPTIONS' && !/KEY|SECRET|TOKEN|PASSWORD/i.test(key)));
  const { stdout, stderr } = await execute(process.execPath, [fixture, root, phase, JSON.stringify(input)], { env, timeout: 20_000 });
  assert.equal(stderr, '');
  return JSON.parse(stdout);
}

test('saved roles survive a cold process restart while the previous process CAS token is rejected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-roles-restart-'));
  const realRoot = await realpath(root);
  try {
    const first = await runProcess(root, 'apply', { roles });
    assert.equal(first.state.status, 'applied');
    assert.equal(first.state.failure, null);
    assert.deepEqual(first.state.roles, roles);
    assert.ok(first.state.snapshotId);
    assert.equal(first.state.appliedSnapshotId, first.state.snapshotId);
    const second = await runProcess(root, 'restore', { roles, previous: first.state });
    assert.notEqual(second.pid, first.pid);
    assert.notEqual(second.state.processId, first.state.processId);
    assert.equal(second.state.revision, 0);
    assert.equal(second.state.snapshotId, first.state.snapshotId);
    assert.equal(second.state.appliedSnapshotId, first.state.snapshotId);
    assert.equal(second.state.status, 'applied');
    assert.equal(second.state.failure, null);
    assert.deepEqual(second.state.roles, roles);
    assert.equal(second.staleRejected, true);
    for (const role of ['implementer', 'reviewer']) {
      assert.deepEqual(first.captures[role], { snapshotId: first.state.snapshotId, settings: roles[role] });
      assert.deepEqual(second.captures[role], first.captures[role]);
    }
  } finally {
    assert.equal(resolve(root), root);
    assert.ok(root.startsWith(join(tmpdir(), 'studio-roles-restart-')));
    assert.equal(await realpath(root), realRoot);
    await rm(root, { recursive: true, force: true });
  }
});
