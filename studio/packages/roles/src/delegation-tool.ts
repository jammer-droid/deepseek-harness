/** Single model-facing entry for managed role operations. */
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { z } from 'zod';
import type {} from './delegation.ts';
import { reviewEvidence } from './review.ts';
import { brandString } from '@deepseek-ai/dsh-brand';
import type { CycleId } from './delegation-store.ts';
const request = z.discriminatedUnion('action', [
  z.object({ action: z.literal('initial'), role: z.literal('implementer'), prompt: z.string().trim().min(1), context: z.literal('fresh').optional() }).strict(),
  z.object({ action: z.literal('status') }).strict(),
  z.object({ action: z.literal('rework'), cycleId: z.string().uuid().transform(value => brandString<CycleId>(value)), prompt: z.string().trim().min(1) }).strict(),
  z.object({ action: z.literal('review'), cycleId: z.string().uuid().transform(value => brandString<CycleId>(value)), evidence: reviewEvidence }).strict(),
  z.object({ action: z.literal('complete'), cycleId: z.string().uuid().transform(value => brandString<CycleId>(value)) }).strict(),
]);
/** Required policy and tool registries. */
export const inject = ['tools', 'studioDelegation'];
/** Register the role tool inside the trusted preset.
 * @param ctx Preset-owned context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.tools.register(defineTool({
    name: 'studio_delegate',
    description: 'Coordinate Studio cycles in the shared workspace. initial requires role implementer and prompt and creates a fresh cycle. status accepts only action and reads durable facts without waking children. review requires an owned settled cycleId and evidence: requirements, summary, changedFiles, validations with command/result, failures, and unrun checks; it creates one fresh read/search-only reviewer using currently applied reviewer settings. Read the validated judgment and additionalVerification through status. Implementation completion or review pass does not complete the cycle. complete requires cycleId, a validated pass, and no pending additional verification. rework requires cycleId and prompt and wakes the existing implementer with its creation settings; every wake including verification-only uses one frozen cycle allowance (default two). After rework, review wakes the same reviewer with fresh evidence and a new judgment. Existing children never change context or settings. Cap exhaustion, active operations, or unknown acceptance stop the cycle: report the reason, do not retry blindly or create a replacement cycle. Model/effort/tool/identity/cap overrides are unsupported.',
    parameters: {
      action: { type: 'string', required: true, enum: ['initial', 'status', 'review', 'complete', 'rework'] },
      role: { type: 'string', enum: ['implementer'] },
      prompt: { type: 'string' },
      context: { type: 'string', enum: ['fresh'] },
      cycleId: { type: 'string' },
      evidence: { type: 'object', additionalProperties: false, properties: { requirements: { type: 'string', required: true }, summary: { type: 'string', required: true }, changedFiles: { type: 'array', required: true, items: { type: 'string' } }, validations: { type: 'array', required: true, items: { type: 'object', properties: { command: { type: 'string', required: true }, result: { type: 'string', required: true } }, additionalProperties: false } }, failures: { type: 'array', required: true, items: { type: 'string' } }, unrun: { type: 'array', required: true, items: { type: 'string' } } } },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec) {
      const parsed = request.parse(args);
      if (!exec.agent) throw new Error('studio-agent-required');
      if (parsed.action === 'status') return JSON.stringify(ctx.studioDelegation.describe(exec.agent.id));
      if (parsed.action === 'rework') return ctx.studioDelegation.rework(exec.agent, parsed.cycleId, parsed.prompt, exec.signal);
      if (parsed.action === 'review' || parsed.action === 'complete') {
        return ctx.studioDelegation.reviewCycle(exec.agent, parsed.cycleId, parsed.action === 'review' ? parsed.evidence : undefined, exec.signal);
      }
      return ctx.studioDelegation.initial(exec.agent, parsed.prompt, exec.signal);
    },
    presentCall: () => ({ card: 'generic', title: 'Studio delegation', kind: 'other' }),
  })));
}
