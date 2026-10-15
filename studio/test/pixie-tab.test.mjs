/** Pixie tab: thread list, streaming answer, cancel, usage, and the judge trial, rendered with fake actions. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { PixieTab } from '../src/pixie-tab.tsx';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const model = { provider: 'p', model: 'm' };
const settings = { model, contextMode: 'fresh', systemPrompt: '', allowThreadModel: true };
const thread = (id, title, turns = []) => ({ id, title, mode: 'fresh', model, forked: [], turns, createdAt: 1 });
const done = { id: 't1', question: 'what?', answer: 'that.', status: 'done', model, startedAt: 1, usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, reasoningTokens: 5 } };

function fakeActions(view) {
  const calls = [];
  let push;
  return {
    calls,
    emit: frame => push?.(frame),
    actions: {
      view: async () => structuredClone(view),
      follow: listener => { push = listener; return () => { push = undefined; }; },
      ask: async (question, threadId) => { calls.push(['ask', question, threadId]); return { threadId, turnId: 'new' }; },
      cancel: async () => { calls.push(['cancel']); return true; },
      createThread: async options => { calls.push(['createThread', options]); return thread('t9', 'Thread 9'); },
      activate: async id => { calls.push(['activate', id]); return true; },
      models: async () => ({ groups: [{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M' }] }] }),
      judge: async request => { calls.push(['judge', request]); return { ok: true, answers: { clear: { type: 'noul', noul: 0.7 } } }; },
    },
  };
}
async function render(element) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => { root.render(element); });
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return { host, root };
}
const button = (host, name) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === name || b.getAttribute('aria-label') === name);
const type = async (el, value) => {
  const { Simulate } = await import('react-dom/test-utils');
  await act(async () => { el.value = value; Simulate.change(el); });
};

test('shows threads, the active conversation, and usage with the model limit', async () => {
  const view = { record: { sessionId: 's1', activeThreadId: 'a', threads: [thread('a', 'Thread 1', [done]), thread('b', 'Thread 2')] }, total: { requests: 1, inputTokens: 100, outputTokens: 20, cacheReadTokens: 50, cacheWriteTokens: 0, reasoningTokens: 5 }, running: false, frames: [], settings, contextWindow: 1000 };
  const { host } = await render(React.createElement(PixieTab, { locale: 'en', actions: fakeActions(view).actions }));
  const text = host.textContent;
  assert.match(text, /Thread 1/);
  assert.match(text, /Thread 2/);
  assert.match(text, /what\?/);
  assert.match(text, /that\./);
  // context = input + cache read + cache write + output of the last turn
  assert.match(text, /170 \/ 1,000/);
  assert.match(text, /In 100/);
  assert.match(text, /Out 20/);
  assert.match(text, /Cache 50/);
  assert.match(text, /Reasoning 5/);
});

test('asking streams the answer and the running request can be cancelled', async () => {
  const view = { record: { sessionId: 's1', activeThreadId: 'a', threads: [thread('a', 'Thread 1')] }, total: { requests: 0, inputTokens: 0, outputTokens: 0 }, running: false, frames: [], settings };
  const fake = fakeActions(view);
  const { host } = await render(React.createElement(PixieTab, { locale: 'en', actions: fake.actions }));
  await type(host.querySelector('textarea'), 'explain');
  await act(async () => { button(host, 'Ask').click(); });
  assert.deepEqual(fake.calls[0], ['ask', 'explain', 'a']);
  await act(async () => { fake.emit({ type: 'start', threadId: 'a', turnId: 'new', question: 'explain' }); fake.emit({ type: 'text', text: 'stream' }); fake.emit({ type: 'text', text: 'ing' }); });
  assert.match(host.textContent, /explain/);
  assert.match(host.textContent, /streaming/);
  assert.match(host.textContent, /Answering/);
  await act(async () => { button(host, 'Cancel').click(); });
  assert.deepEqual(fake.calls.at(-1), ['cancel']);
});

test('new thread and thread switching call the service', async () => {
  const view = { record: { sessionId: 's1', activeThreadId: 'a', threads: [thread('a', 'Thread 1'), thread('b', 'Thread 2')] }, total: { requests: 0, inputTokens: 0, outputTokens: 0 }, running: false, frames: [], settings };
  const fake = fakeActions(view);
  const { host } = await render(React.createElement(PixieTab, { locale: 'en', actions: fake.actions }));
  await act(async () => { button(host, 'Thread 2').click(); });
  assert.deepEqual(fake.calls.at(-1), ['activate', 'b']);
  await act(async () => { button(host, 'New thread').click(); });
  assert.equal(fake.calls.at(-1)[0], 'createThread');
});

test('without a configured model the tab says so and offers no ask', async () => {
  const view = { record: { sessionId: 's1', threads: [] }, total: { requests: 0, inputTokens: 0, outputTokens: 0 }, running: false, frames: [], settings: { ...settings, model: undefined } };
  const { host } = await render(React.createElement(PixieTab, { locale: 'en', actions: fakeActions(view).actions }));
  assert.match(host.textContent, /Studio/);
  assert.equal(button(host, 'Ask'), undefined);
});

test('judge trial sends the Jev-shaped request and shows answers', async () => {
  const view = { record: { sessionId: 's1', threads: [] }, total: { requests: 0, inputTokens: 0, outputTokens: 0 }, running: false, frames: [], settings };
  const fake = fakeActions(view);
  const { host } = await render(React.createElement(PixieTab, { locale: 'en', actions: fake.actions }));
  await act(async () => { button(host, 'Judge').click(); });
  const [state, questions] = host.querySelectorAll('textarea');
  await type(state, '{"request":"fix login"}');
  await type(questions, '{"clear":{"type":"noul","question":"Is it clear?"}}');
  await act(async () => { button(host, 'Run judge').click(); });
  assert.deepEqual(fake.calls.at(-1), ['judge', { state: { request: 'fix login' }, questions: { clear: { type: 'noul', question: 'Is it clear?' } } }]);
  assert.match(host.textContent, /0\.7/);
});

test('settings page saves the chosen model, effort, and mode', async () => {
  const { PixieSettingsPage } = await import('../src/pixie-settings.tsx');
  const saved = [];
  const actions = {
    read: async () => ({ contextMode: 'fresh', systemPrompt: 'S', allowThreadModel: true }),
    save: async value => { saved.push(value); return value; },
    models: async () => ({ groups: [{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }] }], failures: [] }),
  };
  const { host } = await render(React.createElement(PixieSettingsPage, { actions, locale: 'en' }));
  const { Simulate } = await import('react-dom/test-utils');
  const [modelSelect] = host.querySelectorAll('select');
  await act(async () => { modelSelect.value = 'p\u0000m'; Simulate.change(modelSelect); });
  const effort = host.querySelectorAll('select')[1];
  await act(async () => { effort.value = 'high'; Simulate.change(effort); });
  const fork = [...host.querySelectorAll('[role=radio]')].find(item => /Continue this conversation/.test(item.textContent));
  await act(async () => { fork.click(); });
  assert.equal(fork.getAttribute('aria-checked'), 'true');
  await act(async () => { button(host, 'Save').click(); });
  assert.deepEqual(saved[0], { contextMode: 'fork', systemPrompt: 'S', allowThreadModel: true, model: { provider: 'p', model: 'm', reasoningEffort: 'high' } });
  assert.match(host.textContent, /Saved\./);
});

test('the /pixie row shows the question and status, never an answer, and opens the tab', async () => {
  const { PixieCommandRow } = await import('../src/pixie-tab.tsx');
  let opened = 0;
  const { host } = await render(React.createElement(PixieCommandRow, { question: 'why?', outcome: { kind: 'success', text: 'Asked Pixie · Thread 1' }, locale: 'en', onOpen: () => { opened++; } }));
  assert.match(host.textContent, /why\?/);
  assert.match(host.textContent, /Pixie tab/);
  await act(async () => { button(host, 'Open Pixie').click(); });
  assert.equal(opened, 1);
});

test('a request started by /pixie streams under its own question, and coded Host errors are localized', async () => {
  const view = { record: { sessionId: 's1', activeThreadId: 'a', threads: [thread('a', 'Thread 1', [{ ...done, id: 'x', status: 'error', answer: '', error: '[pixie/no-model] No Pixie model is configured' }])] }, total: { requests: 0, inputTokens: 0, outputTokens: 0 }, running: false, frames: [], settings };
  const fake = fakeActions(view);
  const { host } = await render(React.createElement(PixieTab, { locale: 'ko', actions: fake.actions }));
  assert.match(host.textContent, /Pixie 모델이 설정되지 않았습니다/);
  assert.doesNotMatch(host.textContent, /\[pixie\//);
  await act(async () => { fake.emit({ type: 'start', threadId: 'a', turnId: 'cmd', question: 'from the command' }); fake.emit({ type: 'text', text: 'ok' }); });
  assert.match(host.textContent, /from the command/);
});

test('a truncated answer is labeled', async () => {
  const view = { record: { sessionId: 's1', activeThreadId: 'a', threads: [thread('a', 'Thread 1', [{ ...done, truncated: true }])] }, total: { requests: 0, inputTokens: 0, outputTokens: 0 }, running: false, frames: [], settings };
  const { host } = await render(React.createElement(PixieTab, { locale: 'en', actions: fakeActions(view).actions }));
  assert.match(host.textContent, /token limit/);
});
