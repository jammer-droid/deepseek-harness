/**
 * Agent-control scenario harness (L0). A scenario drives real sessions through the Web RPC of an
 * isolated server started by server.mjs, then compares stored and applied evidence with expectations
 * written before the run:
 *
 *   import { runAgent, mockScript, mockSay } from './agent.mjs';
 *   await runAgent({ name: 'role-policy' }, async t => {
 *     const preset = await t.preset({ tools: ['read', 'write', 'subagent_role'], roles: [...] });
 *     const s = await t.session(preset);
 *     await t.prompt(s, mockScript([['subagent_role', { action: 'call', role: 'review', task: '…' }], mockSay('done')]));
 *     await t.settle(s, { children: 1 });
 *     const [child] = await t.children(s, { markers: ['PERSONA_X'] });
 *     t.expectChild('review child', child, { deny: ['write'], persona: 'PERSONA_X', rejected: ['write'] });
 *   });
 *
 * Start the server with `server.mjs up --mock-llm` for scripted, token-free runs; the session model is
 * then the DeepSeek provider pointed at the mock. Without --mock-llm the same scenario talks to the
 * real model and only facts that do not depend on the model's choices should be asserted at L0.
 * Prints one JSON summary; exit 1 on any failed check. Presets created here are deleted at the end.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { captureEvidence, checkChild, lastReply, mockSay, mockScript, mockTool, sessionEvidence } from './agent-lib.mjs';
import { fileURLToPath } from 'node:url';
import { serverState } from './browser.mjs';

export { mockSay, mockScript, mockTool };

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function readEvents(file) {
  const out = spawnSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 512 << 20 });
  if (out.status !== 0) return [];
  return out.stdout.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

class AgentTest {
  constructor(state, name) {
    this.state = state;
    this.handoffs = [];
    this.outDir = path.join(fileURLToPath(new URL('../..', import.meta.url)), 'dist/e2e/agent', name.replace(/[^\w.-]+/g, '-'));
    this.url = new URL(state.url);
    this.checks = [];
    this.presets = [];
    this.sessionRoot = path.join(state.home, 'sessions');
    this.policyRoot = path.join(state.home, 'profiles', state.profile, 'studio-data/child-policies');
  }

  async login() {
    const response = await fetch(this.url, { redirect: 'manual' });
    this.cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  }

  /** Raw Web RPC call. Throws with the method name on failure. */
  async rpc(method, args = {}) {
    const response = await fetch(new URL(`/api/${method}`, this.url), {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie: this.cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload: { args } }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json();
    if (!body.result?.ok) throw new Error(`${method}: ${body.result?.error?.message ?? response.status}`);
    return body.result.value;
  }

  /** Save and apply a temporary Studio preset; deleted when the run ends. */
  async preset({ name = '__agent_e2e__', tools, roles = [], prompt = '', model, deny }) {
    const catalog = await this.rpc('session/modelCatalog');
    const chosen = model ?? `${catalog.default.provider}/${catalog.default.model}`;
    const saved = await this.rpc('studioCatalog/savePreset', { payload: JSON.stringify({
      name, description: 'agent E2E (temporary)',
      request: { preset: 'studio-master', providers: [], tools, prompt, model: chosen, ...(deny ? { subagentToolFilter: { deny } } : {}) },
      agents: roles,
    }) });
    this.presets.push(saved.id);
    const applied = await this.rpc('studioCatalog/applyPreset', { id: saved.id });
    if (applied.status !== 'applied') throw new Error(`preset not applied: ${applied.status}`);
    return saved.id;
  }

  /** Create a session (optionally on a preset). Returns the session id. */
  async session(agentPreset, { cwd } = {}) {
    const { sessionId } = await this.rpc('session/create', { request: { ...(agentPreset ? { agentPreset } : {}), ...(cwd ? { cwd } : {}) } });
    return sessionId;
  }

  /** Queue one user message. With the mock model, the message is the script for this turn. */
  async prompt(sessionId, text) {
    const turnsBefore = this.evidence(sessionId)?.turnsEnded ?? 0;
    await this.rpc('session/prompt', { request: { sessionId, requestId: crypto.randomUUID(), mode: 'queue', content: [{ type: 'text', text }] } });
    return turnsBefore;
  }

  sessionFile(id) {
    if (!existsSync(this.sessionRoot)) return undefined;
    for (const project of readdirSync(this.sessionRoot)) {
      const file = path.join(this.sessionRoot, project, id, 'session.v4.jsonl.zstd');
      if (existsSync(file)) return file;
    }
    return undefined;
  }

  evidence(id, markers = []) {
    const file = this.sessionFile(id);
    return file ? sessionEvidence(readEvents(file), markers) : undefined;
  }

  childIds(parentId) {
    if (!existsSync(this.sessionRoot)) return [];
    return readdirSync(this.sessionRoot).flatMap(project => readdirSync(path.join(this.sessionRoot, project)))
      .filter(id => id !== parentId && this.evidence(id)?.parent === parentId);
  }

  /**
   * Wait (inside the script) until the session has ended `turns` more turns than before the last
   * prompt and each of `children` children has ended a turn. Returns false on timeout.
   */
  async settle(sessionId, { turns = 1, after = 0, children = 0, timeoutMs = 120_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const parent = this.evidence(sessionId);
      const kids = this.childIds(sessionId).map(id => this.evidence(id));
      if (parent && parent.turnsEnded >= after + turns && kids.length >= children && kids.every(kid => kid.turnsEnded >= 1)) return true;
      await sleep(1000);
    }
    this.checks.push({ name: `settle ${sessionId}`, ok: false, error: `not settled within ${timeoutMs} ms` });
    return false;
  }

  /** Mock captures (empty without --mock-llm). */
  captures() {
    const file = this.state.mock?.capture;
    if (!file || !existsSync(file)) return [];
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
  }

  /** Each child of a session with its stored policy, log evidence and (mock) capture evidence. */
  async children(sessionId, { markers = [] } = {}) {
    const records = this.captures();
    return this.childIds(sessionId).map(id => {
      const file = path.join(this.policyRoot, `${id}.json`);
      const evidence = this.evidence(id, markers);
      return {
        id,
        policy: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined,
        evidence,
        capture: records.length ? captureEvidence(records, id, markers) : undefined,
      };
    });
  }

  /** Last assistant text of a session, for L1 judgment only (never asserted at L0). */
  reply(id) {
    const file = this.sessionFile(id);
    return file ? lastReply(readEvents(file)) : '';
  }

  /** Queue one L1 item ({id, input}); written to l1-items.jsonl and listed in the summary. */
  handoff(id, input) {
    this.handoffs.push({ id, input: String(input).slice(0, 32_000) });
  }

  /** Record a named fact. fn may throw or return false. */
  async check(name, fn) {
    try {
      const result = await fn();
      this.checks.push(result === false ? { name, ok: false, error: 'false' } : { name, ok: true });
    } catch (error) {
      this.checks.push({ name, ok: false, error: String(error?.message ?? error).split('\n')[0].slice(0, 300) });
    }
  }

  /** Compare one child with its expectation (see agent-lib checkChild). */
  expectChild(name, child, expect) {
    if (!child) { this.checks.push({ name, ok: false, error: 'child not found' }); return; }
    const failures = checkChild(child, expect);
    this.checks.push(failures.length ? { name, ok: false, error: failures.join('; '), child: child.id } : { name, ok: true, child: child.id });
  }

  async cleanup() {
    for (const id of this.presets) await this.rpc('studioCatalog/deletePreset', { id }).catch(() => {});
  }
}

