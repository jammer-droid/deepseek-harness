import type { StudioContext } from './contracts.js';

/** Compile-only regression: official Remote responses are not raw arrays. */
export async function checkOfficialContracts(ctx: StudioContext) {
  const result = await ctx.remote.pluginManager.listPlugins();
  // @ts-expect-error RemoteResult must be unwrapped before array operations.
  result.filter(() => true);
  if (result.ok) result.value.filter(row => row.enabled);
  // @ts-expect-error Official Context rejects invented services.
  ctx.studioInventedService.run();
  // @ts-expect-error Enablement is boolean, not a string.
  await ctx.remote.pluginManager.setPluginEnabled('invalid-id', 'yes');
}
