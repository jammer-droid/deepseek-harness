import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRole } from '../packages/catalog/src/resolve.ts';
const request = { parentId: 'parent', roleId: 'role', revision: 2, task: 'Inspect validation', context: 'fresh' };
const component = (id, config) => ({ id, version: 1, scope: 'role', config });
const draft = components => ({ id: 'role', revision: 2, document: { name: 'Validation', mainRole: { name: 'Custom investigator', components } } });
test('role composition resolves instructions, model and enforced tool selection from one revision', () => {
  const saved = draft([component('studio.instructions', { text: 'First' }), component('studio.instructions', { text: 'Second' }), component('studio.model', { provider: 'deepseek', model: 'deepseek-chat' }), component('studio.tools', { allow: 'read\n grep \n', deny: 'bash' })]);
  const before = structuredClone(saved);
  assert.deepEqual(resolveRole(saved, request), { instructions: 'First\n\nSecond', model: { provider: 'deepseek', model: 'deepseek-chat' }, tools: { allow: ['read', 'grep'], deny: ['bash'] } });
  assert.deepEqual(saved, before);
});
test('stale revisions, missing tasks and unavailable components reject before invocation', () => {
  assert.throws(() => resolveRole(draft([]), { ...request, revision: 1 }), /revision-conflict/);
  assert.throws(() => resolveRole(draft([]), { ...request, task: ' ' }), /task-required/);
  assert.throws(() => resolveRole(draft([component('third-party.component', {})]), request), /unsupported-component/);
  assert.throws(() => resolveRole(draft([{ ...component('studio.instructions', { text: 'x' }), version: 2 }]), request), /unsupported-component/);
});
test('blank restrictions inherit tools and malformed or duplicate model settings fail', () => {
  assert.deepEqual(resolveRole(draft([component('studio.tools', { allow: '', deny: '\n' })]), request), { instructions: '' });
  assert.throws(() => resolveRole(draft([component('studio.model', { model: 'x' })]), request), /invalid-component/);
  assert.throws(() => resolveRole(draft([component('studio.model', { model: 'x', provider: 'p' }), component('studio.model', { model: 'y', provider: 'p' })]), request), /invalid-component/);
  assert.throws(() => resolveRole(draft([component('studio.instructions', { text: 1 })]), request), /invalid-component/);
});
