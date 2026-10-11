/** Keyless lifecycle probe mounted only by an isolated Desktop-runtime profile. */
import assert from 'node:assert/strict';
import { writeFile, rename, access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { LlmAdapter, ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';

export const inject = ['llm', 'agents', 'studioRoles', 'studioDelegation', 'agentPresets', 'tools'];
class ProbeAdapter extends LlmAdapter {
  async listModels(provider) { return [{ provider, id: 'probe', name: 'Probe' }]; }
  async resolveModel(provider, model) { return { provider, id: model, name: model }; }
  async *stream(options) {
    const reviewer = options.tools?.some(tool => tool.name === 'studio_review_submit');
    const block = reviewer ? { type: 'tool-call', id: ToolCallId(crypto.randomUUID()), name: 'studio_review_submit', arguments: JSON.stringify({ judgment: 'pass', explanation: 'Probe review', evidence: ['Probe evidence'], additionalVerification: [] }) } : { type: 'text', text: 'Probe completed.' };
    yield { type: 'block-start', index: 0, blockType: block.type };
    if (reviewer) yield { type: 'tool-call-delta', index: 0, id: block.id, name: block.name, argumentsDelta: block.arguments };
    else yield { type: 'text-delta', index: 0, text: block.text };
    yield { type: 'block-end', index: 0, block };
    yield { type: 'finish', reason: { kind: reviewer ? 'tool-calls' : 'stop' } };
  }
}
async function until(read, predicate, signal) {
  const deadline = Date.now() + 20_000;
  while (!predicate(await read())) {
    if (Date.now() > deadline) throw new Error(`Probe timed out: ${JSON.stringify(await read())}`);
    await setTimeout(25, undefined, { signal });
  }
}
async function report(result) {
  const path = process.env.STUDIO_PROBE_RESULT;
  await writeFile(`${path}.tmp`, JSON.stringify(result, null, 2));
  await rename(`${path}.tmp`, path);
}
export function apply(ctx) {
  ctx.effect(() => ctx.llm.registerAdapter(['studio-probe'], new ProbeAdapter()));
  const run = async signal => {
    await until(async () => {
      try { await access(process.env.STUDIO_PROBE_START); return true; }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    }, Boolean, signal);
    await until(() => ctx.agentPresets.list(), presets => presets.some(preset => preset.id === 'studio-managed'));
    const settings = { instructions: 'Run the isolated lifecycle probe.', provider: 'studio-probe', model: 'probe' };
    const state = ctx.studioRoles.describe();
    await ctx.studioRoles.apply({ expectedProcessId: state.processId, expectedRevision: state.revision, expectedSnapshotId: state.snapshotId, roles: { implementer: settings, reviewer: settings } });
    const handle = await ctx.agents.create({ sessionId: SessionId(crypto.randomUUID()), agentOptions: settings, meta: { cwd: process.env.STUDIO_PROBE_WORKSPACE, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) });
    try {
      handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Prepare probe.' }], source: { kind: 'user' } }));
      await handle.agent.whenIdle();
      const rows = () => ctx.studioRoles.agents(handle.agent.id);
      const execute = async args => {
        const result = await ctx.tools.execute({ agent: handle.agent, signal: new AbortController().signal, callId: ToolCallId(crypto.randomUUID()), name: 'studio_delegate', arguments: args });
        assert.equal(!!result.isError, false, JSON.stringify(result));
      };
      await execute({ action: 'initial', role: 'implementer', prompt: 'Implement probe.', context: 'fork' });
      await until(rows, rows => rows[0]?.cyclePhase === 'review-ready');
      const original = rows()[0];
      assert.ok(original.inheritedEventCount > 0);
      const evidence = { requirements: 'Probe', summary: 'Probe', changedFiles: [], validations: [], failures: [], unrun: [] };
      await execute({ action: 'review', cycleId: original.cycleId, evidence });
      await until(rows, rows => rows[0]?.cyclePhase === 'judged');
      assert.equal(rows()[1].judgment?.judgment, 'pass');
      const reviewerId = rows()[1].childId;
      await execute({ action: 'rework', cycleId: original.cycleId, prompt: 'Repeat probe.' });
      await until(rows, rows => rows[0]?.cyclePhase === 'review-ready');
      assert.equal(rows()[0].childId, original.childId);
      assert.equal(rows()[0].reworkCount, 1);
      await execute({ action: 'review', cycleId: original.cycleId, evidence });
      await until(rows, rows => rows[0]?.cyclePhase === 'judged');
      assert.equal(rows()[1].childId, reviewerId);
      assert.equal(rows()[1].judgment?.judgment, 'pass');
      await execute({ action: 'complete', cycleId: original.cycleId });
      assert.equal(rows()[0].cyclePhase, 'complete');
      await execute({ action: 'stop', cycleId: original.cycleId });
      assert.ok(rows().every(row => row.stop?.status === 'confirmed'));
      await report({ ok: true, rows: rows() });
    } finally { await handle.dispose(); }
  };
  ctx.effect(() => {
    const cancellation = new AbortController();
    const running = run(cancellation.signal).catch(async error => {
      if (!cancellation.signal.aborted) await report({ ok: false, error: error.stack });
    });
    return async () => { cancellation.abort(); await running; };
  });
}
