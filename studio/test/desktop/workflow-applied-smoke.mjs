/** Packaged Studio persistence-to-request test on an unmodified full runtime. */
import assert from 'node:assert/strict';
import { access, writeFile, rename } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
export const inject = ['studioWorkflows', 'sessionController', 'agentPresets', 'agents', 'llm'];
export function apply(ctx) {
  const requests = [];
  class Adapter extends LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'probe', name: 'Probe' }, { provider, id: 'requested', name: 'Requested' }]; }
    async resolveModel(provider, model) { return { provider, id: model, name: model }; }
    async *stream(options) {
      requests.push({ sessionId: options.sessionId, messages: options.messages });
      const block = { type: 'text', text: 'Studio packaged workflow completed.' };
      yield { type: 'block-start', index: 0, blockType: 'text' };
      yield { type: 'text-delta', index: 0, text: block.text };
      yield { type: 'block-end', index: 0, block };
      yield { type: 'finish', reason: { kind: 'stop' } };
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['studio-probe'], new Adapter()));
  const report = async result => { const path = process.env.STUDIO_PROBE_RESULT; await writeFile(`${path}.tmp`, JSON.stringify(result)); await rename(`${path}.tmp`, path); };
  ctx.effect(() => {
    const cancellation = new AbortController();
    const running = (async () => {
      while (true) {
        try { await access(process.env.STUDIO_PROBE_START); break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
        await setTimeout(50, undefined, { signal: cancellation.signal });
      }
      if (!process.env.STUDIO_PROBE_RESTART) {
        try { await access(process.env.STUDIO_PROBE_RESULT); return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      if (process.env.STUDIO_PROBE_RESTART) {
        const states = await ctx.studioWorkflows.applications();
        assert.equal(states.length, 1); const state = states[0];
        assert.equal(state.applied.revision, 2); assert.equal(state.activation, 'active', JSON.stringify(state));
        const created = await ctx.sessionController.create({ cwd: process.env.STUDIO_PROBE_WORKSPACE, agentPreset: state.applied.presetId });
        await ctx.sessionController.prompt({ sessionId: created.sessionId, requestId: crypto.randomUUID(), mode: 'queue', content: [{ type: 'text', text: 'Verify restored snapshot.' }] }, cancellation.signal);
        await ctx.agents.get(created.sessionId).whenIdle();
        assert.match(JSON.stringify(requests[0].messages), /STUDIO_PACKAGED_TWO/);
        assert.equal((await ctx.studioWorkflows.applications())[0].observations[0].matches, true);
        await report({ ok: true, evidence: 'Applied revision 2 restored without draft rewrite and executed in restarted unmodified runtime' }); return;
      }
      const id = crypto.randomUUID();
      const document = { documentVersion: 3, name: 'Packaged Studio workflow', mainRoleId: 'main', roles: [{ id: 'main', name: 'Main', model: { provider: 'studio-probe', model: 'requested' }, components: [{ instanceId: 'one', id: 'studio.instructions', version: 1, scope: 'role', config: { text: 'STUDIO_PACKAGED_ONE' } }] }], systems: [], connections: [] };
      const draft = await ctx.studioWorkflows.save({ id, expectedRevision: 0, document });
      assert.equal(draft.revision, 1);
      const applied = await ctx.studioWorkflows.applyDraft({ id, draftRevision: 1, expectedRevision: 0 });
      assert.equal(applied.activation, 'active', JSON.stringify(applied));
      const created = await ctx.sessionController.create({ cwd: process.env.STUDIO_PROBE_WORKSPACE, agentPreset: applied.applied.presetId });
      await ctx.sessionController.prompt({ sessionId: created.sessionId, requestId: crypto.randomUUID(), mode: 'queue', content: [{ type: 'text', text: 'Run packaged Studio instructions.' }] }, cancellation.signal);
      await ctx.agents.get(created.sessionId).whenIdle();
      assert.equal(requests.length, 1);
      assert.match(JSON.stringify(requests[0].messages), /STUDIO_PACKAGED_ONE/);
      assert.match(JSON.stringify(requests[0].messages), /You are an AI agent/);
      const state = (await ctx.studioWorkflows.applications()).find(item => item.applied.id === id);
      assert.equal(state.observations.length, 1, JSON.stringify(state));
      assert.equal(state.observations[0].matches, false);
      assert.equal(state.observations[0].actual.model, 'probe');
      assert.equal(state.applied.compiled.roles[0].model.model, 'requested');
      document.roles[0].model.model = 'probe';
      document.roles[0].components[0].config.text = 'STUDIO_PACKAGED_TWO';
      await ctx.studioWorkflows.save({ id, expectedRevision: 1, document });
      await ctx.studioWorkflows.applyDraft({ id, draftRevision: 2, expectedRevision: 1 });
      const fresh = await ctx.sessionController.create({ cwd: process.env.STUDIO_PROBE_WORKSPACE, agentPreset: applied.applied.presetId });
      for (const sessionId of [fresh.sessionId, created.sessionId]) {
        await ctx.sessionController.prompt({ sessionId, requestId: crypto.randomUUID(), mode: 'queue', content: [{ type: 'text', text: 'Check revision isolation.' }] }, cancellation.signal);
        await ctx.agents.get(sessionId).whenIdle();
      }
      assert.match(JSON.stringify(requests[1].messages), /STUDIO_PACKAGED_TWO/);
      assert.doesNotMatch(JSON.stringify(requests[1].messages), /STUDIO_PACKAGED_ONE/);
      assert.match(JSON.stringify(requests[2].messages), /STUDIO_PACKAGED_ONE/);
      assert.doesNotMatch(JSON.stringify(requests[2].messages), /STUDIO_PACKAGED_TWO/);
      const updated = (await ctx.studioWorkflows.applications()).find(item => item.applied.id === id);
      assert.equal(updated.observations.find(item => item.sessionId === fresh.sessionId).matches, true);
      document.roles[0].model.model = 'not-advertised';
      await ctx.studioWorkflows.save({ id, expectedRevision: 2, document });
      await assert.rejects(ctx.studioWorkflows.applyDraft({ id, draftRevision: 3, expectedRevision: 2 }), error => error.details.reason === 'validation-failed');
      assert.equal((await ctx.studioWorkflows.applications()).find(item => item.applied.id === id).applied.revision, 2);
      await report({ ok: true, state: updated, evidence: 'Packaged Studio save/apply/new session/actual request and route mismatch; keyless deterministic adapter' });
    })().catch(async error => { if (!cancellation.signal.aborted) await report({ ok: false, error: error.stack }); });
    return async () => { cancellation.abort(); await running; };
  });
}
