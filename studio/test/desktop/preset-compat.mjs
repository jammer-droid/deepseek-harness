/** S1: exercise public preset lifetime contracts with an unmodified runtime's Loader. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const runtime = process.env.STUDIO_PRESET_RUNTIME;
if (!runtime) throw new Error('Set STUDIO_PRESET_RUNTIME to a runtime directory containing node_modules.');
const require = createRequire(resolve(runtime, 'package.json'));
const load = async name => import(pathToFileURL(require.resolve(`@deepseek-ai/${name}`)).href);
const { Context } = await load('cordis');
const { default: Loader } = await load('cordis-plugin-loader');
const { default: Presets } = await load('dsh-agent-preset-registry');
const { default: Prompt } = await load('dsh-system-prompt');
const { default: Agents, assembleContextFor } = await load('dsh-agent');
const { SessionId, default: Sessions } = await load('dsh-session');
const { default: Projections } = await load('dsh-session-projection');
const { default: Llm } = await load('dsh-llm');
const { default: Tools } = await load('dsh-tools');
const { default: Loop } = await load('dsh-agent-loop');
const version = require('@deepseek-ai/dsh-agent-preset-registry/package.json').version;
if (process.env.STUDIO_PRESET_EXPECT_VERSION) assert.equal(version, process.env.STUDIO_PRESET_EXPECT_VERSION);

// This is a capability probe, not a replacement implementation of the registry.
test(`Studio preset registration and retained generations (${version})`, { timeout: 20000 }, async () => {
  const ctx = new Context();
  const handles = [];
  try {
    for (const plugin of [Loader, Llm, Sessions, Projections, Prompt, Tools, Agents]) await ctx.plugin(plugin);
    await ctx.plugin(Loop, { agents: [] });
    await ctx.plugin(Presets, { default: 'original' });
    ctx.loader.builtins.studioInstructions = {
      inject: ['systemPrompt'],
      apply(owner, config) {
        owner.effect(() => owner.systemPrompt.section({ name: 'studio:instructions:main', order: 100, text: config.text }));
      },
    };
    const definition = (id, text) => ({ id, plugins: [{ name: 'cordis:studioInstructions', config: { text } }] });
    const declare = definition => ctx.plugin({
      inject: ['agentPresets'],
      async *apply(owner) { yield await owner.agentPresets.register(definition); },
    });
    const create = async id => {
      const handle = await ctx.agents.create({
        sessionId: SessionId(crypto.randomUUID()),
        setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, id); },
      });
      handles.push(handle);
      return handle.agent;
    };
    const text = async agent => (await ctx.systemPrompt.assemble(assembleContextFor(agent))).sections
      .filter(section => section.name === 'studio:instructions:main').map(section => section.text);
    await declare(definition('original', 'Original instructions'));
    const originalDocument = await ctx.agentPresets.readDocument('original');
    const original = await create('original');
    const id = 'studio-workflow:compatibility';
    const first = await declare(definition(id, 'Revision one'));
    assert.equal((await ctx.agentPresets.resolve(id)).broken, undefined);
    const oldAgent = await create(id);
    assert.deepEqual(await text(oldAgent), ['Revision one']);
    await assert.rejects(ctx.agentPresets.register(definition(id, 'Collision')), /duplicate|already/i);
    assert.deepEqual(await text(oldAgent), ['Revision one']);

    await first.dispose();
    await assert.rejects(ctx.agentPresets.resolve(id), /not.found|unknown|registered/i);
    assert.deepEqual(await text(oldAgent), ['Revision one']);
    const second = await declare(definition(id, 'Revision two'));
    const newAgent = await create(id);
    assert.deepEqual(await text(newAgent), ['Revision two']);
    assert.deepEqual(await text(oldAgent), ['Revision one']);
    assert.deepEqual(await text(original), ['Original instructions']);
    assert.deepEqual(await ctx.agentPresets.readDocument('original'), originalDocument);

    await second.dispose();
    const broken = await declare({ id, plugins: [{ name: 'cordis:studioMissingPlugin' }] });
    assert.ok((await ctx.agentPresets.resolve(id)).broken);
    await assert.rejects(create(id));
    // Failed replacement is not rollback: only already-bound agents retain the prior revision.
    assert.deepEqual(await text(newAgent), ['Revision two']);
    assert.deepEqual(await text(oldAgent), ['Revision one']);
    await broken.dispose();
    const recovered = await declare(definition(id, 'Recovered instructions'));
    assert.deepEqual(await text(await create(id)), ['Recovered instructions']);
    await recovered.dispose();
    assert.equal((await ctx.agentPresets.list()).some(preset => preset.id === id), false);
    assert.deepEqual(await text(newAgent), ['Revision two']);
  } finally {
    for (const handle of handles.reverse()) await handle.dispose();
    await ctx.fiber.dispose();
  }
});
