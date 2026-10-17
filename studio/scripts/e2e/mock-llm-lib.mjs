/**
 * Pure logic for the scripted mock model (mock-llm.mjs). The script lives in the conversation itself:
 * the newest user text may contain directive lines, and each model request after that text plays the
 * next one. Parent prompts and child tasks script themselves the same way.
 *
 *   MOCK tool <name> <json arguments>   call one tool
 *   MOCK say <text>                     end the turn with this text
 *
 * After the last directive (or with none) the model ends the turn with "MOCK done" plus the tool
 * results it saw, so a turn always terminates. Lines that are not directives are ignored.
 */

export const DIRECTIVE = /^MOCK (tool|say)\s+(.*)$/;

/** Text of a Messages content value (string or blocks), tool_result blocks excluded. */
export function userText(content) {
  if (typeof content === 'string') return content;
  return (content ?? []).filter(block => block?.type === 'text').map(block => block.text ?? '').join('\n');
}

const toolResults = content => (Array.isArray(content) ? content.filter(block => block?.type === 'tool_result') : []);

/** Directives in a text, in order. Invalid tool JSON becomes an error directive (reported, not thrown). */
export function parseDirectives(text) {
  const directives = [];
  for (const line of String(text).split('\n')) {
    const match = DIRECTIVE.exec(line.trim());
    if (!match) continue;
    if (match[1] === 'say') { directives.push({ kind: 'say', text: match[2] }); continue; }
    const space = match[2].indexOf(' ');
    const name = space < 0 ? match[2] : match[2].slice(0, space);
    const raw = space < 0 ? '{}' : match[2].slice(space + 1);
    try { directives.push({ kind: 'tool', name, input: JSON.parse(raw) }); } catch { directives.push({ kind: 'error', text: `bad JSON for ${name}` }); }
  }
  return directives;
}

/**
 * Decide one response for a Messages request body.
 * Index = number of assistant tool_use turns after the newest user message that carries text.
 */
export function decide(body) {
  const messages = body?.messages ?? [];
  let anchor = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role === 'user' && userText(message.content).trim()) { anchor = index; break; }
  }
  const directives = anchor < 0 ? [] : parseDirectives(userText(messages[anchor].content));
  const after = messages.slice(anchor + 1);
  const played = after.filter(message => message.role === 'assistant'
    && Array.isArray(message.content) && message.content.some(block => block?.type === 'tool_use')).length;
  const next = directives[played];
  if (next?.kind === 'tool') return { kind: 'tool', name: next.name, input: next.input, step: played };
  if (next?.kind === 'say') return { kind: 'text', text: next.text, step: played };
  if (next?.kind === 'error') return { kind: 'text', text: `MOCK error: ${next.text}`, step: played };
  const results = after.flatMap(message => toolResults(message.content)).map(block => ({
    error: block.is_error === true,
    text: userText(block.content).replace(/\s+/g, ' ').slice(0, 300),
  }));
  return { kind: 'text', text: `MOCK done${results.length ? ` ${JSON.stringify(results)}` : ''}`, step: played };
}

/** One capture record: what the model was offered and what it answered. Message texts are bounded. */
export function captureRecord(body, headers, decision, now = Date.now()) {
  const system = typeof body?.system === 'string' ? body.system
    : (body?.system ?? []).map(block => block?.text ?? '').join('\n');
  return {
    time: now,
    session: headers['x-deepseek-harness-session-id'] ?? null,
    purpose: headers['x-deepseek-harness-compact'] ? 'compaction' : 'turn',
    model: body?.model ?? null,
    tools: (body?.tools ?? []).map(tool => tool?.name).filter(Boolean).sort(),
    system,
    texts: (body?.messages ?? []).map(message => userText(message.content)).filter(Boolean).map(text => text.slice(0, 2000)),
    decision,
  };
}

/** Messages SSE events for a decision. */
export function sseEvents(decision, id = 'mock-call') {
  const start = { type: 'message_start', message: { id: 'mock-message', type: 'message', role: 'assistant', model: 'mock-model', content: [], usage: { input_tokens: 1, output_tokens: 0 } } };
  if (decision.kind === 'tool') {
    const json = JSON.stringify(decision.input ?? {});
    return [start,
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id, name: decision.name, input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: json } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: 'message_stop' }];
  }
  return [start,
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: decision.text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: 'message_stop' }];
}
