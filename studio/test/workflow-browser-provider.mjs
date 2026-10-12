/** Isolated browser-only declarations; never part of the product bundle. */
export const inject = ['studioWorkflows'];
/** @param ctx Loader-owned provider context. */
export function apply(ctx) {
  ctx.effect(() => ctx.studioWorkflows.register({
    id: 'test.sender', version: 1, scope: 'role', fields: [{ key: 'message', kind: 'text', required: true }],
    requiredSystems: [{ id: 'test.receiver', version: 1 }],
    ports: [{ id: 'out', direction: 'output', semantic: 'test.message', allowedPeers: ['test.receiver'], minConnections: 1, maxConnections: 1 }],
  }));
  ctx.effect(() => ctx.studioWorkflows.registerSystem({
    id: 'test.receiver', version: 1, scope: 'workflow', executionLocations: ['dsh'], fields: [],
    ports: [{ id: 'in', direction: 'input', semantic: 'test.message', allowedPeers: ['test.sender'], minConnections: 1, maxConnections: 1 }],
  }));
}
