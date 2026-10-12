/** Creation-time experiment policies; every contribution belongs to both plugin and agent. */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-goal';
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent';
import { JobId } from '@deepseek-ai/dsh-jobs';
import { z } from 'zod';
import { targetsAgent, type ExperimentSettings } from './settings.ts';
import { createLifetime } from './runtime-lifetime.ts';
import { GOAL_TOOLS, applyPrompt } from './runtime-prompt.ts';
import { installOffload } from './runtime-offload.ts';
import { installBatch } from './runtime-batch.ts';
import { installTasks } from './runtime-tasks.ts';

/** Install immutable per-agent snapshots; later saves affect only newly created agents.
 * @param ctx Plugin owner.
 * @param capture Read the current validated settings.
 */
export function installPolicies(ctx: Context, capture: () => ExperimentSettings): void {
  ctx.on('agent/created', ({ agent }) => {
    const settings = structuredClone(capture());
    const sub = delegationDepthOf(agent) > 0;
    const flags = {
      offload: targetsAgent(settings.targets.offload, sub), goals: targetsAgent(settings.targets.goals, sub),
      headless: targetsAgent(settings.targets.headless, sub), batch: targetsAgent(settings.targets.batch, sub),
      tasks: targetsAgent(settings.targets.tasks, sub), waiting: targetsAgent(settings.targets.waiting, sub),
    };
    if (!Object.values(flags).some(Boolean)) return;
    const scoped = agent.ctx;
    const tools = scoped.get('tools');
    const goals = scoped.get('goals');
    const jobs = scoped.get('jobs');
    if (!tools) throw new Error('Studio experiments require tools');
    if (tools.get('test_batch_read', agent)) throw new Error('Studio experiments conflict with an existing test_batch_read policy. Disable @local/dsh-test-plugin in this preset before starting a new agent.');
    if (flags.goals && !goals) throw new Error('Studio Goal/Todo suppression requires goals');
    if ((flags.headless || flags.waiting || flags.goals) && !scoped.get('systemPrompt')) throw new Error('Studio prompt policies require systemPrompt');
    if ((flags.tasks || flags.waiting) && !jobs) throw new Error('Studio tasks/waiting require jobs');
    for (const name of flags.tasks || flags.waiting ? ['bash', 'job_output', 'job_kill'] : []) if (!tools.get(name, agent)) throw new Error(`Studio tasks/waiting require ${name}`);
    const life = createLifetime();
    const dispose = scoped.effect(function* () {
      // The generator closes notifications and tools before aborting owned work.
      yield () => life.dispose();
      if (flags.headless || flags.waiting) yield tools.presentAs('native');
      if (flags.goals) {
        goals!.disarm(agent);
        yield scoped.on('goal/changed', () => { goals!.disarm(agent); }, { prepend: true });
        yield scoped.on('agent/pre-step', async (_payload, next) => { goals!.disarm(agent); return next(); }, { prepend: true });
        yield tools.guard(exec => GOAL_TOOLS.has(exec.name) ? 'Goal/Todo tools are disabled for this agent by Studio experiments.' : undefined);
        const denied = [...GOAL_TOOLS].filter(name => tools.get(name, agent) !== undefined);
        if (denied.length) yield tools.restrict({ deny: denied });
      }
      if (flags.headless || flags.waiting || flags.goals) yield scoped.on('system-prompt/assemble', async (_assembly, _context, next) => applyPrompt(await next(), flags), { prepend: true });
      if (flags.offload) yield installOffload(scoped, life, settings.inlineChars, settings.previewChars);
      if (flags.batch) yield installBatch(scoped, life, flags.goals, settings.batchMaxCalls, settings.readMaxLines);
      if (flags.tasks) yield installTasks(scoped, life, settings.taskWaitMs, settings.bashWaitMs);
      if (flags.waiting) {
        const bash = tools.get('bash', agent)!;
        const output = tools.get('job_output', agent)!;
        yield tools.register({ ...bash, async execute(raw, exec) {
          const args = z.record(z.string(), z.unknown()).parse(raw);
          return life.run(signal => bash.execute({ ...args, ...(args.run_in_background === true ? {} : { timeoutMs: typeof args.timeoutMs === 'number' ? Math.min(args.timeoutMs, settings.bashWaitMs) : settings.bashWaitMs }) }, { ...exec, signal: AbortSignal.any([signal, exec.signal]) }));
        } });
        yield tools.register({ ...output, async execute(raw, exec) {
          const args = z.object({ job_id: z.string(), wait: z.boolean().optional(), timeout_ms: z.number().positive().optional() }).parse(raw);
          return life.run(async ownedSignal => {
            const signal = AbortSignal.any([ownedSignal, exec.signal]);
            if (args.wait === true) await jobs!.wait(JobId(args.job_id), Math.min(args.timeout_ms ?? settings.jobWaitMs, settings.jobWaitCapMs), exec.agent?.id, signal);
            return output.execute({ ...args, wait: false }, { ...exec, signal });
          });
        } });
      }
    });
    ctx.effect(() => dispose);
  });
}
