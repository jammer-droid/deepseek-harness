import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Context } from '@deepseek-ai/cordis';
import yaml from 'js-yaml';
import { TYPERT } from '../packages/catalog/lib/typert.host.js';
import * as Tool from '../packages/catalog/tool.js';
test('built reflection loads and model tool selects explicit role revision and task', async () => {
  const ctx = new Context();
  const roleId = 'ee506b61-c19b-4467-9ffd-a26422a1a83b';
  const roles = [{ id: roleId, name: 'Custom workflow', roleName: 'Research companion', revision: 2 }];
  const calls = [];
  let registered;
  ctx.provide('tools', { register: tool => { registered = tool; return () => { registered = undefined; }; } });
  ctx.provide('studioCatalog', { roles: async () => roles, assignments: async () => [], launch: async request => { calls.push(request); return { childId: 'child' }; }, launchForAgent: async request => { calls.push(request); return { childId: 'child' }; } });
  try {
    assert.ok(TYPERT);
    Tool.apply(ctx);
    assert.equal(registered.name, 'studio_role');
    assert.deepEqual(JSON.parse(await registered.execute({ action: 'roles' }, {})), roles);
    const request = { roleId, revision: 2, task: 'Investigate evidence', context: 'fresh' };
    assert.deepEqual(JSON.parse(await registered.execute({ action: 'launch', ...request }, { agent: { id: 'parent' }, signal: new AbortController().signal })), { childId: 'child' });
    assert.deepEqual(calls, [{ ...request, parentId: 'parent' }]);
  } finally { await ctx.fiber.dispose(); }
  assert.equal(registered, undefined);
});
test('bundle keeps catalog opt-in and offers an arbitrary-role model preset', async () => {
  const entries = yaml.load(await readFile(new URL('../packages/bundle/cordis.patch.yml', import.meta.url), 'utf8'))[0].insert;
  assert.equal(entries.find(entry => entry.name === '@local/dsh-studio-catalog').disabled, true);
  const preset = entries.find(entry => entry.config?.id === 'studio-composed-roles');
  assert.ok(preset.config.plugins.some(plugin => plugin.name === '@local/dsh-studio-catalog/tool'));
  assert.ok(!preset.config.plugins.some(plugin => plugin.name === '@local/dsh-studio-roles/delegation-tool'));
});
