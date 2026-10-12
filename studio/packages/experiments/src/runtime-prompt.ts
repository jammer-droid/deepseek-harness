/** Native prompt changes, independent from Goal/Todo execution policy. */
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt';

export const GOAL_TOOLS = new Set(['create_goal', 'get_goal', 'update_goal', 'todo_write']);
export const SHARED_RULES = `Put independent tool calls in the same response. Sequence calls only when a later call requires an earlier result or their effects may conflict. Do not guess unknown arguments or validate changes before they have completed.

Choose foreground or background execution based on dependencies. If the next useful action depends on a command's result, prefer the configured foreground wait in the initial call. Do not specify a short wait merely to regain control and immediately retrieve the same job. Use background execution when there is concrete independent work to perform, or the command is intentionally long-lived.

Work toward the requested deliverables and acceptance criteria. Use the smallest set of checks providing adequate evidence of correctness. Add checks for an uncovered requirement, an observed failure, or a material risk, not merely because another check is possible. Once the requested work is complete and relevant checks pass, summarize the evidence and remaining limitations, then stop. Never conceal failures or omit required verification.`;
export const JOB_RULES = `Track every background job id you start. You are notified in-session when a job finishes. Do not busy-poll or sleep on one; keep working on concrete independent steps and do not duplicate a running job's work. If its result is required and no independent work remains, use job_output with wait: true rather than repeated non-blocking checks. Retrieve the relevant result before relying on success. Before giving a final answer, collect every still-relevant job and job_kill jobs that stopped mattering.`;

/** Add selected optimization context and native descriptions; preserve other contributions and variables. */
export function applyPrompt(assembly: PromptAssembly, flags: { goals: boolean; headless: boolean; waiting: boolean }): PromptAssembly {
  if ((flags.headless || flags.waiting) && assembly.sections.some(section => section.name === 'tools:sdk')) throw new Error('Studio prompt optimization/waiting experiments require native tool presentation');
  const sections = assembly.sections.filter(section => !(flags.goals && section.name === 'tool:goal') && section.name !== 'studio:headless-policy')
    .map(section => (flags.headless || flags.waiting) && section.name === 'tool:jobs' ? { ...section, text: JOB_RULES } : section);
  // Runtime context survives complete prompt replacement, but not explicit context suppression on Desktop rc.2.
  const contexts = flags.headless
    ? [...assembly.contexts.filter(context => context.name !== 'studio:prompt-optimization'), { name: 'studio:prompt-optimization', text: `${SHARED_RULES}\n\n${JOB_RULES}` }]
    : assembly.contexts;
  const tools = assembly.tools.filter(tool => !flags.goals || !GOAL_TOOLS.has(tool.name)).map(original => {
    if (!flags.headless && !flags.waiting) return original;
    const tool = structuredClone(original);
    const properties = tool.parameters.properties;
    function description(name: string, text: string): void {
      if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new Error(`Missing ${tool.name} parameter properties`);
      const parameter = (properties as Record<string, unknown>)[name];
      if (!parameter || typeof parameter !== 'object' || Array.isArray(parameter)) throw new Error(`Missing ${tool.name}.${name} schema`);
      Object.assign(parameter, { description: text });
    }
    if (tool.name === 'bash') {
      tool.description += ' Choose foreground waiting when the result is needed next; use background execution for concrete independent work or intentionally long-lived commands.';
      description('timeoutMs', 'Foreground wait in milliseconds before a still-running command becomes a background job; this does not kill the command. Omit to use the executor configured default and cap. Prefer the default or a sufficient wait when the result is needed next, rather than a short wait followed immediately by job_output.');
      description('run_in_background', 'Run in the background immediately, returning a job id. Use for concrete independent work or intentionally long-lived commands; collect with job_output and stop with job_kill. No foreground timeout applies.');
    }
    if (tool.name === 'job_output') {
      tool.description += ' If the result is required and no independent work remains, wait for completion instead of repeated non-blocking checks.';
      description('wait', 'Block until completion or the configured wait expires; timeout leaves the job running. Use true when blocked on this result with no independent work remaining. Defaults to false.');
    }
    return tool;
  });
  return { ...assembly, sections, contexts, tools };
}
