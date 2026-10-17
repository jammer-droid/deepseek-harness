import assert from 'node:assert/strict';
import test from 'node:test';
import { GATE_FINAL, LOOP_FINAL, gateSummary, loopSummary, runsSince, sessionDone, sessionSummary } from '../scripts/e2e/wait-lib.mjs';

const line = event => JSON.stringify(event);

test('sessionSummary counts turns and tool calls without message text', () => {
  const log = [
    line({ type: 'session', id: 's' }),
    line({ type: 'turn/start', data: { turn: 1 } }),
    line({ type: 'user/message', data: { content: [{ type: 'text', text: 'secret prompt' }] } }),
    line({ type: 'tool/call', data: { name: 'bash' } }),
    line({ type: 'tool/call', data: { name: 'bash' } }),
    line({ type: 'tool/result', data: { message: { isError: true } } }),
    line({ type: 'turn/end', time: 5, data: { turn: 1, reason: { kind: 'completed' } } }),
    'not json',
  ].join('\n');
  const summary = sessionSummary(log);
  assert.deepEqual(summary, { turns: 1, ended: 1, lastEnd: { turn: 1, reason: 'completed', time: 5 }, toolCalls: { bash: 2 }, toolErrors: 1, open: false });
  assert.ok(!JSON.stringify(summary).includes('secret'));
  assert.equal(sessionDone(summary), true);
  assert.equal(sessionDone(summary, 2), false);
});

test('an open turn or an unstarted session is not done', () => {
  assert.equal(sessionDone(sessionSummary(line({ type: 'turn/start', data: { turn: 1 } }))), false);
  assert.equal(sessionDone(sessionSummary(line({ type: 'session' }))), false);
});

test('loopSummary counts item statuses and drops outputs', () => {
  const summary = loopSummary({ id: 'r', status: 'done', total: 3, usage: { pixie: 1 }, startedAt: 1, finishedAt: 2,
    items: [{ status: 'passed', output: 'x' }, { status: 'passed' }, { status: 'escalated' }] });
  assert.deepEqual(summary.counts, { passed: 2, escalated: 1 });
  assert.ok(!JSON.stringify(summary).includes('"x"'));
  assert.ok(LOOP_FINAL.has('done') && !LOOP_FINAL.has('running'));
});

test('gateSummary drops texts and runsSince filters by start time', () => {
  const run = { id: 'g', gateName: 'Gate', point: 'input', status: 'done', applied: 'replaced', original: 'secret', finalText: 'secret', startedAt: 10 };
  assert.ok(!JSON.stringify(gateSummary(run)).includes('secret'));
  assert.ok(GATE_FINAL.has('done'));
  assert.deepEqual(runsSince([{ startedAt: 5 }, { startedAt: 10 }], 10), [{ startedAt: 10 }]);
});
