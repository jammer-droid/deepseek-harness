/** Managed creation must remain guarded when the role storage owner is unavailable. */
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { SessionId } from '@deepseek-ai/dsh-session';
import { launchWebScaffold } from '@studio-test/scaffold';
const studio = fileURLToPath(new URL('..', import.meta.url));
it('refuses managed creation before input when the policy storage owner is unavailable', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles'].map(name => `${studio}/packages/${name}/package.json`),
  });
  try {
    const ctx = scaffold.ctx;
    const owner = [...ctx.loader.entries()].find(entry => entry.options.name === '@local/dsh-studio-roles');
    if (!owner?.fiber) throw new Error('Missing role storage owner');
    await owner.fiber.dispose();
    expect(ctx.get('studioDelegation')).toBeUndefined();
    let created = 0;
    const off = ctx.on('agent/created', ({ agent }) => { if (agent.id === 'storage-unavailable-managed') created++; });
    try {
      await expect(ctx.agents.create({ sessionId: SessionId('storage-unavailable-managed'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed' }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) })).rejects.toThrow('waiting for studioDelegation');
      expect(created).toBe(0);
      expect(ctx.agents.roots()).toEqual([]);
      const ordinary = await ctx.agents.create({ sessionId: SessionId('storage-unavailable-ordinary'), meta: { cwd: scaffold.workspaceCwd } });
      await ordinary.dispose();
    } finally { off(); }
  } finally { await scaffold.close(); }
});

it('refuses a managed child with no durable role reservation before input is released', async () => {
  const scaffold = await launchWebScaffold({
    extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
    extraInstallAnchors: ['bundle', 'shell', 'roles'].map(name => `${studio}/packages/${name}/package.json`),
  });
  try {
    const ctx = scaffold.ctx;
    let reachedCreated = false;
    const off = ctx.on('agent/created', ({ agent }) => { if (agent.id === 'missing-sidecar-child') reachedCreated = true; });
    try {
      const outcome = await ctx.agents.create({ sessionId: SessionId('missing-sidecar-child'), meta: { cwd: scaffold.workspaceCwd, agentPreset: 'studio-managed', parentSession: SessionId('missing-sidecar-parent'), origin: 'subagent', delegationDepth: 1 }, setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'studio-managed').then(() => undefined) }).then(async handle => { await handle.dispose(); return 'created'; }, error => error instanceof Error ? error.message : String(error));
      expect(outcome).toContain('studio-managed-recovery-required');
      expect(reachedCreated).toBe(false);
      expect(ctx.studioRoles.agents(SessionId('missing-sidecar-parent'))).toEqual([]);
    } finally { off(); }
  } finally { await scaffold.close(); }
});
