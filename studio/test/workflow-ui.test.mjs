/** User-visible draft selection and explicit save behavior. */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { WorkflowEditor: Editor } = await import('../src/workflow-editor.tsx');
function WorkflowEditor(props) {
  const api = React.useMemo(() => ({ catalog: async () => ({ revision: 1, components: props.components, systems: [] }), validate: async () => ({ catalogRevision: 1, valid: true, diagnostics: [] }), subscribeCatalog: () => () => {}, subscribeConnection: () => () => {}, ...props.api }), [props.api]);
  return React.createElement(Editor, { ...props, api, initialDrafts: props.initialDrafts.map(draft => ({ ...draft, document: { documentVersion: 2, systems: [], connections: [], ...draft.document, mainRole: { ...draft.document.mainRole, components: draft.document.mainRole.components.map((item, index) => ({ instanceId: `instance-${index}`, ...item })) } } })) });
}
test('Unavailable configuration and empty connection providers match user-visible output', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { readFile } = await import('node:fs/promises');
  const output = renderToStaticMarkup(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [{ id: 'snapshot-draft', revision: 1, document: { documentVersion: 2, name: 'Unavailable provider', mainRole: { name: 'Main', components: [{ instanceId: 'retained-component', id: 'offline.provider', version: 1, scope: 'role', config: { text: 'Retained' } }] }, systems: [], connections: [] } }], api: { drafts: async () => [], save: async () => { throw new Error('not called'); } } }));
  assert.equal(output + '\n', await readFile(new URL('./workflow-ui.expected.html', import.meta.url), 'utf8'));
});
after(() => dom.window.close());
test('Systems and port connections can be added, changed and explicitly deleted with stable IDs', async () => {
  const root = createRoot(document.getElementById('root'));
  let saved;
  const catalog = { revision: 1, components: [], systems: [
    { id: 'source', version: 1, scope: 'workflow', executionLocations: ['dsh'], fields: [{ key: 'text', kind: 'text', required: true }], ports: [{ id: 'out', direction: 'output', semantic: 'test', allowedPeers: ['sink'], minConnections: 0, maxConnections: 2 }] },
    { id: 'sink', version: 1, scope: 'workflow', executionLocations: ['dsh'], fields: [], ports: [{ id: 'in', direction: 'input', semantic: 'test', allowedPeers: ['source'], minConnections: 0, maxConnections: 2 }] },
  ] };
  const api = { catalog: async () => catalog, validate: async () => ({ catalogRevision: 1, valid: true, diagnostics: [] }), subscribeCatalog: () => () => {}, subscribeConnection: () => () => {}, drafts: async () => [], save: async request => (saved = { ...request, revision: 1 }) };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [], api })));
    await click('New draft'); await click('Add system: source'); await click('Add system: sink');
    await click('Add connection'); await click('Save draft');
    assert.equal(saved.document.systems.length, 2);
    assert.equal(saved.document.connections.length, 1);
    const id = saved.document.connections[0].id;
    await click('Add system: sink');
    await act(async () => { const select = document.querySelector('select[aria-label="Input port"]'); select.value = select.options[1].value; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await click('Save draft');
    assert.equal(saved.document.connections[0].to.instanceId, saved.document.systems[2].instanceId);
    assert.equal(saved.document.connections[0].from.instanceId, saved.document.systems[0].instanceId);
    assert.equal(saved.document.connections[0].to.portId, 'in');
    await input(document.querySelector('input'), 'Renamed'); await click('Save draft');
    assert.equal(saved.document.connections[0].id, id);
    await click('Delete system: source'); await click('Save draft');
    assert.equal(saved.document.connections.length, 1);
    assert.match(document.body.textContent, /Unavailable component configuration is preserved/);
    await click('Delete connection'); await click('Save draft');
    assert.equal(saved.document.connections.length, 0);
  } finally { await act(async () => root.unmount()); }
});
test('A connection can switch atomically between disjoint compatible port pairs', async () => {
  const root = createRoot(document.getElementById('root'));
  const systems = ['a', 'b', 'c', 'd'].map((id, index) => ({ id, version: 1, scope: 'workflow', executionLocations: ['dsh'], fields: [], ports: [{ id: 'port', direction: index % 2 ? 'input' : 'output', semantic: index < 2 ? 'first' : 'second', allowedPeers: [index % 2 ? systemsPeer(index - 1) : systemsPeer(index + 1)], minConnections: 0, maxConnections: 1 }] }));
  function systemsPeer(index) { return ['a', 'b', 'c', 'd'][index]; }
  let saved;
  const api = { catalog: async () => ({ revision: 1, components: [], systems }), validate: async () => ({ catalogRevision: 1, valid: true, diagnostics: [] }), save: async request => (saved = { ...request, revision: 1 }) };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [], api })));
    await click('New draft'); for (const id of ['a', 'b', 'c', 'd']) await click(`Add system: ${id}`);
    await click('Add connection'); await click('Save draft'); const id = saved.document.connections[0].id;
    await act(async () => { const select = document.querySelector('select[aria-label="Connections"]'); select.value = select.options[1].value; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await click('Save draft');
    assert.equal(saved.document.connections[0].id, id);
    assert.equal(saved.document.connections[0].from.instanceId, saved.document.systems[2].instanceId);
    assert.equal(saved.document.connections[0].to.instanceId, saved.document.systems[3].instanceId);
  } finally { await act(async () => root.unmount()); }
});
test('Live availability retains unsaved values, ignores reversed replies, and recovers after reconnect failure', async () => {
  const root = createRoot(document.getElementById('root'));
  let changed; let connected; let current = { revision: 1, components, systems: [] }; let fail = false;
  let deferred; let hold = false;
  const api = { catalog: async () => { if (fail) throw new Error('offline'); return current; }, subscribeCatalog: listener => { changed = listener; return () => {}; }, subscribeConnection: listener => { connected = listener; return () => {}; }, validate: async () => hold ? new Promise(resolve => { deferred = resolve; }) : ({ catalogRevision: current.revision, valid: true, diagnostics: [] }), drafts: async () => [], save: async request => ({ ...request, revision: 1 }) };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft'); await click('Add instructions'); await input(document.querySelector('textarea'), 'Unsaved text');
    hold = true; await input(document.querySelector('textarea'), 'Latest text'); const old = deferred;
    current = { revision: 2, components: [], systems: [] }; hold = false;
    await act(async () => changed(2));
    assert.equal(document.querySelector('textarea'), null);
    assert.match(document.body.textContent, /Unavailable component configuration is preserved/);
    current = { revision: 3, components: components.map(item => ({ ...item, version: 2 })), systems: [] };
    await act(async () => changed(3)); assert.equal(document.querySelector('textarea'), null);
    await act(async () => old({ catalogRevision: 1, valid: false, diagnostics: [{ code: 'required-field', target: { kind: 'document' }, relatedIds: [], details: {} }] }));
    assert.doesNotMatch(document.body.textContent, /Enter a value for this field/);
    current = { revision: 3, components, systems: [] }; await act(async () => changed(3));
    assert.equal(document.querySelector('textarea').value, 'Latest text');
    await act(async () => connected(false));
    assert.equal(button('Add instructions').disabled, true);
    fail = true; await act(async () => connected(true));
    assert.match(document.body.textContent, /availability is unknown/);
    fail = false; current = { revision: 1, components, systems: [] }; await act(async () => connected(true));
    assert.equal(document.querySelector('textarea').value, 'Latest text');
    assert.equal(button('Add instructions').disabled, false);
  } finally { await act(async () => root.unmount()); }
});
test('Localized field diagnostics allow draft saving and ignore older validation and catalog responses', async () => {
  const root = createRoot(document.getElementById('root'));
  const validations = []; const catalogs = []; let changed; let saved;
  const api = { catalog: () => new Promise(resolve => catalogs.push(resolve)), subscribeCatalog: listener => { changed = listener; return () => {}; }, subscribeConnection: () => () => {}, validate: () => new Promise(resolve => validations.push(resolve)), drafts: async () => [], save: async request => (saved = { ...request, revision: 1 }) };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'ko', components: [], initialDrafts: [], api })));
    await act(async () => changed(2));
    await act(async () => catalogs[1]({ revision: 2, components, systems: [] }));
    await act(async () => catalogs[0]({ revision: 1, components: [], systems: [] }));
    await click('새 초안'); await click('지침 추가'); await input(document.querySelector('textarea'), 'A');
    const older = validations.at(-1); await input(document.querySelector('textarea'), 'B');
    await act(async () => validations.at(-1)({ catalogRevision: 2, valid: false, diagnostics: [{ code: 'required-field', target: { kind: 'document', fieldPath: 'name' }, relatedIds: [], details: {} }] }));
    assert.match(document.body.textContent, /필드 값을 입력해 주세요/);
    await act(async () => older({ catalogRevision: 2, valid: true, diagnostics: [] }));
    assert.match(document.body.textContent, /필드 값을 입력해 주세요/);
    assert.equal(button('초안 저장').disabled, false); await click('초안 저장');
    assert.equal(saved.document.mainRole.components[0].config.text, 'B');
  } finally { await act(async () => root.unmount()); }
});
test('Validation transport failures retain edits, remain distinct from configuration errors, and release subscriptions', async () => {
  const root = createRoot(document.getElementById('root'));
  let stopped = 0;
  const api = { catalog: async () => ({ revision: 1, components, systems: [] }), validate: async () => { throw new Error('offline'); }, subscribeCatalog: () => () => { stopped++; }, subscribeConnection: () => () => { stopped++; }, drafts: async () => [], save: async request => ({ ...request, revision: 1 }) };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft'); await click('Add instructions'); await input(document.querySelector('textarea'), 'Kept');
    assert.match(document.body.textContent, /Could not validate this draft/);
    assert.doesNotMatch(document.body.textContent, /Configuration needs attention/);
    assert.equal(document.querySelector('textarea').value, 'Kept');
    assert.equal(button('Save draft').disabled, false);
  } finally { await act(async () => root.unmount()); }
  assert.equal(stopped, 2);
});
test('Revision mismatches visibly stop additions instead of leaving validation pending', async () => {
  const root = createRoot(document.getElementById('root'));
  let changed;
  const api = { catalog: async () => ({ revision: 1, components, systems: [] }), validate: async () => ({ catalogRevision: 2, valid: true, diagnostics: [] }), subscribeCatalog: listener => { changed = listener; return () => {}; }, subscribeConnection: () => () => {}, drafts: async () => [], save: async request => ({ ...request, revision: 1 }) };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft'); assert.match(document.body.textContent, /availability is unknown/);
    assert.equal(button('Add instructions').disabled, true);
    await act(async () => changed(3)); assert.match(document.body.textContent, /availability is unknown/);
    await click('Refresh availability'); assert.match(document.body.textContent, /availability is unknown/);
    assert.equal(button('Add instructions').disabled, true);
  } finally { await act(async () => root.unmount()); }
});
test('Conflict reports retain edits and require explicit replacement with the saved version', async () => {
  const root = createRoot(document.getElementById('root'));
  const original = { id: '9b8208b1-54c8-4e0e-9a89-549939f8a816', revision: 1, document: { documentVersion: 2, systems: [], connections: [], name: 'Original', mainRole: { name: 'Main', components: [] } } };
  const latest = { ...original, revision: 2, document: { ...original.document, name: 'Other editor' } };
  const api = { async drafts() { return [latest]; }, async save() { throw { code: 'studio-workflows/rejected', details: { reason: 'revision-conflict' } }; } };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [original], api })));
    await input(document.querySelector('input'), 'My edits'); await click('Save draft');
    assert.match(document.querySelector('[role=alert]').textContent, /changed elsewhere/);
    assert.equal(document.querySelector('input').value, 'My edits');
    assert.equal(button('Save draft').disabled, true);
    await click('Read again'); await click('Keep editing');
    assert.equal(document.querySelector('input').value, 'My edits');
    await click('Read again'); await click('Discard and continue');
    assert.equal(document.querySelector('input').value, 'Other editor');
    assert.equal(document.querySelector('[role=status]').textContent, 'Saved');
  } finally { await act(async () => root.unmount()); }
});
test('Lost create response blocks dependent writes until readback finds the stable ID', async () => {
  const root = createRoot(document.getElementById('root'));
  let stored;
  let readsFail = true;
  let saves = 0;
  const api = {
    async drafts() { if (readsFail) throw new Error('offline'); return [stored]; },
    async save(request) { saves++; stored = { id: request.id, revision: 1, document: structuredClone(request.document) }; throw new Error('response lost'); },
  };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components: [], initialDrafts: [], api })));
    await click('New draft');
    await input(document.querySelector('input'), 'Retained');
    await click('Save draft');
    assert.equal(document.querySelector('input').value, 'Retained');
    assert.match(document.querySelector('[role=alert]').textContent, /not confirmed/);
    assert.equal(button('Save draft').disabled, true);
    assert.equal(button('New draft').disabled, true);
    await click('Read again'); await click('Discard and continue');
    assert.equal(document.querySelector('input').value, 'Retained');
    assert.equal(button('New draft').disabled, true);
    readsFail = false;
    await click('Read again'); await click('Discard and continue');
    assert.equal(document.querySelector('[role=alert]'), null);
    assert.equal(document.querySelector('[role=status]').textContent, 'Saved');
    assert.equal(document.querySelector('select').value, stored.id);
    assert.equal(saves, 1);
  } finally { await act(async () => root.unmount()); }
});
const components = [{ id: 'studio.instructions', version: 1, scope: 'role', fields: [{ key: 'text', kind: 'text', required: true }] }];
const button = text => [...document.querySelectorAll('button')].find(item => item.textContent === text);
async function click(text) { await act(async () => button(text).click()); }
async function input(element, value) {
  await act(async () => {
    const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}
test('Missing readback does not resolve a save that may still arrive', async () => {
  const root = createRoot(document.getElementById('root'));
  const api = { async drafts() { return []; }, async save() { throw new Error('transport lost'); } };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft'); await input(document.querySelector('input'), 'Pending'); await click('Save draft');
    await click('Read again'); await click('Discard and continue');
    assert.equal(button('New draft').disabled, true);
    assert.equal(button('Save draft').disabled, true);
    assert.equal(document.querySelector('input').value, 'Pending');
  } finally { await act(async () => root.unmount()); }
});

test('Create, edit and save drafts; confirm before discarding local changes', async () => {
  const root = createRoot(document.getElementById('root'));
  const stored = [];
  const api = {
    async drafts() { return structuredClone(stored); },
    async save(request) {
      const result = { id: request.id, revision: request.expectedRevision + 1, document: structuredClone(request.document) };
      stored.push(result);
      return result;
    },
  };
  try {
    await act(async () => root.render(React.createElement(WorkflowEditor, { locale: 'en', components, initialDrafts: [], api })));
    await click('New draft');
    await input(document.querySelector('input'), 'First draft');
    await click('Add instructions');
    await input(document.querySelector('textarea'), 'Follow repository instructions.');
    assert.equal(stored.length, 0);
    await click('Save draft');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].document.mainRole.components[0].config.text, 'Follow repository instructions.');
    assert.equal(document.querySelector('[role=status]').textContent, 'Saved');
    await input(document.querySelector('textarea'), 'Local edits');
    await click('New draft');
    assert.match(document.querySelector('[role=alert]').textContent, /Discard unsaved/);
    await click('Keep editing');
    assert.equal(document.querySelector('textarea').value, 'Local edits');
    await click('New draft');
    await click('Discard and continue');
    assert.equal(document.querySelector('input').value, '');
    await input(document.querySelector('input'), 'Second draft');
    await click('Save draft');
    assert.equal(stored.length, 2);
    assert.notEqual(stored[0].id, stored[1].id);
    await act(async () => {
      const select = document.querySelector('select');
      select.value = stored[0].id;
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(document.querySelector('input').value, 'First draft');
    assert.equal(document.querySelector('textarea').value, 'Follow repository instructions.');
  } finally { await act(async () => root.unmount());  }
});
