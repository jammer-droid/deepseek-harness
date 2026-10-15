import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { GateResultDetails } from '../src/pixie-gate-result.tsx';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const base = () => ({ verdict: 'pass', original: '<script>original</script>', subject: 'final', notes: [], stages: {}, records: [], forward: { kind: 'original', text: 'forwarded' }, hooks: {} });
async function render(props, check) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(GateResultDetails, { locale: 'en', ...props })));
    check(host);
  } finally { await act(async () => root.unmount()); host.remove(); }
}

test('trial distinguishes skipped pass from executed pass and explains missing forward', async () => {
  const result = base();
  result.stages.command = { verdict: 'pass', reason: 'skipped: 시험 실행에서 명령 미실행', data: { skipped: true } };
  result.forward = { kind: 'none' };
  result.forwardError = { verdict: 'error', error: 'Missing stage text' };
  await render({ result, durations: { command: 0 }, locale: 'ko' }, host => {
    const stage = host.querySelector('[data-gate-stage=command]');
    assert.match(stage.textContent, /통과/);
    assert.match(stage.textContent, /건너뜀/);
    assert.match(stage.textContent, /0 ms/);
    assert.match(host.textContent, /시험 실행에서 명령 단계를 건너뛰어 전달 결과를 계산할 수 없음/);
    assert.match(host.textContent, /Missing stage text/);
    assert.equal(host.querySelector('script'), null);
  });
});

test('shows stage text, reason, errors, hook results and append contexts without usage', async () => {
  const result = base();
  result.stages.check = { verdict: 'error', text: 'stage text', reason: 'stage reason', error: 'timeout', usage: { inputTokens: 123456 } };
  result.hooks = { start: { verdict: 'pass' }, end: { verdict: 'note', text: 'hook output' } };
  result.forward = { kind: 'append', text: 'forwarded', contexts: ['context one', 'context two'], source: 'studio-pixie-gate' };
  await render({ result }, host => {
    for (const text of ['stage text', 'stage reason', 'timeout', 'hook output', 'context one', 'context two', 'Start hook', 'End hook']) assert.ok(host.textContent.includes(text));
    assert.doesNotMatch(host.textContent, /123456|tokens|usage/i);
    assert.doesNotMatch(host.textContent, /cannot be calculated/);
  });
});

test('supports explicit skipped ids and Chinese copy without changing verdict', async () => {
  const result = base(); result.stages.command = { verdict: 'pass' };
  await render({ result, locale: 'zh-CN', skipped: ['command'] }, host => {
    assert.match(host.querySelector('[data-gate-stage=command]').textContent, /通过已跳过/);
  });
});

test('a real forward error does not claim commands were skipped', async () => {
  const result = base(); result.forwardError = { verdict: 'error', error: 'missing text' };
  await render({ result }, host => {
    assert.match(host.textContent, /Forward error/);
    assert.doesNotMatch(host.textContent, /command stages were skipped/);
  });
});
