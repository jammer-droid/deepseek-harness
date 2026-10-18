#!/usr/bin/env node
/**
 * L0 agent-control scenario (#34): the built-in Optimized preset and its default Worker role on the
 * scripted mock model. Start the server with `server.mjs up --mock-llm`, then:
 *   node studio/scripts/e2e/agent-optimized-worker.mjs
 *
 * Expectations are fixed before the run from the #34 spec, never derived from the output:
 * - Optimized is applied with its tuned values (tools, studio-batch Config, bash 120000 ms, read
 *   and bash descriptions, tool:read section, common instructions) and one Worker role.
 * - The main agent is offered the orchestration tools; the Worker child is not, and a call to one
 *   of them is rejected while an allowed tool runs.
 * - The Worker child receives the same common instructions and tool:read section as the parent,
 *   plus its persona; the workflow and goal usage sections are absent from the child.
 * - Restoring defaults after an edit brings the template back.
 * The built-in preset is restored to defaults at the end, so the isolated profile is left as found.
 */
import { mockSay, mockScript, runAgent } from './agent.mjs';

const ID = 'studio-optimized';
const WORKER_HIDDEN = ['send_message', 'interrupt_agent', 'list_agents', 'workflow', 'ask_user_question', 'exit_plan_mode', 'present', 'judge', 'pixie_loop', 'cordis_inspect_list', 'cordis_inspect_query'];
const MAIN_ONLY = ['subagent_role', 'judge', 'pixie_loop', 'ask_user_question'];
const PROMPT_FIRST = 'Read whole files in one call; use offset/limit only past the read cap.';
const PROMPT_EDIT = 'Apply all changes to one file in one edit_batch.';
const READ_SECTION = 'One read returns up to 2000 lines; omit limit unless a file is larger.';
const PERSONA = 'No user is available to answer questions; do not ask for confirmation.';
const OLD_READ_SECTION = 'Use offset and limit to continue reading large files.';

