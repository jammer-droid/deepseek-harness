/** Structured edits preserve unknown data and reject stale/forged requests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresetSettingsOwner } from '../packages/general/src/preset-settings.ts';

function fixture() {
  const initial = { id: 'test', name: 'Test', plugins: [
    { name: 'tool', config: { prompt: 'original', count: 2, enabled: true, list: [1, 2], expression: { __jsExpr: 'process.platform' } } },
    { name: 'conditional', disabled: { __jsExpr: 'false' } },
    { name: 'group', group: true, config: [{ name: 'nested', config: { value: 'nested' } }] },
  ] };
  const entry = { options: { id: 'preset-test', name: '@deepseek-ai/dsh-agent-preset', config: structuredClone(initial) } };
  let override = {};
  const editor = {
    entries: () => [entry],
    configuration: () => [{ entry, inherited: structuredClone(initial), override }],
    async edit(target, change) {
      assert.equal(target, entry);
      const next = change(structuredClone(entry.options.config), structuredClone(initial));
      entry.options.config = next;
      override = JSON.stringify(next) === JSON.stringify(initial) ? {} : structuredClone(next);
    },
  };
  const owner = new PresetSettingsOwner({ get: name => name === 'configEditor' ? editor : { list: async () => [{ id: 'test' }] } });
  return { owner, entry, initial };
}

test('edits literals and nested rows, preserves conditions and arrays, resets to inherited', async () => {
  const { owner, entry, initial } = fixture();
  const [before] = await owner.describe();
  assert.equal(before.availability, 'available');
  assert.deepEqual(before.plugins[0].fields.map(field => field.path), [['prompt'], ['count'], ['enabled']]);
  assert.equal(before.plugins[1].disabled, null);
  const request = { ...structuredClone(before), reset: false };
  request.plugins[0].disabled = true;
  request.plugins[0].fields[0].value = 'edited';
  request.plugins[3].fields[0].value = 'child edit';
  const [after] = await owner.apply(request);
  assert.equal(after.overridden, true);
  assert.equal(entry.options.config.plugins[0].config.prompt, 'edited');
  assert.deepEqual(entry.options.config.plugins[0].config.expression, { __jsExpr: 'process.platform' });
  assert.deepEqual(entry.options.config.plugins[0].config.list, [1, 2]);
  assert.deepEqual(entry.options.config.plugins[1], initial.plugins[1]);
  assert.equal(entry.options.config.plugins[2].config[0].config.value, 'child edit');
  await assert.rejects(owner.apply(request), /revision-conflict/);
  const [reset] = await owner.apply({ ...after, reset: true, plugins: [] });
  assert.equal(reset.overridden, false);
  assert.deepEqual(entry.options.config, initial);
});

test('removes groups, restores inherited components, and rejects unknown templates', async () => {
  const { owner, entry } = fixture();
  const [before] = await owner.describe();
  const group = before.components.find(item => item.name === 'group');
  assert.equal(group.plugins.length, 2);
  const [removed] = await owner.apply({ ...before, reset: false, remove: [[2]] });
  assert.equal(entry.options.config.plugins.length, 2);
  assert.ok(removed.components.some(item => item.key === group.key));
  const [restored] = await owner.apply({ ...removed, reset: false, add: [group.key] });
  assert.equal(entry.options.config.plugins[2].config[0].config.value, 'nested');
  await assert.rejects(owner.apply({ ...restored, reset: false, add: ['missing'] }), /component-unavailable/);
  await assert.rejects(owner.apply({ ...restored, reset: false, remove: [[123]] }), /invalid-plugin-removal/);
  assert.equal(entry.options.config.plugins.length, 3);
});

test('rejects changed paths, conditional enablement, wrong field types and unavailable entries without writing', async () => {
  for (const mutate of [
    request => { request.plugins[0].path = [999]; },
    request => { request.plugins[0].fields[0].path = ['__proto__']; },
    request => { request.plugins[0].fields[0].value = false; },
    request => { request.plugins[1].disabled = false; },
    request => { request.entryId = 'other'; },
    request => { request.plugins.pop(); },
  ]) {
    const { owner, entry, initial } = fixture();
    const [before] = await owner.describe();
    const request = { ...before, reset: false };
    mutate(request);
    await assert.rejects(owner.apply(request));
    assert.deepEqual(entry.options.config, initial);
  }
});
