import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { assemblePreview } from '../src/host/prompt-preview.ts';

test('real scope preview orders through public renderer and cleans up after rendering failure', async () => {
  const ctx = new Context();
  const calls = [];
  const sections = [];
  const tools = { restrict(filter) { calls.push(['restrict', filter]); return () => {}; } };
  let broken = false;
  const systemPrompt = {
    getSectionOrder() { return 100; },
    section(value) { sections.push(value); return () => {}; },
    variable(name, provider) { calls.push(['variable', name, provider({})]); return () => {}; },
    async assemble() { return { sections: [{ name: 'base', text: broken ? '{{missing}}' : 'Baseline' }, sections.at(-1)], contexts: [], tools: [], variables: {} }; },
  };
  const agentPresets = {
    async readDocument() { return { content: '- name: "@deepseek-ai/dsh-persona"\n  config:\n    prefix: Base\n' }; },
    async register(definition) { calls.push(['register', definition]); return async () => calls.push(['unregister']); },
    async acquireScope() { return { key: {}, async [Symbol.asyncDispose]() { calls.push(['lease-dispose']); } }; },
  };
  ctx.provide('tools'); ctx.provide('systemPrompt'); ctx.provide('agentPresets');
  ctx.set('tools', tools); ctx.set('systemPrompt', systemPrompt); ctx.set('agentPresets', agentPresets);
  {
    const request = { preset: 'standard', providers: [], tools: [], prompt: 'Literal {{value}}', model: '' };
    const result = await assemblePreview(ctx, request);
    assert.equal(result.prompt, 'Baseline\n\nLiteral {{value}}');
    assert.deepEqual(calls.find(c => c[0] === 'variable'), ['variable', 'cwd', process.cwd()]);
    assert.deepEqual(calls.find(c => c[0] === 'restrict')[1], { allow: [] });
    assert.equal(calls.find(c => c[0] === 'register')[1].plugins.length, 0);
    assert.deepEqual(calls.slice(-2).map(c => c[0]), ['lease-dispose', 'unregister']);
    broken = true;
    await assert.rejects(assemblePreview(ctx, request), /missing/);
    assert.deepEqual(calls.slice(-2).map(c => c[0]), ['lease-dispose', 'unregister']);
  }
});