await runAgent({ name: 'agent-optimized-worker' }, async t => {
  const presets = await t.rpc('studioCatalog/listPresets');
  let optimized = presets.find(item => item.id === ID);
  await t.check('Optimized exists, is built-in and non-deletable', () => {
    if (!optimized?.template || !optimized.nonDeletable) throw new Error(JSON.stringify(optimized && { template: optimized.template, nonDeletable: optimized.nonDeletable }));
  });
  if (!optimized) return;
  if (optimized.customized || optimized.status !== 'applied') optimized = await t.rpc('studioCatalog/restoreOptimized');
  const { request, agents } = optimized;

  // Selection order follows the Master catalog, so only membership is checked.
  await t.check('tools include edit_batch and the main-only tools', () => {
    const missing = [...MAIN_ONLY, 'edit', 'edit_batch', 'read_batch', 'cordis_inspect_list', 'cordis_inspect_query'].filter(name => !request.tools.includes(name));
    if (missing.length) throw new Error(`missing ${missing}`);
  });
  await t.check('studio-batch Config: maxLines null, noSpill true', () => {
    const value = request.configOverrides?.['studio-batch'];
    if (!value || value.maxLines !== null || value.noSpill !== true) throw new Error(JSON.stringify(value));
  });
  await t.check('one Worker role: inherit, fresh, replace filter of the 11 tools', () => {
    const [worker, ...rest] = agents;
    if (rest.length || worker?.name !== 'Worker' || worker.model !== 'inherit' || worker.reasoning !== 'inherit' || worker.spawn !== 'fresh') throw new Error(JSON.stringify(agents));
    if (worker.toolFilter?.mode !== 'replace' || [...worker.toolFilter.deny].sort().join() !== [...WORKER_HIDDEN].sort().join()) throw new Error(JSON.stringify(worker.toolFilter));
    if (!worker.persona.startsWith(PERSONA)) throw new Error('persona');
  });

  const preview = await t.rpc('studioCatalog/preview', { request });
  const tool = name => preview.tools.find(item => item.name === name);
  await t.check('bash timeoutMs default 120000 with the tuned description', () => {
    const field = tool('bash')?.parameters?.properties?.timeoutMs;
    if (field?.default !== 120000 || !String(field.description).startsWith('Foreground wait in milliseconds; defaults to 120000ms')) throw new Error(JSON.stringify(field));
  });
  await t.check('job_output timeout_ms default 120000', () => {
    if (tool('job_output')?.parameters?.properties?.timeout_ms?.default !== 120000) throw new Error('job_output default');
  });
  await t.check('read limit/offset descriptions', () => {
    const props = tool('read')?.parameters?.properties;
    if (!String(props?.limit?.description).startsWith('Maximum lines to return. Omit to read the whole file') || !String(props?.offset?.description).startsWith('1-based first line. Use only to continue')) throw new Error(JSON.stringify(props));
  });
  await t.check('preview prompt has the common instructions and the tuned tool:read section', () => {
    for (const text of [PROMPT_FIRST, PROMPT_EDIT, READ_SECTION]) if (!preview.prompt.includes(text)) throw new Error(`missing: ${text}`);
    if (preview.prompt.includes(OLD_READ_SECTION)) throw new Error('old tool:read sentence still present');
  });

  // Main agent delegates once to the Worker; the Worker tries a hidden tool and an allowed one.
  const session = await t.session(ID);
  const child = mockScript([['judge', { state: 'x', questions: { q: { type: 'noul', instructions: 'yes?' } } }], ['read', { file_path: 'README.md', limit: 1 }], mockSay('worker-done')]);
  const after = await t.prompt(session, mockScript([['subagent_role', { action: 'call', role: 'worker', task: child }], mockSay('main-done')]));
  if (!(await t.settle(session, { after, children: 1 }))) return;

  const markers = [PROMPT_FIRST, READ_SECTION, agents[0].persona, OLD_READ_SECTION];
  const [worker] = await t.children(session, { markers });
  const main = t.captures().filter(record => record.session === session && record.purpose === 'turn' && record.tools.length)[0];
  await t.check('main agent is offered the orchestration tools', () => {
    const missing = MAIN_ONLY.filter(name => !main?.tools.includes(name));
    if (missing.length) throw new Error(`missing ${missing}`);
  });
  await t.check('main system prompt: common instructions and tool:read, no persona or goal guidance', () => {
    if (!main?.system.includes(PROMPT_FIRST) || !main.system.includes(READ_SECTION)) throw new Error('missing parent text');
    if (main.system.includes('create_goal may infer goal intent')) throw new Error('goal guidance without goal tools');
    if (main.system.includes(PERSONA)) throw new Error('Worker persona leaked into the main agent');
  });
  t.expectChild('Worker: filter, tools, persona, rejection', worker, {
    deny: WORKER_HIDDEN.filter(name => request.tools.includes(name)),
    persona: agents[0].persona,
    rejected: ['judge'],
    executed: ['read'],
  });
  await t.check('Worker inherits common instructions and tool:read section', () => {
    const reached = worker?.capture?.systemMarkers ?? {};
    if (reached[PROMPT_FIRST] !== true || reached[READ_SECTION] !== true) throw new Error(JSON.stringify(reached));
    if (reached[OLD_READ_SECTION] !== false) throw new Error('old tool:read sentence reached the Worker');
  });
  await t.check('Worker has no workflow or goal usage section', () => {
    const record = t.captures().find(item => item.session === worker?.id && item.purpose === 'turn' && item.tools.length);
    if (!record) throw new Error('no Worker capture');
    for (const name of ['workflow', 'create_goal', 'get_goal', 'update_goal']) if (record.tools.includes(name)) throw new Error(`${name} offered`);
    // First words of the DSH tool:workflow and tool:goal sections.
    for (const text of ['Use the workflow tool ONLY when', 'create_goal may infer goal intent']) if (record.system.includes(text)) throw new Error(`present: ${text}`);
  });

  // Edit, then restore: the template comes back and applies.
  const edited = await t.rpc('studioCatalog/savePreset', { payload: JSON.stringify({ ...optimized, request: { ...request, prompt: 'E2E_EDITED_PROMPT' } }) });
  await t.check('saving an edited Optimized marks it customized', () => { if (edited.id !== ID || edited.customized !== true) throw new Error(JSON.stringify({ id: edited.id, customized: edited.customized })); });
  const restored = await t.rpc('studioCatalog/restoreOptimized');
  await t.check('restore brings back the template and applies it', () => {
    if (restored.customized || restored.status !== 'applied' || restored.request.prompt !== request.prompt) throw new Error(JSON.stringify({ customized: restored.customized, status: restored.status }));
  });
  await t.check('Optimized cannot be deleted', async () => {
    try { await t.rpc('studioCatalog/deletePreset', { id: ID }); } catch (error) { if (/non-deletable/.test(String(error))) return; throw error; }
    throw new Error('deleted');
  });
});
