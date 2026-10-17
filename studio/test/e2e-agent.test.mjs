import assert from 'node:assert/strict';
import test from 'node:test';
import { captureRecord, decide, parseDirectives, sseEvents } from '../scripts/e2e/mock-llm-lib.mjs';
import { captureEvidence, checkChild, mockScript, sessionEvidence } from '../scripts/e2e/agent-lib.mjs';

const user = text => ({ role: 'user', content: [{ type: 'text', text }] });
const toolUse = name => ({ role: 'assistant', content: [{ type: 'tool_use', id: 'c', name, input: {} }] });
const toolResult = (text, isError = false) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c', is_error: isError, content: [{ type: 'text', text }] }] });

test('parseDirectives reads tool and say lines and reports bad JSON', () => {
  assert.deepEqual(parseDirectives('x\nMOCK tool read {"file_path":"a"}\n  MOCK say done\nMOCK tool bad {oops'), [
    { kind: 'tool', name: 'read', input: { file_path: 'a' } }, { kind: 'say', text: 'done' }, { kind: 'error', text: 'bad JSON for bad' }]);
});

test('decide plays directives in order after the newest text message, then ends', () => {
  const script = user(mockScript([['read', { file_path: 'a' }], ['write', {}], 'MOCK say ok']));
  assert.deepEqual(decide({ messages: [script] }), { kind: 'tool', name: 'read', input: { file_path: 'a' }, step: 0 });
  assert.equal(decide({ messages: [script, toolUse('read'), toolResult('r')] }).name, 'write');
  assert.deepEqual(decide({ messages: [script, toolUse('read'), toolResult('r'), toolUse('write'), toolResult('no', true)] }), { kind: 'text', text: 'ok', step: 2 });
  const done = decide({ messages: [user('MOCK tool read {}'), toolUse('read'), toolResult('Error: denied', true)] });
  assert.equal(done.kind, 'text');
  assert.match(done.text, /^MOCK done \[\{"error":true,"text":"Error: denied"\}\]$/);
  // An older script does not replay once a newer plain message arrives.
  assert.deepEqual(decide({ messages: [script, toolUse('read'), toolResult('r'), user('hello')] }), { kind: 'text', text: 'MOCK done', step: 0 });
});

test('sseEvents emits a tool_use or text completion and captureRecord keeps no auth', () => {
  const tool = sseEvents({ kind: 'tool', name: 'read', input: { a: 1 } });
  assert.equal(tool.at(-2).delta.stop_reason, 'tool_use');
  assert.equal(JSON.parse(tool[2].delta.partial_json).a, 1);
  assert.equal(sseEvents({ kind: 'text', text: 'hi' })[2].delta.text, 'hi');
  const record = captureRecord({ model: 'm', system: [{ text: 'SYS' }], tools: [{ name: 'write' }, { name: 'read' }], messages: [user('t')] },
    { 'x-deepseek-harness-session-id': 's1', 'x-api-key': 'secret', authorization: 'Bearer secret' }, { kind: 'text' }, 1);
  assert.deepEqual([record.session, record.tools, record.system, record.texts], ['s1', ['read', 'write'], 'SYS', ['t']]);
  assert.ok(!JSON.stringify(record).includes('secret'));
});

test('sessionEvidence reads header, first own request tools, rejections and turn ends', () => {
  const events = [
    { type: 'session', id: 'c1', parentSession: 'p1', origin: 'subagent', agentPreset: 'x' },
    { type: 'user/message' },
    { type: 'request/header', data: { header: { tools: [{ name: 'read' }, { name: 'bash' }] } } },
    { type: 'system/message', data: { message: { content: [{ text: 'PERSONA_A here' }] } } },
    { type: 'tool/call', data: { name: 'write', callId: 'w' } },
    { type: 'tool/result', data: { message: { toolCallId: 'w', isError: true, content: [{ text: 'Error: Tool write is excluded by the Studio role' }] } } },
    { type: 'tool/call', data: { name: 'read', callId: 'r' } },
    { type: 'tool/result', data: { message: { toolCallId: 'r', content: [{ text: 'ok' }] } } },
    { type: 'turn/end', data: { reason: { kind: 'completed' } } },
  ];
  const evidence = sessionEvidence(events, ['PERSONA_A', 'NOPE']);
  assert.deepEqual([evidence.id, evidence.parent, evidence.tools, evidence.markers], ['c1', 'p1', ['bash', 'read'], { PERSONA_A: true, NOPE: false }]);
  assert.deepEqual(evidence.calls, [{ name: 'write', ok: false, rejected: true }, { name: 'read', ok: true, rejected: false }]);
  assert.deepEqual([evidence.turnsEnded, evidence.lastEnd], [1, 'completed']);
});

test('captureEvidence finds persona in a Fork system update and history markers', () => {
  const records = [
    { session: 'c', purpose: 'turn', tools: ['read'], system: 'parent prompt', texts: ['HIST_1', 'You are an AI agent powered by DeepSeek Harness.\n\nPERSONA_K'] },
    { session: 'other', purpose: 'turn', tools: ['read'], system: 'PERSONA_X', texts: [] },
  ];
  const capture = captureEvidence(records, 'c', ['PERSONA_K', 'PERSONA_X', 'HIST_1']);
  assert.deepEqual(capture.systemMarkers, { PERSONA_K: true, PERSONA_X: false, HIST_1: false });
  assert.equal(capture.historyMarkers.HIST_1, true);
});

test('checkChild passes a matching child and names each mismatch', () => {
  const child = {
    policy: { deny: ['write', 'bash'], persona: 'P' },
    evidence: { calls: [{ name: 'write', ok: false, rejected: true }, { name: 'read', ok: true, rejected: false }] },
    capture: { tools: ['read', 'subagent_role'], systemMarkers: { P: true }, historyMarkers: { H: true } },
  };
  const expect = { deny: ['bash', 'write'], tools: ['subagent_role', 'read'], persona: 'P', rejected: ['write'], executed: ['read'], inheritsMarker: 'H' };
  assert.deepEqual(checkChild(child, expect), []);
  const bad = checkChild({ ...child, policy: { deny: ['write'] }, capture: { ...child.capture, tools: ['read', 'write'], historyMarkers: { H: false } },
    evidence: { calls: [{ name: 'write', ok: true, rejected: false }] } }, expect);
  assert.equal(bad.length, 7);
  // Missing evidence fails closed instead of passing on stored values alone.
  const noCapture = checkChild({ policy: { deny: ['write'], persona: 'P' }, evidence: { calls: [] } }, { deny: ['write'], persona: 'P' });
  assert.ok(noCapture.some(text => /persona reach unverifiable/.test(text)));
  assert.ok(noCapture.some(text => /offered tools unknown/.test(text)));
  assert.match(checkChild({ ...child, capture: { ...child.capture, systemMarkers: {} } }, { persona: 'P' })[0], /unverifiable/);
  assert.ok(bad.some(text => /denied tool write offered/.test(text)));
  assert.ok(bad.some(text => /write was not rejected/.test(text)));
  assert.ok(bad.some(text => /not inherited/.test(text)));
  assert.match(checkChild({ ...child, capture: undefined }, { notInheritsMarker: 'H' })[0], /unverifiable without --mock-llm/);
});

test('lastReply returns the newest assistant text only', async () => {
  const { lastReply } = await import('../scripts/e2e/agent-lib.mjs');
  const events = [
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'first' }] } } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'read' }] } } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'final answer' }] } } },
    { type: 'tool/result' },
  ];
  assert.equal(lastReply(events), 'final answer');
  assert.equal(lastReply([]), '');
});