/**
 * Run an agent-control scenario against the isolated server and print one summary.
 * @param {{ name: string, profile?: string }} options
 * @param {(t: AgentTest) => Promise<void>} scenario
 */
export async function runAgent(options, scenario) {
  const state = serverState({ profile: options.profile });
  const test = new AgentTest(state, options.name);
  await test.login();
  try { await scenario(test); } catch (error) {
    test.checks.push({ name: 'scenario', ok: false, error: String(error?.message ?? error).split('\n')[0].slice(0, 300) });
  } finally { await test.cleanup(); }
  const failed = test.checks.filter(check => !check.ok);
  mkdirSync(test.outDir, { recursive: true });
  const itemsPath = path.join(test.outDir, 'l1-items.jsonl');
  rmSync(itemsPath, { force: true });
  if (test.handoffs.length) writeFileSync(itemsPath, test.handoffs.map(item => JSON.stringify(item)).join('\n') + '\n');
  const summary = {
    name: options.name, level: 'L0', model: state.mock ? 'mock' : 'live',
    ok: failed.length === 0, passed: test.checks.length - failed.length, failed: failed.length,
    failures: failed,
    ...(test.handoffs.length ? { l1: { items: path.relative(path.resolve(test.outDir, '../../../..'), itemsPath), count: test.handoffs.length } } : {}),
    checks: test.checks.map(({ name, ok, child }) => ({ name, ok, ...(child ? { child } : {}) })),
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
  return summary;
}
