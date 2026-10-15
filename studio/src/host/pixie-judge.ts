import type { JudgeAnswer, JudgeQuestion, JudgeRequest, JudgeResult, PixieModel } from '../pixie-contracts.ts';
import type { PixieLlm } from './pixie-runtime.ts';

/** A System One decision component: state plus typed questions in, typed answers out (Jev contract). */
export interface JudgeEngine {
  readonly kind: 'judge';
  judge(request: JudgeRequest, signal: AbortSignal): Promise<JudgeResult>;
}

const TOLERANCE = 0.02;

/** Reject requests that a Jev endpoint would reject, so the LLM and Jev engines accept the same inputs.
 * @returns the request, typed.
 */
export function validateJudgeRequest(value: unknown): JudgeRequest {
  if (!value || typeof value !== 'object') throw new Error('Judge request must be an object');
  const { state, questions } = value as { state?: unknown; questions?: unknown };
  if (state === undefined) throw new Error('Judge request needs a state');
  if (!questions || typeof questions !== 'object' || Array.isArray(questions)) throw new Error('Judge request needs questions by id');
  const entries = Object.entries(questions as Record<string, unknown>);
  if (entries.length === 0) throw new Error('Judge request needs at least one question');
  for (const [id, raw] of entries) {
    const question = raw as Partial<JudgeQuestion> & Record<string, unknown>;
    if (question?.type === 'choice') {
      const options = question.options as Record<string, unknown> | undefined;
      if (!options || Object.keys(options).length < 2 || Object.values(options).some(item => typeof item !== 'string')) throw new Error(`Choice "${id}" needs at least two options with descriptions`);
    } else if (question?.type === 'score') {
      const levels = question.levels as unknown;
      if (!Array.isArray(levels) || levels.length < 2 || levels.length > 10 || levels.some(item => typeof item !== 'string')) throw new Error(`Score "${id}" needs 2–10 levels`);
    } else if (question?.type === 'noul') {
      if (typeof question.question !== 'string' || !question.question.trim()) throw new Error(`Noul "${id}" needs a question`);
    } else throw new Error(`Question "${id}" must be choice, score, or noul`);
  }
  return { state, questions: questions as Record<string, JudgeQuestion> };
}

const isProbability = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const sumsToOne = (values: number[]) => Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= TOLERANCE;

/** Validate one answer against its question; confidence is the top probability (a distribution property, not a correctness guarantee). */
function checkAnswer(id: string, question: JudgeQuestion, raw: unknown): JudgeAnswer {
  const answer = raw as Record<string, unknown> | undefined;
  if (!answer || typeof answer !== 'object') throw new Error(`Missing answer for "${id}"`);
  if (question.type === 'choice') {
    const names = Object.keys(question.options);
    const probabilities = answer.probabilities as Record<string, unknown> | undefined;
    if (typeof answer.choice !== 'string' || !names.includes(answer.choice)) throw new Error(`Answer "${id}" chose an unknown option`);
    if (!probabilities || names.some(name => !isProbability(probabilities[name])) || Object.keys(probabilities).some(name => !names.includes(name))) throw new Error(`Answer "${id}" needs a probability per option`);
    const values = names.map(name => probabilities[name] as number);
    if (!sumsToOne(values)) throw new Error(`Answer "${id}" probabilities must sum to 1`);
    return { type: 'choice', choice: answer.choice, probabilities: Object.fromEntries(names.map(name => [name, probabilities[name] as number])), confidence: Math.max(...values) };
  }
  if (question.type === 'score') {
    const probabilities = answer.probabilities as unknown;
    const top = question.levels.length - 1;
    if (typeof answer.score !== 'number' || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > top) throw new Error(`Answer "${id}" score must be within 0..${top}`);
    if (!Array.isArray(probabilities) || probabilities.length !== question.levels.length || !probabilities.every(isProbability) || !sumsToOne(probabilities)) throw new Error(`Answer "${id}" needs one probability per level summing to 1`);
    return { type: 'score', score: answer.score, probabilities, confidence: Math.max(...probabilities) };
  }
  if (!isProbability(answer.noul)) throw new Error(`Answer "${id}" noul must be a probability in 0..1`);
  return { type: 'noul', noul: answer.noul };
}

/** Parse model output strictly: one JSON object, optionally fenced, with an answer for every question. */
export function parseJudgeOutput(text: string, questions: Record<string, JudgeQuestion>): Record<string, JudgeAnswer> {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text.trim());
  let parsed: unknown;
  try { parsed = JSON.parse(fenced ? fenced[1]! : text.trim()); } catch { throw new Error('Judge model did not return JSON'); }
  const answers = (parsed as { answers?: unknown } | undefined)?.answers as Record<string, unknown> | undefined;
  if (!answers || typeof answers !== 'object') throw new Error('Judge model output has no answers object');
  return Object.fromEntries(Object.entries(questions).map(([id, question]) => [id, checkAnswer(id, question, answers[id])]));
}

const SYSTEM = [
  'You are a judgment component. Evaluate the given state against each question independently.',
  'Reply with exactly one JSON object and nothing else: {"answers": {<question id>: <answer>}}.',
  'choice answer: {"choice": <option name>, "probabilities": {<every option name>: number}} — probabilities sum to 1.',
  'score answer: {"score": number from 0 to levels-1 (fractional allowed), "probabilities": [one number per level, in order]} — probabilities sum to 1.',
  'noul answer: {"noul": probability from 0 to 1 that the answer is yes}.',
].join('\n');

/** Judge with a conversation model, held to the same output contract a Jev engine returns. */
export class LlmJudgeEngine implements JudgeEngine {
  readonly kind = 'judge' as const;
  constructor(private readonly llm: PixieLlm, private readonly model: PixieModel) {}

  async judge(request: JudgeRequest, signal: AbortSignal): Promise<JudgeResult> {
    try {
      const { state, questions } = validateJudgeRequest(request);
      const prompt = `State:\n${typeof state === 'string' ? state : JSON.stringify(state, null, 2)}\n\nQuestions:\n${JSON.stringify(questions, null, 2)}`;
      let text = '';
      let finished = false;
      for await (const chunk of this.llm.stream({
        provider: this.model.provider, model: this.model.model,
        ...(this.model.reasoningEffort ? { reasoningEffort: this.model.reasoningEffort } : {}),
        ...(this.model.maxTokens ? { maxTokens: this.model.maxTokens } : {}),
        system: SYSTEM, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }], signal,
      })) {
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text;
        if (chunk.type === 'finish') {
          const reason = chunk.reason as { kind?: string; failure?: { message?: string } } | undefined;
          if (reason?.kind !== 'stop') throw new Error(reason?.failure?.message ?? `Judge model ended with ${reason?.kind ?? 'unknown'}`);
          finished = true;
        }
      }
      signal.throwIfAborted();
      if (!finished) throw new Error('Judge model stream ended without a finish');
      return { ok: true, answers: parseJudgeOutput(text, questions) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
