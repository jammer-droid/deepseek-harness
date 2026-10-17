#!/usr/bin/env node
/**
 * Scripted Messages-API mock model for agent-control E2E. No provider, no key, no tokens.
 *
 *   node studio/scripts/e2e/mock-llm.mjs --port <port> --capture <file.jsonl>
 *
 * Serves POST <base>/v1/messages as SSE. The reply is decided by directives in the conversation
 * (see mock-llm-lib.mjs). Every request is appended to the capture file (0600): session id header,
 * offered tool names, system prompt, bounded user texts, and the decision. Auth headers are never
 * recorded. Prints one line "mock-llm: http://127.0.0.1:<port>" when listening.
 */
import { appendFileSync, closeSync, openSync } from 'node:fs';
import { createServer } from 'node:http';
import { captureRecord, decide, sseEvents } from './mock-llm-lib.mjs';

const args = process.argv.slice(2);
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const port = Number(value('--port') ?? 0);
const capture = value('--capture');
if (capture) closeSync(openSync(capture, 'a', 0o600));
let calls = 0;

const server = createServer((request, response) => {
  if (request.method !== 'POST' || !/\/v1\/messages$/.test(new URL(request.url, 'http://x').pathname)) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'mock-llm serves POST /v1/messages only' } }));
    return;
  }
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad JSON' } }));
      return;
    }
    const decision = decide(body);
    if (capture) appendFileSync(capture, JSON.stringify(captureRecord(body, request.headers, decision)) + '\n');
    response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
    for (const event of sseEvents(decision, `mock-call-${++calls}`)) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    response.end();
  });
});

server.listen(port, '127.0.0.1', () => console.log(`mock-llm: http://127.0.0.1:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
