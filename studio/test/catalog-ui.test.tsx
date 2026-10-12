import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
vi.mock('../src/ui-host.tsx', () => ({
  Menu: ({ anchor, open, children }) => <>{anchor}{open && <div role="menu">{children}</div>}</>,
  MenuItemButton: ({ children, onSelect }) => <button onClick={onSelect}>{children}</button>,
  Modal: ({ children, title }) => <div role="dialog" aria-label={title}>{children}</div>,
}));
import { CatalogAction, apply } from '../src/catalog.tsx';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ''; });
const assignment = { parentId: 'parent', childId: 'child', role: { id: 'saved-role', name: 'Custom role', description: 'Own validation' }, snapshot: { revision: 3, task: 'Check the parser', instructions: 'Read tests', context: 'fresh' }, createdAt: 1 };
async function mount({ assignments = async () => [assignment], launch = async () => ({ childId: 'launched' }), child = false } = {}) {
  const api = { assignments: vi.fn(assignments), roles: vi.fn(async () => [{ id: 'saved-role', name: 'Parser workflow', roleName: 'Custom role', revision: 3 }]), launch: vi.fn(launch), refresh: vi.fn(async () => {}), open: vi.fn() };
  const state = { byId: { parent: { origin: child ? 'subagent' : 'user' }, child: { title: 'Parser', running: true, projectionValues: { tokenUsage: { uncachedInputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 }, subagentTiming: { settledMs: 5000 } } } }, projectionsBySession: { parent: { state: 'idle', values: { subagentCatalog: [{ id: 'child', mode: 'continuable', label: 'DSH description' }, { id: 'ordinary', mode: 'one-shot', label: 'Ordinary' }, { id: 'external', mode: 'external', label: 'External task' }] } }, child: { state: 'idle', values: { subagentCatalog: [{ id: 'grandchild', mode: 'continuable', label: 'Grandchild' }] } } } };
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<CatalogAction sessionId="parent" useSessions={selector => selector(state)} useSessionStatus={selector => selector(new Map())} api={api} locale="en" />));
  return api;
}
async function click(text) { const button = [...document.querySelectorAll('button')].find(item => item.textContent === text); expect(button).toBeDefined(); await act(async () => button.click()); }

test('ordinary children, nested navigation, metrics and optional immutable snapshots coexist', async () => {
  const api = await mount(); await click('Subagents · 3');
  expect(document.body.textContent).toContain('DSH description');
  expect(document.body.textContent).toContain('Ordinary');
  expect(document.body.textContent).toContain('100 tokens');
  expect(document.body.textContent).toContain('5 s');
  expect(document.body.textContent).toContain('Running');
  expect(document.body.textContent).toContain('Custom role');
  expect(document.body.textContent).toContain('Check the parser');
  await click('Children'); expect(document.body.textContent).toContain('Grandchild');
  await click('Open in sidebar'); expect(api.open).toHaveBeenCalledWith({ parentSessionId: 'parent', childSessionId: 'child', mode: 'continuable' }, true);
});
test('metadata failure keeps basic navigation usable and offers reload', async () => {
  const api = await mount({ assignments: async () => { throw Error('offline'); } }); await click('Subagents · 3');
  expect(document.body.textContent).toContain('Ordinary child navigation remains available');
  await click('Open conversation'); expect(api.open).toHaveBeenCalled();
});
test('saved roles supply launch revision and task; uncertain result blocks duplicate submission', async () => {
  const api = await mount({ launch: async () => { throw Error('disconnected'); } }); await click('Subagents · 3'); await click('Launch saved role');
  expect(document.body.textContent).toContain('Parser workflow · Custom role');
  const area = document.querySelector('textarea');
  await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(area, 'Verify parser'); area.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.launch).toHaveBeenCalledWith({ parentId: 'parent', roleId: 'saved-role', revision: 3, task: 'Verify parser', context: 'fresh' });
  expect(document.body.textContent).toContain('Launch could not be confirmed');
  expect(document.querySelector('fieldset').disabled).toBe(true);
  await act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.launch).toHaveBeenCalledTimes(1);
  await click('Close'); await click('Subagents · 3');
  expect([...document.querySelectorAll('button')].some(button => button.textContent === 'Launch saved role')).toBe(false);
  expect(document.body.textContent).toContain('Launch could not be confirmed');
});
test('child lineage remains core-owned', async () => { await mount({ child: true }); expect(document.querySelector('button')).toBeNull(); });
test('registration targets only the header catalog with explicit winning priority and owned disposal', async () => {
  const dispose = vi.fn(); const unmount = vi.fn(); const effects = [];
  const register = vi.fn(() => dispose);
  const ctx = { remote: { $mount: async () => unmount }, effect: effect => effects.push(effect()), inject: (_dependencies, callback) => callback(ctx), slots: { inject: (_slot, callback) => effects.push(callback()), register } };
  await apply(ctx);
  expect(register.mock.calls[0][0]).toEqual({ name: 'conversation.session.header.actions', id: 'subagent-catalog', priority: -1, order: -30 });
  expect(register).toHaveBeenCalledTimes(1);
  effects.reverse().forEach(effect => effect()); expect(dispose).toHaveBeenCalledOnce(); expect(unmount).toHaveBeenCalledOnce();
});
