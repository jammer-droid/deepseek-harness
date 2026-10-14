/** A session picks a Studio preset after its Agent was created under the default preset. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { createScope, bindScopeParent, scopeTarget } from '@deepseek-ai/dsh-scope';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import * as policyPlugin from '../src/host/preset-policy.ts';

const tool = name => ({ name, description: `${name} original`, parameters: { type: 'object', properties: {} },
  output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] }, execute: async () => 'ok' });
const config = { tools: ['read'], toolOverrides: { read: { description: 'Studio read' } }, sections: {}, prompt: 'Studio rules' };

/** Mirrors agent-preset-registry: preset scopes, an Agent registry, and recompose = rebind + tools/change. */
async function runtime() {
  const ctx = new Context();
  await ctx.plugin(SystemPrompt); await ctx.plugin(Tools);
  for (const name of ['read', 'write', 'todo_write']) ctx.tools.register(tool(name));
  const live = [];
  ctx.provide('agents'); ctx.set('agents', { list: () => [...live] });
  const holder = ctx.inject(['tools', 'systemPrompt'], () => {});
  const presetScope = () => { const key = {}; return { key, scope: createScope(holder.ctx, key) }; };
  const standard = presetScope(), studio = presetScope();
  await studio.scope.ctx.plugin(policyPlugin, config);
  const createAgent = async preset => {
    const agent = { id: `a${live.length}` };
    const scope = createScope(holder.ctx, agent);
    agent.ctx = scope.ctx; agent.binding = bindScopeParent(agent, preset.key);
    live.push(agent);
    await ctx.serial(scopeTarget(agent, agent), 'agent/created', { agent, source: 'startup' }).catch(() => {});
    return agent;
  };
  const recompose = (agent, preset) => { agent.binding.rebind(preset.key); ctx.emit('tools/change'); };
  return { ctx, standard, studio, createAgent, recompose };
}

test('selecting a Studio preset after creation installs its policy; switching away releases it', async () => {
  const { ctx, standard, studio, createAgent, recompose } = await runtime();
  const agent = await createAgent(standard);
  assert.deepEqual(ctx.tools.schemas(agent).map(t => t.name).sort(), ['read', 'todo_write', 'write']);

  recompose(agent, studio);
  assert.deepEqual(ctx.tools.schemas(agent).map(t => t.name), ['read']);
  assert.equal(ctx.tools.get('read', agent).description, 'Studio read');
  const denied = await ctx.tools.execute({ name: 'write', callId: 'c', arguments: {}, agent, signal: new AbortController().signal });
  assert.match(JSON.stringify(denied), /excluded by Studio|not found|unknown/i);

  recompose(agent, standard);
  assert.deepEqual(ctx.tools.schemas(agent).map(t => t.name).sort(), ['read', 'todo_write', 'write']);
  assert.equal(ctx.tools.get('read', agent).description, 'read original');
});

test('an Agent created directly under the Studio preset gets the policy exactly once', async () => {
  const { ctx, studio, createAgent } = await runtime();
  const agent = await createAgent(studio);
  ctx.emit('tools/change');
  assert.deepEqual(ctx.tools.schemas(agent).map(t => t.name), ['read']);
  assert.equal(ctx.tools.get('read', agent).description, 'Studio read');
});

test('an Agent that joins but cannot take the policy fails closed', async () => {
  const { ctx, standard, studio, createAgent, recompose } = await runtime();
  const agent = await createAgent(standard);
  agent.ctx.tools.register(tool('own'));  // own-scope tools are rejected by installPolicy
  recompose(agent, studio);
  const result = await ctx.tools.execute({ name: 'read', callId: 'c', arguments: {}, agent, signal: new AbortController().signal });
  assert.match(JSON.stringify(result), /could not be installed/);
});

// Production: standard's tool-subagent leaves its own-scope `subagent` on the Agent and removes
// it asynchronously after the same tools/change that reparented the Agent.
test('a blocked Agent takes the policy once the previous preset releases its own-scope tool', async () => {
  const { ctx, standard, studio, createAgent, recompose } = await runtime();
  const agent = await createAgent(standard);
  const releaseSubagent = agent.ctx.tools.register(tool('subagent'));
  recompose(agent, studio);
  const blocked = await ctx.tools.execute({ name: 'read', callId: 'c', arguments: {}, agent, signal: new AbortController().signal });
  assert.match(JSON.stringify(blocked), /could not be installed/);

  releaseSubagent();  // unregistering emits tools/change
  assert.deepEqual(ctx.tools.schemas(agent).map(t => t.name), ['read']);
  assert.equal(ctx.tools.get('read', agent).description, 'Studio read');
  const allowed = await ctx.tools.execute({ name: 'read', callId: 'c', arguments: {}, agent, signal: new AbortController().signal });
  assert.doesNotMatch(JSON.stringify(allowed), /could not be installed|excluded/);
});
