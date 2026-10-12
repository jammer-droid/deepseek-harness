import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainRole, resolveRole } from '../packages/sub-agent-catalog/src/resolve.ts';
const request = { parentId: 'parent', roleId: 'role', revision: 2, task: 'Inspect validation', context: 'fresh' };
const component = (id, config) => ({ instanceId: id, id, version: 1, scope: 'role', config });
const model = { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: 'high' };
const draft = components => ({ id: 'role', revision: 2, document: { documentVersion: 3, name: 'Validation', mainRoleId: 'selected', roles: [{ id: 'other', name: 'Other', components: [] }, { id: 'selected', name: 'Custom investigator', model: { ...model }, components }], systems: [], connections: [] } });
test('exact main role resolves instructions, model and tools without mutating the document', () => {
  const saved = draft([component('studio.instructions', { text: 'First' }), component('studio.instructions', { text: 'Second' }), component('studio.tools', { allow: 'read\n grep \n', deny: 'bash' })]);
  const before = structuredClone(saved);
  assert.deepEqual(resolveRole(saved, request), { instructions: 'First\n\nSecond', model, tools: { allow: ['read', 'grep'], deny: ['bash'] } });
  assert.deepEqual(saved, before);
});
test('stale revisions, missing tasks and unavailable components reject before invocation', () => {
  assert.throws(() => resolveRole(draft([]), { ...request, revision: 1 }), /revision-conflict/);
  assert.throws(() => resolveRole(draft([]), { ...request, task: ' ' }), /task-required/);
  assert.throws(() => resolveRole(draft([component('third-party.component', {})]), request), /unsupported-component/);
  assert.throws(() => resolveRole(draft([{ ...component('studio.instructions', { text: 'x' }), version: 2 }]), request), /unsupported-component/);
});
test('disabled components and systems are ignored; executable graph constraints reject', () => {
  const saved = draft([{ ...component('unknown', {}), enabled: false }, { ...component('studio.instructions', { text: 'Ignored' }), enabled: false }]);
  saved.document.systems = [{ enabled: false }];
  assert.deepEqual(resolveRole(saved, request), { instructions: '', model });
  saved.document.systems[0].enabled = true;
  assert.throws(() => resolveRole(saved, request), /unsupported-component/);
  saved.document.systems = [];
  saved.document.connections = [{}];
  assert.throws(() => resolveRole(saved, request), /unsupported-component/);
});
test('missing and ambiguous main references never select the first role', () => {
  const saved = draft([]);
  saved.document.mainRoleId = 'missing';
  assert.throws(() => mainRole(saved.document), /role-not-found/);
  saved.document.mainRoleId = 'selected';
  saved.document.roles.push(structuredClone(saved.document.roles[1]));
  assert.throws(() => resolveRole(saved, request), /role-not-found/);
});
test('model is required independently; no initial model or legacy component fallback', () => {
  const saved = draft([]);
  saved.document.initialModel = model;
  delete saved.document.roles[1].model;
  assert.throws(() => resolveRole(saved, request), /invalid-component/);
  saved.document.roles[1].model = { ...model, reasoningEffort: '' };
  assert.throws(() => resolveRole(saved, request), /invalid-component/);
  saved.document.roles[1].model = { provider: 'deepseek', model: 'deepseek-chat' };
  assert.deepEqual(resolveRole(saved, request).model, saved.document.roles[1].model);
  saved.document.roles[1].components = [component('studio.model', model)];
  assert.throws(() => resolveRole(saved, request), /unsupported-component/);
});
test('blank restrictions inherit tools and malformed or duplicate configuration fails', () => {
  assert.deepEqual(resolveRole(draft([component('studio.tools', { allow: '', deny: '\n' })]), request), { instructions: '', model });
  assert.throws(() => resolveRole(draft([component('studio.tools', {}), component('studio.tools', {})]), request), /invalid-component/);
  assert.throws(() => resolveRole(draft([component('studio.instructions', { text: 1 })]), request), /invalid-component/);
});
