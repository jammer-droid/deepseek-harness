import assert from 'node:assert/strict';
import test from 'node:test';
import { L1_LINE_MAX, PRICES, aggregateProbe, apiSearchBody, legacyBody, legacyCost, legacySources, legacyUsage, pairItem, sessionCost, toolText } from '../scripts/e2e/web-cost-lib.mjs';

test('request bodies match the DSH providers', () => {
  assert.deepEqual(legacyBody('q'), {
    model: 'deepseek-v4-flash', max_tokens: 4096,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Perform a web search for the query: q' }] }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    thinking: { type: 'disabled' },
  });
  assert.deepEqual(apiSearchBody('q'), { query: 'q', count: 8, need_content: false });
});

test('legacy response maps to deduped sources with citation snippets', () => {
  const response = { content: [
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://a', title: 'A' }, { type: 'web_search_result', url: 'https://a', title: 'A2' }] },
    { type: 'text', text: 'x', citations: [{ url: 'https://a', cited_text: 'snip' }] },
  ] };
  assert.deepEqual(legacySources(response), { sources: [{ url: 'https://a', title: 'A', snippet: 'snip' }], resultBlocks: 1 });
  assert.match(toolText([{ url: 'https://a', title: 'A', snippet: 'snip' }]), /- \[A\]\(https:\/\/a\) — snip/);
});

test('costs: legacy tokens now, plus per-search fee after billing; cache hits at hit rate', () => {
  const usage = legacyUsage({ input_tokens: 1_000_000, cache_read_input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 2 } });
  const cost = legacyCost(usage);
  assert.equal(cost.now.offPeak, PRICES.flash.offPeak.inputMiss);
  assert.ok(Math.abs(cost.afterBilling.offPeak - (PRICES.flash.offPeak.inputMiss + 2 * PRICES.perRequest)) < 1e-12);
  const agg = aggregateProbe([
    { kind: 'search', provider: 'api', ok: true, billable: true, latencyMs: 10, sources: 2, resultChars: 100, cost: { now: { offPeak: 1, peak: 1 }, afterBilling: { offPeak: 1, peak: 1 } } },
    { kind: 'search', provider: 'api', ok: false, latencyMs: 99 },
  ]);
  assert.equal(agg['search:api'].ok, 1);
  assert.equal(agg['search:api'].failed, 1);
  assert.equal(agg['search:api'].latencyMsMedian, 10);
});

test('sessionCost sums usage and web result size without message text', () => {
  const events = [
    { type: 'assistant/message', data: { usage: { inputTokens: 5, cacheReadTokens: 10, cacheWriteTokens: 2, outputTokens: 3 }, message: { source: { provider: 'deepseek', model: 'deepseek-flash' } } } },
    { type: 'tool/call', data: { name: 'web_search', callId: 'c1', arguments: '{"queries":["a","b"]}' } },
    { type: 'web/deepseek-search-llm-request', data: {} },
    { type: 'tool/result', data: { message: { toolCallId: 'c1', content: [{ type: 'text', text: 'abcd' }] } } },
    { type: 'turn/end', data: { reason: { kind: 'completed' } } },
  ];
  const cost = sessionCost(events);
  assert.deepEqual(cost.usage, { inputTokens: 5, cacheHitTokens: 10, cacheWriteTokens: 2, outputTokens: 3 });
  assert.deepEqual(cost.tools, { web_search: 1, web_search_queries: 2 });
  assert.equal(cost.webResultChars, 4);
  assert.equal(cost.legacySearchRequests, 1);
  assert.equal(cost.model, 'deepseek/deepseek-flash');
});

test('pair items hide which provider is which', () => {
  const { item, map } = pairItem('q1', 'query', [{ url: 'https://l.example/x' }], [{ url: 'https://a.example/y' }], true);
  const input = JSON.parse(item.input);
  assert.match(input.A, /a\.example\/y/);
  assert.deepEqual(map, { A: 'api', B: 'legacy', tie: 'tie' });
  assert.ok(!item.input.includes('legacy') && !item.input.includes('api'));
});

test('pair items fit one read-tool line even with long sources', () => {
  const long = Array.from({ length: 8 }, (_, i) => ({ url: `https://example.com/${'p'.repeat(200)}${i}`, title: `"T" ${'t'.repeat(200)}`, snippet: `"s" ${'s'.repeat(500)}` }));
  const { item } = pairItem('q1', 'query', long, long, false);
  assert.ok(JSON.stringify(item).length <= L1_LINE_MAX, String(JSON.stringify(item).length));
});
