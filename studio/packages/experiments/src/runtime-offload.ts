/** Spill text-only root results while retaining canonical values for PTC. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-spill';
import type { Lifetime } from './runtime-lifetime.ts';

/** Register an owned result-content policy with a bounded head/tail preview. */
export function installOffload(ctx: Context, life: Lifetime, inlineChars: number, previewChars: number): () => void {
  const store = ctx.get('spillStore');
  if (!store) throw new Error('Studio output offload requires spillStore');
  return ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next();
    if (decision.kind !== 'accept' || Object.hasOwn(decision, 'value') || exec.parent !== undefined) return decision;
    const content = decision.content ?? result.content;
    if (!content.every(block => block.type === 'text')) return decision;
    const text = content.map(block => block.text).join('\n');
    const sessionId = exec.agent?.session.header.id;
    if (!sessionId || text.length <= inlineChars) return decision;
    return life.run(async () => {
      try {
        const ref = await store.saveText({ owner: { sessionId }, source: { kind: 'tool', toolName: exec.name, callId: exec.callId, label: 'test-plugin-result' }, suggestedName: `${exec.name}.txt`, content: text });
        const notice = `\n[Offloaded ${ref.bytes} UTF-8 bytes. Full output: ${ref.locator}\n${ref.retrievalHint}]`;
        if (notice.length > inlineChars) throw new Error('Spill locator exceeds inline budget');
        const gap = '\n[… omitted …]\n';
        const budget = Math.max(0, Math.min(previewChars, inlineChars - notice.length - gap.length));
        let head = Math.ceil(budget / 2);
        const tail = Math.floor(budget / 2);
        let start = text.length - tail;
        if (head > 0 && /[\uD800-\uDBFF]/.test(text.charAt(head - 1))) head--;
        if (tail > 0 && /[\uDC00-\uDFFF]/.test(text.charAt(start))) start++;
        const preview = budget ? text.slice(0, head) + gap + (tail ? text.slice(start) : '') : '';
        return { kind: 'accept' as const, ...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}), content: [{ type: 'text' as const, text: preview + notice }] };
      } catch (error) {
        ctx.logger.warn(`Studio offload failed; retaining original: ${String(error)}`);
        return decision;
      }
    });
  }, { prepend: true });
}
