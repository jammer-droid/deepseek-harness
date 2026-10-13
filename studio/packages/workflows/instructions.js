/** Preset-scoped instructions and observation only; never rewrites the model route. */
export const inject = ['systemPrompt'];
export function apply(ctx, config) {
  for (const [index, section] of config.instructions.entries()) {
    ctx.effect(() => ctx.systemPrompt.section({ name: `studio:instructions:${section.instanceId}`, order: 100 + index, text: section.text, interpolate: false }));
  }
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'request/header') return;
    const service = ctx.get('studioWorkflows');
    if (service) service.observeModel(config.id, config.revision, session.id, event.data.header.config);
  });
}
