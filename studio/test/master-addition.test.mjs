import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseComposition } from '../src/host/composition-plan.ts';
import { disabledHere, masterAddition } from '../src/host/shell.ts';

const minimal = parseComposition(readFileSync(new URL('../../packages/bundle/web-app/presets/minimal.patch.yml', import.meta.url), 'utf8'))[0].insert[0].config.plugins;
const group = minimal.find(row => row.id === 'persistent-shell');
const terminalBash = group.config.find(row => row.id === 'terminal-bash');

test('platform gates are evaluated only in the process.platform form; anything else counts as off', () => {
  assert.equal(disabledHere({ name: 'a', disabled: { __jsExpr: "process.platform === 'win32'" } }, 'darwin'), false);
  assert.equal(disabledHere({ name: 'a', disabled: { __jsExpr: "process.platform !== 'win32'" } }, 'darwin'), true);
  assert.equal(disabledHere({ name: 'a', disabled: { __jsExpr: 'someFlag()' } }, 'darwin'), true);
  assert.equal(disabledHere({ name: 'a', disabled: true }), true);
  assert.equal(disabledHere({ name: 'a' }), false);
});

test('a grouped plugin comes with its isolated group and this platform\'s siblings', () => {
  const restore = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  try {
    const added = masterAddition('@deepseek-ai/dsh-terminal-bash', { row: terminalBash, group }, [], new Set(['@deepseek-ai/dsh-persona']));
    assert.equal(added.name, 'cordis:group');
    assert.deepEqual(added.isolate, { terminals: true });
    // pty supplies `terminals`; the pwsh variants are gated off on macOS.
    assert.deepEqual(added.config.map(row => row.name), ['@deepseek-ai/dsh-terminal', '@deepseek-ai/dsh-terminal-bash', '@deepseek-ai/dsh-tool-bash-persistent']);
  } finally { Object.defineProperty(process, 'platform', restore); }
});

test('ungated grouped rows are kept with JSON config; present rows are skipped; ids stay unique', () => {
  const plain = { id: 'shell', name: 'cordis:group', group: true, isolate: { terminals: true }, config: [
    { id: 'pty', name: '@deepseek-ai/dsh-terminal' }, { id: 'terminal-bash', name: '@deepseek-ai/dsh-terminal-bash', config: { timeoutMs: 1 } }] };
  const added = masterAddition('@deepseek-ai/dsh-terminal-bash', { row: plain.config[1], group: plain }, [{ id: 'shell', name: 'x' }], new Set(['@deepseek-ai/dsh-terminal']));
  assert.equal(added.id, 'shell-2');
  assert.deepEqual(added.config, [{ id: 'terminal-bash', name: '@deepseek-ai/dsh-terminal-bash', config: { timeoutMs: 1 } }]);
  assert.deepEqual(masterAddition('my-plugin', undefined, [], new Set()), { id: 'my-plugin', name: 'my-plugin' });
});
