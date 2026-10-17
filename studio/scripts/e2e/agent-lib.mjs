/** Pure helpers for agent-control scenarios (agent.mjs). No network, process, or file side effects. */

/** Script lines for the mock model: one tool call. */
export const mockTool = (name, input = {}) => `MOCK tool ${name} ${JSON.stringify(input)}`;
/** Script line for the mock model: end the turn with text. */
export const mockSay = text => `MOCK say ${String(text).replace(/\n/g, ' ')}`;
/** A whole prompt from script lines (strings or [name, input] pairs). */
export const mockScript = lines => lines.map(line => (Array.isArray(line) ? mockTool(...line) : line)).join('\n');

/**
 * One session's evidence from its decompressed session.v4.jsonl events. Applied evidence comes from the
 * session's own request headers; for a Fork child the inherited prefix is skipped by `inheritedEventCount`
 * when present, otherwise by taking the request headers after the child's first user/message.
 * Message texts are not kept; only marker hits are reported.
 */
export function sessionEvidence(events, markers = []) {
  const header = events.find(event => event.type === 'session') ?? {};
  const inherited = Number(header.inheritedEventCount ?? header.fork?.inheritedEventCount ?? 0);
  const own = inherited > 0 ? events.slice(inherited) : events;
  const firstUser = own.findIndex(event => event.type === 'user/message');
  const requests = own.slice(Math.max(0, firstUser)).filter(event => event.type === 'request/header').map(event => event.data?.header ?? {});
  const systemText = own.filter(event => event.type === 'system/message')
    .map(event => (event.data?.message?.content ?? []).map(block => block.text ?? '').join('\n')).join('\n');
  const calls = [];
  const byId = new Map();
  for (const event of own) {
    if (event.type === 'tool/call') {
      const call = { name: event.data?.name, ok: null, rejected: false };
      calls.push(call);
      byId.set(event.data?.callId, call);
    }
    if (event.type === 'tool/result') {
      const message = event.data?.message ?? {};
      const call = byId.get(message.toolCallId ?? message.source?.callId);
      if (!call) continue;
      const text = (message.content ?? []).map(block => block.text ?? '').join(' ');
      call.ok = message.isError !== true;
      call.rejected = /^Error: (Tool \S+ is excluded by the Studio role|Tool excluded by Studio|Studio preset policy could not be installed|Studio policy selected tools unavailable)/.test(text);
    }
  }
  const ends = own.filter(event => event.type === 'turn/end').map(event => event.data?.reason?.kind ?? null);
  return {
    id: header.id ?? null,
    parent: header.parentSession ?? null,
    origin: header.origin ?? 'user',
    preset: header.agentPreset ?? null,
    tools: requests[0]?.tools ? requests[0].tools.map(tool => tool.name).sort() : null,
    markers: Object.fromEntries(markers.map(marker => [marker, systemText.includes(marker)])),
    calls,
    turnsEnded: ends.length,
    lastEnd: ends.at(-1) ?? null,
  };
}

/** Same evidence from mock captures (what the model was actually offered), for one session id. */
export function captureEvidence(records, sessionId, markers = []) {
  const own = records.filter(record => record.session === sessionId && record.purpose === 'turn' && record.tools.length);
  const history = own.map(record => record.texts.join('\n')).join('\n');
  // A Fork child keeps the parent's system prompt; DSH sends the child's prompt changes as an
  // in-history system update. "Reached the model" therefore means system text or that update.
  const update = own.map(record => record.texts.filter(text => text.includes('You are an AI agent powered by')).join('\n')).join('\n');
  return {
    requests: own.length,
    tools: own[0]?.tools ?? null,
    systemMarkers: Object.fromEntries(markers.map(marker => [marker, own.some(record => record.system.includes(marker)) || update.includes(marker)])),
    historyMarkers: Object.fromEntries(markers.map(marker => [marker, history.includes(marker)])),
  };
}

const sameSet = (a, b) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);

/**
 * Compare one child's evidence with its expectation. Returns failed facts as strings (empty = pass).
 * expect: { provider?, deny?, tools?, persona?, inheritsMarker?, notInheritsMarker?, rejected?, executed? }
 */
export function checkChild({ policy, evidence, capture }, expect) {
  const failures = [];
  // History and prompt-reach facts need the mock capture; without it they are not verifiable at L0.
  const needsCapture = ['inheritsMarker', 'notInheritsMarker'].filter(key => expect[key]);
  if (needsCapture.length && !capture?.historyMarkers) failures.push(`unverifiable without --mock-llm capture: ${needsCapture.join(', ')}`);
  if (expect.deny && !sameSet(policy?.deny ?? [], expect.deny)) failures.push(`deny ${JSON.stringify(policy?.deny ?? null)} ≠ ${JSON.stringify(expect.deny)}`);
  if (expect.persona !== undefined) {
    if ((policy?.persona ?? null) !== (expect.persona || null)) failures.push(`stored persona ${policy?.persona === undefined ? 'absent' : 'differs'}`);
    // Reaching the model is only provable from a mock capture that searched for this marker.
    const reached = capture?.systemMarkers?.[expect.persona];
    if (expect.persona && reached === undefined) failures.push(`persona reach unverifiable: run with --mock-llm and pass ${expect.persona} in t.children({ markers })`);
    else if (expect.persona && reached === false) failures.push('persona did not reach the child model (system prompt or system update)');
  }
  const tools = capture?.tools ?? evidence?.tools;
  if ((expect.deny?.length || expect.tools) && !tools) failures.push('offered tools unknown: no mock capture and no request header in the child log');
  if (expect.tools && !(tools && sameSet(tools, expect.tools))) failures.push(`tools ${JSON.stringify(tools)} ≠ ${JSON.stringify(expect.tools)}`);
  for (const name of expect.deny ?? []) if (tools?.includes(name)) failures.push(`denied tool ${name} offered to the model`);
  if (expect.inheritsMarker && capture?.historyMarkers && capture.historyMarkers[expect.inheritsMarker] !== true) failures.push(`history marker ${expect.inheritsMarker} not inherited`);
  if (expect.notInheritsMarker && capture?.historyMarkers && capture.historyMarkers[expect.notInheritsMarker] !== false) failures.push(`history marker ${expect.notInheritsMarker} leaked`);
  for (const name of expect.rejected ?? []) {
    const call = evidence?.calls.find(item => item.name === name);
    if (!call) failures.push(`no ${name} call to test rejection`);
    else if (!call.rejected) failures.push(`${name} was not rejected (ok=${call.ok})`);
  }
  for (const name of expect.executed ?? []) {
    const call = evidence?.calls.find(item => item.name === name);
    if (!call || call.ok !== true) failures.push(`${name} did not run successfully`);
  }
  return failures;
}

/** Last assistant text of a session (bounded), for L1 hand-off. Tool calls are not included. */
export function lastReply(events, limit = 8000) {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type !== 'assistant/message') continue;
    const text = (event.data?.message?.content ?? []).filter(block => block.type === 'text').map(block => block.text ?? '').join('\n').trim();
    if (text) return text.slice(0, limit);
  }
  return '';
}
