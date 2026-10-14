#!/usr/bin/env node
/**
 * Read-only report of what one DSH session and the subagents it started actually received.
 *
 *   node studio/scripts/agents/subagent-report.mjs <parent-session-id> [--home ~/.dsh] [--profile desktop] [--json]
 *
 * Reads the persisted session logs (session.v4.jsonl.zstd) under <home>/sessions. For the parent and
 * every child whose `parentSession` is the parent, it prints the preset, spawn provider, the
 * toolFilter DSH recorded for the child, the tool names of the first model request, and which
 * known usage-instruction sentences appear in the first system prompt. It also reads the profile's
 * installed Studio version and the stored preset (default Tool Filter, each role's mode and list)
 * so a check can name what was configured, not only what DSH applied. It never writes anything.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const target = args.find(arg => !arg.startsWith('--') && arg !== flag('--home') && arg !== flag('--profile'));
if (!target) { console.error('usage: subagent-report.mjs <parent-session-id> [--home ~/.dsh] [--profile desktop] [--json]'); process.exit(2); }
const profileName = flag('--profile') ?? 'desktop';
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
const parentEvents = read(parentFile.file);
const parent = summarize(parentId, parentEvents);
// Children name the parent in their header; scan headers only (first line) before reading whole logs.
const children = files.filter(entry => entry.id !== parentId).flatMap(entry => {
  const first = execFileSync('sh', ['-c', 'zstd -dc "$1" 2>/dev/null | head -n 1', 'sh', entry.file], { encoding: 'utf8' });
  try { return JSON.parse(first).parentSession === parentId ? [summarize(entry.id, read(entry.file))] : []; } catch { return []; }
});

/** Start time of the running DeepSeek Harness desktop app, if any (macOS, best effort). */
function desktopAppStart() {
  if (process.platform !== 'darwin' || profileName !== 'desktop') return undefined;
  try {
    const rows = execFileSync('ps', ['-axo', 'lstart=,command='], { encoding: 'utf8' }).split('\n');
    const main = rows.find(row => /\/MacOS\/DeepSeek Harness$/.test(row.trim()));
    const start = main ? Date.parse(main.trim().slice(0, 24)) : NaN;
    return Number.isNaN(start) ? undefined : start;
  } catch { return undefined; }
}

/**
 * The Studio build and preset the session ran with. The package on disk is the installed version;
 * an app started before that install still runs the previous build until it restarts.
 */
function studioContext(presetId, sessionStart) {
  const appStart = desktopAppStart();
  const profileDir = path.join(home, 'profiles', profileName);
  const manifest = path.join(profileDir, 'node_modules', '@matamt-dbg', 'dsh-studio', 'package.json');
  const installed = existsSync(manifest) ? { version: JSON.parse(readFileSync(manifest, 'utf8')).version, at: statSync(manifest).mtimeMs } : undefined;
  const store = path.join(profileDir, 'studio-data', 'presets.json');
  const row = existsSync(store) ? JSON.parse(readFileSync(store, 'utf8')).presets?.find(item => item.id === presetId) : undefined;
  const roles = (row?.agents ?? []).map(role => ({
    role: role.role, spawn: role.spawn,
    // No toolFilter: preset default. A list without a mode (0.2.6) replaced the default.
    mode: role.toolFilter ? role.toolFilter.mode ?? 'replace' : 'default',
    legacy: !!role.toolFilter && role.toolFilter.mode === undefined,
    deny: role.toolFilter?.deny ?? [],
  }));
  return {
    profile: profileName,
    installedVersion: installed?.version ?? null,
    installedAt: installed ? new Date(installed.at).toISOString() : null,
    // Installed after the session started: the session may still have run the earlier build.
    installedAfterSession: installed && sessionStart ? installed.at > sessionStart : null,
    // Installed after the running app started: the app still runs the earlier build (it loads plugins at start).
    appStartedAt: appStart ? new Date(appStart).toISOString() : null,
    installedAfterAppStart: installed && appStart ? installed.at > appStart : null,
    preset: row ? { id: row.id, name: row.name, appliedAt: row.appliedAt ?? null, defaultToolFilter: row.request?.subagentToolFilter?.deny ?? [], roles } : null,
  };
}

const sessionStart = parentEvents.find(event => event.type === 'session')?.createdAt;
const studio = studioContext(parent.preset, sessionStart);
// Expected list per role, the same rule subagent_role applies, to compare with what DSH recorded.
if (studio.preset) for (const role of studio.preset.roles) {
  role.expected = role.mode === 'default' ? studio.preset.defaultToolFilter
    : role.mode === 'extend' ? [...new Set([...studio.preset.defaultToolFilter, ...role.deny])] : role.deny;
}

if (args.includes('--json')) { console.log(JSON.stringify({ studio, parent, children }, null, 2)); process.exit(0); }
const show = (row, indent = '') => {
  console.log(`${indent}${row.id}  origin=${row.origin} preset=${row.preset} provider=${row.provider ?? '-'} label=${row.label ?? '-'} model=${row.model ?? '-'}`);
  console.log(`${indent}  toolFilter (recorded by DSH): ${row.toolFilter ? JSON.stringify(row.toolFilter) : 'none'}`);
  console.log(`${indent}  tools (${row.tools?.length ?? 0}): ${row.tools?.join(', ') ?? 'no model request yet'}`);
  console.log(`${indent}  usage instructions present: ${Object.entries(row.guidance).filter(([, on]) => on).map(([name]) => name).join(', ') || 'none of the tracked sections'}`);
  if (row.policyRejections.length) console.log(`${indent}  policy rejections: ${row.policyRejections.length} (first: ${row.policyRejections[0].slice(0, 160)})`);
};
console.log(`Studio (${studio.profile} profile): installed ${studio.installedVersion ?? 'not found'}${studio.installedAt ? ` at ${studio.installedAt}` : ''}`);
if (studio.appStartedAt) console.log(`  running app started at ${studio.appStartedAt}`);
// The session can only have run the installed build if the app that ran it started after the
// install. The running app is the only start time available; for an older session it is a later one.
const sessionAt = sessionStart ? new Date(sessionStart).toISOString() : null;
if (studio.installedAfterAppStart) console.log('  WARNING: installed after the running app started. The app still runs the previous Studio build; restart it and run the check again.');
else if (studio.installedAfterSession) console.log(`  WARNING: installed after this session started (${sessionAt}). The session ran an earlier build.`);
else if (studio.appStartedAt && sessionStart && Date.parse(studio.appStartedAt) > sessionStart) console.log(`  NOTE: the running app started after this session (${sessionAt}); this report cannot tell which build the session ran. Start a new session to check the installed build.`);
if (studio.preset) {
  console.log(`Preset ${studio.preset.name} (${studio.preset.id}), applied ${studio.preset.appliedAt ?? 'never'}`);
  console.log(`  default Tool Filter: ${JSON.stringify(studio.preset.defaultToolFilter)}`);
  if (studio.preset.roles.some(role => role.mode === 'replace' && role.legacy)) console.log('  NOTE: a role list without a mode was saved before 0.2.7 and reads as replace. Save the preset again to pick extend or replace explicitly.');
  for (const role of studio.preset.roles) console.log(`  role ${role.role} (${role.spawn}): mode=${role.mode}${role.mode === 'default' ? '' : ` list=${JSON.stringify(role.deny)}`} expected=${JSON.stringify([...role.expected].sort())}`);
} else console.log(`Preset ${parent.preset ?? '(none)'}: not a stored Studio preset in this profile`);
console.log('');
show(parent);
console.log(`\n${children.length} subagent session(s):`);
for (const child of children) show(child, '  ');
