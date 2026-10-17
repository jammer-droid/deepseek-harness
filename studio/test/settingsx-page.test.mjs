/** SettingsX page: command rows reflect DSH bindings and toggles; provider rows show registration results. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { SettingsXPage } from '../src/settingsx-page.tsx';
import { STUDIO_COMMANDS, readDisabled, DISABLED_KEY, resolveSessionTarget } from '../src/settingsx-commands.ts';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const list = { directory: '/profile/studio-data/providers', entries: [
  { file: 'local.json', status: 'registered', definition: { version: 1, id: 'local', name: 'Local', protocol: 'openai-chat', baseURL: 'http://127.0.0.1:1234/v1', models: [{ id: 'm', name: 'Model M' }], credential: { kind: 'none' } } },
  { file: 'broken.json', status: 'invalid', issues: [{ code: 'models-empty', path: 'models' }] },
  { file: 'dup.json', status: 'conflict', detail: 'route', definition: { version: 1, id: 'deepseek', name: 'Dup', protocol: 'openai-chat', baseURL: 'http://x/v1', models: [{ id: 'a' }], credential: { kind: 'none' } } },
] };

async function render(t, props) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  t.after(() => { act(() => root.unmount()); host.remove(); });
  await act(async () => root.render(React.createElement(SettingsXPage, props)));
  return host;
}

test('shortcut rows show assigned keys, defaults, and toggles', async t => {
  const calls = [];
  const rows = STUDIO_COMMANDS.map(spec => ({ id: spec.id, enabled: spec.key !== 'fullscreen', keys: spec.key === 'previous' ? ['⌘', '⇧', '['] : null }));
  const host = await render(t, { locale: 'en', shortcuts: { rows, openKeys: ['⌘', '/'], desktop: false, setEnabled: (id, on) => calls.push([id, on]) },
    providers: { list: async () => list, reload: async () => list } });
  const rowsText = [...host.querySelectorAll('section[aria-label="Shortcuts"] .studio-settings-card .studio-settings-row')].map(row => row.textContent);
  assert.equal(rowsText.length, STUDIO_COMMANDS.length);
  assert.match(rowsText[0], /Previous sidebar session.*Key: ⌘ ⇧ \[.*Default key: ⌘⇧\[/);
  assert.match(rowsText[2], /Sidebar session 1.*Not assigned.*No default key/);
  assert.match(host.textContent, /Default keys apply to the desktop app on macOS only/);
  const fullscreen = host.querySelector('[role="switch"][aria-label="Toggle full screen"]');
  assert.equal(fullscreen.getAttribute('aria-checked'), 'false');
  await act(async () => fullscreen.click());
  assert.deepEqual(calls, [['studio.settingsx.fullscreen', true]]);
});

test('provider page lists registered, invalid, and conflicting files and reloads', async t => {
  let reloads = 0;
  const host = await render(t, { locale: 'ko', shortcuts: { rows: [], openKeys: null, desktop: true, setEnabled() {} },
    providers: { list: async () => list, reload: async () => { reloads++; return { ...list, entries: [] }; } } });
  await act(async () => [...host.querySelectorAll('nav button')].find(button => button.textContent === '프로바이더').click());
  const text = host.textContent;
  assert.match(text, /\/profile\/studio-data\/providers/);
  assert.match(text, /Local.*local.*등록됨/);
  assert.match(text, /http:\/\/127\.0\.0\.1:1234\/v1\/chat\/completions/);
  assert.match(text, /broken\.json.*잘못됨.*models: 모델을 하나 이상 넣으세요/);
  assert.match(text, /다른 프로바이더가 이미 “deepseek” 경로를 씁니다/);
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '다시 읽기').click());
  assert.equal(reloads, 1);
  assert.match(host.textContent, /아직 정의 파일이 없습니다/);
});

test('disabled command ids survive only when known; session targets block while loading', () => {
  const storage = value => ({ getItem: key => (key === DISABLED_KEY ? value : null) });
  assert.deepEqual([...readDisabled(storage('["studio.settingsx.copy-cwd","other"]'))], ['studio.settingsx.copy-cwd']);
  assert.deepEqual([...readDisabled(storage('{bad'))], []);
  const session = (id, mainView = 0) => ({ id, updatedAt: id === 'a' ? 2 : 1, blank: false, retainedBy: { mainView } });
  const sessions = { phase: 'ready', ids: ['a', 'b'], byId: { a: session('a', 1), b: session('b') } };
  const workspaces = { phase: 'ready', state: 'idle', items: [], pinnedSessionIds: [], archivedSessionIds: [] };
  const empty = { getItem: () => null };
  assert.deepEqual(resolveSessionTarget({ sessions, workspaces, storage: empty }, { key: 'next' }), { status: 'handled', target: 'b' });
  assert.deepEqual(resolveSessionTarget({ sessions, workspaces, storage: empty }, { key: 'goto', position: 2 }), { status: 'handled', target: 'b' });
  assert.deepEqual(resolveSessionTarget({ sessions, workspaces, storage: empty }, { key: 'goto', position: 3 }), { status: 'blocked', reason: 'empty' });
  assert.deepEqual(resolveSessionTarget({ sessions: { ...sessions, phase: 'loading' }, workspaces, storage: empty }, { key: 'next' }), { status: 'blocked', reason: 'unavailable' });
  assert.deepEqual(resolveSessionTarget({ sessions, workspaces, storage: { getItem: () => '{"groupBy":"new"}' } }, { key: 'next' }), { status: 'blocked', reason: 'unavailable' });
});
