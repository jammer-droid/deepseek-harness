/** Validated profile settings captured independently at each agent start. */
import { z } from 'zod';

const target = z.enum(['off', 'main', 'sub', 'both']);
/** Agent populations eligible for one experiment. */
export type ExperimentTarget = z.infer<typeof target>;
/** Wire and durable validation; invalid writes do not replace the active settings. */
export const settingsSchema = z.object({
  targets: z.object({ offload: target, goals: target, headless: target, batch: target, tasks: target, waiting: target }).strict(),
  inlineChars: z.number().int().min(1024).max(Number.MAX_SAFE_INTEGER),
  previewChars: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  batchMaxCalls: z.number().int().min(1).max(8),
  readMaxLines: z.number().int().min(1).max(200),
  taskWaitMs: z.number().int().min(1).max(600000),
  bashWaitMs: z.number().int().min(1).max(600000),
  jobWaitMs: z.number().int().min(1).max(600000),
  jobWaitCapMs: z.number().int().min(1).max(600000),
}).strict().refine(value => value.previewChars <= value.inlineChars / 2, { path: ['previewChars'], message: 'preview exceeds half the inline budget' }).refine(value => value.jobWaitMs <= value.jobWaitCapMs, { path: ['jobWaitMs'], message: 'wait exceeds cap' });
/** Applied settings; existing agents retain their creation-time copy. */
export type ExperimentSettings = z.infer<typeof settingsSchema>;
/** Opt-in defaults retain the original experimental plugin's numeric budgets. */
export const initialSettings: ExperimentSettings = {
  targets: { offload: 'off', goals: 'off', headless: 'off', batch: 'off', tasks: 'off', waiting: 'off' },
  inlineChars: 8192, previewChars: 1024, batchMaxCalls: 8, readMaxLines: 200,
  taskWaitMs: 120000, bashWaitMs: 600000, jobWaitMs: 120000, jobWaitCapMs: 600000,
};
/** @param target Selected population. @param sub Whether the agent is delegated. @returns Whether to install the feature. */
export function targetsAgent(target: ExperimentTarget, sub: boolean): boolean {
  return target === 'both' || target === (sub ? 'sub' : 'main');
}
