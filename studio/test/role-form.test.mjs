import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { RoleEditor } from '../src/role-editor.tsx';

test('role cards edit with catalog models and only supported effort choices', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.getElementById('root'));
  const models = async () => ({ groups: [{ id: 'provider', name: 'Provider', models: [{ id: 'a', name: 'Model A', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }, { id: 'b', name: 'Model B' }] }], failures: [] });
  let roles = [{ name: 'Reviewer', role: 'Review code', model: 'provider/a', reasoning: 'high', spawn: 'fork', persona: 'Check evidence' }];
  function App() { const [value, change] = React.useState(roles); return React.createElement(RoleEditor, { locale: 'en', roles: value, loadModels: models, onChange: next => { roles = next; change(next); } }); }
  await act(async () => root.render(React.createElement(App)));
  assert.match(document.body.textContent, /Reviewer/);
  assert.equal(document.querySelectorAll('select').length, 0);
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Edit').click());
  let selects = document.querySelectorAll('select');
  assert.deepEqual([...selects[1].options].map(o => o.value), ['inherit', 'high']);
  await act(async () => { selects[0].value = 'provider/b'; selects[0].dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(roles[0].reasoning, 'inherit');
  assert.deepEqual([...document.querySelectorAll('select')[1].options].map(o => o.value), ['inherit']);
  assert.match(document.body.textContent, /persona/);
  await act(async () => root.unmount()); dom.window.close();
});
