/** Actual profile configuration writes survive boot and reset without touching user profiles. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PresetSettingsOwner } from '../packages/general/src/preset-settings.ts';
const require = createRequire(new URL('../packages/roles/package.json', import.meta.url));
const { boot, initProfile, readProfilePatches } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')));
const { default: ConfigEditor } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-config-editor')));

const { default: AgentPresets } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-agent-preset-registry')));
const registryRequire = createRequire(require.resolve('@deepseek-ai/dsh-agent-preset-registry'));
const { default: Projections } = await import(pathToFileURL(registryRequire.resolve('@deepseek-ai/dsh-session-projection')));

test('real profile Loader persists structured changes across restart and clears inherited reset', async () => {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'studio-preset-profile-')));
  const dir = join(home, 'profiles', 'test');
  let ctx;
  try {
    initProfile(dir, ['test-bundle']);
    const bundle = join(dir, 'node_modules', 'test-bundle');
    await mkdir(bundle, { recursive: true });
    await writeFile(join(home, 'package.json'), '{"name":"test-installation"}\n');
    await writeFile(join(bundle, 'package.json'), JSON.stringify({ name: 'test-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } } }));
    await writeFile(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
      { id: 'config-editor', name: 'cordis:editor' },
      { id: 'projections', name: 'cordis:projections' },
      { id: 'registry', name: 'cordis:registry', config: { default: 'test' } },
      { id: 'preset-test', name: '@deepseek-ai/dsh-agent-preset', config: { id: 'test', name: 'Test', plugins: [{ name: 'cordis:probe', config: { instructions: 'original', list: ['keep'] } }] } },
    ] }]));
    await writeFile(join(dir, 'cordis.yml'), '[]\n');
    const profile = { name: 'test', startedBundles: ['test-bundle'], dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor: join(home, 'package.json'), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined };
    const start = () => boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), root => {
      root.provide('profileContext', profile);
      Object.assign(root.loader.builtins, { editor: ConfigEditor, registry: AgentPresets, projections: Projections, probe: { apply(_ctx, config) { if (config.instructions === 'broken') throw new Error('Rejected test instruction'); } } });
    });
    ctx = await start();
    let owner = new PresetSettingsOwner(ctx);
    const [before] = await owner.describe();
    assert.equal(before.availability, 'available');
    const request = { ...structuredClone(before), reset: false };
    request.plugins[0].fields[0].value = 'saved';
    await owner.apply(request);
    assert.match(await readFile(profile.patchPath, 'utf8'), /instructions: saved/);
    await ctx.fiber.dispose(); ctx = await start(); owner = new PresetSettingsOwner(ctx);
    const [reloaded] = await owner.describe();
    assert.equal(reloaded.plugins[0].fields[0].value, 'saved');
    assert.equal(reloaded.overridden, true);
    await assert.rejects(owner.apply(request), /revision-conflict/);
    const brokenRequest = { ...structuredClone(reloaded), reset: false };
    brokenRequest.plugins[0].fields[0].value = 'broken';
    const [broken] = await owner.apply(brokenRequest);
    assert.equal(broken.availability, 'broken');
    assert.match(await readFile(profile.patchPath, 'utf8'), /instructions: broken/);
    const originalComponent = broken.components.find(item => item.name === 'cordis:probe' && item.plugins[0].fields[0].value === 'original');
    const [removed] = await owner.apply({ ...broken, reset: false, remove: [[0]] });
    assert.equal(removed.plugins.length, 0);
    await ctx.fiber.dispose(); ctx = await start(); owner = new PresetSettingsOwner(ctx);
    const [empty] = await owner.describe();
    assert.equal(empty.plugins.length, 0);
    const [added] = await owner.apply({ ...empty, reset: false, add: [originalComponent.key] });
    assert.equal(added.availability, 'available');
    await ctx.fiber.dispose(); ctx = await start(); owner = new PresetSettingsOwner(ctx);
    const [restoredComponent] = await owner.describe();
    assert.equal(restoredComponent.plugins[0].fields[0].value, 'original');
    await owner.apply({ ...restoredComponent, reset: true, plugins: [] });
    await ctx.fiber.dispose(); ctx = await start(); owner = new PresetSettingsOwner(ctx);
    const [reset] = await owner.describe();
    assert.equal(reset.plugins[0].fields[0].value, 'original');
    assert.equal(reset.overridden, false);
  } finally {
    await ctx?.fiber.dispose();
    assert.equal(dirname(home), await realpath(tmpdir()));
    assert.ok(home.includes('/studio-preset-profile-'));
    await rm(home, { recursive: true, force: true });
  }
});
