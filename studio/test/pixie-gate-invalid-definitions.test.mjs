import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PixieGateDefinitions } from '../src/host/pixie-gate-definitions.ts';
import { gateInput } from '../src/host/pixie-gate-input.ts';
import { gateTurn } from '../src/host/pixie-gate-turn.ts';
import { gateTools } from '../src/host/pixie-gate-tools.ts';
const valid = { definition: { id: 'valid', name: 'Valid', enabled: true, point: 'input', match: {}, stages: [{ id: 'check', kind: 'command', role: 'check', command: { command: 'true' } }], forward: { kind: 'original' }, onError: 'pass', confirmRevision: false, limits: { stageTimeoutMs: 1000, maxSteersPerTurn: 1 } }, presetIds: ['p'] };
test('mixed definitions preserve valid gates and expose rejected raw rows without writing', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'gate-invalid-')), 'definitions.json');
  const raw = { definition: { ...valid.definition, id: 'invalid', stages: [{ id: 'judge', kind: 'judge', questions: { choice: { type: 'choice', prompt: 'Choose', options: { a: '', b: 'Valid option' } } }, pass: { kind: 'all' } }] }, presetIds: ['p'] };
  const source = JSON.stringify([raw, valid]); await writeFile(file, source);
  const result = await new PixieGateDefinitions(file).read();
  assert.equal(result.entries.length, 1); assert.equal(result.entries[0].definition.id, 'valid');
  assert.equal(result.invalid.length, 1); assert.equal(result.invalid[0].index, 0); assert.deepEqual(result.invalid[0].raw, raw); assert.ok(result.invalid[0].error.code); assert.ok(result.invalid[0].error.message);
  assert.equal(await readFile(file, 'utf8'), source);
});
test('broken JSON returns file diagnostics and never overwrites the source', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'gate-broken-')), 'definitions.json'); await writeFile(file, '{broken');
  const result = await new PixieGateDefinitions(file).read();
  assert.deepEqual(result.entries, []); assert.equal(result.error.code, 'invalid-json'); assert.equal(await readFile(file, 'utf8'), '{broken');
});
for (const point of ['input', 'turn-end', 'tool-before', 'tool-after']) test(`${point} fails open when definition loading rejects`, async () => {
  const warnings = []; const deps = { definitions: async () => { throw new Error('disk unavailable'); }, preset: () => 'p', warn: text => warnings.push(text) };
  const agent = { id: 's' }, signal = new AbortController().signal;
  const decision = point === 'input' ? { kind: 'enter', messages: [] } : { kind: point === 'tool-before' ? 'allow' : 'accept' };
  let nextCalls = 0; const next = async () => { nextCalls++; return decision; };
  const tools = gateTools(deps); const input = gateInput(deps); const turn = gateTurn(deps);
  for (let i = 0; i < 2; i++) {
    if (point === 'turn-end') assert.equal(await turn({ agent, signal, turn: 1 }), undefined);
    else if (point === 'input') assert.equal(await input({ agent, signal, turn: 1 }, next), decision);
    else if (point === 'tool-before') assert.equal(await tools.before({ agent, signal }, next), decision);
    else assert.equal(await tools.after({ agent, signal }, { content: [] }, next), decision);
  }
  assert.equal(nextCalls, point === 'turn-end' ? 0 : 2); assert.equal(warnings.length, 1);
});

test('invalid conflicting rows do not reserve IDs or bindings for later valid rows', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'gate-conflict-')), 'definitions.json');
  const conflict = { definition: { ...valid.definition, id: 'later' }, presetIds: ['q', 'p'] };
  const later = { definition: { ...valid.definition, id: 'later' }, presetIds: ['q'] };
  await writeFile(file, JSON.stringify([valid, conflict, later]));
  const result = await new PixieGateDefinitions(file).read();
  assert.deepEqual(result.entries.map(row => row.definition.id), ['valid', 'later']);
  assert.deepEqual(result.invalid.map(row => row.index), [1]);
});
test('invalid legacy definitions stay at the source and remain available for recovery', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gate-legacy-invalid-'));
  const legacy = join(dir, 'legacy.json'), file = join(dir, 'new', 'definitions.json');
  const source = JSON.stringify([null, valid]); await writeFile(legacy, source);
  const result = await new PixieGateDefinitions(file, legacy).read();
  assert.equal(result.entries.length, 1); assert.equal(result.invalid.length, 1);
  assert.equal(await readFile(legacy, 'utf8'), source);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
});
