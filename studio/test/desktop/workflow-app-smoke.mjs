/** Full Session API and deterministic model request generation-retention probe. */
import assert from 'node:assert/strict';
import { access, writeFile, rename } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
export const inject = ['sessionController', 'agentPresets', 'agents', 'llm', 'loader', 'systemPrompt'];
export function apply(ctx) {
  const requests = [];
  const entered = Promise.withResolvers();
  const release = Promise.withResolvers();
  class Adapter extends LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'probe', name: 'Probe' }]; }
    async resolveModel(provider, model) { return { provider, id: model, name: model }; }
    async *stream(options) {
      requests.push(JSON.stringify(options.messages));
      if (requests.length === 1) { entered.resolve(); await release.promise; }
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: 'Probe complete.' };
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Probe complete.' } };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['studio-probe'], new Adapter()));
  ctx.loader.builtins.studioProbeInstructions = { inject: ['systemPrompt'], apply(owner, config) {
    owner.effect(() => owner.systemPrompt.section({ name: 'studio:instructions:probe', order: 100, text: config.text }));
  } };
  const declare = text => ctx.plugin({ inject: ['agentPresets'], async *apply(owner) {
    yield await owner.agentPresets.register({ id: 'studio-workflow:app-probe', plugins: [{ name: 'cordis:studioProbeInstructions', config: { text } }] });
  } });
  const report = async result => { const path = process.env.STUDIO_PROBE_RESULT; await writeFile(`${path}.tmp`, JSON.stringify(result)); await rename(`${path}.tmp`, path); };
  ctx.effect(() => {
    const cancellation = new AbortController();
    const running = (async () => {
      while (true) {
        try { await access(process.env.STUDIO_PROBE_START); break; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        await setTimeout(50, undefined, { signal: cancellation.signal });
      }
      const original = await ctx.agentPresets.list();
      const first = await declare('STUDIO_REVISION_ONE');
      const create = () => ctx.sessionController.create({ cwd: process.env.STUDIO_PROBE_WORKSPACE, agentPreset: 'studio-workflow:app-probe' });
      const prompt = sessionId => ctx.sessionController.prompt({ sessionId, requestId: crypto.randomUUID(), mode: 'queue', content: [{ type: 'text', text: 'Probe instructions.' }] }, cancellation.signal);
      const old = await create();
      await prompt(old.sessionId);
      await entered.promise;
      await first.dispose();
      const second = await declare('STUDIO_REVISION_TWO');
      const fresh = await create();
      await prompt(fresh.sessionId);
      await ctx.agents.get(fresh.sessionId).whenIdle();
      release.resolve();
      await ctx.agents.get(old.sessionId).whenIdle();
      await prompt(old.sessionId);
      await ctx.agents.get(old.sessionId).whenIdle();
      assert.equal(requests.length, 3);
      assert.match(requests[0], /STUDIO_REVISION_ONE/);
      assert.match(requests[1], /STUDIO_REVISION_TWO/);
      assert.doesNotMatch(requests[1], /STUDIO_REVISION_ONE/);
      assert.match(requests[2], /STUDIO_REVISION_ONE/);
      assert.doesNotMatch(requests[2], /STUDIO_REVISION_TWO/);
      await second.dispose();
      assert.deepEqual(await ctx.agentPresets.list(), original);
      await report({ ok: true, requests, evidence: 'Session create/prompt; replacement while old stream blocked; new and retained requests isolated' });
    })().catch(async error => { release.resolve(); if (!cancellation.signal.aborted) await report({ ok: false, error: error.stack }); });
    return async () => { cancellation.abort(); release.resolve(); await running; };
  });
}
