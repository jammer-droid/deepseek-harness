/** Pure helpers for wait.mjs: read DSH session logs and Studio Pixie records into short summaries. */

/** Parse a decompressed session.v4.jsonl into a turn summary. Message text is not included. */
export function sessionSummary(jsonl) {
  const summary = { turns: 0, ended: 0, lastEnd: null, toolCalls: {}, toolErrors: 0, open: false };
  for (const line of String(jsonl).split('\n')) {
    if (!line.trim()) continue;
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'turn/start') { summary.turns++; summary.open = true; }
    if (event.type === 'turn/end') {
      summary.ended++;
      summary.open = false;
      summary.lastEnd = { turn: event.data?.turn, reason: event.data?.reason?.kind ?? null, time: event.time };
    }
    if (event.type === 'tool/call') {
      const name = event.data?.name ?? 'unknown';
      summary.toolCalls[name] = (summary.toolCalls[name] ?? 0) + 1;
    }
    if (event.type === 'tool/result' && event.data?.message?.isError) summary.toolErrors++;
  }
  return summary;
}

/** A session is done when it has at least `turns` ended turns and no turn is open. */
export const sessionDone = (summary, turns = 1) => summary.ended >= turns && !summary.open;

/** Pixie loop run summary from a loops/<session>.json record. Item outputs are not included. */
export function loopSummary(run) {
  const counts = {};
  for (const item of run.items ?? []) counts[item.status ?? 'pending'] = (counts[item.status ?? 'pending'] ?? 0) + 1;
  return { id: run.id, status: run.status, total: run.total, counts, usage: run.usage, startedAt: run.startedAt, finishedAt: run.finishedAt ?? null };
}

export const LOOP_FINAL = new Set(['done', 'stopped', 'cancelled', 'error']);

/** Pixie gate run summary from a gates/<session>.json record. Texts are not included. */
export const gateSummary = run => ({ id: run.id, gate: run.gateName, point: run.point, status: run.status, applied: run.applied ?? null, startedAt: run.startedAt, endedAt: run.endedAt ?? null });

export const GATE_FINAL = new Set(['done', 'error', 'skipped', 'cancelled']);

/** Runs that started at or after `since` (ms), newest last. */
export const runsSince = (runs, since = 0) => (runs ?? []).filter(run => (run.startedAt ?? 0) >= since);
