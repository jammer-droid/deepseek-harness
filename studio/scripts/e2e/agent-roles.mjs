#!/usr/bin/env node
/**
 * L0 agent-control scenario: Studio role children on the scripted mock model.
 * Start the server with `server.mjs up --mock-llm`, then:  node studio/scripts/e2e/agent-roles.mjs
 *
 * Expectations are fixed before the run (the table below), never derived from the output:
 * - Fresh/Fork × default/extend/replace Tool Filter give the stored deny list and hide those tools
 *   from the child's model request.
 * - Each child's persona marker reaches its own system prompt.
 * - A child that calls a denied tool anyway is rejected at execution; an allowed tool still runs.
 * - Only Fork children see a marker from the parent's completed earlier turn.
 * - The parent keeps its own tools after delegating.
 */
import { mockSay, mockScript, runAgent } from './agent.mjs';

const TOOLS = ['read', 'write', 'bash', 'subagent_role'];
const PRESET_DENY = ['bash'];
const HISTORY = 'HISTORY_MARK_51';
const ROLES = [
  { name: 'Fresh default', role: 'fresh-default', spawn: 'fresh', persona: 'PERSONA_FD_1', filter: undefined, deny: ['bash'] },
  { name: 'Fork extend', role: 'fork-extend', spawn: 'fork', persona: 'PERSONA_KE_2', filter: { mode: 'extend', deny: ['write'] }, deny: ['bash', 'write'] },
  { name: 'Fresh replace', role: 'fresh-replace', spawn: 'fresh', persona: 'PERSONA_FR_3', filter: { mode: 'replace', deny: ['write'] }, deny: ['write'] },
];
// The child tries one denied tool and one allowed tool, then ends.
const probe = denied => mockScript([[denied, denied === 'bash' ? { command: 'true' } : { file_path: 'agent-e2e-probe.txt', content: 'x' }], ['read', { file_path: 'README.md', limit: 1 }], mockSay('child-done')]);

await runAgent({ name: 'agent-roles' }, async t => {
  const preset = await t.preset({
    tools: TOOLS, deny: PRESET_DENY,
    roles: ROLES.map(({ name, role, spawn, persona, filter }) => ({ name, role, model: 'inherit', reasoning: 'inherit', spawn, persona, ...(filter ? { toolFilter: filter } : {}) })),
  });
  const session = await t.session(preset);

  // Turn 1 leaves a marker in completed history; only Fork children should inherit it.
  let after = await t.prompt(session, `${HISTORY}\n${mockSay('noted')}`);
  if (!(await t.settle(session, { after }))) return;

  // Turn 2 delegates to every role; each child task is its own mock script.
  const calls = ROLES.map(role => ['subagent_role', { action: 'call', role: role.role, task: probe(role.deny[role.deny.length - 1]) }]);
  after = await t.prompt(session, mockScript([...calls, mockSay('parent-done')]));
  if (!(await t.settle(session, { after, children: ROLES.length }))) return;

  const markers = [HISTORY, ...ROLES.map(role => role.persona)];
  const children = await t.children(session, { markers });
  await t.check('one child per role', () => children.length === ROLES.length || Promise.reject(new Error(`${children.length} children`)));
  for (const role of ROLES) {
    const child = children.find(item => item.policy?.persona === role.persona);
    t.expectChild(`${role.name}: policy, tools, persona, rejection`, child, {
      deny: role.deny,
      tools: TOOLS.filter(name => !role.deny.includes(name)),
      persona: role.persona,
      rejected: [role.deny[role.deny.length - 1]],
      executed: ['read'],
      ...(role.spawn === 'fork' ? { inheritsMarker: HISTORY } : { notInheritsMarker: HISTORY }),
    });
  }
  const parent = t.evidence(session);
  await t.check('parent keeps its tools', () => {
    const offered = t.captures().filter(record => record.session === session && record.tools.length).at(-1)?.tools ?? parent?.tools;
    if (JSON.stringify(offered) !== JSON.stringify([...TOOLS].sort())) throw new Error(`parent tools ${JSON.stringify(offered)}`);
  });
});
