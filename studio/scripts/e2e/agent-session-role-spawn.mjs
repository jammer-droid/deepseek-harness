#!/usr/bin/env node
/**
 * #33 L0: session role spawn overrides and continuation on a scripted mock model.
 * Run against server.mjs up --mock-llm using the same STUDIO_E2E_HOME/PROFILE:
 *   node studio/scripts/e2e/agent-session-role-spawn.mjs
 * No UI coverage, live-model quality, KV-cache, or cold-restart claims.
 * Model evidence is the nonempty wire model retained by the existing child;
 * the mock does not capture reasoning options, so those are not asserted here.
 */
import assert from 'node:assert/strict';
import { captureEvidence } from './agent-lib.mjs';
import { mockSay, mockScript, runAgent } from './agent.mjs';

const HISTORY = 'HISTORY_SESSION_SPAWN_33';
const ORIGINAL = 'PERSONA_SESSION_ORIGINAL_33';
const CHANGED = 'PERSONA_SESSION_CHANGED_33';
const TEMP = 'PERSONA_SESSION_TEMP_33';
const TOOLS = ['read', 'subagent_role', 'send_message'];

await runAgent({ name: 'agent-session-role-spawn' }, async t => {
  // Refuse live models before creating presets or sending any prompt.
  assert.ok(t.state.mock, 'requires server.mjs up --mock-llm');
  const catalog = await t.rpc('session/modelCatalog');
  const model = `${catalog.default.provider}/${catalog.default.model}`;
  const presetRole = { name: 'Reviewer', role: 'review', model, reasoning: 'inherit', spawn: 'fork', persona: ORIGINAL };
  const preset = await t.preset({ tools: TOOLS, roles: [presetRole] });
  const session = await t.session(preset);
  const view = () => t.rpc('studioSessionRoles/view', { sessionId: session });
  const edit = patch => t.rpc('studioSessionRoles/editRole', { sessionId: session, payload: JSON.stringify({ role: 'review', ...patch }) });
  const captures = id => t.captures().filter(record => record.session === id && record.purpose === 'turn');
  const markers = [HISTORY, ORIGINAL, CHANGED, TEMP];

  const afterHistory = await t.prompt(session, `${HISTORY}\n${mockSay('history recorded')}`);
  if (!await t.settle(session, { after: afterHistory })) return;

  await edit({ spawn: 'fresh' });
  await t.check('preset role override persists Fresh and original configuration', async () => {
    const role = (await view()).roles.find(item => item.role === 'review');
    assert.equal(role.source, 'session');
    assert.equal(role.spawn, 'fresh');
    assert.equal(role.persona, ORIGINAL);
    assert.equal(role.model, model);
    const stored = (await t.rpc('studioCatalog/listPresets')).find(item => item.id === preset);
    assert.equal(stored.agents[0].spawn, 'fork');
    assert.equal(stored.agents[0].persona, ORIGINAL);
  });

  async function delegate(role, count) {
    const before = new Set(t.childIds(session));
    const after = await t.prompt(session, mockScript([
      ['subagent_role', { action: 'call', role, task: mockSay('child finished') }],
      mockSay('delegation finished'),
    ]));
    if (!await t.settle(session, { after, children: count })) return;
    const added = (await t.children(session, { markers })).filter(child => !before.has(child.id));
    assert.equal(added.length, 1, 'exactly one new child per delegation');
    return added[0];
  }

  const fresh = await delegate('review', 1);
  if (!fresh) return;
  t.expectChild('session override creates Fresh without parent history', fresh, {
    persona: ORIGINAL, notInheritsMarker: HISTORY, tools: TOOLS,
  });
  const originalPolicy = structuredClone(fresh.policy);
  const originalModels = captures(fresh.id).map(record => record.model);
  await t.check('original child exposes a concrete wire model', () => {
    assert.ok(originalModels.length > 0);
    assert.ok(originalModels.every(value => typeof value === 'string' && value.length > 0));
    assert.equal(new Set(originalModels).size, 1);
  });

  await edit({ spawn: 'fork', persona: CHANGED, model: 'inherit' });
  await t.check('same session role saves Fork and changed persona/model selection', async () => {
    const role = (await view()).roles.find(item => item.role === 'review');
    assert.equal(role.spawn, 'fork');
    assert.equal(role.persona, CHANGED);
    assert.equal(role.model, 'inherit');
  });
  const fork = await delegate('review', 2);
  if (!fork) return;
  t.expectChild('next child uses Fork and changed persona', fork, {
    persona: CHANGED, inheritsMarker: HISTORY, tools: TOOLS,
  });

  // Addition also accepts Fork rather than silently defaulting every new role to Fresh.
  await t.rpc('studioSessionRoles/addRole', { sessionId: session, payload: JSON.stringify({
    name: 'Temporary', role: 'temporary33', model: 'inherit', reasoning: 'inherit', spawn: 'fork', persona: TEMP,
  }) });
  await t.check('temporary role persists explicit Fork', async () => {
    const role = (await view()).roles.find(item => item.role === 'temporary33');
    assert.equal(role.spawn, 'fork');
    assert.equal(role.source, 'session');
  });
  const temporary = await delegate('temporary33', 3);
  if (!temporary) return;
  t.expectChild('temporary Fork inherits completed parent history', temporary, {
    persona: TEMP, inheritsMarker: HISTORY, tools: TOOLS,
  });

  // Continue the OLD Fresh child via the parent's real send_message tool, not a new role call.
  const idsBefore = t.childIds(session).sort();
  const childTurnsBefore = t.evidence(fresh.id).turnsEnded;
  const captureCount = t.captures().length;
  const parentCallsBefore = t.evidence(session).calls.length;
  const after = await t.prompt(session, mockScript([
    ['send_message', { agent_id: fresh.id, message: mockSay('continued original child') }],
    mockSay('continuation sent'),
  ]));
  if (!await t.settle(session, { after, children: 3 })) return;
  if (!await t.settle(fresh.id, { after: childTurnsBefore })) return;
  await t.check('send_message executes successfully on existing child', () => {
    const calls = t.evidence(session).calls.slice(parentCallsBefore);
    assert.ok(calls.some(call => call.name === 'send_message' && call.ok === true));
    assert.ok(!calls.some(call => call.name === 'subagent_role'));
    assert.deepEqual(t.childIds(session).sort(), idsBefore);
  });
  await t.check('continuation preserves original policy, persona and wire model', async () => {
    const current = (await t.children(session, { markers })).find(child => child.id === fresh.id);
    assert.ok(current);
    assert.deepEqual(current.policy, originalPolicy);
    const records = t.captures().slice(captureCount).filter(record => record.session === fresh.id && record.purpose === 'turn');
    assert.ok(records.length > 0, 'old child made a new model request');
    assert.ok(records.every(record => record.model === originalModels[0]), 'wire model must remain unchanged');
    const applied = captureEvidence(records, fresh.id, markers);
    assert.equal(applied.systemMarkers[ORIGINAL], true);
    assert.equal(applied.systemMarkers[CHANGED], false);
    assert.equal(applied.historyMarkers[HISTORY], false);
  });
});
