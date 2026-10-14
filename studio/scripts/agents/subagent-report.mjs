#!/usr/bin/env node
/**
 * Read-only report of what one DSH session and the subagents it started actually received.
 *
 *   node studio/scripts/agents/subagent-report.mjs <parent-session-id> [--home ~/.dsh] [--json]
 *
 * Reads the persisted session logs (session.v4.jsonl.zstd) under <home>/sessions. For the parent and
 * every child whose `parentSession` is the parent, it prints the preset, spawn provider, the
 * toolFilter DSH recorded for the child, the tool names of the first model request, and which
 * known usage-instruction sentences appear in the first system prompt. It never writes anything.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const target = args.find(arg => !arg.startsWith('--') && arg !== flag('--home'));
if (!target) { console.error('usage: subagent-report.mjs <parent-session-id> [--home ~/.dsh] [--json]'); process.exit(2); }
const home = flag('--home') ?? process.env.DSH_HOME ?? path.join(homedir(), '.dsh');
const parentId = target.startsWith('session-') ? target : `session-${target}`;

/** First sentences of DSH usage instructions that Tool Filter must remove with their tool. */
const GUIDANCE = {
  'tool:bash': 'Check the [exit code: N] marker',
  'tool:jobs': 'Track every background job id you start',
  'tool:workflow': 'tool ONLY when the user explicitly asks for a workflow',
  'tool:read': 'Use the read tool',
  'tool:write': 'Read an existing file before overwriting it',
  'tool:edit': 'Read a file before editing it',
  'tool:grep': 'Use the grep tool',
  'tool:glob': 'Use the glob tool',
};

function sessionFiles() {
  const root = path.join(home, 'sessions');
  if (!existsSync(root)) throw new Error(`No sessions directory at ${root}`);
  return readdirSync(root).flatMap(project => {
    const dir = path.join(root, project);
    let entries; try { entries = readdirSync(dir); } catch { return []; }
    return entries.map(id => ({ id, file: path.join(dir, id, 'session.v4.jsonl.zstd') })).filter(entry => existsSync(entry.file));
  });
}

function read(file) {
  const text = execFileSync('zstd', ['-dc', file], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  return text.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

function summarize(id, events) {
  const header = events.find(event => event.type === 'session') ?? {};
  const descriptor = events.find(event => event.type === 'subagent/descriptor')?.data;
  const selected = events.filter(event => event.type === 'agent-preset/selected').map(event => event.data.agentPreset);
  const request = events.find(event => event.type === 'request/header')?.data?.header;
  const system = events.find(event => event.type === 'system/message')?.data?.message?.content?.map(block => block.text ?? '').join('\n') ?? '';
  const calls = events.filter(event => event.type === 'tool/call').map(event => event.data.name);
  const results = events.filter(event => event.type === 'tool/result').map(event => event.data?.message?.content?.map(block => block.text ?? '').join(' ') ?? '');
  return {
    id,
    parentSession: header.parentSession ?? null,
    origin: header.origin ?? 'user',
    preset: selected.at(-1) ?? header.agentPreset ?? null,
    provider: descriptor?.provider ?? null,
    label: descriptor?.label ?? null,
    persona: descriptor?.persona ?? null,
    toolFilter: descriptor?.toolFilter ?? null,
    model: descriptor?.agentModel ?? request?.config?.model ?? null,
    tools: request?.tools?.map(tool => tool.name).sort() ?? null,
    guidance: Object.fromEntries(Object.entries(GUIDANCE).map(([section, sentence]) => [section, system.includes(sentence)])),
    toolCalls: calls,
    // A rejection is a result that starts as an error, not a file read that merely mentions the phrase.
    policyRejections: results.filter(text => /^Error: (Tool excluded by Studio|Studio preset policy could not be installed|Studio policy selected tools unavailable)/.test(text)),
  };
}

const files = sessionFiles();
const parentFile = files.find(entry => entry.id === parentId);
if (!parentFile) throw new Error(`Session ${parentId} not found under ${home}/sessions`);
const parent = summarize(parentId, read(parentFile.file));
// Children name the parent in their header; scan headers only (first line) before reading whole logs.
const children = files.filter(entry => entry.id !== parentId).flatMap(entry => {
  const first = execFileSync('sh', ['-c', 'zstd -dc "$1" 2>/dev/null | head -n 1', 'sh', entry.file], { encoding: 'utf8' });
  try { return JSON.parse(first).parentSession === parentId ? [summarize(entry.id, read(entry.file))] : []; } catch { return []; }
});

if (args.includes('--json')) { console.log(JSON.stringify({ parent, children }, null, 2)); process.exit(0); }
const show = (row, indent = '') => {
  console.log(`${indent}${row.id}  origin=${row.origin} preset=${row.preset} provider=${row.provider ?? '-'} label=${row.label ?? '-'} model=${row.model ?? '-'}`);
  console.log(`${indent}  toolFilter (recorded by DSH): ${row.toolFilter ? JSON.stringify(row.toolFilter) : 'none'}`);
  console.log(`${indent}  tools (${row.tools?.length ?? 0}): ${row.tools?.join(', ') ?? 'no model request yet'}`);
  console.log(`${indent}  usage instructions present: ${Object.entries(row.guidance).filter(([, on]) => on).map(([name]) => name).join(', ') || 'none of the tracked sections'}`);
  if (row.policyRejections.length) console.log(`${indent}  policy rejections: ${row.policyRejections.length} (first: ${row.policyRejections[0].slice(0, 160)})`);
};
show(parent);
console.log(`\n${children.length} subagent session(s):`);
for (const child of children) show(child, '  ');
