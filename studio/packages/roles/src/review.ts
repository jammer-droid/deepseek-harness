/** Per-activation reviewer evidence and validated structured judgments. */
import { z } from 'zod';
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools';
/** Input supplied explicitly in the fresh reviewer's logged user message. */
export const reviewEvidence = z.object({ requirements: z.string().trim().min(1), summary: z.string().trim().min(1), changedFiles: z.array(z.string()), validations: z.array(z.object({ command: z.string(), result: z.string() }).strict()), failures: z.array(z.string()), unrun: z.array(z.string()) }).strict();
/** A judgment cannot stand in for an execution failure or missing capture. */
export const reviewJudgment = z.object({ judgment: z.enum(['pass', 'needs-changes', 'unable-to-judge']), explanation: z.string().trim().min(1), evidence: z.array(z.string().trim().min(1)).min(1), additionalVerification: z.array(z.string().trim().min(1)) }).strict();
/** Evidence accepted at the model tool JSON parser. */
export type ReviewEvidence = z.infer<typeof reviewEvidence>;
/** Native subagent capture schema; local validation also requires nonempty explanations. */
export const reviewOutputSchema: ObjectJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: { judgment: { type: 'string', enum: ['pass', 'needs-changes', 'unable-to-judge'] }, explanation: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } }, additionalVerification: { type: 'array', items: { type: 'string' } } },
  required: ['judgment', 'explanation', 'evidence', 'additionalVerification'],
};
